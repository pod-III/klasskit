/**
 * KlassKit – Supabase Auth Helper
 * --------------------------------
 * Loads the Supabase JS v2 client (imported via CDN in <head>)
 * and exposes a thin convenience API for auth.
 */

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mkarfktuvtllaxpunwtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5Fd483qrg6bEFa_T1oNyLg_gymEgi4P';

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ── MODE HELPERS ── */
function isSandbox() {
  return localStorage.getItem('kk_mode') === 'sandbox';
}

async function getUser() {
  if (isSandbox()) {
    return { id: 'sandbox_user', is_sandbox: true, email: 'sandbox@local' };
  }
  const { data: { session } } = await db.auth.getSession()
  return session?.user ?? null
}

async function getUserProfile() {
  const user = await getUser();
  if (!user) return null;
  if (user.is_sandbox) return { role: 'teacher', display_name: 'Guest Teacher' };

  const { data: profile, error } = await db
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle();
  
  if (error) {
    console.error('[Profile] Fetch error:', error);
    return null;
  }
  
  return profile;
}

async function requireAuth() {
  if (isSandbox()) {
    console.log("[Auth] Sandbox Mode Active. Bypassing Auth.");
    return { id: 'sandbox_user', is_sandbox: true };
  }
  const user = await getUser()
  if (!user) {
    const target = (window !== window.top) ? window.top : window
    target.localStorage.setItem('after_login', target.location.href)
    target.location.href = '/login.html'
    return new Promise(() => { })
  }

  const lastUserId = localStorage.getItem('kk_current_user_id')
  if (lastUserId && lastUserId !== user.id) {
    console.warn('[Auth] User ID mismatch. Clearing local cache for safety.')
    clearLocalCache()
  }
  localStorage.setItem('kk_current_user_id', user.id)

  console.log("auth success");
  return user
}

async function requireAdmin() {
  if (isSandbox()) {
    location.href = '/hub.html';
    return new Promise(() => { });
  }
  const user = await getUser()
  if (!user) {
    location.href = '/login.html'
    return new Promise(() => { })
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (error) console.error('[AdminGuard] Profile lookup error:', error)

  if (profile?.role !== 'admin') {
    console.warn('[AdminGuard] Access Denied.')
    location.href = '/api/unauthorized.html'
    return new Promise(() => { })
  }

  return { user, profile }
}

async function requirePro() {
  if (isSandbox()) {
    return { id: 'sandbox_user', is_sandbox: true };
  }
  const user = await getUser()
  if (!user) {
    location.href = '/login.html'
    return new Promise(() => { })
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' && profile?.role !== 'pro') {
    console.warn('[ProGuard] Access Denied. User requires Pro tier.')
    location.href = '/api/unauthorized.html'
    return new Promise(() => { })
  }

  return { user, profile }
}

async function signUp(email, pass, displayName) {
  const confirmationUrl = 'https://klasskit.fun/api/confirmation.html';
  return db.auth.signUp({
    email,
    password: pass,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: confirmationUrl
    }
  })
}

async function signIn(email, pass) {
  return db.auth.signInWithPassword({ email, password: pass })
}

async function signOut() {
  if (!isSandbox()) {
    await db.auth.signOut()
  }
  localStorage.removeItem('kk_mode');
  clearLocalCache()
  location.href = '/index.html'
}

function switchMode() {
  localStorage.removeItem('kk_mode');
  location.href = '/index.html';
}

function clearLocalCache() {
  console.log('[Auth] Clearing local cache...');
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith('prog_') ||
      key.startsWith('theme_') ||
      key.startsWith('klasskit_') ||
      key.startsWith('schedule_') ||
      key === 'recentGameIds' ||
      key === 'favoriteGames' ||
      key === 'openTabs' ||
      key === 'pinnedGameIds' ||
      key === 'soundMuted' ||
      key === 'migrated_to_cloud' ||
      key === 'kk_schedule_migrated_to_cloud' ||
      key === 'kk_current_user_id') {
      localStorage.removeItem(key)
    }
  })

  if (window.Storage && typeof window.Storage.syncWithCloud === 'function') {
    window.Storage.syncWithCloud()
  }
}

function sanitizeCloudPayload(data) {
  if (!data) return data
  const clean = JSON.parse(JSON.stringify(data))

  const traverse = (obj) => {
    for (const key in obj) {
      const val = obj[key]

      if (typeof val === 'string') {
        const isDataUrl = val.startsWith('data:')
        const isTooLong = val.length > 10000

        if (isDataUrl || isTooLong) {
          obj[key] = `[STRIPPED_FOR_CLOUD_SECURITY: ${isDataUrl ? 'Media' : 'LargePayload'}]`
        }
      } else if (typeof val === 'object' && val !== null) {
        traverse(val)
      }
    }
  }

  traverse(clean)
  return clean
}

async function sendPasswordReset(email) {
  if (isSandbox()) return { error: "Reset not available in Sandbox." };

  const resetUrl = 'https://klasskit.fun/api/reset-password.html';

  return await db.auth.resetPasswordForEmail(email, {
    redirectTo: resetUrl,
  });
}

async function updatePassword(newPassword) {
  if (isSandbox()) return { success: true };
  
  const { data, error } = await db.auth.updateUser({
    password: newPassword
  });
  
  return { data, error };
}

/* ── DATA HELPERS ── */
async function saveProgress(toolKey, data) {
  localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data))

  if (isSandbox()) return;
  
  // My Class is handled by its own dedicated table (myspace_my_class)
  if (toolKey === 'my-class') return;

  const user = await getUser()
  if (!user) return

  const sanitizedData = sanitizeCloudPayload(data)

  await db.from('user_progress').upsert(
    {
      user_id: user.id,
      tool_key: toolKey,
      data: sanitizedData,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,tool_key' }
  )
}

async function loadProgress(toolKey) {
  if (isSandbox()) {
    const local = localStorage.getItem(`prog_${toolKey}`);
    return local ? JSON.parse(local) : null;
  }

  const user = await getUser()
  if (user) {
    // FIX: Explicitly filter by user_id to prevent admin query crashes
    const { data, error } = await db.from('user_progress')
      .select('data')
      .eq('tool_key', toolKey)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[Load] DB Error:', error)
    }

    if (data) {
      localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data.data))
      return data.data
    }
  }

  const local = localStorage.getItem(`prog_${toolKey}`)
  return local ? JSON.parse(local) : null
}

async function checkUserActivity() {
  const user = await getUser();
  if (!user || user.is_sandbox) {
    return { hasActivity: false, hasMySpace: false };
  }

  const { data, error } = await db
    .from('user_progress')
    .select('tool_key')
    .eq('user_id', user.id);

  if (error) {
    console.error('[Activity] Error checking database:', error);
    return { hasActivity: false, hasMySpace: false };
  }

  if (!data || data.length === 0) {
    return { hasActivity: false, hasMySpace: false };
  }

  const mySpaceKeys = [
    'klasskit_tasks',
    'schedule_events',
    'schedule_class_admin',
    'schedule_class_units',
    'admin_tracker_data',
    'my-class'
  ];

  const hasMySpace = data.some(row => mySpaceKeys.includes(row.tool_key));
  const hasActivity = data.length > 0;

  return { hasActivity, hasMySpace };
}

async function updateDisplayName(displayName) {
  if (isSandbox()) return { success: true };
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }

  const { error: authError } = await db.auth.updateUser({
    data: { display_name: displayName }
  })
  if (authError) return { error: authError.message }

  // FIX: Strictly limit the update payload to only the display_name
  const { error: dbError } = await db
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (dbError) return { error: dbError.message }

  return { success: true }
}

async function migrateLocalToCloud() {
  if (isSandbox()) return;
  if (localStorage.getItem('migrated_to_cloud')) return
  const user = await getUser()
  if (!user) return

  const keys = Object.keys(localStorage).filter(k => k.startsWith('prog_') && k !== 'prog_my-class')
  for (const key of keys) {
    const toolKey = key.replace('prog_', '')
    const data = JSON.parse(localStorage.getItem(key))
    await saveProgress(toolKey, data)
  }

  if (window.Storage && typeof window.Storage.triggerCloudSave === 'function') {
    await window.Storage.triggerCloudSave()
  }

  localStorage.setItem('migrated_to_cloud', 'true')
}

/* ── STORAGE HELPERS ── */
const STORAGE_CONFIG = {
  bucket: 'klasskit-media',
  defaultLimit: 50 * 1024 * 1024, // 50MB
  quality: 0.8
};

/**
 * Compresses an image file client-side to WebP format using browser-image-compression.
 */
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;

  const options = {
    maxSizeMB: 0.2, // 200KB
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/webp'
  };

  try {
    if (typeof imageCompression === 'undefined') {
      console.warn('[Storage] browser-image-compression not loaded. Falling back to original.');
      return file;
    }
    return await imageCompression(file, options);
  } catch (error) {
    console.error('[Storage] Compression failed:', error);
    return file;
  }
}

/**
 * Returns user storage usage: { used, limit, percent }
 */
async function getUserStorageUsage() {
  const user = await getUser();
  if (!user || user.is_sandbox) {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const limit = STORAGE_CONFIG.defaultLimit; // Use fixed 50MB for sandbox UI consistency
        const percent = Math.min(100, Math.round((used / limit) * 100));
        return { used, limit, percent, isSandbox: true };
      } catch (e) { }
    }
    return { used: 0, limit: STORAGE_CONFIG.defaultLimit, percent: 0, isSandbox: true };
  }

  const { data, error } = await db
    .from('storage_quotas')
    .select('storage_usage, storage_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[Storage] Usage lookup error:', error);
    return { used: 0, limit: STORAGE_CONFIG.defaultLimit, percent: 0 };
  }

  const used = data.storage_usage || 0;
  const limit = data.storage_limit || STORAGE_CONFIG.defaultLimit;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return { used, limit, percent };
}

/**
 * Uploads a media file with compression and quota checks.
 */
async function uploadMedia(file, toolId, setId = null) {
  if (isSandbox()) throw new Error('Storage not available in Sandbox.');

  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Compress
  const compressedFile = await compressImage(file);
  const fileSize = compressedFile.size;

  // 2. Check quota
  const usage = await getUserStorageUsage();
  
  const filename = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const subPath = setId ? `${toolId}/${setId}` : toolId;
  const dirPath = `${user.id}/${subPath}`;
  const filePath = `${dirPath}/${filename}.webp`;
  
  let oldSize = 0;
  try {
    const { data: existingFiles } = await db.storage.from(STORAGE_CONFIG.bucket).list(dirPath);
    const existing = existingFiles?.find(f => f.name === `${filename}.webp`);
    if (existing) {
      oldSize = existing.metadata.size;
    }
  } catch (e) {
    console.warn('[Storage] Could not check existing file size:', e);
  }

  if (usage.used - oldSize + fileSize > usage.limit) {
    throw new Error('Storage quota exceeded');
  }

  // 3. Upload
  const { error: uploadError } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .upload(filePath, compressedFile, {
      contentType: 'image/webp',
      upsert: true
    });

  if (uploadError) throw uploadError;

  // 4. Update usage in profile
  const newUsage = usage.used - oldSize + fileSize;
  await db
    .from('storage_quotas')
    .update({ storage_usage: newUsage })
    .eq('user_id', user.id);

  // 5. Return Signed URL (Bucket is private)
  const { data, error: signError } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (signError) throw signError;
  return data.signedUrl;
}

/**
 * Copies a file within the private bucket.
 */
async function copyMedia(fromPath, toPath) {
  if (isSandbox()) return;
  const { error } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .copy(fromPath, toPath);
  if (error) throw error;
}

/**
 * Resolves a stored media URL to a signed URL if it belongs to our private bucket.
 */
async function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string' || !url.includes(STORAGE_CONFIG.bucket)) return url;
  
  try {
    const parts = url.split(STORAGE_CONFIG.bucket + '/');
    if (parts.length < 2) return url;
    
    // Extract path and remove any existing query params/tokens
    const filePath = parts[1].split('?')[0];
    
    const { data, error } = await db.storage
      .from(STORAGE_CONFIG.bucket)
      .createSignedUrl(filePath, 3600);
      
    return data?.signedUrl || url;
  } catch (e) {
    console.error('[Storage] URL resolution failed:', e);
    return url;
  }
}

/**
 * Deletes a media file and updates storage usage.
 * Note: deletion fires DB trigger sync_storage_on_delete() — must target storage_quotas
 * (see supabase/sql/fix_sync_storage_triggers.sql if you get a schema mismatch 400).
 */
async function deleteMedia(filePath) {
  if (isSandbox()) return;

  const user = await getUser();
  if (!user) return;

  const { error } = await db.storage.from(STORAGE_CONFIG.bucket).remove([filePath]);
  if (error) {
    if (error.message?.includes('sync_storage_on_delete') || error.message?.includes('schema mismatch')) {
      const fix = new Error(
        'Storage delete blocked by an outdated database trigger. Run supabase/sql/fix_sync_storage_triggers.sql in the Supabase SQL Editor.'
      );
      fix.cause = error;
      throw fix;
    }
    throw error;
  }

  // Reconcile quota with actual bucket contents (accurate even if trigger also adjusted usage)
  await recalculateUserStorage(user.id);

  return { success: true };
}

/**
 * Helper to delete media file from its Supabase URL.
 */
async function deleteMediaFromUrl(url) {
  if (!url || typeof url !== 'string' || !url.includes(STORAGE_CONFIG.bucket)) return;
  try {
    const path = url.split(STORAGE_CONFIG.bucket + '/')[1].split('?')[0];
    await deleteMedia(path);
  } catch (e) {
    console.warn('[Storage] URL-based deletion failed:', e);
  }
}

/**
 * Deletes an entire folder and updates usage.
 */
async function deleteFolder(folderPath) {
  if (isSandbox()) return;
  const user = await getUser();
  if (!user) return;

  try {
    // 1. List all files in folder
    const { data: files, error: listError } = await db.storage
      .from(STORAGE_CONFIG.bucket)
      .list(folderPath);
    
    if (listError || !files || files.length === 0) return;

    // 2. Calculate total size
    const totalSize = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
    const filePaths = files.map(f => `${folderPath}/${f.name}`);

    const { error: delError } = await db.storage
      .from(STORAGE_CONFIG.bucket)
      .remove(filePaths);

    if (delError) throw delError;

    await recalculateUserStorage(user.id);

    return { success: true, freed: totalSize };
  } catch (e) {
    console.error('[Storage] Folder deletion failed:', e);
    throw e;
  }
}

/**
 * Recalculates total storage usage for a user by walking their bucket path.
 * This is used to re-sync the database counter with reality.
 */
async function recalculateUserStorage(userId) {
  if (isSandbox()) return { used: 0, fileCount: 0 };

  let totalSize = 0;
  let fileCount = 0;

  async function walk(path) {
    const { data: items, error } = await db.storage.from(STORAGE_CONFIG.bucket).list(path);
    if (error) {
      if (error.message?.includes('not found')) return;
      throw error;
    }

    for (const item of items) {
      if (item.id === null) {
        // Folder
        await walk(`${path}/${item.name}`);
      } else {
        // File
        totalSize += (item.metadata?.size || 0);
        fileCount++;
      }
    }
  }

  try {
    await walk(userId);

    // Update storage_quotas table
    const { error: updateError } = await db
      .from('storage_quotas')
      .update({ storage_usage: totalSize })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return { used: totalSize, fileCount };
  } catch (err) {
    console.error(`[Storage] Recalculate failed for ${userId}:`, err);
    throw err;
  }
}

/**
 * Replaces an existing media file (overwrites).
 */
async function replaceMedia(oldPath, newFile, activityId) {
  if (oldPath) await deleteMedia(oldPath).catch(() => {});
  return await uploadMedia(newFile, activityId);
}


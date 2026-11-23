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

/* ── STORAGE ISOLATION & SANDBOX VAULT ── */
const CLOUD_IDB_PREFIX = 'kk_cloud_';
const SANDBOX_VAULT_DB = 'KlassKit_SandboxVault';
const SANDBOX_VAULT_STORE = 'vault';
const CLOUD_IDB_REGISTRY_KEY = 'kk_cloud_idb_registry';
const KNOWN_APP_IDB_NAMES = [
  'PosterStudioDB', 'PresentationDB', 'KlassKit_Resources', 'KlassKitRevealDB',
  'KlassKitMemoryDB_V3', 'KlassKitMemoryDB_V2', 'KKThisOrThatDB', 'SimonGameKlassKitDB_V2',
  'FlashcardDB', 'MysteryBoxDB', 'WordSearchDB', 'WordSortDB', 'CrosswordDB', 'HangmanDB',
  'BingoDB', 'KlassKitBingoDB', 'CardMakerDB', 'LessonExtractorDB_v3',
  'KlassKit_ImageWorkshop_DB', 'KlassKit_Editor_Images', 'klasskit_puzzle_db',
  'klasskit_dice_maker_db', 'klasskit_worksheet_db', 'PaperGrassDB',
  'klasskit-domino-maker', 'KlassKitReportsDB', 'klasskit_mediaplayer_db',
  'klasskit-whiteboard-optimized', 'TaskAssignerDB', 'KlassKitTracerDB',
  'ElimGridDB_v3', 'MysteryDeckDB_v3', 'ClassTallyDB', 'LessonNotesDB',
  'spell_sets_db', 'SecretCodeDB', 'ArcaneVTT_DB', 'UndercoverLibrary', 'WordAnimatorDB'
];

const _nativeIdbOpen = (typeof window !== 'undefined' && typeof IDBFactory !== 'undefined' && IDBFactory.prototype)
  ? (window.__kkNativeIdbOpen || IDBFactory.prototype.open)
  : null;
const _nativeIdbDelete = (typeof window !== 'undefined' && typeof IDBFactory !== 'undefined' && IDBFactory.prototype)
  ? (window.__kkNativeIdbDelete || IDBFactory.prototype.deleteDatabase)
  : null;

function shouldPrefixIdb(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name === SANDBOX_VAULT_DB || name.startsWith(CLOUD_IDB_PREFIX)) return false;
  try {
    return localStorage.getItem('kk_mode') !== 'sandbox';
  } catch (_) {
    return false;
  }
}

function recordCloudIdbName(prefixedName) {
  try {
    const raw = localStorage.getItem(CLOUD_IDB_REGISTRY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && !list.includes(prefixedName)) {
      list.push(prefixedName);
      localStorage.setItem(CLOUD_IDB_REGISTRY_KEY, JSON.stringify(list));
    }
  } catch (_) { /* ignore storage quota/serialization issues */ }
}

if (typeof window !== 'undefined' && _nativeIdbOpen && _nativeIdbDelete && !window.__kkIdbPatched) {
  window.__kkNativeIdbOpen = _nativeIdbOpen;
  window.__kkNativeIdbDelete = _nativeIdbDelete;
  window.__kkIdbPatched = true;

  IDBFactory.prototype.open = function (name, ...args) {
    let targetName = name;
    if (shouldPrefixIdb(name)) {
      targetName = CLOUD_IDB_PREFIX + name;
      recordCloudIdbName(targetName);
    }
    return args.length > 0
      ? _nativeIdbOpen.call(this, targetName, ...args)
      : _nativeIdbOpen.call(this, targetName);
  };

  IDBFactory.prototype.deleteDatabase = function (name, ...args) {
    const targetName = shouldPrefixIdb(name) ? (CLOUD_IDB_PREFIX + name) : name;
    return args.length > 0
      ? _nativeIdbDelete.call(this, targetName, ...args)
      : _nativeIdbDelete.call(this, targetName);
  };
}

const DEVICE_PREF_EXACT_KEYS = new Set([
  'theme', 'klasskit-theme', 'klasskit_theme', 'klasskit_colorTheme',
  'klasskit_reduceMotion', 'fcd_theme', 'quiz_block_theme', 'e1_dark',
  'soundMuted', 'timetools_muted', 'e1_mute', 'mb_audio',
  'dnd_sb_master_vol', 'dnd_sb_sfx_mute', 'multispin_isMuted'
]);

const SYSTEM_STORAGE_EXACT_KEYS = new Set([
  'kk_mode', 'kk_storage_owner', 'kk_current_user_id', 'kk_cloud_idb_registry',
  'after_login', 'klasskit_pending_display_name', 'migrated_to_cloud',
  'kk_schedule_migrated_to_cloud', 'kk_quota_warned_at'
]);

function isDevicePreferenceKey(key) {
  if (typeof key !== 'string') return false;
  if (DEVICE_PREF_EXACT_KEYS.has(key)) return true;
  return key.startsWith('theme_') || key.startsWith('sound_') || key.endsWith('_zoom');
}

function isSystemStorageKey(key) {
  if (typeof key !== 'string') return false;
  return SYSTEM_STORAGE_EXACT_KEYS.has(key) || key.startsWith('sb-');
}

function isAppDataKey(key) {
  return !isDevicePreferenceKey(key) && !isSystemStorageKey(key);
}

function hasSupabaseAuthTokens() {
  try {
    return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.includes('auth-token'));
  } catch (_) {
    return false;
  }
}

function extractAppLocalStorageEntries() {
  const entries = {};
  try {
    for (const key of Object.keys(localStorage)) {
      if (isAppDataKey(key)) {
        entries[key] = localStorage.getItem(key);
      }
    }
  } catch (_) { /* ignore */ }
  return entries;
}

function clearAppLocalStorageEntries() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (
        isAppDataKey(key) ||
        key === 'migrated_to_cloud' ||
        key === 'kk_schedule_migrated_to_cloud' ||
        key === 'kk_quota_warned_at' ||
        key === CLOUD_IDB_REGISTRY_KEY
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) { /* ignore */ }
}

function clearSupabaseAuthTokens() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) { /* ignore */ }
}

function _openSandboxVault() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !_nativeIdbOpen) {
      return reject(new Error('IndexedDB unavailable'));
    }
    try {
      const req = _nativeIdbOpen.call(indexedDB, SANDBOX_VAULT_DB, 1);
      req.onupgradeneeded = (e) => {
        const vaultDb = e.target.result;
        if (!vaultDb.objectStoreNames.contains(SANDBOX_VAULT_STORE)) {
          vaultDb.createObjectStore(SANDBOX_VAULT_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Vault open failed'));
    } catch (err) {
      reject(err);
    }
  });
}

async function saveSandboxVaultSnapshot(entries) {
  let vaultDb = null;
  try {
    vaultDb = await _openSandboxVault();
    await new Promise((resolve, reject) => {
      const tx = vaultDb.transaction(SANDBOX_VAULT_STORE, 'readwrite');
      tx.objectStore(SANDBOX_VAULT_STORE).put({
        entries: entries || {},
        savedAt: Date.now()
      }, 'snapshot');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Vault write failed'));
    });
  } catch (err) {
    console.warn('[SandboxVault] Failed to save snapshot:', err);
  } finally {
    try { if (vaultDb) vaultDb.close(); } catch (_) {}
  }
}

async function readSandboxVaultSnapshot() {
  let vaultDb = null;
  try {
    vaultDb = await _openSandboxVault();
    return await new Promise((resolve, reject) => {
      const tx = vaultDb.transaction(SANDBOX_VAULT_STORE, 'readonly');
      const req = tx.objectStore(SANDBOX_VAULT_STORE).get('snapshot');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Vault read failed'));
    });
  } catch (err) {
    console.warn('[SandboxVault] Failed to read snapshot:', err);
    return null;
  } finally {
    try { if (vaultDb) vaultDb.close(); } catch (_) {}
  }
}

async function restoreSandboxVaultSnapshot() {
  const snapshot = await readSandboxVaultSnapshot();
  if (!snapshot || !snapshot.entries || typeof snapshot.entries !== 'object') return;
  for (const [key, val] of Object.entries(snapshot.entries)) {
    if (isAppDataKey(key) && val !== null && val !== undefined) {
      try {
        localStorage.setItem(key, val);
      } catch (err) {
        console.warn('[SandboxVault] Failed to restore key:', key, err);
      }
    }
  }
}

async function getSandboxImportState() {
  let vaultDb = null;
  try {
    vaultDb = await _openSandboxVault();
    const state = await new Promise((resolve, reject) => {
      const tx = vaultDb.transaction(SANDBOX_VAULT_STORE, 'readonly');
      const req = tx.objectStore(SANDBOX_VAULT_STORE).get('importState');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Import state read failed'));
    });
    return state && typeof state === 'object' ? state : { handledUsers: {} };
  } catch (err) {
    console.warn('[SandboxVault] Failed to read importState:', err);
    return { handledUsers: {} };
  } finally {
    try { if (vaultDb) vaultDb.close(); } catch (_) {}
  }
}

async function setSandboxImportState(userId, status) {
  if (!userId) return;
  let vaultDb = null;
  try {
    const current = await getSandboxImportState();
    const handledUsers = { ...(current.handledUsers || {}) };
    handledUsers[userId] = { status, updatedAt: Date.now() };
    vaultDb = await _openSandboxVault();
    await new Promise((resolve, reject) => {
      const tx = vaultDb.transaction(SANDBOX_VAULT_STORE, 'readwrite');
      tx.objectStore(SANDBOX_VAULT_STORE).put({ handledUsers }, 'importState');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Import state write failed'));
    });
  } catch (err) {
    console.warn('[SandboxVault] Failed to save importState:', err);
  } finally {
    try { if (vaultDb) vaultDb.close(); } catch (_) {}
  }
}

async function clearCloudIndexedDBs() {
  if (typeof indexedDB === 'undefined' || !_nativeIdbDelete) return;

  const targets = new Set(KNOWN_APP_IDB_NAMES.map(name => CLOUD_IDB_PREFIX + name));

  try {
    const raw = localStorage.getItem(CLOUD_IDB_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const name of parsed) {
          if (typeof name === 'string' && name.startsWith(CLOUD_IDB_PREFIX)) {
            targets.add(name);
          }
        }
      }
    }
  } catch (_) { /* ignore malformed registry */ }

  if (typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      for (const dbInfo of dbs || []) {
        if (dbInfo && typeof dbInfo.name === 'string' && dbInfo.name.startsWith(CLOUD_IDB_PREFIX)) {
          targets.add(dbInfo.name);
        }
      }
    } catch (_) { /* ignore browsers without full databases() support */ }
  }

  await Promise.all(Array.from(targets).map(dbName => new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 1500);
    try {
      const req = _nativeIdbDelete.call(indexedDB, dbName);
      req.onsuccess = finish;
      req.onerror = finish;
      req.onblocked = () => {
        // Wait briefly for closing iframes to release locks; timer bounds the wait.
      };
    } catch (_) {
      finish();
    }
  })));
}

async function teardownOpenAppIframes() {
  try {
    if (window.HubStorage && typeof window.HubStorage.cancelPendingCloudSave === 'function') {
      window.HubStorage.cancelPendingCloudSave();
    }
  } catch (_) {}

  try {
    if (window.TabManager && typeof window.TabManager.teardownAllIframes === 'function') {
      window.TabManager.teardownAllIframes();
    }
  } catch (_) {}

  try {
    const tabArea = document.getElementById('tab-content-area');
    if (tabArea) {
      tabArea.querySelectorAll('iframe').forEach((iframe) => {
        try { iframe.src = 'about:blank'; } catch (_) {}
        try { iframe.remove(); } catch (_) {}
      });
    }
  } catch (_) {}

  await new Promise(resolve => setTimeout(resolve, 60));
}

let _prepareCloudPromise = null;
let _prepareCloudUserId = null;

async function prepareCloudSession(user) {
  if (!user || !user.id || user.is_sandbox) return;

  if (_prepareCloudPromise && _prepareCloudUserId === user.id) {
    return _prepareCloudPromise;
  }

  _prepareCloudUserId = user.id;
  _prepareCloudPromise = (async () => {
    const owner = localStorage.getItem('kk_storage_owner');
    const legacyUserId = localStorage.getItem('kk_current_user_id');

    if (owner === `cloud:${user.id}`) {
      localStorage.setItem('kk_mode', 'cloud');
      localStorage.setItem('kk_current_user_id', user.id);
      return;
    }

    const isOwnedBySandbox = owner === 'sandbox' || (!owner && !legacyUserId);
    const isSameLegacyCloudUser = !owner && legacyUserId === user.id;

    if (isOwnedBySandbox) {
      const entries = extractAppLocalStorageEntries();
      if (owner === 'sandbox' || Object.keys(entries).length > 0) {
        await saveSandboxVaultSnapshot(entries);
      }
      clearAppLocalStorageEntries();
      await clearCloudIndexedDBs();
    } else if (!isSameLegacyCloudUser) {
      // Live localStorage belonged to a different cloud account; wipe without touching SandboxVault.
      clearAppLocalStorageEntries();
      await clearCloudIndexedDBs();
    }

    localStorage.setItem('kk_mode', 'cloud');
    localStorage.setItem('kk_storage_owner', `cloud:${user.id}`);
    localStorage.setItem('kk_current_user_id', user.id);
  })();

  try {
    await _prepareCloudPromise;
  } finally {
    _prepareCloudPromise = null;
    _prepareCloudUserId = null;
  }
}

let _teardownCloudPromise = null;

async function teardownCloudSession({ redirectUrl = null, skipAuthSignOut = false } = {}) {
  if (_teardownCloudPromise) {
    await _teardownCloudPromise;
    if (redirectUrl) {
      localStorage.removeItem('kk_mode');
      location.href = redirectUrl;
    }
    return;
  }

  _teardownCloudPromise = (async () => {
    await teardownOpenAppIframes();

    if (!skipAuthSignOut) {
      try {
        await db.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.warn('[Auth] Local signOut error:', err);
      }
      clearSupabaseAuthTokens();
    }

    clearAppLocalStorageEntries();
    _resetProfileCache();
    _clearSignedUrlCache();
    localStorage.removeItem('kk_current_user_id');
    localStorage.removeItem('kk_storage_owner');
    localStorage.removeItem('migrated_to_cloud');
    localStorage.removeItem('kk_schedule_migrated_to_cloud');
    localStorage.removeItem(CLOUD_IDB_REGISTRY_KEY);

    await clearCloudIndexedDBs();
    await restoreSandboxVaultSnapshot();
    localStorage.setItem('kk_storage_owner', 'sandbox');

    if (redirectUrl) {
      localStorage.removeItem('kk_mode');
      location.href = redirectUrl;
    }
  })();

  try {
    await _teardownCloudPromise;
  } finally {
    _teardownCloudPromise = null;
  }
}

async function exitSandboxMode(redirectUrl = '/index.html') {
  await saveSandboxVaultSnapshot(extractAppLocalStorageEntries());
  localStorage.setItem('kk_storage_owner', 'sandbox');
  localStorage.removeItem('kk_mode');
  if (redirectUrl) {
    location.href = redirectUrl;
  }
}

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

async function getCloudUser() {
  if (isSandbox()) return null;
  const user = await getUser();
  return (user && !user.is_sandbox) ? user : null;
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
let _profileCache = { userId: null, data: null, fetchedAt: 0 };
let _profileInFlight = { userId: null, promise: null };

function _resetProfileCache() {
  _profileCache = { userId: null, data: null, fetchedAt: 0 };
  _profileInFlight = { userId: null, promise: null };
}

async function getUserProfile(forceRefresh = false) {
  const user = await getUser();
  if (!user) {
    _resetProfileCache();
    return null;
  }
  if (user.is_sandbox) return { role: 'teacher', display_name: 'Guest Teacher' };

  const now = Date.now();
  if (
    !forceRefresh &&
    _profileCache.userId === user.id &&
    _profileCache.data &&
    (now - _profileCache.fetchedAt) < PROFILE_CACHE_TTL_MS
  ) {
    return _profileCache.data;
  }

  if (!forceRefresh && _profileInFlight.userId === user.id && _profileInFlight.promise) {
    return await _profileInFlight.promise;
  }

  const fetchPromise = (async () => {
    const { data: profile, error } = await db
      .from('profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Profile] Fetch error:', error);
      return null;
    }

    if (profile) {
      _profileCache = { userId: user.id, data: profile, fetchedAt: Date.now() };
    }
    return profile;
  })();

  _profileInFlight = { userId: user.id, promise: fetchPromise };
  try {
    return await fetchPromise;
  } finally {
    if (_profileInFlight.promise === fetchPromise) {
      _profileInFlight = { userId: null, promise: null };
    }
  }
}

async function ensureSandboxStorageClean() {
  const owner = localStorage.getItem('kk_storage_owner');
  if (
    (owner && owner.startsWith('cloud:')) ||
    localStorage.getItem('kk_current_user_id') ||
    hasSupabaseAuthTokens()
  ) {
    console.warn('[Auth] Cloud session or cache detected in Sandbox mode. Cleaning up and restoring Sandbox...');
    await teardownCloudSession({ redirectUrl: null });
    localStorage.setItem('kk_mode', 'sandbox');
    localStorage.setItem('kk_storage_owner', 'sandbox');
  } else if (!owner) {
    localStorage.setItem('kk_storage_owner', 'sandbox');
  }
}

async function requireAuth() {
  if (isSandbox()) {
    await ensureSandboxStorageClean();
    console.log("[Auth] Sandbox Mode Active. Bypassing Auth.");
    return { id: 'sandbox_user', is_sandbox: true };
  }
  const user = await getUser()
  if (!user) {
    const owner = localStorage.getItem('kk_storage_owner');
    if ((owner && owner.startsWith('cloud:')) || localStorage.getItem('kk_current_user_id')) {
      console.warn('[Auth] Session expired with cached cloud data. Cleaning up cloud cache...');
      await teardownCloudSession({ redirectUrl: null, skipAuthSignOut: true });
    }
    const target = (window !== window.top) ? window.top : window
    target.localStorage.setItem('after_login', target.location.href)
    target.location.href = '/login.html'
    return new Promise(() => { })
  }

  await prepareCloudSession(user)

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
    const owner = localStorage.getItem('kk_storage_owner');
    if ((owner && owner.startsWith('cloud:')) || localStorage.getItem('kk_current_user_id')) {
      await teardownCloudSession({ redirectUrl: null, skipAuthSignOut: true });
    }
    location.href = '/login.html'
    return new Promise(() => { })
  }

  await prepareCloudSession(user)

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
    await ensureSandboxStorageClean();
    return { id: 'sandbox_user', is_sandbox: true };
  }
  const user = await getUser()
  if (!user) {
    const owner = localStorage.getItem('kk_storage_owner');
    if ((owner && owner.startsWith('cloud:')) || localStorage.getItem('kk_current_user_id')) {
      await teardownCloudSession({ redirectUrl: null, skipAuthSignOut: true });
    }
    location.href = '/login.html'
    return new Promise(() => { })
  }

  await prepareCloudSession(user)

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
  if (isSandbox()) {
    await exitSandboxMode('/index.html');
    return;
  }
  await teardownCloudSession({ redirectUrl: '/index.html' });
}

async function switchMode() {
  if (isSandbox()) {
    await exitSandboxMode('/index.html');
    return;
  }
  if (typeof showConfirmModal === 'function') {
    const confirmed = await showConfirmModal(
      'Switching mode will sign you out and clear cached cloud data from this browser. Your data stays safe in the cloud.',
      {
        title: 'Switch Mode?',
        confirmText: 'Sign Out & Switch',
        cancelText: 'Cancel',
        icon: 'log-out',
        iconColor: 'orange'
      }
    );
    if (!confirmed) return;
  }
  await teardownCloudSession({ redirectUrl: '/index.html' });
}

function clearLocalCache() {
  console.log('[Auth] Clearing local cache...');
  clearAppLocalStorageEntries();
  localStorage.removeItem('kk_current_user_id');
  localStorage.removeItem('kk_storage_owner');
}

function isValidUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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
  if (data === null || data === undefined) {
    if (isSandbox()) {
      localStorage.removeItem(`prog_${toolKey}`)
      return
    }
    if (toolKey === 'my-class') {
      localStorage.removeItem(`prog_${toolKey}`)
      return
    }
    const user = await getUser()
    if (!user) {
      localStorage.removeItem(`prog_${toolKey}`)
      return
    }
    const { error } = await db.from('user_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('tool_key', toolKey)
    if (error) {
      console.error(`[SaveProgress] Failed to delete ${toolKey}:`, error)
      return
    }
    localStorage.removeItem(`prog_${toolKey}`)
    return
  }

  localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data))

  if (isSandbox()) return;
  
  // My Class is handled by its own dedicated table (myspace_my_class)
  if (toolKey === 'my-class') return;

  const user = await getUser()
  if (!user) return

  const sanitizedData = sanitizeCloudPayload(data)

  const { error } = await db.from('user_progress').upsert(
    {
      user_id: user.id,
      tool_key: toolKey,
      data: sanitizedData,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,tool_key' }
  )
  if (error) {
    console.error(`[SaveProgress] Failed to save ${toolKey}:`, error)
  }
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

/* ── D&D TOOL HELPERS (tools_dnd table) ── */
async function saveDndSave(toolType, name, stateData, id = null) {
  const localId = id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (isSandbox()) {
    localStorage.setItem(`dnd_${toolType}_${localId}`, JSON.stringify({ id: localId, name, state_data: stateData, tool_type: toolType }));
    return { id: localId, success: true };
  }

  const user = await getUser();
  if (!user) {
    localStorage.setItem(`dnd_${toolType}_${localId}`, JSON.stringify({ id: localId, name, state_data: stateData, tool_type: toolType }));
    return { id: localId, success: true };
  }

  const sanitizedData = sanitizeCloudPayload(stateData);

  if (id && isValidUuid(id)) {
    const { data, error } = await db.from('tools_dnd')
      .update({ name, state_data: sanitizedData, last_used: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) {
      console.error('[SaveDnd] Update failed:', error);
      return { error };
    }
    return { id: data.id, success: true };
  } else {
    const { data, error } = await db.from('tools_dnd')
      .insert({ user_id: user.id, tool_type: toolType, name, state_data: sanitizedData })
      .select()
      .single();
    if (error) {
      console.error('[SaveDnd] Insert failed:', error);
      return { error };
    }
    return { id: data.id, success: true };
  }
}

async function loadDndSaves(toolType) {
  const loadLocal = () => {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`dnd_${toolType}_`)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item) saves.push(item);
        } catch (_) { /* ignore malformed entries */ }
      }
    }
    return saves;
  };

  if (isSandbox()) return loadLocal();

  const user = await getUser();
  if (user) {
    const { data, error } = await db.from('tools_dnd')
      .select('id, name, state_data, created_at, last_used')
      .eq('user_id', user.id)
      .eq('tool_type', toolType)
      .order('last_used', { ascending: false });

    if (error) {
      console.error('[LoadDnd] Error:', error);
      return [];
    }
    return data || [];
  }

  return loadLocal();
}

async function deleteDndSave(id) {
  if (isSandbox()) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dnd_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.id === id) localStorage.removeItem(key);
        } catch (_) {}
      }
    }
    return { success: true };
  }

  const user = await getUser();
  if (!user) return { success: false, error: 'No user' };

  const { error } = await db.from('tools_dnd')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[DeleteDnd] Error:', error);
    return { error };
  }
  return { success: true };
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

  if (_profileCache.userId === user.id && _profileCache.data) {
    _profileCache.data = { ..._profileCache.data, display_name: displayName };
  }

  return { success: true }
}

async function migrateLocalToCloud() {
  /* deprecated: handled by checkAndOfferSandboxImport */
}

function _isNonEmptySandboxJson(raw, extraEmptyValues = []) {
  if (raw === null || raw === undefined) return false;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[]' || trimmed === '{}') {
    return false;
  }
  if (extraEmptyValues.includes(trimmed)) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === 'object') {
      if (parsed.classes && typeof parsed.classes === 'object' && Object.keys(parsed).length === 1) {
        return Object.keys(parsed.classes).length > 0;
      }
      return Object.keys(parsed).length > 0;
    }
    return Boolean(parsed);
  } catch (_) {
    return true;
  }
}

function hasMigratableSandboxData(entries) {
  if (!entries || typeof entries !== 'object') return false;

  for (const [key, raw] of Object.entries(entries)) {
    if (key.startsWith('prog_') && key !== 'prog_my-class') {
      if (_isNonEmptySandboxJson(raw)) return true;
    }
  }

  if (_isNonEmptySandboxJson(entries.pinnedGameIds)) return true;
  if (_isNonEmptySandboxJson(entries.favoriteGames)) return true;

  return false;
}

async function isCloudAccountEmpty(userId) {
  if (!userId) return false;
  try {
    const checks = await Promise.all([
      db.from('user_progress').select('id').eq('user_id', userId).neq('tool_key', 'klasskit_hub').limit(1),
      db.from('notes').select('id').eq('user_id', userId).limit(1),
      db.from('myspace_events').select('id').eq('user_id', userId).limit(1),
      db.from('myspace_tasks').select('id').eq('user_id', userId).limit(1),
      db.from('myspace_my_class').select('id').eq('user_id', userId).limit(1),
      db.from('myspace_clock').select('id').eq('user_id', userId).limit(1),
      db.from('tools_cardmaker').select('id').eq('user_id', userId).limit(1),
      db.from('tools_puzzlemaker').select('id').eq('user_id', userId).limit(1),
      db.from('tools_worksheetmaker').select('id').eq('user_id', userId).limit(1),
      db.from('tools_dnd').select('id').eq('user_id', userId).limit(1),
      db.from('vtt_maps').select('id').eq('user_id', userId).limit(1),
      db.from('vtt_campaigns').select('id').eq('user_id', userId).limit(1),
      db.from('workshop_lessonparser').select('id').eq('user_id', userId).limit(1),
      db.from('spreadsheets').select('id').eq('user_id', userId).limit(1)
    ]);

    for (const res of checks) {
      if (res.error) {
        console.warn('[SandboxImport] Cloud emptiness check failed:', res.error);
        return false;
      }
      if (Array.isArray(res.data) && res.data.length > 0) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('[SandboxImport] Cloud emptiness check error:', err);
    return false;
  }
}

async function importSandboxVaultToCloud(user) {
  if (!user || !user.id || user.is_sandbox) return false;
  const snapshot = await readSandboxVaultSnapshot();
  if (!snapshot || !snapshot.entries) return false;

  const entries = snapshot.entries;

  for (const [key, raw] of Object.entries(entries)) {
    if (key.startsWith('prog_') && key !== 'prog_my-class' && raw !== null && raw !== undefined) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed !== null && parsed !== undefined) {
          const toolKey = key.slice('prog_'.length);
          await saveProgress(toolKey, parsed);
        }
      } catch (err) {
        console.warn('[SandboxImport] Failed to import progress key:', key, err);
      }
    }
  }

  const hubImportKeys = [
    'pinnedGameIds',
    'favoriteGames',
    'recentGameIds',
    'openTabs',
    'tabGroups',
    'klasskit_viewMode',
    'klasskit_librarySort',
    'klasskit_defaultHome',
    'klasskit_showRecent',
    'klasskit_autoExpandGroup'
  ];
  const hubState = {};
  for (const key of hubImportKeys) {
    const raw = entries[key];
    if (raw !== null && raw !== undefined) {
      try {
        localStorage.setItem(key, raw);
      } catch (_) {}
      try {
        hubState[key] = JSON.parse(raw);
      } catch (_) {
        hubState[key] = raw;
      }
    }
  }

  if (Object.keys(hubState).length > 0) {
    await saveProgress('klasskit_hub', hubState);
  }

  await setSandboxImportState(user.id, 'imported');
  return true;
}

async function checkAndOfferSandboxImport() {
  if (isSandbox()) return false;
  const user = await getUser();
  if (!user || user.is_sandbox) return false;

  const importState = await getSandboxImportState();
  if (importState?.handledUsers?.[user.id]) return false;

  const snapshot = await readSandboxVaultSnapshot();
  if (!snapshot || !snapshot.entries || !hasMigratableSandboxData(snapshot.entries)) {
    return false;
  }

  const empty = await isCloudAccountEmpty(user.id);
  if (!empty) return false;

  if (typeof showConfirmModal !== 'function') return false;

  const confirmed = await showConfirmModal(
    'Your Cloud account is empty, and you have saved Sandbox data on this device. Would you like to copy it to your Cloud account? Your local Sandbox copy will stay safe.',
    {
      title: 'Import Sandbox Data?',
      confirmText: 'Import to Cloud',
      cancelText: 'Start Fresh',
      icon: 'cloud-upload',
      iconColor: 'blue'
    }
  );

  if (confirmed) {
    return await importSandboxVaultToCloud(user);
  } else {
    await setSandboxImportState(user.id, 'dismissed');
    return false;
  }
}

/* ── STORAGE HELPERS ── */
const STORAGE_CONFIG = {
  bucket: 'klasskit-media',
  defaultLimit: 10 * 1024 * 1024, // 10MB (matches public.storage_quotas default)
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
        const limit = STORAGE_CONFIG.defaultLimit; // Use fixed 10MB for sandbox UI consistency
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
 * Quota accounting in public.storage_quotas is maintained atomically by DB triggers.
 */
async function uploadMedia(file, toolId, setId = null) {
  if (isSandbox()) throw new Error('Storage not available in Sandbox.');

  const user = await getUser();
  if (!user || user.is_sandbox) throw new Error('Not authenticated');

  // 1. Compress
  const compressedFile = await compressImage(file);
  const fileSize = compressedFile.size;

  // 2. Check quota
  const usage = await getUserStorageUsage();
  if (usage.used + fileSize > usage.limit) {
    throw new Error('Storage quota exceeded');
  }

  const filename = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const subPath = setId ? `${toolId}/${setId}` : toolId;
  const dirPath = `${user.id}/${subPath}`;
  const filePath = `${dirPath}/${filename}.webp`;

  // 3. Upload
  const { error: uploadError } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .upload(filePath, compressedFile, {
      contentType: 'image/webp',
      upsert: true
    });

  if (uploadError) {
    if (uploadError.message?.toLowerCase().includes('storage quota exceeded')) {
      throw new Error('Storage quota exceeded');
    }
    throw uploadError;
  }

  // 4. Return Signed URL (Bucket is private)
  const { data, error: signError } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SEC);

  if (signError) throw signError;
  if (data?.signedUrl) {
    _cacheSignedUrl(filePath, data.signedUrl);
  }
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

const SIGNED_URL_TTL_SEC = 3600;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;
const _signedUrlCache = new Map();
let _pendingSignQueue = [];
let _pendingSignTimer = null;

function _extractStoragePath(url) {
  if (!url || typeof url !== 'string' || !url.includes(STORAGE_CONFIG.bucket)) return null;
  const parts = url.split(STORAGE_CONFIG.bucket + '/');
  if (parts.length < 2 || !parts[1]) return null;
  const rawPath = parts[1].split('?')[0];
  try {
    return decodeURIComponent(rawPath);
  } catch (_) {
    return rawPath;
  }
}

function _cacheSignedUrl(filePath, signedUrl) {
  if (!filePath || !signedUrl) return;
  _signedUrlCache.set(filePath, {
    signedUrl,
    expiresAt: Date.now() + SIGNED_URL_CACHE_MS
  });
}

function _getCachedSignedUrl(filePath) {
  const entry = _signedUrlCache.get(filePath);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    _signedUrlCache.delete(filePath);
    return null;
  }
  return entry.signedUrl;
}

function _invalidateSignedUrlCache(pathOrPrefix) {
  if (!pathOrPrefix) return;
  if (pathOrPrefix.endsWith('/')) {
    for (const key of _signedUrlCache.keys()) {
      if (key.startsWith(pathOrPrefix)) {
        _signedUrlCache.delete(key);
      }
    }
  } else {
    _signedUrlCache.delete(pathOrPrefix);
  }
}

function _clearSignedUrlCache() {
  _signedUrlCache.clear();
}

async function _signStoragePathsBatch(paths) {
  const resolvedMap = new Map();
  const missing = [];
  const seen = new Set();

  for (const filePath of paths) {
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    const cached = _getCachedSignedUrl(filePath);
    if (cached) {
      resolvedMap.set(filePath, cached);
    } else {
      missing.push(filePath);
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const chunk = missing.slice(i, i + CHUNK_SIZE);
    try {
      const { data, error } = await db.storage
        .from(STORAGE_CONFIG.bucket)
        .createSignedUrls(chunk, SIGNED_URL_TTL_SEC);

      if (error) {
        console.error('[Storage] Batch URL resolution failed:', error);
        continue;
      }

      if (Array.isArray(data)) {
        data.forEach((item, idx) => {
          const itemPath = item?.path || chunk[idx];
          if (item && !item.error && item.signedUrl && itemPath) {
            _cacheSignedUrl(itemPath, item.signedUrl);
            resolvedMap.set(itemPath, item.signedUrl);
          }
        });
      }
    } catch (e) {
      console.error('[Storage] Batch URL resolution error:', e);
    }
  }

  return resolvedMap;
}

async function _flushSignedUrlQueue() {
  _pendingSignTimer = null;
  const queue = _pendingSignQueue;
  _pendingSignQueue = [];
  if (queue.length === 0) return;

  const uniquePaths = Array.from(new Set(queue.map(item => item.filePath)));
  const resolvedMap = await _signStoragePathsBatch(uniquePaths);

  for (const item of queue) {
    item.resolve(resolvedMap.get(item.filePath) || item.url);
  }
}

/**
 * Resolves an array of media URLs in batched createSignedUrls calls (cached for 50 min).
 */
async function resolveMediaUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const paths = [];
  const extracted = urls.map(url => {
    const filePath = _extractStoragePath(url);
    if (filePath) paths.push(filePath);
    return { url, filePath };
  });

  if (paths.length === 0) return urls.slice();

  const resolvedMap = await _signStoragePathsBatch(paths);
  return extracted.map(({ url, filePath }) => {
    if (!filePath) return url;
    return resolvedMap.get(filePath) || url;
  });
}

/**
 * Resolves a stored media URL to a signed URL if it belongs to our private bucket.
 * Coalesces same-tick concurrent calls into batched createSignedUrls requests and caches results.
 */
async function resolveMediaUrl(url) {
  const filePath = _extractStoragePath(url);
  if (!filePath) return url;

  const cached = _getCachedSignedUrl(filePath);
  if (cached) return cached;

  return new Promise(resolve => {
    _pendingSignQueue.push({ filePath, url, resolve });
    if (!_pendingSignTimer) {
      _pendingSignTimer = setTimeout(_flushSignedUrlQueue, 0);
    }
  });
}

/**
 * Deletes a media file; DB trigger sync_storage_on_delete() updates storage_quotas atomically.
 * (see supabase/sql/phase1_scale_hygiene.sql if you get a schema mismatch 400).
 */
async function deleteMedia(filePath) {
  if (isSandbox()) return;

  const user = await getUser();
  if (!user || user.is_sandbox) return;

  const { error } = await db.storage.from(STORAGE_CONFIG.bucket).remove([filePath]);
  if (error) {
    if (error.message?.includes('sync_storage_on_delete') || error.message?.includes('schema mismatch')) {
      const fix = new Error(
        'Storage delete blocked by an outdated database trigger. Run supabase/sql/phase1_scale_hygiene.sql in the Supabase SQL Editor.'
      );
      fix.cause = error;
      throw fix;
    }
    throw error;
  }

  _invalidateSignedUrlCache(filePath);
  return { success: true };
}

/**
 * Helper to delete media file from its Supabase URL.
 */
async function deleteMediaFromUrl(url) {
  const path = _extractStoragePath(url);
  if (!path) return;
  try {
    await deleteMedia(path);
  } catch (e) {
    console.warn('[Storage] URL-based deletion failed:', e);
  }
}

/**
 * Deletes all files inside a storage folder; DB triggers update storage_quotas atomically.
 */
async function deleteFolder(folderPath) {
  if (isSandbox()) return;
  const user = await getUser();
  if (!user || user.is_sandbox) return;

  try {
    // 1. List files in folder
    const { data: items, error: listError } = await db.storage
      .from(STORAGE_CONFIG.bucket)
      .list(folderPath, { limit: 1000 });

    if (listError || !items || items.length === 0) return;

    const files = items.filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder');
    if (files.length === 0) return;

    // 2. Remove in chunks of 100
    const totalSize = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
    const filePaths = files.map(f => `${folderPath}/${f.name}`);

    const CHUNK_SIZE = 100;
    for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
      const chunk = filePaths.slice(i, i + CHUNK_SIZE);
      const { error: delError } = await db.storage
        .from(STORAGE_CONFIG.bucket)
        .remove(chunk);
      if (delError) throw delError;
    }

    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    _invalidateSignedUrlCache(prefix);
    return { success: true, freed: totalSize };
  } catch (e) {
    console.error('[Storage] Folder deletion failed:', e);
    throw e;
  }
}

/**
 * Lists all cloud media files for the signed-in user via single indexed SQL RPC.
 * Returns null if the RPC hasn't been deployed yet so callers can fall back cleanly.
 */
async function listUserMediaFiles() {
  if (isSandbox()) return [];
  const user = await getCloudUser();
  if (!user) return [];

  const { data, error } = await db.rpc('user_list_my_media');
  if (error) {
    if (
      error.code === '42883' ||
      error.code === 'PGRST202' ||
      error.message?.includes('user_list_my_media')
    ) {
      return null;
    }
    throw error;
  }

  return (data || []).map(row => ({
    name: row.file_name,
    fullPath: row.full_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
    metadata: { size: Number(row.size_bytes) || 0 }
  }));
}

/**
 * Resolves raw bucket object paths to signed URLs using chunked batches and 50-min cache.
 */
async function signStoragePaths(filePaths) {
  if (isSandbox() || !Array.isArray(filePaths) || filePaths.length === 0) return {};
  const resolvedMap = await _signStoragePathsBatch(filePaths);
  return Object.fromEntries(resolvedMap);
}

/**
 * Reconciles total storage usage for the current user (or target user for admins)
 * directly on Postgres via RPC, avoiding recursive storage.list() browser walks.
 */
async function recalculateUserStorage(userId) {
  if (isSandbox()) return { used: 0, limit: STORAGE_CONFIG.defaultLimit, fileCount: 0 };

  const currentUser = await getCloudUser();
  if (!currentUser) return { used: 0, limit: STORAGE_CONFIG.defaultLimit, fileCount: 0 };

  try {
    const isTargetingOtherUser = Boolean(userId && userId !== currentUser.id);
    const { data, error } = isTargetingOtherUser
      ? await db.rpc('admin_reconcile_storage_quotas', { p_user_id: userId })
      : await db.rpc('user_reconcile_my_storage');

    if (error) throw error;

    return {
      used: Number(data?.used ?? data?.storage_usage) || 0,
      limit: Number(data?.limit) || STORAGE_CONFIG.defaultLimit,
      fileCount: Number(data?.file_count) || 0
    };
  } catch (err) {
    console.error(`[Storage] Recalculate failed for ${userId || currentUser.id}:`, err);
    throw err;
  }
}

/**
 * Deletes all cloud media files for a user; DB triggers update storage_quotas atomically.
 */
async function clearUserStorage(userId) {
  if (isSandbox()) return { deletedCount: 0 };

  const filePaths = [];

  async function walk(path) {
    const { data: items, error } = await db.storage.from(STORAGE_CONFIG.bucket).list(path, { limit: 1000 });
    if (error) {
      if (error.message?.includes('not found')) return;
      throw error;
    }

    for (const item of items || []) {
      if (item.id === null) {
        await walk(`${path}/${item.name}`);
      } else {
        filePaths.push(`${path}/${item.name}`);
      }
    }
  }

  try {
    await walk(userId);

    if (filePaths.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
        const chunk = filePaths.slice(i, i + CHUNK_SIZE);
        const { error: removeError } = await db.storage
          .from(STORAGE_CONFIG.bucket)
          .remove(chunk);
        if (removeError) throw removeError;
      }
    }

    _invalidateSignedUrlCache(`${userId}/`);
    return { deletedCount: filePaths.length };
  } catch (err) {
    console.error(`[Storage] Clear storage failed for ${userId}:`, err);
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

/* ── VTT HELPERS (vtt_maps, vtt_walls, vtt_tokens, vtt_token_library, vtt_campaigns) ── */

// ── Campaigns ──────────────────────────────────────────────────────────────

async function vttLoadCampaigns() {
  if (isSandbox()) {
    const raw = localStorage.getItem('vtt_campaigns');
    return raw ? JSON.parse(raw) : [];
  }
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await db.from('vtt_campaigns')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) { console.error('[VTT] loadCampaigns:', error); return []; }
  return data || [];
}

async function vttSaveCampaign(campaign) {
  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_campaigns') || '[]');
    const idx = all.findIndex(c => c.id === campaign.id);
    if (idx >= 0) all[idx] = campaign; else all.push(campaign);
    localStorage.setItem('vtt_campaigns', JSON.stringify(all));
    return { id: campaign.id, success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  if (campaign.id && isValidUuid(campaign.id)) {
    const { error } = await db.from('vtt_campaigns')
      .update({ name: campaign.name })
      .eq('id', campaign.id).eq('user_id', user.id);
    if (error) { console.error('[VTT] saveCampaign update:', error); return { error }; }
    return { id: campaign.id, success: true };
  }
  const { data, error } = await db.from('vtt_campaigns')
    .insert({ user_id: user.id, name: campaign.name })
    .select('id').single();
  if (error) { console.error('[VTT] saveCampaign insert:', error); return { error }; }
  return { id: data.id, success: true };
}

async function vttDeleteCampaign(id) {
  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_campaigns') || '[]');
    localStorage.setItem('vtt_campaigns', JSON.stringify(all.filter(c => c.id !== id)));
    return { success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await db.from('vtt_campaigns').delete().eq('id', id).eq('user_id', user.id);
  if (error) { console.error('[VTT] deleteCampaign:', error); return { error }; }
  return { success: true };
}

// ── Maps ───────────────────────────────────────────────────────────────────

async function vttLoadMaps(campaignId = null) {
  if (isSandbox()) {
    const raw = localStorage.getItem('vtt_maps');
    const all = raw ? JSON.parse(raw) : [];
    return campaignId ? all.filter(m => m.campaign_id === campaignId) : all;
  }
  const user = await getUser();
  if (!user) return [];
  let query = db.from('vtt_maps')
    .select('id, name, campaign_id, grid_cols, grid_rows, grid_size, grid_metres_per_square, is_grid_visible, los_enabled, los_dark_map, los_view_distance, image_url, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (campaignId) query = query.eq('campaign_id', campaignId);
  const { data, error } = await query;
  if (error) { console.error('[VTT] loadMaps:', error); return []; }
  return data || [];
}

async function vttSaveMap(map) {
  const { id, name, campaign_id, grid_cols, grid_rows, grid_size, grid_metres_per_square,
    is_grid_visible, los_enabled, los_dark_map, los_view_distance, image_url, image_path } = map;

  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_maps') || '[]');
    const idx = all.findIndex(m => m.id === id);
    const entry = { ...map };
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    localStorage.setItem('vtt_maps', JSON.stringify(all));
    return { id, success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const payload = { name, campaign_id: campaign_id || null, grid_cols, grid_rows, grid_size,
    grid_metres_per_square, is_grid_visible, los_enabled, los_dark_map, los_view_distance,
    image_url, image_path };

  if (id && isValidUuid(id)) {
    const { error } = await db.from('vtt_maps').update(payload).eq('id', id).eq('user_id', user.id);
    if (error) { console.error('[VTT] saveMap update:', error); return { error }; }
    return { id, success: true };
  }
  const { data, error } = await db.from('vtt_maps')
    .insert({ user_id: user.id, ...payload }).select('id').single();
  if (error) { console.error('[VTT] saveMap insert:', error); return { error }; }
  return { id: data.id, success: true };
}

async function vttDeleteMap(id) {
  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_maps') || '[]');
    localStorage.setItem('vtt_maps', JSON.stringify(all.filter(m => m.id !== id)));
    return { success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await db.from('vtt_maps').delete().eq('id', id).eq('user_id', user.id);
  if (error) { console.error('[VTT] deleteMap:', error); return { error }; }
  return { success: true };
}

// ── Walls ──────────────────────────────────────────────────────────────────
// One row per map in vtt_wall_data; segments stored as a JSONB array.

async function vttLoadWalls(mapId) {
  if (isSandbox()) {
    const raw = localStorage.getItem(`vtt_wall_data_${mapId}`);
    return raw ? JSON.parse(raw) : { walls: [], openings: [] };
  }
  const user = await getUser();
  if (!user) return { walls: [], openings: [] };
  const { data, error } = await db.from('vtt_wall_data')
    .select('segments')
    .eq('map_id', mapId).eq('user_id', user.id)
    .maybeSingle();
  if (error) { console.error('[VTT] loadWalls:', error); return { walls: [], openings: [] }; }
  return data?.segments || { walls: [], openings: [] };
}

function _roundCoords(w) {
  return {
    ...w,
    x1: Math.round(w.x1 * 100) / 100,
    y1: Math.round(w.y1 * 100) / 100,
    x2: Math.round(w.x2 * 100) / 100,
    y2: Math.round(w.y2 * 100) / 100,
  };
}

async function vttSaveWalls(mapId, payload) {
  const segments = {
    walls:    (payload.walls    || []).map(_roundCoords),
    openings: (payload.openings || []).map(_roundCoords),
  };
  if (isSandbox()) {
    localStorage.setItem(`vtt_wall_data_${mapId}`, JSON.stringify(segments));
    return { success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await db.from('vtt_wall_data')
    .upsert({ map_id: mapId, user_id: user.id, segments }, { onConflict: 'map_id' });
  if (error) { console.error('[VTT] saveWalls:', error); return { error }; }
  return { success: true };
}

// ── Tokens (placed on map) ─────────────────────────────────────────────────

async function vttLoadTokens(mapId) {
  if (isSandbox()) {
    const raw = localStorage.getItem(`vtt_tokens_${mapId}`);
    return raw ? JSON.parse(raw) : [];
  }
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await db.from('vtt_tokens')
    .select('id, name, image_url, x, y, size, is_pc')
    .eq('map_id', mapId).eq('user_id', user.id);
  if (error) { console.error('[VTT] loadTokens:', error); return []; }
  return data || [];
}

function _generateUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

async function vttSaveTokens(mapId, tokens) {
  if (isSandbox()) {
    localStorage.setItem(`vtt_tokens_${mapId}`, JSON.stringify(tokens));
    return { success: true };
  }
  const user = await getUser();
  if (!user || user.is_sandbox) return { error: 'Not authenticated' };

  if (!Array.isArray(tokens) || tokens.length === 0) {
    const { error } = await db.from('vtt_tokens')
      .delete()
      .eq('map_id', mapId)
      .eq('user_id', user.id);
    if (error) { console.error('[VTT] saveTokens delete:', error); return { error }; }
    return { success: true };
  }

  // Upsert all current tokens first so a network/validation failure never destroys existing data
  const rows = tokens.map(t => ({
    id: isValidUuid(t.id) ? t.id : _generateUuidV4(),
    map_id: mapId,
    user_id: user.id,
    name: t.name || '',
    image_url: t.imageUrl || t.image_url || null,
    x: t.x ?? null,
    y: t.y ?? null,
    size: t.size || 1,
    is_pc: t.isPC !== false
  }));

  const { error: upsertErr } = await db.from('vtt_tokens')
    .upsert(rows, { onConflict: 'id' });
  if (upsertErr) { console.error('[VTT] saveTokens upsert:', upsertErr); return { error: upsertErr }; }

  // Prune any tokens removed from this map
  const keptIds = new Set(rows.map(r => r.id));
  const { data: existing, error: listErr } = await db.from('vtt_tokens')
    .select('id')
    .eq('map_id', mapId)
    .eq('user_id', user.id);
  if (listErr) { console.error('[VTT] saveTokens prune list:', listErr); return { error: listErr }; }

  const staleIds = (existing || []).map(r => r.id).filter(id => !keptIds.has(id));
  const CHUNK_SIZE = 100;
  for (let i = 0; i < staleIds.length; i += CHUNK_SIZE) {
    const chunk = staleIds.slice(i, i + CHUNK_SIZE);
    const { error: delErr } = await db.from('vtt_tokens')
      .delete()
      .eq('map_id', mapId)
      .eq('user_id', user.id)
      .in('id', chunk);
    if (delErr) { console.error('[VTT] saveTokens prune delete:', delErr); return { error: delErr }; }
  }

  return { success: true };
}

// ── Token Library ──────────────────────────────────────────────────────────

async function vttLoadTokenLibrary() {
  if (isSandbox()) {
    const raw = localStorage.getItem('vtt_token_library');
    return raw ? JSON.parse(raw) : [];
  }
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await db.from('vtt_token_library')
    .select('id, name, image_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[VTT] loadTokenLibrary:', error); return []; }
  return data || [];
}

async function vttSaveTokenLibraryEntry(entry) {
  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_token_library') || '[]');
    all.unshift(entry);
    localStorage.setItem('vtt_token_library', JSON.stringify(all));
    return { id: entry.id, success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data, error } = await db.from('vtt_token_library')
    .insert({ user_id: user.id, name: entry.name, image_url: entry.image_url, image_path: entry.image_path })
    .select('id').single();
  if (error) { console.error('[VTT] saveTokenLibraryEntry:', error); return { error }; }
  return { id: data.id, success: true };
}

async function vttDeleteTokenLibraryEntry(id) {
  if (isSandbox()) {
    const all = JSON.parse(localStorage.getItem('vtt_token_library') || '[]');
    localStorage.setItem('vtt_token_library', JSON.stringify(all.filter(e => e.id !== id)));
    return { success: true };
  }
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await db.from('vtt_token_library').delete().eq('id', id).eq('user_id', user.id);
  if (error) { console.error('[VTT] deleteTokenLibraryEntry:', error); return { error }; }
  return { success: true };
}


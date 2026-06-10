// ── Init ────────────────────────────────────────────────────────────────────
lucide.createIcons();

// ── State ──────────────────────────────────────────────────────────────────
let pages = [];
let activePageIndex = -1;
let src = null;
let seed = Math.random() * 9e5;
let S = { rows:4, cols:4, style:'straight', color:'#ffffff', width:2, opacity:1, depth:.5, freq:3 };
let printOrientation = 'portrait';

// ── IndexedDB for Puzzle Images ──────────────────────────────────────────────
const DB_NAME = 'klasskit_puzzle_db';
const DB_VERSION = 2; // Upgraded for sets management + cloud sync
const STORE_IMAGES = 'puzzle_images';
const STORE_SETS = 'puzzle_sets';
let dbInstance = null;

function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Images store
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
      }
      // Sets store for library management
      if (!db.objectStoreNames.contains(STORE_SETS)) {
        db.createObjectStore(STORE_SETS, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveImageToDB(id, dataUrl, setId = null) {
  try {
    const db = await initDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.put(dataUrl, id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });

    // Upload to cloud if authenticated and not sandbox
    if (!isSandbox() && typeof uploadMedia === 'function' && setId) {
      try {
        const user = await getUser();
        if (user) {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `puzzle_${id}.webp`, { type: 'image/webp' });
          const cloudUrl = await uploadMedia(file, 'puzzle_maker', setId);
          return { localId: id, cloudUrl };
        }
      } catch (err) {
        console.warn('[Cloud] Image upload failed:', err);
      }
    }
    return { localId: id, cloudUrl: null };
  } catch (err) {
    console.error('saveImageToDB error:', err);
    return { localId: id, cloudUrl: null };
  }
}

async function loadImageFromDB(id, cloudUrl = null) {
  try {
    // Try local first
    const db = await initDB();
    const localData = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });

    if (localData) return localData;

    // Fall back to cloud if available
    if (cloudUrl && typeof resolveMediaUrl === 'function') {
      try {
        const resolvedUrl = await resolveMediaUrl(cloudUrl);
        if (resolvedUrl) {
          const response = await fetch(resolvedUrl);
          const blob = await response.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          // Cache locally
          await saveImageToDB(id, dataUrl);
          return dataUrl;
        }
      } catch (err) {
        console.warn('[Cloud] Failed to load image from cloud:', err);
      }
    }
    return null;
  } catch (err) {
    console.error('loadImageFromDB error:', err);
    return null;
  }
}

async function deleteImageFromDB(id) {
  try {
    const db = await initDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('deleteImageFromDB error:', err);
  }
}

// ── Cloud Set Management (Following card-maker pattern) ─────────────────────

async function savePuzzleSetToDB(name, stateData, existingId = null) {
  if (!isSandbox()) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;

    const set = {
      user_id: user.id,
      name,
      state_data: sanitizeCloudPayload(stateData),
      last_used: new Date().toISOString()
    };

    if (existingId) {
      // Update
      const { data, error } = await db.from('tools_puzzlemaker')
        .update({ name, state_data: set.state_data, last_used: set.last_used })
        .eq('id', existingId)
        .select('id').single();
      if (error) { console.error('[PuzzleSet] Update failed:', error); return null; }
      return data.id;
    } else {
      // Insert
      const { data, error } = await db.from('tools_puzzlemaker')
        .insert([set])
        .select('id').single();
      if (error) { console.error('[PuzzleSet] Insert failed:', error); return null; }
      return data.id;
    }
  }

  // Local IndexedDB fallback
  const localDb = await initDB();
  const tx = localDb.transaction(STORE_SETS, 'readwrite');
  const store = tx.objectStore(STORE_SETS);

  const set = {
    name,
    stateData,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    usageCount: 1
  };

  if (existingId) {
    return new Promise((resolve) => {
      const req = store.get(existingId);
      req.onsuccess = () => {
        const old = req.result;
        if (old) {
          set.id = existingId;
          set.createdAt = old.createdAt || Date.now();
          set.usageCount = (old.usageCount || 0) + 1;
        }
        store.put(set);
        tx.oncomplete = () => resolve(set.id);
      };
    });
  }

  const req = store.add(set);
  return new Promise(r => {
    req.onsuccess = (e) => r(e.target.result);
  });
}

async function updatePuzzleSetMetadata(id, data) {
  if (!isSandbox()) {
    const updateData = {};
    if (data.lastUsed) updateData.last_used = new Date().toISOString();
    if (data.stateData) updateData.state_data = sanitizeCloudPayload(data.stateData);
    if (data.name) updateData.name = data.name;
    if (data.usageCount !== undefined) {
      updateData.usage_count = data.usageCount;
      updateData.last_used = new Date().toISOString();
    }

    const { error } = await db.from('tools_puzzlemaker').update(updateData).eq('id', id);
    if (error) console.error('[PuzzleSet] Update metadata failed:', error);
    return;
  }

  const localDb = await initDB();
  const tx = localDb.transaction(STORE_SETS, 'readwrite');
  const store = tx.objectStore(STORE_SETS);

  return new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        const updated = { ...item, ...data, lastUsed: Date.now() };
        store.put(updated);
      }
      resolve();
    };
  });
}

async function getAllPuzzleSets() {
  if (!isSandbox()) {
    const { data, error } = await db.from('tools_puzzlemaker')
      .select('*')
      .order('last_used', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(d => ({
      id: d.id,
      name: d.name,
      stateData: d.state_data,
      usageCount: d.usage_count || 0,
      lastUsed: new Date(d.last_used).getTime(),
      createdAt: new Date(d.created_at).getTime()
    }));
  }

  try {
    const localDb = await initDB();
    return new Promise((res) => {
      const r = localDb.transaction(STORE_SETS, 'readonly').objectStore(STORE_SETS).getAll();
      r.onsuccess = () => {
        let sets = r.result || [];
        // Backwards compatibility
        sets.forEach(set => {
          if (!set.lastUsed) set.lastUsed = set.createdAt || Date.now();
          if (!set.usageCount) set.usageCount = 0;
        });
        res(sets);
      };
      r.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

async function deletePuzzleSet(id) {
  if (!isSandbox()) {
    const { data: { user } } = await db.auth.getUser();
    if (user) {
      // Delete cloud images folder
      deleteFolder(`${user.id}/puzzle_maker/${id}`).catch(e => console.warn("Cloud folder delete failed", e));
      // Delete from database
      await db.from('tools_puzzlemaker').delete().eq('id', id);
    }
    return;
  }

  // Local cleanup
  const localDb = await initDB();
  const tx = localDb.transaction(STORE_SETS, 'readwrite');
  tx.objectStore(STORE_SETS).delete(id);
  return new Promise(r => { tx.oncomplete = r; });
}

// ── State Management ──────────────────────────────────────────────────────

let saveTimeout = null;
let activeSetId = null;
let activeSetName = null;
let allSets = [];

async function saveState() {
  const stateToSave = {
    activeSetId,
    activePageIndex,
    pages: pages.map(p => ({
      id: p.id,
      name: p.name,
      seed: p.seed,
      S: p.S,
      cloudUrl: p.cloudUrl || null
    })),
    S,
    printOrientation
  };

  localStorage.setItem('prog_puzzle-maker', JSON.stringify(stateToSave));

  // Auto-save to library if active set (fire and forget with error handling)
  if (activeSetId) {
    try {
      await updatePuzzleSetMetadata(activeSetId, { stateData: stateToSave });
    } catch (err) {
      console.error('[SaveState] Failed to update library metadata:', err);
    }
  }

  // Cloud sync with sanitized payload (strip data URLs)
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (typeof saveProgress === 'function') {
      const cloudState = JSON.parse(JSON.stringify(stateToSave));
      // Strip any large data URLs for cloud storage
      cloudState.pages = cloudState.pages.map(p => ({
        ...p,
        cloudUrl: p.cloudUrl || null
      }));
      saveProgress('puzzle-maker', cloudState).catch(err => {
        console.error('[Cloud Save] Error:', err);
      });
    }
  }, 1000);
}

async function loadState() {
  // Load library first
  allSets = await getAllPuzzleSets();

  let saved = null;
  if (typeof loadProgress === 'function') {
    try {
      saved = await loadProgress('puzzle-maker');
    } catch (e) {}
  }
  if (!saved) {
    const local = localStorage.getItem('prog_puzzle-maker');
    if (local) {
      try {
        saved = JSON.parse(local);
      } catch (e) {}
    }
  }

  if (saved) {
    activeSetId = saved.activeSetId || null;

    if (saved.pages && saved.pages.length > 0) {
      pages = [];
      activePageIndex = saved.activePageIndex !== undefined ? saved.activePageIndex : -1;
      S = saved.S || S;
      printOrientation = saved.printOrientation || printOrientation;

      for (const p of saved.pages) {
        const dataUrl = await loadImageFromDB(p.id, p.cloudUrl);
        if (dataUrl) {
          const im = new Image();
          await new Promise((resolve) => {
            im.onload = resolve;
            im.onerror = resolve;
            im.src = dataUrl;
          });
          pages.push({
            id: p.id,
            im: im,
            name: p.name,
            seed: p.seed,
            S: p.S,
            cloudUrl: p.cloudUrl
          });
        }
      }

      if (pages.length > 0) {
        document.getElementById('empty').classList.add('hidden');
        document.getElementById('canvasWrap').classList.remove('hidden');
        document.getElementById('canvasWrap').classList.add('flex');
        document.getElementById('pagesSection').classList.remove('hidden');

        if (activePageIndex < 0 || activePageIndex >= pages.length) {
          activePageIndex = 0;
        }
        selectPage(activePageIndex);
      }
    }
  }

  // Restore active set name
  if (activeSetId) {
    const activeSet = allSets.find(s => s.id === activeSetId);
    if (activeSet) {
      activeSetName = activeSet.name;
      updateActiveIndicator();
    } else {
      activeSetId = null; // Clean up stale ID
    }
  }

  renderLibrary();
}

// ── Dark mode ──────────────────────────────────────────────────────────────
function updateDarkIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('darkIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons({ nodes: [icon] });
  }
}

document.getElementById('darkToggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme_puzzle-maker', isDark ? 'dark' : 'light');
  updateDarkIcon();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'theme_hub' || e.key === 'theme_puzzle-maker') {
    setTimeout(updateDarkIcon, 50);
  }
});

updateDarkIcon();

// ── Library Management ──────────────────────────────────────────────────────

async function createNewSet() {
  pages = [];
  activePageIndex = -1;
  src = null;
  activeSetId = null;
  activeSetName = null;
  seed = Math.random() * 9e5;
  S = { rows: 4, cols: 4, style: 'straight', color: '#ffffff', width: 2, opacity: 1, depth: 0.5, freq: 3 };

  document.getElementById('empty').classList.remove('hidden');
  document.getElementById('canvasWrap').classList.add('hidden');
  document.getElementById('canvasWrap').classList.remove('flex');
  document.getElementById('pagesSection').classList.add('hidden');
  document.getElementById('imgInfo').classList.add('hidden');

  updateActiveIndicator();
  renderPagesList();
  renderLibrary();
  saveState();
}

async function saveCurrentSet() {
  const nameInput = document.getElementById('set-name-input');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name || name.length > 100) {
    alert('Please enter a valid puzzle set name (1-100 characters)');
    return;
  }

  saveState();
  const stateData = {
    activePageIndex,
    pages: pages.map(p => ({
      id: p.id,
      name: p.name,
      seed: p.seed,
      S: p.S,
      cloudUrl: p.cloudUrl
    })),
    S,
    printOrientation
  };

  // Upload any images that haven't been uploaded yet (parallel for performance)
  const uploadPromises = pages
    .filter(p => !p.cloudUrl)
    .map(async p => {
      const dataUrl = await loadImageFromDB(p.id);
      if (dataUrl) {
        const result = await saveImageToDB(p.id, dataUrl, activeSetId || 'temp');
        p.cloudUrl = result.cloudUrl;
      }
    });
  await Promise.all(uploadPromises);
  stateData.pages = pages.map(p => ({
    id: p.id,
    name: p.name,
    seed: p.seed,
    S: p.S,
    cloudUrl: p.cloudUrl
  }));

  const newId = await savePuzzleSetToDB(name, stateData, activeSetId);
  if (newId) {
    activeSetId = newId;
    activeSetName = name;
    if (nameInput) nameInput.value = '';
    updateActiveIndicator();
    allSets = await getAllPuzzleSets();
    renderLibrary();
    alert(`Puzzle set "${name}" saved!`);
  }
}

async function loadSetFromList(id) {
  // Load from cloud or local first to get fresh data
  let stateData = null;
  let freshSet = null;
  
  if (!isSandbox() && typeof db !== 'undefined') {
    try {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data, error } = await db.from('tools_puzzlemaker')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          stateData = data.state_data;
          freshSet = { name: data.name, usageCount: data.usage_count || 0 };
        }
      }
    } catch (e) {}
  }

  // Fallback to local
  if (!stateData) {
    const localSet = await loadSetFromLibrary(id);
    if (localSet) {
      stateData = localSet.stateData;
      freshSet = { name: localSet.name, usageCount: localSet.usageCount || 0 };
    }
  }

  // Update metadata using fresh data
  if (freshSet) {
    await updatePuzzleSetMetadata(id, { usageCount: freshSet.usageCount + 1 });
  }

  if (stateData && freshSet) {
    loadPuzzleSet(stateData, id, freshSet.name);
  }
}

async function loadSetFromLibrary(id) {
  const localDb = await initDB();
  return new Promise((res) => {
    const tx = localDb.transaction(STORE_SETS, 'readonly');
    const store = tx.objectStore(STORE_SETS);
    const req = store.get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  });
}

function loadPuzzleSet(stateData, id = null, name = '') {
  pages = [];
  activePageIndex = stateData.activePageIndex || 0;
  S = stateData.S || S;
  printOrientation = stateData.printOrientation || 'portrait';
  activeSetId = id;
  activeSetName = name;

  // Load images
  const pagePromises = (stateData.pages || []).map(async (p) => {
    const dataUrl = await loadImageFromDB(p.id, p.cloudUrl);
    if (dataUrl) {
      const im = new Image();
      await new Promise((resolve) => {
        im.onload = resolve;
        im.onerror = resolve;
        im.src = dataUrl;
      });
      return {
        id: p.id,
        im: im,
        name: p.name,
        seed: p.seed,
        S: p.S,
        cloudUrl: p.cloudUrl
      };
    }
    return null;
  });

  Promise.all(pagePromises).then(loadedPages => {
    pages = loadedPages.filter(p => p !== null);

    if (pages.length > 0) {
      document.getElementById('empty').classList.add('hidden');
      document.getElementById('canvasWrap').classList.remove('hidden');
      document.getElementById('canvasWrap').classList.add('flex');
      document.getElementById('pagesSection').classList.remove('hidden');

      if (activePageIndex < 0 || activePageIndex >= pages.length) {
        activePageIndex = 0;
      }
      selectPage(activePageIndex);
    }

    updateActiveIndicator();
    updateControlsUI();
    renderPagesList();
    renderLibrary();
    saveState();
  });
}

function updateActiveIndicator() {
  const indicator = document.getElementById('active-set-indicator');
  const nameEl = document.getElementById('active-set-name');
  const saveBtn = document.getElementById('save-btn');

  if (indicator && nameEl) {
    if (activeSetId && activeSetName) {
      indicator.classList.remove('hidden');
      nameEl.textContent = activeSetName;
      if (saveBtn) saveBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> SAVE AS';
    } else {
      indicator.classList.add('hidden');
      if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save" class="w-3 h-3"></i> SAVE';
    }
    lucide.createIcons();
  }
}

function closeActiveSet() {
  activeSetId = null;
  activeSetName = null;
  updateActiveIndicator();
  renderLibrary();
}

function changeSetsSort() {
  const sortSelect = document.getElementById('sets-sort');
  if (sortSelect) {
    sortMode = sortSelect.value;
    renderLibrary();
  }
}

let sortMode = 'recent';

function renderLibrary() {
  const list = document.getElementById('sets-list');
  if (!list) return;

  let sorted = [...allSets];
  if (sortMode === 'recent') sorted.sort((a, b) => b.lastUsed - a.lastUsed);
  else if (sortMode === 'alpha') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortMode === 'popular') sorted.sort((a, b) => b.usageCount - a.usageCount);

  if (sorted.length === 0) {
    list.innerHTML = '<p class="text-slate-400 text-[10px] italic p-2">No saved puzzle sets yet.</p>';
    return;
  }

  list.innerHTML = sorted.map(set => {
    const isActive = activeSetId === set.id;
    const pageCount = set.stateData?.pages?.length || 0;
    const date = new Date(set.lastUsed).toLocaleDateString();
    return `
      <div class="set-item ${isActive ? 'active' : ''}" data-id="${set.id}">
        <div class="flex items-center gap-2 cursor-pointer flex-1" onclick="loadSetFromList('${set.id}')">
          <div class="w-8 h-8 rounded-lg bg-blue/20 flex items-center justify-center text-blue font-bold text-xs">
            ${pageCount}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <p class="text-xs font-bold truncate">${escapeHtml(set.name)}</p>
              ${isActive ? '<span class="px-1 py-0.5 bg-blue text-white text-[7px] rounded">Active</span>' : ''}
            </div>
            <p class="text-[9px] text-slate-400">${date} • ${set.usageCount || 0} uses</p>
          </div>
        </div>
        <button onclick="event.stopPropagation(); deletePuzzleSetPrompt('${set.id}')" class="p-1 text-slate-400 hover:text-red-500">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deletePuzzleSetPrompt(id) {
  if (confirm('Delete this puzzle set? This cannot be undone.')) {
    await deletePuzzleSet(id);
    if (activeSetId === id) closeActiveSet();
    allSets = await getAllPuzzleSets();
    renderLibrary();
  }
}

// ── Upload & Page Management ────────────────────────────────────────────────
const dz = document.getElementById('dropZone');
const fi = document.getElementById('fileIn');
const addPageBtn = document.getElementById('addPageBtn');

dz.addEventListener('click', () => fi.click());
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); load(e.dataTransfer.files[0]); });
fi.addEventListener('change', e => load(e.target.files[0]));
addPageBtn.addEventListener('click', () => fi.click());

function load(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = async () => {
      const pageId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const newPage = {
        id: pageId,
        im: im,
        name: f.name,
        seed: Math.random() * 9e5,
        S: { ...S },
        cloudUrl: null
      };
      pages.push(newPage);

      // Save to DB and optionally cloud
      const result = await saveImageToDB(pageId, e.target.result, activeSetId);
      newPage.cloudUrl = result.cloudUrl;
      saveState();

      document.getElementById('empty').classList.add('hidden');
      document.getElementById('canvasWrap').classList.remove('hidden');
      document.getElementById('canvasWrap').classList.add('flex');
      document.getElementById('pagesSection').classList.remove('hidden');

      selectPage(pages.length - 1);
    };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}

function selectPage(index) {
  if (index < 0 || index >= pages.length) return;
  activePageIndex = index;
  S = pages[index].S;
  src = pages[index].im;
  seed = pages[index].seed;
  
  document.getElementById('imgInfo').textContent = `📷 ${pages[index].name}  (${src.width} × ${src.height})`;
  document.getElementById('imgInfo').classList.remove('hidden');
  
  updateControlsUI();
  renderPagesList();
  redraw();
  saveState();
}

function deletePage(index) {
  const pageId = pages[index].id;
  deleteImageFromDB(pageId);
  pages.splice(index, 1);
  if (pages.length === 0) {
    activePageIndex = -1;
    src = null;
    document.getElementById('empty').classList.remove('hidden');
    document.getElementById('canvasWrap').classList.add('hidden');
    document.getElementById('canvasWrap').classList.remove('flex');
    document.getElementById('pagesSection').classList.add('hidden');
    document.getElementById('imgInfo').classList.add('hidden');
    saveState();
  } else {
    if (activePageIndex >= pages.length) {
      activePageIndex = pages.length - 1;
    }
    selectPage(activePageIndex);
  }
}

function renderPagesList() {
  const container = document.getElementById('pagesList');
  container.innerHTML = '';
  
  pages.forEach((p, index) => {
    const isActive = index === activePageIndex;
    const btn = document.createElement('div');
    btn.className = `page-pill ${isActive ? 'active' : ''}`;
    
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.delete-page-btn')) return;
      selectPage(index);
    });
    
    const title = document.createElement('span');
    title.textContent = `P${index + 1}`;
    btn.appendChild(title);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-page-btn text-red-400 hover:text-red-600 transition-colors flex items-center';
    delBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePage(index);
    });
    
    btn.appendChild(delBtn);
    container.appendChild(btn);
  });
  
  lucide.createIcons();
}

function updateControlsUI() {
  document.getElementById('rowsR').value = S.rows;
  document.getElementById('rowsLbl').textContent = S.rows;
  
  document.getElementById('colsR').value = S.cols;
  document.getElementById('colsLbl').textContent = S.cols;
  
  document.getElementById('widthR').value = S.width;
  document.getElementById('widthLbl').textContent = S.width + 'px';
  
  document.getElementById('opacR').value = Math.round(S.opacity * 100);
  document.getElementById('opacLbl').textContent = Math.round(S.opacity * 100) + '%';
  
  document.getElementById('depthR').value = Math.round(S.depth * 100);
  document.getElementById('depthLbl').textContent = Math.round(S.depth * 100) + '%';
  
  document.getElementById('freqR').value = S.freq;
  document.getElementById('freqLbl').textContent = S.freq;
  
  document.querySelectorAll('.style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === S.style);
  });
  showFreq();
  
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('sel', sw.dataset.color === S.color);
  });
  document.getElementById('colorPick').value = S.color;
}

// ── Sliders ────────────────────────────────────────────────────────────────
function bind(id, lbl, key, fmt, conv) {
  const el = document.getElementById(id);
  const lb = document.getElementById(lbl);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    S[key] = conv ? conv(v) : v;
    lb.textContent = fmt(v);
    redraw();
    saveState();
  });
}
bind('rowsR',  'rowsLbl',  'rows',  v => Math.round(v), v => Math.round(v));
bind('colsR',  'colsLbl',  'cols',  v => Math.round(v), v => Math.round(v));
bind('widthR', 'widthLbl', 'width', v => Math.round(v)+'px', v => Math.round(v));
bind('opacR',  'opacLbl',  'opacity', v => Math.round(v)+'%', v => v/100);
bind('depthR', 'depthLbl', 'depth', v => Math.round(v)+'%', v => v/100);
bind('freqR',  'freqLbl',  'freq',  v => Math.round(v), v => Math.round(v));

// ── Style buttons ──────────────────────────────────────────────────────────
const freqRow = document.getElementById('freqRow');
function showFreq() {
  freqRow.style.display = ['wavy','bumpy'].includes(S.style) ? '' : 'none';
}
showFreq();

document.querySelectorAll('.style-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    S.style = b.dataset.style;
    showFreq();
    redraw();
    saveState();
  });
});

// ── Print Orientation ────────────────────────────────────────────────────────
['orientPortrait','orientLandscape'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-orient]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    printOrientation = btn.dataset.orient;
  });
});

// ── Color ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.swatch[data-color]').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
    sw.classList.add('sel');
    S.color = sw.dataset.color;
    document.getElementById('colorPick').value = sw.dataset.color;
    redraw();
    saveState();
  });
});
document.getElementById('colorPick').addEventListener('input', function() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
  this.classList.add('sel');
  S.color = this.value;
  redraw();
  saveState();
});

// ── Actions ────────────────────────────────────────────────────────────────
document.getElementById('shuffleBtn').addEventListener('click', () => { 
  seed = Math.random()*9e5; 
  if (activePageIndex !== -1) {
    pages[activePageIndex].seed = seed;
  }
  redraw(); 
  saveState();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!src) return;
  const c = document.getElementById('canvas');
  const a = document.createElement('a');
  a.download = `puzzle-page-${activePageIndex + 1}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
});

document.getElementById('printBtn').addEventListener('click', () => {
  if (pages.length === 0) return;
  
  // Create or retrieve print container
  let printArea = document.getElementById('printArea');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'printArea';
    printArea.className = 'hidden';
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = '';
  
  // Render each page into a temporary canvas and convert to image for printing
  pages.forEach((p, index) => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate aspect-ratio fitted dimensions
    const MAX = 1400;
    let W = p.im.width, H = p.im.height;
    if (W > MAX) { H = H * MAX / W; W = MAX; }
    if (H > MAX) { W = W * MAX / H; H = MAX; }
    tempCanvas.width = Math.round(W);
    tempCanvas.height = Math.round(H);
    
    // Draw page image
    tempCtx.drawImage(p.im, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the puzzle line grid onto the temporary canvas using this page's settings
    drawGridWithSettings(tempCtx, tempCanvas.width, tempCanvas.height, p.S, p.seed);
    
    // Wrap inside standard A4 container for CSS formatting
    const pageDiv = document.createElement('div');
    pageDiv.className = 'print-page';
    
    const img = document.createElement('img');
    img.src = tempCanvas.toDataURL('image/png');
    img.className = 'print-img';
    
    pageDiv.appendChild(img);
    printArea.appendChild(pageDiv);
  });
  
  // Inject dynamic @page rule for orientation
  let pageStyle = document.getElementById('printPageStyle');
  if (pageStyle) pageStyle.remove();
  pageStyle = document.createElement('style');
  pageStyle.id = 'printPageStyle';
  pageStyle.textContent = `@media print { @page { size: A4 ${printOrientation}; margin: 0; } }`;
  document.head.appendChild(pageStyle);

  // Wait for all print images to decode before opening print dialog
  const imgs = Array.from(printArea.querySelectorAll('img'));
  const decodeWithTimeout = (img) => {
    if (!img.decode) return Promise.resolve();
    return Promise.race([
      img.decode(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Decode timeout')), 5000))
    ]);
  };

  Promise.all(imgs.map(decodeWithTimeout))
    .catch(() => {}) // Fallback: print anyway even if decode fails/times out
    .then(() => window.print());

  // Clean up after print dialog closes
  window.addEventListener('afterprint', () => {
    if (pageStyle) pageStyle.remove();
  }, { once: true });
});

// ── RNG ────────────────────────────────────────────────────────────────────
function rngWithSeed(s, pSeed) { const x = Math.sin(s + pSeed)*1e5; return x - Math.floor(x); }

// ── Draw ───────────────────────────────────────────────────────────────────
function redraw() {
  if (!src) return;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const MAX = 1400;
  let W = src.width, H = src.height;
  if (W > MAX) { H = H*MAX/W; W = MAX; }
  if (H > MAX) { W = W*MAX/H; H = MAX; }
  canvas.width  = Math.round(W);
  canvas.height = Math.round(H);
  document.getElementById('sizeLbl').textContent = `${canvas.width} × ${canvas.height} px`;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height);
}

function drawGridWithSettings(ctx, W, H, settings, pSeed) {
  const {rows, cols, style, color, width, opacity, depth, freq} = settings;
  const cW = W/cols, cH = H/rows;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.globalAlpha = opacity;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0=c*cW, x1=(c+1)*cW, y=r*cH;
      const d = rngWithSeed(r*1e3+c, pSeed) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x0,y, x1,y, true, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  // Vertical lines
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const y0=r*cH, y1=(r+1)*cH, x=c*cW;
      const d = rngWithSeed(c*1e3+r+5e4, pSeed) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x,y0, x,y1, false, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGrid(ctx, W, H) {
  drawGridWithSettings(ctx, W, H, S, seed);
}

function seg(ctx, x0,y0,x1,y1, hz, cW,cH, style,dir,depth,freq) {
  switch(style) {
    case 'straight': doStraight(ctx,x0,y0,x1,y1); break;
    case 'jigsaw':   doJigsaw  (ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth); break;
    case 'jagged':   doJagged  (ctx,x0,y0,x1,y1,hz,cW,cH,depth); break;
    case 'wavy':     doWavy    (ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq); break;
    case 'curved':   doCurved  (ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth); break;
    case 'bumpy':    doBumpy   (ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq); break;
  }
}

function doStraight(ctx,x0,y0,x1,y1) {
  ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
}

function doJigsaw(ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth) {
  const r = (hz?cH:cW) * .22 * depth;
  const mid = hz ? (x0+x1)/2 : (y0+y1)/2;
  ctx.moveTo(x0,y0);
  if (hz) {
    ctx.lineTo(mid-r, y0);
    const pk = y0 - dir*r*1.75;
    ctx.bezierCurveTo(mid-r, y0-dir*r*.6, mid-r*.4, pk, mid, pk);
    ctx.bezierCurveTo(mid+r*.4, pk, mid+r, y0-dir*r*.6, mid+r, y0);
    ctx.lineTo(x1,y1);
  } else {
    ctx.lineTo(x0, mid-r);
    const pk = x0 - dir*r*1.75;
    ctx.bezierCurveTo(x0-dir*r*.6, mid-r, pk, mid-r*.4, pk, mid);
    ctx.bezierCurveTo(pk, mid+r*.4, x0-dir*r*.6, mid+r, x0, mid+r);
    ctx.lineTo(x1,y1);
  }
}

function doJagged(ctx,x0,y0,x1,y1,hz,cW,cH,depth) {
  const amp = (hz?cH:cW) * .15 * depth;
  const steps = 10;
  ctx.moveTo(x0,y0);
  for (let i=1;i<=steps;i++) {
    const t=i/steps, off=(i%2===0?1:-1)*amp;
    ctx.lineTo(hz?x0+(x1-x0)*t:x0+off, hz?y0+off:y0+(y1-y0)*t);
  }
}

function doWavy(ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq) {
  const amp=(hz?cH:cW)*.12*depth, steps=60;
  ctx.moveTo(x0,y0);
  for (let i=1;i<=steps;i++) {
    const t=i/steps, wave=Math.sin(t*Math.PI*2*freq)*amp;
    ctx.lineTo(hz?x0+(x1-x0)*t:x0+wave, hz?y0+wave:y0+(y1-y0)*t);
  }
}

function doCurved(ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth) {
  const off=(hz?cH:cW)*.35*depth*dir;
  ctx.moveTo(x0,y0);
  if (hz) ctx.bezierCurveTo(x0+(x1-x0)*.33,y0+off, x0+(x1-x0)*.66,y0-off, x1,y1);
  else    ctx.bezierCurveTo(x0+off,y0+(y1-y0)*.33, x0-off,y0+(y1-y0)*.66, x1,y1);
}

function doBumpy(ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq) {
  const amp=(hz?cH:cW)*.13*depth, steps=freq*2;
  ctx.moveTo(x0,y0);
  for (let i=0;i<steps;i++) {
    const t0=i/steps, t1=(i+1)/steps;
    const mid=(t0+t1)/2, sign=i%2===0?-1:1;
    if (hz) {
      const cx=x0+(x1-x0)*mid, cy=y0+sign*amp*1.5;
      ctx.quadraticCurveTo(cx,cy, x0+(x1-x0)*t1, y0);
    } else {
      const cy=y0+(y1-y0)*mid, cx=x0+sign*amp*1.5;
      ctx.quadraticCurveTo(cx,cy, x0, y0+(y1-y0)*t1);
    }
  }
}

// ── Init State ──────────────────────────────────────────────────────────────
loadState();
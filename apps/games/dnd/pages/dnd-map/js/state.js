/* ===================================================================
   Arcane Tabletop VTT – Refactored & Improved
   ===================================================================
   - Modular structure with clear separation of concerns
   - Fixed map rotation coordinate transformation
   - Undo/redo now includes grid size
   - More robust pointer event handling
   - Improved polygon drawing (snap to start, escape cancel)
   - Better error handling for token images
   - Performance: rAF batching preserved
   - Fully compatible with existing HTML/CSS
   =================================================================== */

'use strict';

// ==================== CONSTANTS & GLOBALS ====================
const DB_NAME = 'ArcaneVTT_DB';
const DB_VERSION = 5;
const MAX_HISTORY = 50;
const LONG_PRESS_MS = 800;
const DOUBLE_TAP_MS = 300;
const MOVE_THRESHOLD = 5; // px
const GRID_MIN = 20;
const GRID_MAX = 120;
const DEFAULT_GRID = 50;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// Tool identifiers
const TOOLS = {
    DRAG: 'drag',
    PAN: 'pan',
    FOG_DRAW: 'fog-draw',
    FOG_RECT: 'fog-rect',
    FOG_ERASE: 'fog-erase',
    FOG_TOGGLE: 'fog-toggle',
    RULER: 'ruler',
    WAYPOINT: 'waypoint',
    WALL: 'wall',
    WALL_ERASE: 'wall-erase',
    WALL_EDIT: 'wall-edit',
    OPENING: 'opening'
};

// DOM element shortcuts
const $ = id => document.getElementById(id);

// UUID generator — uses crypto.randomUUID when available, falls back to RFC 4122 v4
function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ==================== IMAGE CACHE ====================
// In-memory cache for decoded map images - makes player view reopen instantly
const _mapImageCache = new Map(); // mapId -> { image, width, height, timestamp }

// ==================== STATE MANAGEMENT ====================
const state = {
    // UI mode
    isDMMode: true,
    currentTool: TOOLS.DRAG,

    // Campaign data
    campaignsList: [],
    activeCampaignId: null,

    // Map data
    mapsList: [],
    currentMapData: null,
    mapImage: null,
    mapImageSrc: null,

    // Canvas objects
    tokens: [],           // { id, name, x, y, img, size }
    fogShapes: [],        // { id, points, isHidden }
    gridSize: DEFAULT_GRID,

    // View transform
    transform: { x: 50, y: 50, scale: 1 },

    // Interaction state
    activePointers: new Map(),
    lastPinchDist: null,
    lastPointerCenter: null,
    isPanning: false,
    activeToken: null,
    selectedToken: null,  // last token interacted with — moved by arrow keys
    isDrawing: false,
    currentDrawPoints: [],
    lastTapTime: 0,
    pointerMoved: false,
    longPressTimer: null,
    mousePos: null,
    shiftKey: false,     // Track shift key for angle snapping

    // Undo/redo
    history: [],
    historyIndex: -1,

    // Token library
    tokenLibrary: [],

    // Map template library (reusable map layouts)
    mapTemplateLibrary: [],

    // Player mode tool: 'move' | 'pan' | 'fog' | 'ruler' | 'ping'
    playerTool: 'move',

    // Grid visibility
    isGridVisible: false,

    // LOS
    losEnabled: false,
    losDarkMap: false,          // 50% dark overlay on entire map regardless of LOS
    losViewDistance: 30,        // view distance in metres
    gridMetresPerSquare: 1.5,   // how many metres one grid square represents

    // Wall segments: { id, x1, y1, x2, y2 }
    wallSegments: [],

    // Opening segments: { id, x1, y1, x2, y2, isOpen, isDoor }
    // isDoor=true → door (brown), isDoor=false → window (cyan)
    openingSegments: [],
    _openingIsDoor: true, // current sub-mode for OPENING tool

    // Wall draw drag state
    wallDrag: {
        active: false,
        x1: 0, y1: 0,   // start (snapped)
        x2: 0, y2: 0    // current end (snapped)
    },

    // Wall edit drag state
    wallEdit: {
        segId: null,       // segment being edited
        endpoint: null,    // 'start' | 'end'
        isDragging: false,
        isOpening: false   // true if editing an opening (door/window)
    },

    // Waypoints: { id, x, y, label }
    waypoints: [],

    // Ruler state
    rulerStart: null,    // { x, y } in canvas coords
    rulerEnd: null,
    rulerActive: false,

    // Initiative tracker
    initiative: {
        combatants: [],  // { id, name, initiative, tokenId, hp, maxHp }
        currentIndex: -1,
        round: 1
    }
};

// ==================== DOM CACHE ====================
const dom = {
    wrapper: $('canvas-wrapper'),
    container: $('canvas-container'),
    mapCanvas: $('layer-map'),
    gridCanvas: $('layer-grid'),
    tokenCanvas: $('layer-token'),
    fogCanvas: $('layer-fog'),
    losCanvas: $('layer-los'),
    losCtx: $('layer-los').getContext('2d'),
    mapCtx: $('layer-map').getContext('2d'),
    gridCtx: $('layer-grid').getContext('2d'),
    tokenCtx: $('layer-token').getContext('2d'),
    fogCtx: $('layer-fog').getContext('2d'),
    btnUndo: $('btn-undo'),
    btnRedo: $('btn-redo'),
    modeToggle: $('mode-toggle'),
    sidebar: $('dm-sidebar'),
    mapSelect: $('map-select'),
    mapLibrary: $('map-library'),
    mapSort: $('map-sort'),
    mapActiveIndicator: $('map-active-indicator'),
    mapActiveName: $('map-active-name'),
    mapAutosaveStatus: $('map-autosave-status'),
    campaignSelect: $('campaign-select'),
    campaignActiveBadge: $('campaign-active-badge'),
    campaignActiveName: $('campaign-active-name'),
    campaignMapCount: $('campaign-map-count'),
    gridSizeInput: $('grid-size-input'),
    gridSizeValue: $('grid-size-value'),
    gridColsInput: $('grid-cols-input'),
    gridRowsInput: $('grid-rows-input'),
    ctxMenu: $('token-context-menu'),
    tokenLibGrid: $('token-library-grid'),
    tokenLibEmpty: $('token-library-empty'),
    mapTemplateGrid: $('map-template-grid'),
    mapTemplateEmpty: $('map-template-empty'),
    modal: $('custom-modal'),
    modalTitle: $('modal-title'),
    modalMessage: $('modal-message'),
    modalInput: $('modal-input'),
    modalCancel: $('modal-cancel'),
    modalConfirm: $('modal-confirm'),
    tokenNameInput: $('token-name'),
    rulerCanvas: $('layer-ruler'),
    initiativeList: $('initiative-list'),
    initControls: $('init-controls'),
    initRound: $('init-round')
};

// ==================== UTILITY FUNCTIONS ====================
function getPointerPos(evt) {
    const rect = dom.wrapper.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left - state.transform.x) / state.transform.scale,
        y: (evt.clientY - rect.top - state.transform.y) / state.transform.scale,
        rawX: evt.clientX,
        rawY: evt.clientY
    };
}

function worldToScreen(worldX, worldY) {
    return {
        x: worldX * state.transform.scale + state.transform.x,
        y: worldY * state.transform.scale + state.transform.y
    };
}

function createPing(rawPos) {
    const rect = dom.wrapper.getBoundingClientRect();
    const ping = document.createElement('div');
    ping.className = 'ping-ring';
    ping.style.left = (rawPos.rawX - rect.left) + 'px';
    ping.style.top = (rawPos.rawY - rect.top) + 'px';
    dom.wrapper.appendChild(ping);
    setTimeout(() => ping.remove(), 1000);
}


// ==================== UNDO/REDO ====================
function snapshotState() {
    return {
        tokens: state.tokens.map(t => ({
            id: t.id,
            name: t.name,
            x: t.x,
            y: t.y,
            src: t.imageUrl || t.img?.src || null,
            imageUrl: t.imageUrl || null,
            size: t.size || 1,
            isPC: t.isPC !== false
        })),
        fogShapes: JSON.parse(JSON.stringify(state.fogShapes)),
        gridSize: state.gridSize,
        wallSegments: JSON.parse(JSON.stringify(state.wallSegments)),
        openingSegments: JSON.parse(JSON.stringify(state.openingSegments))
    };
}

function pushHistory() {
    // Remove any forward history
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshotState());
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
    saveCurrentMap(); // Save after any state change
    broadcastState();
}

function restoreSnapshot(snap) {
    state.fogShapes = JSON.parse(JSON.stringify(snap.fogShapes));
    state.gridSize = snap.gridSize;
    if (snap.wallSegments) state.wallSegments = JSON.parse(JSON.stringify(snap.wallSegments));
    if (snap.openingSegments) state.openingSegments = JSON.parse(JSON.stringify(snap.openingSegments));
    // migrate old saves
    else if (snap.doorSegments || snap.windowSegments) {
        state.openingSegments = [
            ...(snap.doorSegments || []).map(d => ({ ...d, isDoor: true })),
            ...(snap.windowSegments || []).map(w => ({ ...w, isDoor: false, isOpen: w.isOpen ?? true }))
        ];
    }
    invalidateLOSCache();
    updateGridDisplay();
    renderGrid();

    // Reload tokens asynchronously
    const tokenPromises = snap.tokens.map(async (td) => {
        let tokenSrc = td.imageUrl || td.src;
        if (typeof resolveMediaUrl === 'function' && tokenSrc && tokenSrc.includes('klasskit-media')) {
            try { tokenSrc = await resolveMediaUrl(tokenSrc); } catch (e) {}
        }
        const img = new Image();
        return new Promise((resolve) => {
            img.onload = () => resolve({ ...td, img });
            img.onerror = () => {
                console.warn(`Failed to load token: ${td.name}`);
                resolve(null);
            };
            img.src = tokenSrc;
        });
    });

    Promise.all(tokenPromises).then(results => {
        state.tokens = results.filter(t => t !== null);
        renderTokens();
        renderFog();
        saveCurrentMap(); // Ensure map data is updated
    });
}

function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreSnapshot(state.history[state.historyIndex]);
    updateUndoRedoButtons();
}

function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreSnapshot(state.history[state.historyIndex]);
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    dom.btnUndo.disabled = state.historyIndex <= 0;
    dom.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
}

// ==================== INDEXEDDB ====================
let dataBase;

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        dataBase = e.target.result;
        if (!dataBase.objectStoreNames.contains('maps')) {
            dataBase.createObjectStore('maps', { keyPath: 'id' });
        }
        if (!dataBase.objectStoreNames.contains('tokenLibrary')) {
            dataBase.createObjectStore('tokenLibrary', { keyPath: 'id' });
        }
        if (!dataBase.objectStoreNames.contains('campaigns')) {
            dataBase.createObjectStore('campaigns', { keyPath: 'id' });
        }
        if (!dataBase.objectStoreNames.contains('mapTemplates')) {
            dataBase.createObjectStore('mapTemplates', { keyPath: 'id' });
        }
    };
    request.onsuccess = async (e) => {
        dataBase = e.target.result;
        // Load campaigns only if the store exists (guard for any schema edge-cases)
        if (dataBase.objectStoreNames.contains('campaigns')) {
            await new Promise((resolve) => {
                const tx = dataBase.transaction('campaigns', 'readonly');
                const req = tx.objectStore('campaigns').getAll();
                req.onsuccess = () => {
                    state.campaignsList = req.result || [];
                    renderCampaignSelect();
                    resolve();
                };
                req.onerror = () => resolve(); // fail silently, campaigns just stay empty
            });
        } else {
            renderCampaignSelect();
        }
        await new Promise((resolve) => {
            const tx = dataBase.transaction('maps', 'readonly');
            const req = tx.objectStore('maps').getAll();
            req.onsuccess = () => {
                state.mapsList = (req.result || []).map(ensureMapMeta);
                renderMapLibrary();
                resolve();
            };
        });
        loadTokenLibrary();
        loadMapTemplateLibrary();
        // Boot from local immediately — don't wait for cloud
        if (state.mapsList.length > 0) await loadMap(state.mapsList[0].id);
        // Background cloud sync — merges cloud data silently after UI is ready
        syncFromCloud();
    };
    request.onerror = () => showAlert('Database Error', 'Failed to open IndexedDB');
}

function saveCurrentMap() {
    if (!state.currentMapData || !dataBase) return;
    state.currentMapData.tokens = state.tokens.map(t => ({
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img?.src || null, imageUrl: t.imageUrl || null, size: t.size || 1, isPC: t.isPC !== false
    }));
    state.currentMapData.fogShapes = state.fogShapes;
    state.currentMapData.gridSize = state.gridSize;
    state.currentMapData.waypoints = state.waypoints;
    state.currentMapData.wallSegments = state.wallSegments;
    state.currentMapData.openingSegments = state.openingSegments;
    state.currentMapData.gridMetresPerSquare = state.gridMetresPerSquare;
    state.currentMapData.isGridVisible = state.isGridVisible;
    state.currentMapData.losEnabled = state.losEnabled;
    state.currentMapData.losDarkMap = state.losDarkMap;
    state.currentMapData.losViewDistance = state.losViewDistance;
    state.currentMapData.lastUsed = Date.now();
    try {
        const tx = dataBase.transaction('maps', 'readwrite');
        tx.onerror = () => console.warn('IndexedDB save failed');
        tx.objectStore('maps').put(state.currentMapData);
    } catch (e) {
        console.warn('IndexedDB save error:', e);
    }
    // Show autosave indicator
    if (dom.mapAutosaveStatus) {
        dom.mapAutosaveStatus.classList.remove('hidden');
        dom.mapAutosaveStatus.textContent = 'saving...';
        clearTimeout(saveCurrentMap._hideTimer);
        saveCurrentMap._hideTimer = setTimeout(() => {
            if (dom.mapAutosaveStatus) {
                dom.mapAutosaveStatus.textContent = 'saved';
                setTimeout(() => dom.mapAutosaveStatus.classList.add('hidden'), 1200);
            }
        }, 600);
    }
    syncToCloud();
}

function loadMapList() {
    const tx = dataBase.transaction('maps', 'readonly');
    const req = tx.objectStore('maps').getAll();
    req.onsuccess = () => {
        state.mapsList = (req.result || []).map(ensureMapMeta);
        renderMapLibrary();
    };
}

// Keep hidden select in sync for any legacy code paths
function updateMapDropdown() {
    if (!dom.mapSelect) return;
    dom.mapSelect.innerHTML = '<option value="">-- Select Map --</option>';
    state.mapsList.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        dom.mapSelect.appendChild(opt);
    });
    dom.mapSelect.value = state.currentMapData ? state.currentMapData.id : '';
}

function ensureMapMeta(map) {
    const now = Date.now();
    if (!map.createdAt) map.createdAt = now;
    if (!map.lastUsed)  map.lastUsed  = map.createdAt;
    if (typeof map.usageCount !== 'number') map.usageCount = 0;
    return map;
}

function formatTimeAgo(ts) {
    if (!ts) return 'never';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ==================== CAMPAIGN MANAGEMENT ====================

function renderCampaignSelect() {
    if (!dom.campaignSelect) return;
    const prev = dom.campaignSelect.value;
    dom.campaignSelect.innerHTML = '<option value="">All Maps</option>';
    const sorted = [...state.campaignsList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        dom.campaignSelect.appendChild(opt);
    });
    // Restore selection if still valid
    if (prev && state.campaignsList.find(c => String(c.id) === String(prev))) {
        dom.campaignSelect.value = prev;
    } else {
        dom.campaignSelect.value = '';
        state.activeCampaignId = null;
    }
    updateCampaignBadge();
}

function updateCampaignBadge() {
    const cid = dom.campaignSelect?.value;
    state.activeCampaignId = cid ? String(cid) : null;
    const campaign = state.campaignsList.find(c => String(c.id) === state.activeCampaignId);
    if (campaign && dom.campaignActiveBadge) {
        dom.campaignActiveBadge.classList.remove('hidden');
        dom.campaignActiveBadge.classList.add('flex');
        if (dom.campaignActiveName) dom.campaignActiveName.textContent = campaign.name;
        const count = state.mapsList.filter(m => String(m.campaignId || '') === String(campaign.id)).length;
        if (dom.campaignMapCount) dom.campaignMapCount.textContent = `${count} map${count !== 1 ? 's' : ''}`;
    } else if (dom.campaignActiveBadge) {
        dom.campaignActiveBadge.classList.add('hidden');
        dom.campaignActiveBadge.classList.remove('flex');
    }
}

function saveCampaign(campaign) {
    if (!dataBase || !dataBase.objectStoreNames.contains('campaigns')) return;
    const tx = dataBase.transaction('campaigns', 'readwrite');
    tx.objectStore('campaigns').put(campaign);
    if (typeof vttSaveCampaign === 'function') vttSaveCampaign({ id: campaign.cloudId || null, name: campaign.name }).then(r => {
        if (r?.id && !campaign.cloudId) { campaign.cloudId = r.id; const tx2 = dataBase.transaction('campaigns', 'readwrite'); tx2.objectStore('campaigns').put(campaign); }
    });
}

function createCampaign(name) {
    const campaign = { id: newId(), name: name.trim(), createdAt: Date.now() };
    state.campaignsList.push(campaign);
    saveCampaign(campaign);
    renderCampaignSelect();
    // Auto-select the new campaign
    if (dom.campaignSelect) dom.campaignSelect.value = campaign.id;
    updateCampaignBadge();
    renderMapLibrary();
    return campaign;
}

function renameCampaign(id, newName) {
    const campaign = state.campaignsList.find(c => c.id === id);
    if (!campaign) return;
    campaign.name = newName.trim();
    saveCampaign(campaign);
    renderCampaignSelect();
    if (dom.campaignSelect) dom.campaignSelect.value = id;
    updateCampaignBadge();
}

function deleteCampaign(id) {
    const campaign = state.campaignsList.find(c => c.id === id);
    if (!campaign) return;
    const mapCount = state.mapsList.filter(m => m.campaignId === id).length;
    const msg = mapCount > 0
        ? `Delete campaign "${campaign.name}"? Its ${mapCount} map(s) will become uncategorized.`
        : `Delete campaign "${campaign.name}"?`;
    showConfirm('Delete Campaign', msg, () => {
        // Unlink maps from this campaign
        state.mapsList.forEach(m => {
            if (m.campaignId === id) {
                delete m.campaignId;
                if (dataBase) {
                    const tx = dataBase.transaction('maps', 'readwrite');
                    tx.objectStore('maps').put(m);
                }
            }
        });
        const deletedCampaign = state.campaignsList.find(c => c.id === id);
        state.campaignsList = state.campaignsList.filter(c => c.id !== id);
        if (dataBase) {
            const tx = dataBase.transaction('campaigns', 'readwrite');
            tx.objectStore('campaigns').delete(id);
        }
        if (deletedCampaign?.cloudId && typeof vttDeleteCampaign === 'function') vttDeleteCampaign(deletedCampaign.cloudId);
        if (state.activeCampaignId === id) state.activeCampaignId = null;
        renderCampaignSelect();
        renderMapLibrary();
    });
}

function renderMapLibrary() {
    updateMapDropdown();
    if (!dom.mapLibrary) return;
    dom.mapLibrary.innerHTML = '';

    // Update active indicator
    if (state.currentMapData && dom.mapActiveIndicator) {
        dom.mapActiveIndicator.classList.remove('hidden');
        dom.mapActiveIndicator.classList.add('flex');
        if (dom.mapActiveName) dom.mapActiveName.textContent = state.currentMapData.name;
    } else if (dom.mapActiveIndicator) {
        dom.mapActiveIndicator.classList.add('hidden');
        dom.mapActiveIndicator.classList.remove('flex');
    }

    const sortMode = dom.mapSort ? dom.mapSort.value : 'recent';
    // Filter by active campaign; null = show all (compare as strings to handle number/string mismatch)
    const filtered = state.activeCampaignId
        ? state.mapsList.filter(m => String(m.campaignId || '') === state.activeCampaignId)
        : state.mapsList;

    const sorted = [...filtered].sort((a, b) => {
        if (sortMode === 'alpha')   return (a.name || '').localeCompare(b.name || '');
        if (sortMode === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
        return (b.lastUsed || 0) - (a.lastUsed || 0);
    });

    // Update badge map count
    updateCampaignBadge();

    if (sorted.length === 0) {
        const msg = state.activeCampaignId
            ? 'No maps in this campaign yet. Upload one above.'
            : 'No maps yet. Upload one above.';
        dom.mapLibrary.innerHTML = `<p class="col-span-2 text-center text-xs text-stone-600 italic py-4">${msg}</p>`;
        return;
    }

    const frag = document.createDocumentFragment();
    sorted.forEach(m => {
        const isActive = state.currentMapData && m.id === state.currentMapData.id;
        const card = document.createElement('div');
        card.className = `relative rounded-lg border p-2.5 cursor-pointer transition-all group ${
            isActive
                ? 'bg-stone-800 border-amber-500 ring-1 ring-amber-500/40'
                : 'bg-stone-950 border-amber-900/20 hover:border-amber-900/50'
        }`;

        const cardCampaign = state.campaignsList.find(c => c.id === m.campaignId);
        const campaignTag = cardCampaign
            ? `<span class="text-[9px] text-amber-700 truncate block mt-0.5">${cardCampaign.name}</span>`
            : (state.campaignsList.length > 0 ? '<span class="text-[9px] text-stone-700 italic block mt-0.5">uncategorized</span>' : '');

        card.innerHTML = `
            <p class="text-xs font-bold font-cinzel text-stone-200 truncate leading-tight pr-4" title="${m.name}">${m.name}</p>
            ${campaignTag}
            <p class="text-[10px] text-stone-600 mt-0.5">${formatTimeAgo(m.lastUsed)}</p>
            ${isActive ? '<span class="absolute top-1.5 right-1.5 text-[9px] font-bold text-amber-500 bg-amber-900/40 px-1 py-0.5 rounded">ON</span>' : ''}
            <div class="map-card-actions absolute bottom-1.5 right-1.5 hidden group-hover:flex gap-1">
                <button data-id="${m.id}" data-action="assign" title="Assign to campaign"
                    class="p-0.5 text-stone-500 hover:text-amber-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </button>
                <button data-id="${m.id}" data-action="rename" title="Rename"
                    class="p-0.5 text-stone-500 hover:text-amber-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button data-id="${m.id}" data-action="delete" title="Delete"
                    class="p-0.5 text-stone-500 hover:text-red-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.map-card-actions')) return;
            saveCurrentMap();
            loadMap(m.id);
        });

        card.querySelector('[data-action="assign"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.campaignsList.length === 0) {
                showAlert('No Campaigns', 'Create a campaign first using the + button above.');
                return;
            }
            // Build options: "None" + each campaign
            const options = [{ id: null, name: '(None / Uncategorized)' }, ...state.campaignsList];
            const currentIdx = options.findIndex(c => c.id === (m.campaignId || null));
            // Use a prompt with comma-separated names as hint, cycle via select
            const names = options.map((c, i) => `${i}: ${c.name}`).join('\n');
            showPrompt(
                `Assign "${m.name}" to campaign:\n${names}\n\nEnter number:`,
                String(currentIdx >= 0 ? currentIdx : 0),
                (val) => {
                    const idx = parseInt(val, 10);
                    if (isNaN(idx) || idx < 0 || idx >= options.length) return;
                    const chosen = options[idx];
                    if (chosen.id === null) {
                        delete m.campaignId;
                    } else {
                        m.campaignId = chosen.id;
                    }
                    const tx = dataBase.transaction('maps', 'readwrite');
                    tx.objectStore('maps').put(m);
                    tx.oncomplete = () => { renderMapLibrary(); };
                }
            );
        });

        card.querySelector('[data-action="rename"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showPrompt('Rename Map', m.name, (newName) => {
                if (!newName || !newName.trim()) return;
                m.name = newName.trim();
                const tx = dataBase.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(m);
                tx.oncomplete = () => {
                    renderMapLibrary();
                    syncToCloud();
                };
            });
        });

        card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMap(m.id);
        });

        frag.appendChild(card);
    });
    dom.mapLibrary.appendChild(frag);
}

async function duplicateMap() {
    if (!state.currentMapData) {
        showAlert('No Map', 'Load a map first to copy it.');
        return;
    }
    showPrompt('Copy Map As:', state.currentMapData.name + ' (copy)', async (newName) => {
        if (!newName || !newName.trim()) return;
        const copy = ensureMapMeta({
            id: newId(),
            name: newName.trim(),
            data: state.currentMapData.data || null,
            imageUrl: state.currentMapData.imageUrl || null,
            tokens: JSON.parse(JSON.stringify(state.currentMapData.tokens || [])),
            fogShapes: JSON.parse(JSON.stringify(state.currentMapData.fogShapes || [])),
            gridSize: state.currentMapData.gridSize || DEFAULT_GRID,
            gridMetresPerSquare: state.currentMapData.gridMetresPerSquare || 1.5,
            wallSegments: JSON.parse(JSON.stringify(state.currentMapData.wallSegments || [])),
            openingSegments: JSON.parse(JSON.stringify(state.currentMapData.openingSegments || [])),
            losEnabled: state.currentMapData.losEnabled || false,
            losDarkMap: state.currentMapData.losDarkMap || false,
            losViewDistance: state.currentMapData.losViewDistance || 30,
            canvasBgColor: state.currentMapData.canvasBgColor || '#1c1917',
            width: state.currentMapData.width || null,
            height: state.currentMapData.height || null,
            isGridVisible: state.currentMapData.isGridVisible || false,
            usageCount: 0,
            ...(state.currentMapData.campaignId ? { campaignId: state.currentMapData.campaignId } : {})
        });
        const tx = dataBase.transaction('maps', 'readwrite');
        tx.objectStore('maps').put(copy);
        tx.oncomplete = async () => {
            state.mapsList.push(copy);
            renderMapLibrary();
            syncToCloud();
        };
    });
}

// ==================== MAP OPERATIONS ====================
async function loadMap(id) {
    if (state.mapImageSrc && state.mapImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(state.mapImageSrc);
        state.mapImageSrc = null;
    }
    state.currentMapData = state.mapsList.find(m => m.id === id);
    if (!state.currentMapData) return;
    if (dom.mapSelect) dom.mapSelect.value = id;

    // Track usage metadata
    ensureMapMeta(state.currentMapData);
    state.currentMapData.lastUsed = Date.now();
    state.currentMapData.usageCount = (state.currentMapData.usageCount || 0) + 1;

    state.tokens = [];
    state.fogShapes = state.currentMapData.fogShapes || [];
    state.gridSize = state.currentMapData.gridSize || DEFAULT_GRID;
    state.waypoints = state.currentMapData.waypoints || [];
    state.wallSegments = state.currentMapData.wallSegments || [];
    state.openingSegments = state.currentMapData.openingSegments
        || [
            ...(state.currentMapData.doorSegments || []).map(d => ({ ...d, isDoor: true })),
            ...(state.currentMapData.windowSegments || []).map(w => ({ ...w, isDoor: false, isOpen: w.isOpen ?? true }))
           ];
    if (state.currentMapData.gridMetresPerSquare) state.gridMetresPerSquare = state.currentMapData.gridMetresPerSquare;
    if (state.currentMapData.isGridVisible != null) state.isGridVisible = state.currentMapData.isGridVisible;
    if (state.currentMapData.losEnabled != null)   state.losEnabled = state.currentMapData.losEnabled;
    if (state.currentMapData.losDarkMap != null)   state.losDarkMap = state.currentMapData.losDarkMap;
    if (state.currentMapData.losViewDistance != null) state.losViewDistance = state.currentMapData.losViewDistance;
    // Restore canvas background color
    if (state.currentMapData.canvasBgColor) dom.container.style.backgroundColor = state.currentMapData.canvasBgColor;
    else dom.container.style.backgroundColor = '#1c1917'; // default stone
    state.wallDrag.active = false;
    state.wallEdit.isDragging = false;
    invalidateLOSCache();
    state.transform = { x: 50, y: 50, scale: 1 };
    // Clear ruler overlay and initiative highlight on map switch
    state.rulerActive = false;
    clearRuler();
    state.tokens.forEach(t => { t._initiativeActive = false; });
    updateTransform();

    const mapSrc = await resolveMapImage(state.currentMapData);

    // Handle blank maps (no image) - create a canvas-based map
    if (!mapSrc) {
        const w = state.currentMapData.width || 1600;
        const h = state.currentMapData.height || 1200;

        // Create blank canvas for the map
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = w;
        blankCanvas.height = h;
        const ctx = blankCanvas.getContext('2d');

        // Fill with background color
        const bgColor = state.currentMapData.canvasBgColor || '#1c1917';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        // Add subtle grid pattern
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.1)'; // faint amber
        ctx.lineWidth = 1;
        const gridSize = state.gridSize;
        for (let x = 0; x <= w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Convert to blob for state
        const blob = await new Promise(resolve => blankCanvas.toBlob(resolve, 'image/png'));
        if (state.mapImageSrc && state.mapImageSrc.startsWith('blob:')) {
            URL.revokeObjectURL(state.mapImageSrc);
        }
        const blobUrl = URL.createObjectURL(blob);

        state.mapImage = blankCanvas;
        state.mapImageSrc = blobUrl;
        state.mapNaturalWidth = w;
        state.mapNaturalHeight = h;

        // Update canvases
        dom.container.style.width = w + 'px';
        dom.container.style.height = h + 'px';
        [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
            c.width = w;
            c.height = h;
        });
        updateGridDisplay();
        updateTransform();
        renderMap();
        renderGrid();
        renderTokens();
        renderFog();
        resetHistory();
        saveCurrentMap();

        // Broadcast to players
        if (bc) {
            broadcastState();
        }

        return;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            state.mapImage = img;
            const w = img.width;
            const h = img.height;
            dom.container.style.width = w + 'px';
            dom.container.style.height = h + 'px';
            [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                c.width = w;
                c.height = h;
            });
            updateGridDisplay();
            renderMapLibrary();

            const tokenData = state.currentMapData.tokens || [];
            if (tokenData.length === 0) {
                renderMap();
                renderGrid();
                renderTokens();
                renderFog();
                resetHistory();
                resolve();
                return;
            }

            let loaded = 0;
            const checkDone = () => {
                if (loaded === tokenData.length) {
                    renderMap();
                    renderGrid();
                    renderTokens();
                    renderFog();
                    resetHistory();
                    resolve();
                }
            };

            for (const td of tokenData) {
                const tImg = new Image();
                tImg.onload = () => {
                    state.tokens.push({ id: td.id, name: td.name, x: td.x, y: td.y, img: tImg, size: td.size || 1, isPC: td.isPC !== false });
                    loaded++;
                    checkDone();
                };
                tImg.onerror = () => {
                    console.warn(`Failed to load token: ${td.name}`);
                    loaded++;
                    checkDone();
                };
                let tokenSrc = td.imageUrl || td.src;
                if (typeof resolveMediaUrl === 'function' && tokenSrc && tokenSrc.includes('klasskit-media')) {
                    try { tokenSrc = await resolveMediaUrl(tokenSrc); } catch (e) {}
                }
                tImg.src = tokenSrc;
            }
        };
        img.onerror = () => {
            showAlert('Error', `Failed to load map image for "${state.currentMapData.name}".`);
            resolve();
        };
        img.src = mapSrc;
    });
}

function resetHistory() {
    state.history = [snapshotState()];
    state.historyIndex = 0;
    updateUndoRedoButtons();
}

// Player window loads map independently from IndexedDB (instead of broadcast)
// Uses in-memory cache for instant reloads and createImageBitmap for fast decoding
async function loadMapForPlayer(mapLocalId, cloudMapId, loadingEl, mapIndicatorDiv) {
    if (!dataBase) {
        console.error('[Player] IndexedDB not available');
        return;
    }

    try {
        // Yield to browser first so loading indicator renders
        await new Promise(r => requestAnimationFrame(r));

        // Try to fetch map from IndexedDB
        const map = await new Promise((resolve, reject) => {
            const tx = dataBase.transaction('maps', 'readonly');
            const store = tx.objectStore('maps');
            const req = store.get(mapLocalId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (!map) {
            console.warn('[Player] Map not found in IndexedDB:', mapLocalId);
            const mapLoadingText = mapIndicatorDiv?.querySelector('span');
            if (mapLoadingText) {
                mapLoadingText.textContent = 'Map not available';
                mapLoadingText.style.color = '#ef4444';
            }
            setTimeout(() => {
                loadingEl?.remove();
                window._playerLoadingEl = null;
            }, 2000);
            return;
        }

        let mapSrc = map.data || map.imageUrl;

        state.currentMapData = map;

        // Apply map settings immediately (don't wait for image)
        state.gridSize = map.gridSize || DEFAULT_GRID;
        state.gridMetresPerSquare = map.gridMetresPerSquare || 1.5;
        state.losEnabled = map.losEnabled || false;
        state.losDarkMap = map.losDarkMap || false;
        state.losViewDistance = map.losViewDistance || 30;
        state.isGridVisible = map.isGridVisible || false;

        // Handle blank maps (no image) - create a canvas-based map
        if (!mapSrc) {
            const w = map.width || 1600;
            const h = map.height || 1200;
            const blankCanvas = document.createElement('canvas');
            blankCanvas.width = w;
            blankCanvas.height = h;
            const ctx = blankCanvas.getContext('2d');
            const bgColor = map.canvasBgColor || '#1c1917';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.1)';
            ctx.lineWidth = 1;
            const gridSize = state.gridSize;
            for (let x = 0; x <= w; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 0; y <= h; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
            state.mapImage = blankCanvas;
            dom.container.style.width = w + 'px';
            dom.container.style.height = h + 'px';
            [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                c.width = w; c.height = h;
            });
            loadingEl?.remove();
            window._playerLoadingEl = null;
            playerDoRender();
            return;
        }

        // Check in-memory cache first (instant reload!)
        const cached = _mapImageCache.get(mapLocalId);
        if (cached && cached.image) {
            console.log('[Player] Using cached map image (instant!)');
            state.mapImage = cached.image;
            const w = cached.width, h = cached.height;
            dom.container.style.width = w + 'px';
            dom.container.style.height = h + 'px';
            [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                c.width = w; c.height = h;
            });
            loadingEl?.remove();
            window._playerLoadingEl = null;
            playerDoRender();
            return;
        }

        // Use createImageBitmap for faster off-main-thread decoding
        let img;
        try {
            if (mapSrc.startsWith('data:')) {
                // Base64 data URL - fetch as blob then decode
                const response = await fetch(mapSrc);
                const blob = await response.blob();
                // createImageBitmap decodes off-main-thread (much faster!)
                const bitmap = await createImageBitmap(blob);
                // Create an Image wrapper for compatibility with existing code
                img = new Image(bitmap.width, bitmap.height);
                img._bitmap = bitmap; // Store for drawImage
                // Override draw to use bitmap
                Object.defineProperty(img, 'src', { value: mapSrc, writable: false });
            } else {
                // Regular URL
                img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = mapSrc;
                });
            }
        } catch (decodeErr) {
            console.error('[Player] Image decode failed:', decodeErr);
            // Fallback to traditional Image loading
            img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = mapSrc;
            });
        }

        // Cache for instant future reloads
        _mapImageCache.set(mapLocalId, {
            image: img,
            width: img.width,
            height: img.height,
            timestamp: Date.now()
        });

        // Limit cache size (keep last 3 maps)
        if (_mapImageCache.size > 3) {
            const oldest = Array.from(_mapImageCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            _mapImageCache.delete(oldest[0]);
        }

        state.mapImage = img;
        const w = img.width, h = img.height;
        dom.container.style.width = w + 'px';
        dom.container.style.height = h + 'px';
        [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
            c.width = w; c.height = h;
        });

        // Remove loading overlay and render
        loadingEl?.remove();
        window._playerLoadingEl = null;
        playerDoRender();

    } catch (err) {
        console.error('[Player] Error loading map from IndexedDB:', err);
        const mapLoadingText = mapIndicatorDiv?.querySelector('p:last-child');
        if (mapLoadingText) {
            mapLoadingText.textContent = 'Error loading map';
            mapLoadingText.style.color = '#ef4444';
        }
        setTimeout(() => {
            loadingEl?.remove();
            window._playerLoadingEl = null;
        }, 1500);
    }
}

function fitMapToScreen() {
    if (!state.mapImage) return;
    const rect = dom.wrapper.getBoundingClientRect();
    const scaleX = rect.width / state.mapImage.width;
    const scaleY = rect.height / state.mapImage.height;
    // Player view fills the screen; DM view has small margin
    const margin = state.isDMMode ? 0.95 : 1.0;
    const newScale = Math.min(scaleX, scaleY) * margin;
    state.transform.scale = newScale;
    state.transform.x = (rect.width - state.mapImage.width * newScale) / 2;
    state.transform.y = (rect.height - state.mapImage.height * newScale) / 2;
    updateTransform();
}

async function rotateMap() {
    if (!state.mapImage || !state.currentMapData) return;

    const oldW = state.mapImage.width;
    const oldH = state.mapImage.height;

    // Create rotated image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = oldH;
    tempCanvas.height = oldW;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tCtx.rotate(Math.PI / 2);
    tCtx.drawImage(state.mapImage, -oldW / 2, -oldH / 2);

    // Transform tokens
    state.tokens.forEach(t => {
        const { x, y } = rotatePointCW(t.x, t.y, oldW, oldH);
        t.x = x;
        t.y = y;
    });

    // Transform fog shapes
    state.fogShapes.forEach(shape => {
        shape.points = shape.points.map(p => rotatePointCW(p.x, p.y, oldW, oldH));
    });

    // Update map data
    state.currentMapData.data = tempCanvas.toDataURL();
    state.currentMapData.tokens = state.tokens.map(t => ({
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img?.src || null, imageUrl: t.imageUrl || null, size: t.size || 1, isPC: t.isPC !== false
    }));
    state.currentMapData.fogShapes = state.fogShapes;

    saveCurrentMap();

    // If map was cloud-backed, try to re-upload rotated image to replace the old cloud file
    if (state.currentMapData.imageUrl && typeof uploadMedia === 'function') {
        try {
            const blob = await new Promise((resolve, reject) => {
                tempCanvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/webp');
            });
            const file = new File([blob], 'rotated_map.webp', { type: 'image/webp' });
            const oldUrl = state.currentMapData.imageUrl;
            const newUrl = await uploadMedia(file, 'dnd-vtt-map');
            await deleteMediaFromUrl(oldUrl).catch(() => {});
            state.currentMapData.imageUrl = newUrl;
            state.currentMapData.data = null;
            saveCurrentMap();
        } catch (e) {
            console.warn('[Cloud] Failed to upload rotated map, keeping local data URL:', e);
        }
    }

    // Reload to update image dimensions and canvas
    await loadMap(state.currentMapData.id);
    pushHistory(); // Record rotation as an undo step
}

// ==================== TOKEN LIBRARY ====================
function loadTokenLibrary() {
    const tx = dataBase.transaction('tokenLibrary', 'readonly');
    const req = tx.objectStore('tokenLibrary').getAll();
    req.onsuccess = () => {
        state.tokenLibrary = req.result || [];
        renderTokenLibrary();
    };
}

function saveTokenToLibrary(name, src, imageUrl = null) {
    const entry = { id: newId(), name, src, imageUrl };
    const tx = dataBase.transaction('tokenLibrary', 'readwrite');
    tx.objectStore('tokenLibrary').put(entry);
    tx.oncomplete = () => {
        state.tokenLibrary.push(entry);
        renderTokenLibrary();
        syncToCloud();
    };
}

function deleteTokenFromLibrary(id) {
    const tx = dataBase.transaction('tokenLibrary', 'readwrite');
    tx.objectStore('tokenLibrary').delete(id);
    tx.oncomplete = () => {
        state.tokenLibrary = state.tokenLibrary.filter(t => t.id !== id);
        renderTokenLibrary();
        syncToCloud();
    };
}

async function placeTokenFromLibrary(libToken) {
    const nameInput = dom.tokenNameInput.value || libToken.name;
    let tokenSrc = libToken.src;
    if (typeof resolveMediaUrl === 'function' && tokenSrc && tokenSrc.includes('klasskit-media')) {
        try { tokenSrc = await resolveMediaUrl(tokenSrc); } catch (e) {}
    }
    const img = new Image();
    img.onload = () => {
        const rect = dom.wrapper.getBoundingClientRect();
        const rawX = (rect.width / 2 - state.transform.x) / state.transform.scale;
        const rawY = (rect.height / 2 - state.transform.y) / state.transform.scale;
        const snapped = snapToGrid(rawX, rawY, 1);
        state.tokens.push({ id: newId(), img, name: nameInput, x: snapped.x, y: snapped.y, size: 1, imageUrl: libToken.imageUrl, isPC: true });
        renderTokens();
        pushHistory();
        saveCurrentMap();
        dom.tokenNameInput.value = '';
    };
    img.onerror = () => showAlert('Error', 'Failed to load the token image.');
    img.src = tokenSrc;
}

function renderTokenLibrary() {
    const items = dom.tokenLibGrid.querySelectorAll('.token-lib-item');
    for (const item of items) item.remove();

    dom.tokenLibEmpty.style.display = state.tokenLibrary.length === 0 ? '' : 'none';

    const frag = document.createDocumentFragment();
    for (const libToken of state.tokenLibrary) {
        const div = document.createElement('div');
        div.className = 'token-lib-item';
        div.title = libToken.name;

        const img = document.createElement('img');
        const src = libToken.src;
        if (src) {
            if (typeof resolveMediaUrl === 'function' && src.includes('klasskit-media')) {
                resolveMediaUrl(src).then(url => { if (url) img.src = url; });
            } else {
                img.src = src;
            }
        }
        img.alt = libToken.name || 'Token';
        img.loading = 'lazy';
        div.appendChild(img);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'lib-name';
        nameSpan.textContent = libToken.name;
        div.appendChild(nameSpan);

        const del = document.createElement('span');
        del.className = 'lib-delete';
        del.textContent = '×';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTokenFromLibrary(libToken.id);
        });
        div.appendChild(del);

        div.addEventListener('click', () => placeTokenFromLibrary(libToken));
        frag.appendChild(div);
    }
    dom.tokenLibGrid.appendChild(frag);
    lucide.createIcons();
}

// ==================== MAP TEMPLATE LIBRARY ====================
function loadMapTemplateLibrary() {
    const tx = dataBase.transaction('mapTemplates', 'readonly');
    const req = tx.objectStore('mapTemplates').getAll();
    req.onsuccess = () => {
        state.mapTemplateLibrary = req.result || [];
        renderMapTemplateLibrary();
    };
}

function saveMapAsTemplate(name) {
    if (!state.currentMapData) { showAlert('No Map', 'No map is currently loaded.'); return; }
    const template = {
        id: newId(),
        name: name || `${state.currentMapData.name} (Template)`,
        gridSize: state.currentMapData.gridSize,
        gridMetres: state.currentMapData.gridMetres,
        wallSegments: [...state.currentMapData.wallSegments || []],
        openingSegments: [...state.currentMapData.openingSegments || []],
        losEnabled: state.currentMapData.losEnabled || false,
        losDarkMap: state.currentMapData.losDarkMap || false,
        losViewDistance: state.currentMapData.losViewDistance || 30,
        canvasBgColor: state.currentMapData.canvasBgColor || '#1c1917',
        createdAt: Date.now()
    };
    const tx = dataBase.transaction('mapTemplates', 'readwrite');
    tx.objectStore('mapTemplates').put(template);
    tx.oncomplete = () => {
        state.mapTemplateLibrary.push(template);
        renderMapTemplateLibrary();
        showAlert('Template Saved', `Map template "${template.name}" saved successfully.`);
    };
}

function deleteMapTemplate(id) {
    const tx = dataBase.transaction('mapTemplates', 'readwrite');
    tx.objectStore('mapTemplates').delete(id);
    tx.oncomplete = () => {
        state.mapTemplateLibrary = state.mapTemplateLibrary.filter(t => t.id !== id);
        renderMapTemplateLibrary();
    };
}

function instantiateFromTemplate(templateId) {
    const template = state.mapTemplateLibrary.find(t => t.id === templateId);
    if (!template) { showAlert('Template Not Found', 'Could not find the selected template.'); return; }

    // Create a new map based on the template
    const newMapId = newId();
    const timestamp = Date.now();
    const mapData = {
        id: newMapId,
        name: `${template.name} (Copy)`,
        gridSize: template.gridSize,
        gridMetres: template.gridMetres,
        canvasBgColor: template.canvasBgColor || '#1c1917',
        wallSegments: [...template.wallSegments || []],
        openingSegments: [...template.openingSegments || []],
        tokens: [],
        fogPolygons: [],
        losEnabled: template.losEnabled || false,
        losDarkMap: template.losDarkMap || false,
        losViewDistance: template.losViewDistance || 30,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(state.activeCampaignId ? { campaignId: state.activeCampaignId } : {})
    };

    // Save to database
    const tx = dataBase.transaction('maps', 'readwrite');
    tx.objectStore('maps').put(mapData);
    tx.oncomplete = () => {
        state.mapsList.push(mapData);
        state.currentMapId = newMapId;
        state.currentMapData = mapData;
        loadMap(newMapId);
        renderMapLibrary();
        saveCurrentMap();
        syncToCloud();
        showAlert('Map Created', `New map created from template "${template.name}".`);
    };
}

function renderMapTemplateLibrary() {
    const items = dom.mapTemplateGrid?.querySelectorAll('.map-template-item');
    if (items) for (const item of items) item.remove();

    if (!dom.mapTemplateGrid) return;
    dom.mapTemplateEmpty.style.display = state.mapTemplateLibrary.length === 0 ? '' : 'none';

    const frag = document.createDocumentFragment();
    for (const template of state.mapTemplateLibrary) {
        const div = document.createElement('div');
        div.className = 'map-template-item group relative p-2 rounded-lg bg-stone-800 hover:bg-stone-700 cursor-pointer transition-colors';
        div.dataset.id = template.id;
        div.title = template.name;
        div.innerHTML = `
            <div class="w-full aspect-video bg-stone-900 rounded mb-2 flex items-center justify-center overflow-hidden">
                <i data-lucide="map" class="w-8 h-8 text-stone-600"></i>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-xs text-stone-300 truncate flex-1">${template.name}</span>
                <button class="btn-delete-template opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded transition-all" data-id="${template.id}" title="Delete template">
                    <i data-lucide="trash-2" class="w-3 h-3 text-red-400"></i>
                </button>
            </div>
        `;
        // Click to instantiate
        div.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-template')) return;
            instantiateFromTemplate(template.id);
        });
        // Delete button
        const delBtn = div.querySelector('.btn-delete-template');
        delBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmAction('Delete Template', `Delete "${template.name}"?`, () => deleteMapTemplate(template.id));
        });
        frag.appendChild(div);
    }
    dom.mapTemplateGrid.appendChild(frag);
    lucide.createIcons();
}


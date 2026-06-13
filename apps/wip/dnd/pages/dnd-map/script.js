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
const DB_VERSION = 2;
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
    FOG_TOGGLE: 'fog-toggle'
};

// DOM element shortcuts
const $ = id => document.getElementById(id);

// ==================== STATE MANAGEMENT ====================
const state = {
    // UI mode
    isDMMode: true,
    currentTool: TOOLS.DRAG,

    // Map data
    mapsList: [],
    currentMapData: null,
    mapImage: null,

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
    isDrawing: false,
    currentDrawPoints: [],
    lastTapTime: 0,
    pointerMoved: false,
    longPressTimer: null,
    mousePos: null,

    // Undo/redo
    history: [],
    historyIndex: -1,

    // Token library
    tokenLibrary: [],

    // Player mode tool: 'move' | 'pan' | 'fog'
    playerTool: 'move',

    // Grid visibility
    isGridVisible: false
};

// ==================== DOM CACHE ====================
const dom = {
    wrapper: $('canvas-wrapper'),
    container: $('canvas-container'),
    mapCanvas: $('layer-map'),
    gridCanvas: $('layer-grid'),
    tokenCanvas: $('layer-token'),
    fogCanvas: $('layer-fog'),
    mapCtx: $('layer-map').getContext('2d'),
    gridCtx: $('layer-grid').getContext('2d'),
    tokenCtx: $('layer-token').getContext('2d'),
    fogCtx: $('layer-fog').getContext('2d'),
    btnUndo: $('btn-undo'),
    btnRedo: $('btn-redo'),
    modeToggle: $('mode-toggle'),
    sidebar: $('dm-sidebar'),
    mapSelect: $('map-select'),
    gridSizeInput: $('grid-size-input'),
    gridSizeValue: $('grid-size-value'),
    ctxMenu: $('token-context-menu'),
    tokenLibGrid: $('token-library-grid'),
    tokenLibEmpty: $('token-library-empty'),
    modal: $('custom-modal'),
    modalTitle: $('modal-title'),
    modalMessage: $('modal-message'),
    modalInput: $('modal-input'),
    modalCancel: $('modal-cancel'),
    modalConfirm: $('modal-confirm'),
    tokenNameInput: $('token-name')
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
    const ping = document.createElement('div');
    ping.className = 'ping-ring';
    ping.style.left = rawPos.rawX + 'px';
    ping.style.top = rawPos.rawY + 'px';
    dom.wrapper.appendChild(ping);
    setTimeout(() => ping.remove(), 1000);
}

// Rotate a point 90° clockwise around (0,0) in a w×h space
function rotatePointCW(x, y, w, h) {
    return { x: h - y, y: x };
}

// ==================== MODAL SYSTEM ====================
let modalCallback = null;

function closeModal() {
    dom.modal.classList.add('hidden');
    dom.modalInput.classList.add('hidden');
    dom.modalMessage.classList.add('hidden');
    dom.modalCancel.classList.add('hidden');
    dom.modalInput.value = '';
}

function showAlert(title, message) {
    closeModal();
    dom.modalTitle.innerText = title;
    dom.modalMessage.innerText = message;
    dom.modalMessage.classList.remove('hidden');
    dom.modal.classList.remove('hidden');
    modalCallback = null;
}

function showPrompt(title, defaultValue, callback) {
    closeModal();
    dom.modalTitle.innerText = title;
    dom.modalInput.value = defaultValue || '';
    dom.modalInput.classList.remove('hidden');
    dom.modalCancel.classList.remove('hidden');
    dom.modal.classList.remove('hidden');
    dom.modalInput.focus();
    modalCallback = callback;
}

function showConfirm(title, message, callback) {
    closeModal();
    dom.modalTitle.innerText = title;
    dom.modalMessage.innerText = message;
    dom.modalMessage.classList.remove('hidden');
    dom.modalCancel.classList.remove('hidden');
    dom.modal.classList.remove('hidden');
    modalCallback = () => callback(true);
}

dom.modalCancel.onclick = closeModal;
dom.modalConfirm.onclick = () => {
    const val = dom.modalInput.value;
    const cb = modalCallback;
    closeModal();
    if (cb) cb(val);
};

// ==================== RENDERING (rAF BATCHED) ====================
let renderFlags = { map: false, grid: false, tokens: false, fog: false };
let renderScheduled = false;

function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        if (renderFlags.map) renderMapNow();
        if (renderFlags.grid) renderGridNow();
        if (renderFlags.tokens) renderTokensNow();
        if (renderFlags.fog) renderFogNow();
        renderFlags = { map: false, grid: false, tokens: false, fog: false };
        renderScheduled = false;
    });
}

function renderMap() { renderFlags.map = true; scheduleRender(); }
function renderGrid() { renderFlags.grid = true; scheduleRender(); }
function renderTokens() { renderFlags.tokens = true; scheduleRender(); }
function renderFog() { renderFlags.fog = true; scheduleRender(); }

function renderMapNow() {
    if (!state.mapImage) return;
    dom.mapCtx.clearRect(0, 0, dom.mapCanvas.width, dom.mapCanvas.height);
    dom.mapCtx.drawImage(state.mapImage, 0, 0);
}

function renderGridNow() {
    dom.gridCtx.clearRect(0, 0, dom.gridCanvas.width, dom.gridCanvas.height);
    if (!state.isGridVisible || !state.mapImage) return;

    dom.gridCtx.strokeStyle = 'rgba(0, 0, 0, 1.0)';
    dom.gridCtx.lineWidth = 2;
    dom.gridCtx.beginPath();

    const w = dom.gridCanvas.width;
    const h = dom.gridCanvas.height;
    for (let x = 0; x <= w; x += state.gridSize) {
        dom.gridCtx.moveTo(x, 0);
        dom.gridCtx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += state.gridSize) {
        dom.gridCtx.moveTo(0, y);
        dom.gridCtx.lineTo(w, y);
    }
    dom.gridCtx.stroke();
}

function renderTokensNow() {
    dom.tokenCtx.clearRect(0, 0, dom.tokenCanvas.width, dom.tokenCanvas.height);
    const sizeLabels = { 2: 'L', 3: 'H', 4: 'G' };

    for (const t of state.tokens) {
        const tSize = (t.size || 1) * state.gridSize;
        const radius = tSize / 2;

        // Clip and draw image
        dom.tokenCtx.save();
        dom.tokenCtx.beginPath();
        dom.tokenCtx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        dom.tokenCtx.clip();
        dom.tokenCtx.drawImage(t.img, t.x - radius, t.y - radius, tSize, tSize);
        dom.tokenCtx.restore();

        // Border
        dom.tokenCtx.strokeStyle = '#d97706';
        dom.tokenCtx.lineWidth = 3;
        dom.tokenCtx.beginPath();
        dom.tokenCtx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        dom.tokenCtx.stroke();

        // Size badge
        if ((t.size || 1) > 1) {
            const label = sizeLabels[t.size] || '';
            dom.tokenCtx.fillStyle = 'rgba(217, 119, 6, 0.9)';
            dom.tokenCtx.beginPath();
            dom.tokenCtx.arc(t.x + radius - 8, t.y - radius + 8, 10, 0, Math.PI * 2);
            dom.tokenCtx.fill();
            dom.tokenCtx.fillStyle = '#fff';
            dom.tokenCtx.font = 'bold 11px Cinzel, serif';
            dom.tokenCtx.textAlign = 'center';
            dom.tokenCtx.textBaseline = 'middle';
            dom.tokenCtx.fillText(label, t.x + radius - 8, t.y - radius + 8);
        }

        // Name label
        if (t.name) {
            dom.tokenCtx.fillStyle = 'rgba(12, 10, 9, 0.9)';
            dom.tokenCtx.font = '12px Lora, serif';
            const textWidth = dom.tokenCtx.measureText(t.name).width;
            dom.tokenCtx.beginPath();
            dom.tokenCtx.roundRect(t.x - textWidth / 2 - 6, t.y + radius + 4, textWidth + 12, 20, 4);
            dom.tokenCtx.fill();
            dom.tokenCtx.strokeStyle = '#78350f';
            dom.tokenCtx.lineWidth = 1;
            dom.tokenCtx.stroke();
            dom.tokenCtx.fillStyle = '#fde68a';
            dom.tokenCtx.textAlign = 'center';
            dom.tokenCtx.fillText(t.name, t.x, t.y + radius + 18);
        }
    }
}

function renderFogNow() {
    dom.fogCtx.clearRect(0, 0, dom.fogCanvas.width, dom.fogCanvas.height);
    for (const shape of state.fogShapes) {
        if (shape.isHidden || state.isDMMode) {
            dom.fogCtx.beginPath();
            dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
            for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
            dom.fogCtx.closePath();
            if (shape.isHidden) {
                dom.fogCtx.fillStyle = state.isDMMode ? 'rgba(0,0,0,0.6)' : '#000000';
                dom.fogCtx.fill();
            } else if (state.isDMMode) {
                dom.fogCtx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
                dom.fogCtx.lineWidth = 2;
                dom.fogCtx.stroke();
            }
        }
    }

    // Drawing preview
    if (state.isDrawing && state.currentDrawPoints.length > 0) {
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(state.currentDrawPoints[0].x, state.currentDrawPoints[0].y);
        for (const p of state.currentDrawPoints) dom.fogCtx.lineTo(p.x, p.y);
        if (state.mousePos) {
            dom.fogCtx.lineTo(state.mousePos.x, state.mousePos.y);
        }

        dom.fogCtx.strokeStyle = '#d97706';
        dom.fogCtx.setLineDash([5, 5]);
        dom.fogCtx.lineWidth = 2;
        dom.fogCtx.stroke();
        dom.fogCtx.setLineDash([]);

        // Draw vertices
        dom.fogCtx.fillStyle = '#d97706';
        for (const p of state.currentDrawPoints) {
            dom.fogCtx.beginPath();
            dom.fogCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            dom.fogCtx.fill();
        }
    }
}

// Helper for roundRect (used in token rendering) - only polyfill if missing
if (!CanvasRenderingContext2D.prototype.roundRect) {
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
};
}

// ==================== UNDO/REDO ====================
function snapshotState() {
    return {
        tokens: state.tokens.map(t => ({
            id: t.id,
            name: t.name,
            x: t.x,
            y: t.y,
            src: t.imageUrl || t.img.src,
            imageUrl: t.imageUrl || null,
            size: t.size || 1
        })),
        fogShapes: JSON.parse(JSON.stringify(state.fogShapes)),
        gridSize: state.gridSize
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
}

function restoreSnapshot(snap) {
    state.fogShapes = JSON.parse(JSON.stringify(snap.fogShapes));
    state.gridSize = snap.gridSize;
    dom.gridSizeInput.value = state.gridSize;
    dom.gridSizeValue.textContent = state.gridSize;
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
let db;

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('maps')) {
            db.createObjectStore('maps', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tokenLibrary')) {
            db.createObjectStore('tokenLibrary', { keyPath: 'id' });
        }
    };
    request.onsuccess = async (e) => {
        db = e.target.result;
        await new Promise((resolve) => {
            const tx = db.transaction('maps', 'readonly');
            const req = tx.objectStore('maps').getAll();
            req.onsuccess = () => {
                state.mapsList = req.result || [];
                updateMapDropdown();
                resolve();
            };
        });
        loadTokenLibrary();
        await syncFromCloud();
        if (state.mapsList.length > 0 && !state.currentMapData) {
            await loadMap(state.mapsList[0].id);
        }
    };
    request.onerror = () => showAlert('Database Error', 'Failed to open IndexedDB');
}

function saveCurrentMap() {
    if (!state.currentMapData || !db) return;
    state.currentMapData.tokens = state.tokens.map(t => ({
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img.src, imageUrl: t.imageUrl || null, size: t.size || 1
    }));
    state.currentMapData.fogShapes = state.fogShapes;
    state.currentMapData.gridSize = state.gridSize;
    try {
        const tx = db.transaction('maps', 'readwrite');
        tx.onerror = () => console.warn('IndexedDB save failed');
        tx.objectStore('maps').put(state.currentMapData);
    } catch (e) {
        console.warn('IndexedDB save error:', e);
    }
    syncToCloud();
}

function loadMapList() {
    const tx = db.transaction('maps', 'readonly');
    const req = tx.objectStore('maps').getAll();
    req.onsuccess = () => {
        state.mapsList = req.result || [];
        updateMapDropdown();
    };
}

function updateMapDropdown() {
    dom.mapSelect.innerHTML = '<option value="">-- Select Map --</option>';
    const frag = document.createDocumentFragment();
    state.mapsList.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        frag.appendChild(opt);
    });
    dom.mapSelect.appendChild(frag);
    dom.mapSelect.value = state.currentMapData ? state.currentMapData.id : '';
}

// ==================== MAP OPERATIONS ====================
async function loadMap(id) {
    state.currentMapData = state.mapsList.find(m => m.id === id);
    if (!state.currentMapData) return;
    dom.mapSelect.value = id;

    state.tokens = [];
    state.fogShapes = state.currentMapData.fogShapes || [];
    state.gridSize = state.currentMapData.gridSize || DEFAULT_GRID;
    dom.gridSizeInput.value = state.gridSize;
    dom.gridSizeValue.textContent = state.gridSize;
    state.transform = { x: 50, y: 50, scale: 1 };
    updateTransform();

    const mapSrc = await resolveMapImage(state.currentMapData);
    if (!mapSrc) {
        showAlert('Error', `No image data for map "${state.currentMapData.name}".`);
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
            [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas].forEach(c => {
                c.width = w;
                c.height = h;
            });

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
                    state.tokens.push({ id: td.id, name: td.name, x: td.x, y: td.y, img: tImg, size: td.size || 1 });
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

function fitMapToScreen() {
    if (!state.mapImage) return;
    const rect = dom.wrapper.getBoundingClientRect();
    const scaleX = rect.width / state.mapImage.width;
    const scaleY = rect.height / state.mapImage.height;
    const newScale = Math.min(scaleX, scaleY) * 0.95;
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
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img.src, imageUrl: t.imageUrl || null, size: t.size || 1
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
    const tx = db.transaction('tokenLibrary', 'readonly');
    const req = tx.objectStore('tokenLibrary').getAll();
    req.onsuccess = () => {
        state.tokenLibrary = req.result || [];
        renderTokenLibrary();
    };
}

function saveTokenToLibrary(name, src, imageUrl = null) {
    const entry = { id: Date.now(), name, src, imageUrl };
    const tx = db.transaction('tokenLibrary', 'readwrite');
    tx.objectStore('tokenLibrary').put(entry);
    tx.oncomplete = () => {
        state.tokenLibrary.push(entry);
        renderTokenLibrary();
        syncToCloud();
    };
}

function deleteTokenFromLibrary(id) {
    const tx = db.transaction('tokenLibrary', 'readwrite');
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
        const viewX = (rect.width / 2 - state.transform.x) / state.transform.scale;
        const viewY = (rect.height / 2 - state.transform.y) / state.transform.scale;
        state.tokens.push({ id: Date.now(), img, name: nameInput, x: viewX, y: viewY, size: 1, imageUrl: libToken.imageUrl });
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
        if (typeof resolveMediaUrl === 'function' && src && src.includes('klasskit-media')) {
            resolveMediaUrl(src).then(url => { img.src = url; });
        } else {
            img.src = src;
        }
        img.alt = libToken.name;
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

// ==================== TRANSFORM UPDATE ====================
let transformDirty = false;
function updateTransform() {
    if (transformDirty) return;
    transformDirty = true;
    requestAnimationFrame(() => {
        dom.container.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;
        transformDirty = false;
    });
}

// ==================== TOOL SELECTION ====================
const toolButtons = {
    drag: 'tool-drag',
    pan: 'tool-pan',
    'fog-draw': 'tool-fog-draw',
    'fog-rect': 'tool-fog-rect',
    'fog-erase': 'tool-fog-erase',
    'fog-toggle': 'tool-fog-toggle'
};

function setTool(tool) {
    state.currentTool = tool;
    // Remove ring from all tool buttons
    Object.values(toolButtons).forEach(id => {
        $(id)?.classList.remove('ring-2', 'ring-amber-500');
    });
    // Add ring to current
    const btnId = toolButtons[tool];
    if (btnId) $(btnId)?.classList.add('ring-2', 'ring-amber-500');
}

// ==================== PLAYER TOOL SELECTION ====================
const playerToolButtons = {
    move: 'player-tool-move',
    pan: 'player-tool-pan',
    fog: 'player-tool-fog'
};

function setPlayerTool(tool) {
    state.playerTool = tool;
    Object.values(playerToolButtons).forEach(id => {
        const el = $(id);
        if (!el) return;
        el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-700', 'text-stone-100', 'border-amber-700/60');
        el.classList.add('bg-stone-800', 'text-stone-300', 'border-stone-600');
    });
    const activeEl = $(playerToolButtons[tool]);
    if (activeEl) {
        activeEl.classList.remove('bg-stone-800', 'text-stone-300', 'border-stone-600');
        activeEl.classList.add('ring-2', 'ring-amber-400', 'bg-amber-700', 'text-stone-100', 'border-amber-700/60');
    }
    const hints = {
        move: 'Drag tokens to move them',
        pan: 'Drag the map to explore',
        fog: 'Tap a dark area to reveal it'
    };
    const hintEl = $('player-tool-hint');
    if (hintEl) hintEl.textContent = hints[tool] || '';
}

// ==================== POINTER EVENT HANDLERS ====================
function onPointerDown(e) {
    if (e.button === 2) return; // Right click handled by contextmenu

    state.pointerMoved = false;
    hideContextMenu();
    state.activePointers.set(e.pointerId, e);
    dom.fogCanvas.setPointerCapture(e.pointerId);

    // Two-finger pinch start
    if (state.activePointers.size === 2) {
        state.isDrawing = false;
        state.activeToken = null;
        state.isPanning = false;
        clearLongPressTimer();
        const pts = Array.from(state.activePointers.values());
        state.lastPinchDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        state.lastPointerCenter = {
            x: (pts[0].clientX + pts[1].clientX) / 2,
            y: (pts[0].clientY + pts[1].clientY) / 2
        };
        return;
    }

    const pos = getPointerPos(e);
    state.lastPointerCenter = { x: e.clientX, y: e.clientY };

    // Pan with middle mouse button, pan tool, or player pan mode
    if (e.button === 1 || state.currentTool === TOOLS.PAN ||
        (!state.isDMMode && state.playerTool === 'pan')) {
        state.isPanning = true;
        return;
    }

    // Token detection: DM drag tool OR player move tool
    const canMoveTokens = (state.isDMMode && state.currentTool === TOOLS.DRAG) ||
                          (!state.isDMMode && state.playerTool === 'move');
    let tokenHit = null;
    if (canMoveTokens) {
        for (let i = state.tokens.length - 1; i >= 0; i--) {
            const t = state.tokens[i];
            const radius = ((t.size || 1) * state.gridSize) / 2;
            if (Math.hypot(pos.x - t.x, pos.y - t.y) < radius) {
                tokenHit = t;
                state.activeToken = tokenHit;
                break;
            }
        }
    }

    // If no token hit and in move/drag mode, fallback to pan
    if (!tokenHit && canMoveTokens && e.button !== 2) {
        state.isPanning = true;
        return;
    }

    // Long press for context menu (only if token hit) or ping
    state.longPressTimer = setTimeout(() => {
        state.longPressTimer = null;
        if (tokenHit && state.isDMMode) {
            showContextMenu(e.clientX, e.clientY, tokenHit);
        } else if (!tokenHit) {
            createPing(pos);
        }
        state.activeToken = null; // Deselect if it was selected
    }, LONG_PRESS_MS);

    // If token hit, we're done here (drag will start later)
    if (tokenHit) return;

    // Fog drawing tools (DM only)
    if (!state.isDMMode) return;

    switch (state.currentTool) {
        case TOOLS.FOG_DRAW:
            handleFogDrawStart(pos);
            break;
        case TOOLS.FOG_RECT:
            state.isDrawing = true;
            state.currentDrawPoints = [pos];
            renderFog();
            break;
        case TOOLS.FOG_TOGGLE:
            processFogTap(pos);
            break;
        case TOOLS.FOG_ERASE:
            processFogErase(pos);
            break;
    }
}

function handleFogDrawStart(pos) {
    const now = Date.now();
    if (now - state.lastTapTime < DOUBLE_TAP_MS) {
        // Double tap -> finish polygon
        if (state.currentDrawPoints.length > 2) {
            finishPolygonDrawing();
        }
        state.lastTapTime = 0;
        return;
    }
    state.lastTapTime = now;

    if (!state.isDrawing) {
        state.isDrawing = true;
        state.currentDrawPoints = [pos];
    } else {
        // Check if clicking near start to close
        const startPos = state.currentDrawPoints[0];
        if (Math.hypot(pos.x - startPos.x, pos.y - startPos.y) < 15 / state.transform.scale
            && state.currentDrawPoints.length > 2) {
            finishPolygonDrawing();
        } else {
            state.currentDrawPoints.push(pos);
        }
    }
    renderFog();
}

function finishPolygonDrawing() {
    state.isDrawing = false;
    if (state.currentDrawPoints.length > 2) {
        state.fogShapes.push({ id: Date.now(), points: [...state.currentDrawPoints], isHidden: true });
        pushHistory();
        saveCurrentMap();
    }
    state.currentDrawPoints = [];
    renderFog();
}

function onPointerMove(e) {
    if (!state.activePointers.has(e.pointerId)) return;
    state.activePointers.set(e.pointerId, e);
    state.mousePos = getPointerPos(e);

    if (state.activePointers.size === 2) {
        handlePinchMove(e);
        return;
    }

    // Single pointer
    if (Math.hypot(e.clientX - state.lastPointerCenter.x, e.clientY - state.lastPointerCenter.y) > MOVE_THRESHOLD) {
        state.pointerMoved = true;
        clearLongPressTimer();
    }

    if (state.isPanning) {
        state.transform.x += e.clientX - state.lastPointerCenter.x;
        state.transform.y += e.clientY - state.lastPointerCenter.y;
        state.lastPointerCenter = { x: e.clientX, y: e.clientY };
        updateTransform();
        return;
    }

    if (state.activeToken) {
        state.activeToken.x = state.mousePos.x;
        state.activeToken.y = state.mousePos.y;
        renderTokens();
    } else if (state.isDMMode && state.isDrawing) {
        if (state.currentTool === TOOLS.FOG_DRAW) {
            renderFog(); // Preview line
        } else if (state.currentTool === TOOLS.FOG_RECT) {
            const start = state.currentDrawPoints[0];
            state.currentDrawPoints = [
                start,
                { x: state.mousePos.x, y: start.y },
                { x: state.mousePos.x, y: state.mousePos.y },
                { x: start.x, y: state.mousePos.y }
            ];
            renderFog();
        }
    }
}

function handlePinchMove(e) {
    const pts = Array.from(state.activePointers.values());
    const currentDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
    const currentCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
    };

    if (state.lastPinchDist && state.lastPointerCenter) {
        // Pan
        state.transform.x += currentCenter.x - state.lastPointerCenter.x;
        state.transform.y += currentCenter.y - state.lastPointerCenter.y;

        // Zoom
        const zoom = currentDist / state.lastPinchDist;
        let newScale = state.transform.scale * zoom;
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        state.transform.x = currentCenter.x - (currentCenter.x - state.transform.x) * (newScale / state.transform.scale);
        state.transform.y = currentCenter.y - (currentCenter.y - state.transform.y) * (newScale / state.transform.scale);
        state.transform.scale = newScale;
        updateTransform();
    }

    state.lastPinchDist = currentDist;
    state.lastPointerCenter = currentCenter;
}

function onPointerUp(e) {
    const wasTap = !state.pointerMoved && state.activePointers.size === 1;

    state.activePointers.delete(e.pointerId);
    dom.fogCanvas.releasePointerCapture(e.pointerId);
    clearLongPressTimer();

    if (state.activePointers.size < 2) state.lastPinchDist = null;
    if (state.activePointers.size === 0) state.isPanning = false;

    if (state.activePointers.size === 1) {
        const remaining = Array.from(state.activePointers.values())[0];
        state.lastPointerCenter = { x: remaining.clientX, y: remaining.clientY };
    }

    if (state.activeToken) {
        state.activeToken = null;
        pushHistory();
        saveCurrentMap();
    } else if (state.isDMMode && state.isDrawing && state.currentTool === TOOLS.FOG_RECT) {
        // Finish rectangle
        state.isDrawing = false;
        if (state.currentDrawPoints.length === 4) {
            state.fogShapes.push({ id: Date.now(), points: state.currentDrawPoints, isHidden: true });
            pushHistory();
            saveCurrentMap();
        }
        state.currentDrawPoints = [];
        renderFog();
    } else if (!state.isDMMode && wasTap && state.playerTool === 'fog') {
        // Player tap to reveal fog (only in fog tool mode)
        const pos = getPointerPos(e);
        processFogTapPlayer(pos);
    }
}

function clearLongPressTimer() {
    if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
    }
}

// ==================== FOG UTILITIES ====================
function processFogTap(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            shape.isHidden = !shape.isHidden;
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

function processFogErase(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            state.fogShapes.splice(i, 1);
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

function processFogTapPlayer(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        if (!shape.isHidden) continue;
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            shape.isHidden = false;
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

// ==================== CONTEXT MENU ====================
let ctxTargetToken = null;

function showContextMenu(x, y, token) {
    ctxTargetToken = token;
    dom.ctxMenu.style.left = x + 'px';
    dom.ctxMenu.style.top = y + 'px';
    dom.ctxMenu.classList.remove('hidden');
    requestAnimationFrame(() => {
        const menuRect = dom.ctxMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            dom.ctxMenu.style.left = (x - menuRect.width) + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
            dom.ctxMenu.style.top = (y - menuRect.height) + 'px';
        }
    });
}

function hideContextMenu() {
    dom.ctxMenu.classList.add('hidden');
    ctxTargetToken = null;
}

// ==================== UI EVENT LISTENERS ====================
function initUI() {
    // Mode toggle
    dom.modeToggle.addEventListener('click', () => {
        state.isDMMode = !state.isDMMode;
        const btn = dom.modeToggle;
        btn.classList.remove('bg-amber-700', 'hover:bg-amber-600', 'bg-stone-700', 'hover:bg-stone-600');
        const playerToolbar = $('player-toolbar');

        if (state.isDMMode) {
            dom.sidebar.style.display = 'flex';
            btn.innerHTML = `<i data-lucide="user" class="w-4 h-4"></i> Enter Player View`;
            btn.classList.add('bg-amber-700', 'hover:bg-amber-600');
            if (playerToolbar) playerToolbar.classList.add('hidden');
        } else {
            dom.sidebar.style.display = 'none';
            btn.innerHTML = `<i data-lucide="shield" class="w-4 h-4"></i> Enter DM View`;
            btn.classList.add('bg-stone-700', 'hover:bg-stone-600');
            fitMapToScreen(); // Auto-center when entering player view
            if (playerToolbar) playerToolbar.classList.remove('hidden');
            setPlayerTool('move'); // Reset to move tool on entering player view
        }
        lucide.createIcons();
        renderFog();
    });

    // Player tool buttons
    $('player-tool-move')?.addEventListener('click', () => setPlayerTool('move'));
    $('player-tool-pan')?.addEventListener('click', () => setPlayerTool('pan'));
    $('player-tool-fog')?.addEventListener('click', () => setPlayerTool('fog'));

    // Tool buttons
    $('tool-drag').addEventListener('click', () => setTool(TOOLS.DRAG));
    $('tool-pan').addEventListener('click', () => setTool(TOOLS.PAN));
    $('tool-fog-draw').addEventListener('click', () => setTool(TOOLS.FOG_DRAW));
    $('tool-fog-rect').addEventListener('click', () => setTool(TOOLS.FOG_RECT));
    $('tool-fog-erase').addEventListener('click', () => setTool(TOOLS.FOG_ERASE));
    $('tool-fog-toggle').addEventListener('click', () => setTool(TOOLS.FOG_TOGGLE));
    $('tool-grid-toggle').addEventListener('click', () => {
        state.isGridVisible = !state.isGridVisible;
        renderGrid();
    });

    // Grid size
    dom.gridSizeInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.gridSize = isNaN(val) ? DEFAULT_GRID : Math.min(Math.max(val, GRID_MIN), GRID_MAX);
        dom.gridSizeValue.textContent = state.gridSize;
        renderGrid();
        renderTokens();
        if (state.currentMapData) {
            state.currentMapData.gridSize = state.gridSize;
            saveCurrentMap();
        }
        // Note: grid size change not added to history automatically.
        // Could pushHistory() here, but that might be too frequent.
        // Instead, we could add a debounced history entry, but for simplicity, leave as is.
    });

    // Fit map
    $('btn-fit-map').addEventListener('click', fitMapToScreen);

    // Rotate map
    $('btn-rotate-map').addEventListener('click', rotateMap);

    // Delete map
    $('btn-delete-map').addEventListener('click', () => {
        if (!state.currentMapData) {
            showAlert('No Map', 'No map is currently selected.');
            return;
        }
        showConfirm('Delete Map', `Delete "${state.currentMapData.name}"?`, async () => {
            const id = state.currentMapData.id;
            const cloudId = state.currentMapData.cloudId;
            if (cloudId && typeof deleteDndSave === 'function') {
                await deleteDndSave(cloudId).catch(e => console.warn('[Cloud] Failed to delete map:', e));
            }
            const tx = db.transaction('maps', 'readwrite');
            tx.objectStore('maps').delete(id);
            tx.oncomplete = () => {
                state.mapsList = state.mapsList.filter(m => m.id !== id);
                state.currentMapData = null;
                state.mapImage = null;
                state.tokens = [];
                state.fogShapes = [];
                [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas].forEach(c => {
                    c.getContext('2d').clearRect(0, 0, c.width, c.height);
                });
                updateMapDropdown();
                if (state.mapsList.length > 0) loadMap(state.mapsList[0].id);
                else showAlert('Deleted', 'Map removed.');
            };
        });
    });

    // Map select
    dom.mapSelect.addEventListener('change', async (e) => {
        if (e.target.value) {
            saveCurrentMap();
            await loadMap(parseInt(e.target.value, 10));
        }
    });

    // Map upload
    $('map-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        showPrompt('Name this map:', defaultName, async (mapName) => {
            if (!mapName) return;
            let imageUrl = null;
            let dataSrc = null;
            if (typeof uploadMedia === 'function') {
                try {
                    imageUrl = await uploadMedia(file, 'dnd-vtt-map');
                } catch (err) {
                    console.warn('[Cloud] Map upload failed, falling back to local:', err);
                }
            }
            if (!imageUrl) {
                dataSrc = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
            }
            const newMap = {
                id: Date.now(),
                name: mapName,
                data: dataSrc,
                imageUrl: imageUrl,
                tokens: [],
                fogShapes: [],
                gridSize: state.gridSize
            };
            saveCurrentMap(); // Save current before switching
            const tx = db.transaction('maps', 'readwrite');
            tx.objectStore('maps').put(newMap);
            tx.oncomplete = () => {
                state.mapsList.push(newMap);
                updateMapDropdown();
                loadMap(newMap.id);
            };
        });
        e.target.value = '';
    });

    // Token upload & place
    $('token-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const nameInput = dom.tokenNameInput.value;
        if (!file) return;
        const defaultName = nameInput || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        let imageUrl = null;
        let dataSrc = null;
        if (typeof uploadMedia === 'function') {
            try {
                imageUrl = await uploadMedia(file, 'dnd-vtt-token');
            } catch (err) {
                console.warn('[Cloud] Token upload failed, falling back to local:', err);
            }
        }
        if (!imageUrl) {
            dataSrc = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
        }
        const src = imageUrl || dataSrc;
        saveTokenToLibrary(defaultName, src, imageUrl);
        const img = new Image();
        img.onload = () => {
            const rect = dom.wrapper.getBoundingClientRect();
            const viewX = (rect.width / 2 - state.transform.x) / state.transform.scale;
            const viewY = (rect.height / 2 - state.transform.y) / state.transform.scale;
            state.tokens.push({ id: Date.now(), img, name: defaultName, x: viewX, y: viewY, size: 1, imageUrl: imageUrl });
            renderTokens();
            pushHistory();
            saveCurrentMap();
        };
        img.onerror = () => showAlert('Error', 'Failed to load token.');
        img.src = src;
        dom.tokenNameInput.value = '';
        e.target.value = '';
    });

    // Token library upload (save only)
    $('token-library-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        showPrompt('Name this token:', defaultName, async (tokenName) => {
            if (!tokenName) return;
            let imageUrl = null;
            let dataSrc = null;
            if (typeof uploadMedia === 'function') {
                try {
                    imageUrl = await uploadMedia(file, 'dnd-vtt-token');
                } catch (err) {
                    console.warn('[Cloud] Token library upload failed, falling back to local:', err);
                }
            }
            if (!imageUrl) {
                dataSrc = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
            }
            saveTokenToLibrary(tokenName, imageUrl || dataSrc, imageUrl);
        });
        e.target.value = '';
    });

    // Undo/Redo
    dom.btnUndo.addEventListener('click', undo);
    dom.btnRedo.addEventListener('click', redo);

    // Export
    $('btn-export').addEventListener('click', () => {
        saveCurrentMap(); // Ensure current map is saved
        const tx = db.transaction('maps', 'readonly');
        const req = tx.objectStore('maps').getAll();
        req.onsuccess = () => {
            const blob = new Blob([JSON.stringify(req.result)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ArcaneVTT_Backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    });

    // Import
    $('campaign-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const importedMaps = JSON.parse(ev.target.result);
                if (!Array.isArray(importedMaps)) throw new Error('Invalid format');
                const tx = db.transaction('maps', 'readwrite');
                importedMaps.forEach(m => tx.objectStore('maps').put(m));
                tx.oncomplete = () => {
                    showAlert('Success', 'Campaign data imported!');
                    loadMapList();
                };
            } catch {
                showAlert('Error', 'Failed to parse campaign file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Context menu actions
    dom.ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
            if (!ctxTargetToken) return;
            const action = item.dataset.action;
            switch (action) {
                case 'rename':
                    showPrompt('Rename Token', ctxTargetToken.name || '', (newName) => {
                        if (newName) {
                            ctxTargetToken.name = newName;
                            renderTokens();
                            pushHistory();
                            saveCurrentMap();
                        }
                    });
                    break;
                case 'resize-up':
                    ctxTargetToken.size = Math.min((ctxTargetToken.size || 1) + 1, 4);
                    renderTokens();
                    pushHistory();
                    saveCurrentMap();
                    break;
                case 'resize-down':
                    ctxTargetToken.size = Math.max((ctxTargetToken.size || 1) - 1, 1);
                    renderTokens();
                    pushHistory();
                    saveCurrentMap();
                    break;
                case 'delete':
                    state.tokens = state.tokens.filter(t => t.id !== ctxTargetToken.id);
                    renderTokens();
                    pushHistory();
                    saveCurrentMap();
                    break;
            }
            hideContextMenu();
        });
    });

    // Close context menu on outside click
    document.addEventListener('click', (e) => {
        if (!dom.ctxMenu.contains(e.target)) hideContextMenu();
    });

    // Prevent default context menu on fog canvas
    dom.fogCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.isDMMode) return;
        const pos = getPointerPos(e);
        for (let i = state.tokens.length - 1; i >= 0; i--) {
            const t = state.tokens[i];
            const radius = ((t.size || 1) * state.gridSize) / 2;
            if (Math.hypot(pos.x - t.x, pos.y - t.y) < radius) {
                showContextMenu(e.clientX, e.clientY, t);
                return;
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (!state.isDMMode) return;

        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

        switch (e.key.toLowerCase()) {
            case 'd': setTool(TOOLS.DRAG); break;
            case 'p': setTool(TOOLS.PAN); break;
            case 'f': setTool(TOOLS.FOG_DRAW); break;
            case 'r': setTool(TOOLS.FOG_RECT); break;
            case 'e': setTool(TOOLS.FOG_ERASE); break;
            case 't': setTool(TOOLS.FOG_TOGGLE); break;
            case 'g':
                state.isGridVisible = !state.isGridVisible;
                renderGrid();
                break;
            case 'escape':
                if (state.isDrawing) {
                    state.isDrawing = false;
                    state.currentDrawPoints = [];
                    renderFog();
                }
                break;
        }
    });

    // Pointer events on fog canvas
    dom.fogCanvas.addEventListener('pointerdown', onPointerDown);
    dom.fogCanvas.addEventListener('pointermove', onPointerMove);
    dom.fogCanvas.addEventListener('pointerup', onPointerUp);
    dom.fogCanvas.addEventListener('pointercancel', onPointerUp);

    // Wheel zoom
    dom.wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        let newScale = state.transform.scale * delta;
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        const rect = dom.wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        state.transform.x = mouseX - (mouseX - state.transform.x) * (newScale / state.transform.scale);
        state.transform.y = mouseY - (mouseY - state.transform.y) * (newScale / state.transform.scale);
        state.transform.scale = newScale;
        updateTransform();
    }, { passive: false });
}

// ==================== CLOUD SYNC (tools_dnd table) ====================
let syncToCloudDebounce = null;

async function syncToCloud() {
    if (typeof saveDndSave !== 'function') return;
    if (syncToCloudDebounce) clearTimeout(syncToCloudDebounce);
    syncToCloudDebounce = setTimeout(async () => {
        syncToCloudDebounce = null;
        await performCloudSync();
    }, 500);
}

async function performCloudSync() {
    for (const map of state.mapsList) {
        const stateData = {
            data: map.data || null,
            imageUrl: map.imageUrl || null,
            tokens: (map.tokens || []).map(t => ({
                id: t.id, name: t.name, x: t.x, y: t.y,
                src: t.src && !t.src.startsWith('data:') ? t.src : null,
                imageUrl: t.imageUrl || null,
                size: t.size || 1
            })),
            fogShapes: map.fogShapes || [],
            gridSize: map.gridSize || DEFAULT_GRID
        };
        const result = await saveDndSave('vtt', map.name, stateData, map.cloudId || null);
        if (result.id && !map.cloudId) {
            map.cloudId = result.id;
            if (db) {
                const tx = db.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(map);
            }
        }
    }
    if (state.tokenLibrary.length > 0) {
        const libState = { tokens: state.tokenLibrary.map(t => ({ id: t.id, name: t.name, src: t.src && !t.src.startsWith('data:') ? t.src : null, imageUrl: t.imageUrl })) };
        const libResult = await saveDndSave('vtt_library', 'Token Library', libState, state.tokenLibraryCloudId || null);
        if (libResult.id) state.tokenLibraryCloudId = libResult.id;
    }
}

async function syncFromCloud() {
    if (typeof loadDndSaves !== 'function') return;

    const mapSaves = await loadDndSaves('vtt');
    for (const save of mapSaves) {
        const sd = save.state_data || {};
        const existing = state.mapsList.find(m => m.cloudId === save.id);
        const cleanCloudData = (val) => (typeof val === 'string' && val.startsWith('[STRIPPED_')) ? null : val;

        if (existing) {
            existing.name = save.name;
            existing.data = cleanCloudData(sd.data) || existing.data;
            existing.imageUrl = sd.imageUrl || existing.imageUrl;
            existing.tokens = sd.tokens || existing.tokens;
            existing.fogShapes = sd.fogShapes || existing.fogShapes;
            existing.gridSize = sd.gridSize || existing.gridSize;
            if (db) {
                const tx = db.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(existing);
            }
        } else {
            const newMap = {
                id: Date.now(),
                cloudId: save.id,
                name: save.name,
                data: cleanCloudData(sd.data) || null,
                imageUrl: sd.imageUrl || null,
                tokens: sd.tokens || [],
                fogShapes: sd.fogShapes || [],
                gridSize: sd.gridSize || DEFAULT_GRID
            };
            state.mapsList.push(newMap);
            if (db) {
                const tx = db.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(newMap);
            }
        }
    }

    const libSaves = await loadDndSaves('vtt_library');
    if (libSaves.length > 0) {
        const lib = libSaves[0];
        state.tokenLibraryCloudId = lib.id;
        const tokens = lib.state_data?.tokens || [];
        state.tokenLibrary = tokens.map(t => ({ id: t.id, name: t.name, src: (t.src && !t.src.startsWith('[STRIPPED_')) ? t.src : (t.imageUrl || null), imageUrl: t.imageUrl }));
        if (db) {
            const tx = db.transaction('tokenLibrary', 'readwrite');
            state.tokenLibrary.forEach(t => tx.objectStore('tokenLibrary').put(t));
        }
    }

    updateMapDropdown();
    if (state.mapsList.length > 0 && !state.currentMapData) {
        await loadMap(state.mapsList[0].id);
    }
    renderTokenLibrary();
}

async function resolveMapImage(mapData) {
    if (mapData.imageUrl && typeof resolveMediaUrl === 'function') {
        try {
            return await resolveMediaUrl(mapData.imageUrl);
        } catch (e) {
            console.warn('[Cloud] Failed to resolve map image:', e);
        }
    }
    return mapData.data || null;
}

// ==================== INITIALISATION ====================
window.addEventListener('load', async () => {
    if (typeof requirePro === 'function') await requirePro();
    lucide.createIcons();
    initDB();
    initUI();

    // Set default tool ring
    setTool(TOOLS.DRAG);

    // Predefine grid visible flag (default false)
    state.isGridVisible = false;
});
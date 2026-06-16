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
const DB_VERSION = 4;
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

    // Undo/redo
    history: [],
    historyIndex: -1,

    // Token library
    tokenLibrary: [],

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
        isDragging: false
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

// ==================== RULER ====================
function resizeRulerCanvas() {
    if (!dom.rulerCanvas) return;
    const rect = dom.wrapper.getBoundingClientRect();
    dom.rulerCanvas.width = rect.width;
    dom.rulerCanvas.height = rect.height;
}

function clearRuler() {
    if (!dom.rulerCanvas) return;
    const ctx = dom.rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.rulerCanvas.width, dom.rulerCanvas.height);
}

function drawRuler(start, end) {
    if (!dom.rulerCanvas || !start || !end) return;
    const ctx = dom.rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.rulerCanvas.width, dom.rulerCanvas.height);

    // Convert canvas world coords → screen coords
    const sx = start.x * state.transform.scale + state.transform.x;
    const sy = start.y * state.transform.scale + state.transform.y;
    const ex = end.x * state.transform.scale + state.transform.x;
    const ey = end.y * state.transform.scale + state.transform.y;

    // Measure using 5-10-5 diagonal rule
    const gs = state.gridSize;
    const dx = Math.abs(end.x - start.x) / gs;
    const dy = Math.abs(end.y - start.y) / gs;
    const straight = Math.abs(dx - dy);
    const diag = Math.min(dx, dy);
    // Every other diagonal step costs 10 ft instead of 5
    const diagCost = Math.floor(diag / 2) * 2 + (diag % 2);  // alternating 1-2-1-2 steps
    const totalSquares = straight + diagCost;
    const feet = Math.round(totalSquares) * 5;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = 'rgba(251,191,36,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dots at endpoints
    [{ x: sx, y: sy }, { x: ex, y: ey }].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
    });

    // Label
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    const label = `${Math.round(totalSquares)} sq / ${feet} ft`;
    ctx.font = 'bold 13px Cinzel, serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(12,10,9,0.75)';
    ctx.beginPath();
    ctx.roundRect(midX - tw / 2 - 6, midY - 11, tw + 12, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY);
}

// ==================== WAYPOINTS ====================
function renderWaypoints() {
    // Waypoints are drawn on the token canvas layer, on top of tokens
    // Called from renderTokens
}

function drawWaypointsOnCtx(ctx) {
    state.waypoints.forEach(wp => {
        const x = wp.x;
        const y = wp.y;
        // Pin body
        ctx.beginPath();
        ctx.arc(x, y - 14, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239,68,68,0.9)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Pin needle
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(239,68,68,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Label
        if (wp.label) {
            ctx.font = 'bold 11px Cinzel, serif';
            const tw = ctx.measureText(wp.label).width;
            ctx.fillStyle = 'rgba(12,10,9,0.8)';
            ctx.beginPath();
            ctx.roundRect(x - tw / 2 - 4, y + 3, tw + 8, 15, 3);
            ctx.fill();
            ctx.fillStyle = '#fde68a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(wp.label, x, y + 4);
        }
    });
}

function placeWaypoint(pos) {
    // Check if clicking near existing waypoint → remove it
    const REMOVE_RADIUS = 14;
    const existing = state.waypoints.findIndex(wp =>
        Math.hypot(pos.x - wp.x, pos.y - wp.y + 14) < REMOVE_RADIUS
    );
    if (existing !== -1) {
        state.waypoints.splice(existing, 1);
        renderTokens();
        saveCurrentMap();
        return;
    }
    // Place new waypoint — ask for optional label
    showPrompt('Waypoint Label (optional):', '', (label) => {
        state.waypoints.push({ id: newId(), x: pos.x, y: pos.y, label: label?.trim() || '' });
        renderTokens();
        saveCurrentMap();
    });
}

// ==================== INITIATIVE TRACKER ====================
function renderInitiative() {
    const list = dom.initiativeList;
    if (!list) return;
    const combatants = state.initiative.combatants;

    if (combatants.length === 0) {
        list.innerHTML = '<p class="text-xs text-stone-600 italic text-center py-3">No combatants yet.</p>';
        if (dom.initControls) dom.initControls.classList.add('hidden');
        return;
    }

    if (dom.initControls) dom.initControls.classList.remove('hidden');
    if (dom.initRound) dom.initRound.textContent = state.initiative.round;

    list.innerHTML = '';
    combatants.forEach((c, i) => {
        const isActive = i === state.initiative.currentIndex;
        const row = document.createElement('div');
        row.className = `flex items-center gap-2 px-2 py-1.5 rounded transition-all ${
            isActive
                ? 'bg-amber-900/40 border border-amber-600/60 ring-1 ring-amber-500/30'
                : 'bg-stone-950 border border-stone-800'
        }`;

        row.innerHTML = `
            <span class="text-[10px] font-mono font-bold w-6 text-center shrink-0 ${isActive ? 'text-amber-400' : 'text-stone-600'}">${c.initiative ?? '—'}</span>
            <span class="flex-1 text-xs font-cinzel font-bold truncate ${isActive ? 'text-amber-300' : 'text-stone-300'}" title="${c.name}">${isActive ? '▶ ' : ''}${c.name}</span>
            ${c.hp !== undefined ? `<span class="text-[10px] font-mono text-stone-500">${c.hp}/${c.maxHp}</span>` : ''}
            <button data-id="${c.id}" data-action="init-remove"
                class="text-stone-700 hover:text-red-400 transition-colors p-0.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        `;

        row.querySelector('[data-action="init-remove"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id, 10);
            const idx = state.initiative.combatants.findIndex(x => x.id === id);
            if (idx === -1) return;
            state.initiative.combatants.splice(idx, 1);
            if (state.initiative.currentIndex >= state.initiative.combatants.length) {
                state.initiative.currentIndex = 0;
            }
            renderInitiative();
            highlightActiveCombatant();
        });

        // Click row to set as active
        row.addEventListener('click', (e) => {
            if (e.target.closest('[data-action]')) return;
            state.initiative.currentIndex = i;
            renderInitiative();
            highlightActiveCombatant();
        });

        list.appendChild(row);
    });
}

function addCombatant(name, initiative, tokenId) {
    if (!name?.trim()) return;
    state.initiative.combatants.push({
        id: newId(),
        name: name.trim(),
        initiative: initiative !== '' && !isNaN(initiative) ? parseInt(initiative, 10) : null,
        tokenId: tokenId || null
    });
    // Sort by initiative descending (nulls last)
    state.initiative.combatants.sort((a, b) => {
        if (a.initiative === null) return 1;
        if (b.initiative === null) return -1;
        return b.initiative - a.initiative;
    });
    if (state.initiative.currentIndex === -1 && state.initiative.combatants.length > 0) {
        state.initiative.currentIndex = 0;
    }
    renderInitiative();
    highlightActiveCombatant();
    broadcastState();
}

function nextTurn() {
    if (state.initiative.combatants.length === 0) return;
    state.initiative.currentIndex = (state.initiative.currentIndex + 1) % state.initiative.combatants.length;
    if (state.initiative.currentIndex === 0) state.initiative.round++;
    renderInitiative();
    highlightActiveCombatant();
    broadcastState();
}

function prevTurn() {
    if (state.initiative.combatants.length === 0) return;
    if (state.initiative.currentIndex === 0) {
        state.initiative.round = Math.max(1, state.initiative.round - 1);
        state.initiative.currentIndex = state.initiative.combatants.length - 1;
    } else {
        state.initiative.currentIndex--;
    }
    renderInitiative();
    highlightActiveCombatant();
    broadcastState();
}

function highlightActiveCombatant() {
    // Draw a golden ring on the active combatant's linked token
    state.tokens.forEach(t => { t._initiativeActive = false; });
    const active = state.initiative.combatants[state.initiative.currentIndex];
    if (active?.tokenId) {
        const token = state.tokens.find(t => t.id === active.tokenId);
        if (token) token._initiativeActive = true;
    }
    renderTokens();
}

// ==================== ROTATE A POINT ====================
// Rotate a point 90° clockwise around (0,0) in a w×h space
function rotatePointCW(x, y, w, h) {
    return { x: h - y, y: x };
}

// Snap a world coordinate so the token sits correctly on the grid.
// Odd-sized tokens (1x1, 3x3) have a single center cell → snap to cell center.
// Even-sized tokens (2x2, 4x4) straddle grid intersections → snap to nearest line crossing.
function snapToGrid(x, y, size) {
    const gs = state.gridSize;
    const sz = size || 1;
    if (sz % 2 === 1) {
        // Odd: snap center to nearest cell center
        const col = Math.floor(x / gs);
        const row = Math.floor(y / gs);
        return {
            x: col * gs + gs / 2,
            y: row * gs + gs / 2
        };
    } else {
        // Even: snap center to nearest grid line intersection
        return {
            x: Math.round(x / gs) * gs,
            y: Math.round(y / gs) * gs
        };
    }
}

// Update grid cols/rows inputs and cell-size display from current gridSize + map dims
function updateGridDisplay() {
    if (dom.gridSizeValue) dom.gridSizeValue.textContent = state.gridSize + ' px';
    if (dom.gridSizeInput) dom.gridSizeInput.value = state.gridSize;
    if (state.mapImage) {
        const cols = Math.round(state.mapImage.width / state.gridSize);
        const rows = Math.round(state.mapImage.height / state.gridSize);
        if (dom.gridColsInput) dom.gridColsInput.value = cols;
        if (dom.gridRowsInput) dom.gridRowsInput.value = rows;
    }
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
        if (renderFlags.fog) { renderFogNow(); renderLOS(); }
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

        // Border — blue for PC tokens, red for DM tokens
        dom.tokenCtx.strokeStyle = t.isPC ? '#60a5fa' : '#f87171';
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

        // Selected token ring (for arrow key movement)
        if (state.selectedToken && t.id === state.selectedToken.id) {
            dom.tokenCtx.beginPath();
            dom.tokenCtx.arc(t.x, t.y, radius + 4, 0, Math.PI * 2);
            dom.tokenCtx.strokeStyle = '#22d3ee';
            dom.tokenCtx.lineWidth = 2.5;
            dom.tokenCtx.setLineDash([]);
            dom.tokenCtx.stroke();
            dom.tokenCtx.beginPath();
            dom.tokenCtx.arc(t.x, t.y, radius + 8, 0, Math.PI * 2);
            dom.tokenCtx.strokeStyle = 'rgba(34,211,238,0.25)';
            dom.tokenCtx.lineWidth = 5;
            dom.tokenCtx.stroke();
        }

        // Initiative active ring: glowing amber pulse ring
        if (t._initiativeActive) {
            dom.tokenCtx.beginPath();
            dom.tokenCtx.arc(t.x, t.y, radius + 5, 0, Math.PI * 2);
            dom.tokenCtx.strokeStyle = '#f59e0b';
            dom.tokenCtx.lineWidth = 3;
            dom.tokenCtx.setLineDash([8, 4]);
            dom.tokenCtx.stroke();
            dom.tokenCtx.setLineDash([]);
            dom.tokenCtx.beginPath();
            dom.tokenCtx.arc(t.x, t.y, radius + 9, 0, Math.PI * 2);
            dom.tokenCtx.strokeStyle = 'rgba(245,158,11,0.3)';
            dom.tokenCtx.lineWidth = 6;
            dom.tokenCtx.stroke();
        }
    }

    // Draw waypoints on top of tokens
    drawWaypointsOnCtx(dom.tokenCtx);
}

function renderFogNow() {
    dom.fogCtx.clearRect(0, 0, dom.fogCanvas.width, dom.fogCanvas.height);

    // Regular fog shapes (room fills from Fill Room tool)
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
                dom.fogCtx.strokeStyle = 'rgba(217,119,6,0.5)';
                dom.fogCtx.lineWidth = 2;
                dom.fogCtx.stroke();
            }
        }
    }

    // Draw wall segments — stone-like thick lines, visible to all
    const isWallMode = state.isDMMode && (
        state.currentTool === TOOLS.WALL ||
        state.currentTool === TOOLS.WALL_EDIT ||
        state.currentTool === TOOLS.WALL_ERASE
    );
    for (const seg of state.wallSegments) {
        dom.fogCtx.save();
        dom.fogCtx.lineCap = 'round';
        dom.fogCtx.lineJoin = 'round';
        // Outer dark stroke
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(seg.x1, seg.y1);
        dom.fogCtx.lineTo(seg.x2, seg.y2);
        dom.fogCtx.strokeStyle = 'rgba(15,10,5,0.95)';
        dom.fogCtx.lineWidth = 10;
        dom.fogCtx.stroke();
        // Inner stone stroke
        dom.fogCtx.strokeStyle = 'rgba(90,78,65,0.95)';
        dom.fogCtx.lineWidth = 5;
        dom.fogCtx.stroke();
        dom.fogCtx.restore();

        // DM wall tool modes: draw endpoint handles
        if (isWallMode) {
            const r = WALL_NODE_RADIUS / state.transform.scale;
            const isEditSeg = state.currentTool === TOOLS.WALL_EDIT && seg.id === state.wallEdit.segId;
            for (const [px, py, ep] of [[seg.x1, seg.y1, 'start'], [seg.x2, seg.y2, 'end']]) {
                dom.fogCtx.beginPath();
                dom.fogCtx.arc(px, py, r, 0, Math.PI * 2);
                dom.fogCtx.fillStyle = (isEditSeg && state.wallEdit.endpoint === ep)
                    ? '#facc15' : (isWallMode ? 'rgba(255,255,255,0.7)' : 'transparent');
                dom.fogCtx.fill();
                dom.fogCtx.strokeStyle = isWallMode ? '#92400e' : 'transparent';
                dom.fogCtx.lineWidth = 1.5 / state.transform.scale;
                dom.fogCtx.stroke();
            }
            // Erase mode: red tint over segment on hover (handled via cursor only)
            if (state.currentTool === TOOLS.WALL_ERASE) {
                dom.fogCtx.beginPath();
                dom.fogCtx.moveTo(seg.x1, seg.y1);
                dom.fogCtx.lineTo(seg.x2, seg.y2);
                dom.fogCtx.strokeStyle = 'rgba(239,68,68,0.3)';
                dom.fogCtx.lineWidth = 10;
                dom.fogCtx.stroke();
            }
        }
    }

    // Draw openings (doors and windows)
    for (const op of state.openingSegments) {
        const ctx = dom.fogCtx;
        ctx.save();
        ctx.lineCap = 'round';
        if (!op.isDoor) {
            // Window: always dashed, cyan when open, grey when closed
            ctx.setLineDash([4 / state.transform.scale, 3 / state.transform.scale]);
        }
        // Base stroke
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        if (op.isDoor) {
            ctx.strokeStyle = op.isOpen ? 'rgba(34,197,94,0.95)' : 'rgba(180,83,9,0.95)';
            ctx.lineWidth = 8;
        } else {
            ctx.strokeStyle = op.isOpen ? 'rgba(147,210,255,0.95)' : 'rgba(100,150,180,0.7)';
            ctx.lineWidth = 5;
        }
        ctx.stroke();
        // Edge highlight
        ctx.strokeStyle = op.isOpen
            ? (op.isDoor ? 'rgba(134,239,172,0.7)' : 'rgba(186,230,253,0.7)')
            : (op.isDoor ? 'rgba(251,191,36,0.8)' : 'rgba(148,163,184,0.5)');
        ctx.lineWidth = op.isDoor ? 3 : 2;
        ctx.stroke();
        ctx.setLineDash([]);
        // Centre dot
        const mx = (op.x1 + op.x2) / 2, my = (op.y1 + op.y2) / 2;
        const iconR = Math.max(3, 5 / state.transform.scale);
        ctx.beginPath();
        ctx.arc(mx, my, iconR, 0, Math.PI * 2);
        ctx.fillStyle = op.isOpen
            ? (op.isDoor ? 'rgba(34,197,94,0.9)' : 'rgba(147,210,255,0.9)')
            : (op.isDoor ? 'rgba(251,191,36,0.9)' : 'rgba(148,163,184,0.7)');
        ctx.fill();
        ctx.restore();
    }

    // Wall / door / window drag preview
    if (state.wallDrag.active) {
        const { x1, y1, x2, y2 } = state.wallDrag;
        const previewColor = state.currentTool === TOOLS.OPENING
            ? (state._openingIsDoor ? 'rgba(251,191,36,0.9)' : 'rgba(147,210,255,0.9)')
            : 'rgba(34,211,238,0.8)';
        dom.fogCtx.save();
        dom.fogCtx.lineCap = 'round';
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(x1, y1);
        dom.fogCtx.lineTo(x2, y2);
        dom.fogCtx.strokeStyle = 'rgba(15,10,5,0.7)';
        dom.fogCtx.lineWidth = 10;
        dom.fogCtx.stroke();
        dom.fogCtx.strokeStyle = previewColor;
        dom.fogCtx.lineWidth = 5;
        dom.fogCtx.stroke();
        dom.fogCtx.restore();
        // Start node
        dom.fogCtx.beginPath();
        dom.fogCtx.arc(x1, y1, WALL_NODE_RADIUS / state.transform.scale, 0, Math.PI * 2);
        dom.fogCtx.fillStyle = '#22d3ee';
        dom.fogCtx.fill();
        // End snap indicator
        const endSnap = snapToNearestWallNode({ x: x2, y: y2 });
        if (endSnap) {
            dom.fogCtx.beginPath();
            dom.fogCtx.arc(endSnap.x, endSnap.y, (WALL_NODE_RADIUS + 4) / state.transform.scale, 0, Math.PI * 2);
            dom.fogCtx.strokeStyle = '#e879f9';
            dom.fogCtx.lineWidth = 2 / state.transform.scale;
            dom.fogCtx.stroke();
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
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img.src, imageUrl: t.imageUrl || null, size: t.size || 1, isPC: t.isPC !== false
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
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img.src, imageUrl: t.imageUrl || null, size: t.size || 1, isPC: t.isPC !== false
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
        if (!IS_PLAYER_WINDOW) broadcastState();
    });
}

// ==================== TOOL SELECTION ====================
const toolButtons = {
    drag: 'tool-drag',
    pan: 'tool-pan',
    'fog-draw': 'tool-fog-draw',
    'fog-rect': 'tool-fog-rect',
    'fog-erase': 'tool-fog-erase',
    'fog-toggle': 'tool-fog-toggle',
    ruler: 'tool-ruler',
    waypoint: 'tool-waypoint',
    wall: 'tool-wall',
    'wall-erase': 'tool-wall-erase',
    'wall-edit': 'tool-wall-edit',
    'opening': 'tool-opening'
};

const toolCursors = {
    [TOOLS.DRAG]: 'grab',
    [TOOLS.PAN]: 'move',
    [TOOLS.FOG_DRAW]: 'crosshair',
    [TOOLS.FOG_RECT]: 'crosshair',
    [TOOLS.FOG_ERASE]: 'cell',
    [TOOLS.FOG_TOGGLE]: 'pointer',
    [TOOLS.RULER]: 'crosshair',
    [TOOLS.WAYPOINT]: 'cell',
    [TOOLS.WALL]: 'crosshair',
    [TOOLS.WALL_ERASE]: 'pointer',
    [TOOLS.WALL_EDIT]: 'pointer',
    [TOOLS.OPENING]: 'crosshair'
};

function setTool(tool) {
    state.currentTool = tool;
    // Cancel any in-progress drawing when switching tools
    if (state.isDrawing) {
        state.isDrawing = false;
        state.currentDrawPoints = [];
        renderFog();
    }
    // Clear ruler when switching away
    if (tool !== TOOLS.RULER) { state.rulerActive = false; clearRuler(); }
    // Cancel wall drag when switching away
    if (tool !== TOOLS.WALL && state.wallDrag.active) {
        state.wallDrag.active = false;
        renderFog();
    }
    // Clear wall edit state when switching away
    if (tool !== TOOLS.WALL_EDIT) {
        state.wallEdit.segId = null;
        state.wallEdit.endpoint = null;
        state.wallEdit.isDragging = false;
        renderFog();
    }
    // Remove ring from all tool buttons
    Object.values(toolButtons).forEach(id => {
        $(id)?.classList.remove('ring-2', 'ring-amber-500');
    });
    // Add ring to current
    const btnId = toolButtons[tool];
    if (btnId) $(btnId)?.classList.add('ring-2', 'ring-amber-500');
    // Update cursor
    dom.container.style.cursor = toolCursors[tool] || 'default';
}

// ==================== PLAYER TOOL SELECTION ====================
const playerToolButtons = {
    move: 'player-tool-move',
    fog: 'player-tool-fog',
    ruler: 'player-tool-ruler',
    ping: 'player-tool-ping'
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
    // Clear ruler when switching player tool away from ruler
    if (tool !== 'ruler') { state.rulerActive = false; clearRuler(); }
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

    // Ruler tool (DM or player ruler mode) — start drag
    if (state.currentTool === TOOLS.RULER || (!state.isDMMode && state.playerTool === 'ruler')) {
        state.rulerActive = true;
        state.rulerStart = { x: pos.x, y: pos.y };
        state.rulerEnd = { x: pos.x, y: pos.y };
        return;
    }

    // Waypoint tool — handle on pointer down
    if (state.isDMMode && state.currentTool === TOOLS.WAYPOINT) {
        placeWaypoint(pos);
        return;
    }

    // Ping tool (player mode)
    if (!state.isDMMode && state.playerTool === 'ping') {
        createPing(pos);
        return;
    }

    // Pan with middle mouse button or pan tool (DM only — player view has no panning)
    if (e.button === 1 || state.currentTool === TOOLS.PAN) {
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
                state.selectedToken = tokenHit;
                renderTokens();
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
        case TOOLS.WALL:
            handleWallDragStart(pos);
            break;
        case TOOLS.WALL_ERASE:
            removeWallAt(pos);
            removeOpeningAt(pos);
            break;
        case TOOLS.WALL_EDIT:
            handleWallEditDown(pos);
            break;
        case TOOLS.OPENING:
            handleWallDragStart(pos);
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
        state.fogShapes.push({ id: newId(), points: [...state.currentDrawPoints], isHidden: true });
        pushHistory();
        saveCurrentMap();
    }
    state.currentDrawPoints = [];
    renderFog();
}

// ==================== LOS RAYCASTING ENGINE ====================

// Ray-segment intersection. Returns t along the ray, or null.
function raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2) {
    const sdx = x2 - x1, sdy = y2 - y1;
    const denom = dx * sdy - dy * sdx;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((x1 - ox) * sdy - (y1 - oy) * sdx) / denom;
    const u = ((x1 - ox) * dy  - (y1 - oy) * dx)  / denom;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) return Math.max(0, t);
    return null;
}

// Cast one ray, return nearest hit point
function castRay(ox, oy, angle, segments) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let minT = Infinity;
    for (const seg of segments) {
        const t = raySegmentIntersect(ox, oy, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t < minT) minT = t;
    }
    // minT should always be finite because boundary segments are included
    if (!isFinite(minT)) minT = 0;
    return { x: ox + dx * minT, y: oy + dy * minT };
}

// Normalise angle to [-π, π]
function normaliseAngle(a) {
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

// Build the map-boundary segments so rays always terminate at the edge
function buildBoundarySegments(W, H) {
    const pad = 1;
    return [
        { x1: -pad, y1: -pad,   x2: W+pad, y2: -pad   }, // top
        { x1: W+pad, y1: -pad,  x2: W+pad, y2: H+pad  }, // right
        { x1: W+pad, y1: H+pad, x2: -pad,  y2: H+pad  }, // bottom
        { x1: -pad,  y1: H+pad, x2: -pad,  y2: -pad   }  // left
    ];
}

// Compute the visibility polygon for one origin, given all occluder+boundary segments
function computeVisibilityPolygon(ox, oy, allSegs) {
    const EPS = 0.00005;

    // Collect candidate angles toward every segment endpoint ±ε
    const rawAngles = [];
    for (const seg of allSegs) {
        for (const [px, py] of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
            const a = Math.atan2(py - oy, px - ox); // native atan2 range [-π, π]
            rawAngles.push(a - EPS, a, a + EPS);
        }
    }

    // Normalise all to [-π, π] and sort
    const angles = rawAngles
        .map(normaliseAngle)
        .sort((a, b) => a - b);

    // Cast ray at each angle; sort result pairs by angle from origin to guarantee
    // correct CCW winding regardless of floating-point drift
    const pairs = angles.map(a => {
        const pt = castRay(ox, oy, a, allSegs);
        // Re-derive angle from the actual hit point to avoid winding issues
        return { a: Math.atan2(pt.y - oy, pt.x - ox), x: pt.x, y: pt.y };
    });

    // Sort strictly by angle from origin
    pairs.sort((a, b) => a.a - b.a);

    return pairs.map(p => ({ x: p.x, y: p.y }));
}

// LOS cache — visibility polygons keyed by token id, invalidated on any mutation
const losCache = {
    polygons: new Map(), // tokenId -> [{x,y}]
    dirty: true          // recompute needed
};

function invalidateLOSCache() {
    losCache.dirty = true;
    losCache.polygons.clear();
}

function rebuildLOSCache() {
    if (!state.losEnabled || !state.mapImage) { losCache.dirty = false; return; }
    losCache.polygons.clear();

    const hasWalls = state.wallSegments.length > 0 || state.openingSegments.length > 0;
    if (hasWalls) {
        // Wall mode: raycasting through occluders
        const boundary = buildBoundarySegments(state.mapImage.width, state.mapImage.height);
        const closedOpenings = state.openingSegments.filter(o => !o.isOpen);
        const occluders = [...state.wallSegments, ...closedOpenings, ...boundary];
        for (const token of state.tokens) {
            if (token.x == null || !token.isPC) continue;
            losCache.polygons.set(token.id, computeVisibilityPolygon(token.x, token.y, occluders));
        }
    }
    // Open-world mode: no polygons needed — view distance circle handles it in renderLOS
    losCache.dirty = false;
}

// Render LOS — only recomputes when cache is dirty
function renderLOS() {
    const W = dom.losCanvas.width;
    const H = dom.losCanvas.height;
    const ctx = dom.losCtx;
    ctx.clearRect(0, 0, W, H);

    if (!state.losEnabled || !state.mapImage) return;
    const pcTokens = state.tokens.filter(t => t.isPC !== false);
    if (pcTokens.length === 0) return;

    if (losCache.dirty) rebuildLOSCache();

    const hasWalls = state.wallSegments.length > 0 || state.openingSegments.length > 0;
    const viewDistPx = (state.losViewDistance / state.gridMetresPerSquare) * state.gridSize;

    if (hasWalls) {
        // ── WALL MODE: raycasting polygons, no distance limit, no dark overlay ──
        if (state.isDMMode) {
            for (const [tokenId, poly] of losCache.polygons.entries()) {
                if (poly.length < 3) continue;
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (const p of poly) ctx.lineTo(p.x, p.y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(34,197,94,0.08)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(34,197,94,0.25)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        } else {
            // Player: dark overlay, punch out each LOS polygon
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'destination-out';
            for (const [, poly] of losCache.polygons.entries()) {
                if (poly.length < 3) continue;
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (const p of poly) ctx.lineTo(p.x, p.y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    } else {
        // ── OPEN-WORLD MODE: dark overlay + view distance circle per PC token ──
        if (state.isDMMode) {
            // DM: show view distance rings only
            for (const token of pcTokens) {
                if (token.x == null) continue;
                ctx.beginPath();
                ctx.arc(token.x, token.y, viewDistPx, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(34,197,94,0.06)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(34,197,94,0.35)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            // Player open-world:
            // losDarkMap ON  → full black outside view circles
            // losDarkMap OFF → 50% dim outside view circles
            const outerAlpha = state.losDarkMap ? 1.0 : 0.5;
            ctx.fillStyle = `rgba(0,0,0,${outerAlpha})`;
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'destination-out';
            for (const token of pcTokens) {
                if (token.x == null) continue;
                ctx.beginPath();
                ctx.arc(token.x, token.y, viewDistPx, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

// ==================== WALL SEGMENT SYSTEM ====================
const WALL_NODE_RADIUS = 8;
const WALL_SNAP_RADIUS = 14; // px screen space

// Collect all unique endpoints from all segments
function allWallNodes() {
    const nodes = [];
    for (const seg of state.wallSegments) {
        nodes.push({ x: seg.x1, y: seg.y1 });
        nodes.push({ x: seg.x2, y: seg.y2 });
    }
    return nodes;
}

// Snap pos to nearest existing endpoint within WALL_SNAP_RADIUS (screen px)
// excludeSegId + excludeEndpoint lets us skip the point being dragged
function snapToNearestWallNode(pos, excludeSegId = null, excludeEndpoint = null) {
    const r = WALL_SNAP_RADIUS / state.transform.scale;
    let best = null, bestDist = r;
    for (const seg of state.wallSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            if (seg.id === excludeSegId && ep === excludeEndpoint) continue;
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { x: px, y: py }; }
        }
    }
    return best;
}

// Point-to-segment distance helper
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// --- WALL DRAW (drag) ---
function handleWallDragStart(pos) {
    const snapped = snapToNearestWallNode(pos) || pos;
    state.wallDrag.active = true;
    state.wallDrag.x1 = snapped.x;
    state.wallDrag.y1 = snapped.y;
    state.wallDrag.x2 = snapped.x;
    state.wallDrag.y2 = snapped.y;
    renderFog();
}

function handleWallDragMove(pos) {
    if (!state.wallDrag.active) return;
    const snapped = snapToNearestWallNode(pos) || pos;
    state.wallDrag.x2 = snapped.x;
    state.wallDrag.y2 = snapped.y;
    renderFog();
}

function handleWallDragEnd(pos) {
    if (!state.wallDrag.active) return;
    state.wallDrag.active = false;
    const snappedEnd = snapToNearestWallNode(pos) || pos;
    const x1 = state.wallDrag.x1, y1 = state.wallDrag.y1;
    const x2 = snappedEnd.x, y2 = snappedEnd.y;
    // Only add if the segment has some length
    if (Math.hypot(x2 - x1, y2 - y1) > 3 / state.transform.scale) {
        state.wallSegments.push({ id: newId(), x1, y1, x2, y2 });
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
    renderFog();
}

// --- WALL EDIT (drag endpoints) ---
function handleWallEditDown(pos) {
    const we = state.wallEdit;
    const r = WALL_NODE_RADIUS / state.transform.scale;
    // Find the nearest endpoint within r
    let best = null, bestDist = r;
    for (const seg of state.wallSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { seg, ep, px, py }; }
        }
    }
    if (best) {
        we.segId = best.seg.id;
        we.endpoint = best.ep;
        we.nodeX = best.px;  // world-space position of the grabbed joint
        we.nodeY = best.py;
        we.isDragging = true;
    } else {
        we.segId = null; we.endpoint = null; we.nodeX = null; we.nodeY = null; we.isDragging = false;
    }
    renderFog();
}

function handleWallEditMove(pos) {
    const we = state.wallEdit;
    if (!we.isDragging || !we.segId || we.nodeX == null) return;
    const snapped = snapToNearestWallNode(pos, we.segId, we.endpoint) || pos;
    // Move all endpoints that share the current joint position (connected nodes)
    const TOL = 1; // world-space px; snapped nodes are exactly coincident
    for (const seg of state.wallSegments) {
        if (Math.hypot(seg.x1 - we.nodeX, seg.y1 - we.nodeY) < TOL) {
            seg.x1 = snapped.x; seg.y1 = snapped.y;
        }
        if (Math.hypot(seg.x2 - we.nodeX, seg.y2 - we.nodeY) < TOL) {
            seg.x2 = snapped.x; seg.y2 = snapped.y;
        }
    }
    // Track the joint's new position for the next move event
    we.nodeX = snapped.x;
    we.nodeY = snapped.y;
    renderFog();
}

function handleWallEditUp() {
    if (state.wallEdit.isDragging) {
        state.wallEdit.isDragging = false;
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
}

// --- WALL ERASE ---
function removeWallAt(pos) {
    const r = 8 / state.transform.scale;
    for (let i = state.wallSegments.length - 1; i >= 0; i--) {
        const seg = state.wallSegments[i];
        if (distToSegment(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2) < r) {
            state.wallSegments.splice(i, 1);
            invalidateLOSCache();
            pushHistory();
            saveCurrentMap();
            renderFog();
            return;
        }
    }
}

// ==================== DOOR / WINDOW SYSTEM ====================

const DOOR_HIT_RADIUS = 10; // px screen space

// Closest point on segment AB to point P
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) return { x: x1, y: y1, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return { x: x1 + t * dx, y: y1 + t * dy, t };
}

// Place an opening segment from drag (reuses wallDrag state)
// isDoor: true = door, false = window
function handleOpeningDragEnd(pos, isDoor) {
    if (!state.wallDrag.active) return;
    state.wallDrag.active = false;
    const snappedEnd = snapToNearestWallNode(pos) || pos;
    const x1 = state.wallDrag.x1, y1 = state.wallDrag.y1;
    const x2 = snappedEnd.x, y2 = snappedEnd.y;
    if (Math.hypot(x2 - x1, y2 - y1) > 3 / state.transform.scale) {
        state.openingSegments.push({ id: newId(), x1, y1, x2, y2, isOpen: isDoor ? false : true, isDoor });
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
    renderFog();
}

// Toggle an opening open/closed — called on any click near an opening
function toggleOpeningAt(pos) {
    const r = DOOR_HIT_RADIUS / state.transform.scale;
    for (const op of state.openingSegments) {
        const cp = closestPointOnSegment(pos.x, pos.y, op.x1, op.y1, op.x2, op.y2);
        if (Math.hypot(cp.x - pos.x, cp.y - pos.y) < r) {
            op.isOpen = !op.isOpen;
            invalidateLOSCache();
            renderFog();
            pushHistory();
            saveCurrentMap();
            return true;
        }
    }
    return false;
}

// Remove nearest opening at pos
function removeOpeningAt(pos) {
    const r = DOOR_HIT_RADIUS / state.transform.scale;
    for (let i = state.openingSegments.length - 1; i >= 0; i--) {
        const seg = state.openingSegments[i];
        const cp = closestPointOnSegment(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2);
        if (Math.hypot(cp.x - pos.x, cp.y - pos.y) < r) {
            state.openingSegments.splice(i, 1);
            invalidateLOSCache();
            pushHistory();
            saveCurrentMap();
            renderFog();
            return true;
        }
    }
    return false;
}

// --- FILL ROOM (bucket fog) ---
function fillRoomAt(pos) {
    if (!state.mapImage) return;
    const W = state.mapImage.width;
    const H = state.mapImage.height;

    // 1. Build offscreen canvas at map resolution, draw all segments as thick lines
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    const ctx = oc.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(4, 8 / state.transform.scale);
    ctx.lineCap = 'round';
    for (const seg of state.wallSegments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
    }

    // 2. Flood fill from click position (BFS on pixels)
    const px = Math.round(pos.x);
    const py = Math.round(pos.y);
    if (px < 0 || py < 0 || px >= W || py >= H) return;

    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // Clicked on a wall? abort
    const startIdx = (py * W + px) * 4;
    if (data[startIdx] > 128) return; // white = wall pixel

    // Stack-based flood fill — faster than BFS queue for large areas
    const MAX_FILL_PX = W * H * 0.5; // abort if more than 50% of map filled (open area)
    const visited = new Uint8Array(W * H);
    const stack = [py * W + px];
    visited[py * W + px] = 1;
    let minX = px, maxX = px, minY = py, maxY = py;
    let fillCount = 0;

    while (stack.length) {
        const idx = stack.pop();
        const x = idx % W;
        const y = (idx / W) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        fillCount++;
        if (fillCount > MAX_FILL_PX) return; // open area — no enclosure
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const ni = ny * W + nx;
            if (visited[ni]) continue;
            if (data[ni * 4] > 128) continue; // wall pixel
            visited[ni] = 1;
            stack.push(ni);
        }
    }

    if (fillCount === 0) return;

    // 3. Build a simple bounding-box polygon from the fill extent
    // For a more precise result we walk the border pixels
    // Simple approach: collect border pixels (adjacent to wall or edge), then convex-hull-ish outline
    // Practical approach: just use the tight axis-aligned bounding rect of filled pixels
    // But for non-rectangular rooms, march the outer edge
    // We'll use a scanline contour: for each row find leftmost/rightmost filled pixel
    const points = [];
    // Top edge: left to right
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Right edge: top to bottom
    for (let y = minY; y <= maxY; y++) {
        for (let x = maxX; x >= minX; x--) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Bottom edge: right to left
    for (let x = maxX; x >= minX; x--) {
        for (let y = maxY; y >= minY; y--) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Left edge: bottom to top
    for (let y = maxY; y >= minY; y--) {
        for (let x = minX; x <= maxX; x++) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }

    if (points.length < 3) return;

    // Deduplicate consecutive identical points
    const poly = points.filter((p, i) => i === 0 || p.x !== points[i-1].x || p.y !== points[i-1].y);

    state.fogShapes.push({ id: newId(), type: 'wall-fill', points: poly, isHidden: true });
    pushHistory();
    saveCurrentMap();
    renderFog();
}

// --- CLEAR ALL ---
function clearAllWalls() {
    state.wallSegments = [];
    state.openingSegments = [];
    state.fogShapes = state.fogShapes.filter(s => s.type !== 'wall-fill');
    invalidateLOSCache();
    pushHistory();
    saveCurrentMap();
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
        clearRuler();
        return;
    }

    // Ruler drag update
    if (state.rulerActive && state.rulerStart) {
        state.rulerEnd = { x: state.mousePos.x, y: state.mousePos.y };
        drawRuler(state.rulerStart, state.rulerEnd);
        return;
    }

    if (state.activeToken) {
        dom.container.style.cursor = 'grabbing';
        const snapped = snapToGrid(state.mousePos.x, state.mousePos.y, state.activeToken.size || 1);
        state.activeToken.x = snapped.x;
        state.activeToken.y = snapped.y;
        renderTokens();
        broadcastState();
        // LOS updates only on grid snap — not every pixel during drag
    } else if (state.isDMMode && state.wallDrag.active) {
        handleWallDragMove(state.mousePos);
    } else if (state.isDMMode && state.wallEdit.isDragging) {
        handleWallEditMove(state.mousePos);
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
        dom.container.style.cursor = toolCursors[state.currentTool] || 'default';
        invalidateLOSCache();
        renderFog();
        pushHistory();
        saveCurrentMap();
    } else if (state.isDMMode && state.isDrawing && state.currentTool === TOOLS.FOG_RECT) {
        // Finish rectangle
        state.isDrawing = false;
        if (state.currentDrawPoints.length === 4) {
            state.fogShapes.push({ id: newId(), points: state.currentDrawPoints, isHidden: true });
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

    // Wall / door / window drag finish
    const upPos = getPointerPos(e);
    if (state.currentTool === TOOLS.WALL) {
        handleWallDragEnd(upPos);
    } else if (state.currentTool === TOOLS.OPENING) {
        handleOpeningDragEnd(upPos, state._openingIsDoor);
    } else if (state.currentTool === TOOLS.WALL_EDIT) {
        handleWallEditUp();
    }

    // Toggle opening on tap (no drag) — any tool, any mode
    if (wasTap) toggleOpeningAt(upPos);
    // Ruler finish
    if (state.rulerActive) {
        state.rulerActive = false;
        // Keep ruler visible until next interaction
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
    // Highlight the current size option
    const currentSize = token.size || 1;
    dom.ctxMenu.querySelectorAll('[data-action^="set-size-"]').forEach(el => {
        const sz = parseInt(el.dataset.action.replace('set-size-', ''), 10);
        if (sz === currentSize) {
            el.style.color = '#f59e0b';
            el.style.fontWeight = 'bold';
        } else {
            el.style.color = '';
            el.style.fontWeight = '';
        }
    });
    // Update PC/DM toggle label
    const pcLabel = $('ctx-pc-label');
    if (pcLabel) pcLabel.textContent = token.isPC ? 'Mark as DM Token' : 'Mark as PC Token';
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

function deleteMap(id) {
    const map = state.mapsList.find(m => m.id === id);
    if (!map) return;
    showConfirm('Delete Map', `Delete "${map.name}"?`, async () => {
        const cloudId = map.cloudId;
        if (cloudId && typeof vttDeleteMap === 'function') {
            await vttDeleteMap(cloudId).catch(e => console.warn('[Cloud] Failed to delete map:', e));
        }
        const tx = dataBase.transaction('maps', 'readwrite');
        tx.objectStore('maps').delete(id);
        tx.oncomplete = () => {
            state.mapsList = state.mapsList.filter(m => m.id !== id);
            if (state.currentMapData?.id === id) {
                state.currentMapData = null;
                state.mapImage = null;
                state.tokens = [];
                state.fogShapes = [];
                state.wallSegments = [];
                state.openingSegments = [];
                state.waypoints = [];
                state.initiative = { combatants: [], currentIndex: -1, round: 1 };
                invalidateLOSCache();
                [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                    c.getContext('2d').clearRect(0, 0, c.width, c.height);
                });
                renderInitiative();
            }
            renderMapLibrary();
            if (state.mapsList.length > 0 && !state.currentMapData) loadMap(state.mapsList[0].id);
            else if (state.mapsList.length === 0) showAlert('Deleted', 'Map removed.');
        };
    });
}

// ==================== UI EVENT LISTENERS ====================
function initUI() {
    // Mode toggle
    dom.modeToggle.addEventListener('click', () => {
        state.isDMMode = !state.isDMMode;
        const btn = dom.modeToggle;
        btn.classList.remove('bg-amber-700', 'hover:bg-amber-600', 'bg-stone-700', 'hover:bg-stone-600');
        const playerToolbar = $('player-toolbar');

        const toolSidebar = $('tool-sidebar');
        if (state.isDMMode) {
            dom.sidebar.style.display = 'flex';
            if (toolSidebar) toolSidebar.style.display = 'flex';
            btn.innerHTML = `<i data-lucide="user" class="w-4 h-4"></i> Enter Player View`;
            btn.classList.add('bg-amber-700', 'hover:bg-amber-600');
            if (playerToolbar) playerToolbar.classList.add('hidden');
        } else {
            dom.sidebar.style.display = 'none';
            if (toolSidebar) toolSidebar.style.display = 'none';
            btn.innerHTML = `<i data-lucide="shield" class="w-4 h-4"></i> Enter DM View`;
            btn.classList.add('bg-stone-700', 'hover:bg-stone-600');
            fitMapToScreen(); // Auto-center when entering player view
            if (playerToolbar) playerToolbar.classList.remove('hidden');
            setPlayerTool('move'); // Reset to move tool on entering player view
        }
        lucide.createIcons();
        renderFog();
    });

    // Player tool buttons (side panel)
    $('player-tool-move')?.addEventListener('click', () => setPlayerTool('move'));
    $('player-tool-fog')?.addEventListener('click', () => setPlayerTool('fog'));
    $('player-tool-ruler')?.addEventListener('click', () => setPlayerTool('ruler'));
    $('player-tool-ping')?.addEventListener('click', () => setPlayerTool('ping'));
    $('player-tool-fit')?.addEventListener('click', () => fitMapToScreen());

    // Tool buttons
    $('tool-drag')?.addEventListener('click', () => setTool(TOOLS.DRAG));
    $('tool-pan')?.addEventListener('click', () => setTool(TOOLS.PAN));
    $('tool-fog-draw')?.addEventListener('click', () => setTool(TOOLS.FOG_DRAW));
    $('tool-fog-rect')?.addEventListener('click', () => setTool(TOOLS.FOG_RECT));
    $('tool-fog-erase')?.addEventListener('click', () => setTool(TOOLS.FOG_ERASE));
    $('tool-fog-toggle')?.addEventListener('click', () => setTool(TOOLS.FOG_TOGGLE));
    $('tool-ruler')?.addEventListener('click', () => setTool(TOOLS.RULER));
    $('tool-waypoint')?.addEventListener('click', () => setTool(TOOLS.WAYPOINT));
    $('tool-wall')?.addEventListener('click', () => setTool(TOOLS.WALL));
    $('tool-wall-edit')?.addEventListener('click', () => setTool(TOOLS.WALL_EDIT));
    $('tool-wall-erase')?.addEventListener('click', () => setTool(TOOLS.WALL_ERASE));
    $('tool-opening')?.addEventListener('click', () => setTool(TOOLS.OPENING));
    $('btn-opening-type')?.addEventListener('click', () => {
        state._openingIsDoor = !state._openingIsDoor;
        const isDoor = state._openingIsDoor;
        const label = $('opening-label');
        if (label) label.textContent = isDoor ? 'Place Door' : 'Place Window';
        const iconSlot = document.querySelector('#tool-opening i, #tool-opening svg');
        if (iconSlot) {
            const newI = document.createElement('i');
            newI.id = 'opening-icon';
            newI.setAttribute('data-lucide', isDoor ? 'door-open' : 'scan');
            newI.className = `w-4 h-4 ${isDoor ? 'text-amber-400' : 'text-sky-400'}`;
            iconSlot.replaceWith(newI);
            lucide.createIcons();
        }
    });
    $('btn-los-toggle')?.addEventListener('click', () => {
        state.losEnabled = !state.losEnabled;
        const label = $('los-toggle-label');
        if (label) label.textContent = state.losEnabled ? 'LOS: On' : 'LOS: Off';
        $('btn-los-toggle')?.classList.toggle('border-green-600', state.losEnabled);
        $('btn-los-toggle')?.classList.toggle('text-green-400', state.losEnabled);
        invalidateLOSCache();
        renderFog();
        broadcastState();
    });
    $('btn-walls-clear')?.addEventListener('click', () => {
        if (state.wallSegments.length === 0) return;
        showConfirm('Clear All Walls', 'Delete every wall segment on this map?', () => {
            clearAllWalls();
        });
    });
    $('tool-grid-toggle')?.addEventListener('click', () => {
        state.isGridVisible = !state.isGridVisible;
        renderGrid();
        broadcastState();
    });
    $('btn-los-dark-map')?.addEventListener('click', () => {
        state.losDarkMap = !state.losDarkMap;
        const label = $('los-dark-map-label');
        if (label) label.textContent = state.losDarkMap ? 'Dark Map: On' : 'Dark Map: Off';
        $('btn-los-dark-map')?.classList.toggle('border-indigo-600', state.losDarkMap);
        $('btn-los-dark-map')?.classList.toggle('text-indigo-300', state.losDarkMap);
        renderFog();
        broadcastState();
    });
    $('los-dist-slider')?.addEventListener('input', (e) => {
        state.losViewDistance = parseInt(e.target.value, 10);
        const label = $('los-dist-value');
        if (label) label.textContent = state.losViewDistance + ' m';
        invalidateLOSCache();
        renderFog();
        broadcastState();
    });
    $('grid-metres-input')?.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (v > 0) {
            state.gridMetresPerSquare = v;
            invalidateLOSCache();
            renderFog();
            broadcastState();
        }
    });

    // Initiative tracker
    $('btn-init-add')?.addEventListener('click', () => {
        const name = $('init-name-input')?.value?.trim();
        const roll = $('init-roll-input')?.value;
        if (!name) return;
        addCombatant(name, roll, null);
        if ($('init-name-input')) $('init-name-input').value = '';
        if ($('init-roll-input')) $('init-roll-input').value = '';
        $('init-name-input')?.focus();
    });
    $('init-name-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('btn-init-add')?.click();
    });
    $('btn-init-next')?.addEventListener('click', nextTurn);
    $('btn-init-prev')?.addEventListener('click', prevTurn);
    $('btn-init-clear')?.addEventListener('click', () => {
        showConfirm('Clear Initiative', 'Remove all combatants?', () => {
            state.initiative.combatants = [];
            state.initiative.currentIndex = -1;
            state.initiative.round = 1;
            state.tokens.forEach(t => { t._initiativeActive = false; });
            renderInitiative();
            renderTokens();
        });
    });
    $('btn-init-from-tokens')?.addEventListener('click', () => {
        if (state.tokens.length === 0) { showAlert('No Tokens', 'Place some tokens on the map first.'); return; }
        state.tokens.forEach(t => {
            if (!state.initiative.combatants.find(c => c.tokenId === t.id)) {
                addCombatant(t.name || 'Unknown', '', t.id);
            }
        });
    });

    // Grid size fine-tune slider
    dom.gridSizeInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.gridSize = isNaN(val) ? DEFAULT_GRID : Math.min(Math.max(val, GRID_MIN), GRID_MAX);
        updateGridDisplay();
        renderGrid();
        renderTokens();
        if (state.currentMapData) {
            state.currentMapData.gridSize = state.gridSize;
            saveCurrentMap();
        }
    });

    // Grid cols input — derive gridSize from image width / cols
    dom.gridColsInput?.addEventListener('change', (e) => {
        if (!state.mapImage) return;
        const cols = parseInt(e.target.value, 10);
        if (cols > 0) {
            state.gridSize = Math.min(Math.max(Math.round(state.mapImage.width / cols), GRID_MIN), GRID_MAX);
            updateGridDisplay();
            renderGrid();
            renderTokens();
            if (state.currentMapData) {
                state.currentMapData.gridSize = state.gridSize;
                saveCurrentMap();
            }
        }
    });

    // Grid rows input — derive gridSize from image height / rows
    dom.gridRowsInput?.addEventListener('change', (e) => {
        if (!state.mapImage) return;
        const rows = parseInt(e.target.value, 10);
        if (rows > 0) {
            state.gridSize = Math.min(Math.max(Math.round(state.mapImage.height / rows), GRID_MIN), GRID_MAX);
            updateGridDisplay();
            renderGrid();
            renderTokens();
            if (state.currentMapData) {
                state.currentMapData.gridSize = state.gridSize;
                saveCurrentMap();
            }
        }
    });

    // Fit map
    $('btn-fit-map').addEventListener('click', fitMapToScreen);

    // Rotate map
    $('btn-rotate-map').addEventListener('click', rotateMap);

    // Delete map button (deletes active map)
    $('btn-delete-map').addEventListener('click', () => {
        if (!state.currentMapData) { showAlert('No Map', 'No map is currently selected.'); return; }
        deleteMap(state.currentMapData.id);
    });

    // Campaign selector change
    dom.campaignSelect?.addEventListener('change', () => {
        updateCampaignBadge();
        renderMapLibrary();
    });

    // New campaign
    $('btn-new-campaign')?.addEventListener('click', () => {
        showPrompt('New Campaign', 'Campaign name...', (name) => {
            if (!name || !name.trim()) return;
            createCampaign(name);
        });
    });

    // Rename campaign
    $('btn-rename-campaign')?.addEventListener('click', () => {
        if (!state.activeCampaignId) { showAlert('No Campaign', 'Select a campaign to rename.'); return; }
        const c = state.campaignsList.find(c => c.id === state.activeCampaignId);
        showPrompt('Rename Campaign', c?.name || '', (newName) => {
            if (!newName || !newName.trim()) return;
            renameCampaign(state.activeCampaignId, newName);
        });
    });

    // Delete campaign
    $('btn-delete-campaign')?.addEventListener('click', () => {
        if (!state.activeCampaignId) { showAlert('No Campaign', 'Select a campaign to delete.'); return; }
        deleteCampaign(state.activeCampaignId);
    });

    // Map sort
    dom.mapSort?.addEventListener('change', () => renderMapLibrary());

    // Duplicate map
    $('btn-duplicate-map')?.addEventListener('click', duplicateMap);

    // Map upload
    $('map-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

        // Step 1: Get image dimensions first
        const imgDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(file);
        });
        const imgDims = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.width, h: img.height });
            img.src = imgDataUrl;
        });

        // Step 2: Ask for map name
        showPrompt('Name this map:', defaultName, async (mapName) => {
            if (!mapName) return;

            // Step 3: Ask for grid width in squares to auto-compute grid size
            showPrompt(
                `Grid squares across (image is ${imgDims.w}px wide):`,
                '20',
                async (squaresInput) => {
                    const squares = parseInt(squaresInput, 10);
                    const computedGridSize = (squares > 0)
                        ? Math.round(imgDims.w / squares)
                        : state.gridSize;
                    const clampedGridSize = Math.min(Math.max(computedGridSize, GRID_MIN), GRID_MAX);

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
                        dataSrc = imgDataUrl; // reuse already-read data URL
                    }
                    const newMap = ensureMapMeta({
                        id: newId(),
                        name: mapName,
                        data: dataSrc,
                        imageUrl: imageUrl,
                        tokens: [],
                        fogShapes: [],
                        gridSize: clampedGridSize,
                        ...(state.activeCampaignId ? { campaignId: state.activeCampaignId } : {})
                    });
                    saveCurrentMap(); // Save current before switching
                    const tx = dataBase.transaction('maps', 'readwrite');
                    tx.objectStore('maps').put(newMap);
                    tx.oncomplete = () => {
                        state.mapsList.push(newMap);
                        renderMapLibrary();
                        loadMap(newMap.id);
                    };
                }
            );
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
            const rawX = (rect.width / 2 - state.transform.x) / state.transform.scale;
            const rawY = (rect.height / 2 - state.transform.y) / state.transform.scale;
            const snapped = snapToGrid(rawX, rawY, 1);
            state.tokens.push({ id: newId(), img, name: defaultName, x: snapped.x, y: snapped.y, size: 1, imageUrl: imageUrl, isPC: true });
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
        const tx = dataBase.transaction('maps', 'readonly');
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
                const tx = dataBase.transaction('maps', 'readwrite');
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
                case 'set-size-1':
                case 'set-size-2':
                case 'set-size-3':
                case 'set-size-4': {
                    const newSize = parseInt(action.replace('set-size-', ''), 10);
                    ctxTargetToken.size = newSize;
                    // Re-snap with the new size so odd→cell-center, even→intersection
                    const snapped = snapToGrid(ctxTargetToken.x, ctxTargetToken.y, newSize);
                    ctxTargetToken.x = snapped.x;
                    ctxTargetToken.y = snapped.y;
                    renderTokens();
                    pushHistory();
                    saveCurrentMap();
                    break;
                }
                case 'toggle-pc':
                    ctxTargetToken.isPC = !ctxTargetToken.isPC;
                    invalidateLOSCache();
                    renderTokens();
                    renderFog();
                    pushHistory();
                    saveCurrentMap();
                    break;
                case 'delete':
                    state.tokens = state.tokens.filter(t => t.id !== ctxTargetToken.id);
                    invalidateLOSCache();
                    renderTokens();
                    renderFog();
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

        // Wall edit: right-click deletes the nearest segment
        if (state.currentTool === TOOLS.WALL_EDIT) {
            removeWallAt(pos);
            return;
        }

        // Wall erase: right-click also removes wall (same as left-click)
        if (state.currentTool === TOOLS.WALL_ERASE) {
            removeWallAt(pos);
            return;
        }

        // Wall draw: right-click cancels the in-progress drag
        if (state.currentTool === TOOLS.WALL) {
            state.wallDrag.active = false;
            renderFog();
            return;
        }

        // Fog-draw polygon: right-click removes last node
        if (state.currentTool === TOOLS.FOG_DRAW && state.isDrawing) {
            if (state.currentDrawPoints.length > 1) {
                state.currentDrawPoints.pop();
            } else {
                state.isDrawing = false;
                state.currentDrawPoints = [];
            }
            renderFog();
            return;
        }

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

        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

        // Arrow key token movement — works for both DM and players
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
            const token = state.selectedToken
                ? state.tokens.find(t => t.id === state.selectedToken.id)
                : null;
            if (token) {
                e.preventDefault();
                const step = state.gridSize;
                if (e.key === 'ArrowUp')    token.y -= step;
                if (e.key === 'ArrowDown')  token.y += step;
                if (e.key === 'ArrowLeft')  token.x -= step;
                if (e.key === 'ArrowRight') token.x += step;
                invalidateLOSCache();
                renderTokens();
                renderFog();
                pushHistory();
                saveCurrentMap();
            }
            return;
        }

        if (!state.isDMMode) return;

        switch (e.key.toLowerCase()) {
            case 'd': setTool(TOOLS.DRAG); break;
            case 'p': setTool(TOOLS.PAN); break;
            case 'r': setTool(TOOLS.FOG_RECT); break;
            case 'e': setTool(TOOLS.FOG_ERASE); break;
            case 't': setTool(TOOLS.FOG_TOGGLE); break;
            case 'g':
                state.isGridVisible = !state.isGridVisible;
                renderGrid();
                break;
            case 'm': setTool(TOOLS.RULER); break;
            case 'w': setTool(TOOLS.WAYPOINT); break;
            case 'v': setTool(TOOLS.WALL); break;
            case 'b': setTool(TOOLS.WALL_EDIT); break;
            case 'x': setTool(TOOLS.WALL_ERASE); break;
            case 'o': setTool(TOOLS.OPENING); break;
            case 'escape':
                if (state.wallDrag.active) {
                    state.wallDrag.active = false;
                    renderFog();
                } else if (state.isDrawing) {
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

// ==================== CLOUD SYNC (vtt_* tables) ====================
let syncToCloudDebounce = null;

async function syncToCloud() {
    if (typeof vttSaveMap !== 'function') return;
    if (syncToCloudDebounce) clearTimeout(syncToCloudDebounce);
    syncToCloudDebounce = setTimeout(async () => {
        syncToCloudDebounce = null;
        await performCloudSync();
    }, 800);
}

async function performCloudSync() {
    if (typeof vttSaveMap !== 'function') return;
    try {
    for (const map of state.mapsList) {
        const campaign = state.campaignsList.find(c => c.id === map.campaignId);
        const isActiveMap = map.id === state.currentMapData?.id;
        const gridCols = isActiveMap && state.mapImage ? Math.round(state.mapImage.width / map.gridSize) : (map.gridCols || 20);
        const gridRows = isActiveMap && state.mapImage ? Math.round(state.mapImage.height / map.gridSize) : (map.gridRows || 15);
        const result = await vttSaveMap({
            id: map.cloudId || null,
            name: map.name,
            campaign_id: campaign?.cloudId || null,
            grid_cols: gridCols,
            grid_rows: gridRows,
            grid_size: map.gridSize || DEFAULT_GRID,
            grid_metres_per_square: map.gridMetresPerSquare || 1.5,
            is_grid_visible: map.isGridVisible || false,
            los_enabled: map.losEnabled || false,
            los_dark_map: map.losDarkMap || false,
            los_view_distance: map.losViewDistance || 30,
            image_url: map.imageUrl || null,
            image_path: map.imagePath || null,
        });
        if (result?.id && !map.cloudId) {
            map.cloudId = result.id;
            if (dataBase) {
                const tx = dataBase.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(map);
            }
        }
        if (result?.id) {
            // Use live state for the active map, persisted data for others
            const srcWalls = (map.id === state.currentMapData?.id)
                ? { walls: state.wallSegments, openings: state.openingSegments }
                : { walls: map.wallSegments || [], openings: map.openingSegments || [] };
            const wallPayload = {
                walls: srcWalls.walls.map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 })),
                openings: srcWalls.openings.map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, is_open: w.isOpen, is_door: w.isDoor }))
            };
            await vttSaveWalls(result.id, wallPayload);
            await vttSaveTokens(result.id, map.tokens || []);
        }
    }
    // Sync token library
    if (typeof vttSaveTokenLibraryEntry === 'function') {
        for (const t of state.tokenLibrary) {
            if (!t.cloudId && (t.imageUrl || t.src)) {
                const r = await vttSaveTokenLibraryEntry({ name: t.name, image_url: t.imageUrl || t.src, image_path: t.imagePath || null });
                if (r?.id) {
                    t.cloudId = r.id;
                    if (dataBase) { const tx = dataBase.transaction('tokenLibrary', 'readwrite'); tx.objectStore('tokenLibrary').put(t); }
                }
            }
        }
    }
    } catch (e) {
        console.warn('[VTT] Cloud sync failed, local data intact:', e);
    }
}

async function syncFromCloud() {
    if (typeof vttLoadMaps !== 'function') return;
    try {

    // Campaigns
    if (typeof vttLoadCampaigns === 'function') {
        const cloudCampaigns = await vttLoadCampaigns();
        for (const cc of cloudCampaigns) {
            const existing = state.campaignsList.find(c => c.cloudId === cc.id);
            if (existing) {
                existing.name = cc.name;
            } else {
                const local = ensureMapMeta({ id: newId(), cloudId: cc.id, name: cc.name, createdAt: Date.now() });
                state.campaignsList.push(local);
                if (dataBase) { const tx = dataBase.transaction('campaigns', 'readwrite'); tx.objectStore('campaigns').put(local); }
            }
        }
        renderCampaignSelect();
    }

    // Maps
    const cloudMaps = await vttLoadMaps();
    for (const cm of cloudMaps) {
        const existing = state.mapsList.find(m => m.cloudId === cm.id);
        const localCampaign = state.campaignsList.find(c => c.cloudId === cm.campaign_id);
        if (existing) {
            existing.name = cm.name;
            existing.imageUrl = cm.image_url || existing.imageUrl;
            existing.gridSize = cm.grid_size || existing.gridSize;
            existing.gridMetresPerSquare = cm.grid_metres_per_square || existing.gridMetresPerSquare;
            existing.losEnabled = cm.los_enabled;
            existing.losDarkMap = cm.los_dark_map;
            existing.losViewDistance = cm.los_view_distance;
            if (localCampaign) existing.campaignId = localCampaign.id;
            if (dataBase) { const tx = dataBase.transaction('maps', 'readwrite'); tx.objectStore('maps').put(existing); }
        } else {
            const walls = await vttLoadWalls(cm.id);
            const tokens = await vttLoadTokens(cm.id);
            const newMap = ensureMapMeta({
                id: newId(), cloudId: cm.id, name: cm.name,
                imageUrl: cm.image_url || null, data: null,
                gridSize: cm.grid_size || DEFAULT_GRID,
                gridMetresPerSquare: cm.grid_metres_per_square || 1.5,
                isGridVisible: cm.is_grid_visible || false,
                losEnabled: cm.los_enabled || false,
                losDarkMap: cm.los_dark_map || false,
                losViewDistance: cm.los_view_distance || 30,
                campaignId: localCampaign?.id || null,
                wallSegments: (walls.walls || []).map(w => ({ id: newId(), x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 })),
                openingSegments: (walls.openings || []).map(w => ({ id: newId(), x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, isOpen: w.is_open, isDoor: w.is_door })),
                tokens: tokens.map(t => ({ id: t.id, name: t.name, x: t.x, y: t.y, imageUrl: t.image_url, size: t.size, isPC: t.is_pc })),
                fogShapes: []
            });
            state.mapsList.push(newMap);
            if (dataBase) { const tx = dataBase.transaction('maps', 'readwrite'); tx.objectStore('maps').put(newMap); }
        }
    }

    // Token library
    if (typeof vttLoadTokenLibrary === 'function') {
        const cloudLib = await vttLoadTokenLibrary();
        for (const ct of cloudLib) {
            const existing = state.tokenLibrary.find(t => t.cloudId === ct.id);
            if (!existing && ct.image_url) {
                const entry = { id: newId(), cloudId: ct.id, name: ct.name, src: ct.image_url, imageUrl: ct.image_url };
                state.tokenLibrary.push(entry);
                if (dataBase) { const tx = dataBase.transaction('tokenLibrary', 'readwrite'); tx.objectStore('tokenLibrary').put(entry); }
            }
        }
    }

    // After cloud merge: silently re-render library and token library
    // Don't disrupt the currently loaded map unless it's not yet loaded
    renderMapLibrary();
    renderTokenLibrary();
    if (state.mapsList.length > 0 && !state.currentMapData) {
        await loadMap(state.mapsList[0].id);
    }
    } catch (e) {
        console.warn('[VTT] Background cloud sync failed, local data intact:', e);
    }
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

// ==================== BROADCAST CHANNEL (Player View Sync) ====================
const BROADCAST_CHANNEL = 'arcane-vtt-sync';
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

// Track last map id sent so we only re-send the image when it changes
let _lastBroadcastMapId = null;

// Called after any state change — serialises and sends to player window(s)
function broadcastState() {
    if (!bc || IS_PLAYER_WINDOW) return;

    const mapId = state.currentMapData?.id || null;

    // Send map image in a separate message only when map changes
    if (mapId && mapId !== _lastBroadcastMapId) {
        _lastBroadcastMapId = mapId;
        const mapSrc = state.currentMapData?.data || state.currentMapData?.imageUrl || null;
        if (mapSrc) bc.postMessage({ type: 'map-image', mapId, mapSrc });
    }

    const payload = {
        type: 'state-update',
        tokens: state.tokens.map(t => ({
            id: t.id, name: t.name, x: t.x, y: t.y,
            size: t.size || 1, src: t.imageUrl || t.img?.src || null,
            _initiativeActive: t._initiativeActive || false,
            isPC: t.isPC !== false
        })),
        fogShapes: state.fogShapes,
        wallSegments: state.wallSegments,
        openingSegments: state.openingSegments,
        gridSize: state.gridSize,
        transform: state.transform,
        losEnabled: state.losEnabled,
        losDarkMap: state.losDarkMap,
        losViewDistance: state.losViewDistance,
        gridMetresPerSquare: state.gridMetresPerSquare,
        waypoints: state.waypoints,
        mapId,
        isGridVisible: state.isGridVisible,
        initiative: state.initiative,
    };
    bc.postMessage(payload);
}

// Player window: render initiative overlay
function renderPlayerInitiative() {
    const overlay = $('player-initiative-overlay');
    const list = $('player-init-list');
    const round = $('player-init-round');
    if (!overlay || !list || !round) return;

    if (IS_PLAYER_WINDOW) overlay.classList.remove('hidden');

    round.textContent = state.initiative.round;
    const combatants = state.initiative.combatants || [];

    if (combatants.length === 0) {
        list.innerHTML = '<p class="text-[10px] text-stone-500 italic text-center py-1">No combatants</p>';
        return;
    }

    list.innerHTML = '';
    combatants.forEach((c, i) => {
        const isActive = i === state.initiative.currentIndex;
        const row = document.createElement('div');
        row.className = `flex items-center gap-2 px-1.5 py-0.5 rounded ${isActive ? 'bg-amber-900/40 border border-amber-700/30' : 'text-stone-400'}`;
        row.innerHTML = `
            <span class="text-[10px] font-mono w-4 text-center ${isActive ? 'text-amber-400 font-bold' : 'text-stone-600'}">${c.initiative ?? '—'}</span>
            <span class="flex-1 text-[11px] font-cinzel truncate ${isActive ? 'text-amber-300' : ''}">${isActive ? '▶ ' : ''}${c.name}</span>
        `;
        list.appendChild(row);
    });
}

// Player window: receive state and re-render
if (bc && IS_PLAYER_WINDOW) {
    const playerDoRender = () => {
        invalidateLOSCache();
        renderMap();
        renderGrid();
        renderFog();
        renderTokens();
        renderLOS();
        renderPlayerInitiative();
    };

    bc.onmessage = async ({ data }) => {
        // Handle map image arriving separately (large payload sent once per map change)
        if (data.type === 'map-image') {
            if (data.mapId !== state.currentMapData?.id) {
                state.currentMapData = { id: data.mapId, data: data.mapSrc };
                const img = new Image();
                img.onload = () => {
                    state.mapImage = img;
                    const w = img.width, h = img.height;
                    dom.container.style.width = w + 'px';
                    dom.container.style.height = h + 'px';
                    [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                        c.width = w; c.height = h;
                    });
                    playerDoRender();
                };
                img.onerror = (e) => console.error('[Player] map image failed to load', e);
                img.src = data.mapSrc;
            }
            return;
        }
        if (data.type !== 'state-update') return;

        // Update transform — player window ignores DM panning, keeps full-screen fit
        if (!IS_PLAYER_WINDOW) {
            state.transform = data.transform;
            updateTransform();
        } else {
            fitMapToScreen();
        }

        // Grid
        state.gridSize = data.gridSize;
        state.isGridVisible = data.isGridVisible;

        // Fog/wall/opening/waypoint state
        state.fogShapes = data.fogShapes;
        state.wallSegments = data.wallSegments;
        state.openingSegments = data.openingSegments;
        state.waypoints = data.waypoints;
        state.losEnabled = data.losEnabled;
        state.losDarkMap = data.losDarkMap;
        state.losViewDistance = data.losViewDistance;
        state.gridMetresPerSquare = data.gridMetresPerSquare ?? 1.5;

        // Initiative (for broadcast player window)
        if (data.initiative) {
            state.initiative = data.initiative;
            renderPlayerInitiative();
        }

        // Tokens — re-use existing img objects where possible
        const existingImgs = new Map(state.tokens.map(t => [t.id, t.img]));
        state.tokens = await Promise.all(data.tokens.map(async td => {
            let img = existingImgs.get(td.id);
            if (!img && td.src) {
                img = new Image();
                await new Promise(res => { img.onload = res; img.onerror = res; img.src = td.src; });
            }
            return { ...td, img };
        }));

        // Only render if map image is ready — map-image handler will re-render when it loads
        if (state.mapImage) playerDoRender();
    };
}

// ==================== INITIALISATION ====================
window.addEventListener('load', async () => {
    if (!IS_PLAYER_WINDOW && typeof requirePro === 'function') await requirePro();
    lucide.createIcons();
    if (!IS_PLAYER_WINDOW) initDB();
    initUI(); // always run — player window needs pointer events and toolbar buttons

    // Set default tool ring
    setTool(TOOLS.DRAG);

    // Predefine grid visible flag (default false)
    state.isGridVisible = false;

    // Size ruler canvas to match wrapper and keep it synced
    resizeRulerCanvas();
    new ResizeObserver(resizeRulerCanvas).observe(dom.wrapper);

    // Initialize initiative UI
    renderInitiative();

    // Player window: auto-switch to player mode and hide all DM chrome
    if (IS_PLAYER_WINDOW) {
        state.isDMMode = false;
        if (dom.sidebar) dom.sidebar.style.display = 'none';
        const toolSidebar = $('tool-sidebar');
        if (toolSidebar) toolSidebar.style.display = 'none';
        const header = document.querySelector('header');
        if (header) header.style.display = 'none';
        const playerToolbar = $('player-toolbar');
        if (playerToolbar) playerToolbar.classList.remove('hidden');
        setPlayerTool('move');
        document.title = 'Player View | Arcane Tabletop';

        // Show loading overlay until first broadcast arrives
        const loadingEl = document.createElement('div');
        loadingEl.id = 'player-loading';
        loadingEl.style.cssText = 'position:fixed;inset:0;background:#0c0a09;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:16px;';
        loadingEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 2s linear infinite"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
            <p style="color:#a8a29e;font-family:serif;font-size:14px;letter-spacing:.1em;">Waiting for DM...</p>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(loadingEl);

        // Ping DM with retries until we get a response
        const ping = () => { if (bc) bc.postMessage({ type: 'player-ready' }); };
        ping();
        const retryInterval = setInterval(ping, 2000);

        // Remove overlay on first state-update received
        const origOnMessage = bc.onmessage;
        bc.onmessage = async (evt) => {
            if (evt.data?.type === 'state-update') {
                clearInterval(retryInterval);
                loadingEl.remove();
                bc.onmessage = origOnMessage;
            }
            if (origOnMessage) await origOnMessage(evt);
        };
    } else {
        // DM window: listen for player-ready pings and respond with full state
        if (bc) {
            bc.addEventListener('message', ({ data }) => {
                if (data.type === 'player-ready') {
                    _lastBroadcastMapId = null; // force map image re-send
                    broadcastState();
                }
            });
        }
    }

    // Wire the "Open Player View" button
    $('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'arcane-player-view',
            'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
});
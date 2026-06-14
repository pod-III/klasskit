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
    WAYPOINT: 'waypoint'
};

// DOM element shortcuts
const $ = id => document.getElementById(id);

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
        state.waypoints.push({ id: Date.now(), x: pos.x, y: pos.y, label: label?.trim() || '' });
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
        id: Date.now(),
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
}

function nextTurn() {
    if (state.initiative.combatants.length === 0) return;
    state.initiative.currentIndex = (state.initiative.currentIndex + 1) % state.initiative.combatants.length;
    if (state.initiative.currentIndex === 0) state.initiative.round++;
    renderInitiative();
    highlightActiveCombatant();
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
        await syncFromCloud();
        if (state.mapsList.length > 0 && !state.currentMapData) {
            await loadMap(state.mapsList[0].id);
        }
    };
    request.onerror = () => showAlert('Database Error', 'Failed to open IndexedDB');
}

function saveCurrentMap() {
    if (!state.currentMapData || !dataBase) return;
    state.currentMapData.tokens = state.tokens.map(t => ({
        id: t.id, name: t.name, x: t.x, y: t.y, src: t.imageUrl || t.img.src, imageUrl: t.imageUrl || null, size: t.size || 1
    }));
    state.currentMapData.fogShapes = state.fogShapes;
    state.currentMapData.gridSize = state.gridSize;
    state.currentMapData.waypoints = state.waypoints;
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
    state.activeCampaignId = cid ? parseInt(cid, 10) : null;
    const campaign = state.campaignsList.find(c => c.id === state.activeCampaignId);
    if (campaign && dom.campaignActiveBadge) {
        dom.campaignActiveBadge.classList.remove('hidden');
        dom.campaignActiveBadge.classList.add('flex');
        if (dom.campaignActiveName) dom.campaignActiveName.textContent = campaign.name;
        const count = state.mapsList.filter(m => m.campaignId === campaign.id).length;
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
}

function createCampaign(name) {
    const campaign = { id: Date.now(), name: name.trim(), createdAt: Date.now() };
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
        state.campaignsList = state.campaignsList.filter(c => c.id !== id);
        if (dataBase) {
            const tx = dataBase.transaction('campaigns', 'readwrite');
            tx.objectStore('campaigns').delete(id);
        }
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
    // Filter by active campaign; null = show all
    const filtered = state.activeCampaignId
        ? state.mapsList.filter(m => m.campaignId === state.activeCampaignId)
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
        const now = Date.now();
        const copy = ensureMapMeta({
            id: now,
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
            [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas].forEach(c => {
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
    const tx = dataBase.transaction('tokenLibrary', 'readonly');
    const req = tx.objectStore('tokenLibrary').getAll();
    req.onsuccess = () => {
        state.tokenLibrary = req.result || [];
        renderTokenLibrary();
    };
}

function saveTokenToLibrary(name, src, imageUrl = null) {
    const entry = { id: Date.now(), name, src, imageUrl };
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
        state.tokens.push({ id: Date.now(), img, name: nameInput, x: snapped.x, y: snapped.y, size: 1, imageUrl: libToken.imageUrl });
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
    'fog-toggle': 'tool-fog-toggle',
    ruler: 'tool-ruler',
    waypoint: 'tool-waypoint'
};

const toolCursors = {
    [TOOLS.DRAG]: 'grab',
    [TOOLS.PAN]: 'move',
    [TOOLS.FOG_DRAW]: 'crosshair',
    [TOOLS.FOG_RECT]: 'crosshair',
    [TOOLS.FOG_ERASE]: 'cell',
    [TOOLS.FOG_TOGGLE]: 'pointer',
    [TOOLS.RULER]: 'crosshair',
    [TOOLS.WAYPOINT]: 'cell'
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
    pan: 'player-tool-pan',
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
    const hints = {
        move: 'Drag tokens to move them',
        pan: 'Drag the map to explore',
        fog: 'Tap a dark area to reveal it',
        ruler: 'Drag to measure distance',
        ping: 'Tap to send a ping'
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
        if (cloudId && typeof deleteDndSave === 'function') {
            await deleteDndSave(cloudId).catch(e => console.warn('[Cloud] Failed to delete map:', e));
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
                [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas].forEach(c => {
                    c.getContext('2d').clearRect(0, 0, c.width, c.height);
                });
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
    $('player-tool-ruler')?.addEventListener('click', () => setPlayerTool('ruler'));
    $('player-tool-ping')?.addEventListener('click', () => setPlayerTool('ping'));

    // Tool buttons
    $('tool-drag').addEventListener('click', () => setTool(TOOLS.DRAG));
    $('tool-pan').addEventListener('click', () => setTool(TOOLS.PAN));
    $('tool-fog-draw').addEventListener('click', () => setTool(TOOLS.FOG_DRAW));
    $('tool-fog-rect').addEventListener('click', () => setTool(TOOLS.FOG_RECT));
    $('tool-fog-erase').addEventListener('click', () => setTool(TOOLS.FOG_ERASE));
    $('tool-fog-toggle').addEventListener('click', () => setTool(TOOLS.FOG_TOGGLE));
    $('tool-ruler')?.addEventListener('click', () => setTool(TOOLS.RULER));
    $('tool-waypoint')?.addEventListener('click', () => setTool(TOOLS.WAYPOINT));
    $('tool-grid-toggle').addEventListener('click', () => {
        state.isGridVisible = !state.isGridVisible;
        renderGrid();
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
                        id: Date.now(),
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
            state.tokens.push({ id: Date.now(), img, name: defaultName, x: snapped.x, y: snapped.y, size: 1, imageUrl: imageUrl });
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
            case 'm': setTool(TOOLS.RULER); break;
            case 'w': setTool(TOOLS.WAYPOINT); break;
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
            if (dataBase) {
                const tx = dataBase.transaction('maps', 'readwrite');
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
            if (dataBase) {
                const tx = dataBase.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(existing);
            }
        } else {
            const newMap = ensureMapMeta({
                id: Date.now(),
                cloudId: save.id,
                name: save.name,
                data: cleanCloudData(sd.data) || null,
                imageUrl: sd.imageUrl || null,
                tokens: sd.tokens || [],
                fogShapes: sd.fogShapes || [],
                gridSize: sd.gridSize || DEFAULT_GRID
            });
            state.mapsList.push(newMap);
            if (dataBase) {
                const tx = dataBase.transaction('maps', 'readwrite');
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
        if (dataBase) {
            const tx = dataBase.transaction('tokenLibrary', 'readwrite');
            state.tokenLibrary.forEach(t => tx.objectStore('tokenLibrary').put(t));
        }
    }

    renderMapLibrary();
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

    // Size ruler canvas to match wrapper and keep it synced
    resizeRulerCanvas();
    new ResizeObserver(resizeRulerCanvas).observe(dom.wrapper);

    // Initialize initiative UI
    renderInitiative();
});
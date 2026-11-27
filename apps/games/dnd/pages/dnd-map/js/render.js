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

// Set canvas container background color
function setCanvasBackground(color) {
    if (!dom.container) return;
    dom.container.style.backgroundColor = color;
    // Also apply to the container's parent if needed for full coverage
    if (state.currentMapData) {
        state.currentMapData.canvasBgColor = color;
        saveCurrentMap();
    }
}

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

        // Skip if token image not loaded yet
        if (!t.img || !t.img.complete || t.img.naturalWidth === 0) continue;

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

        // Wall edit mode: draw endpoint handles on openings too
        if (isWallMode) {
            const r = WALL_NODE_RADIUS / state.transform.scale;
            const isEditSeg = state.currentTool === TOOLS.WALL_EDIT && op.id === state.wallEdit.segId;
            for (const [px, py, ep] of [[op.x1, op.y1, 'start'], [op.x2, op.y2, 'end']]) {
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fillStyle = (isEditSeg && state.wallEdit.endpoint === ep)
                    ? '#facc15' : (isWallMode ? 'rgba(255,255,255,0.7)' : 'transparent');
                ctx.fill();
                ctx.strokeStyle = isWallMode ? '#92400e' : 'transparent';
                ctx.lineWidth = 1.5 / state.transform.scale;
                ctx.stroke();
            }
            // Erase mode: red tint over opening on hover
            if (state.currentTool === TOOLS.WALL_ERASE) {
                ctx.beginPath();
                ctx.moveTo(op.x1, op.y1);
                ctx.lineTo(op.x2, op.y2);
                ctx.strokeStyle = 'rgba(239,68,68,0.3)';
                ctx.lineWidth = 10;
                ctx.stroke();
            }
        }

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
        dom.fogCtx.fillStyle = state.shiftKey ? '#fbbf24' : '#22d3ee'; // Amber when snapping
        dom.fogCtx.fill();
        // Angle snapping indicator
        if (state.shiftKey) {
            dom.fogCtx.beginPath();
            dom.fogCtx.arc(x2, y2, (WALL_NODE_RADIUS + 4) / state.transform.scale, 0, Math.PI * 2);
            dom.fogCtx.strokeStyle = '#fbbf24';
            dom.fogCtx.lineWidth = 2 / state.transform.scale;
            dom.fogCtx.stroke();
        }
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


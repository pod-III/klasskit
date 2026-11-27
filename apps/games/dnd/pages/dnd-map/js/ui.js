// ==================== MODAL SYSTEM ====================
let modalCallback = null;
let cancelCallback = null;

function closeModal() {
    dom.modal.classList.add('hidden');
    dom.modalInput.classList.add('hidden');
    dom.modalMessage.classList.add('hidden');
    dom.modalCancel.classList.add('hidden');
    dom.modalInput.value = '';
    dom.modalConfirm.textContent = 'Confirm';
    dom.modalCancel.textContent = 'Cancel';
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
    cancelCallback = null;
}

// Spinner / loading indicator
let spinnerTimeout = null;
function showSpinner(show) {
    let spinner = document.getElementById('app-spinner');
    if (show) {
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'app-spinner';
            spinner.className = 'fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm';
            spinner.innerHTML = `
                <div class="flex flex-col items-center gap-3 p-6 bg-stone-800 border border-amber-600/30 rounded-lg shadow-xl">
                    <div class="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-sm text-amber-500 font-cinzel">Loading...</span>
                </div>
            `;
            document.body.appendChild(spinner);
        }
        spinner.classList.remove('hidden');
        // Auto-hide after 30s as failsafe
        if (spinnerTimeout) clearTimeout(spinnerTimeout);
        spinnerTimeout = setTimeout(() => showSpinner(false), 30000);
    } else {
        if (spinner) spinner.classList.add('hidden');
        if (spinnerTimeout) {
            clearTimeout(spinnerTimeout);
            spinnerTimeout = null;
        }
    }
}

function showConfirm(title, message, callback) {
    closeModal();
    dom.modalTitle.innerText = title;
    dom.modalMessage.innerText = message;
    dom.modalMessage.classList.remove('hidden');
    dom.modalCancel.classList.remove('hidden');
    dom.modal.classList.remove('hidden');
    modalCallback = () => callback(true);
    cancelCallback = null;
}

function confirmAction(title, message, onConfirm, onCancel, confirmText, cancelText) {
    closeModal();
    dom.modalTitle.innerText = title;
    dom.modalMessage.innerText = message;
    dom.modalMessage.classList.remove('hidden');
    dom.modalCancel.classList.remove('hidden');
    dom.modal.classList.remove('hidden');
    dom.modalInput.classList.add('hidden');
    if (confirmText) dom.modalConfirm.textContent = confirmText;
    if (cancelText) dom.modalCancel.textContent = cancelText;
    modalCallback = () => { if (onConfirm) onConfirm(); };
    cancelCallback = () => { if (onCancel) onCancel(); };
}

dom.modalCancel.onclick = () => {
    const cb = cancelCallback;
    closeModal();
    if (cb) cb();
};
dom.modalConfirm.onclick = () => {
    const val = dom.modalInput.value;
    const cb = modalCallback;
    closeModal();
    if (cb) cb(val);
};


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
        state.wallEdit.isOpening = false;
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
                if (state.mapImageSrc && state.mapImageSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(state.mapImageSrc);
                }
                state.mapImage = null;
                state.mapImageSrc = null;
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

    // Save map as template button
    $('btn-save-map-template').addEventListener('click', () => {
        showPrompt('Save Map as Template', state.currentMapData?.name || 'Map Template', (name) => {
            if (name) saveMapAsTemplate(name);
        });
    });

    // Background color picker
    document.querySelectorAll('.bg-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.bg;
            setCanvasBackground(color);
            // Update active ring
            document.querySelectorAll('.bg-color-btn').forEach(b => b.classList.remove('ring-2', 'ring-amber-500'));
            btn.classList.add('ring-2', 'ring-amber-500');
        });
    });

    $('bg-color-picker')?.addEventListener('input', (e) => {
        setCanvasBackground(e.target.value);
        document.querySelectorAll('.bg-color-btn').forEach(b => b.classList.remove('ring-2', 'ring-amber-500'));
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

    // New Map - create blank map first, ask for name
    $('btn-new-map').addEventListener('click', () => {
        showPrompt('New Map', 'New Map', async (name) => {
            if (!name || !name.trim()) return;
            showSpinner(true);
            try {
                const gridSize = DEFAULT_GRID;
                const timestamp = Date.now();
                const newMap = {
                    id: newId(),
                    name: name.trim(),
                    width: gridSize * 20,
                    height: gridSize * 15,
                    gridSize: gridSize,
                    gridMetres: 5,
                    canvasBgColor: '#1c1917',
                    wallSegments: [],
                    openingSegments: [],
                    tokens: [],
                    fogShapes: [],
                    losEnabled: false,
                    losDarkMap: false,
                    losViewDistance: 30,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    ...(state.activeCampaignId ? { campaignId: state.activeCampaignId } : {})
                };
                saveCurrentMap();
                const tx = dataBase.transaction('maps', 'readwrite');
                tx.objectStore('maps').put(newMap);
                tx.oncomplete = () => {
                    state.mapsList.push(newMap);
                    state.currentMapId = newMap.id;
                    state.currentMapData = newMap;
                    loadMap(newMap.id);
                    renderMapLibrary();
                    saveCurrentMap();
                    syncToCloud();
                };
            }
            catch (err) {
                showAlert('Error', 'Failed to create new map.');
                console.error(err);
            }
            finally {
                showSpinner(false);
            }
        });
    });

    // Map upload - can add to current map or create new
    $('map-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showSpinner(true);
        try {
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

            const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

            // If we have a current map, ask whether to add image to it or create new
            if (state.currentMapData) {
                confirmAction('Add Image to Map', `Add this image to "${state.currentMapData.name}" or create a new map?`, async () => {
                    // Add to current map
                    let imageUrl = null;
                    let dataSrc = null;
                    if (typeof uploadMedia === 'function') {
                        try {
                            imageUrl = await uploadMedia(file, 'dnd-vtt-map');
                        } catch (err) {
                            console.warn('[Cloud] Map upload failed, falling back to local:', err);
                        }
                    }
                    if (!imageUrl) dataSrc = imgDataUrl;

                    state.currentMapData.data = dataSrc;
                    state.currentMapData.imageUrl = imageUrl;
                    state.currentMapData.width = imgDims.w;
                    state.currentMapData.height = imgDims.h;
                    state.currentMapData.updatedAt = Date.now();

                    // Optionally update grid size
                    showPrompt(
                        `Grid squares across (image is ${imgDims.w}px wide):`,
                        Math.round(imgDims.w / state.currentMapData.gridSize).toString(),
                        async (squaresInput) => {
                            const squares = parseInt(squaresInput, 10);
                            if (squares > 0) {
                                state.currentMapData.gridSize = Math.min(Math.max(Math.round(imgDims.w / squares), GRID_MIN), GRID_MAX);
                            }
                            saveCurrentMap();
                            loadMap(state.currentMapData.id);
                            renderMapLibrary();
                            showAlert('Image Added', `Image added to "${state.currentMapData.name}".`);
                        }
                    );
                }, async () => {
                    // Create new map with image
                    await createNewMapWithImage(imgDataUrl, imgDims, defaultName);
                }, 'Add to Current', 'Create New');
            } else {
                // No current map - create new one
                await createNewMapWithImage(imgDataUrl, imgDims, defaultName);
            }
        }
        catch (err) {
            showAlert('Error', 'Failed to process image. Please try a different file.');
            console.error(err);
        }
        finally {
            showSpinner(false);
            e.target.value = '';
        }
    });

    async function createNewMapWithImage(imgDataUrl, imgDims, defaultName) {
        showPrompt('Name this map:', defaultName, async (mapName) => {
            if (!mapName) return;
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
                    if (!imageUrl) dataSrc = imgDataUrl;

                    const newMap = ensureMapMeta({
                        id: newId(),
                        name: mapName,
                        data: dataSrc,
                        imageUrl: imageUrl,
                        width: imgDims.w,
                        height: imgDims.h,
                        gridSize: clampedGridSize,
                        tokens: [],
                        fogShapes: [],
                        ...(state.activeCampaignId ? { campaignId: state.activeCampaignId } : {})
                    });
                    saveCurrentMap();
                    const tx = dataBase.transaction('maps', 'readwrite');
                    tx.objectStore('maps').put(newMap);
                    tx.oncomplete = () => {
                        state.mapsList.push(newMap);
                        state.currentMapId = newMap.id;
                        state.currentMapData = newMap;
                        loadMap(newMap.id);
                        renderMapLibrary();
                        saveCurrentMap();
                        syncToCloud();
                    };
                }
            );
        });
    }

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

        // Wall edit: right-click deletes the nearest segment (wall or opening)
        if (state.currentTool === TOOLS.WALL_EDIT) {
            removeWallAt(pos);
            removeOpeningAt(pos);
            return;
        }

        // Wall erase: right-click also removes wall and openings
        if (state.currentTool === TOOLS.WALL_ERASE) {
            removeWallAt(pos);
            removeOpeningAt(pos);
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

    // Track shift key for angle snapping
    document.addEventListener('keydown', (e) => { if (e.key === 'Shift') state.shiftKey = true; });
    document.addEventListener('keyup', (e) => { if (e.key === 'Shift') state.shiftKey = false; });

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


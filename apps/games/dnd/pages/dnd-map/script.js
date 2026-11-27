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
// Performance-optimized broadcast system
let _lastBroadcastMapId = null;
let _broadcastThrottle = null;
let _lastBroadcastTime = 0;
let _tokenImageCacheSent = new Set(); // Track which token images we've already sent

// Called after any state change — throttled and delta-optimized
function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;

    const now = performance.now();
    const minInterval = options.immediate ? 0 : 16; // 60fps cap (16ms), or 0 for immediate

    if (_broadcastThrottle) clearTimeout(_broadcastThrottle);

    const doBroadcast = () => {
        _lastBroadcastTime = performance.now();
        _performBroadcast(options);
    };

    const elapsed = now - _lastBroadcastTime;
    if (elapsed >= minInterval) {
        doBroadcast();
    } else {
        _broadcastThrottle = setTimeout(doBroadcast, minInterval - elapsed);
    }
}

function _performBroadcast(options) {
    const mapId = state.currentMapData?.id || null;

    // Send map reference only (player will load independently from IndexedDB)
    if (mapId && mapId !== _lastBroadcastMapId) {
        _lastBroadcastMapId = mapId;
        _tokenImageCacheSent.clear(); // Reset token cache on map change
        // Send lightweight map reference instead of full image
        bc.postMessage({
            type: 'map-ref',
            mapId,
            mapLocalId: state.currentMapData?.id, // Player uses this to fetch from IndexedDB
            mapName: state.currentMapData?.name,
            hasImage: !!(state.currentMapData?.data || state.currentMapData?.imageUrl)
        });
    }

    // Build optimized token payload - only send src for new tokens
    const tokenPayload = state.tokens.map(t => {
        const tokenId = t.id;
        const src = t.imageUrl || t.img?.src || null;
        const isNewToken = !_tokenImageCacheSent.has(tokenId);

        if (isNewToken && src) _tokenImageCacheSent.add(tokenId);

        return {
            id: tokenId, name: t.name, x: t.x, y: t.y,
            size: t.size || 1,
            src: isNewToken ? src : undefined, // Only include src for new tokens
            _initiativeActive: t._initiativeActive || false,
            isPC: t.isPC !== false
        };
    });

    const payload = {
        type: 'state-update',
        tokens: tokenPayload,
        fogShapes: state.fogShapes,
        wallSegments: state.wallSegments,
        openingSegments: state.openingSegments,
        gridSize: state.gridSize,
        transform: state.transform,
        losEnabled: state.losEnabled,
        losDarkMap: state.losDarkMap,
        losViewDistance: state.losViewDistance,
        gridMetresPerSquare: state.gridMetresPerSquare ?? 1.5,
        waypoints: state.waypoints,
        mapId,
        isGridVisible: state.isGridVisible,
        initiative: state.initiative,
    };
    bc.postMessage(payload);
}

// Force full re-sync (useful for new player windows)
function broadcastFullState() {
    _tokenImageCacheSent.clear();
    broadcastState({ immediate: true });
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
        // Handle map reference (player loads independently from IndexedDB)
        if (data.type === 'map-ref') {
            if (data.mapId !== state.currentMapData?.id) {
                // Switch loading indicator
                const loadingEl = window._playerLoadingEl;
                const spinnerDiv = loadingEl?.querySelector('#loading-spinner');
                const mapIndicatorDiv = loadingEl?.querySelector('#map-loading-indicator');
                if (spinnerDiv) { spinnerDiv.classList.add('hidden'); spinnerDiv.classList.remove('flex'); }
                if (mapIndicatorDiv) { mapIndicatorDiv.classList.remove('hidden'); mapIndicatorDiv.classList.add('flex'); }

                // Player loads map independently from IndexedDB
                await loadMapForPlayer(data.mapLocalId, data.mapId, loadingEl, mapIndicatorDiv);
            }
            return;
        }

        // Legacy: Handle full map image broadcast (backward compatibility)
        if (data.type === 'map-image') {
            if (data.mapId !== state.currentMapData?.id && data.mapSrc) {
                state.currentMapData = { id: data.mapId, data: data.mapSrc };

                const loadingEl = window._playerLoadingEl;
                const spinnerDiv = loadingEl?.querySelector('#loading-spinner');
                const mapIndicatorDiv = loadingEl?.querySelector('#map-loading-indicator');
                if (spinnerDiv) { spinnerDiv.classList.add('hidden'); spinnerDiv.classList.remove('flex'); }
                if (mapIndicatorDiv) { mapIndicatorDiv.classList.remove('hidden'); mapIndicatorDiv.classList.add('flex'); }

                const img = new Image();
                img.onload = () => {
                    state.mapImage = img;
                    const w = img.width, h = img.height;
                    dom.container.style.width = w + 'px';
                    dom.container.style.height = h + 'px';
                    [dom.mapCanvas, dom.gridCanvas, dom.tokenCanvas, dom.fogCanvas, dom.losCanvas].forEach(c => {
                        c.width = w; c.height = h;
                    });
                    loadingEl?.remove();
                    window._playerLoadingEl = null;
                    playerDoRender();
                };
                img.onerror = (e) => {
                    console.error('[Player] map image failed to load', e);
                    state.mapImage = null;
                    const mapLoadingText = mapIndicatorDiv?.querySelector('span');
                    if (mapLoadingText) {
                        mapLoadingText.textContent = 'Map failed to load';
                        mapLoadingText.style.color = '#ef4444';
                    }
                    setTimeout(() => {
                        loadingEl?.remove();
                        window._playerLoadingEl = null;
                    }, 1500);
                    playerDoRender();
                };
                img.src = data.mapSrc;
            }
            return;
        }
        if (data.type !== 'state-update') return;

        // Stop retry interval and remove loading overlay on first state update
        if (window._playerRetryInterval) {
            clearInterval(window._playerRetryInterval);
            window._playerRetryInterval = null;
        }
        // Only remove overlay if no map coming or map already loaded
        // (map-ref handler removes overlay after loading)
        if (!data.mapId || state.mapImage) {
            window._playerLoadingEl?.remove();
            window._playerLoadingEl = null;
        }

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

        // Tokens — re-use existing img objects where possible, cache by ID
        const existingImgs = new Map(state.tokens.map(t => [t.id, t.img]));
        const tokenImageCache = window._playerTokenImageCache || (window._playerTokenImageCache = new Map());

        state.tokens = await Promise.all(data.tokens.map(async td => {
            // Use cached image if available
            let img = existingImgs.get(td.id) || tokenImageCache.get(td.id);

            // Load new image if src provided and not cached
            if (!img && td.src) {
                img = new Image();
                await new Promise(res => { img.onload = res; img.onerror = res; img.src = td.src; });
                tokenImageCache.set(td.id, img); // Cache for future updates
            }

            return { ...td, img };
        }));

        // Always render what we have — tokens/fog/walls/initiative work without map
        playerDoRender();
    };
}

// ==================== INITIALISATION ====================
window.addEventListener('load', async () => {
    if (!IS_PLAYER_WINDOW && typeof requirePro === 'function') await requirePro();
    lucide.createIcons();
    // Player window also needs IndexedDB to load maps independently
    initDB();
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

        // Show fantasy frame outline in player mode
        const mapFrame = $('map-fantasy-frame');
        if (mapFrame) mapFrame.classList.remove('hidden');

        // Show loading indicator in top-right corner (compact, non-blocking)
        const loadingEl = document.createElement('div');
        loadingEl.id = 'player-loading';
        loadingEl.className = 'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 bg-stone-900/95 border border-amber-600/50 rounded-full shadow-xl shadow-amber-900/20 backdrop-blur-sm';
        loadingEl.innerHTML = `
            <div id="loading-spinner" class="flex items-center gap-2">
                <svg class="w-5 h-5 text-amber-500 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10"/>
                </svg>
                <span class="text-amber-200 font-cinzel text-sm tracking-wider">Connecting...</span>
            </div>
            <div id="map-loading-indicator" class="hidden flex items-center gap-2">
                <svg class="w-5 h-5 text-amber-500 animate-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span class="text-amber-200 font-cinzel text-sm tracking-wider">Loading Map...</span>
            </div>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl; // Make accessible to map-image handler

        // Ping DM with retries until we get a response
        const ping = () => {
            if (bc) {
                console.log('[Player] Sending player-ready ping');
                bc.postMessage({ type: 'player-ready' });
            }
        };
        ping();
        const retryInterval = setInterval(ping, 2000);

        // Store references for main handler to use
        window._playerRetryInterval = retryInterval;
        window._playerLoadingEl = loadingEl;
    } else {
        // DM window: listen for player-ready pings and respond with full state
        if (bc) {
            console.log('[DM] Setting up player-ready listener');
            bc.onmessage = (evt) => {
                const data = evt.data;
                console.log('[DM] Received message:', data?.type);
                if (data?.type === 'player-ready') {
                    console.log('[DM] Responding to player-ready with full state');
                    broadcastFullState(); // Full sync with all token images
                }
            };
        }
    }

    // Wire the "Open Player View" button
    $('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'arcane-player-view',
            'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
});

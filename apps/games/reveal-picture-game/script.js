/**
 * INDEXED DB MANAGER
 * Handles persistence of Presets (contains images, state, etc.)
 * Migrates from V1 MysteryBoxDB to V2 KlassKitRevealDB
 */
const DB = {
    dbName: 'KlassKitRevealDB',
    dbVersion: 2, // Bumped to ensure store creation
    dataBase: null,

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const dataBase = event.target.result;
                if (!dataBase.objectStoreNames.contains('Presets')) {
                    const store = dataBase.createObjectStore('Presets', { keyPath: 'id' });
                    store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.dataBase = event.target.result;
                resolve(this.dataBase);
            };

            request.onerror = (event) => {
                console.error("IDB Error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    async getAllPresets() {
        if (!this.dataBase) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.dataBase.transaction(['Presets'], 'readonly');
            const store = transaction.objectStore('Presets');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async savePreset(preset) {
        if (!this.dataBase) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.dataBase.transaction(['Presets'], 'readwrite');
            const store = transaction.objectStore('Presets');
            const request = store.put(preset);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deletePreset(id) {
        if (!this.dataBase) await this.init();
        
        // Cloud Cleanup
        const user = await getCloudUser();
        if (user) {
            deleteFolder(`${user.id}/reveal_picture/${id}`).catch(e => console.warn("Cloud folder delete failed", e));
        }

        return new Promise((resolve, reject) => {
            const transaction = this.dataBase.transaction(['Presets'], 'readwrite');
            const store = transaction.objectStore('Presets');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Legacy Migration Helper
    migrateLegacyDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('MysteryBoxDB', 1);

            request.onsuccess = (event) => {
                const legacyDb = event.target.result;
                if (!legacyDb.objectStoreNames.contains('images')) {
                    legacyDb.close();
                    resolve(null);
                    return;
                }

                const transaction = legacyDb.transaction(['images'], 'readonly');
                const store = transaction.objectStore('images');
                const getAllRequest = store.getAll();

                getAllRequest.onsuccess = () => {
                    const results = getAllRequest.result;
                    legacyDb.close();
                    if (results && results.length > 0) {
                        resolve(results.map(item => item.data));
                    } else {
                        resolve(null);
                    }
                };

                getAllRequest.onerror = () => {
                    legacyDb.close();
                    resolve(null);
                };
            };

            request.onerror = () => resolve(null);

            // If it doesn't exist, it will trigger upgradeneeded, meaning no legacy data
            request.onupgradeneeded = (event) => {
                event.target.transaction.abort();
                resolve(null);
            }
        });
    }
};

// ==================== BROADCAST CHANNEL (Student View) ====================
const BROADCAST_CHANNEL = 'reveal-picture-sync';
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

let _broadcastThrottle = null;
let _lastBroadcastTime = 0;
let _lastBroadcastImageIndex = -1; // Track which index's src we last sent

function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;
    const now = performance.now();
    const minInterval = options.immediate ? 0 : 16;
    if (_broadcastThrottle) clearTimeout(_broadcastThrottle);
    const doBroadcast = () => { _lastBroadcastTime = performance.now(); _performBroadcast(); };
    const elapsed = now - _lastBroadcastTime;
    if (elapsed >= minInterval) { doBroadcast(); }
    else { _broadcastThrottle = setTimeout(doBroadcast, minInterval - elapsed); }
}

function getGameMode() {
    if (document.getElementById('zoom-container')) return 'zoom';
    if (document.getElementById('blur-container')) return 'blur';
    const pathname = window.location.pathname;
    if (pathname.includes('zoom')) return 'zoom';
    if (pathname.includes('blur')) return 'blur';
    return 'tiles';
}

function _performBroadcast() {
    // Read the already-resolved src from the DOM (set by loadLevel via resolveMediaUrl)
    // This is either a signed URL (cloud) or a DataURL (local) — both are usable by the student.
    const imgEl = document.getElementById('target-image');
    const resolvedSrc = (imgEl && imgEl.src && imgEl.src !== window.location.href) ? imgEl.src : null;

    // Only send imageSrc when the index changed (avoids resending large DataURLs on every tick)
    const indexChanged = Game.currentIndex !== _lastBroadcastImageIndex;
    if (indexChanged) _lastBroadcastImageIndex = Game.currentIndex;

    const mode = getGameMode();

    const payload = {
        type: 'state-update',
        mode,
        currentIndex: Game.currentIndex,
        totalImages: Game.images.length,
        imageSrc: (indexChanged && resolvedSrc) ? resolvedSrc : undefined,
        gridSize: Game.gridSize,
        revealedIndices: Game.revealedIndices,
        tilesRemaining: Game.tilesRemaining,
    };

    if (mode === 'zoom' && typeof ZoomGame !== 'undefined') {
        payload.zoomCurrentZoom = ZoomGame.currentZoom;
        payload.zoomPosition = ZoomGame.zoomPosition;
        payload.zoomRevealed = ZoomGame.revealed;
    } else if (mode === 'blur' && typeof BlurGame !== 'undefined') {
        payload.blurCurrentLevel = BlurGame.currentLevel;
        payload.blurMaxLevel = BlurGame.maxLevel;
        payload.blurRevealed = BlurGame.revealed;
    }

    bc.postMessage(payload);
}

function broadcastFullState() {
    _lastBroadcastImageIndex = -1; // Force image resend on next broadcast
    broadcastState({ immediate: true });
}

// ==================== STUDENT RECEIVER ====================
if (bc && IS_PLAYER_WINDOW) {
    bc.onmessage = async ({ data }) => {
        if (data.type !== 'state-update') return;

        // Stop retry pings and remove loading overlay
        if (window._playerRetryInterval) {
            clearInterval(window._playerRetryInterval);
            window._playerRetryInterval = null;
        }
        window._playerLoadingEl?.remove();
        window._playerLoadingEl = null;

        const img = document.getElementById('target-image');
        const emptyState = document.getElementById('empty-state');
        const roundDisplay = document.getElementById('student-round-display');

        if (!data.totalImages) {
            window._studentLastImageSrc = null;
            if (img) {
                img.removeAttribute('src');
                img.style.filter = '';
                img.style.transform = '';
            }
            if (emptyState) emptyState.style.display = 'flex';
            const tileGrid = document.getElementById('tile-grid');
            if (tileGrid) tileGrid.innerHTML = '';
            if (roundDisplay) roundDisplay.textContent = '0 / 0';
            return;
        }

        // Update image if new src provided
        if (img && data.imageSrc) {
            if (img.src !== data.imageSrc) img.src = data.imageSrc;
            window._studentLastImageSrc = data.imageSrc;
            // Hide the empty-state overlay (normally hidden by Game.start() which student never calls)
            if (emptyState) emptyState.style.display = 'none';
        } else if (img && !data.imageSrc && window._studentLastImageSrc && img.src !== window._studentLastImageSrc) {
            img.src = window._studentLastImageSrc;
            if (emptyState) emptyState.style.display = 'none';
        }

        // Update round counter (student toolbar uses id="student-round-display")
        if (roundDisplay) roundDisplay.textContent = `${data.currentIndex + 1} / ${data.totalImages}`;

        if (data.mode === 'tiles') {
            // Sync tiles
            Game.gridSize = data.gridSize;
            Game.revealedIndices = data.revealedIndices || [];
            Game.tilesRemaining = data.tilesRemaining;
            if (img?.src && img.src !== window.location.href) Game.buildGrid();

        } else if (data.mode === 'zoom' && typeof ZoomGame !== 'undefined') {
            ZoomGame.currentZoom = data.zoomCurrentZoom ?? ZoomGame.zoomStart;
            ZoomGame.zoomPosition = data.zoomPosition || { x: 50, y: 50 };
            ZoomGame.revealed = Boolean(data.zoomRevealed);
            if (img) {
                img.style.transition = ZoomGame.revealed ? 'transform 0.25s ease-out' : 'none';
                img.style.transformOrigin = `${ZoomGame.zoomPosition.x}% ${ZoomGame.zoomPosition.y}%`;
                img.style.transform = `scale(${ZoomGame.currentZoom})`;
            }

        } else if (data.mode === 'blur' && typeof BlurGame !== 'undefined') {
            BlurGame.currentLevel = data.blurCurrentLevel ?? BlurGame.maxLevel;
            BlurGame.maxLevel = data.blurMaxLevel ?? BlurGame.maxLevel;
            BlurGame.revealed = Boolean(data.blurRevealed);
            if (img) {
                const blurPx = (BlurGame.currentLevel / 5) * 45;
                img.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
                img.style.transform = blurPx > 0 ? 'scale(1.08)' : 'scale(1)';
            }
        }
    };
}

/**
 * APP STATE & PRESET MANAGER
 */
const app = {
    presets: [],
    activePresetId: null,

    async init() {
        try {
            await DB.init();
            let storedPresets = await DB.getAllPresets();

            // Clean up any stray empty presets left in IndexedDB from earlier sessions
            const emptyPresets = (storedPresets || []).filter(p => !p.images || p.images.length === 0);
            for (const ep of emptyPresets) {
                await DB.deletePreset(ep.id);
            }
            storedPresets = (storedPresets || []).filter(p => p.images && p.images.length > 0);

            if (storedPresets.length === 0) {
                // Attempt Legacy Migration
                const legacyImages = await DB.migrateLegacyDB();
                let defaultImages = [];
                let title = "Default Game";

                if (legacyImages && legacyImages.length > 0) {
                    defaultImages = legacyImages;
                    title = "Migrated Offline DB";
                    UI.showToast("Migrated legacy images!", "info");
                }

                const defaultPreset = {
                    id: 'preset_' + Date.now(),
                    title: title,
                    images: defaultImages,
                    currentIndex: 0,
                    gridSize: 4,
                    lastAccessed: Date.now()
                };

                // Only save to DB if preset has images
                if (defaultImages.length > 0) {
                    await DB.savePreset(defaultPreset);
                }
                storedPresets = [defaultPreset];
            }

            // Sort by last accessed
            this.presets = storedPresets.sort((a, b) => b.lastAccessed - a.lastAccessed);

            // Recover last active if exists
            const savedActiveId = localStorage.getItem('mb_active_preset_id');
            let targetPreset = this.presets.find(p => p.id === savedActiveId);

            if (!targetPreset) targetPreset = this.presets[0];

            this.activePresetId = targetPreset.id;

            this.renderPresetDropdown();
            this.loadPresetData(targetPreset);

            // Cloud Sync
            if (!isSandbox()) {
                await this.loadFromCloud();
            }
            this.syncToCloud();

        } catch (e) {
            console.error("App Init Error:", e);
            UI.showToast("Failed to initialize database", "error");
        }
    },

    async syncToCloud() {
        if (window.syncTimeout) clearTimeout(window.syncTimeout);
        window.syncTimeout = setTimeout(() => {
            // Only sync presets that actually have cloud image URLs (never sync empty sets)
            const metadata = this.presets
                .map(p => ({
                    id: p.id,
                    title: p.title,
                    images: (p.images || []).filter(img => typeof img === 'string' && img.startsWith('http')),
                    currentIndex: p.currentIndex,
                    gridSize: p.gridSize,
                    lastAccessed: p.lastAccessed
                }))
                .filter(p => p.images.length > 0);

            const activeHasCloud = metadata.some(p => p.id === this.activePresetId);
            saveProgress('reveal_picture', {
                presets: metadata,
                activePresetId: activeHasCloud ? this.activePresetId : (metadata[0]?.id || null)
            });
        }, 2000);
    },

    async loadFromCloud() {
        const cloudData = await loadProgress('reveal_picture');
        if (cloudData && cloudData.presets) {
            // Update local presets with cloud metadata if they match by ID
            let changed = false;
            for (const cp of cloudData.presets) {
                // Never import empty presets from cloud
                if (!cp.images || cp.images.length === 0) continue;

                const local = this.presets.find(p => p.id === cp.id);
                if (local) {
                    local.title = cp.title;
                    local.currentIndex = cp.currentIndex;
                    local.gridSize = cp.gridSize;
                    local.lastAccessed = cp.lastAccessed;
                    local.revealedIndices = cp.revealedIndices || local.revealedIndices || [];
                    local.images = cp.images;

                    await DB.savePreset(local);
                    changed = true;
                } else {
                    // New preset from another device
                    const newPreset = { ...cp, images: cp.images };
                    this.presets.push(newPreset);
                    await DB.savePreset(newPreset);
                    changed = true;
                }
            }
            // Drop placeholder empty preset if cloud provided real presets
            if (this.presets.some(p => p.images && p.images.length > 0)) {
                this.presets = this.presets.filter(p => p.images && p.images.length > 0);
            }
            if (cloudData.activePresetId && this.presets.some(p => p.id === cloudData.activePresetId)) {
                this.activePresetId = cloudData.activePresetId;
                localStorage.setItem('mb_active_preset_id', this.activePresetId);
            }
            if (changed) {
                this.presets.sort((a, b) => b.lastAccessed - a.lastAccessed);
                this.renderPresetDropdown();
                const target = this.presets.find(p => p.id === this.activePresetId) || this.presets[0];
                this.loadPresetData(target);
            }
        }
    },

    renderPresetDropdown() {
        const menu = document.getElementById('preset-dropdown-menu');
        const label = document.getElementById('preset-dropdown-label');
        
        if (!menu) return;
        
        // Update label
        const activePreset = this.presets.find(p => p.id === this.activePresetId);
        if (label && activePreset) {
            const count = activePreset.images ? activePreset.images.length : 0;
            label.textContent = count > 0 ? `${activePreset.title} (${count})` : `${activePreset.title} (Empty)`;
        }
        
        const canDelete = this.presets.length > 1;
        // Build dropdown items with image count & delete buttons
        menu.innerHTML = this.presets.map(p => {
            const count = p.images ? p.images.length : 0;
            const isActive = p.id === this.activePresetId;
            return `
            <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-600 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer transition-colors ${isActive ? 'bg-blue/10 dark:bg-blue/20' : ''}" onclick="app.selectPreset('${p.id}')">
                <span class="font-body font-bold text-sm text-dark dark:text-slate-200 truncate flex-1 pointer-events-none">${p.title}</span>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 pointer-events-none ${count > 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'}">${count > 0 ? `${count} img` : 'Empty'}</span>
                ${canDelete ? `<button onclick="app.deletePresetById('${p.id}', event)" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0" title="Delete Preset">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>` : ''}
            </div>`;
        }).join('');
        
        lucide.createIcons();
    },

    togglePresetDropdown() {
        const menu = document.getElementById('preset-dropdown-menu');
        if (!menu) return;
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden');
            if (!this._boundCloseDropdown) {
                this._boundCloseDropdown = (e) => this.closeDropdownOnClickOutside(e);
            }
            setTimeout(() => {
                document.addEventListener('click', this._boundCloseDropdown);
            }, 0);
        } else {
            menu.classList.add('hidden');
            if (this._boundCloseDropdown) {
                document.removeEventListener('click', this._boundCloseDropdown);
            }
        }
    },

    closeDropdownOnClickOutside(e) {
        const container = document.getElementById('preset-dropdown-container');
        if (container && !container.contains(e.target)) {
            const menu = document.getElementById('preset-dropdown-menu');
            if (menu) menu.classList.add('hidden');
            if (this._boundCloseDropdown) {
                document.removeEventListener('click', this._boundCloseDropdown);
            }
        }
    },

    selectPreset(id) {
        this.switchPreset(id);
        this.togglePresetDropdown();
    },

    async deletePresetById(id, event) {
        if (event) event.stopPropagation();
        
        // Prevent deleting the last preset
        if (this.presets.length <= 1) {
            UI.showToast("Cannot delete the last remaining preset.", "error");
            return;
        }
        
        const preset = this.presets.find(p => p.id === id);
        if (!preset) return;
        
        // Delete from DB
        await DB.deletePreset(id);
        
        // Remove from array
        this.presets = this.presets.filter(p => p.id !== id);
        
        // If we deleted the active preset, switch to another one
        if (id === this.activePresetId) {
            this.activePresetId = this.presets[0].id;
            localStorage.setItem('mb_active_preset_id', this.activePresetId);
            this.loadPresetData(this.presets[0]);
        }
        
        this.renderPresetDropdown();
        this.syncToCloud();
        UI.showToast(`Deleted "${preset.title}"`, "success");
    },

    loadPresetData(preset) {
        this.activePresetId = preset.id;
        document.getElementById('preset-title').value = preset.title;

        // Only persist non-empty presets to IndexedDB
        preset.lastAccessed = Date.now();
        if (preset.images && preset.images.length > 0) {
            DB.savePreset(preset);
            localStorage.setItem('mb_active_preset_id', preset.id);
        }

        this.renderPresetDropdown();

        // Load Game State
        Game.gridSize = preset.gridSize || 4;
        const gridSlider = document.getElementById('grid-slider');
        const gridVal = document.getElementById('grid-val');
        if (gridSlider) gridSlider.value = Game.gridSize;
        if (gridVal) gridVal.textContent = `${Game.gridSize} x ${Game.gridSize}`;

        Game.images = preset.images || [];
        Game.currentIndex = preset.currentIndex || 0;
        Game.revealedIndices = preset.revealedIndices || [];

        if (Game.images.length > 0) {
            // Bounds check
            if (Game.currentIndex >= Game.images.length) Game.currentIndex = 0;
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'none';
            Game.loadLevel();
        } else {
            const emptyState = document.getElementById('empty-state');
            const targetImage = document.getElementById('target-image');
            const tileGrid = document.getElementById('tile-grid');
            const roundDisplay = document.getElementById('round-display');
            const nextBtn = document.getElementById('next-round-btn');
            const prevBtn = document.getElementById('prev-round-btn');
            
            if (emptyState) emptyState.style.display = 'flex';
            if (targetImage) {
                targetImage.removeAttribute('src');
                targetImage.style.filter = '';
                targetImage.style.transform = '';
            }
            if (tileGrid) tileGrid.innerHTML = '';
            if (roundDisplay) roundDisplay.textContent = "0 / 0";
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
            UI.updateCount(0);
            broadcastFullState();
        }
    },

    async saveCurrentState() {
        if (!this.activePresetId) return;
        const presetIndex = this.presets.findIndex(p => p.id === this.activePresetId);
        if (presetIndex === -1) return;

        const preset = this.presets[presetIndex];
        preset.images = Game.images;
        preset.currentIndex = Game.currentIndex;
        preset.gridSize = Game.gridSize;
        preset.revealedIndices = Game.revealedIndices || [];
        preset.lastAccessed = Date.now();

        if (preset.images && preset.images.length > 0) {
            await DB.savePreset(preset);
            localStorage.setItem('mb_active_preset_id', preset.id);
            this.syncToCloud();
        } else {
            // Remove from DB if emptied so empty sets do not persist across reloads
            await DB.deletePreset(preset.id);
            this.syncToCloud();
        }
        this.renderPresetDropdown();
    },

    async switchPreset(id) {
        if (id === this.activePresetId) return;
        const prevPreset = this.presets.find(p => p.id === this.activePresetId);
        const nextPreset = this.presets.find(p => p.id === id);
        if (!nextPreset) return;

        // Prune abandoned empty preset when switching to another preset
        if (prevPreset && (!prevPreset.images || prevPreset.images.length === 0) && this.presets.length > 1) {
            this.presets = this.presets.filter(p => p.id !== prevPreset.id);
        }

        this.loadPresetData(nextPreset);
    },

    async createNewPreset() {
        const activePreset = this.presets.find(p => p.id === this.activePresetId);
        if (activePreset && (!activePreset.images || activePreset.images.length === 0)) {
            document.getElementById('preset-title')?.focus();
            UI.showToast("Current session is already empty — add images to save it.", "info");
            return;
        }

        const newPreset = {
            id: 'preset_' + Date.now(),
            title: `Session ${this.presets.length + 1}`,
            images: [],
            currentIndex: 0,
            gridSize: 4,
            lastAccessed: Date.now()
        };

        this.presets.unshift(newPreset); // Add to top (in-memory until images are added)
        this.loadPresetData(newPreset);
        document.getElementById('preset-title')?.focus();
        UI.showToast("New session ready! Add images to save it.", "info");
    },

    async updatePresetTitle(newTitle) {
        if (!this.activePresetId) return;
        const presetIndex = this.presets.findIndex(p => p.id === this.activePresetId);
        if (presetIndex === -1) return;

        const trimmed = newTitle.trim();
        if (!trimmed) {
            document.getElementById('preset-title').value = this.presets[presetIndex].title;
            return;
        }

        if (this.presets[presetIndex].title !== trimmed) {
            this.presets[presetIndex].title = trimmed;
            document.getElementById('preset-title').value = trimmed;
            await this.saveCurrentState();
            UI.showToast("Title saved", "success");
        }
    },

// --- DELETION LOGIC ---
presetToDelete: null,
    deleteCurrentPreset() {
    if (this.presets.length <= 1) {
        UI.showToast("Cannot delete the last remaining preset.", "error");
        return;
    }
    const preset = this.presets.find(p => p.id === this.activePresetId);
    if (!preset) return;

    this.presetToDelete = preset;
    document.getElementById('delete-preset-name').textContent = preset.title;
    const modal = document.getElementById('delete-modal');
    const content = document.getElementById('delete-modal-content');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    requestAnimationFrame(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
},

closeDeleteModal() {
    this.presetToDelete = null;
    const modal = document.getElementById('delete-modal');
    const content = document.getElementById('delete-modal-content');

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
},

    async confirmDeletePreset() {
    if (!this.presetToDelete) return;

    const idToDelete = this.presetToDelete.id;
    await DB.deletePreset(idToDelete);

    this.presets = this.presets.filter(p => p.id !== idToDelete);

    this.closeDeleteModal();
    UI.showToast("Preset deleted", "success");

    // Load the first available
    this.loadPresetData(this.presets[0]);
    this.renderPresetDropdown();
    this.syncToCloud();
},

openImageManager() {
    const modal = document.getElementById('image-manager-modal');
    const content = document.getElementById('image-manager-content');

    this.renderImageManagerList();

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    requestAnimationFrame(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
},

closeImageManager() {
    const modal = document.getElementById('image-manager-modal');
    const content = document.getElementById('image-manager-content');

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
},

renderImageManagerList() {
    const list = document.getElementById('image-manager-list');
    document.getElementById('image-manager-count').textContent = `${Game.images.length} Image${Game.images.length === 1 ? '' : 's'}`;

    if (Game.images.length === 0) {
        list.innerHTML = `<div class="col-span-full h-32 flex flex-col items-center justify-center text-slate-400 font-bold font-body"><i data-lucide="image-minus" class="w-8 h-8 mb-3 opacity-50"></i>No images in this preset.</div>`;
        lucide.createIcons();
        return;
    }

    list.innerHTML = Game.images.map((imgSrc, index) => `
            <div class="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 shadow-sm">
                <img src="${imgSrc}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button onclick="app.deleteImage(${index})" class="p-3 bg-red-500 text-white rounded-xl hover:scale-110 hover:bg-red-600 transition-all shadow-hard-sm active:scale-95 active:shadow-none translate-y-2 group-hover:translate-y-0" title="Delete Image">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border-[1px] border-white/20">
                    #${index + 1}
                </div>
            </div>
        `).join('');
    lucide.createIcons();
},

    async deleteImage(index) {
    if (index < 0 || index >= Game.images.length) return;

    const url = Game.images[index];
    if (url && url.includes('klasskit-media')) {
        deleteMediaFromUrl(url).catch(e => console.error("Cloud delete failed", e));
    }

    Game.images.splice(index, 1);

    // Keep current index bounded
    if (Game.currentIndex >= Game.images.length) {
        Game.currentIndex = Math.max(0, Game.images.length - 1);
    }

    await this.saveCurrentState();
    this.renderImageManagerList();

    // Update game view
    this.loadPresetData(this.presets.find(p => p.id === this.activePresetId));
    UI.showToast("Image removed", "success");
},

    async clearActiveImages() {
    const confirmed = await showConfirmModal("Are you sure you want to remove ALL images from this preset?", {
        title: "Remove All Images?",
        confirmText: "Remove",
        cancelText: "Keep",
        icon: "trash-2",
        iconColor: "red"
    });
    if (!confirmed) return;
    Game.images = [];
    Game.currentIndex = 0;
    await this.saveCurrentState();
    this.renderImageManagerList();
    this.loadPresetData(this.presets.find(p => p.id === this.activePresetId));
    this.closeImageManager();
    UI.showToast("All images cleared", "success");
}
};

/**
 * AUDIO CONTROLLER
 */
const Audio = {
    enabled: true,
    init: async () => { await Tone.start(); },

    toggle: () => {
        Audio.enabled = !Audio.enabled;
        const btn = document.getElementById('sound-toggle');
        const icon = Audio.enabled ? 'volume-2' : 'volume-x';
        btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;
        if (!Audio.enabled) btn.classList.add('text-pink');
        else btn.classList.remove('text-pink');
        lucide.createIcons();
        localStorage.setItem('mb_audio', Audio.enabled);
    },

    playPop: () => {
        if (!Audio.enabled) return;
        const notes = ["C3", "E3", "G3", "A3"];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.4 }
        }).toDestination();
        synth.triggerAttackRelease(note, "32n");
    },

    playWin: () => {
        if (!Audio.enabled) return;
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        const now = Tone.now();
        synth.triggerAttackRelease(["C4", "E4", "G4"], "8n", now);
        synth.triggerAttackRelease(["E4", "G4", "C5"], "8n", now + 0.1);
        synth.triggerAttackRelease(["G4", "C5", "E5"], "4n", now + 0.2);
    }
};

/**
 * AUTO REVEAL CONTROLLER
 */
const AutoReveal = {
    intervalId: null,
    speed: 1500,
    isPlaying: false,

    init() {
        const slider = document.getElementById('speed-slider');
        const label = document.getElementById('speed-label');
        if (!slider) return; // Skip if not in tile mode

        slider.addEventListener('input', (e) => {
            AutoReveal.speed = parseInt(e.target.value);
            label.innerText = (AutoReveal.speed / 1000).toFixed(1) + 's';

            if (AutoReveal.isPlaying) {
                AutoReveal.stop();
                AutoReveal.start();
            }
        });
    },

    toggle() {
        if (this.isPlaying) this.stop();
        else this.start();
    },

    start() {
        if (Game.tilesRemaining <= 0) return;

        this.isPlaying = true;
        const btn = document.getElementById('auto-reveal-btn');

        btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i> <span class="hidden md:inline">PAUSE</span>`;
        btn.classList.replace('bg-blue', 'bg-white');
        btn.classList.replace('text-white', 'text-blue');
        btn.classList.add('dark:bg-slate-800', 'border-blue');
        lucide.createIcons();

        this.intervalId = setInterval(() => {
            const tiles = Array.from(document.querySelectorAll('.tile:not(.revealed)'));
            if (tiles.length === 0) {
                this.stop();
                return;
            }
            const randomTile = tiles[Math.floor(Math.random() * tiles.length)];
            const idx = parseInt(randomTile.dataset.index, 10);
            Game.revealTile(randomTile, Number.isNaN(idx) ? undefined : idx);
        }, this.speed);
    },

    stop() {
        this.isPlaying = false;
        clearInterval(this.intervalId);

        const btn = document.getElementById('auto-reveal-btn');
        if (!btn) return;

        btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i> <span class="hidden md:inline">AUTO</span>`;
        btn.classList.replace('bg-white', 'bg-blue');
        btn.classList.replace('text-blue', 'text-white');
        btn.classList.remove('dark:bg-slate-800', 'border-blue');
        lucide.createIcons();
    }
};

/**
 * CORE GAME ENGINE
 */
const Game = {
    images: [], // Array of strings (DataURLs)
    currentIndex: 0,
    gridSize: 4,
    tilesRemaining: 0,
    revealedIndices: [], // Track which tiles are revealed
    _revealAllTimeout: null,

    async init() {
        // Restore Theme
        const savedTheme = localStorage.getItem('theme_reveal-picture');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const savedAudio = localStorage.getItem('mb_audio');
        if (savedAudio === 'false') Audio.toggle();

        // Init modules
        AutoReveal.init();

        await requireAuth();
    },

    start(fileList, restoring = false) {
        if (!fileList || fileList.length === 0) return;

        // Merge new files into existing if not restoring
        if (!restoring) {
            this.images = [...this.images, ...fileList];
        } else {
            this.images = fileList;
        }

        document.getElementById('empty-state').style.display = 'none';

        // If not restoring, jump to the first new image (or stay if just appending)
        if (!restoring && this.images.length === fileList.length) {
            this.currentIndex = 0;
            this.revealedIndices = [];
        }

        this.loadLevel();

        if (window.innerWidth < 768) UI.togglePanel(true);
    },

    async loadLevel() {
        if (!this.images || this.images.length === 0) return;

        if (this._revealAllTimeout) {
            clearTimeout(this._revealAllTimeout);
            this._revealAllTimeout = null;
        }

        // Bounds check
        if (this.currentIndex >= this.images.length) this.currentIndex = 0;
        if (this.currentIndex < 0) this.currentIndex = this.images.length - 1;

        // Update Image — resolve signed/DataURL first, then set src
        const resolvedSrc = await resolveMediaUrl(this.images[this.currentIndex]);
        document.getElementById('target-image').src = resolvedSrc;
        document.getElementById('round-display').textContent = `${this.currentIndex + 1} / ${this.images.length}`;

        // Reset State
        document.getElementById('next-round-btn').disabled = true;
        const prevBtn = document.getElementById('prev-round-btn');
        if (prevBtn) prevBtn.disabled = true;
        AutoReveal.stop();
        this.buildGrid();

        // Broadcast after image src is in the DOM so _performBroadcast picks up the resolved URL
        broadcastFullState();
    },

    buildGrid() {
        const grid = document.getElementById('tile-grid');
        if (!grid) return; // Skip if not in tile mode
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

        const totalTiles = this.gridSize * this.gridSize;
        this.tilesRemaining = totalTiles - this.revealedIndices.length;
        UI.updateCount(this.tilesRemaining);

        for (let i = 0; i < totalTiles; i++) {
            const tile = document.createElement('div');
            const isRevealed = this.revealedIndices.includes(i);
            tile.className = 'tile' + (isRevealed ? ' revealed' : '');
            tile.dataset.index = i;
            
            const numColor = (i % 2 === 0) ? 'text-slate-200' : 'text-slate-300';
            tile.innerHTML = `<span class="text-3xl font-heading ${numColor} pointer-events-none select-none">${i + 1}</span>`;

            tile.onmousedown = () => this.revealTile(tile, i);
            // Student view: tiles are read-only (no click)
            if (IS_PLAYER_WINDOW) tile.onmousedown = null;
            grid.appendChild(tile);
        }

        if (this.tilesRemaining <= 0) this.win();
    },

    revealTile(tile, index) {
        if (tile.classList.contains('revealed')) return;
        if (Tone.context.state !== 'running') Tone.start();

        const resolvedIndex = index !== undefined ? index : parseInt(tile.dataset.index, 10);
        tile.classList.add('revealed');
        if (!Number.isNaN(resolvedIndex) && !this.revealedIndices.includes(resolvedIndex)) {
            this.revealedIndices.push(resolvedIndex);
        }
        
        this.tilesRemaining--;
        UI.updateCount(this.tilesRemaining);
        Audio.playPop();
        broadcastState();
        app.saveCurrentState();

        if (this.tilesRemaining <= 0) this.win();
    },

    revealAll() {
        if (this.tilesRemaining === 0) return;

        AutoReveal.stop();
        const tiles = document.querySelectorAll('.tile:not(.revealed)');

        tiles.forEach((t, i) => {
            setTimeout(() => {
                t.classList.add('revealed');
                if (i % 3 === 0) Audio.playPop();
            }, i * 30);
        });

        if (this._revealAllTimeout) clearTimeout(this._revealAllTimeout);
        this._revealAllTimeout = setTimeout(() => {
            this._revealAllTimeout = null;
            this.tilesRemaining = 0;
            this.revealedIndices = Array.from({length: this.gridSize * this.gridSize}, (_, i) => i);
            UI.updateCount(0);
            broadcastState({ immediate: true });
            this.win();
        }, tiles.length * 30 + 100);
    },

    win() {
        Audio.playWin();
        UI.fireConfetti();
        AutoReveal.stop();

        const btn = document.getElementById('next-round-btn');
        btn.disabled = false;
        btn.classList.add('animate-bounce');
        setTimeout(() => btn.classList.remove('animate-bounce'), 1000);

        const prevBtn = document.getElementById('prev-round-btn');
        if (prevBtn) {
            prevBtn.disabled = false;
            prevBtn.classList.add('animate-bounce');
            setTimeout(() => prevBtn.classList.remove('animate-bounce'), 1000);
        }
        
        // Save full revealed state
        this.revealedIndices = Array.from({length: this.gridSize * this.gridSize}, (_, i) => i);
        app.saveCurrentState();
    },

    resetLevel() {
        if (this._revealAllTimeout) {
            clearTimeout(this._revealAllTimeout);
            this._revealAllTimeout = null;
        }
        this.revealedIndices = [];
        this.buildGrid();
        AutoReveal.stop();
        broadcastState({ immediate: true });
        app.saveCurrentState();
    },

    nextLevel() {
        this.currentIndex++;
        if (this.currentIndex >= this.images.length) this.currentIndex = 0;
        this.revealedIndices = [];
        this.loadLevel();
        app.saveCurrentState();
    },

    prevLevel() {
        this.currentIndex--;
        if (this.currentIndex < 0) this.currentIndex = this.images.length - 1;
        this.revealedIndices = [];
        this.loadLevel();
        app.saveCurrentState();
    },

    updateGridSize(val) {
        this.gridSize = parseInt(val);
        this.revealedIndices = []; // Indices are invalid if grid size changes
        document.getElementById('grid-val').textContent = `${val} x ${val}`;
        if (this.images.length > 0) this.buildGrid();
        broadcastState({ immediate: true });
        app.saveCurrentState();
    }
};

/**
 * UI MANAGER
 */
const UI = {
    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme_reveal-picture', isDark ? 'dark' : 'light');
    },

    togglePanel(forceHide) {
        const panel = document.getElementById('controls');
        const isHidden = window.innerWidth >= 768
            ? panel.classList.contains('hidden-panel-desktop')
            : panel.classList.contains('hidden-panel-mobile');

        if (forceHide || !isHidden) {
            panel.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
        } else {
            panel.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    },

    updateCount(num) {
        const countEl = document.getElementById('tiles-count');
        if (countEl) countEl.innerText = num;
    },

    fireConfetti() {
        const end = Date.now() + 1000;
        const colors = ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'];

        (function frame() {
            confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
            confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    },

    showToast(msg, type = 'info') {
        const t = document.getElementById('toast');
        const tMsg = document.getElementById('toast-msg');
        const tIcon = document.getElementById('toast-icon');

        t.classList.remove('border-green-500', 'border-red-500', 'border-blue-500');

        if (type === 'success') {
            t.classList.add('border-green-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="check-circle" class="w-5 h-5 text-green-500"></i>`;
        } else if (type === 'error') {
            t.classList.add('border-red-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>`;
        } else {
            t.classList.add('border-blue-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="info" class="w-5 h-5 text-blue-500"></i>`;
        }

        lucide.createIcons();
        tMsg.innerText = msg;

        t.classList.remove('opacity-0', 'translate-y-20');
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-20'), 3000);
    },

    toggleLoader(show) {
        const l = document.getElementById('db-loader');
        if (show) l.classList.remove('hidden');
        else l.classList.add('hidden');
    }
};

// --- EVENT BINDINGS ---

const gridSlider = document.getElementById('grid-slider');
if (gridSlider) {
    gridSlider.addEventListener('input', (e) => Game.updateGridSize(e.target.value));
}
const soundToggle = document.getElementById('sound-toggle');
if (soundToggle) {
    soundToggle.addEventListener('click', Audio.toggle);
}

// 2. File Loading & Persistence
const handleFiles = async (files) => {
    const list = [];
    UI.toggleLoader(true);
    const user = await getCloudUser();

    for (const f of Array.from(files)) {
        try {
            if (user) {
                const url = await uploadMedia(f, 'reveal_picture', app.activePresetId);
                list.push(url);
            } else {
                // Fallback to local DataURL (stored in IndexedDB by app.saveCurrentState)
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(f);
                });
                list.push(dataUrl);
            }
        } catch (err) {
            console.error("File processing failed:", err);
            UI.showToast("Failed to process some images", "error");
        }
    }

    if (list.length > 0) {
        Game.start(list);
        await app.saveCurrentState();
        UI.showToast(`Saved ${list.length} Images to Preset!`, "success");
    }
    UI.toggleLoader(false);
};

document.getElementById('file-input').addEventListener('change', (e) => handleFiles(e.target.files));

// 3. Drag & Drop
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
    if (e.clientX === 0 && e.clientY === 0) document.body.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
});

// 4. Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    if (Game.images.length === 0) return;

    const mode = getGameMode();
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (mode === 'zoom') ZoomGame.toggleAuto();
            else if (mode === 'blur') BlurGame.toggleAuto();
            else AutoReveal.toggle();
            break;
        case 'KeyR':
            if (mode === 'zoom') ZoomGame.reset();
            else if (mode === 'blur') BlurGame.reset();
            else Game.resetLevel();
            break;
        case 'KeyN': {
            const canAdvance = mode === 'zoom' ? ZoomGame.revealed : mode === 'blur' ? BlurGame.revealed : Game.tilesRemaining <= 0;
            if (canAdvance) Game.nextLevel();
            break;
        }
        case 'KeyP': {
            const canAdvance = mode === 'zoom' ? ZoomGame.revealed : mode === 'blur' ? BlurGame.revealed : Game.tilesRemaining <= 0;
            if (canAdvance) Game.prevLevel();
            break;
        }
    }
});

window.addEventListener('resize', () => {
    const panel = document.getElementById('controls');
    if (window.innerWidth >= 768) panel.classList.remove('hidden-panel-mobile');
    else panel.classList.remove('hidden-panel-desktop');
});

// Init
window.onload = async () => {
    lucide.createIcons();

    if (IS_PLAYER_WINDOW) {
        // ── STUDENT WINDOW ──
        document.documentElement.classList.add('player-mode');
        document.title = 'Student View | Reveal Picture';

        // Hide teacher-only chrome
        const controls = document.getElementById('controls');
        if (controls) controls.style.display = 'none';

        // Hide the top action bar inside <main> (PREV/NEXT/REVEAL buttons etc.)
        const actionBar = document.getElementById('main-action-bar');
        if (actionBar) actionBar.style.display = 'none';

        // Hide student view button itself
        const btnOpenPlayer = document.getElementById('btn-open-player');
        if (btnOpenPlayer) btnOpenPlayer.style.display = 'none';

        // Show student toolbar
        document.getElementById('player-toolbar')?.classList.remove('hidden');

        // Restore theme only
        const savedTheme = localStorage.getItem('theme_reveal-picture');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        }

        // Loading overlay
        const loadingEl = document.createElement('div');
        loadingEl.id = 'player-loading';
        loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 border-2 border-dark dark:border-white/20 rounded-full shadow-neo backdrop-blur-sm';
        loadingEl.innerHTML = `
            <svg class="w-4 h-4 text-blue animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg>
            <span class="font-heading font-bold text-xs text-slate-500 uppercase tracking-widest">Connecting to teacher...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;

        // Ping host until first state-update arrives
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping();
        window._playerRetryInterval = setInterval(ping, 2000);

    } else {
        // ── HOST WINDOW ──
        const mode = getGameMode();
        if (mode === 'zoom') ZoomGame.init();
        else if (mode === 'blur') BlurGame.init();

        await app.init();
        await Game.init();

        if (window.innerWidth < 768) UI.togglePanel(true);

        // Respond to student-ready pings
        if (bc) {
            bc.onmessage = (evt) => {
                if (evt.data?.type === 'player-ready') broadcastFullState();
            };
        }

        // Wire Student View button
        document.getElementById('btn-open-player')?.addEventListener('click', () => {
            window.open(
                window.location.pathname + '?player=1',
                'reveal-picture-student-view',
                'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
            );
        });
    }

    lucide.createIcons();
};

// ==================== ZOOM MODE ====================
const ZoomGame = {
    currentZoom: 3.0,
    zoomStart: 3.0,
    zoomPosition: { x: 50, y: 50 },
    isAutoZooming: false,
    animationId: null,
    revealed: false,
    _lastFrameTime: 0,
    
    init() {
        const startSlider = document.getElementById('zoom-start-slider');
        const startVal = document.getElementById('zoom-start-val');
        if (startSlider) {
            this.zoomStart = parseFloat(startSlider.value) || 3.0;
            this.currentZoom = this.zoomStart;
            if (startVal) startVal.textContent = this.zoomStart.toFixed(1) + 'x';
            const display = document.getElementById('zoom-display');
            if (display) display.textContent = this.zoomStart.toFixed(1) + 'x';

            startSlider.addEventListener('input', (e) => {
                this.zoomStart = parseFloat(e.target.value);
                if (startVal) startVal.textContent = this.zoomStart.toFixed(1) + 'x';
                if (!this.isAutoZooming && !this.revealed) {
                    this.currentZoom = this.zoomStart;
                    this.updateZoom();
                }
            });
        }

        const speedLabels = ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'];
        const speedSlider = document.getElementById('zoom-speed-slider');
        const speedVal = document.getElementById('zoom-speed-val');
        if (speedSlider) {
            const idx = Math.max(0, Math.min(4, (parseInt(speedSlider.value, 10) || 3) - 1));
            if (speedVal) speedVal.textContent = speedLabels[idx];
            speedSlider.addEventListener('input', (e) => {
                if (speedVal) speedVal.textContent = speedLabels[parseInt(e.target.value, 10) - 1];
            });
        }
    },

    pickZoomPoint(img) {
        // Compute a random point inside the actual rendered image area (accounting for object-fit: contain)
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0 && img.clientWidth > 0 && img.clientHeight > 0) {
            const boxW = img.clientWidth;
            const boxH = img.clientHeight;
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const boxRatio = boxW / boxH;

            let renderW, renderH, offsetX, offsetY;
            if (imgRatio > boxRatio) {
                renderW = boxW;
                renderH = boxW / imgRatio;
                offsetX = 0;
                offsetY = (boxH - renderH) / 2;
            } else {
                renderH = boxH;
                renderW = boxH * imgRatio;
                offsetX = (boxW - renderW) / 2;
                offsetY = 0;
            }

            const rx = offsetX + (0.2 + Math.random() * 0.6) * renderW;
            const ry = offsetY + (0.2 + Math.random() * 0.6) * renderH;
            return {
                x: Math.round((rx / boxW) * 1000) / 10,
                y: Math.round((ry / boxH) * 1000) / 10
            };
        }
        return {
            x: 25 + Math.random() * 50,
            y: 25 + Math.random() * 50
        };
    },

    reset(shouldBroadcast = true) {
        this.stopAutoZoom();
        this.revealed = false;
        this.currentZoom = this.zoomStart;
        const img = document.getElementById('target-image');
        this.zoomPosition = this.pickZoomPoint(img);

        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.add('hidden');

        // Apply zoom immediately so the image never appears unzoomed
        if (img) {
            img.style.transition = 'transform 0.25s ease-out';
            img.style.transformOrigin = `${this.zoomPosition.x}% ${this.zoomPosition.y}%`;
            img.style.transform = `scale(${this.currentZoom})`;
            img.onload = () => {
                if (!this.revealed && !this.isAutoZooming) {
                    this.zoomPosition = this.pickZoomPoint(img);
                    this.updateZoom(true);
                }
            };
        }

        const display = document.getElementById('zoom-display');
        if (display) display.textContent = this.currentZoom.toFixed(1) + 'x';
        this.updateZoomBar();
        
        const btn = document.getElementById('auto-zoom-btn');
        if (btn) {
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO ZOOM</span>`;
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
            btn.classList.add('bg-blue', 'text-white');
            lucide.createIcons();
        }

        if (shouldBroadcast) broadcastState({ immediate: true });
    },

    updateZoom(immediate = false) {
        const img = document.getElementById('target-image');
        if (!img || !img.src || img.src === window.location.href) return;
        const scale = this.currentZoom;
        const x = this.zoomPosition.x;
        const y = this.zoomPosition.y;
        // Center the zoom point and apply scale
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = `scale(${scale})`;
        const display = document.getElementById('zoom-display');
        if (display) display.textContent = scale.toFixed(1) + 'x';
        this.updateZoomBar();
        broadcastState({ immediate });
    },

    updateZoomBar() {
        const bar = document.getElementById('zoom-bar');
        if (!bar) return;
        const denom = Math.max(0.1, this.zoomStart - 1);
        const percent = 100 - ((this.currentZoom - 1) / denom) * 100;
        bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    },

    startAutoZoom() {
        if (this.isAutoZooming || this.revealed) return;
        this.isAutoZooming = true;
        const img = document.getElementById('target-image');
        if (img) img.style.transition = 'none';

        const speedSlider = document.getElementById('zoom-speed-slider');
        const speedMultiplier = speedSlider ? parseInt(speedSlider.value, 10) : 3;
        // Scale-per-second so auto-zoom feels smooth and consistent across refresh rates
        const zoomPerSecond = 0.18 * speedMultiplier;
        this._lastFrameTime = performance.now();
        
        const animate = (now) => {
            if (!this.isAutoZooming || this.revealed) return;
            const dt = Math.min(0.1, (now - this._lastFrameTime) / 1000);
            this._lastFrameTime = now;
            this.currentZoom = Math.max(1.0, this.currentZoom - zoomPerSecond * dt);
            this.updateZoom();
            if (this.currentZoom <= 1.01) {
                this.revealComplete();
            } else {
                this.animationId = requestAnimationFrame(animate);
            }
        };
        this.animationId = requestAnimationFrame(animate);
    },

    stopAutoZoom() {
        this.isAutoZooming = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        const img = document.getElementById('target-image');
        if (img) img.style.transition = 'transform 0.15s ease-out';
    },

    revealComplete() {
        this.stopAutoZoom();
        this.revealed = true;
        this.currentZoom = 1.0;
        const img = document.getElementById('target-image');
        if (img) img.style.transition = 'transform 0.3s ease-out';
        this.updateZoom(true);
        Audio.playWin();
        UI.fireConfetti();
        const btn = document.getElementById('next-round-btn');
        if (btn) btn.disabled = false;
        const prevBtn = document.getElementById('prev-round-btn');
        if (prevBtn) prevBtn.disabled = false;
    },

    toggleAuto() {
        if (this.isAutoZooming) {
            this.stopAutoZoom();
            const btn = document.getElementById('auto-zoom-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO ZOOM</span>`;
                btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
                btn.classList.add('bg-blue', 'text-white');
                lucide.createIcons();
            }
        } else {
            this.startAutoZoom();
            const btn = document.getElementById('auto-zoom-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">PAUSE</span>`;
                btn.classList.remove('bg-blue', 'text-white');
                btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
                lucide.createIcons();
            }
        }
    },

    revealAll() {
        this.stopAutoZoom();
        this.revealComplete();
    }
};

// ==================== BLUR MODE ====================
const BlurGame = {
    currentLevel: 4,
    maxLevel: 4,
    isAutoRevealing: false,
    animationId: null,
    revealed: false,
    
    init() {
        const blurSlider = document.getElementById('blur-start-slider');
        const blurVal = document.getElementById('blur-start-val');
        if (blurSlider) {
            const labels = ['Low', 'Medium', 'High', 'Very High', 'Extreme'];
            this.maxLevel = parseInt(blurSlider.value, 10) || 4;
            this.currentLevel = this.maxLevel;
            if (blurVal) blurVal.textContent = labels[this.maxLevel - 1];

            blurSlider.addEventListener('input', (e) => {
                this.maxLevel = parseInt(e.target.value, 10);
                if (blurVal) blurVal.textContent = labels[this.maxLevel - 1];
                if (!this.isAutoRevealing && !this.revealed) {
                    this.currentLevel = this.maxLevel;
                    this.updateEffect();
                }
            });
        }

        const speedLabels = ['Very Slow', 'Slow', 'Medium', 'Fast', 'Very Fast'];
        const speedSlider = document.getElementById('blur-speed-slider');
        const speedVal = document.getElementById('blur-speed-val');
        if (speedSlider) {
            const idx = Math.max(0, Math.min(4, (parseInt(speedSlider.value, 10) || 3) - 1));
            if (speedVal) speedVal.textContent = speedLabels[idx];
            speedSlider.addEventListener('input', (e) => {
                if (speedVal) speedVal.textContent = speedLabels[parseInt(e.target.value, 10) - 1];
            });
        }
    },

    reset() {
        this.stopAutoReveal();
        this.revealed = false;
        this.currentLevel = this.maxLevel;
        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.add('hidden');
        this.updateEffect(true);
        
        const btn = document.getElementById('auto-blur-btn');
        if (btn) {
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO REVEAL</span>`;
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
            btn.classList.add('bg-blue', 'text-white');
            lucide.createIcons();
        }
    },

    updateEffect(immediate = false) {
        const img = document.getElementById('target-image');
        if (!img) return;
        
        const blurPx = (this.currentLevel / 5) * 45;
        img.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
        img.style.transform = blurPx > 0 ? 'scale(1.08)' : 'scale(1)';
        
        const display = document.getElementById('blur-display');
        if (display) {
            const clarity = Math.round((1 - this.currentLevel / this.maxLevel) * 100);
            display.textContent = clarity + '%';
        }
        this.updateBlurBar();
        broadcastState({ immediate });
    },

    updateBlurBar() {
        const bar = document.getElementById('blur-bar');
        if (!bar) return;
        const percent = (1 - this.currentLevel / this.maxLevel) * 100;
        bar.style.width = percent + '%';
    },

    startAutoReveal() {
        if (this.isAutoRevealing || this.revealed) return;
        this.isAutoRevealing = true;
        const speedSlider = document.getElementById('blur-speed-slider');
        const speedMultiplier = speedSlider ? parseInt(speedSlider.value, 10) : 3;
        const stepDelay = 600 / speedMultiplier;
        
        const step = () => {
            if (!this.isAutoRevealing || this.revealed) return;
            if (this.currentLevel > 0) {
                this.currentLevel -= 0.5;
                if (this.currentLevel < 0) this.currentLevel = 0;
                this.updateEffect();
                if (this.currentLevel > 0) {
                    this.animationId = setTimeout(() => requestAnimationFrame(step), stepDelay);
                } else {
                    this.revealComplete();
                }
            }
        };
        step();
    },

    stopAutoReveal() {
        this.isAutoRevealing = false;
        if (this.animationId) {
            clearTimeout(this.animationId);
            this.animationId = null;
        }
    },

    revealComplete() {
        this.stopAutoReveal();
        this.revealed = true;
        this.currentLevel = 0;
        this.updateEffect(true);
        Audio.playWin();
        UI.fireConfetti();
        const btn = document.getElementById('next-round-btn');
        if (btn) btn.disabled = false;
        const prevBtn = document.getElementById('prev-round-btn');
        if (prevBtn) prevBtn.disabled = false;
    },

    toggleAuto() {
        if (this.isAutoRevealing) {
            this.stopAutoReveal();
            const btn = document.getElementById('auto-blur-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO REVEAL</span>`;
                btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
                btn.classList.add('bg-blue', 'text-white');
                lucide.createIcons();
            }
        } else {
            this.startAutoReveal();
            const btn = document.getElementById('auto-blur-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">PAUSE</span>`;
                btn.classList.remove('bg-blue', 'text-white');
                btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-blue', 'border-blue');
                lucide.createIcons();
            }
        }
    },

    revealAll() {
        this.stopAutoReveal();
        this.currentLevel = 0;
        this.revealComplete();
    }
};

// ==================== AUTO CONTROLLERS ====================
const AutoZoom = {
    toggle: () => ZoomGame.toggleAuto()
};

const AutoBlur = {
    toggle: () => BlurGame.toggleAuto()
};

// ==================== MODE OVERRIDES ====================
const currentMode = getGameMode();
if (currentMode === 'zoom') {
    const originalLoadLevel = Game.loadLevel;
    Game.loadLevel = async function() {
        // Pre-apply zoom so the image is never visible unzoomed during transition
        const img = document.getElementById('target-image');
        if (img) {
            img.style.transition = 'none';
            img.style.transform = `scale(${ZoomGame.zoomStart})`;
        }
        ZoomGame.currentZoom = ZoomGame.zoomStart;
        ZoomGame.revealed = false;
        await originalLoadLevel.call(this);
        ZoomGame.reset(true);
    };
    Game.resetZoom = () => ZoomGame.reset();
    Game.revealAll = () => ZoomGame.revealAll();
    Game.checkGuess = () => {
        const input = document.getElementById('guess-input');
        const guess = input.value.trim().toLowerCase();
        const modal = document.getElementById('guess-modal');
        const content = document.getElementById('guess-modal-content');
        const icon = document.getElementById('guess-result-icon');
        const title = document.getElementById('guess-result-title');
        const msg = document.getElementById('guess-result-msg');
        
        if (guess.length > 2) {
            icon.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 bg-green-100 text-green-500 border-green-200';
            icon.innerHTML = '<i data-lucide="check-circle" class="w-8 h-8"></i>';
            title.textContent = 'Good Guess!';
            msg.textContent = 'You guessed: "' + guess + '"';
        } else {
            icon.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 bg-blue-100 text-blue-500 border-blue-200';
            icon.innerHTML = '<i data-lucide="help-circle" class="w-8 h-8"></i>';
            title.textContent = 'Think about it...';
            msg.textContent = 'Keep guessing or move to next image!';
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        requestAnimationFrame(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
        lucide.createIcons();
        input.value = '';
    };
    Game.closeGuessModal = () => {
        const modal = document.getElementById('guess-modal');
        const content = document.getElementById('guess-modal-content');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    };
} else if (currentMode === 'blur') {
    const originalLoadLevel = Game.loadLevel;
    Game.loadLevel = async function() {
        // Pre-apply blur so the image never flashes unblurred while loading
        const img = document.getElementById('target-image');
        if (img) {
            const blurPx = (BlurGame.maxLevel / 5) * 45;
            img.style.filter = `blur(${blurPx}px)`;
            img.style.transform = 'scale(1.08)';
        }
        BlurGame.currentLevel = BlurGame.maxLevel;
        BlurGame.revealed = false;
        await originalLoadLevel.call(this);
        BlurGame.reset();
    };
    Game.resetBlur = () => BlurGame.reset();
    Game.revealAll = () => BlurGame.revealAll();
    Game.checkGuess = () => {
        const input = document.getElementById('guess-input');
        const guess = input.value.trim().toLowerCase();
        const modal = document.getElementById('guess-modal');
        const content = document.getElementById('guess-modal-content');
        const icon = document.getElementById('guess-result-icon');
        const title = document.getElementById('guess-result-title');
        const msg = document.getElementById('guess-result-msg');
        
        if (guess.length > 2) {
            icon.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 bg-green-100 text-green-500 border-green-200';
            icon.innerHTML = '<i data-lucide="check-circle" class="w-8 h-8"></i>';
            title.textContent = 'Good Guess!';
            msg.textContent = 'You guessed: "' + guess + '"';
        } else {
            icon.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 bg-blue-100 text-blue-500 border-blue-200';
            icon.innerHTML = '<i data-lucide="help-circle" class="w-8 h-8"></i>';
            title.textContent = 'Think about it...';
            msg.textContent = 'Keep guessing or move to next image!';
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        requestAnimationFrame(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
        lucide.createIcons();
        input.value = '';
    };
    Game.closeGuessModal = () => {
        const modal = document.getElementById('guess-modal');
        const content = document.getElementById('guess-modal-content');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    };
}

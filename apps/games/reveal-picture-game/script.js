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
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
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

function _performBroadcast() {
    // Read the already-resolved src from the DOM (set by loadLevel via resolveMediaUrl)
    // This is either a signed URL (cloud) or a DataURL (local) — both are usable by the student.
    const imgEl = document.getElementById('target-image');
    const resolvedSrc = (imgEl && imgEl.src && imgEl.src !== window.location.href) ? imgEl.src : null;

    // Only send imageSrc when the index changed (avoids resending large DataURLs on every tick)
    const indexChanged = Game.currentIndex !== _lastBroadcastImageIndex;
    if (indexChanged) _lastBroadcastImageIndex = Game.currentIndex;

    const pathname = window.location.pathname;
    const mode = pathname.includes('zoom.html') ? 'zoom' : pathname.includes('blur.html') ? 'blur' : 'tiles';

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

        // Update image if new src provided
        const img = document.getElementById('target-image');
        if (img && data.imageSrc) {
            img.src = data.imageSrc;
            window._studentLastImageSrc = data.imageSrc;
            // Hide the empty-state overlay (normally hidden by Game.start() which student never calls)
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'none';
        } else if (img && !data.imageSrc && window._studentLastImageSrc) {
            img.src = window._studentLastImageSrc;
        }

        // Update round counter (student toolbar uses id="student-round-display")
        const roundDisplay = document.getElementById('student-round-display');
        if (roundDisplay) roundDisplay.textContent = `${data.currentIndex + 1} / ${data.totalImages}`;

        if (data.mode === 'tiles') {
            // Sync tiles
            Game.gridSize = data.gridSize;
            Game.revealedIndices = data.revealedIndices || [];
            Game.tilesRemaining = data.tilesRemaining;
            if (img?.src && img.src !== window.location.href) Game.buildGrid();

        } else if (data.mode === 'zoom' && typeof ZoomGame !== 'undefined') {
            ZoomGame.currentZoom = data.zoomCurrentZoom;
            ZoomGame.zoomPosition = data.zoomPosition || { x: 50, y: 50 };
            ZoomGame.revealed = data.zoomRevealed;
            if (img) {
                img.style.transformOrigin = `${ZoomGame.zoomPosition.x}% ${ZoomGame.zoomPosition.y}%`;
                img.style.transform = `scale(${ZoomGame.currentZoom})`;
            }

        } else if (data.mode === 'blur' && typeof BlurGame !== 'undefined') {
            BlurGame.currentLevel = data.blurCurrentLevel;
            BlurGame.maxLevel = data.blurMaxLevel;
            BlurGame.revealed = data.blurRevealed;
            if (img) img.style.filter = `blur(${(BlurGame.currentLevel / 5) * 20}px)`;
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

            if (!storedPresets || storedPresets.length === 0) {
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
            // Sync metadata + cloud image URLs to avoid large blobs
            const metadata = this.presets.map(p => ({
                id: p.id,
                title: p.title,
                images: (p.images || []).filter(img => img.startsWith('http')), 
                currentIndex: p.currentIndex,
                gridSize: p.gridSize,
                lastAccessed: p.lastAccessed
            }));
            saveProgress('reveal_picture', {
                presets: metadata,
                activePresetId: this.activePresetId
            });
        }, 2000);
    },

    async loadFromCloud() {
        const cloudData = await loadProgress('reveal_picture');
        if (cloudData && cloudData.presets) {
            // Update local presets with cloud metadata if they match by ID
            let changed = false;
            for (const cp of cloudData.presets) {
                const local = this.presets.find(p => p.id === cp.id);
                if (local) {
                    local.title = cp.title;
                    local.currentIndex = cp.currentIndex;
                    local.gridSize = cp.gridSize;
                    local.lastAccessed = cp.lastAccessed;
                    local.revealedIndices = cp.revealedIndices || local.revealedIndices || [];
                    
                    // Only update images if the cloud version actually has images (URLs)
                    if (cp.images && cp.images.length > 0) {
                        local.images = cp.images;
                    }
                    
                    await DB.savePreset(local);
                    changed = true;
                } else {
                    // New preset from another device
                    const newPreset = { ...cp, images: cp.images || [] };
                    this.presets.push(newPreset);
                    await DB.savePreset(newPreset);
                    changed = true;
                }
            }
            if (cloudData.activePresetId) {
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
        const btn = document.getElementById('preset-dropdown-btn');
        const menu = document.getElementById('preset-dropdown-menu');
        const label = document.getElementById('preset-dropdown-label');
        
        if (!menu) return; // Skip if custom dropdown doesn't exist (tiles mode still uses select)
        
        // Update label
        const activePreset = this.presets.find(p => p.id === this.activePresetId);
        if (label && activePreset) label.textContent = activePreset.title;
        
        // Build dropdown items with delete buttons
        menu.innerHTML = this.presets.map(p => `
            <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-600 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer transition-colors ${p.id === this.activePresetId ? 'bg-orange/10 dark:bg-orange/20' : ''}" onclick="app.selectPreset('${p.id}')">
                <span class="font-body font-bold text-sm text-dark dark:text-slate-200 truncate flex-1 pointer-events-none">${p.title}</span>
                <button onclick="app.deletePresetById('${p.id}', event)" class="ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0" title="Delete Preset">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        `).join('');
        
        lucide.createIcons();
    },

    togglePresetDropdown() {
        const menu = document.getElementById('preset-dropdown-menu');
        if (menu) {
            const isHidden = menu.classList.contains('hidden');
            // Close all other dropdowns first
            document.querySelectorAll('#preset-dropdown-menu').forEach(m => m.classList.add('hidden'));
            if (isHidden) {
                menu.classList.remove('hidden');
                // Add click outside listener
                setTimeout(() => {
                    document.addEventListener('click', this.closeDropdownOnClickOutside, { once: true });
                }, 10);
            }
        }
    },

    closeDropdownOnClickOutside(e) {
        const container = document.getElementById('preset-dropdown-container');
        if (container && !container.contains(e.target)) {
            const menu = document.getElementById('preset-dropdown-menu');
            if (menu) menu.classList.add('hidden');
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

        // Update timestamp
        preset.lastAccessed = Date.now();
        DB.savePreset(preset);

        localStorage.setItem('mb_active_preset_id', preset.id);

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
            if (targetImage) targetImage.src = "";
            if (tileGrid) tileGrid.innerHTML = '';
            if (roundDisplay) roundDisplay.textContent = "0 / 0";
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
            UI.updateCount(0);
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

        // Only save to DB if preset has images
        if (preset.images && preset.images.length > 0) {
            await DB.savePreset(preset);
            this.syncToCloud();
        }
    },

    async switchPreset(id) {
        const preset = this.presets.find(p => p.id === id);
        if (preset) {
            this.loadPresetData(preset);
        }
    },

    async createNewPreset() {
    const newPreset = {
        id: 'preset_' + Date.now(),
        title: `New Session ${this.presets.length + 1}`,
        images: [],
        currentIndex: 0,
        gridSize: 4,
        lastAccessed: Date.now()
    };

    this.presets.unshift(newPreset); // Add to top
    // Don't save empty presets to DB - will save when images are added

    this.renderPresetDropdown();
    const selector = document.getElementById('preset-selector');
    if (selector) selector.value = newPreset.id;
    this.loadPresetData(newPreset);
    UI.showToast("New preset created! Add images to save it.", "info");
},

    async updatePresetTitle(newTitle) {
    if (!newTitle.trim() || !this.activePresetId) return;

    const presetIndex = this.presets.findIndex(p => p.id === this.activePresetId);
    if (presetIndex !== -1 && this.presets[presetIndex].title !== newTitle) {
        this.presets[presetIndex].title = newTitle;
        await this.saveCurrentState();
        this.renderPresetDropdown();
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
        btn.classList.add('border-blue');
        lucide.createIcons();

        this.intervalId = setInterval(() => {
            const tiles = Array.from(document.querySelectorAll('.tile:not(.revealed)'));
            if (tiles.length === 0) {
                this.stop();
                return;
            }
            const randomTile = tiles[Math.floor(Math.random() * tiles.length)];
            Game.revealTile(randomTile);
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
        btn.classList.remove('border-blue');
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

        tile.classList.add('revealed');
        if (!this.revealedIndices.includes(index)) {
            this.revealedIndices.push(index);
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

        setTimeout(() => {
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

    for (const f of Array.from(files)) {
        try {
            // Check if we should upload to cloud
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
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
    if (IS_PLAYER_WINDOW || Game.images.length === 0) return;
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            AutoReveal.toggle();
            break;
        case 'KeyR': Game.resetLevel(); break;
        case 'KeyN': if (Game.tilesRemaining <= 0) Game.nextLevel(); break;
        case 'KeyP': if (Game.tilesRemaining <= 0) Game.prevLevel(); break;
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
        await app.init();
        await Game.init();

        const path = window.location.pathname;
        if (path.includes('zoom.html')) ZoomGame.init();
        else if (path.includes('blur.html')) BlurGame.init();

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
    
    init() {
        const startSlider = document.getElementById('zoom-start-slider');
        const startVal = document.getElementById('zoom-start-val');
        if (startSlider) {
            startSlider.addEventListener('input', (e) => {
                this.zoomStart = parseFloat(e.target.value);
                startVal.textContent = this.zoomStart.toFixed(1) + 'x';
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
            speedSlider.addEventListener('input', (e) => {
                speedVal.textContent = speedLabels[parseInt(e.target.value) - 1];
            });
        }
        // Apply initial zoom after a short delay to ensure DOM is ready
        setTimeout(() => this.updateZoom(), 100);
    },

    reset() {
        this.stopAutoZoom();
        this.revealed = false;
        this.currentZoom = this.zoomStart;
        this.zoomPosition = {
            x: 20 + Math.random() * 60,
            y: 20 + Math.random() * 60
        };
        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.add('hidden');
        // Apply zoom immediately so the image never appears unzoomed
        const img = document.getElementById('target-image');
        if (img) {
            img.style.transformOrigin = `${this.zoomPosition.x}% ${this.zoomPosition.y}%`;
            img.style.transform = `scale(${this.currentZoom})`;
            img.onload = () => this.updateZoom();
        }
        this.updateZoomBar();
        
        const btn = document.getElementById('auto-zoom-btn');
        if (btn) {
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO ZOOM</span>`;
            btn.classList.remove('bg-white', 'text-blue', 'border-blue');
            btn.classList.add('bg-blue', 'text-white');
        }
    },

    updateZoom() {
        const img = document.getElementById('target-image');
        const container = document.getElementById('zoom-container');
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
        broadcastState();
    },

    updateZoomBar() {
        const bar = document.getElementById('zoom-bar');
        if (!bar) return;
        const percent = 100 - ((this.currentZoom - 1) / (this.zoomStart - 1)) * 100;
        bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    },

    startAutoZoom() {
        if (this.isAutoZooming || this.revealed) return;
        this.isAutoZooming = true;
        const speedSlider = document.getElementById('zoom-speed-slider');
        const speedMultiplier = speedSlider ? parseInt(speedSlider.value) : 3;
        const zoomSpeed = 0.003 * speedMultiplier;
        
        const animate = () => {
            if (!this.isAutoZooming || this.revealed) return;
            this.currentZoom = Math.max(1.0, this.currentZoom - zoomSpeed);
            this.updateZoom();
            if (this.currentZoom <= 1.01) {
                this.revealComplete();
            } else {
                this.animationId = requestAnimationFrame(animate);
            }
        };
        animate();
    },

    stopAutoZoom() {
        this.isAutoZooming = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    revealComplete() {
        this.revealed = true;
        this.currentZoom = 1.0;
        this.updateZoom();
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
                btn.classList.remove('bg-white', 'text-blue', 'border-blue');
                btn.classList.add('bg-blue', 'text-white');
                lucide.createIcons();
            }
        } else {
            this.startAutoZoom();
            const btn = document.getElementById('auto-zoom-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">PAUSE</span>`;
                btn.classList.remove('bg-blue', 'text-white');
                btn.classList.add('bg-white', 'text-blue', 'border-blue');
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
    currentLevel: 5,
    maxLevel: 5,
    isAutoRevealing: false,
    animationId: null,
    revealed: false,
    
    init() {
        const blurSlider = document.getElementById('blur-start-slider');
        const blurVal = document.getElementById('blur-start-val');
        if (blurSlider) {
            const labels = ['Low', 'Medium', 'High', 'Very High', 'Extreme'];
            blurSlider.addEventListener('input', (e) => {
                this.maxLevel = parseInt(e.target.value);
                blurVal.textContent = labels[this.maxLevel - 1];
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
            speedSlider.addEventListener('input', (e) => {
                speedVal.textContent = speedLabels[parseInt(e.target.value) - 1];
            });
        }
    },

    reset() {
        this.stopAutoReveal();
        this.revealed = false;
        this.currentLevel = this.maxLevel;
        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.add('hidden');
        this.updateEffect();
        this.updateBlurBar();
        
        const btn = document.getElementById('auto-blur-btn');
        if (btn) {
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">AUTO REVEAL</span>`;
            btn.classList.remove('bg-white', 'text-blue', 'border-blue');
            btn.classList.add('bg-blue', 'text-white');
        }
    },

    updateEffect() {
        const img = document.getElementById('target-image');
        if (!img) return;
        
        // Blur effect only
        img.style.filter = `blur(${(this.currentLevel / 5) * 20}px)`;
        
        const display = document.getElementById('blur-display');
        if (display) {
            const clarity = Math.round((1 - this.currentLevel / this.maxLevel) * 100);
            display.textContent = clarity + '%';
        }
        this.updateBlurBar();
        broadcastState();
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
        const speedMultiplier = speedSlider ? parseInt(speedSlider.value) : 3;
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
        this.revealed = true;
        this.currentLevel = 0;
        this.updateEffect();
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
                btn.classList.remove('bg-white', 'text-blue', 'border-blue');
                btn.classList.add('bg-blue', 'text-white');
                lucide.createIcons();
            }
        } else {
            this.startAutoReveal();
            const btn = document.getElementById('auto-blur-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i><span class="hidden md:inline">PAUSE</span>`;
                btn.classList.remove('bg-blue', 'text-white');
                btn.classList.add('bg-white', 'text-blue', 'border-blue');
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
const path = window.location.pathname;
if (path.includes('zoom.html')) {
    const originalLoadLevel = Game.loadLevel;
    Game.loadLevel = async function() {
        // Pre-apply zoom so the image is never visible unzoomed during transition
        const img = document.getElementById('target-image');
        if (img) {
            img.style.transform = `scale(${ZoomGame.zoomStart})`;
        }
        await originalLoadLevel.call(this);
        ZoomGame.reset();
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
} else if (path.includes('blur.html')) {
    const originalLoadLevel = Game.loadLevel;
    Game.loadLevel = async function() {
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

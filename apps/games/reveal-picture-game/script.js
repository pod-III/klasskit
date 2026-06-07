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

                await DB.savePreset(defaultPreset);
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
        const selector = document.getElementById('preset-selector');
        selector.innerHTML = this.presets.map(p =>
            `<option value="${p.id}" ${p.id === this.activePresetId ? 'selected' : ''}>${p.title}</option>`
        ).join('');
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

        await DB.savePreset(preset);
        this.syncToCloud();
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
    await DB.savePreset(newPreset);

    this.renderPresetDropdown();
    document.getElementById('preset-selector').value = newPreset.id;
    this.loadPresetData(newPreset);
    this.syncToCloud();
    UI.showToast("New preset created!", "success");
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
    if (!confirm("Are you sure you want to remove ALL images from this preset?")) return;
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

        // Update Image
        document.getElementById('target-image').src = await resolveMediaUrl(this.images[this.currentIndex]);
        document.getElementById('round-display').textContent = `${this.currentIndex + 1} / ${this.images.length}`;

        // Reset State
        document.getElementById('next-round-btn').disabled = true;
        const prevBtn = document.getElementById('prev-round-btn');
        if (prevBtn) prevBtn.disabled = true;
        AutoReveal.stop();
        this.buildGrid();
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
    if (Game.images.length === 0) return;
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
    await app.init();
    await Game.init();
    
    // Initialize mode-specific features
    const path = window.location.pathname;
    if (path.includes('zoom.html')) {
        ZoomGame.init();
    } else if (path.includes('blur.html')) {
        BlurGame.init();
    }
    
    lucide.createIcons();
    if (window.innerWidth < 768) UI.togglePanel(true);
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
        // Wait for image to load before applying zoom
        const img = document.getElementById('target-image');
        if (img && img.src && img.complete) {
            this.updateZoom();
        } else if (img) {
            img.onload = () => this.updateZoom();
            img.onerror = () => setTimeout(() => this.updateZoom(), 100);
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
        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.remove('hidden');
        const input = document.getElementById('guess-input');
        if (input) input.focus();
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
    effectType: 'blur',
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

    setEffect(type) {
        this.effectType = type;
        const blurBtn = document.getElementById('blur-mode-btn');
        const mosaicBtn = document.getElementById('mosaic-mode-btn');
        if (type === 'blur') {
            if (blurBtn) { blurBtn.classList.add('bg-blue', 'text-white'); blurBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300'); }
            if (mosaicBtn) { mosaicBtn.classList.remove('bg-blue', 'text-white'); mosaicBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300'); }
        } else {
            if (mosaicBtn) { mosaicBtn.classList.add('bg-blue', 'text-white'); mosaicBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300'); }
            if (blurBtn) { blurBtn.classList.remove('bg-blue', 'text-white'); blurBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300'); }
        }
        this.updateEffect();
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
        const container = document.getElementById('blur-container');
        if (!img) return;
        
        if (this.effectType === 'blur') {
            img.style.filter = `blur(${(this.currentLevel / 5) * 20}px)`;
            img.style.imageRendering = 'auto';
            img.style.transform = 'scale(1)';
            if (container) container.style.overflow = 'hidden';
        } else {
            // Pixelate effect: scale down using transform with pixelated rendering
            // The key is to use a small scale and let the browser pixelate when scaling back up
            img.style.filter = 'none';
            img.style.imageRendering = 'pixelated';
            // Map 0-5 level to scale: level 5 = 0.05 (very pixelated), level 0 = 1.0 (clear)
            const scale = 0.03 + (1 - this.currentLevel / 5) * 0.97;
            img.style.transform = `scale(${scale})`;
            // Ensure container clips the scaled image
            if (container) container.style.overflow = 'hidden';
        }
        
        const display = document.getElementById('blur-display');
        if (display) {
            const clarity = Math.round((1 - this.currentLevel / this.maxLevel) * 100);
            display.textContent = clarity + '%';
        }
        this.updateBlurBar();
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
        const guessSection = document.getElementById('guess-section');
        if (guessSection) guessSection.classList.remove('hidden');
        const input = document.getElementById('guess-input');
        if (input) input.focus();
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

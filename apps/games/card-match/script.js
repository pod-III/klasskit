// --- 1. HELPERS ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// --- 2. AUDIO ENGINE ---
const AudioEngine = {
    ctx: null,
    muted: localStorage.getItem('sound_card-match') === 'muted',
    init: function () {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) this.ctx = new Ctx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
    },
    playTone: function (freq, type, duration, vol = 0.1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playFlip: function () { this.playTone(400, 'sine', 0.1, 0.05); },
    playMatch: function () {
        this.playTone(600, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.1), 100);
    },
    playWin: function () {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((n, i) => setTimeout(() => this.playTone(n, 'square', 0.3, 0.1), i * 150));
    },
};

// --- 3. DATABASE (Multi-Preset) ---
const DB_NAME = 'KlassKitMemoryDB_V3'; // Bump version for multi-preset, V2 was a single array
const STORE_NAME = 'Presets';

const dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
});

async function getAllPresets() {
    const db = await dbPromise;
    if (!db) return [];
    return new Promise(resolve => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

async function savePresetToDB(preset) {
    const db = await dbPromise;
    if (!db || !preset) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(preset);
}

async function deletePresetFromDB(id) {
    const db = await dbPromise;
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
}

// --- CLOUD SYNC HELPERS ---
let cloudSyncTimeout = null;
async function syncToCloud() {
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    cloudSyncTimeout = setTimeout(async () => {
        const presets = await getAllPresets();
        // Strip DataURLs from cloud sync to save space, but keep Supabase URLs
        const syncPresets = presets.map(p => ({
            ...p,
            pairs: (p.pairs || []).map(pair => ({
                ...pair,
                item1: { ...pair.item1, content: pair.item1.content.startsWith('http') ? pair.item1.content : (pair.item1.type === 'image' ? "" : pair.item1.content) },
                item2: { ...pair.item2, content: pair.item2.content.startsWith('http') ? pair.item2.content : (pair.item2.type === 'image' ? "" : pair.item2.content) }
            }))
        }));
        await saveProgress('card-match', { presets: syncPresets });
    }, 1000);
}

// Migration from V2 (if any)
async function migrateLegacyV2() {
    try {
        const req = indexedDB.open('KlassKitMemoryDB_V2', 1);
        req.onsuccess = async (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains('Configs')) {
                const tx = db.transaction('Configs', 'readonly');
                const getReq = tx.objectStore('Configs').get('pairs_v2');
                getReq.onsuccess = async () => {
                    if (getReq.result && Array.isArray(getReq.result) && getReq.result.length > 0) {
                        const legacyPreset = {
                            id: 'preset_legacy_' + Date.now(),
                            title: 'Migrated Pairs',
                            pairs: getReq.result,
                            lastAccessed: Date.now()
                        };
                        await savePresetToDB(legacyPreset);
                        indexedDB.deleteDatabase('KlassKitMemoryDB_V2');
                        location.reload();
                    }
                };
            }
        };
    } catch (e) { }
}

// --- 4. APP LOGIC ---
const app = {
    pairs: [],
    presetsList: [],
    activePresetId: null,
    presetToDeleteCallback: null,
    toastTimeout: null,
    mismatchTimeout: null,
    winTimeout: null,
    gameState: {
        active: false,
        flipped: [],
        matched: [],
        moves: 0,
        startTime: null,
        timerInterval: null
    },

    init: async function () {
        // 0. Auth Guard
        await requireAuth();

        this.updateSoundUI();
        lucide.createIcons();

        // 1. Try migration
        await migrateLegacyV2();

        // 2. Cloud Sync Load
        const cloudData = await loadProgress('card-match');
        if (cloudData && cloudData.presets) {
            for (const p of cloudData.presets) {
                await savePresetToDB(p);
            }
        }

        // 3. Load presets from DB
        this.presetsList = await getAllPresets();

        if (this.presetsList.length === 0) {
            const defaultId = 'preset_' + Date.now();
            const defaultPreset = {
                id: defaultId,
                title: "Default Match",
                pairs: [],
                lastAccessed: Date.now()
            };
            await savePresetToDB(defaultPreset);
            this.presetsList.push(defaultPreset);
            await syncToCloud();
        }

        // Sort by last accessed descending
        this.presetsList.sort((a, b) => b.lastAccessed - a.lastAccessed);

        await this.loadPresetData(this.presetsList[0].id);
        this.renderPresetDropdown();

        this.setupEventListeners();
        this.toggleInputMode();

        this.showModeSelection();
    },

    toggleTheme: function () {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme_card-match', isDark ? 'dark' : 'light');
        lucide.createIcons();
    },

    toggleSound: function () {
        AudioEngine.muted = !AudioEngine.muted;
        localStorage.setItem('sound_card-match', AudioEngine.muted ? 'muted' : 'unmuted');
        this.updateSoundUI();
        if (!AudioEngine.muted) AudioEngine.playFlip();
    },

    updateSoundUI: function () {
        const btn = document.getElementById('sound-toggle-btn');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(!AudioEngine.muted));
        btn.title = AudioEngine.muted ? 'Unmute Sound' : 'Mute Sound';
        btn.innerHTML = `<i data-lucide="${AudioEngine.muted ? 'volume-x' : 'volume-2'}" class="w-5 h-5 ${AudioEngine.muted ? 'text-slate-400' : ''}"></i>`;
        lucide.createIcons();
    },

    clearPendingTimers: function () {
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        if (this.mismatchTimeout) {
            clearTimeout(this.mismatchTimeout);
            this.mismatchTimeout = null;
        }
        if (this.winTimeout) {
            clearTimeout(this.winTimeout);
            this.winTimeout = null;
        }
    },

    showModeSelection: function () {
        this.clearPendingTimers();
        this.gameState.active = false;
        document.getElementById('mode-selection').classList.remove('hidden');
        document.getElementById('teacher-console').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('win-modal').classList.add('hidden');
        document.getElementById('teacher-mode-btn').classList.add('hidden');
    },

    showConsole: function () {
        this.clearPendingTimers();
        this.gameState.active = false;

        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('teacher-console').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('win-modal').classList.add('hidden');
        document.getElementById('teacher-mode-btn').classList.add('hidden');

        lucide.createIcons();
    },

    selectMode: function (mode) {
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('teacher-console').classList.remove('hidden');
        document.getElementById('teacher-mode-btn').classList.add('hidden');

        const sameWordToggle = document.getElementById('single-word-mode');

        if (mode === 'text-definition') {
            this.switchTab('text');
            if (sameWordToggle) sameWordToggle.checked = false;
        } else if (mode === 'text-text') {
            this.switchTab('text');
            if (sameWordToggle) sameWordToggle.checked = true;
        } else if (mode === 'text-img') {
            this.switchTab('mixed');
        } else if (mode === 'img-img') {
            this.switchTab('image');
        }
        this.toggleInputMode();
        lucide.createIcons();
    },

    setupEventListeners: function () {
        const select = document.getElementById('presetSelect');
        if (select) {
            select.addEventListener('change', (e) => {
                this.loadPresetData(e.target.value);
            });
        }

        this.setupDropZone('mixed-drop', 'mixed-file');
        this.setupDropZone('img1-drop', 'img1-file');
        this.setupDropZone('img2-drop', 'img2-file');

        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.onclick = () => this.startGame();

        const teacherBtn = document.getElementById('teacher-mode-btn');
        if (teacherBtn) teacherBtn.onclick = () => this.showConsole();

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.onclick = () => this.restartGame();

        const mixedInput = document.getElementById('mixed-text');
        if (mixedInput) {
            mixedInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addMixedPair();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            const confirmModal = document.getElementById('confirmModal');
            const winModal = document.getElementById('win-modal');
            const isConfirmOpen = confirmModal && !confirmModal.classList.contains('hidden');
            const isWinOpen = winModal && !winModal.classList.contains('hidden');

            if (e.key === 'Escape') {
                if (isConfirmOpen) {
                    this.closeConfirmModal(false);
                    return;
                }
                if (isWinOpen) {
                    winModal.classList.add('hidden');
                    return;
                }
            }

            const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
                return;
            }
            if (isConfirmOpen || isWinOpen) return;

            const isGameVisible = !document.getElementById('game-screen').classList.contains('hidden');
            if (isGameVisible && (e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.restartGame();
            }
        });
    },

    setupDropZone: function (dropId, fileId) {
        const drop = document.getElementById(dropId);
        const file = document.getElementById(fileId);
        if (!drop || !file) return;

        file.addEventListener('change', () => {
            if (file.files && file.files[0]) {
                if (!file.files[0].type.startsWith('image/')) {
                    this.toast("Please select an image file.", "error");
                    file.value = '';
                    return;
                }
                const name = file.files[0].name;
                const p = drop.querySelector('p');
                if (p) p.innerText = name;
                drop.classList.add('bg-blue/5', 'border-blue', 'drag-over');
                const icon = drop.querySelector('i, svg');
                if (icon) {
                    const replacement = document.createElement('i');
                    replacement.setAttribute('data-lucide', 'check-circle');
                    replacement.className = icon.className.baseVal || icon.className;
                    icon.replaceWith(replacement);
                }
                lucide.createIcons();
            }
        });

        drop.onclick = () => file.click();
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('border-blue', 'scale-[0.98]', 'bg-blue/5', 'drag-over'); });
        drop.addEventListener('dragleave', () => {
            if (!file.files || !file.files[0]) {
                drop.classList.remove('border-blue', 'scale-[0.98]', 'bg-blue/5', 'drag-over');
            }
        });
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('scale-[0.98]');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                file.files = dt.files;
                file.dispatchEvent(new Event('change'));
            }
        });
    },

    resetDropZone: function (dropId, originalText, originalIcon) {
        const drop = document.getElementById(dropId);
        if (!drop) return;
        const p = drop.querySelector('p');
        if (p) p.innerText = originalText;
        const icon = drop.querySelector('i, svg');
        if (icon) {
            const replacement = document.createElement('i');
            replacement.setAttribute('data-lucide', originalIcon);
            replacement.className = 'w-8 h-8 text-slate-300 dark:text-slate-500 mx-auto mb-2';
            if (dropId === 'mixed-drop') {
                replacement.className = 'w-10 h-10 text-slate-300 dark:text-slate-500 mx-auto mb-2 group-hover:text-blue group-hover:scale-110 transition-transform';
            }
            icon.replaceWith(replacement);
        }
        drop.classList.remove('bg-blue/5', 'border-blue', 'drag-over');
        lucide.createIcons();
    },

    switchTab: function (tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

        const targetButton = document.querySelector(`.tab-btn[onclick*="app.switchTab('${tabName}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    },

    // --- DATA MANAGEMENT ---

    toggleInputMode: function () {
        const isSingle = document.getElementById('single-word-mode').checked;
        const input = document.getElementById('simple-input');
        const helper = document.getElementById('text-input-helper');

        if (isSingle) {
            helper.innerHTML = 'Format: One word per line (Auto-pairs with itself)';
            input.placeholder = 'Dog\nCat\nElephant';
        } else {
            helper.innerHTML = 'Format: <code>Word, Translation</code> or <code>Term, Definition</code>';
            input.placeholder = 'Dog, Anjing\nHappy, Feeling or showing pleasure';
        }
    },

    addTextPairs: function () {
        const input = document.getElementById('simple-input');
        const isSingleMode = document.getElementById('single-word-mode').checked;
        const lines = input.value.split('\n').filter(l => l.trim());

        if (lines.length === 0) return;

        let addedCount = 0;
        lines.forEach(line => {
            if (this.pairs.length >= 12) return;

            let val1, val2;

            if (isSingleMode) {
                val1 = line.trim();
                val2 = val1;
            } else {
                const commaIdx = line.indexOf(',');
                if (commaIdx !== -1) {
                    val1 = line.slice(0, commaIdx).trim();
                    val2 = line.slice(commaIdx + 1).trim() || val1;
                } else {
                    val1 = line.trim();
                    val2 = val1;
                }
            }

            if (!val1) return;

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'text-text',
                item1: { type: 'text', content: val1 },
                item2: { type: 'text', content: val2 }
            });
            addedCount++;
        });

        if (addedCount > 0) {
            input.value = '';
            this.saveAndRender();
            this.toast(`Added ${addedCount} text pairs!`, 'success');
        } else {
            this.toast("Max 12 pairs limit reached or empty.", "error");
        }
    },

    addMixedPair: async function () {
        if (this.pairs.length >= 12) return this.toast("Max 12 pairs allowed!", "error");

        const btn = document.querySelector('#tab-mixed button[onclick="app.addMixedPair()"]');
        const txtInput = document.getElementById('mixed-text');
        const imgInput = document.getElementById('mixed-file');
        const textVal = txtInput.value.trim();
        const file = imgInput.files[0];

        if (!textVal || !file) return this.toast("Please provide both text and image.", "error");

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> UPLOADING...';
        lucide.createIcons();

        try {
            let imgSource;
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
                imgSource = await uploadMedia(file, 'card_match', this.activePresetId);
            } else {
                imgSource = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'text-image',
                item1: { type: 'text', content: textVal },
                item2: { type: 'image', content: imgSource }
            });

            txtInput.value = '';
            imgInput.value = '';
            this.resetDropZone('mixed-drop', 'Click or drag image here', 'upload-cloud');
            this.saveAndRender();
            this.toast("Mixed pair added!", "success");
        } catch (err) {
            console.error("Mixed Pair Add Failed:", err);
            this.toast(`Upload failed: ${err.message || 'Unknown error'}`, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    },

    addImagePair: async function () {
        if (this.pairs.length >= 12) return this.toast("Max 12 pairs allowed!", "error");

        const btn = document.querySelector('#tab-image button[onclick="app.addImagePair()"]');
        const f1 = document.getElementById('img1-file').files[0];
        const f2 = document.getElementById('img2-file').files[0];

        if (!f1 || !f2) return this.toast("Please upload both images.", "error");

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> UPLOADING...';
        lucide.createIcons();

        try {
            const { data: { user } } = await db.auth.getUser();
            const canUpload = !isSandbox() && user;

            const processFile = async (file) => {
                if (canUpload) return await uploadMedia(file, 'card_match', this.activePresetId);
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            const src1 = await processFile(f1);
            const src2 = await processFile(f2);

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'image-image',
                item1: { type: 'image', content: src1 },
                item2: { type: 'image', content: src2 }
            });

            document.getElementById('img1-file').value = '';
            document.getElementById('img2-file').value = '';
            this.resetDropZone('img1-drop', 'Card 1', 'image');
            this.resetDropZone('img2-drop', 'Card 2', 'image');
            this.saveAndRender();
            this.toast("Image pair added!", "success");
        } catch (err) {
            console.error("Image Pair Add Failed:", err);
            this.toast(`Upload failed: ${err.message || 'Unknown error'}`, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    },

    dedupePairs: function () {
        if (this.pairs.length < 2) return this.toast("Nothing to dedupe.");
        const seen = new Set();
        const unique = [];
        let removed = 0;

        for (const pair of this.pairs) {
            const key = `${pair.type}|${pair.item1.type}:${pair.item1.content.trim().toLowerCase()}|${pair.item2.type}:${pair.item2.content.trim().toLowerCase()}`;
            if (seen.has(key)) {
                removed++;
            } else {
                seen.add(key);
                unique.push(pair);
            }
        }

        if (removed > 0) {
            this.pairs = unique;
            this.saveAndRender();
            this.toast(`Removed ${removed} duplicate pair${removed > 1 ? 's' : ''}!`, "success");
        } else {
            this.toast("No duplicate pairs found.");
        }
    },

    clearPairs: function () {
        if (this.pairs.length === 0) return;
        this.showConfirmModal({
            title: 'Clear Active Deck?',
            message: `Remove all ${this.pairs.length} pairs from this deck?`,
            confirmText: 'Clear All',
            callback: () => {
                this.pairs = [];
                this.saveAndRender();
                this.toast("All pairs have been cleared!", "success");
            }
        });
    },

    // --- PRESET MANAGEMENT ---

    renderPresetDropdown: function () {
        const select = document.getElementById('presetSelect');
        if (!select) return;
        select.innerHTML = '';
        this.presetsList.forEach(preset => {
            const opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = preset.title;
            if (preset.id === this.activePresetId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    },

    loadPresetData: async function (id) {
        const preset = this.presetsList.find(p => p.id === id);
        if (!preset) return;

        this.activePresetId = id;
        this.pairs = preset.pairs || [];

        const titleInput = document.getElementById('presetTitleInput');
        if (titleInput) titleInput.value = preset.title;

        preset.lastAccessed = Date.now();
        await savePresetToDB(preset);
        await syncToCloud();

        this.renderPresetDropdown();
        this.renderPairList();
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.disabled = this.pairs.length < 2;
    },

    saveCurrentDeck: async function () {
        const btn = document.getElementById('save-deck-btn');
        if (!btn || btn.dataset.saving === 'true') return;

        try {
            btn.dataset.saving = 'true';
            await this.updatePresetTitle();
            await savePresetToDB(this.presetsList.find(p => p.id === this.activePresetId));
            await syncToCloud();

            btn.classList.replace('bg-blue', 'bg-green');
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Saved!';
            lucide.createIcons();

            setTimeout(() => {
                btn.classList.replace('bg-green', 'bg-blue');
                btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save';
                btn.dataset.saving = 'false';
                lucide.createIcons();
            }, 1800);

            this.toast("Deck saved successfully!", "success");
        } catch (err) {
            btn.dataset.saving = 'false';
            this.toast("Failed to save deck", "error");
        }
    },

    updatePresetTitle: async function () {
        const titleInput = document.getElementById('presetTitleInput');
        if (!titleInput) return;
        const newTitle = titleInput.value.trim() || 'Untitled Session';

        const preset = this.presetsList.find(p => p.id === this.activePresetId);
        if (preset && preset.title !== newTitle) {
            preset.title = newTitle;
            await savePresetToDB(preset);
            await syncToCloud();
            this.renderPresetDropdown();
            this.toast("Title saved", "success");
        }
    },

    createNewPreset: async function () {
        const id = 'preset_' + Date.now();
        const newPreset = {
            id: id,
            title: "New Session " + (this.presetsList.length + 1),
            pairs: [],
            lastAccessed: Date.now()
        };
        await savePresetToDB(newPreset);
        await syncToCloud();
        this.presetsList.push(newPreset);
        await this.loadPresetData(id);
        this.toast("New preset created!", "success");
    },

    showConfirmModal: function (configOrCallback) {
        const modal = document.getElementById('confirmModal');
        const content = document.getElementById('confirmModalContent');
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const actionBtn = document.getElementById('confirmModalActionBtn');

        if (!modal || !content) return;

        if (typeof configOrCallback === 'function') {
            this.presetToDeleteCallback = configOrCallback;
            if (titleEl) titleEl.textContent = 'Delete Preset?';
            if (msgEl) msgEl.textContent = 'Are you sure you want to delete this preset? This cannot be undone.';
            if (actionBtn) actionBtn.textContent = 'Delete';
        } else {
            this.presetToDeleteCallback = configOrCallback.callback;
            if (titleEl) titleEl.textContent = configOrCallback.title || 'Confirm?';
            if (msgEl) msgEl.textContent = configOrCallback.message || 'Are you sure?';
            if (actionBtn) actionBtn.textContent = configOrCallback.confirmText || 'Confirm';
        }

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.add('scale-100');
            content.classList.remove('scale-95');
        });
    },

    closeConfirmModal: function (confirmed) {
        const modal = document.getElementById('confirmModal');
        const content = document.getElementById('confirmModalContent');
        if (!modal || !content) return;
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);

        if (confirmed && this.presetToDeleteCallback) {
            this.presetToDeleteCallback();
        }
        this.presetToDeleteCallback = null;
    },

    executeDeletePreset: async function () {
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            deleteFolder(`${user.id}/card_match/${this.activePresetId}`).catch(e => console.warn("Cloud folder delete failed", e));
        }

        await deletePresetFromDB(this.activePresetId);
        await syncToCloud();
        this.presetsList = this.presetsList.filter(p => p.id !== this.activePresetId);
        await this.loadPresetData(this.presetsList[0].id);
        this.toast("Preset deleted", "success");
    },

    deleteCurrentPreset: async function () {
        if (this.presetsList.length <= 1) {
            this.toast("Cannot delete the only preset.", "error");
            return;
        }
        this.showConfirmModal(() => this.executeDeletePreset());
    },

    saveAndRender: async function () {
        const preset = this.presetsList.find(p => p.id === this.activePresetId);
        if (preset) {
            preset.pairs = this.pairs;
            preset.lastAccessed = Date.now();
            await savePresetToDB(preset);
            await syncToCloud();
        }

        this.renderPairList();
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.disabled = this.pairs.length < 2;
    },

    renderPairList: function () {
        const container = document.getElementById('pairs-list');
        const countBadge = document.getElementById('pair-count');
        if (!container || !countBadge) return;
        container.innerHTML = '';
        countBadge.innerText = this.pairs.length;

        if (this.pairs.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
                    <i data-lucide="layers-2" class="w-10 h-10 mb-3 opacity-40"></i>
                    <p class="font-bold uppercase tracking-widest text-xs">Deck is empty (add at least 2 pairs)</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        this.pairs.forEach((pair, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border-2 border-dark dark:border-slate-500 mb-2.5 animate-pop shadow-hard-sm';

            const renderItem = (item) => {
                if (item.type === 'text') {
                    const safeText = escapeHTML(item.content);
                    return `<span class="px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs font-bold text-dark dark:text-white truncate max-w-[110px]" title="${safeText}">${safeText}</span>`;
                }
                const safeUrl = escapeHTML(item.content);
                return `<div class="w-9 h-9 rounded-lg border border-dark dark:border-slate-500 overflow-hidden shadow-sm card-preview"><img src="${safeUrl}" alt="Card preview" class="w-full h-full object-cover"></div>`;
            };

            const icon = pair.type === 'text-text' ? 'type' : pair.type === 'image-image' ? 'copy' : 'image-plus';
            const colorClass = pair.type === 'text-text' ? 'bg-pink' : pair.type === 'image-image' ? 'bg-green text-dark' : 'bg-blue';

            div.innerHTML = `
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="${colorClass} text-white p-1.5 rounded-lg border-2 border-dark dark:border-slate-500 shrink-0">
                        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
                    </div>
                    <div class="flex items-center gap-2 min-w-0">
                        ${renderItem(pair.item1)}
                        <i data-lucide="arrow-right-left" class="w-3 h-3 text-slate-300 dark:text-slate-500 shrink-0"></i>
                        ${renderItem(pair.item2)}
                    </div>
                </div>
                <button type="button" onclick="app.removePair(${idx})" aria-label="Remove pair ${idx + 1}" class="p-1.5 text-slate-400 hover:text-pink transition-colors shrink-0">
                    <i data-lucide="x-circle" class="w-5 h-5"></i>
                </button>
            `;
            container.appendChild(div);
        });
        this.hydrateThumbnails();
        lucide.createIcons();
    },

    async hydrateThumbnails() {
        const thumbs = document.querySelectorAll('.card-preview img, #game-grid img');
        for (const img of thumbs) {
            if (img.src && img.src.includes('klasskit-media')) {
                img.src = await resolveMediaUrl(img.src);
            }
        }
    },

    removePair: function (idx) {
        const pair = this.pairs[idx];
        if (pair) {
            if (pair.item1.type === 'image' && pair.item1.content.includes('klasskit-media')) {
                deleteMediaFromUrl(pair.item1.content).catch(e => console.error("Cloud delete failed (item1)", e));
            }
            if (pair.item2.type === 'image' && pair.item2.content.includes('klasskit-media')) {
                deleteMediaFromUrl(pair.item2.content).catch(e => console.error("Cloud delete failed (item2)", e));
            }
        }
        this.pairs.splice(idx, 1);
        this.saveAndRender();
    },

    // --- GAME LOGIC ---

    startGame: async function () {
        if (this.pairs.length < 2) return this.toast("Need at least 2 pairs!", "error");

        this.clearPendingTimers();

        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('teacher-console').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('teacher-mode-btn').classList.remove('hidden');

        let cards = [];
        this.pairs.forEach(pair => {
            cards.push({
                id: pair.id + '_1',
                matchId: pair.id,
                type: pair.item1.type,
                content: pair.item1.content
            });
            cards.push({
                id: pair.id + '_2',
                matchId: pair.id,
                type: pair.item2.type,
                content: pair.item2.content
            });
        });

        for (let card of cards) {
            if (card.type === 'image') card.content = await resolveMediaUrl(card.content);
        }

        cards = shuffleArray(cards);

        const grid = document.getElementById('game-grid');
        if (!grid) return;
        grid.innerHTML = '';
        grid.className = 'grid gap-3 sm:gap-4 mx-auto perspective-1000';

        const count = cards.length;
        if (count <= 8) {
            grid.classList.add('grid-cols-2', 'sm:grid-cols-4', 'max-w-4xl');
        } else if (count <= 12) {
            grid.classList.add('grid-cols-3', 'sm:grid-cols-4', 'max-w-5xl');
        } else if (count <= 16) {
            grid.classList.add('grid-cols-4', 'sm:grid-cols-4', 'max-w-5xl', 'grid-compact');
        } else {
            grid.classList.add('grid-cols-4', 'sm:grid-cols-6', 'max-w-6xl', 'grid-compact');
        }

        cards.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = 'game-card';
            el.dataset.index = index;
            el.dataset.matchId = card.matchId;
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', `Card ${index + 1}`);

            const len = card.content.length;
            const sizeClass = len > 60 ? 'text-xs sm:text-sm' : len > 30 ? 'text-sm sm:text-base' : len > 12 ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl';
            const weightClass = 'font-black';

            let innerContent = '';
            if (card.type === 'image') {
                const safeSrc = escapeHTML(card.content);
                innerContent = `<div class="w-full h-full p-2"><img src="${safeSrc}" alt="Memory card" class="w-full h-full object-contain rounded-lg"></div>`;
            } else {
                const safeText = escapeHTML(card.content);
                innerContent = `<div class="w-full h-full flex items-center justify-center p-3 text-center leading-[1.05] overflow-hidden">
                    <span class="${sizeClass} ${weightClass} text-dark dark:text-white break-words uppercase font-heading tracking-tight w-full">${safeText}</span>
                </div>`;
            }

            el.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <i data-lucide="sparkle" class="text-white/40 w-8 h-8 animate-pulse"></i>
                    </div>
                    <div class="card-back border-3 border-dark dark:border-slate-500 bg-white dark:bg-slate-900 overflow-hidden rounded-xl shadow-inner">
                        ${innerContent}
                    </div>
                </div>
            `;

            el.onclick = () => this.handleCardClick(index);
            el.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleCardClick(index);
                }
            };
            grid.appendChild(el);
        });

        lucide.createIcons();

        this.gameState = {
            active: true,
            flipped: [],
            matched: [],
            moves: 0,
            startTime: Date.now(),
            timerInterval: setInterval(() => this.updateTimer(), 1000)
        };
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.innerText = '00:00';
        this.updateUI();

        AudioEngine.init();
    },

    handleCardClick: function (index) {
        const { flipped, active } = this.gameState;
        const cardEl = document.querySelector(`.game-card[data-index="${index}"]`);
        if (!cardEl) return;

        if (!active) return;
        if (flipped.includes(index)) return;
        if (cardEl.classList.contains('matched')) return;
        if (flipped.length >= 2) return;

        AudioEngine.playFlip();
        cardEl.classList.add('flipped');
        flipped.push(index);

        if (flipped.length === 2) {
            this.gameState.moves++;
            this.updateUI();
            this.checkMatch();
        }
    },

    checkMatch: function () {
        const [idx1, idx2] = this.gameState.flipped;
        const card1 = document.querySelector(`.game-card[data-index="${idx1}"]`);
        const card2 = document.querySelector(`.game-card[data-index="${idx2}"]`);
        if (!card1 || !card2) return;

        const match1 = card1.dataset.matchId;
        const match2 = card2.dataset.matchId;

        if (match1 === match2) {
            AudioEngine.playMatch();
            card1.classList.add('matched');
            card2.classList.add('matched');
            this.gameState.matched.push(match1);
            this.gameState.flipped = [];

            if (this.gameState.matched.length === this.pairs.length) {
                this.handleWin();
            }
        } else {
            this.mismatchTimeout = setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                this.gameState.flipped = [];
                this.mismatchTimeout = null;
                AudioEngine.playFlip();
            }, 900);
        }
    },

    handleWin: function () {
        this.clearPendingTimers();
        this.gameState.active = false;
        AudioEngine.playWin();

        const finalTimeStr = document.getElementById('timer').innerText;
        document.getElementById('final-time').innerText = finalTimeStr;
        document.getElementById('final-moves').innerText = this.gameState.moves;

        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#ff4785', '#ff7e33', '#00d063', '#1ea7fd'] });
        }

        this.winTimeout = setTimeout(() => {
            document.getElementById('win-modal').classList.remove('hidden');
            this.winTimeout = null;
        }, 450);
    },

    updateTimer: function () {
        const diff = Math.floor((Date.now() - this.gameState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
    },

    updateUI: function () {
        const movesEl = document.getElementById('moves');
        if (movesEl) movesEl.innerText = this.gameState.moves;
    },

    restartGame: function () {
        document.getElementById('win-modal').classList.add('hidden');
        this.clearPendingTimers();
        this.startGame();
    },

    toast: function (msg, type = 'info') {
        const el = document.getElementById('toast');
        const txt = document.getElementById('toast-msg');
        if (!el || !txt) return;
        const container = el.querySelector('.flex.items-center.gap-3');
        if (!container) return;

        const oldIcon = container.querySelector('i, svg');
        if (oldIcon && oldIcon !== txt) oldIcon.remove();

        const icon = document.createElement('i');
        txt.innerText = msg;

        if (type === 'success') {
            icon.setAttribute('data-lucide', 'check-circle');
            icon.className = 'w-5 h-5 text-green';
        } else if (type === 'error') {
            icon.setAttribute('data-lucide', 'alert-circle');
            icon.className = 'w-5 h-5 text-pink';
        } else {
            icon.setAttribute('data-lucide', 'info');
            icon.className = 'w-5 h-5 text-blue';
        }

        container.prepend(icon);
        lucide.createIcons();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        el.classList.remove('opacity-0', 'translate-y-24');
        this.toastTimeout = setTimeout(() => {
            el.classList.add('opacity-0', 'translate-y-24');
            this.toastTimeout = null;
        }, 3000);
    }
};

window.addEventListener('load', () => app.init());

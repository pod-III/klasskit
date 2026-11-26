// ==================== AUDIO & THEME ====================
const SOUND_KEY = 'sound_word_search';
const THEME_KEY = 'theme_word-search';
const PREFS_KEY = 'word_search_prefs_v1';

let audioCtx = null;
let soundEnabled = true;
try {
    soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';
} catch (e) {
    soundEnabled = true;
}

function getAudioCtx() {
    if (!audioCtx && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    return audioCtx;
}

const playTone = (freq, type, duration) => {
    if (!soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
};

function updateSoundToggleUI() {
    const btn = document.getElementById('sound-toggle');
    const onIcon = document.getElementById('sound-icon-on');
    const offIcon = document.getElementById('sound-icon-off');
    if (btn) btn.setAttribute('aria-pressed', String(soundEnabled));
    if (onIcon) onIcon.classList.toggle('hidden', !soundEnabled);
    if (offIcon) offIcon.classList.toggle('hidden', soundEnabled);
}

const Sound = {
    tap: () => playTone(600, 'sine', 0.08),
    click: () => playTone(420, 'triangle', 0.05),
    back: () => playTone(520, 'sine', 0.05),
    success: () => {
        playTone(500, 'triangle', 0.1);
        setTimeout(() => playTone(1000, 'triangle', 0.18), 100);
    },
    error: () => playTone(150, 'sawtooth', 0.18),
    win: () => [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.18), i * 100)),
    toggleMute: () => {
        soundEnabled = !soundEnabled;
        try { localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        updateSoundToggleUI();
        if (soundEnabled) Sound.click();
    }
};

function initTheme() {
    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('klasskit-theme') || localStorage.getItem('theme_hub');
    } catch (e) { /* ignore */ }
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        localStorage.setItem('klasskit-theme', isDark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
    Sound.click();
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info', duration = 2600) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green text-dark',
        error: 'bg-pink text-white',
        info: 'bg-dark text-white',
        warning: 'bg-orange text-dark'
    };

    toast.className = `px-4 py-2.5 rounded-2xl border-2 border-dark dark:border-slate-500 shadow-hard font-heading text-xs uppercase tracking-wide flex items-center gap-2 pointer-events-auto ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        setTimeout(() => toast.remove(), 220);
    }, duration);
}

// --- CONFIRM TOAST ---
function showConfirmToast(message, onConfirm, onCancel) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-500 px-4 py-3 rounded-2xl shadow-hard min-w-[280px] pointer-events-auto';
    toast.innerHTML = `
        <p class="font-bold text-dark dark:text-white text-sm mb-3">${escapeHtml(message)}</p>
        <div class="flex gap-2">
            <button id="confirm-yes" class="flex-1 bg-pink text-white py-2 rounded-xl border-2 border-dark font-bold text-xs hover:brightness-110 transition">YES</button>
            <button id="confirm-no" class="flex-1 bg-slate-200 dark:bg-slate-700 text-dark dark:text-white py-2 rounded-xl border-2 border-dark font-bold text-xs hover:brightness-110 transition">NO</button>
        </div>
    `;

    container.appendChild(toast);

    toast.querySelector('#confirm-yes').onclick = () => {
        toast.remove();
        if (onConfirm) onConfirm();
    };

    toast.querySelector('#confirm-no').onclick = () => {
        toast.remove();
        if (onCancel) onCancel();
    };
}

function escapeHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
});

// --- INDEXEDDB ---
const DB_NAME = 'WordSearchDB';
const DB_VERSION = 2;
const STORE_PRESETS = 'presets';
const STORE_SETTINGS = 'settings';
const STORE_PUZZLES = 'savedPuzzles';

let dataBase = null;
let GRID_SIZE = 10;
let CELL_SIZE = 45;
let currentPresetId = null;
let currentSavedPuzzleId = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_PRESETS)) {
                const presetsStore = database.createObjectStore(STORE_PRESETS, { keyPath: 'id', autoIncrement: true });
                presetsStore.createIndex('name', 'name', { unique: false });
                presetsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
                database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
            if (!database.objectStoreNames.contains(STORE_PUZZLES)) {
                const puzzlesStore = database.createObjectStore(STORE_PUZZLES, { keyPath: 'id', autoIncrement: true });
                puzzlesStore.createIndex('name', 'name', { unique: false });
                puzzlesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
}

async function initDB() {
    try {
        dataBase = await openDB();
    } catch (e) {
        console.error('Failed to initialize IndexedDB:', e);
        showToast('Storage unavailable.', 'warning');
    }
}

async function savePreset(name, data, id = null) {
    if (!dataBase) throw new Error('Database not initialized');
    const existing = id ? await getPreset(id) : null;
    const now = Date.now();
    const isSame = existing && (existing.name || '').trim().toLowerCase() === name.trim().toLowerCase();
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
        const store = tx.objectStore(STORE_PRESETS);
        const preset = {
            name: name.trim(),
            data: JSON.parse(JSON.stringify(data)),
            updatedAt: now,
            lastUsed: now,
            usageCount: isSame ? ((existing.usageCount || 0) + 1) : 1
        };
        if (isSame) preset.id = existing.id;
        const request = isSame ? store.put(preset) : store.add(preset);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPresets() {
    if (!dataBase) return [];
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const index = store.index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve((request.result || []).reverse());
    });
}

async function getPreset(id) {
    if (!dataBase || id === null || id === undefined) return null;
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

async function markPresetUsed(id) {
    if (!dataBase || id === null || id === undefined) return;
    const preset = await getPreset(id);
    if (!preset) return;
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
        const store = tx.objectStore(STORE_PRESETS);
        store.put({
            ...preset,
            id: preset.id,
            lastUsed: Date.now(),
            usageCount: (preset.usageCount || 0) + 1
        });
        tx.oncomplete = () => { syncToCloud(); resolve(); };
        tx.onerror = () => resolve();
    });
}

async function deletePreset(id) {
    if (!dataBase) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function saveCurrentPresetId(id) {
    if (!dataBase) return;
    const tx = dataBase.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key: 'currentPresetId', value: id });
}

async function getCurrentPresetId() {
    if (!dataBase) return null;
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_SETTINGS, 'readonly');
        const request = tx.objectStore(STORE_SETTINGS).get('currentPresetId');
        request.onsuccess = () => resolve(request.result?.value || null);
    });
}

// --- STATE ---
const State = {
    grid: [],
    solutions: new Set(),
    placedWords: [],
    validWords: new Set(),
    foundWords: new Set(),
    selectionStart: null,
    isActive: false,
    totalWords: 0
};

const Settings = {
    bankMode: 'full',
    letterCase: 'upper'
};

function loadLocalPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.bankMode && ['full', 'hints', 'count'].includes(parsed.bankMode)) {
            Settings.bankMode = parsed.bankMode;
        }
        if (parsed.letterCase && ['upper', 'lower'].includes(parsed.letterCase)) {
            Settings.letterCase = parsed.letterCase;
        }
    } catch (e) { /* ignore */ }
}

function saveLocalPrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(Settings));
    } catch (e) { /* ignore */ }
}

function applyPrefsToControls() {
    if (els.bankMode) els.bankMode.value = Settings.bankMode;
    document.querySelectorAll('input[name="ws-letter-case"]').forEach((r) => {
        r.checked = r.value === Settings.letterCase;
    });
}

function formatWordDisplay(word, mode, letterCase) {
    const cased = letterCase === 'lower' ? String(word).toLowerCase() : String(word).toUpperCase();
    if (mode === 'hints') {
        return `${cased[0] || ''} ${'_ '.repeat(Math.max(0, cased.length - 1)).trim()} (${cased.length})`;
    }
    return cased;
}

// --- DIFFICULTY ---
const Difficulty = {
    allowBackwards: false,
    allowDiagonal: false,
};

function getActiveDirs() {
    const dirs = [{ r: 0, c: 1 }, { r: 1, c: 0 }];
    if (Difficulty.allowBackwards) {
        dirs.push({ r: 0, c: -1 }, { r: -1, c: 0 });
    }
    if (Difficulty.allowDiagonal) {
        dirs.push({ r: 1, c: 1 }, { r: -1, c: 1 });
        if (Difficulty.allowBackwards) {
            dirs.push({ r: -1, c: -1 }, { r: 1, c: -1 });
        }
    }
    return dirs;
}

function toggleDifficulty(mode) {
    if (mode === 'backwards') {
        Difficulty.allowBackwards = !Difficulty.allowBackwards;
        document.getElementById('toggle-backwards')?.classList.toggle('active', Difficulty.allowBackwards);
    } else if (mode === 'diagonal') {
        Difficulty.allowDiagonal = !Difficulty.allowDiagonal;
        document.getElementById('toggle-diagonal')?.classList.toggle('active', Difficulty.allowDiagonal);
    }
    updateDifficultyLabel();
    Sound.click();
}

function updateDifficultyLabel() {
    const el = document.getElementById('difficulty-label');
    if (!el) return;
    const { allowBackwards, allowDiagonal } = Difficulty;
    let text, colorClass;
    if (!allowBackwards && !allowDiagonal) {
        text = 'Easy — Horizontal & Vertical';
        colorClass = 'bg-green/10 border-green/30 text-green';
    } else if (allowBackwards && !allowDiagonal) {
        text = 'Medium — + Backwards';
        colorClass = 'bg-orange/10 border-orange/30 text-orange';
    } else if (!allowBackwards && allowDiagonal) {
        text = 'Medium — + Diagonal';
        colorClass = 'bg-orange/10 border-orange/30 text-orange';
    } else {
        text = 'Hard — All Directions';
        colorClass = 'bg-pink/10 border-pink/30 text-pink';
    }
    el.className = `text-center py-1 px-2.5 border rounded-lg ${colorClass}`;
    el.innerHTML = `<span class="text-[10px] font-bold uppercase tracking-widest">${text}</span>`;
}

// --- DOM ELEMENTS ---
const els = {
    grid: document.getElementById('word-grid'),
    bank: document.getElementById('word-bank'),
    input: document.getElementById('word-input'),
    controls: document.getElementById('controls'),
    sizeSlider: document.getElementById('size-slider'),
    sizeDisplay: document.getElementById('size-display'),
    foundCount: document.getElementById('found-count'),
    totalCount: document.getElementById('total-count'),
    statusBar: document.getElementById('status-bar'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    generateBtn: document.getElementById('generate-btn'),
    giveUpBtn: document.getElementById('give-up-btn'),
    clearBoardBtn: document.getElementById('clear-board-btn'),
    userPresetNameInput: document.getElementById('userPresetNameInput'),
    setsList: document.getElementById('sets-list'),
    savedCount: document.getElementById('saved-count'),
    setsSort: document.getElementById('sets-sort'),
    savedPuzzleSelect: document.getElementById('savedPuzzleSelect'),
    savedPuzzleNameInput: document.getElementById('savedPuzzleNameInput'),
    bankMode: document.getElementById('ws-bank-mode'),
    emptyStateCta: document.getElementById('empty-state-cta'),
    emptyBankMsg: document.getElementById('empty-bank-msg')
};

// --- CLOUD PERSISTENCE ---
let syncTimeout = null;
async function syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        if (typeof saveProgress !== 'function') return;
        const presets = await getAllPresets();
        const puzzles = await getAllSavedPuzzles();
        await saveProgress('word_search', {
            presets,
            puzzles,
            currentPresetId
        });
    }, 1500);
}

async function loadFromCloud() {
    if (typeof loadProgress !== 'function') return;
    const cloudData = await loadProgress('word_search');
    if (cloudData) {
        if (cloudData.presets && dataBase) {
            for (const p of cloudData.presets) {
                const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
                const store = tx.objectStore(STORE_PRESETS);
                const existing = await new Promise(r => {
                    const req = store.index('name').get(p.name);
                    req.onsuccess = () => r(req.result);
                });
                if (!existing) {
                    delete p.id;
                    await new Promise(r => {
                        const req = store.add(p);
                        req.onsuccess = () => r();
                    });
                }
            }
        }
        if (cloudData.puzzles && dataBase) {
            for (const p of cloudData.puzzles) {
                const tx = dataBase.transaction(STORE_PUZZLES, 'readwrite');
                const store = tx.objectStore(STORE_PUZZLES);
                const existing = await new Promise(r => {
                    const req = store.index('name').get(p.name);
                    req.onsuccess = () => r(req.result);
                });
                if (!existing) {
                    delete p.id;
                    await new Promise(r => {
                        const req = store.add(p);
                        req.onsuccess = () => r();
                    });
                }
            }
        }
        await renderPresetSelector();
        await renderSavedPuzzleSelector();
    }
}

// --- SAVED WORD SETS (Crossword-style inline card list) ---
async function renderPresetSelector() {
    const presets = await getAllPresets();
    if (els.savedCount) els.savedCount.textContent = String(presets.length);
    const list = els.setsList || document.getElementById('sets-list');
    if (!list) return;

    if (currentPresetId !== null && currentPresetId !== undefined) {
        const stillExists = presets.some(p => String(p.id) === String(currentPresetId));
        if (!stillExists) currentPresetId = null;
    }

    if (presets.length === 0) {
        list.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-xs italic">No saved sets yet.</p>';
        syncToCloud();
        return;
    }

    const sort = els.setsSort ? els.setsSort.value : 'recent';
    const sorted = presets.slice().sort((a, b) => {
        if (sort === 'alpha') return (a.name || '').localeCompare(b.name || '');
        if (sort === 'popular') {
            return (b.usageCount || 0) - (a.usageCount || 0)
                || ((b.lastUsed || b.updatedAt || 0) - (a.lastUsed || a.updatedAt || 0));
        }
        return (b.lastUsed || b.updatedAt || 0) - (a.lastUsed || a.updatedAt || 0);
    });

    list.innerHTML = '';
    sorted.forEach((p) => {
        const isActive = currentPresetId !== null && currentPresetId !== undefined && String(p.id) === String(currentPresetId);
        const wordCount = (p.data?.words || '').split(',').map(w => w.trim()).filter(Boolean).length;
        const sizeLabel = p.data?.size ? `${p.data.size}x${p.data.size}` : '10x10';

        const item = document.createElement('div');
        item.className = `flex items-center gap-2 p-2 rounded-lg border transition-all ${isActive
            ? 'border-blue bg-blue/10 dark:bg-blue/20'
            : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-500/40 hover:border-blue/40'}`;
        item.innerHTML = `
            <button type="button" class="set-row-load flex-1 min-w-0 text-left">
                <p class="text-sm font-bold text-dark dark:text-slate-100 truncate flex items-center gap-1.5">
                    <span class="truncate">${escapeHtml(p.name)}</span>
                    ${isActive ? '<span class="px-1.5 py-0.5 rounded bg-blue text-white text-[9px] font-black uppercase shrink-0">Active</span>' : ''}
                </p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${wordCount} words · ${escapeHtml(sizeLabel)}</p>
            </button>
            <button type="button" class="set-load-btn p-1.5 bg-blue/10 dark:bg-blue/20 text-blue rounded-md border border-blue/20 hover:bg-blue hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Load Set" aria-label="Load word set">
                <i data-lucide="upload" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
            <button type="button" class="set-delete-btn p-1.5 bg-pink/10 dark:bg-pink/20 text-pink rounded-md border border-pink/20 hover:bg-pink hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Delete Set" aria-label="Delete word set">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
        `;

        const handleLoad = async () => {
            await loadPresetObject(p);
            await markPresetUsed(p.id);
            await renderPresetSelector();
            Sound.click();
            showToast(`Loaded "${p.name}"`, 'success');
        };

        item.querySelector('.set-row-load').addEventListener('click', handleLoad);
        item.querySelector('.set-load-btn').addEventListener('click', handleLoad);
        item.querySelector('.set-delete-btn').addEventListener('click', () => {
            showConfirmToast(`Delete "${p.name}"?`, async () => {
                await deletePreset(p.id);
                if (String(currentPresetId) === String(p.id)) {
                    currentPresetId = null;
                    if (els.userPresetNameInput) els.userPresetNameInput.value = '';
                    await saveCurrentPresetId(null);
                }
                Sound.back();
                await renderPresetSelector();
                showToast('Set deleted!', 'success');
            });
        });

        list.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
    syncToCloud();
}

async function loadPresetObject(preset) {
    if (!preset) return;
    currentPresetId = preset.id;
    els.input.value = preset.data?.words || '';
    els.sizeSlider.value = preset.data?.size || '10';
    els.sizeDisplay.innerText = `${els.sizeSlider.value}x${els.sizeSlider.value}`;
    if (els.userPresetNameInput) els.userPresetNameInput.value = preset.name || '';
    Difficulty.allowBackwards = Boolean(preset.data?.allowBackwards);
    Difficulty.allowDiagonal = Boolean(preset.data?.allowDiagonal);
    document.getElementById('toggle-backwards')?.classList.toggle('active', Difficulty.allowBackwards);
    document.getElementById('toggle-diagonal')?.classList.toggle('active', Difficulty.allowDiagonal);
    updateDifficultyLabel();
    if (preset.data?.bankMode && ['full', 'hints', 'count'].includes(preset.data.bankMode)) {
        Settings.bankMode = preset.data.bankMode;
    }
    if (preset.data?.letterCase && ['upper', 'lower'].includes(preset.data.letterCase)) {
        Settings.letterCase = preset.data.letterCase;
    }
    applyPrefsToControls();
    saveLocalPrefs();
    await saveCurrentPresetId(preset.id);
}

async function saveCurrentUserPreset() {
    const rawName = (els.userPresetNameInput?.value || '').trim();
    const content = (els.input?.value || '').trim();
    if (!rawName) {
        els.userPresetNameInput?.focus();
        Sound.error();
        showToast('Enter a set name first', 'warning');
        return;
    }
    if (!content) {
        els.input?.focus();
        Sound.error();
        showToast('Add some words before saving', 'warning');
        return;
    }
    try {
        const data = {
            words: els.input.value,
            size: els.sizeSlider.value,
            allowBackwards: Difficulty.allowBackwards,
            allowDiagonal: Difficulty.allowDiagonal,
            bankMode: Settings.bankMode,
            letterCase: Settings.letterCase
        };
        const id = await savePreset(rawName, data, currentPresetId);
        currentPresetId = id;
        if (els.userPresetNameInput) els.userPresetNameInput.value = rawName;
        await saveCurrentPresetId(id);
        await renderPresetSelector();
        Sound.success();
        showToast(`Saved "${rawName}"!`, 'success');
    } catch (e) {
        Sound.error();
        showToast('Failed to save set', 'error');
    }
}

async function createNewUserPreset() {
    currentPresetId = null;
    if (els.userPresetNameInput) {
        els.userPresetNameInput.value = '';
        els.userPresetNameInput.focus();
    }
    await saveCurrentPresetId(null);
    await renderPresetSelector();
    Sound.click();
    showToast('Detached — type a name and click SAVE for a new set', 'info');
}

// --- SAVED GRIDS ---
async function getAllSavedPuzzles() {
    if (!dataBase) return [];
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PUZZLES, 'readonly');
        const index = tx.objectStore(STORE_PUZZLES).index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve((request.result || []).reverse());
    });
}

async function renderSavedPuzzleSelector() {
    const puzzles = await getAllSavedPuzzles();
    if (!els.savedPuzzleSelect) return;
    els.savedPuzzleSelect.innerHTML = '<option value="">-- Load Saved --</option>';
    puzzles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === currentSavedPuzzleId) option.selected = true;
        els.savedPuzzleSelect.appendChild(option);
    });
    syncToCloud();
}

async function onSavedPuzzleSelect() {
    const id = parseInt(els.savedPuzzleSelect.value, 10);
    if (!id && id !== 0) return;
    const puzzle = await getSavedPuzzle(id);
    if (puzzle) {
        currentSavedPuzzleId = id;
        loadSavedPuzzleData(puzzle.data);
        if (els.savedPuzzleNameInput) els.savedPuzzleNameInput.value = puzzle.name;
        showToast('Saved grid loaded!', 'success');
    }
}

async function getSavedPuzzle(id) {
    if (!dataBase) return null;
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PUZZLES, 'readonly');
        const request = tx.objectStore(STORE_PUZZLES).get(id);
        request.onsuccess = () => resolve(request.result);
    });
}

async function saveCurrentPuzzle() {
    if (!State.grid.length) {
        showToast('Build a grid first before saving.', 'warning');
        Sound.error();
        return;
    }
    try {
        const name = (els.savedPuzzleNameInput?.value || '').trim() || `Grid ${new Date().toLocaleDateString()}`;
        const puzzleData = {
            grid: State.grid,
            solutions: Array.from(State.solutions),
            placedWords: State.placedWords || [],
            validWords: Array.from(State.validWords),
            totalWords: State.totalWords,
            size: State.grid.length
        };
        const id = await saveGeneratedPuzzle(name, puzzleData, currentSavedPuzzleId);
        currentSavedPuzzleId = id;
        await renderSavedPuzzleSelector();
        Sound.success();
        showToast('Grid saved!', 'success');
    } catch (e) {
        Sound.error();
        showToast('Failed to save grid', 'error');
    }
}

async function saveGeneratedPuzzle(name, data, id = null) {
    if (!dataBase) throw new Error('Database not initialized');
    const tx = dataBase.transaction(STORE_PUZZLES, 'readwrite');
    const store = tx.objectStore(STORE_PUZZLES);
    const puzzle = { name, data, updatedAt: Date.now() };
    if (id) puzzle.id = id;
    return new Promise((resolve, reject) => {
        const request = id ? store.put(puzzle) : store.add(puzzle);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteCurrentSavedPuzzle() {
    if (!currentSavedPuzzleId) {
        showToast('No saved grid selected.', 'warning');
        return;
    }
    showConfirmToast('Delete this saved grid?', async () => {
        await deleteGeneratedPuzzle(currentSavedPuzzleId);
        currentSavedPuzzleId = null;
        if (els.savedPuzzleNameInput) els.savedPuzzleNameInput.value = '';
        if (els.savedPuzzleSelect) els.savedPuzzleSelect.value = '';
        await renderSavedPuzzleSelector();
        Sound.back();
        showToast('Saved grid deleted!', 'success');
    });
}

async function deleteGeneratedPuzzle(id) {
    if (!dataBase) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PUZZLES, 'readwrite');
        const store = tx.objectStore(STORE_PUZZLES);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function loadSavedPuzzleData(data) {
    State.grid = data.grid;
    State.solutions = new Set(data.solutions || []);
    State.placedWords = Array.isArray(data.placedWords) ? data.placedWords : [];
    State.validWords = new Set(data.validWords || []);
    State.foundWords.clear();
    State.isActive = true;
    State.selectionStart = null;
    State.totalWords = data.totalWords;
    GRID_SIZE = State.grid.length || 10;

    els.emptyStateCta?.classList.add('hidden');
    renderGrid(data.size);
    renderWordBank(Array.from(State.validWords));
    updateHUD();
    setTimeout(fitGridToDisplay, 50);
    broadcastFullState();
}

// --- UI HELPERS ---
function toggleControlPanel(forceHide = false) {
    const isHidden = window.innerWidth >= 768
        ? els.controls.classList.contains('hidden-panel-desktop')
        : els.controls.classList.contains('hidden-panel-mobile');

    if (forceHide || !isHidden) {
        els.controls.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
    } else {
        els.controls.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
    }
    setTimeout(fitGridToDisplay, 320);
}

function toggleSavedPuzzleControls() {
    const controls = document.getElementById('saved-puzzle-controls');
    const icon = document.getElementById('saved-puzzle-toggle-icon');
    if (controls && icon) {
        controls.classList.toggle('active');
        icon.classList.toggle('active');
    }
}

function updateGridSize() {
    document.querySelectorAll('.grid-cell').forEach(el => {
        el.style.width = `${CELL_SIZE}px`;
        el.style.height = `${CELL_SIZE}px`;
        const fontSize = Math.max(0.7, CELL_SIZE / 42);
        el.style.fontSize = `${fontSize}rem`;
    });
}

function fitGridToDisplay() {
    const container = els.grid?.parentElement?.parentElement;
    const size = State.grid.length;
    if (!size || !container) return;

    const targetWidth = Math.max(120, container.clientWidth - 72);
    const targetHeight = Math.max(120, container.clientHeight - 72);
    const gapTotal = (size - 1) * 4;
    const paddingTotal = 8;
    const minDim = Math.min(targetWidth, targetHeight);

    CELL_SIZE = Math.floor((minDim - gapTotal - paddingTotal) / size);
    CELL_SIZE = Math.max(20, Math.min(CELL_SIZE, 80));

    updateGridSize();
}

function dedupeWords() {
    const tokens = (els.input.value || '')
        .split(/[,\n]+/)
        .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(Boolean);
    const seen = new Set();
    const kept = [];
    let removed = 0;

    tokens.forEach((tok) => {
        if (seen.has(tok)) {
            removed++;
        } else {
            seen.add(tok);
            kept.push(tok);
        }
    });

    if (removed > 0) {
        els.input.value = kept.join(', ');
        showToast(`Removed ${removed} duplicate word${removed === 1 ? '' : 's'}.`, 'success');
        Sound.click();
    } else {
        showToast('No duplicate words found.', 'info');
        Sound.click();
    }
}

function clearBoardProgress() {
    if (!State.grid.length) {
        Sound.error();
        return;
    }
    State.foundWords.clear();
    State.selectionStart = null;
    State.isActive = true;
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('found', 'revealed', 'active-start', 'preview-line', 'error', 'hint-pulse');
    });
    document.querySelectorAll('.word-tag').forEach(tag => {
        tag.classList.remove('found');
    });
    updateHUD();
    Sound.back();
    broadcastFullState();
}

// --- GAME LOGIC ---
function initGame(size, words) {
    GRID_SIZE = size;
    State.grid = Array(size).fill(null).map(() => Array(size).fill(''));
    State.solutions.clear();
    State.placedWords = [];
    State.validWords = new Set();
    State.foundWords.clear();
    State.selectionStart = null;
    State.isActive = true;

    const cleanWords = [...words].sort((a, b) => b.length - a.length);
    const placed = [];
    cleanWords.forEach(word => {
        if (placeWord(word, size)) {
            placed.push(word);
            State.validWords.add(word);
        }
    });

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!State.grid[r][c]) State.grid[r][c] = alpha[Math.floor(Math.random() * 26)];
        }
    }

    State.totalWords = placed.length;
    els.emptyStateCta?.classList.add('hidden');
    renderGrid(size);
    renderWordBank(placed);
    updateHUD();
    fitGridToDisplay();
    Sound.success();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
    broadcastFullState();
}

function placeWord(word, size) {
    const dirs = getActiveDirs();
    for (let i = 0; i < 150; i++) {
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const er = r + d.r * (word.length - 1);
        const ec = c + d.c * (word.length - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;

        let ok = true;
        for (let j = 0; j < word.length; j++) {
            const char = State.grid[r + d.r * j][c + d.c * j];
            if (char && char !== word[j]) { ok = false; break; }
        }
        if (ok) {
            for (let j = 0; j < word.length; j++) {
                State.grid[r + d.r * j][c + d.c * j] = word[j];
                State.solutions.add(`${r + d.r * j},${c + d.c * j}`);
            }
            State.placedWords.push({ word, r, c, dr: d.r, dc: d.c });
            return true;
        }
    }
    return false;
}

function renderGrid(size) {
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const lower = Settings.letterCase === 'lower';

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            const rawCh = State.grid[r][c] || '';
            cell.innerText = lower ? rawCh.toLowerCase() : rawCh.toUpperCase();
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.onmousedown = () => handleInput(r, c, cell);
            cell.ontouchstart = (e) => { e.preventDefault(); handleInput(r, c, cell); };
            cell.onmouseenter = () => handleHover(r, c);
            els.grid.appendChild(cell);
        }
    }
    updateGridSize();
}

function renderWordBank(words) {
    els.bank.innerHTML = '';
    if (!words.length) {
        els.emptyBankMsg?.classList.remove('hidden');
        return;
    }
    els.emptyBankMsg?.classList.add('hidden');
    const displayMode = Settings.bankMode === 'hints' ? 'hints' : 'full';

    [...words].sort().forEach(w => {
        const li = document.createElement('li');
        li.className = 'word-tag' + (State.foundWords.has(w) ? ' found' : '');
        li.innerText = formatWordDisplay(w, displayMode, Settings.letterCase);
        li.id = `tag-${w}`;
        li.title = 'Click to pulse first letter hint on board';
        li.onclick = () => hintWordFirstCell(w);
        els.bank.appendChild(li);
    });
}

function hintWordFirstCell(word) {
    if (IS_PLAYER_WINDOW || State.foundWords.has(word)) return;
    const placed = State.placedWords.find(p => p.word === word);
    if (!placed) return;
    const cell = getCell(placed.r, placed.c);
    if (!cell || cell.classList.contains('found')) return;
    cell.classList.remove('hint-pulse');
    void cell.offsetWidth;
    cell.classList.add('hint-pulse');
    Sound.click();
    setTimeout(() => cell.classList.remove('hint-pulse'), 1250);
}

function updateHUD() {
    if (els.foundCount) els.foundCount.innerText = State.foundWords.size;
    if (els.totalCount) els.totalCount.innerText = State.totalWords;
    if (State.foundWords.size === State.totalWords && State.totalWords > 0 && State.isActive) {
        endGame(true);
    }
}

function handleInput(r, c, el) {
    if (!State.isActive) return;
    if (!State.selectionStart) {
        State.selectionStart = { r, c, el };
        el.classList.add('active-start');
        Sound.tap();
    } else {
        if (State.selectionStart.r === r && State.selectionStart.c === c) {
            clearSelection();
        } else {
            checkMatch(State.selectionStart, { r, c, el });
        }
    }
}

let lastHovered = { r: -1, c: -1 };

function handleHover(r, c) {
    if (!State.selectionStart || !State.isActive) return;
    if (r === lastHovered.r && c === lastHovered.c) return;
    lastHovered = { r, c };

    document.querySelectorAll('.preview-line').forEach(el => {
        if (el.dataset.r != r || el.dataset.c != c) {
            el.classList.remove('preview-line');
        }
    });

    const path = getLine(State.selectionStart, { r, c });
    if (path) {
        path.forEach(p => {
            const cell = getCell(p.r, p.c);
            if (cell && !cell.classList.contains('found')) {
                cell.classList.add('preview-line');
            }
        });
    }
}

function checkMatch(start, end) {
    const path = getLine(start, end);
    if (!path) {
        Sound.error();
        end.el.classList.add('error');
        setTimeout(() => end.el.classList.remove('error'), 400);
        clearSelection();
        return;
    }

    const word = path.map(p => State.grid[p.r][p.c]).join('');
    const rev = word.split('').reverse().join('');
    let match = null;
    if (State.validWords.has(word) && !State.foundWords.has(word)) match = word;
    else if (State.validWords.has(rev) && !State.foundWords.has(rev)) match = rev;

    if (match) {
        Sound.success();
        path.forEach(p => getCell(p.r, p.c)?.classList.add('found'));
        const tag = document.getElementById(`tag-${match}`);
        if (tag) tag.classList.add('found');
        State.foundWords.add(match);
        updateHUD();
        broadcastState({ immediate: true });
    } else {
        Sound.error();
        path.forEach(p => {
            const c = getCell(p.r, p.c);
            if (c) {
                c.classList.add('error');
                setTimeout(() => c.classList.remove('error'), 400);
            }
        });
    }
    clearSelection();
}

function getLine(s, e) {
    const dr = e.r - s.r, dc = e.c - s.c;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const rs = dr === 0 ? 0 : dr / steps, cs = dc === 0 ? 0 : dc / steps;
    const path = [];
    for (let i = 0; i <= steps; i++) path.push({ r: s.r + rs * i, c: s.c + cs * i });
    return path;
}

function getCell(r, c) { return document.querySelector(`.grid-cell[data-r="${r}"][data-c="${c}"]`); }

function clearSelection() {
    if (State.selectionStart) State.selectionStart.el.classList.remove('active-start');
    State.selectionStart = null;
    document.querySelectorAll('.preview-line').forEach(el => el.classList.remove('preview-line'));
}

function revealSolutions() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        if (State.solutions.has(`${cell.dataset.r},${cell.dataset.c}`)) cell.classList.add('revealed');
    });
    State.isActive = false;
    Sound.success();
    broadcastState({ immediate: true });
}

function endGame(success) {
    State.isActive = false;
    if (success) {
        Sound.win();
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
        showToast('You found everything!', 'success');
    }
}

// ==================== BROADCAST CHANNEL (Student View) ====================
const BROADCAST_CHANNEL = 'word-search-sync';
const IS_PLAYER_WINDOW = typeof location !== 'undefined' && new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

let _bcThrottle = null, _bcLastTime = 0;

function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;
    const now = performance.now();
    const minInterval = options.immediate ? 0 : 50;
    if (_bcThrottle) clearTimeout(_bcThrottle);
    const go = () => { _bcLastTime = performance.now(); _performBroadcast(); };
    if (now - _bcLastTime >= minInterval) go();
    else _bcThrottle = setTimeout(go, minInterval - (now - _bcLastTime));
}

function _performBroadcast() {
    const foundCells = [], revealedCells = [];
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const key = `${cell.dataset.r},${cell.dataset.c}`;
        if (cell.classList.contains('found')) foundCells.push(key);
        if (cell.classList.contains('revealed')) revealedCells.push(key);
    });
    bc.postMessage({
        type: 'state-update',
        grid: State.grid,
        placedWords: State.placedWords,
        validWords: [...State.validWords],
        foundWords: [...State.foundWords],
        foundCells,
        revealedCells,
        isActive: State.isActive,
        totalWords: State.totalWords,
        letterCase: Settings.letterCase,
        bankMode: Settings.bankMode,
        CELL_SIZE,
    });
}

function broadcastFullState() { broadcastState({ immediate: true }); }

if (bc && IS_PLAYER_WINDOW) {
    bc.onmessage = ({ data }) => {
        if (data.type !== 'state-update') return;
        if (window._playerRetryInterval) { clearInterval(window._playerRetryInterval); window._playerRetryInterval = null; }
        window._playerLoadingEl?.remove(); window._playerLoadingEl = null;

        State.grid = data.grid || [];
        State.placedWords = data.placedWords || [];
        State.validWords = new Set(data.validWords || []);
        State.foundWords = new Set(data.foundWords || []);
        State.isActive = Boolean(data.isActive);
        State.totalWords = data.totalWords || 0;
        if (data.letterCase) Settings.letterCase = data.letterCase;
        if (data.bankMode) Settings.bankMode = data.bankMode;
        CELL_SIZE = data.CELL_SIZE || CELL_SIZE;

        if (State.grid.length) {
            els.emptyStateCta?.classList.add('hidden');
            renderGrid(State.grid.length);
            renderWordBank([...State.validWords]);
            updateHUD();
            fitGridToDisplay();
        }
        (data.foundCells || []).forEach(key => {
            const [r, c] = key.split(',');
            getCell(r, c)?.classList.add('found');
        });
        (data.revealedCells || []).forEach(key => {
            const [r, c] = key.split(',');
            getCell(r, c)?.classList.add('revealed');
        });
        (data.foundWords || []).forEach(w => document.getElementById(`tag-${w}`)?.classList.add('found'));

        const sd = document.getElementById('student-round-display');
        if (sd) sd.textContent = `${State.foundWords.size} / ${State.totalWords}`;
    };
}

// --- INIT ---
window.onload = async () => {
    initTheme();
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) soundBtn.onclick = () => Sound.toggleMute();
    updateSoundToggleUI();
    loadLocalPrefs();
    applyPrefsToControls();

    if (IS_PLAYER_WINDOW) {
        document.documentElement.classList.add('player-mode');
        document.title = 'Student View | Word Search';
        document.getElementById('controls')?.style.setProperty('display', 'none');
        document.getElementById('btn-open-player')?.style.setProperty('display', 'none');
        document.getElementById('give-up-btn')?.style.setProperty('display', 'none');
        document.getElementById('clear-board-btn')?.style.setProperty('display', 'none');
        document.getElementById('sound-toggle')?.style.setProperty('display', 'none');
        document.getElementById('confirm-modal')?.style.setProperty('display', 'none');
        document.getElementById('player-toolbar')?.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 dark:bg-slate-800/95 border-2 border-dark dark:border-slate-500 rounded-full shadow-hard-sm backdrop-blur-sm';
        loadingEl.innerHTML = `<svg class="w-4 h-4 animate-spin text-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg><span class="font-bold text-xs text-slate-600 dark:text-slate-200 uppercase tracking-widest">Connecting...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping(); window._playerRetryInterval = setInterval(ping, 2000);
        return;
    }

    if (typeof requireAuth === 'function') await requireAuth();
    await initDB();
    const sid = await getCurrentPresetId();
    if (sid) {
        const p = await getPreset(sid);
        if (p) {
            await loadPresetObject(p);
        }
    }
    await loadFromCloud();
    await renderPresetSelector();
    await renderSavedPuzzleSelector();

    if (els.sizeSlider) {
        els.sizeSlider.oninput = (e) => {
            if (els.sizeDisplay) els.sizeDisplay.innerText = `${e.target.value}x${e.target.value}`;
        };
    }

    document.querySelectorAll('input[name="ws-letter-case"]').forEach((r) => {
        r.addEventListener('change', () => {
            Settings.letterCase = r.value === 'lower' ? 'lower' : 'upper';
            saveLocalPrefs();
            if (State.grid.length) {
                renderGrid(State.grid.length);
                renderWordBank(Array.from(State.validWords));
                broadcastFullState();
            }
        });
    });

    els.bankMode?.addEventListener('change', () => {
        Settings.bankMode = els.bankMode.value;
        saveLocalPrefs();
        if (State.validWords.size) {
            renderWordBank(Array.from(State.validWords));
            broadcastFullState();
        }
    });

    if (els.zoomIn) els.zoomIn.onclick = () => { CELL_SIZE = Math.min(CELL_SIZE + 5, 80); updateGridSize(); };
    if (els.zoomOut) els.zoomOut.onclick = () => { CELL_SIZE = Math.max(CELL_SIZE - 5, 25); updateGridSize(); };

    if (els.generateBtn) {
        els.generateBtn.onclick = () => {
            const words = (els.input?.value || '')
                .split(/[,\n]+/)
                .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
                .filter(w => w.length > 0);
            if (words.length < 1) return showToast('Enter some words!', 'error');

            currentSavedPuzzleId = null;
            if (els.savedPuzzleNameInput) els.savedPuzzleNameInput.value = '';
            if (els.savedPuzzleSelect) els.savedPuzzleSelect.value = '';

            initGame(parseInt(els.sizeSlider.value, 10) || 10, words);
            if (window.innerWidth < 768) toggleControlPanel(true);
        };
    }

    document.getElementById('dedupe-btn')?.addEventListener('click', dedupeWords);
    document.getElementById('clear-words-btn')?.addEventListener('click', () => {
        if (els.input) els.input.value = '';
        Sound.back();
    });

    document.getElementById('save-set-btn')?.addEventListener('click', saveCurrentUserPreset);
    document.getElementById('new-set-btn')?.addEventListener('click', createNewUserPreset);
    els.setsSort?.addEventListener('change', renderPresetSelector);
    els.userPresetNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCurrentUserPreset();
        }
    });

    els.clearBoardBtn?.addEventListener('click', clearBoardProgress);

    if (els.giveUpBtn) els.giveUpBtn.onclick = () => document.getElementById('confirm-modal')?.classList.remove('hidden');
    document.getElementById('cancel-reveal')?.addEventListener('click', () => document.getElementById('confirm-modal')?.classList.add('hidden'));
    document.getElementById('confirm-reveal')?.addEventListener('click', () => {
        revealSolutions();
        document.getElementById('confirm-modal')?.classList.add('hidden');
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            currentPresetId = null;
            if (els.input) els.input.value = btn.dataset.words || '';
            if (els.userPresetNameInput) els.userPresetNameInput.value = btn.dataset.title || '';
            renderPresetSelector();
            els.generateBtn?.click();
            Sound.click();
        };
    });

    // Guided Bulk Import + CEFR Presets
    if (window.KlassKitBulkImport) {
        const wsBulkModal = window.KlassKitBulkImport.create({
            id: 'ws-bulk-import-overlay',
            title: 'Word Search Bulk Import',
            subtitle: 'Paste a word list or vocabulary table',
            accentColor: 'orange',
            unitLabel: 'word',
            unitLabelPlural: 'words',
            confirmText: 'Import & Build',
            guideItems: [
                { label: 'Comma or Line List', syntax: 'APPLE, BANANA\nCHERRY', color: 'green', desc: 'Paste one word per line or comma-separated.' },
                { label: 'Word Pairs / Lists', syntax: '1. PLANET - Earth orbits\n- GRAVITY', color: 'blue', desc: 'Bullets, numbers, and descriptions after | or - are stripped automatically.' },
                { label: 'Comments', syntax: '# Unit 4 Science', color: 'orange', desc: 'Lines starting with # are ignored.' }
            ],
            placeholder: '# Science Vocabulary\nGRAVITY\nECLIPSE, ORBIT\n1. GALAXY - Spiral star system\n2. COMET',
            template: '# Vocabulary Word Search\nPLANET\nGALAXY\nORBIT\nECLIPSE\nGRAVITY\nCOMET',
            sample: 'GRAVITY, ECLIPSE, ORBIT, GALAXY, MOLECULE, COMET, NEBULA, ENERGY, MAGNET, PRISM',
            options: [
                { id: 'append', label: 'Append to current vocabulary box', defaultChecked: false }
            ],
            parse(rawText) {
                const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
                const words = [];
                const seen = new Set();
                const warnings = [];

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    const parts = trimmed.split(',');
                    for (let part of parts) {
                        part = part.trim()
                            .replace(/^[-*•]\s+/, '')
                            .replace(/^\d+[\).\]]\s+/, '');
                        const head = part.split(/\s*(?:\||::|\s+[-–—:]\s+)\s*/)[0].trim();
                        const clean = head.toUpperCase().replace(/[^A-Z]/g, '');
                        if (!clean) continue;
                        if (clean.length < 2) {
                            warnings.push(`Skipped "${head}" (too short for grid).`);
                            continue;
                        }
                        if (!seen.has(clean)) {
                            seen.add(clean);
                            words.push(clean);
                        }
                    }
                }

                return {
                    items: words,
                    warnings: warnings.slice(0, 4),
                    badges: words.map(w => ({ label: w, tone: 'orange' }))
                };
            },
            onImport(result, optionValues) {
                const imported = result.items || [];
                if (!imported.length) return false;
                if (optionValues && optionValues.append && els.input.value.trim()) {
                    const existing = els.input.value
                        .split(/[,\n]+/)
                        .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
                        .filter(Boolean);
                    const merged = Array.from(new Set([...existing, ...imported]));
                    els.input.value = merged.join(', ');
                } else {
                    els.input.value = imported.join(', ');
                }
                els.generateBtn?.click();
                showToast(`Imported ${imported.length} words!`, 'success');
                return true;
            }
        });

        document.getElementById('btn-bulk-import')?.addEventListener('click', () => wsBulkModal.open());

        window.KlassKitBulkImport.mountPresets({
            container: '#cefr-presets-slot',
            url: 'presets.json',
            title: 'CEFR Word Sets',
            collapsible: true,
            getMeta: (p) => ({ icon: 'hash', label: `${(p.words || []).length}w` }),
            onSelect: (preset) => {
                const words = (preset.words || [])
                    .map(w => String(w).trim().toUpperCase().replace(/[^A-Z]/g, ''))
                    .filter(Boolean);
                if (!words.length) return;
                currentPresetId = null;
                els.input.value = words.join(', ');
                if (els.userPresetNameInput) els.userPresetNameInput.value = preset.title || '';
                currentSavedPuzzleId = null;
                if (els.savedPuzzleNameInput) els.savedPuzzleNameInput.value = '';
                if (els.savedPuzzleSelect) els.savedPuzzleSelect.value = '';
                renderPresetSelector();
                initGame(parseInt(els.sizeSlider.value, 10) || 10, words);
                if (window.innerWidth < 768) toggleControlPanel(true);
                showToast(`Loaded "${preset.title}" (${preset.level})`, 'success');
            }
        });
    }

    window.onresize = () => { if (State.grid.length) fitGridToDisplay(); };

    if (window.innerWidth < 768) toggleControlPanel(true);

    if (bc) {
        bc.onmessage = (evt) => { if (evt.data?.type === 'player-ready') broadcastFullState(); };
    }
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'word-search-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
};

// --- PRINT MODE (Vector SVG Renderer) ---
let printingAsKey = false;
window.setPrintMode = function (mode, asKey = false) {
    if (!State.grid || !State.grid.length) {
        showToast('Build a puzzle first before printing!', 'warning');
        Sound.error();
        return;
    }
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    if (mode === 'separate') {
        printArea.classList.add('print-separate-pages');
    } else {
        printArea.classList.remove('print-separate-pages');
    }
    printingAsKey = Boolean(asKey);
    preparePrintVersion(printingAsKey);
    originalPrint.call(window);
};

const originalPrint = window.print;
window.print = function () {
    preparePrintVersion(printingAsKey);
    originalPrint.call(window);
};

window.addEventListener('beforeprint', () => {
    preparePrintVersion(printingAsKey);
});

window.addEventListener('afterprint', () => {
    printingAsKey = false;
    preparePrintVersion(false);
});

function buildPrintWordSearchSVG({ grid, placedWords, solutions, gridSizeMm, letterCase, asKey }) {
    const size = grid.length;
    const U = 100;
    const cellSizeMm = gridSizeMm / size;

    const outerStroke = Math.max(3.6, Math.min(8.5, +((0.60 / cellSizeMm) * U).toFixed(2)));
    const innerStroke = Math.max(1.6, Math.min(4.0, +((0.24 / cellSizeMm) * U).toFixed(2)));
    const shadowOffset = Math.max(4.5, Math.min(11.0, +((0.80 / cellSizeMm) * U).toFixed(2)));
    const padTL = Math.ceil(outerStroke * 0.75);
    const padBR = Math.ceil(shadowOffset + outerStroke * 0.75);
    const vbW = size * U + padTL + padBR;
    const vbH = size * U + padTL + padBR;
    const svgSizeMm = (vbW / U) * cellSizeMm;

    const innerPaths = [];
    for (let i = 1; i < size; i++) {
        innerPaths.push(`M${i * U} 0V${size * U}`);
        innerPaths.push(`M0 ${i * U}H${size * U}`);
    }

    const answerCapsules = [];
    if (asKey) {
        if (Array.isArray(placedWords) && placedWords.length > 0) {
            const capsulePalettes = [
                { fill: '#fce7f3', stroke: '#ec4899' },
                { fill: '#e0f2fe', stroke: '#0284c7' },
                { fill: '#dcfce7', stroke: '#16a34a' },
                { fill: '#ffedd5', stroke: '#ea580c' }
            ];
            const capStroke = Math.max(3.6, +(outerStroke * 0.72).toFixed(2));
            const capH = 72;
            const capRx = 36;
            placedWords.forEach((pw, idx) => {
                if (!pw || !pw.word) return;
                const pal = capsulePalettes[idx % capsulePalettes.length];
                const sx = pw.c * U + 50;
                const sy = pw.r * U + 50;
                const ex = (pw.c + pw.dc * (pw.word.length - 1)) * U + 50;
                const ey = (pw.r + pw.dr * (pw.word.length - 1)) * U + 50;
                const mx = (sx + ex) / 2;
                const my = (sy + ey) / 2;
                const dist = Math.hypot(ex - sx, ey - sy);
                const deg = +((Math.atan2(ey - sy, ex - sx) * 180) / Math.PI).toFixed(2);
                const capW = +(dist + capH).toFixed(2);
                answerCapsules.push(
                    `<rect x="${(-capW / 2).toFixed(2)}" y="${(-capH / 2).toFixed(2)}" width="${capW}" height="${capH}" rx="${capRx}" ry="${capRx}" transform="translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(${deg})" fill="${pal.fill}" fill-opacity="0.58" stroke="${pal.stroke}" stroke-width="${capStroke}"/>`
                );
            });
        } else if (solutions && solutions.size > 0) {
            const capStroke = Math.max(3.6, +(outerStroke * 0.72).toFixed(2));
            solutions.forEach((key) => {
                const [rStr, cStr] = String(key).split(',');
                const r = parseInt(rStr, 10);
                const c = parseInt(cStr, 10);
                if (!Number.isFinite(r) || !Number.isFinite(c)) return;
                answerCapsules.push(
                    `<rect x="${c * U + 12}" y="${r * U + 12}" width="76" height="76" rx="18" ry="18" fill="#fce7f3" fill-opacity="0.65" stroke="#ec4899" stroke-width="${capStroke}"/>`
                );
            });
        }
    }

    const lower = letterCase === 'lower';
    const textYOffset = lower ? 66.5 : 69.5;
    const letterEls = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const rawCh = grid[r]?.[c] || '';
            const ch = lower ? rawCh.toLowerCase() : rawCh.toUpperCase();
            const isSol = asKey && solutions?.has(`${r},${c}`);
            const fill = asKey ? (isSol ? '#0f172a' : '#94a3b8') : '#0f172a';
            const weight = asKey ? (isSol ? '700' : '600') : '700';
            letterEls.push(
                `<text x="${c * U + 50}" y="${r * U + textYOffset}" font-family="Fredoka, sans-serif" font-weight="${weight}" font-size="56" fill="${fill}" text-anchor="middle">${escapeHtml(ch)}</text>`
            );
        }
    }

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'ws-print-svg');
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svgEl.setAttribute('width', `${svgSizeMm.toFixed(2)}mm`);
    svgEl.setAttribute('height', `${svgSizeMm.toFixed(2)}mm`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', 'Word search puzzle grid');
    svgEl.style.width = `${svgSizeMm.toFixed(2)}mm`;
    svgEl.style.height = `${svgSizeMm.toFixed(2)}mm`;

    const boardLen = size * U;
    const shadowFill = asKey ? '#f5d0de' : '#cbd5e1';

    svgEl.innerHTML = [
        `<g transform="translate(${padTL} ${padTL})">`,
        `<rect x="${shadowOffset}" y="${shadowOffset}" width="${boardLen}" height="${boardLen}" fill="${shadowFill}" shape-rendering="crispEdges"/>`,
        `<rect x="0" y="0" width="${boardLen}" height="${boardLen}" fill="#ffffff" shape-rendering="crispEdges"/>`,
        innerPaths.length
            ? `<path d="${innerPaths.join('')}" fill="none" stroke="#cbd5e1" stroke-width="${innerStroke}" stroke-linecap="butt" shape-rendering="crispEdges"/>`
            : '',
        asKey && answerCapsules.length
            ? `<g>${answerCapsules.join('')}</g>`
            : '',
        `<rect x="0" y="0" width="${boardLen}" height="${boardLen}" fill="none" stroke="#0f172a" stroke-width="${outerStroke}" shape-rendering="crispEdges"/>`,
        `<g text-rendering="geometricPrecision">${letterEls.join('')}</g>`,
        '</g>'
    ].join('');

    return { svgEl, svgSizeMm };
}

function preparePrintVersion(asKey = false) {
    const printArea = document.getElementById('print-area');
    const gridContainer = document.getElementById('print-grid-container');
    const printBank = document.getElementById('print-word-bank');
    const countBanner = document.getElementById('print-count-banner');
    if (!printArea || !gridContainer || !printBank) return;

    const presetName = (els.userPresetNameInput?.value || '').trim();
    const savedName = (els.savedPuzzleNameInput?.value || '').trim();
    const validPreset = presetName && presetName.toLowerCase() !== 'new preset' && presetName.toLowerCase() !== 'untitled' ? presetName : '';
    const validSaved = savedName && savedName.toLowerCase() !== 'new preset' && savedName.toLowerCase() !== 'untitled' ? savedName : '';
    const baseTitle = validPreset || validSaved || 'Word Search';

    const dirParts = ['Horizontal & Vertical'];
    if (Difficulty.allowDiagonal) dirParts.push('Diagonal');
    if (Difficulty.allowBackwards) dirParts.push('Backwards');
    const dirSummary = dirParts.join(' + ');

    const headingEl = document.getElementById('print-heading');
    const subEl = document.getElementById('print-subheading');
    const badgeEl = document.getElementById('print-mode-badge');
    const page2TitleEl = printArea.querySelector('.ws-print-page2-title');
    const countEl = document.getElementById('print-word-count');
    const footerNoteEl = document.getElementById('print-footer-note');
    const footerNoteP1El = document.getElementById('print-footer-note-p1');

    printArea.classList.toggle('print-answer-key', Boolean(asKey));
    if (headingEl) headingEl.textContent = baseTitle;
    if (subEl) {
        if (asKey) {
            subEl.textContent = `Teacher Reference Sheet showing all hidden word paths (${dirSummary}).`;
        } else if (Settings.bankMode === 'count') {
            subEl.textContent = `Challenge Mode: Find and circle all hidden words without a word list (${dirSummary}).`;
        } else if (Settings.bankMode === 'hints') {
            subEl.textContent = `Use the first-letter hints below to find and circle each hidden word (${dirSummary}).`;
        } else {
            subEl.textContent = `Find and circle all hidden words in the grid (${dirSummary}).`;
        }
    }
    if (badgeEl) {
        badgeEl.hidden = !asKey;
        badgeEl.classList.toggle('hidden', !asKey);
        badgeEl.style.display = asKey ? 'inline-block' : 'none';
    }
    if (page2TitleEl) page2TitleEl.textContent = asKey ? `${baseTitle} — Word Bank (Key)` : `${baseTitle} — Word Bank`;

    const wordsList = Array.from(State.validWords || []).sort();
    const gridSize = State.grid.length || 10;
    const isSeparate = printArea.classList.contains('print-separate-pages');
    const noteText = `${gridSize}×${gridSize} Grid · ${wordsList.length} Word${wordsList.length === 1 ? '' : 's'} · ${dirSummary}`;
    if (countEl) countEl.textContent = `${wordsList.length} Word${wordsList.length === 1 ? '' : 's'}`;
    if (footerNoteP1El) footerNoteP1El.textContent = isSeparate ? `${noteText} · Page 1 of 2` : noteText;
    if (footerNoteEl) footerNoteEl.textContent = isSeparate ? `${noteText} · Page 2 of 2` : noteText;

    gridContainer.innerHTML = '';
    printBank.innerHTML = '';
    if (countBanner) {
        countBanner.textContent = '';
        countBanner.classList.add('hidden');
    }
    printBank.classList.remove('hidden');

    if (!State.grid.length) return;

    const effectiveBankMode = asKey ? 'full' : Settings.bankMode;
    const bankCols = effectiveBankMode === 'hints'
        ? (wordsList.length > 8 ? 3 : 2)
        : (wordsList.length > 15 ? 4 : 3);
    printArea.style.setProperty('--ws-bank-cols', String(bankCols));

    const bankRows = effectiveBankMode === 'count' ? 1 : Math.max(1, Math.ceil(wordsList.length / bankCols));
    printArea.classList.remove('ws-bank-compact', 'ws-bank-dense');
    if (!isSeparate && effectiveBankMode !== 'count') {
        if (bankRows > 7) printArea.classList.add('ws-bank-dense');
        else if (bankRows > 5) printArea.classList.add('ws-bank-compact');
    }

    let gridSizeMm;
    if (isSeparate) {
        gridSizeMm = 170;
    } else {
        const estBankH = effectiveBankMode === 'count'
            ? 24
            : (bankRows > 7 ? (15 + bankRows * 5.2) : bankRows > 5 ? (16 + bankRows * 6.0) : (18 + bankRows * 6.8));
        const overhead = asKey ? 48 : 43;
        gridSizeMm = Math.max(96, Math.min(162, 268 - overhead - estBankH));
    }

    const { svgEl } = buildPrintWordSearchSVG({
        grid: State.grid,
        placedWords: State.placedWords,
        solutions: State.solutions,
        gridSizeMm,
        letterCase: Settings.letterCase,
        asKey: Boolean(asKey)
    });
    gridContainer.appendChild(svgEl);

    if (effectiveBankMode === 'count') {
        printBank.classList.add('hidden');
        if (countBanner) {
            countBanner.classList.remove('hidden');
            countBanner.textContent = `Challenge: Find and circle all ${wordsList.length} hidden word${wordsList.length === 1 ? '' : 's'} in the grid above!`;
        }
    } else {
        wordsList.forEach(w => {
            const li = document.createElement('li');
            li.className = 'print-word';
            li.textContent = formatWordDisplay(w, effectiveBankMode, Settings.letterCase);
            printBank.appendChild(li);
        });
    }
}

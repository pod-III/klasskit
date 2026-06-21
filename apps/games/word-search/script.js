// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playTone = (freq, type, duration) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
};

const Sound = {
    tap: () => playTone(600, 'sine', 0.1),
    success: () => {
        playTone(500, 'triangle', 0.1);
        setTimeout(() => playTone(1000, 'triangle', 0.2), 100);
    },
    error: () => playTone(150, 'sawtooth', 0.2),
    win: () => [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i * 100))
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green border-dark text-dark',
        error: 'bg-pink border-dark text-white',
        info: 'bg-blue border-dark text-white',
        warning: 'bg-orange border-dark text-white'
    };

    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-lg border-2 shadow-hard font-bold text-sm flex items-center gap-2 min-w-[200px] animate-pop`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    if (window.lucide) {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- CONFIRM TOAST ---
function showConfirmToast(message, onConfirm, onCancel) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-white border-2 border-dark px-4 py-3 rounded-lg shadow-hard min-w-[280px] animate-pop';
    toast.innerHTML = `
        <p class="font-bold text-dark text-sm mb-3">${escapeHtml(message)}</p>
        <div class="flex gap-2">
            <button id="confirm-yes" class="flex-1 bg-pink text-white py-2 rounded border-2 border-dark font-bold text-xs hover:brightness-110 transition">YES</button>
            <button id="confirm-no" class="flex-1 bg-gray-200 text-dark py-2 rounded border-2 border-dark font-bold text-xs hover:brightness-110 transition">NO</button>
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
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
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
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
        const store = tx.objectStore(STORE_PRESETS);
        const preset = { name, data: JSON.parse(JSON.stringify(data)), updatedAt: Date.now() };
        if (id) preset.id = id;
        const request = id ? store.put(preset) : store.add(preset);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPresets() {
    if (!dataBase) return [];
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const index = store.index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result.reverse());
    });
}

async function getPreset(id) {
    if (!dataBase) return null;
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
    });
}

async function deletePreset(id) {
    if (!dataBase) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = dataBase.transaction(STORE_PRESETS, 'readwrite');
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
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
    validWords: new Set(),
    foundWords: new Set(),
    selectionStart: null,
    isActive: false,
    totalWords: 0
};

// --- DIFFICULTY ---
const Difficulty = {
    allowBackwards: false,
    allowDiagonal: false,
};

function getActiveDirs() {
    // Always: forward horizontal + forward vertical
    const dirs = [{ r: 0, c: 1 }, { r: 1, c: 0 }];
    if (Difficulty.allowBackwards) {
        dirs.push({ r: 0, c: -1 }, { r: -1, c: 0 });
    }
    if (Difficulty.allowDiagonal) {
        dirs.push({ r: 1, c: 1 }, { r: -1, c: 1 });
        // Backward diagonals only when both modes active
        if (Difficulty.allowBackwards) {
            dirs.push({ r: -1, c: -1 }, { r: 1, c: -1 });
        }
    }
    return dirs;
}

function toggleDifficulty(mode) {
    if (mode === 'backwards') {
        Difficulty.allowBackwards = !Difficulty.allowBackwards;
        document.getElementById('toggle-backwards').classList.toggle('active', Difficulty.allowBackwards);
    } else if (mode === 'diagonal') {
        Difficulty.allowDiagonal = !Difficulty.allowDiagonal;
        document.getElementById('toggle-diagonal').classList.toggle('active', Difficulty.allowDiagonal);
    }
    updateDifficultyLabel();
}

function updateDifficultyLabel() {
    const el = document.getElementById('difficulty-label');
    if (!el) return;
    const { allowBackwards, allowDiagonal } = Difficulty;
    let text, colorClass;
    if (!allowBackwards && !allowDiagonal) {
        text = '⭐ Easy — Horizontal &amp; Vertical';
        colorClass = 'bg-green/10 border-green/30 text-green';
    } else if (allowBackwards && !allowDiagonal) {
        text = '⭐⭐ Medium — + Backwards';
        colorClass = 'bg-orange/10 border-orange/30 text-orange';
    } else if (!allowBackwards && allowDiagonal) {
        text = '⭐⭐ Medium — + Diagonal';
        colorClass = 'bg-orange/10 border-orange/30 text-orange';
    } else {
        text = '⭐⭐⭐ Hard — All Directions';
        colorClass = 'bg-pink/10 border-pink/30 text-pink';
    }
    el.className = `text-center py-1.5 px-3 border-2 rounded-lg ${colorClass}`;
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
    userPresetSelect: document.getElementById('userPresetSelect'),
    userPresetNameInput: document.getElementById('userPresetNameInput'),
    savedPuzzleSelect: document.getElementById('savedPuzzleSelect'),
    savedPuzzleNameInput: document.getElementById('savedPuzzleNameInput'),
    emptyStateCta: document.getElementById('empty-state-cta'),
    emptyBankMsg: document.getElementById('empty-bank-msg')
};

// --- CLOUD PERSISTENCE ---
let syncTimeout = null;
async function syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        const presets = await getAllPresets();
        const puzzles = await getAllSavedPuzzles();
        await saveProgress('word_search', {
            presets,
            puzzles,
            currentPresetId
        });
    }, 2000);
}

async function loadFromCloud() {
    const cloudData = await loadProgress('word_search');
    if (cloudData) {
        if (cloudData.presets) {
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
        if (cloudData.puzzles) {
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

// --- PERSISTENCE LOGIC ---

async function renderPresetSelector() {
    const presets = await getAllPresets();
    if (!els.userPresetSelect) return;
    els.userPresetSelect.innerHTML = '<option value="">-- Select a Preset --</option>';
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === currentPresetId) option.selected = true;
        els.userPresetSelect.appendChild(option);
    });
    syncToCloud();
}

async function onUserPresetSelect() {
    const id = parseInt(els.userPresetSelect.value);
    if (!id && id !== 0) return;
    const preset = await getPreset(id);
    if (preset) {
        currentPresetId = id;
        els.input.value = preset.data.words || '';
        els.sizeSlider.value = preset.data.size || '10';
        els.sizeDisplay.innerText = `${els.sizeSlider.value}x${els.sizeSlider.value}`;
        els.userPresetNameInput.value = preset.name;
        // Restore difficulty
        Difficulty.allowBackwards = preset.data.allowBackwards || false;
        Difficulty.allowDiagonal = preset.data.allowDiagonal || false;
        document.getElementById('toggle-backwards').classList.toggle('active', Difficulty.allowBackwards);
        document.getElementById('toggle-diagonal').classList.toggle('active', Difficulty.allowDiagonal);
        updateDifficultyLabel();
        await saveCurrentPresetId(id);
    }
}

async function saveCurrentUserPreset() {
    try {
        const name = els.userPresetNameInput.value.trim() || 'Untitled';
        const data = { words: els.input.value, size: els.sizeSlider.value, allowBackwards: Difficulty.allowBackwards, allowDiagonal: Difficulty.allowDiagonal };
        const id = await savePreset(name, data, currentPresetId);
        currentPresetId = id;
        await saveCurrentPresetId(id);
        await renderPresetSelector();
        showToast('Preset saved!', 'success');
    } catch (e) {
        showToast('Failed to save preset', 'error');
    }
}

async function createNewUserPreset() {
    els.userPresetNameInput.value = 'New Preset';
    els.input.value = '';
    els.sizeSlider.value = '10';
    els.sizeDisplay.innerText = '10x10';
    currentPresetId = null;
    await saveCurrentPresetId(null);
    await renderPresetSelector();
}

async function deleteCurrentUserPreset() {
    if (!currentPresetId) {
        showToast('No preset selected.', 'error');
        return;
    }
    showConfirmToast('Delete this preset?', async () => {
        await deletePreset(currentPresetId);
        currentPresetId = null;
        els.userPresetNameInput.value = '';
        await saveCurrentPresetId(null);
        await renderPresetSelector();
        showToast('Preset deleted!', 'success');
    });
}

// --- SAVED PUZZLES ---

async function getAllSavedPuzzles() {
    if (!dataBase) return [];
    return new Promise((resolve) => {
        const tx = dataBase.transaction(STORE_PUZZLES, 'readonly');
        const index = tx.objectStore(STORE_PUZZLES).index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result.reverse());
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
    const id = parseInt(els.savedPuzzleSelect.value);
    if (!id && id !== 0) return;
    const puzzle = await getSavedPuzzle(id);
    if (puzzle) {
        currentSavedPuzzleId = id;
        loadSavedPuzzleData(puzzle.data);
        els.savedPuzzleNameInput.value = puzzle.name;
        showToast('Puzzle loaded!', 'success');
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
        showToast('No puzzle to save.', 'error');
        return;
    }
    try {
        const name = els.savedPuzzleNameInput.value.trim() || `Puzzle ${new Date().toLocaleDateString()}`;
        const puzzleData = {
            grid: State.grid,
            solutions: Array.from(State.solutions),
            validWords: Array.from(State.validWords),
            totalWords: State.totalWords,
            size: State.grid.length
        };
        const id = await saveGeneratedPuzzle(name, puzzleData, currentSavedPuzzleId);
        currentSavedPuzzleId = id;
        await renderSavedPuzzleSelector();
        showToast('Puzzle saved!', 'success');
    } catch (e) {
        showToast('Failed to save', 'error');
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
        showToast('No saved puzzle selected.', 'error');
        return;
    }
    showConfirmToast('Delete this saved puzzle?', async () => {
        await deleteGeneratedPuzzle(currentSavedPuzzleId);
        currentSavedPuzzleId = null;
        els.savedPuzzleNameInput.value = '';
        els.savedPuzzleSelect.value = '';
        await renderSavedPuzzleSelector();
        showToast('Puzzle deleted!', 'success');
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
    State.solutions = new Set(data.solutions);
    State.validWords = new Set(data.validWords);
    State.foundWords.clear();
    State.isActive = true;
    State.selectionStart = null;
    State.totalWords = data.totalWords;

    els.emptyStateCta?.classList.add('hidden');
    renderGrid(data.size);
    renderWordBank(Array.from(State.validWords));
    updateHUD();

    // Use a small delay to ensure grid is rendered before fitting
    setTimeout(fitGridToDisplay, 50);
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
        const fontSize = Math.max(0.7, CELL_SIZE / 45); // Scale font slightly smaller
        el.style.fontSize = `${fontSize}rem`;
    });
}

function fitGridToDisplay() {
    const container = els.grid.parentElement.parentElement; // Grid Area container
    const size = State.grid.length;
    if (!size || !container) return;

    // Use a larger offset for the safe area (80px instead of 40px)
    // to account for container padding and the floating glass header
    const targetWidth = container.clientWidth - 80;
    const targetHeight = container.clientHeight - 80;

    // Grid gap is 4px (gap-1) and padding is 4px (p-1)
    const gapTotal = (size - 1) * 4;
    const paddingTotal = 8; // 4px padding on both sides

    const minDim = Math.min(targetWidth, targetHeight);

    // Accurate cell size calculation: (TotalDim - Gaps - InternalPadding) / NumberOfCells
    CELL_SIZE = Math.floor((minDim - gapTotal - paddingTotal) / size);

    // Safety boundaries
    CELL_SIZE = Math.max(20, Math.min(CELL_SIZE, 80));

    updateGridSize();
}

// --- GAME LOGIC ---

function initGame(size, words) {
    State.grid = Array(size).fill(null).map(() => Array(size).fill(''));
    State.solutions.clear();
    State.validWords = new Set();
    State.foundWords.clear();
    State.isActive = true;

    words.sort((a, b) => b.length - a.length);
    const placed = [];
    words.forEach(word => {
        if (placeWord(word, size)) {
            placed.push(word);
            State.validWords.add(word);
        }
    });

    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
    fitGridToDisplay(); // Auto-fit on generation
    Sound.success();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
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
            return true;
        }
    }
    return false;
}

function renderGrid(size) {
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = State.grid[r][c];
            cell.dataset.r = r; cell.dataset.c = c;
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
    words.sort().forEach(w => {
        const li = document.createElement('li');
        li.className = 'word-tag';
        li.innerText = w;
        li.id = `tag-${w}`;
        els.bank.appendChild(li);
    });
}

function updateHUD() {
    els.foundCount.innerText = State.foundWords.size;
    els.totalCount.innerText = State.totalWords;
    if (State.foundWords.size === State.totalWords && State.totalWords > 0) endGame(true);
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

    // Batch DOM updates: remove old previews only if needed
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
        path.forEach(p => getCell(p.r, p.c).classList.add('found'));
        const tag = document.getElementById(`tag-${match}`);
        if (tag) tag.classList.add('found');
        State.foundWords.add(match);
        updateHUD();
    } else {
        Sound.error();
        path.forEach(p => {
            const c = getCell(p.r, p.c);
            c.classList.add('error');
            setTimeout(() => c.classList.remove('error'), 400);
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
}

function endGame(success) {
    State.isActive = false;
    if (success) {
        Sound.win();
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        showToast('You found everything!', 'success');
    }
}

// --- INIT ---

window.onload = async () => {
    await requireAuth();
    await initDB();
    const sid = await getCurrentPresetId();
    if (sid) {
        currentPresetId = sid;
        const p = await getPreset(sid);
        if (p) {
            els.input.value = p.data.words || '';
            els.sizeSlider.value = p.data.size || '10';
            els.sizeDisplay.innerText = `${els.sizeSlider.value}x${els.sizeSlider.value}`;
            els.userPresetNameInput.value = p.name;
            // Restore difficulty
            Difficulty.allowBackwards = p.data.allowBackwards || false;
            Difficulty.allowDiagonal = p.data.allowDiagonal || false;
            document.getElementById('toggle-backwards').classList.toggle('active', Difficulty.allowBackwards);
            document.getElementById('toggle-diagonal').classList.toggle('active', Difficulty.allowDiagonal);
            updateDifficultyLabel();
        }
    }
    await loadFromCloud();
    await renderPresetSelector();
    await renderSavedPuzzleSelector();

    els.sizeSlider.oninput = (e) => {
        els.sizeDisplay.innerText = `${e.target.value}x${e.target.value}`;
    };

    els.zoomIn.onclick = () => { CELL_SIZE = Math.min(CELL_SIZE + 5, 80); updateGridSize(); };
    els.zoomOut.onclick = () => { CELL_SIZE = Math.max(CELL_SIZE - 5, 25); updateGridSize(); };

    els.generateBtn.onclick = () => {
        const words = els.input.value.split(',').map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, '')).filter(w => w.length > 0);
        if (words.length < 1) return showToast('Enter some words!', 'error');
        saveCurrentUserPreset();

        // Reset saved puzzle ID when starting a fresh one
        currentSavedPuzzleId = null;
        els.savedPuzzleNameInput.value = '';
        els.savedPuzzleSelect.value = '';

        initGame(parseInt(els.sizeSlider.value), words);
        if (window.innerWidth < 768) toggleControlPanel(true);
    };

    els.giveUpBtn.onclick = () => document.getElementById('confirm-modal').classList.remove('hidden');
    document.getElementById('cancel-reveal').onclick = () => document.getElementById('confirm-modal').classList.add('hidden');
    document.getElementById('confirm-reveal').onclick = () => { revealSolutions(); document.getElementById('confirm-modal').classList.add('hidden'); };

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => { els.input.value = btn.dataset.words; };
    });

    window.onresize = () => { if (State.grid.length) fitGridToDisplay(); };

    if (window.innerWidth < 768) toggleControlPanel(true);
};

// --- Print Mode ---
window.setPrintMode = function (mode) {
    const printArea = document.getElementById('print-area');
    if (mode === 'separate') {
        printArea.classList.add('print-separate-pages');
    } else {
        printArea.classList.remove('print-separate-pages');
    }
    window.print();
};

// Global Print Hook
const originalPrint = window.print;
window.print = function () {
    if (State.grid.length) preparePrintVersion();
    originalPrint();
};

function preparePrintVersion() {
    const printGrid = els.grid.cloneNode(true);
    printGrid.className = 'print-grid';
    printGrid.style.width = '';
    printGrid.style.height = '';
    printGrid.style.gridTemplateColumns = `repeat(${State.grid.length}, 1fr)`;
    printGrid.style.setProperty('--grid-size', State.grid.length);

    document.getElementById('print-grid-container').innerHTML = '';
    document.getElementById('print-grid-container').appendChild(printGrid);

    const printBank = document.getElementById('print-word-bank');
    printBank.innerHTML = '';
    Array.from(State.validWords).sort().forEach(w => {
        const li = document.createElement('li');
        li.className = 'print-word';
        li.innerText = w;
        printBank.appendChild(li);
    });
}

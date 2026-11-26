lucide.createIcons();

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

let buildFeedbackTimer = null;

function showBuildFeedback(message, tone = 'error') {
    if (buildFeedbackTimer) {
        clearTimeout(buildFeedbackTimer);
        buildFeedbackTimer = null;
    }
    const el = document.getElementById('build-feedback');
    if (!el) return;
    if (!message) {
        el.textContent = '';
        el.classList.add('hidden');
        return;
    }
    el.textContent = message;
    el.className = 'text-xs font-bold px-3 py-2 rounded-lg border transition-colors ' + (
        tone === 'error'
            ? 'bg-pink/15 text-pink border-pink/40 dark:bg-pink/20 dark:text-pink'
            : tone === 'warn'
                ? 'bg-orange/15 text-orange border-orange/40 dark:bg-orange/20 dark:text-orange'
                : 'bg-green/15 text-green-700 border-green/40 dark:bg-green/20 dark:text-green-400'
    );
}

let syncTimeout = null;
async function syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        const game_state = {
            word_input: await getFromDB('word_input'),
            grid_rows: await getFromDB('grid_rows'),
            grid_cols: await getFromDB('grid_cols'),
            puzzle_data: await getFromDB('puzzle_data')
        };
        const word_sets = await getAllWordSets();
        saveProgress('crossword', { game_state, word_sets });
    }, 1500);
}

// --- PERSISTENCE (IndexedDB) ---
const DB_NAME = 'CrosswordDB';
const DB_VERSION = 2;
const STORE_NAME = 'game_state';
const SETS_STORE = 'word_sets';

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(SETS_STORE)) {
                db.createObjectStore(SETS_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToDB(key, data) {
    try {
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(data, key);
    } catch (err) {
        console.error('IndexedDB Save Error:', err);
    }
}

async function getFromDB(key) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error('IndexedDB Load Error:', err);
        return null;
    }
}

async function saveGameState() {
    await saveToDB('word_input', els.input.value);
    await saveToDB('grid_rows', GRID_ROWS);
    await saveToDB('grid_cols', GRID_COLS);
    await saveToDB('word_input', els.input.value);
    await saveToDB('grid_rows', GRID_ROWS);
    await saveToDB('grid_cols', GRID_COLS);
    await saveToDB('active_set_id', activeWordSetId);
    if (puzzle) await saveToDB('puzzle_data', puzzle);
    syncToCloud();
}

async function loadGameState() {
    const input = await getFromDB('word_input');
    if (input) els.input.value = input;
    
    const rows = await getFromDB('grid_rows');
    const cols = await getFromDB('grid_cols');
    if (rows && cols) {
        GRID_ROWS = rows;
        GRID_COLS = cols;
    }

    const savedActiveSetId = await getFromDB('active_set_id');
    if (savedActiveSetId !== undefined && savedActiveSetId !== null) {
        activeWordSetId = savedActiveSetId;
    }

    const savedPuzzle = await getFromDB('puzzle_data');
    if (savedPuzzle) {
        puzzle = savedPuzzle;
        grid = puzzle.grid;
        words = puzzle.words;
        render();
    }
}

// --- WORD SETS (IndexedDB) ---
async function saveWordSet(name, content, options = {}) {
    try {
        const db = await initDB();
        const existingSets = await getAllWordSets();
        const now = Date.now();
        const activate = Boolean(options.activate);
        const updateActive = Boolean(options.updateActive);

        let targetExisting = null;
        if (updateActive && activeWordSetId !== null && activeWordSetId !== undefined) {
            const match = existingSets.find(s => String(s.id) === String(activeWordSetId));
            if (match && (match.name || '').trim().toLowerCase() === name.trim().toLowerCase()) {
                targetExisting = match;
            }
        }

        const tx = db.transaction(SETS_STORE, 'readwrite');
        const store = tx.objectStore(SETS_STORE);
        let request;
        if (targetExisting) {
            request = store.put({
                ...targetExisting,
                id: targetExisting.id,
                name: name.trim(),
                content,
                updatedAt: now,
                lastUsed: now,
                usageCount: (targetExisting.usageCount || 0) + 1
            });
        } else {
            request = store.add({
                name: name.trim(),
                content,
                createdAt: now,
                updatedAt: now,
                lastUsed: now,
                usageCount: 1
            });
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                const savedId = targetExisting ? targetExisting.id : request.result;
                if (activate && savedId !== undefined) {
                    activeWordSetId = savedId;
                    saveToDB('active_set_id', activeWordSetId);
                }
                syncToCloud();
                resolve({ id: savedId, updated: Boolean(targetExisting) });
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('Save word set error:', err);
        return null;
    }
}

async function getAllWordSets() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SETS_STORE, 'readonly');
            const store = tx.objectStore(SETS_STORE);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('Get word sets error:', err);
        return [];
    }
}

async function deleteWordSet(id) {
    try {
        const db = await initDB();
        const tx = db.transaction(SETS_STORE, 'readwrite');
        const store = tx.objectStore(SETS_STORE);
        store.delete(id);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => { syncToCloud(); resolve(); };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('Delete word set error:', err);
    }
}

async function loadFromCloud() {
    const cloudData = await loadProgress('crossword');
    if (!cloudData) return;

    if (cloudData.word_sets && Array.isArray(cloudData.word_sets)) {
        const db = await initDB();
        const existingSets = await getAllWordSets();
        const existingNames = new Set(existingSets.map(s => s.name));

        for (const set of cloudData.word_sets) {
            if (!set.name || existingNames.has(set.name)) continue;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(SETS_STORE, 'readwrite');
                const store = tx.objectStore(SETS_STORE);
                const item = {
                    name: set.name,
                    content: set.content,
                    createdAt: set.createdAt || Date.now(),
                    updatedAt: set.updatedAt || set.createdAt || Date.now(),
                    lastUsed: set.lastUsed || set.createdAt || Date.now(),
                    usageCount: set.usageCount || 1
                };
                store.add(item);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        }
    }

    if (cloudData.game_state) {
        const { word_input, grid_rows, grid_cols, puzzle_data } = cloudData.game_state;
        if (word_input && !els.input.value) {
            await saveToDB('word_input', word_input);
            els.input.value = word_input;
        }
        if (grid_rows && grid_cols) {
            await saveToDB('grid_rows', grid_rows);
            await saveToDB('grid_cols', grid_cols);
        }
        if (puzzle_data && !puzzle) {
            await saveToDB('puzzle_data', puzzle_data);
            puzzle = puzzle_data;
            grid = puzzle_data.grid;
            words = puzzle_data.words;
            GRID_ROWS = puzzle_data.rows || GRID_ROWS;
            GRID_COLS = puzzle_data.cols || GRID_COLS;
            render();
        }
    }
}

async function markWordSetUsed(id) {
    try {
        const db = await initDB();
        const existingSets = await getAllWordSets();
        const match = existingSets.find(s => String(s.id) === String(id));
        if (!match) return;
        const tx = db.transaction(SETS_STORE, 'readwrite');
        const store = tx.objectStore(SETS_STORE);
        const now = Date.now();
        store.put({
            ...match,
            id: match.id,
            lastUsed: now,
            usageCount: (match.usageCount || 0) + 1
        });
        return new Promise((resolve) => {
            tx.oncomplete = () => { syncToCloud(); resolve(); };
            tx.onerror = () => resolve();
        });
    } catch (err) {
        console.error('Mark word set used error:', err);
    }
}

async function renderWordSets() {
    const list = document.getElementById('sets-list');
    const countEl = document.getElementById('saved-count');
    const sortEl = document.getElementById('sets-sort');
    if (!list) return;
    const sets = await getAllWordSets();
    if (countEl) countEl.textContent = String(sets.length);

    if (activeWordSetId !== null && activeWordSetId !== undefined) {
        const stillExists = sets.some(s => String(s.id) === String(activeWordSetId));
        if (!stillExists) activeWordSetId = null;
    }

    if (sets.length === 0) {
        list.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-xs italic">No saved sets yet.</p>';
        return;
    }

    const sort = sortEl ? sortEl.value : 'recent';
    const sorted = sets.slice().sort((a, b) => {
        if (sort === 'alpha') return (a.name || '').localeCompare(b.name || '');
        if (sort === 'popular') {
            return (b.usageCount || 0) - (a.usageCount || 0)
                || ((b.lastUsed || b.updatedAt || b.createdAt || 0) - (a.lastUsed || a.updatedAt || a.createdAt || 0));
        }
        return (b.lastUsed || b.updatedAt || b.createdAt || 0) - (a.lastUsed || a.updatedAt || a.createdAt || 0);
    });

    list.innerHTML = '';
    sorted.forEach(set => {
        const isActive = activeWordSetId !== null && activeWordSetId !== undefined && String(set.id) === String(activeWordSetId);
        const item = document.createElement('div');
        item.className = `flex items-center gap-2 p-2 rounded-lg border transition-all ${isActive
            ? 'border-blue bg-blue/10 dark:bg-blue/20'
            : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-500/40 hover:border-blue/40'}`;
        item.innerHTML = `
            <button type="button" class="set-row-load flex-1 min-w-0 text-left">
                <p class="text-sm font-bold text-dark dark:text-slate-100 truncate flex items-center gap-1.5">
                    <span class="truncate">${escapeHTML(set.name)}</span>
                    ${isActive ? '<span class="px-1.5 py-0.5 rounded bg-blue text-white text-[9px] font-black uppercase shrink-0">Active</span>' : ''}
                </p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${set.content.split('\n').filter(l => l.trim()).length} words</p>
            </button>
            <button type="button" class="set-load-btn p-1.5 bg-blue/10 dark:bg-blue/20 text-blue rounded-md border border-blue/20 hover:bg-blue hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Load Set" aria-label="Load word set" data-id="${escapeHTML(set.id)}">
                <i data-lucide="upload" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
            <button type="button" class="set-delete-btn p-1.5 bg-pink/10 dark:bg-pink/20 text-pink rounded-md border border-pink/20 hover:bg-pink hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Delete Set" aria-label="Delete word set" data-id="${escapeHTML(set.id)}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
        `;

        const handleLoadSet = async () => {
            activeWordSetId = set.id;
            els.input.value = set.content;
            const nameInput = document.getElementById('set-name-input');
            if (nameInput) nameInput.value = set.name || '';
            showBuildFeedback('');
            await markWordSetUsed(set.id);
            await saveGameState();
            await renderWordSets();
            Sound.click();
            if (typeof showCwToast === 'function') showCwToast(`Loaded "${set.name}"`, 'success');
        };

        // Load handlers
        item.querySelector('.set-row-load').addEventListener('click', handleLoadSet);
        item.querySelector('.set-load-btn').addEventListener('click', handleLoadSet);

        // Delete button
        item.querySelector('.set-delete-btn').addEventListener('click', async () => {
            await deleteWordSet(set.id);
            if (String(activeWordSetId) === String(set.id)) {
                activeWordSetId = null;
                const nameInput = document.getElementById('set-name-input');
                if (nameInput) nameInput.value = '';
                await saveToDB('active_set_id', null);
            }
            Sound.back();
            renderWordSets();
        });

        list.appendChild(item);
    });
    lucide.createIcons();
}

// --- THEME ---
const THEME_KEY = 'theme_crossword';
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    Sound.click();
}

// --- STATE ---
let GRID_ROWS = 15;
let GRID_COLS = 15;
let CELL_SIZE = 45;
let grid = [];
let words = [];
let puzzle = null;
let currentFocus = { r: -1, c: -1 };
let currentDir = 'across';
let activeWordSetId = null;

// --- AUDIO ---
const SOUND_KEY = 'sound_crossword';
let audioCtx = null;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';

function getAudioCtx() {
    if (!audioCtx) {
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
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
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
    type: () => playTone(800, 'sine', 0.05),
    back: () => playTone(600, 'sine', 0.05),
    click: () => playTone(400, 'triangle', 0.05),
    success: () => { playTone(500, 'sine', 0.1); setTimeout(() => playTone(1000, 'sine', 0.2), 100); },
    error: () => playTone(150, 'sawtooth', 0.2),
    toggleMute: () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
        updateSoundToggleUI();
        if (soundEnabled) Sound.click();
    }
};

// --- ELEMENTS ---
const els = {
    grid: document.getElementById('crossword-grid'),
    across: document.getElementById('clues-across'),
    down: document.getElementById('clues-down'),
    input: document.getElementById('word-input'),
    controls: document.getElementById('controls'),
    container: document.getElementById('crossword-container')
};

function autoFitGrid() {
    if (!els.container) return;
    const padding = 32;
    const availableWidth = els.container.offsetWidth - padding;
    const availableHeight = els.container.offsetHeight - padding;
    const size = Math.floor(Math.min(availableWidth / GRID_COLS, availableHeight / GRID_ROWS));
    CELL_SIZE = Math.max(25, Math.min(size, 80));
    updateGridSize();
}

// --- UI & UTILS ---
function toggleControlPanel(forceHide = false) {
    const isHidden = window.innerWidth >= 768
        ? els.controls.classList.contains('hidden-panel-desktop')
        : els.controls.classList.contains('hidden-panel-mobile');

    if (forceHide || !isHidden) els.controls.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
    else els.controls.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
    setTimeout(autoFitGrid, 320);
}

function updateGridSize() {
    document.querySelectorAll('.cw-cell.filled').forEach(el => {
        el.style.width = `${CELL_SIZE}px`;
        el.style.height = `${CELL_SIZE}px`;
    });
    document.querySelectorAll('.cw-cell input').forEach(input => {
        const fontSize = Math.max(0.8, CELL_SIZE / 30);
        input.style.fontSize = `${fontSize}rem`;
    });
    document.querySelectorAll('.cw-number').forEach(num => {
        const numSize = Math.max(0.5, CELL_SIZE / 60);
        num.style.fontSize = `${numSize}rem`;
    });
}

// --- LAYOUT ENGINE (Core Logic) ---

function generateLayout(inputWords) {
    // Initial large search space for layout engine
    const searchSize = 30;
    grid = Array(searchSize).fill(null).map(() => Array(searchSize).fill(null));
    words = [];

    const best = findBestGrid(inputWords, 15, searchSize);
    if (best) {
        // Crop the best result to the bounding box
        cropToBoundingBox(best);
        
        puzzle = { grid: grid, words: words, rows: GRID_ROWS, cols: GRID_COLS };
        saveGameState();
        render();
        return true;
    }
    return false;
}

function cropToBoundingBox(puzzleData) {
    const tempGrid = puzzleData.grid;
    const tempWords = puzzleData.words;
    
    let minR = 100, maxR = -1, minC = 100, maxC = -1;
    
    // Find bounds
    for (let r = 0; r < tempGrid.length; r++) {
        for (let c = 0; c < tempGrid[r].length; c++) {
            if (tempGrid[r][c] !== null) {
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, c);
                maxC = Math.max(maxC, c);
            }
        }
    }

    if (maxR === -1) return; // Should not happen if words were placed

    // Add 1 cell padding for aesthetics
    minR = Math.max(0, minR - 1);
    maxR = Math.min(tempGrid.length - 1, maxR + 1);
    minC = Math.max(0, minC - 1);
    maxC = Math.min(tempGrid[0].length - 1, maxC + 1);

    GRID_ROWS = (maxR - minR) + 1;
    GRID_COLS = (maxC - minC) + 1;

    // Re-map grid
    grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            grid[r - minR][c - minC] = tempGrid[r][c];
        }
    }

    // Re-map words
    words = tempWords.map(w => ({
        ...w,
        row: w.row - minR,
        col: w.col - minC
    }));
}

function findBestGrid(inputWords, attempts, size) {
    let best = null;
    let maxPlaced = -1;

    for (let i = 0; i < attempts; i++) {
        const currentGrid = Array(size).fill(null).map(() => Array(size).fill(null));
        const currentPlacedWords = [];
        const wordsToPlace = JSON.parse(JSON.stringify(inputWords));
        const anchorIdx = i < 5 ? 0 : (i % Math.min(wordsToPlace.length, 4));
        const first = wordsToPlace[anchorIdx];
        const startR = Math.floor(size / 2);
        const startC = Math.floor((size - first.word.length) / 2);
        
        // Internal placement helper for findBestGrid
        const place = (item, r, c, dir) => {
            currentPlacedWords.push({ ...item, row: r, col: c, dir: dir, placed: true });
            for (let j = 0; j < item.word.length; j++) {
                const row = dir === 'across' ? r : r + j;
                const col = dir === 'across' ? c + j : c;
                currentGrid[row][col] = item.word[j];
            }
        };

        place(first, startR, startC, 'across');
        first.placed = true;

        const rest = wordsToPlace.filter((_, idx) => idx !== anchorIdx);
        const remaining = i === 0 ? rest : shuffleArray(rest);
        let placedCount = 1;

        for (let pass = 0; pass < 50; pass++) {
            remaining.forEach(item => {
                if (!item.placed) {
                    // tryFitWord implementation using local currentGrid
                    let fitted = false;
                    for (let charIdx = 0; charIdx < item.word.length && !fitted; charIdx++) {
                        const char = item.word[charIdx];
                        for (let r = 0; r < size && !fitted; r++) {
                            for (let c = 0; c < size && !fitted; c++) {
                                if (currentGrid[r][c] === char) {
                                    if (checkPlacementDynamic(item.word, r - charIdx, c, 'down', currentGrid, size)) {
                                        place(item, r - charIdx, c, 'down');
                                        fitted = true;
                                    } else if (checkPlacementDynamic(item.word, r, c - charIdx, 'across', currentGrid, size)) {
                                        place(item, r, c - charIdx, 'across');
                                        fitted = true;
                                    }
                                }
                            }
                        }
                    }
                    if (fitted) { item.placed = true; placedCount++; }
                }
            });
            if (remaining.every(w => w.placed)) break;
        }

        if (placedCount > maxPlaced) {
            maxPlaced = placedCount;
            // Finalize numbers for this candidate
            const finalizedWords = currentPlacedWords.filter(w => w.placed);
            finalizedWords.sort((a, b) => (a.row - b.row) || (a.col - b.col));
            let num = 1;
            finalizedWords.forEach((w, idx) => {
                const existing = finalizedWords.slice(0, idx).find(prev => prev.row === w.row && prev.col === w.col);
                w.num = existing ? existing.num : num++;
            });
            best = { grid: currentGrid, words: finalizedWords };
        }
        if (maxPlaced === inputWords.length) break;
    }
    return best;
}

function checkPlacementDynamic(word, startR, startC, dir, targetGrid, size) {
    if (startR < 0 || startC < 0) return false;
    if (dir === 'across' && startC + word.length > size) return false;
    if (dir === 'down' && startR + word.length > size) return false;

    for (let i = 0; i < word.length; i++) {
        const r = dir === 'across' ? startR : startR + i;
        const c = dir === 'across' ? startC + i : startC;
        const currentVal = targetGrid[r][c];
        const char = word[i];

        if (currentVal !== null && currentVal !== char) return false;

        if (currentVal === char) {
            if (dir === 'across') {
                if (c > 0 && c < size - 1 && targetGrid[r][c - 1] !== null && targetGrid[r][c + 1] !== null) return false;
            }
            if (dir === 'down') {
                if (r > 0 && r < size - 1 && targetGrid[r - 1][c] !== null && targetGrid[r + 1][c] !== null) return false;
            }
        }

        if (currentVal === null) {
            if (dir === 'across') {
                if (r > 0 && targetGrid[r - 1][c] !== null) return false;
                if (r < size - 1 && targetGrid[r + 1][c] !== null) return false;
            } else {
                if (c > 0 && targetGrid[r][c - 1] !== null) return false;
                if (c < size - 1 && targetGrid[r][c + 1] !== null) return false;
            }
        }
    }

    if (dir === 'across') {
        if (startC > 0 && targetGrid[startR][startC - 1] !== null) return false;
        if (startC + word.length < size && targetGrid[startR][startC + word.length] !== null) return false;
    } else {
        if (startR > 0 && targetGrid[startR - 1][startC] !== null) return false;
        if (startR + word.length < size && targetGrid[startR + word.length][startC] !== null) return false;
    }

    return true;
}


// --- RENDER ---
function render() {
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = `repeat(${GRID_COLS}, 1fr)`;

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cw-cell ' + (grid[r][c] ? 'filled' : 'empty');
            cell.dataset.r = r; cell.dataset.c = c;
            cell.style.width = `${CELL_SIZE}px`;
            cell.style.height = `${CELL_SIZE}px`;

            if (grid[r][c]) {
                const isStart = words.some(w => w.row === r && w.col === c);
                if (isStart) {
                    const wordWithNum = words.find(w => w.row === r && w.col === c);
                    const num = document.createElement('span');
                    num.className = 'cw-number';
                    num.innerText = wordWithNum.num;
                    cell.appendChild(num);
                }

                const input = document.createElement('input');
                input.maxLength = 1;
                input.dataset.r = r; input.dataset.c = c;
                input.addEventListener('mousedown', (e) => handleCellClick(e, r, c));
                input.addEventListener('keydown', (e) => handleKeyDown(e, r, c));
                input.addEventListener('focus', () => updateHighlights(r, c));
                input.addEventListener('blur', () => {
                    if (document.activeElement !== input) {
                        document.querySelectorAll('.cell-focused').forEach(el => el.classList.remove('cell-focused'));
                        document.querySelectorAll('.word-highlight').forEach(el => el.classList.remove('word-highlight'));
                        document.querySelectorAll('.clue-item.active').forEach(el => el.classList.remove('active'));
                    }
                });
                cell.appendChild(input);
            }
            els.grid.appendChild(cell);
        }
    }

    els.across.innerHTML = ''; els.down.innerHTML = '';
    if (words.length === 0) {
        els.across.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-sm">No words placed yet.</p>';
        els.down.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-sm">No words placed yet.</p>';
    } else {
        words.filter(w => w.dir === 'across').forEach(w => {
            const li = document.createElement('div');
            li.className = 'clue-item';
            li.id = `clue-${w.num}-across`;
            li.innerHTML = `<span class="font-bold text-blue mr-2">${w.num}.</span> ${escapeHTML(w.clue)}`;
            li.onclick = () => selectWordByClue(w);
            els.across.appendChild(li);
        });
        words.filter(w => w.dir === 'down').forEach(w => {
            const li = document.createElement('div');
            li.className = 'clue-item';
            li.id = `clue-${w.num}-down`;
            li.innerHTML = `<span class="font-bold text-pink mr-2">${w.num}.</span> ${escapeHTML(w.clue)}`;
            li.onclick = () => selectWordByClue(w);
            els.down.appendChild(li);
        });
    }
    updateGridSize();
    autoFitGrid();
    preparePrintVersion();
}

// --- INTERACTION ---
function handleCellClick(e, r, c) {
    Sound.click();
    if (currentFocus.r === r && currentFocus.c === c) currentDir = currentDir === 'across' ? 'down' : 'across';
    else {
        const hasAcross = words.some(w => w.dir === 'across' && r === w.row && c >= w.col && c < w.col + w.word.length);
        const hasDown = words.some(w => w.dir === 'down' && c === w.col && r >= w.row && r < w.row + w.word.length);
        if (hasAcross && !hasDown) currentDir = 'across';
        else if (!hasAcross && hasDown) currentDir = 'down';
    }
    updateHighlights(r, c);
}

function handleKeyDown(e, r, c) {
    const key = e.key.toUpperCase();
    if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault(); Sound.type();
        if (e.target.parentElement.classList.contains('locked')) return;
        e.target.value = key;
        checkCurrentWordCompletion(r, c);
        jumpToNextCell(r, c);
        broadcastState();
        return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); if (e.target.parentElement.classList.contains('locked')) return;
        if (e.target.value) { e.target.value = ''; Sound.back(); broadcastState(); }
        else { Sound.back(); jumpToPrevCell(r, c); }
    }
    else if (e.key === 'ArrowRight') focusCell(r, c + 1);
    else if (e.key === 'ArrowLeft') focusCell(r, c - 1);
    else if (e.key === 'ArrowDown') focusCell(r + 1, c);
    else if (e.key === 'ArrowUp') focusCell(r - 1, c);
    else if (e.key === 'Enter') { e.preventDefault(); currentDir = currentDir === 'across' ? 'down' : 'across'; updateHighlights(r, c); }
}

function jumpToNextCell(r, c) {
    const dr = currentDir === 'across' ? 0 : 1;
    const dc = currentDir === 'across' ? 1 : 0;
    let nr = r + dr, nc = c + dc;
    for (let i = 0; i < GRID_ROWS + GRID_COLS; i++) {
        const cell = document.querySelector(`.cw-cell[data-r="${nr}"][data-c="${nc}"]`);
        if (!cell || !cell.classList.contains('filled')) break;
        const input = cell.querySelector('input');
        if (input && !cell.classList.contains('locked')) { focusCell(nr, nc); return; }
        nr += dr; nc += dc;
    }
}

function jumpToPrevCell(r, c) {
    const dr = currentDir === 'across' ? 0 : -1;
    const dc = currentDir === 'across' ? -1 : 0;
    let pr = r + dr, pc = c + dc;
    for (let i = 0; i < GRID_ROWS + GRID_COLS; i++) {
        const cell = document.querySelector(`.cw-cell[data-r="${pr}"][data-c="${pc}"]`);
        if (!cell || !cell.classList.contains('filled')) break;
        const input = cell.querySelector('input');
        if (input && !cell.classList.contains('locked')) { input.value = ''; focusCell(pr, pc); return; }
        pr += dr; pc += dc;
    }
}

function checkCurrentWordCompletion(r, c) {
    const activeWord = words.find(w => w.dir === currentDir && (currentDir === 'across' ? (w.row === r && c >= w.col && c < w.col + w.word.length) : (w.col === c && r >= w.row && r < w.row + w.word.length)));
    if (!activeWord) return;
    let guess = "", isFull = true;
    const cells = [];
    for (let i = 0; i < activeWord.word.length; i++) {
        const cr = activeWord.dir === 'across' ? activeWord.row : activeWord.row + i;
        const cc = activeWord.dir === 'across' ? activeWord.col + i : activeWord.col;
        const cell = document.querySelector(`.cw-cell[data-r="${cr}"][data-c="${cc}"]`);
        const val = cell.querySelector('input').value.toUpperCase();
        if (!val) { isFull = false; break; }
        guess += val; cells.push(cell);
    }
    if (isFull) {
        if (guess === activeWord.word) {
            Sound.success(); confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
            cells.forEach(cell => { cell.classList.add('locked'); cell.classList.remove('word-highlight', 'cell-focused'); });
            const clueEl = document.getElementById(`clue-${activeWord.num}-${activeWord.dir}`);
            if (clueEl) clueEl.classList.add('solved');
        } else {
            Sound.error(); cells.forEach(cell => { cell.classList.add('error'); setTimeout(() => cell.classList.remove('error'), 400); });
        }
    }
}

function focusCell(r, c) {
    const input = document.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    if (input) { input.focus(); updateHighlights(r, c); }
}

function selectWordByClue(w) { currentDir = w.dir; focusCell(w.row, w.col); Sound.click(); }

function updateHighlights(r, c) {
    currentFocus = { r, c };
    document.querySelectorAll('.word-highlight').forEach(el => el.classList.remove('word-highlight'));
    document.querySelectorAll('.cell-focused').forEach(el => el.classList.remove('cell-focused'));
    document.querySelectorAll('.clue-item.active').forEach(el => el.classList.remove('active'));
    const focusedCell = document.querySelector(`.cw-cell[data-r="${r}"][data-c="${c}"]`);
    if (focusedCell) focusedCell.classList.add('cell-focused');
    const activeWord = words.find(w => w.dir === currentDir && (currentDir === 'across' ? (w.row === r && c >= w.col && c < w.col + w.word.length) : (w.col === c && r >= w.row && r < w.row + w.word.length)));
    if (activeWord) {
        for (let i = 0; i < activeWord.word.length; i++) {
            const row = activeWord.dir === 'across' ? activeWord.row : activeWord.row + i;
            const col = activeWord.dir === 'across' ? activeWord.col + i : activeWord.col;
            const cell = document.querySelector(`.cw-cell[data-r="${row}"][data-c="${col}"]`);
            if (cell && !cell.classList.contains('locked')) cell.classList.add('word-highlight');
        }
        const clue = document.getElementById(`clue-${activeWord.num}-${activeWord.dir}`);
        if (clue) { clue.classList.add('active'); clue.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
}

// --- NEW: Print Mode Trigger ---
let printingAsKey = false;
window.setPrintMode = function(mode, asKey = false) {
    if (!words || !words.length) {
        if (typeof showCwToast === 'function') showCwToast('Build a puzzle first before printing!', 'warning');
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
    window.print();
};

window.addEventListener('beforeprint', () => {
    preparePrintVersion(printingAsKey);
});

window.addEventListener('afterprint', () => {
    printingAsKey = false;
    preparePrintVersion(false);
});

function getActiveGridBounds(sourceGrid) {
    if (!Array.isArray(sourceGrid) || !sourceGrid.length) return null;
    let minR = Infinity;
    let maxR = -1;
    let minC = Infinity;
    let maxC = -1;

    for (let r = 0; r < sourceGrid.length; r++) {
        const row = sourceGrid[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
            if (row[c]) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }

    if (maxR === -1) return null;
    return {
        minR,
        maxR,
        minC,
        maxC,
        activeRows: maxR - minR + 1,
        activeCols: maxC - minC + 1
    };
}

function buildPrintCrosswordSVG({ grid: sourceGrid, words: sourceWords, bounds, cellSizeMm, asKey }) {
    const { minR, minC, activeRows, activeCols } = bounds;
    const U = 100;

    const outerStroke = Math.max(3.6, Math.min(8.2, +((0.55 / cellSizeMm) * U).toFixed(2)));
    const innerStroke = Math.max(2.0, Math.min(4.4, +((0.28 / cellSizeMm) * U).toFixed(2)));
    const shadowOffset = Math.max(4.5, Math.min(11.0, +((0.75 / cellSizeMm) * U).toFixed(2)));
    const padTL = Math.ceil(outerStroke * 0.75);
    const padBR = Math.ceil(shadowOffset + outerStroke * 0.75);
    const vbW = activeCols * U + padTL + padBR;
    const vbH = activeRows * U + padTL + padBR;
    const svgWidthMm = (vbW / U) * cellSizeMm;
    const svgHeightMm = (vbH / U) * cellSizeMm;

    const startNumMap = new Map();
    (sourceWords || []).forEach((w) => {
        const pr = w.row - minR;
        const pc = w.col - minC;
        if (pr >= 0 && pr < activeRows && pc >= 0 && pc < activeCols) {
            const key = `${pr},${pc}`;
            if (!startNumMap.has(key)) startNumMap.set(key, w.num);
        }
    });

    const hasCell = (pr, pc) => (
        pr >= 0 &&
        pr < activeRows &&
        pc >= 0 &&
        pc < activeCols &&
        Boolean(sourceGrid[pr + minR]?.[pc + minC])
    );

    const shadowRects = [];
    const fillRects = [];
    const innerPaths = [];
    const outerPaths = [];
    const numTexts = [];
    const answerTexts = [];

    const numPt = Math.max(5.8, Math.min(8.5, cellSizeMm * 0.68));
    const numSizeU = Math.min(28, +(((numPt * 0.352778) / cellSizeMm) * U).toFixed(2));
    const insetX = +(outerStroke * 0.5 + Math.max(7, U * 0.08)).toFixed(2);
    const insetY = +(outerStroke * 0.5 + Math.max(6, U * 0.07)).toFixed(2);
    const numBaselineY = +(insetY + numSizeU * 0.82).toFixed(2);

    const letterSizeU = numSizeU > 25 ? 48 : 54;
    const letterBaselineY = Math.min(80, Math.max(73, +(numBaselineY + 6 + letterSizeU * 0.72).toFixed(2)));

    for (let pr = 0; pr < activeRows; pr++) {
        for (let pc = 0; pc < activeCols; pc++) {
            const ch = sourceGrid[pr + minR]?.[pc + minC];
            if (!ch) continue;

            const x = pc * U;
            const y = pr * U;

            shadowRects.push(
                `<rect x="${(x + shadowOffset).toFixed(2)}" y="${(y + shadowOffset).toFixed(2)}" width="${(U + 0.5).toFixed(2)}" height="${(U + 0.5).toFixed(2)}"/>`
            );
            fillRects.push(
                `<rect x="${x}" y="${y}" width="${U}" height="${U}"/>`
            );

            if (hasCell(pr, pc + 1)) {
                innerPaths.push(`M${(pc + 1) * U} ${y}V${(pr + 1) * U}`);
            }
            if (hasCell(pr + 1, pc)) {
                innerPaths.push(`M${x} ${(pr + 1) * U}H${(pc + 1) * U}`);
            }

            if (!hasCell(pr - 1, pc)) {
                outerPaths.push(`M${x} ${y}H${(pc + 1) * U}`);
            }
            if (!hasCell(pr + 1, pc)) {
                outerPaths.push(`M${x} ${(pr + 1) * U}H${(pc + 1) * U}`);
            }
            if (!hasCell(pr, pc - 1)) {
                outerPaths.push(`M${x} ${y}V${(pr + 1) * U}`);
            }
            if (!hasCell(pr, pc + 1)) {
                outerPaths.push(`M${(pc + 1) * U} ${y}V${(pr + 1) * U}`);
            }

            const num = startNumMap.get(`${pr},${pc}`);
            if (num !== undefined) {
                numTexts.push(
                    `<text x="${(x + insetX).toFixed(2)}" y="${(y + numBaselineY).toFixed(2)}" font-family="Nunito, sans-serif" font-weight="800" font-size="${numSizeU}" fill="#1e293b" text-anchor="start">${num}</text>`
                );
            }

            if (asKey) {
                answerTexts.push(
                    `<text x="${(x + 50).toFixed(2)}" y="${(y + letterBaselineY).toFixed(2)}" font-family="Fredoka, sans-serif" font-weight="700" font-size="${letterSizeU}" fill="#9d174d" text-anchor="middle">${escapeHTML(ch)}</text>`
                );
            }
        }
    }

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'cw-print-svg');
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svgEl.setAttribute('width', `${svgWidthMm.toFixed(2)}mm`);
    svgEl.setAttribute('height', `${svgHeightMm.toFixed(2)}mm`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', 'Crossword puzzle grid');
    svgEl.style.width = `${svgWidthMm.toFixed(2)}mm`;
    svgEl.style.height = `${svgHeightMm.toFixed(2)}mm`;

    const shadowFill = asKey ? '#f5d0de' : '#cbd5e1';
    const cellFill = asKey ? '#fff1f5' : '#ffffff';

    svgEl.innerHTML = [
        `<g transform="translate(${padTL} ${padTL})">`,
        `<g fill="${shadowFill}" shape-rendering="crispEdges">${shadowRects.join('')}</g>`,
        `<g fill="${cellFill}" shape-rendering="crispEdges">${fillRects.join('')}</g>`,
        innerPaths.length
            ? `<path d="${innerPaths.join('')}" fill="none" stroke="#475569" stroke-width="${innerStroke}" stroke-linecap="butt" shape-rendering="crispEdges"/>`
            : '',
        outerPaths.length
            ? `<path d="${outerPaths.join('')}" fill="none" stroke="#0f172a" stroke-width="${outerStroke}" stroke-linecap="square" shape-rendering="crispEdges"/>`
            : '',
        `<g text-rendering="geometricPrecision">${numTexts.join('')}${asKey ? answerTexts.join('') : ''}</g>`,
        '</g>'
    ].join('');

    return { svgEl, svgWidthMm, svgHeightMm };
}

// --- UPDATED: Vector SVG Print Layout ---
function preparePrintVersion(asKey = false) {
    const printContainer = document.getElementById('print-grid-container');
    const printArea = document.getElementById('print-area');
    if (!printContainer || !printArea) return;

    const rawName = (document.getElementById('set-name-input')?.value || '').trim();
    const baseTitle = rawName || 'Crossword Puzzle';
    const headingEl = document.getElementById('print-heading');
    const subEl = document.getElementById('print-subheading');
    const badgeEl = document.getElementById('print-mode-badge');
    const page2TitleEl = printArea.querySelector('.cw-print-page2-title');
    const footerNoteEl = document.getElementById('print-footer-note');
    const footerNoteP1El = document.getElementById('print-footer-note-p1');

    printArea.classList.toggle('print-answer-key', Boolean(asKey));
    if (headingEl) headingEl.textContent = baseTitle;
    if (subEl) {
        subEl.textContent = asKey
            ? 'Teacher Reference Sheet showing the completed grid and word clues.'
            : 'Read the clues below and write one letter in each square.';
    }
    if (badgeEl) {
        badgeEl.hidden = !asKey;
        badgeEl.classList.toggle('hidden', !asKey);
        badgeEl.style.display = asKey ? 'inline-block' : 'none';
    }
    if (page2TitleEl) page2TitleEl.textContent = asKey ? `${baseTitle} — Clues (Key)` : `${baseTitle} — Clues`;

    const acrossWords = (words || []).filter(w => w.dir === 'across').slice().sort((a, b) => a.num - b.num);
    const downWords = (words || []).filter(w => w.dir === 'down').slice().sort((a, b) => a.num - b.num);
    const bounds = getActiveGridBounds(grid);
    const isSeparate = printArea.classList.contains('print-separate-pages');

    const noteText = (bounds && words && words.length)
        ? `${bounds.activeCols}×${bounds.activeRows} Grid · ${words.length} Clue${words.length === 1 ? '' : 's'} · ${acrossWords.length} Across, ${downWords.length} Down`
        : 'Crossword Puzzle';
    if (footerNoteP1El) footerNoteP1El.textContent = isSeparate ? `${noteText} · Page 1 of 2` : noteText;
    if (footerNoteEl) footerNoteEl.textContent = isSeparate ? `${noteText} · Page 2 of 2` : noteText;

    printContainer.innerHTML = '';

    const pa = document.getElementById('print-clues-across');
    const pd = document.getElementById('print-clues-down');
    const acrossIcon = '<svg class="cw-clue-head-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    const downIcon = '<svg class="cw-clue-head-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>';
    pa.innerHTML = `<div class="cw-clue-card-head cw-head-across"><span class="cw-clue-head-label">${acrossIcon}<span>Across</span></span><span class="cw-clue-count">${acrossWords.length}</span></div>`;
    pd.innerHTML = `<div class="cw-clue-card-head cw-head-down"><span class="cw-clue-head-label">${downIcon}<span>Down</span></span><span class="cw-clue-count">${downWords.length}</span></div>`;

    if (!words || !words.length || !bounds) return;

    const estimateColLines = (list) => list.reduce((sum, w) => {
        const extra = asKey ? (w.word.length + 6) : 5;
        return sum + Math.max(1, Math.ceil(((w.clue || '').length + extra) / 42));
    }, 0);
    const maxColLines = Math.max(estimateColLines(acrossWords), estimateColLines(downWords), 2);
    const maxColItems = Math.max(acrossWords.length, downWords.length, 1);

    printArea.classList.remove('cw-clues-compact', 'cw-clues-dense');
    if (!isSeparate) {
        if (maxColLines > 20) printArea.classList.add('cw-clues-dense');
        else if (maxColLines > 13) printArea.classList.add('cw-clues-compact');
    } else if (maxColLines > 36) {
        printArea.classList.add('cw-clues-compact');
    }

    const svgPadMm = 1.8;
    let maxW;
    let maxH;
    let maxCellCap;

    if (isSeparate) {
        maxW = 172;
        maxH = asKey ? 206 : 214;
        maxCellCap = 15.0;
    } else {
        const estClueH = maxColLines > 20
            ? (11 + maxColLines * 3.4 + maxColItems * 0.8)
            : maxColLines > 13
                ? (12 + maxColLines * 3.8 + maxColItems * 1.0)
                : (14 + maxColLines * 4.5 + maxColItems * 1.4);
        const overhead = asKey ? 48 : 43;
        maxW = 170;
        maxH = Math.max(76, Math.min(168, 268 - overhead - estClueH));
        maxCellCap = 12.5;
    }

    const cellSizeMm = Math.max(
        4.8,
        Math.min(maxCellCap, (maxW - svgPadMm) / bounds.activeCols, (maxH - svgPadMm) / bounds.activeRows)
    );

    const { svgEl } = buildPrintCrosswordSVG({
        grid,
        words,
        bounds,
        cellSizeMm,
        asKey: Boolean(asKey)
    });
    printContainer.appendChild(svgEl);

    const makeClueRow = (w) => {
        const div = document.createElement('div');
        div.className = 'print-clue';
        const ansTag = asKey ? `<span class="print-clue-ans">${escapeHTML(w.word)}</span>` : '';
        div.innerHTML = `<span class="print-clue-num">${w.num}.</span><span class="print-clue-body"><span class="print-clue-text">${escapeHTML(w.clue)}</span><span class="print-clue-len">(${w.word.length})</span>${ansTag}</span>`;
        return div;
    };

    acrossWords.forEach(w => pa.appendChild(makeClueRow(w)));
    downWords.forEach(w => pd.appendChild(makeClueRow(w)));
}

// ==================== BROADCAST CHANNEL (Student View) ====================
const BROADCAST_CHANNEL = 'crossword-sync';
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

let _bcThrottle = null, _bcLastTime = 0, _bcPuzzleId = null;

function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;
    const now = performance.now();
    const minInterval = options.immediate ? 0 : 100;
    if (_bcThrottle) clearTimeout(_bcThrottle);
    const go = () => { _bcLastTime = performance.now(); _performBroadcast(); };
    if (now - _bcLastTime >= minInterval) go();
    else _bcThrottle = setTimeout(go, minInterval - (now - _bcLastTime));
}

function _performBroadcast() {
    // Snapshot all cell values + locked states
    const cellStates = [];
    document.querySelectorAll('.cw-cell.filled').forEach(cell => {
        const inp = cell.querySelector('input');
        if (!inp) return;
        cellStates.push({
            r: cell.dataset.r,
            c: cell.dataset.c,
            value: inp.value,
            locked: cell.classList.contains('locked'),
        });
    });

    // Only send the full puzzle object when it has changed — prevents the student
    // from calling render() (full DOM rebuild) on every keystroke.
    const currentPuzzleId = puzzle ? `${puzzle.rows}x${puzzle.cols}:${puzzle.words?.length}` : null;
    const puzzleChanged = currentPuzzleId !== _bcPuzzleId;
    if (puzzleChanged) _bcPuzzleId = currentPuzzleId;

    bc.postMessage({
        type: 'state-update',
        puzzle: puzzleChanged ? puzzle : undefined,
        GRID_ROWS,
        GRID_COLS,
        CELL_SIZE,
        cellStates,
    });
}

function broadcastFullState() { _bcPuzzleId = null; broadcastState({ immediate: true }); }

if (bc && IS_PLAYER_WINDOW) {
    bc.onmessage = ({ data }) => {
        if (data.type !== 'state-update') return;
        if (window._playerRetryInterval) { clearInterval(window._playerRetryInterval); window._playerRetryInterval = null; }
        window._playerLoadingEl?.remove(); window._playerLoadingEl = null;

        if (data.puzzle) {
            puzzle = data.puzzle;
            grid = puzzle.grid;
            words = puzzle.words;
            GRID_ROWS = data.GRID_ROWS || puzzle.rows || GRID_ROWS;
            GRID_COLS = data.GRID_COLS || puzzle.cols || GRID_COLS;
            CELL_SIZE = data.CELL_SIZE || CELL_SIZE;
            render();
        }
        // Apply cell values + locked state
        data.cellStates?.forEach(cs => {
            const cell = document.querySelector(`.cw-cell[data-r="${cs.r}"][data-c="${cs.c}"]`);
            if (!cell) return;
            const inp = cell.querySelector('input');
            if (inp) inp.value = cs.value;
            if (cs.locked) {
                cell.classList.add('locked');
            } else {
                cell.classList.remove('locked');
            }
        });

        // Mark clue items solved based on whether all their cells are locked,
        // since the student window never runs checkCurrentWordCompletion.
        if (words.length > 0) {
            words.forEach(w => {
                const allLocked = Array.from({ length: w.word.length }, (_, i) => {
                    const r = w.dir === 'across' ? w.row : w.row + i;
                    const c = w.dir === 'across' ? w.col + i : w.col;
                    return document.querySelector(`.cw-cell[data-r="${r}"][data-c="${c}"]`)?.classList.contains('locked');
                }).every(Boolean);
                const clueEl = document.getElementById(`clue-${w.num}-${w.dir}`);
                if (clueEl) clueEl.classList.toggle('solved', allLocked);
            });
        }

        const sd = document.getElementById('student-round-display');
        if (sd) {
            const total = words.length;
            const solved = document.querySelectorAll('.clue-item.solved').length;
            sd.textContent = puzzle ? `${solved} / ${total} words` : 'Waiting...';
        }
    };
}

function dedupeWords() {
    const rawLines = els.input.value.split('\n');
    const seen = new Set();
    const kept = [];
    let removed = 0;

    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const colonIdx = trimmed.indexOf(':');
        const keySource = colonIdx !== -1 ? trimmed.slice(0, colonIdx) : trimmed;
        const key = keySource.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (!key) {
            kept.push(line);
            return;
        }
        if (seen.has(key)) {
            removed++;
            return;
        }
        seen.add(key);
        kept.push(trimmed);
    });

    if (removed > 0) {
        els.input.value = kept.join('\n');
        saveGameState();
        showBuildFeedback(`Removed ${removed} duplicate word${removed === 1 ? '' : 's'}.`, 'success');
        Sound.click();
    } else {
        showBuildFeedback('No duplicate words found.', 'warn');
        Sound.click();
    }
}

function clearBoardLetters() {
    if (!puzzle || words.length === 0) {
        Sound.error();
        return;
    }
    document.querySelectorAll('.cw-cell').forEach(cell => {
        cell.classList.remove('locked', 'error', 'cell-focused', 'word-highlight');
        const inp = cell.querySelector('input');
        if (inp) inp.value = '';
    });
    document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('solved', 'active'));
    currentFocus = { r: -1, c: -1 };
    Sound.back();
    broadcastFullState();
}

function buildPuzzleFromInput({ autoCloseMobile = true, celebrate = true } = {}) {
    showBuildFeedback('');
    const rawLines = els.input.value.split('\n').filter(l => l.includes(':'));
    const inputData = rawLines.map(l => {
        const colonIdx = l.indexOf(':');
        const w = colonIdx >= 0 ? l.slice(0, colonIdx) : '';
        const c = colonIdx >= 0 ? l.slice(colonIdx + 1) : '';
        return {
            word: w.trim().toUpperCase().replace(/[^A-Z]/g, ''),
            clue: c.trim()
        };
    }).filter(item => item.word.length >= 2 && item.clue.length > 0)
      .sort((a, b) => b.word.length - a.word.length);

    if (inputData.length < 2) {
        showBuildFeedback('Add at least 2 valid "WORD : CLUE" lines (2+ letters each).', 'error');
        Sound.error();
        const btn = document.getElementById('generate-btn');
        if (btn) {
            btn.classList.add('bg-pink', 'animate-shake');
            setTimeout(() => btn.classList.remove('bg-pink', 'animate-shake'), 400);
        }
        return false;
    }

    if (generateLayout(inputData)) {
        if (words.length < inputData.length) {
            showBuildFeedback(`Placed ${words.length} of ${inputData.length} words (others could not intersect).`, 'warn');
        } else {
            showBuildFeedback(`Puzzle built with all ${words.length} words!`, 'success');
            buildFeedbackTimer = setTimeout(() => showBuildFeedback(''), 3000);
        }
        if (autoCloseMobile && window.innerWidth < 768) toggleControlPanel(true);
        if (celebrate && typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#1ea7fd', '#ff4785'] });
        }
        broadcastFullState();
        return true;
    } else {
        showBuildFeedback('Could not generate a puzzle from these words.', 'error');
        Sound.error();
        const btn = document.getElementById('generate-btn');
        if (btn) {
            btn.classList.add('bg-pink', 'animate-shake');
            setTimeout(() => btn.classList.remove('bg-pink', 'animate-shake'), 400);
        }
        return false;
    }
}

function showCwToast(message, type = 'info') {
    let container = document.getElementById('cw-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cw-toast-container';
        container.className = 'no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-[700] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    const bgMap = {
        success: 'bg-green text-dark',
        warning: 'bg-orange text-dark',
        info: 'bg-dark text-white',
    };
    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-2xl border-2 border-dark dark:border-slate-500 shadow-hard font-heading text-xs uppercase tracking-wide flex items-center gap-2 ${bgMap[type] || bgMap.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 220);
    }, 2200);
}

function parseCrosswordImport(rawText) {
    const validLevels = new Set(['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2']);
    const blocks = window.KlassKitBulkImport.splitImportBlocks(rawText);
    const items = [];
    const warnings = [];
    const badges = [];

    blocks.forEach((block, blockIdx) => {
        const setNum = blockIdx + 1;
        let level = '';
        const entries = [];
        const seen = new Set();

        for (const rawLine of block.lines) {
            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('@') && !/\s/.test(trimmed.slice(1).trim())) {
                const lvl = trimmed.slice(1).trim().toUpperCase();
                if (validLevels.has(lvl)) {
                    level = lvl;
                } else {
                    warnings.push(`Set ${setNum}: Unknown level "${trimmed}" — ignored.`);
                }
                continue;
            }

            // Tolerate optional list bullet (- , * , 1. ) only before a WORD : Clue pair
            const cleanedLine = trimmed.replace(/^(?:[-*•]|\d+[.)])\s+(?=[^:=|]+[:=|])/, '');
            const pairMatch = cleanedLine.match(/^([^:=|]+?)\s*[:=|]\s*(.*)$/);
            if (!pairMatch) {
                warnings.push(`Set ${setNum}: Line "${trimmed.slice(0, 32)}" missing ": Clue" separator — skipped.`);
                continue;
            }

            const rawWord = pairMatch[1].trim();
            const word = rawWord.toUpperCase().replace(/[^A-Z]/g, '');
            const clue = pairMatch[2].trim();

            if (word.length < 2) {
                warnings.push(`Set ${setNum}: "${rawWord}" skipped (words need at least 2 A–Z letters).`);
                continue;
            }
            if (!clue) {
                warnings.push(`Set ${setNum}: "${word}" skipped (missing clue).`);
                continue;
            }
            if (seen.has(word)) {
                warnings.push(`Set ${setNum}: Duplicate word "${word}" skipped.`);
                continue;
            }
            if (word.length > 22) {
                warnings.push(`Set ${setNum}: "${word}" is ${word.length} letters long and may not fit cleanly.`);
            }

            seen.add(word);
            entries.push({ word, clue });
        }

        if (entries.length < 2) {
            if (entries.length > 0 || block.hasExplicitTitle) {
                warnings.push(`Set ${setNum}${block.title ? ` ("${block.title}")` : ''}: Needs at least 2 valid WORD : Clue pairs (found ${entries.length}).`);
            }
            return;
        }

        const cleanTitle = block.title || `Imported Crossword ${items.length + 1}`;
        const formatted = entries.map(e => `${e.word} : ${e.clue}`).join('\n');
        items.push({ title: cleanTitle, level, entries, content: formatted });
        badges.push({
            tag: level || 'CROSSWORD',
            label: cleanTitle,
            meta: `${entries.length} words`,
            tone: window.KlassKitBulkImport.LEVEL_TONES[level] || 'green',
            title: `${cleanTitle}: ${entries.map(e => e.word).join(', ')}`,
        });
    });

    return { items, warnings, badges };
}

function initCrosswordImportAndPresets() {
    if (IS_PLAYER_WINDOW || !window.KlassKitBulkImport) return;

    const CW_TEMPLATE = `// ============================================================
//  KLASSKIT CROSSWORD BULK IMPORT TEMPLATE
//  Lines starting with // or single # are ignored comments.
// ============================================================
//
// Format per word set (separate multiple sets with ## Title or ---):
// ## Set Title
// @A1   (optional CEFR badge: A1, A2, B1, B1+, B2, C1, C2)
// WORD : Short, clear clue for students
// (Also accepts = or | instead of : , letters A-Z only, min 2 letters)

## Classroom Objects
@A1
TEACHER : The person who helps students learn
PENCIL : Wooden tool used for writing
ERASER : Removes pencil marks from paper
NOTEBOOK : Book with lined pages for writing notes
RULER : Tool used to measure or draw straight lines
BACKPACK : Bag carried on your shoulders to school

---

## Weather & Sky
@A2
RAINBOW : Colorful arc in the sky after rain
CLOUD : White or gray mass floating high in the sky
BREEZE : A gentle, pleasant wind
THUNDER : Loud rumbling sound during a storm
SUNSHINE : Warm bright light coming from the sun`;

    const importModal = window.KlassKitBulkImport.create({
        id: 'cw-import-overlay',
        title: 'Bulk Import Word Sets',
        subtitle: 'Copy AI template or paste WORD : Clue lists',
        accentColor: 'blue',
        unitLabel: 'word set',
        unitLabelPlural: 'word sets',
        guideItems: [
            { label: 'Set Title', syntax: '## My Word Set', color: 'orange', desc: 'Optional name; starts a new word set (or divide with ---).' },
            { label: 'Word & Clue', syntax: 'WORD : Clue', color: 'blue', desc: 'One pair per line (also accepts = or |).' },
            { label: 'Level Tag', syntax: '@A1 … @B2', color: 'green', desc: 'Optional CEFR badge shown in the preview bar.' },
        ],
        tips: [
            '<strong>Tips:</strong> Use at least <b>2 words</b> per set; letters A–Z only.',
            '<strong>Comments:</strong> Lines starting with <code>//</code> or single <code>#</code> are ignored.',
        ],
        placeholder: `## Animals\n@A1\nELEPHANT : Large gray animal with a trunk\nGIRAFFE : Tall animal with a very long neck\nMONKEY : Playful animal that climbs trees`,
        template: CW_TEMPLATE,
        sample: `## Kitchen & Cooking\n@A2\nTOMATO : Red juicy fruit used in pasta sauce\nCHEESE : Dairy food melted on pizza\nSPOON : Round utensil used for eating soup\nOVEN : Appliance used for baking bread\nRECIPE : Step-by-step instructions for cooking a meal\nGARLIC : Flavorful bulb used to season dishes`,
        options: [
            { id: 'saveToSets', label: 'Save imported list(s) to Saved Word Sets', defaultChecked: true },
        ],
        parse: parseCrosswordImport,
        onCopyTemplate: () => {
            Sound.click();
            showCwToast('Template copied — paste into any AI or editor!', 'success');
        },
        onImport: async (result, opts) => {
            const items = result.items || [];
            if (!items.length) return false;

            if (opts.saveToSets || items.length > 1) {
                for (const item of items) {
                    const label = item.level ? `[${item.level}] ${item.title}` : item.title;
                    await saveWordSet(label, item.content);
                }
                await renderWordSets();
            }

            const first = items[0];
            els.input.value = first.content;
            const setNameEl = document.getElementById('set-name-input');
            if (setNameEl && first.title) setNameEl.value = first.title;
            await saveGameState();
            buildPuzzleFromInput({ autoCloseMobile: false, celebrate: true });

            if (items.length === 1) {
                showCwToast(`Imported "${first.title}" (${first.entries.length} words)`, 'success');
            } else {
                showCwToast(`Imported ${items.length} sets & built "${first.title}"!`, 'success');
            }
            return true;
        },
    });

    document.getElementById('open-import-btn')?.addEventListener('click', () => {
        Sound.click();
        importModal.open();
    });

    window.KlassKitBulkImport.mountPresets({
        container: '#crossword-presets-slot',
        url: 'presets.json',
        collapsible: false,
        maxHeightClass: 'max-h-52',
        getMeta: (p) => ({ icon: 'hash', label: `${(p.items || []).length}w` }),
        onSelect: async (preset) => {
            const lines = (preset.items || []).map(it => `${it.word} : ${it.clue}`).join('\n');
            if (!lines) return;
            activeWordSetId = null;
            els.input.value = lines;
            const setNameEl = document.getElementById('set-name-input');
            if (setNameEl) setNameEl.value = preset.title || '';
            await saveGameState();
            await renderWordSets();
            Sound.click();
            buildPuzzleFromInput({ autoCloseMobile: false, celebrate: false });
            showCwToast(`Loaded "${preset.title}" (${preset.level})`, 'success');
        },
    });
}

// --- INIT & EVENTS ---
document.getElementById('dedupe-btn')?.addEventListener('click', dedupeWords);

document.getElementById('generate-btn').onclick = () => buildPuzzleFromInput();

document.getElementById('solution-btn').onclick = () => {
    if (!puzzle || words.length === 0) {
        Sound.error();
        return;
    }
    document.querySelectorAll('.cw-cell input').forEach(inp => {
        const r = inp.dataset.r; const c = inp.dataset.c;
        inp.value = grid[r][c]; inp.parentElement.classList.add('locked');
    });
    document.querySelectorAll('.clue-item').forEach(el => el.classList.add('solved'));
    Sound.success();
    broadcastFullState();
};

document.getElementById('clear-grid-btn')?.addEventListener('click', clearBoardLetters);

document.getElementById('zoom-in').onclick = () => { CELL_SIZE = Math.min(CELL_SIZE + 5, 80); updateGridSize(); };
document.getElementById('zoom-out').onclick = () => { CELL_SIZE = Math.max(CELL_SIZE - 5, 25); updateGridSize(); };

window.addEventListener('resize', autoFitGrid);

els.input.addEventListener('input', () => saveGameState());

document.getElementById('sets-sort')?.addEventListener('change', renderWordSets);

document.getElementById('new-set-btn')?.addEventListener('click', async () => {
    activeWordSetId = null;
    const nameInput = document.getElementById('set-name-input');
    if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
    }
    await saveGameState();
    await renderWordSets();
    Sound.click();
    if (typeof showCwToast === 'function') showCwToast('Detached — type a name and click SAVE for a new set', 'info');
});

document.getElementById('set-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('save-set-btn')?.click();
    }
});

document.getElementById('save-set-btn').onclick = async () => {
    const nameInput = document.getElementById('set-name-input');
    const name = nameInput.value.trim();
    const content = els.input.value.trim();
    if (!name) { nameInput.focus(); Sound.error(); return; }
    if (!content) { els.input.focus(); Sound.error(); return; }
    const res = await saveWordSet(name, content, { activate: true, updateActive: true });
    nameInput.value = name;
    Sound.success();
    await renderWordSets();
    if (typeof showCwToast === 'function' && res) {
        showCwToast(res.updated ? `Updated "${name}"!` : `Saved "${name}"!`, 'success');
    }
};

window.onload = async () => {
    initTheme();
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) soundBtn.onclick = () => Sound.toggleMute();
    updateSoundToggleUI();

    if (IS_PLAYER_WINDOW) {
        document.documentElement.classList.add('player-mode');
        document.title = 'Student View | Crossword';
        document.getElementById('controls')?.style.setProperty('display', 'none');
        document.getElementById('btn-open-player')?.style.setProperty('display', 'none');
        document.getElementById('solution-btn')?.style.setProperty('display', 'none');
        document.getElementById('clear-grid-btn')?.style.setProperty('display', 'none');
        document.getElementById('sound-toggle')?.style.setProperty('display', 'none');
        document.getElementById('generate-btn')?.style.setProperty('display', 'none');
        document.getElementById('player-toolbar')?.classList.remove('hidden');
        lucide.createIcons();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 dark:bg-slate-800/95 border-2 border-dark dark:border-slate-500 rounded-full shadow-hard-sm backdrop-blur-sm';
        loadingEl.innerHTML = `<svg class="w-4 h-4 animate-spin text-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg><span class="font-bold text-xs text-slate-600 dark:text-slate-200 uppercase tracking-widest">Connecting...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping(); window._playerRetryInterval = setInterval(ping, 2000);
        return;
    }

    await requireAuth();
    await loadGameState();
    await loadFromCloud();
    await renderWordSets();
    if (activeWordSetId !== null && activeWordSetId !== undefined) {
        const sets = await getAllWordSets();
        const activeSet = sets.find(s => String(s.id) === String(activeWordSetId));
        const nameInput = document.getElementById('set-name-input');
        if (nameInput && activeSet) nameInput.value = activeSet.name || '';
    }
    initCrosswordImportAndPresets();
    if (window.innerWidth < 768) toggleControlPanel(true);

    if (bc) {
        bc.onmessage = (evt) => { if (evt.data?.type === 'player-ready') broadcastFullState(); };
    }
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'crossword-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
};

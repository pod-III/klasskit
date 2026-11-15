lucide.createIcons();
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

    const savedPuzzle = await getFromDB('puzzle_data');
    if (savedPuzzle) {
        puzzle = savedPuzzle;
        grid = puzzle.grid;
        words = puzzle.words;
        render();
    }
}

// --- WORD SETS (IndexedDB) ---
async function saveWordSet(name, content) {
    try {
        const db = await initDB();
        const tx = db.transaction(SETS_STORE, 'readwrite');
        const store = tx.objectStore(SETS_STORE);
        store.put({ name, content, createdAt: Date.now() });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => { syncToCloud(); resolve(); };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('Save word set error:', err);
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
                const item = { name: set.name, content: set.content, createdAt: set.createdAt || Date.now() };
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

async function renderWordSets() {
    const list = document.getElementById('sets-list');
    if (!list) return;
    const sets = await getAllWordSets();
    
    if (sets.length === 0) {
        list.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-xs italic">No saved sets yet.</p>';
        return;
    }
    
    list.innerHTML = '';
    sets.forEach(set => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-lg group hover:border-blue/40 transition-all';
        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-dark dark:text-slate-100 truncate">${set.name}</p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${set.content.split('\n').filter(l => l.trim()).length} words</p>
            </div>
            <button class="set-load-btn p-1.5 bg-blue/10 dark:bg-blue/20 text-blue rounded-md border border-blue/20 hover:bg-blue hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Load Set" data-id="${set.id}">
                <i data-lucide="upload" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
            <button class="set-delete-btn p-1.5 bg-pink/10 dark:bg-pink/20 text-pink rounded-md border border-pink/20 hover:bg-pink hover:text-white hover:translate-y-[-1px] active:translate-y-[2px] transition-all" title="Delete Set" data-id="${set.id}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
        `;

        // Load button
        item.querySelector('.set-load-btn').addEventListener('click', async () => {
            els.input.value = set.content;
            saveGameState();
            Sound.click();
        });

        // Delete button
        item.querySelector('.set-delete-btn').addEventListener('click', async () => {
            await deleteWordSet(set.id);
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
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    if (savedTheme === 'dark') {
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

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playTone = (freq, type, duration) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
};
const Sound = {
    type: () => playTone(800, 'sine', 0.05),
    back: () => playTone(600, 'sine', 0.05),
    click: () => playTone(400, 'triangle', 0.05),
    success: () => { playTone(500, 'sine', 0.1); setTimeout(() => playTone(1000, 'sine', 0.2), 100); },
    error: () => playTone(150, 'sawtooth', 0.2)
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
        
        // Place first word centered
        const first = wordsToPlace[0];
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

        const remaining = wordsToPlace.slice(1);
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
                if (targetGrid[r][c - 1] !== null && targetGrid[r][c + 1] !== null) return false;
            }
            if (dir === 'down') {
                if (targetGrid[r - 1][c] !== null && targetGrid[r + 1][c] !== null) return false;
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
            li.innerHTML = `<span class="font-bold text-blue mr-2">${w.num}.</span> ${w.clue}`;
            li.onclick = () => selectWordByClue(w);
            els.across.appendChild(li);
        });
        words.filter(w => w.dir === 'down').forEach(w => {
            const li = document.createElement('div');
            li.className = 'clue-item';
            li.id = `clue-${w.num}-down`;
            li.innerHTML = `<span class="font-bold text-pink mr-2">${w.num}.</span> ${w.clue}`;
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
window.setPrintMode = function(mode) {
    const printArea = document.getElementById('print-area');
    if (mode === 'separate') {
        printArea.classList.add('print-separate-pages');
    } else {
        printArea.classList.remove('print-separate-pages');
    }
    window.print();
};

// --- UPDATED: Dynamic Sizing ---
function preparePrintVersion() {
    const printContainer = document.getElementById('print-grid-container');
    const printArea = document.getElementById('print-area');
    if (!printContainer) return;
    printContainer.innerHTML = '';
    
    const printGrid = els.grid.cloneNode(true);
    printGrid.id = "print-grid-clone";
    printGrid.className = "print-grid";
    
    const isSeparate = printArea.classList.contains('print-separate-pages');
    
    // Use 230mm height if on its own page, otherwise limit to 140mm for combined mode
    const maxW = 170;
    const maxH = isSeparate ? 230 : 140; 
    const cellSize = Math.min(maxW / GRID_COLS, maxH / GRID_ROWS);
    
    printGrid.style.gridTemplateColumns = `repeat(${GRID_COLS}, 1fr)`;
    printGrid.style.gridTemplateRows = `repeat(${GRID_ROWS}, 1fr)`;
    
    // Explicitly set the total grid dimensions
    printGrid.style.width = `${cellSize * GRID_COLS}mm`;
    printGrid.style.height = `${cellSize * GRID_ROWS}mm`;

    printGrid.querySelectorAll('.cw-cell').forEach(cell => {
        cell.classList.remove('cell-focused', 'word-highlight', 'locked', 'error');
        cell.style.width = ''; 
        cell.style.height = '';
        const input = cell.querySelector('input');
        if (input) input.value = '';
    });

    printContainer.appendChild(printGrid);
    
    const pa = document.getElementById('print-clues-across');
    const pd = document.getElementById('print-clues-down');
    pa.innerHTML = '<h3 class="font-bold border-b border-black mb-2 uppercase">Across</h3>';
    pd.innerHTML = '<h3 class="font-bold border-b border-black mb-2 uppercase">Down</h3>';
    
    words.forEach(w => {
        const div = document.createElement('div'); 
        div.className = 'print-clue'; 
        div.innerHTML = `<strong>${w.num}.</strong> ${w.clue}`;
        if (w.dir === 'across') pa.appendChild(div); 
        else pd.appendChild(div);
    });
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

function buildPuzzleFromInput({ autoCloseMobile = true, celebrate = true } = {}) {
    const lines = els.input.value.split('\n').filter(l => l.includes(':'));
    const inputData = lines.map(l => {
        const idx = l.indexOf(':');
        const w = idx >= 0 ? l.slice(0, idx) : '';
        const c = idx >= 0 ? l.slice(idx + 1) : '';
        return { word: w.trim().toUpperCase().replace(/[^A-Z]/g, ''), clue: c.trim() };
    }).filter(item => item.word.length >= 2 && item.clue.length > 0)
      .sort((a, b) => b.word.length - a.word.length);

    if (inputData.length < 2) {
        Sound.error();
        const btn = document.getElementById('generate-btn');
        if (btn) {
            btn.classList.add('bg-pink', 'animate-shake');
            setTimeout(() => btn.classList.remove('bg-pink', 'animate-shake'), 400);
        }
        return false;
    }

    if (generateLayout(inputData)) {
        if (autoCloseMobile && window.innerWidth < 768) toggleControlPanel(true);
        if (celebrate && typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#2979FF', '#FF6B95'] });
        }
        broadcastFullState();
        return true;
    } else {
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
    toast.className = `px-4 py-2.5 rounded-2xl border-2 border-dark shadow-hard font-heading text-xs uppercase tracking-wide flex items-center gap-2 ${bgMap[type] || bgMap.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 220);
    }, 2200);
}

// --- INIT & EVENTS ---
document.getElementById('generate-btn').onclick = () => buildPuzzleFromInput();

document.getElementById('solution-btn').onclick = () => {
    document.querySelectorAll('.cw-cell input').forEach(inp => {
        const r = inp.dataset.r; const c = inp.dataset.c;
        inp.value = grid[r][c]; inp.parentElement.classList.add('locked');
    });
    document.querySelectorAll('.clue-item').forEach(el => el.classList.add('solved'));
    Sound.success();
    broadcastFullState();
};

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
            els.input.value = lines;
            const setNameEl = document.getElementById('set-name-input');
            if (setNameEl) setNameEl.value = preset.title || '';
            await saveGameState();
            Sound.click();
            buildPuzzleFromInput({ autoCloseMobile: false, celebrate: false });
            showCwToast(`Loaded "${preset.title}" (${preset.level})`, 'success');
        },
    });
}

document.querySelectorAll('.grid-btn').forEach(b => {
    b.onclick = (e) => {
        document.querySelectorAll('.grid-btn').forEach(btn => {
            btn.classList.remove('bg-blue', 'text-white', 'shadow-neo-sm');
            btn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-500');
        });
        e.target.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-500');
        e.target.classList.add('bg-blue', 'text-white', 'shadow-neo-sm');
        GRID_SIZE = parseInt(e.target.dataset.size);
        saveGameState();
    }
});

document.getElementById('zoom-in').onclick = () => { CELL_SIZE = Math.min(CELL_SIZE + 5, 80); updateGridSize(); };
document.getElementById('zoom-out').onclick = () => { CELL_SIZE = Math.max(CELL_SIZE - 5, 25); updateGridSize(); };

window.addEventListener('resize', autoFitGrid);

els.input.addEventListener('input', () => saveGameState());

document.getElementById('save-set-btn').onclick = async () => {
    const nameInput = document.getElementById('set-name-input');
    const name = nameInput.value.trim();
    const content = els.input.value.trim();
    if (!name) { nameInput.focus(); Sound.error(); return; }
    if (!content) { els.input.focus(); Sound.error(); return; }
    await saveWordSet(name, content);
    nameInput.value = '';
    Sound.success();
    renderWordSets();
};

window.onload = async () => {
    if (IS_PLAYER_WINDOW) {
        document.documentElement.classList.add('player-mode');
        document.title = 'Student View | Crossword';
        document.getElementById('controls')?.style.setProperty('display', 'none');
        document.getElementById('btn-open-player')?.style.setProperty('display', 'none');
        document.getElementById('solution-btn')?.style.setProperty('display', 'none');
        document.getElementById('generate-btn')?.style.setProperty('display', 'none');
        document.getElementById('player-toolbar')?.classList.remove('hidden');
        lucide.createIcons();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 border-2 border-dark rounded-full shadow-neo backdrop-blur-sm';
        loadingEl.innerHTML = `<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg><span class="font-bold text-xs text-slate-500 uppercase tracking-widest">Connecting...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping(); window._playerRetryInterval = setInterval(ping, 2000);
        return;
    }

    await requireAuth();
    initTheme();
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;
    await loadGameState();
    await loadFromCloud();
    await renderWordSets();
    initCrosswordImportAndPresets();
    if (window.innerWidth < 768) toggleControlPanel(true);

    if (bc) {
        bc.onmessage = (evt) => { if (evt.data?.type === 'player-ready') broadcastFullState(); };
    }
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(location.pathname + '?player=1', 'crossword-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
    });
};

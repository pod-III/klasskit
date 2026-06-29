/**
 * WORD SORT - Game Logic
 * KlassKit - Interactive ELT Tools
 */

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================

const DB_NAME = "WordSortDB";
const DB_VERSION = 1;
let dataBase = null;

let categories = [];
let words = []; // { text, category, id, placed, currentZone }
let gameActive = false;
let instantCheck = true;
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };
let dragStartRect = null;

// Color schemes for categories (standard KlassKit palette)
const categoryColors = [
    { bg: "bg-pink/20", border: "border-pink", text: "text-pink", icon: "heart" },
    { bg: "bg-blue/20", border: "border-blue", text: "text-blue", icon: "star" },
    { bg: "bg-green/20", border: "border-green", text: "text-green", icon: "leaf" },
    { bg: "bg-orange/20", border: "border-orange", text: "text-orange", icon: "sun" },
    { bg: "bg-purple-500/20", border: "border-purple-500", text: "text-purple-500", icon: "moon" },
    { bg: "bg-yellow-500/20", border: "border-yellow-500", text: "text-yellow-500", icon: "zap" },
];

const wordColors = [
    "bg-pink",
    "bg-blue",
    "bg-green",
    "bg-orange",
    "bg-purple-500",
    "bg-yellow-500",
];

// ==========================================
// 2. DATABASE (IndexedDB)
// ==========================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dataBase = request.result;
            resolve();
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains("presets")) {
                const store = database.createObjectStore("presets", { keyPath: "id", autoIncrement: true });
                store.createIndex("name", "name", { unique: false });
            }
        };
    });
}

async function savePreset() {
    const name = document.getElementById("preset-name").value.trim();
    if (!name) return showToast("Enter a preset name", "warning");
    if (categories.length === 0) return showToast("Add categories first", "warning");

    const data = {
        name,
        categories: categories.map((c) => c.name),
        words: words,
        batchInput: document.getElementById("batch-input").value,
        updatedAt: Date.now(),
    };

    try {
        const tx = dataBase.transaction("presets", "readwrite");
        const store = tx.objectStore("presets");
        await new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        showToast("Preset saved!", "success");
        document.getElementById("preset-name").value = "";
        await loadPresets();
        syncToCloud();
    } catch (e) {
        showToast("Failed to save", "error");
    }
}

async function loadPresets() {
    try {
        const tx = dataBase.transaction("presets", "readonly");
        const store = tx.objectStore("presets");
        const presets = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result.reverse());
            request.onerror = () => reject(request.error);
        });

        const select = document.getElementById("preset-select");
        select.innerHTML = '<option value="">-- Select Preset --</option>';
        presets.forEach((p) => {
            const option = document.createElement("option");
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Failed to load presets", e);
    }
}

async function loadPreset() {
    const id = parseInt(document.getElementById("preset-select").value);
    if (!id) return;

    try {
        const tx = dataBase.transaction("presets", "readonly");
        const store = tx.objectStore("presets");
        const preset = await new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (preset) {
            categories = [];
            words = [];

            preset.categories.forEach((name, idx) => {
                categories.push({
                    id: Date.now() + idx,
                    name,
                    color: categoryColors[idx % 6],
                    words: [],
                });
            });

            if (preset.words && preset.words.length > 0) {
                words = preset.words.map((w, i) => ({
                    ...w,
                    id: `word-${Date.now()}-${i}`,
                    placed: false,
                    currentZone: null,
                }));
            }

            if (preset.batchInput) {
                document.getElementById("batch-input").value = preset.batchInput;
            }

            renderCategories();
            updateCategoryCount();
            document.getElementById("pool-count").textContent = `${words.length} words`;
            showToast(`Loaded "${preset.name}"`, "success");

            // Set status to READY but don't start yet
            document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-blue">READY</span>';
            updateStartButtonVisibility();
        }
    } catch (e) {
        showToast("Failed to load preset", "error");
    }
}

// --- CLOUD PERSISTENCE ---
let syncTimeout = null;
async function syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        if (!dataBase) return;
        const tx = dataBase.transaction("presets", "readonly");
        const store = tx.objectStore("presets");
        const presets = await new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
        });
        await saveProgress('word_sort', { presets });
    }, 2000);
}

async function loadFromCloud() {
    const cloudData = await loadProgress('word_sort');
    if (cloudData && cloudData.presets) {
        for (const p of cloudData.presets) {
            const tx = dataBase.transaction("presets", "readwrite");
            const store = tx.objectStore("presets");
            const existing = await new Promise(r => {
                const req = store.index("name").get(p.name);
                req.onsuccess = () => r(req.result);
            });
            if (!existing) {
                delete p.id;
                store.add(p);
            }
        }
        await loadPresets();
    }
}

// ==========================================
// 3. CORE INITIALIZATION
// ==========================================

async function init() {
    await requireAuth();
    await initDB();
    loadTheme();
    await loadFromCloud();
    await loadPresets();
    lucide.createIcons();

    // Setup drag handlers
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);

    // Responsive panel
    if (window.innerWidth < 768) toggleControlPanel(true);
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
        html.classList.remove("dark");
        localStorage.setItem("theme_word-sort", "light");
    } else {
        html.classList.add("dark");
        localStorage.setItem("theme_word-sort", "dark");
    }
    lucide.createIcons();
}

function loadTheme() {
    const saved = localStorage.getItem("theme_word-sort") || "light";
    if (saved === "dark") document.documentElement.classList.add("dark");
}

function autoSave() {
    const indicator = document.getElementById("save-indicator");
    if (!indicator) return;
    indicator.style.opacity = "1";
    setTimeout(() => {
        indicator.style.opacity = "0";
    }, 2000);
}

// ==========================================
// 4. UI COMPONENTS & HELPERS
// ==========================================

function toggleControlPanel(forceHide) {
    const controls = document.getElementById("controls");
    const isMobile = window.innerWidth < 768;

    if (forceHide) {
        controls.classList.add(isMobile ? "hidden-panel-mobile" : "hidden-panel-desktop");
    } else {
        controls.classList.toggle(isMobile ? "hidden-panel-mobile" : "hidden-panel-desktop");
    }
}

function showToast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");

    const colors = {
        success: "bg-green text-dark border-green",
        error: "bg-pink text-white border-pink",
        info: "bg-blue text-white border-blue",
        warning: "bg-orange text-dark border-orange",
    };

    const icons = {
        success: "check-circle",
        error: "x-circle",
        info: "info",
        warning: "alert-triangle",
    };

    toast.className = `${colors[type]} px-4 py-3 rounded-xl shadow-hard border-2 font-bold text-sm flex items-center gap-2 pointer-events-auto transform transition-all duration-300 translate-y-[-20px] opacity-0`;
    toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4"></i> ${message}`;

    container.appendChild(toast);
    lucide.createIcons();

    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-[-20px]", "opacity-0");
    });

    setTimeout(() => {
        toast.classList.add("translate-y-[-20px]", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function celebrate() {
    const colors = ["#ff4785", "#1ea7fd", "#00d063", "#ff7e33", "#a855f7", "#eab308"];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement("div");
        confetti.className = "confetti";
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + "vw";
        confetti.style.animation = `confetti-fall ${2 + Math.random() * 2}s linear forwards`;
        confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function cleanupOrphanedChips() {
    // Remove any word-chip elements that are direct children of body (stuck proxies)
    const orphaned = document.querySelectorAll("body > .word-chip");
    orphaned.forEach((chip) => chip.remove());
}

function updateStartButtonVisibility() {
    const btn = document.getElementById("startGameBtn");
    if (!btn) return;

    if (!gameActive && categories.length > 0 && words.length > 0) {
        btn.classList.remove("hidden");
        btn.classList.add("flex");
    } else {
        btn.classList.add("hidden");
        btn.classList.remove("flex");
    }
}

// ==========================================
// 5. GAME LOGIC
// ==========================================

function startGame() {
    if (categories.length === 0) return showToast("Add categories first", "error");
    if (words.length === 0) return showToast("No words to sort", "error");

    cleanupOrphanedChips();
    gameActive = true;

    // Randomize the word bank
    shuffleArray(words);

    document.getElementById("empty-state").style.display = "none";
    document.getElementById("game-stats").classList.remove("opacity-0");
    document.getElementById("check-btn").classList.remove("hidden");
    document.getElementById("reset-btn").classList.remove("hidden");
    document.getElementById("new-game-btn").classList.remove("hidden");
    document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-green">PLAYING</span>';

    updateStartButtonVisibility();
    renderGameBoard();
    renderWordPool();
    updateStats();
    broadcastFullState();

    if (window.innerWidth < 768) toggleControlPanel(true);
}

function renderGameBoard() {
    const container = document.getElementById("categories-container");
    Array.from(container.children).forEach((child) => {
        if (child.id !== "empty-state") child.remove();
    });

    categories.forEach((cat, index) => {
        const zone = document.createElement("div");
        zone.className = `category-zone glass-panel rounded-2xl border-3 ${cat.color.border} p-4 flex flex-col gap-2 relative shadow-hard`;
        zone.dataset.category = cat.name;
        zone.dataset.index = index;

        zone.innerHTML = `
            <div class="flex items-center justify-between border-b-4 ${cat.color.border} pb-3 mb-4">
                <div class="flex items-center gap-3">
                    <i data-lucide="${cat.color.icon}" class="w-6 h-6 ${cat.color.text}"></i>
                    <span class="font-heading font-black text-2xl uppercase tracking-widest ${cat.color.text}">${cat.name}</span>
                </div>
                <span class="text-xs font-black text-slate-400 uppercase word-counter bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm">0</span>
            </div>
            <div class="zone-words flex flex-wrap gap-3 min-h-[100px] content-start flex-1 p-2"></div>
        `;
        container.appendChild(zone);
    });
    lucide.createIcons();
}

function renderWordPool() {
    const pool = document.getElementById("word-pool");
    pool.innerHTML = "";
    const unplacedWords = words.filter((w) => !w.placed);

    unplacedWords.forEach((word, idx) => {
        const chip = createWordChip(word, idx);
        pool.appendChild(chip);
    });

    document.getElementById("pool-count").textContent = `${unplacedWords.length} words`;
    lucide.createIcons();
}

function createWordChip(word, colorIndex) {
    const chip = document.createElement("div");
    const colorClass = wordColors[colorIndex % wordColors.length];

    // Random rotation for "sticker" look
    const randomRotation = (Math.random() * 4 - 2).toFixed(1); // -2deg to 2deg

    chip.className = `word-chip sticker ${colorClass} text-white px-6 py-3 rounded-2xl text-xl font-black shadow-hard border-4 border-dark dark:border-slate-500`;
    chip.style.transform = `rotate(${randomRotation}deg)`;
    chip.textContent = word.text;
    chip.dataset.wordId = word.id;
    chip.dataset.category = word.category;
    chip.dataset.originalRotation = randomRotation;

    chip.addEventListener("mousedown", handleDragStart);
    chip.addEventListener("touchstart", handleDragStart, { passive: false });
    return chip;
}

// Drag & Drop Handlers
function handleDragStart(e) {
    if (!gameActive) return;
    e.preventDefault();
    e.stopPropagation();

    draggedElement = e.currentTarget;
    const rect = draggedElement.getBoundingClientRect();
    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;
    dragStartRect = rect;

    draggedElement.classList.add("dragging");
    document.body.appendChild(draggedElement);
    updateDragPosition(clientX, clientY);
}

function handleDragMove(e) {
    if (!draggedElement) return;
    e.preventDefault();

    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    updateDragPosition(clientX, clientY);

    const zones = document.querySelectorAll(".category-zone");
    zones.forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            zone.classList.add("drag-over");
        } else {
            zone.classList.remove("drag-over");
        }
    });
}

function updateDragPosition(x, y) {
    draggedElement.style.left = `${x - dragOffset.x}px`;
    draggedElement.style.top = `${y - dragOffset.y}px`;
}

function handleDragEnd(e) {
    if (!draggedElement) return;

    const clientX = e.type.includes("touch") ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.changedTouches[0].clientY : e.clientY;

    const zones = document.querySelectorAll(".category-zone");
    let droppedZone = null;

    zones.forEach((zone) => {
        zone.classList.remove("drag-over");
        const rect = zone.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            droppedZone = zone;
        }
    });

    if (droppedZone) {
        dropWord(draggedElement, droppedZone);
    } else {
        returnToPool(draggedElement);
    }

    draggedElement.classList.remove("dragging");
    draggedElement = null;
}

function dropWord(chip, zone) {
    const wordId = chip.dataset.wordId;
    const word = words.find((w) => w.id === wordId);
    const zoneCategory = zone.dataset.category;

    if (!word) return;

    word.placed = true;
    word.currentZone = zoneCategory;

    const zoneWords = zone.querySelector(".zone-words");
    chip.classList.add("placed");
    chip.style.position = "";
    chip.style.left = "";
    chip.style.top = "";
    chip.style.transform = "";
    zoneWords.appendChild(chip);

    const counter = zone.querySelector(".word-counter");
    counter.textContent = zoneWords.children.length;

    // Pulse animation on drop
    chip.classList.add("animate-pulse-once");
    setTimeout(() => chip.classList.remove("animate-pulse-once"), 500);

    broadcastState({ immediate: true });

    if (instantCheck) {
        const isCorrect = word.category === zoneCategory;
        if (isCorrect) {
            zone.classList.add("correct");
            setTimeout(() => zone.classList.remove("correct"), 600);
        } else {
            zone.classList.add("incorrect");
            setTimeout(() => zone.classList.remove("incorrect"), 600);
        }
        updateStats();
    }

    renderWordPool();
    checkWinCondition();
}

function returnToPool(chip) {
    chip.classList.add("returning");
    chip.style.position = "";
    chip.style.left = "";
    chip.style.top = "";
    chip.style.transform = "";

    const wordId = chip.dataset.wordId;
    const word = words.find((w) => w.id === wordId);
    if (word) {
        word.placed = false;
        word.currentZone = null;
    }

    setTimeout(() => {
        chip.remove(); // Remove the proxy from body
        if (word && !word.placed) {
            // New chip will be created by renderWordPool
        }
        renderWordPool();
        broadcastState({ immediate: true });
    }, 300);
}

function checkAnswers() {
    let correct = 0;
    let placed = 0;

    words.forEach((word) => {
        if (word.placed) {
            placed++;
            if (word.category === word.currentZone) correct++;
        }
    });

    const accuracy = placed > 0 ? Math.round((correct / placed) * 100) : 0;

    document.querySelectorAll(".category-zone").forEach((zone) => {
        const zoneWords = zone.querySelectorAll(".word-chip");
        zoneWords.forEach((chip) => {
            const word = words.find((w) => w.id === chip.dataset.wordId);
            if (word) {
                chip.style.border = (word.category === zone.dataset.category) ? "3px solid #00d063" : "3px solid #ff4785";
            }
        });
    });

    showToast(`Score: ${correct}/${placed} correct (${accuracy}%)`, accuracy === 100 ? "success" : "info");

    if (correct === words.length && placed === words.length) {
        celebrate();
        document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-green">COMPLETE!</span>';
    }
}

function updateStats() {
    let correct = 0;
    let wrong = 0;

    words.forEach((word) => {
        if (word.placed) {
            if (word.category === word.currentZone) correct++;
            else wrong++;
        }
    });

    document.getElementById("correct-count").textContent = correct;
    document.getElementById("wrong-count").textContent = wrong;
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    document.getElementById("accuracy").textContent = `${accuracy}%`;
}

function checkWinCondition() {
    if (words.every((w) => w.placed)) {
        setTimeout(() => checkAnswers(), 500);
    }
}

function resetGame() {
    document.querySelectorAll(".category-zone .word-chip").forEach((chip) => {
        chip.style.border = "";
    });

    words.forEach((w) => {
        w.placed = false;
        w.currentZone = null;
    });

    document.querySelectorAll(".category-zone").forEach((zone) => {
        zone.querySelector(".zone-words").innerHTML = "";
        zone.querySelector(".word-counter").textContent = "0";
    });

    renderWordPool();
    updateStats();
    document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-blue">RESTARTED</span>';
    broadcastFullState();
}

function newGame() {
    cleanupOrphanedChips();
    gameActive = false;
    words = [];
    categories = [];

    document.getElementById("batch-input").value = "";
    document.getElementById("category-list").innerHTML = "";
    document.getElementById("pool-count").textContent = "0 words";
    document.getElementById("game-stats").classList.add("opacity-0");
    document.getElementById("check-btn").classList.add("hidden");
    document.getElementById("reset-btn").classList.add("hidden");
    document.getElementById("new-game-btn").classList.add("hidden");
    document.getElementById("empty-state").style.display = "flex";
    document.getElementById("categories-container").innerHTML = `
        <div id="empty-state" class="col-span-full flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-4">
            <div class="w-24 h-24 rounded-full border-4 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <i data-lucide="folder-plus" class="w-12 h-12"></i>
            </div>
            <p class="font-heading font-black text-2xl tracking-widest opacity-80 uppercase">ADD CATEGORIES TO START</p>
        </div>
    `;
    document.getElementById("word-pool").innerHTML = "";
    document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-slate-500 dark:text-slate-300">SETUP</span>';

    updateStartButtonVisibility();
    updateCategoryCount();
    lucide.createIcons();
}

// ==========================================
// 6. INPUTS & CATEGORY MANAGEMENT
// ==========================================

function parseBatchInput() {
    const input = document.getElementById("batch-input").value.trim();
    if (!input) return showToast("Please enter some data", "warning");

    const lines = input.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const newCategoriesMap = new Map();
    const parsedWords = [];

    lines.forEach((line, lineIndex) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            const categoryName = match[1].trim();
            const wordsList = match[2].split(",").map((w) => w.trim()).filter((w) => w.length > 0);

            if (categoryName && wordsList.length > 0) {
                if (!newCategoriesMap.has(categoryName)) newCategoriesMap.set(categoryName, []);
                wordsList.forEach((wordText) => {
                    newCategoriesMap.get(categoryName).push(wordText);
                    parsedWords.push({
                        id: `word-${Date.now()}-${lineIndex}-${Math.random().toString(36).substr(2, 9)}`,
                        text: wordText,
                        category: categoryName,
                        placed: false,
                        currentZone: null,
                    });
                });
            }
        }
    });

    if (newCategoriesMap.size === 0) return showToast("Invalid format. Use: category: word1, word2", "error");
    if (newCategoriesMap.size > 6) return showToast("Maximum 6 categories allowed", "error");

    categories = [];
    words = parsedWords;
    let colorIndex = 0;
    newCategoriesMap.forEach((wordList, catName) => {
        categories.push({ id: Date.now() + colorIndex, name: catName, color: categoryColors[colorIndex % 6], words: [] });
        colorIndex++;
    });

    renderCategories();
    updateCategoryCount();
    document.getElementById("pool-count").textContent = `${words.length} words`;
    showToast(`Created ${newCategoriesMap.size} categories with ${words.length} words`, "success");
    autoSave();

    // Set status to READY but don't start yet
    document.getElementById("status-display").innerHTML = 'STATUS: <span class="text-blue">READY</span>';
    updateStartButtonVisibility();
}

function addCategory() {
    const input = document.getElementById("new-category");
    const name = input.value.trim();

    if (!name) return showToast("Enter a category name", "warning");
    if (categories.length >= 6) return showToast("Maximum 6 categories allowed", "error");
    if (categories.find((c) => c.name.toLowerCase() === name.toLowerCase())) return showToast("Category already exists", "warning");

    categories.push({ id: Date.now(), name, color: categoryColors[categories.length], words: [] });
    input.value = "";
    renderCategories();
    updateCategoryCount();
    showToast(`Added "${name}"`, "success");
    updateStartButtonVisibility();
    autoSave();
}

function removeCategory(id) {
    categories = categories.filter((c) => c.id !== id);
    categories.forEach((c, i) => (c.color = categoryColors[i % 6]));
    renderCategories();
    updateCategoryCount();
    updateStartButtonVisibility();
    autoSave();
}

function renderCategories() {
    const list = document.getElementById("category-list");
    if (categories.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-400 italic text-center py-2">No categories yet</div>';
    } else {
        list.innerHTML = categories.map((cat) => `
            <div class="flex items-center justify-between p-2 bg-white/50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-200 dark:border-slate-700">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${cat.color.bg.replace("/20", "")}"></div>
                    <span class="font-bold text-dark dark:text-slate-200 text-sm">${cat.name}</span>
                    <span class="text-xs text-slate-400">(${words.filter((w) => w.category === cat.name).length})</span>
                </div>
                <button onclick="removeCategory(${cat.id})" class="p-1 hover:bg-pink/20 rounded text-slate-400 hover:text-pink transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `).join("");
    }
    lucide.createIcons();
}

function updateCategoryCount() {
    document.getElementById("category-count").textContent = `${categories.length}/6`;
    const btn = document.getElementById("add-cat-btn");
    btn.disabled = categories.length >= 6;
    btn.classList.toggle("opacity-50", categories.length >= 6);
}

function updateGameMode() {
    instantCheck = document.getElementById("instant-check").checked;
}

// ==================== BROADCAST CHANNEL (Student View) ====================
const BROADCAST_CHANNEL = 'word-sort-sync';
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;

let _bcThrottle = null, _bcLastTime = 0;

function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return;
    const now = performance.now();
    const minInterval = options.immediate ? 0 : 80;
    if (_bcThrottle) clearTimeout(_bcThrottle);
    const go = () => { _bcLastTime = performance.now(); _performBroadcast(); };
    if (now - _bcLastTime >= minInterval) go();
    else _bcThrottle = setTimeout(go, minInterval - (now - _bcLastTime));
}

function _performBroadcast() {
    // Snapshot per-zone chip states from DOM
    const zoneDump = [];
    document.querySelectorAll('.category-zone').forEach(zone => {
        const chips = [];
        zone.querySelectorAll('.word-chip').forEach(chip => {
            chips.push({
                wordId: chip.dataset.wordId,
                text: chip.textContent,
                colorClass: [...chip.classList].find(c => c.startsWith('bg-')) || '',
                borderColor: chip.style.border,
            });
        });
        zoneDump.push({ category: zone.dataset.category, chips });
    });
    const poolChips = [];
    document.querySelectorAll('#word-pool .word-chip').forEach(chip => {
        poolChips.push({
            wordId: chip.dataset.wordId,
            text: chip.textContent,
            colorClass: [...chip.classList].find(c => c.startsWith('bg-')) || '',
        });
    });
    const statusText = document.getElementById('status-display')?.innerText || '';
    bc.postMessage({
        type: 'state-update',
        categories: categories.map(c => ({ name: c.name, color: c.color })),
        zoneDump,
        poolChips,
        gameActive,
        statusText,
    });
}

function broadcastFullState() { broadcastState({ immediate: true }); }

if (bc && IS_PLAYER_WINDOW) {
    bc.onmessage = ({ data }) => {
        if (data.type !== 'state-update') return;
        if (window._playerRetryInterval) { clearInterval(window._playerRetryInterval); window._playerRetryInterval = null; }
        window._playerLoadingEl?.remove(); window._playerLoadingEl = null;

        // Rebuild game board if needed
        if (data.categories.length) {
            categories = data.categories.map((c, i) => ({ id: i, name: c.name, color: c.color, words: [] }));
            if (data.gameActive) {
                renderGameBoard();
                // Fill zones
                data.zoneDump.forEach(zd => {
                    const zone = document.querySelector(`.category-zone[data-category="${CSS.escape(zd.category)}"]`);
                    if (!zone) return;
                    const zoneWords = zone.querySelector('.zone-words');
                    zoneWords.innerHTML = '';
                    zd.chips.forEach(ch => {
                        const chip = document.createElement('div');
                        chip.className = `word-chip placed sticker ${ch.colorClass} text-white px-6 py-3 rounded-2xl text-xl font-black shadow-hard border-4 border-dark`;
                        chip.textContent = ch.text;
                        if (ch.borderColor) chip.style.border = ch.borderColor;
                        chip.dataset.wordId = ch.wordId;
                        zoneWords.appendChild(chip);
                    });
                    zone.querySelector('.word-counter').textContent = zoneWords.children.length;
                });
                // Fill pool
                const pool = document.getElementById('word-pool');
                pool.innerHTML = '';
                data.poolChips.forEach(ch => {
                    const chip = document.createElement('div');
                    chip.className = `word-chip sticker ${ch.colorClass} text-white px-6 py-3 rounded-2xl text-xl font-black shadow-hard border-4 border-dark`;
                    chip.textContent = ch.text;
                    chip.dataset.wordId = ch.wordId;
                    pool.appendChild(chip);
                });
                document.getElementById('game-stats')?.classList.remove('opacity-0');
            }
        }
        // Update status
        const sd = document.getElementById('student-round-display');
        if (sd) sd.textContent = data.statusText;
    };
}

// ------------------------------------------
// Start the App
// ------------------------------------------
async function _initPlayer() {
    document.documentElement.classList.add('player-mode');
    document.title = 'Student View | Word Sort';
    document.getElementById('controls')?.style.setProperty('display', 'none');
    document.getElementById('btn-open-player')?.style.setProperty('display', 'none');
    document.getElementById('player-toolbar')?.classList.remove('hidden');
    lucide.createIcons();
    const loadingEl = document.createElement('div');
    loadingEl.className = 'fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-white/95 border-2 border-dark rounded-full shadow-neo backdrop-blur-sm';
    loadingEl.innerHTML = `<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/></svg><span class="font-bold text-xs text-slate-500 uppercase tracking-widest">Connecting...</span>`;
    document.body.appendChild(loadingEl);
    window._playerLoadingEl = loadingEl;
    const ping = () => bc?.postMessage({ type: 'player-ready' });
    ping(); window._playerRetryInterval = setInterval(ping, 2000);
}

if (IS_PLAYER_WINDOW) {
    _initPlayer();
} else {
    init().then(() => {
        if (bc) {
            bc.onmessage = (evt) => { if (evt.data?.type === 'player-ready') broadcastFullState(); };
        }
        document.getElementById('btn-open-player')?.addEventListener('click', () => {
            window.open(location.pathname + '?player=1', 'word-sort-student', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
        });
    });
}

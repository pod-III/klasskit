// --- Constants & State ---
const pagesContainer = document.getElementById("pagesContainer");
const rowsSelect = document.getElementById("rowsSelect");
const inputRows = document.getElementById("inputRows");
const sentencesInput = document.getElementById("sentencesInput");
const printStyle = document.getElementById("printOrientationStyle");

const EXAMPLE_SENTENCES = [
    "I wake up at seven o'clock every morning.",
    "Yesterday, we went to the science museum.",
    "She always brings an umbrella on rainy days. | She always bring an umbrella on rainy days.",
    "My brother is playing football in the park.",
    "They didn't watch the movie last night.",
    "Elephants have very long trunks and big ears.",
    "Follow the footprints to the old library.",
    "If we leave early, we will catch the first train."
].join("\n");

const PUZZLE_MODES = ["scramble", "caesar", "fix", "vowels", "anagram", "nospaces"];
const AUTO_MIXED_MODES = ["scramble", "caesar", "vowels", "anagram", "nospaces"];
const MODE_LABELS = {
    scramble: "Scramble",
    caesar: "Caesar Cipher",
    fix: "Fix Sentence",
    vowels: "Missing Vowels",
    anagram: "Letter Jumble",
    nospaces: "Word Glue",
    mixed: "Mixed"
};

let state = {
    activeId: null,
    sortMode: "recent",
    orientation: "portrait",
    rowsPerPage: 8,
    spineSide: "left",
    spineWidth: 22,
    spineTitle: "PAPER GRASS",
    fontSize: 1.35,
    puzzleMode: "mixed",
    caesarShift: 3,
    showBadges: true,
    showNumbers: true,
    showAnswerLine: false,
    showAnswerKey: true,
    rawSentences: EXAMPLE_SENTENCES,
    pages: []
};

// --- Toast & Confirm ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    const colors = {
        success: "bg-brand-green text-brand-dark border-brand-dark",
        error: "bg-brand-pink text-white border-brand-dark",
        info: "bg-brand-blue text-white border-brand-dark",
        warning: "bg-brand-orange text-brand-dark border-brand-dark"
    };
    const icon = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info";
    toast.className = `${colors[type] || colors.info} px-6 py-3 rounded-2xl shadow-neo border-2 border-brand-dark font-bold text-sm flex items-center gap-2 pointer-events-auto animate-pop-in`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i> <span></span>`;
    toast.querySelector("span").textContent = message;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.35s ease";
        setTimeout(() => toast.remove(), 350);
    }, 2800);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirmModal");
        const titleEl = document.getElementById("confirmTitle");
        const msgEl = document.getElementById("confirmMessage");
        const yesBtn = document.getElementById("confirmBtnYes");
        const noBtn = document.getElementById("confirmBtnNo");

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        if (window.lucide) lucide.createIcons();

        const cleanup = (val) => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            yesBtn.onclick = null;
            noBtn.onclick = null;
            modal.onclick = null;
            resolve(val);
        };

        yesBtn.onclick = () => cleanup(true);
        noBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => { if (e.target === modal) cleanup(false); };
    });
}

// --- Theme ---
function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme_paper-grass", isDark ? "dark" : "light");
}

function initTheme() {
    const saved = localStorage.getItem("theme_paper-grass") || localStorage.getItem("theme_hub");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

// --- Puzzle Generators ---
function shuffleCopy(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function makeScramblePuzzle(sentence) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
        return { puzzle: sentence, hint: "Unscramble the word" };
    }
    let shuffled = shuffleCopy(words);
    let tries = 0;
    while (shuffled.join(" ") === words.join(" ") && tries < 10) {
        shuffled = shuffleCopy(words);
        tries++;
    }
    if (shuffled.join(" ") === words.join(" ")) {
        shuffled = [...words.slice(1), words[0]];
    }
    return {
        puzzle: shuffled.join("  /  "),
        hint: "Put words in order"
    };
}

function makeCaesarPuzzle(sentence, shiftSetting) {
    const shift = shiftSetting > 0 ? shiftSetting : (Math.floor(Math.random() * 5) + 1);
    const shifted = sentence.replace(/[a-zA-Z]/g, (ch) => {
        const base = ch >= "a" && ch <= "z" ? 97 : 65;
        return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
    const sampleTo = String.fromCharCode(65 + shift);
    return {
        puzzle: shifted,
        hint: `Caesar +${shift} (A→${sampleTo})`
    };
}

function makeFixPuzzle(sentence, customWrong = "") {
    if (customWrong) {
        return { puzzle: customWrong, hint: "Find & fix the mistake", missingWrong: false };
    }
    return {
        puzzle: "",
        hint: "Enter wrong sentence (Right | Wrong)",
        missingWrong: true
    };
}

function makeVowelsPuzzle(sentence) {
    const out = sentence
        .split(/(\s+)/)
        .map((tok) => {
            if (/^\s+$/.test(tok)) return tok;
            const alphaOnly = tok.replace(/[^a-zA-Z]/g, "");
            if (alphaOnly.length <= 1) return tok;
            return tok.replace(/[aeiouAEIOU]/g, "_");
        })
        .join("");
    return {
        puzzle: out,
        hint: "Fill in missing vowels"
    };
}

function makeAnagramPuzzle(sentence) {
    const out = sentence.replace(/[a-zA-Z]{3,}/g, (word) => {
        const chars = word.split("");
        let jumbled = shuffleCopy(chars);
        let tries = 0;
        while (jumbled.join("") === word && tries < 8) {
            jumbled = shuffleCopy(chars);
            tries++;
        }
        if (jumbled.join("") === word && chars.length >= 2) {
            [jumbled[0], jumbled[1]] = [jumbled[1], jumbled[0]];
        }
        return jumbled.join("");
    });
    return {
        puzzle: out,
        hint: "Unscramble each word"
    };
}

function makeNoSpacesPuzzle(sentence) {
    const glued = sentence.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return {
        puzzle: glued || sentence,
        hint: "Separate words & punctuate"
    };
}

function buildStripPuzzle(rawLine, mode, index) {
    const parts = rawLine.split("|").map((p) => p.trim());
    const answer = parts[0] || "";
    const customWrong = parts.length > 1 ? parts.slice(1).join(" | ").trim() : "";

    const effectiveMode = mode === "mixed"
        ? (customWrong ? "fix" : AUTO_MIXED_MODES[index % AUTO_MIXED_MODES.length])
        : mode;

    let generated;
    switch (effectiveMode) {
        case "caesar":
            generated = makeCaesarPuzzle(answer, state.caesarShift);
            break;
        case "fix":
            generated = makeFixPuzzle(answer, customWrong);
            break;
        case "vowels":
            generated = makeVowelsPuzzle(answer);
            break;
        case "anagram":
            generated = makeAnagramPuzzle(answer);
            break;
        case "nospaces":
            generated = makeNoSpacesPuzzle(answer);
            break;
        case "scramble":
        default:
            generated = makeScramblePuzzle(answer);
            break;
    }

    return {
        num: index + 1,
        mode: effectiveMode,
        puzzle: generated.puzzle,
        answer,
        customWrong,
        missingWrong: !!generated.missingWrong,
        hint: generated.hint
    };
}

function parseSentenceLines(raw) {
    return String(raw || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
}

function updateSentenceCountPill() {
    const pill = document.getElementById("sentenceCountPill");
    if (!pill) return;
    const totalStrips = state.pages.reduce((sum, page) => sum + page.length, 0);
    const totalPages = Math.max(1, state.pages.length);
    pill.textContent = `${totalStrips} ${totalStrips === 1 ? "strip" : "strips"} · ${totalPages}p`;
}

function generateFromSentences(shouldSave = true) {
    const lines = parseSentenceLines(sentencesInput.value);
    state.rawSentences = sentencesInput.value;

    if (!lines.length) {
        state.pages = [[]];
        renderFixPairsEditor();
        renderAllPages(shouldSave);
        return;
    }

    const perPage = Math.max(2, Math.min(16, parseInt(state.rowsPerPage, 10) || 8));
    const strips = lines.map((line, idx) => buildStripPuzzle(line, state.puzzleMode, idx));

    const pages = [];
    for (let i = 0; i < strips.length; i += perPage) {
        pages.push(strips.slice(i, i + perPage));
    }

    state.pages = pages;
    renderFixPairsEditor();
    renderAllPages(shouldSave);
}

// --- Fix Error Right & Wrong Pair Editor ---
function getSentencePairsFromTextarea() {
    return parseSentenceLines(sentencesInput?.value || "").map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
            right: parts[0] || "",
            wrong: parts.length > 1 ? parts.slice(1).join(" | ").trim() : ""
        };
    });
}

function syncTextareaFromFixPairs(pairs) {
    const lines = pairs
        .filter((p) => p.right.trim() || p.wrong.trim())
        .map((p) => (p.wrong.trim() ? `${p.right.trim()} | ${p.wrong.trim()}` : p.right.trim()));
    if (sentencesInput) sentencesInput.value = lines.join("\n");
    state.rawSentences = sentencesInput?.value || "";
}

function rebuildPagesFromSentences(shouldSave = true) {
    const lines = parseSentenceLines(sentencesInput?.value || "");
    state.rawSentences = sentencesInput?.value || "";
    if (!lines.length) {
        state.pages = [[]];
        renderAllPages(shouldSave);
        return;
    }
    const perPage = Math.max(2, Math.min(16, parseInt(state.rowsPerPage, 10) || 8));
    const strips = lines.map((line, i) => buildStripPuzzle(line, state.puzzleMode, i));
    const pages = [];
    for (let i = 0; i < strips.length; i += perPage) pages.push(strips.slice(i, i + perPage));
    state.pages = pages;
    renderAllPages(shouldSave);
}

function createFixPairCard(pair, idx) {
    const card = document.createElement("div");
    const updateCardChrome = (rightVal, wrongVal) => {
        const needsWrong = !wrongVal.trim();
        card.className = `p-2.5 rounded-xl border-2 space-y-1.5 ${
            needsWrong
                ? "border-brand-orange bg-brand-orange/10"
                : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80"
        }`;
        const labelEl = card.querySelector(".pair-label");
        if (labelEl) labelEl.textContent = `#${idx + 1}${needsWrong ? " · Add wrong version" : ""}`;
    };

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <span class="pair-label text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-300"></span>
            <button type="button" class="pair-del text-slate-400 hover:text-brand-pink transition-colors" title="Remove pair">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
        </div>
        <input type="text" class="pair-right input-chunky !py-1.5 !px-2.5 text-xs" placeholder="Right (Answer Key)..." />
        <input type="text" class="pair-wrong input-chunky !py-1.5 !px-2.5 text-xs" placeholder="Wrong (Printed on strip)..." />
    `;

    const rightIn = card.querySelector(".pair-right");
    const wrongIn = card.querySelector(".pair-wrong");
    rightIn.value = pair.right || "";
    wrongIn.value = pair.wrong || "";
    updateCardChrome(rightIn.value, wrongIn.value);

    const onPairEdit = () => {
        updateCardChrome(rightIn.value, wrongIn.value);
        const list = document.getElementById("fixPairsList");
        if (!list) return;
        const allPairs = [...list.querySelectorAll(".pair-right")].map((rEl, i) => {
            const wEl = list.querySelectorAll(".pair-wrong")[i];
            return { right: rEl.value, wrong: wEl ? wEl.value : "" };
        });
        syncTextareaFromFixPairs(allPairs);
        rebuildPagesFromSentences(true);
    };

    rightIn.addEventListener("input", onPairEdit);
    wrongIn.addEventListener("input", onPairEdit);
    card.querySelector(".pair-del").onclick = () => removeFixPair(idx);
    return card;
}

function renderFixPairsEditor() {
    const list = document.getElementById("fixPairsList");
    if (!list) return;
    const pairs = getSentencePairsFromTextarea();
    list.innerHTML = "";

    if (!pairs.length) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 italic">No pairs yet. Click + Add Pair to create one.</p>';
        return;
    }

    pairs.forEach((pair, idx) => {
        list.appendChild(createFixPairCard(pair, idx));
    });

    if (window.lucide) lucide.createIcons();
}

function addFixPair() {
    const list = document.getElementById("fixPairsList");
    if (!list) return;
    const emptyMsg = list.querySelector("p.italic");
    if (emptyMsg) emptyMsg.remove();
    const idx = list.querySelectorAll(".pair-right").length;
    const card = createFixPairCard({ right: "", wrong: "" }, idx);
    list.appendChild(card);
    if (window.lucide) lucide.createIcons();
    card.querySelector(".pair-right")?.focus();
}

function removeFixPair(idx) {
    const pairs = getSentencePairsFromTextarea();
    pairs.splice(idx, 1);
    syncTextareaFromFixPairs(pairs);
    generateFromSentences(true);
}

// --- IndexedDB & Cloud Library ---
const DB_NAME = "PaperGrassDB";
const DB_VER = 1;
const STATE_STORE = "game_state";
const SETS_STORE = "grass_sets";

async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
            if (!db.objectStoreNames.contains(SETS_STORE)) db.createObjectStore(SETS_STORE, { keyPath: "id", autoIncrement: true });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function dbPut(key, data) {
    try {
        const db = await initDB();
        db.transaction(STATE_STORE, "readwrite").objectStore(STATE_STORE).put(data, key);
    } catch (e) { console.error(e); }
}

async function saveSetToDB(name, stateData, existingId = null) {
    const localDb = await initDB();
    const tx = localDb.transaction(SETS_STORE, "readwrite");
    const store = tx.objectStore(SETS_STORE);

    const set = {
        name,
        stateData,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
    };

    if (existingId) {
        return new Promise((resolve) => {
            const req = store.get(existingId);
            req.onsuccess = () => {
                const old = req.result;
                if (old) {
                    set.id = existingId;
                    set.createdAt = old.createdAt || Date.now();
                    set.usageCount = (old.usageCount || 0) + 1;
                }
                store.put(set);
                tx.oncomplete = () => resolve(set.id || existingId);
            };
            req.onerror = () => resolve(existingId);
        });
    }

    const req = store.add(set);
    return new Promise((resolve) => {
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
    });
}

async function getAllSets() {
    try {
        const localDb = await initDB();
        return new Promise((resolve) => {
            const req = localDb.transaction(SETS_STORE, "readonly").objectStore(SETS_STORE).getAll();
            req.onsuccess = () => {
                const sets = req.result || [];
                sets.forEach((s) => {
                    if (!s.lastUsed) s.lastUsed = s.createdAt || Date.now();
                    if (!s.usageCount) s.usageCount = 0;
                });
                resolve(sets);
            };
            req.onerror = () => resolve([]);
        });
    } catch (e) { return []; }
}

async function restoreCloudSetsIfNeeded(cloudSets) {
    if (!Array.isArray(cloudSets) || !cloudSets.length) return;
    const localSets = await getAllSets();
    const existingKeys = new Set(localSets.map((s) => `${s.name}::${s.createdAt || ""}`));
    const localDb = await initDB();
    const tx = localDb.transaction(SETS_STORE, "readwrite");
    const store = tx.objectStore(SETS_STORE);
    let added = false;

    cloudSets.forEach((s) => {
        const key = `${s.name}::${s.createdAt || ""}`;
        if (!existingKeys.has(key) && s.name && s.stateData) {
            const { id, ...rest } = s;
            store.add(rest);
            added = true;
        }
    });

    if (added) {
        await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
        });
    }
}

async function deleteSetById(id) {
    const localDb = await initDB();
    const tx = localDb.transaction(SETS_STORE, "readwrite");
    tx.objectStore(SETS_STORE).delete(id);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function renderSetsLibrary() {
    const list = document.getElementById("sets-list");
    if (!list) return;
    const sets = await getAllSets();
    if (!sets.length) {
        list.innerHTML = '<p class="text-slate-400 text-[10px] italic">No saved sets yet.</p>';
        return;
    }

    if (state.sortMode === "recent") sets.sort((a, b) => b.lastUsed - a.lastUsed);
    else if (state.sortMode === "alpha") sets.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortMode === "popular") sets.sort((a, b) => b.usageCount - a.usageCount);

    list.innerHTML = "";
    sets.forEach((set) => {
        const isActive = state.activeId === set.id;
        const rowCount = (set.stateData?.pages || []).reduce((acc, p) => acc + p.length, 0);
        const item = document.createElement("div");
        item.className = `flex items-center gap-2 p-2 border-2 rounded-lg transition-all ${
            isActive
                ? "bg-brand-blue/5 border-brand-blue/40 shadow-neo-sm"
                : "bg-slate-50 dark:bg-slate-800 border-brand-dark/10 dark:border-slate-600 hover:border-brand-blue/40"
        }`;

        item.innerHTML = `
            <div class="flex-1 min-w-0 cursor-pointer">
                <div class="flex items-center gap-1.5">
                    <p class="text-xs font-bold text-brand-dark dark:text-white truncate"></p>
                    ${isActive ? '<span class="px-1 py-0.5 rounded bg-brand-blue text-white text-[7px] font-bold uppercase shrink-0">Active</span>' : ""}
                </div>
                <p class="text-[9px] text-slate-400 truncate">${rowCount} strip(s) · ${MODE_LABELS[set.stateData?.puzzleMode] || "Puzzle"}</p>
            </div>
            <button type="button" class="set-load p-1.5 bg-brand-blue/10 text-brand-blue rounded-md border border-brand-blue/20 hover:bg-brand-blue hover:text-white transition-all" title="Load">
                <i data-lucide="upload" class="w-3 h-3 pointer-events-none"></i>
            </button>
            <button type="button" class="set-del p-1.5 bg-brand-pink/10 text-brand-pink rounded-md border border-brand-pink/20 hover:bg-brand-pink hover:text-white transition-all" title="Delete">
                <i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i>
            </button>`;

        item.querySelector("p.text-xs").textContent = set.name;
        const loadSet = async () => {
            const localDb = await initDB();
            const tx = localDb.transaction(SETS_STORE, "readwrite");
            const store = tx.objectStore(SETS_STORE);
            const r = store.get(set.id);
            r.onsuccess = () => {
                const rec = r.result;
                if (!rec) return;
                rec.usageCount = (rec.usageCount || 0) + 1;
                rec.lastUsed = Date.now();
                store.put(rec);
                applyLoadedState(rec.stateData, rec.id, rec.name);
                showToast(`Loaded "${rec.name}"`, "success");
            };
        };

        item.querySelector(".flex-1").onclick = loadSet;
        item.querySelector(".set-load").onclick = loadSet;
        item.querySelector(".set-del").onclick = async (e) => {
            e.stopPropagation();
            const ok = await showConfirm("Delete Set", `Delete "${set.name}"?`);
            if (!ok) return;
            await deleteSetById(set.id);
            if (state.activeId === set.id) closeActiveSet();
            renderSetsLibrary();
            syncToCloud();
        };
        list.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

function applyLoadedState(loaded, id = null, name = "") {
    state = { ...state, ...loaded, activeId: id };
    syncControlsToState();
    renderAllPages(false);
    updateActiveIndicator(name);
    renderSetsLibrary();
    saveState(false);
}

async function saveCurrentSet() {
    const input = document.getElementById("set-name-input");
    const name = input.value.trim();
    if (!name) {
        showToast("Please enter a set name", "warning");
        return;
    }
    saveState(false);
    const clone = JSON.parse(JSON.stringify(state));
    const newId = await saveSetToDB(name, clone, state.activeId);
    state.activeId = newId;
    input.value = "";
    updateActiveIndicator(name);
    renderSetsLibrary();
    syncToCloud();
    showToast(`Set "${name}" saved`, "success");
}

function updateActiveIndicator(name) {
    const indicator = document.getElementById("active-set-indicator");
    const nameEl = document.getElementById("active-set-name");
    const saveBtn = document.getElementById("save-btn");

    if (state.activeId && name) {
        indicator.classList.remove("hidden");
        nameEl.textContent = name;
        if (saveBtn) saveBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> SAVE AS';
    } else {
        indicator.classList.add("hidden");
        if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save" class="w-3 h-3"></i> SAVE';
    }
    if (window.lucide) lucide.createIcons();
}

function closeActiveSet() {
    state.activeId = null;
    updateActiveIndicator();
    renderSetsLibrary();
    saveState();
}

function changeSetsSort() {
    state.sortMode = document.getElementById("sets-sort").value;
    renderSetsLibrary();
}

// --- Persistence ---
const LOCAL_KEY = "klasskit_paper_grass_v1";
let cloudSyncTimer = null;

function syncToCloud() {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
        if (typeof saveProgress !== "function") return;
        try {
            const sets = await getAllSets();
            await saveProgress("paper_grass", { state, sets });
        } catch (e) { /* ignore */ }
    }, 1200);
}

function saveState(triggerCloud = true) {
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
    dbPut("paperGrassState", state);

    if (state.activeId) {
        saveSetToDB(document.getElementById("active-set-name")?.textContent || "Untitled", JSON.parse(JSON.stringify(state)), state.activeId).catch(() => {});
    }
    if (triggerCloud) syncToCloud();
}

async function loadState() {
    let loaded = false;
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
            state = { ...state, ...JSON.parse(raw) };
            loaded = true;
        }
    } catch (e) { /* ignore */ }

    if (typeof loadProgress === "function") {
        try {
            const cloud = await loadProgress("paper_grass");
            if (cloud) {
                if (cloud.state) {
                    state = { ...state, ...cloud.state };
                    loaded = true;
                }
                if (Array.isArray(cloud.sets)) {
                    await restoreCloudSetsIfNeeded(cloud.sets);
                }
            }
        } catch (e) { /* ignore */ }
    }

    syncControlsToState();
    if (!loaded || !Array.isArray(state.pages) || !state.pages.length || state.pages[0].length === 0) {
        generateFromSentences(false);
    } else {
        renderAllPages(false);
    }

    if (state.activeId) {
        const sets = await getAllSets();
        const active = sets.find((s) => s.id === state.activeId);
        if (active) updateActiveIndicator(active.name);
        else state.activeId = null;
    }
    renderSetsLibrary();
}

// --- Controls Sync & Setters ---
function syncControlsToState() {
    if (sentencesInput) sentencesInput.value = state.rawSentences ?? "";
    if (inputRows) inputRows.value = state.rowsPerPage;
    if (rowsSelect) {
        const val = String(state.rowsPerPage);
        rowsSelect.value = ["6", "8", "10", "12"].includes(val) ? val : "";
    }
    const spineInput = document.getElementById("spineTitleInput");
    if (spineInput) spineInput.value = state.spineTitle || "PAPER GRASS";
    const caesarSel = document.getElementById("caesarShiftSelect");
    if (caesarSel) caesarSel.value = String(state.caesarShift ?? 3);

    setPuzzleMode(state.puzzleMode, false, false);
    setOrientation(state.orientation, false);
    setSpineSide(state.spineSide, false);
    setSpineWidth(state.spineWidth, false);
    setFontSize(state.fontSize, false);
    updateTogglesUI();
}

function setPuzzleMode(mode, regenerate = true, shouldSave = true) {
    state.puzzleMode = mode;
    ["scramble", "caesar", "fix", "vowels", "anagram", "nospaces", "mixed"].forEach((m) => {
        const btn = document.getElementById(`mode-${m}`);
        if (btn) btn.classList.toggle("active", m === mode);
    });
    const caesarBox = document.getElementById("caesarOptionsBox");
    if (caesarBox) caesarBox.classList.toggle("hidden", mode !== "caesar" && mode !== "mixed");
    const fixBox = document.getElementById("fixOptionsBox");
    if (fixBox) {
        fixBox.classList.toggle("hidden", mode !== "fix");
        if (mode === "fix") renderFixPairsEditor();
    }
    if (regenerate) {
        generateFromSentences(shouldSave);
    } else if (shouldSave) {
        saveState();
    }
}

function setOrientation(type, shouldSave = true) {
    state.orientation = type === "landscape" ? "landscape" : "portrait";
    document.getElementById("btnPortrait")?.classList.toggle("active", state.orientation === "portrait");
    document.getElementById("btnLandscape")?.classList.toggle("active", state.orientation === "landscape");
    document.querySelectorAll(".a4-page").forEach((page) => {
        page.classList.remove("a4-portrait", "a4-landscape");
        page.classList.add(`a4-${state.orientation}`);
    });
    printStyle.innerHTML = `@page { size: A4 ${state.orientation}; margin: 0; }`;
    if (currentZoomMode === "fit") applyPreviewZoom();
    if (shouldSave) saveState();
}

function setSpineSide(side, shouldSave = true) {
    state.spineSide = side === "right" ? "right" : "left";
    document.getElementById("spineLeft")?.classList.toggle("active", state.spineSide === "left");
    document.getElementById("spineRight")?.classList.toggle("active", state.spineSide === "right");
    document.querySelectorAll(".grass-sheet").forEach((s) => {
        s.classList.toggle("spine-right", state.spineSide === "right");
    });
    if (shouldSave) saveState();
}

function setSpineWidth(mm, shouldSave = true) {
    state.spineWidth = Number(mm) || 22;
    document.documentElement.style.setProperty("--spine-width", `${state.spineWidth}mm`);
    [16, 22, 30].forEach((w) => {
        document.getElementById(`spineW-${w}`)?.classList.toggle("active", w === state.spineWidth);
    });
    if (shouldSave) saveState();
}

function setFontSize(size, shouldSave = true) {
    state.fontSize = parseFloat(size) || 1.35;
    [1, 1.35, 1.65, 2].forEach((s) => {
        document.getElementById(`font-${s}`)?.classList.toggle("active", Math.abs(s - state.fontSize) < 0.05);
    });
    document.querySelectorAll(".strip-puzzle-text").forEach((el) => {
        el.style.fontSize = `${state.fontSize}rem`;
    });
    if (shouldSave) saveState();
}

function toggleOption(key) {
    state[key] = !state[key];
    updateTogglesUI();
    renderAllPages(true);
}

function updateTogglesUI() {
    document.getElementById("toggleBadges")?.classList.toggle("active", !!state.showBadges);
    document.getElementById("toggleNumbers")?.classList.toggle("active", !!state.showNumbers);
    document.getElementById("toggleAnswerLine")?.classList.toggle("active", !!state.showAnswerLine);
    document.getElementById("toggleAnswerKey")?.classList.toggle("active", !!state.showAnswerKey);
}

function syncFromRowsPreset() {
    if (!rowsSelect.value) return;
    state.rowsPerPage = parseInt(rowsSelect.value, 10) || 8;
    inputRows.value = state.rowsPerPage;
    generateFromSentences(true);
}

function handleCustomRows() {
    state.rowsPerPage = Math.max(2, Math.min(16, parseInt(inputRows.value, 10) || 8));
    inputRows.value = state.rowsPerPage;
    rowsSelect.value = ["6", "8", "10", "12"].includes(String(state.rowsPerPage)) ? String(state.rowsPerPage) : "";
    generateFromSentences(true);
}

function updateSpineTitle(val) {
    state.spineTitle = val;
    document.querySelectorAll(".spine-stop-text").forEach((el) => {
        el.textContent = val || "PAPER GRASS";
    });
    saveState();
}

// --- Page & Strip Actions ---
function addNewPage() {
    const nextNum = state.pages.reduce((acc, p) => acc + p.length, 0) + 1;
    const blankRow = {
        num: nextNum,
        mode: state.puzzleMode === "mixed" ? "scramble" : state.puzzleMode,
        puzzle: "",
        answer: "",
        hint: "Edit puzzle text"
    };
    state.pages.push([blankRow]);
    renderAllPages(true);
    showToast("New page added", "success");
}

function addRowToPage(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return;
    const nextNum = state.pages.reduce((acc, p) => acc + p.length, 0) + 1;
    page.push({
        num: nextNum,
        mode: state.puzzleMode === "mixed" ? PUZZLE_MODES[(nextNum - 1) % PUZZLE_MODES.length] : state.puzzleMode,
        puzzle: "",
        answer: "",
        hint: "Edit puzzle text"
    });
    renumberStrips();
    renderAllPages(true);
}

function shufflePage(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page || page.length < 2) return;
    state.pages[pageIndex] = shuffleCopy(page);
    renumberStrips();
    renderAllPages(true);
    showToast(`Shuffled Page ${pageIndex + 1}`, "info");
}

function rerollAllStrips() {
    let idx = 0;
    state.pages.forEach((page) => {
        for (let i = 0; i < page.length; i++) {
            const strip = page[i];
            const source = strip.answer || strip.puzzle;
            if (source) {
                const rawLine = strip.customWrong ? `${strip.answer} | ${strip.customWrong}` : source;
                const updated = buildStripPuzzle(rawLine, state.puzzleMode === "mixed" ? strip.mode : state.puzzleMode, idx);
                page[i] = { ...strip, ...updated, num: strip.num };
            }
            idx++;
        }
    });
    renderAllPages(true);
    showToast("Remixed all puzzles", "success");
}

async function deletePage(pageIndex) {
    if (state.pages.length <= 1) {
        showToast("You need at least one page.", "error");
        return;
    }
    const ok = await showConfirm("Delete Page", `Delete Page ${pageIndex + 1}?`);
    if (!ok) return;
    state.pages.splice(pageIndex, 1);
    renumberStrips();
    renderAllPages(true);
}

function rerollStrip(pageIndex, stripIndex) {
    const strip = state.pages[pageIndex]?.[stripIndex];
    if (!strip) return;
    const source = strip.answer || strip.puzzle;
    if (!source) return;
    const rawLine = strip.customWrong ? `${strip.answer} | ${strip.customWrong}` : source;
    const updated = buildStripPuzzle(rawLine, strip.mode, strip.num - 1);
    state.pages[pageIndex][stripIndex] = { ...strip, ...updated, num: strip.num };
    renderAllPages(true);
}

function cycleStripMode(pageIndex, stripIndex) {
    const strip = state.pages[pageIndex]?.[stripIndex];
    if (!strip) return;
    const curIdx = PUZZLE_MODES.indexOf(strip.mode);
    const nextMode = PUZZLE_MODES[(curIdx + 1) % PUZZLE_MODES.length];
    strip.mode = nextMode;
    const source = strip.answer || strip.puzzle;
    if (source) {
        const rawLine = strip.customWrong ? `${strip.answer} | ${strip.customWrong}` : source;
        const updated = buildStripPuzzle(rawLine, nextMode, strip.num - 1);
        state.pages[pageIndex][stripIndex] = { ...strip, ...updated, num: strip.num };
    }
    renderAllPages(true);
}

function deleteStrip(pageIndex, stripIndex) {
    const page = state.pages[pageIndex];
    if (!page) return;
    if (page.length <= 1 && state.pages.length <= 1) {
        showToast("Keep at least one strip.", "warning");
        return;
    }
    page.splice(stripIndex, 1);
    if (page.length === 0 && state.pages.length > 1) {
        state.pages.splice(pageIndex, 1);
    }
    renumberStrips();
    renderAllPages(true);
}

function renumberStrips() {
    let n = 1;
    state.pages.forEach((p) => p.forEach((s) => { s.num = n++; }));
}

// --- Rendering ---
function renderAllPages(shouldSave = true) {
    const prevScroll = pagesContainer.scrollTop;
    pagesContainer.innerHTML = "";
    document.documentElement.style.setProperty("--spine-width", `${state.spineWidth}mm`);

    state.pages.forEach((pageData, pageIndex) => {
        renderSinglePage(pageIndex, pageData);
    });

    if (state.showAnswerKey) {
        renderAnswerKeyPage();
    }

    updateSentenceCountPill();
    applyPreviewZoom();
    pagesContainer.scrollTop = prevScroll;
    if (window.lucide) lucide.createIcons();
    if (shouldSave) saveState();
}

function renderSinglePage(pageIndex, pageData) {
    const wrapper = document.createElement("div");
    wrapper.className = "page-wrapper";

    // Floating Header (matches Card Maker)
    const headerDiv = document.createElement("div");
    headerDiv.className = "absolute -top-10 left-0 w-full flex justify-between items-end no-print pb-2 gap-2";

    const pageLabel = document.createElement("div");
    pageLabel.className = "font-heading font-bold text-slate-400 text-sm uppercase tracking-widest";
    pageLabel.innerText = `Page ${pageIndex + 1} (${pageData.length} ${pageData.length === 1 ? "strip" : "strips"})`;
    headerDiv.appendChild(pageLabel);

    const controlsDiv = document.createElement("div");
    controlsDiv.className = "flex flex-wrap gap-2";

    const mkBtn = (cls, html, onClick) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `${cls} border-2 border-brand-dark dark:border-slate-500 px-3 py-1.5 rounded-lg font-heading font-bold text-[11px] shadow-neo-sm hover:scale-105 active:translate-y-0.5 transition-all flex items-center gap-1.5`;
        b.innerHTML = html;
        b.onclick = onClick;
        return b;
    };

    controlsDiv.appendChild(mkBtn("bg-brand-blue text-white", '<i data-lucide="image" class="w-3.5 h-3.5"></i> SAVE PNG', () => savePageAsImage(pageIndex, wrapper)));
    controlsDiv.appendChild(mkBtn("bg-brand-green text-brand-dark", '<i data-lucide="plus" class="w-3.5 h-3.5"></i> + STRIP', () => addRowToPage(pageIndex)));
    controlsDiv.appendChild(mkBtn("bg-brand-orange text-brand-dark", '<i data-lucide="shuffle" class="w-3.5 h-3.5"></i> SHUFFLE', () => shufflePage(pageIndex)));
    if (state.pages.length > 1) {
        controlsDiv.appendChild(mkBtn("bg-brand-pink text-white", '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> DELETE', () => deletePage(pageIndex)));
    }

    headerDiv.appendChild(controlsDiv);
    wrapper.appendChild(headerDiv);

    // A4 Sheet
    const a4Page = document.createElement("div");
    a4Page.className = `a4-page a4-${state.orientation}`;

    const grassSheet = document.createElement("div");
    grassSheet.className = `grass-sheet ${state.spineSide === "right" ? "spine-right" : ""}`;

    // Uncut Grass Spine
    const spine = document.createElement("div");
    spine.className = "grass-spine";
    spine.innerHTML = `
        <span class="spine-note">DO NOT CUT</span>
        <span class="spine-stop-badge"><span class="spine-stop-text"></span></span>
        <span class="spine-note">TEAR STRIPS ➔</span>
    `;
    spine.querySelector(".spine-stop-text").textContent = state.spineTitle || "PAPER GRASS";

    // Rows Container
    const rowsCol = document.createElement("div");
    const rowCount = Math.max(pageData.length, 1);
    const isDense = rowCount >= 10 || (state.orientation === "landscape" && rowCount >= 8);
    const isUltraDense = rowCount >= 13 || (state.orientation === "landscape" && rowCount >= 11);
    rowsCol.className = `grass-rows${isDense ? " is-dense" : ""}${isUltraDense ? " is-ultra-dense" : ""}`;
    rowsCol.style.gridTemplateRows = `repeat(${rowCount}, minmax(0, 1fr))`;

    pageData.forEach((strip, stripIdx) => {
        const stripEl = document.createElement("div");
        stripEl.className = "grass-strip";
        if (strip.answer) stripEl.title = `Answer: ${strip.answer}`;

        const topRow = document.createElement("div");
        topRow.className = "strip-top-row";

        const badges = document.createElement("div");
        badges.className = "strip-badges";

        if (state.showNumbers) {
            const numBadge = document.createElement("span");
            numBadge.className = "strip-num-badge";
            numBadge.textContent = `#${strip.num}`;
            badges.appendChild(numBadge);
        }

        if (state.showBadges) {
            const typeBadge = document.createElement("span");
            typeBadge.className = `strip-type-badge mode-${strip.mode}`;
            typeBadge.textContent = MODE_LABELS[strip.mode] || strip.mode;
            badges.appendChild(typeBadge);

            if (strip.hint) {
                const hintEl = document.createElement("span");
                hintEl.className = "strip-hint";
                hintEl.textContent = strip.hint;
                badges.appendChild(hintEl);
            }
        }

        const actions = document.createElement("div");
        actions.className = "strip-actions no-print flex items-center gap-1";
        actions.innerHTML = `
            <button type="button" title="Re-roll puzzle" class="p-1 rounded bg-slate-100 hover:bg-brand-blue hover:text-white border border-slate-300 transition-colors"><i data-lucide="refresh-cw" class="w-3 h-3"></i></button>
            <button type="button" title="Cycle puzzle type" class="p-1 rounded bg-slate-100 hover:bg-brand-orange border border-slate-300 transition-colors"><i data-lucide="repeat" class="w-3 h-3"></i></button>
            <button type="button" title="Delete strip" class="p-1 rounded bg-slate-100 hover:bg-brand-pink hover:text-white border border-slate-300 transition-colors"><i data-lucide="x" class="w-3 h-3"></i></button>
        `;
        const [rerollBtn, cycleBtn, delStripBtn] = actions.querySelectorAll("button");
        rerollBtn.onclick = () => rerollStrip(pageIndex, stripIdx);
        cycleBtn.onclick = () => cycleStripMode(pageIndex, stripIdx);
        delStripBtn.onclick = () => deleteStrip(pageIndex, stripIdx);

        topRow.append(badges, actions);

        const puzzleText = document.createElement("div");
        puzzleText.className = "strip-puzzle-text";
        puzzleText.contentEditable = "true";
        const effectiveSize = isUltraDense ? Math.min(state.fontSize, 1.05) : isDense ? Math.min(state.fontSize, 1.25) : state.fontSize;
        puzzleText.style.fontSize = `${effectiveSize}rem`;
        puzzleText.textContent = strip.puzzle || "";
        if (strip.missingWrong) {
            const warn = document.createElement("span");
            warn.className = "no-print px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-400 text-[10px] font-bold";
            warn.textContent = "Needs wrong option";
            badges.appendChild(warn);
        }
        puzzleText.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData("text/plain");
            document.execCommand("insertText", false, text);
        });
        puzzleText.oninput = () => {
            strip.puzzle = puzzleText.textContent;
            if (strip.mode === "fix") {
                strip.customWrong = strip.puzzle;
                strip.missingWrong = !strip.customWrong.trim();
            }
        };
        puzzleText.onblur = () => saveState();

        stripEl.append(topRow, puzzleText);

        if (state.showAnswerLine) {
            const line = document.createElement("div");
            line.className = "strip-answer-line";
            stripEl.appendChild(line);
        }

        const scissor = document.createElement("span");
        scissor.className = "grass-cut-scissor";
        scissor.textContent = "✂";
        stripEl.appendChild(scissor);

        rowsCol.appendChild(stripEl);
    });

    grassSheet.append(spine, rowsCol);
    a4Page.appendChild(grassSheet);
    wrapper.appendChild(a4Page);
    pagesContainer.appendChild(wrapper);
}

function renderAnswerKeyPage() {
    const allStrips = state.pages.flat();
    if (!allStrips.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "page-wrapper";

    const headerDiv = document.createElement("div");
    headerDiv.className = "absolute -top-10 left-0 w-full flex justify-between items-end no-print pb-2";
    headerDiv.innerHTML = `<div class="font-heading font-bold text-slate-400 text-sm uppercase tracking-widest">Teacher Answer Key</div>`;
    wrapper.appendChild(headerDiv);

    const a4Page = document.createElement("div");
    a4Page.className = `a4-page a4-${state.orientation} key-page`;

    const head = document.createElement("div");
    head.className = "border-b-4 border-brand-dark pb-3 mb-2 flex items-end justify-between";
    head.innerHTML = `
        <div>
            <h2 class="font-heading text-2xl font-bold uppercase">${escapeHtml(state.spineTitle || "Paper Grass")} — Teacher Key</h2>
            <p class="text-xs font-bold text-slate-500 mt-1">Original sentences for quick checking when students bring ripped strips.</p>
        </div>
        <span class="px-3 py-1 rounded-full border-2 border-brand-dark bg-brand-green/20 font-heading text-xs font-bold uppercase">${allStrips.length} strips</span>
    `;

    const list = document.createElement("div");
    list.className = `key-list${allStrips.length > 10 ? " two-col" : ""}`;
    allStrips.forEach((s) => {
        const row = document.createElement("div");
        row.className = "key-row";
        row.innerHTML = `
            <span class="strip-num-badge shrink-0">#${s.num}</span>
            <span class="strip-type-badge mode-${s.mode} shrink-0">${MODE_LABELS[s.mode] || s.mode}</span>
            <span class="font-bold text-sm text-brand-dark flex-1"></span>
        `;
        row.querySelector("span.flex-1").textContent = s.answer || s.puzzle || "(Blank)";
        list.appendChild(row);
    });

    a4Page.append(head, list);
    wrapper.appendChild(a4Page);
    pagesContainer.appendChild(wrapper);
}

function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Export PNG (matches Card Maker) ---
async function savePageAsImage(pageIndex, wrapperElement) {
    const a4Page = wrapperElement.querySelector(".a4-page");
    if (!a4Page || typeof html2canvas !== "function") return;

    const prevZoom = wrapperElement.style.zoom;
    wrapperElement.style.zoom = "1";
    const hideEls = a4Page.querySelectorAll(".no-print");
    hideEls.forEach((el) => { el.style.display = "none"; });

    try {
        const canvas = await html2canvas(a4Page, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const link = document.createElement("a");
        link.download = `Paper_Grass_Page_${pageIndex + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        link.remove();
    } catch (e) {
        console.error(e);
        showToast("Failed to export PNG", "error");
    } finally {
        wrapperElement.style.zoom = prevZoom;
        hideEls.forEach((el) => { el.style.display = ""; });
    }
}

async function exportToPNG() {
    const wrappers = document.querySelectorAll(".page-wrapper");
    if (!wrappers.length) return;
    for (let i = 0; i < wrappers.length; i++) {
        await savePageAsImage(i, wrappers[i]);
    }
}

// --- Bulk Import & Starter Presets ---
let bulkImportModal = null;

function initBulkImport() {
    if (!window.KlassKitBulkImport) return;
    bulkImportModal = window.KlassKitBulkImport.create({
        id: "pg-bulk-import-overlay",
        title: "Paper Grass Bulk Import",
        subtitle: "Paste sentences (one per line) or Right | Wrong pairs for Fix Error",
        accentColor: "green",
        unitLabel: "sentence",
        unitLabelPlural: "sentences",
        confirmText: "Build Strips",
        guideItems: [
            { label: "One Sentence Per Line", syntax: "I wake up at seven.", color: "green", desc: "Works for Scramble, Caesar, No Vowels, Jumble, Word Glue." },
            { label: "Fix Error Pair (Required for Fix)", syntax: "She went home. | She go home.", color: "orange", desc: "Right Sentence | Wrong Sentence — teacher enters both explicitly." },
            { label: "Comments", syntax: "# Unit 4 Past Simple", color: "blue", desc: "Lines starting with # or // are ignored." }
        ],
        placeholder: "# Past Simple Fix Error Strips\nYesterday, we went to the zoo. | Yesterday, we go to the zoo.\nShe bought a blue jacket. | She buyed a blue jacket.",
        template: "# Right | Wrong Pairs\nYesterday, we went to the park. | Yesterday, we go to the park.\nShe bought a blue jacket. | She buyed a blue jacket.",
        sample: "Yesterday, we went to the science museum. | Yesterday, we go to the science museum.\nShe bought a new blue backpack on Saturday. | She buyed a new blue backpack on Saturday.\nThey didn't watch the movie last night. | They didn't watched the movie last night.\nWe were very tired after the long hike. | We was very tired after the long hike.\nHe forgot his umbrella on the train. | He forget his umbrella on the train.\nI wrote a postcard to my grandmother. | I writed a postcard to my grandmother.",
        options: [
            { id: "append", label: "Append to current sentences", defaultChecked: false }
        ],
        parse(rawText) {
            const lines = parseSentenceLines(rawText);
            const warnings = [];
            if (state.puzzleMode === "fix") {
                const missing = lines.filter((l) => !l.includes("|")).length;
                if (missing > 0) {
                    warnings.push(`${missing} line(s) do not have a "| Wrong" part for Fix Error mode.`);
                }
            }
            return {
                items: lines,
                warnings,
                badges: lines.map((l, idx) => {
                    const parts = l.split("|").map((p) => p.trim());
                    return {
                        tag: `#${idx + 1}`,
                        label: parts[1] ? `${parts[0]} → ${parts[1]}` : parts[0],
                        tone: parts[1] ? "orange" : "green"
                    };
                })
            };
        },
        onImport(result, opts) {
            const items = result.items || [];
            if (!items.length) return false;
            if (opts && opts.append && sentencesInput.value.trim()) {
                sentencesInput.value = sentencesInput.value.trim() + "\n" + items.join("\n");
            } else {
                sentencesInput.value = items.join("\n");
            }
            generateFromSentences(true);
            showToast(`Built ${items.length} Paper Grass strips`, "success");
            return true;
        }
    });

    window.KlassKitBulkImport.mountPresets({
        container: "#grassPresetsSlot",
        url: "presets.json",
        title: "CEFR Sentence Packs",
        collapsible: true,
        getMeta: (p) => ({ icon: "scissors", label: `${(p.sentences || []).length} strips` }),
        onSelect: (preset) => {
            sentencesInput.value = (preset.sentences || []).join("\n");
            if (preset.mode) setPuzzleMode(preset.mode, false, false);
            state.spineTitle = preset.title || "PAPER GRASS";
            const spineInput = document.getElementById("spineTitleInput");
            if (spineInput) spineInput.value = state.spineTitle;
            generateFromSentences(true);
            showToast(`Loaded "${preset.title}" (${preset.level})`, "success");
        }
    });
}

function openBulkModal() {
    if (bulkImportModal) bulkImportModal.open();
}

function loadExampleSentences() {
    sentencesInput.value = EXAMPLE_SENTENCES;
    generateFromSentences(true);
    showToast("Example sentences loaded", "info");
}

function clearSentences() {
    sentencesInput.value = "";
    generateFromSentences(true);
}

async function resetTool() {
    const ok = await showConfirm("Reset Workspace", "Load the default Paper Grass example and reset settings?");
    if (!ok) return;
    state.activeId = null;
    state.puzzleMode = "mixed";
    state.caesarShift = 3;
    state.rowsPerPage = 8;
    state.orientation = "portrait";
    state.spineSide = "left";
    state.spineWidth = 22;
    state.spineTitle = "PAPER GRASS";
    state.fontSize = 1.35;
    state.showBadges = true;
    state.showNumbers = true;
    state.showAnswerLine = false;
    state.showAnswerKey = true;
    state.rawSentences = EXAMPLE_SENTENCES;
    updateActiveIndicator();
    syncControlsToState();
    generateFromSentences(true);
    renderSetsLibrary();
    showToast("Workspace reset", "success");
}

// --- Preview Zoom (matches Card Maker) ---
let currentZoomMode = localStorage.getItem("papergrass_zoom") || "fit";

function setPreviewZoom(mode) {
    currentZoomMode = String(mode);
    localStorage.setItem("papergrass_zoom", currentZoomMode);
    applyPreviewZoom();
}

function applyPreviewZoom() {
    const container = document.getElementById("pagesContainer");
    if (!container) return;
    let zoomVal = 1;
    if (currentZoomMode === "fit") {
        const availW = Math.max(320, container.clientWidth - 72);
        const pagePx = state.orientation === "landscape" ? 1122 : 794;
        zoomVal = Math.min(1, Math.max(0.35, +(availW / pagePx).toFixed(2)));
    } else {
        zoomVal = parseFloat(currentZoomMode) || 1;
    }
    document.querySelectorAll(".page-wrapper").forEach((w) => {
        w.style.zoom = String(zoomVal);
    });
    ["0.5", "0.75", "1", "fit"].forEach((k) => {
        const btn = document.getElementById(`zoom-${k}`);
        if (!btn) return;
        const active = currentZoomMode === k;
        btn.classList.toggle("bg-brand-blue", active);
        btn.classList.toggle("text-white", active);
        btn.classList.toggle("text-slate-600", !active);
        btn.classList.toggle("dark:text-slate-300", !active);
    });
}

// --- Help Modal ---
function openHelpModal() {
    const m = document.getElementById("helpModal");
    if (!m) return;
    m.classList.remove("hidden");
    m.classList.add("flex");
    if (window.lucide) lucide.createIcons();
}

function closeHelpModal() {
    const m = document.getElementById("helpModal");
    if (!m) return;
    m.classList.add("hidden");
    m.classList.remove("flex");
}

// --- Init ---
window.onload = async () => {
    initTheme();
    await requireAuth();
    document.body.classList.remove("opacity-0");
    await loadState();
    applyPreviewZoom();
    initBulkImport();

    // Debounced live rebuild when typing sentences
    let inputTimer = null;
    sentencesInput?.addEventListener("input", () => {
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => generateFromSentences(true), 280);
    });

    document.getElementById("caesarShiftSelect")?.addEventListener("change", (e) => {
        state.caesarShift = parseInt(e.target.value, 10) || 0;
        generateFromSentences(true);
    });

    if (window.lucide) lucide.createIcons();
};

window.onresize = () => {
    if (currentZoomMode === "fit") applyPreviewZoom();
};

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeHelpModal();
});

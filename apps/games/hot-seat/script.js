// --- DATA & CONFIG ---
const DEFAULT_WORDS_EASY = "Apple, Banana, Cat, Dog, Elephant, Fish, Guitar, House, Ice Cream, Jacket, Kite, Lion, Moon, Nose, Orange, Pizza, Queen, Robot, Sun, Tree, Umbrella, Violin, Water, X-ray, Yo-yo, Zebra, Ball, Car, Door, Egg, Frog, Hat, Key, Lamp, Mouse, Pen, Ring, Star, Train, Van";
const DEFAULT_WORDS_HARD = "Astronaut, Bacteria, Calendar, Dinosaur, Eclipse, Fossil, Gravity, Hurricane, Internet, Jungle, Kangaroo, Laboratory, Microscope, Nebula, Oxygen, Pyramid, Quartz, Revolution, Skeleton, Telescope, Universe, Volcano, Weather, Zoology, Architecture, Biography, Chemistry, Democracy, Economy, Geography, History, Literature, Mathematics, Philosophy, Psychology, Technology";
const CUSTOM_LISTS_KEY = 'hotseat_custom_lists';
const ACTIVE_LIST_KEY = 'hotseat_active_list_name';

let words = [];
let gameWords = [];
let customLists = [];
let currentWordIndex = 0;
let score = 0;
let passed = 0;
let timeLeft = 60;
let initialTime = 60;
let timerInterval = null;
let soundEnabled = true;
let gameMode = 'classic';
let isIntermission = false;
let pendingDefaultLoadType = null;
let activeListName = 'Default (Easy)';
let currentTheme = 'light';

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme_hot-seat');
    if (savedTheme) {
        currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
    }
    applyTheme();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme_hot-seat', currentTheme);
    applyTheme();
}

function applyTheme() {
    if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// --- AUDIO ENGINE ---
const Audio = {
    ctx: null,
    init: () => {
        if (!Audio.ctx) {
            Audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
            Tone.start();
        }
    },
    playCorrect: () => {
        if (!soundEnabled) return;
        Audio.init();
        const synth = new Tone.PolySynth(Tone.Synth, {
            volume: -6,
            oscillator: { type: "triangle" },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.1, release: 1 }
        }).toDestination();
        synth.triggerAttackRelease(["C5", "E5", "G5", "C6"], "16n");
    },
    playPass: () => {
        if (!soundEnabled) return;
        Audio.init();
        const synth = new Tone.MembraneSynth().toDestination();
        synth.volume.value = -5;
        synth.triggerAttackRelease("G2", "16n");
    },
    playTick: (pitch = "C4") => {
        if (!soundEnabled) return;
        Audio.init();
        const synth = new Tone.MembraneSynth().toDestination();
        synth.volume.value = -15;
        synth.triggerAttackRelease(pitch, "32n");
    },
    playEnd: (isWin = false) => {
        if (!soundEnabled) return;
        Audio.init();
        const synth = new Tone.PolySynth().toDestination();
        if (isWin) {
            synth.triggerAttackRelease(["C4", "E4", "G4", "C5", "E5", "G5"], "4n");
        } else {
            synth.triggerAttackRelease(["C3", "G2", "C2"], "2n");
        }
    }
};

// --- WORD LIST MANAGEMENT ---
function loadUserLists() {
    try {
        const storedLists = localStorage.getItem(CUSTOM_LISTS_KEY);
        customLists = storedLists ? JSON.parse(storedLists) : [];
    } catch (e) {
        console.error("Error loading custom lists:", e);
        customLists = [];
    }
    renderCustomListButtons();
}

function renderCustomListButtons() {
    const container = document.getElementById('custom-list-container');
    const message = document.getElementById('no-lists-message');
    container.innerHTML = '';

    if (customLists.length === 0) {
        message.classList.remove('hidden');
    } else {
        message.classList.add('hidden');
        customLists.forEach(list => {
            const button = document.createElement('div');
            button.className = 'flex items-center justify-between p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm hover:border-blue transition-colors group cursor-pointer';
            button.onclick = () => selectList(list.name, true);

            const isActive = list.name === activeListName;
            const activeClass = isActive ? 'text-brand-blue' : 'text-brand-dark dark:text-white';

            if (isActive) {
                button.classList.remove('border-slate-200', 'bg-white', 'dark:border-slate-700', 'dark:bg-slate-800');
                button.classList.add('border-brand-blue', 'bg-brand-blue/5', 'dark:bg-brand-blue/10');
            }

            button.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="p-2 rounded-lg ${isActive ? 'bg-brand-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-brand-blue group-hover:bg-brand-blue/10'}">
                        <i data-lucide="list" class="w-4 h-4"></i>
                    </div>
                    <span class="font-bold text-sm truncate ${activeClass}">${list.name}</span>
                </div>
                <button onclick="event.stopPropagation(); deleteCustomList('${list.name}')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            container.appendChild(button);
        });
    }
    lucide.createIcons();
}

function selectList(name, isCustom = false) {
    const wordInput = document.getElementById('word-input');
    let content = '';

    if (name === 'Default (Easy)') {
        content = DEFAULT_WORDS_EASY;
    } else if (name === 'Default (Hard)') {
        content = DEFAULT_WORDS_HARD;
    } else if (isCustom) {
        const list = customLists.find(l => l.name === name);
        if (list) content = list.content;
    }

    if (content) {
        wordInput.value = content;
        activeListName = name;
        document.getElementById('active-list-name').innerText = name;
        if (isCustom) document.getElementById('save-list-name').value = name;
        else document.getElementById('save-list-name').value = '';
        renderCustomListButtons();
        localStorage.setItem('hotseat_draft', content);
    }
}

function saveCurrentList() {
    const nameInput = document.getElementById('save-list-name');
    const content = document.getElementById('word-input').value.trim();
    let name = nameInput.value.trim();

    if (!content) return;
    if (!name) {
        name = `Custom List ${customLists.length + 1}`;
        nameInput.value = name;
    }

    const newList = { name: name, content: content };
    const existingIndex = customLists.findIndex(l => l.name === name);
    if (existingIndex >= 0) customLists[existingIndex] = newList;
    else customLists.push(newList);

    localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists));
    activeListName = name;
    document.getElementById('active-list-name').innerText = name;

    syncToCloud();
    renderCustomListButtons();
    parseWords(content);

    const warningEl = document.getElementById('list-warning');
    const originalContent = warningEl.innerHTML;
    const originalClass = warningEl.className;

    warningEl.className = "bg-brand-green/10 border-2 border-brand-green p-3 rounded-xl flex items-start gap-3 transition-all";
    warningEl.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-brand-green shrink-0 mt-0.5"></i><p class="text-xs md:text-sm text-brand-dark dark:text-white font-bold leading-tight">List "${name}" saved successfully!</p>`;
    lucide.createIcons();

    setTimeout(() => {
        warningEl.className = originalClass;
        warningEl.innerHTML = originalContent;
        lucide.createIcons();
    }, 3000);
}

async function deleteCustomList(name) {
    const confirmed = await showConfirmModal(`Delete list "${name}"?`, {
        title: 'Delete List?',
        confirmText: 'Delete',
        cancelText: 'Keep',
        icon: 'trash-2',
        iconColor: 'red'
    });
    if (!confirmed) return;

    customLists = customLists.filter(l => l.name !== name);
    localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists));

    if (activeListName === name) selectList('Default (Easy)');
    syncToCloud();
    renderCustomListButtons();
}

function syncToCloud() {
    if (window.syncTimeout) clearTimeout(window.syncTimeout);
    window.syncTimeout = setTimeout(() => {
        saveProgress('hot_seat', {
            customLists,
            activeListName,
            gameMode,
            timer: document.getElementById('time-input').value
        });
    }, 1500);
}

async function init() {
    await requireAuth();

    const cloudData = await loadProgress('hot_seat');
    if (cloudData) {
        customLists = cloudData.customLists || [];
        activeListName = cloudData.activeListName || 'Default (Easy)';
        gameMode = cloudData.gameMode || 'classic';
        if (cloudData.timer) document.getElementById('time-input').value = cloudData.timer;

        // Sync local storage
        localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists));
        localStorage.setItem(ACTIVE_LIST_KEY, activeListName);
        localStorage.setItem('hotseat_mode', gameMode);
        localStorage.setItem('hotseat_timer', document.getElementById('time-input').value);
    } else {
        loadUserLists();
    }
    const savedActiveName = localStorage.getItem(ACTIVE_LIST_KEY);
    const savedMode = localStorage.getItem('hotseat_mode');
    const savedTimer = localStorage.getItem('hotseat_timer');
    const savedDraft = localStorage.getItem('hotseat_draft');
    let initialContent = '';

    if (savedActiveName && customLists.some(l => l.name === savedActiveName)) {
        activeListName = savedActiveName;
        initialContent = customLists.find(l => l.name === activeListName).content;
    } else if (savedActiveName === 'Default (Hard)') {
        activeListName = 'Default (Hard)';
        initialContent = DEFAULT_WORDS_HARD;
    } else {
        activeListName = 'Default (Easy)';
        initialContent = DEFAULT_WORDS_EASY;
    }

    document.getElementById('word-input').value = savedDraft !== null ? savedDraft : initialContent;
    document.getElementById('active-list-name').innerText = activeListName;
    parseWords(savedDraft !== null ? savedDraft : initialContent);

    if (savedTimer) {
        document.getElementById('time-input').value = savedTimer;
    }

    renderCustomListButtons();
    setMode(gameMode || 'classic');
    showWordTab('presets');
    initTheme();
    lucide.createIcons();

    document.getElementById('time-input').addEventListener('input', (e) => {
        localStorage.setItem('hotseat_timer', e.target.value);
        syncToCloud();
    });
    document.getElementById('word-input').addEventListener('input', (e) => localStorage.setItem('hotseat_draft', e.target.value));
}

function showWordTab(tab) {
    const tabs = ['presets', 'custom'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.remove('tab-button-active', 'bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-brand-dark', 'dark:text-white', 'border-2');
        document.getElementById(`tab-${t}`).classList.add('text-slate-500', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        document.getElementById(`tab-${t}`).style.borderColor = 'transparent';
        document.getElementById(`content-${t}`).classList.add('hidden');
    });
    document.getElementById(`tab-${tab}`).classList.add('tab-button-active', 'bg-white', 'dark:bg-slate-700', 'border-2', 'shadow-sm', 'text-brand-dark', 'dark:text-white');
    // Ensure the border color matches the primary border variable
    document.getElementById(`tab-${tab}`).style.borderColor = 'var(--border-primary)';

    document.getElementById(`tab-${tab}`).classList.remove('text-slate-500', 'hover:bg-slate-100', 'dark:hover:bg-slate-800', 'border-transparent');
    document.getElementById(`content-${tab}`).classList.remove('hidden');
}

function setMode(mode) {
    gameMode = mode;
    localStorage.setItem('hotseat_mode', mode);
    syncToCloud();
    const btnClassic = document.getElementById('btn-mode-classic');
    const btnSingle = document.getElementById('btn-mode-single');
    const timeInput = document.getElementById('time-input');

    btnClassic.classList.remove('mode-button-active');
    btnSingle.classList.remove('mode-button-active');

    if (mode === 'classic') {
        btnClassic.classList.add('mode-button-active');
        timeInput.value = 60;
    } else {
        btnSingle.classList.add('mode-button-active');
        timeInput.value = 15;
    }
}

function parseWords(text) {
    words = text.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0);
    document.getElementById('word-count-display').innerText = words.length;
    localStorage.setItem(ACTIVE_LIST_KEY, activeListName);
}

function saveWords() {
    const content = document.getElementById('word-input').value.trim();
    parseWords(content);
    toggleWords();
}

function loadDefault(type) {
    const currentInput = document.getElementById('word-input').value.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0).join(', ');
    const lastSavedContent = words.join(', ');
    if (currentInput !== lastSavedContent) {
        pendingDefaultLoadType = type;
        toggleOverwriteModal(true);
    } else {
        confirmLoadDefault(type);
    }
}

function confirmLoadDefault(type = pendingDefaultLoadType) {
    if (!type) return;
    const name = type === 'easy' ? 'Default (Easy)' : 'Default (Hard)';
    selectList(name);
    pendingDefaultLoadType = null;
    toggleOverwriteModal(false);
}

function toggleOverwriteModal(show) {
    const modal = document.getElementById('modal-overwrite-warning');
    if (show === true) modal.classList.remove('hidden');
    else {
        modal.classList.add('hidden');
        pendingDefaultLoadType = null;
    }
}

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

async function startGame() {
    if (words.length === 0) {
        await showAlertModal("Please add some words first!", {
            title: 'Words Required',
            icon: 'alert-circle',
            iconColor: 'orange'
        });
        toggleWords();
        return;
    }
    Audio.init();
    gameWords = shuffle([...words]);
    currentWordIndex = 0;
    score = 0;
    passed = 0;
    initialTime = parseInt(document.getElementById('time-input').value) || 60;
    timeLeft = initialTime;
    isIntermission = false;

    document.getElementById('score-display').innerText = '0';
    document.getElementById('score-display-mobile').innerText = '0';

    // FIX: Ensure result view is hidden if restarting from there
    document.getElementById('view-result').classList.remove('view-visible');
    document.getElementById('view-result').classList.add('view-hidden');

    switchView('view-setup', 'view-game');
    document.getElementById('mode-badge').innerText = gameMode === 'classic' ? 'Classic Run' : 'Quick Fire';
    document.getElementById('bg-pulse').className = "absolute inset-0 z-0 transition-colors duration-200 pointer-events-none";

    document.getElementById('controls-standard').classList.remove('hidden');
    document.getElementById('controls-intermission').classList.add('hidden');
    document.getElementById('word-card').style.backgroundColor = 'var(--surface-card)';
    document.getElementById('current-word').style.color = 'var(--text-primary)';
    document.getElementById('feedback-icon').classList.add('hidden');

    showNextWord();
    startTimer();
}

function switchView(fromId, toId) {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    fromEl.classList.remove('view-visible');
    fromEl.classList.add('view-hidden');
    toEl.classList.remove('view-hidden');
    toEl.classList.add('view-visible');
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    bar.style.transition = 'none';
    bar.style.width = '100%';
    bar.style.backgroundColor = 'var(--color-green)';
    void bar.offsetWidth;
    bar.style.transition = `width 1s linear, background-color 0.5s ease`;

    timerInterval = setInterval(() => {
        if (isIntermission) return;
        timeLeft--;
        text.innerText = timeLeft + 's';
        const pct = (timeLeft / initialTime) * 100;
        bar.style.width = `${pct}%`;

        if (timeLeft <= 5) {
            bar.style.backgroundColor = 'var(--color-pink)';
            Audio.playTick("C5");
            const bg = document.getElementById('bg-pulse');
            bg.className = "absolute inset-0 z-0 bg-brand-pink/10 pointer-events-none transition-colors duration-100";
            setTimeout(() => bg.className = "absolute inset-0 z-0 bg-transparent pointer-events-none transition-colors duration-100", 250);
        } else if (pct < 50) bar.style.backgroundColor = 'var(--color-orange)';

        if (timeLeft <= 0) {
            if (gameMode === 'classic') endGame();
            else startIntermission('timeout');
        }
    }, 1000);
}

function showNextWord() {
    if (currentWordIndex >= gameWords.length) {
        gameWords = shuffle([...words]);
        currentWordIndex = 0;
    }
    const wordEl = document.getElementById('current-word');
    const cardEl = document.getElementById('word-card');
    const iconEl = document.getElementById('feedback-icon');

    cardEl.style.backgroundColor = 'var(--surface-card)';
    wordEl.style.color = 'var(--text-primary)';
    iconEl.classList.add('hidden');
    iconEl.innerHTML = '';

    cardEl.classList.remove('pop-in');
    void cardEl.offsetWidth;
    cardEl.classList.add('pop-in');

    const rot = (Math.random() * 6 - 3).toFixed(1);
    cardEl.style.transform = `rotate(${rot}deg)`;

    const word = gameWords[currentWordIndex];
    wordEl.innerText = word;

    if (word.length > 12) wordEl.style.fontSize = "clamp(2rem, 6vw, 4rem)";
    else if (word.length > 7) wordEl.style.fontSize = "clamp(3rem, 9vw, 6rem)";
    else wordEl.style.fontSize = "clamp(4rem, 12vw, 8rem)";
}

function startIntermission(result) {
    isIntermission = true;
    clearInterval(timerInterval);
    document.getElementById('controls-standard').classList.add('hidden');
    document.getElementById('controls-intermission').classList.remove('hidden');

    const cardEl = document.getElementById('word-card');
    const wordEl = document.getElementById('current-word');
    const iconEl = document.getElementById('feedback-icon');
    iconEl.classList.remove('hidden');

    if (result === 'correct') {
        cardEl.style.backgroundColor = currentTheme === 'dark' ? '#064e3b' : '#dcfce7';
        wordEl.innerText = "CORRECT!";
        wordEl.style.color = '#10b981';
        wordEl.style.fontSize = "4rem";
        iconEl.innerHTML = '<i data-lucide="check-circle" class="w-16 h-16 text-brand-green"></i>';
        Audio.playCorrect();
    } else {
        cardEl.style.backgroundColor = currentTheme === 'dark' ? '#7f1d1d' : '#fee2e2';
        wordEl.innerText = "TIME'S UP!";
        wordEl.style.color = '#ef4444';
        wordEl.style.fontSize = "4rem";
        iconEl.innerHTML = '<i data-lucide="clock" class="w-16 h-16 text-brand-pink"></i>';
        Audio.playPass();
        passed++;
        currentWordIndex++;
    }
    lucide.createIcons();
}

function resumeQuickFire() {
    isIntermission = false;
    document.getElementById('controls-standard').classList.remove('hidden');
    document.getElementById('controls-intermission').classList.add('hidden');
    timeLeft = initialTime;
    document.getElementById('timer-text').innerText = timeLeft + 's';
    showNextWord();
    startTimer();
}

function handleCorrect() {
    score++;
    currentWordIndex++;
    document.getElementById('score-display').innerText = score;
    document.getElementById('score-display-mobile').innerText = score;
    if (gameMode === 'single') startIntermission('correct');
    else {
        Audio.playCorrect();
        const bg = document.getElementById('bg-pulse');
        bg.className = "absolute inset-0 z-0 bg-brand-green/20 pointer-events-none transition-colors duration-200";
        setTimeout(() => bg.className = "absolute inset-0 z-0 bg-transparent pointer-events-none transition-colors duration-200", 200);
        showNextWord();
    }
}

function handlePass() {
    passed++;
    currentWordIndex++;
    Audio.playPass();
    const bg = document.getElementById('bg-pulse');
    bg.className = "absolute inset-0 z-0 bg-brand-orange/20 pointer-events-none transition-colors duration-200";
    setTimeout(() => bg.className = "absolute inset-0 z-0 bg-transparent pointer-events-none transition-colors duration-200", 200);
    showNextWord();
}

function endGame() {
    clearInterval(timerInterval);
    Audio.playEnd();
    switchView('view-game', 'view-result');
    animateValue("final-score", 0, score, 1000);
    animateValue("final-correct", 0, score, 1000);
    animateValue("final-passed", 0, passed, 1000);
    if (score > 0) {
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#00d063', '#1ea7fd'] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff4785', '#ff7e33'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
}

function animateValue(id, start, end, duration) {
    if (start === end) { document.getElementById(id).innerHTML = end; return; }
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    const timer = setInterval(function () {
        current += increment;
        obj.innerHTML = current;
        if (current == end) clearInterval(timer);
    }, stepTime);
}

function toggleExitModal() {
    const m = document.getElementById('modal-confirm');
    m.classList.toggle('hidden');
}

function confirmExit() {
    toggleExitModal();
    clearInterval(timerInterval);
    switchView('view-game', 'view-setup');
}

function resetGame() {
    switchView('view-result', 'view-setup');
}

function toggleWords() {
    const modal = document.getElementById('modal-words');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        selectList(activeListName);
    }
}

document.addEventListener('keydown', (e) => {
    const exitModal = document.getElementById('modal-confirm');
    const overwriteModal = document.getElementById('modal-overwrite-warning');

    if (!exitModal.classList.contains('hidden')) {
        if (e.key === 'Escape') toggleExitModal();
        else if (e.key === 'Enter') confirmExit();
        return;
    }
    if (!overwriteModal.classList.contains('hidden')) {
        if (e.key === 'Escape') toggleOverwriteModal(false);
        else if (e.key === 'Enter') confirmLoadDefault();
        return;
    }

    const wordModal = document.getElementById('modal-words');
    if (!wordModal.classList.contains('hidden')) {
        if (e.key === 'Escape') toggleWords();
        return;
    }

    if (document.getElementById('view-game').classList.contains('view-hidden')) return;

    if (isIntermission) {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            resumeQuickFire();
        }
        return;
    }

    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleCorrect();
    } else if (e.code === 'Backspace' || e.code === 'Delete' || e.key === 'x') {
        handlePass();
    } else if (e.key === 'Escape') {
        toggleExitModal();
    }
});

window.onload = init;
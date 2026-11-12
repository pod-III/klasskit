// --- Tailwind Configuration ---
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    brand: {
                        pink: '#FF6B95',
                        orange: '#FF8C42',
                        green: '#00E676',
                        blue: '#2979FF',
                        purple: '#A855F7',
                        yellow: '#FACC15',
                        red: '#EF4444',
                        slate: '#64748B',
                        dark: '#1e293b',
                        chalk: '#f8fafc',
                    }
                },
                fontFamily: {
                    sans: ['Nunito', 'sans-serif'],
                    heading: ['Fredoka', 'sans-serif'],
                },
                boxShadow: {
                    'neo': '4px 4px 0px 0px rgba(30, 41, 59, 1)',
                    'neo-sm': '2px 2px 0px 0px rgba(30, 41, 59, 1)',
                    'neo-lg': '8px 8px 0px 0px rgba(30, 41, 59, 1)',
                }
            }
        }
    };
}

// --- Quiz Block Game Logic ---
const Jeopardy = (function() {

    // --- Helper: Create fresh 2D questions array without shared object references ---
    function createQuestionsGrid(rows, cols, pointMultiplier = 100) {
        return Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, () => ({
                q: "Edit Me",
                a: "Answer",
                points: (r + 1) * pointMultiplier,
                bonus: false
            }))
        );
    }

    function createVisitedGrid(rows, cols) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => false)
        );
    }

    // --- Config & Default State ---
    function createDefaultState() {
        return {
            gameName: "Classroom Quiz",
            activeGameId: null,
            sourcePresetId: null,
            hasCustomEdits: false,
            updatedAt: 0,
            timerDuration: 15,
            pointMultiplier: 100,
            categories: ["Grammar", "Vocab", "Spelling", "Mystery", "Speaking"],
            teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
            questions: createQuestionsGrid(5, 5, 100),
            visited: createVisitedGrid(5, 5),
            scores: [0, 0, 0, 0]
        };
    }

    // Deep-normalize any loaded state so every cell is a distinct object and dimensions match
    function normalizeState(raw) {
        const fallback = createDefaultState();
        if (!raw || typeof raw !== 'object') return fallback;

        const categories = Array.isArray(raw.categories) && raw.categories.length >= 2
            ? raw.categories.map((c, i) => String(c || `Category ${i + 1}`))
            : fallback.categories.slice();

        const cols = categories.length;
        const rows = Array.isArray(raw.questions) && raw.questions.length >= 1
            ? raw.questions.length
            : 5;

        const pointMultiplier = Number(raw.pointMultiplier) > 0 ? Number(raw.pointMultiplier) : 100;
        const timerDuration = Number(raw.timerDuration) > 0 ? Number(raw.timerDuration) : 15;

        const questions = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (__, c) => {
                const src = (raw.questions && raw.questions[r] && raw.questions[r][c]) || {};
                const defaultPts = (r + 1) * pointMultiplier;
                return {
                    q: typeof src.q === 'string' ? src.q : "Edit Me",
                    a: typeof src.a === 'string' ? src.a : "Answer",
                    points: typeof src.points === 'number' && !isNaN(src.points) ? src.points : defaultPts,
                    bonus: Boolean(src.bonus)
                };
            })
        );

        const visited = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (__, c) => {
                return Boolean(raw.visited && raw.visited[r] && raw.visited[r][c]);
            })
        );

        const teams = Array.isArray(raw.teams) && raw.teams.length >= 1
            ? raw.teams.map((t, i) => String(t || `Team ${i + 1}`))
            : ["Team 1", "Team 2", "Team 3", "Team 4"];

        const scores = teams.map((_, i) => {
            const val = raw.scores && typeof raw.scores[i] === 'number' && !isNaN(raw.scores[i])
                ? raw.scores[i]
                : 0;
            return val;
        });

        return {
            gameName: typeof raw.gameName === 'string' && raw.gameName.trim() ? raw.gameName.trim() : "Classroom Quiz",
            activeGameId: raw.activeGameId || null,
            sourcePresetId: raw.sourcePresetId || null,
            hasCustomEdits: Boolean(raw.hasCustomEdits),
            updatedAt: Number(raw.updatedAt) || 0,
            timerDuration,
            pointMultiplier,
            categories,
            teams,
            questions,
            visited,
            scores
        };
    }

    // --- Storage Keys & State Initialization ---
    const STORAGE_KEY_STATE = 'eng1_jeopardy_v3';
    const STORAGE_KEY_CUSTOM = 'quiz_block_custom_games';
    const STORAGE_KEY_PRESET_EDITS = 'quiz_block_preset_edits';
    const STORAGE_KEY_THEME = 'quiz_block_theme';
    const SESSION_KEY_VIEW = 'quiz_block_active_view';
    const SESSION_KEY_EDIT = 'quiz_block_edit_mode';

    let customGamesData = [];
    let presetEditsData = {};

    try {
        const parsedCustom = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM));
        if (Array.isArray(parsedCustom)) {
            customGamesData = parsedCustom.map(g => ({
                ...g,
                state: normalizeState(g.state)
            }));
        }
    } catch (e) {
        console.warn("Failed to parse custom games from localStorage:", e);
    }

    try {
        const parsedPresetEdits = JSON.parse(localStorage.getItem(STORAGE_KEY_PRESET_EDITS));
        if (parsedPresetEdits && typeof parsedPresetEdits === 'object') {
            Object.keys(parsedPresetEdits).forEach(k => {
                presetEditsData[k] = normalizeState(parsedPresetEdits[k]);
            });
        }
    } catch (e) {
        console.warn("Failed to parse preset edits from localStorage:", e);
    }

    let state = (() => {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_STATE));
            if (parsed) {
                if (Array.isArray(parsed.customGames) && customGamesData.length === 0) {
                    customGamesData = parsed.customGames.map(g => ({
                        ...g,
                        state: normalizeState(g.state)
                    }));
                }
                if (parsed.presetEdits && typeof parsed.presetEdits === 'object') {
                    Object.keys(parsed.presetEdits).forEach(k => {
                        if (!presetEditsData[k]) {
                            presetEditsData[k] = normalizeState(parsed.presetEdits[k]);
                        }
                    });
                }
                return normalizeState(parsed);
            }
        } catch (e) {
            console.warn("Failed to parse state from localStorage:", e);
        }
        return createDefaultState();
    })();

    let isEditMode = sessionStorage.getItem(SESSION_KEY_EDIT) === 'true';
    let currentEdit = { r: 0, c: 0 };
    let currentPlayTile = { r: 0, c: 0, points: 100 };
    let hasUserInteracted = false;
    let setupConfig = {
        mode: 'new', // 'new' or 'configure'
        gameName: 'Classroom Quiz',
        cols: 5,
        rows: 5,
        teams: 4,
        timer: 15,
        points: 100
    };

    let presetsData = [];
    let timerInterval = null;
    let timerRemaining = 15;
    let toastTimeout = null;

    // --- DOM Elements ---
    const els = {
        grid: document.getElementById('game-board'),
        cats: document.getElementById('category-row'),
        scores: document.getElementById('scoreboard-container'),
        status: document.getElementById('status-indicator'),
        saveDot: document.getElementById('save-dot'),
        saveText: document.getElementById('save-text'),
        gameTitleText: document.getElementById('current-game-title-text'),
        saveCustomBtnLabel: document.getElementById('btn-save-custom-label'),
        designToolbar: document.getElementById('design-toolbar'),
        designProgressBadge: document.getElementById('design-progress-badge'),
        designColsCount: document.getElementById('design-cols-count'),
        designRowsCount: document.getElementById('design-rows-count'),
        toast: {
            wrapper: document.getElementById('toast-notification'),
            dot: document.getElementById('toast-dot'),
            text: document.getElementById('toast-text')
        },
        landing: {
            page: document.getElementById('landing-page'),
            presetsList: document.getElementById('presets-list'),
            presetsCount: document.getElementById('presets-count'),
            savedGamesList: document.getElementById('saved-games-list'),
            savedGamesCount: document.getElementById('saved-games-count'),
            resumeBanner: document.getElementById('resume-game-banner'),
            resumeTitle: document.getElementById('resume-game-title'),
            resumeMeta: document.getElementById('resume-game-meta'),
            syncBadge: document.getElementById('landing-sync-badge')
        },
        gameWrappers: [
            document.getElementById('game-header'),
            document.getElementById('game-main'),
            document.getElementById('game-footer')
        ],
        modals: {
            play: document.getElementById('modal-play'),
            edit: document.getElementById('modal-edit'),
            data: document.getElementById('modal-data'),
            system: document.getElementById('modal-system'),
            setup: document.getElementById('modal-setup')
        },
        play: {
            q: document.getElementById('view-question'),
            a: document.getElementById('view-answer'),
            text: document.getElementById('play-text'),
            answer: document.getElementById('play-answer'),
            cat: document.getElementById('play-cat'),
            points: document.getElementById('play-points'),
            bonusBadge: document.getElementById('play-bonus-badge'),
            timerBar: document.getElementById('timer-bar'),
            timerReadout: document.getElementById('play-timer-readout'),
            timerBtnLabel: document.getElementById('btn-timer-label'),
            awardPointsLabel: document.getElementById('play-award-points-label'),
            awardTeams: document.getElementById('play-award-teams')
        },
        inputs: {
            q: document.getElementById('edit-q'),
            a: document.getElementById('edit-a'),
            points: document.getElementById('edit-points'),
            bonus: document.getElementById('edit-bonus'),
            visited: document.getElementById('edit-visited'),
            meta: document.getElementById('edit-tile-meta'),
            position: document.getElementById('edit-tile-position')
        },
        setup: {
            title: document.getElementById('setup-modal-title'),
            subtitle: document.getElementById('setup-modal-subtitle'),
            nameInput: document.getElementById('setup-game-name'),
            confirmBtn: document.getElementById('setup-confirm-btn')
        },
        sys: {
            title: document.getElementById('sys-title'),
            msg: document.getElementById('sys-msg'),
            input: document.getElementById('sys-input'),
            actions: document.getElementById('sys-actions'),
            header: document.getElementById('sys-header')
        }
    };

    function safeCreateIcons() {
        if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
            try {
                window.lucide.createIcons();
            } catch (err) {
                console.warn("Lucide icon render warning:", err);
            }
        }
    }

    // --- Toast Notification ---
    function showToast(message, colorClass = 'bg-brand-green') {
        if (!els.toast.wrapper) return;
        if (toastTimeout) clearTimeout(toastTimeout);
        els.toast.text.textContent = message;
        els.toast.dot.className = `w-3 h-3 rounded-full ${colorClass} border-2 border-brand-dark`;
        els.toast.wrapper.classList.remove('hidden');
        toastTimeout = setTimeout(() => {
            els.toast.wrapper.classList.add('hidden');
        }, 2200);
    }

    function updateSaveStatusUI(statusText, dotColor = 'bg-brand-green') {
        if (els.saveText) els.saveText.textContent = statusText;
        if (els.saveDot) els.saveDot.className = `w-1.5 h-1.5 rounded-full ${dotColor} inline-block`;
    }

    // --- Core Init ---
    async function init() {
        // Restore theme preference immediately
        if (localStorage.getItem(STORAGE_KEY_THEME) === 'dark') {
            document.documentElement.classList.add('dark');
        }

        state = normalizeState(state);
        setupKeyboardShortcuts();
        safeCreateIcons();

        // Fetch presets and render UI immediately without blocking on slow cloud auth
        await fetchPresets();

        // If the user refreshed the page while on the board, keep them on the board
        if (sessionStorage.getItem(SESSION_KEY_VIEW) === 'board') {
            hideLandingPage();
        } else {
            renderLandingPage();
            showLandingPage();
        }

        // Run cloud auth & sync in the background
        try {
            if (typeof requireAuth === 'function') {
                await requireAuth();
            }
            await loadFromCloud();
            if (sessionStorage.getItem(SESSION_KEY_VIEW) === 'board') {
                updateHeaderTitleAndMeta();
                renderBoard();
                renderScoreboard();
            } else {
                renderLandingPage();
            }
        } catch (e) {
            console.warn("Cloud auth/load failed or bypassed in Sandbox mode.", e);
        }
    }

    async function fetchPresets() {
        try {
            const response = await fetch('presets.json');
            if (response.ok) {
                presetsData = await response.json();
            } else {
                console.warn('Failed to load presets.json');
            }
        } catch (error) {
            console.error('Error fetching presets:', error);
        }
    }

    // --- Cloud & Local Persistence (Fixes Local + Cloud Question Edit Saving) ---
    let syncTimeout = null;

    function mergeCustomGamesLists(localList, cloudList) {
        const map = new Map();
        (Array.isArray(cloudList) ? cloudList : []).forEach(g => {
            if (g && g.id) {
                map.set(g.id, {
                    ...g,
                    timestamp: Number(g.timestamp) || 0,
                    state: normalizeState(g.state)
                });
            }
        });
        (Array.isArray(localList) ? localList : []).forEach(g => {
            if (g && g.id) {
                const existing = map.get(g.id);
                const localTs = Number(g.timestamp) || 0;
                if (!existing || localTs >= existing.timestamp) {
                    map.set(g.id, {
                        ...g,
                        timestamp: localTs,
                        state: normalizeState(g.state)
                    });
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    function mergePresetEdits(localEdits, cloudEdits) {
        const merged = { ...(localEdits || {}) };
        if (cloudEdits && typeof cloudEdits === 'object') {
            Object.keys(cloudEdits).forEach(presetId => {
                const cloudState = normalizeState(cloudEdits[presetId]);
                const localState = merged[presetId] ? normalizeState(merged[presetId]) : null;
                if (!localState || (cloudState.updatedAt || 0) >= (localState.updatedAt || 0)) {
                    merged[presetId] = cloudState;
                }
            });
        }
        return merged;
    }

    function upsertActiveGameInCustomList() {
        if (!state.activeGameId) return;
        const idx = customGamesData.findIndex(g => g.id === state.activeGameId);
        const snapshot = normalizeState(JSON.parse(JSON.stringify(state)));
        const entry = {
            id: state.activeGameId,
            name: state.gameName || 'My Quiz Block',
            timestamp: state.updatedAt || Date.now(),
            state: snapshot
        };
        if (idx >= 0) {
            customGamesData[idx] = entry;
        } else {
            customGamesData.unshift(entry);
        }
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customGamesData));
    }

    function buildCloudPayload() {
        return {
            ...JSON.parse(JSON.stringify(state)),
            customGames: JSON.parse(JSON.stringify(customGamesData)),
            presetEdits: JSON.parse(JSON.stringify(presetEditsData))
        };
    }

    async function performCloudSave() {
        if (typeof saveProgress !== 'function') {
            updateSaveStatusUI('Saved locally', 'bg-brand-green');
            return;
        }
        try {
            updateSaveStatusUI('Syncing to cloud...', 'bg-brand-orange');
            await saveProgress('quiz_block', buildCloudPayload());
            updateSaveStatusUI('Saved locally & cloud', 'bg-brand-green');
        } catch (err) {
            console.warn("Cloud save warning (saved locally):", err);
            updateSaveStatusUI('Saved locally', 'bg-brand-green');
        }
    }

    function syncToCloud(immediate = false) {
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }
        if (immediate) {
            performCloudSave();
        } else {
            syncTimeout = setTimeout(() => {
                syncTimeout = null;
                performCloudSave();
            }, 350);
        }
    }

    async function loadFromCloud() {
        if (typeof loadProgress !== 'function') return;
        const cloudData = await loadProgress('quiz_block');
        if (!cloudData || typeof cloudData !== 'object') return;

        // 1. Merge custom saved games from cloud and local so neither is ever lost
        if (Array.isArray(cloudData.customGames)) {
            customGamesData = mergeCustomGamesLists(customGamesData, cloudData.customGames);
            localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customGamesData));
        }

        // 2. Merge preset edits from cloud and local
        if (cloudData.presetEdits && typeof cloudData.presetEdits === 'object') {
            presetEditsData = mergePresetEdits(presetEditsData, cloudData.presetEdits);
            localStorage.setItem(STORAGE_KEY_PRESET_EDITS, JSON.stringify(presetEditsData));
        }

        const cloudUpdatedAt = Number(cloudData.updatedAt) || 0;
        const localUpdatedAt = Number(state.updatedAt) || 0;
        const normalizedCloud = normalizeState(cloudData);
        const cloudStats = getBoardStats(normalizedCloud);
        const localStats = getBoardStats(state);

        // If cloud data is a legacy save (no updatedAt) that has real questions while local is blank, prefer the legacy cloud save
        const isLegacyCloudWithContent = cloudUpdatedAt === 0 && cloudStats.edited > 0 && localStats.edited === 0;
        // Replace local state with cloud state if user hasn't started editing in this tab and cloud is newer/equal (or legacy with content)
        if (!hasUserInteracted && (cloudUpdatedAt >= localUpdatedAt || isLegacyCloudWithContent)) {
            state = normalizedCloud;
            if (state.activeGameId) {
                upsertActiveGameInCustomList();
            }
            const payload = buildCloudPayload();
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(payload));
        } else if (localUpdatedAt > cloudUpdatedAt) {
            // Local has newer edits than cloud -> push local to cloud immediately
            await performCloudSave();
        }
    }

    function save(options = {}) {
        const { immediate = false, markEdited = false, toastMsg = null } = options;
        hasUserInteracted = true;
        state.updatedAt = Date.now();

        if (markEdited) {
            state.hasCustomEdits = true;

            // If user is editing a Built-in Preset, save their customized preset so re-clicking that preset keeps their edits
            if (state.sourcePresetId) {
                presetEditsData[state.sourcePresetId] = normalizeState(JSON.parse(JSON.stringify(state)));
                localStorage.setItem(STORAGE_KEY_PRESET_EDITS, JSON.stringify(presetEditsData));
            }

            // Also ensure edited quizzes appear in "My Saved Games" so edits are accessible from the personal library too
            if (!state.activeGameId) {
                state.activeGameId = state.sourcePresetId ? `preset-custom-${state.sourcePresetId}` : 'custom-' + Date.now();
                if (!state.gameName || state.gameName === 'Classroom Quiz') {
                    state.gameName = 'Custom Quiz';
                }
            }
        }

        if (state.activeGameId) {
            upsertActiveGameInCustomList();
        }

        const payload = buildCloudPayload();
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(payload));
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customGamesData));
        localStorage.setItem(STORAGE_KEY_PRESET_EDITS, JSON.stringify(presetEditsData));

        updateHeaderTitleAndMeta();
        syncToCloud(immediate);

        if (toastMsg) {
            showToast(toastMsg, 'bg-brand-green');
        }
    }

    // Flush any pending cloud save before page unload
    window.addEventListener('beforeunload', () => {
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
            if (typeof saveProgress === 'function') {
                try {
                    saveProgress('quiz_block', buildCloudPayload());
                } catch (_) {}
            }
        }
    });

    // --- Helper: Board stats ---
    function getBoardStats(targetState = state) {
        let total = 0;
        let edited = 0;
        let played = 0;
        const rows = targetState.questions.length;
        const cols = targetState.categories.length;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                total++;
                const cell = targetState.questions[r] && targetState.questions[r][c];
                if (cell && cell.q && cell.q.trim() !== '' && cell.q.trim() !== 'Edit Me') {
                    edited++;
                }
                if (targetState.visited && targetState.visited[r] && targetState.visited[r][c]) {
                    played++;
                }
            }
        }
        return { rows, cols, total, edited, played };
    }

    function updateHeaderTitleAndMeta() {
        if (els.gameTitleText) {
            els.gameTitleText.textContent = state.gameName || 'Classroom Quiz';
        }
        if (els.saveCustomBtnLabel) {
            const isLinked = state.activeGameId && customGamesData.some(g => g.id === state.activeGameId);
            els.saveCustomBtnLabel.textContent = isLinked ? 'Saved ✓' : 'Save Game';
        }
        const stats = getBoardStats(state);
        if (els.designProgressBadge) {
            els.designProgressBadge.textContent = `${stats.edited} / ${stats.total} Tiles Ready`;
        }
        if (els.designColsCount) {
            els.designColsCount.textContent = String(stats.cols);
        }
        if (els.designRowsCount) {
            els.designRowsCount.textContent = String(stats.rows);
        }
    }

    // --- Landing Page Logic ---
    function showLandingPage() {
        stopTimer();
        sessionStorage.setItem(SESSION_KEY_VIEW, 'landing');
        renderLandingPage();
        els.landing.page.classList.remove('hidden');
        els.gameWrappers.forEach(el => el.classList.add('hidden'));
        els.gameWrappers[1].classList.remove('flex');
        if (els.designToolbar) els.designToolbar.classList.add('hidden');
    }

    function hideLandingPage() {
        sessionStorage.setItem(SESSION_KEY_VIEW, 'board');
        sessionStorage.setItem(SESSION_KEY_EDIT, isEditMode ? 'true' : 'false');
        els.landing.page.classList.add('hidden');
        els.gameWrappers[0].classList.replace('hidden', 'flex'); // header
        els.gameWrappers[1].classList.replace('hidden', 'flex'); // main
        els.gameWrappers[2].classList.remove('hidden'); // footer

        updateHeaderTitleAndMeta();
        updateEditUI();
        renderBoard();
        renderScoreboard();
        safeCreateIcons();
    }

    function resumeCurrentGame(openInEditMode = false) {
        hasUserInteracted = true;
        isEditMode = Boolean(openInEditMode);
        hideLandingPage();
    }

    function renderLandingPage() {
        // 1. Resume Current Game Banner
        const stats = getBoardStats(state);
        const hasActiveSession = state.updatedAt > 0 || state.hasCustomEdits || stats.edited > 0 || stats.played > 0;
        if (els.landing.resumeBanner) {
            if (hasActiveSession) {
                els.landing.resumeBanner.classList.remove('hidden');
                els.landing.resumeTitle.textContent = state.gameName || 'Classroom Quiz';
                els.landing.resumeMeta.textContent = `${stats.cols} Categories • ${stats.edited}/${stats.total} Ready • ${stats.played} Played`;
            } else {
                els.landing.resumeBanner.classList.add('hidden');
            }
        }

        // 2. Render Built-in Presets
        els.landing.presetsList.innerHTML = '';
        if (els.landing.presetsCount) {
            els.landing.presetsCount.textContent = String(presetsData.length);
        }
        if (presetsData.length === 0) {
            els.landing.presetsList.innerHTML = '<div class="text-center text-sm font-bold text-slate-400 p-4">No presets found.</div>';
        } else {
            presetsData.forEach(preset => {
                const wrapper = document.createElement('div');
                wrapper.className = "flex gap-1.5 w-full min-w-0 items-stretch";

                const hasPresetEdits = Boolean(presetEditsData[preset.id]);
                const effectiveState = hasPresetEdits ? presetEditsData[preset.id] : preset.state;
                const catCount = effectiveState && Array.isArray(effectiveState.categories) ? effectiveState.categories.length : 5;

                const btn = document.createElement('button');
                btn.className = "btn-chunky flex-1 min-w-0 text-left p-2.5 bg-brand-chalk dark:bg-slate-700 rounded-xl border-2 border-brand-dark hover:bg-brand-blue hover:text-white transition-all group relative overflow-hidden";
                btn.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="p-2 bg-brand-blue/10 rounded-lg group-hover:bg-white/20 shrink-0">
                            <i data-lucide="layout" class="w-4 h-4 text-brand-blue group-hover:text-white"></i>
                        </div>
                        <div class="min-w-0 flex-1 overflow-hidden">
                            <div class="flex items-center justify-between gap-1.5">
                                <h4 class="font-heading font-bold text-sm text-brand-dark dark:text-brand-chalk group-hover:text-white truncate">${escapeHtml(effectiveState.gameName || preset.name)}</h4>
                                <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded ${hasPresetEdits ? 'bg-brand-pink text-white' : 'bg-brand-blue/10 text-brand-blue'} group-hover:bg-white/20 group-hover:text-white shrink-0">${hasPresetEdits ? 'Edited' : `${catCount} Cats`}</span>
                            </div>
                            <p class="text-[11px] opacity-65 group-hover:opacity-100 truncate">${escapeHtml(preset.description || 'Pre-made classroom quiz.')}</p>
                        </div>
                    </div>
                `;
                btn.onclick = () => loadPreset(preset.id, false);

                const editBtn = document.createElement('button');
                editBtn.className = "btn-chunky px-2.5 bg-white dark:bg-slate-700 text-brand-dark dark:text-white rounded-xl border-2 border-brand-dark hover:bg-brand-pink hover:text-white transition-colors flex items-center justify-center shrink-0";
                editBtn.title = "Open preset in Design Mode to customize";
                editBtn.innerHTML = `<i data-lucide="edit-3" class="w-4 h-4"></i>`;
                editBtn.onclick = () => loadPreset(preset.id, true);

                wrapper.appendChild(btn);
                wrapper.appendChild(editBtn);

                if (hasPresetEdits) {
                    const resetPresetBtn = document.createElement('button');
                    resetPresetBtn.className = "btn-chunky px-2 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl border-2 border-brand-dark hover:bg-brand-orange hover:text-white transition-colors flex items-center justify-center shrink-0";
                    resetPresetBtn.title = "Restore default preset questions";
                    resetPresetBtn.innerHTML = `<i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>`;
                    resetPresetBtn.onclick = () => resetPresetToDefault(preset.id, preset.name);
                    wrapper.appendChild(resetPresetBtn);
                }

                els.landing.presetsList.appendChild(wrapper);
            });
        }

        // 3. Render Custom Saved Games
        els.landing.savedGamesList.innerHTML = '';
        if (els.landing.savedGamesCount) {
            els.landing.savedGamesCount.textContent = String(customGamesData.length);
        }
        if (customGamesData.length === 0) {
            els.landing.savedGamesList.innerHTML = `
                <div class="text-center text-xs font-bold text-slate-400 p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                    No saved games yet.<br>Create or edit any quiz and it will be saved here automatically!
                </div>
            `;
        } else {
            customGamesData.forEach(game => {
                const wrapper = document.createElement('div');
                wrapper.className = "flex gap-1.5 w-full min-w-0 items-stretch";

                const gStats = getBoardStats(normalizeState(game.state));
                const isCurrent = state.activeGameId === game.id;

                const btn = document.createElement('button');
                btn.className = `btn-chunky flex-1 min-w-0 text-left p-2.5 ${isCurrent ? 'bg-brand-green/15 dark:bg-slate-700' : 'bg-brand-chalk dark:bg-slate-700'} rounded-xl border-2 border-brand-dark hover:bg-brand-green hover:text-white transition-all group relative overflow-hidden`;
                const dateStr = game.timestamp ? new Date(game.timestamp).toLocaleDateString() : 'Saved';
                btn.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="p-2 bg-brand-green/10 rounded-lg group-hover:bg-white/20 shrink-0">
                            <i data-lucide="play-circle" class="w-4 h-4 text-brand-green group-hover:text-white"></i>
                        </div>
                        <div class="min-w-0 flex-1 overflow-hidden">
                            <div class="flex items-center justify-between gap-1.5">
                                <h4 class="font-heading font-bold text-sm text-brand-dark dark:text-brand-chalk group-hover:text-white truncate">${escapeHtml(game.name)}</h4>
                                <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-brand-green/15 text-brand-dark dark:text-brand-chalk group-hover:bg-white/20 group-hover:text-white shrink-0">${gStats.edited}/${gStats.total} Qs</span>
                            </div>
                            <p class="text-[10px] opacity-65 group-hover:opacity-100 truncate">Updated ${dateStr} • ${gStats.cols} Categories</p>
                        </div>
                    </div>
                `;
                btn.onclick = () => loadCustomGame(game.id, false);

                const editBtn = document.createElement('button');
                editBtn.className = "btn-chunky px-2.5 bg-white dark:bg-slate-700 text-brand-dark dark:text-white rounded-xl border-2 border-brand-dark hover:bg-brand-pink hover:text-white transition-colors flex items-center justify-center shrink-0";
                editBtn.title = "Edit this game in Design Mode";
                editBtn.innerHTML = `<i data-lucide="edit-3" class="w-4 h-4"></i>`;
                editBtn.onclick = () => loadCustomGame(game.id, true);

                const delBtn = document.createElement('button');
                delBtn.className = "btn-chunky px-2.5 bg-brand-pink text-white rounded-xl border-2 border-brand-dark hover:bg-red-500 transition-colors flex items-center justify-center shrink-0";
                delBtn.title = "Delete saved game";
                delBtn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i>`;
                delBtn.onclick = () => deleteCustomGame(game.id);

                wrapper.appendChild(btn);
                wrapper.appendChild(editBtn);
                wrapper.appendChild(delBtn);
                els.landing.savedGamesList.appendChild(wrapper);
            });
        }
        safeCreateIcons();
    }

    // --- Game Setup & Board Configuration Modal ---
    function startNewBlankGame() {
        setupConfig = {
            mode: 'new',
            gameName: `Custom Quiz ${customGamesData.length + 1}`,
            cols: 5,
            rows: 5,
            teams: 4,
            timer: 15,
            points: 100
        };
        if (els.setup.title) els.setup.title.textContent = "NEW GAME SETUP";
        if (els.setup.subtitle) els.setup.subtitle.textContent = "Configure your board and build it in Design Mode";
        if (els.setup.nameInput) els.setup.nameInput.value = setupConfig.gameName;
        if (els.setup.confirmBtn) els.setup.confirmBtn.textContent = "Create & Design";

        updateSetupUI();
        els.modals.setup.classList.remove('hidden');
        setTimeout(() => els.setup.nameInput && els.setup.nameInput.select(), 60);
    }

    function openConfigureGameModal() {
        setupConfig = {
            mode: 'configure',
            gameName: state.gameName || 'Classroom Quiz',
            cols: state.categories.length,
            rows: state.questions.length,
            teams: state.teams.length,
            timer: state.timerDuration || 15,
            points: state.pointMultiplier || 100
        };
        if (els.setup.title) els.setup.title.textContent = "BOARD SETTINGS";
        if (els.setup.subtitle) els.setup.subtitle.textContent = "Resize categories, rows, teams & timer (keeps existing questions)";
        if (els.setup.nameInput) els.setup.nameInput.value = setupConfig.gameName;
        if (els.setup.confirmBtn) els.setup.confirmBtn.textContent = "Apply Settings";

        updateSetupUI();
        els.modals.setup.classList.remove('hidden');
    }

    function setSetupVal(type, val) {
        setupConfig[type] = val;
        updateSetupUI();
    }

    function updateSetupButtonGroup(selector, activeVal, activeColorClass) {
        document.querySelectorAll(selector).forEach(btn => {
            const val = parseInt(btn.dataset.val, 10);
            const isActive = val === activeVal;
            btn.classList.toggle('active', isActive);
            btn.classList.remove('bg-brand-orange', 'bg-brand-blue', 'bg-brand-pink', 'bg-brand-green', 'bg-brand-purple', 'text-white', 'bg-white', 'dark:bg-slate-700', 'dark:text-white');
            if (isActive) {
                btn.classList.add(activeColorClass, 'text-white');
            } else {
                btn.classList.add('bg-white', 'dark:bg-slate-700', 'dark:text-white');
            }
        });
    }

    function updateSetupUI() {
        updateSetupButtonGroup('.setup-btn-cols', setupConfig.cols, 'bg-brand-orange');
        updateSetupButtonGroup('.setup-btn-rows', setupConfig.rows, 'bg-brand-pink');
        updateSetupButtonGroup('.setup-btn-teams', setupConfig.teams, 'bg-brand-blue');
        updateSetupButtonGroup('.setup-btn-timer', setupConfig.timer, 'bg-brand-purple');
        updateSetupButtonGroup('.setup-btn-points', setupConfig.points, 'bg-brand-green');
    }

    function closeSetupModal() {
        els.modals.setup.classList.add('hidden');
    }

    function applyBoardResizeNonDestructive(targetCols, targetRows, targetTeams, pointStep) {
        const oldPointStep = state.pointMultiplier || 100;
        state.pointMultiplier = pointStep;

        // 1. Categories
        while (state.categories.length < targetCols) {
            state.categories.push(`Category ${state.categories.length + 1}`);
        }
        if (state.categories.length > targetCols) {
            state.categories = state.categories.slice(0, targetCols);
        }

        // 2. Questions & Visited rows/cols
        const newQuestions = Array.from({ length: targetRows }, (_, r) =>
            Array.from({ length: targetCols }, (__, c) => {
                const existing = state.questions[r] && state.questions[r][c];
                const defaultOldPts = (r + 1) * oldPointStep;
                const defaultNewPts = (r + 1) * pointStep;
                if (existing) {
                    return {
                        q: existing.q,
                        a: existing.a,
                        points: existing.points === defaultOldPts ? defaultNewPts : existing.points,
                        bonus: Boolean(existing.bonus)
                    };
                }
                return {
                    q: "Edit Me",
                    a: "Answer",
                    points: defaultNewPts,
                    bonus: false
                };
            })
        );

        const newVisited = Array.from({ length: targetRows }, (_, r) =>
            Array.from({ length: targetCols }, (__, c) => {
                return Boolean(state.visited[r] && state.visited[r][c]);
            })
        );

        state.questions = newQuestions;
        state.visited = newVisited;

        // 3. Teams & Scores
        while (state.teams.length < targetTeams) {
            const idx = state.teams.length + 1;
            state.teams.push(`Team ${idx}`);
            state.scores.push(0);
        }
        if (state.teams.length > targetTeams) {
            state.teams = state.teams.slice(0, targetTeams);
            state.scores = state.scores.slice(0, targetTeams);
        }
    }

    function confirmSetup() {
        const { mode, cols, rows, teams, timer, points } = setupConfig;
        const enteredName = (els.setup.nameInput && els.setup.nameInput.value.trim()) || "Classroom Quiz";

        if (mode === 'configure') {
            state.gameName = enteredName;
            state.timerDuration = timer;
            applyBoardResizeNonDestructive(cols, rows, teams, points);
            save({ immediate: true, markEdited: true, toastMsg: 'Board settings updated!' });
            closeSetupModal();
            renderBoard();
            renderScoreboard();
            return;
        }

        // New Blank Game mode: create distinct objects for every tile and link to My Saved Games immediately
        const newGameId = 'custom-' + Date.now();
        state = {
            gameName: enteredName,
            activeGameId: newGameId,
            sourcePresetId: null,
            hasCustomEdits: true,
            updatedAt: Date.now(),
            timerDuration: timer,
            pointMultiplier: points,
            categories: Array.from({ length: cols }, (_, i) => `Category ${i + 1}`),
            teams: Array.from({ length: teams }, (_, i) => `Team ${i + 1}`),
            questions: createQuestionsGrid(rows, cols, points),
            visited: createVisitedGrid(rows, cols),
            scores: Array.from({ length: teams }, () => 0)
        };

        // Open blank games directly in Design Mode so the teacher can immediately edit tiles
        isEditMode = true;
        save({ immediate: true, markEdited: true, toastMsg: 'New game created in Design Mode!' });
        closeSetupModal();
        hideLandingPage();
    }

    function resizeBoard(axis, delta) {
        const currentCols = state.categories.length;
        const currentRows = state.questions.length;
        let nextCols = currentCols;
        let nextRows = currentRows;

        if (axis === 'cols') {
            nextCols = Math.min(6, Math.max(2, currentCols + delta));
            if (nextCols === currentCols) return;
        } else if (axis === 'rows') {
            nextRows = Math.min(6, Math.max(3, currentRows + delta));
            if (nextRows === currentRows) return;
        }

        applyBoardResizeNonDestructive(nextCols, nextRows, state.teams.length, state.pointMultiplier || 100);
        save({ immediate: true, markEdited: true, toastMsg: `Board resized to ${nextCols}×${nextRows}` });
        renderBoard();
    }

    function renameGameTitle() {
        showSystemModal({
            type: 'prompt',
            title: 'Rename Quiz',
            message: 'Enter a title for this quiz:',
            defaultValue: state.gameName || 'Classroom Quiz',
            onConfirm: (val) => {
                if (val && val.trim()) {
                    state.gameName = val.trim();
                    save({ immediate: true, markEdited: true, toastMsg: 'Quiz title saved!' });
                }
            }
        });
    }

    function loadPreset(id, openInDesign = false) {
        const preset = presetsData.find(p => p.id === id);
        if (!preset) return;

        // If the user previously edited this preset, load their saved edits for this preset!
        if (presetEditsData[id]) {
            state = normalizeState(JSON.parse(JSON.stringify(presetEditsData[id])));
            state.sourcePresetId = id;
            state.activeGameId = state.activeGameId || `preset-custom-${id}`;
        } else {
            state = normalizeState(JSON.parse(JSON.stringify(preset.state)));
            state.gameName = preset.name || state.gameName;
            state.sourcePresetId = id;
            state.activeGameId = null;
            state.hasCustomEdits = false;
        }

        isEditMode = Boolean(openInDesign);
        save({ immediate: true });
        hideLandingPage();
    }

    function resetPresetToDefault(presetId, presetName) {
        showSystemModal({
            type: 'confirm',
            title: 'Restore Default Preset?',
            message: `Reset "${presetName}" back to its original built-in questions?`,
            onConfirm: () => {
                delete presetEditsData[presetId];
                localStorage.setItem(STORAGE_KEY_PRESET_EDITS, JSON.stringify(presetEditsData));
                syncToCloud(true);
                renderLandingPage();
                showToast('Preset restored to default!', 'bg-brand-blue');
            }
        });
    }

    function loadCustomGame(id, openInDesign = false) {
        const game = customGamesData.find(g => g.id === id);
        if (game) {
            state = normalizeState(JSON.parse(JSON.stringify(game.state)));
            state.gameName = game.name || state.gameName;
            state.activeGameId = game.id;
            state.hasCustomEdits = true;
            isEditMode = Boolean(openInDesign);
            save({ immediate: true });
            hideLandingPage();
        }
    }

    function saveToCustomGames() {
        const existingGame = state.activeGameId
            ? customGamesData.find(g => g.id === state.activeGameId)
            : null;

        showSystemModal({
            type: 'prompt',
            title: existingGame ? 'Update or Rename Saved Game' : 'Save to My Games',
            message: existingGame
                ? 'Confirm or update the name for your saved game (syncs locally & to cloud):'
                : 'Enter a name for your saved game:',
            defaultValue: state.gameName || 'My Quiz Block',
            onConfirm: (val) => {
                if (val && val.trim()) {
                    const cleanName = val.trim();
                    state.gameName = cleanName;
                    if (!state.activeGameId) {
                        state.activeGameId = 'custom-' + Date.now();
                    }
                    state.hasCustomEdits = true;
                    save({ immediate: true, markEdited: true, toastMsg: `Saved "${cleanName}"!` });
                }
            }
        });
    }

    function deleteCustomGame(id) {
        const target = customGamesData.find(g => g.id === id);
        showSystemModal({
            type: 'confirm',
            title: 'Delete Saved Game?',
            message: `Are you sure you want to delete "${target ? target.name : 'this game'}"? This cannot be undone.`,
            onConfirm: () => {
                customGamesData = customGamesData.filter(g => g.id !== id);
                if (state.activeGameId === id) {
                    state.activeGameId = null;
                }
                localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customGamesData));
                syncToCloud(true);
                renderLandingPage();
                showToast('Saved game deleted', 'bg-brand-pink');
            }
        });
    }

    // --- System Modal (Alert / Confirm / Prompt) ---
    function showSystemModal(options) {
        const { type, title, message, defaultValue, onConfirm, extraActions } = options;

        els.sys.title.textContent = title || "Notification";
        els.sys.msg.textContent = message || "";
        els.sys.input.value = defaultValue !== undefined ? defaultValue : "";
        els.sys.input.classList.add('hidden');
        els.sys.actions.innerHTML = '';

        const colors = { alert: 'bg-brand-blue', confirm: 'bg-brand-orange', prompt: 'bg-brand-pink' };
        els.sys.header.className = `p-4 border-b-4 border-brand-dark ${colors[type] || 'bg-brand-dark'}`;

        const triggerConfirm = () => {
            const val = els.sys.input.value;
            els.modals.system.classList.add('hidden');
            if (onConfirm) onConfirm(type === 'prompt' ? val : true);
        };

        if (type === 'prompt') {
            els.sys.input.classList.remove('hidden');
            els.sys.input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerConfirm();
                } else if (e.key === 'Escape') {
                    els.modals.system.classList.add('hidden');
                }
            };
            setTimeout(() => {
                els.sys.input.focus();
                els.sys.input.select();
            }, 60);
        }

        const btnCancel = document.createElement('button');
        btnCancel.className = "btn-neo px-5 py-2 rounded-xl font-bold border-2 border-brand-dark bg-slate-200 text-brand-dark font-heading";
        btnCancel.textContent = type === 'alert' ? "Close" : "Cancel";
        btnCancel.onclick = () => els.modals.system.classList.add('hidden');

        if (type !== 'alert') els.sys.actions.appendChild(btnCancel);

        if (Array.isArray(extraActions)) {
            extraActions.forEach(action => {
                const b = document.createElement('button');
                b.className = `btn-neo px-5 py-2 rounded-xl font-bold border-2 border-brand-dark font-heading ${action.className || 'bg-brand-blue text-white'}`;
                b.textContent = action.label;
                b.onclick = () => {
                    els.modals.system.classList.add('hidden');
                    if (action.onClick) action.onClick();
                };
                els.sys.actions.appendChild(b);
            });
        }

        const btnConfirm = document.createElement('button');
        btnConfirm.className = "btn-neo px-5 py-2 rounded-xl font-bold border-2 border-brand-dark bg-brand-green text-white font-heading";
        btnConfirm.textContent = options.confirmLabel || "Confirm";
        btnConfirm.onclick = triggerConfirm;

        els.sys.actions.appendChild(btnConfirm);
        els.modals.system.classList.remove('hidden');
    }

    // --- Escape HTML helper for safe rendering ---
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // --- Render Logic ---
    function renderBoard() {
        els.cats.innerHTML = '';
        els.grid.innerHTML = '';

        const cols = state.categories.length;
        const rows = state.questions.length;

        const gridStyle = `grid-template-columns: repeat(${cols}, minmax(0, 1fr));`;
        els.cats.style = gridStyle;
        els.grid.style = gridStyle + ` grid-template-rows: repeat(${rows}, minmax(0, 1fr));`;

        // Categories
        const catColors = ['bg-brand-pink', 'bg-brand-orange', 'bg-brand-green', 'bg-brand-blue', 'bg-brand-purple', 'bg-brand-yellow', 'bg-brand-red', 'bg-brand-slate'];
        state.categories.forEach((cat, idx) => {
            const div = document.createElement('div');
            div.className = `${catColors[idx % catColors.length]} text-white border-4 border-brand-dark rounded-xl min-h-[46px] sm:min-h-[54px] px-2 py-1.5 flex items-center justify-center shadow-neo relative select-none transition-transform ${isEditMode ? 'cursor-pointer hover:scale-[1.01] active:scale-95' : ''}`;
            div.innerHTML = `<span class="font-heading font-bold uppercase text-center leading-[1.1] drop-shadow-md tracking-wide line-clamp-2" style="font-size: clamp(0.8rem, 1.6vw, 1.2rem);">${escapeHtml(cat)}</span>`;

            if (isEditMode) {
                div.innerHTML += `<div class="absolute -top-1.5 -right-1.5 bg-white text-brand-dark border-2 border-brand-dark rounded-full p-1 shadow-neo-sm"><i data-lucide="edit-2" class="w-3 h-3"></i></div>`;
                div.onclick = () => {
                    showSystemModal({
                        type: 'prompt',
                        title: 'Rename Category',
                        message: `Enter new name for "${cat}":`,
                        defaultValue: cat,
                        onConfirm: (val) => {
                            if (val && val.trim()) {
                                state.categories[idx] = val.trim();
                                save({ immediate: true, markEdited: true, toastMsg: 'Category renamed!' });
                                renderBoard();
                            }
                        }
                    });
                };
            }
            els.cats.appendChild(div);
        });

        // Grid Cells
        const pointMult = state.pointMultiplier || 100;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = state.questions[r][c];
                const visited = state.visited[r][c];
                const points = typeof cell.points === 'number' && !isNaN(cell.points) ? cell.points : (r + 1) * pointMult;
                const isPlaceholder = !cell.q || cell.q.trim() === '' || cell.q.trim() === 'Edit Me';

                const btn = document.createElement('button');
                let cls = "tile-card w-full h-full min-h-[46px] rounded-xl border-4 border-brand-dark flex flex-col items-center justify-center font-heading font-bold shadow-neo btn-chunky transition-all relative overflow-hidden px-2.5 py-1.5 ";

                if (visited && !isEditMode) {
                    cls += "bg-slate-200 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none border-slate-300 dark:border-slate-700 opacity-60";
                    btn.disabled = true;
                } else {
                    cls += "bg-gradient-to-br from-white to-brand-chalk text-brand-blue hover:z-10 dark:from-slate-800 dark:to-slate-900 dark:text-brand-blue";
                }

                if (isEditMode && isPlaceholder) {
                    cls += " bg-red-50/90 dark:bg-red-950/30 border-dashed border-brand-pink";
                }

                btn.className = cls;

                if (isEditMode) {
                    const statusBadge = isPlaceholder
                        ? `<span class="text-[9px] font-sans font-black uppercase px-1.5 py-0.5 rounded bg-brand-pink/20 text-brand-pink border border-brand-pink/40">Needs Edit</span>`
                        : `<span class="text-[9px] font-sans font-black uppercase px-1.5 py-0.5 rounded bg-brand-green/20 text-emerald-700 dark:text-brand-green border border-brand-green/40">Ready ✓</span>`;

                    const bonusIcon = cell.bonus
                        ? `<span class="text-[10px] bg-brand-yellow text-brand-dark font-black px-1.5 py-0.5 rounded border border-brand-dark" title="Bonus Tile">★</span>`
                        : '';

                    const visitedBadge = visited
                        ? `<span class="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black px-1.5 py-0.5 rounded">Played</span>`
                        : '';

                    btn.innerHTML = `
                        <div class="w-full flex items-center justify-between gap-1 z-10">
                            <span class="font-heading font-black text-xs sm:text-sm text-brand-blue dark:text-brand-blue leading-none">$${points}</span>
                            <div class="flex items-center gap-1">
                                ${bonusIcon}
                                ${visitedBadge}
                                ${statusBadge}
                            </div>
                        </div>
                        <div class="w-full text-left z-10 flex-1 flex flex-col justify-center min-h-0 mt-0.5">
                            <p class="font-sans font-bold text-xs text-brand-dark dark:text-white truncate leading-tight">${escapeHtml(isPlaceholder ? 'Click to write question...' : cell.q)}</p>
                            <p class="font-sans font-semibold text-[10px] text-slate-400 dark:text-slate-400 truncate leading-tight">A: ${escapeHtml(cell.a || '...')}</p>
                        </div>
                    `;
                } else {
                    btn.innerHTML = `<span class="relative z-10 leading-none" style="font-size: clamp(1.25rem, min(3.4vw, 4.2vh), 2.75rem);">$${points}</span>`;
                    if (!visited) {
                        btn.innerHTML += `<div class="absolute -bottom-4 -right-4 w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full z-0"></div>`;
                    }
                }

                btn.onclick = () => handleTileClick(r, c);
                els.grid.appendChild(btn);
            }
        }
        updateHeaderTitleAndMeta();
        safeCreateIcons();
    }

    // Complete static Tailwind class map so CDN JIT never drops dynamic team colors
    const TEAM_COLOR_STYLES = [
        { bar: 'bg-brand-pink', textHover: 'hover:text-brand-pink', badge: 'bg-brand-pink' },
        { bar: 'bg-brand-orange', textHover: 'hover:text-brand-orange', badge: 'bg-brand-orange' },
        { bar: 'bg-brand-blue', textHover: 'hover:text-brand-blue', badge: 'bg-brand-blue' },
        { bar: 'bg-brand-green', textHover: 'hover:text-brand-green', badge: 'bg-brand-green' },
        { bar: 'bg-brand-purple', textHover: 'hover:text-brand-purple', badge: 'bg-brand-purple' },
        { bar: 'bg-brand-yellow', textHover: 'hover:text-brand-yellow', badge: 'bg-brand-yellow' },
        { bar: 'bg-brand-red', textHover: 'hover:text-brand-red', badge: 'bg-brand-red' },
        { bar: 'bg-brand-slate', textHover: 'hover:text-brand-slate', badge: 'bg-brand-slate' }
    ];

    function renderScoreboard() {
        els.scores.innerHTML = '';
        const teamCount = state.scores.length;
        const step = state.pointMultiplier || 100;
        const maxScore = Math.max(...state.scores);
        const hasLeader = maxScore > 0;

        if (teamCount <= 2) {
            els.scores.className = "grid grid-cols-2 gap-2 max-w-2xl mx-auto";
        } else if (teamCount === 3) {
            els.scores.className = "grid grid-cols-3 gap-2 max-w-4xl mx-auto";
        } else if (teamCount <= 4) {
            els.scores.className = "grid grid-cols-2 md:grid-cols-4 gap-2";
        } else {
            els.scores.className = "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2";
        }

        state.scores.forEach((score, idx) => {
            const style = TEAM_COLOR_STYLES[idx % TEAM_COLOR_STYLES.length];
            const teamName = state.teams[idx] || `Team ${idx + 1}`;
            const isLeader = hasLeader && score === maxScore;

            const div = document.createElement('div');
            div.className = "bg-white dark:bg-slate-800 border-[3px] border-brand-dark shadow-neo-sm rounded-xl px-2.5 py-1.5 flex flex-col items-center relative overflow-hidden transition-all group";

            div.innerHTML = `
                <div class="absolute top-0 left-0 w-full h-1.5 ${style.bar} border-b-2 border-brand-dark"></div>
                
                <div class="flex items-center justify-center gap-1 mt-1 max-w-full z-10">
                    ${isLeader ? '<span class="text-xs" title="Current Leader">👑</span>' : ''}
                    <button onclick="Jeopardy.renameTeam(${idx})" class="font-heading font-bold text-xs sm:text-sm dark:text-white ${style.textHover} hover:underline decoration-2 underline-offset-2 truncate max-w-full opacity-90" title="Click to rename team">
                        ${escapeHtml(teamName)}
                    </button>
                </div>
                
                <div class="flex items-center justify-between w-full mt-1 z-10 px-0.5">
                    <button onclick="Jeopardy.modScore(${idx}, -${step})" class="btn-chunky w-7 h-7 shrink-0 rounded-md bg-brand-pink text-white border-2 border-brand-dark font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center hover:bg-pink-400 leading-none" title="Subtract ${step}">-</button>
                    
                    <button onclick="Jeopardy.editScore(${idx})" class="text-lg sm:text-xl font-black font-sans text-brand-dark dark:text-brand-chalk hover:scale-110 transition-transform cursor-pointer leading-none px-1.5" title="Click to set score manually">
                        ${score}
                    </button>
                    
                    <button onclick="Jeopardy.modScore(${idx}, ${step})" class="btn-chunky w-7 h-7 shrink-0 rounded-md bg-brand-green text-white border-2 border-brand-dark font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center hover:bg-green-400 leading-none" title="Add ${step}">+</button>
                </div>
            `;
            els.scores.appendChild(div);
        });
    }

    // --- Actions ---
    function handleTileClick(r, c) {
        if (isEditMode) {
            openEditModalForTile(r, c);
        } else {
            const cell = state.questions[r][c];
            const pointMult = state.pointMultiplier || 100;
            const points = typeof cell.points === 'number' && !isNaN(cell.points) ? cell.points : (r + 1) * pointMult;
            state.visited[r][c] = true;
            currentPlayTile = { r, c, points };
            save({ immediate: false });
            renderBoard();
            openPlayModal(cell, state.categories[c], points);
        }
    }

    function openEditModalForTile(r, c) {
        currentEdit = { r, c };
        const cell = state.questions[r][c];
        const pointMult = state.pointMultiplier || 100;
        const points = typeof cell.points === 'number' && !isNaN(cell.points) ? cell.points : (r + 1) * pointMult;

        els.inputs.q.value = cell.q === "Edit Me" ? "" : cell.q;
        els.inputs.a.value = cell.a === "Answer" ? "" : cell.a;
        if (els.inputs.points) els.inputs.points.value = points;
        if (els.inputs.bonus) els.inputs.bonus.checked = Boolean(cell.bonus);
        if (els.inputs.visited) els.inputs.visited.checked = Boolean(state.visited[r][c]);

        if (els.inputs.meta) {
            els.inputs.meta.textContent = `${state.categories[c] || `Category ${c + 1}`} • $${points}`;
        }
        if (els.inputs.position) {
            const total = state.questions.length * state.categories.length;
            const idx = r * state.categories.length + c + 1;
            els.inputs.position.textContent = `Tile ${idx} of ${total} (R${r + 1}, C${c + 1})`;
        }

        els.modals.edit.classList.remove('hidden');
        setTimeout(() => els.inputs.q.focus(), 50);
    }

    function commitCurrentEditFields() {
        const { r, c } = currentEdit;
        const pointMult = state.pointMultiplier || 100;
        const defaultPts = (r + 1) * pointMult;
        const rawQ = els.inputs.q.value.trim();
        const rawA = els.inputs.a.value.trim();
        const rawPts = els.inputs.points ? parseInt(els.inputs.points.value, 10) : defaultPts;

        // Assign a brand-new object so no shared reference can ever exist
        state.questions[r][c] = {
            q: rawQ || "Edit Me",
            a: rawA || "Answer",
            points: !isNaN(rawPts) && rawPts >= 0 ? rawPts : defaultPts,
            bonus: Boolean(els.inputs.bonus && els.inputs.bonus.checked)
        };

        if (els.inputs.visited) {
            state.visited[r][c] = Boolean(els.inputs.visited.checked);
        }
    }

    function saveEdit() {
        commitCurrentEditFields();
        save({ immediate: true, markEdited: true, toastMsg: 'Question saved locally & synced!' });
        renderBoard();
        closeEditModal();
    }

    function navigateEditTile(direction) {
        commitCurrentEditFields();
        save({ immediate: true, markEdited: true, toastMsg: 'Saved tile!' });
        renderBoard();

        const rows = state.questions.length;
        const cols = state.categories.length;
        const total = rows * cols;
        const currentFlat = currentEdit.r * cols + currentEdit.c;
        const nextFlat = (currentFlat + direction + total) % total;
        const nextR = Math.floor(nextFlat / cols);
        const nextC = nextFlat % cols;

        openEditModalForTile(nextR, nextC);
    }

    function closeEditModal() {
        els.modals.edit.classList.add('hidden');
    }

    function renameTeam(idx) {
        showSystemModal({
            type: 'prompt',
            title: 'Rename Team',
            message: `Enter name for Team ${idx + 1}:`,
            defaultValue: state.teams[idx],
            onConfirm: (val) => {
                if (val && val.trim()) {
                    state.teams[idx] = val.trim();
                    save({ immediate: true, toastMsg: 'Team renamed!' });
                    renderScoreboard();
                }
            }
        });
    }

    function editScore(idx) {
        showSystemModal({
            type: 'prompt',
            title: 'Adjust Score',
            message: `Manually set score for ${state.teams[idx]}:`,
            defaultValue: state.scores[idx],
            onConfirm: (val) => {
                if (val !== null && val !== '' && !isNaN(val)) {
                    state.scores[idx] = parseInt(val, 10);
                    save({ immediate: true });
                    renderScoreboard();
                }
            }
        });
    }

    function modScore(idx, val) {
        state.scores[idx] += val;
        save({ immediate: false });
        renderScoreboard();
        renderPlayAwardBar();
    }

    // --- Play Mode ---
    function openPlayModal(data, cat, points) {
        els.play.q.classList.remove('hidden');
        els.play.a.classList.add('hidden');
        els.play.a.classList.remove('flex');

        els.play.cat.textContent = cat;
        els.play.points.textContent = `$${points}`;
        els.play.text.textContent = data.q;
        els.play.answer.textContent = data.a;

        if (els.play.bonusBadge) {
            els.play.bonusBadge.classList.toggle('hidden', !data.bonus);
        }

        stopTimer();
        renderPlayAwardBar();
        els.modals.play.classList.remove('hidden');
        safeCreateIcons();
    }

    function renderPlayAwardBar() {
        if (!els.play.awardTeams) return;
        const pts = currentPlayTile.points || 100;
        if (els.play.awardPointsLabel) {
            els.play.awardPointsLabel.textContent = `$${pts}`;
        }
        els.play.awardTeams.innerHTML = '';

        state.teams.forEach((teamName, idx) => {
            const score = state.scores[idx] || 0;
            const card = document.createElement('div');
            card.className = "bg-slate-50 dark:bg-slate-700/80 border-2 border-brand-dark rounded-xl p-2 flex flex-col items-center gap-1";
            card.innerHTML = `
                <div class="flex items-center justify-between w-full px-1">
                    <span class="font-heading font-bold text-xs text-brand-dark dark:text-white truncate">${escapeHtml(teamName)}</span>
                    <span class="font-mono font-black text-xs text-brand-blue dark:text-brand-chalk">${score}</span>
                </div>
                <div class="flex gap-1.5 w-full">
                    <button onclick="Jeopardy.modScore(${idx}, -${pts})" class="btn-chunky flex-1 py-1 bg-brand-pink text-white rounded-lg border-2 border-brand-dark font-heading font-bold text-xs">
                        -${pts}
                    </button>
                    <button onclick="Jeopardy.modScore(${idx}, ${pts})" class="btn-chunky flex-1 py-1 bg-brand-green text-white rounded-lg border-2 border-brand-dark font-heading font-bold text-xs">
                        +${pts}
                    </button>
                </div>
            `;
            els.play.awardTeams.appendChild(card);
        });
    }

    function startTimer() {
        const duration = Number(state.timerDuration) > 0 ? Number(state.timerDuration) : 15;
        stopTimer();

        timerRemaining = duration;
        if (els.play.timerReadout) {
            els.play.timerReadout.textContent = `${timerRemaining}s`;
            els.play.timerReadout.classList.remove('bg-brand-red', 'text-white', 'timer-urgent');
        }
        if (els.play.timerBtnLabel) {
            els.play.timerBtnLabel.textContent = "Restart Timer";
        }

        els.play.timerBar.style.transition = 'none';
        els.play.timerBar.style.width = '100%';
        els.play.timerBar.className = 'h-full bg-brand-orange w-full';
        void els.play.timerBar.offsetWidth;

        els.play.timerBar.style.transition = `width ${duration}s linear`;
        els.play.timerBar.style.width = '0%';

        timerInterval = setInterval(() => {
            timerRemaining -= 1;
            if (timerRemaining > 0) {
                if (els.play.timerReadout) {
                    els.play.timerReadout.textContent = `${timerRemaining}s`;
                    if (timerRemaining <= 5) {
                        els.play.timerReadout.classList.add('bg-brand-red', 'text-white', 'timer-urgent');
                        els.play.timerBar.classList.replace('bg-brand-orange', 'bg-brand-red');
                    }
                }
            } else {
                clearInterval(timerInterval);
                timerInterval = null;
                if (els.play.timerReadout) {
                    els.play.timerReadout.textContent = "TIME'S UP!";
                    els.play.timerReadout.classList.add('bg-brand-red', 'text-white', 'timer-urgent');
                }
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const duration = Number(state.timerDuration) > 0 ? Number(state.timerDuration) : 15;
        timerRemaining = duration;
        if (els.play.timerBar) {
            els.play.timerBar.style.transition = 'none';
            els.play.timerBar.style.width = '100%';
            els.play.timerBar.className = 'h-full bg-brand-orange w-full';
        }
        if (els.play.timerReadout) {
            els.play.timerReadout.textContent = `${duration}s`;
            els.play.timerReadout.classList.remove('bg-brand-red', 'text-white', 'timer-urgent');
        }
        if (els.play.timerBtnLabel) {
            els.play.timerBtnLabel.textContent = "Start Timer";
        }
    }

    function revealAnswer() {
        stopTimer();
        els.play.q.classList.add('hidden');
        els.play.a.classList.remove('hidden');
        els.play.a.classList.add('flex');
        renderPlayAwardBar();
        safeCreateIcons();
    }

    function showQuestionView() {
        els.play.a.classList.add('hidden');
        els.play.a.classList.remove('flex');
        els.play.q.classList.remove('hidden');
    }

    function closePlayModal() {
        stopTimer();
        els.modals.play.classList.add('hidden');
    }

    // --- Edit Mode Toggle ---
    function toggleEditMode() {
        isEditMode = !isEditMode;
        sessionStorage.setItem(SESSION_KEY_EDIT, isEditMode ? 'true' : 'false');
        updateEditUI();
        renderBoard();
    }

    function updateEditUI() {
        const track = document.getElementById('toggle-track');
        const dot = document.getElementById('toggle-dot');
        const btn = document.getElementById('btn-edit-toggle');

        if (isEditMode) {
            document.body.classList.add('edit-active');
            track.classList.replace('bg-slate-300', 'bg-brand-green');
            dot.style.transform = 'translateX(100%)';
            els.status.textContent = "DESIGN MODE ACTIVE";
            els.status.className = "text-[10px] font-bold text-brand-pink uppercase tracking-widest animate-pulse";
            btn.classList.add('bg-slate-100');
            if (els.designToolbar) els.designToolbar.classList.remove('hidden');
        } else {
            document.body.classList.remove('edit-active');
            track.classList.replace('bg-brand-green', 'bg-slate-300');
            dot.style.transform = 'translateX(0)';
            els.status.textContent = "Ready to Play";
            els.status.className = "text-[10px] font-bold text-brand-green uppercase tracking-widest";
            btn.classList.remove('bg-slate-100');
            if (els.designToolbar) els.designToolbar.classList.add('hidden');
        }
    }

    // --- Export / Import JSON ---
    function exportData() {
        const exportObj = normalizeState(state);
        document.getElementById('data-json').value = JSON.stringify(exportObj, null, 2);
        els.modals.data.classList.remove('hidden');
    }

    function copyDataJson() {
        const textarea = document.getElementById('data-json');
        if (!textarea) return;
        textarea.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textarea.value).then(() => {
                showToast('Copied JSON to clipboard!', 'bg-brand-blue');
            });
        } else {
            document.execCommand('copy');
            showToast('Copied JSON to clipboard!', 'bg-brand-blue');
        }
    }

    function importData() {
        try {
            const raw = JSON.parse(document.getElementById('data-json').value);
            if (raw && Array.isArray(raw.questions) && Array.isArray(raw.categories)) {
                state = normalizeState(raw);
                state.activeGameId = 'custom-' + Date.now();
                state.sourcePresetId = null;
                state.hasCustomEdits = true;
                save({ immediate: true, markEdited: true, toastMsg: 'JSON imported & saved!' });
                closeDataModal();
                hideLandingPage();
            } else {
                throw new Error("Missing questions or categories");
            }
        } catch (e) {
            showSystemModal({ type: 'alert', title: 'Error', message: 'Invalid Game Data JSON. Please check the format and try again.' });
        }
    }

    function closeDataModal() {
        els.modals.data.classList.add('hidden');
    }

    function resetBoardState() {
        showSystemModal({
            type: 'confirm',
            title: 'Reset Game State',
            message: "Choose whether to reset visited tiles only, or reset both visited tiles and team scores:",
            confirmLabel: "Reset Tiles Only",
            extraActions: [
                {
                    label: "Reset Tiles + Scores",
                    className: "bg-brand-pink text-white",
                    onClick: () => {
                        state.visited = createVisitedGrid(state.questions.length, state.categories.length);
                        state.scores = state.scores.map(() => 0);
                        save({ immediate: true, toastMsg: 'Board & scores reset!' });
                        renderBoard();
                        renderScoreboard();
                    }
                }
            ],
            onConfirm: () => {
                state.visited = createVisitedGrid(state.questions.length, state.categories.length);
                save({ immediate: true, toastMsg: 'All tiles marked unplayed!' });
                renderBoard();
            }
        });
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem(STORAGE_KEY_THEME, isDark ? 'dark' : 'light');
    }

    // --- Keyboard Shortcuts ---
    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (!els.modals.edit.classList.contains('hidden')) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeEditModal();
                }
                return;
            }

            if (!els.modals.play.classList.contains('hidden')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closePlayModal();
                } else if (e.key === ' ' && document.activeElement.tagName !== 'BUTTON') {
                    e.preventDefault();
                    if (!els.play.q.classList.contains('hidden')) {
                        startTimer();
                    }
                }
                return;
            }

            if (!els.modals.setup.classList.contains('hidden') && e.key === 'Escape') {
                closeSetupModal();
            }
            if (!els.modals.data.classList.contains('hidden') && e.key === 'Escape') {
                closeDataModal();
            }
        });
    }

    return {
        init,
        toggleEditMode,
        handleTileClick,
        renameTeam,
        editScore,
        modScore,
        saveEdit,
        navigateEditTile,
        closeEditModal,
        openPlayModal,
        closePlayModal,
        revealAnswer,
        showQuestionView,
        startTimer,
        exportData,
        copyDataJson,
        importData,
        closeDataModal,
        resetBoardState,
        toggleTheme,
        showLandingPage,
        resumeCurrentGame,
        startNewBlankGame,
        openConfigureGameModal,
        resizeBoard,
        renameGameTitle,
        saveToCustomGames,
        setSetupVal,
        confirmSetup,
        closeSetupModal
    };
})();

// Initialize Game
Jeopardy.init();
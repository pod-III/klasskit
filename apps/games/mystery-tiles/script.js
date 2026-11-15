(() => {
    'use strict';

    /* =========================================================================
       CONSTANTS & DESIGN TOKENS
    ========================================================================= */
    const TOOL_KEY = 'mystery_tiles';
    const THEME_STORAGE_KEY = 'theme_mystery-tiles';
    const SOUND_STORAGE_KEY = 'sound_mystery-tiles';
    const DRAFT_STORAGE_KEY = 'klasskit_mystery_tiles_draft_v1';
    const SETS_STORAGE_KEY = 'klasskit_mystery_tiles_sets_v1';
    const MAX_UNDO_HISTORY = 15;

    const TEAM_PALETTE = [
        { name: 'Pink',   bg: '#ff4785', text: '#ffffff', border: '#be185d' },
        { name: 'Orange', bg: '#ff7e33', text: '#0f172a', border: '#c2410c' },
        { name: 'Green',  bg: '#00d063', text: '#0f172a', border: '#047857' },
        { name: 'Blue',   bg: '#1ea7fd', text: '#ffffff', border: '#0369a1' },
        { name: 'Purple', bg: '#a855f7', text: '#ffffff', border: '#7e22ce' },
        { name: 'Yellow', bg: '#facc15', text: '#0f172a', border: '#a16207' }
    ];

    const TILE_COLOR_CLASSES = [
        'bg-pink text-white',
        'bg-orange text-dark',
        'bg-green text-dark',
        'bg-blue text-white'
    ];

    const TRAPS = [
        { id: 'lose', icon: 'bomb',     name: 'Bomb!',      short: 'Bomb (-P)',   desc: P => `Lose ${P} points (min 0).` },
        { id: 'half', icon: 'scissors', name: 'Snip snip!', short: 'Snip (½)',    desc: () => 'Lose half of your points!' },
        { id: 'skip', icon: 'pause',    name: 'Frozen!',    short: 'Frozen',      desc: () => 'Skip your next turn.' },
        { id: 'give', icon: 'send',     name: 'Generous!',  short: 'Give P',      desc: P => `Give up to ${P} points to a chosen team.`, target: true }
    ];

    const GIFTS = [
        { id: 'bonus',  icon: 'star',             name: 'Bonus!',      short: 'Bonus (2×P)', desc: P => `Gain ${P * 2} bonus points!` },
        { id: 'double', icon: 'zap',              name: 'Double up!',  short: 'Double (×2)', desc: () => 'Your score is doubled!' },
        { id: 'steal',  icon: 'hand',             name: 'Sneaky!',     short: 'Steal P',     desc: P => `Steal up to ${P} points from a team.`, target: true },
        { id: 'swap',   icon: 'arrow-left-right', name: 'Switcheroo!', short: 'Swap Scores', desc: () => 'Swap total scores with a chosen team.', target: true },
        { id: 'extra',  icon: 'repeat',           name: 'Go again!',   short: 'Go Again',    desc: () => 'Take an extra turn right away!' }
    ];

    const FALLBACK_DEFAULT_Q = [
        { q: 'What is the past tense of "go"?', a: 'went' },
        { q: 'What is the opposite of "expensive"?', a: 'cheap' },
        { q: 'Complete: She ___ (not like) pizza.', a: 'doesn’t like' },
        { q: 'Spell the place where you borrow books.', a: 'library' },
        { q: 'What is the plural of "child"?', a: 'children' },
        { q: 'What do you say when you meet someone for the first time?', a: 'Nice to meet you!' },
        { q: 'Choose: There is / There are ___ two cats.', a: 'There are' },
        { q: 'Unscramble: school / to / goes / she', a: 'She goes to school.' },
        { q: 'What is the past participle of "eat"?', a: 'eaten' },
        { q: 'Complete: I have lived here ___ 2020.', a: 'since' },
        { q: 'Name three red fruits.', a: 'apple, strawberry, cherry...' },
        { q: 'Make a sentence with "because".', a: '(any correct sentence)' }
    ];

    /* =========================================================================
       SOUND ENGINE (Web Audio Synth)
    ========================================================================= */
    const SoundEngine = (() => {
        let ctx = null;
        let muted = localStorage.getItem(SOUND_STORAGE_KEY) === 'muted';

        function getCtx() {
            if (muted) return null;
            if (!ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) ctx = new AudioCtx();
            }
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            return ctx;
        }

        function tone(freq, duration, type = 'sine', gainVal = 0.14, delay = 0) {
            const ac = getCtx();
            if (!ac) return;
            const now = ac.currentTime + delay;
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.start(now);
            osc.stop(now + duration + 0.02);
        }

        return {
            isMuted: () => muted,
            toggleMute: () => {
                muted = !muted;
                localStorage.setItem(SOUND_STORAGE_KEY, muted ? 'muted' : 'active');
                return muted;
            },
            click: () => tone(540, 0.06, 'triangle', 0.1),
            openQuestion: () => {
                tone(440, 0.09, 'triangle', 0.12, 0);
                tone(587.33, 0.12, 'triangle', 0.12, 0.06);
            },
            correct: () => {
                tone(523.25, 0.11, 'triangle', 0.16, 0);
                tone(659.25, 0.11, 'triangle', 0.16, 0.08);
                tone(783.99, 0.22, 'triangle', 0.18, 0.16);
            },
            wrong: () => {
                tone(260, 0.16, 'sawtooth', 0.09, 0);
                tone(195, 0.26, 'sawtooth', 0.09, 0.13);
            },
            trap: () => {
                tone(320, 0.12, 'sawtooth', 0.1, 0);
                tone(220, 0.15, 'sawtooth', 0.11, 0.1);
                tone(130, 0.3, 'sawtooth', 0.12, 0.22);
            },
            gift: () => {
                [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                    tone(f, 0.16, 'sine', 0.15, idx * 0.07);
                });
            },
            tick: () => tone(880, 0.04, 'square', 0.05),
            timeUp: () => {
                tone(440, 0.14, 'square', 0.1, 0);
                tone(330, 0.25, 'square', 0.1, 0.15);
            },
            win: () => {
                const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
                const times = [0, 0.1, 0.2, 0.3, 0.45, 0.58];
                notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.4 : 0.15, 'triangle', 0.17, times[i]));
            }
        };
    })();

    /* =========================================================================
       STATE
    ========================================================================= */
    const state = {
        view: 'setup', // 'setup' | 'game' | 'end'
        presets: [],
        customSets: [],
        activeSetId: null, // preset id or custom set id or null
        editorMode: 'text', // 'text' | 'cards'
        setup: {
            title: 'Starter Mix (A1–A2)',
            teamCount: 3,
            teamNames: ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6'],
            teamColors: [0, 1, 2, 3, 4, 5],
            pts: 10,
            traps: 3,
            gifts: 3,
            timerSec: 0,
            revealBadge: true,
            allowSteal: true,
            enabledTraps: TRAPS.map(t => t.id),
            enabledGifts: GIFTS.map(g => g.id),
            questionsText: questionsToText(FALLBACK_DEFAULT_Q)
        },
        game: null, // Active game object
        timer: {
            intervalId: null,
            remaining: 0,
            total: 0,
            paused: false
        },
        lastNotice: '',
        scoreDeltas: {},
        cloudSyncTimeout: null,
        bulkImportModal: null
    };

    /* =========================================================================
       DOM REFERENCES
    ========================================================================= */
    const $ = id => document.getElementById(id);
    const els = {
        headerSubtitle: $('header-subtitle'),
        headerGameActions: $('header-game-actions'),
        btnUndo: $('btn-undo'),
        btnEndGame: $('btn-end-game'),
        btnSound: $('btn-sound'),
        iconSoundOn: $('icon-sound-on'),
        iconSoundOff: $('icon-sound-off'),
        btnTheme: $('btn-theme'),
        btnHelp: $('btn-help'),

        resumeBanner: $('resume-banner'),
        resumeBannerMeta: $('resume-banner-meta'),
        btnResumeMatch: $('btn-resume-match'),
        btnDiscardMatch: $('btn-discard-match'),

        viewSetup: $('view-setup'),
        viewGame: $('view-game'),
        viewEnd: $('view-end'),

        btnShuffleTeams: $('btn-shuffle-teams'),
        teamCountGroup: $('team-count-group'),
        teamList: $('team-list'),

        setupTileSummary: $('setup-tile-summary'),
        inputPts: $('input-pts'),
        inputTraps: $('input-traps'),
        inputGifts: $('input-gifts'),
        quickPtsGroup: $('quick-pts-group'),
        selectTimer: $('select-timer'),
        toggleRevealBadge: $('toggle-reveal-badge'),
        toggleAllowSteal: $('toggle-allow-steal'),
        poolCountPill: $('pool-count-pill'),
        poolTraps: $('pool-traps'),
        poolGifts: $('pool-gifts'),

        syncStatusPill: $('sync-status-pill'),
        inputSetTitle: $('input-set-title'),
        btnSaveSet: $('btn-save-set'),
        btnSaveAs: $('btn-save-as'),
        btnNewSet: $('btn-new-set'),
        btnDeleteSet: $('btn-delete-set'),
        presetsStrip: $('presets-strip'),
        savedSetsWrapper: $('saved-sets-wrapper'),
        savedSetsStrip: $('saved-sets-strip'),

        qCountBadge: $('q-count-badge'),
        tabModeText: $('tab-mode-text'),
        tabModeCards: $('tab-mode-cards'),
        btnShuffleQuestions: $('btn-shuffle-questions'),
        btnBulkImport: $('btn-bulk-import'),
        paneText: $('pane-text'),
        inputQuestionsText: $('input-questions-text'),
        paneCards: $('pane-cards'),
        visualCardsList: $('visual-cards-list'),
        btnAddQCard: $('btn-add-q-card'),
        btnStartGame: $('btn-start-game'),
        btnStartLabel: $('btn-start-label'),
        btnStartGameTop: $('btn-start-game-top'),
        btnStartLabelTop: $('btn-start-label-top'),

        scoreboardGrid: $('scoreboard-grid'),
        turnBanner: $('turn-banner'),
        turnBadge: $('turn-badge'),
        turnPrompt: $('turn-prompt'),
        turnNotice: $('turn-notice'),
        remainingQPill: $('remaining-q-pill'),
        remainingTrapPill: $('remaining-trap-pill'),
        remainingGiftPill: $('remaining-gift-pill'),
        remainingPill: $('remaining-pill'),
        tilesGridWrap: $('tiles-grid-wrap'),
        tilesGrid: $('tiles-grid'),

        endHeadline: $('end-headline'),
        endLeaderboard: $('end-leaderboard'),
        btnPlayAgain: $('btn-play-again'),
        btnBackSetup: $('btn-back-setup'),

        modalTile: $('modal-tile'),
        modalTileCard: $('modal-tile-card'),
        modalTileHeader: $('modal-tile-header'),
        modalTileIconWrap: $('modal-tile-icon-wrap'),
        modalTileTitle: $('modal-tile-title'),
        modalTileNum: $('modal-tile-num'),
        btnReturnTile: $('btn-return-tile'),
        modalTimerBarWrap: $('modal-timer-bar-wrap'),
        modalTimerText: $('modal-timer-text'),
        btnTimerToggle: $('btn-timer-toggle'),
        btnTimerPlus10: $('btn-timer-plus10'),
        modalTimerFill: $('modal-timer-fill'),
        modalTileBody: $('modal-tile-body'),

        modalHelp: $('modal-help'),
        btnCloseHelp: $('btn-close-help'),

        modalSystem: $('modal-system'),
        sysModalHeader: $('sys-modal-header'),
        sysModalTitle: $('sys-modal-title'),
        sysModalMsg: $('sys-modal-msg'),
        sysModalInput: $('sys-modal-input'),
        sysModalActions: $('sys-modal-actions'),

        toastContainer: $('toast-container')
    };

    /* =========================================================================
       UTILITIES
    ========================================================================= */
    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function refreshIcons(root = document) {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root });
        }
    }

    function questionsToText(items) {
        return (items || [])
            .map(it => (it.a ? `${it.q} | ${it.a}` : `${it.q}`))
            .join('\n');
    }

    function parseQuestionsText(raw) {
        return String(raw || '')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split('|');
                const q = parts[0].trim();
                const a = parts.slice(1).join('|').trim();
                return { q, a };
            })
            .filter(item => item.q.length > 0);
    }

    function showToast(message, toneClass = 'bg-dark text-white dark:bg-slate-800') {
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto mt-card-sm px-4 py-2.5 font-heading font-bold text-sm flex items-center gap-2 animate-slide-down ${toneClass}`;
        toast.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 shrink-0 stroke-[2.5]"></i><span>${esc(message)}</span>`;
        els.toastContainer.appendChild(toast);
        refreshIcons(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            toast.style.transition = 'all 0.22s ease';
            setTimeout(() => toast.remove(), 240);
        }, 2600);
    }

    /* =========================================================================
       CUSTOM SYSTEM MODAL (Alert / Confirm / Prompt / Multi-Action)
    ========================================================================= */
    function showSystemModal(options) {
        const {
            title = 'Notice',
            message = '',
            headerClass = 'bg-orange text-dark',
            promptDefault = null,
            promptPlaceholder = '',
            confirmText = 'Confirm',
            confirmClass = 'bg-green text-dark',
            cancelText = 'Cancel',
            showCancel = true,
            extraActions = [],
            onConfirm
        } = options || {};

        els.sysModalHeader.className = `${headerClass} px-5 py-3.5 border-b-[3px] border-dark dark:border-slate-500 flex items-center justify-between`;
        els.sysModalTitle.textContent = title;
        els.sysModalMsg.textContent = message;
        els.sysModalActions.innerHTML = '';

        const isPrompt = promptDefault !== null;
        if (isPrompt) {
            els.sysModalInput.value = promptDefault;
            els.sysModalInput.placeholder = promptPlaceholder;
            els.sysModalInput.classList.remove('hidden');
            els.sysModalInput.onkeydown = e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    closeAndConfirm();
                }
            };
            setTimeout(() => {
                els.sysModalInput.focus();
                els.sysModalInput.select();
            }, 40);
        } else {
            els.sysModalInput.classList.add('hidden');
            els.sysModalInput.onkeydown = null;
        }

        function close() {
            els.modalSystem.classList.add('hidden');
        }

        function closeAndConfirm() {
            const val = els.sysModalInput.value;
            close();
            if (onConfirm) onConfirm(isPrompt ? val : true);
        }

        if (showCancel) {
            const btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.className = 'mt-btn rounded-xl bg-white dark:bg-slate-800 px-4 py-2 font-heading font-bold text-sm uppercase';
            btnCancel.textContent = cancelText;
            btnCancel.onclick = close;
            els.sysModalActions.appendChild(btnCancel);
        }

        extraActions.forEach(action => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `mt-btn rounded-xl px-4 py-2 font-heading font-bold text-sm uppercase ${action.className || 'bg-blue text-white'}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                close();
                if (action.onClick) action.onClick();
            };
            els.sysModalActions.appendChild(btn);
        });

        if (confirmText) {
            const btnConfirm = document.createElement('button');
            btnConfirm.type = 'button';
            btnConfirm.className = `mt-btn rounded-xl px-4 py-2 font-heading font-bold text-sm uppercase ${confirmClass}`;
            btnConfirm.textContent = confirmText;
            btnConfirm.onclick = closeAndConfirm;
            els.sysModalActions.appendChild(btnConfirm);
        }

        els.modalSystem.classList.remove('hidden');
    }

    /* =========================================================================
       PERSISTENCE (localStorage + Supabase Cloud Sync)
    ========================================================================= */
    function saveDraftToLocal() {
        try {
            const safeGame = state.game
                ? { ...state.game, modal: null, history: (state.game.history || []).slice(-MAX_UNDO_HISTORY) }
                : null;
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
                activeSetId: state.activeSetId,
                setup: state.setup,
                game: safeGame
            }));
        } catch (err) {
            console.warn('[Mystery Tiles] Failed to persist draft locally:', err);
        }
    }

    function saveCustomSetsToLocal() {
        try {
            localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(state.customSets));
        } catch (err) {
            console.warn('[Mystery Tiles] Failed to save custom sets locally:', err);
        }
    }

    function updateSyncPill(label, colorClass = 'text-blue') {
        if (!els.syncStatusPill) return;
        els.syncStatusPill.innerHTML = `<i data-lucide="cloud" class="w-3.5 h-3.5 ${colorClass}"></i><span>${esc(label)}</span>`;
        refreshIcons(els.syncStatusPill);
    }

    function scheduleCloudSync() {
        saveCustomSetsToLocal();
        saveDraftToLocal();
        clearTimeout(state.cloudSyncTimeout);
        state.cloudSyncTimeout = setTimeout(pushToCloud, 900);
    }

    async function pushToCloud() {
        if (typeof saveProgress !== 'function') return;
        try {
            const payload = {
                sets: state.customSets.map(s => ({
                    id: s.id,
                    title: s.title,
                    pts: s.pts,
                    traps: s.traps,
                    gifts: s.gifts,
                    timerSec: s.timerSec || 0,
                    questions: Array.isArray(s.questions) ? s.questions : [],
                    updatedAt: s.updatedAt
                })),
                preferences: {
                    teamCount: state.setup.teamCount,
                    teamNames: state.setup.teamNames,
                    teamColors: state.setup.teamColors,
                    pts: state.setup.pts,
                    traps: state.setup.traps,
                    gifts: state.setup.gifts,
                    timerSec: state.setup.timerSec,
                    revealBadge: state.setup.revealBadge,
                    allowSteal: state.setup.allowSteal,
                    enabledTraps: state.setup.enabledTraps,
                    enabledGifts: state.setup.enabledGifts
                }
            };
            await saveProgress(TOOL_KEY, payload);
            updateSyncPill('Cloud Synced', 'text-green');
        } catch (err) {
            console.warn('[Mystery Tiles] Cloud save skipped/failed:', err);
            updateSyncPill('Saved Locally', 'text-orange');
        }
    }

    async function loadInitialData() {
        // 1. Load presets.json
        try {
            const res = await fetch('./presets.json');
            if (res.ok) {
                const parsed = await res.json();
                if (Array.isArray(parsed) && parsed.length > 0) {
                    state.presets = parsed;
                }
            }
        } catch (err) {
            console.warn('[Mystery Tiles] Could not fetch presets.json, using fallback:', err);
        }

        if (state.presets.length === 0) {
            state.presets = [{
                id: 'preset-starter-mix',
                title: 'Starter Mix (A1–A2)',
                level: 'A1–A2',
                pts: 10,
                traps: 3,
                gifts: 3,
                questions: FALLBACK_DEFAULT_Q
            }];
        }

        // 2. Load local sets & draft
        try {
            const rawSets = localStorage.getItem(SETS_STORAGE_KEY);
            if (rawSets) {
                const parsedSets = JSON.parse(rawSets);
                if (Array.isArray(parsedSets)) state.customSets = parsedSets;
            }
        } catch (_) {}

        let restoredGame = null;
        let hasSavedDraft = false;
        try {
            const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                if (parsed && parsed.setup) {
                    state.setup = { ...state.setup, ...parsed.setup };
                    state.activeSetId = parsed.activeSetId || null;
                    hasSavedDraft = true;
                }
                if (parsed && parsed.game && Array.isArray(parsed.game.tiles) && !parsed.game.tiles.every(t => t.used)) {
                    restoredGame = parsed.game;
                }
            }
        } catch (_) {}

        if (!hasSavedDraft && state.presets[0]) {
            applySetData(state.presets[0], true);
        }

        // 3. Load cloud sets & preferences (merged cleanly without clobbering newer local edits)
        if (typeof loadProgress === 'function') {
            try {
                const cloud = await loadProgress(TOOL_KEY);
                if (cloud) {
                    if (Array.isArray(cloud.sets)) {
                        const byId = new Map(state.customSets.map(s => [s.id, s]));
                        cloud.sets.forEach(cs => {
                            const local = byId.get(cs.id);
                            if (!local || (cs.updatedAt || 0) > (local.updatedAt || 0)) {
                                byId.set(cs.id, cs);
                            }
                        });
                        state.customSets = Array.from(byId.values())
                            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                        saveCustomSetsToLocal();
                    }
                    if (!hasSavedDraft && cloud.preferences) {
                        state.setup = { ...state.setup, ...cloud.preferences };
                    }
                    updateSyncPill('Cloud Synced', 'text-green');
                }
            } catch (err) {
                console.warn('[Mystery Tiles] Cloud load error:', err);
            }
        }

        // Handle resumable game banner on Setup screen
        if (restoredGame) {
            state.pendingResumeGame = restoredGame;
            const remaining = restoredGame.tiles.filter(t => !t.used).length;
            els.resumeBannerMeta.textContent = `${restoredGame.teams.length} teams · ${remaining} of ${restoredGame.tiles.length} tiles remaining`;
            els.resumeBanner.classList.remove('hidden');
        }
    }

    /* =========================================================================
       SETS LIBRARY & EDITOR SYNC
    ========================================================================= */
    function isCustomSet(id) {
        return state.customSets.some(s => s.id === id);
    }

    function applySetData(setObj, skipToast = false) {
        state.activeSetId = setObj.id || null;
        state.setup.title = setObj.title || 'Untitled Set';
        if (typeof setObj.pts === 'number') state.setup.pts = Math.max(1, setObj.pts);
        if (typeof setObj.traps === 'number') state.setup.traps = Math.max(0, setObj.traps);
        if (typeof setObj.gifts === 'number') state.setup.gifts = Math.max(0, setObj.gifts);
        if (typeof setObj.timerSec === 'number') state.setup.timerSec = setObj.timerSec;
        state.setup.questionsText = questionsToText(setObj.questions || []);

        renderSetup();
        saveDraftToLocal();
        if (!skipToast) {
            showToast(`Loaded "${state.setup.title}"`, 'bg-blue text-white');
        }
    }

    function buildCurrentSetSnapshot(id, titleOverride) {
        const cleanTitle = (titleOverride || state.setup.title || '').trim() || 'Custom Question Set';
        return {
            id: id || `set-${Date.now()}`,
            title: cleanTitle,
            pts: Math.max(1, parseInt(state.setup.pts, 10) || 10),
            traps: Math.max(0, parseInt(state.setup.traps, 10) || 0),
            gifts: Math.max(0, parseInt(state.setup.gifts, 10) || 0),
            timerSec: parseInt(state.setup.timerSec, 10) || 0,
            questions: parseQuestionsText(state.setup.questionsText),
            updatedAt: Date.now()
        };
    }

    function handleSaveSet(forcePrompt = false) {
        const questions = parseQuestionsText(state.setup.questionsText);
        if (questions.length === 0) {
            showToast('Add at least 1 question before saving.', 'bg-pink text-white');
            return;
        }

        if (!forcePrompt && isCustomSet(state.activeSetId)) {
            const idx = state.customSets.findIndex(s => s.id === state.activeSetId);
            const updated = buildCurrentSetSnapshot(state.activeSetId, els.inputSetTitle.value);
            state.customSets[idx] = updated;
            state.setup.title = updated.title;
            scheduleCloudSync();
            renderLibraryStrips();
            showToast(`Saved changes to "${updated.title}"`, 'bg-green text-dark');
            return;
        }

        showSystemModal({
            title: 'Save Question Set',
            message: 'Name this question set to access it anytime in your saved library.',
            headerClass: 'bg-green text-dark',
            promptDefault: state.setup.title && !state.activeSetId?.startsWith('preset-')
                ? state.setup.title
                : (state.setup.title ? `${state.setup.title} Copy` : 'My Mystery Set'),
            promptPlaceholder: 'e.g. Unit 5 Vocabulary...',
            confirmText: 'Save Set',
            onConfirm: name => {
                const finalName = String(name || '').trim() || 'Untitled Set';
                const newSet = buildCurrentSetSnapshot(`set-${Date.now()}`, finalName);
                state.customSets.unshift(newSet);
                state.activeSetId = newSet.id;
                state.setup.title = finalName;
                els.inputSetTitle.value = finalName;
                scheduleCloudSync();
                renderLibraryStrips();
                showToast(`Saved "${finalName}" to library!`, 'bg-green text-dark');
            }
        });
    }

    function handleDeleteActiveSet() {
        if (!isCustomSet(state.activeSetId)) return;
        const target = state.customSets.find(s => s.id === state.activeSetId);
        showSystemModal({
            title: 'Delete Saved Set',
            message: `Delete "${target ? target.title : 'this set'}" from your saved library?`,
            headerClass: 'bg-pink text-white',
            confirmText: 'Delete',
            confirmClass: 'bg-pink text-white',
            onConfirm: () => {
                state.customSets = state.customSets.filter(s => s.id !== state.activeSetId);
                state.activeSetId = null;
                scheduleCloudSync();
                renderLibraryStrips();
                showToast('Set deleted', 'bg-pink text-white');
            }
        });
    }

    function handleNewBlankSet() {
        state.activeSetId = null;
        state.setup.title = 'New Custom Set';
        state.setup.questionsText = '';
        renderSetup();
        saveDraftToLocal();
        if (state.editorMode === 'text') {
            els.inputQuestionsText.focus();
        }
        showToast('Started blank question list', 'bg-blue text-white');
    }

    /* =========================================================================
       RENDER: SETUP CONSOLE
    ========================================================================= */
    function renderTeamSetup() {
        els.teamCountGroup.innerHTML = [2, 3, 4, 5, 6].map(n => {
            const active = state.setup.teamCount === n;
            return `<button type="button" data-team-count="${n}"
                class="mt-btn w-11 h-11 rounded-xl font-heading font-bold text-lg ${active ? 'bg-pink text-white' : 'bg-white dark:bg-slate-800'}">
                ${n}
            </button>`;
        }).join('');

        els.teamList.innerHTML = Array.from({ length: state.setup.teamCount }, (_, i) => {
            const paletteIdx = (state.setup.teamColors[i] ?? i) % TEAM_PALETTE.length;
            const pal = TEAM_PALETTE[paletteIdx];
            return `
                <div class="flex items-center gap-2">
                    <button type="button" data-cycle-color="${i}"
                        class="mt-btn w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-heading font-bold text-xs"
                        style="background:${pal.bg};color:${pal.text}"
                        title="Click to change team color (${pal.name})">
                        T${i + 1}
                    </button>
                    <input type="text" data-team-name="${i}" value="${esc(state.setup.teamNames[i] || `Team ${i + 1}`)}"
                        maxlength="24" placeholder="Team ${i + 1}"
                        class="input-chunky flex-1 min-w-0 px-3 py-2 text-sm font-bold bg-chalk dark:bg-slate-800 border-dark dark:border-slate-500">
                </div>
            `;
        }).join('');
    }

    function renderPowerUpPools() {
        const pts = Math.max(1, parseInt(state.setup.pts, 10) || 10);
        const makeChips = (list, activeIds, kind) => list.map(fx => {
            const on = activeIds.includes(fx.id);
            const activeClass = kind === 'trap' ? 'bg-pink text-white' : 'bg-green text-dark';
            return `<button type="button" data-pool-kind="${kind}" data-pool-id="${fx.id}"
                title="${esc(fx.desc(pts))}"
                class="mt-btn rounded-xl px-2.5 py-1.5 text-xs font-heading font-bold flex items-center gap-1.5 ${on ? activeClass : 'bg-slate-100 dark:bg-slate-800 opacity-60'}">
                <i data-lucide="${fx.icon}" class="w-3.5 h-3.5 stroke-[2.5]"></i>
                <span>${fx.short}</span>
            </button>`;
        }).join('');

        els.poolTraps.innerHTML = makeChips(TRAPS, state.setup.enabledTraps, 'trap');
        els.poolGifts.innerHTML = makeChips(GIFTS, state.setup.enabledGifts, 'gift');

        const activeTotal = state.setup.enabledTraps.length + state.setup.enabledGifts.length;
        const maxTotal = TRAPS.length + GIFTS.length;
        els.poolCountPill.textContent = activeTotal === maxTotal ? 'All Active' : `${activeTotal}/${maxTotal} Active`;
        refreshIcons(els.poolTraps);
        refreshIcons(els.poolGifts);
    }

    function renderLibraryStrips() {
        els.inputSetTitle.value = state.setup.title;
        els.btnDeleteSet.classList.toggle('hidden', !isCustomSet(state.activeSetId));

        els.presetsStrip.innerHTML = state.presets.map(p => {
            const active = state.activeSetId === p.id;
            return `<button type="button" data-load-preset="${esc(p.id)}"
                class="mt-btn rounded-xl px-3 py-1.5 text-xs font-heading font-bold flex items-center gap-1.5 ${active ? 'bg-blue text-white' : 'bg-chalk dark:bg-slate-800'}">
                <span>${esc(p.title)}</span>
                <span class="px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[10px]">${(p.questions || []).length}</span>
            </button>`;
        }).join('');

        if (state.customSets.length > 0) {
            els.savedSetsWrapper.classList.remove('hidden');
            els.savedSetsStrip.innerHTML = state.customSets.map(s => {
                const active = state.activeSetId === s.id;
                return `<button type="button" data-load-custom="${esc(s.id)}"
                    class="mt-btn rounded-xl px-3 py-1.5 text-xs font-heading font-bold flex items-center gap-1.5 ${active ? 'bg-green text-dark' : 'bg-chalk dark:bg-slate-800'}">
                    <i data-lucide="bookmark" class="w-3 h-3 stroke-[2.5]"></i>
                    <span>${esc(s.title)}</span>
                    <span class="px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[10px]">${(s.questions || []).length}</span>
                </button>`;
            }).join('');
            refreshIcons(els.savedSetsStrip);
        } else {
            els.savedSetsWrapper.classList.add('hidden');
            els.savedSetsStrip.innerHTML = '';
        }
    }

    function updateTileCountsSummary() {
        const qs = parseQuestionsText(state.setup.questionsText);
        const total = qs.length + state.setup.traps + state.setup.gifts;
        els.qCountBadge.textContent = `${qs.length} Question${qs.length === 1 ? '' : 's'}`;
        els.setupTileSummary.textContent = `${qs.length}Q + ${state.setup.traps}T + ${state.setup.gifts}G = ${total} Tiles`;
        els.btnStartLabel.textContent = total > 0 ? `Start Mystery Game (${total} Tiles)` : 'Add Questions to Start';
        els.btnStartGame.disabled = qs.length === 0;
        if (els.btnStartLabelTop && els.btnStartGameTop) {
            els.btnStartLabelTop.textContent = total > 0 ? `Start (${total} Tiles)` : 'Add Questions';
            els.btnStartGameTop.disabled = qs.length === 0;
        }

        // Highlight active quick point chip
        els.quickPtsGroup.querySelectorAll('.pts-chip').forEach(btn => {
            const matches = Number(btn.dataset.pts) === Number(state.setup.pts);
            btn.classList.toggle('bg-orange', matches);
            btn.classList.toggle('text-dark', matches);
            btn.classList.toggle('bg-chalk', !matches);
            btn.classList.toggle('dark:bg-slate-800', !matches);
        });
    }

    function renderVisualCards() {
        const rawLines = String(state.setup.questionsText || '').replace(/\r\n/g, '\n').split('\n');
        const rows = rawLines
            .map(l => l.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split('|');
                return { q: parts[0].trim(), a: parts.slice(1).join('|').trim() };
            });

        if (rows.length === 0) {
            els.visualCardsList.innerHTML = `
                <div class="text-center py-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-400 font-bold text-sm">
                    No questions yet. Click "Add Question Row" or switch to Quick Text!
                </div>`;
            return;
        }

        els.visualCardsList.innerHTML = rows.map((row, idx) => `
            <div class="mt-card-sm bg-chalk dark:bg-slate-800/80 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2" data-card-row="${idx}">
                <span class="w-7 h-7 rounded-lg bg-blue text-white font-heading font-bold text-xs flex items-center justify-center shrink-0 self-start sm:self-center">
                    ${idx + 1}
                </span>
                <input type="text" data-card-field="q" data-card-idx="${idx}" value="${esc(row.q)}"
                    placeholder="Question or prompt..."
                    class="input-chunky flex-1 px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 border-dark dark:border-slate-600">
                <input type="text" data-card-field="a" data-card-idx="${idx}" value="${esc(row.a)}"
                    placeholder="Answer (optional)"
                    class="input-chunky sm:w-48 px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 border-dark dark:border-slate-600">
                <div class="flex items-center gap-1 justify-end">
                    <button type="button" data-card-move="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}
                        class="p-1.5 rounded-lg border-2 border-dark dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 disabled:opacity-30"
                        title="Move up">
                        <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-card-move="${idx}" data-dir="1" ${idx === rows.length - 1 ? 'disabled' : ''}
                        class="p-1.5 rounded-lg border-2 border-dark dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 disabled:opacity-30"
                        title="Move down">
                        <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-card-del="${idx}"
                        class="p-1.5 rounded-lg border-2 border-dark dark:border-slate-600 bg-pink text-white hover:opacity-90"
                        title="Delete question">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `).join('');

        refreshIcons(els.visualCardsList);
    }

    function renderEditorMode() {
        const isCards = state.editorMode === 'cards';
        els.tabModeText.classList.toggle('bg-blue', !isCards);
        els.tabModeText.classList.toggle('text-white', !isCards);
        els.tabModeCards.classList.toggle('bg-blue', isCards);
        els.tabModeCards.classList.toggle('text-white', isCards);

        els.paneText.classList.toggle('hidden', isCards);
        els.paneCards.classList.toggle('hidden', !isCards);

        if (isCards) {
            renderVisualCards();
        } else {
            els.inputQuestionsText.value = state.setup.questionsText;
        }
    }

    function renderSetup() {
        els.inputPts.value = state.setup.pts;
        els.inputTraps.value = state.setup.traps;
        els.inputGifts.value = state.setup.gifts;
        els.selectTimer.value = String(state.setup.timerSec || 0);
        els.toggleRevealBadge.checked = state.setup.revealBadge !== false;
        els.toggleAllowSteal.checked = state.setup.allowSteal !== false;
        els.inputQuestionsText.value = state.setup.questionsText;

        renderTeamSetup();
        renderPowerUpPools();
        renderLibraryStrips();
        renderEditorMode();
        updateTileCountsSummary();
    }

    /* =========================================================================
       VIEW SWITCHING & HEADER
    ========================================================================= */
    function switchView(viewName) {
        state.view = viewName;
        document.body.classList.toggle('in-game-viewport', viewName === 'game');
        els.viewSetup.classList.toggle('hidden', viewName !== 'setup');
        els.viewGame.classList.toggle('hidden', viewName !== 'game');
        els.viewEnd.classList.toggle('hidden', viewName !== 'end');

        const inGame = viewName === 'game';
        els.headerGameActions.classList.toggle('hidden', !inGame);
        els.headerGameActions.classList.toggle('flex', inGame);

        if (viewName === 'setup') {
            els.headerSubtitle.textContent = 'Surprise Tile Classroom Battle';
        } else if (viewName === 'game' && state.game) {
            els.headerSubtitle.textContent = `${state.game.setTitle || 'Active Match'} · ${state.game.pts} pts/Q`;
            els.resumeBanner.classList.add('hidden');
            requestAnimationFrame(fitTileGridToViewport);
        } else if (viewName === 'end') {
            els.headerSubtitle.textContent = 'Final Classroom Leaderboard';
        }
    }

    /* =========================================================================
       GAME ENGINE & UNDO HISTORY
    ========================================================================= */
    function pushUndoSnapshot() {
        if (!state.game) return;
        const snapshot = deepClone({
            teams: state.game.teams,
            cur: state.game.cur,
            tiles: state.game.tiles,
            lastNotice: state.lastNotice
        });
        state.game.history = state.game.history || [];
        state.game.history.push(snapshot);
        if (state.game.history.length > MAX_UNDO_HISTORY) {
            state.game.history.shift();
        }
        updateUndoButton();
    }

    function updateUndoButton() {
        const canUndo = Boolean(state.game && state.game.history && state.game.history.length > 0);
        els.btnUndo.disabled = !canUndo;
    }

    function undoLastAction() {
        if (!state.game || !state.game.history || state.game.history.length === 0) return;
        stopModalTimer();
        closeTileModalDOM();
        const prev = state.game.history.pop();
        state.game.teams = prev.teams;
        state.game.cur = prev.cur;
        state.game.tiles = prev.tiles;
        state.lastNotice = prev.lastNotice || '';
        SoundEngine.click();
        updateUndoButton();
        saveDraftToLocal();
        if (state.view !== 'game') switchView('game');
        renderGameBoard();
        showToast('Reverted last action', 'bg-blue text-white');
    }

    function startNewGame(overrideSetup) {
        const cfg = overrideSetup || state.setup;
        const questions = parseQuestionsText(cfg.questionsText);
        if (questions.length === 0) {
            showToast('Add at least 1 question before starting!', 'bg-pink text-white');
            return;
        }

        const trapCount = Math.max(0, parseInt(cfg.traps, 10) || 0);
        const giftCount = Math.max(0, parseInt(cfg.gifts, 10) || 0);

        const pool = shuffle([
            ...questions.map(item => ({ kind: 'q', q: item.q, a: item.a })),
            ...Array.from({ length: trapCount }, () => ({ kind: 'trap' })),
            ...Array.from({ length: giftCount }, () => ({ kind: 'gift' }))
        ]).map(tile => ({ ...tile, used: false, outcome: null }));

        const teams = Array.from({ length: cfg.teamCount }, (_, i) => {
            const palIdx = (cfg.teamColors[i] ?? i) % TEAM_PALETTE.length;
            const pal = TEAM_PALETTE[palIdx];
            return {
                name: (cfg.teamNames[i] || '').trim() || `Team ${i + 1}`,
                score: 0,
                skip: false,
                color: pal.bg,
                txt: pal.text,
                stats: { right: 0, traps: 0, gifts: 0 }
            };
        });

        state.game = {
            setTitle: (cfg.title || 'Mystery Tiles').trim(),
            teams,
            cur: 0,
            pts: Math.max(1, parseInt(cfg.pts, 10) || 10),
            timerSec: parseInt(cfg.timerSec, 10) || 0,
            revealBadge: cfg.revealBadge !== false,
            allowSteal: cfg.allowSteal !== false,
            enabledTraps: cfg.enabledTraps.length ? [...cfg.enabledTraps] : TRAPS.map(t => t.id),
            enabledGifts: cfg.enabledGifts.length ? [...cfg.enabledGifts] : GIFTS.map(g => g.id),
            tiles: pool,
            modal: null,
            history: []
        };

        state.lastNotice = '';
        state.pendingResumeGame = null;
        SoundEngine.click();
        updateUndoButton();
        saveDraftToLocal();
        switchView('game');
        renderGameBoard();
    }

    function advanceTurn(extraTurn = false, customNotice = '') {
        const G = state.game;
        if (!G) return;
        G.modal = null;

        if (G.tiles.every(t => t.used)) {
            finishGame();
            return;
        }

        if (!extraTurn) {
            const skippedNames = [];
            // Guard against edge case where every team is frozen simultaneously
            for (let k = 0; k < G.teams.length * 2; k++) {
                G.cur = (G.cur + 1) % G.teams.length;
                const candidate = G.teams[G.cur];
                if (candidate.skip) {
                    candidate.skip = false;
                    skippedNames.push(candidate.name);
                    continue;
                }
                break;
            }
            if (skippedNames.length > 0) {
                const skipMsg = `Frozen! Skipped ${skippedNames.join(', ')}`;
                state.lastNotice = customNotice ? `${customNotice} · ${skipMsg}` : skipMsg;
            } else {
                state.lastNotice = customNotice;
            }
        } else {
            state.lastNotice = `${G.teams[G.cur].name} goes again!`;
        }

        saveDraftToLocal();
        renderGameBoard();
    }

    function finishGame() {
        stopModalTimer();
        closeTileModalDOM();
        saveDraftToLocal();
        switchView('end');
        renderEndScreen();
        SoundEngine.win();

        if (typeof confetti === 'function') {
            confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
            setTimeout(() => confetti({ particleCount: 55, spread: 100, origin: { y: 0.55 } }), 350);
        }
    }

    /* =========================================================================
       RENDER: GAME BOARD & CHROMEBOOK AUTO-FIT GRID
    ========================================================================= */
    function computeBestTileGrid(count, width, height, gap = 12) {
        if (count <= 0 || width <= 0 || height <= 0) {
            return { cols: 4, rows: 1, fontPx: 36, scrollable: false };
        }
        let best = null;
        const capScale = count >= 100 ? 0.34 : 0.42;
        for (let cols = 1; cols <= count; cols++) {
            const rows = Math.ceil(count / cols);
            const cellW = (width - gap * (cols - 1)) / cols;
            const cellH = (height - gap * (rows - 1)) / rows;
            if (cellW < 46 || cellH < 46) continue;

            const ratio = Math.max(cellW / cellH, cellH / cellW);
            if (ratio > 2.4 && cols > 1 && rows > 1) continue;

            const emptySlots = cols * rows - count;
            const emptyRatio = emptySlots / (cols * rows);
            const fontFit = Math.min(cellW * capScale, cellH * 0.56);

            // Maximize legible tile number size while preferring balanced shapes and clean rows
            const aspectPenalty = Math.pow(ratio, 0.35);
            const emptyPenalty = 1 + emptyRatio * 1.1;
            const score = fontFit / (aspectPenalty * emptyPenalty);

            if (!best || score > best.score) {
                best = { cols, rows, cellW, cellH, fontFit, score };
            }
        }

        if (!best) {
            const cols = Math.min(count, Math.max(3, Math.floor((width + gap) / 86)));
            const rows = Math.ceil(count / cols);
            const cellW = (width - gap * (cols - 1)) / cols;
            return {
                cols,
                rows,
                fontPx: Math.max(22, Math.min(48, Math.round(cellW * 0.42))),
                scrollable: true
            };
        }

        const fontPx = Math.max(22, Math.min(96, Math.round(best.fontFit)));
        return { cols: best.cols, rows: best.rows, fontPx, scrollable: false };
    }

    function fitTileGridToViewport() {
        const G = state.game;
        if (!G || state.view !== 'game' || !els.tilesGridWrap || !els.tilesGrid) return;

        const isDesktopOrChromebook = window.innerWidth >= 768;
        if (!isDesktopOrChromebook) {
            els.tilesGrid.classList.remove('is-scrollable');
            els.tilesGrid.style.removeProperty('--tile-cols');
            els.tilesGrid.style.removeProperty('--tile-rows');
            els.tilesGrid.style.setProperty('--tile-font', G.tiles.length > 24 ? '24px' : '30px');
            return;
        }

        const W = els.tilesGridWrap.clientWidth;
        const H = els.tilesGridWrap.clientHeight;
        if (W <= 0 || H <= 0) return;

        const gap = G.tiles.length > 24 ? 10 : 12;
        const layout = computeBestTileGrid(G.tiles.length, W, H, gap);

        els.tilesGrid.style.setProperty('--tile-cols', String(layout.cols));
        els.tilesGrid.style.setProperty('--tile-rows', String(layout.rows));
        els.tilesGrid.style.setProperty('--tile-gap', `${gap}px`);
        els.tilesGrid.style.setProperty('--tile-font', `${layout.fontPx}px`);
        els.tilesGrid.classList.toggle('is-scrollable', Boolean(layout.scrollable));
    }

    function renderGameBoard() {
        const G = state.game;
        if (!G) return;

        const maxScore = Math.max(...G.teams.map(t => t.score));
        const hasLeader = maxScore > 0;
        const deltas = state.scoreDeltas || {};

        const colMap = {
            2: 'grid-cols-2',
            3: 'grid-cols-3',
            4: 'grid-cols-2 md:grid-cols-4',
            5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
            6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        };
        els.scoreboardGrid.className = `grid gap-2.5 md:gap-3 shrink-0 ${colMap[G.teams.length] || 'grid-cols-2 md:grid-cols-3'}`;

        els.scoreboardGrid.innerHTML = G.teams.map((t, idx) => {
            const isActive = idx === G.cur;
            const isLeader = hasLeader && t.score === maxScore;
            const deltaText = deltas[idx] || '';
            return `
                <div class="mt-card px-3 py-2.5 transition-all relative ${isActive ? 'team-card-active' : 'opacity-90'}"
                    style="background:${t.color};color:${t.txt}">
                    ${deltaText ? `
                        <span class="score-delta-badge absolute -top-3 right-2 px-2.5 py-0.5 rounded-full bg-dark text-white border-2 border-white font-heading font-bold text-xs shadow">
                            ${esc(deltaText)}
                        </span>` : ''}

                    <div class="flex items-center justify-between gap-1.5 mb-1.5">
                        <div class="font-heading font-bold text-base md:text-lg truncate flex items-center gap-1">
                            ${isLeader ? `<i data-lucide="crown" class="w-4 h-4 shrink-0 stroke-[2.5]"></i>` : ''}
                            <span class="truncate">${esc(t.name)}</span>
                        </div>
                        ${isActive ? `<span class="px-2 py-0.5 rounded-full bg-white text-dark border-2 border-dark font-heading font-bold text-[10px] uppercase shrink-0">Your Turn</span>` : ''}
                    </div>

                    <div class="flex items-center justify-between gap-1.5">
                        <button type="button" data-adj-team="${idx}" data-adj-dir="-1"
                            class="mt-btn w-8 h-8 rounded-xl bg-white text-dark flex items-center justify-center shrink-0"
                            aria-label="Subtract ${G.pts} points from ${esc(t.name)}" title="-${G.pts} pts">
                            <i data-lucide="minus" class="w-4 h-4 stroke-[3]"></i>
                        </button>
                        <div class="font-heading font-bold text-2xl md:text-3xl tabular-nums leading-none">
                            ${t.score}
                        </div>
                        <button type="button" data-adj-team="${idx}" data-adj-dir="1"
                            class="mt-btn w-8 h-8 rounded-xl bg-white text-dark flex items-center justify-center shrink-0"
                            aria-label="Add ${G.pts} points to ${esc(t.name)}" title="+${G.pts} pts">
                            <i data-lucide="plus" class="w-4 h-4 stroke-[3]"></i>
                        </button>
                    </div>

                    ${t.skip ? `
                        <div class="mt-1.5 px-2 py-0.5 rounded-lg bg-slate-950/25 text-[11px] font-extrabold flex items-center justify-center gap-1">
                            <i data-lucide="pause" class="w-3 h-3 stroke-[2.5]"></i> Frozen (Skips Next Turn)
                        </div>` : ''}
                </div>
            `;
        }).join('');

        // Clear one-shot floating deltas after painting them once
        state.scoreDeltas = {};

        // Turn Banner & Live Mystery Mix Breakdown
        const curTeam = G.teams[G.cur];
        els.turnBanner.style.background = curTeam.color;
        els.turnBanner.style.color = curTeam.txt;
        els.turnPrompt.textContent = `${curTeam.name} — Pick a number!`;

        if (state.lastNotice) {
            els.turnNotice.textContent = state.lastNotice;
            els.turnNotice.classList.remove('hidden');
        } else {
            els.turnNotice.classList.add('hidden');
        }

        const unused = G.tiles.filter(t => !t.used);
        const remQ = unused.filter(t => t.kind === 'q').length;
        const remTraps = unused.filter(t => t.kind === 'trap').length;
        const remGifts = unused.filter(t => t.kind === 'gift').length;

        els.remainingQPill.innerHTML = `<i data-lucide="help-circle" class="w-3.5 h-3.5 stroke-[2.5]"></i><span>${remQ} Q</span>`;
        els.remainingTrapPill.innerHTML = `<i data-lucide="skull" class="w-3.5 h-3.5 stroke-[2.5]"></i><span>${remTraps} Trap</span>`;
        els.remainingGiftPill.innerHTML = `<i data-lucide="gift" class="w-3.5 h-3.5 stroke-[2.5]"></i><span>${remGifts} Gift</span>`;
        els.remainingPill.textContent = `${unused.length} Left`;

        // Render Number Tiles cleanly
        els.tilesGrid.innerHTML = G.tiles.map((tile, i) => {
            if (tile.used) {
                let outcomeBadge = '';
                if (G.revealBadge && tile.outcome) {
                    const iconMap = {
                        right: 'check',
                        wrong: 'x',
                        trap: tile.outcomeIcon || 'bomb',
                        gift: tile.outcomeIcon || 'gift'
                    };
                    const iconName = iconMap[tile.outcome] || 'check';
                    const toneCls = tile.outcome === 'right'
                        ? 'text-green'
                        : tile.outcome === 'trap'
                            ? 'text-pink'
                            : tile.outcome === 'gift'
                                ? 'text-orange'
                                : 'text-slate-400';
                    outcomeBadge = `<i data-lucide="${iconName}" class="w-4 h-4 md:w-5 md:h-5 mt-1 ${toneCls}"></i>`;
                }
                return `
                    <button type="button" disabled
                        class="tile-btn tile-used flex flex-col items-center justify-center bg-slate-200/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                        <span class="font-heading font-bold line-through leading-none opacity-65" style="font-size: calc(var(--tile-font, 36px) * 0.65)">${i + 1}</span>
                        ${outcomeBadge}
                    </button>
                `;
            }

            const colorCls = TILE_COLOR_CLASSES[i % TILE_COLOR_CLASSES.length];
            return `
                <button type="button" data-open-tile="${i}"
                    class="tile-btn flex items-center justify-center font-heading font-bold ${colorCls}"
                    aria-label="Open tile ${i + 1}">
                    <span class="tile-num">${i + 1}</span>
                </button>
            `;
        }).join('');

        refreshIcons(els.scoreboardGrid);
        refreshIcons(els.turnBanner);
        refreshIcons(els.tilesGrid);
        updateUndoButton();
        requestAnimationFrame(fitTileGridToViewport);
    }

    /* =========================================================================
       TILE MODAL: TIMER, QUESTIONS, TRAPS & GIFTS
    ========================================================================= */
    function stopModalTimer() {
        if (state.timer.intervalId) {
            clearInterval(state.timer.intervalId);
            state.timer.intervalId = null;
        }
    }

    function updateTimerUI() {
        const { remaining, total, paused } = state.timer;
        const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
        els.modalTimerText.textContent = remaining > 0 ? `${remaining}s left${paused ? ' (Paused)' : ''}` : 'Time’s up!';
        els.btnTimerToggle.textContent = paused ? 'Resume' : 'Pause';
        els.modalTimerFill.style.width = `${pct}%`;

        els.modalTimerFill.classList.remove('bg-green', 'bg-orange', 'bg-pink');
        if (pct > 50) els.modalTimerFill.classList.add('bg-green');
        else if (pct > 25) els.modalTimerFill.classList.add('bg-orange');
        else els.modalTimerFill.classList.add('bg-pink');
    }

    function startModalTimer(seconds) {
        stopModalTimer();
        if (!seconds || seconds <= 0) {
            els.modalTimerBarWrap.classList.add('hidden');
            return;
        }
        state.timer.total = seconds;
        state.timer.remaining = seconds;
        state.timer.paused = false;
        els.modalTimerBarWrap.classList.remove('hidden');
        updateTimerUI();

        state.timer.intervalId = setInterval(() => {
            if (state.timer.paused) return;
            state.timer.remaining = Math.max(0, state.timer.remaining - 1);
            updateTimerUI();
            if (state.timer.remaining > 0 && state.timer.remaining <= 5) {
                SoundEngine.tick();
            }
            if (state.timer.remaining === 0) {
                stopModalTimer();
                SoundEngine.timeUp();
            }
        }, 1000);
    }

    function closeTileModalDOM() {
        els.modalTile.classList.add('hidden');
        els.modalTileCard.classList.remove('animate-trap-shake', 'animate-gift-bounce');
    }

    function openTile(idx) {
        const G = state.game;
        if (!G) return;
        const tile = G.tiles[idx];
        if (!tile || tile.used) return;

        // Snapshot state before opening so Undo reverts cleanly even back to tile closed!
        pushUndoSnapshot();

        tile.used = true;
        if (tile.kind === 'q') {
            G.modal = { i: idx, kind: 'q', q: tile.q, a: tile.a, showAnswer: false };
            SoundEngine.openQuestion();
            startModalTimer(G.timerSec);
        } else if (tile.kind === 'trap') {
            const activeTraps = TRAPS.filter(t => G.enabledTraps.includes(t.id));
            const fx = pick(activeTraps.length ? activeTraps : TRAPS);
            G.modal = { i: idx, kind: 'trap', fx };
            tile.outcome = 'trap';
            tile.outcomeIcon = fx.icon;
            G.teams[G.cur].stats.traps += 1;
            stopModalTimer();
            els.modalTimerBarWrap.classList.add('hidden');
            SoundEngine.trap();
        } else {
            const activeGifts = GIFTS.filter(g => G.enabledGifts.includes(g.id));
            const fx = pick(activeGifts.length ? activeGifts : GIFTS);
            G.modal = { i: idx, kind: 'gift', fx };
            tile.outcome = 'gift';
            tile.outcomeIcon = fx.icon;
            G.teams[G.cur].stats.gifts += 1;
            stopModalTimer();
            els.modalTimerBarWrap.classList.add('hidden');
            SoundEngine.gift();
        }

        renderGameBoard();
        renderTileModal();
    }

    function computeTargetPreview(fxId, curTeam, targetTeam, pts) {
        switch (fxId) {
            case 'give': {
                const amt = Math.min(pts, curTeam.score);
                return `Give +${amt} → ${targetTeam.score + amt}`;
            }
            case 'steal': {
                const amt = Math.min(pts, targetTeam.score);
                return `Steal +${amt} (${targetTeam.score} → ${targetTeam.score - amt})`;
            }
            case 'swap':
                return `Swap (${targetTeam.score} ↔ ${curTeam.score})`;
            default:
                return `${targetTeam.score} pts`;
        }
    }

    function computeSingleEffectPreview(fxId, curTeam, pts) {
        const s = curTeam.score;
        switch (fxId) {
            case 'lose': {
                const after = Math.max(0, s - pts);
                return `${curTeam.name}: ${s} → ${after} pts`;
            }
            case 'half': {
                const after = Math.floor(s / 2);
                return `${curTeam.name}: ${s} → ${after} pts`;
            }
            case 'skip':
                return `${curTeam.name} skips next turn`;
            case 'bonus':
                return `${curTeam.name}: ${s} → ${s + pts * 2} pts (+${pts * 2})`;
            case 'double':
                return `${curTeam.name}: ${s} → ${s * 2} pts (×2)`;
            case 'extra':
                return `${curTeam.name} gets another pick!`;
            default:
                return '';
        }
    }

    function renderTileModal() {
        const G = state.game;
        const m = G && G.modal;
        if (!m) {
            closeTileModalDOM();
            return;
        }

        const meta = m.kind === 'q'
            ? { icon: 'help-circle', title: 'Question', headerCls: 'bg-blue text-white' }
            : m.kind === 'trap'
                ? { icon: 'skull', title: 'Trap!', headerCls: 'bg-pink text-white' }
                : { icon: 'gift', title: 'Gift!', headerCls: 'bg-green text-dark' };

        els.modalTileHeader.className = `${meta.headerCls} px-5 py-3.5 border-b-[3px] border-dark dark:border-slate-500 flex items-center justify-between gap-3`;
        els.modalTileIconWrap.innerHTML = `<i data-lucide="${meta.icon}" class="w-6 h-6 stroke-[2.5]"></i>`;
        els.modalTileTitle.textContent = meta.title;
        els.modalTileNum.textContent = `Tile #${m.i + 1}`;
        els.btnReturnTile.classList.toggle('hidden', m.kind !== 'q');

        // Reset and apply special reveal motion
        els.modalTileCard.classList.remove('animate-trap-shake', 'animate-gift-bounce', 'animate-pop-in');
        void els.modalTileCard.offsetWidth;
        if (m.kind === 'trap') els.modalTileCard.classList.add('animate-trap-shake');
        else if (m.kind === 'gift') els.modalTileCard.classList.add('animate-gift-bounce');
        else els.modalTileCard.classList.add('animate-pop-in');

        const curTeam = G.teams[G.cur];

        if (m.kind === 'q') {
            const answerBlock = m.a
                ? (m.showAnswer
                    ? `<div class="mt-card-sm border-dashed bg-green/15 dark:bg-green/20 px-5 py-4 text-center animate-pop-in">
                            <span class="block text-[11px] font-heading font-bold uppercase tracking-widest text-green mb-1">Answer</span>
                            <p class="font-heading font-bold text-2xl md:text-3xl">${esc(m.a)}</p>
                       </div>`
                    : `<div class="text-center">
                            <button type="button" data-modal-act="show-answer"
                                class="mt-btn rounded-xl bg-chalk dark:bg-slate-800 px-5 py-2.5 font-heading font-bold text-base uppercase inline-flex items-center gap-2">
                                <i data-lucide="eye" class="w-5 h-5 stroke-[2.5]"></i> Show Answer (Space)
                            </button>
                       </div>`)
                : `<p class="text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">Open Speaking / Class Prompt — Teacher Judges Live</p>`;

            const stealBlock = G.allowSteal && G.teams.length > 1
                ? `<div class="pt-3 border-t-2 border-slate-100 dark:border-slate-800 space-y-2">
                        <p class="text-center text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Wrong answer? Let another team steal +${G.pts} pts:
                        </p>
                        <div class="flex flex-wrap justify-center gap-2">
                            ${G.teams.map((t, idx) => idx === G.cur ? '' : `
                                <button type="button" data-modal-act="steal-answer" data-team="${idx}"
                                    class="mt-btn rounded-xl px-3.5 py-1.5 font-heading font-bold text-xs uppercase flex items-center gap-1"
                                    style="background:${t.color};color:${t.txt}">
                                    <i data-lucide="zap" class="w-3.5 h-3.5 stroke-[2.5]"></i>
                                    ${esc(t.name)} +${G.pts}
                                </button>
                            `).join('')}
                        </div>
                   </div>`
                : '';

            els.modalTileBody.innerHTML = `
                <div class="space-y-5">
                    <div class="text-center">
                        <div class="flex items-center justify-center gap-2 flex-wrap mb-3">
                            <span class="inline-block px-3 py-0.5 rounded-full border-2 border-dark dark:border-slate-600 text-xs font-heading font-bold uppercase"
                                style="background:${curTeam.color};color:${curTeam.txt}">
                                ${esc(curTeam.name)}’s Turn
                            </span>
                            <span class="inline-block px-3 py-0.5 rounded-full border-2 border-dark dark:border-slate-600 bg-orange/20 text-xs font-heading font-bold uppercase">
                                Worth +${G.pts} Pts
                            </span>
                        </div>
                        <p class="font-heading font-bold projector-question-text">${esc(m.q)}</p>
                    </div>

                    ${answerBlock}

                    <div class="grid grid-cols-2 gap-3 pt-1">
                        <button type="button" data-modal-act="right"
                            class="mt-btn rounded-2xl bg-green text-dark py-3.5 px-4 font-heading font-bold text-xl uppercase flex items-center justify-center gap-2">
                            <i data-lucide="check" class="w-6 h-6 stroke-[3]"></i> Correct +${G.pts}
                        </button>
                        <button type="button" data-modal-act="wrong"
                            class="mt-btn rounded-2xl bg-pink text-white py-3.5 px-4 font-heading font-bold text-xl uppercase flex items-center justify-center gap-2">
                            <i data-lucide="x" class="w-6 h-6 stroke-[3]"></i> Wrong
                        </button>
                    </div>

                    ${stealBlock}
                </div>
            `;
        } else {
            const fx = m.fx;
            const badgeBg = m.kind === 'trap' ? 'bg-pink text-white' : 'bg-green text-dark';
            const previewText = fx.target ? '' : computeSingleEffectPreview(fx.id, curTeam, G.pts);

            const actionArea = fx.target
                ? `<div class="space-y-2.5 pt-2">
                        <p class="text-center text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Step 1: Choose Rival Team
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            ${G.teams.map((t, idx) => idx === G.cur ? '' : `
                                <button type="button" data-modal-act="target" data-team="${idx}"
                                    class="mt-btn rounded-2xl px-4 py-3 text-left flex items-center justify-between gap-2"
                                    style="background:${t.color};color:${t.txt}">
                                    <span class="font-heading font-bold text-lg truncate">${esc(t.name)}</span>
                                    <span class="text-xs font-extrabold bg-black/15 px-2.5 py-1 rounded-lg shrink-0">
                                        ${esc(computeTargetPreview(fx.id, curTeam, t, G.pts))}
                                    </span>
                                </button>
                            `).join('')}
                        </div>
                   </div>`
                : `<div class="space-y-3 pt-1">
                        ${previewText ? `
                            <div class="mt-card-sm bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-heading font-bold text-base md:text-lg">
                                ${esc(previewText)}
                            </div>` : ''}
                        <button type="button" data-modal-act="apply"
                            class="mt-btn w-full rounded-2xl bg-orange text-dark py-3.5 font-heading font-bold text-xl uppercase">
                            Apply Effect
                        </button>
                   </div>`;

            els.modalTileBody.innerHTML = `
                <div class="text-center space-y-4">
                    <div class="flex justify-center">
                        <div class="w-20 h-20 md:w-24 md:h-24 rounded-3xl ${badgeBg} border-4 border-dark dark:border-slate-500 shadow-[0_5px_0_#0f172a] dark:shadow-[0_5px_0_#000] flex items-center justify-center">
                            <i data-lucide="${fx.icon}" class="w-11 h-11 md:w-12 md:h-12 stroke-[2.5]"></i>
                        </div>
                    </div>
                    <div>
                        <span class="inline-block px-3 py-0.5 rounded-full border-2 border-dark dark:border-slate-600 text-xs font-heading font-bold uppercase mb-2"
                            style="background:${curTeam.color};color:${curTeam.txt}">
                            ${esc(curTeam.name)}
                        </span>
                        <h3 class="font-heading font-bold text-4xl md:text-5xl uppercase tracking-tight">${esc(fx.name)}</h3>
                        <p class="text-lg md:text-xl font-extrabold text-slate-600 dark:text-slate-300 mt-1">${esc(fx.desc(G.pts))}</p>
                    </div>
                    ${actionArea}
                </div>
            `;
        }

        els.modalTile.classList.remove('hidden');
        refreshIcons(els.modalTile);
    }

    function applyFx(fx, targetIdx) {
        const G = state.game;
        if (!G || !fx) return;
        const curIdx = G.cur;
        const curTeam = G.teams[curIdx];
        const target = typeof targetIdx === 'number' ? G.teams[targetIdx] : null;
        const P = G.pts;
        let extraTurn = false;
        let notice = '';

        switch (fx.id) {
            case 'lose': {
                const lost = Math.min(P, curTeam.score);
                curTeam.score = Math.max(0, curTeam.score - P);
                state.scoreDeltas[curIdx] = `-${lost}`;
                notice = `Bomb! ${curTeam.name} -${lost}`;
                break;
            }
            case 'half': {
                const prev = curTeam.score;
                curTeam.score = Math.floor(curTeam.score / 2);
                const diff = prev - curTeam.score;
                state.scoreDeltas[curIdx] = diff > 0 ? `-${diff}` : '½';
                notice = `Snip snip! ${curTeam.name} halved to ${curTeam.score}`;
                break;
            }
            case 'skip':
                curTeam.skip = true;
                notice = `Frozen! ${curTeam.name} skips next turn`;
                break;
            case 'give':
                if (target) {
                    const amt = Math.min(P, curTeam.score);
                    curTeam.score -= amt;
                    target.score += amt;
                    state.scoreDeltas[curIdx] = `-${amt}`;
                    state.scoreDeltas[targetIdx] = `+${amt}`;
                    notice = `${curTeam.name} gave +${amt} to ${target.name}`;
                }
                break;
            case 'bonus':
                curTeam.score += P * 2;
                state.scoreDeltas[curIdx] = `+${P * 2}`;
                notice = `Bonus! ${curTeam.name} +${P * 2}`;
                break;
            case 'double': {
                const gained = curTeam.score;
                curTeam.score *= 2;
                state.scoreDeltas[curIdx] = gained > 0 ? `+${gained}` : '×2';
                notice = `Double up! ${curTeam.name} now ${curTeam.score}`;
                break;
            }
            case 'steal':
                if (target) {
                    const amt = Math.min(P, target.score);
                    target.score -= amt;
                    curTeam.score += amt;
                    state.scoreDeltas[curIdx] = `+${amt}`;
                    state.scoreDeltas[targetIdx] = `-${amt}`;
                    notice = `${curTeam.name} stole +${amt} from ${target.name}`;
                }
                break;
            case 'swap':
                if (target) {
                    [curTeam.score, target.score] = [target.score, curTeam.score];
                    state.scoreDeltas[curIdx] = 'Swap';
                    state.scoreDeltas[targetIdx] = 'Swap';
                    notice = `Switcheroo! ${curTeam.name} ↔ ${target.name}`;
                }
                break;
            case 'extra':
                extraTurn = true;
                break;
        }

        closeTileModalDOM();
        advanceTurn(extraTurn, notice);
    }

    function renderEndScreen() {
        const G = state.game;
        if (!G) return;

        const sorted = [...G.teams].sort((a, b) => b.score - a.score);
        const topScore = sorted[0].score;
        const winners = sorted.filter(t => t.score === topScore);

        els.endHeadline.textContent = winners.length > 1
            ? `${winners.map(w => w.name).join(' & ')} Tie!`
            : `${winners[0].name} Wins!`;

        els.endLeaderboard.innerHTML = sorted.map((t, rank) => `
            <div class="mt-card-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                style="background:${t.color};color:${t.txt}">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-9 h-9 rounded-xl bg-white text-dark border-2 border-dark font-heading font-bold text-lg flex items-center justify-center shrink-0">
                        #${rank + 1}
                    </span>
                    <div class="min-w-0">
                        <div class="font-heading font-bold text-xl md:text-2xl truncate">${esc(t.name)}</div>
                        <div class="text-xs font-extrabold opacity-85">
                            Correct: ${t.stats?.right || 0} · Traps: ${t.stats?.traps || 0} · Gifts: ${t.stats?.gifts || 0}
                        </div>
                    </div>
                </div>
                <div class="font-heading font-bold text-3xl md:text-4xl tabular-nums">${t.score}</div>
            </div>
        `).join('');
    }

    /* =========================================================================
       BULK IMPORT INTEGRATION (KlassKitBulkImport)
    ========================================================================= */
    const BULK_TEMPLATE = `# Unit Review Questions
What is the past tense of "go"? | went
What is the opposite of "expensive"? | cheap
- Complete: She ___ (not like) pizza.
= doesn't like
Describe your favorite weekend activity.`;

    function parseBulkMysteryImport(rawText) {
        const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
        let detectedTitle = '';
        const items = [];
        let pendingQuestion = null;

        const flushPending = () => {
            if (pendingQuestion && pendingQuestion.q) {
                items.push(pendingQuestion);
            }
            pendingQuestion = null;
        };

        lines.forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) {
                flushPending();
                return;
            }
            if (/^#{1,2}\s+/.test(line) && !detectedTitle && items.length === 0 && !pendingQuestion) {
                detectedTitle = line.replace(/^#{1,2}\s+/, '').trim();
                return;
            }
            // Handle "= Answer" or "A: Answer" continuation line
            if (pendingQuestion && (/^=\s*/.test(line) || /^a:\s*/i.test(line))) {
                const ans = line.replace(/^(?:=\s*|a:\s*)/i, '').trim();
                pendingQuestion.a = pendingQuestion.a ? `${pendingQuestion.a} ${ans}` : ans;
                flushPending();
                return;
            }

            // Otherwise treat as new question (possibly with |, ;, or tab separator)
            flushPending();
            let clean = line.replace(/^(?:[-*•]\s*|\d+[.)]\s*|q:\s*)/i, '').trim();
            let q = clean;
            let a = '';

            if (clean.includes('|')) {
                const parts = clean.split('|');
                q = parts[0].trim();
                a = parts.slice(1).join('|').trim();
            } else if (clean.includes('\t')) {
                const parts = clean.split('\t');
                q = parts[0].trim();
                a = parts.slice(1).join(' ').trim();
            } else if (clean.includes(';')) {
                const parts = clean.split(';');
                q = parts[0].trim();
                a = parts.slice(1).join(';').trim();
            }

            if (q) {
                pendingQuestion = { q, a };
                // If line already had an explicit separator answer or didn't use `- ` prefix, flush only if separator gave answer
                if (a) flushPending();
            }
        });
        flushPending();

        const warnings = [];
        const withAnswers = items.filter(it => it.a).length;
        if (items.length > 0 && withAnswers < items.length) {
            warnings.push(`${items.length - withAnswers} question(s) have no answer and will appear as open prompts.`);
        }

        const badges = items.slice(0, 6).map((it, idx) => ({
            tag: `Q${idx + 1}`,
            label: it.q,
            meta: it.a ? `Ans: ${it.a}` : 'Open prompt',
            tone: ['blue', 'pink', 'green', 'orange'][idx % 4]
        }));
        if (items.length > 6) {
            badges.push({
                tag: `+${items.length - 6}`,
                label: `${items.length - 6} more questions ready`,
                meta: 'Full list',
                tone: 'slate'
            });
        }

        return {
            title: detectedTitle,
            items,
            warnings,
            badges
        };
    }

    function openBulkImportModal() {
        if (!window.KlassKitBulkImport) {
            showToast('Bulk importer unavailable.', 'bg-pink text-white');
            return;
        }
        if (!state.bulkImportModal) {
            state.bulkImportModal = window.KlassKitBulkImport.create({
                id: 'mt-bulk-import-overlay',
                title: 'BULK IMPORT QUESTIONS',
                subtitle: 'Paste Q | Answer lines, Q:/A: blocks, or AI-generated classroom lists.',
                accentColor: 'orange',
                unitLabel: 'question',
                unitLabelPlural: 'questions',
                guideItems: [
                    { label: 'Pipe Format', syntax: 'Question | Answer', color: 'blue', desc: 'Classic fast single-line format. Answer is optional.' },
                    { label: 'Two-Line Pairs', syntax: '- Question\n= Answer', color: 'green', desc: 'Use - Question and = Answer (or Q: / A:).' },
                    { label: 'Set Title', syntax: '# Set Title', color: 'pink', desc: 'Optional heading on line 1 updates the set name.' }
                ],
                placeholder: BULK_TEMPLATE,
                template: BULK_TEMPLATE,
                sample: BULK_TEMPLATE,
                options: [
                    { id: 'replaceExisting', label: 'Replace current questions (uncheck to append)', defaultChecked: true },
                    { id: 'saveSet', label: 'Save immediately to Your Saved Sets', defaultChecked: false }
                ],
                confirmText: 'Import Questions',
                parse: parseBulkMysteryImport,
                onCopyTemplate: () => showToast('Template copied!', 'bg-orange text-dark'),
                onImport: (result, opts) => {
                    if (!result || !result.items || result.items.length === 0) return false;
                    const existing = opts && opts.replaceExisting ? [] : parseQuestionsText(state.setup.questionsText);
                    const merged = [...existing, ...result.items];
                    state.setup.questionsText = questionsToText(merged);
                    if (result.title) {
                        state.setup.title = result.title;
                    }
                    if (opts && opts.saveSet) {
                        const saved = buildCurrentSetSnapshot(`set-${Date.now()}`, state.setup.title);
                        state.customSets.unshift(saved);
                        state.activeSetId = saved.id;
                        scheduleCloudSync();
                    } else {
                        saveDraftToLocal();
                    }
                    renderSetup();
                    showToast(`Imported ${result.items.length} questions!`, 'bg-green text-dark');
                    return true;
                }
            });
        }
        state.bulkImportModal.open();
    }

    /* =========================================================================
       EVENT WIRING
    ========================================================================= */
    function bindEvents() {
        // Sound & Theme & Help
        els.btnSound.addEventListener('click', () => {
            const muted = SoundEngine.toggleMute();
            els.iconSoundOn.classList.toggle('hidden', muted);
            els.iconSoundOff.classList.toggle('hidden', !muted);
            showToast(muted ? 'Sound Muted' : 'Sound Enabled', 'bg-dark text-white dark:bg-slate-800');
        });

        els.btnTheme.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
            SoundEngine.click();
        });

        els.btnHelp.addEventListener('click', () => {
            els.modalHelp.classList.remove('hidden');
            refreshIcons(els.modalHelp);
            SoundEngine.click();
        });
        els.btnCloseHelp.addEventListener('click', () => els.modalHelp.classList.add('hidden'));
        els.modalHelp.addEventListener('click', e => {
            if (e.target === els.modalHelp) els.modalHelp.classList.add('hidden');
        });

        // Header In-Game Actions
        els.btnUndo.addEventListener('click', undoLastAction);

        els.btnEndGame.addEventListener('click', () => {
            showSystemModal({
                title: 'Match Options',
                message: 'Choose whether to show final results now, reshuffle with the current setup, or return to Setup.',
                headerClass: 'bg-pink text-white',
                cancelText: 'Keep Playing',
                confirmText: 'End & Show Podium',
                confirmClass: 'bg-green text-dark',
                extraActions: [
                    {
                        label: 'Reshuffle Board',
                        className: 'bg-orange text-dark',
                        onClick: () => startNewGame()
                    },
                    {
                        label: 'Back to Setup',
                        className: 'bg-blue text-white',
                        onClick: () => {
                            stopModalTimer();
                            closeTileModalDOM();
                            state.game = null;
                            saveDraftToLocal();
                            switchView('setup');
                            renderSetup();
                        }
                    }
                ],
                onConfirm: () => finishGame()
            });
        });

        // Resume Match Banner
        els.btnResumeMatch.addEventListener('click', () => {
            if (!state.pendingResumeGame) return;
            state.game = state.pendingResumeGame;
            state.game.modal = null;
            state.pendingResumeGame = null;
            switchView('game');
            renderGameBoard();
            showToast('Resumed match!', 'bg-green text-dark');
        });

        els.btnDiscardMatch.addEventListener('click', () => {
            state.pendingResumeGame = null;
            state.game = null;
            els.resumeBanner.classList.add('hidden');
            saveDraftToLocal();
        });

        // Team Setup Controls
        els.teamCountGroup.addEventListener('click', e => {
            const btn = e.target.closest('[data-team-count]');
            if (!btn) return;
            state.setup.teamCount = Number(btn.dataset.teamCount);
            SoundEngine.click();
            renderTeamSetup();
            saveDraftToLocal();
        });

        els.teamList.addEventListener('click', e => {
            const swatchBtn = e.target.closest('[data-cycle-color]');
            if (!swatchBtn) return;
            const i = Number(swatchBtn.dataset.cycleColor);
            state.setup.teamColors[i] = ((state.setup.teamColors[i] ?? i) + 1) % TEAM_PALETTE.length;
            SoundEngine.click();
            renderTeamSetup();
            saveDraftToLocal();
        });

        els.teamList.addEventListener('input', e => {
            const inp = e.target.closest('[data-team-name]');
            if (!inp) return;
            const i = Number(inp.dataset.teamName);
            state.setup.teamNames[i] = inp.value;
            saveDraftToLocal();
        });

        els.btnShuffleTeams.addEventListener('click', () => {
            const count = state.setup.teamCount;
            const slice = Array.from({ length: count }, (_, i) => ({
                name: state.setup.teamNames[i],
                color: state.setup.teamColors[i]
            }));
            const mixed = shuffle(slice);
            mixed.forEach((item, i) => {
                state.setup.teamNames[i] = item.name;
                state.setup.teamColors[i] = item.color;
            });
            SoundEngine.click();
            renderTeamSetup();
            saveDraftToLocal();
            showToast('Team order shuffled!', 'bg-pink text-white');
        });

        // Tiles & Rules Controls
        els.inputPts.addEventListener('input', () => {
            state.setup.pts = Math.max(1, parseInt(els.inputPts.value, 10) || 1);
            updateTileCountsSummary();
            saveDraftToLocal();
        });
        els.inputTraps.addEventListener('input', () => {
            state.setup.traps = Math.max(0, parseInt(els.inputTraps.value, 10) || 0);
            updateTileCountsSummary();
            saveDraftToLocal();
        });
        els.inputGifts.addEventListener('input', () => {
            state.setup.gifts = Math.max(0, parseInt(els.inputGifts.value, 10) || 0);
            updateTileCountsSummary();
            saveDraftToLocal();
        });
        els.quickPtsGroup.addEventListener('click', e => {
            const chip = e.target.closest('.pts-chip');
            if (!chip) return;
            state.setup.pts = Number(chip.dataset.pts);
            els.inputPts.value = state.setup.pts;
            SoundEngine.click();
            updateTileCountsSummary();
            saveDraftToLocal();
        });
        els.selectTimer.addEventListener('change', () => {
            state.setup.timerSec = Number(els.selectTimer.value) || 0;
            saveDraftToLocal();
        });
        els.toggleRevealBadge.addEventListener('change', () => {
            state.setup.revealBadge = els.toggleRevealBadge.checked;
            saveDraftToLocal();
        });
        els.toggleAllowSteal.addEventListener('change', () => {
            state.setup.allowSteal = els.toggleAllowSteal.checked;
            saveDraftToLocal();
        });

        // Trap & Gift Pool Customizer
        const handlePoolClick = e => {
            const btn = e.target.closest('[data-pool-id]');
            if (!btn) return;
            const kind = btn.dataset.poolKind;
            const id = btn.dataset.poolId;
            const key = kind === 'trap' ? 'enabledTraps' : 'enabledGifts';
            const list = state.setup[key];
            if (list.includes(id)) {
                if (list.length <= 1) {
                    showToast(`Keep at least 1 ${kind} enabled.`, 'bg-pink text-white');
                    return;
                }
                state.setup[key] = list.filter(x => x !== id);
            } else {
                state.setup[key] = [...list, id];
            }
            SoundEngine.click();
            renderPowerUpPools();
            saveDraftToLocal();
        };
        els.poolTraps.addEventListener('click', handlePoolClick);
        els.poolGifts.addEventListener('click', handlePoolClick);

        // Library & Set Actions
        els.inputSetTitle.addEventListener('input', () => {
            state.setup.title = els.inputSetTitle.value;
            saveDraftToLocal();
        });
        els.btnSaveSet.addEventListener('click', () => handleSaveSet(false));
        els.btnSaveAs.addEventListener('click', () => handleSaveSet(true));
        els.btnNewSet.addEventListener('click', handleNewBlankSet);
        els.btnDeleteSet.addEventListener('click', handleDeleteActiveSet);

        els.presetsStrip.addEventListener('click', e => {
            const btn = e.target.closest('[data-load-preset]');
            if (!btn) return;
            const preset = state.presets.find(p => p.id === btn.dataset.loadPreset);
            if (preset) {
                SoundEngine.click();
                applySetData(preset);
            }
        });

        els.savedSetsStrip.addEventListener('click', e => {
            const btn = e.target.closest('[data-load-custom]');
            if (!btn) return;
            const custom = state.customSets.find(s => s.id === btn.dataset.loadCustom);
            if (custom) {
                SoundEngine.click();
                applySetData(custom);
            }
        });

        // Question Editor Controls
        els.tabModeText.addEventListener('click', () => {
            state.editorMode = 'text';
            SoundEngine.click();
            renderEditorMode();
        });
        els.tabModeCards.addEventListener('click', () => {
            state.editorMode = 'cards';
            SoundEngine.click();
            renderEditorMode();
        });

        els.inputQuestionsText.addEventListener('input', () => {
            state.setup.questionsText = els.inputQuestionsText.value;
            updateTileCountsSummary();
            saveDraftToLocal();
        });

        els.visualCardsList.addEventListener('input', e => {
            if (!e.target.closest('[data-card-field]')) return;
            const domRows = Array.from(els.visualCardsList.querySelectorAll('[data-card-row]')).map(rowEl => {
                const qVal = (rowEl.querySelector('[data-card-field="q"]')?.value || '').trim();
                const aVal = (rowEl.querySelector('[data-card-field="a"]')?.value || '').trim();
                return { q: qVal, a: aVal };
            }).filter(r => r.q.length > 0 || r.a.length > 0);
            state.setup.questionsText = questionsToText(domRows);
            updateTileCountsSummary();
            saveDraftToLocal();
        });

        els.visualCardsList.addEventListener('click', e => {
            const delBtn = e.target.closest('[data-card-del]');
            if (delBtn) {
                const idx = Number(delBtn.dataset.cardDel);
                const rows = parseQuestionsText(state.setup.questionsText);
                rows.splice(idx, 1);
                state.setup.questionsText = questionsToText(rows);
                SoundEngine.click();
                renderVisualCards();
                updateTileCountsSummary();
                saveDraftToLocal();
                return;
            }
            const moveBtn = e.target.closest('[data-card-move]');
            if (moveBtn) {
                const idx = Number(moveBtn.dataset.cardMove);
                const dir = Number(moveBtn.dataset.dir);
                const rows = parseQuestionsText(state.setup.questionsText);
                const targetIdx = idx + dir;
                if (targetIdx < 0 || targetIdx >= rows.length) return;
                [rows[idx], rows[targetIdx]] = [rows[targetIdx], rows[idx]];
                state.setup.questionsText = questionsToText(rows);
                SoundEngine.click();
                renderVisualCards();
                saveDraftToLocal();
            }
        });

        els.btnAddQCard.addEventListener('click', () => {
            const rows = parseQuestionsText(state.setup.questionsText);
            rows.push({ q: 'New question?', a: '' });
            state.setup.questionsText = questionsToText(rows);
            SoundEngine.click();
            renderVisualCards();
            updateTileCountsSummary();
            saveDraftToLocal();
            const inputs = els.visualCardsList.querySelectorAll('[data-card-field="q"]');
            if (inputs.length) {
                const last = inputs[inputs.length - 1];
                last.focus();
                last.select();
            }
        });

        els.btnShuffleQuestions.addEventListener('click', () => {
            const rows = parseQuestionsText(state.setup.questionsText);
            if (rows.length < 2) return;
            state.setup.questionsText = questionsToText(shuffle(rows));
            SoundEngine.click();
            renderEditorMode();
            saveDraftToLocal();
            showToast('Question list shuffled!', 'bg-orange text-dark');
        });

        els.btnBulkImport.addEventListener('click', openBulkImportModal);
        els.btnStartGame.addEventListener('click', () => startNewGame());
        if (els.btnStartGameTop) {
            els.btnStartGameTop.addEventListener('click', () => startNewGame());
        }

        // Keep Chromebook / Projector tile grid tightly fitted on resize
        window.addEventListener('resize', fitTileGridToViewport);
        if (typeof ResizeObserver === 'function' && els.tilesGridWrap) {
            new ResizeObserver(fitTileGridToViewport).observe(els.tilesGridWrap);
        }

        // Game Board Events
        els.scoreboardGrid.addEventListener('click', e => {
            const adj = e.target.closest('[data-adj-team]');
            if (!adj || !state.game) return;
            pushUndoSnapshot();
            const i = Number(adj.dataset.adjTeam);
            const delta = Number(adj.dataset.adjDir) * state.game.pts;
            const team = state.game.teams[i];
            const prev = team.score;
            team.score = Math.max(0, team.score + delta);
            const diff = team.score - prev;
            if (diff !== 0) {
                state.scoreDeltas[i] = diff > 0 ? `+${diff}` : `${diff}`;
            }
            SoundEngine.click();
            saveDraftToLocal();
            renderGameBoard();
        });

        els.tilesGrid.addEventListener('click', e => {
            const tileBtn = e.target.closest('[data-open-tile]');
            if (!tileBtn) return;
            openTile(Number(tileBtn.dataset.openTile));
        });

        // Tile Modal Actions
        els.btnReturnTile.addEventListener('click', () => {
            const G = state.game;
            const m = G && G.modal;
            if (!m || m.kind !== 'q') return;
            stopModalTimer();
            closeTileModalDOM();
            G.tiles[m.i].used = false;
            G.tiles[m.i].outcome = null;
            G.modal = null;
            // Remove the pre-open undo snapshot since the tile is back as if unopened
            if (G.history && G.history.length > 0) G.history.pop();
            SoundEngine.click();
            saveDraftToLocal();
            renderGameBoard();
            showToast(`Returned Tile #${m.i + 1}`, 'bg-dark text-white dark:bg-slate-800');
        });

        els.btnTimerToggle.addEventListener('click', () => {
            state.timer.paused = !state.timer.paused;
            SoundEngine.click();
            updateTimerUI();
        });

        els.btnTimerPlus10.addEventListener('click', () => {
            state.timer.total += 10;
            state.timer.remaining += 10;
            SoundEngine.click();
            updateTimerUI();
        });

        els.modalTileBody.addEventListener('click', e => {
            const btn = e.target.closest('[data-modal-act]');
            if (!btn || !state.game || !state.game.modal) return;
            const G = state.game;
            const m = G.modal;
            const action = btn.dataset.modalAct;

            if (action === 'show-answer') {
                m.showAnswer = true;
                SoundEngine.click();
                renderTileModal();
                return;
            }
            if (action === 'right') {
                stopModalTimer();
                G.teams[G.cur].score += G.pts;
                G.teams[G.cur].stats.right += 1;
                G.tiles[m.i].outcome = 'right';
                state.scoreDeltas[G.cur] = `+${G.pts}`;
                const notice = `${G.teams[G.cur].name} +${G.pts} pts!`;
                SoundEngine.correct();
                closeTileModalDOM();
                advanceTurn(false, notice);
                return;
            }
            if (action === 'wrong') {
                stopModalTimer();
                G.tiles[m.i].outcome = 'wrong';
                const notice = `${G.teams[G.cur].name} missed`;
                SoundEngine.wrong();
                closeTileModalDOM();
                advanceTurn(false, notice);
                return;
            }
            if (action === 'steal-answer') {
                stopModalTimer();
                const targetIdx = Number(btn.dataset.team);
                let stealNotice = '';
                if (G.teams[targetIdx]) {
                    G.teams[targetIdx].score += G.pts;
                    G.teams[targetIdx].stats.right += 1;
                    state.scoreDeltas[targetIdx] = `+${G.pts}`;
                    stealNotice = `${G.teams[targetIdx].name} stole +${G.pts} pts!`;
                }
                G.tiles[m.i].outcome = 'right';
                SoundEngine.correct();
                closeTileModalDOM();
                advanceTurn(false, stealNotice);
                return;
            }
            if (action === 'apply') {
                SoundEngine.click();
                applyFx(m.fx, null);
                return;
            }
            if (action === 'target') {
                SoundEngine.click();
                applyFx(m.fx, Number(btn.dataset.team));
            }
        });

        // End Screen Buttons
        els.btnPlayAgain.addEventListener('click', () => startNewGame());
        els.btnBackSetup.addEventListener('click', () => {
            state.game = null;
            saveDraftToLocal();
            switchView('setup');
            renderSetup();
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', e => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

            if (e.key === 'Escape') {
                if (!els.modalSystem.classList.contains('hidden')) {
                    els.modalSystem.classList.add('hidden');
                    return;
                }
                if (!els.modalHelp.classList.contains('hidden')) {
                    els.modalHelp.classList.add('hidden');
                    return;
                }
            }

            if (isTyping) return;

            if (e.code === 'Space' && !els.modalTile.classList.contains('hidden')) {
                const m = state.game && state.game.modal;
                if (m && m.kind === 'q' && m.a && !m.showAnswer) {
                    e.preventDefault();
                    m.showAnswer = true;
                    SoundEngine.click();
                    renderTileModal();
                }
                return;
            }

            if (e.key === 'Enter' && !els.modalTile.classList.contains('hidden')) {
                const applyBtn = els.modalTileBody.querySelector('[data-modal-act="apply"]');
                if (applyBtn) {
                    e.preventDefault();
                    applyBtn.click();
                }
                return;
            }

            if ((e.key === 'z' || e.key === 'Z') && state.view === 'game' && els.modalTile.classList.contains('hidden')) {
                e.preventDefault();
                undoLastAction();
                return;
            }

            if (e.key === 'm' || e.key === 'M') {
                els.btnSound.click();
            }
        });
    }

    /* =========================================================================
       BOOTSTRAP
    ========================================================================= */
    async function init() {
        try {
            if (typeof requireAuth === 'function') {
                const ok = await requireAuth();
                if (!ok) return;
            }
        } catch (err) {
            console.warn('[Mystery Tiles] requireAuth failed:', err);
        }

        const muted = SoundEngine.isMuted();
        els.iconSoundOn.classList.toggle('hidden', muted);
        els.iconSoundOff.classList.toggle('hidden', !muted);

        bindEvents();
        await loadInitialData();
        renderSetup();
        switchView('setup');
        refreshIcons(document);
    }

    document.addEventListener('DOMContentLoaded', init);
})();

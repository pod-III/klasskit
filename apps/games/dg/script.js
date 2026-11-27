/* ============================================
   DETECTIVE GAME - Forensics Engine
   KlassKit 1.9.1 Modular Script
   ============================================ */

(function () {
    'use strict';

    var STORAGE_KEY = 'kk_dg_state_v2';
    var THEME_KEY = 'theme_dg';

    var BEAM_RADII = {
        sm: { inner: 70, outer: 155 },
        md: { inner: 120, outer: 250 },
        lg: { inner: 185, outer: 360 }
    };

    var ICON_FALLBACKS = {
        bottle: 'milk',
        'alert-triangle': 'triangle-alert',
        'check-circle': 'circle-check',
        'x-circle': 'circle-x',
        'edit-3': 'pen-line'
    };

    var DIFFICULTY_STYLES = {
        EASY: { bg: 'bg-green text-white', rot: 'rotate-2' },
        MEDIUM: { bg: 'bg-blue text-white', rot: '-rotate-2' },
        HARD: { bg: 'bg-orange text-white', rot: 'rotate-2' },
        EXTREME: { bg: 'bg-pink text-white', rot: '-rotate-2' }
    };

    var state = {
        caseData: [],
        currentCase: null,
        timeLeft: 0,
        timerInterval: null,
        foundClues: [],
        hintsUsed: 0,
        devModeActive: false,
        flashlightActive: true,
        beamSize: 'md',
        gameStarted: false,
        isPaused: false,
        activeTab: 'briefing',
        evidenceFilter: 'all',
        lastDevCoord: { x: '0.00', y: '0.00' },
        pendingConfirmFn: null,
        toastTimer: null,
        hintPingTimer: null,
        pointerListenersBound: false,
        persisted: {
            solved: {},
            caseNotes: {},
            eliminatedSuspects: {},
            clueFlags: {},
            settings: {
                flashlight: true,
                beamSize: 'md'
            }
        }
    };

    // --- Safe Helpers ---
    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatRichText(str) {
        var escaped = escapeHTML(str);
        return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-dark dark:text-white underline decoration-orange decoration-2">$1</strong>');
    }

    function safeIcon(name) {
        if (!name || typeof name !== 'string') return 'search';
        return ICON_FALLBACKS[name] || name;
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function formatTime(totalSeconds) {
        var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        var m = Math.floor(sec / 60).toString().padStart(2, '0');
        var s = (sec % 60).toString().padStart(2, '0');
        return m + ':' + s;
    }

    function loadPersisted() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            if (parsed.solved && typeof parsed.solved === 'object') state.persisted.solved = parsed.solved;
            if (parsed.caseNotes && typeof parsed.caseNotes === 'object') state.persisted.caseNotes = parsed.caseNotes;
            if (parsed.eliminatedSuspects && typeof parsed.eliminatedSuspects === 'object') state.persisted.eliminatedSuspects = parsed.eliminatedSuspects;
            if (parsed.clueFlags && typeof parsed.clueFlags === 'object') state.persisted.clueFlags = parsed.clueFlags;
            if (parsed.settings && typeof parsed.settings === 'object') {
                if (typeof parsed.settings.flashlight === 'boolean') {
                    state.persisted.settings.flashlight = parsed.settings.flashlight;
                }
                if (BEAM_RADII[parsed.settings.beamSize]) {
                    state.persisted.settings.beamSize = parsed.settings.beamSize;
                }
            }
        } catch (err) {
            console.warn('Could not load saved detective progress:', err);
        }
    }

    function savePersisted() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.persisted));
        } catch (err) {
            console.warn('Could not save detective progress:', err);
        }
    }

    function setSlotIcon(slotId, iconName, iconClass) {
        var slot = $(slotId);
        if (!slot) return;
        slot.innerHTML = '<i data-lucide="' + escapeHTML(safeIcon(iconName)) + '" class="' + escapeHTML(iconClass || 'w-4 h-4') + '"></i>';
        refreshIcons();
    }

    function showToast(message, iconName) {
        var banner = $('toastBanner');
        var textEl = $('toastText');
        if (!banner || !textEl) return;

        textEl.textContent = message;
        setSlotIcon('toastIconSlot', iconName || 'info', 'w-4 h-4 text-blue');

        banner.classList.add('open');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function () {
            banner.classList.remove('open');
        }, 2600);
    }

    // --- Theme Controls ---
    function syncThemeIcon() {
        var isDark = document.documentElement.classList.contains('dark');
        setSlotIcon('themeToggleIconSlot', isDark ? 'sun' : 'moon', 'w-4 h-4');
    }

    function toggleTheme() {
        var isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        try {
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        } catch (e) {
            // ignore storage errors
        }
        syncThemeIcon();
    }

    // --- Flashlight Engine ---
    function updateFlashlight(x, y) {
        var overlay = $('flashlightOverlay');
        if (!overlay) return;
        if (state.devModeActive || !state.flashlightActive) {
            overlay.style.background = 'transparent';
            return;
        }
        var radii = BEAM_RADII[state.beamSize] || BEAM_RADII.md;
        overlay.style.background = 'radial-gradient(circle at ' + x + 'px ' + y + 'px, transparent 10%, rgba(2, 6, 23, 0.82) ' + radii.inner + 'px, rgba(2, 6, 23, 0.98) ' + radii.outer + 'px)';
    }

    function resetFlashlight() {
        var scene = $('sceneContainer');
        if (!scene) return;
        var rect = scene.getBoundingClientRect();
        var cx = rect.width ? rect.width / 2 : 300;
        var cy = rect.height ? rect.height / 2 : 200;
        updateFlashlight(cx, cy);
    }

    function syncFlashlightUI() {
        var btn = $('flashlightToggleBtn');
        var label = $('flashlightBtnLabel');
        var overlay = $('flashlightOverlay');
        var beamControls = $('beamControls');

        if (overlay) {
            overlay.style.opacity = (state.flashlightActive && !state.devModeActive) ? '1' : '0';
        }
        if (beamControls) {
            beamControls.classList.toggle('is-hidden', !state.flashlightActive || state.devModeActive);
        }
        if (btn && label) {
            if (state.flashlightActive) {
                btn.className = 'btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5';
                setSlotIcon('flashlightBtnIconSlot', 'flashlight', 'w-4 h-4 text-orange');
                label.textContent = 'Light: ON';
            } else {
                btn.className = 'btn-chunky bg-dark text-white dark:bg-slate-700 rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5';
                setSlotIcon('flashlightBtnIconSlot', 'flashlight-off', 'w-4 h-4 text-slate-300');
                label.textContent = 'Light: OFF';
            }
        }
        syncBeamButtonsUI();
        resetFlashlight();
    }

    function syncBeamButtonsUI() {
        ['sm', 'md', 'lg'].forEach(function (size) {
            var pill = $('beamBtn-' + size);
            if (!pill) return;
            pill.classList.toggle('is-active', state.beamSize === size);
        });
    }

    function toggleFlashlight() {
        state.flashlightActive = !state.flashlightActive;
        state.persisted.settings.flashlight = state.flashlightActive;
        savePersisted();
        syncFlashlightUI();
    }

    function setBeamSize(size) {
        if (!BEAM_RADII[size]) return;
        state.beamSize = size;
        state.persisted.settings.beamSize = size;
        savePersisted();
        syncBeamButtonsUI();
        resetFlashlight();
    }

    // --- Stage Overlays & Calibration Mode ---
    function syncStageOverlays() {
        var scene = $('sceneContainer');
        var startOverlay = $('startOverlay');
        var pauseOverlay = $('pauseOverlay');
        var devPanel = $('devModePanel');
        var devBadge = $('devStageBadge');
        var beamControls = $('beamControls');

        if (scene) {
            scene.classList.toggle('dev-mode', state.devModeActive);
        }
        if (devPanel) {
            devPanel.classList.toggle('open', state.devModeActive);
        }
        if (devBadge) {
            devBadge.classList.toggle('is-hidden', !state.devModeActive);
        }
        if (beamControls) {
            beamControls.classList.toggle('is-hidden', !state.flashlightActive || state.devModeActive);
        }

        if (!state.currentCase) return;

        var showStart = !state.gameStarted && !state.devModeActive;
        var showPause = state.gameStarted && state.isPaused && !state.devModeActive;

        if (scene) {
            scene.classList.toggle('is-locked', showStart || showPause);
        }
        if (startOverlay) {
            startOverlay.classList.toggle('is-hidden', !showStart);
        }
        if (pauseOverlay) {
            pauseOverlay.classList.toggle('is-hidden', !showPause);
        }
    }

    function toggleDevMode() {
        state.devModeActive = !state.devModeActive;
        syncStageOverlays();
        syncFlashlightUI();
        showToast(
            state.devModeActive ? 'Calibration Mode active — click scene for coordinates' : 'Calibration Mode closed',
            'wrench'
        );
    }

    function copyCoords() {
        var txt = '"pos": {"x": ' + state.lastDevCoord.x + ', "y": ' + state.lastDevCoord.y + '}';
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(txt).then(function () {
                showToast('Copied ' + txt, 'check');
            }).catch(function () {
                showToast('Coords: ' + txt, 'copy');
            });
        } else {
            showToast('Coords: ' + txt, 'copy');
        }
    }

    function dropCalibrationMarker(scene, normX, normY) {
        var marker = document.createElement('div');
        marker.className = 'dev-click-marker';
        marker.style.left = (normX * 100) + '%';
        marker.style.top = (normY * 100) + '%';
        scene.appendChild(marker);
        setTimeout(function () {
            marker.style.opacity = '0';
            setTimeout(function () {
                if (marker.parentNode) marker.parentNode.removeChild(marker);
            }, 350);
        }, 950);
    }

    function bindEventListeners() {
        if (state.pointerListenersBound) return;
        state.pointerListenersBound = true;

        var scene = $('sceneContainer');
        if (scene) {
            scene.addEventListener('mousemove', function (e) {
                var rect = scene.getBoundingClientRect();
                updateFlashlight(e.clientX - rect.left, e.clientY - rect.top);
            });

            scene.addEventListener('touchstart', function (e) {
                if (!e.touches || !e.touches[0]) return;
                var rect = scene.getBoundingClientRect();
                updateFlashlight(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
            }, { passive: true });

            scene.addEventListener('touchmove', function (e) {
                if (!e.touches || !e.touches[0]) return;
                var rect = scene.getBoundingClientRect();
                updateFlashlight(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
            }, { passive: true });

            scene.addEventListener('click', function (e) {
                if (!state.devModeActive) return;
                if (e.target && e.target.closest && (e.target.closest('#beamControls') || e.target.closest('#devStageBadge'))) {
                    return;
                }
                var rect = scene.getBoundingClientRect();
                var rawX = rect.width ? (e.clientX - rect.left) / rect.width : 0;
                var rawY = rect.height ? (e.clientY - rect.top) / rect.height : 0;
                var normX = Math.min(1, Math.max(0, rawX));
                var normY = Math.min(1, Math.max(0, rawY));

                state.lastDevCoord = { x: normX.toFixed(2), y: normY.toFixed(2) };
                var out = $('coordOutput');
                if (out) {
                    out.textContent = 'pos: {x: ' + state.lastDevCoord.x + ', y: ' + state.lastDevCoord.y + '}';
                }
                dropCalibrationMarker(scene, normX, normY);
            });
        }

        var beamControls = $('beamControls');
        if (beamControls) {
            beamControls.addEventListener('click', function (e) { e.stopPropagation(); });
        }

        window.addEventListener('resize', resetFlashlight);

        document.addEventListener('keydown', function (e) {
            var activeEl = document.activeElement;
            var tag = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
            var isTyping = tag === 'TEXTAREA' || tag === 'INPUT' || (activeEl && activeEl.isContentEditable);

            if (!isTyping && e.shiftKey && e.key && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                toggleDevMode();
                return;
            }

            if (e.key === 'Escape') {
                var confirmModal = $('confirmModal');
                if (confirmModal && confirmModal.classList.contains('open')) {
                    cancelConfirm();
                    return;
                }
                var clueModal = $('clueModal');
                if (clueModal && clueModal.classList.contains('open')) {
                    closeClueModal();
                    return;
                }
                var wrongModal = $('wrongAccusationModal');
                if (wrongModal && wrongModal.classList.contains('open')) {
                    closeWrongAccusationModal();
                    return;
                }
                var gameOverModal = $('gameOverModal');
                if (gameOverModal && gameOverModal.classList.contains('open')) {
                    gameOverModal.classList.remove('open');
                    return;
                }
                if (state.devModeActive) {
                    toggleDevMode();
                }
            }
        });
    }

    // --- Tab Switching ---
    function switchTab(tabId) {
        state.activeTab = tabId;
        var tabs = ['briefing', 'evidence', 'suspects'];
        tabs.forEach(function (id) {
            var content = $('tab-' + id);
            var btn = $('btn-tab-' + id);
            if (content) content.classList.toggle('is-hidden', id !== tabId);
            if (btn) btn.classList.toggle('is-active', id === tabId);
        });
    }

    // --- Photo Archives Menu ---
    function renderMenu() {
        var list = $('caseList');
        var statsText = $('archiveStatsText');
        if (!list) return;

        var totalCases = state.caseData.length;
        var solvedCount = state.caseData.filter(function (c) {
            return Boolean(state.persisted.solved[c.id]);
        }).length;

        if (statsText) {
            statsText.textContent = solvedCount + ' / ' + totalCases + ' Solved';
        }

        if (totalCases === 0) {
            list.innerHTML = '<div class="col-span-full glass-surface p-8 text-center font-bold text-slate-500 dark:text-slate-400">No case files found in archive.</div>';
            return;
        }

        list.innerHTML = '';

        state.caseData.forEach(function (c) {
            var diffKey = String(c.difficulty || 'MEDIUM').toUpperCase();
            var diffStyle = DIFFICULTY_STYLES[diffKey] || DIFFICULTY_STYLES.MEDIUM;
            var solvedRecord = state.persisted.solved[c.id];
            var clueCount = Array.isArray(c.clues) ? c.clues.length : 0;
            var suspectCount = Array.isArray(c.suspects) ? c.suspects.length : 0;

            var card = document.createElement('article');
            card.className = 'case-card flex flex-col';

            var solvedBadgeHtml = solvedRecord
                ? '<span class="sticker rotate-2 bg-green text-white px-2.5 py-1 rounded-full text-[11px] uppercase"><i data-lucide="circle-check" class="w-3.5 h-3.5 mr-1"></i>Solved (' + formatTime(solvedRecord.bestTimeLeft) + ' left)</span>'
                : '<span class="sticker -rotate-1 bg-white/95 dark:bg-slate-900/95 text-dark dark:text-white px-2.5 py-1 rounded-full text-[11px] uppercase">Unsolved</span>';

            card.innerHTML =
                '<div class="relative aspect-video bg-slate-900 overflow-hidden border-b-3 border-dark dark:border-slate-500">' +
                    '<img src="' + escapeHTML(c.image) + '" alt="' + escapeHTML(c.title) + '" class="w-full h-full object-cover opacity-85" />' +
                    '<div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent"></div>' +
                    '<div class="absolute top-3 left-3">' +
                        '<span class="sticker ' + diffStyle.rot + ' ' + diffStyle.bg + ' px-2.5 py-1 rounded-xl text-xs uppercase">' + escapeHTML(diffKey) + '</span>' +
                    '</div>' +
                    '<div class="absolute top-3 right-3">' + solvedBadgeHtml + '</div>' +
                    '<div class="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-white">' +
                        '<span class="text-xs font-extrabold uppercase tracking-wider text-slate-200">' + escapeHTML(c.subtitle) + '</span>' +
                        '<span class="text-xs font-heading font-bold bg-slate-950/80 px-2.5 py-0.5 rounded-lg border border-slate-500">' + formatTime(c.time) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="p-5 flex-1 flex flex-col">' +
                    '<h3 class="font-heading text-2xl font-bold uppercase tracking-tight text-dark dark:text-white">' + escapeHTML(c.title) + '</h3>' +
                    '<p class="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1.5 mb-4 line-clamp-2">' + escapeHTML(c.brief) + '</p>' +
                    '<div class="flex flex-wrap items-center gap-2 mb-5 text-xs font-extrabold text-slate-600 dark:text-slate-300">' +
                        '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600">' +
                            '<i data-lucide="search" class="w-3.5 h-3.5 text-blue"></i>' + clueCount + ' Clues' +
                        '</span>' +
                        '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600">' +
                            '<i data-lucide="users" class="w-3.5 h-3.5 text-orange"></i>' + suspectCount + ' Suspects' +
                        '</span>' +
                    '</div>' +
                    '<button type="button" onclick="App.loadCase(\'' + escapeHTML(c.id) + '\')" class="btn-chunky ' + (solvedRecord ? 'bg-green' : 'bg-blue') + ' text-white rounded-xl px-5 py-3 text-base mt-auto w-full flex items-center justify-center gap-2">' +
                        '<i data-lucide="' + (solvedRecord ? 'rotate-ccw' : 'folder-open') + '" class="w-4 h-4"></i>' +
                        '<span>' + (solvedRecord ? 'Replay Case File' : 'Open Case File') + '</span>' +
                    '</button>' +
                '</div>';

            list.appendChild(card);
        });

        refreshIcons();
    }

    function showMenu() {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        state.gameStarted = false;
        state.isPaused = false;
        state.currentCase = null;

        ['clueModal', 'confirmModal', 'wrongAccusationModal', 'gameOverModal'].forEach(function (id) {
            var m = $(id);
            if (m) m.classList.remove('open');
        });

        var menuView = $('menuView');
        var workspace = $('gameWorkspace');
        var hud = $('activeGameHud');
        var actions = $('gameActionBtns');
        var subtitle = $('headerCaseSubtitle');

        if (menuView) menuView.classList.remove('is-hidden');
        if (workspace) workspace.classList.add('is-hidden');
        if (hud) hud.classList.add('is-hidden');
        if (actions) actions.classList.add('is-hidden');
        if (subtitle) subtitle.textContent = 'Forensics Photo Analysis Unit';

        renderMenu();
    }

    // --- Load Case & Gameplay ---
    function loadCase(id) {
        var foundCase = state.caseData.find(function (c) { return c.id === id; });
        if (!foundCase) return;

        clearInterval(state.timerInterval);
        state.timerInterval = null;
        state.currentCase = foundCase;
        state.foundClues = [];
        state.hintsUsed = 0;
        state.gameStarted = false;
        state.isPaused = false;
        state.evidenceFilter = 'all';

        ['clueModal', 'confirmModal', 'wrongAccusationModal', 'gameOverModal'].forEach(function (modalId) {
            var m = $(modalId);
            if (m) m.classList.remove('open');
        });

        var menuView = $('menuView');
        var workspace = $('gameWorkspace');
        var hud = $('activeGameHud');
        var actions = $('gameActionBtns');
        if (menuView) menuView.classList.add('is-hidden');
        if (workspace) workspace.classList.remove('is-hidden');
        if (hud) hud.classList.remove('is-hidden');
        if (actions) actions.classList.remove('is-hidden');

        var imgEl = $('sceneImage');
        if (imgEl) {
            imgEl.src = foundCase.image;
            imgEl.alt = foundCase.title;
            imgEl.classList.remove('is-hidden');
        }

        if ($('headerCaseSubtitle')) $('headerCaseSubtitle').textContent = foundCase.title + ' · ' + foundCase.subtitle;
        if ($('sceneTitle')) $('sceneTitle').textContent = 'LOC: ' + foundCase.title;
        if ($('startCaseTitle')) $('startCaseTitle').textContent = foundCase.title;

        var clueTotal = Array.isArray(foundCase.clues) ? foundCase.clues.length : 0;
        var suspectTotal = Array.isArray(foundCase.suspects) ? foundCase.suspects.length : 0;
        if ($('startCaseMeta')) {
            $('startCaseMeta').textContent = clueTotal + ' Hidden Clues · ' + suspectTotal + ' Suspects · ' + formatTime(foundCase.time);
        }

        var diffKey = String(foundCase.difficulty || 'MEDIUM').toUpperCase();
        var diffStyle = DIFFICULTY_STYLES[diffKey] || DIFFICULTY_STYLES.MEDIUM;
        var briefDiffEl = $('briefDifficulty');
        if (briefDiffEl) {
            briefDiffEl.className = 'sticker ' + diffStyle.bg + ' px-2.5 py-1 rounded-lg text-xs uppercase';
            briefDiffEl.textContent = diffKey;
        }
        if ($('briefTime')) $('briefTime').textContent = formatTime(foundCase.time) + ' Limit';
        if ($('caseBrief')) $('caseBrief').textContent = foundCase.brief;

        var notesInput = $('caseNotesInput');
        if (notesInput) {
            notesInput.value = state.persisted.caseNotes[foundCase.id] || '';
        }

        // Inject Hotspots
        var sceneEl = $('sceneElements');
        if (sceneEl) {
            sceneEl.innerHTML = '';
            (foundCase.clues || []).forEach(function (clue) {
                var hotspot = document.createElement('button');
                hotspot.type = 'button';
                hotspot.id = 'hs-' + clue.id;
                hotspot.className = 'hotspot';
                hotspot.style.left = ((clue.pos && clue.pos.x != null ? clue.pos.x : 0.5) * 100) + '%';
                hotspot.style.top = ((clue.pos && clue.pos.y != null ? clue.pos.y : 0.5) * 100) + '%';
                hotspot.setAttribute('aria-label', 'Inspect scene object');

                var devLabel = document.createElement('span');
                devLabel.className = 'hotspot-dev-label';
                devLabel.textContent = clue.name + ' (' + (clue.pos ? clue.pos.x : 0) + ', ' + (clue.pos ? clue.pos.y : 0) + ')';
                hotspot.appendChild(devLabel);

                hotspot.onclick = function (e) {
                    if (state.devModeActive) return;
                    if (e && e.stopPropagation) e.stopPropagation();
                    handleClueClick(clue);
                };
                sceneEl.appendChild(hotspot);
            });
        }

        state.timeLeft = Number(foundCase.time) || 600;
        updateTimerDisplay();
        updateClueCounters();
        syncPauseButtonUI();
        syncFlashlightUI();
        syncStageOverlays();
        setEvidenceFilter('all');
        renderSuspectsList();
        switchTab('briefing');
    }

    function startInvestigation() {
        if (!state.currentCase) return;
        if (!state.flashlightActive) {
            state.flashlightActive = true;
            state.persisted.settings.flashlight = true;
            savePersisted();
        }
        state.gameStarted = true;
        state.isPaused = false;
        syncStageOverlays();
        syncFlashlightUI();
        syncPauseButtonUI();

        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(gameTick, 1000);
        setTimeout(resetFlashlight, 40);
    }

    function syncPauseButtonUI() {
        var btn = $('pauseBtn');
        if (!btn) return;
        btn.className = state.isPaused
            ? 'btn-chunky bg-orange text-white rounded-xl w-9 h-9 p-0 flex-shrink-0'
            : 'btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white rounded-xl w-9 h-9 p-0 flex-shrink-0';
        setSlotIcon('pauseBtnIconSlot', state.isPaused ? 'play' : 'pause', 'w-4 h-4');
    }

    function togglePause() {
        if (!state.currentCase || !state.gameStarted || state.timeLeft <= 0) return;
        state.isPaused = !state.isPaused;
        syncPauseButtonUI();
        syncStageOverlays();
        showToast(state.isPaused ? 'Investigation paused' : 'Investigation resumed', state.isPaused ? 'pause' : 'play');
    }

    function replayCurrentCase() {
        if (!state.currentCase) return;
        var caseId = state.currentCase.id;
        delete state.persisted.eliminatedSuspects[caseId];
        delete state.persisted.clueFlags[caseId];
        savePersisted();
        loadCase(caseId);
    }

    // --- Clue & Evidence Handling ---
    function updateClueCounters() {
        var total = state.currentCase && Array.isArray(state.currentCase.clues) ? state.currentCase.clues.length : 0;
        var found = state.foundClues.length;

        if ($('clueProgressText')) $('clueProgressText').textContent = found + ' / ' + total + ' Clues';
        if ($('evidenceCountBadge')) $('evidenceCountBadge').textContent = String(found);
        if ($('evFoundSummary')) $('evFoundSummary').textContent = found + ' / ' + total + ' Found';
        if ($('suspectsCountBadge')) {
            var sCount = state.currentCase && Array.isArray(state.currentCase.suspects) ? state.currentCase.suspects.length : 0;
            $('suspectsCountBadge').textContent = String(sCount);
        }
    }

    function handleClueClick(clue) {
        if (!state.currentCase || !state.gameStarted || state.isPaused || state.timeLeft <= 0) return;

        var isNew = state.foundClues.indexOf(clue.id) === -1;
        if (isNew) {
            state.foundClues.push(clue.id);
        }

        var hs = $('hs-' + clue.id);
        if (hs) {
            hs.classList.remove('hint-ping');
            hs.classList.add('found');
            var orderIndex = state.foundClues.indexOf(clue.id) + 1;
            var existingBadge = hs.querySelector('.hotspot-badge');
            if (!existingBadge) {
                var badge = document.createElement('span');
                badge.className = 'hotspot-badge';
                badge.textContent = String(orderIndex);
                hs.appendChild(badge);
            }
        }

        updateClueCounters();
        renderEvidenceList();

        // Populate & open Clue Modal
        var iconName = safeIcon(clue.icon);
        var iconWrap = $('clueModalIconWrap');
        if (iconWrap) {
            iconWrap.innerHTML = '<i data-lucide="' + escapeHTML(iconName) + '" class="w-8 h-8"></i>';
        }
        var modalBadge = $('clueModalBadge');
        if (modalBadge) {
            modalBadge.textContent = isNew ? 'New Clue Logged' : 'Evidence Review';
            modalBadge.className = 'sticker ' + (isNew ? 'bg-green' : 'bg-blue') + ' text-white px-3 py-1 rounded-full text-[11px] uppercase mb-2';
        }
        if ($('clueModalTitle')) $('clueModalTitle').textContent = clue.name;
        if ($('clueModalDesc')) $('clueModalDesc').textContent = clue.desc;
        if ($('clueModalHidden')) {
            $('clueModalHidden').innerHTML =
                '<span class="font-heading uppercase tracking-wider text-xs text-blue block mb-1">Forensic Analysis</span>' +
                formatRichText(clue.hidden);
        }

        var modal = $('clueModal');
        if (modal) modal.classList.add('open');
        refreshIcons();
    }

    function closeClueModal() {
        var modal = $('clueModal');
        if (modal) modal.classList.remove('open');
    }

    function getCaseClueFlags() {
        if (!state.currentCase) return {};
        if (!state.persisted.clueFlags[state.currentCase.id]) {
            state.persisted.clueFlags[state.currentCase.id] = {};
        }
        return state.persisted.clueFlags[state.currentCase.id];
    }

    function toggleClueFlag(clueId, flagValue) {
        if (!state.currentCase) return;
        var flags = getCaseClueFlags();
        flags[clueId] = flags[clueId] === flagValue ? '' : flagValue;
        savePersisted();
        renderEvidenceList();
    }

    function setEvidenceFilter(filter) {
        state.evidenceFilter = filter || 'all';
        ['all', 'lead', 'herring'].forEach(function (f) {
            var btn = $('evFilter-' + f);
            if (btn) btn.classList.toggle('is-active', f === state.evidenceFilter);
        });
        renderEvidenceList();
    }

    function focusHotspot(clueId) {
        var hs = $('hs-' + clueId);
        if (!hs) return;
        hs.classList.remove('pulse-focus');
        // trigger pulse cleanly
        hs.classList.add('pulse-focus');
        setTimeout(function () {
            hs.classList.remove('pulse-focus');
        }, 1800);
        showToast('Highlighted clue location on photo', 'map-pin');
    }

    function renderEvidenceList() {
        var evList = $('evidenceList');
        if (!evList || !state.currentCase) return;

        var flags = getCaseClueFlags();
        var discoveredClues = state.foundClues
            .map(function (id) {
                return state.currentCase.clues.find(function (c) { return c.id === id; });
            })
            .filter(Boolean);

        if (discoveredClues.length === 0) {
            evList.innerHTML =
                '<div id="emptyEv" class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400">' +
                    'Scan the crime scene photograph to uncover clues...' +
                '</div>';
            return;
        }

        var filtered = discoveredClues.filter(function (clue) {
            if (state.evidenceFilter === 'all') return true;
            return (flags[clue.id] || '') === state.evidenceFilter;
        });

        if (filtered.length === 0) {
            evList.innerHTML =
                '<div class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-5 text-center text-xs font-bold text-slate-500 dark:text-slate-400">' +
                    'No clues match this filter yet.' +
                '</div>';
            return;
        }

        evList.innerHTML = '';
        filtered.forEach(function (clue) {
            var orderNum = state.foundClues.indexOf(clue.id) + 1;
            var currentFlag = flags[clue.id] || '';
            var iconName = safeIcon(clue.icon);

            var card = document.createElement('div');
            card.className = 'evidence-card p-3.5 flex flex-col gap-2';
            card.setAttribute('data-flag', currentFlag);

            card.innerHTML =
                '<div class="flex items-start justify-between gap-2">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<div class="w-8 h-8 rounded-lg bg-blue text-white border-2 border-dark dark:border-slate-500 flex items-center justify-center flex-shrink-0">' +
                            '<i data-lucide="' + escapeHTML(iconName) + '" class="w-4 h-4"></i>' +
                        '</div>' +
                        '<div class="min-w-0">' +
                            '<span class="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Evidence #' + orderNum + '</span>' +
                            '<h4 class="font-heading font-bold text-base text-dark dark:text-white uppercase tracking-tight truncate">' + escapeHTML(clue.name) + '</h4>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" onclick="App.focusHotspot(\'' + escapeHTML(clue.id) + '\')" title="Locate on photo" aria-label="Locate clue on photo" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dark dark:border-slate-500 flex items-center justify-center text-dark dark:text-white hover:bg-blue hover:text-white transition-colors flex-shrink-0">' +
                        '<i data-lucide="map-pin" class="w-3.5 h-3.5"></i>' +
                    '</button>' +
                '</div>' +
                '<p class="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">' + escapeHTML(clue.desc) + '</p>' +
                '<div class="text-xs font-bold text-dark dark:text-slate-100 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700">' +
                    formatRichText(clue.hidden) +
                '</div>' +
                '<div class="flex items-center gap-1.5 pt-1">' +
                    '<button type="button" onclick="App.toggleClueFlag(\'' + escapeHTML(clue.id) + '\', \'lead\')" class="pill-toggle px-2.5 py-1 flex items-center gap-1 ' + (currentFlag === 'lead' ? 'bg-green text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300') + '">' +
                        '<i data-lucide="bookmark" class="w-3 h-3"></i><span>Key Lead</span>' +
                    '</button>' +
                    '<button type="button" onclick="App.toggleClueFlag(\'' + escapeHTML(clue.id) + '\', \'herring\')" class="pill-toggle px-2.5 py-1 flex items-center gap-1 ' + (currentFlag === 'herring' ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300') + '">' +
                        '<i data-lucide="ban" class="w-3 h-3"></i><span>Dead End</span>' +
                    '</button>' +
                '</div>';

            evList.appendChild(card);
        });

        refreshIcons();
    }

    function useHint() {
        if (!state.currentCase || !state.gameStarted || state.isPaused || state.timeLeft <= 0) {
            showToast('Begin the investigation first to scan for a hint', 'info');
            return;
        }
        var unfound = (state.currentCase.clues || []).filter(function (c) {
            return state.foundClues.indexOf(c.id) === -1;
        });
        if (unfound.length === 0) {
            showToast('All clues on this scene have been discovered!', 'circle-check');
            return;
        }

        var target = unfound[0];
        var hs = $('hs-' + target.id);
        state.hintsUsed += 1;
        if (hs) {
            hs.classList.add('hint-ping');
            clearTimeout(state.hintPingTimer);
            state.hintPingTimer = setTimeout(function () {
                hs.classList.remove('hint-ping');
            }, 2600);
        }
        showToast('Forensic scanner detected an unexamined signal on the photo!', 'lightbulb');
    }

    // --- Case Notes Persistence ---
    function saveCaseNote(value) {
        if (!state.currentCase) return;
        state.persisted.caseNotes[state.currentCase.id] = String(value || '');
        savePersisted();
    }

    function clearCaseNote() {
        if (!state.currentCase) return;
        delete state.persisted.caseNotes[state.currentCase.id];
        if ($('caseNotesInput')) $('caseNotesInput').value = '';
        savePersisted();
        showToast('Case notes cleared', 'eraser');
    }

    // --- Suspects & Warrants ---
    function getEliminatedSet() {
        if (!state.currentCase) return [];
        var arr = state.persisted.eliminatedSuspects[state.currentCase.id];
        return Array.isArray(arr) ? arr : [];
    }

    function toggleSuspectEliminated(suspectIdx) {
        if (!state.currentCase || !Array.isArray(state.currentCase.suspects)) return;
        var suspect = state.currentCase.suspects[suspectIdx];
        if (!suspect) return;

        var list = getEliminatedSet().slice();
        var pos = list.indexOf(suspect.name);
        if (pos === -1) {
            list.push(suspect.name);
        } else {
            list.splice(pos, 1);
        }
        state.persisted.eliminatedSuspects[state.currentCase.id] = list;
        savePersisted();
        renderSuspectsList();
    }

    function renderSuspectsList() {
        var suspectsList = $('suspectsList');
        if (!suspectsList || !state.currentCase) return;

        var eliminated = getEliminatedSet();
        suspectsList.innerHTML = '';

        (state.currentCase.suspects || []).forEach(function (suspect, idx) {
            var isRuledOut = eliminated.indexOf(suspect.name) !== -1;

            var card = document.createElement('div');
            card.className = 'suspect-card p-4 flex flex-col gap-3' + (isRuledOut ? ' is-eliminated' : '');

            card.innerHTML =
                '<div class="flex items-center justify-between gap-2 pb-2 border-b-2 border-slate-200 dark:border-slate-700">' +
                    '<div class="flex items-center gap-2.5 min-w-0">' +
                        '<div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-dark dark:border-slate-500 flex items-center justify-center flex-shrink-0 text-dark dark:text-white">' +
                            '<i data-lucide="' + (isRuledOut ? 'user-x' : 'user') + '" class="w-5 h-5"></i>' +
                        '</div>' +
                        '<div class="min-w-0">' +
                            '<h4 class="suspect-name font-heading font-bold text-lg text-dark dark:text-white uppercase tracking-tight truncate">' + escapeHTML(suspect.name) + '</h4>' +
                            '<span class="inline-block text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue/15 text-blue border border-blue/40">' + escapeHTML(suspect.role) + '</span>' +
                        '</div>' +
                    '</div>' +
                    (isRuledOut
                        ? '<span class="sticker rotate-2 bg-slate-600 text-white px-2 py-0.5 rounded-lg text-[10px] uppercase">Ruled Out</span>'
                        : '') +
                '</div>' +
                '<div class="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-dark dark:text-slate-200 leading-snug">' +
                    '<i data-lucide="file-search" class="inline w-3.5 h-3.5 mr-1 text-blue"></i>' +
                    escapeHTML(suspect.hint) +
                '</div>' +
                '<div class="grid grid-cols-2 gap-2">' +
                    '<button type="button" onclick="App.toggleSuspectEliminated(' + idx + ')" class="btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5">' +
                        '<i data-lucide="' + (isRuledOut ? 'user-check' : 'user-x') + '" class="w-3.5 h-3.5 ' + (isRuledOut ? 'text-green' : 'text-slate-500') + '"></i>' +
                        '<span>' + (isRuledOut ? 'Restore' : 'Rule Out') + '</span>' +
                    '</button>' +
                    '<button type="button" onclick="App.promptWarrant(' + idx + ')" class="btn-chunky bg-pink text-white rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5">' +
                        '<i data-lucide="gavel" class="w-3.5 h-3.5"></i>' +
                        '<span>Warrant</span>' +
                    '</button>' +
                '</div>';

            suspectsList.appendChild(card);
        });

        refreshIcons();
    }

    // --- Confirmation Modal ---
    function openConfirmModal(opts) {
        state.pendingConfirmFn = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
        if ($('confirmTitle')) $('confirmTitle').textContent = opts.title || 'Confirm';
        if ($('confirmMessage')) $('confirmMessage').textContent = opts.message || 'Are you sure?';

        var iconWrap = $('confirmIconWrap');
        if (iconWrap) {
            iconWrap.innerHTML = '<i data-lucide="' + escapeHTML(safeIcon(opts.icon || 'gavel')) + '" class="w-7 h-7"></i>';
        }

        var actionBtn = $('confirmActionBtn');
        if (actionBtn) {
            actionBtn.textContent = opts.confirmLabel || 'Confirm';
        }

        var modal = $('confirmModal');
        if (modal) modal.classList.add('open');
        refreshIcons();
    }

    function cancelConfirm() {
        state.pendingConfirmFn = null;
        var modal = $('confirmModal');
        if (modal) modal.classList.remove('open');
    }

    function executeConfirm() {
        var fn = state.pendingConfirmFn;
        cancelConfirm();
        if (typeof fn === 'function') fn();
    }

    function promptWarrant(suspectIdx) {
        if (!state.currentCase || state.timeLeft <= 0 || !state.gameStarted) {
            showToast('Click Begin Investigation before issuing a warrant', 'info');
            return;
        }
        var suspect = state.currentCase.suspects && state.currentCase.suspects[suspectIdx];
        if (!suspect) return;

        openConfirmModal({
            title: 'Issue Arrest Warrant?',
            message: 'Charge ' + suspect.name + ' (' + suspect.role + ') as the culprit? A wrong accusation deducts 60 seconds from the clock.',
            icon: 'gavel',
            confirmLabel: 'Issue Warrant',
            onConfirm: function () {
                accuseSuspect(suspect.name);
            }
        });
    }

    function accuseSuspect(suspectName) {
        if (!state.currentCase || state.timeLeft <= 0 || !state.gameStarted) return;

        if (String(suspectName).toLowerCase() === String(state.currentCase.culprit).toLowerCase()) {
            endGame(true);
            return;
        }

        addTimePenalty(60);
        if (state.timeLeft <= 0) return;

        var missingClues = (state.currentCase.clues || []).filter(function (c) {
            return state.foundClues.indexOf(c.id) === -1;
        });

        var hintHtml = 'You have uncovered every clue! Re-read all forensic deductions and alibis carefully.';
        if (missingClues.length > 0) {
            var hintClue = missingClues[0];
            hintHtml = 'Crucial evidence is still unexamined! Scan the scene closely for: <strong class="text-orange underline">' + escapeHTML(hintClue.name) + '</strong>.';
        }

        if ($('wrongAccusationName')) $('wrongAccusationName').textContent = suspectName;
        if ($('wrongAccusationHint')) $('wrongAccusationHint').innerHTML = hintHtml;

        var modal = $('wrongAccusationModal');
        if (modal) modal.classList.add('open');
    }

    function closeWrongAccusationModal() {
        var modal = $('wrongAccusationModal');
        if (modal) modal.classList.remove('open');
    }

    function promptResetProgress() {
        openConfirmModal({
            title: 'Reset All Case Progress?',
            message: 'This clears all solved badges, best clear times, saved notes, and suspect markers stored on this browser.',
            icon: 'rotate-ccw',
            confirmLabel: 'Reset Data',
            onConfirm: function () {
                state.persisted.solved = {};
                state.persisted.caseNotes = {};
                state.persisted.eliminatedSuspects = {};
                state.persisted.clueFlags = {};
                savePersisted();
                renderMenu();
                showToast('Bureau progress cleared', 'rotate-ccw');
            }
        });
    }

    // --- Timer & Game Over ---
    function updateTimerDisplay() {
        var display = $('timerDisplay');
        var container = $('timerContainer');
        if (display) display.textContent = formatTime(state.timeLeft);
        if (container) {
            container.classList.remove('border-orange', 'border-pink');
            if (state.timeLeft > 0 && state.timeLeft < 60) {
                container.classList.add('border-pink');
            } else if (state.timeLeft >= 60 && state.timeLeft < 120) {
                container.classList.add('border-orange');
            }
        }
    }

    function gameTick() {
        if (!state.gameStarted || state.isPaused || !state.currentCase) return;
        state.timeLeft = Math.max(0, state.timeLeft - 1);
        updateTimerDisplay();

        if (state.timeLeft <= 0) {
            endGame(false);
        }
    }

    function addTimePenalty(seconds) {
        state.timeLeft = Math.max(0, state.timeLeft - seconds);
        var container = $('timerContainer');
        if (container) {
            container.classList.add('timer-penalty-flash');
            setTimeout(function () {
                container.classList.remove('timer-penalty-flash');
            }, 380);
        }
        updateTimerDisplay();

        if (state.timeLeft <= 0) {
            closeWrongAccusationModal();
            endGame(false);
        }
    }

    function endGame(isWin) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        state.gameStarted = false;
        state.isPaused = false;

        ['clueModal', 'confirmModal', 'wrongAccusationModal'].forEach(function (id) {
            var m = $(id);
            if (m) m.classList.remove('open');
        });

        var iconWrap = $('gameOverIcon');
        var title = $('gameOverTitle');
        var stats = $('gameOverStats');
        var text = $('gameOverText');
        var modal = $('gameOverModal');

        var totalClues = state.currentCase && Array.isArray(state.currentCase.clues) ? state.currentCase.clues.length : 0;
        var foundCount = state.foundClues.length;
        var isNewBest = false;

        if (isWin && state.currentCase) {
            var prev = state.persisted.solved[state.currentCase.id];
            if (!prev || state.timeLeft > (prev.bestTimeLeft || 0)) {
                isNewBest = true;
            }
            state.persisted.solved[state.currentCase.id] = {
                bestTimeLeft: prev ? Math.max(prev.bestTimeLeft || 0, state.timeLeft) : state.timeLeft,
                cluesFound: foundCount,
                solvedAt: new Date().toISOString()
            };
            savePersisted();

            if (iconWrap) {
                iconWrap.className = 'w-20 h-20 rounded-2xl flex items-center justify-center border-3 border-dark dark:border-slate-500 mb-3 shadow-hard-md bg-green text-white';
                iconWrap.innerHTML = '<i data-lucide="gavel" class="w-10 h-10"></i>';
            }
            if (title) title.textContent = 'Case Closed';
            if (text) {
                text.innerHTML =
                    '<span class="font-heading text-green uppercase tracking-wider block mb-2 text-lg">Arrest Warrant Executed — ' + escapeHTML(state.currentCase.culprit) + ' Apprehended!</span>' +
                    formatRichText(state.currentCase.text);
            }
        } else if (state.currentCase) {
            if (iconWrap) {
                iconWrap.className = 'w-20 h-20 rounded-2xl flex items-center justify-center border-3 border-dark dark:border-slate-500 mb-3 shadow-hard-md bg-pink text-white';
                iconWrap.innerHTML = '<i data-lucide="skull" class="w-10 h-10"></i>';
            }
            if (title) title.textContent = 'Cold Case';
            if (text) {
                text.innerHTML =
                    '<span class="font-heading text-pink uppercase tracking-wider block mb-2 text-lg">Investigation Timed Out</span>' +
                    'The trail went cold. The culprit was <strong class="underline decoration-pink decoration-2">' + escapeHTML(state.currentCase.culprit) + '</strong>.<br /><br />' +
                    formatRichText(state.currentCase.text);
            }
        }

        if (stats && state.currentCase) {
            var chips = [
                '<span class="sticker bg-white dark:bg-slate-800 text-dark dark:text-white px-3 py-1 rounded-xl text-xs uppercase">Time Left: ' + formatTime(state.timeLeft) + '</span>',
                '<span class="sticker bg-white dark:bg-slate-800 text-dark dark:text-white px-3 py-1 rounded-xl text-xs uppercase">Clues: ' + foundCount + ' / ' + totalClues + '</span>',
                '<span class="sticker bg-white dark:bg-slate-800 text-dark dark:text-white px-3 py-1 rounded-xl text-xs uppercase">Hints: ' + state.hintsUsed + '</span>'
            ];
            if (isNewBest) {
                chips.push('<span class="sticker rotate-2 bg-orange text-white px-3 py-1 rounded-xl text-xs uppercase">New Best Time!</span>');
            }
            stats.innerHTML = chips.join('');
        }

        if (modal) modal.classList.add('open');
        refreshIcons();
    }

    // --- Fetch Cases & Init ---
    async function loadCases() {
        var errorContainer = $('errorContainer');
        if (errorContainer) errorContainer.innerHTML = '';

        try {
            var response = await fetch('./cases.json');
            if (!response.ok) {
                throw new Error('Could not load cases.json (HTTP ' + response.status + ')');
            }
            var data = await response.json();
            state.caseData = Array.isArray(data) ? data : [];
            renderMenu();
        } catch (error) {
            console.error('Initialization error:', error);
            if ($('caseList')) $('caseList').innerHTML = '';
            if (errorContainer) {
                errorContainer.innerHTML =
                    '<div class="glass-surface p-6 text-center space-y-3 border-pink">' +
                        '<div class="w-12 h-12 rounded-xl bg-pink text-white border-2 border-dark mx-auto flex items-center justify-center">' +
                            '<i data-lucide="triangle-alert" class="w-6 h-6"></i>' +
                        '</div>' +
                        '<p class="font-heading text-lg font-bold uppercase text-dark dark:text-white">Failed to load case files</p>' +
                        '<p class="text-sm font-bold text-slate-600 dark:text-slate-300">Ensure KlassKit is served via a local web server so cases.json can be fetched cleanly.</p>' +
                        '<button type="button" onclick="App.loadCases()" class="btn-chunky bg-blue text-white rounded-xl px-5 py-2 text-sm">Retry Loading</button>' +
                    '</div>';
                refreshIcons();
            }
        }
    }

    async function init() {
        loadPersisted();
        state.flashlightActive = state.persisted.settings.flashlight;
        state.beamSize = state.persisted.settings.beamSize;
        syncThemeIcon();
        bindEventListeners();
        refreshIcons();

        if (typeof window.requirePro === 'function') {
            await window.requirePro();
        }
        await loadCases();
    }

    window.App = {
        init: init,
        loadCases: loadCases,
        renderMenu: renderMenu,
        showMenu: showMenu,
        loadCase: loadCase,
        startInvestigation: startInvestigation,
        togglePause: togglePause,
        replayCurrentCase: replayCurrentCase,
        toggleFlashlight: toggleFlashlight,
        setBeamSize: setBeamSize,
        toggleDevMode: toggleDevMode,
        copyCoords: copyCoords,
        switchTab: switchTab,
        handleClueClick: handleClueClick,
        closeClueModal: closeClueModal,
        toggleClueFlag: toggleClueFlag,
        setEvidenceFilter: setEvidenceFilter,
        focusHotspot: focusHotspot,
        useHint: useHint,
        saveCaseNote: saveCaseNote,
        clearCaseNote: clearCaseNote,
        toggleSuspectEliminated: toggleSuspectEliminated,
        promptWarrant: promptWarrant,
        accuseSuspect: accuseSuspect,
        closeWrongAccusationModal: closeWrongAccusationModal,
        promptResetProgress: promptResetProgress,
        cancelConfirm: cancelConfirm,
        executeConfirm: executeConfirm,
        toggleTheme: toggleTheme,
        _getState: function () { return state; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        init();
    });
})();

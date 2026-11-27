/* ============================================
   FREEZE DANCE - Classroom Movement Engine
   KlassKit 1.9.1 Modular Script + Synth Beat
   ============================================ */

(function () {
    'use strict';

    var SETTINGS_KEY = 'freezeDanceSettings';
    var THEME_KEY = 'theme_freeze-dance';

    var state = {
        isRunning: false,
        isFrozen: false,
        audioSource: 'builtin',
        hasUploadedMedia: false,
        uploadedObjectUrl: '',
        uploadedIsVideo: false,
        showVideo: false,
        sfxEnabled: true,
        students: [],
        studentQueue: [],
        currentSpotlight: [],
        roundsCompleted: 0,
        timer: null,
        syncTimeout: null,
        toastTimer: null,
        pendingConfirmFn: null
    };

    // --- Built-in Zero-Dependency Web Audio Beat & SFX Engine ---
    var BeatEngine = {
        ctx: null,
        stepTimer: null,
        step: 0,
        ducked: false,
        ensureCtx: function () {
            if (this.ctx) {
                if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
                    this.ctx.resume().catch(function () {});
                }
                return this.ctx;
            }
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;
            try {
                this.ctx = new AudioCtx();
                return this.ctx;
            } catch (e) {
                return null;
            }
        },
        start: function () {
            this.ducked = false;
            var ctx = this.ensureCtx();
            if (!ctx) return;
            this.stop(false);
            var self = this;
            // 124 BPM sixteenth-ish groove step every 240ms
            this.playBeatStep();
            this.stepTimer = setInterval(function () {
                self.playBeatStep();
            }, 240);
        },
        setDucked: function (flag) {
            this.ducked = Boolean(flag);
        },
        stop: function () {
            if (this.stepTimer) {
                clearInterval(this.stepTimer);
                this.stepTimer = null;
            }
            this.step = 0;
        },
        playBeatStep: function () {
            var ctx = this.ctx;
            if (!ctx) return;
            var now = ctx.currentTime;
            var volScale = this.ducked ? 0.45 : 1.0;
            var s = this.step % 8;
            this.step++;

            // Kick on 0, 2, 4, 6
            if (s % 2 === 0) {
                this.triggerKick(now, 0.24 * volScale);
            }
            // Bright snare/clap on 2, 6
            if (s === 2 || s === 6) {
                this.triggerSnap(now, 0.14 * volScale);
            }
            // Funky pentatonic synth bass/pluck
            var notes = [261.63, 329.63, 392.00, 329.63, 440.00, 392.00, 329.63, 523.25];
            this.triggerPluck(now, notes[s], 0.08 * volScale);
        },
        triggerKick: function (t, gainVal) {
            try {
                var osc = this.ctx.createOscillator();
                var gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(145, t);
                osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
                gain.gain.setValueAtTime(gainVal, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + 0.17);
            } catch (e) {}
        },
        triggerSnap: function (t, gainVal) {
            try {
                var osc = this.ctx.createOscillator();
                var gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(760, t);
                osc.frequency.exponentialRampToValueAtTime(190, t + 0.08);
                gain.gain.setValueAtTime(gainVal, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + 0.1);
            } catch (e) {}
        },
        triggerPluck: function (t, freq, gainVal) {
            try {
                var osc = this.ctx.createOscillator();
                var gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(gainVal, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + 0.19);
            } catch (e) {}
        },
        playSfx: function (kind) {
            if (!state.sfxEnabled) return;
            var ctx = this.ensureCtx();
            if (!ctx) return;
            var now = ctx.currentTime;
            try {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                if (kind === 'freeze') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(880, now);
                    osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);
                    gain.gain.setValueAtTime(0.14, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
                } else if (kind === 'warning') {
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.08);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(660, now + 0.14);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                }
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
            } catch (e) {}
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

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function setSlotIcon(slotId, iconName, iconClass) {
        var slot = $(slotId);
        if (!slot) return;
        slot.innerHTML = '<i data-lucide="' + escapeHTML(iconName) + '" class="' + escapeHTML(iconClass || 'w-4 h-4') + '"></i>';
        refreshIcons();
    }

    function formatDuration(seconds) {
        if (!isFinite(seconds) || seconds <= 0) return '0:00';
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return mins + ':' + secs;
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
        }, 2400);
    }

    // --- Settings Persistence ---
    function readInputInt(id, fallback) {
        var el = $(id);
        var val = el ? parseInt(el.value, 10) : NaN;
        return isNaN(val) ? fallback : val;
    }

    function clampNum(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    function normalizeTimingInputs() {
        var dMin = clampNum(readInputInt('danceMin', 10), 3, 60);
        var dMax = clampNum(readInputInt('danceMax', 25), dMin, 120);
        var fMin = clampNum(readInputInt('freezeMin', 3), 1, 15);
        var fMax = clampNum(readInputInt('freezeMax', 6), fMin, 20);
        var warn = clampNum(readInputInt('warningTime', 4), 0, 10);

        if ($('danceMin')) $('danceMin').value = String(dMin);
        if ($('danceMax')) $('danceMax').value = String(dMax);
        if ($('freezeMin')) $('freezeMin').value = String(fMin);
        if ($('freezeMax')) $('freezeMax').value = String(fMax);
        if ($('warningTime')) $('warningTime').value = String(warn);
    }

    function buildSettingsPayload() {
        return {
            danceMin: ($('danceMin') && $('danceMin').value) || '10',
            danceMax: ($('danceMax') && $('danceMax').value) || '25',
            freezeMin: ($('freezeMin') && $('freezeMin').value) || '3',
            freezeMax: ($('freezeMax') && $('freezeMax').value) || '6',
            warning: ($('warningTime') && $('warningTime').value) || '4',
            students: state.students.slice(),
            audioSource: state.audioSource,
            sfxEnabled: state.sfxEnabled,
            showVideo: state.showVideo
        };
    }

    function applySettingsObject(s) {
        if (!s || typeof s !== 'object') return;
        if (s.danceMin && $('danceMin')) $('danceMin').value = s.danceMin;
        if (s.danceMax && $('danceMax')) $('danceMax').value = s.danceMax;
        if (s.freezeMin && $('freezeMin')) $('freezeMin').value = s.freezeMin;
        if (s.freezeMax && $('freezeMax')) $('freezeMax').value = s.freezeMax;
        if (s.warning !== undefined && $('warningTime')) $('warningTime').value = s.warning;
        if (Array.isArray(s.students)) state.students = s.students.map(String).filter(Boolean);
        if (s.audioSource === 'upload' || s.audioSource === 'builtin') state.audioSource = s.audioSource;
        if (typeof s.sfxEnabled === 'boolean') state.sfxEnabled = s.sfxEnabled;
        if (typeof s.showVideo === 'boolean') state.showVideo = s.showVideo;
    }

    function saveSettings(skipCloud) {
        normalizeTimingInputs();
        var settings = buildSettingsPayload();
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {}

        if (!skipCloud) {
            if (state.syncTimeout) clearTimeout(state.syncTimeout);
            state.syncTimeout = setTimeout(function () {
                if (typeof window.saveProgress === 'function') {
                    window.saveProgress('freeze_dance', settings);
                }
            }, 1200);
        }
    }

    // --- Theme & UI Toggles ---
    function syncThemeIcon() {
        var isDark = document.documentElement.classList.contains('dark');
        setSlotIcon('themeToggleIconSlot', isDark ? 'sun' : 'moon', 'w-4 h-4');
    }

    function toggleTheme() {
        var isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        try {
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        } catch (e) {}
        syncThemeIcon();
    }

    function syncSfxUI() {
        var label = $('sfxLabel');
        if (label) label.textContent = state.sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
        var iconName = state.sfxEnabled ? 'volume-2' : 'volume-x';
        var iconCls = state.sfxEnabled ? 'w-4 h-4 text-green' : 'w-4 h-4 text-slate-400';
        setSlotIcon('sfxIconSlot', iconName, iconCls);
        setSlotIcon('immersiveSfxIconSlot', iconName, iconCls);
    }

    function toggleSfx() {
        state.sfxEnabled = !state.sfxEnabled;
        syncSfxUI();
        saveSettings();
    }

    function syncAudioSourceUI() {
        var isBuiltIn = state.audioSource === 'builtin';
        if ($('srcBuiltInBtn')) $('srcBuiltInBtn').classList.toggle('is-active', isBuiltIn);
        if ($('srcUploadBtn')) $('srcUploadBtn').classList.toggle('is-active', !isBuiltIn);
        if ($('uploadZone')) $('uploadZone').classList.toggle('is-hidden', isBuiltIn);

        var canStart = isBuiltIn || state.hasUploadedMedia;
        var btnStart = $('btnStart');
        var hint = $('sourceStatusHint');

        if (btnStart) {
            btnStart.disabled = !canStart;
            btnStart.className = canStart
                ? 'btn-chunky bg-green text-white rounded-2xl py-3.5 px-5 text-lg w-full flex items-center justify-center gap-2'
                : 'btn-chunky bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-2xl py-3.5 px-5 text-lg w-full flex items-center justify-center gap-2';
            if ($('btnStartLabel')) {
                $('btnStartLabel').textContent = canStart ? 'Start Freeze Dance' : 'Waiting for Media...';
            }
            setSlotIcon('btnStartIconSlot', 'play', 'w-5 h-5');
        }

        if (hint) {
            hint.textContent = isBuiltIn
                ? 'Beat Armed'
                : (state.hasUploadedMedia ? 'File Loaded' : 'Need File');
            hint.className = 'text-[11px] font-extrabold uppercase ' + (canStart ? 'text-green' : 'text-orange');
        }

        if (!state.isRunning) {
            setIdleStageCopy();
        }
    }

    function setAudioSource(source) {
        if (source !== 'builtin' && source !== 'upload') return;
        state.audioSource = source;
        syncAudioSourceUI();
        saveSettings();
    }

    function syncVideoBackdropUI() {
        var toggleBtn = $('showVideoToggle');
        var label = $('showVideoLabel');
        var player = $('mediaPlayer');

        if (toggleBtn) {
            toggleBtn.classList.toggle('is-hidden', !state.uploadedIsVideo);
        }
        if (label) {
            label.textContent = state.showVideo ? 'Video Backdrop: ON' : 'Video Backdrop: OFF';
        }
        setSlotIcon('showVideoIconSlot', state.showVideo ? 'eye' : 'eye-off', 'w-3.5 h-3.5 text-blue');
        if (player) {
            player.classList.toggle('is-hidden', !(state.isRunning && state.audioSource === 'upload' && state.uploadedIsVideo && state.showVideo));
        }
    }

    function toggleShowVideo() {
        state.showVideo = !state.showVideo;
        syncVideoBackdropUI();
        saveSettings();
    }

    function handleFileUpload(e) {
        var file = e && e.target && e.target.files ? e.target.files[0] : null;
        if (!file) return;

        var player = $('mediaPlayer');
        if (state.uploadedObjectUrl && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(state.uploadedObjectUrl);
        }

        state.uploadedObjectUrl = URL.createObjectURL(file);
        state.hasUploadedMedia = true;
        state.uploadedIsVideo = String(file.type || '').indexOf('video/') === 0;
        state.audioSource = 'upload';

        if (player) {
            player.src = state.uploadedObjectUrl;
            player.onloadedmetadata = function () {
                if ($('fileDurationDisplay')) {
                    $('fileDurationDisplay').textContent = formatDuration(player.duration);
                }
            };
            if (typeof player.load === 'function') player.load();
        }

        if ($('fileLabel')) $('fileLabel').textContent = 'Change Audio/Video';
        if ($('fileNameDisplay')) $('fileNameDisplay').textContent = file.name;
        if ($('fileDurationDisplay')) $('fileDurationDisplay').textContent = '0:00';
        if ($('fileMeta')) $('fileMeta').classList.remove('is-hidden');

        syncAudioSourceUI();
        syncVideoBackdropUI();
        saveSettings();
        showToast('Loaded ' + file.name, 'music');
    }

    // --- Student Roster Management ---
    function handleStudentKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addStudent();
        }
    }

    function addStudent() {
        var input = $('studentInput');
        if (!input) return;
        var raw = String(input.value || '').trim();
        if (!raw) return;

        var names = raw.split(/[,;\n]+/).map(function (n) { return n.trim(); }).filter(Boolean);
        if (names.length === 0) return;

        names.forEach(function (name) {
            state.students.push(name);
            state.studentQueue.push(name);
        });
        input.value = '';
        renderStudents();
        saveSettings();
    }

    function removeStudent(index) {
        var removed = state.students.splice(index, 1)[0];
        if (removed) {
            var qIdx = state.studentQueue.indexOf(removed);
            if (qIdx !== -1) state.studentQueue.splice(qIdx, 1);
        }
        renderStudents();
        saveSettings();
    }

    function promptClearStudents() {
        if (state.students.length === 0) {
            showToast('Student roster is already empty', 'info');
            return;
        }
        state.pendingConfirmFn = function () {
            state.students = [];
            state.studentQueue = [];
            state.currentSpotlight = [];
            renderStudents();
            saveSettings();
            showToast('Cleared student roster', 'trash-2');
        };
        if ($('confirmTitle')) $('confirmTitle').textContent = 'Clear Student Roster?';
        if ($('confirmMessage')) $('confirmMessage').textContent = 'Remove all ' + state.students.length + ' students from Spotlight picks?';
        if ($('confirmModal')) $('confirmModal').classList.add('open');
    }

    function cancelConfirm() {
        state.pendingConfirmFn = null;
        if ($('confirmModal')) $('confirmModal').classList.remove('open');
    }

    function executeConfirm() {
        var fn = state.pendingConfirmFn;
        cancelConfirm();
        if (typeof fn === 'function') fn();
    }

    function renderStudents() {
        var list = $('studentList');
        if (!list) return;
        list.innerHTML = '';

        if (state.students.length === 0) {
            list.innerHTML = '<div class="w-full text-center text-xs font-bold text-slate-400 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">Roster empty — all-class freeze mode</div>';
            return;
        }

        state.students.forEach(function (name, idx) {
            var chip = document.createElement('div');
            chip.className = 'inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 border-2 border-dark dark:border-slate-500 rounded-full px-3 py-1 text-xs font-extrabold shadow-hard-xs';
            chip.innerHTML =
                '<span>' + escapeHTML(name) + '</span>' +
                '<button type="button" onclick="App.removeStudent(' + idx + ')" aria-label="Remove ' + escapeHTML(name) + '" class="text-pink hover:bg-pink hover:text-white rounded-full p-0.5 transition-colors">' +
                    '<i data-lucide="x" class="w-3 h-3"></i>' +
                '</button>';
            list.appendChild(chip);
        });
        refreshIcons();
    }

    // --- Stage Visual Helpers ---
    function setStageAppearance(phaseClass, iconName, iconColorClass, headline, subtext) {
        var panel = $('panelGame');
        if (panel) {
            panel.classList.remove('stage-idle', 'stage-dance', 'stage-warning', 'stage-freeze');
            panel.classList.add(phaseClass);
        }
        setSlotIcon('stageIconSlot', iconName, 'w-12 h-12 ' + iconColorClass);
        if ($('statusText')) $('statusText').textContent = headline;
        if ($('subText')) $('subText').textContent = subtext;

        var eq = $('beatVisualizer');
        if (eq) eq.classList.toggle('is-hidden', phaseClass !== 'stage-dance');
    }

    function setIdleStageCopy() {
        var canStart = state.audioSource === 'builtin' || state.hasUploadedMedia;
        var msg = state.audioSource === 'builtin'
            ? 'Built-in beat armed — press Start to dance!'
            : (state.hasUploadedMedia ? 'Custom media loaded — press Start to begin!' : 'Switch to Built-In Beat or upload audio/video to begin.');
        setStageAppearance('stage-idle', 'hand', 'text-blue', canStart ? 'Ready!' : 'Load Media', msg);
    }

    function syncManualToggleButton() {
        var label = $('manualToggleLabel');
        if (label) {
            label.textContent = state.isFrozen ? 'Resume Dance (Space)' : 'Instant Freeze (Space)';
        }
        setSlotIcon('manualToggleIconSlot', state.isFrozen ? 'play' : 'snowflake', state.isFrozen ? 'w-5 h-5 text-green' : 'w-5 h-5 text-pink');
    }

    // --- Playback Helpers ---
    function playAudioSource() {
        if (state.audioSource === 'builtin') {
            BeatEngine.start();
            return;
        }
        var player = $('mediaPlayer');
        if (player && player.src && typeof player.play === 'function') {
            var p = player.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
        }
    }

    function pauseAudioSource() {
        BeatEngine.stop();
        var player = $('mediaPlayer');
        if (player && typeof player.pause === 'function') {
            player.pause();
        }
    }

    // --- Game Loop Engine ---
    function toggle() {
        if (state.isRunning) stop();
        else start();
    }

    function start() {
        var canStart = state.audioSource === 'builtin' || state.hasUploadedMedia;
        if (!canStart) {
            showToast('Upload a song or switch to Built-In Beat first', 'triangle-alert');
            return;
        }

        state.isRunning = true;
        state.isFrozen = false;
        state.currentSpotlight = [];
        state.roundsCompleted = 0;
        if ($('roundBadge')) $('roundBadge').textContent = 'Round 0';
        if ($('immersiveRoundText')) $('immersiveRoundText').textContent = 'Round 0';

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        if ($('panelGame')) $('panelGame').classList.add('is-immersive');
        if ($('immersiveControls')) $('immersiveControls').classList.remove('is-hidden');
        if ($('immersiveStageHud')) $('immersiveStageHud').classList.remove('is-hidden');
        syncVideoBackdropUI();

        runDance();
    }

    function stop() {
        state.isRunning = false;
        state.isFrozen = false;
        state.currentSpotlight = [];
        clearTimeout(state.timer);
        state.timer = null;

        pauseAudioSource();

        if ($('panelGame')) $('panelGame').classList.remove('is-immersive');
        if ($('immersiveControls')) $('immersiveControls').classList.add('is-hidden');
        if ($('immersiveStageHud')) $('immersiveStageHud').classList.add('is-hidden');
        if ($('spotlightContainer')) $('spotlightContainer').innerHTML = '';
        syncVideoBackdropUI();

        setStageAppearance('stage-idle', 'pause', 'text-orange', 'Paused', 'Press Start to dance another round!');
        if ($('btnStartLabel')) $('btnStartLabel').textContent = 'Resume Freeze Dance';
        setSlotIcon('btnStartIconSlot', 'rotate-ccw', 'w-5 h-5');
    }

    function pickSpotlightStudents() {
        if (state.students.length === 0) return [];
        var maxPick = Math.min(state.students.length, 3);
        var count = Math.floor(Math.random() * maxPick) + 1;
        var picked = [];

        while (picked.length < count) {
            if (state.studentQueue.length === 0) {
                var bag = state.students.slice();
                for (var i = bag.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var tmp = bag[i];
                    bag[i] = bag[j];
                    bag[j] = tmp;
                }
                state.studentQueue = bag;
            }
            var candidate = state.studentQueue.shift();
            if (state.students.indexOf(candidate) !== -1 && picked.indexOf(candidate) === -1) {
                picked.push(candidate);
            }
        }
        return picked;
    }

    function runDance() {
        if (!state.isRunning) return;
        state.isFrozen = false;
        state.currentSpotlight = [];

        BeatEngine.playSfx('dance');
        if ($('spotlightContainer')) $('spotlightContainer').innerHTML = '';
        setStageAppearance('stage-dance', 'music', 'text-green', 'Dance!', 'Keep moving to the beat!');
        syncManualToggleButton();

        playAudioSource();

        var minSec = clampNum(readInputInt('danceMin', 10), 3, 60);
        var maxSec = clampNum(readInputInt('danceMax', 25), minSec, 120);
        var nextStopMs = Math.floor(Math.random() * ((maxSec - minSec) * 1000 + 1) + minSec * 1000);
        var warningMs = clampNum(readInputInt('warningTime', 4), 0, 10) * 1000;

        if (state.students.length > 0 && warningMs > 0 && nextStopMs > warningMs + 1500) {
            state.timer = setTimeout(function () { runWarning(); }, nextStopMs - warningMs);
        } else {
            state.timer = setTimeout(function () { runFreeze(null); }, nextStopMs);
        }
    }

    function runWarning() {
        if (!state.isRunning) return;

        BeatEngine.setDucked(true);
        BeatEngine.playSfx('warning');
        setStageAppearance('stage-warning', 'triangle-alert', 'text-orange', 'Get Ready...', 'Spotlight dancers — prepare to freeze!');

        var picked = pickSpotlightStudents();
        state.currentSpotlight = picked;

        var spotlight = $('spotlightContainer');
        if (spotlight) {
            spotlight.innerHTML = '';
            picked.forEach(function (name, idx) {
                var rot = idx % 2 === 0 ? '-rotate-2' : 'rotate-2';
                var card = document.createElement('div');
                card.className = 'spotlight-card px-7 py-3 transform ' + rot;
                card.innerHTML = '<span class="font-heading text-3xl sm:text-4xl font-bold text-blue uppercase tracking-tight">' + escapeHTML(name) + '</span>';
                spotlight.appendChild(card);
            });
        }

        var warningMs = clampNum(readInputInt('warningTime', 4), 0, 10) * 1000;
        state.timer = setTimeout(function () { runFreeze(picked); }, warningMs);
    }

    function runFreeze(victims) {
        if (!state.isRunning) return;
        state.isFrozen = true;
        state.roundsCompleted += 1;
        var roundLabel = 'Round ' + state.roundsCompleted;
        if ($('roundBadge')) $('roundBadge').textContent = roundLabel;
        if ($('immersiveRoundText')) $('immersiveRoundText').textContent = roundLabel;

        pauseAudioSource();
        BeatEngine.playSfx('freeze');

        var subMsg = (victims && victims.length > 0)
            ? victims.join(' & ') + ' must freeze!'
            : "Don't move a muscle!";

        setStageAppearance('stage-freeze', 'snowflake', 'text-pink', 'Freeze!', subMsg);
        syncManualToggleButton();

        var minSec = clampNum(readInputInt('freezeMin', 3), 1, 15);
        var maxSec = clampNum(readInputInt('freezeMax', 6), minSec, 20);
        var freezeMs = Math.floor(Math.random() * ((maxSec - minSec) + 1) + minSec) * 1000;

        state.timer = setTimeout(function () { runDance(); }, freezeMs);
    }

    function manualOverride() {
        if (!state.isRunning) return;
        clearTimeout(state.timer);
        if (state.isFrozen) {
            runDance();
        } else {
            var activeVictims = state.currentSpotlight.length > 0 ? state.currentSpotlight : null;
            runFreeze(activeVictims);
        }
    }

    // --- Listeners & Boot ---
    function bindGlobalEvents() {
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if ($('confirmModal') && $('confirmModal').classList.contains('open')) {
                    cancelConfirm();
                    return;
                }
                if (state.isRunning) {
                    stop();
                }
                return;
            }

            if (e.code === 'Space') {
                if ($('confirmModal') && $('confirmModal').classList.contains('open')) return;

                if (state.isRunning) {
                    e.preventDefault();
                    manualOverride();
                    return;
                }

                var activeEl = document.activeElement;
                var tag = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

                var canStart = state.audioSource === 'builtin' || state.hasUploadedMedia;
                if (!canStart) return;
                e.preventDefault();
                start();
            }
        });
    }

    async function init() {
        syncThemeIcon();
        bindGlobalEvents();
        refreshIcons();

        if (typeof window.requireAuth === 'function') {
            await window.requireAuth();
        }

        var cloudData = null;
        if (typeof window.loadProgress === 'function') {
            try {
                cloudData = await window.loadProgress('freeze_dance');
            } catch (e) {
                cloudData = null;
            }
        }

        if (cloudData) {
            applySettingsObject(cloudData);
            saveSettings(true);
        } else {
            try {
                var saved = localStorage.getItem(SETTINGS_KEY);
                if (saved) applySettingsObject(JSON.parse(saved));
            } catch (e) {}
        }

        if (state.audioSource === 'upload' && !state.hasUploadedMedia) {
            state.audioSource = 'builtin';
        }
        state.studentQueue = state.students.slice();
        normalizeTimingInputs();
        renderStudents();
        syncSfxUI();
        syncAudioSourceUI();
        syncVideoBackdropUI();
    }

    window.App = {
        init: init,
        toggleTheme: toggleTheme,
        toggleSfx: toggleSfx,
        setAudioSource: setAudioSource,
        handleFileUpload: handleFileUpload,
        toggleShowVideo: toggleShowVideo,
        handleStudentKeydown: handleStudentKeydown,
        addStudent: addStudent,
        removeStudent: removeStudent,
        promptClearStudents: promptClearStudents,
        cancelConfirm: cancelConfirm,
        executeConfirm: executeConfirm,
        saveSettings: saveSettings,
        toggle: toggle,
        start: start,
        stop: stop,
        manualOverride: manualOverride,
        runDance: runDance,
        runWarning: runWarning,
        runFreeze: runFreeze,
        _getState: function () { return state; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        init();
    });
})();

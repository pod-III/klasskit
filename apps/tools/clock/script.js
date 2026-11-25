(function () {
    'use strict';

    // ========================================================
    // CONSTANTS & STORAGE KEYS (100% Backwards-Compatible)
    // ========================================================
    const CONSTANTS = {
        DAYS: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        DAYS_SHORT_MON: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        DAYS_SHORT_SUN: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
        MONTHS: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
        MONTH_NAMES: [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ],
        CLOCK_MARKERS: 60,
        CIRCLE_CIRCUMFERENCE: 283,
        STOPWATCH_FPS: 30,
        LS_DARK_MODE: 'theme_clock',
        LS_SIDEBAR: 'timetools_sidebar_collapsed',
        LS_STOPWATCH: 'timetools_stopwatch',
        LS_TIMER: 'timetools_timer',
        LS_ALARM: 'timetools_alarm',
        LS_MUTED: 'timetools_muted',
        LS_COUNTDOWN: 'hub_countdown',
        LS_CALENDAR: 'hub_calendar',
        LS_CLOCK_PREFS: 'timetools_clock_prefs',
        LS_TIMER_PREFS: 'timetools_timer_prefs',
        LS_WORLD_CLOCKS: 'timetools_world_clocks',
        LS_CAL_WEEKSTART: 'timetools_cal_weekstart',
        LS_UI_MODE: 'timetools_ui_mode',
        CLOUD_KEY: 'clock_data'
    };

    const WORLD_CITY_CATALOG = [
        { id: 'London', zone: 'Europe/London', label: 'London' },
        { id: 'New York', zone: 'America/New_York', label: 'New York' },
        { id: 'Tokyo', zone: 'Asia/Tokyo', label: 'Tokyo' },
        { id: 'Sydney', zone: 'Australia/Sydney', label: 'Sydney' },
        { id: 'Jakarta', zone: 'Asia/Jakarta', label: 'Jakarta' },
        { id: 'Singapore', zone: 'Asia/Singapore', label: 'Singapore' },
        { id: 'Seoul', zone: 'Asia/Seoul', label: 'Seoul' },
        { id: 'Dubai', zone: 'Asia/Dubai', label: 'Dubai' },
        { id: 'Paris', zone: 'Europe/Paris', label: 'Paris' },
        { id: 'Berlin', zone: 'Europe/Berlin', label: 'Berlin' },
        { id: 'Los Angeles', zone: 'America/Los_Angeles', label: 'Los Angeles' },
        { id: 'Toronto', zone: 'America/Toronto', label: 'Toronto' },
        { id: 'Bangkok', zone: 'Asia/Bangkok', label: 'Bangkok' },
        { id: 'Hong Kong', zone: 'Asia/Hong_Kong', label: 'Hong Kong' },
        { id: 'Auckland', zone: 'Pacific/Auckland', label: 'Auckland' },
        { id: 'Sao Paulo', zone: 'America/Sao_Paulo', label: 'Sao Paulo' }
    ];

    const WORDS_UNITS = [
        '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
        'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
        'seventeen', 'eighteen', 'nineteen'
    ];
    const WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
    const HOURS_WORDS = [
        'twelve', 'one', 'two', 'three', 'four', 'five',
        'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
    ];

    const VALID_CAL_COLORS = ['pink', 'orange', 'green', 'blue'];

    // ========================================================
    // PURE HELPER UTILITIES
    // ========================================================
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function padZero(num, length = 2) {
        return String(Math.trunc(Number(num) || 0)).padStart(length, '0');
    }

    function numberToWords(n) {
        const val = Math.trunc(Number(n) || 0);
        if (val <= 0) return 'zero';
        if (val < 20) return WORDS_UNITS[val];
        const ten = Math.floor(val / 10);
        const unit = val % 10;
        return unit ? `${WORDS_TENS[ten]}-${WORDS_UNITS[unit]}` : WORDS_TENS[ten];
    }

    function capitalizeFirst(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    function formatTimeInWords(hours24, minutes, style = 'classic') {
        const h = ((Math.trunc(Number(hours24) || 0) % 24) + 24) % 24;
        const m = ((Math.trunc(Number(minutes) || 0) % 60) + 60) % 60;
        const hWord = HOURS_WORDS[h % 12];
        const nextHWord = HOURS_WORDS[(h + 1) % 12];

        if (style === 'digital') {
            if (m === 0) return capitalizeFirst(`${hWord} o'clock`);
            if (m < 10) return capitalizeFirst(`${hWord} oh ${numberToWords(m)}`);
            return capitalizeFirst(`${hWord} ${numberToWords(m)}`);
        }

        if (m === 0) return capitalizeFirst(`${hWord} o'clock`);
        if (m === 15) return `Quarter past ${hWord}`;
        if (m === 30) return `Half past ${hWord}`;
        if (m === 45) return `Quarter to ${nextHWord}`;
        if (m < 30) return capitalizeFirst(`${numberToWords(m)} past ${hWord}`);
        return capitalizeFirst(`${numberToWords(60 - m)} to ${nextHWord}`);
    }

    function formatStopwatch(ms) {
        const safeMs = Math.max(0, Math.floor(Number(ms) || 0));
        const totalSec = Math.floor(safeMs / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const cs = Math.floor((safeMs % 1000) / 10);
        const main = h > 0 ? `${padZero(h)}:${padZero(m)}:${padZero(s)}` : `${padZero(m)}:${padZero(s)}`;
        return { main, ms: `.${padZero(cs)}` };
    }

    function formatTimeFull(ms) {
        const parts = formatStopwatch(ms);
        return `${parts.main}${parts.ms}`;
    }

    function toDateKey(date) {
        return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
    }

    function parseDateKey(key) {
        if (typeof key !== 'string') return null;
        const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key.trim());
        if (!match) return null;
        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);
        if (m < 1 || m > 12 || d < 1 || d > 31) return null;
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
        return dt;
    }

    function normalizeMarkedMap(rawMap) {
        const out = {};
        if (!rawMap || typeof rawMap !== 'object') return out;
        Object.keys(rawMap).forEach((rawKey) => {
            const parsed = parseDateKey(rawKey);
            if (!parsed) return;
            const val = rawMap[rawKey];
            if (!val) return;
            const canon = toDateKey(parsed);
            if (val === true) {
                out[canon] = { color: 'pink', note: '' };
            } else if (typeof val === 'object') {
                const color = VALID_CAL_COLORS.includes(val.color) ? val.color : 'pink';
                const note = String(val.note || '').trim().slice(0, 40);
                out[canon] = { color, note };
            }
        });
        return out;
    }

    function calcNextTargetDate(h12, min, ampm, nowDate = new Date()) {
        let targetH = Math.max(1, Math.min(12, Math.trunc(Number(h12) || 12)));
        const targetM = Math.max(0, Math.min(59, Math.trunc(Number(min) || 0)));
        if (ampm === 'PM' && targetH < 12) targetH += 12;
        if (ampm === 'AM' && targetH === 12) targetH = 0;

        const targetDate = new Date(
            nowDate.getFullYear(),
            nowDate.getMonth(),
            nowDate.getDate(),
            targetH,
            targetM,
            0,
            0
        );
        let isTomorrow = false;
        if (targetDate.getTime() <= nowDate.getTime()) {
            targetDate.setDate(targetDate.getDate() + 1);
            isTomorrow = true;
        }
        return {
            targetDate,
            isTomorrow,
            diffMs: targetDate.getTime() - nowDate.getTime()
        };
    }

    function calcNextAlarmDiff(alarmObj, nowDate = new Date()) {
        if (!alarmObj) return Infinity;
        const h24 = Number(alarmObj.adjustedH);
        const min = Number(alarmObj.m);
        if (!Number.isFinite(h24) || !Number.isFinite(min)) return Infinity;
        const repeat = alarmObj.repeat || 'once';

        for (let offset = 0; offset <= 7; offset++) {
            const cand = new Date(
                nowDate.getFullYear(),
                nowDate.getMonth(),
                nowDate.getDate() + offset,
                h24,
                min,
                0,
                0
            );
            if (cand.getTime() <= nowDate.getTime()) continue;
            if (repeat === 'weekdays') {
                const dow = cand.getDay();
                if (dow === 0 || dow === 6) continue;
            }
            return cand.getTime() - nowDate.getTime();
        }
        return Infinity;
    }

    function countWeekdaysBetween(startDate, endDate) {
        const a = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const b = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const tA = a.getTime();
        const tB = b.getTime();
        if (tA === tB) return 0;
        const minTime = Math.min(tA, tB);
        const maxTime = Math.max(tA, tB);
        const cur = new Date(minTime);
        cur.setDate(cur.getDate() + 1);
        let count = 0;
        while (cur.getTime() <= maxTime) {
            const dow = cur.getDay();
            if (dow >= 1 && dow <= 5) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    }

    function formatHumanDuration(ms) {
        const totalMin = Math.max(1, Math.ceil(ms / 60000));
        const d = Math.floor(totalMin / 1440);
        const h = Math.floor((totalMin % 1440) / 60);
        const m = totalMin % 60;
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || parts.length === 0) parts.push(`${m}m`);
        return parts.join(' ');
    }

    // ========================================================
    // DOM & ICON HELPERS
    // ========================================================
    const DOM = {
        cache: new Map(),
        get(id) {
            if (!this.cache.has(id)) {
                const el = document.getElementById(id);
                if (!el) return null;
                this.cache.set(id, el);
            }
            return this.cache.get(id);
        }
    };

    function hydrateIcons(root) {
        if (typeof lucide === 'undefined' || typeof lucide.createIcons !== 'function') return;
        try {
            lucide.createIcons(root && root !== document ? { root } : undefined);
        } catch (_) {
            lucide.createIcons();
        }
    }

    function showToast(message, type = 'info') {
        const container = DOM.get('toast-container');
        if (!container) return;
        while (container.children.length >= 3) {
            container.firstElementChild.remove();
        }
        const colors = {
            info: 'bg-blue text-white',
            success: 'bg-green text-white',
            warning: 'bg-orange text-white',
            error: 'bg-pink text-white'
        };
        const icons = {
            info: 'info',
            success: 'check-circle',
            warning: 'alert-triangle',
            error: 'alert-circle'
        };
        const el = document.createElement('div');
        el.className = `pointer-events-auto px-4 py-2.5 rounded-2xl border-[3px] border-[#1e293b] shadow-[4px_4px_0px_0px_#1e293b] font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-2 animate-pop-in ${colors[type] || colors.info}`;
        el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 flex-shrink-0"></i><span></span>`;
        el.querySelector('span').textContent = String(message);
        container.appendChild(el);
        hydrateIcons(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            setTimeout(() => el.remove(), 260);
        }, 2500);
    }

    // ========================================================
    // GLOBAL APPLICATION STATE
    // ========================================================
    const state = {
        currentTool: 'clock',
        uiMode: 'simple',
        focusStageActive: false,
        schedulerInterval: null,
        clock: {
            is24Hour: false,
            isAnalog: false,
            showSeconds: true,
            wordsMode: 'off', // 'off' | 'classic' | 'digital'
            showWorld: false,
            showMinHelpers: false,
            teachMode: false,
            teachMinutes: 9 * 60 + 15,
            teachRevealAnswer: true,
            worldCities: ['London', 'New York', 'Tokyo'],
            lastSecond: -1
        },
        stopwatch: {
            startEpoch: 0,
            startTime: 0,
            elapsed: 0,
            running: false,
            animFrame: null,
            laps: []
        },
        timer: {
            remainingMs: 300000,
            initial: 300,
            lastDuration: 300,
            running: false,
            hasStarted: false,
            endTimestamp: 0,
            interval: null,
            repeatTimeout: null,
            mode: 'calm', // 'calm' | 'bomb' | 'traffic'
            sound: 'chime', // 'chime' | 'bell' | 'fanfare' | 'bomb'
            tickEnabled: true,
            repeat: false,
            round: 1,
            task: '',
            lastWholeSec: -1
        },
        alarm: {
            alarms: [],
            editingId: null,
            ampm: 'AM',
            repeat: 'once',
            soundInterval: null,
            currentlyRinging: null
        },
        countdown: {
            active: false,
            target: null, // { h, m, ampm }
            targetTimestamp: 0,
            startedAt: 0,
            isTomorrow: false,
            label: '',
            ampm: 'PM'
        },
        calendar: {
            date: new Date(),
            marked: {},
            selected: toDateKey(new Date()),
            selectedColor: 'pink',
            viewMode: 'month',
            weekStart: 'mon' // 'mon' | 'sun'
        },
        audio: {
            ctx: null,
            timeouts: [],
            muted: localStorage.getItem(CONSTANTS.LS_MUTED) === 'true'
        },
        darkMode: document.documentElement.classList.contains('dark'),
        sidebarCollapsed: false
    };

    // ========================================================
    // AUDIO ENGINE (Lazy AudioContext + Resume + Multi-Chimes)
    // ========================================================
    const audio = {
        ensureContext() {
            if (!state.audio.ctx && typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) state.audio.ctx = new AudioCtx();
            }
            if (state.audio.ctx && state.audio.ctx.state === 'suspended') {
                state.audio.ctx.resume().catch(() => {});
            }
            return state.audio.ctx;
        },
        scheduleTone(freq, type, startDelay, duration, volume = 0.12) {
            if (state.audio.muted) return;
            const ctx = this.ensureContext();
            if (!ctx) return;

            const id = setTimeout(() => {
                if (state.audio.muted) return;
                try {
                    const now = ctx.currentTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.frequency.setValueAtTime(freq, now);
                    osc.type = type;
                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
                    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + duration + 0.02);
                } catch (_) {}
            }, startDelay);
            state.audio.timeouts.push(id);
        },
        playTick() {
            if (state.audio.muted || !state.timer.tickEnabled) return;
            const isBomb = state.timer.mode === 'bomb';
            this.scheduleTone(isBomb ? 780 : 420, isBomb ? 'square' : 'sine', 0, 0.045, isBomb ? 0.035 : 0.04);
        },
        playSound(kind = 'chime') {
            if (state.audio.muted) return;
            this.ensureContext();
            if (kind === 'bell') {
                [880, 1174.66, 880, 1174.66].forEach((f, idx) => {
                    this.scheduleTone(f, 'triangle', idx * 140, 0.28, 0.14);
                });
            } else if (kind === 'fanfare') {
                const notes = [523.25, 659.25, 783.99, 1046.5];
                notes.forEach((f, idx) => {
                    this.scheduleTone(f, 'triangle', idx * 120, idx === 3 ? 0.65 : 0.18, 0.14);
                });
            } else if (kind === 'bomb') {
                [180, 130, 95, 70].forEach((f, idx) => {
                    this.scheduleTone(f, 'sawtooth', idx * 80, 0.25, 0.16);
                });
                this.scheduleTone(55, 'square', 0, 0.75, 0.12);
            } else {
                // Warm Classroom Chime
                this.scheduleTone(523.25, 'sine', 0, 0.65, 0.16);
                this.scheduleTone(659.25, 'sine', 160, 0.75, 0.15);
                this.scheduleTone(783.99, 'sine', 340, 1.0, 0.16);
            }
        },
        playAlarmCycle(soundName = 'bell') {
            if (!state.alarm.currentlyRinging || state.audio.muted) return;
            this.playSound(soundName);
        },
        stopAllTones() {
            state.audio.timeouts.forEach(clearTimeout);
            state.audio.timeouts = [];
        },
        toggleMute() {
            state.audio.muted = !state.audio.muted;
            localStorage.setItem(CONSTANTS.LS_MUTED, state.audio.muted ? 'true' : 'false');
            if (state.audio.muted) this.stopAllTones();
            this.updateMuteUI();
            showToast(state.audio.muted ? 'Sounds muted' : 'Sounds enabled', state.audio.muted ? 'warning' : 'info');
        },
        updateMuteUI() {
            const buttons = [DOM.get('btn-mute-toggle'), DOM.get('btn-mute-mobile')];
            buttons.forEach((btn) => {
                if (!btn) return;
                btn.innerHTML = state.audio.muted
                    ? '<i data-lucide="volume-x" class="w-4 h-4 text-pink"></i>'
                    : '<i data-lucide="volume-2" class="w-4 h-4 text-blue"></i>';
                btn.title = state.audio.muted ? 'Unmute Sounds (M)' : 'Mute Sounds (M)';
                hydrateIcons(btn);
            });
        }
    };

    // ========================================================
    // DARK MODE & HUB SYNC
    // ========================================================
    const darkMode = {
        apply(isDark) {
            state.darkMode = Boolean(isDark);
            document.documentElement.classList.toggle('dark', state.darkMode);
        },
        toggle() {
            this.apply(!state.darkMode);
            localStorage.setItem(CONSTANTS.LS_DARK_MODE, state.darkMode ? 'dark' : 'light');
            localStorage.setItem('klasskit-theme', state.darkMode ? 'dark' : 'light');
            saveAllToCloud();
        }
    };

    // ========================================================
    // FOCUS STAGE (UNIVERSAL FULLSCREEN FOR PROJECTORS)
    // ========================================================
    const focusStage = {
        enter() {
            state.focusStageActive = true;
            document.body.classList.add('focus-stage-mode');
            const rootEl = document.documentElement;
            if (rootEl && rootEl.requestFullscreen && !document.fullscreenElement) {
                rootEl.requestFullscreen().catch(() => {});
            }
        },
        exit() {
            state.focusStageActive = false;
            document.body.classList.remove('focus-stage-mode');
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        },
        toggle(targetTool) {
            if (targetTool && state.currentTool !== targetTool) {
                switchTool(targetTool);
            }
            if (state.focusStageActive) this.exit();
            else this.enter();
        }
    };

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && state.focusStageActive) {
            state.focusStageActive = false;
            document.body.classList.remove('focus-stage-mode');
        }
    });

    // ========================================================
    // SIDEBAR & NAVIGATION BADGES
    // ========================================================
    const sidebar = {
        init() {
            const saved = localStorage.getItem(CONSTANTS.LS_SIDEBAR);
            if (saved === 'true') {
                state.sidebarCollapsed = true;
                const el = DOM.get('app-sidebar');
                if (el) el.classList.add('collapsed');
            }
        },
        toggle() {
            const el = DOM.get('app-sidebar');
            const overlay = DOM.get('sidebar-overlay');
            if (window.innerWidth < 768) {
                if (!el) return;
                const willOpen = !el.classList.contains('mobile-open');
                el.classList.toggle('mobile-open', willOpen);
                if (overlay) {
                    if (willOpen) {
                        overlay.classList.remove('hidden');
                        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
                    } else {
                        overlay.classList.add('opacity-0');
                        setTimeout(() => overlay.classList.add('hidden'), 280);
                    }
                }
            } else {
                state.sidebarCollapsed = !state.sidebarCollapsed;
                if (el) el.classList.toggle('collapsed', state.sidebarCollapsed);
                localStorage.setItem(CONSTANTS.LS_SIDEBAR, String(state.sidebarCollapsed));
                saveAllToCloud();
            }
        },
        updateBadges() {
            const cBadge = DOM.get('nav-badge-clock');
            if (cBadge) cBadge.classList.toggle('visible', state.clock.teachMode);

            const swBadge = DOM.get('nav-badge-stopwatch');
            if (swBadge) {
                if (state.stopwatch.running || state.stopwatch.elapsed > 0) {
                    swBadge.textContent = formatStopwatch(state.stopwatch.elapsed).main;
                    swBadge.classList.add('visible');
                } else {
                    swBadge.classList.remove('visible');
                }
            }

            const tBadge = DOM.get('nav-badge-timer');
            if (tBadge) {
                if (state.timer.running) {
                    const sec = Math.ceil(state.timer.remainingMs / 1000);
                    tBadge.textContent = `${padZero(Math.floor(sec / 60))}:${padZero(sec % 60)}`;
                    tBadge.classList.add('visible');
                } else {
                    tBadge.classList.remove('visible');
                }
            }

            const aBadge = DOM.get('nav-badge-alarm');
            if (aBadge) {
                const enabledCount = state.alarm.alarms.filter(a => a.enabled).length;
                aBadge.textContent = String(enabledCount);
                aBadge.classList.toggle('visible', enabledCount > 0);
            }

            const cdBadge = DOM.get('nav-badge-countdown');
            if (cdBadge) {
                cdBadge.classList.toggle('visible', state.countdown.active);
            }

            const calBadge = DOM.get('nav-badge-calendar');
            if (calBadge) {
                const count = Object.keys(state.calendar.marked).length;
                calBadge.textContent = String(count);
                calBadge.classList.toggle('visible', count > 0);
            }
        }
    };

    function switchTool(toolId) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        const navBtn = DOM.get(`nav-${toolId}`);
        if (navBtn) navBtn.classList.add('active');

        document.querySelectorAll('.tool-section').forEach(sec => sec.classList.remove('active'));
        const target = DOM.get(`tool-${toolId}`);
        if (target) target.classList.add('active');

        state.currentTool = toolId;

        const mobileTitle = DOM.get('mobile-tool-title');
        if (mobileTitle) {
            mobileTitle.textContent = capitalizeFirst(toolId);
        }

        if (toolId === 'clock') {
            state.clock.lastSecond = -1;
            clock.update();
            clock.updateWorldClocks();
        } else if (toolId === 'alarm') {
            alarm.renderList();
        } else if (toolId === 'countdown') {
            countdown.updatePreview();
            countdown.update();
        }

        if (window.innerWidth < 768) {
            const el = DOM.get('app-sidebar');
            const overlay = DOM.get('sidebar-overlay');
            if (el && el.classList.contains('mobile-open')) {
                el.classList.remove('mobile-open');
                if (overlay) {
                    overlay.classList.add('opacity-0');
                    setTimeout(() => overlay.classList.add('hidden'), 280);
                }
            }
        }
    }

    // ========================================================
    // 1. LOCATION & WEATHER MODULE (No Nagging Prompt on Boot)
    // ========================================================
    const locationWeather = {
        getFallbackCity() {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
                return tz.split('/').pop().replace(/_/g, ' ');
            } catch (_) {
                return 'Local Time';
            }
        },
        renderPill(iconName, text, isLoading = false) {
            const container = DOM.get('clock-location-marker');
            if (!container) return;
            const iconClass = isLoading ? 'w-3.5 h-3.5 text-blue animate-spin' : 'w-3.5 h-3.5 text-orange';
            container.innerHTML = `
                <button type="button" onclick="clockRefreshWeather()"
                    class="chip-pill inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-heading font-bold"
                    title="Click to load / refresh local weather">
                    <i data-lucide="${escapeHtml(iconName)}" class="${iconClass}"></i>
                    <span>${escapeHtml(text)}</span>
                </button>`;
            hydrateIcons(container);
        },
        async init() {
            const city = this.getFallbackCity();
            this.renderPill('map-pin', `${city} · Tap for weather`);

            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const status = await navigator.permissions.query({ name: 'geolocation' });
                    if (status.state === 'granted') {
                        this.requestWeather(false);
                    }
                } catch (_) {}
            }
        },
        requestWeather(userInitiated = true) {
            if (!navigator.geolocation) {
                this.renderPill('map-pin', this.getFallbackCity());
                if (userInitiated) showToast('Geolocation not supported here', 'warning');
                return;
            }
            this.renderPill('loader-2', 'Checking weather...', true);
            navigator.geolocation.getCurrentPosition(
                (pos) => this.fetchData(pos.coords.latitude, pos.coords.longitude),
                () => {
                    this.renderPill('map-pin', this.getFallbackCity());
                    if (userInitiated) showToast('Using local timezone (location denied)', 'info');
                },
                { timeout: 8000 }
            );
        },
        async fetchData(lat, lon) {
            try {
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const wData = await wRes.json();
                const temp = Math.round(wData.current_weather.temperature);
                const icon = this.mapWeatherCode(wData.current_weather.weathercode, wData.current_weather.is_day);

                let city = this.getFallbackCity();
                try {
                    const gRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                    const gData = await gRes.json();
                    city = gData.city || gData.locality || city;
                } catch (_) {}

                this.renderPill(icon, `${city} · ${temp}°C`);
            } catch (_) {
                this.renderPill('map-pin', this.getFallbackCity());
            }
        },
        mapWeatherCode(code, isDay) {
            if (code === 0) return isDay ? 'sun' : 'moon';
            if (code === 1 || code === 2) return isDay ? 'cloud-sun' : 'cloud-moon';
            if (code === 3) return 'cloud';
            if (code >= 45 && code <= 48) return 'cloud-fog';
            if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'cloud-rain';
            if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'cloud-snow';
            if (code >= 95) return 'cloud-lightning';
            return isDay ? 'sun' : 'moon';
        }
    };

    // ========================================================
    // 2. CLOCK MODULE (Digital, Analog Teaching, Words, World Clocks)
    // ========================================================
    const clock = {
        initFace() {
            const markers = DOM.get('clock-face-markers');
            const numbers = DOM.get('clock-face-numbers');
            const minutesG = DOM.get('clock-face-minutes');
            const svgNS = 'http://www.w3.org/2000/svg';

            if (markers && markers.children.length === 0) {
                const frag = document.createDocumentFragment();
                for (let i = 0; i < CONSTANTS.CLOCK_MARKERS; i++) {
                    const isHour = i % 5 === 0;
                    const line = document.createElementNS(svgNS, 'line');
                    line.setAttribute('x1', '100');
                    line.setAttribute('y1', '14');
                    line.setAttribute('x2', '100');
                    line.setAttribute('y2', isHour ? '24' : '19');
                    line.setAttribute('stroke', 'currentColor');
                    line.setAttribute('stroke-width', isHour ? '3' : '1.4');
                    line.setAttribute('stroke-linecap', 'round');
                    line.setAttribute('transform', `rotate(${i * 6} 100 100)`);
                    frag.appendChild(line);
                }
                markers.appendChild(frag);
            }

            if (numbers && numbers.children.length === 0) {
                const frag = document.createDocumentFragment();
                for (let h = 1; h <= 12; h++) {
                    const angle = (h * 30 - 90) * (Math.PI / 180);
                    const x = 100 + Math.cos(angle) * 63;
                    const y = 100 + Math.sin(angle) * 63;
                    const text = document.createElementNS(svgNS, 'text');
                    text.setAttribute('x', x.toFixed(1));
                    text.setAttribute('y', y.toFixed(1));
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('dominant-baseline', 'central');
                    text.setAttribute('fill', 'currentColor');
                    text.setAttribute('font-family', 'Fredoka, sans-serif');
                    text.setAttribute('font-weight', '700');
                    text.setAttribute('font-size', '14');
                    text.textContent = String(h);
                    frag.appendChild(text);
                }
                numbers.appendChild(frag);
            }

            if (minutesG && minutesG.children.length === 0) {
                const frag = document.createDocumentFragment();
                for (let m = 0; m < 60; m += 5) {
                    const angle = (m * 6 - 90) * (Math.PI / 180);
                    const x = 100 + Math.cos(angle) * 88;
                    const y = 100 + Math.sin(angle) * 88;
                    const text = document.createElementNS(svgNS, 'text');
                    text.setAttribute('x', x.toFixed(1));
                    text.setAttribute('y', y.toFixed(1));
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('dominant-baseline', 'central');
                    text.setAttribute('fill', 'currentColor');
                    text.setAttribute('font-family', 'Share Tech Mono, monospace');
                    text.setAttribute('font-weight', '700');
                    text.setAttribute('font-size', '9.5');
                    text.textContent = m === 0 ? '00' : padZero(m);
                    frag.appendChild(text);
                }
                minutesG.appendChild(frag);
            }

            this.populateWorldDropdown();
        },
        populateWorldDropdown() {
            const sel = DOM.get('clock-world-select');
            if (!sel) return;
            sel.innerHTML = '<option value="">+ Add City...</option>' +
                WORLD_CITY_CATALOG.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
        },
        savePrefs() {
            localStorage.setItem(CONSTANTS.LS_CLOCK_PREFS, JSON.stringify({
                is24Hour: state.clock.is24Hour,
                isAnalog: state.clock.isAnalog,
                showSeconds: state.clock.showSeconds,
                wordsMode: state.clock.wordsMode,
                showWorld: state.clock.showWorld,
                showMinHelpers: state.clock.showMinHelpers
            }));
            localStorage.setItem(CONSTANTS.LS_WORLD_CLOCKS, JSON.stringify(state.clock.worldCities));
            saveAllToCloud();
        },
        applyPreferencesUI() {
            const c = state.clock;
            const btnFormat = DOM.get('clock-btn-format');
            const btnView = DOM.get('clock-btn-view');
            const btnWords = DOM.get('clock-btn-words');
            const btnSec = DOM.get('clock-btn-seconds');
            const btnWorld = DOM.get('clock-btn-world');
            const btnMinHelp = DOM.get('clock-btn-min-helpers');
            const btnTeach = DOM.get('clock-btn-teach');
            const teachCtrl = DOM.get('clock-teach-controls');
            const teachAns = DOM.get('clock-teach-answer');
            const digitalPane = DOM.get('clock-digital');
            const analogPane = DOM.get('clock-analog');
            const secWrap = DOM.get('clock-sec-wrap');
            const handSec = DOM.get('hand-sec');
            const minutesG = DOM.get('clock-face-minutes');
            const worldPanel = DOM.get('clock-world-panel');
            const modeBadge = DOM.get('clock-mode-badge');

            if (btnFormat) btnFormat.textContent = c.is24Hour ? '24H' : '12H';
            if (btnView) btnView.textContent = c.isAnalog ? 'DIGITAL' : 'ANALOG';

            if (digitalPane && analogPane) {
                digitalPane.classList.toggle('active', !c.isAnalog);
                analogPane.classList.toggle('active', c.isAnalog);
            }

            if (secWrap) secWrap.classList.toggle('is-hidden', !c.showSeconds);
            if (handSec) handSec.style.display = (c.showSeconds && !c.teachMode) ? 'block' : 'none';
            if (btnSec) {
                btnSec.textContent = c.showSeconds ? 'SEC: ON' : 'SEC: OFF';
                btnSec.classList.toggle('bg-blue', c.showSeconds);
                btnSec.classList.toggle('text-white', c.showSeconds);
                btnSec.classList.toggle('bg-white', !c.showSeconds);
                btnSec.classList.toggle('dark:bg-slate-800', !c.showSeconds);
                btnSec.classList.toggle('text-dark', !c.showSeconds);
                btnSec.classList.toggle('dark:text-white', !c.showSeconds);
            }

            if (btnWords) {
                const labelMap = { off: 'WORDS: OFF', classic: 'WORDS: CLASSIC', digital: 'WORDS: SAY' };
                const span = btnWords.querySelector('span');
                if (span) span.textContent = labelMap[c.wordsMode] || 'WORDS: OFF';
                btnWords.classList.toggle('bg-pink', c.wordsMode !== 'off');
                btnWords.classList.toggle('text-white', c.wordsMode !== 'off');
                btnWords.classList.toggle('bg-white', c.wordsMode === 'off');
                btnWords.classList.toggle('dark:bg-slate-800', c.wordsMode === 'off');
                btnWords.classList.toggle('text-dark', c.wordsMode === 'off');
                btnWords.classList.toggle('dark:text-white', c.wordsMode === 'off');
                const icon = btnWords.querySelector('svg, i');
                if (icon) {
                    icon.classList.toggle('text-white', c.wordsMode !== 'off');
                    icon.classList.toggle('text-pink', c.wordsMode === 'off');
                }
            }

            if (worldPanel && btnWorld) {
                worldPanel.classList.toggle('open', c.showWorld);
                btnWorld.classList.toggle('bg-blue', c.showWorld);
                btnWorld.classList.toggle('text-white', c.showWorld);
                btnWorld.classList.toggle('bg-white', !c.showWorld);
                btnWorld.classList.toggle('dark:bg-slate-800', !c.showWorld);
                btnWorld.classList.toggle('text-dark', !c.showWorld);
                btnWorld.classList.toggle('dark:text-white', !c.showWorld);
                const icon = btnWorld.querySelector('svg, i');
                if (icon) {
                    icon.classList.toggle('text-white', c.showWorld);
                    icon.classList.toggle('text-blue', !c.showWorld);
                }
            }

            if (minutesG) minutesG.classList.toggle('is-hidden', !c.showMinHelpers);
            if (btnMinHelp) {
                btnMinHelp.classList.toggle('bg-orange', c.showMinHelpers);
                btnMinHelp.classList.toggle('text-white', c.showMinHelpers);
                btnMinHelp.classList.toggle('bg-white', !c.showMinHelpers);
                btnMinHelp.classList.toggle('dark:bg-slate-800', !c.showMinHelpers);
                btnMinHelp.classList.toggle('text-dark', !c.showMinHelpers);
                btnMinHelp.classList.toggle('dark:text-white', !c.showMinHelpers);
            }

            if (teachCtrl) teachCtrl.classList.toggle('is-hidden', !c.teachMode);
            if (teachAns) teachAns.classList.toggle('is-hidden', !c.teachMode);
            if (btnTeach) {
                btnTeach.classList.toggle('bg-orange', c.teachMode);
                btnTeach.classList.toggle('text-white', c.teachMode);
                btnTeach.classList.toggle('bg-white', !c.teachMode);
                btnTeach.classList.toggle('dark:bg-slate-800', !c.teachMode);
                btnTeach.classList.toggle('text-dark', !c.teachMode);
                btnTeach.classList.toggle('dark:text-white', !c.teachMode);
            }

            if (modeBadge) {
                const span = modeBadge.querySelector('span');
                if (c.teachMode) {
                    modeBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[#1e293b] dark:border-slate-600 bg-orange/15 text-orange font-heading font-bold text-[11px] uppercase tracking-wider';
                    if (span) span.textContent = 'TEACH MODE';
                } else {
                    modeBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[#1e293b] dark:border-slate-600 bg-green/15 text-green font-heading font-bold text-[11px] uppercase tracking-wider';
                    if (span) span.textContent = 'LIVE CLOCK';
                }
            }

            this.renderWorldClocks();
            c.lastSecond = -1;
            this.update();
        },
        update() {
            const c = state.clock;
            const now = new Date();
            let h = now.getHours();
            let m = now.getMinutes();
            let s = now.getSeconds();

            if (c.teachMode) {
                const normalized = ((c.teachMinutes % 1440) + 1440) % 1440;
                h = Math.floor(normalized / 60);
                m = normalized % 60;
                s = 0;
            }

            const sig = `${h}:${m}:${s}:${c.is24Hour}:${c.wordsMode}:${c.teachMode}:${c.teachRevealAnswer}`;
            if (sig === c.lastSecond) return;
            c.lastSecond = sig;

            const displayHour = c.is24Hour ? padZero(h) : String(h % 12 || 12);
            const displayMin = padZero(m);
            const displaySec = padZero(s);
            const ampm = h >= 12 ? 'PM' : 'AM';

            const elTime = DOM.get('clock-time');
            const elSec = DOM.get('clock-sec-dig');
            const elAmPm = DOM.get('clock-ampm');
            const elDate = DOM.get('clock-date');
            const elDateAnalog = DOM.get('clock-date-analog');
            const elTeachAns = DOM.get('clock-teach-answer');

            if (elTime) elTime.textContent = `${displayHour}:${displayMin}`;
            if (elSec) elSec.textContent = displaySec;
            if (elAmPm) {
                elAmPm.textContent = ampm;
                elAmPm.style.display = c.is24Hour ? 'none' : 'block';
            }

            const dateStr = `${CONSTANTS.DAYS[now.getDay()]}, ${CONSTANTS.MONTHS[now.getMonth()]} ${now.getDate()}`;
            if (elDate) elDate.textContent = dateStr;
            if (elDateAnalog) elDateAnalog.textContent = c.teachMode ? 'PRACTICE TIME' : dateStr;

            if (elTeachAns && c.teachMode) {
                elTeachAns.textContent = c.teachRevealAnswer
                    ? (c.is24Hour ? `${displayHour}:${displayMin}` : `${displayHour}:${displayMin} ${ampm}`)
                    : 'TAP REVEAL';
            }

            // Analog Hands
            const secRatio = s / 60;
            const minRatio = (m + secRatio) / 60;
            const hourRatio = ((h % 12) + minRatio) / 12;

            const handSec = DOM.get('hand-sec');
            const handMin = DOM.get('hand-min');
            const handHour = DOM.get('hand-hour');
            if (handSec) handSec.setAttribute('transform', `rotate(${secRatio * 360} 100 100)`);
            if (handMin) handMin.setAttribute('transform', `rotate(${minRatio * 360} 100 100)`);
            if (handHour) handHour.setAttribute('transform', `rotate(${hourRatio * 360} 100 100)`);

            // Spoken English Time Readout
            const banner = DOM.get('clock-words-banner');
            const wordsText = DOM.get('clock-words-text');
            const wordsPill = DOM.get('clock-words-mode-pill');
            if (banner && wordsText) {
                const shouldHideWords = c.wordsMode === 'off' || (c.teachMode && !c.teachRevealAnswer);
                banner.classList.toggle('is-hidden', shouldHideWords);
                if (!shouldHideWords) {
                    wordsText.textContent = formatTimeInWords(h, m, c.wordsMode);
                    if (wordsPill) wordsPill.textContent = c.wordsMode === 'classic' ? 'CLASSIC' : 'SPOKEN';
                }
            }

            sidebar.updateBadges();
        },
        toggleFormat() {
            state.clock.is24Hour = !state.clock.is24Hour;
            this.applyPreferencesUI();
            this.updateWorldClocks();
            this.savePrefs();
        },
        toggleView() {
            state.clock.isAnalog = !state.clock.isAnalog;
            if (!state.clock.isAnalog && state.clock.teachMode) {
                state.clock.teachMode = false;
            }
            this.applyPreferencesUI();
            this.savePrefs();
        },
        toggleSeconds() {
            state.clock.showSeconds = !state.clock.showSeconds;
            this.applyPreferencesUI();
            this.savePrefs();
        },
        cycleWords() {
            const order = ['off', 'classic', 'digital'];
            const idx = order.indexOf(state.clock.wordsMode);
            state.clock.wordsMode = order[(idx + 1) % order.length];
            this.applyPreferencesUI();
            this.savePrefs();
        },
        toggleWorldPanel() {
            state.clock.showWorld = !state.clock.showWorld;
            this.applyPreferencesUI();
            this.savePrefs();
        },
        addWorldCity(cityId) {
            if (!cityId) return;
            if (state.clock.worldCities.includes(cityId)) {
                showToast(`${cityId} is already pinned`, 'info');
            } else if (state.clock.worldCities.length >= 6) {
                showToast('Max 6 world cities pinned', 'warning');
            } else {
                state.clock.worldCities.push(cityId);
                this.renderWorldClocks();
                this.savePrefs();
            }
            const sel = DOM.get('clock-world-select');
            if (sel) sel.value = '';
        },
        removeWorldCity(cityId) {
            state.clock.worldCities = state.clock.worldCities.filter(c => c !== cityId);
            this.renderWorldClocks();
            this.savePrefs();
        },
        renderWorldClocks() {
            const grid = DOM.get('clock-world-grid');
            if (!grid || !state.clock.showWorld) return;
            grid.innerHTML = state.clock.worldCities.map((cityId) => {
                const entry = WORLD_CITY_CATALOG.find(c => c.id === cityId) || { id: cityId, label: cityId, zone: 'UTC' };
                return `
                    <div class="p-2.5 rounded-xl border-2 border-[#1e293b] dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-between gap-2 shadow-[2px_2px_0px_0px_#1e293b] dark:shadow-[2px_2px_0px_0px_#000]">
                        <div class="min-w-0">
                            <div class="text-[11px] font-heading font-bold uppercase text-slate-500 dark:text-slate-400 truncate">${escapeHtml(entry.label)}</div>
                            <div class="font-mono font-bold text-base text-dark dark:text-white leading-tight" data-world-city="${escapeHtml(entry.id)}">--:--</div>
                        </div>
                        <button type="button" onclick="clockRemoveWorldCity('${escapeHtml(entry.id)}')" class="p-1 rounded-lg hover:bg-pink/15 text-slate-400 hover:text-pink transition-colors" title="Remove city">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>`;
            }).join('');
            hydrateIcons(grid);
            this.updateWorldClocks();
        },
        updateWorldClocks() {
            if (!state.clock.showWorld) return;
            const grid = DOM.get('clock-world-grid');
            if (!grid) return;
            const now = new Date();
            state.clock.worldCities.forEach((cityId) => {
                const entry = WORLD_CITY_CATALOG.find(c => c.id === cityId);
                const el = grid.querySelector(`[data-world-city="${CSS.escape ? CSS.escape(cityId) : cityId}"]`);
                if (!entry || !el) return;
                try {
                    const fmt = new Intl.DateTimeFormat('en-US', {
                        timeZone: entry.zone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: !state.clock.is24Hour
                    });
                    el.textContent = fmt.format(now);
                } catch (_) {
                    el.textContent = '--:--';
                }
            });
        },
        toggleTeachMode(forceVal) {
            const next = typeof forceVal === 'boolean' ? forceVal : !state.clock.teachMode;
            state.clock.teachMode = next;
            if (next) {
                state.clock.isAnalog = true;
                const now = new Date();
                const roundedMin = Math.round(now.getMinutes() / 5) * 5;
                state.clock.teachMinutes = now.getHours() * 60 + roundedMin;
            }
            this.applyPreferencesUI();
        },
        stepTeach(deltaMinutes) {
            if (!state.clock.teachMode) state.clock.teachMode = true;
            state.clock.teachMinutes = ((state.clock.teachMinutes + deltaMinutes) % 1440 + 1440) % 1440;
            this.applyPreferencesUI();
        },
        randomTeach() {
            if (!state.clock.teachMode) state.clock.teachMode = true;
            const h = Math.floor(Math.random() * 12) + 1;
            const m = Math.floor(Math.random() * 12) * 5;
            state.clock.teachMinutes = (h === 12 ? 0 : h) * 60 + m;
            this.applyPreferencesUI();
        },
        toggleRevealAnswer() {
            state.clock.teachRevealAnswer = !state.clock.teachRevealAnswer;
            const btn = DOM.get('clock-btn-reveal-answer');
            if (btn) {
                btn.innerHTML = state.clock.teachRevealAnswer
                    ? '<i data-lucide="eye" class="w-3 h-3"></i> Hide Answer'
                    : '<i data-lucide="eye-off" class="w-3 h-3"></i> Reveal';
                hydrateIcons(btn);
            }
            state.clock.lastSecond = -1;
            this.update();
        },
        toggleMinuteHelpers() {
            state.clock.showMinHelpers = !state.clock.showMinHelpers;
            this.applyPreferencesUI();
            this.savePrefs();
        }
    };

    // ========================================================
    // 3. STOPWATCH MODULE
    // ========================================================
    const stopwatch = {
        lastDisplayUpdate: 0,
        toggle() {
            const sw = state.stopwatch;
            if (sw.running) {
                cancelAnimationFrame(sw.animFrame);
                sw.elapsed = Math.max(0, performance.now() - sw.startTime);
                sw.running = false;
                sw.startEpoch = 0;
                this.updateControlsUI();
                this.updateDisplay();
                this.saveState();
                if (!state.timer.running) document.title = 'Clock | KlassKit';
            } else {
                sw.startTime = performance.now() - sw.elapsed;
                sw.startEpoch = Date.now() - sw.elapsed;
                sw.running = true;
                this.updateControlsUI();
                this.animate();
                this.saveState();
            }
        },
        updateControlsUI() {
            const sw = state.stopwatch;
            const btn = DOM.get('sw-btn-main');
            const indicator = DOM.get('sw-indicator');
            const statusText = DOM.get('sw-status-text');

            if (btn) {
                btn.innerHTML = sw.running
                    ? '<i data-lucide="pause" class="w-7 h-7 fill-current"></i>'
                    : '<i data-lucide="play" class="w-7 h-7 fill-current ml-0.5"></i>';
                btn.classList.toggle('bg-orange', sw.running);
                btn.classList.toggle('bg-blue', !sw.running);
                hydrateIcons(btn);
            }
            if (indicator) {
                indicator.classList.toggle('bg-green', sw.running);
                indicator.classList.toggle('animate-pulse', sw.running);
                indicator.classList.toggle('bg-slate-300', !sw.running);
            }
            if (statusText) {
                statusText.textContent = sw.running ? 'RUNNING' : (sw.elapsed > 0 ? 'PAUSED' : 'READY');
            }
            sidebar.updateBadges();
        },
        animate() {
            const sw = state.stopwatch;
            if (!sw.running) return;
            const now = performance.now();
            sw.elapsed = Math.max(0, now - sw.startTime);
            if (now - this.lastDisplayUpdate >= 1000 / CONSTANTS.STOPWATCH_FPS) {
                this.updateDisplay();
                this.lastDisplayUpdate = now;
            }
            sw.animFrame = requestAnimationFrame(() => this.animate());
        },
        updateDisplay() {
            const sw = state.stopwatch;
            const parts = formatStopwatch(sw.elapsed);
            const display = DOM.get('sw-display');
            const ms = DOM.get('sw-ms');
            const ring = DOM.get('sw-ring');

            if (display) display.textContent = parts.main;
            if (ms) ms.textContent = parts.ms;
            if (sw.running) {
                const tStr = `${parts.main} — Stopwatch | KlassKit`;
                if (document.title !== tStr) document.title = tStr;
            }
            if (ring) {
                if (sw.elapsed === 0) {
                    ring.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE;
                } else {
                    const sec = (sw.elapsed / 1000) % 60;
                    ring.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - sec / 60);
                }
            }
        },
        lap() {
            const sw = state.stopwatch;
            if (sw.elapsed === 0) return;
            const currentElapsed = sw.running ? Math.max(0, performance.now() - sw.startTime) : sw.elapsed;
            const prevTotal = sw.laps.length > 0 ? sw.laps[0].total : 0;
            const split = Math.max(0, currentElapsed - prevTotal);
            const labelEl = DOM.get('sw-lap-label');
            const customLabel = labelEl ? labelEl.value.trim().slice(0, 24) : '';

            sw.laps.unshift({
                id: Date.now() + Math.random(),
                num: sw.laps.length + 1,
                total: currentElapsed,
                split,
                label: customLabel
            });
            if (labelEl) labelEl.value = '';
            this.renderLaps();
            this.saveState();
        },
        clearLaps() {
            state.stopwatch.laps = [];
            this.renderLaps();
            this.saveState();
        },
        reset() {
            if (state.stopwatch.running) this.toggle();
            state.stopwatch.elapsed = 0;
            state.stopwatch.startEpoch = 0;
            state.stopwatch.laps = [];
            this.updateDisplay();
            this.updateControlsUI();
            this.renderLaps();
            localStorage.removeItem(CONSTANTS.LS_STOPWATCH);
            if (!state.timer.running) document.title = 'Clock | KlassKit';
            saveAllToCloud();
        },
        renderLaps() {
            const sw = state.stopwatch;
            const container = DOM.get('sw-laps');
            const copyBtn = DOM.get('sw-copy-btn');
            const clearBtn = DOM.get('sw-clear-laps-btn');
            const countEl = DOM.get('sw-lap-count');
            const statsBar = DOM.get('sw-lap-stats');
            const bestEl = DOM.get('sw-stat-best');
            const avgEl = DOM.get('sw-stat-avg');

            if (countEl) countEl.textContent = String(sw.laps.length);

            if (!sw.laps.length) {
                if (copyBtn) copyBtn.classList.add('is-hidden');
                if (clearBtn) clearBtn.classList.add('is-hidden');
                if (statsBar) statsBar.classList.add('is-hidden');
                if (container) {
                    container.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full gap-1.5 opacity-55 text-slate-500 dark:text-slate-400">
                            <i data-lucide="flag" class="w-5 h-5"></i>
                            <span class="text-xs font-heading font-bold uppercase tracking-wider">Press Flag or L to mark a lap</span>
                        </div>`;
                    hydrateIcons(container);
                }
                return;
            }

            if (copyBtn) copyBtn.classList.remove('is-hidden');
            if (clearBtn) clearBtn.classList.remove('is-hidden');

            let fastestSplit = Infinity;
            let slowestSplit = -1;
            let sumSplits = 0;
            sw.laps.forEach((lap) => {
                if (lap.split < fastestSplit) fastestSplit = lap.split;
                if (lap.split > slowestSplit) slowestSplit = lap.split;
                sumSplits += lap.split;
            });

            if (statsBar) {
                const showStats = sw.laps.length >= 2;
                statsBar.classList.toggle('is-hidden', !showStats);
                if (showStats) {
                    if (bestEl) bestEl.textContent = formatTimeFull(fastestSplit);
                    if (avgEl) avgEl.textContent = formatTimeFull(sumSplits / sw.laps.length);
                }
            }

            if (container) {
                container.innerHTML = sw.laps.map((lap, idx) => {
                    const num = sw.laps.length - idx;
                    const isFastest = sw.laps.length >= 2 && lap.split === fastestSplit;
                    const isSlowest = sw.laps.length >= 2 && lap.split === slowestSplit && fastestSplit !== slowestSplit;
                    const badgeClass = isFastest
                        ? 'text-green bg-green/15 border-green'
                        : isSlowest
                            ? 'text-pink bg-pink/15 border-pink'
                            : 'text-blue bg-blue/10 border-blue';
                    const tagHtml = isFastest
                        ? '<span class="text-[9px] uppercase text-green ml-1">Best</span>'
                        : isSlowest
                            ? '<span class="text-[9px] uppercase text-pink ml-1">Slow</span>'
                            : '';
                    const labelHtml = lap.label
                        ? `<span class="text-[11px] font-heading font-bold text-slate-500 dark:text-slate-400 truncate max-w-[95px]">${escapeHtml(lap.label)}</span>`
                        : '';
                    return `
                        <div class="flex justify-between items-center py-2 px-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-[#1e293b] dark:border-slate-600 shadow-[2px_2px_0px_0px_#1e293b] dark:shadow-[2px_2px_0px_0px_#000]">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="font-heading font-bold text-xs text-slate-400">#${num}</span>
                                ${labelHtml}
                            </div>
                            <span class="font-mono font-bold text-sm text-dark dark:text-white">${formatTimeFull(lap.total)}</span>
                            <span class="text-xs font-heading font-bold px-2 py-0.5 rounded-lg border ${badgeClass}">+${formatTimeFull(lap.split)}${tagHtml}</span>
                        </div>`;
                }).join('');
            }
        },
        copyLaps() {
            if (!state.stopwatch.laps.length) return;
            const lines = state.stopwatch.laps.map((lap, idx) => {
                const n = state.stopwatch.laps.length - idx;
                const lbl = lap.label ? ` (${lap.label})` : '';
                return `Lap #${n}${lbl}: ${formatTimeFull(lap.total)} (+${formatTimeFull(lap.split)})`;
            }).join('\n');
            navigator.clipboard?.writeText(lines)
                .then(() => showToast('Laps copied to clipboard!', 'success'))
                .catch(() => showToast('Could not access clipboard', 'warning'));
        },
        saveState() {
            localStorage.setItem(CONSTANTS.LS_STOPWATCH, JSON.stringify({
                elapsed: state.stopwatch.elapsed,
                startEpoch: state.stopwatch.running ? state.stopwatch.startEpoch : 0,
                running: state.stopwatch.running,
                laps: state.stopwatch.laps
            }));
        },
        restoreState() {
            try {
                const raw = localStorage.getItem(CONSTANTS.LS_STOPWATCH);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (!data) return;
                state.stopwatch.laps = Array.isArray(data.laps) ? data.laps : [];
                if (data.running && data.startEpoch > 0) {
                    state.stopwatch.elapsed = Math.max(0, Date.now() - data.startEpoch);
                    state.stopwatch.startTime = performance.now() - state.stopwatch.elapsed;
                    state.stopwatch.startEpoch = data.startEpoch;
                    state.stopwatch.running = true;
                    this.animate();
                } else {
                    state.stopwatch.elapsed = Math.max(0, Number(data.elapsed) || 0);
                    state.stopwatch.running = false;
                }
                this.updateDisplay();
                this.updateControlsUI();
                this.renderLaps();
            } catch (_) {}
        }
    };

    // ========================================================
    // 4. TIMER MODULE (Drift-Free, Zen / Rush / Traffic, Station Loop)
    // ========================================================
    const timer = {
        savePrefs() {
            localStorage.setItem(CONSTANTS.LS_TIMER_PREFS, JSON.stringify({
                mode: state.timer.mode,
                sound: state.timer.sound,
                tickEnabled: state.timer.tickEnabled,
                repeat: state.timer.repeat,
                task: state.timer.task,
                lastDuration: state.timer.lastDuration
            }));
            saveAllToCloud();
        },
        setMode(mode, skipSave = false) {
            if (!['calm', 'bomb', 'traffic'].includes(mode)) mode = 'calm';
            state.timer.mode = mode;

            const btnCalm = DOM.get('btn-mode-calm');
            const btnBomb = DOM.get('btn-mode-bomb');
            const btnTraffic = DOM.get('btn-mode-traffic');
            const zenPane = DOM.get('timer-visual-zen');
            const rushPane = DOM.get('timer-visual-rush');
            const trafficPane = DOM.get('timer-visual-traffic');
            const btnStart = DOM.get('timer-btn-start');

            const inactiveCls = 'btn-chunky px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-bold uppercase gap-1.5 bg-white dark:bg-slate-800 text-dark dark:text-white';
            if (btnCalm) btnCalm.className = mode === 'calm'
                ? 'btn-chunky px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-bold uppercase gap-1.5 bg-green text-white'
                : inactiveCls;
            if (btnBomb) btnBomb.className = mode === 'bomb'
                ? 'btn-chunky px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-bold uppercase gap-1.5 bg-orange text-white'
                : inactiveCls;
            if (btnTraffic) btnTraffic.className = mode === 'traffic'
                ? 'btn-chunky px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-bold uppercase gap-1.5 bg-blue text-white'
                : inactiveCls;

            if (zenPane) zenPane.classList.toggle('active', mode === 'calm');
            if (rushPane) rushPane.classList.toggle('active', mode === 'bomb');
            if (trafficPane) trafficPane.classList.toggle('active', mode === 'traffic');

            if (btnStart) {
                const accent = mode === 'bomb' ? 'bg-orange' : mode === 'traffic' ? 'bg-blue' : 'bg-green';
                btnStart.className = `btn-chunky w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-3xl ${accent} text-white mx-1`;
            }

            if (mode === 'bomb' && state.timer.sound === 'chime') {
                // Keep user choice unless unchanged default; bomb still works cleanly
            }

            this.updateDisplays();
            this.updateVisuals();
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => this.updateVisuals());
            }
            if (!skipSave) this.savePrefs();
        },
        editFromStage() {
            this.stop();
            this.setMode('calm');
            const minEl = DOM.get('t-min');
            if (minEl) {
                minEl.focus();
                minEl.select();
            }
        },
        syncTaskInputState() {
            const inp = DOM.get('timer-task-input');
            if (inp) {
                inp.classList.toggle('empty-in-focus', !String(state.timer.task || '').trim());
            }
        },
        setTask(name) {
            state.timer.task = String(name || '').slice(0, 32);
            const inp = DOM.get('timer-task-input');
            if (inp && inp.value !== state.timer.task) inp.value = state.timer.task;
            this.syncTaskInputState();
            this.updateVisuals();
            this.savePrefs();
        },
        setSound(sound) {
            state.timer.sound = ['chime', 'bell', 'fanfare', 'bomb'].includes(sound) ? sound : 'chime';
            const sel = DOM.get('timer-sound-select');
            if (sel) sel.value = state.timer.sound;
            this.savePrefs();
        },
        previewSound() {
            audio.ensureContext();
            if (state.audio.muted) {
                showToast('Unmute audio (M) to preview sound', 'warning');
                return;
            }
            audio.playSound(state.timer.sound);
        },
        toggleTick() {
            state.timer.tickEnabled = !state.timer.tickEnabled;
            this.updateTickUI();
            this.savePrefs();
        },
        updateTickUI() {
            const btn = DOM.get('timer-tick-btn');
            if (!btn) return;
            btn.textContent = state.timer.tickEnabled ? 'TICK: ON' : 'TICK: OFF';
            btn.classList.toggle('bg-blue', state.timer.tickEnabled);
            btn.classList.toggle('text-white', state.timer.tickEnabled);
            btn.classList.toggle('bg-white', !state.timer.tickEnabled);
            btn.classList.toggle('dark:bg-slate-800', !state.timer.tickEnabled);
            btn.classList.toggle('text-dark', !state.timer.tickEnabled);
            btn.classList.toggle('dark:text-white', !state.timer.tickEnabled);
        },
        toggleRepeat() {
            state.timer.repeat = !state.timer.repeat;
            if (!state.timer.repeat) state.timer.round = 1;
            this.updateRepeatUI();
            this.savePrefs();
        },
        updateRepeatUI() {
            const btn = DOM.get('timer-repeat-btn');
            const roundBadge = DOM.get('timer-round-badge');
            if (btn) {
                btn.classList.toggle('bg-orange', state.timer.repeat);
                btn.classList.toggle('text-white', state.timer.repeat);
                btn.classList.toggle('bg-white', !state.timer.repeat);
                btn.classList.toggle('dark:bg-slate-800', !state.timer.repeat);
                btn.classList.toggle('text-dark', !state.timer.repeat);
                btn.classList.toggle('dark:text-white', !state.timer.repeat);
                const icon = btn.querySelector('svg, i');
                if (icon) {
                    icon.classList.toggle('text-white', state.timer.repeat);
                    icon.classList.toggle('text-slate-400', !state.timer.repeat);
                }
            }
            if (roundBadge) {
                roundBadge.classList.toggle('is-hidden', !state.timer.repeat);
                roundBadge.textContent = `ROUND ${state.timer.round}`;
            }
        },
        setPreset(sec) {
            if (state.timer.running) this.stop();
            clearTimeout(state.timer.repeatTimeout);
            state.timer.remainingMs = sec * 1000;
            state.timer.initial = sec;
            state.timer.lastDuration = sec;
            state.timer.hasStarted = false;
            state.timer.round = 1;
            localStorage.removeItem(CONSTANTS.LS_TIMER);
            this.updateDisplays();
            this.updateVisuals();
            this.updateRepeatUI();
            this.savePrefs();
        },
        adjust(deltaSec) {
            const t = state.timer;
            if (t.running) {
                t.remainingMs = Math.max(1000, t.remainingMs + deltaSec * 1000);
                t.endTimestamp = Date.now() + t.remainingMs;
                const newSec = Math.ceil(t.remainingMs / 1000);
                t.initial = Math.max(t.initial, newSec);
                this.saveState();
            } else {
                const curSec = t.hasStarted
                    ? Math.ceil(t.remainingMs / 1000)
                    : this.readInputsSec();
                const nextSec = Math.max(0, Math.min(5999, curSec + deltaSec));
                t.remainingMs = nextSec * 1000;
                if (!t.hasStarted) {
                    t.initial = Math.max(1, nextSec);
                    t.lastDuration = nextSec;
                } else {
                    t.initial = Math.max(t.initial, nextSec);
                }
            }
            this.updateDisplays();
            this.updateVisuals();
        },
        readInputsSec() {
            const minEl = DOM.get('t-min');
            const secEl = DOM.get('t-sec');
            const m = Math.max(0, Math.min(99, parseInt(minEl ? minEl.value : '0', 10) || 0));
            const s = Math.max(0, Math.min(59, parseInt(secEl ? secEl.value : '0', 10) || 0));
            return m * 60 + s;
        },
        syncFromManualInput() {
            const sec = this.readInputsSec();
            state.timer.remainingMs = sec * 1000;
            state.timer.initial = Math.max(1, sec);
            state.timer.lastDuration = sec;
            state.timer.hasStarted = false;
            this.updateDisplays();
            this.updateVisuals();
        },
        updateDisplays() {
            const totalSec = Math.max(0, Math.ceil(state.timer.remainingMs / 1000));
            const mStr = padZero(Math.floor(totalSec / 60));
            const sStr = padZero(totalSec % 60);

            const minEl = DOM.get('t-min');
            const secEl = DOM.get('t-sec');
            const rushEl = DOM.get('t-rush-display');
            const trafficEl = DOM.get('t-traffic-display');

            if (minEl && document.activeElement !== minEl) minEl.value = mStr;
            if (secEl && document.activeElement !== secEl) secEl.value = sStr;
            if (rushEl) rushEl.textContent = `${mStr}:${sStr}`;
            if (trafficEl) trafficEl.textContent = `${mStr}:${sStr}`;

            if (state.timer.running) {
                document.title = `${mStr}:${sStr} — Timer | KlassKit`;
            }
            sidebar.updateBadges();
        },
        updateVisuals() {
            const t = state.timer;
            const totalMs = Math.max(1000, (t.initial || 1) * 1000);
            const pct = Math.max(0, Math.min(1, t.remainingMs / totalMs));

            // 1. Zen Ring
            const ringZen = DOM.get('timer-ring-zen');
            if (ringZen) {
                ringZen.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - pct);
                const strokeColor = pct <= 0.15 ? '#ff4785' : pct <= 0.35 ? '#ff7e33' : '#00d063';
                ringZen.setAttribute('stroke', strokeColor);
            }

            // 2. Rush Bomb Fuse (normalized pathLength=100) + Moving Spark
            const fuseRush = DOM.get('timer-fuse-rush');
            const sparkG = DOM.get('timer-spark');
            const bombSvg = DOM.get('timer-bomb-svg');
            if (fuseRush) {
                fuseRush.style.strokeDasharray = '100';
                fuseRush.style.strokeDashoffset = String((1 - pct) * 100);
                fuseRush.style.opacity = pct <= 0 ? '0' : '1';
                if (sparkG) {
                    if (pct <= 0) {
                        sparkG.style.opacity = '0';
                    } else {
                        sparkG.style.opacity = '1';
                        if (typeof fuseRush.getTotalLength === 'function' && typeof fuseRush.getPointAtLength === 'function') {
                            try {
                                const len = fuseRush.getTotalLength();
                                if (len > 0) {
                                    const pt = fuseRush.getPointAtLength(len * pct);
                                    sparkG.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
                                }
                            } catch (_) {}
                        }
                    }
                }
            }
            if (bombSvg) {
                const urgent = t.running && t.remainingMs > 0 && t.remainingMs <= 10000;
                bombSvg.classList.toggle('bomb-urgent', urgent);
            }

            // 3. Traffic Light Lamps & Progress Fill
            const gLamp = DOM.get('traffic-lamp-green');
            const yLamp = DOM.get('traffic-lamp-yellow');
            const pLamp = DOM.get('traffic-lamp-pink');
            const fill = DOM.get('timer-traffic-fill');
            const status = DOM.get('timer-traffic-status');

            let zone = 'green';
            if (pct <= 0.15) zone = 'pink';
            else if (pct <= 0.35) zone = 'yellow';

            if (gLamp && yLamp && pLamp) {
                gLamp.classList.toggle('lit', zone === 'green');
                gLamp.classList.toggle('dim', zone !== 'green');
                yLamp.classList.toggle('lit', zone === 'yellow');
                yLamp.classList.toggle('dim', zone !== 'yellow');
                pLamp.classList.toggle('lit', zone === 'pink');
                pLamp.classList.toggle('dim', zone !== 'pink');
            }
            if (fill) {
                fill.style.width = `${(pct * 100).toFixed(1)}%`;
                fill.className = `traffic-bar-fill h-full ${zone === 'pink' ? 'bg-pink' : zone === 'yellow' ? 'bg-yellow' : 'bg-green'}`;
            }
            if (status) {
                const labelText = zone === 'pink' ? 'FINAL SECONDS' : zone === 'yellow' ? 'WRAP UP SOON' : 'WORK TIME';
                status.textContent = t.task ? `${t.task.toUpperCase()} · ${labelText}` : labelText;
                status.className = `font-heading font-bold text-xs uppercase tracking-widest ${zone === 'pink' ? 'text-pink' : zone === 'yellow' ? 'text-orange' : 'text-green'}`;
            }
        },
        toggle() {
            audio.ensureContext();
            if (state.timer.running) this.stop();
            else this.start();
        },
        start() {
            const t = state.timer;
            clearTimeout(t.repeatTimeout);

            if (!t.hasStarted) {
                const inputSec = t.mode === 'calm' ? this.readInputsSec() : Math.ceil(t.remainingMs / 1000);
                if (inputSec <= 0) {
                    showToast('Set a duration greater than 00:00', 'warning');
                    return;
                }
                t.remainingMs = inputSec * 1000;
                t.initial = inputSec;
                t.lastDuration = inputSec;
                t.hasStarted = true;
            } else if (t.remainingMs <= 0) {
                return;
            }

            t.endTimestamp = Date.now() + t.remainingMs;
            t.lastWholeSec = Math.ceil(t.remainingMs / 1000);
            t.running = true;

            const btnStart = DOM.get('timer-btn-start');
            if (btnStart) {
                btnStart.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
                hydrateIcons(btnStart);
            }

            clearInterval(t.interval);
            t.interval = setInterval(() => this.tick(), 200);
            this.saveState();
            this.updateDisplays();
            this.updateVisuals();
        },
        tick() {
            const t = state.timer;
            if (!t.running) return;
            t.remainingMs = Math.max(0, t.endTimestamp - Date.now());
            const wholeSec = Math.ceil(t.remainingMs / 1000);

            if (wholeSec !== t.lastWholeSec) {
                t.lastWholeSec = wholeSec;
                this.updateDisplays();
                if (wholeSec > 0) audio.playTick();
                this.saveState();
            }
            this.updateVisuals();

            if (t.remainingMs <= 0) {
                this.finish();
            }
        },
        stop() {
            const t = state.timer;
            clearInterval(t.interval);
            clearTimeout(t.repeatTimeout);
            t.interval = null;
            if (t.running) {
                t.remainingMs = Math.max(0, t.endTimestamp - Date.now());
            }
            t.running = false;

            const btnStart = DOM.get('timer-btn-start');
            if (btnStart) {
                btnStart.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-0.5"></i>';
                hydrateIcons(btnStart);
            }
            const bombSvg = DOM.get('timer-bomb-svg');
            if (bombSvg) bombSvg.classList.remove('bomb-urgent');

            if (!state.stopwatch.running) document.title = 'Clock | KlassKit';
            this.saveState();
            sidebar.updateBadges();
        },
        reset() {
            this.stop();
            const t = state.timer;
            const resetSec = t.lastDuration > 0 ? t.lastDuration : 300;
            t.remainingMs = resetSec * 1000;
            t.initial = resetSec;
            t.hasStarted = false;
            t.round = 1;
            localStorage.removeItem(CONSTANTS.LS_TIMER);
            this.updateDisplays();
            this.updateVisuals();
            this.updateRepeatUI();
        },
        finish() {
            const t = state.timer;
            this.stop();
            localStorage.removeItem(CONSTANTS.LS_TIMER);

            const soundToPlay = t.mode === 'bomb' && t.sound === 'chime' ? 'bomb' : t.sound;
            audio.playSound(soundToPlay);

            if (t.repeat) {
                const finishedRound = t.round;
                t.round += 1;
                this.updateRepeatUI();
                showToast(`Round ${finishedRound} done! Starting Round ${t.round}`, 'success');
                t.repeatTimeout = setTimeout(() => {
                    t.hasStarted = false;
                    t.remainingMs = (t.lastDuration || 300) * 1000;
                    t.initial = t.lastDuration || 300;
                    this.start();
                }, 1200);
                return;
            }

            t.hasStarted = false;
            const overlay = DOM.get('timer-done-overlay');
            const iconWrap = DOM.get('timer-done-icon-wrap');
            const titleEl = DOM.get('timer-done-title');
            const subEl = DOM.get('timer-done-subtitle');

            const isBomb = t.mode === 'bomb';
            if (iconWrap) {
                iconWrap.className = `w-24 h-24 rounded-3xl border-4 border-white/40 ${isBomb ? 'bg-orange' : 'bg-green'} text-white mx-auto mb-4 flex items-center justify-center shadow-xl animate-bounce`;
                iconWrap.innerHTML = `<i data-lucide="${isBomb ? 'flame' : 'bell'}" class="w-12 h-12"></i>`;
                hydrateIcons(iconWrap);
            }
            if (titleEl) {
                titleEl.textContent = isBomb ? 'BOOM!' : 'DONE!';
                titleEl.className = `text-6xl sm:text-8xl font-heading font-bold ${isBomb ? 'text-orange' : 'text-green'} leading-none mb-2 uppercase`;
            }
            if (subEl) {
                subEl.textContent = t.task ? `${t.task} Complete` : 'Time Is Up';
            }
            if (overlay) {
                overlay.classList.add('open');
                overlay.setAttribute('aria-hidden', 'false');
            }
        },
        addExtraFromOverlay(sec) {
            this.dismissOverlayOnly();
            this.setPreset(sec);
            this.start();
        },
        dismissOverlayOnly() {
            const overlay = DOM.get('timer-done-overlay');
            if (overlay) {
                overlay.classList.remove('open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            audio.stopAllTones();
        },
        resetOverlay() {
            this.dismissOverlayOnly();
            this.reset();
        },
        saveState() {
            localStorage.setItem(CONSTANTS.LS_TIMER, JSON.stringify({
                endTimestamp: state.timer.endTimestamp,
                remainingMs: state.timer.remainingMs,
                initial: state.timer.initial,
                lastDuration: state.timer.lastDuration,
                mode: state.timer.mode,
                running: state.timer.running,
                hasStarted: state.timer.hasStarted,
                round: state.timer.round
            }));
        },
        restoreState() {
            try {
                const rawPrefs = localStorage.getItem(CONSTANTS.LS_TIMER_PREFS);
                if (rawPrefs) {
                    const p = JSON.parse(rawPrefs);
                    if (p.mode) state.timer.mode = p.mode;
                    if (p.sound) state.timer.sound = p.sound;
                    if (p.tickEnabled !== undefined) state.timer.tickEnabled = !!p.tickEnabled;
                    if (p.repeat !== undefined) state.timer.repeat = !!p.repeat;
                    if (typeof p.task === 'string') state.timer.task = p.task;
                    if (Number(p.lastDuration) > 0) {
                        state.timer.lastDuration = Number(p.lastDuration);
                        state.timer.initial = Number(p.lastDuration);
                        state.timer.remainingMs = Number(p.lastDuration) * 1000;
                    }
                }
            } catch (_) {}

            try {
                const rawRun = localStorage.getItem(CONSTANTS.LS_TIMER);
                if (rawRun) {
                    const data = JSON.parse(rawRun);
                    if (data && data.running) {
                        state.timer.initial = Math.max(1, Number(data.initial) || 300);
                        state.timer.lastDuration = Math.max(1, Number(data.lastDuration) || 300);
                        state.timer.mode = data.mode || state.timer.mode;
                        state.timer.round = Number(data.round) || 1;
                        const rem = Math.max(0, Number(data.endTimestamp) - Date.now());
                        if (rem <= 0) {
                            state.timer.remainingMs = 0;
                            state.timer.hasStarted = false;
                            this.finish();
                        } else {
                            state.timer.remainingMs = rem;
                            state.timer.hasStarted = true;
                            this.start();
                        }
                    } else if (data && data.hasStarted && Number(data.remainingMs) > 0) {
                        state.timer.remainingMs = Number(data.remainingMs);
                        state.timer.initial = Math.max(1, Number(data.initial) || 300);
                        state.timer.lastDuration = Math.max(1, Number(data.lastDuration) || 300);
                        state.timer.hasStarted = true;
                        state.timer.mode = data.mode || state.timer.mode;
                    }
                }
            } catch (_) {}

            const inpTask = DOM.get('timer-task-input');
            if (inpTask) inpTask.value = state.timer.task;
            this.syncTaskInputState();
            const selSound = DOM.get('timer-sound-select');
            if (selSound) selSound.value = state.timer.sound;

            this.setMode(state.timer.mode, true);
            this.updateTickUI();
            this.updateRepeatUI();
            this.updateDisplays();
            this.updateVisuals();
        }
    };

    // ========================================================
    // 5. ALARM MODULE (Multi-Alarm, Repeat, Snooze, XSS-Safe)
    // ========================================================
    const alarm = {
        toggleAmPm() {
            state.alarm.ampm = state.alarm.ampm === 'AM' ? 'PM' : 'AM';
            const btn = DOM.get('alarm-ampm-btn');
            if (btn) btn.textContent = state.alarm.ampm;
        },
        setRepeat(rep) {
            state.alarm.repeat = ['once', 'daily', 'weekdays'].includes(rep) ? rep : 'once';
            const group = DOM.get('alarm-repeat-group');
            if (!group) return;
            group.querySelectorAll('button[data-repeat]').forEach((btn) => {
                const active = btn.dataset.repeat === state.alarm.repeat;
                btn.classList.toggle('bg-pink', active);
                btn.classList.toggle('text-white', active);
                btn.classList.toggle('bg-white', !active);
                btn.classList.toggle('dark:bg-slate-800', !active);
                btn.classList.toggle('text-dark', !active);
                btn.classList.toggle('dark:text-white', !active);
            });
        },
        applyQuick(kind) {
            const target = new Date();
            if (kind === '5m') target.setMinutes(target.getMinutes() + 5);
            else if (kind === '10m') target.setMinutes(target.getMinutes() + 10);
            else if (kind === 'next00') {
                target.setHours(target.getHours() + 1, 0, 0, 0);
            } else if (kind === 'next30') {
                if (target.getMinutes() < 30) target.setMinutes(30, 0, 0);
                else target.setHours(target.getHours() + 1, 30, 0, 0);
            }

            const h24 = target.getHours();
            const m = target.getMinutes();
            state.alarm.ampm = h24 >= 12 ? 'PM' : 'AM';
            const h12 = h24 % 12 || 12;

            const hEl = DOM.get('alarm-hour');
            const mEl = DOM.get('alarm-min');
            const btn = DOM.get('alarm-ampm-btn');
            if (hEl) hEl.value = padZero(h12);
            if (mEl) mEl.value = padZero(m);
            if (btn) btn.textContent = state.alarm.ampm;
        },
        previewSound() {
            const sel = DOM.get('alarm-sound-select');
            audio.ensureContext();
            if (state.audio.muted) {
                showToast('Unmute audio (M) to preview sound', 'warning');
                return;
            }
            audio.playSound(sel ? sel.value : 'bell');
        },
        openAddForm(editId = null) {
            const drawer = DOM.get('alarm-add-form');
            const titleEl = DOM.get('alarm-form-title');
            const hEl = DOM.get('alarm-hour');
            const mEl = DOM.get('alarm-min');
            const ampmBtn = DOM.get('alarm-ampm-btn');
            const labelEl = DOM.get('alarm-label');
            const soundSel = DOM.get('alarm-sound-select');

            state.alarm.editingId = editId;
            if (editId !== null) {
                const existing = state.alarm.alarms.find(a => a.id === editId);
                if (existing) {
                    if (titleEl) titleEl.textContent = 'Edit Alarm';
                    if (hEl) hEl.value = padZero(existing.h);
                    if (mEl) mEl.value = padZero(existing.m);
                    state.alarm.ampm = existing.ampm;
                    if (ampmBtn) ampmBtn.textContent = existing.ampm;
                    if (labelEl) labelEl.value = existing.label || '';
                    this.setRepeat(existing.repeat || 'once');
                    if (soundSel) soundSel.value = existing.sound || 'bell';
                }
            } else {
                if (titleEl) titleEl.textContent = 'New Alarm';
                const nowPlus = new Date(Date.now() + 5 * 60000);
                const h24 = nowPlus.getHours();
                state.alarm.ampm = h24 >= 12 ? 'PM' : 'AM';
                if (hEl) hEl.value = padZero(h24 % 12 || 12);
                if (mEl) mEl.value = padZero(nowPlus.getMinutes());
                if (ampmBtn) ampmBtn.textContent = state.alarm.ampm;
                if (labelEl) labelEl.value = '';
                this.setRepeat('once');
                if (soundSel) soundSel.value = 'bell';
            }

            if (drawer) {
                drawer.classList.add('open');
                drawer.setAttribute('aria-hidden', 'false');
            }
        },
        closeAddForm() {
            const drawer = DOM.get('alarm-add-form');
            state.alarm.editingId = null;
            if (drawer) {
                drawer.classList.remove('open');
                drawer.setAttribute('aria-hidden', 'true');
            }
        },
        saveNew() {
            audio.ensureContext();
            const hEl = DOM.get('alarm-hour');
            const mEl = DOM.get('alarm-min');
            const labelEl = DOM.get('alarm-label');
            const soundSel = DOM.get('alarm-sound-select');

            let h = parseInt(hEl ? hEl.value : '12', 10);
            if (isNaN(h)) h = 12;
            h = Math.max(1, Math.min(12, h));

            let m = parseInt(mEl ? mEl.value : '0', 10);
            if (isNaN(m)) m = 0;
            m = Math.max(0, Math.min(59, m));

            const ampm = state.alarm.ampm;
            const adjustedH = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
            const label = (labelEl ? labelEl.value.trim() : '') || 'Classroom Alarm';
            const repeat = state.alarm.repeat || 'once';
            const sound = soundSel ? soundSel.value : 'bell';

            if (state.alarm.editingId !== null) {
                const existing = state.alarm.alarms.find(a => a.id === state.alarm.editingId);
                if (existing) {
                    existing.h = h;
                    existing.m = m;
                    existing.ampm = ampm;
                    existing.adjustedH = adjustedH;
                    existing.label = label;
                    existing.repeat = repeat;
                    existing.sound = sound;
                    existing.enabled = true;
                    existing.lastFiredKey = '';
                }
            } else {
                state.alarm.alarms.push({
                    id: Date.now(),
                    h,
                    m,
                    ampm,
                    adjustedH,
                    label,
                    repeat,
                    sound,
                    enabled: true,
                    lastFiredKey: ''
                });
            }

            this.saveState();
            saveAllToCloud();
            this.renderList();
            this.closeAddForm();
        },
        renderList() {
            const container = DOM.get('alarm-list-container');
            const emptyState = DOM.get('alarm-empty-state');
            const summaryEl = DOM.get('alarm-next-summary');
            const now = new Date();

            // Update next-alarm header summary
            let soonestDiff = Infinity;
            state.alarm.alarms.forEach((al) => {
                if (!al.enabled) return;
                const d = calcNextAlarmDiff(al, now);
                if (d < soonestDiff) soonestDiff = d;
            });
            if (summaryEl) {
                summaryEl.textContent = Number.isFinite(soonestDiff)
                    ? `Next in ${formatHumanDuration(soonestDiff)}`
                    : 'No active alarms';
            }

            sidebar.updateBadges();

            if (!container || !emptyState) return;
            if (state.alarm.alarms.length === 0) {
                emptyState.classList.add('active');
                container.innerHTML = '';
                hydrateIcons(emptyState);
                return;
            }

            emptyState.classList.remove('active');
            const sorted = [...state.alarm.alarms].sort((a, b) =>
                a.adjustedH !== b.adjustedH ? a.adjustedH - b.adjustedH : a.m - b.m
            );

            const repeatLabels = { once: 'Once', daily: 'Daily', weekdays: 'Mon-Fri' };

            container.innerHTML = sorted.map((al) => {
                const nextDiff = al.enabled ? calcNextAlarmDiff(al, now) : Infinity;
                const etaStr = Number.isFinite(nextDiff) ? `in ${formatHumanDuration(nextDiff)}` : 'Off';
                const repeatText = repeatLabels[al.repeat || 'once'] || 'Once';
                return `
                    <div class="p-3 rounded-2xl border-[3px] border-[#1e293b] dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 shadow-[3px_3px_0px_0px_#1e293b] dark:shadow-[3px_3px_0px_0px_#000] transition-opacity ${!al.enabled ? 'opacity-55' : ''}">
                        <div class="flex flex-col text-left min-w-0">
                            <div class="flex items-baseline gap-2 flex-wrap">
                                <span class="text-2xl sm:text-3xl font-mono font-bold text-dark dark:text-white leading-none">${padZero(al.h)}:${padZero(al.m)}</span>
                                <span class="text-sm sm:text-base font-heading font-bold text-pink">${escapeHtml(al.ampm)}</span>
                                <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] font-heading font-bold uppercase text-slate-600 dark:text-slate-300">${repeatText}</span>
                                <span class="text-[11px] font-heading font-bold text-blue uppercase">${etaStr}</span>
                            </div>
                            <div class="text-xs font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate mt-1">${escapeHtml(al.label)}</div>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <button type="button" onclick="alarm.openAddForm(${al.id})" title="Edit alarm"
                                class="btn-chunky p-2 rounded-xl bg-white dark:bg-slate-700 text-dark dark:text-white">
                                <i data-lucide="pencil" class="w-4 h-4 text-blue"></i>
                            </button>
                            <button type="button" onclick="alarm.toggleEnable(${al.id})" title="${al.enabled ? 'Disable alarm' : 'Enable alarm'}"
                                class="btn-chunky p-2 rounded-xl ${al.enabled ? 'bg-green text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">
                                <i data-lucide="power" class="w-4 h-4"></i>
                            </button>
                            <button type="button" onclick="alarm.delete(${al.id})" title="Delete alarm"
                                class="btn-chunky p-2 bg-pink text-white rounded-xl">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>`;
            }).join('');
            hydrateIcons(container);
        },
        toggleEnable(id) {
            const al = state.alarm.alarms.find(a => a.id === id);
            if (!al) return;
            al.enabled = !al.enabled;
            if (al.enabled) al.lastFiredKey = '';
            this.saveState();
            saveAllToCloud();
            this.renderList();
        },
        delete(id) {
            state.alarm.alarms = state.alarm.alarms.filter(a => a.id !== id);
            this.saveState();
            saveAllToCloud();
            this.renderList();
        },
        check() {
            if (state.alarm.currentlyRinging) return;
            const now = new Date();
            const currentH = now.getHours();
            const currentM = now.getMinutes();
            const dow = now.getDay();
            const firedKey = `${toDateKey(now)}-${padZero(currentH)}-${padZero(currentM)}`;

            for (const al of state.alarm.alarms) {
                if (!al.enabled) continue;
                if (al.adjustedH !== currentH || al.m !== currentM) continue;
                if (al.repeat === 'weekdays' && (dow === 0 || dow === 6)) continue;
                if (al.lastFiredKey === firedKey) continue;

                al.lastFiredKey = firedKey;
                this.saveState();
                this.trigger(al);
                break;
            }
        },
        trigger(al) {
            state.alarm.currentlyRinging = al;
            const overlay = DOM.get('alarm-overlay');
            const labelEl = DOM.get('alarm-overlay-label');
            const timeEl = DOM.get('alarm-overlay-time');

            if (labelEl) labelEl.textContent = al.label || 'Alarm!';
            if (timeEl) timeEl.textContent = `${padZero(al.h)}:${padZero(al.m)} ${al.ampm}`;
            if (overlay) {
                overlay.classList.add('open');
                overlay.setAttribute('aria-hidden', 'false');
            }

            audio.ensureContext();
            this.stopSound();
            audio.playAlarmCycle(al.sound || 'bell');
            state.alarm.soundInterval = setInterval(() => {
                if (state.alarm.currentlyRinging) audio.playAlarmCycle(al.sound || 'bell');
                else this.stopSound();
            }, 2200);
        },
        snooze() {
            const current = state.alarm.currentlyRinging;
            this.dismiss(true);
            if (!current) return;

            const snoozeTarget = new Date(Date.now() + 5 * 60000);
            const h24 = snoozeTarget.getHours();
            const m = snoozeTarget.getMinutes();
            const ampm = h24 >= 12 ? 'PM' : 'AM';
            const h = h24 % 12 || 12;

            state.alarm.alarms.push({
                id: Date.now(),
                h,
                m,
                ampm,
                adjustedH: h24,
                label: `${current.label || 'Alarm'} (Snooze)`,
                repeat: 'once',
                sound: current.sound || 'bell',
                enabled: true,
                lastFiredKey: ''
            });
            this.saveState();
            saveAllToCloud();
            this.renderList();
            showToast(`Snoozed for 5 minutes (${padZero(h)}:${padZero(m)} ${ampm})`, 'info');
        },
        stopSound() {
            if (state.alarm.soundInterval) {
                clearInterval(state.alarm.soundInterval);
                state.alarm.soundInterval = null;
            }
            audio.stopAllTones();
        },
        dismiss(fromSnooze = false) {
            this.stopSound();
            const overlay = DOM.get('alarm-overlay');
            if (overlay) {
                overlay.classList.remove('open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            if (state.alarm.currentlyRinging) {
                const al = state.alarm.alarms.find(a => a.id === state.alarm.currentlyRinging.id);
                if (al && (al.repeat === 'once' || !al.repeat || fromSnooze)) {
                    if (al.repeat === 'once' || !al.repeat) al.enabled = false;
                }
                state.alarm.currentlyRinging = null;
                this.saveState();
                this.renderList();
                saveAllToCloud();
            }
        },
        saveState() {
            localStorage.setItem(CONSTANTS.LS_ALARM, JSON.stringify(state.alarm.alarms));
        },
        restoreState() {
            try {
                const raw = localStorage.getItem(CONSTANTS.LS_ALARM);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) state.alarm.alarms = parsed;
                }
            } catch (_) {}
            this.renderList();
        }
    };

    // ========================================================
    // 6. COUNTDOWN MODULE (Target Clock Time w/ Auto-Tomorrow)
    // ========================================================
    const countdown = {
        toggleAmPm() {
            state.countdown.ampm = state.countdown.ampm === 'AM' ? 'PM' : 'AM';
            const btn = DOM.get('countdown-ampm-btn');
            if (btn) {
                btn.textContent = state.countdown.ampm;
                btn.classList.toggle('bg-blue', state.countdown.ampm === 'PM');
                btn.classList.toggle('bg-pink', state.countdown.ampm === 'AM');
            }
            this.updatePreview();
        },
        setLabel(text) {
            const inp = DOM.get('countdown-label');
            if (inp) inp.value = String(text || '').slice(0, 30);
        },
        applyQuick(kind) {
            const target = new Date();
            if (kind === '15m') target.setMinutes(target.getMinutes() + 15);
            else if (kind === '30m') target.setMinutes(target.getMinutes() + 30);
            else if (kind === '45m') target.setMinutes(target.getMinutes() + 45);
            else if (kind === '60m') target.setMinutes(target.getMinutes() + 60);
            else if (kind === 'next00') target.setHours(target.getHours() + 1, 0, 0, 0);
            else if (kind === 'next30') {
                if (target.getMinutes() < 30) target.setMinutes(30, 0, 0);
                else target.setHours(target.getHours() + 1, 30, 0, 0);
            }

            const h24 = target.getHours();
            const m = target.getMinutes();
            state.countdown.ampm = h24 >= 12 ? 'PM' : 'AM';
            const h12 = h24 % 12 || 12;

            const hEl = DOM.get('countdown-hour');
            const mEl = DOM.get('countdown-min');
            const btn = DOM.get('countdown-ampm-btn');
            if (hEl) hEl.value = padZero(h12);
            if (mEl) mEl.value = padZero(m);
            if (btn) {
                btn.textContent = state.countdown.ampm;
                btn.classList.toggle('bg-blue', state.countdown.ampm === 'PM');
                btn.classList.toggle('bg-pink', state.countdown.ampm === 'AM');
            }
            this.updatePreview();
        },
        updatePreview() {
            const badge = DOM.get('countdown-preview-badge');
            if (!badge) return;
            const hEl = DOM.get('countdown-hour');
            const mEl = DOM.get('countdown-min');
            const h12 = Math.max(1, Math.min(12, parseInt(hEl ? hEl.value : '12', 10) || 12));
            const min = Math.max(0, Math.min(59, parseInt(mEl ? mEl.value : '0', 10) || 0));
            const { isTomorrow, diffMs } = calcNextTargetDate(h12, min, state.countdown.ampm, new Date());
            badge.textContent = `${isTomorrow ? 'Tomorrow' : 'Today'} · ${formatHumanDuration(diffMs)} from now`;
        },
        start(restored = null) {
            const hEl = DOM.get('countdown-hour');
            const mEl = DOM.get('countdown-min');
            const lblEl = DOM.get('countdown-label');

            const h = restored ? restored.target.h : Math.max(1, Math.min(12, parseInt(hEl ? hEl.value : '12', 10) || 12));
            const m = restored ? restored.target.m : Math.max(0, Math.min(59, parseInt(mEl ? mEl.value : '0', 10) || 0));
            const ampm = restored ? restored.target.ampm : state.countdown.ampm;
            const label = restored ? restored.label : ((lblEl && lblEl.value.trim()) || 'COUNTDOWN');

            let targetTimestamp = restored ? Number(restored.targetTimestamp) : 0;
            let startedAt = restored ? Number(restored.startedAt) : Date.now();
            let isTomorrow = restored ? Boolean(restored.isTomorrow) : false;

            if (!targetTimestamp) {
                const res = calcNextTargetDate(h, m, ampm, new Date());
                targetTimestamp = res.targetDate.getTime();
                isTomorrow = res.isTomorrow;
                startedAt = Date.now();
            }

            state.countdown.target = { h, m, ampm };
            state.countdown.targetTimestamp = targetTimestamp;
            state.countdown.startedAt = startedAt;
            state.countdown.isTomorrow = isTomorrow;
            state.countdown.label = label;
            state.countdown.active = true;

            const setupView = DOM.get('countdown-setup');
            const runningView = DOM.get('countdown-running');
            const activeLabel = DOM.get('countdown-active-label');
            const tomorrowBadge = DOM.get('countdown-tomorrow-badge');
            const targetDisp = DOM.get('countdown-target-display');

            if (setupView) setupView.classList.remove('active');
            if (runningView) runningView.classList.add('active');
            if (activeLabel) activeLabel.textContent = label;
            if (tomorrowBadge) tomorrowBadge.classList.toggle('is-hidden', !isTomorrow);
            if (targetDisp) targetDisp.textContent = `${h}:${padZero(m)} ${ampm}`;

            audio.ensureContext();
            this.update();
            this.saveState();
            sidebar.updateBadges();
        },
        update() {
            if (!state.countdown.active || !state.countdown.targetTimestamp) return;
            const nowMs = Date.now();
            const diff = state.countdown.targetTimestamp - nowMs;

            const nowDisp = DOM.get('countdown-now-display');
            if (nowDisp) {
                const n = new Date(nowMs);
                const nh = n.getHours();
                nowDisp.textContent = `${nh % 12 || 12}:${padZero(n.getMinutes())} ${nh >= 12 ? 'PM' : 'AM'}`;
            }

            if (diff <= 0) {
                this.finish();
                return;
            }

            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            const timeDisp = DOM.get('countdown-time-display');
            if (timeDisp) {
                timeDisp.textContent = `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
                timeDisp.classList.add('text-blue');
                timeDisp.classList.remove('text-pink');
            }

            const totalSpan = Math.max(1000, state.countdown.targetTimestamp - state.countdown.startedAt);
            const pctElapsed = Math.max(0, Math.min(100, ((nowMs - state.countdown.startedAt) / totalSpan) * 100));
            const fillEl = DOM.get('countdown-progress-fill');
            const pctEl = DOM.get('countdown-progress-pct');
            if (fillEl) fillEl.style.width = `${pctElapsed.toFixed(1)}%`;
            if (pctEl) pctEl.textContent = `${Math.round(pctElapsed)}% elapsed`;
        },
        finish() {
            state.countdown.active = false;
            this.saveState();
            sidebar.updateBadges();

            const timeDisp = DOM.get('countdown-time-display');
            const fillEl = DOM.get('countdown-progress-fill');
            const pctEl = DOM.get('countdown-progress-pct');
            const overlay = DOM.get('countdown-overlay');
            const overlayLabel = DOM.get('countdown-overlay-label');

            if (timeDisp) {
                timeDisp.textContent = "TIME'S UP";
                timeDisp.classList.remove('text-blue');
                timeDisp.classList.add('text-pink');
            }
            if (fillEl) fillEl.style.width = '100%';
            if (pctEl) pctEl.textContent = '100% elapsed';
            if (overlayLabel) overlayLabel.textContent = state.countdown.label || 'TARGET REACHED';
            if (overlay) {
                overlay.classList.add('open');
                overlay.setAttribute('aria-hidden', 'false');
            }

            audio.ensureContext();
            audio.playSound('fanfare');
        },
        dismissOverlay() {
            const overlay = DOM.get('countdown-overlay');
            if (overlay) {
                overlay.classList.remove('open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            audio.stopAllTones();
        },
        reset() {
            state.countdown.active = false;
            state.countdown.target = null;
            state.countdown.targetTimestamp = 0;

            const setupView = DOM.get('countdown-setup');
            const runningView = DOM.get('countdown-running');
            const timeDisp = DOM.get('countdown-time-display');

            if (runningView) runningView.classList.remove('active');
            if (setupView) setupView.classList.add('active');
            if (timeDisp) {
                timeDisp.classList.remove('text-pink');
                timeDisp.classList.add('text-blue');
            }
            this.updatePreview();
            this.saveState();
            sidebar.updateBadges();
        },
        saveState() {
            localStorage.setItem(CONSTANTS.LS_COUNTDOWN, JSON.stringify({
                target: state.countdown.target,
                targetTimestamp: state.countdown.targetTimestamp,
                startedAt: state.countdown.startedAt,
                isTomorrow: state.countdown.isTomorrow,
                label: state.countdown.label,
                active: state.countdown.active
            }));
        },
        restoreState() {
            try {
                const raw = localStorage.getItem(CONSTANTS.LS_COUNTDOWN);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data && data.active && data.target) {
                        const hEl = DOM.get('countdown-hour');
                        const mEl = DOM.get('countdown-min');
                        const lblEl = DOM.get('countdown-label');
                        const btn = DOM.get('countdown-ampm-btn');
                        if (hEl) hEl.value = padZero(data.target.h);
                        if (mEl) mEl.value = padZero(data.target.m);
                        state.countdown.ampm = data.target.ampm || 'PM';
                        if (lblEl) lblEl.value = data.label || '';
                        if (btn) {
                            btn.textContent = state.countdown.ampm;
                            btn.classList.toggle('bg-blue', state.countdown.ampm === 'PM');
                            btn.classList.toggle('bg-pink', state.countdown.ampm === 'AM');
                        }
                        if (data.targetTimestamp && data.targetTimestamp > Date.now()) {
                            this.start(data);
                            return;
                        }
                    }
                }
            } catch (_) {}
            this.updatePreview();
        }
    };

    // ========================================================
    // 7. CALENDAR MODULE (Padded Dates, Tags, Notes, Mon/Sun)
    // ========================================================
    const calendar = {
        saveTimeout: null,
        loadLocal() {
            try {
                const raw = JSON.parse(localStorage.getItem(CONSTANTS.LS_CALENDAR) || '{}');
                state.calendar.marked = normalizeMarkedMap(raw);
            } catch (_) {
                state.calendar.marked = {};
            }
            const ws = localStorage.getItem(CONSTANTS.LS_CAL_WEEKSTART);
            if (ws === 'sun' || ws === 'mon') state.calendar.weekStart = ws;
        },
        save() {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                localStorage.setItem(CONSTANTS.LS_CALENDAR, JSON.stringify(state.calendar.marked));
                saveAllToCloud();
            }, 300);
        },
        toggleWeekStart() {
            state.calendar.weekStart = state.calendar.weekStart === 'mon' ? 'sun' : 'mon';
            localStorage.setItem(CONSTANTS.LS_CAL_WEEKSTART, state.calendar.weekStart);
            this.render();
            saveAllToCloud();
        },
        toggleViewMode() {
            state.calendar.viewMode = state.calendar.viewMode === 'month' ? 'year' : 'month';
            const mv = DOM.get('cal-month-view');
            const yv = DOM.get('cal-year-view');
            if (mv) mv.classList.toggle('active', state.calendar.viewMode === 'month');
            if (yv) yv.classList.toggle('active', state.calendar.viewMode === 'year');
            this.render();
        },
        navigate(delta) {
            if (state.calendar.viewMode === 'year') {
                state.calendar.date.setFullYear(state.calendar.date.getFullYear() + delta);
            } else {
                state.calendar.date.setMonth(state.calendar.date.getMonth() + delta);
            }
            this.render();
        },
        goToday() {
            state.calendar.date = new Date();
            state.calendar.selected = toDateKey(new Date());
            this.render();
        },
        setTagColor(color) {
            if (!VALID_CAL_COLORS.includes(color)) return;
            state.calendar.selectedColor = color;
            document.querySelectorAll('[data-cal-color]').forEach((btn) => {
                const active = btn.dataset.calColor === color;
                btn.classList.toggle('ring-2', active);
                btn.classList.toggle('ring-offset-1', active);
                btn.classList.toggle('ring-blue', active);
            });
        },
        saveNote() {
            const key = state.calendar.selected;
            if (!key) return;
            const inp = DOM.get('cal-note-input');
            const note = inp ? inp.value.trim().slice(0, 40) : '';
            state.calendar.marked[key] = {
                color: state.calendar.selectedColor || 'pink',
                note
            };
            this.save();
            this.render();
            showToast('Date marked', 'success');
        },
        clearDay() {
            const key = state.calendar.selected;
            if (!key) return;
            delete state.calendar.marked[key];
            const inp = DOM.get('cal-note-input');
            if (inp) inp.value = '';
            this.save();
            this.render();
        },
        render() {
            const wsBtn = DOM.get('cal-weekstart-btn');
            if (wsBtn) wsBtn.textContent = state.calendar.weekStart === 'sun' ? 'SUN' : 'MON';

            const cal = state.calendar;
            const year = cal.date.getFullYear();
            const month = cal.date.getMonth();
            const titleEl = DOM.get('cal-month-year');

            if (cal.viewMode === 'month') {
                if (titleEl) titleEl.textContent = `${CONSTANTS.MONTH_NAMES[month]} ${year}`;
                this.renderWeekdaysHeader();
                const grid = DOM.get('cal-grid');
                if (grid) {
                    const firstDow = new Date(year, month, 1).getDay();
                    const startOffset = cal.weekStart === 'sun' ? firstDow : (firstDow + 6) % 7;
                    const todayKey = toDateKey(new Date());
                    const cells = [];
                    for (let i = 0; i < 42; i++) {
                        cells.push(this.createCellHTML(new Date(year, month, 1 - startOffset + i), month, todayKey));
                    }
                    grid.innerHTML = cells.join('');
                }
            } else {
                if (titleEl) titleEl.textContent = String(year);
                this.renderYearView(year);
            }

            this.updateInspector();
            sidebar.updateBadges();
        },
        renderWeekdaysHeader() {
            const header = DOM.get('cal-weekdays');
            if (!header) return;
            const labels = state.calendar.weekStart === 'sun'
                ? CONSTANTS.DAYS_SHORT_SUN
                : CONSTANTS.DAYS_SHORT_MON;
            header.innerHTML = labels.map((lbl) => {
                const weekend = lbl === 'SAT' || lbl === 'SUN';
                return `<div class="${weekend ? 'text-pink' : ''}">${lbl}</div>`;
            }).join('');
        },
        createCellHTML(cellDate, currentMonth, todayKey) {
            const dateKey = toDateKey(cellDate);
            const isCurrMonth = cellDate.getMonth() === currentMonth;
            const isToday = dateKey === todayKey;
            const isSelected = state.calendar.selected === dateKey;
            const mark = state.calendar.marked[dateKey];

            let classes = 'cal-day rounded-xl sm:rounded-2xl flex flex-col items-center justify-center font-heading font-bold text-sm sm:text-lg relative cursor-pointer border-2 sm:border-[3px] ';
            if (isToday) {
                classes += 'bg-blue text-white border-[#1e293b] shadow-[3px_3px_0px_0px_#1e293b] dark:shadow-[3px_3px_0px_0px_#000] z-10 ';
            } else if (isCurrMonth) {
                classes += 'bg-white dark:bg-slate-800 text-dark dark:text-white border-[#1e293b] dark:border-slate-600 shadow-[3px_3px_0px_0px_#1e293b] dark:shadow-[3px_3px_0px_0px_#000] ';
            } else {
                classes += 'bg-slate-100/60 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600 border-transparent empty cursor-default ';
            }

            if (isSelected && !isToday) {
                classes += 'ring-4 ring-orange ';
            } else if (isSelected && isToday) {
                classes += 'ring-4 ring-orange/80 ';
            }

            const dotColorClass = mark
                ? ({ pink: 'bg-pink', orange: 'bg-orange', green: 'bg-green', blue: 'bg-blue' }[mark.color] || 'bg-pink')
                : '';
            const dotHTML = mark
                ? `<div class="absolute bottom-1 w-2 h-2 rounded-full border border-[#1e293b] ${dotColorClass}" title="${escapeHtml(mark.note || 'Marked')}"></div>`
                : '';

            return `<div class="${classes}" data-date="${dateKey}">${cellDate.getDate()}${dotHTML}</div>`;
        },
        renderYearView(year) {
            const yv = DOM.get('cal-year-view');
            if (!yv) return;
            const today = new Date();
            const todayKey = toDateKey(today);

            let html = '';
            for (let m = 0; m < 12; m++) {
                const isCurMonth = year === today.getFullYear() && m === today.getMonth();
                const firstDow = new Date(year, m, 1).getDay();
                const startOffset = state.calendar.weekStart === 'sun' ? firstDow : (firstDow + 6) % 7;
                const daysInMonth = new Date(year, m + 1, 0).getDate();

                let mini = '<div class="grid grid-cols-7 gap-0.5 mt-1">';
                for (let i = 0; i < startOffset; i++) mini += '<div class="aspect-square"></div>';
                for (let d = 1; d <= daysInMonth; d++) {
                    const dKey = toDateKey(new Date(year, m, d));
                    const isToday = dKey === todayKey;
                    const mark = state.calendar.marked[dKey];
                    const cls = isToday
                        ? 'bg-blue text-white rounded'
                        : mark
                            ? ({ pink: 'bg-pink text-white rounded', orange: 'bg-orange text-white rounded', green: 'bg-green text-white rounded', blue: 'bg-blue text-white rounded' }[mark.color] || 'bg-pink text-white rounded')
                            : 'text-slate-600 dark:text-slate-300';
                    mini += `<div class="aspect-square flex items-center justify-center font-heading font-bold text-[10px] ${cls}">${d}</div>`;
                }
                mini += '</div>';

                const cardStyle = isCurMonth
                    ? 'border-blue bg-blue/10 dark:bg-blue/20'
                    : 'border-[#1e293b] dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-orange';

                html += `
                    <div class="p-2.5 rounded-xl border-2 cursor-pointer transition-transform hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_#1e293b] dark:shadow-[2px_2px_0px_0px_#000] ${cardStyle}"
                         onclick="calendar.selectMonthFromYear(${m})">
                        <div class="text-xs font-heading font-bold text-center text-dark dark:text-white tracking-widest uppercase">${CONSTANTS.MONTH_NAMES[m]}</div>
                        ${mini}
                    </div>`;
            }
            yv.innerHTML = html;
        },
        selectMonthFromYear(mIdx) {
            state.calendar.date.setMonth(mIdx);
            this.toggleViewMode();
        },
        setupEventDelegation() {
            const grid = DOM.get('cal-grid');
            if (!grid) return;
            grid.addEventListener('click', (e) => {
                const cell = e.target.closest('.cal-day');
                if (!cell || cell.classList.contains('empty')) return;
                const key = cell.dataset.date;
                if (!key) return;

                if (e.altKey) {
                    if (state.calendar.marked[key]) delete state.calendar.marked[key];
                    else state.calendar.marked[key] = { color: state.calendar.selectedColor || 'pink', note: '' };
                    state.calendar.selected = key;
                    this.save();
                    this.render();
                } else {
                    state.calendar.selected = key;
                    this.render();
                }
            });
        },
        updateInspector() {
            const year = state.calendar.date.getFullYear();
            const month = state.calendar.date.getMonth();
            const prefix = `${year}-${padZero(month + 1)}-`;
            const monthMarkedCount = Object.keys(state.calendar.marked).filter(k => k.startsWith(prefix)).length;

            const markedEl = DOM.get('cal-marked-count');
            if (markedEl) markedEl.textContent = `${monthMarkedCount} marked this month`;

            const selDate = parseDateKey(state.calendar.selected || toDateKey(new Date())) || new Date();
            const selTitle = DOM.get('cal-selected-title');
            const relBadge = DOM.get('cal-relative-badge');
            const wdBadge = DOM.get('cal-weekdays-badge');
            const noteInput = DOM.get('cal-note-input');

            if (selTitle) {
                selTitle.textContent = selDate.toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                });
            }

            const now = new Date();
            const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const selMid = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate()).getTime();
            const diffDays = Math.round((selMid - todayMid) / 86400000);

            if (relBadge) {
                if (diffDays === 0) relBadge.textContent = 'TODAY';
                else if (diffDays > 0) relBadge.textContent = `${diffDays} DAY${diffDays > 1 ? 'S' : ''} FROM NOW`;
                else relBadge.textContent = `${Math.abs(diffDays)} DAY${Math.abs(diffDays) > 1 ? 'S' : ''} AGO`;
            }

            if (wdBadge) {
                if (diffDays !== 0) {
                    const schoolDays = countWeekdaysBetween(now, selDate);
                    wdBadge.textContent = `${schoolDays} school day${schoolDays === 1 ? '' : 's'}`;
                    wdBadge.classList.remove('is-hidden');
                } else {
                    wdBadge.classList.add('is-hidden');
                }
            }

            const mark = state.calendar.marked[toDateKey(selDate)];
            if (mark) {
                this.setTagColor(mark.color);
                if (noteInput && document.activeElement !== noteInput) noteInput.value = mark.note || '';
            } else {
                if (noteInput && document.activeElement !== noteInput) noteInput.value = '';
            }
        }
    };

    // ========================================================
    // UI MODE CONTROLLER (Simple vs Pro)
    // ========================================================
    const uiMode = {
        set(mode, skipSave = false) {
            const next = mode === 'pro' ? 'pro' : 'simple';
            state.uiMode = next;
            const isPro = next === 'pro';
            document.body.classList.toggle('pro-mode', isPro);

            const btnSimple = DOM.get('btn-uimode-simple');
            const btnPro = DOM.get('btn-uimode-pro');
            const btnMobile = DOM.get('btn-uimode-mobile');
            if (btnSimple) btnSimple.classList.toggle('active', !isPro);
            if (btnPro) btnPro.classList.toggle('active', isPro);
            if (btnMobile) {
                btnMobile.textContent = isPro ? 'PRO' : 'SIMPLE';
                btnMobile.classList.toggle('bg-blue', isPro);
                btnMobile.classList.toggle('text-white', isPro);
                btnMobile.classList.toggle('bg-white', !isPro);
                btnMobile.classList.toggle('dark:bg-slate-800', !isPro);
                btnMobile.classList.toggle('text-dark', !isPro);
                btnMobile.classList.toggle('dark:text-white', !isPro);
            }

            if (!isPro) {
                let changed = false;
                if (state.clock.teachMode) {
                    state.clock.teachMode = false;
                    changed = true;
                }
                if (state.clock.showWorld) {
                    state.clock.showWorld = false;
                    changed = true;
                }
                if (changed) clock.applyPreferencesUI();
            }

            if (!skipSave) {
                localStorage.setItem(CONSTANTS.LS_UI_MODE, next);
                saveAllToCloud();
            }
        },
        toggle() {
            this.set(state.uiMode === 'pro' ? 'simple' : 'pro');
        }
    };

    // ========================================================
    // CLOUD SYNC & INPUT VALIDATION
    // ========================================================
    let cloudSaveTimeout = null;
    function saveAllToCloud() {
        if (typeof saveProgress !== 'function') return;
        clearTimeout(cloudSaveTimeout);
        cloudSaveTimeout = setTimeout(() => {
            const payload = {
                darkMode: state.darkMode,
                uiMode: state.uiMode,
                sidebarCollapsed: state.sidebarCollapsed,
                alarms: state.alarm.alarms,
                calendarMarked: state.calendar.marked,
                calWeekStart: state.calendar.weekStart,
                clockSettings: {
                    is24Hour: state.clock.is24Hour,
                    isAnalog: state.clock.isAnalog,
                    showSeconds: state.clock.showSeconds,
                    wordsMode: state.clock.wordsMode,
                    showWorld: state.clock.showWorld,
                    showMinHelpers: state.clock.showMinHelpers
                },
                timerPrefs: {
                    mode: state.timer.mode,
                    sound: state.timer.sound,
                    tickEnabled: state.timer.tickEnabled,
                    repeat: state.timer.repeat,
                    task: state.timer.task,
                    lastDuration: state.timer.lastDuration
                },
                worldClocks: state.clock.worldCities
            };
            Promise.resolve(saveProgress(CONSTANTS.CLOUD_KEY, payload)).catch(() => {});
        }, 1000);
    }

    function setupInputBindings() {
        const validateRange = (el, min, max) => {
            if (!el) return;
            el.addEventListener('change', () => {
                let v = parseInt(el.value, 10);
                if (isNaN(v)) v = min;
                v = Math.max(min, Math.min(max, v));
                el.value = padZero(v);
            });
        };

        const tMin = DOM.get('t-min');
        const tSec = DOM.get('t-sec');
        validateRange(tMin, 0, 99);
        validateRange(tSec, 0, 59);
        [tMin, tSec].forEach((el) => {
            if (el) el.addEventListener('change', () => timer.syncFromManualInput());
        });

        validateRange(DOM.get('alarm-hour'), 1, 12);
        validateRange(DOM.get('alarm-min'), 0, 59);

        const cdHour = DOM.get('countdown-hour');
        const cdMin = DOM.get('countdown-min');
        validateRange(cdHour, 1, 12);
        validateRange(cdMin, 0, 59);
        [cdHour, cdMin].forEach((el) => {
            if (el) el.addEventListener('input', () => countdown.updatePreview());
        });

        const taskInp = DOM.get('timer-task-input');
        if (taskInp) {
            taskInp.addEventListener('input', (e) => {
                state.timer.task = String(e.target.value || '').slice(0, 32);
                timer.syncTaskInputState();
                timer.updateVisuals();
            });
            taskInp.addEventListener('change', () => timer.savePrefs());
        }

        const calNoteInp = DOM.get('cal-note-input');
        if (calNoteInp) {
            calNoteInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    calendar.saveNote();
                }
            });
        }
    }

    // ========================================================
    // MASTER 1-SECOND SCHEDULER & SHORTCUTS
    // ========================================================
    function startScheduler() {
        clearInterval(state.schedulerInterval);
        const tickAll = () => {
            clock.update();
            alarm.check();
            countdown.update();
            if (new Date().getSeconds() === 0) {
                clock.updateWorldClocks();
                if (state.currentTool === 'alarm') alarm.renderList();
            }
        };
        tickAll();
        state.schedulerInterval = setInterval(tickAll, 1000);
    }

    function openShortcutsModal() {
        const m = DOM.get('shortcuts-modal');
        if (m) {
            m.classList.add('open');
            m.setAttribute('aria-hidden', 'false');
        }
    }

    function closeShortcutsModal() {
        const m = DOM.get('shortcuts-modal');
        if (m) {
            m.classList.remove('open');
            m.setAttribute('aria-hidden', 'true');
        }
    }

    window.addEventListener('keydown', (e) => {
        const activeTag = (document.activeElement?.tagName || '').toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || document.activeElement?.isContentEditable) {
            if (e.key === 'Escape') document.activeElement.blur();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Check active modal overlays first
        const timerOverlay = DOM.get('timer-done-overlay');
        const alarmOverlay = DOM.get('alarm-overlay');
        const cdOverlay = DOM.get('countdown-overlay');
        const scModal = DOM.get('shortcuts-modal');
        const alarmDrawer = DOM.get('alarm-add-form');

        if (scModal?.classList.contains('open')) {
            if (e.key === 'Escape') closeShortcutsModal();
            return;
        }
        if (timerOverlay?.classList.contains('open')) {
            if (e.key === 'Escape') timer.resetOverlay();
            return;
        }
        if (alarmOverlay?.classList.contains('open')) {
            if (e.key === 'Escape') alarm.dismiss();
            return;
        }
        if (cdOverlay?.classList.contains('open')) {
            if (e.key === 'Escape') countdown.dismissOverlay();
            return;
        }
        if (alarmDrawer?.classList.contains('open')) {
            if (e.key === 'Escape') alarm.closeAddForm();
            return;
        }

        if (e.key === '?') {
            e.preventDefault();
            openShortcutsModal();
            return;
        }
        if (e.key === 'Escape' && state.focusStageActive) {
            focusStage.exit();
            return;
        }

        const k = e.key.toLowerCase();
        if (e.code === 'Space') {
            if (state.currentTool === 'stopwatch' || state.currentTool === 'timer') {
                e.preventDefault();
                if (state.currentTool === 'stopwatch') stopwatch.toggle();
                else timer.toggle();
            }
        } else if (k === 'r') {
            if (state.currentTool === 'stopwatch') stopwatch.reset();
            else if (state.currentTool === 'timer') timer.reset();
            else if (state.currentTool === 'countdown') countdown.reset();
        } else if (k === 'l') {
            if (state.currentTool === 'stopwatch') stopwatch.lap();
        } else if (k === 'z') {
            if (['clock', 'stopwatch', 'timer', 'countdown'].includes(state.currentTool)) {
                focusStage.toggle();
            }
        } else if (k === 'f') {
            if (state.currentTool === 'clock') clock.toggleFormat();
        } else if (k === 'v') {
            if (state.currentTool === 'clock') clock.toggleView();
        } else if (k === 'w') {
            if (state.currentTool === 'clock') clock.cycleWords();
        } else if (k === 'm') {
            audio.toggleMute();
        } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
            const tools = ['clock', 'stopwatch', 'timer', 'alarm', 'countdown', 'calendar'];
            switchTool(tools[Number(e.key) - 1]);
        }
    });

    // ========================================================
    // INITIALIZATION
    // ========================================================
    async function init() {
        if (typeof requireAuth === 'function') {
            const user = await requireAuth();
            if (!user) return;
        }

        sidebar.init();
        clock.initFace();

        // Load local persisted state first
        try {
            const cPrefs = JSON.parse(localStorage.getItem(CONSTANTS.LS_CLOCK_PREFS) || 'null');
            if (cPrefs) {
                state.clock.is24Hour = !!cPrefs.is24Hour;
                state.clock.isAnalog = !!cPrefs.isAnalog;
                if (cPrefs.showSeconds !== undefined) state.clock.showSeconds = !!cPrefs.showSeconds;
                if (cPrefs.wordsMode) state.clock.wordsMode = cPrefs.wordsMode;
                state.clock.showWorld = !!cPrefs.showWorld;
                state.clock.showMinHelpers = !!cPrefs.showMinHelpers;
            }
            const wc = JSON.parse(localStorage.getItem(CONSTANTS.LS_WORLD_CLOCKS) || 'null');
            if (Array.isArray(wc) && wc.length > 0) state.clock.worldCities = wc;
        } catch (_) {}

        calendar.loadLocal();
        alarm.restoreState();

        const savedUiMode = localStorage.getItem(CONSTANTS.LS_UI_MODE);
        if (savedUiMode === 'pro' || savedUiMode === 'simple') {
            state.uiMode = savedUiMode;
        }

        // Merge Cloud Progress BEFORE restoring UI so cloud never gets overwritten by local boot
        try {
            if (typeof loadProgress === 'function') {
                const cloud = await loadProgress(CONSTANTS.CLOUD_KEY);
                if (cloud && typeof cloud === 'object') {
                    if (cloud.uiMode === 'pro' || cloud.uiMode === 'simple') {
                        state.uiMode = cloud.uiMode;
                    }
                    if (cloud.sidebarCollapsed !== undefined) {
                        state.sidebarCollapsed = !!cloud.sidebarCollapsed;
                        const el = DOM.get('app-sidebar');
                        if (el) el.classList.toggle('collapsed', state.sidebarCollapsed);
                    }
                    if (Array.isArray(cloud.alarms) && cloud.alarms.length > 0 && state.alarm.alarms.length === 0) {
                        state.alarm.alarms = cloud.alarms;
                    } else if (Array.isArray(cloud.alarms) && cloud.alarms.length > 0) {
                        state.alarm.alarms = cloud.alarms;
                    }
                    if (cloud.calendarMarked && Object.keys(cloud.calendarMarked).length > 0) {
                        state.calendar.marked = normalizeMarkedMap(cloud.calendarMarked);
                    }
                    if (cloud.calWeekStart === 'sun' || cloud.calWeekStart === 'mon') {
                        state.calendar.weekStart = cloud.calWeekStart;
                    }
                    if (cloud.clockSettings) {
                        const cs = cloud.clockSettings;
                        if (cs.is24Hour !== undefined) state.clock.is24Hour = !!cs.is24Hour;
                        if (cs.isAnalog !== undefined) state.clock.isAnalog = !!cs.isAnalog;
                        if (cs.showSeconds !== undefined) state.clock.showSeconds = !!cs.showSeconds;
                        if (cs.wordsMode) state.clock.wordsMode = cs.wordsMode;
                        if (cs.showWorld !== undefined) state.clock.showWorld = !!cs.showWorld;
                        if (cs.showMinHelpers !== undefined) state.clock.showMinHelpers = !!cs.showMinHelpers;
                    }
                    if (Array.isArray(cloud.worldClocks) && cloud.worldClocks.length > 0) {
                        state.clock.worldCities = cloud.worldClocks;
                    }
                    if (cloud.timerPrefs) {
                        localStorage.setItem(CONSTANTS.LS_TIMER_PREFS, JSON.stringify(cloud.timerPrefs));
                    }
                }
            }
        } catch (_) {}

        setupInputBindings();
        calendar.setupEventDelegation();
        calendar.render();

        alarm.renderList();
        stopwatch.restoreState();
        timer.restoreState();
        countdown.restoreState();

        clock.applyPreferencesUI();
        uiMode.set(state.uiMode, true);
        locationWeather.init();
        audio.updateMuteUI();
        switchTool('clock');
        hydrateIcons(document);
        startScheduler();
    }

    document.addEventListener('DOMContentLoaded', init);

    // ========================================================
    // GLOBAL BINDINGS (HTML inline handlers + Debug hooks)
    // ========================================================
    window.toggleDarkMode = () => darkMode.toggle();
    window.toggleSidebar = () => sidebar.toggle();
    window.switchTool = switchTool;
    window.setUiMode = (m) => uiMode.set(m);
    window.toggleUiMode = () => uiMode.toggle();
    window.toggleAudioMute = () => audio.toggleMute();
    window.openShortcutsModal = openShortcutsModal;
    window.closeShortcutsModal = closeShortcutsModal;
    window.toggleFocusStage = (t) => focusStage.toggle(t);

    // Clock
    window.clockToggleFormat = () => clock.toggleFormat();
    window.clockToggleView = () => clock.toggleView();
    window.clockCycleWords = () => clock.cycleWords();
    window.clockToggleSeconds = () => clock.toggleSeconds();
    window.clockToggleWorldPanel = () => clock.toggleWorldPanel();
    window.clockAddWorldCity = (c) => clock.addWorldCity(c);
    window.clockRemoveWorldCity = (c) => clock.removeWorldCity(c);
    window.clockToggleZen = () => focusStage.toggle('clock');
    window.clockToggleTeachMode = (v) => clock.toggleTeachMode(v);
    window.clockToggleMinuteHelpers = () => clock.toggleMinuteHelpers();
    window.clockStepTeach = (m) => clock.stepTeach(m);
    window.clockRandomTeach = () => clock.randomTeach();
    window.clockToggleRevealAnswer = () => clock.toggleRevealAnswer();
    window.clockRefreshWeather = () => locationWeather.requestWeather(true);

    // Stopwatch
    window.swToggle = () => stopwatch.toggle();
    window.swReset = () => stopwatch.reset();
    window.swLap = () => stopwatch.lap();
    window.swCopyLaps = () => stopwatch.copyLaps();
    window.swClearLaps = () => stopwatch.clearLaps();

    // Timer
    window.timerSetMode = (m) => timer.setMode(m);
    window.timerToggleRepeat = () => timer.toggleRepeat();
    window.timerSetTask = (t) => timer.setTask(t);
    window.timerEditFromStage = () => timer.editFromStage();
    window.timerSetPreset = (s) => timer.setPreset(s);
    window.timerSetSound = (s) => timer.setSound(s);
    window.timerPreviewSound = () => timer.previewSound();
    window.timerToggleTick = () => timer.toggleTick();
    window.timerAdjust = (s) => timer.adjust(s);
    window.timerToggle = () => timer.toggle();
    window.timerStop = () => timer.stop();
    window.timerReset = () => timer.reset();
    window.timerAddExtraFromOverlay = (s) => timer.addExtraFromOverlay(s);
    window.resetTimerOverlay = () => timer.resetOverlay();

    // Alarm
    window.alarmOpenAddForm = (id) => alarm.openAddForm(id);
    window.alarmApplyQuick = (k) => alarm.applyQuick(k);
    window.alarmToggleAmPm = () => alarm.toggleAmPm();
    window.alarmSetRepeat = (r) => alarm.setRepeat(r);
    window.alarmPreviewSound = () => alarm.previewSound();
    window.alarmCloseAddForm = () => alarm.closeAddForm();
    window.alarmSaveNew = () => alarm.saveNew();
    window.alarmSnooze = () => alarm.snooze();
    window.alarmDismiss = () => alarm.dismiss();
    window.alarm = alarm;

    // Countdown
    window.countdownApplyQuick = (k) => countdown.applyQuick(k);
    window.countdownSetLabel = (t) => countdown.setLabel(t);
    window.countdown = countdown;

    // Calendar
    window.calNav = (d) => calendar.navigate(d);
    window.calGoToday = () => calendar.goToday();
    window.calToggleViewMode = () => calendar.toggleViewMode();
    window.calToggleWeekStart = () => calendar.toggleWeekStart();
    window.calSetTagColor = (c) => calendar.setTagColor(c);
    window.calSaveNote = () => calendar.saveNote();
    window.calClearDay = () => calendar.clearDay();
    window.calendar = calendar;

    window.clockApp = { clock, stopwatch, timer, alarm, countdown, calendar, audio, focusStage };

    // Pure helpers exported for Node unit tests
    window.__clockDebug = {
        escapeHtml,
        padZero,
        formatStopwatch,
        formatTimeFull,
        formatTimeInWords,
        parseDateKey,
        toDateKey,
        normalizeMarkedMap,
        calcNextTargetDate,
        calcNextAlarmDiff,
        countWeekdaysBetween,
        setUiMode: (m) => uiMode.set(m),
        getUiMode: () => state.uiMode
    };
})();

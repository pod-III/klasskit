// --- PERFORMANCE-OPTIMIZED TIME TOOLS ---

// DOM Cache - Store frequently accessed elements safely
const DOM = {
    cache: new Map(),
    get(id) {
        if (!this.cache.has(id)) {
            const el = document.getElementById(id);
            if (el) this.cache.set(id, el);
            else return null; // Safe fallback
        }
        return this.cache.get(id);
    },
    clearCache() {
        this.cache.clear();
    }
};

// --- CONSTANTS ---
const CONSTANTS = {
    DAYS: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    MONTHS: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    MONTH_NAMES: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
    CLOCK_MARKERS: 60,
    CIRCLE_CIRCUMFERENCE: 283,
    STOPWATCH_DISPLAY_FPS: 30,
    TIMER_UPDATE_INTERVAL: 1000,
    CALENDAR_GRID_SIZE: 42,
    LS_DARK_MODE: 'timetools_dark_mode',
    LS_SIDEBAR: 'timetools_sidebar_collapsed',
    LS_STOPWATCH: 'timetools_stopwatch',
    LS_TIMER: 'timetools_timer',
    LS_ALARM: 'timetools_alarm',
    CLOUD_KEY: 'clock_data'
};

// --- GLOBAL STATE ---
const state = {
    currentTool: 'clock',
    clock: { is24Hour: false, isAnalog: false, isZenMode: false, animFrame: null, lastSecond: -1 },
    stopwatch: { startTime: 0, elapsed: 0, running: false, animFrame: null, laps: [] },
    timer: { timeLeft: 300, initial: 300, lastDuration: 300, running: false, interval: null, mode: 'calm' },
    countdown: { active: false, target: null, interval: null, label: '', ampm: 'PM' },
    calendar: { date: new Date(), marked: {}, selected: null, viewMode: 'month' },
    alarm: { alarms: [], isAmPm: true, ampm: 'AM', soundInterval: null, currentlyRinging: null, lastTriggerMinute: -1 },
    audio: { ctx: null, oscillatorPool: [] },
    darkMode: false,
    sidebarCollapsed: false,
    weather: { loaded: false, temp: null, icon: null, city: null }
};

// --- LOCATION & WEATHER MODULE ---
const locationWeather = {
    elements: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                locMarker: DOM.get('clock-location-marker')
            };
        }
        return this.elements;
    },
    init() {
        this.renderLoading();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => this.fetchData(pos.coords.latitude, pos.coords.longitude),
                (err) => this.handleError(err)
            );
        } else {
            this.handleError(new Error("Geolocation not supported"));
        }
    },
    async fetchData(lat, lon) {
        try {
            // Fetch Weather
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const weatherData = await weatherRes.json();
            const temp = Math.round(weatherData.current_weather.temperature);
            const wCode = weatherData.current_weather.weathercode;
            const icon = this.mapWeatherCode(wCode, weatherData.current_weather.is_day);

            // Fetch City
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const geoData = await geoRes.json();
            const city = geoData.city || geoData.locality || "Unknown Location";

            this.updateDOM(city, temp, icon);
        } catch (error) {
            console.error("Error fetching location/weather data:", error);
            this.fallbackToTimezone();
        }
    },
    handleError(err) {
        console.warn("Geolocation warning:", err.message);
        this.fallbackToTimezone();
    },
    fallbackToTimezone() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const city = tz.split('/').pop().replace(/_/g, ' ');
            this.updateDOM(city, null, 'map-pin');
        } catch (e) {
            this.updateDOM("Local Time", null, 'map-pin');
        }
    },
    updateDOM(city, temp, iconName) {
        const els = this.cacheElements();
        if (!els.locMarker) return;

        state.weather.city = city;
        state.weather.temp = temp;
        state.weather.icon = iconName;
        state.weather.loaded = true;

        let content = '';
        if (temp !== null) {
            content = `
                <i data-lucide="${iconName}" class="w-4 h-4 text-orange"></i>
                <span class="text-sm font-bold">${city} • ${temp}°C</span>
            `;
        } else {
            content = `
                <i data-lucide="${iconName}" class="w-4 h-4 text-orange"></i>
                <span class="text-sm font-bold">${city}</span>
            `;
        }

        els.locMarker.innerHTML = `
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-[1px] glass-panel transition-all hover:-translate-y-1 hover:shadow-neo"
                style="background: var(--slate-50); border-color: var(--border-light); color: var(--text-secondary);">
                ${content}
            </div>
        `;
        utils.safeIconUpdate();
    },
    renderLoading() {
        const els = this.cacheElements();
        if (!els.locMarker) return;
        els.locMarker.innerHTML = `
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-[1px] glass-panel"
                style="background: var(--slate-50); border-color: var(--border-light); color: var(--text-secondary);">
                <i data-lucide="loader" class="w-4 h-4 text-slate-400 animate-spin"></i>
                <span class="text-sm font-bold text-slate-400">Locating...</span>
            </div>
        `;
        utils.safeIconUpdate();
    },
    mapWeatherCode(code, isDay) {
        // WMO Weather interpretation codes (WW)
        // https://open-meteo.com/en/docs
        if (code === 0) return isDay ? 'sun' : 'moon';
        if (code === 1 || code === 2) return isDay ? 'cloud-sun' : 'cloud-moon';
        if (code === 3) return 'cloud';
        if (code >= 45 && code <= 48) return 'cloud-fog';
        if (code >= 51 && code <= 67) return 'cloud-rain';
        if (code >= 71 && code <= 77) return 'cloud-snow';
        if (code >= 80 && code <= 82) return 'cloud-rain';
        if (code >= 85 && code <= 86) return 'cloud-snow';
        if (code >= 95) return 'cloud-lightning';
        return isDay ? 'sun' : 'moon'; // fallback
    }
};

// --- UTILITY FUNCTIONS ---
const utils = {
    padZero: (num, length = 2) => String(num).padStart(length, '0'),
    formatTime: (ms) => {
        const m = utils.padZero(Math.floor(ms / 60000));
        const s = utils.padZero(Math.floor(ms / 1000) % 60);
        const ms2 = utils.padZero(Math.floor((ms % 1000) / 10));
        return `${m}:${s}.${ms2}`;
    },
    getDateString: (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    getTodayString: () => utils.getDateString(new Date()),
    parseTimeInputs: (minId, secId) => {
        const minEl = DOM.get(minId);
        const secEl = DOM.get(secId);
        const m = minEl ? (parseInt(minEl.value) || 0) : 0;
        const s = secEl ? (parseInt(secEl.value) || 0) : 0;
        return (m * 60) + s;
    },
    setTimeInputs: (minId, secId, totalSeconds) => {
        const m = utils.padZero(Math.floor(totalSeconds / 60));
        const s = utils.padZero(totalSeconds % 60);
        const minEl = DOM.get(minId);
        const secEl = DOM.get(secId);
        if (minEl) minEl.value = m;
        if (secEl) secEl.value = s;
        return { m, s };
    },
    safeIconUpdate() {
        if (window.lucide) lucide.createIcons();
    }
};

// --- AUDIO ENGINE ---
const audio = {
    init() {
        if (!state.audio.ctx) {
            state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone(freq, type, duration, volume = 0.05) {
        if (!state.audio.ctx) return;
        const osc = state.audio.ctx.createOscillator();
        const gain = state.audio.ctx.createGain();
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(volume, state.audio.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, state.audio.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(state.audio.ctx.destination);
        osc.start();
        osc.stop(state.audio.ctx.currentTime + duration);
    },
    playTick() {
        const isBomb = state.timer.mode === 'bomb';
        audio.playTone(isBomb ? 800 : 400, isBomb ? 'square' : 'sine', 0.05);
    },
    playChime() {
        audio.playTone(523.25, 'sine', 1.5, 0.2);
    },
    playAlarmSound() {
        if (!state.alarm.currentlyRinging) return;
        const baseFreq = 880;
        const tones = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.25];
        tones.forEach((freq, i) => {
            const timeoutId = setTimeout(() => {
                if (state.alarm.currentlyRinging) {
                    audio.playTone(freq, 'sine', 0.3, 0.15);
                }
            }, i * 200);
            if (!this.alarmTimeouts) this.alarmTimeouts = [];
            this.alarmTimeouts.push(timeoutId);
        });
    },
    stopAllTones() {
        if (this.alarmTimeouts) {
            this.alarmTimeouts.forEach(clearTimeout);
            this.alarmTimeouts = [];
        }
    }
};

// --- DARK MODE ---
const darkMode = {
    init() {
        const saved = localStorage.getItem('theme_clock');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            state.darkMode = true;
            document.documentElement.classList.add('dark');
        } else {
            state.darkMode = false;
        }
    },
    toggle() {
        state.darkMode = !state.darkMode;
        document.documentElement.classList.toggle('dark', state.darkMode);
        localStorage.setItem('theme_clock', state.darkMode ? 'dark' : 'light');
        saveAllToCloud();
    }
};

// --- SIDEBAR ---
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
        state.sidebarCollapsed = !state.sidebarCollapsed;
        const el = DOM.get('app-sidebar');
        const overlay = DOM.get('sidebar-overlay');
        
        if (window.innerWidth < 768) {
            // Mobile Drawer Logic
            if (el) {
                el.classList.toggle('mobile-open');
                const isOpen = el.classList.contains('mobile-open');
                if (overlay) {
                    overlay.classList.toggle('hidden', !isOpen);
                    setTimeout(() => overlay.classList.toggle('opacity-0', !isOpen), 10);
                }
            }
        } else {
            // Desktop Collapse Logic
            if (el) el.classList.toggle('collapsed', state.sidebarCollapsed);
            localStorage.setItem(CONSTANTS.LS_SIDEBAR, state.sidebarCollapsed);
            saveAllToCloud();
        }
    }
};

// --- CLOCK MODULE ---
const clock = {
    elements: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                time: DOM.get('clock-time'),
                secDig: DOM.get('clock-sec-dig'),
                ampm: DOM.get('clock-ampm'),
                date: DOM.get('clock-date'),
                dateAnalog: DOM.get('clock-date-analog'),
                handSec: DOM.get('hand-sec'),
                handMin: DOM.get('hand-min'),
                handHour: DOM.get('hand-hour'),
                btnFormat: DOM.get('clock-btn-format'),
                btnView: DOM.get('clock-btn-view'),
                btnZen: DOM.get('clock-btn-zen'),
                digital: DOM.get('clock-digital'),
                analog: DOM.get('clock-analog'),
                mainArea: DOM.get('main-content-area'),
                sidebar: DOM.get('app-sidebar'),
                controlsTop: DOM.get('clock-controls-top'),
                locMarker: DOM.get('clock-location-marker')
            };
        }
        return this.elements;
    },
    initFace() {
        const markers = DOM.get('clock-face-markers');
        if (!markers) return;
        const fragment = document.createDocumentFragment();
        const svgNS = "http://www.w3.org/2000/svg";

        for (let i = 0; i < CONSTANTS.CLOCK_MARKERS; i++) {
            const isHour = i % 5 === 0;
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", "50");
            line.setAttribute("y1", "4");
            line.setAttribute("x2", "50");
            line.setAttribute("y2", isHour ? "11" : "6");
            line.setAttribute("stroke", "currentColor");
            line.setAttribute("stroke-width", isHour ? "2" : "1");
            line.setAttribute("transform", `rotate(${i * 6} 50 50)`);
            fragment.appendChild(line);
        }
        markers.appendChild(fragment);
    },
    startLoop() {
        const animate = () => {
            if (state.currentTool === 'clock') {
                clock.update();
            }
            alarm.check();
            state.clock.animFrame = requestAnimationFrame(animate);
        };
        animate();
    },
    update() {
        const now = new Date();
        const els = this.cacheElements();
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();

        // CPU Optimization: Only update digital DOM text if the second changed
        if (s !== state.clock.lastSecond) {
            state.clock.lastSecond = s;

            const displayHour = state.clock.is24Hour ? utils.padZero(h) : (h % 12 || 12);
            const displayMin = utils.padZero(m);
            const displaySec = utils.padZero(s);
            const newTime = `${displayHour}:${displayMin}`;

            if (els.time && els.time.innerText !== newTime) els.time.innerText = newTime;
            if (els.secDig && els.secDig.innerText !== displaySec) els.secDig.innerText = displaySec;

            const ampm = h >= 12 ? 'PM' : 'AM';
            if (els.ampm) {
                if (els.ampm.innerText !== ampm) els.ampm.innerText = ampm;
                els.ampm.style.display = state.clock.is24Hour ? 'none' : 'block';
            }

            const dateStr = `${CONSTANTS.DAYS[now.getDay()]}, ${CONSTANTS.MONTHS[now.getMonth()]} ${now.getDate()}`;
            if (els.date && els.date.innerText !== dateStr) {
                els.date.innerText = dateStr;
                if (els.dateAnalog) els.dateAnalog.innerText = dateStr;
            }
        }

        // CPU Optimization: Only calculate & apply transforms if Analog view is active
        if (state.clock.isAnalog && els.handSec && els.handMin && els.handHour) {
            const secRatio = s / 60;
            const minRatio = (m + secRatio) / 60;
            const hourRatio = ((h % 12) + minRatio) / 12;

            els.handMin.setAttribute('transform', `rotate(${minRatio * 360} 50 50)`);
            els.handHour.setAttribute('transform', `rotate(${hourRatio * 360} 50 50)`);
        }
    },
    toggleFormat() {
        state.clock.is24Hour = !state.clock.is24Hour;
        const els = this.cacheElements();
        if (els.btnFormat) els.btnFormat.innerText = state.clock.is24Hour ? '24H' : '12H';
        clock.update();
        saveAllToCloud();
    },
    toggleView() {
        state.clock.isAnalog = !state.clock.isAnalog;
        const els = this.cacheElements();

        if (!els.digital || !els.analog || !els.btnView) return;

        if (state.clock.isAnalog) {
            els.digital.classList.add('hidden');
            els.analog.classList.remove('hidden');
            els.analog.classList.add('flex');
            els.btnView.innerText = "DIGITAL";
        } else {
            els.analog.classList.add('hidden');
            els.analog.classList.remove('flex');
            els.digital.classList.remove('hidden');
            els.btnView.innerText = "ANALOG";
        }
        // Force an immediate text update since we might have skipped it while hidden
        state.clock.lastSecond = -1;
        clock.update();
        saveAllToCloud();
    },
    toggleZenMode() {
        state.clock.isZenMode = !state.clock.isZenMode;
        const els = this.cacheElements();

        if (state.clock.isZenMode) {
            if (els.mainArea) {
                if (els.mainArea.requestFullscreen) {
                    els.mainArea.requestFullscreen().catch(err => {
                        console.warn(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
                    });
                }
                els.mainArea.classList.add('zen-mode');
            }
            if (els.sidebar) els.sidebar.classList.add('hidden');
            if (els.controlsTop) els.controlsTop.classList.add('opacity-0', 'pointer-events-none');
            if (els.locMarker) els.locMarker.classList.add('opacity-0');
            if (els.btnZen) els.btnZen.innerHTML = '<i data-lucide="minimize" class="w-4 h-4"></i>';
        } else {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.warn(err));
            }
            if (els.mainArea) els.mainArea.classList.remove('zen-mode');
            if (els.sidebar) els.sidebar.classList.remove('hidden');
            if (els.controlsTop) els.controlsTop.classList.remove('opacity-0', 'pointer-events-none');
            if (els.locMarker) els.locMarker.classList.remove('opacity-0');
            if (els.btnZen) els.btnZen.innerHTML = '<i data-lucide="maximize" class="w-4 h-4"></i>';
        }
        utils.safeIconUpdate();
    }
};

// GLOBAL WRAPPERS (for HTML onclicks)
function clockToggleFormat() { clock.toggleFormat(); }
function clockToggleView() { clock.toggleView(); }
function clockToggleZen() { clock.toggleZenMode(); }

// Listen for ESC key exiting fullscreen natively
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.clock.isZenMode) {
        clock.toggleZenMode(); // Sync state if user pressed ESC
    }
});

// --- STOPWATCH ---
const stopwatch = {
    elements: null,
    lastDisplayUpdate: 0,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                display: DOM.get('sw-display'),
                ms: DOM.get('sw-ms'),
                ring: DOM.get('sw-ring'),
                btn: DOM.get('sw-btn-main'),
                indicator: DOM.get('sw-indicator'),
                laps: DOM.get('sw-laps')
            };
        }
        return this.elements;
    },
    toggle() {
        const sw = state.stopwatch;
        const els = this.cacheElements();
        if (!els.btn || !els.indicator) return;

        if (sw.running) {
            cancelAnimationFrame(sw.animFrame);
            sw.running = false;
            els.btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
            els.btn.classList.replace('bg-[#FF8C42]', 'bg-[#2979FF]');
            els.indicator.classList.remove('bg-[#00E676]', 'animate-pulse');
            els.indicator.classList.add('bg-slate-300');
            stopwatch.saveState();
        } else {
            sw.startTime = performance.now() - sw.elapsed;
            sw.running = true;
            stopwatch.animate();
            els.btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
            els.btn.classList.replace('bg-[#2979FF]', 'bg-[#FF8C42]');
            els.indicator.classList.remove('bg-slate-300');
            els.indicator.classList.add('bg-[#00E676]', 'animate-pulse');
        }
        utils.safeIconUpdate();
    },
    animate() {
        const sw = state.stopwatch;
        const now = performance.now();
        if (sw.running) {
            sw.elapsed = now - sw.startTime;
            if (now - this.lastDisplayUpdate > 1000 / CONSTANTS.STOPWATCH_DISPLAY_FPS) {
                stopwatch.updateDisplay();
                this.lastDisplayUpdate = now;
            }
            sw.animFrame = requestAnimationFrame(() => stopwatch.animate());
        }
    },
    updateDisplay() {
        const sw = state.stopwatch;
        const els = this.cacheElements();

        const m = utils.padZero(Math.floor(sw.elapsed / 60000));
        const s = utils.padZero(Math.floor(sw.elapsed / 1000) % 60);
        const ms = utils.padZero(Math.floor((sw.elapsed % 1000) / 10));

        if (els.display) els.display.innerText = `${m}:${s}`;
        if (els.ms) els.ms.innerText = `.${ms}`;
        if (els.ring) {
            const sec = (sw.elapsed / 1000) % 60;
            const offset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - sec / 60);
            els.ring.style.strokeDashoffset = offset;
        }
    },
    reset() {
        const sw = state.stopwatch;
        if (sw.running) stopwatch.toggle();
        sw.elapsed = 0;
        sw.laps = [];
        stopwatch.updateDisplay();

        const els = this.cacheElements();
        if (els.laps) {
            els.laps.innerHTML =
                '<div class="flex flex-col items-center justify-center h-full gap-2 opacity-60 text-slate-500">' +
                '<i data-lucide="ghost" class="w-6 h-6"></i>' +
                '<span class="text-xs font-bold uppercase tracking-wider">NO LAPS RECORDED</span></div>';
        }
        if (els.ring) els.ring.style.strokeDashoffset = 0;
        utils.safeIconUpdate();
        localStorage.removeItem(CONSTANTS.LS_STOPWATCH);
    },
    lap() {
        const sw = state.stopwatch;
        if (sw.elapsed === 0) return;

        const prevLapTotal = sw.laps.length > 0 ? sw.laps[0].total : 0;
        const split = sw.elapsed - prevLapTotal;

        sw.laps.unshift({ total: sw.elapsed, split: split, id: sw.laps.length + 1 });

        const els = this.cacheElements();
        if (!els.laps) return;

        const lapHtml = `
            <div class="flex justify-between items-center py-3 px-4 mb-2 bg-white dark:bg-slate-800 rounded-xl border-3 border-[#1e293b] dark:border-slate-400 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 transition-transform">
                <span class="font-bold w-8 text-xs text-slate-500">#${sw.laps.length}</span>
                <span class="font-mono font-bold text-lg text-[#1e293b] dark:text-white">${utils.formatTime(sw.elapsed)}</span>
                <span class="text-[0.7rem] text-[#2979FF] font-bold bg-[#2979FF]/10 px-2 py-1 rounded-lg border-2 border-[#2979FF]">+${utils.formatTime(split)}</span>
            </div>`;

        if (sw.laps.length === 1) els.laps.innerHTML = '';
        els.laps.innerHTML = lapHtml + els.laps.innerHTML;
        stopwatch.saveState();
    },
    saveState() {
        localStorage.setItem(CONSTANTS.LS_STOPWATCH, JSON.stringify({ elapsed: state.stopwatch.elapsed, laps: state.stopwatch.laps }));
        saveAllToCloud();
    },
    restoreState() {
        try {
            const raw = localStorage.getItem(CONSTANTS.LS_STOPWATCH);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || data.elapsed <= 0) return;

            state.stopwatch.elapsed = data.elapsed;
            state.stopwatch.laps = data.laps || [];
            stopwatch.updateDisplay();

            const els = this.cacheElements();
            if (els.laps && state.stopwatch.laps.length > 0) {
                els.laps.innerHTML = state.stopwatch.laps.map((lap, idx) => `
                    <div class="flex justify-between items-center py-3 px-4 mb-2 bg-white dark:bg-slate-800 rounded-xl border-3 border-[#1e293b] dark:border-slate-400 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 transition-transform">
                        <span class="font-bold w-8 text-xs text-slate-500">#${state.stopwatch.laps.length - idx}</span>
                        <span class="font-mono font-bold text-lg text-[#1e293b] dark:text-white">${utils.formatTime(lap.total)}</span>
                        <span class="text-[0.7rem] text-[#2979FF] font-bold bg-[#2979FF]/10 px-2 py-1 rounded-lg border-2 border-[#2979FF]">+${utils.formatTime(lap.split)}</span>
                    </div>`).join('');
            }
            utils.safeIconUpdate();
        } catch (e) {
            console.warn('Failed to restore stopwatch state:', e);
        }
    }
};

// --- TIMER MODULE ---
const timer = {
    elements: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                card: DOM.get('timer-card'),
                btnStart: DOM.get('timer-btn-start'),
                zenVis: DOM.get('timer-visual-zen'),
                rushVis: DOM.get('timer-visual-rush'),
                btnCalm: DOM.get('btn-mode-calm'),
                btnBomb: DOM.get('btn-mode-bomb'),
                rushDisplay: DOM.get('t-rush-display'),
                ringZen: DOM.get('timer-ring-zen'),
                fuseRush: DOM.get('timer-fuse-rush')
            };
        }
        return this.elements;
    },
    setMode(mode) {
        state.timer.mode = mode;
        const els = this.cacheElements();
        if (!els.btnCalm || !els.btnBomb || !els.btnStart) return;

        els.btnCalm.className = 'px-6 py-2 rounded-xl text-sm font-bold uppercase transition-all flex items-center gap-2 border-3 border-[#1e293b] bg-white text-[#1e293b]';
        els.btnBomb.className = 'px-6 py-2 rounded-xl text-sm font-bold uppercase transition-all flex items-center gap-2 border-3 border-[#1e293b] bg-white text-[#1e293b]';

        if (mode === 'calm') {
            els.btnCalm.classList.replace('bg-white', 'bg-[#00E676]');
            els.btnCalm.classList.replace('text-[#1e293b]', 'text-white');
            els.btnCalm.classList.add('shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]', '-translate-y-1');

            if (els.zenVis) els.zenVis.classList.remove('hidden', 'opacity-0');
            if (els.rushVis) els.rushVis.classList.add('hidden', 'opacity-0');

            els.btnStart.className = "w-24 h-24 rounded-2xl bg-[#00E676] border-4 border-[#1e293b] text-white flex items-center justify-center mx-4 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] active:translate-y-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]";
        } else {
            els.btnBomb.classList.replace('bg-white', 'bg-[#FF8C42]');
            els.btnBomb.classList.replace('text-[#1e293b]', 'text-white');
            els.btnBomb.classList.add('shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]', '-translate-y-1');

            if (els.zenVis) els.zenVis.classList.add('hidden', 'opacity-0');
            if (els.rushVis) {
                els.rushVis.classList.remove('hidden');
                setTimeout(() => els.rushVis.classList.remove('opacity-0'), 10);
            }
            els.btnStart.className = "w-24 h-24 rounded-2xl bg-[#FF8C42] border-4 border-[#1e293b] text-white flex items-center justify-center mx-4 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] active:translate-y-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]";
        }
        timer.updateInputs();
    },
    adjust(sec) {
        const total = utils.parseTimeInputs('t-min', 't-sec') + sec;
        state.timer.timeLeft = Math.max(0, total);
        state.timer.initial = Math.max(state.timer.initial, state.timer.timeLeft);
        timer.updateInputs();
    },
    updateInputs() {
        state.timer.timeLeft = Math.max(0, state.timer.timeLeft);
        const { m, s } = utils.setTimeInputs('t-min', 't-sec', state.timer.timeLeft);
        const els = this.cacheElements();
        if (els.rushDisplay) els.rushDisplay.innerText = `${m}:${s}`;
    },
    toggle() {
        audio.init();
        state.timer.running ? timer.stop() : timer.start();
    },
    start() {
        const t = state.timer;
        const inputTime = utils.parseTimeInputs('t-min', 't-sec');
        t.timeLeft = inputTime;
        if (t.timeLeft <= 0) return;

        t.lastDuration = inputTime;
        t.initial = t.timeLeft;
        t.running = true;

        const endTimestamp = Date.now() + (t.timeLeft * 1000);
        const els = this.cacheElements();
        if (els.btnStart) els.btnStart.innerHTML = '<i data-lucide="pause" class="w-12 h-12 fill-current"></i>';

        t.interval = setInterval(() => {
            t.timeLeft = Math.max(0, t.timeLeft - 1);
            timer.updateInputs();
            if (t.timeLeft > 0) audio.playTick();
            timer.updateVisuals();
            timer.saveState(endTimestamp);
            if (t.timeLeft === 0) timer.finish();
        }, CONSTANTS.TIMER_UPDATE_INTERVAL);

        timer.saveState(endTimestamp);
        utils.safeIconUpdate();
    },
    updateVisuals() {
        const t = state.timer;
        const pct = t.timeLeft / t.initial;
        const els = this.cacheElements();

        if (t.mode === 'calm' && els.ringZen) {
            els.ringZen.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - pct);
        } else if (els.fuseRush) {
            els.fuseRush.style.strokeDashoffset = 100 * (1 - pct);
            if (els.card) {
                t.timeLeft <= 10 ? els.card.classList.add('animate-pulse', 'border-[#FF8C42]') : els.card.classList.remove('animate-pulse', 'border-[#FF8C42]');
            }
        }
    },
    stop() {
        clearInterval(state.timer.interval);
        state.timer.running = false;
        const els = this.cacheElements();
        if (els.btnStart) {
            els.btnStart.innerHTML = '<i data-lucide="play" class="w-12 h-12 fill-current ml-1"></i>';
            utils.safeIconUpdate();
        }
    },
    reset() {
        timer.stop();
        const resetTime = state.timer.lastDuration || 300;
        state.timer.timeLeft = resetTime;
        state.timer.initial = resetTime;
        utils.setTimeInputs('t-min', 't-sec', resetTime);
        timer.updateInputs();

        const els = this.cacheElements();
        if (els.ringZen) els.ringZen.style.strokeDashoffset = 0;
        if (els.fuseRush) els.fuseRush.style.strokeDashoffset = 0;
        if (els.card) els.card.classList.remove('animate-pulse', 'border-[#FF8C42]');
        localStorage.removeItem(CONSTANTS.LS_TIMER);
    },
    finish() {
        timer.stop();
        const overlayId = state.timer.mode === 'bomb' ? 'explosion-overlay' : 'zen-overlay';
        const overlay = DOM.get(overlayId);
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }
        audio.playChime();
        localStorage.removeItem(CONSTANTS.LS_TIMER);
    },
    resetOverlay() {
        ['explosion-overlay', 'zen-overlay'].forEach(id => {
            const overlay = DOM.get(id);
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        });
        timer.reset();
    },
    saveState(endTimestamp) {
        localStorage.setItem(CONSTANTS.LS_TIMER, JSON.stringify({
            endTimestamp, initial: state.timer.initial, lastDuration: state.timer.lastDuration, mode: state.timer.mode, running: state.timer.running
        }));
        saveAllToCloud();
    },
    restoreState() {
        try {
            const raw = localStorage.getItem(CONSTANTS.LS_TIMER);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || !data.running) return;

            const t = state.timer;
            const remainingSec = Math.ceil((data.endTimestamp - Date.now()) / 1000);

            t.initial = data.initial;
            t.lastDuration = data.lastDuration;
            t.mode = data.mode;
            timer.setMode(t.mode);

            if (remainingSec <= 0) {
                t.timeLeft = 0;
                timer.updateInputs();
                timer.updateVisuals();
                audio.init();
                timer.finish();
            } else {
                t.timeLeft = remainingSec;
                timer.updateInputs();
                timer.updateVisuals();
                audio.init();
                timer.start();
            }
        } catch (e) {
            console.warn('Failed to restore timer state:', e);
        }
    }
};

// --- ALARM MODULE ---
const alarm = {
    elements: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                hourInput: DOM.get('alarm-hour'),
                minInput: DOM.get('alarm-min'),
                ampmBtn: DOM.get('alarm-ampm-btn'),
                labelInput: DOM.get('alarm-label'),
                addForm: DOM.get('alarm-add-form'),
                listContainer: DOM.get('alarm-list-container'),
                emptyState: DOM.get('alarm-empty-state'),
                overlay: DOM.get('alarm-overlay'),
                overlayLabel: DOM.get('alarm-overlay-label'),
                overlayTime: DOM.get('alarm-overlay-time'),
            };
        }
        return this.elements;
    },
    toggleAmPm() {
        state.alarm.ampm = state.alarm.ampm === 'AM' ? 'PM' : 'AM';
        const els = this.cacheElements();
        if (els.ampmBtn) els.ampmBtn.textContent = state.alarm.ampm;
    },
    openAddForm() {
        const els = this.cacheElements();
        if (els.addForm) els.addForm.classList.remove('translate-y-full', 'opacity-0');
    },
    closeAddForm() {
        const els = this.cacheElements();
        if (els.addForm) els.addForm.classList.add('translate-y-full', 'opacity-0');
        if (els.hourInput) els.hourInput.value = '07';
        if (els.minInput) els.minInput.value = '00';
        if (els.labelInput) els.labelInput.value = '';
    },
    saveNew() {
        audio.init();
        const els = this.cacheElements();
        let h = parseInt(els.hourInput ? els.hourInput.value : 12) || 12;
        const m = parseInt(els.minInput ? els.minInput.value : 0) || 0;
        const ampm = state.alarm.ampm;
        const label = els.labelInput ? (els.labelInput.value.trim() || 'Alarm') : 'Alarm';

        h = Math.max(1, Math.min(12, h));
        const adjustedH = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);

        state.alarm.alarms.push({ id: Date.now(), h, m, ampm, adjustedH, label, enabled: true });
        this.saveState();
        saveAllToCloud();
        this.renderList();
        this.closeAddForm();
    },
    renderList() {
        const els = this.cacheElements();
        if (!els.listContainer || !els.emptyState) return;

        if (state.alarm.alarms.length === 0) {
            els.emptyState.classList.remove('hidden');
            els.emptyState.classList.add('flex');
            els.listContainer.innerHTML = '';
            utils.safeIconUpdate();
            return;
        }

        els.emptyState.classList.add('hidden');
        els.emptyState.classList.remove('flex');

        const sorted = [...state.alarm.alarms].sort((a, b) => a.adjustedH !== b.adjustedH ? a.adjustedH - b.adjustedH : a.m - b.m);

        els.listContainer.innerHTML = sorted.map(al => `
            <div class="p-4 mb-3 rounded-xl border-3 border-[#1e293b] dark:border-slate-400 bg-white dark:bg-slate-800 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 transition-transform ${!al.enabled ? 'opacity-50 grayscale' : ''}">
                <div class="flex flex-col text-left">
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-mono font-bold text-[#1e293b] dark:text-white">${utils.padZero(al.h)}:${utils.padZero(al.m)}</span>
                        <span class="text-lg font-bold text-[#FF6B95]">${al.ampm}</span>
                    </div>
                    <div class="text-sm font-bold uppercase tracking-wider text-slate-500">${al.label}</div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="alarm.toggleEnable(${al.id})" class="p-2 rounded-lg border-2 border-[#1e293b] ${al.enabled ? 'bg-[#00E676] text-white' : 'bg-slate-200 text-slate-400'}">
                        <i data-lucide="power" class="w-5 h-5"></i>
                    </button>
                    <button onclick="alarm.delete(${al.id})" class="p-2 bg-[#FF6B95] text-white rounded-lg border-2 border-[#1e293b] hover:bg-red-600">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `).join('');
        utils.safeIconUpdate();
    },
    toggleEnable(id) {
        const al = state.alarm.alarms.find(a => a.id === id);
        if (al) {
            al.enabled = !al.enabled;
            this.saveState();
            saveAllToCloud();
            this.renderList();
        }
    },
    delete(id) {
        state.alarm.alarms = state.alarm.alarms.filter(a => a.id !== id);
        this.saveState();
        saveAllToCloud();
        this.renderList();
    },
    saveState() {
        localStorage.setItem(CONSTANTS.LS_ALARM, JSON.stringify(state.alarm.alarms));
    },
    restoreState() {
        try {
            const raw = localStorage.getItem(CONSTANTS.LS_ALARM);
            if (raw) {
                state.alarm.alarms = JSON.parse(raw);
                this.renderList();
            }
        } catch (e) {
            console.warn('Failed to restore alarms:', e);
        }
    },
    check() {
        if (state.alarm.currentlyRinging) return;
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const absoluteMin = currentH * 60 + currentM;

        if (now.getSeconds() !== 0 || state.alarm.lastTriggerMinute === absoluteMin) return;

        for (const al of state.alarm.alarms) {
            if (al.enabled && al.adjustedH === currentH && al.m === currentM) {
                state.alarm.lastTriggerMinute = absoluteMin;
                this.trigger(al);
                break;
            }
        }
    },
    trigger(al) {
        state.alarm.currentlyRinging = al;
        const els = this.cacheElements();

        if (els.overlayLabel) els.overlayLabel.textContent = al.label;
        if (els.overlayTime) els.overlayTime.textContent = `${utils.padZero(al.h)}:${utils.padZero(al.m)} ${al.ampm}`;
        if (els.overlay) {
            els.overlay.style.display = 'flex';
            setTimeout(() => els.overlay.style.opacity = '1', 10);
        }

        audio.init();
        this.stopSound();
        audio.playAlarmSound();
        state.alarm.soundInterval = setInterval(() => {
            state.alarm.currentlyRinging ? audio.playAlarmSound() : this.stopSound();
        }, 2000);
        utils.safeIconUpdate();
    },
    triggerManual(label, title = 'GOAL REACHED!') {
        const els = this.cacheElements();
        if (els.overlayLabel) els.overlayLabel.textContent = title;
        if (els.overlayTime) els.overlayTime.textContent = label;
        if (els.overlay) {
            els.overlay.classList.remove('hidden');
            els.overlay.classList.add('flex');
            setTimeout(() => els.overlay.style.opacity = '1', 10);
        }
        audio.init();
        audio.playAlarmSound();
        state.alarm.currentlyRinging = { label, title, id: 'manual' };
    },
    stopSound() {
        if (state.alarm.soundInterval) {
            clearInterval(state.alarm.soundInterval);
            state.alarm.soundInterval = null;
        }
        audio.stopAllTones();
    },
    dismiss() {
        this.stopSound();
        const els = this.cacheElements();
        if (els.overlay) {
            els.overlay.style.opacity = '0';
            setTimeout(() => els.overlay.style.display = 'none', 300);
        }
        if (state.alarm.currentlyRinging) {
            const al = state.alarm.alarms.find(a => a.id === state.alarm.currentlyRinging.id);
            if (al) al.enabled = false;
            state.alarm.currentlyRinging = null;
            this.renderList();
            saveAllToCloud();
        }
    }
};

// --- COUNTDOWN MODULE ---
const countdown = {
    elements: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                setupView: DOM.get('countdown-setup'),
                runningView: DOM.get('countdown-running'),
                hourInput: DOM.get('countdown-hour'),
                minInput: DOM.get('countdown-min'),
                ampmBtn: DOM.get('countdown-ampm-btn'),
                labelInput: DOM.get('countdown-label'),
                timeDisplay: DOM.get('countdown-time-display'),
                targetDisplay: DOM.get('countdown-target-display'),
                activeLabel: DOM.get('countdown-active-label'),
                overlay: DOM.get('countdown-overlay'),
                overlayLabel: DOM.get('countdown-overlay-label')
            };
        }
        return this.elements;
    },
    toggleAmPm() {
        state.countdown.ampm = state.countdown.ampm === 'AM' ? 'PM' : 'AM';
        const els = this.cacheElements();
        if (els.ampmBtn) {
            els.ampmBtn.innerText = state.countdown.ampm;
            els.ampmBtn.classList.toggle('bg-blue', state.countdown.ampm === 'PM');
            els.ampmBtn.classList.toggle('bg-pink', state.countdown.ampm === 'AM');
        }
    },
    start() {
        const els = this.cacheElements();
        const h = parseInt(els.hourInput.value) || 0;
        const m = parseInt(els.minInput.value) || 0;
        const label = (els.labelInput && els.labelInput.value.trim()) ? els.labelInput.value.trim() : 'COUNTDOWN';
        
        state.countdown.target = { h, m, ampm: state.countdown.ampm };
        state.countdown.label = label;
        state.countdown.active = true;
        
        if (els.setupView) els.setupView.classList.replace('flex', 'hidden');
        if (els.runningView) els.runningView.classList.replace('hidden', 'flex');
        
        if (els.activeLabel) els.activeLabel.innerText = label;
        
        let displayH = h;
        if (h === 0) displayH = 12;
        if (els.targetDisplay) els.targetDisplay.innerText = `${displayH}:${utils.padZero(m)} ${state.countdown.ampm}`;
        
        audio.init();
        
        this.update();
        if (state.countdown.interval) clearInterval(state.countdown.interval);
        state.countdown.interval = setInterval(() => this.update(), 1000);
        this.saveState();
    },
    update() {
        if (!state.countdown.active || !state.countdown.target) return;
        
        const els = this.cacheElements();
        const now = new Date();
        const targetDate = new Date();
        
        let targetH = state.countdown.target.h;
        const targetM = state.countdown.target.m;
        
        if (state.countdown.target.ampm === 'PM' && targetH < 12) targetH += 12;
        if (state.countdown.target.ampm === 'AM' && targetH === 12) targetH = 0;
        
        targetDate.setHours(targetH, targetM, 0, 0);
        
        // If target is in the past today, assume it's for tomorrow
        if (targetDate < now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        
        const diff = targetDate - now;
        
        if (diff <= 0) {
            this.finish();
            return;
        }
        
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        if (els.timeDisplay) {
            els.timeDisplay.innerText = `${utils.padZero(h)}:${utils.padZero(m)}:${utils.padZero(s)}`;
        }
    },
    finish() {
        if (state.countdown.interval) {
            clearInterval(state.countdown.interval);
            state.countdown.interval = null;
        }
        const els = this.cacheElements();

        if (els.timeDisplay) {
            els.timeDisplay.innerText = "TIME'S UP";
            els.timeDisplay.classList.remove('text-blue');
            els.timeDisplay.classList.add('text-pink');
        }

        if (els.overlayLabel) els.overlayLabel.innerText = state.countdown.label || "TIME IS UP";
        if (els.overlay) {
            els.overlay.classList.remove('hidden');
            els.overlay.classList.add('flex');
            setTimeout(() => els.overlay.style.opacity = '1', 10);
        }

        audio.init();
        audio.playChime();
    },
    dismissOverlay() {
        const els = this.cacheElements();
        if (els.overlay) {
            els.overlay.style.opacity = '0';
            setTimeout(() => {
                els.overlay.classList.add('hidden');
                els.overlay.classList.remove('flex');
            }, 300);
        }
        audio.stopAllTones();
    },
    reset() {
        if (state.countdown.interval) {
            clearInterval(state.countdown.interval);
            state.countdown.interval = null;
        }
        state.countdown.active = false;
        state.countdown.target = null;

        const els = this.cacheElements();
        if (els.runningView) els.runningView.classList.replace('flex', 'hidden');
        if (els.setupView) els.setupView.classList.replace('hidden', 'flex');

        if (els.timeDisplay) {
            els.timeDisplay.classList.remove('text-pink');
            els.timeDisplay.classList.add('text-blue');
        }

        this.saveState();
    },
    saveState() {
        localStorage.setItem('hub_countdown', JSON.stringify({
           target: state.countdown.target, label: state.countdown.label, active: state.countdown.active
        }));
    },
    restoreState() {
        try {
            const raw = localStorage.getItem('hub_countdown');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.active && data.target) {
                    const els = this.cacheElements();
                    if (els.hourInput) els.hourInput.value = data.target.h;
                    if (els.minInput) els.minInput.value = data.target.m;
                    state.countdown.ampm = data.target.ampm;
                    if (els.labelInput) els.labelInput.value = data.label;
                    if (els.ampmBtn) {
                        els.ampmBtn.innerText = state.countdown.ampm;
                        els.ampmBtn.classList.toggle('bg-blue', state.countdown.ampm === 'PM');
                        els.ampmBtn.classList.toggle('bg-pink', state.countdown.ampm === 'AM');
                    }
                    this.start();
                }
            }
        } catch(e) { console.warn('Failed to restore countdown state:', e); }
    }
};

// --- CALENDAR MODULE ---
const calendar = {
    elements: null,
    saveTimeout: null,
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                grid: DOM.get('cal-grid'),
                monthYear: DOM.get('cal-month-year'),
                counter: DOM.get('cal-counter-display'),
                monthView: DOM.get('cal-month-view'),
                yearView: DOM.get('cal-year-view')
            };
        }
        return this.elements;
    },
    load() {
        try { state.calendar.marked = JSON.parse(localStorage.getItem('hub_calendar')) || {}; }
        catch { state.calendar.marked = {}; }
    },
    save() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            localStorage.setItem('hub_calendar', JSON.stringify(state.calendar.marked));
            saveAllToCloud();
        }, 500);
    },
    toggleViewMode() {
        state.calendar.viewMode = state.calendar.viewMode === 'month' ? 'year' : 'month';
        const els = this.cacheElements();

        if (state.calendar.viewMode === 'year') {
            els.monthView.classList.add('hidden');
            els.yearView.classList.remove('hidden');
        } else {
            els.yearView.classList.add('hidden');
            els.monthView.classList.remove('hidden');
        }
        this.render();
    },
    navigate(delta) {
        if (state.calendar.viewMode === 'year') {
            state.calendar.date.setFullYear(state.calendar.date.getFullYear() + delta);
        } else {
            state.calendar.date.setMonth(state.calendar.date.getMonth() + delta);
        }
        calendar.render();
    },
    goToday() {
        state.calendar.date = new Date();
        state.calendar.selected = utils.getTodayString();
        this.render();
    },
    render() {
        const cal = state.calendar;
        const els = this.cacheElements();
        if (!els.grid || !els.monthYear) return;

        const year = cal.date.getFullYear();
        const month = cal.date.getMonth();

        if (cal.viewMode === 'month') {
            els.monthYear.innerText = `${CONSTANTS.MONTH_NAMES[month]} ${year}`;

            const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
            const todayStr = utils.getTodayString();

            const cellsHTML = Array.from({ length: CONSTANTS.CALENDAR_GRID_SIZE }, (_, i) => {
                return calendar.createCellHTML(new Date(year, month, 1 - startOffset + i), month, todayStr);
            });

            els.grid.innerHTML = cellsHTML.join('');
        } else {
            els.monthYear.innerText = `${year}`;
            this.renderYearView(year);
        }
        this.updateInfo();
    },
    renderYearView(year) {
        const els = this.cacheElements();
        if (!els.yearView) return;

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        let html = '';
        for (let m = 0; m < 12; m++) {
            const isCurrentMonth = (year === currentYear && m === currentMonth);
            const monthName = CONSTANTS.MONTH_NAMES[m];

            // Build mini grid
            let miniGrid = '<div class="grid grid-cols-7 gap-1 mt-1">';
            const startOffset = (new Date(year, m, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, m + 1, 0).getDate();

            // Empty slots before 1st
            for (let i = 0; i < startOffset; i++) {
                miniGrid += '<div class="aspect-square"></div>';
            }
            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                const isTodayStr = utils.getDateString(new Date(year, m, d)) === utils.getTodayString();
                const textCol = isTodayStr ? 'text-white' : 'text-slate-400 dark:text-slate-300';
                const dayClass = isTodayStr ? 'bg-[#2979FF] rounded-sm shadow-[1px_1px_0px_0px_rgba(30,41,59,1)]' : 'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm';
                miniGrid += `<div class="aspect-square flex items-center justify-center font-bold text-[0.6rem] md:text-[0.65rem] ${textCol} ${dayClass} transition-colors">${d}</div>`;
            }
            miniGrid += '</div>';

            const activeClass = isCurrentMonth ? 'border-[#2979FF] shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] bg-blue/5' : 'border-[#1e293b] dark:border-slate-500 hover:border-[#FF8C42] shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]';

            html += `
                <div class="cal-mini-month p-2 md:p-3 rounded-xl md:rounded-2xl border-2 md:border-3 cursor-pointer transition-all hover:-translate-y-1 bg-white dark:bg-slate-800 ${activeClass}" 
                     data-month="${m}" onclick="calendar.selectMonthFromYear(${m})">
                    <div class="text-xs md:text-sm font-black text-center mb-1 text-[#1e293b] dark:text-white tracking-widest uppercase">${monthName}</div>
                    ${miniGrid}
                </div>
            `;
        }
        els.yearView.innerHTML = html;
    },
    selectMonthFromYear(monthIndex) {
        state.calendar.date.setMonth(monthIndex);
        this.toggleViewMode(); // switch back to month view
    },
    createCellHTML(cellDate, currentMonth, todayStr) {
        const dateStr = utils.getDateString(cellDate);
        const isCurrMonth = cellDate.getMonth() === currentMonth;
        const isToday = dateStr === todayStr;
        const isSelected = state.calendar.selected === dateStr;
        const isMarked = state.calendar.marked[dateStr];

        let classes = 'cal-day rounded-2xl flex flex-col items-center justify-center font-bold text-2xl relative cursor-pointer border-3 transition-transform hover:-translate-y-1 ';

        if (isToday) classes += 'bg-[#2979FF] text-white border-[#1e293b] shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] z-10 ';
        else if (isCurrMonth) classes += 'bg-white text-[#1e293b] border-[#1e293b] shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] ';
        else classes += 'bg-slate-50 text-slate-300 border-transparent empty hover:translate-y-0 hover:shadow-none cursor-default ';

        if (isSelected && !isToday) classes += 'ring-4 ring-[#FF8C42] ';

        const dotHTML = isMarked ? `<div class="absolute bottom-2 w-2 h-2 rounded-full border border-dark ${isToday ? 'bg-[#FF8C42]' : 'bg-[#FF6B95]'}"></div>` : '';

        return `<div class="${classes}" data-date="${dateStr}" data-time="${cellDate.getTime()}">${cellDate.getDate()}${dotHTML}</div>`;
    },
    setupEventDelegation() {
        const els = this.cacheElements();
        if (!els.grid) return;

        els.grid.addEventListener('click', (e) => {
            const cell = e.target.closest('.cal-day');
            if (!cell || cell.classList.contains('empty')) return;

            const dateStr = cell.dataset.date;
            const cellDate = new Date(parseInt(cell.dataset.time));

            if (e.altKey) {
                state.calendar.marked[dateStr] ? delete state.calendar.marked[dateStr] : state.calendar.marked[dateStr] = true;
                calendar.save();
                calendar.render();
            } else {
                state.calendar.selected = dateStr;
                calendar.render();
            }
        });
    },
    updateInfo() {
        const els = this.cacheElements();
        if (!els.counter) return;

        const year = state.calendar.date.getFullYear();
        const month = state.calendar.date.getMonth();
        const markedCount = Object.keys(state.calendar.marked).filter(ds => {
            const parts = ds.split('-').map(Number);
            return parts[0] === year && parts[1] === month + 1;
        }).length;

        if (state.calendar.selected) {
            const cellDate = new Date(state.calendar.selected + 'T00:00:00');
            const diffDays = Math.ceil((cellDate.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
            let text = 'TODAY';
            if (diffDays > 0) text = `${diffDays} DAY${diffDays > 1 ? 'S' : ''} FROM NOW`;
            else if (diffDays < 0) text = `${Math.abs(diffDays)} DAY${Math.abs(diffDays) > 1 ? 'S' : ''} AGO`;

            els.counter.innerHTML = `
                <div class="flex items-center gap-2 flex-wrap justify-center">
                    <span class="text-blue font-bold uppercase tracking-wider">${CONSTANTS.DAYS[cellDate.getDay()]}</span>
                    <span class="text-[0.7rem] text-slate-500">${cellDate.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</span>
                    <span class="text-[0.7rem] text-pink font-bold border-l border-slate-300 pl-2">${markedCount} marked</span>
                </div>
                <div class="text-[0.65rem] text-slate-400 mt-0.5 text-center uppercase tracking-wider">${text}</div>
            `;
        } else {
            els.counter.innerHTML = `
                <div class="flex items-center gap-2 flex-wrap justify-center">
                    <span class="text-[0.7rem] text-slate-500">${CONSTANTS.MONTH_NAMES[month]} ${year}</span>
                    <span class="text-[0.7rem] text-pink font-bold border-l border-slate-300 pl-2">${markedCount} marked</span>
                </div>
                <div class="text-[0.65rem] text-slate-400 mt-0.5 text-center uppercase tracking-wider">Click date &middot; Alt+Click to mark</div>
            `;
        }
    }
};

// --- NAVIGATION (Robust Tool Switching) ---
function switchTool(toolId) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const navBtn = DOM.get(`nav-${toolId}`);
    if (navBtn) navBtn.classList.add('active');

    document.querySelectorAll('section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });

    const target = DOM.get(`tool-${toolId}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('flex');
    }

    state.currentTool = toolId;
    utils.safeIconUpdate();

    // Auto-hide sidebar on mobile after choosing a tool
    if (window.innerWidth < 768) {
        const el = DOM.get('app-sidebar');
        const overlay = DOM.get('sidebar-overlay');
        if (el && el.classList.contains('mobile-open')) {
            el.classList.remove('mobile-open');
            if (overlay) {
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
        }
    }
}

// --- INPUT VALIDATION ---
function setupInputValidation() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', function () {
            let val = parseInt(this.value);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 99) val = 99;
            this.value = utils.padZero(val);
        });
    });
}

// --- INITIALIZATION ---
window.onload = async function () {
    const user = await requireAuth();
    if (!user) return;

    darkMode.init();
    sidebar.init();
    utils.safeIconUpdate();

    // Load cloud data and merge
    try {
        const cloudData = await loadProgress(CONSTANTS.CLOUD_KEY);
        if (cloudData) {
            if (cloudData.darkMode !== undefined) {
                state.darkMode = cloudData.darkMode;
                document.documentElement.classList.toggle('dark', state.darkMode);
            }
            if (cloudData.sidebarCollapsed !== undefined) {
                state.sidebarCollapsed = cloudData.sidebarCollapsed;
                const el = DOM.get('app-sidebar');
                if (el) el.classList.toggle('collapsed', state.sidebarCollapsed);
            }
            if (cloudData.alarms) state.alarm.alarms = cloudData.alarms;
            if (cloudData.calendarMarked) state.calendar.marked = cloudData.calendarMarked;
            if (cloudData.clockSettings) {
                state.clock.is24Hour = !!cloudData.clockSettings.is24Hour;
                state.clock.isAnalog = !!cloudData.clockSettings.isAnalog;
            }
        }
    } catch (e) {
        console.warn('Cloud load failed, using local fallback', e);
    }

    clock.initFace();
    clock.startLoop();

    locationWeather.init();

    calendar.load();
    calendar.setupEventDelegation();
    calendar.render();

    setupInputValidation();
    stopwatch.restoreState();
    timer.restoreState();
    alarm.restoreState();
    countdown.restoreState();

    switchTool('clock');

    // Update UI elements based on loaded state
    const els = clock.cacheElements();
    if (els.btnFormat) els.btnFormat.innerText = state.clock.is24Hour ? '24H' : '12H';
    if (els.btnView) els.btnView.innerText = state.clock.isAnalog ? "DIGITAL" : "ANALOG";
    if (state.clock.isAnalog) {
        els.digital?.classList.add('hidden');
        els.analog?.classList.remove('hidden');
        els.analog?.classList.add('flex');
    }

    timer.setMode('calm');
};

// Global debounced save
let cloudSaveTimeout = null;
async function saveAllToCloud() {
    clearTimeout(cloudSaveTimeout);
    cloudSaveTimeout = setTimeout(async () => {
        const data = {
            darkMode: state.darkMode,
            sidebarCollapsed: state.sidebarCollapsed,
            alarms: state.alarm.alarms.map(a => ({ ...a, enabled: a.enabled })), // simple clone
            calendarMarked: state.calendar.marked,
            clockSettings: {
                is24Hour: state.clock.is24Hour,
                isAnalog: state.clock.isAnalog
            }
        };
        await saveProgress(CONSTANTS.CLOUD_KEY, data);
    }, 1000);
}

// --- GLOBAL BINDINGS ---
window.clockToggleFormat = () => clock.toggleFormat();
window.clockToggleView = () => clock.toggleView();
window.clockToggleZen = () => clock.toggleZenMode();
window.swToggle = () => stopwatch.toggle();
window.swReset = () => stopwatch.reset();
window.swLap = () => stopwatch.lap();
window.timerSetMode = (mode) => timer.setMode(mode);
window.timerAdjust = (sec) => timer.adjust(sec);
window.timerToggle = () => timer.toggle();
window.timerStop = () => timer.stop();
window.timerReset = () => timer.reset();
window.resetTimerOverlay = () => timer.resetOverlay();
window.calNav = (delta) => calendar.navigate(delta);
window.calGoToday = () => calendar.goToday();
window.calToggleViewMode = () => calendar.toggleViewMode();
window.toggleDarkMode = () => darkMode.toggle();
window.toggleSidebar = () => sidebar.toggle();
window.alarmToggleAmPm = () => alarm.toggleAmPm();
window.alarmOpenAddForm = () => alarm.openAddForm();
window.alarmCloseAddForm = () => alarm.closeAddForm();
window.alarmSaveNew = () => alarm.saveNew();
window.alarmDismiss = () => alarm.dismiss();
window.switchTool = switchTool;
window.alarm = alarm;
window.countdown = countdown;

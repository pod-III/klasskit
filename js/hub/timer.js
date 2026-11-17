// KlassKit Hub — Universal Countdown Timer

// --- UNIVERSAL COUNTDOWN TIMER ---
const Timer = {
  el: null,
  running: false,
  remaining: 0,    // ms remaining on countdown
  initial: 0,      // ms total duration set
  lastTick: 0,
  intervalId: null,
  alarmTimeout: null,
  drag: { active: false, offsetX: 0, offsetY: 0, rafId: null, pendingX: 0, pendingY: 0 },
  presets: [
    { label: '1m', seconds: 60 },
    { label: '2m', seconds: 120 },
    { label: '3m', seconds: 180 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
  ],
  alarmAudioCtx: null,

  init() {
    if (this.el) return;

    const timer = document.createElement('div');
    timer.id = 'universal-timer';
    timer.className = 'universal-timer hidden';
    timer.innerHTML = `
      <button class="timer-exit-btn" title="Close" aria-label="Close timer">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
      <div class="timer-drag-handle" title="Drag to move" touch-action="none">
        <i data-lucide="grip-vertical" class="w-3 h-3 opacity-50"></i>
        <span>Timer</span>
      </div>
      <div class="timer-ring-wrap">
        <svg class="timer-ring" viewBox="0 0 80 80">
          <circle class="timer-ring-bg" cx="40" cy="40" r="34" />
          <circle class="timer-ring-fg" cx="40" cy="40" r="34" />
        </svg>
        <div class="timer-display">00:00</div>
      </div>
      <div class="timer-presets">
        ${this.presets.map(p => `<button class="timer-preset-btn" data-seconds="${p.seconds}">${p.label}</button>`).join('')}
        <button class="timer-preset-btn timer-custom-btn" data-seconds="custom" title="Custom time">
          <i data-lucide="pencil" class="w-3 h-3"></i>
        </button>
      </div>
      <div class="timer-custom-input hidden">
        <div class="timer-custom-fields">
          <div class="timer-custom-field">
            <input type="number" class="timer-input-min" min="0" max="99" value="5" placeholder="00" />
            <label>min</label>
          </div>
          <span class="timer-custom-sep">:</span>
          <div class="timer-custom-field">
            <input type="number" class="timer-input-sec" min="0" max="59" value="0" placeholder="00" />
            <label>sec</label>
          </div>
        </div>
        <button class="timer-preset-btn timer-set-btn">Set</button>
      </div>
      <div class="timer-controls">
        <button class="timer-btn timer-play" title="Start" aria-label="Start timer">
          <i data-lucide="play" class="w-4 h-4"></i>
        </button>
        <button class="timer-btn timer-pause hidden" title="Pause" aria-label="Pause timer">
          <i data-lucide="pause" class="w-4 h-4"></i>
        </button>
        <button class="timer-btn timer-reset" title="Reset" aria-label="Reset timer">
          <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="timer-add-time">
        <button class="timer-add-btn" data-add="30" title="Add 30 seconds">+30s</button>
        <button class="timer-add-btn" data-add="60" title="Add 1 minute">+1m</button>
      </div>
    `;
    document.getElementById('tab-content-area')?.appendChild(timer);
    this.el = timer;

    // Restore visibility
    const visible = Storage.get(CONFIG.storageKeys.timerVisible);
    if (visible) this.show();

    // Restore position
    const pos = Storage.get(CONFIG.storageKeys.timerPosition);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      timer.style.left = `${pos.x}px`;
      timer.style.top = `${pos.y}px`;
      timer.style.right = 'auto';
      timer.style.bottom = 'auto';
      timer.style.transform = 'none';
    }
    // If no saved position, CSS centers it via top:50%; left:50%; transform:translate(-50%,-50%)

    // Restore duration or set default 5 min
    const savedDuration = Storage.get(CONFIG.storageKeys.timerDuration);
    this.setDuration(savedDuration || 300);

    this.bindEvents();
    Utils.refreshIcons(timer);
  },

  bindEvents() {
    if (!this.el) return;
    const handle = this.el.querySelector('.timer-drag-handle');
    const playBtn = this.el.querySelector('.timer-play');
    const pauseBtn = this.el.querySelector('.timer-pause');
    const resetBtn = this.el.querySelector('.timer-reset');
    const exitBtn = this.el.querySelector('.timer-exit-btn');

    exitBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
      AudioEngine.click();
    });

    // --- Pointer-based drag (mouse + touch unified, smooth via RAF) ---
    handle.addEventListener('pointerdown', (e) => {
      // Only primary button (left-click / single touch)
      if (e.button !== 0) return;
      this.drag.active = true;
      this.el.style.transform = 'none';
      const rect = this.el.getBoundingClientRect();
      this.drag.offsetX = e.clientX - rect.left;
      this.drag.offsetY = e.clientY - rect.top;
      this.el.classList.add('timer-dragging');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!this.drag.active) return;
      e.preventDefault();
      
      const container = document.getElementById('tab-content-area');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      this.drag.pendingX = e.clientX - this.drag.offsetX - containerRect.left;
      this.drag.pendingY = e.clientY - this.drag.offsetY - containerRect.top;

      if (!this.drag.rafId) {
        this.drag.rafId = requestAnimationFrame(() => {
          this.drag.rafId = null;
          if (!this.drag.active) return;
          let x = this.drag.pendingX;
          let y = this.drag.pendingY;
          const maxX = containerRect.width - this.el.offsetWidth;
          const maxY = containerRect.height - this.el.offsetHeight;
          x = Math.max(0, Math.min(x, maxX));
          y = Math.max(0, Math.min(y, maxY));
          this.el.style.left = `${x}px`;
          this.el.style.top = `${y}px`;
          this.el.style.right = 'auto';
          this.el.style.bottom = 'auto';
        });
      }
    });

    const endDrag = () => {
      if (this.drag.active) {
        this.drag.active = false;
        if (this.drag.rafId) {
          cancelAnimationFrame(this.drag.rafId);
          this.drag.rafId = null;
        }
        this.el.classList.remove('timer-dragging');
        const rect = this.el.getBoundingClientRect();
        Storage.set(CONFIG.storageKeys.timerPosition, { x: rect.left, y: rect.top });
      }
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);

    // --- Preset buttons ---
    this.el.querySelectorAll('.timer-preset-btn:not(.timer-custom-btn):not(.timer-set-btn)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.seconds);
        if (sec > 0) {
          this.setDuration(sec);
          this.el.querySelector('.timer-custom-input')?.classList.add('hidden');
          AudioEngine.click();
        }
      });
    });

    // Custom button toggle
    const customBtn = this.el.querySelector('.timer-custom-btn');
    const customPanel = this.el.querySelector('.timer-custom-input');
    customBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      customPanel?.classList.toggle('hidden');
      AudioEngine.click();
    });

    // Custom set button
    const setBtn = this.el.querySelector('.timer-set-btn');
    setBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const minInput = this.el.querySelector('.timer-input-min');
      const secInput = this.el.querySelector('.timer-input-sec');
      const mins = Math.max(0, parseInt(minInput?.value) || 0);
      const secs = Math.max(0, Math.min(59, parseInt(secInput?.value) || 0));
      const totalSec = mins * 60 + secs;
      if (totalSec > 0) {
        this.setDuration(totalSec);
        customPanel?.classList.add('hidden');
        AudioEngine.click();
      }
    });

    // Prevent input scroll from propagating
    this.el.querySelectorAll('input[type="number"]').forEach(inp => {
      inp.addEventListener('wheel', (e) => e.stopPropagation());
      inp.addEventListener('pointerdown', (e) => e.stopPropagation());
    });

    // --- Timer controls ---
    playBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.start(); });
    pauseBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.pause(); });
    resetBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.reset(); });

    // --- Add time buttons ---
    this.el.querySelectorAll('.timer-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.dataset.add);
        if (sec > 0) this.addTime(sec);
      });
    });
  },

  setDuration(seconds) {
    this.pause();
    this.initial = seconds * 1000;
    this.remaining = this.initial;
    this.el?.classList.remove('timer-finished');
    this.updateDisplay();
    this.updateRing();
    // Highlight active preset
    this.el?.querySelectorAll('.timer-preset-btn:not(.timer-custom-btn):not(.timer-set-btn)').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.seconds) === seconds);
    });
    // Save duration to storage
    Storage.set(CONFIG.storageKeys.timerDuration, seconds);
  },

  toggle() {
    const wasHidden = !this.el || this.el.classList.contains('hidden');
    if (!this.el) this.init();
    if (wasHidden) {
      this.show();
    } else {
      this.hide();
    }
    AudioEngine.click();
  },

  show() {
    if (!this.el) this.init();
    this.el.classList.remove('hidden');
    this.el.classList.add('animate-pop-in');
    Storage.set(CONFIG.storageKeys.timerVisible, true);
    Utils.refreshIcons(this.el);
  },

  hide() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.el.classList.remove('animate-pop-in');
    Storage.set(CONFIG.storageKeys.timerVisible, false);
  },

  start() {
    if (this.running) return;
    if (this.remaining <= 0) {
      // If already at zero, reset to initial first
      this.remaining = this.initial;
      this.el?.classList.remove('timer-finished');
    }
    this.running = true;
    this.lastTick = performance.now();
    this.intervalId = setInterval(() => this.tick(), 50);
    this.updatePlayPauseUI();
    AudioEngine.click();
  },

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.updatePlayPauseUI();
    AudioEngine.click();
  },

  reset() {
    this.pause();
    this.remaining = this.initial;
    this.el?.classList.remove('timer-finished');
    this.updateDisplay();
    this.updateRing();
    AudioEngine.click();
  },

  addTime(seconds) {
    const ms = seconds * 1000;
    this.initial += ms;
    this.remaining += ms;
    this.el?.classList.remove('timer-finished');
    this.updateDisplay();
    this.updateRing();
    AudioEngine.click();
  },

  tick() {
    const now = performance.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    this.remaining = Math.max(0, this.remaining - delta);
    this.updateDisplay();
    this.updateRing();

    if (this.remaining <= 0) {
      this.running = false;
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.updatePlayPauseUI();
      this.onTimerComplete();
    }
  },

  updateDisplay() {
    const totalSeconds = Math.ceil(this.remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const display = this.el?.querySelector('.timer-display');
    if (!display) return;

    if (hours > 0) {
      display.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  },

  updateRing() {
    const fg = this.el?.querySelector('.timer-ring-fg');
    if (!fg) return;
    const circumference = 2 * Math.PI * 34; // r=34
    const fraction = this.initial > 0 ? this.remaining / this.initial : 0;
    const offset = circumference * (1 - fraction);
    fg.style.strokeDasharray = `${circumference}`;
    fg.style.strokeDashoffset = `${offset}`;
  },

  onTimerComplete() {
    this.el?.classList.add('timer-finished');
    this.playAlarm();
    // Auto-stop flashing after 8 seconds
    if (this.alarmTimeout) clearTimeout(this.alarmTimeout);
    this.alarmTimeout = setTimeout(() => {
      this.el?.classList.remove('timer-finished');
    }, 8000);
  },

  playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (time, freq, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
        osc.start(time);
        osc.stop(time + dur);
      };
      const now = ctx.currentTime;
      // Play a triple-beep alarm pattern
      playBeep(now, 880, 0.15);
      playBeep(now + 0.2, 880, 0.15);
      playBeep(now + 0.4, 1100, 0.3);
      playBeep(now + 0.9, 880, 0.15);
      playBeep(now + 1.1, 880, 0.15);
      playBeep(now + 1.3, 1100, 0.3);
    } catch (e) {
      // Silently fail if audio context not available
    }
  },

  updatePlayPauseUI() {
    if (!this.el) return;
    const playBtn = this.el.querySelector('.timer-play');
    const pauseBtn = this.el.querySelector('.timer-pause');
    if (playBtn) playBtn.classList.toggle('hidden', this.running);
    if (pauseBtn) pauseBtn.classList.toggle('hidden', !this.running);
    this.el.classList.toggle('running', this.running);
  }
};


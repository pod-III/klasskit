// KlassKit Hub — Core Config, State, Storage, Audio, Theme & Tooltips

// ============================================
// REFACTORED script.js - KlassKit Hub
// Optimized for performance, reduced redundancy
// ============================================

// --- CONSTANTS & CONFIG ---
const CONFIG = {
  helpUrl: "https://forms.gle/VRqg4f3KFHoJXFUu9",
  dataSource: "games.json",
  maxRecentGames: 5,
  maxTabs: 20,
  debounceDelay: 300,
  loadTimeout: 5000,
  storageKeys: {
    theme: "theme_hub",
    recent: "recentGameIds",
    sound: "soundMuted",
    favorites: "favoriteGames",
    tabs: "openTabs",
    tabGroups: "tabGroups",
    pinned: "pinnedGameIds",
    homeView: "klasskit_homeView",
    viewMode: "klasskit_viewMode",
    lastReadAnn: "klasskit_lastReadAnn",
    recentCollapsed: "klasskit_recentCollapsed",
    timerVisible: "klasskit_timerVisible",
    timerPosition: "klasskit_timerPosition",
    timerDuration: "klasskit_timerDuration"
  }
};

// --- UTILITIES ---
const Utils = {
  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  getColorClass(colorName, prefix = 'bg') {
    const baseColor = colorName.replace('text-', '').split('-')[0];
    const colorMap = {
      pink: `${prefix}-pink`,
      orange: `${prefix}-orange`,
      green: `${prefix}-green`,
      blue: `${prefix}-blue`,
      red: `${prefix}-red-500`,
      slate: `${prefix}-slate-500`
    };
    return colorMap[baseColor] || `${prefix}-dark dark:${prefix}-slate-700`;
  },

  _iconRefreshPending: false,
  refreshIcons(container) {
    if (this._iconRefreshPending) return;
    this._iconRefreshPending = true;
    requestAnimationFrame(() => {
      this._iconRefreshPending = false;
      if (container && window.lucide?.createIcons) {
        // Scoped refresh — only process icons within the given container
        window.lucide.createIcons({ nodes: container.querySelectorAll('[data-lucide]') });
      } else {
        window.lucide?.createIcons?.();
      }
    });
  }
};

// --- STATE MANAGEMENT ---
const State = {
  games: [],
  gameMap: new Map(), // O(1) lookup by ID
  activeGame: null,
  metadata: null,
  userProfile: null,
  filters: { category: 'all', searchTerm: '', difficulty: 'all', tags: [] },

  isPro() {
    return this.userProfile?.role === 'pro' || this.userProfile?.role === 'admin';
  },

  isAdmin() {
    return this.userProfile?.role === 'admin';
  },

  setGames(data) {
    const gamesList = data.games || data;
    this.games = gamesList.sort((a, b) => a.title.localeCompare(b.title));
    // Build lookup map
    this.gameMap.clear();
    for (const game of this.games) {
      this.gameMap.set(game.id, game);
    }
    if (data.metadata) this.metadata = data.metadata;
  },

  getFilteredGames() {
    const { category, searchTerm, difficulty, tags } = this.filters;
    const searchLower = searchTerm.toLowerCase().trim();

    return this.games
      .filter(game => {
        if (game.active === false) return false;
        
        // Privilege Check: Hide pro games if user is not pro
        if (game.pro && !this.isPro()) return false;
        
        // Admin Check: Hide admin-only games if user is not admin
        if (game.adminOnly && !this.isAdmin()) return false;

        const matchesCategory = category === 'all' ||
          (category === 'featured' ? game.featured === true : game.category === category);
        const matchesDifficulty = difficulty === 'all' || !game.difficulty || game.difficulty === difficulty;
        const matchesTags = tags.length === 0 || game.tags?.some(tag => tags.includes(tag));

        // Basic Filter
        if (!matchesCategory || !matchesDifficulty || !matchesTags) return false;

        // Search Filter
        if (!searchLower) return true;

        const title = game.title.toLowerCase();
        const description = (game.description || "").toLowerCase();
        const cat = game.category.toLowerCase();

        return title.includes(searchLower) ||
          description.includes(searchLower) ||
          cat.includes(searchLower) ||
          (searchLower === 'new' && game.new) ||
          game.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      })
      .sort((a, b) => {
        if (searchLower) {
          // Compute scores inline to avoid creating new objects
          const scoreA = this._searchScore(a, searchLower);
          const scoreB = this._searchScore(b, searchLower);
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
        return a.title.localeCompare(b.title);
      });
  },

  _searchScore(game, term) {
    const title = game.title.toLowerCase();
    let score = 0;
    if (title === term) score += 100;
    else if (title.startsWith(term)) score += 80;
    else if (title.includes(term)) score += 60;
    if ((game.description || '').toLowerCase().includes(term)) score += 40;
    if (game.category.toLowerCase().includes(term)) score += 30;
    if (game.tags?.some(tag => tag.toLowerCase().includes(term))) score += 20;
    return score;
  },

  getGameById(id) {
    return this.gameMap.get(id) || null;
  }
};

// --- STORAGE ---
const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.warn(`Storage read error for "${key}":`, error);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));

      // If this is a hub key, trigger a cloud save in background
      const hubKeys = Object.values(CONFIG.storageKeys);
      if (hubKeys.includes(key)) {
        this.triggerCloudSave();
      }
      return true;
    } catch (error) {
      console.error(`Storage write error for "${key}":`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      const hubKeys = Object.values(CONFIG.storageKeys);
      if (hubKeys.includes(key)) {
        this.triggerCloudSave();
      }
    } catch (error) {
      console.error(`Storage remove error for "${key}":`, error);
    }
  },

  _saveTimeout: null,
  triggerCloudSave() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(async () => {
      if (typeof isSandbox === 'function' && isSandbox()) return;
      const user = await getUser();
      if (!user) return;

      const hubState = {};
      Object.keys(CONFIG.storageKeys).forEach(keyName => {
        const key = CONFIG.storageKeys[keyName];
        const val = this.get(key);
        if (val !== null) hubState[key] = val;
      });

      console.log('[CloudPersistence] Saving hub state...', hubState);
      await saveProgress('klasskit_hub', hubState);
    }, 2000); // Debounce to avoid excessive writes
  },

  async syncWithCloud() {
    if (typeof isSandbox === 'function' && isSandbox()) return;
    const user = await getUser();
    if (!user) return;

    console.log('[CloudPersistence] Syncing with cloud...');
    const cloudHubState = await loadProgress('klasskit_hub');

    if (cloudHubState) {
      console.log('[CloudPersistence] Found cloud state:', cloudHubState);
      let changed = false;
      Object.keys(cloudHubState).forEach(key => {
        const localVal = localStorage.getItem(key);
        const cloudVal = JSON.stringify(cloudHubState[key]);
        if (localVal !== cloudVal) {
          localStorage.setItem(key, cloudVal);
          changed = true;
        }
      });
      return changed;
    }
    return false;
  }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
  ctx: null,
  muted: false,

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.muted = Storage.get(CONFIG.storageKeys.sound, false);
      this.updateUI();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  },

  playTone(freq, type, duration) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (error) {
      console.warn('Audio error:', error);
    }
  },

  hover() { this.playTone(400, 'sine', 0.1); },
  click() { this.playTone(600, 'square', 0.15); },

  toggle() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.muted = !this.muted;
    Storage.set(CONFIG.storageKeys.sound, this.muted);
    this.updateUI();
  },

  updateUI() {
    const config = this.muted
      ? { icon: 'volume-x', color: 'rgb(248 113 113)' }
      : { icon: 'volume-2', color: 'rgb(74 222 128)' };
    document.querySelectorAll('#sound-btn-icon, .sound-btn-icon').forEach(icon => {
      icon.setAttribute('data-lucide', config.icon);
      icon.style.color = config.color;
    });
    Utils.refreshIcons();
  }
};

// --- THEME ---
const Theme = {
  load() {
    const saved = Storage.get(CONFIG.storageKeys.theme);
    const isDark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  },

  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    Storage.set(CONFIG.storageKeys.theme, isDark ? 'dark' : 'light');
    AudioEngine.click();
  }
};

// --- UI ---
const FloatingTooltip = {
  el: null,
  _lastTouchTime: 0,

  init() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'floating-tooltip';
    // Use tailwind classes for the Soft Brutalist look
    this.el.className = 'fixed pointer-events-none z-[9999] opacity-0 transition-opacity duration-200 px-3 py-2 bg-slate-900 text-white text-xs font-black rounded-xl border-2 border-slate-700 shadow-hard-sm uppercase tracking-widest whitespace-nowrap';
    document.body.appendChild(this.el);

    this.setupListeners();
  },

  setupListeners() {
    document.addEventListener('touchstart', () => {
      this._lastTouchTime = Date.now();
      this.hide();
    }, { passive: true });

    document.addEventListener('mouseover', (e) => {
      if (Date.now() - this._lastTouchTime < 600) return;
      const target = e.target.closest('[data-title]');
      // Only for side-panel elements as requested
      if (target && (target.closest('#side-panel') || target.closest('#game-modal') || target.classList.contains('side-panel-tab'))) {
        const title = target.getAttribute('data-title');
        if (title) {
          this.show(title, e.clientX, e.clientY);
          return;
        }
      }
      
      // If we move over anything else, hide the tooltip
      if (this.el && this.el.classList.contains('opacity-100')) {
        this.hide();
      }
    });

    document.addEventListener('focusin', (e) => {
      const target = e.target.closest('[data-title]');
      if (target && (target.closest('#side-panel') || target.closest('#game-modal') || target.classList.contains('side-panel-tab'))) {
        const title = target.getAttribute('data-title');
        if (title) {
          const rect = target.getBoundingClientRect();
          this.show(title, rect.right, rect.top + rect.height / 2);
        }
      }
    });

    document.addEventListener('focusout', () => this.hide());

    document.addEventListener('mousemove', (e) => {
      if (this.el && this.el.classList.contains('opacity-100')) {
        this.move(e.clientX, e.clientY);
      }
    });

    document.addEventListener('mouseout', (e) => {
      // Hide if mouse leaves the window entirely
      if (!e.relatedTarget) {
        this.hide();
      }
    });

    // Hide on any interaction that might change the DOM or focus
    document.addEventListener('mousedown', () => this.hide());
    window.addEventListener('blur', () => this.hide());
    window.addEventListener('scroll', () => this.hide(), true);
  },

  show(text, x, y) {
    this.el.textContent = text;
    this.move(x, y);
    this.el.classList.add('opacity-100');
  },

  move(x, y) {
    // Offset to avoid cursor overlap
    const offsetX = 20;
    const offsetY = -10;
    
    // Boundary check to keep it on screen
    const rect = this.el.getBoundingClientRect();
    let finalX = x + offsetX;
    let finalY = y + offsetY;

    if (finalX + rect.width > window.innerWidth) {
      finalX = x - rect.width - offsetX;
    }
    if (finalY + rect.height > window.innerHeight) {
      finalY = window.innerHeight - rect.height - 10;
    }

    this.el.style.left = `${finalX}px`;
    this.el.style.top = `${finalY}px`;
  },

  hide() {
    this.el.classList.remove('opacity-100');
  }
};


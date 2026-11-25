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
    colorTheme: "klasskit_colorTheme",
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
    timerDuration: "klasskit_timerDuration",
    librarySort: "klasskit_librarySort",
    reduceMotion: "klasskit_reduceMotion",
    defaultHome: "klasskit_defaultHome",
    showRecent: "klasskit_showRecent",
    autoExpandGroup: "klasskit_autoExpandGroup",
    tabHistory: "kk_tab_history"
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
  _pendingContainers: new Set(),
  refreshIcons(container) {
    this._pendingContainers.add(container || document);
    if (this._iconRefreshPending) return;
    this._iconRefreshPending = true;
    requestAnimationFrame(() => {
      this._iconRefreshPending = false;
      const containers = Array.from(this._pendingContainers);
      this._pendingContainers.clear();
      if (!window.lucide?.createIcons) return;
      if (containers.includes(document)) {
        window.lucide.createIcons();
      } else {
        containers.forEach(c => {
          if (c && typeof c.querySelectorAll === 'function') {
            window.lucide.createIcons({ nodes: c.querySelectorAll('[data-lucide]') });
          }
        });
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
  filters: { category: 'all', searchTerm: '', difficulty: 'all', quickFilter: 'all', sort: 'az', tags: [] },

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
      const serialized = JSON.stringify(value);
      if (localStorage.getItem(key) === serialized) {
        return true;
      }
      localStorage.setItem(key, serialized);

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
  cancelPendingCloudSave() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
  },
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
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.muted = !this.muted;
    Storage.set(CONFIG.storageKeys.sound, this.muted);
    this.updateUI();
    window.SettingsModal?.syncControls?.();
  },

  updateUI() {
    const config = this.muted
      ? { icon: 'volume-x', color: 'rgb(248 113 113)' }
      : { icon: 'volume-2', color: 'rgb(74 222 128)' };
    document.querySelectorAll('#sound-btn-icon, .sound-btn-icon').forEach(node => {
      const fresh = document.createElement('i');
      if (node.id) fresh.id = node.id;
      fresh.setAttribute('data-lucide', config.icon);
      fresh.setAttribute('class', node.getAttribute('class') || '');
      fresh.setAttribute('aria-hidden', 'true');
      fresh.style.color = config.color;
      node.replaceWith(fresh);
    });
    Utils.refreshIcons();
  }
};

// --- THEME ---
const Theme = {
  colorThemes: [
    {
      id: 'classic',
      label: 'Classic',
      swatches: ['#ff4785', '#ff7e33', '#00d063', '#1ea7fd']
    },
    {
      id: 'pastel',
      label: 'Pastel',
      swatches: ['#fb7185', '#fbbf24', '#34d399', '#60a5fa']
    },
    {
      id: 'botanical',
      label: 'Botanical',
      swatches: ['#e07a5f', '#e09f3e', '#2a9d8f', '#5e60ce']
    },
    {
      id: 'oceanic',
      label: 'Oceanic',
      swatches: ['#6366f1', '#f59e0b', '#14b8a6', '#0ea5e9']
    },
    {
      id: 'monochrome',
      label: 'Ink & Paper',
      swatches: ['#ff4785', '#475569', '#334155', '#1e293b']
    }
  ],

  load() {
    const saved = Storage.get(CONFIG.storageKeys.theme);
    const isDark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    this.loadColorTheme();
  },

  setDark(isDark) {
    const nextDark = Boolean(isDark);
    document.documentElement.classList.toggle('dark', nextDark);
    Storage.set(CONFIG.storageKeys.theme, nextDark ? 'dark' : 'light');
    this.syncAllIframes();
    window.SettingsModal?.syncControls?.();
  },

  toggle() {
    this.setDark(!document.documentElement.classList.contains('dark'));
    AudioEngine.click();
  },

  getColorTheme() {
    const saved = Storage.get(CONFIG.storageKeys.colorTheme, 'classic');
    return this.colorThemes.some(t => t.id === saved) ? saved : 'classic';
  },

  loadColorTheme() {
    const themeId = this.getColorTheme();
    if (themeId === 'classic') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
    }
  },

  setColorTheme(themeId) {
    const valid = this.colorThemes.some(t => t.id === themeId) ? themeId : 'classic';
    Storage.set(CONFIG.storageKeys.colorTheme, valid);
    this.loadColorTheme();
    this.syncAllIframes();
    window.SettingsModal?.syncControls?.();
  },

  syncToIframe(iframe) {
    if (!iframe) return;
    const isDark = document.documentElement.classList.contains('dark');
    const colorTheme = this.getColorTheme();
    try {
      const root = iframe.contentDocument?.documentElement;
      if (root) {
        root.classList.toggle('dark', isDark);
        if (colorTheme === 'classic') {
          root.removeAttribute('data-theme');
        } else {
          root.setAttribute('data-theme', colorTheme);
        }
      }
    } catch (_) {}
    try {
      iframe.contentWindow?.postMessage(
        { type: 'klasskit:theme-sync', dark: isDark, colorTheme },
        window.location.origin
      );
    } catch (_) {}
  },

  syncAllIframes() {
    document.querySelectorAll('#tab-content-area iframe, #myspace-iframe').forEach(iframe => {
      this.syncToIframe(iframe);
    });
  }
};

// --- HUB SETTINGS (EXTENSIBLE REGISTRY) ---
const HubSettings = {
  defaults: {
    reduceMotion: false,
    defaultHome: 'auto',
    librarySort: 'az',
    showRecent: true,
    autoExpandGroup: true
  },

  get(key) {
    const fallback = Object.prototype.hasOwnProperty.call(this.defaults, key) ? this.defaults[key] : null;
    const storageKey = CONFIG.storageKeys[key];
    if (!storageKey) return fallback;
    const val = Storage.get(storageKey, fallback);
    return val === null || val === undefined ? fallback : val;
  },

  set(key, value) {
    const storageKey = CONFIG.storageKeys[key];
    if (!storageKey) return false;
    const saved = Storage.set(storageKey, value);
    this.applySetting(key);
    return saved;
  },

  applySetting(key) {
    if (key === 'reduceMotion') {
      if (document.body) {
        document.body.classList.toggle('hub-reduce-motion', Boolean(this.get('reduceMotion')));
      }
    } else if (key === 'librarySort') {
      const savedSort = this.get('librarySort');
      if (savedSort && State?.filters) {
        State.filters.sort = savedSort;
      }
      if (typeof LibraryFilters !== 'undefined' && LibraryFilters.syncToolbarUI) {
        LibraryFilters.syncToolbarUI();
      }
      if (typeof ViewManager !== 'undefined' && ViewManager.renderAllGrids) {
        ViewManager.renderAllGrids();
      }
    } else if (key === 'showRecent') {
      if (typeof RecentGames !== 'undefined' && RecentGames.render) {
        RecentGames.render();
      }
    }
    window.SettingsModal?.syncControls?.();
  },

  applyAll({ render = true } = {}) {
    if (document.body) {
      document.body.classList.toggle('hub-reduce-motion', Boolean(this.get('reduceMotion')));
    }
    const savedSort = this.get('librarySort');
    if (savedSort && State?.filters) {
      State.filters.sort = savedSort;
    }
    if (render) {
      if (typeof RecentGames !== 'undefined' && RecentGames.render) {
        RecentGames.render();
      }
      if (typeof ViewManager !== 'undefined' && ViewManager.renderAllGrids) {
        ViewManager.renderAllGrids();
      }
    }
    if (typeof LibraryFilters !== 'undefined' && LibraryFilters.syncToolbarUI) {
      LibraryFilters.syncToolbarUI();
    }
    window.SettingsModal?.syncControls?.();
  },

  resetAll() {
    Object.keys(this.defaults).forEach(key => {
      const storageKey = CONFIG.storageKeys[key];
      if (storageKey) Storage.set(storageKey, this.defaults[key]);
    });
    if (State?.filters) {
      State.filters.quickFilter = 'all';
      State.filters.difficulty = 'all';
      State.filters.sort = this.defaults.librarySort;
    }
    if (typeof ViewMode !== 'undefined' && ViewMode.set) {
      ViewMode.set('icons');
    }
    if (typeof Theme !== 'undefined' && Theme.setColorTheme) {
      Theme.setColorTheme('classic');
    }
    Storage.set(CONFIG.storageKeys.timerDuration, 300);
    if (typeof Timer !== 'undefined' && !Timer.running && Timer.setDuration) {
      Timer.setDuration(300);
    }
    this.applyAll();
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Hub settings reset to defaults', 'success');
    }
  },

  sections: [
    {
      id: 'appearance',
      label: 'Appearance',
      icon: 'sun',
      color: 'blue',
      description: 'Customize theme, grid density, and motion preferences.',
      controls: [
        {
          id: 'dark-mode',
          type: 'toggle',
          label: 'Blackboard Dark Mode',
          description: 'High-contrast OLED slate theme designed for projectors and low-light rooms.',
          get: () => document.documentElement.classList.contains('dark'),
          set: (val) => Theme.setDark(Boolean(val))
        },
        {
          id: 'color-theme',
          type: 'palette',
          label: 'Color Theme',
          badge: 'Beta',
          description: 'Switch the accent palette and surface tints across the hub.',
          options: Theme.colorThemes,
          get: () => Theme.getColorTheme(),
          set: (val) => Theme.setColorTheme(val)
        },
        {
          id: 'view-mode',
          type: 'segmented',
          label: 'Default Library Layout',
          description: 'Choose how activities are displayed across library pages.',
          options: [
            { value: 'cards', label: 'Cards', icon: 'layout-grid' },
            { value: 'icons', label: 'Icons', icon: 'grip' },
            { value: 'list', label: 'List', icon: 'list' }
          ],
          get: () => (typeof ViewMode !== 'undefined' ? ViewMode.current : 'icons'),
          set: (val) => {
            if (typeof ViewMode !== 'undefined' && ViewMode.set) ViewMode.set(val);
          }
        },
        {
          id: 'reduce-motion',
          type: 'toggle',
          label: 'Reduce Card Tilt & Motion',
          description: 'Disable 3D card tilt and entrance motion effects in the library.',
          get: () => Boolean(HubSettings.get('reduceMotion')),
          set: (val) => HubSettings.set('reduceMotion', Boolean(val))
        }
      ]
    },
    {
      id: 'library',
      label: 'Library & Tabs',
      icon: 'layout-grid',
      color: 'green',
      description: 'Control startup view, default sorting, and workspace tab group behavior.',
      controls: [
        {
          id: 'default-home',
          type: 'select',
          label: 'Default Startup View',
          description: 'Choose which Hub page opens first when launching KlassKit.',
          options: [
            { value: 'auto', label: 'Smart Auto (Remember Last)' },
            { value: 'landing', label: 'Hub Home' },
            { value: 'library-all', label: 'All Activities' },
            { value: 'library-game', label: 'Classroom Games' },
            { value: 'library-tool', label: 'Teaching Tools' },
            { value: 'library-printable', label: 'Printables' }
          ],
          get: () => HubSettings.get('defaultHome'),
          set: (val) => HubSettings.set('defaultHome', val)
        },
        {
          id: 'library-sort',
          type: 'select',
          label: 'Default Library Sort',
          description: 'Default ordering applied to activity grids.',
          options: [
            { value: 'az', label: 'Name (A–Z)' },
            { value: 'za', label: 'Name (Z–A)' },
            { value: 'recent', label: 'Recently Used' },
            { value: 'pinned', label: 'Pinned First' }
          ],
          get: () => HubSettings.get('librarySort'),
          set: (val) => HubSettings.set('librarySort', val)
        },
        {
          id: 'show-recent',
          type: 'toggle',
          label: 'Show Recently Used Bar',
          description: 'Display quick resume pills above your pinned activities.',
          get: () => HubSettings.get('showRecent') !== false,
          set: (val) => HubSettings.set('showRecent', Boolean(val))
        },
        {
          id: 'auto-expand-group',
          type: 'toggle',
          label: 'Auto-Expand Collapsed Tab Groups',
          description: 'Automatically expand a collapsed tab group when dropping a tab into it.',
          get: () => HubSettings.get('autoExpandGroup') !== false,
          set: (val) => HubSettings.set('autoExpandGroup', Boolean(val))
        }
      ]
    },
    {
      id: 'audio',
      label: 'Audio & Timer',
      icon: 'volume-2',
      color: 'orange',
      description: 'Manage Hub sound effects and default universal countdown timer.',
      controls: [
        {
          id: 'ui-sound',
          type: 'toggle',
          label: 'Hub UI Sound Effects',
          description: 'Play subtle tactile audio feedback when clicking Hub controls.',
          get: () => !AudioEngine.muted,
          set: (val) => {
            const shouldMute = !val;
            if (AudioEngine.muted !== shouldMute) AudioEngine.toggle();
          }
        },
        {
          id: 'timer-duration',
          type: 'segmented',
          label: 'Default Timer Preset',
          description: 'Initial duration when opening the floating workspace timer.',
          options: [
            { value: '60', label: '1m' },
            { value: '120', label: '2m' },
            { value: '180', label: '3m' },
            { value: '300', label: '5m' },
            { value: '600', label: '10m' }
          ],
          get: () => String(Storage.get(CONFIG.storageKeys.timerDuration, 300) || 300),
          set: (val) => {
            const secs = parseInt(val, 10) || 300;
            Storage.set(CONFIG.storageKeys.timerDuration, secs);
            if (typeof Timer !== 'undefined' && !Timer.running && Timer.setDuration) {
              Timer.setDuration(secs);
            }
          }
        }
      ]
    },
    {
      id: 'data',
      label: 'Data & Controls',
      icon: 'database',
      color: 'pink',
      description: 'Manage media storage, workspace tab groups, and Hub preferences.',
      controls: [
        {
          id: 'manage-media',
          type: 'action',
          label: 'Media & Cloud Storage',
          description: 'Inspect or clean up uploaded images and local assets.',
          buttonLabel: 'Manage',
          icon: 'folder-kanban',
          tone: 'blue',
          onClick: () => {
            window.SettingsModal?.close?.();
            if (typeof MediaManager !== 'undefined' && MediaManager.open) MediaManager.open();
          }
        },
        {
          id: 'clear-recent',
          type: 'action',
          label: 'Clear Recent Activities',
          description: 'Remove quick-resume chips from the Recently Used bar.',
          buttonLabel: 'Clear',
          icon: 'clock',
          tone: 'orange',
          onClick: () => {
            if (typeof RecentGames !== 'undefined' && RecentGames.clear) RecentGames.clear();
            if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('Recent activities cleared', 'success');
          }
        },
        {
          id: 'ungroup-tabs',
          type: 'action',
          label: 'Ungroup All Workspace Tabs',
          description: 'Keep all open activity tabs running while removing tab groups.',
          buttonLabel: 'Ungroup',
          icon: 'folder-minus',
          tone: 'slate',
          onClick: () => {
            if (typeof TabManager !== 'undefined' && TabManager.ungroupAllTabs) TabManager.ungroupAllTabs();
          }
        },
        {
          id: 'reset-settings',
          type: 'action',
          label: 'Reset Hub Settings',
          description: 'Restore layout, sort, timer preset, and workspace preferences to defaults.',
          buttonLabel: 'Reset',
          icon: 'rotate-ccw',
          tone: 'pink',
          onClick: async () => {
            const ok = typeof showConfirmModal === 'function'
              ? await showConfirmModal('Reset all Hub settings to their defaults?', {
                  title: 'Reset Settings?',
                  confirmText: 'Reset',
                  cancelText: 'Keep',
                  icon: 'rotate-ccw',
                  iconColor: 'red'
                })
              : true;
            if (ok) HubSettings.resetAll();
          }
        }
      ]
    }
  ],

  registerSection(sectionDef) {
    if (!sectionDef || !sectionDef.id) return;
    const existing = this.sections.find(s => s.id === sectionDef.id);
    if (existing) {
      Object.assign(existing, {
        ...sectionDef,
        controls: Array.isArray(sectionDef.controls) ? sectionDef.controls : existing.controls
      });
    } else {
      this.sections.push({
        icon: 'sliders-horizontal',
        color: 'blue',
        description: '',
        controls: [],
        ...sectionDef
      });
    }
    window.SettingsModal?.renderNav?.();
    window.SettingsModal?.renderControls?.();
  },

  registerControl(sectionId, controlDef) {
    if (!sectionId || !controlDef || !controlDef.id) return;
    let section = this.sections.find(s => s.id === sectionId);
    if (!section) {
      section = {
        id: sectionId,
        label: sectionId.charAt(0).toUpperCase() + sectionId.slice(1),
        icon: 'sliders-horizontal',
        color: 'blue',
        description: '',
        controls: []
      };
      this.sections.push(section);
      window.SettingsModal?.renderNav?.();
    }
    const existingIdx = section.controls.findIndex(c => c.id === controlDef.id);
    if (existingIdx >= 0) {
      section.controls[existingIdx] = controlDef;
    } else {
      section.controls.push(controlDef);
    }
    window.SettingsModal?.renderControls?.();
  }
};
window.HubSettings = HubSettings;

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

window.HubStorage = Storage;


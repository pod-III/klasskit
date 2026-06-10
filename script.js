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
        if (game.adminOnly && this.userProfile?.role !== 'admin') return false;

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
    const icon = document.getElementById('sound-btn-icon');
    if (!icon) return;
    const config = this.muted
      ? { icon: 'volume-x', color: 'rgb(248 113 113)' }
      : { icon: 'volume-2', color: 'rgb(74 222 128)' };
    icon.setAttribute('data-lucide', config.icon);
    icon.style.color = config.color;
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
    document.addEventListener('mouseover', (e) => {
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

const UI = {
  updateGreeting() {
    const hour = new Date().getHours();
    let greeting = "";

    if (hour < 12) greeting = "Good Morning, Teacher! ☕";
    else if (hour < 15) greeting = "Good Afternoon! ☀️";
    else if (hour < 18) greeting = "Almost the weekend? 🍎";
    else greeting = "Good Evening! 🌙";

    document.querySelectorAll(".greeting-display").forEach(el => {
      el.textContent = greeting;
    });

    const dateEl = document.getElementById("date-display");
    if (dateEl) {
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric"
      });
      dateEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dateStr}`;
    }

    this.updateDailyTip();
  },

  updateUserUI() {
    const profile = State.userProfile;
    if (!profile) return;

    const nameEl = document.getElementById('auth-username');
    const adminLink = document.getElementById('auth-admin-link');
    const loggedIn = document.getElementById('auth-logged-in');
    const signinLink = document.getElementById('auth-signin-link');

    if (nameEl) nameEl.textContent = profile.display_name || 'Teacher';
    if (loggedIn) loggedIn.classList.remove('hidden');
    if (signinLink) signinLink.classList.add('hidden');

    // Show Admin Link and WIP apps
    if (profile.role === 'admin') {
      if (adminLink) adminLink.classList.remove('hidden');
      const wipBtn = document.getElementById('nav-wip-btn');
      if (wipBtn) wipBtn.classList.remove('hidden');
    }

    // Add Pro Badge to Name if Pro/Admin
    if (State.isPro()) {
      const editBtn = document.getElementById('auth-edit-name-btn');
      if (editBtn && !document.getElementById('pro-badge')) {
        const badge = document.createElement('span');
        badge.id = 'pro-badge';
        badge.className = 'ml-1.5 px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[9px] font-black text-white rounded-md shadow-sm animate-pop-in';
        badge.textContent = 'PRO';
        nameEl.after(badge);
      }

      // Show pro-only cards on landing page
      document.querySelectorAll('.pro-only-card').forEach(card => {
        card.classList.remove('hidden');
      });
    }
  },

  updateDailyTip() {
    const tips = [
      'Use shortcut "/" to quickly search the library!',
      'Press Alt+H to quickly return Home while in a tool.',
      'Pin your Most Used items to keep them at the top.',
      'Tap the Moon icon to switch to Dark Mode for projectors.',
      'Need focus? Hit the maximize button in the side panel for full-screen!',
      'Keep everything tidy: use the trash icon to close all running tabs.'
    ];
    // Seed random tip based on current day to act as a "Daily" tip
    const today = new Date().getDate();
    const tipIndex = today % tips.length;
    const tipEl = document.getElementById('daily-tip');
    if (tipEl) tipEl.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-yellow-300"></i> Tip: ${tips[tipIndex]}`;
  },



  showError(message) {
    const grid = document.getElementById('games-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="col-span-full text-center p-10">
        <div class="inline-block bg-red-100 dark:bg-red-900 border-4 border-red-500 rounded-2xl p-8">
          <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
          <p class="text-xl font-bold text-red-700 dark:text-red-300">${message}</p>
        </div>
      </div>
    `;
    Utils.refreshIcons();
  },

  showLoading() {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    let skeletons = '';
    for (let i = 0; i < 8; i++) {
      skeletons += `
        <div class="skeleton-card skeleton animate-pop-in" style="animation-delay: ${i * 0.05}s"></div>
      `;
    }
    grid.innerHTML = skeletons;
  },

  toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.setAttribute('aria-hidden', String(!show));
    if (modalId === 'game-modal') {
      document.body.style.overflow = show ? 'hidden' : '';
      document.body.classList.toggle('game-modal-open', show);
    }
  },

  toggleFocus() {
    AudioEngine.click();
    document.body.classList.toggle('focus-mode');

    // Attempt to resize or trigger a window resize event so games adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  },

  toggleSettings() {
    AudioEngine.click();
    const menu = document.getElementById('settings-menu');
    const container = document.getElementById('settings-container');
    if (!menu || !container) return;

    const isClosed = menu.classList.contains('opacity-0');

    menu.classList.toggle('opacity-0', !isClosed);
    menu.classList.toggle('pointer-events-none', !isClosed);
    menu.classList.toggle('translate-y-4', !isClosed);
    menu.classList.toggle('translate-y-0', isClosed);

    const icon = container.querySelector('[data-action="toggleSettings"] i');
    if (icon) icon.classList.toggle('rotate-90', isClosed);
  },

  showToast(message, type = 'warning', duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      warning: 'alert-triangle',
      info: 'info',
      success: 'check-circle',
      error: 'x-circle'
    };

    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);
    Utils.refreshIcons();

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Spatial Expansion Animation: Opens modal from the clicked element's position
   */
  animateModalOpen(element, modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !element) {
      this.toggleModal(modalId, true);
      return;
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    modal.style.display = 'block';
    modal.classList.remove('hidden');
    modal.style.clipPath = `circle(0% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '0';
    modal.style.transition = 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';

    // Force reflow
    modal.offsetHeight;

    modal.style.clipPath = `circle(150% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '1';

    document.body.style.overflow = 'hidden';
    if (modalId === 'game-modal') document.body.classList.add('game-modal-open');

    setTimeout(() => {
      modal.style.clipPath = '';
      modal.style.transition = '';
    }, 600);
  }
};

// --- HERO BANNER ---
const Hero = {
  headings: [
    "Let's start teaching",
    "Ready to inspire?",
    "Make learning fun",
    "Time to teach!",
    "Spark curiosity today",
    "Learning starts here",
    "Build great lessons"
  ],

  updateHeading() {
    const el = document.getElementById('hero-heading');
    if (!el) return;
    const today = new Date().getDate();
    el.textContent = this.headings[today % this.headings.length];
  },

  updateStats() {
    const active = State.games.filter(g => g.active !== false && (!g.pro || State.isPro()));
    const tools = active.filter(g => g.category === 'tool').length;
    const games = active.filter(g => g.category === 'game').length;
    const workshop = active.filter(g => g.category === 'workshop').length;
    const pinned = PinnedGames.get().length;

    const toolsEl = document.getElementById('stat-tools');
    const gamesEl = document.getElementById('stat-games');
    const workshopEl = document.getElementById('stat-workshop');
    const pinnedEl = document.getElementById('stat-pinned');

    if (toolsEl) toolsEl.textContent = tools;
    if (gamesEl) gamesEl.textContent = games;
    if (workshopEl) workshopEl.textContent = workshop;
    if (pinnedEl) pinnedEl.textContent = pinned;
  },

  updateContinueBtn() {
    const btns = document.querySelectorAll('.continue-btn');
    const recentIds = RecentGames.get();

    if (recentIds.length === 0) {
      btns.forEach(btn => btn.classList.add('hidden'));
      return;
    }

    const lastGame = State.getGameById(recentIds[0]);
    if (!lastGame) {
      btns.forEach(btn => btn.classList.add('hidden'));
      return;
    }

    btns.forEach(btn => {
      btn.classList.remove('hidden');
      btn.dataset.param = lastGame.id;
      const label = btn.querySelector('.continue-label');
      if (label) label.textContent = `Continue: ${lastGame.title}`;
    });
  },

  surpriseMe() {
    AudioEngine.click();
    const active = State.games.filter(g => g.active !== false);
    if (active.length === 0) return;
    const random = active[Math.floor(Math.random() * active.length)];
    GameModal.open(random.id);
  },

  init() {
    this.updateHeading();
    this.updateStats();
    this.updateContinueBtn();
    Announcements.init();
    StorageManager.init();
    HistoryManager.init();
  }
};

// --- STORAGE MANAGER ---
const StorageManager = {
  async init() {
    const user = await getUser();
    if (!user) return;

    document.getElementById('storage-badge')?.classList.remove('hidden');
    await this.update();
  },

  async update() {
    try {
      const usage = await getUserStorageUsage();
      this.render(usage);
      
      // Quota check (80%) - skip for sandbox
      if (!usage.isSandbox && usage.percent >= 80) {
        const lastWarned = localStorage.getItem('kk_quota_warned_at');
        const now = Date.now();
        // Warn once every 24h
        if (!lastWarned || (now - parseInt(lastWarned)) > 24 * 60 * 60 * 1000) {
          UI.showToast(`Storage Quota: ${usage.percent}% used. Consider cleaning up old images.`, 'warning', 5000);
          localStorage.setItem('kk_quota_warned_at', now.toString());
        }
      }
    } catch (err) {
      console.warn('[StorageManager] Update error:', err);
    }
  },

  render(usage) {
    const textEl = document.getElementById('storage-text');
    const barEl = document.getElementById('storage-bar');
    if (!textEl || !barEl) return;

    const usedMB = (usage.used / (1024 * 1024)).toFixed(1);
    
    if (usage.isSandbox) {
        textEl.textContent = `${usedMB} MB Used (Local)`;
        barEl.style.width = `${usage.percent}%`;
        barEl.classList.remove('bg-blue', 'bg-orange', 'bg-red-500');
        barEl.classList.add('bg-slate-300');
    } else {
        textEl.textContent = `${usage.percent}% Storage Used`;
        barEl.style.width = `${usage.percent}%`;
        
        // Dynamic Color Triage
        barEl.classList.remove('bg-blue', 'bg-orange', 'bg-pink', 'bg-slate-300', 'bg-green');
        if (usage.percent >= 85) {
          barEl.classList.add('bg-pink');
        } else if (usage.percent >= 60) {
          barEl.classList.add('bg-orange');
        } else {
          barEl.classList.add('bg-green');
        }
    }
  }
};

// --- ANNOUNCEMENTS ---
const Announcements = {
  list: [],

  async init() {
    await this.fetch();
    this.render();
    this.renderPanel();
    this.checkNew();
  },

  async fetch() {
    try {
      const { data, error } = await db
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      this.list = data || [];
    } catch (err) {
      console.warn('[Announcements] Fetch error:', err);
      this.list = [];
    }
  },

  render() {
    const container = document.getElementById('announcement-board');
    if (!container) return;

    if (this.list.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    
    // Check for unread
    const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);
    const latestTime = new Date(this.list[0].created_at).getTime();
    const hasNew = latestTime > lastRead;

    const badge = document.getElementById('ann-new-badge');
    const headerBadge = document.getElementById('header-ann-badge');
    if (badge) badge.classList.toggle('hidden', !hasNew);
    if (headerBadge) headerBadge.classList.toggle('hidden', !hasNew);

    const listEl = document.getElementById('ann-items-list');
    if (!listEl) return;

    listEl.innerHTML = this.list.map((ann, i) => {
      const date = new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const typeColors = {
        info: 'blue',
        update: 'green',
        alert: 'orange'
      };
      const color = typeColors[ann.type] || 'blue';
      const icon = ann.type === 'alert' ? 'alert-triangle' : (ann.type === 'update' ? 'sparkles' : 'info');

      return `
        <div onclick="Announcements.viewDetail('${ann.id}')" 
          class="ann-card bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-dark dark:border-slate-600 shadow-sm hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in" 
          style="animation-delay: ${i * 0.1}s">
          
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-${color}/10 text-${color} flex items-center justify-center border-2 border-${color}/20">
                <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
              </div>
              <div>
                <span class="text-[9px] font-black text-${color} uppercase tracking-widest">${ann.type}</span>
                <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${date}</div>
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-blue transition-colors"></i>
          </div>
          
          <h4 class="text-base font-heading font-black text-dark dark:text-white mb-1.5 leading-tight group-hover:text-blue transition-colors">${ann.title}</h4>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-body font-semibold line-clamp-2">${this.formatText(ann.content).replace(/<br>/g, ' ')}</p>
        </div>
      `;
    }).join('');

    Utils.refreshIcons(listEl);
  },

  markAsRead() {
    if (this.list.length > 0) {
      const latestTime = this.list[0].created_at;
      const latestTimestamp = new Date(latestTime).getTime();
      
      // Update Local Storage (this triggers the existing Hub Cloud Sync automatically)
      Storage.set(CONFIG.storageKeys.lastReadAnn, latestTimestamp);
      
      const badge = document.getElementById('ann-new-badge');
      const headerBadge = document.getElementById('header-ann-badge');
      if (badge) badge.classList.add('hidden');
      if (headerBadge) headerBadge.classList.add('hidden');
    }
  },

  checkNew() {
    if (this.list.length > 0) {
      const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);
      const latestTime = new Date(this.list[0].created_at).getTime();
      if (latestTime > lastRead) {
        UI.showToast(`New announcement: ${this.list[0].title}`, 'info', 5000);
      }
    }
  },

  renderPanel() {
    const listEl = document.getElementById('panel-ann-list');
    if (!listEl) return;

    if (this.list.length === 0) {
      listEl.innerHTML = '<div class="text-center p-12 text-slate-500 font-bold">No notifications yet.</div>';
      return;
    }

    const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);

    listEl.innerHTML = this.list.map((ann, i) => {
      const date = new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const typeColors = {
        info: 'blue',
        update: 'green',
        alert: 'orange'
      };
      const color = typeColors[ann.type] || 'blue';
      const isUnread = new Date(ann.created_at).getTime() > lastRead;
      const statusIcon = isUnread ? 'mail' : 'mail-open';
      const statusColor = isUnread ? 'text-blue' : 'text-slate-400';

      return `
        <div onclick="Announcements.viewDetail('${ann.id}')" 
          class="p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dark dark:border-slate-700 hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in relative overflow-hidden shadow-sm hover:shadow-md"
          style="animation-delay: ${i * 0.05}s">
          
          ${isUnread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-blue rounded-bl-lg"></div>' : ''}
          
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${ann.type}</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
          </div>
          
          <h4 class="text-lg font-heading font-black text-dark dark:text-white mb-2 group-hover:text-blue transition-colors leading-tight">${ann.title}</h4>
          <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold line-clamp-2">${this.formatText(ann.content).replace(/<br>/g, ' ')}</p>
          
          <div class="mt-4 flex items-center gap-1 text-[10px] font-black text-blue uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Read More</span>
            <i data-lucide="chevron-right" class="w-3 h-3"></i>
          </div>
        </div>
      `;
    }).join('');
    Utils.refreshIcons(listEl);
  },

  viewDetail(annId) {
    const ann = this.list.find(a => a.id === annId);
    if (!ann) return;

    AudioEngine.click();
    
    // Populate Modal
    const titleEl = document.getElementById('ann-detail-title');
    const typeEl = document.getElementById('ann-detail-type');
    const dateEl = document.getElementById('ann-detail-date');
    const contentEl = document.getElementById('ann-detail-content');
    const iconEl = document.getElementById('ann-detail-icon');
    const headerEl = document.getElementById('ann-detail-header');
    
    if (titleEl) titleEl.textContent = ann.title;
    if (typeEl) typeEl.textContent = ann.type;
    if (dateEl) dateEl.textContent = new Date(ann.created_at).toLocaleDateString(undefined, { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    if (contentEl) contentEl.innerHTML = this.formatText(ann.content);
    
    // Set type icon and header color
    const typeConfigs = {
      info: { icon: 'info', color: 'bg-blue' },
      update: { icon: 'sparkles', color: 'bg-green' },
      alert: { icon: 'alert-triangle', color: 'bg-orange' }
    };
    const config = typeConfigs[ann.type] || typeConfigs.info;
    
    if (iconEl) iconEl.setAttribute('data-lucide', config.icon);
    if (headerEl) {
      headerEl.className = headerEl.className.replace(/bg-(blue|green|orange)/g, config.color);
    }
    
    Utils.refreshIcons(headerEl);
    UI.toggleModal('ann-detail-modal', true);
  },

  closeDetail() {
    AudioEngine.click();
    UI.toggleModal('ann-detail-modal', false);
  },

  togglePanel(show = null) {
    AudioEngine.click();
    const panel = document.getElementById('notification-panel');
    if (!panel) return;

    const isVisible = !panel.classList.contains('translate-x-full');
    const targetShow = show !== null ? show : !isVisible;

    if (targetShow) {
      panel.classList.remove('translate-x-full');
      // No longer auto-marking as read on open, user can use the button or read specific ones
    } else {
      panel.classList.add('translate-x-full');
      // Optional: mark as read when closing?
      // this.markAsRead(); 
    }
  },

  toggleBoard() {
    this.togglePanel();
  },

  formatText(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
};

// --- RECENT GAMES ---
const RecentGames = {
  get() { return Storage.get(CONFIG.storageKeys.recent, []); },
  isCollapsed() { return Storage.get(CONFIG.storageKeys.recentCollapsed, false); },

  toggleCollapse() {
    const collapsed = !this.isCollapsed();
    Storage.set(CONFIG.storageKeys.recentCollapsed, collapsed);
    this.render();
    AudioEngine.click();
  },

  add(gameId) {
    let recent = this.get().filter(id => id !== gameId);
    recent.unshift(gameId);
    Storage.set(CONFIG.storageKeys.recent, recent.slice(0, CONFIG.maxRecentGames));
    this.render();
    Hero.updateContinueBtn();
  },

  clear() {
    Storage.remove(CONFIG.storageKeys.recent);
    this.render();
    AudioEngine.click();
  },

  render() {
    const recentIds = this.get();
    const container = document.getElementById("recent-list");
    const section = document.getElementById("recent-section");
    const toggleBtn = document.getElementById("recent-toggle-btn");
    if (!container || !section) return;

    const collapsed = this.isCollapsed();
    section.classList.toggle('hidden', recentIds.length === 0);

    if (toggleBtn) {
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', collapsed ? 'chevron-down' : 'chevron-up');
        Utils.refreshIcons(toggleBtn);
      }
    }

    if (recentIds.length === 0) return;

    container.classList.toggle('hidden', collapsed);
    if (collapsed) return;

    container.innerHTML = recentIds.map(id => {
      const game = State.getGameById(id);
      if (!game) return '';
      return `
        <button data-action="openGame" data-param="${game.id}"
          class="recent-pill bg-white dark:bg-slate-800 flex items-center gap-2 px-2 py-1.5 rounded-xl shrink-0 min-w-[120px] group hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-dark dark:border-slate-500 shadow-hard-sm animate-pop-in"
          aria-label="Resume ${game.title}">
          <div class="w-8 h-8 rounded-lg ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm">
            <i data-lucide="${game.icon}" class="w-4 h-4"></i>
          </div>
          <div class="text-left">
            <div class="text-[10px] font-black text-dark dark:text-white truncate w-20 leading-tight">${game.title}</div>
            <div class="text-[8px] text-slate-400 font-black uppercase tracking-tighter">RESUME</div>
          </div>
        </button>
      `;
    }).join('');
    Utils.refreshIcons(container);
  }
};

// --- HISTORY MANAGER ---
const HistoryManager = {
  historyMap: new Map(), // gameId -> timestamp string
  searchTerm: '',

  async init() {
    this.loadLocalHistory();
    await this.syncWithCloud();
  },

  loadLocalHistory() {
    const local = Storage.get('kk_tab_history', {});
    this.historyMap = new Map(Object.entries(local));
  },

  saveLocalHistory() {
    Storage.set('kk_tab_history', Object.fromEntries(this.historyMap));
  },

  async syncWithCloud() {
    if (typeof isSandbox === 'function' && isSandbox()) return;
    const user = await (typeof getUser === 'function' ? getUser() : null);
    if (!user) return;

    try {
      const { data, error } = await db
        .from('user_progress')
        .select('tool_key, updated_at')
        .eq('user_id', user.id);

      if (error) {
        console.warn('[HistoryManager] Cloud sync error:', error);
        return;
      }

      if (data) {
        let changed = false;
        data.forEach(row => {
          const game = State.getGameById(row.tool_key);
          if (game) { // Only track valid games/tools
            const existingTime = this.historyMap.get(row.tool_key);
            const cloudTime = row.updated_at;
            if (!existingTime || new Date(cloudTime) > new Date(existingTime)) {
              this.historyMap.set(row.tool_key, cloudTime);
              changed = true;
            }
          }
        });

        if (changed) {
          this.saveLocalHistory();
        }
      }
    } catch (e) {
      console.warn('[HistoryManager] Sync failed:', e);
    }
  },

  async trackTabOpen(gameId) {
    const game = State.getGameById(gameId);
    if (!game) return;

    const now = new Date().toISOString();
    this.historyMap.set(gameId, now);
    this.saveLocalHistory();

    if (typeof isSandbox === 'function' && isSandbox()) return;
    const user = await (typeof getUser === 'function' ? getUser() : null);
    if (!user) return;

    try {
      // First try updating existing row
      const { data, error } = await db.from('user_progress')
        .update({ updated_at: now })
        .eq('user_id', user.id)
        .eq('tool_key', gameId)
        .select();

      if (!error && (!data || data.length === 0)) {
        // If no row existed, insert a clean empty data row
        await db.from('user_progress').insert({
          user_id: user.id,
          tool_key: gameId,
          data: {},
          updated_at: now
        });
      }
    } catch (e) {
      console.warn('[HistoryManager] Cloud track failed:', e);
    }
  },

  openUI() {
    AudioEngine.click();
    this.searchTerm = '';
    const searchInput = document.getElementById('history-search');
    if (searchInput) searchInput.value = '';
    this.syncWithCloud().then(() => this.render());
    this.togglePanel(true);
  },

  togglePanel(show) {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    if (show === undefined) {
      show = panel.classList.contains('translate-x-full');
    }

    if (show) {
      panel.classList.remove('translate-x-full');
      this.render();
    } else {
      panel.classList.add('translate-x-full');
    }
  },

  async clearHistory() {
    const confirmed = await showConfirmModal('Are you sure you want to clear your tab history?', {
      title: 'Clear History?',
      confirmText: 'Clear',
      cancelText: 'Keep',
      icon: 'rotate-ccw',
      iconColor: 'red'
    });
    if (!confirmed) return;
    AudioEngine.click();

    this.historyMap.clear();
    this.saveLocalHistory();

    if (typeof isSandbox !== 'function' || !isSandbox()) {
      const user = await (typeof getUser === 'function' ? getUser() : null);
      if (user) {
        try {
          await db.from('user_progress')
            .update({ updated_at: new Date(0).toISOString() })
            .eq('user_id', user.id);
        } catch (e) {
          console.warn('[HistoryManager] Cloud clear failed:', e);
        }
      }
    }

    this.render();
    UI.showToast('Tab history cleared', 'success');
  },

  formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  },

  render() {
    const container = document.getElementById('panel-history-list');
    const searchInput = document.getElementById('history-search');
    if (!container) return;

    this.searchTerm = (searchInput?.value || '').toLowerCase().trim();

    // Convert map to array and filter/sort
    const historyItems = [];
    this.historyMap.forEach((timeStr, gameId) => {
      if (new Date(timeStr).getFullYear() <= 1970) return;

      const game = State.getGameById(gameId);
      if (game) {
        historyItems.push({ game, timeStr, timeMs: new Date(timeStr).getTime() });
      }
    });

    historyItems.sort((a, b) => b.timeMs - a.timeMs);

    const filtered = historyItems.filter(({ game }) => {
      if (!this.searchTerm) return true;
      return game.title.toLowerCase().includes(this.searchTerm) ||
             game.category.toLowerCase().includes(this.searchTerm) ||
             (game.description || '').toLowerCase().includes(this.searchTerm);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400 font-bold">
          <i data-lucide="history" class="w-12 h-12 mx-auto mb-3 opacity-30"></i>
          <p>${this.searchTerm ? 'No matching history found' : 'No tab history yet'}</p>
        </div>
      `;
      Utils.refreshIcons(container);
      return;
    }

    container.innerHTML = filtered.map(({ game, timeStr }) => `
      <div class="card p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-700 rounded-xl shadow-hard-sm hover:translate-y-[-2px] transition-all group cursor-pointer"
           onclick="HistoryManager.togglePanel(false); GameModal.open('${game.id}')">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-600 shadow-sm shrink-0 group-hover:scale-110 transition-transform">
            <i data-lucide="${game.icon}" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0 text-left">
            <h4 class="font-heading font-bold text-sm text-dark dark:text-white truncate group-hover:text-blue transition-colors">${game.title}</h4>
            <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">${game.category}</p>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <span class="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-none text-[10px] font-bold py-1 px-2">
            ${this.formatTimeAgo(timeStr)}
          </span>
        </div>
      </div>
    `).join('');

    Utils.refreshIcons(container);
  }
};

// --- PINNED GAMES ---
const PinnedGames = {
  get() { return Storage.get(CONFIG.storageKeys.pinned, []); },

  isPinned(gameId) {
    return this.get().includes(gameId);
  },

  toggle(gameId) {
    let pinned = this.get();
    const isPinned = pinned.includes(gameId);

    if (isPinned) {
      pinned = pinned.filter(id => id !== gameId);
    } else {
      pinned.unshift(gameId);
    }

    Storage.set(CONFIG.storageKeys.pinned, pinned);
    this.render();
    GameGrid.render(); // Refresh main grid to update pin icons
    AudioEngine.click();
    return !isPinned;
  },

  render() {
    const pinnedIds = this.get();
    const container = document.getElementById("pinned-list");
    const section = document.getElementById("pinned-section");
    const badge = document.getElementById("pinned-count-badge");

    if (!container || !section) return;

    section.classList.toggle('hidden', pinnedIds.length === 0);
    if (badge) badge.textContent = pinnedIds.length;

    if (pinnedIds.length === 0) return;

    const categoryLabels = { tool: 'Tool', game: 'Game', workshop: 'Workshop', myspace: 'My Space', 'under-construction': 'WIP' };

    container.innerHTML = pinnedIds.map(id => {
      const game = State.getGameById(id);
      if (!game) return '';
      const catLabel = categoryLabels[game.category] || game.category;
      return `
        <article class="pinned-card group relative bg-white dark:bg-slate-800 rounded-2xl border-3 border-dark dark:border-slate-500 shadow-hard-sm hover:shadow-hard hover:-translate-y-1 active:translate-y-[2px] active:shadow-none cursor-pointer transition-all duration-200 animate-pop-in overflow-hidden"
          data-action="openGame" data-param="${game.id}">
          <div class="flex items-center gap-3 p-3">
            <div class="w-10 h-10 rounded-xl ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm shrink-0">
              <i data-lucide="${game.icon}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-black text-dark dark:text-white truncate leading-tight">${game.title}</div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">${catLabel}</div>
            </div>
            <button data-action="togglePin" data-param="${game.id}" class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 text-slate-300 dark:text-slate-500 transition-all opacity-0 group-hover:opacity-100 shrink-0" title="Unpin">
              <i data-lucide="pin-off" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </article>
      `;
    }).join('');
    Utils.refreshIcons(container);
  }
};

// Stats module removed


// --- GAME GRID ---
const GameGrid = {
  render(games = null) {
    const gamesToRender = games || State.getFilteredGames();
    const grid = document.getElementById('games-grid');
    if (!grid) return;


    if (gamesToRender.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i data-lucide="search-x" class="empty-state-icon"></i>
          <p class="empty-state-title">No activities found</p>
          <p class="empty-state-subtitle">Try adjusting your filters</p>
        </div>
      `;
      Utils.refreshIcons();
      return;
    }

    // Group by category
    const tools = gamesToRender.filter(g => g.category === 'tool');
    const gamesList = gamesToRender.filter(g => g.category === 'game');
    const workshop = gamesToRender.filter(g => g.category === 'workshop');
    const other = gamesToRender.filter(g => !['myspace', 'tool', 'game', 'workshop'].includes(g.category));

    let html = '';

    if (tools.length > 0) {
      html += this.renderCategorySection('tools', 'wrench', 'var(--color-blue)', 'Teaching Tools', tools);
    }
    if (workshop.length > 0) {
      html += this.renderCategorySection('workshop', 'hammer', 'var(--color-pink)', 'Workshop Tools', workshop);
    }
    if (gamesList.length > 0) {
      html += this.renderCategorySection('games', 'gamepad-2', 'var(--color-green)', 'Classroom Games', gamesList);
    }
    if (other.length > 0) {
      html += this.renderCategorySection('other', 'box', 'var(--color-orange)', 'Other', other);
    }

    grid.innerHTML = html;
    ViewMode.apply();
    Utils.refreshIcons(grid);
    this.initCardEffects(grid);
  },

  renderCategorySection(id, icon, color, title, games) {
    return `
      <section class="category-section" id="category-${id}">
        <div class="section-header">
          <div class="section-header-icon" style="background: ${color};">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>
          <h3 class="section-header-title">${title}</h3>
          <span class="section-header-badge">${games.length}</span>
        </div>
        <div class="category-grid">
          ${games.map(game => this.createCard(game)).join('')}
        </div>
      </section>
    `;
  },

  createCard(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}/10`;
    const btnClass = game.color.replace('text-', 'bg-');
    const difficultyBadge = game.difficulty
      ? `<span class="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">${game.difficulty}</span>`
      : '';

    const isPinned = PinnedGames.isPinned(game.id);
    const pinIcon = isPinned ? 'pin-off' : 'pin';
    const pinTitle = isPinned ? 'Unpin from top' : 'Pin to top';

    let displayTitle = game.title;
    let displayDesc = game.description;

    if (State.filters.searchTerm) {
      const regex = new RegExp(`(${State.filters.searchTerm})`, 'gi');
      displayTitle = displayTitle.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
      displayDesc = displayDesc.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
    }
    
    const proBadge = game.pro
      ? `<span class="pro-badge px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[9px] font-black text-white rounded shadow-sm">PRO</span>`
      : '';

    return `
      <article class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" 
        data-action="openGame" data-param="${game.id}" role="button" tabindex="0"
        aria-label="Launch ${game.title}: ${game.description}">
        <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
          <button data-action="togglePin" data-param="${game.id}" 
            class="pin-btn absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-dark opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 hover:scale-110"
            title="${pinTitle}">
            <i data-lucide="${pinIcon}" class="w-4 h-4"></i>
          </button>
          <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(#000 2px,transparent 2px);background-size:12px 12px"></div>
          <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
          <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
          <div class="flex justify-between items-start mb-3">
            <div class="flex flex-col gap-1">
              <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${displayTitle}</h2>
              ${proBadge}
            </div>
            <div class="flex flex-col gap-1 items-end">
              <span class="sticker ${btnClass} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${Math.random() > 0.5 ? 'rotate-2' : '-rotate-2'}">${game.category.toUpperCase()}</span>
              ${difficultyBadge}
            </div>
          </div>
          <p class="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 flex-1 leading-relaxed">${displayDesc}</p>
          <button class="btn-chunky ${btnClass} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105" tabindex="-1">
            <i data-lucide="play" class="w-5 h-5 fill-current"></i> LAUNCH
          </button>
        </div>
      </article>
    `;
  },

  getGuideText(game) {
    if (!game.guide) {
      return (game.category === 'tool' || game.category === 'workshop')
        ? "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility.</li></ul>"
        : "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Customize words in setup if available.</li></ul>";
    }
    if (typeof game.guide === 'object' && game.guide.steps) {
      return `<ul class='list-disc pl-5 space-y-2'>${game.guide.steps.map(s => `<li>${s}</li>`).join('')}</ul>`;
    }
    return game.guide;
  },

  initCardEffects(container) {
    if (!container) return;
    // Delegated event handling on the grid container
    container.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.hub-card');
      if (card) this.tiltCard(e, card);
    });
    container.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.hub-card');
      if (card) card.style.transform = '';
    }, true); // use capture to catch leave from children
  },

  tiltCard(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Glare coordinates (percentage)
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    card.style.setProperty('--glare-x', `${glareX}%`);
    card.style.setProperty('--glare-y', `${glareY}%`);

    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }
};

// --- VIEW MODE ---
const ViewMode = {
  current: 'cards', // 'cards' | 'list' | 'icons'

  init() {
    this.current = Storage.get(CONFIG.storageKeys.viewMode, 'cards') || 'cards';
    this.apply();
    this.updateToggleUI();
  },

  set(mode) {
    if (!['cards', 'list', 'icons'].includes(mode)) return;
    this.current = mode;
    Storage.set(CONFIG.storageKeys.viewMode, mode);
    this.apply();
    this.updateToggleUI();
    AudioEngine.click();
  },

  apply() {
    document.querySelectorAll('.games-grid').forEach(grid => {
      grid.classList.remove('view-list', 'view-icons');
      if (this.current === 'list') grid.classList.add('view-list');
      if (this.current === 'icons') grid.classList.add('view-icons');
    });
  },

  updateToggleUI() {
    document.querySelectorAll('.view-toggle-group').forEach(group => {
      group.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.param === this.current);
      });
    });
  }
};

// --- VIEW MANAGER (formerly LandingPage & Filters) ---
const ViewManager = {
  currentView: 'landing', // 'landing', 'myspace', 'library-all', 'library-tool', 'library-game', 'library-workshop'
  renderedViews: new Set(['landing', 'myspace']),

  init(activity = null) {
    const saved = Storage.get(CONFIG.storageKeys.homeView);
    if (saved) {
      this.show(saved, true);
      return;
    }

    // Default Smart Landing logic
    if (activity) {
      if (activity.hasMySpace) {
        this.show('myspace', true);
      } else if (activity.hasActivity) {
        this.show('library-all', true);
      } else {
        this.show('landing', true);
      }
    } else {
      // Fallback to local check if no database activity data available
      if (MySpace && MySpace.isPopulated && MySpace.isPopulated()) {
        this.show('myspace', true);
      } else {
        // Check local storage for any game activity
        const hasRecent = (Storage.get(CONFIG.storageKeys.recent) || []).length > 0;
        const hasPinned = (Storage.get(CONFIG.storageKeys.pinned) || []).length > 0;
        
        if (hasRecent || hasPinned) {
          this.show('library-all', true);
        } else {
          this.show('landing', true);
        }
      }
    }
  },

  show(viewId, silent = false) {
    const prevView = this.currentView;
    
    // Hide all views first
    document.querySelectorAll('.section-view').forEach(v => v.style.display = 'none');

    this.currentView = viewId;
    this.ensureRendered(viewId);

    const target = document.getElementById(`${viewId}-view`);
    if (target) {
      target.style.display = '';
      // Trigger entrance animation
      target.classList.remove('animate-pop-in');
      void target.offsetWidth;
      target.classList.add('animate-pop-in');
    }

    // Special logic for specific views
    if (viewId === 'myspace' && window.MySpace) {
      window.MySpace.onShow?.();
    } else if (viewId === 'landing') {
      // Refresh Home Page Content
      if (window.UI && UI.updateGreeting) UI.updateGreeting();
    } else if (viewId === 'library-all') {
      requestAnimationFrame(() => {
        if (typeof PinnedGames !== 'undefined') PinnedGames.render();
      });
    }

    this.updateNavUI();
    Storage.set(CONFIG.storageKeys.homeView, viewId);
    
    if (!silent) AudioEngine.click();
    Utils.refreshIcons();

    // Scroll to top if switching views
    if (prevView !== viewId) {
      const mainContent = document.querySelector('main');
      if (mainContent) mainContent.scrollTop = 0;
    }
  },

  ensureRendered(viewId) {
    if (this.renderedViews.has(viewId)) return;
    
    const container = document.getElementById(`${viewId}-view`);
    if (!container) return;

    if (viewId.startsWith('library-')) {
      const category = viewId.replace('library-', '');
      this.renderLibraryTemplate(container, viewId, category);
      // Initial render of games for this category
      this.renderGrid(viewId, category);
    }
    
    this.renderedViews.add(viewId);
  },

  renderLibraryTemplate(container, viewId, category) {
    const titles = {
      all: "Let's start teaching",
      tool: "Teaching Tools",
      game: "Classroom Games",
      workshop: "Workshop Tools",
      'under-construction': "Under Construction"
    };
    const title = titles[category] || "Activity Library";

    const statsHtml = category === 'all' ? `
      <div class="flex items-center gap-2 mt-2 flex-wrap opacity-80">
        <span class="hero-stat"><i data-lucide="wrench" class="w-3.5 h-3.5"></i> <strong id="stat-tools">0</strong> Tools</span>
        <span class="hero-stat-dot"></span>
        <span class="hero-stat"><i data-lucide="gamepad-2" class="w-3.5 h-3.5"></i> <strong id="stat-games">0</strong> Games</span>
        <span class="hero-stat-dot"></span>
        <span class="hero-stat"><i data-lucide="hammer" class="w-3.5 h-3.5"></i> <strong id="stat-workshop">0</strong> Workshop</span>
        <span class="hero-stat-dot"></span>
        <span class="hero-stat"><i data-lucide="pin" class="w-3.5 h-3.5"></i> <strong id="stat-pinned">0</strong> Pinned</span>
      </div>
    ` : '';

    const icons = {
      all: "graduation-cap",
      tool: "wrench",
      game: "gamepad-2",
      workshop: "hammer",
      'under-construction': "construction"
    };
    const icon = icons[category] || "layout-grid";

    container.innerHTML = `
      <!-- Dashboard Title Widget -->
      <div class="hero-banner rounded-[2rem] p-6 md:p-8 mb-6 border-[3px] border-dark dark:border-slate-600 shadow-hard dark:shadow-neon relative overflow-hidden flex flex-col justify-center min-h-[160px] mt-4">
        <div class="hero-gradient-bg"></div>
        <div class="hero-dot-overlay"></div>
        
        <!-- Floating geometric shapes -->
        <div class="hero-shape hero-shape--circle" style="top: 10%; right: 15%;"></div>
        <div class="hero-shape hero-shape--ring" style="bottom: 15%; right: 30%;"></div>
        <div class="hero-shape hero-shape--square" style="top: 20%; right: 40%;"></div>
        <div class="hero-shape hero-shape--dot" style="top: 60%; right: 10%;"></div>
        <div class="hero-shape hero-shape--dot" style="top: 30%; right: 55%;"></div>

        <div class="absolute right-4 bottom-[-10%] md:right-12 md:bottom-[-15%] opacity-10 dark:opacity-[0.08] pointer-events-none">
          <i data-lucide="${icon}" class="w-40 h-40 md:w-56 md:h-56 text-slate-800 dark:text-white transform -rotate-12 scale-110"></i>
        </div>
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between w-full gap-6">
          <div class="flex flex-col items-start">
            <div class="hero-meta-tags mb-3 flex gap-3 flex-wrap">
              <span class="hero-pill clock-pill"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> <span class="date-text">...</span></span>
              <span class="hero-pill">Hello!</span>
            </div>
            <h2 class="greeting-display text-3xl md:text-5xl font-heading font-black mb-1 leading-tight tracking-tight text-slate-900 dark:text-white">
              ${title}
            </h2>
            ${statsHtml}
          </div>
          <div class="flex flex-col items-start lg:items-end gap-3 mt-4 lg:mt-0">
             <div class="hero-actions flex flex-wrap gap-3">
                <button data-action="surpriseMe" class="btn-chunky bg-pink text-white border-3 border-dark px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-hard hover:translate-y-[-2px] active:translate-y-[2px] transition-all">
                  <i data-lucide="shuffle" class="w-4 h-4"></i>
                  <span class="font-heading font-bold text-xs uppercase tracking-tight">Surprise Me</span>
                </button>
                <button data-action="continueGame" class="btn-chunky continue-btn bg-blue text-white border-3 border-dark px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-hard hover:translate-y-[-2px] active:translate-y-[2px] transition-all hidden">
                  <i data-lucide="play" class="w-4 h-4 fill-white"></i>
                  <span class="font-heading font-bold text-xs uppercase tracking-tight whitespace-nowrap continue-label">Continue</span>
                </button>
             </div>
             <!-- Tip Box -->
             <div class="hero-tip-box inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30">
               <p id="daily-tip" class="font-bold text-sm text-slate-700 dark:text-white/95 flex items-center gap-3 m-0">
                 <i data-lucide="sparkles" class="w-4 h-4 text-yellow-300"></i> Tip: Use shortcut '/' to quickly search the library!
               </p>
             </div>
          </div>
        </div>
      </div>

      ${category === 'all' ? `
      <!-- Pinned Activities -->
      <section id="pinned-section" class="mb-10 hidden">
        <div class="flex items-center justify-between mb-4 px-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-pink text-white rounded-xl border-2 border-dark flex items-center justify-center shadow-hard-sm">
              <i data-lucide="pin" class="w-5 h-5"></i>
            </div>
            <h3 class="text-2xl font-heading font-black text-dark dark:text-white uppercase tracking-tight">Pinned Activities</h3>
            <span id="pinned-count-badge" class="section-header-badge">0</span>
          </div>
        </div>
        <div id="pinned-list" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <!-- Pinned items injected here -->
        </div>
      </section>
      ` : ''}

      <!-- Grid Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-2xl font-heading font-black text-dark dark:text-white uppercase tracking-tight">${category === 'all' ? 'Library' : category + 's'}</h3>
        <div class="view-toggle-group">
          <button data-action="setViewMode" data-param="cards" class="view-toggle-btn ${ViewMode.current === 'cards' ? 'active' : ''}"><i data-lucide="layout-grid" class="w-4 h-4"></i></button>
          <button data-action="setViewMode" data-param="icons" class="view-toggle-btn ${ViewMode.current === 'icons' ? 'active' : ''}"><i data-lucide="grip" class="w-4 h-4"></i></button>
          <button data-action="setViewMode" data-param="list" class="view-toggle-btn ${ViewMode.current === 'list' ? 'active' : ''}"><i data-lucide="list" class="w-4 h-4"></i></button>
        </div>
      </div>

      <div id="grid-${viewId}" class="games-grid ${ViewMode.current === 'list' ? 'view-list' : ''} ${ViewMode.current === 'icons' ? 'view-icons' : ''}">
        <!-- Items injected here -->
      </div>
    `;
    
    this.updateClock(container);
    if (category === 'all') {
      Hero.updateStats();
      Hero.updateContinueBtn();
      // Ensure pinned is rendered after template injection
      if (typeof PinnedGames !== 'undefined') PinnedGames.render();
    }
  },

  updateClock(container) {
    const el = container.querySelector('.date-text');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  renderGrid(viewId, category) {
    const grid = document.getElementById(`grid-${viewId}`);
    if (!grid) return;

    const searchTerm = State.filters.searchTerm;
    let games = State.games;
    
    if (category !== 'all') {
      games = games.filter(g => g.category === category);
    }
    
    if (searchTerm) {
      games = games.filter(g => 
        g.title.toLowerCase().includes(searchTerm) || 
        g.description.toLowerCase().includes(searchTerm) ||
        g.tags?.some(t => t.toLowerCase().includes(searchTerm))
      );
    }

    if (games.length === 0) {
      grid.innerHTML = `
        <div class="empty-state py-20 opacity-50 flex flex-col items-center">
          <i data-lucide="search-x" class="w-16 h-16 mb-4"></i>
          <p class="font-heading font-bold text-xl uppercase">No matches found</p>
        </div>
      `;
    } else {
      if (category === 'all') {
        const tools = games.filter(g => g.category === 'tool');
        const gamesList = games.filter(g => g.category === 'game');
        const workshop = games.filter(g => g.category === 'workshop');
        
        let html = '';
        if (tools.length > 0) html += GameGrid.renderCategorySection('tools', 'wrench', 'var(--color-blue)', 'Teaching Tools', tools);
        if (workshop.length > 0) html += GameGrid.renderCategorySection('workshop', 'hammer', 'var(--color-pink)', 'Workshop Tools', workshop);
        if (gamesList.length > 0) html += GameGrid.renderCategorySection('games', 'gamepad-2', 'var(--color-green)', 'Classroom Games', gamesList);
        grid.innerHTML = html;
      } else {
        grid.innerHTML = `<div class="category-grid">${games.map(game => GameGrid.createCard(game)).join('')}</div>`;
      }
    }
    
    Utils.refreshIcons(grid);
  },

  renderAllGrids() {
    this.renderedViews.forEach(viewId => {
      if (viewId.startsWith('library-')) {
        this.renderGrid(viewId, viewId.replace('library-', ''));
      }
    });
  },

  updateNavUI() {
    const homeBtn = document.getElementById('nav-home-btn');
    const myspaceBtn = document.getElementById('nav-myspace-btn');
    
    if (homeBtn) homeBtn.classList.toggle('active', this.currentView === 'landing');
    if (myspaceBtn) myspaceBtn.classList.toggle('active', this.currentView === 'myspace');

    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
      const cat = btn.dataset.category;
      const isActive = this.currentView === `library-${cat}`;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
};

// Compatibility shim for old calls
const LandingPage = {
  showLanding: () => ViewManager.show('landing'),
  showLibrary: () => ViewManager.show('library-all'),
  init: (activity) => ViewManager.init(activity)
};

const Filters = {
  setCategory: (cat) => ViewManager.show(`library-${cat}`),
  setSearch: Utils.debounce(function(term) {
    State.filters.searchTerm = term.toLowerCase();
    ViewManager.renderAllGrids();
    if (ViewManager.currentView === 'landing') {
      ViewManager.show('library-all', true);
    }
  }, CONFIG.debounceDelay),
  updateUI: () => ViewManager.updateNavUI()
};

// --- MY SPACE ---
const MySpace = {
  currentApp: null,
  
  isPopulated() {
    const keys = [
      'klasskit_tasks',
      'schedule_events',
      'schedule_class_admin',
      'schedule_class_units',
      'admin_tracker_data'
    ];
    
    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) return true;
          if (typeof parsed === 'object' && Object.keys(parsed).length > 0) return true;
        } catch (e) {
          if (data && data.length > 10) return true; // Fallback for non-JSON or large strings
        }
      }
    }
    return false;
  },

  show(silent = false) {
    ViewManager.show('myspace', silent);
  },

  onShow() {
    // Load default app if none active
    if (!this.currentApp) {
      this.loadApp('myspace-home', true);
    }

    // Show Pro-only apps if user is Pro
    if (State.isPro()) {
      document.querySelectorAll('.pro-only-btn').forEach(btn => btn.classList.remove('hidden'));
    }
  },

  loadApp(appId, silent = false) {
    const iframe = document.getElementById('myspace-iframe');
    const loader = document.getElementById('myspace-loader');
    if (!iframe || !loader) return;

    const game = State.getGameById(appId);
    if (!game) return;

    this.currentApp = appId;
    
    // Handle Pro check
    if (game.pro && !State.isPro()) {
      UI.showToast("This app is exclusive to PRO users", "warning");
      return;
    }

    // Show loader
    loader.classList.remove('opacity-0', 'pointer-events-none');
    iframe.classList.add('opacity-0');

    // Load iframe
    iframe.onload = () => {
      loader.classList.add('opacity-0', 'pointer-events-none');
      iframe.classList.remove('opacity-0');
    };
    iframe.src = game.path;

    if (!silent) AudioEngine.click();
  },

  toggleFullscreen() {
    const iframe = document.getElementById('myspace-iframe');
    if (!iframe) return;

    AudioEngine.click();

    if (!document.fullscreenElement) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen().catch(() => {
          document.body.classList.add('myspace-fullscreen');
        });
      } else {
        document.body.classList.add('myspace-fullscreen');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      document.body.classList.remove('myspace-fullscreen');
    }

    // Trigger resize so iframe contents adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }
};
window.MySpace = MySpace;

// --- INPUT POPUP (custom prompt replacement) ---
const InputPopup = {
  _resolve: null,

  show(title, defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
      this._resolve = resolve;
      const popup = document.getElementById('input-popup');
      const field = document.getElementById('input-popup-field');
      const titleEl = document.getElementById('input-popup-title');

      titleEl.textContent = title;
      field.value = defaultValue;
      field.placeholder = placeholder || 'Type here...';

      popup.classList.remove('hidden');
      popup.classList.add('flex');
      Utils.refreshIcons(popup);

      requestAnimationFrame(() => {
        field.focus();
        field.select();
      });
    });
  },

  submit() {
    const field = document.getElementById('input-popup-field');
    const value = field.value.trim();
    this._hide();
    if (this._resolve) {
      this._resolve(value || null);
      this._resolve = null;
    }
  },

  cancel() {
    this._hide();
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
  },

  _hide() {
    const popup = document.getElementById('input-popup');
    popup.classList.add('hidden');
    popup.classList.remove('flex');
  }
};
window.InputPopup = InputPopup;

// --- TAB MANAGER ---
const TabManager = {
  tabs: [],
  activeTabId: null, // This is the "primary" or "left" tab when split
  splitScreenActive: false,
  rightTabId: null,
  groups: [],
  contextMenu: null,
  groupMenu: null,
  GROUP_COLORS: [
    { name: 'Blue',   value: 'blue',   hex: '#1ea7fd' },
    { name: 'Pink',   value: 'pink',   hex: '#ff4785' },
    { name: 'Green',  value: 'green',  hex: '#00d063' },
    { name: 'Orange', value: 'orange', hex: '#ff7e33' },
    { name: 'Purple', value: 'purple', hex: '#8b5cf6' },
    { name: 'Teal',   value: 'teal',   hex: '#14b8a6' },
    { name: 'Red',    value: 'red',    hex: '#ef4444' },
    { name: 'Amber',  value: 'amber',  hex: '#f59e0b' },
  ],

  getGroupColorHex(colorValue) {
    return this.GROUP_COLORS.find(c => c.value === colorValue)?.hex || '#1ea7fd';
  },

  getNextGroupColor() {
    const usedColors = this.groups.map(g => g.color);
    const unused = this.GROUP_COLORS.find(c => !usedColors.includes(c.value));
    return unused ? unused.value : this.GROUP_COLORS[this.groups.length % this.GROUP_COLORS.length].value;
  },

  init() {
    this.setupKeyboardShortcuts();
    this.loadGroupsFromStorage();
    this.loadTabsFromStorage();
    this.setupContextMenu();
    this.setupTouchDrag();
  },

  // ============================
  // TOUCH DRAG SYSTEM
  // ============================
  _touchDrag: {
    active: false,
    startX: 0,
    startY: 0,
    ghost: null,
    sourceType: null,  // 'tab' | 'group'
    sourceId: null,
    longPressTimer: null,
    longPressDelay: 300,
    currentDropTarget: null,
  },

  setupTouchDrag() {
    // Global touch move / end handlers (bound once)
    document.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  },

  attachTouchDragToTab(tabIcon, tabId) {
    tabIcon.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const td = this._touchDrag;
      td.startX = touch.clientX;
      td.startY = touch.clientY;
      td.sourceType = 'tab';
      td.sourceId = tabId;
      td._sourceEl = tabIcon;

      // Clear any previous timer
      if (td.longPressTimer) clearTimeout(td.longPressTimer);
      td.longPressTimer = setTimeout(() => {
        td.longPressTimer = null;
        this._startTouchDrag(td.startX, td.startY, tabIcon);
      }, td.longPressDelay);
    }, { passive: false });
  },

  attachTouchDragToGroup(groupEl, groupId) {
    const header = groupEl.querySelector('.tab-group-header');
    if (!header) return;
    header.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const touch = e.touches[0];
      const td = this._touchDrag;
      td.startX = touch.clientX;
      td.startY = touch.clientY;
      td.sourceType = 'group';
      td.sourceId = groupId;
      td._sourceEl = groupEl;

      if (td.longPressTimer) clearTimeout(td.longPressTimer);
      td.longPressTimer = setTimeout(() => {
        td.longPressTimer = null;
        this._startTouchDrag(td.startX, td.startY, groupEl);
      }, td.longPressDelay);
    }, { passive: false });
  },

  _startTouchDrag(x, y, sourceEl) {
    const td = this._touchDrag;
    td.active = true;

    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(30);

    // Prevent context menu / text selection while dragging
    document.body.classList.add('touch-dragging');

    // Create ghost
    const ghost = document.createElement('div');
    ghost.className = 'touch-drag-ghost';
    ghost.innerHTML = sourceEl.querySelector('.side-panel-tab-icon')?.outerHTML
                   || sourceEl.querySelector('.tab-group-name')?.outerHTML
                   || '<span>⋮</span>';
    ghost.style.left = `${x - 24}px`;
    ghost.style.top = `${y - 24}px`;
    document.body.appendChild(ghost);
    td.ghost = ghost;

    // Mark source
    sourceEl.classList.add('dragging');

    Utils.refreshIcons(ghost);
  },

  _onTouchMove(e) {
    const td = this._touchDrag;
    if (!td.longPressTimer && !td.active) return;

    const touch = e.touches[0];

    // If not yet dragging, check if finger moved too much → cancel long press
    if (td.longPressTimer && !td.active) {
      const dx = Math.abs(touch.clientX - td.startX);
      const dy = Math.abs(touch.clientY - td.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(td.longPressTimer);
        td.longPressTimer = null;
      }
      return;
    }

    if (!td.active) return;
    e.preventDefault(); // Prevent scroll while dragging

    // Move ghost
    if (td.ghost) {
      td.ghost.style.left = `${touch.clientX - 24}px`;
      td.ghost.style.top = `${touch.clientY - 24}px`;
    }

    // Find drop target under finger
    if (td.ghost) td.ghost.style.pointerEvents = 'none';
    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    if (td.ghost) td.ghost.style.pointerEvents = '';

    // Clear old highlight
    if (td.currentDropTarget && td.currentDropTarget !== elUnder) {
      td.currentDropTarget.classList.remove('drag-over');
    }

    // Highlight new target
    const dropTarget = elUnder?.closest('.side-panel-tab, .tab-group-header, .tab-ungrouped-dropzone');
    if (dropTarget) {
      dropTarget.classList.add('drag-over');
      td.currentDropTarget = dropTarget;
    } else {
      td.currentDropTarget = null;
    }
  },

  _onTouchEnd(e) {
    const td = this._touchDrag;

    // Clear long-press timer
    if (td.longPressTimer) {
      clearTimeout(td.longPressTimer);
      td.longPressTimer = null;
    }

    if (!td.active) return;
    td.active = false;

    // Remove ghost
    if (td.ghost) {
      td.ghost.remove();
      td.ghost = null;
    }

    // Remove source styling
    if (td._sourceEl) {
      td._sourceEl.classList.remove('dragging');
    }

    // Resolve drop
    const target = td.currentDropTarget;
    if (target) {
      target.classList.remove('drag-over');

      if (td.sourceType === 'tab') {
        if (target.classList.contains('side-panel-tab')) {
          // Drop tab on tab
          const targetTabId = target.dataset.tabId;
          if (targetTabId && targetTabId !== td.sourceId) {
            const draggedTab = this.tabs.find(t => t.id === td.sourceId);
            const targetTab = this.tabs.find(t => t.id === targetTabId);
            if (draggedTab && targetTab && draggedTab.groupId === targetTab.groupId) {
              this.reorderTabs(td.sourceId, targetTabId);
            } else if (draggedTab) {
              this.moveTabToGroup(td.sourceId, targetTab?.groupId || null);
            }
            AudioEngine.click();
          }
        } else if (target.classList.contains('tab-group-header')) {
          // Drop tab on group header
          const groupEl = target.closest('.tab-group');
          const groupId = groupEl?.dataset.groupId;
          if (groupId) {
            this.moveTabToGroup(td.sourceId, groupId);
            AudioEngine.click();
          }
        } else if (target.classList.contains('tab-ungrouped-dropzone')) {
          // Drop tab to ungrouped
          this.moveTabToGroup(td.sourceId, null);
          AudioEngine.click();
        }
      } else if (td.sourceType === 'group') {
        if (target.classList.contains('tab-group-header')) {
          const groupEl = target.closest('.tab-group');
          const targetGroupId = groupEl?.dataset.groupId;
          if (targetGroupId && targetGroupId !== td.sourceId) {
            this.reorderGroups(td.sourceId, targetGroupId);
            AudioEngine.click();
          }
        }
      }
    }

    // Clean up all drag-over states
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.body.classList.remove('touch-dragging');
    td.currentDropTarget = null;
    td._sourceEl = null;
  },

  saveTabsToStorage() {
    const tabsData = this.tabs.map(({ id, gameId, title, icon, color, pinned, groupId }) => ({ id, gameId, title, icon, color, pinned, groupId }));
    Storage.set(CONFIG.storageKeys.tabs, { tabs: tabsData, activeTabId: this.activeTabId });
  },

  saveGroupsToStorage() {
    Storage.set(CONFIG.storageKeys.tabGroups, this.groups);
  },

  loadGroupsFromStorage() {
    const saved = Storage.get(CONFIG.storageKeys.tabGroups);
    this.groups = Array.isArray(saved) ? saved : [];
    // Migrate old 'text-blue' format to just 'blue'
    this.groups.forEach(g => {
      if (g.color && g.color.startsWith('text-')) {
        g.color = g.color.replace('text-', '').split('-')[0];
      }
    });
  },

  loadTabsFromStorage() {
    const savedData = Storage.get(CONFIG.storageKeys.tabs);
    if (!savedData?.tabs?.length) return;

    UI.toggleModal('game-modal', true);
    savedData.tabs.forEach(tabData => {
      const game = State.getGameById(tabData.gameId);
      if (!game) return;
      if (game.pro && !State.isPro()) return;
      const tab = this.createTabSilent(game, tabData.id, false, tabData.groupId);
      if (tabData.pinned) this.togglePinTab(tab.id, true);
    });

    const targetTab = (savedData.activeTabId && this.tabs.find(t => t.id === savedData.activeTabId))
      ? savedData.activeTabId : this.tabs[0]?.id;
    this.renderGroups();
    if (targetTab) this.switchToTab(targetTab);
    this.updateEmptyState();
  },

  createGroup(name, color = null) {
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assignedColor = color || this.getNextGroupColor();
    const group = { id, name: name || 'New Group', color: assignedColor, collapsed: false };
    this.groups.push(group);
    this.saveGroupsToStorage();
    this.renderGroups();
    AudioEngine.click();
    return group;
  },

  changeGroupColor(groupId, newColor) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.color = newColor;
      this.saveGroupsToStorage();
      this.renderGroups();
    }
  },

  reorderGroups(draggedGroupId, targetGroupId) {
    const draggedIdx = this.groups.findIndex(g => g.id === draggedGroupId);
    const targetIdx = this.groups.findIndex(g => g.id === targetGroupId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const [moved] = this.groups.splice(draggedIdx, 1);
    this.groups.splice(targetIdx, 0, moved);
    this.saveGroupsToStorage();
    this.renderGroups();
  },

  deleteGroup(groupId) {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index === -1) return;
    this.groups.splice(index, 1);

    // Close all tabs that belong to this group
    const tabsInGroup = this.tabs.filter(t => t.groupId === groupId);
    tabsInGroup.forEach(tab => {
      tab.iconElement?.remove();
      tab.panel?.remove();
    });
    this.tabs = this.tabs.filter(t => t.groupId !== groupId);

    // If active tab was in the deleted group, switch to another
    if (this.activeTabId && !this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
      if (this.activeTabId) {
        this.switchToTab(this.activeTabId);
      } else {
        this.updateEmptyState();
        this.closeModal();
      }
    }

    this.saveGroupsToStorage();
    this.saveTabsToStorage();
    this.renderGroups();
    AudioEngine.click();
  },

  renameGroup(groupId, name) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.name = name || group.name;
      this.saveGroupsToStorage();
      this.renderGroups();
    }
  },

  toggleGroupCollapsed(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;
    group.collapsed = !group.collapsed;
    this.saveGroupsToStorage();
    const el = document.getElementById(groupId);
    if (el) el.classList.toggle('collapsed', group.collapsed);
    // CSS handles chevron rotation; keep icon as chevron-down always
    Utils.refreshIcons();
    AudioEngine.click();
  },

  moveTabToGroup(tabId, groupId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.groupId = groupId || null;
    this.saveTabsToStorage();
    this.renderGroups();
    AudioEngine.click();
  },

  renderGroups() {
    const container = document.getElementById('side-panel-tabs');
    if (!container) return;

    // Remember scroll position
    const scrollTop = container.scrollTop;

    // Clear container but keep references to iconElements
    container.innerHTML = '';

    // First render ungrouped tabs
    const ungroupedTabs = this.tabs.filter(t => !t.groupId);
    ungroupedTabs.forEach(tab => {
      if (tab.iconElement) {
        container.appendChild(tab.iconElement);
      } else {
        this.createTabIcon(tab);
      }
    });

    // Then render each group
    this.groups.forEach(group => {
      const colorHex = this.getGroupColorHex(group.color);

      const groupEl = document.createElement('div');
      groupEl.id = group.id;
      groupEl.className = `tab-group${group.collapsed ? ' collapsed' : ''}`;
      groupEl.dataset.groupId = group.id;
      groupEl.draggable = true;
      groupEl.style.setProperty('--group-color', colorHex);

      const header = document.createElement('button');
      header.className = 'tab-group-header';
      header.type = 'button';
      header.setAttribute('data-title', group.name);
      header.innerHTML = `
        <span class="tab-group-color-dot" style="background:${colorHex}"></span>
        <span class="tab-group-name">${this.escapeHtml(group.name)}</span>
        <span class="tab-group-chevron"><i data-lucide="chevron-down"></i></span>
        <span class="tab-group-count">${this.tabs.filter(t => t.groupId === group.id).length}</span>
      `;
      header.addEventListener('click', () => this.toggleGroupCollapsed(group.id));

      // --- Group dragging ---
      groupEl.addEventListener('dragstart', (e) => {
        // Only start group drag from the header
        if (!e.target.closest('.tab-group-header') && !e.target.classList?.contains('tab-group')) {
          // Let tab drag bubble naturally
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/group-id', group.id);
        e.dataTransfer.setData('text/plain', ''); // prevent tab handler from acting
        setTimeout(() => groupEl.classList.add('dragging'), 0);
      });

      groupEl.addEventListener('dragend', () => {
        groupEl.classList.remove('dragging');
        container.querySelectorAll('.tab-group').forEach(el => el.classList.remove('drag-over'));
        container.querySelectorAll('.tab-group-header').forEach(el => el.classList.remove('drag-over'));
      });

      // Drop on group header: accept tabs AND groups
      header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
      });
      header.addEventListener('dragleave', () => header.classList.remove('drag-over'));
      header.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        const draggedGroupId = e.dataTransfer.getData('application/group-id');
        const draggedTabId = e.dataTransfer.getData('text/plain');
        if (draggedGroupId && draggedGroupId !== group.id) {
          // Reorder groups
          this.reorderGroups(draggedGroupId, group.id);
          AudioEngine.click();
        } else if (draggedTabId && draggedTabId !== '') {
          // Move tab into group
          this.moveTabToGroup(draggedTabId, group.id);
        }
      });

      // Context menu for group
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showGroupContextMenu(e.clientX, e.clientY, group.id);
      });

      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'tab-group-tabs';

      const groupTabs = this.tabs.filter(t => t.groupId === group.id);
      groupTabs.forEach(tab => {
        if (tab.iconElement) {
          tabsContainer.appendChild(tab.iconElement);
        } else {
          this.createTabIcon(tab);
          if (tab.iconElement) tabsContainer.appendChild(tab.iconElement);
        }
      });

      groupEl.appendChild(header);
      groupEl.appendChild(tabsContainer);
      container.appendChild(groupEl);

      // Touch drag support for groups
      this.attachTouchDragToGroup(groupEl, group.id);
    });

    // Add an ungrouped drop zone at the bottom so you can drop tabs out of groups
    const dropZone = document.createElement('div');
    dropZone.className = 'tab-ungrouped-dropzone';
    dropZone.innerHTML = '<i data-lucide="inbox" class="w-3 h-3 opacity-40"></i>';
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (draggedTabId && draggedTabId !== '') {
        this.moveTabToGroup(draggedTabId, null);
      }
    });
    container.appendChild(dropZone);

    Utils.refreshIcons(container);
    container.scrollTop = scrollTop;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  setupContextMenu() {
    // Tab context menu
    this.contextMenu = document.createElement('div');
    this.contextMenu.id = 'tab-context-menu';
    this.contextMenu.className = 'fixed z-[100] bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard p-2 hidden flex-col gap-1 min-w-[180px]';
    document.body.appendChild(this.contextMenu);

    // Group submenu ("Add to Group")
    this.groupMenu = document.createElement('div');
    this.groupMenu.id = 'tab-group-submenu';
    this.groupMenu.className = 'fixed z-[101] bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard p-2 hidden flex-col gap-1 min-w-[160px]';
    document.body.appendChild(this.groupMenu);

    // Hide menus on click elsewhere
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });
  },

  showTabContextMenu(x, y, tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const menu = this.contextMenu;
    const hasGroups = this.groups.length > 0;

    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    const addItem = (label, icon, action) => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    };

    addItem('Pin / Unpin', 'pin', () => this.togglePinTab(tabId));
    addItem('Reload', 'rotate-cw', () => this.reloadTab(tabId));
    addItem('Open in New Tab', 'external-link', () => {
      const game = State.getGameById(tab.gameId);
      if (!game) return;
      if (game.pro && !State.isPro()) {
        UI.showToast("This app is exclusive to PRO users", "warning");
        return;
      }
      window.open(game.path, '_blank', 'noopener,noreferrer');
    });
    addItem('Close Tab', 'x', () => this.closeTab(tabId));

    if (hasGroups) {
      const separator = document.createElement('div');
      separator.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
      menu.appendChild(separator);

      addItem('Add to Group...', 'folder-plus', () => {
        this.showGroupSubmenu(x + menu.offsetWidth + 4, y, tabId);
      });

      if (tab.groupId) {
        addItem('Remove from Group', 'folder-minus', () => this.moveTabToGroup(tabId, null));
      }
    }

    const separator2 = document.createElement('div');
    separator2.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
    menu.appendChild(separator2);

    addItem('New Group...', 'folder-plus', async () => {
      this.hideContextMenu();
      const name = await InputPopup.show('New Group', '', 'Group name');
      if (name) {
        const group = this.createGroup(name);
        this.moveTabToGroup(tabId, group.id);
      }
    });

    Utils.refreshIcons(menu);

    // Boundary check
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  showGroupSubmenu(x, y, tabId) {
    const menu = this.groupMenu;
    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    this.groups.forEach(group => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<span class="w-3 h-3 rounded-full" style="background:${this.getGroupColorHex(group.color)}"></span><span>${this.escapeHtml(group.name)}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveTabToGroup(tabId, group.id);
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    });

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width - 200}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  showGroupContextMenu(x, y, groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    const menu = this.contextMenu;
    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    menu.classList.add('flex');

    const addItem = (label, icon, action) => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors';
      btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    };

    addItem('Rename Group', 'pencil', async () => {
      this.hideContextMenu();
      const name = await InputPopup.show('Rename Group', group.name, 'Group name');
      if (name) this.renameGroup(groupId, name);
    });

    // Color picker row
    const colorRow = document.createElement('div');
    colorRow.className = 'px-3 py-2';
    const colorLabel = document.createElement('div');
    colorLabel.className = 'text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2';
    colorLabel.textContent = 'Color';
    colorRow.appendChild(colorLabel);
    const colorGrid = document.createElement('div');
    colorGrid.className = 'flex flex-wrap gap-1.5';
    this.GROUP_COLORS.forEach(c => {
      const swatch = document.createElement('button');
      swatch.className = `w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${group.color === c.value ? 'border-dark dark:border-white scale-110 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-800' : 'border-transparent'}`;
      swatch.style.background = c.hex;
      swatch.title = c.name;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeGroupColor(groupId, c.value);
        this.hideContextMenu();
      });
      colorGrid.appendChild(swatch);
    });
    colorRow.appendChild(colorGrid);
    menu.appendChild(colorRow);

    const sep = document.createElement('div');
    sep.className = 'h-px bg-slate-200 dark:bg-slate-700 my-1';
    menu.appendChild(sep);

    addItem('Delete Group', 'trash-2', async () => {
      const tabCount = this.tabs.filter(t => t.groupId === groupId).length;
      const msg = tabCount > 0
        ? `Delete this group and close ${tabCount} tab${tabCount > 1 ? 's' : ''} inside it?`
        : 'Delete this empty group?';
      const confirmed = await showConfirmModal(msg, {
        title: 'Delete Group?',
        confirmText: 'Delete',
        cancelText: 'Keep',
        icon: 'trash-2',
        iconColor: 'red'
      });
      if (confirmed) this.deleteGroup(groupId);
    });

    Utils.refreshIcons(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  },

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.add('hidden');
      this.contextMenu.classList.remove('flex');
    }
    if (this.groupMenu) {
      this.groupMenu.classList.add('hidden');
      this.groupMenu.classList.remove('flex');
    }
  },

  reloadTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab?.iframe) return;
    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.iframe.contentWindow.location.reload();
    setTimeout(() => {
      tab.loading = false;
      tab.iconElement?.classList.remove('loading');
    }, 1000);
  },

  createTab(game) {
    const existingTab = this.tabs.find(tab => tab.gameId === game.id);
    if (existingTab) {
      this.switchToTab(existingTab.id);
      return existingTab;
    }
    if (this.tabs.length >= CONFIG.maxTabs) {
      this.showMaxTabsWarning();
      return null;
    }
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return this.createTabSilent(game, tabId, true);
  },

  createTabSilent(game, tabId, switchTo = false, groupId = null) {
    const tab = { id: tabId, gameId: game.id, title: game.title, icon: game.icon, color: game.color, loading: true, pinned: false, groupId: groupId || null };
    this.createTabIcon(tab);
    this.createTabPanel(tab);
    this.tabs.push(tab);
    if (switchTo) this.switchToTab(tabId);
    this.loadGame(tab, game.path);
    this.saveTabsToStorage();
    this.updateEmptyState();
    return tab;
  },

  createTabIcon(tab) {
    const sidePanelTabs = document.getElementById('side-panel-tabs');
    if (!sidePanelTabs) return;

    const tabIcon = document.createElement('button');
    tabIcon.id = `tab-icon-${tab.id}`;
    tabIcon.className = `side-panel-tab${tab.loading ? ' loading' : ''}`;
    tabIcon.dataset.tabId = tab.id;
    tabIcon.dataset.color = tab.color;
    tabIcon.setAttribute('data-title', tab.title);
    tabIcon.setAttribute('role', 'tab');
    tabIcon.setAttribute('aria-selected', 'false');
    tabIcon.setAttribute('aria-label', `Switch to ${tab.title}`);
    tabIcon.draggable = true;
    tabIcon.innerHTML = `
      <i data-lucide="${tab.icon}" class="side-panel-tab-icon"></i>
      <button class="side-panel-tab-close" data-tab-id="${tab.id}" data-title="Close Tab" aria-label="Close ${tab.title}" type="button">
        <i data-lucide="x"></i>
      </button>
    `;

    tabIcon.addEventListener('click', (e) => {
      if (!e.target.closest('.side-panel-tab-close')) {
        this.switchToTab(tab.id);
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.togglePinTab(tab.id);
    });

    // Right-click context menu
    tabIcon.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showTabContextMenu(e.clientX, e.clientY, tab.id);
    });

    // Drag and Drop implementation
    tabIcon.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id);
      setTimeout(() => tabIcon.classList.add('dragging'), 0);
    });

    tabIcon.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tabIcon.classList.add('drag-over');
    });

    tabIcon.addEventListener('dragleave', () => {
      tabIcon.classList.remove('drag-over');
    });

    tabIcon.addEventListener('drop', (e) => {
      e.preventDefault();
      tabIcon.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (draggedTabId && draggedTabId !== tab.id) {
        const draggedTab = this.tabs.find(t => t.id === draggedTabId);
        if (draggedTab && draggedTab.groupId === tab.groupId) {
          // Same group: reorder
          this.reorderTabs(draggedTabId, tab.id);
        } else if (draggedTab) {
          // Different group or ungrouped: move to this tab's group
          this.moveTabToGroup(draggedTabId, tab.groupId);
        }
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('dragend', () => {
      tabIcon.classList.remove('dragging');
      document.querySelectorAll('.side-panel-tab').forEach(el => el.classList.remove('drag-over'));
      document.querySelectorAll('.tab-group-header').forEach(el => el.classList.remove('drag-over'));
    });

    // Touch drag support
    this.attachTouchDragToTab(tabIcon, tab.id);

    const closeBtn = tabIcon.querySelector('.side-panel-tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeTab(closeBtn.dataset.tabId);
      });
    }

    // If tab has a group, append to group container; otherwise append to side panel
    if (tab.groupId) {
      const groupEl = document.getElementById(tab.groupId);
      const tabsContainer = groupEl?.querySelector('.tab-group-tabs');
      if (tabsContainer) {
        tabsContainer.appendChild(tabIcon);
      } else {
        sidePanelTabs.appendChild(tabIcon);
      }
    } else {
      sidePanelTabs.appendChild(tabIcon);
    }
    Utils.refreshIcons();
    tab.iconElement = tabIcon;
  },

  togglePinTab(tabId, forceState = null) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    tab.pinned = forceState !== null ? forceState : !tab.pinned;

    if (tab.iconElement) {
      tab.iconElement.classList.toggle('pinned', tab.pinned);
    }

    // Move pinned tabs to the front natively (but keep active state etc)
    this.reorderAllTabsByPinStatus();
    this.saveTabsToStorage();
    if (forceState === null) AudioEngine.click();
  },

  reorderAllTabsByPinStatus() {
    // Sort within each group context: ungrouped first, then by group order
    const groupOrder = new Map();
    this.groups.forEach((g, i) => groupOrder.set(g.id, i));

    this.tabs.sort((a, b) => {
      // First by group: ungrouped first, then groups in order
      const aGroupIdx = a.groupId ? (groupOrder.get(a.groupId) ?? 999) : -1;
      const bGroupIdx = b.groupId ? (groupOrder.get(b.groupId) ?? 999) : -1;
      if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;

      // Then by pin status within same group
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return 0;
    });

    this.renderGroups();
  },

  reorderTabs(draggedId, targetId) {
    const draggedIndex = this.tabs.findIndex(t => t.id === draggedId);
    const targetIndex = this.tabs.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedTab = this.tabs[draggedIndex];
    const targetTab = this.tabs[targetIndex];

    // Only reorder if in same group
    if (draggedTab.groupId !== targetTab.groupId) return;

    // Rearrange in array
    this.tabs.splice(draggedIndex, 1);
    const newTargetIndex = this.tabs.findIndex(t => t.id === targetId);
    this.tabs.splice(newTargetIndex, 0, draggedTab);

    // Maintain pin rule within group
    this.reorderAllTabsByPinStatus();

    this.saveTabsToStorage();
  },

  createTabPanel(tab) {
    const tabContentArea = document.getElementById('tab-content-area');
    if (!tabContentArea) return;

    const panel = document.createElement('div');
    panel.id = `tab-panel-${tab.id}`;
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-icon-${tab.id}`);
    panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    iframe.setAttribute('aria-label', `${tab.title} game content`);

    panel.appendChild(iframe);
    tabContentArea.appendChild(panel);
    tab.panel = panel;
    tab.iframe = iframe;
  },

  loadGame(tab, path) {
    if (!tab.iframe) return;

    tab.iframe.src = path;
    tab.iframe.onload = () => {
      tab.loading = false;
      tab.panel.classList.add('loaded');
      tab.iconElement?.classList.remove('loading');
      if (this.activeTabId === tab.id) tab.iframe.focus();
    };

    tab.iframe.onerror = () => {
      tab.loading = false;
      const loadingDiv = tab.panel.querySelector('.tab-loading');
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <i data-lucide="alert-circle" style="width:4rem;height:4rem;color:#ef4444"></i>
          <div class="loading-text" style="color:#ef4444">FAILED TO LOAD</div>
          <p style="color:#ef4444;font-size:0.875rem;margin-top:1rem">Path: ${path}</p>
          <button class="btn-chunky bg-blue text-white px-6 py-3 rounded-xl mt-4" onclick="TabManager.retryLoad('${tab.id}')">
            <i data-lucide="rotate-cw" class="w-5 h-5 inline mr-2"></i>RETRY
          </button>
        `;
        Utils.refreshIcons();
      }
    };

    setTimeout(() => {
      if (tab.loading) {
        tab.loading = false;
        tab.panel.classList.add('loaded');
        tab.iconElement?.classList.remove('loading');
      }
    }, CONFIG.loadTimeout);
  },

  retryLoad(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    const game = tab && State.getGameById(tab.gameId);
    if (!tab || !game) return;

    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.panel.classList.remove('loaded');
    tab.panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    tab.panel.appendChild(iframe);
    tab.iframe = iframe;
    this.loadGame(tab, game.path);
  },

  switchToTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;
    this.tabs.forEach(t => {
      const isActive = t.id === tabId;
      t.iconElement?.classList.toggle('active', isActive);
      t.iconElement?.setAttribute('aria-selected', String(isActive));
      t.panel?.classList.toggle('active', isActive);
      if (!isActive && t.iframe) {
        // Preserve iframe but stop JS execution
        t.iframe.style.display = 'none';
      } else if (isActive) {
        t.iframe.style.display = 'block';
      }
    });

    const game = State.getGameById(tab.gameId);
    if (game) {
      State.activeGame = game;
      HistoryManager.trackTabOpen(game.id);
    }

    if (window.location.hash !== `#${tab.gameId}`) {
      history.pushState(null, null, `#${tab.gameId}`);
    }

    tab.iconElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.updateSplitScreenClasses();
    this.saveTabsToStorage();
  },

  toggleSplitScreen() {
    if (this.tabs.length < 2) {
      // Need at least 2 tabs to split screen
      const section = document.body;
      const warning = document.createElement('div');
      warning.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-xl shadow-hard z-[100] animate-pop-in font-bold text-sm flex items-center gap-3';
      warning.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-blue"></i> Open at least 2 activities to use Split Screen`;
      document.body.appendChild(warning);
      Utils.refreshIcons();
      setTimeout(() => warning.remove(), 3000);
      return;
    }

    this.splitScreenActive = !this.splitScreenActive;
    AudioEngine.click();

    if (this.splitScreenActive) {
      // Find the most recently used other tab, or just the first other tab
      const otherTabs = this.tabs.filter(t => t.id !== this.activeTabId);
      this.rightTabId = otherTabs[0].id; // Simple for now: just grab the first other tab
    } else {
      this.rightTabId = null;
    }

    this.updateSplitScreenClasses();
  },

  updateEmptyState() {
    const emptyState = document.getElementById('workspace-empty-state');
    if (!emptyState) return;
    if (this.tabs.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  },

  updateSplitScreenClasses() {
    const area = document.getElementById('tab-content-area');
    if (!area) return;

    if (this.splitScreenActive && this.tabs.length >= 2) {
      area.classList.add('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;

        const isLeft = tab.id === this.activeTabId;
        const isRight = tab.id === this.rightTabId;

        tab.panel.classList.toggle('split-left', isLeft);
        tab.panel.classList.toggle('split-right', isRight);

        if (isLeft || isRight) {
          tab.panel.classList.add('active');
          if (tab.iframe) tab.iframe.style.display = 'block';
        } else {
          tab.panel.classList.remove('active', 'split-left', 'split-right');
          if (tab.iframe) tab.iframe.style.display = 'none';
        }
      });
    } else {
      this.splitScreenActive = false; // Reset if tabs fell below 2
      area.classList.remove('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;
        const isActive = tab.id === this.activeTabId;
        tab.panel.classList.remove('split-left', 'split-right');
        tab.panel.classList.toggle('active', isActive);
        if (tab.iframe) tab.iframe.style.display = isActive ? 'block' : 'none';
      });
    }

    // Attempt to resize or trigger a window resize event so games adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  },

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    const wasActive = this.activeTabId === tabId;
    const hadGroup = tab.groupId;

    tab.iconElement?.remove();
    tab.panel?.remove();
    this.tabs.splice(tabIndex, 1);

    if (this.tabs.length === 0) {
      this.splitScreenActive = false;
      this.activeTabId = null;
      this.updateEmptyState();
      // Auto-close workspace when no tabs remain
      this.closeModal();
      return;
    }

    if (tabId === this.rightTabId) {
      this.rightTabId = null;
      this.splitScreenActive = false;
    }

    this.saveTabsToStorage();
    if (wasActive) {
      const newIndex = Math.min(tabIndex, this.tabs.length - 1);
      this.switchToTab(this.tabs[newIndex].id);
    } else {
      this.updateSplitScreenClasses();
    }

    // Update group count if tab was in a group
    if (hadGroup) {
      const groupEl = document.getElementById(hadGroup);
      const countBadge = groupEl?.querySelector('.tab-group-count');
      if (countBadge) countBadge.textContent = this.tabs.filter(t => t.groupId === hadGroup).length;
    }

    AudioEngine.click();
  },

  closeCurrentTab() {
    if (this.activeTabId) this.closeTab(this.activeTabId);
  },

  returnToHome() {
    this.closeModal();
    AudioEngine.click();
  },

  closeModal() {
    UI.toggleModal('game-modal', false);
    const infoOverlay = document.getElementById('info-overlay');
    if (infoOverlay) {
      infoOverlay.classList.add('hidden');
      infoOverlay.classList.remove('flex');
    }
    this.activeTabId = null;
    State.activeGame = null;
    history.pushState("", document.title, window.location.pathname + window.location.search);
    this.saveTabsToStorage();
  },

  confirmCloseAllTabs() {
    if (this.tabs.length === 0) return;
    const confirmModal = document.getElementById('confirm-modal');
    const countSpan = document.getElementById('confirm-count');
    if (!confirmModal) return;
    if (countSpan) countSpan.textContent = this.tabs.length;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
    Utils.refreshIcons();
  },

  cancelConfirmation() {
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.classList.add('hidden');
      confirmModal.classList.remove('flex');
    }
  },

  closeAllTabsConfirmed() {
    this.cancelConfirmation();
    if (this.tabs.length === 0) return;

    const tabsToKeep = [];

    this.tabs.forEach(tab => {
      if (tab.pinned) {
        tabsToKeep.push(tab);
      } else {
        tab.iconElement?.remove();
        tab.panel?.remove();
      }
    });

    this.tabs = tabsToKeep;

    // If active tab was closed, switch to the last pinned one or null
    if (!this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
    }

    if (this.tabs.length === 0) {
      State.activeGame = null;
      Storage.remove(CONFIG.storageKeys.tabs);
      this.activeTabId = null;
      this.updateEmptyState();
    } else {
      if (this.activeTabId) this.switchToTab(this.activeTabId);
      this.saveTabsToStorage();
      this.renderGroups();
    }

    AudioEngine.click();
  },

  reloadCurrentTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab?.iframe) return;
    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.iframe.contentWindow.location.reload();
    setTimeout(() => {
      tab.loading = false;
      tab.iconElement?.classList.remove('loading');
    }, 1000);
  },

  getCurrentTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  },

  showMaxTabsWarning() {
    const existingWarning = document.querySelector('.max-tabs-warning');
    if (existingWarning) existingWarning.remove();

    const warning = document.createElement('div');
    warning.className = 'max-tabs-warning';
    warning.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 inline mr-2"></i>Maximum ${CONFIG.maxTabs} tabs open. Close a tab to open another.`;
    document.body.appendChild(warning);
    Utils.refreshIcons();

    setTimeout(() => {
      warning.style.opacity = '0';
      warning.style.transform = 'translateX(-50%) translateY(-20px)';
      warning.style.transition = 'all 0.3s ease';
      setTimeout(() => warning.remove(), 300);
    }, 3000);
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('game-modal');
      if (!modal || modal.style.display === 'none') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.altKey) {
        e.preventDefault();
        this.switchToNextTab(e.shiftKey ? -1 : 1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.closeCurrentTab();
      }
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (this.tabs[index]) this.switchToTab(this.tabs[index].id);
      }
      if (e.key === 'Escape') {
        const infoOverlay = document.getElementById('info-overlay');
        if (infoOverlay && !infoOverlay.classList.contains('hidden')) {
          GameModal.toggleInfo();
        } else {
          this.returnToHome();
        }
      }
    });
  },



  toggleSidePanelMobile() {
    AudioEngine.click();
    const panel = document.getElementById('side-panel');
    if (!panel) return;
    panel.classList.toggle('open');
  },

  switchToNextTab(direction = 1) {
    if (this.tabs.length === 0) return;
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    if (currentIndex === -1) {
      this.switchToTab(this.tabs[0].id);
      return;
    }
    let newIndex = currentIndex + direction;
    if (newIndex >= this.tabs.length) newIndex = 0;
    else if (newIndex < 0) newIndex = this.tabs.length - 1;
    this.switchToTab(this.tabs[newIndex].id);
    AudioEngine.click();
  }
};

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

// --- GAME MODAL ---
const GameModal = {
  open(gameId, element = null) {
    AudioEngine.click();
    const game = State.getGameById(gameId);
    if (!game) return console.error(`Game not found: ${gameId}`);

    // Privilege Check: Unauthorized Pro Tool Access
    if (game.pro && !State.isPro()) {
      UI.showToast("This tool is exclusive to PRO users", "warning");
      return;
    }

    RecentGames.add(gameId);
    HistoryManager.trackTabOpen(gameId);

    if (element) {
      UI.animateModalOpen(element, 'game-modal');
    } else {
      UI.toggleModal('game-modal', true);
    }

    TabManager.createTab(game);
  },

  close() {
    TabManager.returnToHome();
  },

  reload() {
    TabManager.reloadCurrentTab();
  },

  toggleInfo() {
    AudioEngine.click();
    const overlay = document.getElementById('info-overlay');
    if (!overlay) return;

    const isHidden = overlay.classList.contains('hidden');
    if (isHidden) {
      const currentTab = TabManager.getCurrentTab();
      const game = currentTab && State.getGameById(currentTab.gameId);
      if (!game) return;
      this.renderInfo(game);
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      overlay.querySelector('button')?.focus();
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      const currentTab = TabManager.getCurrentTab();
      if (currentTab?.iframe) currentTab.iframe.focus();
    }
  },

  renderInfo(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}`;

    const iconEl = document.getElementById('info-icon');
    const titleEl = document.getElementById('info-title-display');
    const categoryEl = document.getElementById('info-category');
    const difficultyEl = document.getElementById('info-difficulty');
    const contentEl = document.getElementById('info-content');

    if (iconEl) {
      iconEl.className = `w-24 h-24 rounded-2xl border-4 border-dark dark:border-slate-500 flex items-center justify-center text-white shadow-hard dark:shadow-neon shrink-0 ${bgClass}`;
      iconEl.innerHTML = `<i data-lucide="${game.icon}" class="w-12 h-12"></i>`;
    }
    if (titleEl) titleEl.textContent = game.title.toUpperCase();
    if (categoryEl) categoryEl.textContent = game.category.toUpperCase();
    if (difficultyEl) {
      difficultyEl.textContent = game.difficulty?.toUpperCase() || '';
      difficultyEl.style.display = game.difficulty ? 'inline-block' : 'none';
    }
    if (contentEl) contentEl.innerHTML = GameGrid.getGuideText(game);
    Utils.refreshIcons();
  }
};

// --- SEARCH ---
const Search = {
  setup() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (input) {
      input.addEventListener('input', (e) => {
        Filters.setSearch(e.target.value);
        if (clearBtn) clearBtn.classList.toggle('hidden', e.target.value.length === 0);
      });
    }
  },

  clear() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    Filters.setSearch('');
  }
};

// --- DATA LOADER ---
const DataLoader = {
  async loadGames() {
    const response = await fetch(CONFIG.dataSource);
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load games data`);
    const data = await response.json();
    if (!this.validateData(data)) throw new Error('Invalid games data structure');
    return data;
  },

  validateData(data) {
    const games = data.games || data;
    if (!Array.isArray(games)) {
      console.error('Games data must be an array');
      return false;
    }
    const requiredFields = ['id', 'title', 'category', 'path', 'icon', 'color'];
    for (const game of games) {
      for (const field of requiredFields) {
        if (!game[field]) {
          console.error(`Game "${game.title || 'unknown'}" missing required field: ${field}`);
          return false;
        }
      }
    }
    return true;
  }
};

// --- FOOTER ---
const Footer = {
  render() {
    const el = document.getElementById('footer-version');
    if (!el || !State.metadata) return;
    const version = State.metadata.version || '';
    const updated = State.metadata.lastUpdated || '';
    const parts = [];
    if (version) parts.push(`v${version}`);
    if (updated) parts.push(`Updated ${updated}`);
    el.innerHTML = parts.join('<br>');
  }
};

// --- BUG REPORT ---
const BugReport = {
  open() {
    AudioEngine.click();
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (loader) loader.style.opacity = '1';
    iframe.src = CONFIG.helpUrl;

    iframe.onload = () => {
      if (loader) loader.style.opacity = '0';
      iframe.classList.remove('opacity-0');
      iframe.classList.add('opacity-100');
      setTimeout(() => { if (loader) loader.style.display = 'none'; }, 300);
    };
  },

  close() {
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    iframe.src = 'about:blank';
    iframe.classList.add('opacity-0');
    iframe.classList.remove('opacity-100');
    if (loader) {
      loader.style.display = 'flex';
      loader.style.opacity = '1';
    }
    AudioEngine.click();
  }
};

// --- APP CONTROLLER ---
const App = {
  async init() {
    await requireAuth();
    try {
      FloatingTooltip.init();
      State.userProfile = await getUserProfile();
      Theme.load();
      UI.updateGreeting();
      UI.updateUserUI();
      UI.showLoading();

      // Cloud Persistence: Sync with cloud BEFORE loading games or initialization
      // This ensures pinned/recent items are up to date
      const dataChanged = await Storage.syncWithCloud();
      if (dataChanged) {
        console.log('[CloudPersistence] Local state updated from cloud. Refreshing theme...');
        Theme.load();
      }

      // Handle migration if needed
      if (typeof migrateLocalToCloud === 'function') {
        migrateLocalToCloud();
      }

      const data = await DataLoader.loadGames();
      State.setGames(data);
      // Store top-level metadata for footer
      if (data.version) State.metadata = { ...(State.metadata || {}), version: data.version, lastUpdated: data.lastUpdated };

      ViewMode.init();
      GameGrid.render();
      PinnedGames.render();
      Hero.init();
      Footer.render();
      Search.setup();
      const activity = await (typeof checkUserActivity === 'function' ? checkUserActivity() : Promise.resolve(null));
      LandingPage.init(activity);

      document.body.addEventListener('click', () => AudioEngine.init(), { once: true });

      TabManager.init();
      this.setupKeyboardShortcuts();
      this.setupEventDelegation();
      this.setupHistoryListener();

      const hash = window.location.hash.substring(1);
      if (hash && !TabManager.tabs.find(t => t.gameId === hash)) {
        GameModal.open(hash);
      }

      Utils.refreshIcons();
    } catch (error) {
      console.error('Initialization error:', error);
      UI.showError('Failed to load activities. Please refresh the page.');
    }
  },

  setupHistoryListener() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.substring(1);
      if (!hash) {
        TabManager.returnToHome();
      } else {
        const existingTab = TabManager.tabs.find(t => t.gameId === hash);
        if (existingTab) {
          TabManager.switchToTab(existingTab.id);
          document.getElementById('game-modal')?.classList.remove('hidden');
        } else {
          GameModal.open(hash);
        }
      }
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }

      if (e.key === 'Escape') {
        const infoOverlay = document.getElementById('info-overlay');
        if (infoOverlay && !infoOverlay.classList.contains('hidden')) {
          GameModal.toggleInfo();
          return;
        }
        
        // Exit My Space Fullscreen
        if (document.body.classList.contains('myspace-fullscreen')) {
          MySpace.toggleFullscreen();
          return;
        }

        const modal = document.getElementById('game-modal');
        if (modal && !modal.classList.contains('hidden') && modal.style.display !== 'none') {
          TabManager.returnToHome();
        }
      }

      // My Space Fullscreen Shortcut
      if ((e.key === 'f' || e.key === 'F') && 
          ViewManager.currentView === 'myspace' && 
          document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        MySpace.toggleFullscreen();
      }
    });

    // Handle Native Fullscreen Changes (Esc key, etc)
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      const icon = document.getElementById('myspace-fs-icon');
      if (icon) {
        icon.setAttribute('data-lucide', isFs ? 'minimize-2' : 'maximize');
        Utils.refreshIcons(icon.parentElement);
      }
      
      if (!isFs) {
        document.body.classList.remove('myspace-fullscreen');
      }
    });
  },

  setupEventDelegation() {
    const actions = {
      toggleTheme: () => Theme.toggle(),
      toggleSound: () => AudioEngine.toggle(),
      openGame: (param) => GameModal.open(param),
      toggleNotifications: () => Announcements.togglePanel(),
      returnToHome: () => TabManager.returnToHome(),
      closeAllTabs: () => TabManager.confirmCloseAllTabs(),
      confirmDelete: () => TabManager.closeAllTabsConfirmed(),
      confirmCancel: () => TabManager.cancelConfirmation(),
      closeCurrentTab: () => TabManager.closeCurrentTab(),
      reloadGame: () => TabManager.reloadCurrentTab(),
      toggleSplitScreen: () => TabManager.toggleSplitScreen(),
      toggleFocus: () => UI.toggleFocus(),
      toggleSettings: () => UI.toggleSettings(),
      toggleTimer: () => Timer.toggle(),
      toggleInfo: () => GameModal.toggleInfo(),
      openWorkspace: () => {
        AudioEngine.click();

        // Check if there are any active tabs
        if (TabManager.tabs.length === 0) {
          UI.showToast('No active tabs. Open an activity first!', 'warning', 3000);
          return;
        }

        UI.toggleModal('game-modal', true);
        TabManager.updateEmptyState();
      },

      toggleSidePanelMobile: () => TabManager.toggleSidePanelMobile(),
      toggleRecentCollapse: () => RecentGames.toggleCollapse(),
      filterGames: (param) => Filters.setCategory(param),
      clearRecent: () => RecentGames.clear(),
      clearSearch: () => Search.clear(),
      togglePin: (param) => { PinnedGames.toggle(param); Hero.updateStats(); },
      surpriseMe: () => Hero.surpriseMe(),
      continueGame: (param) => GameModal.open(param),
      openFeedback: () => BugReport.open(),
      openBugReport: () => BugReport.open(),
      closeBugReport: () => BugReport.close(),
      showLanding: () => LandingPage.showLanding(),
      showLibrary: () => LandingPage.showLibrary(),
      setViewMode: (param) => ViewMode.set(param)
    };

    document.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('[data-action="togglePin"]');
      if (pinBtn) {
        e.stopPropagation();
        e.preventDefault();
      }

      const target = e.target.closest('[data-action]');

      const settingsContainer = document.getElementById('settings-container');
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsContainer && settingsMenu && !settingsMenu.classList.contains('opacity-0')) {
        const isToggleButton = target && target.dataset.action === 'toggleSettings';
        if (!isToggleButton && (!settingsContainer.contains(e.target) || target)) {
          settingsMenu.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
          settingsMenu.classList.remove('translate-y-0');
          const icon = settingsContainer.querySelector('[data-action="toggleSettings"] i');
          if (icon) icon.classList.remove('rotate-90');
        }
      }

      if (!target) return;
      const action = actions[target.dataset.action];
      if (action) {
        if (target.dataset.action === 'openGame') {
          action(target.dataset.param, target);
        } else {
          action(target.dataset.param);
        }
      }
    });
  }
};

// --- DISPLAY NAME EDITING ---
function initDisplayNameEditor() {
  const editBtn = document.getElementById('auth-edit-name-btn');
  const modal = document.getElementById('display-name-modal');
  const input = document.getElementById('display-name-input');
  const cancelBtn = document.getElementById('display-name-cancel');
  const saveBtn = document.getElementById('display-name-save');
  const errorEl = document.getElementById('display-name-error');
  const usernameEl = document.getElementById('auth-username');

  if (!editBtn || !modal || !input) return;

  function openModal() {
    const currentName = usernameEl?.textContent || '';
    input.value = currentName;
    errorEl.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    input.focus();
    input.select();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  async function saveDisplayName() {
    const newName = input.value.trim();
    if (!newName) {
      errorEl.textContent = 'Please enter a display name';
      errorEl.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Saving...';
    lucide?.createIcons?.();

    const result = await updateDisplayName(newName);

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Save';
    lucide?.createIcons?.();

    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
    } else {
      if (usernameEl) usernameEl.textContent = newName;
      closeModal();
    }
  }

  editBtn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  saveBtn?.addEventListener('click', saveDisplayName);

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveDisplayName();
    if (e.key === 'Escape') closeModal();
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// --- AUTH INDICATOR ---
async function initAuthIndicator() {
  const signInLink = document.getElementById('auth-signin-link');
  const loggedInDiv = document.getElementById('auth-logged-in');
  const usernameEl = document.getElementById('auth-username');

  if (!signInLink || !loggedInDiv) return;

  const user = await getUser();
  if (user) {
    signInLink.classList.add('hidden');
    loggedInDiv.classList.remove('hidden');
    
    if (user.is_sandbox) {
      if (usernameEl) usernameEl.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-green"></i> Sandbox Mode</span>';
      return;
    }

    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    if (usernameEl) usernameEl.textContent = displayName;

    // Check if admin and show link
    console.log('[HubAuth] Querying role for UID:', user.id);
    const { data: profile, error: roleError } = await db
      .from('profiles').select('role').eq('id', user.id).single();
    
    if (roleError) {
      console.error('[HubAuth] ERROR CODE:', roleError.code);
      console.error('[HubAuth] ERROR MESSAGE:', roleError.message);
      console.error('[HubAuth] FULL ERROR OBJECT:', roleError);
    }
    
    console.log('[HubAuth] RAW PROFILE DATA:', profile);
    console.log('[HubAuth] FINAL DETECTED ROLE:', profile?.role);

    if (profile?.role === 'admin') {
      console.log("[HubAuth] Success! Admin access granted.");
      const adminLink = document.getElementById('auth-admin-link');
      if (adminLink) adminLink.classList.remove('hidden');
    }
  } else {
    console.log("is user")
    signInLink.classList.remove('hidden');
    loggedInDiv.classList.add('hidden');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
    initAuthIndicator();
    initDisplayNameEditor();
  });
} else {
  App.init();
  initAuthIndicator();
  initDisplayNameEditor();
}
// --- MOBILE UI HELPERS ---
const MobileUI = {
  openSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (s && b) {
      s.classList.remove('hidden');
      setTimeout(() => s.classList.remove('-translate-x-full'), 10);
      b.classList.add('active');
    }
  },
  closeSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (s && b) {
      s.classList.add('-translate-x-full');
      setTimeout(() => s.classList.add('hidden'), 300);
      b.classList.remove('active');
    }
  }
};

// --- EXPORTS ---
window.App = App;
window.AudioEngine = AudioEngine;
window.TabManager = TabManager;
window.HistoryManager = HistoryManager;
window.Timer = Timer;
window.LandingPage = LandingPage;
window.MySpace = MySpace;
window.MobileUI = MobileUI;
window.filterGames = (category) => Filters.setCategory(category);
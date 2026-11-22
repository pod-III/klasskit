// KlassKit Hub — UI Helpers, Hero, StorageManager, Announcements, Recents, History & Pins

const UI = {
  updateGreeting() {
    const hour = new Date().getHours();
    let greeting = "";

    if (hour < 12) greeting = "Good Morning, Teacher!";
    else if (hour < 15) greeting = "Good Afternoon!";
    else if (hour < 18) greeting = "Almost the weekend?";
    else greeting = "Good Evening!";

    document.querySelectorAll(".greeting-display").forEach(el => {
      el.textContent = greeting;
    });

    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric"
    });
    const dateEl = document.getElementById("date-display");
    if (dateEl) {
      dateEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dateStr}`;
    }
    document.querySelectorAll(".date-text").forEach(el => {
      el.textContent = dateStr;
    });

    this.updateDailyTip();
  },

  applyProStyles() {
    this.updateUserUI();
  },

  updateUserUI() {
    if (typeof isSandbox === 'function' && isSandbox()) {
      document.querySelectorAll('.pro-only-card, .pro-only-btn').forEach(el => el.classList.add('hidden'));
      document.getElementById('auth-admin-link')?.classList.add('hidden');
      return;
    }

    const profile = State.userProfile;
    if (!profile) {
      document.querySelectorAll('.pro-only-card, .pro-only-btn').forEach(el => el.classList.add('hidden'));
      return;
    }

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
      if (editBtn && nameEl && !document.getElementById('pro-badge')) {
        const badge = document.createElement('span');
        badge.id = 'pro-badge';
        badge.className = 'ml-1.5 px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[9px] font-black text-white rounded-md shadow-sm animate-pop-in';
        badge.textContent = 'PRO';
        nameEl.after(badge);
      }

      // Show pro-only cards and buttons on landing page
      document.querySelectorAll('.pro-only-card').forEach(card => {
        card.classList.remove('hidden');
      });
      document.querySelectorAll('.pro-only-btn').forEach(btn => {
        btn.classList.remove('hidden');
      });
    } else {
      // Explicitly hide pro-only elements for non-pro users
      document.querySelectorAll('.pro-only-card').forEach(card => {
        card.classList.add('hidden');
      });
      document.querySelectorAll('.pro-only-btn').forEach(btn => {
        btn.classList.add('hidden');
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
    const html = `<i data-lucide="lightbulb" class="w-4 h-4 shrink-0"></i> Tip: ${tips[tipIndex]}`;
    document.querySelectorAll('#daily-tip, .daily-tip-text').forEach(el => {
      el.innerHTML = html;
    });
  },

  showError(message) {
    this.hideLoading();
    document.querySelectorAll('.section-view').forEach(v => { v.style.display = 'none'; });
    const errorState = document.getElementById('hub-error-state');
    const errorMsg = document.getElementById('hub-error-message');
    if (errorMsg) errorMsg.textContent = message || 'Failed to load activities. Please refresh the page.';
    if (errorState) errorState.classList.remove('hidden');
    Utils.refreshIcons(errorState);
  },

  showLoading() {
    const loadingState = document.getElementById('hub-loading-state');
    const errorState = document.getElementById('hub-error-state');
    if (errorState) errorState.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');
  },

  hideLoading() {
    const loadingState = document.getElementById('hub-loading-state');
    if (loadingState) loadingState.classList.add('hidden');
  },

  syncDrawerBackdrop() {
    const backdrop = document.getElementById('drawer-backdrop');
    if (!backdrop) return;
    const annOpen = !document.getElementById('notification-panel')?.classList.contains('translate-x-full');
    const histOpen = !document.getElementById('history-panel')?.classList.contains('translate-x-full');
    backdrop.classList.toggle('active', annOpen || histOpen);
  },

  closeAllDrawers(restoreFocus = true) {
    Announcements?.togglePanel?.(false, restoreFocus);
    HistoryManager?.togglePanel?.(false, restoreFocus);
    this.syncDrawerBackdrop();
  },

  _focusReturnMap: new Map(),

  rememberFocus(containerId) {
    const activeEl = document.activeElement;
    const container = document.getElementById(containerId);
    if (activeEl && activeEl !== document.body && (!container || !container.contains(activeEl))) {
      this._focusReturnMap.set(containerId, activeEl);
    }
  },

  restoreFocus(containerId, fallbackEl = null) {
    const savedEl = this._focusReturnMap.get(containerId);
    this._focusReturnMap.delete(containerId);
    const target = (savedEl && savedEl.isConnected && savedEl.offsetParent !== null) ? savedEl : fallbackEl;
    if (target && typeof target.focus === 'function') {
      requestAnimationFrame(() => target.focus());
    }
  },

  toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const wasHidden = modal.classList.contains('hidden');
    if (show && wasHidden) this.rememberFocus(modalId);

    modal.style.display = '';
    modal.classList.toggle('hidden', !show);
    modal.setAttribute('aria-hidden', String(!show));
    if (modalId === 'game-modal') {
      document.body.style.overflow = show ? 'hidden' : '';
      document.body.classList.toggle('game-modal-open', show);
      if (show) {
        if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
        this.closeAllDrawers(false);
      }
    }
    if (show && modalId === 'ann-detail-modal') {
      requestAnimationFrame(() => modal.querySelector('button')?.focus());
    }
    if (!show && !wasHidden) {
      this.restoreFocus(modalId);
    }
  },

  _focusHintShown: false,

  toggleFocus() {
    AudioEngine.click();
    const isEntering = document.body.classList.toggle('focus-mode');

    if (isEntering && !this._focusHintShown) {
      this._focusHintShown = true;
      this.showToast('Focus Mode active — press Esc or top-left button to exit', 'info', 2800);
    }

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

    const toggleBtn = container.querySelector('[data-action="toggleSettings"]');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(isClosed));

    const icon = container.querySelector('[data-action="toggleSettings"] svg, [data-action="toggleSettings"] i');
    if (icon) icon.classList.toggle('rotate-90', isClosed);
  },

  showToast(message, type = 'warning', duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const iconMap = {
      warning: 'alert-triangle',
      info: 'info',
      success: 'check-circle',
      error: 'x-circle'
    };

    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5" aria-hidden="true"></i>
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
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!modal || !element || reducedMotion) {
      this.toggleModal(modalId, true);
      return;
    }

    if (modal.classList.contains('hidden')) {
      this.rememberFocus(modalId);
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    modal.style.display = 'block';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.clipPath = `circle(0% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '0';
    modal.style.transition = 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';

    // Force reflow
    modal.offsetHeight;

    modal.style.clipPath = `circle(150% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '1';

    document.body.style.overflow = 'hidden';
    if (modalId === 'game-modal') {
      document.body.classList.add('game-modal-open');
      if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
      this.closeAllDrawers(false);
    }

    setTimeout(() => {
      modal.style.display = '';
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
    const active = State.games.filter(g => {
      if (g.active === false) return false;
      if (g.pro && !State.isPro()) return false;
      if (g.adminOnly && !State.isAdmin()) return false;
      return true;
    });
    const tools = active.filter(g => g.category === 'tool').length;
    const printables = active.filter(g => g.category === 'printable').length;
    const games = active.filter(g => g.category === 'game').length;
    const workshop = active.filter(g => g.category === 'workshop').length;
    const activities = tools + printables + games + workshop;
    const pinned = PinnedGames.get().filter(id => {
      const game = State.getGameById(id);
      if (!game) return false;
      if ((game.pro && !State.isPro()) || (game.adminOnly && !State.isAdmin())) return false;
      return true;
    }).length;

    const toolsEl = document.getElementById('stat-tools');
    const printablesEl = document.getElementById('stat-printables');
    const gamesEl = document.getElementById('stat-games');
    const workshopEl = document.getElementById('stat-workshop');
    const pinnedEl = document.getElementById('stat-pinned');

    if (toolsEl) toolsEl.textContent = tools;
    if (printablesEl) printablesEl.textContent = printables;
    if (gamesEl) gamesEl.textContent = games;
    if (workshopEl) workshopEl.textContent = workshop;
    if (pinnedEl) pinnedEl.textContent = pinned;

    document.querySelectorAll('[data-stat="tools"]').forEach(el => { el.textContent = tools; });
    document.querySelectorAll('[data-stat="printables"]').forEach(el => { el.textContent = printables; });
    document.querySelectorAll('[data-stat="games"]').forEach(el => { el.textContent = games; });
    document.querySelectorAll('[data-stat="workshop"]').forEach(el => { el.textContent = workshop; });
    document.querySelectorAll('[data-stat="activities"]').forEach(el => { el.textContent = activities; });

    document.querySelectorAll('[data-skill-query]').forEach(el => {
      const q = (el.dataset.skillQuery || '').toLowerCase();
      if (!q) return;
      const count = active.filter(g =>
        g.category !== 'myspace' &&
        g.category !== 'under-construction' &&
        (
          g.title.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags?.some(t => t.toLowerCase().includes(q))
        )
      ).length;
      const badge = el.querySelector('[data-skill-count]');
      if (badge) badge.textContent = `${count} ${count === 1 ? 'app' : 'apps'}`;
    });
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

    // Privilege check: don't show continue for restricted apps
    if ((lastGame.pro && !State.isPro()) || (lastGame.adminOnly && !State.isAdmin())) {
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

  surpriseMe(category = null) {
    AudioEngine.click();
    const scoped = ['tool', 'printable', 'game', 'workshop'].includes(category);
    const active = State.games.filter(g => {
      if (g.active === false) return false;
      if (g.pro && !State.isPro()) return false;
      if (g.adminOnly && !State.isAdmin()) return false;
      if (scoped && g.category !== category) return false;
      return true;
    });
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
        <div onclick="Announcements.viewDetail('${ann.id}')" role="button" tabindex="0"
          class="ann-card bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-dark dark:border-slate-600 shadow-sm hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in" 
          style="animation-delay: ${i * 0.1}s">
          
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-${color}/10 text-${color} flex items-center justify-center border-2 border-${color}/20">
                <i data-lucide="${icon}" class="w-3.5 h-3.5" aria-hidden="true"></i>
              </div>
              <div>
                <span class="text-[9px] font-black text-${color} uppercase tracking-widest">${ann.type}</span>
                <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${date}</div>
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-blue transition-colors" aria-hidden="true"></i>
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
      this.renderPanel();
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
      listEl.innerHTML = `
        <div class="text-center py-12 text-slate-400 font-bold">
          <i data-lucide="bell-off" class="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true"></i>
          <p>No notifications yet.</p>
        </div>
      `;
      Utils.refreshIcons(listEl);
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
        <div onclick="Announcements.viewDetail('${ann.id}')" role="button" tabindex="0"
          class="p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dark dark:border-slate-700 hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in relative overflow-hidden shadow-sm hover:shadow-md"
          style="animation-delay: ${i * 0.05}s">
          
          ${isUnread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-blue rounded-bl-lg"></div>' : ''}
          
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}" aria-hidden="true"></i>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${ann.type}</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
          </div>
          
          <h4 class="text-lg font-heading font-black text-dark dark:text-white mb-2 group-hover:text-blue transition-colors leading-tight">${ann.title}</h4>
          <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold line-clamp-2">${this.formatText(ann.content).replace(/<br>/g, ' ')}</p>
          
          <div class="mt-4 flex items-center gap-1 text-[10px] font-black text-blue uppercase tracking-widest opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            <span>Read More</span>
            <i data-lucide="chevron-right" class="w-3 h-3" aria-hidden="true"></i>
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

  togglePanel(show = null, restoreFocus = true) {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;

    const isVisible = !panel.classList.contains('translate-x-full');
    const targetShow = show !== null ? show : !isVisible;
    if (show === null || targetShow !== isVisible) AudioEngine.click();

    if (targetShow) {
      if (!isVisible) UI.rememberFocus('notification-panel');
      if (typeof HistoryManager !== 'undefined') HistoryManager.togglePanel(false, false);
      if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
      panel.classList.remove('translate-x-full');
      panel.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => panel.querySelector('[aria-label="Close Notifications"]')?.focus());
    } else {
      panel.classList.add('translate-x-full');
      panel.setAttribute('aria-hidden', 'true');
      if (isVisible && restoreFocus) UI.restoreFocus('notification-panel');
    }
    UI.syncDrawerBackdrop();
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
    Hero.updateContinueBtn();
    AudioEngine.click();
  },

  render() {
    const recentIds = this.get();
    const container = document.getElementById("recent-list");
    const section = document.getElementById("recent-section");
    const toggleBtn = document.getElementById("recent-toggle-btn");
    if (!container || !section) return;

    const showRecent = window.HubSettings ? window.HubSettings.get('showRecent') !== false : true;
    const collapsed = this.isCollapsed();

    // Filter visible recent games based on privileges
    const visibleGames = recentIds
      .map(id => State.getGameById(id))
      .filter(game => {
        if (!game) return false;
        if ((game.pro && !State.isPro()) || (game.adminOnly && !State.isAdmin())) return false;
        return true;
      });

    section.classList.toggle('hidden', !showRecent || visibleGames.length === 0);

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.setAttribute('aria-controls', 'recent-list');
      toggleBtn.innerHTML = `<i data-lucide="${collapsed ? 'chevron-down' : 'chevron-up'}" class="w-4 h-4" aria-hidden="true"></i>`;
      Utils.refreshIcons(toggleBtn);
    }

    if (!showRecent || visibleGames.length === 0) return;

    container.classList.toggle('hidden', collapsed);
    if (collapsed) return;

    container.innerHTML = visibleGames.map(game => `
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
      `).join('');
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

  togglePanel(show, restoreFocus = true) {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    const isVisible = !panel.classList.contains('translate-x-full');
    if (show === undefined) {
      show = !isVisible;
    }

    if (show) {
      if (!isVisible) UI.rememberFocus('history-panel');
      if (typeof Announcements !== 'undefined') Announcements.togglePanel(false, false);
      if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
      panel.classList.remove('translate-x-full');
      panel.setAttribute('aria-hidden', 'false');
      this.render();
      requestAnimationFrame(() => document.getElementById('history-search')?.focus());
    } else {
      panel.classList.add('translate-x-full');
      panel.setAttribute('aria-hidden', 'true');
      if (isVisible && restoreFocus) UI.restoreFocus('history-panel');
    }
    UI.syncDrawerBackdrop();
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
      // Privilege check: skip restricted apps
      if ((game.pro && !State.isPro()) || (game.adminOnly && !State.isAdmin())) return false;
      if (!this.searchTerm) return true;
      return game.title.toLowerCase().includes(this.searchTerm) ||
             game.category.toLowerCase().includes(this.searchTerm) ||
             (game.description || '').toLowerCase().includes(this.searchTerm);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400 font-bold">
          <i data-lucide="history" class="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true"></i>
          <p>${this.searchTerm ? 'No matching history found' : 'No tab history yet'}</p>
        </div>
      `;
      Utils.refreshIcons(container);
      return;
    }

    container.innerHTML = filtered.map(({ game, timeStr }) => `
      <div class="card p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-700 rounded-xl shadow-hard-sm hover:translate-y-[-2px] transition-all group cursor-pointer"
           role="button" tabindex="0" aria-label="Open ${game.title} (${this.formatTimeAgo(timeStr)})"
           onclick="HistoryManager.togglePanel(false, false); GameModal.open('${game.id}')">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-600 shadow-sm shrink-0 group-hover:scale-110 transition-transform">
            <i data-lucide="${game.icon}" class="w-5 h-5" aria-hidden="true"></i>
          </div>
          <div class="min-w-0 text-left">
            <div class="flex items-center gap-1.5">
              <h4 class="font-heading font-bold text-sm text-dark dark:text-white truncate group-hover:text-blue transition-colors">${game.title}</h4>
              ${game.pro ? '<span class="pro-badge px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[8px] font-black text-white rounded shadow-sm shrink-0">PRO</span>' : ''}
              ${game.new ? '<span class="new-badge px-1.5 py-0.5 bg-gradient-to-r from-green to-blue text-[8px] font-black text-white rounded shadow-sm shrink-0">NEW</span>' : ''}
            </div>
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
    ViewManager.renderAllGrids(); // Refresh library grids to update pin icons
    AudioEngine.click();
    return !isPinned;
  },

  render() {
    const pinnedIds = this.get();
    const container = document.getElementById("pinned-list");
    const section = document.getElementById("pinned-section");
    const badge = document.getElementById("pinned-count-badge");

    if (!container || !section) return;

    // Filter visible pinned games based on privileges
    const visibleGames = pinnedIds
      .map(id => State.getGameById(id))
      .filter(game => {
        if (!game) return false;
        if ((game.pro && !State.isPro()) || (game.adminOnly && !State.isAdmin())) return false;
        return true;
      });

    section.classList.toggle('hidden', visibleGames.length === 0);
    if (badge) badge.textContent = visibleGames.length;

    if (visibleGames.length === 0) return;

    const categoryLabels = { tool: 'Tool', printable: 'Printable', game: 'Game', workshop: 'Workshop', myspace: 'My Space', 'under-construction': 'WIP' };

    container.innerHTML = visibleGames.map(game => {
      const catLabel = categoryLabels[game.category] || game.category;
      return `
        <article class="pinned-card group relative bg-white dark:bg-slate-800 rounded-2xl border-3 border-dark dark:border-slate-500 shadow-hard-sm hover:shadow-hard hover:-translate-y-1 active:translate-y-[2px] active:shadow-none cursor-pointer transition-all duration-200 animate-pop-in overflow-hidden"
          data-action="openGame" data-param="${game.id}" role="button" tabindex="0" aria-label="Open ${game.title}">
          <div class="flex items-center gap-3 p-3">
            <div class="w-10 h-10 rounded-xl ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm shrink-0">
              <i data-lucide="${game.icon}" class="w-5 h-5" aria-hidden="true"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <div class="text-sm font-black text-dark dark:text-white truncate leading-tight">${game.title}</div>
                ${game.pro ? '<span class="pro-badge px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[8px] font-black text-white rounded shadow-sm shrink-0">PRO</span>' : ''}
                ${game.new ? '<span class="new-badge px-1.5 py-0.5 bg-gradient-to-r from-green to-blue text-[8px] font-black text-white rounded shadow-sm shrink-0">NEW</span>' : ''}
              </div>
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">${catLabel}</div>
            </div>
            <button data-action="togglePin" data-param="${game.id}" class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 text-slate-400 dark:text-slate-500 transition-all opacity-80 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 shrink-0" title="Unpin" aria-label="Unpin ${game.title}">
              <i data-lucide="pin-off" class="w-3.5 h-3.5" aria-hidden="true"></i>
            </button>
          </div>
        </article>
      `;
    }).join('');
    Utils.refreshIcons(container);
  }
};

// Stats module removed



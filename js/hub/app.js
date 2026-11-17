// KlassKit Hub — App Lifecycle, Search, Modals, Auth Indicator & MobileUI

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

    // Admin Check: Unauthorized Admin-Only Tool Access
    if (game.adminOnly && !State.isAdmin()) {
      UI.showToast("This tool is exclusive to ADMIN users", "warning");
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
      UI.rememberFocus('info-overlay');
      this.renderInfo(game);
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      overlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => overlay.querySelector('button')?.focus());
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      overlay.setAttribute('aria-hidden', 'true');
      const currentTab = TabManager.getCurrentTab();
      UI.restoreFocus('info-overlay', currentTab?.iframe || null);
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
    const proBadgeEl = document.getElementById('info-pro-badge');
    if (proBadgeEl) proBadgeEl.classList.toggle('hidden', !game.pro);
    const newBadgeEl = document.getElementById('info-new-badge');
    if (newBadgeEl) newBadgeEl.classList.toggle('hidden', !game.new);
    if (contentEl) contentEl.innerHTML = GameGrid.getGuideText(game);
    Utils.refreshIcons();
  }
};

// --- SEARCH ---
const Search = {
  _bound: false,

  setup() {
    if (this._bound) return;
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (input) {
      this._bound = true;
      input.addEventListener('input', (e) => {
        Filters.setSearch(e.target.value);
        if (clearBtn) clearBtn.classList.toggle('hidden', e.target.value.length === 0);
      });
    }
  },

  apply(term = '') {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const normalized = String(term).trim();
    if (input) input.value = normalized;
    if (clearBtn) clearBtn.classList.toggle('hidden', normalized.length === 0);
    State.filters.searchTerm = normalized.toLowerCase();
    ViewManager.renderAllGrids();
    ViewManager.show('library-all');
  },

  clear() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    State.filters.searchTerm = '';
    ViewManager.renderAllGrids();
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
    if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
    AudioEngine.click();
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    UI.rememberFocus('bug-report-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');

    if (loader) loader.style.opacity = '1';
    iframe.src = CONFIG.helpUrl;

    iframe.onload = () => {
      if (loader) loader.style.opacity = '0';
      iframe.classList.remove('opacity-0');
      iframe.classList.add('opacity-100');
      setTimeout(() => { if (loader) loader.style.display = 'none'; }, 300);
    };

    requestAnimationFrame(() => modal.querySelector('[data-action="closeBugReport"]')?.focus());
  },

  close() {
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    const wasVisible = !modal.classList.contains('hidden');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = 'about:blank';
    iframe.classList.add('opacity-0');
    iframe.classList.remove('opacity-100');
    if (loader) {
      loader.style.display = 'flex';
      loader.style.opacity = '1';
    }
    AudioEngine.click();
    if (wasVisible) UI.restoreFocus('bug-report-modal');
  }
};

// --- APP CONTROLLER ---
const App = {
  _listenersAttached: false,

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

      if (!this._listenersAttached) {
        document.body.addEventListener('click', () => AudioEngine.init(), { once: true });
      }

      TabManager.init();
      this.setupKeyboardShortcuts();
      this.setupEventDelegation();
      this.setupHistoryListener();
      this._listenersAttached = true;

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
    if (this._listenersAttached) return;
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.substring(1);
      if (!hash) {
        TabManager.returnToHome();
      } else {
        const existingTab = TabManager.tabs.find(t => t.gameId === hash);
        if (existingTab) {
          UI.toggleModal('game-modal', true);
          TabManager.switchToTab(existingTab.id);
        } else {
          GameModal.open(hash);
        }
      }
    });
  },

  isModalVisible(id) {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden') && el.style.display !== 'none');
  },

  handleGlobalKeydown(e, options = {}) {
    const isModalOpen = this.isModalVisible('game-modal');
    const target = e.target;
    const isEditable = Boolean(target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ));

    // Focus Hub search on '/' when not typing or inside an open workspace modal
    if (e.key === '/' && !options.fromIframe && !isEditable && !isModalOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
      return;
    }

    // Alt+H: Return Home from workspace or Hub views
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      if (isModalOpen) {
        TabManager.returnToHome();
      } else {
        LandingPage.showLanding();
      }
      return;
    }

    // Workspace-scoped shortcuts (active when #game-modal is open)
    if (isModalOpen) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        TabManager.reloadCurrentTab();
        AudioEngine.click();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.altKey) {
        e.preventDefault();
        TabManager.switchToNextTab(e.shiftKey ? -1 : 1);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W') && !isEditable) {
        e.preventDefault();
        TabManager.closeCurrentTab();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (TabManager.tabs[index]) TabManager.switchToTab(TabManager.tabs[index].id);
        return;
      }
    }

    // Priority-ordered Escape dismissal (highest stacking layer first)
    if (e.key === 'Escape') {
      if (this.isModalVisible('ann-detail-modal')) {
        Announcements.closeDetail();
        return;
      }

      if (this.isModalVisible('display-name-modal')) {
        const cancelBtn = document.getElementById('display-name-cancel');
        if (cancelBtn) {
          cancelBtn.click();
        } else {
          const dnModal = document.getElementById('display-name-modal');
          if (dnModal) {
            dnModal.classList.add('hidden');
            dnModal.style.display = 'none';
            dnModal.setAttribute('aria-hidden', 'true');
            UI.restoreFocus('display-name-modal');
          }
        }
        return;
      }

      if (this.isModalVisible('bug-report-modal')) {
        BugReport.close();
        return;
      }

      if (this.isModalVisible('media-manager-modal')) {
        if (typeof MediaManager !== 'undefined' && MediaManager.close) {
          MediaManager.close();
        } else {
          document.querySelector('#media-manager-modal [data-action="closeMediaManager"]')?.click();
        }
        return;
      }

      if (this.isModalVisible('input-popup')) {
        InputPopup.cancel();
        return;
      }

      if (this.isModalVisible('confirm-modal')) {
        TabManager.cancelConfirmation();
        return;
      }

      if ((TabManager.contextMenu && !TabManager.contextMenu.classList.contains('hidden')) ||
          (TabManager.groupMenu && !TabManager.groupMenu.classList.contains('hidden'))) {
        TabManager.hideContextMenu();
        return;
      }

      if (this.isModalVisible('info-overlay')) {
        GameModal.toggleInfo();
        return;
      }

      const annPanel = document.getElementById('notification-panel');
      if (annPanel && !annPanel.classList.contains('translate-x-full')) {
        Announcements.togglePanel(false);
        return;
      }

      const historyPanel = document.getElementById('history-panel');
      if (historyPanel && !historyPanel.classList.contains('translate-x-full')) {
        HistoryManager.togglePanel(false);
        return;
      }

      if (isModalOpen) {
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu && !settingsMenu.classList.contains('opacity-0')) {
          UI.toggleSettings();
          return;
        }

        const sidePanel = document.getElementById('side-panel');
        if (sidePanel && sidePanel.classList.contains('open')) {
          TabManager.toggleSidePanelMobile(false);
          return;
        }

        if (document.body.classList.contains('focus-mode')) {
          UI.toggleFocus();
          return;
        }

        TabManager.returnToHome();
        return;
      }

      if (document.getElementById('sidebar-backdrop')?.classList.contains('active')) {
        MobileUI.closeSidebar();
        return;
      }

      if (document.body.classList.contains('myspace-fullscreen')) {
        MySpace.toggleFullscreen();
        return;
      }

      if (target?.id === 'search-input') {
        if (target.value) {
          e.preventDefault();
          Search.clear();
        } else {
          target.blur();
        }
        return;
      }
    }

    // My Space Fullscreen Shortcut
    if ((e.key === 'f' || e.key === 'F') &&
        !isModalOpen &&
        ViewManager.currentView === 'myspace' &&
        !isEditable &&
        !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      MySpace.toggleFullscreen();
    }
  },

  bridgeIframeKeyboard(iframe) {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || doc.__klasskitShortcutsAttached) return;
      doc.__klasskitShortcutsAttached = true;

      // Bubble phase lets activity-level key handlers run and call preventDefault() first.
      doc.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        const target = e.target;
        const isEditable = Boolean(target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        ));

        const isEscape = e.key === 'Escape';
        const isAltHome = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'h' || e.key === 'H');
        const isReload = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'r' || e.key === 'R');
        const isWorkspaceCombo = (
          ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Tab') ||
          (!isEditable && (
            (e.altKey && e.key >= '1' && e.key <= '8') ||
            ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W')) ||
            ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey)
          ))
        );

        if ((isEscape && !isEditable) || isAltHome || (isReload && this.isModalVisible('game-modal')) || isWorkspaceCombo) {
          this.handleGlobalKeydown(e, { fromIframe: true });
        }
      });
    } catch (err) {
      // Cross-origin frame access is intentionally ignored.
    }
  },

  setupKeyboardShortcuts() {
    if (this._listenersAttached) return;

    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      this.handleGlobalKeydown(e);
    });

    // Handle Native Fullscreen Changes (Esc key, etc)
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      if (typeof MySpace !== 'undefined' && MySpace.updateFullscreenIcon) {
        MySpace.updateFullscreenIcon(isFs);
      }
      if (!isFs) {
        document.body.classList.remove('myspace-fullscreen');
      }
    });
  },

  setupEventDelegation() {
    if (this._listenersAttached) return;
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
        const targetTabId = TabManager.activeTabId
          || TabManager.lastActiveTabId
          || TabManager.tabs[0]?.id;
        if (targetTabId) {
          TabManager.switchToTab(targetTabId);
          const tab = TabManager.tabs.find(t => t.id === targetTabId);
          tab?.iframe?.focus();
        }
        TabManager.updateEmptyState();
      },

      toggleSidePanelMobile: () => TabManager.toggleSidePanelMobile(),
      toggleRecentCollapse: () => RecentGames.toggleCollapse(),
      filterGames: (param) => Filters.setCategory(param),
      searchSkill: (param) => Search.apply(param),
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
      setViewMode: (param) => ViewMode.set(param),
      scrollToTop: () => {
        const mainScroll = document.getElementById('main-scroll') || document.querySelector('main');
        const topBtn = document.getElementById('scroll-to-top-btn');
        if (!mainScroll) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        mainScroll.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        if (document.activeElement === topBtn) {
          document.getElementById('section-container')?.focus({ preventScroll: true });
        }
      }
    };

    const mainScroll = document.getElementById('main-scroll') || document.querySelector('main');
    const topBtn = document.getElementById('scroll-to-top-btn');
    if (mainScroll && topBtn) {
      const syncScrollTopBtn = () => {
        const show = mainScroll.scrollTop > 400;
        topBtn.classList.toggle('opacity-0', !show);
        topBtn.classList.toggle('pointer-events-none', !show);
        topBtn.setAttribute('aria-hidden', String(!show));
        topBtn.tabIndex = show ? 0 : -1;
      };
      mainScroll.addEventListener('scroll', syncScrollTopBtn, { passive: true });
      syncScrollTopBtn();
    }

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
          const toggleBtn = settingsContainer.querySelector('[data-action="toggleSettings"]');
          if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
          const icon = settingsContainer.querySelector('[data-action="toggleSettings"] svg, [data-action="toggleSettings"] i');
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

    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || (e.key !== 'Enter' && e.key !== ' ')) return;
      const el = e.target;
      if (!el || ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      const interactiveEl = el.closest('[data-action], [role="button"]');
      if (interactiveEl && interactiveEl === el) {
        e.preventDefault();
        interactiveEl.click();
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
    UI.rememberFocus('display-name-modal');
    const currentName = usernameEl?.textContent || '';
    input.value = currentName;
    errorEl.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    input.focus();
    input.select();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    UI.restoreFocus('display-name-modal', editBtn);
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
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
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
      if (usernameEl) {
        usernameEl.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-green" aria-hidden="true"></i> Sandbox Mode</span>';
        Utils.refreshIcons(usernameEl);
      }
      return;
    }

    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    if (usernameEl) usernameEl.textContent = displayName;

    // Check if admin and show link
    console.log('[HubAuth] Querying role for UID:', user.id);
    const { data: profile, error: roleError } = await db
      .from('profiles').select('role, display_name').eq('id', user.id).maybeSingle();
    
    if (roleError) {
      console.error('[HubAuth] ERROR CODE:', roleError.code);
      console.error('[HubAuth] ERROR MESSAGE:', roleError.message);
      console.error('[HubAuth] FULL ERROR OBJECT:', roleError);
    }
    
    console.log('[HubAuth] RAW PROFILE DATA:', profile);
    console.log('[HubAuth] FINAL DETECTED ROLE:', profile?.role);

    // Sync role into State.userProfile for consistent privilege checks across the app
    if (profile?.role && State.userProfile) {
      State.userProfile.role = profile.role;
      if (profile.display_name) State.userProfile.display_name = profile.display_name;
    } else if (profile) {
      State.userProfile = profile;
    }

    // Re-render UI to reflect any privilege changes
    UI.applyProStyles();
    Hero.updateStats();
    Hero.updateContinueBtn();
    PinnedGames.render();
    RecentGames.render();
    ViewManager.renderAllGrids();

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
  _closeTimer: null,
  openSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (!s || !b) return;
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    s.classList.remove('hidden');
    setTimeout(() => s.classList.remove('-translate-x-full'), 10);
    b.classList.add('active');
  },
  closeSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (!s || !b) return;
    const isOpen = b.classList.contains('active') || !s.classList.contains('-translate-x-full');
    if (!isOpen) return;
    s.classList.add('-translate-x-full');
    b.classList.remove('active');
    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      if (s.classList.contains('-translate-x-full')) {
        s.classList.add('hidden');
      }
      this._closeTimer = null;
    }, 300);
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

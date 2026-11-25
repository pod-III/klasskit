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
      Theme.load();
      UI.showLoading();

      // Run independent bootstrap fetches in parallel
      const [profile, dataChanged, data] = await Promise.all([
        getUserProfile(),
        Storage.syncWithCloud(),
        DataLoader.loadGames()
      ]);
      State.userProfile = profile;
      if (dataChanged) {
        console.log('[CloudPersistence] Local state updated from cloud. Refreshing theme...');
        Theme.load();
      }
      UI.updateGreeting();
      UI.updateUserUI();

      State.setGames(data);
      // Store top-level metadata for footer
      if (data.version) State.metadata = { ...(State.metadata || {}), version: data.version, lastUpdated: data.lastUpdated };

      if (typeof HubSettings !== 'undefined') HubSettings.applyAll({ render: false });
      ViewMode.init();
      GameGrid.render();
      PinnedGames.render();
      Hero.init();
      Footer.render();
      Search.setup();
      const defaultHome = window.HubSettings?.get('defaultHome') || 'auto';
      const savedHomeView = Storage.get(CONFIG.storageKeys.homeView);
      const activity = (defaultHome === 'auto' && !savedHomeView && typeof checkUserActivity === 'function')
        ? await checkUserActivity()
        : null;
      LandingPage.init(activity);

      if (typeof checkAndOfferSandboxImport === 'function') {
        const imported = await checkAndOfferSandboxImport();
        if (imported) {
          Theme.load();
          if (typeof HubSettings !== 'undefined') HubSettings.applyAll({ render: false });
          ViewMode.init();
          PinnedGames.render();
          RecentGames.render();
          Hero.updateStats();
          ViewManager.renderAllGrids();
          UI.showToast('Sandbox data imported to your Cloud account!', 'success');
        }
      }

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
    if (e.key === '/' && !e.shiftKey && !options.fromIframe && !isEditable && !isModalOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
      return;
    }

    // Toggle Keyboard Shortcuts quick reference modal on '?'
    if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      ShortcutsModal.toggle();
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
      if (e.defaultPrevented) return;

      if (this.isModalVisible('input-popup')) {
        InputPopup.cancel();
        return;
      }

      if (this.isModalVisible('shortcuts-modal')) {
        ShortcutsModal.close();
        return;
      }

      if (this.isModalVisible('universalInputModal')) {
        return;
      }

      if (this.isModalVisible('hub-settings-modal')) {
        SettingsModal.close();
        return;
      }

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
    if (typeof Theme !== 'undefined' && Theme.syncToIframe) {
      Theme.syncToIframe(iframe);
    }
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
        const isShortcuts = !isEditable && (e.key === '?' || (e.shiftKey && e.key === '/')) && !e.ctrlKey && !e.metaKey && !e.altKey;
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

        if ((isEscape && !isEditable) || isShortcuts || isAltHome || (isReload && this.isModalVisible('game-modal')) || isWorkspaceCombo) {
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
      surpriseMe: (param) => Hero.surpriseMe(param),
      continueGame: (param) => GameModal.open(param),
      openFeedback: () => BugReport.open(),
      openBugReport: () => BugReport.open(),
      closeBugReport: () => BugReport.close(),
      toggleShortcuts: () => ShortcutsModal.toggle(),
      closeShortcuts: () => ShortcutsModal.close(),
      openHubSettings: (param) => SettingsModal.open(param || null),
      closeHubSettings: () => SettingsModal.close(),
      createTabGroup: () => TabManager.promptNewGroup(),
      setLibraryQuickFilter: (param) => LibraryFilters.setQuickFilter(param),
      resetLibraryFilters: () => LibraryFilters.reset(),
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

    document.addEventListener('change', (e) => {
      const diffSelect = e.target.closest('[data-library-difficulty]');
      if (diffSelect) {
        LibraryFilters.setDifficulty(diffSelect.value);
        return;
      }
      const sortSelect = e.target.closest('[data-library-sort]');
      if (sortSelect) {
        LibraryFilters.setSort(sortSelect.value);
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
    if (typeof isSandbox === 'function' && isSandbox()) return;
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
  const signOutBtn = document.getElementById('auth-signout-btn');
  const editNameBtn = document.getElementById('auth-edit-name-btn');
  const editPencil = document.getElementById('auth-edit-name-icon') || editNameBtn?.querySelector('[data-lucide="pencil"], svg');

  if (!signInLink || !loggedInDiv) return;

  const user = await getUser();
  if (user) {
    if (user.is_sandbox) {
      signInLink.classList.remove('hidden');
      loggedInDiv.classList.remove('hidden');
      if (signOutBtn) signOutBtn.classList.add('hidden');
      if (editPencil) editPencil.classList.add('hidden');
      if (editNameBtn) {
        editNameBtn.disabled = true;
        editNameBtn.title = 'Offline Sandbox Mode';
        editNameBtn.classList.remove('hover:bg-slate-200', 'dark:hover:bg-slate-700');
        editNameBtn.classList.add('cursor-default');
      }
      if (usernameEl) {
        usernameEl.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-green" aria-hidden="true"></i> Sandbox Mode</span>';
        Utils.refreshIcons(usernameEl);
      }
      return;
    }

    signInLink.classList.add('hidden');
    loggedInDiv.classList.remove('hidden');
    if (signOutBtn) signOutBtn.classList.remove('hidden');
    if (editPencil) editPencil.classList.remove('hidden');
    if (editNameBtn) {
      editNameBtn.disabled = false;
      editNameBtn.title = 'Edit display name';
      editNameBtn.classList.add('hover:bg-slate-200', 'dark:hover:bg-slate-700');
      editNameBtn.classList.remove('cursor-default');
    }

    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    if (usernameEl) usernameEl.textContent = displayName;

    // Reuse cached/deduplicated profile lookup instead of firing a duplicate profiles query
    const profile = await getUserProfile();
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

// --- KEYBOARD SHORTCUTS MODAL ---
const ShortcutsModal = {
  isOpen() {
    const modal = document.getElementById('shortcuts-modal');
    return !!modal && !modal.classList.contains('hidden');
  },
  open() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal || this.isOpen()) return;
    if (typeof UI !== 'undefined' && UI.rememberFocus) {
      UI.rememberFocus('shortcuts-modal');
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ root: modal });
    }
    const closeBtn = modal.querySelector('[data-action="closeShortcuts"][aria-label]');
    if (closeBtn) closeBtn.focus();
  },
  close() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal || !this.isOpen()) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (typeof UI !== 'undefined' && UI.restoreFocus) {
      UI.restoreFocus('shortcuts-modal');
    }
  },
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }
};

// --- HUB SETTINGS MODAL ---
const SettingsModal = {
  activeSection: 'appearance',

  isOpen() {
    const modal = document.getElementById('hub-settings-modal');
    return !!modal && !modal.classList.contains('hidden');
  },

  open(sectionId = null) {
    const modal = document.getElementById('hub-settings-modal');
    if (!modal || typeof HubSettings === 'undefined') return;
    if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsMenu && !settingsMenu.classList.contains('opacity-0')) {
      UI?.toggleSettings?.();
    }

    if (sectionId && HubSettings.sections.some(s => s.id === sectionId)) {
      this.activeSection = sectionId;
    } else if (!HubSettings.sections.some(s => s.id === this.activeSection)) {
      this.activeSection = HubSettings.sections[0]?.id || 'appearance';
    }

    if (!this.isOpen()) {
      UI?.rememberFocus?.('hub-settings-modal');
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    this.renderNav();
    this.renderControls();
    AudioEngine?.click?.();

    requestAnimationFrame(() => {
      modal.querySelector('[data-action="closeHubSettings"][aria-label]')?.focus();
    });
  },

  close() {
    const modal = document.getElementById('hub-settings-modal');
    if (!modal || !this.isOpen()) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    AudioEngine?.click?.();
    UI?.restoreFocus?.('hub-settings-modal');
  },

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  },

  setSection(sectionId) {
    if (!HubSettings.sections.some(s => s.id === sectionId)) return;
    this.activeSection = sectionId;
    this.renderNav();
    this.renderControls();
    AudioEngine?.click?.();
  },

  renderNav() {
    const nav = document.getElementById('hub-settings-nav');
    if (!nav || typeof HubSettings === 'undefined') return;
    nav.innerHTML = '';

    HubSettings.sections.forEach(section => {
      const isActive = section.id === this.activeSection;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `settings-nav-btn${isActive ? ' active' : ''}`;
      if (isActive) btn.setAttribute('aria-current', 'page');

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', section.icon || 'sliders-horizontal');
      icon.className = 'w-4 h-4 shrink-0';
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = section.label;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener('click', () => this.setSection(section.id));
      nav.appendChild(btn);
    });

    Utils.refreshIcons(nav);
  },

  renderControls() {
    const container = document.getElementById('hub-settings-content');
    if (!container || typeof HubSettings === 'undefined') return;
    container.innerHTML = '';

    const section = HubSettings.sections.find(s => s.id === this.activeSection) || HubSettings.sections[0];
    if (!section) return;

    const header = document.createElement('div');
    header.className = 'pb-3 border-b-2 border-slate-200 dark:border-slate-700';
    const h4 = document.createElement('h4');
    h4.className = 'font-heading font-black text-lg text-dark dark:text-white uppercase tracking-tight';
    h4.textContent = section.label;
    header.appendChild(h4);

    if (section.description) {
      const desc = document.createElement('p');
      desc.className = 'text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5';
      desc.textContent = section.description;
      header.appendChild(desc);
    }
    container.appendChild(header);

    const toneClasses = {
      blue: 'bg-blue text-white',
      orange: 'bg-orange text-white',
      pink: 'bg-pink text-white',
      green: 'bg-green text-white',
      slate: 'bg-slate-200 dark:bg-slate-700 text-dark dark:text-white'
    };

    section.controls.forEach(control => {
      const card = document.createElement('div');
      card.className = 'settings-control-card';

      const meta = document.createElement('div');
      meta.className = 'flex-1 min-w-0';

      const labelRow = document.createElement('div');
      labelRow.className = 'flex items-center gap-2 flex-wrap';

      const labelEl = document.createElement('div');
      labelEl.className = 'font-heading font-bold text-sm text-dark dark:text-white leading-tight';
      labelEl.textContent = control.label;
      labelRow.appendChild(labelEl);

      if (control.badge) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'px-1.5 py-0.5 rounded-md border border-dark dark:border-slate-500 bg-orange/15 text-orange font-heading font-black text-[10px] uppercase tracking-wider leading-none';
        badgeEl.textContent = control.badge;
        labelRow.appendChild(badgeEl);
      }

      meta.appendChild(labelRow);

      if (control.description) {
        const descEl = document.createElement('p');
        descEl.className = 'text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-snug';
        descEl.textContent = control.description;
        meta.appendChild(descEl);
      }

      card.appendChild(meta);

      if (control.type === 'toggle') {
        const checked = Boolean(control.get?.());
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', String(checked));
        sw.setAttribute('aria-label', control.label);
        sw.dataset.controlId = control.id;
        sw.className = `settings-switch${checked ? ' is-on' : ''}`;
        sw.innerHTML = '<span class="settings-switch-thumb"></span>';
        sw.addEventListener('click', () => {
          const next = !Boolean(control.get?.());
          control.set?.(next);
          AudioEngine?.click?.();
          this.syncControls();
        });
        card.appendChild(sw);
      } else if (control.type === 'segmented') {
        card.classList.add('is-stacked');
        const group = document.createElement('div');
        group.className = 'settings-segmented';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', control.label);

        const currentVal = String(control.get?.() ?? '');
        (control.options || []).forEach(opt => {
          const isSelected = String(opt.value) === currentVal;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.controlId = control.id;
          btn.dataset.value = opt.value;
          btn.setAttribute('aria-pressed', String(isSelected));
          btn.className = `settings-seg-btn${isSelected ? ' active' : ''}`;

          if (opt.icon) {
            const ic = document.createElement('i');
            ic.setAttribute('data-lucide', opt.icon);
            ic.className = 'w-3.5 h-3.5';
            ic.setAttribute('aria-hidden', 'true');
            btn.appendChild(ic);
          }
          const span = document.createElement('span');
          span.textContent = opt.label;
          btn.appendChild(span);

          btn.addEventListener('click', () => {
            control.set?.(opt.value);
            AudioEngine?.click?.();
            this.syncControls();
          });
          group.appendChild(btn);
        });
        card.appendChild(group);
      } else if (control.type === 'select') {
        const select = document.createElement('select');
        select.className = 'library-select settings-select';
        select.setAttribute('aria-label', control.label);
        select.dataset.controlId = control.id;

        const currentVal = String(control.get?.() ?? '');
        (control.options || []).forEach(opt => {
          const optionEl = document.createElement('option');
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          if (String(opt.value) === currentVal) optionEl.selected = true;
          select.appendChild(optionEl);
        });

        select.addEventListener('change', () => {
          control.set?.(select.value);
          AudioEngine?.click?.();
          this.syncControls();
        });
        card.appendChild(select);
      } else if (control.type === 'palette') {
        card.classList.add('is-stacked');
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 gap-2 w-full mt-2';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', control.label);

        const currentVal = String(control.get?.() ?? 'classic');
        (control.options || []).forEach(opt => {
          const isSelected = String(opt.id) === currentVal;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.controlId = control.id;
          btn.dataset.value = opt.id;
          btn.setAttribute('aria-pressed', String(isSelected));
          btn.className = `btn-chunky flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 text-left transition-all ${
            isSelected
              ? 'border-blue bg-blue/10 dark:bg-blue/20 shadow-hard-sm'
              : 'border-line-muted bg-card hover:border-line'
          }`;

          const dots = document.createElement('div');
          dots.className = 'flex items-center gap-1';
          (opt.swatches || []).forEach(hex => {
            const dot = document.createElement('span');
            dot.className = 'w-3.5 h-3.5 rounded-full border border-slate-800/40 dark:border-white/25 inline-block';
            dot.style.backgroundColor = hex;
            dots.appendChild(dot);
          });

          const name = document.createElement('span');
          name.className = 'font-heading font-bold text-xs text-ink leading-none';
          name.textContent = opt.label;

          btn.appendChild(dots);
          btn.appendChild(name);
          btn.addEventListener('click', () => {
            control.set?.(opt.id);
            AudioEngine?.click?.();
            this.syncControls();
          });
          grid.appendChild(btn);
        });
        card.appendChild(grid);
      } else if (control.type === 'action') {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        const toneCls = toneClasses[control.tone] || toneClasses.blue;
        actionBtn.className = `btn-chunky ${toneCls} px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase tracking-wider shrink-0 inline-flex items-center gap-1.5`;

        if (control.icon) {
          const ic = document.createElement('i');
          ic.setAttribute('data-lucide', control.icon);
          ic.className = 'w-3.5 h-3.5';
          ic.setAttribute('aria-hidden', 'true');
          actionBtn.appendChild(ic);
        }
        const span = document.createElement('span');
        span.textContent = control.buttonLabel || 'Run';
        actionBtn.appendChild(span);

        actionBtn.addEventListener('click', () => {
          control.onClick?.();
        });
        card.appendChild(actionBtn);
      }

      container.appendChild(card);
    });

    Utils.refreshIcons(container);
  },

  syncControls() {
    if (!this.isOpen() || typeof HubSettings === 'undefined') return;
    const content = document.getElementById('hub-settings-content');
    if (!content) return;

    const section = HubSettings.sections.find(s => s.id === this.activeSection);
    if (!section) return;

    section.controls.forEach(control => {
      const safeId = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(String(control.id))
        : String(control.id).replace(/"/g, '\\"');
      if (control.type === 'toggle') {
        const checked = Boolean(control.get?.());
        const sw = content.querySelector(`.settings-switch[data-control-id="${safeId}"]`);
        if (sw) {
          sw.classList.toggle('is-on', checked);
          sw.setAttribute('aria-checked', String(checked));
        }
      } else if (control.type === 'segmented') {
        const currentVal = String(control.get?.() ?? '');
        content.querySelectorAll(`.settings-seg-btn[data-control-id="${safeId}"]`).forEach(btn => {
          const active = btn.dataset.value === currentVal;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-pressed', String(active));
        });
      } else if (control.type === 'select') {
        const sel = content.querySelector(`select[data-control-id="${safeId}"]`);
        if (sel) sel.value = String(control.get?.() ?? '');
      } else if (control.type === 'palette') {
        const currentVal = String(control.get?.() ?? 'classic');
        content.querySelectorAll(`button[data-control-id="${safeId}"]`).forEach(btn => {
          const active = btn.dataset.value === currentVal;
          btn.setAttribute('aria-pressed', String(active));
          btn.className = `btn-chunky flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 text-left transition-all ${
            active
              ? 'border-blue bg-blue/10 dark:bg-blue/20 shadow-hard-sm'
              : 'border-line-muted bg-card hover:border-line'
          }`;
        });
      }
    });
  }
};

// --- EXPORTS ---
window.App = App;
window.AudioEngine = AudioEngine;
window.GameModal = GameModal;
window.TabManager = TabManager;
window.ShortcutsModal = ShortcutsModal;
window.SettingsModal = SettingsModal;
window.HubSettings = HubSettings;
window.HistoryManager = HistoryManager;
window.Timer = Timer;
window.LandingPage = LandingPage;
window.MySpace = MySpace;
window.MobileUI = MobileUI;
window.filterGames = (category) => Filters.setCategory(category);

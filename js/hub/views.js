// KlassKit Hub — Grids, ViewMode, ViewManager, LandingPage, Filters, MySpace & InputPopup

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
    const printables = gamesToRender.filter(g => g.category === 'printable');
    const gamesList = gamesToRender.filter(g => g.category === 'game');
    const workshop = gamesToRender.filter(g => g.category === 'workshop');
    const other = gamesToRender.filter(g => !['myspace', 'tool', 'printable', 'game', 'workshop'].includes(g.category));

    let html = '';

    if (printables.length > 0) {
      html += this.renderCategorySection('printables', 'printer', 'var(--color-orange)', 'Printables', printables);
    }
    if (tools.length > 0) {
      html += this.renderCategorySection('tools', 'wrench', 'var(--color-blue)', 'Teaching Tools', tools);
    }
    if (gamesList.length > 0) {
      html += this.renderCategorySection('games', 'gamepad-2', 'var(--color-green)', 'Classroom Games', gamesList);
    }
    if (workshop.length > 0) {
      html += this.renderCategorySection('workshop', 'hammer', 'var(--color-pink)', 'Workshop Tools', workshop);
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

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  highlightMatch(text, query) {
    const raw = String(text ?? '');
    const trimmed = String(query ?? '').trim();
    if (!trimmed) return this.escapeHtml(raw);

    const pattern = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!pattern) return this.escapeHtml(raw);

    const regex = new RegExp(pattern, 'gi');
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(raw)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      if (match.index > lastIndex) {
        result += this.escapeHtml(raw.slice(lastIndex, match.index));
      }
      result += `<mark class="bg-yellow-200 text-slate-800 rounded px-1">${this.escapeHtml(match[0])}</mark>`;
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < raw.length) {
      result += this.escapeHtml(raw.slice(lastIndex));
    }
    return result;
  },

  createCard(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}/10`;
    const btnClass = game.color.replace('text-', 'bg-');
    const difficultyBadge = game.difficulty
      ? `<span class="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">${this.escapeHtml(game.difficulty)}</span>`
      : '';

    const isPinned = PinnedGames.isPinned(game.id);
    const pinIcon = isPinned ? 'pin-off' : 'pin';
    const pinTitle = isPinned ? 'Unpin from top' : 'Pin to top';

    const safeTitle = this.escapeHtml(game.title);
    const safeDesc = this.escapeHtml(game.description || '');
    const searchLower = State.filters.searchTerm.trim();
    const displayTitle = searchLower ? this.highlightMatch(game.title, searchLower) : safeTitle;
    const displayDesc = searchLower ? this.highlightMatch(game.description || '', searchLower) : safeDesc;

    const tiltHash = Array.from(String(game.id || '')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const tiltClass = tiltHash % 2 === 0 ? 'rotate-2' : '-rotate-2';

    const proBadge = game.pro
      ? `<span class="pro-badge px-1.5 py-0.5 bg-gradient-to-r from-orange to-pink text-[9px] font-black text-white rounded shadow-sm">PRO</span>`
      : '';

    const newBadge = game.new
      ? `<span class="new-badge px-1.5 py-0.5 bg-gradient-to-r from-green to-blue text-[9px] font-black text-white rounded shadow-sm">NEW</span>`
      : '';

    const badgesHtml = (proBadge || newBadge)
      ? `<div class="card-badges flex items-center gap-1.5 flex-wrap">${proBadge}${newBadge}</div>`
      : '';

    return `
      <article class="hub-card group cursor-pointer" 
        data-action="openGame" data-param="${game.id}" role="button" tabindex="0"
        aria-label="Launch ${safeTitle}: ${safeDesc}">
        <div class="${bgClass} hub-card-visual p-6 border-b-4 border-line h-40 flex items-center justify-center relative overflow-hidden transition-colors">
          <button data-action="togglePin" data-param="${game.id}" type="button"
            class="pin-btn ${isPinned ? 'is-pinned bg-pink text-white border-line opacity-100' : 'bg-glass/75 text-ink border-line/30'} backdrop-blur-md border-2 absolute top-3 right-3 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            title="${pinTitle}" aria-label="${isPinned ? `Unpin ${safeTitle}` : `Pin ${safeTitle}`}" aria-pressed="${isPinned}">
            <i data-lucide="${pinIcon}" class="w-4 h-4" aria-hidden="true"></i>
          </button>
          <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(#000 2px,transparent 2px);background-size:12px 12px"></div>
          <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
          <div class="bg-card p-4 rounded-2xl border-2 border-line shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-card">
          <div class="flex justify-between items-start mb-3">
            <div class="card-title-group flex flex-col gap-1">
              <h2 class="text-2xl font-heading text-ink leading-none tracking-tight">${displayTitle}</h2>
              ${badgesHtml}
            </div>
            <div class="flex flex-col gap-1 items-end">
              <span class="sticker ${btnClass} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${tiltClass}">${this.escapeHtml(game.category).toUpperCase()}</span>
              ${difficultyBadge}
            </div>
          </div>
          <p class="text-ink-muted font-bold text-sm mb-6 flex-1 leading-relaxed">${displayDesc}</p>
          <button class="btn-chunky ${btnClass} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105" tabindex="-1">
            <i data-lucide="play" class="w-5 h-5 fill-current"></i> LAUNCH
          </button>
        </div>
      </article>
    `;
  },

  getGuideText(game) {
    if (!game.guide) {
      return (game.category === 'tool' || game.category === 'workshop' || game.category === 'printable')
        ? "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility.</li></ul>"
        : "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Customize words in setup if available.</li></ul>";
    }
    if (typeof game.guide === 'object' && game.guide.steps) {
      return `<ul class='list-disc pl-5 space-y-2'>${game.guide.steps.map(s => `<li>${s}</li>`).join('')}</ul>`;
    }
    return game.guide;
  },

  shouldDisableTilt() {
    return Boolean(window.HubSettings?.get('reduceMotion')) ||
           window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
           window.matchMedia('(hover: none)').matches ||
           window.matchMedia('(pointer: coarse)').matches;
  },

  initCardEffects(container) {
    if (!container || container.dataset.tiltBound === 'true') return;
    container.dataset.tiltBound = 'true';
    let lastTouchTime = 0;

    container.addEventListener('touchstart', (e) => {
      lastTouchTime = Date.now();
      const card = e.target.closest('.hub-card');
      if (card) card.style.transform = '';
    }, { passive: true });

    // Delegated event handling on the grid container
    container.addEventListener('mousemove', (e) => {
      if (this.shouldDisableTilt() || (Date.now() - lastTouchTime < 800)) return;
      const card = e.target.closest('.hub-card');
      if (card) this.tiltCard(e, card);
    });
    container.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.hub-card');
      if (card) card.style.transform = '';
    }, true); // use capture to catch leave from children
  },

  tiltCard(e, card) {
    if (this.shouldDisableTilt()) {
      card.style.transform = '';
      return;
    }
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
  current: 'icons', // 'cards' | 'list' | 'icons'

  init() {
    this.current = Storage.get(CONFIG.storageKeys.viewMode, 'icons') || 'icons';
    this.apply();
    this.updateToggleUI();
  },

  set(mode) {
    if (!['cards', 'list', 'icons'].includes(mode)) return;
    this.current = mode;
    Storage.set(CONFIG.storageKeys.viewMode, mode);
    this.apply();
    this.updateToggleUI();
    window.SettingsModal?.syncControls?.();
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
        const isActive = btn.dataset.param === this.current;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
    });
  }
};

// --- VIEW MANAGER (formerly LandingPage & Filters) ---
const ViewManager = {
  currentView: 'landing', // 'landing', 'myspace', 'library-all', 'library-tool', 'library-printable', 'library-game', 'library-workshop'
  renderedViews: new Set(['landing', 'myspace']),

  init(activity = null) {
    const defaultHome = window.HubSettings?.get('defaultHome') || 'auto';
    if (defaultHome && defaultHome !== 'auto') {
      if ((defaultHome === 'myspace' || defaultHome === 'library-myspace') && !State.isPro()) {
        this.show('landing', true);
      } else {
        this.show(defaultHome, true);
      }
      return;
    }

    const saved = Storage.get(CONFIG.storageKeys.homeView);
    if (saved) {
      if ((saved === 'myspace' || saved === 'library-myspace') && !State.isPro()) {
        this.show('landing', true);
      } else {
        this.show(saved, true);
      }
      return;
    }

    // Default Smart Landing logic
    if (activity) {
      if (activity.hasMySpace && State.isPro()) {
        this.show('myspace', true);
      } else if (activity.hasActivity) {
        this.show('library-all', true);
      } else {
        this.show('landing', true);
      }
    } else {
      // Fallback to local check if no database activity data available
      if (State.isPro() && MySpace && MySpace.isPopulated && MySpace.isPopulated()) {
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
    if ((viewId === 'myspace' || viewId === 'library-myspace') && !State.isPro()) {
      viewId = 'landing';
    }
    if (!document.getElementById(`${viewId}-view`)) {
      viewId = viewId === 'library-myspace' ? 'myspace' : 'landing';
    }
    const prevView = this.currentView;

    UI.hideLoading();
    document.getElementById('hub-error-state')?.classList.add('hidden');
    if (typeof MobileUI !== 'undefined') MobileUI.closeSidebar();

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
    } else if (viewId === 'library-all') {
      requestAnimationFrame(() => {
        if (typeof PinnedGames !== 'undefined') PinnedGames.render();
        if (typeof RecentGames !== 'undefined') RecentGames.render();
      });
    }

    if (typeof UI !== 'undefined' && UI.updateGreeting) UI.updateGreeting();

    this.updateNavUI();
    Storage.set(CONFIG.storageKeys.homeView, viewId);
    
    if (!silent) AudioEngine.click();
    Utils.refreshIcons();

    // Scroll to top if switching views
    if (prevView !== viewId) {
      const mainContent = document.getElementById('main-scroll') || document.querySelector('main');
      if (mainContent) {
        mainContent.scrollTop = 0;
        mainContent.dispatchEvent(new Event('scroll'));
      }
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
      printable: "Printables",
      game: "Classroom Games",
      workshop: "Workshop Tools",
      'under-construction': "Under Construction"
    };
    const title = titles[category] || "Activity Library";

    const statsHtml = category === 'all' ? `
      <div class="flex items-center gap-2 mt-2 flex-wrap opacity-80">
        <span class="hero-stat"><i data-lucide="printer" class="w-3.5 h-3.5"></i> <strong id="stat-printables">0</strong> Printables</span>
        <span class="hero-stat-dot"></span>
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
      printable: "printer",
      game: "gamepad-2",
      workshop: "hammer",
      'under-construction': "construction"
    };
    const gridHeadings = {
      all: 'Library',
      tool: 'Tools',
      printable: 'Printables',
      game: 'Games',
      workshop: 'Workshop',
      'under-construction': 'Under Construction'
    };
    const icon = icons[category] || "layout-grid";
    const categoryPills = {
      all: 'All Activities',
      tool: 'Teaching Tools',
      printable: 'Printables',
      game: 'Classroom Games',
      workshop: 'Workshop Tools',
      'under-construction': 'WIP Lab'
    };
    const categoryPill = categoryPills[category] || 'Library';
    const headingClass = category === 'all' ? 'greeting-display ' : '';

    container.innerHTML = `
      <!-- Dashboard Title Widget -->
      <div class="hero-banner rounded-[2rem] p-6 md:p-8 mb-6 border-[3px] border-dark dark:border-slate-600 shadow-hard dark:shadow-neon relative overflow-hidden flex flex-col justify-center min-h-[150px] mt-4">
        <div class="hero-gradient-bg"></div>
        <div class="hero-dot-overlay"></div>

        <div class="absolute right-4 bottom-[-10%] md:right-12 md:bottom-[-15%] opacity-10 dark:opacity-[0.08] pointer-events-none">
          <i data-lucide="${icon}" class="w-40 h-40 md:w-56 md:h-56 text-slate-800 dark:text-white transform -rotate-12 scale-110"></i>
        </div>
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between w-full gap-6">
          <div class="flex flex-col items-start">
            <div class="hero-meta-tags mb-3 flex gap-3 flex-wrap">
              <span class="hero-pill clock-pill"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> <span class="date-text">...</span></span>
              <span class="hero-pill">${categoryPill}</span>
            </div>
            <h2 class="${headingClass}text-3xl md:text-5xl font-heading font-black mb-1 leading-tight tracking-tight text-slate-900 dark:text-white">
              ${title}
            </h2>
            ${statsHtml}
          </div>
          <div class="flex flex-col items-start lg:items-end gap-3 mt-4 lg:mt-0">
             <div class="hero-actions flex flex-wrap gap-3">
                <button data-action="surpriseMe" data-param="${category}" class="btn-chunky bg-pink text-white border-3 border-dark px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-hard hover:translate-y-[-2px] active:translate-y-[2px] transition-all">
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
               <p class="daily-tip-text font-bold text-sm text-slate-700 dark:text-white/95 flex items-center gap-3 m-0">
                 <i data-lucide="sparkles" class="w-4 h-4 text-yellow-300"></i> Tip: Use shortcut '/' to quickly search the library!
               </p>
             </div>
          </div>
        </div>
      </div>

      ${category === 'all' ? `
      <!-- Recently Used -->
      <section id="recent-section" class="mb-8 hidden">
        <div class="flex items-center justify-between mb-3 px-2">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-blue text-white rounded-xl border-2 border-dark flex items-center justify-center shadow-hard-sm">
              <i data-lucide="clock" class="w-4 h-4"></i>
            </div>
            <h3 class="text-xl font-heading font-black text-dark dark:text-white uppercase tracking-tight">Recently Used</h3>
          </div>
          <div class="flex items-center gap-2">
            <button data-action="clearRecent" class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Clear recent">
              Clear
            </button>
            <button id="recent-toggle-btn" data-action="toggleRecentCollapse" class="p-1.5 rounded-lg border-2 border-line bg-card text-ink hover:bg-surface-muted transition-colors" aria-label="Toggle Recent List">
              <i data-lucide="chevron-up" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <div id="recent-list" class="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          <!-- Recent pills injected here -->
        </div>
      </section>

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

      <!-- Grid Header & Smart Toolbar -->
      <div class="library-toolbar flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
          <h3 class="text-2xl font-heading font-black text-dark dark:text-white uppercase tracking-tight">${gridHeadings[category] || category + 's'}</h3>
          <span id="grid-count-${viewId}" class="section-header-badge">0</span>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <div class="library-filter-pills" role="group" aria-label="Quick filter">
            <button type="button" data-action="setLibraryQuickFilter" data-param="all" aria-pressed="${State.filters.quickFilter === 'all'}"
              class="library-filter-pill ${State.filters.quickFilter === 'all' ? 'active' : ''}">All</button>
            <button type="button" data-action="setLibraryQuickFilter" data-param="pinned" aria-pressed="${State.filters.quickFilter === 'pinned'}"
              class="library-filter-pill ${State.filters.quickFilter === 'pinned' ? 'active' : ''}">
              <i data-lucide="pin" class="w-3.5 h-3.5" aria-hidden="true"></i> Pinned
            </button>
            <button type="button" data-action="setLibraryQuickFilter" data-param="new" aria-pressed="${State.filters.quickFilter === 'new'}"
              class="library-filter-pill ${State.filters.quickFilter === 'new' ? 'active' : ''}">
              <i data-lucide="sparkles" class="w-3.5 h-3.5" aria-hidden="true"></i> New
            </button>
          </div>

          <select data-library-difficulty aria-label="Filter by difficulty" class="library-select">
            <option value="all" ${State.filters.difficulty === 'all' ? 'selected' : ''}>All Levels</option>
            <option value="easy" ${State.filters.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
            <option value="medium" ${State.filters.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="hard" ${State.filters.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
          </select>

          <select data-library-sort aria-label="Sort activities" class="library-select">
            <option value="az" ${State.filters.sort === 'az' ? 'selected' : ''}>Sort: A–Z</option>
            <option value="za" ${State.filters.sort === 'za' ? 'selected' : ''}>Sort: Z–A</option>
            <option value="recent" ${State.filters.sort === 'recent' ? 'selected' : ''}>Recently Used</option>
            <option value="pinned" ${State.filters.sort === 'pinned' ? 'selected' : ''}>Pinned First</option>
          </select>

          <div class="view-toggle-group">
            <button data-action="setViewMode" data-param="cards" aria-label="Card View" aria-pressed="${ViewMode.current === 'cards'}" title="Card View" class="view-toggle-btn ${ViewMode.current === 'cards' ? 'active' : ''}"><i data-lucide="layout-grid" class="w-4 h-4" aria-hidden="true"></i></button>
            <button data-action="setViewMode" data-param="icons" aria-label="Icon View" aria-pressed="${ViewMode.current === 'icons'}" title="Icon View" class="view-toggle-btn ${ViewMode.current === 'icons' ? 'active' : ''}"><i data-lucide="grip" class="w-4 h-4" aria-hidden="true"></i></button>
            <button data-action="setViewMode" data-param="list" aria-label="List View" aria-pressed="${ViewMode.current === 'list'}" title="List View" class="view-toggle-btn ${ViewMode.current === 'list' ? 'active' : ''}"><i data-lucide="list" class="w-4 h-4" aria-hidden="true"></i></button>
          </div>
        </div>
      </div>

      <!-- Active Search Banner -->
      <div id="search-banner-${viewId}" role="status" aria-live="polite" class="hidden mb-6"></div>

      <div id="grid-${viewId}" class="games-grid ${ViewMode.current === 'list' ? 'view-list' : ''} ${ViewMode.current === 'icons' ? 'view-icons' : ''}">
        <!-- Items injected here -->
      </div>
    `;
    
    this.updateClock(container);
    if (category === 'all') {
      Hero.updateStats();
      Hero.updateContinueBtn();
      // Ensure pinned & recent are rendered after template injection
      if (typeof PinnedGames !== 'undefined') PinnedGames.render();
      if (typeof RecentGames !== 'undefined') RecentGames.render();
    }
    Utils.refreshIcons(container);
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

    const searchTerm = State.filters.searchTerm.trim().toLowerCase();
    const quickFilter = State.filters.quickFilter || 'all';
    const difficultyFilter = State.filters.difficulty || 'all';
    const sortMode = State.filters.sort || 'az';
    const escapeHtml = GameGrid.escapeHtml;

    let games = State.games.filter(g => {
      if (g.active === false) return false;
      if (g.pro && !State.isPro()) return false;
      if (g.adminOnly && !State.isAdmin()) return false;
      return true;
    });

    if (category !== 'all') {
      games = games.filter(g => g.category === category);
    } else {
      games = games.filter(g => ['tool', 'printable', 'game', 'workshop'].includes(g.category));
    }

    const totalCategoryCount = games.length;

    if (quickFilter === 'pinned') {
      games = games.filter(g => PinnedGames.isPinned(g.id));
    } else if (quickFilter === 'new') {
      games = games.filter(g => Boolean(g.new));
    }

    if (difficultyFilter !== 'all') {
      games = games.filter(g => g.difficulty === difficultyFilter);
    }

    if (searchTerm) {
      games = games.filter(g =>
        g.title.toLowerCase().includes(searchTerm) ||
        (g.description || '').toLowerCase().includes(searchTerm) ||
        (searchTerm === 'new' && g.new) ||
        g.tags?.some(t => t.toLowerCase().includes(searchTerm))
      );
    }

    // Apply sort (search relevance first when searching)
    const recentOrder = (typeof RecentGames !== 'undefined' && RecentGames.get) ? RecentGames.get() : [];
    const getRecentTimestamp = (gameId) => {
      const histTime = typeof HistoryManager !== 'undefined' && HistoryManager.historyMap?.get(gameId);
      if (histTime) return new Date(histTime).getTime();
      const idx = recentOrder.indexOf(gameId);
      return idx !== -1 ? (1000000 - idx) : 0;
    };

    games = games.slice().sort((a, b) => {
      if (searchTerm) {
        const scoreDiff = State._searchScore(b, searchTerm) - State._searchScore(a, searchTerm);
        if (scoreDiff !== 0) return scoreDiff;
      }
      if (sortMode === 'za') {
        return b.title.localeCompare(a.title);
      }
      if (sortMode === 'recent') {
        const diff = getRecentTimestamp(b.id) - getRecentTimestamp(a.id);
        if (diff !== 0) return diff;
      }
      if (sortMode === 'pinned') {
        const aPin = PinnedGames.isPinned(a.id) ? 1 : 0;
        const bPin = PinnedGames.isPinned(b.id) ? 1 : 0;
        if (bPin !== aPin) return bPin - aPin;
      }
      return a.title.localeCompare(b.title);
    });

    const hasActiveFilter = Boolean(searchTerm || quickFilter !== 'all' || difficultyFilter !== 'all');
    const countBadge = document.getElementById(`grid-count-${viewId}`);
    if (countBadge) {
      countBadge.textContent = hasActiveFilter ? `${games.length} / ${totalCategoryCount}` : String(games.length);
    }

    const bannerEl = document.getElementById(`search-banner-${viewId}`);
    if (bannerEl) {
      if (searchTerm) {
        const categoryNames = {
          all: 'Library',
          tool: 'Teaching Tools',
          printable: 'Printables',
          game: 'Classroom Games',
          workshop: 'Workshop Tools',
          'under-construction': 'Under Construction'
        };
        const scopeLabel = categoryNames[category] || category;
        const safeTerm = escapeHtml(searchTerm);
        const searchAllBtn = category !== 'all'
          ? `<button data-action="filterGames" data-param="all" class="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-bold border-2 border-dark hover:brightness-110 transition-all">Search All Activities</button>`
          : '';
        bannerEl.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-card border-[3px] border-line shadow-hard-sm">
            <div class="flex items-center gap-2 text-sm font-bold text-ink">
              <i data-lucide="search" class="w-4 h-4 text-blue shrink-0"></i>
              <span>Showing <strong>${games.length}</strong> ${games.length === 1 ? 'result' : 'results'} for "<span class="text-blue">${safeTerm}</span>" in ${scopeLabel}</span>
            </div>
            <div class="flex items-center gap-2">
              ${searchAllBtn}
              <button data-action="clearSearch" class="px-3 py-1.5 rounded-lg bg-surface-muted text-ink text-xs font-bold border-2 border-line hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1.5">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                Clear Search
              </button>
            </div>
          </div>
        `;
        bannerEl.classList.remove('hidden');
        Utils.refreshIcons(bannerEl);
      } else {
        bannerEl.classList.add('hidden');
        bannerEl.innerHTML = '';
      }
    }

    if (games.length === 0) {
      if (searchTerm) {
        const safeTerm = escapeHtml(searchTerm);
        const searchAllCta = category !== 'all'
          ? `<button data-action="filterGames" data-param="all" class="btn-chunky bg-blue text-white px-5 py-2.5 rounded-xl text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2"><i data-lucide="grid-2x2" class="w-4 h-4"></i> Search All Activities</button>`
          : '';
        const resetFiltersCta = (quickFilter !== 'all' || difficultyFilter !== 'all')
          ? `<button data-action="resetLibraryFilters" class="btn-chunky bg-orange text-white px-5 py-2.5 rounded-xl text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reset Filters</button>`
          : '';
        grid.innerHTML = `
          <div class="empty-state py-16 flex flex-col items-center text-center animate-pop-in">
            <div class="w-16 h-16 rounded-2xl bg-surface-muted border-[3px] border-line flex items-center justify-center mb-4 shadow-hard-sm">
              <i data-lucide="search-x" class="w-8 h-8 text-ink-muted"></i>
            </div>
            <p class="font-heading font-bold text-2xl uppercase text-ink mb-1">No matches for "${safeTerm}"</p>
            <p class="text-sm font-bold text-ink-muted mb-6">Try another keyword or clear your active filters.</p>
            <div class="flex flex-wrap justify-center gap-3">
              ${searchAllCta}
              ${resetFiltersCta}
              <button data-action="clearSearch" class="btn-chunky bg-card text-ink px-5 py-2.5 rounded-xl text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2">
                <i data-lucide="x" class="w-4 h-4"></i> Clear Search
              </button>
            </div>
          </div>
        `;
      } else if (hasActiveFilter) {
        const emptyTitle = quickFilter === 'pinned' ? 'No pinned activities here yet' : 'No matching activities';
        const emptySub = quickFilter === 'pinned'
          ? 'Pin your favorite tools with the pin icon on any card.'
          : 'Try switching difficulty or resetting your quick filters.';
        grid.innerHTML = `
          <div class="empty-state py-16 flex flex-col items-center text-center animate-pop-in">
            <div class="w-16 h-16 rounded-2xl bg-surface-muted border-[3px] border-line flex items-center justify-center mb-4 shadow-hard-sm">
              <i data-lucide="${quickFilter === 'pinned' ? 'pin' : 'filter'}" class="w-8 h-8 text-ink-muted"></i>
            </div>
            <p class="font-heading font-bold text-2xl uppercase text-ink mb-1">${emptyTitle}</p>
            <p class="text-sm font-bold text-ink-muted mb-6">${emptySub}</p>
            <button data-action="resetLibraryFilters" class="btn-chunky bg-blue text-white px-5 py-2.5 rounded-xl text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reset Filters
            </button>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="empty-state py-20 opacity-50 flex flex-col items-center">
            <i data-lucide="search-x" class="w-16 h-16 mb-4"></i>
            <p class="font-heading font-bold text-xl uppercase">No matches found</p>
          </div>
        `;
      }
    } else {
      if (category === 'all' && sortMode !== 'recent' && sortMode !== 'pinned') {
        const tools = games.filter(g => g.category === 'tool');
        const printables = games.filter(g => g.category === 'printable');
        const gamesList = games.filter(g => g.category === 'game');
        const workshop = games.filter(g => g.category === 'workshop');

        let html = '';
        if (printables.length > 0) html += GameGrid.renderCategorySection('printables', 'printer', 'var(--color-orange)', 'Printables', printables);
        if (tools.length > 0) html += GameGrid.renderCategorySection('tools', 'wrench', 'var(--color-blue)', 'Teaching Tools', tools);
        if (gamesList.length > 0) html += GameGrid.renderCategorySection('games', 'gamepad-2', 'var(--color-green)', 'Classroom Games', gamesList);
        if (workshop.length > 0) html += GameGrid.renderCategorySection('workshop', 'hammer', 'var(--color-pink)', 'Workshop Tools', workshop);
        grid.innerHTML = html;
      } else {
        grid.innerHTML = `<div class="category-grid">${games.map(game => GameGrid.createCard(game)).join('')}</div>`;
      }
    }

    Utils.refreshIcons(grid);
    GameGrid.initCardEffects(grid);
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

    if (homeBtn) {
      const isHome = this.currentView === 'landing';
      homeBtn.classList.toggle('active', isHome);
      if (isHome) homeBtn.setAttribute('aria-current', 'page');
      else homeBtn.removeAttribute('aria-current');
    }
    if (myspaceBtn) {
      const isMySpace = this.currentView === 'myspace';
      myspaceBtn.classList.toggle('active', isMySpace);
      if (isMySpace) myspaceBtn.setAttribute('aria-current', 'page');
      else myspaceBtn.removeAttribute('aria-current');
    }

    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
      const cat = btn.dataset.category;
      const isActive = this.currentView === `library-${cat}`;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    document.querySelectorAll('.bottom-nav-item[data-view]').forEach(btn => {
      const isActive = btn.dataset.view === this.currentView;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
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
    if (term.trim() && (ViewManager.currentView === 'landing' || ViewManager.currentView === 'myspace')) {
      ViewManager.show('library-all', true);
    }
  }, CONFIG.debounceDelay),
  updateUI: () => ViewManager.updateNavUI()
};

const LibraryFilters = {
  setQuickFilter(mode) {
    if (!['all', 'pinned', 'new'].includes(mode)) return;
    State.filters.quickFilter = mode;
    this.syncToolbarUI();
    ViewManager.renderAllGrids();
    AudioEngine.click();
  },

  setDifficulty(level) {
    if (!['all', 'easy', 'medium', 'hard'].includes(level)) return;
    State.filters.difficulty = level;
    this.syncToolbarUI();
    ViewManager.renderAllGrids();
    AudioEngine.click();
  },

  setSort(sort) {
    if (!['az', 'za', 'recent', 'pinned'].includes(sort)) return;
    State.filters.sort = sort;
    if (CONFIG.storageKeys.librarySort) {
      Storage.set(CONFIG.storageKeys.librarySort, sort);
      window.SettingsModal?.syncControls?.();
    }
    this.syncToolbarUI();
    ViewManager.renderAllGrids();
    AudioEngine.click();
  },

  reset() {
    State.filters.quickFilter = 'all';
    State.filters.difficulty = 'all';
    State.filters.sort = window.HubSettings?.get('librarySort') || 'az';
    this.syncToolbarUI();
    ViewManager.renderAllGrids();
    AudioEngine.click();
  },

  syncToolbarUI() {
    document.querySelectorAll('[data-action="setLibraryQuickFilter"]').forEach(btn => {
      const active = btn.dataset.param === State.filters.quickFilter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-library-difficulty]').forEach(sel => {
      sel.value = State.filters.difficulty;
    });
    document.querySelectorAll('[data-library-sort]').forEach(sel => {
      sel.value = State.filters.sort;
    });
  }
};
window.LibraryFilters = LibraryFilters;

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
    if (!State.isPro()) {
      if (!silent) UI.showToast("My Space is exclusive to PRO users", "warning");
      ViewManager.show('landing', silent);
      return;
    }
    ViewManager.show('myspace', silent);
  },

  onShow() {
    // Load default app if none active
    if (!this.currentApp) {
      this.loadApp('myspace-home', true);
    }

  },

  loadApp(appId, silent = false) {
    const iframe = document.getElementById('myspace-iframe');
    const loader = document.getElementById('myspace-loader');
    if (!iframe || !loader) return;

    const game = State.getGameById(appId);
    if (!game) return;

    // Handle Pro check
    if (game.pro && !State.isPro()) {
      UI.showToast("This app is exclusive to PRO users", "warning");
      return;
    }

    // Handle Admin-only check
    if (game.adminOnly && !State.isAdmin()) {
      UI.showToast("This app is exclusive to ADMIN users", "warning");
      return;
    }

    this.currentApp = appId;

    // Show loader
    loader.classList.remove('opacity-0', 'pointer-events-none');
    iframe.classList.add('opacity-0');

    // Load iframe
    iframe.onload = () => {
      loader.classList.add('opacity-0', 'pointer-events-none');
      iframe.classList.remove('opacity-0');
      if (typeof App !== 'undefined' && App.bridgeIframeKeyboard) {
        App.bridgeIframeKeyboard(iframe);
      }
    };
    iframe.src = game.path;

    if (!silent) AudioEngine.click();
  },

  updateFullscreenIcon(isFs) {
    const icon = document.getElementById('myspace-fs-icon');
    if (icon) {
      icon.setAttribute('data-lucide', isFs ? 'minimize-2' : 'maximize');
      Utils.refreshIcons(icon.parentElement);
    }
  },

  toggleFullscreen() {
    const iframe = document.getElementById('myspace-iframe');
    if (!iframe) return;

    AudioEngine.click();

    const isFallbackFs = document.body.classList.contains('myspace-fullscreen');
    if (!document.fullscreenElement && !isFallbackFs) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen().catch(() => {
          document.body.classList.add('myspace-fullscreen');
          this.updateFullscreenIcon(true);
        });
      } else {
        document.body.classList.add('myspace-fullscreen');
        this.updateFullscreenIcon(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      document.body.classList.remove('myspace-fullscreen');
      this.updateFullscreenIcon(false);
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

      UI.rememberFocus('input-popup');
      titleEl.textContent = title;
      field.value = defaultValue;
      field.placeholder = placeholder || 'Type here...';

      popup.classList.remove('hidden');
      popup.classList.add('flex');
      popup.setAttribute('aria-hidden', 'false');
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
    popup.setAttribute('aria-hidden', 'true');
    UI.restoreFocus('input-popup');
  }
};
window.InputPopup = InputPopup;


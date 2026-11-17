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
      const escapedTerm = State.filters.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      displayTitle = displayTitle.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
      displayDesc = displayDesc.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
    }
    
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
      <article class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" 
        data-action="openGame" data-param="${game.id}" role="button" tabindex="0"
        aria-label="Launch ${game.title}: ${game.description}">
        <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
          <button data-action="togglePin" data-param="${game.id}" 
            class="pin-btn absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-dark opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 hover:scale-110"
            title="${pinTitle}" aria-label="${isPinned ? `Unpin ${game.title}` : `Pin ${game.title}`}" aria-pressed="${isPinned}">
            <i data-lucide="${pinIcon}" class="w-4 h-4" aria-hidden="true"></i>
          </button>
          <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(#000 2px,transparent 2px);background-size:12px 12px"></div>
          <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
          <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
          <div class="flex justify-between items-start mb-3">
            <div class="card-title-group flex flex-col gap-1">
              <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${displayTitle}</h2>
              ${badgesHtml}
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
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
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
    const headingClass = category === 'all' ? 'greeting-display ' : '';

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
            <h2 class="${headingClass}text-3xl md:text-5xl font-heading font-black mb-1 leading-tight tracking-tight text-slate-900 dark:text-white">
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
            <button id="recent-toggle-btn" data-action="toggleRecentCollapse" class="p-1.5 rounded-lg border-2 border-dark dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle Recent List">
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

      <!-- Grid Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-2xl font-heading font-black text-dark dark:text-white uppercase tracking-tight">${gridHeadings[category] || category + 's'}</h3>
        <div class="view-toggle-group">
          <button data-action="setViewMode" data-param="cards" aria-label="Card View" aria-pressed="${ViewMode.current === 'cards'}" title="Card View" class="view-toggle-btn ${ViewMode.current === 'cards' ? 'active' : ''}"><i data-lucide="layout-grid" class="w-4 h-4" aria-hidden="true"></i></button>
          <button data-action="setViewMode" data-param="icons" aria-label="Icon View" aria-pressed="${ViewMode.current === 'icons'}" title="Icon View" class="view-toggle-btn ${ViewMode.current === 'icons' ? 'active' : ''}"><i data-lucide="grip" class="w-4 h-4" aria-hidden="true"></i></button>
          <button data-action="setViewMode" data-param="list" aria-label="List View" aria-pressed="${ViewMode.current === 'list'}" title="List View" class="view-toggle-btn ${ViewMode.current === 'list' ? 'active' : ''}"><i data-lucide="list" class="w-4 h-4" aria-hidden="true"></i></button>
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

    const searchTerm = State.filters.searchTerm.trim();
    const escapeHtml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    let games = State.games;
    
    if (category !== 'all') {
      games = games.filter(g => g.category === category);
    } else {
      games = games.filter(g => ['tool', 'printable', 'game', 'workshop'].includes(g.category));
    }
    
    if (searchTerm) {
      games = games.filter(g => 
        g.title.toLowerCase().includes(searchTerm) || 
        g.description.toLowerCase().includes(searchTerm) ||
        (searchTerm === 'new' && g.new) ||
        g.tags?.some(t => t.toLowerCase().includes(searchTerm))
      );
    }

    // Privilege & Visibility Filters
    games = games.filter(g => {
      if (g.active === false) return false;
      if (g.pro && !State.isPro()) return false;
      if (g.adminOnly && !State.isAdmin()) return false;
      return true;
    });

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
          <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border-[3px] border-dark dark:border-slate-600 shadow-hard-sm">
            <div class="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <i data-lucide="search" class="w-4 h-4 text-blue shrink-0"></i>
              <span>Showing <strong>${games.length}</strong> ${games.length === 1 ? 'result' : 'results'} for "<span class="text-blue dark:text-blue-400">${safeTerm}</span>" in ${scopeLabel}</span>
            </div>
            <div class="flex items-center gap-2">
              ${searchAllBtn}
              <button data-action="clearSearch" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-dark dark:text-white text-xs font-bold border-2 border-dark dark:border-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1.5">
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
        grid.innerHTML = `
          <div class="empty-state py-16 flex flex-col items-center text-center animate-pop-in">
            <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border-[3px] border-dark dark:border-slate-600 flex items-center justify-center mb-4 shadow-hard-sm">
              <i data-lucide="search-x" class="w-8 h-8 text-slate-400"></i>
            </div>
            <p class="font-heading font-bold text-2xl uppercase text-dark dark:text-white mb-1">No matches for "${safeTerm}"</p>
            <p class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">Try another keyword or clear your search filter.</p>
            <div class="flex flex-wrap justify-center gap-3">
              ${searchAllCta}
              <button data-action="clearSearch" class="btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white px-5 py-2.5 rounded-xl text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2">
                <i data-lucide="x" class="w-4 h-4"></i> Clear Search
              </button>
            </div>
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
      if (category === 'all') {
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


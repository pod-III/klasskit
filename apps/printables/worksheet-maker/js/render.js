    // --- Zoom & Sidebar UI State ---
    let currentZoomMode = localStorage.getItem('worksheet_zoom') || '1';
    let sidebarCollapsed = false;
    let rightSidebarCollapsed = false;

    function setPreviewZoom(mode) {
      currentZoomMode = String(mode);
      try { localStorage.setItem('worksheet_zoom', currentZoomMode); } catch (e) {}
      applyPreviewZoom();
    }

    function applyPreviewZoom() {
      const wrappers = document.querySelectorAll('#print-sheet-container .page-wrapper');
      const sheetPane = document.getElementById('print-sheet-container');
      const area = document.getElementById('previewArea');
      if (wrappers.length) {
        let zoomVal = 1;
        if (currentZoomMode === 'fit') {
          const host = (sheetPane && sheetPane.clientWidth > 0) ? sheetPane : area;
          const availW = host ? Math.max(240, host.clientWidth - 40) : 794;
          zoomVal = Math.min(1, Math.max(0.35, +(availW / 810).toFixed(2)));
        } else {
          zoomVal = parseFloat(currentZoomMode) || 1;
        }
        wrappers.forEach((w) => { w.style.zoom = String(zoomVal); });
      }
      ['0.5', '0.75', '1', 'fit'].forEach((k) => {
        const btn = document.getElementById(`zoom-${k}`);
        if (!btn) return;
        const active = currentZoomMode === k;
        btn.classList.toggle('bg-brand-blue', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-slate-600', !active);
        btn.classList.toggle('dark:text-slate-300', !active);
      });
    }

    function toggleSidebar() {
      sidebarCollapsed = !sidebarCollapsed;
      const aside = document.getElementById('ws-sidebar');
      if (aside) {
        if (window.innerWidth < 768) {
          aside.classList.toggle('hidden', sidebarCollapsed);
        } else {
          aside.classList.toggle('hidden-panel-desktop', sidebarCollapsed);
        }
        setTimeout(() => applyPreviewZoom(), 260);
      }
    }

    function toggleRightSidebar() {
      rightSidebarCollapsed = !rightSidebarCollapsed;
      const aside = document.getElementById('ws-right-sidebar');
      if (aside) {
        if (window.innerWidth < 768) {
          aside.classList.toggle('hidden', rightSidebarCollapsed);
        } else {
          aside.classList.toggle('hidden-panel-desktop', rightSidebarCollapsed);
        }
        setTimeout(() => applyPreviewZoom(), 260);
      }
    }

    // --- Main Rendering (Card Maker Architecture) ---
    function getQuestionCardTone(type) {
      const map = {
        mcq: 'text-pink bg-pink/10 border-pink/30',
        fib: 'text-orange bg-orange/10 border-orange/30',
        sa: 'text-blue bg-blue/10 border-blue/30',
        tf: 'text-green bg-green/10 border-green/30',
        matching: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
        essay: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
        unscramble: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
        sort: 'text-teal-600 bg-teal-500/10 border-teal-500/30',
        drawing: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
        checklist: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
        passage: 'text-sky-600 bg-sky-500/10 border-sky-500/30',
        section: 'text-slate-700 bg-slate-500/15 border-slate-500/30 dark:text-slate-200'
      };
      return map[type] || map.sa;
    }

    function getModuleButtonsByGroup(groups, layout = 'sidebar') {
      const items = Object.values(QUESTION_TYPES).filter(t => groups.includes(t.group));
      if (layout === 'tray') {
        return items.map(t => `
          <button type="button" data-action="add-question" data-type="${t.id}" class="btn-chunky bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-dark dark:text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
            <i data-lucide="${t.icon}" class="w-3.5 h-3.5 text-blue"></i>
            <span>${t.label}</span>
          </button>
        `).join('');
      }
      return items.map(t => `
        <button type="button" data-action="add-question" data-type="${t.id}" class="btn-chunky bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-dark dark:text-white py-2 px-2 rounded-xl text-[10px] flex items-center justify-start gap-1.5 text-left">
          <i data-lucide="${t.icon}" class="w-3.5 h-3.5 text-blue shrink-0"></i>
          <span class="truncate">${t.label}</span>
        </button>
      `).join('');
    }

    function getSidebarHTML() {
      const settings = getWorksheetSettings();
      const totalPts = getTotalPoints();
      const isDark = document.documentElement.classList.contains('dark');
      const presetBtnCls = (mode) => state.viewMode === mode
        ? 'bg-brand-blue text-white shadow-hard-sm'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700';

      return `
        <aside id="ws-sidebar" class="sidebar glass-panel no-print flex flex-col p-4 sm:p-5 ${sidebarCollapsed && window.innerWidth >= 768 ? 'hidden-panel-desktop' : ''} ${sidebarCollapsed && window.innerWidth < 768 ? 'hidden' : ''}">
          <!-- Header (Card Maker Style) -->
          <div class="mb-4 border-b-2 border-slate-100 dark:border-slate-700 pb-4 flex items-center justify-between gap-2 shrink-0">
            <div class="min-w-0">
              <h1 class="text-2xl sm:text-3xl font-heading text-brand-dark dark:text-white tracking-tight leading-none">
                WORKSHEET<span class="text-brand-blue">MAKER</span>
              </h1>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 rounded bg-brand-dark text-white text-[10px] font-bold uppercase tracking-widest">KlassKit</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Edition</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" data-action="toggle-theme" title="Toggle Dark Mode" aria-label="Toggle dark mode"
                class="bg-white dark:bg-slate-800 text-brand-dark dark:text-white p-2 rounded-full border-2 border-brand-dark dark:border-slate-500 shadow-neo-sm hover:-translate-y-0.5 transition-all group">
                <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4 ${isDark ? 'text-orange group-hover:rotate-90' : 'group-hover:rotate-12'} transition-transform"></i>
              </button>
              <button type="button" data-action="toggle-sidebar" title="Hide Sidebar" class="md:hidden bg-pink/15 text-pink p-2 rounded-full border-2 border-brand-dark dark:border-slate-500 shadow-neo-sm">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Active Set Banner -->
          <div id="active-set-indicator" class="hidden mb-4 animate-pop-in bg-brand-blue/10 border-2 border-brand-blue/30 rounded-xl p-3 flex items-center gap-3 shrink-0">
            <div class="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center text-white shrink-0 shadow-neo-sm">
              <i data-lucide="layers" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold text-brand-blue uppercase tracking-wider leading-none mb-1">Active Worksheet</p>
              <p id="active-set-name" class="text-sm font-bold truncate dark:text-white">Untitled</p>
            </div>
            <button type="button" onclick="closeActiveSet()" title="Detach active worksheet" class="text-slate-400 hover:text-pink transition-colors shrink-0">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Scrollable Sidebar Body -->
          <div id="sidebar-scroll-body" class="space-y-6 flex-1 overflow-y-auto pr-1.5 custom-scrollbar">

            <!-- View Mode & Quick Workspace Actions -->
            <section class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <label class="section-label mb-0">Workspace Mode</label>
                <span id="ws-summary-pill" class="px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue border border-brand-blue/40 text-[10px] font-extrabold font-mono uppercase">
                  ${state.worksheet.questions.length} Qs · ${totalPts} Pts
                </span>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <button type="button" data-action="set-view-mode" data-mode="edit" class="py-2 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${presetBtnCls('edit')}">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Builder
                </button>
                <button type="button" data-action="set-view-mode" data-mode="split" class="py-2 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${presetBtnCls('split')}">
                  <i data-lucide="columns-2" class="w-3.5 h-3.5"></i> Split
                </button>
                <button type="button" data-action="set-view-mode" data-mode="preview" class="py-2 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${presetBtnCls('preview')}">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i> A4 Sheet
                </button>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <button type="button" data-action="set-answer-mode" data-ans="false" class="py-1.5 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${!state.showAnswers ? 'bg-green text-dark shadow-hard-sm' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300'}">
                  Student Sheet
                </button>
                <button type="button" data-action="set-answer-mode" data-ans="true" class="py-1.5 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${state.showAnswers ? 'bg-orange text-dark shadow-hard-sm' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300'}">
                  Answer Key
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onclick="createNewSet()" class="btn-chunky bg-white dark:bg-slate-700 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 dark:text-white">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> New
                </button>
                <button type="button" data-action="open-bulk-import" class="btn-chunky bg-pink text-white py-2 rounded-xl text-xs flex items-center justify-center gap-1.5">
                  <i data-lucide="file-up" class="w-3.5 h-3.5"></i> Bulk Import
                </button>
              </div>
            </section>

            <!-- Quick Add Modules (Questions + Activities & Layout) -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 space-y-3">
              <div>
                <label class="section-label">Questions</label>
                <div class="grid grid-cols-2 gap-1.5">
                  ${getModuleButtonsByGroup(['question'], 'sidebar')}
                </div>
              </div>
              <div>
                <label class="section-label">Activities &amp; Layout</label>
                <div class="grid grid-cols-2 gap-1.5">
                  ${getModuleButtonsByGroup(['activity', 'layout'], 'sidebar')}
                </div>
              </div>
            </section>

            <!-- Starter Presets -->
            ${getStarterPresetsSidebarHTML()}

            <!-- Saved Worksheets Library -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 space-y-3">
              <div class="flex items-center justify-between">
                <label class="section-label mb-0">Library</label>
                <select id="sets-sort" onchange="changeSetsSort()" class="bg-transparent text-[10px] font-bold text-slate-400 outline-none cursor-pointer hover:text-brand-blue uppercase tracking-widest">
                  <option value="recent" ${sortMode === 'recent' ? 'selected' : ''}>Recent</option>
                  <option value="alpha" ${sortMode === 'alpha' ? 'selected' : ''}>Alpha</option>
                  <option value="popular" ${sortMode === 'popular' ? 'selected' : ''}>Popular</option>
                </select>
              </div>
              <div class="flex gap-2">
                <input type="text" id="set-name-input" placeholder="Set name..." class="input-chunky flex-1 py-2 px-3 text-xs">
                <button id="save-btn" type="button" onclick="saveCurrentSet()" class="btn-chunky bg-pink text-white py-2 px-3 rounded-xl text-xs flex items-center gap-1 shrink-0">
                  <i data-lucide="save" class="w-3.5 h-3.5"></i> Save
                </button>
              </div>
              <div id="sets-list" class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1"></div>
            </section>

            <!-- Data Backup (JSON Export / Import) -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 pb-2">
              <label class="section-label">Data Backup (With Images)</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" data-action="export-json" class="btn-chunky bg-white dark:bg-slate-700 py-2 rounded-xl text-xs flex items-center justify-center gap-1 dark:text-white" title="Export self-contained JSON backup">
                  <i data-lucide="download" class="w-3.5 h-3.5 text-orange"></i> Export JSON
                </button>
                <button type="button" data-action="import-json" class="btn-chunky bg-white dark:bg-slate-700 py-2 rounded-xl text-xs flex items-center justify-center gap-1 dark:text-white" title="Import Worksheet JSON (v1 or v2)">
                  <i data-lucide="upload" class="w-3.5 h-3.5 text-blue"></i> Import JSON
                </button>
              </div>
            </section>
          </div>

          <!-- Sticky Footer Print & View Action -->
          <div class="mt-4 pt-4 border-t-2 border-brand-dark dark:border-slate-700 shrink-0">
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-action="print" class="btn-chunky bg-green text-dark py-3 rounded-xl text-sm flex items-center justify-center gap-1.5" title="Print A4 Worksheet">
                <i data-lucide="printer" class="w-4 h-4"></i> PRINT
              </button>
              <button type="button" data-action="set-view-mode" data-mode="${state.viewMode === 'preview' ? 'edit' : 'preview'}" class="btn-chunky bg-orange text-dark py-3 rounded-xl text-sm flex items-center justify-center gap-1.5">
                <i data-lucide="${state.viewMode === 'preview' ? 'edit-3' : 'eye'}" class="w-4 h-4"></i> ${state.viewMode === 'preview' ? 'BUILDER' : 'A4 PREVIEW'}
              </button>
            </div>
          </div>
        </aside>
      `;
    }

    function getRightSidebarHTML() {
      const settings = getWorksheetSettings();

      return `
        <aside id="ws-right-sidebar" class="sidebar-right glass-panel no-print flex flex-col p-4 sm:p-5 ${rightSidebarCollapsed && window.innerWidth >= 768 ? 'hidden-panel-desktop' : ''} ${rightSidebarCollapsed && window.innerWidth < 768 ? 'hidden' : ''}">
          <div class="mb-4 border-b-2 border-slate-100 dark:border-slate-700 pb-3.5 flex items-center justify-between gap-2 shrink-0">
            <div class="min-w-0">
              <h2 class="text-lg font-heading text-brand-dark dark:text-white tracking-tight leading-none uppercase flex items-center gap-2">
                <i data-lucide="palette" class="w-4 h-4 text-brand-pink"></i> Sheet Style
              </h2>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Appearance &amp; Paper</p>
            </div>
            <button type="button" data-action="toggle-right-sidebar" title="Hide Style Panel" class="md:hidden bg-pink/15 text-pink p-2 rounded-full border-2 border-brand-dark dark:border-slate-500 shadow-neo-sm">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div id="right-sidebar-scroll-body" class="space-y-5 flex-1 overflow-y-auto pr-1.5 custom-scrollbar pb-2">
            <!-- Title & Instructions -->
            <section class="space-y-2.5">
              <label class="section-label mb-0">Header Text</label>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Title</span>
                <input type="text" data-action="update-ws-title" value="${esc(state.worksheet.title)}" placeholder="Worksheet Title" class="input-chunky py-2 px-3 text-xs">
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Instructions</span>
                <textarea data-action="update-ws-inst" rows="2" placeholder="Student instructions..." class="input-chunky py-2 px-3 text-xs resize-none">${esc(state.worksheet.instructions)}</textarea>
              </div>
            </section>

            <!-- Sheet Visual Theme -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 space-y-3">
              <div>
                <span class="section-label">Sheet Theme</span>
                <div class="grid grid-cols-2 gap-1.5">
                  ${Object.values(WS_LOOK_THEMES).map(t => {
                    const active = settings.theme === t.id;
                    return `
                      <button type="button" data-action="set-ws-look" data-setting="theme" data-val="${t.id}"
                        class="text-left p-2 rounded-xl border-2 transition-all ${active ? 'border-brand-blue bg-brand-blue/10 dark:bg-brand-blue/20 shadow-hard-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-dark dark:hover:border-slate-500'}">
                        <div class="text-[11px] font-heading font-bold uppercase ${active ? 'text-brand-blue dark:text-blue-300' : 'text-dark dark:text-white'}">${t.label}</div>
                        <div class="text-[9px] text-slate-400 truncate">${t.desc}</div>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Accent Palette -->
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Accent Color</span>
                <div class="flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-slate-900/70 p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                  ${Object.values(WS_ACCENTS).map(a => {
                    const active = settings.accentColor === a.id;
                    return `
                      <button type="button" data-action="set-ws-look" data-setting="accentColor" data-val="${a.id}" title="${a.label}" aria-label="Accent color ${a.label}"
                        class="w-7 h-7 rounded-full border-2 border-brand-dark dark:border-slate-300 transition-transform ${active ? 'scale-110 ring-2 ring-brand-blue ring-offset-2 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100 hover:scale-105'}"
                        style="background:${a.hex};">
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </section>

            <!-- Typography, Header Banner, Border, Columns -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 space-y-3">
              <label class="section-label mb-0">Typography &amp; Layout</label>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Font Style</span>
                  <select data-action="update-ws-setting" data-setting="fontFamily" class="input-chunky py-1.5 px-2 text-xs cursor-pointer">
                    <option value="sans" ${settings.fontFamily === 'sans' ? 'selected' : ''}>Nunito Sans</option>
                    <option value="serif" ${settings.fontFamily === 'serif' ? 'selected' : ''}>Classic Serif</option>
                    <option value="rounded" ${settings.fontFamily === 'rounded' ? 'selected' : ''}>Playful Rounded</option>
                    <option value="mono" ${settings.fontFamily === 'mono' ? 'selected' : ''}>Monospace</option>
                  </select>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Text Size</span>
                  <select data-action="update-ws-setting" data-setting="fontSize" class="input-chunky py-1.5 px-2 text-xs cursor-pointer">
                    <option value="sm" ${settings.fontSize === 'sm' ? 'selected' : ''}>Compact</option>
                    <option value="md" ${settings.fontSize === 'md' ? 'selected' : ''}>Standard A4</option>
                    <option value="lg" ${settings.fontSize === 'lg' ? 'selected' : ''}>Primary Large</option>
                  </select>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Header Look</span>
                  <select data-action="update-ws-setting" data-setting="headerStyle" class="input-chunky py-1.5 px-2 text-xs cursor-pointer">
                    <option value="standard" ${settings.headerStyle === 'standard' ? 'selected' : ''}>Standard</option>
                    <option value="boxed" ${settings.headerStyle === 'boxed' ? 'selected' : ''}>Boxed Frame</option>
                    <option value="compact" ${settings.headerStyle === 'compact' ? 'selected' : ''}>Compact 1-Line</option>
                    <option value="banner" ${settings.headerStyle === 'banner' ? 'selected' : ''}>Color Banner</option>
                  </select>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Page Border</span>
                  <select data-action="update-ws-setting" data-setting="pageBorder" class="input-chunky py-1.5 px-2 text-xs cursor-pointer">
                    <option value="none" ${settings.pageBorder === 'none' ? 'selected' : ''}>No Frame</option>
                    <option value="simple" ${settings.pageBorder === 'simple' ? 'selected' : ''}>Solid Frame</option>
                    <option value="double" ${settings.pageBorder === 'double' ? 'selected' : ''}>Double Rule</option>
                    <option value="dashed" ${settings.pageBorder === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="neo" ${settings.pageBorder === 'neo' ? 'selected' : ''}>Neo Block</option>
                  </select>
                </div>
              </div>

              <!-- Question Columns Toggle -->
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Question Columns</span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button type="button" data-action="set-ws-look" data-setting="questionColumns" data-val="1" class="py-1.5 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase ${Number(settings.questionColumns) !== 2 ? 'bg-brand-blue text-white shadow-hard-sm' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300'}">1 Column</button>
                  <button type="button" data-action="set-ws-look" data-setting="questionColumns" data-val="2" class="py-1.5 px-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase ${Number(settings.questionColumns) === 2 ? 'bg-brand-blue text-white shadow-hard-sm' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300'}">2 Columns</button>
                </div>
              </div>
            </section>

            <!-- Paper Options -->
            <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4 space-y-2">
              <label class="section-label mb-0">Paper Options</label>
              <div class="space-y-1.5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" data-action="update-ws-setting" data-setting="showHeaderFields" ${settings.showHeaderFields ? 'checked' : ''} class="w-4 h-4 accent-blue cursor-pointer">
                  <span>Show Name / Date / Section lines</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" data-action="update-ws-setting" data-setting="showTotalScore" ${settings.showTotalScore ? 'checked' : ''} class="w-4 h-4 accent-blue cursor-pointer">
                  <span>Show Total Score badge</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" data-action="update-ws-setting" data-setting="showPoints" ${settings.showPoints ? 'checked' : ''} class="w-4 h-4 accent-blue cursor-pointer">
                  <span>Show per-question points</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300" title="Automatically list all Fill-in-the-Blank answers in a Word Bank at the top of the printout">
                  <input type="checkbox" data-action="update-ws-setting" data-setting="showWordBank" ${settings.showWordBank ? 'checked' : ''} class="w-4 h-4 accent-green cursor-pointer">
                  <span>Auto FIB Word Bank box</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" data-action="update-ws-setting" data-setting="showFooter" ${settings.showFooter ? 'checked' : ''} class="w-4 h-4 accent-purple cursor-pointer">
                  <span>Custom bottom footer text</span>
                </label>
                <div class="${settings.showFooter ? 'block pt-1' : 'hidden'}">
                  <input type="text" data-action="update-ws-setting" data-setting="footerText" value="${esc(settings.footerText)}" placeholder="e.g. Great effort! ★ ★ ★" class="input-chunky py-1.5 px-2.5 text-xs">
                </div>
              </div>
            </section>
          </div>
        </aside>
      `;
    }

    function getPageFrameStyle(look) {
      const borderMode = look.settings.pageBorder || 'none';
      const fontRule = `font-family:${look.fontCss}; height:100%; display:flex; flex-direction:column; box-sizing:border-box;`;
      if (borderMode === 'simple') return `${fontRule} border:2px solid ${look.accent.hex}; border-radius:10px; padding:14px 16px;`;
      if (borderMode === 'double') return `${fontRule} border:5px double ${look.accent.hex}; border-radius:8px; padding:14px 16px;`;
      if (borderMode === 'dashed') return `${fontRule} border:2.5px dashed ${look.accent.hex}; border-radius:16px; padding:14px 16px;`;
      if (borderMode === 'neo') return `${fontRule} border:3px solid #0f172a; border-radius:14px; padding:16px 18px; box-shadow:5px 5px 0 ${look.accent.hex};`;
      return fontRule;
    }

    function getWorksheetHeaderHTML(look, totalPts) {
      const s = look.settings;
      const title = esc(state.worksheet.title) || 'Untitled Worksheet';
      const hStyle = s.headerStyle || 'standard';
      const scoreBadge = s.showTotalScore
        ? `<span class="text-xs font-extrabold border px-2.5 py-0.5 rounded shrink-0" style="border-color:${look.accent.hex}; background:${look.accent.soft}; color:${look.accent.dark};">Total: ${totalPts} pts</span>`
        : '';

      if (hStyle === 'banner') {
        return `
          <div class="mb-5">
            <div class="px-5 py-3.5 rounded-xl flex items-center justify-between gap-4 mb-3.5" style="background:${look.accent.hex}; color:#ffffff;">
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight flex-1">${title}</h1>
              ${s.showTotalScore ? `<span class="text-xs font-extrabold px-2.5 py-1 rounded-lg border border-white/60 bg-black/15 text-white shrink-0">Total: ${totalPts} pts</span>` : ''}
            </div>
            ${s.showHeaderFields ? `
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-medium pb-2 border-b border-slate-300">
                <div class="flex gap-1.5 sm:col-span-2"><span>Name:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-1.5"><span>Date:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-1.5 items-end"><span>Score:</span><div class="flex-1 border-b border-slate-700 text-right text-xs text-slate-600 print:text-black">${s.showTotalScore ? `/ ${totalPts}` : ''}</div></div>
              </div>
            ` : ''}
          </div>
        `;
      }

      if (hStyle === 'boxed') {
        return `
          <div class="mb-5 p-4 rounded-xl bg-white" style="border:2px solid ${look.theme === 'neo' ? '#0f172a' : look.accent.hex};">
            <div class="flex items-baseline justify-between gap-4 ${s.showHeaderFields ? 'mb-3.5 pb-2.5 border-b border-slate-200' : ''}">
              <h1 class="text-2xl sm:text-3xl font-extrabold flex-1 ${s.showHeaderFields ? 'text-center' : ''}" style="color:#0f172a;">${title}</h1>
              ${!s.showHeaderFields ? scoreBadge : ''}
            </div>
            ${s.showHeaderFields ? `
              <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-medium">
                <div class="flex gap-2"><span>Name:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-2"><span>Date:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-2"><span>Section:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-2 items-end"><span>Score:</span><div class="flex-1 border-b border-slate-700 text-right text-xs text-slate-600 print:text-black">${s.showTotalScore ? `/ ${totalPts}` : ''}</div></div>
              </div>
            ` : ''}
          </div>
        `;
      }

      if (hStyle === 'compact') {
        return `
          <div class="pb-3 mb-5" style="border-bottom:2px solid ${look.accent.hex};">
            <div class="flex items-baseline justify-between gap-4 ${s.showHeaderFields ? 'mb-2.5' : ''}">
              <h1 class="text-2xl font-extrabold flex-1">${title}</h1>
              ${!s.showHeaderFields ? scoreBadge : ''}
            </div>
            ${s.showHeaderFields ? `
              <div class="grid grid-cols-4 gap-3 text-xs sm:text-sm font-medium">
                <div class="col-span-2 flex gap-1.5"><span>Name:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-1.5"><span>Date:</span><div class="flex-1 border-b border-slate-700"></div></div>
                <div class="flex gap-1.5 items-end"><span>Score:</span><div class="flex-1 border-b border-slate-700 text-right text-xs text-slate-600 print:text-black">${s.showTotalScore ? `/ ${totalPts}` : ''}</div></div>
              </div>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="pb-4 mb-5" style="border-bottom:2.5px solid ${look.accent.hex};">
          <div class="flex items-baseline justify-between gap-4 ${s.showHeaderFields ? 'mb-5' : ''}">
            <h1 class="text-3xl font-extrabold flex-1 ${s.showHeaderFields ? 'text-center' : ''}">${title}</h1>
            ${!s.showHeaderFields ? scoreBadge : ''}
          </div>
          ${s.showHeaderFields ? `
            <div class="flex justify-between items-end mb-3.5 font-medium text-base sm:text-lg">
              <div class="flex gap-2 w-1/2"><span>Name:</span><div class="flex-1 border-b border-black"></div></div>
              <div class="flex gap-2 w-1/4"><span>Date:</span><div class="flex-1 border-b border-black"></div></div>
            </div>
            <div class="flex justify-between items-end font-medium text-base sm:text-lg">
              <div class="flex gap-2 w-1/3"><span>Section:</span><div class="flex-1 border-b border-black"></div></div>
              <div class="flex gap-2 w-1/3 items-end"><span>Score:</span><div class="flex-1 border-b border-black text-right text-sm text-gray-600 print:text-black">${s.showTotalScore ? `/ ${totalPts}` : ''}</div></div>
            </div>
          ` : ''}
        </div>
      `;
    }

    function getContinuationHeaderHTML(look, pageNum) {
      const title = esc(state.worksheet.title) || 'Untitled Worksheet';
      return `
        <div class="pb-2.5 mb-4 flex items-end justify-between gap-4" style="border-bottom:2px solid ${look.accent.hex};">
          <div class="min-w-0">
            <div class="text-base font-extrabold uppercase tracking-wide text-slate-900 truncate">${title}</div>
            <div class="text-[11px] font-bold text-slate-500">Continued — Page ${pageNum}</div>
          </div>
          ${look.settings.showHeaderFields ? `
            <div class="flex items-end gap-2 text-xs font-semibold text-slate-700 shrink-0 w-44">
              <span>Name:</span><div class="flex-1 border-b border-slate-700"></div>
            </div>
          ` : ''}
        </div>
      `;
    }

    function buildWorksheetFooterHTML(settings, pageNum, totalPages) {
      const leftText = (settings.showFooter && settings.footerText)
        ? esc(settings.footerText)
        : (state.showAnswers ? 'Teacher Answer Key' : 'Printable Worksheet');
      const pageLabel = totalPages > 1 ? ` · Page ${pageNum} / ${totalPages}` : '';
      return `
        <div class="kk-print-brand-footer mt-auto pt-3">
          <span class="kk-print-footer-note">${leftText}${pageLabel}</span>
          <span class="kk-print-brand-mark">
            <span class="kk-brand-dots" aria-hidden="true">
              <span class="kk-brand-dot" style="background:#ff4785"></span>
              <span class="kk-brand-dot" style="background:#ff7e33"></span>
              <span class="kk-brand-dot" style="background:#00d063"></span>
              <span class="kk-brand-dot" style="background:#1ea7fd"></span>
            </span>
            <span>Made with <strong>KlassKit</strong></span>
          </span>
        </div>
      `;
    }

    function buildWorksheetRowBlocks(look) {
      const previewBuilders = {
        mcq: getMCQPreview,
        fib: getFIBPreview,
        sa: getSAEditor ? getSAPreview : getSAPreview,
        tf: getTFPreview,
        matching: getMatchingPreview,
        essay: getEssayPreview,
        unscramble: getUnscramblePreview,
        sort: getSortPreview,
        drawing: getDrawingPreview,
        checklist: getChecklistPreview,
        passage: (q) => getPassagePreview(q),
        section: (q) => getSectionPreview(q)
      };

      let qNum = 0;
      const blocks = state.worksheet.questions.map((q) => {
        const typeMeta = Object.values(QUESTION_TYPES).find(t => t.id === q.type);
        if (!(typeMeta && typeMeta.nonNumbered)) qNum += 1;
        const fn = previewBuilders[q.type];
        const html = fn ? fn(q, qNum) : '';
        const fullSpan = look.isTwoCol && (q.type === 'section' || q.type === 'passage');
        return { html, fullSpan };
      }).filter(b => b.html);

      if (!look.isTwoCol) {
        return blocks.map(b => `<div class="w-full" style="display:flow-root;">${b.html}</div>`);
      }

      const rows = [];
      let pairBuf = [];
      const flushPair = () => {
        if (!pairBuf.length) return;
        rows.push(`<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">${pairBuf.join('')}</div>`);
        pairBuf = [];
      };
      for (const b of blocks) {
        if (b.fullSpan) {
          flushPair();
          rows.push(`<div class="w-full" style="display:flow-root;">${b.html}</div>`);
        } else {
          pairBuf.push(b.html);
          if (pairBuf.length === 2) flushPair();
        }
      }
      flushPair();
      return rows;
    }

    function paginateWorksheetRows(look, scale, totalPts, rowHtmlList) {
      if (!rowHtmlList.length) return [[]];

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed; left:-99999px; top:0; visibility:hidden; pointer-events:none; z-index:-1;';
      const sheet = document.createElement('div');
      sheet.className = 'a4-sheet text-black';
      const frame = document.createElement('div');
      frame.setAttribute('style', getPageFrameStyle(look));
      sheet.appendChild(frame);
      host.appendChild(sheet);
      document.body.appendChild(host);

      try {
        const frameCs = getComputedStyle(frame);
        const framePadY = (parseFloat(frameCs.paddingTop) || 0) + (parseFloat(frameCs.paddingBottom) || 0);
        const frameInnerH = frame.clientHeight - framePadY;

        const footerProbe = document.createElement('div');
        footerProbe.style.display = 'flow-root';
        footerProbe.innerHTML = buildWorksheetFooterHTML(look.settings, 1, 2);
        frame.appendChild(footerProbe);
        const footerH = footerProbe.offsetHeight + 18;
        frame.removeChild(footerProbe);

        const p1TopProbe = document.createElement('div');
        p1TopProbe.style.display = 'flow-root';
        p1TopProbe.innerHTML = `
          ${getWorksheetHeaderHTML(look, totalPts)}
          ${state.worksheet.instructions ? `<div class="mb-6 p-3.5 italic text-slate-800 rounded-lg text-sm" style="background:${look.accent.soft}; border-left:4px solid ${look.accent.hex};"><strong>Instructions:</strong> ${esc(state.worksheet.instructions)}</div>` : ''}
          ${getPreviewWordBankHTML()}
        `;
        frame.appendChild(p1TopProbe);
        const p1TopH = p1TopProbe.offsetHeight;
        frame.removeChild(p1TopProbe);

        const pNTopProbe = document.createElement('div');
        pNTopProbe.style.display = 'flow-root';
        pNTopProbe.innerHTML = getContinuationHeaderHTML(look, 2);
        frame.appendChild(pNTopProbe);
        const pNTopH = pNTopProbe.offsetHeight;
        frame.removeChild(pNTopProbe);

        const p1Limit = Math.max(120, frameInnerH - p1TopH - footerH);
        const pNLimit = Math.max(120, frameInnerH - pNTopH - footerH);

        const rowsWrap = document.createElement('div');
        rowsWrap.className = `relative z-10 ${scale.wrapperText}`;
        rowsWrap.innerHTML = rowHtmlList.join('');
        frame.appendChild(rowsWrap);

        const heights = Array.from(rowsWrap.children).map((el) => {
          const cs = getComputedStyle(el);
          return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
        });

        const pages = [];
        let current = [];
        let used = 0;
        let limit = p1Limit;

        rowHtmlList.forEach((html, idx) => {
          const h = heights[idx] || 0;
          if (current.length > 0 && used + h > limit) {
            pages.push(current);
            current = [html];
            used = h;
            limit = pNLimit;
          } else {
            current.push(html);
            used += h;
          }
        });
        if (current.length > 0) pages.push(current);
        return pages;
      } finally {
        host.remove();
      }
    }

    function renderPaginatedWorksheetPreview() {
      const stack = document.getElementById('a4-pages-stack');
      if (!stack) return;

      const look = getWorksheetLookStyles();
      const settings = look.settings;
      const scale = look.scale;
      const totalPts = getTotalPoints();
      const rowHtmlList = buildWorksheetRowBlocks(look);
      const pages = paginateWorksheetRows(look, scale, totalPts, rowHtmlList);
      const totalPages = pages.length;

      const watermarkHtml = state.showAnswers ? `
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0 no-print">
          <h1 class="text-[120px] font-black text-blue/30 -rotate-45 whitespace-nowrap">ANSWER KEY</h1>
        </div>
      ` : '';

      stack.innerHTML = pages.map((pageRows, idx) => {
        const pageNum = idx + 1;
        const isFirst = idx === 0;
        const topHtml = isFirst
          ? `
            ${getWorksheetHeaderHTML(look, totalPts)}
            ${state.worksheet.instructions ? `
              <div class="mb-6 p-3.5 italic text-slate-800 rounded-lg text-sm" style="background:${look.accent.soft}; border-left:4px solid ${look.accent.hex};">
                <strong>Instructions:</strong> ${esc(state.worksheet.instructions)}
              </div>
            ` : ''}
            ${getPreviewWordBankHTML()}
          `
          : getContinuationHeaderHTML(look, pageNum);

        const emptyNotice = (isFirst && state.worksheet.questions.length === 0)
          ? '<div class="text-center py-20 text-gray-400 italic">No modules added yet. Add a question or layout block from the sidebar or Builder view.</div>'
          : '';

        return `
          <div class="page-wrapper flex flex-col items-center">
            <div class="no-print w-full flex items-center justify-between gap-3 mb-2 px-1">
              <span class="text-xs font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Page ${pageNum} of ${totalPages} — ${state.showAnswers ? 'Answer Key' : 'Student Copy'}
              </span>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800/80 border border-brand-dark/30 dark:border-slate-600 text-slate-600 dark:text-slate-300 uppercase">
                210 × 297 mm
              </span>
            </div>
            <div class="a4-sheet text-black">
              <div id="${isFirst ? 'ws-page-frame' : `ws-page-frame-${pageNum}`}" style="${getPageFrameStyle(look)}">
                ${topHtml}
                ${isFirst ? watermarkHtml : ''}
                <div class="relative z-10 ${scale.wrapperText}">
                  ${pageRows.join('')}
                </div>
                ${emptyNotice}
                ${buildWorksheetFooterHTML(settings, pageNum, totalPages)}
              </div>
            </div>
          </div>
        `;
      }).join('');

      applyPreviewZoom();
    }

    function refreshLivePreview() {
      renderPaginatedWorksheetPreview();
      const totalPts = getTotalPoints();
      const summary = `${state.worksheet.questions.length} Qs · ${totalPts} Pts`;
      const p1 = document.getElementById('ws-summary-pill');
      const p2 = document.getElementById('ws-top-summary-pill');
      if (p1) p1.textContent = summary;
      if (p2) p2.textContent = summary;
    }

    function getWorkspaceHTML() {
      const totalPts = getTotalPoints();
      const isEdit = state.viewMode === 'edit';
      const isSplit = state.viewMode === 'split';
      const isPreview = state.viewMode === 'preview';

      const editorBuilders = {
        mcq: getMCQEditor,
        fib: getFIBEditor,
        sa: getSAEditor,
        tf: getTFEditor,
        matching: getMatchingEditor,
        essay: getEssayEditor,
        unscramble: getUnscrambleEditor,
        sort: getSortEditor,
        drawing: getDrawingEditor,
        checklist: getChecklistEditor,
        passage: getPassageEditor,
        section: getSectionEditor
      };

      let builderQNum = 0;
      const qHtml = state.worksheet.questions.map((q, index) => {
        const typeInfo = Object.values(QUESTION_TYPES).find(t => t.id === q.type) || QUESTION_TYPES.SA;
        const isLayoutBlock = q.type === 'section' || q.type === 'passage';
        if (!typeInfo.nonNumbered) builderQNum += 1;
        const badgeLbl = typeInfo.nonNumbered ? (q.type === 'section' ? 'SEC' : 'INFO') : `${builderQNum}`;
        const editorHtml = (editorBuilders[q.type] || getSAEditor)(q);

        return `
          <div class="bg-white dark:bg-slate-800 rounded-2xl border-[3px] border-brand-dark dark:border-slate-600 shadow-neo dark:shadow-[4px_4px_0px_0px_#000000] overflow-hidden group animate-pop-in">
            <div class="bg-slate-50 dark:bg-slate-900/90 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-brand-dark dark:border-slate-600">
              <div class="flex items-center gap-2 font-bold text-sm font-heading uppercase tracking-wide">
                <span class="bg-brand-dark text-white dark:bg-slate-700 px-2.5 py-0.5 rounded-lg text-xs">${badgeLbl}</span>
                <span class="w-7 h-7 rounded-lg border flex items-center justify-center ${getQuestionCardTone(q.type)}">
                  <i data-lucide="${typeInfo.icon}" class="w-4 h-4"></i>
                </span>
                <select data-action="change-q-type" data-qid="${q.id}" aria-label="Module ${index + 1} type" class="bg-white dark:bg-slate-800 border-2 border-brand-dark/30 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-heading font-bold uppercase text-dark dark:text-white cursor-pointer focus:outline-none focus:border-blue">
                  ${Object.values(QUESTION_TYPES).map(t => `<option value="${t.id}" ${t.id === q.type ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
              </div>
              <div class="flex items-center gap-1">
                ${isLayoutBlock ? '' : `
                  <div class="flex items-center mr-2 border-2 border-brand-dark dark:border-slate-500 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                    <span class="px-2 text-[11px] text-slate-500 dark:text-slate-400 border-r-2 border-brand-dark dark:border-slate-500 bg-slate-50 dark:bg-slate-900 font-black">Pts</span>
                    <input type="number" min="0" data-action="update-q-pts" data-qid="${q.id}" value="${q.points}" class="w-12 px-2 py-1 text-xs font-bold outline-none bg-transparent text-dark dark:text-white" />
                  </div>
                `}
                <button type="button" data-action="duplicate-question" data-qid="${q.id}" title="Duplicate Module" class="p-1.5 text-slate-500 hover:text-blue dark:text-slate-400 dark:hover:text-blue hover:bg-blue/10 rounded-lg transition-all"><i data-lucide="copy" class="w-4 h-4"></i></button>
                <button type="button" data-action="move-up" data-qid="${q.id}" ${index === 0 ? 'disabled' : ''} title="Move Up" class="p-1.5 text-slate-500 hover:text-dark dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                <button type="button" data-action="move-down" data-qid="${q.id}" ${index === state.worksheet.questions.length - 1 ? 'disabled' : ''} title="Move Down" class="p-1.5 text-slate-500 hover:text-dark dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                <div class="w-0.5 h-5 bg-slate-300 dark:bg-slate-700 mx-1 rounded-full"></div>
                <button type="button" data-action="delete-question" data-qid="${q.id}" title="Delete Module" class="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
            </div>
            <div class="p-4 sm:p-5">${editorHtml}</div>
          </div>
        `;
      }).join('');

      const emptyStateHtml = state.worksheet.questions.length === 0 ? `
        <div class="text-center py-12 px-5 text-slate-500 dark:text-slate-400 border-[3px] border-dashed border-brand-dark/50 dark:border-slate-600 rounded-2xl bg-white/90 dark:bg-slate-800/90 shadow-neo dark:shadow-none animate-pop-in">
          <i data-lucide="file-edit" class="w-12 h-12 mx-auto mb-3 text-slate-400 dark:text-slate-500"></i>
          <p class="text-xl font-bold font-heading text-dark dark:text-white uppercase tracking-wide">Your worksheet is empty</p>
          <p class="text-sm mt-1.5 font-medium max-w-md mx-auto">Add a question block below, choose a Starter Preset in the left panel, or paste formatted text in Bulk Import.</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" data-action="open-bulk-import" class="btn-chunky bg-pink text-white px-5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <i data-lucide="file-up" class="w-4 h-4"></i> Bulk Import Text
            </button>
            <button type="button" data-action="add-question" data-type="mcq" class="btn-chunky bg-blue text-white px-5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-4 h-4"></i> Add First MCQ
            </button>
          </div>
        </div>
      ` : '';

      const modeTabCls = (m) => state.viewMode === m
        ? 'bg-brand-blue text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

      return `
        <main id="previewArea" class="preview-area transition-all duration-300 flex-1 p-4 sm:p-6 pb-24">

          <!-- Sticky Top Workspace Bar -->
          <div class="workspace-toolbar no-print sticky top-0 z-30 mb-6 flex flex-wrap items-center justify-between gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-[3px] border-brand-dark dark:border-slate-500 rounded-2xl p-2 shadow-neo dark:shadow-[4px_4px_0px_0px_#000000]">
            <div class="flex items-center gap-2 flex-wrap">
              <button id="toggle-sidebar-btn" type="button" data-action="toggle-sidebar" title="Toggle Sidebar" class="p-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:-translate-y-0.5 transition-transform">
                <i data-lucide="panel-left" class="w-4 h-4"></i>
              </button>
              <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button type="button" data-action="set-view-mode" data-mode="edit" class="px-3 py-1 rounded-lg text-[11px] font-heading font-bold uppercase transition-colors flex items-center gap-1.5 ${modeTabCls('edit')}">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Builder
                </button>
                <button type="button" data-action="set-view-mode" data-mode="split" class="px-3 py-1 rounded-lg text-[11px] font-heading font-bold uppercase transition-colors flex items-center gap-1.5 ${modeTabCls('split')}">
                  <i data-lucide="columns-2" class="w-3.5 h-3.5"></i> Split View
                </button>
                <button type="button" data-action="set-view-mode" data-mode="preview" class="px-3 py-1 rounded-lg text-[11px] font-heading font-bold uppercase transition-colors flex items-center gap-1.5 ${modeTabCls('preview')}">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i> A4 Sheet
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <span id="ws-top-summary-pill" class="hidden sm:inline-flex text-[11px] font-black text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 font-mono">
                ${state.worksheet.questions.length} Qs · ${totalPts} Pts
              </span>
              <label class="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border-2 border-brand-dark/25 dark:border-slate-600 text-xs font-bold">
                <input type="checkbox" data-action="toggle-answers" ${state.showAnswers ? 'checked' : ''} class="w-4 h-4 rounded accent-orange cursor-pointer">
                <span class="font-heading text-[11px] uppercase tracking-wider">Answer Key</span>
              </label>
              <button type="button" data-action="print" class="btn-chunky bg-green text-dark px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print
              </button>
              <button id="toggle-right-sidebar-btn" type="button" data-action="toggle-right-sidebar" title="Toggle Style Panel" class="p-2 rounded-xl border-2 border-brand-dark dark:border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:-translate-y-0.5 transition-transform">
                <i data-lucide="panel-right" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Content Area -->
          <div class="workspace-grid ${isSplit ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start' : 'flex flex-col items-center'}">

            <!-- BUILDER PANE -->
            <div class="editor-pane no-print ${isPreview ? 'hidden' : 'w-full'} ${isEdit ? 'max-w-3xl' : ''} space-y-5">
              <!-- Compact Title & Instructions Header Card -->
              <div class="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl border-[3px] border-brand-dark dark:border-slate-600 shadow-neo dark:shadow-[4px_4px_0px_0px_#000000] p-5 space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="section-label mb-0">Worksheet Overview</span>
                  <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${state.showAnswers ? 'bg-orange/15 text-orange border border-orange/40' : 'bg-green/15 text-green border border-green/40'} uppercase">
                    ${state.showAnswers ? 'Answer Key Active' : 'Student Copy'}
                  </span>
                </div>
                <input type="text" data-action="update-ws-title" value="${esc(state.worksheet.title)}" placeholder="Worksheet Title..." class="input-chunky text-lg sm:text-xl font-heading font-bold py-2.5 px-3.5" />
                <textarea data-action="update-ws-inst" rows="2" placeholder="Student instructions..." class="input-chunky text-xs sm:text-sm font-semibold py-2 px-3.5 resize-y">${esc(state.worksheet.instructions)}</textarea>
              </div>

              <!-- Question Cards -->
              <div class="space-y-5">${qHtml}</div>
              ${emptyStateHtml}

              <!-- Inline Add Module Tray -->
              <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl border-[3px] border-dashed border-brand-dark/50 dark:border-slate-600 p-4 space-y-3">
                <div>
                  <span class="section-label text-center">Add Question Module</span>
                  <div class="flex flex-wrap justify-center gap-2">
                    ${getModuleButtonsByGroup(['question'], 'tray')}
                  </div>
                </div>
                <div class="border-t border-slate-200 dark:border-slate-700 pt-2.5">
                  <span class="section-label text-center">Add Activity or Layout Block</span>
                  <div class="flex flex-wrap justify-center gap-2">
                    ${getModuleButtonsByGroup(['activity', 'layout'], 'tray')}
                  </div>
                </div>
              </div>
            </div>

            <!-- LIVE A4 SHEET PANE (Card Maker Multi-Page Simulation, always used for Print) -->
            <div id="print-sheet-container" class="${isEdit ? 'hidden' : 'flex flex-col items-center'} shrink-0">
              <div id="a4-pages-stack" class="flex flex-col items-center gap-8"></div>
            </div>

          </div>

          <!-- Floating Bottom-Right Zoom Bar (inside center preview area) -->
          <div id="zoom-bar" class="no-print ${isEdit ? 'hidden' : 'sticky bottom-4 ml-auto mt-6 w-fit z-[60] flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-[3px] border-brand-dark dark:border-slate-500 rounded-2xl p-1 shadow-neo dark:shadow-[4px_4px_0px_0px_#000000]'}">
            <button type="button" onclick="setPreviewZoom(0.5)" id="zoom-0.5" class="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors">50%</button>
            <button type="button" onclick="setPreviewZoom(0.75)" id="zoom-0.75" class="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors">75%</button>
            <button type="button" onclick="setPreviewZoom(1)" id="zoom-1" class="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors">100%</button>
            <button type="button" onclick="setPreviewZoom('fit')" id="zoom-fit" class="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors" title="Fit page to screen">FIT</button>
          </div>

        </main>
      `;
    }


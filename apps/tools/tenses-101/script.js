/* ============================================================================
   TENSE DIVER — SCRIPT.JS
   Soft Brutalist 16-Tense Explorer, Interactive Timeline Builder,
   Live Sentence Lab, Quick Quiz, Side-by-Side Comparator & Board Mode
   ============================================================================ */
(function () {
    'use strict';

    const STORAGE_KEY = 'kk_tenses_state_v2';
    const THEME_KEY = 'theme_tenses-101';

    const ACCENT_MAP = {
        green: {
            bg: 'bg-green',
            bgSoft: 'bg-green/15',
            text: 'text-green',
            border: 'border-green',
            borderSoft: 'border-green/40'
        },
        pink: {
            bg: 'bg-pink',
            bgSoft: 'bg-pink/15',
            text: 'text-pink',
            border: 'border-pink',
            borderSoft: 'border-pink/40'
        },
        blue: {
            bg: 'bg-blue',
            bgSoft: 'bg-blue/15',
            text: 'text-blue',
            border: 'border-blue',
            borderSoft: 'border-blue/40'
        },
        orange: {
            bg: 'bg-orange',
            bgSoft: 'bg-orange/15',
            text: 'text-orange',
            border: 'border-orange',
            borderSoft: 'border-orange/40'
        }
    };

    const TOOL_LABELS = {
        pin: 'Event Pin',
        range: 'Duration Range',
        arrow: 'Result Arrow',
        marker: 'Time Marker'
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getData() {
        return window.TenseDiverData || {
            TENSE_GROUPS: [],
            TENSE_ORDER: [],
            TENSES: {},
            SUBJECTS: [],
            VERBS: [],
            COMPARE_PAIRS: [],
            conjugateTense: () => ({ full: '', segments: [] })
        };
    }

    const App = {
        state: {
            currentTenseKey: 'presentSimple',
            sentenceForm: 'pos', // 'pos' | 'neg' | 'q'
            stageMode: 'explore', // 'explore' | 'builder'
            stepRevealCount: null, // null = show all, 1..N = step reveal
            labSubject: 'I',
            labVerb: 'play',
            activeLabTab: 'lab', // 'lab' | 'quiz'
            isBoardMode: false,

            masteredTenses: [],
            quizPassedTenses: [],
            customExamples: {},
            builderDrafts: {},

            compareLeft: 'pastSimple',
            compareRight: 'presentPerfect'
        },

        builder: {
            tool: null,
            items: [],
            undoStack: [],
            selectedIdx: -1,
            showSolution: false
        },

        quizAnswers: {}, // { tenseKey: { [qIdx]: chosenOptionIdx } }
        searchQuery: '',
        _initialized: false,
        _listenersBound: false,
        _quotaWarned: false,
        _cancelConfirm: null,

        /* ====================================================================
           BOOT & PERSISTENCE
           ==================================================================== */
        async init() {
            if (this._initialized) return;
            this._initialized = true;

            if (typeof requireAuth === 'function') {
                try {
                    await requireAuth();
                } catch (e) {
                    console.warn('Auth check skipped cleanly:', e);
                }
            }

            this.loadPersistedState();
            this.syncThemeUI();
            this.bindListeners();
            this.renderCompareSelectors();
            this.renderLabPills();
            this.renderSidebar();
            this.loadTense(this.state.currentTenseKey, { skipDraftSave: true });
            this.safeCreateIcons(document);
        },

        safeLocalSet(key, val) {
            try {
                localStorage.setItem(key, val);
                return true;
            } catch (e) {
                if (!this._quotaWarned) {
                    this._quotaWarned = true;
                    this.showToast('Browser storage full — changes kept in memory only', 'warning');
                }
                return false;
            }
        },

        loadPersistedState() {
            const { TENSES, SUBJECTS, VERBS } = getData();
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return;

                if (parsed.currentTenseKey && TENSES[parsed.currentTenseKey]) {
                    this.state.currentTenseKey = parsed.currentTenseKey;
                }
                if (['pos', 'neg', 'q'].includes(parsed.sentenceForm)) {
                    this.state.sentenceForm = parsed.sentenceForm;
                }
                if (parsed.labSubject && SUBJECTS.some((s) => s.id === parsed.labSubject)) {
                    this.state.labSubject = parsed.labSubject;
                }
                if (parsed.labVerb && VERBS.some((v) => v.id === parsed.labVerb)) {
                    this.state.labVerb = parsed.labVerb;
                }
                if (['lab', 'quiz'].includes(parsed.activeLabTab)) {
                    this.state.activeLabTab = parsed.activeLabTab;
                }
                if (Array.isArray(parsed.masteredTenses)) {
                    this.state.masteredTenses = parsed.masteredTenses.filter((k) => Boolean(TENSES[k]));
                }
                if (Array.isArray(parsed.quizPassedTenses)) {
                    this.state.quizPassedTenses = parsed.quizPassedTenses.filter((k) => Boolean(TENSES[k]));
                }
                if (parsed.customExamples && typeof parsed.customExamples === 'object') {
                    this.state.customExamples = parsed.customExamples;
                }
                if (parsed.builderDrafts && typeof parsed.builderDrafts === 'object') {
                    this.state.builderDrafts = parsed.builderDrafts;
                }
                if (parsed.compareLeft && TENSES[parsed.compareLeft]) {
                    this.state.compareLeft = parsed.compareLeft;
                }
                if (parsed.compareRight && TENSES[parsed.compareRight]) {
                    this.state.compareRight = parsed.compareRight;
                }
            } catch (e) {
                console.warn('Could not restore saved state:', e);
            }
        },

        persistState() {
            const payload = {
                currentTenseKey: this.state.currentTenseKey,
                sentenceForm: this.state.sentenceForm,
                labSubject: this.state.labSubject,
                labVerb: this.state.labVerb,
                activeLabTab: this.state.activeLabTab,
                masteredTenses: this.state.masteredTenses,
                quizPassedTenses: this.state.quizPassedTenses,
                customExamples: this.state.customExamples,
                builderDrafts: this.state.builderDrafts,
                compareLeft: this.state.compareLeft,
                compareRight: this.state.compareRight
            };
            this.safeLocalSet(STORAGE_KEY, JSON.stringify(payload));
        },

        bindListeners() {
            if (this._listenersBound) return;
            this._listenersBound = true;

            const searchEl = document.getElementById('tenseSearchInput');
            if (searchEl) {
                searchEl.addEventListener('input', () => {
                    this.searchQuery = searchEl.value || '';
                    document.getElementById('tenseSearchClearBtn')?.classList.toggle('is-hidden', !this.searchQuery.trim());
                    this.renderSidebar();
                });
            }

            const customInput = document.getElementById('customExampleInput');
            if (customInput) {
                customInput.addEventListener('input', () => {
                    const key = this.state.currentTenseKey;
                    const cleaned = String(customInput.value || '').slice(0, 140);
                    if (cleaned.trim()) {
                        this.state.customExamples[key] = cleaned;
                    } else {
                        delete this.state.customExamples[key];
                    }
                    this.persistState();
                    const statusEl = document.getElementById('customExampleStatus');
                    if (statusEl) statusEl.textContent = cleaned.trim() ? 'Saved locally' : 'Auto-saves';
                });
            }

            document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

            window.addEventListener('storage', (e) => {
                if (e && (e.key === 'theme_hub' || e.key === THEME_KEY || e.key === 'theme' || e.key === 'klasskit-theme')) {
                    setTimeout(() => this.syncThemeUI(), 0);
                }
            });
        },

        handleGlobalKeydown(e) {
            const confirmModal = document.getElementById('confirmModal');
            const compareModal = document.getElementById('compareModal');

            if (e.key === 'Escape') {
                if (confirmModal && confirmModal.classList.contains('open')) {
                    if (typeof this._cancelConfirm === 'function') this._cancelConfirm();
                    return;
                }
                if (compareModal && compareModal.classList.contains('open')) {
                    this.closeCompareModal();
                    return;
                }
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('is-mobile-open')) {
                    this.toggleSidebar(false);
                }
                return;
            }

            if ((confirmModal && confirmModal.classList.contains('open')) ||
                (compareModal && compareModal.classList.contains('open'))) {
                return;
            }

            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable);
            if (isTyping) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prevTense();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.nextTense();
            } else if (e.key === '1') {
                this.setSentenceForm('pos');
            } else if (e.key === '2') {
                this.setSentenceForm('neg');
            } else if (e.key === '3') {
                this.setSentenceForm('q');
            }
        },

        /* ====================================================================
           THEME, SIDEBAR & BOARD MODE
           ==================================================================== */
        syncThemeUI() {
            const isDark = document.documentElement.classList.contains('dark');
            document.getElementById('themeIconSun')?.classList.toggle('is-hidden', !isDark);
            document.getElementById('themeIconMoon')?.classList.toggle('is-hidden', isDark);
        },

        toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            this.safeLocalSet(THEME_KEY, isDark ? 'dark' : 'light');
            this.safeLocalSet('theme', isDark ? 'dark' : 'light');
            this.syncThemeUI();
        },

        toggleSidebar(force) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (!sidebar) return;
            const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-mobile-open');
            sidebar.classList.toggle('is-mobile-open', open);
            if (backdrop) backdrop.classList.toggle('open', open);
        },

        toggleBoardMode() {
            this.state.isBoardMode = !this.state.isBoardMode;
            document.body.classList.toggle('is-board-mode', this.state.isBoardMode);
            const iconWrap = document.getElementById('boardModeBtn');
            if (iconWrap) {
                const oldIcon = iconWrap.querySelector('svg, [data-lucide]');
                if (oldIcon) {
                    const icon = document.createElement('i');
                    icon.id = 'boardModeIcon';
                    icon.setAttribute('data-lucide', this.state.isBoardMode ? 'minimize-2' : 'maximize-2');
                    icon.className = 'w-4 h-4 text-blue';
                    oldIcon.parentNode.replaceChild(icon, oldIcon);
                    this.safeCreateIcons(iconWrap);
                }
            }
            this.showToast(this.state.isBoardMode ? 'Projector Board Mode ON' : 'Standard Workspace Restored', 'info');
        },

        clearSearch() {
            this.searchQuery = '';
            const el = document.getElementById('tenseSearchInput');
            if (el) el.value = '';
            document.getElementById('tenseSearchClearBtn')?.classList.add('is-hidden');
            this.renderSidebar();
        },

        /* ====================================================================
           SIDEBAR & NAVIGATION
           ==================================================================== */
        updateMasteryIndicators() {
            const { TENSE_ORDER } = getData();
            const total = TENSE_ORDER.length || 16;
            const count = this.state.masteredTenses.length;
            const pct = Math.round((count / total) * 100);

            const hdrText = document.getElementById('masteryHeaderText');
            if (hdrText) hdrText.textContent = `${count} / ${total} Mastered`;

            const sideText = document.getElementById('masteryProgressText');
            if (sideText) sideText.textContent = `${count} / ${total} Mastered`;

            const fill = document.getElementById('masteryProgressFill');
            if (fill) fill.style.width = `${pct}%`;

            const heroBadge = document.getElementById('masteredHeroBadge');
            if (heroBadge) {
                heroBadge.classList.toggle('is-hidden', !this.state.masteredTenses.includes(this.state.currentTenseKey));
            }
        },

        renderSidebar() {
            const container = document.getElementById('sidebarContent');
            if (!container) return;
            const { TENSE_GROUPS, TENSES } = getData();
            const q = (this.searchQuery || '').trim().toLowerCase();
            const masteredSet = new Set(this.state.masteredTenses);

            container.innerHTML = '';
            let matchedCount = 0;

            TENSE_GROUPS.forEach((group) => {
                const filteredKeys = group.keys.filter((key) => {
                    const t = TENSES[key];
                    if (!t) return false;
                    if (!q) return true;
                    return (
                        t.title.toLowerCase().includes(q) ||
                        t.cat.toLowerCase().includes(q) ||
                        t.shortFormula.toLowerCase().includes(q) ||
                        t.signals.some((s) => s.toLowerCase().includes(q))
                    );
                });

                if (!filteredKeys.length) return;
                matchedCount += filteredKeys.length;

                const accent = ACCENT_MAP[group.color] || ACCENT_MAP.blue;
                const sec = document.createElement('div');
                sec.className = 'space-y-1.5';
                sec.innerHTML = `
                    <div class="flex items-center gap-2 px-1.5">
                        <span class="w-2.5 h-2.5 rounded-full ${accent.bg} border border-dark dark:border-slate-500 flex-none"></span>
                        <span class="font-heading font-bold text-xs uppercase tracking-wider text-dark dark:text-slate-200">${escapeHtml(group.label)}</span>
                    </div>
                `;

                const list = document.createElement('div');
                list.className = 'space-y-1';
                filteredKeys.forEach((key) => {
                    const t = TENSES[key];
                    const isActive = key === this.state.currentTenseKey;
                    const isMastered = masteredSet.has(key);

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.id = `nav-${key}`;
                    btn.className = `tense-nav-btn ${isActive ? 'is-active' : ''}`;
                    btn.onclick = () => this.loadTense(key);
                    btn.innerHTML = `
                        <div class="min-w-0 flex-1">
                            <p class="font-extrabold text-xs text-dark dark:text-slate-100 truncate">${escapeHtml(t.title)}</p>
                            <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate font-mono">${escapeHtml(t.shortFormula)}</p>
                        </div>
                        ${isMastered
                            ? '<i data-lucide="circle-check" class="w-4 h-4 text-green flex-none"></i>'
                            : `<span class="w-2 h-2 rounded-full ${accent.bg} ${isActive ? 'opacity-100' : 'opacity-40'} flex-none"></span>`}
                    `;
                    list.appendChild(btn);
                });

                sec.appendChild(list);
                container.appendChild(sec);
            });

            if (matchedCount === 0) {
                container.innerHTML = `
                    <div class="p-6 text-center space-y-2">
                        <i data-lucide="search" class="w-6 h-6 text-slate-400 mx-auto"></i>
                        <p class="text-xs font-bold text-slate-500 dark:text-slate-400">No tenses match "${escapeHtml(this.searchQuery)}".</p>
                    </div>
                `;
            }

            this.updateMasteryIndicators();
            this.safeCreateIcons(container);
        },

        prevTense() {
            const { TENSE_ORDER } = getData();
            if (!TENSE_ORDER.length) return;
            const idx = TENSE_ORDER.indexOf(this.state.currentTenseKey);
            const prevIdx = (idx - 1 + TENSE_ORDER.length) % TENSE_ORDER.length;
            this.loadTense(TENSE_ORDER[prevIdx]);
        },

        nextTense() {
            const { TENSE_ORDER } = getData();
            if (!TENSE_ORDER.length) return;
            const idx = TENSE_ORDER.indexOf(this.state.currentTenseKey);
            const nextIdx = (idx + 1) % TENSE_ORDER.length;
            this.loadTense(TENSE_ORDER[nextIdx]);
        },

        loadTense(key, options = {}) {
            const { TENSES, TENSE_ORDER } = getData();
            const data = TENSES[key];
            if (!data) return;

            if (!options.skipDraftSave && this.state.stageMode === 'builder') {
                this.saveBuilderDraft();
            }

            this.state.currentTenseKey = key;
            this.state.stepRevealCount = null;
            this.persistState();

            const accent = ACCENT_MAP[data.color] || ACCENT_MAP.blue;
            const orderIdx = TENSE_ORDER.indexOf(key) + 1;

            // Header badges & nav highlights
            const hdrMeta = document.getElementById('headerTenseMeta');
            if (hdrMeta) hdrMeta.textContent = `${orderIdx} / ${TENSE_ORDER.length}`;

            const catEl = document.getElementById('tenseCategory');
            if (catEl) {
                catEl.textContent = data.cat;
                catEl.className = `px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider border-2 ${accent.bgSoft} ${accent.text} ${accent.borderSoft}`;
            }

            const idxBadge = document.getElementById('tenseIndexBadge');
            if (idxBadge) idxBadge.textContent = `#${orderIdx} of ${TENSE_ORDER.length}`;

            const titleEl = document.getElementById('tenseTitle');
            if (titleEl) {
                titleEl.textContent = data.title;
                titleEl.className = `font-heading font-bold text-3xl sm:text-4xl uppercase tracking-tight leading-none ${accent.text}`;
            }

            const descEl = document.getElementById('tenseDesc');
            if (descEl) descEl.textContent = data.desc;

            // Signal Word Stickers
            const signalsEl = document.getElementById('signalWordsList');
            if (signalsEl) {
                signalsEl.innerHTML = data.signals.map((sig) => (
                    `<span class="signal-sticker text-dark dark:text-slate-100">${escapeHtml(sig)}</span>`
                )).join('');
            }

            // Formulas, Usage, Mistakes, Class Note
            this.updateFormulaAndExample();
            this.renderUsageAndMistake(data);

            const customInput = document.getElementById('customExampleInput');
            const customStatus = document.getElementById('customExampleStatus');
            const savedEx = this.state.customExamples[key] || '';
            if (customInput) customInput.value = savedEx;
            if (customStatus) customStatus.textContent = savedEx ? 'Saved locally' : 'Auto-saves';

            // Lab & Quiz
            this.setLabTab(this.state.activeLabTab);
            this.renderSentenceLab();
            this.renderQuiz();

            // Sidebar & Timeline Stage
            this.renderSidebar();

            if (this.state.stageMode === 'builder') {
                this.restoreBuilderForCurrentTense();
            } else {
                this.renderExploreStage();
            }

            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                this.toggleSidebar(false);
            }
        },

        setSentenceForm(form) {
            if (!['pos', 'neg', 'q'].includes(form)) return;
            this.state.sentenceForm = form;
            this.persistState();
            this.updateFormulaAndExample();
            this.renderSentenceLab();
        },

        updateFormulaAndExample() {
            const { TENSES } = getData();
            const data = TENSES[this.state.currentTenseKey];
            if (!data) return;

            const form = this.state.sentenceForm;
            ['pos', 'neg', 'q'].forEach((f) => {
                const cap = f === 'pos' ? 'Pos' : (f === 'neg' ? 'Neg' : 'Q');
                document.getElementById(`formBtn${cap}`)?.classList.toggle('is-active', form === f);
            });

            const formulaEl = document.getElementById('tenseFormula');
            if (formulaEl) formulaEl.textContent = data.formulas[form] || data.formulas.pos;

            const exEl = document.getElementById('heroExampleText');
            if (exEl) exEl.textContent = data.examples[form] || data.examples.pos;
        },

        renderUsageAndMistake(data) {
            const listEl = document.getElementById('usageList');
            if (listEl) {
                listEl.innerHTML = data.usage.map((u) => `
                    <li class="flex items-start gap-2.5">
                        <span class="w-5 h-5 rounded-full bg-green/20 text-green flex items-center justify-center flex-none mt-0.5">
                            <i data-lucide="check" class="w-3 h-3"></i>
                        </span>
                        <div class="min-w-0 text-xs sm:text-sm">
                            <span class="font-extrabold text-dark dark:text-white">${escapeHtml(u.title)}:</span>
                            <span class="font-semibold text-slate-600 dark:text-slate-300"> ${escapeHtml(u.detail)}</span>
                        </div>
                    </li>
                `).join('');
                this.safeCreateIcons(listEl);
            }

            const wrongEl = document.getElementById('mistakeWrong');
            const rightEl = document.getElementById('mistakeRight');
            const tipEl = document.getElementById('mistakeTip');
            if (wrongEl) wrongEl.textContent = data.mistake?.wrong || '';
            if (rightEl) rightEl.textContent = data.mistake?.right || '';
            if (tipEl) tipEl.textContent = data.mistake?.tip || '';
        },

        /* ====================================================================
           EXPLORE TIMELINE & ANIMATED REUSABLE DRAWING ENGINE
           ==================================================================== */
        setStageMode(mode) {
            const next = mode === 'builder' ? 'builder' : 'explore';
            this.state.stageMode = next;
            this.state.stepRevealCount = null;

            const isBuilder = next === 'builder';
            document.getElementById('modeExploreBtn')?.classList.toggle('is-active-blue', !isBuilder);
            document.getElementById('modeBuilderBtn')?.classList.toggle('is-active-orange', isBuilder);

            document.getElementById('exploreControls')?.classList.toggle('is-hidden', isBuilder);
            document.getElementById('builderControls')?.classList.toggle('is-hidden', !isBuilder);
            document.getElementById('builderDock')?.classList.toggle('is-hidden', !isBuilder);
            document.getElementById('builderBadge')?.classList.toggle('is-hidden', !isBuilder);
            document.getElementById('stepStatusBadge')?.classList.add('is-hidden');
            document.getElementById('timelineContainer')?.classList.toggle('is-builder-active', isBuilder);

            if (isBuilder) {
                this.restoreBuilderForCurrentTense();
            } else {
                this.builder.showSolution = false;
                document.getElementById('solutionLayer').innerHTML = '';
                this.renderExploreStage();
            }
        },

        renderExploreStage() {
            const { TENSES } = getData();
            const data = TENSES[this.state.currentTenseKey];
            const layer = document.getElementById('timelineLayer');
            const solLayer = document.getElementById('solutionLayer');
            if (solLayer) solLayer.innerHTML = '';
            if (!data || !layer) return;

            const items = (this.state.stepRevealCount !== null)
                ? data.viz.slice(0, this.state.stepRevealCount)
                : data.viz;

            const stepBadge = document.getElementById('stepStatusBadge');
            if (stepBadge) {
                if (this.state.stepRevealCount !== null) {
                    stepBadge.textContent = `Step ${this.state.stepRevealCount} / ${data.viz.length}`;
                    stepBadge.classList.remove('is-hidden');
                } else {
                    stepBadge.classList.add('is-hidden');
                }
            }

            this.drawTimeline(layer, items, data.color, { animate: true });
        },

        replayAnimation() {
            this.state.stepRevealCount = null;
            if (this.state.stageMode === 'builder') {
                this.renderBuilderStage();
            } else {
                this.renderExploreStage();
            }
        },

        stepTimeline() {
            const { TENSES } = getData();
            const data = TENSES[this.state.currentTenseKey];
            if (!data) return;

            if (this.state.stageMode === 'builder') {
                this.setStageMode('explore');
            }

            const total = data.viz.length;
            if (this.state.stepRevealCount === null || this.state.stepRevealCount >= total) {
                this.state.stepRevealCount = 1;
            } else {
                this.state.stepRevealCount += 1;
            }
            this.renderExploreStage();
        },

        drawTimeline(layerEl, items, colorKey, options = {}) {
            if (!layerEl) return;
            layerEl.innerHTML = '';

            const accent = ACCENT_MAP[colorKey] || ACCENT_MAP.blue;
            const isBuilder = Boolean(options.builder);
            const isGhostSolution = Boolean(options.ghostSolution);
            const isMini = Boolean(options.mini);
            const animate = options.animate !== false;
            const selectedIdx = typeof options.selectedIdx === 'number' ? options.selectedIdx : -1;

            const frag = document.createDocumentFragment();
            const created = [];

            items.forEach((item, index) => {
                const isSpan = item.type === 'range' || item.type === 'arrow';
                const el = document.createElement('div');
                el.className = [
                    't-item',
                    isSpan ? 't-item-span' : 't-item-point',
                    isGhostSolution ? 'is-ghost-solution' : '',
                    isBuilder ? 'is-builder-item' : '',
                    (isBuilder && index === selectedIdx) ? 'is-selected' : '',
                    !animate ? 'is-entered' : ''
                ].filter(Boolean).join(' ');

                el.style.left = `${item.l}%`;
                el.style.top = `${item.y || 52}%`;
                if (isSpan) {
                    el.style.width = `${item.w || 18}%`;
                }
                if (animate) {
                    el.style.transitionDelay = `${index * 65}ms`;
                }

                const labelClass = (item.labelPos === 'bottom') ? 't-label-bottom' : 't-label-top';
                const labelHtml = item.label
                    ? `<span class="t-label-pill ${labelClass}">${escapeHtml(item.label)}</span>`
                    : '';

                if (item.type === 'pin') {
                    const iconInner = item.cross
                        ? '<i data-lucide="x" class="w-4 h-4"></i>'
                        : `<i data-lucide="map-pin" class="${isMini ? 'w-3 h-3' : 'w-4 h-4'}"></i>`;
                    el.innerHTML = `
                        <div class="relative flex flex-col items-center">
                            <div class="t-visual-core t-pin-head ${accent.bg} ${item.ghost ? 'is-ghost' : ''}">
                                ${iconInner}
                            </div>
                            ${labelHtml}
                        </div>
                    `;
                } else if (item.type === 'range') {
                    el.innerHTML = `
                        <div class="relative w-full">
                            <div class="t-visual-core t-range-bar ${accent.bg} ${item.active ? 'is-active' : ''} ${item.ghost ? 'is-ghost' : ''}"></div>
                            ${labelHtml}
                        </div>
                    `;
                } else if (item.type === 'arrow') {
                    el.innerHTML = `
                        <div class="relative w-full">
                            <div class="t-visual-core t-arrow-line">
                                <div class="t-arrow-shaft ${item.dashed ? 'is-dashed' : ''}"></div>
                                <div class="t-arrow-head"></div>
                            </div>
                            ${labelHtml}
                        </div>
                    `;
                } else if (item.type === 'marker') {
                    el.innerHTML = `
                        <div class="relative flex flex-col items-center">
                            <div class="t-visual-core t-marker-stick"></div>
                            ${labelHtml}
                        </div>
                    `;
                }

                if (isBuilder) {
                    this.attachBuilderItemDrag(el, index);
                }

                frag.appendChild(el);
                created.push(el);
            });

            layerEl.appendChild(frag);
            this.safeCreateIcons(layerEl);

            if (animate && created.length) {
                const trigger = () => {
                    created.forEach((node) => node.classList.add('is-entered'));
                };
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(trigger);
                } else {
                    trigger();
                }
            }
        },

        /* ====================================================================
           INTERACTIVE TIMELINE BUILDER (DRAG, RESIZE, UNDO, SOLUTION, CHECK)
           ==================================================================== */
        restoreBuilderForCurrentTense() {
            const key = this.state.currentTenseKey;
            const draft = this.state.builderDrafts[key];
            this.builder.items = Array.isArray(draft) ? draft.map((it) => ({ ...it })) : [];
            this.builder.undoStack = [];
            this.builder.selectedIdx = this.builder.items.length ? 0 : -1;
            this.builder.showSolution = false;
            this.updateBuilderToolUI();
            this.renderBuilderStage();
            if (this.builder.items.length) {
                this.setBuilderFeedback(`Restored your draft (${this.builder.items.length} item${this.builder.items.length === 1 ? '' : 's'}). Keep editing or Check Answer!`, 'blue');
            } else {
                this.setBuilderFeedback('Select a tool above, then click on the timeline. Drag any placed item to reposition.', 'muted');
            }
        },

        saveBuilderDraft() {
            const key = this.state.currentTenseKey;
            if (this.builder.items.length > 0) {
                this.state.builderDrafts[key] = this.builder.items.map((it) => ({ ...it }));
            } else {
                delete this.state.builderDrafts[key];
            }
            this.persistState();
        },

        pushUndoSnapshot() {
            this.builder.undoStack.push(this.builder.items.map((it) => ({ ...it })));
            if (this.builder.undoStack.length > 25) {
                this.builder.undoStack.shift();
            }
        },

        updateBuilderToolUI() {
            ['pin', 'range', 'arrow', 'marker'].forEach((t) => {
                document.getElementById(`tool-${t}`)?.classList.toggle('is-selected', this.builder.tool === t);
            });
            this.updateBuilderInspector();
        },

        updateBuilderInspector() {
            const box = document.getElementById('builderInspector');
            const labelEl = document.getElementById('builderInspectorLabel');
            const widthWrap = document.getElementById('builderWidthControls');
            if (!box) return;

            const item = this.builder.items[this.builder.selectedIdx];
            if (!item) {
                box.classList.add('is-hidden');
                return;
            }

            box.classList.remove('is-hidden');
            const side = item.l < 48 ? 'Past' : (item.l > 52 ? 'Future' : 'Now');
            if (labelEl) {
                labelEl.textContent = `Selected: ${TOOL_LABELS[item.type] || item.type} (${Math.round(item.l)}% · ${side})`;
            }
            if (widthWrap) {
                const isSpan = item.type === 'range' || item.type === 'arrow';
                widthWrap.classList.toggle('is-hidden', !isSpan);
            }
        },

        selectTool(toolName) {
            if (!['pin', 'range', 'arrow', 'marker'].includes(toolName)) return;
            if (this.state.stageMode !== 'builder') {
                this.setStageMode('builder');
            }
            this.builder.tool = toolName;
            this.updateBuilderToolUI();
            this.setBuilderFeedback(`Click the timeline canvas to place your ${TOOL_LABELS[toolName]}.`, 'blue');
        },

        handleTimelineClick(e) {
            if (this.state.stageMode !== 'builder' || !this.builder.tool) return;
            if (e.target && typeof e.target.closest === 'function') {
                if (e.target.closest('.is-builder-item') || e.target.closest('button')) return;
            }

            const stage = document.getElementById('timelineContainer');
            const rect = stage ? stage.getBoundingClientRect() : { left: 0, width: 600 };
            const width = Math.max(100, rect.width || 600);
            const rawX = (typeof e.clientX === 'number' ? e.clientX : rect.left + width * 0.5) - rect.left;
            const rawPct = Math.max(6, Math.min(92, (rawX / width) * 100));

            const isSpan = this.builder.tool === 'range' || this.builder.tool === 'arrow';
            const spanW = isSpan ? 20 : 0;
            const clampedL = isSpan ? Math.min(rawPct, 94 - spanW) : rawPct;

            this.pushUndoSnapshot();
            this.builder.items.push({
                type: this.builder.tool,
                l: Math.round(clampedL),
                w: spanW,
                y: isSpan ? 62 : 44,
                label: TOOL_LABELS[this.builder.tool] || 'Item',
                labelPos: isSpan ? 'bottom' : 'top'
            });
            this.builder.selectedIdx = this.builder.items.length - 1;
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
        },

        attachBuilderItemDrag(el, idx) {
            el.addEventListener('pointerdown', (ev) => {
                ev.stopPropagation();
                this.builder.selectedIdx = idx;
                this.updateBuilderInspector();

                // Highlight selected item immediately
                document.querySelectorAll('#timelineLayer .t-item').forEach((n, i) => {
                    n.classList.toggle('is-selected', i === idx);
                });

                const stage = document.getElementById('timelineContainer');
                if (!stage || typeof document.addEventListener !== 'function') return;

                const startX = ev.clientX || 0;
                const item = this.builder.items[idx];
                if (!item) return;
                const startL = item.l;
                const rect = stage.getBoundingClientRect();
                const stageW = Math.max(120, rect.width || 600);
                const maxL = (item.type === 'range' || item.type === 'arrow') ? (95 - (item.w || 18)) : 95;
                let moved = false;
                let snapshotSaved = false;

                el.classList.add('is-dragging');

                const onMove = (mv) => {
                    const dx = (mv.clientX || 0) - startX;
                    if (!moved && Math.abs(dx) < 4) return;
                    if (!snapshotSaved) {
                        this.pushUndoSnapshot();
                        snapshotSaved = true;
                    }
                    moved = true;
                    const deltaPct = (dx / stageW) * 100;
                    const nextL = Math.max(5, Math.min(maxL, Math.round(startL + deltaPct)));
                    item.l = nextL;
                    el.style.left = `${nextL}%`;
                    this.updateBuilderInspector();
                };

                const onUp = () => {
                    el.classList.remove('is-dragging');
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    if (moved) {
                        this.saveBuilderDraft();
                    }
                };

                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            });
        },

        selectBuilderItem(idx) {
            if (idx < 0 || idx >= this.builder.items.length) {
                this.builder.selectedIdx = -1;
            } else {
                this.builder.selectedIdx = idx;
            }
            document.querySelectorAll('#timelineLayer .t-item').forEach((n, i) => {
                n.classList.toggle('is-selected', i === this.builder.selectedIdx);
            });
            this.updateBuilderInspector();
        },

        nudgeSelectedItem(delta) {
            const item = this.builder.items[this.builder.selectedIdx];
            if (!item) return;
            this.pushUndoSnapshot();
            const maxL = (item.type === 'range' || item.type === 'arrow') ? (95 - (item.w || 18)) : 95;
            item.l = Math.max(5, Math.min(maxL, Math.round(item.l + delta)));
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
        },

        resizeSelectedItem(delta) {
            const item = this.builder.items[this.builder.selectedIdx];
            if (!item || (item.type !== 'range' && item.type !== 'arrow')) return;
            this.pushUndoSnapshot();
            item.w = Math.max(8, Math.min(82, Math.round((item.w || 20) + delta)));
            if (item.l + item.w > 95) {
                item.l = Math.max(5, 95 - item.w);
            }
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
        },

        deleteSelectedItem() {
            if (this.builder.selectedIdx < 0 || this.builder.selectedIdx >= this.builder.items.length) return;
            this.pushUndoSnapshot();
            this.builder.items.splice(this.builder.selectedIdx, 1);
            this.builder.selectedIdx = Math.min(this.builder.selectedIdx, this.builder.items.length - 1);
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
        },

        undoBuilder() {
            if (!this.builder.undoStack.length) {
                this.showToast('Nothing to undo', 'info');
                return;
            }
            this.builder.items = this.builder.undoStack.pop();
            this.builder.selectedIdx = this.builder.items.length - 1;
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
        },

        resetBuilder() {
            if (this.builder.items.length) {
                this.pushUndoSnapshot();
            }
            this.builder.items = [];
            this.builder.selectedIdx = -1;
            this.saveBuilderDraft();
            this.renderBuilderStage();
            this.updateBuilderInspector();
            this.setBuilderFeedback('Canvas cleared. Pick a tool above to rebuild the timeline!', 'muted');
        },

        showBuilderHint() {
            const { TENSES } = getData();
            const targetViz = TENSES[this.state.currentTenseKey]?.viz || [];
            if (!targetViz.length) return;
            const summary = targetViz.map((it) => {
                const side = it.l < 44 ? 'Past' : (it.l > 56 ? 'Future' : 'Now');
                return `${TOOL_LABELS[it.type] || it.type} (${side})`;
            }).join(' + ');
            this.setBuilderFeedback(`Hint: Include ${summary}.`, 'blue');
        },

        toggleBuilderSolution() {
            this.builder.showSolution = !this.builder.showSolution;
            this.renderBuilderStage();
            this.showToast(this.builder.showSolution ? 'Solution ghost overlay shown' : 'Solution overlay hidden', 'info');
        },

        renderBuilderStage() {
            const { TENSES } = getData();
            const data = TENSES[this.state.currentTenseKey];
            const layer = document.getElementById('timelineLayer');
            const solLayer = document.getElementById('solutionLayer');
            if (!data || !layer) return;

            this.drawTimeline(layer, this.builder.items, data.color, {
                builder: true,
                selectedIdx: this.builder.selectedIdx,
                animate: false
            });

            if (solLayer) {
                if (this.builder.showSolution) {
                    this.drawTimeline(solLayer, data.viz, data.color, {
                        ghostSolution: true,
                        animate: false
                    });
                } else {
                    solLayer.innerHTML = '';
                }
            }
        },

        setBuilderFeedback(text, tone = 'muted') {
            const el = document.getElementById('builderFeedback');
            if (!el) return;
            const toneClassMap = {
                green: 'text-green',
                pink: 'text-pink',
                blue: 'text-blue',
                muted: 'text-slate-600 dark:text-slate-300'
            };
            el.className = `text-xs sm:text-sm font-extrabold min-h-[20px] ${toneClassMap[tone] || toneClassMap.muted}`;
            el.textContent = text;
        },

        checkBuilder() {
            const { TENSES } = getData();
            const data = TENSES[this.state.currentTenseKey];
            if (!data) return;

            if (!this.builder.items.length) {
                this.setBuilderFeedback('Place at least one timeline shape first!', 'pink');
                return;
            }

            const correctViz = data.viz;
            const remaining = this.builder.items.slice();
            let matched = 0;
            const hints = [];

            correctViz.forEach((target) => {
                const idx = remaining.findIndex((u) => u.type === target.type && Math.abs(u.l - target.l) <= 20);
                if (idx !== -1) {
                    matched += 1;
                    remaining.splice(idx, 1);
                } else {
                    const side = target.l < 44 ? 'Past side' : (target.l > 56 ? 'Future side' : 'NOW center');
                    hints.push(`Missing a ${TOOL_LABELS[target.type] || target.type} near the ${side}.`);
                }
            });

            if (matched === correctViz.length && remaining.length === 0) {
                if (!this.state.masteredTenses.includes(this.state.currentTenseKey)) {
                    this.state.masteredTenses.push(this.state.currentTenseKey);
                    this.persistState();
                    this.renderSidebar();
                } else {
                    this.updateMasteryIndicators();
                }
                this.setBuilderFeedback(`Spot on! You rebuilt ${data.title} cleanly and earned Mastery!`, 'green');
                this.showToast(`${data.title} mastered!`, 'success');
            } else if (matched === correctViz.length && remaining.length > 0) {
                this.setBuilderFeedback(`All required shapes match, but remove ${remaining.length} extra item(s) to master.`, 'blue');
            } else {
                this.setBuilderFeedback(hints[0] || 'Check the position of your timeline shapes and try again!', 'pink');
            }
        },

        /* ====================================================================
           LIVE SENTENCE CONJUGATOR LAB & QUICK SPOT-CHECK QUIZ
           ==================================================================== */
        setLabTab(tab) {
            const next = tab === 'quiz' ? 'quiz' : 'lab';
            this.state.activeLabTab = next;
            this.persistState();

            const isQuiz = next === 'quiz';
            document.getElementById('tabLabBtn')?.classList.toggle('is-active-blue', !isQuiz);
            document.getElementById('tabQuizBtn')?.classList.toggle('is-active-orange', isQuiz);
            document.getElementById('labPanel')?.classList.toggle('is-hidden', isQuiz);
            document.getElementById('quizPanel')?.classList.toggle('is-hidden', !isQuiz);
        },

        renderLabPills() {
            const { SUBJECTS, VERBS } = getData();
            const subWrap = document.getElementById('labSubjects');
            const verbWrap = document.getElementById('labVerbs');

            if (subWrap) {
                subWrap.innerHTML = SUBJECTS.map((s) => `
                    <button type="button" data-subj="${escapeHtml(s.id)}" onclick="App.selectLabSubject('${escapeHtml(s.id)}')"
                        class="lab-pill ${this.state.labSubject === s.id ? 'is-active' : ''}">
                        ${escapeHtml(s.cap)}
                    </button>
                `).join('');
            }

            if (verbWrap) {
                verbWrap.innerHTML = VERBS.map((v) => `
                    <button type="button" data-verb="${escapeHtml(v.id)}" onclick="App.selectLabVerb('${escapeHtml(v.id)}')"
                        class="lab-pill ${this.state.labVerb === v.id ? 'is-active' : ''}">
                        ${escapeHtml(v.label)}
                    </button>
                `).join('');
            }
        },

        selectLabSubject(id) {
            this.state.labSubject = id;
            this.persistState();
            this.renderLabPills();
            this.renderSentenceLab();
        },

        selectLabVerb(id) {
            this.state.labVerb = id;
            this.persistState();
            this.renderLabPills();
            this.renderSentenceLab();
        },

        renderSentenceLab() {
            const { TENSES, conjugateTense } = getData();
            const outEl = document.getElementById('labSentenceOutput');
            if (!outEl) return;

            const data = TENSES[this.state.currentTenseKey];
            const accent = ACCENT_MAP[data?.color || 'blue'] || ACCENT_MAP.blue;
            const res = conjugateTense(
                this.state.currentTenseKey,
                this.state.labSubject,
                this.state.labVerb,
                this.state.sentenceForm
            );

            outEl.innerHTML = res.segments.map((seg) => (
                seg.highlight
                    ? `<span class="${accent.text} underline decoration-2 underline-offset-4">${escapeHtml(seg.text)}</span>`
                    : escapeHtml(seg.text)
            )).join('');
        },

        speakText(text) {
            if (!text) return;
            if (typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance === 'function') {
                try {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = 'en-US';
                    u.rate = 0.95;
                    window.speechSynthesis.speak(u);
                    return;
                } catch (e) { }
            }
            this.showToast('Speech playback not supported in this browser', 'info');
        },

        speakHeroExample() {
            const txt = document.getElementById('heroExampleText')?.textContent || '';
            this.speakText(txt);
        },

        speakLabSentence() {
            const { conjugateTense } = getData();
            const res = conjugateTense(
                this.state.currentTenseKey,
                this.state.labSubject,
                this.state.labVerb,
                this.state.sentenceForm
            );
            this.speakText(res.full);
        },

        async copyLabSentence() {
            const { conjugateTense } = getData();
            const res = conjugateTense(
                this.state.currentTenseKey,
                this.state.labSubject,
                this.state.labVerb,
                this.state.sentenceForm
            );
            if (!res.full) return;
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(res.full);
                    this.showToast('Copied example to clipboard!', 'success');
                } else {
                    this.showToast(res.full, 'info');
                }
            } catch (e) {
                this.showToast(res.full, 'info');
            }
        },

        renderQuiz() {
            const { TENSES } = getData();
            const key = this.state.currentTenseKey;
            const data = TENSES[key];
            const container = document.getElementById('quizContainer');
            const badge = document.getElementById('quizBadge');
            const scoreLabel = document.getElementById('quizScoreLabel');
            if (!data || !container) return;

            const questions = data.quiz || [];
            const answers = this.quizAnswers[key] || {};
            let correctCount = 0;
            let answeredCount = 0;

            questions.forEach((q, idx) => {
                if (answers[idx] !== undefined) {
                    answeredCount += 1;
                    if (answers[idx] === q.answer) correctCount += 1;
                }
            });

            if (badge) badge.textContent = `${correctCount}/${questions.length}`;
            if (scoreLabel) {
                scoreLabel.textContent = answeredCount === questions.length
                    ? `Score: ${correctCount} / ${questions.length}`
                    : `Answer all ${questions.length} quick checks`;
            }

            container.innerHTML = '';
            questions.forEach((q, qIdx) => {
                const chosen = answers[qIdx];
                const isAnswered = chosen !== undefined;
                const card = document.createElement('div');
                card.className = 'p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border-2 border-slate-200 dark:border-slate-700 space-y-2.5';
                card.innerHTML = `<p class="text-xs sm:text-sm font-extrabold text-dark dark:text-white leading-snug">${qIdx + 1}. ${escapeHtml(q.prompt)}</p>`;

                const optsWrap = document.createElement('div');
                optsWrap.className = 'space-y-1.5';
                q.options.forEach((optText, optIdx) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    let cls = 'quiz-opt-btn';
                    let iconHtml = '';
                    if (isAnswered) {
                        if (optIdx === q.answer) {
                            cls += ' is-correct';
                            iconHtml = '<i data-lucide="circle-check" class="w-4 h-4 text-green flex-none"></i>';
                        } else if (optIdx === chosen) {
                            cls += ' is-wrong';
                            iconHtml = '<i data-lucide="x" class="w-4 h-4 text-pink flex-none"></i>';
                        }
                    }
                    btn.className = cls;
                    btn.disabled = isAnswered;
                    btn.innerHTML = `<span>${escapeHtml(optText)}</span>${iconHtml}`;
                    btn.onclick = () => this.answerQuiz(qIdx, optIdx);
                    optsWrap.appendChild(btn);
                });
                card.appendChild(optsWrap);

                if (isAnswered && q.explanation) {
                    const exp = document.createElement('p');
                    exp.className = `text-[11px] font-bold leading-snug ${chosen === q.answer ? 'text-green' : 'text-pink'}`;
                    exp.textContent = q.explanation;
                    card.appendChild(exp);
                }

                container.appendChild(card);
            });

            this.safeCreateIcons(container);
        },

        answerQuiz(qIdx, optIdx) {
            const { TENSES } = getData();
            const key = this.state.currentTenseKey;
            const questions = TENSES[key]?.quiz || [];
            if (!this.quizAnswers[key]) this.quizAnswers[key] = {};
            this.quizAnswers[key][qIdx] = optIdx;

            const allRight = questions.length > 0 && questions.every((q, idx) => this.quizAnswers[key][idx] === q.answer);
            if (allRight && !this.state.quizPassedTenses.includes(key)) {
                this.state.quizPassedTenses.push(key);
                this.persistState();
                this.showToast('Perfect quiz score!', 'success');
            }
            this.renderQuiz();
        },

        resetQuiz() {
            const key = this.state.currentTenseKey;
            delete this.quizAnswers[key];
            this.renderQuiz();
        },

        /* ====================================================================
           SIDE-BY-SIDE COMPARE MODAL
           ==================================================================== */
        renderCompareSelectors() {
            const { TENSE_ORDER, TENSES, COMPARE_PAIRS } = getData();
            const selLeft = document.getElementById('compareSelectLeft');
            const selRight = document.getElementById('compareSelectRight');
            const quickWrap = document.getElementById('compareQuickPairs');

            const optMarkup = TENSE_ORDER.map((k) => {
                const t = TENSES[k];
                return `<option value="${escapeHtml(k)}">${escapeHtml(t.cat)}: ${escapeHtml(t.title)}</option>`;
            }).join('');

            if (selLeft) {
                selLeft.innerHTML = optMarkup;
                selLeft.value = this.state.compareLeft;
            }
            if (selRight) {
                selRight.innerHTML = optMarkup;
                selRight.value = this.state.compareRight;
            }

            if (quickWrap) {
                quickWrap.innerHTML = COMPARE_PAIRS.map((p) => `
                    <button type="button" data-pair-id="${escapeHtml(p.id)}" onclick="App.applyComparePair('${escapeHtml(p.id)}')"
                        class="btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white px-2.5 py-1 text-[11px] font-heading font-bold uppercase tracking-wide">
                        ${escapeHtml(p.label)}
                    </button>
                `).join('');
            }
        },

        openCompareModal(leftKey, rightKey) {
            const { TENSES } = getData();
            if (leftKey && TENSES[leftKey]) this.state.compareLeft = leftKey;
            if (rightKey && TENSES[rightKey]) this.state.compareRight = rightKey;

            const selLeft = document.getElementById('compareSelectLeft');
            const selRight = document.getElementById('compareSelectRight');
            if (selLeft) selLeft.value = this.state.compareLeft;
            if (selRight) selRight.value = this.state.compareRight;

            document.getElementById('compareModal')?.classList.add('open');
            this.renderCompareModal();
        },

        closeCompareModal() {
            document.getElementById('compareModal')?.classList.remove('open');
        },

        applyComparePair(pairId) {
            const { COMPARE_PAIRS } = getData();
            const pair = COMPARE_PAIRS.find((p) => p.id === pairId);
            if (!pair) return;

            this.state.compareLeft = pair.left;
            this.state.compareRight = pair.right;
            this.persistState();

            const selLeft = document.getElementById('compareSelectLeft');
            const selRight = document.getElementById('compareSelectRight');
            if (selLeft) selLeft.value = pair.left;
            if (selRight) selRight.value = pair.right;

            this.renderCompareModal();
        },

        onCompareSelectChange() {
            const left = document.getElementById('compareSelectLeft')?.value;
            const right = document.getElementById('compareSelectRight')?.value;
            if (left) this.state.compareLeft = left;
            if (right) this.state.compareRight = right;
            this.persistState();
            this.renderCompareModal();
        },

        renderCompareColumn(panelEl, tenseKey) {
            const { TENSES } = getData();
            const data = TENSES[tenseKey];
            if (!panelEl || !data) return;
            const accent = ACCENT_MAP[data.color] || ACCENT_MAP.blue;

            panelEl.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${accent.bgSoft} ${accent.text} ${accent.borderSoft}">${escapeHtml(data.cat)}</span>
                    <span class="font-mono text-xs font-extrabold ${accent.text}">${escapeHtml(data.formulas.pos)}</span>
                </div>
                <h4 class="font-heading font-bold text-lg uppercase text-dark dark:text-white leading-tight">${escapeHtml(data.title)}</h4>
                <div class="timeline-stage is-mini">
                    <div class="timeline-track-line"></div>
                    <div class="timeline-now-line"></div>
                    <div class="timeline-now-pill">NOW</div>
                    <div class="compare-mini-layer absolute inset-0 pointer-events-none"></div>
                </div>
                <div class="text-xs space-y-1.5">
                    <p class="font-bold text-slate-600 dark:text-slate-300"><strong class="text-dark dark:text-white">Example:</strong> ${escapeHtml(data.examples.pos)}</p>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                        ${data.signals.slice(0, 4).map((s) => `<span class="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[10px] font-extrabold text-dark dark:text-slate-200">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>
            `;

            const miniLayer = panelEl.querySelector('.compare-mini-layer');
            this.drawTimeline(miniLayer, data.viz, data.color, { mini: true, animate: true });
        },

        renderCompareModal() {
            const { COMPARE_PAIRS, TENSES } = getData();
            this.renderCompareColumn(document.getElementById('compareLeftPanel'), this.state.compareLeft);
            this.renderCompareColumn(document.getElementById('compareRightPanel'), this.state.compareRight);

            const matchPair = COMPARE_PAIRS.find((p) => (
                (p.left === this.state.compareLeft && p.right === this.state.compareRight) ||
                (p.right === this.state.compareLeft && p.left === this.state.compareRight)
            ));

            document.querySelectorAll('#compareQuickPairs button').forEach((btn) => {
                btn.classList.toggle('border-blue', Boolean(matchPair && btn.dataset.pairId === matchPair.id));
            });

            const takeawayEl = document.getElementById('compareTakeaway');
            if (takeawayEl) {
                if (matchPair) {
                    takeawayEl.textContent = `Key Contrast: ${matchPair.takeaway}`;
                } else {
                    const leftT = TENSES[this.state.compareLeft];
                    const rightT = TENSES[this.state.compareRight];
                    if (leftT && rightT) {
                        takeawayEl.textContent = `Key Contrast: ${leftT.title} (${leftT.formulas.pos}) focuses on ${leftT.usage[0]?.title.toLowerCase() || leftT.cat}, whereas ${rightT.title} (${rightT.formulas.pos}) highlights ${rightT.usage[0]?.title.toLowerCase() || rightT.cat}.`;
                    }
                }
            }
        },

        /* ====================================================================
           RESET CONFIRM MODAL & TOASTS
           ==================================================================== */
        cancelConfirm() {
            if (typeof this._cancelConfirm === 'function') {
                this._cancelConfirm();
            }
        },

        showConfirmModal(title, desc, confirmLabel = 'Reset All') {
            if (typeof this._cancelConfirm === 'function') {
                this._cancelConfirm();
            }
            return new Promise((resolve) => {
                const modal = document.getElementById('confirmModal');
                const titleEl = document.getElementById('confirmTitle');
                const descEl = document.getElementById('confirmDesc');
                const okBtn = document.getElementById('confirmOkBtn');
                const cancelBtn = document.getElementById('confirmCancelBtn');

                if (titleEl) titleEl.textContent = title;
                if (descEl) descEl.textContent = desc;
                if (okBtn) okBtn.textContent = confirmLabel;

                const finish = (val) => {
                    modal?.classList.remove('open');
                    if (okBtn) okBtn.onclick = null;
                    if (cancelBtn) cancelBtn.onclick = null;
                    this._cancelConfirm = null;
                    resolve(val);
                };

                this._cancelConfirm = () => finish(false);
                if (okBtn) okBtn.onclick = () => finish(true);
                if (cancelBtn) cancelBtn.onclick = () => finish(false);
                modal?.classList.add('open');
            });
        },

        async resetAllProgress() {
            const ok = await this.showConfirmModal(
                'Reset All Progress?',
                'This clears your mastery badges, quiz scores, builder drafts, and custom class examples.',
                'Reset All'
            );
            if (!ok) return;

            this.state.masteredTenses = [];
            this.state.quizPassedTenses = [];
            this.state.customExamples = {};
            this.state.builderDrafts = {};
            this.quizAnswers = {};
            this.persistState();

            if (this.state.stageMode === 'builder') {
                this.restoreBuilderForCurrentTense();
            }
            this.loadTense(this.state.currentTenseKey, { skipDraftSave: true });
            this.showToast('All local progress reset cleanly', 'info');
        },

        showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const iconMap = {
                success: 'circle-check',
                warning: 'triangle-alert',
                error: 'circle-alert',
                info: 'info'
            };
            const iconColor = type === 'success' ? 'text-green' : (type === 'error' ? 'text-pink' : (type === 'warning' ? 'text-orange' : 'text-blue'));
            const iconName = iconMap[type] || 'info';

            const toast = document.createElement('div');
            toast.className = 'toast-item';
            toast.innerHTML = `<i data-lucide="${escapeHtml(iconName)}" class="w-4 h-4 ${iconColor} flex-none"></i><span>${escapeHtml(message)}</span>`;
            container.appendChild(toast);
            this.safeCreateIcons(toast);

            const show = () => toast.classList.add('is-visible');
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(show);
            else show();

            setTimeout(() => {
                toast.classList.remove('is-visible');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 220);
            }, 2500);
        },

        safeCreateIcons(rootEl) {
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
                try {
                    if (rootEl && rootEl !== document) {
                        lucide.createIcons({ root: rootEl });
                    } else {
                        lucide.createIcons();
                    }
                } catch (e) {
                    lucide.createIcons();
                }
            }
        }
    };

    window.App = App;
    window.__tenseDiverDebug = {
        App,
        STORAGE_KEY,
        escapeHtml
    };

    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
})();

// --- 3. APP CONTROLLER ---
const App = {
    uiMode: 'simple',
    confirmCallback: null,
    currentImageModId: null,
    currentImageKey: 'imageId',
    editingId: null,
    isDragging: false,
    autoFitActive: true,
    bulkImportModal: null,
    history: [],
    redoStack: [],

    async init() {
        if (typeof requireAuth === 'function') {
            try {
                const user = await requireAuth();
                if (!user) return;
            } catch (_) {}
        }

        const storedUi = localStorage.getItem(LS_UI_MODE);
        App.setUiMode(storedUi === 'pro' ? 'pro' : 'simple', true);

        await Store.init();
        App.updateThemeButtonState();
        App.updateUI();
        App.updateHistoryButtons();
        Renderer.renderPoster();
        App.fitToScreen();
        hydrateIcons();

        window.addEventListener('beforeunload', () => {
            if (Store.debounce) {
                clearTimeout(Store.debounce);
                Store.debounce = null;
                Store.save(false);
            }
        });

        const vp = document.getElementById('poster-viewport');
        if (vp && typeof ResizeObserver !== 'undefined') {
            let resizeTimer = null;
            const ro = new ResizeObserver(() => {
                if (!App.autoFitActive) return;
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => App.fitToScreen(), 60);
            });
            ro.observe(vp);
        }

        ['title', 'subtitle', 'badge'].forEach((k) => {
            const el = document.getElementById(`global_${k}`);
            if (!el) return;
            el.addEventListener('input', (e) => {
                Store.updateGlobal(k, e.target.value);
                Store.triggerSave();
            });
        });

        ['layout', 'pattern', 'gridSize'].forEach((k) => {
            const el = document.getElementById(`global_${k}`);
            if (!el) return;
            el.addEventListener('change', (e) => {
                App.pushHistory();
                Store.updateGlobal(k, e.target.value);
                if (k === 'layout') {
                    App.autoFitActive = true;
                    App.fitToScreen();
                }
                Store.triggerSave();
            });
        });

        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

            if (mod && e.key.toLowerCase() === 's') {
                e.preventDefault();
                Store.save(true);
            } else if (mod && !isTyping && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) App.redo();
                else App.undo();
            } else if (mod && !isTyping && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                App.redo();
            } else if (e.key === 'Escape') {
                const confirmM = document.getElementById('confirm-modal');
                const imageM = document.getElementById('image-modal');
                const blocksM = document.getElementById('blocks-modal');
                const templatesM = document.getElementById('templates-modal');
                const libraryM = document.getElementById('library-modal');
                const editorM = document.getElementById('editor-modal');
                const helpM = document.getElementById('help-modal');
                const menuM = document.getElementById('settings-menu');

                if (confirmM?.classList.contains('open')) { App.closeConfirm(); return; }
                if (imageM?.classList.contains('open')) { App.closeImageLibrary(); return; }
                if (blocksM?.classList.contains('open')) { App.closeBlocksModal(); return; }
                if (templatesM?.classList.contains('open')) { App.closeTemplatesModal(); return; }
                if (libraryM?.classList.contains('open')) { App.closeLibrary(); return; }
                if (editorM?.classList.contains('open')) { App.closeEditor(); return; }
                if (helpM?.classList.contains('open')) { App.toggleHelp(); return; }
                if (menuM?.classList.contains('open')) { App.closeSettingsMenu(); return; }
                if (document.body.classList.contains('zen-mode')) { App.toggleFullScreen(); }
            }
        });
    },

    setUiMode(mode, skipSave = false) {
        const next = mode === 'pro' ? 'pro' : 'simple';
        App.uiMode = next;
        const isPro = next === 'pro';
        document.body.classList.toggle('pro-mode', isPro);

        const bSimple = document.getElementById('btn-uimode-simple');
        const bPro = document.getElementById('btn-uimode-pro');
        if (bSimple) bSimple.classList.toggle('active', !isPro);
        if (bPro) bPro.classList.toggle('active', isPro);

        if (!skipSave) {
            try {
                localStorage.setItem(LS_UI_MODE, next);
            } catch (_) {}
        }

        App.renderToolbox();
        if (App.editingId) Editor.render(App.editingId);
        if (App.autoFitActive && Store.current) {
            setTimeout(() => App.fitToScreen(), 20);
        }
    },

    pushHistory() {
        if (!Store.current) return false;
        clearTimeout(Store._textEditTimer);
        Store._textEditSnapTaken = false;
        const snap = JSON.stringify({
            global: Store.current.global,
            modules: Store.current.modules
        });
        if (App.history.length && App.history[App.history.length - 1] === snap) return false;
        App.history.push(snap);
        if (App.history.length > 30) App.history.shift();
        App.redoStack = [];
        App.updateHistoryButtons();
        return true;
    },

    undo() {
        if (!Store.current || !App.history.length) return;
        const currSnap = JSON.stringify({
            global: Store.current.global,
            modules: Store.current.modules
        });
        App.redoStack.push(currSnap);
        const prev = JSON.parse(App.history.pop());
        Store.current.global = prev.global;
        Store.current.modules = prev.modules;
        const activeMod = App.editingId ? Store.current.modules.find(m => m.id === App.editingId) : null;
        if (App.editingId && !activeMod) {
            App.closeEditor();
        } else if (activeMod) {
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `Edit ${activeMod.title || 'Block'}`;
            Editor.render(App.editingId);
        }
        App.updateUI();
        Renderer.renderPoster();
        App.updateHistoryButtons();
        Store.save(false);
        showToast('Undid last change', 'info');
    },

    redo() {
        if (!Store.current || !App.redoStack.length) return;
        const currSnap = JSON.stringify({
            global: Store.current.global,
            modules: Store.current.modules
        });
        App.history.push(currSnap);
        const next = JSON.parse(App.redoStack.pop());
        Store.current.global = next.global;
        Store.current.modules = next.modules;
        const activeMod = App.editingId ? Store.current.modules.find(m => m.id === App.editingId) : null;
        if (App.editingId && !activeMod) {
            App.closeEditor();
        } else if (activeMod) {
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `Edit ${activeMod.title || 'Block'}`;
            Editor.render(App.editingId);
        }
        App.updateUI();
        Renderer.renderPoster();
        App.updateHistoryButtons();
        Store.save(false);
        showToast('Redid change', 'info');
    },

    updateHistoryButtons() {
        const u = document.getElementById('btn-undo');
        const r = document.getElementById('btn-redo');
        if (u) u.disabled = App.history.length === 0;
        if (r) r.disabled = App.redoStack.length === 0;
    },

    clearHistory() {
        clearTimeout(Store._textEditTimer);
        Store._textEditSnapTaken = false;
        App.history = [];
        App.redoStack = [];
        App.updateHistoryButtons();
    },

    updateThemeButtonState() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')));
        }
    },

    renderToolbox() {
        const box = document.getElementById('module-toolbox');
        if (!box) return;
        const isPro = App.uiMode === 'pro';
        const allEntries = Object.entries(ModuleRegistry);
        const visible = isPro ? allEntries : allEntries.filter(([, v]) => v.tier === 'core');
        const moreCount = Math.max(0, allEntries.length - visible.length);

        const buttons = visible.map(([k, v]) => {
            const cls = CONFIG.getColorClasses(v.color);
            return `
            <button type="button" onclick="App.addModule('${k}')"
                class="btn-chunky flex-col px-2.5 py-1.5 min-w-[66px] bg-white dark:bg-slate-800 rounded-xl flex-shrink-0 group">
                <i data-lucide="${v.icon}" class="w-4 h-4 ${cls.text} mb-0.5 group-hover:scale-110 transition-transform"></i>
                <span class="font-heading font-bold text-[10px] text-dark dark:text-white uppercase leading-none">${v.label}</span>
            </button>`;
        }).join('');

        const moreBtn = `
            <button type="button" onclick="App.openBlocksModal()"
                class="btn-chunky flex-col px-3 py-1.5 min-w-[70px] bg-pink text-white rounded-xl flex-shrink-0 group"
                title="Browse all ${allEntries.length} classroom poster blocks">
                <i data-lucide="layout-grid" class="w-4 h-4 mb-0.5 group-hover:scale-110 transition-transform"></i>
                <span class="font-heading font-bold text-[10px] uppercase leading-none">${isPro ? 'All Blocks' : `More (+${moreCount})`}</span>
            </button>`;

        box.innerHTML = buttons + moreBtn;
        hydrateIcons();
    },

    openBlocksModal() {
        const grid = document.getElementById('blocks-picker-grid');
        if (grid) {
            grid.innerHTML = Object.entries(ModuleRegistry).map(([key, cfg]) => {
                const cls = CONFIG.getColorClasses(cfg.color);
                return `
                <button type="button" onclick="App.addModule('${escapeJsAttr(key)}'); App.closeBlocksModal()"
                    class="btn-chunky p-3.5 bg-white dark:bg-slate-800 rounded-2xl text-left flex items-start gap-3 justify-start normal-case">
                    <div class="w-10 h-10 rounded-xl ${cls.bg} text-white border-2 border-[#1e293b] flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_#1e293b]">
                        <i data-lucide="${cfg.icon}" class="w-5 h-5"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <span class="font-heading font-bold text-sm uppercase text-dark dark:text-white leading-tight">${escapeHTML(cfg.label)}</span>
                            <span class="text-[9px] font-heading font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">${cfg.tier === 'core' ? 'Core' : 'Special'}</span>
                        </div>
                        <p class="font-body text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">${escapeHTML(cfg.desc || '')}</p>
                    </div>
                </button>`;
            }).join('');
            hydrateIcons();
        }
        const modal = document.getElementById('blocks-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    },

    closeBlocksModal() {
        const modal = document.getElementById('blocks-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    },

    initBulkImport() {
        if (App.bulkImportModal) return App.bulkImportModal;
        if (typeof window.KlassKitBulkImport === 'undefined' || typeof window.KlassKitBulkImport.create !== 'function') {
            return null;
        }

        const templateText = [
            'TITLE: LESSON ANCHOR CHART',
            'SUBTITLE: Key Vocabulary, Rules & Quick Check',
            'BADGE: UNIT 1',
            'LAYOUT: landscape',
            'PATTERN: graph',
            '',
            '[FORMULA] Core Pattern (color: blue)',
            'Subject + Base Verb (+ s/es)',
            'She reads every morning.',
            '',
            '[VOCAB] Key Vocabulary (color: green)',
            'Observe | Look carefully at details',
            'Compare | Find how two things are alike',
            'Predict | Make a smart guess',
            '',
            '[STEPS] How To Solve',
            '1. Read the question | Highlight key clues',
            '2. Plan your answer | Pick a strategy',
            '3. Double check | Review every detail',
            '',
            '[CHECKLIST] Success Goals',
            '- [x] Write in complete sentences',
            '- [ ] Include at least two vocabulary words',
            '- [ ] Check spelling & punctuation',
            '',
            '[DODONT] Common Mistakes',
            "Don't: He walk to school.",
            'Do: He walks to school.',
            '',
            '[DIALOGUE] Partner Talk',
            'Student A: How did you solve step two?',
            'Student B: I compared the two examples first!',
            '',
            '[COMPARE] Past vs Present',
            'Past Tense | Present Tense',
            'walked | walk / walks',
            'discovered | discover',
            '',
            '[TABLE] Quick Reference',
            'Subject | Helper | Example',
            'I / You / We | do | We practice daily.',
            'He / She / It | does | She practices daily.',
            '',
            '[TIMELINE] Lesson Timeline',
            '09:00 | Warm-Up Hook',
            '09:15 | Guided Practice',
            '09:35 | Share & Reflect',
            '',
            '[QUIZ] Exit Ticket',
            'Which sentence is correct?',
            '- She walking to class.',
            '- She walks to class. *',
            '- She walk to class.',
            '',
            '[QUOTE] Class Motto',
            'Mistakes are proof that you are trying.',
            '— Classroom Reminder',
            '',
            '[NOTE] Remember',
            'Keep your poster neat and easy to read from the back row!'
        ].join('\n');

        const sampleText = [
            'TITLE: THE WATER CYCLE',
            'SUBTITLE: How Water Moves Around Earth',
            'BADGE: SCIENCE',
            'LAYOUT: landscape',
            'PATTERN: dots',
            '',
            '[VOCAB] Key Science Words (color: green)',
            'Evaporation | Liquid water warms into vapor',
            'Condensation | Vapor cools to form clouds',
            'Precipitation | Water falls as rain or snow',
            '',
            '[STEPS] Cycle Stages (color: indigo)',
            '1. Sun Heats Water | Warmth rises from oceans and lakes',
            '2. Clouds Form | Cooled vapor turns back into droplets',
            '3. Rain Returns | Droplets grow heavy and fall down',
            '',
            '[COMPARE] Clouds vs Rain',
            'Condensation | Precipitation',
            'Forms in cool upper air | Falls toward Earth',
            'Tiny floating droplets | Rain, sleet, or snow',
            '',
            '[QUIZ] Quick Check (color: orange)',
            'What energy source drives evaporation on Earth?',
            '- Ocean waves',
            '- The Sun *',
            '- Moon gravity',
            '',
            '[CHECKLIST] Lab Wrap-Up (color: green)',
            '- [x] Label all 3 cycle words',
            '- [ ] Sketch arrows showing water flow',
            '',
            '[QUOTE] Big Idea (color: pink)',
            'Every raindrop has traveled the sky a thousand times.',
            '— Earth Science Chart'
        ].join('\n');

        App.bulkImportModal = window.KlassKitBulkImport.create({
            id: 'poster-bulk-import',
            title: 'Poster Bulk Import',
            subtitle: 'Turn a lesson outline into a multi-block poster',
            accentColor: 'pink',
            unitLabel: 'block',
            unitLabelPlural: 'blocks',
            confirmText: 'Import Poster',
            guideItems: [
                { label: 'Poster Header', syntax: 'TITLE: ... / SUBTITLE: ...', color: 'blue', desc: 'Optional metadata lines before blocks (`BADGE:`, `LAYOUT:`, `PATTERN:`).' },
                { label: 'Typed Block', syntax: '[VOCAB] Key Words', color: 'pink', desc: 'Supported: `VOCAB`, `FORMULA`, `STEPS`, `CHECKLIST`, `TABLE`, `COMPARE`, `DIALOGUE`, `DODONT`, `TIMELINE`, `QUIZ`, `QUOTE`, `NOTE`, `TEXT`, `COMIC`, `IMAGE`.' },
                { label: 'Card Styling', syntax: '(color: green, width: full)', color: 'orange', desc: 'Optional styling hints after any block title.' }
            ],
            tips: [
                'Click <b>Copy Template</b> to give to an AI or fill in with your lesson notes.',
                'Uncheck <b>Create as a new poster</b> below if you want to append blocks to your current board.'
            ],
            placeholder: 'Paste your lesson poster outline here, or click Insert Sample Into Box on the left...',
            template: templateText,
            sample: sampleText,
            options: [
                { id: 'createNewPoster', label: 'Create as a new poster', defaultChecked: true },
                { id: 'autoFitWidth', label: 'Auto-balance card widths', defaultChecked: true }
            ],
            parse: parseBulkPosterText,
            onCopyTemplate: () => {
                showToast('Poster outline template copied!', 'info');
            },
            onImport: (result, opts) => {
                const rawItems = Array.isArray(result.items) ? result.items : [];
                if (!rawItems.length) return false;

                const sizeCols = { xs: 2, sm: 4, md: 6, lg: 8, xl: 10, full: 12 };
                const importedMods = rawItems.map((m, idx, arr) => {
                    const copy = JSON.parse(JSON.stringify(m));
                    const hadExplicitWidth = Boolean(copy._explicitWidth);
                    const hadExplicitHeight = Boolean(copy._explicitHeight);
                    copy.id = makeId();
                    delete copy._explicitWidth;
                    delete copy._explicitHeight;

                    if (opts.autoFitWidth) {
                        if (!hadExplicitWidth) {
                            if (arr.length === 1) {
                                copy.size = 'full';
                            } else if (copy.type === 'comic' || copy.type === 'timeline') {
                                copy.size = 'full';
                            } else if ((copy.type === 'compare' || copy.type === 'table') && arr.length <= 3) {
                                copy.size = 'full';
                            }
                        }
                        if (!hadExplicitHeight) {
                            if (arr.length === 1) {
                                copy.height = 'full';
                            } else if (arr.length <= 4) {
                                copy.height = 'tall';
                            } else if (copy.type === 'comic') {
                                copy.height = 'tall';
                            }
                        }
                    }
                    return { copy, hadExplicitWidth };
                });

                if (opts.autoFitWidth && importedMods.length > 1) {
                    let rowCols = 0;
                    for (const item of importedMods) {
                        const w = sizeCols[item.copy.size] || 6;
                        if (rowCols + w > 12) rowCols = w;
                        else rowCols = (rowCols + w) % 12;
                    }
                    if (rowCols > 0 && rowCols <= 6) {
                        const lastItem = importedMods[importedMods.length - 1];
                        if (!lastItem.hadExplicitWidth) {
                            lastItem.copy.size = 'full';
                        }
                    }
                }

                const finalMods = importedMods.map(x => x.copy);
                const meta = result.meta || {};

                if (opts.createNewPoster || !Store.current) {
                    const newPoster = {
                        id: makeId(),
                        lastModified: Date.now(),
                        zoom: 0.5,
                        global: {
                            title: meta.title || 'IMPORTED POSTER',
                            subtitle: meta.subtitle || '',
                            badge: meta.badge || '1',
                            layout: meta.layout || 'landscape',
                            pattern: meta.pattern || 'graph',
                            gridSize: meta.gridSize || 'md'
                        },
                        modules: finalMods
                    };
                    Store.state.posters.push(newPoster);
                    App.switchPoster(newPoster.id);
                    Store.save(false);
                    showToast(`Imported poster with ${finalMods.length} blocks!`, 'success');
                } else {
                    App.pushHistory();
                    const wasEmpty = Store.current.modules.length === 0;
                    Store.current.modules.push(...finalMods);
                    if (wasEmpty) {
                        const curTitle = String(Store.current.global?.title || '').trim();
                        if (meta.title && (!curTitle || curTitle === 'NEW POSTER' || curTitle === 'UNTITLED')) {
                            Store.current.global.title = meta.title;
                        }
                        if (meta.subtitle && (!Store.current.global.subtitle || Store.current.global.subtitle === 'Custom Classroom Chart')) {
                            Store.current.global.subtitle = meta.subtitle;
                        }
                        if (meta.badge) Store.current.global.badge = meta.badge;
                        if (meta.layout) Store.current.global.layout = meta.layout;
                        if (meta.pattern) Store.current.global.pattern = meta.pattern;
                        if (meta.gridSize) Store.current.global.gridSize = meta.gridSize;
                    }
                    App.updateUI();
                    Renderer.renderPoster();
                    App.fitToScreen();
                    Store.save(false);
                    showToast(`Added ${finalMods.length} blocks to poster!`, 'success');
                }
                return true;
            }
        });
        return App.bulkImportModal;
    },

    openBulkImport() {
        const modal = App.initBulkImport();
        if (!modal) {
            showToast('Bulk Import is unavailable in this session.', 'error');
            return;
        }
        modal.open('');
    },

    updateUI() {
        if (!Store.current) return;
        const g = Store.current.global || {};
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        setVal('global_title', g.title || '');
        setVal('global_subtitle', g.subtitle || '');
        setVal('global_badge', g.badge || '');
        setVal('global_layout', g.layout || 'landscape');
        setVal('global_pattern', g.pattern || 'graph');
        setVal('global_gridSize', g.gridSize || 'md');

        const sel = document.getElementById('project-select');
        if (sel) {
            sel.innerHTML = Store.state.posters.map(p =>
                `<option value="${escapeHTML(p.id)}" ${p.id === Store.current.id ? 'selected' : ''}>${escapeHTML((p.global && p.global.title) || 'UNTITLED')}</option>`
            ).join('');
        }
    },

    buildPosterFromTemplate(templateKey) {
        const tpl = POSTER_TEMPLATES[templateKey] || POSTER_TEMPLATES.blank;
        return {
            id: makeId(),
            lastModified: Date.now(),
            zoom: 0.5,
            global: JSON.parse(JSON.stringify(tpl.global)),
            modules: tpl.modules.map(m => ({
                id: makeId(),
                type: m.type,
                title: m.title,
                color: CONFIG.safeColor(m.color),
                size: m.size || 'md',
                height: m.height || 'auto',
                fontSize: m.fontSize || 'md',
                showTape: true,
                data: JSON.parse(JSON.stringify(m.data))
            }))
        };
    },

    openTemplatesModal() {
        const grid = document.getElementById('templates-grid');
        if (grid) {
            grid.innerHTML = Object.entries(POSTER_TEMPLATES).map(([key, tpl]) => {
                const cls = CONFIG.getColorClasses(tpl.color);
                return `
                <button type="button" onclick="App.applyTemplate('${escapeJsAttr(key)}')"
                    class="btn-chunky p-4 bg-white dark:bg-slate-800 rounded-2xl text-left flex items-start gap-3.5 justify-start normal-case">
                    <div class="w-12 h-12 rounded-xl ${cls.bg} text-white border-2 border-[#1e293b] flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_#1e293b]">
                        <i data-lucide="${tpl.icon}" class="w-6 h-6"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-heading font-bold text-sm uppercase text-dark dark:text-white leading-tight">${escapeHTML(tpl.name)}</div>
                        <p class="font-body text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">${escapeHTML(tpl.desc)}</p>
                    </div>
                </button>`;
            }).join('');
            hydrateIcons();
        }
        const modal = document.getElementById('templates-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    },

    closeTemplatesModal() {
        const modal = document.getElementById('templates-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    },

    applyTemplate(key) {
        const newP = App.buildPosterFromTemplate(key);
        Store.state.posters.push(newP);
        App.switchPoster(newP.id);
        Store.save(false);
        App.closeTemplatesModal();
        const tpl = POSTER_TEMPLATES[key] || POSTER_TEMPLATES.blank;
        showToast(`Created "${tpl.name}"!`, 'success');
    },

    addModule(type) {
        const cfg = ModuleRegistry[type];
        if (!cfg || !Store.current) return;
        App.pushHistory();
        const mod = {
            id: makeId(),
            type,
            title: cfg.label,
            color: cfg.color,
            size: 'md',
            height: 'auto',
            fontSize: 'md',
            showTape: true,
            data: JSON.parse(JSON.stringify(cfg.default))
        };
        Store.current.modules.push(mod);
        Store.save();
        Renderer.renderPoster({ animateId: mod.id });
        App.openEditor(mod.id);
    },

    openEditor(id) {
        if (App.isDragging || !Store.current) return;
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;

        App.editingId = id;
        const titleEl = document.getElementById('editor-title');
        if (titleEl) titleEl.textContent = `Edit ${m.title}`;
        const modal = document.getElementById('editor-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        const con = document.getElementById('editor-content');
        if (con) con.scrollTop = 0;
        Editor.render(id);
    },

    closeEditor() {
        App.editingId = null;
        const modal = document.getElementById('editor-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    },

    deleteCurrent() {
        if (!App.editingId) return;
        const targetId = App.editingId;
        App.showConfirm('Delete this poster block?', () => {
            App.pushHistory();
            Store.current.modules = Store.current.modules.filter(m => m.id !== targetId);
            Store.save();
            Renderer.renderPoster();
            App.closeEditor();
        });
    },

    quickDeleteMod(id) {
        if (!Store.current) return;
        App.showConfirm('Delete this poster block?', () => {
            App.pushHistory();
            Store.current.modules = Store.current.modules.filter(m => m.id !== id);
            if (App.editingId === id) App.closeEditor();
            Store.save();
            Renderer.renderPoster();
        });
    },

    duplicateCurrent() {
        if (!App.editingId) return;
        App.quickDuplicateMod(App.editingId, true);
    },

    quickDuplicateMod(id, shouldCloseEditor = false) {
        if (!Store.current) return;
        const idx = Store.current.modules.findIndex(m => m.id === id);
        if (idx === -1) return;
        App.pushHistory();
        const copy = JSON.parse(JSON.stringify(Store.current.modules[idx]));
        copy.id = makeId();
        Store.current.modules.splice(idx + 1, 0, copy);
        Store.save();
        Renderer.renderPoster({ animateId: copy.id });
        if (shouldCloseEditor) App.closeEditor();
        showToast('Block duplicated!', 'info');
    },

    quickMoveMod(id, dir) {
        Store.moveMod(id, dir);
    },

    moveModule(dir) {
        if (!App.editingId) return;
        Store.moveMod(App.editingId, dir);
    },

    showConfirm(msg, callback) {
        const msgEl = document.getElementById('confirm-msg');
        if (msgEl) msgEl.textContent = msg;
        App.confirmCallback = callback;
        const modal = document.getElementById('confirm-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    },

    closeConfirm() {
        const modal = document.getElementById('confirm-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
        App.confirmCallback = null;
    },

    async handleConfirmYes() {
        const cb = App.confirmCallback;
        App.closeConfirm();
        if (cb) await cb();
    },

    toggleHelp() {
        const el = document.getElementById('help-modal');
        if (!el) return;
        const opening = !el.classList.contains('open');
        el.classList.toggle('open', opening);
        el.setAttribute('aria-hidden', String(!opening));
    },

    toggleSettingsMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('settings-menu');
        if (!menu) return;
        if (!menu.classList.contains('open')) {
            menu.classList.add('open');
            setTimeout(() => {
                document.addEventListener('click', App.closeSettingsMenuOnClickOutside, { once: true });
            }, 0);
        } else {
            App.closeSettingsMenu();
        }
    },

    closeSettingsMenu() {
        const menu = document.getElementById('settings-menu');
        if (menu) menu.classList.remove('open');
    },

    closeSettingsMenuOnClickOutside(e) {
        const menu = document.getElementById('settings-menu');
        const btn = document.getElementById('settings-menu-btn');
        if (menu && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.classList.remove('open');
        }
    },

    openImageSelector(modId, key = 'imageId') {
        App.currentImageModId = modId;
        App.currentImageKey = key;
        const modal = document.getElementById('image-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        App.refreshImageLibrary();
    },

    closeImageLibrary() {
        const modal = document.getElementById('image-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
        App.currentImageModId = null;
        App.currentImageKey = 'imageId';
    },

    handleImageUpload(input) {
        Store.uploadImage(input);
        input.value = '';
    },

    async refreshImageLibrary() {
        const grid = document.getElementById('image-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="col-span-full text-center p-4 text-slate-400 font-heading font-bold uppercase text-xs">Loading images...</div>';
        const images = await Store.getAllImages();
        if (images.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center p-8 text-slate-400 font-heading font-bold uppercase text-xs border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl">No images uploaded yet</div>';
            return;
        }
        grid.innerHTML = images.map(img => `
            <div class="relative group aspect-square bg-slate-200 dark:bg-slate-800 rounded-2xl border-2 border-[#1e293b] dark:border-slate-500 overflow-hidden cursor-pointer shadow-[2px_2px_0px_0px_#1e293b] hover:-translate-y-0.5 transition-all" onclick="App.selectImage('${escapeJsAttr(img.id)}')">
                <img data-original-src="${escapeHTML(img.id)}" src="${escapeHTML(img.url || IMAGE_PLACEHOLDER_SVG)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${IMAGE_FALLBACK_SVG}'">
                <button type="button" aria-label="Delete image asset" onclick="event.stopPropagation(); App.deleteImageAsset('${escapeJsAttr(img.id)}')" class="absolute top-1.5 right-1.5 p-1.5 bg-pink text-white rounded-lg border border-[#1e293b] opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>`).join('');
        hydrateIcons();

        const imgs = grid.querySelectorAll('img[data-original-src]');
        for (const img of imgs) {
            const original = img.dataset.originalSrc;
            Store.getImage(original).then((src) => {
                if (src) img.src = src;
            }).catch(() => {});
        }
    },

    selectImage(imgId) {
        if (App.currentImageModId) {
            App.pushHistory();
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        }
    },

    async deleteImageAsset(id) {
        let confirmed = true;
        if (typeof showConfirmModal === 'function') {
            confirmed = await showConfirmModal('Delete this image from your library?', {
                title: 'Delete Image?',
                confirmText: 'Delete',
                cancelText: 'Keep',
                icon: 'trash-2',
                iconColor: 'red'
            });
        }
        if (confirmed) {
            await Store.deleteImage(id);
            App.refreshImageLibrary();
        }
    },

    switchPoster(id) {
        App.closeEditor();
        Editor.inputModes = {};
        Store.state.currentId = id;
        Store.loadCurrent();
        App.clearHistory();
        App.autoFitActive = true;
        App.updateUI();
        Renderer.renderPoster();
        App.fitToScreen();
    },

    createNewPoster() {
        const newP = App.buildPosterFromTemplate('blank');
        Store.state.posters.push(newP);
        App.switchPoster(newP.id);
        Store.save();
        App.closeLibrary();
        showToast('Created blank poster!', 'success');
    },

    cyclePoster(dir) {
        if (!Store.state.posters.length || !Store.current) return;
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        let next = idx + dir;
        if (next >= Store.state.posters.length) next = 0;
        if (next < 0) next = Store.state.posters.length - 1;
        App.switchPoster(Store.state.posters[next].id);
    },

    toggleFullScreen() {
        document.body.classList.toggle('zen-mode');
        App.autoFitActive = true;
        setTimeout(App.fitToScreen, 250);
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        try {
            localStorage.setItem('theme_poster-studio', isDark ? 'dark' : 'light');
            localStorage.setItem('klasskit-theme', isDark ? 'dark' : 'light');
        } catch (_) {}
        App.updateThemeButtonState();
        hydrateIcons();
    },

    changeZoom(d) {
        if (!Store.current) return;
        App.autoFitActive = false;
        Store.current.zoom = Math.max(0.1, Math.min(2, (Store.current.zoom || 0.5) + d));
        Renderer.applyZoom();
    },

    fitToScreen() {
        const vp = document.getElementById('poster-viewport');
        if (!vp || !Store.current) return;
        App.autoFitActive = true;
        const g = Store.current.global || {};
        Store.current.zoom = computeFitScale(vp.clientWidth || 1280, vp.clientHeight || 600, g.layout || 'landscape');
        Renderer.applyZoom();
    },

    closeLibrary() {
        const modal = document.getElementById('library-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    },

    openLibrary() {
        const list = document.getElementById('library-list');
        if (list) {
            const sorted = [...Store.state.posters].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
            list.innerHTML = sorted.map((p) => {
                const isActive = Store.current && p.id === Store.current.id;
                const jsId = escapeJsAttr(p.id);
                return `
                <div class="p-3.5 border-[2.5px] ${isActive ? 'border-blue bg-blue/10' : 'border-[#1e293b]/20 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue'} rounded-2xl flex justify-between items-center cursor-pointer transition-colors" onclick="App.switchPoster('${jsId}'); App.closeLibrary()">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-orange text-white border-2 border-[#1e293b] font-heading font-bold flex items-center justify-center shadow-[2px_2px_0px_0px_#1e293b] flex-shrink-0 truncate px-1 text-xs">${escapeHTML((p.global && p.global.badge) || '1')}</div>
                        <div class="min-w-0">
                            <h4 class="font-heading font-bold text-sm text-dark dark:text-white leading-tight truncate">${escapeHTML((p.global && p.global.title) || 'UNTITLED')}</h4>
                            <span class="text-[11px] text-slate-400 font-bold uppercase">${p.modules ? p.modules.length : 0} blocks · ${escapeHTML((p.global && p.global.layout) || 'landscape')}</span>
                        </div>
                    </div>
                    <div class="flex gap-1 items-center flex-shrink-0" onclick="event.stopPropagation()">
                        <button type="button" aria-label="Rename project" onclick="App.renamePoster('${jsId}')" class="p-2 text-slate-400 hover:text-orange transition-colors" title="Rename"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button type="button" aria-label="Duplicate project" onclick="App.duplicatePoster('${jsId}')" class="p-2 text-slate-400 hover:text-blue transition-colors" title="Duplicate"><i data-lucide="copy" class="w-4 h-4"></i></button>
                        ${Store.state.posters.length > 1 ? `<button type="button" aria-label="Delete project" onclick="App.deletePoster('${jsId}')" class="p-2 text-slate-400 hover:text-pink transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                    </div>
                </div>`;
            }).join('');
            hydrateIcons();
        }
        const modal = document.getElementById('library-modal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    },

    async renamePoster(id) {
        const p = Store.state.posters.find(x => x.id === id);
        if (!p) return;
        let newTitle = null;
        if (typeof quickPrompt === 'function') {
            newTitle = await quickPrompt('Rename Poster Title:', p.global.title);
        }
        if (newTitle && newTitle.trim()) {
            p.global.title = newTitle.trim();
            p.lastModified = Date.now();
            Store.save();
            App.updateUI();
            Renderer.renderPoster();
            App.openLibrary();
        }
    },

    duplicatePoster(id) {
        const p = Store.state.posters.find(x => x.id === id);
        if (!p) return;
        const copy = JSON.parse(JSON.stringify(p));
        copy.id = makeId();
        copy.global.title = `${copy.global.title} (Copy)`;
        copy.lastModified = Date.now();
        Store.state.posters.push(copy);
        Store.save();
        App.updateUI();
        App.openLibrary();
    },

    async deletePoster(id) {
        App.showConfirm('Delete this saved poster?', async () => {
            try {
                if (typeof getCloudUser === 'function' && typeof deleteFolder === 'function') {
                    const user = await getCloudUser();
                    if (user) {
                        deleteFolder(`${user.id}/poster_studio/${id}`).catch(() => {});
                    }
                }
            } catch (_) {}

            Store.state.posters = Store.state.posters.filter(p => p.id !== id);
            if (!Store.state.posters.length) {
                App.createNewPoster();
                return;
            }
            if (Store.current && id === Store.current.id) {
                App.switchPoster(Store.state.posters[0].id);
                Store.save();
            } else {
                Store.save();
                App.updateUI();
            }
            App.openLibrary();
        });
    },

    exportPoster() {
        if (!Store.current) return;
        const cleanName = String((Store.current.global && Store.current.global.title) || 'Untitled')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .slice(0, 60) || 'Untitled';
        const json = JSON.stringify(Store.current, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Poster_${cleanName}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Exported poster JSON!', 'success');
    },

    handleFileImport(input) {
        const f = input.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const imported = sanitizePosterSchema(parsed);
                Store.state.posters.push(imported);
                App.switchPoster(imported.id);
                Store.save();
                showToast('Imported poster!', 'success');
            } catch (_) {
                if (typeof showAlertModal === 'function') {
                    await showAlertModal('Invalid poster JSON file.', { title: 'Error', icon: 'x-octagon', iconColor: 'red' });
                } else {
                    showToast('Invalid poster JSON file.', 'error');
                }
            } finally {
                input.value = '';
            }
        };
        r.readAsText(f);
    },

    // --- DRAG AND DROP HANDLERS ---
    handleDragStart(e, idx) {
        App.isDragging = true;
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        const card = e.currentTarget || e.target;
        setTimeout(() => card?.classList?.add('dragging'), 0);
    },
    handleDragEnd(e) {
        const card = e.currentTarget || e.target;
        card?.classList?.remove('dragging');
        if (typeof document.querySelectorAll === 'function') {
            document.querySelectorAll('.module-wrapper.drag-over').forEach(el => el.classList.remove('drag-over'));
        }
        setTimeout(() => { App.isDragging = false; }, 100);
    },
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const card = e.currentTarget;
        if (card && !card.classList.contains('drag-over')) card.classList.add('drag-over');
    },
    handleDragLeave(e) {
        const card = e.currentTarget;
        if (card && e.relatedTarget && typeof card.contains === 'function' && card.contains(e.relatedTarget)) {
            return;
        }
        card?.classList?.remove('drag-over');
    },
    handleDrop(e, targetIdx) {
        e.preventDefault();
        e.currentTarget?.classList?.remove('drag-over');
        const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const parsedTarget = parseInt(targetIdx, 10);
        if (Number.isNaN(sourceIdx) || Number.isNaN(parsedTarget)) return;
        if (sourceIdx !== parsedTarget) {
            Store.reorderModules(sourceIdx, parsedTarget);
        }
    }
};


// --- 6. BOOTSTRAP & DEBUG EXPORTS ---
window.App = App;
window.Store = Store;
window.Renderer = Renderer;
window.Editor = Editor;
window.TableEditor = TableEditor;
window.ModuleEditors = ModuleEditors;
window.CONFIG = CONFIG;
window.ModuleRegistry = ModuleRegistry;

window.__posterStudioDebug = {
    escapeHTML,
    escapeJsAttr,
    sanitizePosterSchema,
    computeUsedGridRows,
    computeFitScale,
    parseBulkPosterText,
    parseDelimitedTable,
    parseVocabItems,
    parseDialogueTurns,
    normalizeDoDontPairs,
    ModuleRegistry,
    ModuleEditors,
    getState: () => Store.state,
    getCurrent: () => Store.current,
    getUiMode: () => App.uiMode,
    getTemplates: () => POSTER_TEMPLATES
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
});

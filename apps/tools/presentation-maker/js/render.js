'use strict';

Object.assign(app, {
        /* --- STAGE RENDERER (Shared across Grid & Presentation) --- */
        buildSlideStageHTML(slide, index, mode = 'present') {
            const safeSlide = sanitizeSlide(slide, index);
            const themeKey = resolveSlideTheme(safeSlide.theme, index);
            const rawText = safeSlide.text || '';
            const trimmed = rawText.trim();
            const len = trimmed.length;
            const lenClass = len > 110 ? 'text-len-long' : (len > 42 ? 'text-len-medium' : 'text-len-short');

            const fallbackLabel = mode === 'present' ? '' : 'Your slide text here';
            const displaySafeText = trimmed ? escapeHTML(trimmed) : `<span class="opacity-45">${fallbackLabel}</span>`;

            const renderMediaSlot = (emptyText) => {
                if (safeSlide.image) {
                    const cached = this.getCachedMediaSrc(safeSlide.image);
                    const srcAttr = cached ? ` src="${escapeHTML(cached)}" class="is-loaded"` : '';
                    return `<div class="stage-media-frame"><img data-media-src="${escapeHTML(safeSlide.image)}"${srcAttr} alt="Slide visual" /></div>`;
                }
                return `
                    <div class="stage-media-frame">
                        <div class="stage-media-empty">
                            <i data-lucide="image" class="w-8 h-8"></i>
                            <span>${escapeHTML(emptyText)}</span>
                        </div>
                    </div>
                `;
            };

            let innerHTML = '';

            if (safeSlide.layout === 'bullets') {
                const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
                const heading = lines[0] || (mode === 'present' ? '' : 'Heading Line 1');
                const bulletLines = lines.slice(1).map((l) => l.replace(/^[-*•]+\s*/, ''));
                const bulletsHtml = bulletLines.length
                    ? bulletLines.map((item) => `
                        <li class="stage-bullet-item">
                            <span class="stage-bullet-dot"></span>
                            <span>${escapeHTML(item)}</span>
                        </li>
                    `).join('')
                    : (mode === 'present' ? '' : `
                        <li class="stage-bullet-item opacity-50">
                            <span class="stage-bullet-dot"></span>
                            <span>Add more lines for bullet points</span>
                        </li>
                    `);

                innerHTML = `
                    <div class="stage-layout-bullets">
                        <div class="stage-bullets-title">${escapeHTML(heading)}</div>
                        <ul class="stage-bullets-list">${bulletsHtml}</ul>
                    </div>
                `;
            } else if (safeSlide.layout === 'split') {
                innerHTML = `
                    <div class="stage-layout-split">
                        <div class="stage-split-text">${displaySafeText}</div>
                        ${renderMediaSlot(mode === 'present' ? 'No Image' : 'Add Image')}
                    </div>
                `;
            } else if (safeSlide.layout === 'caption') {
                innerHTML = `
                    <div class="stage-layout-caption">
                        ${renderMediaSlot(mode === 'present' ? 'No Image' : 'Add Image')}
                        ${trimmed || mode !== 'present' ? `<div class="stage-caption-box">${displaySafeText}</div>` : ''}
                    </div>
                `;
            } else if (safeSlide.layout === 'full') {
                innerHTML = `
                    <div class="stage-layout-full">
                        ${renderMediaSlot(mode === 'present' ? 'No Full Image' : 'Upload Full Image')}
                        ${trimmed ? `<div class="stage-full-label">${escapeHTML(trimmed)}</div>` : ''}
                    </div>
                `;
            } else {
                innerHTML = `
                    <div class="stage-layout-hero">
                        <div class="stage-hero-text ${lenClass}">${displaySafeText}</div>
                    </div>
                `;
            }

            return `<div class="stage-surface stage-theme-${themeKey} stage-mode-${mode}">${innerHTML}</div>`;
        },

        /* --- RENDERING (CLASSIC WORKSPACE: LIST & GRID) --- */
        setView(mode) {
            if (mode !== 'list' && mode !== 'grid') return;
            this.viewMode = mode;
            try { localStorage.setItem(VIEW_KEY, mode); } catch (e) { }
            this.render();
        },

        switchView(mode) {
            this.setView(mode);
        },

        updateDeckHeaderUI() {
            const titleEl = document.getElementById('deck-title-label');
            const dotEl = document.getElementById('save-status-dot');
            const countEl = document.getElementById('stat-count');
            const timeEl = document.getElementById('stat-time');
            const badgeEl = document.getElementById('library-count-badge');
            const activePill = document.getElementById('active-slide-pill');
            const deckImgBadge = document.getElementById('deck-img-count-badge');

            if (titleEl) titleEl.textContent = this.currentDeckTitle === 'Untitled Deck' ? 'Unsaved Session' : (this.currentDeckTitle || 'Unsaved Session');
            if (dotEl) {
                dotEl.className = `w-2 h-2 rounded-full flex-shrink-0 ${this.hasUnsavedChanges ? 'bg-orange' : 'bg-green'}`;
                dotEl.title = this.hasUnsavedChanges ? 'Unsaved edits' : 'All changes saved';
            }

            const totalWords = this.slides.reduce((acc, s) => acc + ((s.text || '').trim().split(/\s+/).filter(Boolean).length), 0);
            const mins = this.slides.length ? Math.max(1, Math.ceil((totalWords / 110) + (this.slides.length * 0.4))) : 0;

            if (countEl) countEl.textContent = String(this.slides.length);
            if (timeEl) timeEl.textContent = `${mins}m`;
            if (badgeEl) badgeEl.textContent = String(this.library.length);
            if (activePill) {
                activePill.textContent = this.slides.length
                    ? `Slide ${Math.min(this.activeSlideIndex + 1, this.slides.length)} / ${this.slides.length}`
                    : '0 Slides';
            }

            if (deckImgBadge) deckImgBadge.textContent = String(this.imageLibrary.length);

            this.updateHistoryButtons();
        },

        render() {
            const listEl = document.getElementById('slides-list-container');
            const gridEl = document.getElementById('slides-grid-container');
            const emptyEl = document.getElementById('empty-state');
            const viewListBtn = document.getElementById('view-list');
            const viewGridBtn = document.getElementById('view-grid');

            if (this.activeSlideIndex >= this.slides.length) {
                this.activeSlideIndex = Math.max(0, this.slides.length - 1);
            }

            if (viewListBtn && viewGridBtn) {
                viewListBtn.className = `p-1.5 rounded-lg transition-colors cursor-pointer ${this.viewMode === 'list' ? 'bg-blue text-white' : 'text-slate-500 dark:text-slate-300'}`;
                viewGridBtn.className = `p-1.5 rounded-lg transition-colors cursor-pointer ${this.viewMode === 'grid' ? 'bg-blue text-white' : 'text-slate-500 dark:text-slate-300'}`;
            }

            this.updateDeckHeaderUI();

            if (!this.slides.length) {
                if (listEl) {
                    listEl.innerHTML = '';
                    listEl.classList.add('is-hidden');
                }
                if (gridEl) {
                    gridEl.innerHTML = '';
                    gridEl.classList.add('is-hidden');
                }
                if (emptyEl) emptyEl.classList.remove('is-hidden');
                this.safeCreateIcons();
                return;
            }

            if (emptyEl) emptyEl.classList.add('is-hidden');

            if (this.viewMode === 'list') {
                if (listEl) listEl.classList.remove('is-hidden');
                if (gridEl) gridEl.classList.add('is-hidden');
                this.renderList();
            } else {
                if (listEl) listEl.classList.add('is-hidden');
                if (gridEl) gridEl.classList.remove('is-hidden');
                this.renderGrid();
            }

            this.safeCreateIcons();
            this.hydrateMediaElements(document, 'workspace');
        },

        renderList() {
            const container = document.getElementById('slides-list-container');
            if (!container) return;

            const stripColors = {
                blue: '#1ea7fd',
                pink: '#ff4785',
                green: '#00d063',
                orange: '#ff7e33',
                purple: '#7c4dff',
                dark: '#0f172a',
                light: '#cbd5e1'
            };

            container.innerHTML = this.slides.map((slide, index) => {
                const resolvedTheme = resolveSlideTheme(slide.theme, index);
                const stripHex = stripColors[resolvedTheme] || '#1ea7fd';
                const layoutMeta = SLIDE_LAYOUTS[slide.layout] || SLIDE_LAYOUTS.hero;
                const isActive = index === this.activeSlideIndex;
                const showMediaColumn = layoutMeta.usesImage || Boolean(slide.image);

                const layoutButtons = Object.values(SLIDE_LAYOUTS).map((l) => `
                    <button type="button" data-action="set-layout" data-layout="${escapeHTML(l.id)}" title="${escapeHTML(l.desc)}"
                        class="layout-pill ${slide.layout === l.id ? 'is-selected' : ''}">
                        <i data-lucide="${escapeHTML(l.icon)}" class="w-3.5 h-3.5"></i>
                        <span>${escapeHTML(l.label)}</span>
                    </button>
                `).join('');

                const themeDots = SLIDE_THEMES.map((t) => `
                    <button type="button" data-action="set-theme" data-theme-choice="${escapeHTML(t.id)}"
                        title="Theme: ${escapeHTML(t.label)}" aria-label="Theme ${escapeHTML(t.label)}"
                        style="background: ${t.swatch};"
                        class="theme-dot ${slide.theme === t.id ? 'is-selected' : ''}"></button>
                `).join('');

                const mediaHtml = showMediaColumn ? `
                    <div class="w-full md:w-56 flex-shrink-0 flex flex-col gap-2">
                        <div class="slide-dropzone flex-1 flex flex-col items-center justify-center" data-slide-index="${index}">
                            ${slide.image ? `
                                <div class="slide-thumb">
                                    <img data-media-src="${escapeHTML(slide.image)}"${this.getCachedMediaSrc(slide.image) ? ` src="${escapeHTML(this.getCachedMediaSrc(slide.image))}" class="is-loaded"` : ''} alt="Slide ${index + 1} visual" />
                                    <div class="absolute top-2 right-2 flex items-center gap-1">
                                        <button type="button" data-action="pick-img" title="Swap image from Image Manager" aria-label="Swap image from Image Manager"
                                            class="px-2 h-7 rounded-lg bg-white/90 dark:bg-slate-800/90 text-dark dark:text-white border-2 border-dark shadow-hard-sm flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer hover:border-blue">
                                            <i data-lucide="images" class="w-3 h-3 text-orange"></i>
                                            <span>Swap</span>
                                        </button>
                                        <button type="button" data-action="remove-img" title="Remove from slide (stays in Image Manager)" aria-label="Remove image from slide"
                                            class="w-7 h-7 rounded-lg bg-pink text-white border-2 border-dark shadow-hard-sm flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <div class="p-3 text-center flex flex-col items-center gap-2">
                                    <i data-lucide="image-plus" class="w-6 h-6 text-slate-400"></i>
                                    <p class="text-[11px] font-extrabold text-slate-400 leading-tight">Drop image or pick saved</p>
                                    <div class="flex flex-wrap items-center justify-center gap-1.5">
                                        <button type="button" data-action="pick-img"
                                            class="px-2.5 py-1 rounded-lg bg-orange/15 text-orange hover:bg-orange hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            Manager
                                        </button>
                                        <button type="button" data-action="upload-img"
                                            class="px-2.5 py-1 rounded-lg bg-blue/15 text-blue hover:bg-blue hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            Upload
                                        </button>
                                        <button type="button" data-action="url-img"
                                            class="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-pink hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            URL
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                ` : '';

                return `
                    <article class="slide-card ${isActive ? 'is-active' : ''}" data-slide-index="${index}">
                        <div class="slide-accent-strip" style="background-color: ${stripHex};"></div>

                        <div class="pl-5 pr-4 py-3.5 space-y-3">
                            <!-- Card Header Row -->
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="px-2.5 py-1 rounded-xl bg-dark dark:bg-slate-700 text-white font-heading font-bold text-xs uppercase tracking-wider">
                                        Slide ${index + 1}
                                    </span>
                                    <div class="flex items-center gap-1 flex-wrap">${layoutButtons}</div>
                                </div>

                                <div class="flex items-center gap-1">
                                    <button type="button" data-action="present-from" title="Present starting from this slide"
                                        aria-label="Present from Slide ${index + 1}"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-pink hover:bg-pink/15 transition-colors cursor-pointer">
                                        <i data-lucide="play" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="move-up" title="Move slide up"
                                        aria-label="Move slide up" ${index === 0 ? 'disabled' : ''}
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors cursor-pointer">
                                        <i data-lucide="chevron-up" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="move-down" title="Move slide down"
                                        aria-label="Move slide down" ${index === this.slides.length - 1 ? 'disabled' : ''}
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors cursor-pointer">
                                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="duplicate" title="Duplicate slide"
                                        aria-label="Duplicate slide"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-blue hover:bg-blue/10 transition-colors cursor-pointer">
                                        <i data-lucide="copy" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="delete" title="Delete slide"
                                        aria-label="Delete slide"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-pink hover:bg-pink/10 transition-colors cursor-pointer">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Card Body: Text + Optional Image Dropzone -->
                            <div class="flex flex-col md:flex-row gap-3">
                                <div class="flex-1 min-w-0 flex flex-col gap-2">
                                    <textarea data-field="text" spellcheck="true"
                                        placeholder="${escapeHTML(layoutMeta.placeholder)}"
                                        class="slide-textarea custom-scrollbar">${escapeHTML(slide.text || '')}</textarea>
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div class="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                            <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-orange flex-shrink-0"></i>
                                            <input type="text" data-field="notes" value="${escapeHTML(slide.notes || '')}"
                                                placeholder="Optional teacher speaker note..."
                                                class="slide-notes-input" />
                                        </div>
                                        <div class="flex items-center gap-1.5 pl-1" title="Slide Background Color">
                                            ${themeDots}
                                        </div>
                                    </div>
                                </div>
                                ${mediaHtml}
                            </div>

                            <!-- Quick Insert Slide Divider Button -->
                            <div class="flex items-center justify-between pt-0.5 text-[11px] font-bold text-slate-400">
                                <span>${escapeHTML(layoutMeta.desc)}</span>
                                <button type="button" data-action="add-after"
                                    class="inline-flex items-center gap-1 text-blue hover:underline font-extrabold cursor-pointer">
                                    <i data-lucide="circle-plus" class="w-3.5 h-3.5"></i>
                                    <span>Insert Below</span>
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        },

        renderGrid() {
            const container = document.getElementById('slides-grid-container');
            if (!container) return;

            container.innerHTML = this.slides.map((slide, index) => {
                const isActive = index === this.activeSlideIndex;
                const layoutLabel = SLIDE_LAYOUTS[slide.layout]?.label || 'Hero';
                return `
                    <div class="grid-card ${isActive ? 'is-active' : ''}" draggable="true" data-slide-index="${index}">
                        <div class="grid-thumb-stage">
                            ${this.buildSlideStageHTML(slide, index, 'grid')}
                        </div>
                        <div class="px-3 py-2.5 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="w-6 h-6 rounded-lg bg-dark dark:bg-slate-700 text-white text-[11px] font-heading font-bold flex items-center justify-center flex-shrink-0">${index + 1}</span>
                                <span class="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 truncate">${escapeHTML(layoutLabel)}</span>
                            </div>
                            <div class="flex items-center gap-1 flex-shrink-0">
                                <button type="button" data-grid-action="present" title="Present from Slide ${index + 1}"
                                    aria-label="Present from Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-pink hover:bg-pink/15 cursor-pointer">
                                    <i data-lucide="play" class="w-3.5 h-3.5"></i>
                                </button>
                                <button type="button" data-grid-action="edit" title="Edit Slide ${index + 1}"
                                    aria-label="Edit Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-blue hover:bg-blue/15 cursor-pointer">
                                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                                </button>
                                <button type="button" data-grid-action="delete" title="Delete Slide ${index + 1}"
                                    aria-label="Delete Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/15 cursor-pointer">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },

});

// --- 4. RENDERER (Poster Canvas) ---
const Renderer = {
    patchHeaderText() {
        const area = document.getElementById('poster-area');
        if (!area || !Store.current) return;
        const g = Store.current.global || {};
        const titleEl = area.querySelector('.poster-board-title');
        const subEl = area.querySelector('.poster-board-subtitle');
        const badgeWrap = area.querySelector('.poster-header-badge');
        const badgeTxt = area.querySelector('.poster-header-badge span');
        if (titleEl) titleEl.textContent = g.title || '';
        if (subEl) subEl.textContent = g.subtitle || '';
        const hasBadge = Boolean((g.badge || '').trim());
        if (badgeWrap) badgeWrap.classList.toggle('is-hidden', !hasBadge);
        if (badgeTxt) badgeTxt.textContent = g.badge || '';
    },

    renderPoster(options = {}) {
        if (!Store.current) return;
        const g = Store.current.global || {};
        const area = document.getElementById('poster-area');
        if (!area) return;

        const layout = g.layout || 'landscape';
        const pattern = g.pattern || 'graph';
        const gridSize = g.gridSize || 'md';
        let width = 2560;
        let height = 1440;
        if (layout === 'portrait') {
            width = 1440;
            height = 2560;
        } else if (layout === 'square') {
            width = 1920;
            height = 1920;
        }
        area.style.width = `${width}px`;
        area.style.height = `${height}px`;

        area.classList.remove('bg-graph-paper', 'bg-dots', 'bg-chalkboard', 'bg-cork', 'bg-plain');
        area.style.backgroundImage = '';
        area.style.backgroundColor = '';

        const patternMap = {
            graph: 'bg-graph-paper',
            dots: 'bg-dots',
            chalkboard: 'bg-chalkboard',
            cork: 'bg-cork',
            plain: 'bg-plain'
        };
        area.classList.add(patternMap[pattern] || 'bg-graph-paper');

        area.classList.remove('grid-sm', 'grid-md', 'grid-lg');
        area.classList.add(`grid-${gridSize}`);
        document.body.dataset.posterLayout = layout;

        const hasBadge = Boolean((g.badge || '').trim());
        const header = `
            <div class="poster-header-bar col-span-12 row-span-2 flex items-start justify-between gap-6 pb-4 pointer-events-none" style="border-bottom: 4px solid var(--ps-border)">
                <div class="min-w-0 flex-1">
                    <h1 class="poster-board-title font-heading font-bold text-8xl leading-none mb-4 break-words">${escapeHTML(g.title)}</h1>
                    <p class="poster-board-subtitle font-body font-bold text-4xl break-words">${escapeHTML(g.subtitle)}</p>
                </div>
                <div class="poster-header-badge ${hasBadge ? '' : 'is-hidden'} h-32 min-w-[180px] px-10 flex items-center justify-center bg-brand-yellow border-4 rounded-full shadow-[6px_6px_0px_0px_var(--ps-shadow)] transform rotate-2 flex-shrink-0 whitespace-nowrap" style="border-color: var(--ps-border)">
                    <span class="font-heading font-bold text-6xl text-brand-dark">${escapeHTML(g.badge)}</span>
                </div>
            </div>`;

        let contentHTML = '';
        const modules = Array.isArray(Store.current.modules) ? Store.current.modules : [];
        const gridRowCount = computeUsedGridRows(modules);
        const animateId = options.animateId || null;

        if (modules.length === 0) {
            contentHTML = `
            <div class="col-span-12 row-span-10 flex items-center justify-center">
                <div class="poster-empty-box pointer-events-auto border-[6px] border-dashed rounded-[2.5rem] p-16 text-center bg-white/80 dark:bg-slate-900/75" style="border-color: var(--ps-border)">
                    <i data-lucide="layout-template" class="poster-board-title w-28 h-28 mx-auto mb-5 opacity-70"></i>
                    <h3 class="poster-board-title font-heading font-bold text-5xl uppercase tracking-tight">Empty Poster</h3>
                    <p class="poster-board-subtitle font-body font-bold text-3xl mt-3 mb-8">Pick a ready classroom template, bulk import a lesson, or add blocks below</p>
                    <div class="flex flex-wrap items-center justify-center gap-6">
                        <button type="button" onclick="App.openTemplatesModal()"
                            class="px-8 py-4 rounded-2xl bg-brand-orange text-white border-4 border-[#1e293b] shadow-[6px_6px_0px_0px_#1e293b] font-heading font-bold text-3xl uppercase flex items-center gap-3 cursor-pointer">
                            <i data-lucide="sparkles" class="w-8 h-8"></i> Browse Templates
                        </button>
                        <button type="button" onclick="App.openBulkImport()"
                            class="px-8 py-4 rounded-2xl bg-brand-pink text-white border-4 border-[#1e293b] shadow-[6px_6px_0px_0px_#1e293b] font-heading font-bold text-3xl uppercase flex items-center gap-3 cursor-pointer">
                            <i data-lucide="file-up" class="w-8 h-8"></i> Bulk Import
                        </button>
                        <button type="button" onclick="App.addModule('vocab')"
                            class="px-8 py-4 rounded-2xl bg-brand-blue text-white border-4 border-[#1e293b] shadow-[6px_6px_0px_0px_#1e293b] font-heading font-bold text-3xl uppercase flex items-center gap-3 cursor-pointer">
                            <i data-lucide="plus" class="w-8 h-8"></i> Add Vocab Block
                        </button>
                    </div>
                </div>
            </div>`;
        } else {
            contentHTML = modules.map((m, idx) => {
                const cfg = ModuleRegistry[m.type];
                if (!cfg) return '';
                const safeColor = CONFIG.safeColor(m.color);
                const cls = CONFIG.getColorClasses(safeColor);
                const spans = {
                    size: { xs: 'col-span-2', sm: 'col-span-4', md: 'col-span-6', lg: 'col-span-8', xl: 'col-span-10', full: 'col-span-12' },
                    height: { mini: 'row-span-1', short: 'row-span-2', auto: 'row-span-3', tall: 'row-span-6', grand: 'row-span-9', full: 'row-span-12' }
                };
                const fontSize = m.fontSize || 'md';
                const inner = cfg.render(m.data, safeColor, fontSize);
                const titleSizeClass = CONFIG.sizes.title[fontSize] || CONFIG.sizes.title.md;
                const isAutoFit = fontSize === 'auto';
                const jsId = escapeJsAttr(m.id);
                const justAddedCls = animateId === m.id ? 'just-added' : '';
                const tapeHtml = m.showTape !== false ? '<div class="tape-strip pointer-events-none"></div>' : '';

                return `
                    <div
                        draggable="true"
                        ondragstart="App.handleDragStart(event, '${idx}')"
                        ondragend="App.handleDragEnd(event)"
                        ondragover="App.handleDragOver(event)"
                        ondragleave="App.handleDragLeave(event)"
                        ondrop="App.handleDrop(event, '${idx}')"
                        onclick="App.openEditor('${jsId}')"
                        class="module-wrapper ${justAddedCls} ${spans.size[m.size] || 'col-span-6'} ${spans.height[m.height] || 'row-span-3'} rounded-2xl relative flex flex-col group shadow-[8px_8px_0px_0px_var(--ps-shadow)]"
                        style="background-color: var(--surface-card); border: 4px solid var(--ps-border)">
                        ${tapeHtml}
                        <div class="w-full h-full flex flex-col overflow-hidden rounded-xl" ${isAutoFit ? 'style="container-type: inline-size;"' : ''}>
                            <div class="${cls.bg} px-6 py-3 flex justify-between items-center relative z-10 flex-shrink-0" style="border-bottom: 4px solid var(--ps-border)">
                                <h3 class="font-heading font-bold text-white ${titleSizeClass} uppercase tracking-wide truncate pointer-events-none">${escapeHTML(m.title)}</h3>
                                <div class="card-quick-actions flex items-center gap-1.5" onclick="event.stopPropagation()">
                                    <button type="button" onclick="App.quickMoveMod('${jsId}', -1)" title="Move Back" class="bg-black/25 hover:bg-black/45 text-white rounded-lg p-1.5 cursor-pointer ${idx === 0 ? 'opacity-35 cursor-not-allowed' : ''}" ${idx === 0 ? 'disabled' : ''}><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
                                    <button type="button" onclick="App.quickMoveMod('${jsId}', 1)" title="Move Forward" class="bg-black/25 hover:bg-black/45 text-white rounded-lg p-1.5 cursor-pointer ${idx === modules.length - 1 ? 'opacity-35 cursor-not-allowed' : ''}" ${idx === modules.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
                                    <button type="button" onclick="App.quickDuplicateMod('${jsId}')" title="Duplicate" class="bg-black/25 hover:bg-black/45 text-white rounded-lg p-1.5 cursor-pointer"><i data-lucide="copy" class="w-5 h-5"></i></button>
                                    <button type="button" onclick="App.quickDeleteMod('${jsId}')" title="Delete" class="bg-black/25 hover:bg-red-600 text-white rounded-lg p-1.5 cursor-pointer"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                                    <span class="bg-black/25 text-white rounded-lg p-1.5 cursor-grab active:cursor-grabbing" title="Drag to Reorder"><i data-lucide="move" class="w-5 h-5"></i></span>
                                </div>
                            </div>
                            <div class="flex-1 overflow-hidden relative pointer-events-none">${inner}</div>
                        </div>
                    </div>`;
            }).join('');
        }

        area.innerHTML = `<div class="p-16 h-full flex flex-col">${header}<div class="flex-1 grid grid-cols-12 gap-8 grid-flow-dense pt-6 min-h-0" style="grid-template-rows: repeat(${gridRowCount}, minmax(0, 1fr));">${contentHTML}</div><div class="poster-board-subtitle mt-auto pt-8 text-center opacity-50 font-heading font-bold text-xl uppercase tracking-[0.3em]">KlassKit · Poster Studio</div></div>`;

        Renderer.applyZoom();
        Renderer.hydrateImages();
        hydrateIcons();
    },

    applyZoom() {
        if (!Store.current) return;
        const z = Store.current.zoom || 0.5;
        const g = Store.current.global || {};
        const layout = g.layout || 'landscape';
        let width = 2560;
        let height = 1440;
        if (layout === 'portrait') {
            width = 1440;
            height = 2560;
        } else if (layout === 'square') {
            width = 1920;
            height = 1920;
        }
        const wrapper = document.getElementById('poster-wrapper');
        const area = document.getElementById('poster-area');
        if (wrapper && area) {
            wrapper.style.transform = '';
            wrapper.style.width = `${Math.round(width * z)}px`;
            wrapper.style.height = `${Math.round(height * z)}px`;
            area.style.transformOrigin = 'top left';
            area.style.transform = `scale(${z})`;
        }
        const zoomDisplay = document.getElementById('zoom-display');
        if (zoomDisplay) zoomDisplay.textContent = `${Math.round(z * 100)}%`;
    },

    async hydrateImages() {
        const imgs = document.querySelectorAll('img[data-idb-id]');
        for (const img of imgs) {
            const id = img.dataset.idbId;
            if (!id) continue;
            try {
                if (id.startsWith('http') && typeof resolveMediaUrl === 'function') {
                    const resolved = await resolveMediaUrl(id);
                    if (resolved) img.src = resolved;
                } else {
                    const src = await Store.getImage(id);
                    if (src) img.src = src;
                }
            } catch (_) {}
        }
    }
};

// --- 5. EDITOR (Modal) ---
const Editor = {
    inputModes: {},

    render(id, focusSelector = null) {
        if (!Store.current) return;
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        const cfg = ModuleRegistry[m.type];
        const con = document.getElementById('editor-content');
        if (!con || !cfg) return;

        const safeId = escapeJsAttr(id);
        const isPro = App.uiMode === 'pro';

        const colors = CONFIG.colors.map((c) => {
            const cls = CONFIG.getColorClasses(c);
            const active = m.color === c;
            return `<button type="button" aria-label="Color ${c}" aria-pressed="${active}" onclick="App.pushHistory(); Store.updateMod('${safeId}','color','${c}'); Editor.render('${safeId}')" class="w-8 h-8 rounded-full ${cls.bg} flex-shrink-0 transition-transform ${active ? 'border-[3.5px] border-[#1e293b] dark:border-white scale-110 shadow-[2px_2px_0px_0px_#1e293b]' : 'border-2 border-white dark:border-slate-600 opacity-70 hover:opacity-100'}"></button>`;
        }).join('');

        const mkSeg = (lbl, key, opts) => {
            const defaultVal = (opts.find(o => o.def) || {}).v;
            const currentVal = m[key] || defaultVal;
            return `
            <div class="mb-2.5">
                <label class="lbl">${lbl}</label>
                <div class="flex gap-1 p-1 rounded-xl border-2" style="background-color: var(--ps-inset); border-color: var(--border-secondary)">
                    ${opts.map((o) => {
                        const isSel = currentVal === o.v;
                        return `<button type="button" onclick="App.pushHistory(); Store.updateMod('${safeId}','${key}','${o.v}'); Editor.render('${safeId}')" class="flex-1 py-1.5 text-[10px] font-heading font-bold uppercase rounded-lg border-2 transition-all ${isSel ? 'bg-blue text-white border-[#1e293b] shadow-[2px_2px_0px_0px_#1e293b]' : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-dark dark:hover:text-white'}">${o.l}</button>`;
                    }).join('')}
                </div>
            </div>`;
        };

        const layoutSection = isPro
            ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                    ${mkSeg('Width', 'size', [
                        { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true },
                        { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: 'full', l: 'FULL' }
                    ])}
                    ${mkSeg('Height', 'height', [
                        { v: 'mini', l: 'XS' }, { v: 'short', l: 'SM' }, { v: 'auto', l: 'MD', def: true },
                        { v: 'tall', l: 'LG' }, { v: 'grand', l: 'XL' }, { v: 'full', l: 'MAX' }
                    ])}
                </div>
                ${mkSeg('Text Size', 'fontSize', [
                    { v: 'auto', l: 'Auto' }, { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true },
                    { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: '2xl', l: '2XL' }, { v: '3xl', l: '3XL' }
                ])}
                <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span class="font-heading font-bold text-xs uppercase text-slate-500 dark:text-slate-300">Masking Tape Pin</span>
                    <button type="button" onclick="App.pushHistory(); Store.updateMod('${safeId}','showTape',${m.showTape === false}); Editor.render('${safeId}')"
                        class="btn-chunky px-3 py-1 rounded-xl text-[10px] ${m.showTape !== false ? 'bg-orange text-white' : 'bg-white dark:bg-slate-700 text-slate-500'}">
                        ${m.showTape !== false ? 'Tape: On' : 'Tape: Off'}
                    </button>
                </div>`
            : `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                    ${mkSeg('Card Width', 'size', [
                        { v: 'md', l: 'Half', def: true }, { v: 'lg', l: 'Wide' }, { v: 'full', l: 'Full' }
                    ])}
                    ${mkSeg('Card Height', 'height', [
                        { v: 'short', l: 'Short' }, { v: 'auto', l: 'Medium', def: true }, { v: 'tall', l: 'Tall' }, { v: 'full', l: 'Full' }
                    ])}
                </div>
                ${mkSeg('Text Size', 'fontSize', [
                    { v: 'auto', l: 'Auto' }, { v: 'sm', l: 'Small' }, { v: 'md', l: 'Medium', def: true }, { v: 'lg', l: 'Large' }, { v: 'xl', l: 'XL' }
                ])}`;

        con.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label class="lbl">Block Title</label>
                    <input type="text" value="${escapeHTML(m.title)}"
                        class="w-full font-heading font-bold text-xl text-dark dark:text-white bg-transparent border-b-2 border-slate-200 dark:border-slate-600 focus:border-blue outline-none py-1"
                        oninput="Store.updateMod('${safeId}','title',this.value)">
                </div>

                <div class="p-3.5 rounded-2xl border-2" style="background-color: var(--ps-inset); border-color: var(--border-secondary)">
                    <label class="lbl mb-1.5">Header Color</label>
                    <div class="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar">${colors}</div>
                    ${layoutSection}
                </div>

                <div class="p-4 rounded-2xl border-2" style="background-color: var(--ps-card); border-color: var(--ps-border)">
                    ${cfg.inputs(safeId, m.data)}
                </div>
            </div>`;

        hydrateIcons();
        Editor.updateMoveButtons();

        if (focusSelector) {
            const target = con.querySelector(focusSelector);
            if (target && typeof target.focus === 'function') {
                target.focus();
                if (typeof target.setSelectionRange === 'function' && typeof target.value === 'string') {
                    const len = target.value.length;
                    target.setSelectionRange(len, len);
                }
            }
        }
    },

    updateMoveButtons() {
        const bBack = document.getElementById('btn-editor-move-back');
        const bFwd = document.getElementById('btn-editor-move-fwd');
        if (!bBack && !bFwd) return;
        const mods = Store.current?.modules || [];
        const idx = App.editingId ? mods.findIndex(m => m.id === App.editingId) : -1;
        if (bBack) bBack.disabled = idx <= 0;
        if (bFwd) bFwd.disabled = idx === -1 || idx >= mods.length - 1;
    }
};


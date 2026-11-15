/**
 * Universal Guided Bulk Import Modal Component for KlassKit
 * Follows the Copy-Template + Paste Import pattern from Quiz & Fix-Em
 * with Soft Brutalism styling, light/dark support, live parser preview, and warnings.
 *
 * Usage:
 *   const modal = window.KlassKitBulkImport.create({
 *       title: 'Bulk Import',
 *       subtitle: 'Paste content using the template below',
 *       accentColor: 'orange', // 'orange' | 'pink' | 'blue' | 'green'
 *       unitLabel: 'passage',  // singular noun for count display
 *       unitLabelPlural: 'passages',
 *       guideItems: [{ label: 'Title', syntax: '## My Title', color: 'orange', desc: 'Optional heading' }],
 *       tips: ['Separate multiple items with <b>## Title</b> or <b>---</b>.'],
 *       placeholder: '...',
 *       template: '...',
 *       options: [{ id: 'saveToLibrary', label: 'Save to Library', defaultChecked: true }],
 *       parse(text) {
 *           return {
 *               items: [],
 *               warnings: [],
 *               badges: [] // [{ label, meta, colorClass, title }]
 *           };
 *       },
 *       onImport(result, optionValues) {},
 *       onCopyTemplate() {}
 *   });
 */
(function () {
    'use strict';

    const STYLE_ID = 'kk-bulk-import-styles';
    const ACCENTS = {
        orange: {
            bar: 'bg-[#ff7e33]',
            iconBg: 'bg-[#ff7e33]',
            subtitle: 'text-[#ff7e33]',
            focusBorder: 'focus:border-[#ff7e33]',
            copyBtn: 'bg-[#ff7e33]/15 hover:bg-[#ff7e33] text-[#c2410c] dark:text-[#ff7e33] hover:text-white',
            badgeText: 'text-[#c2410c] dark:text-[#ff7e33]',
            codeBg: 'bg-[#ff7e33]/15 text-[#c2410c] dark:text-[#ff9c60]',
        },
        pink: {
            bar: 'bg-[#ff4785]',
            iconBg: 'bg-[#ff4785]',
            subtitle: 'text-[#ff4785]',
            focusBorder: 'focus:border-[#ff4785]',
            copyBtn: 'bg-[#ff4785]/15 hover:bg-[#ff4785] text-[#be185d] dark:text-[#ff4785] hover:text-white',
            badgeText: 'text-[#be185d] dark:text-[#ff4785]',
            codeBg: 'bg-[#ff4785]/15 text-[#be185d] dark:text-[#ff70a0]',
        },
        blue: {
            bar: 'bg-[#1ea7fd]',
            iconBg: 'bg-[#1ea7fd]',
            subtitle: 'text-[#1ea7fd]',
            focusBorder: 'focus:border-[#1ea7fd]',
            copyBtn: 'bg-[#1ea7fd]/15 hover:bg-[#1ea7fd] text-[#0369a1] dark:text-[#1ea7fd] hover:text-white',
            badgeText: 'text-[#0369a1] dark:text-[#1ea7fd]',
            codeBg: 'bg-[#1ea7fd]/15 text-[#0369a1] dark:text-[#5cc0ff]',
        },
        green: {
            bar: 'bg-[#00d063]',
            iconBg: 'bg-[#00d063]',
            subtitle: 'text-[#059669] dark:text-[#00d063]',
            focusBorder: 'focus:border-[#00d063]',
            copyBtn: 'bg-[#00d063]/15 hover:bg-[#00d063] text-[#047857] dark:text-[#00d063] hover:text-[#1e293b]',
            badgeText: 'text-[#047857] dark:text-[#00d063]',
            codeBg: 'bg-[#00d063]/15 text-[#047857] dark:text-[#34e585]',
        },
    };

    const BADGE_TONES = {
        orange: 'bg-[#ff7e33]/15 text-[#c2410c] dark:text-[#ff9c60] border-[#ff7e33]/35',
        pink: 'bg-[#ff4785]/15 text-[#be185d] dark:text-[#ff70a0] border-[#ff4785]/35',
        blue: 'bg-[#1ea7fd]/15 text-[#0369a1] dark:text-[#5cc0ff] border-[#1ea7fd]/35',
        green: 'bg-[#00d063]/15 text-[#047857] dark:text-[#34e585] border-[#00d063]/35',
        slate: 'bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600',
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .kk-import-overlay {
                position: fixed;
                inset: 0;
                z-index: 560;
                background: rgba(15, 23, 42, 0.62);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }
            .kk-import-overlay.open {
                opacity: 1;
                pointer-events: auto;
            }
            .kk-import-modal {
                transform: scale(0.93) translateY(8px);
                opacity: 0;
                transition: transform 0.26s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
                max-height: 92vh;
            }
            .kk-import-overlay.open .kk-import-modal {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            .kk-import-textarea {
                font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12.5px;
                line-height: 1.7;
                tab-size: 2;
                user-select: text;
                -webkit-user-select: text;
            }
            .kk-import-btn {
                font-family: 'Fredoka', sans-serif;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border: 3px solid #1e293b;
                box-shadow: 0 4px 0 #1e293b;
                transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.15s ease, color 0.15s ease;
                cursor: pointer;
                user-select: none;
            }
            html.dark .kk-import-btn {
                border-color: #64748b;
                box-shadow: 0 4px 0 #020617;
            }
            .kk-import-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 6px 0 #1e293b;
            }
            html.dark .kk-import-btn:hover:not(:disabled) {
                box-shadow: 0 6px 0 #020617;
            }
            .kk-import-btn:active:not(:disabled) {
                transform: translateY(4px);
                box-shadow: 0 0 0 #1e293b;
            }
            html.dark .kk-import-btn:active:not(:disabled) {
                box-shadow: 0 0 0 #020617;
            }
            .kk-import-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
                filter: grayscale(0.5);
            }
            .kk-import-btn:focus-visible,
            .kk-import-textarea:focus-visible {
                outline: 3px solid #1ea7fd;
                outline-offset: 2px;
            }
            .kk-import-badge {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 9px;
                border-radius: 999px;
                border-width: 2px;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            @media print {
                .kk-import-overlay { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        }
        return fallbackCopy(text);
    }

    function fallbackCopy(text) {
        return new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                if (ok) resolve();
                else reject(new Error('Copy command failed'));
            } catch (err) {
                reject(err);
            }
        });
    }

    function create(config) {
        ensureStyles();

        const accent = ACCENTS[config.accentColor] || ACCENTS.orange;
        const unitSingular = config.unitLabel || 'item';
        const unitPlural = config.unitLabelPlural || (unitSingular + 's');
        const options = Array.isArray(config.options) ? config.options : [];
        const modalId = config.id || ('kk-import-overlay-' + Math.random().toString(36).slice(2, 8));

        const overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.className = 'kk-import-overlay no-print print:hidden font-body';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', `${modalId}-title`);

        const guideHtml = (config.guideItems || []).map((item) => {
            const labelTone = ACCENTS[item.color] ? ACCENTS[item.color].badgeText : accent.badgeText;
            const codeTone = ACCENTS[item.color] ? ACCENTS[item.color].codeBg : accent.codeBg;
            return `
                <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700">
                    <p class="text-[10px] font-black uppercase tracking-wider mb-1 ${labelTone}">${escapeHtml(item.label)}</p>
                    <p class="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-snug">
                        <code class="px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${codeTone}">${escapeHtml(item.syntax)}</code>
                    </p>
                    ${item.desc ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">${item.desc}</p>` : ''}
                </div>
            `;
        }).join('');

        const tipsHtml = (config.tips || []).map((t) => `<p class="leading-snug">${t}</p>`).join('');

        const optionsHtml = options.length ? `
            <div class="flex flex-wrap items-center gap-3 mb-2.5">
                ${options.map((opt) => `
                    <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" data-import-opt="${escapeHtml(opt.id)}" class="w-4 h-4 rounded accent-[#1ea7fd] cursor-pointer" ${opt.defaultChecked ? 'checked' : ''} />
                        <span>${escapeHtml(opt.label)}</span>
                    </label>
                `).join('')}
            </div>
        ` : '';

        overlay.innerHTML = `
            <div class="kk-import-modal w-full max-w-4xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-[#1e293b] dark:border-slate-500 rounded-[1.75rem] shadow-[0_8px_0_#1e293b] dark:shadow-[0_8px_0_#020617] flex flex-col overflow-hidden text-[#1e293b] dark:text-slate-100">
                <div class="w-full h-2 ${accent.bar} shrink-0"></div>
                <div class="flex items-center gap-3.5 px-5 sm:px-6 pt-4 pb-3.5 border-b-3 border-[#1e293b]/15 dark:border-slate-700 shrink-0">
                    <div class="w-11 h-11 rounded-2xl ${accent.iconBg} flex items-center justify-center border-3 border-[#1e293b] dark:border-slate-500 shadow-[0_3px_0_#1e293b] dark:shadow-[0_3px_0_#020617] shrink-0 -rotate-2">
                        <i data-lucide="file-up" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h2 id="${modalId}-title" class="text-xl font-heading font-bold uppercase tracking-tight leading-none text-[#1e293b] dark:text-white">${escapeHtml(config.title || 'BULK IMPORT')}</h2>
                        <p class="text-[10px] font-black tracking-[0.2em] uppercase mt-1 ${accent.subtitle}">${escapeHtml(config.subtitle || 'Copy template or paste content below')}</p>
                    </div>
                    <button type="button" data-role="close" aria-label="Close bulk import modal" class="kk-import-btn bg-[#f8fafc] dark:bg-slate-800 text-[#1e293b] dark:text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
                    <!-- Format Guide + Copy Template -->
                    <div class="lg:w-72 shrink-0 p-4 sm:p-5 border-b-3 lg:border-b-0 lg:border-r-3 border-[#1e293b]/15 dark:border-slate-700 overflow-y-auto custom-scrollbar bg-slate-50/90 dark:bg-slate-800/50 space-y-3">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Format Guide</p>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">AI-Ready</span>
                        </div>
                        <div class="space-y-2">${guideHtml}</div>
                        ${tipsHtml ? `
                            <div class="p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-semibold space-y-1">
                                ${tipsHtml}
                            </div>
                        ` : ''}
                        <div class="space-y-2 pt-1">
                            <button type="button" data-role="copy-template" class="kk-import-btn w-full ${accent.copyBtn} py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2">
                                <i data-lucide="clipboard-copy" class="w-4 h-4"></i>
                                <span>Copy Template</span>
                            </button>
                            ${config.sample ? `
                                <button type="button" data-role="fill-sample" class="w-full py-1.5 px-3 rounded-xl text-[11px] font-extrabold text-slate-500 dark:text-slate-400 hover:text-[#1ea7fd] dark:hover:text-[#1ea7fd] hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                                    <span>Insert Sample Into Box</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Paste Textarea + Live Preview -->
                    <div class="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
                        <div class="flex-1 flex flex-col min-h-0 p-4 sm:p-5 pb-3">
                            <div class="flex items-center justify-between mb-1.5">
                                <label for="${modalId}-textarea" class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Paste Your Content</label>
                                <button type="button" data-role="clear-textarea" class="text-[11px] font-extrabold text-slate-400 hover:text-[#ff4785] transition-colors cursor-pointer">Clear</button>
                            </div>
                            <textarea id="${modalId}-textarea" spellcheck="false"
                                class="kk-import-textarea w-full flex-1 bg-[#f8fafc] dark:bg-slate-800 border-3 border-[#1e293b]/20 dark:border-slate-600 rounded-2xl px-4 py-3 text-[#1e293b] dark:text-white ${accent.focusBorder} focus:outline-none resize-none custom-scrollbar min-h-[190px]"
                                placeholder="${escapeHtml(config.placeholder || '')}"></textarea>
                        </div>

                        <div class="shrink-0 px-4 sm:px-5 py-3.5 border-t-3 border-[#1e293b]/10 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
                            ${optionsHtml}
                            <div data-role="preview-panel" class="hidden mb-3 max-h-28 overflow-y-auto custom-scrollbar space-y-2">
                                <div data-role="preview-list" class="flex flex-wrap gap-1.5"></div>
                                <div data-role="warnings" class="space-y-1"></div>
                            </div>
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <div data-role="preview-count" class="text-xs font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                                    <span>0 ${escapeHtml(unitPlural)} detected</span>
                                </div>
                                <div class="flex items-center gap-2.5 ml-auto">
                                    <button type="button" data-role="cancel" class="kk-import-btn bg-[#f8fafc] dark:bg-slate-700 text-[#1e293b] dark:text-white px-5 py-2 rounded-xl text-xs">
                                        Cancel
                                    </button>
                                    <button type="button" data-role="confirm" class="kk-import-btn bg-[#00d063] text-[#1e293b] px-6 py-2 rounded-xl text-xs flex items-center gap-1.5" disabled>
                                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                                        <span>${escapeHtml(config.confirmText || 'Import')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const textarea = overlay.querySelector(`#${modalId}-textarea`);
        const previewPanel = overlay.querySelector('[data-role="preview-panel"]');
        const previewList = overlay.querySelector('[data-role="preview-list"]');
        const warningsEl = overlay.querySelector('[data-role="warnings"]');
        const previewCountEl = overlay.querySelector('[data-role="preview-count"]');
        const confirmBtn = overlay.querySelector('[data-role="confirm"]');
        const copyBtn = overlay.querySelector('[data-role="copy-template"]');
        const fillSampleBtn = overlay.querySelector('[data-role="fill-sample"]');

        let lastResult = { items: [], warnings: [], badges: [] };
        let copyResetTimer = null;

        function refreshPreview() {
            const raw = textarea.value || '';
            const res = config.parse ? (config.parse(raw) || {}) : { items: [], warnings: [], badges: [] };
            const items = Array.isArray(res.items) ? res.items : [];
            const warnings = Array.isArray(res.warnings) ? res.warnings : [];
            const badges = Array.isArray(res.badges) ? res.badges : [];
            lastResult = { ...res, items, warnings, badges };

            const count = items.length;
            const labelSpan = previewCountEl.querySelector('span');
            if (count === 0 && warnings.length === 0) {
                labelSpan.textContent = `0 ${unitPlural} detected`;
                labelSpan.className = 'text-slate-500 dark:text-slate-400';
                confirmBtn.disabled = true;
                previewPanel.classList.add('hidden');
                previewList.innerHTML = '';
                warningsEl.innerHTML = '';
            } else {
                previewPanel.classList.remove('hidden');
                if (count === 0) {
                    labelSpan.textContent = `0 valid ${unitPlural} detected`;
                    labelSpan.className = 'text-[#ff4785]';
                    confirmBtn.disabled = true;
                } else {
                    const noun = count === 1 ? unitSingular : unitPlural;
                    let msg = `${count} ${noun} detected ✓`;
                    if (warnings.length > 0) {
                        msg += ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`;
                        labelSpan.className = 'text-[#ff7e33]';
                    } else {
                        labelSpan.className = 'text-[#059669] dark:text-[#00d063]';
                    }
                    labelSpan.textContent = msg;
                    confirmBtn.disabled = false;
                }

                previewList.innerHTML = badges.map((b, i) => {
                    const tone = BADGE_TONES[b.tone] || BADGE_TONES.slate;
                    const titleAttr = escapeHtml(b.title || b.label || '');
                    const prefix = badges.length > 1 ? `<span class="opacity-60">${i + 1}.</span>` : '';
                    const levelTag = b.tag ? `<span class="px-1.5 py-0.2 rounded bg-white/70 dark:bg-slate-900/50">${escapeHtml(b.tag)}</span>` : '';
                    const meta = b.meta ? `<span class="opacity-70 font-bold">${escapeHtml(b.meta)}</span>` : '';
                    return `<span class="kk-import-badge ${tone}" title="${titleAttr}">${prefix} ${levelTag} <span class="truncate max-w-[160px]">${escapeHtml(b.label || '')}</span> ${meta}</span>`;
                }).join('');

                warningsEl.innerHTML = warnings.map((w) => `
                    <p class="text-[11px] font-bold text-[#c2410c] dark:text-[#ff9c60] flex items-start gap-1.5">
                        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i>
                        <span>${escapeHtml(w)}</span>
                    </p>
                `).join('');
            }

            if (window.lucide) window.lucide.createIcons();
        }

        function getOptionValues() {
            const out = {};
            options.forEach((opt) => {
                const box = overlay.querySelector(`[data-import-opt="${opt.id}"]`);
                out[opt.id] = Boolean(box && box.checked);
            });
            return out;
        }

        function open(initialText) {
            textarea.value = typeof initialText === 'string' ? initialText : '';
            refreshPreview();
            overlay.classList.add('open');
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => textarea.focus(), 120);
        }

        function close() {
            overlay.classList.remove('open');
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('[data-role="close"]').addEventListener('click', close);
        overlay.querySelector('[data-role="cancel"]').addEventListener('click', close);
        overlay.querySelector('[data-role="clear-textarea"]').addEventListener('click', () => {
            textarea.value = '';
            refreshPreview();
            textarea.focus();
        });

        textarea.addEventListener('input', refreshPreview);

        confirmBtn.addEventListener('click', async () => {
            if (!lastResult.items || lastResult.items.length === 0) return;
            const opts = getOptionValues();
            const shouldClose = config.onImport ? await config.onImport(lastResult, opts) : true;
            if (shouldClose !== false) close();
        });

        copyBtn.addEventListener('click', async () => {
            try {
                await copyTextToClipboard(config.template || '');
                const labelSpan = copyBtn.querySelector('span');
                labelSpan.textContent = 'Copied Template!';
                clearTimeout(copyResetTimer);
                copyResetTimer = setTimeout(() => {
                    labelSpan.textContent = 'Copy Template';
                }, 1600);
                if (typeof config.onCopyTemplate === 'function') config.onCopyTemplate();
            } catch (err) {
                console.error('Copy template error:', err);
            }
        });

        if (fillSampleBtn && config.sample) {
            fillSampleBtn.addEventListener('click', () => {
                textarea.value = config.sample;
                refreshPreview();
                textarea.focus();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                e.stopImmediatePropagation();
                close();
            }
        }, true);

        return {
            overlay,
            open,
            close,
            refresh: refreshPreview,
            getLastResult: () => lastResult,
        };
    }

    const LEVEL_TONES = {
        A1: 'blue',
        A2: 'green',
        B1: 'orange',
        'B1+': 'orange',
        B2: 'pink',
        'B2+': 'pink',
        C1: 'pink',
        C2: 'pink',
    };

    /**
     * Split pasted bulk import text into distinct blocks.
     * - Ignores `//` and single `#` comment lines.
     * - Starts a new block on `---` dividers or subsequent `## Title` headings.
     * - Preserves internal blank lines so multi-paragraph passages stay whole.
     */
    function splitImportBlocks(rawText) {
        const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
        const blocks = [];
        let cur = null;

        const pushCur = () => {
            if (!cur) return;
            while (cur.lines.length && !cur.lines[0].trim()) cur.lines.shift();
            while (cur.lines.length && !cur.lines[cur.lines.length - 1].trim()) cur.lines.pop();
            if (cur.hasExplicitTitle || cur.lines.length > 0) {
                blocks.push(cur);
            }
            cur = null;
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (trimmed.startsWith('//') || (trimmed.startsWith('#') && !trimmed.startsWith('##'))) {
                continue;
            }
            if (/^-{3,}$/.test(trimmed)) {
                pushCur();
                continue;
            }
            if (trimmed.startsWith('##')) {
                if (cur && (cur.hasExplicitTitle || cur.lines.some((l) => l.trim()))) {
                    pushCur();
                }
                cur = {
                    title: trimmed.slice(2).trim(),
                    hasExplicitTitle: true,
                    lines: [],
                };
                continue;
            }
            if (!cur && !trimmed) continue;
            if (!cur) {
                cur = { title: '', hasExplicitTitle: false, lines: [] };
            }
            cur.lines.push(rawLine.replace(/\s+$/, ''));
        }
        pushCur();
        return blocks;
    }

    /**
     * Convert inline tagged passage text (e.g. `[word]` or `[A:word]`) into clean text
     * plus a per-word state array aligned with `wordRegex` tokens.
     */
    function extractTaggedSpans(rawText, tagRegex, wordRegex, mapMatch) {
        const normalized = String(rawText || '')
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
        const parts = [];
        const spans = [];
        let cleanPos = 0;
        let lastIdx = 0;

        const re = new RegExp(tagRegex.source, tagRegex.flags.includes('g') ? tagRegex.flags : tagRegex.flags + 'g');
        for (const m of normalized.matchAll(re)) {
            const plain = normalized.slice(lastIdx, m.index);
            parts.push(plain);
            cleanPos += plain.length;

            const mapped = mapMatch ? mapMatch(m) : null;
            if (mapped && typeof mapped.replacement === 'string') {
                const start = cleanPos;
                parts.push(mapped.replacement);
                cleanPos += mapped.replacement.length;
                spans.push({ start, end: cleanPos, value: mapped.value });
            } else {
                parts.push(m[0]);
                cleanPos += m[0].length;
            }
            lastIdx = m.index + m[0].length;
        }
        parts.push(normalized.slice(lastIdx));

        const rawClean = parts.join('');
        const states = [];
        const wRe = new RegExp(wordRegex.source, wordRegex.flags.includes('g') ? wordRegex.flags : wordRegex.flags + 'g');
        let spanIdx = 0;

        for (const wm of rawClean.matchAll(wRe)) {
            const wStart = wm.index;
            const wEnd = wStart + wm[0].length;
            while (spanIdx < spans.length && spans[spanIdx].end <= wStart) {
                spanIdx++;
            }
            let val = 0;
            for (let k = spanIdx; k < spans.length && spans[k].start < wEnd; k++) {
                if (wEnd > spans[k].start && wStart < spans[k].end) {
                    val = spans[k].value;
                    break;
                }
            }
            states.push(val);
        }

        const cleanText = rawClean.replace(/\n{3,}/g, '\n\n').trim();
        return { cleanText, states, tagCount: spans.length };
    }

    async function mountPresets(config) {
        const container = typeof config.container === 'string'
            ? document.querySelector(config.container)
            : config.container;
        if (!container) return null;

        const collapsible = config.collapsible !== false;
        const url = config.url || 'presets.json';
        const title = config.title || 'Starter Presets';
        const emptyText = config.emptyText || 'No presets available.';
        const maxHeightClass = config.maxHeightClass || 'max-h-44';

        let presets = [];
        let activeLevel = 'ALL';

        container.innerHTML = collapsible
            ? `
                <div class="rounded-xl border-2 border-[#1e293b]/20 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60 overflow-hidden">
                    <button type="button" data-presets-toggle aria-expanded="false"
                        class="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#1ea7fd]/5 dark:hover:bg-[#1ea7fd]/10 transition-colors cursor-pointer">
                        <span class="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#0369a1] dark:text-[#1ea7fd]">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                            <span>${escapeHtml(title)}</span>
                            <span data-presets-count class="px-1.5 py-0.5 rounded-full bg-[#1ea7fd]/15 text-[#0369a1] dark:text-[#5cc0ff] text-[10px]">0</span>
                        </span>
                        <i data-lucide="chevron-down" data-presets-chevron class="w-4 h-4 text-slate-400 transition-transform"></i>
                    </button>
                    <div data-presets-drawer class="hidden px-2.5 pb-2.5 pt-2 border-t-2 border-slate-200 dark:border-slate-700 space-y-2 animate-slide-down">
                        <div data-presets-tabs class="flex flex-wrap gap-1"></div>
                        <div data-presets-list class="grid grid-cols-1 gap-1.5 ${maxHeightClass} overflow-y-auto custom-scrollbar pr-0.5"></div>
                    </div>
                </div>
            `
            : `
                <div class="space-y-2">
                    <div data-presets-tabs class="flex flex-wrap gap-1"></div>
                    <div data-presets-list class="grid grid-cols-1 gap-1.5 ${maxHeightClass} overflow-y-auto custom-scrollbar pr-0.5"></div>
                </div>
            `;

        const toggleBtn = container.querySelector('[data-presets-toggle]');
        const drawer = container.querySelector('[data-presets-drawer]');
        const chevron = container.querySelector('[data-presets-chevron]');
        const countEl = container.querySelector('[data-presets-count]');
        const tabsEl = container.querySelector('[data-presets-tabs]');
        const listEl = container.querySelector('[data-presets-list]');

        function render() {
            if (countEl) countEl.textContent = String(presets.length);
            const levels = ['ALL', ...Array.from(new Set(presets.map((p) => p.level).filter(Boolean)))];
            tabsEl.innerHTML = levels.length > 1
                ? levels.map((lvl) => {
                    const active = lvl === activeLevel;
                    return `<button type="button" data-preset-level="${escapeHtml(lvl)}" class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border-2 transition-colors cursor-pointer ${active ? 'bg-[#1ea7fd] text-white border-[#1e293b] dark:border-slate-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-[#1ea7fd]'}">${escapeHtml(lvl)}</button>`;
                }).join('')
                : '';

            const visible = activeLevel === 'ALL'
                ? presets
                : presets.filter((p) => p.level === activeLevel);

            if (!visible.length) {
                listEl.innerHTML = `<p class="text-[11px] font-semibold text-slate-400 py-2 text-center">${escapeHtml(emptyText)}</p>`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            listEl.innerHTML = visible.map((p) => {
                const tone = BADGE_TONES[LEVEL_TONES[p.level]] || BADGE_TONES.slate;
                const meta = config.getMeta ? config.getMeta(p) : null;
                const metaHtml = meta
                    ? `<span class="text-[10px] font-bold uppercase text-slate-400 shrink-0 flex items-center gap-1">${meta.icon ? `<i data-lucide="${escapeHtml(meta.icon)}" class="w-3 h-3"></i>` : ''}${escapeHtml(meta.label || '')}</span>`
                    : '';
                return `
                    <button type="button" data-preset-id="${escapeHtml(p.id)}"
                        class="w-full text-left p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/75 hover:border-[#1ea7fd] hover:bg-[#1ea7fd]/5 dark:hover:bg-[#1ea7fd]/15 transition-colors flex items-center justify-between gap-2 group cursor-pointer">
                        <div class="flex items-center gap-2 min-w-0">
                            ${p.level ? `<span class="px-1.5 py-0.5 rounded-md border text-[10px] font-black uppercase shrink-0 ${tone}">${escapeHtml(p.level)}</span>` : ''}
                            <span class="text-xs font-extrabold truncate text-[#1e293b] dark:text-white group-hover:text-[#1ea7fd] transition-colors">${escapeHtml(p.title)}</span>
                        </div>
                        ${metaHtml}
                    </button>
                `;
            }).join('');

            if (window.lucide) window.lucide.createIcons();
        }

        if (toggleBtn && drawer) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = !drawer.classList.toggle('hidden');
                toggleBtn.setAttribute('aria-expanded', String(isOpen));
                if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
            });
        }

        tabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-preset-level]');
            if (!btn) return;
            activeLevel = btn.getAttribute('data-preset-level') || 'ALL';
            render();
        });

        listEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-preset-id]');
            if (!btn) return;
            const preset = presets.find((p) => String(p.id) === btn.getAttribute('data-preset-id'));
            if (preset && config.onSelect) config.onSelect(preset);
        });

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) presets = data;
            }
        } catch (err) {
            console.warn('Could not load presets:', err);
        }

        render();
        return { reload: render, getPresets: () => presets };
    }

    window.KlassKitBulkImport = {
        create,
        mountPresets,
        splitImportBlocks,
        extractTaggedSpans,
        LEVEL_TONES,
        escapeHtml,
    };
})();

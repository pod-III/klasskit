// ========================================================
// KLASSKIT POSTER STUDIO - SCRIPT.JS
// Pure helpers, Undo/Redo, Templates, Simple|Pro Mode,
// Cloud + IndexedDB Assets, & Zero-Flicker Canvas Renderer
// ========================================================

// --- 0. PURE HELPERS & TEST UTILITIES ---
function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsAttr(str) {
    return escapeHTML(
        String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    );
}

function makeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hydrateIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        try {
            lucide.createIcons();
        } catch (_) {}
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    while (container.children.length >= 3) {
        container.firstElementChild.remove();
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success'
        ? 'check-circle'
        : type === 'warning'
            ? 'alert-triangle'
            : type === 'info'
                ? 'info'
                : 'alert-circle';
    el.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i><span></span>`;
    el.querySelector('span').textContent = String(message);
    container.appendChild(el);
    hydrateIcons();
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        setTimeout(() => el.remove(), 240);
    }, 2500);
}

function computeFitScale(vpW, vpH, layout = 'landscape') {
    let width = 2560;
    let height = 1440;
    if (layout === 'portrait') {
        width = 1440;
        height = 2560;
    } else if (layout === 'square') {
        width = 1920;
        height = 1920;
    }
    const availW = Math.max(240, Number(vpW) - 60);
    const availH = Math.max(200, Number(vpH) - 105);
    const raw = Math.min(availW / width, availH / height);
    return Math.max(0.1, Math.min(2, Number.isFinite(raw) ? raw : 0.45));
}

const IMAGE_PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="#e2e8f0"/>' +
    '<circle cx="200" cy="135" r="24" fill="#cbd5e1"/>' +
    '<text x="50%" y="66%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="#64748b">Loading Image...</text>' +
    '</svg>'
);

const IMAGE_FALLBACK_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="#e2e8f0"/>' +
    '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#475569">Image Unavailable</text>' +
    '</svg>'
);

// --- 1. CONFIGURATION, PURE NORMALIZERS & REGISTRY ---
const CONFIG = {
    colors: ['pink', 'orange', 'green', 'blue', 'purple', 'red', 'teal', 'indigo'],
    // Explicit Tailwind utility literals so JIT builds every swatch variant reliably
    colorMap: {
        pink:   { bg: 'bg-brand-pink',   text: 'text-brand-pink',   border: 'border-brand-pink' },
        orange: { bg: 'bg-brand-orange', text: 'text-brand-orange', border: 'border-brand-orange' },
        green:  { bg: 'bg-brand-green',  text: 'text-brand-green',  border: 'border-brand-green' },
        blue:   { bg: 'bg-brand-blue',   text: 'text-brand-blue',   border: 'border-brand-blue' },
        purple: { bg: 'bg-brand-purple', text: 'text-brand-purple', border: 'border-brand-purple' },
        red:    { bg: 'bg-brand-red',    text: 'text-brand-red',    border: 'border-brand-red' },
        teal:   { bg: 'bg-brand-teal',   text: 'text-brand-teal',   border: 'border-brand-teal' },
        indigo: { bg: 'bg-brand-indigo', text: 'text-brand-indigo', border: 'border-brand-indigo' }
    },
    noteColorMap: {
        yellow: { bg: 'bg-brand-yellow', tint: 'var(--bg-brand-yellow-tint)', label: 'Yellow' },
        pink:   { bg: 'bg-brand-pink',   tint: 'var(--bg-brand-pink-tint)',   label: 'Pink' },
        blue:   { bg: 'bg-brand-blue',   tint: 'var(--bg-brand-blue-tint)',   label: 'Blue' },
        green:  { bg: 'bg-brand-green',  tint: 'var(--bg-brand-green-tint)',  label: 'Green' }
    },
    safeColor(c) { return this.colors.includes(c) ? c : 'blue'; },
    getColorClasses(c) { return this.colorMap[this.safeColor(c)]; },
    safeNoteColor(c) { return Object.prototype.hasOwnProperty.call(this.noteColorMap, c) ? c : 'yellow'; },
    getNoteColorInfo(c) { return this.noteColorMap[this.safeNoteColor(c)]; },
    sizes: {
        vocab: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl'
        },
        text: {
            auto: 'autofit-text', xs: 'text-sm leading-tight', sm: 'text-lg leading-snug', md: 'text-2xl leading-relaxed',
            lg: 'text-4xl leading-tight', xl: 'text-6xl leading-none', '2xl': 'text-7xl leading-none', '3xl': 'text-8xl leading-none'
        },
        table: {
            auto: 'autofit-text-sub', xs: 'text-xs', sm: 'text-sm', md: 'text-lg', lg: 'text-2xl',
            xl: 'text-3xl', '2xl': 'text-4xl', '3xl': 'text-5xl'
        },
        tableHead: {
            auto: 'autofit-text-badge', xs: 'text-xs', sm: 'text-sm', md: 'text-lg', lg: 'text-2xl',
            xl: 'text-3xl', '2xl': 'text-4xl', '3xl': 'text-5xl'
        },
        note: {
            auto: 'autofit-text-display', xs: 'text-xl', sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl',
            xl: 'text-8xl', '2xl': 'text-9xl', '3xl': 'text-[10rem]'
        },
        formula: {
            auto: 'autofit-text-display', xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl',
            xl: 'text-7xl', '2xl': 'text-8xl', '3xl': 'text-9xl'
        },
        formulaEx: {
            auto: 'autofit-text-sub', xs: 'text-base', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
        },
        steps: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-base', md: 'text-2xl', lg: 'text-3xl',
            xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
        },
        checklist: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
        },
        quote: {
            auto: 'autofit-text-display', xs: 'text-xl', sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl',
            xl: 'text-7xl', '2xl': 'text-8xl', '3xl': 'text-9xl'
        },
        quiz: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl',
            xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
        },
        timeline: {
            auto: 'autofit-text', xs: 'text-sm', sm: 'text-base', md: 'text-xl', lg: 'text-3xl',
            xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
        },
        comic: {
            auto: 'autofit-text-sub', xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl',
            xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
        },
        sub: {
            auto: 'autofit-text-sub', xs: 'text-xs', sm: 'text-base', md: 'text-xl', lg: 'text-3xl',
            xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
        },
        badge: {
            auto: 'autofit-text-badge', xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-xl',
            xl: 'text-2xl', '2xl': 'text-3xl', '3xl': 'text-4xl'
        },
        title: {
            auto: 'autofit-text-title', xs: 'text-lg', sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl',
            xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
        }
    },
    getSize(group, fs) {
        const g = this.sizes[group];
        return (g && (g[fs] || g.md)) || '';
    }
};

// --- PURE MODULE DATA NORMALIZERS & SERIALIZERS ---
function parseVocabItems(listStr) {
    if (!listStr) return [];
    return String(listStr)
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
            const pipeIdx = line.indexOf('|');
            if (pipeIdx !== -1) {
                return {
                    term: line.slice(0, pipeIdx).trim(),
                    def: line.slice(pipeIdx + 1).trim()
                };
            }
            return { term: line, def: '' };
        });
}

function serializeVocabItems(items) {
    return (items || [])
        .map(it => {
            const term = String(it?.term ?? '');
            const def = String(it?.def ?? '').trim();
            return def ? `${term} | ${def}` : term;
        })
        .join('\n');
}

function normalizeVocabItems(d) {
    if (Array.isArray(d?.items)) {
        return d.items.map(it => ({
            term: String(it?.term ?? ''),
            def: String(it?.def ?? '')
        }));
    }
    return parseVocabItems(d?.list || '');
}

function parseDialogueTurns(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const turns = [];
    let lastSide = 'B';
    let lastSpeaker = '';
    for (const raw of lines) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const m = trimmed.match(/^([^:]{1,24}):\s*(.*)$/);
        if (m) {
            const spk = m[1].trim();
            const body = m[2];
            let side;
            if (/^a$/i.test(spk)) side = 'A';
            else if (/^b$/i.test(spk)) side = 'B';
            else if (lastSpeaker && spk.toLowerCase() === lastSpeaker.toLowerCase()) side = lastSide;
            else side = lastSide === 'A' ? 'B' : 'A';
            lastSide = side;
            lastSpeaker = spk;
            turns.push({ speaker: spk, side, text: body });
        } else {
            const side = lastSide === 'A' ? 'B' : 'A';
            lastSide = side;
            turns.push({ speaker: side, side, text: trimmed });
        }
    }
    return turns;
}

function serializeDialogueTurns(turns) {
    return (turns || [])
        .map(t => `${(t.speaker || t.side || 'A').trim()}: ${t.text ?? ''}`)
        .join('\n');
}

function normalizeDialogueTurns(d) {
    if (Array.isArray(d?.turns)) {
        return d.turns.map(t => ({
            speaker: String(t?.speaker || t?.side || 'A'),
            side: t?.side === 'B' ? 'B' : 'A',
            text: String(t?.text ?? '')
        }));
    }
    return parseDialogueTurns(d?.text || '');
}

function normalizeDoDontPairs(d) {
    if (Array.isArray(d?.pairs) && d.pairs.length) {
        return d.pairs.map(p => ({
            wrong: String(p?.wrong ?? ''),
            correct: String(p?.correct ?? '')
        }));
    }
    return [{
        wrong: String(d?.wrong ?? ''),
        correct: String(d?.correct ?? '')
    }];
}

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            out.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}

function parseDelimitedTable(rawText) {
    const rawLines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    if (!rawLines.length) return [];

    const hasTabs = rawLines.some(l => l.includes('\t'));
    const hasPipes = !hasTabs && rawLines.some(l => l.includes('|'));
    const hasCommas = !hasTabs && !hasPipes && rawLines.some(l => l.includes(','));

    const parsed = [];
    for (const line of rawLines) {
        if (hasPipes && /^[\s|:-]+$/.test(line) && line.includes('-')) {
            continue;
        }
        let cells;
        if (hasTabs) {
            cells = line.split('\t').map(c => c.trim());
        } else if (hasPipes) {
            let trimmed = line;
            if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
            if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
            cells = trimmed.split('|').map(c => c.trim());
        } else if (hasCommas) {
            cells = parseCsvLine(line);
        } else {
            cells = line.split(/\s{2,}/).map(c => c.trim());
        }
        if (cells.length) parsed.push(cells);
    }

    if (!parsed.length) return [];
    const maxCols = Math.max(1, ...parsed.map(r => r.length));
    return parsed.map(r => {
        const copy = r.slice();
        while (copy.length < maxCols) copy.push('');
        return copy;
    });
}

function normalizeChecklistItems(d) {
    if (Array.isArray(d?.items)) {
        return d.items.map(it => ({
            text: String(it?.text ?? ''),
            done: Boolean(it?.done)
        }));
    }
    if (typeof d?.text === 'string' && d.text.trim()) {
        return parseChecklistLines(d.text);
    }
    return [];
}

function parseChecklistLines(rawText) {
    return String(rawText || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
            const checkedMatch = line.match(/^(?:[-*•]\s*)?(?:\[x\]|\(x\)|☑|✔|✓)\s*(.+)$/i);
            if (checkedMatch) return { text: checkedMatch[1].trim(), done: true };
            const uncheckedMatch = line.match(/^(?:[-*•]\s*)?(?:\[\s?\]|\(\s?\)|☐)\s*(.+)$/);
            if (uncheckedMatch) return { text: uncheckedMatch[1].trim(), done: false };
            const plain = line.replace(/^[-*•]\s+/, '').trim();
            return { text: plain, done: false };
        });
}

function serializeChecklistLines(items) {
    return (items || []).map(it => `${it.done ? '- [x]' : '- [ ]'} ${it.text}`).join('\n');
}

function normalizeSteps(d) {
    if (Array.isArray(d?.steps)) {
        return d.steps.map(s => ({
            title: String(s?.title ?? ''),
            desc: String(s?.desc ?? '')
        }));
    }
    return [];
}

function parseStepLines(rawText) {
    return String(rawText || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
            const clean = line.replace(/^(?:step\s*\d+[:.)]?|\d+[.)]|[-*])\s*/i, '').trim();
            const pipeIdx = clean.indexOf('|');
            if (pipeIdx !== -1) {
                return { title: clean.slice(0, pipeIdx).trim(), desc: clean.slice(pipeIdx + 1).trim() };
            }
            const colonIdx = clean.indexOf(':');
            if (colonIdx !== -1 && colonIdx < 48) {
                return { title: clean.slice(0, colonIdx).trim(), desc: clean.slice(colonIdx + 1).trim() };
            }
            return { title: clean, desc: '' };
        });
}

function serializeStepLines(steps) {
    return (steps || [])
        .map((s, idx) => s.desc ? `${idx + 1}. ${s.title} | ${s.desc}` : `${idx + 1}. ${s.title}`)
        .join('\n');
}

function normalizeCompare(d) {
    return {
        leftTitle: String(d?.leftTitle ?? 'Option A'),
        rightTitle: String(d?.rightTitle ?? 'Option B'),
        leftItems: Array.isArray(d?.leftItems) ? d.leftItems.map(x => String(x ?? '')) : [],
        rightItems: Array.isArray(d?.rightItems) ? d.rightItems.map(x => String(x ?? '')) : []
    };
}

function normalizeQuiz(d) {
    const options = Array.isArray(d?.options) ? d.options.map(x => String(x ?? '')) : ['Option A', 'Option B'];
    const maxIdx = Math.max(0, options.length - 1);
    const rawIdx = Number.isInteger(d?.answerIndex) ? d.answerIndex : parseInt(d?.answerIndex, 10);
    const answerIndex = Number.isFinite(rawIdx) ? Math.max(0, Math.min(maxIdx, rawIdx)) : 0;
    return {
        question: String(d?.question ?? ''),
        options,
        answerIndex,
        showAnswer: d?.showAnswer !== false
    };
}

function normalizeTimeline(d) {
    if (Array.isArray(d?.events)) {
        return d.events.map(ev => ({
            label: String(ev?.label ?? ''),
            text: String(ev?.text ?? '')
        }));
    }
    return [];
}

function parseTimelineLines(rawText) {
    return String(rawText || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
            const clean = line.replace(/^[-*•]\s*/, '').trim();
            const pipeIdx = clean.indexOf('|');
            if (pipeIdx !== -1) {
                return { label: clean.slice(0, pipeIdx).trim(), text: clean.slice(pipeIdx + 1).trim() };
            }
            const colonIdx = clean.indexOf(':');
            if (colonIdx !== -1 && colonIdx < 28) {
                return { label: clean.slice(0, colonIdx).trim(), text: clean.slice(colonIdx + 1).trim() };
            }
            return { label: '', text: clean };
        });
}

function serializeTimelineLines(events) {
    return (events || [])
        .map(ev => ev.label ? `${ev.label} | ${ev.text}` : ev.text)
        .join('\n');
}

// --- STRUCTURED EDITOR INTERACTION CONTROLLER ---
const ModuleEditors = {
    getMod(id) {
        return Store.current?.modules?.find(x => x.id === id) || null;
    },

    modeHeader(safeId, mode, title, pasteHint = '') {
        return `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
                <span class="lbl mb-0">${escapeHTML(title)}</span>
                ${mode === 'paste' && pasteHint ? `<span class="text-[10px] font-semibold text-slate-400">${escapeHTML(pasteHint)}</span>` : ''}
            </div>
            <div class="editor-mode-tabs">
                <button type="button" onclick="ModuleEditors.setMode('${safeId}','builder')"
                    class="editor-mode-tab ${mode !== 'paste' ? 'active' : ''}">Builder</button>
                <button type="button" onclick="ModuleEditors.setMode('${safeId}','paste')"
                    class="editor-mode-tab ${mode === 'paste' ? 'active' : ''}">Quick Paste</button>
            </div>
        </div>`;
    },

    setMode(id, mode) {
        Editor.inputModes[id] = mode === 'paste' ? 'paste' : 'builder';
        Editor.render(id);
    },

    handleEnter(e, fn) {
        if (e && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (typeof fn === 'function') fn();
        }
    },

    commitLive() {
        Renderer.renderPoster();
        Store.triggerSave();
    },

    commitStructural(id, focusSelector = null) {
        Editor.render(id, focusSelector);
        Renderer.renderPoster();
        Store.triggerSave();
    },

    // --- Vocab ---
    updateVocabRow(id, idx, field, val) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeVocabItems(m.data);
        if (!items[idx]) return;
        Store.markTextEditHistory();
        items[idx][field] = val;
        m.data.items = items;
        m.data.list = serializeVocabItems(items);
        this.commitLive();
    },
    addVocabRow(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const items = normalizeVocabItems(m.data);
        items.push({ term: '', def: '' });
        m.data.items = items;
        m.data.list = serializeVocabItems(items);
        this.commitStructural(id, `[data-vocab-term="${items.length - 1}"]`);
    },
    removeVocabRow(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeVocabItems(m.data);
        if (idx < 0 || idx >= items.length) return;
        App.pushHistory();
        items.splice(idx, 1);
        m.data.items = items;
        m.data.list = serializeVocabItems(items);
        this.commitStructural(id);
    },
    moveVocabRow(id, idx, dir) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeVocabItems(m.data);
        const target = idx + dir;
        if (target < 0 || target >= items.length) return;
        App.pushHistory();
        [items[idx], items[target]] = [items[target], items[idx]];
        m.data.items = items;
        m.data.list = serializeVocabItems(items);
        this.commitStructural(id);
    },
    applyVocabPaste(id, text) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        m.data.list = text;
        m.data.items = parseVocabItems(text);
        this.commitLive();
    },

    // --- Text ---
    setTextAlign(id, align) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        m.data.align = align === 'center' ? 'center' : 'left';
        this.commitStructural(id);
    },
    insertTextPrefix(id, prefix) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const cur = String(m.data.text || '');
        const sep = cur && !cur.endsWith('\n') ? '\n' : '';
        m.data.text = `${cur}${sep}${prefix} `;
        this.commitStructural(id, '#editor-text-area');
    },

    // --- Formula ---
    insertFormulaToken(id, token) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const cur = String(m.data.formula || '').trimEnd();
        m.data.formula = cur ? `${cur} ${token}` : token;
        this.commitStructural(id, '#editor-formula-input');
    },

    // --- Note ---
    setNoteColor(id, color) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        m.data.noteColor = CONFIG.safeNoteColor(color);
        this.commitStructural(id);
    },

    // --- Image & Comic ---
    setImageUrl(id, url) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        m.data.url = url;
        m.data.imageId = null;
        this.commitLive();
    },
    setImageFit(id, fit) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        m.data.fit = fit === 'contain' ? 'contain' : 'cover';
        this.commitStructural(id);
    },
    clearComicPanelImage(id, panelNum) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        delete m.data[`img${panelNum}`];
        this.commitStructural(id);
    },

    // --- Do's / Don'ts ---
    updateDoDont(id, idx, field, val) {
        const m = this.getMod(id);
        if (!m) return;
        const pairs = normalizeDoDontPairs(m.data);
        if (!pairs[idx]) return;
        Store.markTextEditHistory();
        pairs[idx][field] = val;
        m.data.pairs = pairs;
        m.data.wrong = pairs[0]?.wrong || '';
        m.data.correct = pairs[0]?.correct || '';
        this.commitLive();
    },
    addDoDont(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const pairs = normalizeDoDontPairs(m.data);
        pairs.push({ wrong: '', correct: '' });
        m.data.pairs = pairs;
        m.data.wrong = pairs[0]?.wrong || '';
        m.data.correct = pairs[0]?.correct || '';
        this.commitStructural(id, `[data-dodont-wrong="${pairs.length - 1}"]`);
    },
    removeDoDont(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const pairs = normalizeDoDontPairs(m.data);
        if (pairs.length <= 1 || idx < 0 || idx >= pairs.length) return;
        App.pushHistory();
        pairs.splice(idx, 1);
        m.data.pairs = pairs;
        m.data.wrong = pairs[0]?.wrong || '';
        m.data.correct = pairs[0]?.correct || '';
        this.commitStructural(id);
    },

    // --- Dialogue ---
    updateDialogueTurn(id, idx, field, val) {
        const m = this.getMod(id);
        if (!m) return;
        const turns = normalizeDialogueTurns(m.data);
        if (!turns[idx]) return;
        Store.markTextEditHistory();
        turns[idx][field] = val;
        m.data.turns = turns;
        m.data.text = serializeDialogueTurns(turns);
        this.commitLive();
    },
    toggleDialogueSide(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const turns = normalizeDialogueTurns(m.data);
        if (!turns[idx]) return;
        App.pushHistory();
        const nextSide = turns[idx].side === 'A' ? 'B' : 'A';
        if (turns[idx].speaker === 'A' || turns[idx].speaker === 'B' || !turns[idx].speaker) {
            turns[idx].speaker = nextSide;
        }
        turns[idx].side = nextSide;
        m.data.turns = turns;
        m.data.text = serializeDialogueTurns(turns);
        this.commitStructural(id);
    },
    addDialogueTurn(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const turns = normalizeDialogueTurns(m.data);
        const last = turns[turns.length - 1];
        const nextSide = last && last.side === 'A' ? 'B' : 'A';
        turns.push({ speaker: nextSide, side: nextSide, text: '' });
        m.data.turns = turns;
        m.data.text = serializeDialogueTurns(turns);
        this.commitStructural(id, `[data-dlg-text="${turns.length - 1}"]`);
    },
    removeDialogueTurn(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const turns = normalizeDialogueTurns(m.data);
        if (idx < 0 || idx >= turns.length) return;
        App.pushHistory();
        turns.splice(idx, 1);
        m.data.turns = turns;
        m.data.text = serializeDialogueTurns(turns);
        this.commitStructural(id);
    },
    moveDialogueTurn(id, idx, dir) {
        const m = this.getMod(id);
        if (!m) return;
        const turns = normalizeDialogueTurns(m.data);
        const target = idx + dir;
        if (target < 0 || target >= turns.length) return;
        App.pushHistory();
        [turns[idx], turns[target]] = [turns[target], turns[idx]];
        m.data.turns = turns;
        m.data.text = serializeDialogueTurns(turns);
        this.commitStructural(id);
    },
    applyDialoguePaste(id, text) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        const val = typeof text === 'string' ? text : (document.getElementById('editor-dialogue-paste')?.value || '');
        m.data.text = val;
        m.data.turns = parseDialogueTurns(val);
        this.commitLive();
    },

    // --- Checklist ---
    updateCheckItem(id, idx, val) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeChecklistItems(m.data);
        if (!items[idx]) return;
        Store.markTextEditHistory();
        items[idx].text = val;
        m.data.items = items;
        this.commitLive();
    },
    toggleCheckItem(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeChecklistItems(m.data);
        if (!items[idx]) return;
        App.pushHistory();
        items[idx].done = !items[idx].done;
        m.data.items = items;
        this.commitStructural(id);
    },
    addCheckItem(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const items = normalizeChecklistItems(m.data);
        items.push({ text: '', done: false });
        m.data.items = items;
        this.commitStructural(id, `[data-check-text="${items.length - 1}"]`);
    },
    removeCheckItem(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeChecklistItems(m.data);
        if (idx < 0 || idx >= items.length) return;
        App.pushHistory();
        items.splice(idx, 1);
        m.data.items = items;
        this.commitStructural(id);
    },
    moveCheckItem(id, idx, dir) {
        const m = this.getMod(id);
        if (!m) return;
        const items = normalizeChecklistItems(m.data);
        const target = idx + dir;
        if (target < 0 || target >= items.length) return;
        App.pushHistory();
        [items[idx], items[target]] = [items[target], items[idx]];
        m.data.items = items;
        this.commitStructural(id);
    },
    setAllChecks(id, done) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const items = normalizeChecklistItems(m.data).map(it => ({ text: it.text, done: Boolean(done) }));
        m.data.items = items;
        this.commitStructural(id);
    },
    applyChecklistPaste(id, text) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        const val = typeof text === 'string' ? text : (document.getElementById('editor-checklist-paste')?.value || '');
        m.data.items = parseChecklistLines(val);
        this.commitLive();
    },

    // --- Steps ---
    updateStep(id, idx, field, val) {
        const m = this.getMod(id);
        if (!m) return;
        const steps = normalizeSteps(m.data);
        if (!steps[idx]) return;
        Store.markTextEditHistory();
        steps[idx][field] = val;
        m.data.steps = steps;
        this.commitLive();
    },
    addStep(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const steps = normalizeSteps(m.data);
        steps.push({ title: '', desc: '' });
        m.data.steps = steps;
        this.commitStructural(id, `[data-step-title="${steps.length - 1}"]`);
    },
    removeStep(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const steps = normalizeSteps(m.data);
        if (idx < 0 || idx >= steps.length) return;
        App.pushHistory();
        steps.splice(idx, 1);
        m.data.steps = steps;
        this.commitStructural(id);
    },
    moveStep(id, idx, dir) {
        const m = this.getMod(id);
        if (!m) return;
        const steps = normalizeSteps(m.data);
        const target = idx + dir;
        if (target < 0 || target >= steps.length) return;
        App.pushHistory();
        [steps[idx], steps[target]] = [steps[target], steps[idx]];
        m.data.steps = steps;
        this.commitStructural(id);
    },
    applyStepsPaste(id, text) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        const val = typeof text === 'string' ? text : (document.getElementById('editor-steps-paste')?.value || '');
        m.data.steps = parseStepLines(val);
        this.commitLive();
    },

    // --- Compare ---
    updateCompareItem(id, side, idx, val) {
        const m = this.getMod(id);
        if (!m) return;
        const cmp = normalizeCompare(m.data);
        const key = side === 'right' ? 'rightItems' : 'leftItems';
        if (idx < 0 || idx >= cmp[key].length) return;
        Store.markTextEditHistory();
        cmp[key][idx] = val;
        m.data.leftTitle = cmp.leftTitle;
        m.data.rightTitle = cmp.rightTitle;
        m.data.leftItems = cmp.leftItems;
        m.data.rightItems = cmp.rightItems;
        this.commitLive();
    },
    addCompareItem(id, side) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const cmp = normalizeCompare(m.data);
        const key = side === 'right' ? 'rightItems' : 'leftItems';
        cmp[key].push('');
        m.data.leftTitle = cmp.leftTitle;
        m.data.rightTitle = cmp.rightTitle;
        m.data.leftItems = cmp.leftItems;
        m.data.rightItems = cmp.rightItems;
        this.commitStructural(id, `[data-cmp-${side}="${cmp[key].length - 1}"]`);
    },
    removeCompareItem(id, side, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const cmp = normalizeCompare(m.data);
        const key = side === 'right' ? 'rightItems' : 'leftItems';
        if (idx < 0 || idx >= cmp[key].length) return;
        App.pushHistory();
        cmp[key].splice(idx, 1);
        m.data.leftItems = cmp.leftItems;
        m.data.rightItems = cmp.rightItems;
        this.commitStructural(id);
    },
    swapCompareSides(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const cmp = normalizeCompare(m.data);
        m.data.leftTitle = cmp.rightTitle;
        m.data.rightTitle = cmp.leftTitle;
        m.data.leftItems = cmp.rightItems;
        m.data.rightItems = cmp.leftItems;
        this.commitStructural(id);
    },

    // --- Quiz ---
    updateQuizOption(id, idx, val) {
        const m = this.getMod(id);
        if (!m) return;
        const q = normalizeQuiz(m.data);
        if (idx < 0 || idx >= q.options.length) return;
        Store.markTextEditHistory();
        q.options[idx] = val;
        m.data.options = q.options;
        m.data.answerIndex = q.answerIndex;
        m.data.showAnswer = q.showAnswer;
        this.commitLive();
    },
    setQuizAnswer(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const q = normalizeQuiz(m.data);
        if (idx < 0 || idx >= q.options.length) return;
        App.pushHistory();
        m.data.options = q.options;
        m.data.answerIndex = idx;
        this.commitStructural(id);
    },
    addQuizOption(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const q = normalizeQuiz(m.data);
        q.options.push('');
        m.data.options = q.options;
        m.data.answerIndex = q.answerIndex;
        this.commitStructural(id, `[data-quiz-opt="${q.options.length - 1}"]`);
    },
    removeQuizOption(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const q = normalizeQuiz(m.data);
        if (q.options.length <= 2 || idx < 0 || idx >= q.options.length) return;
        App.pushHistory();
        q.options.splice(idx, 1);
        let ans = q.answerIndex;
        if (ans === idx) ans = 0;
        else if (ans > idx) ans -= 1;
        m.data.options = q.options;
        m.data.answerIndex = Math.max(0, Math.min(q.options.length - 1, ans));
        this.commitStructural(id);
    },
    toggleQuizShowAnswer(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        m.data.showAnswer = m.data.showAnswer === false;
        this.commitStructural(id);
    },

    // --- Timeline ---
    updateTimelineEvent(id, idx, field, val) {
        const m = this.getMod(id);
        if (!m) return;
        const events = normalizeTimeline(m.data);
        if (!events[idx]) return;
        Store.markTextEditHistory();
        events[idx][field] = val;
        m.data.events = events;
        this.commitLive();
    },
    addTimelineEvent(id) {
        const m = this.getMod(id);
        if (!m) return;
        App.pushHistory();
        const events = normalizeTimeline(m.data);
        events.push({ label: '', text: '' });
        m.data.events = events;
        this.commitStructural(id, `[data-tl-label="${events.length - 1}"]`);
    },
    removeTimelineEvent(id, idx) {
        const m = this.getMod(id);
        if (!m) return;
        const events = normalizeTimeline(m.data);
        if (idx < 0 || idx >= events.length) return;
        App.pushHistory();
        events.splice(idx, 1);
        m.data.events = events;
        this.commitStructural(id);
    },
    moveTimelineEvent(id, idx, dir) {
        const m = this.getMod(id);
        if (!m) return;
        const events = normalizeTimeline(m.data);
        const target = idx + dir;
        if (target < 0 || target >= events.length) return;
        App.pushHistory();
        [events[idx], events[target]] = [events[target], events[idx]];
        m.data.events = events;
        this.commitStructural(id);
    },
    applyTimelinePaste(id, text) {
        const m = this.getMod(id);
        if (!m) return;
        Store.markTextEditHistory();
        const val = typeof text === 'string' ? text : (document.getElementById('editor-timeline-paste')?.value || '');
        m.data.events = parseTimelineLines(val);
        this.commitLive();
    }
};

const ModuleRegistry = {
    vocab: {
        icon: 'list', color: 'green', label: 'Vocab', tier: 'core',
        desc: 'Key words list with optional definitions.',
        default: {
            list: 'Explore | Look closely to learn more\nObserve\nDiscover',
            items: [
                { term: 'Explore', def: 'Look closely to learn more' },
                { term: 'Observe', def: '' },
                { term: 'Discover', def: '' }
            ]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            const rawText = Array.isArray(d.items) ? serializeVocabItems(d.items) : (d.list || '');
            const header = ModuleEditors.modeHeader(safeId, mode, 'Vocabulary Words', 'Optional "Word | Meaning" per line');
            if (mode === 'paste') {
                return `${header}<textarea class="inp-area h-44 font-semibold" placeholder="Apple | Red fruit&#10;Banana | Yellow fruit" oninput="ModuleEditors.applyVocabPaste('${safeId}',this.value)">${escapeHTML(rawText)}</textarea>`;
            }
            const items = normalizeVocabItems(d);
            const rows = items.length
                ? items.map((it, idx) => `
                    <div class="editor-row">
                        <input type="text" data-vocab-term="${idx}" value="${escapeHTML(it.term)}" placeholder="Word..."
                            class="flex-1 min-w-0 bg-transparent font-body font-bold text-sm outline-none text-dark dark:text-white"
                            oninput="ModuleEditors.updateVocabRow('${safeId}',${idx},'term',this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addVocabRow('${safeId}'))">
                        <input type="text" value="${escapeHTML(it.def)}" placeholder="Meaning (optional)"
                            class="flex-1 min-w-0 bg-transparent border-l-2 border-slate-200 dark:border-slate-600 pl-2 font-body text-xs outline-none text-slate-600 dark:text-slate-300"
                            oninput="ModuleEditors.updateVocabRow('${safeId}',${idx},'def',this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addVocabRow('${safeId}'))">
                        <button type="button" aria-label="Move up" onclick="ModuleEditors.moveVocabRow('${safeId}',${idx},-1)" class="editor-mini-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Move down" onclick="ModuleEditors.moveVocabRow('${safeId}',${idx},1)" class="editor-mini-btn" ${idx === items.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Delete word" onclick="ModuleEditors.removeVocabRow('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('')
                : `<div class="text-center py-4 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">No words yet — add one below</div>`;
            return `${header}<div class="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <button type="button" onclick="ModuleEditors.addVocabRow('${safeId}')" class="btn-chunky w-full mt-3 py-2 bg-green text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Word</button>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const bulletClasses = { auto: 'w-5 h-5', xs: 'w-2.5 h-2.5', sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-6 h-6', xl: 'w-8 h-8', '2xl': 'w-10 h-10', '3xl': 'w-12 h-12' };
            const mbClasses = { auto: 'mb-2.5 gap-4', xs: 'mb-1 gap-2', sm: 'mb-1.5 gap-2.5', md: 'mb-2.5 gap-4', lg: 'mb-3.5 gap-5', xl: 'mb-4 gap-6', '2xl': 'mb-5 gap-7', '3xl': 'mb-6 gap-8' };
            const bCls = bulletClasses[fs] || bulletClasses.md;
            const itemCls = mbClasses[fs] || mbClasses.md;
            const tCls = CONFIG.getSize('vocab', fs);
            const dCls = CONFIG.getSize('sub', fs);
            const items = normalizeVocabItems(d).filter(it => it.term.trim() || it.def.trim());
            if (!items.length) {
                return `<div class="p-6 h-full flex items-center justify-center text-slate-400 font-heading font-bold uppercase ${dCls}" style="background: var(--surface-card)">Add list items</div>`;
            }
            return `<ul class="p-6 h-full flex flex-col justify-center overflow-y-auto custom-scrollbar" style="background: var(--surface-card)">${items.map(it => {
                const defHtml = it.def.trim()
                    ? `<span class="font-body font-semibold ${dCls} px-3 py-0.5 rounded-xl border border-dashed" style="background-color: var(--bg-brand-${safeC}-tint); border-color: var(--ps-border); color: var(--text-secondary)">${escapeHTML(it.def)}</span>`
                    : '';
                return `<li class="flex items-center flex-wrap ${itemCls}"><div class="${bCls} ${cls.bg} flex-shrink-0 rounded-sm" style="border: 1.5px solid var(--ps-border); box-shadow: 1px 1px 0 0 var(--ps-border)"></div><span class="font-body font-bold ${tCls}" style="color: var(--text-primary)">${escapeHTML(it.term)}</span>${defHtml}</li>`;
            }).join('')}</ul>`;
        }
    },
    text: {
        icon: 'message-square', color: 'orange', label: 'Text', tier: 'core',
        desc: 'Classroom notes, prompts, or sentence frames.',
        default: { text: 'Type your classroom notes here...', align: 'left' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const align = d.align === 'center' ? 'center' : 'left';
            return `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <label class="lbl mb-0">Text Content</label>
                <div class="flex items-center gap-1.5">
                    <div class="editor-mode-tabs">
                        <button type="button" onclick="ModuleEditors.setTextAlign('${safeId}','left')" class="editor-mode-tab ${align === 'left' ? 'active' : ''}">Left</button>
                        <button type="button" onclick="ModuleEditors.setTextAlign('${safeId}','center')" class="editor-mode-tab ${align === 'center' ? 'active' : ''}">Center</button>
                    </div>
                    <button type="button" onclick="ModuleEditors.insertTextPrefix('${safeId}','•')" class="token-chip" title="Add bullet line">+ Bullet</button>
                </div>
            </div>
            <textarea id="editor-text-area" class="inp-area h-40" oninput="Store.updateMod('${safeId}','data.text',this.value)">${escapeHTML(d.text || '')}</textarea>`;
        },
        render: (d, c, fs) => {
            const alignCls = d.align === 'center' ? 'text-center items-center' : 'text-left';
            return `<div class="p-6 font-body font-semibold whitespace-pre-line h-full flex flex-col justify-center ${alignCls} ${CONFIG.sizes.text[fs] || CONFIG.sizes.text.md}" style="background: var(--surface-card); color: var(--text-secondary)">${escapeHTML(d.text || '')}</div>`;
        }
    },
    grammar_structure: {
        icon: 'layers', color: 'blue', label: 'Formula', tier: 'core',
        desc: 'Grammar rule or math formula with examples.',
        default: { formula: 'Subject + Verb + Object', example: 'Students love creative posters.' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const tokens = ['+', 'Subject', 'Verb', 'Base Verb', 'Object', 'Adj.', 'V-ing', '→', '( )'];
            const chips = tokens.map(tok =>
                `<button type="button" onclick="ModuleEditors.insertFormulaToken('${safeId}','${escapeJsAttr(tok)}')" class="token-chip">${escapeHTML(tok)}</button>`
            ).join('');
            return `
            <label class="l">Formula</label>
            <input id="editor-formula-input" class="inp font-heading font-bold text-xl mb-2" value="${escapeHTML(d.formula || '')}" oninput="Store.updateMod('${safeId}','data.formula',this.value)">
            <div class="flex flex-wrap gap-1.5 mb-3">${chips}</div>
            <label class="l">Example Sentence(s)</label>
            <textarea class="inp-area font-hand text-xl h-24" oninput="Store.updateMod('${safeId}','data.example',this.value)">${escapeHTML(d.example || '')}</textarea>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const fCls = CONFIG.getSize('formula', fs);
            const exCls = CONFIG.getSize('formulaEx', fs);
            const exText = (d.example || '').trim();
            return `<div class="p-8 text-center h-full flex flex-col justify-center" style="background: var(--surface-card)"><div class="mb-4 font-heading font-bold ${cls.text} px-6 py-4 rounded-2xl border-2 ${cls.border} border-dashed ${fCls}" style="background-color: var(--bg-brand-${safeC}-tint)">${escapeHTML(d.formula || '')}</div>${exText ? `<p class="font-hand whitespace-pre-line ${exCls}" style="color: var(--text-secondary)">${escapeHTML(exText)}</p>` : ''}</div>`;
        }
    },
    steps: {
        icon: 'list-ordered', color: 'indigo', label: 'Steps', tier: 'core',
        desc: 'Numbered how-to steps or lesson sequence.',
        default: {
            steps: [
                { title: 'Plan', desc: 'Brainstorm your main ideas.' },
                { title: 'Draft', desc: 'Write your first version.' },
                { title: 'Review', desc: 'Check spelling and share!' }
            ]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            const steps = normalizeSteps(d);
            const header = ModuleEditors.modeHeader(safeId, mode, 'Numbered Steps', 'One step per line: "Title | Details"');
            if (mode === 'paste') {
                return `${header}<textarea id="editor-steps-paste" class="inp-area h-44" placeholder="1. Observe | Notice key details&#10;2. Predict | Make a smart guess" oninput="ModuleEditors.applyStepsPaste('${safeId}',this.value)">${escapeHTML(serializeStepLines(steps))}</textarea>`;
            }
            const rows = steps.length
                ? steps.map((s, idx) => `
                    <div class="editor-row items-start">
                        <span class="w-6 h-6 mt-1 rounded-lg bg-brand-indigo text-white font-heading font-bold text-xs flex items-center justify-center flex-shrink-0 border border-[#1e293b]">${idx + 1}</span>
                        <div class="flex-1 min-w-0 space-y-1">
                            <input type="text" data-step-title="${idx}" value="${escapeHTML(s.title)}" placeholder="Step title..."
                                class="w-full bg-transparent font-heading font-bold text-sm outline-none text-dark dark:text-white"
                                oninput="ModuleEditors.updateStep('${safeId}',${idx},'title',this.value)"
                                onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addStep('${safeId}'))">
                            <input type="text" value="${escapeHTML(s.desc)}" placeholder="Short details (optional)..."
                                class="w-full bg-transparent font-body text-xs outline-none text-slate-500 dark:text-slate-300"
                                oninput="ModuleEditors.updateStep('${safeId}',${idx},'desc',this.value)"
                                onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addStep('${safeId}'))">
                        </div>
                        <div class="flex items-center gap-1 mt-0.5">
                            <button type="button" aria-label="Move up" onclick="ModuleEditors.moveStep('${safeId}',${idx},-1)" class="editor-mini-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                            <button type="button" aria-label="Move down" onclick="ModuleEditors.moveStep('${safeId}',${idx},1)" class="editor-mini-btn" ${idx === steps.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                            <button type="button" aria-label="Delete step" onclick="ModuleEditors.removeStep('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>`).join('')
                : `<div class="text-center py-4 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">No steps yet</div>`;
            return `${header}<div class="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <button type="button" onclick="ModuleEditors.addStep('${safeId}')" class="btn-chunky w-full mt-3 py-2 bg-brand-indigo text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Step</button>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const numClasses = {
                auto: 'w-12 h-12 autofit-text-badge', xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-base',
                md: 'w-11 h-11 text-xl', lg: 'w-14 h-14 text-3xl', xl: 'w-16 h-16 text-4xl',
                '2xl': 'w-20 h-20 text-5xl', '3xl': 'w-24 h-24 text-6xl'
            };
            const nCls = numClasses[fs] || numClasses.md;
            const tCls = CONFIG.getSize('steps', fs);
            const dCls = CONFIG.getSize('sub', fs);
            const steps = normalizeSteps(d).filter(s => s.title.trim() || s.desc.trim());
            if (!steps.length) {
                return `<div class="p-6 h-full flex items-center justify-center text-slate-400 font-heading font-bold uppercase ${dCls}" style="background: var(--surface-card)">Add step items</div>`;
            }
            return `<div class="p-6 h-full flex flex-col justify-center gap-3 overflow-y-auto custom-scrollbar" style="background: var(--surface-card)">${steps.map((s, idx) => `
                <div class="flex items-center gap-4">
                    <div class="${nCls} ${cls.bg} text-white font-heading font-bold rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[3px_3px_0px_0px_var(--ps-shadow)]" style="border: 3px solid var(--ps-border)">${idx + 1}</div>
                    <div class="flex-1 min-w-0 rounded-2xl px-5 py-3 border-2" style="background-color: var(--bg-brand-${safeC}-tint); border-color: var(--ps-border)">
                        <div class="font-heading font-bold ${tCls} leading-tight" style="color: var(--text-primary)">${escapeHTML(s.title)}</div>
                        ${s.desc.trim() ? `<div class="font-body font-semibold ${dCls} mt-0.5 leading-snug" style="color: var(--text-secondary)">${escapeHTML(s.desc)}</div>` : ''}
                    </div>
                </div>`).join('')}</div>`;
        }
    },
    checklist: {
        icon: 'list-checks', color: 'green', label: 'Checklist', tier: 'core',
        desc: 'Interactive-style goals & success criteria.',
        default: {
            items: [
                { text: 'Read instructions carefully', done: true },
                { text: 'Show your work clearly', done: false },
                { text: 'Check spelling before submitting', done: false }
            ]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            const items = normalizeChecklistItems(d);
            const header = ModuleEditors.modeHeader(safeId, mode, 'Checklist Items', 'Supports "- [x] Done" and "- [ ] To do"');
            if (mode === 'paste') {
                return `${header}<textarea id="editor-checklist-paste" class="inp-area h-44" placeholder="- [x] Topic sentence&#10;- [ ] Three details" oninput="ModuleEditors.applyChecklistPaste('${safeId}',this.value)">${escapeHTML(serializeChecklistLines(items))}</textarea>`;
            }
            const rows = items.length
                ? items.map((it, idx) => `
                    <div class="editor-row">
                        <button type="button" aria-label="Toggle done" onclick="ModuleEditors.toggleCheckItem('${safeId}',${idx})"
                            class="w-7 h-7 rounded-lg border-2 border-[#1e293b] dark:border-slate-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${it.done ? 'bg-green text-white' : 'bg-white dark:bg-slate-800 text-transparent'}">
                            <i data-lucide="check" class="w-4 h-4"></i>
                        </button>
                        <input type="text" data-check-text="${idx}" value="${escapeHTML(it.text)}" placeholder="Task or goal..."
                            class="flex-1 min-w-0 bg-transparent font-body font-bold text-sm outline-none ${it.done ? 'line-through opacity-65' : ''} text-dark dark:text-white"
                            oninput="ModuleEditors.updateCheckItem('${safeId}',${idx},this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addCheckItem('${safeId}'))">
                        <button type="button" aria-label="Move up" onclick="ModuleEditors.moveCheckItem('${safeId}',${idx},-1)" class="editor-mini-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Move down" onclick="ModuleEditors.moveCheckItem('${safeId}',${idx},1)" class="editor-mini-btn" ${idx === items.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Delete task" onclick="ModuleEditors.removeCheckItem('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('')
                : `<div class="text-center py-4 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">No tasks yet</div>`;
            return `${header}<div class="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <div class="flex flex-wrap gap-2 mt-3">
                    <button type="button" onclick="ModuleEditors.addCheckItem('${safeId}')" class="btn-chunky flex-1 py-2 bg-green text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Task</button>
                    <button type="button" onclick="ModuleEditors.setAllChecks('${safeId}',true)" class="btn-chunky px-3 py-2 bg-white dark:bg-slate-700 text-dark dark:text-white text-[10px] rounded-xl">Check All</button>
                    <button type="button" onclick="ModuleEditors.setAllChecks('${safeId}',false)" class="btn-chunky px-3 py-2 bg-white dark:bg-slate-700 text-dark dark:text-white text-[10px] rounded-xl">Clear</button>
                </div>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const boxClasses = { auto: 'w-9 h-9', xs: 'w-4 h-4', sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9', xl: 'w-11 h-11', '2xl': 'w-14 h-14', '3xl': 'w-16 h-16' };
            const iconClasses = { auto: 'w-5 h-5', xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6', xl: 'w-8 h-8', '2xl': 'w-10 h-10', '3xl': 'w-12 h-12' };
            const bCls = boxClasses[fs] || boxClasses.md;
            const iCls = iconClasses[fs] || iconClasses.md;
            const tCls = CONFIG.getSize('checklist', fs);
            const emptyCls = CONFIG.getSize('sub', fs);
            const items = normalizeChecklistItems(d).filter(it => it.text.trim());
            if (!items.length) {
                return `<div class="p-6 h-full flex items-center justify-center text-slate-400 font-heading font-bold uppercase ${emptyCls}" style="background: var(--surface-card)">Add checklist items</div>`;
            }
            return `<ul class="p-6 h-full flex flex-col justify-center gap-3 overflow-y-auto custom-scrollbar" style="background: var(--surface-card)">${items.map(it => `
                <li class="flex items-center gap-4 px-4 py-2.5 rounded-2xl border-2" style="background-color: ${it.done ? `var(--bg-brand-${safeC}-tint)` : 'transparent'}; border-color: ${it.done ? 'var(--ps-border)' : 'var(--border-secondary)'}">
                    <div class="${bCls} ${it.done ? `${cls.bg} text-white` : ''} rounded-xl flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_var(--ps-shadow)]" style="border: 3px solid var(--ps-border); ${it.done ? '' : 'background: var(--surface-card)'}">
                        ${it.done ? `<i data-lucide="check" class="${iCls}"></i>` : ''}
                    </div>
                    <span class="font-body font-bold ${tCls} ${it.done ? 'line-through opacity-75' : ''}" style="color: var(--text-primary)">${escapeHTML(it.text)}</span>
                </li>`).join('')}</ul>`;
        }
    },
    table: {
        icon: 'grid-3x3', color: 'purple', label: 'Table', tier: 'core',
        desc: 'Structured grid or pasted spreadsheet table.',
        default: { content: 'Head | Head\nCell | Cell' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            if (!d.rows || !d.rows.length) {
                if (d.content) {
                    const parsedRows = parseDelimitedTable(d.content);
                    d.rows = parsedRows.length ? parsedRows : [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                } else {
                    d.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                }
            }
            const header = ModuleEditors.modeHeader(safeId, mode, 'Interactive Table Editor', 'Paste from Sheets, Excel, Markdown, or CSV');
            if (mode === 'paste') {
                const rawTable = d.rows.map(r => r.join(' | ')).join('\n');
                return `
                <div class="table-editor-container">
                    ${header}
                    <textarea id="editor-table-paste" class="inp-area h-40 mb-3 font-mono text-xs" placeholder="Subject | Verb | Example&#10;I / You | play | We play soccer.">${escapeHTML(rawTable)}</textarea>
                    <button type="button" onclick="TableEditor.applyPaste('${safeId}')" class="btn-chunky w-full py-2.5 bg-purple text-white text-xs rounded-xl gap-1.5">
                        <i data-lucide="check" class="w-4 h-4"></i> Apply Table Data
                    </button>
                </div>`;
            }
            const numCols = d.rows[0] ? d.rows[0].length : 0;
            let tableHtml = `<div class="overflow-x-auto w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl p-2 mb-3 bg-slate-50 dark:bg-slate-800/50"><table class="w-full border-collapse">`;
            d.rows.forEach((row, rIdx) => {
                tableHtml += `<tr>`;
                row.forEach((cell, cIdx) => {
                    const isHeader = rIdx === 0;
                    const inputClass = isHeader
                        ? 'w-full p-1.5 text-xs font-bold uppercase text-center border-2 border-slate-300 dark:border-slate-500 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg outline-none focus:border-blue'
                        : 'w-full p-1.5 text-xs text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg outline-none focus:border-blue';
                    tableHtml += `<td class="p-1 min-w-[100px]"><input type="text" data-tbl-cell="${rIdx}-${cIdx}" value="${escapeHTML(cell)}" class="${inputClass}" oninput="TableEditor.updateCell('${safeId}', ${rIdx}, ${cIdx}, this.value)"></td>`;
                });
                tableHtml += `</tr>`;
            });
            tableHtml += `</table></div>`;
            return `
                <div class="table-editor-container">
                    ${header}
                    ${tableHtml}
                    <div class="flex flex-wrap gap-2 justify-between items-center text-xs mt-2">
                        <div class="flex gap-2">
                            <button type="button" onclick="TableEditor.addRow('${safeId}')" class="btn-chunky px-3 py-1.5 bg-green text-white text-[10px] rounded-xl gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Row</button>
                            <button type="button" onclick="TableEditor.addCol('${safeId}')" class="btn-chunky px-3 py-1.5 bg-blue text-white text-[10px] rounded-xl gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Col</button>
                        </div>
                        <div class="flex gap-2">
                            <button type="button" onclick="TableEditor.deleteRow('${safeId}')" class="btn-chunky px-3 py-1.5 bg-pink/15 text-pink text-[10px] rounded-xl gap-1" ${d.rows.length <= 1 ? 'disabled' : ''}><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Row</button>
                            <button type="button" onclick="TableEditor.deleteCol('${safeId}')" class="btn-chunky px-3 py-1.5 bg-pink/15 text-pink text-[10px] rounded-xl gap-1" ${numCols <= 1 ? 'disabled' : ''}><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Col</button>
                        </div>
                    </div>
                </div>
            `;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            if (!d.rows || !d.rows.length) {
                if (d.content) {
                    const parsedRows = parseDelimitedTable(d.content);
                    d.rows = parsedRows.length ? parsedRows : [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                } else {
                    d.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
                }
            }
            const thCls = CONFIG.getSize('tableHead', fs);
            const tdCls = CONFIG.getSize('table', fs);
            const trs = d.rows.map((row, i) => {
                if (i === 0) return `<tr class="${cls.bg} text-white">${row.map(x => `<th class="p-3 font-heading font-bold uppercase text-center ${thCls}" style="border-bottom: 3px solid var(--ps-border); color: white;">${escapeHTML(x)}</th>`).join('')}</tr>`;
                return `<tr style="background-color: ${i % 2 === 0 ? 'transparent' : `var(--bg-brand-${safeC}-tint)`}">${row.map(x => `<td class="p-3 border font-bold ${tdCls}" style="color: var(--text-secondary); border-color: var(--ps-border)">${escapeHTML(x)}</td>`).join('')}</tr>`;
            }).join('');
            return `<div class="h-full overflow-auto custom-scrollbar" style="background: var(--surface-card)"><table class="w-full text-left border-collapse">${trs}</table></div>`;
        }
    },
    image: {
        icon: 'image', color: 'teal', label: 'Image', tier: 'core',
        desc: 'Uploaded photo, diagram, or external image URL.',
        default: { url: '', imageId: null, fit: 'cover', caption: '' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const img = Store.imgCache.get(d.imageId) || d.url;
            const fit = d.fit === 'contain' ? 'contain' : 'cover';
            return `
                <label class="l">Image Source</label>
                <div class="mb-3 relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center overflow-hidden" style="border-color: var(--ps-border); background-color: var(--ps-inset)">
                    ${img ? `<img src="${escapeHTML(img)}" class="absolute inset-0 w-full h-full object-cover opacity-55">` : ''}
                    <div class="relative z-10 flex flex-col items-center gap-2">
                        <button type="button" onclick="App.openImageSelector('${safeId}')" class="btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white text-xs px-3.5 py-2 rounded-xl gap-1.5">
                            <i data-lucide="image" class="w-4 h-4 text-pink"></i> ${img ? 'Change Image' : 'Choose / Upload Image'}
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="l">External URL</label>
                        <input class="inp text-xs" placeholder="https://..." value="${escapeHTML(d.url || '')}" oninput="ModuleEditors.setImageUrl('${safeId}',this.value)">
                    </div>
                    <div>
                        <label class="l">Image Fit</label>
                        <div class="editor-mode-tabs w-full">
                            <button type="button" onclick="ModuleEditors.setImageFit('${safeId}','cover')" class="editor-mode-tab flex-1 ${fit === 'cover' ? 'active' : ''}">Fill (Cover)</button>
                            <button type="button" onclick="ModuleEditors.setImageFit('${safeId}','contain')" class="editor-mode-tab flex-1 ${fit === 'contain' ? 'active' : ''}">Fit Whole</button>
                        </div>
                    </div>
                </div>
                <label class="l">Caption (Optional)</label>
                <input class="inp text-sm font-hand" placeholder="Label under photo..." value="${escapeHTML(d.caption || '')}" oninput="Store.updateMod('${safeId}','data.caption',this.value)">
            `;
        },
        render: (d, c, fs) => {
            const fitClass = d.fit === 'contain' ? 'object-contain p-3' : 'object-cover';
            const cap = (d.caption || '').trim();
            const cCls = CONFIG.getSize('sub', fs);
            const iconMap = { auto: 'w-16 h-16', xs: 'w-10 h-10', sm: 'w-12 h-12', md: 'w-16 h-16', lg: 'w-20 h-20', xl: 'w-24 h-24', '2xl': 'w-28 h-28', '3xl': 'w-32 h-32' };
            const icCls = iconMap[fs] || iconMap.md;
            const captionBar = cap
                ? `<div class="px-4 py-2 text-center font-hand font-bold ${cCls} flex-shrink-0" style="background: var(--surface-card); color: var(--text-primary); border-top: 3px solid var(--ps-border)">${escapeHTML(cap)}</div>`
                : '';
            if (d.imageId) {
                const src = Store.imgCache.get(d.imageId) || IMAGE_PLACEHOLDER_SVG;
                return `<div class="w-full h-full flex flex-col overflow-hidden" style="background-color: var(--bg-slate-tint)"><div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden"><img data-idb-id="${escapeHTML(d.imageId)}" src="${escapeHTML(src)}" class="w-full h-full ${fitClass}" onerror="this.onerror=null; this.src='${IMAGE_FALLBACK_SVG}'"></div>${captionBar}</div>`;
            }
            if (!d.url) {
                return `<div class="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400" style="background-color: var(--bg-slate-tint)"><i data-lucide="image" class="${icCls} opacity-50"></i><span class="font-heading font-bold ${cCls} uppercase opacity-60">Select Image</span>${cap ? `<span class="font-hand ${CONFIG.getSize('badge', fs)} opacity-80">${escapeHTML(cap)}</span>` : ''}</div>`;
            }
            return `<div class="w-full h-full flex flex-col overflow-hidden" style="background-color: var(--bg-slate-tint)"><div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden"><img src="${escapeHTML(d.url)}" class="w-full h-full ${fitClass}" onerror="this.onerror=null; this.src='${IMAGE_FALLBACK_SVG}'"></div>${captionBar}</div>`;
        }
    },
    note: {
        icon: 'sticky-note', color: 'red', label: 'Note', tier: 'core',
        desc: 'Pinned sticky note with colored paper options.',
        default: { text: 'Important reminder!', noteColor: 'yellow' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const nc = CONFIG.safeNoteColor(d.noteColor);
            const info = CONFIG.getNoteColorInfo(nc);
            const swatches = Object.entries(CONFIG.noteColorMap).map(([key, cfg]) => {
                const active = key === nc;
                return `<button type="button" aria-label="Paper ${cfg.label}" onclick="ModuleEditors.setNoteColor('${safeId}','${key}')"
                    class="w-7 h-7 rounded-lg ${cfg.bg} transition-transform cursor-pointer ${active ? 'border-[3px] border-[#1e293b] dark:border-white scale-110 shadow-[2px_2px_0px_0px_#1e293b]' : 'border-2 border-slate-300 opacity-75 hover:opacity-100'}"></button>`;
            }).join('');
            return `
            <div class="flex items-center justify-between gap-2 mb-2">
                <label class="l mb-0">Sticky Note Text</label>
                <div class="flex items-center gap-1.5">${swatches}</div>
            </div>
            <textarea class="inp-area font-hand text-xl h-28" style="background-color: ${info.tint}" oninput="Store.updateMod('${safeId}','data.text',this.value)">${escapeHTML(d.text || '')}</textarea>`;
        },
        render: (d, c, fs) => {
            const info = CONFIG.getNoteColorInfo(d.noteColor);
            return `<div class="p-8 h-full flex items-center justify-center relative" style="background-color: ${info.tint}"><div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-brand-red shadow-sm -mt-3 z-10" style="border: 2px solid var(--ps-border)"></div><p class="font-hand text-center leading-normal rotate-1 whitespace-pre-line ${CONFIG.sizes.note[fs] || CONFIG.sizes.note.md}" style="color: var(--text-primary)">${escapeHTML(d.text || '')}</p></div>`;
        }
    },
    dodont: {
        icon: 'shield-alert', color: 'red', label: "Do's/Don'ts", tier: 'more',
        desc: 'Side-by-side common mistake & correct usage pairs.',
        default: {
            wrong: 'I go to home.',
            correct: 'I go home.',
            pairs: [{ wrong: 'I go to home.', correct: 'I go home.' }]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const pairs = normalizeDoDontPairs(d);
            const rows = pairs.map((p, idx) => `
                <div class="p-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 space-y-2" style="background: var(--ps-inset)">
                    <div class="flex items-center justify-between">
                        <span class="lbl mb-0">Pair ${idx + 1}</span>
                        ${pairs.length > 1 ? `<button type="button" aria-label="Delete pair" onclick="ModuleEditors.removeDoDont('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label class="l text-red-500">Don't Say</label>
                            <textarea data-dodont-wrong="${idx}" class="inp-area h-16 text-xs" style="background-color: var(--bg-brand-red-tint)" oninput="ModuleEditors.updateDoDont('${safeId}',${idx},'wrong',this.value)">${escapeHTML(p.wrong)}</textarea>
                        </div>
                        <div>
                            <label class="l text-green-500">Do Say</label>
                            <textarea class="inp-area h-16 text-xs" style="background-color: var(--bg-brand-green-tint)" oninput="ModuleEditors.updateDoDont('${safeId}',${idx},'correct',this.value)">${escapeHTML(p.correct)}</textarea>
                        </div>
                    </div>
                </div>`).join('');
            return `<div class="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <button type="button" onclick="ModuleEditors.addDoDont('${safeId}')" class="btn-chunky w-full mt-3 py-2 bg-red-500 text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Pair</button>`;
        },
        render: (d, c, fs) => {
            const fontClasses = {
                auto: 'autofit-text-display', xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl'
            };
            const multiFont = {
                auto: 'autofit-text', xs: 'text-sm', sm: 'text-base', md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl', '2xl': 'text-5xl', '3xl': 'text-6xl'
            };
            const iconClasses = { auto: 'w-5 h-5', xs: 'w-3.5 h-3.5', sm: 'w-4 h-4', md: 'w-4 h-4', lg: 'w-5 h-5', xl: 'w-6 h-6', '2xl': 'w-7 h-7', '3xl': 'w-8 h-8' };
            const fCls = fontClasses[fs] || fontClasses.md;
            const hCls = CONFIG.getSize('badge', fs);
            const iCls = iconClasses[fs] || iconClasses.md;
            const pairs = normalizeDoDontPairs(d);
            if (pairs.length <= 1) {
                const p = pairs[0] || { wrong: '', correct: '' };
                return `
                <div class="h-full flex flex-col">
                    <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-red-tint); border-bottom: 2px solid var(--ps-border)">
                        <div class="absolute top-2.5 left-2.5 p-1 bg-brand-red text-white rounded-lg shadow-sm border border-[#1e293b]"><i data-lucide="x" class="${iCls}"></i></div>
                        <p class="font-heading font-bold text-brand-red opacity-85 ${hCls} uppercase tracking-widest mb-1">DON'T</p>
                        <p class="font-hand ${fCls} line-through decoration-brand-red decoration-4" style="color: var(--text-primary)">${escapeHTML(p.wrong)}</p>
                    </div>
                    <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-green-tint)">
                        <div class="absolute top-2.5 left-2.5 p-1 bg-brand-green text-white rounded-lg shadow-sm border border-[#1e293b]"><i data-lucide="check" class="${iCls}"></i></div>
                        <p class="font-heading font-bold text-brand-green opacity-90 ${hCls} uppercase tracking-widest mb-1">DO</p>
                        <p class="font-hand ${fCls}" style="color: var(--text-primary)">${escapeHTML(p.correct)}</p>
                    </div>
                </div>`;
            }
            const mfCls = multiFont[fs] || multiFont.md;
            const bodyRows = pairs.map((p, idx) => `
                <div class="grid grid-cols-2 flex-1 min-h-0" style="${idx > 0 ? 'border-top: 2px solid var(--ps-border);' : ''}">
                    <div class="p-3.5 flex items-center gap-2.5" style="background-color: var(--bg-brand-red-tint); border-right: 2px solid var(--ps-border)">
                        <div class="p-1 bg-brand-red text-white rounded-lg border border-[#1e293b] flex-shrink-0"><i data-lucide="x" class="${iCls}"></i></div>
                        <span class="font-hand ${mfCls} line-through decoration-brand-red decoration-2" style="color: var(--text-primary)">${escapeHTML(p.wrong)}</span>
                    </div>
                    <div class="p-3.5 flex items-center gap-2.5" style="background-color: var(--bg-brand-green-tint)">
                        <div class="p-1 bg-brand-green text-white rounded-lg border border-[#1e293b] flex-shrink-0"><i data-lucide="check" class="${iCls}"></i></div>
                        <span class="font-hand ${mfCls}" style="color: var(--text-primary)">${escapeHTML(p.correct)}</span>
                    </div>
                </div>`).join('');
            return `<div class="h-full flex flex-col overflow-y-auto custom-scrollbar">
                <div class="grid grid-cols-2 text-center font-heading font-bold uppercase ${hCls} flex-shrink-0" style="border-bottom: 2px solid var(--ps-border)">
                    <div class="py-1.5 text-brand-red" style="background-color: var(--bg-brand-red-tint); border-right: 2px solid var(--ps-border)">DON'T</div>
                    <div class="py-1.5 text-brand-green" style="background-color: var(--bg-brand-green-tint)">DO</div>
                </div>
                <div class="flex-1 flex flex-col">${bodyRows}</div>
            </div>`;
        }
    },
    dialogue: {
        icon: 'message-circle', color: 'teal', label: 'Dialogue', tier: 'more',
        desc: 'Two-speaker roleplay chat bubbles.',
        default: {
            text: 'A: Good morning!\nB: Hello! Ready to learn?\nA: Yes, let us begin!',
            turns: [
                { speaker: 'A', side: 'A', text: 'Good morning!' },
                { speaker: 'B', side: 'B', text: 'Hello! Ready to learn?' },
                { speaker: 'A', side: 'A', text: 'Yes, let us begin!' }
            ]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            const turns = normalizeDialogueTurns(d);
            const header = ModuleEditors.modeHeader(safeId, mode, 'Speaker Turns', 'Start lines with A:, B:, or Speaker Name:');
            if (mode === 'paste') {
                return `${header}<textarea id="editor-dialogue-paste" class="inp-area h-44" placeholder="A: Hello!&#10;B: Hi there!" oninput="ModuleEditors.applyDialoguePaste('${safeId}',this.value)">${escapeHTML(serializeDialogueTurns(turns))}</textarea>`;
            }
            const rows = turns.length
                ? turns.map((t, idx) => `
                    <div class="editor-row">
                        <button type="button" title="Swap left/right speaker bubble" onclick="ModuleEditors.toggleDialogueSide('${safeId}',${idx})"
                            class="w-7 h-7 rounded-lg font-heading font-bold text-xs text-white border-2 border-[#1e293b] flex-shrink-0 cursor-pointer ${t.side === 'B' ? 'bg-blue' : 'bg-pink'}">${escapeHTML(t.side)}</button>
                        <input type="text" value="${escapeHTML(t.speaker)}" placeholder="Name"
                            class="w-20 bg-transparent font-heading font-bold text-xs outline-none text-slate-600 dark:text-slate-300 border-r-2 border-slate-200 dark:border-slate-600 pr-1.5"
                            oninput="ModuleEditors.updateDialogueTurn('${safeId}',${idx},'speaker',this.value)">
                        <input type="text" data-dlg-text="${idx}" value="${escapeHTML(t.text)}" placeholder="Speech bubble text..."
                            class="flex-1 min-w-0 bg-transparent font-body font-bold text-sm outline-none text-dark dark:text-white"
                            oninput="ModuleEditors.updateDialogueTurn('${safeId}',${idx},'text',this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addDialogueTurn('${safeId}'))">
                        <button type="button" aria-label="Move up" onclick="ModuleEditors.moveDialogueTurn('${safeId}',${idx},-1)" class="editor-mini-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Move down" onclick="ModuleEditors.moveDialogueTurn('${safeId}',${idx},1)" class="editor-mini-btn" ${idx === turns.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Delete turn" onclick="ModuleEditors.removeDialogueTurn('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('')
                : `<div class="text-center py-4 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">No turns yet</div>`;
            return `${header}<div class="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <button type="button" onclick="ModuleEditors.addDialogueTurn('${safeId}')" class="btn-chunky w-full mt-3 py-2 bg-brand-teal text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Turn</button>`;
        },
        render: (d, c, fs) => {
            const bCls = CONFIG.getSize('text', fs);
            const spkCls = CONFIG.getSize('badge', fs);
            const emptyCls = CONFIG.getSize('sub', fs);
            const turns = normalizeDialogueTurns(d).filter(t => t.text.trim());
            const bubbles = turns.map(t => {
                const isB = t.side === 'B';
                const spk = (t.speaker || '').trim();
                const showName = spk && !/^[ab]$/i.test(spk);
                const nameTag = showName
                    ? `<div class="font-heading font-bold ${spkCls} uppercase tracking-wider mb-1 ${isB ? 'text-right text-brand-blue' : 'text-left text-brand-pink'}">${escapeHTML(spk)}</div>`
                    : '';
                return `<div class="flex flex-col w-full mb-3 ${isB ? 'items-end' : 'items-start'}">
                    ${nameTag}
                    <div class="${isB ? 'bg-brand-blue text-white rounded-br-none' : 'bg-brand-pink text-white rounded-bl-none'} px-6 py-3 rounded-3xl border-[2.5px] border-[#1e293b] shadow-[3px_3px_0px_0px_#1e293b] max-w-[84%] font-body font-bold ${bCls}">${escapeHTML(t.text)}</div>
                </div>`;
            }).join('');
            return `<div class="p-6 h-full flex flex-col justify-center overflow-y-auto custom-scrollbar bg-graph-paper" style="background-color: var(--surface-card)">${bubbles || `<div class="text-center text-slate-400 font-heading font-bold uppercase ${emptyCls}">Add dialogue lines</div>`}</div>`;
        }
    },
    compare: {
        icon: 'columns-2', color: 'purple', label: 'Compare', tier: 'more',
        desc: 'Two-column comparison or vs card.',
        default: {
            leftTitle: 'Past Tense',
            rightTitle: 'Present Tense',
            leftItems: ['walked', 'played', 'visited'],
            rightItems: ['walk', 'play', 'visit']
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const cmp = normalizeCompare(d);
            const mkCol = (side, titleKey, items, tintVar, accentBg) => {
                const rows = items.map((val, idx) => `
                    <div class="editor-row">
                        <input type="text" data-cmp-${side}="${idx}" value="${escapeHTML(val)}" placeholder="Point..."
                            class="flex-1 min-w-0 bg-transparent font-body font-bold text-xs outline-none text-dark dark:text-white"
                            oninput="ModuleEditors.updateCompareItem('${safeId}','${side}',${idx},this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addCompareItem('${safeId}','${side}'))">
                        <button type="button" aria-label="Delete item" onclick="ModuleEditors.removeCompareItem('${safeId}','${side}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('');
                return `
                <div class="p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex flex-col gap-2" style="background-color: ${tintVar}">
                    <input type="text" value="${escapeHTML(cmp[titleKey])}" placeholder="Column Header"
                        class="inp font-heading font-bold text-sm uppercase text-dark dark:text-white"
                        oninput="Store.updateMod('${safeId}','data.${titleKey}',this.value)">
                    <div class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">${rows}</div>
                    <button type="button" onclick="ModuleEditors.addCompareItem('${safeId}','${side}')" class="btn-chunky py-1.5 ${accentBg} text-white text-[10px] rounded-xl gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Add</button>
                </div>`;
            };
            return `
            <div class="flex items-center justify-between mb-2.5">
                <label class="lbl mb-0">Side-by-Side Columns</label>
                <button type="button" onclick="ModuleEditors.swapCompareSides('${safeId}')" class="btn-chunky px-2.5 py-1 bg-white dark:bg-slate-700 text-dark dark:text-white text-[10px] rounded-lg gap-1"><i data-lucide="arrow-left-right" class="w-3 h-3"></i> Swap Sides</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${mkCol('left', 'leftTitle', cmp.leftItems, 'var(--bg-brand-blue-tint)', 'bg-blue')}
                ${mkCol('right', 'rightTitle', cmp.rightItems, 'var(--bg-brand-orange-tint)', 'bg-orange')}
            </div>`;
        },
        render: (d, c, fs) => {
            const cmp = normalizeCompare(d);
            const hCls = CONFIG.getSize('title', fs);
            const iCls = CONFIG.getSize('vocab', fs);
            const vsCls = CONFIG.getSize('badge', fs);
            const dotSizes = { auto: 'w-3.5 h-3.5', xs: 'w-2 h-2', sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-4 h-4', xl: 'w-5 h-5', '2xl': 'w-5 h-5', '3xl': 'w-6 h-6' };
            const dCls = dotSizes[fs] || dotSizes.md;
            const mkList = (items, dotBg) => items.filter(x => x.trim()).map(x =>
                `<li class="flex items-center gap-2.5"><span class="${dCls} rounded-full ${dotBg} flex-shrink-0" style="border: 1.5px solid var(--ps-border)"></span><span class="font-body font-bold ${iCls}" style="color: var(--text-primary)">${escapeHTML(x)}</span></li>`
            ).join('');
            return `
            <div class="h-full grid grid-cols-2 relative overflow-hidden">
                <div class="p-5 flex flex-col" style="background-color: var(--bg-brand-blue-tint); border-right: 3px solid var(--ps-border)">
                    <h4 class="font-heading font-bold uppercase text-brand-blue ${hCls} text-center pb-2 mb-3" style="border-bottom: 2px dashed var(--ps-border)">${escapeHTML(cmp.leftTitle)}</h4>
                    <ul class="space-y-2 flex-1 flex flex-col justify-center">${mkList(cmp.leftItems, 'bg-brand-blue')}</ul>
                </div>
                <div class="p-5 flex flex-col" style="background-color: var(--bg-brand-orange-tint)">
                    <h4 class="font-heading font-bold uppercase text-brand-orange ${hCls} text-center pb-2 mb-3" style="border-bottom: 2px dashed var(--ps-border)">${escapeHTML(cmp.rightTitle)}</h4>
                    <ul class="space-y-2 flex-1 flex flex-col justify-center">${mkList(cmp.rightItems, 'bg-brand-orange')}</ul>
                </div>
                <div class="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-yellow text-brand-dark font-heading font-bold ${vsCls} border-2 shadow-[2px_2px_0px_0px_var(--ps-shadow)]" style="border-color: var(--ps-border)">VS</div>
            </div>`;
        }
    },
    quiz: {
        icon: 'help-circle', color: 'orange', label: 'Quiz', tier: 'more',
        desc: 'Multiple-choice check with toggleable answer.',
        default: {
            question: 'Which planet is known as the Red Planet?',
            options: ['Venus', 'Mars', 'Jupiter'],
            answerIndex: 1,
            showAnswer: true
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const q = normalizeQuiz(d);
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const rows = q.options.map((opt, idx) => {
                const isAns = idx === q.answerIndex;
                const letter = letters[idx] || String(idx + 1);
                return `
                <div class="editor-row">
                    <button type="button" title="Mark as correct answer" onclick="ModuleEditors.setQuizAnswer('${safeId}',${idx})"
                        class="w-7 h-7 rounded-lg font-heading font-bold text-xs border-2 border-[#1e293b] dark:border-slate-500 flex-shrink-0 cursor-pointer transition-colors ${isAns ? 'bg-green text-white' : 'bg-white dark:bg-slate-800 text-dark dark:text-white'}">${letter}</button>
                    <input type="text" data-quiz-opt="${idx}" value="${escapeHTML(opt)}" placeholder="Choice ${letter}..."
                        class="flex-1 min-w-0 bg-transparent font-body font-bold text-sm outline-none text-dark dark:text-white"
                        oninput="ModuleEditors.updateQuizOption('${safeId}',${idx},this.value)"
                        onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addQuizOption('${safeId}'))">
                    <button type="button" aria-label="Delete choice" onclick="ModuleEditors.removeQuizOption('${safeId}',${idx})" class="editor-mini-btn hover:text-pink" ${q.options.length <= 2 ? 'disabled' : ''}><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>`;
            }).join('');
            return `
            <label class="l">Question Prompt</label>
            <textarea class="inp-area h-20 mb-3 font-heading font-bold" oninput="Store.updateMod('${safeId}','data.question',this.value)">${escapeHTML(q.question)}</textarea>
            <div class="flex items-center justify-between mb-1.5">
                <label class="lbl mb-0">Choices (Click letter to set correct answer)</label>
            </div>
            <div class="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
            <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" onclick="ModuleEditors.addQuizOption('${safeId}')" class="btn-chunky flex-1 py-2 bg-orange text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Choice</button>
                <button type="button" onclick="ModuleEditors.toggleQuizShowAnswer('${safeId}')" class="btn-chunky px-3 py-2 text-xs rounded-xl gap-1.5 ${q.showAnswer ? 'bg-green text-white' : 'bg-white dark:bg-slate-700 text-dark dark:text-white'}">
                    <i data-lucide="${q.showAnswer ? 'eye' : 'eye-off'}" class="w-4 h-4"></i> ${q.showAnswer ? 'Answer Shown' : 'Answer Hidden'}
                </button>
            </div>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const q = normalizeQuiz(d);
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const qCls = CONFIG.getSize('quiz', fs);
            const oCls = CONFIG.getSize('sub', fs);
            const badgeCls = CONFIG.getSize('badge', fs);
            const letterBoxes = {
                auto: 'w-10 h-10 autofit-text-badge', xs: 'w-6 h-6 text-xs', sm: 'w-7 h-7 text-sm',
                md: 'w-9 h-9 text-base', lg: 'w-11 h-11 text-xl', xl: 'w-12 h-12 text-2xl',
                '2xl': 'w-14 h-14 text-3xl', '3xl': 'w-16 h-16 text-4xl'
            };
            const checkIcons = { auto: 'w-6 h-6', xs: 'w-4 h-4', sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7', xl: 'w-8 h-8', '2xl': 'w-10 h-10', '3xl': 'w-12 h-12' };
            const lbCls = letterBoxes[fs] || letterBoxes.md;
            const ckCls = checkIcons[fs] || checkIcons.md;
            const colsClass = q.options.length >= 3 ? 'grid-cols-2' : 'grid-cols-1';
            const cards = q.options.map((opt, idx) => {
                const isCorrect = q.showAnswer && idx === q.answerIndex;
                const letter = letters[idx] || String(idx + 1);
                return `
                <div class="px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-3 ${isCorrect ? 'bg-brand-green text-white shadow-[3px_3px_0px_0px_var(--ps-shadow)]' : ''}"
                    style="border-color: var(--ps-border); ${isCorrect ? '' : 'background: var(--surface-card); color: var(--text-primary);'}">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="${lbCls} rounded-xl font-heading font-bold flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-white text-slate-900' : `${cls.bg} text-white`}" style="border: 2px solid var(--ps-border)">${letter}</span>
                        <span class="font-body font-bold ${oCls} leading-snug">${escapeHTML(opt)}</span>
                    </div>
                    ${isCorrect ? `<i data-lucide="check-circle" class="${ckCls} flex-shrink-0"></i>` : ''}
                </div>`;
            }).join('');
            return `
            <div class="h-full flex flex-col" style="background: var(--surface-card)">
                <div class="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style="background-color: var(--bg-brand-${safeC}-tint); border-bottom: 3px solid var(--ps-border)">
                    <p class="font-heading font-bold ${qCls} leading-tight" style="color: var(--text-primary)">${escapeHTML(q.question)}</p>
                    ${!q.showAnswer ? `<span class="px-2.5 py-1 rounded-full bg-brand-yellow text-brand-dark font-heading font-bold ${badgeCls} uppercase border-2 flex-shrink-0" style="border-color: var(--ps-border)">Quiz</span>` : ''}
                </div>
                <div class="p-5 flex-1 grid ${colsClass} gap-3 content-center overflow-y-auto custom-scrollbar">${cards}</div>
            </div>`;
        }
    },
    timeline: {
        icon: 'clock', color: 'blue', label: 'Timeline', tier: 'more',
        desc: 'Chronological events or daily schedule track.',
        default: {
            events: [
                { label: 'Morning', text: 'Warm-up & phonics' },
                { label: 'Midday', text: 'Guided reading groups' },
                { label: 'Afternoon', text: 'Project showcase' }
            ]
        },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mode = Editor.inputModes[id] === 'paste' ? 'paste' : 'builder';
            const events = normalizeTimeline(d);
            const header = ModuleEditors.modeHeader(safeId, mode, 'Timeline Milestones', 'Format per line: "Time/Date | Event"');
            if (mode === 'paste') {
                return `${header}<textarea id="editor-timeline-paste" class="inp-area h-44" placeholder="1903 | First powered flight&#10;1969 | Apollo 11 moon landing" oninput="ModuleEditors.applyTimelinePaste('${safeId}',this.value)">${escapeHTML(serializeTimelineLines(events))}</textarea>`;
            }
            const rows = events.length
                ? events.map((ev, idx) => `
                    <div class="editor-row">
                        <input type="text" data-tl-label="${idx}" value="${escapeHTML(ev.label)}" placeholder="Date/Label"
                            class="w-24 sm:w-28 bg-transparent font-heading font-bold text-xs outline-none text-blue border-r-2 border-slate-200 dark:border-slate-600 pr-2"
                            oninput="ModuleEditors.updateTimelineEvent('${safeId}',${idx},'label',this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addTimelineEvent('${safeId}'))">
                        <input type="text" value="${escapeHTML(ev.text)}" placeholder="Milestone event..."
                            class="flex-1 min-w-0 bg-transparent font-body font-bold text-sm outline-none text-dark dark:text-white"
                            oninput="ModuleEditors.updateTimelineEvent('${safeId}',${idx},'text',this.value)"
                            onkeydown="ModuleEditors.handleEnter(event, ()=>ModuleEditors.addTimelineEvent('${safeId}'))">
                        <button type="button" aria-label="Move up" onclick="ModuleEditors.moveTimelineEvent('${safeId}',${idx},-1)" class="editor-mini-btn" ${idx === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Move down" onclick="ModuleEditors.moveTimelineEvent('${safeId}',${idx},1)" class="editor-mini-btn" ${idx === events.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        <button type="button" aria-label="Delete milestone" onclick="ModuleEditors.removeTimelineEvent('${safeId}',${idx})" class="editor-mini-btn hover:text-pink"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('')
                : `<div class="text-center py-4 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">No milestones yet</div>`;
            return `${header}<div class="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">${rows}</div>
                <button type="button" onclick="ModuleEditors.addTimelineEvent('${safeId}')" class="btn-chunky w-full mt-3 py-2 bg-blue text-white text-xs rounded-xl gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Add Milestone</button>`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const events = normalizeTimeline(d).filter(ev => ev.label.trim() || ev.text.trim());
            const tCls = CONFIG.getSize('timeline', fs);
            const lblCls = CONFIG.getSize('badge', fs);
            const emptyCls = CONFIG.getSize('sub', fs);
            const nodeSizes = {
                auto: 'w-12 h-12 autofit-text-badge', xs: 'w-7 h-7 text-xs', sm: 'w-8 h-8 text-sm',
                md: 'w-10 h-10 text-lg', lg: 'w-12 h-12 text-xl', xl: 'w-14 h-14 text-2xl',
                '2xl': 'w-16 h-16 text-3xl', '3xl': 'w-20 h-20 text-4xl'
            };
            const lineTops = { auto: 'top-6', xs: 'top-3.5', sm: 'top-4', md: 'top-5', lg: 'top-6', xl: 'top-7', '2xl': 'top-8', '3xl': 'top-10' };
            const nCls = nodeSizes[fs] || nodeSizes.md;
            const topCls = lineTops[fs] || lineTops.md;
            if (!events.length) {
                return `<div class="p-6 h-full flex items-center justify-center text-slate-400 font-heading font-bold uppercase ${emptyCls}" style="background: var(--surface-card)">Add timeline events</div>`;
            }
            if (events.length <= 4) {
                return `
                <div class="p-6 h-full flex items-center justify-center relative" style="background: var(--surface-card)">
                    <div class="w-full relative flex items-start justify-between gap-4">
                        <div class="absolute left-8 right-8 ${topCls} h-1.5 rounded-full" style="background-color: var(--ps-border)"></div>
                        ${events.map((ev, idx) => `
                        <div class="flex-1 min-w-0 flex flex-col items-center text-center relative z-10">
                            <div class="${nCls} rounded-full ${cls.bg} text-white font-heading font-bold flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_var(--ps-shadow)]" style="border: 3px solid var(--ps-border)">${idx + 1}</div>
                            ${ev.label.trim() ? `<span class="px-3 py-1 rounded-full font-heading font-bold ${lblCls} uppercase mb-2" style="background-color: var(--bg-brand-${safeC}-tint); border: 2px solid var(--ps-border); color: var(--text-primary)">${escapeHTML(ev.label)}</span>` : ''}
                            <p class="font-body font-bold ${tCls} leading-snug" style="color: var(--text-primary)">${escapeHTML(ev.text)}</p>
                        </div>`).join('')}
                    </div>
                </div>`;
            }
            return `
            <div class="p-6 h-full flex flex-col justify-center gap-3 overflow-y-auto custom-scrollbar" style="background: var(--surface-card)">
                ${events.map((ev, idx) => `
                <div class="flex items-center gap-3.5">
                    <div class="${nCls} rounded-full ${cls.bg} text-white font-heading font-bold flex items-center justify-center flex-shrink-0" style="border: 2.5px solid var(--ps-border)">${idx + 1}</div>
                    ${ev.label.trim() ? `<span class="px-2.5 py-0.5 rounded-lg font-heading font-bold ${lblCls} uppercase flex-shrink-0" style="background-color: var(--bg-brand-${safeC}-tint); border: 2px solid var(--ps-border); color: var(--text-primary)">${escapeHTML(ev.label)}</span>` : ''}
                    <span class="font-body font-bold ${tCls} leading-snug" style="color: var(--text-primary)">${escapeHTML(ev.text)}</span>
                </div>`).join('')}
            </div>`;
        }
    },
    quote: {
        icon: 'quote', color: 'pink', label: 'Quote', tier: 'more',
        desc: 'Highlight banner with quote marks & author badge.',
        default: { quote: 'Mistakes are proof that you are trying.', author: 'Classroom Motto', style: 'hand' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const style = d.style === 'bold' ? 'bold' : 'hand';
            return `
            <div class="flex items-center justify-between gap-2 mb-2">
                <label class="l mb-0">Quote Text</label>
                <div class="editor-mode-tabs">
                    <button type="button" onclick="App.pushHistory(); Store.updateMod('${safeId}','data.style','hand'); Editor.render('${safeId}')" class="editor-mode-tab ${style === 'hand' ? 'active' : ''}">Handwritten</button>
                    <button type="button" onclick="App.pushHistory(); Store.updateMod('${safeId}','data.style','bold'); Editor.render('${safeId}')" class="editor-mode-tab ${style === 'bold' ? 'active' : ''}">Bold Display</button>
                </div>
            </div>
            <textarea class="inp-area h-24 mb-3 font-hand text-xl" oninput="Store.updateMod('${safeId}','data.quote',this.value)">${escapeHTML(d.quote || '')}</textarea>
            <label class="l">Author / Source</label>
            <input class="inp font-heading font-bold text-sm" placeholder="Optional attribution..." value="${escapeHTML(d.author || '')}" oninput="Store.updateMod('${safeId}','data.author',this.value)">`;
        },
        render: (d, c, fs) => {
            const safeC = CONFIG.safeColor(c);
            const cls = CONFIG.getColorClasses(safeC);
            const qFont = d.style === 'bold' ? 'font-heading font-bold uppercase' : 'font-hand';
            const qSize = CONFIG.getSize('quote', fs);
            const authSize = CONFIG.getSize('sub', fs);
            const markSizes = { auto: 'w-20 h-20', xs: 'w-12 h-12', sm: 'w-16 h-16', md: 'w-20 h-20', lg: 'w-24 h-24', xl: 'w-28 h-28', '2xl': 'w-32 h-32', '3xl': 'w-36 h-36' };
            const mCls = markSizes[fs] || markSizes.md;
            const quoteText = (d.quote || '').trim();
            const author = (d.author || '').trim();
            return `
            <div class="p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden" style="background-color: var(--bg-brand-${safeC}-tint)">
                <i data-lucide="quote" class="${mCls} ${cls.text} opacity-20 absolute top-4 left-6 pointer-events-none"></i>
                ${quoteText
                    ? `<p class="${qFont} ${qSize} leading-tight max-w-[92%] relative z-10" style="color: var(--text-primary)">"${escapeHTML(quoteText)}"</p>`
                    : `<p class="${qFont} ${qSize} opacity-45 leading-tight max-w-[92%] relative z-10" style="color: var(--text-primary)">Add your quote...</p>`}
                ${author ? `<div class="mt-4 px-5 py-1.5 rounded-full bg-brand-yellow text-slate-900 font-heading font-bold ${authSize} uppercase border-2 shadow-[3px_3px_0px_0px_var(--ps-shadow)] -rotate-1" style="border-color: var(--ps-border)">— ${escapeHTML(author)}</div>` : ''}
            </div>`;
        }
    },
    comic: {
        icon: 'film', color: 'pink', label: 'Comic', tier: 'more',
        desc: 'Three-panel storyboard strip with images & captions.',
        default: { cap1: 'First...', cap2: 'Then...', cap3: 'Finally!' },
        inputs: (id, d) => {
            const safeId = escapeJsAttr(id);
            const mkPanel = (n) => {
                const imgId = d[`img${n}`];
                const img = imgId ? (Store.imgCache.get(imgId) || '') : '';
                return `
                <div class="p-2.5 rounded-xl mb-2 border-2" style="background-color: var(--ps-inset); border-color: var(--border-secondary)">
                    <div class="flex items-center justify-between mb-1">
                        <label class="l mb-0">Panel ${n}</label>
                        ${imgId ? `<button type="button" onclick="ModuleEditors.clearComicPanelImage('${safeId}',${n})" class="text-[10px] font-heading font-bold text-pink hover:underline cursor-pointer">Clear Image</button>` : ''}
                    </div>
                    <div class="flex gap-2 h-16">
                        <div onclick="App.openImageSelector('${safeId}', 'img${n}')" class="w-16 h-16 border-2 rounded-xl cursor-pointer flex items-center justify-center overflow-hidden hover:border-blue relative group flex-shrink-0" style="background-color: var(--ps-card); border-color: var(--border-secondary)">
                            ${img ? `<img src="${escapeHTML(img)}" class="w-full h-full object-cover">` : `<i data-lucide="image-plus" class="w-4 h-4 text-slate-400"></i>`}
                            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center"><i data-lucide="pencil" class="w-4 h-4 text-white"></i></div>
                        </div>
                        <textarea class="inp-area h-full flex-1 text-xs" oninput="Store.updateMod('${safeId}','data.cap${n}',this.value)" placeholder="Caption ${n}...">${escapeHTML(d[`cap${n}`] || '')}</textarea>
                    </div>
                </div>`;
            };
            return `<div>${mkPanel(1)}${mkPanel(2)}${mkPanel(3)}</div>`;
        },
        render: (d, c, fs) => {
            const bubbleClasses = {
                auto: 'w-9 h-9 autofit-text-badge', xs: 'w-5 h-5 text-[10px]', sm: 'w-6 h-6 text-xs',
                md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-lg', xl: 'w-12 h-12 text-xl',
                '2xl': 'w-14 h-14 text-2xl', '3xl': 'w-16 h-16 text-3xl'
            };
            const fCls = CONFIG.getSize('comic', fs);
            const bCls = bubbleClasses[fs] || bubbleClasses.md;
            const mkP = (n) => {
                const imgId = d[`img${n}`];
                const src = imgId ? (Store.imgCache.get(imgId) || IMAGE_PLACEHOLDER_SVG) : '';
                return `
                <div class="flex-1 h-full flex flex-col gap-2 min-w-[50px] min-h-0">
                    <div class="flex-1 min-h-0 w-full border-[3px] rounded-xl overflow-hidden relative flex items-center justify-center" style="background-color: var(--bg-slate-tint); border-color: var(--ps-border)">
                        ${imgId ? `<img data-idb-id="${escapeHTML(imgId)}" src="${escapeHTML(src)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${IMAGE_FALLBACK_SVG}'">` : `<i data-lucide="image" class="w-10 h-10 text-slate-400 opacity-50"></i>`}
                        <div class="absolute top-2 left-2 bg-brand-dark text-white font-heading font-bold flex items-center justify-center rounded-full border-2 border-white ${bCls}">${n}</div>
                    </div>
                    <div class="border-2 rounded-xl p-3 shadow-[2px_2px_0px_0px_var(--ps-shadow)] min-h-[3.5rem] flex items-center justify-center text-center flex-shrink-0" style="background: var(--surface-card); border-color: var(--ps-border)">
                        <p class="font-hand font-bold ${fCls} leading-tight" style="color: var(--text-primary)">${escapeHTML(d[`cap${n}`] || '')}</p>
                    </div>
                </div>`;
            };
            return `<div class="h-full flex gap-4 p-4 items-center justify-center">${mkP(1)}${mkP(2)}${mkP(3)}</div>`;
        }
    }
};

// --- CLASSROOM POSTER TEMPLATES ---
const POSTER_TEMPLATES = {
    blank: {
        name: 'Blank Canvas',
        desc: 'Clean graph-paper poster ready for custom blocks.',
        icon: 'file-plus-2',
        color: 'blue',
        global: { title: 'NEW POSTER', subtitle: 'Custom Classroom Chart', badge: '1', layout: 'landscape', pattern: 'graph', gridSize: 'md' },
        modules: []
    },
    vocab_wall: {
        name: 'Vocabulary Wall',
        desc: 'Word bank with definitions, sentence frames & tip box.',
        icon: 'book-open',
        color: 'green',
        global: { title: 'WORD BANK', subtitle: 'Unit Vocabulary & Usage', badge: 'VOCAB', layout: 'landscape', pattern: 'graph', gridSize: 'md' },
        modules: [
            { type: 'vocab', title: 'Key Words', color: 'green', size: 'md', height: 'full', fontSize: 'lg', data: { list: 'Explore | Search to learn more\nObserve | Watch carefully\nMeasure | Find exact size\nPredict | Make a smart guess' } },
            { type: 'text', title: 'Sentence Frames', color: 'blue', size: 'md', height: 'tall', fontSize: 'md', data: { text: '1. I observed that...\n2. My prediction is...\n3. We discovered how...' } },
            { type: 'note', title: 'Word Tip', color: 'orange', size: 'md', height: 'tall', fontSize: 'md', data: { text: 'Use at least two new words in your science journal!', noteColor: 'yellow' } }
        ]
    },
    grammar_chart: {
        name: 'Grammar Anchor Chart',
        desc: 'Sentence formula, example table, dialogue & common error check.',
        icon: 'layers',
        color: 'blue',
        global: { title: 'SIMPLE PRESENT TENSE', subtitle: 'Daily Habits & True Facts', badge: 'GRAMMAR', layout: 'landscape', pattern: 'dots', gridSize: 'md' },
        modules: [
            { type: 'grammar_structure', title: 'Sentence Pattern', color: 'blue', size: 'md', height: 'tall', fontSize: 'md', data: { formula: 'Subject + Base Verb (+ s/es)', example: 'She reads every morning.' } },
            { type: 'dodont', title: 'Watch Out!', color: 'red', size: 'md', height: 'tall', fontSize: 'md', data: { wrong: 'He walk to school.', correct: 'He walks to school.' } },
            { type: 'table', title: 'Quick Forms', color: 'purple', size: 'lg', height: 'tall', fontSize: 'md', data: { content: 'Pronoun | Verb | Example\nI / You / We | play | We play soccer.\nHe / She / It | plays | She plays piano.' } },
            { type: 'dialogue', title: 'Partner Talk', color: 'teal', size: 'sm', height: 'tall', fontSize: 'sm', data: { text: 'A: What do you do after school?\nB: I study English and ride my bike!' } }
        ]
    },
    science_lab: {
        name: 'Science Lab & Steps',
        desc: 'Scientific method steps, safety checklist, comparison & quick check.',
        icon: 'compass',
        color: 'indigo',
        global: { title: 'SCIENCE METHOD LAB', subtitle: 'Ask, Test & Discover', badge: 'LAB', layout: 'landscape', pattern: 'graph', gridSize: 'md' },
        modules: [
            { type: 'steps', title: 'Lab Steps', color: 'indigo', size: 'md', height: 'full', fontSize: 'md', data: { steps: [{ title: 'Ask a Question', desc: 'What are we testing today?' }, { title: 'Test & Record', desc: 'Measure changes carefully.' }, { title: 'Share Results', desc: 'Explain what the data shows.' }] } },
            { type: 'checklist', title: 'Lab Safety', color: 'green', size: 'md', height: 'tall', fontSize: 'md', data: { items: [{ text: 'Wear safety goggles', done: true }, { text: 'Keep workspace dry & tidy', done: true }, { text: 'Wash hands after lab', done: false }] } },
            { type: 'quiz', title: 'Quick Check', color: 'orange', size: 'md', height: 'tall', fontSize: 'md', data: { question: 'What should we do before changing two variables?', options: ['Test only one change at a time', 'Skip recording data', 'Guess without observing'], answerIndex: 0, showAnswer: true } }
        ]
    },
    history_timeline: {
        name: 'History & Big Ideas',
        desc: 'Milestone timeline, inspirational quote & side-by-side comparison.',
        icon: 'clock',
        color: 'blue',
        global: { title: 'THEN & NOW', subtitle: 'Exploring Change Over Time', badge: 'TIMELINE', layout: 'landscape', pattern: 'dots', gridSize: 'md' },
        modules: [
            { type: 'timeline', title: 'Key Milestones', color: 'blue', size: 'full', height: 'auto', fontSize: 'md', data: { events: [{ label: '1903', text: 'First powered airplane flight' }, { label: '1957', text: 'First satellite in orbit' }, { label: '1969', text: 'Humans walk on the Moon' }] } },
            { type: 'compare', title: 'Then vs Today', color: 'purple', size: 'md', height: 'grand', fontSize: 'md', data: { leftTitle: '100 Years Ago', rightTitle: 'Today', leftItems: ['Handwritten letters', 'Oil lamps', 'Steam trains'], rightItems: ['Instant messaging', 'LED solar grids', 'High-speed rail'] } },
            { type: 'quote', title: 'Big Idea', color: 'pink', size: 'md', height: 'grand', fontSize: 'md', data: { quote: 'Small steps forward change the whole world.', author: 'Class Reflection', style: 'hand' } }
        ]
    },
    story_comic: {
        name: 'Story Comic Strip',
        desc: 'Three-panel storyboard on corkboard with sequence words.',
        icon: 'film',
        color: 'pink',
        global: { title: 'STORY SEQUENCE', subtitle: 'First, Next, Finally', badge: 'STORY', layout: 'landscape', pattern: 'cork', gridSize: 'md' },
        modules: [
            { type: 'comic', title: 'Story Scenes', color: 'pink', size: 'full', height: 'tall', fontSize: 'lg', data: { cap1: 'First, the little fox woke up.', cap2: 'Then, he found a bright map!', cap3: 'Finally, they shared the treasure.' } },
            { type: 'vocab', title: 'Time Connectors', color: 'orange', size: 'md', height: 'tall', fontSize: 'md', data: { list: 'First / In the beginning\nNext / Suddenly\nFinally / At last' } },
            { type: 'note', title: 'Writing Goal', color: 'red', size: 'md', height: 'tall', fontSize: 'md', data: { text: 'Check capitals and end punctuation!', noteColor: 'yellow' } }
        ]
    },
    class_rules: {
        name: 'Classroom Rules Board',
        desc: 'Tall chalkboard anchor poster for classroom expectations.',
        icon: 'award',
        color: 'orange',
        global: { title: 'OUR CLASS PROMISE', subtitle: 'Safe, Kind & Ready to Learn', badge: 'RULES', layout: 'portrait', pattern: 'chalkboard', gridSize: 'md' },
        modules: [
            { type: 'checklist', title: 'Daily Habits', color: 'green', size: 'full', height: 'auto', fontSize: 'lg', data: { items: [{ text: 'Listen when others speak', done: true }, { text: 'Use kind words and hands', done: true }, { text: 'Try your personal best', done: true }] } },
            { type: 'dodont', title: 'Hallway & Desk Habits', color: 'red', size: 'full', height: 'auto', fontSize: 'md', data: { wrong: 'Shout across the room.', correct: 'Raise a quiet hand.' } },
            { type: 'dialogue', title: 'Respectful Words', color: 'teal', size: 'full', height: 'auto', fontSize: 'md', data: { text: 'A: Could I borrow a pencil please?\nB: Of course! Here you go.' } },
            { type: 'note', title: 'Remember', color: 'green', size: 'full', height: 'auto', fontSize: 'md', data: { text: 'Mistakes help our brains grow!', noteColor: 'yellow' } }
        ]
    }
};

// --- GUIDED BULK IMPORT PARSER ---
const BULK_TYPE_ALIASES = {
    vocab: 'vocab', vocabulary: 'vocab', words: 'vocab', wordbank: 'vocab', wordlist: 'vocab',
    text: 'text', notes: 'text', paragraph: 'text', info: 'text',
    grammar_structure: 'grammar_structure', grammar: 'grammar_structure', formula: 'grammar_structure', structure: 'grammar_structure', rule: 'grammar_structure', pattern: 'grammar_structure',
    steps: 'steps', step: 'steps', process: 'steps', howto: 'steps', procedure: 'steps', instructions: 'steps',
    checklist: 'checklist', check: 'checklist', goals: 'checklist', objectives: 'checklist', todo: 'checklist', tasks: 'checklist',
    table: 'table', chart: 'table', grid: 'table',
    image: 'image', img: 'image', photo: 'image', picture: 'image',
    note: 'note', sticky: 'note', tip: 'note', reminder: 'note', callout: 'note',
    dodont: 'dodont', dosdonts: 'dodont', do_dont: 'dodont', dontdo: 'dodont', mistakes: 'dodont',
    dialogue: 'dialogue', dialog: 'dialogue', conversation: 'dialogue', chat: 'dialogue', script: 'dialogue',
    compare: 'compare', comparison: 'compare', vs: 'compare', versus: 'compare', contrast: 'compare', proscons: 'compare',
    quiz: 'quiz', question: 'quiz', qa: 'quiz', trivia: 'quiz', mcq: 'quiz',
    timeline: 'timeline', history: 'timeline', dates: 'timeline', events: 'timeline', schedule: 'timeline',
    quote: 'quote', motto: 'quote', inspiration: 'quote', saying: 'quote',
    comic: 'comic', storyboard: 'comic', strip: 'comic', story: 'comic'
};

const BULK_BADGE_TONES = {
    pink: 'pink', red: 'pink',
    orange: 'orange',
    green: 'green', teal: 'green',
    blue: 'blue', indigo: 'blue', purple: 'blue'
};

function parseBulkAttrs(attrStr, target) {
    const parts = String(attrStr || '').split(/[,;|]/);
    for (const part of parts) {
        const kv = part.match(/^\s*([a-zA-Z_-]+)\s*[:=]\s*([a-zA-Z0-9_-]+)\s*$/);
        if (!kv) continue;
        const k = kv[1].toLowerCase();
        const v = kv[2].toLowerCase();
        if (k === 'color' && CONFIG.colors.includes(v)) target.color = v;
        else if (k === 'width' || k === 'size') {
            const widthAlias = { half: 'md', wide: 'lg' };
            const mapped = widthAlias[v] || v;
            if (['xs', 'sm', 'md', 'lg', 'xl', 'full'].includes(mapped)) {
                target.size = mapped;
                target._explicitWidth = true;
            }
        } else if (k === 'height' && ['mini', 'short', 'auto', 'tall', 'grand', 'full'].includes(v)) {
            target.height = v;
            target._explicitHeight = true;
        } else if ((k === 'font' || k === 'fontsize' || k === 'textsize') && ['auto', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].includes(v)) {
            target.fontSize = v;
        } else if (k === 'tape') {
            target.showTape = v !== 'false' && v !== 'off' && v !== '0';
        }
    }
}

function parseBulkModuleBody(type, rawLines) {
    const lines = rawLines.map(l => String(l ?? '').trimEnd());
    const nonEmpty = lines.map(l => l.trim()).filter(Boolean);
    const warnings = [];
    let metaSummary = '';
    let data = {};

    switch (type) {
        case 'vocab': {
            const cleaned = nonEmpty.map(l => l.replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim());
            const items = parseVocabItems(cleaned.join('\n'));
            data = { items, list: serializeVocabItems(items) };
            metaSummary = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
            break;
        }
        case 'grammar_structure': {
            let formula = '';
            const exLines = [];
            for (const l of nonEmpty) {
                if (!formula && /^formula\s*:/i.test(l)) {
                    formula = l.replace(/^formula\s*:\s*/i, '').trim();
                } else if (!formula) {
                    formula = l;
                } else if (/^examples?\s*:/i.test(l)) {
                    const after = l.replace(/^examples?\s*:\s*/i, '').trim();
                    if (after) exLines.push(after);
                } else {
                    exLines.push(l);
                }
            }
            data = { formula: formula || 'Subject + Verb', example: exLines.join('\n') };
            metaSummary = exLines.length ? `${exLines.length} ex` : 'formula';
            break;
        }
        case 'steps': {
            const steps = parseStepLines(nonEmpty.join('\n'));
            data = { steps };
            metaSummary = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`;
            break;
        }
        case 'checklist': {
            const items = parseChecklistLines(nonEmpty.join('\n'));
            data = { items };
            metaSummary = `${items.length} ${items.length === 1 ? 'task' : 'tasks'}`;
            break;
        }
        case 'table': {
            const rows = parseDelimitedTable(nonEmpty.join('\n'));
            if (!rows.length) {
                data = { rows: [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']], content: 'Header 1 | Header 2\nCell 1 | Cell 2' };
                warnings.push('Table block had no rows — used default starter table.');
            } else {
                data = { rows, content: rows.map(r => r.join(' | ')).join('\n') };
            }
            const cols = data.rows[0] ? data.rows[0].length : 0;
            metaSummary = `${data.rows.length}x${cols}`;
            break;
        }
        case 'dodont': {
            const pairs = [];
            let pendingWrong = null;
            for (const l of nonEmpty) {
                const wrongM = l.match(/^(?:don'?t|wrong)\s*:\s*(.+)$/i);
                const doM = l.match(/^(?:do|correct|right)\s*:\s*(.+)$/i);
                if (wrongM) {
                    if (pendingWrong !== null) pairs.push({ wrong: pendingWrong, correct: '' });
                    pendingWrong = wrongM[1].trim();
                } else if (doM) {
                    pairs.push({ wrong: pendingWrong || '', correct: doM[1].trim() });
                    pendingWrong = null;
                } else if (l.includes('|')) {
                    const [w, c] = l.split('|');
                    pairs.push({ wrong: (w || '').trim(), correct: (c || '').trim() });
                } else if (pendingWrong !== null) {
                    pairs.push({ wrong: pendingWrong, correct: l });
                    pendingWrong = null;
                } else {
                    pendingWrong = l;
                }
            }
            if (pendingWrong !== null) pairs.push({ wrong: pendingWrong, correct: '' });
            const finalPairs = pairs.length ? pairs : [{ wrong: '', correct: '' }];
            data = { pairs: finalPairs, wrong: finalPairs[0].wrong, correct: finalPairs[0].correct };
            metaSummary = `${finalPairs.length} ${finalPairs.length === 1 ? 'pair' : 'pairs'}`;
            break;
        }
        case 'dialogue': {
            const turns = parseDialogueTurns(nonEmpty.join('\n'));
            data = { turns, text: serializeDialogueTurns(turns) };
            metaSummary = `${turns.length} ${turns.length === 1 ? 'turn' : 'turns'}`;
            break;
        }
        case 'compare': {
            let leftTitle = 'Option A';
            let rightTitle = 'Option B';
            const leftItems = [];
            const rightItems = [];
            let activeSide = null;
            let headerConsumed = false;

            for (const l of nonEmpty) {
                if (/^[\s|:-]+$/.test(l) && l.includes('-')) continue;
                const leftSec = l.match(/^left\s*:\s*(.*)$/i);
                const rightSec = l.match(/^right\s*:\s*(.*)$/i);
                if (leftSec) {
                    if (leftSec[1].trim()) leftTitle = leftSec[1].trim();
                    activeSide = 'left';
                    headerConsumed = true;
                    continue;
                }
                if (rightSec) {
                    if (rightSec[1].trim()) rightTitle = rightSec[1].trim();
                    activeSide = 'right';
                    headerConsumed = true;
                    continue;
                }
                if (l.includes('|')) {
                    const parts = l.split('|').map(x => x.trim());
                    if (!headerConsumed) {
                        leftTitle = parts[0] || leftTitle;
                        rightTitle = parts[1] || rightTitle;
                        headerConsumed = true;
                    } else {
                        if (parts[0]) leftItems.push(parts[0].replace(/^[-*•]\s*/, ''));
                        if (parts[1]) rightItems.push(parts[1].replace(/^[-*•]\s*/, ''));
                    }
                    continue;
                }
                headerConsumed = true;
                const clean = l.replace(/^[-*•]\s*/, '').trim();
                if (!clean) continue;
                if (activeSide === 'right') rightItems.push(clean);
                else leftItems.push(clean);
            }
            data = { leftTitle, rightTitle, leftItems, rightItems };
            metaSummary = `${leftItems.length}/${rightItems.length} pts`;
            break;
        }
        case 'quiz': {
            let question = '';
            const options = [];
            let answerIndex = 0;
            let explicitAns = null;
            let foundMarked = false;

            for (const l of nonEmpty) {
                const ansMatch = l.match(/^answer\s*:\s*(.+)$/i);
                if (ansMatch) {
                    explicitAns = ansMatch[1].trim();
                    continue;
                }
                const qMatch = l.match(/^(?:q|question)\s*:\s*(.+)$/i);
                if (qMatch && !question) {
                    question = qMatch[1].trim();
                    continue;
                }
                const isOptLike = /^(?:[-*•]|\[[x\s]\]|\([x\s]\)|[A-Za-z][.)])\s+/.test(l);
                if (!question && !isOptLike) {
                    question = l;
                    continue;
                }
                let optText = l.replace(/^(?:[-*•]|[A-Za-z][.)])\s*/, '').trim();
                let marked = false;
                if (/^(?:\[x\]|\(x\)|✓|✔)/i.test(optText)) {
                    marked = true;
                    optText = optText.replace(/^(?:\[x\]|\(x\)|✓|✔)\s*/i, '').trim();
                } else if (/^\[\s?\]/.test(optText)) {
                    optText = optText.replace(/^\[\s?\]\s*/, '').trim();
                }
                if (/\*+$/.test(optText)) {
                    marked = true;
                    optText = optText.replace(/\s*\*+$/, '').trim();
                }
                if (optText) {
                    if (marked && !foundMarked) {
                        answerIndex = options.length;
                        foundMarked = true;
                    }
                    options.push(optText);
                }
            }

            if (explicitAns) {
                if (/^[A-Za-z]$/.test(explicitAns)) {
                    const idx = explicitAns.toUpperCase().charCodeAt(0) - 65;
                    if (idx >= 0 && idx < options.length) answerIndex = idx;
                } else if (/^\d+$/.test(explicitAns)) {
                    const idx = parseInt(explicitAns, 10) - 1;
                    if (idx >= 0 && idx < options.length) answerIndex = idx;
                } else {
                    const foundIdx = options.findIndex(o => o.toLowerCase() === explicitAns.toLowerCase());
                    if (foundIdx >= 0) answerIndex = foundIdx;
                }
            }
            if (options.length < 2) {
                warnings.push('Quiz block works best with 2+ options.');
            }
            data = {
                question: question || 'Quick Check',
                options: options.length ? options : ['Option A', 'Option B'],
                answerIndex: Math.max(0, Math.min(Math.max(0, options.length - 1), answerIndex)),
                showAnswer: true
            };
            metaSummary = `${data.options.length} opts`;
            break;
        }
        case 'timeline': {
            const events = parseTimelineLines(nonEmpty.join('\n'));
            data = { events };
            metaSummary = `${events.length} ${events.length === 1 ? 'event' : 'events'}`;
            break;
        }
        case 'quote': {
            let author = '';
            const quoteParts = [];
            for (const l of nonEmpty) {
                const authM = l.match(/^(?:author|by|source)\s*:\s*(.+)$/i);
                if (authM) {
                    author = authM[1].trim();
                } else if (/^(?:—|--|- )\s*\S+/.test(l) && quoteParts.length > 0) {
                    author = l.replace(/^(?:—|--|- )\s*/, '').trim();
                } else {
                    quoteParts.push(l);
                }
            }
            const rawQ = quoteParts.join('\n').trim().replace(/^["\u201C\u201D]|["\u201C\u201D]$/g, '').trim();
            data = { quote: rawQ, author, style: 'hand' };
            metaSummary = author ? author.slice(0, 14) : 'quote';
            break;
        }
        case 'note': {
            let noteColor = 'yellow';
            const noteLines = [];
            for (const l of nonEmpty) {
                const colM = l.match(/^color\s*:\s*([a-zA-Z]+)$/i);
                if (colM && Object.prototype.hasOwnProperty.call(CONFIG.noteColorMap, colM[1].toLowerCase())) {
                    noteColor = colM[1].toLowerCase();
                } else {
                    noteLines.push(l);
                }
            }
            data = { text: noteLines.join('\n'), noteColor };
            metaSummary = noteColor;
            break;
        }
        case 'image': {
            let url = '';
            let cap = '';
            for (const l of nonEmpty) {
                const urlM = l.match(/^(?:url\s*:\s*)?(https?:\/\/\S+)$/i);
                if (urlM && !url) {
                    url = urlM[1].trim();
                } else {
                    cap = cap ? `${cap} ${l}` : l.replace(/^caption\s*:\s*/i, '').trim();
                }
            }
            data = { url, imageId: null, fit: 'cover', caption: cap };
            metaSummary = url ? 'url' : 'placeholder';
            break;
        }
        case 'comic': {
            const caps = ['', '', ''];
            let nextIdx = 0;
            for (const l of nonEmpty) {
                const pMatch = l.match(/^(?:panel\s*)?([123])\s*:\s*(.*)$/i);
                if (pMatch) {
                    caps[parseInt(pMatch[1], 10) - 1] = pMatch[2].trim();
                } else if (nextIdx < 3) {
                    caps[nextIdx++] = l;
                }
            }
            data = { cap1: caps[0], cap2: caps[1], cap3: caps[2] };
            metaSummary = '3 panels';
            break;
        }
        case 'text':
        default: {
            let align = 'left';
            const cleanLines = [];
            for (const l of lines) {
                const am = l.trim().match(/^align\s*:\s*(center|left)$/i);
                if (am) {
                    align = am[1].toLowerCase();
                } else {
                    cleanLines.push(l);
                }
            }
            const bodyText = cleanLines.join('\n').trim();
            data = { text: bodyText, align };
            metaSummary = `${cleanLines.filter(l => l.trim()).length} lines`;
            break;
        }
    }

    return { data, metaSummary, warnings };
}

function parseBulkPosterText(rawText) {
    const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
    const meta = {
        title: '',
        subtitle: '',
        badge: '',
        layout: '',
        pattern: '',
        gridSize: ''
    };

    const rawSections = [];
    const bareLines = [];
    let current = null;
    const warnings = [];

    const flushCurrent = () => {
        if (!current) return;
        while (current.lines.length && !current.lines[0].trim()) current.lines.shift();
        while (current.lines.length && !current.lines[current.lines.length - 1].trim()) current.lines.pop();
        rawSections.push(current);
        current = null;
    };

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed.startsWith('//')) continue;

        const cleanedHeader = trimmed.replace(/^#{1,4}\s*/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
        const blockMatch = cleanedHeader.match(/^\[([a-zA-Z][a-zA-Z0-9_'\/& -]+?)(?:\s*\|\s*([^\]]+))?\](?:\*{1,2})?(.*)$/);
        if (blockMatch) {
            flushCurrent();
            const rawTag = blockMatch[1].trim().toLowerCase().replace(/[\s-]+/g, '_');
            const inlineAttrs = blockMatch[2] || '';
            let restTitle = (blockMatch[3] || '').replace(/\*{1,2}$/, '').trim();
            let trailingAttrs = '';
            const parenMatch = restTitle.match(/\(([^)]*(?:color|width|size|height|font|tape)[^)]*)\)\s*$/i);
            if (parenMatch) {
                trailingAttrs = parenMatch[1];
                restTitle = restTitle.slice(0, parenMatch.index).trim();
            }
            current = {
                rawTag,
                title: restTitle,
                attrStr: [inlineAttrs, trailingAttrs].filter(Boolean).join(', '),
                lines: []
            };
            continue;
        }

        if (!current) {
            if (!trimmed || /^-{3,}$/.test(trimmed)) continue;
            const metaLine = trimmed.replace(/^#{1,4}\s*/, '').replace(/\*{1,2}/g, '').trim();
            const metaMatch = metaLine.match(/^(TITLE|SUBTITLE|BADGE|LAYOUT|PATTERN|GRID)\s*:\s*(.+)$/i);
            if (metaMatch) {
                const mk = metaMatch[1].toLowerCase();
                const mv = metaMatch[2].trim();
                if (mk === 'title') meta.title = mv;
                else if (mk === 'subtitle') meta.subtitle = mv;
                else if (mk === 'badge') meta.badge = mv;
                else if (mk === 'layout' && ['landscape', 'portrait', 'square'].includes(mv.toLowerCase())) meta.layout = mv.toLowerCase();
                else if (mk === 'pattern' && ['graph', 'dots', 'chalkboard', 'cork', 'plain'].includes(mv.toLowerCase())) meta.pattern = mv.toLowerCase();
                else if (mk === 'grid' && ['sm', 'md', 'lg'].includes(mv.toLowerCase())) meta.gridSize = mv.toLowerCase();
                continue;
            }
            if (trimmed.startsWith('#') && !meta.title) {
                meta.title = trimmed.replace(/^#+\s*/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
                continue;
            }
            bareLines.push(rawLine);
        } else {
            if (/^-{3,}$/.test(trimmed)) continue;
            current.lines.push(rawLine);
        }
    }
    flushCurrent();

    if (!rawSections.length && bareLines.some(l => l.trim())) {
        rawSections.push({
            rawTag: 'text',
            title: 'Classroom Notes',
            attrStr: '',
            lines: bareLines
        });
        warnings.push('No [BLOCK] tags found — imported text as a Text block.');
    }

    const items = [];
    const badges = [];

    for (const sec of rawSections) {
        let resolvedType = BULK_TYPE_ALIASES[sec.rawTag] || BULK_TYPE_ALIASES[sec.rawTag.replace(/[^a-z0-9]/g, '')];
        if (!resolvedType) {
            warnings.push(`Unknown block tag "[${sec.rawTag.toUpperCase()}]" imported as Text.`);
            resolvedType = 'text';
        }
        const cfg = ModuleRegistry[resolvedType];
        const hasLines = sec.lines.some(l => l.trim());
        if (!hasLines && resolvedType !== 'image') {
            warnings.push(`Skipped empty [${sec.rawTag.toUpperCase()}] block.`);
            continue;
        }

        const parsedBody = parseBulkModuleBody(resolvedType, sec.lines);
        if (parsedBody.warnings.length) {
            warnings.push(...parsedBody.warnings);
        }

        const mod = {
            id: makeId(),
            type: resolvedType,
            title: sec.title || cfg.label,
            color: cfg.color,
            size: 'md',
            height: 'auto',
            fontSize: 'md',
            showTape: true,
            data: parsedBody.data
        };
        if (sec.attrStr) parseBulkAttrs(sec.attrStr, mod);

        items.push(mod);
        badges.push({
            tone: BULK_BADGE_TONES[mod.color] || 'slate',
            tag: cfg.label,
            label: mod.title,
            meta: parsedBody.metaSummary,
            title: `${cfg.label}: ${mod.title}`
        });
    }

    return { meta, items, warnings, badges };
}

function computeUsedGridRows(modules) {
    if (!Array.isArray(modules) || !modules.length) return 12;
    const sizeCols = { xs: 2, sm: 4, md: 6, lg: 8, xl: 10, full: 12 };
    const heightRows = { mini: 1, short: 2, auto: 3, tall: 6, grand: 9, full: 12 };
    const grid = [];
    const ensureRow = (r) => {
        while (grid.length <= r) grid.push(new Array(12).fill(false));
    };
    let maxRow = 0;
    for (const m of modules) {
        if (!m || !ModuleRegistry[m.type]) continue;
        const w = Math.min(12, Math.max(1, sizeCols[m.size] || 6));
        const h = Math.max(1, heightRows[m.height] || 3);
        let placed = false;
        for (let r = 0; !placed; r++) {
            ensureRow(r + h - 1);
            for (let c = 0; c <= 12 - w; c++) {
                let fits = true;
                for (let dr = 0; dr < h && fits; dr++) {
                    for (let dc = 0; dc < w; dc++) {
                        if (grid[r + dr][c + dc]) { fits = false; break; }
                    }
                }
                if (fits) {
                    for (let dr = 0; dr < h; dr++) {
                        for (let dc = 0; dc < w; dc++) {
                            grid[r + dr][c + dc] = true;
                        }
                    }
                    if (r + h > maxRow) maxRow = r + h;
                    placed = true;
                    break;
                }
            }
        }
    }
    return Math.max(12, maxRow);
}

function sanitizePosterSchema(raw) {
    if (!raw || typeof raw !== 'object' || !raw.global || typeof raw.global !== 'object' || !Array.isArray(raw.modules)) {
        throw new Error('Invalid poster schema');
    }
    const g = raw.global;
    const validLayouts = ['landscape', 'portrait', 'square'];
    const validPatterns = ['graph', 'dots', 'chalkboard', 'cork', 'plain'];
    const validGrids = ['sm', 'md', 'lg'];
    const validSizes = ['xs', 'sm', 'md', 'lg', 'xl', 'full'];
    const validHeights = ['mini', 'short', 'auto', 'tall', 'grand', 'full'];
    const validFonts = ['auto', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

    const normalizedModules = raw.modules
        .filter(m => m && typeof m === 'object' && ModuleRegistry[m.type])
        .map(m => {
            const cfg = ModuleRegistry[m.type];
            return {
                id: typeof m.id === 'string' && m.id.trim() ? m.id : makeId(),
                type: m.type,
                title: String(m.title ?? cfg.label),
                color: CONFIG.safeColor(m.color),
                size: validSizes.includes(m.size) ? m.size : 'md',
                height: validHeights.includes(m.height) ? m.height : 'auto',
                fontSize: validFonts.includes(m.fontSize) ? m.fontSize : 'md',
                showTape: m.showTape !== false,
                data: m.data && typeof m.data === 'object' ? JSON.parse(JSON.stringify(m.data)) : JSON.parse(JSON.stringify(cfg.default))
            };
        });

    return {
        id: makeId(),
        lastModified: Date.now(),
        zoom: Number.isFinite(Number(raw.zoom)) ? Math.max(0.1, Math.min(2, Number(raw.zoom))) : 0.5,
        global: {
            title: String(g.title ?? 'UNTITLED'),
            subtitle: String(g.subtitle ?? ''),
            badge: String(g.badge ?? ''),
            layout: validLayouts.includes(g.layout) ? g.layout : 'landscape',
            pattern: validPatterns.includes(g.pattern) ? g.pattern : 'graph',
            gridSize: validGrids.includes(g.gridSize) ? g.gridSize : 'md'
        },
        modules: normalizedModules
    };
}

// --- INTERACTIVE TABLE EDITOR ASSISTANT ---
const TableEditor = {
    updateCell(id, r, c, val) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m || !m.data.rows || !m.data.rows[r]) return;
        Store.markTextEditHistory();
        m.data.rows[r][c] = val;
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Renderer.renderPoster();
        Store.triggerSave();
    },
    addRow(id) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m) return;
        App.pushHistory();
        if (!m.data.rows || !m.data.rows.length) {
            m.data.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
        }
        const numCols = Math.max(1, m.data.rows[0].length || 1);
        m.data.rows.push(Array(numCols).fill('New Cell'));
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id, `[data-tbl-cell="${m.data.rows.length - 1}-0"]`);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    addCol(id) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m) return;
        App.pushHistory();
        if (!m.data.rows || !m.data.rows.length) {
            m.data.rows = [['Header 1', 'Header 2'], ['Row 1 Col 1', 'Row 1 Col 2']];
        }
        m.data.rows.forEach((row, idx) => {
            row.push(idx === 0 ? `Header ${row.length + 1}` : 'New Cell');
        });
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    deleteRow(id) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m || !m.data.rows || m.data.rows.length <= 1) return;
        App.pushHistory();
        m.data.rows.pop();
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    deleteCol(id) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m || !m.data.rows || !m.data.rows.length || m.data.rows[0].length <= 1) return;
        App.pushHistory();
        m.data.rows.forEach(row => row.pop());
        m.data.content = m.data.rows.map(row => row.join(' | ')).join('\n');
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
    },
    applyPaste(id, rawOverride) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m) return;
        const raw = typeof rawOverride === 'string'
            ? rawOverride
            : (document.getElementById('editor-table-paste')?.value || '');
        const rows = parseDelimitedTable(raw);
        if (!rows.length) {
            showToast('Paste at least one row to update table.', 'warning');
            return;
        }
        App.pushHistory();
        m.data.rows = rows;
        m.data.content = rows.map(row => row.join(' | ')).join('\n');
        Editor.inputModes[id] = 'builder';
        Editor.render(id);
        Renderer.renderPoster();
        Store.triggerSave();
        showToast(`Applied ${rows.length} table rows!`, 'success');
    }
};

// --- 2. DATA STORE (IDB + LOCAL + CLOUD) ---
const LS_UI_MODE = 'posterstudio_ui_mode';
const LS_POSTERS_KEY = 'poster-studio-v2';

const Store = {
    state: { posters: [], currentId: 'default', theme: 'light' },
    current: null,
    imgCache: new Map(),
    db: null,
    debounce: null,
    _textEditTimer: null,
    _textEditSnapTaken: false,

    markTextEditHistory() {
        if (!Store.current) return;
        if (!Store._textEditSnapTaken) {
            if (!App.pushHistory()) return;
            Store._textEditSnapTaken = true;
        }
        clearTimeout(Store._textEditTimer);
        Store._textEditTimer = setTimeout(() => {
            Store._textEditSnapTaken = false;
        }, 1200);
    },

    async init() {
        Store.db = await new Promise((res) => {
            try {
                if (typeof indexedDB === 'undefined') { res(null); return; }
                const req = indexedDB.open('PosterStudioDB', 2);
                req.onupgradeneeded = (e) => {
                    if (!e.target.result.objectStoreNames.contains('imgs')) {
                        e.target.result.createObjectStore('imgs');
                    }
                };
                req.onsuccess = (e) => res(e.target.result);
                req.onerror = () => res(null);
            } catch (_) {
                res(null);
            }
        });

        try {
            const local = localStorage.getItem(LS_POSTERS_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && Array.isArray(parsed.posters)) {
                    Store.state = parsed;
                }
            }
        } catch (e) {
            console.warn('Corrupt local poster storage, starting fresh', e);
        }

        await Store.loadFromCloud();

        if (!Store.state.posters.length) {
            const starter = App.buildPosterFromTemplate('blank');
            Store.state.posters.push(starter);
            Store.state.currentId = starter.id;
        }

        Store.loadCurrent();
    },

    loadCurrent() {
        Store.current = Store.state.posters.find(p => p.id === Store.state.currentId) || Store.state.posters[0];
        if (Store.current) {
            Store.state.currentId = Store.current.id;
            if (!Array.isArray(Store.current.modules)) Store.current.modules = [];
            if (!Store.current.global || typeof Store.current.global !== 'object') {
                Store.current.global = { title: 'UNTITLED', subtitle: '', badge: '1', layout: 'landscape', pattern: 'graph', gridSize: 'md' };
            }
        }
    },

    save(visual = false) {
        if (!Store.current) return;
        Store.current.lastModified = Date.now();
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        if (idx >= 0) Store.state.posters[idx] = Store.current;
        else Store.state.posters.push(Store.current);

        try {
            localStorage.setItem(LS_POSTERS_KEY, JSON.stringify(Store.state));
        } catch (e) {
            console.error('Failed to persist poster state locally', e);
        }

        Store.syncToCloud();

        if (visual) {
            const btn = document.getElementById('save-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span class="hidden sm:inline">Saved!</span>`;
                btn.classList.add('bg-green');
                btn.classList.remove('bg-blue');
                hydrateIcons();
                setTimeout(() => {
                    btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> <span class="hidden sm:inline">Save</span>`;
                    btn.classList.remove('bg-green');
                    btn.classList.add('bg-blue');
                    hydrateIcons();
                }, 1000);
            }
            showToast('Poster saved!', 'success');
        }
    },

    async syncToCloud() {
        if (typeof saveProgress !== 'function') return;
        try {
            await saveProgress('poster_studio_data', Store.state);
        } catch (e) {
            console.warn('Cloud sync deferred/offline:', e);
        }
    },

    async loadFromCloud() {
        if (typeof loadProgress !== 'function') return;
        try {
            const data = await loadProgress('poster_studio_data');
            if (data && Array.isArray(data.posters)) {
                const map = new Map();
                for (const p of (Store.state.posters || [])) {
                    if (p && p.id) map.set(p.id, p);
                }
                for (const p of data.posters) {
                    if (!p || !p.id) continue;
                    const existing = map.get(p.id);
                    if (!existing || (p.lastModified || 0) >= (existing.lastModified || 0)) {
                        map.set(p.id, p);
                    }
                }
                Store.state.posters = Array.from(map.values());
                if (!Store.state.currentId || !map.has(Store.state.currentId)) {
                    Store.state.currentId = data.currentId || (Store.state.posters[0] && Store.state.posters[0].id) || 'default';
                }
                try {
                    localStorage.setItem(LS_POSTERS_KEY, JSON.stringify(Store.state));
                } catch (_) {}
            }
        } catch (e) {
            console.warn('Cloud load failed, using local storage:', e);
        }
    },

    triggerSave() {
        clearTimeout(Store.debounce);
        Store.debounce = setTimeout(() => Store.save(false), 450);
    },

    updateGlobal(key, val) {
        if (!Store.current) return;
        Store.current.global[key] = val;
        if (key === 'title' || key === 'subtitle' || key === 'badge') {
            Renderer.patchHeaderText();
            if (key === 'title') {
                const sel = document.getElementById('project-select');
                const opt = sel && sel.options
                    ? Array.from(sel.options).find(o => o.value === Store.current.id)
                    : null;
                if (opt) opt.textContent = val || 'UNTITLED';
            }
            return;
        }
        Renderer.renderPoster();
    },

    updateMod(id, key, val) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m) return;
        Store.markTextEditHistory();
        if (key.includes('.')) {
            const [p, c] = key.split('.');
            if (!m[p]) m[p] = {};
            m[p][c] = val;
        } else {
            m[key] = val;
        }
        if (key === 'title' && App.editingId === id) {
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `Edit ${val || 'Block'}`;
        }
        Renderer.renderPoster();
        Store.triggerSave();
    },

    async uploadImage(input) {
        let file = input.files?.[0];
        if (!file) return;
        if (file.type && !file.type.startsWith('image/')) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal('Please upload a valid image file.', { title: 'Invalid File', icon: 'x-octagon', iconColor: 'red' });
            } else {
                showToast('Please select a valid image file.', 'error');
            }
            return;
        }

        if (typeof imageCompression === 'function') {
            try {
                const compressed = await imageCompression(file, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true
                });
                if (compressed) file = compressed;
            } catch (_) {}
        }

        let imgId;
        try {
            if (typeof getCloudUser === 'function' && typeof uploadMedia === 'function') {
                const user = await getCloudUser();
                if (user && Store.current) {
                    imgId = await uploadMedia(file, 'poster_studio', Store.current.id);
                }
            }
        } catch (err) {
            console.warn('Cloud image upload fallback to local IDB:', err);
        }

        if (!imgId) {
            imgId = makeId();
            const blob = new Blob([file], { type: file.type || 'image/png' });
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                Store.imgCache.set(imgId, URL.createObjectURL(blob));
            }
            if (Store.db) {
                try {
                    const tx = Store.db.transaction('imgs', 'readwrite');
                    tx.objectStore('imgs').put(blob, imgId);
                } catch (_) {}
            }
        }

        if (App.currentImageModId) {
            App.pushHistory();
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        } else {
            App.refreshImageLibrary();
        }
        showToast('Image added to library!', 'success');
    },

    async deleteImage(id) {
        if (id && id.includes('klasskit-media') && typeof deleteMediaFromUrl === 'function') {
            deleteMediaFromUrl(id).catch(e => console.warn('Cloud delete failed', e));
        }
        const cached = Store.imgCache.get(id);
        if (cached && cached.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(cached);
        }
        Store.imgCache.delete(id);
        if (!Store.db) return;
        return new Promise((res) => {
            try {
                const tx = Store.db.transaction('imgs', 'readwrite');
                tx.objectStore('imgs').delete(id);
                tx.oncomplete = () => res();
                tx.onerror = () => res();
            } catch (_) {
                res();
            }
        });
    },

    async getAllImages() {
        const images = [];
        const localKeys = await new Promise((res) => {
            if (!Store.db) { res([]); return; }
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').getAllKeys();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => res([]);
            } catch (_) {
                res([]);
            }
        });
        for (const k of localKeys) {
            const url = await Store.getImage(k);
            images.push({ id: k, url });
        }

        if (Store.current && typeof getCloudUser === 'function' && typeof db !== 'undefined' && typeof STORAGE_CONFIG !== 'undefined') {
            try {
                const user = await getCloudUser();
                if (user) {
                    const dir = `${user.id}/poster_studio/${Store.current.id}`;
                    const { data: files } = await db.storage.from(STORAGE_CONFIG.bucket).list(dir);
                    if (Array.isArray(files)) {
                        for (const f of files) {
                            if (!f || f.name === '.emptyFolderPlaceholder') continue;
                            const path = `${dir}/${f.name}`;
                            const cloudUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_CONFIG.bucket}/${path}`;
                            if (!images.find(x => x.id === cloudUrl)) {
                                images.push({ id: cloudUrl, url: Store.imgCache.get(cloudUrl) || '' });
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Cloud image list unavailable:', e);
            }
        }
        return images;
    },

    async getImage(id) {
        if (!id) return null;
        if (Store.imgCache.has(id)) return Store.imgCache.get(id);

        if (String(id).includes('klasskit-media') && typeof resolveMediaUrl === 'function') {
            try {
                const signed = await resolveMediaUrl(id);
                if (signed) Store.imgCache.set(id, signed);
                return signed;
            } catch (_) {
                return null;
            }
        }

        return new Promise((res) => {
            if (!Store.db) { res(null); return; }
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').get(id);
                req.onsuccess = () => {
                    if (req.result && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                        const url = URL.createObjectURL(req.result);
                        Store.imgCache.set(id, url);
                        res(url);
                    } else {
                        res(null);
                    }
                };
                req.onerror = () => res(null);
            } catch (_) {
                res(null);
            }
        });
    },

    moveMod(id, dir) {
        if (!Store.current) return;
        const idx = Store.current.modules.findIndex(m => m.id === id);
        const target = idx + dir;
        if (idx !== -1 && target >= 0 && target < Store.current.modules.length) {
            App.pushHistory();
            const temp = Store.current.modules[idx];
            Store.current.modules[idx] = Store.current.modules[target];
            Store.current.modules[target] = temp;
            Store.save();
            Renderer.renderPoster();
            Editor.updateMoveButtons();
        }
    },

    reorderModules(fromIdx, toIdx) {
        if (!Store.current || !Number.isInteger(fromIdx) || !Number.isInteger(toIdx)) return;
        if (fromIdx < 0 || fromIdx >= Store.current.modules.length || toIdx < 0 || toIdx >= Store.current.modules.length) return;
        App.pushHistory();
        const item = Store.current.modules.splice(fromIdx, 1)[0];
        Store.current.modules.splice(toIdx, 0, item);
        Store.save();
        Renderer.renderPoster();
    }
};

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

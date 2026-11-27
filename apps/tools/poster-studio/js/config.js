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


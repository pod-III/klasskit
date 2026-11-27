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


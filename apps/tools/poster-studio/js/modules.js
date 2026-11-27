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


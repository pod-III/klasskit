        let PRESETS = {};

        const Q_TYPES = [
            { key: 'mc', label: 'Multiple Choice', icon: 'list' },
            { key: 'tf', label: 'True / False', icon: 'toggle-left' },
            { key: 'text', label: 'Type Answer', icon: 'keyboard' },
            { key: 'fill', label: 'Fill the Blank', icon: 'text-cursor-input' },
            { key: 'order', label: 'Put in Order', icon: 'arrow-down-up' },
        ];
        function getQType(q) { return q.type || 'mc'; }
        function makeDefaultQuestion(type) {
            switch (type) {
                case 'tf': return { type: 'tf', q: '', a: 0, e: '' };
                case 'text': return { type: 'text', q: '', answers: [''], e: '' };
                case 'fill': return { type: 'fill', q: '', o: ['', '', '', ''], a: 0, e: '' };
                case 'order': return { type: 'order', q: '', items: ['', ''], e: '' };
                default: return { type: 'mc', q: '', o: ['', '', '', ''], a: 0, e: '' };
            }
        }

        const OPTION_SHAPES = ['triangle', 'diamond', 'circle', 'square'];
        const OPTION_COLORS = ['bg-pink', 'bg-orange', 'bg-blue', 'bg-green'];

        let collections = [];
        let currentCollectionId = null;
        let isAnswering = false;
        let currentQuestions = [];
        let currentStep = 0;
        let score = 0;
        let isSetupMode = false;
        let syncTimeout = null;

        function initTheme() {
            const saved = localStorage.getItem('theme_hub');
            if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
            updateThemeUI();
        }

        function toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme_hub', isDark ? 'dark' : 'light');
            updateThemeUI();
        }

        function updateThemeUI() {
            const isDark = document.documentElement.classList.contains('dark');
            const icon = document.getElementById('theme-icon');
            if (icon) {
                icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
                lucide.createIcons();
            }
        }

        function toggleMode(target) {
            isSetupMode = target === 'setup' ? true : (target === 'play' ? false : !isSetupMode);
            const setup = document.getElementById('setup-mode');
            const play = document.getElementById('play-mode');
            const toggleBtn = document.getElementById('setup-toggle');
            const header = document.getElementById('main-header');
            const icon = toggleBtn.querySelector('[data-lucide]');

            if (isSetupMode) {
                setup.classList.remove('hidden');
                setup.classList.add('grid');
                play.classList.add('hidden');
                toggleBtn.querySelector('span').textContent = 'PLAY';
                if (icon) icon.setAttribute('data-lucide', 'play');
                header.classList.add('setup-header');
                renderCollections();
                renderEditor();
            } else {
                setup.classList.add('hidden');
                setup.classList.remove('grid');
                play.classList.remove('hidden');
                toggleBtn.querySelector('span').textContent = 'SETUP';
                if (icon) icon.setAttribute('data-lucide', 'settings');
                header.classList.remove('setup-header');
                resetQuizState();
            }
            lucide.createIcons();
        }

        function createNewCollection() {
            const id = 'quiz_' + Date.now();
            const newQuiz = { id, name: "New Classroom Battle", questions: [makeDefaultQuestion('mc')], timestamp: Date.now() };
            collections.push(newQuiz);
            currentCollectionId = id;
            currentQuestions = newQuiz.questions;
            saveData();
            renderCollections();
            renderEditor();
        }

        function selectCollection(id) {
            const quiz = collections.find(c => c.id === id);
            if (quiz) {
                currentCollectionId = id;
                currentQuestions = quiz.questions;
                renderCollections();
                renderEditor();
                AudioEngine.playTone(600, 'sine', 0.1);
            }
        }

        async function deleteCurrentCollection() {
            if (collections.length <= 1) {
                await showAlertModal("You must have at least one quiz!", { title: "Cannot Delete", icon: "alert-circle", iconColor: "orange" });
                return;
            }
            const confirmed = await showConfirmModal("Permanently delete this battle set?", {
                title: "Delete Quiz?",
                confirmText: "Delete",
                cancelText: "Keep",
                icon: "trash-2",
                iconColor: "red"
            });
            if (confirmed) {
                collections = collections.filter(c => c.id !== currentCollectionId);
                currentCollectionId = collections[0].id;
                currentQuestions = collections[0].questions;
                saveData();
                renderCollections();
                renderEditor();
            }
        }

        function updateCollectionName(name) {
            const quiz = collections.find(c => c.id === currentCollectionId);
            if (quiz) { quiz.name = name; saveData(); renderCollections(); }
        }

        function renderCollections() {
            const list = document.getElementById('collections-list');
            list.innerHTML = '';
            collections.sort((a, b) => b.timestamp - a.timestamp).forEach(quiz => {
                const isActive = quiz.id === currentCollectionId;
                const qCount = quiz.questions.filter(q => isQuestionValid(q)).length;
                const btn = document.createElement('button');
                btn.className = `collection-item w-full px-4 py-3 rounded-xl border-2 font-black text-left flex items-center gap-3 shadow-hard-sm transition-all relative overflow-hidden ${isActive ? 'bg-pink text-white border-dark scale-[1.01]' : 'bg-chalk dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-pink hover:text-pink dark:hover:text-pink'}`;
                btn.innerHTML = `${isActive ? '<div class="collection-active-stripe"></div>' : ''}<div class="w-8 h-8 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'} flex items-center justify-center shrink-0 border border-dark/10"><i data-lucide="scroll-text" class="w-4 h-4 ${isActive ? 'text-white' : ''}"></i></div><span class="flex-1 truncate text-sm">${quiz.name || 'Untitled Battle'}</span><span class="text-xs font-black opacity-60 shrink-0">${qCount}Q</span>`;
                btn.onclick = () => selectCollection(quiz.id);
                list.appendChild(btn);
            });
            const activeQuiz = collections.find(c => c.id === currentCollectionId);
            const nameInput = document.getElementById('quiz-name-input');
            if (nameInput) nameInput.value = activeQuiz ? activeQuiz.name : "";
            const landingTitle = document.getElementById('landing-title');
            const landingDesc = document.getElementById('landing-desc');
            const startBtn = document.getElementById('start-btn');
            if (activeQuiz) {
                landingTitle.textContent = activeQuiz.name.toUpperCase();
                const cnt = activeQuiz.questions.filter(q => isQuestionValid(q)).length;
                landingDesc.textContent = `${cnt} question${cnt !== 1 ? 's' : ''} ready for battle. Are you?`;
                startBtn.disabled = cnt === 0;
            } else {
                landingTitle.textContent = "NO BATTLE LOADED";
                landingDesc.textContent = "Please create or select a quiz in SETUP.";
                startBtn.disabled = true;
            }
            lucide.createIcons();
        }

        function addQuestion(type = 'mc') {
            currentQuestions.push(makeDefaultQuestion(type));
            saveData();
            renderEditor();
            setTimeout(() => { const editor = document.getElementById('questions-editor'); editor.scrollTop = editor.scrollHeight; }, 50);
        }

        function removeQuestion(idx) {
            if (currentQuestions.length <= 1) return;
            currentQuestions.splice(idx, 1);
            saveData();
            renderEditor();
        }

        function duplicateQuestion(idx) {
            const q = currentQuestions[idx];
            const copy = JSON.parse(JSON.stringify(q));
            currentQuestions.splice(idx + 1, 0, copy);
            saveData();
            renderEditor();
        }

        function changeQuestionType(idx, newType) {
            const old = currentQuestions[idx];
            const fresh = makeDefaultQuestion(newType);
            fresh.q = old.q || '';
            fresh.e = old.e || '';
            currentQuestions[idx] = fresh;
            saveData();
            renderEditor();
        }

        function addAcceptedAnswer(idx) {
            const q = currentQuestions[idx];
            if (!q.answers) q.answers = [];
            q.answers.push('');
            saveData();
            renderEditor();
        }

        function removeAcceptedAnswer(idx, aIdx) {
            const q = currentQuestions[idx];
            if (q.answers.length <= 1) return;
            q.answers.splice(aIdx, 1);
            saveData();
            renderEditor();
        }

        function updateAcceptedAnswer(idx, aIdx, val) {
            currentQuestions[idx].answers[aIdx] = val;
            saveData();
        }

        function addOrderItem(idx) {
            const q = currentQuestions[idx];
            if (!q.items) q.items = [];
            q.items.push('');
            saveData();
            renderEditor();
        }

        function removeOrderItem(idx, iIdx) {
            const q = currentQuestions[idx];
            if (q.items.length <= 2) return;
            q.items.splice(iIdx, 1);
            saveData();
            renderEditor();
        }

        function updateOrderItem(idx, iIdx, val) {
            currentQuestions[idx].items[iIdx] = val;
            saveData();
        }

        function editorBodyHTML(q, idx) {
            const type = getQType(q);
            const optionColors = ['text-pink', 'text-orange', 'text-blue', 'text-green'];
            const optionLetters = ['A', 'B', 'C', 'D'];

            switch (type) {
                case 'tf':
                    return `<div class="flex gap-3 px-5 pb-2">
                        <label class="answer-strip flex-1 ${q.a === 0 ? 'is-correct' : ''} cursor-pointer justify-center">
                            <input type="radio" name="correct-${idx}" ${q.a === 0 ? 'checked' : ''} onchange="updateQuestion(${idx},'a',0); renderEditor();" class="w-4 h-4 accent-green cursor-pointer shrink-0">
                            <span class="text-sm font-black text-green">TRUE</span>
                        </label>
                        <label class="answer-strip flex-1 ${q.a === 1 ? 'is-correct' : ''} cursor-pointer justify-center">
                            <input type="radio" name="correct-${idx}" ${q.a === 1 ? 'checked' : ''} onchange="updateQuestion(${idx},'a',1); renderEditor();" class="w-4 h-4 accent-green cursor-pointer shrink-0">
                            <span class="text-sm font-black text-pink">FALSE</span>
                        </label>
                    </div>`;

                case 'text':
                    const answers = q.answers || [''];
                    return `<div class="px-5 pb-2">
                        <p class="text-[9px] font-black text-green uppercase tracking-[0.2em] mb-2">Accepted Answers</p>
                        <div class="space-y-2">
                            ${answers.map((a, aIdx) => `<div class="flex items-center gap-2">
                                <span class="text-xs font-black text-green shrink-0">${aIdx + 1}.</span>
                                <input type="text" value="${a}" oninput="updateAcceptedAnswer(${idx},${aIdx},this.value)"
                                    placeholder="Accepted answer…"
                                    class="flex-1 bg-white dark:bg-slate-900 border-2 border-green/30 dark:border-green/20 rounded-lg px-3 py-1.5 font-bold text-sm text-dark dark:text-slate-200 focus:outline-none focus:border-green transition-colors">
                                ${answers.length > 1 ? `<button onclick="removeAcceptedAnswer(${idx},${aIdx})" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-pink shrink-0"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
                            </div>`).join('')}
                        </div>
                        <button onclick="addAcceptedAnswer(${idx})" class="mt-2 text-xs font-black text-green hover:text-green/80 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Add alternative</button>
                        <p class="mt-1.5 text-[10px] text-slate-400 font-semibold">Matching is case-insensitive. Add common spellings as alternatives.</p>
                    </div>`;

                case 'fill':
                    return `<div class="px-5 pb-1">
                        <p class="text-[10px] text-slate-400 font-semibold mb-2"><i data-lucide="info" class="w-3 h-3 inline -mt-0.5"></i> Use <code class="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[10px]">___</code> in your question to mark the blank.</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 px-5 pb-2">${(q.o || []).map((opt, oIdx) => `<label class="answer-strip ${q.a === oIdx ? 'is-correct' : ''} cursor-pointer">
                        <input type="radio" name="correct-${idx}" ${q.a === oIdx ? 'checked' : ''} onchange="updateQuestion(${idx},'a',${oIdx}); renderEditor();" class="w-4 h-4 accent-green cursor-pointer shrink-0">
                        <span class="text-xs font-black ${optionColors[oIdx]} shrink-0 w-5 text-center">${optionLetters[oIdx]}</span>
                        <input type="text" value="${opt}" oninput="updateOption(${idx},${oIdx},this.value)" placeholder="Choice ${optionLetters[oIdx]}…"
                            class="flex-1 bg-transparent border-none outline-none font-bold text-sm text-dark dark:text-slate-200 placeholder-slate-300 min-w-0">
                    </label>`).join('')}</div>`;

                case 'order':
                    const items = q.items || ['', ''];
                    return `<div class="px-5 pb-2">
                        <p class="text-[9px] font-black text-orange uppercase tracking-[0.2em] mb-2">Items (in correct order)</p>
                        <div class="space-y-2">
                            ${items.map((item, iIdx) => `<div class="editor-order-item">
                                <span class="w-6 h-6 rounded bg-orange/20 text-orange flex items-center justify-center text-xs font-black shrink-0">${iIdx + 1}</span>
                                <input type="text" value="${item}" oninput="updateOrderItem(${idx},${iIdx},this.value)"
                                    placeholder="Item ${iIdx + 1}…"
                                    class="flex-1 bg-transparent border-none outline-none font-bold text-sm text-dark dark:text-slate-200 placeholder-slate-300 min-w-0">
                                ${items.length > 2 ? `<button onclick="removeOrderItem(${idx},${iIdx})" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-pink shrink-0"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
                            </div>`).join('')}
                        </div>
                        <button onclick="addOrderItem(${idx})" class="mt-2 text-xs font-black text-orange hover:text-orange/80 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Add item</button>
                        <p class="mt-1.5 text-[10px] text-slate-400 font-semibold">Enter items in the correct order. They will be shuffled during play.</p>
                    </div>`;

                default: // mc
                    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-2 px-5 pb-2">${(q.o || []).map((opt, oIdx) => `<label class="answer-strip ${q.a === oIdx ? 'is-correct' : ''} cursor-pointer">
                        <input type="radio" name="correct-${idx}" ${q.a === oIdx ? 'checked' : ''} onchange="updateQuestion(${idx},'a',${oIdx}); renderEditor();" class="w-4 h-4 accent-green cursor-pointer shrink-0">
                        <span class="text-xs font-black ${optionColors[oIdx]} shrink-0 w-5 text-center">${optionLetters[oIdx]}</span>
                        <input type="text" value="${opt}" oninput="updateOption(${idx},${oIdx},this.value)" placeholder="Choice ${optionLetters[oIdx]}…"
                            class="flex-1 bg-transparent border-none outline-none font-bold text-sm text-dark dark:text-slate-200 placeholder-slate-300 min-w-0">
                    </label>`).join('')}</div>`;
            }
        }

        function renderEditor() {
            const container = document.getElementById('questions-editor');
            container.innerHTML = '';
            currentQuestions.forEach((q, idx) => {
                const type = getQType(q);
                const typeInfo = Q_TYPES.find(t => t.key === type) || Q_TYPES[0];
                const card = document.createElement('div');
                card.className = 'bg-chalk dark:bg-slate-800 border-2 border-dark dark:border-slate-600 rounded-xl shadow-hard-sm relative group';
                card.innerHTML = `
                    <div class="flex items-center gap-3 px-5 pt-4 pb-3 border-b-2 border-dark/10 dark:border-slate-700">
                        <span class="w-8 h-8 rounded-lg bg-blue text-white flex items-center justify-center font-heading text-base border-2 border-dark shadow-hard-sm shrink-0">${idx + 1}</span>
                        <select onchange="changeQuestionType(${idx}, this.value)"
                            class="type-select text-[10px] font-black uppercase tracking-widest bg-chalk dark:bg-slate-700 border-2 border-dark/15 dark:border-slate-600 rounded-lg px-2 py-1 text-dark dark:text-white cursor-pointer focus:outline-none focus:border-blue">
                            ${Q_TYPES.map(t => `<option value="${t.key}" ${t.key === type ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                        <span class="flex-1"></span>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="duplicateQuestion(${idx})" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue hover:bg-blue/10 shrink-0" title="Duplicate Question"><i data-lucide="copy" class="w-4 h-4"></i></button>
                            <button onclick="removeQuestion(${idx})" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/10 shrink-0" title="Remove Question"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                    <div class="px-5 pt-3 pb-2">
                        <textarea oninput="updateQuestion(${idx},'q',this.value)"
                            placeholder="${type === 'fill' ? 'Type sentence with ___ for the blank…' : 'Type your question here…'}"
                            class="w-full bg-white dark:bg-slate-900 border-2 border-dark/20 dark:border-slate-600 rounded-xl px-4 py-3 font-bold text-base text-dark dark:text-white focus:outline-none focus:border-blue dark:focus:border-blue shadow-inner resize-none transition-colors" rows="2">${q.q}</textarea>
                    </div>
                    ${editorBodyHTML(q, idx)}
                    <div class="px-5 pb-4">
                        <div class="flex items-center gap-2 mb-1.5 cursor-pointer select-none" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('[data-lucide]').setAttribute('data-lucide', this.nextElementSibling.classList.contains('hidden') ? 'chevron-right' : 'chevron-down'); lucide.createIcons();">
                            <i data-lucide="${q.e ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 text-blue"></i>
                            <span class="text-[10px] font-black text-blue uppercase tracking-[0.2em]">Explanation (optional)</span>
                        </div>
                        <textarea oninput="updateQuestion(${idx},'e',this.value)"
                            placeholder="Why is this the correct answer? Add context for students…"
                            class="${q.e ? '' : 'hidden '}w-full bg-blue/5 dark:bg-blue/5 border-2 border-blue/20 dark:border-blue/30 rounded-xl px-4 py-2.5 font-semibold text-sm text-dark dark:text-slate-200 focus:outline-none focus:border-blue dark:focus:border-blue resize-none transition-colors placeholder-slate-400" rows="2">${q.e || ''}</textarea>
                    </div>`;
                container.appendChild(card);
            });
            lucide.createIcons();
        }

        function updateQuestion(idx, field, val) { currentQuestions[idx][field] = val; saveData(); }
        function updateOption(qIdx, oIdx, val) { currentQuestions[qIdx].o[oIdx] = val; saveData(); }

        async function saveData() {
            const payload = { collections, lastId: currentCollectionId, updatedAt: Date.now() };
            localStorage.setItem('prog_quiz_maker', JSON.stringify(payload));
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(async () => {
                try { await saveProgress('quiz_maker', payload); } catch (e) { console.warn('[Quiz] Cloud save failed:', e); }
            }, 2000);
        }

        async function loadData() {
            // Migrate old localStorage keys to the standard prog_ key
            const legacyLocal = localStorage.getItem('quiz_maker_collections');
            if (legacyLocal) {
                const legacyId = localStorage.getItem('quiz_maker_last_id');
                const migrated = { collections: JSON.parse(legacyLocal), lastId: legacyId, updatedAt: 0 };
                localStorage.setItem('prog_quiz_maker', JSON.stringify(migrated));
                localStorage.removeItem('quiz_maker_collections');
                localStorage.removeItem('quiz_maker_last_id');
            }

            let localData = null;
            const localRaw = localStorage.getItem('prog_quiz_maker');
            if (localRaw) {
                try { localData = JSON.parse(localRaw); } catch (e) { }
            }

            if (localData && localData.collections) {
                collections = localData.collections;
                currentCollectionId = localData.lastId || (collections[0] ? collections[0].id : null);
                const active = collections.find(c => c.id === currentCollectionId);
                currentQuestions = active ? active.questions : [];
            }

            try {
                const cloud = await loadProgress('quiz_maker');
                if (cloud && cloud.collections && cloud.collections.length > 0) {
                    const cloudTime = cloud.updatedAt || 0;
                    const localTime = localData?.updatedAt || 0;
                    if (cloudTime >= localTime || collections.length === 0) {
                        collections = cloud.collections;
                        currentCollectionId = cloud.lastId || collections[0].id;
                        const active = collections.find(c => c.id === currentCollectionId);
                        currentQuestions = active ? active.questions : (collections[0] ? collections[0].questions : []);
                        localStorage.setItem('prog_quiz_maker', JSON.stringify(cloud));
                        if (isSetupMode) { renderCollections(); renderEditor(); }
                    }
                }
            } catch (e) { console.warn('[Quiz] Cloud load failed:', e); }
            if (collections.length === 0) createNewCollection();
        }

        function loadPreset(key, title) {
            if (PRESETS[key]) {
                const id = 'quiz_preset_' + key + '_' + Date.now();
                const newQuiz = { id, name: title || key, questions: JSON.parse(JSON.stringify(PRESETS[key])), timestamp: Date.now() };
                collections.push(newQuiz);
                currentCollectionId = id;
                currentQuestions = newQuiz.questions;
                saveData();
                renderCollections();
                renderEditor();
                AudioEngine.playTone(800, 'sine', 0.1);
            }
        }

        function saveAndPlay() { saveData(); toggleMode('play'); }

        // ── Bulk Import ──
        let parsedImportQuestions = [];

        function openImportModal() {
            document.getElementById('import-textarea').value = '';
            parsedImportQuestions = [];
            updateImportPreview();
            document.getElementById('import-overlay').classList.add('open');
            lucide.createIcons();
            setTimeout(() => document.getElementById('import-textarea').focus(), 300);
        }

        function closeImportModal() {
            document.getElementById('import-overlay').classList.remove('open');
        }

        function parseBulkImport(text) {
            const questions = [];
            const blocks = text.split(/\n\s*\n/); // split by blank lines

            for (const block of blocks) {
                const lines = block.split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length === 0) continue;

                let type = 'mc';
                const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                let hasQuestion = false;
                let qText = '', options = ['', '', '', ''], correctIdx = 0, explanation = '';
                let acceptedAnswers = [];
                let orderItems = [];
                let tfAnswer = 0;

                for (const line of lines) {
                    const match = line.match(/^([A-Z]+):\s*(.*)$/i);
                    if (!match) continue;
                    const prefix = match[1].toUpperCase();
                    const value = match[2].trim();

                    switch (prefix) {
                        case 'T': type = value.toLowerCase(); break;
                        case 'Q': qText = value; hasQuestion = true; break;
                        case 'A': options[0] = value; break;
                        case 'B': options[1] = value; break;
                        case 'C': options[2] = value; break;
                        case 'D': options[3] = value; break;
                        case 'X':
                            const letter = value.toUpperCase().trim();
                            if (letter === 'TRUE' || letter === 'T') tfAnswer = 0;
                            else if (letter === 'FALSE' || letter === 'F') tfAnswer = 1;
                            else if (answerMap[letter] !== undefined) correctIdx = answerMap[letter];
                            break;
                        case 'E': explanation = value; break;
                        case 'ANS': acceptedAnswers.push(value); break;
                        case 'I': orderItems.push(value); break;
                        case 'ITEMS':
                            orderItems = value.split(/\s*[,|]\s*/).filter(s => s);
                            break;
                    }
                }

                if (!hasQuestion || !qText) continue;

                switch (type) {
                    case 'tf':
                        questions.push({ type: 'tf', q: qText, a: tfAnswer, e: explanation });
                        break;
                    case 'text':
                        if (acceptedAnswers.length === 0) acceptedAnswers = [''];
                        questions.push({ type: 'text', q: qText, answers: acceptedAnswers, e: explanation });
                        break;
                    case 'fill':
                        questions.push({ type: 'fill', q: qText, o: options, a: correctIdx, e: explanation });
                        break;
                    case 'order':
                        if (orderItems.length < 2) orderItems = ['', ''];
                        questions.push({ type: 'order', q: qText, items: orderItems, e: explanation });
                        break;
                    default:
                        questions.push({ type: 'mc', q: qText, o: options, a: correctIdx, e: explanation });
                        break;
                }
            }
            return questions;
        }

        function updateImportPreview() {
            const text = document.getElementById('import-textarea').value;
            parsedImportQuestions = parseBulkImport(text);
            const count = parsedImportQuestions.length;
            const previewEl = document.getElementById('import-preview-count');
            const confirmBtn = document.getElementById('import-confirm-btn');

            const span = previewEl.querySelector('span');
            if (count === 0) {
                span.textContent = '0 questions detected';
                span.className = '';
                confirmBtn.disabled = true;
            } else {
                span.textContent = `${count} question${count !== 1 ? 's' : ''} detected ✓`;
                span.className = 'text-green';
                confirmBtn.disabled = false;
            }
            lucide.createIcons();
        }

        function confirmImport() {
            if (parsedImportQuestions.length === 0) return;

            const quiz = collections.find(c => c.id === currentCollectionId);
            if (!quiz) return;

            // Remove empty placeholder questions
            const existing = quiz.questions.filter(q => q.q.trim() !== '');
            quiz.questions = [...existing, ...parsedImportQuestions];
            currentQuestions = quiz.questions;

            saveData();
            renderCollections();
            renderEditor();
            closeImportModal();
            AudioEngine.playTone(700, 'sine', 0.15);
            setTimeout(() => AudioEngine.playTone(900, 'sine', 0.15), 120);

            // Scroll to bottom of editor
            setTimeout(() => {
                const editor = document.getElementById('questions-editor');
                editor.scrollTop = editor.scrollHeight;
            }, 100);
        }

        function copyTemplate() {
            const template = `Q: What is the capital of France?\nA: London\nB: Paris\nC: Berlin\nD: Madrid\nX: B\nE: Paris has been the capital since the 10th century.\n\nT: tf\nQ: The sun is a star.\nX: True\nE: The sun is classified as a G-type main-sequence star.\n\nT: text\nQ: What color do you get when you mix red and blue?\nANS: purple\nANS: Purple\nE: Red and blue make purple.\n\nT: fill\nQ: She ___ to school every day.\nA: walks\nB: running\nC: eat\nD: sleep\nX: A\n\nT: order\nQ: Put these numbers in order from smallest to largest.\nI: 1\nI: 5\nI: 10\nI: 50`;
            navigator.clipboard.writeText(template).then(() => {
                AudioEngine.playTone(600, 'sine', 0.1);
            });
        }

        let currentShuffledOrder = [];

        function shuffleArray(arr) {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        function resetQuizState() {
            currentStep = 0; score = 0; isAnswering = false;
            document.getElementById('landing-screen').classList.remove('hidden');
            document.getElementById('quiz-screen').classList.add('hidden');
            document.getElementById('result-screen').classList.add('hidden');
            document.getElementById('feedback-controls').classList.add('hidden');
            document.getElementById('main-reveal-btn').classList.remove('hidden');
        }

        function isQuestionValid(q) {
            if (!q.q || !q.q.trim()) return false;
            const type = getQType(q);
            if (type === 'text') return (q.answers || []).some(a => a.trim());
            if (type === 'order') return (q.items || []).filter(i => i.trim()).length >= 2;
            if (type === 'mc' || type === 'fill') return (q.o || []).some(o => o.trim());
            if (type === 'tf') return q.a === 0 || q.a === 1;
            return true;
        }

        function escapeHtml(str) {
            return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        async function startQuiz() {
            const validQ = currentQuestions.filter(q => isQuestionValid(q));
            if (validQ.length === 0) {
                await showAlertModal("Please add some questions in SETUP before starting!", { title: "No Questions", icon: "help-circle", iconColor: "orange" });
                toggleMode('setup');
                return;
            }
            currentQuestions = validQ;
            currentStep = 0; score = 0; isAnswering = false;
            document.getElementById('landing-screen').classList.add('hidden');
            document.getElementById('result-screen').classList.add('hidden');
            document.getElementById('quiz-screen').classList.remove('hidden');
            renderDots();
            showQuestion();
        }

        function renderDots() {
            const container = document.getElementById('dots-container');
            container.innerHTML = '';
            currentQuestions.forEach((_, idx) => {
                const dot = document.createElement('div');
                dot.className = 'dot';
                dot.id = `dot-${idx}`;
                container.appendChild(dot);
            });
        }

        function updateDots() {
            currentQuestions.forEach((_, idx) => {
                const dot = document.getElementById(`dot-${idx}`);
                if (!dot) return;
                if (idx < currentStep) dot.className = 'dot completed';
                else if (idx === currentStep) dot.className = 'dot active';
                else dot.className = 'dot';
            });
        }

        function fitText(el, container, max, min) {
            if (!el || !container) return;
            let size = max;
            el.style.fontSize = size + 'px';

            const isOverflowing = () => {
                return el.scrollHeight > container.clientHeight || el.scrollWidth > container.clientWidth;
            };

            while (isOverflowing() && size > min) {
                size -= 1;
                el.style.fontSize = size + 'px';
            }
        }

        function showQuestion() {
            isAnswering = false;
            const q = currentQuestions[currentStep];
            const type = getQType(q);
            const qText = document.getElementById('question-text');
            document.getElementById('progress-text').textContent = `${currentStep + 1}/${currentQuestions.length}`;
            document.getElementById('score-text').textContent = score;
            document.getElementById('feedback-controls').classList.add('hidden');
            document.getElementById('main-reveal-btn').classList.remove('hidden');
            hideExplanation();
            const typeLabel = (Q_TYPES.find(t => t.key === type) || Q_TYPES[0]).label.toUpperCase();
            document.getElementById('question-tag').textContent = `#${currentStep + 1} · ${typeLabel}`;
            updateDots();

            const container = document.getElementById('options-container');
            container.innerHTML = '';

            // Render question text (fill type uses special rendering)
            if (type === 'fill') {
                const parts = (q.q || '').split(/___+/);
                qText.innerHTML = parts.map((p, i) => i < parts.length - 1
                    ? `${p}<span class="fill-blank" id="fill-blank-display">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`
                    : p).join('');
            } else {
                qText.textContent = q.q || "Battle Ready?";
            }
            fitText(qText, document.getElementById('question-fit-container'), 72, 18);

            switch (type) {
                case 'tf': renderTFPlay(q, container); break;
                case 'text': renderTextPlay(q, container); break;
                case 'fill': renderFillPlay(q, container); break;
                case 'order': renderOrderPlay(q, container); break;
                default: renderMCPlay(q, container); break;
            }
            lucide.createIcons();
        }

        function renderMCPlay(q, container) {
            container.className = 'flex-[1.5] grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 pb-1 pr-1 overflow-hidden';
            const validOptions = q.o.map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
            validOptions.forEach((optObj, displayIdx) => {
                const btn = document.createElement('button');
                const color = OPTION_COLORS[displayIdx % 4];
                const shape = OPTION_SHAPES[displayIdx % 4];
                btn.className = `option-btn btn-chunky ${color} text-white px-5 py-3 rounded-xl shadow-hard font-heading transition-all w-full flex items-center text-left relative min-h-0 h-full`;
                btn.innerHTML = `<div class="shape-indicator"><i data-lucide="${shape}" class="w-5 h-5 text-white fill-current"></i></div><div class="flex-1 h-full flex items-center overflow-hidden opt-text-container"><span class="leading-tight w-full">${optObj.text}</span></div><span class="kbd-label">Key ${displayIdx + 1}</span>`;
                btn.onclick = () => selectOption(optObj.index);
                container.appendChild(btn);
                const optText = btn.querySelector('span');
                const optContainer = btn.querySelector('.opt-text-container');
                fitText(optText, optContainer, 32, 12);
            });
        }

        function renderTFPlay(q, container) {
            container.className = 'flex-[1.5] flex gap-4 min-h-0 pb-1 overflow-hidden items-stretch';
            const btns = [
                { label: 'TRUE', icon: 'check', color: 'bg-green', idx: 0 },
                { label: 'FALSE', icon: 'x', color: 'bg-pink', idx: 1 }
            ];
            btns.forEach(b => {
                const btn = document.createElement('button');
                btn.className = `tf-btn btn-chunky ${b.color} text-white rounded-2xl shadow-hard font-heading flex flex-col items-center justify-center gap-2`;
                btn.innerHTML = `<i data-lucide="${b.icon}" class="w-10 h-10"></i><span>${b.label}</span><span class="kbd-label">Key ${b.idx + 1}</span>`;
                btn.onclick = () => selectOption(b.idx);
                container.appendChild(btn);
            });
        }

        function renderTextPlay(q, container) {
            container.className = 'flex-[1.5] flex flex-col items-center justify-center gap-4 min-h-0 pb-1 overflow-hidden';
            container.innerHTML = `
                <input type="text" id="text-answer-field" class="text-answer-input" placeholder="Type your answer…" autocomplete="off" spellcheck="false">
                <button id="text-submit-btn" onclick="submitTextAnswer()" class="btn-chunky bg-blue text-white px-10 py-3 rounded-xl shadow-hard font-heading text-xl flex items-center gap-2">
                    <i data-lucide="send" class="w-5 h-5"></i> SUBMIT
                </button>
                <div id="text-answer-feedback" class="hidden"></div>`;
            setTimeout(() => {
                const field = document.getElementById('text-answer-field');
                if (field) field.focus();
            }, 100);
        }

        function renderFillPlay(q, container) {
            container.className = 'flex-[1.5] grid grid-cols-2 md:grid-cols-4 gap-3 min-h-0 pb-1 pr-1 overflow-hidden items-start content-start';
            const validOptions = (q.o || []).map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
            validOptions.forEach((optObj, displayIdx) => {
                const btn = document.createElement('button');
                const color = OPTION_COLORS[displayIdx % 4];
                btn.className = `fill-option btn-chunky ${color} text-white px-4 py-3 rounded-xl shadow-hard font-heading text-lg transition-all w-full text-center`;
                btn.textContent = optObj.text;
                btn.onclick = () => selectOption(optObj.index);
                container.appendChild(btn);
            });
        }

        function renderOrderPlay(q, container) {
            container.className = 'flex-[1.5] flex flex-col gap-2 min-h-0 pb-1 overflow-y-auto custom-scrollbar';
            const items = q.items || [];
            currentShuffledOrder = shuffleArray(items.map((item, i) => ({ text: item, correctIdx: i })));
            // Ensure shuffled is different from correct if possible
            if (items.length > 1) {
                let attempts = 0;
                while (attempts < 10 && currentShuffledOrder.every((s, i) => s.correctIdx === i)) {
                    currentShuffledOrder = shuffleArray(items.map((item, i) => ({ text: item, correctIdx: i })));
                    attempts++;
                }
            }
            renderOrderItems(container);
            // Add check button
            const checkDiv = document.createElement('div');
            checkDiv.className = 'flex justify-center mt-2';
            checkDiv.innerHTML = `<button id="order-check-btn" onclick="checkOrder()" class="btn-chunky bg-blue text-white px-10 py-3 rounded-xl shadow-hard font-heading text-xl flex items-center gap-2">
                <i data-lucide="check-circle" class="w-5 h-5"></i> CHECK ORDER
            </button>`;
            container.appendChild(checkDiv);
            // Hide the reveal button for order type — use CHECK ORDER instead
            document.getElementById('main-reveal-btn').classList.add('hidden');
        }

        function renderOrderItems(container) {
            // Remove existing items but keep check button
            container.querySelectorAll('.order-item').forEach(el => el.remove());
            const checkDiv = container.querySelector('div:last-child');
            currentShuffledOrder.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'order-item';
                div.draggable = true;
                div.dataset.idx = idx;
                div.innerHTML = `<div class="drag-handle"><i data-lucide="grip-vertical" class="w-5 h-5"></i></div>
                    <div class="order-num bg-slate-100 dark:bg-slate-700 text-dark dark:text-white">${idx + 1}</div>
                    <span class="font-bold text-dark dark:text-white flex-1">${item.text}</span>`;
                // Drag events
                div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', idx); div.classList.add('dragging'); });
                div.addEventListener('dragend', () => { div.classList.remove('dragging'); container.querySelectorAll('.order-item').forEach(el => el.classList.remove('drag-over')); });
                div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
                div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
                div.addEventListener('drop', (e) => {
                    e.preventDefault();
                    div.classList.remove('drag-over');
                    if (isAnswering) return;
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIdx = idx;
                    if (fromIdx === toIdx) return;
                    const [moved] = currentShuffledOrder.splice(fromIdx, 1);
                    currentShuffledOrder.splice(toIdx, 0, moved);
                    renderOrderItems(container);
                    lucide.createIcons();
                });
                if (checkDiv) container.insertBefore(div, checkDiv);
                else container.appendChild(div);
            });
            lucide.createIcons();
        }

        function selectOption(idx) {
            if (isAnswering) return;
            isAnswering = true;
            const q = currentQuestions[currentStep];
            const type = getQType(q);
            const correct = q.a;
            const container = document.getElementById('options-container');

            if (type === 'tf') {
                const btns = container.querySelectorAll('.tf-btn');
                btns.forEach((btn, bIdx) => {
                    btn.classList.add('dimmed');
                    if (bIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                    else if (bIdx === idx) { btn.classList.remove('dimmed'); btn.classList.add('wrong'); }
                });
            } else if (type === 'fill') {
                const btns = container.querySelectorAll('.fill-option');
                const validOptions = (q.o || []).map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
                btns.forEach((btn, dIdx) => {
                    const originalIdx = validOptions[dIdx].index;
                    btn.classList.add('dimmed');
                    if (originalIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                    else if (originalIdx === idx) { btn.classList.remove('dimmed'); btn.classList.add('wrong'); }
                });
                // Fill the blank display
                const blank = document.getElementById('fill-blank-display');
                if (blank) blank.textContent = q.o[correct];
            } else {
                // mc
                const btns = container.querySelectorAll('.option-btn');
                const validOptions = q.o.map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
                btns.forEach((btn, dIdx) => {
                    const originalIdx = validOptions[dIdx].index;
                    btn.classList.add('dimmed');
                    if (originalIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                    else if (originalIdx === idx) { btn.classList.remove('dimmed'); btn.classList.add('wrong'); }
                });
            }

            if (idx === correct) { score++; AudioEngine.correct(); confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ['#00E676', '#2979FF', '#FF8C42'] }); }
            else { AudioEngine.wrong(); }
            document.getElementById('score-text').textContent = score;
            document.getElementById('feedback-controls').classList.remove('hidden');
            document.getElementById('main-reveal-btn').classList.add('hidden');
            showExplanation(q);
            lucide.createIcons();
        }

        function submitTextAnswer() {
            if (isAnswering) return;
            const field = document.getElementById('text-answer-field');
            const submitBtn = document.getElementById('text-submit-btn');
            const feedback = document.getElementById('text-answer-feedback');
            if (!field) return;
            const userAnswer = field.value.trim();
            if (!userAnswer) { field.focus(); return; }

            isAnswering = true;
            const q = currentQuestions[currentStep];
            const accepted = (q.answers || []).filter(a => a.trim());
            const isCorrect = accepted.some(a => a.trim().toLowerCase() === userAnswer.toLowerCase());

            field.disabled = true;
            submitBtn.classList.add('hidden');
            feedback.classList.remove('hidden');

            if (isCorrect) {
                field.classList.add('correct');
                score++;
                AudioEngine.correct();
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ['#00E676', '#2979FF', '#FF8C42'] });
                feedback.innerHTML = `<div class="correct-answer-reveal bg-green/10 border-2 border-green/30 rounded-xl px-5 py-3 text-center">
                    <span class="font-heading text-green text-xl">CORRECT!</span>
                </div>`;
            } else {
                field.classList.add('wrong');
                AudioEngine.wrong();
                feedback.innerHTML = `<div class="correct-answer-reveal bg-pink/10 border-2 border-pink/30 rounded-xl px-5 py-3 text-center">
                    <p class="font-heading text-pink text-lg">NOT QUITE</p>
                    <p class="text-sm font-bold text-dark dark:text-white mt-1">Accepted: <span class="text-green font-black">${accepted.map(escapeHtml).join(' / ')}</span></p>
                </div>`;
            }

            document.getElementById('score-text').textContent = score;
            document.getElementById('feedback-controls').classList.remove('hidden');
            document.getElementById('main-reveal-btn').classList.add('hidden');
            showExplanation(q);
            lucide.createIcons();
        }

        function checkOrder() {
            if (isAnswering) return;
            isAnswering = true;
            const q = currentQuestions[currentStep];
            const container = document.getElementById('options-container');
            const allCorrect = currentShuffledOrder.every((s, i) => s.correctIdx === i);

            // Mark each item
            const items = container.querySelectorAll('.order-item');
            items.forEach((el, i) => {
                el.draggable = false;
                if (currentShuffledOrder[i].correctIdx === i) {
                    el.classList.add('correct-pos');
                } else {
                    el.classList.add('wrong-pos');
                }
            });

            const checkBtn = document.getElementById('order-check-btn');
            if (checkBtn) checkBtn.classList.add('hidden');

            if (allCorrect) {
                score++;
                AudioEngine.correct();
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ['#00E676', '#2979FF', '#FF8C42'] });
            } else {
                AudioEngine.wrong();
                // Show correct order below
                const correctDiv = document.createElement('div');
                correctDiv.className = 'order-check-result bg-green/10 border-2 border-green/30 rounded-xl px-4 py-3 mt-2';
                correctDiv.innerHTML = `<p class="text-[9px] font-black text-green uppercase tracking-[0.2em] mb-1">Correct Order</p>
                    <p class="font-bold text-sm text-dark dark:text-white">${(q.items || []).map((item, i) => `<span class="inline-block mr-1">${i + 1}. ${item}</span>`).join(' → ')}</p>`;
                container.appendChild(correctDiv);
            }

            document.getElementById('score-text').textContent = score;
            document.getElementById('feedback-controls').classList.remove('hidden');
            showExplanation(q);
            lucide.createIcons();
        }

        function revealAnswer() {
            if (isAnswering) return;
            isAnswering = true;
            const q = currentQuestions[currentStep];
            const type = getQType(q);
            const correct = q.a;
            const container = document.getElementById('options-container');

            if (type === 'tf') {
                const btns = container.querySelectorAll('.tf-btn');
                btns.forEach((btn, bIdx) => {
                    btn.classList.add('dimmed');
                    if (bIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                });
            } else if (type === 'text') {
                const field = document.getElementById('text-answer-field');
                const submitBtn = document.getElementById('text-submit-btn');
                const feedback = document.getElementById('text-answer-feedback');
                if (field) field.disabled = true;
                if (submitBtn) submitBtn.classList.add('hidden');
                if (feedback) {
                    feedback.classList.remove('hidden');
                    const accepted = (q.answers || []).filter(a => a.trim());
                    feedback.innerHTML = `<div class="correct-answer-reveal bg-blue/10 border-2 border-blue/30 rounded-xl px-5 py-3 text-center">
                        <p class="text-sm font-bold text-dark dark:text-white">Answer: <span class="text-green font-black">${accepted.map(escapeHtml).join(' / ')}</span></p>
                    </div>`;
                }
            } else if (type === 'fill') {
                const btns = container.querySelectorAll('.fill-option');
                const validOptions = (q.o || []).map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
                btns.forEach((btn, dIdx) => {
                    const originalIdx = validOptions[dIdx].index;
                    btn.classList.add('dimmed');
                    if (originalIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                });
                const blank = document.getElementById('fill-blank-display');
                if (blank) blank.textContent = q.o[correct];
            } else if (type === 'order') {
                // Order reveal shows correct order
                checkOrder();
                return;
            } else {
                // mc
                const btns = container.querySelectorAll('.option-btn');
                const validOptions = q.o.map((opt, i) => ({ text: opt, index: i })).filter(o => o.text.trim() !== "");
                btns.forEach((btn, dIdx) => {
                    const originalIdx = validOptions[dIdx].index;
                    btn.classList.add('dimmed');
                    if (originalIdx === correct) { btn.classList.remove('dimmed'); btn.classList.add('correct'); }
                });
            }

            AudioEngine.playTone(440, 'sine', 0.25, 0.15);
            document.getElementById('feedback-controls').classList.remove('hidden');
            document.getElementById('main-reveal-btn').classList.add('hidden');
            showExplanation(q);
            lucide.createIcons();
        }

        function showExplanation(q) {
            const panel = document.getElementById('explanation-panel');
            const textEl = document.getElementById('explanation-text');
            if (q.e && q.e.trim()) {
                textEl.textContent = q.e;
                requestAnimationFrame(() => panel.classList.add('visible'));
                lucide.createIcons();
            }
        }

        function hideExplanation() {
            const panel = document.getElementById('explanation-panel');
            panel.classList.remove('visible');
        }

        function nextQuestion() { currentStep++; if (currentStep < currentQuestions.length) showQuestion(); else showResult(); }

        function showResult() {
            document.getElementById('quiz-screen').classList.add('hidden');
            document.getElementById('result-screen').classList.remove('hidden');
            document.getElementById('final-score').textContent = `${score}/${currentQuestions.length}`;
            const ratio = score / (currentQuestions.length || 1);
            let rank = "F", msg = "Keep Training! 💪";
            if (ratio >= 0.9) { rank = "S"; msg = "LEGENDARY! 🏆"; }
            else if (ratio >= 0.8) { rank = "A"; msg = "EXCELLENT! ⭐"; }
            else if (ratio >= 0.6) { rank = "B"; msg = "GREAT JOB! 👍"; }
            else if (ratio >= 0.4) { rank = "C"; msg = "NOT BAD! 🎯"; }
            const rankEl = document.getElementById('final-rank');
            rankEl.textContent = rank; rankEl.className = 'text-4xl font-heading rank-' + rank.toLowerCase();
            document.getElementById('final-message').textContent = msg;
            if (ratio >= 0.8) confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        }

        window.addEventListener('keydown', (e) => {
            // Close import modal on Escape
            if (e.key === 'Escape' && document.getElementById('import-overlay').classList.contains('open')) {
                closeImportModal(); return;
            }
            // Don't fire quiz hotkeys when import modal is open
            if (document.getElementById('import-overlay').classList.contains('open')) return;
            if (isSetupMode) return;
            const quizScreen = document.getElementById('quiz-screen');
            if (quizScreen.classList.contains('hidden')) return;

            const q = currentQuestions[currentStep];
            const type = q ? getQType(q) : 'mc';

            if (!isAnswering) {
                if (type === 'text') {
                    // Enter submits text answer (but only if field is focused or answer typed)
                    if (e.key === 'Enter') { e.preventDefault(); submitTextAnswer(); return; }
                } else if (type === 'order') {
                    // Enter checks order
                    if (e.key === 'Enter') { e.preventDefault(); checkOrder(); return; }
                } else if (type === 'tf') {
                    if (e.key === '1' || e.key.toLowerCase() === 't') { selectOption(0); return; }
                    if (e.key === '2' || e.key.toLowerCase() === 'f') { selectOption(1); return; }
                } else if (type === 'fill') {
                    if (['1', '2', '3', '4'].includes(e.key)) {
                        const btns = document.querySelectorAll('.fill-option');
                        if (btns[parseInt(e.key) - 1]) btns[parseInt(e.key) - 1].click();
                        return;
                    }
                } else {
                    // mc
                    if (['1', '2', '3', '4'].includes(e.key)) {
                        const btns = document.querySelectorAll('.option-btn');
                        if (btns[parseInt(e.key) - 1]) btns[parseInt(e.key) - 1].click();
                        return;
                    }
                }
                if (e.key.toLowerCase() === 'r') { revealAnswer(); return; }
            }

            if ((e.key === 'Enter' || e.key === ' ') && !document.getElementById('feedback-controls').classList.contains('hidden')) { e.preventDefault(); nextQuestion(); }
        });

        const AudioEngine = {
            playTone(freq, type, duration, vol = 0.1) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
                    gain.gain.setValueAtTime(vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.start(); osc.stop(ctx.currentTime + duration);
                } catch (e) { }
            },
            correct() { this.playTone(600, 'sine', 0.2); setTimeout(() => this.playTone(900, 'sine', 0.3), 100); },
            wrong() { this.playTone(250, 'sawtooth', 0.3); }
        };

        window.onload = async () => {
            await requireAuth();
            initTheme();
            try {
                const res = await fetch('presets.json');
                PRESETS = await res.json();
            } catch (e) {
                console.warn('Could not load presets.json:', e);
            }
            await loadData();
            lucide.createIcons();
        };
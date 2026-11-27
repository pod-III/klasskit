/* ============================================
   FILL IN THE BLANK - Cloze Grammar Engine
   KlassKit 1.9.1 Modular Script
   ============================================ */

(function () {
    'use strict';

    var QUESTIONS_KEY = 'englishGameQuestions';
    var SCORE_KEY = 'englishGameScore';
    var THEME_KEY = 'theme_fill-it';
    var PREFS_KEY = 'kk_fill_it_prefs_v2';

    var ICON_FALLBACKS = {
        'edit-3': 'pen-line',
        'check-circle': 'circle-check',
        'alert-circle': 'triangle-alert',
        'alert-triangle': 'triangle-alert',
        'x-octagon': 'circle-x'
    };

    function tokenizeText(text) {
        var tokens = [];
        var regex = /[\w'-]+|\s+|[^\w\s'-]+/g;
        var match;
        while ((match = regex.exec(String(text || ''))) !== null) {
            var str = match[0];
            var type = 'punctuation';
            if (/^\s+$/.test(str)) type = 'space';
            else if (/^[\w'-]+$/.test(str)) type = 'word';
            tokens.push({ text: str, type: type, isBlank: false, clue: '' });
        }
        return tokens;
    }

    function migrateOldQuestion(q) {
        if (!q || typeof q !== 'object') return null;
        if (q.rawText !== undefined && Array.isArray(q.tokens)) {
            return {
                rawText: String(q.rawText),
                tokens: q.tokens.map(function (t) {
                    return {
                        text: String(t.text || ''),
                        type: t.type || 'word',
                        isBlank: Boolean(t.isBlank),
                        clue: String(t.clue || '')
                    };
                })
            };
        }
        if (typeof q.sentence === 'string' && typeof q.answer === 'string') {
            var rawText = q.sentence.replace('_', q.answer);
            var tokens = tokenizeText(rawText);
            var answerLower = q.answer.toLowerCase();
            var blankToken = tokens.find(function (t) {
                return t.type === 'word' && t.text.toLowerCase() === answerLower;
            });
            if (blankToken) {
                blankToken.isBlank = true;
                blankToken.clue = String(q.clue || '');
            }
            return { rawText: rawText, tokens: tokens };
        }
        return null;
    }

    function buildDefaultQuestions() {
        var list = [
            {
                rawText: 'Plants need sunlight to grow. They also require water and nutrients from the soil. This process is called photosynthesis.',
                tokens: tokenizeText('Plants need sunlight to grow. They also require water and nutrients from the soil. This process is called photosynthesis.')
            },
            {
                rawText: 'The Great Wall of China is a famous landmark. It was built thousands of years ago to protect the empire. Today, it is visited by millions of tourists.',
                tokens: tokenizeText('The Great Wall of China is a famous landmark. It was built thousands of years ago to protect the empire. Today, it is visited by millions of tourists.')
            },
            {
                rawText: 'I went to the store to buy some groceries. I forgot my wallet at home so I had to go back. It was a very busy afternoon.',
                tokens: tokenizeText('I went to the store to buy some groceries. I forgot my wallet at home so I had to go back. It was a very busy afternoon.')
            }
        ];

        function markDefault(q, word, clue) {
            var tok = q.tokens.find(function (t) {
                return t.type === 'word' && t.text.toLowerCase() === word.toLowerCase() && !t.isBlank;
            });
            if (tok) {
                tok.isBlank = true;
                tok.clue = clue;
            }
        }

        markDefault(list[0], 'sunlight', 'Energy from the sun');
        markDefault(list[0], 'water', 'H2O');
        markDefault(list[0], 'photosynthesis', 'Process of making food');

        markDefault(list[1], 'China', 'Country with the Wall');
        markDefault(list[1], 'protect', 'To keep safe');
        markDefault(list[1], 'tourists', 'People who visit');

        markDefault(list[2], 'store', 'Place to buy things');
        markDefault(list[2], 'wallet', 'Used to carry money');
        markDefault(list[2], 'busy', 'Full of activity');

        return list;
    }

    var state = {
        questions: [],
        editorQuestions: [],
        orderQueue: [],
        queuePos: 0,
        currentQuestionIndex: 0,
        score: 0,
        showWordBank: false,
        orderMode: 'sequential',
        roundAwarded: false,
        focusedInputIndex: null,
        pendingConfirmFn: null,
        syncTimeout: null,
        toastTimer: null
    };

    // --- Safe Helpers ---
    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeIcon(name) {
        if (!name || typeof name !== 'string') return 'info';
        return ICON_FALLBACKS[name] || name;
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function setSlotIcon(slotId, iconName, iconClass) {
        var slot = $(slotId);
        if (!slot) return;
        slot.innerHTML = '<i data-lucide="' + escapeHTML(safeIcon(iconName)) + '" class="' + escapeHTML(iconClass || 'w-4 h-4') + '"></i>';
        refreshIcons();
    }

    function showToast(message, iconName) {
        var banner = $('toastBanner');
        var textEl = $('toastText');
        if (!banner || !textEl) return;

        textEl.textContent = message;
        setSlotIcon('toastIconSlot', iconName || 'info', 'w-4 h-4 text-blue');

        banner.classList.add('open');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function () {
            banner.classList.remove('open');
        }, 2400);
    }

    // --- Preferences & Cloud Sync ---
    function loadPrefs() {
        try {
            var raw = localStorage.getItem(PREFS_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.showWordBank === 'boolean') state.showWordBank = parsed.showWordBank;
                if (parsed.orderMode === 'shuffle' || parsed.orderMode === 'sequential') state.orderMode = parsed.orderMode;
            }
        } catch (e) {
            // ignore storage errors
        }
    }

    function savePrefs() {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify({
                showWordBank: state.showWordBank,
                orderMode: state.orderMode
            }));
        } catch (e) {
            // ignore storage errors
        }
    }

    function syncToCloud() {
        if (state.syncTimeout) clearTimeout(state.syncTimeout);
        state.syncTimeout = setTimeout(function () {
            if (typeof window.saveProgress === 'function') {
                window.saveProgress('fill_it', {
                    questions: state.questions,
                    score: state.score,
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                });
            }
        }, 1200);
    }

    function persistLocalQuestions() {
        try {
            localStorage.setItem(QUESTIONS_KEY, JSON.stringify(state.questions));
        } catch (e) {
            // ignore storage errors
        }
    }

    function updateScoreUI() {
        if ($('scoreDisplay')) $('scoreDisplay').textContent = String(state.score);
        try {
            localStorage.setItem(SCORE_KEY, String(state.score));
        } catch (e) {
            // ignore
        }
    }

    // --- Theme & Mode Toggles ---
    function syncThemeIcon() {
        var isDark = document.documentElement.classList.contains('dark');
        setSlotIcon('themeToggleIconSlot', isDark ? 'sun' : 'moon', 'w-4 h-4');
    }

    function toggleDarkMode() {
        var isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        try {
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        } catch (e) {
            // ignore
        }
        syncThemeIcon();
        syncToCloud();
    }

    function syncPreferenceButtons() {
        var bankBtn = $('wordBankToggleBtn');
        var bankBar = $('wordBankBar');
        if (bankBtn) {
            bankBtn.className = state.showWordBank
                ? 'btn-chunky bg-blue text-white rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5'
                : 'btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5';
            setSlotIcon('wordBankToggleIconSlot', 'book-open', state.showWordBank ? 'w-4 h-4 text-white' : 'w-4 h-4 text-blue');
        }
        if (bankBar) {
            bankBar.classList.toggle('is-hidden', !state.showWordBank);
        }

        var orderLabel = $('orderModeLabel');
        if (orderLabel) {
            orderLabel.textContent = state.orderMode === 'shuffle' ? 'Shuffle' : 'In Order';
        }
        setSlotIcon('orderModeIconSlot', state.orderMode === 'shuffle' ? 'shuffle' : 'list-ordered', 'w-3.5 h-3.5 text-pink');
    }

    function toggleWordBank() {
        state.showWordBank = !state.showWordBank;
        savePrefs();
        syncPreferenceButtons();
        renderWordBank();
    }

    function toggleOrderMode() {
        state.orderMode = state.orderMode === 'shuffle' ? 'sequential' : 'shuffle';
        rebuildOrderQueue(true);
        savePrefs();
        syncPreferenceButtons();
        renderCurrentQuestion();
        showToast(state.orderMode === 'shuffle' ? 'Order: Shuffle Deck' : 'Order: Sequential (1, 2, 3)', state.orderMode === 'shuffle' ? 'shuffle' : 'list-ordered');
    }

    function rebuildOrderQueue(keepCurrent, avoidFirstIndex) {
        var n = state.questions.length;
        var indices = [];
        for (var i = 0; i < n; i++) indices.push(i);

        if (state.orderMode === 'shuffle' && n > 1) {
            for (var j = n - 1; j > 0; j--) {
                var r = Math.floor(Math.random() * (j + 1));
                var tmp = indices[j];
                indices[j] = indices[r];
                indices[r] = tmp;
            }
            if (typeof avoidFirstIndex === 'number' && indices[0] === avoidFirstIndex) {
                var swapTmp = indices[0];
                indices[0] = indices[1];
                indices[1] = swapTmp;
            }
        }

        state.orderQueue = indices;
        if (keepCurrent && indices.indexOf(state.currentQuestionIndex) !== -1) {
            state.queuePos = indices.indexOf(state.currentQuestionIndex);
        } else {
            state.queuePos = 0;
            state.currentQuestionIndex = n > 0 ? indices[0] : 0;
        }
    }

    // --- Passage Rendering & Interactive Gameplay ---
    function loadQuestion(explicitIndex) {
        var container = $('sentenceContainer');
        if (!container) return;

        if (state.questions.length === 0) {
            state.orderQueue = [];
            state.queuePos = 0;
            container.innerHTML = '<span class="text-orange">No passages available yet. Click Manage to add or import passages.</span>';
            if ($('progressBadge')) $('progressBadge').textContent = '0 / 0';
            if ($('blankStatusText')) $('blankStatusText').textContent = '0 / 0 Blanks Solved';
            renderWordBank();
            return;
        }

        if (state.orderQueue.length !== state.questions.length) {
            rebuildOrderQueue(false);
        }

        if (typeof explicitIndex === 'number' && explicitIndex >= 0 && explicitIndex < state.questions.length) {
            state.currentQuestionIndex = explicitIndex;
            var pos = state.orderQueue.indexOf(explicitIndex);
            state.queuePos = pos !== -1 ? pos : 0;
        } else if (state.queuePos + 1 < state.orderQueue.length) {
            state.queuePos += 1;
            state.currentQuestionIndex = state.orderQueue[state.queuePos];
        } else {
            var lastIdx = state.currentQuestionIndex;
            rebuildOrderQueue(false, state.orderMode === 'shuffle' ? lastIdx : null);
            state.queuePos = 0;
            state.currentQuestionIndex = state.orderQueue[0];
        }

        renderCurrentQuestion();
    }

    function prevQuestion() {
        if (state.questions.length === 0) {
            loadQuestion();
            return;
        }
        if (state.orderQueue.length !== state.questions.length) rebuildOrderQueue(false);
        state.queuePos = (state.queuePos - 1 + state.orderQueue.length) % state.orderQueue.length;
        state.currentQuestionIndex = state.orderQueue[state.queuePos];
        renderCurrentQuestion();
    }

    function nextQuestion() {
        loadQuestion();
    }

    function renderQuestionAtIndex(idx) {
        if (state.questions.length === 0) {
            loadQuestion();
            return;
        }
        var safeIdx = (idx >= 0 && idx < state.questions.length) ? idx : 0;
        if (state.orderQueue.length !== state.questions.length) rebuildOrderQueue(false);
        var pos = state.orderQueue.indexOf(safeIdx);
        state.queuePos = pos !== -1 ? pos : 0;
        state.currentQuestionIndex = state.orderQueue[state.queuePos];
        renderCurrentQuestion();
    }

    function renderCurrentQuestion() {
        var container = $('sentenceContainer');
        var currentQ = state.questions[state.currentQuestionIndex];
        if (!container || !currentQ) return;

        state.roundAwarded = false;
        state.focusedInputIndex = null;

        if ($('progressBadge')) {
            var total = Math.max(state.questions.length, state.orderQueue.length);
            $('progressBadge').textContent = (state.queuePos + 1) + ' / ' + total;
        }

        var htmlParts = [];
        currentQ.tokens.forEach(function (t, index) {
            if (t.type === 'word' && t.isBlank) {
                var placeholder = t.clue ? escapeHTML(t.clue) : '...';
                var titleAttr = t.clue ? ' title="Clue: ' + escapeHTML(t.clue) + '"' : '';
                var chWidth = Math.max(8, Math.min(18, t.text.length + 3));
                htmlParts.push(
                    '<input type="text" class="blank-input answer-input" data-index="' + index + '" ' +
                    'style="width:' + chWidth + 'ch;" placeholder="' + placeholder + '"' + titleAttr + ' autocomplete="off" />'
                );
            } else {
                htmlParts.push(escapeHTML(t.text));
            }
        });

        container.innerHTML = htmlParts.join('');

        var textLength = currentQ.rawText.length;
        var fontClass = 'text-3xl sm:text-4xl';
        if (textLength > 450) fontClass = 'text-lg sm:text-xl';
        else if (textLength > 260) fontClass = 'text-xl sm:text-2xl';
        else if (textLength > 150) fontClass = 'text-2xl sm:text-3xl';

        container.className = 'font-body font-bold text-dark dark:text-slate-100 w-full ' + fontClass;

        updateBlankStatus();
        renderWordBank();

        setTimeout(function () {
            var inputs = container.querySelectorAll('.answer-input');
            if (inputs[0] && typeof inputs[0].focus === 'function') {
                inputs[0].focus();
            }
        }, 50);
    }

    function getBlankInputs() {
        var container = $('sentenceContainer');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.answer-input'));
    }

    function updateBlankStatus() {
        var inputs = getBlankInputs();
        var solved = inputs.filter(function (el) {
            return el.classList.contains('is-correct');
        }).length;
        if ($('blankStatusText')) {
            $('blankStatusText').textContent = solved + ' / ' + inputs.length + ' Blanks Solved';
        }
    }

    function renderWordBank() {
        var chipsContainer = $('wordBankChips');
        if (!chipsContainer) return;
        var currentQ = state.questions[state.currentQuestionIndex];
        if (!currentQ) {
            chipsContainer.innerHTML = '';
            return;
        }

        var inputs = getBlankInputs();
        var solvedCounts = {};
        inputs.forEach(function (inp) {
            if (inp.classList.contains('is-correct')) {
                var tok = currentQ.tokens[Number(inp.getAttribute('data-index'))];
                if (tok) {
                    var key = tok.text.toLowerCase();
                    solvedCounts[key] = (solvedCounts[key] || 0) + 1;
                }
            }
        });

        var blanks = currentQ.tokens
            .map(function (t, idx) { return { text: t.text, isBlank: t.isBlank, type: t.type, index: idx }; })
            .filter(function (t) { return t.type === 'word' && t.isBlank; });

        // Deterministic sort per passage index + word length to scatter order cleanly without jumping every keystroke
        blanks.sort(function (a, b) {
            var cmp = a.text.toLowerCase().localeCompare(b.text.toLowerCase());
            return cmp !== 0 ? cmp : a.index - b.index;
        });

        chipsContainer.innerHTML = '';
        var usedTrack = {};
        blanks.forEach(function (item) {
            var lower = item.text.toLowerCase();
            usedTrack[lower] = (usedTrack[lower] || 0) + 1;
            var isUsed = (solvedCounts[lower] || 0) >= usedTrack[lower];

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'word-bank-chip' + (isUsed ? ' is-used' : '');
            btn.disabled = isUsed;
            btn.textContent = item.text;
            btn.onclick = function () {
                fillBlankFromBank(item.text);
            };
            chipsContainer.appendChild(btn);
        });
    }

    function fillBlankFromBank(word) {
        var inputs = getBlankInputs();
        var target = inputs.find(function (inp) {
            return !inp.disabled && Number(inp.getAttribute('data-index')) === state.focusedInputIndex;
        }) || inputs.find(function (inp) {
            return !inp.disabled;
        });
        if (!target) return;

        target.value = word;
        checkAnswer(false);

        if (!target.disabled) {
            target.classList.remove('is-wrong');
            void target.offsetWidth;
            target.classList.add('is-wrong');
            if (typeof target.focus === 'function') target.focus();
            showToast('"' + word + '" does not match that blank', 'info');
        }
    }

    function checkAnswer(explicitCheck) {
        if (state.questions.length === 0) return;
        var currentQ = state.questions[state.currentQuestionIndex];
        var inputs = getBlankInputs();
        if (!currentQ || inputs.length === 0) return;

        var allCorrect = true;
        var anyRevealed = false;
        var newlySolvedElement = null;

        inputs.forEach(function (inputEl) {
            var tokenIndex = Number(inputEl.getAttribute('data-index'));
            var token = currentQ.tokens[tokenIndex];
            if (!token) return;

            if (inputEl.classList.contains('is-revealed')) {
                anyRevealed = true;
                allCorrect = false;
                return;
            }

            var userAnswer = String(inputEl.value || '').trim().toLowerCase();
            var correctAnswer = token.text.toLowerCase();

            if (userAnswer === correctAnswer) {
                if (!inputEl.classList.contains('is-correct')) {
                    newlySolvedElement = inputEl;
                }
                inputEl.classList.remove('is-wrong');
                inputEl.classList.add('is-correct');
                inputEl.disabled = true;
            } else {
                allCorrect = false;
                inputEl.classList.remove('is-correct');
                if (explicitCheck) {
                    inputEl.classList.remove('is-wrong');
                    void inputEl.offsetWidth;
                    inputEl.classList.add('is-wrong');
                } else {
                    inputEl.classList.remove('is-wrong');
                }
            }
        });

        updateBlankStatus();
        renderWordBank();

        if (newlySolvedElement && !allCorrect) {
            var nextOpen = inputs.find(function (el) { return !el.disabled; });
            if (nextOpen && typeof nextOpen.focus === 'function') {
                nextOpen.focus();
            }
        }

        if (allCorrect && !anyRevealed && !state.roundAwarded) {
            state.roundAwarded = true;
            state.score += 10;
            updateScoreUI();
            syncToCloud();
            openRoundCompleteModal();
        } else if (explicitCheck && !allCorrect && !anyRevealed) {
            showToast('Check highlighted blanks and try again', 'info');
        }
    }

    function giveLetterHint() {
        var currentQ = state.questions[state.currentQuestionIndex];
        var inputs = getBlankInputs();
        if (!currentQ || inputs.length === 0) return;

        var target = inputs.find(function (inp) {
            return !inp.disabled && Number(inp.getAttribute('data-index')) === state.focusedInputIndex;
        }) || inputs.find(function (inp) {
            return !inp.disabled;
        });

        if (!target) {
            showToast('All blanks are already complete!', 'circle-check');
            return;
        }

        var tok = currentQ.tokens[Number(target.getAttribute('data-index'))];
        if (!tok) return;

        var full = tok.text;
        var cur = String(target.value || '').trim();
        var revealLen = 1;
        while (revealLen <= cur.length && revealLen <= full.length && cur.slice(0, revealLen).toLowerCase() === full.slice(0, revealLen).toLowerCase()) {
            revealLen++;
        }
        revealLen = Math.min(full.length, Math.max(1, revealLen));
        target.value = full.slice(0, revealLen);
        target.classList.remove('is-wrong');
        if (typeof target.focus === 'function') target.focus();
        checkAnswer(false);
    }

    function revealAnswers() {
        var currentQ = state.questions[state.currentQuestionIndex];
        var inputs = getBlankInputs();
        if (!currentQ || inputs.length === 0) return;

        inputs.forEach(function (inp) {
            if (inp.classList.contains('is-correct')) return;
            var tok = currentQ.tokens[Number(inp.getAttribute('data-index'))];
            if (!tok) return;
            inp.value = tok.text;
            inp.disabled = true;
            inp.classList.remove('is-wrong');
            inp.classList.add('is-revealed');
        });
        state.roundAwarded = true;
        showToast('Answers revealed for review', 'eye');
    }

    // --- Modals ---
    function openRoundCompleteModal() {
        var isFinal = state.orderQueue.length > 0 && state.queuePos === state.orderQueue.length - 1;
        if ($('roundModalTitle')) {
            $('roundModalTitle').textContent = isFinal ? 'Set Complete!' : 'Great Job!';
        }
        if ($('roundModalMessage')) {
            $('roundModalMessage').textContent = isFinal
                ? 'You completed all ' + state.questions.length + ' passages in this set!'
                : 'Every blank in this passage was solved accurately.';
        }
        if ($('roundModalActionLabel')) {
            $('roundModalActionLabel').textContent = isFinal ? 'Play Again' : 'Next Passage';
        }
        var modal = $('roundCompleteModal');
        if (modal) modal.classList.add('open');
    }

    function closeRoundCompleteModal(advance) {
        var modal = $('roundCompleteModal');
        if (modal) modal.classList.remove('open');
        if (advance) nextQuestion();
    }

    function openConfirmModal(opts) {
        state.pendingConfirmFn = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
        if ($('confirmTitle')) $('confirmTitle').textContent = opts.title || 'Confirm';
        if ($('confirmMessage')) $('confirmMessage').textContent = opts.message || 'Are you sure?';
        if ($('confirmActionBtn')) $('confirmActionBtn').textContent = opts.confirmLabel || 'Confirm';
        setSlotIcon('confirmIconWrap', opts.icon || 'triangle-alert', 'w-7 h-7');
        var modal = $('confirmModal');
        if (modal) modal.classList.add('open');
    }

    function cancelConfirm() {
        state.pendingConfirmFn = null;
        var modal = $('confirmModal');
        if (modal) modal.classList.remove('open');
    }

    function executeConfirm() {
        var fn = state.pendingConfirmFn;
        cancelConfirm();
        if (typeof fn === 'function') fn();
    }

    // --- Question Editor Modal ---
    function openManageModal() {
        state.editorQuestions = JSON.parse(JSON.stringify(state.questions));
        renderEditorList();
        var modal = $('manageModal');
        if (modal) modal.classList.add('open');
    }

    function closeManageModal() {
        var modal = $('manageModal');
        if (modal) modal.classList.remove('open');
    }

    function buildRowTokensHTML(q, rowIndex) {
        var parts = [];
        q.tokens.forEach(function (t, tIndex) {
            if (t.type === 'word') {
                parts.push(
                    '<div class="inline-flex flex-col items-center align-top m-1">' +
                        '<button type="button" onclick="App.toggleTokenBlank(' + rowIndex + ', ' + tIndex + ')" class="token word ' + (t.isBlank ? 'is-blank' : '') + '">' +
                            escapeHTML(t.text) +
                        '</button>' +
                        (t.isBlank
                            ? '<input type="text" class="clue-mini-input" placeholder="Clue (optional)" value="' + escapeHTML(t.clue || '') + '" oninput="App.updateTokenClue(' + rowIndex + ', ' + tIndex + ', this.value)" />'
                            : '') +
                    '</div>'
                );
            } else {
                parts.push('<span class="token ' + escapeHTML(t.type) + '">' + escapeHTML(t.text).replace(/ /g, '&nbsp;') + '</span>');
            }
        });
        return parts.join('');
    }

    function renderEditorList() {
        var listContainer = $('editorList');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (state.editorQuestions.length === 0) {
            listContainer.innerHTML = '<div class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-8 text-center font-bold text-slate-500 dark:text-slate-400">No passages yet. Click Add Passage below!</div>';
            return;
        }

        state.editorQuestions.forEach(function (q, index) {
            var blankCount = q.tokens.filter(function (t) { return t.type === 'word' && t.isBlank; }).length;
            var row = document.createElement('div');
            row.className = 'bg-white dark:bg-slate-800 border-3 border-dark dark:border-slate-500 rounded-2xl p-4 shadow-hard-sm space-y-3';

            row.innerHTML =
                '<div class="flex items-center justify-between gap-2">' +
                    '<span class="sticker bg-blue text-white px-2.5 py-0.5 rounded-lg text-xs uppercase">Passage #' + (index + 1) + ' · <span id="rowBlankCount-' + index + '">' + blankCount + ' Blanks</span></span>' +
                    '<button type="button" onclick="App.deleteRow(' + index + ')" class="btn-chunky bg-pink text-white rounded-xl px-3 py-1.5 text-xs flex items-center gap-1">' +
                        '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i><span>Delete</span>' +
                    '</button>' +
                '</div>' +
                '<div>' +
                    '<label class="block text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Paragraph / Sentence</label>' +
                    '<textarea rows="2" oninput="App.updateRowText(' + index + ', this.value)" class="w-full p-3 font-body font-bold border-2 border-dark dark:border-slate-500 rounded-xl bg-slate-50 dark:bg-slate-900 text-dark dark:text-white resize-y">' + escapeHTML(q.rawText) + '</textarea>' +
                '</div>' +
                '<div>' +
                    '<span class="block text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Click words to toggle blanks</span>' +
                    '<div id="rowTokens-' + index + '" class="flex flex-wrap items-start bg-slate-50 dark:bg-slate-900 p-3 border-2 border-dark dark:border-slate-500 rounded-xl min-h-[56px]">' +
                        buildRowTokensHTML(q, index) +
                    '</div>' +
                '</div>';

            listContainer.appendChild(row);
        });

        refreshIcons();
    }

    function updateRowText(qIndex, newText) {
        var q = state.editorQuestions[qIndex];
        if (!q || q.rawText === newText) return;

        var oldBlanks = q.tokens
            .filter(function (t) { return t.type === 'word' && t.isBlank; })
            .map(function (t) { return { text: t.text.toLowerCase(), clue: t.clue }; });

        q.rawText = newText;
        q.tokens = tokenizeText(newText);

        q.tokens.forEach(function (t) {
            if (t.type === 'word') {
                var matchIdx = oldBlanks.findIndex(function (b) { return b.text === t.text.toLowerCase(); });
                if (matchIdx !== -1) {
                    t.isBlank = true;
                    t.clue = oldBlanks[matchIdx].clue;
                    oldBlanks.splice(matchIdx, 1);
                }
            }
        });

        var tokenBox = $('rowTokens-' + qIndex);
        if (tokenBox) {
            tokenBox.innerHTML = buildRowTokensHTML(q, qIndex);
        } else {
            renderEditorList();
        }
        var countEl = $('rowBlankCount-' + qIndex);
        if (countEl) {
            var count = q.tokens.filter(function (t) { return t.type === 'word' && t.isBlank; }).length;
            countEl.textContent = count + ' Blanks';
        }
    }

    function toggleTokenBlank(qIndex, tIndex) {
        var q = state.editorQuestions[qIndex];
        if (!q || !q.tokens[tIndex]) return;
        q.tokens[tIndex].isBlank = !q.tokens[tIndex].isBlank;

        var tokenBox = $('rowTokens-' + qIndex);
        if (tokenBox) {
            tokenBox.innerHTML = buildRowTokensHTML(q, qIndex);
        } else {
            renderEditorList();
        }
        var countEl = $('rowBlankCount-' + qIndex);
        if (countEl) {
            var count = q.tokens.filter(function (t) { return t.type === 'word' && t.isBlank; }).length;
            countEl.textContent = count + ' Blanks';
        }
    }

    function updateTokenClue(qIndex, tIndex, newClue) {
        if (state.editorQuestions[qIndex] && state.editorQuestions[qIndex].tokens[tIndex]) {
            state.editorQuestions[qIndex].tokens[tIndex].clue = newClue;
        }
    }

    function addNewRow() {
        var sample = 'Type your new sentence here.';
        state.editorQuestions.push({
            rawText: sample,
            tokens: tokenizeText(sample)
        });
        renderEditorList();
        var listContainer = $('editorList');
        if (listContainer) {
            setTimeout(function () {
                listContainer.scrollTop = listContainer.scrollHeight;
            }, 60);
        }
    }

    function deleteRow(index) {
        state.editorQuestions.splice(index, 1);
        renderEditorList();
    }

    function saveAllQuestions() {
        var invalidIndex = state.editorQuestions.findIndex(function (q) {
            var hasText = q.rawText && q.rawText.trim() !== '';
            var hasBlank = q.tokens && q.tokens.some(function (t) { return t.type === 'word' && t.isBlank; });
            return !hasText || !hasBlank;
        });

        if (invalidIndex !== -1) {
            showToast('Passage #' + (invalidIndex + 1) + ' needs text and at least one blank word', 'triangle-alert');
            return;
        }

        state.questions = JSON.parse(JSON.stringify(state.editorQuestions));
        rebuildOrderQueue(false);
        persistLocalQuestions();
        syncToCloud();
        closeManageModal();
        renderQuestionAtIndex(state.orderQueue[0] || 0);
        showToast('Passages saved!', 'circle-check');
    }

    function promptResetData() {
        openConfirmModal({
            title: 'Reset to Defaults?',
            message: 'Restore default passages and reset your score to 0? This cannot be undone.',
            icon: 'rotate-ccw',
            confirmLabel: 'Reset Data',
            onConfirm: function () {
                try {
                    localStorage.removeItem(QUESTIONS_KEY);
                    localStorage.removeItem(SCORE_KEY);
                } catch (e) {
                    // ignore
                }
                state.questions = buildDefaultQuestions();
                rebuildOrderQueue(false);
                state.editorQuestions = JSON.parse(JSON.stringify(state.questions));
                state.score = 0;
                persistLocalQuestions();
                updateScoreUI();
                renderEditorList();
                renderQuestionAtIndex(state.orderQueue[0] || 0);
                syncToCloud();
                closeManageModal();
                showToast('Default passages restored', 'rotate-ccw');
            }
        });
    }

    // --- Export / Import JSON ---
    function exportJSON() {
        if (state.questions.length === 0) {
            showToast('No passages available to export', 'triangle-alert');
            return;
        }
        var dataStr = JSON.stringify(state.questions, null, 2);
        var blob = new Blob([dataStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'english_blanks_questions.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Exported JSON file', 'download');
    }

    function importJSON(event) {
        var input = event && event.target ? event.target : $('importFile');
        var file = input && input.files ? input.files[0] : null;
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var parsed = JSON.parse(e.target.result);
                if (!Array.isArray(parsed)) {
                    showToast('JSON must contain an array of passages', 'triangle-alert');
                    return;
                }
                var migrated = [];
                for (var i = 0; i < parsed.length; i++) {
                    var item = migrateOldQuestion(parsed[i]);
                    if (!item) {
                        showToast('Invalid passage format inside JSON file', 'triangle-alert');
                        return;
                    }
                    migrated.push(item);
                }
                state.questions = migrated;
                rebuildOrderQueue(false);
                state.editorQuestions = JSON.parse(JSON.stringify(migrated));
                persistLocalQuestions();
                syncToCloud();
                renderEditorList();
                renderQuestionAtIndex(state.orderQueue[0] || 0);
                showToast('Imported ' + migrated.length + ' passages!', 'circle-check');
            } catch (err) {
                showToast('Could not parse JSON file', 'circle-x');
            } finally {
                if (input) input.value = '';
            }
        };
        reader.readAsText(file);
    }

    // --- Global Listeners & Boot ---
    function bindGlobalEvents() {
        var checkTimer = null;

        document.addEventListener('focusin', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('answer-input')) {
                state.focusedInputIndex = Number(e.target.getAttribute('data-index'));
            }
        });

        document.addEventListener('input', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('answer-input')) {
                if (checkTimer) clearTimeout(checkTimer);
                checkTimer = setTimeout(function () {
                    checkAnswer(false);
                }, 140);
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if ($('confirmModal') && $('confirmModal').classList.contains('open')) {
                    cancelConfirm();
                    return;
                }
                if ($('roundCompleteModal') && $('roundCompleteModal').classList.contains('open')) {
                    closeRoundCompleteModal(true);
                    return;
                }
                if ($('manageModal') && $('manageModal').classList.contains('open')) {
                    closeManageModal();
                }
                return;
            }

            if (e.key === 'Enter') {
                if ($('roundCompleteModal') && $('roundCompleteModal').classList.contains('open')) {
                    e.preventDefault();
                    closeRoundCompleteModal(true);
                    return;
                }
                if (e.target && e.target.classList && e.target.classList.contains('answer-input')) {
                    e.preventDefault();
                    if (checkTimer) clearTimeout(checkTimer);
                    checkAnswer(true);
                }
            }
        });
    }

    async function init() {
        loadPrefs();
        syncThemeIcon();
        syncPreferenceButtons();
        bindGlobalEvents();
        refreshIcons();

        if (typeof window.requireAuth === 'function') {
            await window.requireAuth();
        }

        var cloudData = null;
        if (typeof window.loadProgress === 'function') {
            try {
                cloudData = await window.loadProgress('fill_it');
            } catch (e) {
                cloudData = null;
            }
        }

        if (cloudData) {
            if (cloudData.theme) {
                var hasLocalTheme = false;
                try {
                    hasLocalTheme = Boolean(localStorage.getItem(THEME_KEY) || localStorage.getItem('theme_hub'));
                } catch (e) {}
                if (!hasLocalTheme) {
                    var isDark = cloudData.theme === 'dark';
                    document.documentElement.classList.toggle('dark', isDark);
                    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
                    syncThemeIcon();
                }
            }
            if (Array.isArray(cloudData.questions)) {
                state.questions = cloudData.questions.map(migrateOldQuestion).filter(Boolean);
                persistLocalQuestions();
            }
            if (cloudData.score !== undefined) {
                state.score = parseInt(cloudData.score, 10) || 0;
            }
        }

        if (state.questions.length === 0) {
            try {
                var savedQ = localStorage.getItem(QUESTIONS_KEY);
                if (savedQ) {
                    var parsedQ = JSON.parse(savedQ);
                    if (Array.isArray(parsedQ)) {
                        state.questions = parsedQ.map(migrateOldQuestion).filter(Boolean);
                    }
                }
            } catch (e) {
                state.questions = [];
            }

            if (state.questions.length === 0) {
                state.questions = buildDefaultQuestions();
                persistLocalQuestions();
            }

            try {
                var savedScore = localStorage.getItem(SCORE_KEY);
                if (savedScore !== null) {
                    state.score = parseInt(savedScore, 10) || 0;
                }
            } catch (e) {
                // ignore
            }
        }

        updateScoreUI();
        rebuildOrderQueue(false);
        renderQuestionAtIndex(state.orderQueue[0] || 0);
    }

    window.App = {
        init: init,
        toggleDarkMode: toggleDarkMode,
        toggleWordBank: toggleWordBank,
        toggleOrderMode: toggleOrderMode,
        prevQuestion: prevQuestion,
        nextQuestion: nextQuestion,
        checkAnswer: checkAnswer,
        giveLetterHint: giveLetterHint,
        revealAnswers: revealAnswers,
        openManageModal: openManageModal,
        closeManageModal: closeManageModal,
        updateRowText: updateRowText,
        toggleTokenBlank: toggleTokenBlank,
        updateTokenClue: updateTokenClue,
        addNewRow: addNewRow,
        deleteRow: deleteRow,
        saveAllQuestions: saveAllQuestions,
        promptResetData: promptResetData,
        exportJSON: exportJSON,
        importJSON: importJSON,
        closeRoundCompleteModal: closeRoundCompleteModal,
        cancelConfirm: cancelConfirm,
        executeConfirm: executeConfirm,
        _getState: function () { return state; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        init();
    });
})();

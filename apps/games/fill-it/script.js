// Initialize Icons
lucide.createIcons();

function tokenizeText(text) {
    const tokens = [];
    const regex = /[\w'-]+|\s+|[^\w\s'-]+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const str = match[0];
        let type = 'punctuation';
        if (/^\s+$/.test(str)) type = 'space';
        else if (/^[\w'-]+$/.test(str)) type = 'word';
        tokens.push({ text: str, type: type, isBlank: false, clue: '' });
    }
    return tokens;
}

function migrateOldQuestion(q) {
    if (q.tokens) return q; // Already migrated
    const rawText = q.sentence.replace('_', q.answer);
    const tokens = tokenizeText(rawText);
    const answerLower = q.answer.toLowerCase();
    const blankToken = tokens.find(t => t.type === 'word' && t.text.toLowerCase() === answerLower);
    if (blankToken) {
        blankToken.isBlank = true;
        blankToken.clue = q.clue || '';
    }
    return { rawText, tokens };
}

// Default Curriculum (3 Rows, 3 Sentences each)
const defaultQuestions = [
    {
        rawText: "Plants need sunlight to grow. They also require water and nutrients from the soil. This process is called photosynthesis.",
        tokens: tokenizeText("Plants need sunlight to grow. They also require water and nutrients from the soil. This process is called photosynthesis.")
    },
    {
        rawText: "The Great Wall of China is a famous landmark. It was built thousands of years ago to protect the empire. Today, it is visited by millions of tourists.",
        tokens: tokenizeText("The Great Wall of China is a famous landmark. It was built thousands of years ago to protect the empire. Today, it is visited by millions of tourists.")
    },
    {
        rawText: "I went to the store to buy some groceries. I forgot my wallet at home so I had to go back. It was a very busy afternoon.",
        tokens: tokenizeText("I went to the store to buy some groceries. I forgot my wallet at home so I had to go back. It was a very busy afternoon.")
    }
];

// Helper to set default blanks
function setDefaultBlank(q, word, clue) {
    const token = q.tokens.find(t => t.text.toLowerCase() === word.toLowerCase() && !t.isBlank);
    if (token) {
        token.isBlank = true;
        token.clue = clue;
    }
}

setDefaultBlank(defaultQuestions[0], "sunlight", "Energy from the sun");
setDefaultBlank(defaultQuestions[0], "water", "H2O");
setDefaultBlank(defaultQuestions[0], "photosynthesis", "Process of making food");

setDefaultBlank(defaultQuestions[1], "China", "Country with the Wall");
setDefaultBlank(defaultQuestions[1], "protect", "To keep safe");
setDefaultBlank(defaultQuestions[1], "tourists", "People who visit");

setDefaultBlank(defaultQuestions[2], "store", "Place to buy things");
setDefaultBlank(defaultQuestions[2], "wallet", "Used to carry money");
setDefaultBlank(defaultQuestions[2], "busy", "Full of activity");

let questions = [];
let currentQuestionIndex = 0;
let score = 0;

// --- Game Logic ---

async function initGame() {
    await requireAuth();
    
    const cloudData = await loadProgress('fill_it');
    
    // Apply theme
    let theme = localStorage.getItem('theme_fill-it');
    if (cloudData && cloudData.theme) theme = cloudData.theme;
    
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcon(document.documentElement.classList.contains('dark'));

    // Apply Questions & Score
    if (cloudData) {
        if (cloudData.questions) questions = cloudData.questions.map(migrateOldQuestion);
        if (cloudData.score !== undefined) score = cloudData.score;
        
        // Sync back to local storage
        localStorage.setItem('englishGameQuestions', JSON.stringify(questions));
        localStorage.setItem('englishGameScore', score);
        localStorage.setItem('theme_fill-it', theme);
    } else {
        const savedQuestions = localStorage.getItem('englishGameQuestions');
        const savedScore = localStorage.getItem('englishGameScore');

        if (savedQuestions) {
            questions = JSON.parse(savedQuestions).map(migrateOldQuestion);
            // Auto-upgrade old default questions to include clues
            const isOldDefault = questions.length === 3 && questions.every(q => !q.clue) && questions[0].rawText === "The cat sat on the mat." && questions[1].rawText === "She likes to read a book every night.";
            if (isOldDefault) {
                questions = JSON.parse(JSON.stringify(defaultQuestions));
                localStorage.setItem('englishGameQuestions', JSON.stringify(questions));
            }
        } else {
            questions = JSON.parse(JSON.stringify(defaultQuestions));
            localStorage.setItem('englishGameQuestions', JSON.stringify(questions));
        }

        if (savedScore) {
            score = parseInt(savedScore);
        }
    }

    document.getElementById('score-display').innerText = score;
    loadQuestion();
}

function loadQuestion() {
    if (questions.length === 0) {
        document.getElementById('sentence-container').innerHTML = `<span class="text-orange">No questions available! Please add or import some via 'Manage Questions'.</span>`;
        return;
    }

    currentQuestionIndex = Math.floor(Math.random() * questions.length);
    const currentQ = questions[currentQuestionIndex];

    let html = '';
    currentQ.tokens.forEach((t, index) => {
        if (t.type === 'word' && t.isBlank) {
            const clueAttr = t.clue ? `placeholder="${t.clue.replace(/"/g, '&quot;')}" title="Clue: ${t.clue.replace(/"/g, '&quot;')}"` : '';
            html += `<input type="text" class="blank-input answer-input" data-index="${index}" ${clueAttr} autocomplete="off">`;
        } else {
            if (t.type === 'space') {
                html += t.text;
            } else {
                html += t.text;
            }
        }
    });

    const container = document.getElementById('sentence-container');
    container.innerHTML = html;

    // Auto-fit font size based on content length and screen space
    const textLength = currentQ.rawText.length;
    let fontSize = 'text-[2.5rem]'; // Fallback
    
    if (textLength > 600) fontSize = 'text-base sm:text-lg';
    else if (textLength > 400) fontSize = 'text-lg sm:text-xl';
    else if (textLength > 250) fontSize = 'text-xl sm:text-2xl';
    else if (textLength > 150) fontSize = 'text-2xl sm:text-3xl';
    else if (textLength > 80) fontSize = 'text-3xl sm:text-4xl';
    else if (textLength > 40) fontSize = 'text-4xl sm:text-5xl';
    else fontSize = 'text-5xl sm:text-6xl';

    container.className = `font-body leading-relaxed font-bold text-dark dark:text-chalk text-justify w-full ${fontSize}`;

    setTimeout(() => {
        const firstInput = document.querySelector('.answer-input');
        if (firstInput) firstInput.focus();
    }, 100);
}

function checkAnswer() {
    if (questions.length === 0) return;
    const currentQ = questions[currentQuestionIndex];
    const inputs = document.querySelectorAll('.answer-input');
    if (inputs.length === 0) return;

    let allCorrect = true;

    inputs.forEach(inputEl => {
        const tokenIndex = parseInt(inputEl.dataset.index);
        const token = currentQ.tokens[tokenIndex];
        const userAnswer = inputEl.value.trim().toLowerCase();
        const correctAnswer = token.text.toLowerCase();

        if (userAnswer === correctAnswer) {
            inputEl.classList.remove('wrong-feedback', 'animate-shake');
            inputEl.classList.add('correct-feedback');
            inputEl.disabled = true;
        } else {
            allCorrect = false;
            inputEl.classList.remove('correct-feedback');
            inputEl.classList.add('wrong-feedback');
            void inputEl.offsetWidth; // trigger reflow
        }
    });

    if (allCorrect) {
        score += 10;
        updateScore();
        setTimeout(async () => {
            await showAlertModal("Awesome job! Keep going.", { title: "Correct!", icon: "check-circle", iconColor: "green" });
            loadQuestion();
        }, 500);
    }
}

// --- Data Reset ---
async function resetData() {
    const confirmed = await showConfirmModal("Reset to default questions and wipe your score? This cannot be undone.", {
        title: "Reset Data?",
        confirmText: "Reset",
        cancelText: "Cancel",
        icon: "rotate-ccw",
        iconColor: "red"
    });
    if (confirmed) {
        localStorage.removeItem('englishGameQuestions');
        localStorage.removeItem('englishGameScore');
        questions = JSON.parse(JSON.stringify(defaultQuestions));
        score = 0;
        document.getElementById('score-display').innerText = score;
        renderEditorList();
        loadQuestion();
        syncToCloud();
        closeManageModal();
    }
}

function skipQuestion() {
    loadQuestion();
}

function updateScore() {
    localStorage.setItem('englishGameScore', score);
    document.getElementById('score-display').innerText = score;
    syncToCloud();
}

// --- Question Manager Logic ---

let editorQuestions = [];

function openManageModal() {
    editorQuestions = JSON.parse(JSON.stringify(questions));
    renderEditorList();
    document.getElementById('manage-modal').classList.remove('hidden');
}

function closeManageModal() {
    document.getElementById('manage-modal').classList.add('hidden');
}

function renderEditorList() {
    const listContainer = document.getElementById('editor-list');
    listContainer.innerHTML = '';

    if (editorQuestions.length === 0) {
        listContainer.innerHTML = `<div class="text-center font-body font-bold text-slate-500 text-lg p-6">No questions found. Add a new row below!</div>`;
        return;
    }

    editorQuestions.forEach((q, index) => {
        const row = document.createElement('div');
        row.className = "flex flex-col gap-4 bg-chalk dark:bg-slate-800 p-4 border-4 border-dark dark:border-slate-400 rounded-xl shadow-[4px_4px_0_var(--color-dark)] dark:shadow-[4px_4px_0_#64748b] editor-row";

        let tokensHtml = '';
        q.tokens.forEach((t, tIndex) => {
            if (t.type === 'word') {
                const blankClass = t.isBlank ? 'is-blank' : '';
                tokensHtml += `<div class="inline-flex flex-col items-center align-top m-1"><span class="token word ${blankClass}" onclick="toggleTokenBlank(${index}, ${tIndex})">${t.text}</span>`;
                if (t.isBlank) {
                    tokensHtml += `<div class="clue-input-wrapper"><input type="text" class="clue-mini-input" placeholder="Clue (optional)" value="${(t.clue || '').replace(/"/g, '&quot;')}" onchange="updateTokenClue(${index}, ${tIndex}, this.value)"></div>`;
                }
                tokensHtml += `</div>`;
            } else {
                tokensHtml += `<span class="token ${t.type}">${t.text.replace(/ /g, '&nbsp;')}</span>`;
            }
        });

        row.innerHTML = `
            <div class="flex-1 w-full flex flex-col gap-4">
                <div>
                    <label class="block text-xs font-bold mb-1 opacity-70 uppercase tracking-wider">Paragraph / Sentence</label>
                    <textarea class="w-full p-3 font-body font-bold outline-none border-4 border-dark dark:border-slate-500 rounded-xl bg-white dark:bg-slate-900 text-dark dark:text-chalk resize-y" rows="2" onblur="updateRowText(${index}, this.value)">${q.rawText}</textarea>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1 opacity-70 uppercase tracking-wider">Click words to create blanks</label>
                    <div class="flex flex-wrap items-center token-container bg-white dark:bg-slate-900 p-4 border-4 border-dark dark:border-slate-500 rounded-xl min-h-[60px] text-dark dark:text-chalk leading-loose">
                        ${tokensHtml}
                    </div>
                </div>
            </div>
            <button onclick="deleteRow(${index})" class="btn-chunky p-2 sm:p-3 bg-pink text-dark self-start mt-2">
                <i data-lucide="trash-2" class="w-5 h-5"></i> <span class="text-sm font-bold ml-2">DELETE</span>
            </button>
        `;
        listContainer.appendChild(row);
    });
    lucide.createIcons();
}

function updateRowText(qIndex, newText) {
    const q = editorQuestions[qIndex];
    if (q.rawText === newText) return;
    
    // Preserve old blanks if possible
    const oldBlanks = q.tokens.filter(t => t.isBlank).map(t => ({text: t.text.toLowerCase(), clue: t.clue}));
    
    q.rawText = newText;
    q.tokens = tokenizeText(newText);
    
    q.tokens.forEach(t => {
        if (t.type === 'word') {
            const match = oldBlanks.find(b => b.text === t.text.toLowerCase());
            if (match) {
                t.isBlank = true;
                t.clue = match.clue;
            }
        }
    });
    renderEditorList();
}

function toggleTokenBlank(qIndex, tIndex) {
    const t = editorQuestions[qIndex].tokens[tIndex];
    t.isBlank = !t.isBlank;
    renderEditorList();
}

function updateTokenClue(qIndex, tIndex, newClue) {
    editorQuestions[qIndex].tokens[tIndex].clue = newClue;
}

function addNewRow() {
    editorQuestions.push({
        rawText: "Type your new sentence here.",
        tokens: tokenizeText("Type your new sentence here.")
    });
    renderEditorList();
    const listContainer = document.getElementById('editor-list');
    setTimeout(() => {
        listContainer.scrollTop = listContainer.scrollHeight;
    }, 100);
}

function deleteRow(index) {
    editorQuestions.splice(index, 1);
    renderEditorList();
}

async function saveAllQuestions() {
    const hasError = editorQuestions.some(q => q.rawText.trim() === '' || !q.tokens.some(t => t.isBlank));
    if (hasError) {
        await showAlertModal("Make sure all rows have text and at least one blank word selected.", { title: "Formatting Error", icon: "alert-triangle", iconColor: "orange" });
        return;
    }

    questions = JSON.parse(JSON.stringify(editorQuestions));
    localStorage.setItem('englishGameQuestions', JSON.stringify(questions));
    syncToCloud();
    closeManageModal();
    await showAlertModal("Your questions have been successfully updated.", { title: "Saved!", icon: "check-circle", iconColor: "green" });
    loadQuestion();
}



// --- JSON Export / Import ---

async function exportJSON() {
    if (questions.length === 0) {
        await showAlertModal("There are no questions to export.", { title: "No Data", icon: "alert-circle", iconColor: "orange" });
        return;
    }

    const dataStr = JSON.stringify(questions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "english_blanks_questions.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAlert("Exported!", "Your question set has been downloaded successfully.", "text-blue", "download");
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (Array.isArray(importedData)) {
                let isValid = true;
                const newQuestions = importedData.map(q => {
                    if (q.rawText && Array.isArray(q.tokens)) return q;
                    if (q.sentence && q.answer && typeof q.sentence === 'string') return migrateOldQuestion(q);
                    isValid = false;
                    return null;
                });

                if (isValid) {
                    questions = newQuestions;
                    localStorage.setItem('englishGameQuestions', JSON.stringify(questions));
                    syncToCloud();
                    renderEditorList();
                    await showAlertModal("Questions successfully loaded from the JSON file.", { title: "Imported!", icon: "check-circle", iconColor: "green" });
                    loadQuestion();
                } else {
                    await showAlertModal("The JSON file must contain valid Fill-It question formats.", { title: "Invalid Data", icon: "alert-triangle", iconColor: "red" });
                }
            } else {
                await showAlertModal("The JSON file must be an array of questions.", { title: "Invalid Format", icon: "alert-triangle", iconColor: "red" });
            }
        } catch (err) {
            await showAlertModal("Could not parse the JSON file. Ensure it is formatted correctly.", { title: "Error", icon: "x-octagon", iconColor: "red" });
        }

        // Reset input to allow re-uploading the same file if needed
        event.target.value = '';
    };
    reader.readAsText(file);
}


// --- Utilities ---

function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme_fill-it', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
    syncToCloud();
}

function updateThemeIcon(isDark) {
    const btnIcon = document.getElementById('theme-icon');
    if (btnIcon) btnIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}

let syncTimeout = null;
function syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        saveProgress('fill_it', {
            questions: questions,
            score: score,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        });
    }, 1500);
}

// Initialize on load
window.onload = initGame;

let checkTimeout = null;

// Listen for input changes to trigger auto-check
document.addEventListener('input', function (e) {
    if (e.target.classList.contains('answer-input')) {
        if (checkTimeout) clearTimeout(checkTimeout);
        checkTimeout = setTimeout(() => {
            checkAnswer();
        }, 500);
    }
});

// Listen for "Enter" key on game inputs to check immediately
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        if (e.target.classList.contains('answer-input')) {
            if (checkTimeout) clearTimeout(checkTimeout);
            checkAnswer();
        }
    }
});

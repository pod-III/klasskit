    // --- HTML Generators (Editor) ---
    function getEditorInput(label, value, placeholder, action, dataAttrs, type="text", cls="") {
      return `
        <div class="flex flex-col gap-1.5 ${cls}">
          ${label ? `<label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">${label}</label>` : ''}
          <input type="${type}" data-action="${action}" ${dataAttrs} class="bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-4.5 py-2.5 text-sm font-bold text-dark dark:text-white focus:outline-none focus:border-blue transition-all" value="${esc(value)}" placeholder="${placeholder || ''}" />
        </div>
      `;
    }

    function getEditorTextarea(label, value, placeholder, action, dataAttrs, rows=3) {
      return `
        <div class="flex flex-col gap-1.5 w-full">
          ${label ? `<label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">${label}</label>` : ''}
          <textarea data-action="${action}" ${dataAttrs} class="bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-4.5 py-2.5 text-sm font-bold text-dark dark:text-white focus:outline-none focus:border-blue transition-all resize-y" rows="${rows}" placeholder="${placeholder || ''}">${esc(value)}</textarea>
        </div>
      `;
    }

    function getQuestionImageEditorHTML(q) {
      const src = getWsImageSrc(q.imageId);
      if (!src) {
        return `
          <div class="flex items-center">
            <button type="button" data-action="upload-q-image" data-qid="${q.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-300 hover:border-blue hover:text-blue transition-colors">
              <i data-lucide="image-plus" class="w-4 h-4"></i> Add Image / Diagram
            </button>
          </div>
        `;
      }
      const curSize = q.imageSize || 'md';
      return `
        <div class="flex flex-wrap items-center gap-3 p-3 rounded-xl border-2 border-dark/15 dark:border-slate-600 bg-slate-50 dark:bg-slate-900">
          <img src="${esc(src)}" alt="" class="h-24 max-w-[220px] object-contain rounded-xl border-2 border-dark bg-white p-1" />
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 font-heading">Size:</span>
              ${['sm', 'md', 'lg'].map(sz => `
                <button type="button" data-action="set-q-img-size" data-qid="${q.id}" data-size="${sz}" class="px-2 py-0.5 rounded-md border-2 text-[10px] font-heading font-bold uppercase ${curSize === sz ? 'bg-blue text-white border-dark' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}">${sz === 'sm' ? 'S' : sz === 'md' ? 'M' : 'L'}</button>
              `).join('')}
            </div>
            <div class="flex items-center gap-2">
              <button type="button" data-action="upload-q-image" data-qid="${q.id}" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-500 text-xs font-bold flex items-center gap-1 hover:border-blue transition-colors">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i> Replace
              </button>
              <button type="button" data-action="remove-q-image" data-qid="${q.id}" class="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-500/30 text-xs font-bold flex items-center gap-1 hover:bg-red-100 transition-colors">
                <i data-lucide="trash-2" class="w-3 h-3"></i> Remove
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function getModuleOptionSelectHTML(label, qid, field, value, options) {
      return `
        <label class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/90 border-2 border-dark/20 dark:border-slate-600 rounded-xl px-2.5 py-1.5">
          <span class="font-heading uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">${label}</span>
          <select data-action="update-q-field" data-qid="${qid}" data-field="${field}" class="bg-transparent font-bold text-dark dark:text-white outline-none cursor-pointer">
            ${options.map(([val, lbl]) => `<option value="${val}" ${String(value) === String(val) ? 'selected' : ''} class="dark:bg-slate-800">${lbl}</option>`).join('')}
          </select>
        </label>
      `;
    }

    function getModuleOptionToggleHTML(label, qid, field, checked) {
      return `
        <label class="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/90 border-2 border-dark/20 dark:border-slate-600 rounded-xl px-2.5 py-1.5 cursor-pointer select-none">
          <input type="checkbox" data-action="update-q-field" data-qid="${qid}" data-field="${field}" ${checked ? 'checked' : ''} class="w-4 h-4 accent-blue cursor-pointer" />
          <span>${label}</span>
        </label>
      `;
    }

    function getMCQEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Question Text', q.text, 'What is the powerhouse of the cell?', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Option Layout', q.id, 'optColumns', q.optColumns || 'auto', [['auto', 'Auto'], ['1', '1 Column (Vertical)'], ['2', '2 Columns Grid'], ['4', '4 Columns Inline']])}
          </div>
          <div class="space-y-3">
            <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">Options (Check the correct one)</label>
            ${q.options.map((opt, idx) => {
              const optImg = getWsImageSrc(opt.imageId);
              return `
                <div class="flex items-center gap-2.5">
                  <input type="radio" name="mcq-${q.id}" ${opt.isCorrect ? 'checked' : ''} data-action="set-mcq-correct" data-qid="${q.id}" data-optid="${opt.id}" class="w-5 h-5 text-blue dark:bg-slate-900 border-2 border-dark focus:ring-0 shrink-0">
                  ${optImg ? `
                    <div class="relative shrink-0">
                      <img src="${esc(optImg)}" alt="" class="h-10 w-10 object-contain rounded-lg border-2 border-dark bg-white p-0.5" />
                      <button type="button" data-action="remove-opt-image" data-qid="${q.id}" data-optid="${opt.id}" title="Remove option image" class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-dark">×</button>
                    </div>
                  ` : ''}
                  <input type="text" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-semibold text-dark dark:text-white focus:border-blue outline-none" value="${esc(opt.text)}" data-action="update-mcq-text" data-qid="${q.id}" data-optid="${opt.id}" placeholder="Option ${idx + 1}">
                  <button type="button" data-action="upload-opt-image" data-qid="${q.id}" data-optid="${opt.id}" title="Attach image to option" class="p-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue hover:text-blue transition-colors shrink-0"><i data-lucide="image-plus" class="w-4 h-4"></i></button>
                  <button type="button" data-action="delete-mcq-opt" data-qid="${q.id}" data-optid="${opt.id}" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 transition-colors shrink-0"><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                </div>
              `;
            }).join('')}
            <button data-action="add-mcq-opt" data-qid="${q.id}" class="text-xs text-blue hover:text-blue/80 font-heading font-black uppercase tracking-wider flex items-center gap-1.5 mt-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Option
            </button>
          </div>
        </div>
      `;
    }

    function getFIBEditor(q) {
      return `
        <div class="space-y-4">
          <div class="bg-blue/10 dark:bg-blue/5 border-2 border-blue/20 text-blue dark:text-blue-400 p-4 rounded-xl text-sm mb-4 font-semibold">
            <strong>Tip:</strong> Use three underscores (<code>___</code>) in your question text where you want the blank to appear.
          </div>
          ${getEditorTextarea('Question Text', q.text, '', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          ${getEditorInput('Correct Answer (For Key)', q.answer, 'e.g. Mitochondria', 'update-q-ans', `data-qid="${q.id}"`)}
        </div>
      `;
    }

    function getSAEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Question Text', q.text, '', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Answer Lines', q.id, 'lines', q.lines || 2, [[1, '1 line'], [2, '2 lines'], [3, '3 lines'], [4, '4 lines'], [5, '5 lines'], [6, '6 lines']])}
          </div>
          ${getEditorTextarea('Correct Answer / Expected Points (For Key)', q.answer, '', 'update-q-ans', `data-qid="${q.id}"`, 2)}
        </div>
      `;
    }

    function getTFEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Question Text', q.text, '', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Labels', q.id, 'tfStyle', q.tfStyle || 'tf', [['tf', 'True / False'], ['yn', 'Yes / No'], ['ci', 'Correct / Incorrect']])}
            ${getModuleOptionToggleHTML('Correction line if False', q.id, 'requireCorrection', Boolean(q.requireCorrection))}
          </div>
          <div>
            <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading block mb-2.5">Correct Answer</label>
            <div class="flex gap-6">
              <label class="flex items-center gap-2 cursor-pointer text-sm font-bold">
                <input type="radio" name="tf-${q.id}" ${q.isTrue ? 'checked' : ''} data-action="set-tf" data-val="true" data-qid="${q.id}" class="w-5 h-5 text-blue dark:bg-slate-900 border-2 border-dark focus:ring-0" />
                <span>${q.tfStyle === 'yn' ? 'Yes' : (q.tfStyle === 'ci' ? 'Correct' : 'True')}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-sm font-bold">
                <input type="radio" name="tf-${q.id}" ${!q.isTrue ? 'checked' : ''} data-action="set-tf" data-val="false" data-qid="${q.id}" class="w-5 h-5 text-blue dark:bg-slate-900 border-2 border-dark focus:ring-0" />
                <span>${q.tfStyle === 'yn' ? 'No' : (q.tfStyle === 'ci' ? 'Incorrect' : 'False')}</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    function getMatchingEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Instructions / Context', q.text, 'Match the items...', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Match Style', q.id, 'matchStyle', q.matchStyle || 'letters', [['letters', 'Write Letter Blank ( ___ )'], ['lines', 'Draw Connecting Lines ( •  • )']])}
          </div>
          <div class="space-y-3">
            <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading flex justify-between">
              <span>Left Side (Prompts)</span>
              <span>Right Side (Matches)</span>
            </label>
            ${q.pairs.map((pair) => {
              const leftImg = getWsImageSrc(pair.leftImageId);
              const rightImg = getWsImageSrc(pair.rightImageId);
              return `
                <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    ${leftImg ? `
                      <div class="relative shrink-0">
                        <img src="${esc(leftImg)}" alt="" class="h-9 w-9 object-contain rounded-lg border-2 border-dark bg-white p-0.5" />
                        <button type="button" data-action="remove-match-image" data-side="left" data-qid="${q.id}" data-pairid="${pair.id}" title="Remove left image" class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-dark">×</button>
                      </div>
                    ` : ''}
                    <input class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-semibold text-dark dark:text-white focus:border-blue outline-none" value="${esc(pair.left)}" data-action="update-match-left" data-qid="${q.id}" data-pairid="${pair.id}" placeholder="e.g. France" />
                    <button type="button" data-action="upload-match-image" data-side="left" data-qid="${q.id}" data-pairid="${pair.id}" title="Upload left image" class="p-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue hover:text-blue transition-colors shrink-0"><i data-lucide="image-plus" class="w-3.5 h-3.5"></i></button>
                  </div>
                  <span class="text-slate-400 font-bold shrink-0">→</span>
                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    ${rightImg ? `
                      <div class="relative shrink-0">
                        <img src="${esc(rightImg)}" alt="" class="h-9 w-9 object-contain rounded-lg border-2 border-dark bg-white p-0.5" />
                        <button type="button" data-action="remove-match-image" data-side="right" data-qid="${q.id}" data-pairid="${pair.id}" title="Remove right image" class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-dark">×</button>
                      </div>
                    ` : ''}
                    <input class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-semibold text-dark dark:text-white focus:border-blue outline-none" value="${esc(pair.right)}" data-action="update-match-right" data-qid="${q.id}" data-pairid="${pair.id}" placeholder="e.g. Paris" />
                    <button type="button" data-action="upload-match-image" data-side="right" data-qid="${q.id}" data-pairid="${pair.id}" title="Upload right image" class="p-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue hover:text-blue transition-colors shrink-0"><i data-lucide="image-plus" class="w-3.5 h-3.5"></i></button>
                  </div>
                  <button type="button" data-action="delete-match-pair" data-qid="${q.id}" data-pairid="${pair.id}" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 transition-colors shrink-0"><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                </div>
              `;
            }).join('')}
            <button data-action="add-match-pair" data-qid="${q.id}" class="text-xs text-blue hover:text-blue/80 font-heading font-black uppercase tracking-wider flex items-center gap-1.5 mt-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Pair
            </button>
          </div>
        </div>
      `;
    }

    function getEssayEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Question Text', q.text, '', 'update-q-text', `data-qid="${q.id}"`)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-end gap-3">
            ${getEditorInput('Blank Lines to Provide', q.lines, '', 'update-q-lines', `data-qid="${q.id}"`, 'number', 'w-40')}
            ${getModuleOptionSelectHTML('Writing Guide', q.id, 'lineStyle', q.lineStyle || 'ruled', [['ruled', 'Ruled Lines'], ['primary', 'Primary (Dashed Midline)'], ['box', 'Open Box'], ['grid', 'Graph / Math Grid']])}
          </div>
          ${getEditorTextarea('Grading Rubric (For Key)', q.answer, 'Key points the student must mention...', 'update-q-ans', `data-qid="${q.id}"`, 4)}
        </div>
      `;
    }

    function getSectionEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorInput('Section Heading', q.text, 'e.g. PART A: Vocabulary & Grammar', 'update-q-text', `data-qid="${q.id}"`)}
          ${getEditorInput('Section Subtitle / Note (Optional)', q.subtitle || '', 'e.g. Answer every question in complete sentences.', 'update-q-field', `data-qid="${q.id}" data-field="subtitle"`)}
          ${getQuestionImageEditorHTML(q)}
        </div>
      `;
    }

    function getPassageEditor(q) {
      return `
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Box Style', q.id, 'boxStyle', q.boxStyle || 'card', [['card', 'Reading Card'], ['grammar', 'Grammar Rule Box'], ['dialogue', 'Dialogue / Script'], ['plain', 'Minimal Box']])}
            ${getModuleOptionToggleHTML('Show Line Numbers', q.id, 'showLineNumbers', Boolean(q.showLineNumbers))}
          </div>
          ${getEditorInput('Passage / Info Box Title', q.title || '', 'e.g. Reading Passage or Grammar Tip', 'update-q-field', `data-qid="${q.id}" data-field="title"`)}
          ${getEditorTextarea('Content Text', q.text, 'Write or paste a reading text, story excerpt, dialogue, or grammar explanation...', 'update-q-text', `data-qid="${q.id}"`, 5)}
          ${getQuestionImageEditorHTML(q)}
        </div>
      `;
    }

    function getUnscrambleEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Instructions', q.text, 'Unscramble each word or sentence:', 'update-q-text', `data-qid="${q.id}"`, 2)}
          ${getQuestionImageEditorHTML(q)}
          <div class="space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">Items to Unscramble</label>
              <button type="button" data-action="auto-scramble-items" data-qid="${q.id}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue/10 hover:bg-blue/20 text-blue text-[11px] font-heading font-bold uppercase tracking-wider border border-blue/30 transition-colors">
                <i data-lucide="shuffle" class="w-3.5 h-3.5"></i> Auto-Scramble from Answers
              </button>
            </div>
            ${(q.items || []).map((it, idx) => `
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/70 p-2.5 rounded-xl border-2 border-dark/15 dark:border-slate-700">
                <input type="text" data-action="update-unscramble-field" data-field="scrambled" data-qid="${q.id}" data-itemid="${it.id}" value="${esc(it.scrambled)}" placeholder="Scrambled (e.g. b / k / o / o)" class="sm:col-span-5 bg-white dark:bg-slate-900 border-2 border-dark/25 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-dark dark:text-white outline-none focus:border-blue" />
                <input type="text" data-action="update-unscramble-field" data-field="answer" data-qid="${q.id}" data-itemid="${it.id}" value="${esc(it.answer)}" placeholder="Answer #${idx + 1}" class="sm:col-span-4 bg-white dark:bg-slate-900 border-2 border-dark/25 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-dark dark:text-white outline-none focus:border-blue" />
                <div class="sm:col-span-3 flex items-center gap-1.5">
                  <input type="text" data-action="update-unscramble-field" data-field="hint" data-qid="${q.id}" data-itemid="${it.id}" value="${esc(it.hint || '')}" placeholder="Hint (opt)" class="flex-1 min-w-0 bg-white dark:bg-slate-900 border-2 border-dark/25 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-dark dark:text-white outline-none focus:border-blue" />
                  <button type="button" data-action="delete-unscramble-item" data-qid="${q.id}" data-itemid="${it.id}" class="text-slate-400 hover:text-red-500 p-1 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
              </div>
            `).join('')}
            <button type="button" data-action="add-unscramble-item" data-qid="${q.id}" class="text-xs text-blue hover:text-blue/80 font-heading font-black uppercase tracking-wider flex items-center gap-1.5 mt-1">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Item
            </button>
          </div>
        </div>
      `;
    }

    function getSortEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Instructions', q.text, 'Sort the words into the correct categories:', 'update-q-text', `data-qid="${q.id}"`, 2)}
          ${getQuestionImageEditorHTML(q)}
          <div class="bg-blue/10 dark:bg-blue/5 border-2 border-blue/20 text-blue dark:text-blue-400 p-3 rounded-xl text-xs font-semibold">
            <strong>Tip:</strong> List category answers separated by commas (e.g. <code>apple, desk, river</code>). They will be shuffled into the Word Pool automatically on the worksheet!
          </div>
          <div class="space-y-2.5">
            <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">Categories & Answers</label>
            ${(q.categories || []).map((cat, idx) => `
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-slate-900/70 p-2.5 rounded-xl border-2 border-dark/15 dark:border-slate-700">
                <input type="text" data-action="update-sort-field" data-field="title" data-qid="${q.id}" data-catid="${cat.id}" value="${esc(cat.title)}" placeholder="Category ${idx + 1}" class="sm:w-44 bg-white dark:bg-slate-900 border-2 border-dark/25 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-black text-dark dark:text-white outline-none focus:border-blue" />
                <input type="text" data-action="update-sort-field" data-field="items" data-qid="${q.id}" data-catid="${cat.id}" value="${esc(cat.items)}" placeholder="comma, separated, answers" class="flex-1 min-w-0 bg-white dark:bg-slate-900 border-2 border-dark/25 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-dark dark:text-white outline-none focus:border-blue" />
                <button type="button" data-action="delete-sort-cat" data-qid="${q.id}" data-catid="${cat.id}" class="text-slate-400 hover:text-red-500 p-1 self-end sm:self-center shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
            `).join('')}
            <button type="button" data-action="add-sort-cat" data-qid="${q.id}" class="text-xs text-blue hover:text-blue/80 font-heading font-black uppercase tracking-wider flex items-center gap-1.5 mt-1">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Category Column
            </button>
          </div>
        </div>
      `;
    }

    function getDrawingEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Prompt / Drawing Task', q.text, 'Draw and label your diagram in the box below:', 'update-q-text', `data-qid="${q.id}"`, 2)}
          ${getQuestionImageEditorHTML(q)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Box Height', q.id, 'boxHeight', q.boxHeight || 'md', [['sm', 'Compact'], ['md', 'Medium'], ['lg', 'Large']])}
            ${getModuleOptionSelectHTML('Canvas Surface', q.id, 'boxStyle', q.boxStyle || 'blank', [['blank', 'Blank Canvas'], ['dots', 'Dot Grid'], ['grid', 'Square Graph Grid'], ['split', 'Split (Left / Right)']])}
            ${getModuleOptionSelectHTML('Caption Lines', q.id, 'captionLines', q.captionLines ?? 2, [[0, 'None'], [1, '1 line'], [2, '2 lines'], [3, '3 lines'], [4, '4 lines']])}
          </div>
          ${getEditorTextarea('Expected Labels / Teacher Note (For Key)', q.answer || '', 'What should students draw or label?', 'update-q-ans', `data-qid="${q.id}"`, 2)}
        </div>
      `;
    }

    function getChecklistEditor(q) {
      return `
        <div class="space-y-4">
          ${getEditorTextarea('Checklist Prompt / Title', q.text, 'Self-Check before handing in your paper:', 'update-q-text', `data-qid="${q.id}"`, 2)}
          <div class="flex flex-wrap items-center gap-2">
            ${getModuleOptionSelectHTML('Marker Style', q.id, 'checkStyle', q.checkStyle || 'box', [['box', 'Checkboxes [  ]'], ['yn', 'Yes / No'], ['stars', '3-Star Rating'], ['faces', 'Smiley Self-Check']])}
          </div>
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest font-heading">Checklist Criteria</label>
            ${(q.items || []).map((it, idx) => `
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-slate-400 w-5 text-center">${idx + 1}.</span>
                <input type="text" data-action="update-checklist-item" data-qid="${q.id}" data-itemid="${it.id}" value="${esc(it.text)}" placeholder="Criterion ${idx + 1}" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border-2 border-dark dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-semibold text-dark dark:text-white outline-none focus:border-blue" />
                <button type="button" data-action="delete-checklist-item" data-qid="${q.id}" data-itemid="${it.id}" class="text-slate-400 hover:text-red-500 p-1.5 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
            `).join('')}
            <button type="button" data-action="add-checklist-item" data-qid="${q.id}" class="text-xs text-blue hover:text-blue/80 font-heading font-black uppercase tracking-wider flex items-center gap-1.5 mt-1">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Criterion
            </button>
          </div>
        </div>
      `;
    }


    // --- HTML Generators (Preview) ---
    function getPreviewScaleMeta() {
      const settings = getWorksheetSettings();
      const map = {
        sm: { text: 'text-sm', blockGap: 'mb-4', wrapperText: 'text-sm' },
        md: { text: 'text-base', blockGap: 'mb-7', wrapperText: 'text-base' },
        lg: { text: 'text-lg', blockGap: 'mb-9', wrapperText: 'text-lg' }
      };
      return map[settings.fontSize] || map.md;
    }

    function getWorksheetLookStyles() {
      const settings = getWorksheetSettings();
      const scale = getPreviewScaleMeta();
      const accent = WS_ACCENTS[settings.accentColor] || WS_ACCENTS.blue;
      const fontMap = {
        sans: "'Nunito', system-ui, -apple-system, sans-serif",
        serif: "'Merriweather', Georgia, Cambria, serif",
        rounded: "'Fredoka', 'Nunito', sans-serif",
        mono: "ui-monospace, 'SFMono-Regular', Menlo, monospace"
      };
      return {
        settings,
        scale,
        accent,
        theme: settings.theme || 'classic',
        isTwoCol: Number(settings.questionColumns) === 2,
        fontCss: fontMap[settings.fontFamily] || fontMap.sans
      };
    }

    function getPreviewNumBadgeHTML(index, look) {
      const t = look.theme;
      if (t === 'neo') {
        return `<span class="inline-flex items-center justify-center min-w-[1.65rem] h-6 px-1.5 rounded-md font-extrabold text-xs text-white shrink-0 border border-slate-900" style="background:${look.accent.hex}">${index}</span>`;
      }
      if (t === 'modern') {
        return `<span class="inline-flex items-center justify-center min-w-[1.65rem] h-6 px-1.5 rounded-md font-bold text-xs shrink-0" style="background:${look.accent.soft}; color:${look.accent.dark}; border:1px solid ${look.accent.hex}55">${index}</span>`;
      }
      if (t === 'kids') {
        return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-xs text-white shrink-0" style="background:${look.accent.hex}">${index}</span>`;
      }
      if (t === 'notebook') {
        return `<span class="font-extrabold underline decoration-2 shrink-0" style="text-decoration-color:${look.accent.hex}; color:${look.accent.dark}">#${index}</span>`;
      }
      if (t === 'exam') {
        return `<span class="font-bold text-slate-900 shrink-0 tabular-nums">Q${index}.</span>`;
      }
      return `<span class="font-bold text-slate-900 shrink-0">${index}.</span>`;
    }

    function getPreviewCardStyle(look) {
      const t = look.theme;
      if (t === 'neo') {
        return 'border: 2px solid #0f172a; border-radius: 12px; padding: 13px 15px; background: #ffffff; box-shadow: 0 3px 0 #0f172a;';
      }
      if (t === 'modern') {
        return `border: 1px solid #cbd5e1; border-left: 4px solid ${look.accent.hex}; border-radius: 10px; padding: 12px 14px; background: #ffffff;`;
      }
      if (t === 'kids') {
        return `border: 2px dashed ${look.accent.hex}88; border-radius: 16px; padding: 13px 15px; background: ${look.accent.soft}55;`;
      }
      if (t === 'notebook') {
        return `border-left: 3px double ${look.accent.hex}; padding: 6px 10px 10px 13px; border-bottom: 1px dashed #cbd5e1;`;
      }
      if (t === 'exam') {
        return 'border-bottom: 1px solid #cbd5e1; padding-bottom: 12px;';
      }
      return '';
    }

    function wrapPreviewQuestionBlock(index, q, promptHtml, bodyHtml) {
      const look = getWorksheetLookStyles();
      const gapCls = look.isTwoCol ? '' : look.scale.blockGap;
      const cardStyle = getPreviewCardStyle(look);
      const scoreHtml = fmtPreviewScore(q.points);
      return `
        <div class="print-block ${gapCls}" style="${cardStyle}">
          <div class="flex items-start gap-2.5">
            ${getPreviewNumBadgeHTML(index, look)}
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-baseline gap-3">
                <div class="flex-1 min-w-0">${promptHtml}</div>
                ${scoreHtml ? `<span class="text-xs font-semibold text-slate-500 shrink-0 print:text-black">${scoreHtml}</span>` : ''}
              </div>
              ${getQuestionImagePreviewHTML(q)}
              ${bodyHtml}
            </div>
          </div>
        </div>
      `;
    }

    function getQuestionText(text) {
      const scale = getPreviewScaleMeta();
      return `<div class="${scale.text} font-medium mb-2.5 whitespace-pre-wrap leading-snug">${esc(text)}</div>`;
    }

    function getQuestionImagePreviewHTML(q) {
      const src = getWsImageSrc(q && q.imageId);
      if (!src) return '';
      const clsMap = { sm: 'max-h-28', md: 'max-h-44', lg: 'max-h-64' };
      const sizeCls = clsMap[q.imageSize] || clsMap.md;
      return `<div class="my-2.5"><img src="${esc(src)}" alt="" class="${sizeCls} max-w-full object-contain rounded-lg border border-slate-200 bg-white p-1" /></div>`;
    }

    function fmtPreviewScore(pts) {
      const settings = getWorksheetSettings();
      if (!settings.showPoints) return '';
      const n = Number(pts) || 0;
      if (n <= 0) return '';
      if (settings.theme === 'exam') return `[${n} pt${n !== 1 ? 's' : ''}]`;
      return `(${n} pt${n !== 1 ? 's' : ''})`;
    }

    function getPreviewWordBankHTML() {
      const look = getWorksheetLookStyles();
      if (!look.settings.showWordBank) return '';
      const rawAnswers = [];
      const seen = new Set();
      (state.worksheet.questions || []).forEach((q) => {
        if (q.type !== 'fib' || !q.answer) return;
        const word = String(q.answer).trim();
        if (!word) return;
        const key = word.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          rawAnswers.push(word);
        }
      });
      if (rawAnswers.length === 0) return '';
      rawAnswers.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return `
        <div class="mb-6 p-3.5 rounded-xl border-2 border-dashed" style="border-color:${look.accent.hex}; background:${look.accent.soft}">
          <div class="text-xs font-extrabold uppercase tracking-wider mb-2" style="color:${look.accent.dark}">Word Bank</div>
          <div class="flex flex-wrap gap-2">
            ${rawAnswers.map(w => `<span class="px-2.5 py-0.5 border border-slate-400 rounded-lg bg-white text-sm font-semibold text-slate-900">${esc(w)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    function getMCQPreview(q, index) {
      const hasOptImg = Array.isArray(q.options) && q.options.some(o => Boolean(getWsImageSrc(o.imageId)));
      const optColMode = String(q.optColumns || 'auto');
      let layoutCls = 'flex flex-col gap-2 pl-1 mt-1.5';
      if (optColMode === '1') {
        layoutCls = 'grid grid-cols-1 gap-2 pl-1 mt-1.5';
      } else if (optColMode === '2') {
        layoutCls = 'grid grid-cols-2 gap-2.5 pl-1 mt-1.5';
      } else if (optColMode === '4') {
        layoutCls = 'grid grid-cols-2 sm:grid-cols-4 gap-2 pl-1 mt-1.5';
      } else if (hasOptImg) {
        layoutCls = 'grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1 mt-1.5';
      }

      const optsHtml = `
        <div class="${layoutCls}">
          ${(q.options || []).map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = state.showAnswers && opt.isCorrect;
            const circleCls = isCorrect ? 'border-blue-600 text-blue-700 bg-blue-50 font-bold' : 'border-slate-500 text-slate-700';
            const textCls = isCorrect ? 'text-blue-800 font-bold' : 'text-slate-800';
            const optImg = getWsImageSrc(opt.imageId);
            return `
              <div class="flex items-start gap-2.5 min-w-0">
                <span class="flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${circleCls}">${letter}</span>
                <div class="flex flex-col gap-1 pt-0.5 min-w-0">
                  ${optImg ? `<img src="${esc(optImg)}" alt="" class="max-h-24 max-w-[160px] object-contain rounded border border-slate-200 bg-white p-0.5" />` : ''}
                  ${(opt.text || !optImg) ? `<span class="${textCls} break-words">${esc(opt.text) || '...'}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text), optsHtml);
    }

    function getFIBPreview(q, index) {
      const scale = getPreviewScaleMeta();
      const rawText = String(q.text || '');
      const hasBlank = /_{3,}|\[blank\]/i.test(rawText);
      let displayHtml = esc(rawText);
      if (state.showAnswers && hasBlank) {
        displayHtml = displayHtml.replace(/_{3,}|\[blank\]/gi, `<strong class="text-blue-700 font-bold border-b-2 border-blue-600 px-1.5">${esc(q.answer) || 'Answer'}</strong>`);
      } else if (hasBlank) {
        displayHtml = displayHtml.replace(/_{3,}|\[blank\]/gi, `<span class="inline-block border-b-2 border-slate-800 min-w-[7rem] mx-1">&nbsp;</span>`);
      }

      const promptHtml = `<div class="${scale.text} font-medium leading-relaxed whitespace-pre-wrap mb-1">${displayHtml}</div>`;
      const extraLine = !hasBlank ? `
        <div class="mt-3 border-b-2 border-slate-800 w-64 h-6">
          ${state.showAnswers ? `<span class="text-blue-700 font-bold">${esc(q.answer)}</span>` : ''}
        </div>
      ` : '';

      return wrapPreviewQuestionBlock(index, q, promptHtml, extraLine);
    }

    function getSAPreview(q, index) {
      const lineCount = Math.max(1, Math.min(10, parseInt(q.lines, 10) || 2));
      const answerArea = state.showAnswers
        ? `<div class="mt-2 text-blue-700 font-semibold italic">Answer: ${esc(q.answer) || 'No answer key provided.'}</div>`
        : `<div class="mt-3 flex flex-col gap-5">${`<div class="w-full border-b border-slate-500 h-2"></div>`.repeat(lineCount)}</div>`;

      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text), answerArea);
    }

    function getTFPreview(q, index) {
      const labelsMap = {
        tf: ['True', 'False'],
        yn: ['Yes', 'No'],
        ci: ['Correct', 'Incorrect']
      };
      const [posLbl, negLbl] = labelsMap[q.tfStyle] || labelsMap.tf;
      const trueCls = (state.showAnswers && q.isTrue) ? 'border-blue-600 text-blue-700 bg-blue-50 font-bold' : 'border-slate-300 text-slate-700';
      const falseCls = (state.showAnswers && !q.isTrue) ? 'border-blue-600 text-blue-700 bg-blue-50 font-bold' : 'border-slate-300 text-slate-700';

      const bodyHtml = `
        <div class="flex flex-wrap gap-3 mt-2 text-sm font-semibold">
          <span class="px-3.5 py-0.5 rounded-full border-2 ${trueCls}">${posLbl}</span>
          <span class="px-3.5 py-0.5 rounded-full border-2 ${falseCls}">${negLbl}</span>
        </div>
        ${q.requireCorrection ? `
          <div class="mt-2.5 flex items-end gap-2 text-xs text-slate-600 font-medium">
            <span class="shrink-0">If ${negLbl}, correction:</span>
            <div class="flex-1 border-b border-slate-500 h-4"></div>
          </div>
        ` : ''}
      `;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text), bodyHtml);
    }

    function getMatchingPreview(q, index) {
      const look = getWorksheetLookStyles();
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const rightItems = [...pairs].sort((a, b) => String(a && a.id || '').localeCompare(String(b && b.id || '')));
      const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const rightItemsWithLabels = rightItems.map((item, i) => ({ ...item, label: labels[i % labels.length] }));
      const isLineMatch = q.matchStyle === 'lines';

      const rowCardCls = look.theme === 'minimal'
        ? 'border-b border-slate-200 py-1.5 px-1'
        : look.theme === 'neo'
          ? 'border-2 border-slate-900 rounded-lg bg-white py-2 px-2.5'
          : 'border border-slate-300 rounded-lg bg-slate-50/70 py-1.5 px-2.5';

      const gridGapCls = isLineMatch
        ? (look.isTwoCol ? 'gap-x-5 gap-y-2.5' : 'gap-x-10 sm:gap-x-14 gap-y-2.5')
        : (look.isTwoCol ? 'gap-x-3 gap-y-2' : 'gap-x-5 gap-y-2');

      const imgSizeCls = look.isTwoCol
        ? 'max-h-12 max-w-[78px]'
        : 'max-h-14 max-w-[110px]';

      const rowsHtml = pairs.map((pair, idx) => {
        const rightItem = rightItemsWithLabels[idx];
        const correctRight = rightItemsWithLabels.find(r => r.id === pair.id);
        const leftImg = getWsImageSrc(pair.leftImageId);
        const rightImg = rightItem ? getWsImageSrc(rightItem.rightImageId) : '';

        const leftCell = `
          <div class="flex items-center justify-between gap-2.5 min-w-0 ${rowCardCls}">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              ${!isLineMatch ? `
                <span class="inline-flex items-center justify-center w-7 h-7 rounded-md border-2 border-slate-700 bg-white text-center font-extrabold text-sm shrink-0">
                  ${state.showAnswers ? `<span class="text-blue-700 leading-none">${correctRight?.label || ''}</span>` : ''}
                </span>
              ` : ''}
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-extrabold shrink-0" style="background:${look.accent.soft}; color:#0f172a; border:1.5px solid ${look.accent.hex};">${idx + 1}</span>
              ${leftImg ? `<img src="${esc(leftImg)}" alt="" class="${imgSizeCls} object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0" />` : ''}
              ${pair.left ? `<span class="font-medium leading-snug break-words min-w-0">${esc(pair.left)}</span>` : ''}
            </div>
            ${isLineMatch ? `
              <div class="flex items-center gap-1.5 shrink-0">
                ${state.showAnswers ? `<span class="text-[11px] text-blue-700 font-extrabold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">→ ${correctRight?.label || ''}</span>` : ''}
                <span class="w-3 h-3 rounded-full border-2 border-slate-800 inline-block bg-white shrink-0"></span>
              </div>
            ` : ''}
          </div>
        `;

        const rightCell = rightItem ? `
          <div class="flex items-center gap-2.5 min-w-0 ${rowCardCls}">
            ${isLineMatch ? `<span class="w-3 h-3 rounded-full border-2 border-slate-800 inline-block bg-white shrink-0"></span>` : ''}
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-extrabold shrink-0 bg-slate-100 text-slate-800 border border-slate-400">${rightItem.label}</span>
            ${rightImg ? `<img src="${esc(rightImg)}" alt="" class="${imgSizeCls} object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0" />` : ''}
            ${rightItem.right ? `<span class="font-medium leading-snug break-words min-w-0">${esc(rightItem.right)}</span>` : ''}
          </div>
        ` : '<div></div>';

        return `
          <div class="grid grid-cols-2 ${gridGapCls} items-stretch print-block">
            ${leftCell}
            ${rightCell}
          </div>
        `;
      }).join('');

      const bodyHtml = `<div class="flex flex-col gap-2 w-full mt-3">${rowsHtml}</div>`;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text || 'Match the following items:'), bodyHtml);
    }

    function getEssayPreview(q, index) {
      const count = Math.max(1, parseInt(q.lines, 10) || 5);
      const style = q.lineStyle || 'ruled';
      let surfaceHtml = '';

      if (state.showAnswers) {
        surfaceHtml = `
          <div class="mt-3 border border-blue-200 bg-blue-50 text-blue-800 p-3.5 rounded-lg text-sm whitespace-pre-wrap">
            <strong class="block mb-1 text-blue-900 uppercase text-xs tracking-wider">Teacher Rubric / Expected Elements:</strong>
            ${esc(q.answer) || 'No rubric provided.'}
          </div>
        `;
      } else if (style === 'primary') {
        const band = `
          <div class="w-full relative" style="height:30px; border-top:1px solid #94a3b8; border-bottom:1.5px solid #475569;">
            <div style="position:absolute; left:0; right:0; top:50%; border-top:1px dashed #cbd5e1;"></div>
          </div>
        `;
        surfaceHtml = `<div class="mt-3 flex flex-col gap-2.5 w-full">${band.repeat(count)}</div>`;
      } else if (style === 'box') {
        const h = Math.max(76, count * 26);
        surfaceHtml = `<div class="mt-3 w-full rounded-lg border-2 border-slate-500 bg-white" style="height:${h}px"></div>`;
      } else if (style === 'grid') {
        const h = Math.max(96, count * 26);
        surfaceHtml = `<div class="mt-3 w-full rounded-lg border-2 border-slate-500" style="height:${h}px; background-color:#ffffff; background-image:linear-gradient(to right,#cbd5e1 1px,transparent 1px),linear-gradient(to bottom,#cbd5e1 1px,transparent 1px); background-size:20px 20px;"></div>`;
      } else {
        const lineHtml = `<div class="w-full border-b border-slate-400 h-2"></div>`.repeat(count);
        surfaceHtml = `<div class="mt-4 flex flex-col gap-5 w-full">${lineHtml}</div>`;
      }

      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text), surfaceHtml);
    }

    function getSectionPreview(q) {
      const look = getWorksheetLookStyles();
      const spanCls = look.isTwoCol ? 'col-span-full' : '';
      let frameStyle = `border-bottom: 2.5px solid ${look.accent.hex}; padding: 8px 4px;`;
      if (look.theme === 'neo') {
        frameStyle = `border: 2px solid #0f172a; background: ${look.accent.soft}; border-radius: 10px; padding: 10px 14px; box-shadow: 0 3px 0 #0f172a;`;
      } else if (look.theme === 'modern') {
        frameStyle = `border-left: 5px solid ${look.accent.hex}; background: ${look.accent.soft}; border-radius: 0 8px 8px 0; padding: 10px 14px;`;
      } else if (look.theme === 'kids') {
        frameStyle = `border: 2px dashed ${look.accent.hex}; background: ${look.accent.soft}; border-radius: 14px; padding: 10px 16px;`;
      } else if (look.theme === 'exam') {
        frameStyle = 'border-top: 2px solid #0f172a; border-bottom: 1.5px solid #0f172a; background: #f1f5f9; padding: 8px 12px;';
      }
      return `
        <div class="print-block ${spanCls} mt-2 mb-3" style="${frameStyle}">
          <div class="font-extrabold text-lg tracking-wide uppercase" style="color:${look.accent.dark}">${esc(q.text || 'SECTION')}</div>
          ${q.subtitle ? `<div class="text-sm text-slate-600 mt-0.5 font-medium">${esc(q.subtitle)}</div>` : ''}
          ${getQuestionImagePreviewHTML(q)}
        </div>
      `;
    }

    function getPassagePreview(q) {
      const look = getWorksheetLookStyles();
      const spanCls = look.isTwoCol ? 'col-span-full' : '';
      const style = q.boxStyle || 'card';
      const lines = String(q.text || '').split(/\r?\n/);

      const bodyLines = q.showLineNumbers
        ? lines.map((ln, idx) => `<div class="flex gap-3"><span class="text-xs text-slate-400 font-mono w-5 text-right shrink-0 select-none pt-0.5">${idx + 1}</span><span class="flex-1 whitespace-pre-wrap">${esc(ln) || '&nbsp;'}</span></div>`).join('')
        : `<div class="whitespace-pre-wrap leading-relaxed">${esc(q.text)}</div>`;

      let boxStyleCss = 'border: 1.5px solid #94a3b8; border-radius: 12px; background: #f8fafc; padding: 14px 16px;';
      if (style === 'grammar') {
        boxStyleCss = `border: 2px solid ${look.accent.hex}; border-radius: 12px; background: ${look.accent.soft}; padding: 14px 16px;`;
      } else if (style === 'dialogue') {
        boxStyleCss = `border-left: 4px solid ${look.accent.hex}; background: #f8fafc; border-radius: 0 10px 10px 0; padding: 12px 16px;`;
      } else if (style === 'plain') {
        boxStyleCss = 'border-top: 1.5px solid #94a3b8; border-bottom: 1.5px solid #94a3b8; padding: 12px 6px;';
      }

      return `
        <div class="print-block ${spanCls} ${look.scale.blockGap}" style="${boxStyleCss}">
          ${q.title ? `<div class="text-xs font-extrabold uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-300/80" style="color:${look.accent.dark}">${esc(q.title)}</div>` : ''}
          <div class="${look.scale.text} text-slate-800">${bodyLines}</div>
          ${getQuestionImagePreviewHTML(q)}
        </div>
      `;
    }

    function getUnscramblePreview(q, index) {
      const look = getWorksheetLookStyles();
      const rowsHtml = (q.items || []).map((it, idx) => {
        const subLbl = String.fromCharCode(97 + (idx % 26));
        return `
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-1.5">
            <div class="flex items-center flex-wrap gap-2 min-w-0">
              <span class="font-bold text-slate-700 text-sm">${subLbl}.</span>
              <span class="font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900">${esc(it.scrambled || '...')}</span>
              ${it.hint ? `<span class="text-xs italic text-slate-500">(${esc(it.hint)})</span>` : ''}
            </div>
            <div class="flex-1 min-w-[140px] border-b-2 border-slate-700 h-6 flex items-end pb-0.5">
              ${state.showAnswers ? `<span class="text-sm font-bold" style="color:${look.accent.dark}">${esc(it.answer)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text || 'Unscramble the words:'), `<div class="space-y-1 mt-1">${rowsHtml}</div>`);
    }

    function getSortPreview(q, index) {
      const look = getWorksheetLookStyles();
      const cats = Array.isArray(q.categories) ? q.categories : [];
      const colCount = Math.min(4, Math.max(2, cats.length));
      const pool = [];
      cats.forEach(cat => {
        String(cat.items || '').split(',').map(s => s.trim()).filter(Boolean).forEach(item => pool.push(item));
      });
      pool.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      const poolHtml = pool.length > 0 ? `
        <div class="mb-3 p-2.5 rounded-lg border border-dashed flex flex-wrap gap-1.5 items-center" style="border-color:${look.accent.hex}; background:${look.accent.soft}">
          <span class="text-[11px] font-extrabold uppercase tracking-wider mr-1" style="color:${look.accent.dark}">Pool:</span>
          ${pool.map(w => `<span class="px-2 py-0.5 bg-white border border-slate-400 rounded text-xs font-semibold text-slate-900">${esc(w)}</span>`).join('')}
        </div>
      ` : '';

      const gridHtml = `
        ${poolHtml}
        <div class="grid gap-0 border-2 border-slate-800 rounded-lg overflow-hidden mt-2" style="grid-template-columns: repeat(${colCount}, minmax(0, 1fr));">
          ${cats.map((cat, idx) => {
            const catItems = String(cat.items || '').split(',').map(s => s.trim()).filter(Boolean);
            const rowCount = Math.max(3, catItems.length);
            return `
              <div class="${idx < cats.length - 1 ? 'border-r border-slate-800' : ''} flex flex-col">
                <div class="px-2.5 py-2 text-center font-extrabold text-sm border-b-2 border-slate-800" style="background:${look.accent.soft}; color:${look.accent.dark}">${esc(cat.title || `Category ${idx + 1}`)}</div>
                <div class="p-2.5 flex-1 flex flex-col justify-between gap-4 bg-white min-h-[110px]">
                  ${state.showAnswers
                    ? `<div class="text-sm font-semibold text-blue-700 space-y-1">${catItems.map(w => `<div>• ${esc(w)}</div>`).join('') || '<span class="italic text-slate-400">—</span>'}</div>`
                    : `<div class="w-full border-b border-slate-300 h-4"></div>`.repeat(rowCount)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text || 'Sort the items into the categories:'), gridHtml);
    }

    function getDrawingPreview(q, index) {
      const hMap = { sm: 110, md: 185, lg: 265 };
      const h = hMap[q.boxHeight] || 185;
      const style = q.boxStyle || 'blank';
      let canvasBg = 'background:#ffffff;';
      if (style === 'dots') {
        canvasBg = 'background-color:#ffffff; background-image:radial-gradient(#94a3b8 1.25px, transparent 1.25px); background-size:16px 16px;';
      } else if (style === 'grid') {
        canvasBg = 'background-color:#ffffff; background-image:linear-gradient(to right,#e2e8f0 1px,transparent 1px),linear-gradient(to bottom,#e2e8f0 1px,transparent 1px); background-size:18px 18px;';
      }
      const splitInner = style === 'split'
        ? `<div class="w-full h-full grid grid-cols-2"><div class="border-r-2 border-dashed border-slate-400 h-full"></div><div class="h-full"></div></div>`
        : '';
      const capCount = Math.max(0, Math.min(6, parseInt(q.captionLines, 10) || 0));
      const captionHtml = capCount > 0
        ? `<div class="mt-3 flex flex-col gap-5">${`<div class="w-full border-b border-slate-500 h-2"></div>`.repeat(capCount)}</div>`
        : '';
      const keyNote = (state.showAnswers && q.answer)
        ? `<div class="mt-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5">Key / Labels: ${esc(q.answer)}</div>`
        : '';

      const bodyHtml = `
        <div class="mt-2 w-full rounded-xl border-2 border-slate-700 overflow-hidden" style="height:${h}px; ${canvasBg}">${splitInner}</div>
        ${keyNote}
        ${captionHtml}
      `;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text || 'Draw and label below:'), bodyHtml);
    }

    function getChecklistPreview(q, index) {
      const style = q.checkStyle || 'box';
      const renderMarker = () => {
        if (style === 'yn') {
          return `<span class="text-xs font-semibold text-slate-600 whitespace-nowrap border border-slate-400 rounded px-2 py-0.5">Yes / No</span>`;
        }
        if (style === 'stars') {
          return `<span class="text-sm tracking-widest text-slate-600 whitespace-nowrap">☆ ☆ ☆</span>`;
        }
        if (style === 'faces') {
          return `
            <span class="inline-flex items-center gap-1.5 text-slate-600 shrink-0" aria-hidden="true">
              <span class="w-4 h-4 rounded-full border border-slate-600 inline-flex items-center justify-center text-[9px] font-bold">☺</span>
              <span class="w-4 h-4 rounded-full border border-slate-600 inline-flex items-center justify-center text-[9px] font-bold">·</span>
              <span class="w-4 h-4 rounded-full border border-slate-600 inline-flex items-center justify-center text-[9px] font-bold">☹</span>
            </span>
          `;
        }
        return `<span class="w-4 h-4 rounded border-2 border-slate-700 inline-block shrink-0 bg-white"></span>`;
      };

      const rowsHtml = `
        <div class="mt-2 divide-y divide-slate-200 border border-slate-300 rounded-lg bg-white overflow-hidden">
          ${(q.items || []).map(it => `
            <div class="flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-800">
              <span class="flex-1">${esc(it.text)}</span>
              ${renderMarker()}
            </div>
          `).join('')}
        </div>
      `;
      return wrapPreviewQuestionBlock(index, q, getQuestionText(q.text || 'Checklist:'), rowsHtml);
    }


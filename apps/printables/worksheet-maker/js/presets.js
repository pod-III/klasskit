    // --- Starter Presets & Guided Bulk Import ---
    let starterPresets = [];
    let starterPresetsOpen = true;
    let starterPresetFilter = 'ALL';
    let loadedPresetId = null;
    let worksheetBulkModal = null;

    const WORKSHEET_IMPORT_TEMPLATE = [
      '## Daily Routines & Grammar Review',
      '? Read each question carefully. Circle or write the best answer.',
      '',
      '[mcq] @2pt What time does Sara usually catch the morning bus?',
      '- At quarter to seven',
      '*- At half past seven',
      '- At noon',
      '- At midnight',
      '',
      '[fib] Every weekday, Leo ___ (brush) his teeth after breakfast.',
      '= brushes',
      '',
      '[tf] Sara and her brother walk to the train station together on Sundays.',
      '*false',
      '',
      '[matching] @3pt Match each daily habit with the best room or place.',
      '- Brush your teeth | Bathroom',
      '- Eat dinner with family | Dining room',
      '- Read silently before sleep | Bedroom',
      '',
      '[sa] Write two things you usually do after school.',
      '= Sample: I do my homework and help set the table for dinner.',
      '',
      '[essay] @5pt ~4 Describe your favorite weekend morning in 3–4 complete sentences.',
      '= Look for Present Simple verbs, clear time markers, and proper punctuation.'
    ].join('\n');

    function hydrateWorksheetQuestions(rawQuestions) {
      return normalizeWorksheetState({ questions: rawQuestions }, { forceNewIds: true }).worksheet.questions;
    }

    async function fetchStarterPresets() {
      try {
        const res = await fetch('presets.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) starterPresets = data;
        }
      } catch (e) {
        console.warn('Could not load worksheet presets:', e);
      }
    }

    function getStarterPresetsSidebarHTML() {
      const levels = ['ALL', ...Array.from(new Set(starterPresets.map(p => p.level).filter(Boolean)))];
      const filtered = starterPresetFilter === 'ALL'
        ? starterPresets
        : starterPresets.filter(p => p.level === starterPresetFilter);
      const levelPillTones = {
        A1: 'bg-[#1ea7fd]/15 text-[#0369a1] dark:text-[#5cc0ff] border-[#1ea7fd]/40',
        A2: 'bg-[#00d063]/15 text-[#047857] dark:text-[#34e585] border-[#00d063]/40',
        B1: 'bg-[#ff7e33]/15 text-[#c2410c] dark:text-[#ff9c60] border-[#ff7e33]/40',
        B2: 'bg-[#ff4785]/15 text-[#be185d] dark:text-[#ff70a0] border-[#ff4785]/40',
        C1: 'bg-[#ff4785]/15 text-[#be185d] dark:text-[#ff70a0] border-[#ff4785]/40',
        C2: 'bg-[#ff4785]/15 text-[#be185d] dark:text-[#ff70a0] border-[#ff4785]/40'
      };

      const pillsHtml = levels.length > 1 ? `
        <div class="flex flex-wrap gap-1.5 mb-3">
          ${levels.map(lvl => {
            const active = lvl === starterPresetFilter;
            return `<button data-action="filter-presets" data-level="${esc(lvl)}" class="px-2.5 py-1 rounded-lg border-2 border-dark dark:border-slate-500 text-[10px] font-heading font-bold uppercase tracking-wider transition-all ${active ? 'bg-blue text-white shadow-hard-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${esc(lvl)}</button>`;
          }).join('')}
        </div>
      ` : '';

      const cardsHtml = filtered.length === 0
        ? `<div class="text-center py-5 text-xs font-bold text-slate-400">No starter packs loaded yet.</div>`
        : filtered.map(preset => {
            const qCount = Array.isArray(preset.questions) ? preset.questions.length : 0;
            const toneCls = levelPillTones[preset.level] || 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600';
            const isLoaded = loadedPresetId === preset.id && !activeSetId;
            return `
              <button data-action="load-starter-preset" data-preset-id="${esc(preset.id)}" class="w-full text-left p-2.5 rounded-xl border-2 transition-all group ${isLoaded ? 'border-blue bg-blue/5 dark:bg-blue/10' : 'border-dark/80 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/70 hover:border-blue hover:bg-blue/5'}">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${preset.level ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded border ${toneCls}">${esc(preset.level)}</span>` : ''}
                      <span class="font-heading font-bold text-xs text-dark dark:text-white group-hover:text-blue truncate">${esc(preset.title)}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-snug">${esc(preset.topic || preset.instructions || '')}</p>
                  </div>
                  <span class="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-mono">${qCount} Qs</span>
                </div>
              </button>
            `;
          }).join('');

      return `
        <section class="border-t-2 border-slate-100 dark:border-slate-700 pt-4">
          <button type="button" data-action="toggle-presets-drawer" class="w-full flex items-center justify-between text-left group">
            <span class="section-label mb-0 group-hover:text-brand-blue transition-colors flex items-center gap-1.5">
              Starter Presets
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">${starterPresets.length}</span>
            </span>
            <i data-lucide="${starterPresetsOpen ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-slate-400"></i>
          </button>
          ${starterPresetsOpen ? `
            <div class="mt-3 animate-pop-in">
              ${pillsHtml}
              <div class="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                ${cardsHtml}
              </div>
            </div>
          ` : ''}
        </section>
      `;
    }

    async function applyStarterPreset(presetId) {
      const preset = starterPresets.find(p => p.id === presetId);
      if (!preset) return;
      if (state.worksheet.questions.length > 0 && loadedPresetId !== preset.id) {
        const confirmed = await showConfirmModal(
          `Load starter pack "${preset.title}"? This will replace the current worksheet questions in the editor.`,
          {
            title: 'Load Starter Preset?',
            confirmText: 'Load Preset',
            cancelText: 'Cancel',
            icon: 'sparkles',
            iconColor: 'blue'
          }
        );
        if (!confirmed) return;
      }

      activeSetId = null;
      activeSetName = null;
      loadedPresetId = preset.id;

      state.worksheet = {
        title: preset.titleText || preset.title || 'Starter Worksheet',
        instructions: preset.instructions || 'Please read each question carefully and provide the best possible answer.',
        questions: hydrateWorksheetQuestions(preset.questions),
        settings: getWorksheetSettings()
      };
      state.viewMode = 'edit';
      state.showAnswers = false;
      saveState();
      render();
      updateActiveIndicator();
      const nameInput = document.getElementById('set-name-input');
      if (nameInput && !activeSetId) nameInput.value = preset.title || '';
    }

    function parseWorksheetImport(rawText) {
      const norm = String(rawText || '').replace(/\r\n/g, '\n');
      const rawLines = norm.split('\n');
      let parsedTitle = '';
      let parsedInstructions = '';

      // Extract leading ## Title and ? Instructions before splitting blocks
      let bodyStartIdx = 0;
      for (let i = 0; i < rawLines.length; i++) {
        const trimmed = rawLines[i].trim();
        if (!trimmed) {
          bodyStartIdx = i + 1;
          continue;
        }
        const titleM = trimmed.match(/^##+\s*(.+)$/);
        if (titleM) {
          parsedTitle = titleM[1].trim();
          bodyStartIdx = i + 1;
          continue;
        }
        const instM = trimmed.match(/^\?\s*(.+)$/);
        if (instM) {
          parsedInstructions = instM[1].trim();
          bodyStartIdx = i + 1;
          continue;
        }
        break;
      }

      const bodyText = rawLines.slice(bodyStartIdx).join('\n');
      const blocks = String(bodyText || '')
        .split(/\n(?:\s*---+\s*\n|\s*\n+)/)
        .map(b => b.replace(/^---+\s*|\s*---+$/g, '').trim())
        .filter(Boolean);
      const questions = [];
      const warnings = [];
      const badges = [];

      const typeAliases = {
        mcq: 'mcq',
        fib: 'fib',
        fill: 'fib',
        sa: 'sa',
        short: 'sa',
        tf: 'tf',
        truefalse: 'tf',
        'true/false': 'tf',
        matching: 'matching',
        match: 'matching',
        essay: 'essay'
      };

      const badgeMeta = {
        mcq: { tag: 'MCQ', tone: 'pink' },
        fib: { tag: 'FIB', tone: 'orange' },
        sa: { tag: 'SA', tone: 'slate' },
        tf: { tag: 'T/F', tone: 'green' },
        matching: { tag: 'MATCH', tone: 'blue' },
        essay: { tag: 'ESSAY', tone: 'orange' }
      };

      const isDirectiveLine = (l) => (
        /^(?:\*-|-\s+|\*\s+|=|a(?:nswer)?\s*:|~\d+(?:\s*lines?)?$|[A-Da-d][.)]\s+)/i.test(l)
        || /^.+?\s*(?:\||=>|->)\s*.+$/.test(l)
        || /^\*?\s*(?:true|false)\s*$/i.test(l)
      );

      blocks.forEach((blockText) => {
        const bLines = String(blockText || '').split('\n').map(l => l.trim()).filter(Boolean);
        if (!bLines.length) return;
        if (bLines.length === 1 && /^##+\s*(.+)$/.test(bLines[0])) {
          if (!parsedTitle) parsedTitle = bLines[0].replace(/^##+\s*/, '').trim();
          return;
        }
        if (bLines.length === 1 && /^\?\s*(.+)$/.test(bLines[0])) {
          if (!parsedInstructions) parsedInstructions = bLines[0].replace(/^\?\s*/, '').trim();
          return;
        }

        let explicitType = null;
        let points = 1;
        let essayLines = 5;
        let essayLinesExplicit = false;

        const stripHeaderTags = (str) => {
          let s = str;
          // [mcq], [fib], [fill], [tf], [sa], [matching], [essay]
          s = s.replace(/\[(mcq|fib|fill|sa|short|tf|truefalse|true\/false|matching|match|essay)\]/ig, (_, t) => {
            explicitType = typeAliases[t.toLowerCase()] || explicitType;
            return ' ';
          });
          // @2pt, @3pts, @5 or [2pt]
          s = s.replace(/(?:^|\s)@(\d+)(?:pts?)?(?=$|\s)/ig, (_, n) => {
            points = Math.max(0, parseInt(n, 10));
            return ' ';
          });
          s = s.replace(/\[(\d+)\s*pts?\]/ig, (_, n) => {
            points = Math.max(0, parseInt(n, 10));
            return ' ';
          });
          // ~4 or ~6 lines
          s = s.replace(/(?:^|\s)~(\d+)(?:\s*lines?)?(?=$|\s)/ig, (_, n) => {
            essayLines = Math.max(1, parseInt(n, 10));
            essayLinesExplicit = true;
            return ' ';
          });
          return s.replace(/\s{2,}/g, ' ').trim();
        };

        // Split prompt lines from answer/option/pair lines
        const promptParts = [];
        let splitIdx = bLines.length;
        const looksLikePair = (l) => /^.+?\s*(?:\||=>|->)\s*.+$/.test(l);
        for (let i = 0; i < bLines.length; i++) {
          if (i > 0 && isDirectiveLine(bLines[i])) {
            splitIdx = i;
            break;
          }
          const strippedProbe = stripHeaderTags(bLines[i]);
          if (i === 0 && strippedProbe && looksLikePair(strippedProbe) && (explicitType === 'matching' || bLines.slice(1).some(looksLikePair))) {
            splitIdx = 0;
            break;
          }
          // Strip optional Q numbering (1. / Q1:) on the very first line only
          let candidate = strippedProbe;
          if (i === 0) {
            candidate = candidate.replace(/^(?:Q?\d+[.)]\s+|Question\s*\d*\s*:\s*)/i, '').trim();
          }
          if (candidate) promptParts.push(candidate);
        }

        const promptText = promptParts.join('\n').trim();
        const bodyLines = bLines.slice(splitIdx);

        if (!promptText && bodyLines.length === 0) return;

        const options = [];
        const pairs = [];
        const answerParts = [];
        let tfVal = null;

        bodyLines.forEach((line) => {
          const cleanTagLine = stripHeaderTags(line);
          if (!cleanTagLine) return;

          // ~4 lines on a standalone line
          if (/^~(\d+)(?:\s*lines?)?$/i.test(cleanTagLine)) {
            const m = cleanTagLine.match(/^~(\d+)/);
            if (m) {
              essayLines = Math.max(1, parseInt(m[1], 10));
              essayLinesExplicit = true;
            }
            return;
          }

          // T/F explicit line (*true, *false, true, false, = true, = false)
          const tfM = cleanTagLine.match(/^(?:=\s*|a(?:nswer)?\s*:\s*|\*\s*)?(true|false)\s*$/i);
          if (tfM && (explicitType === 'tf' || (!cleanTagLine.startsWith('-') && options.length === 0 && pairs.length === 0))) {
            tfVal = tfM[1].toLowerCase() === 'true';
            return;
          }

          // Answer / rubric line (= Answer or A: Answer)
          const ansM = cleanTagLine.match(/^(?:=\s*|a(?:nswer)?\s*:\s*)(.*)$/i);
          if (ansM) {
            if (ansM[1].trim()) answerParts.push(ansM[1].trim());
            return;
          }

          // Matching pair line (- Left | Right, Left | Right, Left => Right, Left -> Right)
          const pairCandidate = cleanTagLine.replace(/^(?:-\s*|\*\s*|\d+[.)]\s+)/, '');
          const pairM = pairCandidate.match(/^(.+?)\s*(?:\||=>|->)\s*(.+)$/);
          if (pairM && (explicitType === 'matching' || explicitType === null)) {
            pairs.push({ id: generateId(), left: pairM[1].trim(), right: pairM[2].trim() });
            return;
          }

          // MCQ option (*- opt, - *opt, * opt, - opt, A) opt)
          const corrOptM = cleanTagLine.match(/^(?:\*-\s*|-\s*\*\s*|\*\s+)(.+)$/);
          if (corrOptM) {
            options.push({ id: generateId(), text: corrOptM[1].trim(), isCorrect: true });
            return;
          }
          const regOptM = cleanTagLine.match(/^(?:-\s+|[A-Da-d][.)]\s+)(.+)$/);
          if (regOptM) {
            let optText = regOptM[1].trim();
            let isCorr = false;
            if (/\((?:correct|✓)\)|\[(?:correct|✓)\]$/i.test(optText)) {
              isCorr = true;
              optText = optText.replace(/\s*(?:\((?:correct|✓)\)|\[(?:correct|✓)\])$/i, '').trim();
            }
            options.push({ id: generateId(), text: optText, isCorrect: isCorr });
            return;
          }

          // Continuation answer text if answer already started
          if (answerParts.length > 0) {
            answerParts.push(cleanTagLine);
          }
        });

        // Resolve final type
        let qType = explicitType;
        if (!qType) {
          if (pairs.length >= 2 || (pairs.length >= 1 && options.length === 0)) qType = 'matching';
          else if (tfVal !== null && options.length === 0) qType = 'tf';
          else if (options.length > 0) qType = 'mcq';
          else if (essayLinesExplicit) qType = 'essay';
          else if (promptText.includes('___')) qType = 'fib';
          else qType = 'sa';
        }

        const qNum = questions.length + 1;
        const ansText = answerParts.join('\n').trim();
        const qObj = {
          id: generateId(),
          type: qType,
          text: promptText || (qType === 'matching' ? 'Match the items on the left with the right.' : 'Question text'),
          points
        };

        let metaNote = '';
        if (qType === 'mcq') {
          if (options.length < 2) {
            warnings.push(`Q${qNum} (MCQ): Only ${options.length} option(s) found — add at least 2 "- Option" lines.`);
            while (options.length < 2) {
              options.push({ id: generateId(), text: `Option ${options.length + 1}`, isCorrect: false });
            }
          }
          if (!options.some(o => o.isCorrect)) {
            options[0].isCorrect = true;
            warnings.push(`Q${qNum} (MCQ): No option marked with "*" — defaulted Option A as correct.`);
          }
          qObj.options = options;
          metaNote = `${points}pt · ${options.length} opts`;
        } else if (qType === 'fib') {
          if (!qObj.text.includes('___')) {
            warnings.push(`Q${qNum} (FIB): Tip — add "___" in the prompt where the blank should appear.`);
          }
          if (!ansText) {
            warnings.push(`Q${qNum} (FIB): Missing "= Answer" key.`);
          }
          qObj.answer = ansText;
          metaNote = `${points}pt${ansText ? ` · A: ${ansText.slice(0, 20)}` : ''}`;
        } else if (qType === 'sa') {
          if (!ansText) {
            warnings.push(`Q${qNum} (Short Answer): No "= Answer" provided (students still see answer lines).`);
          }
          qObj.answer = ansText;
          metaNote = `${points}pt${ansText ? ' · key' : ''}`;
        } else if (qType === 'tf') {
          if (tfVal === null && options.length > 0) {
            const corrOpt = options.find(o => o.isCorrect);
            if (corrOpt && /^(?:true|false)$/i.test(corrOpt.text.trim())) {
              tfVal = corrOpt.text.trim().toLowerCase() === 'true';
            }
          }
          if (tfVal === null) {
            tfVal = true;
            warnings.push(`Q${qNum} (T/F): Missing "*true" or "*false" — defaulted to True.`);
          }
          qObj.isTrue = tfVal;
          metaNote = `${points}pt · ${tfVal ? 'True' : 'False'}`;
        } else if (qType === 'matching') {
          if (pairs.length < 2) {
            warnings.push(`Q${qNum} (Matching): Found ${pairs.length} pair(s) — use "Left | Right" lines.`);
            while (pairs.length < 2) pairs.push({ id: generateId(), left: '', right: '' });
          }
          qObj.pairs = pairs;
          metaNote = `${points}pt · ${pairs.length} pairs`;
        } else if (qType === 'essay') {
          qObj.lines = essayLines;
          qObj.answer = ansText;
          metaNote = `${points}pt · ${essayLines} lines`;
        }

        questions.push(qObj);
        const bm = badgeMeta[qType] || { tag: qType.toUpperCase(), tone: 'slate' };
        badges.push({
          tag: bm.tag,
          label: qObj.text.split('\n')[0],
          meta: metaNote,
          tone: bm.tone,
          title: qObj.text
        });
      });

      return {
        items: questions,
        warnings,
        badges,
        title: parsedTitle,
        instructions: parsedInstructions
      };
    }

    function openWorksheetBulkImport() {
      if (!window.KlassKitBulkImport) return;
      if (!worksheetBulkModal) {
        worksheetBulkModal = window.KlassKitBulkImport.create({
          id: 'ws-bulk-import-overlay',
          title: 'BULK IMPORT WORKSHEET',
          subtitle: 'Paste plain text or AI-generated questions (MCQ, Fill-in-Blank, T/F, Matching, Short Answer, Essay).',
          accentColor: 'pink',
          unitLabel: 'question',
          unitLabelPlural: 'questions',
          guideItems: [
            { label: 'Title & Guide', syntax: '## Worksheet Title\n? Student instructions', color: 'blue', desc: 'Optional top header. Separate each question with a blank line.' },
            { label: 'MCQ & T/F', syntax: '[mcq] Prompt\n- Wrong\n*- Right\n\n[tf] Statement\n*false', color: 'pink', desc: 'Prefix *- on the right choice. Auto-detects if tag omitted.' },
            { label: 'FIB & Short Ans', syntax: '[fib] She ___ home.\n= went\n\n[sa] Why?\n= Reason', color: 'orange', desc: 'Use ___ in Fill-in-Blank and = for the Answer Key.' },
            { label: 'Match & Essay', syntax: '[matching] Match:\n- Big | Small\n\n[essay] @5pt ~4 Prompt', color: 'green', desc: 'Use Left | Right for pairs, @5pt for points, ~4 for blank lines.' }
          ],
          tips: [
            '<strong>Fast Shorthand:</strong> Question types are auto-detected even without <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">[type]</code> tags whenever you use <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">- choices</code>, <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">*true/*false</code>, <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">Left | Right</code>, or <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">___</code>.',
            'Add <code class="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono">@3pt</code> on any question line to assign custom point values.'
          ],
          placeholder: '## Quick Grammar Check\n? Complete all items.\n\n[mcq] Yesterday I ___ a movie.\n- see\n*- saw\n- seen\n\n[fib] Water boils at ___ degrees Celsius.\n= 100',
          template: WORKSHEET_IMPORT_TEMPLATE,
          sample: WORKSHEET_IMPORT_TEMPLATE,
          options: [
            { id: 'appendMode', label: 'Append to current questions (instead of replacing worksheet)', defaultChecked: false },
            { id: 'saveToLibrary', label: 'Also save worksheet to Saved Worksheets library', defaultChecked: false }
          ],
          confirmText: 'Import Questions',
          parse: parseWorksheetImport,
          onImport: async (result, opts) => {
            if (!result || !Array.isArray(result.items) || result.items.length === 0) return false;
            const importedQs = result.items;

            if (opts.appendMode) {
              if (result.title && (!state.worksheet.title || state.worksheet.title === 'Untitled Worksheet' || state.worksheet.title === 'Weekly Quiz: Science & Humanities')) {
                state.worksheet.title = result.title;
              }
              if (result.instructions && !state.worksheet.instructions) {
                state.worksheet.instructions = result.instructions;
              }
              state.worksheet.questions = [...state.worksheet.questions, ...importedQs];
            } else {
              activeSetId = null;
              activeSetName = null;
              loadedPresetId = null;
              state.worksheet = {
                title: result.title || 'Imported Worksheet',
                instructions: result.instructions || 'Please read each question carefully and provide the best possible answer.',
                questions: normalizeWorksheetState({ questions: importedQs }, { forceNewIds: true }).worksheet.questions,
                settings: getWorksheetSettings()
              };
            }

            state.viewMode = 'edit';
            state.showAnswers = false;

            if (opts.saveToLibrary) {
              const saveName = (state.worksheet.title || 'Imported Worksheet').slice(0, 100);
              const stateData = {
                activeSetId: opts.appendMode ? activeSetId : null,
                viewMode: state.viewMode,
                showAnswers: state.showAnswers,
                worksheet: state.worksheet
              };
              const newId = await saveWorksheetSetToDB(saveName, stateData, opts.appendMode ? activeSetId : null);
              if (newId) {
                activeSetId = newId;
                activeSetName = saveName;
                allSets = await getAllWorksheetSets();
              }
            }

            saveState();
            render();
            return true;
          }
        });
      }
      worksheetBulkModal.open();
    }


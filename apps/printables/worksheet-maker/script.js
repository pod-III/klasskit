    // --- Actions & Helpers ---
    function collectAllUsedIds() {
      const used = new Set();
      (state.worksheet.questions || []).forEach(q => {
        if (q.id) used.add(String(q.id));
        if (Array.isArray(q.options)) q.options.forEach(o => { if (o.id) used.add(String(o.id)); });
        if (Array.isArray(q.pairs)) q.pairs.forEach(p => { if (p.id) used.add(String(p.id)); });
        if (Array.isArray(q.items)) q.items.forEach(it => { if (it.id) used.add(String(it.id)); });
        if (Array.isArray(q.categories)) q.categories.forEach(c => { if (c.id) used.add(String(c.id)); });
      });
      return used;
    }

    function getWorksheetSettings() {
      state.worksheet.settings = normalizeWorksheetSettings(state.worksheet.settings);
      return state.worksheet.settings;
    }

    function getTotalPoints() {
      return (state.worksheet.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
    }

    function addQuestion(type) {
      state.worksheet.questions.push(createDefaultQuestion(type));
      saveState();
      render(true); // pass true to scroll to bottom
    }

    function duplicateQuestion(id) {
      const idx = state.worksheet.questions.findIndex(q => q.id === id);
      if (idx < 0) return;
      const usedIds = collectAllUsedIds();
      const clone = normalizeQuestion(JSON.parse(JSON.stringify(state.worksheet.questions[idx])), {
        forceNewIds: true,
        usedIds
      });
      state.worksheet.questions.splice(idx + 1, 0, clone);
      saveState();
      render();
    }

    function changeQuestionType(id, nextType) {
      if (!Object.values(QUESTION_TYPES).some(t => t.id === nextType)) return;
      const idx = state.worksheet.questions.findIndex(q => q.id === id);
      if (idx < 0) return;
      const cur = state.worksheet.questions[idx];
      if (cur.type === nextType) return;

      let derivedAnswer = cur.answer || '';
      if (!derivedAnswer && cur.type === 'mcq' && Array.isArray(cur.options)) {
        const corr = cur.options.find(o => o.isCorrect) || cur.options[0];
        derivedAnswer = corr ? corr.text : '';
      } else if (!derivedAnswer && cur.type === 'tf') {
        derivedAnswer = cur.isTrue ? 'True' : 'False';
      }

      const wasNonScored = cur.type === 'section' || cur.type === 'passage' || cur.type === 'checklist';
      const nextNonScored = nextType === 'section' || nextType === 'passage' || nextType === 'checklist';

      const nextRaw = {
        id: cur.id,
        type: nextType,
        text: cur.text || '',
        points: (nextType === 'section' || nextType === 'passage')
          ? 0
          : (wasNonScored && !nextNonScored ? 1 : (cur.points ?? 1)),
        imageId: cur.imageId || '',
        imageSize: cur.imageSize || 'md'
      };

      if (nextType === 'mcq') {
        nextRaw.optColumns = cur.optColumns || 'auto';
        if (Array.isArray(cur.options) && cur.options.length > 0) {
          nextRaw.options = cur.options;
        } else {
          nextRaw.options = [
            { id: generateId(), text: derivedAnswer || 'Option A', isCorrect: true, imageId: '' },
            { id: generateId(), text: 'Option B', isCorrect: false, imageId: '' }
          ];
        }
      } else if (nextType === 'fib') {
        nextRaw.text = cur.text || 'Complete the sentence: ___ .';
        nextRaw.answer = derivedAnswer;
      } else if (nextType === 'sa') {
        nextRaw.lines = cur.lines || 2;
        nextRaw.answer = derivedAnswer;
      } else if (nextType === 'tf') {
        nextRaw.tfStyle = cur.tfStyle || 'tf';
        nextRaw.requireCorrection = Boolean(cur.requireCorrection);
        nextRaw.isTrue = typeof cur.isTrue === 'boolean'
          ? cur.isTrue
          : String(derivedAnswer).trim().toLowerCase() !== 'false';
      } else if (nextType === 'matching') {
        nextRaw.matchStyle = cur.matchStyle || 'letters';
        if (Array.isArray(cur.pairs) && cur.pairs.length > 0) {
          nextRaw.pairs = cur.pairs;
        } else if (Array.isArray(cur.options) && cur.options.length >= 2) {
          nextRaw.pairs = cur.options.slice(0, 4).map(o => ({
            id: generateId(),
            left: o.text || '',
            right: '',
            leftImageId: o.imageId || '',
            rightImageId: ''
          }));
        } else {
          nextRaw.pairs = [
            { id: generateId(), left: cur.text || '', right: derivedAnswer || '', leftImageId: '', rightImageId: '' },
            { id: generateId(), left: '', right: '', leftImageId: '', rightImageId: '' }
          ];
        }
      } else if (nextType === 'essay') {
        nextRaw.lines = cur.lines || 5;
        nextRaw.lineStyle = cur.lineStyle || 'ruled';
        nextRaw.answer = derivedAnswer;
      } else if (nextType === 'section') {
        nextRaw.text = cur.text || 'PART A: Core Practice';
        nextRaw.subtitle = cur.subtitle || '';
      } else if (nextType === 'passage') {
        nextRaw.title = cur.title || 'Reading Passage';
        nextRaw.boxStyle = cur.boxStyle || 'card';
        nextRaw.showLineNumbers = Boolean(cur.showLineNumbers);
        nextRaw.text = cur.text || 'Write or paste a reading text, grammar note, or dialogue here.';
      } else if (nextType === 'unscramble') {
        nextRaw.text = cur.text || 'Unscramble each word or sentence:';
        if (Array.isArray(cur.items) && cur.items.length > 0) {
          nextRaw.items = cur.items.map(it => ({
            id: generateId(),
            answer: it.answer || it.text || '',
            scrambled: it.scrambled || scrambleText(it.answer || it.text || ''),
            hint: it.hint || ''
          }));
        } else if (derivedAnswer) {
          nextRaw.items = [{ id: generateId(), scrambled: scrambleText(derivedAnswer), answer: derivedAnswer, hint: '' }];
        } else {
          nextRaw.items = [{ id: generateId(), scrambled: scrambleText('book'), answer: 'book', hint: 'you read it' }];
        }
      } else if (nextType === 'sort') {
        nextRaw.text = cur.text || 'Sort the words into the correct categories:';
        nextRaw.categories = Array.isArray(cur.categories) && cur.categories.length >= 2
          ? cur.categories
          : [
              { id: generateId(), title: 'Category 1', items: '' },
              { id: generateId(), title: 'Category 2', items: '' }
            ];
      } else if (nextType === 'drawing') {
        nextRaw.text = cur.text || 'Draw and label in the space below:';
        nextRaw.boxHeight = cur.boxHeight || 'md';
        nextRaw.boxStyle = cur.boxStyle || 'blank';
        nextRaw.captionLines = cur.captionLines ?? 2;
        nextRaw.answer = derivedAnswer;
      } else if (nextType === 'checklist') {
        nextRaw.text = cur.text || 'Self-Check before handing in your paper:';
        nextRaw.checkStyle = cur.checkStyle || 'box';
        if (Array.isArray(cur.items) && cur.items.length > 0) {
          nextRaw.items = cur.items.map(it => ({ id: generateId(), text: it.text || it.answer || '' }));
        } else {
          nextRaw.items = [
            { id: generateId(), text: 'I wrote my name and date clearly.' },
            { id: generateId(), text: 'I checked spelling and punctuation.' }
          ];
        }
      }

      const usedIds = collectAllUsedIds();
      usedIds.delete(cur.id);
      state.worksheet.questions[idx] = normalizeQuestion(nextRaw, { forceNewIds: false, usedIds });
      saveState();
      render();
    }

    function autoScrambleQuestion(id) {
      const q = state.worksheet.questions.find(x => x.id === id);
      if (!q || q.type !== 'unscramble' || !Array.isArray(q.items)) return;
      q.items.forEach(it => {
        if (it.answer && String(it.answer).trim()) {
          it.scrambled = scrambleText(it.answer);
        }
      });
      saveState();
      render();
    }

    function moveQuestion(id, dir) {
      const idx = state.worksheet.questions.findIndex(q => q.id === id);
      const qList = state.worksheet.questions;
      if (dir === 'up' && idx > 0) {
        [qList[idx - 1], qList[idx]] = [qList[idx], qList[idx - 1]];
        saveState();
        render();
      } else if (dir === 'down' && idx < qList.length - 1) {
        [qList[idx + 1], qList[idx]] = [qList[idx], qList[idx + 1]];
        saveState();
        render();
      }
    }

    async function exportWorksheetJSON() {
      const embeddedImages = {};
      const qs = state.worksheet.questions || [];
      const collectId = async (imgId) => {
        const clean = sanitizeImageRef(imgId);
        if (!clean || embeddedImages[clean]) return;
        if (/^data:image\//i.test(clean)) {
          embeddedImages[clean] = clean;
          return;
        }
        if (!/^https?:/i.test(clean)) {
          const dataUrl = wsImageCache.get(clean) || await loadWsImageFromDB(clean);
          if (dataUrl) embeddedImages[clean] = dataUrl;
        }
      };

      for (const q of qs) {
        await collectId(q.imageId);
        if (Array.isArray(q.options)) {
          for (const opt of q.options) await collectId(opt.imageId);
        }
        if (Array.isArray(q.pairs)) {
          for (const pair of q.pairs) {
            await collectId(pair.leftImageId);
            await collectId(pair.rightImageId);
          }
        }
      }

      const payload = {
        format: 'klasskit-worksheet',
        version: 2,
        exportedAt: new Date().toISOString(),
        name: activeSetName || state.worksheet.title || 'Worksheet',
        worksheet: state.worksheet,
        embeddedImages
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (state.worksheet.title || 'worksheet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'worksheet';
      a.href = url;
      a.download = `${slug}.worksheet.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    async function handleImportJsonFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (parsed && typeof parsed === 'object' && parsed.embeddedImages && typeof parsed.embeddedImages === 'object') {
          for (const [imgId, dataUrl] of Object.entries(parsed.embeddedImages)) {
            if (imgId && typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl)) {
              await saveWsImageToDB(imgId, dataUrl);
            }
          }
        }

        const candidate = (parsed && parsed.stateData) ? parsed.stateData : parsed;
        const normalized = normalizeWorksheetState(candidate, { forceNewIds: true });
        if (!normalized.worksheet || normalized.worksheet.questions.length === 0) {
          const confirmEmpty = await showConfirmModal(
            'No questions were found inside this JSON file. Load its title and instructions anyway?',
            { title: 'Empty Worksheet JSON', confirmText: 'Load Anyway', cancelText: 'Cancel', icon: 'alert-circle', iconColor: 'orange' }
          );
          if (!confirmEmpty) return;
        }

        activeSetId = null;
        activeSetName = null;
        loadedPresetId = null;
        state.viewMode = 'edit';
        state.showAnswers = false;
        state.worksheet = normalized.worksheet;

        await migrateInlineImagesToDB(state.worksheet);
        await hydrateWorksheetImages();
        saveState();
        render();

        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = parsed.name || state.worksheet.title || '';
      } catch (err) {
        console.error('[WorksheetImportJSON] Failed:', err);
        alert('Could not read that JSON file. Please make sure it is a valid Worksheet Maker JSON export.');
      }
    }


    function render(scrollToBottom = false) {
      const prevSidebarScroll = document.getElementById('sidebar-scroll-body')?.scrollTop || 0;
      const prevRightSidebarScroll = document.getElementById('right-sidebar-scroll-body')?.scrollTop || 0;
      const prevAreaScroll = document.getElementById('previewArea')?.scrollTop || 0;
      const prevSetsScroll = document.getElementById('sets-list')?.scrollTop || 0;

      document.getElementById('app').innerHTML = `${getSidebarHTML()}${getWorkspaceHTML()}${getRightSidebarHTML()}`;
      lucide.createIcons();

      renderLibrary();
      updateActiveIndicator();
      renderPaginatedWorksheetPreview();

      const sidebarScrollEl = document.getElementById('sidebar-scroll-body');
      const rightSidebarScrollEl = document.getElementById('right-sidebar-scroll-body');
      const areaEl = document.getElementById('previewArea');
      const setsEl = document.getElementById('sets-list');
      if (sidebarScrollEl) sidebarScrollEl.scrollTop = prevSidebarScroll;
      if (rightSidebarScrollEl) rightSidebarScrollEl.scrollTop = prevRightSidebarScroll;
      if (setsEl) setsEl.scrollTop = prevSetsScroll;

      if (scrollToBottom && areaEl) {
        setTimeout(() => {
          areaEl.scrollTo({ top: areaEl.scrollHeight, behavior: 'smooth' });
        }, 40);
      } else if (areaEl) {
        areaEl.scrollTop = prevAreaScroll;
      }
    }

    // --- Global Event Delegation (Non-rendering updates) ---
    // Handle typing events without re-rendering to prevent losing focus
    document.addEventListener('input', (e) => {
      const el = e.target;
      const action = el.dataset.action;
      if (!action) return;

      if (action === 'update-ws-title') {
        state.worksheet.title = el.value;
        document.querySelectorAll('[data-action="update-ws-title"]').forEach(other => {
          if (other !== el) other.value = el.value;
        });
      }
      if (action === 'update-ws-inst') {
        state.worksheet.instructions = el.value;
        document.querySelectorAll('[data-action="update-ws-inst"]').forEach(other => {
          if (other !== el) other.value = el.value;
        });
      }
      if (action === 'update-ws-setting' && el.dataset.setting === 'footerText') {
        getWorksheetSettings().footerText = el.value;
      }

      const qid = el.dataset.qid;
      if (qid) {
        const q = state.worksheet.questions.find(q => q.id === qid);
        if (q) {
          if (action === 'update-q-text') q.text = el.value;
          if (action === 'update-q-pts') q.points = Math.max(0, parseInt(el.value, 10) || 0);
          if (action === 'update-q-ans') q.answer = el.value;
          if (action === 'update-q-lines') q.lines = Math.max(1, parseInt(el.value, 10) || 1);

          if (action === 'update-q-field') {
            const field = el.dataset.field;
            if (field === 'subtitle' || field === 'title') q[field] = el.value;
          }

          if (action === 'update-mcq-text' && Array.isArray(q.options)) {
            const opt = q.options.find(o => o.id === el.dataset.optid);
            if (opt) opt.text = el.value;
          }
          if (action === 'update-match-left' && Array.isArray(q.pairs)) {
            const pair = q.pairs.find(p => p.id === el.dataset.pairid);
            if (pair) pair.left = el.value;
          }
          if (action === 'update-match-right' && Array.isArray(q.pairs)) {
            const pair = q.pairs.find(p => p.id === el.dataset.pairid);
            if (pair) pair.right = el.value;
          }
          if (action === 'update-unscramble-field' && Array.isArray(q.items)) {
            const field = el.dataset.field;
            const item = q.items.find(it => it.id === el.dataset.itemid);
            if (item && ['scrambled', 'answer', 'hint'].includes(field)) item[field] = el.value;
          }
          if (action === 'update-sort-field' && Array.isArray(q.categories)) {
            const field = el.dataset.field;
            const cat = q.categories.find(c => c.id === el.dataset.catid);
            if (cat && (field === 'title' || field === 'items')) cat[field] = el.value;
          }
          if (action === 'update-checklist-item' && Array.isArray(q.items)) {
            const item = q.items.find(it => it.id === el.dataset.itemid);
            if (item) item.text = el.value;
          }
        }
      }
      refreshLivePreview();
      saveState();
    });

    // Handle structural UI updates (checkboxes, radios, selects)
    document.addEventListener('change', (e) => {
      const el = e.target;
      const action = el.dataset.action;
      if (!action) return;

      const qid = el.dataset.qid;
      const q = qid ? state.worksheet.questions.find(q => q.id === qid) : null;

      if (action === 'change-q-type' && qid) {
        changeQuestionType(qid, el.value);
        return;
      }
      if (action === 'update-ws-setting') {
        const key = el.dataset.setting;
        const settings = getWorksheetSettings();
        if (key === 'fontSize' && ['sm', 'md', 'lg'].includes(el.value)) {
          settings.fontSize = el.value;
        } else if (key === 'fontFamily' && ['sans', 'serif', 'rounded', 'mono'].includes(el.value)) {
          settings.fontFamily = el.value;
        } else if (key === 'headerStyle' && ['standard', 'boxed', 'compact', 'banner'].includes(el.value)) {
          settings.headerStyle = el.value;
        } else if (key === 'pageBorder' && ['none', 'simple', 'double', 'dashed', 'neo'].includes(el.value)) {
          settings.pageBorder = el.value;
        } else if (['showHeaderFields', 'showTotalScore', 'showPoints', 'showWordBank'].includes(key)) {
          settings[key] = Boolean(el.checked);
        } else if (key === 'showFooter') {
          settings.showFooter = Boolean(el.checked);
          saveState();
          render();
          return;
        }
        refreshLivePreview();
        saveState();
        return;
      }
      if (action === 'update-q-field' && q) {
        const field = el.dataset.field;
        if (field === 'optColumns' && ['auto', '1', '2', '4'].includes(el.value)) {
          q.optColumns = el.value;
        } else if (field === 'lines') {
          q.lines = Math.max(1, Math.min(20, parseInt(el.value, 10) || 2));
        } else if (field === 'tfStyle' && ['tf', 'yn', 'ci'].includes(el.value)) {
          q.tfStyle = el.value;
          saveState();
          render();
          return;
        } else if (field === 'requireCorrection') {
          q.requireCorrection = Boolean(el.checked);
        } else if (field === 'matchStyle' && ['letters', 'lines'].includes(el.value)) {
          q.matchStyle = el.value;
        } else if (field === 'lineStyle' && ['ruled', 'primary', 'box', 'grid'].includes(el.value)) {
          q.lineStyle = el.value;
        } else if (field === 'boxStyle') {
          if (q.type === 'passage' && ['card', 'plain', 'grammar', 'dialogue'].includes(el.value)) q.boxStyle = el.value;
          if (q.type === 'drawing' && ['blank', 'dots', 'grid', 'split'].includes(el.value)) q.boxStyle = el.value;
        } else if (field === 'showLineNumbers') {
          q.showLineNumbers = Boolean(el.checked);
        } else if (field === 'boxHeight' && ['sm', 'md', 'lg'].includes(el.value)) {
          q.boxHeight = el.value;
        } else if (field === 'captionLines') {
          q.captionLines = Math.max(0, Math.min(6, parseInt(el.value, 10) || 0));
        } else if (field === 'checkStyle' && ['box', 'yn', 'stars', 'faces'].includes(el.value)) {
          q.checkStyle = el.value;
        }
        refreshLivePreview();
        saveState();
        return;
      }
      if (action === 'set-mcq-correct' && q) {
        q.options.forEach(o => o.isCorrect = (o.id === el.dataset.optid));
        refreshLivePreview();
      }
      if (action === 'set-tf' && q) {
        q.isTrue = el.dataset.val === 'true';
        refreshLivePreview();
      }
      if (action === 'toggle-answers') {
        state.showAnswers = el.checked;
        render();
      }
      saveState();
    });

    document.getElementById('ws-hidden-json-input')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) await handleImportJsonFile(file);
    });

    // Handle clicks that cause structural DOM changes
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      
      const action = btn.dataset.action;
      const qid = btn.dataset.qid;
      
      switch (action) {
        case 'set-ws-look': {
          const key = btn.dataset.setting;
          const val = btn.dataset.val;
          const settings = getWorksheetSettings();
          if (key === 'theme' && WS_LOOK_THEMES[val]) {
            settings.theme = val;
          } else if (key === 'accentColor' && WS_ACCENTS[val]) {
            settings.accentColor = val;
          } else if (key === 'questionColumns') {
            settings.questionColumns = (val === '2') ? 2 : 1;
          }
          saveState();
          render();
          break;
        }
        case 'auto-scramble-items':
          autoScrambleQuestion(qid);
          break;
        case 'add-unscramble-item': {
          const qUns = state.worksheet.questions.find(q => q.id === qid);
          if (qUns) {
            if (!Array.isArray(qUns.items)) qUns.items = [];
            qUns.items.push({ id: generateId(), scrambled: '', answer: '', hint: '' });
            saveState();
            render();
          }
          break;
        }
        case 'delete-unscramble-item': {
          const qUns = state.worksheet.questions.find(q => q.id === qid);
          if (qUns && Array.isArray(qUns.items)) {
            qUns.items = qUns.items.filter(it => it.id !== btn.dataset.itemid);
            saveState();
            render();
          }
          break;
        }
        case 'add-sort-cat': {
          const qSort = state.worksheet.questions.find(q => q.id === qid);
          if (qSort) {
            if (!Array.isArray(qSort.categories)) qSort.categories = [];
            qSort.categories.push({ id: generateId(), title: `Category ${qSort.categories.length + 1}`, items: '' });
            saveState();
            render();
          }
          break;
        }
        case 'delete-sort-cat': {
          const qSort = state.worksheet.questions.find(q => q.id === qid);
          if (qSort && Array.isArray(qSort.categories)) {
            qSort.categories = qSort.categories.filter(c => c.id !== btn.dataset.catid);
            saveState();
            render();
          }
          break;
        }
        case 'add-checklist-item': {
          const qChk = state.worksheet.questions.find(q => q.id === qid);
          if (qChk) {
            if (!Array.isArray(qChk.items)) qChk.items = [];
            qChk.items.push({ id: generateId(), text: '' });
            saveState();
            render();
          }
          break;
        }
        case 'delete-checklist-item': {
          const qChk = state.worksheet.questions.find(q => q.id === qid);
          if (qChk && Array.isArray(qChk.items)) {
            qChk.items = qChk.items.filter(it => it.id !== btn.dataset.itemid);
            saveState();
            render();
          }
          break;
        }
        case 'add-question':
          addQuestion(btn.dataset.type);
          break;
        case 'duplicate-question':
          duplicateQuestion(qid);
          break;
        case 'delete-question':
          (async () => {
            const confirmed = await showConfirmModal("Delete this question?", {
              title: "Delete Question?",
              confirmText: "Delete",
              cancelText: "Keep",
              icon: "trash-2",
              iconColor: "red"
            });
            if (confirmed) {
              state.worksheet.questions = state.worksheet.questions.filter(q => q.id !== qid);
              saveState();
              render();
            }
          })();
          break;
        case 'move-up':
          moveQuestion(qid, 'up');
          break;
        case 'move-down':
          moveQuestion(qid, 'down');
          break;
        case 'export-json':
          exportWorksheetJSON();
          break;
        case 'import-json':
          document.getElementById('ws-hidden-json-input')?.click();
          break;
        case 'add-mcq-opt': {
          const qMcq = state.worksheet.questions.find(q => q.id === qid);
          if (qMcq) {
            qMcq.options.push({ id: generateId(), text: '', isCorrect: false, imageId: '' });
            saveState();
            render();
          }
          break;
        }
        case 'delete-mcq-opt': {
          const qDelOpt = state.worksheet.questions.find(q => q.id === qid);
          if (qDelOpt) {
            qDelOpt.options = qDelOpt.options.filter(o => o.id !== btn.dataset.optid);
            saveState();
            render();
          }
          break;
        }
        case 'add-match-pair': {
          const qMatch = state.worksheet.questions.find(q => q.id === qid);
          if (qMatch) {
            qMatch.pairs.push({ id: generateId(), left: '', right: '', leftImageId: '', rightImageId: '' });
            saveState();
            render();
          }
          break;
        }
        case 'delete-match-pair': {
          const qDelPair = state.worksheet.questions.find(q => q.id === qid);
          if (qDelPair) {
            qDelPair.pairs = qDelPair.pairs.filter(p => p.id !== btn.dataset.pairid);
            saveState();
            render();
          }
          break;
        }
        case 'upload-q-image': {
          const qTarget = state.worksheet.questions.find(q => q.id === qid);
          if (qTarget) {
            pickWorksheetImage((imgId) => {
              qTarget.imageId = imgId;
              qTarget.imageSize = qTarget.imageSize || 'md';
              saveState();
              render();
            });
          }
          break;
        }
        case 'remove-q-image': {
          const qTarget = state.worksheet.questions.find(q => q.id === qid);
          if (qTarget) {
            qTarget.imageId = '';
            saveState();
            render();
          }
          break;
        }
        case 'set-q-img-size': {
          const qTarget = state.worksheet.questions.find(q => q.id === qid);
          if (qTarget && ['sm', 'md', 'lg'].includes(btn.dataset.size)) {
            qTarget.imageSize = btn.dataset.size;
            saveState();
            render();
          }
          break;
        }
        case 'upload-opt-image': {
          const qMcq = state.worksheet.questions.find(q => q.id === qid);
          const opt = qMcq && qMcq.options.find(o => o.id === btn.dataset.optid);
          if (opt) {
            pickWorksheetImage((imgId) => {
              opt.imageId = imgId;
              saveState();
              render();
            });
          }
          break;
        }
        case 'remove-opt-image': {
          const qMcq = state.worksheet.questions.find(q => q.id === qid);
          const opt = qMcq && qMcq.options.find(o => o.id === btn.dataset.optid);
          if (opt) {
            opt.imageId = '';
            saveState();
            render();
          }
          break;
        }
        case 'upload-match-image': {
          const qMatch = state.worksheet.questions.find(q => q.id === qid);
          const pair = qMatch && qMatch.pairs.find(p => p.id === btn.dataset.pairid);
          const side = btn.dataset.side === 'right' ? 'rightImageId' : 'leftImageId';
          if (pair) {
            pickWorksheetImage((imgId) => {
              pair[side] = imgId;
              saveState();
              render();
            });
          }
          break;
        }
        case 'remove-match-image': {
          const qMatch = state.worksheet.questions.find(q => q.id === qid);
          const pair = qMatch && qMatch.pairs.find(p => p.id === btn.dataset.pairid);
          const side = btn.dataset.side === 'right' ? 'rightImageId' : 'leftImageId';
          if (pair) {
            pair[side] = '';
            saveState();
            render();
          }
          break;
        }
        case 'set-view-mode':
          if (['edit', 'split', 'preview'].includes(btn.dataset.mode)) {
            state.viewMode = btn.dataset.mode;
            saveState();
            render();
            const area = document.getElementById('previewArea');
            if (area) area.scrollTop = 0;
          }
          break;
        case 'set-answer-mode':
          state.showAnswers = btn.dataset.ans === 'true';
          saveState();
          render();
          break;
        case 'toggle-sidebar':
          toggleSidebar();
          break;
        case 'toggle-right-sidebar':
          toggleRightSidebar();
          break;
        case 'set-view-preview':
          state.showAnswers = false;
          state.viewMode = 'preview';
          saveState();
          render();
          break;
        case 'set-view-edit':
          state.viewMode = 'edit';
          saveState();
          render();
          break;
        case 'toggle-theme': {
          const isDark = document.documentElement.classList.toggle('dark');
          localStorage.setItem('theme_worksheet-maker', isDark ? 'dark' : 'light');
          render();
          break;
        }
        case 'open-bulk-import':
          openWorksheetBulkImport();
          break;
        case 'toggle-presets-drawer':
          starterPresetsOpen = !starterPresetsOpen;
          render();
          break;
        case 'filter-presets':
          starterPresetFilter = btn.dataset.level || 'ALL';
          render();
          break;
        case 'load-starter-preset':
          applyStarterPreset(btn.dataset.presetId);
          break;
        case 'print':
          window.print();
          break;
      }
    });

    window.addEventListener('resize', () => {
      if (state.viewMode !== 'edit') applyPreviewZoom();
    });

    window.addEventListener('beforeprint', () => {
      renderPaginatedWorksheetPreview();
      document.querySelectorAll('#print-sheet-container .page-wrapper').forEach((w) => {
        w.style.zoom = '1';
      });
    });

    window.addEventListener('afterprint', () => {
      applyPreviewZoom();
    });

    // --- Init ---
    (async () => {
      if (typeof requireAuth === 'function') {
        await requireAuth();
      }
      await Promise.all([loadState(), fetchStarterPresets()]);
      await hydrateWorksheetImages();
      if (!state.worksheet || !Array.isArray(state.worksheet.questions)) {
        state.worksheet = {
          title: (state.worksheet && state.worksheet.title) || 'Untitled Worksheet',
          instructions: (state.worksheet && state.worksheet.instructions) || 'Please read each question carefully and provide the best possible answer.',
          questions: [],
          settings: { ...DEFAULT_WS_SETTINGS }
        };
      } else {
        state.worksheet.settings = normalizeWorksheetSettings(state.worksheet.settings);
      }
      render();
    })();

    // --- State & Config ---
    const generateId = () => Math.random().toString(36).substr(2, 9);
    
    // Simple HTML escaper to prevent breakage in strings
    const esc = str => (str || '').toString().replace(/[&<>'"]/g, 
      tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag)
    );

    const QUESTION_TYPES = {
      MCQ: { id: 'mcq', label: 'Multiple Choice', icon: 'check-square', group: 'question' },
      FIB: { id: 'fib', label: 'Fill in the Blank', icon: 'type', group: 'question' },
      SA: { id: 'sa', label: 'Short Answer', icon: 'align-left', group: 'question' },
      TF: { id: 'tf', label: 'True / False', icon: 'check-circle', group: 'question' },
      MATCHING: { id: 'matching', label: 'Matching', icon: 'split-square-horizontal', group: 'question' },
      ESSAY: { id: 'essay', label: 'Essay / Writing', icon: 'file-edit', group: 'question' },
      UNSCRAMBLE: { id: 'unscramble', label: 'Unscramble', icon: 'shuffle', group: 'activity' },
      SORT: { id: 'sort', label: 'Word Sort Table', icon: 'table-2', group: 'activity' },
      DRAWING: { id: 'drawing', label: 'Draw & Label', icon: 'pen-tool', group: 'activity' },
      CHECKLIST: { id: 'checklist', label: 'Checklist / Rubric', icon: 'list-checks', group: 'activity' },
      PASSAGE: { id: 'passage', label: 'Reading / Info Box', icon: 'book-open', group: 'layout', nonNumbered: true },
      SECTION: { id: 'section', label: 'Section Header', icon: 'heading', group: 'layout', nonNumbered: true },
    };

    const WS_LOOK_THEMES = {
      classic: { id: 'classic', label: 'Classic', desc: 'Clean school handout' },
      neo: { id: 'neo', label: 'Neo-Brutal', desc: 'Bold comic frames' },
      modern: { id: 'modern', label: 'Modern', desc: 'Sleek accent stripe' },
      kids: { id: 'kids', label: 'Playful', desc: 'Rounded & friendly' },
      notebook: { id: 'notebook', label: 'Notebook', desc: 'Margin & ruled feel' },
      exam: { id: 'exam', label: 'Formal Exam', desc: 'Compact & serif' }
    };

    const WS_ACCENTS = {
      blue: { id: 'blue', label: 'Blue', hex: '#1ea7fd', soft: '#eff6ff', dark: '#0369a1' },
      pink: { id: 'pink', label: 'Pink', hex: '#ff4785', soft: '#fdf2f8', dark: '#be185d' },
      green: { id: 'green', label: 'Green', hex: '#00d063', soft: '#f0fdf4', dark: '#047857' },
      orange: { id: 'orange', label: 'Orange', hex: '#ff7e33', soft: '#fff7ed', dark: '#c2410c' },
      purple: { id: 'purple', label: 'Purple', hex: '#a855f7', soft: '#faf5ff', dark: '#6b21a8' },
      mono: { id: 'mono', label: 'Ink B&W', hex: '#1e293b', soft: '#f8fafc', dark: '#0f172a' }
    };

    const DEFAULT_WS_SETTINGS = {
      theme: 'classic',
      accentColor: 'blue',
      pageBorder: 'none',
      fontFamily: 'sans',
      headerStyle: 'standard',
      questionColumns: 1,
      showHeaderFields: true,
      showTotalScore: true,
      showPoints: true,
      showWordBank: false,
      showFooter: false,
      footerText: 'Check your work carefully!   ☆   ☆   ☆   ☆   ☆',
      fontSize: 'md'
    };

    let state = {
      viewMode: 'edit', // 'edit' | 'preview'
      showAnswers: false,
      updatedAt: 0,
      worksheet: {
        title: 'Untitled Worksheet',
        instructions: 'Please read each question carefully and provide the best possible answer.',
        questions: [],
        settings: { ...DEFAULT_WS_SETTINGS }
      }
    };

    // ── IndexedDB for Worksheet Sets & Images ──────────────────────────────────
    const DB_NAME = 'klasskit_worksheet_db';
    const DB_VERSION = 2;
    const STORE_SETS = 'worksheet_sets';
    const STORE_IMAGES = 'worksheet_images';
    const wsImageCache = new Map();
    let dbInstance = null;
    let dbInitPromise = null;

    function initDB() {
      if (dbInstance) return Promise.resolve(dbInstance);
      if (dbInitPromise) return dbInitPromise;
      dbInitPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const idb = e.target.result;
          if (!idb.objectStoreNames.contains(STORE_SETS)) {
            idb.createObjectStore(STORE_SETS, { keyPath: 'id' });
          }
          if (!idb.objectStoreNames.contains(STORE_IMAGES)) {
            idb.createObjectStore(STORE_IMAGES);
          }
        };
        request.onblocked = () => {
          console.warn('[WorksheetDB] Upgrade blocked by another tab; continuing once unblocked.');
        };
        request.onsuccess = (e) => {
          dbInstance = e.target.result;
          dbInstance.onversionchange = () => {
            if (dbInstance) {
              dbInstance.close();
              dbInstance = null;
              dbInitPromise = null;
            }
          };
          resolve(dbInstance);
        };
        request.onerror = (e) => {
          dbInitPromise = null;
          reject(e.target.error);
        };
      });
      return dbInitPromise;
    }

    async function saveWsImageToDB(id, dataUrl) {
      if (!id || !dataUrl) return;
      wsImageCache.set(id, dataUrl);
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_IMAGES)) return;
        await new Promise((resolve, reject) => {
          const tx = localDb.transaction(STORE_IMAGES, 'readwrite');
          const req = tx.objectStore(STORE_IMAGES).put(dataUrl, id);
          req.onsuccess = () => resolve();
          req.onerror = (e) => reject(e.target.error);
        });
      } catch (err) {
        console.warn('[WorksheetImageDB] save failed:', err);
      }
    }

    async function loadWsImageFromDB(id) {
      if (!id) return null;
      if (wsImageCache.has(id)) return wsImageCache.get(id);
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_IMAGES)) return null;
        const val = await new Promise((resolve, reject) => {
          const tx = localDb.transaction(STORE_IMAGES, 'readonly');
          const req = tx.objectStore(STORE_IMAGES).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = (e) => reject(e.target.error);
        });
        if (val) wsImageCache.set(id, val);
        return val;
      } catch (err) {
        console.warn('[WorksheetImageDB] load failed:', err);
        return null;
      }
    }

    async function deleteWsImageFromDB(id) {
      if (!id) return;
      wsImageCache.delete(id);
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_IMAGES)) return;
        await new Promise((resolve) => {
          const tx = localDb.transaction(STORE_IMAGES, 'readwrite');
          tx.objectStore(STORE_IMAGES).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch (err) {}
    }

    function isStrippedMediaToken(val) {
      return typeof val === 'string' && /^\[STRIPPED_FOR_CLOUD_SECURITY/i.test(val.trim());
    }

    function getWsImageSrc(imageId) {
      if (!imageId) return '';
      const raw = String(imageId).trim();
      if (!raw || isStrippedMediaToken(raw)) return '';
      if (wsImageCache.has(raw)) return wsImageCache.get(raw);
      if (/^(https?:|data:)/i.test(raw)) return raw;
      return '';
    }

    function compressWsImageFile(file, maxDim = 900) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
          reject(new Error('Invalid image file'));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.onload = (ev) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Failed to decode image'));
          img.onload = () => {
            let w = img.naturalWidth || img.width || maxDim;
            let h = img.naturalHeight || img.height || maxDim;
            if (w > maxDim || h > maxDim) {
              const ratio = Math.min(maxDim / w, maxDim / h);
              w = Math.max(1, Math.round(w * ratio));
              h = Math.max(1, Math.round(h * ratio));
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            let out = '';
            try {
              out = canvas.toDataURL('image/webp', 0.88);
              if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
            } catch (e) {
              out = canvas.toDataURL('image/png');
            }
            resolve(out);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async function migrateInlineImagesToDB(worksheet) {
      const qs = (worksheet && Array.isArray(worksheet.questions)) ? worksheet.questions : [];
      let migrated = false;
      const stashIfDataUrl = async (val) => {
        if (typeof val === 'string' && /^data:image\//i.test(val.trim())) {
          const imgId = 'wsimg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          await saveWsImageToDB(imgId, val.trim());
          migrated = true;
          return imgId;
        }
        return null;
      };

      for (const q of qs) {
        if (!q || typeof q !== 'object') continue;
        const nextQImg = await stashIfDataUrl(q.imageId);
        if (nextQImg) q.imageId = nextQImg;

        if (Array.isArray(q.options)) {
          for (const opt of q.options) {
            if (!opt || typeof opt !== 'object') continue;
            const nextOptImg = await stashIfDataUrl(opt.imageId);
            if (nextOptImg) opt.imageId = nextOptImg;
          }
        }
        if (Array.isArray(q.pairs)) {
          for (const pair of q.pairs) {
            if (!pair || typeof pair !== 'object') continue;
            const nextLeftImg = await stashIfDataUrl(pair.leftImageId);
            if (nextLeftImg) pair.leftImageId = nextLeftImg;
            const nextRightImg = await stashIfDataUrl(pair.rightImageId);
            if (nextRightImg) pair.rightImageId = nextRightImg;
          }
        }
      }
      return migrated;
    }

    async function hydrateWorksheetImages() {
      const ids = new Set();
      const qs = (state.worksheet && state.worksheet.questions) || [];
      qs.forEach((q) => {
        if (q && q.imageId && !/^(https?:|data:)/i.test(q.imageId) && !isStrippedMediaToken(q.imageId) && !wsImageCache.has(q.imageId)) {
          ids.add(q.imageId);
        }
        if (Array.isArray(q && q.options)) {
          q.options.forEach((o) => {
            if (o && o.imageId && !/^(https?:|data:)/i.test(o.imageId) && !isStrippedMediaToken(o.imageId) && !wsImageCache.has(o.imageId)) {
              ids.add(o.imageId);
            }
          });
        }
        if (Array.isArray(q && q.pairs)) {
          q.pairs.forEach((p) => {
            if (p && p.leftImageId && !/^(https?:|data:)/i.test(p.leftImageId) && !isStrippedMediaToken(p.leftImageId) && !wsImageCache.has(p.leftImageId)) {
              ids.add(p.leftImageId);
            }
            if (p && p.rightImageId && !/^(https?:|data:)/i.test(p.rightImageId) && !isStrippedMediaToken(p.rightImageId) && !wsImageCache.has(p.rightImageId)) {
              ids.add(p.rightImageId);
            }
          });
        }
      });
      if (ids.size === 0) return false;
      await Promise.all(Array.from(ids).map((id) => loadWsImageFromDB(id)));
      return true;
    }

    let pendingWsImageHandler = null;
    function pickWorksheetImage(onImageSaved) {
      pendingWsImageHandler = onImageSaved;
      const inp = document.getElementById('ws-hidden-image-input');
      if (inp) inp.click();
    }

    document.getElementById('ws-hidden-image-input')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      const handler = pendingWsImageHandler;
      pendingWsImageHandler = null;
      if (!file || !handler) return;
      try {
        const dataUrl = await compressWsImageFile(file, 900);
        const imgId = 'wsimg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await saveWsImageToDB(imgId, dataUrl);
        handler(imgId);
      } catch (err) {
        console.warn('[WorksheetImage] Upload failed:', err);
        alert('Could not process that image file.');
      }
    });

    // ── Backwards-Compatible Question & State Normalization ───────────────────
    const LEGACY_TYPE_ALIASES = {
      mcq: 'mcq',
      'multiple-choice': 'mcq',
      multiple_choice: 'mcq',
      mc: 'mcq',
      choice: 'mcq',
      fib: 'fib',
      fill: 'fib',
      'fill-in-the-blank': 'fib',
      fill_in_the_blank: 'fib',
      blank: 'fib',
      blanks: 'fib',
      cloze: 'fib',
      sa: 'sa',
      short: 'sa',
      'short-answer': 'sa',
      short_answer: 'sa',
      open: 'sa',
      text: 'sa',
      tf: 'tf',
      truefalse: 'tf',
      'true/false': 'tf',
      'true-false': 'tf',
      true_false: 'tf',
      boolean: 'tf',
      bool: 'tf',
      matching: 'matching',
      match: 'matching',
      pairs: 'matching',
      essay: 'essay',
      long: 'essay',
      'long-answer': 'essay',
      long_answer: 'essay',
      paragraph: 'essay',
      unscramble: 'unscramble',
      jumble: 'unscramble',
      scramble: 'unscramble',
      sort: 'sort',
      wordsort: 'sort',
      'word-sort': 'sort',
      categorize: 'sort',
      table: 'sort',
      drawing: 'drawing',
      draw: 'drawing',
      diagram: 'drawing',
      sketch: 'drawing',
      checklist: 'checklist',
      rubric: 'checklist',
      selfcheck: 'checklist',
      passage: 'passage',
      reading: 'passage',
      infobox: 'passage',
      info: 'passage',
      section: 'section',
      header: 'section',
      divider: 'section'
    };

    function sanitizeImageRef(val) {
      if (typeof val !== 'string') return '';
      const trimmed = val.trim();
      return (!trimmed || isStrippedMediaToken(trimmed)) ? '' : trimmed;
    }

    function claimUniqueId(candidate, usedIds, forceNew = false) {
      let id = (!forceNew && candidate !== undefined && candidate !== null && String(candidate).trim())
        ? String(candidate).trim()
        : generateId();
      while (usedIds.has(id)) {
        id = generateId();
      }
      usedIds.add(id);
      return id;
    }

    function inferQuestionType(raw) {
      if (!raw || typeof raw !== 'object') return 'sa';
      const rawType = String(raw.type || '').trim().toLowerCase();
      if (LEGACY_TYPE_ALIASES[rawType]) return LEGACY_TYPE_ALIASES[rawType];
      if (Array.isArray(raw.categories)) return 'sort';
      if (Array.isArray(raw.pairs) || Array.isArray(raw.matches)) return 'matching';
      if (Array.isArray(raw.options) || Array.isArray(raw.choices)) return 'mcq';
      if (typeof raw.isTrue === 'boolean' || typeof raw.isTrue === 'string') return 'tf';
      if (raw.lines !== undefined || raw.lineCount !== undefined || raw.rubric !== undefined) return 'essay';
      const txt = String(raw.text ?? raw.question ?? raw.prompt ?? '');
      if (/_{3,}|\[blank\]/i.test(txt)) return 'fib';
      return 'sa';
    }

    function normalizeQuestion(raw, { forceNewIds = false, usedIds = new Set() } = {}) {
      const src = (raw && typeof raw === 'object') ? raw : {};
      const type = inferQuestionType(src);
      const isNonScored = type === 'section' || type === 'passage';
      const rawPts = src.points ?? src.score ?? src.marks;
      const parsedPts = Number(rawPts);
      const points = (rawPts !== '' && rawPts !== null && rawPts !== undefined && Number.isFinite(parsedPts))
        ? Math.max(0, parsedPts)
        : (isNonScored ? 0 : 1);

      const base = {
        id: claimUniqueId(src.id, usedIds, forceNewIds),
        type,
        text: String(src.text ?? src.question ?? src.prompt ?? ''),
        points,
        imageId: sanitizeImageRef(src.imageId || src.image || src.imageUrl || src.img || ''),
        imageSize: ['sm', 'md', 'lg'].includes(src.imageSize) ? src.imageSize : 'md'
      };

      if (type === 'mcq') {
        const rawOpts = Array.isArray(src.options)
          ? src.options
          : (Array.isArray(src.choices) ? src.choices : []);
        const opts = rawOpts.map((o, idx) => {
          if (typeof o === 'string' || typeof o === 'number') {
            const optText = String(o);
            const matchByVal = src.correctAnswer !== undefined && optText === String(src.correctAnswer);
            const matchByAns = src.answer !== undefined && optText === String(src.answer);
            const matchByIdx = typeof src.correctIndex === 'number' && src.correctIndex === idx;
            return {
              id: claimUniqueId(null, usedIds, true),
              text: optText,
              isCorrect: Boolean(matchByVal || matchByAns || matchByIdx),
              imageId: ''
            };
          }
          const optObj = (o && typeof o === 'object') ? o : {};
          const optText = String(optObj.text ?? optObj.label ?? optObj.value ?? '');
          const matchByVal = src.correctAnswer !== undefined && optText !== '' && optText === String(src.correctAnswer);
          const matchByAns = src.answer !== undefined && optText !== '' && optText === String(src.answer);
          const matchByIdx = typeof src.correctIndex === 'number' && src.correctIndex === idx;
          return {
            id: claimUniqueId(optObj.id, usedIds, forceNewIds),
            text: optText,
            isCorrect: Boolean(optObj.isCorrect ?? optObj.correct ?? (matchByVal || matchByAns || matchByIdx)),
            imageId: sanitizeImageRef(optObj.imageId || optObj.image || optObj.imageUrl || optObj.img || '')
          };
        });

        while (opts.length < 2) {
          opts.push({
            id: claimUniqueId(null, usedIds, true),
            text: opts.length === 0 ? 'Option A' : 'Option B',
            isCorrect: false,
            imageId: ''
          });
        }
        if (!opts.some(o => o.isCorrect)) {
          opts[0].isCorrect = true;
        }
        return {
          ...base,
          optColumns: ['auto', '1', '2', '4'].includes(String(src.optColumns || '')) ? String(src.optColumns) : 'auto',
          options: opts
        };
      }

      if (type === 'fib') {
        return {
          ...base,
          answer: String(src.answer ?? src.correctAnswer ?? src.expectedAnswer ?? '')
        };
      }

      if (type === 'sa') {
        const rawLines = parseInt(src.lines ?? src.lineCount, 10);
        return {
          ...base,
          lines: Number.isFinite(rawLines) && rawLines >= 1 ? Math.min(10, rawLines) : 2,
          answer: String(src.answer ?? src.correctAnswer ?? src.expectedAnswer ?? '')
        };
      }

      if (type === 'tf') {
        let isTrue = true;
        const rawBool = src.isTrue ?? src.correct ?? src.answer;
        if (typeof rawBool === 'boolean') {
          isTrue = rawBool;
        } else if (typeof rawBool === 'string') {
          isTrue = rawBool.trim().toLowerCase() !== 'false';
        }
        return {
          ...base,
          isTrue,
          tfStyle: ['tf', 'yn', 'ci'].includes(src.tfStyle) ? src.tfStyle : 'tf',
          requireCorrection: Boolean(src.requireCorrection)
        };
      }

      if (type === 'matching') {
        const rawPairs = Array.isArray(src.pairs)
          ? src.pairs
          : (Array.isArray(src.items) ? src.items : (Array.isArray(src.matches) ? src.matches : []));
        const pairs = rawPairs.map((p) => {
          if (Array.isArray(p)) {
            return {
              id: claimUniqueId(null, usedIds, true),
              left: String(p[0] ?? ''),
              right: String(p[1] ?? ''),
              leftImageId: '',
              rightImageId: ''
            };
          }
          const pairObj = (p && typeof p === 'object') ? p : {};
          return {
            id: claimUniqueId(pairObj.id, usedIds, forceNewIds),
            left: String(pairObj.left ?? pairObj.term ?? pairObj.prompt ?? pairObj.a ?? ''),
            right: String(pairObj.right ?? pairObj.definition ?? pairObj.match ?? pairObj.b ?? ''),
            leftImageId: sanitizeImageRef(pairObj.leftImageId || pairObj.leftImage || pairObj.leftImageUrl || ''),
            rightImageId: sanitizeImageRef(pairObj.rightImageId || pairObj.rightImage || pairObj.rightImageUrl || '')
          };
        });
        while (pairs.length < 2) {
          pairs.push({ id: claimUniqueId(null, usedIds, true), left: '', right: '', leftImageId: '', rightImageId: '' });
        }
        return {
          ...base,
          matchStyle: ['letters', 'lines'].includes(src.matchStyle) ? src.matchStyle : 'letters',
          pairs
        };
      }

      if (type === 'essay') {
        const rawLines = parseInt(src.lines ?? src.lineCount, 10);
        return {
          ...base,
          lines: Number.isFinite(rawLines) && rawLines >= 1 ? rawLines : 5,
          lineStyle: ['ruled', 'primary', 'box', 'grid'].includes(src.lineStyle) ? src.lineStyle : 'ruled',
          answer: String(src.answer ?? src.rubric ?? src.expectedAnswer ?? '')
        };
      }

      if (type === 'section') {
        return {
          ...base,
          points: 0,
          text: base.text || 'PART A: Core Practice',
          subtitle: String(src.subtitle ?? '')
        };
      }

      if (type === 'passage') {
        return {
          ...base,
          points: 0,
          title: String(src.title ?? 'Reading Passage'),
          boxStyle: ['card', 'plain', 'grammar', 'dialogue'].includes(src.boxStyle) ? src.boxStyle : 'card',
          showLineNumbers: Boolean(src.showLineNumbers)
        };
      }

      if (type === 'unscramble') {
        const rawItems = Array.isArray(src.items) ? src.items : [];
        const items = rawItems.map((it) => {
          if (typeof it === 'string') {
            return { id: claimUniqueId(null, usedIds, true), scrambled: scrambleText(it), answer: it, hint: '' };
          }
          const itemObj = (it && typeof it === 'object') ? it : {};
          const ans = String(itemObj.answer ?? '');
          const scr = String(itemObj.scrambled ?? '') || (ans ? scrambleText(ans) : '');
          return {
            id: claimUniqueId(itemObj.id, usedIds, forceNewIds),
            scrambled: scr,
            answer: ans,
            hint: String(itemObj.hint ?? '')
          };
        });
        if (items.length === 0) {
          items.push({ id: claimUniqueId(null, usedIds, true), scrambled: 'lpaep', answer: 'apple', hint: 'a fruit' });
        }
        return { ...base, items };
      }

      if (type === 'sort') {
        const rawCats = Array.isArray(src.categories) ? src.categories : [];
        const categories = rawCats.map((c, idx) => {
          const catObj = (c && typeof c === 'object') ? c : {};
          const itemsStr = Array.isArray(catObj.items) ? catObj.items.join(', ') : String(catObj.items ?? '');
          return {
            id: claimUniqueId(catObj.id, usedIds, forceNewIds),
            title: String(catObj.title ?? `Category ${idx + 1}`),
            items: itemsStr
          };
        });
        while (categories.length < 2) {
          categories.push({
            id: claimUniqueId(null, usedIds, true),
            title: `Category ${categories.length + 1}`,
            items: ''
          });
        }
        return { ...base, categories };
      }

      if (type === 'drawing') {
        const rawCap = parseInt(src.captionLines, 10);
        return {
          ...base,
          boxHeight: ['sm', 'md', 'lg'].includes(src.boxHeight) ? src.boxHeight : 'md',
          boxStyle: ['blank', 'dots', 'grid', 'split'].includes(src.boxStyle) ? src.boxStyle : 'blank',
          captionLines: Number.isFinite(rawCap) ? Math.max(0, Math.min(6, rawCap)) : 0,
          answer: String(src.answer ?? '')
        };
      }

      if (type === 'checklist') {
        const rawItems = Array.isArray(src.items) ? src.items : [];
        const items = rawItems.map((it) => {
          if (typeof it === 'string') {
            return { id: claimUniqueId(null, usedIds, true), text: it };
          }
          const itemObj = (it && typeof it === 'object') ? it : {};
          return { id: claimUniqueId(itemObj.id, usedIds, forceNewIds), text: String(itemObj.text ?? '') };
        });
        if (items.length === 0) {
          items.push({ id: claimUniqueId(null, usedIds, true), text: 'I wrote my name and date.' });
        }
        return {
          ...base,
          points: rawPts !== undefined ? points : 0,
          checkStyle: ['box', 'yn', 'stars', 'faces'].includes(src.checkStyle) ? src.checkStyle : 'box',
          items
        };
      }

      return base;
    }

    function normalizeWorksheetSettings(rawSettings) {
      const s = (rawSettings && typeof rawSettings === 'object') ? rawSettings : {};
      return {
        theme: WS_LOOK_THEMES[s.theme] ? s.theme : DEFAULT_WS_SETTINGS.theme,
        accentColor: WS_ACCENTS[s.accentColor] ? s.accentColor : DEFAULT_WS_SETTINGS.accentColor,
        pageBorder: ['none', 'simple', 'double', 'dashed', 'neo'].includes(s.pageBorder) ? s.pageBorder : DEFAULT_WS_SETTINGS.pageBorder,
        fontFamily: ['sans', 'serif', 'rounded', 'mono'].includes(s.fontFamily) ? s.fontFamily : DEFAULT_WS_SETTINGS.fontFamily,
        headerStyle: ['standard', 'boxed', 'compact', 'banner'].includes(s.headerStyle) ? s.headerStyle : DEFAULT_WS_SETTINGS.headerStyle,
        questionColumns: (s.questionColumns === 2 || s.questionColumns === '2') ? 2 : 1,
        showHeaderFields: typeof s.showHeaderFields === 'boolean' ? s.showHeaderFields : DEFAULT_WS_SETTINGS.showHeaderFields,
        showTotalScore: typeof s.showTotalScore === 'boolean' ? s.showTotalScore : DEFAULT_WS_SETTINGS.showTotalScore,
        showPoints: typeof s.showPoints === 'boolean' ? s.showPoints : DEFAULT_WS_SETTINGS.showPoints,
        showWordBank: typeof s.showWordBank === 'boolean' ? s.showWordBank : DEFAULT_WS_SETTINGS.showWordBank,
        showFooter: typeof s.showFooter === 'boolean' ? s.showFooter : DEFAULT_WS_SETTINGS.showFooter,
        footerText: typeof s.footerText === 'string' ? s.footerText : DEFAULT_WS_SETTINGS.footerText,
        fontSize: ['sm', 'md', 'lg'].includes(s.fontSize) ? s.fontSize : DEFAULT_WS_SETTINGS.fontSize
      };
    }

    function normalizeWorksheetState(rawPayload, { forceNewIds = false } = {}) {
      const usedIds = new Set();
      let srcState = {};
      let srcWs = {};

      if (Array.isArray(rawPayload)) {
        srcWs = { questions: rawPayload };
      } else if (rawPayload && typeof rawPayload === 'object') {
        srcState = rawPayload;
        if (rawPayload.worksheet && typeof rawPayload.worksheet === 'object') {
          srcWs = rawPayload.worksheet;
        } else if (Array.isArray(rawPayload.questions) || rawPayload.title !== undefined || rawPayload.titleText !== undefined) {
          srcWs = rawPayload;
        }
      }

      const rawQs = Array.isArray(srcWs.questions) ? srcWs.questions : [];
      const normalizedQuestions = rawQs.map(q => normalizeQuestion(q, { forceNewIds, usedIds }));

      return {
        activeSetId: srcState.activeSetId || null,
        viewMode: ['edit', 'split', 'preview'].includes(srcState.viewMode) ? srcState.viewMode : 'edit',
        showAnswers: Boolean(srcState.showAnswers),
        updatedAt: typeof srcState.updatedAt === 'number' ? srcState.updatedAt : 0,
        worksheet: {
          title: typeof srcWs.title === 'string'
            ? srcWs.title
            : (typeof srcWs.titleText === 'string' ? srcWs.titleText : 'Untitled Worksheet'),
          instructions: typeof srcWs.instructions === 'string'
            ? srcWs.instructions
            : (typeof srcWs.topic === 'string' ? srcWs.topic : 'Please read each question carefully and provide the best possible answer.'),
          questions: normalizedQuestions,
          settings: normalizeWorksheetSettings(srcWs.settings)
        }
      };
    }

    // ── Cloud & Hybrid Local Set Management ───────────────────────────────────
    let activeSetId = null;
    let activeSetName = null;
    let allSets = [];
    let sortMode = 'recent';

    function checkValidUuid(id) {
      if (typeof id !== 'string') return false;
      if (typeof isValidUuid === 'function') return isValidUuid(id);
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    }

    async function migrateLegacyLocalSetsToIDB() {
      const legacyKeys = ['worksheet-maker_sets', 'klasskit_worksheet_sets'];
      for (const key of legacyKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const localDb = await initDB();
            if (localDb.objectStoreNames.contains(STORE_SETS)) {
              const tx = localDb.transaction(STORE_SETS, 'readwrite');
              const store = tx.objectStore(STORE_SETS);
              for (const item of parsed) {
                if (!item || typeof item !== 'object') continue;
                const normalizedData = normalizeWorksheetState(item.stateData || item.state || item.worksheet || item);
                const id = String(item.id || ('ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)));
                store.put({
                  id,
                  name: String(item.name || normalizedData.worksheet.title || 'Imported Set').slice(0, 100),
                  stateData: normalizedData,
                  createdAt: item.createdAt || Date.now(),
                  lastUsed: item.lastUsed || item.updatedAt || Date.now(),
                  usageCount: item.usageCount || 0
                });
              }
              await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
            }
          }
          localStorage.removeItem(key);
        } catch (err) {
          console.warn('[LegacySetsMigration] skipped key:', key, err);
        }
      }
    }

    async function saveSetLocallyToIDB(setRecord) {
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_SETS)) return setRecord.id;
        return new Promise((resolve) => {
          const tx = localDb.transaction(STORE_SETS, 'readwrite');
          const store = tx.objectStore(STORE_SETS);
          store.put(setRecord);
          tx.oncomplete = () => resolve(setRecord.id);
          tx.onerror = () => resolve(setRecord.id);
        });
      } catch (err) {
        console.warn('[WorksheetSet] Local IDB mirror failed:', err);
        return setRecord.id;
      }
    }

    async function removeSetLocallyFromIDB(id) {
      if (!id) return;
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_SETS)) return;
        const tx = localDb.transaction(STORE_SETS, 'readwrite');
        tx.objectStore(STORE_SETS).delete(id);
        await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
      } catch (err) {}
    }

    async function saveWorksheetSetToDB(name, stateData, existingId = null) {
      const normalizedData = normalizeWorksheetState(stateData);
      await migrateInlineImagesToDB(normalizedData.worksheet);
      normalizedData.updatedAt = Date.now();

      if (!isSandbox() && typeof db !== 'undefined') {
        try {
          const user = await getCloudUser();
          if (user) {
            const set = {
              user_id: user.id,
              name,
              state_data: typeof sanitizeCloudPayload === 'function' ? sanitizeCloudPayload(normalizedData) : normalizedData,
              last_used: new Date().toISOString()
            };

            if (existingId && checkValidUuid(existingId)) {
              const { data, error } = await db.from('tools_worksheetmaker')
                .update({ name, state_data: set.state_data, last_used: set.last_used })
                .eq('id', existingId)
                .eq('user_id', user.id)
                .select('id').single();
              if (!error && data) {
                await saveSetLocallyToIDB({
                  id: data.id,
                  name,
                  stateData: normalizedData,
                  createdAt: Date.now(),
                  lastUsed: Date.now(),
                  usageCount: 1
                });
                return data.id;
              }
            } else {
              const { data, error } = await db.from('tools_worksheetmaker')
                .insert([set])
                .select('id').single();
              if (!error && data) {
                if (existingId && !checkValidUuid(existingId)) {
                  await removeSetLocallyFromIDB(existingId);
                }
                await saveSetLocallyToIDB({
                  id: data.id,
                  name,
                  stateData: normalizedData,
                  createdAt: Date.now(),
                  lastUsed: Date.now(),
                  usageCount: 1
                });
                return data.id;
              }
            }
          }
        } catch (err) {
          console.error('[WorksheetSet] Cloud save error, falling back to local IndexedDB:', err);
        }
      }

      // Local IndexedDB fallback
      const localDb = await initDB();
      const tx = localDb.transaction(STORE_SETS, 'readwrite');
      const store = tx.objectStore(STORE_SETS);

      const set = {
        name,
        stateData: normalizedData,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
      };

      if (existingId) {
        return new Promise((resolve) => {
          const req = store.get(existingId);
          req.onsuccess = () => {
            const old = req.result;
            if (old) {
              set.id = existingId;
              set.createdAt = old.createdAt || Date.now();
              set.usageCount = (old.usageCount || 0) + 1;
            } else {
              set.id = existingId;
            }
            store.put(set);
            tx.oncomplete = () => resolve(set.id);
          };
          req.onerror = () => {
            set.id = existingId;
            store.put(set);
            tx.oncomplete = () => resolve(set.id);
          };
        });
      }

      set.id = 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const req = store.add(set);
      return new Promise(r => {
        req.onsuccess = () => r(set.id);
        req.onerror = () => r(null);
      });
    }

    async function updateWorksheetSetMetadata(id, data) {
      const normalizedState = data.stateData ? normalizeWorksheetState(data.stateData) : null;
      if (!isSandbox() && typeof db !== 'undefined' && checkValidUuid(id)) {
        try {
          const user = await getCloudUser();
          if (user) {
            const updateData = {};
            if (data.lastUsed) updateData.last_used = new Date().toISOString();
            if (normalizedState) {
              updateData.state_data = typeof sanitizeCloudPayload === 'function' ? sanitizeCloudPayload(normalizedState) : normalizedState;
            }
            if (data.name) updateData.name = data.name;
            if (data.usageCount !== undefined) {
              updateData.usage_count = data.usageCount;
              updateData.last_used = new Date().toISOString();
            }

            const { error } = await db.from('tools_worksheetmaker')
              .update(updateData)
              .eq('id', id)
              .eq('user_id', user.id);
            if (error) console.error('[WorksheetSet] Update metadata failed:', error);
          }
        } catch (err) {
          console.error('[WorksheetSet] Update metadata exception:', err);
        }
      }

      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_SETS)) return;
        const tx = localDb.transaction(STORE_SETS, 'readwrite');
        const store = tx.objectStore(STORE_SETS);

        await new Promise((resolve) => {
          const req = store.get(id);
          req.onsuccess = () => {
            const item = req.result;
            if (item) {
              const updated = {
                ...item,
                ...data,
                ...(normalizedState ? { stateData: normalizedState } : {}),
                lastUsed: Date.now()
              };
              if (data.usageCount !== undefined) updated.usageCount = data.usageCount;
              store.put(updated);
            }
            resolve();
          };
          req.onerror = () => resolve();
        });
      } catch (err) {}
    }

    async function getLocalIndexedDBSets() {
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_SETS)) return [];
        return new Promise((res) => {
          const r = localDb.transaction(STORE_SETS, 'readonly').objectStore(STORE_SETS).getAll();
          r.onsuccess = () => {
            const sets = (r.result || []).map(set => ({
              ...set,
              lastUsed: set.lastUsed || set.createdAt || Date.now(),
              usageCount: set.usageCount || 0
            }));
            res(sets);
          };
          r.onerror = () => res([]);
        });
      } catch (e) { return []; }
    }

    async function getAllWorksheetSets() {
      await migrateLegacyLocalSetsToIDB();
      const localSets = await getLocalIndexedDBSets();
      let cloudSets = [];

      if (!isSandbox() && typeof db !== 'undefined') {
        try {
          const user = await getCloudUser();
          if (user) {
            const { data, error } = await db.from('tools_worksheetmaker')
              .select('*')
              .eq('user_id', user.id)
              .order('last_used', { ascending: false });
            if (!error && Array.isArray(data)) {
              cloudSets = data.map(d => ({
                id: d.id,
                name: d.name,
                stateData: d.state_data,
                usageCount: d.usage_count || 0,
                lastUsed: new Date(d.last_used).getTime() || Date.now(),
                createdAt: new Date(d.created_at).getTime() || Date.now()
              }));
            } else if (error) {
              console.error('[WorksheetSet] Cloud fetch error:', error);
            }
          }
        } catch (err) {
          console.error('[WorksheetSet] Cloud fetch exception:', err);
        }
      }

      if (cloudSets.length === 0) return localSets;

      const merged = new Map();
      localSets.forEach(s => merged.set(s.id, s));
      cloudSets.forEach(s => {
        const prev = merged.get(s.id);
        merged.set(s.id, {
          ...prev,
          ...s,
          usageCount: Math.max(s.usageCount || 0, prev ? (prev.usageCount || 0) : 0)
        });
      });
      return Array.from(merged.values());
    }

    async function deleteWorksheetSet(id) {
      if (!isSandbox() && typeof db !== 'undefined' && checkValidUuid(id)) {
        try {
          const user = await getCloudUser();
          if (user) {
            await db.from('tools_worksheetmaker').delete().eq('id', id).eq('user_id', user.id);
          }
        } catch (err) {
          console.error('[WorksheetSet] Cloud delete error:', err);
        }
      }
      await removeSetLocallyFromIDB(id);
    }

    let saveTimeout = null;
    async function saveState() {
      const now = Date.now();
      state.updatedAt = now;
      state.worksheet.settings = normalizeWorksheetSettings(state.worksheet.settings);

      const stateToSave = {
        activeSetId,
        viewMode: state.viewMode,
        showAnswers: state.showAnswers,
        updatedAt: now,
        worksheet: state.worksheet
      };

      const serialized = JSON.stringify(stateToSave);
      try {
        localStorage.setItem('prog_worksheet-maker', serialized);
        localStorage.setItem('worksheet-maker_state', serialized);
      } catch (e) {
        console.warn('[SaveState] localStorage write failed:', e);
      }

      // Auto-save to library if active set
      if (activeSetId) {
        try {
          await updateWorksheetSetMetadata(activeSetId, { stateData: stateToSave });
        } catch (err) {
          console.error('[SaveState] Failed to update library metadata:', err);
        }
      }

      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (typeof saveProgress === 'function') {
          saveProgress('worksheet-maker', stateToSave).catch(err => {
            console.error('[Cloud Save] Error:', err);
          });
        }
      }, 1000);
    }

    async function loadState() {
      allSets = await getAllWorksheetSets();

      let cloudRaw = null;
      if (typeof loadProgress === 'function') {
        try {
          cloudRaw = await loadProgress('worksheet-maker');
        } catch (e) {}
      }

      let localRaw = null;
      const rawProg = localStorage.getItem('prog_worksheet-maker');
      const rawLegacy = localStorage.getItem('worksheet-maker_state');
      for (const candidate of [rawProg, rawLegacy]) {
        if (!candidate) continue;
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object') {
            localRaw = parsed;
            break;
          }
        } catch (e) {}
      }

      const cloudNorm = cloudRaw ? normalizeWorksheetState(cloudRaw) : null;
      const localNorm = localRaw ? normalizeWorksheetState(localRaw) : null;

      let chosen = null;
      if (cloudNorm && localNorm) {
        const cloudQs = cloudNorm.worksheet.questions.length;
        const localQs = localNorm.worksheet.questions.length;
        if (cloudQs === 0 && localQs > 0) {
          chosen = localNorm;
        } else if (localNorm.updatedAt && cloudNorm.updatedAt && localNorm.updatedAt > cloudNorm.updatedAt) {
          chosen = localNorm;
        } else {
          chosen = cloudNorm;
        }
      } else {
        chosen = cloudNorm || localNorm;
      }

      if (chosen) {
        activeSetId = chosen.activeSetId || null;
        state.viewMode = chosen.viewMode || 'edit';
        state.showAnswers = chosen.showAnswers || false;
        state.updatedAt = chosen.updatedAt || Date.now();
        state.worksheet = chosen.worksheet;
      }

      if (activeSetId) {
        const activeSet = allSets.find(s => s.id === activeSetId);
        if (activeSet) {
          activeSetName = activeSet.name;
          updateActiveIndicator();
        } else {
          activeSetId = null;
        }
      }

      const migrated = await migrateInlineImagesToDB(state.worksheet);
      await hydrateWorksheetImages();
      if (migrated) saveState();
      renderLibrary();
    }

    // ── Library Workflows (Following sets_management_pattern.md) ──────────────

    async function createNewSet() {
      state.worksheet = {
        title: 'Untitled Worksheet',
        instructions: 'Please read each question carefully and provide the best possible answer.',
        questions: [],
        settings: { ...DEFAULT_WS_SETTINGS }
      };
      state.viewMode = 'edit';
      state.showAnswers = false;
      activeSetId = null;
      activeSetName = null;

      const nameInput = document.getElementById('set-name-input');
      if (nameInput) nameInput.value = '';

      updateActiveIndicator();
      render();
      saveState();
    }

    async function saveCurrentSet() {
      const nameInput = document.getElementById('set-name-input');
      const typedName = nameInput ? nameInput.value.trim() : '';
      const name = typedName || activeSetName || state.worksheet.title || '';
      if (!name || name.length > 100) {
        alert('Please enter a valid worksheet set name (1-100 characters)');
        return;
      }

      const stateData = {
        activeSetId,
        viewMode: state.viewMode,
        showAnswers: state.showAnswers,
        updatedAt: Date.now(),
        worksheet: state.worksheet
      };

      const targetExistingId = (!typedName || typedName === activeSetName) ? activeSetId : null;
      const newId = await saveWorksheetSetToDB(name, stateData, targetExistingId);
      if (newId) {
        activeSetId = newId;
        activeSetName = name;
        if (nameInput) nameInput.value = '';
        updateActiveIndicator();
        allSets = await getAllWorksheetSets();
        renderLibrary();
        if (typeof showConfirmModal === 'function') {
          await showConfirmModal(`Worksheet "${name}" has been saved to your library.`, {
            title: 'Worksheet Saved',
            confirmText: 'Nice!',
            cancelText: '',
            icon: 'check-circle',
            iconColor: 'green'
          });
        }
      }
    }

    async function loadSetFromList(id) {
      let stateData = null;
      let freshSet = null;

      if (!isSandbox() && typeof db !== 'undefined' && checkValidUuid(id)) {
        try {
          const user = await getCloudUser();
          if (user) {
            const { data } = await db.from('tools_worksheetmaker')
              .select('*')
              .eq('id', id)
              .eq('user_id', user.id)
              .single();
            if (data) {
              stateData = data.state_data;
              freshSet = { name: data.name, usageCount: data.usage_count || 0 };
            }
          }
        } catch (e) {}
      }

      if (!stateData) {
        const localSet = await loadSetFromLibrary(id);
        if (localSet) {
          stateData = localSet.stateData || localSet.state || localSet.worksheet || localSet;
          freshSet = { name: localSet.name, usageCount: localSet.usageCount || 0 };
        }
      }

      if (!stateData) {
        const cachedSet = allSets.find(s => s.id === id);
        if (cachedSet) {
          stateData = cachedSet.stateData;
          freshSet = { name: cachedSet.name, usageCount: cachedSet.usageCount || 0 };
        }
      }

      if (freshSet) {
        await updateWorksheetSetMetadata(id, { usageCount: freshSet.usageCount + 1 });
      }

      if (stateData && freshSet) {
        await loadWorksheetSet(stateData, id, freshSet.name);
      }
    }

    async function loadSetFromLibrary(id) {
      try {
        const localDb = await initDB();
        if (!localDb.objectStoreNames.contains(STORE_SETS)) return null;
        return new Promise((res) => {
          const tx = localDb.transaction(STORE_SETS, 'readonly');
          const store = tx.objectStore(STORE_SETS);
          const req = store.get(id);
          req.onsuccess = () => res(req.result);
          req.onerror = () => res(null);
        });
      } catch (e) {
        return null;
      }
    }

    async function loadWorksheetSet(stateData, id = null, name = '') {
      const normalized = normalizeWorksheetState(stateData);
      activeSetId = id;
      activeSetName = name;
      state.viewMode = normalized.viewMode || 'edit';
      state.showAnswers = normalized.showAnswers || false;
      state.worksheet = normalized.worksheet;

      const nameInput = document.getElementById('set-name-input');
      if (nameInput) nameInput.value = '';

      await migrateInlineImagesToDB(state.worksheet);
      await hydrateWorksheetImages();
      updateActiveIndicator();
      render();
      saveState();
    }

    function updateActiveIndicator() {
      const indicator = document.getElementById('active-set-indicator');
      const nameEl = document.getElementById('active-set-name');
      const saveBtn = document.getElementById('save-btn');

      if (indicator && nameEl) {
        if (activeSetId && activeSetName) {
          indicator.classList.remove('hidden');
          nameEl.textContent = activeSetName;
          if (saveBtn) saveBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Save As';
        } else {
          indicator.classList.add('hidden');
          if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> Save';
        }
        lucide.createIcons();
      }
    }

    function closeActiveSet() {
      activeSetId = null;
      activeSetName = null;
      updateActiveIndicator();
      renderLibrary();
    }

    function changeSetsSort() {
      const sortSelect = document.getElementById('sets-sort');
      if (sortSelect) {
        sortMode = sortSelect.value;
        renderLibrary();
      }
    }

    function renderLibrary() {
      const list = document.getElementById('sets-list');
      if (!list) return;

      let sorted = [...allSets];
      if (sortMode === 'recent') sorted.sort((a, b) => b.lastUsed - a.lastUsed);
      else if (sortMode === 'alpha') sorted.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortMode === 'popular') sorted.sort((a, b) => b.usageCount - a.usageCount);

      if (sorted.length === 0) {
        list.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-[10px] italic p-2">No saved worksheets yet.</p>';
        return;
      }

      list.innerHTML = sorted.map(set => {
        const isActive = activeSetId === set.id;
        const qCount = set.stateData?.worksheet?.questions?.length || 0;
        const date = new Date(set.lastUsed).toLocaleDateString();
        return `
          <div class="flex items-center justify-between gap-2 p-2 border-2 ${isActive ? 'bg-blue/10 border-blue text-blue dark:bg-blue/20' : 'bg-slate-50 dark:bg-slate-900 border-dark/10 dark:border-slate-700 hover:border-dark/30 dark:hover:border-slate-500'} rounded-xl transition-all duration-150">
            <div class="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onclick="loadSetFromList('${set.id}')">
              <div class="w-8 h-8 rounded-lg bg-blue/20 flex items-center justify-center text-blue font-bold text-xs shrink-0">
                ${qCount}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-xs font-bold truncate ${isActive ? 'text-blue' : 'text-slate-700 dark:text-slate-300'}">${esc(set.name)}</p>
                  ${isActive ? '<span class="px-1 py-0.5 bg-blue text-white text-[7px] font-heading font-black rounded uppercase tracking-wider">Active</span>' : ''}
                </div>
                <p class="text-[9px] text-slate-400 dark:text-slate-500">${date} • ${set.usageCount || 0} uses</p>
              </div>
            </div>
            <button onclick="event.stopPropagation(); deleteWorksheetSetPrompt('${set.id}')" class="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      }).join('');

      lucide.createIcons();
    }

    async function deleteWorksheetSetPrompt(id) {
      if (confirm('Delete this worksheet set? This cannot be undone.')) {
        await deleteWorksheetSet(id);
        if (activeSetId === id) closeActiveSet();
        allSets = await getAllWorksheetSets();
        renderLibrary();
      }
    }

    function scrambleText(input) {
      const str = String(input || '').trim();
      if (!str) return '';
      const words = str.split(/\s+/);
      if (words.length > 1) {
        if (new Set(words).size === 1) return words.join(' / ');
        let shuffled = [...words];
        for (let attempt = 0; attempt < 8; attempt++) {
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          if (shuffled.join(' ') !== words.join(' ')) return shuffled.join(' / ');
        }
        return [...words].reverse().join(' / ');
      }
      const chars = [...str];
      if (chars.length <= 1 || new Set(chars).size === 1) return str;
      for (let attempt = 0; attempt < 8; attempt++) {
        for (let i = chars.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        if (chars.join('') !== str) return chars.join('');
      }
      return [...str].reverse().join('');
    }

    const createDefaultQuestion = (type) => {
      const base = { id: generateId(), type, text: '', points: (type === 'section' || type === 'passage' || type === 'checklist') ? 0 : 1, imageId: '', imageSize: 'md' };
      switch (type) {
        case 'mcq': return { ...base, optColumns: 'auto', options: [{ id: generateId(), text: '', isCorrect: true, imageId: '' }, { id: generateId(), text: '', isCorrect: false, imageId: '' }] };
        case 'fib': return { ...base, text: 'The capital of Japan is ___ .', answer: 'Tokyo' };
        case 'sa': return { ...base, lines: 2, answer: '' };
        case 'tf': return { ...base, tfStyle: 'tf', requireCorrection: false, isTrue: true };
        case 'matching': return { ...base, matchStyle: 'letters', pairs: [{ id: generateId(), left: '', right: '', leftImageId: '', rightImageId: '' }, { id: generateId(), left: '', right: '', leftImageId: '', rightImageId: '' }] };
        case 'essay': return { ...base, lines: 5, lineStyle: 'ruled', answer: '' };
        case 'section': return { ...base, text: 'PART A: Vocabulary & Grammar', subtitle: 'Read carefully before answering each section.' };
        case 'passage': return { ...base, title: 'Reading Passage', boxStyle: 'card', showLineNumbers: false, text: 'Write or paste a short reading text, grammar note, or dialogue here.' };
        case 'unscramble': return { ...base, text: 'Unscramble each word or sentence and write it neatly on the line:', items: [{ id: generateId(), scrambled: 'b / k / o / o', answer: 'book', hint: 'you read it' }, { id: generateId(), scrambled: 'school / go / to / We', answer: 'We go to school', hint: '' }] };
        case 'sort': return { ...base, text: 'Sort the words in the box into the correct columns below:', categories: [{ id: generateId(), title: 'Nouns', items: 'apple, desk, river' }, { id: generateId(), title: 'Verbs', items: 'run, write, jump' }] };
        case 'drawing': return { ...base, text: 'Draw and label your diagram in the space below:', boxHeight: 'md', boxStyle: 'blank', captionLines: 2, answer: '' };
        case 'checklist': return { ...base, text: 'Self-Check before handing in your paper:', checkStyle: 'box', items: [{ id: generateId(), text: 'I wrote my name and date clearly.' }, { id: generateId(), text: 'I checked spelling and punctuation.' }] };
        default: return base;
      }
    };


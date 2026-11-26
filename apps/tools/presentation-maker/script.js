/* ========================================================
   KLASSKIT SLIDES (PRESENTATION MAKER) - SCRIPT.JS
   Soft Brutalist Chromebook Studio + Dynamic Slide Engine
   ======================================================== */

(function () {
    'use strict';

    const STORAGE_KEY = 'kk_rapid_slides_v4';
    const LIBRARY_KEY = 'kk_rapid_library_v1';
    const IMAGE_LIBRARY_KEY = 'kk_rapid_images_v1';
    const META_KEY = 'kk_rapid_meta_v1';
    const VIEW_KEY = 'kk_slides_view_v1';
    const THEME_KEY = 'theme_presentation-maker';

    const SLIDE_LAYOUTS = {
        hero: {
            id: 'hero',
            label: 'Hero',
            icon: 'type',
            usesImage: false,
            desc: 'Big centered statement or key term',
            placeholder: 'Type your big headline or prompt here...'
        },
        bullets: {
            id: 'bullets',
            label: 'Bullets',
            icon: 'list',
            usesImage: false,
            desc: 'Line 1 heading + bullet points below',
            placeholder: 'Lesson Goals\n- Warm-up vocabulary\n- Guided reading\n- Partner challenge'
        },
        split: {
            id: 'split',
            label: 'Split',
            icon: 'columns-2',
            usesImage: true,
            desc: '50/50 text left & image right',
            placeholder: 'Key explanation or discussion prompt...'
        },
        caption: {
            id: 'caption',
            label: 'Caption',
            icon: 'captions',
            usesImage: true,
            desc: 'Large framed visual with banner below',
            placeholder: 'Short caption below the image...'
        },
        full: {
            id: 'full',
            label: 'Full Img',
            icon: 'maximize',
            usesImage: true,
            desc: 'Full-bleed visual showcase',
            placeholder: 'Optional corner label...'
        }
    };

    const SLIDE_THEMES = [
        { id: 'auto', label: 'Auto', swatch: 'conic-gradient(from 45deg, #1ea7fd, #ff4785, #00d063, #ff7e33, #1ea7fd)' },
        { id: 'blue', label: 'Blue', swatch: '#1ea7fd' },
        { id: 'pink', label: 'Pink', swatch: '#ff4785' },
        { id: 'orange', label: 'Orange', swatch: '#ff7e33' },
        { id: 'green', label: 'Green', swatch: '#00d063' },
        { id: 'purple', label: 'Purple', swatch: '#7c4dff' },
        { id: 'dark', label: 'Dark', swatch: '#0f172a' },
        { id: 'light', label: 'Light', swatch: '#f8fafc' }
    ];

    const AUTO_THEME_CYCLE = ['blue', 'pink', 'green', 'orange', 'dark'];

    const THEME_TO_BADGE_TONE = {
        blue: 'blue',
        pink: 'pink',
        orange: 'orange',
        green: 'green',
        purple: 'slate',
        dark: 'slate',
        light: 'slate'
    };

    const SLIDE_TEMPLATES = [
        {
            id: 'vocab-flashcards',
            title: 'Vocabulary Flashcards',
            tag: 'Words & Meaning',
            accent: 'blue',
            icon: 'book-open',
            desc: '5 punchy slides for introducing new terms, pronunciation prompts, and quick examples.',
            slides: [
                { layout: 'hero', theme: 'blue', text: "Today's Key Words\nListen, Repeat, Use It!", notes: 'Read aloud slowly twice before revealing each word.' },
                { layout: 'split', theme: 'pink', text: 'Curious\nWanting to learn or know more about something.', notes: 'Ask students for a facial expression of curiosity.' },
                { layout: 'split', theme: 'green', text: 'Collaborate\nTo work together with others toward a shared goal.', notes: 'Point out pair/group expectations.' },
                { layout: 'bullets', theme: 'orange', text: 'Use It In A Sentence\nI was curious about...\nLet us collaborate on...', notes: 'Pick 2 volunteers with cold-call sticks.' },
                { layout: 'hero', theme: 'dark', text: 'Quick Check:\nTurn and teach 1 word to your partner!', notes: 'Set a 45-second timer.' }
            ]
        },
        {
            id: 'lesson-agenda',
            title: 'Lesson Agenda & Goals',
            tag: 'Routine',
            accent: 'green',
            icon: 'list-checks',
            desc: 'Start class with clear learning objectives, timings, and a wrap-up exit question.',
            slides: [
                { layout: 'hero', theme: 'blue', text: 'Welcome to Class!\nGrab your notebook & pencil.', notes: 'Display while students settle in.' },
                { layout: 'bullets', theme: 'green', text: "Today's Plan\n5 min: Warm-Up Puzzle\n15 min: Mini Lesson\n15 min: Group Practice\n5 min: Exit Ticket", notes: 'Review timing expectations.' },
                { layout: 'hero', theme: 'orange', text: 'Success Criteria\nI can explain the main idea using evidence.', notes: 'Check thumbs up / sideways / down.' },
                { layout: 'hero', theme: 'pink', text: 'Exit Ticket\nWrite one thing you learned and one question.', notes: 'Collect slips by the door.' }
            ]
        },
        {
            id: 'discussion-prompts',
            title: 'Think-Pair-Share',
            tag: 'Speaking',
            accent: 'pink',
            icon: 'messages-square',
            desc: 'Timed speaking steps with starter sentence frames so every learner speaks confidently.',
            slides: [
                { layout: 'hero', theme: 'pink', text: 'Think Quietly (30s)\nWhat makes a great teammate?', notes: 'Wait silently for 30 seconds before pairing.' },
                { layout: 'bullets', theme: 'blue', text: 'Sentence Starters\nIn my opinion, ... because ...\nI agree with ___ and want to add ...\nAnother way to look at it is ...', notes: 'Remind pairs to alternate speakers.' },
                { layout: 'hero', theme: 'green', text: 'Pair & Share (90s)\nListen closely so you can share what your partner said!', notes: 'Circulate and listen for strong examples.' },
                { layout: 'hero', theme: 'dark', text: 'Class Debrief\nShare one idea you heard from your partner.', notes: 'Call on 3-4 pairs.' }
            ]
        },
        {
            id: 'visual-inquiry',
            title: 'Visual Inquiry Warm-Up',
            tag: 'Notice & Wonder',
            accent: 'orange',
            icon: 'image',
            desc: 'Image-ready Notice, Wonder, and Connect slides—just drop your own photo onto slide 1 & 2.',
            slides: [
                { layout: 'full', theme: 'dark', text: 'What do you notice first?', notes: 'Upload or paste an image with Ctrl+V onto this slide.' },
                { layout: 'split', theme: 'blue', text: 'See - Think - Wonder\nWhat do you see?\nWhat does it make you think?\nWhat does it make you wonder?', notes: 'Record 3 wonders on the board.' },
                { layout: 'caption', theme: 'orange', text: 'Write a 6-word headline for this scene!', notes: 'Have table groups compare headlines.' }
            ]
        },
        {
            id: 'quick-quiz',
            title: 'Quick Quiz Round',
            tag: 'Review Game',
            accent: 'blue',
            icon: 'circle-question-mark',
            desc: 'Mini whiteboard / hand-signal quiz deck with prompt slides followed by answer reveals.',
            slides: [
                { layout: 'hero', theme: 'blue', text: 'Lightning Quiz!\nShow A, B, or C on your fingers.', notes: 'Count 3-2-1-Show for simultaneous response.' },
                { layout: 'bullets', theme: 'dark', text: 'Question 1: Which word is an adjective?\nA) Run quickly\nB) Brightly colored\nC) Curious explorer', notes: 'Wait until every hand is ready.' },
                { layout: 'hero', theme: 'green', text: 'Answer: C!\n"Curious" describes the noun "explorer".', notes: 'Quickly clarify B vs C.' },
                { layout: 'bullets', theme: 'dark', text: 'Question 2: Fix the sentence\nA) She go to school every day.\nB) She goes to school every day.\nC) She going to school.', notes: 'Prompt students to whisper the verb rule.' },
                { layout: 'hero', theme: 'green', text: 'Answer: B!\nSubject-verb agreement: She goes.', notes: 'Celebrate high accuracy!' }
            ]
        }
    ];

    const BULK_TEMPLATE_SAMPLE = [
        '[HERO] (blue) Welcome to Science Lab!',
        'NOTE: Greet class while notebooks come out.',
        '---',
        '[BULLETS] (green) Lab Safety Rules',
        '- Wear safety goggles near liquids',
        '- Walk calmly at all times',
        '- Ask before mixing materials',
        '---',
        '[SPLIT] (pink) Observation vs Inference',
        'Observe with your senses; infer using clues.',
        'IMG: https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1000',
        '---',
        '[HERO] (orange) Exit Check: Name 1 safety rule!'
    ].join('\n');

    /* ========================================================
       PURE UTILITY HELPERS
       ======================================================== */
    function escapeHTML(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createSlideId() {
        return Date.now() + Math.floor(Math.random() * 100000);
    }

    function sanitizeImageUrl(rawUrl) {
        if (typeof rawUrl !== 'string') return null;
        const trimmed = rawUrl.trim();
        if (!trimmed || trimmed.length > 2000000) return null;

        // Safe internal local & cloud asset references
        if (/^klasskit-local:[a-zA-Z0-9._-]+$/.test(trimmed)) {
            return trimmed;
        }
        if (/^(klasskit-media\/|presentation_maker\/)[a-zA-Z0-9._/-]+$/.test(trimmed)) {
            return trimmed;
        }
        // Raster data URLs only (block SVG XML XSS payloads)
        if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
            return trimmed;
        }
        // Standard web image URLs
        if (/^https?:\/\/\S+$/i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    return trimmed;
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function resolveSlideTheme(theme, index) {
        const clean = typeof theme === 'string' ? theme.toLowerCase().trim() : 'auto';
        const valid = SLIDE_THEMES.some((t) => t.id === clean && t.id !== 'auto');
        if (valid) return clean;
        const safeIdx = Math.max(0, Number.isFinite(index) ? index : 0);
        return AUTO_THEME_CYCLE[safeIdx % AUTO_THEME_CYCLE.length];
    }

    function sanitizeSlide(raw, index = 0) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const layout = SLIDE_LAYOUTS[src.layout] ? src.layout : 'hero';
        const themeKey = typeof src.theme === 'string' && SLIDE_THEMES.some((t) => t.id === src.theme)
            ? src.theme
            : 'auto';
        const text = typeof src.text === 'string' ? src.text.slice(0, 4000) : '';
        const notes = typeof src.notes === 'string' ? src.notes.slice(0, 1500) : '';
        const image = sanitizeImageUrl(src.image);
        const id = (typeof src.id === 'number' || (typeof src.id === 'string' && src.id.trim()))
            ? src.id
            : createSlideId() + index;

        return { id, layout, text, image, theme: themeKey, notes };
    }

    function sanitizeDeckSchema(rawSlides) {
        if (!Array.isArray(rawSlides)) return [];
        return rawSlides.slice(0, 200).map((s, i) => sanitizeSlide(s, i));
    }

    function sanitizeLibrary(rawLibrary) {
        if (!Array.isArray(rawLibrary)) return [];
        return rawLibrary
            .filter((d) => d && typeof d === 'object')
            .slice(0, 200)
            .map((deck, idx) => ({
                id: typeof deck.id === 'string' && deck.id.trim() ? deck.id.trim() : `deck_${Date.now()}_${idx}`,
                title: typeof deck.title === 'string' && deck.title.trim() ? deck.title.trim().slice(0, 80) : 'Untitled Deck',
                updated: typeof deck.updated === 'number' ? deck.updated : Date.now(),
                slides: sanitizeDeckSchema(deck.slides || [])
            }));
    }

    function sanitizeImageLibrary(rawList) {
        if (!Array.isArray(rawList)) return [];
        const seen = new Set();
        const out = [];
        for (let i = 0; i < rawList.length && out.length < 300; i++) {
            const raw = rawList[i];
            if (!raw || typeof raw !== 'object') continue;
            const src = sanitizeImageUrl(raw.src || raw.url || '');
            if (!src || seen.has(src)) continue;
            seen.add(src);
            const id = typeof raw.id === 'string' && raw.id.trim()
                ? raw.id.trim()
                : `asset_${Date.now()}_${i}`;
            const caption = typeof raw.caption === 'string' ? raw.caption.trim().slice(0, 200) : '';
            const name = typeof raw.name === 'string' && raw.name.trim()
                ? raw.name.trim().slice(0, 120)
                : (caption || `Saved Image ${out.length + 1}`);
            const addedAt = typeof raw.addedAt === 'number' ? raw.addedAt : Date.now();
            out.push({ id, src, name, caption, addedAt });
        }
        return out;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function parseBulkSlidesText(rawText, options = {}) {
        const warnings = [];
        const raw = String(rawText || '').replace(/\r\n?/g, '\n');
        const rawLines = raw.split('\n');

        // Filter comment lines (# ... or // ...) while retaining content lines
        const cleanedLines = rawLines.filter((line) => !/^\s*(\/\/|#(\s|$))/.test(line));
        const hasDividers = cleanedLines.some((l) => /^\s*---\s*$/.test(l));
        const hasTagHeaders = cleanedLines.some((l) => /^\s*\[(HERO|BULLETS|SPLIT|CAPTION|FULL)\]/i.test(l));
        const hasDirectives = cleanedLines.some((l) => /^\s*(IMG|IMAGE|NOTE|NOTES)\s*:/i.test(l));

        const useLineMode = Boolean(options.onePerLine) || (!hasDividers && !hasTagHeaders && !hasDirectives);
        const validThemes = new Set(SLIDE_THEMES.map((t) => t.id));

        function parseTagPrefix(line) {
            let rest = String(line || '').trim();
            let layout = null;
            let theme = 'auto';

            const tagMatch = rest.match(/^\[(HERO|BULLETS|SPLIT|CAPTION|FULL)\]\s*(.*)$/i);
            if (tagMatch) {
                layout = tagMatch[1].toLowerCase();
                rest = tagMatch[2].trim();
            }
            const colorMatch = rest.match(/^\(([a-zA-Z]+)\)\s*(.*)$/);
            if (colorMatch && validThemes.has(colorMatch[1].toLowerCase())) {
                theme = colorMatch[1].toLowerCase();
                rest = colorMatch[2].trim();
            }
            return { layout, theme, rest };
        }

        const parsedSlides = [];

        if (useLineMode) {
            cleanedLines.forEach((rawLine, lineIdx) => {
                const line = rawLine.trim();
                if (!line) return;

                let { layout, theme, rest } = parseTagPrefix(line);
                let image = null;
                let text = rest;

                if (rest.includes('|')) {
                    const parts = rest.split('|').map((p) => p.trim()).filter(Boolean);
                    if (parts.length >= 2) {
                        const tail = parts[parts.length - 1];
                        const maybeImg = sanitizeImageUrl(tail);
                        if (maybeImg) {
                            image = maybeImg;
                            text = parts.slice(0, -1).join(' | ');
                            if (!layout) layout = 'split';
                        } else if (!layout || layout === 'bullets') {
                            layout = 'bullets';
                            text = parts.join('\n');
                        }
                    }
                }

                parsedSlides.push({
                    id: createSlideId() + parsedSlides.length,
                    layout: layout || 'hero',
                    theme,
                    text,
                    image,
                    notes: ''
                });

                if (rest.includes('IMG:') && !image) {
                    warnings.push(`Line ${lineIdx + 1}: put "IMG: ..." on its own line in block mode, or use "|" followed by the image URL.`);
                }
            });
        } else {
            // Split into blocks by `---` OR a standalone tag header on a new block
            const blocks = [];
            let current = [];

            const flush = () => {
                while (current.length && !current[0].trim()) current.shift();
                while (current.length && !current[current.length - 1].trim()) current.pop();
                if (current.length) blocks.push(current);
                current = [];
            };

            cleanedLines.forEach((line) => {
                const trimmed = line.trim();
                if (/^---+$/.test(trimmed)) {
                    flush();
                    return;
                }
                if (/^\[(HERO|BULLETS|SPLIT|CAPTION|FULL)\]/i.test(trimmed) && current.length > 0) {
                    flush();
                }
                current.push(line);
            });
            flush();

            blocks.forEach((blockLines, blockIdx) => {
                let layout = null;
                let theme = 'auto';
                let image = null;
                const notesParts = [];
                const textLines = [];

                blockLines.forEach((rawLine, idx) => {
                    const trimmed = rawLine.trim();
                    if (idx === 0) {
                        const parsed = parseTagPrefix(rawLine);
                        if (parsed.layout) layout = parsed.layout;
                        if (parsed.theme !== 'auto') theme = parsed.theme;
                        if (parsed.rest) textLines.push(parsed.rest);
                        return;
                    }
                    const imgMatch = trimmed.match(/^(?:IMG|IMAGE)\s*:\s*(.+)$/i);
                    if (imgMatch) {
                        const validUrl = sanitizeImageUrl(imgMatch[1]);
                        if (validUrl) {
                            image = validUrl;
                        } else {
                            warnings.push(`Slide ${blockIdx + 1}: skipped invalid or unsupported image URL.`);
                        }
                        return;
                    }
                    const noteMatch = trimmed.match(/^(?:NOTE|NOTES)\s*:\s*(.+)$/i);
                    if (noteMatch) {
                        notesParts.push(noteMatch[1].trim());
                        return;
                    }
                    textLines.push(rawLine.trimEnd());
                });

                const joinedText = textLines.join('\n').trim();
                if (!joinedText && !image) {
                    warnings.push(`Slide block ${blockIdx + 1} was empty and skipped.`);
                    return;
                }

                let finalLayout = layout;
                if (!finalLayout) {
                    if (image && !joinedText) finalLayout = 'full';
                    else if (image) finalLayout = 'split';
                    else if (textLines.length >= 3 && textLines.slice(1).some((l) => /^\s*[-*•]/.test(l))) finalLayout = 'bullets';
                    else finalLayout = 'hero';
                }

                parsedSlides.push({
                    id: createSlideId() + parsedSlides.length,
                    layout: finalLayout,
                    theme,
                    text: joinedText,
                    image,
                    notes: notesParts.join(' ')
                });
            });
        }

        const badges = parsedSlides.map((slide, idx) => {
            const firstLine = (slide.text || '').split('\n')[0].trim();
            const label = firstLine || (slide.image ? 'Visual Slide' : 'Blank Slide');
            const resolvedTheme = resolveSlideTheme(slide.theme, idx);
            return {
                tag: SLIDE_LAYOUTS[slide.layout]?.label || 'Hero',
                label,
                meta: slide.image ? '+ Img' : '',
                tone: THEME_TO_BADGE_TONE[resolvedTheme] || 'slate',
                title: `${SLIDE_LAYOUTS[slide.layout]?.label || 'Hero'} · ${resolvedTheme}${slide.notes ? ` · Note: ${slide.notes}` : ''}`
            };
        });

        return { items: parsedSlides, warnings, badges };
    }

    function parseBulkImageUrls(rawText) {
        const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
        const entries = [];
        let invalidCount = 0;

        lines.forEach((rawLine) => {
            const trimmed = rawLine.trim();
            if (!trimmed || /^\s*(\/\/|#(\s|$))/.test(trimmed)) return;

            let caption = '';
            let rawUrl = trimmed;
            const pipeIdx = trimmed.lastIndexOf('|');
            if (pipeIdx !== -1) {
                caption = trimmed.slice(0, pipeIdx).trim();
                rawUrl = trimmed.slice(pipeIdx + 1).trim();
            }

            const safeUrl = sanitizeImageUrl(rawUrl);
            if (!safeUrl || safeUrl.startsWith('klasskit-local:')) {
                invalidCount++;
                return;
            }
            entries.push({ url: safeUrl, caption });
        });

        return { entries, invalidCount };
    }

    function formatFilenameAsCaption(filename) {
        const base = String(filename || '').trim().replace(/\.[a-z0-9]{1,6}$/i, '');
        if (!base) return '';
        const stripped = base.replace(/^(?:slide[\s_-]*\d+|\d+)[\s._-]+(?=[a-z0-9])/i, '');
        const clean = stripped.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return base;
        return clean.replace(/\b([a-z])/g, (m) => m.toUpperCase());
    }

    /* ========================================================
       INDEXEDDB LOCAL ASSET ENGINE (Preserved PresentationDB)
       ======================================================== */
    const LocalDB = {
        dbName: 'PresentationDB',
        version: 2,
        storeName: 'images',
        db: null,

        init() {
            return new Promise((resolve) => {
                if (typeof indexedDB === 'undefined') {
                    resolve(false);
                    return;
                }
                if (this.db) {
                    resolve(true);
                    return;
                }
                try {
                    const req = indexedDB.open(this.dbName, this.version);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            db.createObjectStore(this.storeName);
                        }
                    };
                    req.onsuccess = (e) => {
                        this.db = e.target.result;
                        resolve(true);
                    };
                    req.onerror = () => resolve(false);
                } catch (err) {
                    resolve(false);
                }
            });
        },

        async save(key, blob) {
            await this.init();
            if (!this.db) return null;
            return new Promise((resolve) => {
                try {
                    const tx = this.db.transaction(this.storeName, 'readwrite');
                    const store = tx.objectStore(this.storeName);
                    store.put(blob, key);
                    tx.oncomplete = () => resolve(`klasskit-local:${key}`);
                    tx.onerror = () => resolve(null);
                } catch (err) {
                    resolve(null);
                }
            });
        },

        async get(key) {
            await this.init();
            if (!this.db) return null;
            return new Promise((resolve) => {
                try {
                    const tx = this.db.transaction(this.storeName, 'readonly');
                    const store = tx.objectStore(this.storeName);
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                } catch (err) {
                    resolve(null);
                }
            });
        },

        async delete(key) {
            await this.init();
            if (!this.db) return;
            try {
                const tx = this.db.transaction(this.storeName, 'readwrite');
                tx.objectStore(this.storeName).delete(key);
            } catch (err) {
                console.warn('LocalDB delete error:', err);
            }
        }
    };

    /* ========================================================
       MAIN APPLICATION ENGINE
       ======================================================== */
    const app = {
        slides: [],
        library: [],
        currentDeckId: null,
        currentDeckTitle: 'Untitled Deck',
        hasUnsavedChanges: false,
        viewMode: 'list',
        activeSlideIndex: 0,
        isPresenting: false,
        presentIndex: 0,
        isBlackout: false,
        showPresentNotes: false,

        undoStack: [],
        redoStack: [],
        pendingTypingSnapshot: false,
        typingHistoryTimer: null,
        saveDebounceTimer: null,
        cloudSyncTimer: null,

        blobUrlCache: new Map(),
        hydrateTokens: new Map(),
        _pendingMediaResolutions: new Map(),
        activeUploadIndex: null,
        activeUrlSlideIndex: null,
        dragSourceIndex: null,
        recentlyDragged: false,
        bulkImportModal: null,
        imageLibrary: [],
        imageManagerTargetSlide: null,
        uploadImageTargetSlide: null,
        selectedManagedImageIds: new Set(),
        bulkImageQueue: [],
        bulkImageImporting: false,
        _imgKeySeq: 0,
        _hasImageLibraryStorage: false,
        _quotaWarned: false,
        _confirmCancel: null,

        /* --- INITIALIZATION --- */
        async init() {
            this.syncThemeIcons();
            this.restoreViewPreference();
            await LocalDB.init();

            // Load fast from localStorage first so Chromebook renders immediately
            this.loadLocalState();
            if (!this._hasImageLibraryStorage) {
                this.syncSlidesIntoImageLibrary();
            }
            if (!this.slides.length) {
                this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            }

            this.setupListeners();
            this.setupBulkImport();
            this.renderTemplatesGrid();
            this.render();
            this.renderLibrary();

            // Background cloud merge (guarded cleanly for offline / test environments)
            await this.syncFromCloudOnInit();
        },

        restoreViewPreference() {
            try {
                const savedView = localStorage.getItem(VIEW_KEY);
                if (savedView === 'grid' || savedView === 'list') {
                    this.viewMode = savedView;
                }
            } catch (e) { }
        },

        loadLocalState() {
            try {
                const libStr = localStorage.getItem(LIBRARY_KEY);
                if (libStr) this.library = sanitizeLibrary(JSON.parse(libStr));

                const imgLibStr = localStorage.getItem(IMAGE_LIBRARY_KEY);
                if (imgLibStr !== null) {
                    this._hasImageLibraryStorage = true;
                    this.imageLibrary = sanitizeImageLibrary(JSON.parse(imgLibStr));
                }

                const slidesStr = localStorage.getItem(STORAGE_KEY);
                if (slidesStr) this.slides = sanitizeDeckSchema(JSON.parse(slidesStr));

                const metaStr = localStorage.getItem(META_KEY);
                if (metaStr) {
                    const meta = JSON.parse(metaStr);
                    if (meta && typeof meta === 'object') {
                        this.currentDeckId = meta.id || null;
                        this.currentDeckTitle = (typeof meta.title === 'string' && meta.title.trim()) ? meta.title.trim() : 'Untitled Deck';
                        this.hasUnsavedChanges = Boolean(meta.unsaved);
                    }
                }
            } catch (e) {
                console.warn('Could not parse local deck storage:', e);
            }
        },

        async syncFromCloudOnInit() {
            const badge = document.getElementById('sync-badge');
            const drawerPill = document.getElementById('library-cloud-pill');

            if (typeof requireAuth !== 'function' || typeof loadProgress !== 'function') {
                if (badge) badge.textContent = 'Local Mode';
                if (drawerPill) drawerPill.textContent = 'Offline / Local Storage';
                return;
            }

            try {
                await requireAuth();
                const user = typeof getCloudUser === 'function' ? await getCloudUser() : null;
                if (!user) {
                    if (badge) badge.textContent = 'Guest Local';
                    if (drawerPill) drawerPill.textContent = 'Local Storage Ready';
                    return;
                }

                if (badge) badge.textContent = 'Cloud Synced';
                if (drawerPill) drawerPill.textContent = 'Synced to KlassKit Cloud';

                const cloudData = await loadProgress('presentation_data');
                if (!cloudData || typeof cloudData !== 'object') return;

                let changed = false;

                // Merge libraries safely by deck id, keeping newer updated timestamps
                if (Array.isArray(cloudData.library)) {
                    const cloudLib = sanitizeLibrary(cloudData.library);
                    const mergedMap = new Map();
                    this.library.forEach((d) => mergedMap.set(d.id, d));
                    cloudLib.forEach((cd) => {
                        const existing = mergedMap.get(cd.id);
                        if (!existing || cd.updated > existing.updated) {
                            mergedMap.set(cd.id, cd);
                            changed = true;
                        }
                    });
                    this.library = Array.from(mergedMap.values()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
                    this.persistLibraryLocal();
                }

                // Merge cloud images (non-local) into Image Manager
                if (Array.isArray(cloudData.images)) {
                    const cloudImgs = sanitizeImageLibrary(cloudData.images);
                    cloudImgs.forEach((ci) => {
                        if (!this.imageLibrary.some((existing) => existing.src === ci.src)) {
                            this.imageLibrary.push(ci);
                            changed = true;
                        }
                    });
                    if (changed) this.persistImageLibraryLocal();
                }

                // Adopt cloud workspace only if local workspace is empty/pristine
                const localIsDefaultEmpty = this.slides.length <= 1 &&
                    !this.slides[0]?.text?.trim() &&
                    !this.slides[0]?.image &&
                    !this.hasUnsavedChanges;

                if (localIsDefaultEmpty && Array.isArray(cloudData.slides) && cloudData.slides.length > 0) {
                    this.slides = sanitizeDeckSchema(cloudData.slides);
                    this.registerImagesFromSlides(this.slides, 'Cloud Slide');
                    if (cloudData.meta) {
                        this.currentDeckId = cloudData.meta.id || null;
                        this.currentDeckTitle = cloudData.meta.title || 'Untitled Deck';
                        this.hasUnsavedChanges = Boolean(cloudData.meta.unsaved);
                    }
                    this.persistWorkspaceLocal();
                    changed = true;
                }

                if (changed) {
                    this.render();
                    this.renderLibrary();
                }
            } catch (e) {
                console.warn('Cloud sync deferred to local mode:', e);
                if (badge) badge.textContent = 'Local Sync';
            }
        },

        setupListeners() {
            const imgInput = document.getElementById('imageInput');
            if (imgInput) {
                imgInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file && this.activeUploadIndex !== null) {
                        this.handleImageFile(file, this.activeUploadIndex);
                    }
                    e.target.value = '';
                });
            }

            const importInput = document.getElementById('importInput');
            if (importInput) {
                importInput.addEventListener('change', (e) => this.processImport(e.target));
            }

            const bulkImgInput = document.getElementById('bulkImagesInput');
            if (bulkImgInput) {
                bulkImgInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length) {
                        this.addBulkImageFiles(e.target.files);
                    }
                    e.target.value = '';
                });
            }

            const bulkDropzone = document.getElementById('bulk-img-dropzone');
            if (bulkDropzone) {
                bulkDropzone.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.triggerBulkImagesBrowse();
                    }
                });
                bulkDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    bulkDropzone.classList.add('drag-active');
                });
                bulkDropzone.addEventListener('dragleave', (e) => {
                    if (!e.relatedTarget || !bulkDropzone.contains(e.relatedTarget)) {
                        bulkDropzone.classList.remove('drag-active');
                    }
                });
                bulkDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    bulkDropzone.classList.remove('drag-active');
                    if (this.bulkImageImporting) return;
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                        this.addBulkImageFiles(e.dataTransfer.files);
                    }
                });
            }

            const imgGalleryEl = document.getElementById('img-mgr-gallery');
            if (imgGalleryEl) {
                imgGalleryEl.addEventListener('click', (e) => {
                    const card = e.target.closest('[data-asset-id]');
                    if (!card) return;
                    const assetId = card.getAttribute('data-asset-id');
                    const actionEl = e.target.closest('[data-gallery-action]');

                    if (actionEl) {
                        e.stopPropagation();
                        const action = actionEl.getAttribute('data-gallery-action');
                        if (action === 'delete') {
                            this.deleteManagedImage(assetId);
                        } else if (action === 'use') {
                            this.pickManagedImageForSlide(assetId);
                        } else if (action === 'toggle-select') {
                            this.toggleManagedImageSelection(assetId);
                        }
                        return;
                    }

                    if (this.imageManagerTargetSlide !== null) {
                        this.pickManagedImageForSlide(assetId);
                    } else {
                        this.toggleManagedImageSelection(assetId);
                    }
                });
            }

            const bulkQueueEl = document.getElementById('bulk-img-queue');
            if (bulkQueueEl) {
                bulkQueueEl.addEventListener('click', (e) => {
                    const actionBtn = e.target.closest('[data-bulk-img-action]');
                    const itemEl = e.target.closest('[data-bulk-img-idx]');
                    if (!actionBtn || !itemEl) return;
                    const idx = parseInt(itemEl.getAttribute('data-bulk-img-idx'), 10);
                    const action = actionBtn.getAttribute('data-bulk-img-action');
                    if (Number.isNaN(idx)) return;
                    if (action === 'move-prev') this.moveBulkImageItem(idx, -1);
                    else if (action === 'move-next') this.moveBulkImageItem(idx, 1);
                    else if (action === 'remove') this.removeBulkImageItem(idx);
                });
                bulkQueueEl.addEventListener('input', (e) => {
                    if (!e.target.matches('[data-bulk-img-caption]')) return;
                    const itemEl = e.target.closest('[data-bulk-img-idx]');
                    if (!itemEl) return;
                    const idx = parseInt(itemEl.getAttribute('data-bulk-img-idx'), 10);
                    if (!Number.isNaN(idx)) this.updateBulkImageCaption(idx, e.target.value);
                });
            }

            // Delegated List View Events
            const listContainer = document.getElementById('slides-list-container');
            if (listContainer) {
                listContainer.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-action]');
                    if (actionEl) {
                        const card = actionEl.closest('[data-slide-index]');
                        if (!card) return;
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        const action = actionEl.getAttribute('data-action');
                        if (Number.isNaN(idx)) return;

                        if (action === 'set-layout') {
                            this.updateSlideLayout(idx, actionEl.getAttribute('data-layout'));
                        } else if (action === 'set-theme') {
                            this.updateSlideTheme(idx, actionEl.getAttribute('data-theme-choice'));
                        } else if (action === 'move-up') {
                            this.moveSlide(idx, -1);
                        } else if (action === 'move-down') {
                            this.moveSlide(idx, 1);
                        } else if (action === 'present-from') {
                            this.startPresentation(idx);
                        } else if (action === 'duplicate') {
                            this.duplicateSlide(idx);
                        } else if (action === 'delete') {
                            this.deleteSlide(idx);
                        } else if (action === 'add-after') {
                            this.addSlide(idx + 1);
                        } else if (action === 'upload-img') {
                            this.triggerImageUpload(idx);
                        } else if (action === 'pick-img') {
                            this.openImageManagerModal({ targetSlideIndex: idx });
                        } else if (action === 'url-img') {
                            this.openImageUrlModal(idx);
                        } else if (action === 'remove-img') {
                            this.removeImage(idx);
                        }
                        return;
                    }

                    const card = e.target.closest('[data-slide-index]');
                    if (card) {
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        if (!Number.isNaN(idx)) this.setActiveSlide(idx);
                    }
                });

                listContainer.addEventListener('focusin', (e) => {
                    const card = e.target.closest('[data-slide-index]');
                    if (card) {
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        if (!Number.isNaN(idx) && idx !== this.activeSlideIndex) {
                            this.setActiveSlide(idx);
                        }
                    }
                });

                listContainer.addEventListener('input', (e) => {
                    const card = e.target.closest('[data-slide-index]');
                    if (!card) return;
                    const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (Number.isNaN(idx)) return;

                    if (e.target.matches('[data-field="text"]')) {
                        this.updateSlideText(idx, e.target.value);
                    } else if (e.target.matches('[data-field="notes"]')) {
                        this.updateSlideNotes(idx, e.target.value);
                    }
                });

                listContainer.addEventListener('dragover', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    e.preventDefault();
                    dropzone.classList.add('drag-active');
                });

                listContainer.addEventListener('dragleave', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    if (!e.relatedTarget || !dropzone.contains(e.relatedTarget)) {
                        dropzone.classList.remove('drag-active');
                    }
                });

                listContainer.addEventListener('drop', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    e.preventDefault();
                    dropzone.classList.remove('drag-active');
                    const idx = parseInt(dropzone.getAttribute('data-slide-index'), 10);
                    const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                    if (files.length > 1) {
                        this.openBulkImagesModal(files);
                        return;
                    }
                    if (files[0] && !Number.isNaN(idx)) {
                        this.handleImageFile(files[0], idx);
                    }
                });
            }

            // Delegated Grid View Events
            const gridContainer = document.getElementById('slides-grid-container');
            if (gridContainer) {
                gridContainer.addEventListener('click', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card || this.recentlyDragged) return;
                    const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (Number.isNaN(idx)) return;

                    const actionBtn = e.target.closest('[data-grid-action]');
                    if (actionBtn) {
                        const action = actionBtn.getAttribute('data-grid-action');
                        if (action === 'present') {
                            this.startPresentation(idx);
                        } else if (action === 'edit') {
                            this.activeSlideIndex = idx;
                            this.setView('list');
                            this.scrollToSlide(idx);
                        } else if (action === 'delete') {
                            this.deleteSlide(idx);
                        }
                        return;
                    }

                    this.activeSlideIndex = idx;
                    this.setView('list');
                    this.scrollToSlide(idx);
                });

                gridContainer.addEventListener('dragstart', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    this.dragSourceIndex = parseInt(card.getAttribute('data-slide-index'), 10);
                    card.classList.add('dragging');
                    if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(this.dragSourceIndex));
                    }
                });

                gridContainer.addEventListener('dragover', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    e.preventDefault();
                    gridContainer.querySelectorAll('.grid-card.drag-over').forEach((el) => {
                        if (el !== card) el.classList.remove('drag-over');
                    });
                    card.classList.add('drag-over');
                });

                gridContainer.addEventListener('dragleave', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
                        card.classList.remove('drag-over');
                    }
                });

                gridContainer.addEventListener('drop', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    e.preventDefault();
                    card.classList.remove('drag-over');
                    const targetIdx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (this.dragSourceIndex !== null && !Number.isNaN(targetIdx) && this.dragSourceIndex !== targetIdx) {
                        this.pushHistory('reorder');
                        const [moved] = this.slides.splice(this.dragSourceIndex, 1);
                        this.slides.splice(targetIdx, 0, moved);
                        this.activeSlideIndex = targetIdx;
                        this.recentlyDragged = true;
                        setTimeout(() => { this.recentlyDragged = false; }, 120);
                        this.saveWorkspace();
                        this.render();
                    }
                });

                gridContainer.addEventListener('dragend', () => {
                    this.dragSourceIndex = null;
                    this.recentlyDragged = true;
                    setTimeout(() => { this.recentlyDragged = false; }, 120);
                    gridContainer.querySelectorAll('.grid-card').forEach((c) => c.classList.remove('dragging', 'drag-over'));
                });
            }

            // Delegated Library Drawer Events
            const deckList = document.getElementById('deck-list');
            if (deckList) {
                deckList.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-deck-action]');
                    const item = e.target.closest('[data-deck-id]');
                    if (!item) return;
                    const deckId = item.getAttribute('data-deck-id');
                    if (btn) {
                        e.stopPropagation();
                        const action = btn.getAttribute('data-deck-action');
                        if (action === 'delete') this.deleteDeck(deckId);
                        else if (action === 'duplicate') this.duplicateDeck(deckId);
                        return;
                    }
                    this.loadDeck(deckId);
                });
            }

            // Delegated Templates Modal Events
            const templatesGrid = document.getElementById('templates-grid');
            if (templatesGrid) {
                templatesGrid.addEventListener('click', (e) => {
                    const card = e.target.closest('[data-template-id]');
                    if (!card) return;
                    this.applyTemplate(card.getAttribute('data-template-id'));
                });
            }

            // Clipboard Image Paste (`Ctrl+V` anywhere in workspace)
            document.addEventListener('paste', (e) => this.handleGlobalPaste(e));

            // Fullscreen change listener
            document.addEventListener('fullscreenchange', () => this.syncFullscreenIcon());

            // Flush unsaved workspace cleanly on tab close
            window.addEventListener('beforeunload', () => this.flushPendingSaves());

            // Sync theme button label/icon when another tab updates theme
            window.addEventListener('storage', (e) => {
                if (e && (e.key === 'theme_hub' || e.key === THEME_KEY || e.key === 'klasskit-theme')) {
                    setTimeout(() => this.syncThemeIcons(), 0);
                }
            });

            this.bindGlobalKeys();
        },

        setupBulkImport() {
            if (!window.KlassKitBulkImport || typeof window.KlassKitBulkImport.create !== 'function') return;

            this.bulkImportModal = window.KlassKitBulkImport.create({
                id: 'slides-bulk-import',
                title: 'Bulk Import Slides',
                subtitle: 'Paste slide lines or --- blocks to build your deck fast',
                accentColor: 'pink',
                unitLabel: 'slide',
                unitLabelPlural: 'slides',
                confirmText: 'Import Slides',
                guideItems: [
                    { label: 'Divider', syntax: '---', color: 'pink', desc: 'Separates multi-line slide blocks.' },
                    { label: 'Layout Tag', syntax: '[HERO] / [BULLETS] / [SPLIT]', color: 'blue', desc: 'Optional: [CAPTION] and [FULL] also work.' },
                    { label: 'Slide Theme', syntax: '(blue) / (pink) / (green)', color: 'orange', desc: 'Place right after the layout tag.' },
                    { label: 'Media & Note', syntax: 'IMG: url  |  NOTE: text', color: 'green', desc: 'Add image URL or teacher notes inside a block.' }
                ],
                tips: [
                    '<b>Quick List:</b> Without <code>---</code> or tags, every non-empty line becomes its own Hero slide!',
                    '<b>Pipe Shortcut:</b> Write <code>Caption | https://...</code> on one line for instant Split slides.'
                ],
                placeholder: 'Paste one slide per line OR multi-line blocks with --- ...',
                template: BULK_TEMPLATE_SAMPLE,
                sample: BULK_TEMPLATE_SAMPLE,
                options: [
                    { id: 'onePerLine', label: 'Force one slide per line', defaultChecked: false },
                    { id: 'appendToDeck', label: 'Append to current slides (keep existing)', defaultChecked: true }
                ],
                parse: (text) => {
                    const oneLineBox = document.querySelector('#slides-bulk-import [data-import-opt="onePerLine"]');
                    return parseBulkSlidesText(text, { onePerLine: Boolean(oneLineBox && oneLineBox.checked) });
                },
                onImport: (result, opts) => {
                    if (!result.items || !result.items.length) return false;
                    this.pushHistory('bulk-import');
                    const imported = sanitizeDeckSchema(result.items);
                    this.registerImagesFromSlides(imported, 'Slide');

                    if (opts && opts.appendToDeck) {
                        const startIdx = this.slides.length;
                        // If only slide is blank, replace it cleanly when appending
                        if (this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image) {
                            this.slides = imported;
                            this.activeSlideIndex = 0;
                        } else {
                            this.slides = this.slides.concat(imported);
                            this.activeSlideIndex = startIdx;
                        }
                    } else {
                        const prevSlides = this.slides;
                        this.slides = imported;
                        this.activeSlideIndex = 0;
                        prevSlides.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
                    }

                    this.saveWorkspace();
                    this.render();
                    this.showToast(`Imported ${imported.length} slide${imported.length === 1 ? '' : 's'}!`, 'circle-check', 'success');
                    return true;
                },
                onCopyTemplate: () => {
                    this.showToast('AI-ready slide template copied!', 'clipboard-check', 'blue');
                }
            });

            // Re-run preview automatically when user toggles "Force one slide per line"
            const onePerLineCheckbox = this.bulkImportModal.overlay.querySelector('[data-import-opt="onePerLine"]');
            if (onePerLineCheckbox) {
                onePerLineCheckbox.addEventListener('change', () => this.bulkImportModal.refresh());
            }
        },

        openBulkImport() {
            if (!this.bulkImportModal) {
                this.showToast('Bulk import component unavailable.', 'triangle-alert', 'orange');
                return;
            }
            const appendBox = this.bulkImportModal.overlay.querySelector('[data-import-opt="appendToDeck"]');
            if (appendBox) {
                const hasRealContent = this.slides.some((s) => (s.text && s.text.trim()) || s.image);
                appendBox.checked = hasRealContent;
            }
            this.bulkImportModal.open();
        },

        /* --- THEME & MENUS --- */
        toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            try {
                localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            } catch (e) { }
            this.syncThemeIcons();
        },

        syncThemeIcons() {
            const isDark = document.documentElement.classList.contains('dark');
            const sun = document.getElementById('theme-icon-sun');
            const moon = document.getElementById('theme-icon-moon');
            const label = document.getElementById('theme-label');
            if (sun) sun.classList.toggle('is-hidden', !isDark);
            if (moon) moon.classList.toggle('is-hidden', isDark);
            if (label) label.textContent = isDark ? 'DARK' : 'LIGHT';
        },

        toggleHelp(force) {
            const modal = document.getElementById('help-modal');
            if (!modal) return;
            const open = typeof force === 'boolean' ? force : !modal.classList.contains('open');
            modal.classList.toggle('open', open);
        },

        openModal(id) {
            const el = document.getElementById(id);
            if (el) el.classList.add('open');
        },

        closeModal(id) {
            const el = document.getElementById(id);
            if (el) el.classList.remove('open');
        },

        /* --- UNDO / REDO --- */
        pushHistory(reason) {
            this.pendingTypingSnapshot = false;
            clearTimeout(this.typingHistoryTimer);

            const snapshot = {
                reason: reason || 'edit',
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };

            this.undoStack.push(snapshot);
            if (this.undoStack.length > 40) {
                const evicted = this.undoStack.shift();
                if (evicted && Array.isArray(evicted.slides)) {
                    evicted.slides.forEach((s) => { if (s && s.image) this.cleanupUnreferencedImage(s.image); });
                }
            }
            this.redoStack = [];
            this.updateHistoryButtons();
        },

        markTypingEdit() {
            if (!this.pendingTypingSnapshot) {
                this.pushHistory('typing');
                this.pendingTypingSnapshot = true;
            }
            clearTimeout(this.typingHistoryTimer);
            this.typingHistoryTimer = setTimeout(() => {
                this.pendingTypingSnapshot = false;
            }, 900);
        },

        undo() {
            if (!this.undoStack.length) return;
            const current = {
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };
            this.redoStack.push(current);

            const prev = this.undoStack.pop();
            this.slides = sanitizeDeckSchema(prev.slides);
            this.currentDeckId = prev.currentDeckId;
            this.currentDeckTitle = prev.currentDeckTitle || 'Untitled Deck';
            this.activeSlideIndex = Math.max(0, Math.min(prev.activeSlideIndex || 0, Math.max(0, this.slides.length - 1)));
            this.pendingTypingSnapshot = false;

            this.saveWorkspace();
            this.render();
            this.showToast('Undid last change', 'undo-2', 'blue');
        },

        redo() {
            if (!this.redoStack.length) return;
            const current = {
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };
            this.undoStack.push(current);

            const next = this.redoStack.pop();
            this.slides = sanitizeDeckSchema(next.slides);
            this.currentDeckId = next.currentDeckId;
            this.currentDeckTitle = next.currentDeckTitle || 'Untitled Deck';
            this.activeSlideIndex = Math.max(0, Math.min(next.activeSlideIndex || 0, Math.max(0, this.slides.length - 1)));
            this.pendingTypingSnapshot = false;

            this.saveWorkspace();
            this.render();
            this.showToast('Redid change', 'redo-2', 'blue');
        },

        updateHistoryButtons() {
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');
            if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
            if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
        },

        /* --- TEMPLATES --- */
        renderTemplatesGrid() {
            const container = document.getElementById('templates-grid');
            if (!container) return;

            container.innerHTML = SLIDE_TEMPLATES.map((tpl) => {
                const colorClass = tpl.accent === 'pink'
                    ? 'bg-pink/15 text-pink border-pink/40'
                    : tpl.accent === 'green'
                        ? 'bg-green/15 text-green border-green/40'
                        : tpl.accent === 'orange'
                            ? 'bg-orange/15 text-orange border-orange/40'
                            : 'bg-blue/15 text-blue border-blue/40';

                return `
                    <button type="button" data-template-id="${escapeHTML(tpl.id)}"
                        class="text-left p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border-3 border-dark dark:border-slate-500 shadow-hard-sm hover:-translate-y-0.5 hover:border-blue transition-all cursor-pointer flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-2">
                            <span class="px-2.5 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-wider ${colorClass}">${escapeHTML(tpl.tag)}</span>
                            <span class="text-[11px] font-extrabold text-slate-400">${tpl.slides.length} Slides</span>
                        </div>
                        <div class="flex items-center gap-2.5 mt-0.5">
                            <div class="w-9 h-9 rounded-xl ${colorClass} border-2 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="${escapeHTML(tpl.icon)}" class="w-4 h-4"></i>
                            </div>
                            <h3 class="font-heading font-bold text-base uppercase tracking-tight text-dark dark:text-white leading-tight">${escapeHTML(tpl.title)}</h3>
                        </div>
                        <p class="text-xs font-semibold text-slate-500 dark:text-slate-300 leading-snug">${escapeHTML(tpl.desc)}</p>
                    </button>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        openTemplatesModal() {
            const toggle = document.getElementById('template-append-toggle');
            if (toggle) {
                const hasRealContent = this.slides.some((s) => (s.text && s.text.trim()) || s.image);
                toggle.checked = hasRealContent;
            }
            this.openModal('templates-modal');
        },

        applyTemplate(templateId) {
            const tpl = SLIDE_TEMPLATES.find((t) => t.id === templateId);
            if (!tpl) return;

            this.pushHistory('template');
            const generated = tpl.slides.map((s, idx) => sanitizeSlide({
                ...deepClone(s),
                id: createSlideId() + idx
            }, idx));

            const append = Boolean(document.getElementById('template-append-toggle')?.checked);
            if (append && !(this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image)) {
                const startIdx = this.slides.length;
                this.slides = this.slides.concat(generated);
                this.activeSlideIndex = startIdx;
            } else {
                const prev = this.slides;
                this.slides = generated;
                this.activeSlideIndex = 0;
                if (!this.currentDeckId && (this.currentDeckTitle === 'Untitled Deck' || !this.currentDeckTitle)) {
                    this.currentDeckTitle = tpl.title;
                }
                prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            }

            this.closeModal('templates-modal');
            this.saveWorkspace();
            this.render();
            this.showToast(`Applied "${tpl.title}" (Ctrl+Z to undo)`, 'sparkles', 'success');
        },

        /* --- PERSISTENCE & LIBRARY --- */
        safeLocalSet(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                if (!this._quotaWarned) {
                    this._quotaWarned = true;
                    this.showToast('Local storage is full — export JSON or remove unused decks/images.', 'triangle-alert', 'orange');
                    setTimeout(() => { this._quotaWarned = false; }, 10000);
                }
                return false;
            }
        },

        persistWorkspaceLocal() {
            clearTimeout(this.saveDebounceTimer);
            this.safeLocalSet(STORAGE_KEY, JSON.stringify(this.slides));
            this.safeLocalSet(META_KEY, JSON.stringify({
                id: this.currentDeckId,
                title: this.currentDeckTitle,
                unsaved: this.hasUnsavedChanges
            }));
        },

        persistLibraryLocal() {
            this.safeLocalSet(LIBRARY_KEY, JSON.stringify(this.library));
        },

        persistImageLibraryLocal() {
            this._hasImageLibraryStorage = true;
            this.safeLocalSet(IMAGE_LIBRARY_KEY, JSON.stringify(this.imageLibrary));
        },

        saveWorkspace(immediateCloud = false) {
            this.hasUnsavedChanges = true;
            this.updateDeckHeaderUI();

            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = setTimeout(() => {
                this.persistWorkspaceLocal();
            }, 150);

            if (immediateCloud) {
                this.syncToCloud();
            } else {
                clearTimeout(this.cloudSyncTimer);
                this.cloudSyncTimer = setTimeout(() => this.syncToCloud(), 1800);
            }
        },

        flushPendingSaves() {
            clearTimeout(this.saveDebounceTimer);
            this.persistWorkspaceLocal();
            this.persistLibraryLocal();
            this.persistImageLibraryLocal();
        },

        async syncToCloud() {
            if (typeof saveProgress !== 'function') return;
            try {
                const user = typeof getCloudUser === 'function' ? await getCloudUser() : null;
                if (!user) return;

                const cleanSlides = this.slides.map((s) => ({
                    ...s,
                    image: (s.image && String(s.image).startsWith('klasskit-local:')) ? null : s.image
                }));

                const cleanLibrary = this.library.map((deck) => ({
                    ...deck,
                    slides: (deck.slides || []).map((s) => ({
                        ...s,
                        image: (s.image && String(s.image).startsWith('klasskit-local:')) ? null : s.image
                    }))
                }));

                const cleanImages = this.imageLibrary.filter((img) => img && img.src && !String(img.src).startsWith('klasskit-local:'));

                await saveProgress('presentation_data', {
                    slides: cleanSlides,
                    library: cleanLibrary,
                    images: cleanImages,
                    meta: {
                        id: this.currentDeckId,
                        title: this.currentDeckTitle,
                        unsaved: this.hasUnsavedChanges
                    }
                });
            } catch (e) {
                console.warn('Cloud sync skipped:', e);
            }
        },

        toggleLibrary(force) {
            this.toggleLibraryDrawer(force);
        },

        toggleLibraryDrawer(force) {
            const drawer = document.getElementById('library-drawer');
            if (!drawer) return;
            const open = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
            drawer.classList.toggle('open', open);
            if (open) {
                this.renderLibrary();
                setTimeout(() => {
                    const search = document.getElementById('library-search');
                    if (search) search.focus();
                }, 140);
            }
        },

        openSaveModal() {
            const input = document.getElementById('deck-name-input');
            const copyWrap = document.getElementById('save-as-copy-wrap');
            const copyCheck = document.getElementById('save-as-copy-checkbox');
            const modalTitle = document.getElementById('name-modal-title');

            const isExisting = Boolean(this.currentDeckId && this.library.some((d) => d.id === this.currentDeckId));
            if (modalTitle) modalTitle.textContent = isExisting ? 'Update Deck Details' : 'Save New Deck';
            if (copyWrap) copyWrap.classList.toggle('is-hidden', !isExisting);
            if (copyCheck) copyCheck.checked = false;

            if (input) {
                input.value = (this.currentDeckTitle && this.currentDeckTitle !== 'Untitled Deck')
                    ? this.currentDeckTitle
                    : '';
            }
            this.openModal('name-modal');
            setTimeout(() => {
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 90);
        },

        manualSave() {
            if (this.currentDeckId) {
                const idx = this.library.findIndex((d) => d.id === this.currentDeckId);
                if (idx !== -1) {
                    this.library[idx].slides = deepClone(this.slides);
                    this.library[idx].title = this.currentDeckTitle;
                    this.library[idx].updated = Date.now();
                    this.hasUnsavedChanges = false;
                    this.persistLibraryLocal();
                    this.persistWorkspaceLocal();
                    this.syncToCloud();
                    this.updateDeckHeaderUI();
                    this.renderLibrary();
                    this.showToast(`Saved "${this.currentDeckTitle}"`, 'circle-check', 'success');
                    return;
                }
            }
            this.openSaveModal();
        },

        confirmSaveDeck() {
            const input = document.getElementById('deck-name-input');
            const copyCheck = document.getElementById('save-as-copy-checkbox');
            const rawTitle = (input ? input.value : '').trim();
            const title = (rawTitle || 'Untitled Deck').slice(0, 80);
            const saveAsCopy = Boolean(copyCheck && copyCheck.checked);

            let deckId = this.currentDeckId;
            if (!deckId || saveAsCopy || !this.library.some((d) => d.id === deckId)) {
                deckId = `deck_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            }

            const existingIdx = this.library.findIndex((d) => d.id === deckId);
            const record = {
                id: deckId,
                title,
                slides: deepClone(this.slides),
                updated: Date.now()
            };

            if (existingIdx !== -1) {
                this.library[existingIdx] = record;
            } else {
                this.library.unshift(record);
            }

            this.currentDeckId = deckId;
            this.currentDeckTitle = title;
            this.hasUnsavedChanges = false;

            this.persistLibraryLocal();
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.closeModal('name-modal');
            this.render();
            this.renderLibrary();
            this.showToast(`Deck saved: "${title}"`, 'circle-check', 'success');
        },

        async createNewDeck() {
            if (this.hasUnsavedChanges && this.slides.some((s) => s.text.trim() || s.image)) {
                const ok = await this.showModal('Start New Deck?', 'You have unsaved edits in your current workspace.', 'Start Fresh', 'file-plus');
                if (!ok) return;
            }
            this.pushHistory('new-deck');
            const prev = this.slides;
            this.currentDeckId = null;
            this.currentDeckTitle = 'Untitled Deck';
            this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            this.activeSlideIndex = 0;
            this.hasUnsavedChanges = false;

            prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.toggleLibraryDrawer(false);
            this.render();
            this.renderLibrary();
            this.showToast('Started a fresh deck', 'file-plus', 'blue');
        },

        loadDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;

            this.pushHistory('load-deck');
            this.slides = sanitizeDeckSchema(deepClone(deck.slides || []));
            if (!this.slides.length) {
                this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            }
            this.currentDeckId = deck.id;
            this.currentDeckTitle = deck.title || 'Untitled Deck';
            this.activeSlideIndex = 0;
            this.hasUnsavedChanges = false;

            this.persistWorkspaceLocal();
            this.toggleLibraryDrawer(false);
            this.render();
            this.renderLibrary();
            this.showToast(`Loaded "${this.currentDeckTitle}"`, 'folder-open', 'blue');
        },

        duplicateDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;
            const copy = {
                id: `deck_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                title: `${deck.title} (Copy)`.slice(0, 80),
                slides: deepClone(deck.slides || []),
                updated: Date.now()
            };
            this.library.unshift(copy);
            this.persistLibraryLocal();
            this.syncToCloud();
            this.renderLibrary();
            this.updateDeckHeaderUI();
            this.showToast(`Duplicated "${deck.title}"`, 'copy', 'success');
        },

        async deleteDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;
            const ok = await this.showModal('Delete Saved Deck?', `Permanently delete "${deck.title}" from your Library?`, 'Delete', 'trash-2');
            if (!ok) return;

            const oldSlides = deck.slides || [];
            this.library = this.library.filter((d) => d.id !== deckId);

            if (this.currentDeckId === deckId) {
                this.currentDeckId = null;
                this.hasUnsavedChanges = true;
            }

            oldSlides.forEach((s) => {
                if (s && s.image) this.cleanupUnreferencedImage(s.image);
            });

            this.persistLibraryLocal();
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.renderLibrary();
            this.updateDeckHeaderUI();
            this.showToast(`Deleted "${deck.title}"`, 'trash-2', 'pink');
        },

        renderLibrary() {
            const list = document.getElementById('deck-list');
            const badge = document.getElementById('library-count-badge');
            if (badge) badge.textContent = String(this.library.length);
            if (!list) return;

            const searchEl = document.getElementById('library-search');
            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const filtered = query
                ? this.library.filter((d) => (d.title || '').toLowerCase().includes(query))
                : this.library;

            if (!filtered.length) {
                list.innerHTML = `
                    <div class="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2">
                        <i data-lucide="folder-open" class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto"></i>
                        <p class="text-xs font-extrabold text-slate-400">${query ? 'No decks match your search.' : 'No saved decks yet. Click Save to store your current deck!'}</p>
                    </div>
                `;
                this.safeCreateIcons();
                return;
            }

            list.innerHTML = filtered.map((deck) => {
                const isActive = deck.id === this.currentDeckId;
                const slideCount = Array.isArray(deck.slides) ? deck.slides.length : 0;
                const dateLabel = new Date(deck.updated || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `
                    <div data-deck-id="${escapeHTML(deck.id)}"
                        class="group p-3.5 rounded-2xl border-3 transition-all cursor-pointer flex items-center justify-between gap-2 ${isActive ? 'bg-blue/10 border-blue shadow-hard-sm' : 'bg-white dark:bg-slate-800 border-dark/75 dark:border-slate-600 hover:border-blue'}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                                ${isActive ? '<span class="w-2 h-2 rounded-full bg-blue flex-shrink-0"></span>' : ''}
                                <h3 class="text-sm font-extrabold truncate text-dark dark:text-white">${escapeHTML(deck.title || 'Untitled Deck')}</h3>
                            </div>
                            <p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">${slideCount} slide${slideCount === 1 ? '' : 's'} &middot; Updated ${escapeHTML(dateLabel)}</p>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button type="button" data-deck-action="duplicate" title="Duplicate deck"
                                aria-label="Duplicate deck"
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue hover:bg-blue/10 transition-colors cursor-pointer">
                                <i data-lucide="copy" class="w-4 h-4"></i>
                            </button>
                            <button type="button" data-deck-action="delete" title="Delete deck"
                                aria-label="Delete deck"
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/10 transition-colors cursor-pointer">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        /* --- SLIDE CRUD --- */
        addSlide(atIndex) {
            this.pushHistory('add-slide');
            const slide = sanitizeSlide({
                id: createSlideId(),
                layout: 'hero',
                text: '',
                image: null,
                theme: 'auto',
                notes: ''
            }, this.slides.length);

            let insertIndex = this.slides.length;
            if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= this.slides.length) {
                insertIndex = atIndex;
            }
            this.slides.splice(insertIndex, 0, slide);
            this.activeSlideIndex = insertIndex;

            this.saveWorkspace();
            this.render();
            this.scrollToSlide(insertIndex, true);
        },

        setActiveSlide(index) {
            if (index < 0 || index >= this.slides.length) return;
            this.activeSlideIndex = index;

            // Update card highlight cleanly in DOM without destroying textarea focus
            document.querySelectorAll('#slides-list-container .slide-card').forEach((card) => {
                const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                card.classList.toggle('is-active', idx === index);
            });
            document.querySelectorAll('#slides-grid-container .grid-card').forEach((card) => {
                const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                card.classList.toggle('is-active', idx === index);
            });

            this.updateDeckHeaderUI();
        },

        scrollToSlide(index, focusInput = false) {
            setTimeout(() => {
                const card = document.querySelector(`#slides-list-container .slide-card[data-slide-index="${index}"]`);
                if (card) {
                    if (typeof card.scrollIntoView === 'function') {
                        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    if (focusInput) {
                        const ta = card.querySelector('[data-field="text"]');
                        if (ta) ta.focus();
                    }
                }
            }, 40);
        },

        updateSlideText(index, val) {
            const slide = this.slides[index];
            if (!slide) return;
            this.markTypingEdit();
            slide.text = String(val ?? '').slice(0, 4000);
            this.saveWorkspace();
        },

        updateSlideNotes(index, val) {
            const slide = this.slides[index];
            if (!slide) return;
            this.markTypingEdit();
            slide.notes = String(val ?? '').slice(0, 1500);
            this.saveWorkspace();
        },

        updateSlideLayout(index, layout) {
            const slide = this.slides[index];
            if (!slide || !SLIDE_LAYOUTS[layout] || slide.layout === layout) return;
            this.pushHistory('layout');
            slide.layout = layout;
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        updateSlideTheme(index, theme) {
            const slide = this.slides[index];
            if (!slide || !SLIDE_THEMES.some((t) => t.id === theme) || slide.theme === theme) return;
            this.pushHistory('theme');
            slide.theme = theme;
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        moveSlide(index, delta) {
            const target = index + delta;
            if (target < 0 || target >= this.slides.length) return;
            this.pushHistory('move');
            const [item] = this.slides.splice(index, 1);
            this.slides.splice(target, 0, item);
            this.activeSlideIndex = target;
            this.saveWorkspace();
            this.render();
            this.scrollToSlide(target, false);
        },

        duplicateSlide(index) {
            const src = this.slides[index];
            if (!src) return;
            this.pushHistory('duplicate');
            const copy = sanitizeSlide({
                ...deepClone(src),
                id: createSlideId()
            }, index + 1);
            this.slides.splice(index + 1, 0, copy);
            this.activeSlideIndex = index + 1;
            this.saveWorkspace();
            this.render();
            this.showToast('Slide duplicated!', 'circle-check', 'success');
        },

        deleteSlide(index) {
            if (index < 0 || index >= this.slides.length) return;
            this.pushHistory('delete');
            const [removed] = this.slides.splice(index, 1);
            if (removed && removed.image) {
                this.cleanupUnreferencedImage(removed.image);
            }
            if (!this.slides.length) {
                this.activeSlideIndex = 0;
            } else {
                this.activeSlideIndex = Math.min(index, this.slides.length - 1);
            }
            this.saveWorkspace();
            this.render();
        },

        /* --- MEDIA PIPELINE --- */
        triggerImageUpload(index) {
            this.activeUploadIndex = index;
            const input = document.getElementById('imageInput');
            if (input) input.click();
        },

        openImageUrlModal(index) {
            const slide = this.slides[index];
            if (!slide) return;
            this.activeUrlSlideIndex = index;
            const input = document.getElementById('image-url-input');
            const errEl = document.getElementById('image-url-error');
            if (errEl) errEl.classList.add('is-hidden');
            if (input) {
                input.value = (slide.image && /^https?:\/\//i.test(slide.image)) ? slide.image : '';
            }
            this.openModal('image-url-modal');
            setTimeout(() => { if (input) input.focus(); }, 80);
        },

        applyImageUrl() {
            const input = document.getElementById('image-url-input');
            const errEl = document.getElementById('image-url-error');
            const raw = (input ? input.value : '').trim();
            const safeUrl = sanitizeImageUrl(raw);

            if (!safeUrl || safeUrl.startsWith('klasskit-local:')) {
                if (errEl) errEl.classList.remove('is-hidden');
                return;
            }

            if (errEl) errEl.classList.add('is-hidden');
            const idx = this.activeUrlSlideIndex;
            const slide = this.slides[idx];
            if (!slide) return;

            this.pushHistory('image-url');
            const oldImg = slide.image;
            slide.image = safeUrl;
            this.registerManagedImage({
                src: safeUrl,
                name: slide.text?.trim() ? slide.text.trim().slice(0, 80) : safeUrl,
                caption: slide.text?.trim() || ''
            });
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== safeUrl) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = idx;
            this.closeModal('image-url-modal');
            this.saveWorkspace();
            this.render();
            this.showToast('Image link added!', 'image', 'success');
        },

        async compressImageFile(file) {
            if (!file) return file;
            if (file.type === 'image/gif' || file.size < 120 * 1024) return file;
            if (typeof window.imageCompression === 'function') {
                try {
                    return await window.imageCompression(file, {
                        maxSizeMB: 0.7,
                        maxWidthOrHeight: 1600,
                        useWebWorker: true
                    });
                } catch (e) {
                    return file;
                }
            }
            return file;
        },

        async persistProcessedImageFile(file) {
            const processed = await this.compressImageFile(file);

            let finalRef = null;
            try {
                const user = (typeof getCloudUser === 'function') ? await getCloudUser() : null;
                if (user && typeof uploadMedia === 'function') {
                    finalRef = await uploadMedia(processed, 'presentation_maker', 'slide_img');
                }
            } catch (e) {
                console.warn('Cloud image upload unavailable, using IndexedDB fallback:', e);
            }

            if (!finalRef) {
                const seq = ++this._imgKeySeq;
                const key = `img_${Date.now()}_${seq}_${Math.floor(Math.random() * 1000)}`;
                finalRef = await LocalDB.save(key, processed);
                if (!finalRef && typeof FileReader !== 'undefined') {
                    // Ultra fallback: FileReader dataURL for environments without IndexedDB
                    finalRef = await new Promise((res) => {
                        const fr = new FileReader();
                        fr.onload = () => res(sanitizeImageUrl(String(fr.result || '')));
                        fr.onerror = () => res(null);
                        fr.readAsDataURL(processed);
                    });
                }
            }

            return finalRef;
        },

        async handleImageFile(file, index) {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                this.showToast('Please select an image file.', 'triangle-alert', 'orange');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                this.showToast('Image file exceeds 20MB limit.', 'triangle-alert', 'orange');
                return;
            }
            const slide = this.slides[index];
            if (!slide) return;

            this.showToast('Processing image...', 'loader-circle', 'blue');
            const finalRef = await this.persistProcessedImageFile(file);

            if (!finalRef) {
                this.showToast('Could not save image.', 'circle-alert', 'pink');
                return;
            }

            this.pushHistory('image-upload');
            const oldImg = slide.image;
            slide.image = finalRef;
            this.registerManagedImage({
                src: finalRef,
                name: file.name || `Slide ${index + 1} Image`,
                caption: formatFilenameAsCaption(file.name)
            });
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== finalRef) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
            this.showToast('Image attached!', 'image', 'success');
        },

        removeImage(index) {
            const slide = this.slides[index];
            if (!slide || !slide.image) return;
            this.pushHistory('remove-image');
            const oldImg = slide.image;
            slide.image = null;
            this.cleanupUnreferencedImage(oldImg);
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        /* --- PERSISTENT IMAGE MANAGER & UPLOAD MODAL --- */
        registerManagedImage({ src, name, caption }) {
            const safeSrc = sanitizeImageUrl(src);
            if (!safeSrc) return null;

            const cleanCaption = String(caption || '').trim().slice(0, 200);
            const cleanName = String(name || cleanCaption || '').trim().slice(0, 120);

            const existing = this.imageLibrary.find((img) => img && img.src === safeSrc);
            if (existing) {
                if (cleanCaption && !existing.caption) existing.caption = cleanCaption;
                if (cleanName && (!existing.name || existing.name.startsWith('Saved Image'))) existing.name = cleanName;
                this.persistImageLibraryLocal();
                return existing;
            }

            const record = {
                id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                src: safeSrc,
                name: cleanName || cleanCaption || `Saved Image ${this.imageLibrary.length + 1}`,
                caption: cleanCaption,
                addedAt: Date.now()
            };
            this.imageLibrary.unshift(record);
            if (this.imageLibrary.length > 300) {
                this.imageLibrary.length = 300;
            }
            this.persistImageLibraryLocal();
            return record;
        },

        registerImagesFromSlides(slideList, labelPrefix = 'Slide') {
            if (!Array.isArray(slideList)) return;
            let added = false;
            slideList.forEach((slide, idx) => {
                if (!slide || !slide.image) return;
                const safeSrc = sanitizeImageUrl(slide.image);
                if (!safeSrc || this.imageLibrary.some((img) => img && img.src === safeSrc)) return;
                const cap = (slide.text || '').split('\n')[0].trim().slice(0, 120);
                this.imageLibrary.unshift({
                    id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                    src: safeSrc,
                    name: cap || `${labelPrefix} ${idx + 1} Image`,
                    caption: cap,
                    addedAt: Date.now()
                });
                added = true;
            });
            if (this.imageLibrary.length > 300) {
                this.imageLibrary.length = 300;
            }
            if (added) this.persistImageLibraryLocal();
        },

        syncSlidesIntoImageLibrary() {
            let added = false;
            const addIfMissing = (slide, fallbackLabel) => {
                if (!slide || !slide.image) return;
                const safeSrc = sanitizeImageUrl(slide.image);
                if (!safeSrc || this.imageLibrary.some((img) => img.src === safeSrc)) return;
                const cap = (slide.text || '').split('\n')[0].trim().slice(0, 120);
                this.imageLibrary.push({
                    id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                    src: safeSrc,
                    name: cap || fallbackLabel,
                    caption: cap,
                    addedAt: Date.now()
                });
                added = true;
            };

            this.slides.forEach((s, idx) => addIfMissing(s, `Slide ${idx + 1} Image`));
            this.library.forEach((deck) => {
                (deck.slides || []).forEach((s, idx) => addIfMissing(s, `${deck.title || 'Deck'} #${idx + 1}`));
            });
            if (added) this.persistImageLibraryLocal();
        },

        revokeBulkPreviewUrl(item) {
            if (item && item.previewUrl && String(item.previewUrl).startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
                try { URL.revokeObjectURL(item.previewUrl); } catch (e) { }
            }
        },

        openImageManagerModal(opts = {}) {
            const { targetSlideIndex } = (opts && typeof opts === 'object') ? opts : {};
            const hasTarget = Number.isInteger(targetSlideIndex) && targetSlideIndex >= 0 && targetSlideIndex < this.slides.length;
            this.imageManagerTargetSlide = hasTarget ? targetSlideIndex : null;
            this.selectedManagedImageIds.clear();

            const searchEl = document.getElementById('img-mgr-search');
            if (searchEl) searchEl.value = '';

            this.syncImageManagerHeader();
            this.renderImageManagerGallery();
            this.openModal('image-manager-modal');
        },

        openUploadImageModal(opts = {}) {
            const { targetSlideIndex, initialFiles } = (opts && typeof opts === 'object') ? opts : {};
            const hasTarget = Number.isInteger(targetSlideIndex) && targetSlideIndex >= 0 && targetSlideIndex < this.slides.length;
            this.uploadImageTargetSlide = hasTarget ? targetSlideIndex : null;

            const modeSelect = document.getElementById('bulk-img-mode');
            const urlPanel = document.getElementById('bulk-img-url-panel');
            const urlInput = document.getElementById('bulk-img-urls-input');
            const progressWrap = document.getElementById('bulk-img-progress-wrap');
            const progressBar = document.getElementById('bulk-img-progress-bar');
            const statusEl = document.getElementById('bulk-img-status');

            this.bulkImageImporting = false;
            if (modeSelect) {
                modeSelect.value = hasTarget ? 'append' : 'manager-only';
            }
            if (urlPanel) urlPanel.classList.add('is-hidden');
            if (urlInput) urlInput.value = '';
            if (progressWrap) progressWrap.classList.add('is-hidden');
            if (progressBar) progressBar.style.width = '0%';
            if (statusEl) statusEl.textContent = 'Ready — add images above to save into your Image Manager.';

            this.clearBulkImageQueue();
            if (initialFiles && initialFiles.length) {
                this.addBulkImageFiles(initialFiles);
            } else {
                this.renderBulkImageQueue();
            }

            this.syncUploadImageHeader();
            this.openModal('upload-image-modal');
        },

        openImageManager(opts = {}) {
            if (opts && opts.tab === 'upload') {
                this.openUploadImageModal(opts);
                return;
            }
            this.openImageManagerModal(opts);
        },

        openBulkImagesModal(initialFiles = null) {
            this.openUploadImageModal({ initialFiles });
        },

        closeImageManager() {
            this.imageManagerTargetSlide = null;
            this.selectedManagedImageIds.clear();
            this.closeModal('image-manager-modal');
        },

        closeUploadImageModal() {
            if (this.bulkImageImporting) {
                this.showToast('Please wait for image upload to finish.', 'loader-circle', 'orange');
                return;
            }
            this.clearBulkImageQueue();
            this.uploadImageTargetSlide = null;
            const urlPanel = document.getElementById('bulk-img-url-panel');
            if (urlPanel) urlPanel.classList.add('is-hidden');
            this.closeModal('upload-image-modal');
        },

        closeBulkImagesModal() {
            this.closeUploadImageModal();
        },

        switchToUploadModalFromManager() {
            const targetIdx = this.imageManagerTargetSlide;
            this.closeImageManager();
            this.openUploadImageModal({ targetSlideIndex: targetIdx });
        },

        switchToManagerFromUpload() {
            if (this.bulkImageImporting) return;
            const targetIdx = this.uploadImageTargetSlide;
            this.closeUploadImageModal();
            this.openImageManagerModal({ targetSlideIndex: targetIdx });
        },

        setImageManagerTarget(slideIdx) {
            this.imageManagerTargetSlide = Number.isInteger(slideIdx) ? slideIdx : null;
            this.syncImageManagerHeader();
            this.renderImageManagerGallery();
        },

        syncImageManagerHeader() {
            const titleEl = document.getElementById('img-mgr-title');
            const subEl = document.getElementById('img-mgr-subtitle');
            const bannerEl = document.getElementById('img-mgr-picker-banner');
            const bannerText = document.getElementById('img-mgr-picker-text');
            const selectActions = document.getElementById('img-mgr-select-actions');
            const galleryFooter = document.getElementById('img-mgr-gallery-footer');

            const isPicker = this.imageManagerTargetSlide !== null;
            if (titleEl) {
                titleEl.textContent = isPicker
                    ? `Slide #${this.imageManagerTargetSlide + 1} · Pick Saved Image`
                    : 'Image Manager';
            }
            if (subEl) {
                subEl.textContent = isPicker
                    ? 'Click any saved image below to place it on this slide'
                    : 'Saved images stay safe even when slides are deleted';
            }
            if (bannerEl) bannerEl.classList.toggle('is-hidden', !isPicker);
            if (bannerText && isPicker) {
                bannerText.textContent = `Picking saved image for Slide #${this.imageManagerTargetSlide + 1}.`;
            }
            if (selectActions) selectActions.classList.toggle('is-hidden', isPicker);
            if (galleryFooter) galleryFooter.classList.toggle('is-hidden', isPicker);
        },

        syncUploadImageHeader() {
            const titleEl = document.getElementById('upload-img-title');
            const subEl = document.getElementById('upload-img-subtitle');
            const bannerEl = document.getElementById('upload-img-picker-banner');
            const bannerText = document.getElementById('upload-img-picker-text');

            const isPicker = this.uploadImageTargetSlide !== null;
            if (titleEl) {
                titleEl.textContent = isPicker
                    ? `Upload Image · Slide #${this.uploadImageTargetSlide + 1}`
                    : 'Upload Image';
            }
            if (subEl) {
                subEl.textContent = isPicker
                    ? 'Upload a new photo to attach and save into your Image Manager'
                    : 'Uploaded photos are stored safely in your Image Manager';
            }
            if (bannerEl) bannerEl.classList.toggle('is-hidden', !isPicker);
            if (bannerText && isPicker) {
                bannerText.textContent = `Uploading image for Slide #${this.uploadImageTargetSlide + 1}.`;
            }
        },

        renderImageManagerGallery() {
            const galleryEl = document.getElementById('img-mgr-gallery');
            const searchEl = document.getElementById('img-mgr-search');
            const selStatus = document.getElementById('img-mgr-selection-status');
            const createBtn = document.getElementById('img-mgr-create-slides-btn');
            const delAllBtn = document.getElementById('img-mgr-delete-all-btn');

            if (delAllBtn) delAllBtn.disabled = this.imageLibrary.length === 0;
            if (!galleryEl) return;

            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const items = query
                ? this.imageLibrary.filter((img) =>
                    (img.name || '').toLowerCase().includes(query) ||
                    (img.caption || '').toLowerCase().includes(query))
                : this.imageLibrary;

            const isPicker = this.imageManagerTargetSlide !== null;

            if (!items.length) {
                galleryEl.innerHTML = `
                    <div class="col-span-full p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2.5">
                        <i data-lucide="images" class="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto"></i>
                        <p class="text-xs font-extrabold text-slate-400">
                            ${query ? 'No saved images match your search.' : 'Your Image Manager is empty. Click Upload Image to add photos once and reuse them across slides!'}
                        </p>
                    </div>
                `;
                if (selStatus) selStatus.textContent = '0 selected — saved images persist even if you delete slides';
                if (createBtn) createBtn.disabled = true;
                this.safeCreateIcons();
                return;
            }

            const activeUsageMap = new Map();
            this.slides.forEach((s) => {
                if (s && s.image) activeUsageMap.set(s.image, (activeUsageMap.get(s.image) || 0) + 1);
            });

            galleryEl.innerHTML = items.map((asset) => {
                const isSelected = !isPicker && this.selectedManagedImageIds.has(asset.id);
                const cached = this.getCachedMediaSrc(asset.src);
                const srcAttr = cached ? ` src="${escapeHTML(cached)}" class="is-loaded"` : '';
                const useCount = activeUsageMap.get(asset.src) || 0;
                const label = asset.caption || asset.name || 'Saved Image';

                return `
                    <div class="img-mgr-card cursor-pointer ${isSelected ? 'is-selected' : ''}" data-asset-id="${escapeHTML(asset.id)}">
                        <div class="bulk-img-thumb">
                            <img data-media-src="${escapeHTML(asset.src)}"${srcAttr} alt="${escapeHTML(label)}" />
                            ${useCount > 0 ? `<span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-blue text-white text-[10px] font-heading font-bold">In ${useCount} slide${useCount === 1 ? '' : 's'}</span>` : ''}
                            <button type="button" data-gallery-action="delete" title="Delete from Image Manager" aria-label="Delete saved image"
                                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-pink text-white border border-dark flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                        <div class="p-2.5 flex-1 flex flex-col justify-between gap-2">
                            <p class="text-xs font-extrabold text-dark dark:text-white truncate" title="${escapeHTML(label)}">${escapeHTML(label)}</p>
                            <div class="flex items-center justify-between gap-1.5">
                                ${isPicker ? `
                                    <button type="button" data-gallery-action="use"
                                        class="w-full py-1 px-2 rounded-lg bg-blue text-white text-[11px] font-heading font-bold uppercase tracking-wide hover:brightness-105 transition-all cursor-pointer">
                                        Use on Slide #${this.imageManagerTargetSlide + 1}
                                    </button>
                                ` : `
                                    <button type="button" data-gallery-action="toggle-select"
                                        class="px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer ${isSelected ? 'bg-green text-white border-green' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-slate-300 dark:border-slate-600'}">
                                        ${isSelected ? 'Selected' : 'Select'}
                                    </button>
                                    <button type="button" data-gallery-action="use" title="${this.slides.length ? `Use on active Slide #${this.activeSlideIndex + 1}` : 'Create Slide #1 with this image'}"
                                        class="px-2 py-1 rounded-lg bg-blue/15 text-blue hover:bg-blue hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                        + Slide
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const selCount = this.selectedManagedImageIds.size;
            if (selStatus) {
                selStatus.textContent = selCount > 0
                    ? `${selCount} saved image${selCount === 1 ? '' : 's'} selected`
                    : `${this.imageLibrary.length} saved image${this.imageLibrary.length === 1 ? '' : 's'} — persist even if you delete slides`;
            }
            if (createBtn) {
                createBtn.disabled = selCount === 0;
                const span = createBtn.querySelector('span');
                if (span) span.textContent = selCount > 0 ? `Add ${selCount} to Slides` : 'Add Selected to Slides';
            }

            this.safeCreateIcons();
            this.hydrateMediaElements(galleryEl, 'img-manager');
        },

        pickManagedImageForSlide(assetId, explicitTargetIdx) {
            const record = this.imageLibrary.find((img) => img.id === assetId);
            if (!record) return;

            if (!this.slides.length) this.addSlide();
            const targetIdx = Number.isInteger(explicitTargetIdx)
                ? explicitTargetIdx
                : (this.imageManagerTargetSlide !== null ? this.imageManagerTargetSlide : this.activeSlideIndex);
            const safeIdx = Math.max(0, Math.min(targetIdx, this.slides.length - 1));
            const slide = this.slides[safeIdx];
            if (!slide) return;

            this.pushHistory('pick-managed-image');
            const oldImg = slide.image;
            slide.image = record.src;
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== record.src) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = safeIdx;
            this.saveWorkspace();
            this.closeImageManager();
            this.render();
            this.showToast(`Applied image to Slide #${safeIdx + 1}`, 'image', 'success');
        },

        toggleManagedImageSelection(assetId) {
            if (this.selectedManagedImageIds.has(assetId)) {
                this.selectedManagedImageIds.delete(assetId);
            } else {
                this.selectedManagedImageIds.add(assetId);
            }
            this.renderImageManagerGallery();
        },

        toggleSelectAllManagedImages() {
            const searchEl = document.getElementById('img-mgr-search');
            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const visible = query
                ? this.imageLibrary.filter((img) =>
                    (img.name || '').toLowerCase().includes(query) ||
                    (img.caption || '').toLowerCase().includes(query))
                : this.imageLibrary;

            const allSelected = visible.length > 0 && visible.every((img) => this.selectedManagedImageIds.has(img.id));
            if (allSelected) {
                visible.forEach((img) => this.selectedManagedImageIds.delete(img.id));
            } else {
                visible.forEach((img) => this.selectedManagedImageIds.add(img.id));
            }
            this.renderImageManagerGallery();
        },

        clearManagedImageSelection() {
            this.selectedManagedImageIds.clear();
            this.renderImageManagerGallery();
        },

        createSlidesFromSelectedManagedImages() {
            const chosen = this.imageLibrary.filter((img) => this.selectedManagedImageIds.has(img.id));
            if (!chosen.length) return;

            const layoutVal = document.getElementById('img-mgr-gallery-layout')?.value || 'caption';
            const mode = document.getElementById('img-mgr-gallery-mode')?.value || 'append';
            const layout = ['caption', 'split', 'full'].includes(layoutVal) ? layoutVal : 'caption';

            this.applyImageEntriesToSlides(
                chosen.map((img) => ({ image: img.src, text: img.caption || img.name || '' })),
                { layout, theme: 'auto', mode, reason: 'manager-batch-slides' }
            );

            this.selectedManagedImageIds.clear();
            this.closeImageManager();
            this.saveWorkspace();
            this.render();
            this.showToast(`Added ${chosen.length} slide${chosen.length === 1 ? '' : 's'} from Image Manager!`, 'images', 'success');
        },

        purgeManagedUrls(urlSet) {
            if (!urlSet || !urlSet.size) return;

            let clearedSlide = false;
            this.slides.forEach((s) => {
                if (s && s.image && urlSet.has(s.image)) {
                    s.image = null;
                    clearedSlide = true;
                }
            });

            // Prune permanently deleted URLs from undo/redo snapshots so deleted assets free IDB storage immediately
            [this.undoStack, this.redoStack].forEach((stack) => {
                stack.forEach((snap) => {
                    if (!snap || !Array.isArray(snap.slides)) return;
                    snap.slides.forEach((s) => {
                        if (s && s.image && urlSet.has(s.image)) s.image = null;
                    });
                });
            });

            if (clearedSlide) this.saveWorkspace();
            urlSet.forEach((url) => this.cleanupUnreferencedImage(url));
            this.render();
            this.syncToCloud();

            if (document.getElementById('image-manager-modal')?.classList.contains('open')) {
                this.renderImageManagerGallery();
            }
        },

        async deleteManagedImage(assetId) {
            const idx = this.imageLibrary.findIndex((img) => img.id === assetId);
            if (idx === -1) return;
            const record = this.imageLibrary[idx];
            const inSlidesCount = this.slides.filter((s) => s && s.image === record.src).length;

            const desc = inSlidesCount > 0
                ? `"${record.name}" is used in ${inSlidesCount} active slide${inSlidesCount === 1 ? '' : 's'}. Deleting it permanently removes it from those slides and your Image Manager.`
                : `Permanently delete "${record.name}" from your Image Manager?`;

            const ok = await this.showModal('Delete Saved Image?', desc, 'Delete Image', 'trash-2');
            if (!ok) return;

            this.imageLibrary.splice(idx, 1);
            this.selectedManagedImageIds.delete(assetId);
            this.persistImageLibraryLocal();

            this.purgeManagedUrls(new Set([record.src]));
            this.showToast(`Removed "${record.name}" from Image Manager`, 'trash-2', 'pink');
        },

        async deleteAllManagedImages() {
            const count = this.imageLibrary.length;
            if (!count) return;

            const savedUrls = new Set(this.imageLibrary.map((img) => img && img.src).filter(Boolean));
            const inSlidesCount = this.slides.filter((s) => s && s.image && savedUrls.has(s.image)).length;
            const desc = inSlidesCount > 0
                ? `Permanently delete all ${count} saved image${count === 1 ? '' : 's'}? This will also clear images from ${inSlidesCount} active slide${inSlidesCount === 1 ? '' : 's'}.`
                : `Permanently delete all ${count} saved image${count === 1 ? '' : 's'} from your Image Manager?`;

            const ok = await this.showModal('Delete All Saved Images?', desc, 'Yes, Delete All', 'trash-2');
            if (!ok) return;

            this.imageLibrary = [];
            this.selectedManagedImageIds.clear();
            this.persistImageLibraryLocal();

            this.purgeManagedUrls(savedUrls);
            this.showToast('Deleted all saved images from Image Manager', 'trash-2', 'pink');
        },

        applyImageEntriesToSlides(resolvedEntries, { layout, theme, mode, reason }) {
            this.pushHistory(reason || 'bulk-images');

            const makeSlide = (entry, offset) => sanitizeSlide({
                id: createSlideId() + offset,
                layout,
                theme,
                text: entry.text,
                image: entry.image,
                notes: ''
            }, offset);

            const oldReplacedImages = [];

            if (mode === 'replace') {
                this.slides.forEach((s) => { if (s.image) oldReplacedImages.push(s.image); });
                this.slides = resolvedEntries.map((entry, i) => makeSlide(entry, i));
                this.activeSlideIndex = 0;
            } else if (mode === 'attach') {
                resolvedEntries.forEach((entry, i) => {
                    if (i < this.slides.length) {
                        const existing = this.slides[i];
                        if (existing.image && existing.image !== entry.image) {
                            oldReplacedImages.push(existing.image);
                        }
                        existing.image = entry.image;
                        if (!SLIDE_LAYOUTS[existing.layout]?.usesImage) {
                            existing.layout = layout;
                        }
                        if (!existing.text.trim() && entry.text) {
                            existing.text = entry.text;
                        }
                    } else {
                        this.slides.push(makeSlide(entry, i));
                    }
                });
                this.activeSlideIndex = 0;
            } else {
                const isOnlyEmpty = this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image;
                const generated = resolvedEntries.map((entry, i) => makeSlide(entry, i));
                if (isOnlyEmpty) {
                    this.slides = generated;
                    this.activeSlideIndex = 0;
                } else {
                    const startIdx = this.slides.length;
                    this.slides = this.slides.concat(generated);
                    this.activeSlideIndex = startIdx;
                }
            }

            oldReplacedImages.forEach((url) => this.cleanupUnreferencedImage(url));
        },

        triggerBulkImagesBrowse() {
            if (this.bulkImageImporting) return;
            const input = document.getElementById('bulkImagesInput');
            if (input) input.click();
        },

        toggleBulkImageUrlPanel(force) {
            const panel = document.getElementById('bulk-img-url-panel');
            if (!panel) return;
            const show = typeof force === 'boolean' ? force : panel.classList.contains('is-hidden');
            panel.classList.toggle('is-hidden', !show);
            if (show) {
                const ta = document.getElementById('bulk-img-urls-input');
                if (ta) setTimeout(() => ta.focus(), 60);
            }
        },

        toggleBulkImageUseNames() {
            const useNames = Boolean(document.getElementById('bulk-img-use-names')?.checked);
            this.bulkImageQueue.forEach((item) => {
                if (item.customCaption) return;
                if (item.kind === 'file') {
                    item.caption = useNames ? formatFilenameAsCaption(item.name) : '';
                }
            });
            this.renderBulkImageQueue();
        },

        addBulkImageFiles(fileList) {
            if (this.bulkImageImporting) return;
            const files = Array.from(fileList || []);
            if (!files.length) return;

            const MAX_BATCH = 60;
            const useNames = Boolean(document.getElementById('bulk-img-use-names')?.checked);

            const sorted = files.slice().sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
            );

            let added = 0;
            let skippedInvalid = 0;
            let skippedLimit = 0;

            sorted.forEach((file) => {
                if (!file || !file.type || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
                    skippedInvalid++;
                    return;
                }
                if (this.bulkImageQueue.length >= MAX_BATCH) {
                    skippedLimit++;
                    return;
                }
                const previewUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
                    ? URL.createObjectURL(file)
                    : null;

                this.bulkImageQueue.push({
                    id: createSlideId() + added,
                    kind: 'file',
                    file,
                    name: file.name || `Image ${this.bulkImageQueue.length + 1}`,
                    url: null,
                    previewUrl,
                    caption: useNames ? formatFilenameAsCaption(file.name) : '',
                    customCaption: false
                });
                added++;
            });

            if (skippedInvalid > 0) {
                this.showToast(`Skipped ${skippedInvalid} non-image or >20MB file(s).`, 'triangle-alert', 'orange');
            }
            if (skippedLimit > 0) {
                this.showToast(`Queue limit reached (${MAX_BATCH} images max).`, 'triangle-alert', 'orange');
            }
            if (added > 0) {
                const statusEl = document.getElementById('bulk-img-status');
                if (statusEl) statusEl.textContent = `Staged ${this.bulkImageQueue.length} image${this.bulkImageQueue.length === 1 ? '' : 's'} ready to import.`;
            }
            this.renderBulkImageQueue();
        },

        addBulkImageUrls() {
            if (this.bulkImageImporting) return;
            const ta = document.getElementById('bulk-img-urls-input');
            if (!ta) return;

            const MAX_BATCH = 60;
            const { entries, invalidCount } = parseBulkImageUrls(ta.value);
            let added = 0;
            let skippedLimit = 0;

            entries.forEach((entry) => {
                if (this.bulkImageQueue.length >= MAX_BATCH) {
                    skippedLimit++;
                    return;
                }
                this.bulkImageQueue.push({
                    id: createSlideId() + added,
                    kind: 'url',
                    file: null,
                    name: entry.caption || entry.url,
                    url: entry.url,
                    previewUrl: entry.url,
                    caption: entry.caption || '',
                    customCaption: Boolean(entry.caption)
                });
                added++;
            });

            if (added > 0) {
                ta.value = '';
                this.toggleBulkImageUrlPanel(false);
                const statusEl = document.getElementById('bulk-img-status');
                if (statusEl) statusEl.textContent = `Staged ${this.bulkImageQueue.length} image${this.bulkImageQueue.length === 1 ? '' : 's'} ready to import.`;
            }
            if (invalidCount > 0) {
                this.showToast(`Skipped ${invalidCount} invalid or unsupported URL(s).`, 'triangle-alert', 'orange');
            } else if (skippedLimit > 0) {
                this.showToast(`Queue limit reached (${MAX_BATCH} images max).`, 'triangle-alert', 'orange');
            } else if (added === 0) {
                this.showToast('Paste at least one valid https:// image link.', 'info', 'blue');
            }

            this.renderBulkImageQueue();
        },

        updateBulkImageCaption(idx, val) {
            const item = this.bulkImageQueue[idx];
            if (!item) return;
            item.caption = String(val ?? '').slice(0, 500);
            item.customCaption = true;
        },

        moveBulkImageItem(idx, delta) {
            if (this.bulkImageImporting) return;
            const target = idx + delta;
            if (idx < 0 || idx >= this.bulkImageQueue.length || target < 0 || target >= this.bulkImageQueue.length) return;
            const [item] = this.bulkImageQueue.splice(idx, 1);
            this.bulkImageQueue.splice(target, 0, item);
            this.renderBulkImageQueue();
        },

        removeBulkImageItem(idx) {
            if (this.bulkImageImporting) return;
            if (idx < 0 || idx >= this.bulkImageQueue.length) return;
            const [removed] = this.bulkImageQueue.splice(idx, 1);
            this.revokeBulkPreviewUrl(removed);
            this.renderBulkImageQueue();
        },

        sortBulkImageQueue() {
            if (this.bulkImageImporting || this.bulkImageQueue.length < 2) return;
            this.bulkImageQueue.sort((a, b) => {
                const aKey = String(a.name || a.caption || '');
                const bKey = String(b.name || b.caption || '');
                return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
            });
            this.renderBulkImageQueue();
        },

        clearBulkImageQueue() {
            if (this.bulkImageImporting) return;
            this.bulkImageQueue.forEach((item) => this.revokeBulkPreviewUrl(item));
            this.bulkImageQueue = [];
            this.renderBulkImageQueue();
        },

        renderBulkImageQueue() {
            const queueEl = document.getElementById('bulk-img-queue');
            const countEl = document.getElementById('bulk-img-queue-count');
            const confirmBtn = document.getElementById('bulk-img-confirm-btn');
            const confirmLabel = document.getElementById('bulk-img-confirm-label');
            const mode = document.getElementById('bulk-img-mode')?.value || 'manager-only';

            const count = this.bulkImageQueue.length;
            if (countEl) countEl.textContent = `${count} image${count === 1 ? '' : 's'} queued`;
            if (confirmBtn) confirmBtn.disabled = count === 0 || this.bulkImageImporting;
            if (confirmLabel) {
                if (this.uploadImageTargetSlide !== null && count === 1 && mode !== 'manager-only') {
                    confirmLabel.textContent = `Save & Use on Slide #${this.uploadImageTargetSlide + 1}`;
                } else {
                    confirmLabel.textContent = count > 0 ? `Upload ${count} Image${count === 1 ? '' : 's'}` : 'Upload Images';
                }
            }

            if (!queueEl) return;
            if (!count) {
                queueEl.innerHTML = `
                    <div class="col-span-full p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-400">
                        No images queued yet. Drop files above or paste URLs to stage them for upload.
                    </div>
                `;
                this.safeCreateIcons();
                return;
            }

            queueEl.innerHTML = this.bulkImageQueue.map((item, idx) => {
                const thumbHtml = item.previewUrl
                    ? `<img src="${escapeHTML(item.previewUrl)}" alt="${escapeHTML(item.name || `Image ${idx + 1}`)}" />`
                    : `<div class="w-full h-full flex items-center justify-center text-slate-400"><i data-lucide="image" class="w-6 h-6"></i></div>`;

                return `
                    <div class="bulk-img-item" data-bulk-img-idx="${idx}">
                        <div class="bulk-img-thumb">
                            ${thumbHtml}
                            <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-dark/85 text-white text-[10px] font-heading font-bold">#${idx + 1}</span>
                            <button type="button" data-bulk-img-action="remove" title="Remove from queue" aria-label="Remove image ${idx + 1}"
                                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-pink text-white border border-dark flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                        <div class="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                            <input type="text" data-bulk-img-caption value="${escapeHTML(item.caption || '')}"
                                placeholder="Image label / caption (optional)" class="bulk-img-caption" />
                            <div class="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-400">
                                <span class="truncate" title="${escapeHTML(item.name || '')}">${escapeHTML(item.name || '')}</span>
                                <div class="flex items-center gap-0.5 flex-shrink-0">
                                    <button type="button" data-bulk-img-action="move-prev" ${idx === 0 ? 'disabled' : ''} title="Move earlier"
                                        aria-label="Move earlier" class="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer">
                                        <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button type="button" data-bulk-img-action="move-next" ${idx === count - 1 ? 'disabled' : ''} title="Move later"
                                        aria-label="Move later" class="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer">
                                        <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        async confirmBulkImageImport() {
            if (this.bulkImageImporting || !this.bulkImageQueue.length) return;

            const mode = document.getElementById('bulk-img-mode')?.value || 'manager-only';

            const progressWrap = document.getElementById('bulk-img-progress-wrap');
            const progressBar = document.getElementById('bulk-img-progress-bar');
            const statusEl = document.getElementById('bulk-img-status');
            const confirmBtn = document.getElementById('bulk-img-confirm-btn');

            this.bulkImageImporting = true;
            if (confirmBtn) confirmBtn.disabled = true;
            if (progressWrap) progressWrap.classList.remove('is-hidden');

            const total = this.bulkImageQueue.length;
            const resolvedEntries = [];
            let failedCount = 0;

            for (let i = 0; i < total; i++) {
                const item = this.bulkImageQueue[i];
                if (statusEl) statusEl.textContent = `Processing ${i + 1} / ${total}: ${item.name || 'image'}...`;
                if (progressBar) progressBar.style.width = `${Math.round(((i + 0.35) / total) * 100)}%`;

                let imageRef = null;
                if (item.kind === 'file' && item.file) {
                    imageRef = await this.persistProcessedImageFile(item.file);
                } else if (item.kind === 'url' && item.url) {
                    imageRef = sanitizeImageUrl(item.url);
                }

                if (imageRef) {
                    const captionText = String(item.caption || '').trim();
                    this.registerManagedImage({
                        src: imageRef,
                        name: item.name || captionText || `Image ${i + 1}`,
                        caption: captionText
                    });
                    resolvedEntries.push({
                        image: imageRef,
                        text: captionText
                    });
                } else {
                    failedCount++;
                }

                if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
            }

            this.bulkImageImporting = false;

            if (!resolvedEntries.length) {
                if (confirmBtn) confirmBtn.disabled = false;
                if (statusEl) statusEl.textContent = 'Upload failed — no images could be saved.';
                this.showToast('Could not upload any images.', 'circle-alert', 'pink');
                return;
            }

            if (this.uploadImageTargetSlide !== null && resolvedEntries.length === 1 && mode !== 'manager-only') {
                const targetIdx = Math.max(0, Math.min(this.uploadImageTargetSlide, this.slides.length - 1));
                const slide = this.slides[targetIdx];
                if (slide) {
                    this.pushHistory('upload-slide-image');
                    const oldImg = slide.image;
                    slide.image = resolvedEntries[0].image;
                    if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                        slide.layout = 'split';
                    }
                    if (!slide.text.trim() && resolvedEntries[0].text) {
                        slide.text = resolvedEntries[0].text;
                    }
                    if (oldImg && oldImg !== resolvedEntries[0].image) {
                        this.cleanupUnreferencedImage(oldImg);
                    }
                    this.activeSlideIndex = targetIdx;
                    this.clearBulkImageQueue();
                    this.closeUploadImageModal();
                    this.saveWorkspace();
                    this.render();
                    this.showToast(`Saved to Manager & attached to Slide #${targetIdx + 1}!`, 'image', 'success');
                    return;
                }
            }

            if (mode === 'manager-only') {
                const targetIdx = this.uploadImageTargetSlide;
                this.clearBulkImageQueue();
                this.closeUploadImageModal();
                this.updateDeckHeaderUI();
                this.syncToCloud();
                this.openImageManagerModal({ targetSlideIndex: targetIdx });
                const warnSuffix = failedCount > 0 ? ` (${failedCount} failed)` : '';
                this.showToast(
                    `Saved ${resolvedEntries.length} image${resolvedEntries.length === 1 ? '' : 's'} to Image Manager${warnSuffix}!`,
                    failedCount > 0 ? 'triangle-alert' : 'images',
                    failedCount > 0 ? 'orange' : 'success'
                );
                return;
            }

            const defaultLayout = resolvedEntries.some((entry) => entry.text) ? 'caption' : 'full';
            this.applyImageEntriesToSlides(resolvedEntries, { layout: defaultLayout, theme: 'auto', mode, reason: 'bulk-images' });
            this.clearBulkImageQueue();
            this.closeUploadImageModal();
            this.saveWorkspace();
            this.render();

            const warnSuffix = failedCount > 0 ? ` (${failedCount} failed)` : '';
            this.showToast(
                `Uploaded ${resolvedEntries.length} image${resolvedEntries.length === 1 ? '' : 's'}${warnSuffix}!`,
                failedCount > 0 ? 'triangle-alert' : 'images',
                failedCount > 0 ? 'orange' : 'success'
            );
        },

        isImageStillReferenced(url) {
            if (!url) return false;
            if (this.imageLibrary.some((img) => img && img.src === url)) return true;
            if (this.slides.some((s) => s && s.image === url)) return true;
            if (this.library.some((deck) => Array.isArray(deck.slides) && deck.slides.some((s) => s && s.image === url))) return true;
            if (this.undoStack.some((snap) => Array.isArray(snap.slides) && snap.slides.some((s) => s && s.image === url))) return true;
            return this.redoStack.some((snap) => Array.isArray(snap.slides) && snap.slides.some((s) => s && s.image === url));
        },

        cleanupUnreferencedImage(url) {
            if (!url || this.isImageStillReferenced(url)) return;
            if (String(url).startsWith('klasskit-local:')) {
                const cached = this.blobUrlCache.get(url);
                if (cached) {
                    try { URL.revokeObjectURL(cached); } catch (e) { }
                    this.blobUrlCache.delete(url);
                }
                LocalDB.delete(url.replace('klasskit-local:', ''));
                return;
            }
            if (typeof deleteMediaFromUrl === 'function' && !/^https?:\/\//i.test(url) && !/^data:/i.test(url)) {
                try { deleteMediaFromUrl(url); } catch (e) { }
            }
        },

        getCachedMediaSrc(url) {
            if (!url) return null;
            const s = String(url);
            if (s.startsWith('klasskit-local:')) {
                return this.blobUrlCache.get(s) || null;
            }
            if (/^(https?:\/\/|data:image\/|blob:)/i.test(s)) {
                return s;
            }
            return null;
        },

        async resolveAnyMedia(url) {
            if (!url) return null;
            const syncHit = this.getCachedMediaSrc(url);
            if (syncHit) return syncHit;
            const s = String(url);
            if (this._pendingMediaResolutions.has(s)) {
                return this._pendingMediaResolutions.get(s);
            }

            const promise = (async () => {
                if (s.startsWith('klasskit-local:')) {
                    const cached = this.blobUrlCache.get(s);
                    if (cached) return cached;
                    const key = s.replace('klasskit-local:', '');
                    const blob = await LocalDB.get(key);
                    if (!blob) return null;
                    const cachedAfter = this.blobUrlCache.get(s);
                    if (cachedAfter) return cachedAfter;
                    const objUrl = URL.createObjectURL(blob);
                    this.blobUrlCache.set(s, objUrl);
                    return objUrl;
                }
                if (typeof resolveMediaUrl === 'function') {
                    try {
                        return await resolveMediaUrl(s);
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            })();

            this._pendingMediaResolutions.set(s, promise);
            try {
                return await promise;
            } finally {
                this._pendingMediaResolutions.delete(s);
            }
        },

        async hydrateMediaElements(rootEl = document, scopeKey = 'workspace') {
            const token = (this.hydrateTokens.get(scopeKey) || 0) + 1;
            this.hydrateTokens.set(scopeKey, token);

            const imgs = Array.from(rootEl.querySelectorAll('img[data-media-src]'));
            await Promise.all(imgs.map(async (img) => {
                const rawSrc = img.getAttribute('data-media-src');
                if (!rawSrc) return;
                const resolved = await this.resolveAnyMedia(rawSrc);
                if (this.hydrateTokens.get(scopeKey) !== token) return;
                if (resolved) {
                    if (img.src !== resolved) img.src = resolved;
                    img.classList.add('is-loaded');
                }
            }));
        },

        handleGlobalPaste(e) {
            if (this.isPresenting) return;
            const uploadModalOpen = document.getElementById('upload-image-modal')?.classList.contains('open');
            const imgMgrOpen = document.getElementById('image-manager-modal')?.classList.contains('open');
            const openModal = document.querySelector('.modal-overlay.open, .drawer-overlay.open, .kk-import-overlay.open');
            if (openModal && !uploadModalOpen && !imgMgrOpen) return;

            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;

            const imageFiles = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.startsWith('image/')) {
                    const f = items[i].getAsFile();
                    if (f) imageFiles.push(f);
                }
            }
            if (!imageFiles.length) return;

            e.preventDefault();
            if (uploadModalOpen) {
                this.addBulkImageFiles(imageFiles);
                return;
            }
            if (imgMgrOpen) {
                const targetIdx = this.imageManagerTargetSlide;
                this.closeImageManager();
                this.openUploadImageModal({ targetSlideIndex: targetIdx, initialFiles: imageFiles });
                return;
            }
            if (imageFiles.length > 1) {
                this.openUploadImageModal({ initialFiles: imageFiles });
                return;
            }

            if (!this.slides.length) this.addSlide();
            const targetIdx = Math.max(0, Math.min(this.activeSlideIndex, this.slides.length - 1));
            this.handleImageFile(imageFiles[0], targetIdx);
        },

        /* --- STAGE RENDERER (Shared across Grid & Presentation) --- */
        buildSlideStageHTML(slide, index, mode = 'present') {
            const safeSlide = sanitizeSlide(slide, index);
            const themeKey = resolveSlideTheme(safeSlide.theme, index);
            const rawText = safeSlide.text || '';
            const trimmed = rawText.trim();
            const len = trimmed.length;
            const lenClass = len > 110 ? 'text-len-long' : (len > 42 ? 'text-len-medium' : 'text-len-short');

            const fallbackLabel = mode === 'present' ? '' : 'Your slide text here';
            const displaySafeText = trimmed ? escapeHTML(trimmed) : `<span class="opacity-45">${fallbackLabel}</span>`;

            const renderMediaSlot = (emptyText) => {
                if (safeSlide.image) {
                    const cached = this.getCachedMediaSrc(safeSlide.image);
                    const srcAttr = cached ? ` src="${escapeHTML(cached)}" class="is-loaded"` : '';
                    return `<div class="stage-media-frame"><img data-media-src="${escapeHTML(safeSlide.image)}"${srcAttr} alt="Slide visual" /></div>`;
                }
                return `
                    <div class="stage-media-frame">
                        <div class="stage-media-empty">
                            <i data-lucide="image" class="w-8 h-8"></i>
                            <span>${escapeHTML(emptyText)}</span>
                        </div>
                    </div>
                `;
            };

            let innerHTML = '';

            if (safeSlide.layout === 'bullets') {
                const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
                const heading = lines[0] || (mode === 'present' ? '' : 'Heading Line 1');
                const bulletLines = lines.slice(1).map((l) => l.replace(/^[-*•]+\s*/, ''));
                const bulletsHtml = bulletLines.length
                    ? bulletLines.map((item) => `
                        <li class="stage-bullet-item">
                            <span class="stage-bullet-dot"></span>
                            <span>${escapeHTML(item)}</span>
                        </li>
                    `).join('')
                    : (mode === 'present' ? '' : `
                        <li class="stage-bullet-item opacity-50">
                            <span class="stage-bullet-dot"></span>
                            <span>Add more lines for bullet points</span>
                        </li>
                    `);

                innerHTML = `
                    <div class="stage-layout-bullets">
                        <div class="stage-bullets-title">${escapeHTML(heading)}</div>
                        <ul class="stage-bullets-list">${bulletsHtml}</ul>
                    </div>
                `;
            } else if (safeSlide.layout === 'split') {
                innerHTML = `
                    <div class="stage-layout-split">
                        <div class="stage-split-text">${displaySafeText}</div>
                        ${renderMediaSlot(mode === 'present' ? 'No Image' : 'Add Image')}
                    </div>
                `;
            } else if (safeSlide.layout === 'caption') {
                innerHTML = `
                    <div class="stage-layout-caption">
                        ${renderMediaSlot(mode === 'present' ? 'No Image' : 'Add Image')}
                        ${trimmed || mode !== 'present' ? `<div class="stage-caption-box">${displaySafeText}</div>` : ''}
                    </div>
                `;
            } else if (safeSlide.layout === 'full') {
                innerHTML = `
                    <div class="stage-layout-full">
                        ${renderMediaSlot(mode === 'present' ? 'No Full Image' : 'Upload Full Image')}
                        ${trimmed ? `<div class="stage-full-label">${escapeHTML(trimmed)}</div>` : ''}
                    </div>
                `;
            } else {
                innerHTML = `
                    <div class="stage-layout-hero">
                        <div class="stage-hero-text ${lenClass}">${displaySafeText}</div>
                    </div>
                `;
            }

            return `<div class="stage-surface stage-theme-${themeKey} stage-mode-${mode}">${innerHTML}</div>`;
        },

        /* --- RENDERING (CLASSIC WORKSPACE: LIST & GRID) --- */
        setView(mode) {
            if (mode !== 'list' && mode !== 'grid') return;
            this.viewMode = mode;
            try { localStorage.setItem(VIEW_KEY, mode); } catch (e) { }
            this.render();
        },

        switchView(mode) {
            this.setView(mode);
        },

        updateDeckHeaderUI() {
            const titleEl = document.getElementById('deck-title-label');
            const dotEl = document.getElementById('save-status-dot');
            const countEl = document.getElementById('stat-count');
            const timeEl = document.getElementById('stat-time');
            const badgeEl = document.getElementById('library-count-badge');
            const activePill = document.getElementById('active-slide-pill');
            const deckImgBadge = document.getElementById('deck-img-count-badge');

            if (titleEl) titleEl.textContent = this.currentDeckTitle === 'Untitled Deck' ? 'Unsaved Session' : (this.currentDeckTitle || 'Unsaved Session');
            if (dotEl) {
                dotEl.className = `w-2 h-2 rounded-full flex-shrink-0 ${this.hasUnsavedChanges ? 'bg-orange' : 'bg-green'}`;
                dotEl.title = this.hasUnsavedChanges ? 'Unsaved edits' : 'All changes saved';
            }

            const totalWords = this.slides.reduce((acc, s) => acc + ((s.text || '').trim().split(/\s+/).filter(Boolean).length), 0);
            const mins = this.slides.length ? Math.max(1, Math.ceil((totalWords / 110) + (this.slides.length * 0.4))) : 0;

            if (countEl) countEl.textContent = String(this.slides.length);
            if (timeEl) timeEl.textContent = `${mins}m`;
            if (badgeEl) badgeEl.textContent = String(this.library.length);
            if (activePill) {
                activePill.textContent = this.slides.length
                    ? `Slide ${Math.min(this.activeSlideIndex + 1, this.slides.length)} / ${this.slides.length}`
                    : '0 Slides';
            }

            if (deckImgBadge) deckImgBadge.textContent = String(this.imageLibrary.length);

            this.updateHistoryButtons();
        },

        render() {
            const listEl = document.getElementById('slides-list-container');
            const gridEl = document.getElementById('slides-grid-container');
            const emptyEl = document.getElementById('empty-state');
            const viewListBtn = document.getElementById('view-list');
            const viewGridBtn = document.getElementById('view-grid');

            if (this.activeSlideIndex >= this.slides.length) {
                this.activeSlideIndex = Math.max(0, this.slides.length - 1);
            }

            if (viewListBtn && viewGridBtn) {
                viewListBtn.className = `p-1.5 rounded-lg transition-colors cursor-pointer ${this.viewMode === 'list' ? 'bg-blue text-white' : 'text-slate-500 dark:text-slate-300'}`;
                viewGridBtn.className = `p-1.5 rounded-lg transition-colors cursor-pointer ${this.viewMode === 'grid' ? 'bg-blue text-white' : 'text-slate-500 dark:text-slate-300'}`;
            }

            this.updateDeckHeaderUI();

            if (!this.slides.length) {
                if (listEl) {
                    listEl.innerHTML = '';
                    listEl.classList.add('is-hidden');
                }
                if (gridEl) {
                    gridEl.innerHTML = '';
                    gridEl.classList.add('is-hidden');
                }
                if (emptyEl) emptyEl.classList.remove('is-hidden');
                this.safeCreateIcons();
                return;
            }

            if (emptyEl) emptyEl.classList.add('is-hidden');

            if (this.viewMode === 'list') {
                if (listEl) listEl.classList.remove('is-hidden');
                if (gridEl) gridEl.classList.add('is-hidden');
                this.renderList();
            } else {
                if (listEl) listEl.classList.add('is-hidden');
                if (gridEl) gridEl.classList.remove('is-hidden');
                this.renderGrid();
            }

            this.safeCreateIcons();
            this.hydrateMediaElements(document, 'workspace');
        },

        renderList() {
            const container = document.getElementById('slides-list-container');
            if (!container) return;

            const stripColors = {
                blue: '#1ea7fd',
                pink: '#ff4785',
                green: '#00d063',
                orange: '#ff7e33',
                purple: '#7c4dff',
                dark: '#0f172a',
                light: '#cbd5e1'
            };

            container.innerHTML = this.slides.map((slide, index) => {
                const resolvedTheme = resolveSlideTheme(slide.theme, index);
                const stripHex = stripColors[resolvedTheme] || '#1ea7fd';
                const layoutMeta = SLIDE_LAYOUTS[slide.layout] || SLIDE_LAYOUTS.hero;
                const isActive = index === this.activeSlideIndex;
                const showMediaColumn = layoutMeta.usesImage || Boolean(slide.image);

                const layoutButtons = Object.values(SLIDE_LAYOUTS).map((l) => `
                    <button type="button" data-action="set-layout" data-layout="${escapeHTML(l.id)}" title="${escapeHTML(l.desc)}"
                        class="layout-pill ${slide.layout === l.id ? 'is-selected' : ''}">
                        <i data-lucide="${escapeHTML(l.icon)}" class="w-3.5 h-3.5"></i>
                        <span>${escapeHTML(l.label)}</span>
                    </button>
                `).join('');

                const themeDots = SLIDE_THEMES.map((t) => `
                    <button type="button" data-action="set-theme" data-theme-choice="${escapeHTML(t.id)}"
                        title="Theme: ${escapeHTML(t.label)}" aria-label="Theme ${escapeHTML(t.label)}"
                        style="background: ${t.swatch};"
                        class="theme-dot ${slide.theme === t.id ? 'is-selected' : ''}"></button>
                `).join('');

                const mediaHtml = showMediaColumn ? `
                    <div class="w-full md:w-56 flex-shrink-0 flex flex-col gap-2">
                        <div class="slide-dropzone flex-1 flex flex-col items-center justify-center" data-slide-index="${index}">
                            ${slide.image ? `
                                <div class="slide-thumb">
                                    <img data-media-src="${escapeHTML(slide.image)}"${this.getCachedMediaSrc(slide.image) ? ` src="${escapeHTML(this.getCachedMediaSrc(slide.image))}" class="is-loaded"` : ''} alt="Slide ${index + 1} visual" />
                                    <div class="absolute top-2 right-2 flex items-center gap-1">
                                        <button type="button" data-action="pick-img" title="Swap image from Image Manager" aria-label="Swap image from Image Manager"
                                            class="px-2 h-7 rounded-lg bg-white/90 dark:bg-slate-800/90 text-dark dark:text-white border-2 border-dark shadow-hard-sm flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer hover:border-blue">
                                            <i data-lucide="images" class="w-3 h-3 text-orange"></i>
                                            <span>Swap</span>
                                        </button>
                                        <button type="button" data-action="remove-img" title="Remove from slide (stays in Image Manager)" aria-label="Remove image from slide"
                                            class="w-7 h-7 rounded-lg bg-pink text-white border-2 border-dark shadow-hard-sm flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <div class="p-3 text-center flex flex-col items-center gap-2">
                                    <i data-lucide="image-plus" class="w-6 h-6 text-slate-400"></i>
                                    <p class="text-[11px] font-extrabold text-slate-400 leading-tight">Drop image or pick saved</p>
                                    <div class="flex flex-wrap items-center justify-center gap-1.5">
                                        <button type="button" data-action="pick-img"
                                            class="px-2.5 py-1 rounded-lg bg-orange/15 text-orange hover:bg-orange hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            Manager
                                        </button>
                                        <button type="button" data-action="upload-img"
                                            class="px-2.5 py-1 rounded-lg bg-blue/15 text-blue hover:bg-blue hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            Upload
                                        </button>
                                        <button type="button" data-action="url-img"
                                            class="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-pink hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                            URL
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                ` : '';

                return `
                    <article class="slide-card ${isActive ? 'is-active' : ''}" data-slide-index="${index}">
                        <div class="slide-accent-strip" style="background-color: ${stripHex};"></div>

                        <div class="pl-5 pr-4 py-3.5 space-y-3">
                            <!-- Card Header Row -->
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="px-2.5 py-1 rounded-xl bg-dark dark:bg-slate-700 text-white font-heading font-bold text-xs uppercase tracking-wider">
                                        Slide ${index + 1}
                                    </span>
                                    <div class="flex items-center gap-1 flex-wrap">${layoutButtons}</div>
                                </div>

                                <div class="flex items-center gap-1">
                                    <button type="button" data-action="present-from" title="Present starting from this slide"
                                        aria-label="Present from Slide ${index + 1}"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-pink hover:bg-pink/15 transition-colors cursor-pointer">
                                        <i data-lucide="play" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="move-up" title="Move slide up"
                                        aria-label="Move slide up" ${index === 0 ? 'disabled' : ''}
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors cursor-pointer">
                                        <i data-lucide="chevron-up" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="move-down" title="Move slide down"
                                        aria-label="Move slide down" ${index === this.slides.length - 1 ? 'disabled' : ''}
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors cursor-pointer">
                                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="duplicate" title="Duplicate slide"
                                        aria-label="Duplicate slide"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-blue hover:bg-blue/10 transition-colors cursor-pointer">
                                        <i data-lucide="copy" class="w-4 h-4"></i>
                                    </button>
                                    <button type="button" data-action="delete" title="Delete slide"
                                        aria-label="Delete slide"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-pink hover:bg-pink/10 transition-colors cursor-pointer">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Card Body: Text + Optional Image Dropzone -->
                            <div class="flex flex-col md:flex-row gap-3">
                                <div class="flex-1 min-w-0 flex flex-col gap-2">
                                    <textarea data-field="text" spellcheck="true"
                                        placeholder="${escapeHTML(layoutMeta.placeholder)}"
                                        class="slide-textarea custom-scrollbar">${escapeHTML(slide.text || '')}</textarea>
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div class="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                            <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-orange flex-shrink-0"></i>
                                            <input type="text" data-field="notes" value="${escapeHTML(slide.notes || '')}"
                                                placeholder="Optional teacher speaker note..."
                                                class="slide-notes-input" />
                                        </div>
                                        <div class="flex items-center gap-1.5 pl-1" title="Slide Background Color">
                                            ${themeDots}
                                        </div>
                                    </div>
                                </div>
                                ${mediaHtml}
                            </div>

                            <!-- Quick Insert Slide Divider Button -->
                            <div class="flex items-center justify-between pt-0.5 text-[11px] font-bold text-slate-400">
                                <span>${escapeHTML(layoutMeta.desc)}</span>
                                <button type="button" data-action="add-after"
                                    class="inline-flex items-center gap-1 text-blue hover:underline font-extrabold cursor-pointer">
                                    <i data-lucide="circle-plus" class="w-3.5 h-3.5"></i>
                                    <span>Insert Below</span>
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        },

        renderGrid() {
            const container = document.getElementById('slides-grid-container');
            if (!container) return;

            container.innerHTML = this.slides.map((slide, index) => {
                const isActive = index === this.activeSlideIndex;
                const layoutLabel = SLIDE_LAYOUTS[slide.layout]?.label || 'Hero';
                return `
                    <div class="grid-card ${isActive ? 'is-active' : ''}" draggable="true" data-slide-index="${index}">
                        <div class="grid-thumb-stage">
                            ${this.buildSlideStageHTML(slide, index, 'grid')}
                        </div>
                        <div class="px-3 py-2.5 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="w-6 h-6 rounded-lg bg-dark dark:bg-slate-700 text-white text-[11px] font-heading font-bold flex items-center justify-center flex-shrink-0">${index + 1}</span>
                                <span class="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 truncate">${escapeHTML(layoutLabel)}</span>
                            </div>
                            <div class="flex items-center gap-1 flex-shrink-0">
                                <button type="button" data-grid-action="present" title="Present from Slide ${index + 1}"
                                    aria-label="Present from Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-pink hover:bg-pink/15 cursor-pointer">
                                    <i data-lucide="play" class="w-3.5 h-3.5"></i>
                                </button>
                                <button type="button" data-grid-action="edit" title="Edit Slide ${index + 1}"
                                    aria-label="Edit Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-blue hover:bg-blue/15 cursor-pointer">
                                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                                </button>
                                <button type="button" data-grid-action="delete" title="Delete Slide ${index + 1}"
                                    aria-label="Delete Slide ${index + 1}"
                                    class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/15 cursor-pointer">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },

        /* --- PRESENTATION MODE --- */
        startPresentation(startIndex = 0) {
            if (!this.slides.length) {
                this.showToast('Add at least one slide first!', 'triangle-alert', 'orange');
                return;
            }
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            const safeIdx = Math.max(0, Math.min(Number.isFinite(startIndex) ? startIndex : 0, this.slides.length - 1));
            this.presentIndex = safeIdx;
            this.isPresenting = true;
            this.isBlackout = false;

            const overlay = document.getElementById('presentation-mode');
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.remove('open');
            if (overlay) {
                overlay.classList.add('is-open');
                overlay.setAttribute('aria-hidden', 'false');
            }

            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }

            this.renderShowSlide();
        },

        renderShowSlide(skipStageRebuild = false) {
            const stageContent = document.getElementById('stage-content');
            const counter = document.getElementById('slide-counter');
            const progressBar = document.getElementById('present-progress-bar');
            const notesBanner = document.getElementById('present-notes-banner');
            const notesContent = document.getElementById('present-notes-content');
            const notesDot = document.getElementById('hud-notes-dot');
            const notesBtn = document.getElementById('hud-notes');
            const blackoutBtn = document.getElementById('hud-blackout');

            if (!this.slides.length) {
                this.exitPresentation();
                return;
            }

            this.presentIndex = Math.max(0, Math.min(this.presentIndex, this.slides.length - 1));
            const slide = this.slides[this.presentIndex];

            if (!skipStageRebuild && stageContent) {
                stageContent.innerHTML = this.buildSlideStageHTML(slide, this.presentIndex, 'present');
            }
            if (counter) {
                counter.textContent = `${this.presentIndex + 1} / ${this.slides.length}`;
            }
            if (progressBar) {
                const pct = ((this.presentIndex + 1) / this.slides.length) * 100;
                progressBar.style.width = `${pct}%`;
            }

            const hasNotes = Boolean(slide.notes && slide.notes.trim());
            if (notesDot) notesDot.classList.toggle('is-hidden', !hasNotes);
            if (notesBtn) notesBtn.classList.toggle('is-active', this.showPresentNotes);
            if (blackoutBtn) blackoutBtn.classList.toggle('is-active', this.isBlackout);

            if (notesBanner && notesContent) {
                const visible = this.showPresentNotes && hasNotes && !this.isBlackout;
                notesBanner.classList.toggle('is-hidden', !visible);
                notesContent.textContent = hasNotes ? slide.notes : '';
            }

            if (!skipStageRebuild) {
                this.safeCreateIcons();
                if (stageContent) this.hydrateMediaElements(stageContent, 'present');
            }
        },

        handleStageClick(e) {
            if (this.isBlackout) {
                this.toggleBlackout(false);
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
            if (relX < 0.22) this.prevSlide();
            else this.nextSlide();
        },

        nextSlide() {
            if (this.presentIndex < this.slides.length - 1) {
                this.presentIndex++;
                this.renderShowSlide();
            } else {
                this.showToast('End of deck — press Esc to exit', 'flag', 'blue');
            }
        },

        prevSlide() {
            if (this.presentIndex > 0) {
                this.presentIndex--;
                this.renderShowSlide();
            }
        },

        jumpToSlide(index) {
            if (index >= 0 && index < this.slides.length) {
                this.presentIndex = index;
                this.renderShowSlide();
            }
        },

        toggleBlackout(force) {
            this.isBlackout = typeof force === 'boolean' ? force : !this.isBlackout;
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.toggle('open', this.isBlackout);
            this.renderShowSlide(true);
        },

        toggleNotes(force) {
            this.showPresentNotes = typeof force === 'boolean' ? force : !this.showPresentNotes;
            this.renderShowSlide(true);
        },

        toggleFullScreen() {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => { });
                }
            } else if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            }
        },

        syncFullscreenIcon() {
            const fsBtn = document.getElementById('hud-fullscreen');
            if (!fsBtn) return;
            const iconName = document.fullscreenElement ? 'minimize-2' : 'maximize-2';
            fsBtn.innerHTML = `<i id="hud-fullscreen-icon" data-lucide="${iconName}" class="w-4 h-4"></i>`;
            this.safeCreateIcons();
        },

        exitPresentation() {
            this.isPresenting = false;
            this.isBlackout = false;
            const overlay = document.getElementById('presentation-mode');
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.remove('open');
            if (overlay) {
                overlay.classList.remove('is-open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            }
            // Keep editor active slide synced to whichever slide teacher ended on
            this.activeSlideIndex = Math.max(0, Math.min(this.presentIndex, Math.max(0, this.slides.length - 1)));
            this.render();
        },

        /* --- EXPORT / IMPORT JSON / CLEAR --- */
        exportJSON() {
            const payload = {
                title: this.currentDeckTitle || 'Untitled Deck',
                exportedAt: new Date().toISOString(),
                slides: this.slides
            };
            const jsonStr = JSON.stringify(payload, null, 2);
            const slug = (this.currentDeckTitle || 'slides').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slides';
            const filename = `klasskit_${slug}_${new Date().toISOString().split('T')[0]}.json`;

            const a = document.createElement('a');
            let objectUrl = null;
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
                objectUrl = URL.createObjectURL(blob);
                a.href = objectUrl;
            } else {
                a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
            }
            a.download = filename;
            if (document.body && typeof document.body.appendChild === 'function') {
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                a.click();
            }
            if (objectUrl && typeof URL.revokeObjectURL === 'function') {
                setTimeout(() => {
                    try { URL.revokeObjectURL(objectUrl); } catch (e) { }
                }, 1000);
            }
            this.showToast('JSON deck backup exported!', 'download', 'success');
        },

        triggerImport() {
            const input = document.getElementById('importInput');
            if (input) input.click();
        },

        async processImport(el) {
            const file = el && el.files && el.files[0];
            if (!file) return;

            const confirmed = await this.showModal('Restore JSON Deck?', 'This will replace your active slides with the backup file.', 'Yes, Replace', 'upload');
            if (!confirmed) {
                el.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(String(e.target.result || ''));
                    const rawSlides = Array.isArray(parsed)
                        ? parsed
                        : (parsed && Array.isArray(parsed.slides) ? parsed.slides : null);

                    if (!rawSlides) {
                        this.showToast('Invalid deck JSON structure.', 'triangle-alert', 'orange');
                        return;
                    }

                    this.pushHistory('json-import');
                    const prev = this.slides;
                    this.slides = sanitizeDeckSchema(rawSlides);
                    if (!this.slides.length) {
                        this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
                    }
                    this.registerImagesFromSlides(this.slides, 'Imported');
                    this.currentDeckId = null;
                    if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
                        this.currentDeckTitle = parsed.title.trim().slice(0, 80);
                    } else {
                        this.currentDeckTitle = 'Untitled Deck';
                    }
                    this.activeSlideIndex = 0;
                    prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
                    this.toggleLibraryDrawer(false);
                    this.saveWorkspace();
                    this.render();
                    this.renderLibrary();
                    this.showToast(`Restored ${this.slides.length} slide(s)!`, 'circle-check', 'success');
                } catch (err) {
                    this.showToast('Could not read JSON file.', 'circle-alert', 'pink');
                }
            };
            reader.readAsText(file);
            el.value = '';
        },

        async clear() {
            const confirmed = await this.showModal('Clear Current Slides?', 'All slides in the current workspace will be cleared.', 'Yes, Clear', 'trash-2');
            if (!confirmed) return;

            this.pushHistory('clear');
            const prev = this.slides;
            this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            this.activeSlideIndex = 0;
            prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            this.saveWorkspace();
            this.render();
            this.showToast('Workspace cleared (Ctrl+Z to undo)', 'trash-2', 'pink');
        },

        /* --- CONFIRM DIALOG & TOASTS --- */
        showModal(title, desc, confirmText, icon = 'triangle-alert') {
            if (typeof this._confirmCancel === 'function') {
                this._confirmCancel();
            }
            return new Promise((resolve) => {
                const modal = document.getElementById('custom-modal');
                const titleEl = document.getElementById('modal-title');
                const descEl = document.getElementById('modal-desc');
                const confirmBtn = document.getElementById('modal-confirm');
                const cancelBtn = document.getElementById('modal-cancel');
                const iconWrap = document.getElementById('modal-icon-wrap');

                if (titleEl) titleEl.textContent = title || 'Confirm';
                if (descEl) descEl.textContent = desc || '';
                if (confirmBtn) confirmBtn.textContent = confirmText || 'Confirm';
                if (iconWrap) {
                    iconWrap.innerHTML = `<i id="modal-icon" data-lucide="${escapeHTML(icon || 'triangle-alert')}" class="w-7 h-7"></i>`;
                }

                this.safeCreateIcons();

                const cleanup = (val) => {
                    if (modal) modal.classList.remove('open');
                    if (confirmBtn) confirmBtn.onclick = null;
                    if (cancelBtn) cancelBtn.onclick = null;
                    this._confirmCancel = null;
                    resolve(val);
                };

                this._confirmCancel = () => cleanup(false);
                if (confirmBtn) confirmBtn.onclick = () => cleanup(true);
                if (cancelBtn) cancelBtn.onclick = () => cleanup(false);
                if (modal) modal.classList.add('open');
                setTimeout(() => {
                    if (cancelBtn && typeof cancelBtn.focus === 'function') cancelBtn.focus();
                }, 60);
            });
        },

        showToast(msg, icon = 'info', tone = 'blue') {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const iconMap = {
                success: 'circle-check',
                error: 'circle-alert',
                warning: 'triangle-alert',
                info: 'info'
            };
            const safeIcon = iconMap[icon] || icon || 'info';
            const validTone = ['success', 'pink', 'orange', 'blue'].includes(tone) ? tone : 'blue';

            const toast = document.createElement('div');
            toast.className = `toast-item tone-${validTone}`;
            toast.innerHTML = `<i data-lucide="${escapeHTML(safeIcon)}" class="toast-icon"></i><span>${escapeHTML(msg)}</span>`;
            container.appendChild(toast);
            this.safeCreateIcons();

            requestAnimationFrame(() => toast.classList.add('is-visible'));
            setTimeout(() => {
                toast.classList.remove('is-visible');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 220);
            }, 2600);
        },

        safeCreateIcons() {
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }
        },

        /* --- GLOBAL KEYBOARD SHORTCUTS --- */
        bindGlobalKeys() {
            document.addEventListener('keydown', (e) => {
                // Bulk Import modal owns Escape via its capture listener
                if (document.querySelector('.kk-import-overlay.open')) return;

                // 1. Presentation Mode Controls
                if (this.isPresenting) {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.nextSlide();
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.prevSlide();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        this.jumpToSlide(0);
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        this.jumpToSlide(this.slides.length - 1);
                    } else if (e.key === 'b' || e.key === 'B') {
                        e.preventDefault();
                        this.toggleBlackout();
                    } else if (e.key === 'n' || e.key === 'N') {
                        e.preventDefault();
                        this.toggleNotes();
                    } else if (e.key === 'f' || e.key === 'F') {
                        e.preventDefault();
                        this.toggleFullScreen();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.exitPresentation();
                    }
                    return;
                }

                // 2. Open Modals / Drawer Priority Stack
                const customModal = document.getElementById('custom-modal');
                if (e.key === 'Escape') {
                    if (customModal && customModal.classList.contains('open')) {
                        if (typeof this._confirmCancel === 'function') this._confirmCancel();
                        return;
                    }
                    const uploadImgModal = document.getElementById('upload-image-modal');
                    if (uploadImgModal && uploadImgModal.classList.contains('open')) {
                        this.closeUploadImageModal();
                        return;
                    }
                    const imgMgrModal = document.getElementById('image-manager-modal');
                    if (imgMgrModal && imgMgrModal.classList.contains('open')) {
                        this.closeImageManager();
                        return;
                    }
                    for (const modalId of ['name-modal', 'image-url-modal', 'templates-modal', 'help-modal']) {
                        const m = document.getElementById(modalId);
                        if (m && m.classList.contains('open')) {
                            this.closeModal(modalId);
                            return;
                        }
                    }
                    const drawer = document.getElementById('library-drawer');
                    if (drawer && drawer.classList.contains('open')) {
                        this.toggleLibraryDrawer(false);
                        return;
                    }
                }
                if (customModal && customModal.classList.contains('open')) return;

                if (e.key === 'Enter') {
                    const nameModal = document.getElementById('name-modal');
                    if (nameModal && nameModal.classList.contains('open')) {
                        if (document.activeElement && document.activeElement.id === 'deck-name-input') {
                            e.preventDefault();
                            this.confirmSaveDeck();
                        }
                        return;
                    }
                    const urlModal = document.getElementById('image-url-modal');
                    if (urlModal && urlModal.classList.contains('open')) {
                        if (document.activeElement && document.activeElement.id === 'image-url-input') {
                            e.preventDefault();
                            this.applyImageUrl();
                        }
                        return;
                    }
                }

                if (document.querySelector('.modal-overlay.open, .drawer-overlay.open')) return;

                // 3. Editor Shortcuts
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.manualSave();
                    return;
                }

                if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') {
                    e.preventDefault();
                    this.startPresentation(this.activeSlideIndex);
                    return;
                }

                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                const inTextField = activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && document.activeElement.type !== 'checkbox');

                if (!inTextField && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    this.undo();
                    return;
                }
                if (!inTextField && ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')))) {
                    e.preventDefault();
                    this.redo();
                    return;
                }

                // Reorder active slide quickly with Alt + ArrowUp / ArrowDown
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.viewMode === 'list') {
                    e.preventDefault();
                    this.moveSlide(this.activeSlideIndex, e.key === 'ArrowUp' ? -1 : 1);
                }
            });
        }
    };

    window.app = app;
    window.__presentationMakerDebug = {
        app,
        escapeHTML,
        sanitizeImageUrl,
        sanitizeSlide,
        sanitizeDeckSchema,
        sanitizeLibrary,
        sanitizeImageLibrary,
        resolveSlideTheme,
        parseBulkSlidesText,
        parseBulkImageUrls,
        formatFilenameAsCaption,
        SLIDE_LAYOUTS,
        SLIDE_THEMES,
        SLIDE_TEMPLATES,
        LocalDB
    };

    window.addEventListener('load', () => {
        app.init();
    });
})();

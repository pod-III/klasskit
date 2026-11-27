'use strict';

/* ========================================================
   KLASSKIT SLIDES (PRESENTATION MAKER) - SCRIPT.JS
   Soft Brutalist Chromebook Studio + Dynamic Slide Engine
   ======================================================== */


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

    };

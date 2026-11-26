/* ========================================================
   KLASSKIT NOTES (LESSON NOTE) - SCRIPT.JS
   Soft Brutalist Chromebook Notes + 3-Day Temporary Buffer
   Metadata-First IndexedDB & On-Demand Single-Note Sync
   ======================================================== */

(function () {
    'use strict';

    const DB_NAME = 'LessonNotesDB';
    const DB_VERSION = 2;
    const STORES = {
        IMAGES: 'images',
        NOTES: 'notes',
        SETTINGS: 'settings'
    };

    const THEME_KEY = 'theme_lesson-note';
    const BUFFER_STORAGE_KEY = 'kk_lesson_buffer_v1';
    const INDEX_MIRROR_KEY = 'kk_lesson_notes_index_v1';
    const FOLDERS_MIRROR_KEY = 'kk_lesson_folders_v1';
    const UI_STATE_KEY = 'kk_lesson_ui_v1';
    const FM_LAYOUT_KEY = 'kk_lesson_fm_layout_v1';

    const SETTINGS_KEYS = {
        INDEX: 'notesIndex_v2',
        FOLDERS: 'folders',
        SORT_MODE: 'sortMode',
        LAST_ACTIVE_NOTE: 'lastActiveNoteId'
    };

    const BUFFER_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours
    const TRASH_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
    const PAGE_SIZE = 25;
    const FOLDER_PAGE_SIZE = 20;
    const FM_PAGE_SIZE = 30;
    const MAX_BODY_CACHE = 12;

    const HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    const IMAGE_COMPRESSION_SRC = 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js';

    const FOLDER_COLORS = [
        { name: 'Blue', hex: '#1ea7fd' },
        { name: 'Orange', hex: '#ff7e33' },
        { name: 'Pink', hex: '#ff4785' },
        { name: 'Green', hex: '#00d063' },
        { name: 'Purple', hex: '#7c4dff' },
        { name: 'Teal', hex: '#14b8a6' }
    ];

    /* ========================================================
       PURE UTILITY HELPERS
       ======================================================== */
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function decodeBasicEntities(str) {
        return String(str ?? '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'");
    }

    function fastStripHtml(html) {
        if (!html) return '';
        return decodeBasicEntities(String(html).replace(/<[^>]*>?/gm, ' '))
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractPreview(html, maxLen = 90) {
        const clean = fastStripHtml(html);
        if (!clean) return '';
        return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
    }

    function countWords(text) {
        const clean = String(text || '').trim();
        if (!clean) return { words: 0, readMinutes: 0 };
        const words = clean.split(/\s+/).filter(Boolean).length;
        const readMinutes = words > 0 ? Math.max(1, Math.ceil(words / 200)) : 0;
        return { words, readMinutes };
    }

    function formatTimeRemaining(expiresAt, now = Date.now()) {
        const remaining = Number(expiresAt || 0) - now;
        if (!Number.isFinite(remaining) || remaining <= 0) {
            return { label: 'Expired', urgent: true, expired: true, pctRemaining: 0 };
        }
        const totalMins = Math.ceil(remaining / 60000);
        const days = Math.floor(totalMins / (60 * 24));
        const hours = Math.floor((totalMins % (60 * 24)) / 60);
        const mins = totalMins % 60;

        let label = '';
        if (days > 0) label = `${days}d ${hours}h left`;
        else if (hours > 0) label = `${hours}h ${mins}m left`;
        else if (mins > 1) label = `${mins}m left`;
        else label = '<1m left';

        const urgent = remaining < 12 * 60 * 60 * 1000;
        const pctRemaining = Math.max(0, Math.min(100, Math.round((remaining / BUFFER_TTL_MS) * 100)));
        return { label, urgent, expired: false, pctRemaining };
    }

    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                fn.apply(this, args);
            }, wait);
        };
    }

    function sanitizeNoteHtml(html) {
        if (typeof html !== 'string' || !html) return '';
        return html
            .replace(/<(script|iframe|object|embed|style|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '')
            .replace(/<(script|iframe|object|embed|style|link|meta)[^>]*\/?>/gi, '')
            .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
            .replace(/href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, 'href="#"')
            .replace(/src\s*=\s*(["'])\s*(?:javascript:|data:image\/svg\+xml)[^"']*\1/gi, 'src=""');
    }

    function sanitizeIndexEntry(raw) {
        if (!raw || typeof raw !== 'object' || !raw.id) return null;
        const id = String(raw.id);
        const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
        return {
            id,
            title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
            preview: typeof raw.preview === 'string' ? raw.preview.slice(0, 140) : '',
            folderId: raw.folderId ? String(raw.folderId) : null,
            deleted: Boolean(raw.deleted),
            updatedAt,
            sortOrder: (typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder)) ? raw.sortOrder : null,
            needsCloudFetch: Boolean(raw.needsCloudFetch)
        };
    }

    function sanitizeBufferNote(raw, now = Date.now()) {
        if (!raw || typeof raw !== 'object') return null;
        const createdAt = (typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)) ? raw.createdAt : now;
        const updatedAt = (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) ? raw.updatedAt : createdAt;
        const expiresAt = (typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt))
            ? raw.expiresAt
            : (createdAt + BUFFER_TTL_MS);
        const content = typeof raw.content === 'string' ? raw.content : '';
        return {
            id: raw.id ? String(raw.id) : `buf_${now}_${Math.random().toString(36).slice(2, 7)}`,
            title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
            content,
            preview: typeof raw.preview === 'string' && raw.preview ? raw.preview.slice(0, 140) : extractPreview(content, 90),
            createdAt,
            updatedAt,
            expiresAt
        };
    }

    function sanitizeFoldersList(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        const seen = new Set();
        for (let i = 0; i < raw.length && out.length < 100; i++) {
            const f = raw[i];
            if (!f || typeof f !== 'object' || !f.id) continue;
            const id = String(f.id);
            if (seen.has(id)) continue;
            seen.add(id);
            out.push({
                id,
                name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 80) : 'Untitled Folder',
                color: typeof f.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(f.color) ? f.color : FOLDER_COLORS[out.length % FOLDER_COLORS.length].hex,
                collapsed: Boolean(f.collapsed)
            });
        }
        return out;
    }

    function arrayBufferToBase64(buf) {
        const bytes = new Uint8Array(buf);
        const CHUNK = 0x8000;
        const parts = [];
        for (let i = 0; i < bytes.length; i += CHUNK) {
            parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
        }
        return btoa(parts.join(''));
    }

    function base64ToArrayBuffer(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    }

    const _externalScriptPromises = new Map();
    function loadExternalScript(src, globalCheck) {
        if (typeof globalCheck === 'function' && globalCheck()) {
            return Promise.resolve(true);
        }
        if (_externalScriptPromises.has(src)) {
            return _externalScriptPromises.get(src);
        }
        const promise = new Promise((resolve, reject) => {
            if (typeof document === 'undefined' || !document.createElement) {
                reject(new Error('Document unavailable for dynamic script loading'));
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => {
                _externalScriptPromises.delete(src);
                reject(new Error(`Failed to load script: ${src}`));
            };
            (document.head || document.body || document.documentElement).appendChild(script);
        });
        _externalScriptPromises.set(src, promise);
        return promise;
    }

    /* ========================================================
       METADATA-FIRST INDEXEDDB ENGINE (LessonNotesDB)
       ======================================================== */
    const LessonDB = {
        db: null,
        _openPromise: null,

        open() {
            if (this.db) return Promise.resolve(this.db);
            if (this._openPromise) return this._openPromise;

            this._openPromise = new Promise((resolve, reject) => {
                if (typeof indexedDB === 'undefined') {
                    resolve(null);
                    return;
                }
                try {
                    const req = indexedDB.open(DB_NAME, DB_VERSION);
                    req.onupgradeneeded = (e) => {
                        const upgradeDB = e.target.result;
                        if (!upgradeDB.objectStoreNames.contains(STORES.IMAGES)) {
                            upgradeDB.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
                        }
                        if (!upgradeDB.objectStoreNames.contains(STORES.NOTES)) {
                            upgradeDB.createObjectStore(STORES.NOTES, { keyPath: 'id' });
                        }
                        if (!upgradeDB.objectStoreNames.contains(STORES.SETTINGS)) {
                            upgradeDB.createObjectStore(STORES.SETTINGS);
                        }
                    };
                    req.onsuccess = (e) => {
                        this.db = e.target.result;
                        resolve(this.db);
                    };
                    req.onerror = (e) => reject(e.target?.error || new Error('IndexedDB open failed'));
                } catch (err) {
                    reject(err);
                }
            }).finally(() => {
                this._openPromise = null;
            });

            return this._openPromise;
        },

        async getSetting(key) {
            const dbConn = await this.open();
            if (!dbConn) return undefined;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.SETTINGS, 'readonly');
                const req = tx.objectStore(STORES.SETTINGS).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = (e) => reject(e.target?.error || new Error('getSetting failed'));
            });
        },

        async putSetting(key, value) {
            const dbConn = await this.open();
            if (!dbConn) return;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.SETTINGS, 'readwrite');
                tx.objectStore(STORES.SETTINGS).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('putSetting failed'));
            });
        },

        async getNote(id) {
            const dbConn = await this.open();
            if (!dbConn) return null;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.NOTES, 'readonly');
                const req = tx.objectStore(STORES.NOTES).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = (e) => reject(e.target?.error || new Error('getNote failed'));
            });
        },

        async putNote(note) {
            const dbConn = await this.open();
            if (!dbConn) return;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.NOTES, 'readwrite');
                tx.objectStore(STORES.NOTES).put(note);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('putNote failed'));
            });
        },

        async deleteNote(id) {
            const dbConn = await this.open();
            if (dbConn) {
                await new Promise((resolve, reject) => {
                    const tx = dbConn.transaction(STORES.NOTES, 'readwrite');
                    tx.objectStore(STORES.NOTES).delete(id);
                    tx.oncomplete = () => resolve();
                    tx.onerror = (e) => reject(e.target?.error || new Error('deleteNote failed'));
                });
            }

            // Fire-and-forget cloud delete if authenticated
            try {
                if (typeof getCloudUser === 'function' && typeof db !== 'undefined') {
                    const user = await getCloudUser();
                    if (user && !user.is_sandbox) {
                        Promise.resolve(db.from('notes').delete().eq('id', id).eq('user_id', user.id))
                            .catch((e) => console.warn('Cloud note delete skipped:', e));
                        if (typeof window.deleteFolder === 'function') {
                            Promise.resolve(window.deleteFolder(`${user.id}/lesson_note/${id}`))
                                .catch((e) => console.warn('Cloud folder delete skipped:', e));
                        }
                    }
                }
            } catch (e) {
                console.warn('Cloud delete cleanup skipped:', e);
            }
        },

        async clearAllNotesLocal() {
            const dbConn = await this.open();
            if (!dbConn) return;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.NOTES, 'readwrite');
                tx.objectStore(STORES.NOTES).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('clearAllNotesLocal failed'));
            });
        },

        async buildIndexViaCursor() {
            const dbConn = await this.open();
            if (!dbConn) return [];
            return new Promise((resolve, reject) => {
                const entries = [];
                const tx = dbConn.transaction(STORES.NOTES, 'readonly');
                const store = tx.objectStore(STORES.NOTES);
                const req = store.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) {
                        entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                        resolve(entries);
                        return;
                    }
                    const note = cursor.value;
                    if (note && note.id) {
                        const meta = sanitizeIndexEntry({
                            id: note.id,
                            title: note.title || '',
                            preview: extractPreview(note.content, 90),
                            folderId: note.folderId || null,
                            deleted: Boolean(note.deleted),
                            updatedAt: note.updatedAt || Date.now(),
                            sortOrder: note.sortOrder ?? null,
                            needsCloudFetch: false
                        });
                        if (meta) entries.push(meta);
                    }
                    cursor.continue();
                };
                req.onerror = (e) => reject(e.target?.error || new Error('buildIndexViaCursor failed'));
            });
        },

        async searchBodiesViaCursor(query, isCancelled) {
            const dbConn = await this.open();
            const q = String(query || '').trim().toLowerCase();
            if (!dbConn || !q) return new Map();

            return new Promise((resolve, reject) => {
                const hits = new Map();
                const tx = dbConn.transaction(STORES.NOTES, 'readonly');
                const store = tx.objectStore(STORES.NOTES);
                const req = store.openCursor();
                req.onsuccess = (e) => {
                    if (typeof isCancelled === 'function' && isCancelled()) {
                        resolve(hits);
                        return;
                    }
                    const cursor = e.target.result;
                    if (!cursor) {
                        resolve(hits);
                        return;
                    }
                    const note = cursor.value;
                    if (note && note.id) {
                        const plain = fastStripHtml(note.content);
                        if (plain.toLowerCase().includes(q) || (note.title || '').toLowerCase().includes(q)) {
                            hits.set(String(note.id), extractPreview(plain, 90));
                        }
                    }
                    cursor.continue();
                };
                req.onerror = (e) => reject(e.target?.error || new Error('searchBodiesViaCursor failed'));
            });
        },

        async iterateAllNotesForExport(visitor) {
            const dbConn = await this.open();
            if (!dbConn) return [];
            const notesOut = [];
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.NOTES, 'readonly');
                const store = tx.objectStore(STORES.NOTES);
                const req = store.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) {
                        resolve(notesOut);
                        return;
                    }
                    const note = cursor.value;
                    if (note && note.id) {
                        const clone = { ...note };
                        if (typeof visitor === 'function') visitor(clone);
                        notesOut.push(clone);
                    }
                    cursor.continue();
                };
                req.onerror = (e) => reject(e.target?.error || new Error('iterateAllNotesForExport failed'));
            });
        },

        async putImage(id, arrayBuffer, mimeType) {
            const dbConn = await this.open();
            if (!dbConn) return;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.IMAGES, 'readwrite');
                tx.objectStore(STORES.IMAGES).put({ id, data: arrayBuffer, type: mimeType });
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('putImage failed'));
            });
        },

        async getImage(id) {
            const dbConn = await this.open();
            if (!dbConn) return null;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.IMAGES, 'readonly');
                const req = tx.objectStore(STORES.IMAGES).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = (e) => reject(e.target?.error || new Error('getImage failed'));
            });
        },

        async deleteImage(id) {
            const dbConn = await this.open();
            if (!dbConn) return;
            return new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.IMAGES, 'readwrite');
                tx.objectStore(STORES.IMAGES).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('deleteImage failed'));
            });
        }
    };

    /* ========================================================
       MAIN APPLICATION ENGINE
       ======================================================== */
    const app = {
        mode: 'notes', // 'notes' | 'buffer' | 'trash'
        noteIndex: [],
        bufferNotes: [],
        folders: [],
        noteBodyCache: new Map(),
        visibleCounts: new Map(),
        deepSearchHits: null,
        deepSearchToken: 0,

        currentNoteId: null,
        activeBufferId: null,
        activeFolderId: null,
        sortMode: 'date-desc',

        isDarkMode: false,
        isZenMode: false,
        isOutlineOpen: false,

        quill: null,
        tableToolbarEl: null,
        activeLoadToken: 0,
        isProgrammaticLoad: false,
        hasDirtyEdits: false,

        blobUrlMap: new Map(), // blobUrl -> idbKey
        cloudUrlMap: new Map(), // signedUrl -> originalUrl
        draggedNoteId: null,

        fmState: {
            isOpen: false,
            view: 'root', // 'root' | 'all' | 'unfiled' | 'buffer' | 'trash' | 'folder:<id>'
            layout: 'grid', // 'grid' | 'list'
            search: '',
            sort: 'date-desc',
            visibleLimit: FM_PAGE_SIZE,
            selectedNoteIds: new Set(),
            selectedFolderIds: new Set(),
            lastClickedIndex: null,
            dragNoteIds: []
        },

        noteLinkSearchActive: false,
        noteLinkTriggerIndex: -1,
        noteLinkActiveIndex: 0,

        _confirmCancel: null,
        _promptCancel: null,
        _quotaWarned: false,
        _bufferTimer: null,
        _cloudStatusResetTimer: null,
        _debouncedSave: null,
        _debouncedOutline: null,
        _debouncedListRender: null,
        _initialized: false,

        /* ========================================================
           INITIALIZATION (Instant Boot, Zero Bulk Upfront Loading)
           ======================================================== */
        async init() {
            if (this._initialized) return;
            this._initialized = true;

            this._debouncedSave = debounce(() => this.saveCurrentEditorState(), 800);
            this._debouncedOutline = debounce(() => this.updateOutline(), 1200);
            this._debouncedListRender = debounce(() => this.renderNotesList(), 350);

            this.syncThemeState();
            this.initQuill();
            this.setupListeners();
            this.initCursorTooltips();
            this.ensureNoteLinkPopup();

            // Phase 1: Immediate local UI boot from fast localStorage mirrors + 3-Day Buffer
            this.loadBufferNotes();
            this.purgeExpiredBuffers(false);
            this.loadFastBootMirrors();
            this.updateSortDropdownUI();
            this.renderNotesList();

            this.safeCreateIcons(document);

            // Phase 2: Auth & Single-Note IndexedDB Startup
            try {
                if (typeof requireAuth === 'function') {
                    await requireAuth();
                }
            } catch (e) {
                console.warn('Auth deferred to local mode:', e);
            }

            await LessonDB.open();
            await this.migrateFromLegacyLocalStorage();

            // Read ONLY lightweight index & settings (never getAll full note contents)
            const [storedIndex, storedFolders, storedSort, lastActiveId] = await Promise.all([
                LessonDB.getSetting(SETTINGS_KEYS.INDEX),
                LessonDB.getSetting(SETTINGS_KEYS.FOLDERS),
                LessonDB.getSetting(SETTINGS_KEYS.SORT_MODE),
                LessonDB.getSetting(SETTINGS_KEYS.LAST_ACTIVE_NOTE)
            ]);

            if (Array.isArray(storedIndex)) {
                this.noteIndex = storedIndex.map(sanitizeIndexEntry).filter(Boolean);
            } else {
                this.noteIndex = await LessonDB.buildIndexViaCursor();
                await LessonDB.putSetting(SETTINGS_KEYS.INDEX, this.noteIndex);
            }

            if (Array.isArray(storedFolders)) {
                this.folders = sanitizeFoldersList(storedFolders);
            }
            if (storedSort) {
                this.sortMode = storedSort;
                this.updateSortDropdownUI();
            }

            this.saveIndexMirror();
            this.saveFoldersMirror();

            const savedUi = this.readUiState();
            if (savedUi && savedUi.mode === 'buffer' && this.bufferNotes.length > 0) {
                this.mode = 'buffer';
                const bufTarget = this.bufferNotes.find((b) => b.id === savedUi.activeBufferId) || this.bufferNotes[0];
                await this.loadBufferNote(bufTarget.id);
            } else {
                this.mode = 'notes';
                const targetNote =
                    this.noteIndex.find((n) => n.id === lastActiveId && !n.deleted) ||
                    this.noteIndex.find((n) => !n.deleted);

                if (targetNote) {
                    await this.loadNote(targetNote.id);
                } else {
                    await this.createNewNote({ skipMobileClose: true });
                }
            }

            this.renderNotesList();

            // Phase 3: Deferred background maintenance & metadata-only cloud sync
            setTimeout(() => {
                this.purgeExpiredTrash();
                this.syncCloudMetadataInBackground();
            }, 60);

            if (!this._bufferTimer) {
                this._bufferTimer = setInterval(() => this.refreshBufferCountdowns(), 60000);
            }
        },

        loadFastBootMirrors() {
            try {
                const rawIdx = localStorage.getItem(INDEX_MIRROR_KEY);
                if (rawIdx) {
                    const parsed = JSON.parse(rawIdx);
                    if (Array.isArray(parsed)) {
                        this.noteIndex = parsed.map(sanitizeIndexEntry).filter(Boolean);
                    }
                }
                const rawFolders = localStorage.getItem(FOLDERS_MIRROR_KEY);
                if (rawFolders) {
                    this.folders = sanitizeFoldersList(JSON.parse(rawFolders));
                }
                const ui = this.readUiState();
                if (ui && ui.sortMode) this.sortMode = ui.sortMode;
            } catch (e) { }
        },

        readUiState() {
            try {
                const raw = localStorage.getItem(UI_STATE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        saveUiState() {
            this.safeLocalSet(UI_STATE_KEY, JSON.stringify({
                mode: this.mode,
                sortMode: this.sortMode,
                lastActiveId: this.currentNoteId,
                activeBufferId: this.activeBufferId
            }));
        },

        safeLocalSet(key, val) {
            try {
                localStorage.setItem(key, val);
                return true;
            } catch (e) {
                if (!this._quotaWarned) {
                    this._quotaWarned = true;
                    this.showToast('Browser storage is full — clear old buffer notes or export JSON.', 'error');
                    setTimeout(() => { this._quotaWarned = false; }, 10000);
                }
                return false;
            }
        },

        saveIndexMirror() {
            const compact = this.noteIndex.slice(0, 400);
            this.safeLocalSet(INDEX_MIRROR_KEY, JSON.stringify(compact));
        },

        saveFoldersMirror() {
            this.safeLocalSet(FOLDERS_MIRROR_KEY, JSON.stringify(this.folders));
        },

        async persistIndex() {
            this.saveIndexMirror();
            try {
                await LessonDB.putSetting(SETTINGS_KEYS.INDEX, this.noteIndex);
            } catch (e) {
                console.warn('Could not persist notes index:', e);
            }
        },

        async migrateFromLegacyLocalStorage() {
            try {
                const oldNotes = localStorage.getItem('kk_legacy_lesson_notes');
                if (oldNotes) {
                    const parsed = JSON.parse(oldNotes);
                    if (Array.isArray(parsed)) {
                        for (const rawNote of parsed) {
                            if (!rawNote || !rawNote.id) continue;
                            await LessonDB.putNote({
                                ...rawNote,
                                id: String(rawNote.id),
                                deleted: Boolean(rawNote.deleted),
                                updatedAt: rawNote.updatedAt || Date.now()
                            });
                        }
                    }
                    localStorage.removeItem('kk_legacy_lesson_notes');
                }
                const oldLastActive = localStorage.getItem('kk_legacy_last_active_note');
                if (oldLastActive) {
                    await LessonDB.putSetting(SETTINGS_KEYS.LAST_ACTIVE_NOTE, oldLastActive);
                    localStorage.removeItem('kk_legacy_last_active_note');
                }
            } catch (e) {
                console.warn('Legacy migration skipped:', e);
            }
        },

        /* ========================================================
           QUILL 2.0 & LISTENERS
           ======================================================== */
        initQuill() {
            const container = document.getElementById('editor-container');
            if (!container) return;

            if (typeof Quill === 'undefined') {
                container.innerHTML = '<div class="p-4 text-sm font-bold text-slate-400">Rich text editor unavailable in offline fallback.</div>';
                return;
            }

            this.quill = new Quill('#editor-container', {
                theme: 'snow',
                placeholder: 'Start typing your lesson plan, class notes, or [[ to link another page...',
                modules: {
                    table: true,
                    toolbar: [
                        [{ header: [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
                        [{ color: [] }, { background: [] }],
                        ['link', 'image', 'table', 'video'],
                        ['clean']
                    ]
                }
            });

            const toolbarMod = this.quill.getModule('toolbar');
            const customToolbarTarget = document.getElementById('note-toolbar');
            if (toolbarMod && toolbarMod.container && customToolbarTarget) {
                customToolbarTarget.appendChild(toolbarMod.container);
            }
            if (toolbarMod) {
                toolbarMod.addHandler('table', () => this.openTableDialog());
                toolbarMod.addHandler('image', () => this.handleImageInsert());
            }

            this.addQuillToolbarTooltips();
            this.initTableToolbar();

            this.quill.on('text-change', (delta, _oldDelta, source) => {
                if (this.isProgrammaticLoad || source !== 'user') return;
                this.hasDirtyEdits = true;
                this.setSaveStatus('saving');

                if (delta && Array.isArray(delta.ops) && delta.ops.some((op) => op.insert && op.insert.image)) {
                    this.convertBase64ImagesToIDB();
                }

                this.updateFooterWordCount();
                this._debouncedSave();
                this._debouncedOutline();
                this._debouncedListRender();
                this.checkNoteLinkTrigger();
            });

            this.quill.on('selection-change', (range) => {
                if (range) {
                    this.checkNoteLinkTrigger();
                } else {
                    this.closeNoteLinkSuggestions();
                }
                this.updateTableToolbarForSelection(range);
            });

            this.quill.root.addEventListener('keydown', (e) => {
                if (!this.noteLinkSearchActive) return;
                const filtered = this.getFilteredLinkTargets(this.getNoteLinkQuery());

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filtered.length > 0) {
                        this.noteLinkActiveIndex = (this.noteLinkActiveIndex + 1) % filtered.length;
                        this.renderNoteLinkSuggestions(filtered);
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filtered.length > 0) {
                        this.noteLinkActiveIndex = (this.noteLinkActiveIndex - 1 + filtered.length) % filtered.length;
                        this.renderNoteLinkSuggestions(filtered);
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filtered.length > 0 && filtered[this.noteLinkActiveIndex]) {
                        this.insertNoteLink(filtered[this.noteLinkActiveIndex]);
                    } else {
                        this.closeNoteLinkSuggestions();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeNoteLinkSuggestions();
                }
            }, true);

            this.quill.root.addEventListener('click', (e) => {
                const linkEl = e.target.closest('a');
                if (!linkEl) return;
                const href = linkEl.getAttribute('href');
                if (href && href.startsWith('#note-')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const noteId = href.replace('#note-', '');
                    this.setMode('notes', { skipAutoLoad: true }).then(() => this.loadNote(noteId));
                }
            });
        },

        addQuillToolbarTooltips() {
            const toolbar = document.getElementById('note-toolbar');
            if (!toolbar) return;

            const tooltipMap = {
                'ql-bold': 'Bold',
                'ql-italic': 'Italic',
                'ql-underline': 'Underline',
                'ql-strike': 'Strikethrough',
                'ql-link': 'Insert Link',
                'ql-image': 'Insert Image',
                'ql-table': 'Insert Table',
                'ql-video': 'Embed Video',
                'ql-clean': 'Clear Formatting'
            };

            Object.entries(tooltipMap).forEach(([cls, label]) => {
                const btn = toolbar.querySelector(`.${cls}`);
                if (btn) btn.setAttribute('data-tooltip', label);
            });

            toolbar.querySelectorAll('.ql-list').forEach((btn) => {
                const val = btn.getAttribute('value');
                const labels = { ordered: 'Numbered List', bullet: 'Bullet List', check: 'Checklist' };
                if (val && labels[val]) btn.setAttribute('data-tooltip', labels[val]);
            });

            const headerPicker = toolbar.querySelector('.ql-header');
            if (headerPicker) headerPicker.setAttribute('data-tooltip', 'Heading Style');
            const colorPicker = toolbar.querySelector('.ql-color');
            if (colorPicker) colorPicker.setAttribute('data-tooltip', 'Text Color');
            const bgPicker = toolbar.querySelector('.ql-background');
            if (bgPicker) bgPicker.setAttribute('data-tooltip', 'Highlight Color');
        },

        setupListeners() {
            if (this._listenersBound) return;
            this._listenersBound = true;

            const titleEl = document.getElementById('noteTitle');
            if (titleEl) {
                titleEl.addEventListener('input', () => {
                    if (this.isProgrammaticLoad) return;
                    this.hasDirtyEdits = true;
                    this.setSaveStatus('saving');
                    this._debouncedSave();
                    this._debouncedListRender();
                });
            }

            const searchEl = document.getElementById('searchInput');
            if (searchEl) {
                searchEl.addEventListener('input', () => {
                    this.deepSearchHits = null;
                    this.deepSearchToken++;
                    const clearBtn = document.getElementById('clearSearchBtn');
                    if (clearBtn) clearBtn.classList.toggle('is-hidden', !searchEl.value.trim());
                    this.visibleCounts.delete('flat');
                    this.renderNotesList();
                });
            }

            const fmSearchEl = document.getElementById('fmSearchInput');
            if (fmSearchEl) {
                fmSearchEl.addEventListener('input', () => {
                    this.fmState.search = fmSearchEl.value || '';
                    this.fmState.visibleLimit = FM_PAGE_SIZE;
                    this.fmState.lastClickedIndex = null;
                    document.getElementById('fmClearSearchBtn')?.classList.toggle('is-hidden', !this.fmState.search.trim());
                    const filtered = this.renderFileManagerFiles();
                    const visibleIds = new Set(filtered.map((item) => item.id));
                    Array.from(this.fmState.selectedNoteIds).forEach((id) => {
                        if (!visibleIds.has(id)) this.fmState.selectedNoteIds.delete(id);
                    });
                    if ((this.fmState.view || 'root') === 'root') {
                        const visibleFolders = new Set(this.getFmFilteredFolders().map((f) => f.id));
                        let folderPruned = false;
                        Array.from(this.fmState.selectedFolderIds).forEach((fid) => {
                            if (!visibleFolders.has(fid)) {
                                this.fmState.selectedFolderIds.delete(fid);
                                folderPruned = true;
                            }
                        });
                        if (folderPruned) this.renderFileManagerSidebar();
                    }
                    this.renderFileManagerBulkBar(filtered);
                });
            }

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.note-ctx-menu') && !e.target.closest('.note-ctx-trigger') && !e.target.closest('.folder-menu-btn')) {
                    document.querySelectorAll('.note-ctx-menu').forEach((m) => m.remove());
                }
                if (!e.target.closest('#sortDropdown') && !e.target.closest('#sortBtn')) {
                    document.getElementById('sortDropdown')?.classList.add('is-hidden');
                }
                if (!e.target.closest('#noteLinkSuggestions')) {
                    this.closeNoteLinkSuggestions();
                }
                if (this.tableToolbarEl && this.quill) {
                    const editorEl = document.getElementById('editor-container');
                    if (editorEl && !editorEl.contains(e.target) && !this.tableToolbarEl.contains(e.target)) {
                        this.tableToolbarEl.classList.add('is-hidden');
                    }
                }
            });

            document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

            if (typeof document.addEventListener === 'function') {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden') {
                        this.flushPendingSave();
                    } else {
                        this.refreshBufferCountdowns();
                    }
                });
            }

            window.addEventListener('beforeunload', () => this.flushPendingSave());

            window.addEventListener('storage', (e) => {
                if (e && (e.key === 'theme_hub' || e.key === THEME_KEY || e.key === 'klasskit-theme')) {
                    setTimeout(() => this.syncThemeState(), 0);
                } else if (e && e.key === BUFFER_STORAGE_KEY) {
                    this.loadBufferNotes();
                    this.purgeExpiredBuffers(false);
                    this.renderNotesList();
                }
            });
        },

        handleGlobalKeydown(e) {
            const customModal = document.getElementById('customModal');
            const promptModal = document.getElementById('promptModal');
            const tableDialog = document.getElementById('tableDialog');
            const helpModal = document.getElementById('helpModal');

            if (e.key === 'Escape') {
                if (customModal && customModal.classList.contains('open')) {
                    if (typeof this._confirmCancel === 'function') this._confirmCancel();
                    return;
                }
                if (promptModal && promptModal.classList.contains('open')) {
                    if (typeof this._promptCancel === 'function') this._promptCancel();
                    return;
                }
                if (tableDialog && tableDialog.classList.contains('open')) {
                    this.closeTableDialog();
                    return;
                }
                if (helpModal && helpModal.classList.contains('open')) {
                    this.toggleHelp(false);
                    return;
                }
                if (this.isFileManagerOpen()) {
                    this.closeFileManager();
                    return;
                }
                document.querySelectorAll('.note-ctx-menu').forEach((m) => m.remove());
                document.getElementById('sortDropdown')?.classList.add('is-hidden');
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('is-mobile-open')) {
                    this.toggleSidebar(false);
                }
                return;
            }

            const isMeta = e.ctrlKey || e.metaKey;
            const keyLower = (e.key || '').toLowerCase();

            const hasHigherModal = Boolean(
                (customModal && customModal.classList.contains('open')) ||
                (promptModal && promptModal.classList.contains('open')) ||
                (tableDialog && tableDialog.classList.contains('open')) ||
                (helpModal && helpModal.classList.contains('open'))
            );
            if (isMeta && e.shiftKey && keyLower === 'm' && !hasHigherModal) {
                e.preventDefault();
                if (this.isFileManagerOpen()) this.closeFileManager();
                else this.openFileManager();
                return;
            }

            if (document.querySelector('.modal-overlay.open')) return;

            if (isMeta && e.shiftKey && keyLower === 'b') {
                e.preventDefault();
                this.createBufferNote();
                return;
            }

            if (isMeta && !e.shiftKey && keyLower === 'n') {
                const activeEl = document.activeElement;
                const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                if (!isTyping || activeEl.id === 'searchInput') {
                    e.preventDefault();
                    this.createNewNote();
                }
                return;
            }

            if (isMeta && e.shiftKey && keyLower === 'l') {
                e.preventDefault();
                this.toggleDarkMode();
                return;
            }

            if (isMeta && e.shiftKey && keyLower === 'z') {
                e.preventDefault();
                this.toggleZenMode();
                return;
            }

            if (isMeta && e.shiftKey && keyLower === 'o') {
                e.preventDefault();
                this.toggleOutline();
                return;
            }

            if (isMeta && e.shiftKey && e.key === 'Delete') {
                e.preventDefault();
                if (this.mode === 'buffer') this.deleteCurrentBuffer();
                else this.softDeleteCurrentNote();
                return;
            }

            if (isMeta && !e.shiftKey && keyLower === 'k') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
        },

        /* ========================================================
           THEME, SIDEBARS & MODALS
           ======================================================== */
        syncThemeState() {
            this.isDarkMode = document.documentElement.classList.contains('dark');
            const sun = document.getElementById('themeIconSun');
            const moon = document.getElementById('themeIconMoon');
            if (sun) sun.classList.toggle('is-hidden', !this.isDarkMode);
            if (moon) moon.classList.toggle('is-hidden', this.isDarkMode);
        },

        toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            this.isDarkMode = isDark;
            this.safeLocalSet(THEME_KEY, isDark ? 'dark' : 'light');
            this.syncThemeState();
        },

        toggleSidebar(force) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (!sidebar) return;
            const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-mobile-open');
            sidebar.classList.toggle('is-mobile-open', open);
            if (backdrop) backdrop.classList.toggle('open', open);
        },

        toggleZenMode() {
            const shell = document.getElementById('appShell');
            const btn = document.getElementById('zenModeBtn');
            this.isZenMode = !this.isZenMode;
            if (shell) shell.classList.toggle('is-zen', this.isZenMode);
            if (btn) {
                const icon = this.isZenMode ? 'minimize-2' : 'maximize-2';
                btn.innerHTML = `<i id="zenModeIcon" data-lucide="${icon}" class="w-4 h-4"></i>`;
                this.safeCreateIcons(btn);
            }
            if (this.isZenMode && this.isOutlineOpen) {
                this.toggleOutline(false);
            }
        },

        toggleOutline(force) {
            const sidebar = document.getElementById('outlineSidebar');
            if (!sidebar) return;
            const next = typeof force === 'boolean' ? force : !this.isOutlineOpen;
            this.isOutlineOpen = next;
            sidebar.classList.toggle('is-open', next);
            if (next) this.updateOutline();
        },

        toggleHelp(force) {
            const modal = document.getElementById('helpModal');
            if (!modal) return;
            const open = typeof force === 'boolean' ? force : !modal.classList.contains('open');
            modal.classList.toggle('open', open);
        },

        showModal(title, desc, confirmText, iconName = 'trash-2') {
            if (typeof this._confirmCancel === 'function') {
                this._confirmCancel();
            }
            return new Promise((resolve) => {
                const modal = document.getElementById('customModal');
                const titleEl = document.getElementById('modalTitle');
                const descEl = document.getElementById('modalDesc');
                const confirmBtn = document.getElementById('modalConfirm');
                const cancelBtn = document.getElementById('modalCancel');
                const iconWrap = document.getElementById('modalIconWrap');

                if (titleEl) titleEl.textContent = title || 'Confirm';
                if (descEl) descEl.textContent = desc || '';
                if (confirmBtn) confirmBtn.textContent = confirmText || 'Confirm';
                if (iconWrap) {
                    iconWrap.innerHTML = `<i id="modalIcon" data-lucide="${escapeHtml(iconName || 'triangle-alert')}" class="w-7 h-7"></i>`;
                    this.safeCreateIcons(iconWrap);
                }

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
                setTimeout(() => cancelBtn?.focus(), 50);
            });
        },

        showPrompt(title, desc, iconName = 'folder-plus', defaultValue = '') {
            if (typeof this._promptCancel === 'function') {
                this._promptCancel();
            }
            return new Promise((resolve) => {
                const modal = document.getElementById('promptModal');
                const titleEl = document.getElementById('promptTitle');
                const descEl = document.getElementById('promptDesc');
                const confirmBtn = document.getElementById('promptConfirm');
                const cancelBtn = document.getElementById('promptCancel');
                const iconWrap = document.getElementById('promptIconWrap');
                const inputEl = document.getElementById('promptInput');

                if (titleEl) titleEl.textContent = title || 'Input';
                if (descEl) descEl.textContent = desc || '';
                if (inputEl) inputEl.value = defaultValue || '';
                if (iconWrap) {
                    iconWrap.innerHTML = `<i id="promptIcon" data-lucide="${escapeHtml(iconName || 'folder-plus')}" class="w-6 h-6 text-blue"></i>`;
                    this.safeCreateIcons(iconWrap);
                }

                const cleanup = (val) => {
                    if (modal) modal.classList.remove('open');
                    if (confirmBtn) confirmBtn.onclick = null;
                    if (cancelBtn) cancelBtn.onclick = null;
                    if (inputEl) inputEl.onkeydown = null;
                    this._promptCancel = null;
                    resolve(val);
                };

                this._promptCancel = () => cleanup(null);
                if (confirmBtn) confirmBtn.onclick = () => cleanup(inputEl ? inputEl.value : '');
                if (cancelBtn) cancelBtn.onclick = () => cleanup(null);
                if (inputEl) {
                    inputEl.onkeydown = (ev) => {
                        if (ev.key === 'Enter') {
                            ev.preventDefault();
                            cleanup(inputEl.value);
                        } else if (ev.key === 'Escape') {
                            ev.preventDefault();
                            cleanup(null);
                        }
                    };
                }

                if (modal) modal.classList.add('open');
                setTimeout(() => {
                    if (inputEl) {
                        inputEl.focus();
                        if (typeof inputEl.select === 'function') inputEl.select();
                    }
                }, 60);
            });
        },

        /* ========================================================
           LRU CACHE & METADATA-FIRST NOTE LOADING
           ======================================================== */
        cacheNoteBody(note) {
            if (!note || !note.id) return;
            const id = String(note.id);
            if (this.noteBodyCache.has(id)) {
                this.noteBodyCache.delete(id);
            }
            this.noteBodyCache.set(id, { ...note });
            while (this.noteBodyCache.size > MAX_BODY_CACHE) {
                const oldestKey = this.noteBodyCache.keys().next().value;
                this.noteBodyCache.delete(oldestKey);
            }
            this.updateCacheStatusLabel();
        },

        upsertNoteIndexEntry(note, extras = {}) {
            if (!note || !note.id) return null;
            const id = String(note.id);
            const idx = this.noteIndex.findIndex((n) => n.id === id);
            const existing = idx !== -1 ? this.noteIndex[idx] : null;
            const entry = sanitizeIndexEntry({
                id,
                title: note.title ?? existing?.title ?? '',
                preview: extras.preview !== undefined
                    ? extras.preview
                    : (note.content !== undefined ? extractPreview(note.content, 90) : (existing?.preview || '')),
                folderId: note.folderId !== undefined ? note.folderId : (existing?.folderId || null),
                deleted: note.deleted !== undefined ? Boolean(note.deleted) : Boolean(existing?.deleted),
                updatedAt: note.updatedAt ?? existing?.updatedAt ?? Date.now(),
                sortOrder: note.sortOrder !== undefined ? note.sortOrder : (existing?.sortOrder ?? null),
                needsCloudFetch: extras.needsCloudFetch !== undefined ? extras.needsCloudFetch : Boolean(existing?.needsCloudFetch)
            });
            if (idx !== -1) this.noteIndex.splice(idx, 1);
            this.noteIndex.unshift(entry);
            return entry;
        },

        async setMode(targetMode, options = {}) {
            if (!['notes', 'buffer', 'trash'].includes(targetMode)) return;
            if (this.mode !== targetMode) {
                await this.flushPendingSave();
            }

            this.mode = targetMode;
            this.deepSearchHits = null;
            this.visibleCounts.delete('flat');

            if (targetMode === 'buffer') {
                this.purgeExpiredBuffers(false);
            }

            this.updateHeaderAndModeUI();
            this.renderNotesList();

            if (!options.skipAutoLoad) {
                if (targetMode === 'buffer') {
                    const target =
                        this.bufferNotes.find((b) => b.id === this.activeBufferId) ||
                        this.bufferNotes[0];
                    if (target) {
                        await this.loadBufferNote(target.id);
                    } else {
                        this.showEmptyEditorState('buffer');
                    }
                } else if (targetMode === 'trash') {
                    const firstTrash = this.noteIndex.find((n) => n.deleted);
                    if (firstTrash) {
                        await this.loadNote(firstTrash.id);
                    } else {
                        this.showEmptyEditorState('trash');
                    }
                } else {
                    const target =
                        this.noteIndex.find((n) => n.id === this.currentNoteId && !n.deleted) ||
                        this.noteIndex.find((n) => !n.deleted);
                    if (target) {
                        await this.loadNote(target.id);
                    } else {
                        await this.createNewNote({ skipMobileClose: true });
                    }
                }
            }

            this.saveUiState();
        },

        showEmptyEditorState(kind) {
            this.activeLoadToken++;
            this.hasDirtyEdits = false;
            if (kind === 'buffer') this.activeBufferId = null;
            else if (kind === 'trash') this.currentNoteId = null;

            const docWrap = document.getElementById('editorDocumentWrap');
            const emptyPanel = document.getElementById('editorEmptyState');
            const emptyIconWrap = document.getElementById('editorEmptyIconWrap');
            const emptyTitle = document.getElementById('editorEmptyTitle');
            const emptyDesc = document.getElementById('editorEmptyDesc');
            const emptyBtn = document.getElementById('editorEmptyActionBtn');
            const titleEl = document.getElementById('noteTitle');
            const headerTitle = document.getElementById('headerNoteTitle');

            if (docWrap) docWrap.classList.add('is-hidden');
            if (emptyPanel) emptyPanel.classList.remove('is-hidden');
            document.getElementById('bufferBanner')?.classList.add('is-hidden');
            document.getElementById('trashBanner')?.classList.add('is-hidden');
            document.getElementById('noteLoadingOverlay')?.classList.add('is-hidden');

            if (this.quill) {
                this.isProgrammaticLoad = true;
                this.quill.root.innerHTML = '';
                this.quill.disable();
                this.isProgrammaticLoad = false;
            }
            if (titleEl) {
                titleEl.value = '';
                titleEl.disabled = true;
            }

            if (kind === 'buffer') {
                if (headerTitle) headerTitle.textContent = '3-Day Buffer';
                if (emptyIconWrap) {
                    emptyIconWrap.className = 'w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange/15 text-orange border-3 border-dark dark:border-slate-500 shadow-hard-sm flex items-center justify-center -rotate-3';
                    emptyIconWrap.innerHTML = '<i data-lucide="hourglass" class="w-8 h-8"></i>';
                }
                if (emptyTitle) emptyTitle.textContent = 'No Temporary Buffer Notes';
                if (emptyDesc) emptyDesc.textContent = 'Jot quick scratchpad ideas here. Every buffer note clears itself automatically after 3 days unless saved permanently.';
                if (emptyBtn) {
                    emptyBtn.className = 'btn-chunky bg-orange text-white px-5 py-2.5 text-xs font-heading font-bold uppercase tracking-wider gap-2';
                    emptyBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i><span>New 3-Day Buffer Note</span>';
                    emptyBtn.classList.remove('is-hidden');
                }
            } else {
                if (headerTitle) headerTitle.textContent = 'Trash';
                if (emptyIconWrap) {
                    emptyIconWrap.className = 'w-16 h-16 mx-auto mb-4 rounded-2xl bg-pink/15 text-pink border-3 border-dark dark:border-slate-500 shadow-hard-sm flex items-center justify-center -rotate-3';
                    emptyIconWrap.innerHTML = '<i data-lucide="trash-2" class="w-8 h-8"></i>';
                }
                if (emptyTitle) emptyTitle.textContent = 'Trash Is Empty';
                if (emptyDesc) emptyDesc.textContent = 'Deleted permanent notes rest here for 14 days before auto-purging.';
                if (emptyBtn) {
                    emptyBtn.className = 'btn-chunky bg-blue text-white px-5 py-2.5 text-xs font-heading font-bold uppercase tracking-wider gap-2';
                    emptyBtn.innerHTML = '<i data-lucide="notebook-pen" class="w-4 h-4"></i><span>Back to Notes</span>';
                    emptyBtn.classList.remove('is-hidden');
                }
            }

            this.safeCreateIcons(emptyPanel);
            this.updateHeaderAndModeUI();
            this.updateFooterWordCount();
        },

        handleEmptyStateAction() {
            if (this.mode === 'buffer') {
                this.createBufferNote();
            } else {
                this.setMode('notes');
            }
        },

        updateHeaderAndModeUI() {
            const tabNotes = document.getElementById('tabNotes');
            const tabBuffer = document.getElementById('tabBuffer');
            const tabTrash = document.getElementById('tabTrash');
            const pill = document.getElementById('headerModePill');
            const bufferHeader = document.getElementById('bufferHeader');
            const trashHeader = document.getElementById('trashHeader');
            const softDelBtn = document.getElementById('softDeleteBtn');
            const bufActions = document.getElementById('bufferToolbarActions');
            const trashBtns = document.getElementById('trashButtons');

            if (tabNotes) {
                tabNotes.className = `mode-tab ${this.mode === 'notes' ? 'is-active-notes' : ''}`;
            }
            if (tabBuffer) {
                tabBuffer.className = `mode-tab ${this.mode === 'buffer' ? 'is-active-buffer' : ''}`;
            }
            if (tabTrash) {
                tabTrash.className = `mode-tab ${this.mode === 'trash' ? 'is-active-trash' : ''}`;
            }

            if (pill) {
                if (this.mode === 'buffer') {
                    pill.textContent = '3-Day Buffer';
                    pill.className = 'px-2 py-0.5 rounded-lg bg-orange/15 text-orange text-[10px] font-black uppercase tracking-wider flex-shrink-0';
                } else if (this.mode === 'trash') {
                    pill.textContent = 'Trash';
                    pill.className = 'px-2 py-0.5 rounded-lg bg-pink/15 text-pink text-[10px] font-black uppercase tracking-wider flex-shrink-0';
                } else {
                    pill.textContent = 'Notes';
                    pill.className = 'px-2 py-0.5 rounded-lg bg-blue/15 text-blue text-[10px] font-black uppercase tracking-wider flex-shrink-0';
                }
            }

            if (bufferHeader) bufferHeader.classList.toggle('is-hidden', this.mode !== 'buffer');
            if (trashHeader) trashHeader.classList.toggle('is-hidden', this.mode !== 'trash');

            if (softDelBtn) softDelBtn.classList.toggle('is-hidden', this.mode !== 'notes');
            if (bufActions) bufActions.classList.toggle('is-hidden', this.mode !== 'buffer' || !this.activeBufferId);
            if (trashBtns) trashBtns.classList.toggle('is-hidden', this.mode !== 'trash' || !this.currentNoteId);

            const notesBadge = document.getElementById('notesCountBadge');
            const bufferBadge = document.getElementById('bufferCountBadge');
            const trashBadge = document.getElementById('trashCountBadge');
            if (notesBadge) notesBadge.textContent = String(this.noteIndex.filter((n) => !n.deleted).length);
            if (bufferBadge) bufferBadge.textContent = String(this.bufferNotes.length);
            if (trashBadge) trashBadge.textContent = String(this.noteIndex.filter((n) => n.deleted).length);
        },

        setSaveStatus(state, customText) {
            const dot = document.getElementById('statusIndicator');
            const label = document.getElementById('statusText');
            if (!dot || !label) return;

            if (state === 'saving') {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-orange border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Saving...';
            } else if (state === 'syncing') {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-blue border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Syncing cloud...';
            } else if (state === 'trash') {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-pink border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Deleted Note (Read-Only)';
            } else if (state === 'buffer') {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-orange border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Local 3-Day Buffer';
            } else if (state === 'error') {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-pink border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Sync Warning';
            } else {
                dot.className = 'w-2.5 h-2.5 rounded-full bg-green border border-dark/40 dark:border-white/20 flex-shrink-0';
                label.textContent = customText || 'Auto-saved';
            }
        },

        updateFooterWordCount() {
            const wcEl = document.getElementById('wordCountText');
            if (!wcEl) return;
            const docWrap = document.getElementById('editorDocumentWrap');
            if (docWrap && docWrap.classList.contains('is-hidden')) {
                wcEl.textContent = '0 words';
                return;
            }
            const titleText = document.getElementById('noteTitle')?.value || '';
            const bodyText = this.quill ? this.quill.getText() : '';
            const { words, readMinutes } = countWords(`${titleText} ${bodyText}`);
            wcEl.textContent = words > 0
                ? `${words} word${words === 1 ? '' : 's'} · ${readMinutes} min read`
                : '0 words';
        },

        updateCacheStatusLabel() {
            const el = document.getElementById('cacheStatsText');
            if (!el) return;
            el.textContent = `${this.noteBodyCache.size}/${MAX_BODY_CACHE} cached in RAM`;
        },

        async flushPendingSave() {
            if (!this.hasDirtyEdits) return;
            if (this.mode === 'buffer' && this.activeBufferId) {
                this.saveCurrentBufferNote();
            } else if (this.mode === 'notes' && this.currentNoteId) {
                await this.saveCurrentNote();
            }
        },

        saveCurrentEditorState() {
            if (this.mode === 'buffer') {
                this.saveCurrentBufferNote();
            } else if (this.mode === 'notes') {
                this.saveCurrentNote();
            }
        },

        async createNewNote(options = {}) {
            await this.flushPendingSave();
            if (this.mode !== 'notes') {
                this.mode = 'notes';
            }

            const targetFolderId = (options.folderId && this.folders.some((f) => f.id === options.folderId))
                ? options.folderId
                : null;

            const newNote = {
                id: Date.now().toString(),
                title: '',
                content: '',
                updatedAt: Date.now(),
                deleted: false,
                folderId: targetFolderId,
                sortOrder: null
            };

            this.upsertNoteIndexEntry(newNote, { preview: '', needsCloudFetch: false });
            this.cacheNoteBody(newNote);
            await LessonDB.putNote(newNote);
            await this.persistIndex();

            await this.loadNote(newNote.id, { skipFlush: true });
            this.syncSingleNoteToCloud(newNote);

            if (!options.skipMobileClose && typeof window !== 'undefined' && window.innerWidth < 768) {
                this.toggleSidebar(false);
            }
            setTimeout(() => document.getElementById('noteTitle')?.focus(), 40);
        },

        async loadNote(id, options = {}) {
            if (!options.skipFlush) {
                await this.flushPendingSave();
            }

            const meta = this.noteIndex.find((n) => n.id === id);
            if (!meta) {
                this.showToast('Note not found', 'error');
                return;
            }

            if (meta.deleted && this.mode !== 'trash') {
                const confirmed = await this.showModal('Restore Note?', 'This note is in the Trash. Would you like to restore it?', 'Restore Note', 'refresh-ccw');
                if (!confirmed) return;
                meta.deleted = false;
                meta.updatedAt = Date.now();
                const full = (await this.ensureFullNote(id)) || { ...meta, content: '' };
                full.deleted = false;
                full.updatedAt = meta.updatedAt;
                await LessonDB.putNote(full);
                this.cacheNoteBody(full);
                await this.persistIndex();
                this.syncSingleNoteToCloud(full);
            } else if (!meta.deleted && this.mode === 'trash') {
                this.mode = 'notes';
            }

            this.mode = meta.deleted ? 'trash' : 'notes';
            this.currentNoteId = id;
            const token = ++this.activeLoadToken;

            if (!meta.deleted) {
                LessonDB.putSetting(SETTINGS_KEYS.LAST_ACTIVE_NOTE, id).catch(() => { });
            }
            this.saveUiState();

            document.getElementById('editorEmptyState')?.classList.add('is-hidden');
            document.getElementById('editorDocumentWrap')?.classList.remove('is-hidden');
            document.getElementById('bufferBanner')?.classList.add('is-hidden');

            const trashBanner = document.getElementById('trashBanner');
            const trashInfoText = document.getElementById('trashInfoText');
            if (trashBanner) trashBanner.classList.toggle('is-hidden', !meta.deleted);
            if (trashInfoText && meta.deleted) {
                const daysLeft = Math.max(0, Math.ceil((meta.updatedAt + TRASH_TTL_MS - Date.now()) / (24 * 60 * 60 * 1000)));
                trashInfoText.textContent = `In Trash (${daysLeft}d left before permanent auto-purge). Read-only until restored.`;
            }

            const titleEl = document.getElementById('noteTitle');
            const headerTitle = document.getElementById('headerNoteTitle');
            if (titleEl) {
                titleEl.value = meta.title || '';
                titleEl.disabled = Boolean(meta.deleted);
            }
            if (headerTitle) headerTitle.textContent = meta.title || 'Untitled';

            this.updateHeaderAndModeUI();
            this.renderNotesList();

            const loadingEl = document.getElementById('noteLoadingOverlay');
            const needRemote = Boolean(meta.needsCloudFetch);
            if (needRemote && loadingEl) loadingEl.classList.remove('is-hidden');

            const fullNote = await this.ensureFullNote(id);
            if (this.activeLoadToken !== token) {
                if (loadingEl) loadingEl.classList.add('is-hidden');
                return;
            }
            if (loadingEl) loadingEl.classList.add('is-hidden');

            if (fullNote) {
                meta.title = fullNote.title || meta.title || '';
                meta.preview = extractPreview(fullNote.content, 90);
                meta.needsCloudFetch = false;
                if (titleEl) titleEl.value = meta.title;
                if (headerTitle) headerTitle.textContent = meta.title || 'Untitled';
                await this.loadNoteContentIntoEditor(fullNote.content || '', token, Boolean(meta.deleted));
            } else {
                await this.loadNoteContentIntoEditor('', token, Boolean(meta.deleted));
            }

            if (this.activeLoadToken !== token) return;

            this.hasDirtyEdits = false;
            this.setSaveStatus(meta.deleted ? 'trash' : 'saved');
            this.updateFooterWordCount();
            this.updateOutline();
            this.renderNotesList();
        },

        async ensureFullNote(id) {
            const cached = this.noteBodyCache.get(id);
            const meta = this.noteIndex.find((n) => n.id === id);

            if (cached && (!meta || !meta.needsCloudFetch)) {
                this.cacheNoteBody(cached);
                return cached;
            }

            if (meta && meta.needsCloudFetch) {
                const cloudNote = await this.fetchSingleNoteFromCloud(id);
                if (cloudNote) {
                    await LessonDB.putNote(cloudNote);
                    this.cacheNoteBody(cloudNote);
                    meta.title = cloudNote.title || '';
                    meta.preview = extractPreview(cloudNote.content, 90);
                    meta.updatedAt = cloudNote.updatedAt || meta.updatedAt;
                    meta.folderId = cloudNote.folderId || null;
                    meta.deleted = Boolean(cloudNote.deleted);
                    meta.needsCloudFetch = false;
                    await this.persistIndex();
                    return cloudNote;
                }
            }

            const localNote = await LessonDB.getNote(id);
            if (localNote) {
                this.cacheNoteBody(localNote);
                return localNote;
            }
            return null;
        },

        async saveCurrentNote() {
            if (!this.currentNoteId || this.mode !== 'notes') return;
            const id = this.currentNoteId;
            const meta = this.noteIndex.find((n) => n.id === id);
            if (!meta || meta.deleted) return;

            const title = document.getElementById('noteTitle')?.value ?? '';
            const content = this.getContentForSave();
            const updatedAt = Date.now();
            const existing = (await this.ensureFullNote(id)) || {};

            const record = {
                ...existing,
                id,
                title,
                content,
                folderId: meta.folderId || null,
                deleted: false,
                sortOrder: meta.sortOrder ?? existing.sortOrder ?? null,
                updatedAt
            };

            meta.title = title;
            meta.preview = extractPreview(content, 90);
            meta.updatedAt = updatedAt;
            meta.needsCloudFetch = false;

            const headerTitle = document.getElementById('headerNoteTitle');
            if (headerTitle) headerTitle.textContent = title || 'Untitled';

            this.hasDirtyEdits = false;
            this.cacheNoteBody(record);
            await LessonDB.putNote(record);
            await this.persistIndex();
            this.setSaveStatus('saved');
            this.syncSingleNoteToCloud(record);
        },

        /* ========================================================
           LAZY IMAGE PREPARATION & NON-BLOCKING HYDRATION
           ======================================================== */
        prepareHtmlForLazyImages(html) {
            if (!html) return '';
            const safe = sanitizeNoteHtml(html);
            return safe.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
                const srcMatch = attrs.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
                if (!srcMatch) return full;
                const srcVal = srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? '';
                if (!srcVal) return full;
                const isIdb = srcVal.startsWith('idb://');
                const isCloud = srcVal.includes('klasskit-media');
                if (!isIdb && !isCloud) {
                    return full;
                }
                const cleanedAttrs = attrs
                    .replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                    .replace(/\sdata-lazy-src\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                    .replace(/\sdata-lazy-pending\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
                return `<img data-lazy-src="${escapeHtml(srcVal)}" data-lazy-pending="true" loading="lazy" decoding="async"${cleanedAttrs}>`;
            });
        },

        async loadNoteContentIntoEditor(rawHtml, token, readOnly = false) {
            this.revokeActiveBlobUrls();
            this.cloudUrlMap.clear();

            const deferredHtml = this.prepareHtmlForLazyImages(rawHtml);

            if (this.quill) {
                this.isProgrammaticLoad = true;
                this.quill.root.innerHTML = deferredHtml;
                if (readOnly) this.quill.disable();
                else this.quill.enable();
                this.isProgrammaticLoad = false;
            }

            // Hydrate images after DOM paints text cleanly
            await this.hydrateEditorImages(token);
        },

        async hydrateEditorImages(token) {
            if (!this.quill || !this.quill.root) return;
            const lazyImgs = Array.from(this.quill.root.querySelectorAll('img[data-lazy-src]'));
            if (!lazyImgs.length) return;

            const idbElements = [];
            const cloudElements = [];

            lazyImgs.forEach((imgEl) => {
                const rawSrc = imgEl.getAttribute('data-lazy-src');
                if (!rawSrc) return;
                if (rawSrc.startsWith('idb://')) {
                    idbElements.push({ el: imgEl, id: rawSrc.slice('idb://'.length) });
                } else if (rawSrc.includes('klasskit-media')) {
                    cloudElements.push({ el: imgEl, url: rawSrc });
                }
            });

            // 1. Resolve unique IDB images in parallel
            const uniqueIds = Array.from(new Set(idbElements.map((item) => item.id)));
            const idbResolved = new Map();
            await Promise.all(uniqueIds.map(async (imgId) => {
                try {
                    const data = await LessonDB.getImage(imgId);
                    if (!data) return;
                    const blob = new Blob([data.data], { type: data.type });
                    const blobUrl = URL.createObjectURL(blob);
                    idbResolved.set(imgId, blobUrl);
                } catch (e) {
                    console.warn('Could not hydrate local image:', imgId);
                }
            }));

            if (this.activeLoadToken !== token) {
                idbResolved.forEach((url) => {
                    try { URL.revokeObjectURL(url); } catch (e) { }
                });
                return;
            }

            idbElements.forEach(({ el, id }) => {
                const resolved = idbResolved.get(id);
                if (resolved) {
                    this.blobUrlMap.set(resolved, id);
                    el.setAttribute('src', resolved);
                    el.removeAttribute('data-lazy-src');
                    el.removeAttribute('data-lazy-pending');
                }
            });

            // 2. Batch-sign cloud images
            if (cloudElements.length > 0) {
                const uniqueUrls = Array.from(new Set(cloudElements.map((c) => c.url)));
                const urlMap = new Map();

                if (typeof resolveMediaUrls === 'function') {
                    try {
                        const signed = await resolveMediaUrls(uniqueUrls);
                        uniqueUrls.forEach((orig, i) => {
                            if (signed && signed[i]) urlMap.set(orig, signed[i]);
                        });
                    } catch (e) {
                        console.warn('Batch cloud image resolve failed:', e);
                    }
                } else if (typeof resolveMediaUrl === 'function') {
                    await Promise.all(uniqueUrls.map(async (orig) => {
                        try {
                            const signed = await resolveMediaUrl(orig);
                            if (signed) urlMap.set(orig, signed);
                        } catch (e) { }
                    }));
                }

                if (this.activeLoadToken !== token) return;

                cloudElements.forEach(({ el, url }) => {
                    const signed = urlMap.get(url) || url;
                    if (signed !== url) this.cloudUrlMap.set(signed, url);
                    el.setAttribute('src', signed);
                    el.removeAttribute('data-lazy-src');
                    el.removeAttribute('data-lazy-pending');
                });
            }
        },

        revokeActiveBlobUrls() {
            this.blobUrlMap.forEach((_id, url) => {
                try { URL.revokeObjectURL(url); } catch (e) { }
            });
            this.blobUrlMap.clear();
        },

        getContentForSave() {
            if (!this.quill || !this.quill.root) return '';
            let html = this.quill.root.innerHTML || '';

            // Restore unhydrated lazy placeholders so fast edits never lose pending images
            html = html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
                const lazyMatch = attrs.match(/\sdata-lazy-src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
                if (!lazyMatch) return full;
                const origSrc = decodeBasicEntities(lazyMatch[1] ?? lazyMatch[2] ?? lazyMatch[3] ?? '');
                if (!origSrc) return full;
                const cleaned = attrs
                    .replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                    .replace(/\sdata-lazy-src\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
                    .replace(/\sdata-lazy-pending\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
                return `<img src="${escapeHtml(origSrc)}"${cleaned}>`;
            });

            this.blobUrlMap.forEach((id, blobUrl) => {
                html = html.split(blobUrl).join(`idb://${id}`);
            });

            this.cloudUrlMap.forEach((origUrl, signedUrl) => {
                const baseOriginal = origUrl.split('?')[0];
                html = html.split(signedUrl).join(baseOriginal);
            });

            return html;
        },

        async ensureImageCompression() {
            if (typeof window.imageCompression === 'function') return window.imageCompression;
            try {
                await loadExternalScript(IMAGE_COMPRESSION_SRC, () => typeof window.imageCompression === 'function');
                return typeof window.imageCompression === 'function' ? window.imageCompression : null;
            } catch (e) {
                return null;
            }
        },

        async compressIfNeeded(file) {
            if (!file || file.type === 'image/gif' || file.size < 160 * 1024) return file;
            const compressor = await this.ensureImageCompression();
            if (!compressor) return file;
            try {
                return await compressor(file, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true
                });
            } catch (e) {
                return file;
            }
        },

        handleImageInsert() {
            document.getElementById('imageInput')?.click();
        },

        async processImageInput(inputEl) {
            const file = inputEl?.files?.[0];
            if (!file) return;
            try {
                const processed = await this.compressIfNeeded(file);
                const user = (typeof getCloudUser === 'function') ? await getCloudUser() : null;
                const activeOwnerId = this.mode === 'buffer' ? (this.activeBufferId || 'buffer') : (this.currentNoteId || 'note');

                if (user && !user.is_sandbox && typeof uploadMedia === 'function' && this.mode !== 'buffer') {
                    const url = await uploadMedia(processed, 'lesson_note', activeOwnerId);
                    const range = this.quill.getSelection(true) || { index: this.quill.getLength() };
                    this.quill.insertEmbed(range.index, 'image', url, 'user');
                    this.quill.setSelection(range.index + 1, 0);
                } else {
                    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const buf = await processed.arrayBuffer();
                    await LessonDB.putImage(id, buf, processed.type || file.type || 'image/png');
                    const blob = new Blob([buf], { type: processed.type || file.type || 'image/png' });
                    const blobUrl = URL.createObjectURL(blob);
                    this.blobUrlMap.set(blobUrl, id);
                    const range = this.quill.getSelection(true) || { index: this.quill.getLength() };
                    this.quill.insertEmbed(range.index, 'image', blobUrl, 'user');
                    this.quill.setSelection(range.index + 1, 0);
                }
            } catch (err) {
                console.error('Image insert failed:', err);
                this.showToast('Could not insert image', 'error');
            }
            if (inputEl) inputEl.value = '';
        },

        async convertBase64ImagesToIDB() {
            if (!this.quill || !this.quill.root) return;
            const images = Array.from(this.quill.root.querySelectorAll('img[src^="data:"]'));
            if (!images.length) return;

            const user = (typeof getCloudUser === 'function') ? await getCloudUser() : null;
            const canUpload = Boolean(user && !user.is_sandbox && typeof uploadMedia === 'function' && this.mode !== 'buffer');

            for (const img of images) {
                const src = img.getAttribute('src') || '';
                const match = src.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
                if (!match) continue;
                try {
                    const mimeType = match[1];
                    const arrayBuffer = base64ToArrayBuffer(match[2]);
                    const blob = new Blob([arrayBuffer], { type: mimeType });
                    const file = new File([blob], `pasted_${Date.now()}.webp`, { type: mimeType });

                    if (canUpload) {
                        const url = await uploadMedia(file, 'lesson_note', this.currentNoteId || 'note');
                        img.setAttribute('src', url);
                    } else {
                        const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        await LessonDB.putImage(id, arrayBuffer, mimeType);
                        const blobUrl = URL.createObjectURL(blob);
                        this.blobUrlMap.set(blobUrl, id);
                        img.setAttribute('src', blobUrl);
                    }
                } catch (e) {
                    console.warn('Pasted image conversion skipped:', e);
                }
            }
        },

        /* ========================================================
           3-DAY TEMPORARY BUFFER NOTES ENGINE
           ======================================================== */
        loadBufferNotes() {
            try {
                const raw = localStorage.getItem(BUFFER_STORAGE_KEY);
                if (!raw) {
                    this.bufferNotes = [];
                    return;
                }
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    this.bufferNotes = [];
                    return;
                }
                this.bufferNotes = parsed
                    .map((item) => sanitizeBufferNote(item))
                    .filter(Boolean)
                    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            } catch (e) {
                this.bufferNotes = [];
            }
        },

        saveBufferNotesLocal() {
            this.safeLocalSet(BUFFER_STORAGE_KEY, JSON.stringify(this.bufferNotes));
        },

        isImageIdUsedElsewhere(imageId, excludeBufferId = null) {
            const targetToken = `idb://${imageId}`;
            const usedInBuffer = this.bufferNotes.some((b) =>
                b && b.id !== excludeBufferId && typeof b.content === 'string' && b.content.includes(targetToken)
            );
            if (usedInBuffer) return true;
            for (const cached of this.noteBodyCache.values()) {
                if (cached && typeof cached.content === 'string' && cached.content.includes(targetToken)) {
                    return true;
                }
            }
            return false;
        },

        async cleanupBufferImages(content, excludeBufferId = null) {
            if (!content) return;
            const regex = /idb:\/\/([\w_-]+)/g;
            const ids = Array.from(new Set([...content.matchAll(regex)].map((m) => m[1])));
            for (const id of ids) {
                if (!this.isImageIdUsedElsewhere(id, excludeBufferId)) {
                    try { await LessonDB.deleteImage(id); } catch (e) { }
                }
            }
        },

        purgeExpiredBuffers(showNotice = false, now = Date.now()) {
            if (!this.bufferNotes.length) return 0;
            const kept = [];
            const expired = [];

            for (const b of this.bufferNotes) {
                if (!b || !Number.isFinite(b.expiresAt) || now >= b.expiresAt) {
                    if (b) expired.push(b);
                } else {
                    kept.push(b);
                }
            }

            if (!expired.length) return 0;

            this.bufferNotes = kept;
            this.saveBufferNotesLocal();

            expired.forEach((b) => {
                this.cleanupBufferImages(b.content, null);
            });

            const activeWasExpired = this.activeBufferId && expired.some((b) => b.id === this.activeBufferId);
            if (activeWasExpired) {
                this.activeBufferId = null;
                this.hasDirtyEdits = false;
                if (this.mode === 'buffer') {
                    if (this.bufferNotes.length > 0) {
                        this.loadBufferNote(this.bufferNotes[0].id);
                    } else {
                        this.showEmptyEditorState('buffer');
                    }
                }
            }

            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();

            if (showNotice) {
                this.showToast(`Removed ${expired.length} expired 3-day buffer note${expired.length === 1 ? '' : 's'}.`, 'info');
            }
            return expired.length;
        },

        async createBufferNote() {
            await this.flushPendingSave();
            this.mode = 'buffer';
            this.purgeExpiredBuffers(false);

            const now = Date.now();
            const buf = sanitizeBufferNote({
                id: `buf_${now}_${Math.random().toString(36).slice(2, 7)}`,
                title: '',
                content: '',
                createdAt: now,
                updatedAt: now,
                expiresAt: now + BUFFER_TTL_MS
            }, now);

            this.bufferNotes.unshift(buf);
            this.saveBufferNotesLocal();
            await this.loadBufferNote(buf.id, { skipFlush: true });
            this.showToast('Created 3-day temporary buffer note', 'info');

            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                this.toggleSidebar(false);
            }
            setTimeout(() => document.getElementById('noteTitle')?.focus(), 40);
        },

        async loadBufferNote(id, options = {}) {
            if (!options.skipFlush) {
                await this.flushPendingSave();
            }

            this.purgeExpiredBuffers(false);
            const buf = this.bufferNotes.find((b) => b.id === id);
            if (!buf) {
                if (this.bufferNotes.length > 0) {
                    return this.loadBufferNote(this.bufferNotes[0].id, { skipFlush: true });
                }
                this.showEmptyEditorState('buffer');
                return;
            }

            this.mode = 'buffer';
            this.activeBufferId = buf.id;
            const token = ++this.activeLoadToken;
            this.saveUiState();

            document.getElementById('editorEmptyState')?.classList.add('is-hidden');
            document.getElementById('editorDocumentWrap')?.classList.remove('is-hidden');
            document.getElementById('trashBanner')?.classList.add('is-hidden');
            document.getElementById('noteLoadingOverlay')?.classList.add('is-hidden');

            const titleEl = document.getElementById('noteTitle');
            const headerTitle = document.getElementById('headerNoteTitle');
            if (titleEl) {
                titleEl.value = buf.title || '';
                titleEl.disabled = false;
            }
            if (headerTitle) headerTitle.textContent = buf.title || 'Temporary Scratchpad';

            this.updateBufferBanner(buf);
            this.updateHeaderAndModeUI();
            this.renderNotesList();

            await this.loadNoteContentIntoEditor(buf.content || '', token, false);
            if (this.activeLoadToken !== token) return;

            this.hasDirtyEdits = false;
            this.setSaveStatus('buffer');
            this.updateFooterWordCount();
            this.updateOutline();
        },

        updateBufferBanner(buf) {
            const banner = document.getElementById('bufferBanner');
            const badge = document.getElementById('bufferCountdownBadge');
            const expText = document.getElementById('bufferExpiryText');
            const bar = document.getElementById('bufferProgressBar');

            if (!banner || !buf) return;
            banner.classList.remove('is-hidden');

            const info = formatTimeRemaining(buf.expiresAt);
            if (badge) {
                badge.textContent = info.label;
                badge.classList.toggle('is-urgent', info.urgent);
            }
            if (bar) {
                bar.style.width = `${info.pctRemaining}%`;
                bar.classList.toggle('is-urgent', info.urgent);
            }
            if (expText) {
                const expDate = new Date(buf.expiresAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                expText.textContent = `Auto-deletes ${expDate} (local scratchpad — never clutters permanent Notes).`;
            }
        },

        saveCurrentBufferNote() {
            if (this.mode !== 'buffer' || !this.activeBufferId) return;
            const idx = this.bufferNotes.findIndex((b) => b.id === this.activeBufferId);
            if (idx === -1) return;

            const buf = this.bufferNotes[idx];
            buf.title = document.getElementById('noteTitle')?.value ?? '';
            buf.content = this.getContentForSave();
            buf.preview = extractPreview(buf.content, 90);
            buf.updatedAt = Date.now();

            const headerTitle = document.getElementById('headerNoteTitle');
            if (headerTitle) headerTitle.textContent = buf.title || 'Temporary Scratchpad';

            this.bufferNotes.splice(idx, 1);
            this.bufferNotes.unshift(buf);
            this.hasDirtyEdits = false;
            this.saveBufferNotesLocal();
            this.setSaveStatus('buffer');
        },

        extendCurrentBuffer() {
            if (this.mode !== 'buffer' || !this.activeBufferId) return;
            const buf = this.bufferNotes.find((b) => b.id === this.activeBufferId);
            if (!buf) return;

            const now = Date.now();
            buf.expiresAt = now + BUFFER_TTL_MS;
            buf.updatedAt = now;
            this.saveBufferNotesLocal();
            this.updateBufferBanner(buf);
            this.renderNotesList();
            this.showToast('Buffer timer reset to +3 days!', 'success');
        },

        async promoteCurrentBuffer() {
            if (!this.activeBufferId) return;
            if (this.mode === 'buffer') {
                this.saveCurrentBufferNote();
            }

            const idx = this.bufferNotes.findIndex((b) => b.id === this.activeBufferId);
            if (idx === -1) return;
            const buf = this.bufferNotes[idx];

            const newNote = {
                id: Date.now().toString(),
                title: buf.title || 'Promoted Buffer Note',
                content: buf.content || '',
                updatedAt: Date.now(),
                deleted: false,
                folderId: null,
                sortOrder: null
            };

            this.bufferNotes.splice(idx, 1);
            this.saveBufferNotesLocal();
            this.activeBufferId = this.bufferNotes[0]?.id || null;

            this.upsertNoteIndexEntry(newNote, { needsCloudFetch: false });
            this.cacheNoteBody(newNote);
            await LessonDB.putNote(newNote);
            await this.persistIndex();
            this.syncSingleNoteToCloud(newNote);

            this.mode = 'notes';
            await this.loadNote(newNote.id, { skipFlush: true });
            this.showToast('Saved permanently into Notes!', 'success');
        },

        async deleteCurrentBuffer() {
            if (!this.activeBufferId) return;
            await this.deleteBufferNote(this.activeBufferId);
        },

        async deleteBufferNote(id) {
            const idx = this.bufferNotes.findIndex((b) => b.id === id);
            if (idx === -1) return;
            const target = this.bufferNotes[idx];
            this.bufferNotes.splice(idx, 1);
            this.saveBufferNotesLocal();
            await this.cleanupBufferImages(target.content, id);

            if (this.activeBufferId === id) {
                this.hasDirtyEdits = false;
                if (this.bufferNotes.length > 0) {
                    await this.loadBufferNote(this.bufferNotes[0].id, { skipFlush: true });
                } else {
                    this.showEmptyEditorState('buffer');
                }
            }
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast('Deleted buffer note', 'info');
        },

        async clearAllBufferNotes() {
            if (!this.bufferNotes.length) return;
            const ok = await this.showModal(
                'Clear All Buffer Notes?',
                `Delete all ${this.bufferNotes.length} temporary 3-day note(s)?`,
                'Clear Buffer',
                'trash-2'
            );
            if (!ok) return;

            const old = this.bufferNotes.slice();
            this.bufferNotes = [];
            this.activeBufferId = null;
            this.hasDirtyEdits = false;
            this.saveBufferNotesLocal();

            for (const b of old) {
                await this.cleanupBufferImages(b.content, null);
            }

            if (this.mode === 'buffer') {
                this.showEmptyEditorState('buffer');
            }
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast('Cleared temporary buffer notes', 'info');
        },

        refreshBufferCountdowns() {
            this.purgeExpiredBuffers(true);
            if (this.mode === 'buffer') {
                const active = this.bufferNotes.find((b) => b.id === this.activeBufferId);
                if (active) this.updateBufferBanner(active);
                this.renderNotesList();
            }
        },

        /* ========================================================
           PERMANENT TRASH & DELETE FLOWS
           ======================================================== */
        async softDeleteCurrentNote() {
            if (!this.currentNoteId || this.mode !== 'notes') return;
            await this.softDeleteNote(this.currentNoteId);
        },

        async softDeleteNote(noteId) {
            const meta = this.noteIndex.find((n) => n.id === noteId);
            if (!meta || meta.deleted) return;

            const confirmed = await this.showModal('Move to Trash?', 'You can restore this note from Trash for 14 days.', 'Trash It', 'trash-2');
            if (!confirmed) return;

            const now = Date.now();
            const full = await this.ensureFullNote(noteId);
            meta.deleted = true;
            meta.updatedAt = now;

            if (full) {
                full.deleted = true;
                full.updatedAt = now;
                this.cacheNoteBody(full);
                await LessonDB.putNote(full);
                this.syncSingleNoteToCloud(full);
            }
            await this.persistIndex();

            if (noteId === this.currentNoteId) {
                const nextNote = this.noteIndex.find((n) => !n.deleted);
                if (nextNote) await this.loadNote(nextNote.id, { skipFlush: true });
                else await this.createNewNote({ skipMobileClose: true });
            } else {
                this.renderNotesList();
            }
            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
        },

        async restoreCurrentNote() {
            if (!this.currentNoteId) return;
            const meta = this.noteIndex.find((n) => n.id === this.currentNoteId);
            if (!meta) return;

            meta.deleted = false;
            meta.updatedAt = Date.now();
            const full = await this.ensureFullNote(meta.id);
            if (full) {
                full.deleted = false;
                full.updatedAt = meta.updatedAt;
                this.cacheNoteBody(full);
                await LessonDB.putNote(full);
                this.syncSingleNoteToCloud(full);
            }
            await this.persistIndex();

            const nextTrash = this.noteIndex.find((n) => n.deleted);
            if (nextTrash) {
                await this.loadNote(nextTrash.id, { skipFlush: true });
            } else {
                this.mode = 'notes';
                await this.loadNote(meta.id, { skipFlush: true });
            }
            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast('Note restored!', 'success');
        },

        async deleteImagesInContent(content) {
            if (!content) return;
            const localRegex = /idb:\/\/([\w_-]+)/g;
            const localIds = Array.from(new Set([...content.matchAll(localRegex)].map((m) => m[1])));
            for (const imgId of localIds) {
                try { await LessonDB.deleteImage(imgId); } catch (e) { }
            }
            if (typeof deleteMediaFromUrl === 'function') {
                const cloudRegex = /https:\/\/[^"'\s]+\/storage\/v1\/object\/public\/klasskit-media\/[^"'\s]+/g;
                const cloudMatches = content.match(cloudRegex) || [];
                for (const cloudUrl of cloudMatches) {
                    try { await deleteMediaFromUrl(cloudUrl); } catch (e) { }
                }
            }
        },

        async permanentDeleteCurrentNote() {
            if (!this.currentNoteId) return;
            const confirmed = await this.showModal('Delete Forever?', 'This note and its attachments will be permanently removed.', 'Delete Forever', 'trash-2');
            if (!confirmed) return;

            const id = this.currentNoteId;
            const full = await LessonDB.getNote(id);
            if (full) {
                await this.deleteImagesInContent(full.content);
            }
            await LessonDB.deleteNote(id);
            this.noteBodyCache.delete(id);
            this.noteIndex = this.noteIndex.filter((n) => n.id !== id);
            await this.persistIndex();
            this.updateCacheStatusLabel();

            const nextTrash = this.noteIndex.find((n) => n.deleted);
            if (nextTrash) {
                await this.loadNote(nextTrash.id, { skipFlush: true });
            } else {
                this.showEmptyEditorState('trash');
            }
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
        },

        async emptyTrash() {
            const trashed = this.noteIndex.filter((n) => n.deleted);
            if (!trashed.length) return;

            const confirmed = await this.showModal(
                'Empty Trash?',
                `Permanently delete ${trashed.length} trashed note(s)? This cannot be undone.`,
                'Delete All',
                'flame'
            );
            if (!confirmed) return;

            for (const meta of trashed) {
                const full = await LessonDB.getNote(meta.id);
                if (full) await this.deleteImagesInContent(full.content);
                await LessonDB.deleteNote(meta.id);
                this.noteBodyCache.delete(meta.id);
            }

            const trashedIds = new Set(trashed.map((n) => n.id));
            this.noteIndex = this.noteIndex.filter((n) => !trashedIds.has(n.id));
            await this.persistIndex();
            this.updateCacheStatusLabel();

            if (this.mode === 'trash') {
                this.showEmptyEditorState('trash');
            }
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast('Trash emptied', 'info');
        },

        async purgeExpiredTrash() {
            const now = Date.now();
            const expired = this.noteIndex.filter((n) => n.deleted && (now - (n.updatedAt || 0)) > TRASH_TTL_MS);
            if (!expired.length) return 0;

            for (const meta of expired) {
                const full = await LessonDB.getNote(meta.id);
                if (full) await this.deleteImagesInContent(full.content);
                await LessonDB.deleteNote(meta.id);
                this.noteBodyCache.delete(meta.id);
            }

            const expIds = new Set(expired.map((e) => e.id));
            this.noteIndex = this.noteIndex.filter((n) => !expIds.has(n.id));
            await this.persistIndex();
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            return expired.length;
        },

        /* ========================================================
           METADATA-ONLY BACKGROUND CLOUD SYNC + SINGLE-NOTE UPSERT
           ======================================================== */
        setSyncBadge(text, iconName = 'hard-drive', toneClass = 'text-blue') {
            const badge = document.getElementById('syncBadge');
            if (!badge) return;
            badge.innerHTML = `<i data-lucide="${escapeHtml(iconName)}" class="w-3.5 h-3.5 ${escapeHtml(toneClass)}"></i><span>${escapeHtml(text)}</span>`;
            this.safeCreateIcons(badge);
        },

        async syncSingleNoteToCloud(note) {
            if (!note || !note.id || typeof getCloudUser !== 'function' || typeof db === 'undefined') return;
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return;

                this.setSyncBadge('Syncing...', 'loader-circle', 'text-blue animate-spin');
                await db.from('notes').upsert({
                    id: note.id,
                    user_id: user.id,
                    title: note.title || '',
                    content: note.content || '',
                    folder_id: note.folderId || null,
                    deleted: Boolean(note.deleted),
                    updated_at: note.updatedAt
                }, { onConflict: 'id,user_id' });

                this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
            } catch (e) {
                console.warn('Single-note cloud upsert skipped:', e);
                this.setSyncBadge('Local Saved', 'cloud-off', 'text-orange');
            }
        },

        async syncBatchMetadataToCloud(ids, patch) {
            if (!Array.isArray(ids) || !ids.length || typeof getCloudUser !== 'function' || typeof db === 'undefined') return;
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return;

                this.setSyncBadge('Syncing...', 'loader-circle', 'text-blue animate-spin');
                const table = db.from('notes');
                if (table && typeof table.update === 'function') {
                    const q = table.update(patch);
                    if (q && typeof q.in === 'function') {
                        const qIn = q.in('id', ids);
                        if (qIn && typeof qIn.eq === 'function') {
                            await qIn.eq('user_id', user.id);
                        }
                    }
                }
                this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
            } catch (e) {
                console.warn('Batch cloud metadata sync skipped:', e);
                this.setSyncBadge('Local Saved', 'cloud-off', 'text-orange');
            }
        },

        async saveFoldersToCloud() {
            if (typeof getCloudUser !== 'function' || typeof db === 'undefined') return;
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return;
                await db.from('note_folders').upsert({
                    user_id: user.id,
                    folders: this.folders
                }, { onConflict: 'user_id' });
            } catch (e) {
                console.warn('Folder cloud sync skipped:', e);
            }
        },

        async syncCloudMetadataInBackground() {
            if (typeof getCloudUser !== 'function' || typeof db === 'undefined') {
                this.setSyncBadge('Local Mode', 'hard-drive', 'text-blue');
                return;
            }
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) {
                    this.setSyncBadge('Local Mode', 'hard-drive', 'text-blue');
                    return;
                }

                this.setSyncBadge('Syncing Meta...', 'loader-circle', 'text-blue animate-spin');

                const [notesRes, foldersRes] = await Promise.all([
                    db.from('notes')
                        .select('id, title, folder_id, deleted, updated_at')
                        .eq('user_id', user.id)
                        .order('updated_at', { ascending: false }),
                    db.from('note_folders')
                        .select('folders')
                        .eq('user_id', user.id)
                        .maybeSingle()
                ]);

                if (notesRes && notesRes.error) throw notesRes.error;

                let indexChanged = false;
                const cloudRows = Array.isArray(notesRes?.data) ? notesRes.data : [];

                cloudRows.forEach((cn) => {
                    if (!cn || !cn.id) return;
                    const cnId = String(cn.id);
                    const cnUpdated = Number(cn.updated_at) || Date.now();
                    const existing = this.noteIndex.find((m) => m.id === cnId);

                    if (!existing) {
                        this.noteIndex.push(sanitizeIndexEntry({
                            id: cnId,
                            title: cn.title || '',
                            preview: '',
                            folderId: cn.folder_id ? String(cn.folder_id) : null,
                            deleted: Boolean(cn.deleted),
                            updatedAt: cnUpdated,
                            sortOrder: null,
                            needsCloudFetch: true
                        }));
                        indexChanged = true;
                    } else if (cnUpdated > (existing.updatedAt || 0)) {
                        existing.title = cn.title || '';
                        existing.folderId = cn.folder_id ? String(cn.folder_id) : null;
                        existing.deleted = Boolean(cn.deleted);
                        existing.updatedAt = cnUpdated;
                        existing.needsCloudFetch = true;
                        this.noteBodyCache.delete(cnId);
                        indexChanged = true;
                    }
                });

                if (foldersRes?.data?.folders && Array.isArray(foldersRes.data.folders)) {
                    this.folders = sanitizeFoldersList(foldersRes.data.folders);
                    this.saveFoldersMirror();
                    await LessonDB.putSetting(SETTINGS_KEYS.FOLDERS, this.folders);
                    indexChanged = true;
                }

                if (indexChanged) {
                    this.noteIndex.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    await this.persistIndex();
                    this.renderNotesList();
                    this.updateHeaderAndModeUI();
                    this.refreshFileManagerIfOpen();
                }

                // If active open note received a newer cloud version and has no local unsaved edits, fetch just that 1 note
                if (this.mode !== 'buffer' && this.currentNoteId && !this.hasDirtyEdits) {
                    const activeMeta = this.noteIndex.find((m) => m.id === this.currentNoteId);
                    if (activeMeta && activeMeta.needsCloudFetch) {
                        await this.loadNote(activeMeta.id, { skipFlush: true });
                    }
                }

                this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
            } catch (e) {
                console.warn('Metadata cloud sync failed cleanly:', e);
                this.setSyncBadge('Offline Ready', 'cloud-off', 'text-orange');
            }
        },

        async fetchSingleNoteFromCloud(id) {
            if (typeof getCloudUser !== 'function' || typeof db === 'undefined') return null;
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return null;

                const { data, error } = await db
                    .from('notes')
                    .select('id, title, content, folder_id, deleted, updated_at')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error || !data) return null;
                return {
                    id: String(data.id),
                    title: data.title || '',
                    content: data.content || '',
                    folderId: data.folder_id ? String(data.folder_id) : null,
                    deleted: Boolean(data.deleted),
                    updatedAt: Number(data.updated_at) || Date.now()
                };
            } catch (e) {
                console.warn('Single-note cloud fetch failed:', e);
                return null;
            }
        },

        /* ========================================================
           PAGINATED SIDEBAR RENDERING & ON-DEMAND DEEP SEARCH
           ======================================================== */
        sortNotes(list) {
            const sorted = [...list];
            switch (this.sortMode) {
                case 'date-desc': return sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                case 'date-asc': return sorted.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
                case 'title-asc': return sorted.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
                case 'title-desc': return sorted.sort((a, b) => (b.title || 'Untitled').localeCompare(a.title || 'Untitled'));
                case 'manual': return sorted.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
                default: return sorted;
            }
        },

        toggleSortDropdown() {
            const dropdown = document.getElementById('sortDropdown');
            if (!dropdown) return;
            dropdown.classList.toggle('is-hidden');
            if (!dropdown.classList.contains('is-hidden')) {
                this.safeCreateIcons(dropdown);
            }
        },

        async setSortMode(mode) {
            this.sortMode = mode;
            this.saveUiState();
            await LessonDB.putSetting(SETTINGS_KEYS.SORT_MODE, mode);
            this.updateSortDropdownUI();
            document.getElementById('sortDropdown')?.classList.add('is-hidden');
            this.renderNotesList();
            const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'title-asc': 'A to Z', 'title-desc': 'Z to A', manual: 'Manual' };
            this.showToast(`Sorted: ${labels[mode] || mode}`, 'info');
        },

        updateSortDropdownUI() {
            document.querySelectorAll('#sortDropdown button').forEach((btn) => {
                btn.classList.toggle('active-sort', btn.dataset.sort === this.sortMode);
            });
        },

        clearSearch() {
            const searchEl = document.getElementById('searchInput');
            if (searchEl) searchEl.value = '';
            document.getElementById('clearSearchBtn')?.classList.add('is-hidden');
            this.deepSearchHits = null;
            this.deepSearchToken++;
            this.visibleCounts.delete('flat');
            this.renderNotesList();
        },

        async runDeepContentSearch() {
            const query = (document.getElementById('searchInput')?.value || '').trim();
            if (!query) return;

            const token = ++this.deepSearchToken;
            const statusEl = document.getElementById('deepSearchStatus');
            if (statusEl) statusEl.textContent = 'Scanning note bodies...';

            const hits = await LessonDB.searchBodiesViaCursor(query, () => this.deepSearchToken !== token);
            if (this.deepSearchToken !== token) return;

            this.deepSearchHits = hits;
            this.renderNotesList();
        },

        loadMoreNotes(groupKey) {
            const key = groupKey || 'flat';
            const isFolder = key.startsWith('folder:');
            const currentLimit = this.visibleCounts.get(key) || (isFolder ? FOLDER_PAGE_SIZE : PAGE_SIZE);
            this.visibleCounts.set(key, currentLimit + PAGE_SIZE);
            this.renderNotesList();
        },

        createLoadMoreButton(remaining, groupKey) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'w-full mt-1.5 py-1.5 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs font-extrabold text-blue hover:bg-blue/10 hover:border-blue transition-colors flex items-center justify-center gap-1.5 cursor-pointer';
            btn.innerHTML = `<i data-lucide="chevrons-down" class="w-3.5 h-3.5"></i><span>Show more (${remaining} left)</span>`;
            btn.onclick = () => this.loadMoreNotes(groupKey);
            return btn;
        },

        renderNotesList() {
            const list = document.getElementById('notesList');
            if (!list) return;

            const search = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
            const deepBanner = document.getElementById('deepSearchBanner');
            const deepStatus = document.getElementById('deepSearchStatus');
            const deepBtn = document.getElementById('deepSearchBtn');

            if (deepBanner) {
                const showDeep = Boolean(search && this.mode === 'notes');
                deepBanner.classList.toggle('is-hidden', !showDeep);
                if (showDeep && deepStatus && deepBtn) {
                    if (this.deepSearchHits) {
                        deepStatus.textContent = `Full-text search active (${this.deepSearchHits.size} match${this.deepSearchHits.size === 1 ? '' : 'es'})`;
                        deepBtn.classList.add('is-hidden');
                    } else {
                        deepStatus.textContent = 'Searched titles & snippets';
                        deepBtn.classList.remove('is-hidden');
                    }
                }
            }

            list.innerHTML = '';

            // 1. 3-Day Buffer Mode
            if (this.mode === 'buffer') {
                const filtered = this.bufferNotes.filter((b) => {
                    if (!search) return true;
                    return (b.title || 'Untitled').toLowerCase().includes(search) ||
                        (b.preview || '').toLowerCase().includes(search);
                });

                if (!filtered.length) {
                    list.innerHTML = `
                        <div class="p-6 text-center space-y-2">
                            <i data-lucide="hourglass" class="w-8 h-8 text-orange/60 mx-auto"></i>
                            <p class="text-xs font-extrabold text-slate-400">${search ? 'No matching buffer notes.' : 'No temporary notes right now. Click 3d to start one!'}</p>
                        </div>
                    `;
                    this.safeCreateIcons(list);
                    return;
                }

                const limit = this.visibleCounts.get('flat') || PAGE_SIZE;
                const slice = filtered.slice(0, limit);
                const fragment = document.createDocumentFragment();
                slice.forEach((b) => fragment.appendChild(this.buildBufferItem(b)));
                if (filtered.length > limit) {
                    fragment.appendChild(this.createLoadMoreButton(filtered.length - limit, 'flat'));
                }
                list.appendChild(fragment);
                this.safeCreateIcons(list);
                return;
            }

            // 2. Permanent Notes or Trash Mode (metadata-only index)
            const modeFiltered = this.noteIndex.filter((n) => (this.mode === 'trash' ? n.deleted === true : n.deleted !== true));

            if (search || this.mode === 'trash') {
                const filtered = modeFiltered.filter((n) => {
                    if (!search) return true;
                    if (this.deepSearchHits && this.deepSearchHits.has(n.id)) return true;
                    return (n.title || 'Untitled').toLowerCase().includes(search) ||
                        (n.preview || '').toLowerCase().includes(search);
                });

                if (!filtered.length) {
                    const icon = this.mode === 'trash' ? 'trash-2' : (search ? 'search' : 'pen-tool');
                    const msg = this.mode === 'trash'
                        ? 'Trash is empty'
                        : (search ? 'No matching titles or snippets' : 'No notes yet');
                    list.innerHTML = `
                        <div class="p-6 text-center space-y-2">
                            <i data-lucide="${icon}" class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto"></i>
                            <p class="text-xs font-extrabold text-slate-400">${msg}</p>
                        </div>
                    `;
                    this.safeCreateIcons(list);
                    return;
                }

                const sorted = this.sortNotes(filtered);
                const limit = this.visibleCounts.get('flat') || PAGE_SIZE;
                const slice = sorted.slice(0, limit);
                const fragment = document.createDocumentFragment();
                slice.forEach((n) => fragment.appendChild(this.buildNoteItem(n, sorted)));
                if (sorted.length > limit) {
                    fragment.appendChild(this.createLoadMoreButton(sorted.length - limit, 'flat'));
                }
                list.appendChild(fragment);
                this.safeCreateIcons(list);
                return;
            }

            // 3. Folder-Grouped Permanent Notes View
            if (!modeFiltered.length && !this.folders.length) {
                list.innerHTML = `
                    <div class="p-6 text-center space-y-2">
                        <i data-lucide="pen-tool" class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto"></i>
                        <p class="text-xs font-extrabold text-slate-400">No notes yet. Click New Note to start!</p>
                    </div>
                `;
                this.safeCreateIcons(list);
                return;
            }

            const fragment = document.createDocumentFragment();

            this.folders.forEach((folder) => {
                const folderNotes = this.sortNotes(modeFiltered.filter((n) => n.folderId === folder.id));
                const section = document.createElement('div');
                section.className = 'mb-2';

                const isActive = this.activeFolderId === folder.id;
                const chevron = folder.collapsed ? 'chevron-right' : 'chevron-down';
                const folderIcon = folder.collapsed ? 'folder' : 'folder-open';

                const headerDiv = document.createElement('div');
                headerDiv.className = `folder-header flex items-center gap-2 px-2 py-1.5 rounded-xl border-2 border-transparent cursor-pointer select-none group ${isActive ? 'bg-slate-100/90 dark:bg-slate-800/90' : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50'}`;
                headerDiv.dataset.folderId = folder.id;
                headerDiv.innerHTML = `
                    <i data-lucide="${chevron}" class="w-3.5 h-3.5 text-slate-400 flex-none"></i>
                    <i data-lucide="${folderIcon}" class="w-4 h-4 flex-none" style="color: ${escapeHtml(folder.color)}"></i>
                    <span class="font-extrabold text-xs text-dark dark:text-slate-200 truncate flex-1">${escapeHtml(folder.name)}</span>
                    <span class="text-[10px] font-black text-slate-400 flex-none">${folderNotes.length}</span>
                    <button type="button" class="folder-menu-btn opacity-0 group-hover:opacity-100 text-slate-400 hover:text-dark dark:hover:text-white p-1 rounded-lg transition-all cursor-pointer">
                        <i data-lucide="ellipsis" class="w-3.5 h-3.5 pointer-events-none"></i>
                    </button>
                `;

                const menuBtn = headerDiv.querySelector('.folder-menu-btn');
                if (menuBtn) {
                    menuBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        this.showFolderMenu(ev, folder.id);
                    };
                }

                headerDiv.addEventListener('click', (ev) => {
                    if (ev.target.closest('.folder-menu-btn')) return;
                    this.activeFolderId = (this.activeFolderId === folder.id) ? null : folder.id;
                    folder.collapsed = !folder.collapsed;
                    this.saveFolders();
                    this.renderNotesList();
                });

                this.setupFolderDropTarget(headerDiv, folder.id);
                section.appendChild(headerDiv);

                if (!folder.collapsed) {
                    if (folderNotes.length > 0) {
                        const groupKey = `folder:${folder.id}`;
                        const limit = this.visibleCounts.get(groupKey) || FOLDER_PAGE_SIZE;
                        const slice = folderNotes.slice(0, limit);
                        const box = document.createElement('div');
                        box.className = 'pl-3 ml-2.5 border-l-2 border-slate-200 dark:border-slate-700 mt-1 space-y-1';
                        slice.forEach((n) => box.appendChild(this.buildNoteItem(n, folderNotes)));
                        if (folderNotes.length > limit) {
                            box.appendChild(this.createLoadMoreButton(folderNotes.length - limit, groupKey));
                        }
                        section.appendChild(box);
                    } else {
                        const emptyHint = document.createElement('div');
                        emptyHint.className = 'text-[11px] font-bold text-slate-400 pl-8 py-1 italic';
                        emptyHint.textContent = 'Drop notes here';
                        section.appendChild(emptyHint);
                    }
                }

                fragment.appendChild(section);
            });

            const unfiledNotes = this.sortNotes(modeFiltered.filter((n) => !n.folderId || !this.folders.some((f) => f.id === n.folderId)));
            if (unfiledNotes.length > 0 || this.folders.length > 0) {
                if (this.folders.length > 0) {
                    const unfiledHeader = document.createElement('div');
                    unfiledHeader.className = 'flex items-center gap-2 px-2 py-1.5 mt-2 rounded-xl border-2 border-transparent text-xs font-extrabold text-slate-500 dark:text-slate-400';
                    unfiledHeader.innerHTML = `
                        <i data-lucide="inbox" class="w-3.5 h-3.5 flex-none"></i>
                        <span class="flex-1">Unfiled</span>
                        <span class="text-[10px] font-black">${unfiledNotes.length}</span>
                    `;
                    this.setupUnfiledDropTarget(unfiledHeader);
                    fragment.appendChild(unfiledHeader);
                }
                const limit = this.visibleCounts.get('unfiled') || PAGE_SIZE;
                unfiledNotes.slice(0, limit).forEach((n) => fragment.appendChild(this.buildNoteItem(n, unfiledNotes)));
                if (unfiledNotes.length > limit) {
                    fragment.appendChild(this.createLoadMoreButton(unfiledNotes.length - limit, 'unfiled'));
                }
            }

            list.appendChild(fragment);
            this.safeCreateIcons(list);
        },

        buildBufferItem(buf) {
            const el = document.createElement('div');
            const isActive = buf.id === this.activeBufferId;
            const timeInfo = formatTimeRemaining(buf.expiresAt);
            const title = buf.title || 'Untitled Scratchpad';

            el.className = `note-item group/note ${isActive ? 'active-buffer' : ''}`;
            el.dataset.bufferId = buf.id;
            el.onclick = (e) => {
                if (e.target.closest('.buffer-del-btn')) return;
                this.loadBufferNote(buf.id);
                if (typeof window !== 'undefined' && window.innerWidth < 768) this.toggleSidebar(false);
            };

            el.innerHTML = `
                <div class="flex items-start gap-2 min-w-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-1.5">
                            <h4 class="font-extrabold text-xs truncate text-dark dark:text-slate-100">${escapeHtml(title)}</h4>
                            <span class="buffer-countdown-pill ${timeInfo.urgent ? 'is-urgent' : ''} flex-none">${escapeHtml(timeInfo.label)}</span>
                        </div>
                        <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(buf.preview || 'Empty temporary scratchpad...')}</p>
                    </div>
                    <button type="button" class="buffer-del-btn opacity-0 group-hover/note:opacity-100 text-slate-400 hover:text-pink p-1 rounded-lg transition-all flex-none cursor-pointer" title="Delete buffer note">
                        <i data-lucide="x" class="w-3.5 h-3.5 pointer-events-none"></i>
                    </button>
                </div>
            `;

            const delBtn = el.querySelector('.buffer-del-btn');
            if (delBtn) {
                delBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.deleteBufferNote(buf.id);
                };
            }
            return el;
        },

        buildNoteItem(note, groupNotes) {
            const el = document.createElement('div');
            const title = note.title || 'Untitled';
            const dateStr = new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const isActive = note.id === this.currentNoteId;

            el.className = `note-item group/note ${isActive ? (this.mode === 'trash' ? 'active-trash' : 'active') : ''}`;
            el.dataset.noteId = note.id;

            if (this.mode !== 'trash') {
                el.draggable = true;
                el.addEventListener('dragstart', (e) => this.handleDragStart(e, note.id));
                el.addEventListener('dragend', () => this.handleDragEnd());
                this.setupNoteReorderDrop(el, note.id, groupNotes || []);
            }

            el.onclick = (e) => {
                if (e.target.closest('.note-ctx-trigger')) return;
                this.loadNote(note.id);
                if (typeof window !== 'undefined' && window.innerWidth < 768) this.toggleSidebar(false);
            };

            const deepPreview = (this.deepSearchHits && this.deepSearchHits.has(note.id))
                ? this.deepSearchHits.get(note.id)
                : (note.preview || '');

            el.innerHTML = `
                <div class="flex items-center gap-1.5 min-w-0">
                    ${this.mode !== 'trash'
                        ? '<i data-lucide="grip-vertical" class="w-3.5 h-3.5 flex-none text-slate-300 dark:text-slate-600 opacity-0 group-hover/note:opacity-100"></i>'
                        : '<span class="w-1 flex-none"></span>'}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-1.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                ${note.needsCloudFetch ? '<span class="cloud-pending-dot" title="Loads content on click"></span>' : ''}
                                <h4 class="font-extrabold text-xs truncate text-dark dark:text-slate-100">${escapeHtml(title)}</h4>
                            </div>
                            <span class="text-[10px] font-bold text-slate-400 flex-none">${escapeHtml(dateStr)}</span>
                        </div>
                        <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(deepPreview || (note.needsCloudFetch ? 'Click to load from cloud...' : 'Empty note...'))}</p>
                    </div>
                    ${this.mode !== 'trash'
                        ? `<button type="button" class="note-ctx-trigger opacity-0 group-hover/note:opacity-100 text-slate-400 hover:text-dark dark:hover:text-white p-1 rounded-lg transition-all flex-none cursor-pointer">
                            <i data-lucide="ellipsis-vertical" class="w-3.5 h-3.5 pointer-events-none"></i>
                           </button>`
                        : ''}
                </div>
            `;

            const ctxBtn = el.querySelector('.note-ctx-trigger');
            if (ctxBtn) {
                ctxBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.showNoteContextMenu(ev, note.id);
                };
            }

            return el;
        },

        /* ========================================================
           DRAG & DROP REORDER / FOLDER MOVE
           ======================================================== */
        handleDragStart(e, noteId) {
            this.draggedNoteId = noteId;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', noteId);
            }
            setTimeout(() => {
                document.querySelector(`[data-note-id="${noteId}"]`)?.classList.add('note-dragging');
            }, 0);
        },

        handleDragEnd() {
            document.querySelectorAll('.note-dragging').forEach((el) => el.classList.remove('note-dragging'));
            document.querySelectorAll('.folder-drop-target').forEach((el) => el.classList.remove('folder-drop-target'));
            document.querySelectorAll('.unfiled-drop-target').forEach((el) => el.classList.remove('unfiled-drop-target'));
            document.querySelectorAll('.drop-indicator').forEach((el) => el.remove());
            this.draggedNoteId = null;
        },

        setupFolderDropTarget(headerEl, folderId) {
            headerEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                headerEl.classList.add('folder-drop-target');
            });
            headerEl.addEventListener('dragleave', () => {
                headerEl.classList.remove('folder-drop-target');
            });
            headerEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                headerEl.classList.remove('folder-drop-target');
                const noteId = e.dataTransfer?.getData('text/plain');
                if (!noteId) return;
                const meta = this.noteIndex.find((n) => n.id === noteId);
                if (meta && meta.folderId !== folderId) {
                    await this.moveNoteToFolder(noteId, folderId);
                    const folder = this.folders.find((f) => f.id === folderId);
                    this.showToast(`Moved to "${folder?.name || 'folder'}"`, 'folder');
                }
            });
        },

        setupUnfiledDropTarget(headerEl) {
            headerEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                headerEl.classList.add('unfiled-drop-target');
            });
            headerEl.addEventListener('dragleave', () => {
                headerEl.classList.remove('unfiled-drop-target');
            });
            headerEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                headerEl.classList.remove('unfiled-drop-target');
                const noteId = e.dataTransfer?.getData('text/plain');
                if (!noteId) return;
                const meta = this.noteIndex.find((n) => n.id === noteId);
                if (meta && meta.folderId) {
                    await this.moveNoteToFolder(noteId, null);
                    this.showToast('Moved to Unfiled', 'info');
                }
            });
        },

        setupNoteReorderDrop(noteEl, targetNoteId, groupNotes) {
            noteEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (targetNoteId === this.draggedNoteId) return;
                const rect = noteEl.getBoundingClientRect();
                const isAbove = e.clientY < (rect.top + rect.height / 2);
                noteEl.parentElement?.querySelectorAll('.drop-indicator').forEach((el) => el.remove());
                const indicator = document.createElement('div');
                indicator.className = 'drop-indicator';
                noteEl.parentElement?.insertBefore(indicator, isAbove ? noteEl : noteEl.nextSibling);
            });

            noteEl.addEventListener('dragleave', () => {
                noteEl.parentElement?.querySelectorAll('.drop-indicator').forEach((el) => el.remove());
            });

            noteEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                noteEl.parentElement?.querySelectorAll('.drop-indicator').forEach((el) => el.remove());
                const noteId = e.dataTransfer?.getData('text/plain');
                if (!noteId || noteId === targetNoteId) return;

                const dragMeta = this.noteIndex.find((n) => n.id === noteId);
                const targetMeta = this.noteIndex.find((n) => n.id === targetNoteId);
                if (!dragMeta || !targetMeta) return;

                dragMeta.folderId = targetMeta.folderId || null;
                const rect = noteEl.getBoundingClientRect();
                const insertBefore = e.clientY < (rect.top + rect.height / 2);

                const targetIdx = groupNotes.findIndex((n) => n.id === targetNoteId);
                const newOrder = groupNotes.filter((n) => n.id !== noteId);
                const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
                newOrder.splice(Math.min(insertIdx, newOrder.length), 0, dragMeta);

                for (let i = 0; i < newOrder.length; i++) {
                    newOrder[i].sortOrder = i;
                    newOrder[i].updatedAt = Date.now();
                    const full = await LessonDB.getNote(newOrder[i].id);
                    if (full) {
                        full.folderId = newOrder[i].folderId;
                        full.sortOrder = i;
                        full.updatedAt = newOrder[i].updatedAt;
                        await LessonDB.putNote(full);
                    }
                }

                if (this.sortMode !== 'manual') {
                    this.sortMode = 'manual';
                    this.saveUiState();
                    await LessonDB.putSetting(SETTINGS_KEYS.SORT_MODE, 'manual');
                    this.updateSortDropdownUI();
                }

                await this.persistIndex();
                this.renderNotesList();
                this.showToast('Notes reordered', 'success');
            });
        },

        /* ========================================================
           FOLDER CRUD & CONTEXT MENUS
           ======================================================== */
        async saveFolders() {
            this.saveFoldersMirror();
            await LessonDB.putSetting(SETTINGS_KEYS.FOLDERS, this.folders);
            this.saveFoldersToCloud();
        },

        async createFolder() {
            const name = await this.showPrompt('New Folder', 'Organize your notes into a workspace folder', 'folder-plus');
            if (!name || !name.trim()) return;
            const color = FOLDER_COLORS[this.folders.length % FOLDER_COLORS.length].hex;
            this.folders.push({ id: `folder_${Date.now()}`, name: name.trim().slice(0, 80), color, collapsed: false });
            await this.saveFolders();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast(`Folder "${name.trim()}" created!`, 'folder');
        },

        async renameFolder(id) {
            const folder = this.folders.find((f) => f.id === id);
            if (!folder) return;
            const newName = await this.showPrompt('Rename Folder', 'Enter a new folder name', 'pencil', folder.name);
            if (!newName || !newName.trim()) return;
            folder.name = newName.trim().slice(0, 80);
            await this.saveFolders();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast('Folder renamed', 'success');
        },

        async changeFolderColor(id) {
            const folder = this.folders.find((f) => f.id === id);
            if (!folder) return;
            const cur = FOLDER_COLORS.findIndex((c) => c.hex === folder.color);
            folder.color = FOLDER_COLORS[(cur + 1) % FOLDER_COLORS.length].hex;
            await this.saveFolders();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
        },

        async deleteUserFolder(id) {
            const folder = this.folders.find((f) => f.id === id);
            if (!folder) return;
            const affected = this.noteIndex.filter((n) => n.folderId === id && !n.deleted);
            const confirmed = await this.showModal(
                'Delete Folder?',
                `"${folder.name}" will be deleted. ${affected.length} note(s) inside will move to Unfiled.`,
                'Delete Folder',
                'trash-2'
            );
            if (!confirmed) return;

            const allInFolder = this.noteIndex.filter((n) => n.folderId === id);
            const now = Date.now();
            const updatedIds = [];

            for (const meta of allInFolder) {
                meta.folderId = null;
                meta.updatedAt = now;
                updatedIds.push(meta.id);
                const cached = this.noteBodyCache.get(meta.id);
                if (cached) {
                    cached.folderId = null;
                    cached.updatedAt = now;
                }
                const full = await LessonDB.getNote(meta.id);
                if (full) {
                    full.folderId = null;
                    full.updatedAt = now;
                    await LessonDB.putNote(full);
                }
            }

            this.folders = this.folders.filter((f) => f.id !== id);
            if (this.activeFolderId === id) this.activeFolderId = null;
            this.fmState.selectedFolderIds.delete(id);
            if (this.fmState.view === `folder:${id}`) {
                this.fmState.view = 'root';
                this.fmState.selectedNoteIds.clear();
                this.fmState.lastClickedIndex = null;
            }

            await this.persistIndex();
            await this.saveFolders();
            if (updatedIds.length) {
                this.syncBatchMetadataToCloud(updatedIds, { folder_id: null, updated_at: now });
            }
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast(`Deleted folder "${folder.name}"`, 'info');
        },

        async moveNoteToFolder(noteId, folderId) {
            const meta = this.noteIndex.find((n) => n.id === noteId);
            if (!meta) return;
            meta.folderId = folderId || null;
            meta.updatedAt = Date.now();
            const full = await this.ensureFullNote(noteId);
            if (full) {
                full.folderId = meta.folderId;
                full.updatedAt = meta.updatedAt;
                this.cacheNoteBody(full);
                await LessonDB.putNote(full);
                this.syncSingleNoteToCloud(full);
            }
            await this.persistIndex();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
        },

        showNoteContextMenu(e, noteId) {
            document.querySelectorAll('.note-ctx-menu').forEach((m) => m.remove());
            const menu = document.createElement('div');
            menu.className = 'note-ctx-menu fixed z-50 py-1.5 min-w-[185px]';

            if (this.folders.length > 0) {
                const hdr = document.createElement('div');
                hdr.className = 'text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 py-1';
                hdr.textContent = 'Move to';
                menu.appendChild(hdr);

                this.folders.forEach((f) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-full text-left px-3 py-1.5 text-xs font-bold text-dark dark:text-slate-200 hover:bg-blue/10 flex items-center gap-2 transition-colors cursor-pointer';
                    btn.innerHTML = `<span class="w-2.5 h-2.5 rounded-full flex-none" style="background:${escapeHtml(f.color)}"></span><span class="truncate">${escapeHtml(f.name)}</span>`;
                    btn.onclick = () => {
                        menu.remove();
                        this.moveNoteToFolder(noteId, f.id);
                    };
                    menu.appendChild(btn);
                });

                const unfiledBtn = document.createElement('button');
                unfiledBtn.type = 'button';
                unfiledBtn.className = 'w-full text-left px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 hover:bg-blue/10 flex items-center gap-2 transition-colors cursor-pointer';
                unfiledBtn.innerHTML = '<i data-lucide="inbox" class="w-3.5 h-3.5 flex-none"></i><span>Unfiled</span>';
                unfiledBtn.onclick = () => {
                    menu.remove();
                    this.moveNoteToFolder(noteId, null);
                };
                menu.appendChild(unfiledBtn);

                const divider = document.createElement('div');
                divider.className = 'border-t border-slate-200 dark:border-slate-700 my-1 mx-2';
                menu.appendChild(divider);
            }

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'w-full text-left px-3 py-1.5 text-xs font-extrabold text-pink hover:bg-pink/10 flex items-center gap-2 transition-colors cursor-pointer';
            delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5 flex-none"></i><span>Move to Trash</span>';
            delBtn.onclick = () => {
                menu.remove();
                this.softDeleteNote(noteId);
            };
            menu.appendChild(delBtn);

            const rect = e.target.closest('.note-ctx-trigger')?.getBoundingClientRect() || { bottom: 80, left: 160 };
            menu.style.top = `${Math.min(rect.bottom + 4, (window.innerHeight || 700) - 240)}px`;
            menu.style.left = `${Math.max(8, Math.min(rect.left - 130, (window.innerWidth || 900) - 200))}px`;

            document.body.appendChild(menu);
            this.safeCreateIcons(menu);
        },

        showFolderMenu(e, folderId) {
            document.querySelectorAll('.note-ctx-menu').forEach((m) => m.remove());
            const menu = document.createElement('div');
            menu.className = 'note-ctx-menu fixed z-50 py-1.5 min-w-[180px]';
            menu.innerHTML = `
                <button type="button" data-f-action="manage" class="w-full text-left px-3 py-1.5 text-xs font-extrabold text-blue hover:bg-blue/10 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="folder-tree" class="w-3.5 h-3.5 flex-none"></i><span>Manage in Files</span>
                </button>
                <div class="border-t border-slate-200 dark:border-slate-700 my-1 mx-2"></div>
                <button type="button" data-f-action="rename" class="w-full text-left px-3 py-1.5 text-xs font-bold text-dark dark:text-slate-200 hover:bg-blue/10 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="pencil" class="w-3.5 h-3.5 flex-none"></i><span>Rename</span>
                </button>
                <button type="button" data-f-action="color" class="w-full text-left px-3 py-1.5 text-xs font-bold text-dark dark:text-slate-200 hover:bg-blue/10 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="palette" class="w-3.5 h-3.5 flex-none"></i><span>Change Color</span>
                </button>
                <div class="border-t border-slate-200 dark:border-slate-700 my-1 mx-2"></div>
                <button type="button" data-f-action="delete" class="w-full text-left px-3 py-1.5 text-xs font-extrabold text-pink hover:bg-pink/10 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 flex-none"></i><span>Delete Folder</span>
                </button>
            `;

            menu.querySelector('[data-f-action="manage"]').onclick = () => { menu.remove(); this.openFileManager(`folder:${folderId}`); };
            menu.querySelector('[data-f-action="rename"]').onclick = () => { menu.remove(); this.renameFolder(folderId); };
            menu.querySelector('[data-f-action="color"]').onclick = () => { menu.remove(); this.changeFolderColor(folderId); };
            menu.querySelector('[data-f-action="delete"]').onclick = () => { menu.remove(); this.deleteUserFolder(folderId); };

            const rect = e.target.closest('.folder-menu-btn')?.getBoundingClientRect() || { bottom: 80, left: 160 };
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.left = `${Math.max(8, rect.left - 110)}px`;

            document.body.appendChild(menu);
            this.safeCreateIcons(menu);
        },

        /* ========================================================
           FILE & FOLDER MANAGER (METADATA-FIRST BULK WORKSPACE)
           ======================================================== */
        isFileManagerOpen() {
            const modal = document.getElementById('fileManagerModal');
            return Boolean(this.fmState.isOpen && modal && modal.classList.contains('open'));
        },

        refreshFileManagerIfOpen() {
            if (this.isFileManagerOpen()) {
                this.renderFileManager();
            }
        },

        async openFileManager(initialView = null) {
            await this.flushPendingSave();
            this.purgeExpiredBuffers(false);

            this.fmState.isOpen = true;
            try {
                this.fmState.layout = localStorage.getItem(FM_LAYOUT_KEY) === 'list' ? 'list' : 'grid';
            } catch (e) {
                this.fmState.layout = 'grid';
            }

            if (typeof initialView === 'string' && initialView) {
                this.fmState.view = initialView;
            } else if (this.mode === 'buffer') {
                this.fmState.view = 'buffer';
            } else if (this.mode === 'trash') {
                this.fmState.view = 'trash';
            } else {
                this.fmState.view = 'root';
            }

            document.querySelectorAll('.note-ctx-menu').forEach((m) => m.remove());
            document.getElementById('sortDropdown')?.classList.add('is-hidden');

            this.fmState.search = '';
            this.fmState.selectedNoteIds.clear();
            this.fmState.selectedFolderIds.clear();
            this.fmState.lastClickedIndex = null;
            this.fmState.visibleLimit = FM_PAGE_SIZE;
            this.fmState.dragNoteIds = [];

            const searchEl = document.getElementById('fmSearchInput');
            if (searchEl) searchEl.value = '';
            document.getElementById('fmClearSearchBtn')?.classList.add('is-hidden');

            const sortEl = document.getElementById('fmSortSelect');
            if (sortEl) sortEl.value = this.fmState.sort || 'date-desc';

            const modal = document.getElementById('fileManagerModal');
            if (modal) modal.classList.add('open');

            this.renderFileManager();
        },

        closeFileManager() {
            this.fmState.isOpen = false;
            this.fmState.selectedNoteIds.clear();
            this.fmState.selectedFolderIds.clear();
            this.fmState.lastClickedIndex = null;
            this.fmState.dragNoteIds = [];
            document.getElementById('fileManagerModal')?.classList.remove('open');
        },

        setFileManagerView(view) {
            this.fmState.view = view || 'root';
            this.fmState.selectedNoteIds.clear();
            if (this.fmState.view === 'buffer' || this.fmState.view === 'trash') {
                this.fmState.selectedFolderIds.clear();
            }
            this.fmState.lastClickedIndex = null;
            this.fmState.visibleLimit = FM_PAGE_SIZE;
            this.renderFileManager();
        },

        setFmLayout(layout) {
            this.fmState.layout = (layout === 'list') ? 'list' : 'grid';
            this.safeLocalSet(FM_LAYOUT_KEY, this.fmState.layout);
            const filtered = this.renderFileManagerFiles();
            this.renderFileManagerBulkBar(filtered);
        },

        setFmSort(sortVal) {
            const allowed = ['date-desc', 'date-asc', 'title-asc', 'title-desc'];
            this.fmState.sort = allowed.includes(sortVal) ? sortVal : 'date-desc';
            this.fmState.lastClickedIndex = null;
            const filtered = this.renderFileManagerFiles();
            this.renderFileManagerBulkBar(filtered);
        },

        clearFmSearch() {
            this.fmState.search = '';
            const searchEl = document.getElementById('fmSearchInput');
            if (searchEl) searchEl.value = '';
            document.getElementById('fmClearSearchBtn')?.classList.add('is-hidden');
            this.fmState.visibleLimit = FM_PAGE_SIZE;
            this.fmState.lastClickedIndex = null;
            const filtered = this.renderFileManagerFiles();
            this.renderFileManagerBulkBar(filtered);
        },

        fmLoadMore() {
            this.fmState.visibleLimit += FM_PAGE_SIZE;
            const filtered = this.renderFileManagerFiles();
            this.renderFileManagerBulkBar(filtered);
        },

        getFmFilteredFolders() {
            if ((this.fmState.view || 'root') !== 'root') return [];
            const search = (this.fmState.search || '').trim().toLowerCase();
            let list = this.folders.slice();
            if (search) {
                list = list.filter((f) => (f.name || '').toLowerCase().includes(search));
            }
            if (this.fmState.sort === 'title-asc') {
                list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            } else if (this.fmState.sort === 'title-desc') {
                list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
            }
            return list;
        },

        getFmFilteredItems() {
            const view = this.fmState.view || 'root';
            const search = (this.fmState.search || '').trim().toLowerCase();
            const validFolderIds = new Set(this.folders.map((f) => f.id));
            const folderNameMap = new Map(this.folders.map((f) => [f.id, (f.name || '').toLowerCase()]));

            let items = [];
            if (view === 'buffer') {
                items = this.bufferNotes.slice();
            } else if (view === 'trash') {
                items = this.noteIndex.filter((n) => n.deleted === true);
            } else if (view === 'unfiled') {
                items = this.noteIndex.filter((n) => n.deleted !== true && (!n.folderId || !validFolderIds.has(n.folderId)));
            } else if (view === 'root') {
                items = search
                    ? this.noteIndex.filter((n) => n.deleted !== true)
                    : this.noteIndex.filter((n) => n.deleted !== true && (!n.folderId || !validFolderIds.has(n.folderId)));
            } else if (view.startsWith('folder:')) {
                const fId = view.slice('folder:'.length);
                items = this.noteIndex.filter((n) => n.deleted !== true && n.folderId === fId);
            } else {
                items = this.noteIndex.filter((n) => n.deleted !== true);
            }

            if (search) {
                items = items.filter((item) => {
                    const t = (item.title || 'Untitled').toLowerCase();
                    const p = (item.preview || '').toLowerCase();
                    const fn = item.folderId ? (folderNameMap.get(item.folderId) || '') : '';
                    return t.includes(search) || p.includes(search) || fn.includes(search);
                });
            }

            switch (this.fmState.sort) {
                case 'date-asc':
                    items.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
                    break;
                case 'title-asc':
                    items.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
                    break;
                case 'title-desc':
                    items.sort((a, b) => (b.title || 'Untitled').localeCompare(a.title || 'Untitled'));
                    break;
                case 'date-desc':
                default:
                    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    break;
            }
            return items;
        },

        renderFileManager() {
            if (this.fmState.view.startsWith('folder:')) {
                const targetId = this.fmState.view.slice('folder:'.length);
                if (!this.folders.some((f) => f.id === targetId)) {
                    this.fmState.view = 'root';
                }
            }

            const existingFolderIds = new Set(this.folders.map((f) => f.id));
            Array.from(this.fmState.selectedFolderIds).forEach((fid) => {
                if (!existingFolderIds.has(fid)) this.fmState.selectedFolderIds.delete(fid);
            });

            const activeNotesCount = this.noteIndex.filter((n) => n.deleted !== true).length;
            const bufferCount = this.bufferNotes.length;
            const trashCount = this.noteIndex.filter((n) => n.deleted === true).length;

            const summaryEl = document.getElementById('fmSummaryMeta');
            if (summaryEl) {
                summaryEl.textContent = `${activeNotesCount} notes · ${this.folders.length} folders · ${bufferCount} buffer · ${trashCount} trash`;
            }

            this.renderFileManagerSidebar();
            const filtered = this.renderFileManagerFiles();
            const validIds = new Set(filtered.map((item) => item.id));
            Array.from(this.fmState.selectedNoteIds).forEach((id) => {
                if (!validIds.has(id)) this.fmState.selectedNoteIds.delete(id);
            });
            this.renderFileManagerBulkBar(filtered);
        },

        renderFileManagerSidebar() {
            const locList = document.getElementById('fmLocationsList');
            const folderList = document.getElementById('fmFolderList');
            const foldersCountEl = document.getElementById('fmFoldersCount');
            const folderBulkBar = document.getElementById('fmFolderBulkBar');
            const folderSelectedLabel = document.getElementById('fmFolderSelectedLabel');

            const validFolderIds = new Set(this.folders.map((f) => f.id));
            const activeNotes = this.noteIndex.filter((n) => n.deleted !== true);
            const folderCounts = new Map();
            activeNotes.forEach((n) => {
                if (n.folderId && validFolderIds.has(n.folderId)) {
                    folderCounts.set(n.folderId, (folderCounts.get(n.folderId) || 0) + 1);
                }
            });

            const bufferCount = this.bufferNotes.length;
            const trashCount = this.noteIndex.filter((n) => n.deleted === true).length;

            if (locList) {
                locList.innerHTML = '';
                const locations = [
                    { key: 'root', label: 'My Files', icon: 'hard-drive', tone: 'text-blue', activeClass: 'is-active', count: activeNotes.length, isDropRoot: true },
                    { key: 'all', label: 'All Notes', icon: 'folders', tone: 'text-slate-500', activeClass: 'is-active', count: activeNotes.length },
                    { key: 'buffer', label: '3-Day Buffer', icon: 'hourglass', tone: 'text-orange', activeClass: 'is-active-buffer', count: bufferCount },
                    { key: 'trash', label: 'Trash', icon: 'trash-2', tone: 'text-pink', activeClass: 'is-active-trash', count: trashCount }
                ];

                locations.forEach((loc) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    const isActive = this.fmState.view === loc.key || (loc.key === 'root' && this.fmState.view === 'unfiled');
                    btn.className = `fm-location-btn ${isActive ? loc.activeClass : ''}`;
                    btn.dataset.fmView = loc.key;
                    btn.innerHTML = `
                        <i data-lucide="${loc.icon}" class="w-4 h-4 ${loc.tone} flex-none"></i>
                        <span class="flex-1 truncate">${escapeHtml(loc.label)}</span>
                        <span class="px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 flex-none">${loc.count}</span>
                    `;
                    btn.onclick = () => this.setFileManagerView(loc.key);
                    if (loc.isDropRoot) {
                        this.setupFmDropTarget(btn, null);
                    }
                    locList.appendChild(btn);
                });
                this.safeCreateIcons(locList);
            }

            if (foldersCountEl) foldersCountEl.textContent = String(this.folders.length);

            if (folderBulkBar) {
                const fSelCount = this.fmState.selectedFolderIds.size;
                folderBulkBar.classList.toggle('is-hidden', fSelCount === 0);
                if (folderSelectedLabel) {
                    folderSelectedLabel.textContent = `${fSelCount} folder${fSelCount === 1 ? '' : 's'} selected`;
                }
            }

            if (folderList) {
                folderList.innerHTML = '';
                if (!this.folders.length) {
                    folderList.innerHTML = `
                        <div class="p-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            No folders yet. Click + to create one.
                        </div>
                    `;
                } else {
                    const frag = document.createDocumentFragment();
                    this.folders.forEach((folder) => {
                        const viewKey = `folder:${folder.id}`;
                        const isActive = this.fmState.view === viewKey;
                        const isChecked = this.fmState.selectedFolderIds.has(folder.id);
                        const count = folderCounts.get(folder.id) || 0;

                        const row = document.createElement('div');
                        row.className = `fm-folder-row group ${isActive ? 'is-active' : ''} ${isChecked ? 'is-selected' : ''}`;
                        row.dataset.fmFolderId = folder.id;

                        const cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.className = 'fm-checkbox fm-checkbox-folder';
                        cb.checked = isChecked;
                        cb.setAttribute('aria-label', `Select folder ${folder.name}`);
                        cb.onclick = (ev) => {
                            ev.stopPropagation();
                            this.toggleFmFolderSelection(folder.id);
                        };
                        row.appendChild(cb);

                        const info = document.createElement('div');
                        info.className = 'flex items-center gap-2 min-w-0 flex-1';
                        info.innerHTML = `
                            <span class="w-2.5 h-2.5 rounded-full flex-none" style="background: ${escapeHtml(folder.color)}"></span>
                            <span class="text-xs font-extrabold text-dark dark:text-slate-100 truncate flex-1">${escapeHtml(folder.name)}</span>
                            <span class="text-[10px] font-black text-slate-400 flex-none">${count}</span>
                        `;
                        row.appendChild(info);

                        const actions = document.createElement('div');
                        actions.className = 'flex items-center gap-0.5 flex-none opacity-80 group-hover:opacity-100';
                        actions.appendChild(this.buildFmFolderActions(folder.id, false));
                        row.appendChild(actions);

                        row.onclick = (ev) => {
                            if (ev.target.closest('.fm-checkbox') || ev.target.closest('button')) return;
                            this.setFileManagerView(viewKey);
                        };

                        this.setupFmDropTarget(row, folder.id);
                        frag.appendChild(row);
                    });
                    folderList.appendChild(frag);
                    this.safeCreateIcons(folderList);
                }
            }
        },

        setupFmDropTarget(el, targetFolderId) {
            el.addEventListener('dragover', (e) => {
                if (!this.fmState.dragNoteIds.length) return;
                e.preventDefault();
                el.classList.add('fm-drop-target');
            });
            el.addEventListener('dragleave', (e) => {
                if (e.relatedTarget && typeof el.contains === 'function' && el.contains(e.relatedTarget)) return;
                el.classList.remove('fm-drop-target');
            });
            el.addEventListener('drop', async (e) => {
                e.preventDefault();
                el.classList.remove('fm-drop-target');
                let ids = this.fmState.dragNoteIds.slice();
                if (!ids.length && e.dataTransfer) {
                    try {
                        const raw = e.dataTransfer.getData('application/x-klasskit-fm-notes');
                        if (raw) ids = JSON.parse(raw);
                    } catch (err) { }
                }
                this.fmState.dragNoteIds = [];
                if (Array.isArray(ids) && ids.length) {
                    await this.bulkMoveSelectedNotes(targetFolderId, ids);
                }
            });
        },

        attachFmNoteDragHandlers(el, itemId) {
            el.draggable = true;
            el.addEventListener('dragstart', (e) => {
                const dragIds = (this.fmState.selectedNoteIds.has(itemId) && this.fmState.selectedNoteIds.size > 0)
                    ? Array.from(this.fmState.selectedNoteIds)
                    : [itemId];
                this.fmState.dragNoteIds = dragIds;
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('application/x-klasskit-fm-notes', JSON.stringify(dragIds));
                    e.dataTransfer.setData('text/plain', itemId);
                }
            });
            el.addEventListener('dragend', () => {
                this.fmState.dragNoteIds = [];
                document.querySelectorAll('.fm-drop-target').forEach((node) => node.classList.remove('fm-drop-target'));
            });
        },

        buildFmFolderActions(folderId) {
            const wrap = document.createElement('div');
            wrap.className = 'flex items-center gap-0.5 flex-none';
            wrap.innerHTML = `
                <button type="button" data-f-act="rename" aria-label="Rename folder"
                    class="p-1 rounded-md text-slate-400 hover:text-blue hover:bg-blue/10 cursor-pointer transition-colors" title="Rename">
                    <i data-lucide="pencil" class="w-3 h-3 pointer-events-none"></i>
                </button>
                <button type="button" data-f-act="color" aria-label="Change folder color"
                    class="p-1 rounded-md text-slate-400 hover:text-orange hover:bg-orange/10 cursor-pointer transition-colors" title="Change color">
                    <i data-lucide="palette" class="w-3 h-3 pointer-events-none"></i>
                </button>
                <button type="button" data-f-act="delete" aria-label="Delete folder"
                    class="p-1 rounded-md text-slate-400 hover:text-pink hover:bg-pink/10 cursor-pointer transition-colors" title="Delete folder">
                    <i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i>
                </button>
            `;
            wrap.querySelector('[data-f-act="rename"]').onclick = (ev) => { ev.stopPropagation(); this.renameFolder(folderId); };
            wrap.querySelector('[data-f-act="color"]').onclick = (ev) => { ev.stopPropagation(); this.changeFolderColor(folderId); };
            wrap.querySelector('[data-f-act="delete"]').onclick = (ev) => { ev.stopPropagation(); this.deleteUserFolder(folderId); };
            return wrap;
        },

        buildFmNoteActionButtons(item, isBuffer, isTrash, compact = false) {
            const actions = document.createElement('div');
            actions.className = 'fm-row-actions';

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = compact
                ? 'px-2 py-0.5 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue text-[10px] font-extrabold text-dark dark:text-slate-100 flex items-center gap-1 cursor-pointer transition-colors'
                : 'px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue text-[11px] font-extrabold text-dark dark:text-slate-100 flex items-center gap-1 cursor-pointer transition-colors';
            openBtn.innerHTML = '<i data-lucide="external-link" class="w-3 h-3 text-blue pointer-events-none"></i><span>Open</span>';
            openBtn.onclick = (ev) => {
                ev.stopPropagation();
                this.openNoteFromFileManager(item.id, isBuffer);
            };
            actions.appendChild(openBtn);

            if (isBuffer) {
                const keepBtn = document.createElement('button');
                keepBtn.type = 'button';
                keepBtn.title = 'Keep Forever';
                keepBtn.setAttribute('aria-label', 'Keep Forever');
                keepBtn.className = 'p-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-green text-green cursor-pointer transition-colors';
                keepBtn.innerHTML = '<i data-lucide="bookmark-check" class="w-3.5 h-3.5 pointer-events-none"></i>';
                keepBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.bulkPromoteSelectedBuffers(null, [item.id]);
                };
                actions.appendChild(keepBtn);

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.title = 'Delete Buffer Note';
                delBtn.setAttribute('aria-label', 'Delete Buffer Note');
                delBtn.className = 'p-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-pink text-pink cursor-pointer transition-colors';
                delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>';
                delBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.deleteBufferNote(item.id);
                };
                actions.appendChild(delBtn);
            } else if (isTrash) {
                const resBtn = document.createElement('button');
                resBtn.type = 'button';
                resBtn.title = 'Restore Note';
                resBtn.setAttribute('aria-label', 'Restore Note');
                resBtn.className = 'p-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-green text-green cursor-pointer transition-colors';
                resBtn.innerHTML = '<i data-lucide="refresh-ccw" class="w-3.5 h-3.5 pointer-events-none"></i>';
                resBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.bulkRestoreSelectedNotes([item.id]);
                };
                actions.appendChild(resBtn);

                const delPermBtn = document.createElement('button');
                delPermBtn.type = 'button';
                delPermBtn.title = 'Delete Forever';
                delPermBtn.setAttribute('aria-label', 'Delete Forever');
                delPermBtn.className = 'p-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-pink text-pink cursor-pointer transition-colors';
                delPermBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>';
                delPermBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.bulkPermanentDeleteSelectedNotes([item.id]);
                };
                actions.appendChild(delPermBtn);
            } else {
                const trashBtn = document.createElement('button');
                trashBtn.type = 'button';
                trashBtn.title = 'Move to Trash';
                trashBtn.setAttribute('aria-label', 'Move to Trash');
                trashBtn.className = 'p-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-pink text-pink cursor-pointer transition-colors';
                trashBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>';
                trashBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    this.bulkTrashSelectedNotes([item.id]);
                };
                actions.appendChild(trashBtn);
            }

            return actions;
        },

        renderFileManagerBreadcrumb() {
            const crumbEl = document.getElementById('fmBreadcrumb');
            if (!crumbEl) return;
            crumbEl.innerHTML = '';

            const view = this.fmState.view || 'root';
            if (view.startsWith('folder:')) {
                const folderId = view.slice('folder:'.length);
                const folder = this.folders.find((f) => f.id === folderId);

                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'p-1.5 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue text-dark dark:text-white cursor-pointer transition-colors flex-none';
                backBtn.setAttribute('aria-label', 'Back to My Files');
                backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-3.5 h-3.5 pointer-events-none"></i>';
                backBtn.onclick = () => this.setFileManagerView('root');
                crumbEl.appendChild(backBtn);

                const rootBtn = document.createElement('button');
                rootBtn.type = 'button';
                rootBtn.className = 'fm-crumb-btn';
                rootBtn.innerHTML = '<i data-lucide="hard-drive" class="w-3.5 h-3.5 text-blue pointer-events-none"></i><span>My Files</span>';
                rootBtn.onclick = () => this.setFileManagerView('root');
                this.setupFmDropTarget(rootBtn, null);
                crumbEl.appendChild(rootBtn);

                const sep = document.createElement('span');
                sep.className = 'text-slate-400 flex-none inline-flex items-center';
                sep.innerHTML = '<i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>';
                crumbEl.appendChild(sep);

                const cur = document.createElement('span');
                cur.className = 'inline-flex items-center gap-1.5 font-heading font-bold text-sm uppercase tracking-tight text-dark dark:text-white truncate';
                cur.innerHTML = `<span class="w-2.5 h-2.5 rounded-full flex-none" style="background:${escapeHtml(folder?.color || '#1ea7fd')}"></span><span class="truncate">${escapeHtml(folder?.name || 'Folder')}</span>`;
                crumbEl.appendChild(cur);
            } else {
                const metaMap = {
                    root: { icon: 'hard-drive', tone: 'text-blue', label: 'My Files' },
                    all: { icon: 'folders', tone: 'text-blue', label: 'All Notes' },
                    unfiled: { icon: 'inbox', tone: 'text-slate-500', label: 'Unfiled Notes' },
                    buffer: { icon: 'hourglass', tone: 'text-orange', label: '3-Day Buffer' },
                    trash: { icon: 'trash-2', tone: 'text-pink', label: 'Trash' }
                };
                const info = metaMap[view] || metaMap.root;
                const labelEl = document.createElement('span');
                labelEl.className = 'inline-flex items-center gap-1.5 font-heading font-bold text-sm uppercase tracking-tight text-dark dark:text-white truncate';
                labelEl.innerHTML = `<i data-lucide="${info.icon}" class="w-4 h-4 ${info.tone} flex-none"></i><span class="truncate">${escapeHtml(info.label)}</span>`;
                crumbEl.appendChild(labelEl);
            }

            this.safeCreateIcons(crumbEl);
        },

        buildFmFolderCard(folder, count) {
            const safeColor = /^#[0-9a-f]{6}$/i.test(folder.color || '') ? folder.color : '#1ea7fd';
            const isChecked = this.fmState.selectedFolderIds.has(folder.id);
            const card = document.createElement('div');
            card.className = `fm-folder-card group ${isChecked ? 'is-selected' : ''}`;
            card.dataset.fmFolderCardId = folder.id;

            const tab = document.createElement('div');
            tab.className = 'fm-folder-tab';
            tab.style.background = safeColor;
            card.appendChild(tab);

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center justify-between gap-2';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'fm-checkbox fm-checkbox-folder';
            cb.checked = isChecked;
            cb.setAttribute('aria-label', `Select folder ${folder.name}`);
            cb.onclick = (ev) => {
                ev.stopPropagation();
                this.toggleFmFolderSelection(folder.id);
            };
            topRow.appendChild(cb);
            topRow.appendChild(this.buildFmFolderActions(folder.id));
            card.appendChild(topRow);

            const body = document.createElement('div');
            body.className = 'flex items-center gap-2.5 min-w-0';
            body.innerHTML = `
                <div class="w-10 h-10 rounded-xl border-2 border-dark/20 dark:border-slate-600 flex items-center justify-center flex-none" style="background: ${escapeHtml(safeColor)}22">
                    <i data-lucide="folder" class="w-5 h-5" style="color: ${escapeHtml(safeColor)}"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <h5 class="font-heading font-bold text-sm text-dark dark:text-white truncate">${escapeHtml(folder.name)}</h5>
                    <p class="text-[11px] font-bold text-slate-500 dark:text-slate-400">${count} note${count === 1 ? '' : 's'}</p>
                </div>
            `;
            card.appendChild(body);

            card.onclick = (ev) => {
                if (ev.target.closest('.fm-checkbox') || ev.target.closest('button')) return;
                this.setFileManagerView(`folder:${folder.id}`);
            };

            this.setupFmDropTarget(card, folder.id);
            return card;
        },

        buildFmFolderListRow(folder, count) {
            const safeColor = /^#[0-9a-f]{6}$/i.test(folder.color || '') ? folder.color : '#1ea7fd';
            const isChecked = this.fmState.selectedFolderIds.has(folder.id);
            const row = document.createElement('div');
            row.className = `fm-file-row is-folder-row group ${isChecked ? 'is-selected' : ''}`;
            row.dataset.fmFolderCardId = folder.id;

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'fm-checkbox fm-checkbox-folder';
            cb.checked = isChecked;
            cb.setAttribute('aria-label', `Select folder ${folder.name}`);
            cb.onclick = (ev) => {
                ev.stopPropagation();
                this.toggleFmFolderSelection(folder.id);
            };
            row.appendChild(cb);

            const body = document.createElement('div');
            body.className = 'flex items-center gap-2.5 flex-1 min-w-0';
            body.innerHTML = `
                <i data-lucide="folder" class="w-5 h-5 flex-none" style="color: ${escapeHtml(safeColor)}"></i>
                <span class="font-heading font-bold text-xs text-dark dark:text-white truncate">${escapeHtml(folder.name)}</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-300 flex-none">${count} note${count === 1 ? '' : 's'}</span>
            `;
            row.appendChild(body);

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue text-[11px] font-extrabold text-dark dark:text-slate-100 flex items-center gap-1 cursor-pointer transition-colors flex-none';
            openBtn.innerHTML = '<i data-lucide="folder-open" class="w-3 h-3 text-blue pointer-events-none"></i><span>Open</span>';
            openBtn.onclick = (ev) => {
                ev.stopPropagation();
                this.setFileManagerView(`folder:${folder.id}`);
            };
            row.appendChild(openBtn);
            row.appendChild(this.buildFmFolderActions(folder.id));

            row.onclick = (ev) => {
                if (ev.target.closest('.fm-checkbox') || ev.target.closest('button')) return;
                this.setFileManagerView(`folder:${folder.id}`);
            };

            this.setupFmDropTarget(row, folder.id);
            return row;
        },

        getFmItemPillHtml(item, isBuffer, folderMap) {
            if (isBuffer) {
                const tInfo = formatTimeRemaining(item.expiresAt);
                return `<span class="buffer-countdown-pill ${tInfo.urgent ? 'is-urgent' : ''} flex-none">${escapeHtml(tInfo.label)}</span>`;
            }
            const folderObj = item.folderId ? folderMap.get(item.folderId) : null;
            if (folderObj) {
                return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-extrabold text-slate-600 dark:text-slate-200 flex-none"><span class="w-2 h-2 rounded-full flex-none" style="background:${escapeHtml(folderObj.color)}"></span><span class="truncate max-w-[105px]">${escapeHtml(folderObj.name)}</span></span>`;
            }
            return `<span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-400 dark:text-slate-300 flex-none">Root</span>`;
        },

        buildFmFileCard(item, idx, isBuffer, isTrash, folderMap) {
            const isSelected = this.fmState.selectedNoteIds.has(item.id);
            const card = document.createElement('div');
            card.className = `fm-file-card ${isSelected ? 'is-selected' : ''} ${isBuffer ? 'is-buffer' : ''} ${isTrash ? 'is-trash' : ''}`;
            card.dataset.fmId = item.id;
            card.dataset.fmIdx = String(idx);

            if (!isBuffer && !isTrash) {
                this.attachFmNoteDragHandlers(card, item.id);
            }

            const topBar = document.createElement('div');
            topBar.className = 'flex items-center justify-between gap-2';

            const leftTop = document.createElement('div');
            leftTop.className = 'flex items-center gap-2 min-w-0';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'fm-checkbox';
            cb.checked = isSelected;
            cb.setAttribute('aria-label', `Select ${item.title || 'Untitled'}`);
            cb.onclick = (ev) => {
                ev.stopPropagation();
                this.toggleFmNoteSelection(item.id, idx, Boolean(ev.shiftKey));
            };
            leftTop.appendChild(cb);

            const fileIcon = isBuffer ? 'hourglass' : (isTrash ? 'trash-2' : 'file-text');
            const iconTone = isBuffer ? 'text-orange' : (isTrash ? 'text-pink' : 'text-blue');
            const badge = document.createElement('span');
            badge.className = 'w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-none';
            badge.innerHTML = `<i data-lucide="${fileIcon}" class="w-3.5 h-3.5 ${iconTone}"></i>`;
            leftTop.appendChild(badge);
            topBar.appendChild(leftTop);
            topBar.appendChild(this.buildFmNoteActionButtons(item, isBuffer, isTrash, true));
            card.appendChild(topBar);

            const title = item.title || (isBuffer ? 'Untitled Scratchpad' : 'Untitled');
            const dateStr = new Date(item.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const pillHtml = this.getFmItemPillHtml(item, isBuffer, folderMap);

            const mid = document.createElement('div');
            mid.className = 'min-w-0 flex-1';
            mid.innerHTML = `
                <div class="flex items-center gap-1.5 min-w-0">
                    ${!isBuffer && item.needsCloudFetch ? '<span class="cloud-pending-dot flex-none" title="Loads content on click"></span>' : ''}
                    <h5 class="font-extrabold text-xs text-dark dark:text-slate-100 truncate">${escapeHtml(title)}</h5>
                </div>
                <p class="fm-line-clamp-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    ${escapeHtml(item.preview || (isBuffer ? 'Empty temporary scratchpad...' : (item.needsCloudFetch ? 'Click Open to load from cloud...' : 'Empty note...')))}
                </p>
            `;
            card.appendChild(mid);

            const foot = document.createElement('div');
            foot.className = 'flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70';
            foot.innerHTML = `<span class="text-[10px] font-bold text-slate-400 flex-none">${escapeHtml(dateStr)}</span>${pillHtml}`;
            card.appendChild(foot);

            card.onclick = (ev) => {
                if (ev.target.closest('.fm-row-actions') || ev.target.closest('.fm-checkbox')) return;
                this.toggleFmNoteSelection(item.id, idx, Boolean(ev.shiftKey));
            };
            card.ondblclick = (ev) => {
                if (ev.target.closest('.fm-row-actions') || ev.target.closest('.fm-checkbox')) return;
                this.openNoteFromFileManager(item.id, isBuffer);
            };

            return card;
        },

        buildFmFileRow(item, idx, isBuffer, isTrash, folderMap) {
            const isSelected = this.fmState.selectedNoteIds.has(item.id);
            const row = document.createElement('div');
            row.className = `fm-file-row ${isSelected ? 'is-selected' : ''} ${isBuffer ? 'is-buffer' : ''} ${isTrash ? 'is-trash' : ''}`;
            row.dataset.fmId = item.id;
            row.dataset.fmIdx = String(idx);

            if (!isBuffer && !isTrash) {
                this.attachFmNoteDragHandlers(row, item.id);
            }

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'fm-checkbox';
            cb.checked = isSelected;
            cb.setAttribute('aria-label', `Select ${item.title || 'Untitled'}`);
            cb.onclick = (ev) => {
                ev.stopPropagation();
                this.toggleFmNoteSelection(item.id, idx, Boolean(ev.shiftKey));
            };
            row.appendChild(cb);

            const body = document.createElement('div');
            body.className = 'flex-1 min-w-0';

            const title = item.title || (isBuffer ? 'Untitled Scratchpad' : 'Untitled');
            const dateStr = new Date(item.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const pillHtml = this.getFmItemPillHtml(item, isBuffer, folderMap);

            body.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    ${!isBuffer && item.needsCloudFetch ? '<span class="cloud-pending-dot flex-none" title="Loads content on click"></span>' : ''}
                    <span class="font-extrabold text-xs text-dark dark:text-slate-100 truncate">${escapeHtml(title)}</span>
                    ${pillHtml}
                </div>
                <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    ${escapeHtml(dateStr)} · ${escapeHtml(item.preview || (isBuffer ? 'Empty temporary scratchpad...' : (item.needsCloudFetch ? 'Click Open to load from cloud...' : 'Empty note...')))}
                </p>
            `;
            row.appendChild(body);
            row.appendChild(this.buildFmNoteActionButtons(item, isBuffer, isTrash, false));

            row.onclick = (ev) => {
                if (ev.target.closest('.fm-row-actions') || ev.target.closest('.fm-checkbox')) return;
                this.toggleFmNoteSelection(item.id, idx, Boolean(ev.shiftKey));
            };
            row.ondblclick = (ev) => {
                if (ev.target.closest('.fm-row-actions') || ev.target.closest('.fm-checkbox')) return;
                this.openNoteFromFileManager(item.id, isBuffer);
            };

            return row;
        },

        renderFileManagerFiles() {
            const listEl = document.getElementById('fmFileList');
            const viewCountEl = document.getElementById('fmCurrentViewCount');
            const gridBtn = document.getElementById('fmLayoutGridBtn');
            const listBtn = document.getElementById('fmLayoutListBtn');

            const isGrid = (this.fmState.layout || 'grid') === 'grid';
            if (gridBtn) gridBtn.classList.toggle('is-active', isGrid);
            if (listBtn) listBtn.classList.toggle('is-active', !isGrid);

            this.renderFileManagerBreadcrumb();

            const filteredFolders = this.getFmFilteredFolders();
            const filteredNotes = this.getFmFilteredItems();
            const view = this.fmState.view || 'root';
            const search = (this.fmState.search || '').trim();

            if (viewCountEl) {
                viewCountEl.textContent = String(filteredFolders.length + filteredNotes.length);
            }
            if (!listEl) return filteredNotes;

            listEl.innerHTML = '';

            const activeNotes = this.noteIndex.filter((n) => n.deleted !== true);
            const folderCounts = new Map();
            activeNotes.forEach((n) => {
                if (n.folderId) folderCounts.set(n.folderId, (folderCounts.get(n.folderId) || 0) + 1);
            });

            const frag = document.createDocumentFragment();
            const showFolderSection = view === 'root' && (filteredFolders.length > 0 || !search);

            if (showFolderSection) {
                const secHdr = document.createElement('div');
                secHdr.className = 'flex items-center justify-between gap-2 mb-2.5';
                secHdr.innerHTML = `
                    <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Folders (${filteredFolders.length})</span>
                    <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500">Click to open · Drag notes onto a folder to move</span>
                `;
                frag.appendChild(secHdr);

                const folderContainer = document.createElement('div');
                folderContainer.className = isGrid
                    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5'
                    : 'space-y-1.5 mb-4';

                filteredFolders.forEach((folder) => {
                    const count = folderCounts.get(folder.id) || 0;
                    folderContainer.appendChild(
                        isGrid ? this.buildFmFolderCard(folder, count) : this.buildFmFolderListRow(folder, count)
                    );
                });

                if (isGrid && !search) {
                    const addCard = document.createElement('button');
                    addCard.type = 'button';
                    addCard.className = 'fm-new-folder-card';
                    addCard.innerHTML = `
                        <i data-lucide="folder-plus" class="w-6 h-6 text-orange"></i>
                        <span class="font-heading font-bold text-xs uppercase tracking-wide">+ New Folder</span>
                    `;
                    addCard.onclick = () => this.createFolder();
                    folderContainer.appendChild(addCard);
                }

                frag.appendChild(folderContainer);
            }

            if (filteredNotes.length === 0) {
                if (view === 'root' && showFolderSection && !search) {
                    const hintBox = document.createElement('div');
                    hintBox.className = 'p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-400 dark:text-slate-500';
                    hintBox.textContent = 'No loose files outside folders. Open any folder above or click + Note to add one.';
                    frag.appendChild(hintBox);
                } else if (!filteredFolders.length) {
                    const icon = view === 'buffer' ? 'hourglass' : (view === 'trash' ? 'trash-2' : 'file-text');
                    const msg = search
                        ? 'No files or folders match your filter.'
                        : (view === 'buffer'
                            ? 'No temporary 3-day buffer notes.'
                            : (view === 'trash'
                                ? 'Trash is empty.'
                                : (view.startsWith('folder:') ? 'This folder is empty.' : 'No notes in this view yet.')));
                    const emptyEl = document.createElement('div');
                    emptyEl.className = 'flex flex-col items-center justify-center py-12 px-4 text-center space-y-3';
                    emptyEl.innerHTML = `
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-6 h-6 text-slate-400"></i>
                        </div>
                        <p class="text-xs font-extrabold text-slate-500 dark:text-slate-400">${escapeHtml(msg)}</p>
                    `;
                    if (view.startsWith('folder:') && !search) {
                        const backBtn = document.createElement('button');
                        backBtn.type = 'button';
                        backBtn.className = 'btn-chunky bg-white dark:bg-slate-800 text-dark dark:text-white px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wide gap-1.5';
                        backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-3.5 h-3.5 text-blue"></i><span>Back to My Files</span>';
                        backBtn.onclick = () => this.setFileManagerView('root');
                        emptyEl.appendChild(backBtn);
                    }
                    frag.appendChild(emptyEl);
                }
                listEl.appendChild(frag);
                this.safeCreateIcons(listEl);
                return filteredNotes;
            }

            if (view === 'root') {
                const fileHdr = document.createElement('div');
                fileHdr.className = 'flex items-center justify-between gap-2 mb-2.5';
                fileHdr.innerHTML = `
                    <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">${search ? `Matching Files (${filteredNotes.length})` : `Loose Files in My Files (${filteredNotes.length})`}</span>
                `;
                frag.appendChild(fileHdr);
            }

            const folderMap = new Map(this.folders.map((f) => [f.id, f]));
            const isBuffer = view === 'buffer';
            const isTrash = view === 'trash';
            const slice = filteredNotes.slice(0, this.fmState.visibleLimit);

            const filesContainer = document.createElement('div');
            filesContainer.className = isGrid
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                : 'space-y-1.5';

            slice.forEach((item, idx) => {
                filesContainer.appendChild(
                    isGrid
                        ? this.buildFmFileCard(item, idx, isBuffer, isTrash, folderMap)
                        : this.buildFmFileRow(item, idx, isBuffer, isTrash, folderMap)
                );
            });
            frag.appendChild(filesContainer);

            if (filteredNotes.length > this.fmState.visibleLimit) {
                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'w-full mt-3 py-2 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs font-extrabold text-blue hover:bg-blue/10 hover:border-blue transition-colors flex items-center justify-center gap-1.5 cursor-pointer';
                moreBtn.innerHTML = `<i data-lucide="chevrons-down" class="w-3.5 h-3.5"></i><span>Show more (${filteredNotes.length - this.fmState.visibleLimit} left)</span>`;
                moreBtn.onclick = () => this.fmLoadMore();
                frag.appendChild(moreBtn);
            }

            listEl.appendChild(frag);
            this.safeCreateIcons(listEl);
            return filteredNotes;
        },

        updateFmSelectionUI(filtered) {
            const items = filtered || this.getFmFilteredItems();
            const listEl = document.getElementById('fmFileList');
            if (listEl) {
                listEl.querySelectorAll('[data-fm-id]').forEach((node) => {
                    const id = node.dataset.fmId;
                    if (!id) return;
                    const sel = this.fmState.selectedNoteIds.has(id);
                    node.classList.toggle('is-selected', sel);
                    const cb = node.querySelector('.fm-checkbox');
                    if (cb) cb.checked = sel;
                });
                listEl.querySelectorAll('[data-fm-folder-card-id]').forEach((node) => {
                    const fid = node.dataset.fmFolderCardId;
                    if (!fid) return;
                    const sel = this.fmState.selectedFolderIds.has(fid);
                    node.classList.toggle('is-selected', sel);
                    const cb = node.querySelector('.fm-checkbox-folder');
                    if (cb) cb.checked = sel;
                });
            }
            this.renderFileManagerBulkBar(items);
        },

        renderFileManagerBulkBar(filtered) {
            const bar = document.getElementById('fmBulkBar');
            const selectAllLabel = document.getElementById('fmSelectAllLabel');
            const items = filtered || this.getFmFilteredItems();
            const filteredFolders = this.getFmFilteredFolders();
            const visibleSlice = items.slice(0, this.fmState.visibleLimit);
            const allVisibleSelected = visibleSlice.length > 0
                ? visibleSlice.every((it) => this.fmState.selectedNoteIds.has(it.id))
                : (filteredFolders.length > 0 && filteredFolders.every((f) => this.fmState.selectedFolderIds.has(f.id)));

            if (selectAllLabel) {
                selectAllLabel.textContent = allVisibleSelected ? 'Deselect All' : 'Select All';
            }

            if (!bar) return;

            const prevMoveTarget = document.getElementById('fmMoveTargetSelect')?.value || null;
            const prevPromoteTarget = document.getElementById('fmPromoteTargetSelect')?.value || null;

            const noteCount = this.fmState.selectedNoteIds.size;
            const folderCount = this.fmState.selectedFolderIds.size;
            const totalSelected = noteCount + folderCount;
            const view = this.fmState.view || 'root';
            const isBuffer = view === 'buffer';
            const isTrash = view === 'trash';

            bar.classList.toggle('has-selection', totalSelected > 0);
            bar.classList.toggle('is-buffer', isBuffer && noteCount > 0);
            bar.classList.toggle('is-trash', isTrash && noteCount > 0);
            bar.classList.toggle('is-folder', folderCount > 0 && noteCount === 0);

            if (totalSelected === 0) {
                bar.innerHTML = `
                    <div class="w-full flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>Click checkboxes to select multiple folders or notes · Hold <strong class="text-dark dark:text-slate-200">Shift</strong> for range · Double-click notes to open</span>
                        ${!isBuffer && !isTrash ? '<span class="hidden lg:inline text-blue font-extrabold">Tip: Drag notes onto any folder card</span>' : ''}
                    </div>
                `;
                return;
            }

            if (folderCount > 0 && noteCount === 0) {
                bar.innerHTML = `
                    <div class="w-full flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl bg-pink text-white text-[11px] font-black uppercase tracking-wide flex-none">${folderCount} Folder${folderCount === 1 ? '' : 's'} Selected</span>
                        <button type="button" onclick="app.bulkDeleteSelectedFolders()"
                            class="btn-chunky bg-pink text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Delete Selected Folders</span>
                        </button>
                        <button type="button" onclick="app.clearFmAllSelection()"
                            class="ml-auto text-xs font-extrabold text-slate-500 dark:text-slate-300 hover:underline cursor-pointer">
                            Clear
                        </button>
                    </div>
                `;
                this.safeCreateIcons(bar);
                return;
            }

            const folderOpts = [
                '<option value="__unfiled__">My Files (Root / Unfiled)</option>',
                ...this.folders.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`)
            ].join('');

            if (folderCount > 0 && noteCount > 0 && !isBuffer && !isTrash) {
                bar.innerHTML = `
                    <div class="w-full flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl bg-blue text-white text-[11px] font-black uppercase tracking-wide flex-none">${folderCount} Folder${folderCount === 1 ? '' : 's'} · ${noteCount} Note${noteCount === 1 ? '' : 's'}</span>
                        <select id="fmMoveTargetSelect" aria-label="Destination folder for selected notes"
                            class="px-2.5 py-1.5 text-xs font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:border-blue rounded-xl text-dark dark:text-slate-100 outline-none cursor-pointer">
                            ${folderOpts}
                        </select>
                        <button type="button" onclick="app.bulkMoveSelectedNotes()"
                            class="btn-chunky bg-blue text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="folder-input" class="w-3.5 h-3.5"></i>
                            <span>Move Notes</span>
                        </button>
                        <button type="button" onclick="app.bulkDeleteMixedSelection()"
                            class="btn-chunky bg-pink text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Delete Selected</span>
                        </button>
                        <button type="button" onclick="app.clearFmAllSelection()"
                            class="ml-auto text-xs font-extrabold text-slate-500 dark:text-slate-300 hover:underline cursor-pointer">
                            Clear
                        </button>
                    </div>
                `;
            } else if (isBuffer) {
                bar.innerHTML = `
                    <div class="w-full flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl bg-orange text-white text-[11px] font-black uppercase tracking-wide flex-none">${noteCount} Selected</span>
                        <select id="fmPromoteTargetSelect" aria-label="Target folder for Keep Forever"
                            class="px-2.5 py-1.5 text-xs font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:border-green rounded-xl text-dark dark:text-slate-100 outline-none cursor-pointer">
                            ${folderOpts}
                        </select>
                        <button type="button" onclick="app.bulkPromoteSelectedBuffers()"
                            class="btn-chunky bg-green text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="bookmark-check" class="w-3.5 h-3.5"></i>
                            <span>Keep Forever</span>
                        </button>
                        <button type="button" onclick="app.bulkDeleteSelectedBuffers()"
                            class="btn-chunky bg-pink text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Delete Selected</span>
                        </button>
                        <button type="button" onclick="app.clearFmAllSelection()"
                            class="ml-auto text-xs font-extrabold text-slate-500 dark:text-slate-300 hover:underline cursor-pointer">
                            Clear
                        </button>
                    </div>
                `;
            } else if (isTrash) {
                bar.innerHTML = `
                    <div class="w-full flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl bg-pink text-white text-[11px] font-black uppercase tracking-wide flex-none">${noteCount} Selected</span>
                        <button type="button" onclick="app.bulkRestoreSelectedNotes()"
                            class="btn-chunky bg-green text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="refresh-ccw" class="w-3.5 h-3.5"></i>
                            <span>Restore Selected</span>
                        </button>
                        <button type="button" onclick="app.bulkPermanentDeleteSelectedNotes()"
                            class="btn-chunky bg-pink text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="flame" class="w-3.5 h-3.5"></i>
                            <span>Delete Forever</span>
                        </button>
                        <button type="button" onclick="app.clearFmAllSelection()"
                            class="ml-auto text-xs font-extrabold text-slate-500 dark:text-slate-300 hover:underline cursor-pointer">
                            Clear
                        </button>
                    </div>
                `;
            } else {
                bar.innerHTML = `
                    <div class="w-full flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl bg-blue text-white text-[11px] font-black uppercase tracking-wide flex-none">${noteCount} Selected</span>
                        <select id="fmMoveTargetSelect" aria-label="Destination folder"
                            class="px-2.5 py-1.5 text-xs font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:border-blue rounded-xl text-dark dark:text-slate-100 outline-none cursor-pointer">
                            ${folderOpts}
                        </select>
                        <button type="button" onclick="app.bulkMoveSelectedNotes()"
                            class="btn-chunky bg-blue text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="folder-input" class="w-3.5 h-3.5"></i>
                            <span>Move</span>
                        </button>
                        <button type="button" onclick="app.bulkTrashSelectedNotes()"
                            class="btn-chunky bg-pink text-white px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide gap-1.5">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Move to Trash</span>
                        </button>
                        <button type="button" onclick="app.clearFmAllSelection()"
                            class="ml-auto text-xs font-extrabold text-slate-500 dark:text-slate-300 hover:underline cursor-pointer">
                            Clear
                        </button>
                    </div>
                `;
            }

            const moveSel = document.getElementById('fmMoveTargetSelect');
            if (moveSel) {
                const isPrevValid = prevMoveTarget && (prevMoveTarget === '__unfiled__' || this.folders.some((f) => f.id === prevMoveTarget));
                if (isPrevValid) {
                    moveSel.value = prevMoveTarget;
                } else if ((view === 'root' || view === 'unfiled') && this.folders.length > 0) {
                    moveSel.value = this.folders[0].id;
                } else {
                    moveSel.value = '__unfiled__';
                }
            }

            const promoteSel = document.getElementById('fmPromoteTargetSelect');
            if (promoteSel) {
                const isPrevPromoteValid = prevPromoteTarget && (prevPromoteTarget === '__unfiled__' || this.folders.some((f) => f.id === prevPromoteTarget));
                if (isPrevPromoteValid) {
                    promoteSel.value = prevPromoteTarget;
                }
            }

            this.safeCreateIcons(bar);
        },

        toggleFmNoteSelection(id, idx, shiftKey = false) {
            const filtered = this.getFmFilteredItems();
            if (shiftKey && this.fmState.lastClickedIndex !== null && idx >= 0 && idx < filtered.length) {
                const start = Math.min(this.fmState.lastClickedIndex, idx);
                const end = Math.min(filtered.length - 1, Math.max(this.fmState.lastClickedIndex, idx));
                for (let i = start; i <= end; i++) {
                    if (filtered[i]) this.fmState.selectedNoteIds.add(filtered[i].id);
                }
                this.fmState.lastClickedIndex = idx;
            } else {
                if (this.fmState.selectedNoteIds.has(id)) {
                    this.fmState.selectedNoteIds.delete(id);
                } else {
                    this.fmState.selectedNoteIds.add(id);
                }
                this.fmState.lastClickedIndex = idx;
            }
            this.updateFmSelectionUI(filtered);
        },

        toggleFmSelectAllVisible() {
            const filtered = this.getFmFilteredItems();
            const visibleSlice = filtered.slice(0, this.fmState.visibleLimit);
            if (visibleSlice.length > 0) {
                const allSelected = visibleSlice.every((it) => this.fmState.selectedNoteIds.has(it.id));
                if (allSelected) {
                    visibleSlice.forEach((it) => this.fmState.selectedNoteIds.delete(it.id));
                } else {
                    visibleSlice.forEach((it) => this.fmState.selectedNoteIds.add(it.id));
                }
                this.updateFmSelectionUI(filtered);
                return;
            }

            const filteredFolders = this.getFmFilteredFolders();
            if ((this.fmState.view || 'root') === 'root' && filteredFolders.length > 0) {
                const allFoldersSelected = filteredFolders.every((f) => this.fmState.selectedFolderIds.has(f.id));
                if (allFoldersSelected) {
                    filteredFolders.forEach((f) => this.fmState.selectedFolderIds.delete(f.id));
                } else {
                    filteredFolders.forEach((f) => this.fmState.selectedFolderIds.add(f.id));
                }
                this.renderFileManagerSidebar();
                this.updateFmSelectionUI(filtered);
            }
        },

        clearFmSelection() {
            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;
            this.updateFmSelectionUI();
        },

        clearFmAllSelection() {
            this.fmState.selectedNoteIds.clear();
            this.fmState.selectedFolderIds.clear();
            this.fmState.lastClickedIndex = null;
            this.renderFileManagerSidebar();
            this.updateFmSelectionUI();
        },

        toggleFmFolderSelection(folderId) {
            if (!folderId) return;
            if (this.fmState.selectedFolderIds.has(folderId)) {
                this.fmState.selectedFolderIds.delete(folderId);
            } else {
                this.fmState.selectedFolderIds.add(folderId);
            }
            this.renderFileManagerSidebar();
            this.updateFmSelectionUI();
        },

        clearFmFolderSelection() {
            this.fmState.selectedFolderIds.clear();
            this.renderFileManagerSidebar();
            this.updateFmSelectionUI();
        },

        async openNoteFromFileManager(id, isBuffer = false) {
            this.closeFileManager();
            if (isBuffer) {
                await this.loadBufferNote(id);
                return;
            }
            const meta = this.noteIndex.find((n) => n.id === id);
            if (!meta) return;
            this.mode = meta.deleted ? 'trash' : 'notes';
            await this.loadNote(id);
        },

        async fmCreateNoteInCurrentView() {
            const view = this.fmState.view || 'root';
            this.closeFileManager();
            if (view === 'buffer') {
                await this.createBufferNote();
            } else if (view.startsWith('folder:')) {
                await this.createNewNote({ folderId: view.slice('folder:'.length) });
            } else {
                await this.createNewNote();
            }
        },

        async bulkMoveSelectedNotes(explicitTargetFolderId, explicitIds) {
            let rawTarget = explicitTargetFolderId;
            if (rawTarget === undefined) {
                rawTarget = document.getElementById('fmMoveTargetSelect')?.value ?? '__unfiled__';
            }
            const targetFolderId = (rawTarget && rawTarget !== '__unfiled__') ? rawTarget : null;
            if (targetFolderId && !this.folders.some((f) => f.id === targetFolderId)) return;

            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            if (!ids.length) return;

            const now = Date.now();
            const movedIds = [];

            for (const id of ids) {
                const meta = this.noteIndex.find((n) => n.id === id && n.deleted !== true);
                if (!meta) continue;
                if ((meta.folderId || null) === targetFolderId) continue;

                meta.folderId = targetFolderId;
                meta.updatedAt = now;
                movedIds.push(id);

                const cached = this.noteBodyCache.get(id);
                if (cached) {
                    cached.folderId = targetFolderId;
                    cached.updatedAt = now;
                }
                const localNote = await LessonDB.getNote(id);
                if (localNote) {
                    localNote.folderId = targetFolderId;
                    localNote.updatedAt = now;
                    await LessonDB.putNote(localNote);
                }
            }

            if (!movedIds.length) {
                this.showToast('Selected notes are already in that location', 'info');
                return;
            }

            await this.persistIndex();
            this.syncBatchMetadataToCloud(movedIds, { folder_id: targetFolderId, updated_at: now });
            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;
            this.renderNotesList();
            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();

            const targetName = targetFolderId
                ? (this.folders.find((f) => f.id === targetFolderId)?.name || 'folder')
                : 'My Files';
            this.showToast(`Moved ${movedIds.length} note${movedIds.length === 1 ? '' : 's'} to ${targetName}`, 'folder');
        },

        async bulkTrashSelectedNotes(explicitIds) {
            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            const targets = ids.filter((id) => this.noteIndex.some((n) => n.id === id && n.deleted !== true));
            if (!targets.length) return;

            const ok = await this.showModal(
                `Move ${targets.length} Note${targets.length === 1 ? '' : 's'} to Trash?`,
                'Selected notes can be restored from Trash for 14 days.',
                'Trash Selected',
                'trash-2'
            );
            if (!ok) return;

            const now = Date.now();
            const trashedIds = new Set();

            for (const id of targets) {
                const meta = this.noteIndex.find((n) => n.id === id && n.deleted !== true);
                if (!meta) continue;
                meta.deleted = true;
                meta.updatedAt = now;
                trashedIds.add(id);

                const cached = this.noteBodyCache.get(id);
                if (cached) {
                    cached.deleted = true;
                    cached.updatedAt = now;
                }
                const localNote = await LessonDB.getNote(id);
                if (localNote) {
                    localNote.deleted = true;
                    localNote.updatedAt = now;
                    await LessonDB.putNote(localNote);
                }
            }

            const trashedList = Array.from(trashedIds);
            await this.persistIndex();
            this.syncBatchMetadataToCloud(trashedList, { deleted: true, updated_at: now });

            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;

            if (this.mode === 'notes' && this.currentNoteId && trashedIds.has(this.currentNoteId)) {
                const nextNote = this.noteIndex.find((n) => n.deleted !== true);
                if (nextNote) await this.loadNote(nextNote.id, { skipFlush: true });
                else await this.createNewNote({ skipMobileClose: true });
            } else {
                this.renderNotesList();
            }

            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast(`Moved ${trashedList.length} note${trashedList.length === 1 ? '' : 's'} to Trash`, 'info');
        },

        async bulkRestoreSelectedNotes(explicitIds) {
            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            const targets = ids.filter((id) => this.noteIndex.some((n) => n.id === id && n.deleted === true));
            if (!targets.length) return;

            const now = Date.now();
            const validFolders = new Set(this.folders.map((f) => f.id));
            const restoredIds = [];
            const clearedFolderIds = [];

            for (const id of targets) {
                const meta = this.noteIndex.find((n) => n.id === id && n.deleted === true);
                if (!meta) continue;
                meta.deleted = false;
                meta.updatedAt = now;
                if (meta.folderId && !validFolders.has(meta.folderId)) {
                    meta.folderId = null;
                    clearedFolderIds.push(id);
                }
                restoredIds.push(id);

                const cached = this.noteBodyCache.get(id);
                if (cached) {
                    cached.deleted = false;
                    cached.folderId = meta.folderId;
                    cached.updatedAt = now;
                }
                const localNote = await LessonDB.getNote(id);
                if (localNote) {
                    localNote.deleted = false;
                    localNote.folderId = meta.folderId;
                    localNote.updatedAt = now;
                    await LessonDB.putNote(localNote);
                }
            }

            await this.persistIndex();
            this.syncBatchMetadataToCloud(restoredIds, { deleted: false, updated_at: now });
            if (clearedFolderIds.length) {
                this.syncBatchMetadataToCloud(clearedFolderIds, { folder_id: null, updated_at: now });
            }

            const restoredSet = new Set(restoredIds);
            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;

            if (this.mode === 'trash' && this.currentNoteId && restoredSet.has(this.currentNoteId)) {
                const nextTrash = this.noteIndex.find((n) => n.deleted === true);
                if (nextTrash) {
                    await this.loadNote(nextTrash.id, { skipFlush: true });
                } else {
                    this.mode = 'notes';
                    await this.loadNote(restoredIds[0], { skipFlush: true });
                }
            } else {
                this.renderNotesList();
            }

            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast(`Restored ${restoredIds.length} note${restoredIds.length === 1 ? '' : 's'}!`, 'success');
        },

        async bulkPermanentDeleteSelectedNotes(explicitIds) {
            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            const targets = ids.filter((id) => this.noteIndex.some((n) => n.id === id && n.deleted === true));
            if (!targets.length) return;

            const ok = await this.showModal(
                `Delete ${targets.length} Note${targets.length === 1 ? '' : 's'} Forever?`,
                'Selected notes and their attachments will be permanently deleted. This cannot be undone.',
                'Delete Forever',
                'flame'
            );
            if (!ok) return;

            const removedSet = new Set(targets);
            for (const id of targets) {
                const full = await LessonDB.getNote(id);
                if (full) await this.deleteImagesInContent(full.content);
                await LessonDB.deleteNote(id);
                this.noteBodyCache.delete(id);
            }

            this.noteIndex = this.noteIndex.filter((n) => !removedSet.has(n.id));
            await this.persistIndex();
            this.updateCacheStatusLabel();

            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;

            if (this.mode === 'trash' && this.currentNoteId && removedSet.has(this.currentNoteId)) {
                const nextTrash = this.noteIndex.find((n) => n.deleted === true);
                if (nextTrash) {
                    await this.loadNote(nextTrash.id, { skipFlush: true });
                } else {
                    this.showEmptyEditorState('trash');
                }
            } else {
                this.renderNotesList();
            }

            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast(`Permanently deleted ${targets.length} note${targets.length === 1 ? '' : 's'}`, 'info');
        },

        async bulkDeleteSelectedBuffers(explicitIds) {
            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            const removeSet = new Set(ids);
            const targets = this.bufferNotes.filter((b) => removeSet.has(b.id));
            if (!targets.length) return;

            const ok = await this.showModal(
                `Delete ${targets.length} Buffer Note${targets.length === 1 ? '' : 's'}?`,
                'Selected 3-day scratchpad notes will be deleted permanently.',
                'Delete Selected',
                'trash-2'
            );
            if (!ok) return;

            this.bufferNotes = this.bufferNotes.filter((b) => !removeSet.has(b.id));
            this.saveBufferNotesLocal();

            for (const b of targets) {
                await this.cleanupBufferImages(b.content, null);
            }

            if (this.activeBufferId && removeSet.has(this.activeBufferId)) {
                this.hasDirtyEdits = false;
                if (this.mode === 'buffer') {
                    if (this.bufferNotes.length > 0) {
                        await this.loadBufferNote(this.bufferNotes[0].id, { skipFlush: true });
                    } else {
                        this.showEmptyEditorState('buffer');
                    }
                } else {
                    this.activeBufferId = this.bufferNotes[0]?.id || null;
                }
            }

            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast(`Deleted ${targets.length} buffer note${targets.length === 1 ? '' : 's'}`, 'info');
        },

        async bulkPromoteSelectedBuffers(explicitTargetFolderId, explicitIds) {
            let rawTarget = explicitTargetFolderId;
            if (rawTarget === undefined) {
                rawTarget = document.getElementById('fmPromoteTargetSelect')?.value ?? '__unfiled__';
            }
            const targetFolderId = (rawTarget && rawTarget !== '__unfiled__') ? rawTarget : null;
            const safeFolderId = (targetFolderId && this.folders.some((f) => f.id === targetFolderId)) ? targetFolderId : null;

            const ids = Array.isArray(explicitIds) ? explicitIds : Array.from(this.fmState.selectedNoteIds);
            const promoteSet = new Set(ids);
            const targets = this.bufferNotes.filter((b) => promoteSet.has(b.id));
            if (!targets.length) return;

            const baseNow = Date.now();
            for (let i = 0; i < targets.length; i++) {
                const buf = targets[i];
                const newNote = {
                    id: `${baseNow}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                    title: buf.title || 'Promoted Buffer Note',
                    content: buf.content || '',
                    updatedAt: baseNow + i,
                    deleted: false,
                    folderId: safeFolderId,
                    sortOrder: null
                };
                this.upsertNoteIndexEntry(newNote, { needsCloudFetch: false });
                this.cacheNoteBody(newNote);
                await LessonDB.putNote(newNote);
                this.syncSingleNoteToCloud(newNote);
            }

            this.bufferNotes = this.bufferNotes.filter((b) => !promoteSet.has(b.id));
            this.saveBufferNotesLocal();
            await this.persistIndex();

            if (this.activeBufferId && promoteSet.has(this.activeBufferId)) {
                this.hasDirtyEdits = false;
                if (this.mode === 'buffer') {
                    if (this.bufferNotes.length > 0) {
                        await this.loadBufferNote(this.bufferNotes[0].id, { skipFlush: true });
                    } else {
                        this.showEmptyEditorState('buffer');
                    }
                } else {
                    this.activeBufferId = this.bufferNotes[0]?.id || null;
                }
            }

            this.fmState.selectedNoteIds.clear();
            this.fmState.lastClickedIndex = null;
            this.updateHeaderAndModeUI();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast(`Saved ${targets.length} note${targets.length === 1 ? '' : 's'} permanently!`, 'success');
        },

        async bulkDeleteSelectedFolders() {
            const folderSet = new Set(
                Array.from(this.fmState.selectedFolderIds).filter((fid) => this.folders.some((f) => f.id === fid))
            );
            if (!folderSet.size) return;

            const affectedVisible = this.noteIndex.filter((n) => folderSet.has(n.folderId) && n.deleted !== true).length;
            const confirmed = await this.showModal(
                `Delete ${folderSet.size} Folder${folderSet.size === 1 ? '' : 's'}?`,
                `${affectedVisible} note(s) inside will move safely to Unfiled.`,
                'Delete Folders',
                'trash-2'
            );
            if (!confirmed) return;

            const now = Date.now();
            const updatedIds = [];

            for (const meta of this.noteIndex) {
                if (meta.folderId && folderSet.has(meta.folderId)) {
                    meta.folderId = null;
                    meta.updatedAt = now;
                    updatedIds.push(meta.id);
                    const cached = this.noteBodyCache.get(meta.id);
                    if (cached) {
                        cached.folderId = null;
                        cached.updatedAt = now;
                    }
                    const full = await LessonDB.getNote(meta.id);
                    if (full) {
                        full.folderId = null;
                        full.updatedAt = now;
                        await LessonDB.putNote(full);
                    }
                }
            }

            this.folders = this.folders.filter((f) => !folderSet.has(f.id));
            if (this.activeFolderId && folderSet.has(this.activeFolderId)) {
                this.activeFolderId = null;
            }
            if (this.fmState.view.startsWith('folder:') && folderSet.has(this.fmState.view.slice('folder:'.length))) {
                this.fmState.view = 'root';
                this.fmState.selectedNoteIds.clear();
                this.fmState.lastClickedIndex = null;
            }
            this.fmState.selectedFolderIds.clear();

            await this.persistIndex();
            await this.saveFolders();
            if (updatedIds.length) {
                this.syncBatchMetadataToCloud(updatedIds, { folder_id: null, updated_at: now });
            }

            this.renderNotesList();
            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast(`Deleted ${folderSet.size} folder${folderSet.size === 1 ? '' : 's'}`, 'info');
        },

        async bulkDeleteMixedSelection() {
            const folderSet = new Set(
                Array.from(this.fmState.selectedFolderIds).filter((fid) => this.folders.some((f) => f.id === fid))
            );
            const noteTargets = Array.from(this.fmState.selectedNoteIds)
                .filter((id) => this.noteIndex.some((n) => n.id === id && n.deleted !== true));

            if (!folderSet.size && !noteTargets.length) return;
            if (folderSet.size && !noteTargets.length) {
                return this.bulkDeleteSelectedFolders();
            }
            if (!folderSet.size && noteTargets.length) {
                return this.bulkTrashSelectedNotes(noteTargets);
            }

            const ok = await this.showModal(
                `Delete ${folderSet.size} Folder${folderSet.size === 1 ? '' : 's'} & Trash ${noteTargets.length} Note${noteTargets.length === 1 ? '' : 's'}?`,
                'Selected notes move to Trash for 14 days. Other notes inside deleted folders move safely to My Files.',
                'Delete Selected',
                'trash-2'
            );
            if (!ok) return;

            const now = Date.now();
            const trashSet = new Set(noteTargets);
            const unfiledIds = [];

            for (const meta of this.noteIndex) {
                if (trashSet.has(meta.id) && meta.deleted !== true) {
                    meta.deleted = true;
                    meta.updatedAt = now;
                    if (meta.folderId && folderSet.has(meta.folderId)) {
                        meta.folderId = null;
                        unfiledIds.push(meta.id);
                    }
                } else if (meta.folderId && folderSet.has(meta.folderId)) {
                    meta.folderId = null;
                    meta.updatedAt = now;
                    unfiledIds.push(meta.id);
                } else {
                    continue;
                }

                const cached = this.noteBodyCache.get(meta.id);
                if (cached) {
                    cached.deleted = meta.deleted;
                    cached.folderId = meta.folderId;
                    cached.updatedAt = now;
                }
                const localNote = await LessonDB.getNote(meta.id);
                if (localNote) {
                    localNote.deleted = meta.deleted;
                    localNote.folderId = meta.folderId;
                    localNote.updatedAt = now;
                    await LessonDB.putNote(localNote);
                }
            }

            this.folders = this.folders.filter((f) => !folderSet.has(f.id));
            if (this.activeFolderId && folderSet.has(this.activeFolderId)) {
                this.activeFolderId = null;
            }
            if (this.fmState.view.startsWith('folder:') && folderSet.has(this.fmState.view.slice('folder:'.length))) {
                this.fmState.view = 'root';
            }

            this.fmState.selectedNoteIds.clear();
            this.fmState.selectedFolderIds.clear();
            this.fmState.lastClickedIndex = null;

            await this.persistIndex();
            await this.saveFolders();
            if (unfiledIds.length) {
                this.syncBatchMetadataToCloud(unfiledIds, { folder_id: null, updated_at: now });
            }
            if (noteTargets.length) {
                this.syncBatchMetadataToCloud(noteTargets, { deleted: true, updated_at: now });
            }

            if (this.mode === 'notes' && this.currentNoteId && trashSet.has(this.currentNoteId)) {
                const nextNote = this.noteIndex.find((n) => n.deleted !== true);
                if (nextNote) await this.loadNote(nextNote.id, { skipFlush: true });
                else await this.createNewNote({ skipMobileClose: true });
            } else {
                this.renderNotesList();
            }

            this.updateHeaderAndModeUI();
            this.refreshFileManagerIfOpen();
            this.showToast(`Deleted ${folderSet.size} folder${folderSet.size === 1 ? '' : 's'} & trashed ${noteTargets.length} note${noteTargets.length === 1 ? '' : 's'}`, 'info');
        },

        /* ========================================================
           OUTLINE, TABLES & NOTE LINKING
           ======================================================== */
        updateOutline() {
            const outlineList = document.getElementById('outlineList');
            if (!outlineList || !this.quill || !this.quill.root) return;

            const headings = this.quill.root.querySelectorAll('h1, h2, h3');
            const structureSig = Array.from(headings).map((h) => `${h.tagName}:${h.textContent}`).join('|');
            if (outlineList._lastSig === structureSig) return;
            outlineList._lastSig = structureSig;

            if (!headings.length) {
                outlineList.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-36 text-center px-4">
                        <i data-lucide="align-left" class="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2"></i>
                        <p class="text-slate-400 dark:text-slate-500 text-xs font-bold">Add H1 or H2 headings to jump between sections.</p>
                    </div>
                `;
                this.safeCreateIcons(outlineList);
                return;
            }

            outlineList.innerHTML = '';
            headings.forEach((heading, idx) => {
                const text = (heading.textContent || '').trim();
                if (!text) return;
                heading.id = `heading-${idx}`;
                const tag = heading.tagName.toLowerCase();
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `outline-link w-full text-left block truncate cursor-pointer mb-0.5 ${tag === 'h1' ? 'font-extrabold text-xs text-dark dark:text-slate-100' : 'font-bold text-[11px] text-slate-500 dark:text-slate-300 pl-4'}`;
                item.textContent = text;
                item.onclick = () => {
                    heading.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                    if (typeof window !== 'undefined' && window.innerWidth < 768) this.toggleOutline(false);
                };
                outlineList.appendChild(item);
            });
        },

        initTableToolbar() {
            this.tableToolbarEl = document.getElementById('table-toolbar');
            if (this.tableToolbarEl) {
                this.safeCreateIcons(this.tableToolbarEl);
            }
            document.getElementById('editor-container')?.addEventListener('scroll', () => {
                this.tableToolbarEl?.classList.add('is-hidden');
            });
        },

        updateTableToolbarForSelection(range) {
            if (!this.tableToolbarEl || !this.quill) return;
            if (!range) {
                this.tableToolbarEl.classList.add('is-hidden');
                return;
            }
            const lineRes = typeof this.quill.getLine === 'function' ? this.quill.getLine(range.index) : null;
            const cell = lineRes && lineRes[0]?.domNode?.closest?.('td');
            if (!cell) {
                this.tableToolbarEl.classList.add('is-hidden');
                return;
            }
            const rect = cell.getBoundingClientRect();
            const width = this.tableToolbarEl.offsetWidth || 260;
            let top = rect.top - 44;
            if (top < 10) top = rect.bottom + 8;
            let left = rect.right - width;
            left = Math.max(10, Math.min(left, (window.innerWidth || 1000) - width - 10));
            this.tableToolbarEl.style.top = `${top}px`;
            this.tableToolbarEl.style.left = `${left}px`;
            this.tableToolbarEl.classList.remove('is-hidden');
        },

        openTableDialog() {
            const dlg = document.getElementById('tableDialog');
            if (!dlg) return;
            const rowsEl = document.getElementById('tableRows');
            const colsEl = document.getElementById('tableCols');
            if (rowsEl) rowsEl.value = '3';
            if (colsEl) colsEl.value = '3';
            dlg.classList.add('open');
        },

        closeTableDialog() {
            document.getElementById('tableDialog')?.classList.remove('open');
        },

        confirmInsertTable() {
            const rows = Math.max(1, Math.min(20, parseInt(document.getElementById('tableRows')?.value, 10) || 3));
            const cols = Math.max(1, Math.min(10, parseInt(document.getElementById('tableCols')?.value, 10) || 3));
            this.closeTableDialog();
            this.insertTable(rows, cols);
        },

        insertTable(rows, cols) {
            if (!this.quill) return;
            const tableMod = this.quill.getModule('table');
            if (!tableMod) return;
            this.quill.focus();
            if (!this.quill.getSelection()) {
                this.quill.setSelection(this.quill.getLength(), 0);
            }
            tableMod.insertTable(rows, cols);
        },

        tableAction(action) {
            const tableMod = this.quill?.getModule('table');
            if (!tableMod) return;
            try {
                if (typeof tableMod[action] === 'function') {
                    tableMod[action]();
                }
            } catch (e) {
                console.warn('Table action failed:', action, e);
            }
        },

        ensureNoteLinkPopup() {
            if (document.getElementById('noteLinkSuggestions') || !document.body) return;
            const el = document.createElement('div');
            el.id = 'noteLinkSuggestions';
            el.className = 'is-hidden fixed z-50 bg-white dark:bg-slate-800 border-2 border-dark dark:border-slate-500 rounded-xl shadow-hard-sm p-1 min-w-[230px] max-h-[210px] overflow-y-auto custom-scrollbar';
            document.body.appendChild(el);
        },

        getNoteLinkQuery() {
            const range = this.quill?.getSelection();
            if (!range) return '';
            const before = this.quill.getText(0, range.index);
            return before.substring(this.noteLinkTriggerIndex + 2);
        },

        getFilteredLinkTargets(query = '') {
            const q = String(query || '').toLowerCase();
            return this.noteIndex
                .filter((n) => !n.deleted && n.id !== this.currentNoteId)
                .filter((n) => (n.title || 'Untitled').toLowerCase().includes(q));
        },

        checkNoteLinkTrigger() {
            if (!this.quill) return;
            const range = this.quill.getSelection();
            if (!range || range.length > 0) {
                this.closeNoteLinkSuggestions();
                return;
            }
            const before = this.quill.getText(0, range.index);
            if (!this.noteLinkSearchActive) {
                if (before.endsWith('[[')) {
                    this.noteLinkSearchActive = true;
                    this.noteLinkTriggerIndex = range.index - 2;
                    this.noteLinkActiveIndex = 0;
                    this.showNoteLinkSuggestions();
                }
            } else {
                if (range.index < this.noteLinkTriggerIndex + 2) {
                    this.closeNoteLinkSuggestions();
                    return;
                }
                const q = before.substring(this.noteLinkTriggerIndex + 2);
                if (q.includes('\n')) {
                    this.closeNoteLinkSuggestions();
                    return;
                }
                this.renderNoteLinkSuggestions(this.getFilteredLinkTargets(q));
            }
        },

        showNoteLinkSuggestions() {
            const range = this.quill?.getSelection();
            const popup = document.getElementById('noteLinkSuggestions');
            if (!range || !popup) return;
            const rect = this.quill.container.getBoundingClientRect();
            const bounds = this.quill.getBounds(range.index);
            popup.style.top = `${Math.max(12, rect.top + bounds.bottom)}px`;
            popup.style.left = `${Math.max(12, rect.left + bounds.left)}px`;
            popup.classList.remove('is-hidden');
            this.renderNoteLinkSuggestions(this.getFilteredLinkTargets(''));
        },

        closeNoteLinkSuggestions() {
            this.noteLinkSearchActive = false;
            this.noteLinkTriggerIndex = -1;
            this.noteLinkActiveIndex = 0;
            document.getElementById('noteLinkSuggestions')?.classList.add('is-hidden');
        },

        renderNoteLinkSuggestions(filtered) {
            const popup = document.getElementById('noteLinkSuggestions');
            if (!popup) return;

            if (!filtered.length) {
                popup.innerHTML = '<div class="px-3 py-2 text-xs font-bold text-slate-400 italic">No matching notes</div>';
                return;
            }

            popup.innerHTML = '';
            filtered.slice(0, 12).forEach((note, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const selected = idx === this.noteLinkActiveIndex;
                btn.className = `w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${selected ? 'bg-blue text-white' : 'text-dark dark:text-slate-200 hover:bg-blue/10'}`;
                btn.innerHTML = `<i data-lucide="file-text" class="w-3.5 h-3.5 flex-none"></i><span class="truncate">${escapeHtml(note.title || 'Untitled')}</span>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertNoteLink(note);
                };
                popup.appendChild(btn);
            });
            this.safeCreateIcons(popup);
        },

        insertNoteLink(note) {
            const range = this.quill?.getSelection();
            if (!range) return;
            const len = range.index - this.noteLinkTriggerIndex;
            this.quill.deleteText(this.noteLinkTriggerIndex, len);
            const label = `Note: ${note.title || 'Untitled'}`;
            this.quill.insertText(this.noteLinkTriggerIndex, label, 'link', `#note-${note.id}`);
            this.quill.insertText(this.noteLinkTriggerIndex + label.length, ' ');
            this.quill.setSelection(this.noteLinkTriggerIndex + label.length + 1, 0);
            this.closeNoteLinkSuggestions();
        },

        /* ========================================================
           ON-DEMAND EXPORT (JSON, MARKDOWN, LAZY HTML2PDF)
           ======================================================== */
        async resolveImagesToBase64(html) {
            if (!html) return '';
            const regex = /idb:\/\/([\w_-]+)/g;
            const ids = Array.from(new Set([...html.matchAll(regex)].map((m) => m[1])));
            let out = html;
            for (const id of ids) {
                try {
                    const data = await LessonDB.getImage(id);
                    if (data) {
                        const b64 = arrayBufferToBase64(data.data);
                        out = out.split(`idb://${id}`).join(`data:${data.type};base64,${b64}`);
                    }
                } catch (e) { }
            }
            return out;
        },

        downloadFile(filename, content, mimeType) {
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                if (document.body && typeof document.body.appendChild === 'function') {
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    a.click();
                }
                setTimeout(() => {
                    try { URL.revokeObjectURL(url); } catch (e) { }
                }, 1000);
                return;
            }
            const a = document.createElement('a');
            a.href = `data:${mimeType},${encodeURIComponent(content)}`;
            a.download = filename;
            a.click();
        },

        async exportJSON() {
            await this.flushPendingSave();
            this.showToast('Preparing JSON backup...', 'info');
            const exportedNotes = [];
            await LessonDB.iterateAllNotesForExport((note) => exportedNotes.push(note));

            for (const note of exportedNotes) {
                note.content = await this.resolveImagesToBase64(note.content || '');
            }

            const payload = {
                version: 2,
                exportedAt: new Date().toISOString(),
                folders: this.folders,
                notes: exportedNotes,
                bufferNotes: this.bufferNotes
            };

            const jsonStr = JSON.stringify(payload, null, 2);
            this.downloadFile(`klasskit_notes_${new Date().toISOString().split('T')[0]}.json`, jsonStr, 'application/json;charset=utf-8');
            this.showToast('Backup exported!', 'success');
        },

        triggerImport() {
            document.getElementById('importInput')?.click();
        },

        async processImport(inputEl) {
            const file = inputEl?.files?.[0];
            if (!file) return;

            const confirmed = await this.showModal(
                'Import Backup?',
                'This will replace your current Notes library with the backup file.',
                'Yes, Replace All',
                'triangle-alert'
            );
            if (!confirmed) {
                inputEl.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(String(e.target?.result || ''));
                    const incomingNotes = Array.isArray(parsed)
                        ? parsed
                        : (parsed && Array.isArray(parsed.notes) ? parsed.notes : null);

                    if (!incomingNotes) {
                        this.showToast('Invalid backup JSON format', 'error');
                        return;
                    }

                    const oldIds = this.noteIndex.map((n) => n.id);
                    await LessonDB.clearAllNotesLocal();
                    this.noteBodyCache.clear();
                    this.noteIndex = [];

                    // Fire-and-forget cloud cleanup for replaced notes in one batched check
                    if (oldIds.length && typeof getCloudUser === 'function' && typeof db !== 'undefined') {
                        getCloudUser().then((user) => {
                            if (!user || user.is_sandbox) return;
                            oldIds.forEach((oldId) => {
                                Promise.resolve(db.from('notes').delete().eq('id', oldId).eq('user_id', user.id)).catch(() => { });
                            });
                        }).catch(() => { });
                    }

                    if (!Array.isArray(parsed) && Array.isArray(parsed.folders)) {
                        this.folders = sanitizeFoldersList(parsed.folders);
                        await this.saveFolders();
                    }

                    if (!Array.isArray(parsed) && Array.isArray(parsed.bufferNotes)) {
                        this.bufferNotes = parsed.bufferNotes.map((b) => sanitizeBufferNote(b)).filter(Boolean);
                        this.purgeExpiredBuffers(false);
                        this.saveBufferNotesLocal();
                    }

                    for (const rawNote of incomingNotes) {
                        if (!rawNote || typeof rawNote !== 'object') continue;
                        let content = sanitizeNoteHtml(rawNote.content || '');
                        const b64Matches = [...content.matchAll(/data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)/gi)];
                        for (const m of b64Matches) {
                            try {
                                const imgId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                                await LessonDB.putImage(imgId, base64ToArrayBuffer(m[2]), m[1]);
                                content = content.split(m[0]).join(`idb://${imgId}`);
                            } catch (err) {
                                console.warn('Import image conversion skipped:', err);
                            }
                        }

                        const cleanNote = {
                            id: String(rawNote.id || Date.now() + Math.random()),
                            title: String(rawNote.title || '').slice(0, 200),
                            content,
                            folderId: rawNote.folderId ? String(rawNote.folderId) : null,
                            deleted: Boolean(rawNote.deleted),
                            sortOrder: typeof rawNote.sortOrder === 'number' ? rawNote.sortOrder : null,
                            updatedAt: typeof rawNote.updatedAt === 'number' ? rawNote.updatedAt : Date.now()
                        };

                        await LessonDB.putNote(cleanNote);
                        this.upsertNoteIndexEntry(cleanNote, { needsCloudFetch: false });
                    }

                    await this.persistIndex();
                    this.mode = 'notes';
                    const first = this.noteIndex.find((n) => !n.deleted);
                    if (first) await this.loadNote(first.id, { skipFlush: true });
                    else await this.createNewNote({ skipMobileClose: true });

                    this.updateHeaderAndModeUI();
                    this.renderNotesList();
                    this.showToast(`Restored ${this.noteIndex.length} note(s)!`, 'success');
                } catch (err) {
                    console.error('Import error:', err);
                    this.showToast('Could not parse backup file', 'error');
                }
            };
            reader.readAsText(file);
            inputEl.value = '';
        },

        async getActiveDocumentForExport() {
            await this.flushPendingSave();
            if (this.mode === 'buffer' && this.activeBufferId) {
                return this.bufferNotes.find((b) => b.id === this.activeBufferId) || null;
            }
            if (this.currentNoteId) {
                return await this.ensureFullNote(this.currentNoteId);
            }
            return null;
        },

        async ensureHtml2Pdf() {
            if (typeof window.html2pdf === 'function') return window.html2pdf;
            this.showToast('Loading PDF exporter...', 'info');
            await loadExternalScript(HTML2PDF_SRC, () => typeof window.html2pdf === 'function');
            return window.html2pdf;
        },

        async exportPDF() {
            const note = await this.getActiveDocumentForExport();
            if (!note) return;
            const prevStatus = document.getElementById('statusText')?.textContent;
            this.setSaveStatus('syncing', 'Loading PDF...');

            try {
                const exporter = await this.ensureHtml2Pdf();
                if (typeof exporter !== 'function') throw new Error('html2pdf unavailable');

                const printEl = document.getElementById('print-container');
                const printBody = document.getElementById('print-body');
                const printTitle = document.getElementById('print-title');
                const printDate = document.getElementById('print-date');

                if (printTitle) printTitle.textContent = note.title || 'Untitled';
                if (printDate) {
                    printDate.textContent = new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }

                const resolvedHtml = sanitizeNoteHtml(await this.resolveImagesToBase64(note.content || ''));
                if (printBody) {
                    printBody.innerHTML = resolvedHtml;
                    printBody.className = 'print-body';
                }
                if (printEl) printEl.classList.remove('is-hidden');

                const opt = {
                    margin: [0.6, 0.6, 0.6, 0.6],
                    filename: `${(note.title || 'note').replace(/\s+/g, '_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.96 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                };

                await exporter().set(opt).from(printEl).save();
                if (printEl) printEl.classList.add('is-hidden');
                this.setSaveStatus('saved', prevStatus || 'Auto-saved');
                this.showToast('PDF exported!', 'success');
            } catch (err) {
                console.error('PDF export failed:', err);
                document.getElementById('print-container')?.classList.add('is-hidden');
                this.setSaveStatus('error', 'PDF export failed');
                this.showToast('Could not generate PDF', 'error');
            }
        },

        htmlToMarkdown(html) {
            const temp = document.createElement('div');
            temp.innerHTML = sanitizeNoteHtml(html);

            const walk = (node) => {
                if (!node) return '';
                if (node.nodeType === 3) return node.textContent || '';
                if (node.nodeType !== 1) return '';
                const tag = node.tagName.toLowerCase();
                const children = Array.from(node.childNodes || []).map(walk).join('');

                switch (tag) {
                    case 'h1': return `\n# ${children.trim()}\n\n`;
                    case 'h2': return `\n## ${children.trim()}\n\n`;
                    case 'h3': return `\n### ${children.trim()}\n\n`;
                    case 'p': {
                        if (typeof node.hasAttribute === 'function' && node.hasAttribute('data-list')) {
                            const checked = node.getAttribute('data-list') === 'checked';
                            return `- [${checked ? 'x' : ' '}] ${children.trim()}\n`;
                        }
                        return `${children.trim()}\n\n`;
                    }
                    case 'br': return '\n';
                    case 'strong':
                    case 'b': return `**${children}**`;
                    case 'em':
                    case 'i': return `*${children}*`;
                    case 'u': return `<u>${children}</u>`;
                    case 's':
                    case 'strike':
                    case 'del': return `~~${children}~~`;
                    case 'a': return `[${children}](${node.getAttribute('href') || ''})`;
                    case 'img': return `\n![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})\n\n`;
                    case 'blockquote': return `\n> ${children.trim().split('\n').join('\n> ')}\n\n`;
                    case 'code': return `\`${children}\``;
                    case 'pre': return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
                    case 'hr': return '\n---\n\n';
                    case 'ul': return `${Array.from(node.children || []).map((li) => `\n- ${walk(li).trim()}`).join('')}\n\n`;
                    case 'ol': return `${Array.from(node.children || []).map((li, i) => `\n${i + 1}. ${walk(li).trim()}`).join('')}\n\n`;
                    default: return children;
                }
            };

            return walk(temp).trim();
        },

        async exportMarkdown() {
            const note = await this.getActiveDocumentForExport();
            if (!note) return;
            try {
                const resolvedHtml = await this.resolveImagesToBase64(note.content || '');
                const md = this.htmlToMarkdown(resolvedHtml);
                const frontmatter = `---\ntitle: ${note.title || 'Untitled'}\ndate: ${new Date(note.updatedAt || Date.now()).toISOString()}\n---\n\n`;
                const filename = `${(note.title || 'note').replace(/\s+/g, '_')}.md`;
                this.downloadFile(filename, frontmatter + md, 'text/markdown;charset=utf-8');
                this.showToast('Markdown exported!', 'success');
            } catch (e) {
                console.error('Markdown export failed:', e);
                this.showToast('Markdown export failed', 'error');
            }
        },

        /* ========================================================
           TOOLTIPS, TOASTS & SCOPED ICONS
           ======================================================== */
        initCursorTooltips() {
            const tooltip = document.getElementById('tooltip');
            if (!tooltip) return;
            let activeTarget = null;

            document.addEventListener('mouseover', (e) => {
                const el = e.target.closest?.('[data-tooltip]');
                if (!el) {
                    tooltip.classList.remove('visible');
                    activeTarget = null;
                    return;
                }
                activeTarget = el;
                const label = el.getAttribute('data-tooltip') || '';
                const shortcut = el.getAttribute('data-tooltip-shortcut');
                tooltip.textContent = shortcut ? `${label} (${shortcut})` : label;
                tooltip.classList.add('visible');
            });

            document.addEventListener('mousemove', (e) => {
                if (!activeTarget) return;
                const x = Math.min(e.clientX + 14, (window.innerWidth || 1000) - (tooltip.offsetWidth || 120) - 8);
                const y = Math.min(e.clientY, (window.innerHeight || 700) - (tooltip.offsetHeight || 28) - 8);
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;
            });

            document.addEventListener('mouseleave', (e) => {
                if (activeTarget && !activeTarget.contains(e.relatedTarget)) {
                    tooltip.classList.remove('visible');
                    activeTarget = null;
                }
            }, true);
        },

        showToast(message, type = 'success') {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const iconMap = {
                success: 'circle-check',
                error: 'circle-alert',
                warning: 'triangle-alert',
                info: 'info',
                folder: 'folder'
            };
            const validTones = ['success', 'error', 'info', 'folder', 'orange', 'pink'];
            const tone = validTones.includes(type) ? type : 'info';
            const iconName = iconMap[type] || 'info';

            const toast = document.createElement('div');
            toast.className = `toast-item tone-${tone}`;
            toast.innerHTML = `<i data-lucide="${escapeHtml(iconName)}" class="toast-icon"></i><span>${escapeHtml(message)}</span>`;
            container.appendChild(toast);
            this.safeCreateIcons(toast);

            requestAnimationFrame(() => toast.classList.add('is-visible'));
            setTimeout(() => {
                toast.classList.remove('is-visible');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 220);
            }, 2600);
        },

        safeCreateIcons(rootEl) {
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
                try {
                    if (rootEl && rootEl !== document) {
                        lucide.createIcons({ root: rootEl });
                    } else {
                        lucide.createIcons();
                    }
                } catch (e) {
                    lucide.createIcons();
                }
            }
        }
    };

    window.app = app;
    window.__lessonNoteDebug = {
        app,
        LessonDB,
        escapeHtml,
        fastStripHtml,
        extractPreview,
        countWords,
        formatTimeRemaining,
        sanitizeNoteHtml,
        sanitizeBufferNote,
        sanitizeIndexEntry,
        BUFFER_TTL_MS,
        TRASH_TTL_MS,
        PAGE_SIZE,
        FM_PAGE_SIZE,
        MAX_BODY_CACHE
    };

    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
})();

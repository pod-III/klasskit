'use strict';

/* ========================================================
   KLASSKIT NOTES (LESSON NOTE) - SCRIPT.JS
   Soft Brutalist Chromebook Notes + 3-Day Temporary Buffer
   Metadata-First IndexedDB & On-Demand Single-Note Sync
   ======================================================== */


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
            needsCloudFetch: Boolean(raw.needsCloudFetch),
            localOnly: Boolean(raw.localOnly),
            pendingBodySync: Boolean(raw.pendingBodySync)
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

        async deleteNoteLocal(id) {
            const dbConn = await this.open();
            if (!dbConn) return;
            await new Promise((resolve, reject) => {
                const tx = dbConn.transaction(STORES.NOTES, 'readwrite');
                tx.objectStore(STORES.NOTES).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target?.error || new Error('deleteNoteLocal failed'));
            });
        },

        async deleteNote(id) {
            await this.deleteNoteLocal(id);

            // Cloud delete if authenticated (awaited so caller knows it completed or logged)
            try {
                if (typeof getCloudUser === 'function' && typeof db !== 'undefined') {
                    const user = await getCloudUser();
                    if (user && !user.is_sandbox) {
                        const { error } = await db.from('notes').delete().eq('id', id).eq('user_id', user.id);
                        if (error) {
                            console.warn('Cloud note delete failed:', error);
                        }
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
                            needsCloudFetch: false,
                            localOnly: false,
                            pendingBodySync: false
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
        _cloudSyncPromise: null,
        _cloudSyncQueuedForce: false,
        _lastCloudSyncAt: 0,
        _debouncedSave: null,
        _debouncedOutline: null,
        _debouncedListRender: null,
        _initialized: false,

    };

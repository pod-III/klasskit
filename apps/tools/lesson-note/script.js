'use strict';

Object.assign(app, {
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

            // Reconcile cloud metadata BEFORE picking/creating the initial note so cloud moves/deletes win
            let syncedAtBoot = false;
            try {
                const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
                if (isOnline && typeof getCloudUser === 'function') {
                    const cloudUser = await getCloudUser();
                    if (cloudUser && !cloudUser.is_sandbox) {
                        await this.syncCloudMetadataInBackground({ force: true, isBoot: true });
                        syncedAtBoot = true;
                    }
                }
            } catch (e) {
                console.warn('Boot cloud sync skipped:', e);
            }

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

            // Phase 3: Deferred background maintenance & metadata-only cloud sync if skipped at boot
            setTimeout(() => {
                this.purgeExpiredTrash();
                if (!syncedAtBoot) {
                    this.syncCloudMetadataInBackground();
                }
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

});

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

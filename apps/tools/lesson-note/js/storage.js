'use strict';

Object.assign(app, {
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
                needsCloudFetch: extras.needsCloudFetch !== undefined ? extras.needsCloudFetch : Boolean(existing?.needsCloudFetch),
                localOnly: extras.localOnly !== undefined ? extras.localOnly : Boolean(existing?.localOnly),
                pendingBodySync: extras.pendingBodySync !== undefined ? extras.pendingBodySync : Boolean(existing?.pendingBodySync)
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

            this.upsertNoteIndexEntry(newNote, { preview: '', needsCloudFetch: false, localOnly: true, pendingBodySync: false });
            this.cacheNoteBody(newNote);
            await LessonDB.putNote(newNote);
            await this.persistIndex();

            await this.loadNote(newNote.id, { skipFlush: true });
            this.syncSingleNoteToCloud(newNote, { isCreate: true });

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
                const now = Date.now();
                meta.deleted = false;
                meta.updatedAt = now;
                await this.updateLocalNoteMetadata(id, { deleted: false, updatedAt: now });
                await this.persistIndex();
                if (meta.localOnly) {
                    const localFull = (await LessonDB.getNote(id)) || { ...meta, content: '' };
                    this.syncSingleNoteToCloud(localFull, { isCreate: true });
                } else {
                    this.syncBatchMetadataToCloud([id], { deleted: false, updated_at: now });
                }
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

            // If ensureFullNote discovered the note was permanently deleted in cloud and pruned it
            if (!fullNote && !this.noteIndex.some((n) => n.id === id)) {
                this.hasDirtyEdits = false;
                this.currentNoteId = null;
                this.showToast('Note was deleted on another device', 'info');
                const fallback = this.noteIndex.find((n) => (this.mode === 'trash' ? n.deleted : !n.deleted));
                if (fallback) {
                    await this.loadNote(fallback.id, { skipFlush: true });
                } else {
                    this.showEmptyEditorState(this.mode === 'trash' ? 'trash' : 'notes');
                }
                return;
            }

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
                const res = await this.fetchSingleNoteFromCloud(id);
                if (res.status === 'ok' && res.note) {
                    const cloudNote = res.note;
                    await LessonDB.putNote(cloudNote);
                    this.cacheNoteBody(cloudNote);
                    meta.title = cloudNote.title || '';
                    meta.preview = extractPreview(cloudNote.content, 90);
                    meta.updatedAt = cloudNote.updatedAt || meta.updatedAt;
                    meta.folderId = cloudNote.folderId || null;
                    meta.deleted = Boolean(cloudNote.deleted);
                    meta.needsCloudFetch = false;
                    meta.localOnly = false;
                    await this.persistIndex();
                    return cloudNote;
                }
                if (res.status === 'not_found' && !meta.localOnly) {
                    await this.removeNoteLocally(id);
                    await this.persistIndex();
                    this.renderNotesList();
                    this.updateHeaderAndModeUI();
                    this.refreshFileManagerIfOpen();
                    this.updateCacheStatusLabel();
                    return null;
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

            this.upsertNoteIndexEntry(newNote, { needsCloudFetch: false, localOnly: true, pendingBodySync: false });
            this.cacheNoteBody(newNote);
            await LessonDB.putNote(newNote);
            await this.persistIndex();
            this.syncSingleNoteToCloud(newNote, { isCreate: true });

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
            meta.deleted = true;
            meta.updatedAt = now;
            meta.pendingBodySync = false;

            await this.updateLocalNoteMetadata(noteId, { deleted: true, updatedAt: now });
            await this.persistIndex();

            if (meta.localOnly) {
                const localFull = (await LessonDB.getNote(noteId)) || { ...meta, content: '' };
                this.syncSingleNoteToCloud(localFull, { isCreate: true });
            } else {
                this.syncBatchMetadataToCloud([noteId], { deleted: true, updated_at: now });
            }

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

            const now = Date.now();
            meta.deleted = false;
            meta.updatedAt = now;

            await this.updateLocalNoteMetadata(meta.id, { deleted: false, updatedAt: now });
            await this.persistIndex();

            if (meta.localOnly) {
                const localFull = (await LessonDB.getNote(meta.id)) || { ...meta, content: '' };
                this.syncSingleNoteToCloud(localFull, { isCreate: true });
            } else {
                this.syncBatchMetadataToCloud([meta.id], { deleted: false, updated_at: now });
            }

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

        async updateLocalNoteMetadata(id, patch) {
            if (!id || !patch) return;
            const cached = this.noteBodyCache.get(id);
            if (cached) {
                if (patch.folderId !== undefined) cached.folderId = patch.folderId;
                if (patch.deleted !== undefined) cached.deleted = Boolean(patch.deleted);
                if (patch.title !== undefined) cached.title = patch.title;
                if (patch.updatedAt !== undefined) cached.updatedAt = patch.updatedAt;
            }
            const localNote = await LessonDB.getNote(id);
            if (localNote) {
                if (patch.folderId !== undefined) localNote.folderId = patch.folderId;
                if (patch.deleted !== undefined) localNote.deleted = Boolean(patch.deleted);
                if (patch.title !== undefined) localNote.title = patch.title;
                if (patch.updatedAt !== undefined) localNote.updatedAt = patch.updatedAt;
                await LessonDB.putNote(localNote);
            }
        },

        async removeNoteLocally(id) {
            if (!id) return;
            this.noteIndex = this.noteIndex.filter((n) => n.id !== id);
            this.noteBodyCache.delete(id);
            this.fmState?.selectedNoteIds?.delete(id);
            await LessonDB.deleteNoteLocal(id);
        },

        async fetchAllCloudNoteMeta(userId) {
            const pageSize = 1000;
            const allRows = [];
            let from = 0;
            while (true) {
                const { data, error } = await db.from('notes')
                    .select('id, title, folder_id, deleted, updated_at')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false })
                    .range(from, from + pageSize - 1);
                if (error) throw error;
                const rows = Array.isArray(data) ? data : [];
                allRows.push(...rows);
                if (rows.length < pageSize) break;
                from += pageSize;
            }
            return allRows;
        },

        async refreshFoldersFromCloud() {
            if (typeof getCloudUser !== 'function' || typeof db === 'undefined') return false;
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return false;
                const { data, error } = await db.from('note_folders')
                    .select('folders')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (error || !data || !Array.isArray(data.folders)) return false;

                const collapsedMap = new Map(this.folders.map((f) => [f.id, Boolean(f.collapsed)]));
                const merged = sanitizeFoldersList(data.folders).map((f) => ({
                    ...f,
                    collapsed: collapsedMap.has(f.id) ? collapsedMap.get(f.id) : Boolean(f.collapsed)
                }));
                this.folders = merged;
                this.saveFoldersMirror();
                await LessonDB.putSetting(SETTINGS_KEYS.FOLDERS, this.folders);
                return true;
            } catch (e) {
                console.warn('Folder cloud refresh skipped:', e);
                return false;
            }
        },

        async syncSingleNoteToCloud(note, options = {}) {
            if (!note || !note.id || typeof getCloudUser !== 'function' || typeof db === 'undefined') return false;
            const meta = this.noteIndex.find((n) => n.id === note.id);
            const shouldUpsert = Boolean(options.isCreate || meta?.localOnly);
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return false;

                this.setSyncBadge('Syncing...', 'loader-circle', 'text-blue animate-spin');

                if (shouldUpsert) {
                    const { error } = await db.from('notes').upsert({
                        id: note.id,
                        user_id: user.id,
                        title: note.title || '',
                        content: note.content || '',
                        folder_id: note.folderId || null,
                        deleted: Boolean(note.deleted),
                        updated_at: note.updatedAt
                    }, { onConflict: 'id,user_id' });
                    if (error) throw error;

                    if (meta) {
                        meta.localOnly = false;
                        meta.pendingBodySync = false;
                        await this.persistIndex();
                    }
                    this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
                    return true;
                }

                // Existing note body/title save: NEVER overwrite folder_id or deleted from stale local state
                const { data, error } = await db.from('notes')
                    .update({
                        title: note.title || '',
                        content: note.content || '',
                        updated_at: note.updatedAt
                    })
                    .eq('id', note.id)
                    .eq('user_id', user.id)
                    .eq('deleted', false)
                    .select('id, folder_id, deleted, updated_at');

                if (error) throw error;

                if (Array.isArray(data) && data.length > 0) {
                    if (meta) {
                        meta.pendingBodySync = false;
                        const cloudFolderId = data[0].folder_id ? String(data[0].folder_id) : null;
                        if ((meta.folderId || null) !== cloudFolderId) {
                            meta.folderId = cloudFolderId;
                            await this.updateLocalNoteMetadata(note.id, { folderId: cloudFolderId });
                            this.renderNotesList();
                            this.refreshFileManagerIfOpen();
                        }
                        await this.persistIndex();
                    }
                    this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
                    return true;
                }

                // 0 rows matched: note was trashed or permanently deleted on another device — do NOT resurrect it
                if (meta) {
                    meta.pendingBodySync = false;
                    await this.persistIndex();
                }
                this.syncCloudMetadataInBackground({ force: true });
                return false;
            } catch (e) {
                console.warn('Single-note cloud sync skipped:', e);
                if (meta) {
                    if (shouldUpsert) meta.localOnly = true;
                    else meta.pendingBodySync = true;
                    await this.persistIndex();
                }
                this.setSyncBadge('Local Saved', 'cloud-off', 'text-orange');
                return false;
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
                    const { data, error } = await table
                        .update(patch)
                        .in('id', ids)
                        .eq('user_id', user.id)
                        .select('id');
                    if (error) throw error;
                    if (Array.isArray(data) && data.length < ids.length) {
                        this.syncCloudMetadataInBackground({ force: true });
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
                const { error } = await db.from('note_folders').upsert({
                    user_id: user.id,
                    folders: this.folders
                }, { onConflict: 'user_id' });
                if (error) throw error;
            } catch (e) {
                console.warn('Folder cloud sync skipped:', e);
            }
        },

        async syncCloudMetadataInBackground(options = {}) {
            if (!options.force && this._lastCloudSyncAt && (Date.now() - this._lastCloudSyncAt) < 5000) {
                return;
            }
            if (this._cloudSyncPromise) {
                if (options.force) this._cloudSyncQueuedForce = true;
                return this._cloudSyncPromise;
            }

            const run = (async () => {
                if (typeof getCloudUser !== 'function' || typeof db === 'undefined') {
                    this.setSyncBadge('Local Mode', 'hard-drive', 'text-blue');
                    return;
                }
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    this.setSyncBadge('Offline Ready', 'cloud-off', 'text-orange');
                    return;
                }
                try {
                    const user = await getCloudUser();
                    if (!user || user.is_sandbox) {
                        this.setSyncBadge('Local Mode', 'hard-drive', 'text-blue');
                        return;
                    }

                    this.setSyncBadge('Syncing Meta...', 'loader-circle', 'text-blue animate-spin');

                    const [cloudRows, foldersRes] = await Promise.all([
                        this.fetchAllCloudNoteMeta(user.id),
                        db.from('note_folders')
                            .select('folders')
                            .eq('user_id', user.id)
                            .maybeSingle()
                    ]);

                    let indexChanged = false;

                    // 1. Reconcile folders (cloud wins, preserving local collapsed state)
                    if (foldersRes && !foldersRes.error) {
                        if (foldersRes.data && Array.isArray(foldersRes.data.folders)) {
                            const collapsedMap = new Map(this.folders.map((f) => [f.id, Boolean(f.collapsed)]));
                            const nextFolders = sanitizeFoldersList(foldersRes.data.folders).map((f) => ({
                                ...f,
                                collapsed: collapsedMap.has(f.id) ? collapsedMap.get(f.id) : Boolean(f.collapsed)
                            }));
                            if (JSON.stringify(nextFolders) !== JSON.stringify(this.folders)) {
                                this.folders = nextFolders;
                                this.saveFoldersMirror();
                                await LessonDB.putSetting(SETTINGS_KEYS.FOLDERS, this.folders);
                                indexChanged = true;
                            }
                        } else if (foldersRes.data === null && this.folders.length > 0) {
                            await this.saveFoldersToCloud();
                        }
                    }

                    // 2. Reconcile cloud notes against local index (cloud folder/delete state always wins)
                    const cloudMap = new Map();
                    const pendingBodyRetries = [];
                    let activeNotePruned = false;
                    let activeNoteMovedToTrash = false;
                    let activeNoteRestored = false;

                    for (const cn of cloudRows) {
                        if (!cn || !cn.id) continue;
                        const cnId = String(cn.id);
                        const cnTitle = typeof cn.title === 'string' ? cn.title : '';
                        const cnFolderId = cn.folder_id ? String(cn.folder_id) : null;
                        const cnDeleted = Boolean(cn.deleted);
                        const cnUpdated = Number(cn.updated_at) || Date.now();
                        cloudMap.set(cnId, { id: cnId, title: cnTitle, folderId: cnFolderId, deleted: cnDeleted, updatedAt: cnUpdated });

                        const existing = this.noteIndex.find((m) => m.id === cnId);
                        if (!existing) {
                            this.noteIndex.push(sanitizeIndexEntry({
                                id: cnId,
                                title: cnTitle,
                                preview: '',
                                folderId: cnFolderId,
                                deleted: cnDeleted,
                                updatedAt: cnUpdated,
                                sortOrder: null,
                                needsCloudFetch: true,
                                localOnly: false,
                                pendingBodySync: false
                            }));
                            indexChanged = true;
                            continue;
                        }

                        if (existing.localOnly) {
                            existing.localOnly = false;
                            indexChanged = true;
                        }

                        // Folder state: cloud always wins regardless of updatedAt
                        if ((existing.folderId || null) !== cnFolderId) {
                            existing.folderId = cnFolderId;
                            await this.updateLocalNoteMetadata(cnId, { folderId: cnFolderId });
                            indexChanged = true;
                        }

                        // Trash state: cloud always wins regardless of updatedAt
                        if (Boolean(existing.deleted) !== cnDeleted) {
                            if (cnId === this.currentNoteId && cnDeleted && !existing.deleted) {
                                activeNoteMovedToTrash = true;
                            } else if (cnId === this.currentNoteId && !cnDeleted && existing.deleted) {
                                activeNoteRestored = true;
                            }
                            existing.deleted = cnDeleted;
                            if (cnDeleted) existing.pendingBodySync = false;
                            await this.updateLocalNoteMetadata(cnId, { deleted: cnDeleted });
                            indexChanged = true;
                        }

                        // Title & Body state
                        if (existing.pendingBodySync && !cnDeleted) {
                            if (cnUpdated > (existing.updatedAt || 0)) {
                                existing.title = cnTitle;
                                existing.updatedAt = cnUpdated;
                                existing.pendingBodySync = false;
                                existing.needsCloudFetch = true;
                                this.noteBodyCache.delete(cnId);
                                await this.updateLocalNoteMetadata(cnId, { title: cnTitle, updatedAt: cnUpdated });
                                indexChanged = true;
                            } else if (!(this.hasDirtyEdits && this.currentNoteId === cnId)) {
                                pendingBodyRetries.push(cnId);
                            }
                        } else if (cnUpdated !== (existing.updatedAt || 0) || (existing.title || '') !== cnTitle) {
                            const isActivelyEditing = Boolean(this.hasDirtyEdits && this.currentNoteId === cnId && !cnDeleted);
                            if (!isActivelyEditing) {
                                existing.title = cnTitle;
                                existing.updatedAt = cnUpdated;
                                existing.needsCloudFetch = true;
                                this.noteBodyCache.delete(cnId);
                                await this.updateLocalNoteMetadata(cnId, { title: cnTitle, updatedAt: cnUpdated });
                                indexChanged = true;
                            }
                        }
                    }

                    // 3. Prune local notes missing from cloud (except genuine offline-created localOnly notes)
                    for (const meta of [...this.noteIndex]) {
                        if (cloudMap.has(meta.id)) continue;
                        if (meta.localOnly === true) {
                            const localFull = this.noteBodyCache.get(meta.id) || (await LessonDB.getNote(meta.id));
                            if (localFull) {
                                await this.syncSingleNoteToCloud(localFull, { isCreate: true });
                            } else {
                                meta.localOnly = false;
                                await this.removeNoteLocally(meta.id);
                                indexChanged = true;
                            }
                        } else {
                            if (meta.id === this.currentNoteId) activeNotePruned = true;
                            await this.removeNoteLocally(meta.id);
                            indexChanged = true;
                        }
                    }

                    for (const retryId of pendingBodyRetries) {
                        const localFull = this.noteBodyCache.get(retryId) || (await LessonDB.getNote(retryId));
                        if (localFull && !localFull.deleted) {
                            await this.syncSingleNoteToCloud(localFull, { isCreate: false });
                        }
                    }

                    if (indexChanged) {
                        this.noteIndex.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                        await this.persistIndex();
                        this.renderNotesList();
                        this.updateHeaderAndModeUI();
                        this.refreshFileManagerIfOpen();
                        this.updateCacheStatusLabel();
                    }

                    // 4. Reconcile currently open note if it was deleted/trashed/restored/updated on another device
                    if (!options.isBoot && this.mode !== 'buffer' && this.currentNoteId) {
                        if (activeNotePruned) {
                            this.hasDirtyEdits = false;
                            this.currentNoteId = null;
                            const fallback = this.noteIndex.find((n) => (this.mode === 'trash' ? n.deleted : !n.deleted));
                            if (fallback) {
                                await this.loadNote(fallback.id, { skipFlush: true });
                            } else {
                                this.showEmptyEditorState(this.mode === 'trash' ? 'trash' : 'notes');
                            }
                            this.showToast('Active note was deleted on another device', 'info');
                        } else if (activeNoteMovedToTrash && this.mode === 'notes') {
                            this.hasDirtyEdits = false;
                            const fallback = this.noteIndex.find((n) => !n.deleted);
                            if (fallback) {
                                await this.loadNote(fallback.id, { skipFlush: true });
                            } else {
                                this.currentNoteId = null;
                                this.showEmptyEditorState('notes');
                            }
                            this.showToast('Note was moved to Trash on another device', 'info');
                        } else if (activeNoteRestored && this.mode === 'trash') {
                            this.mode = 'notes';
                            await this.loadNote(this.currentNoteId, { skipFlush: true });
                        } else {
                            const activeMeta = this.noteIndex.find((m) => m.id === this.currentNoteId);
                            if (activeMeta && activeMeta.needsCloudFetch && !this.hasDirtyEdits) {
                                await this.loadNote(activeMeta.id, { skipFlush: true });
                            }
                        }
                    }

                    this._lastCloudSyncAt = Date.now();
                    this.setSyncBadge('Cloud Synced', 'cloud', 'text-green');
                } catch (e) {
                    console.warn('Metadata cloud sync failed cleanly:', e);
                    this.setSyncBadge('Offline Ready', 'cloud-off', 'text-orange');
                }
            })();

            this._cloudSyncPromise = run;
            try {
                await run;
            } finally {
                this._cloudSyncPromise = null;
                if (this._cloudSyncQueuedForce) {
                    this._cloudSyncQueuedForce = false;
                    this.syncCloudMetadataInBackground({ force: true });
                }
            }
        },

        async fetchSingleNoteFromCloud(id) {
            if (typeof getCloudUser !== 'function' || typeof db === 'undefined') return { status: 'error' };
            try {
                const user = await getCloudUser();
                if (!user || user.is_sandbox) return { status: 'error' };

                const { data, error } = await db
                    .from('notes')
                    .select('id, title, content, folder_id, deleted, updated_at')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error) return { status: 'error' };
                if (!data) return { status: 'not_found' };
                return {
                    status: 'ok',
                    note: {
                        id: String(data.id),
                        title: data.title || '',
                        content: data.content || '',
                        folderId: data.folder_id ? String(data.folder_id) : null,
                        deleted: Boolean(data.deleted),
                        updatedAt: Number(data.updated_at) || Date.now()
                    }
                };
            } catch (e) {
                console.warn('Single-note cloud fetch failed:', e);
                return { status: 'error' };
            }
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

                    if (oldIds.length && typeof getCloudUser === 'function' && typeof db !== 'undefined') {
                        try {
                            const user = await getCloudUser();
                            if (user && !user.is_sandbox) {
                                for (let i = 0; i < oldIds.length; i += 100) {
                                    const chunk = oldIds.slice(i, i + 100);
                                    const { error } = await db.from('notes').delete().in('id', chunk).eq('user_id', user.id);
                                    if (error) console.warn('Cloud import cleanup chunk failed:', error);
                                }
                            }
                        } catch (cleanupErr) {
                            console.warn('Cloud import cleanup skipped:', cleanupErr);
                        }
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

                    const importedRecords = [];
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
                        this.upsertNoteIndexEntry(cleanNote, { needsCloudFetch: false, localOnly: true, pendingBodySync: false });
                        importedRecords.push(cleanNote);
                    }

                    await this.persistIndex();
                    for (const rec of importedRecords) {
                        await this.syncSingleNoteToCloud(rec, { isCreate: true });
                    }
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

});

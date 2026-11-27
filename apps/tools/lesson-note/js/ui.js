'use strict';

Object.assign(app, {
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
                        this.syncCloudMetadataInBackground();
                    }
                });
            }

            window.addEventListener('focus', () => this.syncCloudMetadataInBackground());
            window.addEventListener('online', () => this.syncCloudMetadataInBackground({ force: true }));
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

                const prevFolderId = dragMeta.folderId || null;
                const nextFolderId = targetMeta.folderId || null;
                const folderChanged = prevFolderId !== nextFolderId;
                dragMeta.folderId = nextFolderId;

                const rect = noteEl.getBoundingClientRect();
                const insertBefore = e.clientY < (rect.top + rect.height / 2);

                const targetIdx = groupNotes.findIndex((n) => n.id === targetNoteId);
                const newOrder = groupNotes.filter((n) => n.id !== noteId);
                const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
                newOrder.splice(Math.min(insertIdx, newOrder.length), 0, dragMeta);

                const now = Date.now();
                for (let i = 0; i < newOrder.length; i++) {
                    newOrder[i].sortOrder = i;
                    if (newOrder[i].id === dragMeta.id && folderChanged) {
                        newOrder[i].updatedAt = now;
                    }
                    const full = await LessonDB.getNote(newOrder[i].id);
                    if (full) {
                        full.folderId = newOrder[i].folderId;
                        full.sortOrder = i;
                        if (newOrder[i].id === dragMeta.id && folderChanged) {
                            full.updatedAt = now;
                        }
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
                if (folderChanged) {
                    if (dragMeta.localOnly) {
                        const localFull = (await LessonDB.getNote(dragMeta.id)) || { ...dragMeta, content: '' };
                        this.syncSingleNoteToCloud(localFull, { isCreate: true });
                    } else {
                        this.syncBatchMetadataToCloud([dragMeta.id], { folder_id: nextFolderId, updated_at: now });
                    }
                }
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
            await this.refreshFoldersFromCloud();
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
            await this.refreshFoldersFromCloud();
            const freshFolder = this.folders.find((f) => f.id === id);
            if (!freshFolder) {
                this.renderNotesList();
                this.refreshFileManagerIfOpen();
                this.showToast('Folder was deleted on another device', 'info');
                return;
            }
            freshFolder.name = newName.trim().slice(0, 80);
            await this.saveFolders();
            this.renderNotesList();
            this.refreshFileManagerIfOpen();
            this.showToast('Folder renamed', 'success');
        },

        async changeFolderColor(id) {
            await this.refreshFoldersFromCloud();
            const folder = this.folders.find((f) => f.id === id);
            if (!folder) {
                this.renderNotesList();
                this.refreshFileManagerIfOpen();
                return;
            }
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

            await this.refreshFoldersFromCloud();
            const freshFolder = this.folders.find((f) => f.id === id);

            const allInFolder = this.noteIndex.filter((n) => n.folderId === id);
            const now = Date.now();
            const updatedIds = [];

            for (const meta of allInFolder) {
                meta.folderId = null;
                meta.updatedAt = now;
                if (!meta.localOnly) updatedIds.push(meta.id);
                await this.updateLocalNoteMetadata(meta.id, { folderId: null, updatedAt: now });
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
            this.showToast(`Deleted folder "${(freshFolder || folder).name}"`, 'info');
        },

        async moveNoteToFolder(noteId, folderId) {
            const meta = this.noteIndex.find((n) => n.id === noteId);
            if (!meta) return;
            const nextFolderId = folderId || null;
            const now = Date.now();
            meta.folderId = nextFolderId;
            meta.updatedAt = now;
            await this.updateLocalNoteMetadata(noteId, { folderId: nextFolderId, updatedAt: now });
            await this.persistIndex();
            if (meta.localOnly) {
                const localFull = (await LessonDB.getNote(noteId)) || { ...meta, content: '' };
                this.syncSingleNoteToCloud(localFull, { isCreate: true });
            } else {
                this.syncBatchMetadataToCloud([noteId], { folder_id: nextFolderId, updated_at: now });
            }
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
});

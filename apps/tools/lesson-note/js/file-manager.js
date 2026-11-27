'use strict';

Object.assign(app, {
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
                this.upsertNoteIndexEntry(newNote, { needsCloudFetch: false, localOnly: true, pendingBodySync: false });
                this.cacheNoteBody(newNote);
                await LessonDB.putNote(newNote);
                this.syncSingleNoteToCloud(newNote, { isCreate: true });
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

            await this.refreshFoldersFromCloud();
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

            await this.refreshFoldersFromCloud();
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

});

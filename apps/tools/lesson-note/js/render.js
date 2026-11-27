'use strict';

Object.assign(app, {
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

});

/**
 * Media Manager Logic for KlassKit
 * Handles both Cloud and Sandbox storage inspection and deletion.
 */

const MediaManager = {
    modal: null,
    grid: null,
    loader: null,
    empty: null,
    breadcrumbs: null,
    usageText: null,
    clearAllBtn: null,
    refreshBtn: null,
    filterInput: null,
    sortSelect: null,

    filterQuery: '',
    sortBy: 'folder-asc',
    cachedGroups: null,
    cachedMode: null,
    
    KNOWN_DB_NAMES: [
        { name: 'PosterStudioDB', label: 'Poster Studio', store: 'imgs' },
        { name: 'PresentationDB', label: 'Speedy Slides', store: 'images' },
        { name: 'KlassKit_Resources', label: 'Poster Display', store: 'posters' },
        { name: 'KlassKitRevealDB', label: 'Reveal Picture', store: 'Presets' },
        { name: 'KlassKitMemoryDB_V3', label: 'Card Match (V3)', store: 'Presets' },
        { name: 'KlassKitMemoryDB_V2', label: 'Card Match (V2)', store: 'Configs' },
        { name: 'KKThisOrThatDB', label: 'This or That', store: 'image_cache' },
        { name: 'SimonGameKlassKitDB_V2', label: 'Memory Block', store: 'image_cache' },
        { name: 'FlashcardDB', label: 'Word Flashcards', store: 'flashcards' },
        { name: 'MysteryBoxDB', label: 'Mystery Box (Legacy)', store: 'images' },
        { name: 'WordSearchDB', label: 'Word Search', store: 'games' },
        { name: 'WordSortDB', label: 'Word Sort', store: 'sets' },
        { name: 'CrosswordDB', label: 'Crossword', store: 'puzzles' },
        { name: 'HangmanDB', label: 'Hangman', store: 'games' },
        { name: 'BingoDB', label: 'Bingo', store: 'sets' },
        { name: 'CardMakerDB', label: 'Card Maker', store: 'game_state' },
    ],

    KNOWN_LS_KEYS: [
        { key: 'e1_rapid_slides_v4', label: 'Speedy Slides (Legacy)' },
        { key: 'flashcard_klasskit_state_v5', label: 'Card Maker (Legacy)' },
        { key: 'prog_presentation_data', label: 'Slides Data' },
        { key: 'prog_card_maker_state', label: 'Card Maker Data' }
    ],
    
    init() {
        this.modal = document.getElementById('media-manager-modal');
        if (!this.modal) return;

        this.grid = document.getElementById('media-manager-grid');
        this.loader = document.getElementById('media-manager-loader');
        this.empty = document.getElementById('media-manager-empty');
        this.breadcrumbs = document.getElementById('media-breadcrumbs');
        this.usageText = document.getElementById('media-manager-usage');
        this.clearAllBtn = document.getElementById('media-manager-clear-all');
        this.refreshBtn = document.getElementById('media-manager-refresh-btn');
        this.filterInput = document.getElementById('media-manager-filter');
        this.sortSelect = document.getElementById('media-manager-sort');

        // Event Listeners
        document.querySelectorAll('[data-action="openMediaManager"]').forEach(btn => {
            btn.addEventListener('click', () => this.open());
        });

        document.querySelectorAll('[data-action="closeMediaManager"]').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        this.refreshBtn.addEventListener('click', async () => {
            if (isSandbox()) {
                this.loadData();
                return;
            }

            const btn = this.refreshBtn;
            const icon = btn.querySelector('i');
            if (icon) icon.classList.add('animate-spin');
            btn.disabled = true;

            try {
                const user = await getUser();
                if (user) {
                    await recalculateUserStorage(user.id);
                    // Update main Hub UI if it exists
                    if (typeof StorageManager !== 'undefined') await StorageManager.update();
                }
                await this.loadData();
            } finally {
                if (icon) icon.classList.remove('animate-spin');
                btn.disabled = false;
            }
        });

        if (this.filterInput) {
            this.filterInput.addEventListener('input', () => {
                this.filterQuery = this.filterInput.value;
                this.rerenderFromCache();
            });
        }

        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => {
                this.sortBy = this.sortSelect.value;
                this.rerenderFromCache();
            });
        }
    },

    open() {
        this.modal.classList.remove('hidden');
        this.filterQuery = '';
        this.sortBy = 'folder-asc';
        if (this.filterInput) this.filterInput.value = '';
        if (this.sortSelect) this.sortSelect.value = 'folder-asc';
        this.cachedGroups = null;
        this.cachedMode = null;
        this.loadData();
    },

    close() {
        this.modal.classList.add('hidden');
    },

    async loadData() {
        this.showLoader();
        this.grid.innerHTML = '';
        this.empty.classList.add('hidden');
        this.empty.classList.remove('flex');
        
        try {
            const usage = await getUserStorageUsage();
            this.updateUsageText(usage);

            if (isSandbox()) {
                await this.loadSandboxData();
            } else {
                await this.loadCloudData();
            }
        } catch (error) {
            console.error("Media Manager Load Error:", error);
        } finally {
            this.hideLoader();
        }
    },

    updateUsageText(usage) {
        const mbUsed = (usage.used / (1024 * 1024)).toFixed(2);
        if (usage.isSandbox) {
            this.usageText.innerText = `Used: ${mbUsed} MB (Local)`;
        } else {
            this.usageText.innerText = `${usage.percent}% Storage Capacity Used`;
        }
    },

    async updateUsageIncrementally() {
        try {
            const usage = await getUserStorageUsage();
            this.updateUsageText(usage);
            if (typeof StorageManager !== 'undefined') StorageManager.update();
        } catch (e) {
            console.warn("Incremental usage update failed", e);
        }
    },

    async downloadMedia(url, filename) {
        try {
            // For remote URLs, fetch to blob to force immediate download
            if (url.startsWith('http')) {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename || 'download';
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 100);
                return;
            }

            // For data URLs or Blobs
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed, falling back to direct link", error);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'download';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    },

    showToast(message, type = 'success') {
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast(message, type);
            return;
        }

        // --- STANDALONE TOAST FALLBACK (for tools without Hub UI) ---
        let container = this.getToastContainer();

        const toast = document.createElement('div');
        const bg = {
            success: 'bg-green',
            warning: 'bg-orange',
            info: 'bg-blue',
            error: 'bg-red-500'
        }[type] || 'bg-green';

        toast.className = `${bg} text-white px-6 py-3 rounded-2xl border-[3px] border-dark shadow-[4px_4px_0px_0px_#0f172a] font-bold text-sm pointer-events-auto transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2`;
        
        const icons = { success: 'check', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
        toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        if (window.lucide) lucide.createIcons({ nodes: [toast] });
        
        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    getToastContainer() {
        let container = document.getElementById('media-manager-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'media-manager-toast-container';
            container.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none items-center';
            document.body.appendChild(container);
        }
        return container;
    },

    // ---------------------------------------------------------
    // CLOUD MODE
    // ---------------------------------------------------------
    async loadCloudData() {
        const user = await getUser();
        if (!user) return;

        this.grid.className = 'h-full overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar';
        this.breadcrumbs.innerHTML = '<span class="text-dark dark:text-white font-bold">All Cloud Media (Grouped by Tool/Set)</span>';

        const allFiles = await this.fetchAllCloudFiles(user.id);

        if (allFiles.length === 0) {
            this.cachedGroups = null;
            this.cachedMode = 'cloud';
            this.renderGroupedView([], 'cloud', user.id);
            return;
        }

        const filePaths = allFiles.map(f => f.fullPath);
        const { data: signedData } = await db.storage.from('klasskit-media').createSignedUrls(filePaths, 3600);
        const urlMap = {};
        if (signedData) {
            signedData.forEach(item => {
                urlMap[item.path] = item.signedUrl;
            });
        }

        this.cachedGroups = this.buildCloudGroups(allFiles, urlMap);
        this.cachedMode = 'cloud';
        this.renderGroupedView(this.cachedGroups, 'cloud', user.id);
    },

    buildCloudGroups(allFiles, urlMap) {
        const groups = {};
        for (const file of allFiles) {
            const parts = file.fullPath.split('/');
            parts.shift();
            parts.pop();
            const folderPath = parts.join('/');
            const groupKey = folderPath || 'root';

            if (!groups[groupKey]) {
                const label = groupKey === 'root'
                    ? 'Unsorted / Root'
                    : groupKey.split('/').map(p => p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(' > ');
                groups[groupKey] = { key: groupKey, label, items: [] };
            }
            groups[groupKey].items.push({ file, signedUrl: urlMap[file.fullPath] });
        }
        return Object.values(groups);
    },

    async fetchAllCloudFiles(path, files = []) {
        const { data, error } = await db.storage.from('klasskit-media').list(path, { limit: 1000 });
        if (error || !data) return files;
        
        const subTasks = [];
        for (const item of data) {
            if (item.name === '.emptyFolderPlaceholder') continue;
            
            if (!item.metadata) {
                // Folder - fetch in parallel
                subTasks.push(this.fetchAllCloudFiles(`${path}/${item.name}`, files));
            } else {
                // File
                files.push({ ...item, fullPath: `${path}/${item.name}` });
            }
        }
        
        if (subTasks.length > 0) await Promise.all(subTasks);
        return files;
    },

    createCloudCard(file, signedUrl) {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-800 rounded-2xl border-[3px] border-dark dark:border-slate-600 p-3 flex flex-col gap-2 relative group shadow-hard hover:-translate-y-1 hover:shadow-hard-lg transition-all duration-200 cursor-pointer";

        card.innerHTML = `
            <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dark/20 dark:border-slate-700/50 aspect-square overflow-hidden relative">
                <div class="absolute inset-0 flex items-center justify-center"><i data-lucide="image" class="w-8 h-8 text-slate-300"></i></div>
                <img class="w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300" />
            </div>
            <div class="text-center font-bold text-xs text-slate-500 dark:text-slate-400 truncate w-full px-2" title="${file.name}">${file.name}</div>

            <div class="absolute -top-3 -right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                <button class="download-btn w-10 h-10 bg-blue text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-blue-600 transition-all flex items-center justify-center hover:scale-110 btn-chunky" title="Download Image">
                    <i data-lucide="download" class="w-4 h-4"></i>
                </button>
                <button class="delete-btn w-10 h-10 bg-red-500 text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-red-600 transition-all flex items-center justify-center hover:scale-110 btn-chunky" title="Delete Image">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        const img = card.querySelector('img');
        if (signedUrl) {
            img.src = signedUrl;
            img.onload = () => img.classList.remove('opacity-0');
        } else {
            this.loadCloudPreview(img, file.fullPath);
        }

        card.querySelector('.download-btn').onclick = (e) => {
            e.stopPropagation();
            this.downloadMedia(img.src, file.name);
        };

        card.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            this.deleteCloudFile(file, card);
        };

        card.onclick = () => {
            this.downloadMedia(img.src, file.name);
        };

        return card;
    },

    async deleteCloudFile(file, cardEl) {
        if (!confirm(`Delete "${file.name}" from cloud storage? This cannot be undone.`)) return;

        const section = cardEl.closest('.media-section');
        cardEl.classList.add('opacity-50', 'pointer-events-none');

        try {
            await deleteMedia(file.fullPath);
            cardEl.remove();
            this.removeItemFromCache(file.fullPath);
            if (section && section.querySelectorAll('.media-grid > div').length === 0) {
                section.remove();
            }
            this.checkEmptyState();
            await this.updateUsageIncrementally();
            this.showToast('File deleted from cloud', 'success');
        } catch (error) {
            console.error('Cloud delete failed:', error);
            cardEl.classList.remove('opacity-50', 'pointer-events-none');
            const msg = error.message?.includes('database trigger')
                ? 'Delete blocked by a server config issue. Ask the admin to run fix_sync_storage_triggers.sql in Supabase.'
                : 'Failed to delete file';
            this.showToast(msg, 'error');
        }
    },
    
    async loadCloudPreview(imgEl, fullPath) {
        const { data } = await db.storage.from('klasskit-media').createSignedUrl(fullPath, 60);
        if (data && data.signedUrl) {
            imgEl.src = data.signedUrl;
            imgEl.onload = () => imgEl.classList.remove('opacity-0');
        }
    },
    
    // ---------------------------------------------------------
    // SANDBOX MODE (IndexedDB)
    // ---------------------------------------------------------
    async loadSandboxData() {
        this.grid.className = 'h-full overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar';
        this.breadcrumbs.innerHTML = '<span class="text-dark dark:text-white font-bold">All Local Media (Grouped by Tool)</span>';

        const groups = [];

        const idbPromises = this.KNOWN_DB_NAMES.map(async (dbInfo) => {
            try {
                const items = await this.getAllFromIDB(dbInfo.name, dbInfo.store);
                if (!items || items.length === 0) return null;

                const validItems = [];
                for (const item of items) {
                    if (this.isImageValue(item.value)) {
                        validItems.push(item);
                    } else if (typeof item.value === 'object' && item.value !== null) {
                        this.extractImagesFromObject(item.value, item.key, validItems);
                    }
                }

                if (validItems.length === 0) return null;

                return {
                    key: dbInfo.name,
                    label: dbInfo.label,
                    items: validItems.map(item => ({ sandboxItem: item, dbInfo }))
                };
            } catch (e) {
                console.error("IDB Error parsing", dbInfo.name, e);
                return null;
            }
        });

        const idbResults = await Promise.all(idbPromises);
        for (const res of idbResults) {
            if (res) groups.push(res);
        }

        for (const lsInfo of this.KNOWN_LS_KEYS) {
            try {
                const raw = localStorage.getItem(lsInfo.key);
                if (!raw) continue;
                const data = JSON.parse(raw);
                const validItems = [];
                this.extractImagesFromObject(data, lsInfo.key, validItems);

                if (validItems.length === 0) continue;

                const dbInfo = { name: 'LocalStorage', label: lsInfo.label, store: lsInfo.key };
                groups.push({
                    key: lsInfo.key,
                    label: lsInfo.label,
                    items: validItems.map(item => ({ sandboxItem: item, dbInfo }))
                });
            } catch (e) {
                console.warn(`Failed to scrape LS key ${lsInfo.key}:`, e);
            }
        }

        this.cachedGroups = groups;
        this.cachedMode = 'sandbox';
        this.renderGroupedView(groups, 'sandbox');
    },

    isImageValue(val) {
        if (val instanceof Blob) return true;
        if (typeof val === 'string' && val.startsWith('data:image')) return true;
        if (val && typeof val === 'object' && val.dataUrl) return true;
        return false;
    },

    extractImagesFromObject(obj, key, results) {
        const seen = new Set();
        const walk = (o) => {
            if (!o || typeof o !== 'object' || seen.has(o)) return;
            seen.add(o);
            
            for (const k in o) {
                const val = o[k];
                if (this.isImageValue(val)) {
                    // Create a pseudo-item for the manager UI
                    results.push({
                        key: key, // Keep parent key for context
                        value: val,
                        isNested: true
                    });
                } else if (typeof val === 'object') {
                    walk(val);
                }
            }
        };
        walk(obj);
    },

    createSandboxCard(dbInfo, item) {
        let srcUrl = '';
        if (item.value instanceof Blob) srcUrl = URL.createObjectURL(item.value);
        else if (typeof item.value === 'string') srcUrl = item.value;
        else if (item.value && item.value.dataUrl) srcUrl = item.value.dataUrl;

        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-800 rounded-2xl border-[3px] border-dark dark:border-slate-600 p-3 flex flex-col gap-2 relative group shadow-hard hover:-translate-y-1 hover:shadow-hard-lg transition-all duration-200 cursor-pointer";

        card.innerHTML = `
            <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dark/20 dark:border-slate-700/50 aspect-square overflow-hidden relative">
                <img src="${srcUrl}" class="w-full h-full object-cover relative z-10" />
            </div>
            <div class="text-center font-bold text-[10px] text-slate-500 dark:text-slate-400 truncate w-full px-2" title="${item.key}">${item.key}</div>

            <div class="absolute -top-3 -right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                <button class="download-btn w-10 h-10 bg-blue text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-blue-600 transition-all flex items-center justify-center hover:scale-110 btn-chunky" title="Download Image">
                    <i data-lucide="download" class="w-4 h-4"></i>
                </button>
                ${dbInfo.name !== 'LocalStorage' ? `
                <button class="delete-btn w-10 h-10 bg-red-500 text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-red-600 transition-all flex items-center justify-center hover:scale-110 btn-chunky" title="Delete Image">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>` : ''}
            </div>
        `;

        card.querySelector('.download-btn').onclick = (e) => {
            e.stopPropagation();
            this.downloadMedia(srcUrl, `${item.key}.png`);
        };

        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteSandboxFile(dbInfo, item, card);
            };
        }

        card.onclick = () => {
            this.downloadMedia(srcUrl, `${item.key}.png`);
        };

        return card;
    },

    async deleteSandboxFile(dbInfo, item, cardEl) {
        if (!confirm(`Delete "${item.key}" from local storage?`)) return;

        const section = cardEl.closest('.media-section');
        cardEl.classList.add('opacity-50', 'pointer-events-none');

        try {
            await this.deleteFromIDB(dbInfo.name, dbInfo.store, item.key);
            cardEl.remove();
            this.removeItemFromCache(item.key, dbInfo.name);
            if (section && section.querySelectorAll('.media-grid > div').length === 0) {
                section.remove();
            }
            this.checkEmptyState();
            await this.updateUsageIncrementally();
            this.showToast('File deleted locally', 'success');
        } catch (error) {
            console.error('Sandbox delete failed:', error);
            cardEl.classList.remove('opacity-50', 'pointer-events-none');
            this.showToast('Failed to delete file', 'error');
        }
    },

    // --- IDB Helpers ---
    openIDB(dbName) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    
    async getAllFromIDB(dbName, storeName) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            return [];
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            const keysReq = store.getAllKeys();
            
            tx.oncomplete = () => {
                const results = req.result.map((val, i) => ({
                    key: keysReq.result[i],
                    value: val
                }));
                db.close();
                resolve(results);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    },
    
    async deleteFromIDB(dbName, storeName, key) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) return;
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => { db.close(); resolve(); };
        });
    },
    
    async clearIDBStore(dbName, storeName) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) return;
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => { db.close(); resolve(); };
        });
    },

    // ---------------------------------------------------------
    // FILTER, SORT & RENDER
    // ---------------------------------------------------------
    rerenderFromCache() {
        if (!this.cachedGroups) return;
        this.renderGroupedView(this.cachedGroups, this.cachedMode);
    },

    applyFilterAndSort(groups) {
        const query = this.filterQuery.trim().toLowerCase();
        let result = groups.map(g => ({ ...g, items: [...g.items] }));

        if (query) {
            result = result.map(g => {
                const labelMatch = g.label.toLowerCase().includes(query) || g.key.toLowerCase().includes(query);
                const matchedItems = g.items.filter(entry => {
                    const name = entry.file?.name || entry.sandboxItem?.key || '';
                    return name.toLowerCase().includes(query);
                });
                if (labelMatch) return g;
                if (matchedItems.length > 0) return { ...g, items: matchedItems };
                return null;
            }).filter(Boolean);
        }

        const getFileName = (entry) => entry.file?.name || entry.sandboxItem?.key || '';
        const getFileDate = (entry) => {
            const raw = entry.file?.created_at || entry.file?.updated_at;
            return raw ? new Date(raw).getTime() : 0;
        };

        const sortItems = (items) => {
            const sorted = [...items];
            switch (this.sortBy) {
                case 'file-asc':
                    sorted.sort((a, b) => getFileName(a).localeCompare(getFileName(b)));
                    break;
                case 'file-desc':
                    sorted.sort((a, b) => getFileName(b).localeCompare(getFileName(a)));
                    break;
                case 'date-desc':
                    sorted.sort((a, b) => getFileDate(b) - getFileDate(a));
                    break;
                case 'date-asc':
                    sorted.sort((a, b) => getFileDate(a) - getFileDate(b));
                    break;
                default:
                    sorted.sort((a, b) => getFileName(a).localeCompare(getFileName(b)));
            }
            return sorted;
        };

        result.forEach(g => { g.items = sortItems(g.items); });

        switch (this.sortBy) {
            case 'folder-desc':
                result.sort((a, b) => b.label.localeCompare(a.label));
                break;
            case 'file-asc':
            case 'file-desc':
            case 'date-asc':
            case 'date-desc':
                result.sort((a, b) => {
                    const aName = getFileName(a.items[0] || {});
                    const bName = getFileName(b.items[0] || {});
                    if (this.sortBy.startsWith('date')) {
                        return this.sortBy === 'date-desc'
                            ? getFileDate(b.items[0] || {}) - getFileDate(a.items[0] || {})
                            : getFileDate(a.items[0] || {}) - getFileDate(b.items[0] || {});
                    }
                    return this.sortBy === 'file-desc'
                        ? bName.localeCompare(aName)
                        : aName.localeCompare(bName);
                });
                break;
            default:
                result.sort((a, b) => a.label.localeCompare(b.label));
        }

        return result;
    },

    renderGroupedView(groups, mode) {
        this.grid.innerHTML = '';
        this.empty.classList.add('hidden');
        this.empty.classList.remove('flex');

        const filtered = this.applyFilterAndSort(groups);

        if (filtered.length === 0) {
            this.empty.classList.remove('hidden');
            this.empty.classList.add('flex');
            const emptyTitle = this.empty.querySelector('h4');
            const emptyText = this.empty.querySelector('p');
            if (emptyTitle && emptyText) {
                if (this.filterQuery.trim()) {
                    emptyTitle.innerText = 'No Matches Found';
                    emptyText.innerText = 'Try a different search term or clear the filter.';
                } else {
                    emptyTitle.innerText = 'No Media Found';
                    emptyText.innerText = 'Your storage is completely clean.';
                }
            }
            return;
        }

        for (const group of filtered) {
            const section = this.createSection(group.label);
            const grid = section.querySelector('.media-grid');

            for (const entry of group.items) {
                if (mode === 'cloud') {
                    grid.appendChild(this.createCloudCard(entry.file, entry.signedUrl));
                } else {
                    grid.appendChild(this.createSandboxCard(entry.dbInfo, entry.sandboxItem));
                }
            }
            this.grid.appendChild(section);
        }

        lucide.createIcons();
    },

    removeItemFromCache(identifier, groupKey) {
        if (!this.cachedGroups) return;

        this.cachedGroups = this.cachedGroups
            .map(group => {
                if (groupKey && group.key !== groupKey) return group;
                return {
                    ...group,
                    items: group.items.filter(entry => {
                        if (entry.file) return entry.file.fullPath !== identifier;
                        return entry.sandboxItem?.key !== identifier;
                    })
                };
            })
            .filter(group => group.items.length > 0);
    },

    checkEmptyState() {
        if (this.grid.children.length === 0) {
            this.empty.classList.remove('hidden');
            this.empty.classList.add('flex');
        }
    },

    // ---------------------------------------------------------
    // COMMON UI HELPERS
    // ---------------------------------------------------------
    createSection(title) {
        const section = document.createElement('div');
        section.className = "media-section flex flex-col gap-4";
        
        const header = document.createElement('div');
        header.className = "flex items-center justify-between border-b-[4px] border-dark dark:border-slate-600 pb-4 mb-2";
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue text-white rounded-xl border-3 border-dark dark:border-slate-500 flex items-center justify-center shadow-hard-sm">
                    <i data-lucide="folder" class="w-5 h-5"></i>
                </div>
                <h3 class="font-heading font-black text-2xl text-dark dark:text-white tracking-tight uppercase">${title}</h3>
            </div>
        `;

        const grid = document.createElement('div');
        grid.className = "media-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4";

        section.appendChild(header);
        section.appendChild(grid);
        return section;
    },

    showLoader() {
        this.loader.classList.remove('hidden');
        this.loader.classList.add('flex');
    },

    hideLoader() {
        this.loader.classList.add('hidden');
        this.loader.classList.remove('flex');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MediaManager.init();
});

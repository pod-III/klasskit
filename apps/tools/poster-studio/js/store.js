// --- 2. DATA STORE (IDB + LOCAL + CLOUD) ---
const LS_UI_MODE = 'posterstudio_ui_mode';
const LS_POSTERS_KEY = 'poster-studio-v2';

const Store = {
    state: { posters: [], currentId: 'default', theme: 'light' },
    current: null,
    imgCache: new Map(),
    db: null,
    debounce: null,
    _textEditTimer: null,
    _textEditSnapTaken: false,

    markTextEditHistory() {
        if (!Store.current) return;
        if (!Store._textEditSnapTaken) {
            if (!App.pushHistory()) return;
            Store._textEditSnapTaken = true;
        }
        clearTimeout(Store._textEditTimer);
        Store._textEditTimer = setTimeout(() => {
            Store._textEditSnapTaken = false;
        }, 1200);
    },

    async init() {
        Store.db = await new Promise((res) => {
            try {
                if (typeof indexedDB === 'undefined') { res(null); return; }
                const req = indexedDB.open('PosterStudioDB', 2);
                req.onupgradeneeded = (e) => {
                    if (!e.target.result.objectStoreNames.contains('imgs')) {
                        e.target.result.createObjectStore('imgs');
                    }
                };
                req.onsuccess = (e) => res(e.target.result);
                req.onerror = () => res(null);
            } catch (_) {
                res(null);
            }
        });

        try {
            const local = localStorage.getItem(LS_POSTERS_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && Array.isArray(parsed.posters)) {
                    Store.state = parsed;
                }
            }
        } catch (e) {
            console.warn('Corrupt local poster storage, starting fresh', e);
        }

        await Store.loadFromCloud();

        if (!Store.state.posters.length) {
            const starter = App.buildPosterFromTemplate('blank');
            Store.state.posters.push(starter);
            Store.state.currentId = starter.id;
        }

        Store.loadCurrent();
    },

    loadCurrent() {
        Store.current = Store.state.posters.find(p => p.id === Store.state.currentId) || Store.state.posters[0];
        if (Store.current) {
            Store.state.currentId = Store.current.id;
            if (!Array.isArray(Store.current.modules)) Store.current.modules = [];
            if (!Store.current.global || typeof Store.current.global !== 'object') {
                Store.current.global = { title: 'UNTITLED', subtitle: '', badge: '1', layout: 'landscape', pattern: 'graph', gridSize: 'md' };
            }
        }
    },

    save(visual = false) {
        if (!Store.current) return;
        Store.current.lastModified = Date.now();
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        if (idx >= 0) Store.state.posters[idx] = Store.current;
        else Store.state.posters.push(Store.current);

        try {
            localStorage.setItem(LS_POSTERS_KEY, JSON.stringify(Store.state));
        } catch (e) {
            console.error('Failed to persist poster state locally', e);
        }

        Store.syncToCloud();

        if (visual) {
            const btn = document.getElementById('save-btn');
            if (btn) {
                btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span class="hidden sm:inline">Saved!</span>`;
                btn.classList.add('bg-green');
                btn.classList.remove('bg-blue');
                hydrateIcons();
                setTimeout(() => {
                    btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> <span class="hidden sm:inline">Save</span>`;
                    btn.classList.remove('bg-green');
                    btn.classList.add('bg-blue');
                    hydrateIcons();
                }, 1000);
            }
            showToast('Poster saved!', 'success');
        }
    },

    async syncToCloud() {
        if (typeof saveProgress !== 'function') return;
        try {
            await saveProgress('poster_studio_data', Store.state);
        } catch (e) {
            console.warn('Cloud sync deferred/offline:', e);
        }
    },

    async loadFromCloud() {
        if (typeof loadProgress !== 'function') return;
        try {
            const data = await loadProgress('poster_studio_data');
            if (data && Array.isArray(data.posters)) {
                const map = new Map();
                for (const p of (Store.state.posters || [])) {
                    if (p && p.id) map.set(p.id, p);
                }
                for (const p of data.posters) {
                    if (!p || !p.id) continue;
                    const existing = map.get(p.id);
                    if (!existing || (p.lastModified || 0) >= (existing.lastModified || 0)) {
                        map.set(p.id, p);
                    }
                }
                Store.state.posters = Array.from(map.values());
                if (!Store.state.currentId || !map.has(Store.state.currentId)) {
                    Store.state.currentId = data.currentId || (Store.state.posters[0] && Store.state.posters[0].id) || 'default';
                }
                try {
                    localStorage.setItem(LS_POSTERS_KEY, JSON.stringify(Store.state));
                } catch (_) {}
            }
        } catch (e) {
            console.warn('Cloud load failed, using local storage:', e);
        }
    },

    triggerSave() {
        clearTimeout(Store.debounce);
        Store.debounce = setTimeout(() => Store.save(false), 450);
    },

    updateGlobal(key, val) {
        if (!Store.current) return;
        Store.current.global[key] = val;
        if (key === 'title' || key === 'subtitle' || key === 'badge') {
            Renderer.patchHeaderText();
            if (key === 'title') {
                const sel = document.getElementById('project-select');
                const opt = sel && sel.options
                    ? Array.from(sel.options).find(o => o.value === Store.current.id)
                    : null;
                if (opt) opt.textContent = val || 'UNTITLED';
            }
            return;
        }
        Renderer.renderPoster();
    },

    updateMod(id, key, val) {
        const m = Store.current?.modules?.find(x => x.id === id);
        if (!m) return;
        Store.markTextEditHistory();
        if (key.includes('.')) {
            const [p, c] = key.split('.');
            if (!m[p]) m[p] = {};
            m[p][c] = val;
        } else {
            m[key] = val;
        }
        if (key === 'title' && App.editingId === id) {
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `Edit ${val || 'Block'}`;
        }
        Renderer.renderPoster();
        Store.triggerSave();
    },

    async uploadImage(input) {
        let file = input.files?.[0];
        if (!file) return;
        if (file.type && !file.type.startsWith('image/')) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal('Please upload a valid image file.', { title: 'Invalid File', icon: 'x-octagon', iconColor: 'red' });
            } else {
                showToast('Please select a valid image file.', 'error');
            }
            return;
        }

        if (typeof imageCompression === 'function') {
            try {
                const compressed = await imageCompression(file, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true
                });
                if (compressed) file = compressed;
            } catch (_) {}
        }

        let imgId;
        try {
            if (typeof getCloudUser === 'function' && typeof uploadMedia === 'function') {
                const user = await getCloudUser();
                if (user && Store.current) {
                    imgId = await uploadMedia(file, 'poster_studio', Store.current.id);
                }
            }
        } catch (err) {
            console.warn('Cloud image upload fallback to local IDB:', err);
        }

        if (!imgId) {
            imgId = makeId();
            const blob = new Blob([file], { type: file.type || 'image/png' });
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                Store.imgCache.set(imgId, URL.createObjectURL(blob));
            }
            if (Store.db) {
                try {
                    const tx = Store.db.transaction('imgs', 'readwrite');
                    tx.objectStore('imgs').put(blob, imgId);
                } catch (_) {}
            }
        }

        if (App.currentImageModId) {
            App.pushHistory();
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        } else {
            App.refreshImageLibrary();
        }
        showToast('Image added to library!', 'success');
    },

    async deleteImage(id) {
        if (id && id.includes('klasskit-media') && typeof deleteMediaFromUrl === 'function') {
            deleteMediaFromUrl(id).catch(e => console.warn('Cloud delete failed', e));
        }
        const cached = Store.imgCache.get(id);
        if (cached && cached.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(cached);
        }
        Store.imgCache.delete(id);
        if (!Store.db) return;
        return new Promise((res) => {
            try {
                const tx = Store.db.transaction('imgs', 'readwrite');
                tx.objectStore('imgs').delete(id);
                tx.oncomplete = () => res();
                tx.onerror = () => res();
            } catch (_) {
                res();
            }
        });
    },

    async getAllImages() {
        const images = [];
        const localKeys = await new Promise((res) => {
            if (!Store.db) { res([]); return; }
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').getAllKeys();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => res([]);
            } catch (_) {
                res([]);
            }
        });
        for (const k of localKeys) {
            const url = await Store.getImage(k);
            images.push({ id: k, url });
        }

        if (Store.current && typeof getCloudUser === 'function' && typeof db !== 'undefined' && typeof STORAGE_CONFIG !== 'undefined') {
            try {
                const user = await getCloudUser();
                if (user) {
                    const dir = `${user.id}/poster_studio/${Store.current.id}`;
                    const { data: files } = await db.storage.from(STORAGE_CONFIG.bucket).list(dir);
                    if (Array.isArray(files)) {
                        for (const f of files) {
                            if (!f || f.name === '.emptyFolderPlaceholder') continue;
                            const path = `${dir}/${f.name}`;
                            const cloudUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_CONFIG.bucket}/${path}`;
                            if (!images.find(x => x.id === cloudUrl)) {
                                images.push({ id: cloudUrl, url: Store.imgCache.get(cloudUrl) || '' });
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Cloud image list unavailable:', e);
            }
        }
        return images;
    },

    async getImage(id) {
        if (!id) return null;
        if (Store.imgCache.has(id)) return Store.imgCache.get(id);

        if (String(id).includes('klasskit-media') && typeof resolveMediaUrl === 'function') {
            try {
                const signed = await resolveMediaUrl(id);
                if (signed) Store.imgCache.set(id, signed);
                return signed;
            } catch (_) {
                return null;
            }
        }

        return new Promise((res) => {
            if (!Store.db) { res(null); return; }
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').get(id);
                req.onsuccess = () => {
                    if (req.result && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                        const url = URL.createObjectURL(req.result);
                        Store.imgCache.set(id, url);
                        res(url);
                    } else {
                        res(null);
                    }
                };
                req.onerror = () => res(null);
            } catch (_) {
                res(null);
            }
        });
    },

    moveMod(id, dir) {
        if (!Store.current) return;
        const idx = Store.current.modules.findIndex(m => m.id === id);
        const target = idx + dir;
        if (idx !== -1 && target >= 0 && target < Store.current.modules.length) {
            App.pushHistory();
            const temp = Store.current.modules[idx];
            Store.current.modules[idx] = Store.current.modules[target];
            Store.current.modules[target] = temp;
            Store.save();
            Renderer.renderPoster();
            Editor.updateMoveButtons();
        }
    },

    reorderModules(fromIdx, toIdx) {
        if (!Store.current || !Number.isInteger(fromIdx) || !Number.isInteger(toIdx)) return;
        if (fromIdx < 0 || fromIdx >= Store.current.modules.length || toIdx < 0 || toIdx >= Store.current.modules.length) return;
        App.pushHistory();
        const item = Store.current.modules.splice(fromIdx, 1)[0];
        Store.current.modules.splice(toIdx, 0, item);
        Store.save();
        Renderer.renderPoster();
    }
};


        // --- IndexedDB for Sandbox ---
        const DB_NAME = 'PresentationDB';
        const DB_VER = 2;
        const IMG_STORE = 'images';

        async function initDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VER);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
        }

        async function getImg(url) {
            try {
                const db = await initDB();
                return new Promise((res) => {
                    const r = db.transaction(IMG_STORE, 'readonly').objectStore(IMG_STORE).get(url);
                    r.onsuccess = () => res(r.result);
                    r.onerror = () => res(null);
                });
            } catch(e) { return null; }
        }

        async function putImg(url, blob) {
            try {
                const db = await initDB();
                db.transaction(IMG_STORE, 'readwrite').objectStore(IMG_STORE).put(blob, url);
            } catch(e) { }
        }

        async function resolveLocalMedia(url) {
            if (!url || !url.startsWith('klasskit-local:')) return url;
            const blob = await getImg(url);
            return blob ? URL.createObjectURL(blob) : "";
        }

        lucide.createIcons();

        const app = {
            slides: [],
            library: [],
            currentDeckId: null, // If null, it's unsaved/scratchpad
            viewMode: 'list',
            dragSrcIndex: null,
            colors: ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'],

            async init() {
                const user = await requireAuth();
                if (!user) return;

                // Initialize Theme
                const th = localStorage.getItem('theme_presentation-maker');
                if (th === 'dark' || (!th && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                // Load cloud data and merge
                try {
                    const cloudData = await loadProgress('presentation_data');
                    if (cloudData) {
                        this.library = cloudData.library || [];
                        this.slides = cloudData.slides || [];
                        this.currentDeckId = cloudData.currentDeckId || null;
                        if (this.currentDeckId) {
                            const deck = this.library.find(d => d.id === this.currentDeckId);
                            this.updateDeckNameDisplay(deck ? deck.title : 'Unsaved');
                        }
                    } else {
                        // Fallback to local
                        const libSaved = localStorage.getItem('e1_rapid_library_v1');
                        if (libSaved) { try { this.library = JSON.parse(libSaved); } catch (e) { this.library = []; } }

                        const saved = localStorage.getItem('e1_rapid_slides_v4');
                        const metaSaved = localStorage.getItem('e1_rapid_meta_v1');

                        if (saved) {
                            try {
                                this.slides = JSON.parse(saved);
                                this.slides = this.slides.map(s => ({ ...s, layout: s.layout || 'split' }));
                            } catch (e) { this.slides = []; }
                        }

                        if (metaSaved) {
                            try {
                                const meta = JSON.parse(metaSaved);
                                this.currentDeckId = meta.id;
                                this.updateDeckNameDisplay(meta.title);
                            } catch (e) { }
                        }
                    }
                } catch (e) {
                    console.warn("Cloud load failed, using local fallback", e);
                }

                if (this.slides.length === 0) this.addSlide();
                else this.render();

                this.bindGlobalKeys();
                this.bindPresentationKeys();

                document.getElementById('presentation-mode').addEventListener('click', (e) => {
                    if (!e.target.closest('button')) this.nextSlide();
                });
            },

            cloudSaveTimeout: null,
            async syncToCloud() {
                clearTimeout(this.cloudSaveTimeout);
                this.cloudSaveTimeout = setTimeout(async () => {
                    // Strip local DataURLs from cloud sync, but keep Supabase URLs
                    const cleanSlides = this.slides.map(s => ({
                        ...s,
                        image: (s.image && s.image.startsWith('http')) ? s.image : ""
                    }));
                    const cleanLibrary = this.library.map(d => ({
                        ...d,
                        slides: d.slides.map(s => ({
                            ...s,
                            image: (s.image && s.image.startsWith('http')) ? s.image : ""
                        }))
                    }));

                    await saveProgress('presentation_data', {
                        library: cleanLibrary,
                        slides: cleanSlides,
                        currentDeckId: this.currentDeckId
                    });
                }, 1000);
            },

            toggleTheme() {
                if (document.documentElement.classList.contains('dark')) {
                    document.documentElement.classList.remove('dark');
                } else {
                    document.documentElement.classList.add('dark');
                }
            },

            // --- LIBRARY LOGIC ---

            toggleLibrary() {
                const drawer = document.getElementById('library-drawer');
                const isOpen = !drawer.classList.contains('-translate-x-full');
                if (isOpen) {
                    drawer.classList.add('-translate-x-full');
                } else {
                    this.renderLibrary();
                    drawer.classList.remove('-translate-x-full');
                }
            },

            renderLibrary() {
                const list = document.getElementById('library-list');
                list.innerHTML = '';

                if (this.library.length === 0) {
                    list.innerHTML = `<div class="text-center py-8 text-gray-400 font-bold text-sm">Library is empty.</div>`;
                    return;
                }

                this.library.sort((a, b) => b.updatedAt - a.updatedAt).forEach(deck => {
                    const el = document.createElement('div');
                    el.className = `library-item p-3 bg-white dark:bg-slate-800 border-[2px] border-gray-200 dark:border-white/10 rounded-xl cursor-pointer transition-all mb-2 flex justify-between items-center group ${deck.id === this.currentDeckId ? 'border-brand-blue ring-1 ring-brand-blue' : ''}`;

                    const date = new Date(deck.updatedAt).toLocaleDateString();

                    el.onclick = () => this.loadDeck(deck.id);

                    el.innerHTML = `
                        <div>
                            <h4 class="font-heading font-bold text-brand-dark dark:text-white group-hover:text-brand-blue">${deck.title}</h4>
                            <p class="text-xs text-gray-400 dark:text-gray-500 font-bold">${deck.count} slides • ${date}</p>
                        </div>
                        <button onclick="app.deleteDeck(event, '${deck.id}')" class="p-2 text-gray-300 dark:text-gray-600 hover:text-brand-pink dark:hover:text-brand-pink hover:bg-red-50 dark:hover:bg-brand-pink/10 rounded-lg transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    `;
                    list.appendChild(el);
                });
                lucide.createIcons();
            },

            async createNewDeck() {
                if (this.slides.length > 0 && this.slides.some(s => s.text || s.image)) {
                    const c = await this.showModal('Create New?', 'This will clear your current workspace. Unsaved changes will be lost.', 'Create New', 'plus');
                    if (!c) return;
                }

                this.slides = [];
                this.addSlide();
                this.currentDeckId = null;
                this.updateDeckNameDisplay("Unsaved Session");
                this.saveWorkspace(); // Clear storage
                this.render();
                this.toggleLibrary(); // Close drawer
                this.showToast('New Deck Created', 'file-plus');
            },

            async loadDeck(id) {
                // If loading the one we are already on, just close drawer
                if (this.currentDeckId === id) {
                    this.toggleLibrary();
                    return;
                }

                // Check unsaved changes if needed... (Simplification: Auto-switch assuming workspace is scratchpad)
                const deck = this.library.find(d => d.id === id);
                if (deck) {
                    this.slides = JSON.parse(JSON.stringify(deck.slides)); // Deep copy
                    this.currentDeckId = deck.id;
                    this.updateDeckNameDisplay(deck.title);
                    this.saveWorkspace(); // Save to active workspace
                    this.render();
                    this.toggleLibrary();
                    this.showToast(`Loaded "${deck.title}"`, 'folder-open');
                }
            },

            async deleteDeck(e, id) {
                e.stopPropagation();
                const c = await this.showModal('Delete Deck?', 'This will permanently remove this deck from your library.', 'Delete', 'trash-2');
                if (c) {
                    this.library = this.library.filter(d => d.id !== id);
                    localStorage.setItem('e1_rapid_library_v1', JSON.stringify(this.library));

                    // Cloud Cleanup
                    const { data: { user } } = await db.auth.getUser();
                    if (!isSandbox() && user) {
                        deleteFolder(`${user.id}/presentation_maker/${id}`).catch(e => console.warn("Cloud folder delete failed", e));
                    }

                    if (this.currentDeckId === id) {
                        this.currentDeckId = null;
                        this.updateDeckNameDisplay("Unsaved Session (Deleted)");
                    }
                    this.renderLibrary();
                }
            },

            manualSave() {
                if (this.currentDeckId) {
                    // Update existing
                    const deckIdx = this.library.findIndex(d => d.id === this.currentDeckId);
                    if (deckIdx > -1) {
                        this.library[deckIdx].slides = this.slides;
                        this.library[deckIdx].count = this.slides.length;
                        this.library[deckIdx].updatedAt = Date.now();
                        localStorage.setItem('e1_rapid_library_v1', JSON.stringify(this.library));
                        this.showToast('Deck Updated', 'check');
                    } else {
                        // Id exists but not in lib? Treat as new
                        this.currentDeckId = null;
                        this.manualSave();
                    }
                } else {
                    // Save As New
                    const modal = document.getElementById('name-modal');
                    const input = document.getElementById('deck-name-input');
                    const btn = document.getElementById('confirm-save-btn');

                    input.value = '';
                    modal.classList.remove('hidden');
                    input.focus();

                    btn.onclick = () => {
                        const name = input.value.trim() || 'Untitled Deck';
                        const newId = Date.now().toString();

                        const newDeck = {
                            id: newId,
                            title: name,
                            slides: JSON.parse(JSON.stringify(this.slides)),
                            count: this.slides.length,
                            updatedAt: Date.now()
                        };

                        this.library.push(newDeck);
                        this.currentDeckId = newId;
                        localStorage.setItem('e1_rapid_library_v1', JSON.stringify(this.library));

                        this.updateDeckNameDisplay(name);
                        this.saveWorkspace(); // Update meta

                        modal.classList.add('hidden');
                        this.showToast('Saved to Library', 'save');
                    }
                }
            },

            updateDeckNameDisplay(name) {
                const label = document.getElementById('current-deck-name');
                const indicator = document.getElementById('save-status-indicator');
                label.innerText = name;
                if (this.currentDeckId) {
                    label.className = "text-xs font-bold text-brand-blue uppercase tracking-widest";
                    indicator.className = "w-2 h-2 rounded-full bg-brand-green";
                } else {
                    label.className = "text-xs font-bold text-gray-400 uppercase tracking-widest";
                    indicator.className = "w-2 h-2 rounded-full bg-brand-orange";
                }
            },

            // --- EXISTING LOGIC ---

            bindGlobalKeys() {
                document.addEventListener('keydown', (e) => {
                    const isPres = document.getElementById('presentation-mode').style.display === 'flex';
                    const isCtrl = e.ctrlKey || e.metaKey;

                    if (isCtrl && e.key === 'Enter' && !isPres) {
                        e.preventDefault();
                        this.addSlide();
                        this.showToast('New Slide Added', 'plus-circle');
                    }

                    if (isCtrl && (e.key === 'p' || e.key === 'P')) {
                        e.preventDefault();
                        if (!isPres) this.startPresentation();
                    }

                    if (isCtrl && (e.key === 's' || e.key === 'S')) {
                        e.preventDefault();
                        this.manualSave();
                    }

                    if (e.altKey && !isPres && document.activeElement.tagName === 'TEXTAREA') {
                        const wrapper = document.activeElement.closest('.slide-card');
                        if (wrapper) {
                            const idParts = wrapper.id.split('-');
                            const idx = parseInt(idParts[idParts.length - 1]);
                            if (e.key === 'ArrowUp' && idx > 0) {
                                e.preventDefault();
                                this.reorderSlides(idx, idx - 1);
                                setTimeout(() => this.focusSlide(idx - 1), 50);
                            } else if (e.key === 'ArrowDown' && idx < this.slides.length - 1) {
                                e.preventDefault();
                                this.reorderSlides(idx, idx + 1);
                                setTimeout(() => this.focusSlide(idx + 1), 50);
                            }
                        }
                    }
                });
            },

            bindPresentationKeys() {
                document.addEventListener('keydown', (e) => {
                    if (document.getElementById('presentation-mode').style.display === 'flex') {
                        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.nextSlide(); }
                        else if (e.key === 'ArrowLeft') this.prevSlide();
                        else if (e.key === 'Escape') this.exitPresentation();
                    }
                });
            },

            focusSlide(index) {
                const el = document.getElementById(`slide-item-${index}`);
                if (el) { const ta = el.querySelector('textarea'); if (ta) ta.focus(); }
            },

            showToast(msg, icon) {
                const c = document.getElementById('toast-container');
                const el = document.createElement('div');
                el.className = "bg-brand-dark text-white px-4 py-3 rounded-xl shadow-hard-sm flex items-center gap-3 toast-enter font-heading font-bold";
                el.innerHTML = `<i data-lucide="${icon || 'info'}" class="w-5 h-5 text-brand-green"></i> ${msg}`;
                c.appendChild(el);
                lucide.createIcons();
                setTimeout(() => { el.style.animation = "fadeOut 0.5s forwards"; setTimeout(() => el.remove(), 500); }, 2000);
            },

            saveWorkspace() {
                // Saves the current working state (scratchpad)
                localStorage.setItem('e1_rapid_slides_v4', JSON.stringify(this.slides));
                // Also save meta about which deck is active
                if (this.currentDeckId) {
                    const deck = this.library.find(d => d.id === this.currentDeckId);
                    localStorage.setItem('e1_rapid_meta_v1', JSON.stringify({ id: this.currentDeckId, title: deck ? deck.title : 'Unsaved' }));
                } else {
                    localStorage.removeItem('e1_rapid_meta_v1');
                }
                this.updateStats();
                this.syncToCloud();
            },

            switchView(mode) {
                this.viewMode = mode;
                const btnList = document.getElementById('btn-view-list');
                const btnGrid = document.getElementById('btn-view-grid');
                const listContainer = document.getElementById('slides-list-container');
                const gridContainer = document.getElementById('slides-grid-container');

                if (mode === 'list') {
                    btnList.classList.add('bg-brand-blue', 'text-white', 'shadow-sm');
                    btnList.classList.remove('text-gray-500');
                    btnGrid.classList.remove('bg-brand-blue', 'text-white', 'shadow-sm');
                    btnGrid.classList.add('text-gray-500');
                    listContainer.classList.remove('hidden');
                    gridContainer.classList.add('hidden');
                    gridContainer.classList.remove('grid');
                } else {
                    btnGrid.classList.add('bg-brand-blue', 'text-white', 'shadow-sm');
                    btnGrid.classList.remove('text-gray-500');
                    btnList.classList.remove('bg-brand-blue', 'text-white', 'shadow-sm');
                    btnList.classList.add('text-gray-500');
                    listContainer.classList.add('hidden');
                    gridContainer.classList.remove('hidden');
                    gridContainer.classList.add('grid');
                }
                this.render();
            },

            render() {
                this.updateStats();
                const emptyState = document.getElementById('empty-state');

                if (this.slides.length === 0) {
                    emptyState.classList.remove('hidden');
                    document.getElementById('slides-list-container').innerHTML = '';
                    document.getElementById('slides-grid-container').innerHTML = '';
                    return;
                }
                emptyState.classList.add('hidden');

                if (this.viewMode === 'list') this.renderList();
                else this.renderGrid();

                this.hydrateThumbnails();
                lucide.createIcons();
            },

            async hydrateThumbnails() {
                const thumbs = document.querySelectorAll('.slide-thumb img, .grid-card img');
                for (const img of thumbs) {
                    if (img.src) {
                        if (img.src.includes('klasskit-media')) {
                            img.src = await resolveMediaUrl(img.src);
                        } else if (img.src.startsWith('klasskit-local:')) {
                            img.src = await resolveLocalMedia(img.src);
                        }
                    }
                }
            },

            renderList() {
                const container = document.getElementById('slides-list-container');
                container.innerHTML = '';

                this.slides.forEach((slide, index) => {
                    const slideEl = document.createElement('div');
                    slideEl.id = `slide-item-${index}`;
                    slideEl.className = 'slide-card bg-white dark:bg-slate-800 border-[3px] border-brand-dark dark:border-white/10 rounded-xl p-5 shadow-sm hover:shadow-hard-sm dark:shadow-none transition-all flex flex-col md:flex-row gap-5 items-start relative';

                    const layouts = [
                        { id: 'hero', icon: 'type', label: 'Hero' },
                        { id: 'split', icon: 'columns-2', label: 'Split' },
                        { id: 'caption', icon: 'panel-bottom', label: 'Caption' },
                        { id: 'full', icon: 'image', label: 'Image' },
                    ];

                    const layoutButtons = layouts.map(l => {
                        const active = slide.layout === l.id;
                        return `<button onclick="app.updateSlideLayout(${index}, '${l.id}')" 
                            class="flex-1 py-1.5 px-2 rounded-lg border-2 text-xs font-bold flex items-center justify-center gap-1 transition-all ${active ? 'bg-brand-blue text-white border-brand-dark dark:border-transparent shadow-hard-sm dark:shadow-none' : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-brand-blue dark:hover:border-brand-blue hover:text-brand-blue'}" 
                            title="${l.label}">
                            <i data-lucide="${l.icon}" class="w-3 h-3"></i> ${l.label}
                        </button>`;
                    }).join('');

                    const isTextHidden = slide.layout === 'full';
                    const isImageHidden = slide.layout === 'hero';

                    slideEl.innerHTML = `
                        <div class="hidden md:flex flex-col items-center gap-1 pt-1 text-gray-400 dark:text-gray-500 w-8">
                            <span class="font-heading font-bold text-xl text-brand-dark dark:text-white">${index + 1}</span>
                        </div>
                        <div class="flex-grow w-full">
                            <div class="mb-4 bg-brand-bg dark:bg-slate-900 border-[2px] border-brand-dark dark:border-white/10 rounded-xl p-2 flex gap-2 transition-colors">
                                ${layoutButtons}
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="relative ${isTextHidden ? 'input-locked' : ''}">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 ml-1">
                                        <i data-lucide="type" class="inline w-3 h-3 mr-1"></i> Text
                                    </label>
                                    <textarea oninput="app.updateSlideText(${index}, this.value)" 
                                        class="w-full h-32 p-3 rounded-xl border-[2px] border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 text-brand-dark dark:text-white focus:border-brand-blue dark:focus:border-brand-blue focus:shadow-hard-sm dark:focus:shadow-none focus:outline-none resize-none font-medium text-lg transition-all" 
                                        placeholder="Enter your text here...">${slide.text}</textarea>
                                </div>
                                <div class="relative ${isImageHidden ? 'input-locked' : ''}">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 ml-1">
                                        <i data-lucide="image" class="inline w-3 h-3 mr-1"></i> Visual
                                    </label>
                                    ${slide.image ? `
                                        <div class="relative group h-32 w-full rounded-xl border-[2px] border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
                                            <img src="${slide.image}" class="h-full w-full object-contain p-2">
                                            <div class="absolute inset-0 bg-brand-dark/80 hidden group-hover:flex items-center justify-center gap-2 transition-opacity cursor-pointer" onclick="app.removeImage(${index})">
                                                <div class="text-white font-bold text-sm flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4"></i> Remove</div>
                                            </div>
                                        </div>` : `
                                        <button onclick="app.triggerImageUpload(${index})" class="w-full h-32 rounded-xl border-[2px] border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-blue dark:hover:border-brand-blue bg-transparent hover:bg-blue-50 dark:hover:bg-brand-blue/10 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:text-brand-blue transition-all group">
                                            <div class="w-10 h-10 bg-gray-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-brand-blue/20 transition-colors">
                                                <i data-lucide="upload-cloud" class="w-5 h-5"></i>
                                            </div>
                                            <span class="text-xs font-bold">Upload Image</span>
                                        </button>`}
                                </div>
                            </div>
                        </div>
                        <button onclick="app.deleteSlide(${index})" class="absolute top-4 right-4 text-gray-300 dark:text-gray-600 hover:text-brand-pink transition-colors p-1" title="Delete Slide">
                            <i data-lucide="x" class="w-6 h-6"></i>
                        </button>
                    `;
                    container.appendChild(slideEl);
                });
            },

            renderGrid() {
                const container = document.getElementById('slides-grid-container');
                container.innerHTML = '';

                this.slides.forEach((slide, index) => {
                    const el = document.createElement('div');
                    el.className = 'grid-card bg-white dark:bg-slate-800 border-[3px] border-brand-dark dark:border-white/10 rounded-xl p-2 shadow-sm hover:shadow-hard-sm dark:shadow-none cursor-grab active:cursor-grabbing relative flex flex-col h-32 transition-all';
                    el.draggable = true;

                    el.addEventListener('dragstart', (e) => { this.dragSrcIndex = index; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
                    el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.querySelectorAll('.grid-card').forEach(card => card.classList.remove('drag-over')); });
                    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); return false; });
                    el.addEventListener('dragleave', () => { el.classList.remove('drag-over'); });
                    el.addEventListener('drop', (e) => { e.stopPropagation(); if (this.dragSrcIndex !== index) app.reorderSlides(this.dragSrcIndex, index); return false; });
                    el.onclick = () => { if (!el.classList.contains('dragging')) app.jumptoSlide(index); };

                    let contentHTML = '';
                    if (slide.layout === 'full' && slide.image) contentHTML = `<img src="${slide.image}" class="w-full h-full object-cover rounded-lg opacity-80 dark:opacity-60">`;
                    else if (slide.layout === 'hero') contentHTML = `<div class="w-full h-full flex items-center justify-center text-center p-1 bg-brand-bg dark:bg-slate-900 transition-colors"><span class="text-lg font-heading font-bold text-brand-blue truncate">${slide.text || '...'}</span></div>`;
                    else if (slide.image) contentHTML = `<div class="flex h-full"><div class="w-1/2 flex items-center justify-center p-1"><span class="text-[8px] font-bold text-brand-dark dark:text-gray-300 truncate">${slide.text}</span></div><div class="w-1/2 h-full"><img src="${slide.image}" class="w-full h-full object-cover rounded-r-lg"></div></div>`;
                    else contentHTML = `<div class="w-full h-full flex items-center justify-center text-center p-1"><span class="text-xs font-bold text-gray-600 dark:text-gray-400 truncate line-clamp-3">${slide.text || 'Empty'}</span></div>`;

                    el.innerHTML = `
                        <div class="absolute top-1 left-1 bg-brand-dark dark:bg-brand-blue text-white text-[10px] font-bold px-1.5 rounded z-10 transition-colors">${index + 1}</div>
                        <div class="flex-grow overflow-hidden rounded-lg border border-gray-100 dark:border-white/5 pointer-events-none transition-colors">
                            ${contentHTML}
                        </div>
                    `;
                    container.appendChild(el);
                });
            },

            jumptoSlide(index) {
                this.switchView('list');
                setTimeout(() => {
                    const el = document.getElementById(`slide-item-${index}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this.focusSlide(index);
                }, 100);
            },

            reorderSlides(fromIndex, toIndex) {
                const item = this.slides.splice(fromIndex, 1)[0];
                this.slides.splice(toIndex, 0, item);
                this.saveWorkspace(); this.render();
            },

            addSlide() {
                this.slides.push({ id: Date.now(), text: '', image: null, layout: 'split' });
                this.saveWorkspace();
                if (this.viewMode === 'list') {
                    this.renderList();
                    setTimeout(() => document.getElementById('deck-viewport').scrollTop = document.getElementById('deck-viewport').scrollHeight, 50);
                    setTimeout(() => this.focusSlide(this.slides.length - 1), 100);
                } else this.renderGrid();
            },

            deleteSlide(index) {
                if (this.slides.length <= 1) {
                    this.slides[0].text = ''; this.slides[0].image = null;
                } else { this.slides.splice(index, 1); }
                this.saveWorkspace(); this.render();
            },

            updateSlideText(index, value) { this.slides[index].text = value; this.saveWorkspace(); },
            updateSlideLayout(index, value) { this.slides[index].layout = value; this.saveWorkspace(); this.render(); },

            triggerImageUpload(index) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        const { data: { user } } = await db.auth.getUser();
                        let imgSource;
                        if (!isSandbox() && user) {
                            imgSource = await uploadMedia(file, 'presentation_maker', this.currentDeckId || 'unsaved');
                        } else {
                            // Sandbox Mode: Use IDB
                            const localUrl = `klasskit-local:presentation/${Date.now()}`;
                            await putImg(localUrl, file);
                            imgSource = localUrl;
                        }
                        this.slides[index].image = imgSource;
                        this.saveWorkspace(); this.render();
                    } catch (err) {
                        console.error("Image upload failed", err);
                        this.showToast("Failed to upload image", "alert-circle");
                    }
                };
                input.click();
            },

            removeImage(index) { 
                const url = this.slides[index].image;
                if (url && url.includes('klasskit-media')) {
                    deleteMediaFromUrl(url).catch(e => console.error("Cloud delete failed", e));
                }
                this.slides[index].image = null; 
                this.saveWorkspace(); 
                this.render(); 
            },

            compressImage(img) {
                const canvas = document.getElementById('compression-canvas'); const ctx = canvas.getContext('2d');
                const MAX_SZ = 800;
                let w = img.width; let h = img.height;
                if (w > h) { if (w > MAX_SZ) { h *= MAX_SZ / w; w = MAX_SZ; } }
                else { if (h > MAX_SZ) { w *= MAX_SZ / h; h = MAX_SZ; } }
                canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
                return canvas.toDataURL('image/jpeg', 0.6);
            },

            updateStats() {
                const sc = document.getElementById('stat-count'); const st = document.getElementById('stat-time');
                if (sc) sc.innerText = this.slides.length;
                if (st) st.innerText = Math.ceil((this.slides.length * 3) / 60) + "m";
            },

            startPresentation() {
                const valid = this.slides.filter(s => s.text.trim() !== "" || s.image !== null);
                if (valid.length === 0) { this.showModal('Empty Deck', 'Add content before starting.', 'Okay', 'info'); return; }
                this.presentationSlides = valid;
                this.currentIndex = 0;
                const ov = document.getElementById('presentation-mode');
                ov.classList.remove('hidden'); ov.style.display = 'flex';
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(e => { });
                this.renderShowSlide();
            },

            exitPresentation(e) {
                if (e) e.stopPropagation();
                const ov = document.getElementById('presentation-mode');
                ov.classList.add('hidden'); ov.style.display = 'none';
                if (document.exitFullscreen) document.exitFullscreen().catch(e => { });
            },

            nextSlide() {
                this.currentIndex++;
                if (this.currentIndex >= this.presentationSlides.length) this.currentIndex = 0;
                this.renderShowSlide();
            },

            prevSlide() {
                this.currentIndex--;
                if (this.currentIndex < 0) this.currentIndex = this.presentationSlides.length - 1;
                this.renderShowSlide();
            },

            async renderShowSlide() {
                const s = this.presentationSlides[this.currentIndex];
                const container = document.getElementById('slide-display-container');
                const txt = document.getElementById('display-word');
                const img = document.getElementById('display-image');
                const ov = document.getElementById('presentation-mode');

                container.className = "w-full h-full flex items-center justify-center px-8 relative z-10 gap-8 max-w-[90vw] mx-auto transition-all";
                const layout = s.layout || 'split';
                container.classList.add(`layout-${layout}`);

                txt.classList.remove('hidden');
                img.classList.remove('hidden');

                txt.innerText = s.text;
                if (s.image) {
                    if (s.image.startsWith('klasskit-local:')) img.src = await resolveLocalMedia(s.image);
                    else img.src = await resolveMediaUrl(s.image);
                } else img.src = "";

                if (layout === 'hero' || (layout === 'split' && !s.image)) img.classList.add('hidden');

                container.classList.remove('slide-enter');
                void container.offsetWidth;
                container.classList.add('slide-enter');

                ov.style.backgroundColor = this.colors[this.currentIndex % this.colors.length];
                document.getElementById('slide-number').innerText = this.currentIndex + 1;
                document.getElementById('total-slides').innerText = this.presentationSlides.length;
                document.getElementById('progress-bar').style.width = `${((this.currentIndex + 1) / this.presentationSlides.length) * 100}%`;
            },

            exportJSON() {
                const d = JSON.stringify(this.slides, null, 2);
                const a = document.createElement('a');
                a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(d);
                a.download = `klasskit_presenter_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
            },

            triggerImport() { document.getElementById('importInput').click(); },

            async processImport(el) {
                const f = el.files[0]; if (!f) return;
                const c = await this.showModal('Restore?', 'This will replace current slides.', 'Yes, Replace', 'upload');
                if (!c) { el.value = ''; return; }
                const r = new FileReader();
                r.onload = (e) => {
                    try {
                        const d = JSON.parse(e.target.result);
                        if (Array.isArray(d)) { this.slides = d; this.saveWorkspace(); this.render(); }
                    } catch (err) { }
                };
                r.readAsText(f); el.value = '';
            },

            async clear() {
                if (await this.showModal('Clear All?', 'Delete all slides?', 'Yes, Clear All')) {
                    this.slides = []; this.addSlide(); this.saveWorkspace(); this.render();
                }
            },

            showModal(t, d, cText, icon) {
                return new Promise((res) => {
                    const m = document.getElementById('custom-modal');
                    document.getElementById('modal-title').innerText = t;
                    document.getElementById('modal-desc').innerText = d;
                    const cb = document.getElementById('modal-confirm');
                    cb.innerText = cText;
                    document.getElementById('modal-icon').setAttribute('data-lucide', icon || 'alert-triangle');
                    lucide.createIcons();
                    m.classList.remove('hidden');
                    const cleanup = (v) => { m.classList.add('hidden'); cb.onclick = null; document.getElementById('modal-cancel').onclick = null; res(v); };
                    cb.onclick = () => cleanup(true);
                    document.getElementById('modal-cancel').onclick = () => cleanup(false);
                });
            }
        };

        window.onload = async () => await app.init();
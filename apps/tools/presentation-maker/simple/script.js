        // Initialize Lucide Icons
        lucide.createIcons();

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const colors = {
                info: 'bg-white dark:bg-slate-800 border-blue text-dark dark:text-chalk',
                success: 'bg-green/10 dark:bg-green/20 border-green text-green-700 dark:text-green-400',
                error: 'bg-pink/10 dark:bg-pink/20 border-pink text-pink-700 dark:text-pink-400'
            };
            
            toast.className = `flex items-center gap-3 px-6 py-4 rounded-2xl border-2 shadow-hard dark:shadow-hard-white animate-pop-in pointer-events-auto ${colors[type]}`;
            
            const icon = {
                info: 'info',
                success: 'check-circle',
                error: 'alert-circle'
            }[type];

            toast.innerHTML = `
                <i data-lucide="${icon}" class="w-5 h-5"></i>
                <span class="font-bold font-title">${message}</span>
            `;
            
            container.appendChild(toast);
            lucide.createIcons();

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-300');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // --- IndexedDB ---
        const DB_NAME = 'PresentationDB';
        const DB_VER = 2;
        const STATE_STORE = 'game_state';
        const SETS_STORE = 'slide_sets';
        const IMG_STORE = 'images';

        let idb = null;

        async function initDB() {
            if (idb) return idb;
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VER);
                req.onupgradeneeded = (e) => {
                    const database = e.target.result;
                    if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE);
                    if (!database.objectStoreNames.contains(SETS_STORE)) database.createObjectStore(SETS_STORE, { keyPath: 'id', autoIncrement: true });
                    if (!database.objectStoreNames.contains(IMG_STORE)) database.createObjectStore(IMG_STORE);
                };
                req.onsuccess = (e) => {
                    idb = e.target.result;
                resolve(idb);
                };
                req.onerror = (e) => reject(e.target.error);
            });
        }

        async function getImg(url) {
            try {
                const database = await initDB();
                return new Promise((res) => {
                    const r = database.transaction(IMG_STORE, 'readonly').objectStore(IMG_STORE).get(url);
                    r.onsuccess = () => res(r.result);
                    r.onerror = () => res(null);
                });
            } catch(e) { return null; }
        }

        async function putImg(url, blob) {
            try {
                const database = await initDB();
                database.transaction(IMG_STORE, 'readwrite').objectStore(IMG_STORE).put(blob, url);
            } catch(e) { }
        }

        const blobCache = new Map();

        async function resolveAndCache(url) {
            if (!url || !url.includes('klasskit-media')) return url;
            if (blobCache.has(url)) return blobCache.get(url);

            // 1. Check IDB
            const cachedBlob = await getImg(url);
            if (cachedBlob) {
                const bUrl = URL.createObjectURL(cachedBlob);
                blobCache.set(url, bUrl);
                return bUrl;
            }

            // 2. Fetch from Cloud and Cache
            try {
                const signedUrl = await resolveMediaUrl(url);
                const resp = await fetch(signedUrl);
                const blob = await resp.blob();
                
                await putImg(url, blob);
                const bUrl = URL.createObjectURL(blob);
                blobCache.set(url, bUrl);
                return bUrl;
            } catch (e) {
                console.warn("Cloud cache failed", e);
                return url;
            }
        }
        async function dbPut(key, data) {
            try {
                const database = await initDB();
                database.transaction(STATE_STORE, 'readwrite').objectStore(STATE_STORE).put(data, key);
                // Always sync state items to cloud
                if (key === 'presentationText' || key === 'presentationImages') {
                    await saveToCloud();
                }
            } catch(e) { console.error(e); }
        }
        async function dbGet(key) {
            try {
                const database = await initDB();
                return new Promise((res) => { const r = database.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
            } catch(e) { return null; }
        }
        async function saveSetToDB(name, text, images = [], id = null, extra = {}) {
            const database = await initDB();
            const tx = database.transaction(SETS_STORE, 'readwrite');
            const store = tx.objectStore(SETS_STORE);
            const payload = { name, text, images, createdAt: extra.createdAt || Date.now(), ...extra };
            if (id) payload.id = id;
            store.put(payload);
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => { saveToCloud(); resolve(); };
                tx.onerror = () => reject(tx.error);
            });
        }
        async function getAllSets() {
            try {
                const database = await initDB();
                return new Promise((res) => { const r = database.transaction(SETS_STORE, 'readonly').objectStore(SETS_STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
            } catch(e) { return []; }
        }
        async function deleteSet(id) {
            const database = await initDB();
            const tx = database.transaction(SETS_STORE, 'readwrite');
            tx.objectStore(SETS_STORE).delete(id);
            tx.oncomplete = () => {
                saveToCloud();
            };
            return new Promise(r => { tx.oncomplete = r; });
        }

        // --- CLOUD SYNC ---
        async function saveToCloud() {
            try {
                const text = await dbGet('presentationText');
                const rawImages = await dbGet('presentationImages');
                const rawSets = await getAllSets();

                // Only sync http(s) URLs to cloud; filter out local data: URLs
                const cleanImages = (rawImages || []).filter(img => img && img.startsWith('http'));
                const cleanSets = (rawSets || []).map(s => ({
                    ...s,
                    images: (s.images || []).filter(img => img && img.startsWith('http'))
                }));

                await saveProgress('speedy_slides_data', { text, images: cleanImages, sets: cleanSets });
            } catch (e) {
                console.error("Cloud save failed", e);
            }
        }

        async function loadFromCloud() {
            try {
                const data = await loadProgress('speedy_slides_data');
                if (!data) return;

                // Merge text: cloud wins if non-empty, otherwise keep local
                if (data.text !== undefined && data.text !== null && data.text !== '') {
                    const localText = await dbGet('presentationText') || '';
                    if (data.text !== localText) {
                        await dbPut('presentationText', data.text);
                        const textarea = document.getElementById('word-input');
                        if (textarea) textarea.value = data.text;
                    }
                }

                // Merge images: only add cloud URLs that don't already exist locally; never wipe local data: URLs
                if (data.images !== undefined && data.images.length > 0) {
                    const localImages = (await dbGet('presentationImages')) || [];
                    const merged = [...localImages];
                    for (const img of data.images) {
                        if (img && !merged.includes(img)) merged.push(img);
                    }
                    await dbPut('presentationImages', merged);
                    app.images = merged;
                }

                // Merge sets: update by name if exists, otherwise create new; preserve local ids
                if (data.sets && data.sets.length > 0) {
                    const existing = await getAllSets();
                    for (const s of data.sets) {
                        const match = existing.find(es => es.name === s.name);
                        if (match) {
                            // Update existing set, preserving local id and stats
                            await saveSetToDB(s.name, s.text, s.images, match.id, {
                                createdAt: match.createdAt || s.createdAt || Date.now(),
                                lastUsed: match.lastUsed || s.lastUsed || Date.now(),
                                usageCount: match.usageCount || s.usageCount || 0
                            });
                        } else {
                            await saveSetToDB(s.name, s.text, s.images, null, {
                                createdAt: s.createdAt || Date.now(),
                                lastUsed: s.lastUsed || Date.now(),
                                usageCount: s.usageCount || 0
                            });
                        }
                    }
                }

                app.updateImageUI();
                app.updateCount();
                app.renderSets();
            } catch (e) {
                console.error("Cloud load failed", e);
            }
        }

        const app = {
            words: [],
            images: [],
            activeSetId: null,
            currentIndex: 0,
            imageFullscreen: false,
            colors: ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'], // KK Palette: Pink, Orange, Green, Blue

            async init() {
                // Dark Mode initialization
                const st = localStorage.getItem('theme_speedy-slides');
                if (st === 'dark' || (!st && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                }

                // Auto-load saved text (try IndexedDB first, fallback to localStorage)
                const textarea = document.getElementById('word-input');
                const dbText = await dbGet('presentationText');
                if (dbText) {
                    textarea.value = dbText;
                } else {
                    const saved = localStorage.getItem('e1_rapid_text');
                    if (saved) textarea.value = saved;
                }
                
                const dbImages = await dbGet('presentationImages');
                if (dbImages) {
                    this.images = dbImages;
                    this.updateImageUI();
                }

                this.updateCount();
                this.updateSlideStrip();

                // Keyboard listeners for presentation
                window.addEventListener('keydown', (e) => {
                    const overlay = document.getElementById('presentation-mode');
                    if (overlay.style.display === 'flex') {
                        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') this.nextSlide();
                        if (e.key === 'ArrowLeft') this.prevSlide();
                        if (e.key === 'Escape') this.stopPresentation();
                    }
                });

                // Click to advance
                document.getElementById('presentation-mode').addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        this.nextSlide();
                    }
                });

                // Auto-save and count update on typing
                textarea.addEventListener('input', (e) => {
                    const val = e.target.value;
                    localStorage.setItem('e1_rapid_text', val);
                    dbPut('presentationText', val);
                    this.updateCount();
                    if (this.activeSetId) this.autoSaveActiveSet();
                });

                // Load saved sets
                this.renderSets();

                // Initial Cloud Sync
                await loadFromCloud();
            },

            toggleDarkMode() {
                document.documentElement.classList.toggle('dark');
                if (document.documentElement.classList.contains('dark')) {
                } else {
                }
            },

            parseInput() {
                const raw = document.getElementById('word-input').value;
                if (!raw.trim()) return [];

                // Split by newline OR semicolon, trim, remove empty
                return raw.split(/[;\n]+/)
                    .map(w => w.trim())
                    .filter(w => w.length > 0);
            },

            updateCount() {
                const words = this.parseInput();
                const total = words.length + this.images.length;
                const countEl = document.getElementById('item-count');
                if (countEl) countEl.innerText = `${total} item${total !== 1 ? 's' : ''}`;
                const previewCount = document.getElementById('preview-count');
                if (previewCount) previewCount.innerText = `${total} Slide${total !== 1 ? 's' : ''}`;
                this.updateSlideStrip();
            },

            async updateSlideStrip() {
                const strip = document.getElementById('slide-strip');
                if (!strip) return;
                
                const words = this.parseInput();
                const allItems = [...words, ...this.images];
                
                if (allItems.length === 0) {
                    strip.innerHTML = '<div class="text-[10px] italic opacity-30 px-2 font-bold font-title">No slides yet. Start typing!</div>';
                    return;
                }

                const html = await Promise.all(allItems.map(async (item, index) => {
                    const isImage = item.startsWith('data:image/') || item.includes('klasskit-media');
                    const color = this.colors[index % this.colors.length];
                    
                    let content = '';
                    if (isImage) {
                        const src = await resolveAndCache(item);
                        content = `<img src="${src}" class="w-full h-full object-cover">`;
                    } else {
                        content = `<div class="strip-text w-full h-full flex items-center justify-center p-1 font-bold text-chalk text-center leading-none overflow-hidden" style="font-size: 12px;">${item}</div>`;
                    }

                    return `
                        <div class="shrink-0 w-24 aspect-chromebook border-2 border-dark dark:border-slate-600 rounded-lg shadow-sm overflow-hidden relative group animate-pop-in" style="background-color: ${color}">
                            ${content}
                            <div class="absolute top-0 left-0 bg-dark/40 text-chalk text-[7px] px-1 font-bold rounded-br-md">${index + 1}</div>
                        </div>
                    `;
                }));

                strip.innerHTML = html.join('');
                requestAnimationFrame(() => this.fitStripTexts());
            },

            fitStripTexts() {
                const texts = document.querySelectorAll('.strip-text');
                texts.forEach(el => {
                    let size = parseFloat(getComputedStyle(el).fontSize);
                    let safe = 0;
                    while (safe < 50) {
                        const overflowX = el.scrollWidth > el.clientWidth;
                        const overflowY = el.scrollHeight > el.clientHeight;
                        if (!overflowX && !overflowY) break;
                        size *= 0.92;
                        el.style.fontSize = size + 'px';
                        safe++;
                    }
                });
            },

            async handleImages(event) {
                const files = event.target.files;
                if (!files || files.length === 0) return;
                
                showToast(`Saving ${files.length} image${files.length > 1 ? 's' : ''}...`, "info");

                const { data: { user } } = await db.auth.getUser();
                const canUpload = !isSandbox() && user;

                let successCount = 0;
                for (const file of Array.from(files)) {
                    try {
                        let imgSource;
                        if (canUpload) {
                            imgSource = await uploadMedia(file, 'presentation_simple');
                        } else {
                            imgSource = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (e) => resolve(e.target.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                            });
                        }
                        this.images.push(imgSource);
                        successCount++;
                    } catch (err) {
                        console.error("Image processing failed", err);
                    }
                }

                if (successCount > 0) {
                    showToast(`Successfully saved ${successCount} image${successCount > 1 ? 's' : ''}`, "success");
                }
                
                this.updateImageUI();
                this.updateCount();
                this.updateSlideStrip();
                if (this.activeSetId) this.autoSaveActiveSet();
                dbPut('presentationImages', this.images);
            },

            async clearImages() {
                const confirmed = await showConfirmModal('Clear all images from local and cloud?', {
                    title: "Clear Images?",
                    confirmText: "Clear",
                    cancelText: "Cancel",
                    icon: "rotate-ccw",
                    iconColor: "red"
                });
                if (!confirmed) return;
                
                const { data: { user } } = await db.auth.getUser();
                if (!isSandbox() && user) {
                    showToast("Purging cloud folder...", "info");
                    await deleteFolder(`${user.id}/presentation_simple`).catch(e => console.warn(e));
                }
                
                this.images = [];
                const input = document.getElementById('image-input');
                if (input) input.value = '';
                this.updateImageUI();
                this.updateCount();
                await dbPut('presentationImages', this.images);
                this.closeImageManager();
                showToast("All images cleared", "success");
            },

            updateImageUI() {
                const text = document.getElementById('image-count-text');
                const manageBtn = document.getElementById('manage-images-btn');
                const area = document.getElementById('image-upload-area');
                text.innerText = `${this.images.length} image${this.images.length !== 1 ? 's' : ''} attached`;
                
                if (this.images.length > 0) {
                    text.classList.remove('text-dark/70', 'dark:text-chalk/70');
                    text.classList.add('text-blue', 'dark:text-blue');
                    if(manageBtn) manageBtn.classList.remove('hidden');
                    area.classList.add('border-blue/50');
                } else {
                    text.classList.add('text-dark/70', 'dark:text-chalk/70');
                    text.classList.remove('text-blue', 'dark:text-blue');
                    if(manageBtn) manageBtn.classList.add('hidden');
                    area.classList.remove('border-blue/50');
                }
            },

            openImageManager() {
                const modal = document.getElementById('image-manager-modal');
                this.renderImageManagerList();
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            },

            closeImageManager() {
                const modal = document.getElementById('image-manager-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            },

            renderImageManagerList() {
                const list = document.getElementById('image-manager-list');
                document.getElementById('image-manager-count').textContent = `${this.images.length} Image${this.images.length !== 1 ? 's' : ''}`;
                
                if (this.images.length === 0) {
                    list.innerHTML = `<div class="col-span-full h-32 flex flex-col items-center justify-center text-dark/40 dark:text-chalk/40 font-bold font-title"><i data-lucide="image-minus" class="w-8 h-8 mb-3 opacity-50"></i>No images attached.</div>`;
                    lucide.createIcons();
                    return;
                }

                list.innerHTML = this.images.map((imgSrc, index) => `
                    <div class="relative group aspect-square rounded-xl overflow-hidden border-2 border-dark/20 dark:border-slate-600 bg-chalk dark:bg-slate-800 shadow-sm">
                        <img src="${imgSrc}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <button onclick="app.deleteImage(${index})" class="p-3 bg-pink text-dark border-2 border-dark rounded-xl hover:scale-110 hover:bg-pink transition-all shadow-hard-white" title="Delete Image">
                                <i data-lucide="trash-2" class="w-6 h-6"></i>
                            </button>
                        </div>
                        <div class="absolute top-2 left-2 bg-dark/80 text-chalk text-xs font-bold px-2 py-1 rounded border border-chalk/20 font-title shadow-sm">
                            #${index + 1}
                        </div>
                    </div>
                `).join('');
                
                this.hydrateImages();
                lucide.createIcons();
            },

            async hydrateImages() {
                const imgs = document.querySelectorAll('#image-manager-list img, #display-image');
                for (const img of imgs) {
                    if (img.src && img.src.includes('klasskit-media')) {
                    img.src = await resolveAndCache(img.src);
                    }
                }
            },

            async deleteImage(index) {
                if (index < 0 || index >= this.images.length) return;
                const url = this.images[index];
                if (url && url.includes('klasskit-media')) {
                    showToast("Deleting from cloud...", "info");
                    await deleteMediaFromUrl(url).catch(e => console.error("Cloud delete failed", e));
                }
                this.images.splice(index, 1);
                this.updateImageUI();
                this.updateCount();
                if (this.activeSetId) this.autoSaveActiveSet();
                await dbPut('presentationImages', this.images);
                this.renderImageManagerList();
                if (this.images.length === 0) {
                    this.closeImageManager();
                }
                showToast("Image deleted", "success");
            },

            shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            },

            startPresentation(shuffle = false) {
                this.words = [...this.parseInput(), ...this.images];

                if (this.words.length === 0) {
                    this.words = ["Enter words or images first!"];
                } else if (shuffle) {
                    this.words = this.shuffleArray([...this.words]);
                }

                this.currentIndex = 0;
                const overlay = document.getElementById('presentation-mode');
                overlay.style.display = 'flex';
                overlay.focus();

                // Try Fullscreen safely
                try {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(() => { });
                    }
                } catch (e) { }

                this.renderSlide();
            },

            stopPresentation() {
                const overlay = document.getElementById('presentation-mode');
                overlay.style.display = 'none';

                try {
                    if (document.exitFullscreen && document.fullscreenElement) {
                        document.exitFullscreen().catch(() => { });
                    }
                } catch (e) { }
            },

            nextSlide() {
                if (this.currentIndex < this.words.length - 1) {
                    this.currentIndex++;
                } else {
                    this.currentIndex = 0; // Loop back
                }
                this.renderSlide();
            },

            prevSlide() {
                if (this.currentIndex > 0) {
                    this.currentIndex--;
                } else {
                    this.currentIndex = this.words.length - 1; // Loop to end
                }
                this.renderSlide();
            },

            async renderSlide() {
                const display = document.getElementById('display-word');
                const displayImg = document.getElementById('display-image');
                const overlay = document.getElementById('presentation-mode');

                const currentContent = this.words[this.currentIndex];
                const isImage = currentContent.startsWith('data:image/') || currentContent.includes('klasskit-media');

                if (isImage) {
                    display.style.display = 'none';
                    displayImg.style.display = 'block';
                    displayImg.src = await resolveAndCache(currentContent);
                    document.getElementById('img-fullscreen-btn').classList.remove('hidden');
                    this.updateImageFullscreenUI();

                    displayImg.classList.remove('slide-text');
                    void displayImg.offsetWidth;
                    displayImg.classList.add('slide-text');
                } else {
                    document.getElementById('img-fullscreen-btn').classList.add('hidden');
                    displayImg.style.display = 'none';
                    display.style.display = 'block';
                    display.innerText = currentContent;

                    display.classList.remove('slide-text');
                    void display.offsetWidth;
                    display.classList.add('slide-text');
                    this.fitText(display);
                }

                // Cycle through KlassKit palette colors based on index
                const colorIndex = this.currentIndex % this.colors.length;
                overlay.style.backgroundColor = this.colors[colorIndex];

                // Update counters
                document.getElementById('slide-number').innerText = this.currentIndex + 1;
                document.getElementById('total-slides').innerText = this.words.length;
            },

            toggleImageFullscreen() {
                this.imageFullscreen = !this.imageFullscreen;
                this.updateImageFullscreenUI();
            },

            updateImageFullscreenUI() {
                const btn = document.getElementById('img-fullscreen-btn');
                const icon = document.getElementById('img-fullscreen-icon');
                const img = document.getElementById('display-image');
                if (!btn || !img) return;

                if (this.imageFullscreen) {
                    img.classList.remove('max-w-full', 'max-h-[80vh]', 'object-contain', 'rounded-2xl', 'shadow-hard-white', 'border-4', 'border-chalk', 'relative');
                    img.classList.add('fixed', 'inset-0', 'w-screen', 'h-screen', 'object-cover', 'z-10');
                    if (icon) icon.setAttribute('data-lucide', 'minimize');
                } else {
                    img.classList.remove('fixed', 'inset-0', 'w-screen', 'h-screen', 'object-cover', 'z-10');
                    img.classList.add('max-w-full', 'max-h-[80vh]', 'object-contain', 'rounded-2xl', 'shadow-hard-white', 'border-4', 'border-chalk', 'relative');
                    if (icon) icon.setAttribute('data-lucide', 'maximize');
                }
                lucide.createIcons();
            },

            fitText(el) {
                const container = document.getElementById('slide-content');
                if (!el || !container) return;

                // Reset to a large starting size
                el.style.fontSize = '15vw';

                const containerW = container.clientWidth - 80; // padding buffer
                const containerH = window.innerHeight - 200; // leave room for nav

                let size = parseFloat(getComputedStyle(el).fontSize);
                let safe = 0;
                while (safe < 60) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= containerW && rect.height <= containerH) break;
                    size *= 0.92;
                    el.style.fontSize = size + 'px';
                    safe++;
                }
            },

            // Modal Logic
            openClearModal() {
                const modal = document.getElementById('clear-modal');
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            },

            closeClearModal() {
                const modal = document.getElementById('clear-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            },

            confirmClear() {
                document.getElementById('word-input').value = "";
                localStorage.removeItem('e1_rapid_text');
                dbPut('presentationText', '');
                this.clearImages();
                this.updateCount();
                this.closeClearModal();
            },

            // Universal Sets System
            async saveCurrentSet() {
                const nameInput = document.getElementById('set-name-input');
                const name = nameInput.value.trim();
                const text = document.getElementById('word-input').value;
                if (!name || (!text.trim() && this.images.length === 0)) return;

                // If editing an active set, update it directly
                if (this.activeSetId) {
                    const database = await initDB();
                    const tx = database.transaction(SETS_STORE, 'readwrite');
                    const store = tx.objectStore(SETS_STORE);
                    const req = store.get(this.activeSetId);
                    const setId = await new Promise((resolve) => {
                        req.onsuccess = () => {
                            const existing = req.result;
                            if (existing) {
                                existing.name = name;
                                existing.text = text;
                                existing.images = this.images;
                                existing.lastUsed = Date.now();
                                store.put(existing);
                                resolve(existing.id);
                            } else {
                                // Fallback if ID no longer exists
                                const putReq = store.put({
                                    name, text, images: this.images,
                                    createdAt: Date.now(), lastUsed: Date.now(), usageCount: 1
                                });
                                putReq.onsuccess = () => resolve(putReq.result);
                            }
                        };
                    });
                    nameInput.value = '';
                    this.activeSetId = setId;
                    this.renderSets();
                    saveToCloud();
                    showToast(`Updated "${name}"`, "success");
                    return;
                }

                // No active set: check if name already exists to avoid duplicates
                const allSets = await getAllSets();
                const existing = allSets.find(s => s.name === name);
                if (existing) {
                    await saveSetToDB(name, text, this.images, existing.id, {
                        createdAt: existing.createdAt,
                        lastUsed: Date.now(),
                        usageCount: existing.usageCount || 1
                    });
                    this.activeSetId = existing.id;
                    nameInput.value = '';
                    this.renderSets();
                    showToast(`Updated "${name}"`, "success");
                    return;
                }

                // Create brand new set
                const database = await initDB();
                const newId = await new Promise(resolve => {
                    const tx = database.transaction(SETS_STORE, 'readwrite');
                    const store = tx.objectStore(SETS_STORE);
                    const req = store.put({
                        name, text, images: this.images,
                        createdAt: Date.now(), lastUsed: Date.now(), usageCount: 1
                    });
                    req.onsuccess = () => resolve(req.result);
                });

                nameInput.value = '';
                this.activeSetId = newId;
                this.renderSets();
                saveToCloud();
                showToast(`Saved as "${name}"`, "success");
            },

            async autoSaveActiveSet() {
                if (!this.activeSetId) return;
                const text = document.getElementById('word-input').value;
                const images = this.images;
                
                const database = await initDB();
                const tx = database.transaction(SETS_STORE, 'readwrite');
                const store = tx.objectStore(SETS_STORE);
                
                const req = store.get(this.activeSetId);
                req.onsuccess = () => {
                    const set = req.result;
                    if (set) {
                        set.text = text;
                        set.images = images;
                        set.lastUsed = Date.now();
                        store.put(set);
                        saveToCloud();
                    }
                };
            },

            async loadSet(set) {
                const textarea = document.getElementById('word-input');
                textarea.value = set.text || '';
                localStorage.setItem('e1_rapid_text', textarea.value);
                dbPut('presentationText', textarea.value);
                
                this.images = set.images || [];
                dbPut('presentationImages', this.images);
                
                this.activeSetId = set.id;
                
                await this.updateSetStats(set.id);
                
                this.updateImageUI();
                this.updateCount();
                this.renderSets();
                showToast(`Loaded "${set.name}"`, "success");
            },

            async updateSetStats(id) {
                const database = await initDB();
                const tx = database.transaction(SETS_STORE, 'readwrite');
                const store = tx.objectStore(SETS_STORE);
                const req = store.get(id);
                req.onsuccess = () => {
                    const set = req.result;
                    if (set) {
                        set.lastUsed = Date.now();
                        set.usageCount = (set.usageCount || 0) + 1;
                        store.put(set);
                    }
                };
            },

            newSet() {
                this.activeSetId = null;
                document.getElementById('word-input').value = '';
                this.images = [];
                dbPut('presentationText', '');
                dbPut('presentationImages', []);
                this.updateImageUI();
                this.updateCount();
                this.renderSets();
                showToast("New slides started", "info");
            },

            async renderSets() {
                const list = document.getElementById('sets-list');
                const indicator = document.getElementById('active-set-indicator');
                const activeNameEl = document.getElementById('active-set-name');
                if (!list) return;
                
                let sets = await getAllSets();
                const sortType = document.getElementById('sets-sort')?.value || 'recent';
                
                sets.forEach(s => {
                    if (!s.lastUsed) s.lastUsed = s.createdAt || 0;
                    if (!s.usageCount) s.usageCount = 0;
                });

                if (sortType === 'recent') {
                    sets.sort((a, b) => b.lastUsed - a.lastUsed);
                } else if (sortType === 'alpha') {
                    sets.sort((a, b) => a.name.localeCompare(b.name));
                } else if (sortType === 'used') {
                    sets.sort((a, b) => b.usageCount - a.usageCount);
                }
                
                if (sets.length === 0) { 
                    list.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full text-dark/30 dark:text-chalk/30 gap-1.5 py-2">
                            <i data-lucide="folder-search" class="w-5 h-5 opacity-50"></i>
                            <p class="text-[10px] font-bold font-title italic">No slides.</p>
                        </div>
                    `; 
                    if (indicator) indicator.classList.add('hidden');
                    lucide.createIcons();
                    return; 
                }
                
                list.innerHTML = '';
                let activeSetName = '';

                sets.forEach(set => {
                    const isActive = this.activeSetId === set.id;
                    if (isActive) activeSetName = set.name;

                    const textItems = set.text ? set.text.split(/[;\n]+/).filter(w => w.trim()).length : 0;
                    const imgItems = set.images ? set.images.length : 0;
                    const items = textItems + imgItems;
                    
                    const item = document.createElement('div');
                    item.className = `group flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border-3 ${isActive ? 'border-orange shadow-hard-orange' : 'border-dark/10 dark:border-slate-700'} rounded-xl hover:border-orange/50 transition-all animate-pop-in relative`;
                    item.innerHTML = `
                        <div class="w-8 h-8 ${isActive ? 'bg-orange text-chalk' : 'bg-orange/10 text-orange'} rounded-lg flex items-center justify-center shrink-0 border-2 border-orange/20">
                            <i data-lucide="${isActive ? 'edit-3' : 'file-text'}" class="w-4 h-4"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold ${isActive ? 'text-orange' : 'text-dark dark:text-chalk'} truncate font-title uppercase tracking-tight">${set.name}</p>
                            <p class="text-[9px] text-dark/50 dark:text-chalk/40 font-bold">${items} Slides ${set.usageCount > 0 ? '• ' + set.usageCount + ' plays' : ''}</p>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="set-load p-1.5 bg-blue/10 text-blue rounded-lg border-2 border-blue/20 hover:bg-blue hover:text-dark transition-all shadow-sm" title="Load Set">
                                <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="set-del p-1.5 bg-pink/10 text-pink rounded-lg border-2 border-pink/20 hover:bg-pink hover:text-dark transition-all shadow-sm" title="Delete">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                        ${isActive ? '<div class="absolute -top-2 -right-1 bg-orange text-chalk text-[7px] font-bold px-1.5 py-0.5 rounded-full border-2 border-chalk shadow-sm">ACTIVE</div>' : ''}`;
                    
                    item.querySelector('.set-load').onclick = () => app.loadSet(set);
                    item.querySelector('.set-del').onclick = async () => { 
                        const confirmed = await showConfirmModal(`Delete "${set.name}"?`, {
                            title: "Delete Set?",
                            confirmText: "Delete",
                            cancelText: "Keep",
                            icon: "trash-2",
                            iconColor: "red"
                        });
                        if (confirmed) {
                            if (this.activeSetId === set.id) this.activeSetId = null;
                            await deleteSet(set.id); 
                            app.renderSets(); 
                            showToast("Set deleted", "info");
                        }
                    };
                    list.appendChild(item);
                });

                if (this.activeSetId && activeSetName) {
                    if (indicator) indicator.classList.remove('hidden');
                    if (activeNameEl) activeNameEl.innerText = `Editing: ${activeSetName}`;
                } else {
                    if (indicator) indicator.classList.add('hidden');
                }

                lucide.createIcons();
            }
        };

        window.onload = async () => {
            await requireAuth();
            app.init();
        };
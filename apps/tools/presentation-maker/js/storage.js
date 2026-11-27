'use strict';

Object.assign(app, {
        /* --- PERSISTENCE & LIBRARY --- */
        safeLocalSet(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                if (!this._quotaWarned) {
                    this._quotaWarned = true;
                    this.showToast('Local storage is full — export JSON or remove unused decks/images.', 'triangle-alert', 'orange');
                    setTimeout(() => { this._quotaWarned = false; }, 10000);
                }
                return false;
            }
        },

        persistWorkspaceLocal() {
            clearTimeout(this.saveDebounceTimer);
            this.safeLocalSet(STORAGE_KEY, JSON.stringify(this.slides));
            this.safeLocalSet(META_KEY, JSON.stringify({
                id: this.currentDeckId,
                title: this.currentDeckTitle,
                unsaved: this.hasUnsavedChanges
            }));
        },

        persistLibraryLocal() {
            this.safeLocalSet(LIBRARY_KEY, JSON.stringify(this.library));
        },

        persistImageLibraryLocal() {
            this._hasImageLibraryStorage = true;
            this.safeLocalSet(IMAGE_LIBRARY_KEY, JSON.stringify(this.imageLibrary));
        },

        saveWorkspace(immediateCloud = false) {
            this.hasUnsavedChanges = true;
            this.updateDeckHeaderUI();

            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = setTimeout(() => {
                this.persistWorkspaceLocal();
            }, 150);

            if (immediateCloud) {
                this.syncToCloud();
            } else {
                clearTimeout(this.cloudSyncTimer);
                this.cloudSyncTimer = setTimeout(() => this.syncToCloud(), 1800);
            }
        },

        flushPendingSaves() {
            clearTimeout(this.saveDebounceTimer);
            this.persistWorkspaceLocal();
            this.persistLibraryLocal();
            this.persistImageLibraryLocal();
        },

        async syncToCloud() {
            if (typeof saveProgress !== 'function') return;
            try {
                const user = typeof getCloudUser === 'function' ? await getCloudUser() : null;
                if (!user) return;

                const cleanSlides = this.slides.map((s) => ({
                    ...s,
                    image: (s.image && String(s.image).startsWith('klasskit-local:')) ? null : s.image
                }));

                const cleanLibrary = this.library.map((deck) => ({
                    ...deck,
                    slides: (deck.slides || []).map((s) => ({
                        ...s,
                        image: (s.image && String(s.image).startsWith('klasskit-local:')) ? null : s.image
                    }))
                }));

                const cleanImages = this.imageLibrary.filter((img) => img && img.src && !String(img.src).startsWith('klasskit-local:'));

                await saveProgress('presentation_data', {
                    slides: cleanSlides,
                    library: cleanLibrary,
                    images: cleanImages,
                    meta: {
                        id: this.currentDeckId,
                        title: this.currentDeckTitle,
                        unsaved: this.hasUnsavedChanges
                    }
                });
            } catch (e) {
                console.warn('Cloud sync skipped:', e);
            }
        },

        toggleLibrary(force) {
            this.toggleLibraryDrawer(force);
        },

        toggleLibraryDrawer(force) {
            const drawer = document.getElementById('library-drawer');
            if (!drawer) return;
            const open = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
            drawer.classList.toggle('open', open);
            if (open) {
                this.renderLibrary();
                setTimeout(() => {
                    const search = document.getElementById('library-search');
                    if (search) search.focus();
                }, 140);
            }
        },

        openSaveModal() {
            const input = document.getElementById('deck-name-input');
            const copyWrap = document.getElementById('save-as-copy-wrap');
            const copyCheck = document.getElementById('save-as-copy-checkbox');
            const modalTitle = document.getElementById('name-modal-title');

            const isExisting = Boolean(this.currentDeckId && this.library.some((d) => d.id === this.currentDeckId));
            if (modalTitle) modalTitle.textContent = isExisting ? 'Update Deck Details' : 'Save New Deck';
            if (copyWrap) copyWrap.classList.toggle('is-hidden', !isExisting);
            if (copyCheck) copyCheck.checked = false;

            if (input) {
                input.value = (this.currentDeckTitle && this.currentDeckTitle !== 'Untitled Deck')
                    ? this.currentDeckTitle
                    : '';
            }
            this.openModal('name-modal');
            setTimeout(() => {
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 90);
        },

        manualSave() {
            if (this.currentDeckId) {
                const idx = this.library.findIndex((d) => d.id === this.currentDeckId);
                if (idx !== -1) {
                    this.library[idx].slides = deepClone(this.slides);
                    this.library[idx].title = this.currentDeckTitle;
                    this.library[idx].updated = Date.now();
                    this.hasUnsavedChanges = false;
                    this.persistLibraryLocal();
                    this.persistWorkspaceLocal();
                    this.syncToCloud();
                    this.updateDeckHeaderUI();
                    this.renderLibrary();
                    this.showToast(`Saved "${this.currentDeckTitle}"`, 'circle-check', 'success');
                    return;
                }
            }
            this.openSaveModal();
        },

        confirmSaveDeck() {
            const input = document.getElementById('deck-name-input');
            const copyCheck = document.getElementById('save-as-copy-checkbox');
            const rawTitle = (input ? input.value : '').trim();
            const title = (rawTitle || 'Untitled Deck').slice(0, 80);
            const saveAsCopy = Boolean(copyCheck && copyCheck.checked);

            let deckId = this.currentDeckId;
            if (!deckId || saveAsCopy || !this.library.some((d) => d.id === deckId)) {
                deckId = `deck_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            }

            const existingIdx = this.library.findIndex((d) => d.id === deckId);
            const record = {
                id: deckId,
                title,
                slides: deepClone(this.slides),
                updated: Date.now()
            };

            if (existingIdx !== -1) {
                this.library[existingIdx] = record;
            } else {
                this.library.unshift(record);
            }

            this.currentDeckId = deckId;
            this.currentDeckTitle = title;
            this.hasUnsavedChanges = false;

            this.persistLibraryLocal();
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.closeModal('name-modal');
            this.render();
            this.renderLibrary();
            this.showToast(`Deck saved: "${title}"`, 'circle-check', 'success');
        },

        async createNewDeck() {
            if (this.hasUnsavedChanges && this.slides.some((s) => s.text.trim() || s.image)) {
                const ok = await this.showModal('Start New Deck?', 'You have unsaved edits in your current workspace.', 'Start Fresh', 'file-plus');
                if (!ok) return;
            }
            this.pushHistory('new-deck');
            const prev = this.slides;
            this.currentDeckId = null;
            this.currentDeckTitle = 'Untitled Deck';
            this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            this.activeSlideIndex = 0;
            this.hasUnsavedChanges = false;

            prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.toggleLibraryDrawer(false);
            this.render();
            this.renderLibrary();
            this.showToast('Started a fresh deck', 'file-plus', 'blue');
        },

        loadDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;

            this.pushHistory('load-deck');
            this.slides = sanitizeDeckSchema(deepClone(deck.slides || []));
            if (!this.slides.length) {
                this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            }
            this.currentDeckId = deck.id;
            this.currentDeckTitle = deck.title || 'Untitled Deck';
            this.activeSlideIndex = 0;
            this.hasUnsavedChanges = false;

            this.persistWorkspaceLocal();
            this.toggleLibraryDrawer(false);
            this.render();
            this.renderLibrary();
            this.showToast(`Loaded "${this.currentDeckTitle}"`, 'folder-open', 'blue');
        },

        duplicateDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;
            const copy = {
                id: `deck_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                title: `${deck.title} (Copy)`.slice(0, 80),
                slides: deepClone(deck.slides || []),
                updated: Date.now()
            };
            this.library.unshift(copy);
            this.persistLibraryLocal();
            this.syncToCloud();
            this.renderLibrary();
            this.updateDeckHeaderUI();
            this.showToast(`Duplicated "${deck.title}"`, 'copy', 'success');
        },

        async deleteDeck(deckId) {
            const deck = this.library.find((d) => d.id === deckId);
            if (!deck) return;
            const ok = await this.showModal('Delete Saved Deck?', `Permanently delete "${deck.title}" from your Library?`, 'Delete', 'trash-2');
            if (!ok) return;

            const oldSlides = deck.slides || [];
            this.library = this.library.filter((d) => d.id !== deckId);

            if (this.currentDeckId === deckId) {
                this.currentDeckId = null;
                this.hasUnsavedChanges = true;
            }

            oldSlides.forEach((s) => {
                if (s && s.image) this.cleanupUnreferencedImage(s.image);
            });

            this.persistLibraryLocal();
            this.persistWorkspaceLocal();
            this.syncToCloud();
            this.renderLibrary();
            this.updateDeckHeaderUI();
            this.showToast(`Deleted "${deck.title}"`, 'trash-2', 'pink');
        },

        renderLibrary() {
            const list = document.getElementById('deck-list');
            const badge = document.getElementById('library-count-badge');
            if (badge) badge.textContent = String(this.library.length);
            if (!list) return;

            const searchEl = document.getElementById('library-search');
            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const filtered = query
                ? this.library.filter((d) => (d.title || '').toLowerCase().includes(query))
                : this.library;

            if (!filtered.length) {
                list.innerHTML = `
                    <div class="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2">
                        <i data-lucide="folder-open" class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto"></i>
                        <p class="text-xs font-extrabold text-slate-400">${query ? 'No decks match your search.' : 'No saved decks yet. Click Save to store your current deck!'}</p>
                    </div>
                `;
                this.safeCreateIcons();
                return;
            }

            list.innerHTML = filtered.map((deck) => {
                const isActive = deck.id === this.currentDeckId;
                const slideCount = Array.isArray(deck.slides) ? deck.slides.length : 0;
                const dateLabel = new Date(deck.updated || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `
                    <div data-deck-id="${escapeHTML(deck.id)}"
                        class="group p-3.5 rounded-2xl border-3 transition-all cursor-pointer flex items-center justify-between gap-2 ${isActive ? 'bg-blue/10 border-blue shadow-hard-sm' : 'bg-white dark:bg-slate-800 border-dark/75 dark:border-slate-600 hover:border-blue'}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                                ${isActive ? '<span class="w-2 h-2 rounded-full bg-blue flex-shrink-0"></span>' : ''}
                                <h3 class="text-sm font-extrabold truncate text-dark dark:text-white">${escapeHTML(deck.title || 'Untitled Deck')}</h3>
                            </div>
                            <p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">${slideCount} slide${slideCount === 1 ? '' : 's'} &middot; Updated ${escapeHTML(dateLabel)}</p>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button type="button" data-deck-action="duplicate" title="Duplicate deck"
                                aria-label="Duplicate deck"
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue hover:bg-blue/10 transition-colors cursor-pointer">
                                <i data-lucide="copy" class="w-4 h-4"></i>
                            </button>
                            <button type="button" data-deck-action="delete" title="Delete deck"
                                aria-label="Delete deck"
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink hover:bg-pink/10 transition-colors cursor-pointer">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        /* --- SLIDE CRUD --- */
        addSlide(atIndex) {
            this.pushHistory('add-slide');
            const slide = sanitizeSlide({
                id: createSlideId(),
                layout: 'hero',
                text: '',
                image: null,
                theme: 'auto',
                notes: ''
            }, this.slides.length);

            let insertIndex = this.slides.length;
            if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= this.slides.length) {
                insertIndex = atIndex;
            }
            this.slides.splice(insertIndex, 0, slide);
            this.activeSlideIndex = insertIndex;

            this.saveWorkspace();
            this.render();
            this.scrollToSlide(insertIndex, true);
        },

        setActiveSlide(index) {
            if (index < 0 || index >= this.slides.length) return;
            this.activeSlideIndex = index;

            // Update card highlight cleanly in DOM without destroying textarea focus
            document.querySelectorAll('#slides-list-container .slide-card').forEach((card) => {
                const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                card.classList.toggle('is-active', idx === index);
            });
            document.querySelectorAll('#slides-grid-container .grid-card').forEach((card) => {
                const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                card.classList.toggle('is-active', idx === index);
            });

            this.updateDeckHeaderUI();
        },

        scrollToSlide(index, focusInput = false) {
            setTimeout(() => {
                const card = document.querySelector(`#slides-list-container .slide-card[data-slide-index="${index}"]`);
                if (card) {
                    if (typeof card.scrollIntoView === 'function') {
                        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    if (focusInput) {
                        const ta = card.querySelector('[data-field="text"]');
                        if (ta) ta.focus();
                    }
                }
            }, 40);
        },

        updateSlideText(index, val) {
            const slide = this.slides[index];
            if (!slide) return;
            this.markTypingEdit();
            slide.text = String(val ?? '').slice(0, 4000);
            this.saveWorkspace();
        },

        updateSlideNotes(index, val) {
            const slide = this.slides[index];
            if (!slide) return;
            this.markTypingEdit();
            slide.notes = String(val ?? '').slice(0, 1500);
            this.saveWorkspace();
        },

        updateSlideLayout(index, layout) {
            const slide = this.slides[index];
            if (!slide || !SLIDE_LAYOUTS[layout] || slide.layout === layout) return;
            this.pushHistory('layout');
            slide.layout = layout;
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        updateSlideTheme(index, theme) {
            const slide = this.slides[index];
            if (!slide || !SLIDE_THEMES.some((t) => t.id === theme) || slide.theme === theme) return;
            this.pushHistory('theme');
            slide.theme = theme;
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        moveSlide(index, delta) {
            const target = index + delta;
            if (target < 0 || target >= this.slides.length) return;
            this.pushHistory('move');
            const [item] = this.slides.splice(index, 1);
            this.slides.splice(target, 0, item);
            this.activeSlideIndex = target;
            this.saveWorkspace();
            this.render();
            this.scrollToSlide(target, false);
        },

        duplicateSlide(index) {
            const src = this.slides[index];
            if (!src) return;
            this.pushHistory('duplicate');
            const copy = sanitizeSlide({
                ...deepClone(src),
                id: createSlideId()
            }, index + 1);
            this.slides.splice(index + 1, 0, copy);
            this.activeSlideIndex = index + 1;
            this.saveWorkspace();
            this.render();
            this.showToast('Slide duplicated!', 'circle-check', 'success');
        },

        deleteSlide(index) {
            if (index < 0 || index >= this.slides.length) return;
            this.pushHistory('delete');
            const [removed] = this.slides.splice(index, 1);
            if (removed && removed.image) {
                this.cleanupUnreferencedImage(removed.image);
            }
            if (!this.slides.length) {
                this.activeSlideIndex = 0;
            } else {
                this.activeSlideIndex = Math.min(index, this.slides.length - 1);
            }
            this.saveWorkspace();
            this.render();
        },

        /* --- MEDIA PIPELINE --- */
        triggerImageUpload(index) {
            this.activeUploadIndex = index;
            const input = document.getElementById('imageInput');
            if (input) input.click();
        },

        openImageUrlModal(index) {
            const slide = this.slides[index];
            if (!slide) return;
            this.activeUrlSlideIndex = index;
            const input = document.getElementById('image-url-input');
            const errEl = document.getElementById('image-url-error');
            if (errEl) errEl.classList.add('is-hidden');
            if (input) {
                input.value = (slide.image && /^https?:\/\//i.test(slide.image)) ? slide.image : '';
            }
            this.openModal('image-url-modal');
            setTimeout(() => { if (input) input.focus(); }, 80);
        },

        applyImageUrl() {
            const input = document.getElementById('image-url-input');
            const errEl = document.getElementById('image-url-error');
            const raw = (input ? input.value : '').trim();
            const safeUrl = sanitizeImageUrl(raw);

            if (!safeUrl || safeUrl.startsWith('klasskit-local:')) {
                if (errEl) errEl.classList.remove('is-hidden');
                return;
            }

            if (errEl) errEl.classList.add('is-hidden');
            const idx = this.activeUrlSlideIndex;
            const slide = this.slides[idx];
            if (!slide) return;

            this.pushHistory('image-url');
            const oldImg = slide.image;
            slide.image = safeUrl;
            this.registerManagedImage({
                src: safeUrl,
                name: slide.text?.trim() ? slide.text.trim().slice(0, 80) : safeUrl,
                caption: slide.text?.trim() || ''
            });
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== safeUrl) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = idx;
            this.closeModal('image-url-modal');
            this.saveWorkspace();
            this.render();
            this.showToast('Image link added!', 'image', 'success');
        },

        async compressImageFile(file) {
            if (!file) return file;
            if (file.type === 'image/gif' || file.size < 120 * 1024) return file;
            if (typeof window.imageCompression === 'function') {
                try {
                    return await window.imageCompression(file, {
                        maxSizeMB: 0.7,
                        maxWidthOrHeight: 1600,
                        useWebWorker: true
                    });
                } catch (e) {
                    return file;
                }
            }
            return file;
        },

        async persistProcessedImageFile(file) {
            const processed = await this.compressImageFile(file);

            let finalRef = null;
            try {
                const user = (typeof getCloudUser === 'function') ? await getCloudUser() : null;
                if (user && typeof uploadMedia === 'function') {
                    finalRef = await uploadMedia(processed, 'presentation_maker', 'slide_img');
                }
            } catch (e) {
                console.warn('Cloud image upload unavailable, using IndexedDB fallback:', e);
            }

            if (!finalRef) {
                const seq = ++this._imgKeySeq;
                const key = `img_${Date.now()}_${seq}_${Math.floor(Math.random() * 1000)}`;
                finalRef = await LocalDB.save(key, processed);
                if (!finalRef && typeof FileReader !== 'undefined') {
                    // Ultra fallback: FileReader dataURL for environments without IndexedDB
                    finalRef = await new Promise((res) => {
                        const fr = new FileReader();
                        fr.onload = () => res(sanitizeImageUrl(String(fr.result || '')));
                        fr.onerror = () => res(null);
                        fr.readAsDataURL(processed);
                    });
                }
            }

            return finalRef;
        },

        async handleImageFile(file, index) {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                this.showToast('Please select an image file.', 'triangle-alert', 'orange');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                this.showToast('Image file exceeds 20MB limit.', 'triangle-alert', 'orange');
                return;
            }
            const slide = this.slides[index];
            if (!slide) return;

            this.showToast('Processing image...', 'loader-circle', 'blue');
            const finalRef = await this.persistProcessedImageFile(file);

            if (!finalRef) {
                this.showToast('Could not save image.', 'circle-alert', 'pink');
                return;
            }

            this.pushHistory('image-upload');
            const oldImg = slide.image;
            slide.image = finalRef;
            this.registerManagedImage({
                src: finalRef,
                name: file.name || `Slide ${index + 1} Image`,
                caption: formatFilenameAsCaption(file.name)
            });
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== finalRef) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
            this.showToast('Image attached!', 'image', 'success');
        },

        removeImage(index) {
            const slide = this.slides[index];
            if (!slide || !slide.image) return;
            this.pushHistory('remove-image');
            const oldImg = slide.image;
            slide.image = null;
            this.cleanupUnreferencedImage(oldImg);
            this.activeSlideIndex = index;
            this.saveWorkspace();
            this.render();
        },

        /* --- PERSISTENT IMAGE MANAGER & UPLOAD MODAL --- */
        registerManagedImage({ src, name, caption }) {
            const safeSrc = sanitizeImageUrl(src);
            if (!safeSrc) return null;

            const cleanCaption = String(caption || '').trim().slice(0, 200);
            const cleanName = String(name || cleanCaption || '').trim().slice(0, 120);

            const existing = this.imageLibrary.find((img) => img && img.src === safeSrc);
            if (existing) {
                if (cleanCaption && !existing.caption) existing.caption = cleanCaption;
                if (cleanName && (!existing.name || existing.name.startsWith('Saved Image'))) existing.name = cleanName;
                this.persistImageLibraryLocal();
                return existing;
            }

            const record = {
                id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                src: safeSrc,
                name: cleanName || cleanCaption || `Saved Image ${this.imageLibrary.length + 1}`,
                caption: cleanCaption,
                addedAt: Date.now()
            };
            this.imageLibrary.unshift(record);
            if (this.imageLibrary.length > 300) {
                this.imageLibrary.length = 300;
            }
            this.persistImageLibraryLocal();
            return record;
        },

        registerImagesFromSlides(slideList, labelPrefix = 'Slide') {
            if (!Array.isArray(slideList)) return;
            let added = false;
            slideList.forEach((slide, idx) => {
                if (!slide || !slide.image) return;
                const safeSrc = sanitizeImageUrl(slide.image);
                if (!safeSrc || this.imageLibrary.some((img) => img && img.src === safeSrc)) return;
                const cap = (slide.text || '').split('\n')[0].trim().slice(0, 120);
                this.imageLibrary.unshift({
                    id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                    src: safeSrc,
                    name: cap || `${labelPrefix} ${idx + 1} Image`,
                    caption: cap,
                    addedAt: Date.now()
                });
                added = true;
            });
            if (this.imageLibrary.length > 300) {
                this.imageLibrary.length = 300;
            }
            if (added) this.persistImageLibraryLocal();
        },

        syncSlidesIntoImageLibrary() {
            let added = false;
            const addIfMissing = (slide, fallbackLabel) => {
                if (!slide || !slide.image) return;
                const safeSrc = sanitizeImageUrl(slide.image);
                if (!safeSrc || this.imageLibrary.some((img) => img.src === safeSrc)) return;
                const cap = (slide.text || '').split('\n')[0].trim().slice(0, 120);
                this.imageLibrary.push({
                    id: `asset_${Date.now()}_${++this._imgKeySeq}`,
                    src: safeSrc,
                    name: cap || fallbackLabel,
                    caption: cap,
                    addedAt: Date.now()
                });
                added = true;
            };

            this.slides.forEach((s, idx) => addIfMissing(s, `Slide ${idx + 1} Image`));
            this.library.forEach((deck) => {
                (deck.slides || []).forEach((s, idx) => addIfMissing(s, `${deck.title || 'Deck'} #${idx + 1}`));
            });
            if (added) this.persistImageLibraryLocal();
        },

        revokeBulkPreviewUrl(item) {
            if (item && item.previewUrl && String(item.previewUrl).startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
                try { URL.revokeObjectURL(item.previewUrl); } catch (e) { }
            }
        },

        openImageManagerModal(opts = {}) {
            const { targetSlideIndex } = (opts && typeof opts === 'object') ? opts : {};
            const hasTarget = Number.isInteger(targetSlideIndex) && targetSlideIndex >= 0 && targetSlideIndex < this.slides.length;
            this.imageManagerTargetSlide = hasTarget ? targetSlideIndex : null;
            this.selectedManagedImageIds.clear();

            const searchEl = document.getElementById('img-mgr-search');
            if (searchEl) searchEl.value = '';

            this.syncImageManagerHeader();
            this.renderImageManagerGallery();
            this.openModal('image-manager-modal');
        },

        openUploadImageModal(opts = {}) {
            const { targetSlideIndex, initialFiles } = (opts && typeof opts === 'object') ? opts : {};
            const hasTarget = Number.isInteger(targetSlideIndex) && targetSlideIndex >= 0 && targetSlideIndex < this.slides.length;
            this.uploadImageTargetSlide = hasTarget ? targetSlideIndex : null;

            const modeSelect = document.getElementById('bulk-img-mode');
            const urlPanel = document.getElementById('bulk-img-url-panel');
            const urlInput = document.getElementById('bulk-img-urls-input');
            const progressWrap = document.getElementById('bulk-img-progress-wrap');
            const progressBar = document.getElementById('bulk-img-progress-bar');
            const statusEl = document.getElementById('bulk-img-status');

            this.bulkImageImporting = false;
            if (modeSelect) {
                modeSelect.value = hasTarget ? 'append' : 'manager-only';
            }
            if (urlPanel) urlPanel.classList.add('is-hidden');
            if (urlInput) urlInput.value = '';
            if (progressWrap) progressWrap.classList.add('is-hidden');
            if (progressBar) progressBar.style.width = '0%';
            if (statusEl) statusEl.textContent = 'Ready — add images above to save into your Image Manager.';

            this.clearBulkImageQueue();
            if (initialFiles && initialFiles.length) {
                this.addBulkImageFiles(initialFiles);
            } else {
                this.renderBulkImageQueue();
            }

            this.syncUploadImageHeader();
            this.openModal('upload-image-modal');
        },

        openImageManager(opts = {}) {
            if (opts && opts.tab === 'upload') {
                this.openUploadImageModal(opts);
                return;
            }
            this.openImageManagerModal(opts);
        },

        openBulkImagesModal(initialFiles = null) {
            this.openUploadImageModal({ initialFiles });
        },

        closeImageManager() {
            this.imageManagerTargetSlide = null;
            this.selectedManagedImageIds.clear();
            this.closeModal('image-manager-modal');
        },

        closeUploadImageModal() {
            if (this.bulkImageImporting) {
                this.showToast('Please wait for image upload to finish.', 'loader-circle', 'orange');
                return;
            }
            this.clearBulkImageQueue();
            this.uploadImageTargetSlide = null;
            const urlPanel = document.getElementById('bulk-img-url-panel');
            if (urlPanel) urlPanel.classList.add('is-hidden');
            this.closeModal('upload-image-modal');
        },

        closeBulkImagesModal() {
            this.closeUploadImageModal();
        },

        switchToUploadModalFromManager() {
            const targetIdx = this.imageManagerTargetSlide;
            this.closeImageManager();
            this.openUploadImageModal({ targetSlideIndex: targetIdx });
        },

        switchToManagerFromUpload() {
            if (this.bulkImageImporting) return;
            const targetIdx = this.uploadImageTargetSlide;
            this.closeUploadImageModal();
            this.openImageManagerModal({ targetSlideIndex: targetIdx });
        },

        setImageManagerTarget(slideIdx) {
            this.imageManagerTargetSlide = Number.isInteger(slideIdx) ? slideIdx : null;
            this.syncImageManagerHeader();
            this.renderImageManagerGallery();
        },

        syncImageManagerHeader() {
            const titleEl = document.getElementById('img-mgr-title');
            const subEl = document.getElementById('img-mgr-subtitle');
            const bannerEl = document.getElementById('img-mgr-picker-banner');
            const bannerText = document.getElementById('img-mgr-picker-text');
            const selectActions = document.getElementById('img-mgr-select-actions');
            const galleryFooter = document.getElementById('img-mgr-gallery-footer');

            const isPicker = this.imageManagerTargetSlide !== null;
            if (titleEl) {
                titleEl.textContent = isPicker
                    ? `Slide #${this.imageManagerTargetSlide + 1} · Pick Saved Image`
                    : 'Image Manager';
            }
            if (subEl) {
                subEl.textContent = isPicker
                    ? 'Click any saved image below to place it on this slide'
                    : 'Saved images stay safe even when slides are deleted';
            }
            if (bannerEl) bannerEl.classList.toggle('is-hidden', !isPicker);
            if (bannerText && isPicker) {
                bannerText.textContent = `Picking saved image for Slide #${this.imageManagerTargetSlide + 1}.`;
            }
            if (selectActions) selectActions.classList.toggle('is-hidden', isPicker);
            if (galleryFooter) galleryFooter.classList.toggle('is-hidden', isPicker);
        },

        syncUploadImageHeader() {
            const titleEl = document.getElementById('upload-img-title');
            const subEl = document.getElementById('upload-img-subtitle');
            const bannerEl = document.getElementById('upload-img-picker-banner');
            const bannerText = document.getElementById('upload-img-picker-text');

            const isPicker = this.uploadImageTargetSlide !== null;
            if (titleEl) {
                titleEl.textContent = isPicker
                    ? `Upload Image · Slide #${this.uploadImageTargetSlide + 1}`
                    : 'Upload Image';
            }
            if (subEl) {
                subEl.textContent = isPicker
                    ? 'Upload a new photo to attach and save into your Image Manager'
                    : 'Uploaded photos are stored safely in your Image Manager';
            }
            if (bannerEl) bannerEl.classList.toggle('is-hidden', !isPicker);
            if (bannerText && isPicker) {
                bannerText.textContent = `Uploading image for Slide #${this.uploadImageTargetSlide + 1}.`;
            }
        },

        renderImageManagerGallery() {
            const galleryEl = document.getElementById('img-mgr-gallery');
            const searchEl = document.getElementById('img-mgr-search');
            const selStatus = document.getElementById('img-mgr-selection-status');
            const createBtn = document.getElementById('img-mgr-create-slides-btn');
            const delAllBtn = document.getElementById('img-mgr-delete-all-btn');

            if (delAllBtn) delAllBtn.disabled = this.imageLibrary.length === 0;
            if (!galleryEl) return;

            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const items = query
                ? this.imageLibrary.filter((img) =>
                    (img.name || '').toLowerCase().includes(query) ||
                    (img.caption || '').toLowerCase().includes(query))
                : this.imageLibrary;

            const isPicker = this.imageManagerTargetSlide !== null;

            if (!items.length) {
                galleryEl.innerHTML = `
                    <div class="col-span-full p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2.5">
                        <i data-lucide="images" class="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto"></i>
                        <p class="text-xs font-extrabold text-slate-400">
                            ${query ? 'No saved images match your search.' : 'Your Image Manager is empty. Click Upload Image to add photos once and reuse them across slides!'}
                        </p>
                    </div>
                `;
                if (selStatus) selStatus.textContent = '0 selected — saved images persist even if you delete slides';
                if (createBtn) createBtn.disabled = true;
                this.safeCreateIcons();
                return;
            }

            const activeUsageMap = new Map();
            this.slides.forEach((s) => {
                if (s && s.image) activeUsageMap.set(s.image, (activeUsageMap.get(s.image) || 0) + 1);
            });

            galleryEl.innerHTML = items.map((asset) => {
                const isSelected = !isPicker && this.selectedManagedImageIds.has(asset.id);
                const cached = this.getCachedMediaSrc(asset.src);
                const srcAttr = cached ? ` src="${escapeHTML(cached)}" class="is-loaded"` : '';
                const useCount = activeUsageMap.get(asset.src) || 0;
                const label = asset.caption || asset.name || 'Saved Image';

                return `
                    <div class="img-mgr-card cursor-pointer ${isSelected ? 'is-selected' : ''}" data-asset-id="${escapeHTML(asset.id)}">
                        <div class="bulk-img-thumb">
                            <img data-media-src="${escapeHTML(asset.src)}"${srcAttr} alt="${escapeHTML(label)}" />
                            ${useCount > 0 ? `<span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-blue text-white text-[10px] font-heading font-bold">In ${useCount} slide${useCount === 1 ? '' : 's'}</span>` : ''}
                            <button type="button" data-gallery-action="delete" title="Delete from Image Manager" aria-label="Delete saved image"
                                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-pink text-white border border-dark flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                        <div class="p-2.5 flex-1 flex flex-col justify-between gap-2">
                            <p class="text-xs font-extrabold text-dark dark:text-white truncate" title="${escapeHTML(label)}">${escapeHTML(label)}</p>
                            <div class="flex items-center justify-between gap-1.5">
                                ${isPicker ? `
                                    <button type="button" data-gallery-action="use"
                                        class="w-full py-1 px-2 rounded-lg bg-blue text-white text-[11px] font-heading font-bold uppercase tracking-wide hover:brightness-105 transition-all cursor-pointer">
                                        Use on Slide #${this.imageManagerTargetSlide + 1}
                                    </button>
                                ` : `
                                    <button type="button" data-gallery-action="toggle-select"
                                        class="px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer ${isSelected ? 'bg-green text-white border-green' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-slate-300 dark:border-slate-600'}">
                                        ${isSelected ? 'Selected' : 'Select'}
                                    </button>
                                    <button type="button" data-gallery-action="use" title="${this.slides.length ? `Use on active Slide #${this.activeSlideIndex + 1}` : 'Create Slide #1 with this image'}"
                                        class="px-2 py-1 rounded-lg bg-blue/15 text-blue hover:bg-blue hover:text-white text-[10px] font-black uppercase tracking-wide transition-colors cursor-pointer">
                                        + Slide
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const selCount = this.selectedManagedImageIds.size;
            if (selStatus) {
                selStatus.textContent = selCount > 0
                    ? `${selCount} saved image${selCount === 1 ? '' : 's'} selected`
                    : `${this.imageLibrary.length} saved image${this.imageLibrary.length === 1 ? '' : 's'} — persist even if you delete slides`;
            }
            if (createBtn) {
                createBtn.disabled = selCount === 0;
                const span = createBtn.querySelector('span');
                if (span) span.textContent = selCount > 0 ? `Add ${selCount} to Slides` : 'Add Selected to Slides';
            }

            this.safeCreateIcons();
            this.hydrateMediaElements(galleryEl, 'img-manager');
        },

        pickManagedImageForSlide(assetId, explicitTargetIdx) {
            const record = this.imageLibrary.find((img) => img.id === assetId);
            if (!record) return;

            if (!this.slides.length) this.addSlide();
            const targetIdx = Number.isInteger(explicitTargetIdx)
                ? explicitTargetIdx
                : (this.imageManagerTargetSlide !== null ? this.imageManagerTargetSlide : this.activeSlideIndex);
            const safeIdx = Math.max(0, Math.min(targetIdx, this.slides.length - 1));
            const slide = this.slides[safeIdx];
            if (!slide) return;

            this.pushHistory('pick-managed-image');
            const oldImg = slide.image;
            slide.image = record.src;
            if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                slide.layout = 'split';
            }
            if (oldImg && oldImg !== record.src) {
                this.cleanupUnreferencedImage(oldImg);
            }
            this.activeSlideIndex = safeIdx;
            this.saveWorkspace();
            this.closeImageManager();
            this.render();
            this.showToast(`Applied image to Slide #${safeIdx + 1}`, 'image', 'success');
        },

        toggleManagedImageSelection(assetId) {
            if (this.selectedManagedImageIds.has(assetId)) {
                this.selectedManagedImageIds.delete(assetId);
            } else {
                this.selectedManagedImageIds.add(assetId);
            }
            this.renderImageManagerGallery();
        },

        toggleSelectAllManagedImages() {
            const searchEl = document.getElementById('img-mgr-search');
            const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
            const visible = query
                ? this.imageLibrary.filter((img) =>
                    (img.name || '').toLowerCase().includes(query) ||
                    (img.caption || '').toLowerCase().includes(query))
                : this.imageLibrary;

            const allSelected = visible.length > 0 && visible.every((img) => this.selectedManagedImageIds.has(img.id));
            if (allSelected) {
                visible.forEach((img) => this.selectedManagedImageIds.delete(img.id));
            } else {
                visible.forEach((img) => this.selectedManagedImageIds.add(img.id));
            }
            this.renderImageManagerGallery();
        },

        clearManagedImageSelection() {
            this.selectedManagedImageIds.clear();
            this.renderImageManagerGallery();
        },

        createSlidesFromSelectedManagedImages() {
            const chosen = this.imageLibrary.filter((img) => this.selectedManagedImageIds.has(img.id));
            if (!chosen.length) return;

            const layoutVal = document.getElementById('img-mgr-gallery-layout')?.value || 'caption';
            const mode = document.getElementById('img-mgr-gallery-mode')?.value || 'append';
            const layout = ['caption', 'split', 'full'].includes(layoutVal) ? layoutVal : 'caption';

            this.applyImageEntriesToSlides(
                chosen.map((img) => ({ image: img.src, text: img.caption || img.name || '' })),
                { layout, theme: 'auto', mode, reason: 'manager-batch-slides' }
            );

            this.selectedManagedImageIds.clear();
            this.closeImageManager();
            this.saveWorkspace();
            this.render();
            this.showToast(`Added ${chosen.length} slide${chosen.length === 1 ? '' : 's'} from Image Manager!`, 'images', 'success');
        },

        purgeManagedUrls(urlSet) {
            if (!urlSet || !urlSet.size) return;

            let clearedSlide = false;
            this.slides.forEach((s) => {
                if (s && s.image && urlSet.has(s.image)) {
                    s.image = null;
                    clearedSlide = true;
                }
            });

            // Prune permanently deleted URLs from undo/redo snapshots so deleted assets free IDB storage immediately
            [this.undoStack, this.redoStack].forEach((stack) => {
                stack.forEach((snap) => {
                    if (!snap || !Array.isArray(snap.slides)) return;
                    snap.slides.forEach((s) => {
                        if (s && s.image && urlSet.has(s.image)) s.image = null;
                    });
                });
            });

            if (clearedSlide) this.saveWorkspace();
            urlSet.forEach((url) => this.cleanupUnreferencedImage(url));
            this.render();
            this.syncToCloud();

            if (document.getElementById('image-manager-modal')?.classList.contains('open')) {
                this.renderImageManagerGallery();
            }
        },

        async deleteManagedImage(assetId) {
            const idx = this.imageLibrary.findIndex((img) => img.id === assetId);
            if (idx === -1) return;
            const record = this.imageLibrary[idx];
            const inSlidesCount = this.slides.filter((s) => s && s.image === record.src).length;

            const desc = inSlidesCount > 0
                ? `"${record.name}" is used in ${inSlidesCount} active slide${inSlidesCount === 1 ? '' : 's'}. Deleting it permanently removes it from those slides and your Image Manager.`
                : `Permanently delete "${record.name}" from your Image Manager?`;

            const ok = await this.showModal('Delete Saved Image?', desc, 'Delete Image', 'trash-2');
            if (!ok) return;

            this.imageLibrary.splice(idx, 1);
            this.selectedManagedImageIds.delete(assetId);
            this.persistImageLibraryLocal();

            this.purgeManagedUrls(new Set([record.src]));
            this.showToast(`Removed "${record.name}" from Image Manager`, 'trash-2', 'pink');
        },

        async deleteAllManagedImages() {
            const count = this.imageLibrary.length;
            if (!count) return;

            const savedUrls = new Set(this.imageLibrary.map((img) => img && img.src).filter(Boolean));
            const inSlidesCount = this.slides.filter((s) => s && s.image && savedUrls.has(s.image)).length;
            const desc = inSlidesCount > 0
                ? `Permanently delete all ${count} saved image${count === 1 ? '' : 's'}? This will also clear images from ${inSlidesCount} active slide${inSlidesCount === 1 ? '' : 's'}.`
                : `Permanently delete all ${count} saved image${count === 1 ? '' : 's'} from your Image Manager?`;

            const ok = await this.showModal('Delete All Saved Images?', desc, 'Yes, Delete All', 'trash-2');
            if (!ok) return;

            this.imageLibrary = [];
            this.selectedManagedImageIds.clear();
            this.persistImageLibraryLocal();

            this.purgeManagedUrls(savedUrls);
            this.showToast('Deleted all saved images from Image Manager', 'trash-2', 'pink');
        },

        applyImageEntriesToSlides(resolvedEntries, { layout, theme, mode, reason }) {
            this.pushHistory(reason || 'bulk-images');

            const makeSlide = (entry, offset) => sanitizeSlide({
                id: createSlideId() + offset,
                layout,
                theme,
                text: entry.text,
                image: entry.image,
                notes: ''
            }, offset);

            const oldReplacedImages = [];

            if (mode === 'replace') {
                this.slides.forEach((s) => { if (s.image) oldReplacedImages.push(s.image); });
                this.slides = resolvedEntries.map((entry, i) => makeSlide(entry, i));
                this.activeSlideIndex = 0;
            } else if (mode === 'attach') {
                resolvedEntries.forEach((entry, i) => {
                    if (i < this.slides.length) {
                        const existing = this.slides[i];
                        if (existing.image && existing.image !== entry.image) {
                            oldReplacedImages.push(existing.image);
                        }
                        existing.image = entry.image;
                        if (!SLIDE_LAYOUTS[existing.layout]?.usesImage) {
                            existing.layout = layout;
                        }
                        if (!existing.text.trim() && entry.text) {
                            existing.text = entry.text;
                        }
                    } else {
                        this.slides.push(makeSlide(entry, i));
                    }
                });
                this.activeSlideIndex = 0;
            } else {
                const isOnlyEmpty = this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image;
                const generated = resolvedEntries.map((entry, i) => makeSlide(entry, i));
                if (isOnlyEmpty) {
                    this.slides = generated;
                    this.activeSlideIndex = 0;
                } else {
                    const startIdx = this.slides.length;
                    this.slides = this.slides.concat(generated);
                    this.activeSlideIndex = startIdx;
                }
            }

            oldReplacedImages.forEach((url) => this.cleanupUnreferencedImage(url));
        },

        triggerBulkImagesBrowse() {
            if (this.bulkImageImporting) return;
            const input = document.getElementById('bulkImagesInput');
            if (input) input.click();
        },

        toggleBulkImageUrlPanel(force) {
            const panel = document.getElementById('bulk-img-url-panel');
            if (!panel) return;
            const show = typeof force === 'boolean' ? force : panel.classList.contains('is-hidden');
            panel.classList.toggle('is-hidden', !show);
            if (show) {
                const ta = document.getElementById('bulk-img-urls-input');
                if (ta) setTimeout(() => ta.focus(), 60);
            }
        },

        toggleBulkImageUseNames() {
            const useNames = Boolean(document.getElementById('bulk-img-use-names')?.checked);
            this.bulkImageQueue.forEach((item) => {
                if (item.customCaption) return;
                if (item.kind === 'file') {
                    item.caption = useNames ? formatFilenameAsCaption(item.name) : '';
                }
            });
            this.renderBulkImageQueue();
        },

        addBulkImageFiles(fileList) {
            if (this.bulkImageImporting) return;
            const files = Array.from(fileList || []);
            if (!files.length) return;

            const MAX_BATCH = 60;
            const useNames = Boolean(document.getElementById('bulk-img-use-names')?.checked);

            const sorted = files.slice().sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
            );

            let added = 0;
            let skippedInvalid = 0;
            let skippedLimit = 0;

            sorted.forEach((file) => {
                if (!file || !file.type || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
                    skippedInvalid++;
                    return;
                }
                if (this.bulkImageQueue.length >= MAX_BATCH) {
                    skippedLimit++;
                    return;
                }
                const previewUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
                    ? URL.createObjectURL(file)
                    : null;

                this.bulkImageQueue.push({
                    id: createSlideId() + added,
                    kind: 'file',
                    file,
                    name: file.name || `Image ${this.bulkImageQueue.length + 1}`,
                    url: null,
                    previewUrl,
                    caption: useNames ? formatFilenameAsCaption(file.name) : '',
                    customCaption: false
                });
                added++;
            });

            if (skippedInvalid > 0) {
                this.showToast(`Skipped ${skippedInvalid} non-image or >20MB file(s).`, 'triangle-alert', 'orange');
            }
            if (skippedLimit > 0) {
                this.showToast(`Queue limit reached (${MAX_BATCH} images max).`, 'triangle-alert', 'orange');
            }
            if (added > 0) {
                const statusEl = document.getElementById('bulk-img-status');
                if (statusEl) statusEl.textContent = `Staged ${this.bulkImageQueue.length} image${this.bulkImageQueue.length === 1 ? '' : 's'} ready to import.`;
            }
            this.renderBulkImageQueue();
        },

        addBulkImageUrls() {
            if (this.bulkImageImporting) return;
            const ta = document.getElementById('bulk-img-urls-input');
            if (!ta) return;

            const MAX_BATCH = 60;
            const { entries, invalidCount } = parseBulkImageUrls(ta.value);
            let added = 0;
            let skippedLimit = 0;

            entries.forEach((entry) => {
                if (this.bulkImageQueue.length >= MAX_BATCH) {
                    skippedLimit++;
                    return;
                }
                this.bulkImageQueue.push({
                    id: createSlideId() + added,
                    kind: 'url',
                    file: null,
                    name: entry.caption || entry.url,
                    url: entry.url,
                    previewUrl: entry.url,
                    caption: entry.caption || '',
                    customCaption: Boolean(entry.caption)
                });
                added++;
            });

            if (added > 0) {
                ta.value = '';
                this.toggleBulkImageUrlPanel(false);
                const statusEl = document.getElementById('bulk-img-status');
                if (statusEl) statusEl.textContent = `Staged ${this.bulkImageQueue.length} image${this.bulkImageQueue.length === 1 ? '' : 's'} ready to import.`;
            }
            if (invalidCount > 0) {
                this.showToast(`Skipped ${invalidCount} invalid or unsupported URL(s).`, 'triangle-alert', 'orange');
            } else if (skippedLimit > 0) {
                this.showToast(`Queue limit reached (${MAX_BATCH} images max).`, 'triangle-alert', 'orange');
            } else if (added === 0) {
                this.showToast('Paste at least one valid https:// image link.', 'info', 'blue');
            }

            this.renderBulkImageQueue();
        },

        updateBulkImageCaption(idx, val) {
            const item = this.bulkImageQueue[idx];
            if (!item) return;
            item.caption = String(val ?? '').slice(0, 500);
            item.customCaption = true;
        },

        moveBulkImageItem(idx, delta) {
            if (this.bulkImageImporting) return;
            const target = idx + delta;
            if (idx < 0 || idx >= this.bulkImageQueue.length || target < 0 || target >= this.bulkImageQueue.length) return;
            const [item] = this.bulkImageQueue.splice(idx, 1);
            this.bulkImageQueue.splice(target, 0, item);
            this.renderBulkImageQueue();
        },

        removeBulkImageItem(idx) {
            if (this.bulkImageImporting) return;
            if (idx < 0 || idx >= this.bulkImageQueue.length) return;
            const [removed] = this.bulkImageQueue.splice(idx, 1);
            this.revokeBulkPreviewUrl(removed);
            this.renderBulkImageQueue();
        },

        sortBulkImageQueue() {
            if (this.bulkImageImporting || this.bulkImageQueue.length < 2) return;
            this.bulkImageQueue.sort((a, b) => {
                const aKey = String(a.name || a.caption || '');
                const bKey = String(b.name || b.caption || '');
                return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
            });
            this.renderBulkImageQueue();
        },

        clearBulkImageQueue() {
            if (this.bulkImageImporting) return;
            this.bulkImageQueue.forEach((item) => this.revokeBulkPreviewUrl(item));
            this.bulkImageQueue = [];
            this.renderBulkImageQueue();
        },

        renderBulkImageQueue() {
            const queueEl = document.getElementById('bulk-img-queue');
            const countEl = document.getElementById('bulk-img-queue-count');
            const confirmBtn = document.getElementById('bulk-img-confirm-btn');
            const confirmLabel = document.getElementById('bulk-img-confirm-label');
            const mode = document.getElementById('bulk-img-mode')?.value || 'manager-only';

            const count = this.bulkImageQueue.length;
            if (countEl) countEl.textContent = `${count} image${count === 1 ? '' : 's'} queued`;
            if (confirmBtn) confirmBtn.disabled = count === 0 || this.bulkImageImporting;
            if (confirmLabel) {
                if (this.uploadImageTargetSlide !== null && count === 1 && mode !== 'manager-only') {
                    confirmLabel.textContent = `Save & Use on Slide #${this.uploadImageTargetSlide + 1}`;
                } else {
                    confirmLabel.textContent = count > 0 ? `Upload ${count} Image${count === 1 ? '' : 's'}` : 'Upload Images';
                }
            }

            if (!queueEl) return;
            if (!count) {
                queueEl.innerHTML = `
                    <div class="col-span-full p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-400">
                        No images queued yet. Drop files above or paste URLs to stage them for upload.
                    </div>
                `;
                this.safeCreateIcons();
                return;
            }

            queueEl.innerHTML = this.bulkImageQueue.map((item, idx) => {
                const thumbHtml = item.previewUrl
                    ? `<img src="${escapeHTML(item.previewUrl)}" alt="${escapeHTML(item.name || `Image ${idx + 1}`)}" />`
                    : `<div class="w-full h-full flex items-center justify-center text-slate-400"><i data-lucide="image" class="w-6 h-6"></i></div>`;

                return `
                    <div class="bulk-img-item" data-bulk-img-idx="${idx}">
                        <div class="bulk-img-thumb">
                            ${thumbHtml}
                            <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-dark/85 text-white text-[10px] font-heading font-bold">#${idx + 1}</span>
                            <button type="button" data-bulk-img-action="remove" title="Remove from queue" aria-label="Remove image ${idx + 1}"
                                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-pink text-white border border-dark flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                        <div class="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                            <input type="text" data-bulk-img-caption value="${escapeHTML(item.caption || '')}"
                                placeholder="Image label / caption (optional)" class="bulk-img-caption" />
                            <div class="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-400">
                                <span class="truncate" title="${escapeHTML(item.name || '')}">${escapeHTML(item.name || '')}</span>
                                <div class="flex items-center gap-0.5 flex-shrink-0">
                                    <button type="button" data-bulk-img-action="move-prev" ${idx === 0 ? 'disabled' : ''} title="Move earlier"
                                        aria-label="Move earlier" class="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer">
                                        <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button type="button" data-bulk-img-action="move-next" ${idx === count - 1 ? 'disabled' : ''} title="Move later"
                                        aria-label="Move later" class="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer">
                                        <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        async confirmBulkImageImport() {
            if (this.bulkImageImporting || !this.bulkImageQueue.length) return;

            const mode = document.getElementById('bulk-img-mode')?.value || 'manager-only';

            const progressWrap = document.getElementById('bulk-img-progress-wrap');
            const progressBar = document.getElementById('bulk-img-progress-bar');
            const statusEl = document.getElementById('bulk-img-status');
            const confirmBtn = document.getElementById('bulk-img-confirm-btn');

            this.bulkImageImporting = true;
            if (confirmBtn) confirmBtn.disabled = true;
            if (progressWrap) progressWrap.classList.remove('is-hidden');

            const total = this.bulkImageQueue.length;
            const resolvedEntries = [];
            let failedCount = 0;

            for (let i = 0; i < total; i++) {
                const item = this.bulkImageQueue[i];
                if (statusEl) statusEl.textContent = `Processing ${i + 1} / ${total}: ${item.name || 'image'}...`;
                if (progressBar) progressBar.style.width = `${Math.round(((i + 0.35) / total) * 100)}%`;

                let imageRef = null;
                if (item.kind === 'file' && item.file) {
                    imageRef = await this.persistProcessedImageFile(item.file);
                } else if (item.kind === 'url' && item.url) {
                    imageRef = sanitizeImageUrl(item.url);
                }

                if (imageRef) {
                    const captionText = String(item.caption || '').trim();
                    this.registerManagedImage({
                        src: imageRef,
                        name: item.name || captionText || `Image ${i + 1}`,
                        caption: captionText
                    });
                    resolvedEntries.push({
                        image: imageRef,
                        text: captionText
                    });
                } else {
                    failedCount++;
                }

                if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
            }

            this.bulkImageImporting = false;

            if (!resolvedEntries.length) {
                if (confirmBtn) confirmBtn.disabled = false;
                if (statusEl) statusEl.textContent = 'Upload failed — no images could be saved.';
                this.showToast('Could not upload any images.', 'circle-alert', 'pink');
                return;
            }

            if (this.uploadImageTargetSlide !== null && resolvedEntries.length === 1 && mode !== 'manager-only') {
                const targetIdx = Math.max(0, Math.min(this.uploadImageTargetSlide, this.slides.length - 1));
                const slide = this.slides[targetIdx];
                if (slide) {
                    this.pushHistory('upload-slide-image');
                    const oldImg = slide.image;
                    slide.image = resolvedEntries[0].image;
                    if (!SLIDE_LAYOUTS[slide.layout]?.usesImage) {
                        slide.layout = 'split';
                    }
                    if (!slide.text.trim() && resolvedEntries[0].text) {
                        slide.text = resolvedEntries[0].text;
                    }
                    if (oldImg && oldImg !== resolvedEntries[0].image) {
                        this.cleanupUnreferencedImage(oldImg);
                    }
                    this.activeSlideIndex = targetIdx;
                    this.clearBulkImageQueue();
                    this.closeUploadImageModal();
                    this.saveWorkspace();
                    this.render();
                    this.showToast(`Saved to Manager & attached to Slide #${targetIdx + 1}!`, 'image', 'success');
                    return;
                }
            }

            if (mode === 'manager-only') {
                const targetIdx = this.uploadImageTargetSlide;
                this.clearBulkImageQueue();
                this.closeUploadImageModal();
                this.updateDeckHeaderUI();
                this.syncToCloud();
                this.openImageManagerModal({ targetSlideIndex: targetIdx });
                const warnSuffix = failedCount > 0 ? ` (${failedCount} failed)` : '';
                this.showToast(
                    `Saved ${resolvedEntries.length} image${resolvedEntries.length === 1 ? '' : 's'} to Image Manager${warnSuffix}!`,
                    failedCount > 0 ? 'triangle-alert' : 'images',
                    failedCount > 0 ? 'orange' : 'success'
                );
                return;
            }

            const defaultLayout = resolvedEntries.some((entry) => entry.text) ? 'caption' : 'full';
            this.applyImageEntriesToSlides(resolvedEntries, { layout: defaultLayout, theme: 'auto', mode, reason: 'bulk-images' });
            this.clearBulkImageQueue();
            this.closeUploadImageModal();
            this.saveWorkspace();
            this.render();

            const warnSuffix = failedCount > 0 ? ` (${failedCount} failed)` : '';
            this.showToast(
                `Uploaded ${resolvedEntries.length} image${resolvedEntries.length === 1 ? '' : 's'}${warnSuffix}!`,
                failedCount > 0 ? 'triangle-alert' : 'images',
                failedCount > 0 ? 'orange' : 'success'
            );
        },

        isImageStillReferenced(url) {
            if (!url) return false;
            if (this.imageLibrary.some((img) => img && img.src === url)) return true;
            if (this.slides.some((s) => s && s.image === url)) return true;
            if (this.library.some((deck) => Array.isArray(deck.slides) && deck.slides.some((s) => s && s.image === url))) return true;
            if (this.undoStack.some((snap) => Array.isArray(snap.slides) && snap.slides.some((s) => s && s.image === url))) return true;
            return this.redoStack.some((snap) => Array.isArray(snap.slides) && snap.slides.some((s) => s && s.image === url));
        },

        cleanupUnreferencedImage(url) {
            if (!url || this.isImageStillReferenced(url)) return;
            if (String(url).startsWith('klasskit-local:')) {
                const cached = this.blobUrlCache.get(url);
                if (cached) {
                    try { URL.revokeObjectURL(cached); } catch (e) { }
                    this.blobUrlCache.delete(url);
                }
                LocalDB.delete(url.replace('klasskit-local:', ''));
                return;
            }
            if (typeof deleteMediaFromUrl === 'function' && !/^https?:\/\//i.test(url) && !/^data:/i.test(url)) {
                try { deleteMediaFromUrl(url); } catch (e) { }
            }
        },

        getCachedMediaSrc(url) {
            if (!url) return null;
            const s = String(url);
            if (s.startsWith('klasskit-local:')) {
                return this.blobUrlCache.get(s) || null;
            }
            if (/^(https?:\/\/|data:image\/|blob:)/i.test(s)) {
                return s;
            }
            return null;
        },

        async resolveAnyMedia(url) {
            if (!url) return null;
            const syncHit = this.getCachedMediaSrc(url);
            if (syncHit) return syncHit;
            const s = String(url);
            if (this._pendingMediaResolutions.has(s)) {
                return this._pendingMediaResolutions.get(s);
            }

            const promise = (async () => {
                if (s.startsWith('klasskit-local:')) {
                    const cached = this.blobUrlCache.get(s);
                    if (cached) return cached;
                    const key = s.replace('klasskit-local:', '');
                    const blob = await LocalDB.get(key);
                    if (!blob) return null;
                    const cachedAfter = this.blobUrlCache.get(s);
                    if (cachedAfter) return cachedAfter;
                    const objUrl = URL.createObjectURL(blob);
                    this.blobUrlCache.set(s, objUrl);
                    return objUrl;
                }
                if (typeof resolveMediaUrl === 'function') {
                    try {
                        return await resolveMediaUrl(s);
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            })();

            this._pendingMediaResolutions.set(s, promise);
            try {
                return await promise;
            } finally {
                this._pendingMediaResolutions.delete(s);
            }
        },

        async hydrateMediaElements(rootEl = document, scopeKey = 'workspace') {
            const token = (this.hydrateTokens.get(scopeKey) || 0) + 1;
            this.hydrateTokens.set(scopeKey, token);

            const imgs = Array.from(rootEl.querySelectorAll('img[data-media-src]'));
            await Promise.all(imgs.map(async (img) => {
                const rawSrc = img.getAttribute('data-media-src');
                if (!rawSrc) return;
                const resolved = await this.resolveAnyMedia(rawSrc);
                if (this.hydrateTokens.get(scopeKey) !== token) return;
                if (resolved) {
                    if (img.src !== resolved) img.src = resolved;
                    img.classList.add('is-loaded');
                }
            }));
        },

        handleGlobalPaste(e) {
            if (this.isPresenting) return;
            const uploadModalOpen = document.getElementById('upload-image-modal')?.classList.contains('open');
            const imgMgrOpen = document.getElementById('image-manager-modal')?.classList.contains('open');
            const openModal = document.querySelector('.modal-overlay.open, .drawer-overlay.open, .kk-import-overlay.open');
            if (openModal && !uploadModalOpen && !imgMgrOpen) return;

            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;

            const imageFiles = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.startsWith('image/')) {
                    const f = items[i].getAsFile();
                    if (f) imageFiles.push(f);
                }
            }
            if (!imageFiles.length) return;

            e.preventDefault();
            if (uploadModalOpen) {
                this.addBulkImageFiles(imageFiles);
                return;
            }
            if (imgMgrOpen) {
                const targetIdx = this.imageManagerTargetSlide;
                this.closeImageManager();
                this.openUploadImageModal({ targetSlideIndex: targetIdx, initialFiles: imageFiles });
                return;
            }
            if (imageFiles.length > 1) {
                this.openUploadImageModal({ initialFiles: imageFiles });
                return;
            }

            if (!this.slides.length) this.addSlide();
            const targetIdx = Math.max(0, Math.min(this.activeSlideIndex, this.slides.length - 1));
            this.handleImageFile(imageFiles[0], targetIdx);
        },


        /* --- EXPORT / IMPORT JSON / CLEAR --- */
        exportJSON() {
            const payload = {
                title: this.currentDeckTitle || 'Untitled Deck',
                exportedAt: new Date().toISOString(),
                slides: this.slides
            };
            const jsonStr = JSON.stringify(payload, null, 2);
            const slug = (this.currentDeckTitle || 'slides').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slides';
            const filename = `klasskit_${slug}_${new Date().toISOString().split('T')[0]}.json`;

            const a = document.createElement('a');
            let objectUrl = null;
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
                objectUrl = URL.createObjectURL(blob);
                a.href = objectUrl;
            } else {
                a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
            }
            a.download = filename;
            if (document.body && typeof document.body.appendChild === 'function') {
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                a.click();
            }
            if (objectUrl && typeof URL.revokeObjectURL === 'function') {
                setTimeout(() => {
                    try { URL.revokeObjectURL(objectUrl); } catch (e) { }
                }, 1000);
            }
            this.showToast('JSON deck backup exported!', 'download', 'success');
        },

        triggerImport() {
            const input = document.getElementById('importInput');
            if (input) input.click();
        },

        async processImport(el) {
            const file = el && el.files && el.files[0];
            if (!file) return;

            const confirmed = await this.showModal('Restore JSON Deck?', 'This will replace your active slides with the backup file.', 'Yes, Replace', 'upload');
            if (!confirmed) {
                el.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(String(e.target.result || ''));
                    const rawSlides = Array.isArray(parsed)
                        ? parsed
                        : (parsed && Array.isArray(parsed.slides) ? parsed.slides : null);

                    if (!rawSlides) {
                        this.showToast('Invalid deck JSON structure.', 'triangle-alert', 'orange');
                        return;
                    }

                    this.pushHistory('json-import');
                    const prev = this.slides;
                    this.slides = sanitizeDeckSchema(rawSlides);
                    if (!this.slides.length) {
                        this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
                    }
                    this.registerImagesFromSlides(this.slides, 'Imported');
                    this.currentDeckId = null;
                    if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
                        this.currentDeckTitle = parsed.title.trim().slice(0, 80);
                    } else {
                        this.currentDeckTitle = 'Untitled Deck';
                    }
                    this.activeSlideIndex = 0;
                    prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
                    this.toggleLibraryDrawer(false);
                    this.saveWorkspace();
                    this.render();
                    this.renderLibrary();
                    this.showToast(`Restored ${this.slides.length} slide(s)!`, 'circle-check', 'success');
                } catch (err) {
                    this.showToast('Could not read JSON file.', 'circle-alert', 'pink');
                }
            };
            reader.readAsText(file);
            el.value = '';
        },

        async clear() {
            const confirmed = await this.showModal('Clear Current Slides?', 'All slides in the current workspace will be cleared.', 'Yes, Clear', 'trash-2');
            if (!confirmed) return;

            this.pushHistory('clear');
            const prev = this.slides;
            this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            this.activeSlideIndex = 0;
            prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            this.saveWorkspace();
            this.render();
            this.showToast('Workspace cleared (Ctrl+Z to undo)', 'trash-2', 'pink');
        },

});

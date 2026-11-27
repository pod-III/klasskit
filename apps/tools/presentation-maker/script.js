'use strict';

Object.assign(app, {
        /* --- INITIALIZATION --- */
        async init() {
            this.syncThemeIcons();
            this.restoreViewPreference();
            await LocalDB.init();

            // Load fast from localStorage first so Chromebook renders immediately
            this.loadLocalState();
            if (!this._hasImageLibraryStorage) {
                this.syncSlidesIntoImageLibrary();
            }
            if (!this.slides.length) {
                this.slides = [sanitizeSlide({ id: createSlideId(), layout: 'hero', text: '', theme: 'auto', notes: '' }, 0)];
            }

            this.setupListeners();
            this.setupBulkImport();
            this.renderTemplatesGrid();
            this.render();
            this.renderLibrary();

            // Background cloud merge (guarded cleanly for offline / test environments)
            await this.syncFromCloudOnInit();
        },

        restoreViewPreference() {
            try {
                const savedView = localStorage.getItem(VIEW_KEY);
                if (savedView === 'grid' || savedView === 'list') {
                    this.viewMode = savedView;
                }
            } catch (e) { }
        },

        loadLocalState() {
            try {
                const libStr = localStorage.getItem(LIBRARY_KEY);
                if (libStr) this.library = sanitizeLibrary(JSON.parse(libStr));

                const imgLibStr = localStorage.getItem(IMAGE_LIBRARY_KEY);
                if (imgLibStr !== null) {
                    this._hasImageLibraryStorage = true;
                    this.imageLibrary = sanitizeImageLibrary(JSON.parse(imgLibStr));
                }

                const slidesStr = localStorage.getItem(STORAGE_KEY);
                if (slidesStr) this.slides = sanitizeDeckSchema(JSON.parse(slidesStr));

                const metaStr = localStorage.getItem(META_KEY);
                if (metaStr) {
                    const meta = JSON.parse(metaStr);
                    if (meta && typeof meta === 'object') {
                        this.currentDeckId = meta.id || null;
                        this.currentDeckTitle = (typeof meta.title === 'string' && meta.title.trim()) ? meta.title.trim() : 'Untitled Deck';
                        this.hasUnsavedChanges = Boolean(meta.unsaved);
                    }
                }
            } catch (e) {
                console.warn('Could not parse local deck storage:', e);
            }
        },

        async syncFromCloudOnInit() {
            const badge = document.getElementById('sync-badge');
            const drawerPill = document.getElementById('library-cloud-pill');

            if (typeof requireAuth !== 'function' || typeof loadProgress !== 'function') {
                if (badge) badge.textContent = 'Local Mode';
                if (drawerPill) drawerPill.textContent = 'Offline / Local Storage';
                return;
            }

            try {
                await requireAuth();
                const user = typeof getCloudUser === 'function' ? await getCloudUser() : null;
                if (!user) {
                    if (badge) badge.textContent = 'Guest Local';
                    if (drawerPill) drawerPill.textContent = 'Local Storage Ready';
                    return;
                }

                if (badge) badge.textContent = 'Cloud Synced';
                if (drawerPill) drawerPill.textContent = 'Synced to KlassKit Cloud';

                const cloudData = await loadProgress('presentation_data');
                if (!cloudData || typeof cloudData !== 'object') return;

                let changed = false;

                // Merge libraries safely by deck id, keeping newer updated timestamps
                if (Array.isArray(cloudData.library)) {
                    const cloudLib = sanitizeLibrary(cloudData.library);
                    const mergedMap = new Map();
                    this.library.forEach((d) => mergedMap.set(d.id, d));
                    cloudLib.forEach((cd) => {
                        const existing = mergedMap.get(cd.id);
                        if (!existing || cd.updated > existing.updated) {
                            mergedMap.set(cd.id, cd);
                            changed = true;
                        }
                    });
                    this.library = Array.from(mergedMap.values()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
                    this.persistLibraryLocal();
                }

                // Merge cloud images (non-local) into Image Manager
                if (Array.isArray(cloudData.images)) {
                    const cloudImgs = sanitizeImageLibrary(cloudData.images);
                    cloudImgs.forEach((ci) => {
                        if (!this.imageLibrary.some((existing) => existing.src === ci.src)) {
                            this.imageLibrary.push(ci);
                            changed = true;
                        }
                    });
                    if (changed) this.persistImageLibraryLocal();
                }

                // Adopt cloud workspace only if local workspace is empty/pristine
                const localIsDefaultEmpty = this.slides.length <= 1 &&
                    !this.slides[0]?.text?.trim() &&
                    !this.slides[0]?.image &&
                    !this.hasUnsavedChanges;

                if (localIsDefaultEmpty && Array.isArray(cloudData.slides) && cloudData.slides.length > 0) {
                    this.slides = sanitizeDeckSchema(cloudData.slides);
                    this.registerImagesFromSlides(this.slides, 'Cloud Slide');
                    if (cloudData.meta) {
                        this.currentDeckId = cloudData.meta.id || null;
                        this.currentDeckTitle = cloudData.meta.title || 'Untitled Deck';
                        this.hasUnsavedChanges = Boolean(cloudData.meta.unsaved);
                    }
                    this.persistWorkspaceLocal();
                    changed = true;
                }

                if (changed) {
                    this.render();
                    this.renderLibrary();
                }
            } catch (e) {
                console.warn('Cloud sync deferred to local mode:', e);
                if (badge) badge.textContent = 'Local Sync';
            }
        },

        setupListeners() {
            const imgInput = document.getElementById('imageInput');
            if (imgInput) {
                imgInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file && this.activeUploadIndex !== null) {
                        this.handleImageFile(file, this.activeUploadIndex);
                    }
                    e.target.value = '';
                });
            }

            const importInput = document.getElementById('importInput');
            if (importInput) {
                importInput.addEventListener('change', (e) => this.processImport(e.target));
            }

            const bulkImgInput = document.getElementById('bulkImagesInput');
            if (bulkImgInput) {
                bulkImgInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length) {
                        this.addBulkImageFiles(e.target.files);
                    }
                    e.target.value = '';
                });
            }

            const bulkDropzone = document.getElementById('bulk-img-dropzone');
            if (bulkDropzone) {
                bulkDropzone.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.triggerBulkImagesBrowse();
                    }
                });
                bulkDropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    bulkDropzone.classList.add('drag-active');
                });
                bulkDropzone.addEventListener('dragleave', (e) => {
                    if (!e.relatedTarget || !bulkDropzone.contains(e.relatedTarget)) {
                        bulkDropzone.classList.remove('drag-active');
                    }
                });
                bulkDropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    bulkDropzone.classList.remove('drag-active');
                    if (this.bulkImageImporting) return;
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                        this.addBulkImageFiles(e.dataTransfer.files);
                    }
                });
            }

            const imgGalleryEl = document.getElementById('img-mgr-gallery');
            if (imgGalleryEl) {
                imgGalleryEl.addEventListener('click', (e) => {
                    const card = e.target.closest('[data-asset-id]');
                    if (!card) return;
                    const assetId = card.getAttribute('data-asset-id');
                    const actionEl = e.target.closest('[data-gallery-action]');

                    if (actionEl) {
                        e.stopPropagation();
                        const action = actionEl.getAttribute('data-gallery-action');
                        if (action === 'delete') {
                            this.deleteManagedImage(assetId);
                        } else if (action === 'use') {
                            this.pickManagedImageForSlide(assetId);
                        } else if (action === 'toggle-select') {
                            this.toggleManagedImageSelection(assetId);
                        }
                        return;
                    }

                    if (this.imageManagerTargetSlide !== null) {
                        this.pickManagedImageForSlide(assetId);
                    } else {
                        this.toggleManagedImageSelection(assetId);
                    }
                });
            }

            const bulkQueueEl = document.getElementById('bulk-img-queue');
            if (bulkQueueEl) {
                bulkQueueEl.addEventListener('click', (e) => {
                    const actionBtn = e.target.closest('[data-bulk-img-action]');
                    const itemEl = e.target.closest('[data-bulk-img-idx]');
                    if (!actionBtn || !itemEl) return;
                    const idx = parseInt(itemEl.getAttribute('data-bulk-img-idx'), 10);
                    const action = actionBtn.getAttribute('data-bulk-img-action');
                    if (Number.isNaN(idx)) return;
                    if (action === 'move-prev') this.moveBulkImageItem(idx, -1);
                    else if (action === 'move-next') this.moveBulkImageItem(idx, 1);
                    else if (action === 'remove') this.removeBulkImageItem(idx);
                });
                bulkQueueEl.addEventListener('input', (e) => {
                    if (!e.target.matches('[data-bulk-img-caption]')) return;
                    const itemEl = e.target.closest('[data-bulk-img-idx]');
                    if (!itemEl) return;
                    const idx = parseInt(itemEl.getAttribute('data-bulk-img-idx'), 10);
                    if (!Number.isNaN(idx)) this.updateBulkImageCaption(idx, e.target.value);
                });
            }

            // Delegated List View Events
            const listContainer = document.getElementById('slides-list-container');
            if (listContainer) {
                listContainer.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-action]');
                    if (actionEl) {
                        const card = actionEl.closest('[data-slide-index]');
                        if (!card) return;
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        const action = actionEl.getAttribute('data-action');
                        if (Number.isNaN(idx)) return;

                        if (action === 'set-layout') {
                            this.updateSlideLayout(idx, actionEl.getAttribute('data-layout'));
                        } else if (action === 'set-theme') {
                            this.updateSlideTheme(idx, actionEl.getAttribute('data-theme-choice'));
                        } else if (action === 'move-up') {
                            this.moveSlide(idx, -1);
                        } else if (action === 'move-down') {
                            this.moveSlide(idx, 1);
                        } else if (action === 'present-from') {
                            this.startPresentation(idx);
                        } else if (action === 'duplicate') {
                            this.duplicateSlide(idx);
                        } else if (action === 'delete') {
                            this.deleteSlide(idx);
                        } else if (action === 'add-after') {
                            this.addSlide(idx + 1);
                        } else if (action === 'upload-img') {
                            this.triggerImageUpload(idx);
                        } else if (action === 'pick-img') {
                            this.openImageManagerModal({ targetSlideIndex: idx });
                        } else if (action === 'url-img') {
                            this.openImageUrlModal(idx);
                        } else if (action === 'remove-img') {
                            this.removeImage(idx);
                        }
                        return;
                    }

                    const card = e.target.closest('[data-slide-index]');
                    if (card) {
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        if (!Number.isNaN(idx)) this.setActiveSlide(idx);
                    }
                });

                listContainer.addEventListener('focusin', (e) => {
                    const card = e.target.closest('[data-slide-index]');
                    if (card) {
                        const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                        if (!Number.isNaN(idx) && idx !== this.activeSlideIndex) {
                            this.setActiveSlide(idx);
                        }
                    }
                });

                listContainer.addEventListener('input', (e) => {
                    const card = e.target.closest('[data-slide-index]');
                    if (!card) return;
                    const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (Number.isNaN(idx)) return;

                    if (e.target.matches('[data-field="text"]')) {
                        this.updateSlideText(idx, e.target.value);
                    } else if (e.target.matches('[data-field="notes"]')) {
                        this.updateSlideNotes(idx, e.target.value);
                    }
                });

                listContainer.addEventListener('dragover', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    e.preventDefault();
                    dropzone.classList.add('drag-active');
                });

                listContainer.addEventListener('dragleave', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    if (!e.relatedTarget || !dropzone.contains(e.relatedTarget)) {
                        dropzone.classList.remove('drag-active');
                    }
                });

                listContainer.addEventListener('drop', (e) => {
                    const dropzone = e.target.closest('.slide-dropzone[data-slide-index]');
                    if (!dropzone) return;
                    e.preventDefault();
                    dropzone.classList.remove('drag-active');
                    const idx = parseInt(dropzone.getAttribute('data-slide-index'), 10);
                    const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                    if (files.length > 1) {
                        this.openBulkImagesModal(files);
                        return;
                    }
                    if (files[0] && !Number.isNaN(idx)) {
                        this.handleImageFile(files[0], idx);
                    }
                });
            }

            // Delegated Grid View Events
            const gridContainer = document.getElementById('slides-grid-container');
            if (gridContainer) {
                gridContainer.addEventListener('click', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card || this.recentlyDragged) return;
                    const idx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (Number.isNaN(idx)) return;

                    const actionBtn = e.target.closest('[data-grid-action]');
                    if (actionBtn) {
                        const action = actionBtn.getAttribute('data-grid-action');
                        if (action === 'present') {
                            this.startPresentation(idx);
                        } else if (action === 'edit') {
                            this.activeSlideIndex = idx;
                            this.setView('list');
                            this.scrollToSlide(idx);
                        } else if (action === 'delete') {
                            this.deleteSlide(idx);
                        }
                        return;
                    }

                    this.activeSlideIndex = idx;
                    this.setView('list');
                    this.scrollToSlide(idx);
                });

                gridContainer.addEventListener('dragstart', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    this.dragSourceIndex = parseInt(card.getAttribute('data-slide-index'), 10);
                    card.classList.add('dragging');
                    if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(this.dragSourceIndex));
                    }
                });

                gridContainer.addEventListener('dragover', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    e.preventDefault();
                    gridContainer.querySelectorAll('.grid-card.drag-over').forEach((el) => {
                        if (el !== card) el.classList.remove('drag-over');
                    });
                    card.classList.add('drag-over');
                });

                gridContainer.addEventListener('dragleave', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
                        card.classList.remove('drag-over');
                    }
                });

                gridContainer.addEventListener('drop', (e) => {
                    const card = e.target.closest('.grid-card[data-slide-index]');
                    if (!card) return;
                    e.preventDefault();
                    card.classList.remove('drag-over');
                    const targetIdx = parseInt(card.getAttribute('data-slide-index'), 10);
                    if (this.dragSourceIndex !== null && !Number.isNaN(targetIdx) && this.dragSourceIndex !== targetIdx) {
                        this.pushHistory('reorder');
                        const [moved] = this.slides.splice(this.dragSourceIndex, 1);
                        this.slides.splice(targetIdx, 0, moved);
                        this.activeSlideIndex = targetIdx;
                        this.recentlyDragged = true;
                        setTimeout(() => { this.recentlyDragged = false; }, 120);
                        this.saveWorkspace();
                        this.render();
                    }
                });

                gridContainer.addEventListener('dragend', () => {
                    this.dragSourceIndex = null;
                    this.recentlyDragged = true;
                    setTimeout(() => { this.recentlyDragged = false; }, 120);
                    gridContainer.querySelectorAll('.grid-card').forEach((c) => c.classList.remove('dragging', 'drag-over'));
                });
            }

            // Delegated Library Drawer Events
            const deckList = document.getElementById('deck-list');
            if (deckList) {
                deckList.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-deck-action]');
                    const item = e.target.closest('[data-deck-id]');
                    if (!item) return;
                    const deckId = item.getAttribute('data-deck-id');
                    if (btn) {
                        e.stopPropagation();
                        const action = btn.getAttribute('data-deck-action');
                        if (action === 'delete') this.deleteDeck(deckId);
                        else if (action === 'duplicate') this.duplicateDeck(deckId);
                        return;
                    }
                    this.loadDeck(deckId);
                });
            }

            // Delegated Templates Modal Events
            const templatesGrid = document.getElementById('templates-grid');
            if (templatesGrid) {
                templatesGrid.addEventListener('click', (e) => {
                    const card = e.target.closest('[data-template-id]');
                    if (!card) return;
                    this.applyTemplate(card.getAttribute('data-template-id'));
                });
            }

            // Clipboard Image Paste (`Ctrl+V` anywhere in workspace)
            document.addEventListener('paste', (e) => this.handleGlobalPaste(e));

            // Fullscreen change listener
            document.addEventListener('fullscreenchange', () => this.syncFullscreenIcon());

            // Flush unsaved workspace cleanly on tab close
            window.addEventListener('beforeunload', () => this.flushPendingSaves());

            // Sync theme button label/icon when another tab updates theme
            window.addEventListener('storage', (e) => {
                if (e && (e.key === 'theme_hub' || e.key === THEME_KEY || e.key === 'klasskit-theme')) {
                    setTimeout(() => this.syncThemeIcons(), 0);
                }
            });

            this.bindGlobalKeys();
        },

        setupBulkImport() {
            if (!window.KlassKitBulkImport || typeof window.KlassKitBulkImport.create !== 'function') return;

            this.bulkImportModal = window.KlassKitBulkImport.create({
                id: 'slides-bulk-import',
                title: 'Bulk Import Slides',
                subtitle: 'Paste slide lines or --- blocks to build your deck fast',
                accentColor: 'pink',
                unitLabel: 'slide',
                unitLabelPlural: 'slides',
                confirmText: 'Import Slides',
                guideItems: [
                    { label: 'Divider', syntax: '---', color: 'pink', desc: 'Separates multi-line slide blocks.' },
                    { label: 'Layout Tag', syntax: '[HERO] / [BULLETS] / [SPLIT]', color: 'blue', desc: 'Optional: [CAPTION] and [FULL] also work.' },
                    { label: 'Slide Theme', syntax: '(blue) / (pink) / (green)', color: 'orange', desc: 'Place right after the layout tag.' },
                    { label: 'Media & Note', syntax: 'IMG: url  |  NOTE: text', color: 'green', desc: 'Add image URL or teacher notes inside a block.' }
                ],
                tips: [
                    '<b>Quick List:</b> Without <code>---</code> or tags, every non-empty line becomes its own Hero slide!',
                    '<b>Pipe Shortcut:</b> Write <code>Caption | https://...</code> on one line for instant Split slides.'
                ],
                placeholder: 'Paste one slide per line OR multi-line blocks with --- ...',
                template: BULK_TEMPLATE_SAMPLE,
                sample: BULK_TEMPLATE_SAMPLE,
                options: [
                    { id: 'onePerLine', label: 'Force one slide per line', defaultChecked: false },
                    { id: 'appendToDeck', label: 'Append to current slides (keep existing)', defaultChecked: true }
                ],
                parse: (text) => {
                    const oneLineBox = document.querySelector('#slides-bulk-import [data-import-opt="onePerLine"]');
                    return parseBulkSlidesText(text, { onePerLine: Boolean(oneLineBox && oneLineBox.checked) });
                },
                onImport: (result, opts) => {
                    if (!result.items || !result.items.length) return false;
                    this.pushHistory('bulk-import');
                    const imported = sanitizeDeckSchema(result.items);
                    this.registerImagesFromSlides(imported, 'Slide');

                    if (opts && opts.appendToDeck) {
                        const startIdx = this.slides.length;
                        // If only slide is blank, replace it cleanly when appending
                        if (this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image) {
                            this.slides = imported;
                            this.activeSlideIndex = 0;
                        } else {
                            this.slides = this.slides.concat(imported);
                            this.activeSlideIndex = startIdx;
                        }
                    } else {
                        const prevSlides = this.slides;
                        this.slides = imported;
                        this.activeSlideIndex = 0;
                        prevSlides.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
                    }

                    this.saveWorkspace();
                    this.render();
                    this.showToast(`Imported ${imported.length} slide${imported.length === 1 ? '' : 's'}!`, 'circle-check', 'success');
                    return true;
                },
                onCopyTemplate: () => {
                    this.showToast('AI-ready slide template copied!', 'clipboard-check', 'blue');
                }
            });

            // Re-run preview automatically when user toggles "Force one slide per line"
            const onePerLineCheckbox = this.bulkImportModal.overlay.querySelector('[data-import-opt="onePerLine"]');
            if (onePerLineCheckbox) {
                onePerLineCheckbox.addEventListener('change', () => this.bulkImportModal.refresh());
            }
        },

        openBulkImport() {
            if (!this.bulkImportModal) {
                this.showToast('Bulk import component unavailable.', 'triangle-alert', 'orange');
                return;
            }
            const appendBox = this.bulkImportModal.overlay.querySelector('[data-import-opt="appendToDeck"]');
            if (appendBox) {
                const hasRealContent = this.slides.some((s) => (s.text && s.text.trim()) || s.image);
                appendBox.checked = hasRealContent;
            }
            this.bulkImportModal.open();
        },

});

    window.app = app;
    window.__presentationMakerDebug = {
        app,
        escapeHTML,
        sanitizeImageUrl,
        sanitizeSlide,
        sanitizeDeckSchema,
        sanitizeLibrary,
        sanitizeImageLibrary,
        resolveSlideTheme,
        parseBulkSlidesText,
        parseBulkImageUrls,
        formatFilenameAsCaption,
        SLIDE_LAYOUTS,
        SLIDE_THEMES,
        SLIDE_TEMPLATES,
        LocalDB
    };

    window.addEventListener('load', () => {
        app.init();
    });

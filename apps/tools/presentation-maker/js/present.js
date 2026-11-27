'use strict';

Object.assign(app, {
        /* --- THEME & MENUS --- */
        toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            try {
                localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            } catch (e) { }
            this.syncThemeIcons();
        },

        syncThemeIcons() {
            const isDark = document.documentElement.classList.contains('dark');
            const sun = document.getElementById('theme-icon-sun');
            const moon = document.getElementById('theme-icon-moon');
            const label = document.getElementById('theme-label');
            if (sun) sun.classList.toggle('is-hidden', !isDark);
            if (moon) moon.classList.toggle('is-hidden', isDark);
            if (label) label.textContent = isDark ? 'DARK' : 'LIGHT';
        },

        toggleHelp(force) {
            const modal = document.getElementById('help-modal');
            if (!modal) return;
            const open = typeof force === 'boolean' ? force : !modal.classList.contains('open');
            modal.classList.toggle('open', open);
        },

        openModal(id) {
            const el = document.getElementById(id);
            if (el) el.classList.add('open');
        },

        closeModal(id) {
            const el = document.getElementById(id);
            if (el) el.classList.remove('open');
        },

        /* --- UNDO / REDO --- */
        pushHistory(reason) {
            this.pendingTypingSnapshot = false;
            clearTimeout(this.typingHistoryTimer);

            const snapshot = {
                reason: reason || 'edit',
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };

            this.undoStack.push(snapshot);
            if (this.undoStack.length > 40) {
                const evicted = this.undoStack.shift();
                if (evicted && Array.isArray(evicted.slides)) {
                    evicted.slides.forEach((s) => { if (s && s.image) this.cleanupUnreferencedImage(s.image); });
                }
            }
            this.redoStack = [];
            this.updateHistoryButtons();
        },

        markTypingEdit() {
            if (!this.pendingTypingSnapshot) {
                this.pushHistory('typing');
                this.pendingTypingSnapshot = true;
            }
            clearTimeout(this.typingHistoryTimer);
            this.typingHistoryTimer = setTimeout(() => {
                this.pendingTypingSnapshot = false;
            }, 900);
        },

        undo() {
            if (!this.undoStack.length) return;
            const current = {
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };
            this.redoStack.push(current);

            const prev = this.undoStack.pop();
            this.slides = sanitizeDeckSchema(prev.slides);
            this.currentDeckId = prev.currentDeckId;
            this.currentDeckTitle = prev.currentDeckTitle || 'Untitled Deck';
            this.activeSlideIndex = Math.max(0, Math.min(prev.activeSlideIndex || 0, Math.max(0, this.slides.length - 1)));
            this.pendingTypingSnapshot = false;

            this.saveWorkspace();
            this.render();
            this.showToast('Undid last change', 'undo-2', 'blue');
        },

        redo() {
            if (!this.redoStack.length) return;
            const current = {
                slides: deepClone(this.slides),
                currentDeckId: this.currentDeckId,
                currentDeckTitle: this.currentDeckTitle,
                activeSlideIndex: this.activeSlideIndex
            };
            this.undoStack.push(current);

            const next = this.redoStack.pop();
            this.slides = sanitizeDeckSchema(next.slides);
            this.currentDeckId = next.currentDeckId;
            this.currentDeckTitle = next.currentDeckTitle || 'Untitled Deck';
            this.activeSlideIndex = Math.max(0, Math.min(next.activeSlideIndex || 0, Math.max(0, this.slides.length - 1)));
            this.pendingTypingSnapshot = false;

            this.saveWorkspace();
            this.render();
            this.showToast('Redid change', 'redo-2', 'blue');
        },

        updateHistoryButtons() {
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');
            if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
            if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
        },

        /* --- TEMPLATES --- */
        renderTemplatesGrid() {
            const container = document.getElementById('templates-grid');
            if (!container) return;

            container.innerHTML = SLIDE_TEMPLATES.map((tpl) => {
                const colorClass = tpl.accent === 'pink'
                    ? 'bg-pink/15 text-pink border-pink/40'
                    : tpl.accent === 'green'
                        ? 'bg-green/15 text-green border-green/40'
                        : tpl.accent === 'orange'
                            ? 'bg-orange/15 text-orange border-orange/40'
                            : 'bg-blue/15 text-blue border-blue/40';

                return `
                    <button type="button" data-template-id="${escapeHTML(tpl.id)}"
                        class="text-left p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border-3 border-dark dark:border-slate-500 shadow-hard-sm hover:-translate-y-0.5 hover:border-blue transition-all cursor-pointer flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-2">
                            <span class="px-2.5 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-wider ${colorClass}">${escapeHTML(tpl.tag)}</span>
                            <span class="text-[11px] font-extrabold text-slate-400">${tpl.slides.length} Slides</span>
                        </div>
                        <div class="flex items-center gap-2.5 mt-0.5">
                            <div class="w-9 h-9 rounded-xl ${colorClass} border-2 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="${escapeHTML(tpl.icon)}" class="w-4 h-4"></i>
                            </div>
                            <h3 class="font-heading font-bold text-base uppercase tracking-tight text-dark dark:text-white leading-tight">${escapeHTML(tpl.title)}</h3>
                        </div>
                        <p class="text-xs font-semibold text-slate-500 dark:text-slate-300 leading-snug">${escapeHTML(tpl.desc)}</p>
                    </button>
                `;
            }).join('');

            this.safeCreateIcons();
        },

        openTemplatesModal() {
            const toggle = document.getElementById('template-append-toggle');
            if (toggle) {
                const hasRealContent = this.slides.some((s) => (s.text && s.text.trim()) || s.image);
                toggle.checked = hasRealContent;
            }
            this.openModal('templates-modal');
        },

        applyTemplate(templateId) {
            const tpl = SLIDE_TEMPLATES.find((t) => t.id === templateId);
            if (!tpl) return;

            this.pushHistory('template');
            const generated = tpl.slides.map((s, idx) => sanitizeSlide({
                ...deepClone(s),
                id: createSlideId() + idx
            }, idx));

            const append = Boolean(document.getElementById('template-append-toggle')?.checked);
            if (append && !(this.slides.length === 1 && !this.slides[0].text.trim() && !this.slides[0].image)) {
                const startIdx = this.slides.length;
                this.slides = this.slides.concat(generated);
                this.activeSlideIndex = startIdx;
            } else {
                const prev = this.slides;
                this.slides = generated;
                this.activeSlideIndex = 0;
                if (!this.currentDeckId && (this.currentDeckTitle === 'Untitled Deck' || !this.currentDeckTitle)) {
                    this.currentDeckTitle = tpl.title;
                }
                prev.forEach((s) => { if (s.image) this.cleanupUnreferencedImage(s.image); });
            }

            this.closeModal('templates-modal');
            this.saveWorkspace();
            this.render();
            this.showToast(`Applied "${tpl.title}" (Ctrl+Z to undo)`, 'sparkles', 'success');
        },


        /* --- PRESENTATION MODE --- */
        startPresentation(startIndex = 0) {
            if (!this.slides.length) {
                this.showToast('Add at least one slide first!', 'triangle-alert', 'orange');
                return;
            }
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            const safeIdx = Math.max(0, Math.min(Number.isFinite(startIndex) ? startIndex : 0, this.slides.length - 1));
            this.presentIndex = safeIdx;
            this.isPresenting = true;
            this.isBlackout = false;

            const overlay = document.getElementById('presentation-mode');
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.remove('open');
            if (overlay) {
                overlay.classList.add('is-open');
                overlay.setAttribute('aria-hidden', 'false');
            }

            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }

            this.renderShowSlide();
        },

        renderShowSlide(skipStageRebuild = false) {
            const stageContent = document.getElementById('stage-content');
            const counter = document.getElementById('slide-counter');
            const progressBar = document.getElementById('present-progress-bar');
            const notesBanner = document.getElementById('present-notes-banner');
            const notesContent = document.getElementById('present-notes-content');
            const notesDot = document.getElementById('hud-notes-dot');
            const notesBtn = document.getElementById('hud-notes');
            const blackoutBtn = document.getElementById('hud-blackout');

            if (!this.slides.length) {
                this.exitPresentation();
                return;
            }

            this.presentIndex = Math.max(0, Math.min(this.presentIndex, this.slides.length - 1));
            const slide = this.slides[this.presentIndex];

            if (!skipStageRebuild && stageContent) {
                stageContent.innerHTML = this.buildSlideStageHTML(slide, this.presentIndex, 'present');
            }
            if (counter) {
                counter.textContent = `${this.presentIndex + 1} / ${this.slides.length}`;
            }
            if (progressBar) {
                const pct = ((this.presentIndex + 1) / this.slides.length) * 100;
                progressBar.style.width = `${pct}%`;
            }

            const hasNotes = Boolean(slide.notes && slide.notes.trim());
            if (notesDot) notesDot.classList.toggle('is-hidden', !hasNotes);
            if (notesBtn) notesBtn.classList.toggle('is-active', this.showPresentNotes);
            if (blackoutBtn) blackoutBtn.classList.toggle('is-active', this.isBlackout);

            if (notesBanner && notesContent) {
                const visible = this.showPresentNotes && hasNotes && !this.isBlackout;
                notesBanner.classList.toggle('is-hidden', !visible);
                notesContent.textContent = hasNotes ? slide.notes : '';
            }

            if (!skipStageRebuild) {
                this.safeCreateIcons();
                if (stageContent) this.hydrateMediaElements(stageContent, 'present');
            }
        },

        handleStageClick(e) {
            if (this.isBlackout) {
                this.toggleBlackout(false);
                return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
            if (relX < 0.22) this.prevSlide();
            else this.nextSlide();
        },

        nextSlide() {
            if (this.presentIndex < this.slides.length - 1) {
                this.presentIndex++;
                this.renderShowSlide();
            } else {
                this.showToast('End of deck — press Esc to exit', 'flag', 'blue');
            }
        },

        prevSlide() {
            if (this.presentIndex > 0) {
                this.presentIndex--;
                this.renderShowSlide();
            }
        },

        jumpToSlide(index) {
            if (index >= 0 && index < this.slides.length) {
                this.presentIndex = index;
                this.renderShowSlide();
            }
        },

        toggleBlackout(force) {
            this.isBlackout = typeof force === 'boolean' ? force : !this.isBlackout;
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.toggle('open', this.isBlackout);
            this.renderShowSlide(true);
        },

        toggleNotes(force) {
            this.showPresentNotes = typeof force === 'boolean' ? force : !this.showPresentNotes;
            this.renderShowSlide(true);
        },

        toggleFullScreen() {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => { });
                }
            } else if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            }
        },

        syncFullscreenIcon() {
            const fsBtn = document.getElementById('hud-fullscreen');
            if (!fsBtn) return;
            const iconName = document.fullscreenElement ? 'minimize-2' : 'maximize-2';
            fsBtn.innerHTML = `<i id="hud-fullscreen-icon" data-lucide="${iconName}" class="w-4 h-4"></i>`;
            this.safeCreateIcons();
        },

        exitPresentation() {
            this.isPresenting = false;
            this.isBlackout = false;
            const overlay = document.getElementById('presentation-mode');
            const blackout = document.getElementById('present-blackout');
            if (blackout) blackout.classList.remove('open');
            if (overlay) {
                overlay.classList.remove('is-open');
                overlay.setAttribute('aria-hidden', 'true');
            }
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            }
            // Keep editor active slide synced to whichever slide teacher ended on
            this.activeSlideIndex = Math.max(0, Math.min(this.presentIndex, Math.max(0, this.slides.length - 1)));
            this.render();
        },


        /* --- CONFIRM DIALOG & TOASTS --- */
        showModal(title, desc, confirmText, icon = 'triangle-alert') {
            if (typeof this._confirmCancel === 'function') {
                this._confirmCancel();
            }
            return new Promise((resolve) => {
                const modal = document.getElementById('custom-modal');
                const titleEl = document.getElementById('modal-title');
                const descEl = document.getElementById('modal-desc');
                const confirmBtn = document.getElementById('modal-confirm');
                const cancelBtn = document.getElementById('modal-cancel');
                const iconWrap = document.getElementById('modal-icon-wrap');

                if (titleEl) titleEl.textContent = title || 'Confirm';
                if (descEl) descEl.textContent = desc || '';
                if (confirmBtn) confirmBtn.textContent = confirmText || 'Confirm';
                if (iconWrap) {
                    iconWrap.innerHTML = `<i id="modal-icon" data-lucide="${escapeHTML(icon || 'triangle-alert')}" class="w-7 h-7"></i>`;
                }

                this.safeCreateIcons();

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
                setTimeout(() => {
                    if (cancelBtn && typeof cancelBtn.focus === 'function') cancelBtn.focus();
                }, 60);
            });
        },

        showToast(msg, icon = 'info', tone = 'blue') {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const iconMap = {
                success: 'circle-check',
                error: 'circle-alert',
                warning: 'triangle-alert',
                info: 'info'
            };
            const safeIcon = iconMap[icon] || icon || 'info';
            const validTone = ['success', 'pink', 'orange', 'blue'].includes(tone) ? tone : 'blue';

            const toast = document.createElement('div');
            toast.className = `toast-item tone-${validTone}`;
            toast.innerHTML = `<i data-lucide="${escapeHTML(safeIcon)}" class="toast-icon"></i><span>${escapeHTML(msg)}</span>`;
            container.appendChild(toast);
            this.safeCreateIcons();

            requestAnimationFrame(() => toast.classList.add('is-visible'));
            setTimeout(() => {
                toast.classList.remove('is-visible');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 220);
            }, 2600);
        },

        safeCreateIcons() {
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }
        },

        /* --- GLOBAL KEYBOARD SHORTCUTS --- */
        bindGlobalKeys() {
            document.addEventListener('keydown', (e) => {
                // Bulk Import modal owns Escape via its capture listener
                if (document.querySelector('.kk-import-overlay.open')) return;

                // 1. Presentation Mode Controls
                if (this.isPresenting) {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.nextSlide();
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.prevSlide();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        this.jumpToSlide(0);
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        this.jumpToSlide(this.slides.length - 1);
                    } else if (e.key === 'b' || e.key === 'B') {
                        e.preventDefault();
                        this.toggleBlackout();
                    } else if (e.key === 'n' || e.key === 'N') {
                        e.preventDefault();
                        this.toggleNotes();
                    } else if (e.key === 'f' || e.key === 'F') {
                        e.preventDefault();
                        this.toggleFullScreen();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        if (this.isBlackout) this.toggleBlackout(false);
                        else this.exitPresentation();
                    }
                    return;
                }

                // 2. Open Modals / Drawer Priority Stack
                const customModal = document.getElementById('custom-modal');
                if (e.key === 'Escape') {
                    if (customModal && customModal.classList.contains('open')) {
                        if (typeof this._confirmCancel === 'function') this._confirmCancel();
                        return;
                    }
                    const uploadImgModal = document.getElementById('upload-image-modal');
                    if (uploadImgModal && uploadImgModal.classList.contains('open')) {
                        this.closeUploadImageModal();
                        return;
                    }
                    const imgMgrModal = document.getElementById('image-manager-modal');
                    if (imgMgrModal && imgMgrModal.classList.contains('open')) {
                        this.closeImageManager();
                        return;
                    }
                    for (const modalId of ['name-modal', 'image-url-modal', 'templates-modal', 'help-modal']) {
                        const m = document.getElementById(modalId);
                        if (m && m.classList.contains('open')) {
                            this.closeModal(modalId);
                            return;
                        }
                    }
                    const drawer = document.getElementById('library-drawer');
                    if (drawer && drawer.classList.contains('open')) {
                        this.toggleLibraryDrawer(false);
                        return;
                    }
                }
                if (customModal && customModal.classList.contains('open')) return;

                if (e.key === 'Enter') {
                    const nameModal = document.getElementById('name-modal');
                    if (nameModal && nameModal.classList.contains('open')) {
                        if (document.activeElement && document.activeElement.id === 'deck-name-input') {
                            e.preventDefault();
                            this.confirmSaveDeck();
                        }
                        return;
                    }
                    const urlModal = document.getElementById('image-url-modal');
                    if (urlModal && urlModal.classList.contains('open')) {
                        if (document.activeElement && document.activeElement.id === 'image-url-input') {
                            e.preventDefault();
                            this.applyImageUrl();
                        }
                        return;
                    }
                }

                if (document.querySelector('.modal-overlay.open, .drawer-overlay.open')) return;

                // 3. Editor Shortcuts
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.manualSave();
                    return;
                }

                if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') {
                    e.preventDefault();
                    this.startPresentation(this.activeSlideIndex);
                    return;
                }

                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                const inTextField = activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && document.activeElement.type !== 'checkbox');

                if (!inTextField && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    this.undo();
                    return;
                }
                if (!inTextField && ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')))) {
                    e.preventDefault();
                    this.redo();
                    return;
                }

                // Reorder active slide quickly with Alt + ArrowUp / ArrowDown
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.viewMode === 'list') {
                    e.preventDefault();
                    this.moveSlide(this.activeSlideIndex, e.key === 'ArrowUp' ? -1 : 1);
                }
            });
        }
});

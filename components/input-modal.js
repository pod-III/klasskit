/**
 * Universal Input Modal Component for KlassKit
 * Provides a consistent input dialog across all apps
 * 
 * Usage:
 *   1. Include this script: <script src="../../../components/input-modal.js"></script>
 *   2. Call: showInputModal(options)
 * 
 * Options:
 *   - title: Modal title (default: "Enter Value")
 *   - description: Modal description (default: "")
 *   - placeholder: Input placeholder (default: "Type here...")
 *   - confirmText: Confirm button text (default: "Confirm")
 *   - cancelText: Cancel button text (default: "Cancel")
 *   - icon: Lucide icon name (default: "edit-3")
 *   - iconColor: Icon color class (default: "blue")
 *   - defaultValue: Default input value (default: "")
 *   - validation: Function to validate input (returns error message or null)
 *   - onConfirm: Callback function(value) when confirmed
 *   - onCancel: Callback function() when cancelled
 */

(function() {
    'use strict';

    // Create modal HTML structure
    function createModalStructure() {
        if (document.getElementById('universalInputModal')) return;

        const modalHTML = `
            <style>
                @keyframes modal-shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                }
                .animate-modal-shake {
                    animation: modal-shake 0.4s ease-in-out;
                }
                #universalInputModal .kk-input-card {
                    background: var(--surface-card, #ffffff);
                    border: 3px solid var(--border-primary, #334155);
                    box-shadow: 4px 4px 0px var(--shadow-color, #334155);
                }
                #universalInputModal #inputModalTitle {
                    color: var(--text-primary, #1e293b);
                }
                #universalInputModal #inputModalDesc {
                    color: var(--text-secondary, #475569);
                }
                #universalInputModal #inputModalField {
                    background: var(--bg-primary, #f8fafc);
                    border: 3px solid var(--border-primary, #334155);
                    color: var(--text-primary, #1e293b);
                }
                #universalInputModal #inputModalField::placeholder {
                    color: var(--text-tertiary, #94a3b8);
                }
                #universalInputModal #inputModalField:focus {
                    outline: none;
                    border-color: var(--color-pink, #ff4785);
                    box-shadow: 2px 2px 0px var(--color-pink, #ff4785);
                }
                #universalInputModal #inputModalCancel {
                    background: var(--bg-tertiary, #e2e8f0);
                    color: var(--text-primary, #1e293b);
                    border: 3px solid var(--border-primary, #334155);
                    box-shadow: 2px 2px 0px var(--shadow-color, #334155);
                }
                #universalInputModal #inputModalConfirm {
                    background: var(--color-pink, #ff4785);
                    color: #ffffff;
                    border: 3px solid var(--border-primary, #334155);
                    box-shadow: 2px 2px 0px var(--shadow-color, #334155);
                }
                #universalInputModal #inputModalCancel:hover,
                #universalInputModal #inputModalConfirm:hover {
                    transform: translateY(1px);
                    box-shadow: 1px 1px 0px var(--shadow-color, #334155);
                }
                #universalInputModal #inputModalCancel:active,
                #universalInputModal #inputModalConfirm:active {
                    transform: translateY(2px);
                    box-shadow: none;
                }
            </style>
            <div id="universalInputModal" class="hidden fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-pop font-body">
                <div class="kk-input-card max-w-sm w-full p-6 flex flex-col items-center rounded-2xl">
                    <div id="inputModalIconWrapper" class="w-16 h-16 rounded-2xl bg-[#ff4785]/10 border-[3px] border-[#ff4785]/30 flex items-center justify-center mb-4">
                        <i id="inputModalIcon" data-lucide="edit-3" class="w-8 h-8 text-[#ff4785]"></i>
                    </div>
                    <h3 id="inputModalTitle" class="text-2xl font-heading font-bold mb-2 text-center">Enter Value</h3>
                    <p id="inputModalDesc" class="text-sm mb-5 text-center font-medium"></p>
                    <input type="text" id="inputModalField" class="w-full px-4 py-3 mb-5 text-center text-base font-bold rounded-xl transition-all" placeholder="Type here...">
                    <div class="flex gap-3 w-full">
                        <button id="inputModalCancel" class="flex-1 py-3 rounded-xl text-sm font-heading font-bold transition-all">
                            Cancel
                        </button>
                        <button id="inputModalConfirm" class="flex-1 py-3 rounded-xl text-sm font-heading font-bold transition-all">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHTML;
        document.body.appendChild(wrapper);

        // Setup event listeners
        const modal = document.getElementById('universalInputModal');
        const input = document.getElementById('inputModalField');
        const confirmBtn = document.getElementById('inputModalConfirm');
        const cancelBtn = document.getElementById('inputModalCancel');

        if (!modal || !input || !confirmBtn || !cancelBtn) {
            console.error('Input modal: Failed to create modal elements');
            return;
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideInputModal();
                if (currentOnCancel) currentOnCancel();
            }
        });

        // Confirm on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });

        // Escape to cancel
        escapeKeyListener = (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                hideInputModal();
                if (currentOnCancel) currentOnCancel();
            }
        };
        document.addEventListener('keydown', escapeKeyListener);
        // Note: listener is permanent; it self-guards via the hidden check
    }

    // Current callback references
    let currentOnConfirm = null;
    let currentOnCancel = null;
    let currentValidation = null;
    let escapeKeyListener = null;

    /**
     * Show the input modal
     * @param {Object} options - Configuration options
     */
    function showInputModal(options = {}) {
        // Ensure modal exists
        createModalStructure();

        const modal = document.getElementById('universalInputModal');

        // Re-entrancy guard: if already open, ignore the new call
        if (modal && !modal.classList.contains('hidden')) return;

        const title = document.getElementById('inputModalTitle');
        const desc = document.getElementById('inputModalDesc');
        const input = document.getElementById('inputModalField');
        const confirmBtn = document.getElementById('inputModalConfirm');
        const cancelBtn = document.getElementById('inputModalCancel');
        const icon = document.getElementById('inputModalIcon');
        const iconWrapper = document.getElementById('inputModalIconWrapper');

        // Set content
        title.textContent = options.title || 'Enter Value';
        desc.textContent = options.description || '';
        desc.style.display = options.description ? 'block' : 'none';
        input.placeholder = options.placeholder || 'Type here...';
        input.value = options.defaultValue || '';
        confirmBtn.textContent = options.confirmText || 'Confirm';
        if (options.cancelText === null) {
            cancelBtn.style.display = 'none';
        } else {
            cancelBtn.style.display = '';
            cancelBtn.textContent = options.cancelText || 'Cancel';
        }

        // Set icon
        const iconName = options.icon || 'edit-3';
        icon.setAttribute('data-lucide', iconName);

        // Set icon color - map to KlassKit colors
        const colorMap = {
            'blue': '#1ea7fd',
            'pink': '#ff4785',
            'orange': '#ff7e33',
            'green': '#00d063',
            'red': '#ef4444',
            'purple': '#8b5cf6'
        };
        const color = colorMap[options.iconColor] || colorMap['pink'];
        icon.style.color = color;
        iconWrapper.style.backgroundColor = color + '15'; // 10% opacity
        iconWrapper.style.borderColor = color + '40'; // 25% opacity

        // Refresh icons if lucide is available
        if (window.lucide) {
            try {
                lucide.createIcons();
                // After icons are created, the <i> might be replaced with SVG
                // So we need to find the new icon element and update its styles
                const newIcon = iconWrapper.querySelector('svg, i');
                if (newIcon) {
                    newIcon.style.width = '2rem';
                    newIcon.style.height = '2rem';
                    newIcon.style.color = color;
                }
            } catch (error) {
                console.warn('Failed to create Lucide icons:', error);
                // Fallback: keep the original <i> element with styles
            }
        }

        // Store callbacks
        currentOnConfirm = options.onConfirm || null;
        currentOnCancel = options.onCancel || null;
        currentValidation = options.validation || null;

        // Setup button handlers
        confirmBtn.onclick = () => {
            const value = input.value.trim();
            
            // Run validation if provided
            if (currentValidation) {
                const error = currentValidation(value);
                if (error) {
                    input.style.borderColor = '#ef4444';
                    // Shake animation
                    modal.querySelector('.max-w-sm').classList.add('animate-modal-shake');
                    setTimeout(() => {
                        modal.querySelector('.max-w-sm').classList.remove('animate-modal-shake');
                        input.style.borderColor = '';
                    }, 400);
                    return;
                }
            }

            hideInputModal();
            if (currentOnConfirm) currentOnConfirm(value);
        };

        cancelBtn.onclick = () => {
            hideInputModal();
            if (currentOnCancel) currentOnCancel();
        };

        // Hide input field if not needed (alert/confirm modes)
        if (options.hideInput) {
            input.style.display = 'none';
        }

        // Show modal
        modal.classList.remove('hidden');
        
        // Focus input after a short delay for animation
        if (!options.hideInput) {
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        }
    }

    /**
     * Hide the input modal
     */
    function hideInputModal() {
        const modal = document.getElementById('universalInputModal');
        if (modal) {
            modal.classList.add('hidden');
            // Reset input field display for next use
            const input = document.getElementById('inputModalField');
            if (input) {
                input.style.display = '';
                input.value = '';
            }
            // Reset button margins
            const buttons = modal.querySelector('.flex.gap-3');
            if (buttons) {
                buttons.style.marginTop = '';
            }
        }
    }

    /**
     * Quick prompt - Simple way to get user input
     * @param {string} message - Prompt message
     * @param {string} defaultValue - Default value
     * @returns {Promise<string|null>} User input or null if cancelled
     */
    function quickPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            showInputModal({
                title: message,
                defaultValue: defaultValue,
                onConfirm: (value) => resolve(value),
                onCancel: () => resolve(null)
            });
        });
    }

    /**
     * Show an alert modal (message only, single button)
     * @param {string} message - Alert message
     * @param {Object} options - Optional configuration
     * @returns {Promise<void>} Resolves when user clicks OK
     */
    function showAlertModal(message, options = {}) {
        return new Promise((resolve) => {
            showInputModal({
                title: options.title || 'Notice',
                description: message,
                defaultValue: '',
                confirmText: options.confirmText || 'OK',
                cancelText: null,
                icon: options.icon || 'info',
                iconColor: options.iconColor || 'blue',
                hideInput: true,
                onConfirm: () => resolve(),
                onCancel: () => resolve()
            });
        });
    }

    /**
     * Show a confirmation modal (yes/no)
     * @param {string} message - Confirmation message
     * @param {Object} options - Optional configuration
     * @returns {Promise<boolean>} True if confirmed, false if cancelled
     */
    function showConfirmModal(message, options = {}) {
        return new Promise((resolve) => {
            showInputModal({
                title: options.title || 'Confirm',
                description: message,
                defaultValue: '',
                confirmText: options.confirmText || 'Yes',
                cancelText: options.cancelText || 'No',
                icon: options.icon || 'help-circle',
                iconColor: options.iconColor || 'orange',
                hideInput: true,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    // Export functions globally
    window.showInputModal = showInputModal;
    window.hideInputModal = hideInputModal;
    window.quickPrompt = quickPrompt;
    window.showAlertModal = showAlertModal;
    window.showConfirmModal = showConfirmModal;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createModalStructure);
    } else {
        createModalStructure();
    }
})();

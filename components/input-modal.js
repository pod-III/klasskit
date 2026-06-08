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
            </style>
            <div id="universalInputModal" class="hidden fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-pop font-body">
                <div class="max-w-sm w-full p-6 flex flex-col items-center bg-[#f8fafc] dark:bg-[#1e293b] rounded-2xl border-[3px] border-[#334155] dark:border-[#475569] shadow-[4px_4px_0px_#334155] dark:shadow-[4px_4px_0px_#475569]">
                    <div id="inputModalIconWrapper" class="w-16 h-16 rounded-2xl bg-[#ff4785]/10 border-[3px] border-[#ff4785]/30 flex items-center justify-center mb-4">
                        <i id="inputModalIcon" data-lucide="edit-3" class="w-8 h-8 text-[#ff4785]"></i>
                    </div>
                    <h3 id="inputModalTitle" class="text-2xl font-heading font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 text-center">Enter Value</h3>
                    <p id="inputModalDesc" class="text-sm text-[#475569] dark:text-[#94a3b8] mb-5 text-center font-medium"></p>
                    <input type="text" id="inputModalField" class="w-full px-4 py-3 mb-5 text-center text-base font-bold bg-white dark:bg-[#0f172a] border-[3px] border-[#334155] dark:border-[#475569] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#ff4785] focus:shadow-[2px_2px_0px_#ff4785] transition-all" placeholder="Type here...">
                    <div class="flex gap-3 w-full">
                        <button id="inputModalCancel" class="flex-1 py-3 rounded-xl text-sm font-heading font-bold bg-white dark:bg-[#334155] text-[#1e293b] dark:text-[#f8fafc] border-[3px] border-[#334155] dark:border-[#475569] shadow-[2px_2px_0px_#334155] dark:shadow-[2px_2px_0px_#475569] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#334155] active:translate-y-[2px] active:shadow-none transition-all">
                            Cancel
                        </button>
                        <button id="inputModalConfirm" class="flex-1 py-3 rounded-xl text-sm font-heading font-bold bg-[#ff4785] text-white border-[3px] border-[#334155] dark:border-[#475569] shadow-[2px_2px_0px_#334155] dark:shadow-[2px_2px_0px_#475569] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#334155] active:translate-y-[2px] active:shadow-none transition-all">
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
                hideInputModal();
            }
        };
        document.addEventListener('keydown', escapeKeyListener);
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
        cancelBtn.textContent = options.cancelText || 'Cancel';

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

        // Show modal
        modal.classList.remove('hidden');
        
        // Focus input after a short delay for animation
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
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
        // Clean up escape key listener
        if (escapeKeyListener) {
            document.removeEventListener('keydown', escapeKeyListener);
            escapeKeyListener = null;
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
                cancelText: null, // Hide cancel button
                icon: options.icon || 'info',
                iconColor: options.iconColor || 'blue',
                onConfirm: () => resolve(),
                onCancel: () => resolve()
            });
            // Hide the input field for alerts
            setTimeout(() => {
                const input = document.getElementById('inputModalField');
                if (input) {
                    input.style.display = 'none';
                }
                // Adjust margin of buttons container
                const buttons = document.querySelector('#universalInputModal .flex.gap-3');
                if (buttons) {
                    buttons.style.marginTop = '0';
                }
            }, 10);
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
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
            // Hide the input field for confirmations
            setTimeout(() => {
                const input = document.getElementById('inputModalField');
                if (input) {
                    input.style.display = 'none';
                }
            }, 10);
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

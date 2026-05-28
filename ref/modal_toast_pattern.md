# Universal Modal & Toast Pattern

This document outlines the standardized pattern for **confirmation modals**, **generic modals**, and **toast notifications** used in **Card Maker** and designed for adoption across all KlassKit tools.

## 1. Prerequisites

Each tool must include the shared KlassKit styles and the Tailwind CDN with the brand configuration.

### A. HTML `<head>` Setup

```html
<!-- Tailwind CDN with Brand Config -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    brand: {
                        pink: '#ff4785',
                        orange: '#ff7e33',
                        green: '#00d063',
                        blue: '#1ea7fd',
                        dark: '#1e293b',
                        chalk: '#f8fafc'
                    }
                },
                fontFamily: {
                    heading: ["Fredoka", "sans-serif"],
                    body: ["Nunito", "sans-serif"],
                },
                boxShadow: {
                    "neo-sm": "var(--shadow-hard-sm)",
                    "neo": "var(--shadow-hard-md)",
                    "neo-lg": "var(--shadow-hard-lg)",
                },
                animation: {
                    'pop-in': 'pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                },
                keyframes: {
                    'pop-in': {
                        '0%': { opacity: '0', transform: 'scale(0.9) translateY(10px)' },
                        '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
                    }
                }
            },
        },
    };
</script>

<!-- Shared KlassKit Styles -->
<link rel="stylesheet" href="../../../css/base.css" />
<link rel="stylesheet" href="../../../css/components.css" />
```

> **Note:** `base.css` provides the CSS custom properties (`--shadow-hard-md`, `--color-pink`, etc.) and the `@keyframes pop-in` fallback. `components.css` provides `.btn-chunky`, `.input-chunky`, and `.toast` base styles.

---

## 2. Confirm Modal (Promise-Based)

A reusable, accessible confirmation dialog that returns a `Promise<boolean>`.

### A. HTML Template

Place this once at the bottom of `<body>`, after all other content:

```html
<!-- Toast Container -->
<div id="toast-container" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] flex flex-col gap-3 pointer-events-none"></div>

<!-- Custom Confirm Modal -->
<div id="confirmModal" class="hidden fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-[500] items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] border-4 border-brand-dark dark:border-slate-500 shadow-neo animate-pop-in overflow-hidden">
        <div class="p-6 text-center">
            <div class="w-16 h-16 rounded-2xl bg-brand-pink/10 flex items-center justify-center border-[3px] border-brand-dark mx-auto mb-4">
                <i data-lucide="alert-triangle" class="w-8 h-8 text-brand-pink"></i>
            </div>
            <h3 id="confirmTitle" class="text-xl font-heading font-bold text-brand-dark dark:text-white mb-2">Are you sure?</h3>
            <p id="confirmMessage" class="text-sm text-slate-500 dark:text-slate-400 mb-6">This action cannot be undone.</p>
            <div class="flex gap-3">
                <button id="confirmBtnYes" class="flex-1 btn-chunky bg-brand-pink text-white py-3 rounded-2xl font-bold">
                    Yes, Delete
                </button>
                <button id="confirmBtnNo" class="flex-1 btn-chunky bg-white dark:bg-slate-700 dark:text-white py-3 rounded-2xl font-bold">
                    Cancel
                </button>
            </div>
        </div>
    </div>
</div>
```

### B. JavaScript Controller

```javascript
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmBtnYes');
        const noBtn = document.getElementById('confirmBtnNo');

        titleEl.textContent = title;
        msgEl.textContent = message;

        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Re-render icons if using Lucide
        if (window.lucide) lucide.createIcons();

        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            yesBtn.onclick = null;
            noBtn.onclick = null;
            modal.onclick = null;
            resolve(value);
        };

        yesBtn.onclick = () => cleanup(true);
        noBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => { if (e.target === modal) cleanup(false); };
    });
}
```

### C. Usage Example

```javascript
async function deleteItem(id) {
    const confirmed = await showConfirm("Delete Item", `Delete item #${id}? This cannot be undone.`);
    if (confirmed) {
        // ... perform deletion
        showToast("Item deleted", "success");
    }
}
```

---

## 3. Toast Notifications

Non-blocking, auto-dismissing feedback messages that stack from the bottom center.

### A. JavaScript Controller

```javascript
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");

    const colors = {
        success: "bg-brand-green text-brand-dark border-brand-dark",
        error: "bg-brand-pink text-white border-brand-dark",
        info: "bg-brand-blue text-white border-brand-dark",
        warning: "bg-brand-orange text-brand-dark border-brand-dark",
    };

    const icons = {
        success: "check-circle",
        error: "alert-circle",
        info: "info",
        warning: "alert-triangle",
    };

    toast.className = `${colors[type]} px-6 py-3 rounded-2xl shadow-neo border-2 border-dark font-bold text-sm flex items-center gap-2 pointer-events-auto animate-pop-in`;
    toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4"></i> ${message}`;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.4s ease";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
```

### B. Usage Examples

```javascript
showToast("Set saved successfully", "success");
showToast("Please enter a name", "warning");
showToast("Something went wrong", "error");
showToast("Processing 12 images...", "info");
```

---

## 4. Generic Modal Pattern

For custom forms (e.g., bulk import, settings), use the same overlay shell but with inline content.

### A. HTML Template

```html
<div id="bulkTextModal" 
     class="hidden fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-[200] items-center justify-center p-4" 
     onclick="if(event.target===this)closeBulkTextModal()">
    <div class="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border-4 border-brand-dark dark:border-slate-500 shadow-neo animate-pop-in overflow-hidden">
        <!-- Header -->
        <div class="p-6 pb-4 border-b-4 border-brand-dark dark:border-slate-500 bg-gradient-to-r from-brand-blue/10 to-brand-pink/5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-brand-blue flex items-center justify-center border-[3px] border-brand-dark shadow-neo-sm shrink-0">
                <i data-lucide="align-left" class="w-6 h-6 text-white"></i>
            </div>
            <div>
                <h3 class="text-xl font-heading font-bold text-brand-dark dark:text-white leading-tight">Bulk Text Import</h3>
                <p class="text-xs text-slate-400 mt-0.5">Fills current page first, overflows to new pages</p>
            </div>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
            <!-- Your form content here -->
            <div class="flex gap-3 pt-2">
                <button onclick="handleImport()" class="flex-1 btn-chunky bg-brand-blue text-white py-3 rounded-2xl flex items-center justify-center gap-2">
                    <i data-lucide="download" class="w-4 h-4"></i> Import
                </button>
                <button onclick="closeBulkTextModal()" class="btn-chunky bg-white dark:bg-slate-700 px-5 rounded-2xl dark:text-white text-sm">
                    Cancel
                </button>
            </div>
        </div>
    </div>
</div>
```

### B. JavaScript Controller

```javascript
function openBulkTextModal() {
    const modal = document.getElementById("bulkTextModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    // Focus first input for accessibility
    document.getElementById("bulkTextarea")?.focus();
}

function closeBulkTextModal() {
    const modal = document.getElementById("bulkTextModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}
```

---

## 5. Z-Index Hierarchy

To avoid layering conflicts, follow this scale:

| Layer | Z-Index | Example |
| :--- | :--- | :--- |
| Base Content | `0 - 10` | Cards, forms |
| Side Panels / Drawers | `40 - 50` | Settings sidebar |
| Toast Notifications | `400` | `toast-container` |
| Confirm / Alert Modals | `500` | `confirmModal` |
| Loading / Drag Overlays | `200+` | `dragOverlay` |

---

## 6. UX Standards

1. **Confirm Button Color:** Use `bg-brand-pink` for destructive actions (delete, clear). Use `bg-brand-blue` for constructive actions (save, import).
2. **Cancel Button Style:** Use `bg-white dark:bg-slate-700` with neutral text.
3. **Iconography:** Use `lucide` icons inside a `rounded-2xl` container with `bg-{brand-color}/10` and a `border-[3px]` for the modal header emblem.
4. **Backdrop:** Always use `bg-brand-dark/60 backdrop-blur-md` for the overlay.
5. **Card Shell:** Always use `bg-white dark:bg-slate-800 rounded-[2rem] border-4 border-brand-dark dark:border-slate-500 shadow-neo animate-pop-in overflow-hidden`.
6. **Dismissal:** Clicking outside the modal card or pressing the cancel button should close the modal. The confirm modal resolves `false` on outside click.
7. **Accessibility:** Focus the first interactive element when a modal opens. Remove event listeners on cleanup to prevent memory leaks.

---

> [!TIP]
> Keep modal HTML templates at the very bottom of `<body>` so they sit above all other content in the DOM order, minimizing z-index conflicts.

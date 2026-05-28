/**
 * KlassKit Universal Modal & Toast Library
 * Implements the pattern defined in /ref/modal-toast-pattern.md
 *
 * Prerequisites per page:
 *   1. Tailwind CDN with brand config (colors, fontFamily, shadow-neo, animate-pop-in)
 *   2. Links to base.css & components.css
 *   3. Lucide icons (if using icon rendering)
 *   4. HTML templates: #toast-container, #confirmModal
 */

/* ================================
   TOAST NOTIFICATIONS
   ================================ */

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) {
        console.warn("[modal-toast] #toast-container not found in DOM");
        return;
    }

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

    const colorClass = colors[type] || colors.info;
    const iconName = icons[type] || icons.info;

    toast.className = `${colorClass} px-6 py-3 rounded-2xl shadow-neo border-2 border-dark font-bold text-sm flex items-center gap-2 pointer-events-auto animate-pop-in`;
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i> ${message}`;

    container.appendChild(toast);

    if (window.lucide && lucide.createIcons) {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.4s ease";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ================================
   CONFIRM MODAL (Promise-based)
   ================================ */

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirmModal");
        if (!modal) {
            console.warn("[modal-toast] #confirmModal not found in DOM");
            resolve(false);
            return;
        }

        const titleEl = document.getElementById("confirmTitle");
        const msgEl = document.getElementById("confirmMessage");
        const yesBtn = document.getElementById("confirmBtnYes");
        const noBtn = document.getElementById("confirmBtnNo");

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        modal.classList.remove("hidden");
        modal.classList.add("flex");

        if (window.lucide && lucide.createIcons) {
            lucide.createIcons();
        }

        const cleanup = (value) => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            yesBtn.onclick = null;
            noBtn.onclick = null;
            modal.onclick = null;
            resolve(value);
        };

        if (yesBtn) yesBtn.onclick = () => cleanup(true);
        if (noBtn) noBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => {
            if (e.target === modal) cleanup(false);
        };
    });
}

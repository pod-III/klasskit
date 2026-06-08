// ===== GLOBAL STATE =====
let notes = [];
let currentNoteId = null;
let currentNoteParentId = null;
let expandedParents = new Set();
let quill;
let isZenMode = false;
let isOutlineOpen = false;
let isTrashMode = false;
let isDarkMode = false;
let idb = null;
let blobUrlMap = {}; // blobUrl -> idbKey
let cloudUrlMap = {}; // signedUrl -> originalUrl
let searchCache = null;
let strippedContentCache = new Map();
let sortMode = 'date-desc';
let draggedNoteId = null;
let noteLinkSearchActive = false;
let noteLinkTriggerIndex = -1;
let noteLinkActiveIndex = 0;

// ===== UTILITIES =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function fastStripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, ' ');
}

// ===== INDEXEDDB SETUP =====
const DB_NAME = 'LessonNotesDB';
const DB_VERSION = 2;
const STORES = {
    IMAGES: 'images',
    NOTES: 'notes',
    SETTINGS: 'settings'
};

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const upgradeDB = e.target.result;
            if (!upgradeDB.objectStoreNames.contains(STORES.IMAGES)) {
                upgradeDB.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
            }
            if (!upgradeDB.objectStoreNames.contains(STORES.NOTES)) {
                upgradeDB.createObjectStore(STORES.NOTES, { keyPath: 'id' });
            }
            if (!upgradeDB.objectStoreNames.contains(STORES.SETTINGS)) {
                upgradeDB.createObjectStore(STORES.SETTINGS);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// --- Image Store Helpers ---
function storeImage(id, arrayBuffer, mimeType) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).put({ id, data: arrayBuffer, type: mimeType });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function getImage(id) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readonly');
        const req = tx.objectStore(STORES.IMAGES).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function deleteImage(id) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Notes Store Helpers ---
function getAllNotes() {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.NOTES, 'readonly');
        const req = tx.objectStore(STORES.NOTES).getAll();
        req.onsuccess = () => {
            const result = req.result || [];
            // Sort by updatedAt descending
            resolve(result.sort((a, b) => b.updatedAt - a.updatedAt));
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveNoteToDB(note) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).put(note);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function deleteNoteFromDB(id) {
    // Cloud cleanup
    const user = await getUser();
    if (!isSandbox() && user) {
        db.from('notes').delete().eq('id', id).eq('user_id', user.id)
            .then(() => console.log(`[Cloud] Deleted note ${id}`))
            .catch(e => console.warn('Cloud note delete failed', e));

        deleteFolder(`${user.id}/lesson_note/${id}`)
            .catch(e => console.warn('Cloud folder delete failed', e));
    }

    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Settings Store Helpers ---
function getSetting(key) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.SETTINGS, 'readonly');
        const req = tx.objectStore(STORES.SETTINGS).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.SETTINGS, 'readwrite');
        tx.objectStore(STORES.SETTINGS).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Migration ---
async function migrateFromLocalStorage() {
    const oldNotes = localStorage.getItem('e1_lesson_notes');
    if (oldNotes) {
        try {
            const parsedNotes = JSON.parse(oldNotes);
            if (Array.isArray(parsedNotes)) {
                for (const note of parsedNotes) {
                    // Migrate folderId to parentId if present
                    const parentId = note.parentId || note.folderId || null;
                    await saveNoteToDB({
                        ...note,
                        parentId,
                        deleted: note.deleted || false,
                        updatedAt: note.updatedAt || Date.now()
                    });
                }
            }
            localStorage.removeItem('e1_lesson_notes');
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    const oldLastActive = localStorage.getItem('e1_last_active_note');
    if (oldLastActive) {
        await saveSetting('lastActiveNoteId', oldLastActive);
        localStorage.removeItem('e1_last_active_note');
    }
    
    // Clean up old folder-related localStorage
    localStorage.removeItem('e1_lesson_folders');
}

function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

// ===== DARK MODE =====
async function initDarkMode() {
    const saved = localStorage.getItem('theme_lesson-note');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode = true;
        document.documentElement.classList.add('dark');
    } else {
        isDarkMode = false;
        document.documentElement.classList.remove('dark');
    }
    updateDarkModeUI();
}

async function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme_lesson-note', isDarkMode ? 'dark' : 'light');
    updateDarkModeUI();
}

function updateDarkModeUI() {
    const icon = document.getElementById('darkModeIcon');
    const text = document.getElementById('darkModeText');
    if (icon) icon.setAttribute('data-lucide', isDarkMode ? 'sun' : 'moon');
    if (text) text.textContent = isDarkMode ? 'Light' : 'Dark';
    lucide.createIcons();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await requireAuth();
    idb = await openDB();
    await migrateFromLocalStorage();
    await initDarkMode();
    initQuill();
    initTableToolbar();

    notes = await getAllNotes();
    const savedExpanded = await getSetting('expandedParents');
    if (savedExpanded) {
        expandedParents = new Set(savedExpanded);
    }
    sortMode = (await getSetting('sortMode')) || 'date-desc';
    updateSortDropdownUI();
    setupRootDropTarget();
    await loadFromCloud(); // Sync with cloud on startup
    await purgeExpiredTrash(); // Auto-delete notes trashed >14 days ago

    const lastActiveId = await getSetting('lastActiveNoteId');
    const noteToLoad = notes.find(n => n.id === lastActiveId && !n.deleted) || notes.find(n => !n.deleted);

    if (noteToLoad) {
        await loadNote(noteToLoad.id);
    } else {
        await createNewNote();
    }

        renderNotesList();

    // Close context menus, sort dropdown, and note link suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.note-ctx-menu') && !e.target.closest('.note-ctx-trigger')) {
            document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
        }
        if (!e.target.closest('#sortDropdown') && !e.target.closest('#sortBtn')) {
            document.getElementById('sortDropdown')?.classList.add('hidden');
        }
        if (!e.target.closest('#noteLinkSuggestions')) {
            closeNoteLinkSuggestions();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const isMeta = e.ctrlKey || e.metaKey;
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        // New note (avoid when typing in editor or title)
        if (isMeta && e.key === 'n' && !e.shiftKey) {
            e.preventDefault();
            if (!isTyping || activeEl.id === 'searchInput') createNewNote();
        }

        // Dark mode
        if (isMeta && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            toggleDarkMode();
        }

        // Zen mode
        if (isMeta && e.shiftKey && e.key === 'Z') {
            e.preventDefault();
            toggleZenMode();
        }

        // Toggle outline
        if (isMeta && e.shiftKey && e.key === 'O') {
            e.preventDefault();
            toggleOutline();
        }

        // Move to trash
        if (isMeta && e.shiftKey && e.key === 'Delete') {
            e.preventDefault();
            softDeleteCurrentNote();
        }

        // Focus search
        if (isMeta && e.key === 'k' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }

        // Escape: close sidebar on mobile, close modals/dropdowns
        if (e.key === 'Escape') {
            document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
            document.getElementById('sortDropdown')?.classList.add('hidden');
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
                toggleSidebar();
            }
        }
    });

    // Cursor-following tooltip system
    initCursorTooltips();

    // Create note link suggestions popup element
    const suggestionsEl = document.createElement('div');
    suggestionsEl.id = 'noteLinkSuggestions';
    suggestionsEl.className = 'hidden absolute z-50 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[240px] max-h-[200px] overflow-y-auto custom-scrollbar animate-pop';
    document.body.appendChild(suggestionsEl);

    // Capture keyboard navigation for note links in Quill
    quill.root.addEventListener('keydown', (e) => {
        if (!noteLinkSearchActive) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const list = notes.filter(n => !n.deleted && n.id !== currentNoteId);
            const query = getNoteLinkQuery();
            const filtered = list.filter(n => (n.title || 'Untitled').toLowerCase().includes(query.toLowerCase()));
            if (filtered.length > 0) {
                noteLinkActiveIndex = (noteLinkActiveIndex + 1) % filtered.length;
                updateNoteLinkSuggestions(query);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const list = notes.filter(n => !n.deleted && n.id !== currentNoteId);
            const query = getNoteLinkQuery();
            const filtered = list.filter(n => (n.title || 'Untitled').toLowerCase().includes(query.toLowerCase()));
            if (filtered.length > 0) {
                noteLinkActiveIndex = (noteLinkActiveIndex - 1 + filtered.length) % filtered.length;
                updateNoteLinkSuggestions(query);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const list = notes.filter(n => !n.deleted && n.id !== currentNoteId);
            const query = getNoteLinkQuery();
            const filtered = list.filter(n => (n.title || 'Untitled').toLowerCase().includes(query.toLowerCase()));
            if (filtered.length > 0 && filtered[noteLinkActiveIndex]) {
                insertNoteLink(filtered[noteLinkActiveIndex]);
            } else {
                closeNoteLinkSuggestions();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeNoteLinkSuggestions();
        }
    }, true);

    // Handle clicks on note links in the editor
    quill.root.addEventListener('click', (e) => {
        const linkEl = e.target.closest('a');
        if (linkEl) {
            const href = linkEl.getAttribute('href');
            if (href && href.startsWith('#note-')) {
                e.preventDefault();
                e.stopPropagation();
                const noteId = href.replace('#note-', '');
                loadNote(noteId);
            }
        }
    });

    quill.on('selection-change', (range) => {
        if (range) {
            checkNoteLinkTrigger();
        } else {
            closeNoteLinkSuggestions();
        }
    });

    document.getElementById('noteTitle').addEventListener('input', () => {
        saveCurrentNote();
        renderNotesList();
    });
    
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
            const hasImage = delta.ops.some(op => op.insert && op.insert.image);
            if (hasImage) convertBase64ImagesToIDB();
            
            debouncedSave();
            debouncedOutline();
            debouncedRenderList();

            checkNoteLinkTrigger();
        }
    });

    const debouncedSave = debounce(saveCurrentNote, 1000);
    const debouncedOutline = debounce(updateOutline, 1500);
    const debouncedRenderList = debounce(renderNotesList, 500);

    document.getElementById('searchInput').addEventListener('input', renderNotesList);

    lucide.createIcons();
});

// ===== QUILL 2.0 SETUP =====
function initQuill() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Start typing your amazing lesson plan...',
        modules: {
            table: true,
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image', 'table', 'video'],
                ['clean']
            ]
        }
    });

    // Move the toolbar to our custom container for the "seamless" look
    const toolbarContainer = quill.getModule('toolbar').container;
    const customToolbarTarget = document.getElementById('note-toolbar');
    if (customToolbarTarget && toolbarContainer) {
        customToolbarTarget.appendChild(toolbarContainer);
    }

    // Handle the native table button click
    const toolbar = quill.getModule('toolbar');
    toolbar.addHandler('table', function () {
        openTableDialog();
    });

    // Add tooltips to Quill toolbar buttons
    addQuillToolbarTooltips();
}

function addQuillToolbarTooltips() {
    const toolbar = document.getElementById('note-toolbar');
    if (!toolbar) return;

    const tooltipMap = {
        'ql-bold': 'Bold',
        'ql-italic': 'Italic',
        'ql-underline': 'Underline',
        'ql-strike': 'Strikethrough',
        'ql-link': 'Link',
        'ql-image': 'Image',
        'ql-table': 'Table',
        'ql-video': 'Video',
        'ql-clean': 'Remove formatting',
    };

    Object.entries(tooltipMap).forEach(([cls, label]) => {
        const btn = toolbar.querySelector('.' + cls);
        if (btn) btn.setAttribute('data-tooltip', label);
    });

    // List buttons (ordered, bullet, check)
    toolbar.querySelectorAll('.ql-list').forEach(btn => {
        const val = btn.getAttribute('value');
        const labels = { ordered: 'Ordered list', bullet: 'Bullet list', check: 'Checklist' };
        if (val && labels[val]) btn.setAttribute('data-tooltip', labels[val]);
    });

    // Header picker
    const headerPicker = toolbar.querySelector('.ql-header');
    if (headerPicker) headerPicker.setAttribute('data-tooltip', 'Heading style');

    // Color pickers
    const colorPicker = toolbar.querySelector('.ql-color');
    if (colorPicker) colorPicker.setAttribute('data-tooltip', 'Text color');
    const bgPicker = toolbar.querySelector('.ql-background');
    if (bgPicker) bgPicker.setAttribute('data-tooltip', 'Highlight color');
}

// ===== CURSOR TOOLTIPS =====
function initCursorTooltips() {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    let currentTarget = null;

    document.addEventListener('mouseover', (e) => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) {
            tooltip.classList.remove('visible');
            currentTarget = null;
            return;
        }
        currentTarget = el;
        let text = el.getAttribute('data-tooltip');
        const shortcut = el.getAttribute('data-tooltip-shortcut');
        if (shortcut) text += '  ' + shortcut;
        tooltip.textContent = text;
        tooltip.classList.add('visible');
    });

    document.addEventListener('mousemove', (e) => {
        if (!currentTarget) return;
        const x = e.clientX + 14;
        const y = e.clientY;
        // Clamp within viewport
        const maxX = window.innerWidth - tooltip.offsetWidth - 8;
        const maxY = window.innerHeight - tooltip.offsetHeight - 8;
        tooltip.style.left = Math.min(x, maxX) + 'px';
        tooltip.style.top = Math.min(y, maxY) + 'px';
    });

    document.addEventListener('mouseleave', (e) => {
        if (currentTarget && !currentTarget.contains(e.relatedTarget)) {
            tooltip.classList.remove('visible');
            currentTarget = null;
        }
    }, true);
}

// ===== IMAGE HANDLING =====
function handleImageInsert() {
    document.getElementById('imageInput').click();
}

async function processImageInput(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    try {
        const { data: { user } } = await db.auth.getUser();
        
        if (!isSandbox() && user) {
            // Upload to Cloud
            const url = await uploadMedia(file, 'lesson_note', currentNoteId);
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', url);
            quill.setSelection(range.index + 1);
        } else {
            // Fallback to local IDB
            const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const arrayBuffer = await file.arrayBuffer();
            await storeImage(id, arrayBuffer, file.type);

            const blob = new Blob([arrayBuffer], { type: file.type });
            const blobUrl = URL.createObjectURL(blob);
            blobUrlMap[blobUrl] = id;

            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', blobUrl);
            quill.setSelection(range.index + 1);
        }
    } catch (err) {
        console.error('Failed to insert image:', err);
        showToast('Failed to insert image', 'error');
    }
    inputEl.value = '';
}

async function convertBase64ImagesToIDB() {
    const images = quill.root.querySelectorAll('img[src^="data:"]');
    const { data: { user } } = await db.auth.getUser();
    const canUpload = !isSandbox() && user;

    for (const img of images) {
        const src = img.getAttribute('src');
        const match = src.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            try {
                const mimeType = match[1];
                const base64Data = match[2];
                const arrayBuffer = base64ToArrayBuffer(base64Data);
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const file = new File([blob], `pasted_image_${Date.now()}.webp`, { type: mimeType });

                if (canUpload) {
                    const url = await uploadMedia(file, 'lesson_note', currentNoteId);
                    img.setAttribute('src', url);
                } else {
                    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    await storeImage(id, arrayBuffer, mimeType);
                    const blobUrl = URL.createObjectURL(blob);
                    blobUrlMap[blobUrl] = id;
                    img.setAttribute('src', blobUrl);
                }
            } catch (e) { console.warn('Failed to convert pasted image', e); }
        }
    }
}

// No extra declarations here

function getContentForSave() {
    let html = quill.root.innerHTML;
    
    // Convert blob URLs back to idb://
    for (const [blobUrl, id] of Object.entries(blobUrlMap)) {
        html = html.split(blobUrl).join(`idb://${id}`);
    }

    // Convert signed URLs back to original cloud paths
    for (const [signedUrl, originalUrl] of Object.entries(cloudUrlMap)) {
        // Strip tokens to ensure persistent path
        const baseOriginal = originalUrl.split('?')[0];
        html = html.split(signedUrl).join(baseOriginal);
    }

    return html;
}

async function resolveImagesInHtml(html) {
    // Revoke old blob URLs
    for (const url of Object.keys(blobUrlMap)) {
        URL.revokeObjectURL(url);
    }
    blobUrlMap = {};
    cloudUrlMap = {};

    // 1. Resolve idb:// URLs
    const idbRegex = /idb:\/\/([\w_-]+)/g;
    const idbIds = Array.from(new Set([...html.matchAll(idbRegex)].map(m => m[1])));
    
    for (const id of idbIds) {
        try {
            const data = await getImage(id);
            if (data) {
                const blob = new Blob([data.data], { type: data.type });
                const blobUrl = URL.createObjectURL(blob);
                blobUrlMap[blobUrl] = id;
                html = html.split(`idb://${id}`).join(blobUrl);
            }
        } catch (e) { console.warn('Failed to load local image', id); }
    }

    // 2. Resolve Supabase URLs (klasskit-media bucket)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgs = doc.querySelectorAll('img');
    const cloudImgs = Array.from(imgs).filter(img => img.src.includes('klasskit-media'));

    for (const imgEl of cloudImgs) {
        const originalUrl = imgEl.src;
        try {
            const signedUrl = await resolveMediaUrl(originalUrl);
            if (signedUrl !== originalUrl) {
                cloudUrlMap[signedUrl] = originalUrl;
                html = html.split(originalUrl).join(signedUrl);
            }
        } catch (e) { console.warn('Failed to resolve cloud image', originalUrl); }
    }

    return html;
}

async function resolveImagesToBase64(html) {
    const regex = /idb:\/\/([\w_-]+)/g;
    let m;
    const replacements = [];
    while ((m = regex.exec(html)) !== null) {
        try {
            const data = await getImage(m[1]);
            if (data) {
                const b64 = arrayBufferToBase64(data.data);
                replacements.push({ from: `idb://${m[1]}`, to: `data:${data.type};base64,${b64}` });
            }
        } catch (e) { console.warn('PDF image resolve fail', m[1]); }
    }
    for (const { from, to } of replacements) {
        html = html.split(from).join(to);
    }
    return html;
}

// ===== TABLE HANDLING =====
function openTableDialog() {
    document.getElementById('tableDialog').classList.remove('hidden');
    document.getElementById('tableRows').value = 3;
    document.getElementById('tableCols').value = 3;
    lucide.createIcons();
}

function closeTableDialog() {
    document.getElementById('tableDialog').classList.add('hidden');
}

function confirmInsertTable() {
    const rows = parseInt(document.getElementById('tableRows').value) || 3;
    const cols = parseInt(document.getElementById('tableCols').value) || 3;
    closeTableDialog();
    insertTable(Math.min(rows, 20), Math.min(cols, 10));
}

function insertTable(rows, cols) {
    const tableModule = quill.getModule('table');
    // Ensure editor is focused and has a valid selection
    quill.focus();
    let range = quill.getSelection();
    if (!range) {
        quill.setSelection(quill.getLength(), 0);
        range = quill.getSelection();
    }
    tableModule.insertTable(rows, cols);
}

function tableAction(action) {
    const tableModule = quill.getModule('table');
    if (!tableModule) return;
    try {
        switch (action) {
            case 'insertRowAbove': tableModule.insertRowAbove(); break;
            case 'insertRowBelow': tableModule.insertRowBelow(); break;
            case 'insertColumnLeft': tableModule.insertColumnLeft(); break;
            case 'insertColumnRight': tableModule.insertColumnRight(); break;
            case 'deleteRow': tableModule.deleteRow(); break;
            case 'deleteColumn': tableModule.deleteColumn(); break;
            case 'deleteTable': tableModule.deleteTable(); break;
        }
    } catch (e) {
        console.warn('Table action failed:', action, e);
    }
}

// Floating table toolbar positioning
let tableToolbarEl = null;

function initTableToolbar() {
    tableToolbarEl = document.getElementById('table-toolbar');
    if (!tableToolbarEl || !quill) return;
    lucide.createIcons({ scope: tableToolbarEl });

    quill.on('selection-change', (range) => {
        if (!range) {
            tableToolbarEl.classList.add('hidden');
            return;
        }
        // Check if selection is inside a table cell
        const [line] = quill.getLine(range.index);
        const cell = line?.domNode?.closest?.('td');
        if (cell) {
            positionTableToolbar(cell);
        } else {
            tableToolbarEl.classList.add('hidden');
        }
    });

    // Also hide on scroll
    document.getElementById('editor-container')?.addEventListener('scroll', () => {
        tableToolbarEl.classList.add('hidden');
    });

    // Hide when clicking outside table area
    document.addEventListener('click', (e) => {
        if (!tableToolbarEl) return;
        const editor = document.getElementById('editor-container');
        if (editor && !editor.contains(e.target) && !tableToolbarEl.contains(e.target)) {
            tableToolbarEl.classList.add('hidden');
        }
    });
}

function positionTableToolbar(cell) {
    if (!tableToolbarEl) return;
    const cellRect = cell.getBoundingClientRect();
    const toolbarWidth = tableToolbarEl.offsetWidth || 280;
    // Position toolbar above the cell, right-aligned to cell (viewport coords for fixed)
    let top = cellRect.top - 44;
    let left = cellRect.right - toolbarWidth;
    // If too close to top, show below cell instead
    if (top < 10) top = cellRect.bottom + 8;
    // Clamp within viewport
    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) left = window.innerWidth - toolbarWidth - 10;
    tableToolbarEl.style.top = `${top}px`;
    tableToolbarEl.style.left = `${left}px`;
    tableToolbarEl.classList.remove('hidden');
}

// ===== OUTLINE =====
function updateOutline() {
    const outlineList = document.getElementById('outlineList');
    const editor = quill.root;
    const headings = editor.querySelectorAll('h1, h2');

    // Check if anything actually changed to avoid expensive DOM re-renders
    const currentStructure = Array.from(headings).map(h => h.tagName + h.innerText).join('|');
    if (editor._lastOutlineStructure === currentStructure) return;
    editor._lastOutlineStructure = currentStructure;

    if (headings.length === 0) {
        outlineList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-center px-6 mt-10">
                <div class="w-12 h-12 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center mb-3 text-gray-400">
                    <i data-lucide="heading" class="w-6 h-6"></i>
                </div>
                <p class="text-gray-400 text-sm font-bold">Use H1 or H2 headings to generate an outline.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    outlineList.innerHTML = '';
    headings.forEach((heading, index) => {
        const text = heading.innerText.trim();
        if (!text) return;
        const type = heading.tagName.toLowerCase();
        heading.id = `heading-${index}`;
        const item = document.createElement('div');
        item.className = `outline-link cursor-pointer mb-0.5 ${type === 'h1' ? 'font-semibold text-[13px] text-slate-700 dark:text-slate-200' : 'font-medium text-[12px] text-slate-500 dark:text-slate-400 pl-4'}`;
        item.innerText = text;
        item.onclick = () => {
            heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const orig = heading.style.backgroundColor;
            heading.style.backgroundColor = isDarkMode ? '#334155' : '#fff7ed';
            setTimeout(() => heading.style.backgroundColor = orig, 1500);
            if (window.innerWidth < 768) toggleOutline();
        };
        outlineList.appendChild(item);
    });
}

function toggleOutline() {
    const sidebar = document.getElementById('outlineSidebar');
    isOutlineOpen = !isOutlineOpen;
    if (isOutlineOpen) {
        sidebar.classList.remove('w-0', 'opacity-0');
        sidebar.classList.add('w-80', 'opacity-100');
        updateOutline();
    } else {
        sidebar.classList.remove('w-80', 'opacity-100');
        sidebar.classList.add('w-0', 'opacity-0');
    }
}

// ===== EXPORT / IMPORT =====
async function exportJSON() {
    const exportData = JSON.parse(JSON.stringify(notes));

    // Convert idb:// refs to base64 data URIs for portability
    for (const note of exportData) {
        const regex = /idb:\/\/([\w_-]+)/g;
        let m;
        const reps = [];
        while ((m = regex.exec(note.content)) !== null) {
            try {
                const data = await getImage(m[1]);
                if (data) {
                    const b64 = arrayBufferToBase64(data.data);
                    reps.push({ from: `idb://${m[1]}`, to: `data:${data.type};base64,${b64}` });
                }
            } catch (e) { console.warn('Export image failed', m[1]); }
        }
        for (const { from, to } of reps) note.content = note.content.split(from).join(to);
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `klasskit_backup_${new Date().toISOString().split('T')[0]}.json`);
    link.click();
}

function triggerImport() { document.getElementById('importInput').click(); }

async function processImport(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const confirmed = await showModal('Import Backup?', 'WARNING: This will REPLACE all current notes with the backup file. This cannot be undone.', 'Yes, Replace All', 'alert-triangle');
    if (!confirmed) { inputElement.value = ''; return; }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) { showToast('Invalid backup format', 'error'); return; }

            // Clear current notes from DB first
            for (const n of notes) {
                await deleteNoteFromDB(n.id);
            }

            // Convert base64 data URIs in imported notes to IndexedDB
            for (const note of imported) {
                const regex = /data:([^;]+);base64,([A-Za-z0-9+\/=]+)/g;
                let m;
                const reps = [];
                while ((m = regex.exec(note.content)) !== null) {
                    try {
                        const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        await storeImage(id, base64ToArrayBuffer(m[2]), m[1]);
                        reps.push({ from: m[0], to: `idb://${id}` });
                    } catch (err) { console.warn('Import image failed', err); }
                }
                for (const { from, to } of reps) note.content = note.content.split(from).join(to);
                
                await saveNoteToDB(note);
            }

            notes = await getAllNotes();
            if (isTrashMode) toggleTrashMode();
            const first = notes.find(n => !n.deleted);
            if (first) await loadNote(first.id);
            else await createNewNote();
            renderNotesList();
            showToast('Backup restored!', 'success');
        } catch (err) {
            showToast('Error parsing file', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
    inputElement.value = '';
}

// ===== TRASH MODE =====
function toggleTrashMode(targetNoteId = null) {
    isTrashMode = !isTrashMode;
    const trashBtn = document.getElementById('trashToggleBtn');
    const trashHeader = document.getElementById('trashHeader');
    const newNoteBtn = document.getElementById('newNoteBtn');

    if (isTrashMode) {
        trashBtn.classList.replace('bg-gray-200', 'bg-pink');
        trashBtn.classList.replace('text-dark', 'text-white');
        trashHeader.classList.remove('hidden');
        newNoteBtn.classList.add('opacity-50', 'pointer-events-none');
        const firstTrash = targetNoteId || notes.find(n => n.deleted)?.id;
        if (firstTrash) { loadNote(firstTrash); }
        else {
            currentNoteId = null;
            document.getElementById('noteTitle').value = "";
            updateBreadcrumb();
            quill.root.innerHTML = '<p style="text-align:center;color:#94a3b8;margin-top:20vh;">Trash is empty</p>';
            quill.disable();
            renderNotesList();
        }
    } else {
        trashBtn.classList.replace('bg-pink', 'bg-gray-200');
        trashBtn.classList.replace('text-white', 'text-dark');
        trashHeader.classList.add('hidden');
        newNoteBtn.classList.remove('opacity-50', 'pointer-events-none');
        quill.enable();
        const activeId = targetNoteId || notes.find(n => !n.deleted)?.id;
        if (activeId) loadNote(activeId);
        else createNewNote();
    }
    renderNotesList();
    updateUIState();
}

function updateUIState() {
    const softDelBtn = document.getElementById('softDeleteBtn');
    const trashButtons = document.getElementById('trashButtons');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    if (isTrashMode) {
        softDelBtn.classList.add('hidden');
        trashButtons.classList.remove('hidden');
        statusIndicator.className = "w-3 h-3 rounded-full bg-pink border-[1px] border-slate-300 dark:border-white/10";
        statusText.innerText = "Deleted Note";
        document.getElementById('noteTitle').disabled = true;
        quill.disable();
    } else {
        softDelBtn.classList.remove('hidden');
        trashButtons.classList.add('hidden');
        statusIndicator.className = "w-3 h-3 rounded-full bg-green border-[1px] border-slate-300 dark:border-white/10";
        statusText.innerText = "Auto-saved";
        document.getElementById('noteTitle').disabled = false;
        quill.enable();
    }
}

// ===== NOTE CRUD =====
async function createNewNote() {
    if (isTrashMode) return;
    // Create root-level note by default
    const newNote = { id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), deleted: false, parentId: null };
    notes.unshift(newNote);
    await saveNoteToDB(newNote);
    saveToCloud();
    await loadNote(newNote.id);
    if (window.innerWidth < 768) toggleSidebar();
}

async function loadNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) {
        showToast('Note not found', 'error');
        return;
    }

    if (note.deleted && !isTrashMode) {
        const confirmed = await showModal('Restore Note?', 'This note is in the Trash. Would you like to restore it to view?', 'Restore Note');
        if (confirmed) {
            note.deleted = false;
            note.updatedAt = Date.now();
            await saveNoteToDB(note);
            saveToCloud();
        } else {
            return;
        }
    } else if (!note.deleted && isTrashMode) {
        toggleTrashMode(id);
        return;
    }

    currentNoteId = id;
    currentNoteParentId = note.parentId || null;
    if (!isTrashMode) await saveSetting('lastActiveNoteId', id);

    // Expand all parents in the tree so the current note is visible
    let parent = notes.find(n => n.id === note.parentId);
    while (parent) {
        expandedParents.add(parent.id);
        parent = notes.find(n => n.id === parent.parentId);
    }

    document.getElementById('noteTitle').value = note.title;

    // Update breadcrumb (replaces headerNoteTitle)
    updateBreadcrumb();

    // Resolve idb:// image URLs
    const resolvedHtml = await resolveImagesInHtml(note.content);
    quill.root.innerHTML = resolvedHtml;

    renderNotesList();
    updateOutline();
    updateUIState();
}

async function saveCurrentNote() {
    if (!currentNoteId || isTrashMode) return;
    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        const note = notes[noteIndex];
        note.title = document.getElementById('noteTitle').value;
        note.content = getContentForSave();
        note.updatedAt = Date.now();
        note.parentId = note.parentId || null;
        updateBreadcrumb();

        // Update cache
        strippedContentCache.set(note.id, fastStripHtml(note.content).toLowerCase());
        
        notes.splice(noteIndex, 1);
        notes.unshift(note);
        await saveNoteToDB(note);
        saveToCloud(); // Fire and forget cloud sync
    }
}

async function softDeleteCurrentNote() {
    if (!currentNoteId) return;
    const confirmed = await showModal('Move to Trash?', 'You can restore this note later from the Trash bin.', 'Trash It');
    if (confirmed) {
        const noteIndex = notes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            notes[noteIndex].deleted = true;
            notes[noteIndex].updatedAt = Date.now();
            await saveNoteToDB(notes[noteIndex]);
            const nextNote = notes.find(n => !n.deleted);
            if (nextNote) await loadNote(nextNote.id);
            else await createNewNote();
        }
    }
}

async function deleteImagesInContent(content) {
    if (!content) return;
    // 1. Local images
    const localRegex = /idb:\/\/([\w_-]+)/g;
    let m;
    while ((m = localRegex.exec(content)) !== null) {
        try { await deleteImage(m[1]); } catch (e) { console.warn('Failed to delete local image', m[1]); }
    }
    // 2. Cloud images
    const cloudRegex = /https:\/\/[^"'\s]+\/storage\/v1\/object\/public\/klasskit-media\/[^"'\s]+/g;
    const cloudMatches = content.match(cloudRegex) || [];
    for (const cloudUrl of cloudMatches) {
        try {
            await deleteMediaFromUrl(cloudUrl);
        } catch (e) { console.warn('Failed to delete cloud image', cloudUrl); }
    }
}

async function permanentDeleteCurrentNote() {
    if (!currentNoteId) return;
    const confirmed = await showModal('Delete Forever?', 'This action cannot be undone. The note will be gone.', 'Delete Forever');
    if (confirmed) {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            await deleteImagesInContent(note.content);
            await deleteNoteFromDB(note.id);
        }
        notes = notes.filter(n => n.id !== currentNoteId);
        saveToCloud();
        const nextTrash = notes.find(n => n.deleted);
        if (nextTrash) { 
            await loadNote(nextTrash.id); 
        } else {
            currentNoteId = null;
            document.getElementById('noteTitle').value = "";
            updateBreadcrumb();
            quill.root.innerHTML = '<p style="text-align:center;color:#94a3b8;margin-top:20vh;">Trash is empty</p>';
            renderNotesList();
        }
    }
}

async function emptyTrash() {
    const trashedNotes = notes.filter(n => n.deleted);
    if (trashedNotes.length === 0) return;

    const confirmed = await showModal(
        'Empty Trash?',
        `This will permanently delete ${trashedNotes.length} note(s). This cannot be undone.`,
        'Delete All',
        'flame'
    );
    if (!confirmed) return;

    for (const note of trashedNotes) {
        await deleteImagesInContent(note.content);
        await deleteNoteFromDB(note.id);
    }
    notes = notes.filter(n => !n.deleted);
    saveToCloud();

    currentNoteId = null;
    document.getElementById('noteTitle').value = "";
    updateBreadcrumb();
    quill.root.innerHTML = "<p>Trash is empty.</p>";
    renderNotesList();
}

async function purgeExpiredTrash() {
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = notes.filter(n => n.deleted && (now - n.updatedAt) > TWO_WEEKS);
    if (expired.length === 0) return;

    for (const note of expired) {
        await deleteImagesInContent(note.content);
        await deleteNoteFromDB(note.id);
    }
    notes = notes.filter(n => !expired.some(e => e.id === n.id));
    saveToCloud();
    console.log(`Auto-purged ${expired.length} expired trash note(s).`);
}

async function restoreCurrentNote() {
    if (!currentNoteId) return;
    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        notes[noteIndex].deleted = false;
        notes[noteIndex].updatedAt = Date.now();
        await saveNoteToDB(notes[noteIndex]);
        saveToCloud();
        const nextTrash = notes.find(n => n.deleted);
        if (nextTrash) {
            await loadNote(nextTrash.id);
        } else {
            toggleTrashMode();
            await loadNote(notes[noteIndex].id);
            return;
        }
        renderNotesList();
    }
}

// ===== CLOUD SYNC =====
async function saveToCloud() {
    if (isSandbox()) return;
    const user = await getUser();
    if (!user) return;

    const statusText = document.getElementById('statusText');
    if (statusText) statusText.innerText = 'Syncing...';

    try {
        // Save only the current note, not all notes
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            await db.from('notes').upsert({
                id: note.id,
                user_id: user.id,
                title: note.title || '',
                content: note.content || '',
                parent_id: note.parentId || null,
                deleted: note.deleted || false,
                updated_at: note.updatedAt
            }, { onConflict: 'id,user_id' });
        }

        // Expanded state for tree view is stored locally
        await saveSetting('expandedParents', Array.from(expandedParents));

        if (statusText) statusText.innerText = 'Cloud Synced';
        setTimeout(() => {
            if (statusText?.innerText === 'Cloud Synced') statusText.innerText = 'Auto-saved';
        }, 3000);
    } catch (e) {
        console.warn('Cloud save failed', e);
        if (statusText) statusText.innerText = 'Sync Error';
    }
}

async function loadFromCloud() {
    if (isSandbox()) return;
    const user = await getUser();
    if (!user) return;

    try {
        // Load all notes for this user
        const { data: cloudNotes, error } = await db
            .from('notes')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        if (cloudNotes?.length) {
            let hasChanges = false;
            for (const cn of cloudNotes) {
                const localNote = notes.find(n => n.id === cn.id);
                if (!localNote || cn.updated_at > localNote.updatedAt) {
                    const mapped = {
                        id: cn.id,
                        title: cn.title,
                        content: cn.content,
                        parentId: cn.parent_id,
                        deleted: cn.deleted,
                        updatedAt: cn.updated_at
                    };
                    await saveNoteToDB(mapped);
                    hasChanges = true;
                }
            }
            if (hasChanges) {
                notes = await getAllNotes();
            }
        }

        // Load expanded state
        const savedExpanded = await getSetting('expandedParents');
        if (savedExpanded) {
            expandedParents = new Set(savedExpanded);
        }

    } catch (e) {
        console.error('Cloud load failed', e);
    }
}

// ===== SORT HELPERS =====
function sortNotes(notesList) {
    const sorted = [...notesList];
    switch (sortMode) {
        case 'date-desc': return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
        case 'date-asc': return sorted.sort((a, b) => a.updatedAt - b.updatedAt);
        case 'title-asc': return sorted.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
        case 'title-desc': return sorted.sort((a, b) => (b.title || 'Untitled').localeCompare(a.title || 'Untitled'));
        case 'manual': return sorted.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        case 'tree': return sorted.sort((a, b) => (a.updatedAt - b.updatedAt));
        default: return sorted;
    }
}

function toggleSortDropdown() {
    const dropdown = document.getElementById('sortDropdown');
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        lucide.createIcons({ scope: dropdown });
    }
}

async function setSortMode(mode) {
    sortMode = mode;
    await saveSetting('sortMode', mode);
    updateSortDropdownUI();
    document.getElementById('sortDropdown').classList.add('hidden');
    renderNotesList();
    showToast(`Sorted: ${getSortLabel(mode)}`, 'info');
}

function getSortLabel(mode) {
    const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'title-asc': 'A → Z', 'title-desc': 'Z → A', 'manual': 'Manual', 'tree': 'Hierarchy' };
    return labels[mode] || mode;
}

function updateSortDropdownUI() {
    document.querySelectorAll('#sortDropdown button').forEach(btn => {
        btn.classList.toggle('active-sort', btn.dataset.sort === sortMode);
    });
}

// ===== DRAG AND DROP =====
function handleDragStart(e, noteId) {
    draggedNoteId = noteId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
    setTimeout(() => {
        const el = document.querySelector(`[data-note-id="${noteId}"]`);
        if (el) el.classList.add('note-dragging');
    }, 0);
}

function handleDragEnd() {
    document.querySelectorAll('.note-dragging').forEach(el => el.classList.remove('note-dragging'));
    document.querySelectorAll('.nest-drop-target').forEach(el => el.classList.remove('nest-drop-target'));
    document.querySelectorAll('.drop-indicator, .nest-drop-indicator').forEach(el => el.remove());
    draggedNoteId = null;
}

function setupRootDropTarget() {
    const list = document.getElementById('notesList');
    if (!list) return;
    
    list.addEventListener('dragover', (e) => {
        if (!draggedNoteId) return;
        e.preventDefault();
        // Only show root target when dragging near top of list
        if (e.clientY < list.getBoundingClientRect().top + 50) {
            list.classList.add('root-drop-target');
        }
    });
    
    list.addEventListener('dragleave', () => {
        list.classList.remove('root-drop-target');
    });
    
    list.addEventListener('drop', async (e) => {
        e.preventDefault();
        list.classList.remove('root-drop-target');
        const noteId = e.dataTransfer.getData('text/plain');
        if (!noteId) return;
        
        const note = notes.find(n => n.id === noteId);
        if (note && note.parentId) {
            await nestNote(noteId, null);
        }
    });
}


// ===== RENDER NOTES LIST (TREE VIEW) =====
function renderNotesList() {
    const list = document.getElementById('notesList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    list.innerHTML = '';

    // Filter by trash/active mode
    const modeFiltered = notes.filter(n => isTrashMode ? n.deleted === true : n.deleted !== true);

    // If searching or in trash mode, render flat list
    if (search || isTrashMode) {
        const filtered = modeFiltered.filter(n => {
            if (!search) return true;
            if (!strippedContentCache.has(n.id)) {
                strippedContentCache.set(n.id, fastStripHtml(n.content).toLowerCase());
            }
            const contentMatch = strippedContentCache.get(n.id).includes(search);
            const titleMatch = (n.title || 'Untitled').toLowerCase().includes(search);
            return titleMatch || contentMatch;
        });
        if (filtered.length === 0) {
            const emptyMsg = isTrashMode
                ? `<div class="flex flex-col items-center justify-center py-10 text-center"><i data-lucide="trash-2" class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-sm text-slate-400 dark:text-slate-500 font-medium">Trash is empty</p></div>`
                : (search
                    ? `<div class="flex flex-col items-center justify-center py-10 text-center"><i data-lucide="search" class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-sm text-slate-400 dark:text-slate-500 font-medium">No notes found</p><p class="text-xs text-slate-400 dark:text-slate-600 mt-1">Try a different search</p></div>`
                    : `<div class="flex flex-col items-center justify-center py-10 text-center"><i data-lucide="pen-tool" class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-sm text-slate-400 dark:text-slate-500 font-medium">No notes yet</p><p class="text-xs text-slate-400 dark:text-slate-600 mt-1">Click "New page" to get started</p></div>`);
            list.innerHTML = emptyMsg;
            lucide.createIcons({ scope: list });
            return;
        }
        const sortedFiltered = sortNotes(filtered);
        const fragment = document.createDocumentFragment();
        sortedFiltered.forEach(note => fragment.appendChild(buildNoteItem(note, sortedFiltered, 0)));
        list.appendChild(fragment);
        lucide.createIcons({ scope: list });
        return;
    }

    // ── TREE VIEW ──
    const fragment = document.createDocumentFragment();

    // Get root notes (no parent or parent doesn't exist)
    const rootNotes = sortNotes(modeFiltered.filter(n => {
        if (!n.parentId) return true;
        const parent = notes.find(p => p.id === n.parentId);
        return !parent || parent.deleted;
    }));

    function renderTreeRecursive(notesList, parentId, level, parentEl) {
        notesList.forEach(note => {
            const noteEl = buildNoteItem(note, notesList, level);
            parentEl.appendChild(noteEl);

            // Render children if expanded
            const children = sortNotes(getNoteChildren(note.id));
            if (children.length > 0 && expandedParents.has(note.id)) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                childrenContainer.style.paddingLeft = `${12 + (level * 8)}px`;
                renderTreeRecursive(children, note.id, level + 1, childrenContainer);
                parentEl.appendChild(childrenContainer);
            }
        });
    }

    if (rootNotes.length === 0 && modeFiltered.length === 0) {
        list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-center"><i data-lucide="pen-tool" class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-sm text-slate-400 dark:text-slate-500 font-medium">No notes yet</p><p class="text-xs text-slate-400 dark:text-slate-600 mt-1">Click "New page" to get started</p></div>`;
        lucide.createIcons({ scope: list });
        return;
    }

    renderTreeRecursive(rootNotes, null, 0, fragment);
    list.appendChild(fragment);
    lucide.createIcons({ scope: list });
}

function buildNoteItem(note, groupNotes, level = 0) {
    const el = document.createElement('div');
    const title = note.title || 'Untitled';
    const date = new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isActive = note.id === currentNoteId;
    const children = getNoteChildren(note.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedParents.has(note.id);
    
    let baseClasses = "note-item cursor-pointer relative group/note";
    if (isActive) baseClasses += isTrashMode ? " active-trash" : " active";
    if (hasChildren) baseClasses += " has-children";
    el.className = baseClasses;
    el.dataset.noteId = note.id;
    el.style.paddingLeft = `${8 + (level * 12)}px`;

    // Make draggable (not in trash mode)
    if (!isTrashMode) {
        el.draggable = true;
        el.addEventListener('dragstart', (e) => handleDragStart(e, note.id));
        el.addEventListener('dragend', handleDragEnd);
        setupNoteTreeDrop(el, note.id);
    }

    el.onclick = (e) => {
        if (e.target.closest('.note-ctx-trigger') || e.target.closest('.drag-handle') || e.target.closest('.expand-btn')) return;
        loadNote(note.id);
        if (window.innerWidth < 768) toggleSidebar();
    };

    if (!strippedContentCache.has(note.id)) {
        strippedContentCache.set(note.id, fastStripHtml(note.content).toLowerCase());
    }
    const rawText = strippedContentCache.get(note.id) || "";
    const titleColor = isActive ? (isTrashMode ? 'text-pink-500' : 'text-slate-900 dark:text-white') : 'text-slate-700 dark:text-slate-300';
    
    // Expand/collapse button for notes with children
    const expandBtn = hasChildren 
        ? `<button class="expand-btn flex-none p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400" onclick="event.stopPropagation(); toggleParent('${note.id}')">
            <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-3 h-3"></i>
        </button>` 
        : '<span class="w-4 flex-none"></span>';

    el.innerHTML = `
        <div class="flex items-center gap-1 min-w-0">
            ${expandBtn}
            ${!isTrashMode ? '<i data-lucide="grip-vertical" class="drag-handle w-3 h-3 flex-none text-slate-300 dark:text-slate-600 opacity-0 group-hover/note:opacity-100"></i>' : '<span class="w-3 flex-none"></span>'}
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="font-medium text-[13px] truncate ${titleColor}">${title}</h4>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 flex-none">${date}</span>
                </div>
                <p class="text-[11px] ${isActive ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'} truncate mt-0.5">${rawText.substring(0, 50) || 'Empty note...'}</p>
            </div>
            ${!isTrashMode ? `<button class="note-ctx-trigger opacity-0 group-hover/note:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded transition-all flex-none" onclick="event.stopPropagation(); showNoteContextMenu(event, '${note.id}')">
                <i data-lucide="more-vertical" class="w-3 h-3 pointer-events-none"></i>
            </button>` : ''}
        </div>`;
    return el;
}

// Tree-aware drag and drop
function setupNoteTreeDrop(noteEl, targetNoteId) {
    noteEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedNoteId === targetNoteId) return;
        
        const rect = noteEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        // Clear existing indicators
        document.querySelectorAll('.drop-indicator, .nest-drop-indicator').forEach(el => el.remove());
        
        // Determine drop zone: above, inside (nest), or below
        const relativeY = e.clientY - rect.top;
        const zoneHeight = rect.height / 3;
        
        if (relativeY < zoneHeight) {
            // Drop above
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            noteEl.parentElement.insertBefore(indicator, noteEl);
        } else if (relativeY > rect.height - zoneHeight) {
            // Drop below
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            noteEl.parentElement.insertBefore(indicator, noteEl.nextSibling);
        } else {
            // Nest inside (middle zone)
            const indicator = document.createElement('div');
            indicator.className = 'nest-drop-indicator';
            indicator.textContent = 'Drop to nest inside';
            noteEl.appendChild(indicator);
            noteEl.classList.add('nest-drop-target');
        }
    });

    noteEl.addEventListener('dragleave', () => {
        document.querySelectorAll('.drop-indicator, .nest-drop-indicator').forEach(el => el.remove());
        noteEl.classList.remove('nest-drop-target');
    });

    noteEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.drop-indicator, .nest-drop-indicator').forEach(el => el.remove());
        noteEl.classList.remove('nest-drop-target');
        
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === targetNoteId) return;
        
        const draggedNote = notes.find(n => n.id === draggedId);
        const targetNote = notes.find(n => n.id === targetNoteId);
        if (!draggedNote || !targetNote) return;
        
        // Check for circular reference
        const descendants = getNoteDescendants(draggedId);
        if (descendants.some(d => d.id === targetNoteId)) {
            showToast('Cannot nest into own children', 'error');
            return;
        }
        
        const rect = noteEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const zoneHeight = rect.height / 3;
        
        if (relativeY < zoneHeight) {
            // Drop above - same parent as target
            await moveNoteToParent(draggedId, targetNote.parentId, targetNoteId, 'before');
        } else if (relativeY > rect.height - zoneHeight) {
            // Drop below - same parent as target
            await moveNoteToParent(draggedId, targetNote.parentId, targetNoteId, 'after');
        } else {
            // Nest inside target
            await nestNote(draggedId, targetNoteId);
            expandedParents.add(targetNoteId);
        }
        
        renderNotesList();
    });
}

async function moveNoteToParent(noteId, newParentId, targetId, position) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    note.parentId = newParentId;
    note.updatedAt = Date.now();
    
    // Update sort order based on position
    const siblings = getNoteSiblings(noteId).filter(n => n.id !== noteId);
    const targetIndex = siblings.findIndex(n => n.id === targetId);
    
    if (position === 'before' && targetIndex !== -1) {
        siblings.splice(targetIndex, 0, note);
    } else if (position === 'after' && targetIndex !== -1) {
        siblings.splice(targetIndex + 1, 0, note);
    } else {
        siblings.push(note);
    }
    
    // Reassign sort orders
    for (let i = 0; i < siblings.length; i++) {
        siblings[i].sortOrder = i;
        await saveNoteToDB(siblings[i]);
    }
    
    await saveNoteToDB(note);
    saveToCloud();
    showToast(newParentId ? 'Note moved' : 'Note moved to root', 'success');
}

// ===== FOLDER CRUD =====
// ===== TREE NAVIGATION =====
function getNotePath(noteId) {
    const path = [];
    let current = notes.find(n => n.id === noteId);
    while (current) {
        path.unshift(current);
        current = notes.find(n => n.id === current.parentId);
    }
    return path;
}

function getNoteChildren(parentId) {
    return notes.filter(n => n.parentId === parentId && !n.deleted);
}

function getNoteDescendants(noteId) {
    const descendants = [];
    const children = getNoteChildren(noteId);
    for (const child of children) {
        descendants.push(child);
        descendants.push(...getNoteDescendants(child.id));
    }
    return descendants;
}

function getNoteSiblings(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return [];
    return notes.filter(n => n.parentId === note.parentId && !n.deleted);
}

function toggleParent(noteId) {
    if (expandedParents.has(noteId)) {
        expandedParents.delete(noteId);
    } else {
        expandedParents.add(noteId);
    }
    renderNotesList();
}

async function nestNote(noteId, targetParentId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Prevent nesting into itself or its descendants (circular reference)
    if (targetParentId === noteId) return;
    const descendants = getNoteDescendants(noteId);
    if (descendants.some(d => d.id === targetParentId)) return;
    
    note.parentId = targetParentId;
    note.updatedAt = Date.now();
    
    // Auto-expand the new parent
    if (targetParentId) {
        expandedParents.add(targetParentId);
    }
    
    await saveNoteToDB(note);
    saveToCloud();
    renderNotesList();
    showToast(targetParentId ? 'Note nested' : 'Note moved to root', 'success');
}

async function unnestNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.parentId) return;
    
    const oldParent = note.parentId;
    const oldParentNote = notes.find(n => n.id === oldParent);
    
    // Move to same level as parent (become sibling of parent)
    note.parentId = oldParentNote?.parentId || null;
    note.updatedAt = Date.now();
    
    await saveNoteToDB(note);
    saveToCloud();
    renderNotesList();
    showToast('Note unnested', 'success');
}

function updateBreadcrumb() {
    const container = document.getElementById('breadcrumbNav');
    if (!container) return;
    
    const path = currentNoteId ? getNotePath(currentNoteId) : [];
    if (path.length === 0) {
        container.innerHTML = '<span class="text-slate-400">Notes</span>';
        return;
    }
    
    const html = path.map((note, idx) => {
        const isLast = idx === path.length - 1;
        const title = note.title || 'Untitled';
        if (isLast) {
            return `<span class="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px] md:max-w-xs" title="${escapeHtml(title)}">${escapeHtml(title)}</span>`;
        }
        return `<button onclick="loadNote('${note.id}')" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 truncate max-w-[120px]" title="${escapeHtml(title)}">${escapeHtml(title)}</button><span class="text-slate-300">/</span>`;
    }).join('');
    
    container.innerHTML = html;
}

// ===== CONTEXT MENUS =====
function showNoteContextMenu(e, noteId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu fixed z-50 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[180px] animate-pop';

    const note = notes.find(n => n.id === noteId);
    const hasParent = note && note.parentId;
    const children = note ? getNoteChildren(noteId) : [];
    
    let items = '';
    
    // Tree actions
    if (hasParent) {
        items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); nestNote('${noteId}', null)">
            <i data-lucide="arrow-up-left" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Move to Root
        </button>`;
        items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); unnestNote('${noteId}')">
            <i data-lucide="arrow-up" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Unnest (Outdent)
        </button>`;
        items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1 mx-2"></div>`;
    }
    
    // Create sub-page
    items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); createChildNote('${noteId}')">
        <i data-lucide="file-plus" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Create Sub-page
    </button>`;
    
    // Stats
    const descendantCount = getNoteDescendants(noteId).length;
    if (children.length > 0 || descendantCount > 0) {
        items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1 mx-2"></div>`;
        items += `<div class="px-3 py-1 text-[11px] text-slate-400 dark:text-slate-500">${children.length} sub-pages${descendantCount > children.length ? ` (${descendantCount} total)` : ''}</div>`;
    }
    
    items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1 mx-2"></div>`;
    
    // Delete
    items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors mx-1" onclick="document.querySelectorAll('.note-ctx-menu').forEach(m=>m.remove()); softDeleteNote('${noteId}')">
        <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Move to Trash
    </button>`;

    menu.innerHTML = items;

    const rect = e.target.closest('.note-ctx-trigger').getBoundingClientRect();
    const sidebarRect = document.getElementById('notesList').getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 250) + 'px';
    menu.style.left = Math.min(rect.left - 140, sidebarRect.right - 200) + 'px';

    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });

    // Close on outside click
    requestAnimationFrame(() => {
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    });
}

function showNoteTreeMenu(e, noteId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu fixed z-50 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[180px] animate-pop';
    
    const children = getNoteChildren(noteId);
    const hasParent = !!note.parentId;
    
    let items = '';
    
    // Move to root
    if (hasParent) {
        items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); nestNote('${noteId}', null)">
            <i data-lucide="arrow-up-left" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Move to Root
        </button>`;
    }
    
    // Unnest (move to parent's level)
    if (hasParent) {
        items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); unnestNote('${noteId}')">
            <i data-lucide="arrow-up" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Unnest (Outdent)
        </button>`;
    }
    
    // Create child note
    items += `<button class="w-full text-left px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors mx-1" onclick="this.closest('.note-ctx-menu').remove(); createChildNote('${noteId}')">
        <i data-lucide="file-plus" class="w-3.5 h-3.5 pointer-events-none flex-none"></i> Create Sub-page
    </button>`;
    
    if (hasParent || children.length > 0) {
        items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1 mx-2"></div>`;
    }
    
    // Stats
    const descendantCount = getNoteDescendants(noteId).length;
    if (children.length > 0 || descendantCount > 0) {
        items += `<div class="px-3 py-1 text-[11px] text-slate-400 dark:text-slate-500">${children.length} sub-pages${descendantCount > children.length ? ` (${descendantCount} total)` : ''}</div>`;
    }
    
    menu.innerHTML = items;
    
    const rect = e.target.getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 200) + 'px';
    menu.style.left = Math.max(rect.left - 140, 8) + 'px';
    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });
    
    requestAnimationFrame(() => {
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    });
}

async function createChildNote(parentId) {
    if (isTrashMode) return;
    const newNote = { id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), deleted: false, parentId: parentId };
    notes.unshift(newNote);
    expandedParents.add(parentId);
    await saveNoteToDB(newNote);
    saveToCloud();
    await loadNote(newNote.id);
    renderNotesList();
    if (window.innerWidth < 768) toggleSidebar();
}

async function softDeleteNote(noteId) {
    const confirmed = await showModal('Move to Trash?', 'You can restore this note later from the Trash bin.', 'Trash It');
    if (!confirmed) return;
    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
        notes[noteIndex].deleted = true;
        notes[noteIndex].updatedAt = Date.now();
        await saveNoteToDB(notes[noteIndex]);
        if (noteId === currentNoteId) {
            const nextNote = notes.find(n => !n.deleted);
            if (nextNote) await loadNote(nextNote.id);
            else await createNewNote();
        }
        renderNotesList();
        saveToCloud();
    }
}

// ===== UTILITY =====
function stripHtml(html) { const t = document.createElement("DIV"); t.innerHTML = html; return t.textContent || t.innerText || ""; }
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }

function toggleZenMode() {
    const sidebar = document.getElementById('sidebar');
    const btnIcon = document.getElementById('zenModeIcon');
    const btnText = document.getElementById('zenModeText');
    isZenMode = !isZenMode;
    if (isZenMode) {
        sidebar.classList.add('md:w-0', 'md:opacity-0', 'md:border-none');
        sidebar.classList.remove('md:w-80', 'border-r-3');
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'minimize-2');
        if (btnText) btnText.textContent = 'Exit Zen';
        if (isOutlineOpen) toggleOutline();
    } else {
        sidebar.classList.remove('md:w-0', 'md:opacity-0', 'md:border-none');
        sidebar.classList.add('md:w-80', 'border-r-3');
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'maximize-2');
        if (btnText) btnText.textContent = 'Zen Mode';
    }
    lucide.createIcons();
}

async function exportPDF() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const status = document.getElementById('statusText');
    if (status) status.textContent = 'Generating PDF...';

    try {
        const printEl = document.getElementById('print-container');
        const printBody = document.getElementById('print-body');
        document.getElementById('print-title').textContent = note.title || 'Untitled';
        document.getElementById('print-date').textContent = new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Resolve all images to base64 for PDF reliability
        const resolvedHtml = await resolveImagesToBase64(note.content);
        printBody.innerHTML = resolvedHtml;
        printBody.className = 'print-body';

        printEl.classList.remove('hidden');

        const opt = {
            margin: [0.6, 0.6, 0.6, 0.6],
            filename: `${(note.title || 'note').replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(printEl).save();
        printEl.classList.add('hidden');
        showToast('PDF exported', 'success');
    } catch (err) {
        console.error('PDF Export Error:', err);
        showToast('PDF export failed', 'error');
        if (status) status.textContent = 'PDF failed';
    }
}

// ===== MARKDOWN EXPORT =====
function htmlToMarkdown(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    function walk(node, depth = 0) {
        if (!node) return '';

        // Text node
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();
        const children = Array.from(node.childNodes).map(c => walk(c, depth)).join('');

        switch (tag) {
            case 'h1': return `\n# ${children.trim()}\n\n`;
            case 'h2': return `\n## ${children.trim()}\n\n`;
            case 'h3': return `\n### ${children.trim()}\n\n`;
            case 'h4': return `\n#### ${children.trim()}\n\n`;
            case 'h5': return `\n##### ${children.trim()}\n\n`;
            case 'h6': return `\n###### ${children.trim()}\n\n`;
            case 'p': {
                // Check for data-list attribute (Quill checklists)
                if (node.hasAttribute('data-list')) {
                    const checked = node.getAttribute('data-list') === 'checked';
                    return `- [${checked ? 'x' : ' '}] ${children.trim()}\n`;
                }
                return `${children.trim()}\n\n`;
            }
            case 'br': return '\n';
            case 'strong':
            case 'b': return `**${children}**`;
            case 'em':
            case 'i': return `*${children}*`;
            case 'u': return `<u>${children}</u>`;
            case 's':
            case 'strike':
            case 'del': return `~~${children}~~`;
            case 'a': {
                const href = node.getAttribute('href') || '';
                return `[${children}](${href})`;
            }
            case 'img': {
                const src = node.getAttribute('src') || '';
                const alt = node.getAttribute('alt') || '';
                return `\n![${alt}](${src})\n\n`;
            }
            case 'blockquote': return `\n> ${children.trim().split('\n').join('\n> ')}\n\n`;
            case 'code': return `\`${children}\``;
            case 'pre': return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
            case 'hr': return '\n---\n\n';
            case 'ul': {
                const items = Array.from(node.children).map(li => {
                    const inner = walk(li, depth + 1).trim();
                    return `\n- ${inner}`;
                }).join('');
                return `${items}\n\n`;
            }
            case 'ol': {
                let idx = 1;
                const items = Array.from(node.children).map(li => {
                    const inner = walk(li, depth + 1).trim();
                    return `\n${idx++}. ${inner}`;
                }).join('');
                return `${items}\n\n`;
            }
            case 'li': {
                // Already handled by ul/ol wrapper
                return children;
            }
            case 'table': {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                const cells = rows.map(tr => Array.from(tr.querySelectorAll('td, th')).map(td => walk(td).trim().replace(/\|/g, '\\|')));
                if (cells.length === 0 || cells[0].length === 0) return '';
                const widths = cells[0].map((_, i) => Math.max(...cells.map(r => r[i]?.length || 0), 3));
                const pad = (s, w) => (s || '').padEnd(w, ' ');
                const makeRow = (row) => '| ' + row.map((c, i) => pad(c, widths[i])).join(' | ') + ' |';
                const separator = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
                let result = '\n' + makeRow(cells[0]) + '\n' + separator;
                for (let i = 1; i < cells.length; i++) {
                    result += '\n' + makeRow(cells[i]);
                }
                return result + '\n\n';
            }
            case 'td':
            case 'th':
                // Handled by table wrapper; return raw children
                return children;
            case 'div':
            case 'span':
                return children;
            default:
                return children;
        }
    }

    return walk(temp).trim();
}

async function exportMarkdown() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    try {
        // Resolve images to base64 data URIs so markdown has embedded images
        const resolvedHtml = await resolveImagesToBase64(note.content);
        const md = htmlToMarkdown(resolvedHtml);
        const frontmatter = `---\ntitle: ${note.title || 'Untitled'}\ndate: ${new Date(note.updatedAt).toISOString()}\n---\n\n`;
        const fullMd = frontmatter + md;

        const blob = new Blob([fullMd], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(note.title || 'note').replace(/\s+/g, '_')}.md`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Markdown exported', 'success');
    } catch (err) {
        console.error('Markdown Export Error:', err);
        showToast('Markdown export failed', 'error');
    }
}

function showModal(title, desc, confirmText, iconName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const titleEl = document.getElementById('modalTitle');
        const descEl = document.getElementById('modalDesc');
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        const iconEl = document.getElementById('modalIcon');
        if (title) titleEl.innerText = title;
        if (desc) descEl.innerText = desc;
        if (confirmText) confirmBtn.innerText = confirmText;
        if (iconName) { iconEl.setAttribute('data-lucide', iconName); lucide.createIcons(); }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            iconEl.setAttribute('data-lucide', 'trash-2');
            lucide.createIcons();
            resolve(value);
        };
        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

function showPrompt(title, desc, iconName, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const titleEl = document.getElementById('promptTitle');
        const descEl = document.getElementById('promptDesc');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        const iconEl = document.getElementById('promptIcon');
        const inputEl = document.getElementById('promptInput');

        titleEl.innerText = title;
        descEl.innerText = desc;
        inputEl.value = defaultValue;
        if (iconName) { iconEl.setAttribute('data-lucide', iconName); lucide.createIcons(); }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        inputEl.focus();
        inputEl.select();

        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(value);
        };

        confirmBtn.onclick = () => cleanup(inputEl.value);
        cancelBtn.onclick = () => cleanup(null);
        inputEl.onkeydown = (e) => {
            if(e.key === 'Enter') cleanup(inputEl.value);
            if(e.key === 'Escape') cleanup(null);
        };
    });
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
        success: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
        error: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
        info: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        folder: "bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    };

    const icons = {
        success: "check-circle",
        error: "alert-circle",
        info: "info",
        folder: "folder",
    };

    toast.className = `${colors[type] || colors.success} px-4 py-2.5 rounded-lg border shadow-sm text-sm font-medium flex items-center gap-2 pointer-events-auto animate-pop`;
    toast.innerHTML = `<i data-lucide="${icons[type] || icons.success}" class="w-4 h-4 flex-none"></i> ${message}`;

    container.appendChild(toast);
    lucide.createIcons({ scope: toast });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== NOTE LINKING FUNCTIONALITY =====
function checkNoteLinkTrigger() {
    const range = quill.getSelection();
    if (!range || range.length > 0) {
        closeNoteLinkSuggestions();
        return;
    }

    const index = range.index;
    const textBefore = quill.getText(0, index);
    
    if (!noteLinkSearchActive) {
        if (textBefore.endsWith('[[')) {
            noteLinkSearchActive = true;
            noteLinkTriggerIndex = index - 2;
            noteLinkActiveIndex = 0;
            showNoteLinkSuggestions();
        }
    } else {
        if (index < noteLinkTriggerIndex + 2) {
            closeNoteLinkSuggestions();
            return;
        }
        
        const queryText = textBefore.substring(noteLinkTriggerIndex + 2);
        if (queryText.includes('\n')) {
            closeNoteLinkSuggestions();
            return;
        }

        updateNoteLinkSuggestions(queryText);
    }
}

function getNoteLinkQuery() {
    const range = quill.getSelection();
    if (!range) return '';
    const textBefore = quill.getText(0, range.index);
    return textBefore.substring(noteLinkTriggerIndex + 2);
}

function showNoteLinkSuggestions() {
    const range = quill.getSelection();
    if (!range) return;
    
    const editorRect = quill.container.getBoundingClientRect();
    const bounds = quill.getBounds(range.index);
    const suggestionsEl = document.getElementById('noteLinkSuggestions');
    
    if (suggestionsEl) {
        // Position it below the cursor
        suggestionsEl.style.top = (editorRect.top + bounds.bottom + window.scrollY) + 'px';
        suggestionsEl.style.left = (editorRect.left + bounds.left + window.scrollX) + 'px';
        suggestionsEl.classList.remove('hidden');
        
        updateNoteLinkSuggestions('');
    }
}

function closeNoteLinkSuggestions() {
    noteLinkSearchActive = false;
    noteLinkTriggerIndex = -1;
    noteLinkActiveIndex = 0;
    const suggestionsEl = document.getElementById('noteLinkSuggestions');
    if (suggestionsEl) {
        suggestionsEl.classList.add('hidden');
    }
}

function updateNoteLinkSuggestions(query = '') {
    const list = notes.filter(n => !n.deleted && n.id !== currentNoteId);
    const filtered = list.filter(n => {
        const title = (n.title || 'Untitled').toLowerCase();
        return title.includes(query.toLowerCase());
    });

    const suggestionsEl = document.getElementById('noteLinkSuggestions');
    if (!suggestionsEl) return filtered;

    if (filtered.length === 0) {
        suggestionsEl.innerHTML = `
            <div class="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">No notes found</div>
        `;
        return filtered;
    }

    suggestionsEl.innerHTML = '';
    filtered.forEach((note, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        const isSelected = index === noteLinkActiveIndex;
        item.className = `w-full text-left px-3 py-1.5 text-[13px] font-medium rounded-md flex items-center gap-2 transition-colors mx-1 ${
            isSelected 
                ? 'bg-blue text-white' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`;
        item.innerHTML = `
            <i data-lucide="file-text" class="w-3.5 h-3.5 flex-none ${isSelected ? 'text-white' : 'text-slate-400'}"></i>
            <span class="truncate">${escapeHtml(note.title || 'Untitled')}</span>
        `;
        item.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            insertNoteLink(note);
        };
        suggestionsEl.appendChild(item);
    });
    lucide.createIcons({ scope: suggestionsEl });
    return filtered;
}

function insertNoteLink(note) {
    const range = quill.getSelection();
    if (!range) return;
    
    const currentCursorIndex = range.index;
    
    quill.deleteText(noteLinkTriggerIndex, currentCursorIndex - noteLinkTriggerIndex);
    
    const linkText = `Note: ${note.title || 'Untitled'}`;
    quill.insertText(noteLinkTriggerIndex, linkText, 'link', '#note-' + note.id);
    quill.insertText(noteLinkTriggerIndex + linkText.length, ' ');
    quill.setSelection(noteLinkTriggerIndex + linkText.length + 1, 0);
    
    closeNoteLinkSuggestions();
}

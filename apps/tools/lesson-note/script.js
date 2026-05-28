// ===== GLOBAL STATE =====
let notes = [];
let folders = [];
let currentNoteId = null;
let activeFolderId = null;
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

const FOLDER_COLORS = [
    { name: 'Blue', hex: '#2979FF' },
    { name: 'Orange', hex: '#FF8C42' },
    { name: 'Pink', hex: '#FF6B95' },
    { name: 'Green', hex: '#00E676' },
    { name: 'Purple', hex: '#7C4DFF' },
    { name: 'Teal', hex: '#00BCD4' },
];

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
                    await saveNoteToDB({
                        ...note,
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

    notes = await getAllNotes();
    folders = (await getSetting('folders')) || [];
    sortMode = (await getSetting('sortMode')) || 'date-desc';
    updateSortDropdownUI();
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

    // Close context menus and sort dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.note-ctx-menu') && !e.target.closest('.note-ctx-trigger')) {
            document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
        }
        if (!e.target.closest('#sortDropdown') && !e.target.closest('#sortBtn')) {
            document.getElementById('sortDropdown')?.classList.add('hidden');
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
function toggleTrashMode() {
    isTrashMode = !isTrashMode;
    const trashBtn = document.getElementById('trashToggleBtn');
    const trashHeader = document.getElementById('trashHeader');
    const newNoteBtn = document.getElementById('newNoteBtn');

    if (isTrashMode) {
        trashBtn.classList.replace('bg-gray-200', 'bg-pink');
        trashBtn.classList.replace('text-dark', 'text-white');
        trashHeader.classList.remove('hidden');
        newNoteBtn.classList.add('opacity-50', 'pointer-events-none');
        const firstTrash = notes.find(n => n.deleted);
        if (firstTrash) { loadNote(firstTrash.id); }
        else {
            currentNoteId = null;
            document.getElementById('noteTitle').value = "";
            document.getElementById('headerNoteTitle').textContent = 'Trash';
            quill.root.innerHTML = "<p>Trash is empty.</p>";
            quill.disable();
            renderNotesList();
        }
    } else {
        trashBtn.classList.replace('bg-pink', 'bg-gray-200');
        trashBtn.classList.replace('text-white', 'text-dark');
        trashHeader.classList.add('hidden');
        newNoteBtn.classList.remove('opacity-50', 'pointer-events-none');
        quill.enable();
        const firstActive = notes.find(n => !n.deleted);
        if (firstActive) loadNote(firstActive.id);
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
    const newNote = { id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), deleted: false, folderId: null };
    notes.unshift(newNote);
    await saveNoteToDB(newNote);
    saveToCloud();
    await loadNote(newNote.id);
    if (window.innerWidth < 768) toggleSidebar();
}

async function loadNote(id) {
    currentNoteId = id;
    if (!isTrashMode) await saveSetting('lastActiveNoteId', id);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('noteTitle').value = note.title;
    document.getElementById('headerNoteTitle').textContent = note.title || 'Untitled';

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
        document.getElementById('headerNoteTitle').textContent = note.title || 'Untitled';

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
            document.getElementById('headerNoteTitle').textContent = 'Trash';
            quill.root.innerHTML = "<p>Trash is empty.</p>";
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
    document.getElementById('headerNoteTitle').textContent = 'Trash';
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
                folder_id: note.folderId || null,
                deleted: note.deleted || false,
                updated_at: note.updatedAt
            }, { onConflict: 'id,user_id' });
        }

        // Save folders separately
        await db.from('note_folders').upsert({
            user_id: user.id,
            folders: folders
        }, { onConflict: 'user_id' });

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
                        folderId: cn.folder_id,
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

        // Load folders
        const { data: folderData } = await db
            .from('note_folders')
            .select('folders')
            .eq('user_id', user.id)
            .single();

        if (folderData?.folders) {
            folders = folderData.folders;
            await saveSetting('folders', folders);
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
    const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'title-asc': 'A → Z', 'title-desc': 'Z → A', 'manual': 'Manual' };
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
    document.querySelectorAll('.folder-drop-target').forEach(el => el.classList.remove('folder-drop-target'));
    document.querySelectorAll('.unfiled-drop-target').forEach(el => el.classList.remove('unfiled-drop-target'));
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    draggedNoteId = null;
}

function setupFolderDropTarget(headerEl, folderId) {
    headerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        headerEl.classList.add('folder-drop-target');
    });
    headerEl.addEventListener('dragleave', () => {
        headerEl.classList.remove('folder-drop-target');
    });
    headerEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        headerEl.classList.remove('folder-drop-target');
        const noteId = e.dataTransfer.getData('text/plain');
        if (!noteId) return;
        const note = notes.find(n => n.id === noteId);
        if (note && note.folderId !== folderId) {
            await moveNoteToFolder(noteId, folderId);
            const folder = folders.find(f => f.id === folderId);
            showToast(`Moved to "${folder?.name || 'folder'}"`, 'folder');
        }
    });
}

function setupUnfiledDropTarget(headerEl) {
    headerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        headerEl.classList.add('unfiled-drop-target');
    });
    headerEl.addEventListener('dragleave', () => {
        headerEl.classList.remove('unfiled-drop-target');
    });
    headerEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        headerEl.classList.remove('unfiled-drop-target');
        const noteId = e.dataTransfer.getData('text/plain');
        if (!noteId) return;
        const note = notes.find(n => n.id === noteId);
        if (note && note.folderId) {
            await moveNoteToFolder(noteId, null);
            showToast('Moved to Unfiled', 'info');
        }
    });
}

function setupNoteReorderDrop(noteEl, targetNoteId, groupNotes) {
    noteEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Show drop indicator
        const rect = noteEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isAbove = e.clientY < midY;
        noteEl.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        // Don't show indicator on self
        if (targetNoteId === draggedNoteId) return;
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        if (isAbove) {
            noteEl.parentElement.insertBefore(indicator, noteEl);
        } else {
            noteEl.parentElement.insertBefore(indicator, noteEl.nextSibling);
        }
    });

    noteEl.addEventListener('dragleave', () => {
        noteEl.parentElement?.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    });

    noteEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        noteEl.parentElement?.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        const noteId = e.dataTransfer.getData('text/plain');
        if (!noteId || noteId === targetNoteId) return;

        const dragNote = notes.find(n => n.id === noteId);
        const targetNote = notes.find(n => n.id === targetNoteId);
        if (!dragNote || !targetNote) return;

        // Move to the same folder as the target
        const targetFolderId = targetNote.folderId || null;
        dragNote.folderId = targetFolderId;

        // Calculate new sort order
        const rect = noteEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;

        const targetIdx = groupNotes.findIndex(n => n.id === targetNoteId);
        const newOrder = [...groupNotes.filter(n => n.id !== noteId)];
        const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
        newOrder.splice(Math.min(insertIdx, newOrder.length), 0, dragNote);

        // Update sortOrder for all notes in the group
        for (let i = 0; i < newOrder.length; i++) {
            newOrder[i].sortOrder = i;
            newOrder[i].updatedAt = Date.now();
            await saveNoteToDB(newOrder[i]);
        }

        // Auto-switch to manual sort
        if (sortMode !== 'manual') {
            sortMode = 'manual';
            await saveSetting('sortMode', 'manual');
            updateSortDropdownUI();
        }

        saveToCloud();
        renderNotesList();
        showToast('Notes reordered', 'success');
    });
}

// ===== RENDER NOTES LIST =====
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
            list.innerHTML = `<div class="text-center py-8 text-gray-400 font-bold text-sm">${isTrashMode ? 'Trash is empty.' : 'No notes found.'}</div>`;
            return;
        }
        const sortedFiltered = sortNotes(filtered);
        const fragment = document.createDocumentFragment();
        sortedFiltered.forEach(note => fragment.appendChild(buildNoteItem(note, sortedFiltered)));
        list.appendChild(fragment);
        lucide.createIcons({ scope: list });
        return;
    }

    // ── FOLDER GROUPED VIEW ──
    const fragment = document.createDocumentFragment();

    // Render each folder
    folders.forEach(folder => {
        const folderNotes = sortNotes(modeFiltered.filter(n => n.folderId === folder.id));
        const section = document.createElement('div');
        section.className = 'folder-section mb-3';

        const isActive = activeFolderId === folder.id;
        const chevron = folder.collapsed ? 'chevron-right' : 'chevron-down';
        const folderIcon = folder.collapsed ? 'folder' : 'folder-open';

        const headerDiv = document.createElement('div');
        headerDiv.className = `folder-header flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer select-none group transition-colors ${isActive ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`;
        headerDiv.dataset.folderId = folder.id;
        headerDiv.innerHTML = `
            <i data-lucide="${chevron}" class="w-3 h-3 text-slate-400 flex-none"></i>
            <i data-lucide="${folderIcon}" class="w-3.5 h-3.5 flex-none" style="color: ${folder.color}"></i>
            <span class="font-medium text-[13px] text-slate-700 dark:text-slate-200 truncate flex-1">${folder.name}</span>
            <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex-none">${folderNotes.length}</span>
            <button class="folder-menu-btn opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded transition-all" onclick="event.stopPropagation(); showFolderMenu(event, '${folder.id}')">
                <i data-lucide="more-horizontal" class="w-3 h-3 pointer-events-none"></i>
            </button>
        `;

        headerDiv.addEventListener('click', (e) => {
            if (e.target.closest('.folder-menu-btn')) return;
            if (activeFolderId === folder.id) {
                activeFolderId = null;
            } else {
                activeFolderId = folder.id;
            }
            folder.collapsed = !folder.collapsed;
            saveFolders();
            renderNotesList();
        });

        // Make folder header a drop target
        setupFolderDropTarget(headerDiv, folder.id);

        section.appendChild(headerDiv);

        if (!folder.collapsed && folderNotes.length > 0) {
            const notesContainer = document.createElement('div');
            notesContainer.className = 'pl-5 border-l border-slate-200 dark:border-slate-700 ml-3 mt-0.5 mb-1';
            folderNotes.forEach(note => notesContainer.appendChild(buildNoteItem(note, folderNotes)));
            section.appendChild(notesContainer);
        }

        if (!folder.collapsed && folderNotes.length === 0) {
            const emptyHint = document.createElement('div');
            emptyHint.className = 'text-[11px] text-slate-300 dark:text-slate-600 font-medium pl-10 py-1.5 italic';
            emptyHint.textContent = 'Drop notes here';
            section.appendChild(emptyHint);
        }

        fragment.appendChild(section);
    });

    // Unfiled notes
    const unfiledNotes = sortNotes(modeFiltered.filter(n => !n.folderId || !folders.some(f => f.id === n.folderId)));
    if (unfiledNotes.length > 0 || folders.length > 0) {
        if (folders.length > 0) {
            const unfiledHeader = document.createElement('div');
            unfiledHeader.className = 'flex items-center gap-2 px-2 py-1.5 mt-2 mb-0.5 rounded-md transition-colors';
            unfiledHeader.innerHTML = `
                <i data-lucide="inbox" class="w-3.5 h-3.5 text-slate-400 flex-none"></i>
                <span class="text-[13px] font-medium text-slate-500 dark:text-slate-400 flex-1">Unfiled</span>
                <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500">${unfiledNotes.length}</span>
            `;
            setupUnfiledDropTarget(unfiledHeader);
            fragment.appendChild(unfiledHeader);
        }
        unfiledNotes.forEach(note => fragment.appendChild(buildNoteItem(note, unfiledNotes)));
    }

    if (modeFiltered.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm font-medium">No notes yet.</div>`;
        return;
    }

    list.appendChild(fragment);
    lucide.createIcons({ scope: list });
}

function buildNoteItem(note, groupNotes) {
    const el = document.createElement('div');
    const title = note.title || 'Untitled';
    const date = new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isActive = note.id === currentNoteId;
    let baseClasses = "note-item cursor-pointer relative group/note";
    if (isActive) baseClasses += isTrashMode ? " active-trash" : " active";
    el.className = baseClasses;
    el.dataset.noteId = note.id;

    // Make draggable (not in trash mode)
    if (!isTrashMode) {
        el.draggable = true;
        el.addEventListener('dragstart', (e) => handleDragStart(e, note.id));
        el.addEventListener('dragend', handleDragEnd);
        setupNoteReorderDrop(el, note.id, groupNotes || []);
    }

    el.onclick = (e) => {
        if (e.target.closest('.note-ctx-trigger') || e.target.closest('.drag-handle')) return;
        loadNote(note.id);
        if (window.innerWidth < 768) toggleSidebar();
    };

    if (!strippedContentCache.has(note.id)) {
        strippedContentCache.set(note.id, fastStripHtml(note.content).toLowerCase());
    }
    const rawText = strippedContentCache.get(note.id) || "";
    const titleColor = isActive ? (isTrashMode ? 'text-pink-500' : 'text-slate-900 dark:text-white') : 'text-slate-700 dark:text-slate-300';

    el.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
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

// ===== FOLDER CRUD =====
async function saveFolders() {
    await saveSetting('folders', folders);
    saveToCloud();
}

async function createFolder() {
    const name = await showPrompt('New Folder', 'Give your new workspace a name', 'folder-plus');
    if (!name || !name.trim()) return;
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length].hex;
    const folder = { id: 'folder_' + Date.now(), name: name.trim(), color, collapsed: false };
    folders.push(folder);
    await saveFolders();
    renderNotesList();
    showToast(`Folder "${name.trim()}" created!`, 'folder');
}

async function renameFolder(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = await showPrompt('Rename Folder', 'Enter a new name for this folder', 'pencil', folder.name);
    if (!newName || !newName.trim()) return;
    folder.name = newName.trim();
    await saveFolders();
    renderNotesList();
    showToast('Folder renamed', 'success');
}

async function changeFolderColor(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const currentIdx = FOLDER_COLORS.findIndex(c => c.hex === folder.color);
    const nextIdx = (currentIdx + 1) % FOLDER_COLORS.length;
    folder.color = FOLDER_COLORS[nextIdx].hex;
    await saveFolders();
    renderNotesList();
}

async function deleteFolder(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const folderNotes = notes.filter(n => n.folderId === id && !n.deleted);
    const confirmed = await showModal('Delete Folder?', `"${folder.name}" will be deleted. ${folderNotes.length} note(s) inside will be moved to Unfiled.`, 'Delete Folder');
    if (!confirmed) return;

    // Move notes to unfiled
    for (const note of folderNotes) {
        note.folderId = null;
        await saveNoteToDB(note);
    }
    folders = folders.filter(f => f.id !== id);
    if (activeFolderId === id) activeFolderId = null;
    await saveFolders();
    renderNotesList();
}

async function moveNoteToFolder(noteId, folderId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    note.folderId = folderId;
    note.updatedAt = Date.now();
    await saveNoteToDB(note);
    saveToCloud();
    renderNotesList();
}

// ===== CONTEXT MENUS =====
function showNoteContextMenu(e, noteId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 min-w-[180px] animate-pop';

    let items = '';
    // Move to folder options
    if (folders.length > 0) {
        items += `<div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1">Move to</div>`;
        folders.forEach(f => {
            items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="moveNoteToFolder('${noteId}', '${f.id}'); this.closest('.note-ctx-menu').remove()">
                <div class="w-2.5 h-2.5 rounded-full flex-none" style="background:${f.color}"></div>
                ${f.name}
            </button>`;
        });
        // Unfiled option
        items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-gray-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="moveNoteToFolder('${noteId}', null); this.closest('.note-ctx-menu').remove()">
            <i data-lucide="inbox" class="w-3 h-3 pointer-events-none"></i> Unfiled
        </button>`;
        items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>`;
    }
    items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-pink rounded-lg hover:bg-pink/10 flex items-center gap-2 transition-colors" onclick="document.querySelectorAll('.note-ctx-menu').forEach(m=>m.remove()); softDeleteNote('${noteId}')">
        <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i> Move to Trash
    </button>`;

    menu.innerHTML = items;

    // Position near the button
    const rect = e.target.closest('.note-ctx-trigger').getBoundingClientRect();
    const sidebar = document.getElementById('notesList');
    const sidebarRect = sidebar.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 250) + 'px';
    menu.style.left = Math.min(rect.left - 140, sidebarRect.right - 200) + 'px';

    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });
}

function showFolderMenu(e, folderId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 min-w-[160px] animate-pop';
    menu.innerHTML = `
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); renameFolder('${folderId}')">
            <i data-lucide="pencil" class="w-3.5 h-3.5 pointer-events-none"></i> Rename
        </button>
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); changeFolderColor('${folderId}')">
            <i data-lucide="palette" class="w-3.5 h-3.5 pointer-events-none"></i> Change Color
        </button>
        <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-pink rounded-lg hover:bg-pink/10 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); deleteFolder('${folderId}')">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i> Delete Folder
        </button>
    `;
    const rect = e.target.closest('.folder-menu-btn').getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.max(rect.left - 120, 8) + 'px';
    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });
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
        document.getElementById('print-title').textContent = note.title || 'Untitled Lesson';
        document.getElementById('print-date').textContent = new Date().toLocaleDateString();

        // Resolve all images to base64 for PDF reliability
        const resolvedHtml = await resolveImagesToBase64(note.content);
        document.getElementById('print-body').innerHTML = resolvedHtml;

        printEl.classList.remove('hidden');

        const opt = {
            margin: 0.5,
            filename: `${(note.title || 'lesson-note').replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(printEl).save();
        printEl.classList.add('hidden');
        showToast('PDF Exported', 'success');
    } catch (err) {
        console.error('PDF Export Error:', err);
        showToast('PDF Export Failed', 'error');
        if (status) status.textContent = 'PDF Failed';
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

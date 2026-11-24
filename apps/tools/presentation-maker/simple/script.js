// Initialize Lucide Icons
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}
refreshIcons();

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    while (container.children.length >= 3) {
        container.firstElementChild.remove();
    }

    const toast = document.createElement('div');
    const colors = {
        info: 'bg-white dark:bg-slate-800 border-blue text-dark dark:text-chalk',
        success: 'bg-white dark:bg-slate-800 border-green text-green-700 dark:text-green-400',
        error: 'bg-white dark:bg-slate-800 border-pink text-pink-700 dark:text-pink-400'
    };
    const icon = {
        info: 'info',
        success: 'check-circle',
        error: 'alert-circle'
    }[type] || 'info';

    toast.className = `ss-toast flex items-center gap-2.5 px-4 py-3 rounded-2xl border-[3px] shadow-hard dark:shadow-hard-dark animate-pop-in pointer-events-auto ${colors[type] || colors.info}`;
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
        <span class="font-bold font-title text-xs sm:text-sm">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// --- IndexedDB (PresentationDB v2 — shared with Presentation Maker & Media Manager) ---
const DB_NAME = 'PresentationDB';
const DB_VER = 2;
const STATE_STORE = 'game_state';
const SETS_STORE = 'slide_sets';
const IMG_STORE = 'images';

const DEFAULT_SETTINGS = {
    theme: 'vivid',          // vivid | chalkboard | paper | contrast
    textCase: 'original',    // original | upper | lower
    imageOrder: 'after',     // after | before | interleave | pair
    autoPlaySec: 0,          // 0 | 2 | 3 | 5 | 10
    transition: 'pop',       // pop | slide | instant
    loop: true,
    autoSpeak: false,
    fontScale: 1,
    showAdvanced: false,     // false = Simple look, true = Options panel visible
    multiLineStyle: 'hero',  // hero | stacked | cards | contrast | bullets
    multiLineReveal: 'all',  // all | step
    textAlign: 'center'      // center | left
};

const PACK_STYLE_MAP = {
    pink: {
        row: 'hover:border-pink hover:bg-pink/10',
        title: 'group-hover:text-pink',
        badge: 'bg-pink/15 text-pink border-pink/30'
    },
    green: {
        row: 'hover:border-green hover:bg-green/10',
        title: 'group-hover:text-green',
        badge: 'bg-green/15 text-green border-green/30'
    },
    blue: {
        row: 'hover:border-blue hover:bg-blue/10',
        title: 'group-hover:text-blue',
        badge: 'bg-blue/15 text-blue border-blue/30'
    },
    orange: {
        row: 'hover:border-orange hover:bg-orange/10',
        title: 'group-hover:text-orange',
        badge: 'bg-orange/15 text-orange border-orange/30'
    }
};

const STARTER_PACKS = [
    {
        id: 'vocab-multiline',
        name: 'Vocab Cards (| Multi-Line)',
        desc: 'Word | IPA | Example sentence',
        badge: 'Multi',
        color: 'pink',
        text: "Apple | /ˈæp.əl/ | I eat a red apple every day.\nElephant | /ˈel.ɪ.fənt/ | The elephant has a long trunk.\nLibrary | /ˈlaɪ.brər.i/ | Let's read quietly in the library.\nUmbrella | /ʌmˈbrel.ə/ | Bring an umbrella when it rains.\nBicycle | /ˈbaɪ.sɪ.kəl/ | She rides her bicycle to school."
    },
    {
        id: 'phonics-cvc',
        name: 'Phonics: CVC Words',
        desc: '10 short-vowel blending cards',
        badge: 'Phonics',
        color: 'green',
        text: 'cat\ndog\npig\nhat\nsun\nbed\ncup\nbox\nfox\nred'
    },
    {
        id: 'action-verbs',
        name: 'Action Verbs',
        desc: '10 high-energy TPR verbs',
        badge: 'Vocab',
        color: 'blue',
        text: 'run\njump\nswim\ndance\nclap\nsleep\nread\nwrite\nsing\nfly'
    },
    {
        id: 'irregular-verbs',
        name: 'Irregular Verbs (Q :: A)',
        desc: 'Base verb -> Past tense reveal',
        badge: 'Reveal',
        color: 'orange',
        text: 'go :: went\neat :: ate\nsee :: saw\ntake :: took\nmake :: made\ncome :: came\ngive :: gave\nwrite :: wrote\nbuy :: bought\nthink :: thought'
    },
    {
        id: 'daily-questions',
        name: 'Speaking Prompts (Q :: A)',
        desc: 'Warm-up questions + sentence frames',
        badge: 'Speaking',
        color: 'pink',
        text: "What's your name? :: My name is...\nHow old are you? :: I am ... years old.\nHow's the weather? :: It's sunny today!\nWhat's your favorite color? :: My favorite color is...\nWhat do you like to eat? :: I like eating..."
    }
];

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

async function getImg(key) {
    try {
        const database = await initDB();
        return new Promise((res) => {
            const r = database.transaction(IMG_STORE, 'readonly').objectStore(IMG_STORE).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = () => res(null);
        });
    } catch (e) {
        return null;
    }
}

async function putImg(key, blob) {
    try {
        const database = await initDB();
        return new Promise((res, rej) => {
            const tx = database.transaction(IMG_STORE, 'readwrite');
            tx.objectStore(IMG_STORE).put(blob, key);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    } catch (e) { }
}

async function deleteImg(key) {
    try {
        const database = await initDB();
        return new Promise((res) => {
            const tx = database.transaction(IMG_STORE, 'readwrite');
            tx.objectStore(IMG_STORE).delete(key);
            tx.oncomplete = () => res();
            tx.onerror = () => res();
        });
    } catch (e) { }
}

const blobCache = new Map();

async function resolveAndCache(src) {
    if (!src || typeof src !== 'string') return '';
    if (src.startsWith('data:image/') || src.startsWith('blob:')) return src;

    if (blobCache.has(src)) return blobCache.get(src);

    if (src.startsWith('klasskit-local:')) {
        const localBlob = await getImg(src);
        if (localBlob) {
            const bUrl = URL.createObjectURL(localBlob);
            blobCache.set(src, bUrl);
            return bUrl;
        }
        return '';
    }

    if (!src.includes('klasskit-media')) return src;

    const cachedBlob = await getImg(src);
    if (cachedBlob) {
        const bUrl = URL.createObjectURL(cachedBlob);
        blobCache.set(src, bUrl);
        return bUrl;
    }

    try {
        const signedUrl = await resolveMediaUrl(src);
        const resp = await fetch(signedUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        await putImg(src, blob);
        const bUrl = URL.createObjectURL(blob);
        blobCache.set(src, bUrl);
        return bUrl;
    } catch (e) {
        console.warn('Cloud image cache failed:', e);
        return src;
    }
}

const SYNCED_STATE_KEYS = new Set([
    'presentationText',
    'presentationImages',
    'presentationImageCaptions',
    'presentationSettings',
    'presentationUpdatedAt'
]);

async function dbPut(key, data, { sync = true } = {}) {
    try {
        const database = await initDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(STATE_STORE, 'readwrite');
            tx.objectStore(STATE_STORE).put(data, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        if (sync && SYNCED_STATE_KEYS.has(key)) {
            scheduleCloudSave();
        }
    } catch (e) {
        console.error('dbPut failed:', e);
    }
}

async function dbGet(key) {
    try {
        const database = await initDB();
        return new Promise((res) => {
            const r = database.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = () => res(null);
        });
    } catch (e) {
        return null;
    }
}

async function saveSetToDB(payload, { sync = true } = {}) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(SETS_STORE, 'readwrite');
        const store = tx.objectStore(SETS_STORE);
        const cleanPayload = { ...payload };
        if (cleanPayload.id === null || cleanPayload.id === undefined) {
            delete cleanPayload.id;
        }
        const req = store.put(cleanPayload);
        let savedId = cleanPayload.id;
        req.onsuccess = () => {
            if (req.result !== undefined && req.result !== null) {
                savedId = req.result;
            }
        };
        tx.oncomplete = () => {
            if (sync) scheduleCloudSave();
            resolve({ ...cleanPayload, id: savedId });
        };
        tx.onerror = () => reject(tx.error);
    });
}

async function getSetById(id) {
    if (id === null || id === undefined) return null;
    try {
        const database = await initDB();
        return new Promise((res) => {
            const r = database.transaction(SETS_STORE, 'readonly').objectStore(SETS_STORE).get(id);
            r.onsuccess = () => res(r.result || null);
            r.onerror = () => res(null);
        });
    } catch (e) {
        return null;
    }
}

async function getAllSets() {
    try {
        const database = await initDB();
        return new Promise((res) => {
            const r = database.transaction(SETS_STORE, 'readonly').objectStore(SETS_STORE).getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => res([]);
        });
    } catch (e) {
        return [];
    }
}

async function deleteSet(id) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(SETS_STORE, 'readwrite');
        tx.objectStore(SETS_STORE).delete(id);
        tx.oncomplete = () => {
            flushCloudSave();
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

// --- Safe Orphan Asset Cleanup ---
async function isImageReferencedAnywhere(src, { excludeSetId = null } = {}) {
    if (!src) return false;
    if (app.images.includes(src)) return true;
    const allSets = await getAllSets();
    for (const s of allSets) {
        if (excludeSetId !== null && String(s.id) === String(excludeSetId)) continue;
        if (Array.isArray(s.images) && s.images.includes(src)) {
            return true;
        }
    }
    return false;
}

async function safeDeleteImageAsset(src, { excludeSetId = null } = {}) {
    if (!src) return;
    const stillUsed = await isImageReferencedAnywhere(src, { excludeSetId });
    if (stillUsed) return;

    if (src.includes('klasskit-media')) {
        await deleteMediaFromUrl(src).catch(e => console.warn('Cloud image delete skipped:', e));
    } else if (src.startsWith('klasskit-local:')) {
        await deleteImg(src);
    }

    if (blobCache.has(src)) {
        const cachedUrl = blobCache.get(src);
        if (cachedUrl && cachedUrl.startsWith('blob:')) {
            try { URL.revokeObjectURL(cachedUrl); } catch (_) { }
        }
        blobCache.delete(src);
    }
}

// --- Debounced Cloud Sync ---
let cloudSaveTimer = null;
let isCloudSaving = false;
let hasPendingCloudSave = false;

function updateSyncBadge(status) {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;
    badge.classList.remove(
        'text-green', 'bg-green/15',
        'text-orange', 'bg-orange/15',
        'text-pink', 'bg-pink/15'
    );
    if (status === 'saving') {
        badge.textContent = 'SAVING...';
        badge.classList.add('text-orange', 'bg-orange/15');
    } else if (status === 'error') {
        badge.textContent = 'LOCAL ONLY';
        badge.classList.add('text-pink', 'bg-pink/15');
    } else {
        badge.textContent = 'AUTO-SAVED';
        badge.classList.add('text-green', 'bg-green/15');
    }
}

function scheduleCloudSave(delayMs = 1200) {
    updateSyncBadge('saving');
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => {
        flushCloudSave();
    }, delayMs);
}

async function flushCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
    if (isCloudSaving) {
        hasPendingCloudSave = true;
        return;
    }
    isCloudSaving = true;
    try {
        await saveToCloud();
        updateSyncBadge('saved');
    } catch (e) {
        console.error('Cloud flush failed:', e);
        updateSyncBadge('error');
    } finally {
        isCloudSaving = false;
        if (hasPendingCloudSave) {
            hasPendingCloudSave = false;
            flushCloudSave();
        }
    }
}

function filterCloudImages(images) {
    return (Array.isArray(images) ? images : []).filter(
        img => typeof img === 'string' && /^https?:\/\//i.test(img)
    );
}

function filterCloudCaptions(captions, validImages) {
    const out = {};
    if (!captions || typeof captions !== 'object') return out;
    const set = new Set(validImages);
    for (const [k, v] of Object.entries(captions)) {
        if (set.has(k) && typeof v === 'string' && v.trim()) {
            out[k] = v;
        }
    }
    return out;
}

async function saveToCloud() {
    const text = (await dbGet('presentationText')) ?? '';
    const rawImages = (await dbGet('presentationImages')) || [];
    const rawCaptions = (await dbGet('presentationImageCaptions')) || {};
    const settings = (await dbGet('presentationSettings')) || app.settings;
    const localUpdatedAt = (await dbGet('presentationUpdatedAt')) || Date.now();
    const rawSets = await getAllSets();

    const cleanImages = filterCloudImages(rawImages);
    const cleanCaptions = filterCloudCaptions(rawCaptions, cleanImages);

    const cleanSets = rawSets.map(s => {
        const sImgs = filterCloudImages(s.images);
        return {
            name: s.name,
            text: s.text || '',
            images: sImgs,
            imageCaptions: filterCloudCaptions(s.imageCaptions, sImgs),
            createdAt: s.createdAt || Date.now(),
            updatedAt: s.updatedAt || s.lastUsed || s.createdAt || Date.now(),
            lastUsed: s.lastUsed || s.createdAt || Date.now(),
            usageCount: s.usageCount || 0
        };
    });

    await saveProgress('speedy_slides_data', {
        text,
        images: cleanImages,
        imageCaptions: cleanCaptions,
        sets: cleanSets,
        settings,
        updatedAt: localUpdatedAt
    });
}

async function loadFromCloud() {
    try {
        const data = await loadProgress('speedy_slides_data');
        if (!data) return;

        // 1. Merge settings
        if (data.settings && typeof data.settings === 'object') {
            const localAdv = localStorage.getItem('speedy_show_advanced');
            app.settings = { ...DEFAULT_SETTINGS, ...data.settings };
            if (localAdv === 'true' || localAdv === 'false') {
                app.settings.showAdvanced = localAdv === 'true';
            }
            await dbPut('presentationSettings', app.settings, { sync: false });
            app.applySettingsToUI();
        }

        // 2. Merge text (without overwriting newer local edits or active typing)
        const localText = (await dbGet('presentationText')) || '';
        const localUpdatedAt = (await dbGet('presentationUpdatedAt')) || 0;
        const cloudUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
        const textarea = document.getElementById('word-input');
        const liveText = textarea ? textarea.value : localText;

        if (typeof data.text === 'string' && data.text !== '' && !app.textSaveTimer) {
            if (!liveText.trim() || (cloudUpdatedAt > localUpdatedAt && data.text !== localText)) {
                await dbPut('presentationText', data.text, { sync: false });
                localStorage.setItem('kk_rapid_text', data.text);
                if (textarea) textarea.value = data.text;
            }
        }

        // 3. Merge images & captions without clobbering local sandbox images
        if (Array.isArray(data.images) && data.images.length > 0) {
            const localImages = (await dbGet('presentationImages')) || [];
            const merged = [...localImages];
            for (const img of data.images) {
                if (img && !merged.includes(img)) merged.push(img);
            }
            app.images = merged;
            await dbPut('presentationImages', merged, { sync: false });
        }

        if (data.imageCaptions && typeof data.imageCaptions === 'object') {
            const mergedCaptions = { ...data.imageCaptions, ...app.imageCaptions };
            app.imageCaptions = mergedCaptions;
            await dbPut('presentationImageCaptions', mergedCaptions, { sync: false });
        }

        // 4. Merge sets by case-insensitive name
        if (Array.isArray(data.sets) && data.sets.length > 0) {
            const existing = await getAllSets();
            for (const s of data.sets) {
                if (!s || !s.name) continue;
                const normName = s.name.trim().toLowerCase();
                const match = existing.find(es => (es.name || '').trim().toLowerCase() === normName);
                if (match) {
                    const cloudSetTime = s.updatedAt || s.lastUsed || s.createdAt || 0;
                    const localSetTime = match.updatedAt || match.lastUsed || match.createdAt || 0;
                    const localOnlyImgs = (match.images || []).filter(img => img && !img.startsWith('http'));
                    const mergedImgs = [...(s.images || [])];
                    for (const li of localOnlyImgs) {
                        if (!mergedImgs.includes(li)) mergedImgs.push(li);
                    }
                    const nextText = cloudSetTime >= localSetTime ? (s.text ?? match.text) : match.text;
                    const nextImages = cloudSetTime >= localSetTime ? mergedImgs : (match.images || []);
                    const nextCaptions = {
                        ...(s.imageCaptions || {}),
                        ...(match.imageCaptions || {})
                    };
                    await saveSetToDB({
                        id: match.id,
                        name: match.name,
                        text: nextText,
                        images: nextImages,
                        imageCaptions: nextCaptions,
                        createdAt: match.createdAt || s.createdAt || Date.now(),
                        updatedAt: Math.max(localSetTime, cloudSetTime) || Date.now(),
                        lastUsed: Math.max(match.lastUsed || 0, s.lastUsed || 0) || Date.now(),
                        usageCount: Math.max(match.usageCount || 0, s.usageCount || 0)
                    }, { sync: false });
                } else {
                    await saveSetToDB({
                        name: s.name,
                        text: s.text || '',
                        images: Array.isArray(s.images) ? s.images : [],
                        imageCaptions: s.imageCaptions || {},
                        createdAt: s.createdAt || Date.now(),
                        updatedAt: s.updatedAt || s.lastUsed || s.createdAt || Date.now(),
                        lastUsed: s.lastUsed || Date.now(),
                        usageCount: s.usageCount || 0
                    }, { sync: false });
                }
            }
        }

        app.updateImageUI();
        app.updateCount();
        await app.renderSets();
        updateSyncBadge('saved');
    } catch (e) {
        console.error('Cloud load failed:', e);
    }
}

const app = {
    deck: [],
    images: [],
    imageCaptions: {},
    activeSetId: null,
    settings: { ...DEFAULT_SETTINGS },

    // Stage runtime state
    currentIndex: 0,
    visibleLineCount: 1,
    isRevealed: false,
    isBlurred: false,
    isBlackout: false,
    isGridOpen: false,
    isComplete: false,
    imageFullscreen: false,
    imageFitMode: 'contain',
    colors: ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'],
    themeOrder: ['vivid', 'chalkboard', 'paper', 'contrast'],
    multiLineStyleOrder: ['hero', 'stacked', 'cards', 'contrast', 'bullets'],
    autoPlaySpeeds: [0, 2, 3, 5, 10],
    lastAutoPlaySec: 3,

    // Timers & tokens
    stripTimer: null,
    stripRenderToken: 0,
    slideRenderToken: 0,
    imageUiToken: 0,
    imageManagerToken: 0,
    stageGridToken: 0,
    setsRenderToken: 0,
    textSaveTimer: null,
    captionSaveTimer: null,
    autoPlayTimer: null,
    autoPlayStartedAt: 0,
    dockIdleTimer: null,
    stageToastTimer: null,
    touchStartX: null,
    touchStartY: null,

    async init() {
        this.renderStarterPacksMenu();

        // Fast sync of Simple/Options toggle from localStorage before IDB resolves
        const localAdv = localStorage.getItem('speedy_show_advanced');
        if (localAdv === 'true' || localAdv === 'false') {
            this.settings.showAdvanced = localAdv === 'true';
        }
        this.applySettingsToUI();

        // Hydrate saved settings
        const savedSettings = await dbGet('presentationSettings');
        if (savedSettings && typeof savedSettings === 'object') {
            this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
            if (localAdv === 'true' || localAdv === 'false') {
                this.settings.showAdvanced = localAdv === 'true';
            }
            if (this.settings.autoPlaySec > 0) {
                this.lastAutoPlaySec = this.settings.autoPlaySec;
            }
        }
        this.applySettingsToUI();

        // Hydrate saved text
        const textarea = document.getElementById('word-input');
        const dbText = await dbGet('presentationText');
        if (typeof dbText === 'string' && dbText !== '') {
            textarea.value = dbText;
            localStorage.setItem('kk_rapid_text', dbText);
        } else {
            const savedLs = localStorage.getItem('kk_rapid_text');
            if (savedLs) {
                textarea.value = savedLs;
            }
        }

        // Hydrate saved images & captions
        const dbImages = await dbGet('presentationImages');
        if (Array.isArray(dbImages)) {
            this.images = dbImages;
        }
        const dbCaptions = await dbGet('presentationImageCaptions');
        if (dbCaptions && typeof dbCaptions === 'object') {
            this.imageCaptions = dbCaptions;
        }

        // Hydrate activeSetId & sync name input on startup only
        const savedActiveId = await dbGet('activeSetId');
        if (savedActiveId !== undefined && savedActiveId !== null) {
            const activeSet = await getSetById(savedActiveId);
            if (activeSet) {
                this.activeSetId = activeSet.id;
                const nameInput = document.getElementById('set-name-input');
                if (nameInput) nameInput.value = activeSet.name || '';
            } else {
                await dbPut('activeSetId', null, { sync: false });
            }
        }

        this.updateImageUI();
        this.updateCount();
        await this.renderSets();

        this.bindEvents();

        // Initial cloud hydration (never loops back to save)
        await loadFromCloud();
    },

    bindEvents() {
        const textarea = document.getElementById('word-input');
        const setNameInput = document.getElementById('set-name-input');
        const stage = document.getElementById('presentation-mode');
        const dropzone = document.getElementById('editor-dropzone');
        const dropOverlay = document.getElementById('drop-overlay');

        // Typing auto-save (debounced IDB + cloud, instant strip update)
        textarea.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem('kk_rapid_text', val);
            this.updateCount();
            this.scheduleTextPersist(val);
        });

        // Enter key in Set Name Input triggers Smart Save
        if (setNameInput) {
            setNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveCurrentSet();
                }
            });
        }

        // Flush pending writes on unload
        window.addEventListener('beforeunload', () => {
            this.flushPendingTextSave({ sync: false });
        });

        // Global Paste (Ctrl+V images anywhere in editor)
        window.addEventListener('paste', (e) => {
            if (this.isPresenting()) return;
            const universalModal = document.getElementById('universalInputModal');
            const shortcutsModal = document.getElementById('shortcuts-modal');
            if ((universalModal && !universalModal.classList.contains('hidden')) ||
                (shortcutsModal && !shortcutsModal.classList.contains('hidden'))) {
                return;
            }
            const items = e.clipboardData?.items;
            if (!items) return;
            const imageFiles = [];
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const f = item.getAsFile();
                    if (f) imageFiles.push(f);
                }
            }
            if (imageFiles.length > 0) {
                e.preventDefault();
                this.addImageFiles(imageFiles);
            }
        });

        // Drag & Drop images onto editor or image upload area
        const dropTargets = [dropzone, document.getElementById('image-upload-area')].filter(Boolean);
        let dragCounter = 0;

        dropTargets.forEach((target) => {
            target.addEventListener('dragenter', (e) => {
                if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
                e.preventDefault();
                dragCounter++;
                if (dropOverlay) {
                    dropOverlay.classList.remove('hidden');
                    dropOverlay.classList.add('flex');
                }
            });
            target.addEventListener('dragover', (e) => {
                if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            target.addEventListener('dragleave', () => {
                dragCounter = Math.max(0, dragCounter - 1);
                if (dragCounter === 0 && dropOverlay) {
                    dropOverlay.classList.add('hidden');
                    dropOverlay.classList.remove('flex');
                }
            });
            target.addEventListener('drop', (e) => {
                e.preventDefault();
                dragCounter = 0;
                if (dropOverlay) {
                    dropOverlay.classList.add('hidden');
                    dropOverlay.classList.remove('flex');
                }
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.addImageFiles(files);
                }
            });
        });

        window.addEventListener('dragend', () => {
            dragCounter = 0;
            if (dropOverlay) {
                dropOverlay.classList.add('hidden');
                dropOverlay.classList.remove('flex');
            }
        });

        // Close starter packs dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('starter-packs-wrap');
            const menu = document.getElementById('starter-packs-menu');
            const btn = document.getElementById('starter-packs-btn');
            if (menu && !menu.classList.contains('hidden') && wrap && !wrap.contains(e.target)) {
                menu.classList.add('hidden');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        });

        // Presentation Click to Advance
        stage.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('#stage-dock') || e.target.closest('#stage-grid-overlay') || e.target.closest('#deck-complete-card')) {
                return;
            }
            this.resetDockIdle();
            this.advanceSlide();
        });

        // Presentation Touch Swipe Support
        stage.addEventListener('touchstart', (e) => {
            if (e.target.closest('#stage-grid-overlay') || e.target.closest('#stage-dock') || e.target.closest('#deck-complete-card')) {
                this.touchStartX = null;
                this.touchStartY = null;
                return;
            }
            if (e.touches && e.touches.length === 1) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        stage.addEventListener('touchend', (e) => {
            if (this.touchStartX === null || !e.changedTouches || !e.changedTouches.length) return;
            const dx = e.changedTouches[0].clientX - this.touchStartX;
            const dy = e.changedTouches[0].clientY - this.touchStartY;
            this.touchStartX = null;
            this.touchStartY = null;
            if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                if (dx < 0) this.advanceSlide();
                else this.prevSlide();
            }
        }, { passive: true });

        // Dock Idle Awakening
        stage.addEventListener('mousemove', () => this.resetDockIdle());
        stage.addEventListener('pointerdown', () => this.resetDockIdle());

        // Refit text on window resize or fullscreen toggle
        let resizeTimer = null;
        const onViewportChange = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (this.isPresenting() && !this.isComplete) {
                    this.fitCurrentSlideText();
                }
            }, 80);
        };
        window.addEventListener('resize', onViewportChange);
        document.addEventListener('fullscreenchange', onViewportChange);

        // Global Keyboard Handler
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    },

    handleKeyDown(e) {
        const shortcutsModal = document.getElementById('shortcuts-modal');
        const imgManagerModal = document.getElementById('image-manager-modal');
        const universalModal = document.getElementById('universalInputModal');
        const isShortcutsOpen = shortcutsModal && !shortcutsModal.classList.contains('hidden');
        const isImgManagerOpen = imgManagerModal && !imgManagerModal.classList.contains('hidden');
        const isUniversalModalOpen = universalModal && !universalModal.classList.contains('hidden');

        if (isUniversalModalOpen) return;

        if (isShortcutsOpen) {
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                this.closeShortcutsModal();
            }
            return;
        }

        if (isImgManagerOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeImageManager();
            }
            return;
        }

        if (!this.isPresenting() && e.key === 'Escape') {
            const packMenu = document.getElementById('starter-packs-menu');
            const packBtn = document.getElementById('starter-packs-btn');
            if (packMenu && !packMenu.classList.contains('hidden')) {
                e.preventDefault();
                packMenu.classList.add('hidden');
                if (packBtn) packBtn.setAttribute('aria-expanded', 'false');
                return;
            }
        }

        if (this.isPresenting()) {
            this.resetDockIdle();
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key;
            const lower = key.toLowerCase();

            if (key === 'Escape') {
                e.preventDefault();
                if (this.isGridOpen) {
                    this.toggleOverviewGrid(false);
                } else if (this.isBlackout) {
                    this.toggleBlackout(false);
                } else {
                    this.stopPresentation();
                }
                return;
            }

            if (this.isGridOpen) {
                if (lower === 'g') {
                    e.preventDefault();
                    this.toggleOverviewGrid(false);
                }
                return;
            }

            if (this.isBlackout) {
                if (lower === 'b' || key === ' ' || key === 'ArrowRight' || key === 'Enter') {
                    e.preventDefault();
                    this.toggleBlackout(false);
                }
                return;
            }

            if (this.isComplete) {
                if (key === 'ArrowLeft' || key === 'PageUp' || key === 'Backspace') {
                    e.preventDefault();
                    this.prevSlide();
                } else if (lower === 'g') {
                    e.preventDefault();
                    this.toggleOverviewGrid();
                } else if (lower === 'r') {
                    e.preventDefault();
                    this.restartDeck(true);
                } else if (key === '?') {
                    e.preventDefault();
                    this.openShortcutsModal();
                }
                return;
            }

            if (key === 'ArrowRight' || key === ' ' || key === 'Enter' || key === 'PageDown') {
                e.preventDefault();
                this.advanceSlide();
            } else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'Backspace') {
                e.preventDefault();
                this.prevSlide();
            } else if (key === 'Home') {
                e.preventDefault();
                this.jumpToStageSlide(0);
            } else if (key === 'End') {
                e.preventDefault();
                this.jumpToStageSlide(this.deck.length - 1);
            } else if (lower === 'b') {
                e.preventDefault();
                this.toggleBlackout();
            } else if (lower === 'g') {
                e.preventDefault();
                this.toggleOverviewGrid();
            } else if (lower === 'p') {
                e.preventDefault();
                this.toggleAutoPlay(e);
            } else if (lower === 's') {
                e.preventDefault();
                this.speakCurrentSlide();
            } else if (lower === 'h') {
                e.preventDefault();
                this.toggleBlur();
            } else if (lower === 'r') {
                e.preventDefault();
                this.shuffleLiveDeck();
            } else if (lower === 't') {
                e.preventDefault();
                this.cycleStageTheme();
            } else if (lower === 'm') {
                e.preventDefault();
                this.cycleMultiLineStyle();
            } else if (lower === 'f') {
                e.preventDefault();
                this.toggleImageFullscreen();
            } else if (key === '+' || key === '=') {
                e.preventDefault();
                this.adjustFontScale(0.1);
            } else if (key === '-' || key === '_') {
                e.preventDefault();
                this.adjustFontScale(-0.1);
            } else if (key === '?') {
                e.preventDefault();
                this.openShortcutsModal();
            }
            return;
        }

        // Editor Shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.startPresentation(false);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this.saveCurrentSet();
        }
    },

    isPresenting() {
        const overlay = document.getElementById('presentation-mode');
        return Boolean(overlay && overlay.style.display === 'flex');
    },

    scheduleTextPersist(val) {
        clearTimeout(this.textSaveTimer);
        updateSyncBadge('saving');
        this.textSaveTimer = setTimeout(async () => {
            this.textSaveTimer = null;
            const now = Date.now();
            await dbPut('presentationUpdatedAt', now, { sync: false });
            await dbPut('presentationText', val);
            if (this.activeSetId) {
                await this.autoSaveActiveSet();
            }
        }, 280);
    },

    cancelPendingTextSave() {
        clearTimeout(this.textSaveTimer);
        this.textSaveTimer = null;
        clearTimeout(this.captionSaveTimer);
        this.captionSaveTimer = null;
    },

    async flushPendingTextSave({ sync = true } = {}) {
        const hadTextTimer = Boolean(this.textSaveTimer);
        const hadCaptionTimer = Boolean(this.captionSaveTimer);
        if (!hadTextTimer && !hadCaptionTimer) return;

        clearTimeout(this.textSaveTimer);
        this.textSaveTimer = null;
        clearTimeout(this.captionSaveTimer);
        this.captionSaveTimer = null;

        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });

        if (hadTextTimer) {
            const val = document.getElementById('word-input')?.value || '';
            localStorage.setItem('kk_rapid_text', val);
            await dbPut('presentationText', val, { sync });
        }
        if (hadCaptionTimer) {
            await dbPut('presentationImageCaptions', this.imageCaptions, { sync });
        }
        if (this.activeSetId) {
            await this.autoSaveActiveSet();
        }
    },

    toggleDarkMode() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme_speedy-slides', isDark ? 'dark' : 'light');
    },

    // --- Settings Controls ---
    toggleAdvancedSettings() {
        this.settings.showAdvanced = !this.settings.showAdvanced;
        localStorage.setItem('speedy_show_advanced', String(this.settings.showAdvanced));
        this.applySettingsToUI();
        this.persistSettings();
    },

    hasCustomSettings() {
        return (
            this.settings.theme !== DEFAULT_SETTINGS.theme ||
            this.settings.textCase !== DEFAULT_SETTINGS.textCase ||
            this.settings.imageOrder !== DEFAULT_SETTINGS.imageOrder ||
            this.settings.autoPlaySec !== DEFAULT_SETTINGS.autoPlaySec ||
            this.settings.transition !== DEFAULT_SETTINGS.transition ||
            this.settings.loop !== DEFAULT_SETTINGS.loop ||
            this.settings.autoSpeak !== DEFAULT_SETTINGS.autoSpeak ||
            this.settings.multiLineStyle !== DEFAULT_SETTINGS.multiLineStyle ||
            this.settings.multiLineReveal !== DEFAULT_SETTINGS.multiLineReveal ||
            this.settings.textAlign !== DEFAULT_SETTINGS.textAlign
        );
    },

    setSetting(key, value) {
        this.settings[key] = value;
        if (key === 'autoPlaySec' && value > 0) {
            this.lastAutoPlaySec = value;
        }
        this.applySettingsToUI();
        this.persistSettings();

        if (
            key === 'imageOrder' ||
            key === 'textCase' ||
            key === 'theme' ||
            key === 'multiLineStyle' ||
            key === 'multiLineReveal' ||
            key === 'textAlign'
        ) {
            this.updateCount();
        }
        if (this.isPresenting()) {
            this.renderSlide();
        }
    },

    toggleSetting(key) {
        this.setSetting(key, !this.settings[key]);
    },

    persistSettings() {
        dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        dbPut('presentationSettings', { ...this.settings });
    },

    applySettingsToUI() {
        const showAdv = Boolean(this.settings.showAdvanced);
        const advPanel = document.getElementById('advanced-settings-panel');
        const toolsBar = document.getElementById('editor-tools-bar');
        const toggleBtn = document.getElementById('toggle-advanced-btn');
        const toggleLabel = document.getElementById('toggle-advanced-label');
        const customDot = document.getElementById('custom-settings-dot');

        if (advPanel) {
            advPanel.classList.toggle('hidden', !showAdv);
            advPanel.classList.toggle('flex', showAdv);
        }
        if (toolsBar) {
            toolsBar.classList.toggle('hidden', !showAdv);
            toolsBar.classList.toggle('flex', showAdv);
        }
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', showAdv ? 'true' : 'false');
            toggleBtn.classList.toggle('btn-pill-active', showAdv);
        }
        if (toggleLabel) {
            toggleLabel.textContent = showAdv ? 'Simple' : 'Options';
        }
        if (customDot) {
            customDot.classList.toggle('hidden', showAdv || !this.hasCustomSettings());
        }

        // Theme pills
        document.querySelectorAll('[data-theme-opt]').forEach(btn => {
            const active = btn.getAttribute('data-theme-opt') === this.settings.theme;
            btn.classList.toggle('btn-pill-active', active);
        });

        // Case pills
        document.querySelectorAll('[data-case-opt]').forEach(btn => {
            const active = btn.getAttribute('data-case-opt') === this.settings.textCase;
            btn.classList.toggle('btn-pill-active-pink', active);
        });

        // Multi-line style pills
        document.querySelectorAll('[data-mline-opt]').forEach(btn => {
            const active = btn.getAttribute('data-mline-opt') === this.settings.multiLineStyle;
            btn.classList.toggle('btn-pill-active-pink', active);
        });

        // Multi-line reveal build pills
        document.querySelectorAll('[data-mreveal-opt]').forEach(btn => {
            const active = btn.getAttribute('data-mreveal-opt') === this.settings.multiLineReveal;
            btn.classList.toggle('btn-pill-active-orange', active);
        });

        // Multi-line alignment pills
        document.querySelectorAll('[data-align-opt]').forEach(btn => {
            const active = btn.getAttribute('data-align-opt') === this.settings.textAlign;
            btn.classList.toggle('btn-pill-active', active);
        });

        // Dropdowns
        const imgOrderSel = document.getElementById('setting-image-order');
        if (imgOrderSel) imgOrderSel.value = this.settings.imageOrder;

        const autoPlaySel = document.getElementById('setting-autoplay');
        if (autoPlaySel) autoPlaySel.value = String(this.settings.autoPlaySec);

        const transSel = document.getElementById('setting-transition');
        if (transSel) transSel.value = this.settings.transition;

        // Loop & Auto-Speak toggles
        const loopBtn = document.getElementById('setting-loop-btn');
        if (loopBtn) loopBtn.classList.toggle('btn-pill-active-green', Boolean(this.settings.loop));

        const speakBtn = document.getElementById('setting-autospeak-btn');
        if (speakBtn) speakBtn.classList.toggle('btn-pill-active-orange', Boolean(this.settings.autoSpeak));

        this.updateStageDockUI();
    },

    // --- Starter Packs ---
    renderStarterPacksMenu() {
        const list = document.getElementById('starter-packs-list');
        if (!list) return;
        list.innerHTML = STARTER_PACKS.map(pack => {
            const st = PACK_STYLE_MAP[pack.color] || PACK_STYLE_MAP.pink;
            return `
            <button type="button" onclick="app.loadStarterPack('${escapeHtml(pack.id)}')"
                class="w-full text-left p-2 rounded-xl border-2 border-dark/15 dark:border-slate-700 ${st.row} transition-all flex items-center justify-between gap-2 group">
                <div class="min-w-0">
                    <div class="font-title font-bold text-xs text-dark dark:text-chalk truncate ${st.title}">
                        ${escapeHtml(pack.name)}
                    </div>
                    <div class="text-[10px] font-semibold text-dark/55 dark:text-chalk/55 truncate">
                        ${escapeHtml(pack.desc)}
                    </div>
                </div>
                <span class="px-1.5 py-0.5 rounded-md ${st.badge} text-[9px] font-title font-bold uppercase shrink-0 border">
                    ${escapeHtml(pack.badge)}
                </span>
            </button>
        `;
        }).join('');
    },

    toggleStarterPacks(event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById('starter-packs-menu');
        const btn = document.getElementById('starter-packs-btn');
        if (!menu) return;
        const willOpen = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !willOpen);
        if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    },

    async loadStarterPack(packId) {
        const pack = STARTER_PACKS.find(p => p.id === packId);
        if (!pack) return;
        this.toggleStarterPacks();

        const textarea = document.getElementById('word-input');
        if (textarea.value.trim() && textarea.value.trim() !== pack.text.trim()) {
            const confirmed = await showConfirmModal(
                `Replace current editor text with "${pack.name}"?`,
                {
                    title: 'Load Starter Pack?',
                    confirmText: 'Load Pack',
                    cancelText: 'Keep Current',
                    icon: 'sparkles',
                    iconColor: 'orange'
                }
            );
            if (!confirmed) return;
        }

        // Save pending edits to previously active set before detaching, or cancel stale timers
        if (this.activeSetId) {
            await this.flushPendingTextSave({ sync: false });
            this.activeSetId = null;
            await dbPut('activeSetId', null, { sync: false });
            const nameInput = document.getElementById('set-name-input');
            if (nameInput) nameInput.value = pack.name;
            this.renderSets();
        } else {
            this.cancelPendingTextSave();
            const nameInput = document.getElementById('set-name-input');
            if (nameInput && !nameInput.value.trim()) nameInput.value = pack.name;
        }

        textarea.value = pack.text;
        localStorage.setItem('kk_rapid_text', pack.text);
        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationText', pack.text);
        this.updateCount();
        showToast(`Loaded "${pack.name}"`, 'success');
    },

    // --- Parsing & Slide Building ---
    parseInput() {
        const raw = document.getElementById('word-input')?.value || '';
        if (!raw.trim()) return [];
        return raw.split(/[;\n]+/)
            .map(w => w.trim())
            .filter(w => w.length > 0);
    },

    parseLine(rawLine) {
        let frontRaw = rawLine;
        let backRaw = '';
        if (rawLine.includes('::')) {
            const idx = rawLine.indexOf('::');
            const candidateFront = rawLine.slice(0, idx).trim();
            const candidateBack = rawLine.slice(idx + 2).trim();
            if (candidateFront) {
                frontRaw = candidateFront;
                backRaw = candidateBack;
            }
        }

        const splitPipe = (str) => str
            .split('|')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const frontLines = splitPipe(frontRaw);
        const backLines = backRaw ? splitPipe(backRaw) : [];

        return {
            frontLines: frontLines.length > 0 ? frontLines : [rawLine.trim()],
            backLines,
            front: frontLines.join(' | ') || rawLine.trim(),
            back: backLines.join(' | '),
            raw: rawLine
        };
    },

    formatCase(str) {
        if (!str) return '';
        if (this.settings.textCase === 'upper') return str.toUpperCase();
        if (this.settings.textCase === 'lower') return str.toLowerCase();
        return str;
    },

    buildSlides() {
        const textLines = this.parseInput().map(line => {
            const parsed = this.parseLine(line);
            return {
                type: 'text',
                front: parsed.front,
                back: parsed.back,
                frontLines: parsed.frontLines,
                backLines: parsed.backLines
            };
        });

        const imgItems = this.images.map((src, idx) => ({
            type: 'image',
            src,
            imageIndex: idx,
            caption: this.imageCaptions[src] || ''
        }));

        const order = this.settings.imageOrder;

        if (order === 'before') {
            return [...imgItems, ...textLines];
        }

        if (order === 'interleave') {
            const out = [];
            const max = Math.max(textLines.length, imgItems.length);
            for (let i = 0; i < max; i++) {
                if (i < textLines.length) out.push(textLines[i]);
                if (i < imgItems.length) out.push(imgItems[i]);
            }
            return out;
        }

        if (order === 'pair') {
            const out = [];
            const max = Math.max(textLines.length, imgItems.length);
            for (let i = 0; i < max; i++) {
                const t = textLines[i];
                const im = imgItems[i];
                if (t && im) {
                    out.push({
                        type: 'pair',
                        front: t.front,
                        back: t.back,
                        frontLines: t.frontLines,
                        backLines: t.backLines,
                        src: im.src,
                        imageIndex: im.imageIndex,
                        caption: im.caption
                    });
                } else if (t) {
                    out.push(t);
                } else if (im) {
                    out.push(im);
                }
            }
            return out;
        }

        return [...textLines, ...imgItems];
    },

    // --- Text Utility Toolbar ---
    insertMultiLineExample() {
        const textarea = document.getElementById('word-input');
        if (!textarea) return;
        const example = 'Apple | /ˈæp.əl/ | A crunchy red fruit';
        const cur = textarea.value.trim();
        textarea.value = cur ? `${cur}\n${example}` : example;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        localStorage.setItem('kk_rapid_text', textarea.value);
        this.updateCount();
        this.scheduleTextPersist(textarea.value);
        showToast('Added multi-line slide — separate lines with |', 'info');
    },

    insertRevealExample() {
        this.insertMultiLineExample();
    },

    cleanText() {
        const textarea = document.getElementById('word-input');
        if (!textarea) return;
        const items = this.parseInput();
        if (items.length === 0) {
            showToast('Nothing to clean', 'info');
            return;
        }
        const seen = new Set();
        const cleaned = [];
        for (const item of items) {
            if (!seen.has(item)) {
                seen.add(item);
                cleaned.push(item);
            }
        }
        const removed = items.length - cleaned.length;
        textarea.value = cleaned.join('\n');
        localStorage.setItem('kk_rapid_text', textarea.value);
        this.updateCount();
        this.scheduleTextPersist(textarea.value);
        showToast(
            removed > 0
                ? `Cleaned! Removed ${removed} duplicate${removed > 1 ? 's' : ''}`
                : `Formatted ${cleaned.length} slides cleanly`,
            'success'
        );
    },

    sortLines() {
        const textarea = document.getElementById('word-input');
        if (!textarea) return;
        const items = this.parseInput();
        if (items.length < 2) return;
        items.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        textarea.value = items.join('\n');
        localStorage.setItem('kk_rapid_text', textarea.value);
        this.updateCount();
        this.scheduleTextPersist(textarea.value);
        showToast(`Sorted ${items.length} slides A-Z`, 'success');
    },

    shuffleLines() {
        const textarea = document.getElementById('word-input');
        if (!textarea) return;
        const items = this.parseInput();
        if (items.length < 2) return;
        this.shuffleArray(items);
        textarea.value = items.join('\n');
        localStorage.setItem('kk_rapid_text', textarea.value);
        this.updateCount();
        this.scheduleTextPersist(textarea.value);
        showToast('Shuffled slides in editor', 'info');
    },

    async importTextFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const textarea = document.getElementById('word-input');
        try {
            const content = await file.text();
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) {
                showToast('File has no text lines', 'error');
                event.target.value = '';
                return;
            }
            if (textarea.value.trim()) {
                const replace = await showConfirmModal(
                    `Replace current editor text with ${lines.length} imported lines?`,
                    {
                        title: 'Import Text File?',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        icon: 'file-up',
                        iconColor: 'green'
                    }
                );
                if (!replace) {
                    event.target.value = '';
                    return;
                }
            }
            textarea.value = lines.join('\n');
            localStorage.setItem('kk_rapid_text', textarea.value);
            this.updateCount();
            this.scheduleTextPersist(textarea.value);
            showToast(`Imported ${lines.length} slides`, 'success');
        } catch (err) {
            console.error('Import failed:', err);
            showToast('Failed to read text file', 'error');
        } finally {
            event.target.value = '';
        }
    },

    exportTextFile() {
        const lines = this.parseInput();
        if (lines.length === 0) {
            showToast('Add some text lines first!', 'error');
            return;
        }
        const nameVal = document.getElementById('set-name-input')?.value.trim() || 'speedy-slides';
        const safeName = nameVal.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '') || 'speedy-slides';
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast(`Exported ${lines.length} slides as .txt`, 'success');
    },

    // --- Counts & Debounced Slide Strip ---
    updateCount() {
        const slides = this.buildSlides();
        const total = slides.length;
        const countEl = document.getElementById('item-count');
        if (countEl) countEl.innerText = `${total} slide${total !== 1 ? 's' : ''}`;

        const estEl = document.getElementById('est-time');
        if (estEl) {
            const secs = this.settings.autoPlaySec > 0 ? this.settings.autoPlaySec : 5;
            const mins = total === 0 ? 0 : Math.max(1, Math.ceil((total * secs) / 60));
            estEl.innerText = `${mins}m`;
        }

        const previewCount = document.getElementById('preview-count');
        if (previewCount) previewCount.innerText = `${total} Slide${total !== 1 ? 's' : ''}`;

        this.scheduleSlideStripRender();
    },

    scheduleSlideStripRender() {
        clearTimeout(this.stripTimer);
        this.stripTimer = setTimeout(() => {
            this.updateSlideStrip();
        }, 70);
    },

    renderSlideTextPreview(slide, textColor, isGrid = false) {
        const lines = Array.isArray(slide.frontLines) && slide.frontLines.length > 0
            ? slide.frontLines
            : [slide.front || ''];
        const hasBack = Array.isArray(slide.backLines) && slide.backLines.length > 0;
        const backText = hasBack ? this.formatCase(slide.backLines.join(' · ')) : '';

        if (lines.length === 1) {
            if (isGrid) {
                return `<div class="w-full h-full p-2.5 flex flex-col items-center justify-center text-center font-title font-bold text-sm leading-tight overflow-hidden break-words" style="color:${textColor};">
                    <span>${escapeHtml(this.formatCase(lines[0]))}</span>
                    ${backText ? `<span class="mt-1 text-[10px] opacity-75 border-t border-current/30 pt-0.5">${escapeHtml(backText)}</span>` : ''}
                </div>`;
            }
            return `<div class="strip-text w-full h-full flex items-center justify-center p-1.5 font-title font-bold text-center leading-tight overflow-hidden break-words" style="font-size: 12px; color: ${textColor};">${escapeHtml(this.formatCase(lines[0]))}</div>`;
        }

        const style = this.settings.multiLineStyle || 'hero';
        const alignLeft = this.settings.textAlign === 'left' || style === 'bullets';
        const shown = lines.slice(0, isGrid ? 4 : 3).map(l => this.formatCase(l));
        const dotColors = ['var(--color-pink)', 'var(--color-orange)', 'var(--color-green)', 'var(--color-blue)'];
        const padCls = isGrid ? 'p-2 gap-1' : 'p-1.5 gap-0.5';
        const alignCls = alignLeft ? 'items-start text-left' : 'items-center text-center';

        const rows = shown.map((line, i) => {
            const safe = escapeHtml(line);
            if (style === 'cards') {
                return `<div class="w-full truncate rounded px-1 ${isGrid ? 'py-0.5 text-[10px]' : 'text-[7px]'} font-bold bg-white/90 text-dark border border-dark/80 border-l-[3px]" style="border-left-color:${dotColors[i % 4]};">${safe}</div>`;
            }
            if (style === 'bullets') {
                if (i === 0) {
                    return `<div class="w-full truncate font-title font-bold ${isGrid ? 'text-xs' : 'text-[9px]'} border-b border-current/40 pb-0.5">${safe}</div>`;
                }
                return `<div class="w-full flex items-center gap-1 ${isGrid ? 'text-[10px]' : 'text-[7px]'} font-bold"><span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color:${dotColors[(i - 1) % 4]};"></span><span class="truncate">${safe}</span></div>`;
            }
            if (style === 'contrast') {
                if (i === 0) return `<div class="w-full truncate font-title font-bold ${isGrid ? 'text-xs' : 'text-[9px]'} leading-tight">${safe}</div>`;
                if (i === 1) return `<div class="max-w-full truncate rounded-full px-1.5 ${isGrid ? 'text-[9px]' : 'text-[6.5px]'} font-title font-bold bg-dark text-white border border-white/50">${safe}</div>`;
                return `<div class="w-full truncate italic opacity-85 ${isGrid ? 'text-[9px]' : 'text-[6.5px]'} font-bold">${safe}</div>`;
            }
            if (style === 'stacked') {
                return `<div class="w-full truncate font-title font-bold ${isGrid ? 'text-[11px]' : 'text-[8px]'} leading-tight">${safe}</div>`;
            }
            // hero (default)
            return `<div class="w-full truncate leading-tight ${i === 0 ? `font-title font-bold ${isGrid ? 'text-xs' : 'text-[9.5px]'}` : `font-bold opacity-85 ${isGrid ? 'text-[10px]' : 'text-[7.5px]'}`}">${safe}</div>`;
        }).join('');

        return `<div class="w-full h-full flex flex-col justify-center ${alignCls} ${padCls} overflow-hidden" style="color: ${textColor};">
            ${rows}
            ${isGrid && backText ? `<div class="w-full truncate text-[9px] opacity-75 border-t border-current/30 pt-0.5 mt-0.5">${escapeHtml(backText)}</div>` : ''}
        </div>`;
    },

    async updateSlideStrip() {
        const strip = document.getElementById('slide-strip');
        if (!strip) return;

        const token = ++this.stripRenderToken;
        const slides = this.buildSlides();

        if (slides.length === 0) {
            strip.innerHTML = '<div class="text-[11px] italic opacity-45 px-2 font-bold font-title uppercase tracking-widest">No slides yet. Start typing or drop images!</div>';
            return;
        }

        const themeBgFor = (idx) => {
            if (this.settings.theme === 'chalkboard') return { bg: '#0f172a', text: '#f8fafc' };
            if (this.settings.theme === 'paper') return { bg: '#f8fafc', text: '#0f172a' };
            if (this.settings.theme === 'contrast') return { bg: '#09090b', text: '#facc15' };
            return { bg: this.colors[idx % this.colors.length], text: '#f8fafc' };
        };

        const cards = await Promise.all(slides.map(async (slide, index) => {
            const palette = themeBgFor(index);
            let inner = '';
            let badgeHtml = '';

            if (slide.type === 'image') {
                const src = await resolveAndCache(slide.src);
                inner = `<img src="${escapeHtml(src)}" alt="Slide ${index + 1}" class="w-full h-full object-cover">`;
                if (slide.caption) {
                    badgeHtml = `<div class="absolute bottom-0 inset-x-0 bg-dark/80 text-white text-[8px] font-bold px-1 py-0.5 truncate text-center">${escapeHtml(this.formatCase(slide.caption))}</div>`;
                }
            } else if (slide.type === 'pair') {
                const src = await resolveAndCache(slide.src);
                inner = `
                    <div class="w-full h-full flex">
                        <div class="w-1/2 h-full overflow-hidden">
                            ${this.renderSlideTextPreview(slide, palette.text, false)}
                        </div>
                        <div class="w-1/2 h-full border-l border-dark/25 overflow-hidden">
                            <img src="${escapeHtml(src)}" alt="Slide ${index + 1}" class="w-full h-full object-cover">
                        </div>
                    </div>
                `;
                badgeHtml = `<div class="absolute top-0 right-0 bg-blue text-white text-[7px] px-1 py-0.5 font-title font-bold rounded-bl-md">PAIR</div>`;
            } else {
                inner = this.renderSlideTextPreview(slide, palette.text, false);
                const lineCount = slide.frontLines ? slide.frontLines.length : 1;
                if (slide.back) {
                    badgeHtml = `<div class="absolute top-0 right-0 bg-pink text-white text-[7px] px-1 py-0.5 font-title font-bold rounded-bl-md border-l border-b border-dark/40">${lineCount > 1 ? `${lineCount}L·` : ''}Q::A</div>`;
                } else if (lineCount > 1) {
                    badgeHtml = `<div class="absolute top-0 right-0 bg-blue text-white text-[7px] px-1 py-0.5 font-title font-bold rounded-bl-md border-l border-b border-dark/40">${lineCount}L</div>`;
                }
            }

            const removeBtn = (slide.type === 'image' || slide.type === 'pair') && typeof slide.imageIndex === 'number'
                ? `<button type="button" onclick="event.stopPropagation(); app.deleteImage(${slide.imageIndex})" class="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-pink text-white rounded-md p-0.5 border border-dark shadow-hard-xs" title="Remove attached image"><i data-lucide="x" class="w-2.5 h-2.5"></i></button>`
                : '';

            return `
                <div onclick="app.startPresentation(false, ${index})" title="Present from slide ${index + 1}"
                    class="shrink-0 w-20 sm:w-[92px] aspect-slide border-2 border-dark dark:border-slate-500 rounded-xl shadow-[2px_2px_0px_0px_#0f172a] dark:shadow-[2px_2px_0px_0px_#000] overflow-hidden relative group hover:-translate-y-0.5 transition-transform cursor-pointer"
                    style="background-color: ${palette.bg}">
                    ${inner}
                    <div class="absolute top-0 left-0 bg-dark/75 text-chalk text-[8px] px-1.5 py-0.5 font-bold rounded-br-lg">${index + 1}</div>
                    ${badgeHtml}
                    ${removeBtn}
                </div>
            `;
        }));

        if (token !== this.stripRenderToken) return;
        strip.innerHTML = cards.join('');
        refreshIcons();
        requestAnimationFrame(() => {
            if (token === this.stripRenderToken) {
                this.fitStripTexts();
            }
        });
    },

    fitStripTexts() {
        const texts = document.querySelectorAll('.strip-text');
        texts.forEach(el => {
            let size = parseFloat(getComputedStyle(el).fontSize);
            let safe = 0;
            while (safe < 20 && size > 7) {
                const overflowX = el.scrollWidth > el.clientWidth;
                const overflowY = el.scrollHeight > el.clientHeight;
                if (!overflowX && !overflowY) break;
                size *= 0.88;
                el.style.fontSize = `${size}px`;
                safe++;
            }
        });
    },

    // --- Images Management ---
    async handleImages(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        await this.addImageFiles(files);
        event.target.value = '';
    },

    async addImageFiles(fileList) {
        const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
        if (files.length === 0) return;

        showToast(`Saving ${files.length} image${files.length > 1 ? 's' : ''}...`, 'info');
        const user = await getCloudUser();
        const canUpload = Boolean(user);

        let successCount = 0;
        let failedQuota = false;

        for (const file of files) {
            try {
                let imgSource;
                if (canUpload) {
                    imgSource = await uploadMedia(file, 'presentation_simple');
                } else {
                    const compressed = (typeof compressImage === 'function')
                        ? await compressImage(file)
                        : file;
                    const localKey = `klasskit-local:speedy/${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    await putImg(localKey, compressed);
                    imgSource = localKey;
                }
                this.images.push(imgSource);
                successCount++;
            } catch (err) {
                console.error('Image save failed:', err);
                if (String(err?.message || '').toLowerCase().includes('quota')) {
                    failedQuota = true;
                }
            }
        }

        if (failedQuota) {
            showToast('Cloud storage quota exceeded!', 'error');
        } else if (successCount > 0) {
            showToast(`Added ${successCount} image${successCount > 1 ? 's' : ''}`, 'success');
        }

        if (successCount > 0) {
            await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
            await dbPut('presentationImages', this.images);
            this.updateImageUI();
            this.updateCount();
            if (this.activeSetId) await this.autoSaveActiveSet();
            const imgModal = document.getElementById('image-manager-modal');
            if (imgModal && !imgModal.classList.contains('hidden')) {
                this.renderImageManagerList();
            }
        }
    },

    async clearImages({ skipConfirm = false } = {}) {
        if (!skipConfirm) {
            const confirmed = await showConfirmModal(
                'Remove all attached images from the current workspace?',
                {
                    title: 'Clear Images?',
                    confirmText: 'Clear',
                    cancelText: 'Cancel',
                    icon: 'trash-2',
                    iconColor: 'red'
                }
            );
            if (!confirmed) return;
            await this.flushPendingTextSave({ sync: false });
        }

        clearTimeout(this.captionSaveTimer);
        this.captionSaveTimer = null;

        const removed = [...this.images];
        this.images = [];
        for (const src of removed) {
            delete this.imageCaptions[src];
        }

        const input = document.getElementById('image-input');
        if (input) input.value = '';

        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationImages', this.images);
        await dbPut('presentationImageCaptions', this.imageCaptions);

        if (this.activeSetId) {
            await this.autoSaveActiveSet();
        }

        for (const src of removed) {
            await safeDeleteImageAsset(src);
        }

        this.updateImageUI();
        this.updateCount();
        this.closeImageManager();
        if (!skipConfirm) showToast('Workspace images cleared', 'success');
    },

    async updateImageUI() {
        const token = ++this.imageUiToken;
        const text = document.getElementById('image-count-text');
        const manageBtn = document.getElementById('manage-images-btn');
        const area = document.getElementById('image-upload-area');
        const thumbs = document.getElementById('image-mini-thumbs');

        if (text) {
            text.innerText = `${this.images.length} image${this.images.length !== 1 ? 's' : ''} attached`;
            if (this.images.length > 0) {
                text.classList.remove('text-dark/80', 'dark:text-chalk/80');
                text.classList.add('text-blue', 'dark:text-blue');
            } else {
                text.classList.add('text-dark/80', 'dark:text-chalk/80');
                text.classList.remove('text-blue', 'dark:text-blue');
            }
        }

        if (manageBtn) {
            manageBtn.classList.toggle('hidden', this.images.length === 0);
            manageBtn.classList.toggle('flex', this.images.length > 0);
        }
        if (area) {
            area.classList.toggle('border-blue/50', this.images.length > 0);
        }

        if (thumbs) {
            if (this.images.length === 0) {
                thumbs.innerHTML = '';
            } else {
                const previewImgs = this.images.slice(0, 4);
                const resolved = await Promise.all(previewImgs.map(src => resolveAndCache(src)));
                if (token !== this.imageUiToken) return;
                thumbs.innerHTML = resolved.map((src, idx) => `
                    <img src="${escapeHtml(src)}" alt="Preview ${idx + 1}" class="w-6 h-6 rounded-md object-cover border-2 border-dark dark:border-slate-500 shadow-hard-xs bg-white">
                `).join('') + (this.images.length > 4 ? `<span class="pl-2 text-[10px] font-title font-bold text-blue">+${this.images.length - 4}</span>` : '');
            }
        }
    },

    openImageManager() {
        const modal = document.getElementById('image-manager-modal');
        if (!modal) return;
        this.renderImageManagerList();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeImageManager() {
        const modal = document.getElementById('image-manager-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this.flushPendingTextSave({ sync: true });
    },

    async renderImageManagerList() {
        const token = ++this.imageManagerToken;
        const list = document.getElementById('image-manager-list');
        const countEl = document.getElementById('image-manager-count');
        if (!list) return;

        if (countEl) {
            countEl.textContent = `${this.images.length} Image${this.images.length !== 1 ? 's' : ''}`;
        }

        if (this.images.length === 0) {
            list.innerHTML = `
                <div class="col-span-full h-36 flex flex-col items-center justify-center text-dark/40 dark:text-chalk/40 font-bold font-title gap-2">
                    <i data-lucide="image-minus" class="w-8 h-8 opacity-50"></i>
                    <span>No images attached.</span>
                </div>`;
            refreshIcons();
            return;
        }

        const imgsSnapshot = [...this.images];
        const resolvedSrcs = await Promise.all(imgsSnapshot.map(src => resolveAndCache(src)));
        if (token !== this.imageManagerToken) return;

        list.innerHTML = imgsSnapshot.map((rawSrc, index) => {
            const displaySrc = resolvedSrcs[index] || rawSrc;
            const caption = this.imageCaptions[rawSrc] || '';
            return `
                <div class="flex flex-col rounded-2xl overflow-hidden border-2 border-dark/25 dark:border-slate-600 bg-chalk dark:bg-slate-900 shadow-sm">
                    <div class="relative aspect-slide bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <img src="${escapeHtml(displaySrc)}" alt="Image ${index + 1}" class="w-full h-full object-cover">
                        <div class="absolute top-2 left-2 bg-dark/80 text-chalk text-[10px] font-bold px-2 py-0.5 rounded-md font-title">
                            #${index + 1}
                        </div>
                        <div class="absolute top-2 right-2 flex items-center gap-1">
                            ${index > 0 ? `<button type="button" onclick="app.moveImage(${index}, -1)" class="p-1 bg-white/90 text-dark border border-dark rounded-lg hover:bg-blue hover:text-white transition-colors" title="Move Earlier"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i></button>` : ''}
                            ${index < imgsSnapshot.length - 1 ? `<button type="button" onclick="app.moveImage(${index}, 1)" class="p-1 bg-white/90 text-dark border border-dark rounded-lg hover:bg-blue hover:text-white transition-colors" title="Move Later"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button>` : ''}
                            <button type="button" onclick="app.deleteImage(${index})" class="p-1 bg-pink text-white border border-dark rounded-lg hover:scale-105 transition-transform" title="Delete Image"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                    <div class="p-2 border-t-2 border-dark/15 dark:border-slate-700">
                        <input type="text" value="${escapeHtml(caption)}"
                            oninput="app.updateImageCaption(${index}, this.value)"
                            placeholder="Optional slide caption..."
                            class="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 text-dark dark:text-chalk border border-dark/20 dark:border-slate-600 rounded-lg focus:border-blue outline-none" />
                    </div>
                </div>
            `;
        }).join('');

        refreshIcons();
    },

    async moveImage(index, delta) {
        await this.flushPendingTextSave({ sync: false });
        const target = index + delta;
        if (target < 0 || target >= this.images.length) return;
        const [item] = this.images.splice(index, 1);
        this.images.splice(target, 0, item);

        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationImages', this.images);
        if (this.activeSetId) await this.autoSaveActiveSet();
        this.updateImageUI();
        this.updateCount();
        this.renderImageManagerList();
    },

    updateImageCaption(index, caption) {
        const src = this.images[index];
        if (!src) return;
        if (caption.trim() === '') {
            delete this.imageCaptions[src];
        } else {
            this.imageCaptions[src] = caption;
        }
        updateSyncBadge('saving');
        this.scheduleSlideStripRender();
        clearTimeout(this.captionSaveTimer);
        this.captionSaveTimer = setTimeout(async () => {
            this.captionSaveTimer = null;
            await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
            await dbPut('presentationImageCaptions', this.imageCaptions);
            if (this.activeSetId) {
                await this.autoSaveActiveSet();
            }
        }, 250);
    },

    async deleteImage(index) {
        await this.flushPendingTextSave({ sync: false });
        if (index < 0 || index >= this.images.length) return;
        const src = this.images[index];
        this.images.splice(index, 1);
        if (!this.images.includes(src)) {
            delete this.imageCaptions[src];
        }

        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationImages', this.images);
        await dbPut('presentationImageCaptions', this.imageCaptions);

        if (this.activeSetId) {
            await this.autoSaveActiveSet();
        }
        await safeDeleteImageAsset(src);

        this.updateImageUI();
        this.updateCount();
        const modal = document.getElementById('image-manager-modal');
        if (modal && !modal.classList.contains('hidden')) {
            this.renderImageManagerList();
        }
        if (this.images.length === 0) {
            this.closeImageManager();
        }
        showToast('Image removed', 'success');
    },

    // --- Presentation Stage Engine ---
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    async startPresentation(shuffle = false, startIndex = 0) {
        await this.flushPendingTextSave();
        const slides = this.buildSlides();
        if (slides.length === 0) {
            showToast('Add words or images first!', 'error');
            document.getElementById('word-input')?.focus();
            return;
        }

        if (this.activeSetId) {
            this.updateSetStats(this.activeSetId).then(() => this.renderSets());
        }

        this.deck = shuffle ? this.shuffleArray([...slides]) : slides;
        this.currentIndex = Math.max(0, Math.min(startIndex, this.deck.length - 1));
        this.visibleLineCount = 1;
        this.isRevealed = false;
        this.isBlurred = false;
        this.isBlackout = false;
        this.isGridOpen = false;
        this.isComplete = false;
        this.imageFullscreen = false;

        const overlay = document.getElementById('presentation-mode');
        overlay.style.display = 'flex';
        overlay.focus();

        try {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
        } catch (e) { }

        this.updateStageDockUI();
        await this.renderSlide();
        this.resetDockIdle();
    },

    stopPresentation() {
        this.stopAutoPlayTimer();
        clearTimeout(this.dockIdleTimer);
        clearTimeout(this.stageToastTimer);
        this.cancelSpeech();

        const overlay = document.getElementById('presentation-mode');
        if (overlay) overlay.style.display = 'none';

        this.imageFullscreen = false;
        this.isGridOpen = false;
        this.isBlackout = false;
        this.isBlurred = false;
        this.isComplete = false;
        this.updateImageFullscreenUI();

        const displayLines = document.getElementById('display-lines');
        if (displayLines) {
            displayLines.classList.add('hidden');
            displayLines.classList.remove('flex');
            displayLines.innerHTML = '';
        }
        const displayWord = document.getElementById('display-word');
        if (displayWord) displayWord.innerText = '';
        const displayBack = document.getElementById('display-back');
        if (displayBack) {
            displayBack.classList.add('hidden');
            displayBack.innerHTML = '';
        }
        const revealPrompt = document.getElementById('reveal-prompt');
        if (revealPrompt) {
            revealPrompt.classList.add('hidden');
            revealPrompt.classList.remove('inline-flex');
        }
        document.getElementById('display-image')?.removeAttribute('src');
        document.getElementById('display-image-fs')?.removeAttribute('src');

        document.getElementById('blackout-overlay')?.classList.add('hidden');
        document.getElementById('blackout-overlay')?.classList.remove('flex');
        document.getElementById('stage-grid-overlay')?.classList.add('hidden');
        document.getElementById('stage-grid-overlay')?.classList.remove('flex');

        try {
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        } catch (e) { }
    },

    advanceSlide() {
        if (this.isBlackout) {
            this.toggleBlackout(false);
            return;
        }
        if (this.isGridOpen || this.isComplete) return;

        const slide = this.deck[this.currentIndex];
        const hideTextBehindFs = Boolean(this.imageFullscreen && slide?.type === 'pair');
        const frontCount = slide?.frontLines ? slide.frontLines.length : 1;
        if (!hideTextBehindFs && this.settings.multiLineReveal === 'step' && frontCount > 1 && this.visibleLineCount < frontCount) {
            this.visibleLineCount++;
            const nextLineEl = document.querySelector(`#display-lines .ml-line[data-line-idx="${this.visibleLineCount - 1}"]`);
            if (nextLineEl) {
                nextLineEl.classList.remove('ml-line-hidden');
                nextLineEl.classList.add('reveal-pop');
            }
            this.updateRevealPromptUI(slide);
            if (this.settings.autoSpeak && !this.isBlurred && !this.isBlackout) {
                const spokenLine = slide.frontLines[this.visibleLineCount - 1];
                if (spokenLine) this.speakText(spokenLine);
            }
            this.resetAutoPlayTimer();
            return;
        }

        if (!hideTextBehindFs && slide && slide.backLines?.length > 0 && !this.isRevealed) {
            this.revealCurrentSlide();
            return;
        }

        if (this.currentIndex < this.deck.length - 1) {
            this.currentIndex++;
            this.visibleLineCount = 1;
            this.isRevealed = false;
            this.renderSlide();
        } else if (this.settings.loop) {
            this.currentIndex = 0;
            this.visibleLineCount = 1;
            this.isRevealed = false;
            this.renderSlide();
        } else {
            this.isComplete = true;
            this.stopAutoPlayTimer();
            this.renderSlide();
        }
    },

    nextSlide() {
        this.advanceSlide();
    },

    prevSlide() {
        if (this.isBlackout) {
            this.toggleBlackout(false);
            return;
        }
        if (this.isGridOpen) return;

        if (this.isComplete) {
            this.isComplete = false;
            this.currentIndex = Math.max(0, this.deck.length - 1);
            this.visibleLineCount = 1;
            this.isRevealed = false;
            this.renderSlide();
            return;
        }

        const slide = this.deck[this.currentIndex];
        const hideTextBehindFs = Boolean(this.imageFullscreen && slide?.type === 'pair');
        if (!hideTextBehindFs && slide && slide.backLines?.length > 0 && this.isRevealed) {
            this.isRevealed = false;
            this.updateRevealPromptUI(slide);
            requestAnimationFrame(() => this.fitCurrentSlideText());
            return;
        }

        const frontCount = slide?.frontLines ? slide.frontLines.length : 1;
        if (!hideTextBehindFs && this.settings.multiLineReveal === 'step' && frontCount > 1 && this.visibleLineCount > 1) {
            const hideEl = document.querySelector(`#display-lines .ml-line[data-line-idx="${this.visibleLineCount - 1}"]`);
            if (hideEl) {
                hideEl.classList.remove('reveal-pop');
                hideEl.classList.add('ml-line-hidden');
            }
            this.visibleLineCount--;
            this.updateRevealPromptUI(slide);
            return;
        }

        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else if (this.settings.loop && this.deck.length > 1) {
            this.currentIndex = this.deck.length - 1;
        } else {
            return;
        }
        this.visibleLineCount = 1;
        this.isRevealed = false;
        this.renderSlide();
    },

    restartDeck(shuffle = false) {
        if (shuffle) {
            this.deck = this.shuffleArray([...this.deck]);
        }
        this.currentIndex = 0;
        this.visibleLineCount = 1;
        this.isRevealed = false;
        this.isComplete = false;
        this.renderSlide();
    },

    updateRevealPromptUI(slide) {
        const promptBtn = document.getElementById('reveal-prompt');
        const backEl = document.getElementById('display-back');
        if (!promptBtn || !backEl || !slide) return;

        if (slide.type === 'image') {
            promptBtn.classList.add('hidden');
            promptBtn.classList.remove('inline-flex');
            backEl.classList.add('hidden');
            return;
        }

        const frontCount = slide.frontLines ? slide.frontLines.length : 1;
        const backLines = Array.isArray(slide.backLines) ? slide.backLines : [];

        if (this.settings.multiLineReveal === 'step' && frontCount > 1 && this.visibleLineCount < frontCount) {
            promptBtn.innerHTML = `<i data-lucide="chevron-down" class="w-4 h-4"></i> Next line (${this.visibleLineCount}/${frontCount})`;
            promptBtn.classList.remove('hidden');
            promptBtn.classList.add('inline-flex');
            backEl.classList.add('hidden');
            refreshIcons();
            return;
        }

        if (backLines.length > 0) {
            if (this.isRevealed) {
                promptBtn.classList.add('hidden');
                promptBtn.classList.remove('inline-flex');
                backEl.innerHTML = backLines
                    .map(line => `<div class="leading-snug">${escapeHtml(this.formatCase(line))}</div>`)
                    .join('');
                backEl.classList.remove('hidden', 'reveal-pop');
                void backEl.offsetWidth;
                backEl.classList.add('reveal-pop');
            } else {
                promptBtn.innerHTML = `<i data-lucide="eye" class="w-4 h-4"></i> Tap or Space to Reveal`;
                promptBtn.classList.remove('hidden');
                promptBtn.classList.add('inline-flex');
                backEl.classList.add('hidden');
                refreshIcons();
            }
            return;
        }

        promptBtn.classList.add('hidden');
        promptBtn.classList.remove('inline-flex');
        backEl.classList.add('hidden');
    },

    revealCurrentSlide() {
        const slide = this.deck[this.currentIndex];
        if (!slide) return;

        const frontCount = slide.frontLines ? slide.frontLines.length : 1;
        if (this.settings.multiLineReveal === 'step' && frontCount > 1 && this.visibleLineCount < frontCount) {
            this.advanceSlide();
            return;
        }

        if (!slide.backLines || slide.backLines.length === 0) return;
        this.isRevealed = true;
        this.updateRevealPromptUI(slide);

        requestAnimationFrame(() => this.fitCurrentSlideText());

        if (this.settings.autoSpeak && !this.isBlurred && !this.isBlackout) {
            this.speakText(slide.backLines.join('. '));
        }
        this.resetAutoPlayTimer();
    },

    async renderSlide() {
        const token = ++this.slideRenderToken;
        this.cancelSpeech();

        const overlay = document.getElementById('presentation-mode');
        const contentWrap = document.getElementById('slide-content');
        const textWrap = document.getElementById('stage-text-wrap');
        const imageWrap = document.getElementById('stage-image-wrap');
        const displayWord = document.getElementById('display-word');
        const displayLines = document.getElementById('display-lines');
        const displayBack = document.getElementById('display-back');
        const revealPrompt = document.getElementById('reveal-prompt');
        const displayImg = document.getElementById('display-image');
        const displayCaption = document.getElementById('display-caption');
        const imgFsBtn = document.getElementById('img-fullscreen-btn');
        const mlineBtn = document.getElementById('stage-mline-btn');
        const completeCard = document.getElementById('deck-complete-card');
        const completeStats = document.getElementById('deck-complete-stats');

        if (!overlay || !contentWrap) return;

        // Stage Theme
        overlay.setAttribute('data-stage-theme', this.settings.theme);
        if (this.settings.theme === 'vivid') {
            overlay.style.backgroundColor = this.colors[this.currentIndex % this.colors.length];
        } else {
            overlay.style.backgroundColor = '';
        }

        // Complete Card state
        if (this.isComplete) {
            textWrap.classList.add('hidden');
            textWrap.classList.remove('flex');
            displayWord?.classList.add('hidden');
            if (displayLines) {
                displayLines.classList.add('hidden');
                displayLines.classList.remove('flex');
                displayLines.innerHTML = '';
            }
            if (displayBack) {
                displayBack.classList.add('hidden');
                displayBack.innerHTML = '';
            }
            if (revealPrompt) {
                revealPrompt.classList.add('hidden');
                revealPrompt.classList.remove('inline-flex');
            }
            imageWrap.classList.add('hidden');
            imageWrap.classList.remove('flex');
            imgFsBtn?.classList.add('hidden');
            mlineBtn?.classList.add('hidden');
            completeCard?.classList.remove('hidden');
            completeCard?.classList.add('flex');
            if (completeStats) {
                completeStats.textContent = `${this.deck.length} slide${this.deck.length !== 1 ? 's' : ''} reviewed`;
            }
            this.updateImageFullscreenUI();
            this.applyBlurUI();
            return;
        }

        completeCard?.classList.add('hidden');
        completeCard?.classList.remove('flex');

        const slide = this.deck[this.currentIndex];
        if (!slide) return;

        // Layout class for pair vs single + text alignment
        const isLeft = this.settings.textAlign === 'left';
        const alignWrapCls = isLeft ? 'items-start text-left' : 'items-center text-center';
        if (slide.type === 'pair') {
            contentWrap.className = 'w-full max-w-[92vw] max-h-[78vh] px-4 sm:px-10 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 relative z-20';
            textWrap.className = `flex flex-col justify-center ${alignWrapCls} w-full lg:w-1/2 min-w-0 stage-blur-target`;
            imageWrap.className = 'flex flex-col items-center justify-center gap-3 w-full lg:w-1/2 min-w-0 stage-blur-target';
        } else {
            contentWrap.className = 'w-full max-w-[92vw] max-h-[78vh] px-4 sm:px-10 flex flex-col items-center justify-center gap-6 relative z-20';
            textWrap.className = `flex flex-col justify-center ${alignWrapCls} w-full min-w-0 stage-blur-target`;
            imageWrap.className = 'flex flex-col items-center justify-center gap-3 max-w-full stage-blur-target';
        }

        // Transition animation
        contentWrap.classList.remove('anim-pop', 'anim-slide', 'anim-instant');
        if (this.settings.transition !== 'instant') {
            void contentWrap.offsetWidth;
            contentWrap.classList.add(this.settings.transition === 'slide' ? 'anim-slide' : 'anim-pop');
        } else {
            contentWrap.classList.add('anim-instant');
        }

        // Text / Multi-line / Reveal rendering
        if (slide.type === 'text' || slide.type === 'pair') {
            textWrap.classList.remove('hidden');
            textWrap.classList.add('flex');

            const frontLines = Array.isArray(slide.frontLines) && slide.frontLines.length > 0
                ? slide.frontLines
                : [slide.front || ''];

            if (frontLines.length > 1 && displayLines) {
                displayWord.classList.add('hidden');
                displayWord.innerText = '';
                displayLines.classList.remove('hidden');
                displayLines.classList.add('flex');
                displayLines.setAttribute('data-ml-style', this.settings.multiLineStyle);
                displayLines.setAttribute('data-ml-align', this.settings.textAlign);
                mlineBtn?.classList.remove('hidden');

                const shownCount = this.settings.multiLineReveal === 'step'
                    ? Math.min(this.visibleLineCount, frontLines.length)
                    : frontLines.length;

                displayLines.innerHTML = frontLines.map((rawLine, idx) => {
                    const safeLine = escapeHtml(this.formatCase(rawLine));
                    const hiddenCls = idx >= shownCount ? ' ml-line-hidden' : '';
                    const content = this.settings.multiLineStyle === 'bullets' && idx > 0
                        ? `<span class="ml-bullet-dot"></span><span>${safeLine}</span>`
                        : safeLine;
                    return `<div class="ml-line${hiddenCls}" data-line-idx="${idx}">${content}</div>`;
                }).join('');
            } else {
                if (displayLines) {
                    displayLines.classList.add('hidden');
                    displayLines.classList.remove('flex');
                    displayLines.innerHTML = '';
                }
                displayWord.classList.remove('hidden');
                mlineBtn?.classList.add('hidden');
                displayWord.innerText = this.formatCase(frontLines[0]);
            }

            this.updateRevealPromptUI(slide);
            this.fitCurrentSlideText();
        } else {
            textWrap.classList.add('hidden');
            textWrap.classList.remove('flex');
            displayWord?.classList.add('hidden');
            if (displayLines) {
                displayLines.classList.add('hidden');
                displayLines.classList.remove('flex');
                displayLines.innerHTML = '';
            }
            if (displayBack) {
                displayBack.classList.add('hidden');
                displayBack.innerHTML = '';
            }
            if (revealPrompt) {
                revealPrompt.classList.add('hidden');
                revealPrompt.classList.remove('inline-flex');
            }
            mlineBtn?.classList.add('hidden');
        }

        // Image rendering
        const fsImg = document.getElementById('display-image-fs');
        const fsCaption = document.getElementById('display-caption-fs');
        if (slide.type === 'image' || slide.type === 'pair') {
            imageWrap.classList.remove('hidden');
            imageWrap.classList.add('flex');
            imgFsBtn?.classList.remove('hidden');

            if (slide.caption) {
                const capText = this.formatCase(slide.caption);
                displayCaption.innerText = capText;
                displayCaption.classList.remove('hidden');
                if (fsCaption) {
                    fsCaption.innerText = capText;
                    fsCaption.classList.remove('hidden');
                }
            } else {
                displayCaption.classList.add('hidden');
                fsCaption?.classList.add('hidden');
            }

            const isInstant = !slide.src || slide.src.startsWith('data:image/') || slide.src.startsWith('blob:') || blobCache.has(slide.src);
            if (!isInstant) {
                displayImg.style.opacity = '0';
                if (fsImg) fsImg.style.opacity = '0';
            }

            const resolved = await resolveAndCache(slide.src);
            if (token !== this.slideRenderToken) return;
            if (resolved) {
                displayImg.src = resolved;
                if (fsImg) fsImg.src = resolved;
            } else {
                displayImg.removeAttribute('src');
                if (fsImg) fsImg.removeAttribute('src');
            }
            displayImg.style.opacity = '';
            if (fsImg) fsImg.style.opacity = '';
            this.updateImageFullscreenUI();
        } else {
            imageWrap.classList.add('hidden');
            imageWrap.classList.remove('flex');
            imgFsBtn?.classList.add('hidden');
            this.updateImageFullscreenUI();
        }

        this.applyBlurUI();

        // Counters & progress
        document.getElementById('slide-number').innerText = this.currentIndex + 1;
        document.getElementById('total-slides').innerText = this.deck.length;
        const progressEl = document.getElementById('slide-progress');
        if (progressEl) {
            progressEl.style.width = `${((this.currentIndex + 1) / this.deck.length) * 100}%`;
        }

        requestAnimationFrame(() => {
            if (token === this.slideRenderToken && !this.isComplete) {
                this.fitCurrentSlideText();
            }
        });

        if (this.settings.autoSpeak && !this.isBlurred && !this.isBlackout) {
            const frontCount = slide.frontLines ? slide.frontLines.length : 1;
            let toSpeak = '';
            if (slide.type === 'image') {
                toSpeak = slide.caption;
            } else if (this.isRevealed && slide.backLines?.length > 0) {
                toSpeak = slide.backLines.join('. ');
            } else if (this.settings.multiLineReveal === 'step' && frontCount > 1) {
                toSpeak = slide.frontLines.slice(0, this.visibleLineCount).join('. ');
            } else {
                toSpeak = (slide.frontLines || [slide.front]).join('. ');
            }
            if (toSpeak) this.speakText(toSpeak);
        }

        this.resetAutoPlayTimer();
    },

    fitCurrentSlideText() {
        const slide = this.deck[this.currentIndex];
        const textWrap = document.getElementById('stage-text-wrap');
        const wordEl = document.getElementById('display-word');
        const linesEl = document.getElementById('display-lines');
        if (!slide || (slide.type !== 'text' && slide.type !== 'pair')) return;

        const isDesktopPair = slide.type === 'pair' && window.innerWidth >= 1024;
        const fallbackMaxW = isDesktopPair
            ? Math.max(200, Math.min(window.innerWidth * 0.41, 600))
            : Math.max(240, Math.min(window.innerWidth * 0.86, 1320));
        const availW = textWrap && textWrap.clientWidth > 100
            ? Math.max(200, Math.floor(textWrap.clientWidth))
            : fallbackMaxW;

        const frontCount = slide.frontLines ? slide.frontLines.length : 1;
        const hasBack = Array.isArray(slide.backLines) && slide.backLines.length > 0;
        const hasStepPrompt = this.settings.multiLineReveal === 'step' && frontCount > 1;

        let maxH = window.innerHeight * 0.64;
        if (slide.type === 'pair' && !isDesktopPair) {
            maxH = hasBack ? window.innerHeight * 0.22 : window.innerHeight * 0.28;
        } else if (hasBack) {
            maxH = window.innerHeight * 0.42;
        } else if (hasStepPrompt) {
            maxH = window.innerHeight * 0.54;
        }
        maxH = Math.max(110, maxH);

        if (frontCount > 1 && linesEl) {
            const baseMaxPx = isDesktopPair ? 88 : Math.min(145, window.innerWidth * 0.12);
            let lo = 14;
            let hi = Math.max(lo + 4, Math.round(baseMaxPx * this.settings.fontScale));
            let best = lo;

            linesEl.style.overflowWrap = 'normal';
            linesEl.style.wordBreak = 'normal';
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                linesEl.style.setProperty('--ml-base', `${mid}px`);
                const fits = linesEl.scrollWidth <= availW + 2 && linesEl.offsetWidth <= availW + 2 && linesEl.scrollHeight <= maxH + 2 && linesEl.offsetHeight <= maxH + 2;
                if (fits) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            linesEl.style.overflowWrap = '';
            linesEl.style.wordBreak = '';
            linesEl.style.setProperty('--ml-base', `${best}px`);
            return;
        }

        if (!wordEl) return;
        const baseMaxPx = isDesktopPair ? 120 : Math.min(185, window.innerWidth * 0.165);
        let lo = 18;
        let hi = Math.max(lo + 4, Math.round(baseMaxPx * this.settings.fontScale));
        let best = lo;

        wordEl.style.overflowWrap = 'normal';
        wordEl.style.wordBreak = 'normal';
        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            wordEl.style.fontSize = `${mid}px`;
            const fits = wordEl.scrollWidth <= availW + 2 && wordEl.offsetWidth <= availW + 2 && wordEl.scrollHeight <= maxH + 2 && wordEl.offsetHeight <= maxH + 2;
            if (fits) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        wordEl.style.overflowWrap = '';
        wordEl.style.wordBreak = '';
        wordEl.style.fontSize = `${best}px`;
    },

    // --- Stage Controls & Superpowers ---
    showStageToast(msg) {
        const el = document.getElementById('stage-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
        clearTimeout(this.stageToastTimer);
        this.stageToastTimer = setTimeout(() => {
            el.classList.add('hidden');
        }, 1600);
    },

    toggleImageFullscreen() {
        const slide = this.deck[this.currentIndex];
        if (!slide || (slide.type !== 'image' && slide.type !== 'pair') || this.isComplete) return;
        this.imageFullscreen = !this.imageFullscreen;
        this.updateImageFullscreenUI();
    },

    toggleImageFitMode() {
        this.imageFitMode = this.imageFitMode === 'contain' ? 'cover' : 'contain';
        this.updateImageFullscreenUI();
        this.showStageToast(this.imageFitMode === 'cover' ? 'Image: Fill Screen' : 'Image: Fit Full');
    },

    updateImageFullscreenUI() {
        const btn = document.getElementById('img-fullscreen-btn');
        const fitBtn = document.getElementById('img-fit-btn');
        const fsWrap = document.getElementById('stage-fs-image-wrap');
        const fsImg = document.getElementById('display-image-fs');
        const fsCaption = document.getElementById('display-caption-fs');
        const img = document.getElementById('display-image');
        const slide = this.deck[this.currentIndex];
        const isImageSlide = Boolean(slide && (slide.type === 'image' || slide.type === 'pair') && !this.isComplete);
        const showFs = Boolean(this.imageFullscreen && isImageSlide);

        if (fsWrap && fsImg) {
            if (showFs) {
                const curSrc = img?.getAttribute('src');
                if (curSrc) fsImg.src = curSrc;
                else fsImg.removeAttribute('src');
                fsImg.classList.toggle('object-contain', this.imageFitMode !== 'cover');
                fsImg.classList.toggle('object-cover', this.imageFitMode === 'cover');

                if (fsCaption) {
                    if (slide.caption) {
                        fsCaption.innerText = this.formatCase(slide.caption);
                        fsCaption.classList.remove('hidden');
                    } else {
                        fsCaption.classList.add('hidden');
                    }
                }

                fsWrap.classList.remove('hidden');
                fsWrap.classList.add('flex');
            } else {
                fsWrap.classList.add('hidden');
                fsWrap.classList.remove('flex');
            }
        }

        if (fitBtn) {
            fitBtn.classList.toggle('hidden', !showFs);
            fitBtn.innerHTML = `<i data-lucide="${this.imageFitMode === 'cover' ? 'scan' : 'crop'}" class="w-5 h-5" id="img-fit-icon"></i>`;
            fitBtn.title = this.imageFitMode === 'cover' ? 'Switch to Fit Full Image' : 'Switch to Fill Screen';
        }

        if (btn) {
            btn.innerHTML = `<i data-lucide="${showFs ? 'minimize' : 'maximize'}" class="w-5 h-5" id="img-fullscreen-icon"></i>`;
        }
        refreshIcons();
    },

    toggleAutoPlay(forceEvent) {
        if (forceEvent && forceEvent.shiftKey) {
            this.cycleAutoPlaySpeed();
            return;
        }
        if (this.settings.autoPlaySec > 0) {
            this.lastAutoPlaySec = this.settings.autoPlaySec;
            this.settings.autoPlaySec = 0;
            this.stopAutoPlayTimer();
            this.showStageToast('Auto-Play Off');
        } else {
            this.settings.autoPlaySec = this.lastAutoPlaySec || 3;
            this.resetAutoPlayTimer();
            this.showStageToast(`Auto-Play: ${this.settings.autoPlaySec}s`);
        }
        this.applySettingsToUI();
        this.persistSettings();
    },

    cycleAutoPlaySpeed() {
        const idx = this.autoPlaySpeeds.indexOf(this.settings.autoPlaySec);
        const next = this.autoPlaySpeeds[(idx + 1) % this.autoPlaySpeeds.length];
        this.settings.autoPlaySec = next;
        if (next > 0) this.lastAutoPlaySec = next;
        this.applySettingsToUI();
        this.persistSettings();
        this.resetAutoPlayTimer();
        this.showStageToast(next > 0 ? `Auto-Play: ${next}s` : 'Auto-Play Off');
    },

    stopAutoPlayTimer() {
        clearInterval(this.autoPlayTimer);
        this.autoPlayTimer = null;
        const wrap = document.getElementById('autoplay-bar-wrap');
        if (wrap) wrap.classList.add('hidden');
    },

    resetAutoPlayTimer() {
        this.stopAutoPlayTimer();
        const sec = this.settings.autoPlaySec;
        if (!sec || sec <= 0 || !this.isPresenting() || this.isBlackout || this.isGridOpen || this.isComplete) {
            return;
        }

        const wrap = document.getElementById('autoplay-bar-wrap');
        const bar = document.getElementById('autoplay-bar');
        if (wrap) wrap.classList.remove('hidden');
        if (bar) bar.style.width = '100%';

        const totalMs = sec * 1000;
        this.autoPlayStartedAt = Date.now();

        this.autoPlayTimer = setInterval(() => {
            if (this.isBlackout || this.isGridOpen || this.isComplete || !this.isPresenting()) {
                return;
            }
            const elapsed = Date.now() - this.autoPlayStartedAt;
            const remainingRatio = Math.max(0, 1 - elapsed / totalMs);
            if (bar) bar.style.width = `${(remainingRatio * 100).toFixed(1)}%`;
            if (elapsed >= totalMs) {
                this.stopAutoPlayTimer();
                this.advanceSlide();
            }
        }, 60);
    },

    cancelSpeech() {
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (_) { }
        }
    },

    speakText(text) {
        if (!text || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'en-US';
            utter.rate = 0.94;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            console.warn('Speech synthesis failed:', e);
        }
    },

    speakCurrentSlide() {
        if (!this.isPresenting() || this.isComplete) return;
        if (!('speechSynthesis' in window)) {
            this.showStageToast('Voice not supported in this browser');
            return;
        }
        const slide = this.deck[this.currentIndex];
        if (!slide) return;
        const frontCount = slide.frontLines ? slide.frontLines.length : 1;
        let text = '';
        if (slide.type === 'image') {
            text = slide.caption;
        } else if (this.isRevealed && slide.backLines?.length > 0) {
            text = slide.backLines.join('. ');
        } else if (this.settings.multiLineReveal === 'step' && frontCount > 1) {
            text = slide.frontLines.slice(0, this.visibleLineCount).join('. ');
        } else {
            text = (slide.frontLines || [slide.front]).join('. ');
        }
        if (!text) {
            this.showStageToast('No text to speak on this slide');
            return;
        }
        this.speakText(text);
    },

    toggleBlur() {
        this.isBlurred = !this.isBlurred;
        this.applyBlurUI();
        this.updateStageDockUI();
        this.showStageToast(this.isBlurred ? 'Peek Mode: Hidden' : 'Revealed');
    },

    applyBlurUI() {
        const textWrap = document.getElementById('stage-text-wrap');
        const imageWrap = document.getElementById('stage-image-wrap');
        const fsImg = document.getElementById('display-image-fs');
        const fsCaption = document.getElementById('display-caption-fs');
        const hint = document.getElementById('peek-hint');
        const shouldBlur = this.isBlurred && !this.isComplete;

        textWrap?.classList.toggle('stage-blurred', shouldBlur);
        imageWrap?.classList.toggle('stage-blurred', shouldBlur);
        fsImg?.classList.toggle('stage-blurred', shouldBlur);
        fsCaption?.classList.toggle('stage-blurred', shouldBlur);
        if (hint) {
            hint.classList.toggle('hidden', !shouldBlur);
            hint.classList.toggle('flex', shouldBlur);
        }
    },

    toggleBlackout(forceState) {
        this.isBlackout = typeof forceState === 'boolean' ? forceState : !this.isBlackout;
        const curtain = document.getElementById('blackout-overlay');
        if (curtain) {
            curtain.classList.toggle('hidden', !this.isBlackout);
            curtain.classList.toggle('flex', this.isBlackout);
        }
        if (this.isBlackout) {
            this.cancelSpeech();
            this.stopAutoPlayTimer();
        } else {
            this.resetAutoPlayTimer();
        }
        this.updateStageDockUI();
    },

    async toggleOverviewGrid(forceState) {
        this.isGridOpen = typeof forceState === 'boolean' ? forceState : !this.isGridOpen;
        const overlay = document.getElementById('stage-grid-overlay');
        if (!overlay) return;

        overlay.classList.toggle('hidden', !this.isGridOpen);
        overlay.classList.toggle('flex', this.isGridOpen);

        if (this.isGridOpen) {
            this.stopAutoPlayTimer();
            await this.renderStageGrid();
        } else {
            this.resetAutoPlayTimer();
        }
    },

    async renderStageGrid() {
        const token = ++this.stageGridToken;
        const list = document.getElementById('stage-grid-list');
        if (!list) return;

        const cards = await Promise.all(this.deck.map(async (slide, idx) => {
            const isCurrent = idx === this.currentIndex;
            const bgColor = this.settings.theme === 'chalkboard'
                ? '#0f172a'
                : this.settings.theme === 'paper'
                    ? '#f8fafc'
                    : this.settings.theme === 'contrast'
                        ? '#09090b'
                        : this.colors[idx % this.colors.length];
            const textColor = this.settings.theme === 'paper'
                ? '#0f172a'
                : this.settings.theme === 'contrast'
                    ? '#facc15'
                    : '#f8fafc';

            let body = '';
            if (slide.type === 'image') {
                const src = await resolveAndCache(slide.src);
                body = `<img src="${escapeHtml(src)}" alt="Slide ${idx + 1}" class="w-full h-full object-cover">`;
            } else if (slide.type === 'pair') {
                const src = await resolveAndCache(slide.src);
                body = `
                    <div class="w-full h-full flex">
                        <div class="w-1/2 h-full overflow-hidden">${this.renderSlideTextPreview(slide, textColor, true)}</div>
                        <img src="${escapeHtml(src)}" alt="Slide ${idx + 1}" class="w-1/2 h-full object-cover">
                    </div>`;
            } else {
                body = this.renderSlideTextPreview(slide, textColor, true);
            }

            return `
                <button type="button" onclick="app.jumpToStageSlide(${idx})"
                    class="aspect-slide rounded-2xl border-[3px] ${isCurrent ? 'border-yellow-300 ring-4 ring-yellow-300/40 scale-[1.02]' : 'border-white/40 hover:border-white'} overflow-hidden relative shadow-hard transition-transform text-left"
                    style="background-color: ${bgColor}">
                    ${body}
                    <div class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-dark/80 text-white text-[10px] font-title font-bold">
                        #${idx + 1}
                    </div>
                </button>
            `;
        }));

        if (token !== this.stageGridToken || !this.isGridOpen) return;
        list.innerHTML = cards.join('');
    },

    jumpToStageSlide(index) {
        this.currentIndex = Math.max(0, Math.min(index, this.deck.length - 1));
        this.visibleLineCount = 1;
        this.isRevealed = false;
        this.isComplete = false;
        this.toggleOverviewGrid(false);
        this.renderSlide();
    },

    shuffleLiveDeck() {
        if (!this.deck || this.deck.length < 2) return;
        this.deck = this.shuffleArray([...this.deck]);
        this.currentIndex = 0;
        this.visibleLineCount = 1;
        this.isRevealed = false;
        this.isComplete = false;
        this.renderSlide();
        this.showStageToast('Deck Shuffled!');
    },

    cycleMultiLineStyle() {
        const idx = this.multiLineStyleOrder.indexOf(this.settings.multiLineStyle);
        const next = this.multiLineStyleOrder[(idx + 1) % this.multiLineStyleOrder.length];
        this.setSetting('multiLineStyle', next);
        const labels = {
            hero: 'Lines: Title + Sub',
            stacked: 'Lines: Equal Stack',
            cards: 'Lines: Split Cards',
            contrast: 'Lines: Accent Mix',
            bullets: 'Lines: Bullet List'
        };
        this.showStageToast(labels[next] || next);
    },

    cycleStageTheme() {
        const idx = this.themeOrder.indexOf(this.settings.theme);
        const next = this.themeOrder[(idx + 1) % this.themeOrder.length];
        this.setSetting('theme', next);
        const labels = {
            vivid: 'Theme: Vivid',
            chalkboard: 'Theme: Chalkboard',
            paper: 'Theme: Paper',
            contrast: 'Theme: High Contrast'
        };
        this.showStageToast(labels[next] || next);
    },

    adjustFontScale(delta) {
        const next = Math.max(0.7, Math.min(1.4, Number((this.settings.fontScale + delta).toFixed(2))));
        this.settings.fontScale = next;
        this.persistSettings();
        this.fitCurrentSlideText();
        this.showStageToast(`Text Scale: ${Math.round(next * 100)}%`);
    },

    updateStageDockUI() {
        const autoBtn = document.getElementById('stage-autoplay-btn');
        const autoSpeedBtn = document.getElementById('stage-autoplay-speed-btn');
        const autoLabel = document.getElementById('stage-autoplay-label');
        const isAutoActive = this.settings.autoPlaySec > 0;
        if (autoLabel) {
            autoLabel.textContent = isAutoActive ? `${this.settings.autoPlaySec}s` : 'Off';
        }
        [autoBtn, autoSpeedBtn].forEach(el => {
            if (!el) return;
            el.classList.toggle('bg-blue', isAutoActive);
            el.classList.toggle('text-white', isAutoActive);
        });

        const blurBtn = document.getElementById('stage-blur-btn');
        if (blurBtn) {
            blurBtn.innerHTML = `<i data-lucide="${this.isBlurred ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
            blurBtn.classList.toggle('bg-orange', this.isBlurred);
            blurBtn.classList.toggle('text-white', this.isBlurred);
        }

        const blackoutBtn = document.getElementById('stage-blackout-btn');
        if (blackoutBtn) {
            blackoutBtn.classList.toggle('bg-pink', this.isBlackout);
            blackoutBtn.classList.toggle('text-white', this.isBlackout);
        }
        refreshIcons();
    },

    resetDockIdle() {
        const dock = document.getElementById('stage-dock');
        const tl = document.getElementById('stage-hud-top-left');
        const tr = document.getElementById('stage-hud-top-right');
        [dock, tl, tr].forEach(el => el?.classList.remove('dock-idle'));

        clearTimeout(this.dockIdleTimer);
        if (!this.isPresenting()) return;
        this.dockIdleTimer = setTimeout(() => {
            if (this.isPresenting() && !this.isGridOpen && !this.isComplete && !this.isBlackout) {
                [dock, tl, tr].forEach(el => el?.classList.add('dock-idle'));
            }
        }, 3200);
    },

    // --- Modals ---
    async openClearModal() {
        const confirmed = await showConfirmModal(
            'Clear all editor text and workspace images? Saved sets in your library will stay safe.',
            {
                title: 'Clear Workspace?',
                confirmText: 'Yes, Clear',
                cancelText: 'Cancel',
                icon: 'trash-2',
                iconColor: 'pink'
            }
        );
        if (!confirmed) return;

        this.cancelPendingTextSave();
        // Detach any active saved set BEFORE clearing workspace so library sets & their images remain untouched
        this.activeSetId = null;
        await dbPut('activeSetId', null, { sync: false });
        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = '';

        const textarea = document.getElementById('word-input');
        if (textarea) textarea.value = '';
        localStorage.removeItem('kk_rapid_text');
        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationText', '');

        await this.clearImages({ skipConfirm: true });

        this.updateCount();
        await this.renderSets();
        showToast('Workspace cleared', 'info');
    },

    openShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        refreshIcons();
    },

    closeShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    // --- Saved Sets Library Workflow ---
    collectActiveCaptions() {
        const out = {};
        for (const src of this.images) {
            if (this.imageCaptions[src] && this.imageCaptions[src].trim()) {
                out[src] = this.imageCaptions[src];
            }
        }
        return out;
    },

    async saveCurrentSet() {
        await this.flushPendingTextSave({ sync: false });
        const nameInput = document.getElementById('set-name-input');
        const name = nameInput?.value.trim() || '';
        const text = document.getElementById('word-input')?.value || '';

        if (!text.trim() && this.images.length === 0) {
            showToast('Add text or images before saving!', 'error');
            return;
        }

        if (!name) {
            showInputModal({
                title: 'Save Slide Set',
                description: 'Give this slide deck a name to save it to your library.',
                placeholder: 'e.g. Phonics CVC Unit 1',
                defaultValue: '',
                confirmText: 'Save Set',
                icon: 'save',
                iconColor: 'orange',
                validation: (val) => (val ? null : 'Please enter a set name'),
                onConfirm: (val) => {
                    if (nameInput) nameInput.value = val;
                    this.saveCurrentSet();
                }
            });
            return;
        }

        const now = Date.now();
        const allSets = await getAllSets();
        const normName = name.toLowerCase();
        const captions = this.collectActiveCaptions();

        // Check if updating currently active set with matching name
        if (this.activeSetId !== null && this.activeSetId !== undefined) {
            const activeSet = allSets.find(s => String(s.id) === String(this.activeSetId));
            if (activeSet && (activeSet.name || '').trim().toLowerCase() === normName) {
                const updated = await saveSetToDB({
                    ...activeSet,
                    id: activeSet.id,
                    name,
                    text,
                    images: [...this.images],
                    imageCaptions: captions,
                    updatedAt: now,
                    lastUsed: now
                });
                this.activeSetId = updated.id;
                await dbPut('activeSetId', this.activeSetId, { sync: false });
                if (nameInput) nameInput.value = updated.name;
                await this.renderSets();
                showToast(`Updated "${updated.name}"`, 'success');
                return;
            }
        }

        // Check for duplicate set name
        const duplicate = allSets.find(s => (s.name || '').trim().toLowerCase() === normName);
        if (duplicate) {
            const overwrite = await showConfirmModal(
                `A saved set named "${duplicate.name}" already exists. Overwrite it with the current slides?`,
                {
                    title: 'Overwrite Existing Set?',
                    confirmText: 'Overwrite',
                    cancelText: 'Cancel',
                    icon: 'save',
                    iconColor: 'orange'
                }
            );
            if (!overwrite) return;

            const updated = await saveSetToDB({
                ...duplicate,
                id: duplicate.id,
                name,
                text,
                images: [...this.images],
                imageCaptions: captions,
                updatedAt: now,
                lastUsed: now
            });
            this.activeSetId = updated.id;
            await dbPut('activeSetId', this.activeSetId, { sync: false });
            if (nameInput) nameInput.value = updated.name;
            await this.renderSets();
            showToast(`Updated "${updated.name}"`, 'success');
            return;
        }

        // Create brand new set
        const created = await saveSetToDB({
            name,
            text,
            images: [...this.images],
            imageCaptions: captions,
            createdAt: now,
            updatedAt: now,
            lastUsed: now,
            usageCount: 1
        });
        this.activeSetId = created.id;
        await dbPut('activeSetId', this.activeSetId, { sync: false });
        if (nameInput) nameInput.value = created.name;
        await this.renderSets();
        showToast(`Saved as "${created.name}"`, 'success');
    },

    async saveSetAs() {
        await this.flushPendingTextSave({ sync: false });
        const text = document.getElementById('word-input')?.value || '';
        if (!text.trim() && this.images.length === 0) {
            showToast('Add text or images first!', 'error');
            return;
        }

        const currentSet = this.activeSetId ? await getSetById(this.activeSetId) : null;
        const baseName = currentSet?.name || document.getElementById('set-name-input')?.value.trim() || 'My Slide Set';

        showInputModal({
            title: 'Save Copy As',
            description: 'Save a snapshot under a new name without changing the original set.',
            placeholder: 'New set name...',
            defaultValue: `${baseName} (Copy)`,
            confirmText: 'Save Copy',
            icon: 'copy',
            iconColor: 'blue',
            validation: (val) => (val ? null : 'Please enter a set name'),
            onConfirm: async (newName) => {
                const allSets = await getAllSets();
                const duplicate = allSets.find(s => (s.name || '').trim().toLowerCase() === newName.toLowerCase());
                if (duplicate) {
                    const overwrite = await showConfirmModal(
                        `Overwrite existing set "${duplicate.name}"?`,
                        {
                            title: 'Overwrite Existing Set?',
                            confirmText: 'Overwrite',
                            cancelText: 'Cancel',
                            icon: 'save',
                            iconColor: 'orange'
                        }
                    );
                    if (!overwrite) return;
                }

                const now = Date.now();
                const saved = await saveSetToDB({
                    ...(duplicate || {}),
                    id: duplicate ? duplicate.id : undefined,
                    name: newName,
                    text,
                    images: [...this.images],
                    imageCaptions: this.collectActiveCaptions(),
                    createdAt: duplicate?.createdAt || now,
                    updatedAt: now,
                    lastUsed: now,
                    usageCount: duplicate ? (duplicate.usageCount || 0) : 1
                });
                this.activeSetId = saved.id;
                await dbPut('activeSetId', this.activeSetId, { sync: false });
                const nameInput = document.getElementById('set-name-input');
                if (nameInput) nameInput.value = saved.name;
                await this.renderSets();
                showToast(`Saved copy "${saved.name}"`, 'success');
            }
        });
    },

    async autoSaveActiveSet() {
        if (this.activeSetId === null || this.activeSetId === undefined) return;
        const existing = await getSetById(this.activeSetId);
        if (!existing) return;

        const text = document.getElementById('word-input')?.value || '';
        const now = Date.now();
        await saveSetToDB({
            ...existing,
            text,
            images: [...this.images],
            imageCaptions: this.collectActiveCaptions(),
            updatedAt: now,
            lastUsed: now
        });
    },

    async loadSet(set) {
        await this.flushPendingTextSave({ sync: false });
        const freshSet = (await getSetById(set.id)) || set;
        const textarea = document.getElementById('word-input');
        const nameInput = document.getElementById('set-name-input');
        const nextText = freshSet.text || '';

        if (textarea) textarea.value = nextText;
        localStorage.setItem('kk_rapid_text', nextText);
        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationText', nextText);

        this.images = [...(freshSet.images || [])];
        this.imageCaptions = (freshSet.imageCaptions && typeof freshSet.imageCaptions === 'object')
            ? { ...freshSet.imageCaptions }
            : {};
        await dbPut('presentationImages', this.images);
        await dbPut('presentationImageCaptions', this.imageCaptions);

        this.activeSetId = freshSet.id;
        await dbPut('activeSetId', this.activeSetId, { sync: false });
        if (nameInput) nameInput.value = freshSet.name || '';

        await this.updateSetStats(freshSet.id);

        this.updateImageUI();
        this.updateCount();
        await this.renderSets();
        showToast(`Loaded "${freshSet.name}"`, 'success');
    },

    async quickPlaySet(set) {
        await this.loadSet(set);
        this.startPresentation(false, 0);
    },

    async duplicateSet(set) {
        await this.flushPendingTextSave({ sync: false });
        const freshSet = (await getSetById(set.id)) || set;
        const allSets = await getAllSets();
        const existingNames = new Set(allSets.map(s => (s.name || '').trim().toLowerCase()));
        let candidate = `${freshSet.name} (Copy)`;
        let n = 2;
        while (existingNames.has(candidate.toLowerCase())) {
            candidate = `${freshSet.name} (Copy ${n++})`;
        }

        const now = Date.now();
        await saveSetToDB({
            name: candidate,
            text: freshSet.text || '',
            images: [...(freshSet.images || [])],
            imageCaptions: { ...(freshSet.imageCaptions || {}) },
            createdAt: now,
            updatedAt: now,
            lastUsed: now,
            usageCount: 0
        });
        await this.renderSets();
        showToast(`Duplicated as "${candidate}"`, 'success');
    },

    async updateSetStats(id) {
        const set = await getSetById(id);
        if (!set) return;
        await saveSetToDB({
            ...set,
            lastUsed: Date.now(),
            usageCount: (set.usageCount || 0) + 1
        });
    },

    async detachActiveSet() {
        await this.flushPendingTextSave({ sync: false });
        this.activeSetId = null;
        await dbPut('activeSetId', null, { sync: false });
        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = '';
        await this.renderSets();
        showToast('Detached — editing scratchpad', 'info');
    },

    async newSet() {
        const textarea = document.getElementById('word-input');
        const hasScratchContent = !this.activeSetId && (textarea?.value.trim() || this.images.length > 0);
        if (hasScratchContent) {
            const confirmed = await showConfirmModal(
                'Clear your unsaved scratchpad slides and start fresh?',
                {
                    title: 'Start New Slides?',
                    confirmText: 'Start Fresh',
                    cancelText: 'Keep Current',
                    icon: 'plus-circle',
                    iconColor: 'orange'
                }
            );
            if (!confirmed) return;
        }

        if (this.activeSetId) {
            await this.flushPendingTextSave({ sync: false });
        } else {
            this.cancelPendingTextSave();
        }

        const oldImages = [...this.images];
        this.activeSetId = null;
        await dbPut('activeSetId', null, { sync: false });

        if (textarea) textarea.value = '';
        localStorage.removeItem('kk_rapid_text');

        const nameInput = document.getElementById('set-name-input');
        if (nameInput) nameInput.value = '';

        this.images = [];
        for (const src of oldImages) {
            delete this.imageCaptions[src];
        }

        await dbPut('presentationUpdatedAt', Date.now(), { sync: false });
        await dbPut('presentationText', '');
        await dbPut('presentationImages', []);
        await dbPut('presentationImageCaptions', this.imageCaptions);

        for (const src of oldImages) {
            await safeDeleteImageAsset(src);
        }

        this.updateImageUI();
        this.updateCount();
        await this.renderSets();
        showToast('Started fresh slides', 'info');
    },

    clearSetsSearch() {
        const input = document.getElementById('sets-search');
        if (input) input.value = '';
        this.renderSets();
    },

    async renderSets() {
        const token = ++this.setsRenderToken;
        const list = document.getElementById('sets-list');
        const indicator = document.getElementById('active-set-indicator');
        const activeNameEl = document.getElementById('active-set-name');
        const saveAsBtn = document.getElementById('save-as-btn');
        const countBadge = document.getElementById('sets-count');
        const searchInput = document.getElementById('sets-search');
        const searchClear = document.getElementById('sets-search-clear');
        if (!list) return;

        let sets = await getAllSets();
        if (token !== this.setsRenderToken) return;
        if (countBadge) countBadge.textContent = String(sets.length);

        const sortType = document.getElementById('sets-sort')?.value || 'recent';
        const query = (searchInput?.value || '').trim().toLowerCase();
        if (searchClear) searchClear.classList.toggle('hidden', query.length === 0);

        sets.forEach(s => {
            if (!s.lastUsed) s.lastUsed = s.createdAt || 0;
            if (!s.usageCount) s.usageCount = 0;
        });

        if (sortType === 'recent') {
            sets.sort((a, b) => b.lastUsed - a.lastUsed);
        } else if (sortType === 'alpha') {
            sets.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sortType === 'used') {
            sets.sort((a, b) => b.usageCount - a.usageCount);
        }

        const activeMatch = sets.find(s => String(s.id) === String(this.activeSetId));
        if (activeMatch) {
            indicator?.classList.remove('hidden');
            indicator?.classList.add('flex');
            if (activeNameEl) activeNameEl.innerText = `Editing: ${activeMatch.name}`;
            saveAsBtn?.classList.remove('hidden');
            saveAsBtn?.classList.add('flex');
        } else {
            indicator?.classList.add('hidden');
            indicator?.classList.remove('flex');
            saveAsBtn?.classList.add('hidden');
            saveAsBtn?.classList.remove('flex');
        }

        const filteredSets = query
            ? sets.filter(s => (s.name || '').toLowerCase().includes(query) || (s.text || '').toLowerCase().includes(query))
            : sets;

        if (filteredSets.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-dark/35 dark:text-chalk/35 gap-1.5 py-4">
                    <i data-lucide="folder-open" class="w-5 h-5 opacity-55"></i>
                    <p class="text-[11px] font-bold font-title italic">${query ? 'No matching sets found.' : 'No saved sets yet.'}</p>
                </div>
            `;
            refreshIcons();
            return;
        }

        list.innerHTML = '';

        filteredSets.forEach(set => {
            const isActive = String(this.activeSetId) === String(set.id);
            const textItems = set.text ? set.text.split(/[;\n]+/).filter(w => w.trim()).length : 0;
            const imgItems = Array.isArray(set.images) ? set.images.length : 0;
            const items = textItems + imgItems;

            const item = document.createElement('div');
            item.className = `group flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border-2 ${isActive ? 'border-orange shadow-hard-orange' : 'border-dark/25 dark:border-slate-600 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.12)] dark:shadow-[2px_2px_0px_0px_#000]'} rounded-xl hover:border-orange transition-all cursor-pointer relative`;

            item.innerHTML = `
                <div class="w-8 h-8 ${isActive ? 'bg-orange text-white border-dark' : 'bg-orange/15 text-orange border-orange/30'} rounded-lg flex items-center justify-center shrink-0 border-2">
                    <i data-lucide="${isActive ? 'pencil' : 'file-text'}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold ${isActive ? 'text-orange' : 'text-dark dark:text-chalk'} truncate font-title uppercase tracking-tight">${escapeHtml(set.name)}</p>
                    <p class="text-[10px] text-dark/55 dark:text-chalk/50 font-bold">${items} slide${items !== 1 ? 's' : ''}${imgItems > 0 ? ` (${imgItems} img)` : ''}${set.usageCount > 0 ? ` &bull; ${set.usageCount} play${set.usageCount !== 1 ? 's' : ''}` : ''}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" class="set-play p-1.5 bg-green/15 text-green rounded-lg border-2 border-green/40 hover:bg-green hover:text-white hover:border-dark transition-all" title="Load &amp; Present">
                        <i data-lucide="play" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" class="set-dup p-1.5 bg-blue/15 text-blue rounded-lg border-2 border-blue/40 hover:bg-blue hover:text-white hover:border-dark transition-all" title="Duplicate Set">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" class="set-del p-1.5 bg-pink/15 text-pink rounded-lg border-2 border-pink/40 hover:bg-pink hover:text-white hover:border-dark transition-all" title="Delete Set">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                ${isActive ? '<div class="absolute -top-2 -right-1 bg-orange text-white text-[8px] font-title font-bold px-2 py-0.5 rounded-full border-2 border-dark shadow-[1px_1px_0px_0px_#0f172a]">ACTIVE</div>' : ''}
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.loadSet(set);
            });
            item.querySelector('.set-play').addEventListener('click', (e) => {
                e.stopPropagation();
                this.quickPlaySet(set);
            });
            item.querySelector('.set-dup').addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateSet(set);
            });
            item.querySelector('.set-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await showConfirmModal(`Delete "${set.name}"?`, {
                    title: 'Delete Set?',
                    confirmText: 'Delete',
                    cancelText: 'Keep',
                    icon: 'trash-2',
                    iconColor: 'red'
                });
                if (!confirmed) return;

                const imgsToCheck = Array.isArray(set.images) ? [...set.images] : [];
                if (String(this.activeSetId) === String(set.id)) {
                    this.cancelPendingTextSave();
                    this.activeSetId = null;
                    await dbPut('activeSetId', null, { sync: false });
                    const nameInput = document.getElementById('set-name-input');
                    if (nameInput) nameInput.value = '';
                }
                await deleteSet(set.id);
                for (const src of imgsToCheck) {
                    await safeDeleteImageAsset(src, { excludeSetId: set.id });
                }
                await this.renderSets();
                showToast('Set deleted', 'info');
            });

            list.appendChild(item);
        });

        refreshIcons();
    }
};

window.app = app;

window.onload = async () => {
    await requireAuth();
    app.init();
};

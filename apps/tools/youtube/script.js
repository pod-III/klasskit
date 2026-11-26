(function () {
    'use strict';

    // ============================
    // CONSTANTS & STORAGE KEYS
    // ============================
    const TOOL_KEY = 'youtube-library';
    const CATEGORIES_KEY = 'youtube-categories';
    const PLAYLISTS_KEY = 'youtube-playlists';

    const DEFAULT_CATEGORIES = [
        { id: 'uncategorized', name: 'Uncategorized', color: '#94a3b8' },
        { id: 'grammar', name: 'Grammar', color: '#ff4785' },
        { id: 'vocabulary', name: 'Vocabulary', color: '#1ea7fd' },
        { id: 'listening', name: 'Listening', color: '#00d063' },
        { id: 'speaking', name: 'Speaking', color: '#ff7e33' },
        { id: 'reading', name: 'Reading', color: '#8b5cf6' },
        { id: 'writing', name: 'Writing', color: '#ec4899' }
    ];

    // ============================
    // STATE
    // ============================
    let library = [];
    let categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    let playlists = [];
    let activePlaylistId = null; // null = All, '__favorites__' = Favorites, else playlist id

    let player = null;
    let apiReady = false;
    let pendingPlayId = null;

    // UI Filter/Sort State
    let currentFilter = 'all';
    let currentSort = localStorage.getItem('youtube_sort') || 'date-desc';
    let currentView = localStorage.getItem('youtube_view_mode') || 'grid';
    let searchQuery = '';
    let selectedVideos = new Set();
    let favoritesOnly = false;
    let editingVideoId = null;
    let editingPlaylistId = null;
    let managingPlaylistsVideoId = null;
    let bulkMode = false;

    // Player & Classroom State
    let currentQueue = [];
    let currentQueueIndex = -1;
    let currentVideoId = null;
    let isPlayingFromPlaylist = false;
    let autoplayNext = localStorage.getItem('youtube_autoplay_next') === 'true';
    let autoPauseCues = localStorage.getItem('youtube_autopause_cues') === 'true';
    let playerLoop = false;
    let playerMuted = false;
    let playerVolume = Math.min(100, Math.max(0, Number(localStorage.getItem('youtube_volume') ?? 100) || 100));
    let currentSpeed = Number(localStorage.getItem('youtube_speed') ?? 1) || 1;
    let seekPoller = null;
    let prevPollTime = 0;
    let lastTriggeredCueId = null;
    let loopA = null;
    let loopB = null;
    let curtainOpen = false;
    let activePlayerTab = 'queue';

    let syncTimer = null;
    let previewFetchCtrl = null;

    // ============================
    // SAFE HELPERS & PARSERS
    // ============================
    function hydrateIcons(root) {
        if (typeof lucide === 'undefined' || typeof lucide.createIcons !== 'function') return;
        try {
            lucide.createIcons(root && root !== document ? { root } : undefined);
        } catch (e) {
            lucide.createIcons();
        }
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        while (container.children.length >= 3) {
            container.firstElementChild.remove();
        }
        const colors = {
            info: 'bg-blue text-white',
            success: 'bg-green text-dark',
            warning: 'bg-orange text-dark',
            error: 'bg-pink text-white'
        };
        const icons = {
            info: 'info',
            success: 'check-circle',
            warning: 'alert-triangle',
            error: 'alert-circle'
        };
        const el = document.createElement('div');
        el.className = `pointer-events-auto px-4 py-2.5 rounded-2xl border-[3px] border-[#1e293b] shadow-hard font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-2 animate-pop-in ${colors[type] || colors.info}`;
        el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i><span></span>`;
        el.querySelector('span').textContent = msg;
        container.appendChild(el);
        hydrateIcons(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            el.style.transition = 'all 0.25s ease';
            setTimeout(() => el.remove(), 260);
        }, 2500);
    }

    function parseTimeToken(raw) {
        if (raw === null || raw === undefined) return 0;
        const s = String(raw).trim().toLowerCase();
        if (!s) return 0;
        if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10));

        // 1h2m3s style
        const hmsMatch = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
        if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
            const h = parseInt(hmsMatch[1] || '0', 10);
            const m = parseInt(hmsMatch[2] || '0', 10);
            const sec = parseInt(hmsMatch[3] || '0', 10);
            return Math.max(0, h * 3600 + m * 60 + sec);
        }

        // hh:mm:ss or mm:ss
        if (s.includes(':')) {
            const parts = s.split(':').map(n => parseInt(n, 10));
            if (parts.some(isNaN)) return 0;
            if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
            if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
        }
        return 0;
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n) => (n < 10 ? '0' + n : String(n));
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    function extractVideoInfo(rawInput) {
        const input = String(rawInput || '').trim();
        if (!input) return { id: null, startTime: 0 };

        // Exact 11-char ID
        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
            return { id: input, startTime: 0 };
        }

        let urlStr = input;
        if (!/^https?:\/\//i.test(urlStr)) {
            if (/^(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|m\.youtube\.com)/i.test(urlStr)) {
                urlStr = 'https://' + urlStr;
            }
        }

        try {
            const url = new URL(urlStr);
            const host = url.hostname.replace(/^www\.|^m\./i, '').toLowerCase();
            let id = null;

            if (host === 'youtu.be') {
                const seg = url.pathname.split('/').filter(Boolean)[0];
                if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) id = seg;
            } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
                const vParam = url.searchParams.get('v');
                if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
                    id = vParam;
                } else {
                    const segs = url.pathname.split('/').filter(Boolean);
                    if (segs.length >= 2 && ['shorts', 'live', 'embed', 'v'].includes(segs[0])) {
                        if (/^[a-zA-Z0-9_-]{11}$/.test(segs[1])) id = segs[1];
                    }
                }
            }

            if (id) {
                const tRaw = url.searchParams.get('t') || url.searchParams.get('start') || '';
                return { id, startTime: parseTimeToken(tRaw) };
            }
        } catch (e) {}

        // Fallback regex match for malformed URLs containing watch?v= or /shorts/
        const regex = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
        const match = input.match(regex);
        if (match && match[1]) {
            const tMatch = input.match(/[?&#](?:t|start)=([0-9hms:]+)/i);
            return { id: match[1], startTime: tMatch ? parseTimeToken(tMatch[1]) : 0 };
        }

        return { id: null, startTime: 0 };
    }

    async function fetchVideoTitle(videoId) {
        if (!videoId || typeof fetch !== 'function') return null;
        if (previewFetchCtrl) {
            try { previewFetchCtrl.abort(); } catch (e) {}
        }
        previewFetchCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = previewFetchCtrl ? setTimeout(() => previewFetchCtrl.abort(), 4000) : null;

        try {
            const endpoint = `https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`;
            const resp = await fetch(endpoint, previewFetchCtrl ? { signal: previewFetchCtrl.signal } : undefined);
            if (!resp.ok) return null;
            const data = await resp.json();
            return data && typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
        } catch (e) {
            return null;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    function normalizeVideo(raw) {
        if (!raw || typeof raw !== 'object' || !raw.id) return null;
        return {
            id: String(raw.id),
            title: String(raw.title || `Untitled Video (${raw.id})`),
            category: String(raw.category || 'uncategorized'),
            added: raw.added || new Date().toISOString(),
            favorite: Boolean(raw.favorite),
            startTime: Math.max(0, Number(raw.startTime) || 0),
            playCount: Math.max(0, Number(raw.playCount) || 0),
            lastPlayed: raw.lastPlayed || null,
            notes: typeof raw.notes === 'string' ? raw.notes : '',
            bookmarks: Array.isArray(raw.bookmarks)
                ? raw.bookmarks
                    .filter(b => b && typeof b.time === 'number' && !isNaN(b.time))
                    .map(b => ({
                        id: String(b.id || ('bm_' + Math.random().toString(36).slice(2, 8))),
                        time: Math.max(0, Math.floor(b.time)),
                        label: String(b.label || `Cue ${formatTime(b.time)}`)
                    }))
                    .sort((a, b) => a.time - b.time)
                : []
        };
    }

    function normalizePlaylist(raw) {
        if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) return null;
        return {
            id: String(raw.id),
            name: String(raw.name),
            color: String(raw.color || '#ff4785'),
            videos: Array.isArray(raw.videos) ? raw.videos.map(String) : []
        };
    }

    // ============================
    // PERSISTENCE & SYNC
    // ============================
    function updateSyncStatus(text, icon = 'cloud', spin = false) {
        const html = `<i data-lucide="${icon}" class="w-3.5 h-3.5 ${icon === 'cloud' ? 'text-blue' : ''} ${spin ? 'sync-spinner' : ''}"></i><span>${escapeHtml(text)}</span>`;
        const desktop = document.getElementById('auth-status');
        const mobile = document.getElementById('auth-status-mobile');
        if (desktop) desktop.innerHTML = html;
        if (mobile) mobile.innerHTML = html;
        if (desktop) hydrateIcons(desktop);
        if (mobile) hydrateIcons(mobile);
    }

    async function syncAll() {
        updateSyncStatus('Syncing...', 'refresh-cw', true);
        try {
            if (typeof window.saveProgress === 'function') {
                await window.saveProgress(TOOL_KEY, library);
                await window.saveProgress(PLAYLISTS_KEY, playlists);
            }
            updateSyncStatus('Synced', 'cloud');
        } catch (err) {
            console.error('Sync failed:', err);
            updateSyncStatus('Offline', 'cloud-off');
        }
    }

    function scheduleSync(delayMs = 600) {
        updateSyncStatus('Saving...', 'refresh-cw', true);
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            syncTimer = null;
            syncAll();
        }, delayMs);
    }

    async function saveCategories() {
        try {
            if (typeof window.saveProgress === 'function') {
                await window.saveProgress(CATEGORIES_KEY, categories);
            }
        } catch (e) {}
    }

    function exportLibraryBackup() {
        const payload = {
            app: 'KlassKit Video Library',
            version: 2,
            exportedAt: new Date().toISOString(),
            library,
            categories,
            playlists
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `klasskit-video-library-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast('Exported library backup!', 'success');
    }

    // ============================
    // CATEGORIES & DROPDOWNS
    // ============================
    function populateCategoryDropdowns() {
        const filterSelect = document.getElementById('category-filter');
        const bulkCatSelect = document.getElementById('bulk-move-cat-select');
        const datalist = document.getElementById('category-datalist');

        if (filterSelect) {
            const prev = filterSelect.value || currentFilter || 'all';
            filterSelect.innerHTML = '<option value="all">All Categories</option>' +
                categories.map(cat => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</option>`).join('');
            const exists = prev === 'all' || categories.some(c => c.id === prev);
            filterSelect.value = exists ? prev : 'all';
            currentFilter = filterSelect.value;
        }

        if (bulkCatSelect) {
            bulkCatSelect.innerHTML = categories
                .map(cat => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</option>`)
                .join('');
        }

        if (datalist) {
            datalist.innerHTML = categories
                .filter(c => c.id !== 'uncategorized')
                .map(cat => `<option value="${escapeHtml(cat.name)}"></option>`)
                .join('');
        }
    }

    function populatePlaylistSelect() {
        const addSelect = document.getElementById('video-playlist-select');
        const bulkSelect = document.getElementById('bulk-add-pl-select');

        if (addSelect) {
            const prev = addSelect.value;
            addSelect.innerHTML = '<option value="">-- None --</option>' +
                playlists.map(pl => `<option value="${escapeHtml(pl.id)}">${escapeHtml(pl.name)}</option>`).join('');
            if (prev && playlists.some(p => p.id === prev)) addSelect.value = prev;
        }

        if (bulkSelect) {
            bulkSelect.innerHTML = playlists.length === 0
                ? '<option value="">No playlists</option>'
                : playlists.map(pl => `<option value="${escapeHtml(pl.id)}">${escapeHtml(pl.name)}</option>`).join('');
        }
    }

    function getOrCreateCategory(categoryName) {
        const normalizedName = String(categoryName || '').trim();
        if (!normalizedName) return categories[0];

        const existing = categories.find(c => c.name.toLowerCase() === normalizedName.toLowerCase());
        if (existing) return existing;

        const colors = ['#ff4785', '#1ea7fd', '#00d063', '#ff7e33', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16'];
        const newCat = {
            id: (normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat') + '-' + Date.now(),
            name: normalizedName,
            color: colors[Math.floor(Math.random() * colors.length)]
        };
        categories.push(newCat);
        saveCategories();
        populateCategoryDropdowns();
        return newCat;
    }

    // ============================
    // LIBRARY FILTERING & RENDERING
    // ============================
    function getFilteredLibrary() {
        let filtered = library.slice();

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(v => {
                const catName = (categories.find(c => c.id === v.category)?.name || '').toLowerCase();
                const cueText = (v.bookmarks || []).map(b => b.label.toLowerCase()).join(' ');
                return (
                    v.title.toLowerCase().includes(q) ||
                    v.id.toLowerCase().includes(q) ||
                    catName.includes(q) ||
                    (v.notes || '').toLowerCase().includes(q) ||
                    cueText.includes(q)
                );
            });
        }

        if (currentFilter !== 'all') {
            filtered = filtered.filter(v => v.category === currentFilter);
        }

        if (activePlaylistId && activePlaylistId !== '__favorites__') {
            const pl = playlists.find(p => p.id === activePlaylistId);
            if (pl) {
                // Respect playlist order cleanly
                const posMap = new Map(pl.videos.map((vid, idx) => [vid, idx]));
                filtered = filtered
                    .filter(v => posMap.has(v.id))
                    .sort((a, b) => posMap.get(a.id) - posMap.get(b.id));
            } else {
                filtered = [];
            }
        }

        if (favoritesOnly || activePlaylistId === '__favorites__') {
            filtered = filtered.filter(v => v.favorite);
        }

        return filtered;
    }

    function updateLibraryStats() {
        document.getElementById('total-videos').textContent = library.length;
        document.getElementById('total-favorites').textContent = library.filter(v => v.favorite).length;
        document.getElementById('total-categories').textContent = categories.length;
        const cueTotal = library.reduce((sum, v) => sum + (Array.isArray(v.bookmarks) ? v.bookmarks.length : 0), 0);
        document.getElementById('total-bookmarks').textContent = cueTotal;
    }

    function renderLibrary() {
        const grid = document.getElementById('video-grid');
        if (!grid) return;
        grid.innerHTML = '';

        let filtered = getFilteredLibrary();

        if (!activePlaylistId || activePlaylistId === '__favorites__' || currentSort !== 'date-desc') {
            filtered.sort((a, b) => {
                switch (currentSort) {
                    case 'date-desc':
                        return new Date(b.added) - new Date(a.added);
                    case 'date-asc':
                        return new Date(a.added) - new Date(b.added);
                    case 'title-asc':
                        return a.title.localeCompare(b.title);
                    case 'title-desc':
                        return b.title.localeCompare(a.title);
                    case 'category': {
                        const catA = categories.find(c => c.id === a.category)?.name || 'Uncategorized';
                        const catB = categories.find(c => c.id === b.category)?.name || 'Uncategorized';
                        return catA.localeCompare(catB);
                    }
                    case 'most-played':
                        return (b.playCount || 0) - (a.playCount || 0);
                    case 'recently-watched':
                        return new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0);
                    default:
                        return 0;
                }
            });
        }

        updateLibraryStats();

        if (filtered.length === 0) {
            const isEmpty = library.length === 0;
            grid.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="tv-2" class="w-16 h-16 text-blue mb-4"></i>
                    <h2 class="font-heading text-2xl font-bold uppercase text-dark dark:text-white mb-1">${isEmpty ? 'Your Library is Empty' : 'No Videos Match Your Filters'}</h2>
                    <p class="font-semibold text-sm text-slate-500 dark:text-slate-400 mb-5">${isEmpty ? 'Add YouTube videos, organize playlists, and mark discussion cues.' : 'Try clearing your search or switching category filters.'}</p>
                    ${isEmpty ? `<button type="button" id="empty-add-btn" class="btn-chunky bg-green text-dark px-6 py-3 rounded-xl text-sm gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Add Your First Video</button>` : ''}
                </div>
            `;
            hydrateIcons(grid);
            document.getElementById('empty-add-btn')?.addEventListener('click', () => toggleAddModal(true));
            return;
        }

        filtered.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.videoId = video.id;

            const thumbUrl = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/mqdefault.jpg`;
            const cat = categories.find(c => c.id === video.category) || categories[0];
            const isFavorite = Boolean(video.favorite);
            const isSelected = selectedVideos.has(video.id);
            const cueCount = Array.isArray(video.bookmarks) ? video.bookmarks.length : 0;

            card.innerHTML = `
                <div class="thumbnail-container">
                    <img src="${thumbUrl}" alt="${escapeHtml(video.title)}" loading="lazy">
                    <div class="thumb-badge-stack">
                        ${video.startTime > 0 ? `<span class="thumb-pill"><i data-lucide="clock" class="w-2.5 h-2.5 text-orange"></i>${escapeHtml(formatTime(video.startTime))}</span>` : ''}
                        ${cueCount > 0 ? `<span class="thumb-pill"><i data-lucide="bookmark" class="w-2.5 h-2.5 text-pink"></i>${cueCount} cue${cueCount > 1 ? 's' : ''}</span>` : ''}
                        ${video.playCount > 0 ? `<span class="thumb-pill"><i data-lucide="play" class="w-2.5 h-2.5 text-green"></i>${video.playCount}</span>` : ''}
                    </div>
                    <div class="play-overlay">
                        <i data-lucide="play" class="w-12 h-12 text-white fill-current"></i>
                    </div>
                </div>
                <div class="card-content">
                    <div class="checkbox-select ${isSelected ? 'checked' : ''} ${bulkMode ? '' : 'hidden'}" data-action="select" title="Select video">
                        ${isSelected ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                    </div>
                    <div class="card-title">${escapeHtml(video.title)}</div>
                    <div class="card-meta">
                        <span class="category-badge" style="background-color: ${escapeHtml(cat.color)}">${escapeHtml(cat.name)}</span>
                        <span class="text-slate-400 truncate">${escapeHtml(new Date(video.added).toLocaleDateString())}</span>
                    </div>
                    <div class="card-actions">
                        <button type="button" class="action-btn btn-favorite ${isFavorite ? 'active' : ''}" data-action="fav" title="Favorite" aria-label="Toggle favorite">
                            <i data-lucide="star" class="w-4 h-4 ${isFavorite ? 'fill-current' : ''}"></i>
                        </button>
                        <button type="button" class="action-btn" data-action="playlists" title="Add to Playlists" aria-label="Manage playlists">
                            <i data-lucide="list-plus" class="w-4 h-4"></i>
                        </button>
                        <button type="button" class="action-btn" data-action="edit" title="Edit Video" aria-label="Edit video">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button type="button" class="action-btn btn-delete" data-action="delete" title="Delete Video" aria-label="Remove video">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `;

            card.addEventListener('click', (e) => {
                const actionEl = e.target.closest('[data-action]');
                if (actionEl) {
                    e.stopPropagation();
                    const action = actionEl.dataset.action;
                    if (action === 'select') toggleVideoSelection(video.id);
                    else if (action === 'fav') toggleFavorite(video.id);
                    else if (action === 'playlists') openVideoPlaylistsModal(video.id);
                    else if (action === 'edit') openEditModal(video.id);
                    else if (action === 'delete') deleteVideo(video.id);
                    return;
                }
                if (bulkMode) {
                    toggleVideoSelection(video.id);
                } else {
                    playVideo(video.id);
                }
            });

            grid.appendChild(card);
        });

        hydrateIcons(grid);
    }

    // ============================
    // PLAYLISTS SIDEBAR & MODALS
    // ============================
    function togglePlaylistsSidebar(show) {
        const sidebar = document.getElementById('playlists-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar || !backdrop) return;
        if (show) {
            sidebar.classList.add('active');
            backdrop.classList.remove('hidden');
            setTimeout(() => backdrop.classList.add('opacity-100'), 10);
        } else {
            sidebar.classList.remove('active');
            backdrop.classList.remove('opacity-100');
            setTimeout(() => backdrop.classList.add('hidden'), 260);
        }
    }

    function selectPlaylist(playlistId) {
        activePlaylistId = playlistId;
        isPlayingFromPlaylist = false;
        favoritesOnly = (playlistId === '__favorites__');
        syncFavoritesBtnUI();
        renderPlaylists();
        renderLibrary();

        const banner = document.getElementById('playlist-banner');
        if (banner) {
            if (playlistId && playlistId !== '__favorites__') {
                const pl = playlists.find(p => p.id === playlistId);
                if (pl) {
                    banner.classList.remove('hidden');
                    const titleEl = document.getElementById('playlist-banner-title');
                    const descEl = document.getElementById('playlist-banner-desc');
                    const colorEl = document.getElementById('playlist-banner-color');
                    if (titleEl) titleEl.textContent = pl.name;
                    if (descEl) descEl.textContent = `${pl.videos.length} video${pl.videos.length !== 1 ? 's' : ''}`;
                    if (colorEl) colorEl.style.backgroundColor = pl.color;
                } else {
                    banner.classList.add('hidden');
                }
            } else {
                banner.classList.add('hidden');
            }
        }
        togglePlaylistsSidebar(false);
    }

    function renderPlaylists() {
        const list = document.getElementById('playlists-list');
        if (!list) return;
        list.innerHTML = '';

        const makeFixedItem = (id, label, icon, iconBg, count) => {
            const isActive = activePlaylistId === id;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = `w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                isActive
                    ? 'border-[#1e293b] dark:border-white shadow-hard-sm bg-white dark:bg-slate-800'
                    : 'border-transparent bg-slate-50/70 dark:bg-slate-800/30 hover:border-[#1e293b]/40'
            }`;
            row.innerHTML = `
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-5 h-5 rounded-lg border border-black/25 flex items-center justify-center text-white shrink-0 ${iconBg}">
                        <i data-lucide="${icon}" class="w-3 h-3"></i>
                    </div>
                    <span class="font-heading font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 truncate">${escapeHtml(label)}</span>
                </div>
                <span class="text-xs font-bold text-slate-400 shrink-0">${count}</span>
            `;
            row.addEventListener('click', () => selectPlaylist(id));
            return row;
        };

        list.appendChild(makeFixedItem(null, 'All Videos', 'video', 'bg-blue', library.length));
        list.appendChild(makeFixedItem('__favorites__', 'Favorites', 'star', 'bg-orange', library.filter(v => v.favorite).length));

        if (playlists.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'my-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700';
            list.appendChild(divider);
        }

        playlists.forEach(pl => {
            const isActive = activePlaylistId === pl.id;
            const item = document.createElement('div');
            item.className = `flex items-center justify-between group p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                isActive
                    ? 'border-[#1e293b] dark:border-white shadow-hard-sm bg-white dark:bg-slate-800'
                    : 'border-transparent bg-slate-50/70 dark:bg-slate-800/30 hover:border-[#1e293b]/40'
            }`;
            item.innerHTML = `
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <div class="w-4 h-4 rounded-full border border-black/25 shrink-0" style="background-color: ${escapeHtml(pl.color || '#ff4785')}"></div>
                    <span class="font-heading font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 truncate">${escapeHtml(pl.name)}</span>
                </div>
                <div class="flex items-center gap-1 ml-2 shrink-0">
                    <span class="text-xs font-bold text-slate-400 group-hover:hidden">${pl.videos.length}</span>
                    <div class="hidden group-hover:flex items-center gap-1">
                        <button type="button" data-pl-edit="${escapeHtml(pl.id)}" class="p-1 text-slate-400 hover:text-blue transition-colors" title="Edit Playlist" aria-label="Edit playlist">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" data-pl-del="${escapeHtml(pl.id)}" class="p-1 text-slate-400 hover:text-pink transition-colors" title="Delete Playlist" aria-label="Delete playlist">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                selectPlaylist(pl.id);
            });
            item.querySelector('[data-pl-edit]').addEventListener('click', (e) => {
                e.stopPropagation();
                togglePlaylistModal(true, pl.id);
            });
            item.querySelector('[data-pl-del]').addEventListener('click', (e) => {
                e.stopPropagation();
                deletePlaylist(pl.id);
            });
            list.appendChild(item);
        });

        hydrateIcons(list);
        populatePlaylistSelect();
    }

    function togglePlaylistModal(show, playlistId = null) {
        const modal = document.getElementById('playlist-modal');
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
            const titleEl = document.getElementById('playlist-modal-title');
            if (playlistId) {
                editingPlaylistId = playlistId;
                const pl = playlists.find(p => p.id === playlistId);
                titleEl.innerHTML = '<i data-lucide="pencil" class="w-5 h-5"></i><span>Edit Playlist</span>';
                document.getElementById('playlist-name').value = pl ? pl.name : '';
                document.getElementById('playlist-color').value = pl ? pl.color : '#ff4785';
            } else {
                editingPlaylistId = null;
                titleEl.innerHTML = '<i data-lucide="list-video" class="w-5 h-5"></i><span>New Playlist</span>';
                document.getElementById('playlist-name').value = '';
                document.getElementById('playlist-color').value = '#ff4785';
            }
            hydrateIcons(titleEl);
            setTimeout(() => document.getElementById('playlist-name').focus(), 40);
        } else {
            modal.classList.remove('active');
            editingPlaylistId = null;
        }
    }

    async function savePlaylist() {
        const name = document.getElementById('playlist-name').value.trim();
        const color = document.getElementById('playlist-color').value;
        if (!name) {
            await showAlertModal('Please enter a playlist name.', { title: 'Input Required', icon: 'alert-circle', iconColor: 'orange' });
            return;
        }

        if (editingPlaylistId) {
            const pl = playlists.find(p => p.id === editingPlaylistId);
            if (pl) {
                pl.name = name;
                pl.color = color;
            }
        } else {
            playlists.push({
                id: 'pl-' + Date.now(),
                name,
                color,
                videos: []
            });
        }

        await syncAll();
        renderPlaylists();
        if (activePlaylistId && activePlaylistId === editingPlaylistId) {
            selectPlaylist(activePlaylistId);
        }
        togglePlaylistModal(false);
        showToast(editingPlaylistId ? 'Playlist updated!' : 'Playlist created!', 'success');
    }

    async function deletePlaylist(playlistId) {
        const pl = playlists.find(p => p.id === playlistId);
        if (!pl) return;
        const confirmed = await showConfirmModal(`Delete "${pl.name}"? Your saved videos stay in the library.`, {
            title: 'Delete Playlist?',
            confirmText: 'Delete',
            cancelText: 'Keep',
            icon: 'trash-2',
            iconColor: 'red'
        });
        if (!confirmed) return;

        playlists = playlists.filter(p => p.id !== playlistId);
        if (activePlaylistId === playlistId) activePlaylistId = null;
        await syncAll();
        renderPlaylists();
        renderLibrary();
        selectPlaylist(activePlaylistId);
        showToast('Playlist deleted', 'info');
    }

    // ============================
    // VIDEO ADD / EDIT / BULK / DELETE
    // ============================
    async function refreshAddModalPreview(rawInput) {
        const wrap = document.getElementById('add-preview-wrap');
        const thumb = document.getElementById('add-preview-thumb');
        const status = document.getElementById('add-preview-status');
        const startInp = document.getElementById('video-start-time');
        const titleInp = document.getElementById('video-title');
        if (!wrap || !thumb || !status) return;

        const { id, startTime } = extractVideoInfo(rawInput);
        if (!id) {
            wrap.classList.add('hidden');
            wrap.classList.remove('flex');
            return;
        }

        wrap.classList.remove('hidden');
        wrap.classList.add('flex');
        thumb.src = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
        status.textContent = `ID: ${id} — Fetching title...`;
        if (startTime > 0 && startInp && !startInp.value.trim()) {
            startInp.value = formatTime(startTime);
        }

        const fetched = await fetchVideoTitle(id);
        // Only update if modal still shows same ID
        if (extractVideoInfo(document.getElementById('video-url')?.value).id !== id) return;
        if (fetched) {
            status.textContent = fetched;
            if (titleInp && !titleInp.value.trim()) {
                titleInp.value = fetched;
            }
        } else {
            status.textContent = `Ready to save (${id})`;
        }
    }

    function toggleAddModal(show) {
        const modal = document.getElementById('add-modal');
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
            document.getElementById('add-preview-wrap').classList.add('hidden');
            document.getElementById('add-preview-wrap').classList.remove('flex');
            if (activePlaylistId && activePlaylistId !== '__favorites__') {
                document.getElementById('video-playlist-select').value = activePlaylistId;
            }
            setTimeout(() => document.getElementById('video-url').focus(), 40);
        } else {
            modal.classList.remove('active');
            document.getElementById('video-url').value = '';
            document.getElementById('video-title').value = '';
            document.getElementById('video-start-time').value = '';
            document.getElementById('video-category').value = '';
            document.getElementById('video-playlist-select').value = '';
            document.getElementById('add-preview-wrap').classList.add('hidden');
            document.getElementById('add-preview-wrap').classList.remove('flex');
        }
    }

    async function addVideo() {
        const rawUrl = document.getElementById('video-url').value.trim();
        const titleInput = document.getElementById('video-title');
        const categoryInput = document.getElementById('video-category');
        const startInput = document.getElementById('video-start-time');
        const playlistSelect = document.getElementById('video-playlist-select');

        const { id, startTime: urlStart } = extractVideoInfo(rawUrl);
        if (!id) {
            await showAlertModal('Please enter a valid YouTube URL or 11-character video ID.', { title: 'Invalid Video URL', icon: 'alert-circle', iconColor: 'orange' });
            return;
        }
        if (library.some(v => v.id === id)) {
            await showAlertModal('This video is already in your library.', { title: 'Duplicate Video', icon: 'info', iconColor: 'blue' });
            return;
        }

        let title = titleInput.value.trim();
        if (!title) {
            title = (await fetchVideoTitle(id)) || `Untitled Video (${id})`;
        }
        const customStart = startInput.value.trim() ? parseTimeToken(startInput.value) : urlStart;
        const category = getOrCreateCategory(categoryInput.value.trim());
        const playlistId = playlistSelect.value;

        const video = normalizeVideo({
            id,
            title,
            category: category.id,
            startTime: customStart,
            added: new Date().toISOString(),
            favorite: false
        });
        library.unshift(video);

        if (playlistId) {
            const pl = playlists.find(p => p.id === playlistId);
            if (pl && !pl.videos.includes(id)) pl.videos.push(id);
        }

        await syncAll();
        renderLibrary();
        renderPlaylists();
        toggleAddModal(false);
        showToast('Video saved to library!', 'success');
    }

    function openEditModal(videoId) {
        const video = library.find(v => v.id === videoId);
        if (!video) return;
        editingVideoId = videoId;
        document.getElementById('edit-video-title').value = video.title;
        document.getElementById('edit-video-start-time').value = video.startTime > 0 ? formatTime(video.startTime) : '';
        const cat = categories.find(c => c.id === video.category);
        document.getElementById('edit-video-category').value = cat ? cat.name : '';
        toggleEditModal(true);
    }

    function toggleEditModal(show) {
        const modal = document.getElementById('edit-modal');
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
            setTimeout(() => document.getElementById('edit-video-title').focus(), 40);
        } else {
            modal.classList.remove('active');
            editingVideoId = null;
            document.getElementById('edit-video-title').value = '';
            document.getElementById('edit-video-start-time').value = '';
        }
    }

    async function saveVideoEdit() {
        if (!editingVideoId) return;
        const video = library.find(v => v.id === editingVideoId);
        if (!video) return;

        const newTitle = document.getElementById('edit-video-title').value.trim();
        if (!newTitle) {
            await showAlertModal('Please enter a video title.', { title: 'Input Required', icon: 'alert-circle', iconColor: 'orange' });
            return;
        }
        const category = getOrCreateCategory(document.getElementById('edit-video-category').value.trim());
        video.title = newTitle;
        video.category = category.id;
        video.startTime = parseTimeToken(document.getElementById('edit-video-start-time').value);

        await syncAll();
        renderLibrary();
        if (currentVideoId === video.id) {
            document.getElementById('current-title').textContent = video.title;
            document.getElementById('player-video-title').textContent = video.title;
            document.getElementById('curtain-title').textContent = video.title;
            const badge = document.getElementById('player-video-category');
            badge.textContent = category.name;
            badge.style.backgroundColor = category.color;
        }
        toggleEditModal(false);
        showToast('Video details updated!', 'success');
    }

    async function deleteVideo(id) {
        const confirmed = await showConfirmModal('Remove this video from your library?', {
            title: 'Remove Video?',
            confirmText: 'Remove',
            cancelText: 'Keep',
            icon: 'trash-2',
            iconColor: 'red'
        });
        if (!confirmed) return;
        library = library.filter(v => v.id !== id);
        playlists.forEach(pl => { pl.videos = pl.videos.filter(vid => vid !== id); });
        selectedVideos.delete(id);
        await syncAll();
        renderLibrary();
        renderPlaylists();
        showToast('Video removed', 'info');
    }

    function toggleFavorite(videoId) {
        const video = library.find(v => v.id === videoId);
        if (!video) return;
        video.favorite = !video.favorite;
        scheduleSync();
        renderLibrary();
        renderPlaylists();
        if (currentVideoId === videoId) updatePlayerFavBtn(video.favorite);
    }

    function openVideoPlaylistsModal(videoId) {
        const video = library.find(v => v.id === videoId);
        if (!video) return;
        managingPlaylistsVideoId = videoId;
        const list = document.getElementById('video-playlists-list');
        if (!list) return;
        list.innerHTML = '';

        if (playlists.length === 0) {
            list.innerHTML = `
                <div class="text-center p-4 opacity-70">
                    <p class="text-sm font-bold mb-3">No playlists created yet.</p>
                    <button id="empty-create-pl-btn" type="button" class="btn-chunky bg-blue text-white px-4 py-2 rounded-xl text-xs">Create a Playlist</button>
                </div>
            `;
            document.getElementById('empty-create-pl-btn').addEventListener('click', () => {
                toggleVideoPlaylistsModal(false);
                togglePlaylistModal(true);
            });
            toggleVideoPlaylistsModal(true);
            return;
        }

        playlists.forEach(pl => {
            const checked = pl.videos.includes(videoId);
            const row = document.createElement('label');
            row.className = 'flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-[#1e293b]/25 dark:border-slate-600 cursor-pointer hover:border-blue transition-colors';
            row.innerHTML = `
                <input type="checkbox" class="w-4 h-4 accent-blue cursor-pointer" ${checked ? 'checked' : ''}>
                <span class="font-heading font-bold text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">${escapeHtml(pl.name)}</span>
                <div class="w-4 h-4 rounded-full border border-black/25 shrink-0" style="background-color: ${escapeHtml(pl.color)}"></div>
            `;
            row.querySelector('input').addEventListener('change', (e) => {
                toggleVideoInPlaylist(pl.id, e.target.checked);
            });
            list.appendChild(row);
        });
        toggleVideoPlaylistsModal(true);
    }

    function toggleVideoPlaylistsModal(show) {
        const modal = document.getElementById('video-playlists-modal');
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
        } else {
            modal.classList.remove('active');
            managingPlaylistsVideoId = null;
        }
    }

    async function toggleVideoInPlaylist(playlistId, checked) {
        if (!managingPlaylistsVideoId) return;
        const pl = playlists.find(p => p.id === playlistId);
        if (!pl) return;
        if (checked) {
            if (!pl.videos.includes(managingPlaylistsVideoId)) pl.videos.push(managingPlaylistsVideoId);
        } else {
            pl.videos = pl.videos.filter(id => id !== managingPlaylistsVideoId);
        }
        await syncAll();
        renderPlaylists();
        renderLibrary();
    }

    // ============================
    // BULK SELECTION & ACTIONS
    // ============================
    function syncFavoritesBtnUI() {
        const btn = document.getElementById('favorites-filter-btn');
        if (!btn) return;
        btn.classList.toggle('bg-orange', favoritesOnly);
        btn.classList.toggle('text-dark', true);
        btn.classList.toggle('bg-slate-200', !favoritesOnly);
        btn.classList.toggle('dark:bg-slate-700', !favoritesOnly);
        btn.classList.toggle('dark:text-white', !favoritesOnly);
        btn.setAttribute('aria-pressed', String(favoritesOnly));
        const icon = btn.querySelector('svg, i');
        if (icon) icon.classList.toggle('fill-current', favoritesOnly);
    }

    function toggleFavoritesFilter() {
        favoritesOnly = !favoritesOnly;
        if (favoritesOnly && activePlaylistId === null) {
            activePlaylistId = '__favorites__';
            renderPlaylists();
        } else if (!favoritesOnly && activePlaylistId === '__favorites__') {
            activePlaylistId = null;
            renderPlaylists();
        }
        syncFavoritesBtnUI();
        renderLibrary();
    }

    function setViewMode(mode) {
        currentView = mode;
        localStorage.setItem('youtube_view_mode', mode);
        const grid = document.getElementById('video-grid');
        const gridBtn = document.getElementById('view-grid-btn');
        const listBtn = document.getElementById('view-list-btn');
        if (!grid || !gridBtn || !listBtn) return;

        const isList = mode === 'list';
        grid.classList.toggle('list-view', isList);

        listBtn.classList.toggle('bg-blue', isList);
        listBtn.classList.toggle('text-white', isList);
        listBtn.classList.toggle('bg-white', !isList);
        listBtn.classList.toggle('dark:bg-slate-800', !isList);
        listBtn.classList.toggle('text-slate-600', !isList);
        listBtn.classList.toggle('dark:text-slate-400', !isList);

        gridBtn.classList.toggle('bg-blue', !isList);
        gridBtn.classList.toggle('text-white', !isList);
        gridBtn.classList.toggle('bg-white', isList);
        gridBtn.classList.toggle('dark:bg-slate-800', isList);
        gridBtn.classList.toggle('text-slate-600', isList);
        gridBtn.classList.toggle('dark:text-slate-400', isList);
    }

    function toggleBulkMode(forceState) {
        bulkMode = typeof forceState === 'boolean' ? forceState : !bulkMode;
        const bar = document.getElementById('bulk-actions-bar');
        const btn = document.getElementById('bulk-mode-btn');
        bar.classList.toggle('hidden', !bulkMode);
        bar.classList.toggle('flex', bulkMode);
        btn.classList.toggle('bg-blue', bulkMode);
        btn.classList.toggle('text-white', bulkMode);
        btn.classList.toggle('bg-slate-200', !bulkMode);
        btn.classList.toggle('dark:bg-slate-700', !bulkMode);
        if (!bulkMode) selectedVideos.clear();
        updateSelectedCount();
        renderLibrary();
    }

    function toggleVideoSelection(videoId) {
        if (selectedVideos.has(videoId)) selectedVideos.delete(videoId);
        else selectedVideos.add(videoId);
        updateSelectedCount();
        renderLibrary();
    }

    function selectAllVideos() {
        getFilteredLibrary().forEach(v => selectedVideos.add(v.id));
        updateSelectedCount();
        renderLibrary();
    }

    function clearSelection() {
        selectedVideos.clear();
        updateSelectedCount();
        renderLibrary();
    }

    function updateSelectedCount() {
        const el = document.getElementById('selected-count');
        if (el) el.textContent = selectedVideos.size;
    }

    async function moveSelectedCategory() {
        if (selectedVideos.size === 0) return;
        const catId = document.getElementById('bulk-move-cat-select').value;
        if (!catId) return;
        library.forEach(v => {
            if (selectedVideos.has(v.id)) v.category = catId;
        });
        await syncAll();
        renderLibrary();
        showToast(`Moved ${selectedVideos.size} video(s)`, 'success');
    }

    async function addSelectedToPlaylist() {
        if (selectedVideos.size === 0) return;
        const plId = document.getElementById('bulk-add-pl-select').value;
        const pl = playlists.find(p => p.id === plId);
        if (!pl) {
            showToast('Create or choose a playlist first', 'warning');
            return;
        }
        let added = 0;
        selectedVideos.forEach(vid => {
            if (!pl.videos.includes(vid)) {
                pl.videos.push(vid);
                added++;
            }
        });
        await syncAll();
        renderPlaylists();
        showToast(`Added ${added} video(s) to "${pl.name}"`, 'success');
    }

    async function deleteSelected() {
        if (selectedVideos.size === 0) return;
        const confirmed = await showConfirmModal(`Delete ${selectedVideos.size} selected video(s)?`, {
            title: 'Delete Videos?',
            confirmText: 'Delete',
            cancelText: 'Keep',
            icon: 'trash-2',
            iconColor: 'red'
        });
        if (!confirmed) return;

        const count = selectedVideos.size;
        library = library.filter(v => !selectedVideos.has(v.id));
        playlists.forEach(pl => { pl.videos = pl.videos.filter(vid => !selectedVideos.has(vid)); });
        selectedVideos.clear();
        updateSelectedCount();
        await syncAll();
        renderLibrary();
        renderPlaylists();
        showToast(`Deleted ${count} video(s)`, 'info');
    }

    // ============================
    // CATEGORY MANAGEMENT MODAL
    // ============================
    function toggleCategoryModal(show) {
        const modal = document.getElementById('category-modal');
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
            renderCategoryList();
        } else {
            modal.classList.remove('active');
        }
    }

    function renderCategoryList() {
        const list = document.getElementById('category-list');
        if (!list) return;
        list.innerHTML = '';

        categories.forEach(cat => {
            const isDefault = cat.id === 'uncategorized';
            const item = document.createElement('div');
            item.className = 'flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-[#1e293b]/25 dark:border-slate-600';
            item.innerHTML = `
                <input type="color" value="${escapeHtml(cat.color)}" class="w-8 h-8 rounded-lg border-2 border-[#1e293b] cursor-pointer shrink-0" ${isDefault ? 'disabled' : ''}>
                <input type="text" value="${escapeHtml(cat.name)}" class="flex-1 min-w-0 bg-transparent border-none outline-none font-heading font-bold text-sm ${isDefault ? 'text-slate-400' : 'text-dark dark:text-slate-200'}" ${isDefault ? 'disabled' : ''}>
                ${!isDefault ? `<button type="button" class="action-btn btn-delete" title="Delete Category" aria-label="Delete category"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : '<span class="text-[10px] font-heading font-bold text-slate-400 uppercase px-2">Default</span>'}
            `;
            if (!isDefault) {
                const [colorInp, nameInp, delBtn] = item.children;
                colorInp.addEventListener('change', (e) => {
                    cat.color = e.target.value;
                    saveCategories();
                    renderLibrary();
                });
                nameInp.addEventListener('change', (e) => {
                    const next = e.target.value.trim();
                    if (next) {
                        cat.name = next;
                        saveCategories();
                        populateCategoryDropdowns();
                        renderLibrary();
                    }
                });
                delBtn.addEventListener('click', () => deleteCategory(cat.id));
            }
            list.appendChild(item);
        });
        hydrateIcons(list);
    }

    async function addCategory() {
        const nameInp = document.getElementById('new-category-name');
        const colorInp = document.getElementById('new-category-color');
        const name = nameInp.value.trim();
        if (!name) {
            await showAlertModal('Please enter a category name.', { title: 'Missing Name', icon: 'alert-circle', iconColor: 'orange' });
            return;
        }
        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            showToast('Category already exists', 'warning');
            return;
        }
        const id = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat') + '-' + Date.now();
        categories.push({ id, name, color: colorInp.value });
        saveCategories();
        renderCategoryList();
        populateCategoryDropdowns();
        nameInp.value = '';
    }

    async function deleteCategory(catId) {
        if (catId === 'uncategorized') return;
        const count = library.filter(v => v.category === catId).length;
        if (count > 0) {
            const ok = await showConfirmModal(`${count} video(s) use this category and will move to Uncategorized. Continue?`, {
                title: 'Move Videos?',
                confirmText: 'Move & Delete',
                cancelText: 'Cancel',
                icon: 'alert-triangle',
                iconColor: 'orange'
            });
            if (!ok) return;
            library.forEach(v => { if (v.category === catId) v.category = 'uncategorized'; });
            await syncAll();
        }
        categories = categories.filter(c => c.id !== catId);
        saveCategories();
        renderCategoryList();
        populateCategoryDropdowns();
        renderLibrary();
    }

    // ============================
    // VIEWS & PLAYER ENGINE
    // ============================
    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        if (viewName === 'library') {
            stopSeekPoller();
            pendingPlayId = null;
            toggleListeningCurtain(false);
            hideCuePauseBanner();
            if (player && typeof player.stopVideo === 'function') {
                try { player.stopVideo(); } catch (e) {}
            }
            const playerView = document.getElementById('view-player');
            const theaterBtn = document.getElementById('theater-btn');
            if (playerView) playerView.classList.remove('theater-mode');
            if (theaterBtn) {
                theaterBtn.classList.remove('bg-blue', 'text-white');
                theaterBtn.classList.add('bg-white', 'dark:bg-slate-800');
            }
        }
    }

    function switchPlayerTab(tabId) {
        activePlayerTab = tabId;
        const qPane = document.getElementById('player-pane-queue');
        const cPane = document.getElementById('player-pane-cues');
        if (qPane) {
            qPane.classList.toggle('hidden', tabId !== 'queue');
            qPane.classList.toggle('flex', tabId === 'queue');
        }
        if (cPane) {
            cPane.classList.toggle('hidden', tabId !== 'cues');
            cPane.classList.toggle('flex', tabId === 'cues');
        }
        document.querySelectorAll('[data-player-tab]').forEach(btn => {
            const active = btn.dataset.playerTab === tabId;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
        });
    }

    window.onYouTubeIframeAPIReady = function () {
        apiReady = true;
        if (pendingPlayId) {
            const nextId = pendingPlayId;
            pendingPlayId = null;
            playVideo(nextId);
        }
    };

    function playRandomVideo() {
        const pool = getFilteredLibrary();
        if (!pool.length) {
            showToast('No videos available in current filter', 'warning');
            return;
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        playVideo(pick.id);
    }

    function playActivePlaylist({ shuffle = false } = {}) {
        if (!activePlaylistId || activePlaylistId === '__favorites__') return;
        const pl = playlists.find(p => p.id === activePlaylistId);
        if (!pl || pl.videos.length === 0) {
            showToast('This playlist has no videos yet', 'warning');
            return;
        }
        let queue = pl.videos.map(id => library.find(v => v.id === id)).filter(Boolean);
        if (!queue.length) return;
        if (shuffle) {
            queue = queue.slice();
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
        }
        currentQueue = queue;
        currentQueueIndex = 0;
        isPlayingFromPlaylist = true;
        playVideo(currentQueue[0].id, { keepQueue: true });
    }

    function playVideo(id, { keepQueue = false } = {}) {
        const video = library.find(v => v.id === id);
        if (!video) return;

        // Build / synchronize queue cleanly without destroying order
        if (keepQueue && currentQueue.length > 0) {
            const idx = currentQueue.findIndex(v => v.id === id);
            if (idx !== -1) currentQueueIndex = idx;
        } else if (activePlaylistId && activePlaylistId !== '__favorites__') {
            const pl = playlists.find(p => p.id === activePlaylistId);
            if (pl && pl.videos.includes(id)) {
                currentQueue = pl.videos.map(vid => library.find(v => v.id === vid)).filter(Boolean);
                currentQueueIndex = currentQueue.findIndex(v => v.id === id);
                isPlayingFromPlaylist = true;
            } else {
                currentQueue = getFilteredLibrary();
                currentQueueIndex = currentQueue.findIndex(v => v.id === id);
                isPlayingFromPlaylist = false;
            }
        } else {
            isPlayingFromPlaylist = false;
            currentQueue = getFilteredLibrary();
            currentQueueIndex = currentQueue.findIndex(v => v.id === id);
            if (currentQueueIndex === -1) {
                currentQueue = [video];
                currentQueueIndex = 0;
            }
        }

        currentVideoId = video.id;
        loopA = null;
        loopB = null;
        prevPollTime = video.startTime || 0;
        lastTriggeredCueId = null;
        hideCuePauseBanner();
        updateABUI();

        // Update UI metadata immediately
        document.getElementById('current-title').textContent = video.title;
        document.getElementById('player-video-title').textContent = video.title;
        document.getElementById('curtain-title').textContent = video.title;
        const cat = categories.find(c => c.id === video.category) || categories[0];
        const catBadge = document.getElementById('player-video-category');
        catBadge.textContent = cat.name;
        catBadge.style.backgroundColor = cat.color;
        document.getElementById('player-video-date').textContent = `Added ${new Date(video.added).toLocaleDateString()}`;
        document.getElementById('player-queue-pos').textContent = `${Math.max(1, currentQueueIndex + 1)} / ${Math.max(1, currentQueue.length)}`;
        document.getElementById('video-notes-input').value = video.notes || '';

        updatePlayerFavBtn(video.favorite);
        updatePlayerNavButtons();
        updatePlayPauseBtn(false);
        updateLoopBtn();
        updateSpeedBtns();
        updateAutoPauseBtnUI();
        renderBookmarks();
        renderRecommendations();

        document.getElementById('volSlider').value = playerVolume;
        document.getElementById('seekBar').value = 0;
        document.getElementById('curTime').textContent = formatTime(video.startTime || 0);
        document.getElementById('durTime').textContent = '0:00';
        document.getElementById('curtain-time').textContent = `${formatTime(video.startTime || 0)} / 0:00`;

        switchView('player');

        const loadingEl = document.getElementById('player-loading-overlay');
        if (!apiReady || typeof window.YT === 'undefined' || !window.YT.Player) {
            pendingPlayId = id;
            loadingEl.classList.remove('hidden');
            loadingEl.classList.add('flex');
            return;
        }
        loadingEl.classList.add('hidden');
        loadingEl.classList.remove('flex');

        // Record watch count
        video.playCount = (video.playCount || 0) + 1;
        video.lastPlayed = new Date().toISOString();
        scheduleSync(1500);

        const startSec = Math.max(0, Math.floor(video.startTime || 0));
        if (!player) {
            const pConfig = {
                height: '100%',
                width: '100%',
                host: 'https://www.youtube-nocookie.com',
                videoId: id,
                playerVars: {
                    playsinline: 1,
                    autoplay: 1,
                    modestbranding: 1,
                    rel: 0,
                    start: startSec
                },
                events: {
                    onReady(e) {
                                                const iframe = typeof e.target.getIframe === 'function' ? e.target.getIframe() : null;
                        if (iframe) iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                        e.target.setVolume(playerVolume);
                        if (playerMuted) e.target.mute();
                        if (typeof e.target.setPlaybackRate === 'function') {
                            e.target.setPlaybackRate(currentSpeed);
                        }
                    },
                    onStateChange: onPlayerStateChange,
onError(e) {
                        const code = e && e.data ? ` (Error ${e.data})` : '';
                        console.warn('YouTube Player error:', e && e.data);
                        showToast(`Video cannot be embedded${code} — try Copy Link`, 'warning');
                }
            };
            if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                pConfig.playerVars.origin = window.location.origin;
            }
            player = new window.YT.Player('player', pConfig);
                        const iframe = typeof player.getIframe === 'function' ? player.getIframe() : null;
            if (iframe) iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        } else {
            player.loadVideoById({ videoId: id, startSeconds: startSec });
        }

        startSeekPoller();
    }

    function playVideoFromQueue(idx) {
        if (idx >= 0 && idx < currentQueue.length) {
            currentQueueIndex = idx;
            playVideo(currentQueue[currentQueueIndex].id, { keepQueue: true });
        }
    }

    function playPrevVideo() {
        if (currentQueueIndex > 0) {
            currentQueueIndex--;
            playVideo(currentQueue[currentQueueIndex].id, { keepQueue: true });
        }
    }

    function playNextVideo() {
        if (currentQueueIndex < currentQueue.length - 1) {
            currentQueueIndex++;
            playVideo(currentQueue[currentQueueIndex].id, { keepQueue: true });
        }
    }

    function onPlayerStateChange(event) {
        if (!window.YT || !window.YT.PlayerState) return;
        const st = event.data;
        if (st === window.YT.PlayerState.PLAYING) {
            updatePlayPauseBtn(true);
            hideCuePauseBanner();
            if (player && typeof player.setPlaybackRate === 'function') {
                try { player.setPlaybackRate(currentSpeed); } catch (e) {}
            }
        } else if (st === window.YT.PlayerState.PAUSED) {
            updatePlayPauseBtn(false);
        } else if (st === window.YT.PlayerState.ENDED) {
            updatePlayPauseBtn(false);
            if (playerLoop && player) {
                player.seekTo(loopA !== null ? loopA : 0, true);
                player.playVideo();
            } else if (autoplayNext && currentQueueIndex < currentQueue.length - 1) {
                playNextVideo();
            }
        }
    }

    function updatePlayPauseBtn(playing) {
        const iconName = playing ? 'pause' : 'play';
        const btn = document.getElementById('player-play-btn');
        if (btn) {
            btn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
            hydrateIcons(btn);
        }
        const curtainBtn = document.getElementById('curtain-play-btn');
        if (curtainBtn) {
            curtainBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i> ${playing ? 'Pause' : 'Play'}`;
            hydrateIcons(curtainBtn);
        }
    }

    function togglePlayPause() {
        if (!player || typeof player.getPlayerState !== 'function') return;
        const st = player.getPlayerState();
        if (window.YT && st === window.YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }

    function seekVideo(val) {
        if (!player || typeof player.getDuration !== 'function') return;
        const dur = player.getDuration();
        if (!dur) return;
        const target = dur * (Number(val) / 1000);
        lastTriggeredCueId = null;
        prevPollTime = target;
        player.seekTo(target, true);
    }

    function seekRelative(deltaSec) {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const cur = player.getCurrentTime() || 0;
        const dur = player.getDuration() || cur + Math.max(0, deltaSec);
        const next = Math.max(0, Math.min(dur, cur + deltaSec));
        if (deltaSec < 0) lastTriggeredCueId = null;
        prevPollTime = next;
        player.seekTo(next, true);
        hideCuePauseBanner();
    }

    let lastRenderedDur = 0;
    function startSeekPoller() {
        stopSeekPoller();
        lastRenderedDur = 0;
        seekPoller = setInterval(() => {
            if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') return;
            try {
                const cur = player.getCurrentTime() || 0;
                const dur = player.getDuration() || 0;
                const isPlaying = window.YT && typeof player.getPlayerState === 'function' && player.getPlayerState() === window.YT.PlayerState.PLAYING;

                if (dur > 0) {
                    if (Math.abs(dur - lastRenderedDur) > 1) {
                        lastRenderedDur = dur;
                        renderBookmarks();
                    }
                    const seekBar = document.getElementById('seekBar');
                    if (seekBar && document.activeElement !== seekBar) {
                        seekBar.value = Math.round((cur / dur) * 1000);
                    }
                    const fmtCur = formatTime(cur);
                    const fmtDur = formatTime(dur);
                    document.getElementById('curTime').textContent = fmtCur;
                    document.getElementById('durTime').textContent = fmtDur;
                    document.getElementById('curtain-time').textContent = `${fmtCur} / ${fmtDur}`;
                    document.getElementById('bookmark-cur-time').textContent = fmtCur;
                    updateABRangeVisual(dur);
                }

                // Enforce A-B Segment Loop
                if (isPlaying && loopA !== null && loopB !== null && cur >= loopB) {
                    lastTriggeredCueId = null;
                    prevPollTime = loopA;
                    player.seekTo(loopA, true);
                    return;
                }

                // Enforce Auto-Pause at Timestamp Cues
                if (isPlaying && autoPauseCues && currentVideoId) {
                    const video = library.find(v => v.id === currentVideoId);
                    if (video && Array.isArray(video.bookmarks) && video.bookmarks.length > 0) {
                        const hitCue = video.bookmarks.find(bm =>
                            bm.id !== lastTriggeredCueId &&
                            cur >= bm.time &&
                            cur - bm.time <= 1.2 &&
                            prevPollTime <= bm.time + 0.35
                        );
                        if (hitCue) {
                            lastTriggeredCueId = hitCue.id;
                            player.pauseVideo();
                            showCuePauseBanner(hitCue);
                        }
                    }
                }
                prevPollTime = cur;
            } catch (e) {}
        }, 200);
    }

    function stopSeekPoller() {
        if (seekPoller) {
            clearInterval(seekPoller);
            seekPoller = null;
        }
    }

    function setPlayerVolume(val) {
        playerVolume = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
        localStorage.setItem('youtube_volume', String(playerVolume));
        if (player && typeof player.setVolume === 'function') player.setVolume(playerVolume);
        if (playerVolume > 0 && playerMuted) {
            playerMuted = false;
            if (player && typeof player.unMute === 'function') player.unMute();
            updateMuteBtn();
        }
    }

    function togglePlayerMute() {
        playerMuted = !playerMuted;
        if (player) {
            if (playerMuted && typeof player.mute === 'function') player.mute();
            else if (!playerMuted && typeof player.unMute === 'function') {
                player.unMute();
                player.setVolume(playerVolume);
            }
        }
        updateMuteBtn();
    }

    function updateMuteBtn() {
        const btn = document.getElementById('player-mute-btn');
        if (!btn) return;
        btn.innerHTML = `<i data-lucide="${playerMuted ? 'volume-x' : 'volume-2'}" class="w-4 h-4"></i>`;
        hydrateIcons(btn);
    }

    function setPlayerSpeed(rate) {
        currentSpeed = Number(rate) || 1;
        localStorage.setItem('youtube_speed', String(currentSpeed));
        if (player && typeof player.setPlaybackRate === 'function') {
            try { player.setPlaybackRate(currentSpeed); } catch (e) {}
        }
        updateSpeedBtns();
    }

    function updateSpeedBtns() {
        document.querySelectorAll('[data-speed]').forEach(btn => {
            const val = parseFloat(btn.dataset.speed);
            btn.classList.toggle('active', Math.abs(val - currentSpeed) < 0.01);
        });
    }

    function togglePlayerLoop() {
        playerLoop = !playerLoop;
        updateLoopBtn();
        showToast(playerLoop ? 'Video loop ON' : 'Video loop OFF', 'info');
    }

    function updateLoopBtn() {
        const btn = document.getElementById('player-loop-btn');
        if (!btn) return;
        btn.classList.toggle('bg-blue', playerLoop);
        btn.classList.toggle('text-white', playerLoop);
        btn.classList.toggle('bg-white', !playerLoop);
        btn.classList.toggle('dark:bg-slate-800', !playerLoop);
    }

    function toggleAutoplayNext() {
        autoplayNext = !autoplayNext;
        localStorage.setItem('youtube_autoplay_next', autoplayNext ? 'true' : 'false');
        updateAutoplayNextBtn();
        showToast(autoplayNext ? 'Autoplay Next ON' : 'Autoplay Next OFF', 'info');
    }

    function updateAutoplayNextBtn() {
        const btn = document.getElementById('player-autoplay-btn');
        if (!btn) return;
        btn.classList.toggle('bg-green', autoplayNext);
        btn.classList.toggle('text-dark', true);
        btn.classList.toggle('bg-white', !autoplayNext);
        btn.classList.toggle('dark:bg-slate-800', !autoplayNext);
        btn.classList.toggle('dark:text-white', !autoplayNext);
    }

    function updatePlayerFavBtn(isFavorite) {
        const btn = document.getElementById('player-fav-btn');
        if (!btn) return;
        btn.classList.toggle('bg-amber-400', Boolean(isFavorite));
        btn.classList.toggle('text-dark', Boolean(isFavorite));
        btn.classList.toggle('bg-white', !isFavorite);
        btn.classList.toggle('dark:bg-slate-800', !isFavorite);
        btn.classList.toggle('text-amber-500', !isFavorite);
        btn.innerHTML = `<i data-lucide="star" class="w-4 h-4 ${isFavorite ? 'fill-current' : ''}"></i>`;
        hydrateIcons(btn);
    }

    function togglePlayerFavorite() {
        if (!currentVideoId) return;
        toggleFavorite(currentVideoId);
    }

    function updatePlayerNavButtons() {
        const prevBtn = document.getElementById('player-prev-btn');
        const nextBtn = document.getElementById('player-next-btn');
        const canPrev = currentQueueIndex > 0;
        const canNext = currentQueueIndex >= 0 && currentQueueIndex < currentQueue.length - 1;
        if (prevBtn) prevBtn.disabled = !canPrev;
        if (nextBtn) nextBtn.disabled = !canNext;
    }

    function toggleTheaterMode() {
        const view = document.getElementById('view-player');
        const btn = document.getElementById('theater-btn');
        if (!view || !btn) return;
        const isTheater = view.classList.toggle('theater-mode');
        btn.classList.toggle('bg-blue', isTheater);
        btn.classList.toggle('text-white', isTheater);
        btn.classList.toggle('bg-white', !isTheater);
        btn.classList.toggle('dark:bg-slate-800', !isTheater);
    }

    function togglePlayerFullscreen() {
        const wrap = document.getElementById('playerWrap');
        if (!wrap) return;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
            const view = document.getElementById('view-player');
            const theaterBtn = document.getElementById('theater-btn');
            if (view && view.classList.contains('theater-mode')) {
                view.classList.remove('theater-mode');
                theaterBtn?.classList.remove('bg-blue', 'text-white');
                theaterBtn?.classList.add('bg-white', 'dark:bg-slate-800');
            }
            if (wrap.requestFullscreen) wrap.requestFullscreen();
            else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        }
    }

    // ============================
    // A-B LOOP & BLIND LISTENING & CUES
    // ============================
    function setLoopPointA() {
        const t = player && typeof player.getCurrentTime === 'function' ? Math.max(0, player.getCurrentTime()) : 0;
        loopA = t;
        if (loopB !== null && loopB <= loopA + 0.5) loopB = null;
        updateABUI();
        showToast(`Loop Start A: ${formatTime(loopA)}`, 'info');
    }

    function setLoopPointB() {
        const t = player && typeof player.getCurrentTime === 'function' ? Math.max(0, player.getCurrentTime()) : 0;
        if (loopA === null) loopA = 0;
        if (t <= loopA + 0.5) {
            showToast('Loop End B must be after Start A', 'warning');
            return;
        }
        loopB = t;
        updateABUI();
        showToast(`Looping ${formatTime(loopA)} - ${formatTime(loopB)}`, 'success');
    }

    function clearABLoop() {
        loopA = null;
        loopB = null;
        updateABUI();
    }

    function updateABRangeVisual(dur) {
        const bar = document.getElementById('ab-range-highlight');
        if (!bar) return;
        if (loopA !== null && loopB !== null && dur > 0) {
            const leftPct = Math.max(0, Math.min(100, (loopA / dur) * 100));
            const widthPct = Math.max(0.5, Math.min(100 - leftPct, ((loopB - loopA) / dur) * 100));
            bar.style.left = `${leftPct}%`;
            bar.style.width = `${widthPct}%`;
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }

    function updateABUI() {
        const aBtn = document.getElementById('ab-set-a-btn');
        const bBtn = document.getElementById('ab-set-b-btn');
        const clearBtn = document.getElementById('ab-clear-btn');
        if (aBtn) {
            aBtn.classList.toggle('bg-orange', loopA !== null);
            aBtn.classList.toggle('text-dark', true);
            aBtn.classList.toggle('bg-white', loopA === null);
            aBtn.classList.toggle('dark:bg-slate-800', loopA === null);
            aBtn.classList.toggle('dark:text-white', loopA === null);
            aBtn.textContent = loopA !== null ? `A ${formatTime(loopA)}` : 'A';
        }
        if (bBtn) {
            bBtn.classList.toggle('bg-pink', loopB !== null);
            bBtn.classList.toggle('text-white', loopB !== null);
            bBtn.classList.toggle('bg-white', loopB === null);
            bBtn.classList.toggle('dark:bg-slate-800', loopB === null);
            bBtn.textContent = loopB !== null ? `B ${formatTime(loopB)}` : 'B';
        }
        if (clearBtn) {
            const active = loopA !== null || loopB !== null;
            clearBtn.classList.toggle('hidden', !active);
            clearBtn.classList.toggle('inline-flex', active);
        }
        const dur = player && typeof player.getDuration === 'function' ? player.getDuration() : 0;
        updateABRangeVisual(dur);
    }

    function toggleListeningCurtain(forceState) {
        curtainOpen = typeof forceState === 'boolean' ? forceState : !curtainOpen;
        const curtain = document.getElementById('listening-curtain');
        const btn = document.getElementById('player-curtain-btn');
        if (curtain) {
            curtain.classList.toggle('hidden', !curtainOpen);
            curtain.classList.toggle('flex', curtainOpen);
        }
        if (btn) {
            btn.classList.toggle('bg-blue', curtainOpen);
            btn.classList.toggle('text-white', curtainOpen);
            btn.classList.toggle('bg-white', !curtainOpen);
            btn.classList.toggle('dark:bg-slate-800', !curtainOpen);
        }
    }

    function showCuePauseBanner(cue) {
        const banner = document.getElementById('cue-pause-banner');
        if (!banner || !cue) return;
        document.getElementById('cue-banner-time').textContent = formatTime(cue.time);
        document.getElementById('cue-banner-text').textContent = cue.label;
        banner.classList.remove('hidden');
        banner.classList.add('flex');
    }

    function hideCuePauseBanner() {
        const banner = document.getElementById('cue-pause-banner');
        if (!banner) return;
        banner.classList.add('hidden');
        banner.classList.remove('flex');
    }

    function updateAutoPauseBtnUI() {
        const btn = document.getElementById('autopause-cues-btn');
        const label = document.getElementById('autopause-state-label');
        if (!btn || !label) return;
        btn.setAttribute('aria-pressed', String(autoPauseCues));
        btn.classList.toggle('border-orange', autoPauseCues);
        btn.classList.toggle('bg-orange/15', autoPauseCues);
        label.textContent = autoPauseCues ? 'ON' : 'OFF';
        label.classList.toggle('text-orange', autoPauseCues);
        label.classList.toggle('text-slate-400', !autoPauseCues);
    }

    function renderBookmarks() {
        const list = document.getElementById('bookmarks-list');
        const markers = document.getElementById('seek-bookmark-markers');
        const pill = document.getElementById('cues-count-pill');
        const video = library.find(v => v.id === currentVideoId);
        const bookmarks = video && Array.isArray(video.bookmarks) ? video.bookmarks : [];

        if (pill) pill.textContent = String(bookmarks.length);

        if (markers) {
            const dur = player && typeof player.getDuration === 'function' ? player.getDuration() : 0;
            markers.innerHTML = '';
            if (dur > 0) {
                bookmarks.forEach(bm => {
                    const pct = Math.max(0, Math.min(100, (bm.time / dur) * 100));
                    const dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = 'seek-bm-dot';
                    dot.style.left = `${pct}%`;
                    dot.title = `${formatTime(bm.time)} — ${bm.label}`;
                    dot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        jumpToBookmark(bm);
                    });
                    markers.appendChild(dot);
                });
            }
        }

        if (!list) return;
        if (bookmarks.length === 0) {
            list.innerHTML = `<p class="text-[11px] font-bold text-slate-400 text-center py-3">No timestamp cues yet. Mark important teaching moments above!</p>`;
            return;
        }

        list.innerHTML = '';
        bookmarks.forEach(bm => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 p-2 rounded-xl border-2 border-[#1e293b]/20 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue transition-colors';
            row.innerHTML = `
                <button type="button" data-bm-jump class="px-2 py-1 rounded-lg bg-pink/15 text-pink border border-pink/40 font-mono text-[11px] font-bold shrink-0 hover:bg-pink hover:text-white transition-colors">${escapeHtml(formatTime(bm.time))}</button>
                <button type="button" data-bm-jump class="flex-1 min-w-0 text-left text-xs font-bold text-dark dark:text-white truncate">${escapeHtml(bm.label)}</button>
                <button type="button" data-bm-del class="p-1 text-slate-400 hover:text-pink transition-colors shrink-0" title="Remove cue" aria-label="Remove cue">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            `;
            row.querySelectorAll('[data-bm-jump]').forEach(b => b.addEventListener('click', () => jumpToBookmark(bm)));
            row.querySelector('[data-bm-del]').addEventListener('click', () => {
                if (!video) return;
                video.bookmarks = video.bookmarks.filter(x => x.id !== bm.id);
                renderBookmarks();
                updateLibraryStats();
                scheduleSync();
            });
            list.appendChild(row);
        });
        hydrateIcons(list);
    }

    function jumpToBookmark(bm) {
        if (!player || typeof player.seekTo !== 'function') return;
        lastTriggeredCueId = bm.id;
        prevPollTime = bm.time;
        hideCuePauseBanner();
        player.seekTo(bm.time, true);
        if (typeof player.playVideo === 'function') player.playVideo();
    }

    function addBookmarkAtCurrentTime() {
        const video = library.find(v => v.id === currentVideoId);
        if (!video) return;
        const sec = player && typeof player.getCurrentTime === 'function' ? Math.max(0, Math.floor(player.getCurrentTime())) : (video.startTime || 0);
        const noteInp = document.getElementById('bookmark-note-input');
        const label = noteInp.value.trim() || `Cue at ${formatTime(sec)}`;
        video.bookmarks.push({
            id: 'bm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            time: sec,
            label
        });
        video.bookmarks.sort((a, b) => a.time - b.time);
        noteInp.value = '';
        renderBookmarks();
        updateLibraryStats();
        scheduleSync();
        showToast(`Marked ${formatTime(sec)}`, 'success');
    }

    function renderRecommendations() {
        const list = document.getElementById('recommendations-list');
        const titleEl = document.getElementById('recommendations-title');
        const countEl = document.getElementById('recommendations-count');
        if (!list) return;
        list.innerHTML = '';

        const curVideo = currentQueue[currentQueueIndex];
        if (!curVideo) return;

        let items = [];
        let isQueueMode = false;

        if (currentQueue.length > 1) {
            isQueueMode = true;
            titleEl.innerHTML = '<i data-lucide="list-video" class="w-4 h-4 text-orange"></i><span>Playing Queue</span>';
            currentQueue.forEach((v, idx) => items.push({ video: v, index: idx }));
            countEl.textContent = String(items.length);
        } else if (isPlayingFromPlaylist) {
            titleEl.innerHTML = '<i data-lucide="list-video" class="w-4 h-4 text-orange"></i><span>Playlist</span>';
            countEl.textContent = '1';
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center p-6 text-center opacity-70">
                    <i data-lucide="check-circle" class="w-7 h-7 text-green mb-2"></i>
                    <p class="text-xs font-bold">Single video in playlist</p>
                </div>
            `;
            hydrateIcons(list);
            return;
        } else {
            isQueueMode = false;
            titleEl.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4 text-orange"></i><span>Suggested Next</span>';
            let recs = library.filter(v => v.id !== curVideo.id && v.category === curVideo.category);
            if (recs.length < 6) {
                recs = recs.concat(library.filter(v => v.id !== curVideo.id && v.category !== curVideo.category));
            }
            items = recs.slice(0, 12).map(v => ({ video: v, index: -1 }));
            countEl.textContent = String(items.length);
        }
        hydrateIcons(titleEl);

        if (items.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center p-6 text-center opacity-65">
                    <i data-lucide="video-off" class="w-7 h-7 text-slate-400 mb-2"></i>
                    <p class="text-xs font-bold">No other videos in library</p>
                </div>
            `;
            hydrateIcons(list);
            return;
        }

        items.forEach(entry => {
            const v = entry.video;
            const isCurrent = isQueueMode && entry.index === currentQueueIndex;
            const cat = categories.find(c => c.id === v.category) || categories[0];
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `w-full text-left flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all cursor-pointer ${
                isCurrent
                    ? 'border-blue bg-blue/10 shadow-hard-sm'
                    : 'border-[#1e293b]/25 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue'
            }`;
            card.innerHTML = `
                <img class="w-20 aspect-video rounded-lg object-cover border border-black/25 shrink-0 bg-slate-900" src="https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/mqdefault.jpg" alt="${escapeHtml(v.title)}" loading="lazy" />
                <div class="flex-1 min-w-0">
                    <h4 class="font-heading text-xs font-bold truncate ${isCurrent ? 'text-blue' : 'text-dark dark:text-white'}">${escapeHtml(v.title)}</h4>
                    <span class="category-badge text-[9px] px-1.5 py-0.5 mt-1 inline-block" style="background-color: ${escapeHtml(cat.color)}">${escapeHtml(cat.name)}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                if (isQueueMode) {
                    playVideoFromQueue(entry.index);
                } else {
                    currentQueue = [];
                    playVideo(v.id);
                }
            });
            list.appendChild(card);
        });
    }

    // ============================
    // INIT & EVENT WIRING
    // ============================
    async function init() {
        try {
            if (typeof window.requireAuth === 'function') {
                await window.requireAuth();
            }
            updateSyncStatus('Synced', 'cloud');

            const rawLib = (typeof window.loadProgress === 'function' ? await window.loadProgress(TOOL_KEY) : null) || [];
            library = (Array.isArray(rawLib) ? rawLib : []).map(normalizeVideo).filter(Boolean);

            const savedCats = typeof window.loadProgress === 'function' ? await window.loadProgress(CATEGORIES_KEY) : null;
            if (Array.isArray(savedCats) && savedCats.length > 0) {
                categories = savedCats.filter(c => c && c.id && c.name);
                if (!categories.some(c => c.id === 'uncategorized')) {
                    categories.unshift({ id: 'uncategorized', name: 'Uncategorized', color: '#94a3b8' });
                }
            }

            const rawPls = (typeof window.loadProgress === 'function' ? await window.loadProgress(PLAYLISTS_KEY) : null) || [];
            playlists = (Array.isArray(rawPls) ? rawPls : []).map(normalizePlaylist).filter(Boolean);

            const sortSel = document.getElementById('sort-select');
            if (sortSel) sortSel.value = currentSort;
            setViewMode(currentView);

            populateCategoryDropdowns();
            renderPlaylists();
            renderLibrary();
            updateAutoplayNextBtn();
            hydrateIcons(document);
        } catch (err) {
            console.error('Init Error:', err);
            updateSyncStatus('Offline', 'cloud-off');
        }
    }

    function bindEvents() {
        // Inject YouTube IFrame API dynamically in browser
        if (typeof document !== 'undefined' && document.getElementsByTagName('script')[0]) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = () => {
                apiReady = false;
                showToast('Could not load YouTube API — check connection', 'warning');
            };
            const first = document.getElementsByTagName('script')[0];
            first.parentNode.insertBefore(tag, first);
        }

        // Theme, Export, Shortcuts
        document.getElementById('theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme_youtube', isDark ? 'dark' : 'light');
            localStorage.setItem('klasskit-theme', isDark ? 'dark' : 'light');
        });
        document.getElementById('export-backup-btn').addEventListener('click', exportLibraryBackup);
        document.getElementById('shortcuts-btn').addEventListener('click', () => document.getElementById('shortcuts-modal').classList.add('active'));
        document.getElementById('shortcuts-modal-close').addEventListener('click', () => document.getElementById('shortcuts-modal').classList.remove('active'));

        // Library Toolbar & Sidebar
        document.getElementById('add-video-btn').addEventListener('click', () => toggleAddModal(true));
        document.getElementById('new-playlist-btn').addEventListener('click', () => togglePlaylistModal(true));
        document.getElementById('mobile-playlists-btn').addEventListener('click', () => togglePlaylistsSidebar(true));
        document.getElementById('sidebar-backdrop').addEventListener('click', () => togglePlaylistsSidebar(false));

        document.getElementById('search-input').addEventListener('input', (e) => {
            searchQuery = e.target.value;
            document.getElementById('clear-search-btn').classList.toggle('hidden', !searchQuery);
            renderLibrary();
        });
        document.getElementById('clear-search-btn').addEventListener('click', () => {
            const inp = document.getElementById('search-input');
            inp.value = '';
            inp.focus();
            searchQuery = '';
            document.getElementById('clear-search-btn').classList.add('hidden');
            renderLibrary();
        });
        document.getElementById('category-filter').addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderLibrary();
        });
        document.getElementById('favorites-filter-btn').addEventListener('click', toggleFavoritesFilter);
        document.getElementById('manage-categories-btn').addEventListener('click', () => toggleCategoryModal(true));
        document.getElementById('sort-select').addEventListener('change', (e) => {
            currentSort = e.target.value;
            localStorage.setItem('youtube_sort', currentSort);
            renderLibrary();
        });
        document.getElementById('view-grid-btn').addEventListener('click', () => setViewMode('grid'));
        document.getElementById('view-list-btn').addEventListener('click', () => setViewMode('list'));
        document.getElementById('bulk-mode-btn').addEventListener('click', () => toggleBulkMode());
        document.getElementById('random-video-btn').addEventListener('click', playRandomVideo);

        // Bulk Actions Bar
        document.getElementById('bulk-select-all-btn').addEventListener('click', selectAllVideos);
        document.getElementById('bulk-clear-btn').addEventListener('click', clearSelection);
        document.getElementById('bulk-move-cat-btn').addEventListener('click', moveSelectedCategory);
        document.getElementById('bulk-add-pl-btn').addEventListener('click', addSelectedToPlaylist);
        document.getElementById('bulk-delete-btn').addEventListener('click', deleteSelected);

        // Active Playlist Banner
        document.getElementById('playlist-play-all-btn').addEventListener('click', () => playActivePlaylist({ shuffle: false }));
        document.getElementById('playlist-shuffle-btn').addEventListener('click', () => playActivePlaylist({ shuffle: true }));

        // Bulk Import Modal
        const ytBulkModal = window.KlassKitBulkImport ? window.KlassKitBulkImport.create({
            id: 'yt-bulk-import-overlay',
            title: 'Bulk Import YouTube Videos',
            subtitle: 'Paste multiple YouTube links or IDs (one per line)',
            accentColor: 'pink',
            unitLabel: 'video',
            unitLabelPlural: 'videos',
            confirmText: 'Import Videos',
            guideItems: [
                { label: 'URL Only', syntax: 'https://youtu.be/dQw4w9WgXcQ', color: 'pink', desc: 'Auto-extracts video ID and ?t= start time.' },
                { label: 'With Title & Cat', syntax: 'URL | Lesson Intro | Grammar', color: 'blue', desc: 'Optional custom title and category separated by |.' }
            ],
            placeholder: 'https://youtu.be/VIDEO_ID_1 | Past Simple Song | Grammar\nhttps://www.youtube.com/watch?v=VIDEO_ID_2 | Phonics Chant | Listening',
            template: 'https://youtu.be/dQw4w9WgXcQ?t=15 | Sample Video | Listening',
            options: [
                { id: 'addToActivePlaylist', label: 'Add imported videos to active playlist (if selected)', defaultChecked: true }
            ],
            parse(rawText) {
                const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
                const items = [];
                const badges = [];
                const warnings = [];
                const seenIds = new Set(library.map(v => v.id));

                lines.forEach((line, idx) => {
                    if (line.startsWith('#') || line.startsWith('//')) return;
                    const parts = line.split('|').map(s => s.trim());
                    const { id, startTime } = extractVideoInfo(parts[0]);
                    if (!id) {
                        warnings.push(`Line ${idx + 1}: invalid YouTube URL or ID`);
                        return;
                    }
                    if (seenIds.has(id)) {
                        warnings.push(`Line ${idx + 1}: "${id}" already in library (skipped)`);
                        return;
                    }
                    seenIds.add(id);
                    const title = parts[1] || `Untitled Video (${id})`;
                    const categoryName = parts[2] || '';
                    items.push({ id, title, categoryName, startTime });
                    badges.push({
                        tag: startTime > 0 ? formatTime(startTime) : `#${items.length}`,
                        label: categoryName ? `${title} (${categoryName})` : title,
                        tone: 'pink'
                    });
                });
                return { items, warnings, badges };
            },
            async onImport(result, opts) {
                const entries = result.items || [];
                if (!entries.length) return false;
                const activePl = (opts && opts.addToActivePlaylist && activePlaylistId && activePlaylistId !== '__favorites__')
                    ? playlists.find(p => p.id === activePlaylistId)
                    : null;

                for (const entry of entries) {
                    const cat = getOrCreateCategory(entry.categoryName);
                    const v = normalizeVideo({
                        id: entry.id,
                        title: entry.title,
                        category: cat.id,
                        startTime: entry.startTime,
                        added: new Date().toISOString()
                    });
                    library.unshift(v);
                    if (activePl && !activePl.videos.includes(v.id)) {
                        activePl.videos.push(v.id);
                    }
                }

                await syncAll();
                renderLibrary();
                renderPlaylists();
                showToast(`Imported ${entries.length} video(s)!`, 'success');
                return true;
            }
        }) : null;
        document.getElementById('bulk-import-btn').addEventListener('click', () => ytBulkModal?.open());

        // Player View Controls
        document.getElementById('back-to-library-btn').addEventListener('click', () => switchView('library'));
        document.getElementById('player-copy-link-btn').addEventListener('click', async () => {
            if (!currentVideoId) return;
            const cur = player && typeof player.getCurrentTime === 'function' ? Math.floor(player.getCurrentTime()) : 0;
            const url = cur > 5 ? `https://youtu.be/${currentVideoId}?t=${cur}` : `https://youtu.be/${currentVideoId}`;
            try {
                await navigator.clipboard.writeText(url);
                showToast(cur > 5 ? `Copied link at ${formatTime(cur)}` : 'Copied YouTube link', 'success');
            } catch (e) {
                showToast(url, 'info');
            }
        });
        document.getElementById('player-edit-video-btn').addEventListener('click', () => {
            if (currentVideoId) openEditModal(currentVideoId);
        });

        document.getElementById('seekBar').addEventListener('input', (e) => seekVideo(e.target.value));
        document.getElementById('volSlider').addEventListener('input', (e) => setPlayerVolume(e.target.value));
        document.getElementById('player-prev-btn').addEventListener('click', playPrevVideo);
        document.getElementById('player-back5-btn').addEventListener('click', () => seekRelative(-5));
        document.getElementById('player-play-btn').addEventListener('click', togglePlayPause);
        document.getElementById('player-fwd5-btn').addEventListener('click', () => seekRelative(5));
        document.getElementById('player-next-btn').addEventListener('click', playNextVideo);
        document.getElementById('player-mute-btn').addEventListener('click', togglePlayerMute);
        document.querySelectorAll('[data-speed]').forEach(btn => {
            btn.addEventListener('click', () => setPlayerSpeed(parseFloat(btn.dataset.speed)));
        });

        document.getElementById('ab-set-a-btn').addEventListener('click', setLoopPointA);
        document.getElementById('ab-set-b-btn').addEventListener('click', setLoopPointB);
        document.getElementById('ab-clear-btn').addEventListener('click', clearABLoop);
        document.getElementById('player-curtain-btn').addEventListener('click', () => toggleListeningCurtain());
        document.getElementById('curtain-play-btn').addEventListener('click', togglePlayPause);
        document.getElementById('curtain-back5-btn').addEventListener('click', () => seekRelative(-5));
        document.getElementById('curtain-reveal-btn').addEventListener('click', () => toggleListeningCurtain(false));

        document.getElementById('cue-replay5-btn').addEventListener('click', () => {
            seekRelative(-5);
            if (player && typeof player.playVideo === 'function') player.playVideo();
        });
        document.getElementById('cue-continue-btn').addEventListener('click', () => {
            hideCuePauseBanner();
            if (player && typeof player.playVideo === 'function') player.playVideo();
        });

        document.getElementById('player-loop-btn').addEventListener('click', togglePlayerLoop);
        document.getElementById('player-autoplay-btn').addEventListener('click', toggleAutoplayNext);
        document.getElementById('player-fav-btn').addEventListener('click', togglePlayerFavorite);
        document.getElementById('theater-btn').addEventListener('click', toggleTheaterMode);
        document.getElementById('fullscreen-btn').addEventListener('click', togglePlayerFullscreen);

        // Right-panel Tabs, Cues, & Notes
        document.querySelectorAll('[data-player-tab]').forEach(btn => {
            btn.addEventListener('click', () => switchPlayerTab(btn.dataset.playerTab));
        });
        document.getElementById('add-bookmark-btn').addEventListener('click', addBookmarkAtCurrentTime);
        document.getElementById('bookmark-note-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addBookmarkAtCurrentTime();
            }
        });
        document.getElementById('autopause-cues-btn').addEventListener('click', () => {
            autoPauseCues = !autoPauseCues;
            localStorage.setItem('youtube_autopause_cues', String(autoPauseCues));
            updateAutoPauseBtnUI();
            showToast(autoPauseCues ? 'Auto-Pause at Cues ON' : 'Auto-Pause at Cues OFF', 'info');
        });
        document.getElementById('video-notes-input').addEventListener('input', (e) => {
            const video = library.find(v => v.id === currentVideoId);
            if (!video) return;
            video.notes = e.target.value;
            scheduleSync(650);
        });

        // Add Video Modal
        let urlPreviewTimer = null;
        document.getElementById('video-url').addEventListener('input', (e) => {
            clearTimeout(urlPreviewTimer);
            const val = e.target.value;
            urlPreviewTimer = setTimeout(() => refreshAddModalPreview(val), 220);
        });
        document.getElementById('video-url').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addVideo(); }
        });
        document.getElementById('add-modal-cancel').addEventListener('click', () => toggleAddModal(false));
        document.getElementById('add-modal-save').addEventListener('click', addVideo);

        // Category Modal
        document.getElementById('add-category-btn').addEventListener('click', addCategory);
        document.getElementById('new-category-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
        });
        document.getElementById('category-modal-done').addEventListener('click', () => toggleCategoryModal(false));

        // Edit Modal
        document.getElementById('edit-modal-cancel').addEventListener('click', () => toggleEditModal(false));
        document.getElementById('edit-modal-save').addEventListener('click', saveVideoEdit);
        document.getElementById('edit-video-title').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveVideoEdit(); }
        });

        // Playlist Modal
        document.getElementById('playlist-modal-cancel').addEventListener('click', () => togglePlaylistModal(false));
        document.getElementById('playlist-modal-save').addEventListener('click', savePlaylist);
        document.getElementById('playlist-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); savePlaylist(); }
        });
        document.querySelectorAll('[data-pl-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('playlist-color').value = btn.dataset.plColor;
            });
        });

        // Video Playlists Modal
        document.getElementById('video-playlists-close').addEventListener('click', () => toggleVideoPlaylistsModal(false));

        // Backdrop Click Close on all .modal elements
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target !== modal) return;
                if (modal.id === 'add-modal') toggleAddModal(false);
                else if (modal.id === 'category-modal') toggleCategoryModal(false);
                else if (modal.id === 'edit-modal') toggleEditModal(false);
                else if (modal.id === 'playlist-modal') togglePlaylistModal(false);
                else if (modal.id === 'video-playlists-modal') toggleVideoPlaylistsModal(false);
                else modal.classList.remove('active');
            });
        });

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const openStaticModal = document.querySelector('.modal.active');
            const bulkOverlay = document.getElementById('yt-bulk-import-overlay');
            const universalModal = document.getElementById('universalInputModal');
            const isBulkOpen = bulkOverlay && !bulkOverlay.classList.contains('hidden');
            const isUniversalOpen = universalModal && !universalModal.classList.contains('hidden');

            if (isUniversalOpen || isBulkOpen) return;

            if (e.key === 'Escape') {
                if (openStaticModal) {
                    e.preventDefault();
                    if (openStaticModal.id === 'add-modal') toggleAddModal(false);
                    else if (openStaticModal.id === 'category-modal') toggleCategoryModal(false);
                    else if (openStaticModal.id === 'edit-modal') toggleEditModal(false);
                    else if (openStaticModal.id === 'playlist-modal') togglePlaylistModal(false);
                    else if (openStaticModal.id === 'video-playlists-modal') toggleVideoPlaylistsModal(false);
                    else openStaticModal.classList.remove('active');
                    return;
                }
                if (curtainOpen) {
                    e.preventDefault();
                    toggleListeningCurtain(false);
                    return;
                }
            }

            if (openStaticModal) return;

            const tag = (document.activeElement?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                if (e.key === 'Escape' && document.activeElement?.id === 'search-input') {
                    document.getElementById('search-input').value = '';
                    searchQuery = '';
                    document.getElementById('clear-search-btn').classList.add('hidden');
                    renderLibrary();
                    document.activeElement.blur();
                }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key === '?') {
                e.preventDefault();
                document.getElementById('shortcuts-modal').classList.add('active');
                return;
            }

            const playerView = document.getElementById('view-player');
            const isPlayerActive = playerView && playerView.classList.contains('active');

            if (!isPlayerActive) {
                if (e.key === '/') {
                    e.preventDefault();
                    document.getElementById('search-input')?.focus();
                }
                return;
            }

            const lower = e.key.toLowerCase();
            if (e.code === 'Space' || lower === 'k') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.key === 'ArrowLeft' || lower === 'j') {
                e.preventDefault();
                seekRelative(-5);
            } else if (e.key === 'ArrowRight' || lower === 'l') {
                e.preventDefault();
                seekRelative(5);
            } else if (lower === 'm') {
                togglePlayerMute();
            } else if (lower === 'r') {
                togglePlayerLoop();
            } else if (lower === 'h') {
                toggleListeningCurtain();
            } else if (lower === 't') {
                toggleTheaterMode();
            } else if (lower === 'f') {
                togglePlayerFullscreen();
            } else if (e.key === '[') {
                setLoopPointA();
            } else if (e.key === ']') {
                setLoopPointB();
            } else if (lower === 'b') {
                addBookmarkAtCurrentTime();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindEvents();
        init();
    });

    // Expose safe test/debug hooks for static Node checks
    window.__ytDebug = {
        extractVideoInfo,
        parseTimeToken,
        formatTime,
        escapeHtml,
        playNextVideo,
        playPrevVideo,
        selectPlaylist,
        toggleFavoritesFilter,
        getFilteredLibrary,
        setLibraryState(lib, pls = []) {
            library = lib;
            playlists = pls;
        },
        getFilterState() {
            return { activePlaylistId, favoritesOnly };
        },
        setQueueState(queue, idx) {
            currentQueue = queue;
            currentQueueIndex = idx;
        },
        getQueueState() {
            return { currentQueue, currentQueueIndex };
        }
    };
})();

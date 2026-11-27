// KlassKit Admin — State, RPC Helpers & Catalog Initialization

let allProfiles = {} // Incremental cache for display names/emails across views & modals
let allAnnouncements = []
let dashboardSummary = null
let allGamesCatalog = []
let catalogLoaded = false
let healthyTablesCount = 0
let totalQueriedTables = 21

let scheduleClassTab = 'admin'
let currentDataTab = 'progress'
let userRoleFilter = 'all'
let notesStatusFilter = 'all'
let tasksStatusFilter = 'all'
let studioTypeFilter = 'all'
let auditSourceFilter = 'all'
let lastViewModalCopyText = ''
let charts = {}
let chartDaysWindow = 14
let topToolsMode = 'week' // 'week' | 'all'
let toolsChartMetric = 'saves' // 'saves' | 'users'
let pendingDelete = null
let currentView = 'dashboard'

let reqSeq = {
    dashboard: 0,
    users: 0,
    cloud: 0,
    data: 0,
    logs: 0,
    announcements: 0,
    exclusions: 0
}

let sortConfig = {
    users: { col: 'active', dir: 'desc' },
    progress: { col: 'updated_at', dir: 'desc' },
    notes: { col: 'updated_at', dir: 'desc' },
    cloud: { col: 'usage', dir: 'desc' },
    schedule: { col: 'date', dir: 'desc' },
    classes: { col: 'class_name', dir: 'asc' },
    classesUnits: { col: 'class_name', dir: 'asc' },
    tasks: { col: 'created_at', dir: 'desc' },
    myclass: { col: 'updated_at', dir: 'desc' },
    studio: { col: 'updated_at', dir: 'desc' }
}

let pagination = {
    users: 1,
    progress: 1,
    notes: 1,
    cloud: 1,
    logs: 1,
    schedule: 1,
    classes: 1,
    classesUnits: 1,
    tasks: 1,
    myclass: 1,
    studio: 1,
    lastFilteredCounts: {}
}
const PAGE_SIZE = 25
const LOGS_PAGE_SIZE = 50
let settingsTimeout = null
let searchTimeout = null
let _missingRpcWarned = false

const adminRpcCapabilities = {
    dashboardTz: true,
    auditSourceFilter: true,
    userDetailTz: true
}
let _lastRenderedSummaryRef = null
let _chartsThemeDirty = false
let _catalogLoadPromise = null

// ── CANONICAL TOOL KEY MAPPING ──
const RAW_TOOL_TO_CATALOG_ID = {
    // Games
    'magic_cups': 'findball',
    'findball': 'findball',
    'connect_n': 'tictactoe',
    'tictactoe': 'tictactoe',
    'spell_word': 'spellit',
    'spellit': 'spellit',
    'secret_code': 'secret-code',
    'secret-code': 'secret-code',
    'stop_the_bus': 'stopthebus',
    'stopthebus': 'stopthebus',
    'card-match': 'cardmatch',
    'cardmatch': 'cardmatch',
    'card-memory': 'cardmemory',
    'cardmemory': 'cardmemory',
    'undercover': 'undercover',
    'quiz_maker': 'quiz',
    'quiz': 'quiz',
    'hangman': 'hangman',
    'word-animator': 'wordanimator',
    'wordanimator': 'wordanimator',
    'sentence_unscrambler': 'sentence-unscrambler',
    'sentence-unscrambler': 'sentence-unscrambler',
    'guess_who': 'guesswho',
    'guesswho': 'guesswho',
    'crossword': 'crossword',
    'word_sort': 'word-sort',
    'word-sort': 'word-sort',
    'unscramble': 'unscramble',
    'this_or_that': 'this-or-that',
    'this-or-that': 'this-or-that',
    'quiz_block': 'quizblock',
    'quizblock': 'quizblock',
    'freeze_dance': 'freezedance',
    'freezedance': 'freezedance',
    'role_speak': 'role-and-speak',
    'role-and-speak': 'role-and-speak',
    'story_dice': 'storydice',
    'storydice': 'storydice',
    'memory_block': 'simon-memory',
    'simon-memory': 'simon-memory',
    'fill_it': 'fillit',
    'fillit': 'fillit',
    'story_ordering': 'story-ordering',
    'story-ordering': 'story-ordering',
    'connect_four': 'connect-four',
    'connect-four': 'connect-four',
    'emoji_game': 'guessemoji',
    'guessemoji': 'guessemoji',
    'flashcard_displayer_library_v2': 'fc-play',
    'flashcard_displayer_session': 'fc-play',
    'fc-play': 'fc-play',
    'fix_em': 'fixem',
    'fixem': 'fixem',
    'word_flashcard': 'word-flashcard',
    'word-flashcard': 'word-flashcard',
    'hot_seat': 'hotseat',
    'hotseat': 'hotseat',
    'word_rush': 'word-rush',
    'word-rush': 'word-rush',
    'word_search': 'wordsearch',
    'wordsearch': 'wordsearch',
    'reveal_picture': 'reveal-picture-game',
    'reveal-picture-game': 'reveal-picture-game',
    'mystery_tiles': 'mystery-tiles',
    'mystery-tiles': 'mystery-tiles',
    'dnd-hub': 'dnd-hub',
    'tools_dnd': 'dnd-hub',
    'vtt_maps': 'dnd-hub',
    'vtt_campaigns': 'dnd-hub',

    // Tools
    'spreadsheet': 'spreadsheet',
    'spreadsheets': 'spreadsheet',
    'tracer_settings': 'tracer-whiteboard',
    'tracer-whiteboard': 'tracer-whiteboard',
    'act_lesson_plan': 'actbank',
    'act_custom_workspace': 'actbank',
    'actbank': 'actbank',
    'bingo_presets_data': 'bingomaker',
    'bingomaker': 'bingomaker',
    'card_maker_state': 'card-maker',
    'card_maker_sets': 'card-maker',
    'tools_cardmaker': 'card-maker',
    'card-maker': 'card-maker',
    'domino-maker': 'domino-maker',
    'domino-maker-workspace': 'domino-maker',
    'class_tally': 'classtally',
    'class_tally_sets': 'classtally',
    'classtally': 'classtally',
    'clock_data': 'clockcalendar',
    'clockcalendar': 'clockcalendar',
    'myspace_clock': 'clockcalendar',
    'down_time_screen_data': 'downtimescreen',
    'downtimescreen': 'downtimescreen',
    'media-player': 'media-player',
    'puzzle-maker': 'puzzle-maker',
    'tools_puzzlemaker': 'puzzle-maker',
    'lesson-note': 'lessonnotes',
    'lessonnotes': 'lessonnotes',
    'notes': 'lessonnotes',
    'poster_studio_data': 'poster-studio',
    'poster-studio': 'poster-studio',
    'scorecounter_data': 'scoreboard',
    'scoreboard': 'scoreboard',
    'word_scrambler_data': 'scrambler',
    'scrambler': 'scrambler',
    'presentation_data': 'presentations',
    'presentations': 'presentations',
    'dictionary_data': 'smart-dictionary',
    'smart-dictionary': 'smart-dictionary',
    'speedy_slides_data': 'speedyslides',
    'speedyslides': 'speedyslides',
    'elimgrid_library_v2': 'spinwheel',
    'elimgrid_session_state': 'spinwheel',
    'weighted_odds_library_v2': 'spinwheel',
    'weighted_odds_session_state': 'spinwheel',
    'multispin_library_v2': 'spinwheel',
    'multispin_session_state': 'spinwheel',
    'class_spinner_library_v2': 'spinwheel',
    'class_spinner_session_state': 'spinwheel',
    'cardpicker_library_v2': 'spinwheel',
    'spinwheel': 'spinwheel',
    'task_assigner_presets': 'taskassigner',
    'taskassigner': 'taskassigner',
    'team_picker_data': 'teampicker',
    'teampicker': 'teampicker',
    'whiteboard_canvas_data': 'whiteboard',
    'whiteboard_settings': 'whiteboard',
    'whiteboard': 'whiteboard',
    'randomizer_words_data': 'wordlist',
    'wordlist': 'wordlist',
    'worksheet-maker': 'worksheet-maker',
    'tools_worksheetmaker': 'worksheet-maker',
    'youtube-library': 'youtube',
    'youtube-categories': 'youtube',
    'youtube-playlists': 'youtube',
    'youtube': 'youtube',
    'word-snake': 'word-snake',
    'info-gap': 'info-gap',
    'running-dictation': 'running-dictation',
    'interview-maker': 'interview-maker',
    'path-board': 'path-board',
    'chutes-ladders': 'chutes-ladders',
    'tracing-maker': 'tracing-maker',
    'dice-maker': 'dice-maker',
    'maze-maker': 'maze-maker',
    'labyrinth-quest': 'labyrinth-quest',

    // Workshop
    'workshop_analyzer': 'text-workshop',
    'workshop_formatter': 'text-workshop',
    'workshop_case': 'text-workshop',
    'text-workshop': 'text-workshop',
    'workshop_splitter': 'image-workshop',
    'workshop_editor': 'image-workshop',
    'image-workshop': 'image-workshop',
    'pu-helper': 'pu-helper',
    'report-helper-state': 'report-helper',
    'report-helper-archive': 'report-helper',
    'report-helper': 'report-helper',
    'workshop_lessonparser': 'lesson-parser',
    'lesson-parser': 'lesson-parser',

    // My Space
    'myspace-home': 'myspace-home',
    'tasks': 'tasks',
    'myspace_tasks': 'tasks',
    'klasskit_tasks': 'tasks',
    'schedule': 'schedule',
    'myspace_events': 'schedule',
    'schedule_events': 'schedule',
    'my-class': 'my-class',
    'myspace_my_class': 'my-class',
    'admin-tracker': 'admin-tracker',
    'myspace_class_admin': 'admin-tracker',
    'myspace_class_units': 'admin-tracker',
    'schedule_class_admin': 'admin-tracker',
    'schedule_class_units': 'admin-tracker',
    'admin_tracker_data': 'admin-tracker',

    // WIP
    'poster_data': 'poster',
    'poster': 'poster'
}

// ── THEME CONTROLS ──
function getLocalTzOffsetMin() {
    return new Date().getTimezoneOffset()
}

function syncAdminThemeUI() {
    const isDark = document.documentElement.classList.contains('dark')
    const btn = document.getElementById('theme-toggle')
    if (btn) btn.setAttribute('aria-pressed', String(isDark))

    const lightBtn = document.getElementById('setting-theme-light')
    const darkBtn = document.getElementById('setting-theme-dark')
    if (lightBtn) lightBtn.classList.toggle('active', !isDark)
    if (darkBtn) darkBtn.classList.toggle('active', isDark)
}

function setAdminTheme(mode) {
    const isDark = mode === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme_hub', JSON.stringify(isDark ? 'dark' : 'light'))
    syncAdminThemeUI()
    if (typeof refreshAdminChartsTheme === 'function') refreshAdminChartsTheme()
}

function toggleAdminTheme() {
    const isDark = !document.documentElement.classList.contains('dark')
    setAdminTheme(isDark ? 'dark' : 'light')
}

window.addEventListener('storage', (e) => {
    if (e.key === 'theme_hub' || e.key === 'klasskit_colorTheme') {
        if (window.KlassKitTheme && typeof window.KlassKitTheme.applyMode === 'function') {
            window.KlassKitTheme.applyMode()
            if (typeof window.KlassKitTheme.applyColorTheme === 'function') {
                window.KlassKitTheme.applyColorTheme()
            }
        } else {
            try {
                const t = JSON.parse(localStorage.getItem('theme_hub'))
                document.documentElement.classList.toggle('dark', t === 'dark')
            } catch (_) {}
        }
        syncAdminThemeUI()
        if (typeof refreshAdminChartsTheme === 'function') refreshAdminChartsTheme()
    }
})

// ── INIT ──
async function init() {
    loadGamesCatalog()
    const { user, profile } = await requireAdmin()
    const name = profile.display_name || user.email?.split('@')[0] || 'Admin'
    document.getElementById('adminName').textContent = name
    document.getElementById('adminAvatar').textContent = name[0].toUpperCase()
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
        overlay.style.opacity = '0'
        setTimeout(() => overlay.remove(), 400)
    }
    syncAdminThemeUI()
    lucide.createIcons()
    loadSettings({ fetchExclusions: false })
    await fetchData()
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js')
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.log('SW Reg error:', err));
    });
}

function getValidExcludedUserIds() {
    return getExcludedUserIds().filter(id => {
        if (typeof isValidUuid === 'function') return isValidUuid(id)
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    })
}

async function callAdminRpc(fnName, params = {}, { silent = false } = {}) {
    const { data, error } = await db.rpc(fnName, params)
    if (error) {
        if (!silent) console.error(`[AdminRPC] ${fnName} failed:`, error)
        const isMissing = error.code === '42883' || error.code === 'PGRST202' || String(error.message || '').includes('Could not find the function')
        if (!silent && isMissing && !_missingRpcWarned) {
            _missingRpcWarned = true
            showToast('Admin RPC missing — run supabase/sql/phase3_admin_rpcs.sql in SQL Editor', 'error')
        }
        return { data: null, error }
    }
    return { data, error: null }
}

function loadGamesCatalog() {
    if (catalogLoaded) return Promise.resolve()
    if (_catalogLoadPromise) return _catalogLoadPromise
    _catalogLoadPromise = (async () => {
        try {
            const gamesRes = await fetch('../games.json')
            if (!gamesRes.ok) throw new Error(`HTTP ${gamesRes.status}`)
            const gamesData = await gamesRes.json()
            allGamesCatalog = gamesData.games || []
            const catDisplayNames = {
                'myspace': 'My Space',
                'tool': 'Tools',
                'printable': 'Printables',
                'workshop': 'Workshop',
                'game': 'Games',
                'under-construction': 'Tools'
            }
            const toolCategoryMap = {}
            const toolTitleMap = {}
            const toolIconMap = {}
            allGamesCatalog.forEach(g => {
                const cat = g.id === 'lessonnotes' ? 'My Space' : (catDisplayNames[g.category] || 'Tools')
                toolCategoryMap[g.id] = cat
                toolTitleMap[g.id] = g.title
                toolIconMap[g.id] = g.icon || 'box'
            })
            window.toolCategoryMap = toolCategoryMap
            window.toolTitleMap = toolTitleMap
            window.toolIconMap = toolIconMap
            catalogLoaded = true
        } catch (e) {
            console.warn('[Admin] Failed to load games.json:', e)
            _catalogLoadPromise = null
        }
    })()
    return _catalogLoadPromise
}

async function loadDashboardSummary() {
    const seq = ++reqSeq.dashboard
    const excludedIds = getValidExcludedUserIds()
    const catalogPromise = loadGamesCatalog()

    const baseParams = {
        p_excluded_ids: excludedIds,
        p_days: chartDaysWindow || 14
    }
    let data = null
    let error = null

    if (adminRpcCapabilities.dashboardTz) {
        ;({ data, error } = await callAdminRpc('admin_dashboard_summary', {
            ...baseParams,
            p_tz_offset_min: getLocalTzOffsetMin()
        }, { silent: true }))

        if (error?.code === 'PGRST202') {
            adminRpcCapabilities.dashboardTz = false
            ;({ data, error } = await callAdminRpc('admin_dashboard_summary', baseParams))
        } else if (error) {
            console.error('[AdminRPC] admin_dashboard_summary failed:', error)
        }
    } else {
        ;({ data, error } = await callAdminRpc('admin_dashboard_summary', baseParams))
    }

    if (seq !== reqSeq.dashboard) return false
    if (error || !data) {
        healthyTablesCount = 0
        await catalogPromise
        updateStats({ force: true })
        return false
    }

    dashboardSummary = data
    totalQueriedTables = data.healthy_tables || 21
    healthyTablesCount = data.healthy_tables || 21

    if (Array.isArray(data.top_teachers)) {
        data.top_teachers.forEach(t => {
            if (t.user_id) {
                allProfiles[t.user_id] = {
                    ...(allProfiles[t.user_id] || {}),
                    id: t.user_id,
                    display_name: t.display_name,
                    role: t.role
                }
            }
        })
    }

    await catalogPromise
    updateStats()
    if (typeof populateToolFilter === 'function') {
        populateToolFilter(data.distinct_tool_keys || [])
    }
    return true
}

async function refreshCurrentView() {
    if (currentView === 'users' && typeof loadUsersView === 'function') {
        await loadUsersView()
    } else if (currentView === 'data-details' && typeof loadDataDetailsTab === 'function') {
        await loadDataDetailsTab(true)
    } else if (currentView === 'cloud' && typeof renderCloudTable === 'function') {
        await renderCloudTable()
    } else if (currentView === 'logs' && typeof renderLogsTable === 'function') {
        await renderLogsTable()
    } else if (currentView === 'announcements' && typeof loadAnnouncements === 'function') {
        await loadAnnouncements()
    } else if (currentView === 'settings' && typeof renderExcludedUserPicker === 'function') {
        await renderExcludedUserPicker()
    }
}

// ── FETCH ──
async function fetchData() {
    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.add('animate-spin'))
    try {
        loadGamesCatalog()
        const ok = await loadDashboardSummary()
        await refreshCurrentView()

        const lastRefreshed = document.getElementById('lastRefreshed')
        if (lastRefreshed) lastRefreshed.textContent = 'Updated ' + new Date().toLocaleTimeString()
        if (ok) showToast('Data refreshed')
    } finally {
        document.querySelectorAll('.refreshIcon').forEach(i => i.classList.remove('animate-spin'))
    }
}

// ── TIMESTAMP & TOOL RESOLUTION HELPERS ──
function parseTimestampMs(raw) {
    if (raw === undefined || raw === null || raw === '') return 0
    if (raw instanceof Date) return isNaN(raw.getTime()) ? 0 : raw.getTime()
    const num = Number(raw)
    if (!isNaN(num) && num > 0) {
        const ms = num < 1e11 ? num * 1000 : num
        return ms
    }
    const parsed = new Date(raw).getTime()
    return isNaN(parsed) ? 0 : parsed
}

function formatRelativeTime(tsMs) {
    if (!tsMs || tsMs <= 0) return '—'
    const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000))
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(tsMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function resolveCanonicalToolId(rawKey) {
    if (!rawKey) return 'unknown'
    if (RAW_TOOL_TO_CATALOG_ID[rawKey]) return RAW_TOOL_TO_CATALOG_ID[rawKey]
    const normalized = rawKey.toLowerCase().replace(/_/g, '-')
    if (RAW_TOOL_TO_CATALOG_ID[normalized]) return RAW_TOOL_TO_CATALOG_ID[normalized]
    if (window.toolCategoryMap && window.toolCategoryMap[rawKey]) return rawKey
    if (window.toolCategoryMap && window.toolCategoryMap[normalized]) return normalized
    return rawKey
}

// ── TOAST SYSTEM ──
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = `neo p-4 min-w-[240px] flex items-center gap-3 animate-slide-in pointer-events-auto bg-card border-2 ${type === 'success' ? 'border-green text-green' : 'border-pink text-pink'}`
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5 shrink-0"></i>
        <span class="text-sm font-bold text-ink">${escapeHtml(msg)}</span>
    `
    container.appendChild(toast)
    lucide.createIcons({ root: toast })
    setTimeout(() => {
        toast.classList.add('animate-slide-out')
        setTimeout(() => toast.remove(), 500)
    }, 3000)
}

// ── SEARCH DEBOUNCE ──
function debouncedSearch() {
    updateSearchClearBtn()
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
        if (typeof resetPagination === 'function') resetPagination()
        applyFilters()
    }, 300)
}

// ── STATS HELPERS ──
function getExcludedUserIds() {
    const saved = localStorage.getItem('kk_admin_settings')
    if (saved) {
        try {
            const settings = JSON.parse(saved)
            return (settings.excluded_ids || '').split(',').map(id => id.trim()).filter(id => id)
        } catch (e) {
            console.error('[Admin] Failed to parse excluded IDs:', e)
        }
    }
    return []
}

function getToolMeta(toolKey) {
    const canonicalId = resolveCanonicalToolId(toolKey)
    const toolMap = window.toolCategoryMap || {}
    const titleMap = window.toolTitleMap || {}
    const iconMap = window.toolIconMap || {}

    const displayName = titleMap[canonicalId] || canonicalId
        .replace(/_/g, '-')
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

    let cat = toolMap[canonicalId]
    if (!cat) {
        const k = canonicalId.toLowerCase()
        if (k.includes('game') || k.includes('quiz') || k === 'cardmatch' || k === 'cardmemory' || k === 'connect-four' || k === 'dnd-hub') cat = 'Games'
        else if (k.includes('note') || k.includes('schedule') || k.includes('admin') || k === 'my-class' || k === 'tasks') cat = 'My Space'
        else if (k.includes('workshop') || k.includes('parser') || k.includes('helper')) cat = 'Workshop'
        else cat = 'Tools'
    }

    const categories = {
        'My Space': { color: '#ff7e33', icon: 'layout-dashboard' },
        'Tools': { color: '#1ea7fd', icon: 'wrench' },
        'Workshop': { color: '#ff4785', icon: 'sparkles' },
        'Games': { color: '#00d063', icon: 'gamepad-2' }
    }

    return {
        id: canonicalId,
        name: displayName,
        category: cat,
        color: categories[cat]?.color || '#1ea7fd',
        icon: iconMap[canonicalId] || categories[cat]?.icon || 'box'
    }
}

const SET_COLLECTION_KEYS = ['sets', 'word_sets', 'wordSets', 'presets', 'collections', 'reports', 'activities', 'library', 'playlists']

function setChartDays(days) {
    chartDaysWindow = days
    ;[7, 14, 30, 90].forEach(d => {
        const btn = document.getElementById(`range-${d}`)
        if (btn) btn.classList.toggle('active', d === days)
    })
    loadDashboardSummary()
}

function setTopToolsMode(mode) {
    topToolsMode = mode
    const btnWeek = document.getElementById('topToolsBtnWeek')
    const btnAll = document.getElementById('topToolsBtnAll')
    if (btnWeek) btnWeek.classList.toggle('active', mode === 'week')
    if (btnAll) btnAll.classList.toggle('active', mode === 'all')
    if (typeof renderTopToolsCard === 'function' && dashboardSummary) {
        renderTopToolsCard(dashboardSummary)
    } else {
        updateStats({ force: true })
    }
}

function setToolsChartMetric(metric) {
    toolsChartMetric = metric
    const btnSaves = document.getElementById('toolsMetricSaves')
    const btnUsers = document.getElementById('toolsMetricUsers')
    if (btnSaves) btnSaves.classList.toggle('active', metric === 'saves')
    if (btnUsers) btnUsers.classList.toggle('active', metric === 'users')
    if (typeof renderToolsPerformanceSection === 'function' && dashboardSummary) {
        renderToolsPerformanceSection(dashboardSummary)
    } else {
        updateStats({ force: true })
    }
}

function countStudentsInClassRow(cls) {
    if (typeof cls.student_count === 'number') return cls.student_count
    if (Array.isArray(cls.students)) return cls.students.length
    return 0
}

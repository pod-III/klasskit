// KlassKit Admin — State, Data Fetching & Event Aggregation

let allProgress = []
let allNotes = []
let allMyClass = []
let allMySpaceTasks = []
let allProfiles = {}
let allAnnouncements = []
let allScheduleEvents = []
let allClassAdmin = []
let allClassUnits = []
let allRedDays = {}
let allNoteFolders = {}
let allSpreadsheets = []
let allLessonParser = []
let allCardMaker = []
let allPuzzleMaker = []
let allWorksheetMaker = []
let allToolsDnd = []
let allVttMaps = []
let allVttCampaigns = []
let allClockLogs = []
let allGamesCatalog = []
let healthyTablesCount = 0
let totalQueriedTables = 18

let scheduleClassTab = 'admin'
let currentDataTab = 'progress'
let userRoleFilter = 'all'
let notesStatusFilter = 'all'
let tasksStatusFilter = 'all'
let studioTypeFilter = 'all'
let lastViewModalCopyText = ''
let charts = {}
let chartDaysWindow = 14
let topToolsMode = 'week' // 'week' | 'all'
let toolsChartMetric = 'saves' // 'saves' | 'users'
let pendingDelete = null
let currentView = 'dashboard'
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
    schedule: 1,
    classes: 1,
    classesUnits: 1,
    tasks: 1,
    myclass: 1,
    studio: 1,
    lastFilteredCounts: {}
}
const PAGE_SIZE = 25
let settingsTimeout = null
let searchTimeout = null

// ── CANONICAL TOOL KEY MAPPING ──
// Maps raw user_progress tool_keys and dedicated table keys to official games.json IDs
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

// ── INIT ──
async function init() {
    const { user, profile } = await requireAdmin()
    const name = profile.display_name || user.email?.split('@')[0] || 'Admin'
    document.getElementById('adminName').textContent = name
    document.getElementById('adminAvatar').textContent = name[0].toUpperCase()
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
        overlay.style.opacity = '0'
        setTimeout(() => overlay.remove(), 400)
    }
    lucide.createIcons()
    loadSettings()
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

async function safeQuery(promise, tableName) {
    try {
        const res = await promise
        if (res.error) {
            console.warn(`[Admin] Query warning on ${tableName}:`, res.error.message)
            return { data: [], error: res.error, ok: false }
        }
        return { data: res.data || [], error: null, ok: true }
    } catch (err) {
        console.warn(`[Admin] Query exception on ${tableName}:`, err)
        return { data: [], error: err, ok: false }
    }
}

// ── FETCH ──
async function fetchData() {
    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.add('animate-spin'))

    // Fetch Games Registry first so tool metadata is ready
    try {
        const gamesRes = await fetch('../games.json')
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
            // Note: lessonnotes is categorized under My Space in teacher workflows or Tools in games.json;
            // keep official category mapping consistent
            const cat = g.id === 'lessonnotes' ? 'My Space' : (catDisplayNames[g.category] || 'Tools')
            toolCategoryMap[g.id] = cat
            toolTitleMap[g.id] = g.title
            toolIconMap[g.id] = g.icon || 'box'
        })
        window.toolCategoryMap = toolCategoryMap
        window.toolTitleMap = toolTitleMap
        window.toolIconMap = toolIconMap
    } catch (e) {
        console.warn('[Admin] Failed to load games.json:', e)
    }

    const queries = [
        safeQuery(db.from('user_progress').select('*').order('updated_at', { ascending: false }), 'user_progress'),
        safeQuery(db.from('notes').select('*').order('updated_at', { ascending: false }), 'notes'),
        safeQuery(db.from('profiles').select('*'), 'profiles'),
        safeQuery(db.from('storage_quotas').select('*'), 'storage_quotas'),
        safeQuery(db.from('myspace_events').select('id,user_id,name,type_id,color,date,recurrence,recurrence_days,graduation_class,is_master,created_at,updated_at').eq('is_master', true).order('date', { ascending: false }), 'myspace_events'),
        safeQuery(db.from('myspace_class_admin').select('*').order('created_at', { ascending: false }), 'myspace_class_admin'),
        safeQuery(db.from('myspace_class_units').select('*').order('created_at', { ascending: false }), 'myspace_class_units'),
        safeQuery(db.from('myspace_settings').select('*'), 'myspace_settings'),
        safeQuery(db.from('note_folders').select('*'), 'note_folders'),
        safeQuery(db.from('myspace_my_class').select('*').order('updated_at', { ascending: false }), 'myspace_my_class'),
        safeQuery(db.from('myspace_tasks').select('*').order('updated_at', { ascending: false }), 'myspace_tasks'),
        safeQuery(db.from('spreadsheets').select('id,user_id,title,rows_count,cols_count,updated_at,created_at').order('updated_at', { ascending: false }), 'spreadsheets'),
        safeQuery(db.from('workshop_lessonparser').select('id,user_id,name,unit_aims,modules,last_used,created_at,usage_count').order('last_used', { ascending: false }), 'workshop_lessonparser'),
        safeQuery(db.from('tools_cardmaker').select('id,user_id,name,usage_count,created_at,last_used').order('last_used', { ascending: false }), 'tools_cardmaker'),
        safeQuery(db.from('tools_puzzlemaker').select('id,user_id,name,usage_count,created_at,last_used').order('last_used', { ascending: false }), 'tools_puzzlemaker'),
        safeQuery(db.from('tools_worksheetmaker').select('id,user_id,name,usage_count,created_at,last_used').order('last_used', { ascending: false }), 'tools_worksheetmaker'),
        safeQuery(db.from('tools_dnd').select('id,user_id,tool_type,name,usage_count,created_at,last_used').order('last_used', { ascending: false }), 'tools_dnd'),
        safeQuery(db.from('vtt_maps').select('id,user_id,name,campaign_id,grid_cols,grid_rows,created_at,updated_at').order('updated_at', { ascending: false }), 'vtt_maps'),
        safeQuery(db.from('vtt_campaigns').select('id,user_id,name,created_at,updated_at').order('updated_at', { ascending: false }), 'vtt_campaigns'),
        safeQuery(db.from('myspace_clock').select('*').order('updated_at', { ascending: false }), 'myspace_clock'),
        safeQuery(db.from('announcements').select('*').order('created_at', { ascending: false }), 'announcements')
    ]

    const results = await Promise.all(queries)
    const [
        progressRes, notesRes, profilesRes, quotasRes, schedEventsRes,
        classAdminRes, classUnitsRes, redDaysRes, noteFoldersRes, myClassRes,
        tasksRes, spreadsheetsRes, lessonParserRes, cardMakerRes, puzzleMakerRes,
        worksheetMakerRes, toolsDndRes, vttMapsRes, vttCampaignsRes, clockRes, annRes
    ] = results

    totalQueriedTables = results.length
    healthyTablesCount = results.filter(r => r.ok).length

    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.remove('animate-spin'))
    const lastRefreshed = document.getElementById('lastRefreshed')
    if (lastRefreshed) lastRefreshed.textContent = 'Updated ' + new Date().toLocaleTimeString()

    const quotaMap = {}
    quotasRes.data.forEach(q => { quotaMap[q.user_id] = q })

    const DEFAULT_LIMIT = 50 * 1024 * 1024 // 50 MB standard quota
    allProfiles = {}
    profilesRes.data.forEach(p => {
        const quota = quotaMap[p.id] || {}
        allProfiles[p.id] = {
            ...p,
            storage_usage: Number(quota.storage_usage) || 0,
            storage_limit: Number(quota.storage_limit) || DEFAULT_LIMIT,
            last_active_ts: p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : 0),
            last_tool_used: null,
            last_tool_ts: 0,
            tools_set: new Set(),
            records_count: 0
        }
    })

    allProgress = progressRes.data
    allNotes = notesRes.data
    allMyClass = myClassRes.data
    allMySpaceTasks = tasksRes.data
    allScheduleEvents = schedEventsRes.data
    allClassAdmin = classAdminRes.data
    allClassUnits = classUnitsRes.data
    allSpreadsheets = spreadsheetsRes.data
    allLessonParser = lessonParserRes.data
    allCardMaker = cardMakerRes.data
    allPuzzleMaker = puzzleMakerRes.data
    allWorksheetMaker = worksheetMakerRes.data
    allToolsDnd = toolsDndRes.data
    allVttMaps = vttMapsRes.data
    allVttCampaigns = vttCampaignsRes.data
    allClockLogs = clockRes.data
    allAnnouncements = annRes.data

    allRedDays = {}
    redDaysRes.data.forEach(r => { allRedDays[r.user_id] = r.dates || [] })
    allNoteFolders = {}
    noteFoldersRes.data.forEach(f => { allNoteFolders[f.user_id] = f.folders || [] })

    // Ensure any user_id referenced in data tables has a profile entry and accurate last_active_ts + tools_set
    const registerUserActivity = (userId, tsMs, canonicalToolId, countIncrement = 1) => {
        if (!userId) return
        if (!allProfiles[userId]) {
            const quota = quotaMap[userId] || {}
            allProfiles[userId] = {
                id: userId,
                display_name: `User ${userId.slice(0, 6)}`,
                role: 'user',
                storage_usage: Number(quota.storage_usage) || 0,
                storage_limit: Number(quota.storage_limit) || DEFAULT_LIMIT,
                last_active_ts: 0,
                last_tool_used: null,
                last_tool_ts: 0,
                tools_set: new Set(),
                records_count: 0
            }
        }
        const prof = allProfiles[userId]
        const validTs = (tsMs && !isNaN(tsMs) && tsMs <= Date.now() + 86400000) ? tsMs : 0
        if (validTs > prof.last_active_ts) {
            prof.last_active_ts = validTs
        }
        if (canonicalToolId && canonicalToolId !== 'klasskit_hub' && canonicalToolId !== 'hub') {
            prof.tools_set.add(canonicalToolId)
            prof.records_count += countIncrement
            if (validTs > prof.last_tool_ts || (!prof.last_tool_used && validTs === 0)) {
                prof.last_tool_ts = Math.max(prof.last_tool_ts || 0, validTs)
                prof.last_tool_used = canonicalToolId
            }
        }
    }

    allProgress.forEach(r => {
        const ts = parseTimestampMs(r.updated_at || r.created_at)
        const isHub = r.tool_key === 'klasskit_hub' || r.tool_key === 'hub'
        const canonical = isHub ? null : resolveCanonicalToolId(r.tool_key)
        const entryCount = isHub ? 0 : extractLogEntries(r).length
        registerUserActivity(r.user_id, ts, canonical, entryCount)
    })
    allNotes.forEach(n => {
        if (!n.deleted) registerUserActivity(n.user_id, parseTimestampMs(n.updated_at), 'lessonnotes', 1)
    })
    allScheduleEvents.forEach(e => {
        registerUserActivity(e.user_id, parseTimestampMs(e.updated_at || e.created_at || e.date), 'schedule', 1)
    })
    allClassAdmin.forEach(c => {
        registerUserActivity(c.user_id, parseTimestampMs(c.created_at), 'admin-tracker', 1)
    })
    allClassUnits.forEach(u => {
        registerUserActivity(u.user_id, parseTimestampMs(u.created_at), 'admin-tracker', 1)
    })
    allMySpaceTasks.forEach(t => {
        registerUserActivity(t.user_id, parseTimestampMs(t.updated_at || t.created_at), 'tasks', 1)
    })
    allMyClass.forEach(c => {
        registerUserActivity(c.user_id, parseTimestampMs(c.updated_at), 'my-class', 1)
    })
    allSpreadsheets.forEach(s => {
        registerUserActivity(s.user_id, parseTimestampMs(s.updated_at || s.created_at), 'spreadsheet', 1)
    })
    allLessonParser.forEach(lp => {
        registerUserActivity(lp.user_id, parseTimestampMs(lp.last_used || lp.created_at), 'lesson-parser', 1)
    })
    allCardMaker.forEach(cm => {
        registerUserActivity(cm.user_id, parseTimestampMs(cm.last_used || cm.created_at), 'card-maker', 1)
    })
    allPuzzleMaker.forEach(pm => {
        registerUserActivity(pm.user_id, parseTimestampMs(pm.last_used || pm.created_at), 'puzzle-maker', 1)
    })
    allWorksheetMaker.forEach(wm => {
        registerUserActivity(wm.user_id, parseTimestampMs(wm.last_used || wm.created_at), 'worksheet-maker', 1)
    })
    allToolsDnd.forEach(d => {
        registerUserActivity(d.user_id, parseTimestampMs(d.last_used || d.created_at), 'dnd-hub', 1)
    })
    allVttMaps.forEach(m => {
        registerUserActivity(m.user_id || m.owner_id, parseTimestampMs(m.updated_at || m.created_at), 'dnd-hub', 1)
    })
    allVttCampaigns.forEach(c => {
        registerUserActivity(c.user_id || c.owner_id, parseTimestampMs(c.updated_at || c.created_at), 'dnd-hub', 1)
    })
    allClockLogs.forEach(cl => {
        registerUserActivity(cl.user_id, parseTimestampMs(cl.updated_at || cl.created_at || cl.date), 'clockcalendar', 1)
    })

    updateStats()
    populateToolFilter()
    applyFilters()
    renderAnnouncements()
    if (currentView === 'cloud') renderCloudTable()
    if (currentView === 'logs') renderLogsTable()
    renderExcludedUserPicker()
    showToast('Data refreshed')
}

// ── TIMESTAMP & TOOL RESOLUTION HELPERS ──
function parseTimestampMs(raw) {
    if (raw === undefined || raw === null || raw === '') return 0
    if (raw instanceof Date) return isNaN(raw.getTime()) ? 0 : raw.getTime()
    const num = Number(raw)
    if (!isNaN(num) && num > 0) {
        // Handle unix seconds vs unix milliseconds
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
    toast.className = `neo p-4 min-w-[240px] flex items-center gap-3 animate-slide-in pointer-events-auto bg-slate-800 border-2 ${type === 'success' ? 'border-green/40 text-green' : 'border-pink/40 text-pink'}`
    toast.style.boxShadow = '4px 4px 0 #000'
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i>
        <span class="text-sm font-bold">${escapeHtml(msg)}</span>
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

// ── STATS ──
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
        icon: iconMap[canonicalId] || categories[cat]?.icon || 'settings'
    }
}

// ── ACCURATE LOG ENTRY EXTRACTOR ──
// Extracts saved sets/collections/presets from user_progress rows without falsely inflating
// workspace arrays (like whiteboard strokes, word lists, or student arrays) into separate saves.
const SET_COLLECTION_KEYS = ['sets', 'word_sets', 'wordSets', 'presets', 'collections', 'reports', 'activities', 'library', 'playlists']

function extractLogEntries(row) {
    const entries = []
    const rowTsMs = parseTimestampMs(row.updated_at || row.created_at) || Date.now()
    const fallbackTs = new Date(rowTsMs)
    const data = row.data
    const canonicalTool = resolveCanonicalToolId(row.tool_key)

    let items = null
    if (Array.isArray(data)) {
        // Top-level array (e.g. youtube-library, spinwheel libraries, fc-play library)
        // Only treat elements as individual saved items if they are objects (not raw strings/numbers)
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
            items = data
        }
    } else if (data && typeof data === 'object') {
        // Look specifically for known saved-set collection keys
        for (const key of SET_COLLECTION_KEYS) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                items = data[key]
                break
            }
        }
    }

    if (items && items.length > 0) {
        let newestItemTsMs = 0
        for (const item of items) {
            if (!item || typeof item !== 'object') continue
            let rawTs = item.created_at ?? item.createdAt ?? item.updated_at ?? item.updatedAt
                ?? item.last_used ?? item.lastUsed ?? item.savedAt ?? item.timestamp ?? item.date ?? item.time
            // Some tools use Date.now() as item.id (13-digit epoch ms)
            if (rawTs === undefined && typeof item.id === 'number' && item.id >= 1600000000000 && item.id <= 2500000000000) {
                rawTs = item.id
            }
            const parsedMs = parseTimestampMs(rawTs)
            const finalMs = (parsedMs > 1577836800000 && parsedMs <= Date.now() + 86400000) ? parsedMs : rowTsMs
            if (finalMs > newestItemTsMs) newestItemTsMs = finalMs
            entries.push({
                user_id: row.user_id,
                tool_key: row.tool_key,
                canonical_tool: canonicalTool,
                timestamp: new Date(finalMs),
                action_type: 'Saved_Set',
                label: item.name || item.title || canonicalTool
            })
        }
    }

    // If no set objects were found, treat the progress row as 1 workspace save
    if (entries.length === 0) {
        let workspaceTsMs = rowTsMs
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const innerTs = parseTimestampMs(data.updatedAt ?? data.updated_at ?? data.lastUsed ?? data.timestamp)
            if (innerTs > 1577836800000 && innerTs <= Date.now() + 86400000) {
                workspaceTsMs = Math.max(rowTsMs, innerTs)
            }
        }
        entries.push({
            user_id: row.user_id,
            tool_key: row.tool_key,
            canonical_tool: canonicalTool,
            timestamp: new Date(workspaceTsMs),
            action_type: 'Workspace_Save',
            label: canonicalTool
        })
    }

    return entries
}

// Builds a unified chronological array of all platform events across all tables
function buildUnifiedEvents(excludedIds = []) {
    const events = []

    // 1. user_progress (excluding hub state)
    allProgress.forEach(r => {
        if (excludedIds.includes(r.user_id)) return
        if (r.tool_key === 'klasskit_hub' || r.tool_key === 'hub') return
        const extracted = extractLogEntries(r)
        extracted.forEach(e => events.push({ ...e, source: 'progress', refId: r.tool_key }))
    })

    // 2. Lesson Notes (active notes)
    allNotes.forEach(n => {
        if (excludedIds.includes(n.user_id) || n.deleted) return
        const tsMs = parseTimestampMs(n.updated_at)
        if (!tsMs) return
        events.push({
            user_id: n.user_id,
            tool_key: 'lesson-note',
            canonical_tool: 'lessonnotes',
            timestamp: new Date(tsMs),
            action_type: 'Lesson_Note',
            label: n.title || 'Untitled Note',
            source: 'note',
            refId: n.id
        })
    })

    // 3. Master Schedule Events
    allScheduleEvents.forEach(ev => {
        if (excludedIds.includes(ev.user_id)) return
        const tsMs = parseTimestampMs(ev.updated_at || ev.created_at || ev.date)
        if (!tsMs) return
        events.push({
            user_id: ev.user_id,
            tool_key: 'schedule',
            canonical_tool: 'schedule',
            timestamp: new Date(tsMs),
            action_type: 'Schedule_Event',
            label: ev.name || 'Schedule Event',
            source: 'schedule',
            refId: ev.id
        })
    })

    // 4. Admin Tracker Classes & Unit Syllabi
    allClassAdmin.forEach(cls => {
        if (excludedIds.includes(cls.user_id)) return
        const tsMs = parseTimestampMs(cls.created_at)
        if (!tsMs) return
        events.push({
            user_id: cls.user_id,
            tool_key: 'admin-tracker',
            canonical_tool: 'admin-tracker',
            timestamp: new Date(tsMs),
            action_type: 'Admin_Tracker',
            label: cls.class_name || 'Class Tracker',
            source: 'class_admin',
            refId: cls.id
        })
    })
    allClassUnits.forEach(cls => {
        if (excludedIds.includes(cls.user_id)) return
        const tsMs = parseTimestampMs(cls.created_at)
        if (!tsMs) return
        events.push({
            user_id: cls.user_id,
            tool_key: 'admin-tracker',
            canonical_tool: 'admin-tracker',
            timestamp: new Date(tsMs),
            action_type: 'Unit_Syllabus',
            label: cls.class_name || 'Unit Plan',
            source: 'class_units',
            refId: cls.id
        })
    })

    // 5. My Space Tasks
    allMySpaceTasks.forEach(t => {
        if (excludedIds.includes(t.user_id)) return
        const tsMs = parseTimestampMs(t.updated_at || t.created_at)
        if (!tsMs) return
        events.push({
            user_id: t.user_id,
            tool_key: 'tasks',
            canonical_tool: 'tasks',
            timestamp: new Date(tsMs),
            action_type: t.completed ? 'Task_Completed' : 'Task_Created',
            label: t.text || 'Task',
            source: 'task',
            refId: t.id
        })
    })

    // 6. My Class
    allMyClass.forEach(cls => {
        if (excludedIds.includes(cls.user_id)) return
        const tsMs = parseTimestampMs(cls.updated_at)
        if (!tsMs) return
        events.push({
            user_id: cls.user_id,
            tool_key: 'my-class',
            canonical_tool: 'my-class',
            timestamp: new Date(tsMs),
            action_type: 'My_Class_Sync',
            label: cls.class_name || 'Class Roster',
            source: 'myclass',
            refId: cls.id
        })
    })

    // 7. Spreadsheets (Class Sheet)
    allSpreadsheets.forEach(s => {
        if (excludedIds.includes(s.user_id)) return
        const tsMs = parseTimestampMs(s.updated_at || s.created_at)
        if (!tsMs) return
        events.push({
            user_id: s.user_id,
            tool_key: 'spreadsheet',
            canonical_tool: 'spreadsheet',
            timestamp: new Date(tsMs),
            action_type: 'Class_Sheet',
            label: s.title || 'Untitled Sheet',
            source: 'studio',
            refId: `spreadsheets:${s.id}`
        })
    })

    // 8. Lesson Parser (Workshop)
    allLessonParser.forEach(lp => {
        if (excludedIds.includes(lp.user_id)) return
        const tsMs = parseTimestampMs(lp.last_used || lp.created_at)
        if (!tsMs) return
        events.push({
            user_id: lp.user_id,
            tool_key: 'lesson-parser',
            canonical_tool: 'lesson-parser',
            timestamp: new Date(tsMs),
            action_type: 'Lesson_Parser',
            label: lp.name || 'Parsed Lesson',
            source: 'studio',
            refId: `workshop_lessonparser:${lp.id}`
        })
    })

    // 9. Maker Tables (Cards Maker, Puzzle Maker, Worksheet Maker)
    allCardMaker.forEach(cm => {
        if (excludedIds.includes(cm.user_id)) return
        const tsMs = parseTimestampMs(cm.last_used || cm.created_at)
        if (!tsMs) return
        events.push({
            user_id: cm.user_id,
            tool_key: 'card-maker',
            canonical_tool: 'card-maker',
            timestamp: new Date(tsMs),
            action_type: 'Card_Set',
            label: cm.name || 'Flashcard Set',
            source: 'studio',
            refId: `tools_cardmaker:${cm.id}`
        })
    })
    allPuzzleMaker.forEach(pm => {
        if (excludedIds.includes(pm.user_id)) return
        const tsMs = parseTimestampMs(pm.last_used || pm.created_at)
        if (!tsMs) return
        events.push({
            user_id: pm.user_id,
            tool_key: 'puzzle-maker',
            canonical_tool: 'puzzle-maker',
            timestamp: new Date(tsMs),
            action_type: 'Puzzle_Set',
            label: pm.name || 'Puzzle Set',
            source: 'studio',
            refId: `tools_puzzlemaker:${pm.id}`
        })
    })
    allWorksheetMaker.forEach(wm => {
        if (excludedIds.includes(wm.user_id)) return
        const tsMs = parseTimestampMs(wm.last_used || wm.created_at)
        if (!tsMs) return
        events.push({
            user_id: wm.user_id,
            tool_key: 'worksheet-maker',
            canonical_tool: 'worksheet-maker',
            timestamp: new Date(tsMs),
            action_type: 'Worksheet_Set',
            label: wm.name || 'Worksheet',
            source: 'studio',
            refId: `tools_worksheetmaker:${wm.id}`
        })
    })

    // 10. D&D & VTT
    allToolsDnd.forEach(d => {
        if (excludedIds.includes(d.user_id)) return
        const tsMs = parseTimestampMs(d.last_used || d.created_at)
        if (!tsMs) return
        events.push({
            user_id: d.user_id,
            tool_key: 'dnd-hub',
            canonical_tool: 'dnd-hub',
            timestamp: new Date(tsMs),
            action_type: 'DnD_Save',
            label: d.name || 'D&D Entry',
            source: 'studio',
            refId: `tools_dnd:${d.id}`
        })
    })
    allVttMaps.forEach(m => {
        const uid = m.user_id || m.owner_id
        if (!uid || excludedIds.includes(uid)) return
        const tsMs = parseTimestampMs(m.updated_at || m.created_at)
        if (!tsMs) return
        events.push({
            user_id: uid,
            tool_key: 'dnd-hub',
            canonical_tool: 'dnd-hub',
            timestamp: new Date(tsMs),
            action_type: 'VTT_Map',
            label: m.name || m.title || 'VTT Map',
            source: 'studio',
            refId: `vtt_maps:${m.id}`
        })
    })
    allVttCampaigns.forEach(c => {
        const uid = c.user_id || c.owner_id
        if (!uid || excludedIds.includes(uid)) return
        const tsMs = parseTimestampMs(c.updated_at || c.created_at)
        if (!tsMs) return
        events.push({
            user_id: uid,
            tool_key: 'dnd-hub',
            canonical_tool: 'dnd-hub',
            timestamp: new Date(tsMs),
            action_type: 'VTT_Campaign',
            label: c.name || c.title || 'VTT Campaign',
            source: 'studio',
            refId: `vtt_campaigns:${c.id}`
        })
    })

    return events.filter(ev => Boolean(ev.user_id))
}

function setChartDays(days) {
    chartDaysWindow = days
    ;[7, 14, 30, 90].forEach(d => {
        const btn = document.getElementById(`range-${d}`)
        if (btn) btn.classList.toggle('active', d === days)
    })
    updateStats()
}

function setTopToolsMode(mode) {
    topToolsMode = mode
    const btnWeek = document.getElementById('topToolsBtnWeek')
    const btnAll = document.getElementById('topToolsBtnAll')
    if (btnWeek) btnWeek.classList.toggle('active', mode === 'week')
    if (btnAll) btnAll.classList.toggle('active', mode === 'all')
    updateStats()
}

function setToolsChartMetric(metric) {
    toolsChartMetric = metric
    const btnSaves = document.getElementById('toolsMetricSaves')
    const btnUsers = document.getElementById('toolsMetricUsers')
    if (btnSaves) btnSaves.classList.toggle('active', metric === 'saves')
    if (btnUsers) btnUsers.classList.toggle('active', metric === 'users')
    updateStats()
}

function countStudentsInClassRow(cls) {
    if (Array.isArray(cls.students) && cls.students.length > 0) return cls.students.length
    if (cls.data && Array.isArray(cls.data.students)) return cls.data.students.length
    return 0
}


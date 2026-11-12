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
    classes: { col: 'class_name', dir: 'asc' }
}
let pagination = {
    users: 1,
    progress: 1,
    notes: 1,
    cloud: 1,
    schedule: 1,
    classes: 1
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
                tools_set: new Set(),
                records_count: 0
            }
        }
        const prof = allProfiles[userId]
        if (tsMs && !isNaN(tsMs) && tsMs > prof.last_active_ts && tsMs <= Date.now() + 86400000) {
            prof.last_active_ts = tsMs
        }
        if (canonicalToolId && canonicalToolId !== 'klasskit_hub' && canonicalToolId !== 'hub') {
            prof.tools_set.add(canonicalToolId)
            prof.records_count += countIncrement
        }
    }

    allProgress.forEach(r => {
        const ts = new Date(r.updated_at).getTime()
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
        registerUserActivity(m.user_id, parseTimestampMs(m.updated_at || m.created_at), 'dnd-hub', 1)
    })
    allVttCampaigns.forEach(c => {
        registerUserActivity(c.user_id, parseTimestampMs(c.updated_at || c.created_at), 'dnd-hub', 1)
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
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(applyFilters, 300)
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

function updateStats() {
    const excludedIds = getExcludedUserIds()

    // Exclusion banner
    const excludedBanner = document.getElementById('excludedBanner')
    const excludedBannerCount = document.getElementById('excludedBannerCount')
    if (excludedBanner) {
        excludedBanner.classList.toggle('hidden', excludedIds.length === 0)
        if (excludedBannerCount) {
            excludedBannerCount.textContent = `${excludedIds.length} test account${excludedIds.length === 1 ? '' : 's'}`
        }
    }

    // Filtered collections (excluding test accounts)
    const metricsProgress = allProgress.filter(r => !excludedIds.includes(r.user_id))
    const metricsNotesAll = allNotes.filter(n => !excludedIds.includes(n.user_id))
    const metricsNotes = metricsNotesAll.filter(n => !n.deleted)
    const trashedNotesCount = metricsNotesAll.filter(n => n.deleted).length
    const metricsProfiles = Object.fromEntries(Object.entries(allProfiles).filter(([id]) => !excludedIds.includes(id)))
    const metricsSched = allScheduleEvents.filter(e => !excludedIds.includes(e.user_id))
    const metricsClasses = allClassAdmin.filter(c => !excludedIds.includes(c.user_id))
    const metricsClassUnits = allClassUnits.filter(u => !excludedIds.includes(u.user_id))
    const metricsTasks = allMySpaceTasks.filter(t => !excludedIds.includes(t.user_id))
    const metricsMyClass = allMyClass.filter(c => !excludedIds.includes(c.user_id))
    const metricsSpreadsheets = allSpreadsheets.filter(s => !excludedIds.includes(s.user_id))
    const metricsLessonParser = allLessonParser.filter(lp => !excludedIds.includes(lp.user_id))
    const metricsCardMaker = allCardMaker.filter(cm => !excludedIds.includes(cm.user_id))
    const metricsPuzzleMaker = allPuzzleMaker.filter(pm => !excludedIds.includes(pm.user_id))
    const metricsWorksheetMaker = allWorksheetMaker.filter(wm => !excludedIds.includes(wm.user_id))
    const metricsToolsDnd = allToolsDnd.filter(d => !excludedIds.includes(d.user_id))
    const metricsVttMaps = allVttMaps.filter(m => !excludedIds.includes(m.user_id))
    const metricsVttCampaigns = allVttCampaigns.filter(c => !excludedIds.includes(c.user_id))

    const unifiedEvents = buildUnifiedEvents(excludedIds)

    // 1. Community & Active Cohorts (DAU / WAU / MAU)
    const profileList = Object.values(metricsProfiles)
    const totalTeachers = profileList.length
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000

    const dauUsers = new Set()
    const wauUsers = new Set()
    const mauUsers = new Set()

    unifiedEvents.forEach(ev => {
        const ts = ev.timestamp.getTime()
        if (ts >= dayAgo) dauUsers.add(ev.user_id)
        if (ts >= weekAgo) wauUsers.add(ev.user_id)
        if (ts >= monthAgo) mauUsers.add(ev.user_id)
    })

    // Also check profile last_active_ts in case hub visit was the most recent action
    profileList.forEach(p => {
        if (p.last_active_ts >= dayAgo) dauUsers.add(p.id)
        if (p.last_active_ts >= weekAgo) wauUsers.add(p.id)
        if (p.last_active_ts >= monthAgo) mauUsers.add(p.id)
    })

    const dauCount = dauUsers.size
    const wauCount = wauUsers.size
    const mauCount = mauUsers.size
    const stickiness = mauCount > 0 ? Math.round((dauCount / mauCount) * 100) : 0

    const setElText = (id, val) => {
        const el = document.getElementById(id)
        if (el) el.textContent = val
    }

    setElText('statUsers', totalTeachers)
    setElText('statDAU', dauCount)
    setElText('statWAU', wauCount)
    setElText('statMAU', mauCount)
    setElText('statStickiness', `${stickiness}% DAU/MAU`)

    const proCount = profileList.filter(p => p.role === 'pro').length
    const adminCount = profileList.filter(p => p.role === 'admin').length
    setElText('statPro', proCount)
    setElText('statAdmins', adminCount)

    const totalForBar = totalTeachers || 1
    const proPercent = Math.min(100, Math.round((proCount / totalForBar) * 100))
    const adminPercent = Math.min(100 - proPercent, Math.round((adminCount / totalForBar) * 100))
    setElText('statProPercent', `${proPercent}% Pro`)

    const statProBar = document.getElementById('statProBar')
    const statAdminBar = document.getElementById('statAdminBar')
    if (statProBar) statProBar.style.width = `${proPercent}%`
    if (statAdminBar) statAdminBar.style.width = `${adminPercent}%`

    // 2. Engagement Metrics
    const progressSaveCount = unifiedEvents.filter(e => e.source === 'progress').length
    const dbRecordsCount = unifiedEvents.length - progressSaveCount
    const totalInteractions = unifiedEvents.length
    const activeTeacherCount = profileList.filter(p => (p.records_count || 0) > 0).length || 1
    const avgSavesPerTeacher = (totalInteractions / activeTeacherCount).toFixed(1)

    const adoptedCanonicalTools = new Set(unifiedEvents.map(e => e.canonical_tool))
    const activeCatalogGames = allGamesCatalog.filter(g => g.category !== 'under-construction' && g.id !== 'myspace-home')
    const catalogTotalCount = activeCatalogGames.length || 59

    setElText('statRows', totalInteractions.toLocaleString())
    setElText('statAvgPerTeacher', `~${avgSavesPerTeacher} / active user`)
    setElText('statToolSavesCount', progressSaveCount.toLocaleString())
    setElText('statDbRecordsCount', dbRecordsCount.toLocaleString())
    setElText('statTools', `${adoptedCanonicalTools.size} / ${catalogTotalCount} tools`)

    // 3. Cloud Sync & Storage Health
    const totalUsed = profileList.reduce((sum, p) => sum + (Number(p.storage_usage) || 0), 0)
    const totalLimit = profileList.reduce((sum, p) => sum + (Number(p.storage_limit) || 50 * 1024 * 1024), 0)
    const totalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const totalLimitMB = Math.round(totalLimit / (1024 * 1024))
    const storagePercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0
    const mediaNodesCount = profileList.filter(p => (Number(p.storage_usage) || 0) > 0).length

    setElText('statStorage', `${totalUsedMB} MB`)
    setElText('statStorageQuotaInfo', `/ ${totalLimitMB} MB (${storagePercent}%)`)
    setElText('statMediaNodes', `${mediaNodesCount} teacher${mediaNodesCount === 1 ? '' : 's'}`)
    setElText('statTablesCount', `${healthyTablesCount}/${totalQueriedTables} tables OK`)

    const statStorageMiniBar = document.getElementById('statStorageMiniBar')
    if (statStorageMiniBar) statStorageMiniBar.style.width = `${storagePercent}%`

    let latestTsMs = 0
    unifiedEvents.forEach(ev => {
        const ms = ev.timestamp.getTime()
        if (ms > latestTsMs && ms <= Date.now() + 86400000) latestTsMs = ms
    })
    const latestStr = latestTsMs > 0
        ? `${formatRelativeTime(latestTsMs)} (${new Date(latestTsMs).toLocaleDateString()})`
        : '—'
    setElText('statLatest', latestStr)

    // 4. Secondary Ecosystem Pulse Strip (6 Mini Cards)
    const totalFoldersCount = Object.entries(allNoteFolders)
        .filter(([uid]) => !excludedIds.includes(uid))
        .reduce((sum, [, f]) => sum + (Array.isArray(f) ? f.length : 0), 0)
    setElText('statNotes', metricsNotes.length)
    setElText('statNotesSub', `${totalFoldersCount} folders · ${trashedNotesCount} trashed`)

    const totalStudentsCount = metricsMyClass.reduce((sum, c) => sum + countStudentsInClassRow(c), 0)
    setElText('statMyClasses', metricsMyClass.length)
    setElText('statStudentsCount', `${totalStudentsCount} students tracked`)

    setElText('statEvents', metricsSched.length)
    setElText('statClassesSub', `${metricsClasses.length} tracker · ${metricsClassUnits.length} syllabi`)

    const completedTasksCount = metricsTasks.filter(t => t.completed).length
    const taskCompletionRate = metricsTasks.length > 0 ? Math.round((completedTasksCount / metricsTasks.length) * 100) : 0
    setElText('statTasks', metricsTasks.length)
    setElText('statTasksSub', `${completedTasksCount} done (${taskCompletionRate}%)`)

    const makerSetsCount = metricsCardMaker.length + metricsPuzzleMaker.length + metricsWorksheetMaker.length
    setElText('statStudio', metricsSpreadsheets.length + makerSetsCount)
    setElText('statStudioSub', `${metricsSpreadsheets.length} sheets · ${makerSetsCount} maker sets`)

    const dndTotalCount = metricsToolsDnd.length + metricsVttMaps.length + metricsVttCampaigns.length
    setElText('statWorkshop', metricsLessonParser.length + dndTotalCount)
    setElText('statWorkshopSub', `${metricsLessonParser.length} parser · ${dndTotalCount} D&D/VTT`)

    // 5. Render Top Tools Card (7D vs All Time)
    const topToolsList = document.getElementById('topToolsList')
    const topToolsTitle = document.getElementById('topToolsTitle')
    if (topToolsList) {
        const toolStats = {}
        const recordTool = (canonicalKey, userId) => {
            if (!toolStats[canonicalKey]) toolStats[canonicalKey] = { count: 0, users: new Set() }
            toolStats[canonicalKey].count += 1
            if (userId) toolStats[canonicalKey].users.add(userId)
        }

        unifiedEvents.forEach(ev => {
            if (topToolsMode === 'week') {
                if (ev.timestamp.getTime() >= weekAgo) recordTool(ev.canonical_tool, ev.user_id)
            } else {
                recordTool(ev.canonical_tool, ev.user_id)
            }
        })

        let topTools = Object.entries(toolStats).sort((a, b) => b[1].count - a[1].count)
        let isFallback = false

        if (topToolsMode === 'week' && topTools.length === 0 && unifiedEvents.length > 0) {
            unifiedEvents.forEach(ev => recordTool(ev.canonical_tool, ev.user_id))
            topTools = Object.entries(toolStats).sort((a, b) => b[1].count - a[1].count)
            isFallback = true
        }

        if (topToolsTitle) {
            topToolsTitle.textContent = (topToolsMode === 'all' || isFallback)
                ? (isFallback ? 'Top Tools Overall (No 7D Saves)' : 'Top Tools All-Time')
                : 'Top Tools This Week (7D)'
        }

        const sliced = topTools.slice(0, 4)
        if (sliced.length === 0) {
            topToolsList.innerHTML = '<div class="text-center py-6 text-slate-500 font-bold text-xs">No activity yet</div>'
        } else {
            topToolsList.innerHTML = sliced.map(([toolKey, info]) => {
                const meta = getToolMeta(toolKey)
                return `
                    <div class="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/40">
                        <span class="text-xs text-slate-200 font-bold flex items-center gap-2 truncate pr-2">
                            <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${meta.color}"></i>
                            <span class="truncate">${escapeHtml(meta.name)}</span>
                        </span>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="text-[10px] text-slate-400 font-mono">${info.users.size}u</span>
                            <span class="text-xs font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">${info.count}</span>
                        </div>
                    </div>
                `
            }).join('')
            lucide.createIcons({ root: topToolsList })
        }
    }

    updateCharts(unifiedEvents, metricsProfiles)
    renderDashboardInsights(unifiedEvents, metricsProfiles, adoptedCanonicalTools)
}

function updateCharts(unifiedEvents, metricsProfiles) {
    const ctxActivity = document.getElementById('activityChart')?.getContext('2d')
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d')
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')
    const ctxActiveUsers = document.getElementById('activeUsersChart')?.getContext('2d')

    if (!ctxActivity || !ctxCategory || !ctxTools || !ctxActiveUsers) return

    // 1. Activity & DAU Charts (using configurable chartDaysWindow: 7, 14, 30, 90)
    const days = chartDaysWindow || 14

    const getLocalDateKey = (dateVal) => {
        const d = new Date(dateVal)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const dateKeys = []
    const activityLabels = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setHours(12, 0, 0, 0)
        d.setDate(d.getDate() - i)
        dateKeys.push(getLocalDateKey(d))
        activityLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    }

    const activityByDate = {}
    const usersByDate = {}

    unifiedEvents.forEach(entry => {
        const key = getLocalDateKey(entry.timestamp)
        activityByDate[key] = (activityByDate[key] || 0) + 1
        if (!usersByDate[key]) usersByDate[key] = new Set()
        usersByDate[key].add(entry.user_id)
    })

    const activityData = dateKeys.map(k => activityByDate[k] || 0)
    const dauData = dateKeys.map(k => usersByDate[k]?.size || 0)

    // Summary chips for Activity & DAU charts
    const windowTotalActions = activityData.reduce((a, b) => a + b, 0)
    const maxActivity = Math.max(0, ...activityData)
    const maxActivityIdx = activityData.indexOf(maxActivity)
    const peakActivityLabel = maxActivity > 0 ? `${maxActivity} (${activityLabels[maxActivityIdx]})` : '0'

    const maxDau = Math.max(0, ...dauData)
    const avgDau = (dauData.reduce((a, b) => a + b, 0) / days).toFixed(1)

    const activitySummaryEl = document.getElementById('activitySummaryText')
    if (activitySummaryEl) activitySummaryEl.textContent = `${windowTotalActions.toLocaleString()} actions in the last ${days} days`
    const activityPeakEl = document.getElementById('activityPeakChip')
    if (activityPeakEl) activityPeakEl.textContent = `Peak: ${peakActivityLabel}`
    const dauPeakEl = document.getElementById('dauPeakChip')
    if (dauPeakEl) dauPeakEl.textContent = `Peak DAU: ${maxDau}`
    const dauAvgEl = document.getElementById('dauAvgChip')
    if (dauAvgEl) dauAvgEl.textContent = `Avg: ${avgDau} / day`

    const blueGradient = ctxActivity.createLinearGradient(0, 0, 0, ctxActivity.canvas.clientHeight || 250)
    blueGradient.addColorStop(0, 'rgba(30, 167, 253, 0.35)')
    blueGradient.addColorStop(1, 'rgba(30, 167, 253, 0.0)')

    const greenGradient = ctxActiveUsers.createLinearGradient(0, 0, 0, ctxActiveUsers.canvas.clientHeight || 250)
    greenGradient.addColorStop(0, 'rgba(0, 208, 99, 0.8)')
    greenGradient.addColorStop(1, 'rgba(0, 208, 99, 0.2)')

    if (charts.activity) charts.activity.destroy()
    charts.activity = new Chart(ctxActivity, {
        type: 'line',
        data: {
            labels: activityLabels,
            datasets: [{
                label: 'Interactions',
                data: activityData,
                borderColor: '#1ea7fd',
                backgroundColor: blueGradient,
                fill: true,
                tension: 0.35,
                borderWidth: 4,
                pointRadius: days > 30 ? 2 : 5,
                pointBackgroundColor: '#020617',
                pointBorderColor: '#1ea7fd',
                pointBorderWidth: days > 30 ? 2 : 3,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#1ea7fd',
                pointHoverBorderColor: '#020617',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(30, 167, 253, 0.5)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y} Interactions`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)', borderDash: [5, 5] },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
                }
            }
        }
    })

    if (charts.activeUsers) charts.activeUsers.destroy()
    charts.activeUsers = new Chart(ctxActiveUsers, {
        type: 'bar',
        data: {
            labels: activityLabels,
            datasets: [{
                label: 'Active Users',
                data: dauData,
                backgroundColor: greenGradient,
                borderColor: '#020617',
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(0, 208, 99, 0.5)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y} Unique Teachers`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)', borderDash: [5, 5] },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Nunito', weight: '700' },
                        stepSize: 1,
                        precision: 0
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
                }
            }
        }
    })

    // 2. Canonical Tool Aggregation & Category Distribution (strictly using excluded-filtered unifiedEvents)
    const canonicalStats = {}
    const categories = {
        'My Space': { count: 0, color: '#ff7e33' },
        'Tools': { count: 0, color: '#1ea7fd' },
        'Workshop': { count: 0, color: '#ff4785' },
        'Games': { count: 0, color: '#00d063' }
    }

    unifiedEvents.forEach(ev => {
        const meta = getToolMeta(ev.canonical_tool)
        if (!canonicalStats[meta.id]) {
            canonicalStats[meta.id] = {
                meta,
                saves: 0,
                users: new Set()
            }
        }
        canonicalStats[meta.id].saves += 1
        if (ev.user_id) canonicalStats[meta.id].users.add(ev.user_id)

        if (categories[meta.category]) {
            categories[meta.category].count += 1
        } else {
            categories['Tools'].count += 1
        }
    })

    if (charts.category) charts.category.destroy()
    charts.category = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories).map(c => c.count),
                backgroundColor: Object.values(categories).map(c => c.color),
                borderWidth: 3,
                borderColor: '#0f172a',
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Nunito', weight: 'bold', size: 11 },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: '#475569',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true,
                    boxPadding: 6
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw(chart) {
                const { ctx, chartArea } = chart
                if (!chartArea) return
                ctx.save()
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0)
                const centerX = (chartArea.left + chartArea.right) / 2
                const centerY = (chartArea.top + chartArea.bottom) / 2

                ctx.font = '700 28px Fredoka'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = '#fff'
                ctx.fillText(total.toLocaleString(), centerX, centerY - 8)

                ctx.font = '800 10px Nunito'
                ctx.fillStyle = '#94a3b8'
                ctx.fillText('TOTAL ACTIONS', centerX, centerY + 16)
                ctx.restore()
            }
        }]
    })

    // 3. Top Performing Tools Bar Chart (by saves OR by unique teachers)
    const allToolsStats = Object.values(canonicalStats).sort((a, b) => {
        if (toolsChartMetric === 'users') {
            return (b.users.size - a.users.size) || (b.saves - a.saves)
        }
        return (b.saves - a.saves) || (b.users.size - a.users.size)
    })
    const top10Tools = allToolsStats.slice(0, 10)

    if (charts.tools) charts.tools.destroy()
    charts.tools = new Chart(ctxTools, {
        type: 'bar',
        data: {
            labels: top10Tools.map(t => t.meta.name),
            datasets: [{
                label: toolsChartMetric === 'users' ? 'Unique Teachers' : 'Total Saves',
                data: top10Tools.map(t => toolsChartMetric === 'users' ? t.users.size : t.saves),
                backgroundColor: top10Tools.map(t => t.meta.color),
                borderColor: '#020617',
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(255, 126, 51, 0.5)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: (ctx) => {
                            const item = top10Tools[ctx.dataIndex]
                            if (!item) return ''
                            return ` ${item.saves} saves · ${item.users.size} teacher${item.users.size === 1 ? '' : 's'} (${item.meta.category})`
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)', borderDash: [5, 5] },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, precision: 0 }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#fff',
                        font: { family: 'Fredoka', weight: '700', size: 11 }
                    }
                }
            }
        }
    })

    // 4. Full Tool Breakdown List (shows all active tools with category badge, teacher count, and save volume)
    const breakdownEl = document.getElementById('toolBreakdown')
    const breakdownCountChip = document.getElementById('breakdownCountChip')
    if (breakdownCountChip) breakdownCountChip.textContent = `${allToolsStats.length} active`

    if (breakdownEl) {
        const maxVal = allToolsStats.length > 0
            ? (toolsChartMetric === 'users' ? allToolsStats[0].users.size : allToolsStats[0].saves) || 1
            : 1

        if (allToolsStats.length === 0) {
            breakdownEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No tool activity recorded</div>'
        } else {
            breakdownEl.innerHTML = allToolsStats.map(item => {
                const metricVal = toolsChartMetric === 'users' ? item.users.size : item.saves
                const percent = Math.max(4, Math.round((metricVal / maxVal) * 100))
                return `
                    <div class="group p-2.5 bg-slate-900/40 hover:bg-slate-700/30 border border-slate-700/40 rounded-xl transition-colors cursor-default">
                        <div class="flex items-center justify-between text-xs mb-1.5 gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <i data-lucide="${item.meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${item.meta.color}"></i>
                                <span class="font-bold text-white truncate">${escapeHtml(item.meta.name)}</span>
                            </div>
                            <span class="text-slate-400 font-mono font-bold text-[10px] flex-shrink-0">${item.saves} saves · ${item.users.size}u</span>
                        </div>
                        <div class="h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-[1px]">
                            <div class="h-full rounded-full transition-all duration-700" style="width: ${percent}%; background: ${item.meta.color}"></div>
                        </div>
                    </div>`
            }).join('')
            lucide.createIcons({ root: breakdownEl })
        }
    }
}

function renderDashboardInsights(unifiedEvents, metricsProfiles, adoptedCanonicalTools) {
    // 1. Top Active Teachers Leaderboard
    const topTeachersEl = document.getElementById('topTeachersList')
    if (topTeachersEl) {
        const userStats = {}
        Object.values(metricsProfiles).forEach(p => {
            userStats[p.id] = {
                profile: p,
                saves: 0,
                tools: new Set(),
                latestTs: p.last_active_ts || 0
            }
        })
        unifiedEvents.forEach(ev => {
            if (!userStats[ev.user_id]) return
            userStats[ev.user_id].saves += 1
            userStats[ev.user_id].tools.add(ev.canonical_tool)
            if (ev.timestamp.getTime() > userStats[ev.user_id].latestTs) {
                userStats[ev.user_id].latestTs = ev.timestamp.getTime()
            }
        })

        const rankedTeachers = Object.values(userStats)
            .filter(u => u.saves > 0 || u.latestTs > 0)
            .sort((a, b) => (b.saves - a.saves) || (b.tools.size - a.tools.size) || (b.latestTs - a.latestTs))
            .slice(0, 6)

        if (!rankedTeachers.length) {
            topTeachersEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No active teachers yet</div>'
        } else {
            topTeachersEl.innerHTML = rankedTeachers.map((u, idx) => {
                const p = u.profile
                const name = p.display_name || p.id.slice(0, 8)
                const role = p.role || 'user'
                const roleBadge = role === 'admin'
                    ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase">Admin</span>'
                    : role === 'pro'
                        ? '<span class="px-1.5 py-0.5 rounded bg-orange/20 text-orange text-[9px] font-black uppercase">⭐ Pro</span>'
                        : ''
                return `
                    <div onclick="viewUser('${p.id}')" class="flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 hover:border-blue/50 rounded-xl cursor-pointer transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-7 h-7 rounded-lg bg-blue/15 border border-blue/40 flex items-center justify-center font-heading text-xs text-blue flex-shrink-0">#${idx + 1}</div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold text-white text-xs truncate">${escapeHtml(name)}</span>
                                    ${roleBadge}
                                </div>
                                <div class="text-[10px] text-slate-400 font-mono">${u.tools.size} tools · ${formatRelativeTime(u.latestTs)}</div>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 ml-2">
                            <div class="font-heading text-sm text-white">${u.saves}</div>
                            <div class="text-[9px] text-slate-500 uppercase font-bold">records</div>
                        </div>
                    </div>
                `
            }).join('')
        }
    }

    // 2. Recent Live Activity Stream
    const recentFeedEl = document.getElementById('recentActivityFeed')
    if (recentFeedEl) {
        const recent = [...unifiedEvents]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 6)

        if (!recent.length) {
            recentFeedEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No recent activity</div>'
        } else {
            recentFeedEl.innerHTML = recent.map(ev => {
                const p = allProfiles[ev.user_id]
                const name = p?.display_name || ev.user_id.slice(0, 8)
                const meta = getToolMeta(ev.canonical_tool)
                return `
                    <div onclick="viewUser('${ev.user_id}')" class="flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 hover:border-green/50 rounded-xl cursor-pointer transition-all gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${meta.color}20; border:1px solid ${meta.color}50">
                                <i data-lucide="${meta.icon}" class="w-3.5 h-3.5" style="color:${meta.color}"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-white truncate">${escapeHtml(name)} <span class="text-slate-400 font-normal">→</span> <span style="color:${meta.color}">${escapeHtml(meta.name)}</span></div>
                                <div class="text-[10px] text-slate-400 truncate font-mono">${escapeHtml(ev.action_type.replace(/_/g, ' '))}: ${escapeHtml(String(ev.label).slice(0, 32))}</div>
                            </div>
                        </div>
                        <span class="text-[10px] font-mono text-slate-400 whitespace-nowrap flex-shrink-0">${formatRelativeTime(ev.timestamp.getTime())}</span>
                    </div>
                `
            }).join('')
            lucide.createIcons({ root: recentFeedEl })
        }
    }

    // 3. Catalog Coverage & Dormant Tools
    const coverageChip = document.getElementById('catalogCoverageChip')
    const categoryBarsEl = document.getElementById('catalogCategoryBars')
    const dormantCountEl = document.getElementById('dormantToolsCount')
    const dormantListEl = document.getElementById('dormantToolsList')

    const activeCatalog = allGamesCatalog.filter(g => g.category !== 'under-construction' && g.id !== 'myspace-home')
    if (activeCatalog.length > 0) {
        const adoptedInCatalog = activeCatalog.filter(g => adoptedCanonicalTools.has(g.id))
        const dormantTools = activeCatalog.filter(g => !adoptedCanonicalTools.has(g.id))
        const coveragePct = Math.round((adoptedInCatalog.length / activeCatalog.length) * 100)

        if (coverageChip) coverageChip.textContent = `${adoptedInCatalog.length}/${activeCatalog.length} (${coveragePct}%)`
        if (dormantCountEl) dormantCountEl.textContent = `${dormantTools.length} untried`

        if (categoryBarsEl) {
            const catGroups = [
                { key: 'game', label: 'Games', color: '#00d063' },
                { key: 'tool', label: 'Tools', color: '#1ea7fd' },
                { key: 'myspace', label: 'My Space', color: '#ff7e33' },
                { key: 'workshop', label: 'Workshop', color: '#ff4785' }
            ]
            categoryBarsEl.innerHTML = catGroups.map(cg => {
                const items = activeCatalog.filter(g => (g.id === 'lessonnotes' ? 'myspace' : g.category) === cg.key)
                const used = items.filter(g => adoptedCanonicalTools.has(g.id)).length
                const total = items.length || 1
                const pct = Math.round((used / total) * 100)
                return `
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span class="font-bold text-slate-300">${cg.label}</span>
                            <span class="font-mono text-slate-400 text-[11px]">${used} / ${items.length} (${pct}%)</span>
                        </div>
                        <div class="h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-[1px]">
                            <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%; background:${cg.color}"></div>
                        </div>
                    </div>
                `
            }).join('')
        }

        if (dormantListEl) {
            if (dormantTools.length === 0) {
                dormantListEl.innerHTML = '<span class="text-xs text-green font-bold">🎉 100% of catalog tools have been used!</span>'
            } else {
                dormantListEl.innerHTML = dormantTools.map(g => `
                    <span class="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-400">${escapeHtml(g.title)}</span>
                `).join('')
            }
        }
    }
}

// ── FILTERS ──
function populateToolFilter() {
    const toolsSet = new Set([
        ...allProgress.map(r => r.tool_key).filter(k => k !== 'klasskit_hub' && k !== 'hub'),
        'lesson-note',
        'schedule',
        'admin-tracker',
        'tasks',
        'my-class',
        'spreadsheet',
        'card-maker',
        'puzzle-maker',
        'worksheet-maker',
        'lesson-parser',
        'dnd-hub'
    ])
    const tools = [...toolsSet].sort()
    const sel = document.getElementById('toolFilter')
    if (!sel) return
    sel.innerHTML = '<option value="">All tools</option>' +
        tools.map(t => {
            const meta = getToolMeta(t)
            return `<option value="${escapeHtml(t)}">${escapeHtml(meta.name)} (${escapeHtml(t)})</option>`
        }).join('')
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.toLowerCase().trim() : ''
    const tool = toolFilter ? toolFilter.value : ''
    const canonicalSelectedTool = tool ? resolveCanonicalToolId(tool) : ''
    const excludedIds = getExcludedUserIds()

    const matchesToolKey = (rawKey) => {
        if (!tool) return true
        return rawKey === tool || resolveCanonicalToolId(rawKey) === canonicalSelectedTool
    }

    let filteredRows = allProgress.filter(r => {
        if (excludedIds.includes(r.user_id)) return false
        const name = (allProfiles[r.user_id]?.display_name || '').toLowerCase()
        const meta = getToolMeta(r.tool_key)
        const matchSearch = !search
            || name.includes(search)
            || r.user_id.toLowerCase().includes(search)
            || r.tool_key.toLowerCase().includes(search)
            || meta.name.toLowerCase().includes(search)
        return matchSearch && matchesToolKey(r.tool_key)
    })

    let filteredUserIds = Object.keys(allProfiles).filter(uid => {
        if (excludedIds.includes(uid)) return false
        const prof = allProfiles[uid] || {}
        const name = (prof.display_name || '').toLowerCase()
        const email = (prof.email || '').toLowerCase()
        const matchSearch = !search || name.includes(search) || email.includes(search) || uid.toLowerCase().includes(search)
        const hasUsedTool = !tool
            || (prof.tools_set && (prof.tools_set.has(tool) || prof.tools_set.has(canonicalSelectedTool)))
            || allProgress.some(r => r.user_id === uid && matchesToolKey(r.tool_key))
        return matchSearch && hasUsedTool
    })

    let filteredNotes = allNotes.filter(n => {
        if (excludedIds.includes(n.user_id)) return false
        const name = (allProfiles[n.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || n.user_id.toLowerCase().includes(search)
            || (n.title || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('lesson-note')
    })

    let filteredScheduleEvents = allScheduleEvents.filter(e => {
        if (excludedIds.includes(e.user_id)) return false
        const name = (allProfiles[e.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || e.user_id.toLowerCase().includes(search)
            || (e.name || '').toLowerCase().includes(search)
            || (e.type_id || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('schedule')
    })

    let filteredClassAdmin = allClassAdmin.filter(c => {
        if (excludedIds.includes(c.user_id)) return false
        const name = (allProfiles[c.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || c.user_id.toLowerCase().includes(search)
            || (c.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('admin-tracker')
    })

    const filteredClassUnits = allClassUnits.filter(u => {
        if (excludedIds.includes(u.user_id)) return false
        const name = (allProfiles[u.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || u.user_id.toLowerCase().includes(search)
            || (u.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('admin-tracker')
    })

    const filteredMySpaceTasks = allMySpaceTasks.filter(t => {
        if (excludedIds.includes(t.user_id)) return false
        const name = (allProfiles[t.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || t.user_id.toLowerCase().includes(search)
            || (t.text || '').toLowerCase().includes(search)
            || (t.category || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('tasks')
    })

    const filteredMyClass = allMyClass.filter(c => {
        if (excludedIds.includes(c.user_id)) return false
        const name = (allProfiles[c.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || c.user_id.toLowerCase().includes(search)
            || (c.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('my-class')
    })

    const allStudioItems = buildStudioItemsList(excludedIds).filter(item => {
        const name = (allProfiles[item.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || item.user_id.toLowerCase().includes(search)
            || (item.title || '').toLowerCase().includes(search)
            || (item.type_label || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey(item.tool_key)
    })

    // Sort Users
    filteredUserIds.sort((a, b) => {
        const profA = allProfiles[a] || {}
        const profB = allProfiles[b] || {}
        const conf = sortConfig.users
        let valA, valB

        if (conf.col === 'name') {
            valA = (profA.display_name || '').toLowerCase()
            valB = (profB.display_name || '').toLowerCase()
        } else if (conf.col === 'role') {
            const roleOrder = { admin: 0, pro: 1, user: 2 }
            valA = roleOrder[profA.role] ?? 2
            valB = roleOrder[profB.role] ?? 2
        } else if (conf.col === 'storage') {
            valA = profA.storage_usage || 0
            valB = profB.storage_usage || 0
        } else if (conf.col === 'active') {
            valA = profA.last_active_ts || 0
            valB = profB.last_active_ts || 0
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Progress
    filteredRows.sort((a, b) => {
        const conf = sortConfig.progress
        let valA, valB

        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'tool') {
            valA = a.tool_key
            valB = b.tool_key
        } else if (conf.col === 'updated_at') {
            valA = new Date(a.updated_at).getTime()
            valB = new Date(b.updated_at).getTime()
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Notes
    filteredNotes.sort((a, b) => {
        const conf = sortConfig.notes
        let valA, valB

        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'title') {
            valA = (a.title || '').toLowerCase()
            valB = (b.title || '').toLowerCase()
        } else if (conf.col === 'updated_at') {
            valA = Number(a.updated_at) || 0
            valB = Number(b.updated_at) || 0
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Schedule Events
    filteredScheduleEvents.sort((a, b) => {
        const conf = sortConfig.schedule
        let valA, valB
        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'name') {
            valA = (a.name || '').toLowerCase()
            valB = (b.name || '').toLowerCase()
        } else {
            valA = a.date || ''
            valB = b.date || ''
        }
        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Class Admin
    filteredClassAdmin.sort((a, b) => {
        const conf = sortConfig.classes
        let valA, valB
        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'class_name') {
            valA = (a.class_name || '').toLowerCase()
            valB = (b.class_name || '').toLowerCase()
        } else {
            valA = a.created_at || ''
            valB = b.created_at || ''
        }
        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Pagination for Users
    const userPages = Math.ceil(filteredUserIds.length / PAGE_SIZE) || 1
    if (pagination.users > userPages) pagination.users = userPages
    const userStart = (pagination.users - 1) * PAGE_SIZE
    const pagedUserIds = filteredUserIds.slice(userStart, userStart + PAGE_SIZE)
    const userPageInfo = document.getElementById('users-page-info')
    if (userPageInfo) userPageInfo.textContent = `Page ${pagination.users} of ${userPages}`

    // Pagination for Progress
    const progPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1
    if (pagination.progress > progPages) pagination.progress = progPages
    const progStart = (pagination.progress - 1) * PAGE_SIZE
    const pagedRows = filteredRows.slice(progStart, progStart + PAGE_SIZE)
    const progressPageInfo = document.getElementById('progress-page-info')
    if (progressPageInfo) progressPageInfo.textContent = `Page ${pagination.progress} of ${progPages}`

    // Pagination for Notes
    const notesPages = Math.ceil(filteredNotes.length / PAGE_SIZE) || 1
    if (pagination.notes > notesPages) pagination.notes = notesPages
    const notesStart = (pagination.notes - 1) * PAGE_SIZE
    const pagedNotes = filteredNotes.slice(notesStart, notesStart + PAGE_SIZE)
    const notesPageInfo = document.getElementById('notes-page-info')
    if (notesPageInfo) notesPageInfo.textContent = `Page ${pagination.notes} of ${notesPages}`

    // Pagination for Schedule Events
    const schedPages = Math.ceil(filteredScheduleEvents.length / PAGE_SIZE) || 1
    if (pagination.schedule > schedPages) pagination.schedule = schedPages
    const schedStart = (pagination.schedule - 1) * PAGE_SIZE
    const pagedSched = filteredScheduleEvents.slice(schedStart, schedStart + PAGE_SIZE)
    const schedulePageInfo = document.getElementById('schedule-page-info')
    if (schedulePageInfo) schedulePageInfo.textContent = `Page ${pagination.schedule} of ${schedPages}`

    // Pagination for Classes
    const classPages = Math.ceil(filteredClassAdmin.length / PAGE_SIZE) || 1
    if (pagination.classes > classPages) pagination.classes = classPages
    const classStart = (pagination.classes - 1) * PAGE_SIZE
    const pagedClasses = filteredClassAdmin.slice(classStart, classStart + PAGE_SIZE)
    const classesPageInfo = document.getElementById('classes-page-info')
    if (classesPageInfo) classesPageInfo.textContent = `Page ${pagination.classes} of ${classPages}`

    // Pagination counts for reliable clamping
    pagination.lastFilteredCounts = {
        users: filteredUserIds.length,
        progress: filteredRows.length,
        notes: filteredNotes.length,
        schedule: filteredScheduleEvents.length,
        classes: filteredClassAdmin.length,
        cloud: pagination.lastFilteredCounts?.cloud || 0
    }

    renderUsersTable(pagedUserIds, filteredRows)
    renderProgressTable(pagedRows)
    renderNotesTable(pagedNotes)
    renderScheduleTable(pagedSched)
    renderClassesView(pagedClasses, filteredClassUnits)
    renderTasksTable(filteredMySpaceTasks)
    renderMyClassTable(filteredMyClass)
    renderStudioTable(allStudioItems)
    if (currentView === 'logs') renderLogsTable()
    updateSortIcons()

    const userCount = document.getElementById('userCount')
    if (userCount) userCount.textContent = filteredUserIds.length + ' users'
    const progressCount = document.getElementById('progressCount')
    if (progressCount) progressCount.textContent = filteredRows.length + ' rows'
    const notesCount = document.getElementById('notesCount')
    if (notesCount) notesCount.textContent = filteredNotes.length + ' notes'
    const scheduleCount = document.getElementById('scheduleCount')
    if (scheduleCount) scheduleCount.textContent = filteredScheduleEvents.length + ' events'
    const classAdminCount = document.getElementById('classAdminCount')
    if (classAdminCount) classAdminCount.textContent = filteredClassAdmin.length + ' classes'
    const classUnitsCount = document.getElementById('classUnitsCount')
    if (classUnitsCount) classUnitsCount.textContent = filteredClassUnits.length + ' classes'
    const tasksCount = document.getElementById('tasksCount')
    if (tasksCount) tasksCount.textContent = filteredMySpaceTasks.length + ' tasks'
    const myclassCount = document.getElementById('myclassCount')
    if (myclassCount) myclassCount.textContent = filteredMyClass.length + ' classes'
    const studioCount = document.getElementById('studioCount')
    if (studioCount) studioCount.textContent = allStudioItems.length + ' items'
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    if (searchInput) searchInput.value = ''
    if (toolFilter) toolFilter.value = ''
    applyFilters()
}

// ── USERS TABLE ──
function renderUsersTable(userIds, rows) {
    const body = document.getElementById('usersTableBody')
    if (!body) return
    if (!userIds.length) {
        body.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-slate-500 font-bold">No users found</td></tr>'
        return
    }

    body.innerHTML = userIds.map(uid => {
        const profile = allProfiles[uid]
        const name = profile?.display_name || '—'
        const role = profile?.role || 'user'
        const userToolIds = profile?.tools_set ? [...profile.tools_set] : []
        const recordsCount = profile?.records_count || 0
        let activeDate = 'Never'
        let latestTs = profile?.last_active_ts || 0

        if (latestTs > 0) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const thatDay = new Date(latestTs); thatDay.setHours(0, 0, 0, 0);
            const diffDays = Math.round((today - thatDay) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) activeDate = 'Today'
            else if (diffDays === 1) activeDate = 'Yesterday'
            else if (diffDays < 7) activeDate = `${diffDays} days ago`
            else activeDate = thatDay.toLocaleDateString()
        }
        const date = activeDate
        const initial = name[0]?.toUpperCase() || '?'
        const isAdmin = role === 'admin'
        const isPro = role === 'pro'

        const avatarClass = isAdmin
            ? 'bg-pink/20 border-2 border-pink/40 text-pink'
            : isPro
                ? 'bg-orange/20 border-2 border-orange/40 text-orange'
                : 'bg-blue/20 border-2 border-blue/40 text-blue'

        const selectClass = isAdmin
            ? 'text-pink border-pink/40'
            : isPro
                ? 'text-orange border-orange/40'
                : 'text-slate-400 border-slate-600'

        const displayTools = userToolIds.slice(0, 5)
        const extraToolsCount = Math.max(0, userToolIds.length - displayTools.length)

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm flex-shrink-0 ${avatarClass}">${escapeHtml(initial)}</div>
              <div>
                <span class="font-bold text-white">${escapeHtml(name)}</span>
                ${isPro ? '<span class="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange/20 border border-orange/40 text-[9px] font-black text-orange uppercase tracking-wider">⭐ Pro</span>' : ''}
                ${recordsCount > 0 ? `<div class="text-[10px] text-slate-500 font-mono">${recordsCount} saved records</div>` : ''}
              </div>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3"><span class="font-mono text-xs text-slate-500">${escapeHtml(uid.slice(0, 12))}...</span></td>
          <td class="px-5 py-3">
            <select onchange="updateRole('${uid}', this.value)" 
              class="bg-slate-800 border-2 border-slate-700 rounded-lg text-[10px] font-black uppercase px-2 py-1 outline-none focus:border-blue transition-colors cursor-pointer ${selectClass}">
              <option value="user" ${role === 'user' ? 'selected' : ''}>👤 User</option>
              <option value="pro" ${isPro ? 'selected' : ''}>⭐ Pro</option>
              <option value="admin" ${isAdmin ? 'selected' : ''}>🛡️ Admin</option>
            </select>
          </td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center w-24">
                    <span class="text-[10px] font-bold text-white">${((profile?.storage_usage || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                    <span class="text-[10px] text-slate-500 font-mono">${Math.min(100, Math.round(((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100))}%</span>
                </div>
                <div class="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full ${((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100 < 60 ? 'bg-green' : (((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100 < 85 ? 'bg-orange' : 'bg-pink')}" 
                        style="width: ${Math.min(100, Math.round(((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100))}%"></div>
                </div>
            </div>
          </td>
          <td class="hidden lg:table-cell px-5 py-3">
            ${userToolIds.length === 0 ? '<span class="text-xs text-slate-500 italic">No activity yet</span>' :
                `<div class="flex flex-wrap gap-1">
              ${displayTools.map(t => {
                    const meta = getToolMeta(t)
                    return `<span class="chip bg-blue/10 text-blue border-blue/30" title="${escapeHtml(t)}">${escapeHtml(meta.name)}</span>`
                }).join('')}
              ${extraToolsCount > 0 ? `<span class="chip bg-slate-800 text-slate-400 border-slate-700">+${extraToolsCount} more</span>` : ''}
            </div>`}
          </td>
          <td class="px-5 py-3 text-xs text-slate-400 font-bold">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="viewUser('${uid}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> Details
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

// ── PROGRESS TABLE ──
function renderProgressTable(rows) {
    const body = document.getElementById('progressTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No progress rows found</td></tr>'
        return
    }

    body.innerHTML = rows.map(row => {
        const profile = allProfiles[row.user_id]
        const name = profile?.display_name || '—'
        const meta = getToolMeta(row.tool_key)
        const preview = JSON.stringify(row.data).slice(0, 60) + '…'
        const date = new Date(row.updated_at).toLocaleString()
        const initial = name[0]?.toUpperCase() || '?'

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
              <div>
                <div class="font-bold text-white text-sm">${escapeHtml(name)}</div>
                <div class="font-mono text-[10px] text-slate-600">${escapeHtml(row.user_id.slice(0, 8))}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-0.5">
              <span class="chip bg-orange/10 text-orange border-orange/30 w-fit">${escapeHtml(meta.name)}</span>
              <span class="font-mono text-[9px] text-slate-500">${escapeHtml(row.tool_key)}</span>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3 max-w-[200px]">
            <code class="text-[10px] text-slate-500 truncate block">${escapeHtml(preview)}</code>
          </td>
          <td class="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="openViewModal('${row.user_id}','${row.tool_key}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button onclick="openDeleteModal('${row.user_id}','${row.tool_key}')"
                class="neo-btn px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

// ── NOTES TABLE ──
function renderNotesTable(rows) {
    const body = document.getElementById('notesTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No notes found</td></tr>'
        return
    }

    body.innerHTML = rows.map(note => {
        const profile = allProfiles[note.user_id]
        const name = profile?.display_name || '—'
        const ts = Number(note.updated_at)
        const date = ts ? new Date(ts).toLocaleString() : '—'
        const initial = name[0]?.toUpperCase() || '?'
        let folderName = '—'
        if (note.folder_id) {
            const userFolders = allNoteFolders[note.user_id] || []
            const folder = userFolders.find(f => f.id === note.folder_id)
            if (folder) folderName = folder.name || folder.id
        }

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
              <div>
                <div class="font-bold text-white text-sm">${escapeHtml(name)}</div>
                <div class="font-mono text-[10px] text-slate-600">${escapeHtml(note.user_id.slice(0, 8))}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-200">${escapeHtml(note.title || 'Untitled')}</span>
              ${note.deleted ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase">Trash</span>' : ''}
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${note.folder_id ? `<span class="chip bg-orange/10 text-orange border-orange/30">${escapeHtml(folderName)}</span>` : '<span class="text-xs text-slate-600 italic">Root</span>'}
          </td>
          <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="openNoteModal('${note.id}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button onclick="openDeleteModal('${note.id}','note')"
                class="neo-btn px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

// ── SCHEDULE EVENTS TABLE ──
function renderScheduleTable(rows) {
    const body = document.getElementById('scheduleTableBody')
    if (!body) return
    if (!rows || !rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No schedule events found</td></tr>'
        return
    }
    const recurrenceLabels = { none: 'One-time', weekly: 'Weekly', daily: 'Daily', monthly: 'Monthly' }
    body.innerHTML = rows.map(ev => {
        const profile = allProfiles[ev.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const recLabel = recurrenceLabels[ev.recurrence] || ev.recurrence || 'One-time'
        const isRecurring = ev.recurrence && ev.recurrence !== 'none'
        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
              <div>
                <div class="font-bold text-white text-sm">${escapeHtml(name)}</div>
                <div class="font-mono text-[10px] text-slate-600">${escapeHtml(ev.user_id.slice(0, 8))}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${escapeHtml(ev.color || '#FF8C42')}"></div>
              <span class="font-bold text-slate-200">${escapeHtml(ev.name || 'Untitled Event')}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-blue/10 text-blue border-blue/30">${escapeHtml(ev.type_id || 'other')}</span>
          </td>
          <td class="px-5 py-3 text-xs text-slate-300 whitespace-nowrap font-mono">${escapeHtml(ev.date || '—')}</td>
          <td class="hidden md:table-cell px-5 py-3">
            <span class="chip ${isRecurring ? 'bg-orange/10 text-orange border-orange/30' : 'bg-slate-700 text-slate-400 border-slate-600'}">${escapeHtml(recLabel)}</span>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

// ── SCHEDULE CLASSES VIEW ──
function renderClassesView(pagedClasses, filteredUnits) {
    // Admin classes table
    const adminBody = document.getElementById('classAdminTableBody')
    if (adminBody) {
        if (!pagedClasses || !pagedClasses.length) {
            adminBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No admin classes found</td></tr>'
        } else {
            adminBody.innerHTML = pagedClasses.map(cls => {
                const profile = allProfiles[cls.user_id]
                const name = profile?.display_name || '—'
                const initial = name[0]?.toUpperCase() || '?'

                let tasks = cls.tasks;
                if (typeof tasks === 'string') {
                    try { tasks = JSON.parse(tasks); } catch (e) { tasks = []; }
                }
                const taskCount = Array.isArray(tasks) ? tasks.length : 0;

                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
                  <span class="font-bold text-white text-sm">${escapeHtml(name)}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
              <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${taskCount} task${taskCount !== 1 ? 's' : ''}</span></td>
              <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onclick="openClassModal('${cls.id}','admin')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                  </button>
                </div>
              </td>
            </tr>`
            }).join('')
        }
    }

    // Units table
    const unitsBody = document.getElementById('classUnitsTableBody')
    if (unitsBody) {
        if (!filteredUnits) {
            const excludedIds = getExcludedUserIds()
            filteredUnits = allClassUnits.filter(cls => !excludedIds.includes(cls.user_id))
        }
        if (!filteredUnits.length) {
            unitsBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No class units found</td></tr>'
        } else {
            unitsBody.innerHTML = filteredUnits.map(cls => {
                const profile = allProfiles[cls.user_id]
                const name = profile?.display_name || '—'
                const initial = name[0]?.toUpperCase() || '?'

                let syllabus = cls.syllabus;
                if (typeof syllabus === 'string') {
                    try { syllabus = JSON.parse(syllabus); } catch (e) { syllabus = []; }
                }
                const unitCount = Array.isArray(syllabus) ? syllabus.length : 0;

                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
                  <span class="font-bold text-white text-sm">${escapeHtml(name)}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
              <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${unitCount} unit${unitCount !== 1 ? 's' : ''}</span></td>
              <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onclick="openClassModal('${cls.id}','units')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                  </button>
                </div>
              </td>
            </tr>`
            }).join('')
        }
    }
    lucide.createIcons()
}

function setClassTab(tab) {
    scheduleClassTab = tab
    document.getElementById('classview-admin').classList.toggle('hidden', tab !== 'admin')
    document.getElementById('classview-units').classList.toggle('hidden', tab !== 'units')
    const adminBtn = document.getElementById('classtab-admin')
    const unitsBtn = document.getElementById('classtab-units')
    adminBtn.className = `neo-btn px-4 py-2 ${tab === 'admin' ? 'bg-orange text-white' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm font-bold`
    unitsBtn.className = `neo-btn px-4 py-2 ${tab === 'units' ? 'bg-orange text-white' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm`
}

function setDataTab(tab) {
    const tabs = ['progress', 'notes', 'schedule', 'classes', 'tasks', 'myclass', 'studio']
    tabs.forEach(t => {
        const btn = document.getElementById('datatab-' + t)
        const view = document.getElementById('dataview-' + t)
        if (btn) {
            btn.className = `neo-btn px-4 py-2 ${t === tab ? 'bg-blue text-white font-bold' : 'bg-slate-800 text-slate-300'} rounded-xl text-sm`
        }
        if (view) {
            view.classList.toggle('hidden', t !== tab)
        }
    })
    lucide.createIcons()
}

function openClassModal(id, type) {
    const item = type === 'admin'
        ? allClassAdmin.find(c => c.id === id)
        : allClassUnits.find(c => c.id === id)
    if (!item) return
    const profile = allProfiles[item.user_id]
    const label = type === 'admin' ? 'Admin Tasks' : 'Syllabus Units'
    document.getElementById('viewModalTitle').textContent = `${item.class_name} — ${label}`
    document.getElementById('viewModalSub').textContent = (profile?.display_name || item.user_id.slice(0, 8)) + ' · ' + new Date(item.created_at).toLocaleDateString()
    document.getElementById('viewModalContent').innerHTML = `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${JSON.stringify(type === 'admin' ? item.tasks : item.syllabus, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    document.getElementById('viewModalBg').classList.remove('hidden')
}

function openNoteModal(noteId) {
    const note = allNotes.find(n => n.id === noteId)
    if (!note) return
    const profile = allProfiles[note.user_id]

    document.getElementById('viewModalTitle').textContent =
        (profile?.display_name || note.user_id.slice(0, 8)) + ' — ' + (note.title || 'Untitled')
    document.getElementById('viewModalSub').textContent =
        'Updated ' + (Number(note.updated_at) ? new Date(Number(note.updated_at)).toLocaleString() : '—')
    document.getElementById('viewModalContent').innerHTML = `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${(note.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    document.getElementById('viewModalBg').classList.remove('hidden')
}

// ── VIEW MODAL ──
function openViewModal(userId, toolKey) {
    const row = allProgress.find(r => r.user_id === userId && r.tool_key === toolKey)
    const profile = allProfiles[userId]
    if (!row) return

    const meta = getToolMeta(toolKey)
    document.getElementById('viewModalTitle').textContent =
        (profile?.display_name || userId.slice(0, 8)) + ' — ' + meta.name + ` (${toolKey})`
    document.getElementById('viewModalSub').textContent =
        'Updated ' + new Date(row.updated_at).toLocaleString()
    document.getElementById('viewModalContent').innerHTML =
        `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${JSON.stringify(row.data, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    document.getElementById('viewModalBg').classList.remove('hidden')
}

function closeViewModal() {
    document.getElementById('viewModalBg').classList.add('hidden')
}

// ── VIEW USER ──
function viewUser(userId) {
    const profile = allProfiles[userId] || {};
    const name = profile.display_name || userId.slice(0, 8);
    const email = profile.email || '—';
    const role = profile.role || 'user';
    const userProgress = allProgress.filter(r => r.user_id === userId);
    const userNotes = allNotes.filter(n => n.user_id === userId);
    const userTasks = allMySpaceTasks.filter(t => t.user_id === userId);
    const completedTasksCount = userTasks.filter(t => t.completed).length;
    const userClasses = allMyClass.filter(c => c.user_id === userId);
    const userEvents = allScheduleEvents.filter(e => e.user_id === userId);
    const userSpreadsheets = allSpreadsheets.filter(s => s.user_id === userId);
    const userCardMaker = allCardMaker.filter(c => c.user_id === userId);
    const userPuzzleMaker = allPuzzleMaker.filter(p => p.user_id === userId);
    const userWorksheetMaker = allWorksheetMaker.filter(w => w.user_id === userId);
    const userLessonParser = allLessonParser.filter(l => l.user_id === userId);
    const userDnd = allToolsDnd.filter(d => d.user_id === userId);
    const userVttMaps = allVttMaps.filter(m => (m.user_id || m.owner_id) === userId);
    const userVttCampaigns = allVttCampaigns.filter(c => (c.user_id || c.owner_id) === userId);

    const studioTotal = userSpreadsheets.length + userCardMaker.length + userPuzzleMaker.length + userWorksheetMaker.length;
    const workshopTotal = userLessonParser.length + userDnd.length + userVttMaps.length + userVttCampaigns.length;

    let totalStudents = 0;
    userClasses.forEach(cls => {
        const d = typeof cls.data === 'string' ? (() => { try { return JSON.parse(cls.data); } catch (e) { return {}; } })() : (cls.data || {});
        if (Array.isArray(d.students)) totalStudents += d.students.length;
    });

    const formatTs = (ts) => ts ? new Date(ts).toLocaleString() : '—';
    const usedMB = ((profile.storage_usage || 0) / (1024 * 1024)).toFixed(2);
    const limitMB = ((profile.storage_limit || 50 * 1024 * 1024) / (1024 * 1024)).toFixed(0);
    const storagePct = Math.min(100, Math.round(((profile.storage_usage || 0) / (profile.storage_limit || 50 * 1024 * 1024)) * 100));

    // Aggregate canonical tools used by this user across all tables
    const canonicalCounts = {};
    userProgress.forEach(r => {
        if (r.tool_key === 'klasskit_hub' || r.tool_key === 'hub') return;
        const cid = resolveCanonicalToolId(r.tool_key);
        const entries = extractLogEntries(r);
        canonicalCounts[cid] = (canonicalCounts[cid] || 0) + entries.length;
    });
    if (userNotes.length) canonicalCounts['lessonnotes'] = (canonicalCounts['lessonnotes'] || 0) + userNotes.length;
    if (userEvents.length) canonicalCounts['schedule'] = (canonicalCounts['schedule'] || 0) + userEvents.length;
    if (userClasses.length) canonicalCounts['my-class'] = (canonicalCounts['my-class'] || 0) + userClasses.length;
    if (userTasks.length) canonicalCounts['tasks'] = (canonicalCounts['tasks'] || 0) + userTasks.length;
    if (userSpreadsheets.length) canonicalCounts['spreadsheet'] = (canonicalCounts['spreadsheet'] || 0) + userSpreadsheets.length;
    if (userCardMaker.length) canonicalCounts['card-maker'] = (canonicalCounts['card-maker'] || 0) + userCardMaker.length;
    if (userPuzzleMaker.length) canonicalCounts['puzzle-maker'] = (canonicalCounts['puzzle-maker'] || 0) + userPuzzleMaker.length;
    if (userWorksheetMaker.length) canonicalCounts['worksheet-maker'] = (canonicalCounts['worksheet-maker'] || 0) + userWorksheetMaker.length;
    if (userLessonParser.length) canonicalCounts['lesson-parser'] = (canonicalCounts['lesson-parser'] || 0) + userLessonParser.length;
    if (userDnd.length || userVttMaps.length || userVttCampaigns.length) {
        canonicalCounts['dnd-hub'] = (canonicalCounts['dnd-hub'] || 0) + userDnd.length + userVttMaps.length + userVttCampaigns.length;
    }

    const sortedToolKeys = Object.keys(canonicalCounts).sort((a, b) => canonicalCounts[b] - canonicalCounts[a]);

    let html = `
        <div class="space-y-5 text-slate-300">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="neo bg-slate-950 p-3.5 border-2 border-slate-700">
                    <div class="text-[10px] text-slate-500 uppercase font-black mb-1">Email / Auth</div>
                    <div class="text-xs text-white font-bold break-all">${escapeHtml(email)}</div>
                </div>
                <div class="neo bg-slate-950 p-3.5 border-2 border-slate-700">
                    <div class="text-[10px] text-slate-500 uppercase font-black mb-1">User ID</div>
                    <div class="text-[11px] text-slate-400 font-mono break-all">${escapeHtml(userId)}</div>
                </div>
                <div class="neo bg-slate-950 p-3.5 border-2 border-slate-700">
                    <div class="flex justify-between text-[10px] text-slate-500 uppercase font-black mb-1">
                        <span>Cloud Storage</span>
                        <span class="text-blue font-mono">${storagePct}%</span>
                    </div>
                    <div class="text-xs text-white font-bold mb-1.5">${usedMB} MB / ${limitMB} MB</div>
                    <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-blue rounded-full" style="width:${storagePct}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-blue mb-0.5">${userProgress.length}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Tool Rows</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-orange mb-0.5">${userNotes.length}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Notes</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-green mb-0.5">${userClasses.length}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Classes (${totalStudents} stu)</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-pink mb-0.5">${userEvents.length}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Events</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-blue mb-0.5">${completedTasksCount}/${userTasks.length}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Tasks Done</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-xl font-heading text-orange mb-0.5">${studioTotal + workshopTotal}</div>
                    <div class="text-[9px] uppercase font-bold text-slate-400">Studio & Workshop</div>
                </div>
            </div>

            <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2"><i data-lucide="grid-2x2" class="w-4 h-4 text-blue"></i> Adopted Tools & Activity Volume (${sortedToolKeys.length})</h3>
                ${sortedToolKeys.length ? `
                <div class="flex flex-wrap gap-2">
                    ${sortedToolKeys.map(cid => {
                        const meta = getToolMeta(cid);
                        return `<span class="chip bg-blue/10 text-blue border-blue/40">${escapeHtml(meta.name)} <span class="ml-1 opacity-70">(${canonicalCounts[cid]})</span></span>`;
                    }).join('')}
                </div>
                ` : '<div class="text-xs text-slate-500 italic">No tool activity</div>'}
            </div>
            
            <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-orange"></i> Recent Notes</h3>
                ${userNotes.length ? `
                <ul class="space-y-2 text-xs">
                    ${userNotes.slice(0, 5).map(n => `<li class="flex justify-between items-center border-b border-slate-800 pb-2"><span class="font-bold text-slate-300 truncate mr-4">${escapeHtml(n.title || 'Untitled')}</span><span class="text-slate-500 font-mono whitespace-nowrap">${formatTs(Number(n.updated_at))}</span></li>`).join('')}
                </ul>
                ` : '<div class="text-xs text-slate-500 italic">No notes</div>'}
            </div>
        </div>
    `;

    const roleLabel = role === 'pro' ? '⭐ PRO USER' : role === 'admin' ? '🛡️ ADMIN' : '👤 USER';
    document.getElementById('viewModalTitle').textContent = name + ' — Profile Details';
    document.getElementById('viewModalSub').textContent = `Role: ${roleLabel} · Last Active: ${profile.last_active_ts ? formatTs(profile.last_active_ts) : 'Never'}`;
    document.getElementById('viewModalContent').innerHTML = html;
    document.getElementById('viewModalBg').classList.remove('hidden');
    lucide.createIcons();
}

// ── DELETE MODAL ──
function openDeleteModal(idOrUser, toolOrType) {
    let title = "Delete Item?"
    let msg = "This action cannot be undone."

    if (toolOrType === 'announcement') {
        const ann = allAnnouncements.find(a => a.id === idOrUser)
        title = "Delete Announcement?"
        msg = `Permanently delete "${ann?.title || 'this announcement'}"?`
        pendingDelete = { id: idOrUser, type: 'announcement' }
    } else if (toolOrType === 'note') {
        const note = allNotes.find(n => n.id === idOrUser)
        title = "Delete Note?"
        msg = `Permanently delete note "${note?.title || 'Untitled'}"?`
        pendingDelete = { id: idOrUser, type: 'note' }
    } else if (toolOrType === 'cloud-storage') {
        const profile = allProfiles[idOrUser]
        const name = profile?.display_name || idOrUser.slice(0, 8)
        const usedMB = ((profile?.storage_usage || 0) / (1024 * 1024)).toFixed(1)
        title = "Clear Cloud Storage?"
        msg = `Permanently delete all cloud media files (${usedMB} MB) for "${name}"? This cannot be undone.`
        pendingDelete = { userId: idOrUser, type: 'cloud-storage' }
    } else {
        const profile = allProfiles[idOrUser]
        const name = profile?.display_name || idOrUser.slice(0, 8)
        title = "Delete Progress?"
        msg = `This will permanently delete "${toolOrType}" data for ${name}.`
        pendingDelete = { userId: idOrUser, toolKey: toolOrType, type: 'progress' }
    }

    document.getElementById('deleteModalTitle').textContent = title
    document.getElementById('deleteModalMsg').textContent = msg
    document.getElementById('deleteModalBg').classList.remove('hidden')
    lucide.createIcons()
}

function closeDeleteModal() {
    document.getElementById('deleteModalBg').classList.add('hidden')
    pendingDelete = null
}

async function executeDelete() {
    if (!pendingDelete) return

    if (pendingDelete.type === 'announcement') {
        const { error } = await db.from('announcements').delete().eq('id', pendingDelete.id)
        if (error) showToast('Error: ' + error.message, 'error')
        else {
            showToast('Announcement deleted')
            fetchData()
        }
    } else if (pendingDelete.type === 'note') {
        const { error } = await db.from('notes').delete().eq('id', pendingDelete.id)
        if (error) showToast('Error: ' + error.message, 'error')
        else {
            showToast('Note deleted')
            allNotes = allNotes.filter(n => n.id !== pendingDelete.id)
            updateStats()
            applyFilters()
        }
    } else if (pendingDelete.type === 'cloud-storage') {
        const { userId } = pendingDelete
        closeDeleteModal()
        await deleteUserCloudStorage(userId)
        return
    } else {
        const { userId, toolKey } = pendingDelete
        const { error } = await db
            .from('user_progress')
            .delete()
            .match({ user_id: userId, tool_key: toolKey })

        if (error) { showToast('Error: ' + error.message, 'error') }
        else {
            showToast('Progress data deleted')
            allProgress = allProgress.filter(r => !(r.user_id === userId && r.tool_key === toolKey))
            updateStats()
            applyFilters()
        }
    }
    closeDeleteModal()
}

// ── LOGS ──
function renderLogsTable() {
    const body = document.getElementById('logsTableBody')
    if (!body) return

    const excludedIds = getExcludedUserIds()
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.toLowerCase().trim() : ''
    const tool = toolFilter ? toolFilter.value : ''
    const canonicalSelectedTool = tool ? resolveCanonicalToolId(tool) : ''

    // Build unified chronological audit trail across all tables
    const allEvents = buildUnifiedEvents(excludedIds)
        .filter(ev => {
            const p = allProfiles[ev.user_id]
            const name = (p?.display_name || '').toLowerCase()
            const meta = getToolMeta(ev.canonical_tool)
            const matchSearch = !search
                || name.includes(search)
                || ev.user_id.toLowerCase().includes(search)
                || ev.tool_key.toLowerCase().includes(search)
                || meta.name.toLowerCase().includes(search)
                || String(ev.label || '').toLowerCase().includes(search)
                || String(ev.action_type || '').toLowerCase().includes(search)
            const matchTool = !tool || ev.tool_key === tool || ev.canonical_tool === canonicalSelectedTool
            return matchSearch && matchTool
        })
        .sort((a, b) => b.timestamp - a.timestamp)

    const logsCountChip = document.getElementById('logsCountChip')
    if (logsCountChip) {
        logsCountChip.textContent = `${Math.min(250, allEvents.length)} of ${allEvents.length} events`
    }

    const logEntries = allEvents.slice(0, 250)

    if (!logEntries.length) {
        body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 font-bold">No log entries found</td></tr>'
        return
    }

    body.innerHTML = logEntries.map(entry => {
        const profile = allProfiles[entry.user_id]
        const name = profile?.display_name || entry.user_id.slice(0, 8)
        const time = entry.timestamp.toLocaleTimeString()
        const date = entry.timestamp.toLocaleDateString()
        const initial = name[0]?.toUpperCase() || '?'
        const meta = getToolMeta(entry.canonical_tool)

        return `<tr class="group transition-all hover:bg-white/5 border-l-4 border-transparent hover:border-blue">
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-white font-mono text-xs">${time}</span>
                    <span class="text-[9px] text-slate-500 font-mono">${date}</span>
                </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3 cursor-pointer" onclick="viewUser('${entry.user_id}')">
                <div class="w-8 h-8 rounded-lg bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-blue group-hover:text-blue transition-colors">${escapeHtml(initial)}</div>
                <div class="flex flex-col">
                    <span class="text-white font-bold text-xs tracking-tight group-hover:text-blue transition-colors">${escapeHtml(name)}</span>
                    <span class="text-[9px] text-slate-500 font-mono">UID: ${escapeHtml(entry.user_id.slice(0, 8))}</span>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full" style="background:${meta.color}; box-shadow: 0 0 8px ${meta.color}80"></div>
                  <span class="text-slate-200 font-black text-[10px] uppercase tracking-widest">${escapeHtml(entry.action_type || 'Save_Log_Entry')}</span>
                </div>
                ${entry.label ? `<span class="text-[10px] text-slate-500 font-mono pl-4 truncate max-w-[260px]">${escapeHtml(String(entry.label))}</span>` : ''}
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex flex-col gap-0.5">
                <span class="chip bg-slate-900 border-slate-700 w-fit" style="color:${meta.color}">${escapeHtml(meta.name)}</span>
                <span class="text-[9px] font-mono text-slate-600">${escapeHtml(entry.tool_key)}</span>
              </div>
            </td>
          </tr>`
    }).join('')
}

// ── SETTINGS ──
function debouncedSaveSettings() {
    clearTimeout(settingsTimeout)
    settingsTimeout = setTimeout(saveSettings, 500)
}

function saveSettings() {
    const settings = {
        maintenance: document.getElementById('setting-maintenance').checked,
        sync: document.getElementById('setting-sync').checked,
        announcement: document.getElementById('setting-announcement').value,
        excluded_ids: document.getElementById('setting-excluded-ids').value
    }
    localStorage.setItem('kk_admin_settings', JSON.stringify(settings))
    // Trigger re-render of stats & filters to apply new exclusion
    updateStats()
    applyFilters()
    if (currentView === 'cloud') renderCloudTable()
    console.log('[Admin] Settings saved:', settings)
}

function loadSettings() {
    const saved = localStorage.getItem('kk_admin_settings')
    if (saved) {
        try {
            const settings = JSON.parse(saved)
            const maint = document.getElementById('setting-maintenance')
            const sync = document.getElementById('setting-sync')
            const ann = document.getElementById('setting-announcement')
            const excl = document.getElementById('setting-excluded-ids')
            if (maint) maint.checked = settings.maintenance || false
            if (sync) sync.checked = settings.sync !== false
            if (ann) ann.value = settings.announcement || ''
            if (excl) excl.value = settings.excluded_ids || ''
        } catch (e) {
            console.error('[Admin] Failed to parse saved settings:', e)
        }
    }
    renderExcludedUserPicker()
}

// ── EXCLUSION PICKER ──
function renderExcludedUserPicker() {
    const list = document.getElementById('exclusion-list')
    const chips = document.getElementById('excluded-chips')
    if (!list || !chips) return

    const excluded = getExcludedUserIds()
    const users = Object.entries(allProfiles).sort((a, b) => {
        const nameA = (a[1].display_name || '').toLowerCase()
        const nameB = (b[1].display_name || '').toLowerCase()
        return nameA.localeCompare(nameB)
    })

    // Render chips
    if (!excluded.length) {
        chips.innerHTML = '<span class="text-xs text-slate-600 italic">No users excluded</span>'
    } else {
        chips.innerHTML = excluded.map(id => {
            const p = allProfiles[id]
            const name = p?.display_name || id.slice(0, 8)
            return `<div class="inline-flex items-center gap-2 px-3 py-1 bg-pink/10 border border-pink/30 rounded-full text-xs text-pink font-bold animate-pop-in">
                ${escapeHtml(name)}
                <button onclick="removeExcludedUser('${id}')" class="hover:text-white transition-colors" title="Remove"><i data-lucide="x" class="w-3 h-3"></i></button>
            </div>`
        }).join('')
        lucide.createIcons()
    }

    // Render list
    if (!users.length) {
        list.innerHTML = '<div class="text-xs text-slate-600 italic p-3 text-center">No users loaded yet</div>'
        return
    }

    list.innerHTML = users.map(([id, profile]) => {
        const name = profile.display_name || 'Unknown'
        const initial = name[0]?.toUpperCase() || '?'
        const isExcluded = excluded.includes(id)
        return `<label class="exclusion-item flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors ${isExcluded ? 'bg-pink/5' : ''}">
            <input type="checkbox" value="${id}" ${isExcluded ? 'checked' : ''} onchange="updateExcludedUsers()" class="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer exclusion-checkbox">
            <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
            <span class="text-sm text-white font-bold">${escapeHtml(name)}</span>
            <span class="text-[10px] text-slate-600 font-mono ml-auto">${escapeHtml(id.slice(0, 8))}...</span>
        </label>`
    }).join('')

    // Restore any active search filter
    filterExclusionList()
}

function updateExcludedUsers() {
    const list = document.getElementById('exclusion-list')
    if (!list) return
    const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    const textarea = document.getElementById('setting-excluded-ids')
    if (textarea) textarea.value = checked.join(', ')
    saveSettings()
    renderExcludedUserPicker()
}

function removeExcludedUser(id) {
    const textarea = document.getElementById('setting-excluded-ids')
    if (!textarea) return
    const current = getExcludedUserIds().filter(x => x !== id)
    textarea.value = current.join(', ')
    saveSettings()
    renderExcludedUserPicker()
}

function filterExclusionList() {
    const search = document.getElementById('exclusion-search')
    const list = document.getElementById('exclusion-list')
    if (!search || !list) return
    const term = search.value.toLowerCase()
    const labels = list.querySelectorAll('label.exclusion-item')
    labels.forEach(label => {
        const name = label.querySelector('span.font-bold')?.textContent.toLowerCase() || ''
        const id = label.querySelector('.font-mono')?.textContent.toLowerCase() || ''
        label.style.display = (name.includes(term) || id.includes(term)) ? 'flex' : 'none'
    })
}

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text == null ? '' : String(text)
    return div.innerHTML
}

// ── USER MANAGEMENT ──
async function updateRole(userId, newRole) {
    const row = allProfiles[userId]
    if (!row) return

    const roleLabels = { user: '👤 User', pro: '⭐ Pro', admin: '🛡️ Admin' }
    const roleDisplay = roleLabels[newRole] || newRole.toUpperCase()
    const confirmed = await showConfirmModal(`Change role for ${row.display_name || userId} to ${roleDisplay}?`, {
        title: 'Change Role?',
        confirmText: 'Change',
        cancelText: 'Cancel',
        icon: 'shield',
        iconColor: 'blue'
    });
    if (!confirmed) {
        applyFilters() // Reset dropdown
        return
    }

    const { error } = await db
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

    if (error) {
        showToast('Error updating role: ' + error.message, 'error')
    } else {
        allProfiles[userId].role = newRole
        showToast('User role updated')
        updateStats()
        applyFilters()
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (sb) sb.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

// ── NAV ──
function setView(view) {
    const sb = document.getElementById('sidebar');
    if (sb && !sb.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        toggleSidebar();
    }

    ['dashboard', 'users', 'data-details', 'logs', 'announcements', 'cloud', 'settings'].forEach(v => {
        const viewEl = document.getElementById('view-' + v)
        if (viewEl) viewEl.classList.toggle('hidden', v !== view)

        if (v === view) {
            const titles = {
                dashboard: 'Dashboard',
                users: 'User Management',
                'data-details': 'Data Details',
                logs: 'Audit Logs',
                announcements: 'Announcements',
                cloud: 'Cloud Storage',
                settings: 'Settings'
            }
            const viewTitle = document.getElementById('view-title')
            if (viewTitle) viewTitle.textContent = titles[v] || v
        }

        const btn = document.getElementById('nav-' + v)
        if (btn) {
            btn.classList.toggle('active', v === view)
            btn.classList.toggle('text-slate-400', v !== view)
            btn.classList.toggle('text-slate-300', v === view)
        }
    })
    currentView = view
    if (view === 'logs') renderLogsTable()
    if (view === 'settings') loadSettings()
    if (view === 'announcements') renderAnnouncements()
    if (view === 'cloud') renderCloudTable()
    if (view === 'data-details') applyFilters()
}

// ── CLOUD USAGE LOGIC ──
function renderCloudTable() {
    const body = document.getElementById('cloudTableBody')
    if (!body) return

    const excludedIds = getExcludedUserIds()
    const cloudSearchEl = document.getElementById('cloudSearchInput')
    const globalSearchEl = document.getElementById('searchInput')
    const searchTerm = ((cloudSearchEl ? cloudSearchEl.value : '') || (globalSearchEl ? globalSearchEl.value : '')).toLowerCase().trim()

    const allEligibleProfiles = Object.values(allProfiles).filter(p => !excludedIds.includes(p.id))

    // Compute accurate global storage totals across ALL non-excluded profiles (not just current page)
    let totalUsed = 0
    let totalLimit = 0
    allEligibleProfiles.forEach(p => {
        totalUsed += (p.storage_usage || 0)
        totalLimit += (p.storage_limit || 50 * 1024 * 1024)
    })

    let profiles = allEligibleProfiles.filter(p => {
        if (!searchTerm) return true
        const name = (p.display_name || '').toLowerCase()
        return name.includes(searchTerm) || p.id.toLowerCase().includes(searchTerm)
    })

    // Sort Cloud Usage
    profiles.sort((a, b) => {
        const conf = sortConfig.cloud
        let valA, valB

        if (conf.col === 'user') {
            valA = (a.display_name || '').toLowerCase()
            valB = (b.display_name || '').toLowerCase()
        } else if (conf.col === 'usage') {
            valA = a.storage_usage || 0
            valB = b.storage_usage || 0
        } else if (conf.col === 'limit') {
            valA = a.storage_limit || (50 * 1024 * 1024)
            valB = b.storage_limit || (50 * 1024 * 1024)
        } else if (conf.col === 'percent') {
            valA = (a.storage_usage || 0) / (a.storage_limit || 50 * 1024 * 1024)
            valB = (b.storage_usage || 0) / (b.storage_limit || 50 * 1024 * 1024)
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Pagination for Cloud
    const cloudPages = Math.ceil(profiles.length / PAGE_SIZE) || 1
    if (pagination.cloud > cloudPages) pagination.cloud = cloudPages
    const cloudStart = (pagination.cloud - 1) * PAGE_SIZE
    const pagedProfiles = profiles.slice(cloudStart, cloudStart + PAGE_SIZE)
    const cloudPageInfo = document.getElementById('cloud-page-info')
    if (cloudPageInfo) cloudPageInfo.textContent = `Page ${pagination.cloud} of ${cloudPages}`

    // Pagination counts for reliable clamping
    pagination.lastFilteredCounts.cloud = profiles.length

    if (!pagedProfiles.length) {
        body.innerHTML = '<tr><td colspan="4" class="px-8 py-12 text-center text-slate-500 font-bold">No cloud storage nodes match your filter</td></tr>'
    } else {
        body.innerHTML = pagedProfiles.map(p => {
            const used = p.storage_usage || 0
            const limit = p.storage_limit || (50 * 1024 * 1024)
            const percent = Math.min(100, Math.round((used / limit) * 100))
            const usedMB = (used / (1024 * 1024)).toFixed(1)
            const limitMB = (limit / (1024 * 1024)).toFixed(0)
            const barColor = percent < 60 ? 'bg-green' : (percent < 85 ? 'bg-orange' : 'bg-pink')
            const name = p.display_name || '—'
            const initial = name[0]?.toUpperCase() || '?'

            return `
                <tr class="group hover:bg-white/5 transition-all">
                    <td class="px-8 py-5">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl bg-slate-800 border-4 border-slate-700 flex items-center justify-center font-heading text-slate-400 group-hover:border-blue group-hover:text-blue transition-colors text-xs flex-shrink-0">${escapeHtml(initial)}</div>
                            <div>
                                <div class="font-bold text-white text-sm tracking-tight">${escapeHtml(name)}</div>
                                <div class="text-[9px] text-slate-600 font-mono">NODE_ID: ${escapeHtml(p.id.slice(0, 8))}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex flex-col">
                            <span class="font-mono text-xs text-white">${usedMB} MB</span>
                            <span class="text-[9px] text-slate-600 uppercase font-black">Quota: ${limitMB} MB</span>
                        </div>
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex items-center gap-4">
                            <div class="flex-1 h-3 bg-slate-950 border-2 border-slate-800 rounded-full overflow-hidden p-0.5 min-w-[120px]">
                                <div class="h-full ${barColor} rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(30,167,253,0.2)]" style="width: ${percent}%"></div>
                            </div>
                            <span class="text-[10px] font-black ${percent > 85 ? 'text-pink' : 'text-blue'} w-8">${percent}%</span>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <div class="inline-flex items-center gap-2">
                            <button onclick="syncUserStorage('${p.id}')" id="sync-btn-${p.id}" title="Recalculate User Cloud Storage"
                                class="neo-btn !p-2 !bg-slate-900 !border-2 !border-slate-800 hover:!border-blue transition-all group/sync">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-slate-500 group-hover/sync:text-blue sync-icon-${p.id}"></i>
                            </button>
                            <button onclick="openDeleteModal('${p.id}', 'cloud-storage')" id="delete-storage-btn-${p.id}" title="Clear User Cloud Storage"
                                class="neo-btn !p-2 !bg-slate-900 !border-2 !border-slate-800 hover:!border-pink transition-all group/btn">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-pink delete-storage-icon-${p.id}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `
        }).join('')
    }

    // Update Summary
    const globalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const globalLimitMB = (totalLimit / (1024 * 1024)).toFixed(0)
    const globalPercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0

    const globalStorageUsed = document.getElementById('globalStorageUsed')
    const globalStorageBar = document.getElementById('globalStorageBar')
    const globalStoragePercent = document.getElementById('globalStoragePercent')

    if (globalStorageUsed) globalStorageUsed.textContent = `${globalUsedMB} MB / ${globalLimitMB} MB`
    if (globalStoragePercent) globalStoragePercent.textContent = `${globalPercent}%`

    if (globalStorageBar) {
        globalStorageBar.style.width = `${globalPercent}%`
        const colorClass = globalPercent > 90 ? 'bg-pink' : (globalPercent > 70 ? 'bg-orange' : 'bg-blue')
        const shadowClass = globalPercent > 90 ? 'shadow-[0_0_20px_rgba(255,71,133,0.3)]' : (globalPercent > 70 ? 'shadow-[0_0_20px_rgba(255,126,51,0.3)]' : 'shadow-[0_0_20px_rgba(30,167,253,0.3)]')
        globalStorageBar.className = `h-full rounded-full transition-all duration-1000 ${colorClass} ${shadowClass}`
    }

    const activeUsers = allEligibleProfiles.filter(p => (p.storage_usage || 0) > 0).length
    const globalActiveUsers = document.getElementById('globalActiveUsers')
    if (globalActiveUsers) globalActiveUsers.textContent = activeUsers

    updateSortIcons()
    lucide.createIcons()
}

// ── SORTING HELPERS ──
function toggleSort(tableView, col) {
    const conf = sortConfig[tableView]
    if (conf.col === col) {
        conf.dir = conf.dir === 'asc' ? 'desc' : 'asc'
    } else {
        conf.col = col
        conf.dir = 'asc'
    }

    pagination[tableView] = 1 // Reset to first page
    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function changePage(tableView, delta) {
    const count = pagination.lastFilteredCounts?.[tableView] || 0
    const maxPages = Math.ceil(count / PAGE_SIZE) || 1

    pagination[tableView] += delta
    if (pagination[tableView] < 1) pagination[tableView] = 1
    if (pagination[tableView] > maxPages) pagination[tableView] = maxPages

    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function updateSortIcons() {
    // Clear all sort indicators
    document.querySelectorAll('[id^="sort-"]').forEach(el => el.innerHTML = '')

    // Add current indicator
    Object.entries(sortConfig).forEach(([view, conf]) => {
        const el = document.getElementById(`sort-${view}-${conf.col}`)
        if (el) {
            const icon = conf.dir === 'asc' ? 'chevron-up' : 'chevron-down'
            el.innerHTML = `<i data-lucide="${icon}" class="w-3 h-3 text-blue"></i>`
        }
    })
    lucide.createIcons()
}

async function deleteUserCloudStorage(userId) {
    const btn = document.getElementById(`delete-storage-btn-${userId}`)
    const icon = document.querySelector(`.delete-storage-icon-${userId}`)
    if (icon) icon.classList.add('animate-pulse')
    if (btn) btn.disabled = true

    try {
        const result = await clearUserStorage(userId)

        if (allProfiles[userId]) {
            allProfiles[userId].storage_usage = 0
        }

        if (currentView === 'cloud') renderCloudTable()
        if (currentView === 'users') applyFilters()
        updateStats()

        showToast(`Cleared cloud storage (${result.deletedCount} files deleted)`)
    } catch (err) {
        console.error('[ClearStorage] Error:', err)
        showToast(`Failed to clear storage: ${err.message}`, 'error')
    } finally {
        if (icon) icon.classList.remove('animate-pulse')
        if (btn) btn.disabled = false
    }
}

async function syncUserStorage(userId) {
    const btn = document.getElementById(`sync-btn-${userId}`)
    const icon = document.querySelector(`.sync-icon-${userId}`)
    if (icon) icon.classList.add('animate-spin')
    if (btn) btn.disabled = true

    try {
        const result = await recalculateUserStorage(userId)

        // Update local state
        if (allProfiles[userId]) {
            allProfiles[userId].storage_usage = result.used
        }

        if (currentView === 'cloud') renderCloudTable()
        if (currentView === 'users') applyFilters()
        updateStats()

    } catch (err) {
        console.error('[Sync] Error:', err)
        showToast(`Failed to sync storage: ${err.message}`, 'error')
    } finally {
        if (icon) icon.classList.remove('animate-spin')
        if (btn) btn.disabled = false
    }
}

async function syncAllStorage() {
    const btn = document.getElementById('syncAllBtn')
    const icon = btn ? btn.querySelector('i') : null
    if (icon) icon.classList.add('animate-spin')
    if (btn) btn.disabled = true

    const userIds = Object.keys(allProfiles)
    let successCount = 0

    for (const uid of userIds) {
        try {
            await syncUserStorage(uid)
            successCount++
        } catch (e) {
            console.warn(`[SyncAll] Failed for ${uid}:`, e)
        }
    }

    if (icon) icon.classList.remove('animate-spin')
    if (btn) btn.disabled = false
    showToast(`Sync complete! Updated ${successCount} users.`)
}

// ── ANNOUNCEMENTS LOGIC ──
async function saveAnnouncement(e) {
    e.preventDefault()
    const id = document.getElementById('announcementId').value
    const payload = {
        title: document.getElementById('annTitle').value,
        type: document.getElementById('annType').value,
        content: document.getElementById('annContent').value,
        is_active: document.getElementById('annActive').checked
    }

    let res
    if (id) {
        res = await db.from('announcements').update(payload).eq('id', id)
    } else {
        res = await db.from('announcements').insert([payload])
    }

    if (res.error) {
        showToast('Error saving: ' + res.error.message, 'error')
    } else {
        showToast('Announcement saved')
        resetAnnForm()
        fetchData()
    }
}

function renderAnnouncements() {
    const list = document.getElementById('annList')
    const count = document.getElementById('annCount')
    if (!list) return

    if (count) count.textContent = allAnnouncements.length + ' items'

    if (!allAnnouncements.length) {
        list.innerHTML = '<div class="p-12 text-center text-slate-500 font-bold">No announcements created yet.</div>'
        return
    }

    list.innerHTML = allAnnouncements.map(ann => {
        const date = new Date(ann.created_at).toLocaleDateString()
        const typeStyles = {
            info: { color: 'blue', icon: 'info' },
            update: { color: 'green', icon: 'zap' },
            alert: { color: 'pink', icon: 'alert-triangle' }
        }
        const style = typeStyles[ann.type] || typeStyles.info

        return `
            <div class="p-6 hover:bg-white/5 transition-all group relative border-l-4 border-transparent hover:border-${style.color}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex gap-4">
                        <div class="w-10 h-10 rounded-xl bg-${style.color}/10 border-2 border-${style.color}/20 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${style.icon}" class="w-5 h-5 text-${style.color}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-3 mb-1">
                                <h3 class="font-heading text-white tracking-tight">${escapeHtml(ann.title)}</h3>
                                <span class="chip bg-${style.color}/10 text-${style.color} border-${style.color}/20">${escapeHtml(ann.type)}</span>
                                ${!ann.is_active ? '<span class="chip bg-slate-800 text-slate-500 border-slate-700">DRAFT</span>' : ''}
                            </div>
                            <p class="text-sm text-slate-400 leading-relaxed max-w-2xl whitespace-pre-wrap">${escapeHtml(ann.content)}</p>
                            <div class="flex items-center gap-4 mt-4">
                                <div class="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                                    <i data-lucide="calendar" class="w-3 h-3"></i>
                                    ${date}
                                </div>
                                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onclick="editAnnouncement('${ann.id}')" class="text-[10px] font-black text-blue hover:underline uppercase tracking-widest">Modify</button>
                                    <span class="text-slate-700">|</span>
                                    <button onclick="openDeleteModal('${ann.id}', 'announcement')" class="text-[10px] font-black text-pink hover:underline uppercase tracking-widest">Terminate</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    }).join('')
    lucide.createIcons({ root: list })
}

function editAnnouncement(id) {
    const ann = allAnnouncements.find(a => a.id === id)
    if (!ann) return
    document.getElementById('announcementId').value = ann.id
    document.getElementById('annTitle').value = ann.title
    document.getElementById('annType').value = ann.type
    document.getElementById('annContent').value = ann.content
    document.getElementById('annActive').checked = ann.is_active
    window.scrollTo({ top: 0, behavior: 'smooth' })
}


function resetAnnForm() {
    const form = document.getElementById('announcementForm')
    const id = document.getElementById('announcementId')
    if (form) form.reset()
    if (id) id.value = ''
}

// ── MY SPACE TASKS VIEW ──
function renderTasksTable(filteredTasks) {
    const body = document.getElementById('tasksTableBody')
    if (!body) return

    if (!filteredTasks) {
        const excludedIds = getExcludedUserIds()
        filteredTasks = allMySpaceTasks.filter(task => !excludedIds.includes(task.user_id))
    }

    if (!filteredTasks.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No tasks found</td></tr>'
        return
    }

    body.innerHTML = filteredTasks.map(task => {
        const profile = allProfiles[task.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const statusColor = task.completed ? 'green' : (task.priority === 'high' ? 'pink' : 'blue')
        const statusLabel = task.completed ? 'Completed' : (task.priority || 'Medium')

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
                    <span class="font-bold text-white text-sm">${escapeHtml(name)}</span>
                </div>
            </td>
            <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(task.text)}</span></td>
            <td class="px-5 py-3"><span class="chip bg-slate-700 text-slate-400 border-slate-600">${escapeHtml(task.category || 'General')}</span></td>
            <td class="px-5 py-3"><span class="chip bg-${statusColor}/10 text-${statusColor} border-${statusColor}/30">${escapeHtml(statusLabel)}</span></td>
            <td class="px-5 py-3 text-right">
                <button onclick="openTaskModal('${task.id}')" class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i>
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

function openTaskModal(id) {
    const task = allMySpaceTasks.find(t => t.id === id)
    if (!task) return
    const profile = allProfiles[task.user_id]
    document.getElementById('viewModalTitle').textContent = `Task Detail — ${profile?.display_name || 'User'}`
    document.getElementById('viewModalSub').textContent = `ID: ${task.id} · Created: ${new Date(task.created_at).toLocaleString()}`
    document.getElementById('viewModalContent').innerHTML = `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${JSON.stringify(task, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    document.getElementById('viewModalBg').classList.remove('hidden')
}

// ── MY CLASS VIEW ──
function renderMyClassTable(filteredMyClass) {
    const body = document.getElementById('myclassTableBody')
    if (!body) return

    if (!filteredMyClass) {
        const excludedIds = getExcludedUserIds()
        filteredMyClass = allMyClass.filter(cls => !excludedIds.includes(cls.user_id))
    }

    if (!filteredMyClass.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No class records found</td></tr>'
        return
    }

    body.innerHTML = filteredMyClass.map(cls => {
        const profile = allProfiles[cls.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const updated = cls.updated_at ? new Date(cls.updated_at).toLocaleDateString() : '—'

        const d = typeof cls.data === 'string'
            ? (() => { try { return JSON.parse(cls.data); } catch (e) { return {}; } })()
            : (cls.data || {})
        const stuCount = Array.isArray(d.students) ? d.students.length : 0
        const logDays = d.logs && typeof d.logs === 'object' ? Object.keys(d.logs).length : 0
        const refDays = d.reflections && typeof d.reflections === 'object' ? Object.keys(d.reflections).length : 0

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
                    <span class="font-bold text-white text-sm">${escapeHtml(name)}</span>
                </div>
            </td>
            <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(cls.class_name)}</span></td>
            <td class="px-5 py-3">
                <div class="flex flex-wrap gap-1.5">
                    <span class="chip bg-green/10 text-green border-green/30">${stuCount} student${stuCount === 1 ? '' : 's'}</span>
                    ${logDays > 0 ? `<span class="chip bg-blue/10 text-blue border-blue/30">${logDays} log day${logDays === 1 ? '' : 's'}</span>` : ''}
                    ${refDays > 0 ? `<span class="chip bg-orange/10 text-orange border-orange/30">${refDays} refl</span>` : ''}
                </div>
            </td>
            <td class="px-5 py-3 text-xs text-slate-500 font-mono">${updated}</td>
            <td class="px-5 py-3 text-right">
                <button onclick="openMyClassRowModal('${cls.id}')" class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

function openMyClassRowModal(id) {
    const cls = allMyClass.find(c => c.id === id)
    if (!cls) return
    const profile = allProfiles[cls.user_id]
    document.getElementById('viewModalTitle').textContent = `Class Data — ${cls.class_name}`
    document.getElementById('viewModalSub').textContent = `Teacher: ${profile?.display_name || 'Unknown'} · Updated: ${new Date(cls.updated_at).toLocaleString()}`
    document.getElementById('viewModalContent').innerHTML = `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${JSON.stringify(cls.data, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    document.getElementById('viewModalBg').classList.remove('hidden')
}

// ── STUDIO, MAKERS & WORKSHOP VIEW ──
function buildStudioItemsList(excludedIds) {
    const items = []

    allSpreadsheets.forEach(s => {
        const uid = s.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: s.id,
            table: 'spreadsheets',
            user_id: uid,
            tool_key: 'spreadsheet',
            type_label: 'Spreadsheet',
            color: 'blue',
            title: s.title || s.name || 'Untitled Spreadsheet',
            ts: parseTimestampMs(s.updated_at || s.created_at)
        })
    })

    allCardMaker.forEach(c => {
        const uid = c.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: c.id,
            table: 'tools_cardmaker',
            user_id: uid,
            tool_key: 'card-maker',
            type_label: 'Card Maker Set',
            color: 'pink',
            title: c.name || c.title || 'Card Set',
            ts: parseTimestampMs(c.last_used || c.updated_at || c.created_at)
        })
    })

    allPuzzleMaker.forEach(p => {
        const uid = p.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: p.id,
            table: 'tools_puzzlemaker',
            user_id: uid,
            tool_key: 'puzzle-maker',
            type_label: 'Puzzle Maker Set',
            color: 'orange',
            title: p.name || p.title || 'Puzzle Set',
            ts: parseTimestampMs(p.last_used || p.updated_at || p.created_at)
        })
    })

    allWorksheetMaker.forEach(w => {
        const uid = w.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: w.id,
            table: 'tools_worksheetmaker',
            user_id: uid,
            tool_key: 'worksheet-maker',
            type_label: 'Worksheet Set',
            color: 'green',
            title: w.name || w.title || 'Worksheet',
            ts: parseTimestampMs(w.last_used || w.updated_at || w.created_at)
        })
    })

    allLessonParser.forEach(l => {
        const uid = l.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: l.id,
            table: 'workshop_lessonparser',
            user_id: uid,
            tool_key: 'lesson-parser',
            type_label: `Lesson Parser (${l.subject || 'Unit'})`,
            color: 'pink',
            title: l.name || l.unit_title || 'Lesson Unit',
            ts: parseTimestampMs(l.last_used || l.updated_at || l.created_at)
        })
    })

    allToolsDnd.forEach(d => {
        const uid = d.user_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: d.id,
            table: 'tools_dnd',
            user_id: uid,
            tool_key: 'dnd-hub',
            type_label: `D&D (${d.tool_type || d.type || 'Item'})`,
            color: 'orange',
            title: d.name || d.title || 'D&D Record',
            ts: parseTimestampMs(d.last_used || d.updated_at || d.created_at)
        })
    })

    allVttMaps.forEach(m => {
        const uid = m.user_id || m.owner_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: m.id,
            table: 'vtt_maps',
            user_id: uid,
            tool_key: 'dnd-hub',
            type_label: 'VTT Map',
            color: 'green',
            title: m.name || m.title || 'Battlemap',
            ts: parseTimestampMs(m.updated_at || m.created_at)
        })
    })

    allVttCampaigns.forEach(c => {
        const uid = c.user_id || c.owner_id || ''
        if (!uid || excludedIds.includes(uid)) return
        items.push({
            id: c.id,
            table: 'vtt_campaigns',
            user_id: uid,
            tool_key: 'dnd-hub',
            type_label: 'VTT Campaign',
            color: 'blue',
            title: c.name || c.title || 'Campaign',
            ts: parseTimestampMs(c.updated_at || c.created_at)
        })
    })

    return items.sort((a, b) => b.ts - a.ts)
}

function renderStudioTable(items) {
    const body = document.getElementById('studioTableBody')
    if (!body) return

    if (!items) {
        items = buildStudioItemsList(getExcludedUserIds())
    }

    if (!items.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No studio, maker, or workshop items found</td></tr>'
        return
    }

    body.innerHTML = items.map(item => {
        const profile = allProfiles[item.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const dateStr = item.ts ? new Date(item.ts).toLocaleString() : '—'

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-${item.color}/20 border-2 border-${item.color}/30 flex items-center justify-center text-${item.color} text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
                    <div>
                        <div class="font-bold text-white text-sm">${escapeHtml(name)}</div>
                        <div class="font-mono text-[10px] text-slate-600">${escapeHtml(item.user_id.slice(0, 8))}...</div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3">
                <span class="chip bg-${item.color}/10 text-${item.color} border-${item.color}/30">${escapeHtml(item.type_label)}</span>
            </td>
            <td class="px-5 py-3">
                <span class="font-bold text-slate-200">${escapeHtml(item.title)}</span>
            </td>
            <td class="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">${dateStr}</td>
            <td class="px-5 py-3 text-right">
                <button onclick="openStudioModal('${item.table}', '${item.id}')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> Inspect
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

async function openStudioModal(table, id) {
    document.getElementById('viewModalTitle').textContent = `Inspecting ${table}…`
    document.getElementById('viewModalSub').textContent = `ID: ${id}`
    document.getElementById('viewModalContent').innerHTML = '<div class="text-slate-400 text-xs font-mono">Loading full payload from Supabase…</div>'
    document.getElementById('viewModalBg').classList.remove('hidden')

    const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle()
    if (error || !data) {
        document.getElementById('viewModalContent').innerHTML = `<div class="text-pink text-xs font-mono">Failed to load record: ${escapeHtml(error?.message || 'Record not found')}</div>`
        return
    }
    const uid = data.user_id || data.owner_id
    const profile = allProfiles[uid]
    const title = data.title || data.unit_title || data.name || id
    document.getElementById('viewModalTitle').textContent = `${title} (${table})`
    document.getElementById('viewModalSub').textContent = `Owner: ${profile?.display_name || uid || 'Unknown'}`
    document.getElementById('viewModalContent').innerHTML = `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${JSON.stringify(data, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeViewModal(); closeDeleteModal() }
})

init()
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
let scheduleClassTab = 'admin'
let charts = {}
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
// ── FETCH ──
async function fetchData() {
    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.add('animate-spin'))

    const [progressRes, notesRes, profilesRes, quotasRes, schedEventsRes, classAdminRes, classUnitsRes, redDaysRes, noteFoldersRes, myClassRes, tasksRes] = await Promise.all([
        db.from('user_progress').select('*').order('updated_at', { ascending: false }),
        db.from('notes').select('*').order('updated_at', { ascending: false }),
        db.from('profiles').select('*'),
        db.from('storage_quotas').select('*'),
        db.from('myspace_events').select('id,user_id,name,type_id,color,date,recurrence,recurrence_days,graduation_class,is_master,created_at').eq('is_master', true).order('date', { ascending: false }),
        db.from('myspace_class_admin').select('*').order('created_at', { ascending: false }),
        db.from('myspace_class_units').select('*').order('created_at', { ascending: false }),
        db.from('myspace_settings').select('*'),
        db.from('note_folders').select('*'),
        db.from('myspace_my_class').select('*').order('updated_at', { ascending: false }),
        db.from('myspace_tasks').select('*').order('updated_at', { ascending: false })
    ])

    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.remove('animate-spin'))
    const lastRefreshed = document.getElementById('lastRefreshed')
    if (lastRefreshed) lastRefreshed.textContent = 'Updated ' + new Date().toLocaleTimeString()

    if (progressRes.error) { console.error(progressRes.error); return }

    const quotaMap = {}
    quotasRes.data?.forEach(q => { quotaMap[q.user_id] = q })

    allProfiles = {}
    profilesRes.data?.forEach(p => {
        const quota = quotaMap[p.id] || {}
        allProfiles[p.id] = {
            ...p,
            storage_usage: quota.storage_usage || 0,
            storage_limit: quota.storage_limit || 10485760,
            last_active_ts: p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : 0)
        }
    })
    allProgress = progressRes.data || []
    allNotes = notesRes.data || []
    allMyClass = myClassRes.data || []
    allMySpaceTasks = tasksRes.data || []

    allScheduleEvents = schedEventsRes.data || []
    allClassAdmin = classAdminRes.data || []
    allClassUnits = classUnitsRes.data || []
    allRedDays = {}
    redDaysRes.data?.forEach(r => { allRedDays[r.user_id] = r.dates || [] })
    allNoteFolders = {}
    noteFoldersRes.data?.forEach(f => { allNoteFolders[f.user_id] = f.folders || [] })

    // Pre-calculate latest activity from progress
    allProgress.forEach(r => {
        const ts = new Date(r.updated_at).getTime()
        if (allProfiles[r.user_id] && ts > allProfiles[r.user_id].last_active_ts) {
            allProfiles[r.user_id].last_active_ts = ts
        }
    })

    // Fetch Games Registry for categories
    const gamesRes = await fetch('../games.json')
    const gamesData = await gamesRes.json()
    const toolCategoryMap = {}
    const catDisplayNames = {
        'myspace': 'My Space',
        'tool': 'Tools',
        'workshop': 'Workshop',
        'game': 'Games'
    }
    gamesData.games.forEach(g => {
        toolCategoryMap[g.id] = catDisplayNames[g.category] || 'Tools'
    })
    window.toolCategoryMap = toolCategoryMap

    // Fetch Announcements
    const annRes = await db.from('announcements').select('*').order('created_at', { ascending: false })
    allAnnouncements = annRes.data || []

    updateStats()
    populateToolFilter()
    applyFilters()
    renderAnnouncements()
    if (currentView === 'cloud') renderCloudTable()
    renderExcludedUserPicker()
    showToast('Data refreshed')
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
        <span class="text-sm font-bold">${msg}</span>
    `
    container.appendChild(toast)
    lucide.createIcons()
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
    // Format name: replace hyphens with spaces and capitalize words
    const displayName = toolKey
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

    // Determine category
    const toolMap = window.toolCategoryMap || {}
    let cat = toolMap[toolKey]
    if (!cat) {
        if (toolKey.includes('game') || toolKey.includes('quiz') || toolKey === 'card-match' || toolKey === 'card-memory' || toolKey === 'connect-four') cat = 'Games'
        else if (toolKey.includes('note') || toolKey.includes('schedule') || toolKey.includes('admin') || toolKey === 'my-class') cat = 'My Space'
        else if (toolKey.includes('factory') || toolKey.includes('generator') || toolKey.includes('maker')) cat = 'Workshop'
        else cat = 'Tools'
    }

    const categories = {
        'My Space': { color: '#ff7e33', icon: 'layout' },
        'Tools': { color: '#1ea7fd', icon: 'settings' },
        'Workshop': { color: '#ff4785', icon: 'wrench' },
        'Games': { color: '#00d063', icon: 'gamepad-2' }
    }

    return {
        name: displayName,
        category: cat,
        color: categories[cat]?.color || '#1ea7fd',
        icon: categories[cat]?.icon || 'settings'
    }
}

// ── LOG ENTRY EXTRACTOR ──
// user_progress is an upsert table (1 row per user+tool). The actual history of
// individual interactions is stored as an array inside row.data. This function
// extracts those entries so charts and logs reflect real activity timestamps
// instead of the ever-shifting updated_at timestamp on the upsert row.
function extractLogEntries(row) {
    const entries = []
    const fallbackTs = new Date(row.created_at || row.updated_at)
    const data = row.data
    let items = null

    if (Array.isArray(data)) {
        items = data
    } else if (data && typeof data === 'object') {
        // Find the most-populated array property — that's the log/history/items list
        let best = null
        for (const val of Object.values(data)) {
            if (Array.isArray(val) && (!best || val.length > best.length)) {
                best = val
            }
        }
        items = best
    }

    if (items && items.length > 0) {
        for (const item of items) {
            if (!item || typeof item !== 'object') {
                entries.push({ user_id: row.user_id, tool_key: row.tool_key, timestamp: fallbackTs })
                continue
            }
            // Check common timestamp field names tools might use
            const rawTs = item.created_at ?? item.createdAt ?? item.timestamp
                ?? item.date ?? item.savedAt ?? item.updated_at ?? item.time
            let ts = fallbackTs
            if (rawTs !== undefined && rawTs !== null) {
                const num = Number(rawTs)
                const parsed = !isNaN(num) && num > 0 ? new Date(num) : new Date(rawTs)
                if (!isNaN(parsed.getTime())) ts = parsed
            }
            entries.push({ user_id: row.user_id, tool_key: row.tool_key, timestamp: ts })
        }
    }

    // Fallback: no array found — treat the row itself as one entry anchored to created_at
    if (entries.length === 0) {
        entries.push({ user_id: row.user_id, tool_key: row.tool_key, timestamp: fallbackTs })
    }

    return entries
}

function updateStats() {
    const excludedIds = getExcludedUserIds()

    // Data filtered for metrics (excluding test users)
    const metricsProgress = allProgress.filter(r => !excludedIds.includes(r.user_id))
    const metricsNotes = allNotes.filter(n => !excludedIds.includes(n.user_id))
    const metricsProfiles = Object.fromEntries(Object.entries(allProfiles).filter(([id]) => !excludedIds.includes(id)))
    const metricsSched = allScheduleEvents.filter(e => !excludedIds.includes(e.user_id))
    const metricsClasses = allClassAdmin.filter(c => !excludedIds.includes(c.user_id))

    const uniqueTools = new Set([...metricsProgress.map(r => r.tool_key), ...metricsNotes.map(n => 'lesson-note')]).size
    const latestProgress = metricsProgress[0]?.updated_at ? new Date(metricsProgress[0].updated_at).getTime() : 0
    const latestNote = metricsNotes[0]?.updated_at ? (Number(metricsNotes[0].updated_at) || 0) : 0
    const latest = Math.max(latestProgress, latestNote)
        ? new Date(Math.max(latestProgress, latestNote)).toLocaleDateString()
        : '—'

    const statUsers = document.getElementById('statUsers')
    if (statUsers) statUsers.textContent = Object.keys(metricsProfiles).length
    const proCount = Object.values(metricsProfiles).filter(p => p.role === 'pro').length
    const statPro = document.getElementById('statPro')
    if (statPro) statPro.textContent = proCount
    const statProBar = document.getElementById('statProBar')
    if (statProBar) {
        const total = Object.keys(metricsProfiles).length || 1
        const percent = Math.min(100, Math.round((proCount / total) * 100))
        statProBar.style.width = `${percent}%`
    }
    // Count total individual log entries across all progress rows, not just unique (user,tool) pairs.
    // user_progress is an upsert table so row count stays flat; the real activity count lives in data[].
    const totalLogEntries = metricsProgress.reduce((sum, r) => sum + extractLogEntries(r).length, 0)
    const statRows = document.getElementById('statRows')
    if (statRows) statRows.textContent = totalLogEntries
    const statNotes = document.getElementById('statNotes')
    if (statNotes) statNotes.textContent = metricsNotes.length
    const statTools = document.getElementById('statTools')
    if (statTools) statTools.textContent = uniqueTools
    const statLatest = document.getElementById('statLatest')
    if (statLatest) statLatest.textContent = latest
    const statEvents = document.getElementById('statEvents')
    if (statEvents) statEvents.textContent = metricsSched.length
    const statClasses = document.getElementById('statClasses')
    if (statClasses) statClasses.textContent = metricsClasses.length

    // Render Top Tools Card
    const topToolsList = document.getElementById('topToolsList')
    const topToolsTitle = document.getElementById('topToolsTitle')
    if (topToolsList) {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const weekToolCounts = {}
        const filteredProgress = metricsProgress.filter(r => r.tool_key !== 'klasskit_hub' && r.tool_key !== 'hub')
        const allLogEntries = filteredProgress.flatMap(r => extractLogEntries(r))

        allLogEntries.forEach(entry => {
            if (entry.timestamp.getTime() >= sevenDaysAgo) {
                weekToolCounts[entry.tool_key] = (weekToolCounts[entry.tool_key] || 0) + 1
            }
        })
        metricsNotes.forEach(n => {
            const ts = Number(n.updated_at) || 0
            if (ts >= sevenDaysAgo) {
                weekToolCounts['lesson-note'] = (weekToolCounts['lesson-note'] || 0) + 1
            }
        })

        let topTools = Object.entries(weekToolCounts).sort((a, b) => b[1] - a[1])
        let isFallback = false

        // Fallback: If no activity this week, use overall top tools
        if (topTools.length === 0) {
            const allTimeCounts = {}
            allLogEntries.forEach(entry => {
                allTimeCounts[entry.tool_key] = (allTimeCounts[entry.tool_key] || 0) + 1
            })
            metricsNotes.forEach(n => {
                allTimeCounts['lesson-note'] = (allTimeCounts['lesson-note'] || 0) + 1
            })
            topTools = Object.entries(allTimeCounts).sort((a, b) => b[1] - a[1])
            isFallback = true
        }

        if (topToolsTitle) {
            topToolsTitle.textContent = isFallback ? 'Top Tools Overall' : 'Top Tools This Week'
        }

        const sliced = topTools.slice(0, 3)
        if (sliced.length === 0) {
            topToolsList.innerHTML = '<div class="text-center py-6 text-slate-500 font-bold text-xs">No activity yet</div>'
        } else {
            topToolsList.innerHTML = sliced.map(([toolKey, count]) => {
                const meta = getToolMeta(toolKey)
                return `
                    <div class="flex items-center justify-between p-1.5 bg-slate-900/50 rounded-xl border border-slate-700/30">
                        <span class="text-xs text-slate-400 flex items-center gap-1.5">
                            <i data-lucide="${meta.icon}" class="w-3.5 h-3.5" style="color: ${meta.color}"></i> ${meta.name}
                        </span>
                        <span class="text-sm font-bold text-white font-mono">${count} <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wide">saves</span></span>
                    </div>
                `
            }).join('')
            lucide.createIcons({ root: topToolsList })
        }
    }

    // Global Storage Stat
    const totalUsed = Object.values(metricsProfiles).reduce((sum, p) => sum + (p.storage_usage || 0), 0)
    const totalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const statStorage = document.getElementById('statStorage')
    if (statStorage) statStorage.textContent = `${totalUsedMB} MB`

    updateCharts(metricsProgress, metricsNotes, metricsProfiles, metricsSched, metricsClasses)
}

function updateCharts(metricsProgress, metricsNotes, metricsProfiles, metricsSched, metricsClasses) {
    const ctxActivity = document.getElementById('activityChart')?.getContext('2d')
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d')
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')
    const ctxActiveUsers = document.getElementById('activeUsersChart')?.getContext('2d')

    if (!ctxActivity || !ctxCategory || !ctxTools || !ctxActiveUsers) return

    // Filter out system keys like the Hub landing page
    const filteredProgress = metricsProgress.filter(r => r.tool_key !== 'klasskit_hub' && r.tool_key !== 'hub')

    // Build a flat list of individual log entries extracted from each row's data payload.
    // This is the stable source of truth — binning by these timestamps instead of the
    // upsert row's updated_at prevents the charts from shifting every time a user saves.
    const allLogEntries = filteredProgress.flatMap(r => extractLogEntries(r))

    // 1. Activity Line Chart
    const days = 14

    // Helper: local calendar date string YYYY-MM-DD from any date value.
    // Uses local getFullYear/Month/Date (not UTC) so the day aligns with the user's wall clock.
    const getLocalDateKey = (dateVal) => {
        const d = new Date(dateVal)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Build the 14-day window anchored to today's real calendar date.
    // Noon (12:00) is used instead of midnight so DST boundary shifts never flip the date.
    const dateKeys = []
    const activityLabels = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setHours(12, 0, 0, 0)   // noon anchor — immune to DST shifts
        d.setDate(d.getDate() - i)
        dateKeys.push(getLocalDateKey(d))
        activityLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    }

    // Activity chart and DAU chart: bin by each individual log entry's own timestamp.
    // Previously binned by row.updated_at (DAU) which caused bars to shift every day as
    // updated_at moved forward with each save. Log entry timestamps are immutable.
    const activityByDate = {}
    const usersByDate = {}

    allLogEntries.forEach(entry => {
        const key = getLocalDateKey(entry.timestamp)
        activityByDate[key] = (activityByDate[key] || 0) + 1
        if (!usersByDate[key]) usersByDate[key] = new Set()
        usersByDate[key].add(entry.user_id)
    })

    // Fold notes into both charts — notes table has no data[] log, so use updated_at.
    // Notes updated_at is a bigint (unix ms); treat it as creation date for now since
    // notes table has no created_at column. This is an inherent schema limitation.
    metricsNotes.forEach(n => {
        const ts = Number(n.updated_at) || 0
        if (!ts) return
        const key = getLocalDateKey(new Date(ts))
        activityByDate[key] = (activityByDate[key] || 0) + 1
        if (!usersByDate[key]) usersByDate[key] = new Set()
        usersByDate[key].add(n.user_id)
    })

    const activityData = dateKeys.map(k => activityByDate[k] || 0)
    const dauData = dateKeys.map(k => usersByDate[k]?.size || 0)

    // Create gradients for cards
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
                pointRadius: 5,
                pointBackgroundColor: '#020617',
                pointBorderColor: '#1ea7fd',
                pointBorderWidth: 3,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#1ea7fd',
                pointHoverBorderColor: '#020617',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderColor: 'rgba(30, 167, 253, 0.4)',
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
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' } }
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
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderColor: 'rgba(0, 208, 99, 0.4)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y} Unique Users`
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
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' } }
                }
            }
        }
    })

    // 2. Tool Counts & Category Mapping

    const toolCounts = {}
    allLogEntries.forEach(entry => {
        toolCounts[entry.tool_key] = (toolCounts[entry.tool_key] || 0) + 1
    })

    const categories = {
        'My Space': { count: 0, color: '#ff7e33' },
        'Tools': { count: 0, color: '#1ea7fd' },
        'Workshop': { count: 0, color: '#ff4785' },
        'Games': { count: 0, color: '#00d063' }
    }

    // 1. Add direct data from specialized tables (My Space)
    categories['My Space'].count += allNotes.length
    categories['My Space'].count += allScheduleEvents.length
    categories['My Space'].count += allClassAdmin.length
    categories['My Space'].count += allMyClass.length

    // 2. Map progress records using the official registry
    const toolMap = window.toolCategoryMap || {}
    Object.entries(toolCounts).forEach(([key, count]) => {
        // Determine category from registry or fallback to tool-key analysis
        let cat = toolMap[key]
        if (!cat) {
            if (key.includes('game') || key.includes('quiz')) cat = 'Games'
            else if (key.includes('note') || key.includes('schedule') || key.includes('admin')) cat = 'My Space'
            else if (key.includes('factory') || key.includes('generator')) cat = 'Workshop'
            else cat = 'Tools'
        }

        if (categories[cat]) {
            categories[cat].count += count
        } else {
            categories['Tools'].count += count
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
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '78%',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
                const { width, height, ctx } = chart;
                ctx.restore();
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

                ctx.font = '700 28px Fredoka';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                const text = total.toLocaleString();
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 2 - 12;
                ctx.fillText(text, textX, textY);

                ctx.font = '800 11px Nunito';
                ctx.fillStyle = '#94a3b8';
                const subText = 'TOTAL ACTIONS';
                const subTextX = Math.round((width - ctx.measureText(subText).width) / 2);
                const subTextY = height / 2 + 18;
                ctx.fillText(subText, subTextX, subTextY);
                ctx.save();
            }
        }]
    })

    // 3. Top Tools Bar Chart
    const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    
    // Create gradient for tools chart
    const orangeGradient = ctxTools.createLinearGradient(0, 0, ctxTools.canvas.clientWidth || 300, 0)
    orangeGradient.addColorStop(0, 'rgba(255, 126, 51, 0.8)')
    orangeGradient.addColorStop(1, 'rgba(255, 126, 51, 0.2)')

    if (charts.tools) charts.tools.destroy()
    charts.tools = new Chart(ctxTools, {
        type: 'bar',
        data: {
            labels: sortedTools.map(t => t[0]),
            datasets: [{
                label: 'Saves',
                data: sortedTools.map(t => t[1]),
                backgroundColor: orangeGradient,
                borderColor: '#020617',
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderColor: 'rgba(255, 126, 51, 0.4)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)', borderDash: [5, 5] },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' } }
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

    // Breakdown List
    const breakdownEl = document.getElementById('toolBreakdown')
    if (breakdownEl) {
        const total = allLogEntries.length || 1
        const toolMap = window.toolCategoryMap || {}

        breakdownEl.innerHTML = sortedTools.map(([key, count]) => {
            const percent = Math.round((count / total) * 100)
            let cat = toolMap[key] || 'Tools'
            const catColor = categories[cat]?.color || '#2979FF'

            return `
                <div class="group p-2 hover:bg-slate-700/30 rounded-xl transition-colors cursor-default">
                    <div class="flex items-center justify-between text-[10px] mb-1.5">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full" style="background: ${catColor}"></div>
                            <span class="font-black text-white uppercase tracking-wider">${key}</span>
                        </div>
                        <span class="text-slate-500 font-mono font-bold">${count} saves</span>
                    </div>
                    <div class="h-2 bg-slate-900 border border-slate-700 rounded-full overflow-hidden p-[1px]">
                        <div class="h-full rounded-full transition-all duration-1000" style="width: ${percent}%; background: ${catColor}"></div>
                    </div>
                </div>`
        }).join('')
    }
}

// ── FILTERS ──
function populateToolFilter() {
    const tools = [...new Set([...allProgress.map(r => r.tool_key), 'lesson-note'])].sort()
    const sel = document.getElementById('toolFilter')
    if (!sel) return
    sel.innerHTML = '<option value="">All tools</option>' +
        tools.map(t => `<option value="${t}">${t}</option>`).join('')
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.toLowerCase() : ''
    const tool = toolFilter ? toolFilter.value : ''
    const excludedIds = getExcludedUserIds()

    let filteredRows = allProgress.filter(r => {
        if (excludedIds.includes(r.user_id)) return false
        const name = (allProfiles[r.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || r.user_id.toLowerCase().includes(search)
            || r.tool_key.toLowerCase().includes(search)
        const matchTool = !tool || r.tool_key === tool
        return matchSearch && matchTool
    })

    let filteredUserIds = Object.keys(allProfiles).filter(uid => {
        if (excludedIds.includes(uid)) return false
        const name = (allProfiles[uid]?.display_name || '').toLowerCase()
        const matchSearch = !search || name.includes(search) || uid.toLowerCase().includes(search)
        const hasUsedTool = !tool || allProgress.some(r => r.user_id === uid && r.tool_key === tool) || (tool === 'lesson-note' && allNotes.some(n => n.user_id === uid))
        return matchSearch && hasUsedTool
    })

    let filteredNotes = allNotes.filter(n => {
        if (excludedIds.includes(n.user_id)) return false
        const name = (allProfiles[n.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || n.user_id.toLowerCase().includes(search)
            || (n.title || '').toLowerCase().includes(search)
        const matchTool = !tool || tool === 'lesson-note'
        return matchSearch && matchTool
    })

    let filteredScheduleEvents = allScheduleEvents.filter(e => !excludedIds.includes(e.user_id))
    let filteredClassAdmin = allClassAdmin.filter(c => !excludedIds.includes(c.user_id))

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
        classes: filteredClassAdmin.length
    }

    renderUsersTable(pagedUserIds, filteredRows)
    renderProgressTable(pagedRows)
    renderNotesTable(pagedNotes)
    renderScheduleTable(pagedSched)
    renderClassesView(pagedClasses, filteredClassUnits)
    renderTasksTable(filteredMySpaceTasks)
    renderMyClassTable(filteredMyClass)
    updateSortIcons()

    const userCount = document.getElementById('userCount')
    if (userCount) userCount.textContent = filteredUserIds.length + ' users'
    const progressCount = document.getElementById('progressCount')
    if (progressCount) progressCount.textContent = filteredRows.length + ' rows'
    const notesCount = document.getElementById('notesCount')
    if (notesCount) notesCount.textContent = filteredNotes.length + ' notes'
    const filteredClassUnits = allClassUnits.filter(u => !excludedIds.includes(u.user_id))
    const filteredMySpaceTasks = allMySpaceTasks.filter(t => !excludedIds.includes(t.user_id))
    const filteredMyClass = allMyClass.filter(c => !excludedIds.includes(c.user_id))

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
    const byUser = {}
    userIds.forEach(uid => { byUser[uid] = { rows: [], latest: 0 } })

    rows.forEach(r => {
        if (byUser[r.user_id]) {
            byUser[r.user_id].rows.push(r)
            const rowTs = r.updated_at ? new Date(r.updated_at).getTime() : 0
            if (rowTs > byUser[r.user_id].latest) byUser[r.user_id].latest = rowTs
        }
    })

    const body = document.getElementById('usersTableBody')
    if (!body) return
    if (!userIds.length) {
        body.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-slate-500 font-bold">No users found</td></tr>'
        return
    }

    body.innerHTML = userIds.map(uid => {
        const info = byUser[uid]
        const profile = allProfiles[uid]
        const name = profile?.display_name || '—'
        const role = profile?.role || 'user'
        const tools = [...new Set(info.rows.map(r => r.tool_key))]
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

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm flex-shrink-0 ${avatarClass}">${initial}</div>
              <div>
                <span class="font-bold text-white">${name}</span>
                ${isPro ? '<span class="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange/20 border border-orange/40 text-[9px] font-black text-orange uppercase tracking-wider">⭐ Pro</span>' : ''}
              </div>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3"><span class="font-mono text-xs text-slate-500">${uid.slice(0, 12)}...</span></td>
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
            ${tools.length === 0 ? '<span class="text-xs text-slate-500 italic">No activity yet</span>' :
                `<div class="flex flex-wrap gap-1">
              ${tools.map(t => `<span class="chip bg-blue/10 text-blue border-blue/30">${t}</span>`).join('')}
            </div>`}
          </td>
          <td class="px-5 py-3 text-xs text-slate-500">${date}</td>
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
        const preview = JSON.stringify(row.data).slice(0, 60) + '…'
        const date = new Date(row.updated_at).toLocaleString()
        const initial = name[0]?.toUpperCase() || '?'

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${row.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-orange/10 text-orange border-orange/30">${row.tool_key}</span>
          </td>
          <td class="hidden md:table-cell px-5 py-3 max-w-[200px]">
            <code class="text-[10px] text-slate-500 truncate block">${preview}</code>
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
    lucide.createIcons()
}

// ── NOTES TABLE ──
function renderNotesTable(rows) {
    const body = document.getElementById('notesTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500 font-bold">No notes found</td></tr>'
        return
    }

    body.innerHTML = rows.map(note => {
        const profile = allProfiles[note.user_id]
        const name = profile?.display_name || '—'
        // updated_at is a bigint (unix ms) in notes table
        const ts = Number(note.updated_at)
        const date = ts ? new Date(ts).toLocaleString() : '—'
        const initial = name[0]?.toUpperCase() || '?'
        // Resolve folder name from allNoteFolders
        let folderName = '—'
        if (note.folder_id) {
            const userFolders = allNoteFolders[note.user_id] || []
            const folder = userFolders.find(f => f.id === note.folder_id)
            if (folder) folderName = folder.name || folder.id
        }

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${note.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="font-bold text-slate-200">${note.title || 'Untitled'}</span>
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${note.folder_id ? `<span class="chip bg-orange/10 text-orange border-orange/30">${folderName}</span>` : '<span class="text-xs text-slate-600 italic">Root</span>'}
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
    lucide.createIcons()
}

// ── SCHEDULE EVENTS TABLE ──
function renderScheduleTable(rows) {
    const body = document.getElementById('scheduleTableBody')
    if (!body) return
    if (!rows || !rows.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500 font-bold">No schedule events found</td></tr>'
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
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${ev.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${ev.color || '#FF8C42'}"></div>
              <span class="font-bold text-slate-200">${ev.name}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-blue/10 text-blue border-blue/30">${ev.type_id || 'other'}</span>
          </td>
          <td class="px-5 py-3 text-xs text-slate-300 whitespace-nowrap font-mono">${ev.date || '—'}</td>
          <td class="hidden md:table-cell px-5 py-3">
            <span class="chip ${isRecurring ? 'bg-orange/10 text-orange border-orange/30' : 'bg-slate-700 text-slate-400 border-slate-600'}">${recLabel}</span>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons()
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
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
                  <span class="font-bold text-white text-sm">${name}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${cls.class_name}</span></td>
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
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
                  <span class="font-bold text-white text-sm">${name}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${cls.class_name}</span></td>
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
    const tabs = ['progress', 'notes', 'schedule', 'classes', 'tasks', 'myclass']
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

    document.getElementById('viewModalTitle').textContent =
        (profile?.display_name || userId.slice(0, 8)) + ' — ' + toolKey
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
    const userClasses = allMyClass.filter(c => c.user_id === userId);
    const userEvents = allScheduleEvents.filter(e => e.user_id === userId);

    const formatTs = (ts) => ts ? new Date(ts).toLocaleString() : '—';

    const toolCounts = {};
    const toolOrder = [];
    userProgress.forEach(r => {
        if (!toolCounts[r.tool_key]) {
            toolCounts[r.tool_key] = 0;
            toolOrder.push(r.tool_key);
        }

        // Count instances within the data payload
        let count = 1;
        if (Array.isArray(r.data)) {
            count = r.data.length;
        } else if (r.data && typeof r.data === 'object') {
            // Find the first array property which usually contains the items
            const arrayVal = Object.values(r.data).find(v => Array.isArray(v));
            if (arrayVal) {
                count = arrayVal.length;
            } else {
                count = Object.keys(r.data).length;
            }
        }
        toolCounts[r.tool_key] += count;
    });

    let html = `
        <div class="space-y-6 text-slate-300">
            <div class="grid grid-cols-2 gap-4">
                <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                    <div class="text-[10px] text-slate-500 uppercase font-black mb-1">Email / Auth</div>
                    <div class="text-sm text-white font-bold">${email}</div>
                </div>
                <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                    <div class="text-[10px] text-slate-500 uppercase font-black mb-1">User ID</div>
                    <div class="text-xs text-slate-400 font-mono break-all">${userId}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-2xl font-heading text-blue mb-1">${userProgress.length}</div>
                    <div class="text-[10px] uppercase font-bold text-slate-400">Tool Saves</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-2xl font-heading text-orange mb-1">${userNotes.length}</div>
                    <div class="text-[10px] uppercase font-bold text-slate-400">Notes</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-2xl font-heading text-green mb-1">${userClasses.length}</div>
                    <div class="text-[10px] uppercase font-bold text-slate-400">Classes</div>
                </div>
                <div class="neo bg-slate-800 p-3 text-center border-2 border-slate-600">
                    <div class="text-2xl font-heading text-pink mb-1">${userEvents.length}</div>
                    <div class="text-[10px] uppercase font-bold text-slate-400">Events</div>
                </div>
            </div>

            <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2"><i data-lucide="grid-2x2" class="w-4 h-4 text-blue"></i> Tools Activity</h3>
                ${toolOrder.length ? `
                <div class="flex flex-wrap gap-2">
                    ${toolOrder.map(k => `<span class="chip bg-blue/10 text-blue border-blue/40">${k} <span class="ml-1 opacity-60">(${toolCounts[k]})</span></span>`).join('')}
                </div>
                ` : '<div class="text-xs text-slate-500 italic">No tool activity</div>'}
            </div>
            
            <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-orange"></i> Recent Notes</h3>
                ${userNotes.length ? `
                <ul class="space-y-2 text-xs">
                    ${userNotes.slice(0, 5).map(n => `<li class="flex justify-between items-center border-b border-slate-800 pb-2"><span class="font-bold text-slate-300 truncate mr-4">${n.title || 'Untitled'}</span><span class="text-slate-500 font-mono whitespace-nowrap">${formatTs(Number(n.updated_at))}</span></li>`).join('')}
                </ul>
                ` : '<div class="text-xs text-slate-500 italic">No notes</div>'}
            </div>
        </div>
    `;

    const roleLabel = role === 'pro' ? '⭐ PRO USER' : role === 'admin' ? '🛡️ ADMIN' : '👤 USER';
    document.getElementById('viewModalTitle').textContent = name + ' — Profile Details';
    document.getElementById('viewModalSub').textContent = 'Role: ' + roleLabel;
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

    // Extract individual log entries from every progress row's data payload and merge them
    // into a single flat log sorted newest-first. This gives a true chronological audit
    // trail instead of just showing the latest upsert timestamp per (user, tool) row.
    const logEntries = allProgress
        .filter(r => !excludedIds.includes(r.user_id))
        .flatMap(r => extractLogEntries(r))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 200)

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

        return `<tr class="group transition-all hover:bg-white/5 border-l-4 border-transparent hover:border-blue">
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-white font-mono text-xs">${time}</span>
                    <span class="text-[9px] text-slate-600 font-mono">${date}</span>
                </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-blue group-hover:text-blue transition-colors">${initial}</div>
                <div class="flex flex-col">
                    <span class="text-white font-bold text-xs tracking-tight">${name}</span>
                    <span class="text-[9px] text-slate-500 font-mono">UID: ${entry.user_id.slice(0, 8)}</span>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-blue shadow-[0_0_8px_rgba(30,167,253,0.5)]"></div>
                <span class="text-slate-300 font-black text-[10px] uppercase tracking-widest">Save_Log_Entry</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="chip bg-slate-900 text-blue border-slate-800 group-hover:border-blue/30 transition-colors">${entry.tool_key}</span>
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
    // Trigger re-render of stats to apply new exclusion
    updateStats()
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
            <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${initial}</div>
            <span class="text-sm text-white font-bold">${escapeHtml(name)}</span>
            <span class="text-[10px] text-slate-600 font-mono ml-auto">${id.slice(0, 8)}...</span>
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
    div.textContent = text
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
    let profiles = Object.values(allProfiles).filter(p => !excludedIds.includes(p.id))

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

    let totalUsed = 0
    let totalLimit = 0

    body.innerHTML = pagedProfiles.map(p => {
        const used = p.storage_usage || 0
        const limit = p.storage_limit || (50 * 1024 * 1024)
        const percent = Math.min(100, Math.round((used / limit) * 100))
        const usedMB = (used / (1024 * 1024)).toFixed(1)
        const limitMB = (limit / (1024 * 1024)).toFixed(0)
        const barColor = percent < 60 ? 'bg-green' : (percent < 85 ? 'bg-orange' : 'bg-pink')
        const name = p.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'

        totalUsed += used
        totalLimit += limit

        return `
            <tr class="group hover:bg-white/5 transition-all">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-slate-800 border-4 border-slate-700 flex items-center justify-center font-heading text-slate-400 group-hover:border-blue group-hover:text-blue transition-colors text-xs flex-shrink-0">${initial}</div>
                        <div>
                            <div class="font-bold text-white text-sm tracking-tight">${name}</div>
                            <div class="text-[9px] text-slate-600 font-mono">NODE_ID: ${p.id.slice(0, 8)}</div>
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
                    <button onclick="syncUserStorage('${p.id}')" id="sync-btn-${p.id}" 
                        class="neo-btn !p-2 !bg-slate-900 !border-2 !border-slate-800 hover:!border-blue transition-all group/btn">
                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-blue sync-icon-${p.id}"></i>
                    </button>
                </td>
            </tr>
        `
    }).join('')

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

    const activeUsers = profiles.filter(p => (p.storage_usage || 0) > 0).length
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
                                <h3 class="font-heading text-white tracking-tight">${ann.title}</h3>
                                <span class="chip bg-${style.color}/10 text-${style.color} border-${style.color}/20">${ann.type}</span>
                                ${!ann.is_active ? '<span class="chip bg-slate-800 text-slate-500 border-slate-700">DRAFT</span>' : ''}
                            </div>
                            <p class="text-sm text-slate-400 leading-relaxed max-w-2xl whitespace-pre-wrap">${ann.content}</p>
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
                    <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${initial}</div>
                    <span class="font-bold text-white text-sm">${name}</span>
                </div>
            </td>
            <td class="px-5 py-3"><span class="font-bold text-slate-200">${task.text}</span></td>
            <td class="px-5 py-3"><span class="chip bg-slate-700 text-slate-400 border-slate-600">${task.category || 'General'}</span></td>
            <td class="px-5 py-3"><span class="chip bg-${statusColor}/10 text-${statusColor} border-${statusColor}/30">${statusLabel}</span></td>
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
        body.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500 font-bold">No class records found</td></tr>'
        return
    }

    body.innerHTML = filteredMyClass.map(cls => {
        const profile = allProfiles[cls.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const updated = new Date(cls.updated_at).toLocaleDateString()

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
                    <span class="font-bold text-white text-sm">${name}</span>
                </div>
            </td>
            <td class="px-5 py-3"><span class="font-bold text-slate-200">${cls.class_name}</span></td>
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

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeViewModal(); closeDeleteModal() }
})

init()
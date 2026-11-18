// KlassKit Admin — Users, Data Details, Studio & Modals

// ── SHARED UI & CLIPBOARD HELPERS ──
function updateSearchClearBtn() {
    const input = document.getElementById('searchInput')
    const btn = document.getElementById('searchClearBtn')
    if (!input || !btn) return
    btn.classList.toggle('hidden', !input.value.trim())
}

function clearSearchInput() {
    const input = document.getElementById('searchInput')
    if (!input) return
    input.value = ''
    updateSearchClearBtn()
    resetPagination()
    applyFilters()
    input.focus()
}

function onToolFilterChange() {
    resetPagination()
    applyFilters()
}

function resetPagination(keys) {
    const targetKeys = keys || ['users', 'progress', 'notes', 'schedule', 'classes', 'classesUnits', 'tasks', 'myclass', 'studio']
    targetKeys.forEach(k => {
        if (k in pagination) pagination[k] = 1
    })
}

async function copyTextToClipboard(text, successMsg = 'Copied to clipboard') {
    const value = text == null ? '' : String(text)
    if (!value) return
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value)
        } else {
            const ta = document.createElement('textarea')
            ta.value = value
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            ta.remove()
        }
        showToast(successMsg)
    } catch (err) {
        console.error('[Copy] Failed:', err)
        showToast('Failed to copy to clipboard', 'error')
    }
}

function setPillGroupActive(prefix, activeKey, keys) {
    keys.forEach(k => {
        const el = document.getElementById(`${prefix}-${k}`)
        if (el) el.classList.toggle('active', k === activeKey)
    })
}

function setUserRoleFilter(role) {
    userRoleFilter = role
    setPillGroupActive('userfilter', role, ['all', 'user', 'pro', 'admin', 'active7d'])
    resetPagination(['users'])
    applyFilters()
}

function setNotesStatusFilter(status) {
    notesStatusFilter = status
    setPillGroupActive('notesfilter', status, ['all', 'active', 'trashed'])
    resetPagination(['notes'])
    applyFilters()
}

function setTasksStatusFilter(status) {
    tasksStatusFilter = status
    setPillGroupActive('tasksfilter', status, ['all', 'pending', 'completed'])
    resetPagination(['tasks'])
    applyFilters()
}

function setStudioTypeFilter(type) {
    studioTypeFilter = type || 'all'
    const sel = document.getElementById('studioTypeFilter')
    if (sel && sel.value !== studioTypeFilter) sel.value = studioTypeFilter
    resetPagination(['studio'])
    applyFilters()
}

function sortItems(items, conf, accessors) {
    const accessor = accessors[conf.col] || accessors._default
    if (!accessor) return items
    return items.sort((a, b) => {
        const valA = accessor(a)
        const valB = accessor(b)
        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })
}

function paginateAndUpdateBar(key, items) {
    const total = items.length
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1
    if (pagination[key] > totalPages) pagination[key] = totalPages
    if (pagination[key] < 1) pagination[key] = 1

    const start = (pagination[key] - 1) * PAGE_SIZE
    const end = Math.min(start + PAGE_SIZE, total)
    const paged = items.slice(start, start + PAGE_SIZE)

    if (!pagination.lastFilteredCounts) pagination.lastFilteredCounts = {}
    pagination.lastFilteredCounts[key] = total

    const infoEl = document.getElementById(`${key}-page-info`)
    if (infoEl) {
        infoEl.textContent = total > 0
            ? `Showing ${start + 1}–${end} of ${total} · Page ${pagination[key]} of ${totalPages}`
            : `0 items · Page 1 of 1`
    }

    const prevBtn = document.getElementById(`${key}-prev-btn`)
    const nextBtn = document.getElementById(`${key}-next-btn`)
    if (prevBtn) {
        const atStart = pagination[key] <= 1
        prevBtn.disabled = atStart
        prevBtn.classList.toggle('opacity-40', atStart)
        prevBtn.classList.toggle('cursor-not-allowed', atStart)
    }
    if (nextBtn) {
        const atEnd = pagination[key] >= totalPages
        nextBtn.disabled = atEnd
        nextBtn.classList.toggle('opacity-40', atEnd)
        nextBtn.classList.toggle('cursor-not-allowed', atEnd)
    }

    return paged
}

const USER_CELL_STYLES = {
    blue: 'bg-blue/20 border-blue/30 text-blue group-hover/user:border-blue',
    orange: 'bg-orange/20 border-orange/30 text-orange group-hover/user:border-orange',
    pink: 'bg-pink/20 border-pink/30 text-pink group-hover/user:border-pink',
    green: 'bg-green/20 border-green/30 text-green group-hover/user:border-green'
}

const CHIP_COLOR_STYLES = {
    blue: 'bg-blue/10 text-blue border-blue/30',
    orange: 'bg-orange/10 text-orange border-orange/30',
    pink: 'bg-pink/10 text-pink border-pink/30',
    green: 'bg-green/10 text-green border-green/30'
}

function escapeJsAttr(val) {
    const jsEscaped = String(val == null ? '' : val)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
    return escapeHtml(jsEscaped).replace(/"/g, '&quot;')
}

function renderUserCell(userId, color = 'blue', showSubId = true) {
    const profile = allProfiles[userId]
    const name = profile?.display_name || '—'
    const initial = name[0]?.toUpperCase() || '?'
    const badgeCls = USER_CELL_STYLES[color] || USER_CELL_STYLES.blue
    return `
        <button type="button" onclick="viewUser('${escapeJsAttr(userId)}')" title="Inspect user profile"
            class="flex items-center gap-2 text-left group/user rounded-lg focus:outline-none">
            <div class="w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-heading flex-shrink-0 transition-colors ${badgeCls}">${escapeHtml(initial)}</div>
            <div class="min-w-0">
                <div class="font-bold text-white text-sm truncate group-hover/user:text-blue transition-colors">${escapeHtml(name)}</div>
                ${showSubId ? `<div class="font-mono text-[10px] text-slate-600">${escapeHtml(userId.slice(0, 8))}...</div>` : ''}
            </div>
        </button>`
}

function formatProgressPreview(data) {
    if (data == null) return 'Empty'
    if (Array.isArray(data)) {
        const named = data.slice(0, 2).map(x => (x && typeof x === 'object' ? (x.name || x.title) : null)).filter(Boolean)
        return named.length
            ? `${data.length} item${data.length === 1 ? '' : 's'} (${named.join(', ')}${data.length > 2 ? '…' : ''})`
            : `${data.length} item${data.length === 1 ? '' : 's'}`
    }
    if (typeof data === 'object') {
        for (const key of SET_COLLECTION_KEYS) {
            if (Array.isArray(data[key])) {
                const arr = data[key]
                const titles = arr.slice(0, 2).map(x => (x && typeof x === 'object' ? (x.name || x.title) : null)).filter(Boolean)
                const suffix = titles.length ? ` (${titles.join(', ')}${arr.length > 2 ? '…' : ''})` : ''
                return `${arr.length} ${key.replace(/_/g, ' ')}${suffix}`
            }
        }
        const keys = Object.keys(data)
        if (!keys.length) return 'Empty object'
        return `${keys.length} field${keys.length === 1 ? '' : 's'}: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}`
    }
    return String(data).slice(0, 60)
}

function filterDataByUser(userId, preferredTool = '') {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    if (searchInput) searchInput.value = userId
    if (toolFilter) {
        if (preferredTool) {
            const targetCanonical = resolveCanonicalToolId(preferredTool)
            const matchedOption = Array.from(toolFilter.options).find(
                o => o.value && (o.value === preferredTool || resolveCanonicalToolId(o.value) === targetCanonical)
            )
            toolFilter.value = matchedOption ? matchedOption.value : ''
        } else {
            toolFilter.value = ''
        }
    }
    updateSearchClearBtn()
    closeViewModal()
    resetPagination()
    setView('data-details')

    // Auto-select the most relevant Data Details tab that actually has records
    const toolTabMap = {
        lessonnotes: 'notes',
        'lesson-note': 'notes',
        schedule: 'schedule',
        'admin-tracker': 'classes',
        tasks: 'tasks',
        'my-class': 'myclass',
        spreadsheet: 'studio',
        'card-maker': 'studio',
        'puzzle-maker': 'studio',
        'worksheet-maker': 'studio',
        'lesson-parser': 'studio',
        'dnd-hub': 'studio'
    }
    if (preferredTool && toolTabMap[preferredTool]) {
        setDataTab(toolTabMap[preferredTool])
        return
    }

    const tabOrder = ['progress', 'notes', 'schedule', 'classes', 'tasks', 'myclass', 'studio']
    const nonEmptyTab = tabOrder.find(t => {
        const countEl = document.getElementById(`datatab-count-${t}`)
        return countEl && Number(countEl.textContent) > 0
    })
    setDataTab(nonEmptyTab || 'progress')
}

// ── TOOL FILTER & MAIN FILTER PIPELINE ──
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
    const previous = sel.value
    sel.innerHTML = '<option value="">All tools</option>' +
        tools.map(t => {
            const meta = getToolMeta(t)
            return `<option value="${escapeHtml(t)}">${escapeHtml(meta.name)} (${escapeHtml(t)})</option>`
        }).join('')
    if (previous && tools.includes(previous)) sel.value = previous
}

function applyFilters() {
    updateSearchClearBtn()
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.toLowerCase().trim() : ''
    const tool = toolFilter ? toolFilter.value : ''
    const canonicalSelectedTool = tool ? resolveCanonicalToolId(tool) : ''
    const excludedIds = getExcludedUserIds()
    const sevenDaysAgoMs = Date.now() - (7 * 24 * 60 * 60 * 1000)

    const matchesToolKey = (rawKey) => {
        if (!tool) return true
        return rawKey === tool || resolveCanonicalToolId(rawKey) === canonicalSelectedTool
    }

    let filteredRows = allProgress.filter(r => {
        if (excludedIds.includes(r.user_id)) return false
        const prof = allProfiles[r.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const meta = getToolMeta(r.tool_key)
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || r.user_id.toLowerCase().includes(search)
            || r.tool_key.toLowerCase().includes(search)
            || meta.name.toLowerCase().includes(search)
        return matchSearch && matchesToolKey(r.tool_key)
    })

    // Base matching users (before role/recency pill filter, for accurate role pill counts)
    const baseUserIds = Object.keys(allProfiles).filter(uid => {
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

    const roleCounts = { all: baseUserIds.length, user: 0, pro: 0, admin: 0, active7d: 0 }
    baseUserIds.forEach(uid => {
        const prof = allProfiles[uid] || {}
        const r = prof.role || 'user'
        if (r === 'admin') roleCounts.admin++
        else if (r === 'pro') roleCounts.pro++
        else roleCounts.user++
        if ((prof.last_active_ts || 0) >= sevenDaysAgoMs) roleCounts.active7d++
    })
    Object.entries(roleCounts).forEach(([k, val]) => {
        const el = document.getElementById(`userfilter-count-${k}`)
        if (el) el.textContent = val
    })

    let filteredUserIds = baseUserIds.filter(uid => {
        const prof = allProfiles[uid] || {}
        const r = prof.role || 'user'
        if (userRoleFilter === 'all') return true
        if (userRoleFilter === 'active7d') return (prof.last_active_ts || 0) >= sevenDaysAgoMs
        return r === userRoleFilter
    })

    let filteredNotes = allNotes.filter(n => {
        if (excludedIds.includes(n.user_id)) return false
        if (notesStatusFilter === 'active' && n.deleted) return false
        if (notesStatusFilter === 'trashed' && !n.deleted) return false
        const prof = allProfiles[n.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || n.user_id.toLowerCase().includes(search)
            || (n.title || '').toLowerCase().includes(search)
            || (n.content || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('lesson-note')
    })

    let filteredScheduleEvents = allScheduleEvents.filter(e => {
        if (excludedIds.includes(e.user_id)) return false
        const prof = allProfiles[e.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || e.user_id.toLowerCase().includes(search)
            || (e.name || '').toLowerCase().includes(search)
            || (e.type_id || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('schedule')
    })

    let filteredClassAdmin = allClassAdmin.filter(c => {
        if (excludedIds.includes(c.user_id)) return false
        const prof = allProfiles[c.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || c.user_id.toLowerCase().includes(search)
            || (c.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('admin-tracker')
    })

    let filteredClassUnits = allClassUnits.filter(u => {
        if (excludedIds.includes(u.user_id)) return false
        const prof = allProfiles[u.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || u.user_id.toLowerCase().includes(search)
            || (u.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('admin-tracker')
    })

    let filteredMySpaceTasks = allMySpaceTasks.filter(t => {
        if (excludedIds.includes(t.user_id)) return false
        if (tasksStatusFilter === 'pending' && t.completed) return false
        if (tasksStatusFilter === 'completed' && !t.completed) return false
        const prof = allProfiles[t.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || t.user_id.toLowerCase().includes(search)
            || (t.text || '').toLowerCase().includes(search)
            || (t.category || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('tasks')
    })

    let filteredMyClass = allMyClass.filter(c => {
        if (excludedIds.includes(c.user_id)) return false
        const prof = allProfiles[c.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || c.user_id.toLowerCase().includes(search)
            || (c.class_name || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey('my-class')
    })

    let allStudioItems = buildStudioItemsList(excludedIds).filter(item => {
        if (studioTypeFilter !== 'all' && item.tool_key !== studioTypeFilter) return false
        const prof = allProfiles[item.user_id]
        const name = (prof?.display_name || '').toLowerCase()
        const email = (prof?.email || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || email.includes(search)
            || item.user_id.toLowerCase().includes(search)
            || (item.title || '').toLowerCase().includes(search)
            || (item.type_label || '').toLowerCase().includes(search)
        return matchSearch && matchesToolKey(item.tool_key)
    })

    // Sorting across all tables
    const roleOrder = { admin: 0, pro: 1, user: 2 }
    sortItems(filteredUserIds, sortConfig.users, {
        name: uid => (allProfiles[uid]?.display_name || '').toLowerCase(),
        role: uid => roleOrder[allProfiles[uid]?.role] ?? 2,
        storage: uid => allProfiles[uid]?.storage_usage || 0,
        records: uid => allProfiles[uid]?.records_count || 0,
        last_tool: uid => (allProfiles[uid]?.last_tool_used ? getToolMeta(allProfiles[uid].last_tool_used).name.toLowerCase() : ''),
        active: uid => allProfiles[uid]?.last_active_ts || 0
    })

    sortItems(filteredRows, sortConfig.progress, {
        user: r => (allProfiles[r.user_id]?.display_name || '').toLowerCase(),
        tool: r => r.tool_key || '',
        updated_at: r => new Date(r.updated_at).getTime() || 0
    })

    sortItems(filteredNotes, sortConfig.notes, {
        user: n => (allProfiles[n.user_id]?.display_name || '').toLowerCase(),
        title: n => (n.title || '').toLowerCase(),
        updated_at: n => Number(n.updated_at) || 0
    })

    sortItems(filteredScheduleEvents, sortConfig.schedule, {
        user: e => (allProfiles[e.user_id]?.display_name || '').toLowerCase(),
        name: e => (e.name || '').toLowerCase(),
        date: e => e.date || ''
    })

    sortItems(filteredClassAdmin, sortConfig.classes, {
        user: c => (allProfiles[c.user_id]?.display_name || '').toLowerCase(),
        class_name: c => (c.class_name || '').toLowerCase(),
        created_at: c => c.created_at || ''
    })

    sortItems(filteredClassUnits, sortConfig.classesUnits, {
        user: c => (allProfiles[c.user_id]?.display_name || '').toLowerCase(),
        class_name: c => (c.class_name || '').toLowerCase(),
        created_at: c => c.created_at || ''
    })

    sortItems(filteredMySpaceTasks, sortConfig.tasks, {
        user: t => (allProfiles[t.user_id]?.display_name || '').toLowerCase(),
        text: t => (t.text || '').toLowerCase(),
        category: t => (t.category || 'general').toLowerCase(),
        status: t => (t.completed ? 2 : t.priority === 'high' ? 0 : 1),
        created_at: t => parseTimestampMs(t.created_at)
    })

    sortItems(filteredMyClass, sortConfig.myclass, {
        user: c => (allProfiles[c.user_id]?.display_name || '').toLowerCase(),
        class_name: c => (c.class_name || '').toLowerCase(),
        updated_at: c => parseTimestampMs(c.updated_at)
    })

    sortItems(allStudioItems, sortConfig.studio, {
        user: item => (allProfiles[item.user_id]?.display_name || '').toLowerCase(),
        type: item => (item.type_label || '').toLowerCase(),
        title: item => (item.title || '').toLowerCase(),
        updated_at: item => item.ts || 0
    })

    // Paginate every view uniformly
    const pagedUserIds = paginateAndUpdateBar('users', filteredUserIds)
    const pagedRows = paginateAndUpdateBar('progress', filteredRows)
    const pagedNotes = paginateAndUpdateBar('notes', filteredNotes)
    const pagedSched = paginateAndUpdateBar('schedule', filteredScheduleEvents)
    const pagedClasses = paginateAndUpdateBar('classes', filteredClassAdmin)
    const pagedClassUnits = paginateAndUpdateBar('classesUnits', filteredClassUnits)
    const pagedTasks = paginateAndUpdateBar('tasks', filteredMySpaceTasks)
    const pagedMyClass = paginateAndUpdateBar('myclass', filteredMyClass)
    const pagedStudio = paginateAndUpdateBar('studio', allStudioItems)

    renderUsersTable(pagedUserIds)
    renderProgressTable(pagedRows)
    renderNotesTable(pagedNotes)
    renderScheduleTable(pagedSched)
    renderClassesView(pagedClasses, pagedClassUnits)
    renderTasksTable(pagedTasks)
    renderMyClassTable(pagedMyClass)
    renderStudioTable(pagedStudio)
    if (currentView === 'logs') renderLogsTable()
    updateSortIcons()

    // Header chips & tab count badges
    const countMap = {
        userCount: `${filteredUserIds.length} user${filteredUserIds.length === 1 ? '' : 's'}`,
        progressCount: `${filteredRows.length} row${filteredRows.length === 1 ? '' : 's'}`,
        notesCount: `${filteredNotes.length} note${filteredNotes.length === 1 ? '' : 's'}`,
        scheduleCount: `${filteredScheduleEvents.length} event${filteredScheduleEvents.length === 1 ? '' : 's'}`,
        classAdminCount: `${filteredClassAdmin.length} class${filteredClassAdmin.length === 1 ? '' : 'es'}`,
        classUnitsCount: `${filteredClassUnits.length} class${filteredClassUnits.length === 1 ? '' : 'es'}`,
        tasksCount: `${filteredMySpaceTasks.length} task${filteredMySpaceTasks.length === 1 ? '' : 's'}`,
        myclassCount: `${filteredMyClass.length} class${filteredMyClass.length === 1 ? '' : 'es'}`,
        studioCount: `${allStudioItems.length} item${allStudioItems.length === 1 ? '' : 's'}`
    }
    Object.entries(countMap).forEach(([id, text]) => {
        const el = document.getElementById(id)
        if (el) el.textContent = text
    })

    const tabBadgeCounts = {
        'datatab-count-progress': filteredRows.length,
        'datatab-count-notes': filteredNotes.length,
        'datatab-count-schedule': filteredScheduleEvents.length,
        'datatab-count-classes': filteredClassAdmin.length + filteredClassUnits.length,
        'datatab-count-tasks': filteredMySpaceTasks.length,
        'datatab-count-myclass': filteredMyClass.length,
        'datatab-count-studio': allStudioItems.length,
        'classtab-count-admin': filteredClassAdmin.length,
        'classtab-count-units': filteredClassUnits.length
    }
    Object.entries(tabBadgeCounts).forEach(([id, count]) => {
        const el = document.getElementById(id)
        if (el) el.textContent = count
    })
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    if (searchInput) searchInput.value = ''
    if (toolFilter) toolFilter.value = ''
    userRoleFilter = 'all'
    notesStatusFilter = 'all'
    tasksStatusFilter = 'all'
    studioTypeFilter = 'all'
    setPillGroupActive('userfilter', 'all', ['all', 'user', 'pro', 'admin', 'active7d'])
    setPillGroupActive('notesfilter', 'all', ['all', 'active', 'trashed'])
    setPillGroupActive('tasksfilter', 'all', ['all', 'pending', 'completed'])
    const studioSel = document.getElementById('studioTypeFilter')
    if (studioSel) studioSel.value = 'all'
    updateSearchClearBtn()
    resetPagination()
    applyFilters()
}

// ── USERS TABLE ──
function renderUsersTable(userIds) {
    const body = document.getElementById('usersTableBody')
    if (!body) return
    if (!userIds.length) {
        body.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-slate-500 font-bold">No users match the current filter</td></tr>'
        return
    }

    body.innerHTML = userIds.map(uid => {
        const profile = allProfiles[uid]
        const name = profile?.display_name || '—'
        const email = profile?.email || ''
        const role = profile?.role || 'user'
        const userToolIds = profile?.tools_set ? [...profile.tools_set] : []
        const recordsCount = profile?.records_count || 0
        let activeDate = 'Never'
        let activeDotClass = 'bg-slate-600'
        const latestTs = profile?.last_active_ts || 0
        const activeTitle = latestTs > 0 ? new Date(latestTs).toLocaleString() : 'No recorded activity'

        if (latestTs > 0) {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const thatDay = new Date(latestTs); thatDay.setHours(0, 0, 0, 0)
            const diffDays = Math.round((today - thatDay) / (1000 * 60 * 60 * 24))

            if (diffDays === 0) { activeDate = 'Today'; activeDotClass = 'bg-green' }
            else if (diffDays === 1) { activeDate = 'Yesterday'; activeDotClass = 'bg-green' }
            else if (diffDays < 7) { activeDate = `${diffDays} days ago`; activeDotClass = 'bg-blue' }
            else activeDate = thatDay.toLocaleDateString()
        }

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

        const displayTools = userToolIds.slice(0, 4)
        const extraToolsCount = Math.max(0, userToolIds.length - displayTools.length)
        const usedBytes = profile?.storage_usage || 0
        const limitBytes = profile?.storage_limit || 50 * 1024 * 1024
        const storagePct = Math.min(100, Math.round((usedBytes / limitBytes) * 100))
        const barColor = storagePct < 60 ? 'bg-green' : (storagePct < 85 ? 'bg-orange' : 'bg-pink')
        const lastToolId = profile?.last_tool_used || ''
        const lastToolTs = profile?.last_tool_ts || 0
        const lastToolMeta = lastToolId ? getToolMeta(lastToolId) : null
        const lastToolTimeLabel = lastToolTs > 0 ? formatRelativeTime(lastToolTs) : ''
        const lastToolTimeTitle = lastToolTs > 0 ? new Date(lastToolTs).toLocaleString() : ''

        return `<tr class="group transition-colors hover:bg-slate-900/40">
          <td class="px-5 py-3">
            <button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" class="flex items-center gap-3 text-left group/name focus:outline-none">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm flex-shrink-0 ${avatarClass}">${escapeHtml(initial)}</div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-white group-hover/name:text-blue transition-colors">${escapeHtml(name)}</span>
                  ${isPro ? '<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange/20 border border-orange/40 text-[9px] font-black text-orange uppercase tracking-wider">⭐ Pro</span>' : ''}
                </div>
                <div class="text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
                  ${email ? escapeHtml(email) : (recordsCount > 0 ? `${recordsCount} saved records` : 'No saved records')}
                  ${email && recordsCount > 0 ? ` · ${recordsCount} rec` : ''}
                </div>
              </div>
            </button>
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            <div class="inline-flex items-center gap-1.5">
              <span class="font-mono text-xs text-slate-500" title="${escapeHtml(uid)}">${escapeHtml(uid.slice(0, 10))}…</span>
              <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(uid)}', 'User ID copied')" title="Copy full User ID"
                class="p-1 rounded-md text-slate-500 hover:text-blue hover:bg-slate-700/60 transition-colors">
                <i data-lucide="copy" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
          <td class="px-5 py-3">
            <select onchange="updateRole('${escapeJsAttr(uid)}', this.value)"
              class="bg-slate-800 border-2 border-slate-700 rounded-lg text-[10px] font-black uppercase px-2 py-1 outline-none focus:border-blue transition-colors cursor-pointer ${selectClass}">
              <option value="user" ${role === 'user' ? 'selected' : ''}>👤 User</option>
              <option value="pro" ${isPro ? 'selected' : ''}>⭐ Pro</option>
              <option value="admin" ${isAdmin ? 'selected' : ''}>🛡️ Admin</option>
            </select>
          </td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center w-24">
                    <span class="text-[10px] font-bold text-white">${(usedBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <span class="text-[10px] text-slate-500 font-mono">${storagePct}%</span>
                </div>
                <div class="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${storagePct}%"></div>
                </div>
            </div>
          </td>
          <td class="hidden lg:table-cell px-5 py-3">
            ${userToolIds.length === 0 ? '<span class="text-xs text-slate-500 italic">No activity yet</span>' :
                `<div class="flex flex-wrap gap-1">
              ${displayTools.map(t => {
                    const meta = getToolMeta(t)
                    return `<button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}', '${escapeJsAttr(t)}')" class="chip bg-blue/10 text-blue border-blue/30 hover:bg-blue/20 transition-colors cursor-pointer" title="Filter ${escapeHtml(meta.name)} data for ${escapeHtml(name)}">${escapeHtml(meta.name)}</button>`
                }).join('')}
              ${extraToolsCount > 0 ? `<button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" class="chip bg-slate-800 text-slate-400 border-slate-700 hover:text-white transition-colors cursor-pointer">+${extraToolsCount} more</button>` : ''}
            </div>`}
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${lastToolMeta ? `
              <div class="flex flex-col gap-0.5 items-start">
                <button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}', '${escapeJsAttr(lastToolId)}')"
                  class="chip bg-slate-900 border-slate-700 hover:border-blue transition-colors cursor-pointer"
                  style="color:${escapeHtml(lastToolMeta.color)}"
                  title="Filter ${escapeHtml(lastToolMeta.name)} data for ${escapeHtml(name)}">${escapeHtml(lastToolMeta.name)}</button>
                ${lastToolTimeLabel ? `<span class="text-[10px] text-slate-500 font-mono" title="${escapeHtml(lastToolTimeTitle)}">${escapeHtml(lastToolTimeLabel)}</span>` : ''}
              </div>
            ` : '<span class="text-xs text-slate-600 italic">—</span>'}
          </td>
          <td class="px-5 py-3 text-xs text-slate-400 font-bold whitespace-nowrap" title="${escapeHtml(activeTitle)}">
            <div class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full flex-shrink-0 ${activeDotClass}"></span>
              <span>${activeDate}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-1.5 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}')" title="View user's records in Data Details"
                class="neo-btn px-2.5 py-1.5 bg-slate-700 text-slate-200 rounded-xl text-xs">
                <i data-lucide="database" class="w-3 h-3"></i> Data
              </button>
              <button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" title="Inspect profile details"
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
        const meta = getToolMeta(row.tool_key)
        const preview = formatProgressPreview(row.data)
        const date = new Date(row.updated_at).toLocaleString()

        return `<tr class="group transition-colors hover:bg-slate-900/40">
          <td class="px-5 py-3">${renderUserCell(row.user_id, 'blue', true)}</td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-0.5">
              <span class="chip bg-orange/10 text-orange border-orange/30 w-fit">${escapeHtml(meta.name)}</span>
              <span class="font-mono text-[9px] text-slate-500">${escapeHtml(row.tool_key)}</span>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3 max-w-[260px]">
            <span class="text-xs text-slate-400 truncate block" title="${escapeHtml(preview)}">${escapeHtml(preview)}</span>
          </td>
          <td class="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openViewModal('${escapeJsAttr(row.user_id)}','${escapeJsAttr(row.tool_key)}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button type="button" onclick="openDeleteModal('${escapeJsAttr(row.user_id)}','${escapeJsAttr(row.tool_key)}')" title="Delete progress row"
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
        const ts = Number(note.updated_at)
        const date = ts ? new Date(ts).toLocaleString() : '—'
        let folderName = '—'
        if (note.folder_id) {
            const userFolders = allNoteFolders[note.user_id] || []
            const folder = userFolders.find(f => f.id === note.folder_id)
            if (folder) folderName = folder.name || folder.id
        }
        const snippet = (note.content || '').replace(/\s+/g, ' ').trim().slice(0, 70)

        return `<tr class="group transition-colors hover:bg-slate-900/40">
          <td class="px-5 py-3">${renderUserCell(note.user_id, 'orange', true)}</td>
          <td class="px-5 py-3 max-w-[280px]">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-200 truncate">${escapeHtml(note.title || 'Untitled')}</span>
              ${note.deleted ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase flex-shrink-0">Trash</span>' : ''}
            </div>
            ${snippet ? `<div class="text-[11px] text-slate-500 truncate mt-0.5">${escapeHtml(snippet)}</div>` : ''}
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${note.folder_id ? `<span class="chip bg-orange/10 text-orange border-orange/30">${escapeHtml(folderName)}</span>` : '<span class="text-xs text-slate-600 italic">Root</span>'}
          </td>
          <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openNoteModal('${escapeHtml(note.id)}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button type="button" onclick="openDeleteModal('${escapeHtml(note.id)}','note')" title="Delete note"
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
        body.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500 font-bold">No schedule events found</td></tr>'
        return
    }
    const recurrenceLabels = { none: 'One-time', weekly: 'Weekly', daily: 'Daily', monthly: 'Monthly' }
    body.innerHTML = rows.map(ev => {
        const recLabel = recurrenceLabels[ev.recurrence] || ev.recurrence || 'One-time'
        const isRecurring = ev.recurrence && ev.recurrence !== 'none'
        return `<tr class="group transition-colors hover:bg-slate-900/40">
          <td class="px-5 py-3">${renderUserCell(ev.user_id, 'orange', true)}</td>
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
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openScheduleModal('${escapeHtml(ev.id)}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

// ── SCHEDULE CLASSES VIEW ──
function renderClassesView(pagedClasses, pagedUnits) {
    const adminBody = document.getElementById('classAdminTableBody')
    if (adminBody) {
        if (!pagedClasses || !pagedClasses.length) {
            adminBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No admin classes found</td></tr>'
        } else {
            adminBody.innerHTML = pagedClasses.map(cls => {
                let tasks = cls.tasks
                if (typeof tasks === 'string') {
                    try { tasks = JSON.parse(tasks) } catch (e) { tasks = [] }
                }
                const taskCount = Array.isArray(tasks) ? tasks.length : 0
                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors hover:bg-slate-900/40">
                  <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false)}</td>
                  <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
                  <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${taskCount} task${taskCount !== 1 ? 's' : ''}</span></td>
                  <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
                  <td class="px-5 py-3">
                    <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button type="button" onclick="openClassModal('${escapeHtml(cls.id)}','admin')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                        <i data-lucide="eye" class="w-3 h-3"></i> View
                      </button>
                    </div>
                  </td>
                </tr>`
            }).join('')
        }
    }

    const unitsBody = document.getElementById('classUnitsTableBody')
    if (unitsBody) {
        if (!pagedUnits || !pagedUnits.length) {
            unitsBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No class units found</td></tr>'
        } else {
            unitsBody.innerHTML = pagedUnits.map(cls => {
                let syllabus = cls.syllabus
                if (typeof syllabus === 'string') {
                    try { syllabus = JSON.parse(syllabus) } catch (e) { syllabus = [] }
                }
                const unitCount = Array.isArray(syllabus) ? syllabus.length : 0
                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors hover:bg-slate-900/40">
                  <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false)}</td>
                  <td class="px-5 py-3"><span class="font-bold text-slate-200">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
                  <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${unitCount} unit${unitCount !== 1 ? 's' : ''}</span></td>
                  <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
                  <td class="px-5 py-3">
                    <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button type="button" onclick="openClassModal('${escapeHtml(cls.id)}','units')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
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
    adminBtn.className = `neo-btn px-4 py-2 ${tab === 'admin' ? 'bg-orange text-white font-bold' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm`
    unitsBtn.className = `neo-btn px-4 py-2 ${tab === 'units' ? 'bg-orange text-white font-bold' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm`
}

function setDataTab(tab) {
    currentDataTab = tab
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

// ── VIEW MODAL HELPERS ──
function setViewModalState({ title, sub, html, copyText = '' }) {
    lastViewModalCopyText = copyText
    document.getElementById('viewModalTitle').textContent = title
    document.getElementById('viewModalSub').textContent = sub
    document.getElementById('viewModalContent').innerHTML = html
    const copyBtn = document.getElementById('viewModalCopyBtn')
    if (copyBtn) copyBtn.classList.toggle('hidden', !copyText)
    document.getElementById('viewModalBg').classList.remove('hidden')
    lucide.createIcons()
}

function copyViewModalContent() {
    if (!lastViewModalCopyText) return
    copyTextToClipboard(lastViewModalCopyText, 'Modal content copied')
}

function openClassModal(id, type) {
    const item = type === 'admin'
        ? allClassAdmin.find(c => String(c.id) === String(id))
        : allClassUnits.find(c => String(c.id) === String(id))
    if (!item) return
    const profile = allProfiles[item.user_id]
    const label = type === 'admin' ? 'Admin Tasks' : 'Syllabus Units'
    const payload = type === 'admin' ? item.tasks : item.syllabus
    const jsonText = JSON.stringify(payload, null, 2)
    setViewModalState({
        title: `${item.class_name} — ${label}`,
        sub: `${profile?.display_name || item.user_id.slice(0, 8)} · ${new Date(item.created_at).toLocaleDateString()}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

function openNoteModal(noteId) {
    const note = allNotes.find(n => String(n.id) === String(noteId))
    if (!note) return
    const profile = allProfiles[note.user_id]
    let folderLabel = 'Root'
    if (note.folder_id) {
        const folder = (allNoteFolders[note.user_id] || []).find(f => f.id === note.folder_id)
        if (folder) folderLabel = folder.name || folder.id
    }
    const content = note.content || ''
    setViewModalState({
        title: `${profile?.display_name || note.user_id.slice(0, 8)} — ${note.title || 'Untitled'}`,
        sub: `Folder: ${folderLabel}${note.deleted ? ' · TRASHED' : ''} · Updated ${Number(note.updated_at) ? new Date(Number(note.updated_at)).toLocaleString() : '—'}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(content || '(Empty note)')}</pre>`,
        copyText: content
    })
}

function openScheduleModal(id) {
    const ev = allScheduleEvents.find(e => String(e.id) === String(id))
    if (!ev) return
    const profile = allProfiles[ev.user_id]
    const jsonText = JSON.stringify(ev, null, 2)
    setViewModalState({
        title: `Schedule Event — ${ev.name || 'Untitled Event'}`,
        sub: `Owner: ${profile?.display_name || ev.user_id.slice(0, 8)} · Date: ${ev.date || '—'} · Type: ${ev.type_id || 'other'}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

// ── VIEW MODAL ──
function openViewModal(userId, toolKey) {
    const row = allProgress.find(r => r.user_id === userId && r.tool_key === toolKey)
    const profile = allProfiles[userId]
    if (!row) return

    const meta = getToolMeta(toolKey)
    const jsonText = JSON.stringify(row.data, null, 2)
    setViewModalState({
        title: `${profile?.display_name || userId.slice(0, 8)} — ${meta.name} (${toolKey})`,
        sub: `Updated ${new Date(row.updated_at).toLocaleString()}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

function closeViewModal() {
    document.getElementById('viewModalBg').classList.add('hidden')
    lastViewModalCopyText = ''
}

// ── VIEW USER ──
function viewUser(userId) {
    const profile = allProfiles[userId] || {}
    const name = profile.display_name || userId.slice(0, 8)
    const email = profile.email || '—'
    const role = profile.role || 'user'
    const userProgress = allProgress.filter(r => r.user_id === userId)
    const userNotes = allNotes.filter(n => n.user_id === userId)
    const userTasks = allMySpaceTasks.filter(t => t.user_id === userId)
    const completedTasksCount = userTasks.filter(t => t.completed).length
    const userClasses = allMyClass.filter(c => c.user_id === userId)
    const userEvents = allScheduleEvents.filter(e => e.user_id === userId)
    const userSpreadsheets = allSpreadsheets.filter(s => s.user_id === userId)
    const userCardMaker = allCardMaker.filter(c => c.user_id === userId)
    const userPuzzleMaker = allPuzzleMaker.filter(p => p.user_id === userId)
    const userWorksheetMaker = allWorksheetMaker.filter(w => w.user_id === userId)
    const userLessonParser = allLessonParser.filter(l => l.user_id === userId)
    const userDnd = allToolsDnd.filter(d => d.user_id === userId)
    const userVttMaps = allVttMaps.filter(m => (m.user_id || m.owner_id) === userId)
    const userVttCampaigns = allVttCampaigns.filter(c => (c.user_id || c.owner_id) === userId)

    const studioTotal = userSpreadsheets.length + userCardMaker.length + userPuzzleMaker.length + userWorksheetMaker.length
    const workshopTotal = userLessonParser.length + userDnd.length + userVttMaps.length + userVttCampaigns.length

    let totalStudents = 0
    userClasses.forEach(cls => {
        const d = typeof cls.data === 'string' ? (() => { try { return JSON.parse(cls.data) } catch (e) { return {} } })() : (cls.data || {})
        if (Array.isArray(d.students)) totalStudents += d.students.length
    })

    const formatTs = (ts) => ts ? new Date(ts).toLocaleString() : '—'
    const usedMB = ((profile.storage_usage || 0) / (1024 * 1024)).toFixed(2)
    const limitMB = ((profile.storage_limit || 50 * 1024 * 1024) / (1024 * 1024)).toFixed(0)
    const storagePct = Math.min(100, Math.round(((profile.storage_usage || 0) / (profile.storage_limit || 50 * 1024 * 1024)) * 100))

    // Aggregate canonical tools used by this user across all tables
    const canonicalCounts = {}
    userProgress.forEach(r => {
        if (r.tool_key === 'klasskit_hub' || r.tool_key === 'hub') return
        const cid = resolveCanonicalToolId(r.tool_key)
        const entries = extractLogEntries(r)
        canonicalCounts[cid] = (canonicalCounts[cid] || 0) + entries.length
    })
    if (userNotes.length) canonicalCounts['lessonnotes'] = (canonicalCounts['lessonnotes'] || 0) + userNotes.length
    if (userEvents.length) canonicalCounts['schedule'] = (canonicalCounts['schedule'] || 0) + userEvents.length
    if (userClasses.length) canonicalCounts['my-class'] = (canonicalCounts['my-class'] || 0) + userClasses.length
    if (userTasks.length) canonicalCounts['tasks'] = (canonicalCounts['tasks'] || 0) + userTasks.length
    if (userSpreadsheets.length) canonicalCounts['spreadsheet'] = (canonicalCounts['spreadsheet'] || 0) + userSpreadsheets.length
    if (userCardMaker.length) canonicalCounts['card-maker'] = (canonicalCounts['card-maker'] || 0) + userCardMaker.length
    if (userPuzzleMaker.length) canonicalCounts['puzzle-maker'] = (canonicalCounts['puzzle-maker'] || 0) + userPuzzleMaker.length
    if (userWorksheetMaker.length) canonicalCounts['worksheet-maker'] = (canonicalCounts['worksheet-maker'] || 0) + userWorksheetMaker.length
    if (userLessonParser.length) canonicalCounts['lesson-parser'] = (canonicalCounts['lesson-parser'] || 0) + userLessonParser.length
    if (userDnd.length || userVttMaps.length || userVttCampaigns.length) {
        canonicalCounts['dnd-hub'] = (canonicalCounts['dnd-hub'] || 0) + userDnd.length + userVttMaps.length + userVttCampaigns.length
    }

    const sortedToolKeys = Object.keys(canonicalCounts).sort((a, b) => canonicalCounts[b] - canonicalCounts[a])
    const recentNotes = [...userNotes].sort((a, b) => (Number(b.updated_at) || 0) - (Number(a.updated_at) || 0)).slice(0, 5)

    const html = `
        <div class="space-y-5 text-slate-300">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(userId)}', 'User ID copied')"
                        class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs">
                        <i data-lucide="copy" class="w-3.5 h-3.5 text-blue"></i> Copy User ID
                    </button>
                    ${email !== '—' ? `
                    <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(email)}', 'Email copied')"
                        class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs">
                        <i data-lucide="mail" class="w-3.5 h-3.5 text-orange"></i> Copy Email
                    </button>` : ''}
                </div>
                <button type="button" onclick="filterDataByUser('${escapeJsAttr(userId)}')"
                    class="neo-btn px-3.5 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="database" class="w-3.5 h-3.5"></i> View User's Data →
                </button>
            </div>

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
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2">
                    <i data-lucide="grid-2x2" class="w-4 h-4 text-blue"></i>
                    Adopted Tools & Activity Volume (${sortedToolKeys.length})
                    <span class="text-[10px] font-body font-normal text-slate-500 ml-auto">Click tool to inspect</span>
                </h3>
                ${sortedToolKeys.length ? `
                <div class="flex flex-wrap gap-2">
                    ${sortedToolKeys.map(cid => {
                        const meta = getToolMeta(cid)
                        return `<button type="button" onclick="filterDataByUser('${escapeJsAttr(userId)}', '${escapeJsAttr(cid)}')"
                            class="chip bg-blue/10 text-blue border-blue/40 hover:bg-blue/20 transition-colors cursor-pointer">${escapeHtml(meta.name)} <span class="ml-1 opacity-70">(${canonicalCounts[cid]})</span></button>`
                    }).join('')}
                </div>
                ` : '<div class="text-xs text-slate-500 italic">No tool activity</div>'}
            </div>

            <div class="neo bg-slate-950 p-4 border-2 border-slate-700">
                <h3 class="font-heading text-sm text-white mb-3 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-orange"></i> Recent Notes</h3>
                ${recentNotes.length ? `
                <ul class="space-y-1.5 text-xs">
                    ${recentNotes.map(n => `
                        <li>
                            <button type="button" onclick="openNoteModal('${escapeHtml(n.id)}')"
                                class="w-full flex justify-between items-center border-b border-slate-800 pb-2 pt-1 px-2 rounded-lg hover:bg-slate-900 transition-colors text-left">
                                <span class="font-bold text-slate-300 truncate mr-4 flex items-center gap-2">
                                    ${escapeHtml(n.title || 'Untitled')}
                                    ${n.deleted ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase">Trash</span>' : ''}
                                </span>
                                <span class="text-slate-500 font-mono whitespace-nowrap flex items-center gap-2">
                                    ${formatTs(Number(n.updated_at))}
                                    <i data-lucide="external-link" class="w-3 h-3 text-blue"></i>
                                </span>
                            </button>
                        </li>`).join('')}
                </ul>
                ` : '<div class="text-xs text-slate-500 italic">No notes</div>'}
            </div>
        </div>
    `

    const roleLabel = role === 'pro' ? '⭐ PRO USER' : role === 'admin' ? '🛡️ ADMIN' : '👤 USER'
    setViewModalState({
        title: `${name} — Profile Details`,
        sub: `Role: ${roleLabel} · Last Active: ${profile.last_active_ts ? formatTs(profile.last_active_ts) : 'Never'}`,
        html,
        copyText: ''
    })
}

// ── DELETE MODAL ──
function openDeleteModal(idOrUser, toolOrType) {
    let title = "Delete Item?"
    let msg = "This action cannot be undone."

    if (toolOrType === 'announcement') {
        const ann = allAnnouncements.find(a => String(a.id) === String(idOrUser))
        title = "Delete Announcement?"
        msg = `Permanently delete "${ann?.title || 'this announcement'}"?`
        pendingDelete = { id: idOrUser, type: 'announcement' }
    } else if (toolOrType === 'note') {
        const note = allNotes.find(n => String(n.id) === String(idOrUser))
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

    let shouldClose = true
    try {
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
                allNotes = allNotes.filter(n => String(n.id) !== String(pendingDelete.id))
                updateStats()
                applyFilters()
            }
        } else if (pendingDelete.type === 'cloud-storage') {
            const { userId } = pendingDelete
            shouldClose = false
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
    } finally {
        if (shouldClose) closeDeleteModal()
    }
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
        const statusColor = task.completed ? 'green' : (task.priority === 'high' ? 'pink' : 'blue')
        const statusLabel = task.completed ? 'Completed' : (task.priority || 'Medium')
        const statusCls = CHIP_COLOR_STYLES[statusColor] || CHIP_COLOR_STYLES.blue

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">${renderUserCell(task.user_id, 'blue', false)}</td>
            <td class="px-5 py-3"><span class="font-bold text-slate-200 ${task.completed ? 'line-through opacity-60' : ''}">${escapeHtml(task.text)}</span></td>
            <td class="px-5 py-3"><span class="chip bg-slate-700 text-slate-400 border-slate-600">${escapeHtml(task.category || 'General')}</span></td>
            <td class="px-5 py-3"><span class="chip ${statusCls}">${escapeHtml(statusLabel)}</span></td>
            <td class="px-5 py-3 text-right">
                <button type="button" onclick="openTaskModal('${escapeHtml(task.id)}')" class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

function openTaskModal(id) {
    const task = allMySpaceTasks.find(t => String(t.id) === String(id))
    if (!task) return
    const profile = allProfiles[task.user_id]
    const jsonText = JSON.stringify(task, null, 2)
    setViewModalState({
        title: `Task Detail — ${profile?.display_name || 'User'}`,
        sub: `ID: ${task.id} · Created: ${new Date(task.created_at).toLocaleString()}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
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
        const updated = cls.updated_at ? new Date(cls.updated_at).toLocaleDateString() : '—'

        const d = typeof cls.data === 'string'
            ? (() => { try { return JSON.parse(cls.data) } catch (e) { return {} } })()
            : (cls.data || {})
        const stuCount = Array.isArray(d.students) ? d.students.length : 0
        const logDays = d.logs && typeof d.logs === 'object' ? Object.keys(d.logs).length : 0
        const refDays = d.reflections && typeof d.reflections === 'object' ? Object.keys(d.reflections).length : 0

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false)}</td>
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
                <button type="button" onclick="openMyClassRowModal('${escapeHtml(cls.id)}')" class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

function openMyClassRowModal(id) {
    const cls = allMyClass.find(c => String(c.id) === String(id))
    if (!cls) return
    const profile = allProfiles[cls.user_id]
    const jsonText = JSON.stringify(cls.data, null, 2)
    setViewModalState({
        title: `Class Data — ${cls.class_name}`,
        sub: `Teacher: ${profile?.display_name || 'Unknown'} · Updated: ${new Date(cls.updated_at).toLocaleString()}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
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
        const dateStr = item.ts ? new Date(item.ts).toLocaleString() : '—'
        const chipCls = CHIP_COLOR_STYLES[item.color] || CHIP_COLOR_STYLES.blue

        return `<tr class="group transition-colors hover:bg-slate-800/50">
            <td class="px-5 py-3">${renderUserCell(item.user_id, item.color, true)}</td>
            <td class="px-5 py-3">
                <span class="chip ${chipCls}">${escapeHtml(item.type_label)}</span>
            </td>
            <td class="px-5 py-3">
                <span class="font-bold text-slate-200">${escapeHtml(item.title)}</span>
            </td>
            <td class="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">${dateStr}</td>
            <td class="px-5 py-3 text-right">
                <button type="button" onclick="openStudioModal('${escapeHtml(item.table)}', '${escapeHtml(item.id)}')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> Inspect
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

async function openStudioModal(table, id) {
    setViewModalState({
        title: `Inspecting ${table}…`,
        sub: `ID: ${id}`,
        html: '<div class="text-slate-400 text-xs font-mono">Loading full payload from Supabase…</div>',
        copyText: ''
    })

    const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle()
    if (error || !data) {
        setViewModalState({
            title: `Inspecting ${table}`,
            sub: `ID: ${id}`,
            html: `<div class="text-pink text-xs font-mono">Failed to load record: ${escapeHtml(error?.message || 'Record not found')}</div>`,
            copyText: ''
        })
        return
    }
    const uid = data.user_id || data.owner_id
    const profile = allProfiles[uid]
    const title = data.title || data.unit_title || data.name || id
    const jsonText = JSON.stringify(data, null, 2)
    setViewModalState({
        title: `${title} (${table})`,
        sub: `Owner: ${profile?.display_name || uid || 'Unknown'}`,
        html: `<pre class="text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

// KlassKit Admin — Users, Data Details, Studio & On-Demand Inspection Modals

const USER_DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024

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
    const targetKeys = keys || ['users', 'progress', 'notes', 'schedule', 'classes', 'classesUnits', 'tasks', 'myclass', 'studio', 'cloud', 'logs']
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
    setPillGroupActive('userfilter', role, ['all', 'user', 'pro', 'admin', 'active7d', 'logs_only'])
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

function updatePaginationBar(key, total, page, pageSize) {
    const totalCount = Number(total) || 0
    const size = Number(pageSize) || PAGE_SIZE
    const totalPages = Math.ceil(totalCount / size) || 1
    const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages)
    pagination[key] = safePage

    if (!pagination.lastFilteredCounts) pagination.lastFilteredCounts = {}
    pagination.lastFilteredCounts[key] = totalCount

    const start = (safePage - 1) * size
    const end = Math.min(start + size, totalCount)

    const infoEl = document.getElementById(`${key}-page-info`)
    if (infoEl) {
        infoEl.textContent = totalCount > 0
            ? `Showing ${start + 1}–${end} of ${totalCount} · Page ${safePage} of ${totalPages}`
            : `0 items · Page 1 of 1`
    }

    const prevBtn = document.getElementById(`${key}-prev-btn`)
    const nextBtn = document.getElementById(`${key}-next-btn`)
    if (prevBtn) {
        const atStart = safePage <= 1
        prevBtn.disabled = atStart
        prevBtn.classList.toggle('opacity-40', atStart)
        prevBtn.classList.toggle('cursor-not-allowed', atStart)
    }
    if (nextBtn) {
        const atEnd = safePage >= totalPages
        nextBtn.disabled = atEnd
        nextBtn.classList.toggle('opacity-40', atEnd)
        nextBtn.classList.toggle('cursor-not-allowed', atEnd)
    }
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

function renderUserCell(userId, color = 'blue', showSubId = true, displayNameFallback = null) {
    const uid = String(userId || '')
    const profile = allProfiles[uid]
    const name = displayNameFallback || profile?.display_name || '—'
    const initial = name[0]?.toUpperCase() || '?'
    const badgeCls = USER_CELL_STYLES[color] || USER_CELL_STYLES.blue
    return `
        <button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" title="Inspect user profile"
            class="flex items-center gap-2 text-left group/user rounded-lg focus:outline-none">
            <div class="w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-heading flex-shrink-0 transition-colors ${badgeCls}">${escapeHtml(initial)}</div>
            <div class="min-w-0">
                <div class="font-bold text-ink text-sm truncate group-hover/user:text-blue transition-colors">${escapeHtml(name)}</div>
                ${showSubId ? `<div class="font-mono text-[10px] text-ink-muted">${escapeHtml(uid.slice(0, 8))}...</div>` : ''}
            </div>
        </button>`
}

async function filterDataByUser(userId, preferredTool = '') {
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
        setDataTab(toolTabMap[preferredTool], { load: false })
        setView('data-details')
        return
    }

    setDataTab('progress', { load: false })
    setView('data-details')
}

// ── TOOL FILTER & SERVER DISPATCH PIPELINE ──
function populateToolFilter(distinctKeys = []) {
    const toolsSet = new Set([
        ...(Array.isArray(distinctKeys) ? distinctKeys.filter(k => k && k !== 'klasskit_hub' && k !== 'hub') : []),
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

function getGlobalFilterParams() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    return {
        search: searchInput ? searchInput.value.trim() : '',
        tool: toolFilter ? toolFilter.value : '',
        excludedIds: getValidExcludedUserIds()
    }
}

async function applyFilters() {
    updateSearchClearBtn()
    if (currentView === 'users') {
        await loadUsersView()
    } else if (currentView === 'data-details') {
        await loadDataDetailsTab(true)
    } else if (currentView === 'logs') {
        if (typeof renderLogsTable === 'function') await renderLogsTable()
    } else if (currentView === 'cloud') {
        if (typeof renderCloudTable === 'function') await renderCloudTable()
    }
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
    auditSourceFilter = 'all'
    setPillGroupActive('userfilter', 'all', ['all', 'user', 'pro', 'admin', 'active7d', 'logs_only'])
    setPillGroupActive('notesfilter', 'all', ['all', 'active', 'trashed'])
    setPillGroupActive('tasksfilter', 'all', ['all', 'pending', 'completed'])
    setPillGroupActive('logsfilter', 'all', ['all', 'saves', 'logs', 'session', 'tab_open'])
    const studioSel = document.getElementById('studioTypeFilter')
    if (studioSel) studioSel.value = 'all'
    updateSearchClearBtn()
    resetPagination()
    applyFilters()
}

// ── USERS VIEW (Server-Paginated) ──
async function loadUsersView() {
    const body = document.getElementById('usersTableBody')
    if (!body) return

    const seq = ++reqSeq.users
    if (body.children.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-ink-muted font-bold">Loading users…</td></tr>'
    } else {
        body.classList.add('opacity-50')
    }

    try {
        const { search, tool, excludedIds } = getGlobalFilterParams()
        const conf = sortConfig.users || { col: 'active', dir: 'desc' }

        const { data, error } = await callAdminRpc('admin_list_users', {
            p_excluded_ids: excludedIds,
            p_search: search,
            p_role_filter: userRoleFilter,
            p_tool_filter: tool,
            p_sort_col: conf.col,
            p_sort_dir: conf.dir,
            p_page: pagination.users || 1,
            p_page_size: PAGE_SIZE
        })

        if (seq !== reqSeq.users) return
        if (error || !data) {
            body.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-pink font-bold">Failed to load users</td></tr>'
            return
        }

        const total = Number(data.total) || 0
        const totalPages = Math.ceil(total / PAGE_SIZE) || 1
        if ((pagination.users || 1) > totalPages) {
            pagination.users = totalPages
            return loadUsersView()
        }

        const roleCounts = data.role_counts || {}
        Object.entries(roleCounts).forEach(([k, val]) => {
            const el = document.getElementById(`userfilter-count-${k}`)
            if (el) el.textContent = Number(val) || 0
        })

        const countEl = document.getElementById('userCount')
        if (countEl) countEl.textContent = `${total} user${total === 1 ? '' : 's'}`

        updatePaginationBar('users', total, pagination.users, PAGE_SIZE)

        const items = Array.isArray(data.items) ? data.items : []
        items.forEach(p => {
            allProfiles[p.id] = { ...(allProfiles[p.id] || {}), ...p }
        })

        renderUsersTable(items)
        updateSortIcons('users')
    } finally {
        if (seq === reqSeq.users) body.classList.remove('opacity-50')
    }
}

function renderUsersTable(users) {
    const body = document.getElementById('usersTableBody')
    if (!body) return
    if (!users.length) {
        body.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-ink-muted font-bold">No users match the current filter</td></tr>'
        return
    }

    body.innerHTML = users.map(profile => {
        const uid = profile.id
        const name = profile.display_name || '—'
        const email = profile.email || ''
        const role = profile.role || 'user'
        const userToolIds = Array.isArray(profile.tools_list) ? profile.tools_list : []
        const recordsCount = Number(profile.records_count) || 0
        const hasBreakdown = profile.saves_count !== undefined && profile.logs_count !== undefined
        const savesCount = Number(profile.saves_count ?? recordsCount) || 0
        const logsCount = Number(profile.logs_count) || 0
        const tabOpensCount = Number(profile.tab_opens_count) || 0
        const sessionsCount = Number(profile.sessions_count) || 0

        let activeDate = 'Never'
        let activeDotClass = 'bg-slate-400 dark:bg-slate-600'
        const latestTs = parseTimestampMs(profile.last_active_ts)
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
            ? 'bg-pink/15 border-2 border-pink/40 text-pink'
            : isPro
                ? 'bg-orange/15 border-2 border-orange/40 text-orange'
                : 'bg-blue/15 border-2 border-blue/40 text-blue'

        const selectClass = isAdmin
            ? 'text-pink border-pink/40'
            : isPro
                ? 'text-orange border-orange/40'
                : 'text-ink-muted border-line-muted'

        const displayTools = userToolIds.slice(0, 4)
        const extraToolsCount = Math.max(0, userToolIds.length - displayTools.length)
        const usedBytes = Number(profile.storage_usage) || 0
        const limitBytes = Number(profile.storage_limit) || USER_DEFAULT_STORAGE_LIMIT
        const storagePct = Math.min(100, Math.round((usedBytes / limitBytes) * 100))
        const barColor = storagePct < 60 ? 'bg-green' : (storagePct < 85 ? 'bg-orange' : 'bg-pink')
        const lastToolId = profile.last_tool_used || ''
        const lastToolTs = parseTimestampMs(profile.last_tool_ts)
        const lastToolMeta = lastToolId ? getToolMeta(lastToolId) : null
        const lastToolTimeLabel = lastToolTs > 0 ? formatRelativeTime(lastToolTs) : ''
        const lastToolTimeTitle = lastToolTs > 0 ? new Date(lastToolTs).toLocaleString() : ''

        const activitySummaryText = hasBreakdown
            ? `${savesCount} saves · ${logsCount} logs${(tabOpensCount || sessionsCount) ? ` (${tabOpensCount}o/${sessionsCount}s)` : ''}`
            : (recordsCount > 0 ? `${recordsCount} saved records` : 'No saved records')

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
          <td class="px-5 py-3">
            <button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" class="flex items-center gap-3 text-left group/name focus:outline-none">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm flex-shrink-0 ${avatarClass}">${escapeHtml(initial)}</div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-ink group-hover/name:text-blue transition-colors">${escapeHtml(name)}</span>
                  ${isPro ? '<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange/15 border border-orange/40 text-[9px] font-black text-orange uppercase tracking-wider">⭐ Pro</span>' : ''}
                </div>
                <div class="text-[10px] text-ink-muted font-mono truncate max-w-[240px]">
                  ${email ? `${escapeHtml(email)} · ` : ''}${activitySummaryText}
                </div>
              </div>
            </button>
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            <div class="inline-flex items-center gap-1.5">
              <span class="font-mono text-xs text-ink-muted" title="${escapeHtml(uid)}">${escapeHtml(uid.slice(0, 10))}…</span>
              <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(uid)}', 'User ID copied')" title="Copy full User ID"
                class="p-1 rounded-md text-ink-muted hover:text-blue hover:bg-surface-muted transition-colors">
                <i data-lucide="copy" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
          <td class="px-5 py-3">
            <select onchange="updateRole('${escapeJsAttr(uid)}', this.value)"
              class="role-select bg-card border-2 rounded-lg text-[10px] font-black uppercase px-2 py-1 outline-none focus:border-blue transition-colors cursor-pointer ${selectClass}">
              <option value="user" ${role === 'user' ? 'selected' : ''}>👤 User</option>
              <option value="pro" ${isPro ? 'selected' : ''}>⭐ Pro</option>
              <option value="admin" ${isAdmin ? 'selected' : ''}>🛡️ Admin</option>
            </select>
          </td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center w-24">
                    <span class="text-[10px] font-bold text-ink">${(usedBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <span class="text-[10px] text-ink-muted font-mono">${storagePct}%</span>
                </div>
                <div class="w-24 h-1.5 bg-surface-muted rounded-full overflow-hidden border border-line-muted">
                    <div class="h-full ${barColor}" style="width: ${storagePct}%"></div>
                </div>
            </div>
          </td>
          <td class="hidden lg:table-cell px-5 py-3">
            ${userToolIds.length === 0 ? '<span class="text-xs text-ink-muted italic">No activity yet</span>' :
                `<div class="flex flex-wrap gap-1">
              ${displayTools.map(t => {
                    const meta = getToolMeta(t)
                    return `<button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}', '${escapeJsAttr(t)}')" class="chip bg-blue/10 text-blue border-blue/30 hover:bg-blue/20 transition-colors cursor-pointer" title="Filter ${escapeHtml(meta.name)} data for ${escapeHtml(name)}">${escapeHtml(meta.name)}</button>`
                }).join('')}
              ${extraToolsCount > 0 ? `<button type="button" onclick="viewUser('${escapeJsAttr(uid)}')" class="chip bg-surface-muted text-ink-muted border-line-muted hover:text-ink transition-colors cursor-pointer">+${extraToolsCount} more</button>` : ''}
            </div>`}
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${lastToolMeta ? `
              <div class="flex flex-col gap-0.5 items-start">
                <button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}', '${escapeJsAttr(lastToolId)}')"
                  class="chip bg-surface-muted border-line-muted hover:border-blue transition-colors cursor-pointer"
                  style="color:${escapeHtml(lastToolMeta.color)}"
                  title="Filter ${escapeHtml(lastToolMeta.name)} data for ${escapeHtml(name)}">${escapeHtml(lastToolMeta.name)}</button>
                ${lastToolTimeLabel ? `<span class="text-[10px] text-ink-muted font-mono" title="${escapeHtml(lastToolTimeTitle)}">${escapeHtml(lastToolTimeLabel)}</span>` : ''}
              </div>
            ` : '<span class="text-xs text-ink-muted italic">—</span>'}
          </td>
          <td class="px-5 py-3 text-xs text-ink-muted font-bold whitespace-nowrap" title="${escapeHtml(activeTitle)}">
            <div class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full flex-shrink-0 ${activeDotClass}"></span>
              <span>${activeDate}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-1.5 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="filterDataByUser('${escapeJsAttr(uid)}')" title="View user's records in Data Details"
                class="neo-btn px-2.5 py-1.5 bg-surface-muted text-ink rounded-xl text-xs">
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

// ── DATA DETAILS VIEW (Lazy Tab Queries) ──
async function loadDataDetailsTab(includeTabCounts = true) {
    const seq = ++reqSeq.data
    const { search, tool, excludedIds } = getGlobalFilterParams()
    const activeTab = currentDataTab === 'classes'
        ? (scheduleClassTab === 'units' ? 'classesUnits' : 'classes')
        : currentDataTab

    const tabBodyIds = {
        progress: 'progressTableBody',
        notes: 'notesTableBody',
        schedule: 'scheduleTableBody',
        classes: 'classAdminTableBody',
        classesUnits: 'classUnitsTableBody',
        tasks: 'tasksTableBody',
        myclass: 'myclassTableBody',
        studio: 'studioTableBody'
    }
    const activeBody = document.getElementById(tabBodyIds[activeTab] || '')
    if (activeBody) {
        if (activeBody.children.length === 0) {
            const cols = activeTab === 'schedule' ? 6 : 5
            activeBody.innerHTML = `<tr><td colspan="${cols}" class="text-center py-12 text-ink-muted font-bold">Loading records…</td></tr>`
        } else {
            activeBody.classList.add('opacity-50')
        }
    }

    try {
        const statusFilter = activeTab === 'notes'
            ? notesStatusFilter
            : activeTab === 'tasks'
                ? tasksStatusFilter
                : activeTab === 'studio'
                    ? studioTypeFilter
                    : 'all'

        const conf = sortConfig[activeTab] || { col: 'updated_at', dir: 'desc' }

        const { data, error } = await callAdminRpc('admin_list_records', {
            p_tab: activeTab,
            p_excluded_ids: excludedIds,
            p_search: search,
            p_tool_filter: tool,
            p_status_filter: statusFilter,
            p_sort_col: conf.col,
            p_sort_dir: conf.dir,
            p_page: pagination[activeTab] || 1,
            p_page_size: PAGE_SIZE,
            p_include_tab_counts: includeTabCounts
        })

        if (seq !== reqSeq.data) return
        if (error || !data) {
            showToast('Failed to load records', 'error')
            return
        }

        const total = Number(data.total) || 0
        const totalPages = Math.ceil(total / PAGE_SIZE) || 1
        if ((pagination[activeTab] || 1) > totalPages) {
            pagination[activeTab] = totalPages
            return loadDataDetailsTab(includeTabCounts)
        }

        const items = Array.isArray(data.items) ? data.items : []
        items.forEach(item => {
            if (item.user_id && item.display_name) {
                allProfiles[item.user_id] = { ...(allProfiles[item.user_id] || {}), id: item.user_id, display_name: item.display_name }
            }
        })

        if (data.tab_counts) {
            const tc = data.tab_counts
            const classAdminLen = Number(tc.classesAdmin) || 0
            const classUnitsLen = Number(tc.classesUnits) || 0
            const countMap = {
                progressCount: `${Number(tc.progress) || 0} row${tc.progress === 1 ? '' : 's'}`,
                notesCount: `${Number(tc.notes) || 0} note${tc.notes === 1 ? '' : 's'}`,
                scheduleCount: `${Number(tc.schedule) || 0} event${tc.schedule === 1 ? '' : 's'}`,
                classAdminCount: `${classAdminLen} class${classAdminLen === 1 ? '' : 'es'}`,
                classUnitsCount: `${classUnitsLen} class${classUnitsLen === 1 ? '' : 'es'}`,
                tasksCount: `${Number(tc.tasks) || 0} task${tc.tasks === 1 ? '' : 's'}`,
                myclassCount: `${Number(tc.myclass) || 0} class${tc.myclass === 1 ? '' : 'es'}`,
                studioCount: `${Number(tc.studio) || 0} item${tc.studio === 1 ? '' : 's'}`
            }
            Object.entries(countMap).forEach(([id, text]) => {
                const el = document.getElementById(id)
                if (el) el.textContent = text
            })

            const tabBadgeCounts = {
                'datatab-count-progress': Number(tc.progress) || 0,
                'datatab-count-notes': Number(tc.notes) || 0,
                'datatab-count-schedule': Number(tc.schedule) || 0,
                'datatab-count-classes': classAdminLen + classUnitsLen,
                'datatab-count-tasks': Number(tc.tasks) || 0,
                'datatab-count-myclass': Number(tc.myclass) || 0,
                'datatab-count-studio': Number(tc.studio) || 0,
                'classtab-count-admin': classAdminLen,
                'classtab-count-units': classUnitsLen
            }
            Object.entries(tabBadgeCounts).forEach(([id, count]) => {
                const el = document.getElementById(id)
                if (el) el.textContent = count
            })
        }

        updatePaginationBar(activeTab, total, pagination[activeTab], PAGE_SIZE)

        if (activeTab === 'progress') renderProgressTable(items)
        else if (activeTab === 'notes') renderNotesTable(items)
        else if (activeTab === 'schedule') renderScheduleTable(items)
        else if (activeTab === 'classes') renderClassesView(items, 'admin')
        else if (activeTab === 'classesUnits') renderClassesView(items, 'units')
        else if (activeTab === 'tasks') renderTasksTable(items)
        else if (activeTab === 'myclass') renderMyClassTable(items)
        else if (activeTab === 'studio') renderStudioTable(items)

        updateSortIcons(activeTab)
    } finally {
        if (seq === reqSeq.data && activeBody) activeBody.classList.remove('opacity-50')
    }
}

// ── PROGRESS TABLE ──
function renderProgressTable(rows) {
    const body = document.getElementById('progressTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No progress rows found</td></tr>'
        return
    }

    body.innerHTML = rows.map(row => {
        const meta = getToolMeta(row.tool_key)
        const preview = row.preview || 'Saved workspace'
        const date = row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
          <td class="px-5 py-3">${renderUserCell(row.user_id, 'blue', true, row.display_name)}</td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-0.5">
              <span class="chip bg-orange/10 text-orange border-orange/30 w-fit">${escapeHtml(meta.name)}</span>
              <span class="font-mono text-[9px] text-ink-muted">${escapeHtml(row.tool_key)}</span>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3 max-w-[260px]">
            <span class="text-xs text-ink-muted truncate block" title="${escapeHtml(preview)}">${escapeHtml(preview)}</span>
          </td>
          <td class="px-5 py-3 text-xs text-ink-muted whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openViewModal('${escapeJsAttr(row.user_id)}','${escapeJsAttr(row.tool_key)}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button type="button" onclick="openDeleteModal('${escapeJsAttr(row.user_id)}','${escapeJsAttr(row.tool_key)}','','${escapeJsAttr(row.display_name || '')}')" title="Delete progress row"
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
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No notes found</td></tr>'
        return
    }

    body.innerHTML = rows.map(note => {
        const ts = parseTimestampMs(note.updated_at)
        const date = ts ? new Date(ts).toLocaleString() : '—'
        const folderName = note.folder_name || note.folder_id || '—'
        const snippet = note.snippet || ''

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
          <td class="px-5 py-3">${renderUserCell(note.user_id, 'orange', true, note.display_name)}</td>
          <td class="px-5 py-3 max-w-[280px]">
            <div class="flex items-center gap-2">
              <span class="font-bold text-ink truncate">${escapeHtml(note.title || 'Untitled')}</span>
              ${note.deleted ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase flex-shrink-0">Trash</span>' : ''}
            </div>
            ${snippet ? `<div class="text-[11px] text-ink-muted truncate mt-0.5">${escapeHtml(snippet)}</div>` : ''}
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${note.folder_id ? `<span class="chip bg-orange/10 text-orange border-orange/30">${escapeHtml(folderName)}</span>` : '<span class="text-xs text-ink-muted italic">Root</span>'}
          </td>
          <td class="hidden sm:table-cell px-5 py-3 text-xs text-ink-muted whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openNoteModal('${escapeJsAttr(note.id)}','${escapeJsAttr(note.user_id)}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button type="button" onclick="openDeleteModal('${escapeJsAttr(note.id)}','note','${escapeJsAttr(note.user_id)}','${escapeJsAttr(note.title || 'Untitled')}')" title="Delete note"
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
        body.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-ink-muted font-bold">No schedule events found</td></tr>'
        return
    }
    const recurrenceLabels = { none: 'One-time', weekly: 'Weekly', daily: 'Daily', monthly: 'Monthly' }
    body.innerHTML = rows.map(ev => {
        const recLabel = recurrenceLabels[ev.recurrence] || ev.recurrence || 'One-time'
        const isRecurring = ev.recurrence && ev.recurrence !== 'none'
        return `<tr class="group transition-colors hover:bg-surface-muted/50">
          <td class="px-5 py-3">${renderUserCell(ev.user_id, 'orange', true, ev.display_name)}</td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${escapeHtml(ev.color || '#FF8C42')}"></div>
              <span class="font-bold text-ink">${escapeHtml(ev.name || 'Untitled Event')}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-blue/10 text-blue border-blue/30">${escapeHtml(ev.type_id || 'other')}</span>
          </td>
          <td class="px-5 py-3 text-xs text-ink whitespace-nowrap font-mono">${escapeHtml(ev.date || '—')}</td>
          <td class="hidden md:table-cell px-5 py-3">
            <span class="chip ${isRecurring ? 'bg-orange/10 text-orange border-orange/30' : 'bg-surface-muted text-ink-muted border-line-muted'}">${escapeHtml(recLabel)}</span>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openScheduleModal('${escapeJsAttr(ev.id)}')"
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
function renderClassesView(rows, subTab = 'admin') {
    if (subTab === 'admin') {
        const adminBody = document.getElementById('classAdminTableBody')
        if (!adminBody) return
        if (!rows || !rows.length) {
            adminBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No admin classes found</td></tr>'
            return
        }
        adminBody.innerHTML = rows.map(cls => {
            const taskCount = Number(cls.task_count) || 0
            const created = cls.created_at ? new Date(cls.created_at).toLocaleDateString() : '—'
            return `<tr class="group transition-colors hover:bg-surface-muted/50">
              <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false, cls.display_name)}</td>
              <td class="px-5 py-3"><span class="font-bold text-ink">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
              <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${taskCount} task${taskCount !== 1 ? 's' : ''}</span></td>
              <td class="hidden sm:table-cell px-5 py-3 text-xs text-ink-muted">${created}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button type="button" onclick="openClassModal('${escapeJsAttr(cls.id)}','admin')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                  </button>
                </div>
              </td>
            </tr>`
        }).join('')
        lucide.createIcons({ root: adminBody })
        return
    }

    const unitsBody = document.getElementById('classUnitsTableBody')
    if (!unitsBody) return
    if (!rows || !rows.length) {
        unitsBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No class units found</td></tr>'
        return
    }
    unitsBody.innerHTML = rows.map(cls => {
        const unitCount = Number(cls.unit_count) || 0
        const created = cls.created_at ? new Date(cls.created_at).toLocaleDateString() : '—'
        return `<tr class="group transition-colors hover:bg-surface-muted/50">
          <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false, cls.display_name)}</td>
          <td class="px-5 py-3"><span class="font-bold text-ink">${escapeHtml(cls.class_name || 'Untitled Class')}</span></td>
          <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${unitCount} unit${unitCount !== 1 ? 's' : ''}</span></td>
          <td class="hidden sm:table-cell px-5 py-3 text-xs text-ink-muted">${created}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onclick="openClassModal('${escapeJsAttr(cls.id)}','units')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: unitsBody })
}

function setClassTab(tab) {
    scheduleClassTab = tab
    document.getElementById('classview-admin').classList.toggle('hidden', tab !== 'admin')
    document.getElementById('classview-units').classList.toggle('hidden', tab !== 'units')
    const adminBtn = document.getElementById('classtab-admin')
    const unitsBtn = document.getElementById('classtab-units')
    adminBtn.className = `neo-btn px-4 py-2 ${tab === 'admin' ? 'bg-orange text-white font-bold' : 'bg-surface-muted text-ink'} rounded-xl text-sm`
    unitsBtn.className = `neo-btn px-4 py-2 ${tab === 'units' ? 'bg-orange text-white font-bold' : 'bg-surface-muted text-ink'} rounded-xl text-sm`
    if (currentView === 'data-details' && currentDataTab === 'classes') {
        loadDataDetailsTab(false)
    }
}

function setDataTab(tab, { load = true } = {}) {
    currentDataTab = tab
    const tabs = ['progress', 'notes', 'schedule', 'classes', 'tasks', 'myclass', 'studio']
    tabs.forEach(t => {
        const btn = document.getElementById('datatab-' + t)
        const view = document.getElementById('dataview-' + t)
        if (btn) {
            btn.className = `neo-btn px-4 py-2 ${t === tab ? 'bg-blue text-white font-bold' : 'bg-surface-muted text-ink'} rounded-xl text-sm`
        }
        if (view) {
            view.classList.toggle('hidden', t !== tab)
        }
    })
    if (load && currentView === 'data-details') {
        loadDataDetailsTab(false)
    }
}

// ── VIEW MODAL HELPERS & ON-DEMAND DETAIL INSPECTORS ──
function setViewModalState({ title, sub, html, copyText = '' }) {
    lastViewModalCopyText = copyText
    document.getElementById('viewModalTitle').textContent = title
    document.getElementById('viewModalSub').textContent = sub
    document.getElementById('viewModalContent').innerHTML = html
    const copyBtn = document.getElementById('viewModalCopyBtn')
    if (copyBtn) copyBtn.classList.toggle('hidden', !copyText)
    const modalBg = document.getElementById('viewModalBg')
    modalBg.classList.remove('hidden')
    lucide.createIcons({ root: modalBg })
}

function copyViewModalContent() {
    if (!lastViewModalCopyText) return
    copyTextToClipboard(lastViewModalCopyText, 'Modal content copied')
}

function showModalLoading(title, sub) {
    setViewModalState({
        title,
        sub,
        html: '<div class="text-ink-muted text-xs font-mono py-6 text-center">Loading full payload from Supabase…</div>',
        copyText: ''
    })
}

function showModalError(title, sub, msg) {
    setViewModalState({
        title,
        sub,
        html: `<div class="text-pink text-xs font-mono">${escapeHtml(msg)}</div>`,
        copyText: ''
    })
}

async function openClassModal(id, type) {
    const table = type === 'admin' ? 'myspace_class_admin' : 'myspace_class_units'
    const label = type === 'admin' ? 'Admin Tasks' : 'Syllabus Units'
    showModalLoading(`Loading ${label}…`, `ID: ${id}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: table,
        p_id: String(id),
        p_user_id: null
    })
    if (error || !data?.record) {
        return showModalError(label, `ID: ${id}`, error?.message || 'Record not found')
    }
    const item = data.record
    const owner = data.owner_name || String(item.user_id || '').slice(0, 8)
    const payload = type === 'admin' ? item.tasks : item.syllabus
    const jsonText = JSON.stringify(payload, null, 2)
    setViewModalState({
        title: `${item.class_name} — ${label}`,
        sub: `${owner} · ${item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

async function openNoteModal(noteId, userId = null) {
    showModalLoading('Loading Note…', `ID: ${noteId}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: 'notes',
        p_id: String(noteId),
        p_user_id: userId || null
    })
    if (error || !data?.record) {
        return showModalError('Lesson Note', `ID: ${noteId}`, error?.message || 'Note not found')
    }
    const note = data.record
    const owner = data.owner_name || String(note.user_id || '').slice(0, 8)
    const folderLabel = note.folder_id ? (data.folder_name || note.folder_id) : 'Root'
    const content = note.content || ''
    const ts = parseTimestampMs(note.updated_at)
    setViewModalState({
        title: `${owner} — ${note.title || 'Untitled'}`,
        sub: `Folder: ${folderLabel}${note.deleted ? ' · TRASHED' : ''} · Updated ${ts ? new Date(ts).toLocaleString() : '—'}`,
        html: `<pre class="text-ink whitespace-pre-wrap font-mono text-xs">${escapeHtml(content || '(Empty note)')}</pre>`,
        copyText: content
    })
}

async function openScheduleModal(id) {
    showModalLoading('Loading Schedule Event…', `ID: ${id}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: 'myspace_events',
        p_id: String(id),
        p_user_id: null
    })
    if (error || !data?.record) {
        return showModalError('Schedule Event', `ID: ${id}`, error?.message || 'Event not found')
    }
    const ev = data.record
    const owner = data.owner_name || String(ev.user_id || '').slice(0, 8)
    const jsonText = JSON.stringify(ev, null, 2)
    setViewModalState({
        title: `Schedule Event — ${ev.name || 'Untitled Event'}`,
        sub: `Owner: ${owner} · Date: ${ev.date || '—'} · Type: ${ev.type_id || 'other'}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

async function openViewModal(userId, toolKey) {
    const meta = getToolMeta(toolKey)
    const profile = allProfiles[userId]
    showModalLoading(`${profile?.display_name || String(userId).slice(0, 8)} — ${meta.name}`, `Tool key: ${toolKey}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: 'user_progress',
        p_id: String(toolKey),
        p_user_id: userId
    })
    if (error || !data?.record) {
        return showModalError(`${meta.name} (${toolKey})`, `User: ${userId}`, error?.message || 'Progress record not found')
    }
    const row = data.record
    const owner = data.owner_name || profile?.display_name || String(userId).slice(0, 8)
    const jsonText = JSON.stringify(row.data, null, 2)
    setViewModalState({
        title: `${owner} — ${meta.name} (${toolKey})`,
        sub: `Updated ${row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

function closeViewModal() {
    document.getElementById('viewModalBg').classList.add('hidden')
    lastViewModalCopyText = ''
}

// ── VIEW USER (On-Demand RPC) ──
async function viewUser(userId) {
    const cached = allProfiles[userId] || {}
    showModalLoading(`${cached.display_name || String(userId).slice(0, 8)} — Profile Details`, `UID: ${userId}`)

    let data = null
    let error = null
    if (adminRpcCapabilities.userDetailTz) {
        ;({ data, error } = await callAdminRpc('admin_get_user_detail', {
            p_user_id: userId,
            p_tz_offset_min: getLocalTzOffsetMin()
        }, { silent: true }))
        if (error?.code === 'PGRST202') {
            adminRpcCapabilities.userDetailTz = false
            const retry = await callAdminRpc('admin_get_user_detail', { p_user_id: userId })
            data = retry.data
            error = retry.error
        } else if (error) {
            showToast('Error loading user detail: ' + error.message, 'error')
        }
    } else {
        ;({ data, error } = await callAdminRpc('admin_get_user_detail', { p_user_id: userId }))
    }
    if (error || !data?.profile) {
        return showModalError('User Profile', `UID: ${userId}`, error?.message || 'Profile not found')
    }

    const profile = data.profile
    allProfiles[userId] = { ...(allProfiles[userId] || {}), ...profile }

    const counts = data.counts || {}
    const canonicalList = Array.isArray(data.canonical_counts) ? data.canonical_counts : []
    const recentNotes = Array.isArray(data.recent_notes) ? data.recent_notes : []
    const openTabs = Array.isArray(data.open_tabs) ? data.open_tabs : []
    const recentSessions = Array.isArray(data.recent_sessions) ? data.recent_sessions : []
    const recentLogs = Array.isArray(data.recent_logs) ? data.recent_logs : []

    const hasPhase6Telemetry = counts.total_activity !== undefined || counts.total_logs !== undefined || counts.sessions !== undefined || counts.tab_opens !== undefined
    const name = profile.display_name || String(userId).slice(0, 8)
    const email = profile.email || '—'
    const role = profile.role || 'user'
    const formatTs = (ts) => {
        const ms = parseTimestampMs(ts)
        return ms ? new Date(ms).toLocaleString() : '—'
    }

    const usedBytes = Number(profile.storage_usage) || 0
    const limitBytes = Number(profile.storage_limit) || USER_DEFAULT_STORAGE_LIMIT
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(2)
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(0)
    const storagePct = Math.min(100, Math.round((usedBytes / limitBytes) * 100))

    const html = `
        <div class="space-y-5 text-ink">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(userId)}', 'User ID copied')"
                        class="neo-btn px-3 py-1.5 bg-surface-muted text-ink rounded-xl text-xs">
                        <i data-lucide="copy" class="w-3.5 h-3.5 text-blue"></i> Copy User ID
                    </button>
                    ${email !== '—' ? `
                    <button type="button" onclick="copyTextToClipboard('${escapeJsAttr(email)}', 'Email copied')"
                        class="neo-btn px-3 py-1.5 bg-surface-muted text-ink rounded-xl text-xs">
                        <i data-lucide="mail" class="w-3.5 h-3.5 text-orange"></i> Copy Email
                    </button>` : ''}
                </div>
                <button type="button" onclick="filterDataByUser('${escapeJsAttr(userId)}')"
                    class="neo-btn px-3.5 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="database" class="w-3.5 h-3.5"></i> View User's Data →
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="neo bg-surface-muted p-3.5 border-2 border-line-muted">
                    <div class="text-[10px] text-ink-muted uppercase font-black mb-1">Email / Auth</div>
                    <div class="text-xs text-ink font-bold break-all">${escapeHtml(email)}</div>
                </div>
                <div class="neo bg-surface-muted p-3.5 border-2 border-line-muted">
                    <div class="text-[10px] text-ink-muted uppercase font-black mb-1">User ID</div>
                    <div class="text-[11px] text-ink-muted font-mono break-all">${escapeHtml(userId)}</div>
                </div>
                <div class="neo bg-surface-muted p-3.5 border-2 border-line-muted">
                    <div class="flex justify-between text-[10px] text-ink-muted uppercase font-black mb-1">
                        <span>Cloud Storage</span>
                        <span class="text-blue font-mono">${storagePct}%</span>
                    </div>
                    <div class="text-xs text-ink font-bold mb-1.5">${usedMB} MB / ${limitMB} MB</div>
                    <div class="h-1.5 bg-card rounded-full overflow-hidden border border-line-muted">
                        <div class="h-full bg-blue rounded-full" style="width:${storagePct}%"></div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-blue mb-0.5">${Number(counts.progress_rows) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Tool Rows</div>
                </div>
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-orange mb-0.5">${Number(counts.notes) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Notes</div>
                </div>
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-green mb-0.5">${Number(counts.classes) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Classes (${Number(counts.total_students) || 0} stu)</div>
                </div>
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-pink mb-0.5">${Number(counts.events) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Events</div>
                </div>
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-blue mb-0.5">${Number(counts.tasks_completed) || 0}/${Number(counts.tasks) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Tasks Done</div>
                </div>
                <div class="neo bg-card p-3 text-center border-2 border-line-muted">
                    <div class="text-xl font-heading text-orange mb-0.5">${Number(counts.studio_workshop) || 0}</div>
                    <div class="text-[9px] uppercase font-bold text-ink-muted">Studio & Workshop</div>
                </div>
            </div>

            ${hasPhase6Telemetry ? `
            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2">
                    <i data-lucide="activity" class="w-4 h-4 text-green"></i>
                    Hub Telemetry & Sessions
                    <span class="text-[10px] font-mono font-normal text-ink-muted ml-auto">${Number(counts.active_days) || 0} active days · ${Number(counts.total_activity) || 0} total actions</span>
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div class="bg-card p-2.5 rounded-xl border border-line-muted">
                        <div class="text-[10px] font-bold uppercase text-ink-muted">Cloud Saves</div>
                        <div class="font-heading text-lg text-blue">${Number(counts.total_saves) || 0}</div>
                    </div>
                    <div class="bg-card p-2.5 rounded-xl border border-line-muted">
                        <div class="text-[10px] font-bold uppercase text-ink-muted">Tab Opens</div>
                        <div class="font-heading text-lg text-orange">${Number(counts.tab_opens) || 0}</div>
                    </div>
                    <div class="bg-card p-2.5 rounded-xl border border-line-muted">
                        <div class="text-[10px] font-bold uppercase text-ink-muted">Sessions</div>
                        <div class="font-heading text-lg text-green">${Number(counts.sessions) || 0}</div>
                        ${(counts.sessions_7d !== undefined || counts.sessions_30d !== undefined) ? `<div class="text-[10px] font-mono text-ink-muted">7d: ${Number(counts.sessions_7d) || 0} · 30d: ${Number(counts.sessions_30d) || 0}</div>` : ''}
                    </div>
                    <div class="bg-card p-2.5 rounded-xl border border-line-muted">
                        <div class="text-[10px] font-bold uppercase text-ink-muted">Audit Logs</div>
                        <div class="font-heading text-lg text-pink">${Number(counts.total_logs) || 0}</div>
                    </div>
                </div>
            </div>` : ''}

            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2">
                    <i data-lucide="grid-2x2" class="w-4 h-4 text-blue"></i>
                    Adopted Tools & Activity Volume (${canonicalList.length})
                    <span class="text-[10px] font-body font-normal text-ink-muted ml-auto">Click tool to inspect</span>
                </h3>
                ${canonicalList.length ? `
                <div class="flex flex-wrap gap-2">
                    ${canonicalList.map(item => {
                        const cid = item.canonical_tool
                        const meta = getToolMeta(cid)
                        const hasBreakdown = item.saves !== undefined || item.tab_opens !== undefined
                        const countText = hasBreakdown
                            ? `(${Number(item.count) || 0} · ${Number(item.saves) || 0}S / ${Number(item.tab_opens) || 0}O)`
                            : `(${Number(item.count) || 0})`
                        return `<button type="button" onclick="filterDataByUser('${escapeJsAttr(userId)}', '${escapeJsAttr(cid)}')"
                            class="chip bg-blue/10 text-blue border-blue/40 hover:bg-blue/20 transition-colors cursor-pointer">${escapeHtml(meta.name)} <span class="ml-1 opacity-80 font-mono">${countText}</span></button>`
                    }).join('')}
                </div>
                ` : '<div class="text-xs text-ink-muted italic">No tool activity</div>'}
            </div>

            ${openTabs.length ? `
            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2">
                    <i data-lucide="panel-top" class="w-4 h-4 text-orange"></i>
                    Open Workspace Tabs (${openTabs.length})
                </h3>
                <div class="flex flex-wrap gap-2">
                    ${openTabs.map(tab => {
                        const meta = getToolMeta(tab.gameId || '')
                        const label = tab.title || meta.name || tab.gameId || 'Tab'
                        return `<span class="chip ${tab.pinned ? 'bg-orange/15 text-orange border-orange/40' : 'bg-card text-ink border-line-muted'}">
                            ${tab.pinned ? '📌 ' : ''}${escapeHtml(label)}
                        </span>`
                    }).join('')}
                </div>
            </div>` : ''}

            ${recentSessions.length ? `
            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2">
                    <i data-lucide="monitor-smartphone" class="w-4 h-4 text-green"></i>
                    Recent Hub Sessions (${recentSessions.length})
                </h3>
                <div class="space-y-1.5 text-xs">
                    ${recentSessions.map(s => `
                        <div class="flex flex-wrap justify-between items-center gap-2 bg-card px-3 py-2 rounded-xl border border-line-muted">
                            <span class="font-bold text-ink truncate max-w-[260px]" title="${escapeHtml(s.device || 'Browser')}">${escapeHtml(s.device || 'Browser')}</span>
                            <span class="font-mono text-[11px] text-ink-muted">Last seen: ${formatTs(s.last_seen || s.created_at)}</span>
                        </div>`).join('')}
                </div>
            </div>` : ''}

            ${recentLogs.length ? `
            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2">
                    <i data-lucide="scroll-text" class="w-4 h-4 text-pink"></i>
                    Recent Audit Events (${recentLogs.length})
                </h3>
                <div class="space-y-1.5 max-h-56 overflow-y-auto scrollbar text-xs">
                    ${recentLogs.map(log => {
                        const badgeCls = log.action_type === 'tab_open'
                            ? 'bg-orange/10 text-orange border-orange/30'
                            : (log.action_type === 'session' ? 'bg-green/10 text-green border-green/30' : 'bg-blue/10 text-blue border-blue/30')
                        const target = log.label || log.canonical_tool || log.tool_key || 'hub'
                        return `
                        <div class="flex flex-wrap items-center justify-between gap-2 bg-card px-3 py-1.5 rounded-xl border border-line-muted">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="chip ${badgeCls}">${escapeHtml(log.action_type || 'event')}</span>
                                <span class="font-bold text-ink truncate">${escapeHtml(target)}</span>
                                ${log.source ? `<span class="font-mono text-[10px] text-ink-muted">${escapeHtml(log.source)}</span>` : ''}
                            </div>
                            <span class="font-mono text-[11px] text-ink-muted whitespace-nowrap">${formatTs(log.event_ts)}</span>
                        </div>`
                    }).join('')}
                </div>
            </div>` : ''}

            <div class="neo bg-surface-muted p-4 border-2 border-line-muted">
                <h3 class="font-heading text-sm text-ink mb-3 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-orange"></i> Recent Notes</h3>
                ${recentNotes.length ? `
                <ul class="space-y-1.5 text-xs">
                    ${recentNotes.map(n => `
                        <li>
                            <button type="button" onclick="openNoteModal('${escapeJsAttr(n.id)}', '${escapeJsAttr(userId)}')"
                                class="w-full flex justify-between items-center border-b border-line-muted pb-2 pt-1 px-2 rounded-lg hover:bg-card transition-colors text-left">
                                <span class="font-bold text-ink truncate mr-4 flex items-center gap-2">
                                    ${escapeHtml(n.title || 'Untitled')}
                                    ${n.deleted ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase">Trash</span>' : ''}
                                </span>
                                <span class="text-ink-muted font-mono whitespace-nowrap flex items-center gap-2">
                                    ${formatTs(n.updated_at)}
                                    <i data-lucide="external-link" class="w-3 h-3 text-blue"></i>
                                </span>
                            </button>
                        </li>`).join('')}
                </ul>
                ` : '<div class="text-xs text-ink-muted italic">No notes</div>'}
            </div>
        </div>
    `

    const roleLabel = role === 'pro' ? '⭐ PRO USER' : role === 'admin' ? '🛡️ ADMIN' : '👤 USER'
    const lastActiveStr = profile.last_active_ts ? formatTs(profile.last_active_ts) : 'Never'
    setViewModalState({
        title: `${name} — Profile Details`,
        sub: `Role: ${roleLabel} · Last Active: ${lastActiveStr}`,
        html,
        copyText: ''
    })
}

// ── DELETE MODAL ──
function openDeleteModal(idOrUser, toolOrType, extraUserId = '', extraTitle = '') {
    let title = 'Delete Item?'
    let msg = 'This action cannot be undone.'

    if (toolOrType === 'announcement') {
        const ann = allAnnouncements.find(a => String(a.id) === String(idOrUser))
        title = 'Delete Announcement?'
        msg = `Permanently delete "${ann?.title || extraTitle || 'this announcement'}"?`
        pendingDelete = { id: idOrUser, type: 'announcement' }
    } else if (toolOrType === 'note') {
        title = 'Delete Note?'
        msg = `Permanently delete note "${extraTitle || 'Untitled'}"?`
        pendingDelete = { id: idOrUser, userId: extraUserId || null, type: 'note' }
    } else if (toolOrType === 'cloud-storage') {
        const profile = allProfiles[idOrUser]
        const name = profile?.display_name || extraTitle || String(idOrUser).slice(0, 8)
        const usedMB = ((profile?.storage_usage || 0) / (1024 * 1024)).toFixed(1)
        title = 'Clear Cloud Storage?'
        msg = `Permanently delete all cloud media files (${usedMB} MB) for "${name}"? This cannot be undone.`
        pendingDelete = { userId: idOrUser, type: 'cloud-storage' }
    } else {
        const profile = allProfiles[idOrUser]
        const name = extraTitle || profile?.display_name || String(idOrUser).slice(0, 8)
        title = 'Delete Progress?'
        msg = `This will permanently delete "${toolOrType}" data for ${name}.`
        pendingDelete = { userId: idOrUser, toolKey: toolOrType, type: 'progress' }
    }

    document.getElementById('deleteModalTitle').textContent = title
    document.getElementById('deleteModalMsg').textContent = msg
    document.getElementById('deleteModalBg').classList.remove('hidden')
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
                if (typeof loadAnnouncements === 'function') await loadAnnouncements()
            }
        } else if (pendingDelete.type === 'note') {
            let query = db.from('notes').delete().eq('id', pendingDelete.id)
            if (pendingDelete.userId) query = query.eq('user_id', pendingDelete.userId)
            const { error } = await query
            if (error) showToast('Error: ' + error.message, 'error')
            else {
                showToast('Note deleted')
                await loadDashboardSummary()
                if (currentView === 'data-details') await loadDataDetailsTab(true)
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

            if (error) showToast('Error: ' + error.message, 'error')
            else {
                showToast('Progress data deleted')
                await loadDashboardSummary()
                if (currentView === 'data-details') await loadDataDetailsTab(true)
            }
        }
    } finally {
        if (shouldClose) closeDeleteModal()
    }
}

// ── MY SPACE TASKS VIEW ──
function renderTasksTable(tasks) {
    const body = document.getElementById('tasksTableBody')
    if (!body) return

    if (!tasks || !tasks.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No tasks found</td></tr>'
        return
    }

    body.innerHTML = tasks.map(task => {
        const statusColor = task.completed ? 'green' : (task.priority === 'high' ? 'pink' : 'blue')
        const statusLabel = task.completed ? 'Completed' : (task.priority || 'Medium')
        const statusCls = CHIP_COLOR_STYLES[statusColor] || CHIP_COLOR_STYLES.blue

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
            <td class="px-5 py-3">${renderUserCell(task.user_id, 'blue', false, task.display_name)}</td>
            <td class="px-5 py-3"><span class="font-bold text-ink ${task.completed ? 'line-through opacity-60' : ''}">${escapeHtml(task.text)}</span></td>
            <td class="px-5 py-3"><span class="chip bg-surface-muted text-ink-muted border-line-muted">${escapeHtml(task.category || 'General')}</span></td>
            <td class="px-5 py-3"><span class="chip ${statusCls}">${escapeHtml(statusLabel)}</span></td>
            <td class="px-5 py-3 text-right">
                <button type="button" onclick="openTaskModal('${escapeJsAttr(task.id)}')" class="neo-btn px-3 py-1.5 bg-surface-muted text-ink rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

async function openTaskModal(id) {
    showModalLoading('Loading Task Detail…', `ID: ${id}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: 'myspace_tasks',
        p_id: String(id),
        p_user_id: null
    })
    if (error || !data?.record) {
        return showModalError('Task Detail', `ID: ${id}`, error?.message || 'Task not found')
    }
    const task = data.record
    const owner = data.owner_name || 'User'
    const jsonText = JSON.stringify(task, null, 2)
    setViewModalState({
        title: `Task Detail — ${owner}`,
        sub: `ID: ${task.id} · Created: ${task.created_at ? new Date(task.created_at).toLocaleString() : '—'}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

// ── MY CLASS VIEW ──
function renderMyClassTable(rows) {
    const body = document.getElementById('myclassTableBody')
    if (!body) return

    if (!rows || !rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No class records found</td></tr>'
        return
    }

    body.innerHTML = rows.map(cls => {
        const updated = cls.updated_at ? new Date(cls.updated_at).toLocaleDateString() : '—'
        const stuCount = Number(cls.student_count) || 0
        const attDays = Number(cls.att_days) || 0
        const refCount = Number(cls.ref_count) || 0

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
            <td class="px-5 py-3">${renderUserCell(cls.user_id, 'orange', false, cls.display_name)}</td>
            <td class="px-5 py-3"><span class="font-bold text-ink">${escapeHtml(cls.class_name)}</span></td>
            <td class="px-5 py-3">
                <div class="flex flex-wrap gap-1.5">
                    <span class="chip bg-green/10 text-green border-green/30">${stuCount} student${stuCount === 1 ? '' : 's'}</span>
                    ${attDays > 0 ? `<span class="chip bg-blue/10 text-blue border-blue/30">${attDays} att day${attDays === 1 ? '' : 's'}</span>` : ''}
                    ${refCount > 0 ? `<span class="chip bg-orange/10 text-orange border-orange/30">${refCount} refl</span>` : ''}
                </div>
            </td>
            <td class="px-5 py-3 text-xs text-ink-muted font-mono">${updated}</td>
            <td class="px-5 py-3 text-right">
                <button type="button" onclick="openMyClassRowModal('${escapeJsAttr(cls.id)}')" class="neo-btn px-3 py-1.5 bg-surface-muted text-ink rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

async function openMyClassRowModal(id) {
    showModalLoading('Loading Class Data…', `ID: ${id}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: 'myspace_my_class',
        p_id: String(id),
        p_user_id: null
    })
    if (error || !data?.record) {
        return showModalError('Class Data', `ID: ${id}`, error?.message || 'Class record not found')
    }
    const cls = data.record
    const owner = data.owner_name || 'Unknown'
    const classPayload = {
        students: cls.students ?? [],
        attendance: cls.attendance ?? {},
        skills: cls.skills ?? [],
        student_skills: cls.student_skills ?? {},
        reflections: cls.reflections ?? []
    }
    const jsonText = JSON.stringify(classPayload, null, 2)
    setViewModalState({
        title: `Class Data — ${cls.class_name}`,
        sub: `Teacher: ${owner} · Updated: ${cls.updated_at ? new Date(cls.updated_at).toLocaleString() : '—'}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

// ── STUDIO, MAKERS & WORKSHOP VIEW ──
function renderStudioTable(items) {
    const body = document.getElementById('studioTableBody')
    if (!body) return

    if (!items || !items.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-ink-muted font-bold">No studio, maker, or workshop items found</td></tr>'
        return
    }

    body.innerHTML = items.map(item => {
        const tsMs = parseTimestampMs(item.ts)
        const dateStr = tsMs ? new Date(tsMs).toLocaleString() : '—'
        const chipCls = CHIP_COLOR_STYLES[item.color] || CHIP_COLOR_STYLES.blue

        return `<tr class="group transition-colors hover:bg-surface-muted/50">
            <td class="px-5 py-3">${renderUserCell(item.user_id, item.color, true, item.display_name)}</td>
            <td class="px-5 py-3">
                <span class="chip ${chipCls}">${escapeHtml(item.type_label)}</span>
            </td>
            <td class="px-5 py-3">
                <span class="font-bold text-ink">${escapeHtml(item.title)}</span>
            </td>
            <td class="px-5 py-3 text-xs text-ink-muted font-mono whitespace-nowrap">${dateStr}</td>
            <td class="px-5 py-3 text-right">
                <button type="button" onclick="openStudioModal('${escapeJsAttr(item.table)}', '${escapeJsAttr(item.id)}')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <i data-lucide="eye" class="w-3 h-3"></i> Inspect
                </button>
            </td>
        </tr>`
    }).join('')
    lucide.createIcons({ root: body })
}

async function openStudioModal(table, id) {
    showModalLoading(`Inspecting ${table}…`, `ID: ${id}`)

    const { data, error } = await callAdminRpc('admin_get_record_detail', {
        p_table: table,
        p_id: String(id),
        p_user_id: null
    })
    if (error || !data?.record) {
        return showModalError(`Inspecting ${table}`, `ID: ${id}`, error?.message || 'Record not found')
    }
    const rec = data.record
    const uid = data.owner_id || rec.user_id || rec.owner_id
    const owner = data.owner_name || uid || 'Unknown'
    const title = rec.title || rec.unit_title || rec.name || id
    const jsonText = JSON.stringify(rec, null, 2)
    setViewModalState({
        title: `${title} (${table})`,
        sub: `Owner: ${owner}`,
        html: `<pre class="text-emerald-700 dark:text-green whitespace-pre-wrap font-mono text-xs">${escapeHtml(jsonText)}</pre>`,
        copyText: jsonText
    })
}

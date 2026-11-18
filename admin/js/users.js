// KlassKit Admin — Users, Data Details, Studio & Modals

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
                allNotes = allNotes.filter(n => n.id !== pendingDelete.id)
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


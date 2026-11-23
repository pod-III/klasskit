// KlassKit Admin — Audit Logs & Announcements (RPC / Bounded Queries)

// ── LOGS ──
async function renderLogsTable() {
    const body = document.getElementById('logsTableBody')
    if (!body) return

    const seq = ++reqSeq.logs
    const excludedIds = getValidExcludedUserIds()
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.trim() : ''
    const tool = toolFilter ? toolFilter.value : ''

    const { data, error } = await callAdminRpc('admin_list_audit_events', {
        p_excluded_ids: excludedIds,
        p_search: search,
        p_tool_filter: tool,
        p_limit: 250,
        p_offset: 0
    })

    if (seq !== reqSeq.logs) return
    if (error || !data) {
        body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-pink font-bold">Failed to load audit events</td></tr>'
        return
    }

    const total = Number(data.total) || 0
    const logEntries = Array.isArray(data.items) ? data.items : []

    const logsCountChip = document.getElementById('logsCountChip')
    if (logsCountChip) {
        logsCountChip.textContent = `${logEntries.length} of ${total} events`
    }

    if (!logEntries.length) {
        body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 font-bold">No log entries found</td></tr>'
        return
    }

    body.innerHTML = logEntries.map(entry => {
        const name = entry.display_name || String(entry.user_id || '').slice(0, 8)
        const tsDate = new Date(entry.event_ts)
        const time = tsDate.toLocaleTimeString()
        const date = tsDate.toLocaleDateString()
        const initial = name[0]?.toUpperCase() || '?'
        const meta = getToolMeta(entry.canonical_tool || entry.tool_key)

        return `<tr class="group transition-all hover:bg-white/5 border-l-4 border-transparent hover:border-blue">
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-white font-mono text-xs">${time}</span>
                    <span class="text-[9px] text-slate-500 font-mono">${date}</span>
                </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3 cursor-pointer" onclick="viewUser('${escapeJsAttr(entry.user_id)}')">
                <div class="w-8 h-8 rounded-lg bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-blue group-hover:text-blue transition-colors">${escapeHtml(initial)}</div>
                <div class="flex flex-col">
                    <span class="text-white font-bold text-xs tracking-tight group-hover:text-blue transition-colors">${escapeHtml(name)}</span>
                    <span class="text-[9px] text-slate-500 font-mono">UID: ${escapeHtml(String(entry.user_id || '').slice(0, 8))}</span>
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

// ── ANNOUNCEMENTS LOGIC ──
async function loadAnnouncements() {
    const seq = ++reqSeq.announcements
    const { data, error } = await db
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

    if (seq !== reqSeq.announcements) return
    if (error) {
        console.warn('[Admin] Failed to load announcements:', error.message)
        return
    }
    allAnnouncements = data || []
    renderAnnouncements()
}

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
        await loadAnnouncements()
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
                                    <button onclick="editAnnouncement('${escapeJsAttr(ann.id)}')" class="text-[10px] font-black text-blue hover:underline uppercase tracking-widest">Modify</button>
                                    <span class="text-slate-700">|</span>
                                    <button onclick="openDeleteModal('${escapeJsAttr(ann.id)}', 'announcement')" class="text-[10px] font-black text-pink hover:underline uppercase tracking-widest">Terminate</button>
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

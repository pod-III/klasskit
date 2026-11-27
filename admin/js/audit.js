// KlassKit Admin — Audit Logs & Announcements (RPC / Bounded Queries)

const AUDIT_SOURCE_STYLES = {
    session:  { label: 'Session',  cls: 'bg-pink/10 text-pink border-pink/30' },
    tab_open: { label: 'Tab Open', cls: 'bg-orange/10 text-orange border-orange/30' },
    progress: { label: 'Progress', cls: 'bg-blue/10 text-blue border-blue/30' },
    notes:    { label: 'Note',     cls: 'bg-green/10 text-green border-green/30' }
}

const ANNOUNCEMENT_TYPE_STYLES = {
    info:    { icon: 'info',           rowHover: 'hover:border-blue',   box: 'bg-blue/10 border-blue/20',     text: 'text-blue',   badge: 'bg-blue/10 text-blue border-blue/20' },
    update:  { icon: 'zap',            rowHover: 'hover:border-green',  box: 'bg-green/10 border-green/20',   text: 'text-green',  badge: 'bg-green/10 text-green border-green/20' },
    feature: { icon: 'sparkles',       rowHover: 'hover:border-green',  box: 'bg-green/10 border-green/20',   text: 'text-green',  badge: 'bg-green/10 text-green border-green/20' },
    alert:   { icon: 'alert-triangle', rowHover: 'hover:border-pink',   box: 'bg-pink/10 border-pink/20',     text: 'text-pink',   badge: 'bg-pink/10 text-pink border-pink/20' },
    warning: { icon: 'alert-triangle', rowHover: 'hover:border-orange', box: 'bg-orange/10 border-orange/20', text: 'text-orange', badge: 'bg-orange/10 text-orange border-orange/20' }
}

function setAuditSourceFilter(source) {
    auditSourceFilter = source || 'all'
    if (typeof setPillGroupActive === 'function') {
        setPillGroupActive('logsfilter', auditSourceFilter, ['all', 'saves', 'logs', 'session', 'tab_open'])
    }
    pagination.logs = 1
    renderLogsTable()
}

// ── LOGS ──
async function renderLogsTable() {
    const body = document.getElementById('logsTableBody')
    if (!body) return

    const seq = ++reqSeq.logs
    if (body.children.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-ink-muted font-bold">Loading audit events…</td></tr>'
    } else {
        body.classList.add('opacity-50')
    }

    try {
        const excludedIds = getValidExcludedUserIds()
        const searchInput = document.getElementById('searchInput')
        const toolFilter = document.getElementById('toolFilter')
        const search = searchInput ? searchInput.value.trim() : ''
        const tool = toolFilter ? toolFilter.value : ''
        const page = pagination.logs || 1
        const offset = (page - 1) * LOGS_PAGE_SIZE

        const baseParams = {
            p_excluded_ids: excludedIds,
            p_search: search,
            p_tool_filter: tool,
            p_limit: LOGS_PAGE_SIZE,
            p_offset: offset
        }
        let data = null
        let error = null

        if (adminRpcCapabilities.auditSourceFilter) {
            ;({ data, error } = await callAdminRpc('admin_list_audit_events', {
                ...baseParams,
                p_source_filter: auditSourceFilter || 'all'
            }, { silent: true }))

            if (error?.code === 'PGRST202') {
                adminRpcCapabilities.auditSourceFilter = false
                ;({ data, error } = await callAdminRpc('admin_list_audit_events', baseParams))
            } else if (error) {
                console.error('[AdminRPC] admin_list_audit_events failed:', error)
            }
        } else {
            ;({ data, error } = await callAdminRpc('admin_list_audit_events', baseParams))
        }

        if (seq !== reqSeq.logs) return
        if (error || !data) {
            body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-pink font-bold">Failed to load audit events</td></tr>'
            return
        }

        const total = Number(data.total) || 0
        const totalPages = Math.ceil(total / LOGS_PAGE_SIZE) || 1
        if (page > totalPages) {
            pagination.logs = totalPages
            return renderLogsTable()
        }

        const logEntries = Array.isArray(data.items) ? data.items : []

        if (typeof updatePaginationBar === 'function') {
            updatePaginationBar('logs', total, page, LOGS_PAGE_SIZE)
        }

        const logsCountChip = document.getElementById('logsCountChip')
        if (logsCountChip) {
            logsCountChip.textContent = `${total} event${total === 1 ? '' : 's'}`
        }

        if (!logEntries.length) {
            body.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-ink-muted font-bold">No log entries found</td></tr>'
            return
        }

        body.innerHTML = logEntries.map(entry => {
            const name = entry.display_name || String(entry.user_id || '').slice(0, 8)
            const tsDate = new Date(entry.event_ts)
            const time = tsDate.toLocaleTimeString()
            const date = tsDate.toLocaleDateString()
            const initial = name[0]?.toUpperCase() || '?'
            const meta = getToolMeta(entry.canonical_tool || entry.tool_key)
            const srcKey = String(entry.source || 'saves').toLowerCase()
            const srcStyle = AUDIT_SOURCE_STYLES[srcKey] || { label: srcKey.replace(/_/g, ' '), cls: 'bg-blue/10 text-blue border-blue/30' }

            return `<tr class="group transition-all hover:bg-surface-muted/60 border-l-4 border-transparent hover:border-blue">
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-ink font-mono text-xs font-bold">${time}</span>
                        <span class="text-[9px] text-ink-muted font-mono">${date}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3 cursor-pointer" onclick="viewUser('${escapeJsAttr(entry.user_id)}')">
                    <div class="w-8 h-8 rounded-lg bg-surface-muted border-2 border-line-muted flex items-center justify-center text-[10px] font-black text-ink-muted group-hover:border-blue group-hover:text-blue transition-colors">${escapeHtml(initial)}</div>
                    <div class="flex flex-col">
                        <span class="text-ink font-bold text-xs tracking-tight group-hover:text-blue transition-colors">${escapeHtml(name)}</span>
                        <span class="text-[9px] text-ink-muted font-mono">UID: ${escapeHtml(String(entry.user_id || '').slice(0, 8))}</span>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <div class="w-2 h-2 rounded-full shrink-0" style="background:${meta.color}"></div>
                      <span class="text-ink font-black text-[10px] uppercase tracking-widest">${escapeHtml(entry.action_type || 'Save_Log_Entry')}</span>
                      <span class="chip !text-[9px] !py-0 !px-2 ${srcStyle.cls}">${escapeHtml(srcStyle.label)}</span>
                    </div>
                    ${entry.label ? `<span class="text-[10px] text-ink-muted font-mono pl-4 truncate max-w-[280px]">${escapeHtml(String(entry.label))}</span>` : ''}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col gap-0.5">
                    <span class="chip bg-surface-muted border-line-muted w-fit" style="color:${meta.color}">${escapeHtml(meta.name)}</span>
                    <span class="text-[9px] font-mono text-ink-muted">${escapeHtml(entry.tool_key)}</span>
                  </div>
                </td>
              </tr>`
        }).join('')
    } finally {
        if (seq === reqSeq.logs) body.classList.remove('opacity-50')
    }
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
        list.innerHTML = '<div class="p-12 text-center text-ink-muted font-bold">No announcements created yet.</div>'
        return
    }

    list.innerHTML = allAnnouncements.map(ann => {
        const date = new Date(ann.created_at).toLocaleDateString()
        const style = ANNOUNCEMENT_TYPE_STYLES[ann.type] || ANNOUNCEMENT_TYPE_STYLES.info

        return `
            <div class="p-6 hover:bg-surface-muted/60 transition-all group relative border-l-4 border-transparent ${style.rowHover}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex gap-4">
                        <div class="w-10 h-10 rounded-xl border-2 flex items-center justify-center flex-shrink-0 ${style.box}">
                            <i data-lucide="${style.icon}" class="w-5 h-5 ${style.text}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-3 mb-1 flex-wrap">
                                <h3 class="font-heading text-ink tracking-tight">${escapeHtml(ann.title)}</h3>
                                <span class="chip ${style.badge}">${escapeHtml(ann.type)}</span>
                                ${!ann.is_active ? '<span class="chip bg-surface-muted text-ink-muted border-line-muted">DRAFT</span>' : ''}
                            </div>
                            <p class="text-sm text-ink-muted leading-relaxed max-w-2xl whitespace-pre-wrap">${escapeHtml(ann.content)}</p>
                            <div class="flex items-center gap-4 mt-4">
                                <div class="flex items-center gap-1.5 text-[10px] font-mono text-ink-muted">
                                    <i data-lucide="calendar" class="w-3 h-3"></i>
                                    ${date}
                                </div>
                                <div class="flex items-center gap-2 opacity-100 md:opacity-75 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                    <button type="button" onclick="editAnnouncement('${escapeJsAttr(ann.id)}')" class="text-[10px] font-black text-blue hover:underline uppercase tracking-widest">Modify</button>
                                    <span class="text-line-muted">|</span>
                                    <button type="button" onclick="openDeleteModal('${escapeJsAttr(ann.id)}', 'announcement')" class="text-[10px] font-black text-pink hover:underline uppercase tracking-widest">Terminate</button>
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
    const ann = allAnnouncements.find(a => String(a.id) === String(id))
    if (!ann) return
    document.getElementById('announcementId').value = ann.id
    document.getElementById('annTitle').value = ann.title
    document.getElementById('annType').value = ann.type
    document.getElementById('annContent').value = ann.content
    document.getElementById('annActive').checked = ann.is_active
    const scrollEl = document.getElementById('admin-main-scroll')
    if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    document.getElementById('annTitle')?.focus()
}

function resetAnnForm() {
    const form = document.getElementById('announcementForm')
    const id = document.getElementById('announcementId')
    if (form) form.reset()
    if (id) id.value = ''
}

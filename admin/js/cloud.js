// KlassKit Admin — Cloud Storage (Server-Paginated + SQL Reconciliation)

const DEFAULT_STORAGE_QUOTA = 10 * 1024 * 1024 // 10 MB standard tier default
let cloudSearchTimeout = null

function debouncedCloudSearch() {
    clearTimeout(cloudSearchTimeout)
    cloudSearchTimeout = setTimeout(() => {
        pagination.cloud = 1
        renderCloudTable()
    }, 250)
}

async function renderCloudTable() {
    const body = document.getElementById('cloudTableBody')
    if (!body) return

    const seq = ++reqSeq.cloud
    const excludedIds = getValidExcludedUserIds()
    const cloudSearchEl = document.getElementById('cloudSearchInput')
    const globalSearchEl = document.getElementById('searchInput')
    const searchTerm = ((cloudSearchEl ? cloudSearchEl.value : '') || (globalSearchEl ? globalSearchEl.value : '')).trim()
    const conf = sortConfig.cloud || { col: 'usage', dir: 'desc' }

    const { data, error } = await callAdminRpc('admin_list_users', {
        p_excluded_ids: excludedIds,
        p_search: searchTerm,
        p_role_filter: 'all',
        p_tool_filter: '',
        p_sort_col: conf.col,
        p_sort_dir: conf.dir,
        p_page: pagination.cloud || 1,
        p_page_size: PAGE_SIZE
    })

    if (seq !== reqSeq.cloud) return
    if (error || !data) {
        body.innerHTML = '<tr><td colspan="4" class="px-8 py-12 text-center text-pink font-bold">Failed to load cloud storage breakdown</td></tr>'
        return
    }

    const total = Number(data.total) || 0
    const cloudPages = Math.ceil(total / PAGE_SIZE) || 1
    if (pagination.cloud > cloudPages) {
        pagination.cloud = cloudPages
        return renderCloudTable()
    }

    const pagedProfiles = Array.isArray(data.items) ? data.items : []
    pagedProfiles.forEach(p => {
        allProfiles[p.id] = { ...(allProfiles[p.id] || {}), ...p }
    })

    pagination.lastFilteredCounts.cloud = total
    const cloudPageInfo = document.getElementById('cloud-page-info')
    if (cloudPageInfo) {
        cloudPageInfo.textContent = total > 0
            ? `Page ${pagination.cloud} of ${cloudPages} (${total} users)`
            : 'Page 1 of 1 (0 users)'
    }

    if (!pagedProfiles.length) {
        body.innerHTML = '<tr><td colspan="4" class="px-8 py-12 text-center text-slate-500 font-bold">No cloud storage nodes match your filter</td></tr>'
    } else {
        body.innerHTML = pagedProfiles.map(p => {
            const used = Number(p.storage_usage) || 0
            const limit = Number(p.storage_limit) || DEFAULT_STORAGE_QUOTA
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
                            <button onclick="syncUserStorage('${escapeJsAttr(p.id)}')" id="sync-btn-${escapeHtml(p.id)}" title="Recalculate User Cloud Storage"
                                class="neo-btn !p-2 !bg-slate-900 !border-2 !border-slate-800 hover:!border-blue transition-all group/sync">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-slate-500 group-hover/sync:text-blue sync-icon-${escapeHtml(p.id)}"></i>
                            </button>
                            <button onclick="openDeleteModal('${escapeJsAttr(p.id)}', 'cloud-storage')" id="delete-storage-btn-${escapeHtml(p.id)}" title="Clear User Cloud Storage"
                                class="neo-btn !p-2 !bg-slate-900 !border-2 !border-slate-800 hover:!border-pink transition-all group/btn">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-pink delete-storage-icon-${escapeHtml(p.id)}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `
        }).join('')
    }

    // Update Summary across all eligible profiles
    const storageSummary = data.storage_summary || {}
    const totalUsed = Number(storageSummary.total_used) || 0
    const totalLimit = Number(storageSummary.total_limit) || 0
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

    const globalActiveUsers = document.getElementById('globalActiveUsers')
    if (globalActiveUsers) globalActiveUsers.textContent = Number(storageSummary.active_nodes) || 0

    updateSortIcons()
    lucide.createIcons({ root: body })
}

// ── SORTING & PAGINATION HELPERS ──
function toggleSort(tableView, col) {
    const conf = sortConfig[tableView]
    if (!conf) return
    if (conf.col === col) {
        conf.dir = conf.dir === 'asc' ? 'desc' : 'asc'
    } else {
        conf.col = col
        const descDefaultCols = new Set(['active', 'storage', 'records', 'updated_at', 'created_at', 'date', 'usage', 'limit', 'percent'])
        conf.dir = descDefaultCols.has(col) ? 'desc' : 'asc'
    }

    pagination[tableView] = 1
    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function changePage(tableView, delta) {
    const count = pagination.lastFilteredCounts?.[tableView] || 0
    const maxPages = Math.ceil(count / PAGE_SIZE) || 1

    pagination[tableView] = (pagination[tableView] || 1) + delta
    if (pagination[tableView] < 1) pagination[tableView] = 1
    if (pagination[tableView] > maxPages) pagination[tableView] = maxPages

    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function updateSortIcons() {
    document.querySelectorAll('[id^="sort-"]').forEach(el => el.innerHTML = '')
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

        if (currentView === 'cloud') await renderCloudTable()
        if (currentView === 'users' && typeof loadUsersView === 'function') await loadUsersView()
        await loadDashboardSummary()

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
        const { data, error } = await callAdminRpc('admin_reconcile_storage_quotas', { p_user_id: userId })
        if (error) throw error

        if (allProfiles[userId] && data) {
            allProfiles[userId].storage_usage = Number(data.storage_usage) || 0
        }

        if (currentView === 'cloud') await renderCloudTable()
        if (currentView === 'users' && typeof loadUsersView === 'function') await loadUsersView()
        await loadDashboardSummary()
        showToast('User storage reconciled')
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

    try {
        const { data, error } = await callAdminRpc('admin_reconcile_storage_quotas', { p_user_id: null })
        if (error) throw error

        if (currentView === 'cloud') await renderCloudTable()
        await loadDashboardSummary()
        showToast(`Sync complete! Checked ${data?.total_users || 0} users (${data?.updated_users || 0} updated).`)
    } catch (err) {
        console.error('[SyncAll] Error:', err)
        showToast(`Sync All failed: ${err.message}`, 'error')
    } finally {
        if (icon) icon.classList.remove('animate-spin')
        if (btn) btn.disabled = false
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeViewModal(); closeDeleteModal(); return }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : ''
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
        const searchEl = document.getElementById('searchInput')
        if (searchEl) {
            e.preventDefault()
            searchEl.focus()
            searchEl.select()
        }
    }
})

init()

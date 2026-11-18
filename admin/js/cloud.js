// KlassKit Admin — Cloud Storage, Sorting, Pagination & Startup

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
    if (!conf) return
    if (conf.col === col) {
        conf.dir = conf.dir === 'asc' ? 'desc' : 'asc'
    } else {
        conf.col = col
        const descDefaultCols = new Set(['active', 'storage', 'records', 'updated_at', 'created_at', 'date', 'usage', 'limit', 'percent'])
        conf.dir = descDefaultCols.has(col) ? 'desc' : 'asc'
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

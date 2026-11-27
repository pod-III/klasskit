// KlassKit Admin — Settings, Exclusions, Roles & Navigation

let exclusionSearchTimeout = null

function getStoredAdminSettings() {
    try {
        const saved = localStorage.getItem('kk_admin_settings')
        return saved ? JSON.parse(saved) : {}
    } catch (e) {
        console.error('[Admin] Failed to parse saved settings:', e)
        return {}
    }
}

function syncDefaultChartDaysUI(days) {
    ;[7, 14, 30, 90].forEach(d => {
        const dashBtn = document.getElementById(`range-${d}`)
        if (dashBtn) dashBtn.classList.toggle('active', d === days)
        const settingBtn = document.getElementById(`setting-range-${d}`)
        if (settingBtn) settingBtn.classList.toggle('active', d === days)
    })
}

function setDefaultChartDays(days) {
    const valid = [7, 14, 30].includes(Number(days)) ? Number(days) : 14
    chartDaysWindow = valid
    syncDefaultChartDaysUI(valid)
    saveSettings({ refreshExclusions: false })
}

// ── SETTINGS ──
function debouncedSaveSettings() {
    clearTimeout(settingsTimeout)
    settingsTimeout = setTimeout(() => saveSettings({ refreshExclusions: false }), 500)
}

async function saveSettings({ refreshExclusions = false } = {}) {
    const prev = getStoredAdminSettings()
    const exclEl = document.getElementById('setting-excluded-ids')
    const settings = {
        defaultChartDays: chartDaysWindow || prev.defaultChartDays || 14,
        excluded_ids: exclEl ? exclEl.value : (prev.excluded_ids || '')
    }
    localStorage.setItem('kk_admin_settings', JSON.stringify(settings))
    _lastRenderedSummaryRef = null
    await loadDashboardSummary()
    if (currentView !== 'settings' || refreshExclusions) {
        await refreshCurrentView()
    }
}

function loadSettings({ fetchExclusions = true } = {}) {
    const settings = getStoredAdminSettings()
    const savedDays = Number(settings.defaultChartDays)
    if ([7, 14, 30].includes(savedDays)) {
        chartDaysWindow = savedDays
    }
    syncDefaultChartDaysUI(chartDaysWindow || 14)

    const excl = document.getElementById('setting-excluded-ids')
    if (excl) excl.value = settings.excluded_ids || ''

    if (typeof syncAdminThemeUI === 'function') syncAdminThemeUI()
    if (fetchExclusions) {
        renderExcludedUserPicker()
    }
}

// ── EXCLUSION PICKER (Server-Searched, Preserves Off-Page Exclusions) ──
async function renderExcludedUserPicker() {
    const list = document.getElementById('exclusion-list')
    const chips = document.getElementById('excluded-chips')
    if (!list || !chips) return

    const seq = ++reqSeq.exclusions
    const excluded = getValidExcludedUserIds()
    const rawExcluded = getExcludedUserIds()
    const searchEl = document.getElementById('exclusion-search')
    const searchTerm = searchEl ? searchEl.value.trim() : ''

    const { data, error } = await callAdminRpc('admin_search_profiles', {
        p_search: searchTerm,
        p_selected_ids: excluded,
        p_limit: 50
    })

    if (seq !== reqSeq.exclusions) return
    if (error || !data) {
        list.innerHTML = '<div class="text-xs text-pink italic p-3 text-center">Failed to search users</div>'
        return
    }

    const selectedProfiles = Array.isArray(data.selected) ? data.selected : []
    const matchedProfiles = Array.isArray(data.matches) ? data.matches : []

    selectedProfiles.forEach(p => { allProfiles[p.id] = { ...(allProfiles[p.id] || {}), ...p } })
    matchedProfiles.forEach(p => { allProfiles[p.id] = { ...(allProfiles[p.id] || {}), ...p } })

    const selectedMap = Object.fromEntries(selectedProfiles.map(p => [p.id, p]))

    // Render chips across ALL excluded IDs (even when filtered out of search list)
    if (!rawExcluded.length) {
        chips.innerHTML = '<span class="text-xs text-ink-muted italic">No users excluded</span>'
    } else {
        chips.innerHTML = rawExcluded.map(id => {
            const p = selectedMap[id] || allProfiles[id]
            const name = p?.display_name || id.slice(0, 8)
            return `<div class="inline-flex items-center gap-2 px-3 py-1 bg-pink/10 border border-pink/30 rounded-full text-xs text-pink font-bold animate-pop-in">
                ${escapeHtml(name)}
                <button onclick="removeExcludedUser('${escapeJsAttr(id)}')" class="hover:text-ink transition-colors" title="Remove"><i data-lucide="x" class="w-3 h-3"></i></button>
            </div>`
        }).join('')
        lucide.createIcons({ root: chips })
    }

    if (!matchedProfiles.length) {
        list.innerHTML = '<div class="text-xs text-ink-muted italic p-3 text-center">No matching users found</div>'
        return
    }

    const excludedSet = new Set(excluded)
    list.innerHTML = matchedProfiles.map(profile => {
        const name = profile.display_name || 'Unknown'
        const initial = name[0]?.toUpperCase() || '?'
        const isExcluded = excludedSet.has(profile.id)
        return `<label class="exclusion-item flex items-center gap-3 p-2 hover:bg-surface-muted rounded-xl cursor-pointer transition-colors ${isExcluded ? 'bg-pink/5' : ''}">
            <input type="checkbox" value="${escapeHtml(profile.id)}" ${isExcluded ? 'checked' : ''} onchange="updateExcludedUsers()" class="w-4 h-4 rounded cursor-pointer exclusion-checkbox">
            <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${escapeHtml(initial)}</div>
            <span class="text-sm text-ink font-bold">${escapeHtml(name)}</span>
            <span class="text-[10px] text-ink-muted font-mono ml-auto">${escapeHtml(profile.id.slice(0, 8))}...</span>
        </label>`
    }).join('')
}

function updateExcludedUsers() {
    const list = document.getElementById('exclusion-list')
    if (!list) return
    const excludedSet = new Set(getExcludedUserIds())
    list.querySelectorAll('input.exclusion-checkbox').forEach(cb => {
        if (cb.checked) excludedSet.add(cb.value)
        else excludedSet.delete(cb.value)
    })
    const textarea = document.getElementById('setting-excluded-ids')
    if (textarea) textarea.value = Array.from(excludedSet).join(', ')
    saveSettings({ refreshExclusions: true })
}

function removeExcludedUser(id) {
    const textarea = document.getElementById('setting-excluded-ids')
    if (!textarea) return
    const current = getExcludedUserIds().filter(x => x !== id)
    textarea.value = current.join(', ')
    saveSettings({ refreshExclusions: true })
}

function filterExclusionList() {
    clearTimeout(exclusionSearchTimeout)
    exclusionSearchTimeout = setTimeout(() => {
        renderExcludedUserPicker()
    }, 250)
}

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text == null ? '' : String(text)
    return div.innerHTML
}

// ── USER MANAGEMENT ──
async function updateRole(userId, newRole) {
    const row = allProfiles[userId] || { display_name: userId.slice(0, 8) }

    const roleLabels = { user: '👤 User', pro: '⭐ Pro', admin: '🛡️ Admin' }
    const roleDisplay = roleLabels[newRole] || newRole.toUpperCase()
    const confirmed = await showConfirmModal(`Change role for ${row.display_name || userId} to ${roleDisplay}?`, {
        title: 'Change Role?',
        confirmText: 'Change',
        cancelText: 'Cancel',
        icon: 'shield',
        iconColor: 'blue'
    })
    if (!confirmed) {
        if (typeof loadUsersView === 'function') loadUsersView()
        return
    }

    const { error } = await db
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

    if (error) {
        showToast('Error updating role: ' + error.message, 'error')
        if (typeof loadUsersView === 'function') loadUsersView()
    } else {
        allProfiles[userId] = { ...(allProfiles[userId] || {}), role: newRole }
        showToast('User role updated')
        await loadDashboardSummary()
        if (currentView === 'users' && typeof loadUsersView === 'function') {
            await loadUsersView()
        }
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar')
    const overlay = document.getElementById('mobileOverlay')
    if (sb) sb.classList.toggle('-translate-x-full')
    if (overlay) overlay.classList.toggle('hidden')
}

// ── NAV ──
function setView(view) {
    const sb = document.getElementById('sidebar')
    if (sb && !sb.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        toggleSidebar()
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
            btn.classList.toggle('text-ink-muted', v !== view)
            btn.classList.toggle('text-ink', v === view)
        }
    })
    currentView = view
    if (view === 'dashboard') updateStats()
    if (view === 'users' && typeof loadUsersView === 'function') loadUsersView()
    if (view === 'data-details' && typeof loadDataDetailsTab === 'function') loadDataDetailsTab(true)
    if (view === 'cloud' && typeof renderCloudTable === 'function') renderCloudTable()
    if (view === 'logs' && typeof renderLogsTable === 'function') renderLogsTable()
    if (view === 'announcements' && typeof loadAnnouncements === 'function') loadAnnouncements()
    if (view === 'settings') loadSettings({ fetchExclusions: true })
}

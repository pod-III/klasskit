// KlassKit Admin — Settings, Exclusions, Roles & Navigation

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
    if (view === 'users' || view === 'data-details') applyFilters()
}


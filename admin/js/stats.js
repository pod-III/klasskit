// KlassKit Admin — Dashboard Stats, Charts & Insights

function updateStats() {
    const excludedIds = getExcludedUserIds()

    // Exclusion banner
    const excludedBanner = document.getElementById('excludedBanner')
    const excludedBannerCount = document.getElementById('excludedBannerCount')
    if (excludedBanner) {
        excludedBanner.classList.toggle('hidden', excludedIds.length === 0)
        if (excludedBannerCount) {
            excludedBannerCount.textContent = `${excludedIds.length} test account${excludedIds.length === 1 ? '' : 's'}`
        }
    }

    // Filtered collections (excluding test accounts)
    const metricsProgress = allProgress.filter(r => !excludedIds.includes(r.user_id))
    const metricsNotesAll = allNotes.filter(n => !excludedIds.includes(n.user_id))
    const metricsNotes = metricsNotesAll.filter(n => !n.deleted)
    const trashedNotesCount = metricsNotesAll.filter(n => n.deleted).length
    const metricsProfiles = Object.fromEntries(Object.entries(allProfiles).filter(([id]) => !excludedIds.includes(id)))
    const metricsSched = allScheduleEvents.filter(e => !excludedIds.includes(e.user_id))
    const metricsClasses = allClassAdmin.filter(c => !excludedIds.includes(c.user_id))
    const metricsClassUnits = allClassUnits.filter(u => !excludedIds.includes(u.user_id))
    const metricsTasks = allMySpaceTasks.filter(t => !excludedIds.includes(t.user_id))
    const metricsMyClass = allMyClass.filter(c => !excludedIds.includes(c.user_id))
    const metricsSpreadsheets = allSpreadsheets.filter(s => !excludedIds.includes(s.user_id))
    const metricsLessonParser = allLessonParser.filter(lp => !excludedIds.includes(lp.user_id))
    const metricsCardMaker = allCardMaker.filter(cm => !excludedIds.includes(cm.user_id))
    const metricsPuzzleMaker = allPuzzleMaker.filter(pm => !excludedIds.includes(pm.user_id))
    const metricsWorksheetMaker = allWorksheetMaker.filter(wm => !excludedIds.includes(wm.user_id))
    const metricsToolsDnd = allToolsDnd.filter(d => !excludedIds.includes(d.user_id))
    const metricsVttMaps = allVttMaps.filter(m => !excludedIds.includes(m.user_id))
    const metricsVttCampaigns = allVttCampaigns.filter(c => !excludedIds.includes(c.user_id))

    const unifiedEvents = buildUnifiedEvents(excludedIds)

    // 1. Community & Active Cohorts (DAU / WAU / MAU)
    const profileList = Object.values(metricsProfiles)
    const totalTeachers = profileList.length
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000

    const dauUsers = new Set()
    const wauUsers = new Set()
    const mauUsers = new Set()

    unifiedEvents.forEach(ev => {
        const ts = ev.timestamp.getTime()
        if (ts >= dayAgo) dauUsers.add(ev.user_id)
        if (ts >= weekAgo) wauUsers.add(ev.user_id)
        if (ts >= monthAgo) mauUsers.add(ev.user_id)
    })

    // Also check profile last_active_ts in case hub visit was the most recent action
    profileList.forEach(p => {
        if (p.last_active_ts >= dayAgo) dauUsers.add(p.id)
        if (p.last_active_ts >= weekAgo) wauUsers.add(p.id)
        if (p.last_active_ts >= monthAgo) mauUsers.add(p.id)
    })

    const dauCount = dauUsers.size
    const wauCount = wauUsers.size
    const mauCount = mauUsers.size
    const stickiness = mauCount > 0 ? Math.round((dauCount / mauCount) * 100) : 0

    const setElText = (id, val) => {
        const el = document.getElementById(id)
        if (el) el.textContent = val
    }

    setElText('statUsers', totalTeachers)
    setElText('statDAU', dauCount)
    setElText('statWAU', wauCount)
    setElText('statMAU', mauCount)
    setElText('statStickiness', `${stickiness}% DAU/MAU`)

    const proCount = profileList.filter(p => p.role === 'pro').length
    const adminCount = profileList.filter(p => p.role === 'admin').length
    setElText('statPro', proCount)
    setElText('statAdmins', adminCount)

    const totalForBar = totalTeachers || 1
    const proPercent = Math.min(100, Math.round((proCount / totalForBar) * 100))
    const adminPercent = Math.min(100 - proPercent, Math.round((adminCount / totalForBar) * 100))
    setElText('statProPercent', `${proPercent}% Pro`)

    const statProBar = document.getElementById('statProBar')
    const statAdminBar = document.getElementById('statAdminBar')
    if (statProBar) statProBar.style.width = `${proPercent}%`
    if (statAdminBar) statAdminBar.style.width = `${adminPercent}%`

    // 2. Engagement Metrics
    const progressSaveCount = unifiedEvents.filter(e => e.source === 'progress').length
    const dbRecordsCount = unifiedEvents.length - progressSaveCount
    const totalInteractions = unifiedEvents.length
    const activeTeacherCount = profileList.filter(p => (p.records_count || 0) > 0).length || 1
    const avgSavesPerTeacher = (totalInteractions / activeTeacherCount).toFixed(1)

    const adoptedCanonicalTools = new Set(unifiedEvents.map(e => e.canonical_tool))
    const activeCatalogGames = allGamesCatalog.filter(g => g.category !== 'under-construction' && g.id !== 'myspace-home')
    const catalogTotalCount = activeCatalogGames.length || 59

    setElText('statRows', totalInteractions.toLocaleString())
    setElText('statAvgPerTeacher', `~${avgSavesPerTeacher} / active user`)
    setElText('statToolSavesCount', progressSaveCount.toLocaleString())
    setElText('statDbRecordsCount', dbRecordsCount.toLocaleString())
    setElText('statTools', `${adoptedCanonicalTools.size} / ${catalogTotalCount} tools`)

    // 3. Cloud Sync & Storage Health
    const totalUsed = profileList.reduce((sum, p) => sum + (Number(p.storage_usage) || 0), 0)
    const totalLimit = profileList.reduce((sum, p) => sum + (Number(p.storage_limit) || 50 * 1024 * 1024), 0)
    const totalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const totalLimitMB = Math.round(totalLimit / (1024 * 1024))
    const storagePercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0
    const mediaNodesCount = profileList.filter(p => (Number(p.storage_usage) || 0) > 0).length

    setElText('statStorage', `${totalUsedMB} MB`)
    setElText('statStorageQuotaInfo', `/ ${totalLimitMB} MB (${storagePercent}%)`)
    setElText('statMediaNodes', `${mediaNodesCount} teacher${mediaNodesCount === 1 ? '' : 's'}`)
    setElText('statTablesCount', `${healthyTablesCount}/${totalQueriedTables} tables OK`)

    const statStorageMiniBar = document.getElementById('statStorageMiniBar')
    if (statStorageMiniBar) statStorageMiniBar.style.width = `${storagePercent}%`

    let latestTsMs = 0
    unifiedEvents.forEach(ev => {
        const ms = ev.timestamp.getTime()
        if (ms > latestTsMs && ms <= Date.now() + 86400000) latestTsMs = ms
    })
    const latestStr = latestTsMs > 0
        ? `${formatRelativeTime(latestTsMs)} (${new Date(latestTsMs).toLocaleDateString()})`
        : '—'
    setElText('statLatest', latestStr)

    // 4. Secondary Ecosystem Pulse Strip (6 Mini Cards)
    const totalFoldersCount = Object.entries(allNoteFolders)
        .filter(([uid]) => !excludedIds.includes(uid))
        .reduce((sum, [, f]) => sum + (Array.isArray(f) ? f.length : 0), 0)
    setElText('statNotes', metricsNotes.length)
    setElText('statNotesSub', `${totalFoldersCount} folders · ${trashedNotesCount} trashed`)

    const totalStudentsCount = metricsMyClass.reduce((sum, c) => sum + countStudentsInClassRow(c), 0)
    setElText('statMyClasses', metricsMyClass.length)
    setElText('statStudentsCount', `${totalStudentsCount} students tracked`)

    setElText('statEvents', metricsSched.length)
    setElText('statClassesSub', `${metricsClasses.length} tracker · ${metricsClassUnits.length} syllabi`)

    const completedTasksCount = metricsTasks.filter(t => t.completed).length
    const taskCompletionRate = metricsTasks.length > 0 ? Math.round((completedTasksCount / metricsTasks.length) * 100) : 0
    setElText('statTasks', metricsTasks.length)
    setElText('statTasksSub', `${completedTasksCount} done (${taskCompletionRate}%)`)

    const makerSetsCount = metricsCardMaker.length + metricsPuzzleMaker.length + metricsWorksheetMaker.length
    setElText('statStudio', metricsSpreadsheets.length + makerSetsCount)
    setElText('statStudioSub', `${metricsSpreadsheets.length} sheets · ${makerSetsCount} maker sets`)

    const dndTotalCount = metricsToolsDnd.length + metricsVttMaps.length + metricsVttCampaigns.length
    setElText('statWorkshop', metricsLessonParser.length + dndTotalCount)
    setElText('statWorkshopSub', `${metricsLessonParser.length} parser · ${dndTotalCount} D&D/VTT`)

    // 5. Render Top Tools Card (7D vs All Time)
    const topToolsList = document.getElementById('topToolsList')
    const topToolsTitle = document.getElementById('topToolsTitle')
    if (topToolsList) {
        const toolStats = {}
        const recordTool = (canonicalKey, userId) => {
            if (!toolStats[canonicalKey]) toolStats[canonicalKey] = { count: 0, users: new Set() }
            toolStats[canonicalKey].count += 1
            if (userId) toolStats[canonicalKey].users.add(userId)
        }

        unifiedEvents.forEach(ev => {
            if (topToolsMode === 'week') {
                if (ev.timestamp.getTime() >= weekAgo) recordTool(ev.canonical_tool, ev.user_id)
            } else {
                recordTool(ev.canonical_tool, ev.user_id)
            }
        })

        let topTools = Object.entries(toolStats).sort((a, b) => b[1].count - a[1].count)
        let isFallback = false

        if (topToolsMode === 'week' && topTools.length === 0 && unifiedEvents.length > 0) {
            unifiedEvents.forEach(ev => recordTool(ev.canonical_tool, ev.user_id))
            topTools = Object.entries(toolStats).sort((a, b) => b[1].count - a[1].count)
            isFallback = true
        }

        if (topToolsTitle) {
            topToolsTitle.textContent = (topToolsMode === 'all' || isFallback)
                ? (isFallback ? 'Top Tools Overall (No 7D Saves)' : 'Top Tools All-Time')
                : 'Top Tools This Week (7D)'
        }

        const sliced = topTools.slice(0, 4)
        if (sliced.length === 0) {
            topToolsList.innerHTML = '<div class="text-center py-6 text-slate-500 font-bold text-xs">No activity yet</div>'
        } else {
            topToolsList.innerHTML = sliced.map(([toolKey, info]) => {
                const meta = getToolMeta(toolKey)
                return `
                    <div class="flex items-center justify-between p-2 bg-slate-900/60 rounded-xl border border-slate-700/40">
                        <span class="text-xs text-slate-200 font-bold flex items-center gap-2 truncate pr-2">
                            <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${meta.color}"></i>
                            <span class="truncate">${escapeHtml(meta.name)}</span>
                        </span>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="text-[10px] text-slate-400 font-mono">${info.users.size}u</span>
                            <span class="text-xs font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">${info.count}</span>
                        </div>
                    </div>
                `
            }).join('')
            lucide.createIcons({ root: topToolsList })
        }
    }

    updateCharts(unifiedEvents, metricsProfiles)
    renderDashboardInsights(unifiedEvents, metricsProfiles, adoptedCanonicalTools)
}

function updateCharts(unifiedEvents, metricsProfiles) {
    const ctxActivity = document.getElementById('activityChart')?.getContext('2d')
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d')
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')
    const ctxActiveUsers = document.getElementById('activeUsersChart')?.getContext('2d')

    if (!ctxActivity || !ctxCategory || !ctxTools || !ctxActiveUsers) return

    // 1. Activity & DAU Charts (using configurable chartDaysWindow: 7, 14, 30, 90)
    const days = chartDaysWindow || 14

    const getLocalDateKey = (dateVal) => {
        const d = new Date(dateVal)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const dateKeys = []
    const activityLabels = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setHours(12, 0, 0, 0)
        d.setDate(d.getDate() - i)
        dateKeys.push(getLocalDateKey(d))
        activityLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    }

    const activityByDate = {}
    const usersByDate = {}

    unifiedEvents.forEach(entry => {
        const key = getLocalDateKey(entry.timestamp)
        activityByDate[key] = (activityByDate[key] || 0) + 1
        if (!usersByDate[key]) usersByDate[key] = new Set()
        usersByDate[key].add(entry.user_id)
    })

    const activityData = dateKeys.map(k => activityByDate[k] || 0)
    const dauData = dateKeys.map(k => usersByDate[k]?.size || 0)

    // Summary chips for Activity & DAU charts
    const windowTotalActions = activityData.reduce((a, b) => a + b, 0)
    const maxActivity = Math.max(0, ...activityData)
    const maxActivityIdx = activityData.indexOf(maxActivity)
    const peakActivityLabel = maxActivity > 0 ? `${maxActivity} (${activityLabels[maxActivityIdx]})` : '0'

    const maxDau = Math.max(0, ...dauData)
    const avgDau = (dauData.reduce((a, b) => a + b, 0) / days).toFixed(1)

    const activitySummaryEl = document.getElementById('activitySummaryText')
    if (activitySummaryEl) activitySummaryEl.textContent = `${windowTotalActions.toLocaleString()} actions in the last ${days} days`
    const activityPeakEl = document.getElementById('activityPeakChip')
    if (activityPeakEl) activityPeakEl.textContent = `Peak: ${peakActivityLabel}`
    const dauPeakEl = document.getElementById('dauPeakChip')
    if (dauPeakEl) dauPeakEl.textContent = `Peak DAU: ${maxDau}`
    const dauAvgEl = document.getElementById('dauAvgChip')
    if (dauAvgEl) dauAvgEl.textContent = `Avg: ${avgDau} / day`

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
                pointRadius: days > 30 ? 2 : 5,
                pointBackgroundColor: '#020617',
                pointBorderColor: '#1ea7fd',
                pointBorderWidth: days > 30 ? 2 : 3,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#1ea7fd',
                pointHoverBorderColor: '#020617',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(30, 167, 253, 0.5)',
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
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
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
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(0, 208, 99, 0.5)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y} Unique Teachers`
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
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
                }
            }
        }
    })

    // 2. Canonical Tool Aggregation & Category Distribution (strictly using excluded-filtered unifiedEvents)
    const canonicalStats = {}
    const categories = {
        'My Space': { count: 0, color: '#ff7e33' },
        'Tools': { count: 0, color: '#1ea7fd' },
        'Workshop': { count: 0, color: '#ff4785' },
        'Games': { count: 0, color: '#00d063' }
    }

    unifiedEvents.forEach(ev => {
        const meta = getToolMeta(ev.canonical_tool)
        if (!canonicalStats[meta.id]) {
            canonicalStats[meta.id] = {
                meta,
                saves: 0,
                users: new Set()
            }
        }
        canonicalStats[meta.id].saves += 1
        if (ev.user_id) canonicalStats[meta.id].users.add(ev.user_id)

        if (categories[meta.category]) {
            categories[meta.category].count += 1
        } else {
            categories['Tools'].count += 1
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
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
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
                const { ctx, chartArea } = chart
                if (!chartArea) return
                ctx.save()
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0)
                const centerX = (chartArea.left + chartArea.right) / 2
                const centerY = (chartArea.top + chartArea.bottom) / 2

                ctx.font = '700 28px Fredoka'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = '#fff'
                ctx.fillText(total.toLocaleString(), centerX, centerY - 8)

                ctx.font = '800 10px Nunito'
                ctx.fillStyle = '#94a3b8'
                ctx.fillText('TOTAL ACTIONS', centerX, centerY + 16)
                ctx.restore()
            }
        }]
    })

    // 3. Top Performing Tools Bar Chart (by saves OR by unique teachers)
    const allToolsStats = Object.values(canonicalStats).sort((a, b) => {
        if (toolsChartMetric === 'users') {
            return (b.users.size - a.users.size) || (b.saves - a.saves)
        }
        return (b.saves - a.saves) || (b.users.size - a.users.size)
    })
    const top10Tools = allToolsStats.slice(0, 10)

    if (charts.tools) charts.tools.destroy()
    charts.tools = new Chart(ctxTools, {
        type: 'bar',
        data: {
            labels: top10Tools.map(t => t.meta.name),
            datasets: [{
                label: toolsChartMetric === 'users' ? 'Unique Teachers' : 'Total Saves',
                data: top10Tools.map(t => toolsChartMetric === 'users' ? t.users.size : t.saves),
                backgroundColor: top10Tools.map(t => t.meta.color),
                borderColor: '#020617',
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(255, 126, 51, 0.5)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: (ctx) => {
                            const item = top10Tools[ctx.dataIndex]
                            if (!item) return ''
                            return ` ${item.saves} saves · ${item.users.size} teacher${item.users.size === 1 ? '' : 's'} (${item.meta.category})`
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)', borderDash: [5, 5] },
                    ticks: { color: '#94a3b8', font: { family: 'Nunito', weight: '700' }, precision: 0 }
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

    // 4. Full Tool Breakdown List (shows all active tools with category badge, teacher count, and save volume)
    const breakdownEl = document.getElementById('toolBreakdown')
    const breakdownCountChip = document.getElementById('breakdownCountChip')
    if (breakdownCountChip) breakdownCountChip.textContent = `${allToolsStats.length} active`

    if (breakdownEl) {
        const maxVal = allToolsStats.length > 0
            ? (toolsChartMetric === 'users' ? allToolsStats[0].users.size : allToolsStats[0].saves) || 1
            : 1

        if (allToolsStats.length === 0) {
            breakdownEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No tool activity recorded</div>'
        } else {
            breakdownEl.innerHTML = allToolsStats.map(item => {
                const metricVal = toolsChartMetric === 'users' ? item.users.size : item.saves
                const percent = Math.max(4, Math.round((metricVal / maxVal) * 100))
                return `
                    <div class="group p-2.5 bg-slate-900/40 hover:bg-slate-700/30 border border-slate-700/40 rounded-xl transition-colors cursor-default">
                        <div class="flex items-center justify-between text-xs mb-1.5 gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <i data-lucide="${item.meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${item.meta.color}"></i>
                                <span class="font-bold text-white truncate">${escapeHtml(item.meta.name)}</span>
                            </div>
                            <span class="text-slate-400 font-mono font-bold text-[10px] flex-shrink-0">${item.saves} saves · ${item.users.size}u</span>
                        </div>
                        <div class="h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-[1px]">
                            <div class="h-full rounded-full transition-all duration-700" style="width: ${percent}%; background: ${item.meta.color}"></div>
                        </div>
                    </div>`
            }).join('')
            lucide.createIcons({ root: breakdownEl })
        }
    }
}

function renderDashboardInsights(unifiedEvents, metricsProfiles, adoptedCanonicalTools) {
    // 1. Top Active Teachers Leaderboard
    const topTeachersEl = document.getElementById('topTeachersList')
    if (topTeachersEl) {
        const userStats = {}
        Object.values(metricsProfiles).forEach(p => {
            userStats[p.id] = {
                profile: p,
                saves: 0,
                tools: new Set(),
                latestTs: p.last_active_ts || 0
            }
        })
        unifiedEvents.forEach(ev => {
            if (!userStats[ev.user_id]) return
            userStats[ev.user_id].saves += 1
            userStats[ev.user_id].tools.add(ev.canonical_tool)
            if (ev.timestamp.getTime() > userStats[ev.user_id].latestTs) {
                userStats[ev.user_id].latestTs = ev.timestamp.getTime()
            }
        })

        const rankedTeachers = Object.values(userStats)
            .filter(u => u.saves > 0 || u.latestTs > 0)
            .sort((a, b) => (b.saves - a.saves) || (b.tools.size - a.tools.size) || (b.latestTs - a.latestTs))
            .slice(0, 6)

        if (!rankedTeachers.length) {
            topTeachersEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No active teachers yet</div>'
        } else {
            topTeachersEl.innerHTML = rankedTeachers.map((u, idx) => {
                const p = u.profile
                const name = p.display_name || p.id.slice(0, 8)
                const role = p.role || 'user'
                const roleBadge = role === 'admin'
                    ? '<span class="px-1.5 py-0.5 rounded bg-pink/20 text-pink text-[9px] font-black uppercase">Admin</span>'
                    : role === 'pro'
                        ? '<span class="px-1.5 py-0.5 rounded bg-orange/20 text-orange text-[9px] font-black uppercase">⭐ Pro</span>'
                        : ''
                return `
                    <div onclick="viewUser('${p.id}')" class="flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 hover:border-blue/50 rounded-xl cursor-pointer transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-7 h-7 rounded-lg bg-blue/15 border border-blue/40 flex items-center justify-center font-heading text-xs text-blue flex-shrink-0">#${idx + 1}</div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold text-white text-xs truncate">${escapeHtml(name)}</span>
                                    ${roleBadge}
                                </div>
                                <div class="text-[10px] text-slate-400 font-mono">${u.tools.size} tools · ${formatRelativeTime(u.latestTs)}</div>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 ml-2">
                            <div class="font-heading text-sm text-white">${u.saves}</div>
                            <div class="text-[9px] text-slate-500 uppercase font-bold">records</div>
                        </div>
                    </div>
                `
            }).join('')
        }
    }

    // 2. Recent Live Activity Stream
    const recentFeedEl = document.getElementById('recentActivityFeed')
    if (recentFeedEl) {
        const recent = [...unifiedEvents]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 6)

        if (!recent.length) {
            recentFeedEl.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold text-xs">No recent activity</div>'
        } else {
            recentFeedEl.innerHTML = recent.map(ev => {
                const p = allProfiles[ev.user_id]
                const name = p?.display_name || ev.user_id.slice(0, 8)
                const meta = getToolMeta(ev.canonical_tool)
                return `
                    <div onclick="viewUser('${ev.user_id}')" class="flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 hover:border-green/50 rounded-xl cursor-pointer transition-all gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${meta.color}20; border:1px solid ${meta.color}50">
                                <i data-lucide="${meta.icon}" class="w-3.5 h-3.5" style="color:${meta.color}"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-white truncate">${escapeHtml(name)} <span class="text-slate-400 font-normal">→</span> <span style="color:${meta.color}">${escapeHtml(meta.name)}</span></div>
                                <div class="text-[10px] text-slate-400 truncate font-mono">${escapeHtml(ev.action_type.replace(/_/g, ' '))}: ${escapeHtml(String(ev.label).slice(0, 32))}</div>
                            </div>
                        </div>
                        <span class="text-[10px] font-mono text-slate-400 whitespace-nowrap flex-shrink-0">${formatRelativeTime(ev.timestamp.getTime())}</span>
                    </div>
                `
            }).join('')
            lucide.createIcons({ root: recentFeedEl })
        }
    }

    // 3. Catalog Coverage & Dormant Tools
    const coverageChip = document.getElementById('catalogCoverageChip')
    const categoryBarsEl = document.getElementById('catalogCategoryBars')
    const dormantCountEl = document.getElementById('dormantToolsCount')
    const dormantListEl = document.getElementById('dormantToolsList')

    const activeCatalog = allGamesCatalog.filter(g => g.category !== 'under-construction' && g.id !== 'myspace-home')
    if (activeCatalog.length > 0) {
        const adoptedInCatalog = activeCatalog.filter(g => adoptedCanonicalTools.has(g.id))
        const dormantTools = activeCatalog.filter(g => !adoptedCanonicalTools.has(g.id))
        const coveragePct = Math.round((adoptedInCatalog.length / activeCatalog.length) * 100)

        if (coverageChip) coverageChip.textContent = `${adoptedInCatalog.length}/${activeCatalog.length} (${coveragePct}%)`
        if (dormantCountEl) dormantCountEl.textContent = `${dormantTools.length} untried`

        if (categoryBarsEl) {
            const catGroups = [
                { key: 'game', label: 'Games', color: '#00d063' },
                { key: 'tool', label: 'Tools', color: '#1ea7fd' },
                { key: 'printable', label: 'Printables', color: '#ff7e33' },
                { key: 'myspace', label: 'My Space', color: '#ff7e33' },
                { key: 'workshop', label: 'Workshop', color: '#ff4785' }
            ]
            categoryBarsEl.innerHTML = catGroups.map(cg => {
                const items = activeCatalog.filter(g => (g.id === 'lessonnotes' ? 'myspace' : g.category) === cg.key)
                const used = items.filter(g => adoptedCanonicalTools.has(g.id)).length
                const total = items.length || 1
                const pct = Math.round((used / total) * 100)
                return `
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span class="font-bold text-slate-300">${cg.label}</span>
                            <span class="font-mono text-slate-400 text-[11px]">${used} / ${items.length} (${pct}%)</span>
                        </div>
                        <div class="h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-[1px]">
                            <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%; background:${cg.color}"></div>
                        </div>
                    </div>
                `
            }).join('')
        }

        if (dormantListEl) {
            if (dormantTools.length === 0) {
                dormantListEl.innerHTML = '<span class="text-xs text-green font-bold">🎉 100% of catalog tools have been used!</span>'
            } else {
                dormantListEl.innerHTML = dormantTools.map(g => `
                    <span class="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-400">${escapeHtml(g.title)}</span>
                `).join('')
            }
        }
    }
}

// ── FILTERS ──

// KlassKit Admin — Dashboard Stats, Charts & Insights (RPC-backed)

function renderTopToolsCard(summary) {
    const topToolsList = document.getElementById('topToolsList')
    const topToolsTitle = document.getElementById('topToolsTitle')
    if (!topToolsList || !summary) return

    const allToolStats = Array.isArray(summary.tool_stats) ? summary.tool_stats : []
    const weekTools = Array.isArray(summary.top_tools_week) ? summary.top_tools_week : []
    const isFallback = topToolsMode === 'week' && weekTools.length === 0 && allToolStats.length > 0
    const sourceList = (topToolsMode === 'week' && !isFallback) ? weekTools : allToolStats

    if (topToolsTitle) {
        topToolsTitle.textContent = (topToolsMode === 'all' || isFallback)
            ? (isFallback ? 'Top Tools Overall (No 7D Saves)' : 'Top Tools All-Time')
            : 'Top Tools This Week (7D)'
    }

    const sliced = sourceList.slice(0, 4)
    if (sliced.length === 0) {
        topToolsList.innerHTML = '<div class="text-center py-6 text-ink-muted font-bold text-xs">No activity yet</div>'
        return
    }
    topToolsList.innerHTML = sliced.map(info => {
        const meta = getToolMeta(info.canonical_tool)
        return `
            <div class="flex items-center justify-between p-2 bg-surface-muted/70 rounded-xl border border-line-muted">
                <span class="text-xs text-ink font-bold flex items-center gap-2 truncate pr-2">
                    <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${meta.color}"></i>
                    <span class="truncate">${escapeHtml(meta.name)}</span>
                </span>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-[10px] text-ink-muted font-mono">${Number(info.users) || 0}u</span>
                    <span class="text-xs font-bold text-ink font-mono bg-card px-2 py-0.5 rounded-lg border border-line-muted">${Number(info.saves) || 0}</span>
                </div>
            </div>
        `
    }).join('')
    lucide.createIcons({ root: topToolsList })
}

function updateStats({ force = false } = {}) {
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

    const summary = dashboardSummary
    if (!summary) return

    if (!force && summary === _lastRenderedSummaryRef && !_chartsThemeDirty && charts.activity) {
        Object.values(charts).forEach(ch => {
            if (ch && typeof ch.resize === 'function') ch.resize()
        })
        return
    }

    const community = summary.community || {}
    const engagement = summary.engagement || {}
    const storage = summary.storage || {}
    const ecosystem = summary.ecosystem || {}

    const setElText = (id, val) => {
        const el = document.getElementById(id)
        if (el) el.textContent = val
    }

    // 1. Community & Active Cohorts (DAU / WAU / MAU)
    const totalTeachers = Number(community.total_users) || 0
    const dauCount = Number(community.dau) || 0
    const wauCount = Number(community.wau) || 0
    const mauCount = Number(community.mau) || 0
    const stickiness = mauCount > 0 ? Math.round((dauCount / mauCount) * 100) : 0

    setElText('statUsers', totalTeachers)
    setElText('statDAU', dauCount)
    setElText('statWAU', wauCount)
    setElText('statMAU', mauCount)
    setElText('statStickiness', `${stickiness}% DAU/MAU`)

    const proCount = Number(community.pro_users) || 0
    const adminCount = Number(community.admin_users) || 0
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
    const totalInteractions = Number(engagement.total_interactions) || 0
    const progressSaveCount = Number(engagement.progress_saves) || 0
    const dbRecordsCount = Number(engagement.db_records) || 0
    const avgSavesPerTeacher = Number(engagement.avg_per_active_user ?? 0).toFixed(1)

    const allToolStats = Array.isArray(summary.tool_stats) ? summary.tool_stats : []
    const adoptedCanonicalTools = new Set(allToolStats.map(t => resolveCanonicalToolId(t.canonical_tool)))
    const activeCatalogGames = allGamesCatalog.filter(g => g.category !== 'under-construction' && g.id !== 'myspace-home')
    const catalogTotalCount = activeCatalogGames.length || 71

    setElText('statRows', totalInteractions.toLocaleString())
    setElText('statAvgPerTeacher', `~${avgSavesPerTeacher} / active user`)
    setElText('statToolSavesCount', progressSaveCount.toLocaleString())
    setElText('statDbRecordsCount', dbRecordsCount.toLocaleString())
    setElText('statTabOpensCount', engagement.tab_opens !== undefined ? Number(engagement.tab_opens).toLocaleString() : '—')
    setElText('statSessionsCount', engagement.session_logs !== undefined ? Number(engagement.session_logs).toLocaleString() : '—')
    setElText('statTools', `${adoptedCanonicalTools.size} / ${catalogTotalCount} tools`)

    // 3. Cloud Sync & Storage Health
    const totalUsed = Number(storage.total_used_bytes) || 0
    const totalLimit = Number(storage.total_limit_bytes) || 0
    const totalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const totalLimitMB = Math.round(totalLimit / (1024 * 1024))
    const storagePercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0
    const mediaNodesCount = Number(storage.active_nodes) || 0

    setElText('statStorage', `${totalUsedMB} MB`)
    setElText('statStorageQuotaInfo', `/ ${totalLimitMB} MB (${storagePercent}%)`)
    setElText('statMediaNodes', `${mediaNodesCount} teacher${mediaNodesCount === 1 ? '' : 's'}`)
    setElText('statTablesCount', `${healthyTablesCount}/${totalQueriedTables} tables OK`)

    const statStorageMiniBar = document.getElementById('statStorageMiniBar')
    if (statStorageMiniBar) statStorageMiniBar.style.width = `${storagePercent}%`

    const latestTsMs = parseTimestampMs(engagement.latest_ts)
    const latestStr = latestTsMs > 0
        ? `${formatRelativeTime(latestTsMs)} (${new Date(latestTsMs).toLocaleDateString()})`
        : '—'
    setElText('statLatest', latestStr)

    // 4. Secondary Ecosystem Pulse Strip (6 Mini Cards)
    setElText('statNotes', Number(ecosystem.active_notes) || 0)
    setElText('statNotesSub', `${Number(ecosystem.total_folders) || 0} folders · ${Number(ecosystem.trashed_notes) || 0} trashed`)

    setElText('statMyClasses', Number(ecosystem.my_classes) || 0)
    setElText('statStudentsCount', `${Number(ecosystem.total_students) || 0} students tracked`)

    setElText('statEvents', Number(ecosystem.schedule_events) || 0)
    setElText('statClassesSub', `${Number(ecosystem.class_admin_count) || 0} tracker · ${Number(ecosystem.class_units_count) || 0} syllabi`)

    const tasksTotal = Number(ecosystem.tasks_total) || 0
    const completedTasksCount = Number(ecosystem.tasks_completed) || 0
    const taskCompletionRate = tasksTotal > 0 ? Math.round((completedTasksCount / tasksTotal) * 100) : 0
    setElText('statTasks', tasksTotal)
    setElText('statTasksSub', `${completedTasksCount} done (${taskCompletionRate}%)`)

    const spreadsheetsCount = Number(ecosystem.spreadsheets_count) || 0
    const makerSetsCount = Number(ecosystem.maker_sets_count) || 0
    setElText('statStudio', spreadsheetsCount + makerSetsCount)
    setElText('statStudioSub', `${spreadsheetsCount} sheets · ${makerSetsCount} maker sets`)

    const lessonParserCount = Number(ecosystem.lesson_parser_count) || 0
    const dndTotalCount = Number(ecosystem.dnd_vtt_count) || 0
    setElText('statWorkshop', lessonParserCount + dndTotalCount)
    setElText('statWorkshopSub', `${lessonParserCount} parser · ${dndTotalCount} RPG/VTT`)

    // 5. Render Top Tools Card (7D vs All Time)
    renderTopToolsCard(summary)

    updateCharts(summary, { animate: !_chartsThemeDirty })
    renderDashboardInsights(summary, adoptedCanonicalTools)
    _lastRenderedSummaryRef = summary
    _chartsThemeDirty = false
}

function getAdminChartColors() {
    const isDark = document.documentElement.classList.contains('dark')
    return {
        isDark,
        tickColor: isDark ? '#94a3b8' : '#475569',
        yLabelColor: isDark ? '#f8fafc' : '#0f172a',
        gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
        pointBg: isDark ? '#020617' : '#ffffff',
        barBorder: isDark ? '#020617' : '#334155',
        doughnutBorder: isDark ? '#0f172a' : '#ffffff',
        centerText: isDark ? '#ffffff' : '#0f172a',
        centerSubText: isDark ? '#94a3b8' : '#64748b',
        tooltipBg: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        tooltipTitle: isDark ? '#ffffff' : '#0f172a',
        tooltipBody: isDark ? '#cbd5e1' : '#334155',
        tooltipBorder: isDark ? '#475569' : '#334155'
    }
}

function refreshAdminChartsTheme() {
    if (currentView !== 'dashboard') {
        _chartsThemeDirty = true
        return
    }
    if (typeof dashboardSummary !== 'undefined' && dashboardSummary) {
        updateCharts(dashboardSummary, { animate: false, skipBreakdown: true })
        _chartsThemeDirty = false
    }
}

function computeCanonicalToolStats(summary) {
    const canonicalStats = {}
    const categories = {
        'My Space': { count: 0, color: '#ff7e33' },
        'Tools': { count: 0, color: '#1ea7fd' },
        'Workshop': { count: 0, color: '#ff4785' },
        'Games': { count: 0, color: '#00d063' }
    }

    ;(summary?.tool_stats || []).forEach(row => {
        const meta = getToolMeta(row.canonical_tool)
        const saves = Number(row.saves) || 0
        const users = Number(row.users) || 0
        if (!canonicalStats[meta.id]) {
            canonicalStats[meta.id] = { meta, saves: 0, users: 0 }
        }
        canonicalStats[meta.id].saves += saves
        canonicalStats[meta.id].users = Math.max(canonicalStats[meta.id].users, users)

        if (categories[meta.category]) {
            categories[meta.category].count += saves
        } else {
            categories['Tools'].count += saves
        }
    })

    const allToolsStats = Object.values(canonicalStats).sort((a, b) => {
        if (toolsChartMetric === 'users') {
            return (b.users - a.users) || (b.saves - a.saves)
        }
        return (b.saves - a.saves) || (b.users - a.users)
    })

    return { canonicalStats, allToolsStats, categories }
}

function updateCharts(summary, { animate = true, skipBreakdown = false } = {}) {
    const ctxActivity = document.getElementById('activityChart')?.getContext('2d')
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d')
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')
    const ctxActiveUsers = document.getElementById('activeUsersChart')?.getContext('2d')

    if (!ctxActivity || !ctxCategory || !ctxTools || !ctxActiveUsers) return

    const c = getAdminChartColors()
    const animConfig = animate ? { duration: 250 } : false
    const days = chartDaysWindow || 14
    const series = Array.isArray(summary.daily_series) ? summary.daily_series : []
    const activityLabels = series.map(pt =>
        new Date(`${pt.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    )
    const activityData = series.map(pt => Number(pt.actions) || 0)
    const hasPhase6Series = series.some(pt => pt.saves !== undefined && pt.logs !== undefined)
    const savesSeries = series.map(pt => Number(pt.saves) || 0)
    const logsSeries = series.map(pt => Number(pt.logs) || 0)
    const dauData = series.map(pt => Number(pt.active_users) || 0)

    const windowTotalActions = activityData.reduce((a, b) => a + b, 0)
    const maxActivity = activityData.length ? Math.max(0, ...activityData) : 0
    const maxActivityIdx = activityData.indexOf(maxActivity)
    const peakActivityLabel = maxActivity > 0 ? `${maxActivity} (${activityLabels[maxActivityIdx]})` : '0'

    const maxDau = dauData.length ? Math.max(0, ...dauData) : 0
    const avgDau = (dauData.reduce((a, b) => a + b, 0) / (days || 1)).toFixed(1)

    const activitySummaryEl = document.getElementById('activitySummaryText')
    if (activitySummaryEl) {
        if (hasPhase6Series) {
            const totalSavesW = savesSeries.reduce((a, b) => a + b, 0)
            const totalLogsW = logsSeries.reduce((a, b) => a + b, 0)
            activitySummaryEl.textContent = `${windowTotalActions.toLocaleString()} actions (${totalSavesW.toLocaleString()} saves · ${totalLogsW.toLocaleString()} logs) in last ${days} days`
        } else {
            activitySummaryEl.textContent = `${windowTotalActions.toLocaleString()} actions in the last ${days} days`
        }
    }
    const activityPeakEl = document.getElementById('activityPeakChip')
    if (activityPeakEl) activityPeakEl.textContent = `Peak: ${peakActivityLabel}`
    const dauPeakEl = document.getElementById('dauPeakChip')
    if (dauPeakEl) dauPeakEl.textContent = `Peak DAU: ${maxDau}`
    const dauAvgEl = document.getElementById('dauAvgChip')
    if (dauAvgEl) dauAvgEl.textContent = `Avg: ${avgDau} / day`

    const blueGradient = ctxActivity.createLinearGradient(0, 0, 0, ctxActivity.canvas.clientHeight || 250)
    blueGradient.addColorStop(0, 'rgba(30, 167, 253, 0.35)')
    blueGradient.addColorStop(1, 'rgba(30, 167, 253, 0.0)')

    const orangeGradient = ctxActivity.createLinearGradient(0, 0, 0, ctxActivity.canvas.clientHeight || 250)
    orangeGradient.addColorStop(0, 'rgba(255, 126, 51, 0.22)')
    orangeGradient.addColorStop(1, 'rgba(255, 126, 51, 0.0)')

    const greenGradient = ctxActiveUsers.createLinearGradient(0, 0, 0, ctxActiveUsers.canvas.clientHeight || 250)
    greenGradient.addColorStop(0, 'rgba(0, 208, 99, 0.85)')
    greenGradient.addColorStop(1, 'rgba(0, 208, 99, 0.25)')

    const activityDatasets = hasPhase6Series
        ? [
            {
                label: 'Saves',
                data: savesSeries,
                borderColor: '#1ea7fd',
                backgroundColor: blueGradient,
                fill: true,
                tension: 0.35,
                borderWidth: 3.5,
                pointRadius: days > 30 ? 2 : 4,
                pointBackgroundColor: c.pointBg,
                pointBorderColor: '#1ea7fd',
                pointBorderWidth: days > 30 ? 2 : 3,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#1ea7fd',
                pointHoverBorderColor: c.pointBg,
                pointHoverBorderWidth: 3
            },
            {
                label: 'Logs (Opens & Sessions)',
                data: logsSeries,
                borderColor: '#ff7e33',
                backgroundColor: orangeGradient,
                fill: true,
                tension: 0.35,
                borderWidth: 3,
                borderDash: [5, 4],
                pointRadius: days > 30 ? 1.5 : 3.5,
                pointBackgroundColor: c.pointBg,
                pointBorderColor: '#ff7e33',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#ff7e33',
                pointHoverBorderColor: c.pointBg,
                pointHoverBorderWidth: 2
            }
        ]
        : [{
            label: 'Interactions',
            data: activityData,
            borderColor: '#1ea7fd',
            backgroundColor: blueGradient,
            fill: true,
            tension: 0.35,
            borderWidth: 4,
            pointRadius: days > 30 ? 2 : 5,
            pointBackgroundColor: c.pointBg,
            pointBorderColor: '#1ea7fd',
            pointBorderWidth: days > 30 ? 2 : 3,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#1ea7fd',
            pointHoverBorderColor: c.pointBg,
            pointHoverBorderWidth: 3
        }]

    if (charts.activity) charts.activity.destroy()
    charts.activity = new Chart(ctxActivity, {
        type: 'line',
        data: {
            labels: activityLabels,
            datasets: activityDatasets
        },
        options: {
            animation: animConfig,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: hasPhase6Series,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: c.tickColor,
                        font: { family: 'Nunito', weight: 'bold', size: 11 },
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: c.tooltipBg,
                    borderColor: 'rgba(30, 167, 253, 0.6)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: c.tooltipTitle,
                    bodyColor: c.tooltipBody,
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: hasPhase6Series,
                    callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: c.gridColor, borderDash: [5, 5] },
                    ticks: { color: c.tickColor, font: { family: 'Nunito', weight: '700' }, precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: c.tickColor, font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
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
                borderColor: c.barBorder,
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            animation: animConfig,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: c.tooltipBg,
                    borderColor: 'rgba(0, 208, 99, 0.6)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: c.tooltipTitle,
                    bodyColor: c.tooltipBody,
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
                    grid: { color: c.gridColor, borderDash: [5, 5] },
                    ticks: {
                        color: c.tickColor,
                        font: { family: 'Nunito', weight: '700' },
                        stepSize: 1,
                        precision: 0
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: c.tickColor, font: { family: 'Nunito', weight: '700' }, maxTicksLimit: 14 }
                }
            }
        }
    })

    // 2. Canonical Tool Aggregation & Category Distribution
    const precomputed = computeCanonicalToolStats(summary)
    const { categories } = precomputed

    if (charts.category) charts.category.destroy()
    charts.category = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories).map(cat => cat.count),
                backgroundColor: Object.values(categories).map(cat => cat.color),
                borderWidth: 3,
                borderColor: c.doughnutBorder,
                hoverOffset: 12
            }]
        },
        options: {
            animation: animConfig,
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: c.tickColor,
                        font: { family: 'Nunito', weight: 'bold', size: 11 },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: c.tooltipBg,
                    borderColor: c.tooltipBorder,
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: c.tooltipTitle,
                    bodyColor: c.tooltipBody,
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
                ctx.fillStyle = c.centerText
                ctx.fillText(total.toLocaleString(), centerX, centerY - 8)

                ctx.font = '800 10px Nunito'
                ctx.fillStyle = c.centerSubText
                ctx.fillText('TOTAL ACTIONS', centerX, centerY + 16)
                ctx.restore()
            }
        }]
    })

    renderToolsPerformanceSection(summary, { animate, skipBreakdown, chartColors: c, precomputed })
}

function renderToolsPerformanceSection(summary, { animate = true, skipBreakdown = false, chartColors = null, precomputed = null } = {}) {
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')
    if (!ctxTools || !summary) return

    const c = chartColors || getAdminChartColors()
    const animConfig = animate ? { duration: 250 } : false
    const { allToolsStats } = precomputed || computeCanonicalToolStats(summary)
    const top10Tools = allToolsStats.slice(0, 10)

    if (charts.tools) charts.tools.destroy()
    charts.tools = new Chart(ctxTools, {
        type: 'bar',
        data: {
            labels: top10Tools.map(t => t.meta.name),
            datasets: [{
                label: toolsChartMetric === 'users' ? 'Unique Teachers' : 'Total Saves',
                data: top10Tools.map(t => toolsChartMetric === 'users' ? t.users : t.saves),
                backgroundColor: top10Tools.map(t => t.meta.color),
                borderColor: c.barBorder,
                borderWidth: 2,
                borderRadius: 6,
                barThickness: 18
            }]
        },
        options: {
            animation: animConfig,
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: c.tooltipBg,
                    borderColor: 'rgba(255, 126, 51, 0.6)',
                    borderWidth: 2,
                    titleFont: { family: 'Fredoka', size: 14, weight: '700' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    titleColor: c.tooltipTitle,
                    bodyColor: c.tooltipBody,
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: (ctx) => {
                            const item = top10Tools[ctx.dataIndex]
                            if (!item) return ''
                            return ` ${item.saves} saves · ${item.users} teacher${item.users === 1 ? '' : 's'} (${item.meta.category})`
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: c.gridColor, borderDash: [5, 5] },
                    ticks: { color: c.tickColor, font: { family: 'Nunito', weight: '700' }, precision: 0 }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: c.yLabelColor,
                        font: { family: 'Fredoka', weight: '700', size: 11 }
                    }
                }
            }
        }
    })

    if (skipBreakdown) return

    const breakdownEl = document.getElementById('toolBreakdown')
    const breakdownCountChip = document.getElementById('breakdownCountChip')
    if (breakdownCountChip) breakdownCountChip.textContent = `${allToolsStats.length} active`

    if (breakdownEl) {
        const maxVal = allToolsStats.length > 0
            ? (toolsChartMetric === 'users' ? allToolsStats[0].users : allToolsStats[0].saves) || 1
            : 1

        if (allToolsStats.length === 0) {
            breakdownEl.innerHTML = '<div class="text-center py-8 text-ink-muted font-bold text-xs">No tool activity recorded</div>'
        } else {
            breakdownEl.innerHTML = allToolsStats.map(item => {
                const metricVal = toolsChartMetric === 'users' ? item.users : item.saves
                const percent = Math.max(4, Math.round((metricVal / maxVal) * 100))
                return `
                    <div class="group p-2.5 bg-surface-muted/70 hover:bg-surface-muted border border-line-muted rounded-xl transition-colors cursor-default">
                        <div class="flex items-center justify-between text-xs mb-1.5 gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <i data-lucide="${item.meta.icon}" class="w-3.5 h-3.5 flex-shrink-0" style="color: ${item.meta.color}"></i>
                                <span class="font-bold text-ink truncate">${escapeHtml(item.meta.name)}</span>
                            </div>
                            <span class="text-ink-muted font-mono font-bold text-[10px] flex-shrink-0">${item.saves} saves · ${item.users}u</span>
                        </div>
                        <div class="h-2 bg-canvas border border-line-muted rounded-full overflow-hidden p-[1px]">
                            <div class="h-full rounded-full transition-all duration-700" style="width: ${percent}%; background: ${item.meta.color}"></div>
                        </div>
                    </div>`
            }).join('')
            lucide.createIcons({ root: breakdownEl })
        }
    }
}

function renderDashboardInsights(summary, adoptedCanonicalTools) {
    // 1. Top Active Teachers Leaderboard
    const topTeachersEl = document.getElementById('topTeachersList')
    if (topTeachersEl) {
        const rankedTeachers = Array.isArray(summary.top_teachers) ? summary.top_teachers : []
        if (!rankedTeachers.length) {
            topTeachersEl.innerHTML = '<div class="text-center py-8 text-ink-muted font-bold text-xs">No active teachers yet</div>'
        } else {
            topTeachersEl.innerHTML = rankedTeachers.map((u, idx) => {
                const name = u.display_name || String(u.user_id || '').slice(0, 8)
                const role = u.role || 'user'
                const latestTs = parseTimestampMs(u.latest_ts)
                const hasBreakdown = u.total_logs !== undefined || u.total_activity !== undefined
                const totalScore = Number(u.total_activity ?? u.saves) || 0
                const savesCount = Number(u.saves) || 0
                const logsCount = Number(u.total_logs) || 0
                const activeDays = Number(u.active_days) || 0
                const roleBadge = role === 'admin'
                    ? '<span class="px-1.5 py-0.5 rounded bg-pink/15 text-pink text-[9px] font-black uppercase">Admin</span>'
                    : role === 'pro'
                        ? '<span class="px-1.5 py-0.5 rounded bg-orange/15 text-orange text-[9px] font-black uppercase">⭐ Pro</span>'
                        : ''
                return `
                    <div onclick="viewUser('${escapeJsAttr(u.user_id)}')" class="flex items-center justify-between p-2.5 bg-surface-muted/70 hover:bg-surface-muted border border-line-muted hover:border-blue rounded-xl cursor-pointer transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-7 h-7 rounded-lg bg-blue/15 border border-blue/40 flex items-center justify-center font-heading text-xs text-blue flex-shrink-0">#${idx + 1}</div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold text-ink text-xs truncate">${escapeHtml(name)}</span>
                                    ${roleBadge}
                                </div>
                                <div class="text-[10px] text-ink-muted font-mono">${Number(u.tool_count) || 0} tools${hasBreakdown && activeDays > 0 ? ` · ${activeDays}d` : ''} · ${formatRelativeTime(latestTs)}</div>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 ml-2">
                            <div class="font-heading text-sm text-ink">${totalScore}</div>
                            <div class="text-[9px] text-ink-muted font-mono font-bold">${hasBreakdown ? `${savesCount}S · ${logsCount}L` : 'records'}</div>
                        </div>
                    </div>
                `
            }).join('')
        }
    }

    // 2. Recent Live Activity Stream
    const recentFeedEl = document.getElementById('recentActivityFeed')
    if (recentFeedEl) {
        const recent = Array.isArray(summary.recent_activity) ? summary.recent_activity : []
        if (!recent.length) {
            recentFeedEl.innerHTML = '<div class="text-center py-8 text-ink-muted font-bold text-xs">No recent activity</div>'
        } else {
            recentFeedEl.innerHTML = recent.map(ev => {
                const name = ev.display_name || String(ev.user_id || '').slice(0, 8)
                const meta = getToolMeta(ev.canonical_tool || ev.tool_key)
                const tsMs = parseTimestampMs(ev.event_ts)
                return `
                    <div onclick="viewUser('${escapeJsAttr(ev.user_id)}')" class="flex items-center justify-between p-2.5 bg-surface-muted/70 hover:bg-surface-muted border border-line-muted hover:border-green rounded-xl cursor-pointer transition-all gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${meta.color}20; border:1px solid ${meta.color}50">
                                <i data-lucide="${meta.icon}" class="w-3.5 h-3.5" style="color:${meta.color}"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-ink truncate">${escapeHtml(name)} <span class="text-ink-muted font-normal">→</span> <span style="color:${meta.color}">${escapeHtml(meta.name)}</span></div>
                                <div class="text-[10px] text-ink-muted truncate font-mono">${escapeHtml(String(ev.action_type || 'Save').replace(/_/g, ' '))}: ${escapeHtml(String(ev.label || '').slice(0, 32))}</div>
                            </div>
                        </div>
                        <span class="text-[10px] font-mono text-ink-muted whitespace-nowrap flex-shrink-0">${formatRelativeTime(tsMs)}</span>
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
                            <span class="font-bold text-ink">${cg.label}</span>
                            <span class="font-mono text-ink-muted text-[11px]">${used} / ${items.length} (${pct}%)</span>
                        </div>
                        <div class="h-2 bg-canvas border border-line-muted rounded-full overflow-hidden p-[1px]">
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
                    <span class="px-2 py-0.5 rounded-lg bg-surface-muted border border-line-muted text-[10px] font-bold text-ink-muted">${escapeHtml(g.title)}</span>
                `).join('')
            }
        }
    }
}

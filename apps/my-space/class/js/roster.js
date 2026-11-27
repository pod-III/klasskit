const StudentManager = {
  entryMode: 'single',

  copyToClipboard() {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData || !classData.students || classData.students.length === 0) {
      UI.showToast('No students to copy', 'warning');
      return;
    }
    
    const namesString = classData.students
      .map(s => s.name || '')
      .filter(name => name.trim() !== '')
      .join(',');
    
    navigator.clipboard.writeText(namesString).then(() => {
      UI.showToast('Student names copied as CSV!', 'success');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      UI.showToast('Failed to copy to clipboard', 'error');
    });
  },

  render() {
    const grid = document.getElementById('studentGrid');
    const empty = document.getElementById('noStudentsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    
    if (!classData || classData.students.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = classData.students.map(s => {
      // Calculate Attendance stats
      const attendanceEntries = Object.entries(classData.attendance || {});
      const studentAttendance = attendanceEntries.filter(([date, list]) => list.includes(s.id));
      const totalSessions = attendanceEntries.length;
      const attendancePct = totalSessions > 0 ? Math.round((studentAttendance.length / totalSessions) * 100) : 0;
      
      // Calculate Last 4 Weeks Absences
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentAbsences = attendanceEntries.filter(([date, list]) => {
        return date >= fourWeeksAgo.toISOString().split('T')[0] && !list.includes(s.id);
      }).length;

      // Calculate Skill stats
      const studentSkills = classData.studentSkills?.[s.id] || {};
      const skillValues = Object.values(studentSkills);
      const avgSkill = skillValues.length > 0 ? (skillValues.reduce((a, b) => a + b, 0) / skillValues.length).toFixed(1) : '—';
      const lowSkills = Object.entries(studentSkills)
        .filter(([id, val]) => val > 0 && val <= 3)
        .map(([id, val]) => classData.skills.find(sk => sk.id === id)?.name)
        .filter(Boolean);

      // Warning Logic
      const warnings = [];
      if (recentAbsences >= 2) warnings.push(`Missed ${recentAbsences} sessions in 4w`);
      if (lowSkills.length > 0) warnings.push(`Low: ${lowSkills.slice(0, 2).join(', ')}${lowSkills.length > 2 ? '...' : ''}`);

      return `
      <div class="student-card border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-2xl p-5 bg-white dark:bg-slate-900/50 shadow-neo-sm hover:-translate-y-1 transition-transform overflow-hidden flex flex-col">
        <!-- Header: Avatar + Identity + Actions -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-14 h-14 bg-blue/10 rounded-2xl flex items-center justify-center text-blue font-black text-2xl border-[3px] border-blue/20 flex-shrink-0">
              ${(s.nick || s.name).charAt(0)}
            </div>
            <div class="min-w-0">
              <h4 class="font-heading font-bold text-xl leading-tight text-slate-800 dark:text-white truncate">${s.nick || s.name}</h4>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">${s.nick ? s.name : 'No Nickname'}</p>
            </div>
          </div>
          <div class="flex items-center gap-0.5 flex-shrink-0">
            <button onclick="StudentManager.openProgress('${s.id}')" class="p-2 text-slate-400 hover:text-green transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="View Progress">
              <i data-lucide="activity" class="w-4 h-4"></i>
            </button>
            <button onclick="StudentManager.edit('${s.id}')" class="p-2 text-slate-400 hover:text-blue transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="StudentManager.delete('${s.id}')" class="p-2 text-slate-400 hover:text-pink transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Warning Chips -->
        ${warnings.length > 0 ? `
          <div class="flex flex-wrap gap-1.5 mb-3">
            ${warnings.map(w => `
              <div class="inline-flex items-center gap-1 px-2 py-0.5 bg-pink/10 border border-pink/20 text-pink text-[8px] font-black rounded-full uppercase">
                <i data-lucide="alert-triangle" class="w-2.5 h-2.5"></i> ${w}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Stats Bar -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Attendance</div>
            <div class="font-heading font-bold text-lg text-slate-800 dark:text-white leading-none">${attendancePct}<span class="text-xs">%</span></div>
            <div class="text-[8px] font-bold text-slate-400 mt-0.5">${studentAttendance.length}/${totalSessions}</div>
          </div>
          <div class="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Skills</div>
            <div class="font-heading font-bold text-lg text-slate-800 dark:text-white leading-none">${avgSkill}</div>
            <div class="text-[8px] font-bold text-slate-400 mt-0.5">${skillValues.length} rated</div>
          </div>
          <div class="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Stars</div>
            <div class="flex items-center justify-center gap-1">
              <button onclick="StudentManager.updateStars('${s.id}', -1)" class="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-300 text-[10px] font-black">-</button>
              <span class="font-heading font-bold text-lg text-blue leading-none w-5 text-center">${s.stars || 0}</span>
              <button onclick="StudentManager.updateStars('${s.id}', 1)" class="w-5 h-5 rounded-md bg-blue text-white flex items-center justify-center hover:brightness-110 text-[10px] font-black">+</button>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-start gap-2">
            <i data-lucide="quote" class="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0"></i>
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              ${s.notes || '<span class="italic opacity-60">No notes yet. Click edit to add observations.</span>'}
            </p>
          </div>
        </div>
      </div>
    `;
    }).join('');
    
    if (window.lucide) lucide.createIcons({ root: grid });
  },

  setEntryMode(mode) {
    this.entryMode = mode;
    const isSingle = mode === 'single';
    
    document.getElementById('form-single').classList.toggle('hidden', !isSingle);
    document.getElementById('form-bulk').classList.toggle('hidden', isSingle);
    
    document.getElementById('mode-single').className = isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-neo-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    document.getElementById('mode-bulk').className = !isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-neo-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    
    document.getElementById('saveStudentBtn').textContent = isSingle ? 'Add Student' : 'Add Students';
  },

  save() {
    if (this.entryMode === 'bulk') {
      this.saveBulk();
    } else {
      this.saveSingle();
    }
  },

  saveSingle() {
    const name = document.getElementById('studentNameInput').value.trim();
    const nick = document.getElementById('studentNickInput').value.trim();
    
    if (!name) return;
    
    const newStudent = {
      id: crypto.randomUUID(),
      name,
      nick,
      stars: 0,
      notes: '',
      joinedAt: new Date().toISOString()
    };
    
    this.addStudentToData(newStudent);
    
    // Clear inputs
    document.getElementById('studentNameInput').value = '';
    document.getElementById('studentNickInput').value = '';
    
    this.finalizeSave();
  },

  saveBulk() {
    const bulkText = document.getElementById('studentBulkInput').value.trim();
    if (!bulkText) return;

    const names = bulkText.split('\n').map(n => n.trim()).filter(n => n !== '');
    if (names.length === 0) return;

    names.forEach(name => {
      const newStudent = {
        id: crypto.randomUUID(),
        name,
        nick: '',
        stars: 0,
        notes: '',
        joinedAt: new Date().toISOString()
      };
      this.addStudentToData(newStudent);
    });

    // Clear input
    document.getElementById('studentBulkInput').value = '';
    
    this.finalizeSave();
  },

  addStudentToData(student) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.students) classData.students = [];
    classData.students.push(student);
  },

  finalizeSave() {
    ClassManager.saveData();
    ModalManager.closeAll();
    ClassManager.updateUI();
    UI.showToast('Students added successfully!', 'success');
  },

  async delete(id) {
    const confirmed = await showConfirmModal('Are you sure you want to remove this student?', {
      title: 'Remove Student?',
      confirmText: 'Remove',
      cancelText: 'Keep',
      icon: 'user-x',
      iconColor: 'red'
    });
    if (!confirmed) return;
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.students = classData.students.filter(s => s.id !== id);
    
    ClassManager.saveData();
    this.render();
    ClassManager.updateUI();
    UI.showToast('Student removed', 'info');
  },

  updateStars(id, delta) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (student) {
      student.stars = Math.max(0, (student.stars || 0) + delta);
      ClassManager.saveData();
      this.render();
    }
  },

  async edit(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (!student) return;
    
    const newNotes = await quickPrompt('Edit notes for ' + (student.nick || student.name), student.notes || '');
    if (newNotes !== null) {
      student.notes = newNotes;
      ClassManager.saveData();
      this.render();
    }
  },

  openProgress(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (!student) return;

    const studentSkills = classData.studentSkills?.[id] || {};
    const skills = classData.skills || [];

    // Attendance
    const attendanceEntries = Object.entries(classData.attendance || {});
    const studentAttendance = attendanceEntries.filter(([date, list]) => list.includes(id));
    const totalSessions = attendanceEntries.length;
    const attendancePct = totalSessions > 0 ? Math.round((studentAttendance.length / totalSessions) * 100) : 0;

    // Stats
    const skillValues = Object.values(studentSkills).filter(v => v > 0);
    const avgSkill = skillValues.length > 0 ? (skillValues.reduce((a, b) => a + b, 0) / skillValues.length).toFixed(1) : '—';
    const topSkillEntry = Object.entries(studentSkills)
      .filter(([sid, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])[0];
    const topSkill = topSkillEntry ? skills.find(s => s.id === topSkillEntry[0])?.name || '—' : '—';

    // Populate modal
    document.getElementById('progressAvatar').textContent = (student.nick || student.name).charAt(0);
    document.getElementById('progressName').textContent = student.nick || student.name;
    document.getElementById('progressMeta').textContent = ClassManager.activeClass;
    document.getElementById('progressAttendance').textContent = attendancePct + '%';
    document.getElementById('progressAttendanceSub').textContent = `${studentAttendance.length}/${totalSessions} sessions`;
    document.getElementById('progressSkillAvg').textContent = avgSkill;
    document.getElementById('progressSkillCount').textContent = `${skillValues.length} rated`;
    document.getElementById('progressStars').textContent = student.stars || 0;
    document.getElementById('progressTopSkill').textContent = topSkill;
    document.getElementById('progressNotes').innerHTML = student.notes || '<span class="italic opacity-60">No notes yet.</span>';

    // Snapshot Timeline
    const timeline = document.getElementById('progressSnapshotTimeline');
    const snapshots = classData.skillSnapshots?.[id] || [];
    if (snapshots.length === 0) {
      timeline.innerHTML = '<p class="text-xs text-slate-400 italic">No snapshots yet. Open the Skills tab and click the camera button to save one.</p>';
    } else {
      timeline.innerHTML = snapshots.slice().reverse().map((snap, idx, arr) => {
        const d = new Date(snap.date);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const snapSkillEntries = Object.entries(snap.ratings || {}).filter(([skid, val]) => val > 0);
        const avgSnap = snapSkillEntries.length > 0
          ? (snapSkillEntries.reduce((a, b) => a + b[1], 0) / snapSkillEntries.length).toFixed(1)
          : '—';
        return `
          <div class="flex gap-3">
            <div class="flex flex-col items-center gap-1 pt-1">
              <div class="w-2.5 h-2.5 rounded-full bg-green border-2 border-white dark:border-slate-900 shadow-sm"></div>
              ${idx < arr.length - 1 ? '<div class="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700"></div>' : '<div class="w-0.5 flex-1"></div>'}
            </div>
            <div class="flex-1 pb-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">${dateStr}</span>
                <span class="text-[9px] font-bold text-slate-400">${timeStr}</span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50 p-3">
                <div class="flex flex-wrap gap-2 mb-2">
                  ${snapSkillEntries.slice(0, 6).map(([skid, val]) => {
                    const skName = skills.find(s => s.id === skid)?.name || '?';
                    return `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue/10 text-blue border border-blue/20">${skName}: ${val}</span>`;
                  }).join('')}
                  ${snapSkillEntries.length > 6 ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">+${snapSkillEntries.length - 6} more</span>` : ''}
                </div>
                ${snap.notes ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">${snap.notes}</p>` : ''}
                <div class="mt-1.5 flex items-center gap-2">
                  <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Avg</span>
                  <span class="text-xs font-black text-blue">${avgSnap}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Skill bars
    const barsContainer = document.getElementById('progressSkillBars');
    if (skills.length === 0) {
      barsContainer.innerHTML = '<p class="text-xs text-slate-400 italic">No skills defined for this class.</p>';
    } else {
      barsContainer.innerHTML = skills.map(sk => {
        const val = studentSkills[sk.id] || 0;
        const pct = Math.min(100, Math.max(0, val));
        const color = 'bg-blue';
        return `
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-black uppercase text-slate-500 w-24 text-right tracking-wider flex-shrink-0">${sk.name}</span>
            <div class="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${color} rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
            <span class="text-xs font-black text-slate-700 dark:text-slate-300 w-6 text-right flex-shrink-0">${val}</span>
          </div>
        `;
      }).join('');
    }

    // Radar chart
    const ctx = document.getElementById('progressRadarChart').getContext('2d');
    if (window._progressRadarChart) window._progressRadarChart.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const tickColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

    if (skills.length > 0) {
      window._progressRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: skills.map(s => s.name),
          datasets: [{
            label: 'Current Rating',
            data: skills.map(s => studentSkills[s.id] || 0),
            backgroundColor: 'rgba(30, 167, 253, 0.2)',
            borderColor: '#1ea7fd',
            pointBackgroundColor: '#1ea7fd',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#1ea7fd',
            borderWidth: 2,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: { stepSize: 1, color: tickColor, backdropColor: 'transparent' },
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              pointLabels: { color: tickColor, font: { family: 'Fredoka', size: 11, weight: '700' } }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    } else {
      // No skills: show placeholder
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ModalManager.open('progressModal');
    if (window.lucide) lucide.createIcons();
  }
};


const StatsManager = {
  render() {
    const grid = document.getElementById('statsGrid');
    const empty = document.getElementById('noStatsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);
    
    if (!classData || (classData.students.length === 0 && classData.reflections.length === 0)) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    // Calculate Curriculum Progress (Admin Tracker logic parity)
    const redDays = JSON.parse(localStorage.getItem('schedule_red_days') || '[]');
    const syllabusMap = JSON.parse(localStorage.getItem('schedule_class_units') || '{}');
    const allEvents = ClassManager.classes.flatMap(c => c.events); // Simplified for calculation
    
    let taught = 0;
    let planned = 0;
    const totalSessions = classInfo?.events.length || 0;

    if (classInfo) {
      classInfo.events.forEach(evt => {
        if (evt.coveredBy) return;
        
        const session = window.Sync.getSessionForDate(classInfo.name, evt.date, allEvents, redDays, syllabusMap, evt.startTime);
        
        let status = 'not_ready';
        if (session.override_type) {
          status = 'ready';
        } else if (session.lesson) {
          status = session.lesson.status || (session.lesson.is_completed ? 'completed' : 'not_ready');
        }

        if (status === 'completed') {
          taught++;
          planned++;
        } else if (status === 'ready') {
          planned++;
        }
      });
    }

    const curriculumPct = totalSessions > 0 ? Math.round((taught / totalSessions) * 100) : 0;

    // Calculate Attendance Average
    const attendanceEntries = Object.entries(classData.attendance || {});
    let totalAttendancePct = 0;
    if (attendanceEntries.length > 0 && classData.students.length > 0) {
      const sum = attendanceEntries.reduce((acc, [date, list]) => {
        return acc + (list.length / classData.students.length);
      }, 0);
      totalAttendancePct = Math.round((sum / attendanceEntries.length) * 100);
    }

    // Calculate Skill Stats
    const inputSkillsCount = (classData.skills || []).filter(s => s.type === 'input').length;
    const outputSkillsCount = (classData.skills || []).filter(s => s.type === 'output').length;

    const stats = [
      { label: 'Class Size', value: classData.students.length, sub: 'Active Students', icon: 'users', color: 'blue' },
      { label: 'Attendance', value: totalAttendancePct + '%', sub: `${attendanceEntries.length} Sessions`, icon: 'clipboard-check', color: 'green' },
      { label: 'Skills', value: inputSkillsCount + outputSkillsCount, sub: `${inputSkillsCount} In / ${outputSkillsCount} Out`, icon: 'target', color: 'pink' },
      { label: 'Reflections', value: classData.reflections.length, sub: 'Gibbs Cycle', icon: 'message-square', color: 'orange' },
      { label: 'Avg Mastery', value: this.calculateAvgStars(classData) + ' ★', sub: 'Class Score', icon: 'star', color: 'blue' },
      { label: 'Curriculum', value: `${taught}/${totalSessions}`, sub: `${curriculumPct}% Course Progress`, icon: 'calendar', color: 'pink' }
    ];

    grid.innerHTML = stats.map(s => `
      <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo-sm bg-white dark:bg-slate-900/50 hover:scale-[1.02] transition-transform cursor-default">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-${s.color}/10 text-${s.color} border-2 border-${s.color}/20">
            <i data-lucide="${s.icon}" class="w-6 h-6"></i>
          </div>
          <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live</span>
        </div>
        <div class="space-y-1">
          <h4 class="text-3xl font-black text-slate-800 dark:text-white tracking-tight">${s.value}</h4>
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">${s.label}</p>
          <p class="text-[9px] font-bold text-slate-300 italic mt-1">${s.sub}</p>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons({ root: grid });
  },

  calculateAvgStars(classData) {
    if (!classData.students || classData.students.length === 0) return 0;
    const total = classData.students.reduce((sum, s) => sum + (s.stars || 0), 0);
    return (total / classData.students.length).toFixed(1);
  }
};

const AttendanceManager = {
  showTimes: false,
  currentFilter: 'all',

  setFilter(filter) {
    this.currentFilter = filter;
    // Update button UI
    document.querySelectorAll('.att-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `att-filter-${filter}`);
    });
    this.render();
  },

  render() {
    const header = document.getElementById('attendanceTableHeader');
    const body = document.getElementById('attendanceTableBody');
    const empty = document.getElementById('noAttendanceState');
    const summary = document.getElementById('attendanceSummary');
    const container = document.getElementById('attendanceTableContainer');
    
    // Safety check
    if (!header || !body || !empty || !summary || !container) {
      console.warn('Attendance DOM elements missing');
      return;
    }

    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);

    if (!classData || !classInfo) return;

    // Filter sessions based on current filter
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);
    
    let sessions = [...classInfo.events].sort((a, b) => a.date.localeCompare(b.date));

    if (this.currentFilter !== 'all') {
      sessions = sessions.filter(s => {
        const sDate = new Date(s.date);
        const diffDays = (sDate - todayDate) / (1000 * 60 * 60 * 24);

        switch (this.currentFilter) {
          case 'today':
            return s.date === todayStr;
          case '3days':
            return diffDays >= -1 && diffDays <= 2; // Yesterday to Day After Tomorrow
          case 'week': {
            const startOfWeek = new Date(todayDate);
            startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return sDate >= startOfWeek && sDate <= endOfWeek;
          }
          case 'month':
            return sDate.getMonth() === todayDate.getMonth() && sDate.getFullYear() === todayDate.getFullYear();
          default:
            return true;
        }
      });
    }

    if (sessions.length === 0 || classData.students.length === 0) {
      empty.classList.remove('hidden');
      container.classList.add('hidden');
      summary.classList.add('hidden');
      // Fix: Show empty message based on filter
      empty.querySelector('p').textContent = this.currentFilter === 'all' 
        ? 'No sessions found for this class.' 
        : `No sessions found for the "${this.currentFilter}" filter.`;
      return;
    }

    empty.classList.add('hidden');
    container.classList.remove('hidden');
    summary.classList.remove('hidden');

    // Update Toggle Button Text
    const toggleBtn = document.querySelector('[onclick="AttendanceManager.toggleTimeView()"] span');
    if (toggleBtn) toggleBtn.textContent = this.showTimes ? 'Hide Times' : 'Show Times';

    // Render Headers
    header.innerHTML = `
      <tr>
        <th class="sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 text-left !p-4 min-w-[150px] border-r border-slate-200 dark:border-slate-700">Student</th>
        ${sessions.map(s => {
          const d = new Date(s.date);
          const isFuture = s.date > todayStr;
          return `
            <th class="text-center !p-3 min-w-[100px] border-r border-slate-200 dark:border-slate-700 ${isFuture ? 'opacity-50' : ''}">
              <div class="flex flex-col items-center">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span class="text-xs font-bold text-slate-700 dark:text-white">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                ${this.showTimes ? `<span class="text-[9px] font-black text-blue mt-1">${s.startTime}</span>` : ''}
                
                <button onclick="AttendanceManager.markSessionPresent('${s.date}')" class="mt-2 p-1.5 bg-green/10 text-green hover:bg-green hover:text-white rounded-lg transition-all shadow-neo-sm group" title="Mark all present for this session">
                  <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </th>
          `;
        }).join('')}
      </tr>
    `;

    // Render Body
    body.innerHTML = classData.students.map(student => {
      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
          <td class="sticky left-0 bg-white dark:bg-slate-900 z-10 !p-4 border-r border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue/10 flex items-center justify-center text-blue font-black text-[10px] border border-blue/20">
                ${(student.nick || student.name).charAt(0)}
              </div>
              <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${student.nick || student.name}</span>
            </div>
          </td>
          ${sessions.map(s => {
            const isPresent = (classData.attendance?.[s.date] || []).includes(student.id);
            const isFuture = s.date > todayStr;
            return `
              <td class="text-center !p-2 border-r border-slate-200 dark:border-slate-700 ${isFuture ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''}">
                <button onclick="AttendanceManager.toggle('${student.id}', '${s.date}')" 
                  class="w-10 h-10 rounded-xl transition-all flex items-center justify-center mx-auto
                  ${isPresent 
                    ? 'bg-green text-white shadow-neo-sm scale-110' 
                    : isFuture 
                      ? 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-300 hover:text-slate-400'
                  }">
                  <i data-lucide="${isPresent ? 'check' : 'minus'}" class="w-4 h-4"></i>
                </button>
              </td>
            `;
          }).join('')}
        </tr>
      `;
    }).join('');

    // Update Summary (Only for past/today sessions from the TOTAL pool)
    const allPastSessions = classInfo.events.filter(s => s.date <= todayStr);
    const totalPossible = classData.students.length * allPastSessions.length;
    let totalPresent = 0;
    allPastSessions.forEach(s => {
      totalPresent += (classData.attendance?.[s.date] || []).length;
    });
    const avgPct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

    summary.innerHTML = `
      <div class="flex items-center gap-4 px-4 py-2 bg-green/5 border border-green/10 rounded-2xl">
        <div class="text-green font-black text-xl">${avgPct}%</div>
        <div class="text-[9px] font-bold text-slate-400 uppercase leading-tight">Avg Class<br>Attendance</div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  toggleTimeView() {
    this.showTimes = !this.showTimes;
    this.render();
  },

  markSessionPresent(date) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData) return;

    if (classData.students.length === 0) {
      UI.showToast('No students in this class', 'warning');
      return;
    }

    if (!classData.attendance) classData.attendance = {};
    if (!classData.attendance[date]) classData.attendance[date] = [];
    
    const arr = classData.attendance[date];
    let added = 0;
    classData.students.forEach(student => {
      if (!arr.includes(student.id)) {
        arr.push(student.id);
        added++;
      }
    });

    if (added === 0) {
      UI.showToast('All students already marked present', 'info');
      return;
    }

    ClassManager.saveData();
    this.render();
    UI.showToast(`Marked ${added} students as present`, 'success');
  },

  toggle(studentId, date) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.attendance) classData.attendance = {};
    if (!classData.attendance[date]) classData.attendance[date] = [];

    const arr = classData.attendance[date];
    const idx = arr.indexOf(studentId);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(studentId);
    }

    ClassManager.saveData();
    this.render();
  }
};


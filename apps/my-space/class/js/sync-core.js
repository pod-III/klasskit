/**
 * MY CLASS — Student & Progress Manager
 * ------------------------------------
 * Core logic for tracking students and class reflections.
 */

const ClassManager = {
  activeClass: null,
  classes: [], // List of classes from schedule
  data: {
    classes: {} // Per-class storage { "Class Name": { students: [], reflections: [] } }
  },

  async init() {
    if (typeof requirePro === 'function') await requirePro();

    // 1. Fetch Cloud Data if applicable
    if (window.Sync && !isSandbox()) {
      const user = await getUser();
      if (user) {
        console.info('[MyClass] Fetching cloud data...');
        await Sync.loadFromCloud(user.id);
      }
    }

    // 2. Load Data from Local (which now has cloud data if sync worked)
    await this.loadData();
    
    // 2. Fetch Classes from Schedule
    this.fetchClassesFromSchedule();
    
    // 3. Setup UI
    this.renderClassSelectors();
    this.setupSelectorSync();
    
    // 4. Initial state
    const lastClass = localStorage.getItem('kk_myclass_last_selected');
    if (lastClass && this.classes.some(c => c.name === lastClass)) {
      this.selectClass(lastClass);
    } else {
      this.updateUI();
    }

    // 5. Icons
    if (window.lucide) lucide.createIcons();
    
    // 6. Sync Badge
    this.updateSyncBadge();

    // 7. Keyboard Listeners
    this.setupKeyboardShortcuts();

    // 8. Global Listeners
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') ModalManager.closeAll();
    });

    // 9. Sync Listener
    window._syncRerender = () => {
      console.log('[MyClass] Sync re-render triggered');
      this.loadData().then(() => {
        this.fetchClassesFromSchedule();
        this.renderClassSelectors();
        this.updateUI();
      });
    };

    // 10. Exit Listener (Flush Save)
    window.addEventListener('beforeunload', () => {
      if (this._saveTimeout) {
        clearTimeout(this._saveTimeout);
        localStorage.setItem('prog_my-class', JSON.stringify(this.data));
      }
    });

    // 11. Rich Text Init
    ReflectionManager.init();
  },

  setupKeyboardShortcuts() {
    // Student Form
    const studentInputs = ['studentNameInput', 'studentNickInput'];
    studentInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') StudentManager.save();
        });
      }
    });

    // Skill Form
    const skillInput = document.getElementById('skillNameInput');
    if (skillInput) {
      skillInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') SkillsManager.saveSkill();
      });
    }
  },

  async loadData() {
    const local = localStorage.getItem('prog_my-class');
    if (local) {
      try {
        this.data = JSON.parse(local);
        // Migration: Scale scores from 10 to 100
        if (!this.data.version || this.data.version < 2) {
          this.migrateTo100Scale();
          this.data.version = 2;
          this.saveData();
        }
      } catch (e) {
        console.error('[MyClass] Failed to parse local data', e);
      }
    }

    // Structure check
    if (!this.data || !this.data.classes) {
      this.data = { classes: {} };
    }
  },

  _saveTimeout: null,

  async saveData() {
    // Visual feedback: Mark as saving immediately
    if (window.Sync) Sync.setSyncBadge('saving');

    // Debounce the heavy operations (stringify + network)
    if (this._saveTimeout) clearTimeout(this._saveTimeout);

    this._saveTimeout = setTimeout(async () => {
      try {
        // Local backup
        localStorage.setItem('prog_my-class', JSON.stringify(this.data));
        
        // Trigger cloud sync if available
        if (window.Sync && !isSandbox()) {
          const user = await getUser();
          if (user) {
            console.info('[MyClass] Triggering debounced cloud sync...');
            await Sync.syncToCloud(user.id);
          }
        }
      } catch (e) {
        console.error('[MyClass] Save failed', e);
      } finally {
        this.updateSyncBadge();
        this._saveTimeout = null;
      }
    }, 1500); // 1.5 second debounce for slider performance
  },

  migrateTo100Scale() {
    console.info('[MyClass] Migrating data to 100-point scale...');
    for (const className in this.data.classes) {
      const cls = this.data.classes[className];
      // 1. Migrate puScores in students
      if (cls.students) {
        cls.students.forEach(s => {
          if (s.puScores) {
            for (const k in s.puScores) {
              const val = s.puScores[k];
              if (val !== '' && !isNaN(val) && val <= 10) {
                s.puScores[k] = val * 10;
              }
            }
          }
        });
      }
      // 2. Migrate studentSkills
      if (cls.studentSkills) {
        for (const studentId in cls.studentSkills) {
          const skills = cls.studentSkills[studentId];
          for (const skillId in skills) {
            if (skills[skillId] <= 10) {
              skills[skillId] = skills[skillId] * 10;
            }
          }
        }
      }
      // 3. Migrate snapshots
      if (cls.skillSnapshots) {
        for (const studentId in cls.skillSnapshots) {
          cls.skillSnapshots[studentId].forEach(snap => {
            if (snap.levels) {
              for (const skillId in snap.levels) {
                if (snap.levels[skillId] <= 10) {
                  snap.levels[skillId] = snap.levels[skillId] * 10;
                }
              }
            }
          });
        }
      }
    }
  },

  fetchClassesFromSchedule() {
    const mastersRaw = localStorage.getItem('schedule_events');
    const promotedRaw = localStorage.getItem('schedule_promoted_instances');
    const redDays = JSON.parse(localStorage.getItem('schedule_red_days') || '[]');
    if (!mastersRaw) return;
    
    try {
      const masters = JSON.parse(mastersRaw);
      const promoted = promotedRaw ? JSON.parse(promotedRaw) : [];
      const classMap = {};
      
      masters.forEach(evt => {
        if (evt.typeId === 'class' && evt.name) {
          if (!classMap[evt.name]) {
            classMap[evt.name] = {
              name: evt.name,
              color: evt.color || '#1ea7fd',
              events: []
            };
          }
          
          const targetClass = classMap[evt.name];
          
          // 1. Add Master
          targetClass.events.push(evt);

          // 2. Generate Recurrences (6 Months for parity with Admin Tracker)
          if (evt.recurrence && evt.recurrence !== 'none' && window.Sync) {
            const rangeStart = new Date(evt.date);
            const rangeEnd = new Date(rangeStart);
            rangeEnd.setMonth(rangeEnd.getMonth() + 6);
            
            const clones = Sync.generateRecurrences(evt, rangeStart, rangeEnd);
            targetClass.events.push(...clones);
          }
        }
      });
      
      // 3. Finalize and Deduplicate events for each class
      Object.values(classMap).forEach(cls => {
        // Map promoted instances back to this class
        promoted.forEach(p => {
          if (p.name === cls.name && p.typeId === 'class') {
            const idx = cls.events.findIndex(e => e.id === p.id);
            if (idx !== -1) {
              cls.events[idx] = p;
            } else if (p.isRecurrence) {
              cls.events.push(p);
            }
          }
        });

        // Deduplicate and filter red days
        const uniqueEvents = {};
        cls.events.forEach(e => {
          // If multiple events on same day/time, promoted takes precedence
          const key = `${e.date}_${e.startTime}`;
          if (!uniqueEvents[key] || (!uniqueEvents[key]._modified && e._modified) || !uniqueEvents[key].isRecurrence) {
            uniqueEvents[key] = e;
          }
        });

        cls.events = Object.values(uniqueEvents)
          .filter(e => !(e.isRecurrence && redDays.includes(e.date)))
          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      });
      
      this.classes = Object.values(classMap);
    } catch (e) {
      console.error('[MyClass] Failed to fetch classes from schedule', e);
    }
  },

  renderClassSelectors() {
    const selectors = [
      document.getElementById('classSelector'),
      document.getElementById('classSelectorMobile')
    ];

    selectors.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">Select a class...</option>' + 
        this.classes.map(c => `<option value="${c.name}" ${this.activeClass === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    });
  },

  setupSelectorSync() {
    const desktop = document.getElementById('classSelector');
    const mobile = document.getElementById('classSelectorMobile');
    
    if (desktop && mobile) {
      desktop.addEventListener('change', (e) => {
        mobile.value = e.target.value;
        this.selectClass(e.target.value);
      });
      mobile.addEventListener('change', (e) => {
        desktop.value = e.target.value;
        this.selectClass(e.target.value);
      });
    }
  },

  selectClass(className) {
    if (!className) {
      this.activeClass = null;
      localStorage.removeItem('kk_myclass_last_selected');
    } else {
      this.activeClass = className;
      localStorage.setItem('kk_myclass_last_selected', className);
      
      // Initialize data structure for this class if not exists
      if (!this.data.classes[className]) {
        this.data.classes[className] = {
          students: [],
          reflections: [],
          attendance: {},
          skills: [],
          studentSkills: {}
        };
      }
      // Ensure existing classes have new fields
      const cd = this.data.classes[className];
      if (!cd.attendance) cd.attendance = {};
      if (!cd.skills) cd.skills = [];
      if (!cd.studentSkills) cd.studentSkills = {};
      if (!cd.skillSnapshots) cd.skillSnapshots = {};
    }
    
    this.renderClassSelectors();
    this.updateUI();
    if (window.lucide) lucide.createIcons();
    
    // Persistence: Trigger save so the cloud remembers our landing state
    this.saveData();
  },

  updateUI() {
    const noClass = document.getElementById('noClassState');
    const workspace = document.getElementById('classWorkspace');
    
    if (!this.activeClass) {
      noClass.classList.remove('hidden');
      workspace.classList.add('hidden');
      document.getElementById('backToGridBtn').classList.add('hidden');
      this.renderClassCards();
      return;
    }

    noClass.classList.add('hidden');
    workspace.classList.remove('hidden');
    document.getElementById('backToGridBtn').classList.remove('hidden');

    // Header Info
    const classInfo = this.classes.find(c => c.name === this.activeClass);
    document.getElementById('classNameDisplay').textContent = this.activeClass;
    document.getElementById('classAvatar').textContent = this.activeClass.charAt(0);
    document.getElementById('classHeaderColor').style.backgroundColor = classInfo?.color || '#1ea7fd';
    
    const classData = this.data.classes[this.activeClass];
    document.getElementById('studentCountBadge').textContent = `${classData.students.length} Students`;
    document.getElementById('reflectionCountBadge').textContent = `${classData.reflections.length} Reflections`;
    
    this.updateNextSession();
    
    // Render current tab
    TabManager.render();
  },

  renderClassCards() {
    const grid = document.getElementById('classGridLanding');
    const empty = document.getElementById('noScheduleState');
    if (!grid) return;

    if (this.classes.length === 0) {
      grid.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');

    // 1. Render Stats
    this.renderLandingStats();

    // 2. Find next session for each class and sort by proximity
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeMin = now.getHours() * 60 + now.getMinutes();

    const classesWithNext = this.classes.map(c => {
      let nextEvent = null;
      let minDiff = Infinity;
      let isToday = false;

      c.events.forEach(e => {
        const evtDate = new Date(e.date + 'T' + (e.startTime || '00:00'));
        const diff = evtDate.getTime() - now.getTime();
        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          nextEvent = e;
          isToday = e.date === todayStr;
        }
      });

      // If no upcoming, find most recent past event
      if (!nextEvent) {
        c.events.forEach(e => {
          const evtDate = new Date(e.date + 'T' + (e.startTime || '00:00'));
          const diff = now.getTime() - evtDate.getTime();
          if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            nextEvent = e;
          }
        });
      }

      return { ...c, nextEvent, isToday, minDiff };
    });

    // Sort: upcoming today first, then future, then past (by recency)
    classesWithNext.sort((a, b) => {
      const aUpcoming = a.nextEvent ? new Date(a.nextEvent.date + 'T' + (a.nextEvent.startTime || '00:00')).getTime() >= now.getTime() : false;
      const bUpcoming = b.nextEvent ? new Date(b.nextEvent.date + 'T' + (b.nextEvent.startTime || '00:00')).getTime() >= now.getTime() : false;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      return a.minDiff - b.minDiff;
    });

    // 3. Render Cards
    const closestClass = classesWithNext.find(c => {
      if (!c.nextEvent) return false;
      const t = new Date(c.nextEvent.date + 'T' + (c.nextEvent.startTime || '00:00')).getTime();
      return t >= now.getTime();
    });

    grid.innerHTML = classesWithNext.map((c, idx) => {
      const classData = this.data.classes[c.name] || { students: [], reflections: [] };
      const studentCount = classData.students?.length || 0;
      const reflectionCount = classData.reflections?.length || 0;
      const isClosest = closestClass && c.name === closestClass.name;

      let sessionLabel = 'No upcoming sessions';
      if (c.nextEvent) {
        const d = new Date(c.nextEvent.date);
        const fmt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (c.isToday) sessionLabel = `Today @ ${c.nextEvent.startTime}`;
        else if (c.nextEvent.date === todayStr) sessionLabel = `Today @ ${c.nextEvent.startTime}`;
        else sessionLabel = `${fmt} @ ${c.nextEvent.startTime}`;
      }

      return `
        <div onclick="ClassManager.selectClass('${c.name.replace(/'/g, "\\'")}')" class="group bg-white dark:bg-slate-900/40 border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo hover:-translate-y-1 hover:shadow-neo dark:hover:shadow-neo transition-all duration-300 ease-out cursor-pointer relative overflow-hidden ${isClosest ? 'ring-2 ring-green/50' : ''}">
          ${isClosest ? `
            <div class="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-green text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-neo-sm animate-pulse">
              <i data-lucide="zap" class="w-3 h-3"></i> Next Up
            </div>
          ` : ''}
          <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white border-[var(--border-width-thick)] border-[var(--border-primary)] shadow-neo-sm group-hover:scale-105 transition-transform" style="background: ${c.color}">
              <span class="font-heading font-bold text-xl uppercase">${c.name.charAt(0)}</span>
            </div>
            <div class="text-right">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enrolled</span>
              <div class="text-lg font-black text-slate-800 dark:text-white leading-none">${studentCount}</div>
            </div>
          </div>
          
          <h3 class="font-heading font-bold text-xl text-slate-900 dark:text-white uppercase tracking-tight mb-1">${c.name}</h3>
          <p class="text-[10px] font-bold ${isClosest ? 'text-green' : 'text-slate-400'} mb-4 flex items-center gap-1">
            <i data-lucide="calendar" class="w-3 h-3"></i> ${sessionLabel}
          </p>
          
          <div class="flex items-center justify-between pt-4 border-t-[var(--border-width-thick)] border-[var(--bg-tertiary)] dark:border-slate-800">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <i data-lucide="message-square" class="w-3.5 h-3.5 text-orange"></i>
                <span class="text-[10px] font-bold text-slate-500">${reflectionCount}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <i data-lucide="clipboard-check" class="w-3.5 h-3.5 text-green"></i>
                <span class="text-[10px] font-bold text-slate-500">${Object.keys(classData.attendance || {}).length}</span>
              </div>
            </div>
            <span class="text-[9px] font-black uppercase text-blue group-hover:translate-x-1 transition-transform">View Class →</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: grid });
  },

  renderLandingStats() {
    const statsGrid = document.getElementById('landingStatsGrid');
    const hofList = document.getElementById('hallOfFameList');
    const todayBanner = document.getElementById('todayScheduleBanner');
    const todayList = document.getElementById('todaySessionsList');
    const todayLabel = document.getElementById('todayDateLabel');
    if (!statsGrid) return;

    // Calculate Aggregates
    const totalClasses = this.classes.length;
    let totalStudents = 0;
    let totalReflections = 0;
    let totalPossibleAttendance = 0;
    let totalPresentAttendance = 0;
    const allStudentsForHOF = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeMin = now.getHours() * 60 + now.getMinutes();

    // Collect today's sessions across all classes
    const todaySessions = [];
    let nextClassName = null;
    let nextClassTime = null;
    let minDiff = Infinity;

    this.classes.forEach(c => {
      const classData = this.data.classes[c.name];
      if (!classData) return;

      const classStudents = classData.students || [];
      totalStudents += classStudents.length;
      totalReflections += (classData.reflections || []).length;

      classStudents.forEach(s => {
        allStudentsForHOF.push({ ...s, className: c.name });
      });

      // Attendance Calculation
      if (classStudents.length > 0 && classData.attendance) {
        const pastSessions = c.events.filter(e => e.date <= todayStr);
        totalPossibleAttendance += pastSessions.length * classStudents.length;
        
        pastSessions.forEach(s => {
          totalPresentAttendance += (classData.attendance[s.date] || []).length;
        });
      }

      // Find next session across all classes
      c.events.forEach(e => {
        if (e.date === todayStr) {
          todaySessions.push({ className: c.name, color: c.color, time: e.startTime, endTime: e.endTime });
        }
        // Find next upcoming session (today or future)
        const evtDate = new Date(e.date + 'T' + (e.startTime || '00:00'));
        const diff = evtDate.getTime() - now.getTime();
        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          nextClassName = c.name;
          nextClassTime = e.startTime;
        }
      });
    });

    const avgAttendance = totalPossibleAttendance > 0 
      ? Math.round((totalPresentAttendance / totalPossibleAttendance) * 100) 
      : 0;

    // Build stats with Next Class replacing Avg Attendance when relevant
    const stats = [
      { label: 'Active Classes', value: totalClasses, icon: 'book-open', color: 'blue', sub: 'In Current Schedule' },
      { label: 'Total Students', value: totalStudents, icon: 'users', color: 'orange', sub: 'Across All Classes' },
      { label: 'Reflections', value: totalReflections, icon: 'message-square', color: 'pink', sub: 'Gibbs Cycle Entries' },
      { label: 'Avg Attendance', value: avgAttendance + '%', icon: 'clipboard-check', color: 'green', sub: 'Past Sessions' }
    ];

    // If there's a next class today, show it prominently
    if (nextClassName && minDiff < 24 * 60 * 60 * 1000) {
      stats[3] = { label: 'Next Class', value: nextClassTime, icon: 'clock', color: 'green', sub: nextClassName };
    }

    statsGrid.innerHTML = stats.map(s => `
      <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo-sm bg-white dark:bg-slate-900/40 flex items-center gap-5 hover:scale-[1.02] transition-transform cursor-default">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-${s.color}/10 text-${s.color} border-[var(--border-width-medium)] border-${s.color}/20 flex-shrink-0">
          <i data-lucide="${s.icon}" class="w-7 h-7"></i>
        </div>
        <div class="space-y-0.5 min-w-0">
          <div class="text-2xl font-black text-slate-800 dark:text-white leading-tight truncate">${s.value}</div>
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${s.label}</div>
          <div class="text-[9px] font-bold text-slate-300 italic truncate">${s.sub}</div>
        </div>
      </div>
    `).join('');

    // Today's Schedule Banner
    if (todayBanner && todayList && todayLabel) {
      if (todaySessions.length > 0) {
        todayBanner.classList.remove('hidden');
        todayLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        todaySessions.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        todayList.innerHTML = todaySessions.map(s => {
          const sMin = s.time ? parseInt(s.time.split(':')[0]) * 60 + parseInt(s.time.split(':')[1]) : 0;
          const isPast = sMin < currentTimeMin;
          const isNow = Math.abs(sMin - currentTimeMin) < 60;
          return `
            <button onclick="ClassManager.selectClass('${s.className.replace(/'/g, "\\'")}')" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${isNow ? 'border-green bg-green/10 text-green' : isPast ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400' : 'border-blue/30 bg-blue/5 text-blue'} hover:scale-105 transition-transform">
              <div class="w-2 h-2 rounded-full" style="background:${s.color}"></div>
              <span class="text-xs font-bold">${s.className}</span>
              <span class="text-[10px] font-black opacity-70">${s.time}${s.endTime ? '-' + s.endTime : ''}</span>
              ${isNow ? '<span class="text-[8px] font-black uppercase bg-green text-white px-1.5 py-0.5 rounded">Now</span>' : ''}
            </button>
          `;
        }).join('');
      } else {
        todayBanner.classList.add('hidden');
      }
    }

    // Hall of Fame
    if (hofList) {
      const topStudents = allStudentsForHOF
        .sort((a, b) => (b.stars || 0) - (a.stars || 0))
        .slice(0, 5);

      if (topStudents.length === 0) {
        hofList.innerHTML = `
          <div class="text-center py-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase">No stars awarded yet</p>
          </div>
        `;
      } else {
        hofList.innerHTML = topStudents.map((s, idx) => `
          <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-orange/30 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-orange/10 text-orange flex items-center justify-center font-black text-xs">
                ${idx + 1}
              </div>
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-white">${s.nick || s.name}</div>
                <div class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${s.className}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 text-orange">
              <span class="text-xs font-black">${s.stars || 0}</span>
              <i data-lucide="star" class="w-3 h-3 fill-orange"></i>
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons({ root: statsGrid });
    if (window.lucide && hofList) lucide.createIcons({ root: hofList });
    if (window.lucide && todayList) lucide.createIcons({ root: todayList });
  },

  updateNextSession() {
    const badge = document.getElementById('nextSessionBadge');
    const classInfo = this.classes.find(c => c.name === this.activeClass);
    if (!classInfo) return;

    const today = new Date().toISOString().split('T')[0];
    const upcoming = classInfo.events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (upcoming) {
      const d = new Date(upcoming.date);
      const fmt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      document.getElementById('nextSessionText').textContent = `${fmt} @ ${upcoming.startTime}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  updateSyncBadge() {
    if (window.Sync) {
      const state = isSandbox() ? 'local' : 'synced';
      Sync.setSyncBadge(state);
    }
  },

  openAddStudent() {
    StudentManager.setEntryMode('single');
    ModalManager.open('studentModal');
    setTimeout(() => document.getElementById('studentNameInput').focus(), 100);
  }
};

const TabManager = {
  current: 'stats',

  switch(tabId) {
    this.current = tabId;

    // UI Update
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `tab-${tabId}`);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `content-${tabId}`);
    });

    this.render();
    if (window.lucide) lucide.createIcons();
  },

  render() {
    switch (this.current) {
      case 'students': StudentManager.render(); break;
      case 'attendance': AttendanceManager.render(); break;
      case 'skills': SkillsManager.render(); break;
      case 'reflections': ReflectionManager.render(); break;
      case 'sessions': SessionManager.render(); break;
      case 'stats': StatsManager.render(); break;
      case 'comments': CommentsManager.render(); break;
      case 'reports': ReportManager.render(); break;
    }
    if (window.lucide) lucide.createIcons();
  }
};


const SessionManager = {
  render() {
    const body = document.getElementById('sessionTableBody');
    const mobileList = document.getElementById('sessionMobileList');
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);
    if (!classInfo) return;

    const redDays = JSON.parse(localStorage.getItem('schedule_red_days') || '[]');
    const syllabusMap = JSON.parse(localStorage.getItem('schedule_class_units') || '{}');
    const allEvents = ClassManager.classes.flatMap(c => c.events);
    const todayStr = new Date().toISOString().split('T')[0];

    // Sort chronologically (Oldest first)
    const events = [...classInfo.events].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    // Desktop Table Rows
    if (body) {
      body.innerHTML = events.map((e) => {
        const session = window.Sync.getSessionForDate(classInfo.name, e.date, allEvents, redDays, syllabusMap, e.startTime);
        const title = session.override_type || session.lesson?.lesson || 'No Lesson Plan';
        const isPast = e.date < todayStr;
        
        return `
          <tr class="border-b border-[var(--bg-tertiary)] dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
            <td class="py-4">
              <div class="flex flex-col px-4">
                <span class="text-sm font-bold">${new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span class="text-[10px] text-slate-400 uppercase tracking-widest">${e.startTime}</span>
              </div>
            </td>
            <td class="py-4">
              <div class="text-sm font-semibold truncate max-w-xs">${title}</div>
            </td>
            <td class="py-4">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${isPast ? 'bg-green/10 text-green border border-green/20' : 'bg-blue/10 text-blue border border-blue/20'}">
                ${isPast ? 'Completed' : 'Upcoming'}
              </span>
            </td>
            <td class="py-4 text-right px-4">
               <button onclick="ReflectionManager.openForSession('${e.date}')" class="p-2 text-blue opacity-0 group-hover:opacity-100 transition-all" title="Add reflection for this session">
                 <i data-lucide="message-square-plus" class="w-5 h-5"></i>
               </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Mobile List Cards
    if (mobileList) {
      mobileList.innerHTML = events.map((e) => {
        const session = window.Sync.getSessionForDate(classInfo.name, e.date, allEvents, redDays, syllabusMap, e.startTime);
        const title = session.override_type || session.lesson?.lesson || 'No Lesson Plan';
        const isPast = e.date < todayStr;
        const dateStr = new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });

        return `
          <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-2xl p-4 shadow-neo-sm hover:-translate-y-1 transition-transform">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest ${isPast ? 'text-green' : 'text-blue'}">${isPast ? 'Session Ended' : 'Upcoming'}</span>
                <span class="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${e.startTime}</span>
              </div>
              <button onclick="ReflectionManager.openForSession('${e.date}')" class="w-8 h-8 flex items-center justify-center bg-blue/10 rounded-lg text-blue">
                <i data-lucide="message-square-plus" class="w-4 h-4"></i>
              </button>
            </div>
            <h4 class="font-heading font-bold text-lg text-slate-900 dark:text-white uppercase leading-tight">${dateStr}</h4>
            <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">${title}</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
            </div>
          </div>
        `;
      }).join('');
    }
    
    if (window.lucide) lucide.createIcons();
  }
};


var QuickActionManager = {
  activeType: null,

  openPicker(type) {
    this.activeType = type;
    const title = document.getElementById('quickActionTitle');
    const list = document.getElementById('quickActionClassList');
    
    if (type === 'reflection') {
      title.innerHTML = '<i data-lucide="pen-tool" class="w-6 h-6 text-orange"></i> New Reflection';
    } else {
      title.innerHTML = '<i data-lucide="clipboard-check" class="w-6 h-6 text-green"></i> Track Attendance';
    }

    if (ClassManager.classes.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8">
          <p class="text-xs font-bold text-slate-500 uppercase">No classes found in schedule</p>
        </div>
      `;
    } else {
      list.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar";
      list.innerHTML = ClassManager.classes.map(c => `
        <button onclick="QuickActionManager.selectForAction('${c.name.replace(/'/g, "\\'")}')" class="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-[var(--border-width-medium)] border-slate-100 dark:border-slate-800 hover:border-blue/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white border-2 border-white/20 shadow-neo-sm flex-shrink-0" style="background: ${c.color}">
            <span class="font-heading font-bold text-xs uppercase">${c.name.charAt(0)}</span>
          </div>
          <span class="font-heading font-bold text-[11px] text-slate-800 dark:text-white uppercase tracking-tight text-left truncate">${c.name}</span>
        </button>
      `).join('');
    }

    if (window.lucide) lucide.createIcons({ root: title });
    if (window.lucide) lucide.createIcons({ root: list });
    
    ModalManager.open('quickActionModal');
  },

  selectForAction(className) {
    const type = this.activeType;
    ModalManager.closeAll();
    
    // 1. Select the class
    ClassManager.selectClass(className);
    
    // 2. Perform action
    setTimeout(() => {
      if (type === 'reflection') {
        ReflectionManager.openNew();
      } else if (type === 'attendance') {
        TabManager.switch('attendance');
      }
    }, 350); // Wait for modal close animation
  }
};

var ModalManager = {
  open(id) {
    const modal = document.getElementById(id);
    const backdrop = document.getElementById('modalBackdrop');
    
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    
    setTimeout(() => {
      modal.classList.remove('opacity-0', 'scale-95');
      modal.classList.add('opacity-100', 'scale-100');
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }, 10);
    
    document.body.style.overflow = 'hidden';
  },

  closeAll() {
    const backdrop = document.getElementById('modalBackdrop');
    const modals = document.querySelectorAll('[id$="Modal"]');
    
    modals.forEach(modal => {
      modal.classList.remove('opacity-100', 'scale-100');
      modal.classList.add('opacity-0', 'scale-95');
      setTimeout(() => modal.classList.add('hidden'), 300);
    });
    
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
    
    document.body.style.overflow = '';
  }
};

var Theme = {
  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme_my-class', isDark ? 'dark' : 'light');
    
    // Save to cloud if possible
    if (window.Sync && !isSandbox()) {
      getUser().then(user => {
        if (user) {
          Sync.cloudSaveSettings(user.id, {
            class: { theme: isDark ? 'dark' : 'light' }
          });
        }
      });
    }
  }
};

var UI = {
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-green' : (type === 'error' ? 'bg-pink' : 'bg-blue');
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');

    toast.className = `flex items-center gap-3 px-6 py-4 rounded-2xl border-[var(--border-width-thick)] border-[var(--border-primary)] text-white shadow-neo translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto ${colorClass}`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span class="font-heading font-bold text-sm uppercase tracking-tight">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    // Animate In
    setTimeout(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animate Out
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};


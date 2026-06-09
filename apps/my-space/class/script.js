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

  edit(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (!student) return;
    
    const newNotes = prompt('Edit notes for ' + (student.nick || student.name), student.notes);
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

const ReflectionManager = {
  currentStep: 0,
  STEPS: ['description', 'feelings', 'evaluation', 'analysis', 'conclusion', 'action'],
  STEP_LABELS: ['Description', 'Feelings', 'Evaluation', 'Analysis', 'Conclusion', 'Action Plan'],
  STEP_COLORS: ['blue', 'pink', 'green', 'orange', 'blue', 'pink'],
  editingId: null,
  editors: {},

  init() {
    this.STEPS.forEach(key => {
      const container = document.getElementById(`gibbs-${key}`);
      if (container) {
        this.editors[key] = new Quill(container, {
          theme: 'snow',
          placeholder: this.getPlaceholder(key),
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['clean']
            ]
          }
        });
      }
    });
  },

  getPlaceholder(key) {
    const placeholders = {
      description: "What happened? Describe the situation objectively...",
      feelings: "What were you thinking and feeling?",
      evaluation: "What was good and bad about the experience?",
      analysis: "What sense can you make of the situation?",
      conclusion: "What else could you have done?",
      action: "If this arose again, what would you do?"
    };
    return placeholders[key] || "Type here...";
  },

  render() {
    const list = document.getElementById('reflectionList');
    const empty = document.getElementById('noReflectionsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    
    if (!classData || classData.reflections.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = classData.reflections
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(r => {
        // Build Gibbs stages display
        const stages = this.STEPS.map((key, i) => {
          const val = r[key] || r.gibbs?.[key] || '';
          if (!val) return '';
          return `
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-${this.STEP_COLORS[i]}/15 text-${this.STEP_COLORS[i]} flex items-center justify-center text-[9px] font-black">${i+1}</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-${this.STEP_COLORS[i]}">${this.STEP_LABELS[i]}</span>
              </div>
              <p class="font-body font-semibold text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed pl-7">${val}</p>
            </div>
          `;
        }).filter(Boolean).join('');

        // Legacy fallback: if reflection has old "text" field
        const legacyText = (!stages && r.text) ? `<p class="font-body font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${r.text}</p>` : '';

        return `
        <div class="border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo-sm bg-white dark:bg-slate-900/40 relative hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 bg-orange/15 text-orange border border-orange/20 rounded-lg font-black text-[10px] uppercase tracking-widest">Gibbs' Cycle</span>
              <span class="text-xs font-bold text-slate-400">${new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="ReflectionManager.edit('${r.id}')" class="text-slate-400 hover:text-blue transition-colors">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="ReflectionManager.delete('${r.id}')" class="text-slate-400 hover:text-pink transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          ${stages ? `<div class="space-y-3">${stages}</div>` : legacyText}
        </div>
      `;
      }).join('');
    
    if (window.lucide) lucide.createIcons({ root: list });
  },

  openNew() {
    this.editingId = null;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reflectionDateInput').value = today;
    this.STEPS.forEach(key => {
      if (this.editors[key]) this.editors[key].root.innerHTML = '';
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  openForSession(date) {
    this.editingId = null;
    document.getElementById('reflectionDateInput').value = date;
    this.STEPS.forEach(key => {
      if (this.editors[key]) this.editors[key].root.innerHTML = '';
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  edit(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const r = classData.reflections.find(ref => ref.id === id);
    if (!r) return;
    this.editingId = id;
    document.getElementById('reflectionDateInput').value = r.date;
    this.STEPS.forEach(key => {
      if (this.editors[key]) {
        const val = r[key] || r.gibbs?.[key] || '';
        this.editors[key].root.innerHTML = val;
      }
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  goToStep(step) {
    this.currentStep = step;
    // Show/hide panels
    for (let i = 0; i < 6; i++) {
      document.getElementById(`gibbs-step-${i}`).classList.toggle('hidden', i !== step);
    }
    // Update stepper buttons
    document.querySelectorAll('.gibbs-step-btn').forEach(btn => {
      const s = parseInt(btn.dataset.step);
      btn.classList.remove('active', 'completed');
      if (s === step) btn.classList.add('active');
      else if (s < step) {
        const key = this.STEPS[s];
        const val = this.editors[key] ? this.editors[key].getText().trim() : '';
        if (val) btn.classList.add('completed');
      }
    });
    // Update nav buttons
    document.getElementById('gibbsPrevBtn').classList.toggle('hidden', step === 0);
    document.getElementById('gibbsNextBtn').classList.toggle('hidden', step === 5);
    document.getElementById('gibbsSaveBtn').classList.toggle('hidden', step !== 5);
  },

  nextStep() {
    if (this.currentStep < 5) this.goToStep(this.currentStep + 1);
  },

  prevStep() {
    if (this.currentStep > 0) this.goToStep(this.currentStep - 1);
  },

  save() {
    const date = document.getElementById('reflectionDateInput').value;
    if (!date) { UI.showToast('Please set a session date', 'error'); return; }
    
    const data = {};
    let hasContent = false;
    this.STEPS.forEach(key => {
      const html = this.editors[key] ? this.editors[key].root.innerHTML.trim() : '';
      const text = this.editors[key] ? this.editors[key].getText().trim() : '';
      
      // Quill adds a <p><br></p> even when empty
      if (text) {
        data[key] = html;
        hasContent = true;
      } else {
        data[key] = '';
      }
    });
    
    if (!hasContent) { UI.showToast('Please fill in at least one stage', 'error'); return; }
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];

    if (this.editingId) {
      const existing = classData.reflections.find(r => r.id === this.editingId);
      if (existing) {
        existing.date = date;
        this.STEPS.forEach(key => { existing[key] = data[key]; });
      }
    } else {
      classData.reflections.push({
        id: crypto.randomUUID(),
        date,
        ...data,
        createdAt: new Date().toISOString()
      });
    }
    
    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    ClassManager.updateUI();
    UI.showToast(this.editingId ? 'Reflection updated!' : 'Reflection saved!', 'success');
    this.editingId = null;
  },

  async delete(id) {
    const confirmed = await showConfirmModal('Are you sure you want to delete this reflection?', {
      title: 'Delete Reflection?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      icon: 'trash-2',
      iconColor: 'red'
    });
    if (!confirmed) return;
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.reflections = classData.reflections.filter(r => r.id !== id);
    
    ClassManager.saveData();
    this.render();
    ClassManager.updateUI();
    UI.showToast('Reflection deleted', 'info');
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

const SkillsManager = {
  selectedStudentId: null,

  render() {
    const content = document.getElementById('skillsContent');
    const empty = document.getElementById('noSkillsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];

    if (!classData) return;
    
    // Auto-initialize core skills from Comment Helper
    this.ensureCoreSkills(classData);

    if (!classData.skills) classData.skills = [];
    if (!classData.studentSkills) classData.studentSkills = {};
    if (!classData.skillSnapshots) classData.skillSnapshots = {};

    if (classData.skills.length === 0) {
      content.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    const skills = classData.skills;
    const snapshots = classData.skillSnapshots;
    const students = classData.students || [];

    // Auto-select first student if none selected
    if (!this.selectedStudentId || !students.find(s => s.id === this.selectedStudentId)) {
      this.selectedStudentId = students.length > 0 ? students[0].id : null;
    }

    // Group skills by category
    const categoryOrder = ['Classroom', 'Social', 'Academic', 'Other'];
    const categoryIcons = { Classroom: 'layout', Social: 'users', Academic: 'book-open', Other: 'shapes' };
    const categoryColors = { Classroom: 'pink', Social: 'orange', Academic: 'blue', Other: 'slate-400' };
    const skillsByCategory = {};
    skills.forEach(sk => {
      const cat = sk.category || 'Other';
      if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
      skillsByCategory[cat].push(sk);
    });

    // Build student pills
    const studentPillsHTML = students.map(s => {
      const isActive = s.id === this.selectedStudentId;
      const hasScores = classData.studentSkills[s.id] && Object.values(classData.studentSkills[s.id]).some(v => v > 0);
      const snapCount = (snapshots[s.id] || []).length;
      return `
        <button onclick="SkillsManager.selectStudent('${s.id}')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200
          ${isActive 
            ? 'bg-blue text-white border-2 border-[var(--border-primary)] shadow-[2px_2px_0px_var(--border-primary)] scale-105' 
            : 'bg-[var(--bg-secondary)] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 hover:border-blue/40 hover:scale-[1.02]'}">
          ${hasScores ? '<span class="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0"></span>' : ''}
          <span class="truncate max-w-[80px]">${s.nick || s.name}</span>
          ${snapCount > 0 ? `<span class="text-[8px] px-1 rounded bg-white/20 text-white/80">${snapCount}</span>` : ''}
        </button>
      `;
    }).join('');

    // Build slider panel for selected student
    let sliderPanelHTML = '';
    const selectedStudent = students.find(s => s.id === this.selectedStudentId);
    
    if (selectedStudent) {
      const studentSkills = classData.studentSkills[selectedStudent.id] || {};
      const snapCount = (snapshots[selectedStudent.id] || []).length;

      // Calculate average
      let total = 0, count = 0;
      skills.forEach(sk => {
        const v = studentSkills[sk.id] || 0;
        total += v;
        count++;
      });
      const avg = count > 0 ? Math.round(total / count) : 0;

      // Build categorized sliders
      const categoryBlocks = categoryOrder.filter(cat => skillsByCategory[cat]).map(cat => {
        const catSkills = skillsByCategory[cat];
        const color = categoryColors[cat];
        const icon = categoryIcons[cat];
        
        const slidersHTML = catSkills.map(sk => {
          const val = studentSkills[sk.id] || 0;
          return `
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="font-heading font-semibold text-slate-700 dark:text-slate-200 text-[10px] flex items-center gap-1.5 uppercase tracking-tighter">
                  ${sk.name}
                </label>
                <span id="sk-val-${sk.id}" class="text-xs font-black text-${color} bg-${color}/10 px-1.5 rounded-md">${val}</span>
              </div>
              <input type="range" min="0" max="100" value="${val}"
                oninput="SkillsManager.onSliderChange('${selectedStudent.id}','${sk.id}', this.value)"
                class="kk-slider accent-${color}" />
            </div>
          `;
        }).join('');

        return `
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <i data-lucide="${icon}" class="w-3 h-3 text-${color}"></i> ${cat}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              ${slidersHTML}
            </div>
          </div>
        `;
      }).join('');

      sliderPanelHTML = `
        <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-5 space-y-5 animate-pop-in">
          <!-- Student Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-blue/10 border-2 border-blue/30 flex items-center justify-center">
                <i data-lucide="user" class="w-4 h-4 text-blue"></i>
              </div>
              <div>
                <h4 class="font-heading font-bold text-base text-slate-900 dark:text-white leading-tight">${selectedStudent.nick || selectedStudent.name}</h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Average</span>
                  <span id="sk-avg-val" class="text-xs font-black ${avg >= 70 ? 'text-green' : avg >= 50 ? 'text-orange' : 'text-pink'}">${avg}/100</span>
                </div>
              </div>
            </div>
            <button onclick="SkillsManager.openSnapshot('${selectedStudent.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green/10 text-green border-2 border-green/20 text-[10px] font-black uppercase hover:bg-green/20 transition-all hover:scale-105">
              <i data-lucide="camera" class="w-3.5 h-3.5"></i>
              Snapshot <span class="bg-green/20 px-1.5 rounded">${snapCount}</span>
            </button>
          </div>

          <!-- Categorized Sliders -->
          <div class="space-y-6">
            ${categoryBlocks}
          </div>
        </div>
      `;
    } else {
      sliderPanelHTML = `
        <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-8 text-center">
          <i data-lucide="user-x" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
          <p class="font-heading font-bold text-sm text-slate-400">No students in this class</p>
          <p class="text-xs text-slate-400 mt-1">Add students from the Students tab first.</p>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="space-y-4">
        <!-- Top Bar -->
        <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="target" class="w-4 h-4 text-pink"></i>
              <h4 class="font-heading font-bold text-sm uppercase tracking-tight text-slate-800 dark:text-white">Skills Matrix</h4>
              <span class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-pink/10 text-pink border border-pink/20">${skills.length} skills</span>
            </div>
          </div>
          <!-- Student Tabs -->
          <div class="flex flex-wrap gap-2">
            ${studentPillsHTML}
          </div>
        </div>

        <!-- Slider Panel -->
        ${sliderPanelHTML}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  selectStudent(id) {
    this.selectedStudentId = id;
    this.render();
  },

  onSliderChange(studentId, skillId, value) {
    const numVal = parseInt(value) || 0;
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.studentSkills) classData.studentSkills = {};
    if (!classData.studentSkills[studentId]) classData.studentSkills[studentId] = {};
    classData.studentSkills[studentId][skillId] = numVal;

    // Update label
    const valLabel = document.getElementById(`sk-val-${skillId}`);
    if (valLabel) valLabel.textContent = numVal;

    // Update Average dynamically
    let total = 0, count = 0;
    classData.skills.forEach(sk => {
      total += (classData.studentSkills[studentId][sk.id] || 0);
      count++;
    });
    const avg = count > 0 ? Math.round(total / count) : 0;
    const avgLabel = document.getElementById('sk-avg-val');
    if (avgLabel) {
      avgLabel.textContent = `${avg}/100`;
      avgLabel.className = `text-xs font-black ${avg >= 70 ? 'text-green' : avg >= 50 ? 'text-orange' : 'text-pink'}`;
    }

    // Sync back to puScores on the student object for Comment Helper compatibility
    const student = classData.students.find(s => s.id === studentId);
    if (student) {
      if (!student.puScores) student.puScores = {};
      const skill = classData.skills.find(s => s.id === skillId);
      if (skill) {
        // Reverse-map skill name to puScores key
        const REVERSE_MAP = {
          'Participation': 'participation', 'Listening': 'listening', 'Speaking': 'spoken',
          'Attendance': 'attendance', 'Social': 'social', 'Confidence': 'confidence',
          'Progress': 'progress', 'Grammar': 'grammar', 'Reading': 'reading',
          'Vocabulary': 'vocabulary', 'Writing': 'writing', 'Homework': 'homework',
          'Accuracy (Errors)': 'errors'
        };
        const puKey = REVERSE_MAP[skill.name];
        if (puKey) student.puScores[puKey] = numVal;
      }
    }

    ClassManager.saveData();
  },

  openAddSkill() {
    document.getElementById('skillNameInput').value = '';
    ModalManager.open('skillModal');
    setTimeout(() => document.getElementById('skillNameInput').focus(), 100);
  },

  saveSkill() {
    const name = document.getElementById('skillNameInput').value.trim();
    if (!name) return;

    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.skills) classData.skills = [];

    classData.skills.push({
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString()
    });

    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    UI.showToast('Skill added!', 'success');
  },

  async deleteSkill(skillId) {
    const confirmed = await showConfirmModal('Delete this skill? All student ratings and snapshot history will be lost.', {
      title: 'Delete Skill?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      icon: 'trash-2',
      iconColor: 'red'
    });
    if (!confirmed) return;
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.skills = classData.skills.filter(s => s.id !== skillId);
    if (classData.studentSkills) {
      Object.keys(classData.studentSkills).forEach(sid => {
        delete classData.studentSkills[sid][skillId];
      });
    }
    // Remove skill from all snapshots
    if (classData.skillSnapshots) {
      Object.values(classData.skillSnapshots).forEach(snapList => {
        snapList.forEach(snap => delete snap.ratings[skillId]);
      });
    }
    ClassManager.saveData();
    this.render();
    UI.showToast('Skill removed', 'info');
  },

  syncFromCommentHelper(studentId, fields, labels) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData) return;
    if (!classData.skills) classData.skills = [];
    if (!classData.studentSkills) classData.studentSkills = {};

    const CATEGORY_MAP = {
      participation: 'Classroom', listening: 'Classroom', spoken: 'Classroom', attendance: 'Classroom',
      social: 'Social', confidence: 'Social',
      progress: 'Academic', grammar: 'Academic', reading: 'Academic', vocabulary: 'Academic', writing: 'Academic', homework: 'Academic', errors: 'Academic'
    };

    for (const [key, value] of Object.entries(fields)) {
      const skillName = labels[key];
      const category = CATEGORY_MAP[key] || 'Other';
      let skill = classData.skills.find(s => s.name === skillName);
      
      // Create or update skill with category
      if (!skill) {
        skill = { id: crypto.randomUUID(), name: skillName, category, createdAt: new Date().toISOString() };
        classData.skills.push(skill);
      } else {
        skill.category = category; // Update category if missing
      }

      // Update student level
      if (!classData.studentSkills[studentId]) classData.studentSkills[studentId] = {};
      classData.studentSkills[studentId][skill.id] = parseInt(value) || 0;
    }
  },

  setLevel(studentId, skillId, level) {
    level = Math.max(0, Math.min(100, level));
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.studentSkills) classData.studentSkills = {};
    if (!classData.studentSkills[studentId]) classData.studentSkills[studentId] = {};
    classData.studentSkills[studentId][skillId] = level;
    ClassManager.saveData();
    this.render();
  },

  ensureCoreSkills(classData) {
    if (!classData) return;
    if (!classData.skills) classData.skills = [];

    const CORE_SKILLS = [
      { name: 'Participation', category: 'Classroom' },
      { name: 'Listening', category: 'Classroom' },
      { name: 'Speaking', category: 'Classroom' },
      { name: 'Attendance', category: 'Classroom' },
      { name: 'Social', category: 'Social' },
      { name: 'Confidence', category: 'Social' },
      { name: 'Progress', category: 'Academic' },
      { name: 'Grammar', category: 'Academic' },
      { name: 'Reading', category: 'Academic' },
      { name: 'Vocabulary', category: 'Academic' },
      { name: 'Writing', category: 'Academic' },
      { name: 'Homework', category: 'Academic' },
      { name: 'Accuracy (Errors)', category: 'Academic' }
    ];

    let changed = false;
    CORE_SKILLS.forEach(core => {
      const exists = classData.skills.find(s => s.name === core.name);
      if (!exists) {
        classData.skills.push({
          id: crypto.randomUUID(),
          name: core.name,
          category: core.category,
          createdAt: new Date().toISOString(),
          isCore: true
        });
        changed = true;
      }
    });

    if (changed) {
      ClassManager.saveData();
    }
  },

  adjustLevel(studentId, skillId, delta) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const current = classData.studentSkills?.[studentId]?.[skillId] || 0;
    this.setLevel(studentId, skillId, current + delta);
  },

  openSnapshot(studentId) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === studentId);
    if (!student) return;

    const ratings = classData.studentSkills?.[studentId] || {};
    const skills = classData.skills || [];

    document.getElementById('snapshotStudentId').value = studentId;
    document.getElementById('snapshotNotesInput').value = '';

    const preview = document.getElementById('snapshotPreviewSkills');
    if (skills.length === 0) {
      preview.innerHTML = '<span class="text-xs text-slate-400 italic">No skills defined</span>';
    } else {
      preview.innerHTML = skills.map(sk => {
        const val = ratings[sk.id] || 0;
        return `
          <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
            <span class="text-slate-500">${sk.name}</span>
            <span class="text-blue font-black">${val}</span>
          </div>
        `;
      }).join('');
    }

    ModalManager.open('snapshotModal');
    if (window.lucide) lucide.createIcons();
  },

  saveSnapshot() {
    const studentId = document.getElementById('snapshotStudentId').value;
    const notes = document.getElementById('snapshotNotesInput').value.trim();
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!studentId || !classData) return;

    if (!classData.skillSnapshots) classData.skillSnapshots = {};
    if (!classData.skillSnapshots[studentId]) classData.skillSnapshots[studentId] = [];

    const ratings = { ...(classData.studentSkills?.[studentId] || {}) };

    classData.skillSnapshots[studentId].push({
      date: new Date().toISOString(),
      ratings,
      notes
    });

    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    UI.showToast('Snapshot saved!', 'success');
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

// ── Comments Manager (Native PU Helper) ────────────────────────────────────
const CommentsManager = {
  currentStudentId: null,
  currentPronoun: 'they',
  hopefulPhrases: {},
  STORAGE_KEY: 'kk_comments_phrases',

  render() {
    if (!ClassManager.activeClass) return;
    const label = document.getElementById('pu-class-label');
    if (label) label.textContent = ClassManager.activeClass;
    this.renderRoster();
    // If a student is already selected, refresh form
    if (this.currentStudentId) {
      const s = this.getStudent(this.currentStudentId);
      if (s) this.loadStudent(this.currentStudentId);
      else this.clearForm();
    }
    if (window.lucide) lucide.createIcons();
  },

  getStudents() {
    const cd = ClassManager.data.classes[ClassManager.activeClass];
    return cd?.students || [];
  },

  getStudent(id) {
    return this.getStudents().find(s => s.id === id) || null;
  },

  renderRoster() {
    const list = document.getElementById('pu-roster-list');
    const search = (document.getElementById('pu-roster-search')?.value || '').toLowerCase();
    const students = this.getStudents();
    const filtered = students.filter(s => (s.name || '').toLowerCase().includes(search));
    document.getElementById('pu-roster-count').textContent = students.length;
    list.innerHTML = '';

    if (students.length === 0) {
      list.innerHTML = '<p class="text-slate-400 font-semibold text-sm italic">No students in this class yet.</p>';
      return;
    }
    if (filtered.length === 0 && search) {
      list.innerHTML = '<p class="text-slate-400 font-semibold text-sm italic">No students matching search.</p>';
      return;
    }

    filtered.forEach(s => {
      const hasScores = s.puScores && Object.values(s.puScores).some(v => v !== '' && v !== undefined && v !== null);
      const isActive = s.id === this.currentStudentId;
      const pill = document.createElement('button');
      pill.className = 'pu-student-pill border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-heading font-bold text-sm flex items-center gap-1';
      pill.style.background = isActive ? '#1ea7fd' : 'var(--bg-secondary)';
      pill.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      pill.innerHTML = `${hasScores ? '<span style="color:#00d063">✓</span> ' : ''}${s.nick || s.name}`;
      pill.onclick = () => this.loadStudent(s.id);
      list.appendChild(pill);
    });
  },

  setPronoun(p) {
    this.currentPronoun = p;
    this.renderPronounButtons();
    if (this.currentStudentId) {
      const s = this.getStudent(this.currentStudentId);
      if (s) { s.puPronoun = p; ClassManager.saveData(); }
    }
  },

  renderPronounButtons() {
    document.querySelectorAll('.pu-pronoun-btn').forEach(btn => {
      const p = btn.getAttribute('data-pronoun');
      const active = p === this.currentPronoun;
      btn.style.background = active ? '#1ea7fd' : 'var(--bg-secondary)';
      btn.style.color = active ? '#fff' : 'var(--text-secondary)';
    });
  },

  loadStudent(id) {
    this.currentStudentId = id;
    const s = this.getStudent(id);
    if (!s) return;

    document.getElementById('pu-score-card').classList.remove('hidden');
    document.getElementById('pu-form-title').textContent = `Scores for ${s.nick || s.name}`;

    const classData = ClassManager.data.classes[ClassManager.activeClass] || {};
    const studentSkills = classData.studentSkills?.[id] || {};
    const skillList = classData.skills || [];
    
    const fieldIds = ['participation','social','listening','confidence','spoken','attendance','errors','progress','grammar','reading','vocabulary','writing','homework'];
    const labels = { participation:'Participation', social:'Social', listening:'Listening', confidence:'Confidence', spoken:'Speaking', attendance:'Attendance', errors:'Accuracy (Errors)',
                     progress:'Progress', grammar:'Grammar', reading:'Reading', vocabulary:'Vocabulary', writing:'Writing', homework:'Homework' };

    fieldIds.forEach(key => {
      // Find skill in global list to get its ID
      const skillName = labels[key];
      const skill = skillList.find(sk => sk.name === skillName);
      
      // Prioritize value from studentSkills, fallback to puScores
      let val = 0;
      if (skill && studentSkills[skill.id] !== undefined) {
        val = studentSkills[skill.id];
      } else {
        const sc = s.puScores || {};
        val = sc[key] ?? 0;
      }

      const el = document.getElementById(`pu-${key}`);
      if (el) {
        el.value = val;
        const valLabel = document.getElementById(`pu-${key}-val`);
        if (valLabel) valLabel.textContent = val;
      }
    });

    this.currentPronoun = s.puPronoun || 'they';
    this.renderPronounButtons();
    this.renderRoster();
    this.hideError();

    if (s.puComments) {
      this.renderComments(s.nick || s.name, s.puComments);
    } else {
      document.getElementById('pu-output-section').classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
  },

  updateScore(key, value) {
    if (!this.currentStudentId) return;
    const s = this.getStudent(this.currentStudentId);
    if (!s) return;

    // 1. Update student puScores (for backward compatibility/individual tool use)
    if (!s.puScores) s.puScores = {};
    const numVal = parseInt(value) || 0;
    s.puScores[key] = numVal;

    // 2. Update Skills Matrix state immediately (Seamless Integration)
    const labels = { participation:'Participation', social:'Social', listening:'Listening',
                     confidence:'Confidence', spoken:'Speaking', attendance:'Attendance', errors:'Accuracy (Errors)',
                     progress:'Progress', grammar:'Grammar', reading:'Reading', vocabulary:'Vocabulary', writing:'Writing', homework:'Homework' };
    
    const fieldObj = {};
    fieldObj[key] = numVal;
    SkillsManager.syncFromCommentHelper(this.currentStudentId, fieldObj, labels);

    // 3. Update visual label
    const valLabel = document.getElementById(`pu-${key}-val`);
    if (valLabel) valLabel.textContent = numVal;

    // 4. Save persistence
    ClassManager.saveData();
  },

  saveAndGenerate() {
    if (!this.currentStudentId) { this.showError('Please select a student first.'); return; }
    const s = this.getStudent(this.currentStudentId);
    if (!s) return;

    const fields = {};
    const enabledSkills = {};
    const fieldIds = ['participation','social','listening','confidence','spoken','attendance','errors','progress','grammar','reading','vocabulary','writing','homework'];
    fieldIds.forEach(id => {
      fields[id] = document.getElementById(`pu-${id}`).value;
      const toggle = document.getElementById(`pu-toggle-${id}`);
      enabledSkills[id] = toggle ? toggle.checked : true;
    });

    const labels = { participation:'Participation', social:'Social', listening:'Listening',
                     confidence:'Confidence', spoken:'Speaking', attendance:'Attendance', errors:'Accuracy (Errors)',
                     progress:'Progress', grammar:'Grammar', reading:'Reading', vocabulary:'Vocabulary', writing:'Writing', homework:'Homework' };

    for (const [k, v] of Object.entries(fields)) {
      if (enabledSkills[k]) {
        if (v === '' || isNaN(+v)) { this.showError(`Please enter a score for "${labels[k]}".`); return; }
        if (+v < 0 || +v > 100) { this.showError(`"${labels[k]}" must be between 0 and 100.`); return; }
      }
    }
    this.hideError();

    s.puScores = fields;
    s.puPronoun = this.currentPronoun;
    s.puComments = this.buildComments(s.nick || s.name, fields, this.currentPronoun, enabledSkills);
    ClassManager.saveData();
    this.renderRoster();
    this.renderComments(s.nick || s.name, s.puComments);
  },

  clearForm() {
    this.currentStudentId = null;
    document.getElementById('pu-score-card').classList.add('hidden');
    document.getElementById('pu-output-section').classList.add('hidden');
    ['participation','social','listening','confidence','spoken','attendance','errors',
     'progress','grammar','reading','vocabulary','writing','homework']
      .forEach(id => { 
        const el = document.getElementById(`pu-${id}`);
        if (el) {
          el.value = 0;
          const valLabel = document.getElementById(`pu-${id}-val`);
          if (valLabel) valLabel.textContent = 0;
        }
      });
    this.currentPronoun = 'they';
    this.renderPronounButtons();
    this.renderRoster();
    this.hideError();
  },

  buildComments(name, sc, pronoun, enabledSkills) {
    pronoun = pronoun || 'they';
    enabledSkills = enabledSkills || {};
    const labels = { participation:'Participation', social:'Social', listening:'Listening', confidence:'Confidence', spoken:'Speaking', attendance:'Attendance', errors:'Accuracy',
                     progress:'Progress', grammar:'Grammar', reading:'Reading', vocabulary:'Vocabulary', writing:'Writing', homework:'Homework' };
    const comments = [];
    for (const [k, v] of Object.entries(sc)) {
      if (!enabledSkills[k]) continue;
      const raw = this.pick(this.hopefulPhrases[k]?.[this.level(v)]);
      const withPronoun = this.applyPronoun(raw, pronoun);
      const personal = this.personalise(withPronoun, name, pronoun);
      comments.push({ skill: labels[k], text: personal });
    }
    return comments;
  },

  level(v) {
    v = +v;
    if (v >= 90) return 'excellent';
    if (v >= 70) return 'good';
    if (v >= 50) return 'developing';
    return 'needs_work';
  },

  pick(arr) {
    if (!arr || arr.length === 0) return '...';
    return arr[Math.floor(Math.random() * arr.length)];
  },

  applyPronoun(text, pronoun) {
    if (pronoun === 'they') return text;
    const m = { he:{subject:'He',object:'him',poss:'his',refl:'himself',are:'is',were:'was'}, she:{subject:'She',object:'her',poss:'her',refl:'herself',are:'is',were:'was'}, they:{subject:'They',object:'them',poss:'their',refl:'themselves',are:'are',were:'were'} }[pronoun];
    text = text.replace(/\bthemselves\b/g, m.refl).replace(/\bThemselves\b/g, m.refl.charAt(0).toUpperCase()+m.refl.slice(1));
    text = text.replace(/\bTheir\b/g, m.poss.charAt(0).toUpperCase()+m.poss.slice(1)).replace(/\btheir\b/g, m.poss);
    text = text.replace(/\bthem\b/g, m.object).replace(/\bThem\b/g, m.object.charAt(0).toUpperCase()+m.object.slice(1));
    text = text.replace(/\bThey are\b/g, m.subject+' '+m.are).replace(/\bthey are\b/g, m.subject.toLowerCase()+' '+m.are);
    text = text.replace(/\bThey were\b/g, m.subject+' '+m.were).replace(/\bthey were\b/g, m.subject.toLowerCase()+' '+m.were);
    text = text.replace(/\bThey have\b/g, m.subject+' has').replace(/\bthey have\b/g, m.subject.toLowerCase()+' has');
    text = text.replace(/\bThey (\w+)/g, (_,verb) => m.subject+' '+this.conjugate3rd(verb));
    text = text.replace(/\bthey (\w+)/g, (_,verb) => m.subject.toLowerCase()+' '+this.conjugate3rd(verb));
    return text;
  },

  conjugate3rd(verb) {
    const low = verb.toLowerCase();
    if (['can','will','would','could','should','may','might','must','shall'].includes(low)) return verb;
    if (low==='are') return 'is'; if (low==='have') return 'has'; if (low==='do') return 'does'; if (low==='go') return 'goes';
    if (/(?:s|sh|ch|x|z)$/.test(low)) return verb+'es';
    if (/[^aeiou]y$/.test(low)) return verb.slice(0,-1)+'ies';
    return verb+'s';
  },

  personalise(text, name, pronoun) {
    // Randomly decide whether to use the name or keep the pronoun (approx 50/50)
    if (Math.random() > 0.5) return text;

    // Replace the first subject pronoun with the student's name
    if (pronoun === 'he') return text.replace(/\bHe\b/, name).replace(/\bhe\b/, name);
    if (pronoun === 'she') return text.replace(/\bShe\b/, name).replace(/\bshe\b/, name);
    // For 'they' pronoun: need to conjugate the verb that follows
    return text.replace(/\bThey (\w+)/, (_, verb) => name + ' ' + this.conjugate3rd(verb))
               .replace(/\bthey (\w+)/, (_, verb) => name.toLowerCase() + ' ' + this.conjugate3rd(verb));
  },

  renderComments(name, comments) {
    document.getElementById('pu-output-name').textContent = `Comments for ${name}`;
    const container = document.getElementById('pu-comment-cards');
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
      container.innerHTML = '<p class="text-slate-500 italic p-4 text-center text-sm font-bold">No skills selected for generation.</p>';
    } else if (typeof comments[0] === 'string') {
      // Backward compatibility for old single string comments
      comments.forEach((text, i) => {
        const card = document.createElement('div');
        card.className = 'pu-comment-card glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-5';
        card.style.animationDelay = (i * 0.08) + 's';
        card.innerHTML = `<p class="text-slate-700 dark:text-slate-200 font-semibold leading-relaxed whitespace-pre-wrap">${text.replace(/\n/g, '<br>')}</p>`;
        container.appendChild(card);
      });
    } else {
      // New format: Array of skill objects
      comments.forEach((c, i) => {
        const card = document.createElement('div');
        card.className = 'pu-comment-card glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-4 relative';
        card.style.animationDelay = (i * 0.08) + 's';
        card.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.skill}</h5>
            <button onclick="CommentsManager.copySkillComment(this)" class="btn-chunky bg-white border-2 border-[var(--border-primary)] rounded-lg px-2 py-1 text-xs font-bold text-slate-700 shadow-[2px_2px_0px_var(--border-primary)] flex items-center gap-1 hover:text-blue hover:border-blue">
              <i data-lucide="copy" class="w-3 h-3"></i> Copy
            </button>
          </div>
          <textarea class="w-full bg-transparent border-none p-0 text-slate-700 dark:text-slate-200 font-semibold text-sm leading-relaxed resize-none focus:ring-0" rows="2" readonly>${c.text}</textarea>
        `;
        container.appendChild(card);
      });
    }
    
    document.getElementById('pu-output-section').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  copySkillComment(btn) {
    const textarea = btn.closest('.pu-comment-card').querySelector('textarea');
    if (textarea) {
      navigator.clipboard.writeText(textarea.value).then(() => UI.showToast('Skill comment copied!', 'success'));
    }
  },

  copyAll() {
    const s = this.getStudent(this.currentStudentId);
    if (!s || !s.puComments) return;
    
    let fullText = '';
    if (typeof s.puComments[0] === 'string') {
      fullText = s.puComments.join('\n\n');
    } else {
      fullText = `Here is ${s.nick || s.name}'s progress across selected skills:\n\n`;
      s.puComments.forEach(c => {
        fullText += `• ${c.skill}:\n  ${c.text}\n\n`;
      });
      fullText += `Keep up the great work, ${s.nick || s.name}!`;
    }
    
    navigator.clipboard.writeText(fullText.trim()).then(() => UI.showToast('Full comment copied!', 'success'));
  },

  showError(msg) {
    const box = document.getElementById('pu-error-box');
    box.textContent = '⚠ ' + msg;
    box.classList.remove('hidden');
  },

  hideError() {
    document.getElementById('pu-error-box').classList.add('hidden');
  },

  openArchiveModal() {
    const modal = document.getElementById('pu-archive-modal');
    const content = document.getElementById('pu-archive-content');
    content.innerHTML = '';
    modal.classList.remove('hidden');
    this.renderArchive();
  },

  closeArchiveModal() {
    document.getElementById('pu-archive-modal').classList.add('hidden');
  },

  renderArchive() {
    const content = document.getElementById('pu-archive-content');
    const students = this.getStudents().filter(s => s.puComments && s.puComments.length);
    if (!students.length) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i data-lucide="message-square-text" class="w-8 h-8 text-slate-400"></i>
          </div>
          <p class="text-slate-500 font-bold text-sm">No saved comments yet.</p>
          <p class="text-slate-400 text-xs mt-1">Generate comments for students and they will appear here.</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-4';
    students.forEach(s => {
      const card = document.createElement('div');
      card.className = 'glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-5';
      const hasScores = s.puScores && Object.values(s.puScores).some(v => v !== '' && v !== undefined && v !== null);
      const scoreTags = hasScores && s.puScores ? Object.entries(s.puScores).map(([k, v]) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">${k.charAt(0).toUpperCase()+k.slice(1)}: ${v}</span>`).join('') : '';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center font-heading font-bold text-sm">${(s.nick || s.name || '?').charAt(0).toUpperCase()}</div>
            <div>
              <p class="font-heading font-bold text-base text-slate-900 dark:text-white">${s.nick || s.name}</p>
              <p class="text-[10px] font-bold text-slate-400 capitalize">${s.puPronoun || 'they'}</p>
            </div>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button onclick="CommentsManager.copyStudentComment('${s.id}')" class="btn-chunky bg-green text-[var(--text-primary)] border-[var(--border-width-medium)] border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-neo-sm flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3"></i> Copy
            </button>
            <button onclick="CommentsManager.loadStudent('${s.id}'); CommentsManager.closeArchiveModal()" class="btn-chunky bg-blue text-white border-[var(--border-width-medium)] border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-neo-sm flex items-center gap-1">
              <i data-lucide="edit" class="w-3 h-3"></i> Edit
            </button>
            <button onclick="CommentsManager.deleteStudentComment('${s.id}')" class="btn-chunky bg-red-100 dark:bg-red-900/30 border-[var(--border-width-medium)] border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-red-700 dark:text-red-400 shadow-neo-sm flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
        ${scoreTags ? `<div class="flex flex-wrap gap-1.5 mb-3">${scoreTags}</div>` : ''}
        <div class="bg-[var(--bg-secondary)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">${(s.puComments[0] || '').replace(/\n/g, '<br>')}</div>
      `;
      grid.appendChild(card);
    });
    content.appendChild(grid);
    if (window.lucide) lucide.createIcons();
  },

  copyStudentComment(id) {
    const s = this.getStudent(id);
    if (!s || !s.puComments) return;
    navigator.clipboard.writeText(s.puComments[0]).then(() => UI.showToast('Copied!', 'success'));
  },

  async deleteStudentComment(id) {
    const confirmed = await showConfirmModal('Delete this saved comment?', {
      title: 'Delete Comment?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      icon: 'message-square-x',
      iconColor: 'red'
    });
    if (!confirmed) return;
    const s = this.getStudent(id);
    if (!s) return;
    s.puComments = null;
    s.puScores = null;
    s.puPronoun = null;
    if (this.currentStudentId === id) this.clearForm();
    ClassManager.saveData();
    this.renderArchive();
    this.renderRoster();
    UI.showToast('Comment deleted', 'info');
  },

  copyAllClassComments() {
    const students = this.getStudents().filter(s => s.puComments && s.puComments.length);
    if (!students.length) return UI.showToast('No comments to copy', 'warning');
    const text = students.map(s => `--- ${s.nick || s.name} ---\n${s.puComments[0]}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => UI.showToast('All comments copied!', 'success'));
  },

  exportClassComments() {
    const students = this.getStudents().filter(s => s.puComments && s.puComments.length);
    if (!students.length) return UI.showToast('No comments to export', 'warning');
    const data = students.map(s => ({
      name: s.nick || s.name,
      pronoun: s.puPronoun || 'they',
      scores: s.puScores || {},
      comment: s.puComments[0] || '',
      timestamp: new Date().toISOString()
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KlassKit_Comments_${ClassManager.activeClass || 'class'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Exported successfully!', 'success');
  },

  async loadComments() {
    try {
      const resp = await fetch('../../workshop/pu-helper/comments.json');
      if (!resp.ok) throw new Error('Network response was not ok');
      this.hopefulPhrases = await resp.json();
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  }
};

// ── Report Manager (Native Report Helper) ─────────────────────────────────
const ReportManager = {
  commentBank: [],
  state: {},
  activeAccordion: null,

  STORAGE_KEY: 'kk_reportgen_state',
  pronouns: {
    she: { subject:'she', object:'her', possessive:'her', reflexive:'herself', CapSubject:'She', CapPossessive:'Her' },
    he:  { subject:'he',  object:'him', possessive:'his', reflexive:'himself', CapSubject:'He',  CapPossessive:'His' },
    they:{ subject:'they',object:'them',possessive:'their',reflexive:'themselves',CapSubject:'They',CapPossessive:'Their' }
  },
  themeColorMap: { 'kk-pink':'bg-pink','kk-orange':'bg-orange','kk-amber':'bg-amber','kk-blue':'bg-blue','kk-purple':'bg-purple','kk-green':'bg-green' },
  tagColorMap: {
    'Confidence':'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300','Attitude':'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300','Progress':'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    'Engagement':'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300','Character':'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    'Teamwork':'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300','Participation':'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300','Respect':'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    'Communication':'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300','Leadership':'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    'Motivation':'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300','Perseverance':'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300','Initiative':'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'Focus':'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300','Resilience':'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    'Grammar':'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300','Vocabulary':'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300','Speaking':'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    'Listening':'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300','Reading':'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300','Writing':'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    'Phonics':'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'Encouragement':'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300','Celebration':'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'Gratitude':'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300','Growth':'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    'Default':'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  },

  currentStudentId: null,

  getStudents() {
    const cd = ClassManager.data.classes[ClassManager.activeClass];
    return cd?.students || [];
  },

  getStudent(id) {
    return this.getStudents().find(s => s.id === id) || null;
  },

  render() {
    if (!ClassManager.activeClass) return;
    const label = document.getElementById('report-class-label');
    if (label) label.textContent = ClassManager.activeClass;
    this.renderRoster();
    if (!this.commentBank.length) this.fetchComments();
    else if (this.currentStudentId) {
      const s = this.getStudent(this.currentStudentId);
      if (s) { this.loadStudentState(s); this.renderStepper(); this.renderAccordions(); this.compileReport(); }
      else { this.currentStudentId = null; document.getElementById('report-editor').classList.add('hidden'); }
    }
    if (window.lucide) lucide.createIcons();
  },

  renderRoster() {
    const list = document.getElementById('report-roster-list');
    const search = (document.getElementById('report-roster-search')?.value || '').toLowerCase();
    const students = this.getStudents();
    const filtered = students.filter(s => (s.name || '').toLowerCase().includes(search));
    document.getElementById('report-roster-count').textContent = students.length;
    list.innerHTML = '';
    if (students.length === 0) {
      list.innerHTML = '<p class="text-slate-400 font-semibold text-sm italic">No students in this class yet.</p>';
      return;
    }
    if (filtered.length === 0 && search) {
      list.innerHTML = '<p class="text-slate-400 font-semibold text-sm italic">No students matching search.</p>';
      return;
    }
    filtered.forEach(s => {
      const hasReport = s.reportState && Object.values(s.reportState).some(st => st.selectionIndex !== null);
      const isActive = s.id === this.currentStudentId;
      const pill = document.createElement('button');
      pill.className = 'pu-student-pill border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-heading font-bold text-sm flex items-center gap-1';
      pill.style.background = isActive ? '#1ea7fd' : 'var(--bg-secondary)';
      pill.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      pill.innerHTML = `${hasReport ? '<span style="color:#00d063">✓</span> ' : ''}${s.nick || s.name}`;
      pill.onclick = () => this.selectStudent(s.id);
      list.appendChild(pill);
    });
  },

  selectStudent(id) {
    this.currentStudentId = id;
    const s = this.getStudent(id);
    if (!s) return;
    document.getElementById('report-editor').classList.remove('hidden');
    document.getElementById('report-student-display').textContent = s.nick || s.name;
    document.getElementById('report-student-name').value = s.nick || s.name;
    const pronoun = s.puPronoun || s.reportPronoun || 'they';
    document.getElementById('report-pronoun').value = pronoun;
    this.loadStudentState(s);
    if (!this.activeAccordion && this.commentBank.length) this.activeAccordion = this.commentBank[0].id;
    this.renderRoster();
    this.renderStepper();
    this.renderAccordions();
    this.compileReport();
    if (window.lucide) lucide.createIcons();
  },

  loadStudentState(s) {
    if (s.reportState) {
      this.state = JSON.parse(JSON.stringify(s.reportState));
    } else {
      this.initEmptyState();
    }
  },

  initEmptyState() {
    this.state = {};
    this.commentBank.forEach(cat => {
      this.state[cat.id] = { level: 'good', selectionIndex: null, activeTag: 'All' };
    });
    if (this.commentBank.length) this.activeAccordion = this.commentBank[0].id;
  },

  onPronounChange() {
    const s = this.getStudent(this.currentStudentId);
    if (s) { s.reportPronoun = document.getElementById('report-pronoun').value; ClassManager.saveData(); }
    this.compileReport();
  },

  saveStudentReport() {
    const s = this.getStudent(this.currentStudentId);
    if (!s) return;
    s.reportState = JSON.parse(JSON.stringify(this.state));
    s.reportPronoun = document.getElementById('report-pronoun').value;
    s.reportText = document.getElementById('report-output').value;
    ClassManager.saveData();
    this.renderRoster();
    UI.showToast('Report saved!', 'success');
  },


  saveState() {
    if (!this.currentStudentId) return;
    const s = this.getStudent(this.currentStudentId);
    if (!s) return;
    s.reportState = JSON.parse(JSON.stringify(this.state));
    s.reportPronoun = document.getElementById('report-pronoun').value;
    s.reportText = document.getElementById('report-output').value;
    ClassManager.saveData();
  },

  openArchiveModal() {
    const modal = document.getElementById('report-archive-modal');
    const content = document.getElementById('report-archive-content');
    content.innerHTML = '';
    modal.classList.remove('hidden');
    this.renderArchive();
  },

  closeArchiveModal() {
    document.getElementById('report-archive-modal').classList.add('hidden');
  },

  renderArchive() {
    const content = document.getElementById('report-archive-content');
    const students = this.getStudents().filter(s => s.reportState && Object.values(s.reportState).some(st => st.selectionIndex !== null));
    if (!students.length) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i data-lucide="file-text" class="w-8 h-8 text-slate-400"></i>
          </div>
          <p class="text-slate-500 font-bold text-sm">No saved reports yet.</p>
          <p class="text-slate-400 text-xs mt-1">Build reports for students and they will appear here.</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }
    const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 gap-4';
    students.forEach(s => {
      const completedCount = Object.values(s.reportState).filter(st => st.selectionIndex !== null).length;
      const total = this.commentBank.length;
      const card = document.createElement('div');
      card.className = 'glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] p-5';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-heading font-bold text-sm">${(s.nick || s.name || '?').charAt(0).toUpperCase()}</div>
            <div>
              <p class="font-heading font-bold text-base text-slate-900 dark:text-white">${s.nick || s.name}</p>
              <p class="text-[10px] font-bold text-slate-400 capitalize">${s.reportPronoun || s.puPronoun || 'they'} • ${completedCount}/${total} sections</p>
            </div>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button onclick="ReportManager.copyStudentReport('${s.id}')" class="btn-chunky bg-green text-[var(--text-primary)] border-[var(--border-width-medium)] border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-neo-sm flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3"></i> Copy
            </button>
            <button onclick="ReportManager.selectStudent('${s.id}'); ReportManager.closeArchiveModal()" class="btn-chunky bg-blue text-white border-[var(--border-width-medium)] border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-neo-sm flex items-center gap-1">
              <i data-lucide="edit" class="w-3 h-3"></i> Edit
            </button>
            <button onclick="ReportManager.deleteStudentReport('${s.id}')" class="btn-chunky bg-red-100 dark:bg-red-900/30 border-[var(--border-width-medium)] border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-red-700 dark:text-red-400 shadow-neo-sm flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
        <div class="bg-[var(--bg-secondary)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">${(s.reportText || '').replace(/\n/g, '<br>') || '<span class="text-slate-400 italic">No compiled text yet.</span>'}</div>
      `;
      grid.appendChild(card);
    });
    content.appendChild(grid);
    if (window.lucide) lucide.createIcons();
  },

  copyStudentReport(id) {
    const s = this.getStudent(id);
    if (!s || !s.reportText) return;
    navigator.clipboard.writeText(s.reportText).then(() => UI.showToast('Copied!', 'success'));
  },

  async deleteStudentReport(id) {
    const confirmed = await showConfirmModal('Delete this saved report?', {
      title: 'Delete Report?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      icon: 'file-x',
      iconColor: 'red'
    });
    if (!confirmed) return;
    const s = this.getStudent(id);
    if (!s) return;
    s.reportState = null; s.reportPronoun = null; s.reportText = null;
    if (this.currentStudentId === id) this.clearAll();
    ClassManager.saveData();
    this.renderArchive();
    this.renderRoster();
    UI.showToast('Report deleted', 'info');
  },

  copyAllClassReports() {
    const students = this.getStudents().filter(s => s.reportState && Object.values(s.reportState).some(st => st.selectionIndex !== null));
    if (!students.length) return UI.showToast('No reports to copy', 'warning');
    const text = students.map(s => `--- ${s.nick || s.name} ---\n${s.reportText || '(incomplete)'}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => UI.showToast('All reports copied!', 'success'));
  },

  exportClassReports() {
    const students = this.getStudents().filter(s => s.reportState && Object.values(s.reportState).some(st => st.selectionIndex !== null));
    if (!students.length) return UI.showToast('No reports to export', 'warning');
    const data = students.map(s => ({
      name: s.nick || s.name, pronoun: s.reportPronoun || s.puPronoun || 'they',
      state: s.reportState, text: s.reportText || '', timestamp: new Date().toISOString()
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `KlassKit_Reports_${ClassManager.activeClass || 'class'}.json`; a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Exported successfully!', 'success');
  },


  loadState() {
    try { const raw = localStorage.getItem(this.STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },

  onInputChange() { this.compileReport(); this.saveState(); },

  onPronounChange() { this.compileReport(); this.saveState(); },

  async fetchComments() {
    try {
      const response = await fetch('../../workshop/report-helper/comments.json');
      if (!response.ok) throw new Error('Network error');
      this.commentBank = await response.json();
      this.initEmptyState();
      document.getElementById('report-loading').style.display = 'none';
      if (this.currentStudentId) {
        const s = this.getStudent(this.currentStudentId);
        if (s) this.loadStudentState(s);
      }
      this.renderStepper(); this.renderAccordions(); this.compileReport();
    } catch (error) {
      document.getElementById('report-loading').innerHTML = '<div class="text-red-500">Failed to load comments.json</div>';
    }
  },

  parseText(text, nameStr, pronounObj) {
    if (!text) return '';
    return text.replace(/\[Name\]/g, nameStr).replace(/\[CapSubject\]/g, pronounObj.CapSubject)
      .replace(/\[subject\]/g, pronounObj.subject).replace(/\[CapPossessive\]/g, pronounObj.CapPossessive)
      .replace(/\[possessive\]/g, pronounObj.possessive).replace(/\[object\]/g, pronounObj.object)
      .replace(/\[reflexive\]/g, pronounObj.reflexive);
  },

  getTagColor(tag) { return this.tagColorMap[tag] || this.tagColorMap['Default']; },

  extractTags(category, level) {
    const items = category.levels[level]; const tags = new Set();
    items.forEach(item => { if (typeof item === 'string' && item.includes(' | ')) tags.add(item.split(' | ')[0].trim()); });
    return Array.from(tags);
  },

  renderStepper() {
    const container = document.getElementById('report-stepper'); container.innerHTML = '';
    this.commentBank.forEach((cat, idx) => {
      const catState = this.state[cat.id]; const isCompleted = catState && catState.selectionIndex !== null;
      const isActive = this.activeAccordion === cat.id;
      const colorClass = this.themeColorMap[cat.theme] || 'bg-blue';
      const dotWrap = document.createElement('div'); dotWrap.className = 'flex flex-col items-center gap-1 cursor-pointer group relative'; dotWrap.style.zIndex = '2';
      dotWrap.onclick = () => { this.activeAccordion = cat.id; this.renderStepper(); this.renderAccordions(); this.saveState(); };
      const dot = document.createElement('div');
      const base = 'report-stepper-dot w-9 h-9 rounded-full border-2 flex items-center justify-center font-heading font-bold text-sm transition-all';
      if (isCompleted) { dot.className = `${base} completed border-slate-600`; dot.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>'; }
      else if (isActive) { dot.className = `${base} active ${colorClass} text-white border-slate-600`; dot.innerText = idx + 1; }
      else { dot.className = `${base} bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600 group-hover:border-blue`; dot.innerText = idx + 1; }
      dotWrap.appendChild(dot);
      const label = document.createElement('span');
      const shortTitle = cat.title.replace(/^\d+\.\s*/,'').split(' ')[0];
      label.className = `text-[10px] font-bold uppercase tracking-wider max-w-[70px] text-center leading-tight ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`;
      label.innerText = shortTitle; dotWrap.appendChild(label); container.appendChild(dotWrap);
      if (idx < this.commentBank.length - 1) {
        const line = document.createElement('div');
        line.className = `report-stepper-line flex-1 h-[3px] rounded-full -mt-4 ${isCompleted ? 'bg-green' : 'bg-slate-200 dark:bg-slate-700'}`;
        container.appendChild(line);
      }
    });
    if (window.lucide) lucide.createIcons({ root: container });
  },

  renderAccordions() {
    const container = document.getElementById('report-options-container');
    // Keep loading msg if still there, otherwise clear
    const loading = document.getElementById('report-loading');
    if (loading) loading.style.display = 'none';
    // Clear all except loading
    Array.from(container.children).forEach(c => { if (c.id !== 'report-loading') c.remove(); });

    this.commentBank.forEach((category, idx) => {
      if (this.activeAccordion !== category.id) return;
      const catState = this.state[category.id];
      const colorClass = this.themeColorMap[category.theme] || 'bg-blue';
      const section = document.createElement('div');
      section.className = `bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-5 shadow-neo border-t-4 border-t-${colorClass.replace('bg-','')} overflow-hidden`;
      const header = document.createElement('div');
      header.className = 'w-full px-5 py-4 flex justify-between items-center text-left bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700';
      const tw = document.createElement('div'); tw.className = 'flex items-center gap-3';
      const nb = document.createElement('div'); nb.className = 'w-8 h-8 rounded-full flex items-center justify-center font-heading font-bold text-sm bg-slate-800 text-white border-2 border-transparent shadow-neo-sm';
      nb.innerText = idx + 1; tw.appendChild(nb);
      const tt = document.createElement('h3'); tt.className = 'font-heading font-bold text-xl text-slate-900 dark:text-white tracking-tight';
      tt.innerText = category.title.replace(/^\d+\.\s*/,''); tw.appendChild(tt);
      header.appendChild(tw); section.appendChild(header);

      const body = document.createElement('div'); body.className = 'p-5 flex flex-col gap-4';
      const levelNav = document.createElement('div'); levelNav.className = 'flex gap-2 bg-[var(--bg-secondary)] dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600 w-fit';
      [{key:'support',label:'Needs Support'},{key:'good',label:'Developing/Good'},{key:'excellent',label:'Excellent'}].forEach(lvl => {
        const btn = document.createElement('button');
        btn.className = `report-level-tab px-4 py-1.5 rounded-lg text-sm font-bold font-heading border-2 border-transparent text-slate-500 dark:text-slate-400 ${catState.level===lvl.key?'active':''}`;
        btn.innerText = lvl.label;
        btn.onclick = (e) => { e.stopPropagation(); this.state[category.id].level=lvl.key; this.state[category.id].selectionIndex=null; this.state[category.id].activeTag='All'; this.renderStepper(); this.renderAccordions(); this.compileReport(); this.saveState(); };
        levelNav.appendChild(btn);
      });
      body.appendChild(levelNav);

      const tags = this.extractTags(category, catState.level);
      if (tags.length > 0) {
        const chipRow = document.createElement('div'); chipRow.className = 'flex flex-wrap gap-2';
        const allChip = document.createElement('button');
        const isAll = catState.activeTag === 'All';
        allChip.className = `report-tag-chip px-3 py-1 rounded-lg text-xs font-bold border-2 ${isAll?'active-chip bg-slate-800 dark:bg-slate-500 text-white border-transparent':'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`;
        allChip.innerText = `All (${category.levels[catState.level].length})`;
        allChip.onclick = (e) => { e.stopPropagation(); this.state[category.id].activeTag='All'; this.renderAccordions(); this.saveState(); };
        chipRow.appendChild(allChip);
        tags.forEach(tag => {
          const chip = document.createElement('button'); const isTagActive = catState.activeTag === tag;
          const count = category.levels[catState.level].filter(i => typeof i==='string' && i.startsWith(tag+' | ')).length;
          const bgColor = this.getTagColor(tag);
          chip.className = `report-tag-chip px-3 py-1 rounded-lg text-xs font-bold border-2 ${isTagActive?`active-chip ${bgColor}`:'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`;
          chip.innerText = `${tag} (${count})`;
          chip.onclick = (e) => { e.stopPropagation(); this.state[category.id].activeTag=tag; this.renderAccordions(); this.saveState(); };
          chipRow.appendChild(chip);
        });
        body.appendChild(chipRow);
      }

      const optionsGrid = document.createElement('div'); optionsGrid.className = 'flex flex-col gap-3';
      const optionsArray = category.levels[catState.level];
      optionsArray.forEach((optItem, index) => {
        let tag = null, rawText = optItem;
        if (typeof optItem === 'string' && optItem.includes(' | ')) { const parts = optItem.split(' | '); tag = parts[0].trim(); rawText = parts[1].trim(); }
        if (catState.activeTag !== 'All' && tag !== catState.activeTag) return;
        const btn = document.createElement('button');
        const isSelected = catState.selectionIndex === index;
        btn.className = `report-option-card text-left p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-[var(--bg-secondary)] dark:bg-slate-900 font-semibold text-sm cursor-pointer leading-relaxed flex flex-col gap-2 ${isSelected?'selected':'text-slate-600 dark:text-slate-300'}`;
        if (tag) {
          const badgeColor = isSelected ? 'bg-white/20 text-white border-white/30' : `${this.getTagColor(tag)} border-transparent`;
          btn.innerHTML = `<span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border-2 ${badgeColor}">${tag}</span>`;
        }
        const textSpan = document.createElement('span'); textSpan.innerText = this.parseText(rawText, 'Student', this.pronouns.he); btn.appendChild(textSpan);
        btn.onclick = (e) => { e.stopPropagation(); this.state[category.id].selectionIndex = index; if (idx < this.commentBank.length - 1) this.activeAccordion = this.commentBank[idx+1].id; else this.activeAccordion = null; this.renderStepper(); this.renderAccordions(); this.compileReport(); this.saveState(); };
        optionsGrid.appendChild(btn);
      });
      body.appendChild(optionsGrid); section.appendChild(body); container.appendChild(section);
    });
    if (window.lucide) lucide.createIcons({ root: container });
  },

  compileReport() {
    const s = this.getStudent(this.currentStudentId);
    const nameInput = s ? (s.nick || s.name) : '[Name]';
    const pData = this.pronouns[document.getElementById('report-pronoun')?.value || s?.reportPronoun || s?.puPronoun || 'they'];
    let parts = [];
    this.commentBank.forEach(cat => {
      const catState = this.state[cat.id];
      if (catState && catState.selectionIndex !== null) {
        let rawItem = cat.levels[catState.level][catState.selectionIndex];
        if (typeof rawItem === 'string' && rawItem.includes(' | ')) rawItem = rawItem.split(' | ')[1].trim();
        parts.push(this.parseText(rawItem, nameInput, pData));
      }
    });
    const finalText = parts.join(' ');
    const outputArea = document.getElementById('report-output');
    outputArea.value = finalText;
    const isComplete = parts.length === this.commentBank.length && parts.length > 0;
    const badge = document.getElementById('report-completion-badge');
    if (isComplete) badge.classList.remove('hidden'); else badge.classList.add('hidden');
    const trimmed = finalText.trim();
    document.getElementById('report-word-count').innerText = trimmed ? trimmed.split(/\s+/).length : 0;
    document.getElementById('report-char-count').innerText = trimmed.length;
  },

  clearAll() {
    const s = this.getStudent(this.currentStudentId);
    if (s) { s.reportState = null; s.reportText = null; s.reportPronoun = null; ClassManager.saveData(); }
    this.initEmptyState();
    this.renderStepper(); this.renderAccordions(); this.compileReport();
    this.renderRoster();
  },

  copyReport() {
    const output = document.getElementById('report-output');
    if (!output.value) return;
    navigator.clipboard.writeText(output.value).catch(() => { output.select(); document.execCommand('copy'); });
    const btn = document.getElementById('report-copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied!';
    btn.classList.replace('bg-green','bg-blue'); btn.classList.replace('text-[var(--text-primary)]','text-white');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { btn.innerHTML = orig; btn.classList.replace('bg-blue','bg-green'); btn.classList.replace('text-white','text-[var(--text-primary)]'); if(window.lucide)lucide.createIcons(); }, 1500);
  }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
  ClassManager.init();
  CommentsManager.loadComments();


  // Archive modal backdrop clicks
  document.getElementById('pu-archive-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pu-archive-modal')) CommentsManager.closeArchiveModal();
  });
  document.getElementById('report-archive-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('report-archive-modal')) ReportManager.closeArchiveModal();
  });
});
// Class management logic synchronized with categories

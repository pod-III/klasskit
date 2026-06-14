/* ============================================
   DASHBOARD SCRIPT — My Space Landing Page
   ============================================ */

/**
 * Global application state representing data loaded from localStorage.
 */
const State = {
  isPro: false,
  schedule: [],
  tasks: [],
  admin: {},
  classData: {},
  redDays: []
};

/**
 * Utility for safe local storage operations.
 */
const StorageUtil = {
  /**
   * Safely loads and parses JSON from local storage.
   * @param {string} key - The local storage key.
   * @param {*} fallback - Fallback value if the key is missing or parsing fails.
   * @returns {*} The parsed data or fallback.
   */
  load(key, fallback = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn(`[MySpace] Error loading ${key}:`, e);
      return fallback;
    }
  }
};

/**
 * Initializes the dashboard, loads data, and triggers initial rendering.
 */
async function init() {
  await requireAuth();
  checkPro();
  loadData();
  renderAll();
  updateProVisibility();
  lucide.createIcons();
  
  // Update the current date display in the widget header
  const dateEl = document.getElementById('widget-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric', year: 'numeric' 
    });
  }
}

/**
 * Validates whether the current user has Pro or Admin privileges.
 */
function checkPro() {
  // Check for pro status from the parent window if nested in an iframe
  if (window.parent && window.parent.State) {
    State.isPro = window.parent.State.isPro();
  } else {
    // Fallback/Sandbox check based on local storage profile
    const user = StorageUtil.load('kk_user_profile', {});
    State.isPro = user.role === 'pro' || user.role === 'admin';
  }
}

/**
 * Hides pro-only dashboard elements for non-pro users.
 */
function updateProVisibility() {
  const classBtn = document.getElementById('class-shortcut-btn');
  if (classBtn) classBtn.style.display = State.isPro ? '' : 'none';

  const classWidget = document.getElementById('class-widget');
  if (classWidget) classWidget.style.display = State.isPro ? '' : 'none';
}

/**
 * Loads all required widget data from local storage into the State object.
 */
function loadData() {
  // 1. Load the raw schedule events
  const masters = StorageUtil.load('schedule_events', []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. Compute the full schedule including generated recurrences
  let allEvents = [...masters];
  masters.forEach(m => {
    if (m.recurrence && m.recurrence !== 'none') {
      allEvents.push(...generateBasicRecurrences(m, today));
    }
  });
  State.schedule = allEvents;

  // 3. Load other dependencies
  State.redDays = StorageUtil.load('schedule_red_days', []);
  State.tasks = StorageUtil.load('klasskit_tasks', []);
  State.admin = StorageUtil.load('schedule_class_admin', {});
  State.classData = StorageUtil.load('prog_my-class', {});
}

/**
 * Generates recurrence events for a given master event, constrained to 'today'.
 * @param {Object} m - The master event object.
 * @param {Date} today - Today's date reference.
 * @returns {Array} An array of generated recurrence events.
 */
function generateBasicRecurrences(m, today) {
  const mDate = new Date(m.date + 'T00:00:00');
  
  // Ignore masters that originate in the future
  if (mDate > today) return [];

  const todayStr = getDayStr(today);
  
  // Ignore recurrences if the master itself is scheduled for today
  if (m.date === todayStr) return [];

  const isWeeklyMatch = m.recurrence === 'weekly' && mDate.getDay() === today.getDay();
  const isDailyMatch = m.recurrence === 'daily';
  
  // Custom days check
  let isCustomMatch = false;
  if (m.recurrence === 'custom-days' && m.recurrenceDays) {
    const day = today.getDay();
    const dayIndex = day === 0 ? 6 : day - 1; // Align to Mon=0, Sun=6
    isCustomMatch = m.recurrenceDays.includes(dayIndex);
  }
  
  // Return a cloned event marked as a recurrence if any rule matches
  if (isWeeklyMatch || isDailyMatch || isCustomMatch) {
    return [{ ...m, date: todayStr, isRecurrence: true }];
  }

  return [];
}

/**
 * Helper to get a 'YYYY-MM-DD' formatted date string.
 */
function getDayStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Triggers re-rendering of all dashboard widgets.
 */
function renderAll() {
  renderSchedule();
  renderTasks();
  renderAdmin();
  renderClass();
}

/**
 * Renders the daily schedule widget.
 */
function renderSchedule() {
  const container = document.getElementById('schedule-widget-content');
  if (!container) return;

  const todayStr = getDayStr(new Date());
  const isRedDay = State.redDays.includes(todayStr);

  // Filter events to today and ignore recurrences on red (holiday) days
  const todayEvents = State.schedule
    .filter(e => e.date === todayStr)
    .filter(e => !(isRedDay && e.isRecurrence))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayEvents.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full py-12 text-slate-400">
        <i data-lucide="calendar-x" class="w-12 h-12 mb-4 opacity-20"></i>
        <p class="font-bold text-sm uppercase tracking-widest">${isRedDay ? 'Holiday / Off Day' : 'No classes scheduled'}</p>
        <p class="text-[10px] font-bold mt-1">Enjoy your free time!</p>
      </div>
    `;
  } else {
    container.innerHTML = todayEvents.map(evt => `
      <div class="schedule-item group">
        <div class="time-slot">
          <div class="text-[11px]">${formatTime(evt.startTime)}</div>
          <div class="opacity-40 text-[9px] uppercase">${formatTime(evt.endTime)}</div>
        </div>
        <div class="w-1 self-stretch rounded-full" style="background-color: ${evt.color}"></div>
        <div class="class-info">
          <div class="class-name" style="color: ${evt.color}">${evt.name}</div>
          <div class="class-meta">
            <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-2.5 h-2.5"></i> ${evt.room || 'No Room'}</span>
            <span class="opacity-50">•</span>
            <span class="flex items-center gap-1 uppercase">${evt.typeId || 'class'}</span>
          </div>
        </div>
        <button onclick="window.parent.MySpace.loadApp('schedule')" class="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
          <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-400"></i>
        </button>
      </div>
    `).join('');
  }
  
  lucide.createIcons({ root: container });
}

/**
 * Renders the top priority tasks widget.
 */
function renderTasks() {
  const container = document.getElementById('tasks-widget-content');
  if (!container) return;

  const prioOrder = { high: 0, medium: 1, low: 2 };
  
  // Get top 5 uncompleted tasks, sorted by priority (high > medium > low)
  const incompleteTasks = State.tasks
    .filter(t => !t.completed)
    .sort((a, b) => (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2))
    .slice(0, 5);

  if (incompleteTasks.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
        <i data-lucide="check-circle-2" class="w-8 h-8 mb-2 text-green opacity-40"></i>
        <p class="font-bold text-[10px] uppercase tracking-widest">All caught up!</p>
      </div>
    `;
  } else {
    container.innerHTML = incompleteTasks.map(t => {
      const colors = { high: 'bg-pink', medium: 'bg-orange', low: 'bg-blue' };
      const textColors = { high: 'text-pink', medium: 'text-orange', low: 'text-blue' };
      
      const dotColor = colors[t.priority] || 'bg-slate-400';
      const textColor = textColors[t.priority] || 'text-slate-400';
      
      return `
        <div class="dashboard-task-item group cursor-pointer" onclick="window.parent.MySpace.loadApp('tasks')">
          <div class="task-dot ${dotColor}"></div>
          <div class="task-text text-dark dark:text-slate-200">${t.text}</div>
          <div class="task-prio ${textColor} bg-opacity-10 ${dotColor.replace('bg-', 'bg-')} bg-clip-padding" style="background-color: transparent; border: 1px solid currentColor;">
            ${t.priority}
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * Renders the admin tracker alert widget.
 */
function renderAdmin() {
  const container = document.getElementById('admin-widget-content');
  if (!container) return;

  // Aggregate pending tasks per class
  const alerts = Object.entries(State.admin)
    .map(([className, tasks]) => {
      const pending = tasks.filter(t => !t.done).length;
      return { name: className, pending };
    })
    .filter(a => a.pending > 0);

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
        <i data-lucide="check-circle-2" class="w-6 h-6 text-green"></i>
        <p class="text-sm font-bold">All class planning is up to date!</p>
      </div>
    `;
  } else {
    // Show only the top 3 alerts to save space
    container.innerHTML = alerts.slice(0, 3).map(a => `
      <div class="flex items-center justify-between p-3 mb-2 rounded-xl bg-blue/5 border-2 border-blue/10 hover:border-blue/30 transition-colors cursor-pointer" onclick="window.parent.MySpace.loadApp('admin-tracker')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue text-white flex items-center justify-center">
            <i data-lucide="clipboard-list" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-black text-slate-700 dark:text-slate-200">${a.name}</div>
            <div class="text-[10px] font-bold text-blue uppercase tracking-tight">${a.pending} items pending</div>
          </div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-blue"></i>
      </div>
    `).join('');
    
    lucide.createIcons({ root: container });
  }
}

/**
 * Renders the class insights widget.
 */
function renderClass() {
  const container = document.getElementById('class-widget-content');
  if (!container) return;

  const classes = State.classData.classes || {};
  const classList = Object.keys(classes);

  // Empty state if no classes are defined
  if (classList.length === 0) {
     container.innerHTML = `
      <div class="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-3">
        <i data-lucide="users" class="w-8 h-8 text-slate-300"></i>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No students tracked yet.<br>Start managing your classes!</p>
        <button onclick="window.parent.MySpace.loadApp('my-class')" class="btn-chunky bg-green text-white text-[9px] px-4 py-1.5 rounded-lg mt-2 uppercase font-black">Open My Class</button>
      </div>
     `;
     lucide.createIcons({ root: container });
     return;
  }

  // Aggregate metrics across all classes
  let totalStudents = 0;
  let totalReflections = 0;
  let maxStars = -1;
  let topStudent = null;

  classList.forEach(c => {
    const data = classes[c];
    const students = data.students || [];
    
    totalStudents += students.length;
    totalReflections += data.reflections?.length || 0;
    
    students.forEach(s => {
      const stars = s.stars || 0;
      if (stars > maxStars) {
        maxStars = stars;
        topStudent = { ...s, className: c };
      }
    });
  });

  // Construct UI with aggregated stats
  container.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="p-4 rounded-2xl bg-blue/5 border-2 border-blue/10">
          <div class="text-xl font-black text-blue">${totalStudents}</div>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Total Students</div>
        </div>
        <div class="p-4 rounded-2xl bg-pink/5 border-2 border-pink/10">
          <div class="text-xl font-black text-pink">${totalReflections}</div>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Reflections</div>
        </div>
      </div>
      
      ${topStudent ? `
        <div class="p-4 rounded-2xl bg-orange/5 border-2 border-orange/10 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange text-white flex items-center justify-center font-black">
              ${(topStudent.nick || topStudent.name).charAt(0)}
            </div>
            <div>
              <div class="text-xs font-black text-slate-700 dark:text-slate-200">${topStudent.nick || topStudent.name}</div>
              <div class="text-[9px] font-bold text-orange uppercase tracking-tight">${topStudent.className}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-black text-orange flex items-center gap-1">
              ${topStudent.stars || 0} <i data-lucide="star" class="w-3 h-3 fill-orange"></i>
            </div>
            <div class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Top Student</div>
          </div>
        </div>
      ` : ''}

      <div class="p-4 rounded-2xl bg-green/5 border-2 border-green/20 hover:border-green/40 transition-colors cursor-pointer group" onclick="window.parent.MySpace.loadApp('my-class')">
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs font-black text-green uppercase tracking-widest">Recent Classes</span>
          <i data-lucide="arrow-right" class="w-3 h-3 text-green group-hover:translate-x-1 transition-transform"></i>
        </div>
        <div class="space-y-2">
          ${classList.slice(0, 2).map(c => `
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-600 dark:text-slate-400">${c}</span>
              <span class="text-[10px] font-bold text-slate-400">${classes[c].students?.length || 0} Students</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  lucide.createIcons({ root: container });
}

/**
 * Utility to format a 24-hour time string into AM/PM format.
 * @param {string} timeStr - "HH:MM" format.
 * @returns {string} Formatted time string, e.g. "2:30 PM".
 */
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Handle 0 as 12
  return `${hours}:${m} ${ampm}`;
}

/**
 * Toggles dark mode manually and syncs with the parent iframe.
 */
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem("theme_myspace-home", isDark ? "dark" : "light");
  
  const icon = document.getElementById('darkModeIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons({ nodes: [icon] });
  }
  
  // Sync the theme change with the parent hub window
  if (window.parent && window.parent.Theme) {
    const parentIsDark = window.parent.document.documentElement.classList.contains('dark');
    if (isDark !== parentIsDark) window.parent.Theme.toggle();
  }
}

// Initial Bootstrap
window.addEventListener('load', init);

// Listen for storage events (allows widgets to update automatically if edited in another tab)
window.addEventListener('storage', () => {
  loadData();
  renderAll();
  updateProVisibility();
});

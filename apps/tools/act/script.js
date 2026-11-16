/**
 * Activity Bank — KlassKit Flagship Classroom Toolkit
 * Supports: 140+ activities, multi-facet discovery, custom activities,
 * multi-plan Lesson Flow Builder with drag/reorder/notes/templates,
 * interactive Prep Checklists, Teacher Notes, Print Cards, and Live Teach Mode.
 */

const STORAGE_KEYS = {
  plans: "klasskit_act_lesson_plans_v2",
  legacyPlansV2: "act_lesson_plans_v2",
  legacyPlan: "lessonPlan",
  favorites: "klasskit_act_favorites_v1",
  legacyFavorites: "act_favorites_v1",
  notes: "klasskit_act_teacher_notes_v1",
  legacyNotes: "act_teacher_notes_v1",
  recent: "klasskit_act_recent_ids_v1",
  legacyRecent: "act_recent_ids_v1",
  custom: "klasskit_act_custom_activities",
  legacyCustom: "act_custom_activities",
  prepChecked: "klasskit_act_prep_checked_v1",
  legacyPrepChecked: "act_prep_checked_v1",
  updatedAt: "klasskit_act_updated_at",
  viewMode: "viewMode",
  theme: "theme_act",
};

const TYPE_META = {
  Warmer: {
    color: "bg-engYellow text-engDark",
    badge: "bg-engYellow text-engDark",
    icon: "sun",
    label: "Warmer",
  },
  Icebreaker: {
    color: "bg-engPurple text-white",
    badge: "bg-engPurple text-white",
    icon: "users",
    label: "Icebreaker",
  },
  Stirrer: {
    color: "bg-engOrange text-white",
    badge: "bg-engOrange text-white",
    icon: "zap",
    label: "Stirrer",
  },
  Settler: {
    color: "bg-engBlue text-white",
    badge: "bg-engBlue text-white",
    icon: "anchor",
    label: "Settler",
  },
  Closer: {
    color: "bg-engGreen text-engDark",
    badge: "bg-engGreen text-engDark",
    icon: "flag",
    label: "Closer",
  },
};

const LESSON_TEMPLATES = [
  {
    id: "balanced-45",
    name: "45-Min Balanced ESL Lesson",
    desc: "Warm up, energize speaking, settle into focused practice, and wrap up with reflection.",
    badge: "Warmer → Stirrer → Settler → Closer",
    ids: [129, 3, 6, 110],
  },
  {
    id: "zero-prep-sos",
    name: "Zero-Prep Emergency Sub Plan",
    desc: "Zero materials, zero printing—walk into any classroom and run a complete 40-minute session.",
    badge: "100% Zero Prep • ~35 min",
    ids: [91, 9, 32, 112],
  },
  {
    id: "young-learners-30",
    name: "Young Learners Active Block (Ages 3–10)",
    desc: "High-engagement TPR, sensory guessing, calm reset, and joyful door exit.",
    badge: "Ages 3–10 • ~30 min",
    ids: [95, 97, 100, 109],
  },
  {
    id: "speaking-debate",
    name: "Teens & Adults Fluency Workshop",
    desc: "Opinion warm-up, speed networking, structured debate, and takeaway synthesis.",
    badge: "Teens / Adult • ~50 min",
    ids: [121, 120, 10, 116],
  },
  {
    id: "day-one-icebreaker",
    name: "First Day of Class Community Pack",
    desc: "Learn names, build comfort, discover common ground, and launch class norms.",
    badge: "Day 1 • ~38 min",
    ids: [124, 125, 123, 69],
  },
];

const AppState = {
  builtInActivities: [],
  customActivities: [],
  activities: [],
  plansState: {
    activePlanId: "default",
    plans: [
      {
        id: "default",
        name: "Today's Lesson",
        items: [],
      },
    ],
  },
  favorites: new Set(),
  teacherNotes: {},
  recentIds: [],
  prepChecked: {},
  filters: {
    type: "all",
    age: "all",
    prep: "all",
    skill: "all",
    duration: "all",
    grouping: "all",
    difficulty: "all",
    search: "",
    sos: false,
  },
  sortBy: "default",
  viewMode: localStorage.getItem(STORAGE_KEYS.viewMode) || "grid",
  plannerCollapsedDesktop: false,
  activeModalActivityId: null,
  roulettePickId: null,
  dragIndex: null,
  toastTimeout: null,
  noteSyncTimeout: null,
  cloudSyncTimeout: null,
  teach: {
    queue: [],
    activityIdx: 0,
    stepIdx: 0,
    timerTotalSecs: 600,
    timerRemainingSecs: 600,
    timerRunning: false,
    timerInterval: null,
  },
};

/* ============================================
   1. INITIALIZATION & CLOUD SYNC
   ============================================ */
window.onload = async () => {
  await requireAuth();
  loadLocalState();
  setViewMode(AppState.viewMode, true);

  await Promise.all([fetchBuiltInActivities(), loadCloudState()]);
  mergeActivities();
  populateSkillDropdown();
  renderAll();
  handleUrlDeepLink();
  setupGlobalEvents();
};

function safeLucideIcons() {
  if (!window.lucide) return;
  const iconsMap = window.lucide.icons;
  if (iconsMap) {
    document.querySelectorAll("i[data-lucide]").forEach((el) => {
      const name = el.getAttribute("data-lucide");
      if (!name) return;
      // Convert kebab-case to PascalCase to check lucide.icons registry if keyed by PascalCase or kebab-case
      const pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
      if (!iconsMap[name] && !iconsMap[pascal]) {
        el.setAttribute("data-lucide", "sparkles");
      }
    });
  }
  window.lucide.createIcons();
}

function readMigratedJson(newKey, oldKey, fallback) {
  const rawNew = localStorage.getItem(newKey);
  if (rawNew !== null) return JSON.parse(rawNew);
  if (oldKey) {
    const rawOld = localStorage.getItem(oldKey);
    if (rawOld !== null) {
      localStorage.setItem(newKey, rawOld);
      return JSON.parse(rawOld);
    }
  }
  return fallback;
}

function loadLocalState() {
  try {
    const rawPlans = readMigratedJson(STORAGE_KEYS.plans, STORAGE_KEYS.legacyPlansV2, null);
    if (rawPlans && Array.isArray(rawPlans.plans) && rawPlans.plans.length > 0) {
      AppState.plansState = rawPlans;
    } else {
      const legacy = JSON.parse(localStorage.getItem(STORAGE_KEYS.legacyPlan) || "[]");
      if (Array.isArray(legacy) && legacy.length > 0) {
        AppState.plansState = {
          activePlanId: "default",
          plans: [
            {
              id: "default",
              name: "My Lesson Plan",
              items: legacy.map((a) => ({
                id: a.id,
                customMins: a.duration_mins || parseMinsFallback(a.time),
                slotNote: "",
              })),
            },
          ],
        };
        localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(AppState.plansState));
      }
    }

    const favs = readMigratedJson(STORAGE_KEYS.favorites, STORAGE_KEYS.legacyFavorites, []);
    AppState.favorites = new Set(Array.isArray(favs) ? favs.map(String) : []);

    AppState.teacherNotes = readMigratedJson(STORAGE_KEYS.notes, STORAGE_KEYS.legacyNotes, {}) || {};
    AppState.recentIds = readMigratedJson(STORAGE_KEYS.recent, STORAGE_KEYS.legacyRecent, []) || [];
    AppState.customActivities = readMigratedJson(STORAGE_KEYS.custom, STORAGE_KEYS.legacyCustom, []) || [];
    AppState.prepChecked = readMigratedJson(STORAGE_KEYS.prepChecked, STORAGE_KEYS.legacyPrepChecked, {}) || {};
  } catch (e) {
    console.warn("Failed loading local state", e);
  }
}

async function fetchBuiltInActivities() {
  try {
    const res = await fetch("./activities/activities.json?v=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    AppState.builtInActivities = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch activities.json:", err);
    document.getElementById("activitiesContainer").innerHTML = `
      <div class="col-span-full text-center py-12 glass-panel-soft rounded-2xl">
        <div class="inline-flex p-3 bg-red-100 dark:bg-red-950/40 rounded-2xl border-2 border-engDark mb-3">
          <i data-lucide="alert-triangle" class="w-8 h-8 text-engPink"></i>
        </div>
        <h3 class="font-heading text-xl font-bold">Could not load activities</h3>
        <p class="text-sm font-semibold text-slate-500 mt-1">Verify that ./activities/activities.json is accessible.</p>
      </div>`;
    lucide.createIcons();
  }
}

async function loadCloudState() {
  try {
    const [bankData, legacyData, customData] = await Promise.all([
      loadProgress("act_bank_v2"),
      loadProgress("act_lesson_plan"),
      loadProgress("act_custom_workspace"),
    ]);

    const localUpdatedAt = Number(localStorage.getItem(STORAGE_KEYS.updatedAt) || 0);

    if (bankData) {
      const cloudUpdatedAt = Number(bankData.updatedAt || 0);
      const shouldTakeCloud = !localUpdatedAt || cloudUpdatedAt >= localUpdatedAt;

      if (shouldTakeCloud && bankData.plansState && Array.isArray(bankData.plansState.plans) && bankData.plansState.plans.length > 0) {
        AppState.plansState = bankData.plansState;
        localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(AppState.plansState));
      }
      if (shouldTakeCloud && Array.isArray(bankData.favorites)) {
        AppState.favorites = new Set(bankData.favorites.map(String));
        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(AppState.favorites)));
      }
      if (bankData.teacherNotes && typeof bankData.teacherNotes === "object") {
        AppState.teacherNotes = shouldTakeCloud
          ? { ...AppState.teacherNotes, ...bankData.teacherNotes }
          : { ...bankData.teacherNotes, ...AppState.teacherNotes };
        localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(AppState.teacherNotes));
      }
      if (shouldTakeCloud && cloudUpdatedAt) {
        localStorage.setItem(STORAGE_KEYS.updatedAt, String(cloudUpdatedAt));
      }
    } else if (legacyData && Array.isArray(legacyData.lessonPlan) && legacyData.lessonPlan.length > 0) {
      const current = getActivePlan();
      if (current.items.length === 0) {
        current.items = legacyData.lessonPlan.map((a) => ({
          id: a.id,
          customMins: a.duration_mins || parseMinsFallback(a.time),
          slotNote: "",
        }));
        persistLocalPlans();
      }
    }

    if (customData && Array.isArray(customData.activities) && customData.activities.length > 0) {
      const byId = new Map(AppState.customActivities.map((c) => [String(c.id), c]));
      customData.activities.forEach((c) => {
        if (!byId.has(String(c.id))) {
          byId.set(String(c.id), { ...c, isCustom: true });
        }
      });
      AppState.customActivities = Array.from(byId.values());
      localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify(AppState.customActivities));
    }
  } catch (e) {
    console.warn("Cloud load skipped or failed:", e);
  }
}

function scheduleCloudSave() {
  const now = Date.now();
  localStorage.setItem(STORAGE_KEYS.updatedAt, String(now));
  clearTimeout(AppState.cloudSyncTimeout);
  AppState.cloudSyncTimeout = setTimeout(async () => {
    try {
      await saveProgress("act_bank_v2", {
        plansState: AppState.plansState,
        favorites: Array.from(AppState.favorites),
        teacherNotes: AppState.teacherNotes,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("Cloud sync failed:", e);
    }
  }, 1200);
}

function mergeActivities() {
  const seen = new Set();
  const merged = [];
  // Custom activities first; deduplicate by String(id) so overridden/cloned IDs never double-render
  AppState.customActivities.forEach((c) => {
    const key = String(c.id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(normalizeActivityRecord(c, true));
    }
  });
  AppState.builtInActivities.forEach((b) => {
    const key = String(b.id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(normalizeActivityRecord(b, false));
    }
  });
  AppState.activities = merged;
  const badge = document.getElementById("bankTotalBadge");
  if (badge) badge.textContent = `${AppState.activities.length}`;
}

function normalizeActivityRecord(act, isCustom = false) {
  const durationMins = Number(act.duration_mins) || parseMinsFallback(act.time);
  const prepLevel = act.prep_level || inferPrepLevel(act.prep_time);
  return {
    ...act,
    isCustom: Boolean(isCustom || act.isCustom),
    duration_mins: durationMins,
    prep_level: prepLevel,
    prep_time: act.prep_time || prepLevel,
    grouping: act.grouping || "Whole Class",
    difficulty: act.difficulty || "Medium",
    target_ages: Array.isArray(act.target_ages) && act.target_ages.length ? act.target_ages : ["7-12", "13-18"],
    skills: Array.isArray(act.skills) ? act.skills : [],
    materials: Array.isArray(act.materials) ? act.materials : [],
    steps: Array.isArray(act.steps) ? act.steps : [],
    goal: act.goal || act.desc || "",
    example: act.example || "",
    variation: act.variation || "Adapt the prompt topic to match your current unit vocabulary.",
    tips: act.tips || {
      lower_level: "Model one example slowly on the board and supply sentence starters.",
      higher_level: "Add a time limit or require follow-up justification questions.",
      management: "Use a clear signal to pause and wrap up cleanly.",
    },
    icon: act.icon || "sparkles",
  };
}

function parseMinsFallback(timeStr) {
  if (!timeStr) return 10;
  const nums = String(timeStr).match(/\d+/g);
  if (!nums || !nums.length) return 10;
  if (nums.length === 1) return parseInt(nums[0], 10);
  return Math.round((parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2);
}

function inferPrepLevel(prepTime) {
  const s = (prepTime || "").toLowerCase();
  if (s.includes("zero") || s.includes("none") || s === "") return "Zero Prep";
  if (s.includes("print") || s.includes("cut")) return "Needs Printouts";
  return "Quick Prep";
}

/* ============================================
   2. RENDER PIPELINE & DISCOVERY
   ============================================ */
function renderAll() {
  renderCategoryTabs();
  applyFilters();
  renderPlanner();
  renderRecentStrip();
  lucide.createIcons();
}

function populateSkillDropdown() {
  const select = document.getElementById("skillFilter");
  if (!select) return;
  const counts = {};
  AppState.activities.forEach((a) => {
    (a.skills || []).forEach((s) => {
      counts[s] = (counts[s] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([skill, count]) => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)} (${count})</option>`)
    .join("");
  select.innerHTML = `<option value="all">All Skills</option>${sorted}`;
}

function renderCategoryTabs() {
  const mount = document.getElementById("categoryTabs");
  if (!mount) return;

  const counts = {
    all: AppState.activities.length,
    Warmer: 0,
    Icebreaker: 0,
    Stirrer: 0,
    Settler: 0,
    Closer: 0,
    Favorites: 0,
    Custom: 0,
  };

  AppState.activities.forEach((a) => {
    if (counts[a.type] !== undefined) counts[a.type]++;
    if (AppState.favorites.has(String(a.id))) counts.Favorites++;
    if (a.isCustom) counts.Custom++;
  });

  const tabs = [
    { id: "all", label: "All", icon: "layout-grid", activeCls: "bg-engDark text-white dark:bg-white dark:text-engDark" },
    { id: "Warmer", label: "Warmers", icon: "sun", activeCls: "bg-engYellow text-engDark" },
    { id: "Icebreaker", label: "Icebreakers", icon: "users", activeCls: "bg-engPurple text-white" },
    { id: "Stirrer", label: "Stirrers", icon: "zap", activeCls: "bg-engOrange text-white" },
    { id: "Settler", label: "Settlers", icon: "anchor", activeCls: "bg-engBlue text-white" },
    { id: "Closer", label: "Closers", icon: "flag", activeCls: "bg-engGreen text-engDark" },
    { id: "Favorites", label: "Favorites", icon: "star", activeCls: "bg-engPink text-white" },
    { id: "Custom", label: "Custom", icon: "sparkles", activeCls: "bg-slate-700 text-white" },
  ];

  mount.innerHTML = tabs
    .map((t) => {
      const isActive = AppState.filters.type === t.id;
      const baseCls = isActive
        ? `${t.activeCls} active`
        : "bg-white dark:bg-slate-800 text-engDark dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700";
      return `
        <button onclick="setFilter('type', '${t.id}')"
          class="type-tab ${baseCls} shrink-0 px-3 py-1.5 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5">
          <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
          <span>${t.label}</span>
          <span class="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${isActive ? "bg-black/15" : "bg-slate-100 dark:bg-slate-700"}">${counts[t.id] || 0}</span>
        </button>`;
    })
    .join("");
}

function getFilteredActivities() {
  const f = AppState.filters;
  const searchLower = f.search.trim().toLowerCase();

  let list = AppState.activities.filter((act) => {
    if (f.type === "Favorites" && !AppState.favorites.has(String(act.id))) return false;
    else if (f.type === "Custom" && !act.isCustom) return false;
    else if (f.type !== "all" && f.type !== "Favorites" && f.type !== "Custom" && act.type !== f.type) return false;

    if (f.age !== "all" && !(act.target_ages || []).includes(f.age)) return false;
    if (f.prep !== "all" && act.prep_level !== f.prep) return false;
    if (f.skill !== "all" && !(act.skills || []).includes(f.skill)) return false;
    if (f.difficulty !== "all" && act.difficulty !== f.difficulty) return false;

    if (f.grouping !== "all") {
      if (!(act.grouping || "").toLowerCase().includes(f.grouping.toLowerCase())) return false;
    }

    if (f.duration === "short" && act.duration_mins > 10) return false;
    if (f.duration === "medium" && (act.duration_mins < 11 || act.duration_mins > 15)) return false;
    if (f.duration === "long" && act.duration_mins < 16) return false;

    if (f.sos && (act.prep_level !== "Zero Prep" || act.duration_mins > 15)) return false;

    if (searchLower) {
      const note = (AppState.teacherNotes[String(act.id)] || "").toLowerCase();
      const hay = [
        act.title,
        act.desc,
        act.goal,
        act.type,
        act.grouping,
        ...(act.skills || []),
        ...(act.materials || []),
        ...(act.steps || []),
        note,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }

    return true;
  });

  // Sort
  const diffOrder = { Easy: 1, Medium: 2, Hard: 3 };
  if (AppState.sortBy === "shortest") {
    list = [...list].sort((a, b) => a.duration_mins - b.duration_mins);
  } else if (AppState.sortBy === "longest") {
    list = [...list].sort((a, b) => b.duration_mins - a.duration_mins);
  } else if (AppState.sortBy === "easiest") {
    list = [...list].sort((a, b) => (diffOrder[a.difficulty] || 2) - (diffOrder[b.difficulty] || 2));
  } else if (AppState.sortBy === "az") {
    list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  } else if (AppState.sortBy === "recent") {
    list = [...list].sort((a, b) => {
      const ia = AppState.recentIds.indexOf(String(a.id));
      const ib = AppState.recentIds.indexOf(String(b.id));
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  return list;
}

function applyFilters(opts = { animate: true }) {
  const filtered = getFilteredActivities();
  renderActivities(filtered, opts);
  renderActiveFilterChips(filtered.length);
}

function renderActivities(data, { animate = true } = {}) {
  const container = document.getElementById("activitiesContainer");
  const emptyState = document.getElementById("emptyState");
  const activePlan = getActivePlan();
  const planIdSet = new Set(activePlan.items.map((item) => String(item.id)));

  container.innerHTML = "";
  if (data.length === 0) {
    emptyState.classList.remove("hidden");
    safeLucideIcons();
    return;
  }
  emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  data.forEach((act, idx) => {
    const meta = TYPE_META[act.type] || TYPE_META.Stirrer;
    const isInPlan = planIdSet.has(String(act.id));
    const isFav = AppState.favorites.has(String(act.id));
    const hasNote = Boolean((AppState.teacherNotes[String(act.id)] || "").trim());

    const prepBadgeCls =
      act.prep_level === "Zero Prep"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-400"
        : act.prep_level === "Quick Prep"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-400"
        : "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 border-pink-400";

    const diffDotCls =
      act.difficulty === "Easy" ? "bg-engGreen" : act.difficulty === "Medium" ? "bg-engOrange" : "bg-engPink";

    const agesHtml = (act.target_ages || [])
      .map(
        (ag) =>
          `<span class="px-2 py-0.5 rounded-md border border-engDark/30 dark:border-slate-600 bg-engYellow/80 text-engDark font-extrabold text-[10px] uppercase">${escapeHtml(ag)}</span>`
      )
      .join("");

    const skillsHtml = (act.skills || [])
      .slice(0, 4)
      .map(
        (sk) =>
          `<button type="button" onclick="event.stopPropagation(); filterBySkillClick('${escapeJsAttr(sk)}')" class="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-engBlue hover:text-white hover:border-engBlue text-[10px] font-bold uppercase transition-colors">${escapeHtml(sk)}</button>`
      )
      .join("");

    const card = document.createElement("article");
    card.setAttribute("tabindex", "0");
    card.setAttribute("onclick", `openModal('${escapeJsAttr(String(act.id))}')`);
    card.setAttribute("onkeydown", `if(event.key==='Enter') openModal('${escapeJsAttr(String(act.id))}')`);

    if (AppState.viewMode === "grid") {
      card.className =
        `activity-card cursor-pointer rounded-2xl overflow-hidden flex flex-col h-full group ${animate ? "animate-pop-in" : ""}`;
      if (animate) card.style.animationDelay = `${Math.min(idx * 18, 260)}ms`;
      card.innerHTML = `
        <div class="${meta.color} px-3.5 py-2.5 border-b-2 border-engDark dark:border-slate-600 flex justify-between items-center gap-2 shrink-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <i data-lucide="${meta.icon}" class="w-4 h-4 shrink-0"></i>
            <span class="font-heading font-bold text-sm uppercase tracking-wide truncate">${escapeHtml(act.type)}</span>
            ${act.isCustom ? `<span class="px-1.5 py-0.5 rounded bg-black/20 text-[9px] font-extrabold uppercase">Custom</span>` : ""}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="bg-black/20 px-2 py-0.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(act.time)}
            </span>
            <button type="button" onclick="event.stopPropagation(); toggleFavorite('${escapeJsAttr(String(act.id))}')"
              class="w-7 h-7 rounded-lg border-2 border-engDark/40 flex items-center justify-center transition-transform hover:scale-110 ${isFav ? "bg-engPink text-white border-engDark" : "bg-white/85 text-engDark"}"
              title="${isFav ? "Remove Favorite" : "Favorite"}">
              <i data-lucide="star" class="w-3.5 h-3.5 ${isFav ? "fill-current" : ""}"></i>
            </button>
            <button type="button" onclick="event.stopPropagation(); togglePlanActivity('${escapeJsAttr(String(act.id))}')"
              class="w-7 h-7 rounded-lg border-2 border-engDark flex items-center justify-center transition-transform hover:scale-110 ${isInPlan ? "bg-engGreen text-engDark" : "bg-white text-engDark"}"
              title="${isInPlan ? "In Lesson Plan (Click to remove)" : "Add to Lesson Plan"}">
              <i data-lucide="${isInPlan ? "check" : "plus"}" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="p-4 flex-1 flex flex-col gap-2.5">
          <div class="flex items-start justify-between gap-2">
            <h2 class="font-heading text-lg font-bold leading-snug text-engDark dark:text-white group-hover:text-engBlue transition-colors">
              ${escapeHtml(act.title)}
            </h2>
            <div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-engDark/20 dark:border-slate-600 shrink-0">
              <i data-lucide="${escapeHtml(act.icon)}" class="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-engPink transition-colors"></i>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold uppercase">
            <span class="px-2 py-0.5 rounded-md border ${prepBadgeCls}">${escapeHtml(act.prep_level)}</span>
            <span class="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full ${diffDotCls}"></span> ${escapeHtml(act.difficulty)}
            </span>
            <span class="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              ${escapeHtml(act.grouping)}
            </span>
            ${hasNote ? `<span class="px-2 py-0.5 rounded-md bg-engBlue/15 text-engBlue border border-engBlue/40 flex items-center gap-1"><i data-lucide="edit-3" class="w-3 h-3"></i> Note</span>` : ""}
          </div>

          <p class="text-slate-600 dark:text-slate-300 font-semibold text-sm leading-relaxed flex-1">
            ${escapeHtml(act.desc)}
          </p>

          <div class="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 items-center">
            ${agesHtml}
            ${skillsHtml}
          </div>
        </div>`;
    } else {
      card.className =
        `activity-card cursor-pointer rounded-2xl overflow-hidden flex flex-col sm:flex-row group ${animate ? "animate-pop-in" : ""}`;
      card.innerHTML = `
        <div class="${meta.color} px-4 py-3 sm:w-40 shrink-0 border-b-2 sm:border-b-0 sm:border-r-2 border-engDark dark:border-slate-600 flex sm:flex-col justify-between items-center sm:items-start gap-2">
          <span class="font-heading font-bold text-sm uppercase flex items-center gap-1.5">
            <i data-lucide="${meta.icon}" class="w-4 h-4"></i> ${escapeHtml(act.type)}
          </span>
          <span class="bg-black/20 px-2 py-0.5 rounded-lg text-xs font-extrabold flex items-center gap-1">
            <i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(act.time)}
          </span>
        </div>

        <div class="p-3.5 sm:p-4 flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-heading text-lg font-bold text-engDark dark:text-white group-hover:text-engBlue transition-colors truncate">
              ${escapeHtml(act.title)}
            </h2>
            <span class="px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase ${prepBadgeCls}">${escapeHtml(act.prep_level)}</span>
            <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">&bull; ${escapeHtml(act.grouping)} &bull; ${escapeHtml(act.difficulty)}</span>
            ${hasNote ? `<span class="text-[10px] font-extrabold text-engBlue flex items-center gap-1"><i data-lucide="edit-3" class="w-3 h-3"></i> Note</span>` : ""}
          </div>
          <p class="text-slate-600 dark:text-slate-300 font-semibold text-sm line-clamp-1">${escapeHtml(act.desc)}</p>
          <div class="flex flex-wrap gap-1.5 pt-0.5">${agesHtml} ${skillsHtml}</div>
        </div>

        <div class="p-3 border-t-2 sm:border-t-0 sm:border-l-2 border-engDark/20 dark:border-slate-700 flex sm:flex-col items-center justify-center gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-900/40">
          <button type="button" onclick="event.stopPropagation(); togglePlanActivity('${escapeJsAttr(String(act.id))}')"
            class="btn-chunky px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 ${isInPlan ? "bg-engGreen text-engDark" : "bg-white dark:bg-slate-800 text-engDark dark:text-white"}">
            <i data-lucide="${isInPlan ? "check" : "plus"}" class="w-4 h-4"></i>
            <span>${isInPlan ? "Added" : "Plan"}</span>
          </button>
          <button type="button" onclick="event.stopPropagation(); toggleFavorite('${escapeJsAttr(String(act.id))}')"
            class="p-1.5 rounded-lg border-2 border-engDark/30 dark:border-slate-600 ${isFav ? "bg-engPink text-white" : "bg-white dark:bg-slate-800"}">
            <i data-lucide="star" class="w-3.5 h-3.5 ${isFav ? "fill-current" : ""}"></i>
          </button>
        </div>`;
    }

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  safeLucideIcons();
}

function renderActiveFilterChips(resultCount) {
  const countEl = document.getElementById("resultsCountText");
  const chipsEl = document.getElementById("activeFilterChips");
  const resetBtn = document.getElementById("resetAllFiltersBtn");
  const advBadge = document.getElementById("activeFilterCountBadge");
  const sosBtn = document.getElementById("sosZeroPrepBtn");

  countEl.textContent = `Showing ${resultCount} of ${AppState.activities.length} activities`;

  const f = AppState.filters;
  const chips = [];
  if (f.type !== "all") chips.push({ key: "type", label: `Type: ${f.type}` });
  if (f.age !== "all") chips.push({ key: "age", label: `Age: ${f.age}` });
  if (f.prep !== "all") chips.push({ key: "prep", label: `Prep: ${f.prep}` });
  if (f.skill !== "all") chips.push({ key: "skill", label: `Skill: ${f.skill}` });
  if (f.duration !== "all") chips.push({ key: "duration", label: `Time: ${f.duration}` });
  if (f.grouping !== "all") chips.push({ key: "grouping", label: `Group: ${f.grouping}` });
  if (f.difficulty !== "all") chips.push({ key: "difficulty", label: `Level: ${f.difficulty}` });
  if (f.sos) chips.push({ key: "sos", label: "Zero-Prep SOS" });
  if (f.search.trim()) chips.push({ key: "search", label: `"${f.search.trim()}"` });

  const secondaryActive = [f.skill, f.duration, f.grouping, f.difficulty].filter((v) => v !== "all").length;
  advBadge.textContent = secondaryActive;
  advBadge.classList.toggle("hidden", secondaryActive === 0);

  if (sosBtn) {
    sosBtn.classList.toggle("ring-4", f.sos);
    sosBtn.classList.toggle("ring-engPink/50", f.sos);
  }

  chipsEl.innerHTML = chips
    .map(
      (c) => `
      <button onclick="clearSingleFilter('${c.key}')"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-engBlue/15 text-engBlue border border-engBlue/40 font-extrabold text-[11px] hover:bg-engPink/15 hover:text-engPink hover:border-engPink/40 transition-colors">
        <span>${escapeHtml(c.label)}</span>
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>`
    )
    .join("");

  resetBtn.classList.toggle("hidden", chips.length === 0);
}

function setFilter(key, value) {
  AppState.filters[key] = value;
  if (key === "type") renderCategoryTabs();
  applyFilters();
  lucide.createIcons();
}

function filterBySkillClick(skill) {
  AppState.filters.skill = skill;
  const sel = document.getElementById("skillFilter");
  if (sel) sel.value = skill;
  document.getElementById("advancedFiltersPanel").classList.remove("hidden");
  applyFilters();
  lucide.createIcons();
  showToast(`Filtered by skill: ${skill}`, "info");
}

function setSort(value) {
  AppState.sortBy = value;
  applyFilters();
}

function toggleZeroPrepSOS() {
  AppState.filters.sos = !AppState.filters.sos;
  applyFilters();
  lucide.createIcons();
  showToast(
    AppState.filters.sos ? "SOS Mode: Zero-Prep & 15 min or less!" : "SOS filter cleared",
    AppState.filters.sos ? "zap" : "info"
  );
}

function toggleAdvancedFilters() {
  document.getElementById("advancedFiltersPanel").classList.toggle("hidden");
}

function clearSingleFilter(key) {
  if (key === "search") {
    clearSearch();
    return;
  }
  if (key === "sos") {
    AppState.filters.sos = false;
  } else {
    AppState.filters[key] = "all";
    const domMap = {
      age: "ageFilter",
      prep: "prepFilter",
      skill: "skillFilter",
      duration: "durationFilter",
      grouping: "groupingFilter",
      difficulty: "difficultyFilter",
    };
    if (domMap[key]) document.getElementById(domMap[key]).value = "all";
  }
  if (key === "type") renderCategoryTabs();
  applyFilters();
  lucide.createIcons();
}

function resetAllFilters() {
  AppState.filters = {
    type: "all",
    age: "all",
    prep: "all",
    skill: "all",
    duration: "all",
    grouping: "all",
    difficulty: "all",
    search: "",
    sos: false,
  };
  AppState.sortBy = "default";
  document.getElementById("searchInput").value = "";
  document.getElementById("clearSearchBtn").classList.add("hidden");
  ["ageFilter", "prepFilter", "skillFilter", "durationFilter", "groupingFilter", "difficultyFilter"].forEach((id) => {
    document.getElementById(id).value = "all";
  });
  document.getElementById("sortFilter").value = "default";
  renderCategoryTabs();
  applyFilters();
  lucide.createIcons();
}

function clearSearch() {
  AppState.filters.search = "";
  const input = document.getElementById("searchInput");
  input.value = "";
  document.getElementById("clearSearchBtn").classList.add("hidden");
  applyFilters();
  lucide.createIcons();
}

function setViewMode(mode, isInit = false) {
  AppState.viewMode = mode;
  localStorage.setItem(STORAGE_KEYS.viewMode, mode);
  const isGrid = mode === "grid";

  const gridBtn = document.getElementById("btn-view-grid");
  const listBtn = document.getElementById("btn-view-list");
  gridBtn.className = `p-2 transition-colors ${isGrid ? "bg-engDark text-white" : "bg-white dark:bg-slate-800 text-engDark dark:text-white hover:bg-slate-100"}`;
  listBtn.className = `p-2 border-l-2 border-engDark dark:border-slate-500 transition-colors ${!isGrid ? "bg-engDark text-white" : "bg-white dark:bg-slate-800 text-engDark dark:text-white hover:bg-slate-100"}`;

  const container = document.getElementById("activitiesContainer");
  container.className = isGrid
    ? "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 pb-24 xl:pb-12"
    : "flex flex-col gap-3 pb-24 xl:pb-12";

  if (!isInit) applyFilters();
}

/* ============================================
   3. FAVORITES & RECENT HISTORY
   ============================================ */
function toggleFavorite(id) {
  const key = String(id);
  if (AppState.favorites.has(key)) {
    AppState.favorites.delete(key);
    showToast("Removed from Favorites", "info");
  } else {
    AppState.favorites.add(key);
    showToast("Saved to Favorites ★", "check-circle");
  }
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(AppState.favorites)));
  scheduleCloudSave();
  renderCategoryTabs();
  applyFilters({ animate: false });

  if (String(AppState.activeModalActivityId) === key) {
    updateModalFavoriteBtn(key);
  }
}

function recordRecent(id) {
  const key = String(id);
  AppState.recentIds = [key, ...AppState.recentIds.filter((x) => x !== key)].slice(0, 5);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(AppState.recentIds));
  renderRecentStrip();
}

function renderRecentStrip() {
  const strip = document.getElementById("recentStrip");
  const mount = document.getElementById("recentPills");
  if (!strip || !mount) return;

  const items = AppState.recentIds
    .map((id) => AppState.activities.find((a) => String(a.id) === String(id)))
    .filter(Boolean);

  if (items.length === 0) {
    strip.classList.add("hidden");
    return;
  }

  strip.classList.remove("hidden");
  mount.innerHTML = items
    .map(
      (a) => `
      <button onclick="openModal('${escapeJsAttr(String(a.id))}')"
        class="shrink-0 px-2 py-0.5 rounded-lg border border-engDark/30 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-engBlue text-[11px] font-bold truncate max-w-[140px] transition-colors">
        ${escapeHtml(a.title)}
      </button>`
    )
    .join("");
}

/* ============================================
   4. LESSON FLOW PLANNER (Multi-Plan, Telemetry, Reorder)
   ============================================ */
function getActivePlan() {
  let plan = AppState.plansState.plans.find((p) => p.id === AppState.plansState.activePlanId);
  if (!plan) {
    plan = AppState.plansState.plans[0];
    AppState.plansState.activePlanId = plan.id;
  }
  return plan;
}

function persistLocalPlans() {
  localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(AppState.plansState));
  scheduleCloudSave();
}

function togglePlanActivity(id) {
  const act = AppState.activities.find((a) => String(a.id) === String(id));
  if (!act) return;

  const plan = getActivePlan();
  const idx = plan.items.findIndex((item) => String(item.id) === String(id));
  if (idx > -1) {
    plan.items.splice(idx, 1);
    showToast(`Removed "${act.title}" from plan`, "info");
  } else {
    plan.items.push({
      id: act.id,
      customMins: act.duration_mins,
      slotNote: "",
    });
    showToast(`Added "${act.title}" to plan`, "check-circle");
  }

  persistLocalPlans();
  renderPlanner();
  applyFilters({ animate: false });
  if (String(AppState.activeModalActivityId) === String(id)) {
    updateModalPlanBtn(id);
  }
}

function renderPlanner() {
  const plan = getActivePlan();
  const resolvedItems = plan.items
    .map((entry, index) => {
      const act = AppState.activities.find((a) => String(a.id) === String(entry.id));
      if (!act) return null;
      return {
        ...entry,
        index,
        act,
        mins: Number(entry.customMins) > 0 ? Number(entry.customMins) : act.duration_mins,
      };
    })
    .filter(Boolean);

  const totalMins = resolvedItems.reduce((sum, x) => sum + x.mins, 0);
  const count = resolvedItems.length;

  // Update header & mobile badges
  const headerBadge = document.getElementById("headerPlanCount");
  const mobileBadge = document.getElementById("mobilePlanCount");
  const mobileMins = document.getElementById("mobilePlanMins");
  if (headerBadge) headerBadge.textContent = count;
  if (mobileBadge) mobileBadge.textContent = count;
  if (mobileMins) mobileMins.textContent = `${totalMins}m`;

  // Energy flow analysis
  const flowHint = computeEnergyFlowHint(resolvedItems);
  const flowPillsHtml = resolvedItems
    .map((item) => {
      const meta = TYPE_META[item.act.type] || TYPE_META.Stirrer;
      return `<span title="${escapeHtml(item.act.title)} (${item.act.type})" class="h-2.5 flex-1 rounded-full border border-engDark/40 ${meta.color}"></span>`;
    })
    .join("");

  const planOptionsHtml = AppState.plansState.plans
    .map(
      (p) =>
        `<option value="${escapeHtml(p.id)}" ${p.id === plan.id ? "selected" : ""}>${escapeHtml(p.name)} (${p.items.length})</option>`
    )
    .join("");

  const listHtml =
    resolvedItems.length === 0
      ? `
      <div class="text-center py-10 px-3 flex flex-col items-center justify-center">
        <div class="p-3 bg-white dark:bg-slate-800 rounded-2xl border-2 border-engDark dark:border-slate-500 shadow-hard-sm mb-3">
          <i data-lucide="layers" class="w-6 h-6 text-engBlue"></i>
        </div>
        <h3 class="font-heading text-lg font-bold">Lesson Plan is Empty</h3>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 max-w-[220px]">
          Click <strong>+</strong> on any activity card or load a starter template to build your class sequence.
        </p>
        <button onclick="openTemplatesModal()" class="mt-4 btn-chunky bg-engYellow text-engDark px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Load Starter Template
        </button>
      </div>`
      : resolvedItems
          .map((item, idx) => {
            const meta = TYPE_META[item.act.type] || TYPE_META.Stirrer;
            return `
            <li draggable="true"
                data-plan-idx="${idx}"
                ondragstart="onPlanDragStart(event, ${idx})"
                ondragover="onPlanDragOver(event)"
                ondrop="onPlanDrop(event, ${idx})"
                ondragend="onPlanDragEnd(event)"
                class="plan-item bg-white dark:bg-slate-800/90 rounded-xl border-2 border-engDark dark:border-slate-600 p-2.5 shadow-hard-sm space-y-2 transition-all">
              <div class="flex items-start justify-between gap-2">
                <button type="button" onclick="openModal('${escapeJsAttr(String(item.act.id))}')" class="text-left min-w-0 flex-1 group">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <span class="text-[10px] font-extrabold text-slate-400">#${idx + 1}</span>
                    <span class="px-1.5 py-0.2 rounded text-[9px] font-heading font-bold uppercase ${meta.badge}">${escapeHtml(item.act.type)}</span>
                  </div>
                  <h4 class="font-heading text-sm font-bold leading-snug group-hover:text-engBlue transition-colors truncate">${escapeHtml(item.act.title)}</h4>
                </button>
                <div class="flex items-center gap-0.5 shrink-0">
                  <button type="button" onclick="movePlanItem(${idx}, -1)" ${idx === 0 ? "disabled" : ""} class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25" title="Move up">
                    <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
                  </button>
                  <button type="button" onclick="movePlanItem(${idx}, 1)" ${idx === resolvedItems.length - 1 ? "disabled" : ""} class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25" title="Move down">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                  </button>
                  <button type="button" onclick="removePlanItem(${idx})" class="p-1 rounded hover:bg-pink-100 dark:hover:bg-pink-950/60 text-engPink" title="Remove">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0">
                  <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
                  <input type="number" min="1" max="180" value="${item.mins}"
                    onchange="updatePlanItemMeta(${idx}, 'customMins', this.value)"
                    class="w-9 bg-transparent text-xs font-extrabold text-center focus:outline-none"
                    title="Adjust minutes for this class" />
                  <span class="text-[10px] font-bold text-slate-400">m</span>
                </div>
                <input type="text" value="${escapeHtml(item.slotNote || "")}"
                  placeholder="Slot note (e.g. Unit 3 Vocab)..."
                  oninput="updatePlanItemMeta(${idx}, 'slotNote', this.value)"
                  class="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-engChalk dark:bg-slate-900 text-[11px] font-semibold" />
              </div>
            </li>`;
          })
          .join("");

  const html = `
    <!-- Plan Header & Switcher -->
    <div class="p-3.5 border-b-2 border-engDark dark:border-slate-600 bg-white/70 dark:bg-slate-900/60 space-y-2.5 shrink-0">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i data-lucide="bookmark" class="w-5 h-5 text-engBlue"></i>
          <h2 class="font-heading text-lg font-bold uppercase tracking-tight">Lesson Flow</h2>
        </div>
        <span class="px-2 py-0.5 rounded-lg bg-engDark text-white dark:bg-engBlue text-xs font-extrabold">
          ${count} &bull; ${totalMins}m
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <select onchange="switchActivePlan(this.value)"
          class="kk-select flex-1 min-w-0 py-1.5 pl-2.5 rounded-xl border-2 border-engDark dark:border-slate-500 bg-white dark:bg-slate-800 text-xs font-extrabold">
          ${planOptionsHtml}
        </select>
        <button onclick="createNewPlan()" class="btn-chunky bg-engGreen text-engDark p-1.5 rounded-xl" title="New Lesson Plan">
          <i data-lucide="plus" class="w-4 h-4"></i>
        </button>
        <button onclick="renameCurrentPlan()" class="btn-chunky bg-white dark:bg-slate-800 p-1.5 rounded-xl" title="Rename Plan">
          <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
        ${AppState.plansState.plans.length > 1 ? `
        <button onclick="deleteCurrentPlan()" class="btn-chunky bg-white dark:bg-slate-800 text-engPink p-1.5 rounded-xl" title="Delete Plan">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>` : ""}
      </div>

      ${count > 0 ? `
      <div class="space-y-1">
        <div class="flex items-center gap-1">${flowPillsHtml}</div>
        <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">${escapeHtml(flowHint)}</p>
      </div>` : ""}
    </div>

    <!-- Queue List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
      <ul class="space-y-2.5 list-none">${listHtml}</ul>
    </div>

    <!-- Plan Footer Actions -->
    <div class="p-3 border-t-2 border-engDark dark:border-slate-600 bg-white/70 dark:bg-slate-900/60 space-y-2 shrink-0">
      <button onclick="launchLessonTeachMode()" ${count === 0 ? "disabled" : ""}
        class="w-full btn-chunky bg-engPink text-white py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
        <i data-lucide="play" class="w-4 h-4"></i> Run Full Lesson (${totalMins}m)
      </button>
      <div class="grid grid-cols-3 gap-1.5">
        <button onclick="copyFullLessonPlan()" ${count === 0 ? "disabled" : ""}
          class="btn-chunky bg-white dark:bg-slate-800 py-2 rounded-xl text-xs flex items-center justify-center gap-1" title="Copy formatted lesson plan">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
        </button>
        <button onclick="printFullLessonPlan()" ${count === 0 ? "disabled" : ""}
          class="btn-chunky bg-white dark:bg-slate-800 py-2 rounded-xl text-xs flex items-center justify-center gap-1" title="Print Lesson Packet">
          <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print
        </button>
        <button onclick="openClearPlanConfirm()" ${count === 0 ? "disabled" : ""}
          class="btn-chunky bg-white dark:bg-slate-800 text-engPink py-2 rounded-xl text-xs flex items-center justify-center gap-1" title="Clear this plan">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Clear
        </button>
      </div>
    </div>`;

  const desktopMount = document.getElementById("desktopPlannerMount");
  const mobileMount = document.getElementById("mobilePlannerMount");
  if (desktopMount) desktopMount.innerHTML = html;
  if (mobileMount) mobileMount.innerHTML = html;
  lucide.createIcons();
}

function computeEnergyFlowHint(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return "Add another activity to balance your lesson energy.";
  const types = items.map((i) => i.act.type);
  let maxStirrerStreak = 0;
  let streak = 0;
  types.forEach((t) => {
    if (t === "Stirrer") {
      streak++;
      if (streak > maxStirrerStreak) maxStirrerStreak = streak;
    } else {
      streak = 0;
    }
  });
  if (maxStirrerStreak >= 3) {
    return "Tip: 3+ Stirrers in a row—consider mixing in a Settler to refocus.";
  }
  const hasCloser = types[types.length - 1] === "Closer";
  const hasStarter = types[0] === "Warmer" || types[0] === "Icebreaker";
  if (hasStarter && hasCloser) return "Great pacing! Strong opener, active core, and clean Closer.";
  if (!hasCloser) return "Balanced sequence—add a quick Closer to wrap up learning!";
  return "Balanced energy flow across your planned activities.";
}

function movePlanItem(idx, dir) {
  const plan = getActivePlan();
  const target = idx + dir;
  if (target < 0 || target >= plan.items.length) return;
  const [moved] = plan.items.splice(idx, 1);
  plan.items.splice(target, 0, moved);
  persistLocalPlans();
  renderPlanner();
}

function removePlanItem(idx) {
  const plan = getActivePlan();
  plan.items.splice(idx, 1);
  persistLocalPlans();
  renderPlanner();
  applyFilters({ animate: false });
  showToast("Removed from plan", "info");
}

function updatePlanItemMeta(idx, field, val) {
  const plan = getActivePlan();
  if (!plan.items[idx]) return;
  if (field === "customMins") {
    const num = Math.max(1, Math.min(180, parseInt(val, 10) || 10));
    plan.items[idx].customMins = num;
    persistLocalPlans();
    renderPlanner();
  } else {
    plan.items[idx][field] = val;
    clearTimeout(AppState.slotNoteTimeout);
    AppState.slotNoteTimeout = setTimeout(() => {
      persistLocalPlans();
    }, 350);
  }
}

/* Drag & drop handlers */
function onPlanDragStart(e, idx) {
  AppState.dragIndex = idx;
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function onPlanDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function onPlanDrop(e, dropIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const fromIdx = AppState.dragIndex;
  if (fromIdx === null || fromIdx === dropIdx) return;
  const plan = getActivePlan();
  const [moved] = plan.items.splice(fromIdx, 1);
  plan.items.splice(dropIdx, 0, moved);
  AppState.dragIndex = null;
  persistLocalPlans();
  renderPlanner();
}

function onPlanDragEnd(e) {
  AppState.dragIndex = null;
  document.querySelectorAll(".plan-item").forEach((el) => {
    el.classList.remove("dragging", "drag-over");
  });
}

function switchActivePlan(planId) {
  AppState.plansState.activePlanId = planId;
  persistLocalPlans();
  renderPlanner();
  applyFilters();
}

async function createNewPlan() {
  const name = typeof quickPrompt === "function"
    ? await quickPrompt("New Lesson Plan", `Lesson ${AppState.plansState.plans.length + 1}`)
    : window.prompt("Name for the new lesson plan:", `Lesson ${AppState.plansState.plans.length + 1}`);
  if (!name || !name.trim()) return;
  const id = "plan_" + Date.now();
  AppState.plansState.plans.push({ id, name: name.trim(), items: [] });
  AppState.plansState.activePlanId = id;
  persistLocalPlans();
  renderPlanner();
  applyFilters({ animate: false });
  showToast(`Created "${name.trim()}"`, "check-circle");
}

async function renameCurrentPlan() {
  const plan = getActivePlan();
  const next = typeof quickPrompt === "function"
    ? await quickPrompt("Rename Lesson Plan", plan.name)
    : window.prompt("Rename lesson plan:", plan.name);
  if (!next || !next.trim()) return;
  plan.name = next.trim();
  persistLocalPlans();
  renderPlanner();
  showToast("Plan renamed", "check-circle");
}

function deleteCurrentPlan() {
  if (AppState.plansState.plans.length <= 1) return;
  const plan = getActivePlan();
  openConfirmModal(
    `Delete "${plan.name}"?`,
    "This removes the saved lesson plan and its queued items.",
    () => {
      AppState.plansState.plans = AppState.plansState.plans.filter((p) => p.id !== plan.id);
      AppState.plansState.activePlanId = AppState.plansState.plans[0].id;
      persistLocalPlans();
      renderPlanner();
      applyFilters();
      showToast("Plan deleted", "info");
    }
  );
}

function openClearPlanConfirm() {
  const plan = getActivePlan();
  openConfirmModal(
    `Clear "${plan.name}"?`,
    "This removes all activities from the active lesson queue.",
    () => {
      plan.items = [];
      persistLocalPlans();
      renderPlanner();
      applyFilters();
      showToast("Lesson plan cleared", "info");
    }
  );
}

function toggleLessonPlanner(forceState) {
  if (window.innerWidth < 1280) {
    const drawer = document.getElementById("mobilePlanDrawer");
    const shouldOpen = forceState !== undefined ? forceState : drawer.classList.contains("hidden");
    drawer.classList.toggle("hidden", !shouldOpen);
    document.body.style.overflow = shouldOpen ? "hidden" : "";
  } else {
    const panel = document.getElementById("lessonPanel");
    AppState.plannerCollapsedDesktop = forceState !== undefined ? !forceState : !AppState.plannerCollapsedDesktop;
    panel.classList.toggle("xl:hidden", AppState.plannerCollapsedDesktop);
    panel.classList.toggle("xl:flex", !AppState.plannerCollapsedDesktop);
  }
}

/* ============================================
   5. ACTIVITY GUIDE MODAL
   ============================================ */
function openModal(id) {
  const act = AppState.activities.find((a) => String(a.id) === String(id));
  if (!act) return;

  AppState.activeModalActivityId = act.id;
  recordRecent(act.id);

  const meta = TYPE_META[act.type] || TYPE_META.Stirrer;
  document.getElementById("modalTitle").textContent = act.title;

  const badge = document.getElementById("modalTypeBadge");
  badge.textContent = act.type;
  badge.className = `px-2.5 py-0.5 rounded-lg border-2 border-engDark text-[11px] font-heading font-bold uppercase ${meta.badge}`;

  const iconBadge = document.getElementById("modalIconBadge");
  iconBadge.className = `w-12 h-12 rounded-2xl border-2 border-engDark dark:border-slate-500 shadow-hard-sm flex items-center justify-center shrink-0 ${meta.color}`;
  iconBadge.innerHTML = `<i data-lucide="${escapeHtml(act.icon)}" class="w-6 h-6"></i>`;

  document.getElementById("modalCustomBadge").classList.toggle("hidden", !act.isCustom);
  document.getElementById("modalEditCustomBtn").classList.toggle("hidden", !act.isCustom);
  document.getElementById("modalEditCustomBtn").onclick = () => {
    closeModal();
    openCustomModal(act.id);
  };

  document.getElementById("modalTimePill").innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(act.time)}`;
  document.getElementById("modalPrepPill").textContent = act.prep_level;
  document.getElementById("modalGroupingPill").textContent = act.grouping;

  // Tab 1: How to Run
  document.getElementById("modalGoal").textContent = act.goal || act.desc;
  document.getElementById("modalPrepEstimate").textContent = `Prep: ${act.prep_time} • Duration: ${act.time}`;

  const prepList = document.getElementById("modalPrepChecklist");
  const materials = (act.materials || []).filter((m) => m && m.toLowerCase() !== "none");
  if (materials.length === 0) {
    prepList.innerHTML = `
      <span class="px-3 py-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
        <i data-lucide="smile" class="w-4 h-4"></i> Zero materials required — ready right now!
      </span>`;
  } else {
    const checkedMap = AppState.prepChecked[String(act.id)] || {};
    prepList.innerHTML = materials
      .map((mat, i) => {
        const isChecked = Boolean(checkedMap[i]);
        return `
          <label class="cursor-pointer select-none px-3 py-1.5 rounded-xl border-2 border-engDark dark:border-slate-500 bg-white dark:bg-slate-900 text-xs font-bold flex items-center gap-2 transition-opacity ${isChecked ? "opacity-55 line-through" : ""}">
            <input type="checkbox" ${isChecked ? "checked" : ""} onchange="togglePrepItem('${escapeJsAttr(String(act.id))}', ${i}, this)" class="w-4 h-4 accent-engGreen" />
            <span>${escapeHtml(mat)}</span>
          </label>`;
      })
      .join("");
  }

  document.getElementById("modalSteps").innerHTML = (act.steps || [])
    .map(
      (step, idx) => `
      <li class="flex items-start gap-3 p-3.5 rounded-2xl border-2 border-engDark/20 dark:border-slate-700 bg-white dark:bg-slate-800/70">
        <span class="w-7 h-7 rounded-xl bg-engPink text-white border-2 border-engDark font-heading font-bold text-sm flex items-center justify-center shrink-0 shadow-hard-sm">${idx + 1}</span>
        <p class="text-sm sm:text-base font-semibold text-engDark dark:text-slate-100 leading-relaxed pt-0.5">${escapeHtml(step)}</p>
      </li>`
    )
    .join("");

  const exampleBox = document.getElementById("modalExampleBox");
  if (act.example && act.example.trim()) {
    exampleBox.classList.remove("hidden");
    document.getElementById("modalExample").textContent = act.example;
  } else {
    exampleBox.classList.add("hidden");
  }

  // Tab 2: Adapt & Tips
  document.getElementById("modalVariation").textContent = act.variation || "Adapt the theme to fit your current lesson unit.";
  document.getElementById("modalTipLower").textContent = act.tips?.lower_level || "Provide sentence starters on the board.";
  document.getElementById("modalTipHigher").textContent = act.tips?.higher_level || "Add a time cap or require follow-up questions.";
  document.getElementById("modalTipManagement").textContent = act.tips?.management || "Model one quick example round before starting.";

  // Tab 3: Details & Teacher Notes
  const diffEl = document.getElementById("modalDiff");
  diffEl.textContent = act.difficulty;
  diffEl.className = `px-3 py-1 rounded-lg border-2 border-engDark font-heading text-xs font-bold inline-block ${
    act.difficulty === "Easy"
      ? "bg-engGreen text-engDark"
      : act.difficulty === "Medium"
      ? "bg-engOrange text-white"
      : "bg-engPink text-white"
  }`;
  document.getElementById("modalAges").textContent = (act.target_ages || []).join(", ");
  document.getElementById("modalPrep").textContent = act.prep_time;

  document.getElementById("modalSkills").innerHTML = (act.skills || [])
    .map(
      (sk) => `
      <button onclick="closeModal(); filterBySkillClick('${escapeJsAttr(sk)}')"
        class="px-3 py-1 rounded-xl border-2 border-engDark dark:border-slate-500 bg-white dark:bg-slate-800 hover:bg-engBlue hover:text-white text-xs font-bold transition-colors">
        ${escapeHtml(sk)}
      </button>`
    )
    .join("");

  const noteInput = document.getElementById("modalTeacherNote");
  noteInput.value = AppState.teacherNotes[String(act.id)] || "";
  noteInput.oninput = (e) => saveTeacherNote(act.id, e.target.value);

  // Header & footer actions
  updateModalFavoriteBtn(act.id);
  updateModalPlanBtn(act.id);

  document.getElementById("modalFavBtn").onclick = () => toggleFavorite(act.id);
  document.getElementById("modalDuplicateBtn").onclick = () => duplicateAsCustom(act.id);
  document.getElementById("modalPrintBtn").onclick = () => printSingleActivity(act.id);
  document.getElementById("modalPlanToggleBtn").onclick = () => togglePlanActivity(act.id);
  document.getElementById("modalTeachModeBtn").onclick = () => {
    closeModal();
    startTeachMode([act]);
  };
  document.getElementById("modalCopyBtn").onclick = () => copyActivityGuide(act);

  switchModalTab("steps");
  document.getElementById("guideModal").showModal();
  safeLucideIcons();
}

function updateModalFavoriteBtn(id) {
  const isFav = AppState.favorites.has(String(id));
  const btn = document.getElementById("modalFavBtn");
  btn.className = `btn-chunky p-2 rounded-xl ${isFav ? "bg-engPink text-white" : "bg-white dark:bg-slate-800 text-engDark dark:text-white"}`;
  btn.innerHTML = `<i data-lucide="star" class="w-4 h-4 ${isFav ? "fill-current" : ""}"></i>`;
  lucide.createIcons();
}

function updateModalPlanBtn(id) {
  const plan = getActivePlan();
  const isIn = plan.items.some((x) => String(x.id) === String(id));
  const btn = document.getElementById("modalPlanToggleBtn");
  btn.className = `btn-chunky px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 ${
    isIn ? "bg-engGreen text-engDark" : "bg-engYellow text-engDark"
  }`;
  btn.innerHTML = `<i data-lucide="${isIn ? "check" : "plus"}" class="w-4 h-4"></i> ${isIn ? "In Lesson Plan" : "Add to Plan"}`;
  lucide.createIcons();
}

function togglePrepItem(actId, itemIdx, checkboxEl) {
  const key = String(actId);
  if (!AppState.prepChecked[key]) AppState.prepChecked[key] = {};
  AppState.prepChecked[key][itemIdx] = checkboxEl.checked;
  localStorage.setItem(STORAGE_KEYS.prepChecked, JSON.stringify(AppState.prepChecked));
  checkboxEl.parentElement.classList.toggle("opacity-55", checkboxEl.checked);
  checkboxEl.parentElement.classList.toggle("line-through", checkboxEl.checked);
}

function saveTeacherNote(actId, text) {
  const key = String(actId);
  const statusEl = document.getElementById("noteSaveStatus");
  if (statusEl) statusEl.textContent = "Saving...";
  if (text.trim()) {
    AppState.teacherNotes[key] = text;
  } else {
    delete AppState.teacherNotes[key];
  }
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(AppState.teacherNotes));
  clearTimeout(AppState.noteSyncTimeout);
  AppState.noteSyncTimeout = setTimeout(() => {
    if (statusEl) statusEl.textContent = "Saved!";
    scheduleCloudSave();
    applyFilters();
  }, 400);
}

function switchModalTab(tabId) {
  ["steps", "adapt", "notes"].forEach((t) => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`modal-panel-${t}`);
    const isActive = t === tabId;
    panel.classList.toggle("hidden", !isActive);
    btn.className = `flex-1 min-w-[130px] py-3 px-4 font-heading font-bold text-sm uppercase tracking-wide ${
      t !== "notes" ? "border-r-2 border-engDark dark:border-slate-600" : ""
    } flex items-center justify-center gap-2 transition-colors ${
      isActive
        ? "bg-white dark:bg-slate-900 text-engPink"
        : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-engDark dark:hover:text-white"
    }`;
  });
}

function closeModal() {
  const dlg = document.getElementById("guideModal");
  if (dlg.open) dlg.close();
}

/* ============================================
   6. LIVE TEACH MODE (Fullscreen Classroom Runner)
   ============================================ */
function launchLessonTeachMode() {
  const plan = getActivePlan();
  const queue = plan.items
    .map((entry) => {
      const act = AppState.activities.find((a) => String(a.id) === String(entry.id));
      if (!act) return null;
      return {
        ...act,
        duration_mins: Number(entry.customMins) > 0 ? Number(entry.customMins) : act.duration_mins,
        slotNote: entry.slotNote || "",
      };
    })
    .filter(Boolean);

  if (queue.length === 0) return;
  startTeachMode(queue);
}

function startTeachMode(queue) {
  AppState.teach.queue = queue;
  AppState.teach.activityIdx = 0;
  AppState.teach.stepIdx = 0;

  document.getElementById("teachModeOverlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderTeachStage(true);
}

function renderTeachStage(resetTimer = false) {
  const t = AppState.teach;
  const act = t.queue[t.activityIdx];
  if (!act) return;

  const meta = TYPE_META[act.type] || TYPE_META.Stirrer;
  const badge = document.getElementById("teachActivityBadge");
  badge.textContent = act.type;
  badge.className = `px-2.5 py-1 rounded-lg text-xs font-heading font-bold uppercase border-2 border-slate-600 shrink-0 ${meta.badge}`;

  const breadcrumb = document.getElementById("teachLessonBreadcrumb");
  const lessonNav = document.getElementById("teachLessonActivityControls");
  if (t.queue.length > 1) {
    breadcrumb.classList.remove("hidden");
    breadcrumb.textContent = `Lesson Flow • Activity ${t.activityIdx + 1} of ${t.queue.length}${act.slotNote ? " • " + act.slotNote : ""}`;
    lessonNav.classList.remove("hidden");
    document.getElementById("teachPrevActivityBtn").disabled = t.activityIdx === 0;
    document.getElementById("teachNextActivityBtn").disabled = t.activityIdx === t.queue.length - 1;
  } else {
    breadcrumb.classList.add("hidden");
    lessonNav.classList.add("hidden");
  }

  document.getElementById("teachTitle").textContent = act.title;
  document.getElementById("teachGroupingBadge").textContent = `${act.grouping} • ${act.time}`;
  document.getElementById("teachPromptText").textContent = act.example || act.goal || act.desc;

  const steps = act.steps && act.steps.length ? act.steps : [act.desc];
  if (t.stepIdx >= steps.length) t.stepIdx = steps.length - 1;
  if (t.stepIdx < 0) t.stepIdx = 0;

  document.getElementById("teachStepCounter").textContent = `Step ${t.stepIdx + 1} of ${steps.length}`;
  document.getElementById("teachCurrentStepText").textContent = steps[t.stepIdx];

  const tipText =
    t.stepIdx === 0
      ? act.tips?.lower_level || act.goal
      : t.stepIdx === steps.length - 1
      ? act.variation || act.tips?.higher_level
      : act.tips?.management || act.tips?.lower_level;
  document.getElementById("teachQuickTipText").textContent = tipText || "Keep energy upbeat and check understanding.";

  document.getElementById("teachPrevStepBtn").disabled = t.stepIdx === 0;
  const nextBtn = document.getElementById("teachNextStepBtn");
  if (t.stepIdx === steps.length - 1 && t.activityIdx < t.queue.length - 1) {
    nextBtn.innerHTML = `<span>Next Activity</span> <i data-lucide="skip-forward" class="w-4 h-4"></i>`;
  } else if (t.stepIdx === steps.length - 1) {
    nextBtn.innerHTML = `<span>Finish</span> <i data-lucide="check" class="w-4 h-4"></i>`;
  } else {
    nextBtn.innerHTML = `<span>Next Step</span> <i data-lucide="chevron-right" class="w-4 h-4"></i>`;
  }

  // All steps navigator
  document.getElementById("teachAllStepsList").innerHTML = steps
    .map(
      (s, i) => `
      <li>
        <button onclick="jumpTeachStep(${i})"
          class="w-full text-left p-2.5 rounded-xl border-2 text-xs font-semibold flex items-start gap-2 transition-colors ${
            i === t.stepIdx
              ? "bg-engBlue/25 border-engBlue text-white"
              : "bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500"
          }">
          <span class="w-5 h-5 rounded-md bg-slate-700 text-white font-heading font-bold flex items-center justify-center shrink-0">${i + 1}</span>
          <span class="leading-snug">${escapeHtml(s)}</span>
        </button>
      </li>`
    )
    .join("");

  const mats = (act.materials || []).filter((m) => m && m.toLowerCase() !== "none");
  document.getElementById("teachMaterialsList").innerHTML =
    mats.length === 0
      ? `<span class="text-xs font-bold text-engGreen">Zero materials needed</span>`
      : mats
          .map(
            (m) =>
              `<span class="px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-[11px] font-bold text-slate-200">${escapeHtml(m)}</span>`
          )
          .join("");

  if (resetTimer) {
    stopTeachTimer();
    t.timerTotalSecs = (act.duration_mins || 10) * 60;
    t.timerRemainingSecs = t.timerTotalSecs;
    updateTeachTimerDisplay();
  }

  lucide.createIcons();
}

function nextTeachStep() {
  const t = AppState.teach;
  const act = t.queue[t.activityIdx];
  const steps = act.steps || [];
  if (t.stepIdx < steps.length - 1) {
    t.stepIdx++;
    renderTeachStage(false);
  } else if (t.activityIdx < t.queue.length - 1) {
    t.activityIdx++;
    t.stepIdx = 0;
    renderTeachStage(true);
  } else {
    exitTeachMode();
    showToast("Activity completed! Great class!", "trophy");
  }
}

function prevTeachStep() {
  if (AppState.teach.stepIdx > 0) {
    AppState.teach.stepIdx--;
    renderTeachStage(false);
  }
}

function jumpTeachStep(idx) {
  AppState.teach.stepIdx = idx;
  renderTeachStage(false);
}

function switchTeachActivity(delta) {
  const t = AppState.teach;
  const next = t.activityIdx + delta;
  if (next < 0 || next >= t.queue.length) return;
  t.activityIdx = next;
  t.stepIdx = 0;
  renderTeachStage(true);
}

function toggleTeachPromptBanner() {
  document.getElementById("teachPromptBanner").classList.toggle("hidden");
}

function toggleTeachTimer() {
  if (AppState.teach.timerRunning) {
    stopTeachTimer();
  } else {
    AppState.teach.timerRunning = true;
    AppState.teach.timerInterval = setInterval(() => {
      if (AppState.teach.timerRemainingSecs > 0) {
        AppState.teach.timerRemainingSecs--;
        updateTeachTimerDisplay();
        if (AppState.teach.timerRemainingSecs === 0) {
          stopTeachTimer();
          playChime();
          showToast("Time's up!", "bell");
        }
      }
    }, 1000);
    updateTeachTimerDisplay();
  }
}

function stopTeachTimer() {
  AppState.teach.timerRunning = false;
  clearInterval(AppState.teach.timerInterval);
  AppState.teach.timerInterval = null;
  updateTeachTimerDisplay();
}

function resetTeachTimer() {
  stopTeachTimer();
  const act = AppState.teach.queue[AppState.teach.activityIdx];
  AppState.teach.timerTotalSecs = (act?.duration_mins || 10) * 60;
  AppState.teach.timerRemainingSecs = AppState.teach.timerTotalSecs;
  updateTeachTimerDisplay();
}

function adjustTeachTimer(deltaSecs) {
  const t = AppState.teach;
  t.timerRemainingSecs = Math.max(0, t.timerRemainingSecs + deltaSecs);
  if (t.timerRemainingSecs > t.timerTotalSecs) t.timerTotalSecs = t.timerRemainingSecs;
  updateTeachTimerDisplay();
}

function updateTeachTimerDisplay() {
  const t = AppState.teach;
  const mins = Math.floor(t.timerRemainingSecs / 60);
  const secs = t.timerRemainingSecs % 60;
  document.getElementById("teachTimerDisplay").textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const pct = t.timerTotalSecs > 0 ? Math.round((t.timerRemainingSecs / t.timerTotalSecs) * 100) : 0;
  const bar = document.getElementById("teachTimerBar");
  bar.style.width = `${pct}%`;
  bar.className = `h-full transition-all duration-500 ${
    pct <= 15 ? "bg-engPink" : pct <= 40 ? "bg-engOrange" : "bg-engGreen"
  }`;

  const btn = document.getElementById("teachTimerToggleBtn");
  btn.innerHTML = t.timerRunning
    ? `<i data-lucide="pause" class="w-3.5 h-3.5"></i> Pause`
    : `<i data-lucide="play" class="w-3.5 h-3.5"></i> Start`;
  btn.className = `px-2.5 py-1 rounded-lg font-heading font-bold text-xs flex items-center gap-1 ${
    t.timerRunning ? "bg-engOrange text-white" : "bg-engGreen text-engDark"
  }`;
  lucide.createIcons();
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.6);
    });
  } catch (e) {
    // Ignore audio context restriction errors
  }
}

function exitTeachMode() {
  stopTeachTimer();
  document.getElementById("teachModeOverlay").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============================================
   7. ROULETTE & TEMPLATES
   ============================================ */
function openRouletteModal() {
  document.getElementById("rouletteModal").showModal();
  lucide.createIcons();
}

function spinRoulette() {
  const type = document.getElementById("rouletteType").value;
  const age = document.getElementById("rouletteAge").value;
  const zeroOnly = document.getElementById("rouletteZeroPrep").checked;

  const pool = AppState.activities.filter((a) => {
    if (type !== "all" && a.type !== type) return false;
    if (age !== "all" && !(a.target_ages || []).includes(age)) return false;
    if (zeroOnly && a.prep_level !== "Zero Prep") return false;
    return true;
  });

  const box = document.getElementById("rouletteResultBox");
  if (pool.length === 0) {
    AppState.roulettePickId = null;
    document.getElementById("rouletteOpenBtn").disabled = true;
    document.getElementById("rouletteAddBtn").disabled = true;
    box.innerHTML = `<p class="font-heading font-bold text-engPink">No matches for that combo! Try widening a filter.</p>`;
    return;
  }

  let ticks = 0;
  const interval = setInterval(() => {
    const sample = pool[Math.floor(Math.random() * pool.length)];
    box.innerHTML = `<p class="font-heading text-lg font-bold opacity-60">${escapeHtml(sample.title)}</p>`;
    ticks++;
    if (ticks >= 8) {
      clearInterval(interval);
      const winner = pool[Math.floor(Math.random() * pool.length)];
      AppState.roulettePickId = winner.id;
      const meta = TYPE_META[winner.type] || TYPE_META.Stirrer;
      document.getElementById("rouletteOpenBtn").disabled = false;
      document.getElementById("rouletteAddBtn").disabled = false;
      box.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-lg border-2 border-engDark text-[11px] font-heading font-bold uppercase mb-2 ${meta.badge}">${escapeHtml(winner.type)} &bull; ${escapeHtml(winner.time)}</span>
        <h4 class="font-heading text-xl font-bold text-engDark dark:text-white">${escapeHtml(winner.title)}</h4>
        <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1.5">${escapeHtml(winner.desc)}</p>
      `;
    }
  }, 55);
}

function openRoulettePick() {
  if (!AppState.roulettePickId) return;
  document.getElementById("rouletteModal").close();
  openModal(AppState.roulettePickId);
}

function addRoulettePick() {
  if (!AppState.roulettePickId) return;
  togglePlanActivity(AppState.roulettePickId);
}

function openTemplatesModal() {
  const list = document.getElementById("templatesList");
  list.innerHTML = LESSON_TEMPLATES.map((tpl) => {
    const acts = tpl.ids
      .map((id) => AppState.activities.find((a) => Number(a.id) === id))
      .filter(Boolean);
    const total = acts.reduce((s, a) => s + (a.duration_mins || 10), 0);
    return `
      <div class="rounded-2xl border-2 border-engDark dark:border-slate-600 bg-engChalk dark:bg-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-heading text-base font-bold">${escapeHtml(tpl.name)}</h4>
            <span class="px-2 py-0.5 rounded-lg bg-engYellow text-engDark border border-engDark text-[10px] font-extrabold uppercase">${escapeHtml(tpl.badge)}</span>
          </div>
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(tpl.desc)}</p>
          <p class="text-[11px] font-bold text-engBlue">${acts.map((a) => a.title).join(" → ")} (${total} min)</p>
        </div>
        <button onclick="applyLessonTemplate('${tpl.id}')" class="btn-chunky bg-engGreen text-engDark px-4 py-2 rounded-xl text-xs shrink-0">
          Load Plan
        </button>
      </div>`;
  }).join("");
  document.getElementById("templatesModal").showModal();
  lucide.createIcons();
}

function applyLessonTemplate(tplId) {
  const tpl = LESSON_TEMPLATES.find((t) => t.id === tplId);
  if (!tpl) return;
  const plan = getActivePlan();
  plan.name = tpl.name;
  plan.items = tpl.ids
    .map((id) => AppState.activities.find((a) => Number(a.id) === id))
    .filter(Boolean)
    .map((a) => ({ id: a.id, customMins: a.duration_mins, slotNote: "" }));
  persistLocalPlans();
  renderPlanner();
  applyFilters();
  document.getElementById("templatesModal").close();
  showToast(`Loaded "${tpl.name}"!`, "check-circle");
}

/* ============================================
   8. CUSTOM ACTIVITY CREATOR & DUPLICATION
   ============================================ */
function openCustomModal(editId = null) {
  const form = document.getElementById("customActivityForm");
  form.reset();
  document.getElementById("customEditId").value = "";
  document.getElementById("customDeleteBtn").classList.add("hidden");
  document.getElementById("customModalHeading").innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5"></i> Create Custom Activity`;

  if (editId !== null) {
    const existing = AppState.customActivities.find((c) => String(c.id) === String(editId));
    if (existing) {
      document.getElementById("customEditId").value = existing.id;
      document.getElementById("customModalHeading").innerHTML = `<i data-lucide="edit-3" class="w-5 h-5"></i> Edit Custom Activity`;
      document.getElementById("customDeleteBtn").classList.remove("hidden");
      document.getElementById("customTitle").value = existing.title || "";
      document.getElementById("customType").value = existing.type || "Stirrer";
      document.getElementById("customDurationMins").value = existing.duration_mins || 10;
      document.getElementById("customDifficulty").value = existing.difficulty || "Easy";
      document.getElementById("customGrouping").value = existing.grouping || "Whole Class";
      document.getElementById("customPrepLevel").value = existing.prep_level || "Zero Prep";
      document.getElementById("customDesc").value = existing.desc || "";
      document.getElementById("customSkills").value = (existing.skills || []).join(", ");
      document.getElementById("customMaterials").value = (existing.materials || []).join(", ");
      document.getElementById("customGoal").value = existing.goal || "";
      document.getElementById("customSteps").value = (existing.steps || []).join("\n");
      document.getElementById("customExample").value = existing.example || "";
      document.getElementById("customVariation").value = existing.variation || "";

      const ageSet = new Set(existing.target_ages || []);
      document.querySelectorAll("#customAgesGroup input[type='checkbox']").forEach((cb) => {
        cb.checked = ageSet.has(cb.value);
      });
    }
  }

  document.getElementById("customActivityModal").showModal();
  lucide.createIcons();
}

function duplicateAsCustom(id) {
  const source = AppState.activities.find((a) => String(a.id) === String(id));
  if (!source) return;
  closeModal();
  openCustomModal();
  document.getElementById("customTitle").value = `${source.title} (My Version)`;
  document.getElementById("customType").value = source.type;
  document.getElementById("customDurationMins").value = source.duration_mins || 10;
  document.getElementById("customDifficulty").value = source.difficulty || "Medium";
  document.getElementById("customGrouping").value = source.grouping || "Whole Class";
  document.getElementById("customPrepLevel").value = source.prep_level || "Zero Prep";
  document.getElementById("customDesc").value = source.desc || "";
  document.getElementById("customSkills").value = (source.skills || []).join(", ");
  document.getElementById("customMaterials").value = (source.materials || []).join(", ");
  document.getElementById("customGoal").value = source.goal || "";
  document.getElementById("customSteps").value = (source.steps || []).join("\n");
  document.getElementById("customExample").value = source.example || "";
  document.getElementById("customVariation").value = source.variation || "";
  const ageSet = new Set(source.target_ages || []);
  document.querySelectorAll("#customAgesGroup input[type='checkbox']").forEach((cb) => {
    cb.checked = ageSet.has(cb.value);
  });
}

function saveCustomActivity(e) {
  e.preventDefault();
  const ages = Array.from(document.querySelectorAll("#customAgesGroup input:checked")).map((cb) => cb.value);
  if (ages.length === 0) {
    showToast("Select at least one target age group", "info");
    return;
  }

  const editId = document.getElementById("customEditId").value;
  const mins = Math.max(1, parseInt(document.getElementById("customDurationMins").value, 10) || 10);
  const prepLevel = document.getElementById("customPrepLevel").value;
  const steps = document
    .getElementById("customSteps")
    .value.split("\n")
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);

  if (steps.length === 0) {
    showToast("Add at least one instruction step", "info");
    return;
  }

  const record = {
    id: editId || `custom_${Date.now()}`,
    isCustom: true,
    title: document.getElementById("customTitle").value.trim(),
    type: document.getElementById("customType").value,
    difficulty: document.getElementById("customDifficulty").value,
    time: `${mins} Min`,
    duration_mins: mins,
    target_ages: ages,
    grouping: document.getElementById("customGrouping").value,
    prep_time: prepLevel,
    prep_level: prepLevel,
    materials: document
      .getElementById("customMaterials")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    desc: document.getElementById("customDesc").value.trim(),
    goal: document.getElementById("customGoal").value.trim() || document.getElementById("customDesc").value.trim(),
    skills: document
      .getElementById("customSkills")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    icon: "sparkles",
    steps,
    example: document.getElementById("customExample").value.trim(),
    variation: document.getElementById("customVariation").value.trim(),
  };

  if (editId) {
    const idx = AppState.customActivities.findIndex((c) => String(c.id) === String(editId));
    if (idx > -1) AppState.customActivities[idx] = record;
    else AppState.customActivities.unshift(record);
  } else {
    AppState.customActivities.unshift(record);
  }

  persistCustomActivities();
  mergeActivities();
  populateSkillDropdown();
  renderAll();
  document.getElementById("customActivityModal").close();
  showToast("Custom activity saved!", "check-circle");
}

function deleteCurrentCustomActivity() {
  const editId = document.getElementById("customEditId").value;
  if (!editId) return;
  const key = String(editId);
  AppState.customActivities = AppState.customActivities.filter((c) => String(c.id) !== key);
  AppState.plansState.plans.forEach((p) => {
    p.items = p.items.filter((item) => String(item.id) !== key);
  });
  AppState.favorites.delete(key);
  AppState.recentIds = AppState.recentIds.filter((x) => String(x) !== key);
  delete AppState.teacherNotes[key];

  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(AppState.favorites)));
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(AppState.recentIds));
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(AppState.teacherNotes));
  persistLocalPlans();
  persistCustomActivities();
  mergeActivities();
  populateSkillDropdown();
  renderAll();
  document.getElementById("customActivityModal").close();
  showToast("Custom activity deleted", "info");
}

function persistCustomActivities() {
  localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify(AppState.customActivities));
  saveProgress("act_custom_workspace", {
    activities: AppState.customActivities,
    updatedAt: Date.now(),
  }).catch(() => {});
}

/* ============================================
   9. EXPORT, COPY & PRINT
   ============================================ */
function copyActivityGuide(act) {
  const mats = (act.materials || []).length ? act.materials.join(", ") : "None";
  const text = [
    `${act.title} (${act.type} • ${act.time} • ${act.prep_level})`,
    `Goal: ${act.goal || act.desc}`,
    `Materials: ${mats}`,
    "",
    "Steps:",
    ...(act.steps || []).map((s, i) => `${i + 1}. ${s}`),
    act.example ? `\nExample/Prompt: ${act.example}` : "",
    act.variation ? `\nVariation: ${act.variation}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  copyToClipboard(text, "Activity guide copied!");
}

function copyFullLessonPlan() {
  const plan = getActivePlan();
  const resolved = plan.items
    .map((e) => {
      const act = AppState.activities.find((a) => String(a.id) === String(e.id));
      return act ? { ...act, customMins: e.customMins || act.duration_mins, slotNote: e.slotNote || "" } : null;
    })
    .filter(Boolean);
  if (resolved.length === 0) return;

  const total = resolved.reduce((s, a) => s + Number(a.customMins), 0);
  const allMaterials = Array.from(
    new Set(resolved.flatMap((a) => a.materials || []).filter((m) => m && m.toLowerCase() !== "none"))
  );

  const lines = [
    `LESSON PLAN: ${plan.name} (~${total} min)`,
    `Materials Needed: ${allMaterials.length ? allMaterials.join(", ") : "Zero materials!"}`,
    "=".repeat(42),
    "",
  ];

  resolved.forEach((act, idx) => {
    lines.push(`${idx + 1}. ${act.title} [${act.type} • ${act.customMins} min]`);
    if (act.slotNote) lines.push(`   Note: ${act.slotNote}`);
    lines.push(`   Goal: ${act.goal || act.desc}`);
    (act.steps || []).forEach((s, si) => lines.push(`   ${si + 1}) ${s}`));
    if (act.example) lines.push(`   Example: ${act.example}`);
    lines.push("");
  });

  copyToClipboard(lines.join("\n"), "Full lesson plan copied!");
}

function printSingleActivity(id) {
  const act = AppState.activities.find((a) => String(a.id) === String(id));
  if (!act) return;
  renderPrintPacket([act], act.title);
  window.print();
}

function printFullLessonPlan() {
  const plan = getActivePlan();
  const acts = plan.items
    .map((e) => {
      const act = AppState.activities.find((a) => String(a.id) === String(e.id));
      return act ? { ...act, time: `${e.customMins || act.duration_mins} Min`, slotNote: e.slotNote } : null;
    })
    .filter(Boolean);
  if (acts.length === 0) return;
  renderPrintPacket(acts, plan.name);
  window.print();
}

function renderPrintPacket(acts, heading) {
  const sheet = document.getElementById("printSheet");
  sheet.innerHTML = `
    <div style="margin-bottom: 16px; border-bottom: 3px solid #1e293b; padding-bottom: 8px;">
      <h1 style="font-family: Fredoka, sans-serif; font-size: 24px; margin: 0;">${escapeHtml(heading)}</h1>
      <p style="font-size: 12px; color: #475569; margin: 4px 0 0;">KlassKit Activity Bank &bull; ${acts.length} Activity Card(s)</p>
    </div>
    ${acts
      .map(
        (act, idx) => `
      <div class="print-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-family: Fredoka, sans-serif; font-size:18px;">${idx + 1}. ${escapeHtml(act.title)}</strong>
          <span style="font-size:12px; font-weight:700;">${escapeHtml(act.type)} &bull; ${escapeHtml(act.time)} &bull; ${escapeHtml(act.grouping)}</span>
        </div>
        ${act.slotNote ? `<p style="font-size:12px; font-weight:700; margin:0 0 6px;">Class Note: ${escapeHtml(act.slotNote)}</p>` : ""}
        <p style="font-size:13px; margin:0 0 8px;"><strong>Goal:</strong> ${escapeHtml(act.goal || act.desc)}</p>
        <p style="font-size:12px; margin:0 0 8px;"><strong>Materials:</strong> ${escapeHtml((act.materials || []).join(", ") || "None")}</p>
        <ol style="font-size:13px; padding-left:20px; margin:0 0 8px;">
          ${(act.steps || []).map((s) => `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`).join("")}
        </ol>
        ${act.example ? `<p style="font-size:12px; background:#f8fafc; padding:8px; border:1px solid #cbd5e1; border-radius:8px; margin:0 0 6px;"><strong>Example / Prompt:</strong> ${escapeHtml(act.example)}</p>` : ""}
        ${act.variation ? `<p style="font-size:12px; margin:0;"><strong>Variation:</strong> ${escapeHtml(act.variation)}</p>` : ""}
      </div>`
      )
      .join("")}
  `;
}

/* ============================================
   10. CONFIRM MODAL, THEME, URL DEEP LINK, SHORTCUTS
   ============================================ */
let pendingConfirmAction = null;

function openConfirmModal(title, body, onConfirm) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmBody").textContent = body;
  pendingConfirmAction = onConfirm;
  document.getElementById("confirmActionBtn").onclick = () => {
    closeConfirmModal();
    if (pendingConfirmAction) pendingConfirmAction();
  };
  document.getElementById("confirmModal").showModal();
  lucide.createIcons();
}

function closeConfirmModal() {
  const dlg = document.getElementById("confirmModal");
  if (dlg.open) dlg.close();
}

function handleUrlDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const actId = params.get("activity");
  const typeParam = params.get("type");
  if (typeParam && TYPE_META[typeParam]) {
    setFilter("type", typeParam);
  }
  if (actId) {
    openModal(actId);
  }
}

function setupGlobalEvents() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    AppState.filters.search = e.target.value;
    document.getElementById("clearSearchBtn").classList.toggle("hidden", !e.target.value);
    applyFilters();
  });

  // Close dialogs on backdrop click
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  });

  // Restore scroll if resized above mobile drawer breakpoint
  window.addEventListener("resize", () => {
    const drawer = document.getElementById("mobilePlanDrawer");
    const teachOpen = !document.getElementById("teachModeOverlay").classList.contains("hidden");
    if (window.innerWidth >= 1280 && drawer && !drawer.classList.contains("hidden")) {
      drawer.classList.add("hidden");
      if (!teachOpen) document.body.style.overflow = "";
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const teachOpen = !document.getElementById("teachModeOverlay").classList.contains("hidden");
    if (teachOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        exitTeachMode();
      } else if (e.key === "ArrowRight" || (e.key === " " && e.target.tagName !== "BUTTON")) {
        e.preventDefault();
        nextTeachStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevTeachStep();
      }
      return;
    }

    const mobileDrawer = document.getElementById("mobilePlanDrawer");
    if (e.key === "Escape" && mobileDrawer && !mobileDrawer.classList.contains("hidden")) {
      toggleLessonPlanner(false);
      return;
    }

    const inputModalOpen = !document.getElementById("universalInputModal")?.classList.contains("hidden");
    const anyDialogOpen = Boolean(document.querySelector("dialog[open]"));
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);

    if (e.key === "Escape" && isTyping) {
      e.target.blur();
      return;
    }
    if (inputModalOpen || anyDialogOpen) return;

    if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) && !isTyping) {
      e.preventDefault();
      searchInput.focus();
      return;
    }
    if (e.key.toLowerCase() === "l" && !isTyping) {
      e.preventDefault();
      toggleLessonPlanner();
      return;
    }
    if (e.key.toLowerCase() === "r" && !isTyping) {
      e.preventDefault();
      openRouletteModal();
    }
  });
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
}

async function copyToClipboard(text, toastLabel = "Copied!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(toastLabel, "check-circle");
  } catch (err) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast(toastLabel, "check-circle");
  }
}

function showToast(message, iconName = "check-circle") {
  const toast = document.getElementById("toast");
  const wrap = document.getElementById("toastIconWrap");
  document.getElementById("toastMsg").textContent = message;
  const isInfo = iconName === "info" || iconName === "trash-2";
  if (wrap) {
    wrap.innerHTML = `<i data-lucide="${escapeHtml(iconName)}" class="w-4 h-4 ${isInfo ? "text-engOrange" : "text-engGreen"}"></i>`;
  }
  safeLucideIcons();

  toast.classList.remove("hidden");
  clearTimeout(AppState.toastTimeout);
  AppState.toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2400);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsAttr(str) {
  return String(str ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

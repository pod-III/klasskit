let quill;
let dataBase;

const COURSE_LIST = [
  "Early Years",
  "Primary",
  "Pre-Teens",
  "Teens",
];

const CANONICAL_STAGE_BY_LOWER = {
  "early years": "Early Years",
  "primary": "Primary",
  "pre-teens": "Pre-Teens",
  "teens": "Teens",
};

// Non-plaintext FNV-1a hashes for legacy saved records and banner/header detection
const LEGACY_STAGE_HASHES = {
  "03cea0e8": "Primary",
  "03148c4d": "Early Years",
  "5af712a2": "Early Years",
  "b7ef301a": "Pre-Teens",
  "4667f221": "Pre-Teens",
  "2f2a1932": "Teens",
};

function hashStageToken(str) {
  const s = String(str || "").toLowerCase().replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function normalizeCourseName(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (CANONICAL_STAGE_BY_LOWER[lower]) return CANONICAL_STAGE_BY_LOWER[lower];
  const mapped = LEGACY_STAGE_HASHES[hashStageToken(lower)];
  if (mapped) return mapped;
  return trimmed;
}

function emptyOverview() {
  return {
    lang: [],
    recycledLang: [],
    gram: [],
    recycledGram: [],
    phonics: [],
    hfw: [],
    materials: [],
    tips: [],
  };
}

function toStringArray(val) {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v || "").trim()).filter(Boolean);
}

function normalizeOverview(ov) {
  const src = ov && typeof ov === "object" ? ov : {};
  return {
    lang: toStringArray(src.lang),
    recycledLang: toStringArray(src.recycledLang),
    gram: toStringArray(src.gram),
    recycledGram: toStringArray(src.recycledGram),
    phonics: toStringArray(src.phonics),
    hfw: toStringArray(src.hfw),
    materials: toStringArray(src.materials),
    tips: toStringArray(src.tips),
  };
}

function normalizePresentations(pres) {
  const out = {};
  if (!pres || typeof pres !== "object") return out;
  Object.keys(pres).forEach((k) => {
    const arr = Array.isArray(pres[k]) ? pres[k].map((s) => String(s).trim()).filter(Boolean) : [];
    out[String(k)] = arr;
  });
  return out;
}

function normalizeModule(m) {
  const src = m && typeof m === "object" ? m : {};
  const d = src.data && typeof src.data === "object" ? src.data : {};
  return {
    title: String(src.title || "Untitled Module"),
    duration: String(src.duration || ""),
    isReview: Boolean(src.isReview),
    data: {
      lang: toStringArray(d.lang),
      recycledLang: toStringArray(d.recycledLang),
      phonics: toStringArray(d.phonics),
      hfw: toStringArray(d.hfw),
      gram: toStringArray(d.gram),
      recycledGram: toStringArray(d.recycledGram),
      skill: toStringArray(d.skill),
      materials: toStringArray(d.materials),
      prep: toStringArray(d.prep),
      will: toStringArray(d.will),
      presentations: normalizePresentations(d.presentations),
      pages: toStringArray(d.pages),
    },
  };
}

function serializeCloudResult(result) {
  const r = result && typeof result === "object" ? result : {};
  return {
    v: 2,
    course: normalizeCourseName(r.course),
    lessonAims: String(r.lessonAims || ""),
    overview: normalizeOverview(r.overview),
    items: (Array.isArray(r.modules) ? r.modules : []).map(normalizeModule),
  };
}

function deserializeCloudResult(rawModules) {
  if (Array.isArray(rawModules)) {
    return {
      course: "",
      lessonAims: "",
      overview: emptyOverview(),
      modules: rawModules.map(normalizeModule),
    };
  }
  if (rawModules && typeof rawModules === "object" && Array.isArray(rawModules.items)) {
    return {
      course: normalizeCourseName(rawModules.course),
      lessonAims: String(rawModules.lessonAims || ""),
      overview: normalizeOverview(rawModules.overview),
      modules: rawModules.items.map(normalizeModule),
    };
  }
  return {
    course: "",
    lessonAims: "",
    overview: emptyOverview(),
    modules: [],
  };
}

function deserializeModuleRow(row) {
  const src = row && typeof row === "object" ? row : {};
  return normalizeModule({
    title: src.title,
    duration: src.duration,
    isReview: src.is_review ?? src.isReview,
    data: {
      lang: src.lang,
      recycledLang: src.recycled_lang ?? src.recycledLang,
      phonics: src.phonics,
      hfw: src.hfw,
      gram: src.gram,
      recycledGram: src.recycled_gram ?? src.recycledGram,
      skill: src.skill,
      materials: src.materials,
      prep: src.prep,
      will: src.will,
      presentations: src.presentations,
      pages: src.pages,
    },
  });
}

function hydrateCloudLessonRow(row, localCached = null) {
  const modRows = Array.isArray(row?.workshop_lessonparser_modules)
    ? row.workshop_lessonparser_modules
        .slice()
        .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    : [];
  const modules = modRows.map(deserializeModuleRow);

  return {
    id: row.local_id,
    name: row.name,
    course: normalizeCourseName(row.course),
    unitAims: row.unit_aims || "",
    lessonAims: row.lesson_aims || "",
    overview: normalizeOverview(row.overview),
    modules,
    moduleCount: typeof row.module_count === "number" ? row.module_count : modules.length,
    rawText: localCached ? (localCached.rawText || "") : "", // Local-only cache
    lastUsed: new Date(row.last_used || Date.now()).getTime(),
    createdAt: new Date(row.created_at || Date.now()).getTime(),
    usageCount: row.usage_count || 1,
    _hydrated: true,
  };
}

const appState = {
  activeId: null, // null means unsaved scratchpad
  current: {
    title: "",
    course: "",
    aims: "",
    lessonAims: "",
    overview: emptyOverview(),
    modules: [],
    rawText: "", // LOCAL-ONLY (never synced to Supabase)
  },
  library: [],
};

const UI_PREFS_KEY = "lp_ui_prefs";
let uiPrefs = {
  inputMode: "pdf",
  cardLayout: "grid",
  focusMode: false,
  metaCollapsed: false,
};
let activeLibraryCourseFilter = "";
let allOutcomesExpanded = false;

function loadUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      uiPrefs = {
        inputMode: parsed.inputMode === "paste" ? "paste" : "pdf",
        cardLayout: parsed.cardLayout === "list" ? "list" : "grid",
        focusMode: Boolean(parsed.focusMode),
        metaCollapsed: Boolean(parsed.metaCollapsed),
      };
    }
  } catch (e) {
    console.warn("Could not load UI prefs", e);
  }
}

function saveUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
  } catch (e) {
    console.warn("Could not save UI prefs", e);
  }
}

function applyUiPrefs() {
  switchInputMode(uiPrefs.inputMode, false, false);
  applyCardLayoutClass();
  applyFocusModeState();
  applyMetadataCardState();
}

// ── Initialization ────────────────────────────────────────────────────────────
async function bootLessonParser() {
  if (window.__lpBooted) return;
  window.__lpBooted = true;

  if (window.__lpAuthPromise) await window.__lpAuthPromise;
  else if (typeof requirePro === "function") await requirePro();

  if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  loadUiPrefs();
  initQuill();
  setupPdfDropzone();
  setupKeyboardShortcuts();
  applyUiPrefs();
  await initDB();
  await initializeData();
  if (window.lucide) lucide.createIcons();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLessonParser, { once: true });
  } else {
    bootLessonParser();
  }
}

function setupKeyboardShortcuts() {
  const saveInput = document.getElementById("set-name-input");
  if (saveInput) {
    saveInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmSaveSet();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const confirmModal = document.getElementById("confirm-modal");
    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      document.getElementById("confirm-cancel")?.click();
      return;
    }
    const saveModal = document.getElementById("save-modal");
    if (saveModal && !saveModal.classList.contains("hidden")) {
      closeSaveModal();
      return;
    }
    const drawer = document.getElementById("library-drawer");
    if (drawer && !drawer.classList.contains("-translate-x-full")) {
      toggleLibrary();
    }
  });
}

function updateSyncStatus(state, labelText) {
  const indicator = document.getElementById("save-status-indicator");
  const label = document.getElementById("sync-status-label");
  if (indicator) {
    indicator.classList.remove("bg-orange-400", "bg-green-500", "bg-red-500", "bg-blue-500", "animate-pulse");
    if (state === "synced") indicator.classList.add("bg-green-500");
    else if (state === "saving") indicator.classList.add("bg-blue-500", "animate-pulse");
    else if (state === "error") indicator.classList.add("bg-red-500");
    else indicator.classList.add("bg-orange-400");
  }
  if (label && labelText !== undefined) {
    label.innerText = labelText;
  }
}

function getAllLocalSets() {
  return new Promise((res) => {
    if (!dataBase) return res([]);
    const tx = dataBase.transaction("library", "readonly");
    const req = tx.objectStore("library").getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}

function getLocalSet(id) {
  return new Promise((res) => {
    if (!dataBase || id === null || id === undefined) return res(null);
    const tx = dataBase.transaction("library", "readonly");
    const req = tx.objectStore("library").get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => res(null);
  });
}

function putLocalSets(sets) {
  return new Promise((res) => {
    if (!dataBase || !Array.isArray(sets) || !sets.length) return res();
    const tx = dataBase.transaction("library", "readwrite");
    const store = tx.objectStore("library");
    sets.forEach((s) => store.put(s));
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

function putLocalSet(set) {
  return set ? putLocalSets([set]) : Promise.resolve();
}

function deleteLocalSets(ids) {
  return new Promise((res) => {
    if (!dataBase || !Array.isArray(ids) || !ids.length) return res();
    const tx = dataBase.transaction("library", "readwrite");
    const store = tx.objectStore("library");
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

async function getAuthenticatedCloudUser() {
  if (typeof getCloudUser === "function") return await getCloudUser();
  if (typeof isSandbox === "function" && isSandbox()) return null;
  const user = typeof getUser === "function" ? await getUser() : null;
  return user && !user.is_sandbox ? user : null;
}

async function fetchCloudLessonFull(userId, localId) {
  const { data, error } = await db
    .from("workshop_lessonparser")
    .select(
      "id, local_id, name, course, unit_aims, lesson_aims, overview, module_count, last_used, created_at, usage_count, active_set_id, workshop_lessonparser_modules(position, title, duration, is_review, lang, recycled_lang, phonics, hfw, gram, recycled_gram, skill, materials, prep, will, presentations, pages)"
    )
    .eq("user_id", userId)
    .eq("local_id", localId)
    .order("position", { referencedTable: "workshop_lessonparser_modules", ascending: true })
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function persistSessionLocalSnapshot(lastSavedOverride = null) {
  const snapshot = {
    title: appState.current.title,
    course: appState.current.course,
    aims: appState.current.aims,
    lessonAims: appState.current.lessonAims,
    overview: appState.current.overview,
    modules: appState.current.modules,
  };

  localStorage.setItem(
    "lp_session",
    JSON.stringify({
      activeId: appState.activeId,
      lastSaved: lastSavedOverride ?? Date.now(),
      data: snapshot,
    }),
  );
}

async function initializeData() {
  // 1. Paint immediately from local IndexedDB + localStorage snapshot
  const existingLocal = await getAllLocalSets();
  const localById = new Map(existingLocal.map((s) => [s.id, s]));
  appState.library = existingLocal.filter((s) => s && s.id !== 0);

  let hasLocalSession = false;
  let localTime = 0;
  const localRaw = localStorage.getItem("lp_session");
  if (localRaw) {
    try {
      const session = JSON.parse(localRaw);
      const sData = session.data || {};
      hasLocalSession = true;
      localTime = session.lastSaved || 0;
      appState.current = {
        ...appState.current,
        title: sData.title ?? appState.current.title,
        course: normalizeCourseName(sData.course ?? appState.current.course),
        aims: sData.aims ?? appState.current.aims,
        lessonAims: sData.lessonAims ?? appState.current.lessonAims,
        overview: normalizeOverview(sData.overview || appState.current.overview),
        modules: Array.isArray(sData.modules)
          ? sData.modules.map(normalizeModule)
          : appState.current.modules,
      };
      appState.activeId = session.activeId ?? null;
      if (appState.activeId && localById.has(appState.activeId)) {
        appState.current.rawText = localById.get(appState.activeId).rawText || "";
      }
    } catch (e) {
      console.warn("Local session parse failed", e);
    }
  }

  updateUIFromState();
  renderLibrary();

  // 2. Sync lightweight metadata from Supabase & lazy-hydrate only if cloud is newer
  try {
    const user = await getAuthenticatedCloudUser();
    if (!user || typeof db === "undefined") {
      updateSyncStatus("local", "Local Only");
      return;
    }

    const { data, error } = await db
      .from("workshop_lessonparser")
      .select("id, local_id, name, course, module_count, last_used, created_at, usage_count, active_set_id")
      .eq("user_id", user.id)
      .order("last_used", { ascending: false });

    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") {
        console.warn("[LessonParser] Schema missing Phase 5 columns:", error.message);
        updateSyncStatus("local", "Migration Needed");
        showToast("Run phase5_lesson_parser_normalization.sql in Supabase", "warn");
        return;
      }
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const sessionRow = rows.find((row) => row.local_id === 0);
    const libraryRows = rows.filter((row) => row.local_id !== 0);

    const cloudIds = new Set();
    const libraryById = new Map();
    const cloudLibrary = libraryRows.map((row) => {
      cloudIds.add(row.local_id);
      const localCached = localById.get(row.local_id);
      const cloudLastUsed = new Date(row.last_used || Date.now()).getTime();
      const cloudCreatedAt = new Date(row.created_at || Date.now()).getTime();
      const hasFreshLocal = Boolean(
        localCached &&
        localCached._hydrated !== false &&
        Array.isArray(localCached.modules) &&
        (localCached.lastUsed || 0) >= cloudLastUsed
      );

      const entry = hasFreshLocal
        ? {
            ...localCached,
            id: row.local_id,
            name: row.name,
            course: normalizeCourseName(row.course),
            moduleCount:
              typeof row.module_count === "number"
                ? row.module_count
                : localCached.modules.length,
            lastUsed: cloudLastUsed,
            createdAt: cloudCreatedAt,
            usageCount: row.usage_count || 1,
            _hydrated: true,
          }
        : {
            id: row.local_id,
            name: row.name,
            course: normalizeCourseName(row.course),
            unitAims: "",
            lessonAims: "",
            overview: emptyOverview(),
            modules: [],
            moduleCount: typeof row.module_count === "number" ? row.module_count : 0,
            rawText: localCached ? (localCached.rawText || "") : "", // Local-only cache
            lastUsed: cloudLastUsed,
            createdAt: cloudCreatedAt,
            usageCount: row.usage_count || 1,
            _hydrated: false,
          };

      libraryById.set(entry.id, entry);
      return entry;
    });

    const removedIds = existingLocal
      .filter((s) => s && s.id !== 0 && !cloudIds.has(s.id))
      .map((s) => s.id);
    if (removedIds.length > 0) await deleteLocalSets(removedIds);
    await putLocalSets(cloudLibrary);
    appState.library = cloudLibrary;
    renderLibrary();

    const rawCloudActiveId = sessionRow?.active_set_id ?? null;
    const cloudActiveId =
      rawCloudActiveId && libraryById.has(rawCloudActiveId) ? rawCloudActiveId : null;
    const cloudTime = new Date(sessionRow?.last_used || 0).getTime();
    const activeMeta = cloudActiveId ? libraryById.get(cloudActiveId) : sessionRow;
    const expectedModCount = activeMeta?.module_count ?? activeMeta?.moduleCount ?? 0;

    const shouldLoadFromCloud =
      Boolean(sessionRow) &&
      (!hasLocalSession ||
        cloudTime > localTime ||
        ((appState.current.modules || []).length === 0 && expectedModCount > 0));

    if (shouldLoadFromCloud) {
      const targetLocalId = cloudActiveId || 0;
      const localCandidate = targetLocalId !== 0 ? libraryById.get(targetLocalId) : null;
      let hydratedSet =
        localCandidate && localCandidate._hydrated === true ? localCandidate : null;

      if (!hydratedSet) {
        const fullRow = await fetchCloudLessonFull(user.id, targetLocalId);
        if (fullRow) {
          hydratedSet = hydrateCloudLessonRow(fullRow, localById.get(targetLocalId));
          if (targetLocalId !== 0) {
            libraryById.set(targetLocalId, hydratedSet);
            appState.library = Array.from(libraryById.values());
            await putLocalSet(hydratedSet);
          }
        }
      }

      if (hydratedSet) {
        appState.activeId = cloudActiveId;
        appState.current = {
          title: targetLocalId === 0 && hydratedSet.name === "Session" ? "" : (hydratedSet.name || ""),
          course: hydratedSet.course || "",
          aims: hydratedSet.unitAims || "",
          lessonAims: hydratedSet.lessonAims || "",
          overview: normalizeOverview(hydratedSet.overview),
          modules: Array.isArray(hydratedSet.modules) ? hydratedSet.modules : [],
          rawText:
            hydratedSet.rawText ||
            (cloudActiveId && localById.get(cloudActiveId)
              ? localById.get(cloudActiveId).rawText || ""
              : ""),
        };
        persistSessionLocalSnapshot(cloudTime || Date.now());
        updateUIFromState();
        renderLibrary();
      } else if (!hasLocalSession) {
        appState.activeId = cloudActiveId;
        updateActiveIndicator();
      }
    } else if (appState.activeId && !libraryById.has(appState.activeId)) {
      appState.activeId = null;
      updateActiveIndicator();
    }

    updateSyncStatus("synced", "Cloud Synced");
  } catch (e) {
    console.warn("Cloud data load failed", e);
    updateSyncStatus("local", "Local Cache");
  }
}

function updateUIFromState() {
  const data = appState.current;
  const titleInput = document.getElementById("unit-title-input");
  const courseSelect = document.getElementById("unit-course-select");
  const aimsInput = document.getElementById("unit-aims-input");
  const lessonAimsInput = document.getElementById("lesson-aims-input");
  const lessonAimsGroup = document.getElementById("lesson-aims-group");
  const docTitle = document.getElementById("doc-title");

  const stage = normalizeCourseName(data.course);

  if (titleInput) titleInput.value = data.title || "";
  if (courseSelect) courseSelect.value = stage;
  if (aimsInput) aimsInput.value = data.aims || "";
  if (lessonAimsInput) lessonAimsInput.value = data.lessonAims || "";
  if (docTitle) docTitle.innerText = data.title || "No Unit Loaded";

  const tabCount = document.getElementById("tab-modules-count");
  if (tabCount) tabCount.innerText = String((data.modules || []).length);

  if (lessonAimsGroup) {
    const showLessonAims =
      Boolean(data.lessonAims && data.lessonAims.trim()) ||
      stage === "Early Years" ||
      stage === "Pre-Teens";
    lessonAimsGroup.classList.toggle("hidden", !showLessonAims);
    lessonAimsGroup.classList.toggle("flex", showLessonAims);
  }

  updateCourseBadge(stage);

  if (quill) {
    const val = data.rawText || "";
    if (!val) {
      quill.setText("");
    } else if (val.trim().startsWith("<")) {
      quill.root.innerHTML = val;
    } else {
      quill.setText(val);
    }
  }

  renderModules(data.modules || []);
  renderOverview(data.modules || []);
  updateActiveIndicator();
  updateLibraryCountBadge();
}

function updateCourseBadge(course) {
  const badge = document.getElementById("course-badge");
  if (!badge) return;
  const stage = normalizeCourseName(course);
  if (!stage) {
    badge.classList.add("hidden");
    badge.innerText = "";
    return;
  }
  const colorMap = {
    "Early Years": "bg-orange text-white",
    "Primary": "bg-pink text-white",
    "Pre-Teens": "bg-green text-white",
    "Teens": "bg-purple text-white",
  };
  badge.className = `px-3 py-1 font-heading font-bold text-xs uppercase border-2 border-dark dark:border-slate-500 rounded-xl shadow-hard-sm rotate-2 ${colorMap[stage] || "bg-slate-200 dark:bg-slate-800 text-dark dark:text-white"}`;
  badge.innerText = stage;
}

function updateActiveIndicator() {
  const nameEl = document.getElementById("current-set-name");
  if (!nameEl) return;

  if (appState.activeId) {
    const set = appState.library.find((s) => s.id === appState.activeId);
    nameEl.innerText = `Editing: ${set ? set.name : "Saved Lesson"}`;
  } else {
    nameEl.innerText = "Unsaved Session";
  }
}

function updateLibraryCountBadge() {
  const el = document.getElementById("library-count-badge");
  if (!el) return;
  const count = (appState.library || []).filter((s) => s && s.id !== 0).length;
  el.innerText = String(count);
}

function initQuill() {
  quill = new Quill("#editor-container", {
    theme: "snow",
    placeholder: "Paste Teacher Notes text here, then click Extract...",
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["clean"],
      ],
    },
  });
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
function toggleDark() {
  document.documentElement.classList.toggle("dark");
  const dark = document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = "LessonExtractorDB_v3";
async function initDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => rej("DB Error");
    req.onsuccess = (e) => {
      dataBase = e.target.result;
      res(dataBase);
    };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("library"))
        d.createObjectStore("library", { keyPath: "id", autoIncrement: true });
    };
  });
}

// ── Persistence & Cloud Sync (Result-Only, NO raw_text on cloud) ─────────────
function buildCloudPayloadRows(userId, library, activeId, current) {
  const rows = (library || [])
    .filter((set) => set && set.id && set.id !== 0)
    .map((set) => ({
      user_id: userId,
      local_id: set.id,
      name: set.name || "Untitled Lesson",
      unit_aims: set.unitAims || "",
      modules: serializeCloudResult({
        course: set.course || "",
        lessonAims: set.lessonAims || "",
        overview: set.overview,
        modules: set.modules || [],
      }),
      last_used: new Date(set.lastUsed || Date.now()).toISOString(),
      usage_count: set.usageCount || 1,
    }));

  rows.push({
    user_id: userId,
    local_id: 0,
    name: current.title || "Session",
    unit_aims: current.aims || "",
    modules: serializeCloudResult({
      course: current.course || "",
      lessonAims: current.lessonAims || "",
      overview: current.overview,
      modules: current.modules || [],
    }),
    last_used: new Date().toISOString(),
    usage_count: 1,
    active_set_id: activeId || null,
  });

  return rows;
}

let cloudSyncTimeout;
let _pendingModulesDirty = false;
let _syncVersion = 0;

function updateSessionPersistence(options = {}) {
  const { modulesDirty = false, immediate = false } = options;
  const titleEl = document.getElementById("unit-title-input");
  const courseEl = document.getElementById("unit-course-select");
  const aimsEl = document.getElementById("unit-aims-input");
  const lessonAimsEl = document.getElementById("lesson-aims-input");

  appState.current = {
    title: titleEl ? titleEl.value : appState.current.title,
    course: normalizeCourseName(courseEl ? courseEl.value : appState.current.course),
    aims: aimsEl ? aimsEl.value : appState.current.aims,
    lessonAims: lessonAimsEl ? lessonAimsEl.value : appState.current.lessonAims,
    overview: normalizeOverview(appState.current.overview),
    rawText: quill ? quill.getText() : (appState.current.rawText || ""),
    modules: appState.current.modules || [],
  };

  // Persist parsed result locally in localStorage (Rule #7) without bulky rawText
  persistSessionLocalSnapshot();

  if (appState.activeId) {
    autoSaveToLibrary();
  }

  if (modulesDirty) _pendingModulesDirty = true;
  _syncVersion++;
  updateSyncStatus("saving", "Syncing...");
  syncToCloud(immediate);
}

function syncToCloud(immediate = false) {
  clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(async () => {
    const versionAtStart = _syncVersion;
    const sendModules = _pendingModulesDirty;
    _pendingModulesDirty = false;

    try {
      const user = await getAuthenticatedCloudUser();
      if (!user || typeof db === "undefined") {
        _pendingModulesDirty = _pendingModulesDirty || sendModules;
        updateSyncStatus("local", "Local Only");
        return;
      }

      const activeSet = appState.activeId
        ? appState.library.find((s) => s.id === appState.activeId)
        : null;
      const isSavedSet = Boolean(appState.activeId);

      // NOTE: raw_text is intentionally NEVER sent to Supabase
      const { error } = await db.rpc("lp_save_lesson", {
        p_local_id: isSavedSet ? appState.activeId : 0,
        p_name: isSavedSet
          ? (appState.current.title || "Untitled Lesson")
          : (appState.current.title || "Session"),
        p_course: normalizeCourseName(appState.current.course),
        p_unit_aims: appState.current.aims || "",
        p_lesson_aims: appState.current.lessonAims || "",
        p_overview: normalizeOverview(appState.current.overview),
        p_modules: sendModules
          ? (appState.current.modules || []).map(normalizeModule)
          : null,
        p_last_used: new Date().toISOString(),
        p_usage_count: isSavedSet ? (activeSet?.usageCount || 1) : 1,
        p_active_set_id: isSavedSet ? appState.activeId : null,
        p_update_session_pointer: isSavedSet,
      });

      if (error) {
        _pendingModulesDirty = _pendingModulesDirty || sendModules;
        console.error("[Sync] Cloud sync error:", error);
        updateSyncStatus("error", "Sync Failed");
        showToast("Sync failed - check connection", "error");
        return;
      }

      if (_syncVersion === versionAtStart) {
        updateSyncStatus("synced", "Cloud Synced");
      }
    } catch (err) {
      _pendingModulesDirty = _pendingModulesDirty || sendModules;
      console.error("[Sync] Cloud exception:", err);
      updateSyncStatus("error", "Sync Error");
    }
  }, immediate ? 0 : 1500);
}

async function autoSaveToLibrary() {
  if (!appState.activeId || !dataBase) return;

  const updatedFields = {
    name: appState.current.title || "Untitled Lesson",
    course: normalizeCourseName(appState.current.course),
    unitAims: appState.current.aims || "",
    lessonAims: appState.current.lessonAims || "",
    overview: normalizeOverview(appState.current.overview),
    modules: appState.current.modules || [],
    moduleCount: (appState.current.modules || []).length,
    rawText: appState.current.rawText || "", // Local IndexedDB cache only
    lastUsed: Date.now(),
    _hydrated: true,
  };

  const idx = appState.library.findIndex((s) => s.id === appState.activeId);
  if (idx !== -1) {
    appState.library[idx] = { ...appState.library[idx], ...updatedFields };
  }

  const tx = dataBase.transaction("library", "readwrite");
  const store = tx.objectStore("library");
  const req = store.get(appState.activeId);
  req.onsuccess = () => {
    const existing = req.result;
    if (existing) {
      const merged = { ...existing, ...updatedFields };
      store.put(merged);
      const libIdx = appState.library.findIndex((s) => s.id === appState.activeId);
      if (libIdx !== -1) appState.library[libIdx] = { ...merged };
    }
  };
}

async function clearData() {
  const c = await showConfirmModal(
    "Clear Everything?",
    "This will wipe your current session and reset the editor.",
    "Clear",
    "trash-2",
  );
  if (!c) return;

  localStorage.removeItem("lp_session");
  appState.activeId = null;
  appState.current = {
    title: "",
    course: "",
    aims: "",
    lessonAims: "",
    overview: emptyOverview(),
    modules: [],
    rawText: "",
  };

  clearPdfBadge();
  const msInput = document.getElementById("module-search-input");
  if (msInput) msInput.value = "";
  updateUIFromState();
  showToast("Session cleared");
  updateSessionPersistence({ modulesDirty: true, immediate: true });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const iconMap = {
    success: { name: "check-circle", color: "#00d063", cls: "" },
    warn: { name: "alert-triangle", color: "#ff7e33", cls: "toast-warn" },
    error: { name: "x-circle", color: "#ff4785", cls: "toast-error" },
  };
  const cfg = iconMap[type] || iconMap.success;
  const t = document.createElement("div");
  t.className = `toast ${cfg.cls}`;
  t.innerHTML = `<i data-lucide="${cfg.name}" class="w-5 h-5 stroke-[2.5] shrink-0" style="color:${cfg.color};"></i><span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(-16px)";
    setTimeout(() => t.remove(), 350);
  }, 2800);
}

// ── Tabs & Workspace Controls ─────────────────────────────────────────────────
function switchTab(tab) {
  const pasteBtn = document.getElementById("tab-paste");
  const overviewBtn = document.getElementById("tab-overview");

  const activeCls = ["tab-active", "text-white"];
  const inactiveCls = ["bg-slate-50", "dark:bg-slate-800", "text-dark", "dark:text-white"];

  if (pasteBtn) {
    if (tab === "paste") {
      pasteBtn.classList.add("bg-pink", ...activeCls);
      pasteBtn.classList.remove(...inactiveCls);
      pasteBtn.setAttribute("aria-selected", "true");
    } else {
      pasteBtn.classList.remove("bg-pink", ...activeCls);
      pasteBtn.classList.add(...inactiveCls);
      pasteBtn.setAttribute("aria-selected", "false");
    }
  }

  if (overviewBtn) {
    if (tab === "overview") {
      overviewBtn.classList.add("bg-blue", ...activeCls);
      overviewBtn.classList.remove(...inactiveCls);
      overviewBtn.setAttribute("aria-selected", "true");
    } else {
      overviewBtn.classList.remove("bg-blue", ...activeCls);
      overviewBtn.classList.add(...inactiveCls);
      overviewBtn.setAttribute("aria-selected", "false");
    }
  }

  const overviewView = document.getElementById("view-overview");
  const modulesView = document.getElementById("view-modules");
  const searchWrap = document.getElementById("module-search-wrap");
  const layoutBtn = document.getElementById("layout-toggle-btn");
  const willBtn = document.getElementById("toggle-all-will-btn");

  const isOverview = tab === "overview";
  if (overviewView) overviewView.classList.toggle("hidden", !isOverview);
  if (modulesView) modulesView.classList.toggle("hidden", isOverview);
  if (searchWrap) searchWrap.classList.toggle("opacity-40", isOverview);
  if (layoutBtn) layoutBtn.classList.toggle("hidden", isOverview);
  if (willBtn) willBtn.classList.toggle("hidden", isOverview);
}

function switchInputMode(mode, focusEditor = false, persist = true) {
  const isPaste = mode === "paste";
  uiPrefs.inputMode = isPaste ? "paste" : "pdf";
  if (persist) saveUiPrefs();

  const pdfPane = document.getElementById("input-pane-pdf");
  const pastePane = document.getElementById("input-pane-paste");
  const pdfBtn = document.getElementById("input-mode-pdf");
  const pasteBtn = document.getElementById("input-mode-paste");

  if (pdfPane) {
    pdfPane.classList.toggle("hidden", isPaste);
    pdfPane.classList.toggle("flex", !isPaste);
  }
  if (pastePane) {
    pastePane.classList.toggle("hidden", !isPaste);
    pastePane.classList.toggle("flex", isPaste);
  }

  if (pdfBtn) {
    pdfBtn.classList.toggle("bg-blue", !isPaste);
    pdfBtn.classList.toggle("text-white", !isPaste);
    pdfBtn.classList.toggle("bg-white", isPaste);
    pdfBtn.classList.toggle("dark:bg-slate-900", isPaste);
    pdfBtn.classList.toggle("text-dark", isPaste);
    pdfBtn.classList.toggle("dark:text-white", isPaste);
    pdfBtn.setAttribute("aria-selected", String(!isPaste));
  }
  if (pasteBtn) {
    pasteBtn.classList.toggle("bg-orange", isPaste);
    pasteBtn.classList.toggle("text-white", isPaste);
    pasteBtn.classList.toggle("bg-white", !isPaste);
    pasteBtn.classList.toggle("dark:bg-slate-900", !isPaste);
    pasteBtn.classList.toggle("text-dark", !isPaste);
    pasteBtn.classList.toggle("dark:text-white", !isPaste);
    pasteBtn.setAttribute("aria-selected", String(isPaste));
  }

  if (focusEditor && isPaste && quill) {
    quill.focus();
  }
}

async function pasteIntoQuill() {
  if (!quill) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast("Clipboard is empty", "warn");
      return;
    }
    quill.setText(text);
    showToast("Notes pasted into editor");
  } catch (e) {
    quill.focus();
    showToast("Use Ctrl+V / Cmd+V inside editor to paste", "warn");
  }
}

function clearQuillText() {
  if (!quill) return;
  quill.setText("");
  quill.focus();
}

function applyMetadataCardState() {
  const body = document.getElementById("unit-metadata-body");
  const chev = document.getElementById("meta-chevron");
  if (body) body.classList.toggle("hidden", uiPrefs.metaCollapsed);
  if (chev) chev.style.transform = uiPrefs.metaCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
}

function toggleMetadataCard() {
  uiPrefs.metaCollapsed = !uiPrefs.metaCollapsed;
  saveUiPrefs();
  applyMetadataCardState();
}

function applyCardLayoutClass() {
  const container = document.getElementById("modules-container");
  const icon = document.getElementById("layout-toggle-icon");
  const label = document.getElementById("layout-toggle-label");
  const isList = uiPrefs.cardLayout === "list";

  if (container && (appState.current.modules || []).length > 0) {
    container.className = isList
      ? "flex flex-col gap-5"
      : "grid grid-cols-1 xl:grid-cols-2 gap-5 items-start";
  }
  if (icon) icon.setAttribute("data-lucide", isList ? "layout-grid" : "rows-3");
  if (label) label.innerText = isList ? "Grid" : "List";
  if (window.lucide) lucide.createIcons();
}

function toggleCardLayout() {
  uiPrefs.cardLayout = uiPrefs.cardLayout === "grid" ? "list" : "grid";
  saveUiPrefs();
  applyCardLayoutClass();
}

function applyFocusModeState() {
  const sidebar = document.getElementById("input-sidebar");
  const stage = document.getElementById("results-stage");
  const icon = document.getElementById("focus-mode-icon");
  const label = document.getElementById("focus-mode-label");
  const isFocus = uiPrefs.focusMode;

  if (sidebar) sidebar.classList.toggle("hidden", isFocus);
  if (stage) {
    stage.classList.toggle("lg:col-span-8", !isFocus);
    stage.classList.toggle("lg:col-span-12", isFocus);
  }
  if (icon) icon.setAttribute("data-lucide", isFocus ? "panel-left-open" : "panel-left-close");
  if (label) label.innerText = isFocus ? "Show Input" : "Focus";
  if (window.lucide) lucide.createIcons();
}

function toggleFocusMode() {
  uiPrefs.focusMode = !uiPrefs.focusMode;
  saveUiPrefs();
  applyFocusModeState();
}

function toggleAllWill() {
  allOutcomesExpanded = !allOutcomesExpanded;
  const panels = document.querySelectorAll('[id^="will-"]');
  panels.forEach((el) => {
    const idx = el.id.replace("will-", "");
    const chev = document.getElementById(`chev-${idx}`);
    el.classList.toggle("hidden", !allOutcomesExpanded);
    if (chev) chev.style.transform = allOutcomesExpanded ? "rotate(180deg)" : "rotate(0deg)";
  });
}

function filterModules() {
  const input = document.getElementById("module-search-input");
  const container = document.getElementById("modules-container");
  const countBadge = document.getElementById("module-filter-count");
  const clearBtn = document.getElementById("module-search-clear");
  if (!container) return;

  const query = (input ? input.value : "").trim().toLowerCase();
  const cards = container.querySelectorAll("article.module-card");

  const oldEmpty = document.getElementById("filter-empty-state");
  if (oldEmpty) oldEmpty.remove();

  if (clearBtn) clearBtn.classList.toggle("hidden", !query);
  if (!cards.length) {
    if (countBadge) countBadge.classList.add("hidden");
    return;
  }

  let visible = 0;
  cards.forEach((card) => {
    const haystack = card.getAttribute("data-mod-search") || "";
    const match = !query || haystack.includes(query);
    card.classList.toggle("hidden", !match);
    if (match) visible++;
  });

  if (countBadge) {
    countBadge.classList.toggle("hidden", !query);
    countBadge.innerText = `${visible}/${cards.length}`;
  }

  if (query && visible === 0) {
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div id="filter-empty-state" class="col-span-full bg-white/90 dark:bg-slate-900/90 border-4 border-dark dark:border-slate-500 rounded-[2rem] p-8 text-center flex flex-col items-center gap-3 shadow-hard">
        <i data-lucide="search-x" class="w-8 h-8 text-orange"></i>
        <h3 class="font-heading text-lg uppercase">No Modules Match "${escapeHtml(query)}"</h3>
        <button type="button" onclick="clearModuleFilter()" class="btn-chunky px-4 py-2 bg-blue text-white border-3 border-dark dark:border-slate-500 rounded-xl text-xs">
          Reset Filter
        </button>
      </div>`,
    );
    if (window.lucide) lucide.createIcons();
  }
}

function clearModuleFilter() {
  const input = document.getElementById("module-search-input");
  if (input) input.value = "";
  filterModules();
}

async function updateUnitMetadata() {
  const titleInput = document.getElementById("unit-title-input");
  const courseSelect = document.getElementById("unit-course-select");
  const docTitle = document.getElementById("doc-title");
  if (docTitle && titleInput) {
    docTitle.innerText = titleInput.value.trim() || "No Unit Loaded";
  }
  if (courseSelect) {
    const stage = normalizeCourseName(courseSelect.value);
    updateCourseBadge(stage);
    const lessonAimsGroup = document.getElementById("lesson-aims-group");
    const lessonAimsVal = document.getElementById("lesson-aims-input")?.value || "";
    if (lessonAimsGroup) {
      const show =
        Boolean(lessonAimsVal.trim()) ||
        stage === "Early Years" ||
        stage === "Pre-Teens";
      lessonAimsGroup.classList.toggle("hidden", !show);
      lessonAimsGroup.classList.toggle("flex", show);
    }
  }
  updateSessionPersistence({ modulesDirty: false });
  renderOverview(appState.current.modules || []);
}

// ── Direct PDF Upload & Extraction (PDF.js) ───────────────────────────────────
function setupPdfDropzone() {
  const zone = document.getElementById("pdf-dropzone");
  if (!zone) return;

  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerPdfPicker();
    }
  });

  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("drag-over");
    });
  });

  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePdfFile(file);
  });
}

function triggerPdfPicker() {
  const input = document.getElementById("pdf-file-input");
  if (input) input.click();
}

function handlePdfFileSelect(event) {
  const file = event.target?.files?.[0];
  if (file) handlePdfFile(file);
  if (event.target) event.target.value = "";
}

function clearPdfBadge() {
  const badge = document.getElementById("pdf-file-badge");
  const name = document.getElementById("pdf-file-name");
  if (badge) {
    badge.classList.add("hidden");
    badge.classList.remove("flex");
  }
  if (name) name.innerText = "";
}

async function handlePdfFile(file) {
  if (!file || (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf")) {
    showToast("Please choose a PDF file.", "warn");
    return;
  }
  if (!window.pdfjsLib) {
    showToast("PDF reader library failed to load.", "error");
    return;
  }

  const progWrap = document.getElementById("pdf-progress-wrap");
  const progBar = document.getElementById("pdf-progress-bar");
  const progText = document.getElementById("pdf-progress-text");

  if (progWrap) {
    progWrap.classList.remove("hidden");
    progWrap.classList.add("flex");
  }
  if (progBar) progBar.style.width = "10%";
  if (progText) progText.innerText = `Opening ${file.name}...`;

  try {
    const { fullText, boldText, pageCount } = await extractTextFromPdf(file, (pg, total) => {
      const pct = Math.round((pg / total) * 100);
      if (progBar) progBar.style.width = `${pct}%`;
      if (progText) progText.innerText = `Reading page ${pg} of ${total}...`;
    });

    if (quill) {
      quill.setText(fullText);
    }

    const badge = document.getElementById("pdf-file-badge");
    const nameEl = document.getElementById("pdf-file-name");
    if (badge && nameEl) {
      nameEl.innerText = `${file.name} (${pageCount} page${pageCount !== 1 ? "s" : ""})`;
      badge.classList.remove("hidden");
      badge.classList.add("flex");
    }

    runExtraction(fullText, boldText, { replaceMetaIfEmptyOrNew: true });
  } catch (err) {
    console.error("PDF parse error:", err);
    showToast("Could not read PDF text layer.", "error");
  } finally {
    if (progWrap) {
      progWrap.classList.add("hidden");
      progWrap.classList.remove("flex");
    }
    if (progBar) progBar.style.width = "0%";
  }
}

function isBoldPdfFont(fontName, styles) {
  const family = (styles && styles[fontName] && styles[fontName].fontFamily) || "";
  return /bold|bd|heavy|black|semibold|demi|700|800|900/i.test(`${fontName || ""} ${family}`);
}

function joinPdfRowItems(items) {
  if (!items || !items.length) return { text: "", bold: "" };
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let bold = "";
  let prevEnd = null;

  for (const item of sorted) {
    const str = item.str;
    if (!str) continue;
    if (prevEnd !== null) {
      const gap = item.x - prevEnd;
      const prevEndsSpace = /\s$/.test(text);
      const currStartsSpace = /^\s/.test(str);
      if (gap > 1.5 && !prevEndsSpace && !currStartsSpace) {
        text += " ";
        bold += " ";
      }
    }
    text += str;
    bold += item.bold ? str : " ".repeat(str.length);
    prevEnd = item.x + (item.w || str.length * 4);
  }

  return { text: text.trimEnd(), bold: bold.slice(0, text.trimEnd().length) };
}

function isRunningHeaderOrFooter(text, y, pageHeight) {
  const t = text.trim();
  if (!t) return true;
  const nearEdge = y > pageHeight - 38 || y < 38;
  if (
    /^[A-Za-z0-9\s.]{2,35}\s*[-\/]\s*Teacher Notes$/i.test(t) ||
    /^Teacher Notes\s+Teacher$/i.test(t) ||
    /^Page\s+\d+\s*\/\s*\d+$/i.test(t) ||
    /^\d{1,2}:\d{2}\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i.test(t)
  ) {
    return true;
  }
  if (nearEdge && /^Teacher Notes$/i.test(t) && t.length < 25) return true;
  return false;
}

async function extractTextFromPdf(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allOutLines = [];
  const allOutBold = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (onProgress) onProgress(pageNum, pdf.numPages);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width || 595;
    const pageHeight = viewport.height || 842;
    const content = await page.getTextContent();
    const styles = content.styles || {};

    const rawItems = [];
    for (const it of content.items) {
      if (!it.str || !it.str.length) continue;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      rawItems.push({
        str: it.str,
        x: tr[4],
        y: tr[5],
        w: it.width || 0,
        bold: isBoldPdfFont(it.fontName, styles),
      });
    }

    // Group items into visual horizontal rows (Y descending, X ascending)
    rawItems.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const item of rawItems) {
      let placed = false;
      for (let i = rows.length - 1; i >= Math.max(0, rows.length - 5); i--) {
        if (Math.abs(rows[i].y - item.y) <= 3.5) {
          rows[i].items.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push({ y: item.y, items: [item] });
      }
    }

    // Reorder 2-column metadata blocks (Left column before Right column)
    const midX = pageWidth * 0.48;
    let inTwoCol = false;
    let leftRows = [];
    let rightRows = [];

    const flushTwoCol = () => {
      if (!leftRows.length && !rightRows.length) return;
      leftRows.forEach((r) => {
        allOutLines.push(r.text);
        allOutBold.push(r.bold);
      });
      rightRows.forEach((r) => {
        allOutLines.push(r.text);
        allOutBold.push(r.bold);
      });
      leftRows = [];
      rightRows = [];
      inTwoCol = false;
    };

    for (const row of rows) {
      const fullJoined = joinPdfRowItems(row.items);
      if (isRunningHeaderOrFooter(fullJoined.text, row.y, pageHeight)) continue;

      const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
      const fullMaxX = sortedItems.length
        ? Math.max(...sortedItems.map((it) => it.x + (it.w || it.str.length * 4)))
        : 0;
      const leftItems = sortedItems.filter((it) => it.x < midX - 6);
      const rightItems = sortedItems.filter((it) => it.x >= midX - 6);

      const leftMaxX = leftItems.length
        ? Math.max(...leftItems.map((it) => it.x + (it.w || it.str.length * 4)))
        : 0;
      const rightMinX = rightItems.length ? Math.min(...rightItems.map((it) => it.x)) : pageWidth;
      const colGap = rightMinX - leftMaxX;

      const hasTwoColSplit =
        leftItems.length > 0 &&
        rightItems.length > 0 &&
        sortedItems[0].x < pageWidth * 0.44 &&
        rightMinX >= pageWidth * 0.45 &&
        colGap >= pageWidth * 0.045;

      const isRightAnchorOnly =
        leftItems.length === 0 &&
        rightItems.length > 0 &&
        rightMinX >= pageWidth * 0.45 &&
        /^(?:Materials|Preparations?):/i.test(fullJoined.text.trim());

      const isModuleOrBodyBreak =
        /\(\s*\d+\s*min\.?\s*\)\s*$/i.test(fullJoined.text.trim()) ||
        /\(\s*\d+\s+minutes?\s*\)\s*$/i.test(fullJoined.text.trim()) ||
        /^(?:Activity Procedure|Expected outcome:|Project Summary|Setting the Context|Greeting the Class|Open (?:the )?(?:Unit )?Presentation)/i.test(
          fullJoined.text.trim(),
        );

      const isWideSingleLine =
        !hasTwoColSplit &&
        !isRightAnchorOnly &&
        leftItems.length > 0 &&
        fullMaxX > midX + 18;

      if (isModuleOrBodyBreak || isWideSingleLine) {
        flushTwoCol();
        allOutLines.push(fullJoined.text);
        allOutBold.push(fullJoined.bold);
        continue;
      }

      if (hasTwoColSplit || isRightAnchorOnly || inTwoCol) {
        if (inTwoCol && leftItems.length > 0 && rightItems.length === 0) {
          const cand = fullJoined.text.trim();
          const hasInThisSectionBullet =
            leftRows.some((r) => /^In\s+this\s+section\b/i.test(r.text.trim())) &&
            leftRows.some((r) => /[.?!]['"”’)]?$/.test(r.text.trim()));
          const hasRightHeaderContent =
            rightRows.some((r) => /^(?:Materials|Preparations?):/i.test(r.text.trim())) &&
            rightRows.length >= 2;
          const isSubHeadingCandidate =
            cand.length >= 3 &&
            cand.length <= 65 &&
            /^[A-Z]/.test(cand) &&
            !cand.includes(":") &&
            !/[.?!]$/.test(cand) &&
            !/^(?:None|Flashcards)$/i.test(cand);
          if (hasInThisSectionBullet && hasRightHeaderContent && isSubHeadingCandidate) {
            flushTwoCol();
            allOutLines.push(fullJoined.text);
            allOutBold.push(fullJoined.bold);
            continue;
          }
        }
        inTwoCol = true;
        if (leftItems.length) {
          const lj = joinPdfRowItems(leftItems);
          if (lj.text.trim()) leftRows.push(lj);
        }
        if (rightItems.length) {
          const rj = joinPdfRowItems(rightItems);
          if (rj.text.trim()) rightRows.push(rj);
        }
        continue;
      }

      allOutLines.push(fullJoined.text);
      allOutBold.push(fullJoined.bold);
    }

    flushTwoCol();
  }

  return {
    fullText: allOutLines.join("\n"),
    boldText: allOutBold.join("\n"),
    pageCount: pdf.numPages,
  };
}

// ── Extraction Trigger ────────────────────────────────────────────────────────
function processPastedText() {
  if (!quill) return;
  const fullText = quill.getText();
  if (!fullText.trim()) {
    showToast("Nothing to extract!", "warn");
    return;
  }

  // Generate parallel bold stream from Quill Delta
  const delta = quill.getContents();
  let boldText = "";
  delta.ops.forEach((op) => {
    const text = op.insert;
    if (typeof text !== "string") return;
    if (op.attributes && op.attributes.bold) {
      boldText += text;
    } else {
      boldText += " ".repeat(text.length);
    }
  });

  runExtraction(fullText, boldText, { replaceMetaIfEmptyOrNew: false });
}

function runExtraction(fullText, boldText, opts = {}) {
  const manualCourse = document.getElementById("unit-course-select")?.value || "";
  const parsed = parseLessonDocument(fullText, boldText, manualCourse);

  const titleEl = document.getElementById("unit-title-input");
  const courseEl = document.getElementById("unit-course-select");
  const aimsEl = document.getElementById("unit-aims-input");
  const lessonAimsEl = document.getElementById("lesson-aims-input");

  const replaceMeta = Boolean(opts.replaceMetaIfEmptyOrNew);

  const finalCourse = normalizeCourseName(manualCourse) || parsed.course || "";
  if (courseEl && finalCourse) courseEl.value = finalCourse;

  const finalTitle =
    (replaceMeta && parsed.title) ||
    (titleEl && titleEl.value.trim()) ||
    parsed.title ||
    "Untitled Unit";
  if (titleEl) titleEl.value = finalTitle;

  const finalAims =
    (replaceMeta && parsed.aims) ||
    (aimsEl && aimsEl.value.trim()) ||
    parsed.aims ||
    "";
  if (aimsEl) aimsEl.value = finalAims;

  const finalLessonAims =
    (replaceMeta && parsed.lessonAims) ||
    (lessonAimsEl && lessonAimsEl.value.trim()) ||
    parsed.lessonAims ||
    "";
  if (lessonAimsEl) lessonAimsEl.value = finalLessonAims;

  appState.current.title = finalTitle;
  appState.current.course = finalCourse;
  appState.current.aims = finalAims;
  appState.current.lessonAims = finalLessonAims;
  appState.current.overview = parsed.overview;
  appState.current.modules = parsed.modules;
  appState.current.rawText = fullText;

  updateUIFromState();
  updateSessionPersistence({ modulesDirty: true });

  const count = parsed.modules.length;
  showToast(
    count > 0
      ? `${count} module${count !== 1 ? "s" : ""} extracted${finalCourse ? ` (${finalCourse})` : ""}!`
      : "No modules matched. Check your Teacher Notes text.",
    count > 0 ? "success" : "warn",
  );
}

// ── Universal 4-Curriculum Parser ─────────────────────────────────────────────

// Preserves 1:1 string length so bold character indices stay perfectly aligned
function normalizeKeepLength(t) {
  return String(t || "")
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .replace(/[•●▪]/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ");
}

function isLineJunk(line) {
  const s = line.trim();
  return (
    !s ||
    /^[A-Za-z0-9\s.]{2,35}\s*[-\/]\s*Teacher Notes$/i.test(s) ||
    /^Teacher Notes\s+Teacher$/i.test(s) ||
    /^Teacher Notes$/i.test(s) ||
    /^Page\s+\d+\s*\/\s*\d+$/i.test(s) ||
    /^\d{1,2}:\d{2}\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i.test(s) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s) ||
    /^https?:\/\//i.test(s)
  );
}

function isFieldNoiseLine(line) {
  const s = line.trim();
  return (
    !s ||
    s.length < 2 ||
    isLineJunk(s) ||
    Boolean(LEGACY_STAGE_HASHES[hashStageToken(s)]) ||
    /^(?:Book|Level)\s+\d+(?:,\s*Unit\s+[^\s,]+)?$/i.test(s)
  );
}

function stripRunningJunkLines(rawFull, rawBold) {
  const lines = rawFull.split("\n");
  const boldLines =
    typeof rawBold === "string" && rawBold.length === rawFull.length
      ? rawBold.split("\n")
      : null;

  const outLines = [];
  const outBold = boldLines ? [] : null;

  for (let i = 0; i < lines.length; i++) {
    if (isLineJunk(lines[i])) continue;
    outLines.push(lines[i]);
    if (boldLines) outBold.push(boldLines[i] || " ".repeat(lines[i].length));
  }

  return {
    lines: outLines,
    boldLines: outBold,
  };
}

function joinWrappedModuleTitles(lines, boldLines) {
  const out = [...lines];
  const outBold = boldLines ? [...boldLines] : null;
  const minEndRe = /\(\s*\d+\s*min\.?\s*\)\s*$/i;

  for (let i = 0; i < out.length; i++) {
    const cur = out[i].trim();
    if (!cur || !minEndRe.test(cur)) continue;
    if (/minutes?\s*\)$/i.test(cur) || /^Extension\s*\(/i.test(cur)) continue;

    // Find previous non-empty line
    let p = i - 1;
    while (p >= 0 && !out[p].trim()) p--;
    if (p < 0) continue;

    const prev = out[p].trim();
    if (prev.length > 130 || isLineJunk(prev)) continue;
    if (
      /^(?:In this section|Target |Vocabulary:|Grammar:|Structures:|Phonics:|Materials:|Preparations?:|Expected outcome:|Project Summary|Activity Procedure)/i.test(
        prev,
      )
    ) {
      continue;
    }

    const prefixBeforeMin = cur.replace(minEndRe, "").trim();
    const isOnlyDuration = prefixBeforeMin.length === 0;
    const startsLower = /^[a-z]/.test(cur);

    // Count unmatched ')' or "'" before duration (e.g. "of Book 4 only) (25min.)" or "Have' (15min.)")
    const openParens = (prefixBeforeMin.match(/\(/g) || []).length;
    const closeParens = (prefixBeforeMin.match(/\)/g) || []).length;
    const unmatchedParen = closeParens > openParens;
    const unmatchedQuote =
      ((prev.match(/'/g) || []).length + (prefixBeforeMin.match(/'/g) || []).length) % 2 === 0 &&
      (prev.match(/'/g) || []).length % 2 === 1;

    // Prev line is an unfinished title clause with colon (e.g. "Vocabulary and Grammar: ... of" + "Time (20min.)")
    const prevIncompleteTitle =
      prev.includes(":") &&
      !/[.?!)"”]$/.test(prev) &&
      !prefixBeforeMin.includes(":") &&
      prefixBeforeMin.length < 75;

    // Wrapped second half without ':' right after unfinished title phrase (even if title-cased after "and"/"of")
    const joinedCandidate = `${prev} ${cur}`;
    if (
      joinedCandidate.length <= 165 &&
      (isOnlyDuration || startsLower || unmatchedParen || unmatchedQuote || prevIncompleteTitle)
    ) {
      out[p] = `${out[p].trimEnd()} ${cur}`;
      out[i] = "";
      if (outBold) {
        const pb = (outBold[p] || "").slice(0, out[p].length);
        const cb = (outBold[i] || "").trim();
        outBold[p] = `${pb} ${cb}`.padEnd(out[p].length, " ").slice(0, out[p].length);
        outBold[i] = "";
      }
    }
  }

  return { lines: out.filter((_, idx) => out[idx] !== ""), boldLines: outBold ? outBold.filter((_, idx) => out[idx] !== "") : null };
}

function deinterleaveSpacedTwoColLines(lines, boldLines) {
  const out = [];
  const outBold = boldLines ? [] : null;
  let inTwoCol = false;
  let leftLines = [];
  let leftBold = [];
  let rightLines = [];
  let rightBold = [];

  const flush = () => {
    if (!leftLines.length && !rightLines.length) return;
    leftLines.forEach((l, idx) => {
      out.push(l);
      if (outBold) outBold.push(leftBold[idx]);
    });
    rightLines.forEach((r, idx) => {
      out.push(r);
      if (outBold) outBold.push(rightBold[idx]);
    });
    leftLines = [];
    leftBold = [];
    rightLines = [];
    rightBold = [];
    inTwoCol = false;
  };

  const twoColAnchorRe =
    /^(?:Target\s+(?:Language|Grammar|Vocabulary|Skill)|In\s+this\s+section|Materials:|Preparations?:)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bline = boldLines ? boldLines[i] || " ".repeat(line.length) : "";
    const trimmed = line.trim();

    if (
      /\(\s*\d+\s*min\.?\s*\)\s*$/i.test(trimmed) ||
      /\(\s*\d+\s+minutes?\s*\)\s*$/i.test(trimmed) ||
      /^(?:Activity Procedure|Expected outcome:|Project Summary|Setting the Context|Greeting the Class|Open (?:the )?(?:Unit )?Presentation)/i.test(
        trimmed,
      )
    ) {
      flush();
      out.push(line);
      if (outBold) outBold.push(bline);
      continue;
    }

    // Check for tab or 4+ space column separator in table rows (or 2+ spaces before right-column Materials:/Preparation:)
    const tabSplit = line.match(/^([^\t]*\S[^\t]*)\t+([^\t].*)$/);
    const spaceSplit = !tabSplit
      ? line.match(/^([ \t]*\S.{0,54}?)\s{4,}(\S.*)$/) ||
        line.match(/^([ \t]*\S.{0,54}?)\s{2,}((?:Materials|Preparations?):.*)$/i)
      : null;
    const sepMatch = tabSplit || spaceSplit;

    if (sepMatch) {
      const lPart = sepMatch[1].trim();
      const rPart = sepMatch[2].trim();
      const lIdx = line.indexOf(lPart);
      const rIdx = line.indexOf(rPart, sepMatch[1].length + 2);
      const rPos = rIdx !== -1 ? rIdx : line.lastIndexOf(rPart);
      if (tabSplit || (rPos >= 34 && (inTwoCol || twoColAnchorRe.test(lPart) || twoColAnchorRe.test(rPart)))) {
        inTwoCol = true;
        if (lPart) {
          leftLines.push(lPart);
          if (outBold) leftBold.push(bline.slice(lIdx, lIdx + lPart.length).padEnd(lPart.length, " "));
        }
        if (rPart) {
          rightLines.push(rPart);
          if (outBold) rightBold.push(bline.slice(rPos, rPos + rPart.length).padEnd(rPart.length, " "));
        }
        continue;
      }
    }

    const leading = (line.match(/^\s*/) || [""])[0].length;
    if (!sepMatch && leading >= 34 && /^(?:Materials|Preparations?):/i.test(trimmed)) {
      inTwoCol = true;
      rightLines.push(trimmed);
      if (outBold) rightBold.push(bline.slice(leading, leading + trimmed.length).padEnd(trimmed.length, " "));
      continue;
    }

    if (inTwoCol) {
      if (leading >= 36) {
        rightLines.push(trimmed);
        if (outBold) rightBold.push(bline.slice(leading, leading + trimmed.length).padEnd(trimmed.length, " "));
        continue;
      }
      if (trimmed) {
        const hasInThisSectionBullet =
          leftLines.some((l) => /^In\s+this\s+section\b/i.test(l)) &&
          leftLines.some((l) => /[.?!]['"”’)]?$/.test(l.trim()));
        const hasRightHeaderContent =
          rightLines.some((r) => /^(?:Materials|Preparations?):/i.test(r)) &&
          rightLines.length >= 2;
        const isSubHeadingCandidate =
          trimmed.length >= 3 &&
          trimmed.length <= 65 &&
          /^[A-Z]/.test(trimmed) &&
          !trimmed.includes(":") &&
          !/[.?!]$/.test(trimmed) &&
          !/^(?:None|Flashcards)$/i.test(trimmed);
        if (hasInThisSectionBullet && hasRightHeaderContent && isSubHeadingCandidate) {
          flush();
          out.push(line);
          if (outBold) outBold.push(bline);
          continue;
        }
      }
      if (trimmed && line.length <= 56 && (!/[.?!]$/.test(trimmed) || /^(?:activities|vocabulary|grammar|movies|stories|statements|questions|schedules|plans|information|events|people|routines|roles)\.?$/i.test(trimmed) || trimmed.length <= 45)) {
        leftLines.push(trimmed);
        if (outBold) leftBold.push(bline.slice(leading, leading + trimmed.length).padEnd(trimmed.length, " "));
        continue;
      }
      if (!trimmed) continue;
      flush();
    }

    out.push(line);
    if (outBold) outBold.push(bline);
  }

  flush();
  return { lines: out, boldLines: outBold };
}

function splitInlineAnchors(lines, boldLines) {
  const splitRe =
    /\s{2,}(?=(?:Target\s+(?:Language|Grammar|Vocabulary|Skill)|In\s+this\s+section|Materials:|Preparations?:))/gi;
  const out = [];
  const outBold = boldLines ? [] : null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bline = boldLines ? boldLines[i] || " ".repeat(line.length) : null;
    const parts = [];
    let lastIdx = 0;
    splitRe.lastIndex = 0;
    let m;
    while ((m = splitRe.exec(line)) !== null) {
      if (m.index > 0) {
        parts.push({ start: lastIdx, end: m.index });
        lastIdx = m.index + m[0].length;
      }
    }
    if (parts.length === 0) {
      out.push(line);
      if (outBold) outBold.push(bline);
    } else {
      parts.push({ start: lastIdx, end: line.length });
      parts.forEach((p) => {
        const seg = line.slice(p.start, p.end).trim();
        if (seg) {
          out.push(seg);
          if (outBold) outBold.push(bline.slice(p.start, p.start + seg.length).padEnd(seg.length, " "));
        }
      });
    }
  }

  return { lines: out, boldLines: outBold };
}

function detectStageFromHeaderSample(sample) {
  const found = new Set();
  const segments = String(sample || "").split(/[^A-Za-z0-9.\s]+/);
  for (const seg of segments) {
    const words = seg.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g);
    if (!words || !words.length) continue;
    for (let i = 0; i < words.length; i++) {
      const m1 = LEGACY_STAGE_HASHES[hashStageToken(words[i])];
      if (m1) found.add(m1);
      if (i + 1 < words.length) {
        const m2 = LEGACY_STAGE_HASHES[hashStageToken(`${words[i]} ${words[i + 1]}`)];
        if (m2) found.add(m2);
      }
    }
  }
  for (const stage of ["Primary", "Early Years", "Pre-Teens", "Teens"]) {
    if (found.has(stage)) return stage;
  }
  return "";
}

function detectCourse(topText, rawTopText = "") {
  const sample = String(topText || "").slice(0, 800);
  const fromClean = detectStageFromHeaderSample(sample);
  if (fromClean) return fromClean;

  if (rawTopText) {
    const fromRaw = detectStageFromHeaderSample(String(rawTopText).slice(0, 800));
    if (fromRaw) return fromRaw;
  }

  // Structural fallback when top header banner is absent
  const full = String(topText || "");
  if (
    /\bPresentation:\s*Activity\s+\d+\b/i.test(full) ||
    /(?:^|\n)\s*Lesson\s+Materials\s*(?:\n|$)/i.test(full)
  ) {
    return "Early Years";
  }
  if (/\bUnit\s+presentation\b/i.test(full) || /^\s*Review\s+Section\b/im.test(full)) {
    return "Pre-Teens";
  }
  if (
    /\bLevel\s+\d+,\s*Unit\s+\d+\b/i.test(sample) &&
    /\b(?:High-Frequency\s+Words|Recycled\s+Vocabulary):/i.test(full)
  ) {
    return "Primary";
  }
  if (/\bTarget\s+Skill:/i.test(full) && /\bExpected\s+outcome:/i.test(full)) {
    return "Teens";
  }
  return "";
}

function detectTitle(topText) {
  const sample = topText.slice(0, 900);
  const bookUnit = sample.match(
    /(Book\s+\d+,\s*Unit\s+(?:\d+|[A-Za-z]+)(?:,\s*Lesson\s+\d+)?)/i,
  );
  if (bookUnit) return bookUnit[1].trim();
  const levelUnit = sample.match(/(Level\s+\d+,\s*Unit\s+\d+(?:,\s*Lesson\s+\d+)?)/i);
  if (levelUnit) return levelUnit[1].trim();
  const generic = sample.match(/(Book\s+\d+,\s*Unit\s+\d+)/i);
  if (generic) return generic[1].trim();
  return "";
}

function mergeSentenceLines(lines) {
  const out = [];
  for (const raw of lines) {
    const s = raw.replace(/^[-*]\s*/, "").trim();
    if (!s || isFieldNoiseLine(s)) continue;
    if (!out.length) {
      out.push(s);
      continue;
    }
    const prev = out[out.length - 1];
    const prevEnded =
      /[.?!]['"”’)]?$/.test(prev) && !/(?:e\.g\.|i\.e\.|etc\.|min\.|p\.|pp\.)$/i.test(prev);
    if (!prevEnded || /^[)"”’]/.test(s)) {
      out[out.length - 1] = `${prev} ${s}`;
    } else {
      out.push(s);
    }
  }
  return out;
}

function mergeCategorizedLines(lines) {
  const out = [];
  let activePrefix = "";

  for (const raw of lines) {
    const s = raw.replace(/^[-*]\s*/, "").trim();
    if (!s || isFieldNoiseLine(s)) continue;

    // Bare group header like "Receptive:" or "Productive:"
    if (/^(?:Receptive|Productive|Review Vocabulary|S-Blends|S-Blend Words):\s*$/i.test(s)) {
      activePrefix = s.replace(/:$/, "");
      continue;
    }

    if (activePrefix) {
      if (/^[A-Za-z][^:]{1,40}:\s+\S/.test(s)) {
        activePrefix = "";
      } else {
        const idx = out.findIndex((item) =>
          item.toLowerCase().startsWith(activePrefix.toLowerCase() + ":"),
        );
        if (idx !== -1) {
          out[idx] = `${out[idx]}; ${s}`;
        } else {
          out.push(`${activePrefix}: ${s}`);
        }
        continue;
      }
    }

    if (!out.length) {
      out.push(s);
      continue;
    }

    const prev = out[out.length - 1];
    const isNewCategory = /^[A-Z][A-Za-z0-9\s\-\/'()]{1,42}:\s*\S/.test(s) && !/^\(recycled:/i.test(s);
    const isRecycledTail = /^\(recycled:/i.test(s);
    const prevNeedsCont =
      /[,(\-]$/.test(prev) ||
      /\b(?:and|or|of|to|with|in|the)$/i.test(prev) ||
      /^[a-z')]/.test(s);

    if (isRecycledTail || (!isNewCategory && prevNeedsCont && prev.includes(":"))) {
      out[out.length - 1] = `${prev} ${s}`;
    } else {
      out.push(s);
    }
  }

  return out;
}

function parsePreamble(preamble, course) {
  const ov = emptyOverview();
  let aims = "";
  let lessonAims = "";

  // Unit Aims: "In this unit, the students will ..." OR "At the end of this unit, (the) students will be able to ..."
  const inUnitMatch = preamble.match(
    /In\s+this\s+unit,\s*(?:the\s+)?students\s+will\s*[.…]{0,3}\s*\n([\s\S]+?)(?=\n\s*(?:At\s+the\s+end\s+of\s+this\s+lesson|Tips?\b|Lesson\s+Materials|Target\s+Language)|$)/i,
  );
  const atEndUnitMatch = preamble.match(
    /At\s+the\s+end\s+of\s+this\s+unit,\s*(?:the\s+)?students\s+will\s+be\s+able\s+to\s*[.…]{0,3}\s*\n([\s\S]+?)(?=\n\s*(?:At\s+the\s+end\s+of\s+this\s+lesson|Tips?\b|Tip:|Lesson\s+Materials|Target\s+Language)|$)/i,
  );

  if (inUnitMatch) {
    aims = mergeSentenceLines(inUnitMatch[1].split("\n")).join("\n");
  } else if (atEndUnitMatch) {
    aims = mergeSentenceLines(atEndUnitMatch[1].split("\n")).join("\n");
  }

  // Lesson Aims (lesson-level formats)
  const lessonMatch = preamble.match(
    /At\s+the\s+end\s+of\s+this\s+lesson,\s*(?:the\s+)?students\s+will\s+be\s+able\s+to\s*[.…]{0,3}\s*\n([\s\S]+?)(?=\n\s*(?:Tips?\b|Tip:|Lesson\s+Materials|Target\s+Language)|$)/i,
  );
  if (lessonMatch) {
    lessonAims = mergeSentenceLines(lessonMatch[1].split("\n")).join("\n");
  }

  // Unit Overview Target Language section
  const overviewTargetMatch = preamble.match(/\n\s*Target\s+Language\s*\n([\s\S]+)$/i);
  if (overviewTargetMatch) {
    const tlBlock = overviewTargetMatch[1];
    ov.lang = mergeCategorizedLines(extractAllFields(["Vocabulary:"], tlBlock));
    ov.recycledLang = mergeCategorizedLines(extractAllFields(["Recycled Vocabulary:"], tlBlock));
    ov.gram = mergeGrammarLines(
      extractAllFields(["Grammar/Structures:", "Grammar:", "Structures:"], tlBlock),
    );
    ov.recycledGram = mergeGrammarLines(extractAllFields(["Recycled Grammar:"], tlBlock));
    ov.phonics = mergeSentenceLines(extractAllFields(["Phonics:"], tlBlock));
    ov.hfw = mergeCategorizedLines(extractAllFields(["High-Frequency Words:"], tlBlock));
  }

  // Lesson Materials section
  const lmMatch = preamble.match(
    /\n\s*Lesson\s+Materials\s*\n([\s\S]+?)(?=\n\s*(?:Tips?\b|Target\s+Language)|$)/i,
  );
  if (lmMatch) {
    ov.materials = lmMatch[1]
      .split("\n")
      .map((s) => s.replace(/^[-*]\s*/, "").trim())
      .filter((s) => !isFieldNoiseLine(s));
  }

  // Teaching Tips section
  const tipsMatch = preamble.match(
    /\n\s*(?:Tips|Tip:)\s*([\s\S]+?)(?=\n\s*(?:Lesson\s+Materials|Target\s+Language)|$)/i,
  );
  if (tipsMatch) {
    ov.tips = mergeSentenceLines(tipsMatch[1].split("\n"));
  }

  return { aims, lessonAims, overview: ov, detectedCourse: course };
}

const ANCHOR_SPECS = [
  { key: "In this section", pattern: "In\\s+this\\s+section(?:,\\s*(?:the\\s+)?students\\s+will(?:\\s+be\\s+able\\s+to)?\\s*[.…]{0,3})?" },
  { key: "Target Language:", pattern: "Target\\s+Language:" },
  { key: "Target Vocabulary:", pattern: "Target\\s+Vocabulary:" },
  { key: "Vocabulary:", pattern: "Vocabulary:" },
  { key: "Recycled Vocabulary:", pattern: "Recycled\\s+Vocabulary:" },
  { key: "Phonics:", pattern: "Phonics:" },
  { key: "High-Frequency Words:", pattern: "High-Frequency\\s+Words:" },
  { key: "Target Grammar:", pattern: "Target\\s+Grammar(?::|(?=[ \\t]*(?:\\n|$)))" },
  { key: "Grammar/Structures:", pattern: "Grammar\\/Structures:" },
  { key: "Grammar:", pattern: "Grammar:" },
  { key: "Structures:", pattern: "Structures:" },
  { key: "Recycled Grammar:", pattern: "Recycled\\s+Grammar:" },
  { key: "Target Skill:", pattern: "Target\\s+Skill:" },
  { key: "Materials:", pattern: "Materials:" },
  { key: "Preparation:", pattern: "Preparations?:" },
  { key: "Flashcards", pattern: "Flashcards(?=[ \\t]*(?:\\n|$))" },
];

const ALL_ANCHOR_LOOKAHEAD = ANCHOR_SPECS.map((a) => a.pattern).join("|");

function extractAllFields(targetKeys, textBlock) {
  const results = [];
  const specs = ANCHOR_SPECS.filter((a) => targetKeys.includes(a.key));
  if (!specs.length || !textBlock) return results;

  const targetPat = specs.map((s) => s.pattern).join("|");
  const re = new RegExp(
    `(?:^|\\n)[ \\t]*(?:${targetPat})[ \\t]*([\\s\\S]*?)(?=\\n[ \\t]*(?:${ALL_ANCHOR_LOOKAHEAD})|$)`,
    "gi",
  );

  let m;
  while ((m = re.exec(textBlock)) !== null) {
    const raw = m[1] || "";
    raw.split("\n").forEach((line) => {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      if (!isFieldNoiseLine(cleaned) && !/^[.…]+$/.test(cleaned)) {
        results.push(cleaned);
      }
    });
  }
  return results;
}

const BODY_MARKER_RE = new RegExp(
  "\\n[ \\t]*(?=" +
    [
      "Expected\\s+outcome:",
      "Project\\s+Summary\\b",
      "Activity\\s+Procedure\\b",
      "[A-Z][^\\n]{2,90}\\(\\s*\\d+\\s+minutes?\\s*\\)[ \\t]*(?:\\n|$)",
      "Setting\\s+the\\s+Context\\b",
      "(?:Pre|Post)-?(?:reading|speaking|writing|listening)(?:\\s|:|$)",
      "Vocabulary\\s+Introduction\\b",
      "Grammar\\s+Introduction\\b",
      "Open\\s+(?:the\\s+)?(?:Unit\\s+)?Presentation\\b",
      "Open\\s+the\\s+practice\\b",
      "Display\\s+(?:slide|activity|the\\s+)",
      "Tell\\s+(?:the\\s+)?students\\b",
      "Have\\s+(?:the\\s+)?(?:students|everyone|each|pairs)\\b",
      "Ask\\s+(?:the\\s+)?students\\b",
      "Divide\\s+(?:the\\s+)?class\\b",
      "Distribute\\s+",
      "Show\\s+(?:the\\s+)?(?:students|slide)",
      "Use\\s+(?:slide|Presentation)\\b",
      "Complete\\s+the\\s+[A-Za-z]+\\s+Club\\b",
      "Direct\\s+(?:the\\s+)?students\\b",
      "Write\\s+the\\s+following\\b",
      "Note:",
    ].join("|") +
    ")",
  "i",
);

function findLastHeaderAnchorPos(text) {
  const re = new RegExp(`(?:^|\\n)[ \\t]*(?:${ALL_ANCHOR_LOOKAHEAD})`, "gi");
  let last = -1;
  let m;
  while ((m = re.exec(text)) !== null) last = m.index;
  return last;
}

function splitChunk(chunk) {
  const firstNl = chunk.indexOf("\n");
  if (firstNl === -1) return { header: "", body: "" };

  const afterTitle = chunk.slice(firstNl);
  const lastAnchorRel = findLastHeaderAnchorPos(afterTitle);

  // Routine/Quiz/Test modules without header metadata anchors
  if (lastAnchorRel === -1) {
    return { header: "", body: afterTitle };
  }

  const m = BODY_MARKER_RE.exec(afterTitle);
  if (!m) {
    return { header: afterTitle, body: "" };
  }

  let splitRel = m.index;
  const matchedLine = afterTitle.slice(splitRel).trimStart();
  const isExpectedOutcome = /^Expected\s+outcome:/i.test(matchedLine);

  // Pull back 1 short sub-activity title line (e.g., "Setting the Context", "Talking about Movies", "Plot Summaries")
  const prefix = afterTitle.slice(0, splitRel);
  const pLines = prefix.split("\n");
  let lastNonEmptyIdx = pLines.length - 1;
  while (lastNonEmptyIdx >= 0 && !pLines[lastNonEmptyIdx].trim()) lastNonEmptyIdx--;

  if (lastNonEmptyIdx >= 0) {
    const candidate = pLines[lastNonEmptyIdx].trim();
    const anchorLineRe = new RegExp(`^(?:${ALL_ANCHOR_LOOKAHEAD})`, "i");
    const looksLikeSubHeading =
      candidate.length >= 3 &&
      candidate.length <= 75 &&
      /^[A-Z]/.test(candidate) &&
      !anchorLineRe.test(candidate) &&
      !/^None$/i.test(candidate) &&
      !/[.?!]$/.test(candidate) &&
      !candidate.includes(":");

    if (looksLikeSubHeading && (isExpectedOutcome || splitRel > lastAnchorRel + 4)) {
      const charBeforeLine = pLines.slice(0, lastNonEmptyIdx).join("\n").length;
      if (charBeforeLine > lastAnchorRel) {
        splitRel = charBeforeLine;
      }
    }
  }

  const absSplit = firstNl + splitRel;
  return {
    header: chunk.slice(firstNl, absSplit),
    body: chunk.slice(absSplit),
  };
}

function mergeMaterialsLines(lines) {
  const out = [];
  for (const raw of lines) {
    const s = raw.replace(/^[-*]\s*/, "").trim();
    if (!s || isFieldNoiseLine(s)) continue;
    if (!out.length) {
      out.push(s);
      continue;
    }
    const prev = out[out.length - 1];
    const shouldJoin =
      /[,(\-]$/.test(prev) ||
      /\b(?:and|or|of|for|to|with|the|a|an|each|from)$/i.test(prev) ||
      /^[a-z)(]/.test(s);
    if (shouldJoin) {
      out[out.length - 1] = `${prev} ${s}`;
    } else {
      out.push(s);
    }
  }
  return out;
}

function mergeGrammarLines(lines) {
  const out = [];
  for (const raw of lines) {
    const s = raw.replace(/^[-*]\s*/, "").trim();
    if (!s || isFieldNoiseLine(s)) continue;
    if (!out.length) {
      out.push(s);
      continue;
    }
    const prev = out[out.length - 1];
    const prevEnded =
      /[.?!]['"”’)]?$/.test(prev) && !/(?:e\.g\.|i\.e\.|etc\.|min\.|p\.|pp\.)$/i.test(prev);
    const prevHasConnectorTail =
      /[,(\-]$/.test(prev) ||
      /\b(?:and|or|of|for|to|with|the|a|an|in|on|by)$/i.test(prev);
    const startsContinuation = /^[a-z)]/.test(s);
    if (!prevEnded && (prevHasConnectorTail || startsContinuation)) {
      out[out.length - 1] = `${prev} ${s}`;
    } else {
      out.push(s);
    }
  }
  return out;
}

function expandNums(str) {
  const out = new Set();
  const normalized = String(str || "")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1-$2")
    .replace(/\band\b/gi, ",");

  normalized.split(/[,\s]+/).forEach((p) => {
    const r = p.match(/^(\d+)-(\d+)$/);
    if (r) {
      const lo = +r[1];
      const hi = +r[2];
      if (lo <= hi && hi - lo <= 30) {
        for (let i = lo; i <= hi; i++) out.add(String(i));
      } else {
        out.add(String(lo));
        out.add(String(hi));
      }
    } else if (/^\d+$/.test(p)) {
      out.add(p);
    }
  });
  return [...out].filter(Boolean);
}

function collapseBold(boldChunk) {
  return String(boldChunk || "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokenizeRefs(text) {
  let flat = String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1-$2");

  const tokens = [];
  const maskSpan = (start, len) => {
    flat = flat.slice(0, start) + " ".repeat(len) + flat.slice(start + len);
  };

  let m;

  // 1. Reverse pairs: "slides 12-13 of Presentation 8" or "slide 1 of Presentation 11"
  const rRev =
    /\bslides?\s+(\d+(?:-\d+)?(?:\s*(?:,|and)\s*\d+(?:-\d+)?)*)\s+of\s+Presentation\s+(\d+)\b/gi;
  while ((m = rRev.exec(flat)) !== null) {
    tokens.push({ type: "pres", value: m[2], pos: m.index });
    tokens.push({ type: "paired_slide", presKey: m[2], value: m[1].trim(), pos: m.index + 1 });
    maskSpan(m.index, m[0].length);
  }

  // 2. Unit presentation format: "Unit presentation - 1" / "Unit presentation (Topic) - 4" / "Unit presentation to 6"
  const rUnitPres =
    /\bUnit\s+presentation(?:\s*\([^)]*\))?\s*(?:[-–—:]|\bto\b)\s*(\d+)\b/gi;
  while ((m = rUnitPres.exec(flat)) !== null) {
    tokens.push({ type: "pres", value: m[1], pos: m.index });
    maskSpan(m.index, m[0].length);
  }

  // 3. Activity-based presentation body: "activity 4, slide 1" or "activity 1 of the presentation"
  const rActBody =
    /\bactivity\s+(\d+)\b(?:\s*,\s*slides?\s+(\d+(?:-\d+)?(?:\s*(?:,|and)\s*\d+(?:-\d+)?)*))?(?=\s*,?\s*slides?\s+\d|\s+of\s+(?:the\s+)?presentation)/gi;
  while ((m = rActBody.exec(flat)) !== null) {
    const key = `Act. ${m[1]}`;
    tokens.push({ type: "pres", value: key, pos: m.index });
    if (m[2]) {
      tokens.push({ type: "paired_slide", presKey: key, value: m[2].trim(), pos: m.index + 1 });
    }
    maskSpan(m.index, m[0].length);
  }

  // 4. Activity-based presentation materials: "Presentation: Activity 1"
  const rActMat = /\bPresentation:\s*Activity\s+(\d+)\b/gi;
  while ((m = rActMat.exec(flat)) !== null) {
    tokens.push({ type: "pres", value: `Act. ${m[1]}`, pos: m.index });
    maskSpan(m.index, m[0].length);
  }

  // 5. Numbered presentation format: "Presentation 1"
  const rP = /\bPresentation\s+(\d+)\b/gi;
  while ((m = rP.exec(flat)) !== null) {
    tokens.push({ type: "pres", value: m[1], pos: m.index });
  }

  // 6. Remaining generic slide mentions
  const rS = /\bslides?\s+(\d+(?:-\d+)?(?:\s*(?:,|and)\s*\d+(?:-\d+)?)*)\b/gi;
  while ((m = rS.exec(flat)) !== null) {
    tokens.push({ type: "slide", value: m[1].trim(), pos: m.index });
  }

  // 7. Book pages (avoid matching "p.m." by requiring space or digit)
  const rPg = /\b(?:pages?|pp?\.)\s+(\d+(?:-\d+)?(?:\s*(?:,|and)\s*\d+(?:-\d+)?)*)\b/gi;
  while ((m = rPg.exec(flat)) !== null) {
    tokens.push({ type: "page", value: m[1].trim(), pos: m.index });
  }

  return tokens.sort((a, b) => a.pos - b.pos);
}

function presSortKey(k) {
  const num = parseInt(String(k).replace(/\D+/g, ""), 10);
  const isAct = String(k).startsWith("Act.");
  return (isAct ? 10000 : 0) + (isNaN(num) ? 9999 : num);
}

function buildRefsState(tokens) {
  const pres = {};
  const pages = new Set();
  const presTokens = tokens.filter((t) => t.type === "pres");

  presTokens.forEach((pt) => {
    if (!pres[pt.value]) pres[pt.value] = new Set();
  });

  tokens.forEach((tok) => {
    if (tok.type === "paired_slide") {
      if (!pres[tok.presKey]) pres[tok.presKey] = new Set();
      expandNums(tok.value).forEach((n) => pres[tok.presKey].add(n));
    } else if (tok.type === "slide") {
      if (!presTokens.length) return;
      // Prefer nearest PRECEDING presentation token; fallback to nearest overall
      const preceding = presTokens.filter((pt) => pt.pos <= tok.pos);
      let chosen;
      if (preceding.length) {
        chosen = preceding[preceding.length - 1];
      } else {
        chosen = presTokens[0];
      }
      expandNums(tok.value).forEach((n) => pres[chosen.value].add(n));
    } else if (tok.type === "page") {
      expandNums(tok.value).forEach((n) => {
        if (+n >= 1 && +n <= 999) pages.add(n);
      });
    }
  });

  const finalPres = {};
  Object.keys(pres)
    .sort((a, b) => presSortKey(a) - presSortKey(b))
    .forEach((k) => {
      finalPres[k] = [...pres[k]].sort((a, b) => +a - +b);
    });

  return {
    pres: finalPres,
    pages: [...pages].sort((a, b) => +a - +b),
  };
}

function mergeRefsState(a, b) {
  const presMap = {};
  const addPres = (src) => {
    Object.keys(src || {}).forEach((k) => {
      if (!presMap[k]) presMap[k] = new Set();
      (src[k] || []).forEach((s) => presMap[k].add(String(s)));
    });
  };
  addPres(a?.pres);
  addPres(b?.pres);

  const finalPres = {};
  Object.keys(presMap)
    .sort((x, y) => presSortKey(x) - presSortKey(y))
    .forEach((k) => {
      finalPres[k] = [...presMap[k]].sort((x, y) => +x - +y);
    });

  const pageSet = new Set([...(a?.pages || []), ...(b?.pages || [])]);
  return {
    pres: finalPres,
    pages: [...pageSet].sort((x, y) => +x - +y),
  };
}

function dedupeStrings(arr) {
  const seen = new Set();
  const out = [];
  arr.forEach((item) => {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  });
  return out;
}

function parseReviewSection(fullChunk) {
  const activities = [];
  const actRe = /^(?:Vocabulary|Grammar|Speaking|Reading|Listening|Writing|Phonics):\s+(.+)$/gm;
  let m;
  while ((m = actRe.exec(fullChunk)) !== null) {
    activities.push(m[0].trim());
  }

  // Parse each review sub-activity header independently before deduplicating
  const headerSlices = fullChunk
    .split(/^\s*Activity\s+Procedure\s*$/gim)
    .slice(0, -1)
    .map((part) => {
      const firstHeaderMatch = part.match(
        /(?:^|\n)[ \t]*(?:Target\s+(?:Vocabulary|Language|Grammar)|Materials:|Preparations?:)[\s\S]*$/i,
      );
      return firstHeaderMatch ? firstHeaderMatch[0] : "";
    })
    .filter(Boolean);

  const slicesToParse = headerSlices.length ? headerSlices : [fullChunk];
  const rawLang = [];
  const rawGram = [];
  const rawMats = [];
  const rawPrep = [];

  slicesToParse.forEach((slice) => {
    mergeCategorizedLines(
      extractAllFields(["Target Vocabulary:", "Target Language:"], slice),
    ).forEach((item) => rawLang.push(item));
    mergeGrammarLines(extractAllFields(["Target Grammar:"], slice)).forEach((item) =>
      rawGram.push(item),
    );
    mergeMaterialsLines(extractAllFields(["Materials:"], slice)).forEach((item) =>
      rawMats.push(item),
    );
    mergeSentenceLines(extractAllFields(["Preparation:"], slice)).forEach((item) =>
      rawPrep.push(item),
    );
  });

  const lang = dedupeStrings(rawLang);
  const gram = dedupeStrings(rawGram);
  const mats = dedupeStrings(rawMats);
  const prepFiltered = dedupeStrings(rawPrep).filter((p) => !/^None$/i.test(p));
  const prep = prepFiltered.length ? prepFiltered : ["None"];

  const refs = buildRefsState(tokenizeRefs(fullChunk));

  return normalizeModule({
    title: "Review Section",
    duration: "", // Caller fills duration
    isReview: true,
    data: {
      lang,
      recycledLang: [],
      phonics: [],
      hfw: [],
      gram,
      recycledGram: [],
      skill: [],
      materials: mats.length ? mats : ["Check review activities."],
      prep,
      will: dedupeStrings(activities),
      presentations: refs.pres,
      pages: refs.pages,
    },
  });
}

function parseLessonDocument(rawFull, rawBold = "", forcedCourse = "") {
  const normFull = normalizeKeepLength(rawFull);
  const normBold = rawBold ? normalizeKeepLength(rawBold) : "";

  const stripped = stripRunningJunkLines(normFull, normBold);
  const joined = joinWrappedModuleTitles(stripped.lines, stripped.boldLines);
  const deinterleaved = deinterleaveSpacedTwoColLines(joined.lines, joined.boldLines);
  const split = splitInlineAnchors(deinterleaved.lines, deinterleaved.boldLines);

  const fullText = split.lines.join("\n");
  const boldText = split.boldLines ? split.boldLines.join("\n") : "";
  const boldOK = boldText.length === fullText.length && boldText.length > 0;

  const detectedCourse = normalizeCourseName(forcedCourse) || detectCourse(fullText, normFull);
  const detectedTitle = detectTitle(fullText);

  // Match top-level module headers ending in "(XXmin.)" — never "(X minutes)"
  const MOD_RE = /^[ \t]*([A-Z][^\n]{1,160}?)\s*\(\s*(\d+)\s*min\.?\s*\)\s*$/gm;
  const idx = [];
  let match;
  while ((match = MOD_RE.exec(fullText)) !== null) {
    const title = match[1].trim();
    if (/^Extension$/i.test(title)) continue;
    if (/[.?!]$/.test(title)) continue;
    if (/^(?:Tell|Have|Ask|Give|Allow|Spend|Set|Take)\s+/i.test(title) && !title.includes(":")) {
      continue;
    }
    idx.push({
      title,
      duration: `${match[2]} min.`,
      pos: match.index,
    });
  }

  const preamble = idx.length ? fullText.slice(0, idx[0].pos) : fullText;
  const { aims, lessonAims, overview } = parsePreamble(preamble, detectedCourse);

  const modules = [];
  for (let i = 0; i < idx.length; i++) {
    const modTitle = idx[i].title;
    const modDuration = idx[i].duration;
    const start = idx[i].pos;
    const end = i + 1 < idx.length ? idx[i + 1].pos : fullText.length;
    const fullChunk = fullText.slice(start, end);
    const boldChunk = boldOK ? boldText.slice(start, end) : "";

    // Special case: Multi-activity Review Section
    if (
      /^Review\s+Section\b/i.test(modTitle) ||
      (fullChunk.match(/^\s*Activity\s+Procedure\s*$/gim) || []).length > 1
    ) {
      const reviewMod = parseReviewSection(fullChunk);
      reviewMod.title = modTitle;
      reviewMod.duration = modDuration;
      modules.push(reviewMod);
      continue;
    }

    const { header, body } = splitChunk(fullChunk);
    const bodyOffset = fullChunk.length - body.length;
    const boldBody = boldChunk ? boldChunk.slice(bodyOffset) : "";

    const langLines = mergeCategorizedLines(
      extractAllFields(["Target Language:", "Target Vocabulary:", "Vocabulary:"], header),
    );
    const recycledLangLines = mergeCategorizedLines(
      extractAllFields(["Recycled Vocabulary:"], header),
    );
    const phonicsLines = mergeSentenceLines(extractAllFields(["Phonics:"], header));
    const hfwLines = mergeCategorizedLines(extractAllFields(["High-Frequency Words:"], header));

    const gramLines = mergeGrammarLines(
      extractAllFields(
        ["Target Grammar:", "Grammar/Structures:", "Grammar:", "Structures:"],
        header,
      ),
    );
    const recycledGramLines = mergeGrammarLines(extractAllFields(["Recycled Grammar:"], header));
    const skillLines = mergeSentenceLines(extractAllFields(["Target Skill:"], header));

    const matLines = mergeMaterialsLines(extractAllFields(["Materials:"], header));
    const prepLines = mergeSentenceLines(extractAllFields(["Preparation:"], header));
    const willRaw = extractAllFields(["In this section"], header).filter(
      (l) => !/^the\s+students\s+will/i.test(l) && l.length > 3,
    );
    const willLines = mergeSentenceLines(willRaw);

    // References (Presentations / Activities, Slides, Pages)
    const headerMatsText = matLines.join("\n");
    const matRefs = buildRefsState(tokenizeRefs(headerMatsText));

    let bodyRefs = { pres: {}, pages: [] };
    const boldFlat = collapseBold(boldBody);
    const hasBoldRefs = boldFlat.replace(/\s/g, "").length > 3;

    if (hasBoldRefs) {
      const bRefs = buildRefsState(tokenizeRefs(boldFlat));
      bodyRefs = bRefs;
    }

    const plainBodyRefs = buildRefsState(tokenizeRefs(body));
    // Prefer plain body when bold had missing presentations or pages
    const finalBodyRefs = {
      pres: Object.keys(bodyRefs.pres).length ? bodyRefs.pres : plainBodyRefs.pres,
      pages: bodyRefs.pages.length ? bodyRefs.pages : plainBodyRefs.pages,
    };

    const mergedRefs = mergeRefsState(finalBodyRefs, matRefs);

    modules.push(
      normalizeModule({
        title: modTitle,
        duration: modDuration,
        isReview: false,
        data: {
          lang: langLines,
          recycledLang: recycledLangLines,
          phonics: phonicsLines,
          hfw: hfwLines,
          gram: gramLines,
          recycledGram: recycledGramLines,
          skill: skillLines,
          materials: matLines.length ? matLines : ["Check Teacher Notes."],
          prep: prepLines.length ? prepLines : ["None"],
          will: willLines,
          presentations: mergedRefs.pres,
          pages: mergedRefs.pages,
        },
      }),
    );
  }

  return {
    course: detectedCourse,
    title: detectedTitle,
    aims,
    lessonAims,
    overview,
    modules,
  };
}

function parseExtractedText(rawFull, rawBold) {
  return parseLessonDocument(rawFull, rawBold).modules;
}

// ── Renderer ──────────────────────────────────────────────────────────────────
const ACCENTS = ["#ff4785", "#ff7e33", "#1ea7fd", "#00d063"];
const TXT_ON = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumRanges(nums) {
  if (!nums || !nums.length) return "";
  const sorted = [...new Set(nums.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)))].sort(
    (a, b) => a - b,
  );
  if (!sorted.length) return "";
  const ranges = [];
  let s = sorted[0];
  let p = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === p + 1) {
      p = sorted[i];
    } else {
      ranges.push(s === p ? String(s) : `${s}–${p}`);
      s = p = sorted[i];
    }
  }
  ranges.push(s === p ? String(s) : `${s}–${p}`);
  return ranges.join(", ");
}

function listHTML(items, empty = "N/A") {
  if (!items || !items.length)
    return `<span class="opacity-50 italic text-sm">${escapeHtml(empty)}</span>`;
  if (items.length === 1)
    return `<p class="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">${escapeHtml(items[0])}</p>`;
  return `<ul class="space-y-1.5">${items
    .map(
      (item) =>
        `<li class="flex items-start gap-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span><span>${escapeHtml(item)}</span></li>`,
    )
    .join("")}</ul>`;
}

function presHTML(presentations) {
  const keys = Object.keys(presentations || {}).sort((a, b) => presSortKey(a) - presSortKey(b));
  if (!keys.length)
    return `<span class="text-xs font-bold opacity-50 italic">No presentation cited</span>`;
  return `<div class="flex flex-wrap gap-2">${keys
    .map((pk) => {
      const slides = Array.isArray(presentations[pk]) ? presentations[pk] : [];
      const rangeStr = formatNumRanges(slides);
      const label = pk.startsWith("Act.") ? pk : `Pres. ${pk}`;
      return `<span class="pres-chip"><i data-lucide="monitor" class="w-3.5 h-3.5 shrink-0"></i><span>${escapeHtml(label)}${rangeStr ? `: <strong>${escapeHtml(rangeStr)}</strong>` : ""}</span></span>`;
    })
    .join("")}</div>`;
}

function pagesHTML(pages) {
  if (!pages || !pages.length)
    return `<span class="text-xs font-bold opacity-50 italic">No pages cited</span>`;
  return `<span class="page-chip"><i data-lucide="book-open" class="w-3.5 h-3.5 shrink-0"></i><span>pp. ${escapeHtml(formatNumRanges(pages))}</span></span>`;
}

function targetSubsectionHTML(label, items, pillClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600") {
  if (!items || !items.length) return "";
  return `
    <div>
      <span class="inline-block px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider mb-1.5 ${pillClass}">${escapeHtml(label)}</span>
      ${listHTML(items)}
    </div>`;
}

function sumMinutes(modules) {
  let total = 0;
  (modules || []).forEach((m) => {
    const n = parseInt(String(m.duration || ""), 10);
    if (!isNaN(n)) total += n;
  });
  return total;
}

function collectAllPages(modules) {
  const all = [];
  (modules || []).forEach((m) => {
    (m?.data?.pages || []).forEach((p) => all.push(p));
  });
  return formatNumRanges(all);
}

function buildModuleSearchText(mod) {
  const d = mod.data;
  const presStr = Object.keys(d.presentations || {})
    .map((k) => `${k} ${(d.presentations[k] || []).join(" ")}`)
    .join(" ");
  return [
    mod.title,
    mod.duration,
    ...d.lang,
    ...d.recycledLang,
    ...d.phonics,
    ...d.hfw,
    ...d.gram,
    ...d.recycledGram,
    ...d.skill,
    ...d.materials,
    ...d.prep,
    ...d.will,
    ...d.pages,
    presStr,
  ]
    .join(" ")
    .toLowerCase();
}

function renderModules(modules) {
  allOutcomesExpanded = false;
  renderModuleNav(modules);
  const container = document.getElementById("modules-container");
  if (!container) return;
  container.innerHTML = "";

  if (!modules || !modules.length) {
    container.className = "flex flex-col gap-5";
    container.innerHTML = `
      <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] p-8 sm:p-12 text-center flex flex-col items-center gap-5 shadow-hard animate-pop-in">
        <div class="w-20 h-20 bg-blue/15 rounded-3xl border-4 border-dark dark:border-slate-500 flex items-center justify-center shadow-hard -rotate-2">
          <i data-lucide="file-scan" class="w-10 h-10 text-blue"></i>
        </div>
        <div class="space-y-2 max-w-lg">
          <h3 class="font-heading text-2xl sm:text-3xl uppercase tracking-tight">Ready to Parse Teacher Notes</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-bold leading-relaxed">
            Drop a Teacher Notes PDF or paste notes text in the left panel to extract modules, target language, grammar, slides, and book pages.
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <span class="px-3 py-1 rounded-xl bg-orange text-white border-2 border-dark text-xs font-black uppercase -rotate-2 shadow-hard-sm">Early Years</span>
          <span class="px-3 py-1 rounded-xl bg-pink text-white border-2 border-dark text-xs font-black uppercase rotate-2 shadow-hard-sm">Primary</span>
          <span class="px-3 py-1 rounded-xl bg-green text-white border-2 border-dark text-xs font-black uppercase -rotate-2 shadow-hard-sm">Pre-Teens</span>
          <span class="px-3 py-1 rounded-xl bg-purple text-white border-2 border-dark text-xs font-black uppercase rotate-2 shadow-hard-sm">Teens</span>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button type="button" onclick="if (uiPrefs.focusMode) toggleFocusMode(); switchInputMode('pdf'); triggerPdfPicker();"
            class="btn-chunky px-5 py-3 bg-blue text-white border-3 border-dark dark:border-slate-500 rounded-2xl text-sm flex items-center gap-2">
            <i data-lucide="file-up" class="w-5 h-5"></i>
            Upload Teacher Notes PDF
          </button>
          <button type="button" onclick="if (uiPrefs.focusMode) toggleFocusMode(); switchInputMode('paste', true);"
            class="btn-chunky px-5 py-3 bg-white dark:bg-slate-800 text-dark dark:text-white border-3 border-dark dark:border-slate-500 rounded-2xl text-sm flex items-center gap-2">
            <i data-lucide="clipboard-paste" class="w-5 h-5 text-orange"></i>
            Paste Text Instead
          </button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  applyCardLayoutClass();

  modules.forEach((rawMod, i) => {
    const mod = normalizeModule(rawMod);
    const id = `mod-${i}`;
    const accent = ACCENTS[i % ACCENTS.length];
    const txtcol = TXT_ON[i % TXT_ON.length];
    const d = mod.data;

    const targetBlocks = [
      targetSubsectionHTML("Vocabulary / Language", d.lang, "bg-pink/15 text-pink border-pink/40"),
      targetSubsectionHTML("Recycled Vocab", d.recycledLang, "bg-orange/15 text-orange border-orange/40"),
      targetSubsectionHTML("Phonics", d.phonics, "bg-purple/15 text-purple border-purple/40"),
      targetSubsectionHTML("High-Frequency Words", d.hfw, "bg-blue/15 text-blue border-blue/40"),
      targetSubsectionHTML("Grammar / Structures", d.gram, "bg-orange/15 text-orange border-orange/40"),
      targetSubsectionHTML("Recycled Grammar", d.recycledGram, "bg-yellow/20 text-amber-700 dark:text-yellow border-yellow/60"),
      targetSubsectionHTML("Target Skill", d.skill, "bg-green/15 text-green-700 dark:text-green border-green/40"),
    ]
      .filter(Boolean)
      .join("");

    const outcomesLabel = mod.isReview ? "Review Activities" : "Learning Outcomes";
    const hasRefs = Object.keys(d.presentations || {}).length > 0 || (d.pages || []).length > 0;
    const isPrepNone = d.prep.length === 1 && /^None$/i.test(d.prep[0]);
    const prepContent = isPrepNone
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-green/15 text-green-700 dark:text-green border border-green/40 text-xs font-extrabold"><i data-lucide="check" class="w-3.5 h-3.5"></i>No prep needed</span>`
      : listHTML(d.prep);

    const html = `
      <article class="module-card bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[1.75rem] shadow-hard overflow-hidden flex flex-col"
        id="${id}"
        data-mod-search="${escapeHtml(buildModuleSearchText(mod))}"
        style="animation-delay:${Math.min(i * 35, 280)}ms;">

        <!-- Card Header -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b-4 border-dark dark:border-slate-600" style="background:${accent};">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-8 h-8 shrink-0 bg-white/25 rounded-xl border-2 border-white/50 flex items-center justify-center font-heading font-bold text-sm" style="color:${txtcol};">${i + 1}</span>
            <h2 class="font-heading text-base sm:text-lg leading-tight" style="color:${txtcol};">${escapeHtml(mod.title)}</h2>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${mod.duration ? `<span class="px-2.5 py-1 rounded-xl bg-white/95 text-dark border-2 border-dark text-[11px] font-black uppercase shadow-hard-xs">${escapeHtml(mod.duration)}</span>` : ""}
            <button type="button" onclick="copyCard(${i})" title="Copy Module Summary" aria-label="Copy module summary"
              class="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/35 border-2 border-white/40 flex items-center justify-center text-white transition-colors">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        ${
          hasRefs
            ? `
          <!-- Instant Slide & Page Reference Strip -->
          <div class="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-800/70 border-b-2 border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div class="flex-1 min-w-[160px]">${presHTML(d.presentations)}</div>
            <div class="shrink-0">${pagesHTML(d.pages)}</div>
          </div>`
            : ""
        }

        <div class="p-4 sm:p-5 flex flex-col gap-4 flex-1">
          <!-- Target Focus -->
          <div class="section-stripe space-y-2.5" style="border-color:${accent};">
            ${targetBlocks || `<p class="text-xs font-bold text-slate-400 dark:text-slate-500 italic">Routine / review section &mdash; see Teacher Notes for instructions.</p>`}
          </div>

          <!-- Requirements -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1.5">
                <i data-lucide="package" class="w-3.5 h-3.5 text-blue"></i> Materials
              </p>
              ${listHTML(d.materials)}
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1.5">
                <i data-lucide="clipboard-check" class="w-3.5 h-3.5 text-orange"></i> Preparation
              </p>
              ${prepContent}
            </div>
          </div>

          ${
            d.will.length
              ? `
            <div class="pt-2 border-t-2 border-slate-100 dark:border-slate-800">
              <button type="button" class="w-full flex items-center justify-between py-1.5 px-2.5 -mx-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors" onclick="toggleWill(${i})">
                <span class="font-heading text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <i data-lucide="target" class="w-3.5 h-3.5 text-green"></i>
                  ${escapeHtml(outcomesLabel)} (${d.will.length})
                </span>
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 transition-transform" id="chev-${i}"></i>
              </button>
              <div class="hidden mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border-2 border-slate-200 dark:border-slate-700" id="will-${i}">${listHTML(d.will)}</div>
            </div>`
              : ""
          }
        </div>
      </article>`;
    container.insertAdjacentHTML("beforeend", html);
  });

  if (window.lucide) lucide.createIcons();
  filterModules();
}

function getUniqueCategorized(items) {
  const categoryMap = new Map();
  (items || []).forEach((item) => {
    const trimmed = String(item || "").trim();
    if (!trimmed) return;
    const category = trimmed.split(":")[0].toLowerCase().trim();
    const existing = categoryMap.get(category);
    if (
      !existing ||
      (trimmed.includes(":") && !existing.includes(":")) ||
      (trimmed.includes(":") === existing.includes(":") && trimmed.length > existing.length)
    ) {
      categoryMap.set(category, trimmed);
    }
  });
  return Array.from(categoryMap.values());
}

function renderOverview(modules) {
  const container = document.getElementById("overview-content");
  if (!container) return;
  container.innerHTML = "";

  const normalizedMods = (modules || []).map(normalizeModule);
  const ov = normalizeOverview(appState.current.overview);
  const title = appState.current.title || document.getElementById("unit-title-input")?.value || "Unit Overview";
  const course = normalizeCourseName(appState.current.course || document.getElementById("unit-course-select")?.value || "");
  const aims = appState.current.aims || document.getElementById("unit-aims-input")?.value || "";
  const lessonAims = appState.current.lessonAims || document.getElementById("lesson-aims-input")?.value || "";
  const totalMins = sumMinutes(normalizedMods);
  const allPagesRange = collectAllPages(normalizedMods);

  const rawLang = [...ov.lang];
  const rawRecycledLang = [...ov.recycledLang];
  const rawPhonics = [...ov.phonics];
  const rawHfw = [...ov.hfw];
  const rawGram = [...ov.gram];
  const rawRecycledGram = [...ov.recycledGram];
  const rawSkill = [];

  normalizedMods.forEach((m) => {
    m.data.lang.forEach((l) => rawLang.push(l));
    m.data.recycledLang.forEach((l) => rawRecycledLang.push(l));
    m.data.phonics.forEach((p) => rawPhonics.push(p));
    m.data.hfw.forEach((h) => rawHfw.push(h));
    m.data.gram.forEach((g) => rawGram.push(g));
    m.data.recycledGram.forEach((g) => rawRecycledGram.push(g));
    m.data.skill.forEach((s) => rawSkill.push(s));
  });

  const uniqueLang = getUniqueCategorized(rawLang);
  const uniqueRecycledLang = getUniqueCategorized(rawRecycledLang);
  const uniquePhonics = dedupeStrings(rawPhonics);
  const uniqueHfw = dedupeStrings(rawHfw);
  const uniqueGram = getUniqueCategorized(rawGram);
  const uniqueRecycledGram = dedupeStrings(rawRecycledGram);
  const uniqueSkill = dedupeStrings(rawSkill);

  window._cachedOverviewSections = {
    lang: [...uniqueLang, ...uniqueRecycledLang, ...uniquePhonics, ...uniqueHfw],
    gram: [...uniqueGram, ...uniqueRecycledGram, ...uniqueSkill],
  };

  const html = `
    <div class="flex flex-col gap-5">
      <!-- Hero Unit Summary -->
      <div class="bg-blue text-white border-4 border-dark dark:border-slate-500 rounded-[2rem] p-6 shadow-hard relative overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="flex items-center gap-2.5 flex-wrap">
              ${course ? `<span class="px-3 py-1 rounded-xl bg-white text-dark border-2 border-dark text-xs font-black uppercase shadow-hard-sm -rotate-1">${escapeHtml(course)}</span>` : ""}
              <span class="px-3 py-1 rounded-xl bg-slate-900/25 border-2 border-white/30 text-xs font-black uppercase">${normalizedMods.length} Modules</span>
              <span class="px-3 py-1 rounded-xl bg-slate-900/25 border-2 border-white/30 text-xs font-black uppercase">${totalMins} Min Total</span>
              ${allPagesRange ? `<span class="px-3 py-1 rounded-xl bg-slate-900/25 border-2 border-white/30 text-xs font-black uppercase">pp. ${escapeHtml(allPagesRange)}</span>` : ""}
            </div>
            <h2 class="font-heading text-2xl sm:text-3xl uppercase tracking-tight leading-tight">${escapeHtml(title)}</h2>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="copyOverview('text')" class="btn-chunky py-2 px-3.5 bg-white text-dark border-3 border-dark rounded-xl text-xs flex items-center gap-1.5">
              <i data-lucide="copy" class="w-3.5 h-3.5 text-blue"></i> Copy Overview
            </button>
            <button type="button" onclick="copyOverview('md')" class="btn-chunky py-2 px-3.5 bg-dark text-white border-3 border-dark rounded-xl text-xs flex items-center gap-1.5">
              <i data-lucide="file-code-2" class="w-3.5 h-3.5 text-green"></i> Markdown
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 ${lessonAims ? "md:grid-cols-2" : ""} gap-4 mt-5">
          <div class="p-4 bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30">
            <p class="text-[11px] uppercase font-black tracking-widest opacity-85 mb-1.5 flex items-center gap-1.5">
              <i data-lucide="target" class="w-3.5 h-3.5"></i> Unit Aims
            </p>
            <p class="text-sm font-bold leading-relaxed">${aims ? escapeHtml(aims).replace(/\n/g, "<br>") : "No unit aims extracted."}</p>
          </div>
          ${
            lessonAims
              ? `
            <div class="p-4 bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30">
              <p class="text-[11px] uppercase font-black tracking-widest opacity-85 mb-1.5 flex items-center gap-1.5">
                <i data-lucide="flag" class="w-3.5 h-3.5"></i> Lesson Aims
              </p>
              <p class="text-sm font-bold leading-relaxed">${escapeHtml(lessonAims).replace(/\n/g, "<br>")}</p>
            </div>`
              : ""
          }
        </div>
      </div>

      <!-- Language & Grammar Bento -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] p-5 shadow-hard">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="font-heading text-pink text-lg uppercase flex items-center gap-2">
              <i data-lucide="languages" class="w-5 h-5"></i> Target Language
            </h3>
            <button type="button" onclick="copySectionList('lang')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border-2 border-dark dark:border-slate-500 rounded-xl text-[10px] font-black uppercase hover:text-pink transition-colors flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3"></i> Copy
            </button>
          </div>
          <div class="space-y-3">
            ${listHTML(uniqueLang, "No language extracted.")}
            ${targetSubsectionHTML("Recycled Vocabulary", uniqueRecycledLang, "bg-orange/15 text-orange border-orange/40")}
            ${targetSubsectionHTML("Phonics", uniquePhonics, "bg-purple/15 text-purple border-purple/40")}
            ${targetSubsectionHTML("High-Frequency Words", uniqueHfw, "bg-blue/15 text-blue border-blue/40")}
          </div>
        </div>

        <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] p-5 shadow-hard">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="font-heading text-orange text-lg uppercase flex items-center gap-2">
              <i data-lucide="scroll" class="w-5 h-5"></i> Grammar &amp; Skills
            </h3>
            <button type="button" onclick="copySectionList('gram')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border-2 border-dark dark:border-slate-500 rounded-xl text-[10px] font-black uppercase hover:text-orange transition-colors flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3"></i> Copy
            </button>
          </div>
          <div class="space-y-3">
            ${listHTML(uniqueGram, "No grammar extracted.")}
            ${targetSubsectionHTML("Recycled Grammar", uniqueRecycledGram, "bg-yellow/20 text-amber-700 dark:text-yellow border-yellow/60")}
            ${targetSubsectionHTML("Target Skills", uniqueSkill, "bg-green/15 text-green-700 dark:text-green border-green/40")}
          </div>
        </div>
      </div>

      ${
        ov.materials.length || ov.tips.length
          ? `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${
            ov.materials.length
              ? `
            <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] p-5 shadow-hard">
              <h3 class="font-heading text-blue text-lg uppercase mb-3 flex items-center gap-2">
                <i data-lucide="package" class="w-5 h-5"></i> Lesson Materials
              </h3>
              ${listHTML(ov.materials)}
            </div>`
              : ""
          }
          ${
            ov.tips.length
              ? `
            <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] p-5 shadow-hard">
              <h3 class="font-heading text-green text-lg uppercase mb-3 flex items-center gap-2">
                <i data-lucide="lightbulb" class="w-5 h-5"></i> Teaching Tips
              </h3>
              ${listHTML(ov.tips)}
            </div>`
              : ""
          }
        </div>`
          : ""
      }

      <!-- Resource Navigator -->
      <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[2rem] shadow-hard overflow-hidden">
        <div class="px-5 py-4 bg-dark dark:bg-slate-800 text-white border-b-4 border-dark dark:border-slate-600 font-heading uppercase tracking-wide flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-lg"><i data-lucide="map" class="w-5 h-5 text-green"></i> Resource Navigator</span>
          <span class="px-2.5 py-0.5 rounded-lg bg-white/15 text-xs font-black">${normalizedMods.length} Sections</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/70 border-b-3 border-dark dark:border-slate-600">
                <th class="p-3.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"># &amp; Module</th>
                <th class="p-3.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Time</th>
                <th class="p-3.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Slides</th>
                <th class="p-3.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Pages</th>
              </tr>
            </thead>
            <tbody>
              ${
                normalizedMods.length
                  ? normalizedMods
                      .map(
                        (m, i) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue/5 dark:hover:bg-slate-800/60 transition-colors">
                    <td class="p-3.5 font-bold text-sm">
                      <button type="button" onclick="scrollToModule(${i})" class="text-left hover:text-blue transition-colors flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[11px] font-black flex items-center justify-center shrink-0">${i + 1}</span>
                        <span>${escapeHtml(m.title)}</span>
                      </button>
                    </td>
                    <td class="p-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 whitespace-nowrap">${escapeHtml(m.duration || "-")}</td>
                    <td class="p-3.5">${presHTML(m.data.presentations)}</td>
                    <td class="p-3.5 whitespace-nowrap">${pagesHTML(m.data.pages)}</td>
                  </tr>`,
                      )
                      .join("")
                  : `<tr><td colspan="4" class="p-8 text-center text-sm font-bold text-slate-400">No modules to display yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function copySectionList(kind) {
  const items = (window._cachedOverviewSections && window._cachedOverviewSections[kind]) || [];
  if (!items.length) {
    showToast("Nothing to copy yet", "warn");
    return;
  }
  navigator.clipboard?.writeText(items.join("\n")).then(() => {
    showToast(kind === "lang" ? "Target language copied!" : "Grammar & skills copied!");
  });
}

function toggleWill(i) {
  const el = document.getElementById(`will-${i}`);
  const chv = document.getElementById(`chev-${i}`);
  if (el) el.classList.toggle("hidden");
  if (chv && el) {
    chv.style.transform = el.classList.contains("hidden") ? "rotate(0deg)" : "rotate(180deg)";
  }
}

function formatPresText(presentations) {
  const keys = Object.keys(presentations || {}).sort((a, b) => presSortKey(a) - presSortKey(b));
  if (!keys.length) return "None";
  return keys
    .map((k) => {
      const s = formatNumRanges(presentations[k]);
      const lbl = k.startsWith("Act.") ? k : `Pres. ${k}`;
      return s ? `${lbl} (slides ${s})` : lbl;
    })
    .join(", ");
}

function copyCard(index) {
  const mod = normalizeModule(appState.current.modules[index]);
  if (!mod) return;
  const d = mod.data;
  const lines = [`${mod.title}${mod.duration ? ` (${mod.duration})` : ""}`];
  if (d.lang.length) lines.push(`\nLanguage:\n- ${d.lang.join("\n- ")}`);
  if (d.recycledLang.length) lines.push(`\nRecycled Vocabulary:\n- ${d.recycledLang.join("\n- ")}`);
  if (d.phonics.length) lines.push(`\nPhonics:\n- ${d.phonics.join("\n- ")}`);
  if (d.hfw.length) lines.push(`\nHigh-Frequency Words:\n- ${d.hfw.join("\n- ")}`);
  if (d.gram.length) lines.push(`\nGrammar / Structures:\n- ${d.gram.join("\n- ")}`);
  if (d.recycledGram.length) lines.push(`\nRecycled Grammar:\n- ${d.recycledGram.join("\n- ")}`);
  if (d.skill.length) lines.push(`\nTarget Skill:\n- ${d.skill.join("\n- ")}`);
  if (d.materials.length) lines.push(`\nMaterials:\n- ${d.materials.join("\n- ")}`);
  if (d.prep.length) lines.push(`\nPreparation:\n- ${d.prep.join("\n- ")}`);
  lines.push(`\nPresentations: ${formatPresText(d.presentations)}`);
  lines.push(`Pages: ${d.pages.length ? formatNumRanges(d.pages) : "None"}`);

  navigator.clipboard?.writeText(lines.join("\n")).then(() => {
    showToast("Module summary copied!");
  });
}

function copyOverview(format = "text") {
  const mods = (appState.current.modules || []).map(normalizeModule);
  const title = appState.current.title || "Unit Overview";
  const stage = normalizeCourseName(appState.current.course);
  const course = stage ? ` [${stage}]` : "";
  const lines = [];

  if (format === "md") {
    lines.push(`# ${title}${course}`);
    lines.push(`**${mods.length} modules** | **${sumMinutes(mods)} min**`);
    if (appState.current.aims) lines.push(`\n## Unit Aims\n${appState.current.aims}`);
    if (appState.current.lessonAims) lines.push(`\n## Lesson Aims\n${appState.current.lessonAims}`);
    lines.push(`\n## Modules\n| # | Module | Time | Slides | Pages |\n|---|---|---|---|---|`);
    mods.forEach((m, idx) => {
      lines.push(
        `| ${idx + 1} | ${m.title} | ${m.duration || "-"} | ${formatPresText(m.data.presentations)} | ${m.data.pages.length ? formatNumRanges(m.data.pages) : "-"} |`,
      );
    });
  } else {
    lines.push(`${title}${course} (${mods.length} modules, ${sumMinutes(mods)} min)`);
    if (appState.current.aims) lines.push(`\nUnit Aims:\n${appState.current.aims}`);
    if (appState.current.lessonAims) lines.push(`\nLesson Aims:\n${appState.current.lessonAims}`);
    mods.forEach((m, idx) => {
      lines.push(
        `\n${idx + 1}. ${m.title} (${m.duration || "-"}) | Slides: ${formatPresText(m.data.presentations)} | Pages: ${m.data.pages.length ? formatNumRanges(m.data.pages) : "-"}`,
      );
    });
  }

  navigator.clipboard?.writeText(lines.join("\n")).then(() => {
    showToast(format === "md" ? "Markdown overview copied!" : "Full overview copied!");
  });
}

function scrollToModule(index) {
  switchTab("paste");
  let el = document.getElementById(`mod-${index}`);
  if (el && el.classList.contains("hidden")) {
    clearModuleFilter();
    el = document.getElementById(`mod-${index}`);
  }
  if (!el) return;
  const offset = 110;
  const elementTop = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: Math.max(0, elementTop - offset),
    behavior: "smooth",
  });
  el.classList.remove("module-highlight-pulse");
  void el.offsetWidth;
  el.classList.add("module-highlight-pulse");
}

function renderModuleNav(modules) {
  const nav = document.getElementById("module-nav");
  if (!nav) return;

  if (!modules || !modules.length) {
    nav.className = "hidden";
    nav.innerHTML = "";
    return;
  }

  const totalMins = sumMinutes(modules);
  const allPagesRange = collectAllPages(modules);
  nav.className = "block";
  nav.innerHTML = `
    <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-4 border-dark dark:border-slate-500 rounded-[1.5rem] p-3.5 shadow-hard flex flex-wrap gap-3 items-center justify-between">
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="flex items-center gap-1.5 mr-1">
          <i data-lucide="compass" class="w-4 h-4 text-blue"></i>
          <span class="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Jump</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${modules
            .map(
              (m, i) => `
            <button type="button" onclick="scrollToModule(${i})"
              class="btn-chunky w-8 h-8 rounded-xl border-2 border-dark dark:border-slate-500 flex items-center justify-center text-xs font-bold"
              style="background:${ACCENTS[i % ACCENTS.length]}; color:${TXT_ON[i % TXT_ON.length]};"
              title="${escapeHtml(m.title)}">
              ${i + 1}
            </button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dark dark:border-slate-500 text-dark dark:text-slate-200 text-xs font-black uppercase">
          ${modules.length} Mod &middot; ${totalMins} min
        </span>
        ${allPagesRange ? `<span class="page-chip">pp. ${escapeHtml(allPagesRange)}</span>` : ""}
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Library Sets Management ───────────────────────────────────────────────────
function toggleLibrary() {
  const drawer = document.getElementById("library-drawer");
  const backdrop = document.getElementById("library-backdrop");
  if (!drawer) return;
  drawer.classList.toggle("-translate-x-full");
  const isOpen = !drawer.classList.contains("-translate-x-full");
  if (backdrop) backdrop.classList.toggle("hidden", !isOpen);
  if (isOpen) renderLibrary();
}

function setLibraryFilter(course) {
  activeLibraryCourseFilter = normalizeCourseName(course);
  document.querySelectorAll(".lib-filter-pill").forEach((btn) => {
    const match = (btn.getAttribute("data-lib-filter") || "") === activeLibraryCourseFilter;
    btn.classList.toggle("bg-blue", match);
    btn.classList.toggle("text-white", match);
    btn.classList.toggle("bg-slate-100", !match);
    btn.classList.toggle("dark:bg-slate-800", !match);
    btn.classList.toggle("text-dark", !match);
    btn.classList.toggle("dark:text-slate-200", !match);
  });
  renderLibrary();
}

async function renderLibrary() {
  const list = document.getElementById("library-list");
  if (!list || !dataBase) return;
  const search = (document.getElementById("library-search")?.value || "").toLowerCase();

  const rawSets = await getAllLocalSets();
  const sets = rawSets
    .filter((s) => s.id !== 0)
    .map((s) => ({ ...s, course: normalizeCourseName(s.course) }))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  appState.library = sets;
  updateLibraryCountBadge();

  list.innerHTML = "";
  const filtered = sets.filter((s) => {
    const matchesSearch =
      (s.name || "").toLowerCase().includes(search) ||
      (s.course || "").toLowerCase().includes(search);
    const matchesCourse = !activeLibraryCourseFilter || s.course === activeLibraryCourseFilter;
    return matchesSearch && matchesCourse;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-center py-8 text-slate-400 font-bold text-sm">No saved sets found.</div>`;
    return;
  }

  filtered.forEach((set) => {
    const el = document.createElement("div");
    el.className = `group p-3.5 bg-white dark:bg-slate-800 border-3 border-dark dark:border-slate-500 rounded-2xl shadow-hard-sm cursor-pointer hover:border-blue transition-all ${appState.activeId === set.id ? "ring-4 ring-blue/40 border-blue" : ""}`;

    const date = new Date(set.lastUsed || Date.now()).toLocaleDateString();
    const modCount =
      typeof set.moduleCount === "number"
        ? set.moduleCount
        : (Array.isArray(set.modules) ? set.modules.length : 0);

    el.innerHTML = `
      <div class="flex justify-between items-start gap-2">
        <div class="min-w-0 flex-1" onclick="loadSet(${set.id})">
          <h4 class="font-heading font-bold text-dark dark:text-white truncate">${escapeHtml(set.name)}</h4>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            ${set.course ? `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue/15 text-blue">${escapeHtml(set.course)}</span>` : ""}
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">${modCount} mod &middot; ${escapeHtml(date)}</span>
          </div>
        </div>
        <button type="button" onclick="deleteSet(event, ${set.id})" class="p-1.5 text-slate-400 hover:text-pink hover:bg-pink/10 rounded-lg transition-colors" aria-label="Delete saved set">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>`;
    list.appendChild(el);
  });
  if (window.lucide) lucide.createIcons();
}

async function createNewSet() {
  if (
    (appState.current.rawText && appState.current.rawText.trim().length > 50) ||
    (appState.current.modules && appState.current.modules.length > 0)
  ) {
    const c = await showConfirmModal(
      "Start New?",
      "Your current unsaved session will be cleared.",
      "Start New",
      "plus",
    );
    if (!c) return;
  }

  appState.activeId = null;
  appState.current = {
    title: "",
    course: "",
    aims: "",
    lessonAims: "",
    overview: emptyOverview(),
    modules: [],
    rawText: "",
  };
  localStorage.removeItem("lp_session");
  clearPdfBadge();
  const msInput = document.getElementById("module-search-input");
  if (msInput) msInput.value = "";
  updateUIFromState();
  showToast("New lesson started");
  updateSessionPersistence({ modulesDirty: true, immediate: true });
}

function showSaveModal() {
  const input = document.getElementById("set-name-input");
  if (input) {
    input.value = appState.current.title || "";
    document.getElementById("save-modal")?.classList.remove("hidden");
    input.focus();
  }
}

function closeSaveModal() {
  document.getElementById("save-modal")?.classList.add("hidden");
}

async function confirmSaveSet() {
  if (!dataBase) return;
  const name =
    document.getElementById("set-name-input")?.value.trim() || "Untitled Lesson";

  const set = {
    name,
    course: normalizeCourseName(appState.current.course),
    unitAims: appState.current.aims || "",
    lessonAims: appState.current.lessonAims || "",
    overview: normalizeOverview(appState.current.overview),
    modules: appState.current.modules || [],
    moduleCount: (appState.current.modules || []).length,
    rawText: appState.current.rawText || "", // Local IndexedDB cache only
    createdAt: Date.now(),
    lastUsed: Date.now(),
    usageCount: 1,
    _hydrated: true,
  };

  const tx = dataBase.transaction("library", "readwrite");
  const store = tx.objectStore("library");
  const req = store.add(set);
  req.onsuccess = (e) => {
    appState.activeId = e.target.result;
    set.id = appState.activeId;
    appState.current.title = name;
    appState.library = [set, ...appState.library.filter((s) => s.id !== set.id)];
    closeSaveModal();
    updateUIFromState();
    renderLibrary();
    showToast("Lesson saved to library");
    updateSessionPersistence({ modulesDirty: true, immediate: true });
  };
}

async function loadSet(id) {
  if (!dataBase) return;
  let set = await getLocalSet(id);

  if (!set || set._hydrated === false) {
    try {
      const user = await getAuthenticatedCloudUser();
      if (user && typeof db !== "undefined") {
        updateSyncStatus("saving", "Loading...");
        const fullRow = await fetchCloudLessonFull(user.id, id);
        if (fullRow) {
          set = hydrateCloudLessonRow(fullRow, set);
          await putLocalSet(set);
        }
      }
    } catch (err) {
      console.warn("[LoadSet] Cloud hydration failed:", err);
      updateSyncStatus("error", "Load Failed");
    }
  }

  if (!set) {
    showToast("Could not load lesson", "error");
    return;
  }

  appState.activeId = set.id;
  appState.current = {
    title: set.name || "",
    course: normalizeCourseName(set.course),
    aims: set.unitAims || "",
    lessonAims: set.lessonAims || "",
    overview: normalizeOverview(set.overview),
    modules: Array.isArray(set.modules) ? set.modules.map(normalizeModule) : [],
    rawText: set.rawText || "",
  };

  set.lastUsed = Date.now();
  set.usageCount = (set.usageCount || 0) + 1;
  set.moduleCount = appState.current.modules.length;
  set._hydrated = true;
  await putLocalSet(set);

  const idx = appState.library.findIndex((s) => s.id === set.id);
  if (idx !== -1) appState.library[idx] = { ...set };
  else appState.library.unshift({ ...set });

  clearPdfBadge();
  updateUIFromState();
  toggleLibrary();
  showToast(`Loaded: ${set.name}`);
  updateSessionPersistence({ modulesDirty: false });
}

async function deleteSet(e, id) {
  e.stopPropagation();
  const c = await showConfirmModal(
    "Delete Set?",
    "This set will be permanently removed from your library.",
    "Delete",
    "trash-2",
  );
  if (!c || !dataBase) return;

  const tx = dataBase.transaction("library", "readwrite");
  tx.objectStore("library").delete(id);
  tx.oncomplete = async () => {
    try {
      const user = await getAuthenticatedCloudUser();
      if (user && typeof db !== "undefined") {
        await db
          .from("workshop_lessonparser")
          .delete()
          .eq("user_id", user.id)
          .eq("local_id", id);
      }
    } catch (err) {
      console.warn("Cloud deletion failed", err);
    }

    appState.library = appState.library.filter((s) => s.id !== id);
    const wasActive = appState.activeId === id;
    if (wasActive) {
      appState.activeId = null;
      updateActiveIndicator();
    }
    renderLibrary();
    showToast("Set deleted");
    if (wasActive) {
      updateSessionPersistence({ modulesDirty: true, immediate: true });
    }
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
async function showConfirmModal(title, desc, confirmText, icon) {
  return new Promise((res) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) return res(false);

    document.getElementById("confirm-title").innerText = title;
    document.getElementById("confirm-desc").innerText = desc;
    document.getElementById("confirm-do").innerText = confirmText;

    const iconEl = document.getElementById("confirm-icon");
    if (iconEl) iconEl.setAttribute("data-lucide", icon);
    if (window.lucide) lucide.createIcons();

    modal.classList.remove("hidden");

    const cleanup = (val) => {
      modal.classList.add("hidden");
      const oldDo = document.getElementById("confirm-do");
      const newDo = oldDo.cloneNode(true);
      oldDo.parentNode.replaceChild(newDo, oldDo);

      const oldCancel = document.getElementById("confirm-cancel");
      const newCancel = oldCancel.cloneNode(true);
      oldCancel.parentNode.replaceChild(newCancel, oldCancel);

      res(val);
    };

    document.getElementById("confirm-do").addEventListener("click", () => cleanup(true));
    document.getElementById("confirm-cancel").addEventListener("click", () => cleanup(false));
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseLessonDocument,
    parseExtractedText,
    serializeCloudResult,
    deserializeCloudResult,
    deserializeModuleRow,
    hydrateCloudLessonRow,
    buildCloudPayloadRows,
    tokenizeRefs,
    buildRefsState,
    extractAllFields,
    normalizeCourseName,
  };
}

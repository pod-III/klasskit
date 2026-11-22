// Update Helper — Progress Update Comment Studio & Student Tracker

const SKILLS = [
  { key: "participation", label: "Participation", category: "Classroom Performance", icon: "hand", color: "pink", core: true },
  { key: "listening", label: "Listening", category: "Classroom Performance", icon: "ear", color: "blue", core: true },
  { key: "spoken", label: "Speaking", category: "Classroom Performance", icon: "mic", color: "pink", core: true },
  { key: "attendance", label: "Attendance", category: "Classroom Performance", icon: "calendar-check", color: "orange", core: false },

  { key: "social", label: "Social Skills", category: "Social & Emotional", icon: "users", color: "orange", core: false },
  { key: "confidence", label: "Confidence", category: "Social & Emotional", icon: "shield-check", color: "green", core: false },

  { key: "progress", label: "Progress", category: "Academic Progress", icon: "trending-up", color: "green", core: true },
  { key: "grammar", label: "Grammar", category: "Academic Progress", icon: "spell-check", color: "pink", core: true },
  { key: "reading", label: "Reading", category: "Academic Progress", icon: "book-open", color: "blue", core: false },
  { key: "vocabulary", label: "Vocabulary", category: "Academic Progress", icon: "a-large-small", color: "orange", core: true },
  { key: "writing", label: "Writing", category: "Academic Progress", icon: "pen-line", color: "green", core: false },
  { key: "homework", label: "Homework", category: "Academic Progress", icon: "notebook-pen", color: "pink", core: false },
  { key: "errors", label: "Accuracy", category: "Academic Progress", icon: "check-check", color: "blue", core: false },
];

function defaultEnabledSkills() {
  const out = {};
  SKILLS.forEach((sk) => {
    out[sk.key] = true;
  });
  return out;
}

function defaultState() {
  return {
    classes: [{ id: "default", name: "Class 1", students: [] }],
    activeClassId: "default",
    currentStudentId: null,
    settings: {
      enabledSkills: defaultEnabledSkills(),
      format: "breakdown",
      greeting: "Here is {name}'s progress update:",
      closing: "Keep up the great work, {name}!",
    },
  };
}

let state = defaultState();
let hopefulPhrases = {};
let currentPronoun = "they";
let modalPronoun = "they";
let rosterFilter = "all";
let lastCommentItems = []; // [{ key, label, score, level, text }]
let cloudSaveTimeout = null;

// ── Utilities & Escaping ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampScore(v) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function bandInfo(v) {
  const n = clampScore(v);
  if (n >= 90) {
    return {
      key: "excellent",
      label: "Excellent",
      cls: "bg-green/15 text-green-700 dark:text-green border-green/40",
    };
  }
  if (n >= 70) {
    return {
      key: "good",
      label: "Good",
      cls: "bg-blue/15 text-blue border-blue/40",
    };
  }
  if (n >= 50) {
    return {
      key: "developing",
      label: "Developing",
      cls: "bg-orange/15 text-orange border-orange/40",
    };
  }
  return {
    key: "needs_work",
    label: "Needs Work",
    cls: "bg-pink/15 text-pink border-pink/40",
  };
}

function computeStudentAverage(student) {
  if (!student || !student.scores) return null;
  const enabled = state.settings?.enabledSkills || defaultEnabledSkills();
  const vals = [];
  SKILLS.forEach((sk) => {
    if (!enabled[sk.key]) return;
    const raw = student.scores[sk.key];
    if (raw !== undefined && raw !== null && raw !== "" && !isNaN(+raw)) {
      vals.push(clampScore(raw));
    }
  });
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function isStudentDone(student) {
  if (!student) return false;
  if (Array.isArray(student.commentItems) && student.commentItems.length > 0) return true;
  if (Array.isArray(student.comments) && student.comments.length > 0 && String(student.comments[0] || "").trim()) {
    return true;
  }
  return false;
}

// ── State Normalization & Persistence ─────────────────────────────────────────
function normalizeLoadedState(raw) {
  const def = defaultState();
  if (!raw || typeof raw !== "object") return def;

  const classes =
    Array.isArray(raw.classes) && raw.classes.length
      ? raw.classes.map((c, idx) => ({
          id: String(c.id || `cls_${idx}_${Date.now()}`),
          name: String(c.name || `Class ${idx + 1}`),
          students: Array.isArray(c.students) ? c.students : [],
        }))
      : def.classes;

  const activeExists = classes.some((c) => c.id === raw.activeClassId);
  const activeClassId = activeExists ? raw.activeClassId : classes[0].id;

  const rawSettings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const enabledSkills = { ...defaultEnabledSkills(), ...(rawSettings.enabledSkills || {}) };

  return {
    classes,
    activeClassId,
    currentStudentId: raw.currentStudentId || null,
    settings: {
      enabledSkills,
      format: rawSettings.format === "paragraph" ? "paragraph" : "breakdown",
      greeting: String(rawSettings.greeting || def.settings.greeting),
      closing: String(rawSettings.closing || def.settings.closing),
    },
  };
}

function migrateLegacyStudents() {
  try {
    const oldStudents = JSON.parse(localStorage.getItem("e1_students") || "null");
    if (oldStudents && Array.isArray(oldStudents) && oldStudents.length) {
      state.classes[0].students = oldStudents;
      localStorage.removeItem("e1_students");
      saveLocal();
    }
  } catch (e) {
    console.warn("Legacy student migration skipped", e);
  }
}

function updateSyncStatus(mode, text) {
  const dot = document.getElementById("syncDot");
  const label = document.getElementById("syncLabel");
  if (dot) {
    dot.classList.remove("bg-orange-400", "bg-green-500", "bg-blue-500", "bg-red-500", "animate-pulse");
    if (mode === "synced") dot.classList.add("bg-green-500");
    else if (mode === "saving") dot.classList.add("bg-blue-500", "animate-pulse");
    else if (mode === "error") dot.classList.add("bg-red-500");
    else dot.classList.add("bg-orange-400");
  }
  if (label && text) label.textContent = text;
}

function saveLocal() {
  try {
    localStorage.setItem("pu_helper_v2", JSON.stringify(state));
  } catch (e) {
    console.warn("Local save failed", e);
  }
}

function loadLocal() {
  try {
    const saved = localStorage.getItem("pu_helper_v2");
    if (saved) state = normalizeLoadedState(JSON.parse(saved));
  } catch (e) {
    console.warn("Local load failed", e);
  }
}

function save(immediateCloud = false) {
  saveLocal();
  const inSandbox = typeof isSandbox === "function" && isSandbox();
  if (typeof saveProgress !== "function" || inSandbox) {
    updateSyncStatus("local", "Local Saved");
    return;
  }

  updateSyncStatus("saving", "Syncing...");
  clearTimeout(cloudSaveTimeout);
  cloudSaveTimeout = setTimeout(
    async () => {
      try {
        await saveProgress("pu-helper", state);
        updateSyncStatus("synced", "Cloud Synced");
      } catch (e) {
        console.warn("Cloud save failed", e);
        updateSyncStatus("error", "Sync Failed");
      }
    },
    immediateCloud ? 50 : 900,
  );
}

async function syncWithCloud() {
  const inSandbox = typeof isSandbox === "function" && isSandbox();
  if (typeof loadProgress !== "function" || inSandbox) {
    updateSyncStatus("local", "Local Cache");
    return;
  }
  try {
    const cloudState = await loadProgress("pu-helper");
    if (cloudState) {
      state = normalizeLoadedState(cloudState);
      saveLocal();
      updateSyncStatus("synced", "Cloud Synced");
    } else {
      updateSyncStatus("synced", "Ready");
    }
  } catch (e) {
    console.warn("Cloud load failed", e);
    updateSyncStatus("local", "Local Cache");
  }
}

function getActiveClass() {
  return state.classes.find((c) => c.id === state.activeClassId) || state.classes[0];
}

function getStudent(id) {
  const cls = getActiveClass();
  return (cls?.students || []).find((s) => s.id === id) || null;
}

// ── Dark Mode & Toast ─────────────────────────────────────────────────────────
function toggleDark() {
  document.documentElement.classList.toggle("dark");
  const dark = document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  localStorage.setItem("e1_dark", dark ? "1" : "0");
}

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
  }, 2400);
}

// ── Class Management ──────────────────────────────────────────────────────────
function switchClass(id) {
  state.activeClassId = id;
  const cls = getActiveClass();
  state.currentStudentId = cls?.students?.[0]?.id || null;
  save();
  renderClassSelector();
  renderRoster();
  if (state.currentStudentId) {
    loadStudent(state.currentStudentId);
  } else {
    showEmptyStudentState();
  }
}

async function addNewClass() {
  const name = typeof quickPrompt === "function" ? await quickPrompt("Enter new class name:") : prompt("Enter new class name:");
  if (!name || !name.trim()) return;
  const newCls = { id: Date.now().toString(), name: name.trim(), students: [] };
  state.classes.push(newCls);
  switchClass(newCls.id);
  showToast(`Class "${newCls.name}" created`);
}

async function renameCurrentClass() {
  const cls = getActiveClass();
  if (!cls) return;
  const next =
    typeof quickPrompt === "function"
      ? await quickPrompt("Rename class:", cls.name)
      : prompt("Rename class:", cls.name);
  if (!next || !next.trim()) return;
  cls.name = next.trim();
  save();
  renderClassSelector();
  showToast(`Renamed class to "${cls.name}"`);
}

async function deleteCurrentClass() {
  if (state.classes.length <= 1) {
    if (typeof showAlertModal === "function") {
      await showAlertModal("You must keep at least one class.", {
        title: "Cannot Delete",
        icon: "alert-circle",
        iconColor: "orange",
      });
    } else {
      showToast("You must keep at least one class", "warn");
    }
    return;
  }
  const cls = getActiveClass();
  const confirmed =
    typeof showConfirmModal === "function"
      ? await showConfirmModal(`Delete class "${cls.name}" and all ${cls.students.length} students?`, {
          title: "Delete Class?",
          confirmText: "Delete",
          cancelText: "Keep",
          icon: "trash-2",
          iconColor: "red",
        })
      : confirm(`Delete class "${cls.name}"?`);
  if (!confirmed) return;

  state.classes = state.classes.filter((c) => c.id !== state.activeClassId);
  state.activeClassId = state.classes[0].id;
  switchClass(state.activeClassId);
  showToast("Class deleted");
}

function renderClassSelector() {
  const sel = document.getElementById("classSelector");
  if (!sel) return;
  sel.innerHTML = "";
  state.classes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${(c.students || []).length})`;
    opt.selected = c.id === state.activeClassId;
    sel.appendChild(opt);
  });
  updateClassProgress();
}

function updateClassProgress() {
  const cls = getActiveClass();
  const students = cls?.students || [];
  const total = students.length;
  const done = students.filter(isStudentDone).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const badge = document.getElementById("classProgressBadge");
  const bar = document.getElementById("classProgressBar");
  if (badge) badge.textContent = `${done} / ${total} Done`;
  if (bar) bar.style.width = `${pct}%`;
}

function exportClassToJSON() {
  const cls = getActiveClass();
  const dataStr = JSON.stringify(cls, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `KlassKit_UpdateHelper_${cls.name.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Class JSON backup exported!");
}

function exportAllCommentsTxt() {
  const cls = getActiveClass();
  const students = (cls?.students || []).filter(isStudentDone);
  if (!students.length) {
    showToast("No generated comments in this class yet.", "warn");
    return;
  }

  const format = state.settings?.format || "breakdown";
  const blocks = students.map((s) => {
    const name = s.name || "Student";
    let body = "";
    if (Array.isArray(s.commentItems) && s.commentItems.length) {
      body = formatCombinedComment(name, s.commentItems, format, state.settings.greeting, state.settings.closing);
    } else if (Array.isArray(s.comments) && s.comments.length) {
      body = s.comments.join("\n\n");
    }
    return `========================================\n${name}\n========================================\n${body}`;
  });

  const header = `${cls.name} — Progress Updates (${students.length} students)\nGenerated by KlassKit Update Helper\n\n`;
  const blob = new Blob([header + blocks.join("\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `UpdateHelper_${cls.name.replace(/\s+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${students.length} student update${students.length !== 1 ? "s" : ""}!`);
}

function triggerImport() {
  document.getElementById("importFile")?.click();
}

function importClassFromJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.name && Array.isArray(data.students)) {
        data.id = Date.now().toString();
        state.classes.push(data);
        switchClass(data.id);
        showToast(`Imported "${data.name}"!`);
      } else {
        throw new Error("Invalid format");
      }
    } catch (err) {
      if (typeof showAlertModal === "function") {
        await showAlertModal("Please select a valid Update Helper class JSON backup.", {
          title: "Import Error",
          icon: "file-x",
          iconColor: "red",
        });
      } else {
        showToast("Invalid class JSON file", "error");
      }
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ── Roster Management ─────────────────────────────────────────────────────────
function setRosterFilter(mode) {
  rosterFilter = mode || "all";
  document.querySelectorAll(".roster-filter-btn").forEach((btn) => {
    const active = btn.getAttribute("data-rf") === rosterFilter;
    btn.classList.toggle("bg-blue", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("bg-slate-100", !active);
    btn.classList.toggle("dark:bg-slate-800", !active);
    btn.classList.toggle("text-dark", !active);
    btn.classList.toggle("dark:text-slate-300", !active);
  });
  renderRoster();
}

function renderRoster() {
  const list = document.getElementById("rosterList");
  const search = (document.getElementById("rosterSearch")?.value || "").trim().toLowerCase();
  const activeCls = getActiveClass();
  const students = activeCls?.students || [];

  const countEl = document.getElementById("rosterCount");
  if (countEl) countEl.textContent = String(students.length);
  updateClassProgress();

  if (!list) return;
  list.innerHTML = "";

  if (students.length === 0) {
    list.innerHTML = `<p class="text-slate-400 font-semibold text-sm italic py-2">No students yet. Click Add or Bulk above.</p>`;
    return;
  }

  const filtered = students.filter((s) => {
    const nameMatch = (s.name || "").toLowerCase().includes(search);
    const done = isStudentDone(s);
    const filterMatch =
      rosterFilter === "all" || (rosterFilter === "done" && done) || (rosterFilter === "pending" && !done);
    return nameMatch && filterMatch;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="text-slate-400 font-semibold text-sm italic py-2">No matching students.</p>`;
    return;
  }

  filtered.forEach((s) => {
    const done = isStudentDone(s);
    const isActive = s.id === state.currentStudentId;
    const avg = computeStudentAverage(s);
    const pLabel = s.pronoun === "he" ? "He" : s.pronoun === "she" ? "She" : "They";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `student-row w-full text-left px-3 py-2.5 rounded-xl border-2 flex items-center justify-between gap-2 ${
      isActive
        ? "bg-blue text-white border-dark dark:border-white shadow-hard-sm"
        : "bg-slate-50 dark:bg-slate-800/80 text-dark dark:text-slate-100 border-dark dark:border-slate-600 hover:border-blue"
    }`;
    btn.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <i data-lucide="${done ? "check-circle-2" : "circle"}" class="w-4 h-4 shrink-0 ${
      done ? (isActive ? "text-white" : "text-green") : (isActive ? "text-white/70" : "text-slate-400")
    }"></i>
        <span class="font-heading font-bold text-sm truncate">${escapeHtml(s.name)}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        ${avg !== null ? `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-black ${isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}">${avg}</span>` : ""}
        <span class="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase ${isActive ? "bg-white/25 text-white" : "bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}">${pLabel}</span>
      </div>`;
    btn.onclick = () => loadStudent(s.id);
    list.appendChild(btn);
  });

  if (window.lucide) lucide.createIcons();
}

function stepStudent(delta) {
  const cls = getActiveClass();
  const students = cls?.students || [];
  if (!students.length) return;
  const idx = students.findIndex((s) => s.id === state.currentStudentId);
  const nextIdx = idx === -1 ? 0 : (idx + delta + students.length) % students.length;
  loadStudent(students[nextIdx].id);
}

// ── Skill Controls Studio ─────────────────────────────────────────────────────
function renderSkillControls() {
  const container = document.getElementById("skillsContainer");
  if (!container) return;

  const categories = ["Classroom Performance", "Social & Emotional", "Academic Progress"];
  const catIcons = {
    "Classroom Performance": { icon: "layout", color: "text-pink" },
    "Social & Emotional": { icon: "heart-handshake", color: "text-orange" },
    "Academic Progress": { icon: "book-open", color: "text-blue" },
  };
  const enabled = state.settings?.enabledSkills || defaultEnabledSkills();

  container.innerHTML = categories
    .map((cat) => {
      const catSkills = SKILLS.filter((sk) => sk.category === cat);
      const meta = catIcons[cat];
      return `
        <div>
          <p class="font-heading font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 ${meta.color}"></i>
            ${escapeHtml(cat)}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            ${catSkills
              .map((sk) => {
                const isOn = enabled[sk.key] !== false;
                return `
                  <div id="skillWrap_${sk.key}" class="p-3.5 rounded-2xl border-3 border-dark dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 flex flex-col gap-2.5 transition-opacity ${isOn ? "" : "opacity-50"}">
                    <div class="flex items-center justify-between gap-2">
                      <label class="flex items-center gap-2 cursor-pointer min-w-0">
                        <input id="chk_${sk.key}" type="checkbox" ${isOn ? "checked" : ""} onchange="toggleSkill('${sk.key}')"
                          class="w-4 h-4 accent-blue rounded cursor-pointer shrink-0" />
                        <i data-lucide="${sk.icon}" class="w-4 h-4 text-${sk.color} shrink-0"></i>
                        <span class="font-heading text-xs uppercase tracking-wide text-dark dark:text-white truncate">${escapeHtml(sk.label)}</span>
                      </label>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span id="band_${sk.key}" class="px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase bg-pink/15 text-pink border-pink/40">Needs Work</span>
                        <input id="num_${sk.key}" type="number" min="0" max="100" value="0"
                          oninput="syncSkillScore('${sk.key}', this.value, 'num')"
                          class="score-num-input w-12 text-center py-0.5 bg-white dark:bg-slate-900 border-2 border-dark dark:border-slate-500 rounded-lg text-xs font-black text-dark dark:text-white" />
                      </div>
                    </div>
                    <input id="s_${sk.key}" type="range" min="0" max="100" value="0"
                      oninput="syncSkillScore('${sk.key}', this.value, 'range')"
                      class="kk-slider slider-${sk.color}" ${isOn ? "" : "disabled"} />
                  </div>`;
              })
              .join("")}
          </div>
        </div>`;
    })
    .join("");

  updateEnabledSkillCount();
  if (window.lucide) lucide.createIcons();
}

function syncSkillScore(key, rawVal, source) {
  const val = clampScore(rawVal);
  const slider = document.getElementById(`s_${key}`);
  const num = document.getElementById(`num_${key}`);
  const band = document.getElementById(`band_${key}`);

  if (source !== "range" && slider) slider.value = val;
  if (source !== "num" && num) num.value = val;

  const info = bandInfo(val);
  if (band) {
    band.className = `px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${info.cls}`;
    band.textContent = info.label;
  }

  // Persist current slider value to active student cleanly
  if (state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) {
      if (!s.scores || typeof s.scores !== "object") s.scores = {};
      s.scores[key] = String(val);
      updateStudentAvgDisplay(s);
      save();
    }
  }
}

function toggleSkill(key) {
  const chk = document.getElementById(`chk_${key}`);
  const on = chk ? chk.checked : true;
  if (!state.settings.enabledSkills) state.settings.enabledSkills = defaultEnabledSkills();
  state.settings.enabledSkills[key] = on;

  const wrap = document.getElementById(`skillWrap_${key}`);
  const slider = document.getElementById(`s_${key}`);
  const num = document.getElementById(`num_${key}`);
  if (wrap) wrap.classList.toggle("opacity-50", !on);
  if (slider) slider.disabled = !on;
  if (num) num.disabled = !on;

  updateEnabledSkillCount();
  if (state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) updateStudentAvgDisplay(s);
  }
  save();
}

function setSkillPreset(mode) {
  if (!state.settings.enabledSkills) state.settings.enabledSkills = defaultEnabledSkills();
  SKILLS.forEach((sk) => {
    const on = mode === "all" ? true : mode === "core" ? sk.core : false;
    state.settings.enabledSkills[sk.key] = on;
    const chk = document.getElementById(`chk_${sk.key}`);
    const wrap = document.getElementById(`skillWrap_${sk.key}`);
    const slider = document.getElementById(`s_${sk.key}`);
    const num = document.getElementById(`num_${sk.key}`);
    if (chk) chk.checked = on;
    if (wrap) wrap.classList.toggle("opacity-50", !on);
    if (slider) slider.disabled = !on;
    if (num) num.disabled = !on;
  });
  updateEnabledSkillCount();
  if (state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) updateStudentAvgDisplay(s);
  }
  save();
}

function updateEnabledSkillCount() {
  const enabled = state.settings?.enabledSkills || defaultEnabledSkills();
  const activeCount = SKILLS.filter((sk) => enabled[sk.key] !== false).length;
  const el = document.getElementById("enabledSkillCount");
  if (el) el.textContent = `${activeCount} / ${SKILLS.length} Active`;
}

function applyPreset(val) {
  if (!state.currentStudentId) {
    showToast("Select a student first", "warn");
    return;
  }
  const s = getStudent(state.currentStudentId);
  if (!s) return;
  if (!s.scores) s.scores = {};

  const enabled = state.settings?.enabledSkills || defaultEnabledSkills();
  let updated = 0;
  SKILLS.forEach((sk) => {
    if (enabled[sk.key] === false) return;
    s.scores[sk.key] = String(val);
    const slider = document.getElementById(`s_${sk.key}`);
    const num = document.getElementById(`num_${sk.key}`);
    const band = document.getElementById(`band_${sk.key}`);
    if (slider) slider.value = val;
    if (num) num.value = val;
    const info = bandInfo(val);
    if (band) {
      band.className = `px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${info.cls}`;
      band.textContent = info.label;
    }
    updated++;
  });

  if (!updated) {
    showToast("Enable at least one skill first", "warn");
    return;
  }

  updateStudentAvgDisplay(s);
  renderRoster();
  save();
  showToast(`Filled ${updated} enabled skills to ${val}`);
}

function updateStudentAvgDisplay(student) {
  const avg = computeStudentAverage(student);
  const badge = document.getElementById("studentAvgBadge");
  const outBadge = document.getElementById("outputAvgBadge");

  if (avg === null) {
    if (badge) {
      badge.className = "px-2.5 py-0.5 rounded-full border-2 border-dark text-[11px] font-black uppercase bg-slate-100 dark:bg-slate-700";
      badge.textContent = "Avg —";
    }
    if (outBadge) outBadge.textContent = "";
    return;
  }
  const info = bandInfo(avg);
  if (badge) {
    badge.className = `px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase ${info.cls}`;
    badge.textContent = `Avg ${avg} · ${info.label}`;
  }
  if (outBadge) outBadge.textContent = `Avg ${avg} · ${info.label}`;
}

function setPronoun(p) {
  currentPronoun = p;
  renderPronounButtons();
  if (state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) {
      s.pronoun = p;
      save();
      renderRoster();
    }
  }
}

function renderPronounButtons() {
  document.querySelectorAll(".pronoun-btn").forEach((btn) => {
    const p = btn.getAttribute("data-pronoun");
    const active = p === currentPronoun;
    btn.classList.toggle("bg-blue", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("bg-white", !active);
    btn.classList.toggle("dark:bg-slate-900", !active);
    btn.classList.toggle("text-dark", !active);
    btn.classList.toggle("dark:text-slate-200", !active);
  });
}

function setCommentFormat(fmt) {
  state.settings.format = fmt === "paragraph" ? "paragraph" : "breakdown";
  const bBtn = document.getElementById("fmt-breakdown");
  const pBtn = document.getElementById("fmt-paragraph");
  const isPara = state.settings.format === "paragraph";

  if (bBtn) {
    bBtn.classList.toggle("bg-blue", !isPara);
    bBtn.classList.toggle("text-white", !isPara);
    bBtn.classList.toggle("text-dark", isPara);
    bBtn.classList.toggle("dark:text-slate-300", isPara);
  }
  if (pBtn) {
    pBtn.classList.toggle("bg-blue", isPara);
    pBtn.classList.toggle("text-white", isPara);
    pBtn.classList.toggle("text-dark", !isPara);
    pBtn.classList.toggle("dark:text-slate-300", !isPara);
  }

  save();
  if (lastCommentItems.length && state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) refreshCombinedPreview(s.name, lastCommentItems);
  }
}

function showEmptyStudentState() {
  state.currentStudentId = null;
  document.getElementById("noStudentState")?.classList.remove("hidden");
  document.getElementById("scoreStudio")?.classList.add("hidden");
  document.getElementById("outputSection")?.classList.add("hidden");
  renderRoster();
}

function loadStudent(id) {
  const s = getStudent(id);
  if (!s) {
    showEmptyStudentState();
    return;
  }
  state.currentStudentId = id;
  saveLocal();

  document.getElementById("noStudentState")?.classList.add("hidden");
  document.getElementById("scoreStudio")?.classList.remove("hidden");

  const avatar = document.getElementById("studentAvatar");
  const titleEl = document.getElementById("formTitle");
  if (avatar) avatar.textContent = (s.name || "?").trim().charAt(0).toUpperCase();
  if (titleEl) titleEl.textContent = s.name;

  const sc = s.scores || {};
  SKILLS.forEach((sk) => {
    const val = clampScore(sc[sk.key] ?? 0);
    const slider = document.getElementById(`s_${sk.key}`);
    const num = document.getElementById(`num_${sk.key}`);
    const band = document.getElementById(`band_${sk.key}`);
    if (slider) slider.value = val;
    if (num) num.value = val;
    const info = bandInfo(val);
    if (band) {
      band.className = `px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${info.cls}`;
      band.textContent = info.label;
    }
  });

  currentPronoun = s.pronoun || "they";
  renderPronounButtons();
  updateStudentAvgDisplay(s);
  renderRoster();
  hideError();

  if (Array.isArray(s.commentItems) && s.commentItems.length > 0) {
    renderComments(s.name, s.commentItems);
  } else if (Array.isArray(s.comments) && s.comments.length > 0 && String(s.comments[0] || "").trim()) {
    renderLegacyComments(s.name, s.comments);
  } else {
    lastCommentItems = [];
    document.getElementById("outputSection")?.classList.add("hidden");
  }
}

async function renameCurrentStudent() {
  const s = getStudent(state.currentStudentId);
  if (!s) return;
  const next =
    typeof quickPrompt === "function"
      ? await quickPrompt("Rename student:", s.name)
      : prompt("Rename student:", s.name);
  if (!next || !next.trim()) return;
  s.name = next.trim();
  save();
  loadStudent(s.id);
  showToast(`Renamed to "${s.name}"`);
}

async function deleteCurrentStudent() {
  if (!state.currentStudentId) return;
  const s = getStudent(state.currentStudentId);
  const confirmed =
    typeof showConfirmModal === "function"
      ? await showConfirmModal(`Delete "${s?.name || "this student"}" and their scores?`, {
          title: "Delete Student?",
          confirmText: "Delete",
          cancelText: "Keep",
          icon: "trash-2",
          iconColor: "red",
        })
      : confirm("Delete this student?");
  if (!confirmed) return;

  const cls = getActiveClass();
  cls.students = cls.students.filter((st) => st.id !== state.currentStudentId);
  state.currentStudentId = cls.students[0]?.id || null;
  save();
  renderRoster();
  if (state.currentStudentId) loadStudent(state.currentStudentId);
  else showEmptyStudentState();
  showToast("Student removed");
}

// ── Single & Bulk Add Modals ──────────────────────────────────────────────────
function setModalPronoun(p) {
  modalPronoun = p || "they";
  document.querySelectorAll(".modal-pronoun-btn").forEach((btn) => {
    const active = btn.getAttribute("data-mp") === modalPronoun;
    btn.classList.toggle("bg-blue", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("bg-slate-100", !active);
    btn.classList.toggle("dark:bg-slate-800", !active);
    btn.classList.toggle("text-dark", !active);
    btn.classList.toggle("dark:text-slate-200", !active);
  });
}

function addNewStudent() {
  const input = document.getElementById("modalName");
  if (input) input.value = "";
  setModalPronoun("they");
  document.getElementById("modal")?.classList.remove("hidden");
  setTimeout(() => input?.focus(), 50);
}

function closeModal() {
  document.getElementById("modal")?.classList.add("hidden");
}

function confirmAddStudent() {
  const input = document.getElementById("modalName");
  const name = (input?.value || "").trim();
  if (!name) return;
  const s = { id: Date.now().toString(), name, scores: {}, comments: null, commentItems: null, pronoun: modalPronoun };
  const cls = getActiveClass();
  cls.students.push(s);
  save();
  closeModal();
  renderClassSelector();
  loadStudent(s.id);
  showToast(`Added "${name}"`);
}

function openBulkAddModal() {
  const ta = document.getElementById("bulkNames");
  if (ta) ta.value = "";
  document.getElementById("bulkModal")?.classList.remove("hidden");
  setTimeout(() => ta?.focus(), 50);
}

function closeBulkModal() {
  document.getElementById("bulkModal")?.classList.add("hidden");
}

function confirmBulkAdd() {
  const raw = document.getElementById("bulkNames")?.value || "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    showToast("Paste at least one student name", "warn");
    return;
  }

  const cls = getActiveClass();
  const baseTs = Date.now();
  let firstNewId = null;
  let added = 0;

  lines.forEach((line, idx) => {
    const parts = line.split(",");
    const name = (parts[0] || "").trim();
    if (!name) return;
    const rawP = (parts[1] || "").trim().toLowerCase();
    const pronoun = rawP === "he" || rawP === "him" ? "he" : rawP === "she" || rawP === "her" ? "she" : "they";
    const id = `${baseTs}_${idx}`;
    if (!firstNewId) firstNewId = id;
    cls.students.push({ id, name, scores: {}, comments: null, commentItems: null, pronoun });
    added++;
  });

  if (!added) return;
  save();
  closeBulkModal();
  renderClassSelector();
  if (firstNewId) loadStudent(firstNewId);
  showToast(`Added ${added} student${added !== 1 ? "s" : ""}`);
}

// ── Comment & Grammar Engine ──────────────────────────────────────────────────
async function loadComments() {
  try {
    const resp = await fetch("comments.json");
    if (!resp.ok) throw new Error("Network response was not ok");
    hopefulPhrases = await resp.json();
  } catch (e) {
    console.error("Failed to load comments:", e);
    showError("Failed to load comment phrase bank. Please refresh.");
  }
}

function level(v) {
  const n = +v;
  if (n >= 90) return "excellent";
  if (n >= 70) return "good";
  if (n >= 50) return "developing";
  return "needs_work";
}

function pick(arr, exclude = "") {
  if (!arr || arr.length === 0) return "...";
  if (arr.length === 1) return arr[0];
  const candidates = exclude ? arr.filter((x) => x !== exclude) : arr;
  const pool = candidates.length ? candidates : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

const PRONOUN_MAP = {
  he: { subject: "He", object: "him", poss: "his", refl: "himself", are: "is", were: "was" },
  she: { subject: "She", object: "her", poss: "her", refl: "herself", are: "is", were: "was" },
  they: { subject: "They", object: "them", poss: "their", refl: "themselves", are: "are", were: "were" },
};

const ADVERBS =
  "always|clearly|consistently|generally|mostly|never|often|rarely|really|slowly|sometimes|still|truly|usually|also";

const MODALS = new Set([
  "can", "will", "would", "could", "should", "may", "might", "must", "shall",
]);

function conjugate3rd(verb) {
  const low = String(verb || "").toLowerCase();
  if (!low || MODALS.has(low)) return verb;
  if (low === "are" || low === "is") return "is";
  if (low === "were" || low === "was") return "was";
  if (low === "have" || low === "has") return "has";
  if (low === "do" || low === "does") return "does";
  if (low === "go" || low === "goes") return "goes";
  if (/(?:s|sh|ch|x|z)$/.test(low)) return verb + "es";
  if (/[^aeiou]y$/.test(low)) return verb.slice(0, -1) + "ies";
  return verb + "s";
}

function conjugateSubjectToken(text, subjCap, subjLow, onlyFirst = false) {
  let out = String(text || "");
  let matchedAny = false;

  const replaceOneOrAll = (re, replacer) => {
    if (onlyFirst && matchedAny) return;
    if (onlyFirst) {
      let replaced = false;
      out = out.replace(re, (...args) => {
        if (replaced) return args[0];
        replaced = true;
        matchedAny = true;
        return replacer(...args);
      });
    } else {
      out = out.replace(re, replacer);
    }
  };

  // Preserve capitalization when first word was uppercase "They", else use subjLow
  const pickSubj = (tok) => (tok.charAt(0) === "T" ? subjCap : subjLow);

  // 1a. Multi-word coordinated VP after They: "share nicely and play", "share everything and always play", "help others and make"
  const coordMultiRe = new RegExp(
    `\\b(They|they)\\s+(share|help)(\\s+(?:nicely|everything|others))\\s+and\\s+(?:(${ADVERBS})\\s+)?(\\w+)`,
    onlyFirst ? "" : "g",
  );
  replaceOneOrAll(coordMultiRe, (_, tok, v1, mid, adv, v2) => {
    const advPart = adv ? `${adv} ` : "";
    return `${pickSubj(tok)} ${conjugate3rd(v1)}${mid} and ${advPart}${conjugate3rd(v2)}`;
  });

  // 1b. Two verbs joined directly with "and": "remember and use", "speak and write"
  const coordPairRe = /\b(They|they)\s+(remember|speak|think|read|listen|write|share|help|learn|try)\s+and\s+(use|write|speak|listen|apply|play|make|understand|read)\b/g;
  replaceOneOrAll(coordPairRe, (_, tok, v1, v2) => {
    return `${pickSubj(tok)} ${conjugate3rd(v1)} and ${conjugate3rd(v2)}`;
  });

  // 2. Adverb + verb: "They always complete" -> "He always completes"
  const advVerbRe = new RegExp(`\\b(They|they)\\s+(${ADVERBS})\\s+(\\w+)`, onlyFirst ? "" : "g");
  replaceOneOrAll(advVerbRe, (_, tok, adv, v) => {
    return `${pickSubj(tok)} ${adv} ${conjugate3rd(v)}`;
  });

  // 3. Remaining "They + verb": "They are", "They were", "They have", "They participate"
  const simpleRe = /\b(They|they)\s+(\w+)/g;
  replaceOneOrAll(simpleRe, (_, tok, v) => {
    return `${pickSubj(tok)} ${conjugate3rd(v)}`;
  });

  return out;
}

function applyPronoun(text, pronoun) {
  let out = String(text || "");
  if (!pronoun || pronoun === "they") return out;
  const m = PRONOUN_MAP[pronoun];
  if (!m) return out;

  // 1. Reflexive
  out = out
    .replace(/\bthemselves\b/g, m.refl)
    .replace(/\bThemselves\b/g, m.refl.charAt(0).toUpperCase() + m.refl.slice(1));

  // 2. Possessive (before object)
  out = out
    .replace(/\bTheir\b/g, m.poss.charAt(0).toUpperCase() + m.poss.slice(1))
    .replace(/\btheir\b/g, m.poss);

  // 3. Object
  out = out
    .replace(/\bthem\b/g, m.object)
    .replace(/\bThem\b/g, m.object.charAt(0).toUpperCase() + m.object.slice(1));

  // 4. Subject + verb conjugation
  return conjugateSubjectToken(out, m.subject, m.subject.toLowerCase(), false);
}

function personalise(text, name, pronoun, forceName = null) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return text;

  const useName = forceName !== null ? forceName : Math.random() > 0.5;
  if (!useName) return text;

  if (pronoun === "he") {
    return String(text).replace(/\b[Hh]e\b/, cleanName);
  }
  if (pronoun === "she") {
    return String(text).replace(/\b[Ss]he\b/, cleanName);
  }
  // For 'they', replace ONLY the first "They <clause>" with singular name conjugation
  if (/\b[Tt]hey\s+/.test(text)) {
    return conjugateSubjectToken(text, cleanName, cleanName, true);
  }
  return text;
}

function generateSkillCommentItem(sk, scoreVal, name, pronoun, excludeRaw = "") {
  const score = clampScore(scoreVal);
  const lvl = bandInfo(score).key;
  const bank = (hopefulPhrases[sk.key] && hopefulPhrases[sk.key][lvl]) || [];
  const raw = pick(bank, excludeRaw);
  const withPronoun = applyPronoun(raw, pronoun);
  const finalTxt = personalise(withPronoun, name, pronoun);
  return {
    key: sk.key,
    label: sk.label,
    score,
    level: lvl,
    text: finalTxt,
    _raw: raw,
  };
}

function buildComments(name, sc, pronoun = "they", enabledSkills = null) {
  const enabled = enabledSkills || defaultEnabledSkills();
  const items = [];
  SKILLS.forEach((sk) => {
    if (enabled[sk.key] === false) return;
    items.push(generateSkillCommentItem(sk, sc[sk.key] ?? 0, name, pronoun));
  });
  return items;
}

function formatCombinedComment(name, items, format = "breakdown", greetingTpl = "", closingTpl = "") {
  const cleanName = String(name || "Student").trim();
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "";

  const greet = (greetingTpl || "Here is {name}'s progress update:").replace(/\{name\}/g, cleanName);
  const close = (closingTpl || "Keep up the great work, {name}!").replace(/\{name\}/g, cleanName);

  if (format === "paragraph") {
    const body = list.map((it) => String(it.text || "").trim()).filter(Boolean).join(" ");
    return `${cleanName}'s Progress Update: ${body} ${close}`.trim();
  }

  let out = `${greet}\n\n`;
  list.forEach((it) => {
    out += `• ${it.label}:\n  ${String(it.text || "").trim()}\n\n`;
  });
  out += close;
  return out.trim();
}

// ── Save & Generate + Interactive Editing ─────────────────────────────────────
function collectEnabledScoresFromUI() {
  const enabled = state.settings?.enabledSkills || defaultEnabledSkills();
  const fields = {};
  let enabledCount = 0;

  for (const sk of SKILLS) {
    const slider = document.getElementById(`s_${sk.key}`);
    const val = slider ? slider.value : "0";
    fields[sk.key] = val;

    if (enabled[sk.key] !== false) {
      enabledCount++;
      if (val === "" || isNaN(+val)) {
        return { error: `Please enter a valid score for "${sk.label}".` };
      }
      if (+val < 0 || +val > 100) {
        return { error: `"${sk.label}" must be between 0 and 100.` };
      }
    }
  }

  if (enabledCount === 0) {
    return { error: "Enable at least one skill checkbox before generating." };
  }
  return { fields, enabled };
}

function saveAndGenerate() {
  if (!state.currentStudentId) {
    showError("Please select or add a student first.");
    return;
  }
  const s = getStudent(state.currentStudentId);
  if (!s) return;

  const collected = collectEnabledScoresFromUI();
  if (collected.error) {
    showError(collected.error);
    return;
  }
  hideError();

  s.scores = collected.fields;
  s.pronoun = currentPronoun;
  s.commentItems = buildComments(s.name, collected.fields, currentPronoun, collected.enabled);
  s.comments = [
    formatCombinedComment(
      s.name,
      s.commentItems,
      state.settings.format,
      state.settings.greeting,
      state.settings.closing,
    ),
  ];

  save(true);
  renderRoster();
  updateStudentAvgDisplay(s);
  renderComments(s.name, s.commentItems, true);
  showToast(`Generated update for ${s.name}`);
}

function shuffleAllComments() {
  if (!state.currentStudentId) return;
  saveAndGenerate();
}

function rerollSkill(key) {
  const s = getStudent(state.currentStudentId);
  if (!s || !Array.isArray(s.commentItems)) return;
  const sk = SKILLS.find((x) => x.key === key);
  const idx = s.commentItems.findIndex((it) => it.key === key);
  if (!sk || idx === -1) return;

  const prevRaw = s.commentItems[idx]._raw || "";
  const sliderVal = document.getElementById(`s_${key}`)?.value ?? s.scores?.[key] ?? 0;
  const nextItem = generateSkillCommentItem(sk, sliderVal, s.name, currentPronoun, prevRaw);
  s.commentItems[idx] = nextItem;
  s.comments = [
    formatCombinedComment(
      s.name,
      s.commentItems,
      state.settings.format,
      state.settings.greeting,
      state.settings.closing,
    ),
  ];

  save();
  renderComments(s.name, s.commentItems, false);
  showToast(`Re-rolled ${sk.label}`);
}

function updateSkillCommentText(key, newText) {
  const s = getStudent(state.currentStudentId);
  if (!s || !Array.isArray(s.commentItems)) return;
  const idx = s.commentItems.findIndex((it) => it.key === key);
  if (idx === -1) return;
  s.commentItems[idx].text = newText;
  lastCommentItems = s.commentItems;
  refreshCombinedPreview(s.name, s.commentItems, false);
  s.comments = [document.getElementById("combinedPreview")?.value || ""];
  save();
}

function onCombinedPreviewEdit(val) {
  const s = getStudent(state.currentStudentId);
  if (!s) return;
  s.comments = [val];
  updateOutputStats(val);
  save();
}

function updateOutputStats(text) {
  const str = String(text || "").trim();
  const chars = str.length;
  const words = str ? str.split(/\s+/).length : 0;
  const el = document.getElementById("outputStats");
  if (el) el.textContent = `${chars} chars · ${words} words`;
}

function refreshCombinedPreview(name, items, updateStudentComments = true) {
  const combined = formatCombinedComment(
    name,
    items,
    state.settings.format,
    state.settings.greeting,
    state.settings.closing,
  );
  const preview = document.getElementById("combinedPreview");
  if (preview) preview.value = combined;
  updateOutputStats(combined);

  if (updateStudentComments && state.currentStudentId) {
    const s = getStudent(state.currentStudentId);
    if (s) s.comments = [combined];
  }
}

function renderComments(name, items, scrollInto = false) {
  lastCommentItems = items || [];
  const outName = document.getElementById("outputName");
  const container = document.getElementById("commentCards");
  const section = document.getElementById("outputSection");
  if (outName) outName.textContent = `Update for ${name}`;

  const s = getStudent(state.currentStudentId);
  if (s) updateStudentAvgDisplay(s);

  refreshCombinedPreview(name, lastCommentItems, false);

  if (container) {
    container.innerHTML = "";
    lastCommentItems.forEach((item, i) => {
      const sk = SKILLS.find((x) => x.key === item.key) || { icon: "star", color: "blue" };
      const b = bandInfo(item.score);
      const card = document.createElement("div");
      card.className =
        "comment-skill-card bg-slate-50/90 dark:bg-slate-800/70 border-3 border-dark dark:border-slate-600 rounded-2xl p-3.5 shadow-hard-sm flex flex-col gap-2";
      card.style.animationDelay = `${Math.min(i * 30, 260)}ms`;
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="${sk.icon}" class="w-4 h-4 text-${sk.color} shrink-0"></i>
            <span class="font-heading font-bold text-xs uppercase tracking-wider text-dark dark:text-white truncate">${escapeHtml(item.label)}</span>
            <span class="px-1.5 py-0.5 rounded-md border text-[10px] font-black ${b.cls}">${item.score}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="rerollSkill('${escapeHtml(item.key)}')" title="Pick another phrase" aria-label="Re-roll ${escapeHtml(item.label)}"
              class="p-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-dark dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-orange transition-colors">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" onclick="copySkill('${escapeHtml(item.key)}')" title="Copy this skill comment" aria-label="Copy ${escapeHtml(item.label)}"
              class="p-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-dark dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-blue transition-colors">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        <textarea rows="3" oninput="updateSkillCommentText('${escapeHtml(item.key)}', this.value)"
          class="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-semibold text-dark dark:text-slate-100 leading-relaxed resize-y focus:border-blue">${escapeHtml(item.text)}</textarea>
      `;
      container.appendChild(card);
    });
  }

  if (section) {
    section.classList.remove("hidden");
    if (scrollInto) section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (window.lucide) lucide.createIcons();
}

function renderLegacyComments(name, comments) {
  lastCommentItems = [];
  const outName = document.getElementById("outputName");
  const container = document.getElementById("commentCards");
  const preview = document.getElementById("combinedPreview");
  const section = document.getElementById("outputSection");
  const joined = (comments || []).join("\n\n");

  if (outName) outName.textContent = `Update for ${name}`;
  if (preview) preview.value = joined;
  updateOutputStats(joined);

  if (container) {
    container.innerHTML = `
      <div class="col-span-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
        Loaded legacy comment text. Click <strong>Save &amp; Generate</strong> above to upgrade into individual editable skill cards.
      </div>`;
  }
  if (section) section.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function copySkill(key) {
  const found = lastCommentItems.find((it) => it.key === key);
  if (!found) return;
  navigator.clipboard?.writeText(found.text).then(() => showToast(`${found.label} comment copied!`));
}

function copyFullUpdate() {
  const val = document.getElementById("combinedPreview")?.value || "";
  if (!val.trim()) {
    showToast("Nothing to copy yet", "warn");
    return;
  }
  navigator.clipboard?.writeText(val).then(() => showToast("Full progress update copied!"));
}

function copyAsParagraph() {
  const s = getStudent(state.currentStudentId);
  if (!s) return;
  if (!lastCommentItems.length) {
    copyFullUpdate();
    return;
  }
  const para = formatCombinedComment(
    s.name,
    lastCommentItems,
    "paragraph",
    state.settings.greeting,
    state.settings.closing,
  );
  navigator.clipboard?.writeText(para).then(() => showToast("Paragraph update copied!"));
}

function showError(msg) {
  const box = document.getElementById("errorBox");
  const msgEl = document.getElementById("errorMsg");
  if (msgEl) msgEl.textContent = msg;
  if (box) box.classList.remove("hidden");
}

function hideError() {
  document.getElementById("errorBox")?.classList.add("hidden");
}

// ── Init & Keyboard Listeners ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("load", async () => {
    if (typeof requirePro === "function") await requirePro();
    renderSkillControls();
    migrateLegacyStudents();
    loadLocal();
    await syncWithCloud();
    await loadComments();

    setCommentFormat(state.settings?.format || "breakdown");
    renderClassSelector();
    renderRoster();

    const modalEl = document.getElementById("modal");
    if (modalEl) {
      modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) closeModal();
      });
    }
    const bulkModalEl = document.getElementById("bulkModal");
    if (bulkModalEl) {
      bulkModalEl.addEventListener("click", (e) => {
        if (e.target === bulkModalEl) closeBulkModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeBulkModal();
      }
    });

    const activeCls = getActiveClass();
    if (state.currentStudentId && getStudent(state.currentStudentId)) {
      loadStudent(state.currentStudentId);
    } else if (activeCls?.students?.length > 0) {
      loadStudent(activeCls.students[0].id);
    } else {
      showEmptyStudentState();
    }

    if (window.lucide) lucide.createIcons();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SKILLS,
    level,
    conjugate3rd,
    applyPronoun,
    personalise,
    buildComments,
    formatCombinedComment,
  };
}

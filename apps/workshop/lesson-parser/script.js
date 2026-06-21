let quill;
let dataBase;

const appState = {
  activeId: null, // null means unsaved scratchpad
  current: {
    title: "",
    aims: "",
    modules: [],
    rawText: "",
  },
  library: [],
};

// ── Initialization ────────────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  if (typeof requirePro === "function") await requirePro();
  initQuill();
  await initDB();

  // Load from Cloud / Local
  await initializeData();

  lucide.createIcons();
});

async function initializeData() {
  // 1. Load Session & Library from Cloud
  let cloudLoaded = false;
  let cloudTime = 0;
  let cloudActiveId = null;
  try {
    const user = await (typeof getUser === "function" ? getUser() : null);
    if (user && typeof db !== "undefined") {
      const { data, error } = await db
        .from("workshop_lessonparser")
        .select("*")
        .eq("user_id", user.id);

      if (!error && data) {
        cloudLoaded = true;
        const sessionRow = data.find((row) => row.local_id === 0);
        const libraryRows = data.filter((row) => row.local_id !== 0);

        if (sessionRow) {
          cloudTime = new Date(sessionRow.last_used).getTime();
          cloudActiveId = sessionRow.usage_count || null;
          appState.current.title = sessionRow.name || "";
          appState.current.aims = sessionRow.unit_aims || "";
          appState.current.modules = sessionRow.modules || [];
          appState.current.rawText = sessionRow.raw_text || "";
        }

        const cloudLibrary = libraryRows.map((row) => ({
          id: row.local_id,
          name: row.name,
          unitAims: row.unit_aims,
          modules: row.modules,
          rawText: row.raw_text || "",
          lastUsed: new Date(row.last_used).getTime(),
          createdAt: new Date(row.created_at).getTime(),
          usageCount: row.usage_count,
        }));

        appState.library = cloudLibrary;

        if (dataBase) {
          const tx = dataBase.transaction("library", "readwrite");
          const store = tx.objectStore("library");
          cloudLibrary.forEach((set) => store.put(set));
        }
      }
    }
  } catch (e) {
    console.warn("Cloud data load failed", e);
  }

  // 2. Fallback / Merge with local persistence
  const local = localStorage.getItem("lp_session");
  if (local) {
    try {
      const session = JSON.parse(local);
      const localTime = session.lastSaved || 0;
      
      // Restore rawText from localStorage only if cloud didn't provide it
      if (!cloudLoaded && session.data && session.data.rawText) {
        appState.current.rawText = session.data.rawText;
      }
      
      // Compare timestamps: use local data if it's newer than cloud
      if (!cloudLoaded || cloudTime < localTime) {
        appState.current = { ...appState.current, ...session.data };
        appState.activeId = session.activeId;
      } else if (cloudLoaded) {
        // Cloud is newer, use cloud activeId
        appState.activeId = cloudActiveId;
      }
    } catch (e) { }
  }

  // Populate UI
  updateUIFromState();
  renderLibrary();
}

function updateUIFromState() {
  const data = appState.current;
  document.getElementById("unit-title-input").value = data.title || "";
  document.getElementById("unit-aims-input").value = data.aims || "";

  if (quill) {
    quill.root.innerHTML = data.rawText || "";
  }

  if (data.modules) {
    renderModules(data.modules);
    renderOverview(data.modules);
  }

  updateActiveIndicator();
}

function updateActiveIndicator() {
  const nameEl = document.getElementById("current-set-name");
  const indicator = document.getElementById("save-status-indicator");

  if (appState.activeId) {
    const set = appState.library.find((s) => s.id === appState.activeId);
    nameEl.innerText = `Editing: ${set ? set.name : "Unknown"}`;
    indicator.className = "w-1.5 h-1.5 rounded-full bg-green-500";
  } else {
    nameEl.innerText = "Unsaved Session";
    indicator.className = "w-1.5 h-1.5 rounded-full bg-orange-400";
  }
}

function initQuill() {
  quill = new Quill("#editor-container", {
    theme: "snow",
    placeholder: "Paste teacher notes text here...",
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
  const darkIcon = document.getElementById("dark-icon");
  if (darkIcon) {
    darkIcon.setAttribute("data-lucide", dark ? "sun" : "moon");
    lucide.createIcons();
  }
  localStorage.setItem("theme", dark ? "dark" : "light");
}

if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
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

// ── Persistence Logic ────────────────────────────────────────────────────────
function updateSessionPersistence() {
  // Collect current data
  appState.current = {
    title: document.getElementById("unit-title-input").value,
    aims: document.getElementById("unit-aims-input").value,
    rawText: quill.root.innerHTML,
    modules: appState.current.modules || [],
  };

  // Save to local storage for quick persistence (Rule #7)
  // Note: rawText is intentionally omitted from localStorage to prevent quota issues
  const snapshot = {
    title: appState.current.title,
    aims: appState.current.aims,
    modules: appState.current.modules || [],
    // rawText intentionally omitted - only kept in memory
  };
  
  localStorage.setItem(
    "lp_session",
    JSON.stringify({
      activeId: appState.activeId,
      lastSaved: Date.now(),
      data: snapshot,
    }),
  );

  // Auto-save to library if active
  if (appState.activeId) {
    autoSaveToLibrary();
  }

  syncToCloud();
}

let cloudSyncTimeout;
function syncToCloud() {
  clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(async () => {
    // 1. Fetch latest from IndexedDB to ensure memory cache is fresh before cloud sync
    if (!dataBase) return;
    const tx = dataBase.transaction("library", "readonly");
    const store = tx.objectStore("library");
    const req = store.getAll();

    req.onsuccess = async () => {
        appState.library = req.result;

        // 2. Sync Everything to Dedicated Table
        const user = await (typeof getUser === "function" ? getUser() : null);
        if (user && typeof db !== "undefined") {
          // A. Map Library items
          const rows = appState.library.map((set) => ({
            user_id: user.id,
            local_id: set.id,
            name: set.name,
            unit_aims: set.unitAims,
            modules: set.modules,
            raw_text: set.rawText || "",
            last_used: new Date(set.lastUsed || Date.now()).toISOString(),
            usage_count: set.usageCount || 1,
          }));

          // B. Add Session row (local_id: 0)
          rows.push({
            user_id: user.id,
            local_id: 0,
            name: appState.current.title || "Session",
            unit_aims: appState.current.aims || "",
            modules: appState.current.modules || [],
            raw_text: appState.current.rawText || "",
            last_used: new Date().toISOString(),
            usage_count: appState.activeId || 0, // TODO: migrate to active_set_id column
          });

          if (rows.length > 0) {
            const { error } = await db
              .from("workshop_lessonparser")
              .upsert(rows, { onConflict: "user_id,local_id" });
            if (error) {
              console.error("[Sync] Cloud sync error:", error);
              
              // Surface error in UI: turn indicator red and show toast
              const indicator = document.getElementById("save-status-indicator");
              if (indicator) {
                indicator.className = "w-1.5 h-1.5 rounded-full bg-red-500";
                showToast("❌ Sync failed - check connection");
              }
              return;
            }
          }
        }

        // Visual feedback: pulse the status indicator green on success
        const indicator = document.getElementById("save-status-indicator");
        if (indicator) {
          indicator.className = "w-1.5 h-1.5 rounded-full bg-green-500";
          indicator.classList.add("animate-pulse");
          setTimeout(() => indicator.classList.remove("animate-pulse"), 1000);
        }
    };
  }, 2000);
}

async function autoSaveToLibrary() {
  if (!appState.activeId) return;

  const tx = dataBase.transaction("library", "readwrite");
  const store = tx.objectStore("library");

  const req = store.get(appState.activeId);
  req.onsuccess = () => {
    const set = req.result;
    if (set) {
      set.name = appState.current.title || "Untitled Lesson";
      set.unitAims = appState.current.aims;
      set.modules = appState.current.modules;
      set.rawText = appState.current.rawText || "";
      set.lastUsed = Date.now();
      store.put(set);
      
      // Keep memory cache in sync with IndexedDB
      const idx = appState.library.findIndex(s => s.id === appState.activeId);
      if (idx !== -1) {
        appState.library[idx] = { ...set };
      }
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
  appState.current = { title: "", aims: "", modules: [], rawText: "" };

  updateUIFromState();
  showToast("🗑️ Session cleared");
  syncToCloud();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 stroke-[2.5]" style="color:#00E676;flex-shrink:0;"></i><span>${msg}</span>`;
  c.appendChild(t);
  lucide.createIcons();
  setTimeout(() => {
    t.classList.add("show");
  }, 10);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(-20px)";
    setTimeout(() => t.remove(), 400);
  }, 2800);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  ["paste", "overview"].forEach((t) => {
    const btn = document.getElementById("tab-" + t);
    if (btn) btn.classList.remove("active");
  });

  const activeBtn = document.getElementById("tab-" + tab);
  if (activeBtn) activeBtn.classList.add("active");

  const overviewView = document.getElementById("view-overview");
  const modulesView = document.getElementById("view-modules");

  if (tab === "overview") {
    if (overviewView) overviewView.classList.remove("hidden");
    if (modulesView) modulesView.classList.add("hidden");
  } else {
    if (overviewView) overviewView.classList.add("hidden");
    if (modulesView) modulesView.classList.remove("hidden");
  }
}

async function updateUnitMetadata() {
  updateSessionPersistence();
}

async function processPastedText() {
  const fullText = quill.getText();
  if (!fullText.trim()) {
    showToast("⚠️ Nothing to extract!");
    return;
  }

  // Generate bold stream from Quill Delta
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

  const container = document.getElementById("modules-container");
  if (container) container.innerHTML = "";

  let title =
    document.getElementById("unit-title-input").value || "Lesson Extractor";
  const tm = fullText.match(/(Book\s+\d+,\s+Unit\s+\d+)/i);
  if (tm && !document.getElementById("unit-title-input").value) {
    title = tm[1];
    document.getElementById("unit-title-input").value = title;
    document.getElementById("doc-title").innerText = title;
  }

  const am = fullText.match(
    /(?:the\s+)?students\s+will\s+be\s+able\s+to\s*[.]{2,3}\s*\n?([\s\S]+?)(?=\n\s*(?:Tip:|Vocabulary:|Unit Quiz:|Reading:|Listening:|Grammar:|$))/i,
  );
  if (am && !document.getElementById("unit-aims-input").value) {
    document.getElementById("unit-aims-input").value = am[1].trim();
  }

  const modules = parseExtractedText(fullText, boldText);
  appState.current.modules = modules;
  appState.current.rawText = quill.root.innerHTML;
  appState.current.title = title;
  appState.current.aims = document.getElementById("unit-aims-input").value;

  updateSessionPersistence();
  renderModules(modules);
  renderOverview(modules);
  showToast(
    `✅ ${modules.length} module${modules.length !== 1 ? "s" : ""} extracted!`,
  );
}

// ── Parser Logic ──────────────────────────────────────────────────────────────
function isJunk(line) {
  const s = line.trim();
  return (
    !s ||
    s.length < 2 ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s) ||
    /^https?:\/\//.test(s) ||
    /Teacher Notes/i.test(s) ||
    /^Frontrunner/i.test(s) ||
    /^Book \d+/i.test(s)
  );
}

const ANCHORS = [
  "Target Language:",
  "Target Grammar:",
  "Materials:",
  "Preparation:",
  "In this section",
];

const BODY_RE =
  /\n[ \t]*(?=(?:Setting the Context|Pre-?reading|Post-?reading|Pre-?speaking|Post-?speaking|Pre-?writing|Post-?writing|Pre-?listening|Post-?listening|Introducing |Using |Listening: |Speaking: |Reading: |Writing: |Tell the |Have the |Use slide|Use Presentation|Discuss |Divide |Distribute |Ask the|Open Presentation|Display |Inform |Show the))/;

function splitChunk(chunk) {
  const m = BODY_RE.exec(chunk);
  if (m) return { header: chunk.slice(0, m.index), body: chunk.slice(m.index) };
  return { header: chunk, body: "" };
}

function extractField(key, header) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stopPat = ANCHORS.filter((a) => a !== key)
    .map(esc)
    .join("|");
  const re = new RegExp(
    `${esc(key)}\\s*(.*?)(?=\\n\\s*(?:${stopPat}|$))`,
    "is",
  );
  const m = re.exec(header);
  if (!m) return [];

  return m[1]
    .split("\n")
    .map((s) => s.replace(/^[-•…*]\s*/, "").trim())
    .filter((s) => !isJunk(s));
}

function expandNums(str) {
  const out = new Set();
  str
    .replace(/\band\b/gi, ",")
    .split(/[,\s]+/)
    .forEach((p) => {
      const r = p.match(/^(\d+)[-–](\d+)$/);
      if (r) {
        const lo = +r[1],
          hi = +r[2];
        if (hi - lo <= 20) for (let i = lo; i <= hi; i++) out.add(String(i));
        else out.add(p);
      } else if (/^\d+$/.test(p)) out.add(p);
    });
  return [...out].filter(Boolean);
}

function collapseBold(boldChunk) {
  return boldChunk
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokenizeRefs(text) {
  const flat = text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
  const tokens = [];
  let m;

  const rP = /\bPresentation\s+(\d+)/gi;
  while ((m = rP.exec(flat)) !== null)
    tokens.push({ type: "pres", value: m[1], pos: m.index });

  const rS = /\bslides?\s+(\d[\d,\s\-–]*)/gi;
  while ((m = rS.exec(flat)) !== null)
    tokens.push({ type: "slide", value: m[1].trim(), pos: m.index });

  const rPg = /\b(?:pages?|p\.)\s+(\d[\d,\s\-–]*)/gi;
  while ((m = rPg.exec(flat)) !== null)
    tokens.push({ type: "page", value: m[1].trim(), pos: m.index });

  return tokens.sort((a, b) => a.pos - b.pos);
}

function buildRefsState(tokens) {
  const pres = {};
  const pages = new Set();
  const presTokens = tokens.filter((t) => t.type === "pres");
  presTokens.forEach((pt) => {
    if (!pres[pt.value]) pres[pt.value] = new Set();
  });

  tokens.forEach((tok) => {
    if (tok.type === "slide") {
      if (!presTokens.length) return;
      let nearest = presTokens[0];
      let minDist = Math.abs(tok.pos - presTokens[0].pos);
      presTokens.forEach((pt) => {
        const d = Math.abs(tok.pos - pt.pos);
        if (d < minDist) {
          minDist = d;
          nearest = pt;
        }
      });
      expandNums(tok.value).forEach((n) => pres[nearest.value].add(n));
    } else if (tok.type === "page") {
      expandNums(tok.value).forEach((n) => {
        if (+n >= 1 && +n <= 999) pages.add(n);
      });
    }
  });

  const finalPres = {};
  for (const k in pres) {
    finalPres[k] = [...pres[k]].sort((a, b) => +a - +b);
  }

  return { pres: finalPres, pages: [...pages].sort((a, b) => +a - +b) };
}

function parseExtractedText(rawFull, rawBold) {
  const norm = (t) =>
    t
      .replace(/\r/g, "")
      .replace(/•/g, "-")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"');
  const fullText = norm(rawFull);
  const boldText = norm(rawBold);
  const boldOK = boldText.length === fullText.length;

  const modules = [];
  const MOD_RE = /^([A-Z][A-Za-z0-9\s&:\-\/'"]+?)\s*\(\s*(\d+)\s*min\.?\s*\)/gm;
  let match;
  const idx = [];
  while ((match = MOD_RE.exec(fullText)) !== null)
    idx.push({
      title: match[1].trim(),
      duration: match[2] + " min.",
      pos: match.index,
    });

  for (let i = 0; i < idx.length; i++) {
    const start = idx[i].pos;
    const end = i + 1 < idx.length ? idx[i + 1].pos : fullText.length;
    const fullChunk = fullText.slice(start, end);
    const boldChunk = boldOK ? boldText.slice(start, end) : "";
    const { header, body } = splitChunk(fullChunk);
    const bodyOffset = fullChunk.length - body.length;
    const boldBody = boldChunk ? boldChunk.slice(bodyOffset) : "";

    const langLines = extractField("Target Language:", header);
    const gramLines = extractField("Target Grammar:", header);
    const matLines = extractField("Materials:", header);
    const prepLines = extractField("Preparation:", header);
    const willRaw = extractField("In this section", header);
    const willLines = willRaw.filter(
      (l) =>
        !l.match(/^the students will/i) && !l.match(/^[….]+$/) && l.length > 4,
    );

    let pres = {};
    let pages = [];
    const boldFlat = collapseBold(boldBody);
    const hasBoldContent = boldFlat.replace(/\s/g, "").length > 3;

    if (hasBoldContent) {
      const boldTokens = tokenizeRefs(boldFlat);
      const boldRefs = buildRefsState(boldTokens);
      pres = boldRefs.pres;
      pages = boldRefs.pages;
    }

    if (!Object.keys(pres).length) {
      const bodyTokens = tokenizeRefs(body);
      const bodyRefs = buildRefsState(bodyTokens);
      pres = bodyRefs.pres;
      if (!pages.length) pages = bodyRefs.pages;
    }

    modules.push({
      title: idx[i].title,
      duration: idx[i].duration,
      data: {
        lang: langLines,
        gram: gramLines,
        materials: matLines.length ? matLines : ["Check textbook."],
        prep: prepLines.length ? prepLines : ["None"],
        will: willLines,
        presentations: pres,
        pages,
      },
    });
  }
  return modules;
}

// ── Renderer ──────────────────────────────────────────────────────────────────
const ACCENTS = ["#FF6B95", "#FF8C42", "#1ea7fd", "#00d063"];
const TXT_ON = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

function listHTML(items, empty = "N/A") {
  if (!items || !items.length)
    return `<span class="opacity-50 italic text-sm">${empty}</span>`;
  if (items.length === 1)
    return `<span class="text-sm leading-snug">${items[0]}</span>`;
  return `<ul class="space-y-1">${items.map((item) => `<li class="flex items-start gap-2 text-sm leading-snug"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span><span>${item}</span></li>`).join("")}</ul>`;
}

function presHTML(presentations) {
  const keys = Object.keys(presentations).sort((a, b) => +a - +b);
  if (!keys.length)
    return `<span class="opacity-50 italic text-sm">See Presentation</span>`;
  return `<div class="flex flex-wrap gap-2">${keys
    .map((pk) => {
      const slidesData = presentations[pk];
      const slides = Array.isArray(slidesData) ? slidesData : [];
      return `<span class="pres-chip"><i data-lucide="monitor" class="w-3.5 h-3.5"></i>Pres.${pk}: <strong>${slides.join(", ")}</strong></span>`;
    })
    .join("")}</div>`;
}

function pagesHTML(pages) {
  if (!pages || !pages.length)
    return `<span class="opacity-50 italic text-sm">See Teacher Notes</span>`;
  const ranges = [];
  let s = null,
    p = null;
  pages.forEach((n) => {
    const v = +n;
    if (s === null) {
      s = v;
      p = v;
    } else if (v === p + 1) {
      p = v;
    } else {
      ranges.push(s === p ? String(s) : `${s}–${p}`);
      s = v;
      p = v;
    }
  });
  if (s !== null) ranges.push(s === p ? String(s) : `${s}–${p}`);
  return `<span class="text-sm font-bold">${ranges.join(", ")}</span>`;
}

function renderModules(modules) {
  renderModuleNav(modules);
  const container = document.getElementById("modules-container");
  if (!container) return;
  container.innerHTML = "";
  if (!modules.length) {
    container.innerHTML = `
            <div class="card p-12 text-center flex flex-col items-center gap-4">
                <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                    <i data-lucide="inbox" class="w-8 h-8 opacity-30"></i>
                </div>
                <h3 class="font-heading text-xl">No Modules Yet</h3>
                <p class="opacity-60 text-sm">Extract some notes to get started!</p>
            </div>`;
    lucide.createIcons();
    return;
  }

  modules.forEach((mod, i) => {
    const id = `mod-${i}`;
    const accent = ACCENTS[i % ACCENTS.length];
    const txtcol = TXT_ON[i % TXT_ON.length];
    const d = mod.data;

    const html = `
            <article class="card" id="${id}" style="animation-delay:${i * 60}ms;">
                <div class="flex items-center justify-between px-4 py-3 border-b-3 border-slate-900 dark:border-slate-700" style="background:${accent};">
                    <div class="flex items-center gap-3">
                        <span class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold" style="color:${txtcol};">${i + 1}</span>
                        <h2 class="font-heading text-lg" style="color:${txtcol};">${mod.title}</h2>
                    </div>
                    <span class="badge bg-white/80 text-slate-900 border-none">${mod.duration}</span>
                </div>
                <div class="p-5 flex flex-col gap-5">
                    <div class="section-stripe" style="border-color:${accent};">
                        <h3 class="font-heading text-sm uppercase tracking-wider opacity-60 mb-2">Target Focus</h3>
                        <div class="space-y-3">
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Language</p>${listHTML(d.lang)}</div>
                            ${d.gram.length ? `<div><p class="text-xs font-bold uppercase opacity-40 mb-1">Grammar</p>${listHTML(d.gram)}</div>` : ""}
                        </div>
                    </div>
                    <div>
                        <h3 class="font-heading text-sm uppercase tracking-wider opacity-60 mb-2">Requirements</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Materials</p>${listHTML(d.materials)}</div>
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Preparation</p>${listHTML(d.prep)}</div>
                        </div>
                    </div>
                    ${d.will.length
        ? `
                    <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button class="w-full flex items-center justify-between py-1" onclick="toggleWill(${i})">
                            <span class="font-heading text-sm opacity-60">LEARNING OUTCOMES</span>
                            <i data-lucide="chevron-down" class="w-4 h-4 opacity-40 transition-transform" id="chev-${i}"></i>
                        </button>
                        <div class="hidden mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl" id="will-${i}">${listHTML(d.will)}</div>
                    </div>`
        : ""
      }
                    <div class="grid grid-cols-1 gap-3 mt-2">
                        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-100 dark:border-slate-800">
                             <p class="text-[10px] font-bold uppercase opacity-40 mb-2">Presentations</p>
                             ${presHTML(d.presentations)}
                        </div>
                        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between">
                             <p class="text-[10px] font-bold uppercase opacity-40">Pages</p>
                             ${pagesHTML(d.pages)}
                        </div>
                    </div>
                    <button onclick="copyCard('${id}')" class="btn-chunky btn-chalk w-full mt-2 text-sm py-2">
                        <i data-lucide="copy" class="w-4 h-4"></i> Copy Details
                    </button>
                </div>
            </article>`;
    container.insertAdjacentHTML("beforeend", html);
  });
  lucide.createIcons();
}

function renderOverview(modules) {
  const container = document.getElementById("overview-content");
  if (!container) return;
  container.innerHTML = "";

  const title =
    document.getElementById("unit-title-input").value || "Unit Overview";
  const aims =
    document.getElementById("unit-aims-input").value || "No unit aims defined.";

  function getUnique(items) {
    const categoryMap = new Map();
    items.forEach((item) => {
      // Detect the "category" by taking the part before the first colon
      const category = item.split(":")[0].toLowerCase().trim();
      const existing = categoryMap.get(category);

      // Prioritize keeping the version with a colon (detailed)
      // or the longest version if both/neither have colons.
      if (
        !existing ||
        (item.includes(":") && !existing.includes(":")) ||
        (item.includes(":") === existing.includes(":") &&
          item.length > existing.length)
      ) {
        categoryMap.set(category, item);
      }
    });
    return Array.from(categoryMap.values());
  }

  const rawLang = [];
  const rawGram = [];
  modules.forEach((m) => {
    m.data.lang.forEach((l) => rawLang.push(l));
    m.data.gram.forEach((g) => rawGram.push(g));
  });

  const uniqueLang = getUnique(rawLang);
  const uniqueGram = getUnique(rawGram);

  const html = `
        <div class="flex flex-col gap-6">
            <div class="card p-6 bg-blue-500 text-white relative overflow-hidden" style="background:var(--color-blue);">
                <h2 class="font-heading text-2xl relative z-10">${title}</h2>
                <div class="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 relative z-10">
                    <p class="text-sm uppercase font-bold opacity-60 mb-1">Unit Aims</p>
                    <p class="text-lg font-bold">${aims.replace(/\n/g, "<br>")}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-5 border-pink-500" style="border-color:var(--color-pink);">
                    <h3 class="font-heading text-pink-500 mb-3 flex items-center gap-2">
                        <i data-lucide="languages" class="w-5 h-5"></i> All Target Language
                    </h3>
                    ${listHTML(uniqueLang, "No language extracted.")}
                </div>
                <div class="card p-5 border-orange-500" style="border-color:var(--color-orange);">
                    <h3 class="font-heading text-orange-500 mb-3 flex items-center gap-2">
                        <i data-lucide="scroll" class="w-5 h-5"></i> All Target Grammar
                    </h3>
                    ${listHTML(uniqueGram, "No grammar extracted.")}
                </div>
            </div>

            <div class="card overflow-hidden">
                <div class="p-4 bg-slate-900 dark:bg-slate-800 text-white font-heading flex items-center gap-2">
                    <i data-lucide="map" class="w-5 h-5 text-green-400"></i> Resource Navigator
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-900 dark:border-slate-700">
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Module</th>
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Slides</th>
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Pages</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${modules
      .map(
        (m, i) => `
                                <tr class="border-b border-slate-100 dark:border-slate-800">
                                    <td class="p-4 font-bold text-sm">${m.title}</td>
                                    <td class="p-4">${presHTML(m.data.presentations)}</td>
                                    <td class="p-4 text-blue-500 font-bold" style="color:var(--color-blue);">${pagesHTML(m.data.pages)}</td>
                                </tr>`,
      )
      .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

  container.innerHTML = html;
  lucide.createIcons();
}

function toggleWill(i) {
  const el = document.getElementById(`will-${i}`);
  const chv = document.getElementById(`chev-${i}`);
  if (el) el.classList.toggle("hidden");
  if (chv)
    chv.style.transform = el.classList.contains("hidden")
      ? "rotate(0deg)"
      : "rotate(180deg)";
}

function copyCard(id) {
  const card = document.getElementById(id);
  if (!card) return;

  const title = card.querySelector("h2")?.innerText || "";
  const dur = card.querySelector(".badge")?.innerText?.trim() || "";
  const focus = card.querySelector(".section-stripe")?.innerText || "";

  // Simplistic copy format
  const out = `📋 ${title} (${dur})\n\n${focus}`;

  navigator.clipboard?.writeText(out).then(() => {
    showToast("📋 Copied to clipboard!");
  });
}
function scrollToModule(index) {
  const el = document.getElementById(`mod-${index}`);
  if (el) {
    // Switch to modules tab if not already there
    switchTab("paste");

    const offset = 120; // accounting for sticky header
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = el.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
}
function renderModuleNav(modules) {
  const nav = document.getElementById("module-nav");
  if (!nav) return;

  if (!modules || !modules.length) {
    nav.className = "hidden";
    return;
  }

  nav.className =
    "sticky top-20 z-30 pb-4 pt-2 -mt-2 bg-[#f8fafc] dark:bg-[#020617]";
  nav.innerHTML = `
        <div class="card p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md flex flex-wrap gap-3 items-center border-blue-500 shadow-sm">
            <div class="flex items-center gap-2 mr-2">
                <i data-lucide="map" class="w-4 h-4 text-blue-500"></i>
                <span class="text-xs font-bold uppercase tracking-widest opacity-60">Quick Nav</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${modules
      .map(
        (_, i) => `
                    <button onclick="scrollToModule(${i})" 
                        class="btn-chunky w-10 h-10 flex items-center justify-center text-sm font-bold transition-transform hover:scale-110 active:scale-95"
                        style="background:${ACCENTS[i % ACCENTS.length]}; color:${TXT_ON[i % TXT_ON.length]};"
                        title="Jump to Module ${i + 1}">
                        ${i + 1}
                    </button>
                `,
      )
      .join("")}
            </div>
        </div>
    `;
  lucide.createIcons();
}

// ── Sets Management Logic ───────────────────────────────────────────────────
function toggleLibrary() {
  const drawer = document.getElementById("library-drawer");
  drawer.classList.toggle("-translate-x-full");
  if (!drawer.classList.contains("-translate-x-full")) {
    renderLibrary();
  }
}

async function renderLibrary() {
  const list = document.getElementById("library-list");
  const search = document.getElementById("library-search").value.toLowerCase();

  // Load from DB
  const tx = dataBase.transaction("library", "readonly");
  const store = tx.objectStore("library");
  const req = store.getAll();

  req.onsuccess = () => {
    const rawSets = req.result;
    const sets = rawSets
      .filter((s) => s.id !== 0)
      .sort((a, b) => b.lastUsed - a.lastUsed);
    appState.library = sets; // Update cache

    list.innerHTML = "";
    const filtered = sets.filter((s) => s.name.toLowerCase().includes(search));

    if (filtered.length === 0) {
      list.innerHTML = `<div class="text-center py-8 opacity-40 font-bold text-sm">No sets found.</div>`;
      return;
    }

    filtered.forEach((set) => {
      const el = document.createElement("div");
      el.className = `group p-4 bg-white dark:bg-slate-800 border-3 border-slate-900 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 transition-all ${appState.activeId === set.id ? "ring-3 ring-blue-500" : ""}`;

      const date = new Date(set.lastUsed).toLocaleDateString();

      el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div onclick="loadSet(${set.id})">
                        <h4 class="font-heading font-bold text-slate-900 dark:text-white line-clamp-1">${set.name}</h4>
                        <p class="text-[10px] font-bold opacity-40 uppercase tracking-widest">${set.modules.length} modules • ${date}</p>
                    </div>
                    <button onclick="deleteSet(event, ${set.id})" class="p-1.5 text-slate-300 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
      list.appendChild(el);
    });
    lucide.createIcons();
  };
}

async function createNewSet() {
  if (appState.current.rawText && appState.current.rawText.length > 50) {
    const c = await showConfirmModal(
      "Start New?",
      "Your current session will be cleared. Unsaved changes will be lost.",
      "Start New",
      "plus",
    );
    if (!c) return;
  }

  appState.activeId = null;
  appState.current = { title: "", aims: "", modules: [], rawText: "" };
  localStorage.removeItem("lp_session");

  updateUIFromState();
  showToast("✨ New lesson started");
}

function showSaveModal() {
  const input = document.getElementById("set-name-input");
  input.value = appState.current.title || "";
  document.getElementById("save-modal").classList.remove("hidden");
  input.focus();
}

function closeSaveModal() {
  document.getElementById("save-modal").classList.add("hidden");
}

async function confirmSaveSet() {
  const name =
    document.getElementById("set-name-input").value.trim() || "Untitled Lesson";

  const set = {
    name: name,
    unitAims: appState.current.aims,
    modules: appState.current.modules,
    rawText: appState.current.rawText || "",
    createdAt: Date.now(),
    lastUsed: Date.now(),
    usageCount: 1,
  };

  const tx = dataBase.transaction("library", "readwrite");
  const store = tx.objectStore("library");

  const req = store.add(set);
  req.onsuccess = (e) => {
    appState.activeId = e.target.result;
    appState.current.title = name;
    closeSaveModal();
    updateUIFromState();
    renderLibrary();
    showToast("💾 Lesson saved to library");
    syncToCloud();
  };
}

async function loadSet(id) {
  const tx = dataBase.transaction("library", "readwrite");
  const store = tx.objectStore("library");
  const req = store.get(id);

  req.onsuccess = () => {
    const set = req.result;
    if (set) {
      appState.activeId = set.id;
      appState.current = {
        title: set.name,
        aims: set.unitAims,
        modules: set.modules,
        rawText: set.rawText,
      };

      // Update metadata
      set.lastUsed = Date.now();
      set.usageCount = (set.usageCount || 0) + 1;
      store.put(set);

      updateUIFromState();
      toggleLibrary();
      showToast(`📂 Loaded: ${set.name}`);
      
      // Sync usage metrics to cloud
      syncToCloud();
    }
  };
}

async function deleteSet(e, id) {
  e.stopPropagation();
  const c = await showConfirmModal(
    "Delete Set?",
    "This set will be permanently removed from your library.",
    "Delete",
    "trash-2",
  );
  if (!c) return;

  const tx = dataBase.transaction("library", "readwrite");
  tx.objectStore("library").delete(id);
  tx.oncomplete = async () => {
    // Also delete from cloud
    try {
      const user = await (typeof getUser === "function" ? getUser() : null);
      if (user && typeof db !== "undefined") {
        const { error } = await db
          .from("workshop_lessonparser")
          .delete()
          .eq("user_id", user.id)
          .eq("local_id", id);
        if (!error) console.log("[Cloud] Deleted set", id);
      }
    } catch (e) {
      console.warn("Cloud deletion failed", e);
    }

    if (appState.activeId === id) {
      appState.activeId = null;
      updateActiveIndicator();
    }
    renderLibrary();
    showToast("🗑️ Set deleted");
    syncToCloud();
  };
}

// ── UI Helpers ──────────────────────────────────────────────────────────────
async function showConfirmModal(title, desc, confirmText, icon) {
  return new Promise((res) => {
    const modal = document.getElementById("confirm-modal");
    document.getElementById("confirm-title").innerText = title;
    document.getElementById("confirm-desc").innerText = desc;
    document.getElementById("confirm-do").innerText = confirmText;

    const iconEl = document.getElementById("confirm-icon");
    iconEl.setAttribute("data-lucide", icon);
    lucide.createIcons();

    modal.classList.remove("hidden");

    const cleanup = (val) => {
      modal.classList.add("hidden");
      // Remove listeners by creating clones
      const oldDo = document.getElementById("confirm-do");
      const newDo = oldDo.cloneNode(true);
      oldDo.parentNode.replaceChild(newDo, oldDo);

      const oldCancel = document.getElementById("confirm-cancel");
      const newCancel = oldCancel.cloneNode(true);
      oldCancel.parentNode.replaceChild(newCancel, oldCancel);

      res(val);
    };

    document
      .getElementById("confirm-do")
      .addEventListener("click", () => cleanup(true));
    document
      .getElementById("confirm-cancel")
      .addEventListener("click", () => cleanup(false));
  });
}

// ── Init ────────────────────────────────────────────────────────────────────
lucide.createIcons();

// ── State ──────────────────────────────────────────────────────────────────
let pages = [];
let activePageIndex = -1;
let src = null;
let seed = Math.random() * 9e5;
let S = { rows:4, cols:4, style:'straight', color:'#ffffff', width:2, opacity:1, depth:.5, freq:3 };
let printOrientation = 'portrait';

// ── IndexedDB for Puzzle Images ──────────────────────────────────────────────
const DB_NAME = 'klasskit_puzzle_db';
const DB_VERSION = 1;
const STORE_NAME = 'puzzle_images';
let dbInstance = null;

function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveImageToDB(id, dataUrl) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataUrl, id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('saveImageToDB error:', err);
  }
}

async function loadImageFromDB(id) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('loadImageFromDB error:', err);
    return null;
  }
}

async function deleteImageFromDB(id) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('deleteImageFromDB error:', err);
  }
}

let saveTimeout = null;
function saveState() {
  const stateToSave = {
    activePageIndex,
    pages: pages.map(p => ({
      id: p.id,
      name: p.name,
      seed: p.seed,
      S: p.S
    }))
  };

  localStorage.setItem('prog_puzzle-maker', JSON.stringify(stateToSave));

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (typeof saveProgress === 'function') {
      saveProgress('puzzle-maker', stateToSave).catch(err => {
        console.error('[Cloud Save] Error:', err);
      });
    }
  }, 1000);
}

async function loadState() {
  let saved = null;
  if (typeof loadProgress === 'function') {
    saved = await loadProgress('puzzle-maker');
  }
  if (!saved) {
    const local = localStorage.getItem('prog_puzzle-maker');
    if (local) {
      try {
        saved = JSON.parse(local);
      } catch (e) {}
    }
  }

  if (saved && saved.pages && saved.pages.length > 0) {
    pages = [];
    activePageIndex = saved.activePageIndex !== undefined ? saved.activePageIndex : -1;
    
    for (const p of saved.pages) {
      const dataUrl = await loadImageFromDB(p.id);
      if (dataUrl) {
        const im = new Image();
        await new Promise((resolve) => {
          im.onload = resolve;
          im.onerror = resolve;
          im.src = dataUrl;
        });
        pages.push({
          id: p.id,
          im: im,
          name: p.name,
          seed: p.seed,
          S: p.S
        });
      }
    }
    
    if (pages.length > 0) {
      document.getElementById('empty').classList.add('hidden');
      document.getElementById('canvasWrap').classList.remove('hidden');
      document.getElementById('canvasWrap').classList.add('flex');
      document.getElementById('pagesSection').classList.remove('hidden');
      
      if (activePageIndex < 0 || activePageIndex >= pages.length) {
        activePageIndex = 0;
      }
      selectPage(activePageIndex);
    }
  }
}

// ── Dark mode ──────────────────────────────────────────────────────────────
function updateDarkIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('darkIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons({ nodes: [icon] });
  }
}

document.getElementById('darkToggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme_puzzle-maker', isDark ? 'dark' : 'light');
  updateDarkIcon();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'theme_hub' || e.key === 'theme_puzzle-maker') {
    setTimeout(updateDarkIcon, 50);
  }
});

updateDarkIcon();

// ── Upload & Page Management ────────────────────────────────────────────────
const dz = document.getElementById('dropZone');
const fi = document.getElementById('fileIn');
const addPageBtn = document.getElementById('addPageBtn');

dz.addEventListener('click', () => fi.click());
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); load(e.dataTransfer.files[0]); });
fi.addEventListener('change', e => load(e.target.files[0]));
addPageBtn.addEventListener('click', () => fi.click());

function load(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => {
      const pageId = Date.now() + Math.random();
      const newPage = {
        id: pageId,
        im: im,
        name: f.name,
        seed: Math.random() * 9e5,
        S: { ...S }
      };
      pages.push(newPage);
      saveImageToDB(pageId, e.target.result).then(() => {
        saveState();
      });
      
      document.getElementById('empty').classList.add('hidden');
      document.getElementById('canvasWrap').classList.remove('hidden');
      document.getElementById('canvasWrap').classList.add('flex');
      document.getElementById('pagesSection').classList.remove('hidden');
      
      selectPage(pages.length - 1);
    };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}

function selectPage(index) {
  if (index < 0 || index >= pages.length) return;
  activePageIndex = index;
  S = pages[index].S;
  src = pages[index].im;
  seed = pages[index].seed;
  
  document.getElementById('imgInfo').textContent = `📷 ${pages[index].name}  (${src.width} × ${src.height})`;
  document.getElementById('imgInfo').classList.remove('hidden');
  
  updateControlsUI();
  renderPagesList();
  redraw();
  saveState();
}

function deletePage(index) {
  const pageId = pages[index].id;
  deleteImageFromDB(pageId);
  pages.splice(index, 1);
  if (pages.length === 0) {
    activePageIndex = -1;
    src = null;
    document.getElementById('empty').classList.remove('hidden');
    document.getElementById('canvasWrap').classList.add('hidden');
    document.getElementById('canvasWrap').classList.remove('flex');
    document.getElementById('pagesSection').classList.add('hidden');
    document.getElementById('imgInfo').classList.add('hidden');
    saveState();
  } else {
    if (activePageIndex >= pages.length) {
      activePageIndex = pages.length - 1;
    }
    selectPage(activePageIndex);
  }
}

function renderPagesList() {
  const container = document.getElementById('pagesList');
  container.innerHTML = '';
  
  pages.forEach((p, index) => {
    const isActive = index === activePageIndex;
    const btn = document.createElement('div');
    btn.className = `page-pill ${isActive ? 'active' : ''}`;
    
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.delete-page-btn')) return;
      selectPage(index);
    });
    
    const title = document.createElement('span');
    title.textContent = `P${index + 1}`;
    btn.appendChild(title);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-page-btn text-red-400 hover:text-red-600 transition-colors flex items-center';
    delBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePage(index);
    });
    
    btn.appendChild(delBtn);
    container.appendChild(btn);
  });
  
  lucide.createIcons();
}

function updateControlsUI() {
  document.getElementById('rowsR').value = S.rows;
  document.getElementById('rowsLbl').textContent = S.rows;
  
  document.getElementById('colsR').value = S.cols;
  document.getElementById('colsLbl').textContent = S.cols;
  
  document.getElementById('widthR').value = S.width;
  document.getElementById('widthLbl').textContent = S.width + 'px';
  
  document.getElementById('opacR').value = Math.round(S.opacity * 100);
  document.getElementById('opacLbl').textContent = Math.round(S.opacity * 100) + '%';
  
  document.getElementById('depthR').value = Math.round(S.depth * 100);
  document.getElementById('depthLbl').textContent = Math.round(S.depth * 100) + '%';
  
  document.getElementById('freqR').value = S.freq;
  document.getElementById('freqLbl').textContent = S.freq;
  
  document.querySelectorAll('.style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === S.style);
  });
  showFreq();
  
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('sel', sw.dataset.color === S.color);
  });
  document.getElementById('colorPick').value = S.color;
}

// ── Sliders ────────────────────────────────────────────────────────────────
function bind(id, lbl, key, fmt, conv) {
  const el = document.getElementById(id);
  const lb = document.getElementById(lbl);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    S[key] = conv ? conv(v) : v;
    lb.textContent = fmt(v);
    redraw();
    saveState();
  });
}
bind('rowsR',  'rowsLbl',  'rows',  v => Math.round(v), v => Math.round(v));
bind('colsR',  'colsLbl',  'cols',  v => Math.round(v), v => Math.round(v));
bind('widthR', 'widthLbl', 'width', v => Math.round(v)+'px', v => Math.round(v));
bind('opacR',  'opacLbl',  'opacity', v => Math.round(v)+'%', v => v/100);
bind('depthR', 'depthLbl', 'depth', v => Math.round(v)+'%', v => v/100);
bind('freqR',  'freqLbl',  'freq',  v => Math.round(v), v => Math.round(v));

// ── Style buttons ──────────────────────────────────────────────────────────
const freqRow = document.getElementById('freqRow');
function showFreq() {
  freqRow.style.display = ['wavy','bumpy'].includes(S.style) ? '' : 'none';
}
showFreq();

document.querySelectorAll('.style-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    S.style = b.dataset.style;
    showFreq();
    redraw();
    saveState();
  });
});

// ── Print Orientation ────────────────────────────────────────────────────────
['orientPortrait','orientLandscape'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-orient]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    printOrientation = btn.dataset.orient;
  });
});

// ── Color ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.swatch[data-color]').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
    sw.classList.add('sel');
    S.color = sw.dataset.color;
    document.getElementById('colorPick').value = sw.dataset.color;
    redraw();
    saveState();
  });
});
document.getElementById('colorPick').addEventListener('input', function() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
  this.classList.add('sel');
  S.color = this.value;
  redraw();
  saveState();
});

// ── Actions ────────────────────────────────────────────────────────────────
document.getElementById('shuffleBtn').addEventListener('click', () => { 
  seed = Math.random()*9e5; 
  if (activePageIndex !== -1) {
    pages[activePageIndex].seed = seed;
  }
  redraw(); 
  saveState();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!src) return;
  const c = document.getElementById('canvas');
  const a = document.createElement('a');
  a.download = `puzzle-page-${activePageIndex + 1}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
});

document.getElementById('printBtn').addEventListener('click', () => {
  if (pages.length === 0) return;
  
  // Create or retrieve print container
  let printArea = document.getElementById('printArea');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'printArea';
    printArea.className = 'hidden';
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = '';
  
  // Render each page into a temporary canvas and convert to image for printing
  pages.forEach((p, index) => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate aspect-ratio fitted dimensions
    const MAX = 1400;
    let W = p.im.width, H = p.im.height;
    if (W > MAX) { H = H * MAX / W; W = MAX; }
    if (H > MAX) { W = W * MAX / H; H = MAX; }
    tempCanvas.width = Math.round(W);
    tempCanvas.height = Math.round(H);
    
    // Draw page image
    tempCtx.drawImage(p.im, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the puzzle line grid onto the temporary canvas using this page's settings
    drawGridWithSettings(tempCtx, tempCanvas.width, tempCanvas.height, p.S, p.seed);
    
    // Wrap inside standard A4 container for CSS formatting
    const pageDiv = document.createElement('div');
    pageDiv.className = 'print-page';
    
    const img = document.createElement('img');
    img.src = tempCanvas.toDataURL('image/png');
    img.className = 'print-img';
    
    pageDiv.appendChild(img);
    printArea.appendChild(pageDiv);
  });
  
  // Inject dynamic @page rule for orientation
  let pageStyle = document.getElementById('printPageStyle');
  if (pageStyle) pageStyle.remove();
  pageStyle = document.createElement('style');
  pageStyle.id = 'printPageStyle';
  pageStyle.textContent = `@media print { @page { size: A4 ${printOrientation}; margin: 0; } }`;
  document.head.appendChild(pageStyle);

  // Wait for all print images to decode before opening print dialog
  const imgs = Array.from(printArea.querySelectorAll('img'));
  const decodeWithTimeout = (img) => {
    if (!img.decode) return Promise.resolve();
    return Promise.race([
      img.decode(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Decode timeout')), 5000))
    ]);
  };

  Promise.all(imgs.map(decodeWithTimeout))
    .catch(() => {}) // Fallback: print anyway even if decode fails/times out
    .then(() => window.print());

  // Clean up after print dialog closes
  window.addEventListener('afterprint', () => {
    if (pageStyle) pageStyle.remove();
  }, { once: true });
});

// ── RNG ────────────────────────────────────────────────────────────────────
function rngWithSeed(s, pSeed) { const x = Math.sin(s + pSeed)*1e5; return x - Math.floor(x); }

// ── Draw ───────────────────────────────────────────────────────────────────
function redraw() {
  if (!src) return;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const MAX = 1400;
  let W = src.width, H = src.height;
  if (W > MAX) { H = H*MAX/W; W = MAX; }
  if (H > MAX) { W = W*MAX/H; H = MAX; }
  canvas.width  = Math.round(W);
  canvas.height = Math.round(H);
  document.getElementById('sizeLbl').textContent = `${canvas.width} × ${canvas.height} px`;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height);
}

function drawGridWithSettings(ctx, W, H, settings, pSeed) {
  const {rows, cols, style, color, width, opacity, depth, freq} = settings;
  const cW = W/cols, cH = H/rows;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.globalAlpha = opacity;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0=c*cW, x1=(c+1)*cW, y=r*cH;
      const d = rngWithSeed(r*1e3+c, pSeed) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x0,y, x1,y, true, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  // Vertical lines
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const y0=r*cH, y1=(r+1)*cH, x=c*cW;
      const d = rngWithSeed(c*1e3+r+5e4, pSeed) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x,y0, x,y1, false, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGrid(ctx, W, H) {
  drawGridWithSettings(ctx, W, H, S, seed);
}

function seg(ctx, x0,y0,x1,y1, hz, cW,cH, style,dir,depth,freq) {
  switch(style) {
    case 'straight': doStraight(ctx,x0,y0,x1,y1); break;
    case 'jigsaw':   doJigsaw  (ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth); break;
    case 'jagged':   doJagged  (ctx,x0,y0,x1,y1,hz,cW,cH,depth); break;
    case 'wavy':     doWavy    (ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq); break;
    case 'curved':   doCurved  (ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth); break;
    case 'bumpy':    doBumpy   (ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq); break;
  }
}

function doStraight(ctx,x0,y0,x1,y1) {
  ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
}

function doJigsaw(ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth) {
  const r = (hz?cH:cW) * .22 * depth;
  const mid = hz ? (x0+x1)/2 : (y0+y1)/2;
  ctx.moveTo(x0,y0);
  if (hz) {
    ctx.lineTo(mid-r, y0);
    const pk = y0 - dir*r*1.75;
    ctx.bezierCurveTo(mid-r, y0-dir*r*.6, mid-r*.4, pk, mid, pk);
    ctx.bezierCurveTo(mid+r*.4, pk, mid+r, y0-dir*r*.6, mid+r, y0);
    ctx.lineTo(x1,y1);
  } else {
    ctx.lineTo(x0, mid-r);
    const pk = x0 - dir*r*1.75;
    ctx.bezierCurveTo(x0-dir*r*.6, mid-r, pk, mid-r*.4, pk, mid);
    ctx.bezierCurveTo(pk, mid+r*.4, x0-dir*r*.6, mid+r, x0, mid+r);
    ctx.lineTo(x1,y1);
  }
}

function doJagged(ctx,x0,y0,x1,y1,hz,cW,cH,depth) {
  const amp = (hz?cH:cW) * .15 * depth;
  const steps = 10;
  ctx.moveTo(x0,y0);
  for (let i=1;i<=steps;i++) {
    const t=i/steps, off=(i%2===0?1:-1)*amp;
    ctx.lineTo(hz?x0+(x1-x0)*t:x0+off, hz?y0+off:y0+(y1-y0)*t);
  }
}

function doWavy(ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq) {
  const amp=(hz?cH:cW)*.12*depth, steps=60;
  ctx.moveTo(x0,y0);
  for (let i=1;i<=steps;i++) {
    const t=i/steps, wave=Math.sin(t*Math.PI*2*freq)*amp;
    ctx.lineTo(hz?x0+(x1-x0)*t:x0+wave, hz?y0+wave:y0+(y1-y0)*t);
  }
}

function doCurved(ctx,x0,y0,x1,y1,hz,cW,cH,dir,depth) {
  const off=(hz?cH:cW)*.35*depth*dir;
  ctx.moveTo(x0,y0);
  if (hz) ctx.bezierCurveTo(x0+(x1-x0)*.33,y0+off, x0+(x1-x0)*.66,y0-off, x1,y1);
  else    ctx.bezierCurveTo(x0+off,y0+(y1-y0)*.33, x0-off,y0+(y1-y0)*.66, x1,y1);
}

function doBumpy(ctx,x0,y0,x1,y1,hz,cW,cH,depth,freq) {
  const amp=(hz?cH:cW)*.13*depth, steps=freq*2;
  ctx.moveTo(x0,y0);
  for (let i=0;i<steps;i++) {
    const t0=i/steps, t1=(i+1)/steps;
    const mid=(t0+t1)/2, sign=i%2===0?-1:1;
    if (hz) {
      const cx=x0+(x1-x0)*mid, cy=y0+sign*amp*1.5;
      ctx.quadraticCurveTo(cx,cy, x0+(x1-x0)*t1, y0);
    } else {
      const cy=y0+(y1-y0)*mid, cx=x0+sign*amp*1.5;
      ctx.quadraticCurveTo(cx,cy, x0, y0+(y1-y0)*t1);
    }
  }
}

// ── Init State ──────────────────────────────────────────────────────────────
loadState();
// ── Auth Guard ───────────────────────────────────────────────────────────
(async () => {
  await requireAuth();
})();

lucide.createIcons();

// ── State ──────────────────────────────────────────────────────────────────
let src = null;
let seed = Math.random() * 9e5;
const S = { rows:4, cols:4, style:'straight', color:'#ffffff', width:2, opacity:1, depth:.5, freq:3 };

// ── Dark mode ──────────────────────────────────────────────────────────────
let dark = false;
document.getElementById('darkToggle').addEventListener('click', () => {
  dark = !dark;
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('darkIcon').setAttribute('data-lucide', dark ? 'sun' : 'moon');
  lucide.createIcons();
});

// ── Upload ─────────────────────────────────────────────────────────────────
const dz = document.getElementById('dropZone');
const fi = document.getElementById('fileIn');
dz.addEventListener('click', () => fi.click());
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); load(e.dataTransfer.files[0]); });
fi.addEventListener('change', e => load(e.target.files[0]));

function load(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => {
      src = im;
      document.getElementById('empty').classList.add('hidden');
      document.getElementById('canvasWrap').classList.remove('hidden');
      document.getElementById('canvasWrap').classList.add('flex');
      document.getElementById('imgInfo').textContent = `📷 ${f.name}  (${im.width} × ${im.height})`;
      document.getElementById('imgInfo').classList.remove('hidden');
      redraw();
    };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
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
  });
});
document.getElementById('colorPick').addEventListener('input', function() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
  this.classList.add('sel');
  S.color = this.value;
  redraw();
});

// ── Actions ────────────────────────────────────────────────────────────────
document.getElementById('shuffleBtn').addEventListener('click', () => { seed = Math.random()*9e5; redraw(); });
document.getElementById('downloadBtn').addEventListener('click', () => {
  const c = document.getElementById('canvas');
  const a = document.createElement('a');
  a.download = 'puzzle-template.png';
  a.href = c.toDataURL('image/png');
  a.click();
});

// ── RNG ────────────────────────────────────────────────────────────────────
function rng(s) { const x = Math.sin(s + seed)*1e5; return x - Math.floor(x); }

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

function drawGrid(ctx, W, H) {
  const {rows, cols, style, color, width, opacity, depth, freq} = S;
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
      const d = rng(r*1e3+c) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x0,y, x1,y, true, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  // Vertical lines
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const y0=r*cH, y1=(r+1)*cH, x=c*cW;
      const d = rng(c*1e3+r+5e4) > .5 ? 1 : -1;
      ctx.beginPath();
      seg(ctx, x,y0, x,y1, false, cW,cH, style,d,depth,freq);
      ctx.stroke();
    }
  }
  ctx.restore();
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
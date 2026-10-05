// celebration.js: full-screen "גוללללל!" moments (contract C9).
//
//   celebrate({ kind: 'goal'|'mega'|'save'|'win'|'trophy', textHe, subHe, colors: [a, b] }) -> Promise<void>
//   cancelCelebration()   // closes the current one (its promise resolves)
//
// Kinetic 3D typography (extruded, chromatic gold, perspective zoom-punch), shockwave rings, confetti in the
// team colours with drag/gravity/flutter physics, flare sparks, fireworks, stadium photo flashes, a short
// screen shake, haptics (navigator.vibrate) and a crowd roar through crowd-audio.js (only if the player
// turned the sound on). Auto-closes (goal ~2.2 s, mega ~3.5 s, save 1.8 s, win 2.6 s, trophy 3.5 s); a tap
// closes it early. prefers-reduced-motion -> a simple fade of the text. Never throws, never rejects.
// Everything is an analytic function of time, so a debug clock can seek: celebrate({..., debug: true})
// keeps it open and exposes window.__celebDebug = { seek(t), finish() }.
//
// v2.3: celebrate({..., style: 'knee'|'backflip'|'jump'|'heart', boots: '#hex', skin: '#hex'}) adds the player's own
// celebration (bought with stars) acted out by a kit-coloured figure at the bottom of the screen;
// celebrate({..., small: true}) is the compact, non-blocking variant used for achievement unlocks (≈2 s, taps pass through).

import { roar, beat } from './crowd-audio.js';

const TAU = Math.PI * 2;
const DUR = { goal: 2.2, mega: 3.5, save: 1.8, win: 2.6, trophy: 3.5 };
const TEXT = { goal: 'גול!', mega: 'גוללללל!!!', save: 'הצלה!', win: 'ניצחון!', trophy: 'אלופים!' };
const VIB = { goal: [60, 40, 120], mega: [80, 40, 80, 40, 220], save: [40], win: [50, 30, 50], trophy: [60, 40, 60, 40, 160] };
const FONT = 'Rubik, Heebo, "Arial Black", Arial, sans-serif';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (t) => 1 - Math.pow(1 - t, 3);
const sm = (t) => t * t * (3 - 2 * t);
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
const rgba = (c, a = 1, k = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function parseColor(c, fb) {
  if (Array.isArray(c) && c.length >= 3) return c.slice(0, 3).map(Number);
  if (typeof c !== 'string') return fb;
  let m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = /^#?([0-9a-f]{3})$/i.exec(c.trim());
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = /rgba?\(([^)]+)\)/i.exec(c);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); if (p.length >= 3) return p.slice(0, 3); }
  return fb;
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function glowSprite(r, rgb, core = 0.2) {
  const c = cnv(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(core, rgba(rgb, 0.8)); gr.addColorStop(core + (1 - core) * 0.4, rgba(rgb, 0.22)); gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}

/* ------------------------------------------------------------------ styles */
const PAL = {
  gold: { face: ['#FFF8D6', '#FFE07A', '#F2B52E', '#FFE9A8', '#C9800F'], deep: [92, 50, 6], deeper: [34, 18, 4], line: '#2b1606', glow: 'rgba(255,190,60,.75)' },
  teal: { face: ['#F4FFFE', '#B9FFF5', '#3FE3CF', '#D8FFF9', '#138C8C'], deep: [8, 70, 78], deeper: [4, 26, 34], line: '#03222a', glow: 'rgba(60,240,220,.7)' },
};
const STYLE = { goal: 'gold', mega: 'gold', win: 'gold', trophy: 'gold', save: 'teal' };

/** Extruded 3D text sprite. Returns { c, w, h, sil } (sil = white silhouette of the front face). */
function textSprite(str, px, pal, opts = {}) {
  const font = `900 ${px}px ${FONT}`, skew = opts.skew ?? -0.2, depth = Math.round(opts.depth ?? Math.min(26, px * 0.12));
  const m = cnv(4, 4).getContext('2d'); m.font = font; m.direction = 'rtl';
  const tw = m.measureText(str).width, pad = px * 0.5 + depth;
  const W = tw + Math.abs(skew) * px + pad * 2, H = px * 1.45 + depth + pad;
  const c = cnv(W, H), g = c.getContext('2d'), bx = W / 2, by = pad * 0.6 + px * 0.95;
  const setup = (ctx) => { ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'rtl'; ctx.setTransform(1, 0, skew, 1, -skew * by, 0); };
  setup(g);
  // extrusion: stacked layers going down-right and darker with depth
  for (let i = depth; i >= 1; i--) {
    const k = i / depth; g.fillStyle = rgba(mix(pal.deep, pal.deeper, k)); g.fillText(str, bx + i * 0.45, by + i * 0.9);
  }
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, px * 0.07); g.strokeStyle = pal.line; g.strokeText(str, bx, by);
  const gr = g.createLinearGradient(0, by - px * 0.8, 0, by + px * 0.08);
  pal.face.forEach((col, i) => gr.addColorStop([0, 0.36, 0.52, 0.72, 1][i], col));
  g.shadowColor = pal.glow; g.shadowBlur = px * 0.16; g.fillStyle = gr; g.fillText(str, bx, by); g.shadowBlur = 0;
  g.fillStyle = gr; g.fillText(str, bx, by);
  g.lineWidth = Math.max(1, px * 0.018); g.strokeStyle = 'rgba(255,255,255,.75)'; g.strokeText(str, bx - px * 0.006, by - px * 0.012);
  // silhouette (for chromatic split + light sweep)
  const sil = cnv(W, H), s = sil.getContext('2d'); setup(s); s.fillStyle = '#fff'; s.fillText(str, bx, by);
  return { c, w: W, h: H, sil, px, by };
}
function tint(sil, rgb) { const c = cnv(sil.width, sil.height), g = c.getContext('2d'); g.drawImage(sil, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = rgba(rgb); g.fillRect(0, 0, c.width, c.height); return c; }

function subSprite(str, px) {
  const font = `800 ${px}px ${FONT}`, m = cnv(4, 4).getContext('2d'); m.font = font; m.direction = 'rtl';
  const tw = m.measureText(str).width, W = tw + px * 2.2, H = px * 2.1, c = cnv(W, H), g = c.getContext('2d');
  // glass plate with gold edges
  const r = H * 0.28; g.beginPath(); if (g.roundRect) g.roundRect(px * 0.4, H * 0.12, W - px * 0.8, H * 0.76, r); else g.rect(px * 0.4, H * 0.12, W - px * 0.8, H * 0.76);
  const pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, 'rgba(22,48,96,.92)'); pg.addColorStop(1, 'rgba(6,16,40,.92)'); g.fillStyle = pg; g.fill();
  g.lineWidth = Math.max(1.5, px * 0.06); const eg = g.createLinearGradient(0, 0, W, 0); eg.addColorStop(0, '#C98E2B'); eg.addColorStop(0.5, '#FFE7A3'); eg.addColorStop(1, '#C98E2B'); g.strokeStyle = eg; g.stroke();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = '#FFFFFF'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = px * 0.2; g.shadowOffsetY = px * 0.05; g.fillText(str, W / 2, H * 0.53);
  return { c, w: W, h: H };
}

function trophySprite(h) {
  const w = h * 0.82, c = cnv(w, h), g = c.getContext('2d'), cx = w / 2;
  const metal = (x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); [['#7A4A08', 0], ['#FFE9A6', 0.18], ['#D99A22', 0.38], ['#FFF6CF', 0.55], ['#E3A52E', 0.72], ['#8A560C', 1]].forEach(([col, s]) => gr.addColorStop(s, col)); return gr; };
  // handles
  g.lineWidth = h * 0.05; g.strokeStyle = metal(cx - w * 0.48, cx + w * 0.48); g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * w * 0.3, h * 0.12); g.bezierCurveTo(cx + s * w * 0.55, h * 0.1, cx + s * w * 0.52, h * 0.42, cx + s * w * 0.2, h * 0.47); g.stroke(); }
  // bowl
  g.fillStyle = metal(cx - w * 0.34, cx + w * 0.34); g.beginPath();
  g.moveTo(cx - w * 0.34, h * 0.08); g.lineTo(cx + w * 0.34, h * 0.08); g.bezierCurveTo(cx + w * 0.34, h * 0.42, cx + w * 0.16, h * 0.55, cx + w * 0.06, h * 0.58);
  g.lineTo(cx - w * 0.06, h * 0.58); g.bezierCurveTo(cx - w * 0.16, h * 0.55, cx - w * 0.34, h * 0.42, cx - w * 0.34, h * 0.08); g.fill();
  g.fillStyle = 'rgba(80,46,4,.55)'; g.beginPath(); g.ellipse(cx, h * 0.08, w * 0.34, h * 0.035, 0, 0, TAU); g.fill();
  g.strokeStyle = '#FFF2C2'; g.lineWidth = h * 0.01; g.beginPath(); g.ellipse(cx, h * 0.08, w * 0.34, h * 0.035, 0, 0, TAU); g.stroke();
  // stem + knot + base
  g.fillStyle = metal(cx - w * 0.08, cx + w * 0.08); g.fillRect(cx - w * 0.05, h * 0.57, w * 0.1, h * 0.14);
  g.beginPath(); g.ellipse(cx, h * 0.64, w * 0.09, h * 0.03, 0, 0, TAU); g.fill();
  g.fillStyle = metal(cx - w * 0.22, cx + w * 0.22); g.beginPath(); g.moveTo(cx - w * 0.12, h * 0.71); g.lineTo(cx + w * 0.12, h * 0.71); g.lineTo(cx + w * 0.22, h * 0.8); g.lineTo(cx - w * 0.22, h * 0.8); g.closePath(); g.fill();
  const bg = g.createLinearGradient(0, h * 0.8, 0, h); bg.addColorStop(0, '#1b2f5c'); bg.addColorStop(1, '#081530'); g.fillStyle = bg; g.fillRect(cx - w * 0.26, h * 0.8, w * 0.52, h * 0.17);
  g.fillStyle = metal(cx - w * 0.26, cx + w * 0.26); g.fillRect(cx - w * 0.26, h * 0.86, w * 0.52, h * 0.025);
  // star on the bowl + specular streak
  g.fillStyle = '#FFF8DE'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? h * 0.03 : h * 0.07; g.lineTo(cx + Math.cos(a) * r, h * 0.27 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - w * 0.2, h * 0.24, w * 0.03, h * 0.12, -0.1, 0, TAU); g.fill();
  return c;
}

/* ------------------------------------------------------------------ particles (analytic) */
function confetti(R, n, W, H, cols, k) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 3, t0 = 0.16 + R() * 0.12;
    let x0, y0, vx, vy;
    if (side === 2) { x0 = W * (0.15 + R() * 0.7); y0 = -20; vx = (R() - 0.5) * 300; vy = 100 + R() * 300; }
    else { const s = side ? 1 : -1; x0 = side ? W + 10 : -10; y0 = H * (0.82 + R() * 0.1); vx = -s * (W * (0.7 + R() * 1.0)); vy = -(H * (1.1 + R() * 0.9)); }
    out.push({ t0, x0, y0, vx: vx * k, vy: vy * k, d: 2.2 + R() * 1.6, c: cols[Math.floor(R() * cols.length)], w: (6 + R() * 6) * k, h: (10 + R() * 9) * k, rot: R() * TAU, spin: (R() - 0.5) * 14, flip: 6 + R() * 10, ph: R() * TAU, shape: R() < 0.12 ? 1 : 0 });
  }
  return out;
}
const G = 900;
function cpos(p, tt) { const e = (1 - Math.exp(-p.d * tt)) / p.d; return [p.x0 + p.vx * e + Math.sin(tt * 3 + p.ph) * 10 * (1 - Math.exp(-tt)), p.y0 + (p.vy - G / p.d) * e + (G / p.d) * tt]; }

/* ------------------------------------------------------------------ public API */
let current = null;
export function cancelCelebration() { if (current) current.close(true); }
/** Is a celebration on screen now? (the achievement toasts wait for it to end) */
export function celebrating() { return !!current; }
function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

const CSS = `.hy-celeb{position:fixed;inset:0;z-index:2147482000;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;opacity:1;transition:opacity .22s ease}
.hy-celeb.out{opacity:0;pointer-events:none}.hy-celeb.small{pointer-events:none}.hy-celeb canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.hy-celeb .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.hy-celeb-rm{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(3,7,15,.55);direction:rtl;text-align:center;opacity:0;transition:opacity .3s ease}
.hy-celeb-rm b{font:900 clamp(44px,14vw,96px)/1 ${FONT};color:#FFE07A;text-shadow:0 4px 0 #8a5a10,0 10px 30px rgba(0,0,0,.6)}
.hy-celeb-rm span{font:700 18px/1.3 Heebo,system-ui,sans-serif;color:#EEF4FF}`;
let cssDone = false;
function injectCSS() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.id = 'hy-celeb-css'; s.textContent = CSS; document.head.appendChild(s); }

/**
 * Show a celebration overlay. Resolves when it closes (auto, tap, or replaced by a newer one).
 * @param {{kind?:string,textHe?:string,subHe?:string,colors?:Array,debug?:boolean}} o
 */
export function celebrate(o = {}) {
  return new Promise((resolve) => {
    try { run(o, resolve); } catch (e) { console.warn('[celebrate] failed', e); if (current) current.close(false); else resolve(); }
  });
}

function run(o, resolve) {
  if (typeof document === 'undefined' || !document.body) { resolve(); return; }
  if (current && o.small) { resolve(); return; }   // a badge never cuts a goal celebration short
  if (current) current.close(false);
  injectCSS();
  const kind = DUR[o.kind] ? o.kind : 'goal';
  const small = !!o.small, style = !small && FIG_STYLES.includes(o.style) ? o.style : null;
  const dur = small ? 1.9 : style ? Math.max(DUR[kind], kind === 'mega' ? 3.9 : 3.1) : DUR[kind];
  const text = (o.textHe && String(o.textHe).trim()) || TEXT[kind], sub = o.subHe ? String(o.subHe) : '';
  const cA = parseColor(o.colors && o.colors[0], [244, 195, 90]), cB = parseColor(o.colors && o.colors[1], [10, 24, 56]);
  const root = document.createElement('div'); root.className = 'hy-celeb'; root.dataset.testid = 'celebration'; root.dataset.kind = kind; if (small) { root.classList.add('small'); root.dataset.small = '1'; } if (style) root.dataset.style = style; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'assertive');
  const sr = document.createElement('div'); sr.className = 'sr'; sr.textContent = text + (sub ? ' ' + sub : ''); root.appendChild(sr);
  const listeners = []; const on = (el, ev, fn) => { el.addEventListener(ev, fn); listeners.push([el, ev, fn]); };
  let raf = 0, timer = 0, closed = false;
  const me = {
    close(fade) {
      if (closed) return; closed = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      for (const [el, ev, fn] of listeners) el.removeEventListener(ev, fn);
      if (window.__celebDebug && window.__celebDebug._owner === root) delete window.__celebDebug;
      if (current === me) current = null;
      const end = () => { root.remove(); resolve(); };
      if (fade) { root.classList.add('out'); setTimeout(end, 230); } else end();
    },
  };
  current = me;
  try { if (navigator.vibrate) navigator.vibrate(small ? [30, 30, 60] : VIB[kind]); } catch { /* not allowed */ }
  try { if (!small) { roar(kind === 'mega' || kind === 'trophy' ? 1.7 : kind === 'save' ? 0.6 : 1.1); if (kind !== 'save') beat(); } } catch { /* audio off */ }

  const canvas = document.createElement('canvas');
  const g = !reduced() && canvas.getContext ? canvas.getContext('2d') : null;
  if (!g) { // reduced motion / no canvas: a quiet fade
    const box = document.createElement('div'); box.className = 'hy-celeb-rm';
    box.innerHTML = '<b></b><span></span>'; box.firstChild.textContent = text; box.lastChild.textContent = sub;
    root.appendChild(box); document.body.appendChild(root);
    requestAnimationFrame(() => { box.style.opacity = '1'; });
    if (!small) on(root, 'pointerdown', () => me.close(true));
    timer = setTimeout(() => { box.style.opacity = '0'; timer = setTimeout(() => me.close(false), 320); }, o.debug ? 1e9 : Math.min(1400, dur * 600));
    return;
  }
  root.appendChild(canvas); document.body.appendChild(root);
  const S = { W: 0, H: 0, dpr: 1 };
  const resize = () => {
    S.W = Math.max(1, root.clientWidth || innerWidth); S.H = Math.max(1, root.clientHeight || innerHeight);
    S.dpr = Math.min(window.devicePixelRatio || 1, 1.75); canvas.width = Math.round(S.W * S.dpr); canvas.height = Math.round(S.H * S.dpr);
  };
  resize();
  S.small = small; S.style = style; S.boots = o.boots; S.skin = o.skin;
  build(S, kind, text, sub, cA, cB);
  const t0 = performance.now(); let tDbg = null;
  const frame = (now) => {
    if (closed) return;
    raf = requestAnimationFrame(frame);
    const t = tDbg ?? (now - t0) / 1000;
    try { draw(g, S, kind, t, dur); } catch (e) { console.warn('[celebrate] draw error', e); me.close(false); return; }
    if (!o.debug && t >= dur) me.close(false);
  };
  if (!small) on(root, 'pointerdown', () => { if (!o.debug) me.close(true); });
  on(window, 'resize', () => { resize(); build(S, kind, text, sub, cA, cB); });
  if (o.debug) window.__celebDebug = { _owner: root, seek(t) { tDbg = Math.max(0, +t || 0); draw(g, S, kind, tDbg, dur); return tDbg; }, finish() { me.close(false); } };
  raf = requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ build (once per celebration) */
function build(S, kind, text, sub, cA, cB) {
  const { W, H, dpr } = S, sc = S.small ? 0.58 : 1, k = Math.min(W, H * 0.6) / 390 * sc, R = mulberry(kind.length * 977 + text.length * 131 + 7);
  const white = [255, 255, 255], gold = [255, 214, 100];
  const glowA = lum(cA) < 70 ? mix(cA, white, 0.5) : cA, glowB = lum(cB) < 70 ? mix(cB, white, 0.5) : cB;
  Object.assign(S, { k, glowA, glowB, cA, cB, TI: kind === 'trophy' ? 0.42 : 0.2 });
  const pal = PAL[STYLE[kind]];
  const m = cnv(4, 4).getContext('2d');
  if (kind === 'mega') {
    const chars = Array.from(text);
    let px = Math.min(W * 0.2, H * 0.16) * sc;
    m.font = `900 ${px}px ${FONT}`;
    let ws = chars.map((ch) => m.measureText(ch).width * 0.96), tot = ws.reduce((a, b) => a + b, 0);
    if (tot > W * 0.92) { const f = W * 0.92 / tot; px *= f; ws = ws.map((w) => w * f); tot *= f; }
    let x = W / 2 + tot / 2; // RTL: the first letter goes on the right
    S.letters = chars.map((ch, i) => { const sp = textSprite(ch, px * dpr, pal, { depth: Math.min(20, px * dpr * 0.1) }); const cx = x - ws[i] / 2; x -= ws[i]; return { sp, cx, i }; });
    S.px = px; S.hero = null;
  } else {
    let px = (kind === 'trophy' ? Math.min(W * 0.2, H * 0.11) : Math.min(W * 0.34, H * 0.19)) * sc;
    m.font = `900 ${px}px ${FONT}`; m.direction = 'rtl';
    const tw = m.measureText(text).width + px * 0.25; if (tw > W * 0.86) px *= W * 0.86 / tw;
    S.hero = textSprite(text, px * dpr, pal);
    S.heroR = tint(S.hero.sil, [255, 40, 90]); S.heroC = tint(S.hero.sil, [40, 220, 255]);
    S.tmp = cnv(S.hero.c.width, S.hero.c.height);
    S.px = px; S.letters = null;
  }
  S.sub = sub ? subSprite(sub, Math.max(S.small ? 13 : 15, (kind === 'mega' ? 0.07 : 0.05) * W * sc) * dpr) : null;
  S.cup = kind === 'trophy' ? trophySprite(Math.min(H * 0.36, W * 0.7) * sc * dpr) : null;
  const cols = [cA, glowB, gold, white, cA, gold];
  S.conf = kind === 'save' ? [] : confetti(R, S.small ? 60 : kind === 'mega' ? 240 : kind === 'goal' ? 150 : 200, W, H, cols, k);
  S.sparks = [];
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, v = (380 + R() * 900) * k;
    S.sparks.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, c: kind === 'save' ? [140, 255, 240] : (i % 3 ? gold : white), w: (1.2 + R() * 2.4) * k, life: 0.45 + R() * 0.5 });
  }
  S.fw = [];
  if (!S.small && (kind === 'mega' || kind === 'trophy' || kind === 'win')) {
    const plan = kind === 'mega'
      ? [[0.35, 0.25, 0.22], [0.55, 0.76, 0.18], [0.8, 0.5, 0.1], [1.05, 0.16, 0.34], [1.3, 0.84, 0.32], [1.6, 0.38, 0.16], [1.95, 0.66, 0.26], [2.3, 0.28, 0.28], [2.6, 0.72, 0.14]]
      : kind === 'trophy' ? [[0.5, 0.2, 0.16], [0.8, 0.8, 0.14], [1.2, 0.3, 0.3], [1.6, 0.72, 0.26], [2.1, 0.5, 0.1], [2.5, 0.18, 0.22]]
        : [[0.45, 0.22, 0.2], [0.85, 0.78, 0.18], [1.3, 0.5, 0.12]];
    plan.forEach(([t, x, y], j) => {
      const col = [glowA, gold, glowB, white][j % 4], ps = [];
      for (let i = 0; i < 46; i++) { const a = i / 46 * TAU + R() * 0.1, v = (230 + R() * 170) * k; ps.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + R() * 0.4 }); }
      S.fw.push({ t, x: x * W, y: y * H, col, ps });
    });
  }
  S.flash = [];
  if (!S.small && (kind === 'mega' || kind === 'trophy')) for (let i = 0; i < 44; i++) S.flash.push({ t: 0.25 + R() * 2.9, x: R() * W, y: R() < 0.7 ? R() * H * 0.36 : H * (0.36 + R() * 0.5), r: (6 + R() * 10) * k });
  if (!S.spr) S.spr = { gold: glowSprite(32, gold), white: glowSprite(32, [200, 230, 255]), teal: glowSprite(32, [60, 240, 220]) };
}

/* ------------------------------------------------------------------ draw (pure function of t) */
function draw(g, S, kind, t, dur) {
  const { W, H, dpr, k, TI } = S, cx = W / 2, cy = H * (S.small ? (kind === 'trophy' ? 0.42 : 0.3) : kind === 'trophy' ? 0.7 : 0.42);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  const out = prog(t, dur - 0.35, dur), env = 1 - out, inA = clamp(t / 0.1);
  // backdrop
  const bd = g.createRadialGradient(cx, H * 0.42, Math.min(W, H) * 0.1, cx, H * 0.42, Math.hypot(W, H) * 0.62);
  if (kind === 'mega') {
    const pulse = 0.5 + 0.5 * Math.sin(t * TAU * 2);
    bd.addColorStop(0, rgba(S.glowA, (0.5 + 0.14 * pulse) * env)); bd.addColorStop(0.55, rgba(mix(S.cA, [0, 0, 8], 0.65), 0.8 * env)); bd.addColorStop(1, `rgba(0,0,8,${0.9 * env})`);
  } else if (kind === 'save') { bd.addColorStop(0, `rgba(4,40,52,${0.55 * inA * env})`); bd.addColorStop(1, `rgba(0,6,16,${0.85 * inA * env})`); }
  else { bd.addColorStop(0, rgba(mix(S.glowA, [0, 0, 10], 0.45), 0.55 * inA * env)); bd.addColorStop(0.6, `rgba(0,0,10,${0.66 * inA * env})`); bd.addColorStop(1, `rgba(0,0,10,${0.86 * inA * env})`); }
  g.globalAlpha = S.small ? 0.42 : 1; g.fillStyle = bd; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  if (kind === 'mega' && t < 0.2 && !S.small) { const c = t < 0.06 ? S.glowA : t < 0.12 ? S.glowB : [255, 255, 255]; g.fillStyle = rgba(c, 0.85 - (t % 0.06) * 6); g.fillRect(0, 0, W, H); }
  // screen shake (120 ms after each impact)
  let sh = 0;
  const hit = (ti, a) => { if (t >= ti && t < ti + 0.12) sh = Math.max(sh, a * (1 - (t - ti) / 0.12)); };
  hit(TI, 16 * k); if (S.letters) { hit(0.16, 14 * k); hit(0.16 + (S.letters.length - 1) * 0.065, 20 * k); }
  const ox = Math.sin(t * 113) * sh, oy = Math.cos(t * 97) * sh;
  g.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
  g.globalCompositeOperation = 'lighter';
  // rotating light rays
  if (kind === 'win' || kind === 'trophy' || kind === 'mega') {
    const ra = sm(prog(t, TI - 0.1, TI + 0.4)) * env, R0 = Math.hypot(W, H), ry = kind === 'trophy' ? H * 0.38 : H * 0.42;
    if (ra > 0.01) {
      const gr = g.createRadialGradient(cx, ry, 0, cx, ry, R0 * 0.7);
      gr.addColorStop(0, `rgba(255,220,130,${0.2 * ra})`); gr.addColorStop(0.35, `rgba(255,200,100,${0.06 * ra})`); gr.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + t * 0.3, w = 0.05 + 0.03 * Math.sin(i * 1.7); g.moveTo(cx, ry); g.arc(cx, ry, R0, a - w, a + w); g.closePath(); }
      g.fill();
    }
  }
  // impact glow + shockwave rings
  const ringC = kind === 'save' ? [120, 255, 236] : [255, 236, 180];
  const gl = Math.exp(-Math.pow((t - TI) / 0.12, 2)) * env;
  if (gl > 0.02) { g.globalAlpha = gl; const r = Math.min(W, H) * 0.9; g.drawImage(kind === 'save' ? S.spr.teal : S.spr.gold, cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1; }
  for (const [d0, a0] of [[0, 1], [0.09, 0.6], [0.2, 0.35]]) {
    const p = prog(t, TI + d0, TI + d0 + 0.6); if (p <= 0 || p >= 1) continue;
    g.strokeStyle = rgba(ringC, 0.85 * (1 - p) * a0); g.lineWidth = (3 + 24 * (1 - p)) * k;
    g.beginPath(); g.arc(cx, cy, eOut(p) * Math.max(W, H) * 0.62, 0, TAU); g.stroke();
  }
  // flare sparks
  const st = t - TI;
  if (st > 0 && st < 1) for (const s of S.sparks) {
    if (st > s.life) continue;
    const e = (1 - Math.exp(-3 * st)) / 3, e0 = (1 - Math.exp(-3 * Math.max(0, st - 0.04))) / 3;
    g.strokeStyle = rgba(s.c, (1 - st / s.life) * env); g.lineWidth = s.w;
    g.beginPath(); g.moveTo(cx + s.vx * e0, cy + s.vy * e0); g.lineTo(cx + s.vx * e, cy + s.vy * e); g.stroke();
  }
  // fireworks
  for (const f of S.fw) {
    const ft = t - f.t; if (ft < 0 || ft > 1.4) continue;
    if (ft < 0.18) { g.globalAlpha = (1 - ft / 0.18) * env; const r = 70 * k; g.drawImage(S.spr.white, f.x - r, f.y - r, r * 2, r * 2); g.globalAlpha = 1; }
    g.lineWidth = 2.2 * k; g.strokeStyle = rgba(f.col, Math.pow(clamp(1 - ft / 1.3), 1.4) * env);
    g.beginPath();
    for (const p of f.ps) {
      if (ft > p.life) continue;
      const e = (1 - Math.exp(-2.4 * ft)) / 2.4, f0 = Math.max(0, ft - 0.06), e0 = (1 - Math.exp(-2.4 * f0)) / 2.4;
      g.moveTo(f.x + p.vx * e0, f.y + p.vy * e0 + 90 * f0 * f0); g.lineTo(f.x + p.vx * e, f.y + p.vy * e + 90 * ft * ft);
    }
    g.stroke();
  }
  // stadium photo flashes
  for (const f of S.flash) {
    const a = Math.exp(-Math.pow((t - f.t) / 0.035, 2)) * env; if (a < 0.03) continue;
    g.globalAlpha = a; g.drawImage(S.spr.white, f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
    g.fillStyle = '#fff'; g.fillRect(f.x - f.r * 1.6, f.y - 0.6, f.r * 3.2, 1.2); g.fillRect(f.x - 0.6, f.y - f.r * 1.6, 1.2, f.r * 3.2);
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
  // trophy
  if (S.cup) {
    const a = prog(t, 0.05, 0.5), s = a < 1 ? lerp(0.25, 1, 1 + 2.70158 * Math.pow(a - 1, 3) + 1.70158 * Math.pow(a - 1, 2)) : 1 + 0.015 * Math.sin(t * 3);
    const cw = S.cup.width / dpr, ch = S.cup.height / dpr, ty = H * (S.small ? 0.22 : 0.38) + Math.sin(t * 2) * 4 * k;
    g.globalCompositeOperation = 'lighter';
    const gr = Math.min(W, H) * (0.55 + 0.05 * Math.sin(t * 4));
    g.globalAlpha = 0.55 * clamp(a * 2) * env; g.drawImage(S.spr.gold, cx - gr, ty - gr, gr * 2, gr * 2); g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = clamp(a * 3) * env; g.drawImage(S.cup, cx - cw * s / 2, ty - ch * s / 2, cw * s, ch * s); g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const ga = Math.pow(Math.max(0, Math.sin(t * 5 + i * 1.9)), 8) * env, gx = cx + Math.cos(i * 2.4) * cw * 0.28 * s, gy = ty - ch * 0.2 * s + Math.sin(i * 1.3) * ch * 0.18 * s;
      if (ga > 0.05) { g.globalAlpha = ga; g.drawImage(S.spr.white, gx - 14 * k, gy - 14 * k, 28 * k, 28 * k); g.fillStyle = '#fff'; g.fillRect(gx - 12 * k, gy - 0.7, 24 * k, 1.4); g.fillRect(gx - 0.7, gy - 12 * k, 1.4, 24 * k); }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // the hero typography
  if (S.letters) drawLetters(g, S, t, env, ox, oy);
  else drawHero(g, S, kind, t, env, cx + ox, cy + oy);
  // sub line (player + minute)
  if (S.sub) {
    const t1 = kind === 'mega' ? 0.95 : kind === 'trophy' ? 0.85 : TI + 0.28, a = eOut(prog(t, t1, t1 + 0.3)) * env;
    if (a > 0.01) {
      const sw = S.sub.w / dpr, shh = S.sub.h / dpr, sy = S.small ? cy + S.px * 0.75 : kind === 'mega' ? H * 0.6 : kind === 'trophy' ? H * 0.8 : H * 0.42 + S.px * 1.08;
      g.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
      g.globalAlpha = a; g.drawImage(S.sub.c, cx - sw / 2, sy + (1 - a) * 26 * k, sw, shh); g.globalAlpha = 1;
    }
  }
  // v2.3: the player's own celebration move
  if (S.style) { try { drawFigure(g, S, t, env); } catch (e) { S.style = null; } }
  // confetti (drag + gravity + flutter), in front of everything
  for (const p of S.conf) {
    const tt = t - p.t0; if (tt < 0) continue;
    const [x, y] = cpos(p, tt); if (y > H + 40 || x < -60 || x > W + 60) continue;
    const r = p.rot + p.spin * tt, fl = Math.cos(p.flip * tt + p.ph), c = Math.cos(r), s = Math.sin(r);
    g.setTransform(dpr * c * fl, dpr * s * fl, -dpr * s, dpr * c, dpr * (x + ox), dpr * (y + oy));
    g.fillStyle = rgba(p.c, env, 0.6 + 0.4 * Math.abs(fl));
    if (p.shape) g.fillRect(-p.w * 0.25, -p.h * 1.2, p.w * 0.5, p.h * 2.4); else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // white flash on impact
  const wf = t >= TI && !S.small ? 0.5 * (1 - prog(t, TI, TI + 0.16)) : 0;
  if (wf > 0.01) { g.fillStyle = kind === 'save' ? `rgba(200,255,250,${wf})` : `rgba(255,250,235,${wf})`; g.fillRect(0, 0, W, H); }
}

function drawHero(g, S, kind, t, env, cx, cy) {
  const { dpr, TI, k } = S, H0 = S.hero, w = H0.w / dpr, h = H0.h / dpr;
  const t0 = kind === 'trophy' ? TI - 0.2 : 0;
  if (t < t0) return;
  const a = prog(t, t0, TI);
  let s, tilt, op;
  if (t < TI) { const e = a * a; s = lerp(3.6, 1, e); tilt = lerp(0.85, 0, e); op = clamp(a * 3); }
  else { const b = t - TI; s = 1 + 0.15 * Math.exp(-b * 9) * Math.cos(b * 27) + 0.012 * Math.sin(b * 5); tilt = 0; op = 1; }
  op *= env; s *= 1 + (1 - env) * 0.3;
  const rot = kind === 'save' ? 0.02 : -0.045, sy = s * (1 - 0.5 * tilt), yy = cy - tilt * S.H * 0.06;
  const put = (img, sc, sc2, alpha, dx = 0, comp = 'source-over') => {
    g.globalAlpha = alpha; g.globalCompositeOperation = comp;
    g.setTransform(dpr * Math.cos(rot) * sc, dpr * Math.sin(rot) * sc, -dpr * Math.sin(rot) * sc2, dpr * Math.cos(rot) * sc2, dpr * (cx + dx), dpr * yy);
    g.drawImage(img, -w / 2, -h / 2, w, h);
  };
  if (t < TI) { put(H0.c, s * 1.45, sy * 1.45, 0.16 * op); put(H0.c, s * 1.2, sy * 1.2, 0.26 * op); }
  const ch = (t >= TI ? 1 - prog(t, TI, TI + 0.32) : a) * 13 * k;
  if (ch > 0.5) { put(S.heroR, s, sy, 0.7 * op, -ch, 'lighter'); put(S.heroC, s, sy, 0.7 * op, ch, 'lighter'); }
  put(H0.c, s, sy, op);
  // light sweep across the letters
  const sw = prog(t, TI + 0.22, TI + 0.85);
  if (sw > 0 && sw < 1) {
    const tg = S.tmp.getContext('2d'), tw = S.tmp.width, th = S.tmp.height;
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, tw, th); tg.drawImage(H0.sil, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    const x = lerp(-0.3, 1.3, sw) * tw, gr = tg.createLinearGradient(x - tw * 0.12, 0, x + tw * 0.12, th * 0.3);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    tg.fillStyle = gr; tg.fillRect(0, 0, tw, th);
    put(S.tmp, s, sy, 0.75 * op, 0, 'lighter');
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawLetters(g, S, t, env, ox, oy) {
  const { dpr, H } = S, base = H * 0.4 + S.px * 0.42, zoom = 1 + 0.05 * prog(t, 0.3, 3);
  for (const L of S.letters) {
    const lt = t - (0.16 + L.i * 0.065); if (lt < 0) continue;
    const w = L.sp.w / dpr, h = L.sp.h / dpr;
    let sx, sy;
    if (lt < 0.1) { const e = eOut(lt / 0.1); sy = lerp(0.15, 1.5, e); sx = lerp(1.7, 0.8, e); }
    else { const b = lt - 0.1, d = Math.exp(-b * 9) * Math.cos(b * 30); sy = 1 + 0.5 * d; sx = 1 - 0.22 * d; }
    const wave = Math.sin(t * 9 - L.i * 0.7) * S.px * 0.06 * clamp((t - 1.0) * 2);
    const y = base + (1 - eOut(clamp(lt / 0.1))) * H * 0.07 + wave + oy, op = clamp(lt * 12) * env, z = zoom * (1 + (1 - env) * 0.25);
    const x = S.W / 2 + (L.cx - S.W / 2) * z + ox;
    g.globalAlpha = op;
    g.setTransform(dpr * sx * z, 0, 0, dpr * sy * z, dpr * x, dpr * y);   // anchored at the baseline: the stretch goes up
    g.drawImage(L.sp.c, -w / 2, -L.sp.by / dpr, w, h);
    if (lt < 0.25) {
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - lt / 0.25) * 0.8 * env; const r = S.px * 0.9;
      g.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * (y - S.px * 0.35)); g.drawImage(S.spr.gold, -r, -r, r * 2, r * 2); g.globalCompositeOperation = 'source-over';
    }
  }
  g.globalAlpha = 1; g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ------------------------------------------------------------------ v2.3 celebration moves (F6 cosmetics)
   A kit-coloured broadcast cut-out figure acting the bought celebration: knee slide, backflip, spinning jump
   ("siuu"-like landing) or heart hands. Pure function of t like everything else. Angles in the body frame are
   measured from "straight down", positive towards the facing direction. */
const FIG_STYLES = ['knee', 'backflip', 'jump', 'heart', 'airplane', 'shush', 'salute', 'dance'];
const L_TH = 0.235, L_SH = 0.235, L_UA = 0.165, L_FA = 0.155, L_TO = 0.4;

function runCycle(ft, speed = 13) {
  const ph = ft * speed;
  const leg = (i) => { const s = Math.sin(ph + i * Math.PI); const th = 0.62 * s; return [th, th - 0.35 - 0.75 * Math.max(0, Math.sin(ph + i * Math.PI + 1.4))]; };
  const arm = (i) => { const a = -0.75 * Math.sin(ph + i * Math.PI); return [a, a + 1.45]; };
  return { legs: [leg(0), leg(1)], arms: [arm(1), arm(0)], lean: 0.28, bob: Math.abs(Math.sin(ph)) * 0.03 };
}
function blendPose(a, b, t) {
  const L = (x, y) => x + (y - x) * t;
  const pair = (p, q) => [L(p[0], q[0]), L(p[1], q[1])];
  return {
    x: L(a.x || 0, b.x || 0), lift: L(a.lift || 0, b.lift || 0), rot: L(a.rot || 0, b.rot || 0), sx: L(a.sx ?? 1, b.sx ?? 1), lean: L(a.lean || 0, b.lean || 0),
    legs: [pair(a.legs[0], b.legs[0]), pair(a.legs[1], b.legs[1])], arms: [pair(a.arms[0], b.arms[0]), pair(a.arms[1], b.arms[1])],
    frontal: t < 0.5 ? !!a.frontal : !!b.frontal, bob: L(a.bob || 0, b.bob || 0),
  };
}
const STAND = { lean: 0, legs: [[0.06, 0.02], [-0.06, -0.02]], arms: [[0.15, 0.3], [-0.1, 0.2]] };
const ARMS_UP = [[2.7, 2.9], [-2.7, -2.9]];

function figPose(style, ft) {
  if (style === 'knee') {
    const run = { ...runCycle(ft), x: 0, sx: -1 };
    const kneel = { lean: -0.5, legs: [[0.2, -1.55], [0.05, -1.62]], arms: [[2.35, 2.75 + 0.15 * Math.sin(ft * 10)], [-2.2, -2.6 - 0.15 * Math.sin(ft * 10 + 1)]], x: 0, sx: -1 };
    let p, x;
    if (ft < 0.55) { p = run; x = lerp(1.15, 0.66, ft / 0.55); }
    else if (ft < 0.78) { p = blendPose(run, kneel, sm((ft - 0.55) / 0.23)); x = lerp(0.66, 0.56, (ft - 0.55) / 0.23); }
    else { p = kneel; x = lerp(0.56, 0.34, eOut(clamp((ft - 0.78) / 0.9))); }
    return { ...p, x, slide: ft > 0.7 && ft < 1.6 ? 1 - clamp((ft - 0.7) / 0.9) : 0 };
  }
  if (style === 'backflip') {
    const base = { x: 0.5, sx: 1 };
    const crouch = { ...base, lean: 0.45, legs: [[1.25, -0.55], [1.15, -0.6]], arms: [[-1.2, -0.7], [-1.3, -0.8]] };
    const tuck = { ...base, lean: 0.2, legs: [[2.1, 0.1], [2.0, 0.0]], arms: [[1.6, 2.4], [1.5, 2.3]] };
    const land = { ...base, lean: 0.15, legs: [[0.8, -0.4], [0.7, -0.45]], arms: [[1.6, 1.9], [1.5, 1.8]] };
    const v = { ...base, lean: 0, legs: [[0.1, 0.05], [-0.1, -0.05]], arms: ARMS_UP };
    if (ft < 0.3) return blendPose({ ...base, ...STAND }, v, sm(ft / 0.3));
    if (ft < 0.5) return blendPose(v, crouch, sm((ft - 0.3) / 0.2));
    if (ft < 1.12) {
      const a = (ft - 0.5) / 0.62;
      const pose = a < 0.3 ? blendPose(crouch, tuck, sm(a / 0.3)) : a > 0.75 ? blendPose(tuck, land, sm((a - 0.75) / 0.25)) : tuck;
      return { ...pose, lift: 4 * a * (1 - a) * 0.95, rot: -TAU * sm(a), air: 1 };
    }
    if (ft < 1.35) return blendPose(land, v, sm((ft - 1.12) / 0.23));
    return { ...v, arms: [[2.7 + 0.12 * Math.sin(ft * 9), 2.9], [-2.7 - 0.12 * Math.sin(ft * 9 + 1), -2.9]] };
  }
  if (style === 'jump') {
    const run = { ...runCycle(ft), sx: -1, x: 0 };
    const take = { lean: 0.3, legs: [[1.0, -0.6], [0.9, -0.5]], arms: [[-0.9, -0.5], [-1.0, -0.6]], sx: -1, x: 0 };
    const air = { lean: 0, legs: [[0.05, 0.0], [-0.05, 0.0]], arms: [[0.25, 0.1], [-0.25, -0.1]], x: 0 };
    const siu = { lean: 0, legs: [[0.5, 0.35], [-0.5, -0.35]], arms: [[1.05, 0.95], [-1.05, -0.95]], frontal: true, sx: 1, x: 0 };
    if (ft < 0.45) return { ...run, x: lerp(1.12, 0.55, ft / 0.45) };
    if (ft < 0.6) return { ...blendPose(run, take, sm((ft - 0.45) / 0.15)), x: 0.55 };
    if (ft < 1.12) {
      const a = (ft - 0.6) / 0.52;
      return { ...blendPose(take, air, sm(clamp(a / 0.25))), x: 0.53, lift: 4 * a * (1 - a) * 0.75, sx: Math.cos(Math.PI * (1 + sm(a))), air: 1 };
    }
    if (ft < 1.3) return { ...blendPose({ ...air, sx: 1 }, siu, sm((ft - 1.12) / 0.18)), x: 0.53, ring: ft - 1.12 };
    return { ...siu, x: 0.53, ring: ft - 1.12 };
  }
  if (style === 'airplane') {
    const run = { ...runCycle(ft), sx: -1, x: 0 };
    const plane = { lean: 0.15, legs: [[0.35, -0.3], [-0.3, -0.5]], arms: [[1.57, 1.57], [-1.57, -1.57]], frontal: true, sx: 1, x: 0 };
    if (ft < 0.35) return { ...run, x: lerp(1.12, 0.8, ft / 0.35) };
    if (ft < 0.55) return { ...blendPose(run, plane, sm((ft - 0.35) / 0.2)), x: lerp(0.8, 0.72, (ft - 0.35) / 0.2) };
    const a = ft - 0.55;
    const cyc = runCycle(ft, 9);
    return { ...plane, legs: cyc.legs.map(([t1, t2]) => [t1 * 0.5, t2 * 0.6]), x: 0.72 - Math.min(0.42, a * 0.32), rot: 0.32 * Math.sin(a * 3.2), bob: cyc.bob };
  }
  if (style === 'shush' || style === 'salute') {
    const run = { ...runCycle(ft), sx: -1, x: 0 };
    const pose = style === 'shush'
      ? { lean: -0.05, legs: [[0.12, 0.08], [-0.12, -0.08]], arms: [[0.25, 0.15], [-2.6, 1.4]], frontal: true, sx: 1, x: 0 }
      : { lean: -0.04, legs: [[0.05, 0.03], [-0.05, -0.03]], arms: [[0.12, 0.05], [-2.3, 2.04]], frontal: true, sx: 1, x: 0 };
    if (ft < 0.55) return { ...run, x: lerp(1.12, 0.5, eOut(ft / 0.55)) };
    if (ft < 0.8) return { ...blendPose(run, pose, sm((ft - 0.55) / 0.25)), x: 0.5 };
    return { ...pose, x: 0.5, still: 1 };
  }
  if (style === 'dance') {
    const run = { ...runCycle(ft), sx: -1, x: 0 };
    const dance = (tt) => { const s1 = Math.sin(tt * 9), s2 = Math.sin(tt * 9 + Math.PI);
      return { lean: 0.12 * s1, legs: [[0.25 + 0.2 * s1, -0.1 - 0.5 * Math.max(0, s1)], [-0.25 + 0.2 * s1, 0.1 + 0.5 * Math.max(0, s2)]], arms: [[1.3 + 0.6 * s1, 2.5], [-1.3 + 0.6 * s1, -2.5]], frontal: true, sx: 1, x: 0, bob: 0.03 * Math.abs(s1) }; };
    if (ft < 0.5) return { ...run, x: lerp(1.12, 0.5, eOut(ft / 0.5)) };
    if (ft < 0.7) return { ...blendPose(run, dance(ft), sm((ft - 0.5) / 0.2)), x: 0.5 };
    return { ...dance(ft), x: 0.5 + 0.04 * Math.sin(ft * 4.5) };
  }
  // heart hands: jog in, face the crowd, hands make a heart in front of the chest
  const run = { ...runCycle(ft, 10), sx: -1, x: 0 };
  const heart = { lean: 0, legs: [[0.14, 0.1], [-0.14, -0.1]], arms: [[0.5, -2.05], [-0.5, 2.05]], frontal: true, sx: 1, x: 0 };
  if (ft < 0.6) return { ...run, x: lerp(1.12, 0.5, eOut(ft / 0.6)) };
  if (ft < 0.85) return { ...blendPose(run, heart, sm((ft - 0.6) / 0.25)), x: 0.5 };
  return { ...heart, x: 0.5, heart: ft - 0.85 };
}

function drawFigure(g, S, t, env) {
  const ft = t - (S.TI + 0.12);
  if (ft < 0) return;
  const { W, H, dpr, k } = S;
  const U = Math.min(200 * k, H * 0.24);
  const ground = H * 0.94;
  const P = figPose(S.style, ft);
  const kit = S.cA, kitB = S.cB;
  const boots = parseColor(S.boots, [244, 195, 90]);
  const skin = parseColor(S.skin, [201, 140, 98]);
  const shorts = lum(kitB) > 30 ? kitB : mix(kit, [0, 0, 0], 0.5);
  const fr = !!P.frontal;
  const seg = (x, y, a, l) => [x + Math.sin(a) * l * U, y + Math.cos(a) * l * U];
  const legEnd = (i) => { const [th, sh] = P.legs[i]; const hx0 = fr ? (i ? -0.055 : 0.055) * U : 0; const kn = seg(hx0, 0, th, L_TH); const f = seg(kn[0], kn[1], sh, L_SH); return { hip: [hx0, 0], kn, ft: f, sh }; };
  const legs = [legEnd(0), legEnd(1)];
  const lean = P.lean || 0;
  const neck = [Math.sin(lean) * L_TO * U, -Math.cos(lean) * L_TO * U];
  const head = [neck[0] + Math.sin(lean) * 0.11 * U, neck[1] - Math.cos(lean) * 0.11 * U];
  const armEnd = (i) => { const [ua, fa] = P.arms[i]; const sx0 = fr ? (i ? -0.085 : 0.085) * U : 0; const sh0 = [neck[0] + sx0, neck[1] + 0.03 * U]; const el = seg(sh0[0], sh0[1], ua, L_UA); const hd = seg(el[0], el[1], fa, L_FA); return { sh: sh0, el, hd }; };
  const arms = [armEnd(0), armEnd(1)];
  let low = 0;
  if (!P.air) for (const l of legs) low = Math.max(low, l.ft[1], l.kn[1]);
  else low = (L_TH + L_SH) * U * 0.92;
  const bob = (P.bob || 0) * U;
  const hx = P.x * W, hy = ground - low - (P.lift || 0) * U - bob - 0.025 * U;
  const op = clamp(ft * 5) * env;
  if (op <= 0.01) return;
  g.save();
  g.globalAlpha = op;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shw = U * (0.34 - Math.min(0.2, (P.lift || 0) * 0.25));
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(hx, ground, Math.max(1, shw), U * 0.05, 0, 0, TAU); g.fill();
  if (P.slide > 0) {
    for (let i = 0; i < 26; i++) {
      const a = (i * 0.618) % 1, life = (ft * 3 + a) % 1;
      const px = hx + (P.sx < 0 ? 1 : -1) * (0.1 + life * 0.9) * U, py = ground - Math.sin(life * Math.PI) * U * (0.12 + a * 0.18);
      g.fillStyle = i % 3 ? `rgba(120,220,120,${0.8 * (1 - life) * P.slide})` : `rgba(255,255,255,${0.7 * (1 - life) * P.slide})`;
      g.fillRect(px, py, 2.6 * k, 2.6 * k);
    }
  }
  if (P.ring !== undefined && P.ring < 0.6) {
    const p = P.ring / 0.6;
    g.strokeStyle = `rgba(255,230,160,${0.8 * (1 - p)})`; g.lineWidth = (2 + 10 * (1 - p)) * k;
    g.beginPath(); g.ellipse(hx, ground, U * (0.2 + p * 1.4), U * (0.05 + p * 0.3), 0, 0, TAU); g.stroke();
  }
  const com = -0.18 * U;
  g.setTransform(dpr, 0, 0, dpr, dpr * hx, dpr * hy);
  g.translate(0, com); g.rotate(P.rot || 0); g.translate(0, -com);
  const sxv = P.sx === undefined ? 1 : P.sx;
  g.scale(Math.abs(sxv) < 0.08 ? (sxv < 0 ? -0.08 : 0.08) : sxv, 1);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(150,255,240,.55)'; g.shadowBlur = 10 * k;
  const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
  const lerpP = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const dk = (c, on) => (on ? mix(c, [0, 0, 0], 0.32) : c);
  const drawLeg = (l, dark) => {
    line([l.hip, l.kn], 0.085 * U, rgba(dk(skin, dark)));
    line([l.hip, lerpP(l.hip, l.kn, 0.4)], 0.095 * U, rgba(dk(shorts, dark)));
    line([l.kn, l.ft], 0.07 * U, rgba(dk(skin, dark)));
    line([lerpP(l.kn, l.ft, 0.3), l.ft], 0.078 * U, rgba(dk(kit, dark)));
    const fa = l.sh + Math.PI / 2;
    const toe = [l.ft[0] + Math.sin(fa) * 0.085 * U, l.ft[1] + Math.cos(fa) * 0.085 * U];
    line([[l.ft[0] - Math.sin(fa) * 0.02 * U, l.ft[1] - Math.cos(fa) * 0.02 * U], toe], 0.06 * U, rgba(dk(boots, dark)));
  };
  const drawArm = (a, dark) => {
    line([a.sh, a.el], 0.07 * U, rgba(dk(kit, dark)));
    line([a.el, a.hd], 0.058 * U, rgba(dk(skin, dark)));
    g.fillStyle = rgba(dk(skin, dark)); g.beginPath(); g.arc(a.hd[0], a.hd[1], 0.035 * U, 0, TAU); g.fill();
  };
  drawLeg(legs[1], !fr); drawArm(arms[1], !fr);
  line([[0, -0.02 * U], neck], 0.16 * U, rgba(kit));
  line([lerpP([0, 0], neck, 0.86), neck], 0.11 * U, rgba(mix(kitB, kit, 0.2)));
  line([[0, -0.02 * U], [0, 0.03 * U]], 0.15 * U, rgba(shorts));
  drawLeg(legs[0], false);
  g.fillStyle = rgba(skin); g.beginPath(); g.arc(head[0], head[1], 0.085 * U, 0, TAU); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(30,18,10,.95)'; g.beginPath(); g.arc(head[0] - (fr ? 0 : 0.012 * U), head[1] - 0.012 * U, 0.088 * U, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  g.shadowBlur = 10 * k;
  drawArm(arms[0], false);
  g.restore();
  if (P.heart !== undefined) {
    const hp = arms[0].hd, hq = arms[1].hd;
    const mx = hx + (hp[0] + hq[0]) / 2, my = hy + (hp[1] + hq[1]) / 2 - 0.03 * U;
    const s = (0.07 + 0.012 * Math.sin(P.heart * 12)) * U * clamp(P.heart * 4);
    const heartPath = (x, y, r) => { g.beginPath(); g.moveTo(x, y + r * 0.9); g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5); g.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); g.fill(); };
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = op;
    g.fillStyle = '#FF4F7A'; g.shadowColor = 'rgba(255,80,130,.8)'; g.shadowBlur = 16 * k;
    if (s > 0.5) heartPath(mx, my, s);
    for (let i = 0; i < 7; i++) {
      const life = (P.heart * 0.7 + i / 7) % 1, x = mx + Math.sin(i * 2.1 + life * 5) * U * 0.5, y = my - life * U * 1.6;
      g.globalAlpha = op * (1 - life) * clamp(P.heart * 2); g.fillStyle = i % 2 ? '#FF7AA8' : '#FFD0DF'; heartPath(x, y, U * 0.035);
    }
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1;
}

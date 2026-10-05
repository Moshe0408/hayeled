// intro.js: the 8-second opening cinematic of "הילד מהשכונה" (contract C8).
//
//   playIntro({ force = false } = {}) -> Promise<void>
//
// Canvas 2D with a real perspective camera (look-at basis, focal-length projection, near-plane clipping,
// painter's z-sorting, exponential depth fog, additive bloom sprites, motion trails). No libraries.
// Storyboard (seconds):
//   0.0-1.6  dusk, a concrete court between shikun blocks, laundry lines, a street lamp flickers on,
//            slow dolly-in on a kid (shirt #10) juggling a ball (squash & stretch).
//   1.6-3.0  low-angle close-up: foot on the ball, the kid looks up at the far glow of a stadium. Beat.
//   3.0-4.2  flick-up and a volley straight at the lens: the ball grows to fill the screen (zoom blur, whoosh).
//   4.2-5.6  smash-cut through the ball into a giant floodlit stadium at night: fly-over of the crowd
//            (instanced fans, flashing phone lights, waving flags, red flare smoke), floodlight lens flares.
//   5.6-8.0  the logo (icons/logo.svg) slams in with a 3D tilt, light sweep and particles, the tagline types
//            in, then the overlay fades into the title screen.
// Plays on EVERY app open (each page load / PWA launch, v2.1); 'hy.intro.seen' / 'hy.intro.session' are still
// written for telemetry/debugging. Tests set localStorage 'hy.intro.skip' = '1'. playIntro resolves { done }:
// done=true when it played to the end, false when it was skipped. Skippable (button "דלג ›", tap after 0.5 s, Esc).
// prefers-reduced-motion -> a 1.5 s logo reveal instead. Sound only if 'hy.sound' === '1' and the browser
// lets an AudioContext run (i.e. after a user gesture).
// Debug (preview page / frame capture): while an intro is mounted, window.__introDebug =
//   { seek(t), play(), pause(), stats(), finish() }; playIntro({ force:true, debug:true }) starts paused.

const DUR = 8.0;
const TAU = Math.PI * 2;
const NEAR = 0.05;
const LOGO_URL = new URL('../../../icons/logo.svg', import.meta.url).href;
const TAGLINE = 'מהשכונה ועד הבאלון ד׳אור';

/* ------------------------------------------------------------------ helpers */
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const sm = (t) => t * t * (3 - 2 * t);
const eOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const eIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eIn = (t) => t * t;
const bump = (t, c, w) => { const x = (t - c) / w; return Math.exp(-x * x); };
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function cnv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
/** Soft radial sprite (bloom). rgb = [r,g,b]; core = 0..1 hot-core size. */
function glowSprite(r, rgb, core = 0.18, hot = [255, 255, 255]) {
  const c = cnv(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  const [R, G, B] = rgb;
  gr.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},1)`);
  gr.addColorStop(core, `rgba(${R},${G},${B},0.75)`);
  gr.addColorStop(core + (1 - core) * 0.35, `rgba(${R},${G},${B},0.22)`);
  gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
function softSprite(r, rgb, a = 1) {
  const c = cnv(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  gr.addColorStop(0.5, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * 0.45})`);
  gr.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
const rgba = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ------------------------------------------------------------------ camera */
// World: x right, y up, z forward (metres). The camera is a look-at basis; P() projects one point
// into the globals PX, PY (CSS px), PS (px per metre at that depth) and PZ (camera-space depth).
const C = { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: 1, f: 500, cx: 0, cy: 0 };
let PX = 0, PY = 0, PS = 0, PZ = 0;
function lookAt(px, py, pz, tx, ty, tz, roll = 0) {
  let fx = tx - px, fy = ty - py, fz = tz - pz;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, ry = 0, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // R = up x F
  let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;               // U = F x R
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s;
    ux = ux * c - rx * s; uy = uy * c - ry * s; uz = uz * c - rz * s; rx = nrx; ry = nry; rz = nrz;
  }
  C.x = px; C.y = py; C.z = pz; C.fx = fx; C.fy = fy; C.fz = fz; C.rx = rx; C.ry = ry; C.rz = rz; C.ux = ux; C.uy = uy; C.uz = uz;
}
function P(x, y, z) {
  const dx = x - C.x, dy = y - C.y, dz = z - C.z;
  const cz = dx * C.fx + dy * C.fy + dz * C.fz; PZ = cz;
  if (cz < NEAR) return false;
  const s = C.f / cz;
  PX = C.cx + (dx * C.rx + dy * C.ry + dz * C.rz) * s;
  PY = C.cy - (dx * C.ux + dy * C.uy + dz * C.uz) * s;
  PS = s; return true;
}
const dist3 = (x, y, z) => Math.hypot(x - C.x, y - C.y, z - C.z);
// polygon path with near-plane clipping (Sutherland-Hodgman against cz >= NEAR)
const _cs = new Float64Array(96), _cl = new Float64Array(96);
function polyPath(g, pts) {
  const n = pts.length / 3;
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - C.x, dy = pts[i * 3 + 1] - C.y, dz = pts[i * 3 + 2] - C.z;
    _cs[i * 3] = dx * C.rx + dy * C.ry + dz * C.rz; _cs[i * 3 + 1] = dx * C.ux + dy * C.uy + dz * C.uz; _cs[i * 3 + 2] = dx * C.fx + dy * C.fy + dz * C.fz;
  }
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, az = _cs[i * 3 + 2], bz = _cs[j * 3 + 2], ain = az >= NEAR, bin = bz >= NEAR;
    if (ain) { _cl[m * 3] = _cs[i * 3]; _cl[m * 3 + 1] = _cs[i * 3 + 1]; _cl[m * 3 + 2] = az; m++; }
    if (ain !== bin) {
      const k = (NEAR - az) / (bz - az);
      _cl[m * 3] = _cs[i * 3] + (_cs[j * 3] - _cs[i * 3]) * k; _cl[m * 3 + 1] = _cs[i * 3 + 1] + (_cs[j * 3 + 1] - _cs[i * 3 + 1]) * k; _cl[m * 3 + 2] = NEAR; m++;
    }
  }
  if (m < 3) return false;
  for (let i = 0; i < m; i++) {
    const s = C.f / _cl[i * 3 + 2], x = C.cx + _cl[i * 3] * s, y = C.cy - _cl[i * 3 + 1] * s;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); return true;
}
// quad helper: 4 corners as 12 numbers
const _q = new Float64Array(12);
function quad(g, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  _q[0] = ax; _q[1] = ay; _q[2] = az; _q[3] = bx; _q[4] = by; _q[5] = bz; _q[6] = cx; _q[7] = cy; _q[8] = cz; _q[9] = dx; _q[10] = dy; _q[11] = dz;
  return polyPath(g, _q);
}
/** 3D segment as a stroke (both ends must be in front of the camera). Returns projected width scale. */
function seg(g, ax, ay, az, bx, by, bz) {
  if (!P(ax, ay, az)) return 0; const x1 = PX, y1 = PY, s1 = PS;
  if (!P(bx, by, bz)) return 0;
  g.moveTo(x1, y1); g.lineTo(PX, PY); return (s1 + PS) * 0.5;
}

/* ------------------------------------------------------------------ audio */
// Synthesised score: ambient wind, ball thumps, a whoosh into the lens, a boom on the smash-cut,
// a crowd swell in the stadium and a shimmer on the logo. Only plays if the context can run.
function makeAudio() {
  let want = false; try { want = localStorage.getItem('hy.sound') === '1'; } catch { /* private mode */ }
  if (!want) return null;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  let ac; try { ac = new AC(); } catch { return null; }
  const master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  let scheduled = false;
  const noise = (at, dur) => { const n = ac.createBufferSource(); n.buffer = buf; n.loop = true; n.start(at); n.stop(at + dur + 0.05); return n; };
  const env = (node, at, peak, a, hold, rel) => {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel); node.connect(g).connect(master); return g;
  };
  function thump(at, v) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(55, at + 0.12);
    env(o, at, 0.5 * v, 0.004, 0, 0.16); o.start(at); o.stop(at + 0.2);
    const n = noise(at, 0.05), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; n.connect(f); env(f, at, 0.18 * v, 0.002, 0, 0.04);
  }
  function whoosh(at, dur) {
    const n = noise(at, dur), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(260, at); f.frequency.exponentialRampToValueAtTime(3400, at + dur); n.connect(f);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.75, at + dur); g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.03);
    f.connect(g).connect(master);
  }
  function boom(at) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(32, at + 1.1);
    env(o, at, 0.9, 0.01, 0.05, 1.2); o.start(at); o.stop(at + 1.4);
    const n = noise(at, 0.6), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; n.connect(f); env(f, at, 0.5, 0.005, 0.05, 0.5);
  }
  function crowd(at, end) {
    const n = noise(at, end - at + 0.6);
    [[650, 0.6, 0.55], [1500, 0.9, 0.3]].forEach(([fr, q, v]) => {
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; n.connect(f);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.9);
      g.gain.setValueAtTime(v, end - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.5); f.connect(g).connect(master);
    });
  }
  function wind(at, end) {
    const n = noise(at, end - at), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; n.connect(f);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09, at + 0.6); g.gain.setValueAtTime(0.09, end - 0.1); g.gain.linearRampToValueAtTime(0.0001, end);
    f.connect(g).connect(master);
  }
  function shimmer(at) {
    [1318.5, 1760, 2637, 3520].forEach((fr, i) => {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; env(o, at + i * 0.05, 0.07, 0.01, 0.1, 1.4); o.start(at + i * 0.05); o.stop(at + 2);
    });
  }
  const EV = [
    [0, (a, t0) => wind(a, a + Math.max(0.2, 4.2 - t0))],
    [0.0, (a) => thump(a, 0.6)], [0.55, (a) => thump(a, 0.6)], [1.1, (a) => thump(a, 0.5)], [1.5, (a) => thump(a, 0.4)],
    [3.22, (a) => thump(a, 0.4)], [3.55, (a) => thump(a, 1.0)], [3.56, (a) => whoosh(a, 0.62)],
    [4.2, (a) => boom(a)], [4.2, (a) => crowd(a, a + 3.8)], [5.85, (a) => boom(a)], [5.9, (a) => shimmer(a)],
  ];
  return {
    tryStart(tNow) {
      if (scheduled) return;
      const go = () => {
        if (scheduled || ac.state !== 'running') return; scheduled = true;
        const base = ac.currentTime + 0.02 - tNow();
        for (const [t, fn] of EV) { if (t >= tNow() - 0.01 || t === 0) { try { fn(Math.max(ac.currentTime + 0.01, base + t), tNow()); } catch { /* ignore */ } } }
      };
      if (ac.state === 'running') go(); else ac.resume().then(go, () => {});
    },
    stop() {
      try { master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.12); } catch { /* ignore */ }
      setTimeout(() => { try { ac.close(); } catch { /* ignore */ } }, 600);
    },
  };
}

/* ------------------------------------------------------------------ pattern / sprite mapping */
// Affine-map a pattern so that texture (u0,v0) lands on screen A, (u0+du,v0) on B and (u0,v0+dv) on C.
function patAffine(pat, ax, ay, bx, by, cx, cy, du, dv, u0 = 0, v0 = 0) {
  const a = (bx - ax) / du, b = (by - ay) / du, c = (cx - ax) / dv, d = (cy - ay) / dv;
  pat.setTransform(new DOMMatrix([a, b, c, d, ax - a * u0 - c * v0, ay - b * u0 - d * v0]));
}
/** Draw a radial sprite lying flat on the ground plane (y = gy) centred at (x,z) with radii rx, rz. */
function groundSprite(g, dpr, img, x, gy, z, rx, rz, alpha) {
  if (!P(x, gy, z)) return; const cx = PX, cy = PY;
  if (!P(x + rx, gy, z)) return; const ax = PX - cx, ay = PY - cy;
  if (!P(x, gy, z + rz)) return; const bx = PX - cx, by = PY - cy;
  g.globalAlpha = alpha;
  g.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * cx, dpr * cy);
  g.drawImage(img, -1, -1, 2, 2);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1;
}
function sprite(g, img, x, y, r, a = 1) { if (r < 0.4 || a <= 0.003) return; g.globalAlpha = a; g.drawImage(img, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }

/* ------------------------------------------------------------------ neighbourhood (dusk) */
const SUN = (() => { const v = [-0.42, 0.18, 1]; const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); })();
const FOG_H = [70, 56, 104];
const fogH = (d) => 1 - Math.exp(-d / 170);

function buildHood() {
  const R = mulberry(1987);
  const H = { blocks: [], far: [], stars: [], palms: [], wires: [], poles: [], clothes: [] };
  const defs = [
    { x0: -24, x1: 9, z0: 34, z1: 44, h: 15.6, fl: 4, pil: 3.2, c: [190, 170, 166], balc: 0 },
    { x0: 14, x1: 25, z0: 2, z1: 40, h: 21.8, fl: 6, pil: 3.2, c: [196, 176, 164], balc: 2 },
    { x0: -29, x1: -17, z0: -8, z1: 27, h: 12.8, fl: 3, pil: 0, c: [172, 160, 170], balc: 1 },
    { x0: 12, x1: 44, z0: 58, z1: 68, h: 28.4, fl: 8, pil: 3.2, c: [176, 160, 172] },
    { x0: -62, x1: -30, z0: 50, z1: 60, h: 18.8, fl: 5, pil: 0, c: [170, 156, 166] },
    { x0: -16, x1: 6, z0: 86, z1: 96, h: 37, fl: 11, pil: 3, c: [160, 150, 172] },
    { x0: -26, x1: 16, z0: -36, z1: -25, h: 18.8, fl: 5, pil: 3.2, c: [186, 166, 162], balc: 3 },
    { x0: 20, x1: 31, z0: -46, z1: -6, h: 15.6, fl: 4, pil: 3.2, c: [178, 162, 164], balc: 2 },
    { x0: -50, x1: -31, z0: -64, z1: -42, h: 31, fl: 9, pil: 3, c: [168, 156, 174] },
    { x0: 34, x1: 60, z0: -80, z1: -70, h: 24, fl: 7, pil: 3, c: [168, 156, 174] },
  ];
  for (const d of defs) {
    const b = { ...d, faces: [], heaters: [], cx: (d.x0 + d.x1) / 2, cz: (d.z0 + d.z1) / 2 };
    b.faces.push({ o: [d.x0, d.z0], u: [1, 0], len: d.x1 - d.x0, n: [0, -1] });
    b.faces.push({ o: [d.x1, d.z0], u: [0, 1], len: d.z1 - d.z0, n: [1, 0] });
    b.faces.push({ o: [d.x0, d.z1], u: [0, -1], len: d.z1 - d.z0, n: [-1, 0] });
    b.faces.push({ o: [d.x1, d.z1], u: [-1, 0], len: d.x1 - d.x0, n: [0, 1] });
    const base = d.pil || 0.4, fh = (d.h - base - 0.7) / d.fl;
    b.base = base; b.fh = fh;
    b.faces.forEach((f, fi) => {
      f.win = []; f.cols = Math.max(2, Math.floor((f.len - 2) / 3.2)); f.step = (f.len - 2) / f.cols;
      const sun = Math.max(0, f.n[0] * SUN[0] + f.n[1] * SUN[2]);
      f.sun = sun;
      for (let fl = 0; fl < d.fl; fl++) for (let ci = 0; ci < f.cols; ci++) {
        const lit = R() < 0.34, tv = lit && R() < 0.16;
        f.win.push({ u: 1 + f.step * (ci + 0.5), y: base + fl * fh + fh * 0.3, w: Math.min(1.45, f.step * 0.46), h: fh * 0.44, lit, tv,
          col: tv ? [150, 186, 255] : (R() < 0.55 ? [255, 188, 104] : [255, 220, 156]), sh: 0.1 + R() * 0.5, ph: R() * 10 });
      }
      if (d.balc === fi) {
        f.balc = true;
        for (let fl = 0; fl < d.fl; fl++) for (let ci = 0; ci < f.cols; ci++) {
          if (R() > 0.5) continue;
          const u0 = 1 + f.step * ci + 0.3, n = 2 + Math.floor(R() * 4), yl = base + fl * fh + fh * 0.9;
          for (let k = 0; k < n; k++) {
            const u = u0 + (k + 0.5) * (f.step - 0.6) / n;
            const pal = [[226, 92, 86], [244, 238, 226], [86, 140, 210], [250, 206, 92], [120, 190, 150], [214, 120, 170], [244, 238, 226]];
            H.clothes.push({ b, f, u, y: yl, w: Math.min(0.62, (f.step - 0.6) / n * 0.85), h: 0.35 + R() * 0.55, c: pal[Math.floor(R() * pal.length)], ph: R() * TAU });
          }
        }
      }
    });
    const nH = Math.floor((d.x1 - d.x0) / 3.6);
    for (let i = 0; i < nH; i++) if (R() < 0.75) b.heaters.push({ x: d.x0 + 1.4 + i * 3.6 + R() * 0.8, z: d.z0 + 1.2 + R() * Math.max(0.5, d.z1 - d.z0 - 3), ant: R() < 0.28 });
    H.blocks.push(b);
  }
  // far skyline in both directions
  for (const side of [1, -1]) for (let i = 0; i < 16; i++) {
    const x = -260 + i * 34 + R() * 12, z = side * (140 + R() * 150), w = 16 + R() * 22, h = 10 + R() * 40;
    const dots = []; for (let k = 0; k < 6 + h / 3; k++) dots.push([R() * w, 2 + R() * (h - 3)]);
    H.far.push({ x, z, w, h, side, dots });
  }
  for (let i = 0; i < 110; i++) {
    const az = (R() - 0.5) * 2.6 + (i % 2 ? Math.PI : 0), el = 0.12 + Math.pow(R(), 0.7) * 1.1;
    H.stars.push({ x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: Math.cos(az) * Math.cos(el), r: R() < 0.12 ? 1.4 : 0.5 + R() * 0.6, ph: R() * TAU, sp: 1 + R() * 3 });
  }
  H.palms.push({ x: -12, z: 31, h: 10.5, lean: 0.12 }, { x: 11.5, z: 48, h: 12.5, lean: -0.08 }, { x: -36, z: 42, h: 9, lean: 0.05 },
    { x: 9, z: -18, h: 11, lean: -0.1 }, { x: -14, z: -16, h: 9.5, lean: 0.1 });
  H.poles.push([-10.5, 28, 9], [12, 30, 9], [-11, -12, 9], [12.5, -14, 9]);
  H.wires.push([-10.5, 8.6, 28, 12, 8.6, 30, 1.0], [-10.5, 8.2, 28, -17, 11.5, 22, 0.6], [12, 8.2, 30, 14, 16, 33, 0.4],
    [-11, 8.6, -12, 12.5, 8.6, -14, 1.1], [-11, 8.2, -12, -26, 15, -25, 0.8], [12.5, 8.2, -14, 20, 14, -10, 0.5]);
  // laundry line strung across the gap between two blocks
  H.cross = { a: [9, 9.8, 35], b: [14, 10.6, 27], sag: 0.7, items: [] };
  for (let k = 0; k < 9; k++) H.cross.items.push({ s: 0.08 + k * 0.105, w: 0.45 + R() * 0.25, h: 0.4 + R() * 0.5, c: [[244, 238, 226], [226, 92, 86], [86, 140, 210], [250, 206, 92], [140, 200, 170]][k % 5], ph: R() * TAU });
  // chain-link / net patterns
  const link = cnv(24, 24), lg = link.getContext('2d');
  lg.strokeStyle = 'rgba(205,205,225,.55)'; lg.lineWidth = 1.2;
  lg.beginPath(); lg.moveTo(0, 12); lg.lineTo(12, 0); lg.lineTo(24, 12); lg.lineTo(12, 24); lg.closePath(); lg.stroke();
  H.linkImg = link;
  const net = cnv(16, 16), ng = net.getContext('2d'); ng.strokeStyle = 'rgba(235,235,245,.5)'; ng.lineWidth = 1; ng.strokeRect(0.5, 0.5, 16, 16);
  H.netImg = net;
  return H;
}

// Street lamp: flickers on between 0.32 s and 0.95 s, then a sodium warm-up.
function lampLevel(t) {
  if (t < 0.32) return 0;
  const F = [[0.32, 0.36, 0.9], [0.45, 0.48, 0.7], [0.62, 0.7, 0.45], [0.78, 9, 1]];
  for (const [a, b, v] of F) if (t >= a && t < b) return b > 8 ? lerp(0.55, 1, prog(t, 0.78, 1.05)) * (0.97 + 0.03 * Math.sin(t * 61)) : v;
  return 0.04;
}
const LAMP = { x: -5.6, z: 12.6, h: 6.0, hx: -4.3 };

function horizonY() {
  const hl = Math.hypot(C.fx, C.fz) || 1;
  P(C.x + C.fx / hl * 1e5, C.y, C.z + C.fz / hl * 1e5); return PY;
}
const SKY_W = [[255, 152, 96], [238, 106, 104], [128, 66, 128], [46, 36, 98], [12, 14, 46]];
const SKY_E = [[92, 80, 140], [66, 60, 126], [40, 40, 104], [20, 26, 74], [7, 11, 36]];
const SKY_S = [0, 0.07, 0.2, 0.45, 1];

function drawHoodSky(g, S, t, dream) {
  const { W, H } = S, hy = horizonY(), hl = Math.hypot(C.fx, C.fz) || 1, warm = clamp(0.5 + 0.55 * (C.fz / hl));
  const gr = g.createLinearGradient(0, hy, 0, hy - C.f * 1.8);
  for (let i = 0; i < 5; i++) gr.addColorStop(SKY_S[i], rgba(mix(SKY_E[i], SKY_W[i], warm)));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // stars (projected at infinity), more of them in the east
  g.fillStyle = '#fff';
  for (const s of S.hood.stars) {
    if (!P(C.x + s.x * 1e4, C.y + s.y * 1e4, C.z + s.z * 1e4)) continue;
    if (PX < 0 || PX > W || PY < 0 || PY > H) continue;
    const a = (s.z < 0 ? 0.85 : 0.35) * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)) * clamp((hy - PY) / (C.f * 0.5));
    if (a <= 0.03) continue; g.globalAlpha = a; g.fillRect(PX, PY, s.r, s.r);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  // sunset glow behind the western blocks
  if (P(C.x - 4200, C.y + 250, C.z + 10000)) sprite(g, S.spr.sunset, PX, PY, C.f * 1.1, 0.55);
  // the dream: a far stadium glowing in the east, beams sweeping the sky
  if (dream > 0.01) {
    if (P(-30, 30, -520)) sprite(g, S.spr.dome, PX, PY, 300 * PS, 0.9 * dream);
    for (let i = 0; i < 8; i++) {
      const ox = -66 + i * 11, tilt = Math.sin(t * 0.8 + i * 1.7) * 0.32 + (i - 3.5) * 0.11;
      const tx = ox + tilt * 420;
      if (!P(ox, 0, -520)) continue; const by = PY, bxx = PX;
      if (!P(tx, 430, -520)) continue;
      const gg = g.createLinearGradient(bxx, by, PX, PY);
      gg.addColorStop(0, `rgba(210,250,255,${0.55 * dream})`); gg.addColorStop(0.6, `rgba(170,235,255,${0.14 * dream})`); gg.addColorStop(1, 'rgba(160,230,255,0)');
      g.fillStyle = gg; g.beginPath();
      quad(g, ox - 2, 0, -520, ox + 2, 0, -520, tx + 18, 430, -520, tx - 18, 430, -520); g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  // far skyline silhouettes
  for (const b of S.hood.far) {
    if ((b.z - C.z) * C.fz < 0) continue;
    const fc = mix([40, 34, 66], b.side > 0 ? SKY_W[0] : SKY_E[0], 0.55);
    g.fillStyle = rgba(fc, 0.62); g.beginPath();
    if (!quad(g, b.x, 0, b.z, b.x + b.w, 0, b.z, b.x + b.w, b.h, b.z, b.x, b.h, b.z)) continue; g.fill();
    g.fillStyle = 'rgba(255,200,120,.55)';
    for (const [u, v] of b.dots) if (P(b.x + u, v, b.z)) g.fillRect(PX, PY, 1.3, 1.3);
  }
}

function drawGround(g, S, t, lamp) {
  const { H } = S, hy = horizonY();
  const gr = g.createLinearGradient(0, Math.max(0, hy), 0, H);
  gr.addColorStop(0, rgba(mix([60, 50, 90], FOG_H, 0.6))); gr.addColorStop(0.3, 'rgb(36,32,50)'); gr.addColorStop(1, 'rgb(18,16,28)');
  g.fillStyle = gr; g.beginPath(); quad(g, -400, 0, -400, 400, 0, -400, 400, 0, 400, -400, 0, 400); g.fill();
  // sidewalk curbs along the blocks
  g.fillStyle = 'rgba(70,64,84,.9)'; g.beginPath(); quad(g, -12, 0.02, 30, 12, 0.02, 30, 12, 0.02, 32.5, -12, 0.02, 32.5); quad(g, -12, 0.02, -22, 12, 0.02, -22, 12, 0.02, -19.5, -12, 0.02, -19.5); g.fill();
  if (!S.courtPat) { S.courtImg = courtTexture(); S.courtPat = g.createPattern(S.courtImg, 'no-repeat'); }
  g.fillStyle = 'rgb(44,46,59)'; g.beginPath(); quad(g, -9, 0, 1.5, 9, 0, 1.5, 9, 0, 26.5, -9, 0, 26.5); g.fill();
  g.fillStyle = 'rgb(45,104,98)'; g.beginPath(); quad(g, -7.6, 0, 3, 7.6, 0, 3, 7.6, 0, 25, -7.6, 0, 25); g.fill();
  const pat = S.courtPat, NXc = 4, NZc = 8; g.fillStyle = pat;
  for (let i = 0; i < NXc; i++) for (let j = 0; j < NZc; j++) {
    const x0 = -9 + i * 18 / NXc, x1 = x0 + 18 / NXc, z0 = 1.5 + j * 25 / NZc, z1 = z0 + 25 / NZc;
    if (!P(x0, 0, z0)) continue; const ax = PX, ay = PY; if (!P(x1, 0, z0)) continue; const bx = PX, by = PY; if (!P(x0, 0, z1)) continue;
    if (!P(x1, 0, z1)) continue;
    P(x0, 0, z1); patAffine(pat, ax, ay, bx, by, PX, PY, (x1 - x0) * 20, (z1 - z0) * 20, (x0 + 9) * 20, (z0 - 1.5) * 20);
    g.beginPath(); quad(g, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); g.fill();
  }
  // dusk light falloff on the court (darker far from the lamp)
  if (lamp > 0.02) {
    g.globalCompositeOperation = 'lighter';
    groundSprite(g, S.dpr, S.spr.pool, LAMP.hx, 0.02, LAMP.z, 8, 8, 0.6 * lamp);
    g.globalCompositeOperation = 'source-over';
  }
}

function drawBlock(g, S, b, t) {
  const d = dist3(b.cx, b.h * 0.4, b.cz), fog = fogH(d), wfog = fog * 0.55;
  const glows = [];
  for (const f of b.faces) {
    const vx = C.x - f.o[0], vz = C.z - f.o[1];
    if (vx * f.n[0] + vz * f.n[1] <= 0) continue;
    const x0 = f.o[0], z0 = f.o[1], ux = f.u[0], uz = f.u[1], nx = f.n[0], nz = f.n[1];
    const X = (u, o = 0) => x0 + ux * u + nx * o, Z = (u, o = 0) => z0 + uz * u + nz * o;
    const lit = f.sun;
    let col = b.c.map((v) => v * (0.3 + 0.42 * lit)); col = mix(col, [255, 130, 92], 0.22 * lit); col = mix(col, [58, 64, 124], 0.32 * (1 - lit));
    const fc = mix(col, FOG_H, fog);
    g.beginPath(); if (!quad(g, X(0), 0, Z(0), X(f.len), 0, Z(f.len), X(f.len), b.h, Z(f.len), X(0), b.h, Z(0))) continue;
    let fill = rgba(fc);
    if (P(X(f.len / 2), b.h, Z(f.len / 2))) {
      const ty = PY;
      if (P(X(f.len / 2), 0, Z(f.len / 2))) { const gr = g.createLinearGradient(0, ty, 0, PY); gr.addColorStop(0, rgba(fc, 1.14)); gr.addColorStop(1, rgba(fc, 0.72)); fill = gr; }
    }
    g.fillStyle = fill; g.fill();
    if (lit > 0.1) { g.strokeStyle = rgba(mix([255, 176, 120], FOG_H, fog), 0.5 * lit); g.lineWidth = 1.2; g.beginPath(); seg(g, X(0), b.h, Z(0), X(f.len), b.h, Z(f.len)); g.stroke(); }
    if (b.pil) {
      g.fillStyle = rgba(mix([18, 16, 28], FOG_H, fog * 0.8)); g.beginPath();
      quad(g, X(0.4), 0, Z(0.4), X(f.len - 0.4), 0, Z(f.len - 0.4), X(f.len - 0.4), b.pil, Z(f.len - 0.4), X(0.4), b.pil, Z(0.4)); g.fill();
      g.fillStyle = rgba(fc, 0.95); g.beginPath();
      for (let u = 0.4; u < f.len; u += 3.6) quad(g, X(u), 0, Z(u), X(u + 0.45), 0, Z(u + 0.45), X(u + 0.45), b.pil, Z(u + 0.45), X(u), b.pil, Z(u));
      g.fill();
    }
    const dark = new Path2D(), litP = [new Path2D(), new Path2D()], tvP = new Path2D(), shut = new Path2D();
    for (const w of f.win) {
      const u0 = w.u - w.w / 2, u1 = w.u + w.w / 2, y0 = w.y, y1 = w.y + w.h;
      const p = !w.lit ? dark : (w.tv ? tvP : litP[w.col[1] > 200 ? 1 : 0]);
      quad(p, X(u0, 0.03), y0, Z(u0, 0.03), X(u1, 0.03), y0, Z(u1, 0.03), X(u1, 0.03), y1, Z(u1, 0.03), X(u0, 0.03), y1, Z(u0, 0.03));
      if (w.lit) {
        const ys = y1 - w.h * w.sh;
        quad(shut, X(u0, 0.04), ys, Z(u0, 0.04), X(u1, 0.04), ys, Z(u1, 0.04), X(u1, 0.04), y1, Z(u1, 0.04), X(u0, 0.04), y1, Z(u0, 0.04));
        if (P(X(w.u, 0.1), y0 + w.h * 0.4, Z(w.u, 0.1)) && w.w * PS > 2.5) glows.push(PX, PY, w.w * PS * 1.25, w.tv ? 1 : (w.col[1] > 200 ? 2 : 0), w.tv ? 0.6 + 0.4 * Math.sin(t * 9 + w.ph) : 1);
      }
    }
    g.fillStyle = rgba(mix(mix(fc, [30, 36, 70], 0.45), [255, 150, 110], 0.12 * lit), 0.95); g.fill(dark);
    g.fillStyle = rgba(mix([255, 186, 100], FOG_H, wfog)); g.fill(litP[0]);
    g.fillStyle = rgba(mix([255, 222, 158], FOG_H, wfog)); g.fill(litP[1]);
    g.fillStyle = rgba(mix([150, 186, 255], FOG_H, wfog), 0.65 + 0.35 * Math.sin(t * 11)); g.fill(tvP);
    g.fillStyle = rgba(mix([92, 58, 40], FOG_H, wfog), 0.7); g.fill(shut);
    if (f.balc) {
      const pc = rgba(mix(fc, [255, 190, 150], 0.12 * lit), 1), top = rgba(mix([255, 196, 150], FOG_H, fog), 0.35 + 0.4 * lit);
      g.fillStyle = pc; const bp = new Path2D(), tp = new Path2D();
      for (let fl = 0; fl < b.fl; fl++) {
        const y = b.base + fl * b.fh - 0.05;
        quad(bp, X(0.3, 0.95), y, Z(0.3, 0.95), X(f.len - 0.3, 0.95), y, Z(f.len - 0.3, 0.95), X(f.len - 0.3, 0.95), y + 1.05, Z(f.len - 0.3, 0.95), X(0.3, 0.95), y + 1.05, Z(0.3, 0.95));
        if (P(X(0.3, 0.95), y + 1.05, Z(0.3, 0.95))) { tp.moveTo(PX, PY); if (P(X(f.len - 0.3, 0.95), y + 1.05, Z(f.len - 0.3, 0.95))) tp.lineTo(PX, PY); }
      }
      g.fill(bp); g.strokeStyle = top; g.lineWidth = 1; g.stroke(tp);
      const lines = new Path2D();
      for (const c of S.hood.clothes) {
        if (c.f !== f) continue;
        const sw = Math.sin(t * 1.8 + c.ph) * 0.07, o = 1.1;
        const ua = c.u - c.w / 2, ub = c.u + c.w / 2;
        g.fillStyle = rgba(mix(c.c.map((v) => v * (0.42 + 0.45 * lit)), FOG_H, fog)); g.beginPath();
        quad(g, X(ua, o), c.y, Z(ua, o), X(ub, o), c.y, Z(ub, o), X(ub + sw, o + sw), c.y - c.h, Z(ub + sw, o + sw), X(ua + sw, o + sw), c.y - c.h, Z(ua + sw, o + sw));
        g.fill();
        if (P(X(ua - 0.15, o), c.y, Z(ua - 0.15, o))) { lines.moveTo(PX, PY); if (P(X(ub + 0.15, o), c.y, Z(ub + 0.15, o))) lines.lineTo(PX, PY); }
      }
      g.strokeStyle = rgba(mix([40, 34, 50], FOG_H, fog), 0.8); g.lineWidth = 0.8; g.stroke(lines);
    }
  }
  if (b.heaters.length) {
    const sc = rgba(mix([34, 28, 50], FOG_H, fog * 0.85)), hp = new Path2D(), ap = new Path2D();
    for (const h of b.heaters) {
      const y = b.h;
      quad(hp, h.x - 0.8, y + 0.45, h.z, h.x + 0.8, y + 0.45, h.z, h.x + 0.8, y + 1.1, h.z, h.x - 0.8, y + 1.1, h.z);
      quad(hp, h.x - 0.9, y + 0.05, h.z - 1.2, h.x + 0.9, y + 0.05, h.z - 1.2, h.x + 0.9, y + 0.95, h.z - 0.1, h.x - 0.9, y + 0.95, h.z - 0.1);
      quad(hp, h.x - 0.75, y, h.z, h.x - 0.65, y, h.z, h.x - 0.65, y + 0.5, h.z, h.x - 0.75, y + 0.5, h.z);
      quad(hp, h.x + 0.65, y, h.z, h.x + 0.75, y, h.z, h.x + 0.75, y + 0.5, h.z, h.x + 0.65, y + 0.5, h.z);
      if (h.ant) { seg(ap, h.x + 1.4, y, h.z, h.x + 1.4, y + 3.2, h.z); seg(ap, h.x + 0.7, y + 2.6, h.z, h.x + 2.1, y + 2.6, h.z); seg(ap, h.x + 0.9, y + 3.0, h.z, h.x + 1.9, y + 3.0, h.z); }
    }
    g.fillStyle = sc; g.fill(hp); g.strokeStyle = sc; g.lineWidth = 1; g.stroke(ap);
  }
  if (glows.length) {
    g.globalCompositeOperation = 'lighter';
    const spr = [S.spr.winWarm, S.spr.winTv, S.spr.winPale];
    for (let i = 0; i < glows.length; i += 5) sprite(g, spr[glows[i + 3]], glows[i], glows[i + 1], glows[i + 2], 0.32 * (1 - fog) * glows[i + 4]);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}

function drawPalm(g, p, t) {
  const d = dist3(p.x, p.h / 2, p.z), fog = fogH(d), col = rgba(mix([22, 16, 34], FOG_H, fog * 0.8));
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const tx = p.x + p.lean * p.h, top = p.h;
  g.beginPath(); let w = seg(g, p.x, 0, p.z, p.x + p.lean * p.h * 0.45, p.h * 0.55, p.z); if (!w) return; g.lineWidth = Math.max(1, 0.38 * w); g.stroke();
  g.beginPath(); w = seg(g, p.x + p.lean * p.h * 0.45, p.h * 0.55, p.z, tx, top, p.z); g.lineWidth = Math.max(1, 0.28 * w); g.stroke();
  const fr = new Path2D();
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU + 0.3 + Math.sin(t * 0.9 + i) * 0.04, L = 3.1 + (i % 3) * 0.55, droop = 1.45 + (i % 4) * 0.3;
    const up = [], dn = [];
    for (let k = 0; k <= 8; k++) {
      const s = k / 8, x = tx + Math.cos(a) * s * L, z = p.z + Math.sin(a) * s * L, y = top + (0.8 * s - droop * s * s) * L * 0.5;
      if (!P(x, y, z)) break;
      const wd = Math.sin(Math.PI * Math.pow(s, 0.75)) * 0.42 * PS;
      up.push([PX, PY - wd * 0.25]); dn.push([PX + wd * 0.15, PY + wd * 1.05]);
    }
    if (up.length < 3) continue;
    fr.moveTo(up[0][0], up[0][1]);
    for (let k = 1; k < up.length; k++) fr.lineTo(up[k][0], up[k][1]);
    for (let k = dn.length - 1; k >= 0; k--) {
      // serrated lower edge: leaflets hanging down
      const q = dn[k], j = k % 2 ? 0.55 : 1; fr.lineTo(lerp(up[k][0], q[0], j), lerp(up[k][1], q[1], j));
    }
    fr.closePath();
  }
  g.fill(fr);
  // dates cluster / crown
  if (P(tx, top - 0.15, p.z)) { g.beginPath(); g.arc(PX, PY, Math.max(1.5, 0.35 * PS), 0, TAU); g.fill(); }
}

function catenary(g, a, b, sag, n = 14) {
  let on = false;
  for (let i = 0; i <= n; i++) {
    const s = i / n, x = lerp(a[0], b[0], s), y = lerp(a[1], b[1], s) - sag * 4 * s * (1 - s), z = lerp(a[2], b[2], s);
    if (!P(x, y, z)) { on = false; continue; } if (!on) { g.moveTo(PX, PY); on = true; } else g.lineTo(PX, PY);
  }
}

function drawStreetBits(g, S, t, lamp) {
  const H = S.hood;
  g.strokeStyle = 'rgba(20,16,30,.95)'; g.lineCap = 'round';
  for (const [x, z, h] of H.poles) {
    g.beginPath(); const w = seg(g, x, 0, z, x, h, z); if (w) { g.lineWidth = Math.max(1, 0.24 * w); g.stroke(); }
    g.beginPath(); const w2 = seg(g, x - 1.1, h - 0.5, z, x + 1.1, h - 0.5, z); if (w2) { g.lineWidth = Math.max(1, 0.12 * w2); g.stroke(); }
  }
  g.lineWidth = 1; g.strokeStyle = 'rgba(16,12,24,.85)'; g.beginPath();
  for (const [x1, y1, z1, x2, y2, z2, sg] of H.wires) catenary(g, [x1, y1, z1], [x2, y2, z2], sg);
  g.stroke();
  const cr = H.cross; g.beginPath(); catenary(g, cr.a, cr.b, cr.sag); g.strokeStyle = 'rgba(30,24,40,.9)'; g.stroke();
  for (const it of cr.items) {
    const s = it.s, x = lerp(cr.a[0], cr.b[0], s), y = lerp(cr.a[1], cr.b[1], s) - cr.sag * 4 * s * (1 - s), z = lerp(cr.a[2], cr.b[2], s);
    const dx = (cr.b[0] - cr.a[0]), dz = (cr.b[2] - cr.a[2]), l = Math.hypot(dx, dz), hx = dx / l * it.w / 2, hz = dz / l * it.w / 2, sw = Math.sin(t * 2 + it.ph) * 0.1;
    g.fillStyle = rgba(mix(it.c.map((v) => v * 0.62), FOG_H, fogH(dist3(x, y, z)))); g.beginPath();
    quad(g, x - hx, y, z - hz, x + hx, y, z + hz, x + hx + sw, y - it.h, z + hz + sw, x - hx + sw, y - it.h, z - hz + sw); g.fill();
  }
  // futsal goal with a net at the far end of the court
  g.strokeStyle = `rgba(220,214,206,${0.55 + 0.3 * lamp})`;
  const gz = 25, gw = 1.55;
  g.beginPath(); let w = seg(g, -gw, 0, gz, -gw, 2, gz); seg(g, gw, 0, gz, gw, 2, gz); seg(g, -gw, 2, gz, gw, 2, gz);
  if (w) { g.lineWidth = Math.max(1, 0.08 * w); g.stroke(); }
  if (!S.netPat) S.netPat = g.createPattern(H.netImg, 'repeat');
  if (S.netPat && P(-gw, 2, gz)) {
    const ax = PX, ay = PY;
    if (P(gw, 2, gz)) {
      const bx = PX, by = PY;
      if (P(-gw, 0, gz + 1)) {
        patAffine(S.netPat, ax, ay, bx, by, PX, PY, 16 * 2 * gw / 0.12, 16 * 2.2 / 0.12);
        g.fillStyle = S.netPat; g.globalAlpha = 0.5; g.beginPath(); quad(g, -gw, 2, gz, gw, 2, gz, gw, 0, gz + 1, -gw, 0, gz + 1); g.fill(); g.globalAlpha = 1;
      }
    }
  }
  // chain-link fence on three sides
  if (!S.linkPat) S.linkPat = g.createPattern(H.linkImg, 'repeat');
  const fenceSeg = (x1, z1, x2, z2) => {
    const L = Math.hypot(x2 - x1, z2 - z1);
    if (!P(x1, 3.4, z1)) return; const ax = PX, ay = PY; if (!P(x2, 3.4, z2)) return; const bx = PX, by = PY; if (!P(x1, 0, z1)) return;
    patAffine(S.linkPat, ax, ay, bx, by, PX, PY, 24 * L / 0.2, 24 * 3.4 / 0.2);
    g.fillStyle = S.linkPat; g.beginPath(); quad(g, x1, 3.4, z1, x2, 3.4, z2, x2, 0, z2, x1, 0, z1); g.fill();
  };
  g.globalAlpha = 0.5 + 0.25 * lamp;
  for (let z = 1.5; z < 26.4; z += 3.125) { fenceSeg(-9, z, -9, z + 3.125); fenceSeg(9, z, 9, z + 3.125); }
  for (let x = -9; x < 9; x += 3) fenceSeg(x, 26.5, x + 3, 26.5);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(30,30,44,.95)'; g.beginPath();
  for (let z = 1.5; z <= 26.6; z += 3.125) { seg(g, -9, 0, z, -9, 3.5, z); seg(g, 9, 0, z, 9, 3.5, z); }
  for (let x = -9; x <= 9; x += 3) seg(g, x, 0, 26.5, x, 3.5, 26.5);
  seg(g, -9, 3.4, 1.5, -9, 3.4, 26.5); seg(g, 9, 3.4, 1.5, 9, 3.4, 26.5); seg(g, -9, 3.4, 26.5, 9, 3.4, 26.5);
  g.lineWidth = 1.4; g.stroke();
  // street lamp
  g.strokeStyle = 'rgba(26,24,36,1)'; g.beginPath(); w = seg(g, LAMP.x, 0, LAMP.z, LAMP.x, LAMP.h, LAMP.z);
  if (w) { g.lineWidth = Math.max(1, 0.15 * w); g.stroke(); g.beginPath(); seg(g, LAMP.x, LAMP.h, LAMP.z, LAMP.hx, LAMP.h + 0.1, LAMP.z); g.lineWidth = Math.max(1, 0.09 * w); g.stroke(); }
  g.fillStyle = 'rgba(40,36,48,1)'; g.beginPath();
  quad(g, LAMP.hx - 0.35, LAMP.h + 0.12, LAMP.z, LAMP.hx + 0.35, LAMP.h + 0.12, LAMP.z, LAMP.hx + 0.25, LAMP.h - 0.08, LAMP.z, LAMP.hx - 0.25, LAMP.h - 0.08, LAMP.z); g.fill();
}

function drawLampLight(g, S, lamp) {
  if (lamp < 0.02 || !P(LAMP.hx, LAMP.h - 0.12, LAMP.z)) return;
  const hx = PX, hy = PY, hs = PS;
  g.globalCompositeOperation = 'lighter';
  if (P(LAMP.hx - 3.8, 0, LAMP.z)) {
    const lx = PX, ly = PY;
    if (P(LAMP.hx + 3.8, 0, LAMP.z)) {
      const gr = g.createLinearGradient(hx, hy, hx, Math.max(ly, PY));
      gr.addColorStop(0, `rgba(255,196,120,${0.22 * lamp})`); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(hx - 0.25 * hs, hy); g.lineTo(hx + 0.25 * hs, hy); g.lineTo(PX, PY); g.lineTo(lx, ly); g.closePath(); g.fill();
    }
  }
  sprite(g, S.spr.lamp, hx, hy, Math.max(20, 2.8 * hs), 0.9 * lamp);
  sprite(g, S.spr.lamp, hx, hy, Math.max(40, 7 * hs), 0.25 * lamp);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ------------------------------------------------------------------ ground decals */
/** Radial sprite lying on the ground, centre (x,z), world axis vectors (ux,uz) and (vx,vz). */
function groundDecal(g, dpr, img, x, z, ux, uz, vx, vz, alpha) {
  if (!P(x, 0.01, z)) return; const cx = PX, cy = PY;
  if (!P(x + ux, 0.01, z + uz)) return; const ax = PX - cx, ay = PY - cy;
  if (!P(x + vx, 0.01, z + vz)) return; const bx = PX - cx, by = PY - cy;
  g.globalAlpha = alpha; g.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * cx, dpr * cy);
  g.drawImage(img, -1, -1, 2, 2); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1;
}

/* ------------------------------------------------------------------ the kid (3D rig, rim-lit) */
const KID = { x: 0, z: 9 };
const KC = { shirt: [238, 232, 220], shorts: [24, 38, 74], sock: [232, 232, 236], shoe: [26, 26, 32], skin: [200, 140, 98], hair: [30, 20, 14], num: [22, 44, 98] };
const BR = 0.11; // ball radius (m)

function legFK(hip, L, sgn) {
  const { a, k, b, fp } = L, sb = Math.sin(b) * sgn, cb = Math.cos(b);
  const knee = [hip[0] + 0.41 * sb, hip[1] - 0.41 * Math.cos(a) * cb, hip[2] - 0.41 * Math.sin(a) * cb];
  const a2 = a - k;
  const ank = [knee[0] + 0.39 * sb * 0.5, knee[1] - 0.39 * Math.cos(a2), knee[2] - 0.39 * Math.sin(a2)];
  const fa = a2 + Math.PI / 2 - fp;
  const toe = [ank[0], ank[1] - 0.17 * Math.cos(fa), ank[2] - 0.17 * Math.sin(fa)];
  return { hip, knee, ank, toe };
}
function armFK(sh, A, sgn) {
  const { ab, fw, el } = A, sa = Math.sin(ab) * sgn, ca = Math.cos(ab);
  const elb = [sh[0] + 0.235 * sa, sh[1] - 0.235 * ca * Math.cos(fw), sh[2] - 0.235 * ca * Math.sin(fw)];
  const ab2 = ab * 0.85, fw2 = fw + el;
  const hand = [elb[0] + 0.215 * Math.sin(ab2) * sgn, elb[1] - 0.215 * Math.cos(ab2) * Math.cos(fw2), elb[2] - 0.215 * Math.cos(ab2) * Math.sin(fw2)];
  return { sh, elb, hand };
}
const pose0 = () => ({ py: 0.8, lean: 0.04, side: 0, hp: -0.1, hy: 0,
  R: { a: 0.03, k: 0.12, b: 0.05, fp: 0 }, L: { a: 0.02, k: 0.1, b: 0.05, fp: 0 },
  aR: { ab: 0.28, fw: 0.08, el: 0.4 }, aL: { ab: 0.28, fw: 0.08, el: 0.4 } });
function blendLeg(o, k, w) { o.a = lerp(o.a, k.a, w); o.k = lerp(o.k, k.k, w); o.fp = lerp(o.fp, k.fp ?? o.fp, w); if (k.b !== undefined) o.b = lerp(o.b, k.b, w); }
function blendArm(o, k, w) { o.ab = lerp(o.ab, k.ab, w); o.fw = lerp(o.fw, k.fw, w); o.el = lerp(o.el, k.el, w); }

// ball contact points of the juggling sequence (world)
const BP = { R: [-0.1, 0.33, 8.78], L: [0.1, 0.33, 8.78], T: [-0.09, 0.97, 8.72], G: [-0.12, BR, 8.6], V: [-0.09, 0.46, 8.25], F: [-0.1, BR, 8.84] };
const ARCS = [[-0.55, 'L', 0, 'R', 0.72], [0, 'R', 0.55, 'L', 0.72], [0.55, 'L', 1.1, 'T', 0.55], [1.1, 'T', 1.46, 'G', 0.2], [3.22, 'F', 3.55, 'V', 0.5]];
const KICK_FOOT = { a: 0.78, k: 1.12, fp: 0.35 }, KICK_THIGH = { a: 1.45, k: 1.65, fp: 0.5 }, TRAP = { a: 0.92, k: 0.86, fp: -0.25 };

/** Pose + ball state of the kid at time t (pure function of t). */
function kidAt(t) {
  const p = pose0();
  const ball = { x: BP.G[0], y: BP.G[1], z: BP.G[2], sq: 0, sa: 0, spin: t * 6, fly: 0 };
  // ---- ball path
  let inArc = false;
  for (const [t0, a, t1, b, h] of ARCS) {
    if (t >= t0 && t < t1) {
      const u = (t - t0) / (t1 - t0), A = BP[a], B = BP[b];
      ball.x = lerp(A[0], B[0], u); ball.z = lerp(A[2], B[2], u); ball.y = lerp(A[1], B[1], u) + 4 * h * u * (1 - u);
      const vy = (B[1] - A[1]) + 4 * h * (1 - 2 * u); ball.sq = -0.07 * Math.min(1, Math.abs(vy) / 2); ball.sa = Math.PI / 2;
      inArc = true;
    }
  }
  for (const tc of [0, 0.55, 1.1, 1.46, 3.22, 3.55]) { const w = bump(t, tc, 0.028); if (w > 0.05) { ball.sq = 0.2 * w; ball.sa = Math.PI / 2; } }
  if (!inArc) {
    if (t >= 1.46 && t < 3.0) { const u = sm(prog(t, 1.46, 1.62)); ball.x = lerp(BP.G[0], -0.11, u); ball.z = lerp(BP.G[2], 8.58, u); ball.y = BR; ball.spin = 1.46 * 6 + u * 1.2; }
    else if (t >= 3.0 && t < 3.22) { const u = sm(prog(t, 3.0, 3.2)); ball.x = lerp(-0.11, BP.F[0], u); ball.z = lerp(8.58, BP.F[2], u); ball.y = BR; ball.spin = 10 - u * 3; }
    else if (t >= 3.55) ball.fly = 1;
  }
  // ---- legs / body
  const R = p.R, L = p.L;
  if (t < 1.5) {
    blendLeg(L, KICK_FOOT, Math.max(bump(t, -0.55, 0.13), bump(t, 0.55, 0.13)));
    blendLeg(R, KICK_FOOT, bump(t, 0, 0.13));
    blendLeg(R, KICK_THIGH, bump(t, 1.1, 0.14));
    const bal = Math.sin(t * 5.7);
    blendArm(p.aR, { ab: 0.62 + 0.18 * bal, fw: 0.25, el: 0.75 }, 1); blendArm(p.aL, { ab: 0.6 - 0.18 * bal, fw: 0.25, el: 0.75 }, 1);
    p.py = 0.79 - 0.015 * Math.abs(Math.sin(t * 5.7)); p.lean = 0.1; p.side = 0.03 * Math.sin(t * 5.7);
    p.hp = clamp(Math.atan2(ball.y - 1.36, 0.5) * 0.75, -0.7, 0.3);
  }
  if (t >= 1.36 && t < 3.0) { blendLeg(R, TRAP, sm(prog(t, 1.36, 1.6))); }
  if (t >= 1.5 && t < 3.0) {
    const breath = Math.sin(t * 3.2) * 0.008;
    const up = eIO(prog(t, 1.85, 2.45)), back = sm(prog(t, 2.72, 3.0));
    p.hp = lerp(lerp(-0.45, 0.7, up), 0.1, back); p.hy = lerp(0, 0.2, up) * (1 - back);
    p.py = 0.8 + breath; p.lean = lerp(0.1, -0.04, up);
    blendArm(p.aR, { ab: 0.14, fw: 0.05, el: 0.3 }, sm(prog(t, 1.5, 1.8))); blendArm(p.aL, { ab: 0.14, fw: 0.05, el: 0.3 }, sm(prog(t, 1.5, 1.8)));
  }
  if (t >= 3.0) {
    // drag back -> flick -> wind up -> volley -> follow-through
    const kR = { a: 0.92, k: 0.86, fp: -0.25 };
    const k1 = { a: 0.3, k: 0.55, fp: 0.2 }, k2 = { a: 0.12, k: 0.2, fp: 0.9 }, k3 = { a: -0.62, k: 1.45, fp: 0.6 }, k4 = { a: 1.05, k: 0.12, fp: 0.9 }, k5 = { a: 1.5, k: 0.3, fp: 0.6 }, k6 = { a: 0.55, k: 0.4, fp: 0.2 };
    const seq = [[3.0, kR], [3.18, k1], [3.24, k2], [3.42, k3], [3.55, k4], [3.75, k5], [4.2, k6]];
    for (let i = 0; i < seq.length - 1; i++) {
      const [ta, A] = seq[i], [tb, B] = seq[i + 1];
      if (t >= ta && t < tb) { const u = (i === 3) ? eIn(prog(t, ta, tb)) : sm(prog(t, ta, tb)); R.a = lerp(A.a, B.a, u); R.k = lerp(A.k, B.k, u); R.fp = lerp(A.fp, B.fp, u); }
    }
    if (t >= 4.2) Object.assign(R, k6);
    const wind = sm(prog(t, 3.24, 3.42)), strike = sm(prog(t, 3.48, 3.75));
    L.k = lerp(0.12, 0.38, Math.max(wind, strike)); L.a = -0.05;
    p.lean = lerp(0.12, -0.05, wind) - 0.2 * strike; p.side = 0.06 * strike; p.py = 0.8 - 0.05 * Math.max(wind, strike * 0.6);
    blendArm(p.aR, { ab: 1.05, fw: -0.35, el: 0.5 }, Math.max(wind, strike)); blendArm(p.aL, { ab: 1.25, fw: 0.55, el: 0.55 }, Math.max(wind, strike));
    p.hp = t < 3.55 ? clamp(Math.atan2(ball.y - 1.36, 0.6) * 0.8, -0.7, 0.2) : lerp(-0.35, 0.05, sm(prog(t, 3.6, 3.9)));
  }
  return { p, ball };
}

function kidDraw(g, S, t, p, view) {
  // view: { front, light, tint, rim, rimA, gender }
  const kx = KID.x, kz = KID.z;
  const pel = [kx + p.side * 0.06, p.py, kz];
  const neck = [pel[0] + Math.sin(p.side) * 0.42, pel[1] + Math.cos(p.lean) * 0.42, pel[2] - Math.sin(p.lean) * 0.42];
  const legR = legFK([pel[0] - 0.085, pel[1] - 0.02, pel[2]], p.R, -1), legL = legFK([pel[0] + 0.085, pel[1] - 0.02, pel[2]], p.L, 1);
  const armR = armFK([neck[0] - 0.165, neck[1] - 0.05, neck[2]], p.aR, -1), armL = armFK([neck[0] + 0.165, neck[1] - 0.05, neck[2]], p.aL, 1);
  const hc = [neck[0] + Math.sin(p.hy) * 0.012, neck[1] + 0.135 - 0.035 * Math.max(0, p.hp), neck[2] - Math.sin(p.lean) * 0.1 + 0.075 * p.hp];
  const Wp = { pel, neck, hc, hR: legR.hip, kR: legR.knee, aR: legR.ank, tR: legR.toe, hL: legL.hip, kL: legL.knee, aL: legL.ank, tL: legL.toe,
    sR: armR.sh, eR: armR.elb, wR: armR.hand, sL: armL.sh, eL: armL.elb, wL: armL.hand };
  const pr = (q) => (P(q[0], q[1], q[2]) ? [PX, PY, PS, PZ] : null);
  const J = {};
  for (const k in Wp) { J[k] = pr(Wp[k]); if (!J[k]) return; }
  // depth key: how far toward the camera (horizontal), relative to the kid
  let dcx = C.x - kx, dcz = C.z - kz; const dl = Math.hypot(dcx, dcz) || 1; dcx /= dl; dcz /= dl;
  const key = (q) => (q[0] - kx) * dcx + (q[2] - kz) * dcz;
  // vertical light falloff (kid lit from above by the lamp / sunset, legs a bit darker)
  const lit = (c, k = 1) => [c[0] * view.light * view.tint[0] * k, c[1] * view.light * view.tint[1] * k, c[2] * view.light * view.tint[2] * k];
  const rim = view.rim, ro = Math.max(1, J.hc[2] * 0.011);
  const rox = view.front ? -ro : ro, roy = -ro * 0.8;
  const line = (a, b, w, col, pass) => {
    const ws = w * (a[2] + b[2]) * 0.5;
    if (pass === 0) { g.strokeStyle = rgba(rim, 1, view.rimA); g.lineWidth = ws; g.beginPath(); g.moveTo(a[0] + rox, a[1] + roy); g.lineTo(b[0] + rox, b[1] + roy); g.stroke(); return; }
    g.strokeStyle = rgba(col); g.lineWidth = ws; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    if (ws > 4) { // core shadow on the far side -> rounder limbs
      g.strokeStyle = rgba(col, 0.7, 0.3); g.lineWidth = ws * 0.36; const sx = -rox * ws * 0.08, sy = -roy * ws * 0.08;
      g.beginPath(); g.moveTo(a[0] + sx, a[1] + sy); g.lineTo(b[0] + sx, b[1] + sy); g.stroke();
    }
  };
  const mid = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
  const groups = [];
  const leg = (s) => ({ k: (key(Wp['k' + s]) + key(Wp['a' + s])) / 2 - 0.08, draw(pass) {
    const h = J['h' + s], k = J['k' + s], a = J['a' + s], tt = J['t' + s];
    line(h, k, 0.125, lit(KC.skin, 0.92), pass); line(k, mid(k, a, 0.4), 0.098, lit(KC.skin, 0.88), pass);
    line(mid(k, a, 0.34), a, 0.098, lit(KC.sock, 0.86), pass); line(a, tt, 0.088, lit(KC.shoe), pass);
    line(h, mid(h, k, 0.46), 0.165, lit(KC.shorts), pass);
    if (pass === 1 && tt[2] > 60) { g.strokeStyle = rgba([244, 195, 90], view.light, 0.9); g.lineWidth = 0.014 * tt[2]; g.beginPath(); g.moveTo(lerp(a[0], tt[0], 0.2), lerp(a[1], tt[1], 0.2)); g.lineTo(lerp(a[0], tt[0], 0.85), lerp(a[1], tt[1], 0.85)); g.stroke(); }
  } });
  const arm = (s) => ({ k: (key(Wp['e' + s]) + key(Wp['w' + s])) / 2 + 0.02, draw(pass) {
    const sh = J['s' + s], e = J['e' + s], w = J['w' + s];
    line(e, w, 0.064, lit(KC.skin), pass); line(mid(sh, e, 0.45), e, 0.072, lit(KC.skin), pass);
    line(sh, mid(sh, e, 0.55), 0.115, lit(KC.shirt, 0.95), pass);
    if (pass === 1) { g.fillStyle = rgba(lit(KC.skin)); g.beginPath(); g.arc(w[0], w[1], 0.043 * w[2], 0, TAU); g.fill(); }
  } });
  groups.push(leg('R'), leg('L'), arm('R'), arm('L'));
  const tq = (dx, dy, base) => pr([base[0] + dx, base[1] + dy, base[2]]);
  const sR = tq(-0.185, -0.035, neck), sL = tq(0.185, -0.035, neck), wL = tq(0.145, 0.1, pel), wR = tq(-0.145, 0.1, pel), cR = tq(-0.155, -0.005, pel), cL = tq(0.155, -0.005, pel);
  if (!sR || !sL || !wL || !wR || !cR || !cL) return;
  groups.push({ k: 0, draw(pass) {
    const ox = pass ? 0 : rox, oy = pass ? 0 : roy, ps = J.pel[2];
    g.beginPath(); g.moveTo(sR[0] + ox, sR[1] + oy); g.lineTo(sL[0] + ox, sL[1] + oy); g.lineTo(wL[0] + ox, wL[1] + oy); g.lineTo(cL[0] + ox, cL[1] + oy); g.lineTo(cR[0] + ox, cR[1] + oy); g.lineTo(wR[0] + ox, wR[1] + oy); g.closePath();
    if (pass === 0) { g.fillStyle = rgba(rim, 1, view.rimA); g.fill(); return; }
    const sc = lit(KC.shirt), gr = g.createLinearGradient(sR[0], sR[1], sL[0], cL[1]);
    const lo = view.front ? 0 : 1;
    gr.addColorStop(lo, rgba(sc, 1.08)); gr.addColorStop(0.55, rgba(sc, 0.86)); gr.addColorStop(1 - lo, rgba(sc, 0.58));
    g.fillStyle = gr; g.fill();
    // fold shading along the side seams
    g.strokeStyle = rgba(sc, 0.55, 0.35); g.lineWidth = 0.035 * ps; g.beginPath();
    g.moveTo(lerp(sL[0], wL[0], 0.15), lerp(sL[1], wL[1], 0.15)); g.lineTo(lerp(wL[0], cL[0], 0.5), lerp(wL[1], cL[1], 0.5)); g.stroke();
    g.fillStyle = rgba(lit(KC.shorts)); g.beginPath(); g.moveTo(cR[0], cR[1] - 0.05 * ps); g.lineTo(cL[0], cL[1] - 0.05 * ps); g.lineTo(J.hL[0] + 0.07 * ps, J.hL[1] + 0.05 * ps); g.lineTo(J.hR[0] - 0.07 * ps, J.hR[1] + 0.05 * ps); g.closePath(); g.fill();
    g.fillStyle = rgba(sc, 0.95); for (const s of [sR, sL]) { g.beginPath(); g.arc(s[0], s[1] + 0.025 * s[2], 0.052 * s[2], 0, TAU); g.fill(); }
    const nb = pr([neck[0], neck[1] - (view.front ? 0.16 : 0.19), neck[2] + (view.front ? -0.07 : 0.07)]);
    if (nb && nb[2] > 30) {
      const fs = (view.front ? 0.11 : 0.2) * nb[2];
      g.font = `900 ${fs.toFixed(1)}px Rubik, Heebo, "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = rgba(lit(KC.num)); g.fillText('10', nb[0], nb[1]);
    }
    line(J.neck, mid(J.neck, J.hc, 0.6), 0.072, lit(KC.skin, 0.8), 1);
  } });
  const hr = 0.112 * J.hc[2];
  groups.push({ k: 1, draw(pass) {
    const [x, y] = J.hc;
    if (pass === 0) { g.fillStyle = rgba(rim, 1, view.rimA); g.beginPath(); g.arc(x + rox, y + roy, hr * 1.05, 0, TAU); g.fill(); return; }
    const skin = lit(KC.skin), hair = lit(KC.hair, 1.5);
    if (view.gender === 'f') {
      const sw = Math.sin(t * 6) * 0.25, side = view.front ? 1 : -1;
      g.strokeStyle = rgba(hair); g.lineWidth = hr * 0.5; g.beginPath(); g.moveTo(x, y - hr * 0.4); g.quadraticCurveTo(x + side * hr * (1.15 + sw), y - hr * 0.1, x + side * hr * (0.55 + sw), y + hr * 1.35); g.stroke();
    }
    if (view.front) {
      g.fillStyle = rgba(hair); g.beginPath(); g.arc(x, y - hr * 0.1, hr * 1.05, 0, TAU); g.fill();
      const fy = y + hr * 0.12 - p.hp * hr * 0.22, fx = x + Math.sin(p.hy) * hr * 0.4;
      const fg = g.createRadialGradient(fx - hr * 0.3, fy - hr * 0.3, hr * 0.1, fx, fy, hr);
      fg.addColorStop(0, rgba(skin, 1.12)); fg.addColorStop(1, rgba(skin, 0.75));
      g.fillStyle = fg; g.beginPath(); g.ellipse(fx, fy, hr * 0.88, hr * 0.9, 0, 0, TAU); g.fill();
      g.fillStyle = rgba(skin, 0.85); g.beginPath(); g.arc(x - hr * 0.95, y + hr * 0.12, hr * 0.19, 0, TAU); g.arc(x + hr * 0.95, y + hr * 0.12, hr * 0.19, 0, TAU); g.fill();
      if (hr > 7) {
        const ey = fy - hr * 0.04 + p.hp * hr * 0.12, focus = t > 2.9 ? 1 : 0;
        g.fillStyle = 'rgba(18,12,10,.92)';
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(fx + s * hr * 0.33, ey, hr * 0.095, hr * 0.12, 0, 0, TAU); g.fill(); }
        g.strokeStyle = rgba(lit(KC.hair, 1.1)); g.lineWidth = Math.max(1, hr * 0.085); g.lineCap = 'round';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(fx + s * hr * 0.16, ey - hr * 0.2 + focus * hr * 0.05); g.lineTo(fx + s * hr * 0.5, ey - hr * 0.27 - focus * hr * 0.02); g.stroke(); }
        g.strokeStyle = rgba(skin, 0.6); g.lineWidth = Math.max(1, hr * 0.05); g.beginPath(); g.moveTo(fx - hr * 0.14, fy + hr * 0.45); g.lineTo(fx + hr * 0.14, fy + hr * 0.45); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.85)';
        for (const s of [-1, 1]) g.fillRect(fx + s * hr * 0.33 - hr * 0.05, ey - hr * 0.07, Math.max(1, hr * 0.055), Math.max(1, hr * 0.055));
      }
    } else {
      g.fillStyle = rgba(skin, 0.8); g.beginPath(); g.arc(x - hr * 0.96, y + hr * 0.1, hr * 0.19, 0, TAU); g.arc(x + hr * 0.96, y + hr * 0.1, hr * 0.19, 0, TAU); g.fill();
      // three-quarter back view: the face profile peeks out on the side the kid is facing
      const fsx = clamp(-C.rz * 1.2 + Math.sin(p.hy) * 0.5, -1, 1), up = Math.max(0, p.hp);
      const sd = Math.sign(fsx) || 1, k2 = clamp(Math.abs(fsx) * 1.8);
      if (k2 > 0.1) {
        const cx = x + sd * hr * 0.8 * k2, cy = y + hr * 0.12 - up * hr * 0.42;
        g.fillStyle = rgba(skin, 1.05); g.beginPath(); g.ellipse(cx, cy, hr * 0.5, hr * 0.66, -sd * (0.25 + up * 0.5), 0, TAU); g.fill();
        g.beginPath(); g.moveTo(cx + sd * hr * 0.4, cy - hr * 0.28); g.lineTo(cx + sd * hr * 0.68, cy - hr * 0.08 - up * hr * 0.1); g.lineTo(cx + sd * hr * 0.42, cy + hr * 0.08); g.closePath(); g.fill();
        g.fillStyle = rgba(rim, 1, 0.75); g.beginPath(); g.ellipse(cx + sd * hr * 0.5, cy - hr * 0.12, Math.max(1, hr * 0.06), Math.max(1, hr * 0.36), -sd * 0.35, 0, TAU); g.fill();
      }
      const hg = g.createRadialGradient(x + rox * 2, y - hr * 0.5, hr * 0.1, x, y, hr);
      hg.addColorStop(0, rgba(hair, 1.6)); hg.addColorStop(1, rgba(hair, 0.8));
      g.fillStyle = hg; g.beginPath(); g.arc(x - sd * hr * 0.1 * k2, y + p.hp * hr * 0.1, hr * 0.98, 0, TAU); g.fill();
      if (hr > 10) { g.strokeStyle = rgba(hair, 0.6, 0.6); g.lineWidth = Math.max(1, hr * 0.06); g.beginPath(); for (let i = 0; i < 5; i++) { const a = -2.4 + i * 0.35; g.moveTo(x + Math.cos(a) * hr * 0.3, y + Math.sin(a) * hr * 0.3); g.quadraticCurveTo(x + Math.cos(a + 0.4) * hr * 0.8, y + Math.sin(a + 0.4) * hr * 0.8, x + Math.cos(a + 0.9) * hr * 0.92, y + Math.sin(a + 0.9) * hr * 0.92); } g.stroke(); }
    }
  } });
  groups.sort((a, b) => a.k - b.k);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const gr of groups) gr.draw(0);
  for (const gr of groups) gr.draw(1);
}

/* ------------------------------------------------------------------ the ball (orthographic sphere with real pentagon patches) */
const ICO = (() => {
  const f = (1 + Math.sqrt(5)) / 2, v = [[0, 1, f], [0, -1, f], [0, 1, -f], [0, -1, -f], [1, f, 0], [-1, f, 0], [1, -f, 0], [-1, -f, 0], [f, 0, 1], [-f, 0, 1], [f, 0, -1], [-f, 0, -1]];
  return v.map((p) => {
    const l = Math.hypot(p[0], p[1], p[2]), n = [p[0] / l, p[1] / l, p[2] / l];
    let t1 = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; const l1 = Math.hypot(t1[0], t1[1], t1[2]); t1 = t1.map((x) => x / l1);
    const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
    const cs = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; const q = [n[0] + 0.38 * (Math.cos(a) * t1[0] + Math.sin(a) * t2[0]), n[1] + 0.38 * (Math.cos(a) * t1[1] + Math.sin(a) * t2[1]), n[2] + 0.38 * (Math.cos(a) * t1[2] + Math.sin(a) * t2[2])]; const ql = Math.hypot(q[0], q[1], q[2]); cs.push(q.map((x) => x / ql)); }
    return { n, cs };
  });
})();
function drawBall(g, x, y, r, spin, tilt, sq, sa, light = 1, rimC = null) {
  if (r < 0.6) return;
  g.save(); g.translate(x, y);
  if (sq) { g.rotate(sa); g.scale(1 + sq, 1 - sq); g.rotate(-sa); }
  const ca = Math.cos(spin), sa2 = Math.sin(spin), cb = Math.cos(tilt), sb = Math.sin(tilt);
  const rot = (q) => { const y1 = q[1] * ca - q[2] * sa2, z1 = q[1] * sa2 + q[2] * ca; const x2 = q[0] * cb + z1 * sb, z2 = -q[0] * sb + z1 * cb; return [x2, y1, z2]; };
  const L = Math.min(1.25, light), base = g.createRadialGradient(-0.35 * r, -0.42 * r, r * 0.05, 0, 0, r);
  base.addColorStop(0, `rgb(${255 * L | 0},${250 * L | 0},${240 * L | 0})`); base.addColorStop(0.55, `rgb(${215 * L | 0},${212 * L | 0},${210 * L | 0})`); base.addColorStop(1, `rgb(${120 * L | 0},${118 * L | 0},${128 * L | 0})`);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = base; g.fill();
  g.save(); g.clip();
  g.fillStyle = `rgba(${22 * L | 0},${24 * L | 0},${36 * L | 0},.92)`; g.beginPath();
  for (const pt of ICO) {
    const c = rot(pt.n); if (c[2] > 0.35) continue;
    for (let k = 0; k < 5; k++) { const q = rot(pt.cs[k]); if (k) g.lineTo(q[0] * r, -q[1] * r); else g.moveTo(q[0] * r, -q[1] * r); }
    g.closePath();
  }
  g.fill();
  if (r > 18) { // seams
    g.strokeStyle = `rgba(60,60,72,${0.35 * L})`; g.lineWidth = Math.max(0.6, r * 0.012); g.beginPath();
    for (const pt of ICO) { const c = rot(pt.n); if (c[2] > 0.2) continue; for (let k = 0; k < 5; k++) { const q = rot(pt.cs[k]); g.moveTo(q[0] * r, -q[1] * r); g.lineTo(q[0] * r * 1.18 - c[0] * r * 0.18, -(q[1] * r * 1.18 - c[1] * r * 0.18)); } }
    g.stroke();
  }
  const sh = g.createRadialGradient(-0.32 * r, -0.38 * r, 0, 0, 0, r * 1.02);
  sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(6,6,20,.62)');
  g.fillStyle = sh; g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  if (rimC) { g.strokeStyle = rimC; g.lineWidth = Math.max(1, r * 0.05); g.beginPath(); g.arc(0, 0, r * 0.96, Math.PI * 1.0, Math.PI * 1.5); g.stroke(); }
  g.restore();
}

/* ------------------------------------------------------------------ the stadium (night) */
// Bowl = two raked tiers around a rounded-rectangle (superellipse) ring; d = metres out from the LED boards.
const TIERS = [[2, 1.2, 34, 21.5], [38, 26.5, 66, 46.5]];
const NS = 56, TILES = 26, TW = 512, TH = 512;
const FOG_S = [10, 20, 44];
function ringPt(s, d) {
  const th = s * TAU, c = Math.cos(th), sn = Math.sin(th), A = 58 + d, B = 40 + d;
  return [A * Math.sign(c) * Math.pow(Math.abs(c), 0.4), B * Math.sign(sn) * Math.pow(Math.abs(sn), 0.4)];
}
const isUltras = (s) => { const q = ((s % 1) + 1) % 1; return q > 0.19 && q < 0.31; };

function* crowdTexture(R, pal, frame, fog, out) {
  const c = cnv(TW, TH), g = c.getContext('2d'), rows = 40, rh = TH / rows, fans = 44, fw = TW / fans;
  g.fillStyle = '#05080f'; g.fillRect(0, 0, TW, TH);
  const skins = [[64, 46, 36], [40, 30, 24], [118, 82, 58], [28, 22, 20], [150, 110, 80]];
  for (let r = 0; r < rows; r++) {
    if (r % 4 === 3) yield;
    const y0 = TH - (r + 1) * rh, br = 1.25 - (r / rows) * 0.62;
    g.fillStyle = '#0e1424'; g.fillRect(0, y0 + rh - 1.6, TW, 1.6);
    for (let i = 0; i < fans; i++) {
      const x = i * fw;
      if (i === 0) { g.fillStyle = r % 2 ? '#262d40' : '#1f2536'; g.fillRect(x, y0, fw * 2, rh); i = 1; continue; }
      if (R() > 0.96) continue;
      const col = pal[Math.floor(R() * pal.length)], k = br * (0.8 + R() * 0.4), jump = frame && R() < 0.4 ? 2.4 : 0;
      const up = frame ? R() < 0.2 : R() < 0.08, jx = (R() - 0.5) * 2;
      g.fillStyle = rgba(col, k); g.beginPath();
      if (g.roundRect) g.roundRect(x + 1.4 + jx, y0 + 5.4 - jump, fw - 2.8, rh - 4.8, 3); else g.rect(x + 1.4 + jx, y0 + 5.4 - jump, fw - 2.8, rh - 4.8);
      g.fill();
      if (up) { g.strokeStyle = rgba(col, k * 0.85); g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + 2.6 + jx, y0 + 6.5 - jump); g.lineTo(x + 2 + jx, y0 - 0.5 - jump); g.moveTo(x + fw - 2.6 + jx, y0 + 6.5 - jump); g.lineTo(x + fw - 2 + jx, y0 - 0.5 - jump); g.stroke(); }
      const sk = skins[Math.floor(R() * skins.length)];
      g.fillStyle = rgba(sk, br * 1.1); g.beginPath(); g.arc(x + fw / 2 + jx, y0 + 4 - jump, 2.8, 0, TAU); g.fill();
      if (R() < 0.12) { g.fillStyle = rgba(pal[1], k * 1.15); g.fillRect(x - 1 + jx, y0 + 1 - jump, fw + 2, 2.3); }
    }
  }
  if (fog) { g.fillStyle = rgba(FOG_S, 1, fog); g.fillRect(0, 0, TW, TH); }
  out.push(c);
}

function pitchTexture() {
  const c = cnv(1160, 800), g = c.getContext('2d'), m = 10, X = (x) => (x + 58) * m, Z = (z) => (z + 40) * m;
  g.fillStyle = '#145232'; g.fillRect(0, 0, 1160, 800);
  for (let i = 0; i < 21; i++) { g.fillStyle = i % 2 ? '#35a84a' : '#2b9441'; g.fillRect(X(-52.5 + i * 5), Z(-34), 5 * m, 68 * m); }
  for (let j = 0; j < 8; j++) { g.fillStyle = j % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)'; g.fillRect(X(-52.5), Z(-34 + j * 8.5), 105 * m, 8.5 * m); }
  const R = mulberry(7); g.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < 2600; i++) g.fillRect(R() * 1160, R() * 800, 2, 2);
  g.strokeStyle = 'rgba(245,252,248,.95)'; g.lineWidth = 2.6;
  g.strokeRect(X(-52.5), Z(-34), 105 * m, 68 * m);
  g.beginPath(); g.moveTo(X(0), Z(-34)); g.lineTo(X(0), Z(34)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 9.15 * m, 0, TAU); g.stroke();
  for (const s of [-1, 1]) {
    const gx = s * 52.5;
    g.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Z(-20.16), 16.5 * m, 40.32 * m);
    g.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Z(-9.16), 5.5 * m, 18.32 * m);
    g.beginPath(); g.arc(X(gx - s * 11), Z(0), 9.15 * m, s > 0 ? Math.PI - 0.93 : -0.93, s > 0 ? Math.PI + 0.93 : 0.93); g.stroke();
    g.fillStyle = '#f4fff8'; g.beginPath(); g.arc(X(gx - s * 11), Z(0), 3, 0, TAU); g.fill();
  }
  g.fillStyle = '#f4fff8'; g.beginPath(); g.arc(X(0), Z(0), 3, 0, TAU); g.fill();
  const lg = g.createRadialGradient(580, 400, 30, 580, 400, 780);
  lg.addColorStop(0, 'rgba(255,255,235,.32)'); lg.addColorStop(0.6, 'rgba(255,255,255,.06)'); lg.addColorStop(1, 'rgba(0,0,12,.18)');
  g.fillStyle = lg; g.fillRect(0, 0, 1160, 800);
  return c;
}

function* buildStadiumGen(S) {
  const R = mulberry(424242);
  const palA = [[24, 44, 110], [250, 200, 76], [238, 240, 248], [36, 70, 150], [250, 200, 76], [16, 24, 50], [214, 58, 70], [70, 150, 235]];
  const palB = [[252, 210, 70], [246, 184, 40], [255, 226, 120], [22, 32, 76], [252, 210, 70], [240, 240, 240]];
  const ST = { tex: [], mips: [], pats: null, lights: [], flags: [], flares: [], lamps: [], pitch: null };
  yield; ST.pitch = pitchTexture(); yield;
  for (const pal of [palA, palB]) for (const fog of [0, 0.45]) {
    const out = []; yield* crowdTexture(R, pal, 0, fog, out); yield;
    const m1 = mip(out[0]); yield; const m2 = mip(m1); ST.tex.push(out[0]); ST.mips.push([out[0], m1, m2]); yield;
  }
  for (let i = 0; i < 620; i++) {
    const s = R(), ti = R() < 0.6 ? 0 : 1, v = R(), T = TIERS[ti], d = lerp(T[0], T[2], v), [x, z] = ringPt(s, d);
    ST.lights.push({ x, y: lerp(T[1], T[3], v) + 1.3, z, w: 1.5 + R() * 3.5, ph: R() * TAU, steady: R() < 0.16 });
  }
  const FC = [[[250, 206, 70], [16, 28, 70]], [[240, 244, 255], [28, 92, 210]], [[210, 40, 56], [244, 244, 244]], [[47, 227, 207], [10, 24, 60]], [[250, 206, 70], [210, 40, 56]]];
  for (let i = 0; i < 16; i++) {
    const s = (i + 0.3 + R() * 0.4) / 16, ti = i % 3 === 0 ? 1 : 0, T = TIERS[ti], v = ti ? 0.04 : 0.08 + R() * 0.5;
    const d = lerp(T[0], T[2], v), [x, z] = ringPt(s, d), [x2, z2] = ringPt(s + 0.004, d), tl = Math.hypot(x2 - x, z2 - z) || 1;
    ST.flags.push({ x, y: lerp(T[1], T[3], v) + 2.2, z, tx: (x2 - x) / tl, tz: (z2 - z) / tl, w: 5.5 + R() * 2, h: 3.4, c: FC[i % FC.length], ph: R() * TAU });
  }
  for (let i = 0; i < 7; i++) {
    const s = 0.25 + (i - 3) * 0.013, d = 6 + (i % 3) * 7 + R() * 3, T = TIERS[0], [x, z] = ringPt(s, d);
    ST.flares.push({ x, y: lerp(T[1], T[3], (d - T[0]) / (T[2] - T[0])) + 1.8, z, ph: R() * 10, dr: (R() - 0.5) * 0.6 });
  }
  // floodlights along the inner edge of the roof (no roof over the camera side)
  for (let i = 0; i < NS * 2; i++) {
    const s = (i + 0.5) / (NS * 2); if (s > 0.6 && s < 0.9) continue;
    const [x, z] = ringPt(s, 62.5); ST.lamps.push({ x, y: 51.6, z, bank: i % 9 === 4 });
  }
  S.ST = ST;
}

function stadiumCam(t) {
  const u = eOut(prog(t, 4.2, 5.7)), v = prog(t, 5.7, 8.2);
  const px = lerp(-30, -9, u) + v * 12, py = lerp(53, 37, u) - v * 3, pz = lerp(-113, -62, u) + v * 11;
  const tx = lerp(-12, 3, u) + v * 3, ty = lerp(-2, 1, u) + v * 2, tz = lerp(-12, 0, u) + v * 2;
  return [px, py, pz, tx, ty, tz, lerp(0.14, 0, u) - v * 0.02];
}

function drawStadium(g, S, t) {
  const { W, H, ST } = S, ts = t - 4.2;
  if (!ST.pats) ST.pats = ST.mips.map((lv) => lv.map((c) => g.createPattern(c, 'repeat')));
  if (!ST.pitchPat) ST.pitchPat = g.createPattern(ST.pitch, 'no-repeat');
  const hy = horizonY(), sky = g.createLinearGradient(0, hy - C.f * 1.2, 0, hy);
  sky.addColorStop(0, '#010208'); sky.addColorStop(0.7, '#050b1c'); sky.addColorStop(1, '#0c1a38');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  if (P(0, 70, 0)) sprite(g, S.spr.dome, PX, PY, 200 * PS, 0.3);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#04070d'; g.beginPath(); quad(g, -600, 0, -600, 600, 0, -600, 600, 0, 600, -600, 0, 600); g.fill();
  const pat = ST.pitchPat, NX = 12, NZ = 8;
  g.fillStyle = '#2c8f45'; g.beginPath(); quad(g, -58, 0, -40, 58, 0, -40, 58, 0, 40, -58, 0, 40); g.fill();   // under the cells: no hairline seams
  g.fillStyle = pat;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x0 = -58 + i * 116 / NX, x1 = x0 + 116 / NX, z0 = -40 + j * 80 / NZ, z1 = z0 + 80 / NZ;
    if (!P(x0, 0, z0)) continue; const ax = PX, ay = PY; if (!P(x1, 0, z0)) continue; const bx = PX, by = PY; if (!P(x0, 0, z1)) continue;
    patAffine(pat, ax, ay, bx, by, PX, PY, (x1 - x0) * 10, (z1 - z0) * 10, (x0 + 58) * 10, (z0 + 40) * 10);
    g.beginPath(); quad(g, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); g.fill();
  }
  // floodlight pools on the grass
  g.globalCompositeOperation = 'lighter';
  groundSprite(g, S.dpr, S.spr.pool2, 0, 0.05, 0, 62, 44, 0.2);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(240,248,255,.92)'; g.lineWidth = 1.6; g.beginPath();
  for (const s of [-1, 1]) { const x = s * 52.5; seg(g, x, 0, -3.66, x, 2.44, -3.66); seg(g, x, 0, 3.66, x, 2.44, 3.66); seg(g, x, 2.44, -3.66, x, 2.44, 3.66); }
  g.stroke();
  const ledC = [[255, 200, 80], [47, 227, 207], [235, 240, 255]];
  for (let k = 0; k < 3; k++) {
    g.fillStyle = rgba(ledC[k], 1, 0.95); g.beginPath();
    for (let i = 0; i < NS; i++) {
      if (((Math.floor(i / 2 + ts * 6)) % 3 + 3) % 3 !== k) continue;
      const [ax, az] = ringPt(i / NS, 0), [bx, bz] = ringPt((i + 1) / NS, 0);
      quad(g, ax, 0, az, bx, 0, bz, bx, 0.95, bz, ax, 0.95, az);
    }
    g.fill();
  }
  const segs = [];
  for (let i = 0; i < NS; i++) { const s = (i + 0.5) / NS, [x, z] = ringPt(s, 34); segs.push([dist3(x, 22, z), i]); }
  segs.sort((a, b) => b[0] - a[0]);
  for (const [, i] of segs) drawStandSeg(g, S, i, ts);
  g.globalCompositeOperation = 'lighter';
  const nL = S.lowQ ? 300 : ST.lights.length;
  for (let i = 0; i < nL; i++) {
    const L = ST.lights[i];
    if (!P(L.x, L.y, L.z) || PX < -20 || PX > W + 20 || PY < -20 || PY > H + 20) continue;
    const f = L.steady ? 0.55 : Math.pow(Math.max(0, Math.sin(ts * L.w + L.ph)), 14);
    if (f < 0.04) continue;
    sprite(g, S.spr.white, PX, PY, clamp(1.6 * PS * (0.5 + f), 1.5, 26), f);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const F of ST.flags) drawFlag(g, F, ts);
  drawFlares(g, S, ts);
  drawRoofLights(g, S, t);
}

function drawStandSeg(g, S, i, ts) {
  const ST = S.ST, s0 = i / NS, s1 = (i + 1) / NS, ultra = isUltras((s0 + s1) / 2), frame = (Math.floor(ts * 4.2 + i * 0.37) & 1);
  const [lx, lz] = ringPt(s0, 10), [ux, uz] = ringPt(s0, 52), upperNear = dist3(ux, 36, uz) < dist3(lx, 10, lz);
  const tierDraw = (ti) => {
    const [dA, yA, dB, yB] = TIERS[ti];
    const [mx, mz] = ringPt((s0 + s1) / 2, (dA + dB) / 2), dm = dist3(mx, (yA + yB) / 2, mz);
    const nv = dm < 45 ? 4 : dm < 90 ? 2 : 1, nu = dm < 45 ? 2 : 1;
    const back = ((s0 + s1) / 2) > 0.6 && ((s0 + s1) / 2) < 0.9, lv = ST.pats[(ultra ? 2 : 0) + (dm > 115 || back ? 1 : 0)];
    for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
      const sa = lerp(s0, s1, a / nu), sb = lerp(s0, s1, (a + 1) / nu), va = b / nv, vb = (b + 1) / nv;
      const da = lerp(dA, dB, va), db = lerp(dA, dB, vb), ya = lerp(yA, yB, va), yb = lerp(yA, yB, vb);
      const [x00, z00] = ringPt(sa, da), [x10, z10] = ringPt(sb, da), [x01, z01] = ringPt(sa, db), [x11, z11] = ringPt(sb, db);
      if (!P(x00, ya, z00)) continue; const ax = PX, ay = PY;
      if (!P(x10, ya, z10)) continue; const bx = PX, by = PY;
      if (!P(x01, yb, z01)) continue;
      if (Math.max(ax, bx, PX) < -60 || Math.min(ax, bx, PX) > S.W + 60 || Math.max(ay, by, PY) < -60 || Math.min(ay, by, PY) > S.H + 60) continue;
      const du = (sb - sa) * TILES * TW, dv = (vb - va) * TH;
      const k = Math.max(du / (Math.hypot(bx - ax, by - ay) + 0.01), dv / (Math.hypot(PX - ax, PY - ay) + 0.01));
      const L = k > 3 ? 2 : k > 1.5 ? 1 : 0, sc = 1 << L, pat = lv[L];
      patAffine(pat, ax, ay, bx, by, PX, PY, du / sc, -dv / sc, sa * TILES * TW / sc, ((1 - va) * TH + frame * 2.6) / sc);   // frame: the section jumps
      g.fillStyle = pat; g.beginPath(); quad(g, x00, ya, z00, x10, ya, z10, x11, yb, z11, x01, yb, z01); g.fill();
    }
  };
  const fascia = () => {
    const [ax, az] = ringPt(s0, 34), [bx, bz] = ringPt(s1, 34), [cx, cz] = ringPt(s0, 38), [ex, ez] = ringPt(s1, 38);
    const fog = clamp(dist3(ax, 24, az) / 260) * 0.6;
    g.fillStyle = rgba(mix([16, 22, 40], FOG_S, fog)); g.beginPath(); quad(g, ax, 21.5, az, bx, 21.5, bz, bx, 26.5, bz, ax, 26.5, az); quad(g, ax, 26.5, az, bx, 26.5, bz, ex, 26.5, ez, cx, 26.5, cz); g.fill();
    g.fillStyle = rgba(mix([255, 214, 150], FOG_S, fog), 0.75); g.beginPath(); quad(g, ax, 22.6, az, bx, 22.6, bz, bx, 24.8, bz, ax, 24.8, az); g.fill();
  };
  const rim = () => {
    const [ax, az] = ringPt(s0, 66), [bx, bz] = ringPt(s1, 66), [cx, cz] = ringPt(s0, 69), [ex, ez] = ringPt(s1, 69);
    const fog = clamp(dist3(ax, 46, az) / 260) * 0.6;
    g.fillStyle = rgba(mix([20, 26, 46], FOG_S, fog)); g.beginPath(); quad(g, ax, 46.5, az, bx, 46.5, bz, bx, 50, bz, ax, 50, az); quad(g, ax, 50, az, bx, 50, bz, ex, 50.5, ez, cx, 50.5, cz); g.fill();
  };
  const roof = () => {
    const sm2 = (s0 + s1) / 2; if (sm2 > 0.6 && sm2 < 0.9) return;
    const [ax, az] = ringPt(s0, 61), [bx, bz] = ringPt(s1, 61), [cx, cz] = ringPt(s0, 86), [ex, ez] = ringPt(s1, 86);
    const fog = clamp(dist3(ax, 52, az) / 260) * 0.5;
    g.fillStyle = rgba(mix([12, 17, 30], FOG_S, fog)); g.beginPath(); quad(g, ax, 52, az, bx, 52, bz, ex, 57, ez, cx, 57, cz); g.fill();
    g.fillStyle = rgba(mix([30, 40, 64], FOG_S, fog)); g.beginPath(); quad(g, ax, 51.2, az, bx, 51.2, bz, bx, 54, bz, ax, 54, az); g.fill();
    g.fillStyle = 'rgba(230,242,255,.9)'; g.beginPath(); quad(g, ax, 51.2, az, bx, 51.2, bz, bx, 51.8, bz, ax, 51.8, az); g.fill();
  };
  if (upperNear) { tierDraw(0); fascia(); tierDraw(1); rim(); roof(); } else { roof(); rim(); tierDraw(1); fascia(); tierDraw(0); }
}

function drawFlag(g, F, ts) {
  const N = 6, top = [], bot = [], nx = -F.tz, nz = F.tx;
  for (let k = 0; k <= N; k++) {
    const u = k / N, w = Math.sin(u * 5 - ts * 7 + F.ph) * 0.55 * u, x = F.x + F.tx * u * F.w + nx * w, z = F.z + F.tz * u * F.w + nz * w;
    const lift = Math.sin(ts * 3 + F.ph) * 0.3 * u;
    top.push([x, F.y + F.h + lift, z]); bot.push([x, F.y + lift * 0.5, z]);
  }
  const y = (b, v) => lerp(top[b][1], bot[b][1], v);
  const band = (p, k, a0, a1) => quad(p, top[k][0], y(k, a0), top[k][2], top[k + 1][0], y(k + 1, a0), top[k + 1][2], top[k + 1][0], y(k + 1, a1), top[k + 1][2], top[k][0], y(k, a1), top[k][2]);
  const pa = new Path2D(), pb = new Path2D(), shade = new Path2D();
  for (let k = 0; k < N; k++) {
    band(pa, k, 0, 0.36); band(pb, k, 0.36, 0.64); band(pa, k, 0.64, 1);
    if (Math.cos(k / N * 5 - ts * 7 + F.ph) < 0) band(shade, k, 0, 1);   // folds facing away: darker
  }
  g.fillStyle = rgba(F.c[0]); g.fill(pa); g.fillStyle = rgba(F.c[1]); g.fill(pb);
  g.fillStyle = 'rgba(0,0,12,.3)'; g.fill(shade);
  g.strokeStyle = 'rgba(30,30,40,.9)'; g.lineWidth = 1; g.beginPath(); seg(g, F.x, F.y - 1.5, F.z, F.x, F.y + F.h + 0.4, F.z); g.stroke();
}

function drawFlares(g, S, ts) {
  const ST = S.ST;
  // smoke first (normal blend), then the burning cores (additive)
  for (const F of ST.flares) {
    for (let i = 0; i < 9; i++) {
      const a = ((ts * 0.33 + i / 9 + F.ph * 0.1) % 1 + 1) % 1, x = F.x - a * 7 + Math.sin(a * 6 + F.ph) * 1.2, y = F.y + 0.5 + a * 15, z = F.z + F.dr * a * 10;
      if (!P(x, y, z)) continue;
      const r = (1.4 + a * 6.5) * PS; if (r < 1) continue;
      g.globalAlpha = (1 - a) * 0.5 * clamp(a * 6); g.drawImage(a < 0.45 ? S.spr.smokeR : S.spr.smokeG, PX - r, PY - r, r * 2, r * 2);
    }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
  for (const F of ST.flares) {
    if (!P(F.x, F.y, F.z)) continue;
    const fl = 0.85 + 0.15 * Math.sin(ts * 37 + F.ph) + 0.1 * Math.sin(ts * 23 + F.ph * 2);
    sprite(g, S.spr.red, PX, PY, clamp(14 * PS, 6, 160) * fl, 0.42);
    sprite(g, S.spr.flare, PX, PY, clamp(2.2 * PS, 3, 40) * fl, 1);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ------------------------------------------------------------------ shots / timeline */
let ASPECT = 0.46;
function hoodCam(t) {
  if (t < 1.6) {
    const u = 1 - Math.pow(1 - t / 1.6, 1.5);
    return [lerp(1.5, 0.55, u), lerp(1.2, 1.0, u), lerp(0.0, 4.9, u), 0, lerp(2.8, 2.15, u), lerp(14, 12, u), 0];
  }
  if (t < 3.0) {
    const u = sm(prog(t, 1.6, 3.0));
    const wide = clamp((ASPECT - 0.6) / 1.0);   // landscape screens: keep the kid nearer the centre
    return [lerp(1.95, 1.7, u), lerp(0.28, 0.34, u), lerp(11.2, 10.85, u), lerp(-0.9, -1.0, u) + wide * 1.3, lerp(2.6, 2.95, u) - wide * 0.4, 6.5, -0.04];
  }
  const u = prog(t, 3.0, 4.2);
  return [lerp(0.14, 0.08, u), lerp(0.92, 0.96, u), lerp(6.15, 6.32, u), 0, 0.8, 9, 0];
}

function shakeAmt(t) {
  let a = 4 * bump(t, 3.57, 0.05);
  if (t >= 4.2) a += 9 * Math.pow(1 - prog(t, 4.2, 4.6), 2);
  if (t >= 5.85) a += 11 * Math.pow(1 - prog(t, 5.85, 6.2), 2);
  return a;
}
function applyShake(S, t) {
  const a = shakeAmt(t);
  C.cx = S.W / 2 + Math.sin(t * 97) * a; C.cy = S.H / 2 + Math.cos(t * 83) * a;
}
function setCam(S, t, arr) { C.f = S.f; lookAt(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6]); applyShake(S, t); }

function renderHood(S, t) {
  const g = S.g;
  setCam(S, t, hoodCam(t));
  const lamp = lampLevel(t), dream = t >= 1.6 && t < 3 ? sm(prog(t, 1.7, 2.2)) : 0;
  drawHoodSky(g, S, t, dream);
  drawGround(g, S, t, lamp);
  // contact shadows (kid + ball) and the long shadow cast by the street lamp
  const { p, ball } = kidAt(t);
  if (S.spr.shadow) {
    groundDecal(g, S.dpr, S.spr.shadow, KID.x, KID.z, 0.42, 0, 0, 0.28, 0.6);
    const dx = KID.x - LAMP.hx, dz = KID.z - LAMP.z, dl = Math.hypot(dx, dz);
    groundDecal(g, S.dpr, S.spr.shadow, KID.x + dx / dl * 1.5, KID.z + dz / dl * 1.5, dx / dl * 1.7, dz / dl * 1.7, -dz / dl * 0.32, dx / dl * 0.32, 0.42 * lamp);
    if (!ball.fly) groundDecal(g, S.dpr, S.spr.shadow, ball.x, ball.z, 0.16 + ball.y * 0.1, 0, 0, 0.11 + ball.y * 0.07, clamp(0.55 - ball.y * 0.3));
  }
  const objs = [];
  for (const b of S.hood.blocks) objs.push([dist3(b.cx, b.h / 2, b.cz), 0, b]);
  for (const pm of S.hood.palms) objs.push([dist3(pm.x, pm.h / 2, pm.z), 1, pm]);
  objs.sort((a, b) => b[0] - a[0]);
  for (const [, k, o] of objs) { if (k === 0) drawBlock(g, S, o, t); else drawPalm(g, o, t); }
  drawStreetBits(g, S, t, lamp);
  drawLampLight(g, S, lamp);
  // kid + ball (ball behind the kid when the camera is behind the kid)
  const front = C.z < KID.z;
  const view = front
    ? { front, light: 0.34 + 0.6 * lamp, tint: [1.06, 0.9, 0.76], rim: [255, 172, 120], rimA: 0.95, gender: S.gender }
    : { front, light: 0.68, tint: [1.08, 0.84, 0.72], rim: [150, 236, 255], rimA: 0.9, gender: S.gender };
  const ballDraw = () => {
    if (ball.fly || !P(ball.x, ball.y, ball.z)) return;
    drawBall(g, PX, PY, BR * PS, ball.spin, 0.4, ball.sq, ball.sa, view.light * 1.05, `rgba(${view.rim.join(',')},.45)`);
  };
  const behind = (ball.x - KID.x) * (C.x - KID.x) + (ball.z - KID.z) * (C.z - KID.z) < 0;
  if (behind) ballDraw();
  kidDraw(g, S, t, p, view);
  if (!behind) ballDraw();
  // impact pop at the volley
  if (t > 3.53 && t < 3.8) {
    const u = prog(t, 3.55, 3.8);
    if (P(BP.V[0], BP.V[1], BP.V[2])) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,236,190,${0.7 * (1 - u)})`; g.lineWidth = Math.max(1, 0.012 * PS * (1 - u));
      g.beginPath(); g.arc(PX, PY, (0.13 + u * 0.4) * PS, 0, TAU); g.stroke();
      sprite(g, S.spr.lamp, PX, PY, 0.5 * PS, 0.6 * (1 - u));
      g.globalCompositeOperation = 'source-over';
    }
  }
  if (ball.fly) drawFlight(S, t, view);
}

// the volley: ball flies at the lens (exponential approach), zoom-blur streaks, ghost trail
function flightPos(t) {
  const u = prog(t, 3.55, 4.18), D0 = Math.hypot(BP.V[0] - C.x, BP.V[1] - C.y, BP.V[2] - C.z), De = 0.085;
  const D = D0 * Math.pow(De / D0, Math.pow(u, 1.12)), w = (D - De) / (D0 - De);
  const ex = C.x + C.fx * De, ey = C.y + C.fy * De, ez = C.z + C.fz * De;
  return [ex + (BP.V[0] - ex) * w, ey + (BP.V[1] - ey) * w + 0.32 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * w, ez + (BP.V[2] - ez) * w, u];
}
function drawFlight(S, t, view) {
  const g = S.g, { W, H } = S;
  const [x, y, z, u] = flightPos(t);
  if (!P(x, y, z)) return;
  const bx = PX, by = PY, br = BR * PS;
  // zoom streaks
  if (u > 0.2) {
    const R = mulberry(77), a = clamp((u - 0.2) * 1.6) * 0.5;
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,240,220,${a})`; g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const ang = R() * TAU, sp = 0.3 + R() * 0.7, ph = ((t * 3.2 * sp + R()) % 1);
      const r0 = br * 1.1 + ph * Math.max(W, H) * 0.9, r1 = r0 + (30 + R() * 90) * (0.5 + u);
      g.lineWidth = 0.8 + R() * 1.8; g.beginPath(); g.moveTo(bx + Math.cos(ang) * r0, by + Math.sin(ang) * r0); g.lineTo(bx + Math.cos(ang) * r1, by + Math.sin(ang) * r1); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  // ghost trail
  if (br < 260 && !S.lowQ) {
    for (const [dt, a] of [[0.05, 0.16], [0.028, 0.28]]) {
      const q = flightPos(t - dt); if (!P(q[0], q[1], q[2])) continue;
      g.globalAlpha = a; drawBall(g, PX, PY, BR * PS, t * 38 - dt * 38, 0.5, 0, 0, view.light, null); g.globalAlpha = 1;
    }
    P(x, y, z);
  }
  drawBall(g, bx, by, br, t * 38, 0.5, -0.05 * u, Math.atan2(by - H / 2, bx - W / 2), view.light * 1.08, br < 120 ? `rgba(${view.rim.join(',')},.35)` : null);
}

function renderStadium(S, t) {
  if (!S.ST) { buildStadiumNow(S); }
  setCam(S, t, stadiumCam(t));
  drawStadium(S.g, S, t);
}

/* ------------------------------------------------------------------ post: letterbox, flashes, logo-phase fx */
function post(S, t) {
  const g = S.g, { W, H } = S;
  // logo phase: darken, god rays, burst, shockwave, dust
  if (t > 5.5) {
    const lx = W / 2, ly = H * 0.46;
    g.fillStyle = `rgba(2,6,16,${0.5 * sm(prog(t, 5.5, 5.9))})`; g.fillRect(0, 0, W, H);
    const ray = sm(prog(t, 5.85, 6.3)) * (1 - 0.4 * prog(t, 7.4, 8));
    if (ray > 0.01) {
      g.globalCompositeOperation = 'lighter';
      const Rm = Math.max(W, H) * 0.9, gr = g.createRadialGradient(lx, ly, 0, lx, ly, Rm);
      gr.addColorStop(0, `rgba(255,214,120,${0.16 * ray})`); gr.addColorStop(0.3, `rgba(255,190,90,${0.05 * ray})`); gr.addColorStop(0.75, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + t * 0.1, w = 0.025 + 0.025 * (0.5 + 0.5 * Math.sin(i * 2.3)); g.moveTo(lx, ly); g.arc(lx, ly, Rm, a - w, a + w); g.closePath(); }
      g.fill();
      sprite(g, S.spr.halo, lx, ly, Math.min(W, H) * 0.75, 0.32 * ray);
      g.globalCompositeOperation = 'source-over';
    }
    if (t >= 5.85) {
      const tau = t - 5.85;
      g.globalCompositeOperation = 'lighter';
      // shockwaves
      for (const [d0, k] of [[0, 1], [0.09, 0.6]]) {
        const pu = prog(tau, d0, d0 + 0.6); if (pu <= 0 || pu >= 1) continue;
        g.strokeStyle = `rgba(255,236,180,${0.75 * (1 - pu) * k})`; g.lineWidth = 2 + 18 * (1 - pu);
        g.beginPath(); g.arc(lx, ly, eOut(pu) * Math.max(W, H) * 0.75, 0, TAU); g.stroke();
      }
      // anamorphic streak through the logo
      const st = bump(tau, 0.05, 0.18); if (st > 0.02) { g.globalAlpha = st * 0.8; g.drawImage(S.spr.streak, lx - W * 0.9, ly - 14, W * 1.8, 28); g.globalAlpha = 1; }
      // burst sparks (analytic: drag + gravity)
      for (const q of S.burst) {
        const tt = tau - q.d; if (tt <= 0 || tt > q.life) continue;
        const k = 3.1, e = (1 - Math.exp(-k * tt)) / k, e0 = (1 - Math.exp(-k * Math.max(0, tt - 0.03))) / k;
        const x = lx + q.vx * e, y = ly + q.vy * e + 70 * tt * tt, x0 = lx + q.vx * e0, y0 = ly + q.vy * e0 + 70 * (tt - 0.03) ** 2;
        const fa = 1 - tt / q.life; g.strokeStyle = rgba(q.c, 1, fa); g.lineWidth = q.w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke();
        if (q.w > 2) sprite(g, S.spr.gold, x, y, q.w * 3.2, fa);
      }
      // floating gold dust
      for (const m of S.motes) {
        const tt = tau - m.d; if (tt < 0) continue;
        const x = m.x * W + Math.sin(tt * m.s + m.ph) * 12, y = H * (m.y - tt * m.v);
        sprite(g, S.spr.gold, x, y, m.r, clamp(tt * 2) * 0.7 * (1 - prog(t, 7.5, 8)));
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
  // vignette
  if (S.spr.vig) g.drawImage(S.spr.vig, 0, 0, W, H);
  // letterbox (opens on the smash-cut)
  const bar = H * 0.072 * (t < 4.2 ? 1 : 1 - eOut(prog(t, 4.2, 4.55)));
  if (bar > 0.5) { g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar); }
  // flashes
  let white = 0;
  if (t > 4.1 && t < 4.2) white = Math.pow(prog(t, 4.1, 4.2), 2) * 0.9;
  if (t >= 4.2) white = Math.max(white, 1 - eOut(prog(t, 4.2, 4.55)));
  if (t >= 5.85) white = Math.max(white, 0.5 * (1 - prog(t, 5.85, 6.1)));
  if (white > 0.005) { g.fillStyle = `rgba(255,252,244,${white})`; g.fillRect(0, 0, W, H); }
  const black = 1 - sm(prog(t, 0, 0.4));
  if (black > 0.005) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, W, H); }
}

/* ------------------------------------------------------------------ sprites / state */
function makeSprites(S) {
  const spr = {
    sunset: glowSprite(256, [255, 120, 80], 0.04, [255, 200, 150]),
    dome: glowSprite(128, [120, 220, 255], 0.05, [220, 250, 255]),
    pool: glowSprite(128, [255, 176, 96], 0.1, [255, 214, 160]), pool2: glowSprite(128, [190, 255, 150], 0.05, [255, 255, 220]),
    lamp: glowSprite(64, [255, 180, 100], 0.12, [255, 245, 220]),
    winWarm: glowSprite(32, [255, 170, 80], 0.1), winPale: glowSprite(32, [255, 214, 150], 0.1), winTv: glowSprite(32, [120, 170, 255], 0.1),
    white: glowSprite(24, [200, 225, 255], 0.22), red: glowSprite(64, [255, 50, 40], 0.06, [255, 140, 90]), flare: glowSprite(32, [255, 90, 50], 0.3, [255, 250, 230]),
    flood: glowSprite(32, [190, 225, 255], 0.28), halo: glowSprite(128, [140, 200, 255], 0.03, [230, 245, 255]), haloW: glowSprite(128, [255, 236, 200], 0.03, [255, 252, 240]), gold: glowSprite(16, [255, 200, 90], 0.3, [255, 250, 220]),
    smokeR: softSprite(64, [230, 70, 66], 0.6), smokeG: softSprite(64, [120, 90, 110], 0.45), shadow: softSprite(32, [0, 0, 0], 0.85),
    ghost: [softSprite(48, [80, 230, 210], 0.6), softSprite(48, [255, 190, 90], 0.6), softSprite(48, [170, 120, 255], 0.5)],
  };
  const st = cnv(256, 16), sg = st.getContext('2d'), gr = sg.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(0.5, 'rgba(230,245,255,1)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 256, 16);
  const vg = sg.createLinearGradient(0, 0, 0, 16); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  sg.globalCompositeOperation = 'destination-out'; sg.fillStyle = vg; sg.fillRect(0, 0, 256, 16);
  spr.streak = st;
  S.spr = spr;
  const R = mulberry(5150);
  S.burst = []; const golds = [[255, 214, 110], [255, 240, 200], [244, 195, 90], [125, 240, 226]];
  for (let i = 0; i < 150; i++) { const a = R() * TAU, v = 300 + R() * 900; S.burst.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75, c: golds[i % 4], w: 1 + R() * 2.4, life: 0.6 + R() * 0.9, d: R() * 0.06 }); }
  S.motes = []; for (let i = 0; i < 46; i++) S.motes.push({ x: R(), y: 0.4 + R() * 0.7, v: 0.03 + R() * 0.06, s: 1 + R() * 2, ph: R() * TAU, r: 2 + R() * 4, d: 0.2 + R() * 0.8 });
}
function makeVignette(S) {
  const c = cnv(256, 256 * S.H / S.W), g = c.getContext('2d'), gr = g.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.25, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.56);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,8,.62)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  S.spr.vig = c;
}
// The stadium assets are built incrementally while the neighbourhood plays (one slice per frame).
function stadiumBuilderGen(S) { return buildStadiumGen(S); }
function buildStadiumNow(S) { if (S.builder) { while (!S.builder.next().done); S.builder = null; } if (!S.ST) { const it = buildStadiumGen(S); while (!it.next().done); } }

function courtTexture() {
  const m = 20, c = cnv(18 * m, 25 * m), g = c.getContext('2d'), X = (x) => (x + 9) * m, Z = (z) => (z - 1.5) * m, R = mulberry(31);
  g.fillStyle = '#2c2e3b'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 6000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.09)'; g.fillRect(R() * c.width, R() * c.height, 1 + R() * 2, 1 + R() * 2); }
  g.fillStyle = '#2d6c66'; g.fillRect(X(-7.6), Z(3), 15.2 * m, 22 * m);
  for (let i = 0; i < 1800; i++) { g.fillStyle = R() < 0.5 ? 'rgba(160,220,210,.05)' : 'rgba(10,30,30,.08)'; g.fillRect(X(-7.6) + R() * 15.2 * m, Z(3) + R() * 22 * m, 1 + R() * 3, 1 + R() * 3); }
  for (let i = 0; i < 28; i++) {
    const x = X(-7 + R() * 14), y = Z(4 + R() * 20), r = (0.4 + R() * 1.7) * m, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(58,60,70,.6)'); gr.addColorStop(1, 'rgba(58,60,70,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.fillStyle = 'rgba(176,74,64,.6)';
  g.beginPath(); g.arc(X(0), Z(3), 3.6 * m, 0, Math.PI); g.fill(); g.beginPath(); g.arc(X(0), Z(25), 3.6 * m, Math.PI, TAU); g.fill();
  g.beginPath(); g.arc(X(0), Z(14), 2.2 * m, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(238,232,216,.78)'; g.lineWidth = 2.2;
  g.strokeRect(X(-7.6), Z(3), 15.2 * m, 22 * m);
  g.beginPath(); g.moveTo(X(-7.6), Z(14)); g.lineTo(X(7.6), Z(14)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(14), 2.2 * m, 0, TAU); g.stroke();
  g.beginPath(); g.arc(X(0), Z(3), 3.6 * m, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(X(0), Z(25), 3.6 * m, Math.PI, TAU); g.stroke();
  // worn line paint
  for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(45,108,102,.9)' : 'rgba(44,46,59,.85)'; g.fillRect(R() * c.width, R() * c.height, 2 + R() * 3, 1 + R() * 2); }
  // cracks
  g.strokeStyle = 'rgba(8,8,14,.6)'; g.lineWidth = 1.3;
  for (let i = 0; i < 16; i++) { let x = R() * c.width, y = R() * c.height; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  // chalk hopscotch + a chalk goal drawn on the side
  g.strokeStyle = 'rgba(255,250,236,.5)'; g.lineWidth = 2;
  for (let k = 0; k < 6; k++) { const z = 5 + k * 0.7, two = k % 2 === 1; if (two) { g.strokeRect(X(-8.85), Z(z), 0.55 * m, 0.7 * m); g.strokeRect(X(-8.3), Z(z), 0.55 * m, 0.7 * m); } else g.strokeRect(X(-8.6), Z(z), 0.6 * m, 0.7 * m); }
  g.font = `700 ${0.6 * m}px Rubik, Heebo, Arial, sans-serif`; g.fillStyle = 'rgba(255,250,236,.4)'; g.textAlign = 'center';
  g.save(); g.translate(X(8.3), Z(18)); g.rotate(-Math.PI / 2); g.fillText('10', 0, 0); g.restore();
  // oil stain / puddle near the lamp
  const px = X(-5), py = Z(11.5), pg = g.createRadialGradient(px, py, 0, px, py, 1.6 * m);
  pg.addColorStop(0, 'rgba(18,18,26,.75)'); pg.addColorStop(1, 'rgba(18,18,26,0)'); g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, 1.8 * m, 1.1 * m, 0.3, 0, TAU); g.fill();
  return c;
}

function mip(c) {
  const h = cnv(c.width / 2, c.height / 2), g = h.getContext('2d'); g.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, h.width, h.height); return h;
}

function drawRoofLights(g, S, t) {
  const ST = S.ST, { W, H } = S;
  g.globalCompositeOperation = 'lighter';
  const banks = [];
  for (const L of ST.lamps) {
    if (!P(L.x, L.y, L.z) || PX < -80 || PX > W + 80 || PY < -80 || PY > H + 80) continue;
    sprite(g, S.spr.flood, PX, PY, clamp(3.2 * PS, 3, 34), 0.95);
    if (L.bank) banks.push(L); else sprite(g, S.spr.haloW, PX, PY, clamp(14 * PS, 10, 120), 0.07);
  }
  // volumetric beams from the light banks down onto the pitch
  for (const L of banks) {
    if (!P(L.x, L.y, L.z)) continue; const hx = PX, hy = PY;
    const tx = L.x * 0.2, tz = L.z * 0.2; if (!P(tx, 0, tz)) continue;
    const gr = g.createLinearGradient(hx, hy, PX, PY); gr.addColorStop(0, 'rgba(255,248,230,.09)'); gr.addColorStop(1, 'rgba(255,248,230,0)');
    const px = -(L.z - tz), pz = L.x - tx, pl = Math.hypot(px, pz);
    g.fillStyle = gr; g.beginPath();
    quad(g, L.x - px / pl * 4, L.y, L.z - pz / pl * 4, L.x + px / pl * 4, L.y, L.z + pz / pl * 4, tx + px / pl * 30, 0, tz + pz / pl * 30, tx - px / pl * 30, 0, tz - pz / pl * 30); g.fill();
  }
  // motion trails + halos + anamorphic streaks + ghosts for the banks
  const cNow = stadiumCam(t), cPrev = stadiumCam(t - 0.045), prev = [];
  lookAt(cPrev[0], cPrev[1], cPrev[2], cPrev[3], cPrev[4], cPrev[5], cPrev[6]); applyShake(S, t - 0.045);
  for (const L of banks) prev.push(P(L.x, L.y, L.z) ? [PX, PY] : null);
  lookAt(cNow[0], cNow[1], cNow[2], cNow[3], cNow[4], cNow[5], cNow[6]); applyShake(S, t);
  const cx = W / 2, cy = H / 2;
  banks.forEach((L, i) => {
    if (!P(L.x, L.y, L.z)) return;
    const x = PX, y = PY, s = PS;
    if (prev[i]) { g.strokeStyle = 'rgba(220,240,255,.45)'; g.lineWidth = clamp(3 * s, 2, 22); g.lineCap = 'round'; g.beginPath(); g.moveTo(prev[i][0], prev[i][1]); g.lineTo(x, y); g.stroke(); }
    const on = clamp(1.3 - Math.hypot(x - cx, y - cy) / Math.hypot(W, H) * 1.6);
    sprite(g, S.spr.haloW, x, y, clamp(30 * s, 34, Math.max(W, H) * 0.45), 0.3);
    sprite(g, S.spr.flood, x, y, clamp(7 * s, 8, 60), 1);
    g.globalAlpha = 0.5 * on; const sw = W * 1.2, sh = clamp(2.4 * s, 6, 18); g.drawImage(S.spr.streak, x - sw / 2, y - sh / 2, sw, sh);
    [[0.42, 0.06, 0], [0.8, 0.03, 1], [1.3, 0.1, 2], [-0.3, 0.04, 1]].forEach(([f, r, ci]) => sprite(g, S.spr.ghost[ci], cx + (cx - x) * f, cy + (cy - y) * f, Math.max(W, H) * r, 0.16 * on));
  });
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ------------------------------------------------------------------ DOM overlay (logo, tagline, skip) */
const CSS = `
.hy-intro{position:fixed;inset:0;z-index:2147483000;background:#03060f;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;opacity:1;transition:opacity .35s ease;contain:strict}
.hy-intro.out{opacity:0;pointer-events:none}
.hy-intro canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.hy-intro-skip{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);left:12px;z-index:4;font:700 14px/1 Heebo,system-ui,sans-serif;color:#EEF4FF;background:rgba(8,21,48,.55);border:1px solid rgba(255,231,163,.38);border-radius:999px;padding:10px 16px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);cursor:pointer;letter-spacing:.02em;opacity:0;transition:opacity .4s ease}
.hy-intro-skip.on{opacity:1}
.hy-intro-skip:focus-visible{outline:2px solid #F4C35A;outline-offset:2px}
.hy-intro-cap{position:absolute;right:0;left:0;z-index:2;text-align:center;color:rgba(238,244,255,.86);font:500 14px/1.3 Heebo,system-ui,sans-serif;letter-spacing:0;opacity:0;pointer-events:none;direction:rtl}
.hy-intro-cap b{display:block;font:700 12px/1.6 Rubik,Heebo,system-ui,sans-serif;letter-spacing:0;color:rgba(244,195,90,.9)}
.hy-intro-logo{position:absolute;left:50%;top:46%;z-index:3;pointer-events:none;opacity:0;will-change:transform,opacity;transform-style:preserve-3d}
.hy-intro-logo .lg{position:absolute;inset:0}
.hy-intro-logo img{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 0 15% 0);-webkit-clip-path:inset(0 0 15% 0)}
.hy-intro-logo canvas.lgc{position:absolute;inset:0;width:100%;height:100%}
.hy-intro-logo .rib{position:absolute;left:17.6%;width:64.8%;top:86.26%;height:9.89%;clip-path:polygon(2.76% 0,100% 0,97.24% 100%,0 100%);-webkit-clip-path:polygon(2.76% 0,100% 0,97.24% 100%,0 100%);background:linear-gradient(172deg,#FFE7A3 0%,#F4C35A 38%,#C98E2B 74%,#F2CB6B 100%);display:flex;align-items:center;justify-content:center;direction:rtl;color:#0A1838;font-family:Rubik,Heebo,system-ui,sans-serif;font-weight:700;white-space:nowrap;transform-origin:100% 50%;transform:scaleX(0);box-shadow:0 8px 20px rgba(0,0,0,.45)}
.hy-intro-logo .rib i{font-style:normal;margin:0 .55em;opacity:0}
.hy-intro-logo .rib span{display:inline-block;opacity:0;white-space:pre}
.hy-intro-rm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(80% 60% at 50% 45%,#0b1e42 0%,#03060f 75%)}
.hy-intro-rm img{width:min(80vw,460px);height:auto;opacity:0;transition:opacity .4s ease}
`;
let cssDone = false;
function injectCSS() {
  if (cssDone) return; cssDone = true;
  const st = document.createElement('style'); st.id = 'hy-intro-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function buildDOM(root) {
  const cap = document.createElement('div'); cap.className = 'hy-intro-cap';
  cap.innerHTML = '<b>פרק 1</b>איפשהו בשכונה';
  const logo = document.createElement('div'); logo.className = 'hy-intro-logo'; logo.setAttribute('aria-hidden', 'true');
  // the logo is pre-rasterised into a canvas (no SVG raster hitch when it slams in; the light sweep is drawn into it)
  const img = new Image(); img.decoding = 'async'; img.src = LOGO_URL;
  const lgc = document.createElement('canvas'); lgc.className = 'lgc';
  const rib = document.createElement('div'); rib.className = 'rib';
  const chars = [];
  const s1 = document.createElement('i'); s1.textContent = '★'; rib.appendChild(s1);
  const box = document.createElement('div'); box.style.display = 'flex'; box.style.direction = 'rtl';
  for (const ch of TAGLINE) { const sp = document.createElement('span'); sp.textContent = ch === ' ' ? ' ' : ch; box.appendChild(sp); chars.push(sp); }
  rib.appendChild(box);
  const s2 = document.createElement('i'); s2.textContent = '★'; rib.appendChild(s2);
  const lg = document.createElement('div'); lg.className = 'lg'; lg.append(lgc, rib); logo.append(lg);
  const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'hy-intro-skip'; skip.dataset.testid = 'btn-intro-skip'; skip.innerHTML = 'דלג<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" style="margin-inline-start:6px;vertical-align:-1px"><path d="M7.6 2.2 3.8 6l3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; skip.setAttribute('aria-label', 'דלג על הפתיח');
  root.append(cap, logo, skip);
  const D = { cap, logo, img, lgc, rib, chars, stars: [s1, s2], skip, ready: false, base: null, sweep: -1 };
  const ready = () => { D.ready = true; D.base = null; };
  if (img.decode) img.decode().then(ready, () => { img.onload = ready; }); else img.onload = ready;
  return D;
}

function layoutDOM(S) {
  const D = S.dom, lw = Math.min(S.W * 0.88, 540, S.H * 0.58 * 560 / 364), lh = lw * 364 / 560;
  D.lw = lw; D.lh = lh; D.base = null;
  D.logo.style.width = lw + 'px'; D.logo.style.height = lh + 'px';
  D.logo.style.marginLeft = (-lw / 2) + 'px'; D.logo.style.marginTop = (-lh / 2) + 'px';
  D.rib.style.fontSize = (lh * 0.0989 * 0.5).toFixed(2) + 'px';
  const bar = S.H * 0.072;
  D.cap.style.bottom = Math.max(6, bar * 0.18) + 'px';
}

function drawLogo(S, sweep) {
  const D = S.dom; if (!D.ready) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.round(D.lw * dpr), ch = Math.round(D.lh * dpr);
  if (!D.base) {
    const b = cnv(cw, ch), bg = b.getContext('2d'), iw = D.img.naturalWidth || 560, ih = D.img.naturalHeight || 364;
    bg.drawImage(D.img, 0, 0, iw, ih * 0.85, 0, 0, cw, ch * 0.85);   // crest + name plate (the tagline ribbon is typed in DOM)
    D.base = b; D.lgc.width = cw; D.lgc.height = ch; D.sweep = -2;
  }
  const q = sweep < 0 ? -1 : Math.round(sweep * 60) / 60;
  if (q === D.sweep) return; D.sweep = q;
  const g = D.lgc.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, cw, ch); g.drawImage(D.base, 0, 0);
  if (q >= 0) {
    const x = lerp(-0.25, 1.25, q) * cw, gr = g.createLinearGradient(x - cw * 0.12, 0, x + cw * 0.12, ch * 0.35);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over';
  }
}

function updateDOM(S, t) {
  const D = S.dom;
  // caption in the lower letterbox
  const ca = sm(prog(t, 0.35, 0.75)) * (1 - sm(prog(t, 1.35, 1.6)));
  D.cap.style.opacity = ca.toFixed(3);
  // logo: slam with a 3D tilt, overshoot, then a slow float
  if (t < 5.58) { if (D.logo.style.opacity !== '0') D.logo.style.opacity = '0'; if (t > 1.5 && D.ready && !D.base) drawLogo(S, -1); return; }
  const a = prog(t, 5.6, 5.85), sh = shakeAmt(t), shx = Math.sin(t * 97) * sh * 0.6, shy = Math.cos(t * 83) * sh * 0.6;
  let sc, rx, ry, tz, op;
  if (t < 5.85) { const e = a * a * a; sc = lerp(3.1, 1, e); rx = lerp(62, 0, e); ry = lerp(-28, 0, e); tz = 0; op = clamp(a * 2.2); }
  else {
    const b = t - 5.85, wob = Math.exp(-b * 9) * Math.cos(b * 32);
    sc = 1 - 0.07 * wob; rx = Math.sin(b * 1.25) * 4 + 5 * wob; ry = Math.sin(b * 0.9 + 0.6) * 7 * sm(prog(b, 0.1, 0.8)); tz = 0; op = 1;
  }
  D.logo.style.opacity = op.toFixed(3);
  D.logo.style.transform = `translate3d(${shx.toFixed(1)}px,${shy.toFixed(1)}px,0) perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(${tz}px) scale(${sc.toFixed(4)})`;
  // light sweep
  const sw = prog(t, 6.15, 6.95);
  drawLogo(S, sw > 0 && sw < 1 ? eIO(sw) : -1);
  // tagline ribbon wipes in, then the letters type in (right to left)
  const ra = eOut(prog(t, 6.2, 6.45));
  D.rib.style.transform = `scaleX(${ra.toFixed(3)})`;
  D.stars.forEach((s) => { s.style.opacity = sm(prog(t, 6.4, 6.55)).toFixed(2); });
  const n = D.chars.length, typed = prog(t, 6.45, 7.1) * n;
  for (let i = 0; i < n; i++) {
    const k = clamp(typed - i), el = D.chars[i];
    const v = k.toFixed(2); if (el._k !== v) { el._k = v; el.style.opacity = v; el.style.transform = `translateY(${((1 - k) * -0.35).toFixed(3)}em) scale(${(1 + (1 - k) * 0.6).toFixed(3)})`; }
  }
}

/* ------------------------------------------------------------------ public API */
let active = null;
function flag(store, key, val) { try { if (val === undefined) return store.getItem(key); store.setItem(key, val); } catch { /* storage blocked */ } return null; }

/** True if the intro would auto-play now: on every app open, unless disabled by tests ('hy.intro.skip'). */
export function introWanted() {
  if (flag(localStorage, 'hy.intro.skip') === '1') return false;
  return true;
}
export function isIntroPlaying() { return !!active; }

/**
 * Play the opening cinematic. Resolves when it has finished or was skipped (never rejects).
 * Resolves { done: boolean } (true = watched to the end, false = skipped / failed); never rejects.
 * opts.force: play even when disabled by the test flag. opts.gender: 'm' | 'f' (hair of the kid).
 * opts.debug: start paused at t=0 and keep the overlay until finish() (frame capture).
 */
export function playIntro(opts = {}) {
  const { force = false, debug = false } = opts;
  if (active) return active.promise;
  if (!force && !introWanted()) return Promise.resolve({ done: false, skipped: true, off: true });
  if (!debug) { flag(localStorage, 'hy.intro.seen', '1'); flag(sessionStorage, 'hy.intro.session', '1'); }
  let resolve; const promise = new Promise((r) => { resolve = r; });
  try { start(opts, resolve); } catch (e) { console.warn('[intro] failed, skipping', e); cleanupDOM(); active = null; resolve({ done: false, skipped: false, failed: true }); }
  if (active) active.promise = promise;
  return promise;
}

function cleanupDOM() { document.querySelectorAll('.hy-intro').forEach((n) => n.remove()); }

function reducedMotion() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

function start(opts, resolve) {
  if (typeof document === 'undefined' || !document.body) { resolve({ done: false, skipped: false, failed: true }); return; }
  injectCSS();
  const root = document.createElement('div'); root.className = 'hy-intro'; root.dataset.testid = 'intro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'פתיח: הילד מהשכונה');
  const listeners = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); listeners.push([el, ev, fn, o]); };
  let done = false, raf = 0, timer = 0, statsFn = null;
  const S = { gender: opts.gender === 'f' ? 'f' : 'm', lowQ: false };
  // failed=true: the cinematic could not render (resolves done:false, failed:true so it is not counted as watched)
  const finish = (fade, skipped = fade, failed = false) => {
    if (done) return; done = true;
    cancelAnimationFrame(raf); clearTimeout(timer);
    for (const [el, ev, fn, o] of listeners) el.removeEventListener(ev, fn, o);
    if (S.audio) S.audio.stop();
    try { if (statsFn) window.__introLastStats = statsFn(); } catch { /* ignore */ }
    if (window.__introDebug && window.__introDebug._owner === root) delete window.__introDebug;
    const end = () => { root.remove(); active = null; resolve(failed ? { done: false, skipped: false, failed: true } : { done: !skipped, skipped: !!skipped }); };
    if (fade) { root.classList.add('out'); setTimeout(end, 360); } else end();
  };
  active = { finish, promise: null };

  // reduced motion: a quiet 1.5 s logo reveal
  if (reducedMotion() && !opts.debug) {
    const wrap = document.createElement('div'); wrap.className = 'hy-intro-rm';
    const img = new Image(); img.alt = 'הילד מהשכונה'; img.src = LOGO_URL; wrap.appendChild(img); root.appendChild(wrap);
    document.body.appendChild(root);
    requestAnimationFrame(() => { img.style.opacity = '1'; });
    on(root, 'pointerdown', () => finish(true)); on(window, 'keydown', (e) => { if (e.key === 'Escape') finish(true); });
    timer = setTimeout(() => { root.classList.add('out'); timer = setTimeout(() => finish(false), 380); }, 1120);
    return;
  }

  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext && canvas.getContext('2d', { alpha: false });
  if (!g || typeof g.createPattern !== 'function' || typeof DOMMatrix === 'undefined') { active = null; resolve({ done: false, skipped: false, failed: true }); return; }
  root.appendChild(canvas);
  S.g = g; S.canvas = canvas; S.dom = buildDOM(root);
  document.body.appendChild(root);

  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  S.maxDpr = lowEnd ? 1.25 : 1.5; S.lowQ = lowEnd && !opts.debug;
  const resize = () => {
    const W = Math.max(1, root.clientWidth || window.innerWidth), H = Math.max(1, root.clientHeight || window.innerHeight);
    S.W = W; S.H = H; S.dpr = Math.min(window.devicePixelRatio || 1, S.maxDpr);
    canvas.width = Math.round(W * S.dpr); canvas.height = Math.round(H * S.dpr);
    S.f = 0.55 * Math.hypot(W, H); ASPECT = W / H;
    makeVignette(S); layoutDOM(S);
  };
  makeSprites(S);
  S.hood = buildHood();
  S.courtImg = courtTexture(); S.courtPat = g.createPattern(S.courtImg, 'no-repeat');
  resize();
  S.builder = stadiumBuilderGen(S);

  const st = { t: 0, playing: !opts.debug, last: performance.now(), dts: [], ts: [], drawn: 0, perf: {} };
  // v2.3 review: a returning player (or a challenge link) starts near the logo: about 3 s (2 s) instead of 8
  if (!opts.debug && Number(opts.startAt) > 0) { st.t = clamp(Number(opts.startAt), 0, DUR - 1); if (st.t >= 4.2 && S.builder) { while (!S.builder.next().done); S.builder = null; } }
  const draw = () => {
    try {
      g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const p0 = performance.now();
      if (st.t < 4.2) renderHood(S, st.t); else renderStadium(S, st.t);
      const p1 = performance.now();
      g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      post(S, st.t);
      const p2 = performance.now();
      updateDOM(S, st.t);
      const k = st.t < 4.2 ? 'hood' : st.t < 5.6 ? 'stadium' : 'logo', pf = st.perf[k] || (st.perf[k] = [0, 0, 0, 0]);
      pf[0] += p1 - p0; pf[1] += p2 - p1; pf[2] += performance.now() - p2; pf[3]++;
      st.drawn++;
    } catch (e) { console.warn('[intro] render error, skipping', e); finish(false, false, true); }
  };
  const frame = (now) => {
    if (done) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - st.last) / 1000; st.last = now;
    if (dt > 0.25) dt = 1 / 60;               // tab was hidden: resume instead of jumping
    if (st.playing) {
      st.t += dt; st.dts.push(dt); st.ts.push(st.t);
      // adaptive quality: drop resolution if the device cannot keep up
      if (st.dts.length >= 40 && st.dts.length % 20 === 0 && (S.dpr > 1 || !S.lowQ)) {
        const win = st.dts.slice(-30);
        const avg = win.reduce((a, b) => a + b, 0) / win.length;
        const long = win.filter((x) => x > 0.034).length;
        if (avg > 0.0215 || long >= 4) { if (S.dpr > 1) { S.maxDpr = 1; resize(); } S.lowQ = true; }
      }
    }
    // build the stadium a slice per frame while the neighbourhood plays
    if (S.builder && st.t < 4.2) { const r0 = performance.now(); while (performance.now() - r0 < 4) { if (S.builder.next().done) { S.builder = null; break; } } }
    else if (S.builder) { while (!S.builder.next().done); S.builder = null; }
    if (!S.builder && S.ST && !S.warm) { S.warmQ = S.warmQ || [S.ST.pitch, ...S.ST.mips.flat()]; g.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 3 && S.warmQ.length; i++) g.drawImage(S.warmQ.shift(), 0, 0, 2, 2); if (!S.warmQ.length) S.warm = true; }
    draw();
    if (st.t > 0.5 && !S.dom.skip.classList.contains('on')) S.dom.skip.classList.add('on');
    if (st.t >= DUR - 0.55 && !root.classList.contains('out') && !opts.debug) root.classList.add('out');
    if (st.t >= DUR && !opts.debug) finish(false);
  };
  on(window, 'resize', resize);
  on(S.dom.skip, 'click', (e) => { e.stopPropagation(); finish(true); });
  on(root, 'pointerdown', (e) => { if (e.target === S.dom.skip || opts.debug) return; if (st.t > 0.5) finish(true); });
  on(window, 'keydown', (e) => { if (e.key === 'Escape') finish(true); });
  S.audio = makeAudio();
  if (S.audio && !opts.debug) S.audio.tryStart(() => st.t);

  const dbg = {
    _owner: root,
    seek(t) { st.t = clamp(+t || 0, 0, DUR); st.playing = false; if (st.t >= 4.2 && S.builder) { while (!S.builder.next().done); S.builder = null; } draw(); return st.t; },
    play() { st.playing = true; st.last = performance.now(); },
    pause() { st.playing = false; },
    get t() { return st.t; },
    stats() {
      const d = st.dts.slice(5), n = d.length, sum = d.reduce((a, b) => a + b, 0), sorted = d.slice().sort((a, b) => a - b);
      const ph = (a, b) => { let c = 0, s2 = 0; st.ts.forEach((tt, i) => { if (i >= 5 && tt >= a && tt < b) { c++; s2 += st.dts[i]; } }); return c ? +(c / s2).toFixed(1) : 0; };
      const perf = {}; for (const k in st.perf) { const v = st.perf[k]; perf[k] = { scene: +(v[0] / v[3]).toFixed(2), post: +(v[1] / v[3]).toFixed(2), dom: +(v[2] / v[3]).toFixed(2) }; }
      let wi = 5; for (let i = 5; i < st.dts.length; i++) if (st.dts[i] > st.dts[wi]) wi = i;
      return { worstAt: +(st.ts[wi] || 0).toFixed(2), perf, phases: { hood: ph(0, 4.2), stadium: ph(4.2, 5.6), logo: ph(5.6, 8) }, frames: n, fps: n ? n / sum : 0, p95ms: n ? sorted[Math.floor(n * 0.95)] * 1000 : 0, worstMs: n ? sorted[n - 1] * 1000 : 0, dpr: S.dpr, lowQ: S.lowQ, W: S.W, H: S.H };
    },
    finish() { finish(false); },
  };
  window.__introDebug = dbg; statsFn = dbg.stats;
  raf = requestAnimationFrame((now) => { st.last = now; frame(now); });
}

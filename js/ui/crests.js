// crests.js: original, procedurally drawn club crests and national-team shields (contract C6).
// Pure string builders (no DOM access) so they also run under Node. Every design is deterministic
// from team.id (FNV hash -> seeded picks), optionally overridden per club in crest-data.js.
// All artwork is original and stylised; nothing here copies a real club trademark.
//
//   crestSVG(team, size = 40, opts?)  -> '<svg ...>' string   (team: { id, nameHe, shortHe, colors, flag?, nation? })
//   crestFor(teamLike, size = 40, opts?) -> same, but accepts an id string or loose objects ({ teamId, teamHe, ... })
//   crestDataURL(team, size)          -> 'data:image/svg+xml,...' (for <img> / canvas drawImage)
//   crestStyle(team)                  -> the resolved style object (debug / preview)
//   opts: { shadow = true, title = '' (accessible label; default decorative aria-hidden), cls = '' }
import { CREST_STYLES, FLAG_SPECS, MONO_OVERRIDES } from './crest-data.js';

/* ------------------------------------------------------------------ utils */
let UID = 0;
const uid = () => 'k' + (++UID).toString(36);

export function hashStr(s) {
  let h = 0x811c9dc5;
  const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rngFrom(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickW(r, table) { // table: [[value, weight], ...]
  let tot = 0;
  for (const [, w] of table) tot += w;
  let x = r() * tot;
  for (const [v, w] of table) { x -= w; if (x <= 0) return v; }
  return table[table.length - 1][0];
}
const f1 = (n) => (Math.round(n * 100) / 100).toString();
export function escXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ----------------------------------------------------------------- colour */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function normHex(c, d = '#24304d') {
  if (typeof c !== 'string' || !HEX.test(c.trim())) return d;
  let h = c.trim().slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return '#' + h.toUpperCase();
}
function rgb(hex) { const h = normHex(hex).slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function toHex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
export function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
export const shade = (c, t) => (t >= 0 ? mix(c, '#FFFFFF', t) : mix(c, '#000000', -t));
export function lum(c) {
  const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const rgbDist = (a, b) => { const A = rgb(a), B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Most legible of the candidates against bg. */
function bestOn(bg, cands) { let best = cands[0], bc = 0; for (const c of cands) { const k = contrast(bg, c); if (k > bc) { bc = k; best = c; } } return best; }
const isLight = (c) => lum(c) > 0.42;

const GOLD = ['#FFF1C1', '#F6CF6A', '#C8902E', '#8A5A12', '#F9DC8C'];
const SILVER = ['#FFFFFF', '#DCE3EE', '#9AA7BA', '#5D6A80', '#EEF2F8'];
const BRONZE = ['#FFE3C4', '#E2A266', '#A9642C', '#6B3A12', '#F1C08F'];
const INK = '#0A1226';

/* ----------------------------------------------------------------- shapes */
// Each shape: box -> path. Boxes are in a 100x100 viewBox. `inset(t)` shrinks the box so rims stay even.
const SHAPES = {
  heater: {
    box: [9, 5, 91, 96],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, r = Math.min(w, h) * 0.07;
      return `M${f1(x0)} ${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}L${f1(x1 - r)} ${f1(y0)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}`
        + `L${f1(x1)} ${f1(y0 + h * 0.46)}C${f1(x1)} ${f1(y0 + h * 0.76)} ${f1(cx + w * 0.24)} ${f1(y0 + h * 0.9)} ${f1(cx)} ${f1(y1)}`
        + `C${f1(cx - w * 0.24)} ${f1(y0 + h * 0.9)} ${f1(x0)} ${f1(y0 + h * 0.76)} ${f1(x0)} ${f1(y0 + h * 0.46)}Z`;
    },
    tip: 1.5, chief: 0.3, center: [50, 47],
  },
  pointed: {
    box: [9, 3, 91, 97],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
      return `M${f1(x0)} ${f1(y0 + h * 0.11)}Q${f1(cx - w * 0.22)} ${f1(y0 + h * 0.1)} ${f1(cx)} ${f1(y0)}Q${f1(cx + w * 0.22)} ${f1(y0 + h * 0.1)} ${f1(x1)} ${f1(y0 + h * 0.11)}`
        + `L${f1(x1)} ${f1(y0 + h * 0.5)}Q${f1(x1)} ${f1(y0 + h * 0.8)} ${f1(cx)} ${f1(y1)}Q${f1(x0)} ${f1(y0 + h * 0.8)} ${f1(x0)} ${f1(y0 + h * 0.5)}Z`;
    },
    tip: 1.7, chief: 0.34, center: [50, 50],
  },
  round: {
    box: [6, 6, 94, 94],
    d(x0, y0, x1, y1) {
      const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, cx = x0 + rx;
      return `M${f1(cx)} ${f1(y0)}A${f1(rx)} ${f1(ry)} 0 1 1 ${f1(cx)} ${f1(y1)}A${f1(rx)} ${f1(ry)} 0 1 1 ${f1(cx)} ${f1(y0)}Z`;
    },
    tip: 1, chief: 0.3, center: [50, 50], round: true,
  },
  hex: {
    box: [11, 3, 89, 97],
    d(x0, y0, x1, y1) {
      const h = y1 - y0, cx = (x0 + x1) / 2;
      return `M${f1(cx)} ${f1(y0)}L${f1(x1)} ${f1(y0 + h * 0.24)}L${f1(x1)} ${f1(y0 + h * 0.76)}L${f1(cx)} ${f1(y1)}L${f1(x0)} ${f1(y0 + h * 0.76)}L${f1(x0)} ${f1(y0 + h * 0.24)}Z`;
    },
    tip: 1.3, chief: 0.34, center: [50, 50],
  },
  spanish: {
    box: [13, 4, 87, 96],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, r = w * 0.06;
      return `M${f1(x0)} ${f1(y0 + r)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + r)} ${f1(y0)}L${f1(x1 - r)} ${f1(y0)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + r)}`
        + `L${f1(x1)} ${f1(y0 + h * 0.6)}C${f1(x1)} ${f1(y1 + h * 0.02)} ${f1(x0)} ${f1(y1 + h * 0.02)} ${f1(x0)} ${f1(y0 + h * 0.6)}Z`;
    },
    tip: 1.1, chief: 0.28, center: [50, 50],
  },
  scudetto: {
    box: [10, 5, 90, 96],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
      return `M${f1(x0)} ${f1(y0)}Q${f1(cx)} ${f1(y0 + h * 0.08)} ${f1(x1)} ${f1(y0)}`
        + `C${f1(x1 + w * 0.03)} ${f1(y0 + h * 0.3)} ${f1(x1 - w * 0.02)} ${f1(y0 + h * 0.66)} ${f1(cx)} ${f1(y1)}`
        + `C${f1(x0 + w * 0.02)} ${f1(y0 + h * 0.66)} ${f1(x0 - w * 0.03)} ${f1(y0 + h * 0.3)} ${f1(x0)} ${f1(y0)}Z`;
    },
    tip: 1.6, chief: 0.3, center: [50, 45],
  },
  modern: {
    box: [9, 4, 91, 96],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
      return `M${f1(x0 + w * 0.15)} ${f1(y0)}L${f1(x1 - w * 0.15)} ${f1(y0)}L${f1(x1)} ${f1(y0 + h * 0.11)}L${f1(x1)} ${f1(y0 + h * 0.6)}`
        + `L${f1(cx)} ${f1(y1)}L${f1(x0)} ${f1(y0 + h * 0.6)}L${f1(x0)} ${f1(y0 + h * 0.11)}Z`;
    },
    tip: 1.5, chief: 0.3, center: [50, 47],
  },
  french: {
    box: [10, 5, 90, 96],
    d(x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
      return `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y0)}L${f1(x1)} ${f1(y0 + h * 0.72)}Q${f1(x1)} ${f1(y0 + h * 0.88)} ${f1(cx + w * 0.26)} ${f1(y0 + h * 0.88)}`
        + `Q${f1(cx + w * 0.06)} ${f1(y0 + h * 0.88)} ${f1(cx)} ${f1(y1)}Q${f1(cx - w * 0.06)} ${f1(y0 + h * 0.88)} ${f1(cx - w * 0.26)} ${f1(y0 + h * 0.88)}`
        + `Q${f1(x0)} ${f1(y0 + h * 0.88)} ${f1(x0)} ${f1(y0 + h * 0.72)}Z`;
    },
    tip: 1.2, chief: 0.3, center: [50, 46],
  },
};
export const CREST_SHAPES = Object.keys(SHAPES);

function shapePath(name, inset = 0) {
  const s = SHAPES[name] || SHAPES.heater;
  const [x0, y0, x1, y1] = s.box;
  return s.d(x0 + inset, y0 + inset, x1 - inset, y1 - inset * s.tip);
}
function fieldBox(name, inset) {
  const s = SHAPES[name] || SHAPES.heater;
  const [x0, y0, x1, y1] = s.box;
  return [x0 + inset, y0 + inset, x1 - inset, y1 - inset * s.tip];
}

/* --------------------------------------------------------------- patterns */
// Painted over the field box; the caller clips to the field shape. innerPath: field shape inset (for bordure).
function patternMarkup(name, a, b, [x0, y0, x1, y1], innerPath) {
  const W = x1 - x0, H = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const R = (x, y, w, h, c) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${c}"/>`;
  let out = R(x0 - 2, y0 - 2, W + 4, H + 4, a);
  switch (name) {
    case 'halves': out += R(cx, y0 - 2, W / 2 + 2, H + 4, b); break;
    case 'quarters': out += R(cx, y0 - 2, W / 2 + 2, H * 0.48 + 2, b) + R(x0 - 2, y0 + H * 0.48, W / 2 + 2, H * 0.52 + 2, b); break;
    case 'stripes': case 'tri': {
      const n = name === 'tri' ? 3 : 7, sw = W / n;
      for (let i = 0; i < n; i++) if (i % 2 === 1) out += R(x0 + i * sw, y0 - 2, sw, H + 4, b);
      break;
    }
    case 'pinstripe': { const n = 8, sw = W / n; for (let i = 1; i < n; i++) out += R(x0 + i * sw - 0.8, y0 - 2, 1.6, H + 4, b); break; }
    case 'hoops': { const n = 7, sh = H / n; for (let i = 0; i < n; i++) if (i % 2 === 1) out += R(x0 - 2, y0 + i * sh, W + 4, sh, b); break; }
    case 'sash': { const t = 12; out += `<path d="M${f1(x0 - 4)} ${f1(y0 + t)}L${f1(x0 + t)} ${f1(y0 - 4)}L${f1(x1 + 4)} ${f1(y1 - t)}L${f1(x1 - t)} ${f1(y1 + 4)}Z" fill="${b}"/>`; break; }
    case 'bend': out += `<path d="M${f1(x1 + 2)} ${f1(y0 - 2)}L${f1(x1 + 2)} ${f1(y1 + 2)}L${f1(x0 - 2)} ${f1(y1 + 2)}Z" fill="${b}"/>`; break;
    case 'chevron': { const t = 10, yy = y0 + H * 0.4; out += `<path d="M${f1(x0 - 4)} ${f1(yy + H * 0.44)}L${f1(cx)} ${f1(yy)}L${f1(x1 + 4)} ${f1(yy + H * 0.44)}L${f1(x1 + 4)} ${f1(yy + H * 0.44 + t)}L${f1(cx)} ${f1(yy + t)}L${f1(x0 - 4)} ${f1(yy + H * 0.44 + t)}Z" fill="${b}"/>`; break; }
    case 'chequers': { const s = W / 6; for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) if ((i + j) % 2) out += R(x0 + i * s, y0 + j * s, s, s, b); break; }
    case 'lozenge': { // diamond chequer: `a` diamonds on a `b` ground
      const s = 12, hs = s / 2; let d = '';
      out = R(x0 - 2, y0 - 2, W + 4, H + 4, b);
      for (let j = 0; j * s <= H + s; j++) for (let i = 0; i * s <= W + s; i++) {
        const px = x0 + i * s, py = y0 + j * s;
        d += `M${f1(px)} ${f1(py - hs)}L${f1(px + hs)} ${f1(py)}L${f1(px)} ${f1(py + hs)}L${f1(px - hs)} ${f1(py)}Z`;
      }
      out += `<path d="${d}" fill="${a}"/>`; break;
    }
    case 'cross': { const t = 11; out += R(cx - t / 2, y0 - 2, t, H + 4, b) + R(x0 - 2, cy - 6 - t / 2, W + 4, t, b); break; }
    case 'bordure': out = R(x0 - 2, y0 - 2, W + 4, H + 4, b) + (innerPath ? `<path d="${innerPath}" fill="${a}"/>` : ''); break;
    case 'fess': out += R(x0 - 2, y0 + H * 0.4, W + 4, H * 0.2, b); break;
    case 'centre': out += R(cx - W * 0.17, y0 - 2, W * 0.34, H + 4, b); break;
    default: break; // solid
  }
  return out;
}
export const CREST_PATTERNS = ['solid', 'halves', 'quarters', 'stripes', 'tri', 'pinstripe', 'hoops', 'sash', 'bend', 'chevron', 'chequers', 'lozenge', 'cross', 'bordure', 'centre', 'fess'];

/* ---------------------------------------------------------------- symbols */
// Symbols live in a local 0..100 box. Each part: { d, t } filled with tone t, or { d, st } stroked.
// Tones: 's' main symbol colour, 'd' detail (dark ink), 'a' accent (metal), 'k' knock-out (= field colour).
const P = (pts) => 'M' + pts.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L') + 'Z';
const mirror = (half) => half.concat(half.slice(1, -1).reverse().map(([x, y]) => [100 - x, y]));
const mirrorPts = (pts) => pts.map(([x, y]) => [100 - x, y]);
const circ = (cx, cy, r) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
function starPts(cx, cy, R, r, n, rot = -90) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = ((rot + (i * 180) / n) * Math.PI) / 180, rad = i % 2 ? r : R;
    out.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  return out;
}
function rotPts(pts, deg, cx = 50, cy = 50) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
function polyN(cx, cy, r, n, rot = -90) { const o = []; for (let i = 0; i < n; i++) { const a = ((rot + (i * 360) / n) * Math.PI) / 180; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }

const SYMBOLS = {
  star: () => [{ d: P(starPts(50, 53, 47, 19, 5)), t: 's' }],
  star6: () => [{ d: P(starPts(50, 50, 47, 27.1, 6)), t: 's' }, { d: P(polyN(50, 50, 13, 6, 0)), t: 'k' }],
  ball: () => {
    const R = 44, parts = [{ d: circ(50, 50, R), t: 's' }];
    const c = polyN(50, 50, 15.5, 5);
    parts.push({ d: P(c), t: 'd' });
    const clamp = ([x, y]) => { const dx = x - 50, dy = y - 50, r = Math.hypot(dx, dy); return r > R - 0.6 ? [50 + dx / r * (R - 0.6), 50 + dy / r * (R - 0.6)] : [x, y]; };
    let seams = '';
    for (let i = 0; i < 5; i++) {
      const ang = -90 + i * 72, rad = (ang * Math.PI) / 180;
      const pent = polyN(50 + Math.cos(rad) * 40, 50 + Math.sin(rad) * 40, 13.5, 5, ang + 180).map(clamp);
      parts.push({ d: P(pent), t: 'd' });
      const [vx, vy] = c[i];
      seams += `M${f1(vx)} ${f1(vy)}L${f1(50 + Math.cos(rad) * 28.6)} ${f1(50 + Math.sin(rad) * 28.6)}`;
      const r2 = ((ang + 36) * Math.PI) / 180;
      seams += `M${f1(50 + Math.cos(r2) * 30)} ${f1(50 + Math.sin(r2) * 30)}L${f1(50 + Math.cos(r2) * R)} ${f1(50 + Math.sin(r2) * R)}`;
    }
    parts.push({ d: seams, st: 2.2, t: 'd' });
    return parts;
  },
  crown: () => [
    { d: 'M18 70L9 30L31 47L50 16L69 47L91 30L82 70Z', t: 's' },
    { d: 'M16 72H84Q86 72 86 74V84Q86 86 84 86H16Q14 86 14 84V74Q14 72 16 72Z', t: 's' },
    { d: circ(9, 28, 5.5) + circ(50, 14, 6) + circ(91, 28, 5.5), t: 's' },
    { d: circ(32, 79, 3.4) + circ(68, 79, 3.4), t: 'd' }, { d: P(polyN(50, 79, 4.6, 4)), t: 'd' },
    { d: 'M18 66H82', st: 2.2, t: 'd' },
  ],
  lion: () => {
    let mane = circ(50, 52, 37);
    for (let i = 0; i < 14; i++) { const a = (i * 360 / 14 - 90) * Math.PI / 180; mane += circ(50 + Math.cos(a) * 35, 52 + Math.sin(a) * 37, 10.5); }
    const eye = [[33, 44], [44, 46], [43, 50], [35, 48]];
    return [
      { d: mane, t: 'm' },
      { d: circ(31, 25, 7.5) + circ(69, 25, 7.5), t: 's', k: 'd', sw: 2.6 },
      { d: P(mirror([[50, 21], [38, 23], [29, 31], [27, 43], [30, 55], [36, 65], [41, 76], [50, 81]])), t: 's', k: 'd', sw: 3 },
      { d: circ(44, 68, 7.4) + circ(56, 68, 7.4), t: 's', k: 'd', sw: 2 },
      { d: P(eye) + P(mirrorPts(eye)), t: 'd' },
      { d: 'M43 59H57L50 67Z', t: 'd' },
      { d: 'M50 67V72M45 79Q50 82 55 79M36 39Q41 36 46 39M54 39Q59 36 64 39', st: 2.2, t: 'd' },
    ];
  },
  eagle: () => [
    { d: P(mirror([[50, 12], [45, 14], [43, 21], [44, 27], [38, 29], [30, 23], [18, 15], [3, 12], [10, 21], [3, 27], [12, 31], [5, 39], [16, 41], [9, 49], [22, 49], [17, 57], [30, 55], [38, 53], [40, 65], [33, 77], [29, 89], [40, 84], [45, 91], [50, 85]])), t: 's' },
    { d: P([[46.5, 22], [53.5, 22], [50, 29]]), t: 'd' },
    { d: circ(46.6, 18, 1.7) + circ(53.4, 18, 1.7), t: 'd' },
    { d: 'M38 36L30 44M62 36L70 44M41 44L36 50M59 44L64 50', st: 2, t: 'd' },
  ],
  castle: () => [
    { d: 'M14 90V36H22V42H28V36H36V90Z M64 90V36H72V42H78V36H86V90Z', t: 's' },
    { d: 'M35 90V20H36V12H43.5V20H46.5V12H53.5V20H56.5V12H64V20H65V90Z', t: 's' },
    { d: 'M42 90V73A8 8 0 0 1 58 73V90Z', t: 'd' },
    { d: 'M47 31A3 3 0 0 1 53 31V41H47Z M21 56A2.5 2.5 0 0 1 26 56V65H21Z M74 56A2.5 2.5 0 0 1 79 56V65H74Z', t: 'd' },
    { d: 'M14 90H86', st: 3, t: 'd' },
  ],
  anchor: () => [
    { d: circ(50, 15, 8), st: 6, t: 's' },
    { d: 'M50 23V86M31 35H69M16 60Q19 87 50 88Q81 87 84 60', st: 7.5, t: 's' },
    { d: P([[7, 66], [16, 50], [25, 66]]) + P([[75, 66], [84, 50], [93, 66]]), t: 's' },
  ],
  ship: () => [
    { d: 'M9 64H91L79 84H21Z', t: 's' },
    { d: 'M50 9V64', st: 3.4, t: 's' },
    { d: 'M54 15Q75 36 81 59H54Z M46 21Q30 40 22 59H46Z', t: 's' },
    { d: 'M50 9L64 13L50 18Z', t: 's' },
    { d: 'M8 93Q16 87 24 93T40 93T56 93T72 93T88 93', st: 3.4, t: 's' },
    { d: 'M24 72H76', st: 2, t: 'd' },
  ],
  sun: () => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180, b1 = a - 0.16, b2 = a + 0.16;
      d += P([[50 + Math.cos(b1) * 27, 50 + Math.sin(b1) * 27], [50 + Math.cos(a) * 48, 50 + Math.sin(a) * 48], [50 + Math.cos(b2) * 27, 50 + Math.sin(b2) * 27]]);
    }
    return [{ d, t: 's' }, { d: circ(50, 50, 22), t: 's' }, { d: circ(50, 50, 15), st: 2.4, t: 'd' }];
  },
  wolf: () => [
    { d: P(mirror([[50, 33], [42, 30], [37, 19], [30, 5], [26, 22], [20, 34], [9, 43], [17, 49], [10, 57], [22, 61], [29, 71], [39, 83], [50, 94]])), t: 's' },
    { d: P([[31, 13], [28, 26], [36, 27]]) + P(mirrorPts([[31, 13], [28, 26], [36, 27]])), t: 'd' },
    { d: P([[32, 45], [44, 50], [42, 54], [35, 51]]) + P(mirrorPts([[32, 45], [44, 50], [42, 54], [35, 51]])), t: 'd' },
    { d: P([[44, 82], [56, 82], [50, 89]]), t: 'd' },
    { d: 'M50 40L45 60L50 74L55 60Z', t: 'd', o: 0.35 },
  ],
  bull: () => {
    const horn = [[38, 25], [28, 24], [18, 20], [10, 13], [5, 3], [7, 14], [13, 24], [23, 31], [36, 33]];
    return [
      { d: P(horn) + P(mirrorPts(horn)), t: 's' },
      { d: P(mirror([[50, 23], [39, 25], [31, 31], [15, 32], [24, 41], [32, 43], [34, 62], [37, 79], [43, 90], [50, 92]])), t: 's' },
      { d: P([[33, 47], [44, 51], [42, 55], [35, 52]]) + P(mirrorPts([[33, 47], [44, 51], [42, 55], [35, 52]])), t: 'd' },
      { d: circ(45, 84, 2.8) + circ(55, 84, 2.8), t: 'd' },
      { d: 'M40 76Q50 72 60 76', st: 2, t: 'd' },
    ];
  },
  horse: () => [
    { d: 'M66 93H27C29 81 35 72 43 64L36 62C30 66 23 66 19 62C15 58 17 51 21 47L35 30C40 24 46 20 52 18L54 7L63 16C77 22 85 38 83 56C81 72 74 83 66 93Z', t: 's' },
    { d: 'M62 18C73 26 79 42 77 60C76 70 72 78 68 86', st: 3.2, t: 'd' },
    { d: circ(43, 33, 2.8), t: 'd' }, { d: circ(23.5, 55, 2), t: 'd' },
    { d: 'M30 61Q36 58 42 60', st: 1.8, t: 'd' },
  ],
  cross: () => {
    const arm = [[45, 44], [55, 44], [65, 7], [35, 7]];
    let d = '';
    for (let i = 0; i < 4; i++) d += P(rotPts(arm, i * 90));
    return [{ d: d + P([[44, 44], [56, 44], [56, 56], [44, 56]]), t: 's' }, { d: P(polyN(50, 50, 5, 4, 0)), t: 'k' }];
  },
  tree: () => [
    { d: 'M44 74H56V93H44Z', t: 's' },
    { d: 'M50 4L75 35H63L82 57H69L89 80H11L31 57H18L37 35H25Z', t: 's' },
    { d: 'M50 16V70M50 40L40 50M50 55L36 66M50 30L58 38M50 48L63 60', st: 2, t: 'd', o: 0.45 },
  ],
  wave: () => [{ d: 'M8 32Q19 20 30 32T52 32T74 32T96 32M8 52Q19 40 30 52T52 52T74 52T96 52M8 72Q19 60 30 72T52 72T74 72T96 72', st: 8, t: 's' }],
  lightning: () => [{ d: 'M61 3L20 56H46L35 97L81 39H55L69 3Z', t: 's' }],
  cannon: () => [
    { d: 'M9 47L75 30Q86 27 89 38Q91 49 80 51L14 61Q7 57 9 47Z', t: 's' },
    { d: circ(41, 66, 19), t: 's' },
    { d: circ(41, 66, 12), st: 2.6, t: 'd' }, { d: circ(41, 66, 4), t: 'd' },
    { d: 'M41 47V85M22 66H60M28 53L54 79M54 53L28 79', st: 1.6, t: 'd' },
    { d: 'M78 32L82 50', st: 2.4, t: 'd' },
  ],
  bird: () => [
    { d: 'M7 41C23 31 35 35 45 49C51 31 65 16 93 13C77 24 67 36 63 52C71 54 79 58 85 66C71 66 61 66 53 64C47 76 35 84 18 86C28 76 34 68 36 60C26 56 16 50 7 41Z', t: 's' },
    { d: circ(77, 60, 2), t: 'd' },
    { d: 'M52 40Q60 30 74 22M48 66Q42 74 30 80', st: 1.8, t: 'd', o: 0.6 },
  ],
  clover: () => [
    { d: 'M50 58Q53 78 64 92', st: 7, t: 's' },
    { d: circ(50, 27, 17) + circ(28, 50, 17) + circ(72, 50, 17) + circ(50, 47, 11), t: 's' },
    { d: 'M50 44V12M47 47L14 52M53 47L86 52', st: 1.8, t: 'd', o: 0.45 },
  ],
  flame: () => [
    { d: 'M50 4C59 23 77 34 77 58C77 79 65 94 50 94C35 94 23 79 23 60C23 46 31 37 36 29C38 42 42 48 48 51C43 36 44 19 50 4Z', t: 's' },
    { d: 'M50 51C57 61 64 67 62 79C60 87 56 91 50 91C44 91 38 85 38 77C38 67 46 62 50 51Z', t: 'a' },
  ],
  torch: () => [
    { d: 'M41 57H59L54 95H46Z', t: 's' },
    { d: 'M32 47H68L62 60H38Z', t: 's' },
    { d: 'M50 4C56 16 66 22 66 34C66 42 59 46 50 46C41 46 34 42 34 34C34 26 40 22 42 16C44 23 46 26 49 27C46 18 46 11 50 4Z', t: 'a' },
    { d: 'M44 70H56M45 80H55', st: 2, t: 'd' },
  ],
  menorah: () => {
    let d = 'M50 20V82';
    for (let k = 1; k <= 3; k++) d += `M${50 - 12.5 * k} 20A${12.5 * k} ${14 * k} 0 0 0 ${50 + 12.5 * k} 20`;
    let fl = '';
    for (let k = -3; k <= 3; k++) fl += `M${50 + 12.5 * k} 7Q${54.5 + 12.5 * k} 12 ${50 + 12.5 * k} 17Q${45.5 + 12.5 * k} 12 ${50 + 12.5 * k} 7Z`;
    return [{ d, st: 5, t: 's' }, { d: 'M33 94H67L60 81H40Z', t: 's' }, { d: fl, t: 'a' }];
  },
  trident: () => [
    { d: 'M50 26V95M27 18V34Q27 45 50 45Q73 45 73 34V18', st: 6.5, t: 's' },
    { d: 'M50 4L58 22H42Z M27 8L33 22H21Z M73 8L79 22H67Z', t: 's' },
  ],
  crescent: () => [
    { d: 'M62 9A42 42 0 1 0 62 91A34 34 0 1 1 62 9Z', t: 's' },
    { d: P(starPts(68, 50, 15, 6.2, 5, -90)), t: 's' },
  ],
  tower: () => [
    { d: 'M50 4L54 30L61 58L74 93H61Q50 72 39 93H26L39 58L46 30Z', t: 's' },
    { d: 'M37 56H63V61H37Z M43.5 29H56.5V33H43.5Z', t: 'd' },
    { d: 'M46 36L54 54M54 36L46 54M41 64L59 86M59 64L41 86', st: 1.4, t: 'd', o: 0.6 },
  ],
};
export const CREST_SYMBOLS = Object.keys(SYMBOLS);
const SYM_CACHE = {};
const symParts = (name) => SYM_CACHE[name] || (SYM_CACHE[name] = (SYMBOLS[name] || SYMBOLS.star)());

/* ------------------------------------------------------------------ flags */
// FLAG_SPECS entries (crest-data.js): { h:[colours], w:[weights] } | { v:[...] } | { bg } plus o:[overlays].
// Overlay coordinates are in the crest's 100x100 viewBox (field spans roughly 15..85 x 10..90).
function flagMarkup(spec, [x0, y0, x1, y1], ink) {
  const W = x1 - x0 + 4, H = y1 - y0 + 4, X = x0 - 2, Y = y0 - 2;
  const R = (x, y, w, h, c) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${c}"/>`;
  let out = '';
  const bands = (cols, wts, vert) => {
    const tot = (wts || cols.map(() => 1)).reduce((s, v) => s + v, 0);
    let acc = 0;
    cols.forEach((c, i) => {
      const w = (wts ? wts[i] : 1) / tot;
      out += vert ? R(X + acc * W, Y, w * W + 0.3, H, c) : R(X, Y + acc * H, W, w * H + 0.3, c);
      acc += w;
    });
  };
  if (spec.h) bands(spec.h, spec.w, false);
  else if (spec.v) bands(spec.v, spec.w, true);
  else out += R(X, Y, W, H, spec.bg || '#FFFFFF');
  for (const o of spec.o || []) {
    const [k] = o;
    if (k === 'tri') out += `<path d="M${f1(X)} ${f1(Y)}L${f1(X + W * (o[2] || 0.5))} ${f1(Y + H / 2)}L${f1(X)} ${f1(Y + H)}Z" fill="${o[1]}"/>`;
    else if (k === 'canton') out += R(X, Y, W * (o[2] || 0.45), H * (o[3] || 0.45), o[1]);
    else if (k === 'nordic' || k === 'cross') {
      const t = o[2] || 12, cx = k === 'nordic' ? 40 : 50, cy = o[4] || 46;
      out += R(cx - t / 2, Y, t, H, o[1]) + R(X, cy - t / 2, W, t, o[1]);
      if (o[3]) { const t2 = t * 0.5; out += R(cx - t2 / 2, Y, t2, H, o[3]) + R(X, cy - t2 / 2, W, t2, o[3]); }
    } else if (k === 'swiss') {
      const s = o[2] || 30, t = s / 3, cy = o[3] || 46;
      out += R(50 - t / 2, cy - s / 2, t, s, o[1]) + R(50 - s / 2, cy - t / 2, s, t, o[1]);
    } else if (k === 'saltire') {
      const t = o[2] || 9;
      out += `<path d="M${f1(X)} ${f1(Y)}L${f1(X + W)} ${f1(Y + H)}M${f1(X + W)} ${f1(Y)}L${f1(X)} ${f1(Y + H)}" stroke="${o[1]}" stroke-width="${t}"/>`;
    } else if (k === 'diag') {
      if (o[3]) out += `<path d="M${f1(X)} ${f1(Y + H)}L${f1(X + W)} ${f1(Y)}" stroke="${o[3]}" stroke-width="${f1((o[2] || 12) + 6)}"/>`;
      out += `<path d="M${f1(X)} ${f1(Y + H)}L${f1(X + W)} ${f1(Y)}" stroke="${o[1]}" stroke-width="${o[2] || 12}"/>`;
    } else if (k === 'disc') out += `<path d="${circ(o[3] || 50, o[4] || 46, o[2] || 14)}" fill="${o[1]}"/>`;
    else if (k === 'ring') out += `<path d="${circ(o[4] || 50, o[5] || 46, o[2] || 12)}" fill="none" stroke="${o[1]}" stroke-width="${o[3] || 2.4}"/>`;
    else if (k === 'star') out += `<path d="${P(starPts(o[3] || 50, o[4] || 46, o[2] || 10, (o[2] || 10) * 0.4, o[5] || 5))}" fill="${o[1]}"/>`;
    else if (k === 'star6o') out += `<path d="${P(starPts(o[3] || 50, o[4] || 46, o[2] || 12, (o[2] || 12) * 0.577, 6))}" fill="none" stroke="${o[1]}" stroke-width="${o[5] || 2.6}" stroke-linejoin="round"/>`;
    else if (k === 'crescent') {
      const r = o[2] || 12, x = o[3] || 46, y = o[4] || 46;
      out += `<path d="${circ(x, y, r)}" fill="${o[1]}"/><path d="${circ(x + r * 0.32, y, r * 0.8)}" fill="${o[5] || '#E30A17'}"/>`;
    } else if (k === 'stripes') {
      const n = o[1], sh = H / n;
      for (let i = 0; i < n; i++) out += R(X, Y + i * sh, W, sh + 0.2, i % 2 ? o[3] : o[2]);
    } else if (k === 'rhombus') out += `<path d="M${f1(X + 6)} 46L50 ${f1(Y + 10)}L${f1(X + W - 6)} 46L50 ${f1(Y + H - 18)}Z" fill="${o[1]}"/>`;
    else if (k === 'chequer') {
      const s = o[3] || 6, cx = 50, cy = o[4] || 46, n = 4;
      for (let i = 0; i < n; i++) for (let j = 0; j < n + 1; j++) out += R(cx - (n / 2) * s + i * s, cy - (n / 2) * s + j * s, s, s, (i + j) % 2 ? o[2] : o[1]);
    } else if (k === 'band') out += R(X, o[2], W, o[3], o[1]);
    else if (k === 'taeguk') {
      const r = o[1], x = o[2], y = o[3];
      out += `<path d="${circ(x, y, r)}" fill="#CD2E3A"/><path d="M${f1(x - r)} ${f1(y)}A${f1(r)} ${f1(r)} 0 0 0 ${f1(x + r)} ${f1(y)}Z" fill="#0047A0"/>`
        + `<path d="${circ(x - r / 2, y, r / 2)}" fill="#CD2E3A"/><path d="${circ(x + r / 2, y, r / 2)}" fill="#0047A0"/>`
        + `<path d="M${f1(x - r - 9)} ${f1(y - r - 1)}l6 -6M${f1(x + r + 3)} ${f1(y - r - 7)}l6 6M${f1(x - r - 9)} ${f1(y + r + 1)}l6 6M${f1(x + r + 3)} ${f1(y + r + 7)}l6 -6" stroke="#000" stroke-width="3"/>`;
    }
    else if (k === 'rect') out += R(o[2], o[3], o[4], o[5], o[1]);
    else if (k === 'bend') out += `<path d="M${f1(X + W)} ${f1(Y)}L${f1(X + W)} ${f1(Y + H)}L${f1(X)} ${f1(Y + H)}Z" fill="${o[1]}"/>`;
    else if (k === 'vband') out += R(o[2], Y, o[3], H, o[1]);
    else if (k === 'sym') out += symbolMarkup(o[1], o[4] || 50, o[5] || 46, o[3] || 30, { S: o[2], D: o[6] || ink, A: o[2], K: o[2], outline: 0, shade: false });
  }
  return out;
}

/* ------------------------------------------------------- symbol rendering */
function symbolMarkup(name, cx, cy, size, c) {
  const parts = symParts(name);
  const k = size / 100;
  const tone = (t) => (t === 'd' ? c.D : t === 'a' ? c.A : t === 'k' ? c.K : t === 'm' ? mix(c.S, c.D, 0.3) : c.S);
  const draw = (override, opac) => parts.map((p) => {
    if (override && (p.t === 'd' || p.t === 'k')) return '';
    const col = override || tone(p.t);
    const o = p.o != null && !override ? ` opacity="${p.o}"` : '';
    if (p.st) return `<path d="${p.d}" fill="none" stroke="${col}" stroke-width="${p.st}" stroke-linecap="round" stroke-linejoin="round"${o}/>`;
    const sk = p.k && !override ? ` stroke="${tone(p.k)}" stroke-width="${p.sw || 3}" stroke-linejoin="round"` : '';
    return `<path d="${p.d}" fill="${col}"${sk}${o}/>`;
  }).join('');
  let outl = '';
  if (c.outline) {
    outl = parts.map((p) => {
      if (p.t === 'd' || p.t === 'k' || p.o != null) return '';
      const w = (p.st || 0) + c.outline;
      return `<path d="${p.d}" fill="${p.st ? 'none' : c.O}" stroke="${c.O}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
  }
  let shadeL = '';
  if (c.shade !== false && c.half) {
    shadeL = `<g clip-path="url(#${c.half})" opacity="${c.shadeOp || 0.2}">${draw('#000')}</g>`;
  }
  const lift = c.drop ? `<g transform="translate(1.2 2.2)" opacity=".35">${outl ? outl.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"') : draw('#000')}</g>` : '';
  return `<g transform="translate(${f1(cx - size / 2)} ${f1(cy - size / 2)}) scale(${f1(k)})">${lift}${outl}${draw()}${shadeL}</g>`;
}

/* ------------------------------------------------------------ resolution */
const REGION_SHAPES = {
  isr: [['heater', 3], ['pointed', 2], ['round', 2], ['modern', 2], ['hex', 1], ['french', 2], ['spanish', 1], ['scudetto', 1]],
  eng: [['heater', 4], ['round', 3], ['pointed', 2], ['modern', 1], ['french', 2]],
  esp: [['spanish', 5], ['french', 2], ['round', 2], ['heater', 1]],
  ita: [['scudetto', 5], ['round', 2], ['heater', 2], ['modern', 1]],
  ger: [['round', 5], ['heater', 2], ['modern', 2], ['hex', 1]],
  fra: [['round', 2], ['modern', 3], ['hex', 2], ['heater', 2], ['french', 2]],
  por: [['spanish', 3], ['round', 3], ['heater', 2], ['french', 1]],
  ned: [['round', 3], ['heater', 2], ['modern', 2], ['pointed', 1]],
  bel: [['round', 2], ['heater', 2], ['french', 2], ['modern', 1]],
  tur: [['round', 3], ['heater', 2], ['pointed', 2], ['modern', 1]],
  sco: [['round', 3], ['heater', 3], ['pointed', 1]],
  gre: [['round', 3], ['heater', 2], ['pointed', 2]],
  ksa: [['hex', 3], ['modern', 3], ['round', 2], ['pointed', 1]],
  usa: [['hex', 4], ['modern', 3], ['round', 3]],
  bra: [['french', 3], ['round', 3], ['heater', 2], ['spanish', 1]],
  arg: [['french', 3], ['round', 2], ['heater', 2], ['spanish', 2]],
};
const PATTERN_W = [['solid', 5], ['halves', 1.2], ['quarters', 1], ['stripes', 2], ['tri', 1.2], ['pinstripe', 1], ['hoops', 1.4], ['sash', 1.6], ['bend', 1], ['chevron', 1.4], ['chequers', 0.6], ['lozenge', 0.5], ['cross', 0.7], ['bordure', 1.4], ['centre', 1]];
const SYMBOL_W = [['star', 2.4], ['star6', 0.6], ['ball', 2], ['crown', 1.3], ['lion', 1.4], ['eagle', 1.4], ['castle', 1.3], ['anchor', 0.9], ['ship', 0.9], ['sun', 1], ['wolf', 1], ['bull', 0.9], ['horse', 0.9], ['cross', 0.7], ['tree', 0.9], ['wave', 0.7], ['lightning', 0.8], ['cannon', 0.4], ['bird', 1], ['clover', 0.4], ['flame', 0.9], ['torch', 0.6], ['tower', 0.7], ['trident', 0.4]];
const BUSY = new Set(['stripes', 'pinstripe', 'hoops', 'chequers', 'lozenge', 'quarters', 'halves', 'tri', 'sash', 'bend', 'chevron', 'cross']);

/** Monogram from a Hebrew name: first letter of up to 3 words, with gershayim ("מכבי תל אביב" -> 'מת"א'). */
export function monogram(name) {
  const words = String(name || '').replace(/(\S)["״'׳](\S)/g, '$1$2').replace(/["״'׳.\-/()]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0];
  const ls = words.slice(0, 3).map((w) => w[0]);
  return ls.length === 2 ? ls.join('') : ls.slice(0, -1).join('') + '"' + ls[ls.length - 1];
}

function isNationTeam(team) {
  const id = String(team.id || '');
  return !!team.flag || team.kind === 'nation' || (!!FLAG_SPECS[id] && id.indexOf('_') < 0);
}

export function crestStyle(team) {
  const id = String(team && team.id != null ? team.id : (team && team.nameHe) || 'x');
  const ov = CREST_STYLES[id] || {};
  const r = rngFrom(hashStr(id));
  const cols = ov.colors || (team && team.colors) || [];
  let a = normHex(cols[0], '#24304D'), b = normHex(cols[1], isLight(a) ? '#0A1A3A' : '#FFFFFF');
  if (contrast(a, b) < 1.3 && rgbDist(a, b) < 150) b = isLight(a) ? shade(a, -0.62) : shade(a, 0.78);
  const region = id.split('_')[0];
  const nation = isNationTeam(team || {});
  const shape = ov.shape || (nation ? 'heater' : pickW(r, REGION_SHAPES[region] || CREST_SHAPES.map((s) => [s, 1])));
  const pattern = ov.pattern || pickW(r, PATTERN_W);
  const symbol = ov.symbol || pickW(r, SYMBOL_W);
  const lay = SHAPES[shape].round ? [['ring', 5], ['medallion', 1.5], ['mono', 1.5], ['symbol', 1]] : [['symbol', 3.2], ['medallion', 2.6], ['chief', 2.2], ['mono', 1.4]];
  const layout = ov.layout || pickW(r, lay);
  const rep = Number(team && team.reputation) || 0;
  const rim = ov.rim || pickW(r, rep >= 70 ? [['gold', 6], ['silver', 2]] : rep >= 40 ? [['gold', 3], ['silver', 3], ['bronze', 1]] : [['gold', 2], ['silver', 3], ['bronze', 1.4]]);
  const laurel = ov.laurel != null ? ov.laurel : (rep >= 88 && (layout === 'medallion' || layout === 'ring'));
  return {
    id, nation, shape, pattern, symbol, layout, rim, laurel, a, b,
    stars: ov.stars || 0,
    mono: ov.mono || MONO_OVERRIDES[id] || monogram(team && (team.nameHe || team.shortHe)),
    swap: !!ov.swap, symColor: ov.symColor || null, flag: FLAG_SPECS[id] || null,
  };
}

/* --------------------------------------------------------------- render */
const FONT = `Rubik, Heebo, 'Segoe UI', Arial, sans-serif`;

function laurelMarkup(cx, cy, R, fillA, fillB) {
  let d1 = '', d2 = '';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const ang = (side < 0 ? 118 + i * 20 : 62 - i * 20) * Math.PI / 180;
      const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
      const rot = (ang * 180 / Math.PI) + (side < 0 ? 90 + 28 : -90 - 28);
      const leaf = `M${f1(x)} ${f1(y - 4.2)}Q${f1(x + 2.6)} ${f1(y)} ${f1(x)} ${f1(y + 4.2)}Q${f1(x - 2.6)} ${f1(y)} ${f1(x)} ${f1(y - 4.2)}Z`;
      const g = `<path d="${leaf}" transform="rotate(${f1(rot)} ${f1(x)} ${f1(y)})"/>`;
      if (i % 2) d1 += g; else d2 += g;
    }
  }
  return `<g fill="${fillA}">${d1}</g><g fill="${fillB}">${d2}</g>`;
}

function monoMarkup(text, x, y, fs, fill, stroke, sw) {
  return `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" dominant-baseline="central" direction="rtl" font-family="${FONT}" font-weight="900" font-size="${f1(fs)}"`
    + ` fill="${fill}" stroke="${stroke}" stroke-width="${f1(sw)}" stroke-linejoin="round" paint-order="stroke">${escXml(text)}</text>`;
}

/** Symbol, or the monogram when style.symbol === 'mono'. */
function emblem(st, cx, cy, size, c) {
  if (st.symbol !== 'mono') return symbolMarkup(st.symbol, cx, cy, size, c);
  const n = [...st.mono].length;
  const fs = size * (n <= 1 ? 0.9 : n === 2 ? 0.7 : n === 3 ? 0.56 : 0.46);
  return `<g transform="translate(1 2)" opacity=".35">${monoMarkup(st.mono, cx, cy, fs, '#000', '#000', 3.4)}</g>` + monoMarkup(st.mono, cx, cy, fs, c.S, c.O, 3.4);
}

export function crestSVG(team, size = 40, opts = {}) {
  if (!team) team = { id: '__none', nameHe: '?', colors: ['#2A3550', '#C9D3E6'] };
  const st = crestStyle(team);
  const p = uid();
  const S = SHAPES[st.shape] || SHAPES.heater;
  const small = size < 34, tiny = size < 22;
  const metal = st.rim === 'silver' ? SILVER : st.rim === 'bronze' ? BRONZE : GOLD;
  const RIM = tiny ? 7 : small ? 6 : 5.2;
  const fieldIn = RIM + (tiny ? 0.6 : 1);
  const outer = shapePath(st.shape, 0), rimP = shapePath(st.shape, 1.1), sep = shapePath(st.shape, RIM), field = shapePath(st.shape, fieldIn);
  const fb = fieldBox(st.shape, fieldIn);
  const [x0, y0, x1, y1] = fb, W = x1 - x0, H = y1 - y0, cx = (x0 + x1) / 2;
  const a = st.swap ? st.b : st.a, b = st.swap ? st.a : st.b;
  const dark = lum(a) <= lum(b) ? a : b, light = dark === a ? b : a;
  const ink = shade(dark, -0.72), edge = shade(dark, -0.8);
  const shadow = opts.shadow !== false && size >= 22;

  const symCols = (bg, pref) => {
    const want = pref || st.symColor;
    const Sc = want ? normHex(want) : (contrast(bg, bg === a ? b : a) >= 2.1 ? (bg === a ? b : a) : bestOn(bg, ['#FFFFFF', metal[1], INK]));
    const D = isLight(Sc) ? ink : mix(Sc, '#FFFFFF', 0.8);
    const O = isLight(Sc) ? ink : mix(light, '#FFFFFF', 0.35);
    const A = contrast(Sc, GOLD[1]) >= 1.5 ? GOLD[1] : (isLight(Sc) ? '#E8452C' : '#FFFFFF');
    return { S: Sc, D, O, A, K: bg, half: p + 'h' };
  };

  const defs = `<defs>`
    + `<linearGradient id="${p}m" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${metal[0]}"/><stop offset=".3" stop-color="${metal[1]}"/><stop offset=".62" stop-color="${metal[2]}"/><stop offset=".84" stop-color="${metal[3]}"/><stop offset="1" stop-color="${metal[4]}"/></linearGradient>`
    + `<linearGradient id="${p}l" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>`
    + `<radialGradient id="${p}v" cx=".5" cy=".4" r=".72"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>`
    + `<linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>`
    + `<linearGradient id="${p}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>`
    + `<radialGradient id="${p}d" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>`
    + `<clipPath id="${p}c"><path d="${field}"/></clipPath>`
    + `<clipPath id="${p}h"><rect x="50" y="-20" width="80" height="140"/></clipPath>`
    + (shadow ? `<filter id="${p}f" x="-.2" y="-.15" width="1.4" height="1.45" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="${tiny ? 1.4 : 2.4}" stdDeviation="${tiny ? 1.2 : 2}" flood-color="#000" flood-opacity=".5"/></filter>` : '');

  let content = '', extraDefs = '';
  const [scx, scy0] = S.center;
  const starsShift = st.stars && st.layout !== 'chief' ? 4 : 0;
  const scy = scy0 + starsShift;
  const busy = BUSY.has(st.pattern);

  if (st.nation) {
    content += flagMarkup(st.flag || { h: [a, b] }, fb, ink);
  } else if (st.layout === 'ring') {
    const Rr = W / 2, innerR = Rr - (tiny ? 13 : 12), ccy = (y0 + y1) / 2;
    const ringCol = contrast(a, b) >= 1.8 ? (lum(a) < lum(b) ? a : b) : ink;
    const innerCol = ringCol === a ? b : a;
    extraDefs += `<clipPath id="${p}i"><path d="${circ(cx, ccy, innerR)}"/></clipPath>`;
    content += `<rect x="0" y="0" width="100" height="100" fill="${ringCol}"/>`;
    if (!tiny) {
      let dots = '';
      for (let i = 0; i < 16; i++) {
        const ang = (i * 22.5 - 90) * Math.PI / 180, rr = innerR + (Rr - innerR) / 2;
        const x = cx + Math.cos(ang) * rr, y = ccy + Math.sin(ang) * rr;
        dots += i % 4 === 0 ? P(starPts(x, y, 3.3, 1.35, 5)) : circ(x, y, 1.15);
      }
      content += `<path d="${dots}" fill="${metal[1]}"/>`;
    }
    content += `<path d="${circ(cx, ccy, innerR + 2.4)}" fill="url(#${p}m)"/><path d="${circ(cx, ccy, innerR + 0.6)}" fill="${edge}"/>`;
    content += `<g clip-path="url(#${p}i)">${patternMarkup(st.pattern === 'bordure' ? 'solid' : st.pattern, innerCol, ringCol === a ? a : b, [cx - innerR, ccy - innerR, cx + innerR, ccy + innerR])}`;
    const c = symCols(innerCol);
    content += emblem(st, cx, ccy, innerR * 1.42, { ...c, outline: busy ? 7 : 4.5, drop: true });
    content += `<rect x="0" y="0" width="100" height="100" fill="url(#${p}d)"/></g>`;
  } else {
    content += patternMarkup(st.pattern, a, b, fb, shapePath(st.shape, fieldIn + 6.5));
    if (st.layout === 'medallion') {
      const R = Math.min(W, H) * 0.29, mcy = scy;
      const disc = st.pattern === 'solid' || st.pattern === 'bordure' ? b : shade(dark, -0.12);
      if (st.laurel && !small) content += laurelMarkup(cx, mcy, R + 7.5, metal[1], metal[2]);
      content += `<path d="${circ(cx, mcy + 1.4, R + 3.6)}" fill="#000" opacity=".35"/>`;
      content += `<path d="${circ(cx, mcy, R + 3.4)}" fill="${edge}"/><path d="${circ(cx, mcy, R + 2.6)}" fill="url(#${p}m)"/><path d="${circ(cx, mcy, R)}" fill="${disc}"/>`;
      const c = symCols(disc);
      content += emblem(st, cx, mcy, R * 1.45, { ...c, outline: 4, drop: false });
      content += `<path d="${circ(cx, mcy, R)}" fill="url(#${p}d)"/>`;
    } else if (st.layout === 'chief') {
      const bandH = H * S.chief;
      const chiefCol = contrast(a, b) >= 1.8 ? b : ink;
      content += `<rect x="${f1(x0 - 2)}" y="${f1(y0 - 2)}" width="${f1(W + 4)}" height="${f1(bandH + 2)}" fill="${chiefCol}"/>`;
      content += `<rect x="${f1(x0 - 2)}" y="${f1(y0 + bandH)}" width="${f1(W + 4)}" height="1.9" fill="url(#${p}m)"/>`;
      const tcol = contrast(chiefCol, metal[1]) >= 2 ? metal[1] : bestOn(chiefCol, ['#FFFFFF', a, INK]);
      if (!small) content += monoMarkup(st.mono, cx, y0 + bandH * 0.56, Math.min(bandH * 0.72, 62 / Math.max(2, st.mono.length)), tcol, shade(chiefCol, -0.5), 1.2);
      else { let d = ''; for (let i = -1; i <= 1; i++) d += P(starPts(cx + i * 12, y0 + bandH * 0.55, 4.4, 1.8, 5)); content += `<path d="${d}" fill="${tcol}"/>`; }
      const bottom = y1 - H * 0.16, top = y0 + bandH + 1.9;
      const sz = Math.min(46, (bottom - top) * 0.98);
      const c = symCols(a);
      content += emblem(st, cx, (top + bottom) / 2, sz, { ...c, outline: busy ? 7 : 5, drop: true });
    } else if (st.layout === 'mono') {
      const n = [...st.mono].length;
      const fs = n <= 1 ? 50 : n === 2 ? 40 : n === 3 ? 31 : 25;
      const fill = contrast(a, metal[1]) >= 1.6 ? `url(#${p}m)` : bestOn(a, ['#FFFFFF', INK]);
      content += `<g transform="translate(1.2 2.4)" opacity=".4">${monoMarkup(st.mono, cx, scy, fs, '#000', '#000', 4)}</g>`;
      content += monoMarkup(st.mono, cx, scy, fs, fill, ink, 4.2);
    } else {
      const sz = SHAPES[st.shape].round ? 52 : st.shape === 'hex' ? 50 : 54;
      const c = symCols(a);
      content += emblem(st, scx, scy, sz, { ...c, outline: busy ? 7.5 : 5.5, drop: true });
    }
    if (st.stars) {
      let d = '';
      const n = Math.min(5, st.stars), gap = 9;
      for (let i = 0; i < n; i++) d += P(starPts(cx + (i - (n - 1) / 2) * gap, y0 + 6.4, 3.8, 1.6, 5));
      content += `<path d="${d}" fill="${metal[1]}" stroke="${ink}" stroke-width=".9" stroke-linejoin="round" paint-order="stroke"/>`;
    }
  }

  const gloss = `<path d="M${f1(x0 - 2)} ${f1(y0 - 2)}H${f1(x1 + 2)}V${f1(y0 + H * 0.36)}Q${f1(cx)} ${f1(y0 + H * 0.52)} ${f1(x0 - 2)} ${f1(y0 + H * 0.4)}Z" fill="url(#${p}g)" opacity="${tiny ? 0.22 : 0.3}"/>`;
  const body = `<g${shadow ? ` filter="url(#${p}f)"` : ''}>`
    + `<path d="${outer}" fill="${edge}"/>`
    + `<path d="${rimP}" fill="url(#${p}m)"/>`
    + (tiny ? '' : `<path d="${shapePath(st.shape, 1.9)}" fill="none" stroke="url(#${p}e)" stroke-width=".9" opacity=".8"/>`)
    + `<path d="${sep}" fill="${edge}"/>`
    + `<g clip-path="url(#${p}c)">${content}`
    + `<rect x="0" y="0" width="100" height="100" fill="url(#${p}l)"/><rect x="0" y="0" width="100" height="100" fill="url(#${p}v)"/>${gloss}</g>`
    + (tiny ? '' : `<path d="${field}" fill="none" stroke="url(#${p}e)" stroke-width="1.3" opacity=".55"/>`)
    + `</g>`;
  const label = opts.title ? ` role="img" aria-label="${escXml(opts.title)}"` : ' aria-hidden="true" focusable="false"';
  const cls = 'crest' + (opts.cls ? ' ' + escXml(opts.cls) : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="${cls}"${label}>${defs}${extraDefs}</defs>${body}</svg>`;
}

/** Accepts a team ref, an id string, or loose objects ({ teamId, teamHe, clubHe, nationId, ... }). */
export function normTeam(t) {
  if (t == null) return null;
  if (typeof t === 'string') {
    const ov = CREST_STYLES[t];
    return { id: t, nameHe: (ov && ov.nameHe) || t, colors: ov && ov.colors, flag: FLAG_SPECS[t] && t.indexOf('_') < 0 ? '1' : '' };
  }
  const id = t.id ?? t.teamId ?? t.clubId ?? t.nationId ?? t.nation ?? t.nameHe;
  return {
    ...t,
    id: id != null ? String(id) : '__none',
    nameHe: t.nameHe ?? t.teamHe ?? t.clubHe ?? t.nationHe ?? t.shortHe ?? '',
    shortHe: t.shortHe ?? t.teamShortHe ?? t.nameHe ?? '',
    colors: t.colors ?? t.kitColors ?? (CREST_STYLES[id] && CREST_STYLES[id].colors),
  };
}
export function crestFor(teamLike, size = 40, opts = {}) { return crestSVG(normTeam(teamLike), size, opts); }
export function crestDataURL(team, size = 64, opts = {}) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(crestSVG(normTeam(team), size, opts));
}

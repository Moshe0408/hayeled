// tools/make-icons.mjs: zero-dependency icon generator (SPEC §7.7).
// Usage: node tools/make-icons.mjs
// Draws the icon geometry (night stadium background, pitch-green arc, football, gold star) into an
// RGBA buffer with 4x4 supersampling and encodes PNGs with node:zlib. Also writes icons/icon.svg
// from the same geometry, so the vector and raster versions always match.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const OUT = path.join(ROOT, 'icons');

// ---------------------------------------------------------------------------
// Geometry, in a 512 x 512 design space
// ---------------------------------------------------------------------------
const C = {
  bgTop: [0x1a, 0x2b, 0x4a], bg: [0x0b, 0x12, 0x20],
  pitch: [0x12, 0x7a, 0x3a], pitchLine: [0x1f, 0xbf, 0x5a],
  white: [0xf8, 0xfa, 0xfc], ink: [0x0b, 0x12, 0x20], patch: [0x14, 0x1c, 0x2b],
  gold: [0xf5, 0xc5, 0x18], light: [0xff, 0xf4, 0xc2],
};
const BALL = { x: 256, y: 262, r: 128 };
const HILL = { x: 256, y: 860, r: 470 };          // pitch "horizon": top edge at y = 390
const ARC_W = 20;                                  // bright green line on the hill edge
const STAR = { x: 404, y: 118, ro: 58, ri: 24 };
const LIGHTS = [{ x: 92, y: 92, r: 13 }, { x: 132, y: 70, r: 9 }];   // floodlights
const RADIUS = 104;                                // rounded corners of the "any" icons

const PENT_R = 44;                                 // central patch
const SEAM_R = 90;                                 // where the radial seams of the central patch end
const OUTER_D = 150;                               // distance of the outer (rim) patches from the ball centre
const OUTER_R = 50;

function regularPolygon(cx, cy, r, n, rot) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function starPolygon(cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? ri : ro;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

const UP = -Math.PI / 2;
const centralPent = regularPolygon(BALL.x, BALL.y, PENT_R, 5, UP);
const outerPents = [];
const seams = [];
const polar = (r, ang) => [BALL.x + r * Math.cos(ang), BALL.y + r * Math.sin(ang)];
const nearest = (pts, q) => pts.reduce((m, v) => (Math.hypot(v[0] - q[0], v[1] - q[1]) < Math.hypot(m[0] - q[0], m[1] - q[1]) ? v : m));
for (let j = 0; j < 5; j++) {
  // rim patches sit opposite the edges of the central patch, one edge facing the centre
  const c = UP + Math.PI / 5 + (j * 2 * Math.PI) / 5;
  const [ox, oy] = polar(OUTER_D, c);
  outerPents.push(regularPolygon(ox, oy, OUTER_R, 5, c));
}
for (let i = 0; i < 5; i++) {
  const a = UP + (i * 2 * Math.PI) / 5;
  const P = polar(SEAM_R, a);
  seams.push([centralPent[i], P]);
  for (const pent of [outerPents[i], outerPents[(i + 4) % 5]]) {
    const v = nearest(pent, P);
    seams.push([P, v]);
  }
}
for (const pent of outerPents) {
  // seams from the rim patches out to the edge of the ball
  for (const v of pent) {
    const d = Math.hypot(v[0] - BALL.x, v[1] - BALL.y);
    if (d < BALL.r - 4 && d > SEAM_R + 20) {
      const ang = Math.atan2(v[1] - BALL.y, v[0] - BALL.x);
      seams.push([v, polar(BALL.r + 6, ang)]);
    }
  }
}
const starPts = starPolygon(STAR.x, STAR.y, STAR.ro, STAR.ri);

// ---------------------------------------------------------------------------
// Point tests
// ---------------------------------------------------------------------------
const inCircle = (x, y, c, r = c.r) => (x - c.x) ** 2 + (y - c.y) ** 2 <= r * r;
function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distSeg(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
function inRoundRect(x, y, s, r) {
  const cx = Math.max(r, Math.min(s - r, x));
  const cy = Math.max(r, Math.min(s - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Colour of the design at (x, y) in design space (background always opaque).
function paint(x, y) {
  // stadium-night background with a soft glow behind the ball
  const g = Math.min(1, Math.hypot(x - 256, y - 200) / 330);
  let col = mix(C.bgTop, C.bg, g);
  for (const l of LIGHTS) {
    const d = Math.hypot(x - l.x, y - l.y);
    if (d <= l.r) col = C.light;
    else if (d < l.r * 3.2) col = mix(col, C.light, 0.18 * (1 - (d - l.r) / (l.r * 2.2)));
  }
  // pitch hill and its bright arc
  const dh = Math.hypot(x - HILL.x, y - HILL.y);
  if (dh <= HILL.r) col = dh >= HILL.r - ARC_W ? C.pitchLine : C.pitch;
  // ball shadow on the pitch
  if (((x - BALL.x) / (BALL.r * 0.95)) ** 2 + ((y - 402) / 16) ** 2 <= 1 && dh <= HILL.r - ARC_W) col = mix(col, C.ink, 0.45);
  // ball
  if (inCircle(x, y, BALL, BALL.r + 7)) {
    col = C.ink;                                                    // outline
    if (inCircle(x, y, BALL)) {
      col = C.white;
      // light shading towards the bottom-left
      const sh = Math.max(0, Math.hypot(x - (BALL.x + 40), y - (BALL.y - 45)) / (BALL.r * 1.6) - 0.35);
      col = mix(C.white, [0xc9, 0xd3, 0xe0], Math.min(1, sh));
      let patch = inPolygon(x, y, centralPent);
      for (const p of outerPents) if (!patch && inPolygon(x, y, p)) patch = true;
      if (patch) col = C.patch;
      else for (const s of seams) if (distSeg(x, y, s[0], s[1]) <= 4.2) { col = C.patch; break; }
    }
  }
  // gold star
  if (inPolygon(x, y, starPts)) col = C.gold;
  return col;
}

// ---------------------------------------------------------------------------
// Raster + PNG
// ---------------------------------------------------------------------------
// kind: 'any' (rounded, transparent corners) | 'full' (opaque square) | 'maskable' (opaque, content in the 80% safe zone)
function render(size, kind) {
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);
  const k = 512 / size;
  const scale = kind === 'maskable' ? 0.8 : 1;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * k;
          const y = (py + (sy + 0.5) / SS) * k;
          if (kind === 'any' && !inRoundRect(x, y, 512, RADIUS)) continue;
          const c = paint(256 + (x - 256) / scale, 256 + (y - 256) / scale);
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      const n = SS * SS;
      if (a) { buf[i] = Math.round(r / a); buf[i + 1] = Math.round(g / a); buf[i + 2] = Math.round(b / a); }
      buf[i + 3] = Math.round((a / n) * 255);
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;   // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// SVG source (same geometry)
// ---------------------------------------------------------------------------
const f = (n) => Math.round(n * 10) / 10;
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const poly = (pts) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
function buildSVG() {
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`,
    `  <title>הילד מהשכונה</title>`,
    `  <defs>`,
    `    <radialGradient id="bg" cx="256" cy="200" r="330" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0" stop-color="${hex(C.bgTop)}"/><stop offset="1" stop-color="${hex(C.bg)}"/>`,
    `    </radialGradient>`,
    `    <radialGradient id="ball" cx="${BALL.x + 40}" cy="${BALL.y - 45}" r="${f(BALL.r * 1.6)}" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0.35" stop-color="${hex(C.white)}"/><stop offset="1" stop-color="#c9d3e0"/>`,
    `    </radialGradient>`,
    `    <clipPath id="ballClip"><circle cx="${BALL.x}" cy="${BALL.y}" r="${BALL.r}"/></clipPath>`,
    `    <clipPath id="hillClip"><circle cx="${HILL.x}" cy="${HILL.y}" r="${HILL.r - ARC_W}"/></clipPath>`,
    `  </defs>`,
    `  <rect width="512" height="512" rx="${RADIUS}" fill="url(#bg)"/>`,
    ...LIGHTS.map((l) => `  <circle cx="${l.x}" cy="${l.y}" r="${f(l.r * 3.2)}" fill="${hex(C.light)}" opacity="0.12"/><circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="${hex(C.light)}"/>`),
    `  <g clip-path="url(#round)">`,
    `    <circle cx="${HILL.x}" cy="${HILL.y}" r="${HILL.r}" fill="${hex(C.pitchLine)}"/>`,
    `    <circle cx="${HILL.x}" cy="${HILL.y}" r="${HILL.r - ARC_W}" fill="${hex(C.pitch)}"/>`,
    `    <ellipse cx="${BALL.x}" cy="402" rx="${f(BALL.r * 0.95)}" ry="16" fill="${hex(C.ink)}" opacity="0.45" clip-path="url(#hillClip)"/>`,
    `  </g>`,
    `  <circle cx="${BALL.x}" cy="${BALL.y}" r="${BALL.r + 7}" fill="${hex(C.ink)}"/>`,
    `  <circle cx="${BALL.x}" cy="${BALL.y}" r="${BALL.r}" fill="url(#ball)"/>`,
    `  <g clip-path="url(#ballClip)" fill="${hex(C.patch)}" stroke="${hex(C.patch)}" stroke-width="8.4" stroke-linecap="round">`,
    `    <polygon points="${poly(centralPent)}" stroke="none"/>`,
    ...outerPents.map((p) => `    <polygon points="${poly(p)}" stroke="none"/>`),
    ...seams.map(([a, b]) => `    <line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`),
    `  </g>`,
    `  <polygon points="${poly(starPts)}" fill="${hex(C.gold)}"/>`,
    `</svg>`,
  ];
  // The rounded background already bounds everything; the hill group needs the same rounded clip.
  lines.splice(9, 0, `    <clipPath id="round"><rect width="512" height="512" rx="${RADIUS}"/></clipPath>`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 'any'],
  ['icon-512.png', 512, 'any'],
  ['maskable-512.png', 512, 'maskable'],
  ['apple-touch-icon.png', 180, 'full'],
];
for (const [name, size, kind] of jobs) {
  const png = encodePNG(size, render(size, kind));
  writeFileSync(path.join(OUT, name), png);
  console.log(`icons/${name}  ${size}x${size}  ${png.length} bytes`);
}
writeFileSync(path.join(OUT, 'icon.svg'), buildSVG());
console.log('icons/icon.svg');

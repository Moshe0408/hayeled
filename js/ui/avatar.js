// avatar.js: stylised "3D-feel" player avatars (contract C7). Pure string builders, Node-safe, deterministic.
//
//   avatarSVG({ gender:'m'|'f', skin, hair, hairColor, kitColors:[a,b], number, size, pose:'portrait'|'full', bg = true, title })
//     skin: 0..5 index (SKIN_TONES) or '#hex'; hair: style id from HAIR_STYLES[gender] (or index);
//     hairColor: 0..5 index (HAIR_COLORS) or '#hex' (default: derived from skin / seed).
//   avatarFromMeta(meta) -> options object (uses meta.look {skin,hair,hairColor} or hashes meta.careerId/id/name)
//   avatarForMeta(meta, extra) -> SVG string (shortcut)
//   lookFromSeed(seed, gender) -> { skin, hair, hairColor }   (wizard "random" button)
//   SKIN_TONES, HAIR_COLORS, HAIR_STYLES  (with Hebrew labels, for the creation wizard)
import { hashStr, mix, normHex, lum, contrast, escXml } from './crests.js';

export const SKIN_TONES = [
  { id: 0, he: 'בהיר מאוד', c: '#F6D9C6' },
  { id: 1, he: 'בהיר', c: '#EBC19F' },
  { id: 2, he: 'שזוף בהיר', c: '#D7A078' },
  { id: 3, he: 'שזוף', c: '#B97A50' },
  { id: 4, he: 'כהה', c: '#8C5534' },
  { id: 5, he: 'כהה מאוד', c: '#5C3520' },
];
export const HAIR_COLORS = [
  { id: 0, he: 'שחור', c: '#1C1714' },
  { id: 1, he: 'חום כהה', c: '#3D2718' },
  { id: 2, he: 'חום', c: '#6E4527' },
  { id: 3, he: 'ערמוני', c: '#8E3D20' },
  { id: 4, he: 'בלונד', c: '#D8B068' },
  { id: 5, he: "ג'ינג'י", c: '#C6622A' },
];
export const HAIR_STYLES = {
  m: [
    { id: 'crop', he: 'קצר' }, { id: 'fade', he: 'פייד' }, { id: 'buzz', he: 'קוצץ' }, { id: 'curly', he: 'מתולתל' },
    { id: 'afro', he: 'אפרו' }, { id: 'quiff', he: 'בלורית' }, { id: 'side', he: 'שביל צד' }, { id: 'long', he: 'ארוך' },
    { id: 'manbun', he: 'קוקו' }, { id: 'cornrows', he: 'צמות' },
  ],
  f: [
    { id: 'ponytail', he: 'קוקו' }, { id: 'braids', he: 'צמות' }, { id: 'bun', he: 'פקעת' }, { id: 'pixie', he: 'קצר' },
    { id: 'curlyf', he: 'מתולתל' }, { id: 'longf', he: 'ארוך' }, { id: 'bob', he: 'קארה' }, { id: 'afropuff', he: 'אפרו' },
    { id: 'spacebuns', he: 'שתי פקעות' }, { id: 'fadef', he: 'קוצץ' },
  ],
};
const EYES = ['#3B2416', '#5A3A22', '#2A1A10', '#6B552A', '#3F6A3A', '#3C6A9C'];

let UID = 0;
const f1 = (n) => (Math.round(n * 100) / 100).toString();
const circ = (cx, cy, r) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
const ell = (cx, cy, rx, ry) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`;

function skinHex(skin) {
  if (typeof skin === 'string' && skin[0] === '#') return normHex(skin, SKIN_TONES[2].c);
  const i = Math.max(0, Math.min(SKIN_TONES.length - 1, Number(skin) | 0));
  return SKIN_TONES[i].c;
}
function hairHex(hc, skinIdx) {
  if (typeof hc === 'string' && hc[0] === '#') return normHex(hc, HAIR_COLORS[0].c);
  if (hc == null || hc === '') return HAIR_COLORS[skinIdx >= 3 ? 0 : 1].c;
  return HAIR_COLORS[Math.max(0, Math.min(HAIR_COLORS.length - 1, Number(hc) | 0))].c;
}
function hairId(gender, hair) {
  const list = HAIR_STYLES[gender] || HAIR_STYLES.m;
  if (typeof hair === 'number' || /^\d+$/.test(String(hair))) return list[Math.abs(Number(hair)) % list.length].id;
  if (hair && (HAIR_STYLES.m.some((h) => h.id === hair) || HAIR_STYLES.f.some((h) => h.id === hair))) return hair;
  return list[0].id;
}

/* ------------------------------------------------------------------- hair */
// Each style -> { back, front } path markup builders in head space (face centre ~ (60,50), skull top y 27).
function curls(cx, cy, rx, ry, a0, a1, n, r) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * Math.PI / 180;
    d += circ(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r * (0.86 + 0.28 * ((i * 7) % 5) / 4));
  }
  return d;
}
const CAP = 'M40.5 50C40 33 48 24.5 60 24.5C72 24.5 80 33 79.5 50L77.6 46C77 40 74 37 70 36Q60 33.6 50 36C46 37 43 40 42.4 46Z';
const SLICK = 'M40.2 50C39 32 47.5 23 60 23C72.5 23 81 32 79.8 50L77.8 45C76.5 39 73 35.6 68 34.6Q60 33.4 52 34.6C47 35.6 43.5 39 42.2 45Z';
const HAIR = {
  buzz: () => ({ front: [{ d: CAP, op: 0.78 }] }),
  fadef: () => ({ front: [{ d: CAP, op: 0.7 }, { d: 'M45 36C45 26 52 21.5 61 21.5C70 21.5 76 27 75 36Q68 33 60 33.6Q52 33.4 45 36Z' }] }),
  fade: () => ({ front: [{ d: CAP, op: 0.55 }, { d: 'M44 37C43 25 51 18.5 61 18.5C71 18.5 78 25 76.5 37Q69 32.5 60 34Q51 32.8 44 37Z' }], sheen: 'M50 25Q60 20 70 24' }),
  crop: () => ({ front: [{ d: 'M39.6 50C38 30 47 21 60 21C73 21 82 30 80.4 50L78 45C77 39.5 75 36.5 72 35.4Q66.5 37.4 60.5 35.6Q54 37.6 47.6 35.2Q44 37.4 42.6 41.4L41.6 46Z' }] }),
  curly: () => ({ front: [{ d: 'M40 50C39 32 47 23 60 23C73 23 81 32 80 50L77.5 44Q60 33 42.5 44Z' }, { d: curls(60, 44, 20.5, 19, 192, 348, 11, 6.4) }], sheen: null }),
  afro: () => ({
    back: [{ d: curls(60, 40, 26, 22, 150, 390, 18, 9) + ell(60, 38, 27, 21) }],
    front: [{ d: curls(60, 40.5, 19, 8.6, 205, 335, 8, 4.4) }], sheen: null,
  }),
  quiff: () => ({ front: [{ d: 'M41 47C39 32 46 22.5 56 19.5C62 15.5 73 14.5 80 19.5C76 20.6 74.4 22.6 75.4 26C80 32 81.2 40 79.6 47L77.2 42C75 37 71 35 66 35Q56 34 48 37Q44 39 43 44Z' }], sheen: 'M54 22Q64 16 74 19' }),
  side: () => ({ front: [{ d: 'M40 49C38 31 47 22 60 22C73 22 82 31 80 49L78 43C76 38 73 35 69 34C62 36.4 52 37 44 41L42 45Z' }], part: 'M67 23.4Q64.6 28 66.8 34' }),
  long: () => ({
    back: [{ d: 'M37 50C35 30 46 20 60 20C74 20 85 30 83 50L84.6 80Q78.6 84.4 74 76L74 54L46 54L46 76Q41.4 84.4 35.4 80Z' }],
    front: [{ d: 'M39.6 54C37.6 32 47 21 60 21C73 21 82.4 32 80.4 54C79 43 73 34.6 62.6 30.4Q60.4 35.6 58.6 30.4C48.4 34.4 41.6 43 39.6 54Z' }],
  }),
  manbun: () => ({ back: [{ d: circ(60, 17.6, 7.4) }], front: [{ d: SLICK }, { d: 'M54 23.4Q60 21.4 66 23.4', band: true }] }),
  cornrows: () => ({ front: [{ d: CAP.replace('24.5C72 24.5', '23.6C72 23.6').replace('C40 33 48 24.5 60 24.5', 'C40 32.6 48 23.6 60 23.6') }], rows: true }),
  ponytail: () => ({
    back: [{ d: 'M72 28C86 27 92 40 89.6 56C88 68 82.4 77 84.6 90C76 85 74.4 71 77.6 59C80 50 80.4 40 73 33Z' }],
    front: [{ d: 'M40 50C38 31 47 22 60 22C73 22 82 31 80 50L78 44C76 38 72 34 66 33Q56 32.4 48 36C44 39 42 44 41.5 48Z' }, { d: 'M75.6 30.4Q79 28.4 81.6 31.2', band: true }],
  }),
  braids: () => {
    let l = '', r = '';
    for (let i = 0; i < 7; i++) { const y = 60 + i * 6, x = 41.4 - i * 0.7; l += ell(x, y, 3.6 - i * 0.12, 3.6); r += ell(120 - x, y, 3.6 - i * 0.12, 3.6); }
    return {
      back: [{ d: 'M39 50C37 31 47 21.5 60 21.5C73 21.5 83 31 81 50L80 60L40 60Z' }],
      front: [{ d: 'M40 52C38 31.6 47.4 22.4 60 22.4C72.6 22.4 82 31.6 80 52L78 44C76 38.4 70 34.6 61 33.4L60 25L59 33.4C50 34.6 44 38.4 42 44Z' }, { d: l + r }, { d: ell(40.6, 101.4, 2.8, 1.4) + ell(79.4, 101.4, 2.8, 1.4), band: true }],
    };
  },
  bun: () => ({ front: [{ d: SLICK }, { d: circ(60, 18.4, 9.4) }, { d: 'M52.4 25.6Q60 23.4 67.6 25.6', band: true }], sheen: 'M54 13.6Q60 10.6 66 13.6' }),
  pixie: () => ({ front: [{ d: 'M39.4 52C37 30 47 21 60 21C74 21 83 31 80.6 52L78.6 46C77 40 74 36 70 35C64 38.4 54 40.4 44 44.4L41 52Z' }] }),
  curlyf: () => ({
    back: [{ d: curls(60, 52, 26, 30, 170, 370, 16, 8.6) + ell(60, 54, 25, 30) + curls(60, 76, 25, 10, 0, 180, 7, 7.4) }],
    front: [{ d: curls(60, 42, 19, 10.4, 196, 344, 8, 5.6) }], sheen: null,
  }),
  longf: () => ({
    back: [{ d: 'M36 48C34 28 46 19 60 19C74 19 86 28 84 48L87.6 98Q76 102 71.6 93L71.6 56L48.4 56L48.4 93Q44 102 32.4 98Z' }],
    front: [{ d: 'M39.4 54C37 30 47 20 60 20C74 20 83 31 80.6 54C79.4 43 74 35 66 32C58 36.4 48.4 38.6 42 47Z' }],
  }),
  bob: () => ({
    back: [{ d: 'M37 50C35 29 46 20 60 20C74 20 85 29 83 50L84.4 73Q78 77.4 72 73L72 52L48 52L48 73Q42 77.4 35.6 73Z' }],
    front: [{ d: 'M40 50C38 30 47 21 60 21C73 21 82 30 80 50L78.2 44.2L77.2 40.8Q60 38.6 42.8 40.8L41.8 44.2Z' }],
  }),
  afropuff: () => ({ back: [{ d: curls(60, 20, 13, 11, 0, 360, 12, 6) + circ(60, 20, 13) }], front: [{ d: SLICK }, { d: 'M53 25Q60 23 67 25', band: true }] }),
  spacebuns: () => ({ front: [{ d: SLICK }, { d: circ(44.6, 23.4, 8) + circ(75.4, 23.4, 8) }] }),
};

/* ------------------------------------------------------------------ head */
function headLayers(o, id) {
  const { gender, skinC, hairC, eyeC, kitA, kitB, style } = o;
  const H = (HAIR[style] || HAIR.crop)();
  const fill = (op) => `fill="url(#${id}hr)"${op != null ? ` opacity="${op}"` : ''}`;
  const hairPaths = (arr) => (arr || []).map((p) => p.band
    ? `<path d="${p.d}" fill="none" stroke="${mix(kitA, '#000000', 0.1)}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<path d="${p.d}" ${fill(p.op)}/>`).join('');
  const shadowSkin = mix(skinC, '#3A1408', 0.32);
  const female = gender === 'f';
  const lip = female ? mix(skinC, '#B8405A', 0.45) : mix(skinC, '#7A3A2A', 0.35);
  const face = female
    ? 'M42 50C42 36 50 27 60 27C70 27 78 36 78 50C78 59 75 65.4 71 70C67 74 63.4 75.6 60 75.6C56.6 75.6 53 74 49 70C45 65.4 42 59 42 50Z'
    : 'M41 50C41 36 49 27 60 27C71 27 79 36 79 50C79 58 77.4 64 74.2 68.4C70.4 73.4 65.4 76.4 60 76.4C54.6 76.4 49.6 73.4 45.8 68.4C42.6 64 41 58 41 50Z';
  const ex = female ? 0.6 : 0;
  const eye = (cx, flip) => {
    const w = 5, y = 54.4, lid = female ? 1.9 : 1.4, ix = cx + (flip ? -0.35 : 0.35);
    const white = `M${f1(cx - w)} ${y}Q${cx} ${f1(y - 6.6)} ${f1(cx + w)} ${y}Q${cx} ${f1(y + 5)} ${f1(cx - w)} ${y}Z`;
    const cid = id + (flip ? 'er' : 'el');
    return `<clipPath id="${cid}"><path d="${white}"/></clipPath><path d="${white}" fill="#FBFBF8"/>`
      + `<g clip-path="url(#${cid})"><path d="${circ(ix, y - 0.2, 2.75)}" fill="${eyeC}"/><path d="${circ(ix, y - 0.2, 1.8)}" fill="${mix(eyeC, '#000000', 0.35)}" opacity=".6"/><path d="${circ(ix, y - 0.2, 1.2)}" fill="#0B0705"/>`
      + `<path d="M${f1(cx - w)} ${f1(y - 3.4)}H${f1(cx + w)}V${f1(y - 1.6)}H${f1(cx - w)}Z" fill="#000000" opacity=".12"/></g>`
      + `<path d="${circ(cx + (flip ? -1.3 : 1.2), y - 1.3, 0.9)}" fill="#FFFFFF"/>`
      + `<path d="M${f1(cx - w - 0.4)} ${f1(y + 0.3)}Q${cx} ${f1(y - 7)} ${f1(cx + w + 0.4)} ${f1(y - 0.1)}" fill="none" stroke="${mix(hairC, '#000000', 0.4)}" stroke-width="${lid}" stroke-linecap="round"/>`
      + (female ? `<path d="M${f1(cx + (flip ? w : -w))} ${f1(y - 0.4)}l${flip ? 2.2 : -2.2} -1.6" stroke="${mix(hairC, '#000000', 0.5)}" stroke-width="1.3" stroke-linecap="round"/>` : '');
  };
  const brows = `<path d="M${46 + ex} 47.2Q51.4 ${female ? 43.4 : 44.4} 56.8 46.4M63.2 46.4Q68.6 ${female ? 43.4 : 44.4} ${74 - ex} 47.2" fill="none" stroke="${mix(hairC, '#000000', 0.15)}" stroke-width="${female ? 1.5 : 2.4}" stroke-linecap="round"/>`;
  const nose = `<path d="M61.2 55.4Q62.4 60.4 61.6 62.4" fill="none" stroke="${shadowSkin}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>`
    + `<path d="${ell(60, 63.4, 3, 1.4)}" fill="${shadowSkin}" opacity=".42"/><path d="${ell(59.4, 61.4, 1.4, 0.9)}" fill="#FFFFFF" opacity=".28"/>`;
  const mouth = female
    ? `<path d="M54.6 68.2Q57.6 66.6 60 67.6Q62.4 66.6 65.4 68.2Q60 72.6 54.6 68.2Z" fill="${lip}"/><path d="M54.6 68.2Q60 69.6 65.4 68.2" fill="none" stroke="${mix(lip, '#000000', 0.35)}" stroke-width=".8"/><path d="${ell(60.6, 70, 1.8, 0.7)}" fill="#FFFFFF" opacity=".35"/>`
    : `<path d="M54.4 68.2Q60 72.4 65.6 68.2" fill="none" stroke="${mix(lip, '#000000', 0.25)}" stroke-width="1.7" stroke-linecap="round"/><path d="M57 71.6Q60 72.8 63 71.6" fill="none" stroke="${shadowSkin}" stroke-width="1" opacity=".35" stroke-linecap="round"/>`;
  const blush = female ? `<path d="${ell(48.6, 62, 4.2, 2.4) + ell(71.4, 62, 4.2, 2.4)}" fill="#FF6F86" opacity=".2"/>` : '';
  const shadeSide = female
    ? `<path d="M73 44C77 58 70 71 60 75.6C67 70 71.6 60 72.4 44Z" fill="${shadowSkin}" opacity=".3"/>`
    : `<path d="M74 44C78 58 71 71 60 76.4C68 70 72.6 60 73.4 44Z" fill="${shadowSkin}" opacity=".3"/>`;
  const hl = `<path d="${ell(54, 37.6, 9, 4.2)}" fill="#FFFFFF" opacity=".16"/><path d="${ell(49.4, 60.2, 3.6, 2.2)}" fill="#FFFFFF" opacity=".12"/>`;

  let rows = '';
  if (H.rows) {
    let d = '';
    for (let k = -3; k <= 3; k++) d += `M${f1(60 + k * 5.2)} ${f1(36.4 - Math.abs(k) * 0.3)}Q${f1(60 + k * 4.4)} 29 ${f1(60 + k * 3.2)} 25`;
    rows = `<path d="${d}" fill="none" stroke="${mix(hairC, '#000000', 0.45)}" stroke-width="1.1" opacity=".8"/>`;
  }
  const sheen = H.sheen === null ? '' : `<path d="${H.sheen || 'M49 27.4Q59 22.4 70 26'}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".2"/>`;
  const part = H.part ? `<path d="${H.part}" fill="none" stroke="${mix(hairC, '#000000', 0.4)}" stroke-width="1" opacity=".8"/>` : '';

  const back = hairPaths(H.back);
  const neck = `<path d="M51.6 66L51.6 86Q60 91 68.4 86L68.4 66Z" fill="url(#${id}sk2)"/><path d="M51.6 72Q60 80 68.4 72L68.4 66L51.6 66Z" fill="${shadowSkin}" opacity=".5"/>`;
  const collar = o.collar === 'v'
    ? `<path d="M46.6 81L60 95.4L73.4 81L69.4 79.4L60 90.2L50.6 79.4Z" fill="${kitB}"/>`
    : `<path d="M46.4 81.6Q60 94.6 73.6 81.6L70.4 79.6Q60 89.4 49.6 79.6Z" fill="${kitB}"/>`;
  const ears = `<path d="${ell(41.4, 54, 3.7, 5.8) + ell(78.6, 54, 3.7, 5.8)}" fill="url(#${id}sk2)"/><path d="${ell(41.8, 54.4, 1.6, 3.1) + ell(78.2, 54.4, 1.6, 3.1)}" fill="${shadowSkin}" opacity=".45"/>`;
  const earrings = female ? `<path d="${circ(41.4, 60.6, 1.2) + circ(78.6, 60.6, 1.2)}" fill="#F6CF6A"/>` : '';
  const front = neck + collar + ears + earrings
    + `<path d="${face}" fill="url(#${id}sk)"/>` + shadeSide + hl + blush
    + eye(51.6, false) + eye(68.4, true) + brows + nose + mouth
    + `<g filter="url(#${id}hs)">${hairPaths(H.front)}${rows}${part}</g>${sheen}`;
  return { back, front };
}

/* ------------------------------------------------------------------ body */
const NUM_FONT = "Rubik, Heebo, 'Segoe UI', Arial, sans-serif";
function numberText(n, x, y, fs, fill, stroke) {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${NUM_FONT}" font-weight="900" font-size="${fs}" fill="${fill}" stroke="${stroke}" stroke-width="${f1(fs * 0.09)}" paint-order="stroke" stroke-linejoin="round">${escXml(n)}</text>`;
}
const numFill = (kitA, kitB) => (contrast(kitA, kitB) >= 1.6 ? kitB : (lum(kitA) > 0.45 ? '#0A1A3A' : '#FFFFFF'));
function portraitBody(o, id) {
  const { kitA, kitB, num } = o;
  const torso = 'M6 122L8.6 104C11 94 21.6 88.6 34 85.6L48 81.4Q60 90 72 81.4L86 85.6C98.4 88.6 109 94 111.4 104L114 122Z';
  const seams = `<path d="M33.6 86C30 96 28.6 108 28.6 122M86.4 86C90 96 91.4 108 91.4 122" fill="none" stroke="${kitB}" stroke-width="2.4" opacity=".9"/>`;
  const shade = `<path d="M86 85.6C98.4 88.6 109 94 111.4 104L114 122L84 122C90 108 88 96 80 84Z" fill="#000000" opacity=".2"/><path d="M34 85.6C24 88 15 93 12 101L22 103C25 95 30 90 38 86Z" fill="#FFFFFF" opacity=".14"/>`;
  const fold = `<path d="M46 104Q52 110 50 122M72 100Q68 110 71 122" fill="none" stroke="#000000" stroke-width="1.6" opacity=".09"/>`;
  const number = num != null && num !== '' ? numberText(num, 76, 97, 10, numFill(kitA, kitB), mix(kitA, '#000000', 0.45)) : '';
  return `<path d="${torso}" fill="url(#${id}kit)"/>${seams}${shade}${fold}${number}`;
}
function fullBody(o, id) {
  const { kitA, kitB, num } = o;
  const shorts = contrast(kitA, kitB) >= 1.3 ? kitB : mix(kitA, '#000000', 0.5);
  const sock = kitA, boot = lum(kitA) > 0.5 ? '#14161C' : '#F4C35A';
  const side = (s, fn) => fn((x) => f1(s > 0 ? x : 120 - x));
  const arm = (s) => side(s, (X) => `<path d="M${X(33.4)} 90C${X(30)} 101 ${X(28.6)} 111 ${X(30.4)} 121L${X(36.6)} 121.4C${X(36.4)} 111 ${X(38)} 101 ${X(41)} 93Z" fill="url(#${id}sk2)"/>`
    + `<path d="${ell(s > 0 ? 33.4 : 86.6, 124.4, 4.3, 4.8)}" fill="url(#${id}sk2)"/>`);
  const leg = (s) => side(s, (X) => `<path d="M${X(42)} 144L${X(57)} 145L${X(55.6)} 156L${X(43.4)} 156Z" fill="url(#${id}sk2)"/>`
    + `<path d="M${X(43)} 155L${X(55.8)} 155L${X(54.6)} 181L${X(44.6)} 181Z" fill="${sock}"/><path d="M${X(43.2)} 158.4L${X(55.6)} 158.4L${X(55.4)} 161.4L${X(43.4)} 161.4Z" fill="${kitB}"/>`
    + `<path d="M${X(44)} 156L${X(47)} 156L${X(47.6)} 181L${X(45)} 181Z" fill="#FFFFFF" opacity=".14"/>`
    + `<path d="M${X(44.4)} 179.4L${X(54.8)} 179.4L${X(56.4)} 186.4Q${X(50)} 190.2 ${X(37.6)} 188.6Q${X(37.4)} 183 ${X(44.4)} 179.4Z" fill="${boot}"/><path d="M${X(40)} 186.4Q${X(48)} 188 ${X(55.6)} 185.6" fill="none" stroke="#FFFFFF" stroke-width=".9" opacity=".35"/>`);
  const torso = 'M36 76C40 71.6 47 69.4 53 68.4Q60 73.4 67 68.4C73 69.4 80 71.6 84 76L89.6 92L80.6 96L79.6 123Q60 127.4 40.4 123L39.4 96L30.4 92Z';
  const cuffs = `<path d="M30.4 92L39.4 96L39.8 93.4L31.4 89.4Z M89.6 92L80.6 96L80.2 93.4L88.6 89.4Z" fill="${kitB}"/>`;
  const tshade = `<path d="M84 76L89.6 92L80.6 96L79.6 123Q72 125 66 125.6C74 110 76 92 70 70Z" fill="#000000" opacity=".2"/><path d="M36 76L30.4 92L36 94C38 86 42 78 48 70.6C42 72 38 74 36 76Z" fill="#FFFFFF" opacity=".14"/>`;
  const shortsP = `<path d="M40.4 121L79.6 121L82.6 146L63.4 148L60 136L56.6 148L37.4 146Z" fill="${shorts}"/><path d="M71 121L79.6 121L82.6 146L72 147Z" fill="#000000" opacity=".2"/><path d="M40 125H80" stroke="#000000" stroke-width="1.2" opacity=".15"/>`;
  const number = num != null && num !== '' ? numberText(num, 60, 101, 17, numFill(kitA, kitB), mix(kitA, '#000000', 0.45)) : '';
  const ball = `<g transform="translate(86 179)"><path d="${circ(0, 0, 10)}" fill="url(#${id}ball)"/>`
    + `<path d="M0 -3.6L3.4 -1.1L2.1 2.9L-2.1 2.9L-3.4 -1.1Z M0 -10L0 -6.4 M9.5 -3.1L6.1 -1.1 M5.9 8.1L3.9 5.1 M-5.9 8.1L-3.9 5.1 M-9.5 -3.1L-6.1 -1.1" fill="#1A1E28" stroke="#1A1E28" stroke-width="1.1" stroke-linejoin="round"/>`
    + `<path d="${ell(-3, -4, 3.4, 2.2)}" fill="#FFFFFF" opacity=".55"/></g>`;
  return arm(1) + arm(-1) + leg(1) + leg(-1) + shortsP + `<path d="${torso}" fill="url(#${id}kit)"/>` + cuffs + tshade + number + ball;
}

/* --------------------------------------------------------------- compose */
export function avatarSVG(opts = {}) {
  const gender = opts.gender === 'f' ? 'f' : 'm';
  const id = 'av' + (++UID).toString(36);
  const seed = hashStr(opts.seed != null ? opts.seed : `${gender}|${opts.skin}|${opts.hair}|${opts.number}`);
  const skinIdx = typeof opts.skin === 'number' ? opts.skin : (/^\d+$/.test(String(opts.skin)) ? Number(opts.skin) : 2);
  const skinC = skinHex(opts.skin == null ? 2 : opts.skin);
  const hairC = hairHex(opts.hairColor, skinIdx);
  const style = hairId(gender, opts.hair);
  const eyeC = EYES[skinIdx <= 1 ? seed % EYES.length : seed % 4];
  const kit = Array.isArray(opts.kitColors) ? opts.kitColors : ['#1E6FE0', '#FFFFFF'];
  const kitA = normHex(kit[0], '#1E6FE0');
  let kitB = normHex(kit[1], '#FFFFFF');
  if (contrast(kitA, kitB) < 1.25) kitB = lum(kitA) > 0.45 ? '#0A1A3A' : '#FFFFFF';
  const full = opts.pose === 'full';
  const size = opts.size || (full ? 160 : 96);
  const VH = full ? 200 : 120;
  const o = { gender, skinC, hairC, eyeC, kitA, kitB, style, num: opts.number, collar: seed % 3 === 0 ? 'v' : 'crew' };
  const hd = headLayers(o, id);
  const bg = opts.bg !== false;
  const bgTop = mix(kitA, '#0A1530', lum(kitA) > 0.5 ? 0.78 : 0.55);
  const R = full ? 18 : 16;

  const defs = `<defs>`
    + `<radialGradient id="${id}sk" cx=".4" cy=".34" r=".78"><stop offset="0" stop-color="${mix(skinC, '#FFFFFF', 0.2)}"/><stop offset=".55" stop-color="${skinC}"/><stop offset="1" stop-color="${mix(skinC, '#3A1408', 0.28)}"/></radialGradient>`
    + `<linearGradient id="${id}sk2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${mix(skinC, '#FFFFFF', 0.08)}"/><stop offset=".6" stop-color="${skinC}"/><stop offset="1" stop-color="${mix(skinC, '#3A1408', 0.3)}"/></linearGradient>`
    + `<linearGradient id="${id}hr" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="${mix(hairC, '#FFFFFF', 0.24)}"/><stop offset=".45" stop-color="${hairC}"/><stop offset="1" stop-color="${mix(hairC, '#000000', 0.4)}"/></linearGradient>`
    + `<linearGradient id="${id}kit" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="${mix(kitA, '#FFFFFF', 0.16)}"/><stop offset=".5" stop-color="${kitA}"/><stop offset="1" stop-color="${mix(kitA, '#000000', 0.3)}"/></linearGradient>`
    + `<radialGradient id="${id}ball" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#E4E9F2"/><stop offset="1" stop-color="#9AA6BA"/></radialGradient>`
    + `<linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="#050B1A"/></linearGradient>`
    + `<radialGradient id="${id}spot" cx=".5" cy="${full ? 0.3 : 0.38}" r=".62"><stop offset="0" stop-color="#BFF7EE" stop-opacity=".42"/><stop offset=".5" stop-color="#7DF0E2" stop-opacity=".1"/><stop offset="1" stop-color="#7DF0E2" stop-opacity="0"/></radialGradient>`
    + `<filter id="${id}hs" x="-.2" y="-.2" width="1.4" height="1.5"><feDropShadow dx="0" dy="1.3" stdDeviation="1" flood-color="#000" flood-opacity=".35"/></filter>`
    + `<filter id="${id}rim" x="-.1" y="-.1" width="1.2" height="1.2" color-interpolation-filters="sRGB">`
    + `<feOffset in="SourceAlpha" dx="-2" dy=".8" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="e"/><feGaussianBlur in="e" stdDeviation=".5" result="b"/>`
    + `<feFlood flood-color="#A8F7EC" flood-opacity=".75"/><feComposite in2="b" operator="in" result="r"/>`
    + `<feOffset in="SourceAlpha" dx="1.6" dy="0" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="e2"/><feGaussianBlur in="e2" stdDeviation=".6" result="b2"/>`
    + `<feFlood flood-color="#FFD9A0" flood-opacity=".35"/><feComposite in2="b2" operator="in" result="r2"/>`
    + `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="r"/><feMergeNode in="r2"/></feMerge></filter>`
    + `<clipPath id="${id}clip"><rect width="120" height="${VH}" rx="${R}"/></clipPath>`
    + `</defs>`;

  let back = '';
  if (bg) {
    back += `<rect width="120" height="${VH}" rx="${R}" fill="url(#${id}bg)"/>`;
    back += `<path d="M18 0L34 0L70 ${VH}L40 ${VH}Z M78 0L90 0L112 ${VH}L92 ${VH}Z" fill="#FFFFFF" opacity=".045"/>`;
    if (opts.number != null && opts.number !== '') back += `<text x="${full ? 96 : 98}" y="${full ? 40 : 30}" text-anchor="middle" dominant-baseline="central" font-family="${NUM_FONT}" font-weight="900" font-size="${full ? 44 : 34}" fill="#FFFFFF" opacity=".07">${escXml(opts.number)}</text>`;
    back += `<rect width="120" height="${VH}" fill="url(#${id}spot)"/>`;
    if (full) back += `<path d="${ell(60, 189, 40, 6)}" fill="#7DF0E2" opacity=".12"/>`;
  }
  let figure;
  if (full) {
    const T = 'translate(12 1.6) scale(.8)';
    figure = `<path d="${ell(62, 189.4, 30, 4.4)}" fill="#000000" opacity=".45"/>`
      + `<g filter="url(#${id}rim)"><g transform="${T}">${hd.back}</g>${fullBody(o, id)}<g transform="${T}">${hd.front}</g></g>`;
  } else {
    figure = `<g transform="translate(-15 -10.5) scale(1.25)"><g filter="url(#${id}rim)">${hd.back}${portraitBody(o, id)}${hd.front}</g></g>`;
  }
  const label = opts.title ? ` role="img" aria-label="${escXml(opts.title)}"` : ' aria-hidden="true" focusable="false"';
  const h = Math.round((size * VH) / 120);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 ${VH}" width="${size}" height="${h}" class="avatar avatar-${full ? 'full' : 'portrait'}"${label}>${defs}<g clip-path="url(#${id}clip)">${back}${figure}</g></svg>`;
}

/** Random-but-deterministic look for a seed (wizard "random" button, old saves). */
export function lookFromSeed(seed, gender = 'm') {
  const h = hashStr('look|' + seed);
  const skin = h % SKIN_TONES.length;
  const styles = HAIR_STYLES[gender === 'f' ? 'f' : 'm'];
  const hair = styles[(h >>> 5) % styles.length].id;
  const pool = skin >= 3 ? [0, 0, 1, 1, 2] : [0, 1, 2, 2, 3, 4, 5];
  return { skin, hair, hairColor: pool[(h >>> 11) % pool.length] };
}

/** Deterministic avatar options from save meta / hub / profile objects. */
export function avatarFromMeta(meta = {}) {
  const m = meta || {};
  const p = m.player || m;
  const gender = (p.gender || m.gender) === 'f' ? 'f' : 'm';
  const seed = m.careerId || m.id || p.id || p.name || m.name || 'player';
  const look = p.look || m.look || {};
  const auto = lookFromSeed(seed, gender);
  const kit = m.kitColors || m.colors || (m.club && m.club.colors) || (p.club && p.club.colors) || ['#1E6FE0', '#FFFFFF'];
  return {
    gender,
    skin: look.skin != null ? look.skin : auto.skin,
    hair: look.hair != null ? look.hair : auto.hair,
    hairColor: look.hairColor != null ? look.hairColor : auto.hairColor,
    kitColors: kit,
    number: p.num != null ? p.num : (m.num != null ? m.num : m.number),
    seed: String(seed),
  };
}
export function avatarForMeta(meta, extra = {}) { return avatarSVG({ ...avatarFromMeta(meta), ...extra }); }

// shop-art.js: crafted SVG illustrations for the store (R4). Pure string builders, no DOM.
// itemArt(id, cat) -> '<svg ...>' (120x100 scene); catIcon(key) -> 24x24 line icon; storeCat(item, engineCat) -> display category.
// Unknown ids fall back by keyword (watch / chain / boot / invest ...) and then by category, so new engine items always get art.

let uid = 0;
const nid = (p) => p + (++uid).toString(36);

/* ------------------------------------------------------------------ */
/* Display categories (owner list R4) + a family tab when the engine has family gifts */
/* ------------------------------------------------------------------ */

export const STORE_CATS = [
  { key: 'cars', he: 'רכבים', glow: 'rgba(111,183,255,.32)' },
  { key: 'estate', he: 'נדל"ן', glow: 'rgba(47,227,207,.28)' },
  { key: 'watch', he: 'שעונים ותכשיטים', glow: 'rgba(244,195,90,.34)' },
  { key: 'gear', he: 'ציוד ונעליים', glow: 'rgba(255,120,150,.26)' },
  { key: 'invest', he: 'השקעות', glow: 'rgba(43,208,122,.30)' },
  { key: 'family', he: 'משפחה וקהילה', glow: 'rgba(255,181,71,.28)' },
];

/** Map an engine item (+ its engine category id) to a display category key. */
export function storeCat(it, engineCat) {
  const id = String((it && it.id) || '').toLowerCase();
  const c = String(engineCat || (it && it.cat) || '').toLowerCase();
  if (/watch|jewel|chain|ring|bracelet|diamond|necklace/.test(id) || /watch|jewel/.test(c)) return 'watch';
  if (/^car|car_|_car/.test(id) || /^cars?$|vehicle/.test(c)) return 'cars';
  if (/^home|estate|house|apt|villa|pent|flat|land/.test(id) || /home|estate|real/.test(c)) return 'estate';
  if (/invest|stock|fund|bond|crypto|business|rest|cafe|academy|startup|shares/.test(id) || /invest|business/.test(c)) return 'invest';
  if (/boot|shoe|gear|kit|wardrobe|cloth|style|head|phone|bag|glove|sneak/.test(id) || /gear|style|equip/.test(c)) return 'gear';
  if (/fam|parent|trip|field|gift|charity/.test(id) || /family|gift/.test(c)) return 'family';
  return 'gear';
}

/* ------------------------------------------------------------------ */
/* Category icons (stroke = currentColor)                              */
/* ------------------------------------------------------------------ */

const CAT_ICONS = {
  cars: '<path d="M3.5 15.5v-3l2-4.2A2 2 0 0 1 7.3 7h9.4a2 2 0 0 1 1.8 1.3l2 4.2v3"/><path d="M2.5 15.5h19v2.5h-19z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/><path d="M6 12.5h12"/>',
  estate: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9.5 21v-5h5v5M9 11h2M13 11h2"/>',
  watch: '<circle cx="12" cy="12" r="5.5"/><path d="M9 6.8 9.8 3h4.4l.8 3.8M9 17.2l.8 3.8h4.4l.8-3.8M12 9.5V12l1.8 1.2"/>',
  gear: '<path d="M3 15.5c0-1 .6-1.6 1.6-1.8l4.6-.9 2.6-5.3h3l.4 3.2c.2 1.4 1.2 2.4 2.6 2.7l2.4.5c1 .2 1.8 1 1.8 2v1.6H3z"/><path d="M5 17.5v1.5M9 17.5v1.5M13 17.5v1.5M17 17.5v1.5"/>',
  invest: '<path d="M3 20h18"/><path d="M5 16l4-4 3 2.5L19 7"/><path d="M15 7h4v4"/>',
  family: '<path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  owned: '<path d="M5 12.5 10 17l9-10"/>',
};
export function catIcon(key) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${CAT_ICONS[key] || CAT_ICONS.all}</svg>`;
}
export function catGlow(key) { const c = STORE_CATS.find((x) => x.key === key); return c ? c.glow : 'rgba(111,183,255,.28)'; }

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const svg = (inner, defs = '') => `<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;
const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;

function wheel(x, y, r, rimId) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#0B0F17"/><circle cx="${x}" cy="${y}" r="${r * 0.66}" fill="url(#${rimId})"/>
    <g stroke="#56637A" stroke-width="1.2">${[0, 72, 144, 216, 288].map((a) => { const t = a * Math.PI / 180; return `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(t) * r * 0.6).toFixed(1)}" y2="${(y + Math.sin(t) * r * 0.6).toFixed(1)}"/>`; }).join('')}</g>
    <circle cx="${x}" cy="${y}" r="${r * 0.2}" fill="#2A3344"/>`;
}

/** Side-view car. body: path; glass: path; c1/c2 body gradient; wheels: [[x,r],[x,r]]; extras: svg string. */
function car({ body, glass, c1, c2, wheels, extras = '', lights = [104, 60], tail = [12, 61], line = '' }) {
  const g = nid('cb'), w = nid('cg'), rim = nid('cr'), hl = nid('ch');
  const defs = lin(g, [[0, c1], [1, c2]]) + lin(w, [[0, '#BFE3FF'], [0.55, '#4D6E9A'], [1, '#1B2840']]) + rad(rim, [[0, '#F2F5FA'], [0.7, '#9AA6B8'], [1, '#5D687B']]) + rad(hl, [[0, '#FFF6D0'], [1, '#FFE07A', 0]]);
  return svg(`<ellipse cx="60" cy="80" rx="52" ry="5" fill="#000" opacity=".45"/>
    <path d="${body}" fill="url(#${g})"/>
    <path d="${body}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
    <path d="${glass}" fill="url(#${w})" stroke="#0B1220" stroke-width="1.2"/>
    ${line ? `<path d="${line}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/>` : ''}
    ${extras}
    <ellipse cx="${lights[0]}" cy="${lights[1]}" rx="4" ry="2.2" fill="#FFF3C4"/><circle cx="${lights[0] + 3}" cy="${lights[1]}" r="9" fill="url(#${hl})" opacity=".7"/>
    <rect x="${tail[0] - 2}" y="${tail[1] - 1.8}" width="4" height="3.6" rx="1.2" fill="#FF3B4E"/>
    ${wheels.map(([x, r]) => wheel(x, 72, r, rim)).join('')}`, defs);
}

/* ------------------------------------------------------------------ */
/* Cars                                                                */
/* ------------------------------------------------------------------ */

const ART = {
  car_old: () => car({
    body: 'M10 72V58q0-5 5-5.5l17-1.5 9-11.5q1.6-2 4.2-2H92q4 0 5.6 3.6L103 52q8 1 8 7.5V72z',
    glass: 'M44 41.5h18v10H36.5zM65 41.5h25.5q2 0 3 2l4 8H65z',
    c1: '#7FA7A0', c2: '#3E615D', wheels: [[30, 9], [91, 9]], lights: [107, 59], tail: [12, 60],
    line: 'M14 62h92',
    extras: '<rect x="44" y="34.5" width="44" height="2.6" rx="1.3" fill="#2C3A44"/><circle cx="23" cy="66" r="2.6" fill="#8A5A2B" opacity=".75"/><circle cx="26.5" cy="64.5" r="1.4" fill="#8A5A2B" opacity=".6"/><rect x="58" y="57" width="7" height="1.6" rx=".8" fill="#20302E"/>',
  }),
  car_city: () => car({
    body: 'M15 72V61q0-5.5 6-6.5l11-2q10-15 28-15.5h14q14 .5 23 14.5l6 3.5q4 2 4 7V72z',
    glass: 'M37 52.5q8-11 22-11.5h3v11.5zM65 41h8q10 .5 17 11.5H65z',
    c1: '#FF5A6A', c2: '#B3172E', wheels: [[33, 8.5], [88, 8.5]], lights: [103, 60], tail: [17, 59],
    line: 'M20 62h80',
    extras: '<rect x="62" y="57" width="6" height="1.6" rx=".8" fill="#5C0F1C"/>',
  }),
  car_family: () => car({
    body: 'M8 72v-10q0-5.5 6-6.5L33 53l11-10.5q3-3 9-3h22q6 0 9 3.5L95 53l13 2q5 1 5 7v10z',
    glass: 'M37 53l9-9q2-2 6-2h10v11zM65 42h9q4 0 6 2.5L88 53H65z',
    c1: '#D9E3EE', c2: '#7D8DA3', wheels: [[29, 9], [93, 9]], lights: [109, 61], tail: [10, 61],
    line: 'M12 63h97',
    extras: '<rect x="60" y="58" width="7" height="1.6" rx=".8" fill="#4A586C"/>',
  }),
  car_lux: () => car({
    body: 'M7 72v-8q0-5 6-6l21-3.5q12-13 28-13.5h12q13 .5 23 12l12 3q5 1.3 5 7.5V72z',
    glass: 'M39 54.5q9-9.5 22-10h3v10zM67 44.5h7q10 .5 17 9.5l-24 .5z',
    c1: '#3C4656', c2: '#0E131C', wheels: [[29, 9.5], [94, 9.5]], lights: [108, 62], tail: [9, 62],
    line: 'M12 64q48-3 98 0',
    extras: '<circle cx="29" cy="72" r="3.4" fill="none" stroke="#FF3B4E" stroke-width="2" opacity=".85"/><circle cx="94" cy="72" r="3.4" fill="none" stroke="#FF3B4E" stroke-width="2" opacity=".85"/><path d="M48 66h22" stroke="#C3CEDD" stroke-width="1.2" opacity=".5"/>',
  }),
  car_super: () => car({
    body: 'M5 72v-6l6-5q30-12 52-15.5h14q14 1.2 27 9.5l9 5q3 2 3 6V72z',
    glass: 'M44 55q12-6 26-7.5h6l12 7.5z',
    c1: '#FFD23A', c2: '#E07A10', wheels: [[28, 9.5], [95, 9.5]], lights: [109, 64], tail: [8, 65],
    line: 'M14 63q46-12 92 2',
    extras: '<path d="M60 60l14 5h-20z" fill="#1A1206" opacity=".55"/><path d="M8 62l9-3 2 3z" fill="#1A1206" opacity=".6"/><path d="M20 66h18" stroke="#1A1206" stroke-width="1.4" opacity=".5"/>',
  }),

  /* ---------------- real estate ---------------- */
  home_room: () => {
    const wall = nid('w'), fl = nid('f'), bl = nid('b');
    return svg(`<rect x="12" y="14" width="96" height="58" rx="4" fill="url(#${wall})"/>
      <path d="M12 72h96l8 16H4z" fill="url(#${fl})"/>
      <rect x="22" y="22" width="20" height="26" rx="2" fill="#FFE7A3" opacity=".9"/><path d="M22 35h20M32 22v26" stroke="#3A4B6A" stroke-width="2"/>
      <rect x="50" y="22" width="14" height="19" rx="1.5" fill="#2FE3CF"/><circle cx="57" cy="29" r="3.5" fill="#fff" opacity=".9"/><path d="M52 39q5-6 10 0" fill="#fff" opacity=".8"/>
      <rect x="68" y="24" width="12" height="16" rx="1.5" fill="#FF5468"/><path d="M71 36l3-8 3 8z" fill="#FFE7A3"/>
      <rect x="40" y="56" width="62" height="20" rx="4" fill="#E9EEF7"/><rect x="40" y="62" width="62" height="14" rx="3" fill="url(#${bl})"/>
      <rect x="86" y="52" width="16" height="9" rx="3" fill="#fff"/>
      <path d="M38 52v26M104 50v28" stroke="#5B4632" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="80" r="7" fill="#fff"/><path d="M24 73l3 4-1.6 4.4h-2.8L21 77zM17.6 79l3.4-2 1.6 4.4-2 3.2M30.4 79l-3.4-2-1.6 4.4 2 3.2" fill="#0B1220"/>
      <path d="M90 14v6" stroke="#9AABC8" stroke-width="1.5"/><path d="M84 20h12l-2 6h-8z" fill="#FFD36E"/><ellipse cx="90" cy="30" rx="12" ry="5" fill="#FFE7A3" opacity=".22"/>`,
      lin(wall, [[0, '#2A3E62'], [1, '#1B2944']]) + lin(fl, [[0, '#6B4E33'], [1, '#3B2A1B']]) + lin(bl, [[0, '#2F6FD0'], [1, '#1D4ED8']]));
  },
  home_apt: () => {
    const b = nid('b'), sky = nid('s');
    const win = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const lit = (r * 7 + c * 3) % 5 !== 0;
      win.push(`<rect x="${40 + c * 11}" y="${24 + r * 13}" width="7" height="8" rx="1" fill="${lit ? '#FFD87A' : '#2A3A5A'}"${lit ? ' opacity=".95"' : ''}/>`);
    }
    return svg(`<circle cx="98" cy="18" r="7" fill="#FFF3C4" opacity=".85"/><circle cx="101" cy="16" r="6" fill="#16243C"/>
      <rect x="34" y="16" width="52" height="64" rx="2" fill="url(#${b})"/>
      <rect x="34" y="12" width="52" height="5" rx="1" fill="#4B5F86"/>
      ${win.join('')}
      ${[0, 1, 2].map((r) => `<rect x="36" y="${33 + r * 13}" width="48" height="2" fill="#8FA3C6" opacity=".7"/>`).join('')}
      <rect x="54" y="66" width="12" height="14" rx="1.5" fill="#0F1A2C"/><rect x="55.5" y="68" width="9" height="6" fill="#FFD87A" opacity=".6"/>
      <rect x="10" y="44" width="20" height="36" rx="1.5" fill="#22345A"/><rect x="14" y="50" width="5" height="6" fill="#FFD87A" opacity=".7"/><rect x="21" y="60" width="5" height="6" fill="#FFD87A" opacity=".5"/>
      <rect x="90" y="38" width="22" height="42" rx="1.5" fill="#1D2C4C"/><rect x="94" y="44" width="5" height="6" fill="#FFD87A" opacity=".6"/><rect x="102" y="56" width="5" height="6" fill="#FFD87A" opacity=".8"/>
      <circle cx="26" cy="70" r="9" fill="#1F9D5E"/><circle cx="20" cy="74" r="6" fill="#2CC86E"/><rect x="25" y="74" width="2.4" height="8" fill="#5B4632"/>
      <rect x="4" y="80" width="112" height="6" rx="2" fill="#2A3344"/>`,
      lin(b, [[0, '#3B5687'], [1, '#22355C']]) + lin(sky, [[0, '#000'], [1, '#000']]));
  },
  home_pent: () => {
    const t = nid('t'), gl = nid('g'), sea = nid('s'), sun = nid('u');
    return svg(`<circle cx="26" cy="58" r="16" fill="url(#${sun})"/>
      <path d="M0 64h120v24H0z" fill="url(#${sea})"/>
      <path d="M4 70q8-3 16 0t16 0 16 0M46 76q8-3 16 0t16 0M70 70q8-3 16 0t16 0" fill="none" stroke="#BFE3FF" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="58" y="22" width="40" height="66" rx="2" fill="url(#${t})"/>
      ${[0, 1, 2, 3, 4].map((r) => `<rect x="62" y="${34 + r * 10}" width="32" height="5" rx="1" fill="#9CC6F2" opacity="${0.35 + (r % 2) * 0.2}"/>`).join('')}
      <rect x="54" y="10" width="48" height="14" rx="2" fill="url(#${gl})" stroke="#FFE7A3" stroke-width="1.4"/>
      <path d="M54 24h48" stroke="#FFE7A3" stroke-width="2"/><path d="M66 10v14M78 10v14M90 10v14" stroke="#FFE7A3" stroke-opacity=".6" stroke-width="1"/>
      <rect x="50" y="23" width="56" height="2.6" rx="1.3" fill="#E9EEF7"/>
      <path d="M104 23v-7M108 23v-5" stroke="#2CC86E" stroke-width="2" stroke-linecap="round"/><circle cx="104" cy="15" r="3" fill="#2CC86E"/>`,
      lin(t, [[0, '#E2EAF5'], [1, '#8B9BB5']]) + lin(gl, [[0, '#FFF3C4'], [1, '#F4C35A']]) + lin(sea, [[0, '#2F6FD0'], [1, '#0B2A5C']]) + rad(sun, [[0, '#FFE7A3'], [0.55, '#F59B45', 0.8], [1, '#F59B45', 0]]));
  },
  home_villa: () => {
    const w = nid('w'), pool = nid('p'), gl = nid('g');
    return svg(`<path d="M6 60h72v16H6z" fill="url(#${w})"/>
      <path d="M30 38h64v22H30z" fill="url(#${w})"/>
      <path d="M26 36h72v4H26zM2 58h80v3H2z" fill="#F1F5FA"/>
      <rect x="36" y="43" width="22" height="14" rx="1" fill="url(#${gl})"/><rect x="62" y="43" width="26" height="14" rx="1" fill="url(#${gl})"/>
      <rect x="12" y="63" width="18" height="11" rx="1" fill="url(#${gl})"/><rect x="34" y="63" width="12" height="13" fill="#3B2A1B"/><rect x="50" y="63" width="22" height="11" rx="1" fill="url(#${gl})"/>
      <path d="M2 80h116l-6 8H8z" fill="#2A3344"/>
      <path d="M20 79q30-5 92 0v5H14z" fill="url(#${pool})"/>
      <path d="M30 81q6-2 12 0t12 0M64 81q6-2 12 0t12 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M104 78q-1-22 3-36" fill="none" stroke="#6B4E33" stroke-width="3" stroke-linecap="round"/>
      <path d="M107 42q-12-4-18 4M107 42q-10 4-12 14M107 42q4-10 12-10M107 42q10 2 11 12M107 42q-2-10-10-12" fill="none" stroke="#2CC86E" stroke-width="3.4" stroke-linecap="round"/>`,
      lin(w, [[0, '#FFFFFF'], [1, '#C9D3E2']]) + lin(pool, [[0, '#7DF0E2'], [1, '#1FA89A']]) + lin(gl, [[0, '#FFE7A3'], [1, '#E7A949']]));
  },

  /* ---------------- family & community ---------------- */
  fam_trip: () => {
    const p = nid('p'), cl = nid('c');
    return svg(`<path d="M8 74q4-10 16-8 4-9 15-6 6-5 13 1 10-1 10 9H8z" fill="url(#${cl})"/>
      <path d="M66 82q3-8 12-6 4-7 12-4 8-2 9 6 7 0 7 6H66z" fill="url(#${cl})" opacity=".8"/>
      <path d="M14 58q30-26 70-34" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="3 4"/>
      <g transform="rotate(-18 76 36)">
        <path d="M44 36q0-5 6-5h44q10 0 14 5-4 5-14 5H50q-6 0-6-5z" fill="url(#${p})"/>
        <path d="M70 31 58 14h7l18 17zM70 41 58 58h7l18-17zM46 33l-6-10h5l8 9z" fill="#C9D3E2"/>
        <path d="M100 33q5 1 8 3" stroke="#2F6FD0" stroke-width="3" stroke-linecap="round"/>
        ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${60 + i * 7}" cy="35" r="1.5" fill="#2F6FD0"/>`).join('')}
        <path d="M44 36h60" stroke="#2F6FD0" stroke-width="1.2" opacity=".6"/>
      </g>`,
      lin(p, [[0, '#FFFFFF'], [1, '#B9C6D8']]) + lin(cl, [[0, '#FFFFFF'], [1, '#C9D6EA']]));
  },
  fam_parents: () => {
    const w = nid('w'), r = nid('r');
    return svg(`<path d="M22 50 60 22l38 28v32H22z" fill="url(#${w})"/>
      <path d="M16 52 60 18l44 34-4 4-40-30-40 30z" fill="url(#${r})"/>
      <rect x="32" y="56" width="16" height="13" rx="1.5" fill="#FFD87A"/><path d="M40 56v13M32 62.5h16" stroke="#8A5A2B" stroke-width="1.6"/>
      <rect x="72" y="56" width="16" height="13" rx="1.5" fill="#FFD87A"/><path d="M80 56v13M72 62.5h16" stroke="#8A5A2B" stroke-width="1.6"/>
      <rect x="53" y="60" width="14" height="22" rx="1.5" fill="#8A5A2B"/><circle cx="64" cy="71" r="1.2" fill="#FFE7A3"/>
      <path d="M8 82h104" stroke="#2CC86E" stroke-width="5" stroke-linecap="round"/>
      <path d="M60 14s-9-5.6-9-11.2A4.6 4.6 0 0 1 60 0a4.6 4.6 0 0 1 9 2.8C69 8.4 60 14 60 14z" fill="#FF5468" transform="translate(0 2)"/>
      <path d="M96 30l3-3 3 3-3 3zM18 34l2-2 2 2-2 2zM104 46l2-2 2 2-2 2z" fill="#FFE7A3"/>`,
      lin(w, [[0, '#F4E6D2'], [1, '#D4BC9C']]) + lin(r, [[0, '#E0574A'], [1, '#A23126']]));
  },
  fam_field: () => {
    const g = nid('g'), l = nid('l');
    return svg(`<path d="M24 46h72l20 36H4z" fill="url(#${g})"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${24 + i * 12} 46h12l${3.3 + i * 0.1} 36H${4 + i * 18.6}z" fill="#000" opacity="${i % 2 ? 0.08 : 0}"/>`).join('')}
      <path d="M24 46h72l20 36H4z" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.3"/>
      <path d="M60 46v36M14 64h92" stroke="#fff" stroke-opacity=".6" stroke-width="1.1"/>
      <ellipse cx="60" cy="64" rx="13" ry="5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.1"/>
      <path d="M52 46v-5h16v5" fill="none" stroke="#fff" stroke-width="1.6"/>
      <path d="M8 46V14M112 46V14" stroke="#6E819F" stroke-width="2.4"/>
      <rect x="2" y="9" width="13" height="7" rx="1.5" fill="#E9EEF7"/><rect x="105" y="9" width="13" height="7" rx="1.5" fill="#E9EEF7"/>
      <path d="M8 16 30 60H0zM112 16 90 60h30z" fill="url(#${l})"/>
      <rect x="40" y="26" width="40" height="11" rx="2" fill="#0F1A2C" stroke="#F4C35A" stroke-width="1.2"/>
      <path d="M46 31.5h28" stroke="#FFE7A3" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="4 2.5"/>`,
      lin(g, [[0, '#2BD07A'], [1, '#13844B']]) + lin(l, [[0, '#FFF6D0', 0.55], [1, '#FFF6D0', 0]]));
  },

  /* ---------------- style / gear ---------------- */
  style_wardrobe: () => {
    const j = nid('j');
    return svg(`<path d="M14 18h92" stroke="#C9D3E2" stroke-width="3" stroke-linecap="round"/><path d="M18 18v66M102 18v66" stroke="#9AA8BC" stroke-width="2.4"/>
      <path d="M12 84h16M92 84h16" stroke="#9AA8BC" stroke-width="3" stroke-linecap="round"/>
      ${[30, 52, 74, 92].map((x) => `<path d="M${x} 18v4q-3 1-2 3" fill="none" stroke="#C9D3E2" stroke-width="1.4"/>`).join('')}
      <path d="M22 26l8-3 8 3 4 14-4 1v30H22V41l-4-1z" fill="url(#${j})"/><path d="M30 23v48" stroke="#0B1220" stroke-opacity=".5"/>
      <path d="M44 26l8-3 8 3 5 10-5 2v28H44V38l-5-2z" fill="#F4C35A"/><path d="M48 26l4 6 4-6" fill="none" stroke="#8A5A2B" stroke-width="1.2"/>
      <path d="M66 26l8-3 8 3 4 8-4 2v32H66V36l-4-2z" fill="#FF5468"/><path d="M70 40h8M70 46h8" stroke="#fff" stroke-opacity=".5"/>
      <path d="M86 26l6-3 6 3v44h-4l-2-20-2 20h-4z" fill="#2F6FD0"/>
      <path d="M40 80q0-4 4-4h10l6 4z" fill="#F1F5FA"/><path d="M62 80q0-4 4-4h10l6 4z" fill="#F1F5FA"/>`,
      lin(j, [[0, '#3C4656'], [1, '#0E131C']]));
  },
  style_watch: () => {
    const c = nid('c'), d = nid('d'), s = nid('s');
    return svg(`<path d="M48 6h24l-3 22H51zM51 72h18l3 22H48z" fill="url(#${s})"/>
      ${[10, 15, 20, 76, 81, 86].map((y) => `<path d="M${y < 50 ? 50 : 50} ${y}h20" stroke="#5B4214" stroke-opacity=".35" stroke-width="1"/>`).join('')}
      <circle cx="60" cy="50" r="27" fill="url(#${c})"/>
      <circle cx="60" cy="50" r="21.5" fill="url(#${d})" stroke="#5B4214" stroke-width="1"/>
      ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; const r1 = i % 3 === 0 ? 15.5 : 17.5; return `<line x1="${(60 + Math.sin(a) * r1).toFixed(1)}" y1="${(50 - Math.cos(a) * r1).toFixed(1)}" x2="${(60 + Math.sin(a) * 19.5).toFixed(1)}" y2="${(50 - Math.cos(a) * 19.5).toFixed(1)}" stroke="#FFE7A3" stroke-width="${i % 3 === 0 ? 2.2 : 1.2}" stroke-linecap="round"/>`; }).join('')}
      <path d="M60 50 60 36" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M60 50 70 55" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M60 50 50 42" stroke="#FF5468" stroke-width="1" stroke-linecap="round"/>
      <circle cx="60" cy="50" r="2" fill="#FFE7A3"/>
      <rect x="85" y="46" width="6" height="8" rx="1.5" fill="url(#${s})"/>
      <path d="M44 30q8-6 18-6" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`,
      lin(c, [[0, '#FFF3C4'], [0.45, '#E7B34E'], [1, '#8A5A16']], 1, 1) + rad(d, [[0, '#24365C'], [1, '#0B1428']], 0.4, 0.35, 0.7) + lin(s, [[0, '#F7D88A'], [1, '#B07A18']], 1, 0));
  },
};

/* keyword fallbacks for items the v2 data does not have yet */
const KEYWORD_ART = [
  [/chain|necklace|pendant/, () => {
    const g = nid('g');
    return svg(`<path d="M22 14q38 70 76 0" fill="none" stroke="url(#${g})" stroke-width="5" stroke-dasharray="6 3" stroke-linecap="round"/>
      <path d="M60 52l14 10-14 22-14-22z" fill="url(#${g})" stroke="#8A5A16" stroke-width="1.2"/><path d="M60 52v32M46 62h28" stroke="#FFF3C4" stroke-opacity=".7"/>
      <path d="M86 24l3-3 3 3-3 3zM28 36l2-2 2 2-2 2z" fill="#FFF3C4"/>`, lin(g, [[0, '#FFF3C4'], [0.5, '#E7B34E'], [1, '#9A6A16']], 1, 1));
  }],
  [/ring|diamond|jewel|bracelet/, () => {
    const g = nid('g'), d = nid('d');
    return svg(`<ellipse cx="60" cy="64" rx="26" ry="22" fill="none" stroke="url(#${g})" stroke-width="7"/>
      <path d="M48 40l6-12h12l6 12-12 12z" fill="url(#${d})" stroke="#E9F6FF" stroke-width="1"/><path d="M48 40h24M54 28l6 24 6-24" stroke="#fff" stroke-opacity=".6" stroke-width=".8" fill="none"/>
      <path d="M84 24l3-3 3 3-3 3zM30 30l2-2 2 2-2 2zM92 44l2-2 2 2-2 2z" fill="#E9F6FF"/>`,
    lin(g, [[0, '#FFF3C4'], [1, '#B07A18']], 1, 1) + lin(d, [[0, '#E9F6FF'], [1, '#6FB7FF']], 1, 1));
  }],
  [/watch/, () => ART.style_watch()],
  [/boot|shoe|cleat|sneak/, () => {
    const g = nid('g');
    return svg(`<ellipse cx="60" cy="80" rx="48" ry="4" fill="#000" opacity=".4"/>
      <path d="M14 70q0-8 8-10l26-6 12-22h18l2 14q2 8 10 10l12 3q10 2 10 11v4H14z" fill="url(#${g})"/>
      <path d="M62 34l-6 14M68 34l-5 14M74 34l-4 14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M30 62q30-6 60 8" fill="none" stroke="#FFE7A3" stroke-width="3" stroke-linecap="round"/>
      <path d="M14 74h94" stroke="#0B1220" stroke-width="3"/>
      ${[22, 36, 50, 74, 88, 100].map((x) => `<rect x="${x}" y="76" width="5" height="5" rx="1" fill="#C9D3E2"/>`).join('')}`,
    lin(g, [[0, '#FF5468'], [1, '#9B1C3A']], 1, 1));
  }],
  [/head|phone|audio/, () => {
    const g = nid('g');
    return svg(`<path d="M28 62V52a32 32 0 0 1 64 0v10" fill="none" stroke="url(#${g})" stroke-width="7" stroke-linecap="round"/>
      <rect x="18" y="56" width="20" height="28" rx="8" fill="url(#${g})"/><rect x="82" y="56" width="20" height="28" rx="8" fill="url(#${g})"/>
      <rect x="22" y="61" width="12" height="18" rx="5" fill="#0B1220" opacity=".55"/><rect x="86" y="61" width="12" height="18" rx="5" fill="#0B1220" opacity=".55"/>`,
    lin(g, [[0, '#E9EEF7'], [1, '#7D8DA3']]));
  }],
  [/invest|stock|fund|share|bond|crypto/, () => {
    const g = nid('g'), c = nid('c');
    return svg(`<rect x="12" y="14" width="96" height="66" rx="8" fill="#0F1A2C" stroke="#2A3E62" stroke-width="1.4"/>
      ${[30, 46, 62].map((y) => `<path d="M20 ${y}h80" stroke="#2A3E62" stroke-dasharray="2 3"/>`).join('')}
      <path d="M20 66l16-12 14 6 18-20 14 6 18-18v50H20z" fill="url(#${g})" opacity=".35"/>
      <path d="M20 66l16-12 14 6 18-20 14 6 18-18" fill="none" stroke="#2CC86E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M92 28h8v8" fill="none" stroke="#2CC86E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="30" cy="84" rx="12" ry="4" fill="url(#${c})"/><ellipse cx="30" cy="80" rx="12" ry="4" fill="url(#${c})"/><ellipse cx="30" cy="76" rx="12" ry="4" fill="url(#${c})" stroke="#8A5A16" stroke-width=".8"/>`,
    lin(g, [[0, '#2CC86E'], [1, '#2CC86E', 0]]) + lin(c, [[0, '#FFF3C4'], [1, '#C98E2B']]));
  }],
  [/rest|cafe|business|shop|store/, () => {
    const a = nid('a');
    return svg(`<rect x="18" y="34" width="84" height="48" rx="2" fill="#E9EEF7"/>
      <path d="M14 22h92l4 16H10z" fill="url(#${a})"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${10 + i * 16.7} 38q8.3 8 16.7 0" fill="${i % 2 ? '#fff' : '#FF5468'}"/>`).join('')}
      <rect x="26" y="50" width="30" height="22" rx="1.5" fill="#FFD87A"/><rect x="64" y="50" width="16" height="32" fill="#3B2A1B"/>
      <rect x="84" y="50" width="12" height="14" rx="1" fill="#FFD87A" opacity=".8"/>`,
    lin(a, [[0, '#FF5468'], [1, '#B3172E']]));
  }],
  [/academy|school|field|pitch/, () => ART.fam_field()],
  [/car/, () => ART.car_city()],
  [/villa|house|home|apt|pent|estate/, () => ART.home_apt()],
];

const CAT_FALLBACK = { cars: 'car_family', estate: 'home_apt', watch: 'style_watch', gear: 'style_wardrobe', family: 'fam_parents' };

/** Illustration for a shop item (SVG string). */
export function itemArt(id, catKey) {
  const k = String(id || '');
  try {
    if (ART[k]) return ART[k]();
    for (const [re, fn] of KEYWORD_ART) if (re.test(k.toLowerCase())) return fn();
    if (catKey === 'invest') return KEYWORD_ART.find(([re]) => re.test('invest'))[1]();
    const fb = CAT_FALLBACK[catKey];
    if (fb && ART[fb]) return ART[fb]();
  } catch (e) { console.warn('[hayeled] shop art', e); }
  return svg('<circle cx="60" cy="50" r="26" fill="#22345A"/><path d="M50 50h20M60 40v20" stroke="#9AABC8" stroke-width="4" stroke-linecap="round"/>');
}

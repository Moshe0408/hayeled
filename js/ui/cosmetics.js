// cosmetics.js (v2.3, F6): the stars-shop catalogue + how each cosmetic looks (boots colour, celebration move, card
// frame, avatar accessory). The engine owns ownership / balance (game.getCosmetics, game.spendStars,
// game.equipCosmetic); the content agent owns names (COSMETICS in js/data/strings.js). Both are read defensively: a
// missing facade function or table key falls back to the built-in Hebrew catalogue below, so the screen never breaks.
import * as game from '../engine/game.js';
import * as STR from '../data/strings.js';
import * as EVT from '../data/events.js';

export const SLOTS = [
  { id: 'boots', he: 'נעליים', ico: 'boot' },
  { id: 'celebration', he: 'חגיגת שער', ico: 'sparkle' },
  { id: 'frame', he: 'מסגרת לכרטיס', ico: 'card' },
  { id: 'accessory', he: 'אביזר', ico: 'user' },
  { id: 'boost', he: 'חיזוקים', ico: 'battery' },
];

/* Built-in catalogue (used only when the content table is missing; ids = content ids = the engine contract). */
const BUILTIN = [
  { id: 'boots_classic', slot: 'boots', he: 'שחורות קלאסיות', descHe: 'הנעליים מהשכונה', price: 0, default: true, rarity: 'common', colors: ['#1B1F27', '#FFFFFF'] },
  { id: 'boots_white', slot: 'boots', he: 'לבנות בוהקות', descHe: '', price: 40, rarity: 'common', colors: ['#F4F6FA', '#C9A227'] },
  { id: 'boots_neon', slot: 'boots', he: 'ירוק ניאון', descHe: '', price: 80, rarity: 'rare', colors: ['#7CFF3B', '#14202B'] },
  { id: 'boots_pink', slot: 'boots', he: 'ורוד פלמינגו', descHe: '', price: 100, rarity: 'rare', colors: ['#FF5FA2', '#FFFFFF'] },
  { id: 'boots_gold', slot: 'boots', he: 'זהב טהור', descHe: '', price: 250, rarity: 'epic', colors: ['#E8B931', '#6B4A00'] },
  { id: 'cel_classic', slot: 'celebration', he: 'ריצה לקהל', descHe: '', price: 0, default: true, rarity: 'common', style: 'classic' },
  { id: 'cel_knee_slide', slot: 'celebration', he: 'החלקת ברכיים', descHe: '', price: 60, rarity: 'common', style: 'knee_slide' },
  { id: 'cel_heart', slot: 'celebration', he: 'לב לקהל', descHe: '', price: 60, rarity: 'common', style: 'heart_hands' },
  { id: 'cel_spin_jump', slot: 'celebration', he: 'קפיצת הסיבוב', descHe: '', price: 200, rarity: 'epic', style: 'spin_jump' },
  { id: 'cel_backflip', slot: 'celebration', he: 'סלטה אחורית', descHe: '', price: 300, rarity: 'legendary', style: 'backflip' },
  { id: 'frame_basic', slot: 'frame', he: 'מסגרת רגילה', descHe: '', price: 0, default: true, rarity: 'common', frame: 'basic' },
  { id: 'frame_gold', slot: 'frame', he: 'זהב', descHe: '', price: 200, rarity: 'epic', frame: 'gold' },
  { id: 'frame_holo', slot: 'frame', he: 'הולוגרמה', descHe: '', price: 350, rarity: 'legendary', frame: 'holo' },
  { id: 'acc_none', slot: 'accessory', he: 'בלי אביזר', descHe: '', price: 0, default: true, rarity: 'common', acc: 'none' },
  { id: 'acc_headband', slot: 'accessory', he: 'סרט ראש', descHe: '', price: 40, rarity: 'common', acc: 'headband', colors: ['#FFFFFF', '#1B1F27'] },
  { id: 'acc_armband', slot: 'accessory', he: 'סרט קפטן', descHe: '', price: 150, rarity: 'epic', acc: 'armband', colors: ['#E8B931', '#1B1F27'] },
  { id: 'boost_energy', slot: 'boost', he: 'מילוי אנרגיה', descHe: 'אנרגיה מלאה, מיד. פעם בשבוע', price: 30, rarity: 'common', boost: 'energy_refill' },
  { id: 'boost_scout', slot: 'boost', he: 'הסקאוט הראשי', descHe: 'חושף את הפוטנציאל המדויק שלך', price: 120, rarity: 'epic', boost: 'scout_report' },
];
const BY_ID = Object.fromEntries(BUILTIN.map((x) => [x.id, x]));
const BOOT_COLORS = { gold: '#E8B931', pink: '#FF5FA2', neon: '#7CFF3B', white: '#F4F6FA', blue: '#1E7BFF', classic: '#1B1F27', red: '#E0262E', galaxy: '#5B2BD9' };
const HEX = /^#[0-9a-f]{3,8}$/i;
/** celebration style keys of the content table -> the moves celebration.js draws (classic = the plain celebration). */
const STYLE_MAP = { knee_slide: 'knee', knee: 'knee', backflip: 'backflip', spin_jump: 'jump', jump: 'jump', heart_hands: 'heart', heart: 'heart', airplane: 'airplane', shush: 'shush', salute: 'salute', dance: 'dance' };
export const ACCS = ['headband', 'wristband', 'armband', 'snood', 'tape', 'sleeve', 'clip', 'gloves', 'chain'];
export const FRAMES = ['silver', 'night', 'fire', 'neon', 'gold', 'holo'];

function contentTable() {
  const t = STR.COSMETICS || EVT.COSMETICS || null;
  if (!t) return null;
  if (Array.isArray(t)) return t;
  if (Array.isArray(t.items)) return t.items;
  if (typeof t === 'object') {
    const out = [];
    for (const [k, v] of Object.entries(t)) {
      if (k === 'ui' || k === 'slots') continue;
      if (Array.isArray(v)) for (const it of v) out.push({ slot: k, ...it });
      else if (v && typeof v === 'object' && (v.he || v.price !== undefined)) out.push({ id: k, ...v });
    }
    return out;
  }
  return null;
}
/** Shop copy from COSMETICS.ui (fallback Hebrew). */
export function cosUi(key, fb) {
  const t = STR.COSMETICS || EVT.COSMETICS;
  const v = t && t.ui ? t.ui[key] : null;
  return v !== undefined && v !== null && v !== '' ? v : fb;
}
export function slotHe(slot) {
  const t = STR.COSMETICS || EVT.COSMETICS;
  const v = t && t.slots && t.slots[slot];
  return (v && v.he) || (SLOTS.find((x) => x.id === slot) || {}).he || slot;
}

function slotOf(it) {
  const s = String(it.slot || it.kind || it.type || it.cat || '').toLowerCase();
  if (s.startsWith('boost') || s === 'consumable') return 'boost';
  if (s.startsWith('boot')) return 'boots';
  if (s.startsWith('cel')) return 'celebration';
  if (s.startsWith('fram')) return 'frame';
  if (s.startsWith('acc')) return 'accessory';
  const id = String(it.id || '');
  if (/^boost/.test(id)) return 'boost';
  if (/^boot/.test(id)) return 'boots';
  if (/^cel/.test(id)) return 'celebration';
  if (/^frame/.test(id)) return 'frame';
  if (/^acc/.test(id)) return 'accessory';
  return 'boost';
}

/** Visual parameters of a cosmetic id/item: { boots?, bootsB?, style?, frame?, acc?, accColors? }. */
export function visualOf(idOrItem) {
  if (!idOrItem) return {};
  const it = typeof idOrItem === 'string' ? (findItem(idOrItem) || { id: idOrItem }) : idOrItem;
  const id = String(it.id || '').toLowerCase();
  const b = BY_ID[it.id] || {};
  const slot = slotOf({ ...b, ...it });
  const cols = Array.isArray(it.colors) ? it.colors : Array.isArray(b.colors) ? b.colors : null;
  const out = {};
  if (slot === 'boots') {
    const c = (cols && cols[0]) || it.color || it.hex;
    const kw = Object.entries(BOOT_COLORS).find(([k]) => id.includes(k));
    out.boots = typeof c === 'string' && HEX.test(c) ? c : kw ? kw[1] : '#E8B931';
    if (cols && HEX.test(String(cols[1] || ''))) out.bootsB = cols[1];
  } else if (slot === 'celebration') {
    const raw = String(it.style || b.style || '').toLowerCase();
    let st = STYLE_MAP[raw] || null;
    if (!st && raw !== 'classic') { const kw = Object.entries(STYLE_MAP).find(([k]) => id.includes(k)); st = kw ? kw[1] : null; }
    if (st) out.style = st;
  } else if (slot === 'frame') {
    const f = String(it.frame || b.frame || id).toLowerCase();
    const k = FRAMES.find((x) => f.includes(x));
    if (k) out.frame = k;
  } else if (slot === 'accessory') {
    const a = String(it.acc || it.accessory || b.acc || id).toLowerCase();
    const k = ACCS.find((x) => a.includes(x)) || (/capt/.test(a) ? 'armband' : null);
    if (k) { out.acc = k; if (cols) out.accColors = cols.filter((x) => HEX.test(String(x))); }
  }
  return out;
}

/** Full catalogue: [{ id, slot, he, descHe, price, rarity, isDefault, consumable, limit, vis }] (filtered by gender). */
export function catalog(gender) {
  const src = contentTable();
  const list = src && src.length ? src : BUILTIN;
  return list.filter((x) => x && x.id && (!x.gender || !gender || x.gender === gender)).map((x) => {
    const b = BY_ID[x.id] || {};
    const slot = slotOf({ ...b, ...x });
    return {
      id: String(x.id), slot,
      he: String(x.he || x.nameHe || x.name || b.he || x.id),
      descHe: String(x.descHe || x.desc || b.descHe || ''),
      price: Math.max(0, Math.round(Number(x.price ?? x.stars ?? x.cost ?? b.price ?? 0)) || 0),
      rarity: x.rarity || b.rarity || 'common',
      isDefault: !!(x.default || b.default),
      consumable: !!(x.consumable ?? b.consumable ?? slot === 'boost'),
      limit: x.limit || null,
      vis: visualOf({ ...b, ...x, slot }),
    };
  });
}

export function findItem(id) {
  const src = contentTable() || [];
  return src.find((x) => x && x.id === id) || BY_ID[id] || null;
}

/* ------------------------------------------------------------------ engine state (cached per change) */
let cache = null;
try { game.subscribe(() => { cache = null; }); } catch { /* ignore */ }

/** { owned: [ids], equipped: { boots, celebration, frame, accessory } } (empty without a career / facade). */
export function cosmeticsState() {
  if (cache) return cache;
  let r = null;
  try { if (game.hasCareer() && typeof game.getCosmetics === 'function') r = game.getCosmetics(); } catch { r = null; }
  const owned = Array.isArray(r && r.owned) ? r.owned.map(String) : [];
  const eq = (r && r.equipped) || {};
  let careerId = '';
  try { careerId = game.hasCareer() ? String(game.getSaveMeta().careerId || '') : ''; } catch { careerId = ''; }
  cache = { owned, equipped: { boots: eq.boots || null, celebration: eq.celebration || null, frame: eq.frame || null, accessory: eq.accessory || null }, raw: r, careerId };
  return cache;
}

/** Visuals of everything equipped now: { boots, style, frame, acc }. */
export function equippedVis() {
  const e = cosmeticsState().equipped;
  return { ...visualOf(e.boots), ...visualOf(e.celebration), ...visualOf(e.frame), ...visualOf(e.accessory) };
}

/** Equipped visuals if `meta` is the career in memory (avatars of other slots stay plain). */
export function visFor(meta) {
  const st = cosmeticsState();
  if (!st.careerId || !meta) return {};
  const id = meta.careerId || (meta.player && meta.player.careerId) || '';
  if (id && id !== st.careerId) return {};
  if (!id && !meta.me) return {};
  return equippedVis();
}

/** Stars balance { balance, earnedTotal } (zeros without the facade). */
export function starsState() {
  try {
    if (game.hasCareer() && typeof game.getStars === 'function') {
      const s = game.getStars() || {};
      return { balance: Math.max(0, Math.round(Number(s.balance) || 0)), earnedTotal: Math.max(0, Math.round(Number(s.earnedTotal) || 0)) };
    }
  } catch { /* ignore */ }
  return { balance: 0, earnedTotal: 0 };
}

/* ------------------------------------------------------------------ small SVG previews */
export function bootSVG(color = '#F4C35A', size = 64) {
  const c = /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#F4C35A';
  return `<svg viewBox="0 0 64 40" width="${size}" height="${Math.round(size * 0.625)}" aria-hidden="true" class="cos-boot">
    <defs><linearGradient id="bt${c.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
    <path d="M6 10h18l3 9 22 6c6 1.6 9 4.4 9 8v1H6z" fill="${c}"/><path d="M6 10h18l3 9 22 6c6 1.6 9 4.4 9 8v1H6z" fill="url(#bt${c.slice(1)})"/>
    <path d="M6 31h52" stroke="#0A1022" stroke-width="3"/><path d="M12 35v3M22 35v3M34 35v3M46 35v3" stroke="#0A1022" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M27 19l-6 6M33 21l-5 5M39 23l-4 4" stroke="#fff" stroke-width="1.6" opacity=".7" stroke-linecap="round"/></svg>`;
}

const CEL_PATH = {
  classic: '<circle cx="32" cy="10" r="5"/><path d="M32 16v16M32 22l-10 6M32 22l8-10 2-6M32 32l-7 12M32 32l7 12"/>',
  airplane: '<circle cx="32" cy="14" r="5"/><path d="M8 18l24 4 24-4M32 20v12M32 32l-8 12M32 32l8 12"/>',
  shush: '<circle cx="32" cy="12" r="5"/><path d="M32 18v16M32 34l-6 10M32 34l6 10M32 22l-8 8M32 22l4 6 2-14"/>',
  salute: '<circle cx="32" cy="12" r="5"/><path d="M32 18v16M32 34l-6 10M32 34l6 10M32 22l-6 10M32 22l8-4-6-8"/>',
  dance: '<circle cx="30" cy="10" r="5"/><path d="M30 16l2 16M31 22l-12-6M31 22l10 6 6-6M32 32l-10 10M32 32l10 6 2 6"/>',
  knee: '<path d="M14 40h36"/><circle cx="40" cy="12" r="5"/><path d="M38 18 30 28l-12 4M34 22l10-8 8 2M30 28l10 6h10"/>',
  backflip: '<path d="M10 44h44"/><circle cx="32" cy="30" r="5"/><path d="M32 24c-8-10-20-6-20 4M32 36l-8 6M32 36l8 6M28 30l-8-6M36 30l8-6"/><path d="M46 12a16 16 0 0 0-26 2" stroke-dasharray="3 4"/>',
  jump: '<path d="M10 46h44"/><circle cx="32" cy="10" r="5"/><path d="M32 16v14M32 20l-12-4M32 20l12-4M32 30l-8 10M32 30l8 10"/><path d="M16 34c-4 2-4 6 0 8M48 34c4 2 4 6 0 8"/>',
  heart: '<circle cx="32" cy="12" r="5"/><path d="M32 18v16M32 34l-6 10M32 34l6 10M26 22l-6-4 4-8M38 22l6-4-4-8"/><path d="M32 4c-3-5-10-2-7 3l7 6 7-6c3-5-4-8-7-3z" fill="#FF4F7A" stroke="#FF4F7A"/>',
};
export function celebSVG(style = 'jump', size = 56) {
  return `<svg viewBox="0 0 64 50" width="${size}" height="${Math.round(size * 0.78)}" aria-hidden="true" class="cos-cel" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${CEL_PATH[style] || CEL_PATH.jump}</svg>`;
}
export function frameSVG(frame = 'gold', size = 44) {
  const fill = frame === 'holo'
    ? '<linearGradient id="fh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DF0E2"/><stop offset=".3" stop-color="#B78CFF"/><stop offset=".6" stop-color="#FF7AC8"/><stop offset="1" stop-color="#FFE07A"/></linearGradient>'
    : '<linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6CC"/><stop offset=".4" stop-color="#F4C35A"/><stop offset=".7" stop-color="#B07A18"/><stop offset="1" stop-color="#FFE7A3"/></linearGradient>';
  const id = frame === 'holo' ? 'fh' : 'fg';
  return `<svg viewBox="0 0 40 54" width="${size}" height="${Math.round(size * 1.35)}" aria-hidden="true" class="cos-frame cf-${frame}"><defs>${fill}</defs>
    <path d="M20 1l7 2 12 1v40L20 53 1 44V4l12-1z" fill="url(#${id})"/><path d="M20 6l5 1.5 9 1v33L20 48 6 41.5v-33l9-1z" fill="#0B1424" opacity=".82"/>
    <text x="20" y="27" text-anchor="middle" font-family="Rubik,Heebo,sans-serif" font-weight="900" font-size="12" fill="url(#${id})">60</text></svg>`;
}

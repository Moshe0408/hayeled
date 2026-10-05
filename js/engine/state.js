// Game state container, schema version and the engine context.
import { fmtMoney } from './util.js';
// The only module-level mutable state of the engine lives in C: the current career (S + its rng) and the signal list.

export const SCHEMA_VERSION = 5;   // v5 (2.3): S.meta (stars, achievements, objectives, cosmetics, tutorial, stakes) + the one-time OVR 60 lift

export const C = {
  S: null,      // current State
  rng: null,    // main Rng bound to S.rng
  sig: [],      // pending telemetry signals (not persisted)
  int: null,    // v2.3: first "interesting" event since the last fast-forward check (not persisted)
};

export function emit(name, props) {
  C.sig.push({ name, props: props || {} });
}

export function absWeek(season, week) { return season * 52 + week; }
export function curAw(S) { return S.season * 52 + S.week; }

export function nextId(S, kind) {
  const map = { inbox: 'm', offer: 'o', timeline: 't', star: 's' };
  const p = map[kind] || kind;
  S.ctr[p] = (S.ctr[p] || 0) + 1;
  return p + S.ctr[p];
}

export function emptyLine() { return { apps: 0, st: 0, min: 0, g: 0, a: 0, cs: 0, rs: 0, motm: 0 }; }
export function emptyStats() {
  return { lg: emptyLine(), cup: emptyLine(), eu: emptyLine(), nt: emptyLine(), yth: emptyLine(), ynt: emptyLine() };
}

export const STATE_KEYS = ['v', 'id', 'createdAt', 'seed', 'rng', 'startSeason', 'season', 'week', 'wstep', 'inWeek', 'wsum', 'training',
  'econ', 'player', 'world', 'comp', 'nt', 'inbox', 'offers', 'live', 'lastMatch', 'pending', 'hist', 'stars', 'ev', 'names', 'ctr', 'retired', 'mgr'];

export function createEmptyState() {
  return {
    v: SCHEMA_VERSION, id: '', createdAt: 0, seed: 0, rng: 0, startSeason: 2026, season: 2026, week: 1, wstep: 0, inWeek: false, wsum: null,
    training: 'balanced', trainInt: 'normal', econ: 1, player: null, world: { clubs: {}, champs: {} }, comp: null,
    nt: { str: {}, q: null, tour: null, ytour: null, called: {}, hist: [], fr: [] },
    inbox: [], offers: [], live: null, lastMatch: null, pending: { review: null, retire: null },
    hist: { seasons: [], matches: [], timeline: [], trophies: [], awards: [], bdo: [], clubs: [], firsts: { debut: null, goal: null, ntDebut: null, ntGoal: null, euDebut: null } },
    stars: [], ev: { cd: {}, once: [], flags: {}, trig: [], q: [] },
    names: { coach: {}, agent: '', journalist: '', friends: ['', '', ''], partner: null },
    ctr: { m: 0, o: 0, t: 0, s: 0 }, retired: null,
    mgr: null,   // v3: coaching career after retirement (js/engine/manager.js)
    meta: null,  // v5: progression layer (js/engine/meta.js)
  };
}

export const WOMEN_ECON = 0.12;
const SHIRT = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, RW: 7, CM: 8, ST: 9, CAM: 10, LW: 11 };
export function defaultShirt(pos) { return SHIRT[pos] || 10; }

// '€12,500' / '€15.5K' / '€1.2M' (the v2 fmtMoney formats) -> fmtMoney(value), i.e. '₪48,800' / '₪60 אלף' / '₪4.7 מיליון'
const EURO_RE = /(-?)€\s?(\d[\d,]*(?:\.\d+)?)(?:\s?([KkMm])(?![a-zA-Z]))?/g;
export function euroToShekelText(t) {
  if (typeof t !== 'string' || t.indexOf('€') < 0) return t;
  return t.replace(EURO_RE, (all, neg, n, u) => {
    const v = Number(n.replace(/,/g, ''));
    if (!Number.isFinite(v)) return all;
    const mul = u ? (u === 'K' || u === 'k' ? 1e3 : 1e6) : 1;
    return fmtMoney((neg ? -1 : 1) * v * mul);
  });
}
function shekelTexts(o, depth) {
  const d = depth || 0;
  if (!o || typeof o !== 'object' || d > 12) return;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = euroToShekelText(o[i]); else shekelTexts(o[i], d + 1); } return; }
  for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') o[k] = euroToShekelText(v); else if (v && typeof v === 'object') shekelTexts(v, d + 1); }
}

/** v3 -> v4 defaults (idempotent; also used when a save is loaded mid-match). */
export function migrateV4(data) {
  if (!data || typeof data !== 'object') return data;
  if (['light', 'normal', 'hard', 'extreme'].indexOf(data.trainInt) < 0) data.trainInt = 'normal';
  const p = data.player;
  if (p && typeof p === 'object') {
    if (typeof p.load !== 'number') p.load = 20;
    if (typeof p.sharp !== 'number') p.sharp = 60;
    if (typeof p.benchRun !== 'number') p.benchRun = 0;
    if (typeof p.lowMin !== 'number') p.lowMin = 0;
    if (!p.talk || typeof p.talk !== 'object') p.talk = { lastWeekAbs: -99, promise: null, mood: 0 };
    if (!Array.isArray(p.lh)) p.lh = [];
    if (!p.ld || typeof p.ld !== 'object') p.ld = { burn: 0, lastBurn: -99, burns: 0, hard: 0, ntNo: 0 };
  }
  return data;
}

export function migrateState(data, fromV) {
  if (typeof fromV !== 'number' || !Number.isFinite(fromV)) fromV = data && data.v;
  if (fromV > SCHEMA_VERSION) throw new Error('schema_too_new');
  if (data && typeof data === 'object') {
    // v1 -> v2: gender (C1), economy scale (C3), look (C7), shirt number, structured live-match log (C4).
    if (!(fromV >= 2)) {
      if (typeof data.econ !== 'number' || !(data.econ > 0)) data.econ = 1;
      const p = data.player;
      if (p && typeof p === 'object') {
        if (p.gender !== 'f') p.gender = 'm';
        if (!('look' in p)) p.look = null;
        if (typeof p.num !== 'number') p.num = defaultShirt(p.pos);
      }
      const L = data.live;
      if (L && typeof L === 'object') {
        if (!L.ck) L.ck = String(data.id || 'c') + '|' + (data.season || 0) + '|' + (data.week || 0) + '|' + ((L.fx && L.fx.slot) || '');
        if (!Array.isArray(L.cx)) L.cx = [];
        if (typeof L.ci !== 'number') L.ci = 0;
        if (typeof L.cc !== 'number') L.cc = 0;
        if (!Array.isArray(L.out)) L.out = [];
      }
    }
    // v2 -> v3: coaching career (R2). A retired v2 career gets its coaching offers on the retirement screen.
    if (!(fromV >= 3)) {
      if (!('mgr' in data)) data.mgr = null;
      // R3: v2 saves hold already-rendered euro amounts in persisted texts (inbox, timeline...): show them in shekels
      shekelTexts(data);
    }
    // v3 -> v4 (2.2): training load, match sharpness, bench run and coach talks (docs/SPEC-2.2-training-bench.md §7)
    if (!(fromV >= 4)) migrateV4(data);
    data.v = SCHEMA_VERSION;
  }
  return data;
}

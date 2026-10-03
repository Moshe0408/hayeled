// Game state container, schema version and the engine context.
// The only module-level mutable state of the engine lives in C: the current career (S + its rng) and the signal list.

export const SCHEMA_VERSION = 2;

export const C = {
  S: null,      // current State
  rng: null,    // main Rng bound to S.rng
  sig: [],      // pending telemetry signals (not persisted)
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
  'econ', 'player', 'world', 'comp', 'nt', 'inbox', 'offers', 'live', 'lastMatch', 'pending', 'hist', 'stars', 'ev', 'names', 'ctr', 'retired'];

export function createEmptyState() {
  return {
    v: SCHEMA_VERSION, id: '', createdAt: 0, seed: 0, rng: 0, startSeason: 2026, season: 2026, week: 1, wstep: 0, inWeek: false, wsum: null,
    training: 'balanced', econ: 1, player: null, world: { clubs: {}, champs: {} }, comp: null,
    nt: { str: {}, q: null, tour: null, ytour: null, called: {}, hist: [], fr: [] },
    inbox: [], offers: [], live: null, lastMatch: null, pending: { review: null, retire: null },
    hist: { seasons: [], matches: [], timeline: [], trophies: [], awards: [], bdo: [], clubs: [], firsts: { debut: null, goal: null, ntDebut: null, ntGoal: null, euDebut: null } },
    stars: [], ev: { cd: {}, once: [], flags: {}, trig: [], q: [] },
    names: { coach: {}, agent: '', journalist: '', friends: ['', '', ''], partner: null },
    ctr: { m: 0, o: 0, t: 0, s: 0 }, retired: null,
  };
}

export const WOMEN_ECON = 0.12;
const SHIRT = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, RW: 7, CM: 8, ST: 9, CAM: 10, LW: 11 };
export function defaultShirt(pos) { return SHIRT[pos] || 10; }

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
    data.v = SCHEMA_VERSION;
  }
  return data;
}

// Game state container, schema version and the engine context.
// The only module-level mutable state of the engine lives in C: the current career (S + its rng) and the signal list.

export const SCHEMA_VERSION = 1;

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
  'player', 'world', 'comp', 'nt', 'inbox', 'offers', 'live', 'lastMatch', 'pending', 'hist', 'stars', 'ev', 'names', 'ctr', 'retired'];

export function createEmptyState() {
  return {
    v: SCHEMA_VERSION, id: '', createdAt: 0, seed: 0, rng: 0, startSeason: 2026, season: 2026, week: 1, wstep: 0, inWeek: false, wsum: null,
    training: 'balanced', player: null, world: { clubs: {}, champs: {} }, comp: null,
    nt: { str: {}, q: null, tour: null, ytour: null, called: {}, hist: [], fr: [] },
    inbox: [], offers: [], live: null, lastMatch: null, pending: { review: null, retire: null },
    hist: { seasons: [], matches: [], timeline: [], trophies: [], awards: [], bdo: [], clubs: [], firsts: { debut: null, goal: null, ntDebut: null, ntGoal: null, euDebut: null } },
    stars: [], ev: { cd: {}, once: [], flags: {}, trig: [], q: [] },
    names: { coach: {}, agent: '', journalist: '', friends: ['', '', ''], partner: null },
    ctr: { m: 0, o: 0, t: 0, s: 0 }, retired: null,
  };
}

export function migrateState(data, fromV) {
  if (typeof fromV !== 'number' || !Number.isFinite(fromV)) fromV = data && data.v;
  if (fromV > SCHEMA_VERSION) throw new Error('schema_too_new');
  // v1 is the first schema: identity.
  if (data && typeof data === 'object') data.v = SCHEMA_VERSION;
  return data;
}

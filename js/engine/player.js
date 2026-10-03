// Player model: creation, OVR, potential, development, aging, injuries, value, wages (SPEC §5.11).
import { rngFor } from '../core/rng.js';
import { INJURIES } from '../data/strings.js';
import { clamp, round1, sround1, sigRound, avg, econOf } from './util.js';
import { emptyStats, defaultShirt } from './state.js';

export const OUT_ATTRS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
export const GK_ATTRS = ['div', 'han', 'ref', 'gkp', 'kic'];
export const ALL_ATTRS = OUT_ATTRS.concat(GK_ATTRS);
export const POSITIONS_ORDER = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

const W_ST = { sho: 0.40, pac: 0.20, dri: 0.15, phy: 0.15, pas: 0.10 };
const W_W = { pac: 0.30, dri: 0.30, sho: 0.20, pas: 0.15, phy: 0.05 };
const W_FB = { def: 0.30, pac: 0.30, pas: 0.20, phy: 0.10, dri: 0.10 };
export const POS_W = {
  ST: W_ST, LW: W_W, RW: W_W,
  CAM: { pas: 0.35, dri: 0.30, sho: 0.20, pac: 0.10, phy: 0.05 },
  CM: { pas: 0.35, dri: 0.20, def: 0.15, phy: 0.15, sho: 0.10, pac: 0.05 },
  CDM: { def: 0.35, pas: 0.25, phy: 0.25, pac: 0.05, dri: 0.05, sho: 0.05 },
  CB: { def: 0.50, phy: 0.30, pac: 0.10, pas: 0.10 },
  LB: W_FB, RB: W_FB,
  GK: { div: 0.25, han: 0.20, ref: 0.25, gkp: 0.20, kic: 0.10 },
};
export function posGroup(pos) {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM') return 'MID';
  return 'ATT';
}

export function ovrRaw(p) {
  const w = POS_W[p.pos];
  let s = 0;
  for (const k in w) s += w[k] * (p.a[k] || 0);
  return s;
}
export function ovrOf(p) { return clamp(Math.round(ovrRaw(p)), 1, 99); }
export function ageOf(S) { return S.season - S.player.born; }
export function formAvg(p) { return p.form && p.form.length ? avg(p.form) : null; }
export function formAvgOr(p, d = 6.6) { const f = formAvg(p); return f === null ? d : f; }

export function potStars(range) {
  const mid = (range[0] + range[1]) / 2;
  return clamp(Math.round((mid - 50) / 9 * 2) / 2, 0.5, 5);
}

export function scoutWidth(age) { return age <= 16 ? 6 : age <= 18 ? 4 : age <= 21 ? 3 : 1; }
export function updatePotSeen(S) {
  const p = S.player;
  const age = ageOf(S);
  const w = scoutWidth(age);
  const c = p.pot + rngFor(S.id, S.season, 'scout').int(-2, 2);
  const lo = clamp(Math.round(c - w), 30, 99), hi = clamp(Math.round(c + w), 30, 99);
  p.potSeen = [lo, Math.max(lo, hi)];
}

export function createPlayer(rng, o, season, econ = 1) {
  const t = rng.int(45, 55);
  const pos = o.pos;
  const w = POS_W[pos];
  const a = {};
  if (pos === 'GK') {
    for (const k of GK_ATTRS) a[k] = t + 4 + rng.normal(0, 3);
    for (const k of OUT_ATTRS) a[k] = t - 18 + rng.normal(0, 3);
    a.kic = t + rng.normal(0, 2);
  } else {
    for (const k of OUT_ATTRS) a[k] = w[k] ? t + 4 + rng.normal(0, 3) : t - 10 + rng.normal(0, 4);
    for (const k of GK_ATTRS) a[k] = rng.int(8, 20);
  }
  const tmp = { pos, a };
  const shift = t - ovrRaw(tmp);
  for (const k in w) a[k] += shift;
  for (const k of ALL_ATTRS) a[k] = round1(clamp(a[k], 1, 99));
  // nudge so that the rounded OVR equals t
  let guard = 0;
  while (ovrOf(tmp) !== t && guard++ < 20) {
    const d = ovrOf(tmp) < t ? 0.5 : -0.5;
    for (const k in w) a[k] = round1(clamp(a[k] + d, 1, 99));
  }
  const pot = clamp(Math.round(t + 24 + rng.normal(0, 7)), t + 10, 94);
  return {
    first: o.first, last: o.last, nick: o.nick || '', nation: o.nation, pos, foot: o.foot === 'L' ? 'L' : 'R',
    born: season - 15, a, pot, potSeen: [pot - 6, pot + 6], peak: t,
    energy: 90, morale: 60, form: [], injury: null, susp: 0, yc: 0,
    trust: 50, fans: 30, mates: 55, rep: { l: 5, c: 0, w: 0 }, money: Math.round(1500 * econ),
    gender: o.gender === 'f' ? 'f' : 'm', look: o.look || null, num: typeof o.num === 'number' ? o.num : defaultShirt(pos),
    stage: 'youth', club: o.club, contract: null, parent: null, next: null, youth: 'u17', owned: [],
    mins: [], bench: 0, freeWeeks: 0, treq: false, agentPush: 0, natLvl: 'none',
    caps: { u17: 0, u19: 0, u21: 0, senior: 0 }, ig: { u17: 0, u19: 0, u21: 0, senior: 0 }, s: emptyStats(),
  };
}

const G_TABLE = { 15: 5.5, 16: 5.5, 17: 5, 18: 4.5, 19: 4, 20: 3.5, 21: 3, 22: 2.5, 23: 2, 24: 1.2, 25: 0.8, 26: 0.4, 27: 0.2, 28: 0.2, 29: 0.2, 30: 0, 31: -0.8, 32: -1.5, 33: -2.2, 34: -3, 35: -3.5, 36: -4 };
// Remaining positive growth from this age on (used to pace development so the peak arrives at ~25-28).
export function growthLeft(age) {
  let r = 0;
  for (let a = Math.max(15, age); a <= 30; a++) r += Math.max(0, G(a));
  return r;
}
export function G(age) {
  if (age < 15) return 5.5;
  if (age >= 37) return -4.5;
  return G_TABLE[age];
}

export const FOCUS = {
  balanced: null, shooting: { sho: 1 }, technique: { pas: 0.5, dri: 0.5 }, defense: { def: 0.8, phy: 0.2 },
  physical: { pac: 0.5, phy: 0.5 }, goalkeeping: { div: 0.25, han: 0.25, ref: 0.25, gkp: 0.15, kic: 0.1 }, rest: null,
};
const DECL = { pac: 1.6, phy: 1.3 };

// Weekly development; returns { d: ovr delta (raw), attrs: {k: delta} }
export function developWeek(S, rng, training) {
  const p = S.player;
  const out = { d: 0, attrs: {} };
  if (S.week > 44 || p.injury || p.stage === 'retired') return out;
  const age = ageOf(S);
  const g = G(age);
  const pw = POS_W[p.pos];
  const before = ovrRaw(p);
  let share = {};
  let mult;
  if (g > 0) {
    if (training === 'rest') return out;
    const totMin = (p.mins || []).reduce((s, x) => s + x, 0);
    const fa = formAvgOr(p);
    const minutesF = 0.55 + 0.45 * Math.min(1, totMin / (8 * 90 * 0.8)) + clamp((fa - 6.6) * 0.15, -0.1, 0.15);
    const trainF = training === 'balanced' ? 1.0 : 1.05;
    mult = clamp((p.pot - before) / Math.max(2, growthLeft(age)), 0, 1.3) * minutesF * trainF * (0.9 + p.morale / 500);
    let fw = FOCUS[training];
    if (training === 'goalkeeping' && p.pos !== 'GK') fw = null;
    if (!fw) fw = pw;
    const keys = new Set(Object.keys(pw).concat(Object.keys(fw)));
    for (const k of keys) share[k] = 0.65 * (pw[k] || 0) + 0.35 * (fw[k] || 0);
  } else {
    mult = training === 'physical' ? 0.85 : 1;
    for (const k in pw) share[k] = pw[k] * (DECL[k] || 0.7);
  }
  const d = g / 44 * mult;
  if (d === 0) return out;
  let denom = 0;
  for (const k in share) denom += (pw[k] || 0) * share[k];
  if (denom <= 0) return out;
  const kf = d / denom;
  const cap = Math.min(99, p.pot + 10);
  for (const k of ALL_ATTRS) {
    if (!share[k]) continue;
    const old = p.a[k];
    let nv = sround1(old + kf * share[k], rng);
    if (d > 0) nv = Math.min(nv, Math.max(old, cap));
    nv = clamp(nv, 1, 99);
    p.a[k] = round1(nv);
    if (p.a[k] !== old) out.attrs[k] = round1(p.a[k] - old);
  }
  out.d = ovrRaw(p) - before;
  return out;
}

// GK attributes of outfield players / outfield attributes of GKs age too (small), keeping things in range
export function potentialDrift(S) {
  const p = S.player;
  const age = ageOf(S);
  if (age > 23) return;
  // senior football only: youth ratings against weaker youth sides would inflate potential
  const lines = [p.s.lg, p.s.cup, p.s.eu, p.s.nt];
  let apps = 0, rs = 0;
  for (const l of lines) { apps += l.apps; rs += l.rs; }
  if (apps < 10) return;
  const ar = rs / apps;
  p.pot = clamp(p.pot + Math.round(clamp((ar - 7.0) * 2, -2, 2)), ovrOf(p), 96);
}

export function valueOf(S) {
  const p = S.player;
  const ovr = ovrOf(p);
  const age = ageOf(S);
  const am = age <= 21 ? 1.4 : age <= 25 ? 1.2 : age <= 28 ? 1.0 : age <= 30 ? 0.75 : age <= 32 ? 0.5 : 0.3;
  const yb = age <= 23 ? 1 + Math.max(0, p.pot - ovr) / 40 : 1;
  const e = econOf(S);
  const v = 50000 * Math.pow(10, (ovr - 45) / 12) * am * yb * (0.85 + p.rep.c / 300) * e;
  return Math.max(Math.round(10000 * e), sigRound(v, 2));
}
// econ: career economy scale (C3, 1 for men, ~0.12 for women)
export function fairWage(ovr, prestige, econ = 1) {
  return Math.round(400 * Math.pow(1.13, ovr - 40) * (0.4 + 0.09 * prestige) * econ);
}
export function wageCap(b, econ = 1) { return Math.round(b * 4000 * econ); }

export function injuryChanceMatch(S, minutes) {
  const p = S.player;
  const age = ageOf(S);
  return 0.010 * (minutes / 90) * (p.energy < 40 ? 2 : 1) * (age > 31 ? 1.3 : 1) * (1.2 - p.a.phy / 250);
}
export function rollInjury(S, rng) {
  const r = rng.next();
  const sev = r < 0.70 ? 'minor' : r < 0.95 ? 'medium' : 'major';
  const weeks = sev === 'minor' ? rng.int(1, 2) : sev === 'medium' ? rng.int(3, 6) : rng.int(8, 30);
  const list = (INJURIES && INJURIES[sev]) || [];
  const it = rng.pick(list) || { id: sev, he: sev === 'minor' ? 'מכה' : sev === 'medium' ? 'מתיחה' : 'פציעה קשה' };
  return { weeks, kind: it.id, sev };
}
export function injuryHe(inj) {
  if (!inj) return '';
  const list = (INJURIES && INJURIES[inj.sev]) || [];
  const it = list.find((x) => x.id === inj.kind);
  return it ? it.he : 'פציעה';
}

export function clampStatus(p) {
  p.energy = Math.round(clamp(p.energy, 0, 100));
  p.morale = Math.round(clamp(p.morale, 0, 100));
  p.trust = Math.round(clamp(p.trust, 0, 100));
  p.fans = Math.round(clamp(p.fans, 0, 100));
  p.mates = Math.round(clamp(p.mates, 0, 100));
  p.rep.l = round1(clamp(p.rep.l, 0, 100));
  p.rep.c = round1(clamp(p.rep.c, 0, 100));
  p.rep.w = round1(clamp(p.rep.w, 0, 100));
  p.money = Math.max(0, Math.round(p.money));
}

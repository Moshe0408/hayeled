// National teams: strengths, qualifiers, friendlies, senior and youth tournaments (SPEC §5.14).
import { rngFor } from '../core/rng.js';
import { COUNTRIES, COUNTRY_BY_ID } from '../data/countries.js';
import { summerTournaments, CONFED_TOUR, tournamentSlots, intlSlotIndex, intlSlotOf } from './calendar.js';
import { roundRobin } from './schedule.js';
import { newTable, tableApply, rankRows } from './world.js';
import { clamp, round1, sortIds, isF } from './util.js';

export const YOUTH_OFF = { u17: 22, u19: 16, u21: 10 };
const WC_QUOTA = { UEFA: 16, CAF: 9, AFC: 8, CONMEBOL: 6, CONCACAF: 6 };
const KO_KEY = { 32: 'r32', 16: 'r16', 8: 'qf', 4: 'sf', 2: 'f' };

export function countriesOf(confed) { return sortIds(COUNTRIES.filter((c) => c.confed === confed).map((c) => c.id)); }
// Base national strength: the women's table when the career is women's football (C3).
export function natBase(S, id) { const c = COUNTRY_BY_ID[id]; if (!c) return 50; return isF(S) && typeof c.strengthW === 'number' ? c.strengthW : c.strength; }
export function nstr(S, id) { const v = S.nt.str[id]; return typeof v === 'number' ? v : natBase(S, id); }
export function youthNStr(S, id, lvl) { return nstr(S, id) - (YOUTH_OFF[lvl] || 0); }

export function initNational(S, gender) {
  const str = {};
  for (const c of COUNTRIES) str[c.id] = gender === 'f' && typeof c.strengthW === 'number' ? c.strengthW : c.strength;
  S.nt = { str, q: null, tour: null, ytour: null, called: {}, hist: [], fr: [] };
}

export function driftNational(S, rng) {
  for (const id of sortIds(Object.keys(S.nt.str))) {
    const base = COUNTRY_BY_ID[id] ? natBase(S, id) : S.nt.str[id];
    S.nt.str[id] = round1(clamp(S.nt.str[id] + 0.2 * (base - S.nt.str[id]) + rng.normal(0, 0.8), 30, 95));
  }
}

// Tournament kind the nation plays in the summer of `year` (null if none)
export function tourKindFor(nation, year) {
  const c = COUNTRY_BY_ID[nation];
  const list = summerTournaments(year);
  if (!c || list.length === 0) return null;
  if (list[0] === 'wc') return 'wc';
  return CONFED_TOUR[c.confed] || null;
}

function copaGuests(S, nation) {
  return countriesOf('CONCACAF').filter((id) => id !== nation).sort((a, b) => (nstr(S, b) - nstr(S, a)) || (a < b ? -1 : 1)).slice(0, 6);
}

// Returns { pool: ids, slots: number } for the tournament kind (pool = nations eligible to qualify)
function qualPool(S, kind, nation) {
  const c = COUNTRY_BY_ID[nation];
  if (kind === 'wc') return { pool: countriesOf(c.confed), slots: WC_QUOTA[c.confed] || 4 };
  if (kind === 'euro') return { pool: countriesOf('UEFA'), slots: 24 };
  if (kind === 'copa') return { pool: countriesOf('CONMEBOL'), slots: 10 };
  if (kind === 'afcon') return { pool: countriesOf('CAF'), slots: 24 };
  if (kind === 'asian') return { pool: countriesOf('AFC'), slots: 24 };
  if (kind === 'gold') {
    const guests = new Set(copaGuests(S, nation));
    const pool = countriesOf('CONCACAF').filter((id) => !guests.has(id));
    return { pool, slots: pool.length >= 16 ? 16 : 8 };
  }
  return { pool: [], slots: 0 };
}

export function buildNationalSeason(S) {
  const nation = S.player.nation;
  const year = S.season + 1;
  const kind = tourKindFor(nation, year);
  S.nt.q = null; S.nt.fr = []; S.nt.called = {};
  if (kind) {
    const { pool, slots } = qualPool(S, kind, nation);
    if (pool.length > slots && pool.indexOf(nation) >= 0) {
      const rng = rngFor(S.season, nation, 'qgrp');
      const sorted = pool.slice().sort((a, b) => (nstr(S, b) - nstr(S, a)) || (a < b ? -1 : 1));
      const per = Math.ceil(sorted.length / 5);
      const pots = [0, 1, 2, 3, 4].map((p) => sorted.slice(p * per, p * per + per));
      const myPot = pots.findIndex((p) => p.indexOf(nation) >= 0);
      const grp = [nation];
      pots.forEach((p, i) => {
        if (i === myPot) return;
        const cand = p.filter((x) => x !== nation && grp.indexOf(x) < 0);
        const pick = rng.pick(cand.length ? cand : sorted.filter((x) => grp.indexOf(x) < 0));
        if (pick) grp.push(pick);
      });
      // fill if a pot was empty
      for (const x of sorted) { if (grp.length >= 5) break; if (grp.indexOf(x) < 0) grp.push(x); }
      const rounds = roundRobin(sortIds(grp), 2, rng);
      const merged = [];
      const rest = rounds.map((r) => !r.some((p) => p[0] === nation || p[1] === nation));
      for (let i = 0; i < rounds.length; i++) {
        if (!rest[i]) merged.push(rounds[i].slice());
      }
      for (let i = 0; i < rounds.length; i++) {
        if (!rest[i]) continue;
        // index in merged of the following non-rest round, else the previous
        let after = 0;
        for (let j = 0; j < i; j++) if (!rest[j]) after++;
        const target = after < merged.length ? after : merged.length - 1;
        for (const p of rounds[i]) merged[target].push(p);
      }
      const fx = [];
      merged.slice(0, 8).forEach((r, k) => { for (const [h, a] of r) fx.push([k + 1, h, a, null, null]); });
      S.nt.q = { tour: kind + year, grp: sortIds(grp), fx, t: newTable(grp), done: false };
    }
  }
  if (!S.nt.q) {
    const rng = rngFor(S.season, nation, 'fr');
    const me = nstr(S, nation);
    let cand = sortIds(Object.keys(S.nt.str)).filter((id) => id !== nation && Math.abs(nstr(S, id) - me) <= 10);
    if (cand.length < 4) cand = sortIds(Object.keys(S.nt.str)).filter((id) => id !== nation);
    for (let k = 1; k <= 8; k++) {
      const o = rng.pick(cand);
      S.nt.fr.push(k % 2 === 1 ? [k, nation, o, null, null] : [k, o, nation, null, null]);
    }
  }
}

export function qualifierQualified(S) {
  const q = S.nt.q;
  if (!q) return null;
  const rk = rankRows(q.t, (id) => nstr(S, id)).map((r) => r[0]);
  return { top: rk.slice(0, 2), rest: rk.slice(2), rank: rk.indexOf(S.player.nation) + 1 };
}

function groupFixtures(groups) {
  const gfx = [];
  const P = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]];
  groups.forEach((g) => {
    P.forEach((md, mi) => { for (const [x, y] of md) if (g[x] && g[y]) gfx.push([mi + 1, g[x], g[y], null, null]); });
  });
  return gfx;
}

function makeGroups(S, field, nGroups, rng, strFn) {
  const sorted = field.slice().sort((a, b) => (strFn(b) - strFn(a)) || (a < b ? -1 : 1));
  const groups = [];
  for (let g = 0; g < nGroups; g++) groups.push([]);
  for (let p = 0; p < 4; p++) {
    const pot = rng.shuffle(sorted.slice(p * nGroups, p * nGroups + nGroups));
    pot.forEach((id, i) => groups[i].push(id));
  }
  return groups;
}

function buildTournament(S, key, kind, fmt, field, strFn, seedKey) {
  const rng = rngFor(S.season, key, seedKey || 'draw');
  const nG = { g48: 12, g24: 6, g16: 4, g8: 2 }[fmt];
  const groups = makeGroups(S, field, nG, rng, strFn);
  return { key, kind, fmt, groups, gfx: groupFixtures(groups), gt: groups.map((g) => newTable(g)), ko: {}, w: null, stage: {} };
}

// Senior tournament of the summer (week 45). Returns the tournament or null.
export function buildSummerTournament(S) {
  const nation = S.player.nation;
  const year = S.season + 1;
  const kind = tourKindFor(nation, year);
  S.nt.tour = null;
  if (!kind) return null;
  const key = kind + year;
  const rng = rngFor(S.season, key, 'field');
  const score = {};
  for (const id of sortIds(Object.keys(S.nt.str))) score[id] = nstr(S, id) + rng.normal(0, 4);
  const q = S.nt.q && S.nt.q.tour === key ? S.nt.q : null;
  const qq = q ? qualifierQualified(S) : null;
  const excluded = new Set(qq ? qq.rest : []);
  const mustIn = qq ? qq.top : [];
  const pickBest = (pool, n, already) => {
    const out = [];
    for (const id of mustIn) if (pool.indexOf(id) >= 0 && out.length < n && already.indexOf(id) < 0) out.push(id);
    const rest = pool.filter((id) => out.indexOf(id) < 0 && already.indexOf(id) < 0 && !excluded.has(id)).sort((a, b) => (score[b] - score[a]) || (a < b ? -1 : 1));
    for (const id of rest) { if (out.length >= n) break; out.push(id); }
    return out;
  };
  let field = [], fmt = 'g24';
  if (kind === 'wc') {
    fmt = 'g48';
    for (const cf of ['UEFA', 'CAF', 'AFC', 'CONMEBOL', 'CONCACAF']) field = field.concat(pickBest(countriesOf(cf), WC_QUOTA[cf], field));
    const rest = sortIds(Object.keys(S.nt.str)).filter((id) => field.indexOf(id) < 0 && !excluded.has(id)).sort((a, b) => (score[b] - score[a]) || (a < b ? -1 : 1));
    field = field.concat(rest.slice(0, 48 - field.length));
  } else if (kind === 'euro') { fmt = 'g24'; field = pickBest(countriesOf('UEFA'), 24, []); }
  else if (kind === 'copa') { fmt = 'g16'; field = countriesOf('CONMEBOL').slice(0, 10).concat(copaGuests(S, nation)); }
  else if (kind === 'afcon' || kind === 'asian') {
    const pool = countriesOf(kind === 'afcon' ? 'CAF' : 'AFC');
    fmt = pool.length >= 24 ? 'g24' : 'g16';
    field = pickBest(pool, fmt === 'g24' ? 24 : 16, []);
  } else if (kind === 'gold') {
    const { pool, slots } = qualPool(S, 'gold', nation);
    fmt = slots === 16 ? 'g16' : 'g8';
    field = pickBest(pool, slots, []);
  }
  const need = { g48: 48, g24: 24, g16: 16, g8: 8 }[fmt];
  if (field.length < need) {
    const extra = sortIds(Object.keys(S.nt.str)).filter((id) => field.indexOf(id) < 0).sort((a, b) => (score[b] - score[a]) || (a < b ? -1 : 1));
    field = field.concat(extra.slice(0, need - field.length));
  }
  field = sortIds(field.slice(0, need));
  const T = buildTournament(S, key, kind, fmt, field, (id) => nstr(S, id));
  T.lvl = 'senior';
  S.nt.tour = T;
  return T;
}

export function buildYouthTournament(S, lvl) {
  const nation = S.player.nation;
  const year = S.season + 1;
  const c = COUNTRY_BY_ID[nation];
  const key = lvl + '_' + year;
  const rng = rngFor(S.season, key, 'field');
  const pool = countriesOf(c.confed).filter((id) => id !== nation);
  const sc = {};
  for (const id of pool) sc[id] = nstr(S, id) + rng.normal(0, 4);
  let others = pool.sort((a, b) => (sc[b] - sc[a]) || (a < b ? -1 : 1)).slice(0, 7);
  if (others.length < 7) {
    const extra = sortIds(Object.keys(S.nt.str)).filter((id) => id !== nation && others.indexOf(id) < 0).slice(0, 7 - others.length);
    others = others.concat(extra);
  }
  const field = sortIds([nation].concat(others));
  const T = buildTournament(S, key, lvl, 'g8', field, (id) => youthNStr(S, id, lvl));
  T.lvl = lvl;
  S.nt.ytour = T;
  return T;
}

export function tourStr(S, T, id) { return T.lvl && T.lvl !== 'senior' ? youthNStr(S, id, T.lvl) : nstr(S, id); }

function bracketOrder(n) {
  let o = [1, 2];
  while (o.length < n) {
    const m = o.length * 2;
    const nx = [];
    for (const s of o) { nx.push(s); nx.push(m + 1 - s); }
    o = nx;
  }
  return o;
}

function buildKO(S, T) {
  const nG = T.groups.length;
  const thirds = { g48: 8, g24: 4, g16: 0, g8: 0 }[T.fmt];
  const tiers = [[], [], []];
  T.gt.forEach((rows, gi) => {
    const rk = rankRows(rows, (id) => tourStr(S, T, id));
    rk.forEach((r, pos) => { if (pos < 3) tiers[pos].push({ id: r[0], g: gi, r }); });
  });
  const srt = (a, b) => (b.r[7] - a.r[7]) || ((b.r[5] - b.r[6]) - (a.r[5] - a.r[6])) || (b.r[5] - a.r[5]) || (a.id < b.id ? -1 : 1);
  const seeds = tiers[0].sort(srt).concat(tiers[1].sort(srt)).concat(tiers[2].sort(srt).slice(0, thirds));
  const N = seeds.length;
  const order = bracketOrder(N);
  const pairs = [];
  for (let i = 0; i < N; i += 2) pairs.push([seeds[order[i] - 1], seeds[order[i + 1] - 1]]);
  // avoid same-group pairings where possible (swap away sides with a neighbour pair)
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0].g !== pairs[i][1].g) continue;
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue;
      const a = pairs[i], b = pairs[j];
      if (a[0].g !== b[1].g && b[0].g !== a[1].g) { const t = a[1]; a[1] = b[1]; b[1] = t; break; }
    }
  }
  const key = KO_KEY[N];
  T.ko[key] = pairs.map(([x, y]) => [x.id, y.id, null, null, null]);
  T.groupOut = sortIds(T.groups.flat().filter((id) => !seeds.some((s) => s.id === id)));
}

function koWinnerT(t) {
  if (t[4] && t[4].indexOf('p:') === 0) { const [a, b] = t[4].slice(2).split('-').map(Number); return a > b ? t[0] : t[1]; }
  return t[2] >= t[3] ? t[0] : t[1];
}

// Fixtures of national competitions for (week, slot). nationCtx: { youthLvl } for generated youth matches.
export function natFixturesInSlot(S, week, slot) {
  const out = [];
  const k = intlSlotIndex(week, slot);
  if (k > 0) {
    const q = S.nt.q;
    if (q) q.fx.forEach((f, i) => { if (f[0] === k && f[3] === null) out.push({ comp: 'q_' + q.tour, kind: 'national', h: f[1], a: f[2], ko: false, neutral: false, ref: { t: 'q', i } }); });
    S.nt.fr.forEach((f, i) => { if (f[0] === k && f[3] === null) out.push({ comp: 'fr', kind: 'friendly', h: f[1], a: f[2], ko: false, neutral: false, ref: { t: 'fr', i } }); });
  }
  for (const tk of ['tour', 'ytour']) {
    const T = S.nt[tk];
    if (!T || T.w) continue;
    const slots = tournamentSlots(T.fmt);
    const sl = slots.find((x) => x.w === week && x.s === slot);
    if (!sl) continue;
    const kind = tk === 'tour' ? 'national' : 'ynt';
    if (sl.key.indexOf('md') === 0) {
      const md = Number(sl.key.slice(2));
      T.gfx.forEach((f, i) => { if (f[0] === md && f[3] === null) out.push({ comp: T.key, kind, h: f[1], a: f[2], ko: false, neutral: true, ref: { t: tk, g: true, i }, rk: 'grp', lvl: T.lvl }); });
    } else if (T.ko[sl.key]) {
      T.ko[sl.key].forEach((t, i) => { if (t[2] === null) out.push({ comp: T.key, kind, h: t[0], a: t[1], ko: true, neutral: true, ref: { t: tk, r: sl.key, i }, rk: sl.key, lvl: T.lvl, final: sl.key === 'f' }); });
    }
  }
  return out;
}

// A generated youth-national match for the player's level in an INTL slot.
export function yntFixture(S, lvl, week, slot) {
  const k = intlSlotIndex(week, slot);
  if (!k) return null;
  const nation = S.player.nation;
  const rng = rngFor(S.season, nation, lvl, 'ynt', k);
  const me = nstr(S, nation);
  const c = COUNTRY_BY_ID[nation];
  let cand = countriesOf(c.confed).filter((id) => id !== nation && Math.abs(nstr(S, id) - me) <= 12);
  if (cand.length < 2) cand = countriesOf(c.confed).filter((id) => id !== nation);
  const o = rng.pick(cand);
  if (!o) return null;
  const h = k % 2 === 1 ? nation : o, a = k % 2 === 1 ? o : nation;
  return { comp: 'ynt_' + lvl, kind: 'ynt', h, a, ko: false, neutral: false, ref: { t: 'gen' }, lvl };
}

export function natApply(S, fx, hg, ag, extra) {
  const r = fx.ref;
  if (r.t === 'q') { const f = S.nt.q.fx[r.i]; f[3] = hg; f[4] = ag; tableApply(S.nt.q.t, f[1], f[2], hg, ag); return; }
  if (r.t === 'fr') { const f = S.nt.fr[r.i]; f[3] = hg; f[4] = ag; return; }
  if (r.t === 'tour' || r.t === 'ytour') {
    const T = S.nt[r.t];
    if (r.g) {
      const f = T.gfx[r.i]; f[3] = hg; f[4] = ag;
      const gi = T.groups.findIndex((g) => g.indexOf(f[1]) >= 0);
      if (gi >= 0) tableApply(T.gt[gi], f[1], f[2], hg, ag);
    } else {
      const t = T.ko[r.r][r.i]; t[2] = hg; t[3] = ag; t[4] = extra || null;
    }
  }
}

// After-slot transitions. Returns events: [{ type: 'q_done'|'tour_done'|'out', tour, ... }]
export function natAfterSlot(S, week, slot) {
  const ev = [];
  const k = intlSlotIndex(week, slot);
  if (k === 8 && S.nt.q && !S.nt.q.done) { S.nt.q.done = true; ev.push({ type: 'q_done' }); }
  for (const tk of ['tour', 'ytour']) {
    const T = S.nt[tk];
    if (!T || T.w) continue;
    const slots = tournamentSlots(T.fmt);
    const sl = slots.find((x) => x.w === week && x.s === slot);
    if (!sl) continue;
    if (sl.key === 'md3') {
      buildKO(S, T);
      for (const id of T.groupOut) T.stage[id] = 'group';
    } else if (T.ko[sl.key] && T.ko[sl.key].every((t) => t[2] !== null)) {
      const winners = T.ko[sl.key].map(koWinnerT);
      for (const t of T.ko[sl.key]) { const w = koWinnerT(t); const l = w === t[0] ? t[1] : t[0]; T.stage[l] = sl.key; }
      if (sl.key === 'f') {
        T.w = winners[0];
        T.stage[T.w] = 'w';
        ev.push({ type: 'tour_done', tk, T });
      } else {
        const nk = KO_KEY[winners.length];
        const nx = [];
        for (let i = 0; i + 1 < winners.length; i += 2) nx.push([winners[i], winners[i + 1], null, null, null]);
        T.ko[nk] = nx;
      }
    }
  }
  return ev;
}

export function nationInTour(T, id) { return !!T && T.groups.some((g) => g.indexOf(id) >= 0); }
export function nationAlive(T, id) { return nationInTour(T, id) && !T.stage[id]; }
export { intlSlotOf };

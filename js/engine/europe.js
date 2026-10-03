// European club competitions UCL / UEL / UECL (SPEC §5.8).
import { rngFor } from '../core/rng.js';
import { LEAGUES, EURO_FILLER_CLUBS } from '../data/leagues.js';
import { EURO_WEEKS } from './calendar.js';
import { leaguePhaseDraw } from './schedule.js';
import { cs, leagueRanking, newTable, tableApply, rankRows, isFiller, clubData } from './world.js';
import { sortIds } from './util.js';

export const EC = ['ucl', 'uel', 'uecl'];
const TIER = { ucl: 1, uel: 2, uecl: 3 };
const FILL_ORDER = { ucl: [1, 2, 3], uel: [2, 3, 1], uecl: [3, 2, 1] };
export const KO_STAGES = ['kpo', 'r16', 'qf', 'sf', 'f'];

function emptyNext() { return { ucl: { lp: [], q: [] }, uel: { lp: [], q: [] }, uecl: { lp: [], q: [] } }; }
function fillerTier(id) { const c = clubData(id); return (c && c.tier) || 3; }

export function uefaLeagues() { return LEAGUES.filter((l) => l.tier === 1 && l.euro); }

// ranksByLeague: { [lid]: ids[] }, cupWinners: { [lid]: clubId|null }, holders: { ucl, uel, uecl }
export function allocateEntrants(ranksByLeague, cupWinners, holders) {
  const next = emptyNext();
  const q = new Set();
  const add = (comp, kind, id) => { next[comp][kind].push(id); q.add(id); };
  if (holders) {
    const hs = [['ucl', holders.ucl], ['ucl', holders.uel], ['uel', holders.uecl]];
    for (const [comp, id] of hs) if (id && !q.has(id)) add(comp, 'lp', id);
  }
  for (const lg of uefaLeagues()) {
    const rk = ranksByLeague[lg.id] || [];
    const order = [];
    for (const comp of EC) {
      for (const kind of ['lp', 'q']) {
        const n = (lg.euro[comp] && lg.euro[comp][kind]) || 0;
        for (let i = 0; i < n; i++) order.push([comp, kind]);
      }
    }
    let p = 0;
    for (const [comp, kind] of order) {
      while (p < rk.length && q.has(rk[p])) p++;
      if (p >= rk.length) break;
      add(comp, kind, rk[p]); p++;
    }
    const cupSlot = lg.euro.cup;
    if (cupSlot) {
      const [comp, kind] = cupSlot === 'uel_lp' ? ['uel', 'lp'] : cupSlot === 'uel_q' ? ['uel', 'q'] : ['uecl', 'q'];
      const cw = cupWinners ? cupWinners[lg.id] : null;
      if (cw && !q.has(cw)) add(comp, kind, cw);
      else {
        const nx = rk.find((id) => !q.has(id));
        if (nx) add(comp, kind, nx);
      }
    }
  }
  for (const c of EC) { next[c].lp = sortIds(next[c].lp); next[c].q = sortIds(next[c].q); }
  return next;
}

export function firstSeasonEntrants(S) {
  const rng = rngFor(S.startSeason, 'euro0');
  const ranks = {}, cups = {};
  for (const lg of uefaLeagues()) {
    const ids = sortIds(S.comp.lg[lg.id].t.map((r) => r[0]));
    const sc = {};
    for (const id of ids) sc[id] = cs(S, id) + rng.normal(0, 3);
    ranks[lg.id] = ids.slice().sort((a, b) => (sc[b] - sc[a]) || (a < b ? -1 : 1));
    cups[lg.id] = lg.cup ? ranks[lg.id][rng.int(1, Math.min(5, ranks[lg.id].length - 1))] : null;
  }
  return allocateEntrants(ranks, cups, null);
}

export function computeNextEntrants(S) {
  const ranks = {}, cups = {};
  for (const lg of uefaLeagues()) {
    ranks[lg.id] = leagueRanking(S, lg.id);
    const C = lg.cup && S.comp.cups[lg.cup.id];
    cups[lg.id] = C ? C.w : null;
  }
  const E = S.comp.eu;
  const holders = { ucl: E.ucl.w, uel: E.uel.w, uecl: E.uecl.w };
  return allocateEntrants(ranks, cups, holders);
}

function emptyEuro() { return { q: [], lp: { teams: [], fx: [], t: [] }, ko: { kpo: [], r16: [], qf: [], sf: [], f: [] }, w: null, md: 0, pend: [], rk: [] }; }

// Build the season's European competitions from entrants (comp.next or first season pseudo-table).
export function buildEurope(S, next) {
  const eu = { ucl: emptyEuro(), uel: emptyEuro(), uecl: emptyEuro(), used: [] };
  const used = new Set();
  for (const c of EC) for (const id of next[c].lp.concat(next[c].q)) used.add(id);
  for (const c of EC) {
    const E = eu[c];
    E.pend = next[c].lp.slice();
    const rng = rngFor(S.season, c, 'qdraw');
    const qs = next[c].q.slice().sort((a, b) => (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1));
    for (const id of qs) {
      const pool = EURO_FILLER_CLUBS.filter((f) => !used.has(f.id) && (f.tier || 3) === TIER[c]);
      let cand = pool.length ? pool : EURO_FILLER_CLUBS.filter((f) => !used.has(f.id));
      if (!cand.length) { E.pend.push(id); continue; }
      const s0 = cs(S, id);
      cand = cand.slice().sort((x, y) => (Math.abs(cs(S, x.id) - s0) - Math.abs(cs(S, y.id) - s0)) || (x.id < y.id ? -1 : 1));
      const opp = rng.pick(cand.slice(0, 3)).id;
      used.add(opp);
      const strong = cs(S, id) >= cs(S, opp) ? id : opp;
      const weak = strong === id ? opp : id;
      E.q.push([weak, strong, null, null, null], [strong, weak, null, null, null]);
    }
  }
  eu.used = sortIds(Array.from(used));
  return eu;
}

function twoLegWinner(l1, l2) {
  // l2 home = l1 away
  const extra = l2[4];
  if (extra && extra.indexOf('p:') === 0) {
    const [a, b] = extra.slice(2).split('-').map(Number);
    return a > b ? l2[0] : l2[1];
  }
  const t2h = l2[2] + l1[3], t2a = l2[3] + l1[2];
  return t2h >= t2a ? l2[0] : l2[1];
}
export { twoLegWinner };

function buildLeaguePhase(S, c) {
  const eu = S.comp.eu;
  const E = eu[c];
  const used = new Set(eu.used);
  let teams = E.pend.slice();
  // q winners / drops already appended to pend
  const need = 36 - teams.length;
  if (need > 0) {
    const rng = rngFor(S.season, c, 'fill');
    const chosen = [];
    for (const tier of FILL_ORDER[c]) {
      if (chosen.length >= need) break;
      const pool = EURO_FILLER_CLUBS.filter((f) => !used.has(f.id) && (f.tier || 3) === tier).map((f) => f.id);
      const sc = {};
      for (const id of sortIds(pool)) sc[id] = cs(S, id) + rng.normal(0, 3);
      const ordered = sortIds(pool).sort((a, b) => (sc[b] - sc[a]) || (a < b ? -1 : 1));
      for (const id of ordered) { if (chosen.length >= need) break; chosen.push(id); used.add(id); }
    }
    teams = teams.concat(chosen);
  } else if (need < 0) {
    teams = teams.sort((a, b) => (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1)).slice(0, 36);
  }
  teams = sortIds(teams);
  for (const id of teams) used.add(id);
  eu.used = sortIds(Array.from(used));
  const draw = leaguePhaseDraw(teams, (id) => cs(S, id), rngFor(S.season, c, 'lp'));
  E.lp = { teams, fx: draw.fx, t: newTable(teams) };
  E.pend = [];
}

function resolveQualifying(S) {
  const eu = S.comp.eu;
  for (const c of EC) {
    const E = eu[c];
    for (let i = 0; i + 1 < E.q.length; i += 2) {
      const l1 = E.q[i], l2 = E.q[i + 1];
      if (l2[2] === null) continue;
      const w = twoLegWinner(l1, l2);
      const l = w === l2[0] ? l2[1] : l2[0];
      E.pend.push(w);
      if (!isFiller(l)) {
        if (c === 'ucl') eu.uel.pend.push(l);
        else if (c === 'uel') eu.uecl.pend.push(l);
      }
    }
  }
}

export function lpRanking(S, E) {
  return rankRows(E.lp.t, (id) => cs(S, id)).map((r) => r[0]);
}

function twoLeg(hiSeed, loSeed) {
  return [[loSeed, hiSeed, null, null, null], [hiSeed, loSeed, null, null, null]];
}
function tieWinners(arr) {
  const out = [];
  for (let i = 0; i + 1 < arr.length; i += 2) out.push(twoLegWinner(arr[i], arr[i + 1]));
  return out;
}
function seedOf(E, id) { const i = E.rk.indexOf(id); return i < 0 ? 99 : i; }
function pairTwoLeg(E, a, b) {
  return seedOf(E, a) <= seedOf(E, b) ? twoLeg(a, b) : twoLeg(b, a);
}

// Fixture descriptors of European comps in (week, slot)
export function euroFixturesInSlot(S, week, slot) {
  const out = [];
  const eu = S.comp.eu;
  if (!eu) return out;
  for (const c of EC) {
    const E = eu[c];
    const push = (arr, stage, i, ko, neutral, leg) => {
      const t = arr[i];
      if (!t || t[2] !== null) return;
      let agg = null;
      if (leg === 2) { const l1 = arr[i - 1]; agg = [l1[3], l1[2]]; }
      out.push({ comp: c, kind: 'europe', h: t[0], a: t[1], ko, neutral: !!neutral, ref: { stage, i }, tie: leg ? { leg, agg } : null, rk: stage });
    };
    if (slot === 'mw' && (week === EURO_WEEKS.q[0] || week === EURO_WEEKS.q[1])) {
      const leg = week === EURO_WEEKS.q[0] ? 1 : 2;
      for (let i = leg - 1; i < E.q.length; i += 2) push(E.q, 'q', i, leg === 2, false, leg);
    }
    const mdi = EURO_WEEKS.lp.indexOf(week);
    if (slot === 'mw' && mdi >= 0) {
      const md = mdi + 1;
      E.lp.fx.forEach((f, i) => {
        if (f[0] !== md || f[3] !== null) return;
        out.push({ comp: c, kind: 'europe', h: f[1], a: f[2], ko: false, neutral: false, ref: { stage: 'lp', i }, tie: null, rk: 'lp', md });
      });
    }
    for (const st of ['kpo', 'r16', 'qf', 'sf']) {
      const wk = EURO_WEEKS[st];
      const li = wk.indexOf(week);
      if (slot === 'mw' && li >= 0) {
        const leg = li + 1;
        for (let i = leg - 1; i < E.ko[st].length; i += 2) push(E.ko[st], st, i, leg === 2, false, leg);
      }
    }
    if (week === EURO_WEEKS.f && slot === (c === 'ucl' ? 'wk' : 'mw')) {
      if (E.ko.f.length) push(E.ko.f, 'f', 0, true, true, 0);
    }
  }
  return out;
}

export function euroApply(S, fx, hg, ag, extra) {
  const E = S.comp.eu[fx.comp];
  const st = fx.ref.stage;
  if (st === 'lp') {
    const f = E.lp.fx[fx.ref.i];
    f[3] = hg; f[4] = ag;
    tableApply(E.lp.t, f[1], f[2], hg, ag);
    return;
  }
  const arr = st === 'q' ? E.q : E.ko[st];
  const t = arr[fx.ref.i];
  t[2] = hg; t[3] = ag; t[4] = extra || null;
}

// Stage transitions after slot processing. Returns finals completed [{ comp, winner }]
export function euroAfterSlot(S, week, slot) {
  const eu = S.comp.eu;
  const done = [];
  if (!eu) return done;
  if (week === EURO_WEEKS.q[1] && slot === 'mw') {
    resolveQualifying(S);
    for (const c of EC) buildLeaguePhase(S, c);
  }
  for (const c of EC) {
    const E = eu[c];
    if (slot === 'mw' && EURO_WEEKS.lp.indexOf(week) >= 0) {
      E.md = EURO_WEEKS.lp.indexOf(week) + 1;
      if (E.md === 8) {
        E.rk = lpRanking(S, E);
        const kpo = [];
        for (let t = 1; t <= 8; t++) kpo.push(...twoLeg(E.rk[8 + t - 1], E.rk[25 - t - 1]));
        E.ko.kpo = kpo;
      }
    }
    if (slot === 'mw' && week === EURO_WEEKS.kpo[1] && E.ko.kpo.length) {
      const w = tieWinners(E.ko.kpo);
      const r16 = [];
      for (let k = 1; k <= 8; k++) r16.push(...twoLeg(E.rk[k - 1], w[9 - k - 1]));
      E.ko.r16 = r16;
    }
    if (slot === 'mw' && week === EURO_WEEKS.r16[1] && E.ko.r16.length) {
      const w = tieWinners(E.ko.r16);
      const pairs = [[0, 7], [3, 4], [1, 6], [2, 5]];
      E.ko.qf = [].concat(...pairs.map(([a, b]) => pairTwoLeg(E, w[a], w[b])));
    }
    if (slot === 'mw' && week === EURO_WEEKS.qf[1] && E.ko.qf.length) {
      const w = tieWinners(E.ko.qf);
      E.ko.sf = [].concat(pairTwoLeg(E, w[0], w[1]), pairTwoLeg(E, w[2], w[3]));
    }
    if (slot === 'mw' && week === EURO_WEEKS.sf[1] && E.ko.sf.length) {
      const w = tieWinners(E.ko.sf);
      const [a, b] = seedOf(E, w[0]) <= seedOf(E, w[1]) ? [w[0], w[1]] : [w[1], w[0]];
      E.ko.f = [[a, b, null, null, null]];
    }
    if (week === EURO_WEEKS.f && slot === (c === 'ucl' ? 'wk' : 'mw') && E.ko.f.length && E.ko.f[0][2] !== null && !E.w) {
      const t = E.ko.f[0];
      let w;
      if (t[4] && t[4].indexOf('p:') === 0) { const [x, y] = t[4].slice(2).split('-').map(Number); w = x > y ? t[0] : t[1]; }
      else w = t[2] >= t[3] ? t[0] : t[1];
      E.w = w;
      done.push({ comp: c, winner: w });
    }
  }
  return done;
}

// Which European competition (if any) a club is in this season, and is it still alive
export function clubEuroComp(S, id) {
  const eu = S.comp && S.comp.eu;
  if (!eu) return null;
  for (const c of EC) {
    const E = eu[c];
    if (E.lp.teams.indexOf(id) >= 0 || E.pend.indexOf(id) >= 0) return c;
    for (const t of E.q) if (t[0] === id || t[1] === id) return c;
  }
  return null;
}

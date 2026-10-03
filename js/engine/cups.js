// Domestic cups (SPEC §5.9).
import { rngFor } from '../core/rng.js';
import { LEAGUES, LEAGUE_BY_ID } from '../data/leagues.js';
import { cupRoundSlots } from './calendar.js';
import { cupBracket } from './schedule.js';
import { cs, clubLeague, leagueMembers } from './world.js';
import { sortIds } from './util.js';

const RKEY = { 128: 'r128', 64: 'r64', 32: 'r32', 16: 'r16', 8: 'qf', 4: 'sf', 2: 'f' };

export function cupDefs() {
  return LEAGUES.filter((l) => l.tier === 1 && l.cup).map((l) => ({ id: l.cup.id, nameHe: l.cup.nameHe, leagueId: l.id, countryId: l.countryId }));
}
let _cupById = null;
export function cupDef(id) {
  if (!_cupById) { _cupById = {}; for (const d of cupDefs()) _cupById[d.id] = d; }
  return _cupById[id] || null;
}
export function cupIds() { return sortIds(cupDefs().map((d) => d.id)); }

function tierOf(S, id) { const l = LEAGUE_BY_ID[clubLeague(S, id)]; return l ? l.tier : 3; }

function orient(S, a, b) {
  const ta = tierOf(S, a), tb = tierOf(S, b);
  // home = lower-tier club (higher tier number), or the weaker club
  if (ta !== tb) return ta > tb ? [a, b] : [b, a];
  const sa = cs(S, a), sb = cs(S, b);
  if (sa !== sb) return sa < sb ? [a, b] : [b, a];
  return a < b ? [a, b] : [b, a];
}

export function roundKey(C, rd) {
  const B = Math.pow(2, C.nr);
  return RKEY[B / Math.pow(2, rd)] || ('r' + (B / Math.pow(2, rd)));
}

export function buildCups(S) {
  const cups = {};
  for (const d of cupDefs()) {
    const lgs = LEAGUES.filter((l) => l.countryId === d.countryId).map((l) => l.id);
    let ents = [];
    for (const lid of lgs) ents = ents.concat(leagueMembers(S, lid));
    ents = sortIds(ents);
    const N = ents.length;
    if (N < 2) continue;
    let B = 1; while (B < N) B *= 2;
    const nr = Math.round(Math.log2(B));
    const nb = B - N;
    const bySeed = ents.slice().sort((a, b) => (tierOf(S, a) - tierOf(S, b)) || (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1));
    const byes = sortIds(bySeed.slice(0, nb));
    const r1 = ents.filter((id) => byes.indexOf(id) < 0);
    const rng = rngFor(S.season, d.id, 'draw', 0);
    const ties = cupBracket(r1, rng).map(([a, b]) => { const [h, x] = orient(S, a, b); return [h, x, null, null, null]; });
    cups[d.id] = { rd: 0, rounds: [ties], alive: ents, w: null, nr, byes };
  }
  return cups;
}

export function cupFixturesInSlot(S, week, slot) {
  const out = [];
  for (const id of cupIds()) {
    const C = S.comp.cups[id];
    if (!C || C.w || C.rd >= C.nr) continue;
    const sl = cupRoundSlots(C.nr)[C.rd];
    if (!sl || sl.w !== week || sl.s !== slot) continue;
    const ties = C.rounds[C.rd] || [];
    const final = C.rd === C.nr - 1;
    ties.forEach((t, i) => {
      if (t[2] !== null) return;
      out.push({ comp: id, kind: 'cup', h: t[0], a: t[1], ko: true, neutral: final, ref: { rd: C.rd, i }, rk: roundKey(C, C.rd), final });
    });
  }
  return out;
}

export function cupApply(S, fx, hg, ag, extra) {
  const C = S.comp.cups[fx.comp];
  const t = C.rounds[fx.ref.rd][fx.ref.i];
  t[2] = hg; t[3] = ag; t[4] = extra || null;
}

function tieWinner(t) {
  if (t[4] && t[4].indexOf('p:') === 0) {
    const [a, b] = t[4].slice(2).split('-').map(Number);
    return a > b ? t[0] : t[1];
  }
  return t[2] >= t[3] ? t[0] : t[1];
}
export { tieWinner as cupTieWinner };

// After a slot: complete rounds, draw next ones. Returns list of { cup, winner } for finals completed.
export function cupsAfterSlot(S) {
  const done = [];
  for (const id of cupIds()) {
    const C = S.comp.cups[id];
    if (!C || C.w) continue;
    const ties = C.rounds[C.rd];
    if (!ties || ties.length === 0 || ties.some((t) => t[2] === null)) continue;
    const winners = ties.map(tieWinner);
    let alive = winners.slice();
    if (C.rd === 0) alive = alive.concat(C.byes);
    C.alive = sortIds(alive);
    C.rd++;
    if (C.alive.length === 1 || C.rd >= C.nr) {
      C.w = C.alive[0];
      done.push({ cup: id, winner: C.w });
      continue;
    }
    const rng = rngFor(S.season, id, 'draw', C.rd);
    C.rounds[C.rd] = cupBracket(C.alive, rng).map(([a, b]) => { const [h, x] = orient(S, a, b); return [h, x, null, null, null]; });
  }
  return done;
}

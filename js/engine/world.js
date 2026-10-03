// World: data lookups, club runtime values, league tables, round play, promotion/relegation, club evolution.
import { COUNTRIES, COUNTRY_BY_ID } from '../data/countries.js';
import { LEAGUES, LEAGUE_BY_ID, CLUB_INDEX, EURO_FILLER_CLUBS } from '../data/leagues.js';
import { NAME_POOLS, NAME_POOLS_F } from '../data/names.js';
import { rngFor } from '../core/rng.js';
import { clamp, round1, sortIds, curGender } from './util.js';
import { roundRobin, splitGroups } from './schedule.js';
import { leagueRoundSlots } from './calendar.js';
import { simScore } from './sim.js';

// ---------- static lookups (derived purely from data) ----------
export function clubData(id) { const e = CLUB_INDEX[id]; return e ? e.club : null; }
export function isFiller(id) { const e = CLUB_INDEX[id]; return !!e && !e.leagueId; }
export function isClub(id) { return !!CLUB_INDEX[id]; }
export function baseLeagueOf(id) { const e = CLUB_INDEX[id]; return e ? e.leagueId : null; }
export function clubCountry(id) {
  const e = CLUB_INDEX[id];
  if (!e) return null;
  if (e.leagueId) return LEAGUE_BY_ID[e.leagueId].countryId;
  return e.club.nation || null;
}
export function country(id) { return COUNTRY_BY_ID[id] || null; }
export function league(id) { return LEAGUE_BY_ID[id] || null; }
export function poolOfCountry(cid) {
  const c = COUNTRY_BY_ID[cid];
  const p = c && c.namePool;
  return (p && NAME_POOLS[p]) ? p : (NAME_POOLS.generic ? 'generic' : Object.keys(NAME_POOLS)[0]);
}
// gender: 'm' | 'f' (default: the current career's gender). Women draw female first names; surnames are shared.
export function genName(rng, poolId, gender) {
  const pool = NAME_POOLS[poolId] || NAME_POOLS.generic || NAME_POOLS[Object.keys(NAME_POOLS)[0]];
  const g = gender === 'm' || gender === 'f' ? gender : curGender();
  const fp = g === 'f' ? ((NAME_POOLS_F && (NAME_POOLS_F[poolId] || NAME_POOLS_F.generic)) || null) : null;
  const first = rng.pick(fp ? fp.first : pool.first) || (g === 'f' ? 'נועה' : 'יוסי');
  const last = rng.pick(pool.last) || 'כהן';
  return { first, last, full: first + ' ' + last };
}
// Players' names around the player (teammates, keepers, rivals) follow the career gender.
export function nameFor(clubOrNation, ...key) { return nameForG(curGender(), clubOrNation, ...key); }
export function nameForG(gender, clubOrNation, ...key) {
  const cid = isClub(clubOrNation) ? clubCountry(clubOrNation) : clubOrNation;
  return genName(rngFor(clubOrNation, ...key), poolOfCountry(cid), gender).full;
}

// ---------- women's football display names (C3) ----------
export function lgNameHe(lid) { const l = LEAGUE_BY_ID[lid]; if (!l) return ''; return curGender() === 'f' ? (l.nameHeW || l.nameHe + ' לנשים') : l.nameHe; }
export function lgYouthHe(lid) { const l = LEAGUE_BY_ID[lid]; if (!l) return curGender() === 'f' ? 'ליגת הנערות' : 'ליגת הנוער'; return curGender() === 'f' ? (l.youthNameHeW || 'ליגת הנערות') : (l.youthNameHe || 'ליגת הנוער'); }

let _leagueOrder = null;
export function leagueIds() {
  if (!_leagueOrder) _leagueOrder = sortIds(LEAGUES.map((l) => l.id));
  return _leagueOrder;
}
export function tier1Leagues() { return LEAGUES.filter((l) => l.tier === 1); }
export function countryLeagues(cid) { return LEAGUES.filter((l) => l.countryId === cid); }

// ---------- runtime club values ----------
export function cs(S, id) { const c = S.world.clubs[id]; return c ? c.s : 50; }
export function clubLeague(S, id) { const c = S.world.clubs[id]; return c ? c.lg : null; }
export function clubPrestige(S, id) { const l = LEAGUE_BY_ID[clubLeague(S, id)]; return l ? l.prestige : 5; }
export function clubName(id) { const c = clubData(id); return c ? c.nameHe : (COUNTRY_BY_ID[id] ? COUNTRY_BY_ID[id].nameHe : id); }
export function clubShort(id) { const c = clubData(id); return c ? (c.shortHe || c.nameHe) : (COUNTRY_BY_ID[id] ? COUNTRY_BY_ID[id].nameHe : id); }

export function initWorld(S) {
  const clubs = {};
  for (const lg of LEAGUES) {
    for (const c of lg.clubs) clubs[c.id] = { s: c.strength, r: c.reputation, b: c.budget, lg: lg.id };
  }
  for (const f of EURO_FILLER_CLUBS) clubs[f.id] = { s: f.strength, r: f.reputation, b: f.budget, lg: null };
  S.world = { clubs, champs: {} };
}

// ---------- TeamVM ----------
const YTH = { u17: ' עד גיל 17', u19: ' עד גיל 19', u21: ' עד גיל 21' };
export function teamVM(id, variant) {
  const c = clubData(id);
  if (c) {
    const vm = { id, nameHe: c.nameHe, shortHe: c.shortHe || c.nameHe, colors: (c.colors || ['#1fbf5a', '#ffffff']).slice(0, 2) };
    if (variant === 'youth') vm.nameHe += curGender() === 'f' ? ' (נערות)' : ' (נוער)';
    return vm;
  }
  const n = COUNTRY_BY_ID[id];
  if (n) {
    const vm = { id, nameHe: n.nameHe, shortHe: n.nameHe, colors: (n.colors || ['#4da3ff', '#ffffff']).slice(0, 2), flag: n.flag || '' };
    if (variant && YTH[variant]) vm.nameHe = n.nameHe + YTH[variant];
    return vm;
  }
  return { id: String(id), nameHe: String(id), shortHe: String(id), colors: ['#24304d', '#ffffff'] };
}

// ---------- league formats ----------
const _fmtCache = {};
export function leagueFormat(lid) {
  if (_fmtCache[lid]) return _fmtCache[lid];
  const lg = LEAGUE_BY_ID[lid];
  const N = lg.clubs.length;
  const f = lg.format || { type: 'double_rr' };
  let cycles = 2, groups = null, halve = false;
  if (f.type === 'triple_rr_split') cycles = 3;
  if (f.type === 'double_rr_split' || f.type === 'triple_rr_split') { groups = f.groups || null; halve = !!f.halve; }
  const Rb = cycles * (N - 1);
  let extra = 0;
  if (groups) {
    for (const g of groups) {
      const size = g.to - g.from + 1;
      const per = size % 2 === 0 ? size - 1 : size;
      extra = Math.max(extra, (g.rr || 1) * per);
    }
  }
  const out = { N, cycles, Rb, R: Rb + extra, groups, halve };
  _fmtCache[lid] = out;
  return out;
}

const _rrCache = new Map();
function cachedRR(key, ids, cycles) {
  let v = _rrCache.get(key);
  if (!v) {
    const parts = key.split('#')[0];
    v = roundRobin(ids, cycles, rngFor(...parts.split('|')));
    if (_rrCache.size > 120) _rrCache.clear();
    _rrCache.set(key, v);
  }
  return v;
}
export function baseSchedule(season, lid, ids, cycles) {
  return cachedRR(season + '|' + lid + '|rr#' + ids.join(','), ids, cycles);
}
export function splitSchedule(season, lid, g, ids, rr) {
  return cachedRR(season + '|' + lid + '|split|' + g + '#' + ids.join(','), ids, rr);
}
export function youthSchedule(season, ylid, ids) {
  return cachedRR(season + '|' + ylid + '|rr#' + ids.join(','), ids, 2);
}

// ---------- tables ----------
export function newTable(ids) { return sortIds(ids).map((id) => [id, 0, 0, 0, 0, 0, 0, 0]); }
export function tableApply(t, h, a, hg, ag) {
  let rh = null, ra = null;
  for (const r of t) { if (r[0] === h) rh = r; else if (r[0] === a) ra = r; }
  if (!rh || !ra) return;
  rh[1]++; ra[1]++;
  rh[5] += hg; rh[6] += ag; ra[5] += ag; ra[6] += hg;
  if (hg > ag) { rh[2]++; ra[4]++; rh[7] += 3; }
  else if (hg < ag) { ra[2]++; rh[4]++; ra[7] += 3; }
  else { rh[3]++; ra[3]++; rh[7]++; ra[7]++; }
}
export function rankRows(rows, strFn) {
  return rows.slice().sort((x, y) =>
    (y[7] - x[7]) || ((y[5] - y[6]) - (x[5] - x[6])) || (y[5] - x[5]) || (y[2] - x[2]) ||
    (strFn ? (strFn(y[0]) - strFn(x[0])) : 0) || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
}
// Final (or current) ranking of a league -> ordered club ids
export function leagueRanking(S, lid) {
  const L = S.comp && S.comp.lg[lid];
  if (!L) return [];
  if (L.sp) {
    const out = [];
    for (const grp of L.sp) {
      const rows = L.t.filter((r) => grp.indexOf(r[0]) >= 0);
      for (const r of rankRows(rows)) out.push(r[0]);
    }
    return out;
  }
  return rankRows(L.t).map((r) => r[0]);
}
export function leagueRankOf(S, lid, club) {
  const rk = leagueRanking(S, lid);
  const i = rk.indexOf(club);
  return i >= 0 ? i + 1 : null;
}
export function leagueMembers(S, lid) {
  const out = [];
  for (const id of Object.keys(S.world.clubs)) if (S.world.clubs[id].lg === lid) out.push(id);
  return sortIds(out);
}

export function buildLeagues(S) {
  const lg = {};
  for (const lid of leagueIds()) {
    const f = leagueFormat(lid);
    const ids = leagueMembers(S, lid);
    lg[lid] = { r: 0, R: f.R, t: newTable(ids), sp: null, last: [] };
  }
  return lg;
}

// Fixtures [h, a] of round r of league lid (split rounds only once groups exist).
export function leagueRoundFixtures(S, lid, r) {
  const L = S.comp.lg[lid];
  const f = leagueFormat(lid);
  const ids = L.t.map((x) => x[0]);
  if (r < f.Rb) {
    const rr = baseSchedule(S.season, lid, ids, f.cycles);
    return rr[r] || [];
  }
  if (!L.sp || !f.groups) return [];
  const k = r - f.Rb;
  const out = [];
  f.groups.forEach((g, gi) => {
    const sch = splitSchedule(S.season, lid, gi, sortIds(L.sp[gi]), g.rr || 1);
    if (k < sch.length) for (const p of sch[k]) out.push(p);
  });
  return out;
}

// All league fixtures (any round index) whose slot equals (week, slot): [{ comp, r, h, a }]
export function leagueFixturesInSlot(S, week, slot) {
  const out = [];
  for (const lid of leagueIds()) {
    const L = S.comp.lg[lid];
    if (!L || L.r >= L.R) continue;
    const sl = leagueRoundSlots(L.R)[L.r];
    if (!sl || sl.w !== week || sl.s !== slot) continue;
    for (const [h, a] of leagueRoundFixtures(S, lid, L.r)) out.push({ comp: lid, kind: 'league', h, a, r: L.r });
  }
  return out;
}

// Called after all fixtures of a league round were applied.
export function finishLeagueRound(S, lid, results) {
  const L = S.comp.lg[lid];
  L.last = results;
  L.r++;
  const f = leagueFormat(lid);
  if (f.groups && L.r === f.Rb && !L.sp) {
    const ranked = rankRows(L.t).map((r) => r[0]);
    L.sp = splitGroups(ranked, f.groups);
    if (f.halve) for (const row of L.t) row[7] = Math.ceil(row[7] / 2);
  }
}

export function simLeagueFixture(S, rng, h, a, fixed) {
  if (fixed) return fixed;
  return simScore(rng, cs(S, h), cs(S, a), { neutral: false });
}

// ---------- youth league ----------
export function youthStrength(S, clubId, lvl) {
  const n = rngFor(clubId, S.season, 'yth').int(-3, 3);
  return Math.round(0.5 * cs(S, clubId) + (lvl === 'u17' ? 18 : 23)) + n;
}
export function buildYouthLeague(S, academyClub, lvl) {
  const lid = clubLeague(S, academyClub) || baseLeagueOf(academyClub);
  if (!lid) return null;
  const ids = leagueMembers(S, lid);
  const str = {};
  for (const id of ids) str[id] = youthStrength(S, id, lvl);
  const R = 2 * (ids.length - 1);
  return { id: lid + '_' + lvl, lvl, clubs: ids, str, r: 0, R, t: newTable(ids) };
}
export function youthRoundFixtures(S, r) {
  const Y = S.comp.yl;
  if (!Y) return [];
  const rr = youthSchedule(S.season, Y.id, Y.clubs);
  return rr[r] || [];
}
export function youthFixturesInSlot(S, week, slot) {
  const Y = S.comp.yl;
  if (!Y || Y.r >= Y.R) return [];
  const sl = leagueRoundSlots(Y.R)[Y.r];
  if (!sl || sl.w !== week || sl.s !== slot) return [];
  return youthRoundFixtures(S, Y.r).map(([h, a]) => ({ comp: Y.id, kind: 'youth', h, a, r: Y.r }));
}

// ---------- promotion / relegation, evolution ----------
export function promoteRelegate(S) {
  const moved = { up: [], down: [] };
  for (const lg of LEAGUES) {
    if (lg.tier !== 1 || !lg.relegation) continue;
    const t2 = lg.relegation.to;
    const count = lg.relegation.count;
    const r1 = leagueRanking(S, lg.id);
    const r2 = leagueRanking(S, t2);
    if (r1.length < count || r2.length < count) continue;
    const down = r1.slice(r1.length - count);
    const up = r2.slice(0, count);
    for (const id of down) { S.world.clubs[id].lg = t2; moved.down.push(id); }
    for (const id of up) { S.world.clubs[id].lg = lg.id; moved.up.push(id); }
  }
  return moved;
}

export function evolveClubs(S, rng, moved, uclLp) {
  const ids = sortIds(Object.keys(S.world.clubs));
  const perfOf = {};
  for (const lid of leagueIds()) {
    const rk = leagueRanking(S, lid);
    const N = rk.length;
    const byStr = rk.slice().sort((a, b) => (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1));
    rk.forEach((id, i) => {
      const exp = byStr.indexOf(id) + 1;
      perfOf[id] = clamp((exp - (i + 1)) / N * 6, -3, 3);
    });
  }
  const up = new Set(moved.up), down = new Set(moved.down);
  const inUcl = new Set(uclLp || []);
  for (const id of ids) {
    const c = S.world.clubs[id];
    const d = clubData(id);
    const base = d ? d.strength : c.s;
    const perf = perfOf[id] || 0;
    let s = c.s + 0.25 * (base - c.s) + 0.5 * perf + rng.normal(0, 1.0) + (inUcl.has(id) ? 0.5 : 0);
    if (up.has(id)) s -= 1.0;
    if (down.has(id)) s += 0.5;
    c.s = round1(clamp(s, 35, 92));
    c.b = Math.max(0.5, round1(c.b * (1 + perf * 0.03)));
    c.r = round1(clamp(c.r + perf * 0.5, 1, 100));
  }
}

export { COUNTRIES, COUNTRY_BY_ID, LEAGUES, LEAGUE_BY_ID, CLUB_INDEX, EURO_FILLER_CLUBS, NAME_POOLS };

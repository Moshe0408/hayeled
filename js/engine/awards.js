// Awards, rival benchmarks, fictional stars, Ballon d'Or, Golden Boy (SPEC §5.12).
import { COUNTRIES } from '../data/countries.js';
import { LEAGUES, LEAGUE_BY_ID } from '../data/leagues.js';
import { AWARDS, TROPHIES } from '../data/strings.js';
import { clamp, round1, sortIds, fmtSeason } from './util.js';
import { nextId, emit } from './state.js';
import { cs, clubLeague, clubCountry, genName, poolOfCountry, leagueRanking, leagueIds, leagueMembers, clubName, country, leagueFormat, lgNameHe } from './world.js';
import { ovrOf, ageOf, G, posGroup } from './player.js';
import { addAward, addTrophy, addTimeline, sumLines, ALL_LINES, awardLabel, trophyLabel } from './history.js';
import { raise, sysMsg } from './narrative.js';

const STAR_POS = ['ST', 'ST', 'ST', 'LW', 'RW', 'CAM', 'CAM', 'CM', 'CM', 'CDM', 'CB', 'CB', 'LB', 'RB', 'GK'];
const POS_GF = { ST: 1, LW: 0.7, RW: 0.7, CAM: 0.55, CM: 0.25, CDM: 0.1, CB: 0.1, LB: 0.1, RB: 0.1, GK: 0 };

function eliteClubs(S) {
  const out = [];
  for (const lid of leagueIds()) for (const id of leagueMembers(S, lid)) if (cs(S, id) >= 80) out.push(id);
  return out.length ? out : leagueMembers(S, leagueIds()[0]);
}

function newStar(S, rng, age, ovrLo, ovrHi, potLo, potHi) {
  const nat = rng.weighted(COUNTRIES, (c) => Math.max(0, ((S.player && S.player.gender === 'f' && typeof c.strengthW === 'number') ? c.strengthW : c.strength) - 55) ** 2);
  const pos = rng.pick(STAR_POS);
  const ovr = round1(rng.float(ovrLo, ovrHi));
  const pot = Math.max(Math.ceil(ovr), rng.int(potLo, potHi));
  const nm = genName(rng, poolOfCountry(nat.id));
  return { id: nextId(S, 'star'), first: nm.first, last: nm.last, nation: nat.id, pos, club: rng.pick(eliteClubs(S)), born: S.season - age, ovr, pot, bdo: 0, g: 0 };
}

export function createStars(S, rng) {
  S.stars = [];
  for (let i = 0; i < 40; i++) {
    const age = rng.int(18, 33);
    const s = newStar(S, rng, age, 82, 91, 82, 94);
    s.pot = Math.max(s.pot, Math.ceil(s.ovr));
    S.stars.push(s);
  }
}

export function evolveStars(S, rng) {
  const elite = eliteClubs(S);
  const next = [];
  for (const st of S.stars) {
    const age = S.season + 1 - st.born;
    if (age >= 37 || (age >= 35 && rng.chance(0.5))) {
      next.push(newStar(S, rng, rng.int(19, 21), 78, 83, 88, 94));
      continue;
    }
    const g = G(age) * 0.6;
    if (g > 0) st.ovr = round1(Math.min(st.pot, st.ovr + g * clamp((st.pot - st.ovr) / 6, 0.2, 1.2)));
    else st.ovr = round1(Math.max(60, st.ovr + g));
    if (rng.chance(0.12)) st.club = rng.pick(elite.filter((x) => x !== st.club)) || st.club;
    next.push(st);
  }
  S.stars = next;
}

// Rival benchmarks at season build
export function buildBenchmarks(S, rng) {
  const sc = {};
  for (const lid of leagueIds()) {
    const L = S.comp.lg[lid];
    const top = L.t.map((r) => r[0]).sort((a, b) => (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1)).slice(0, 4);
    const club = rng.pick(top);
    const nm = genName(rng, poolOfCountry(LEAGUE_BY_ID[lid].countryId));
    sc[lid] = { n: nm.full, club, g: Math.max(6, Math.round(L.R * 0.5 + rng.normal(0, 3))) };
  }
  const uclClub = rng.pick(eliteClubs(S));
  const nm = genName(rng, poolOfCountry(clubCountry(uclClub)));
  sc.ucl = { n: nm.full, club: uclClub, g: 9 + rng.int(0, 5) };
  return sc;
}

export function awardHe(k) { return awardLabel(k); }
export function trophyHe(k) { return trophyLabel(k); }

export function giveTrophy(S, k, c, club) {
  if (!addTrophy(S, k, c, club)) return false;
  const p = S.player;
  p.morale = Math.min(100, p.morale + 15);
  const lid = p.club ? clubLeague(S, p.club) : null;
  const pr = lid && LEAGUE_BY_ID[lid] ? LEAGUE_BY_ID[lid].prestige : 5;
  if (k === 'league') { p.rep.l += 5; p.rep.c += 2; p.rep.w += pr / 10; }
  else if (k === 'ucl') { p.rep.c += 8; p.rep.w += 6; }
  else if (k === 'uel') { p.rep.c += 4; p.rep.w += 2; }
  else if (k === 'wc') p.rep.w += 10;
  else if (['euro', 'copa', 'afcon', 'asian', 'gold'].indexOf(k) >= 0) p.rep.w += 6;
  else if (k === 'cup') p.rep.l += 2;
  p.rep.l = Math.min(100, p.rep.l); p.rep.c = Math.min(100, p.rep.c); p.rep.w = Math.min(100, p.rep.w);
  raise(S, 'trophy');
  emit('trophy', { key: k, comp: c });
  addTimeline(S, k, 'זכית: ' + trophyHe(k) + ' (' + fmtSeason(S.season) + ')');
  sysMsg(S, 'system', '🏆 ' + trophyHe(k) + '! איזו עונה!');
  return true;
}
export function giveAward(S, k, c, v) {
  if (!addAward(S, k, c, v)) return false;
  emit('award', { key: k });
  addTimeline(S, 'award', awardHe(k) + (v !== null && v !== undefined && k.indexOf('top_scorer') >= 0 ? ' (' + v + ' שערים)' : ''));
  sysMsg(S, 'system', '🏅 ' + awardHe(k) + '!');
  if (k === 'top_scorer') raise(S, 'top_scorer');
  if (k === 'golden_boy') raise(S, 'golden_boy');
  return true;
}

// End of week 44: league awards for the player's league
export function seasonEndAwards(S, rng) {
  const p = S.player;
  const pa = (S.comp && S.comp.pa) || {};
  if (p.club && p.stage !== 'youth') {
    const lid = clubLeague(S, p.club);
    const lg = LEAGUE_BY_ID[lid];
    if (lg) {
      const rk = leagueRanking(S, lid);
      const rank = rk.indexOf(p.club) + 1;
      const apps = p.s.lg.apps;
      const champion = rank === 1;
      if (apps >= 1 && champion) giveTrophy(S, lg.tier === 1 ? 'league' : 'league2', lid, p.club);
      else if (apps >= 1 && lg.tier === 2 && lg.promotion && rank <= lg.promotion.count) giveTrophy(S, 'league2', lid, p.club);
      if (lg.tier === 2 && lg.promotion && rank <= lg.promotion.count) raise(S, 'promoted');
      if (lg.relegation && rank > rk.length - lg.relegation.count) raise(S, 'relegated');
      const b = S.comp.sc[lid];
      if (b && apps >= 1 && p.s.lg.g >= b.g && p.s.lg.g > 0) giveAward(S, 'top_scorer', lid, p.s.lg.g);
      if (apps >= 20) {
        const ar = p.s.lg.rs / apps;
        const thr = 7.55 - (lg.prestige <= 5 ? 0.15 : 0) + rng.normal(0, 0.1);
        if (ar + p.s.lg.g * 0.02 + (champion ? 0.15 : 0) >= thr) giveAward(S, 'pots', lid, null);
        if (ar >= 7.15) giveAward(S, 'tots', lid, null);
      }
      if (ageOf(S) <= 21 && apps >= 18 && p.s.lg.rs / apps >= 7.0) giveAward(S, 'young_pots', lid, null);
    }
  }
  const u = pa.ucl;
  if (u && S.comp.sc.ucl && u[1] >= S.comp.sc.ucl.g) giveAward(S, 'ucl_top_scorer', 'ucl', u[1]);
  // youth league champion
  const Y = S.comp.yl;
  if (Y && p.s.yth.apps >= 1) {
    const yc = (p.club && Y.clubs.indexOf(p.club) >= 0) ? p.club : null;
    const ranked = Y.t.slice().sort((x, y) => (y[7] - x[7]) || ((y[5] - y[6]) - (x[5] - x[6])) || (y[5] - x[5]) || (x[0] < y[0] ? -1 : 1));
    if (yc && ranked[0] && ranked[0][0] === yc) giveTrophy(S, 'youth_league', Y.id, yc);
  }
}

function trophyPtsFor(S, season) {
  let pts = 0;
  for (const t of S.hist.trophies) {
    if (t.s !== season) continue;
    if (t.k === 'league') { const l = LEAGUE_BY_ID[t.c]; pts += 6 * ((l && l.prestige) || 5) / 10; }
    else if (t.k === 'ucl') pts += 14;
    else if (t.k === 'uel') pts += 5;
    else if (t.k === 'uecl') pts += 2;
    else if (t.k === 'cup') pts += 2;
    else if (t.k === 'wc') pts += 16;
    else if (t.k === 'euro' || t.k === 'copa') pts += 12;
    else if (t.k === 'afcon' || t.k === 'asian' || t.k === 'gold') pts += 8;
  }
  for (const a of S.hist.awards) if (a.s === season && a.k === 'ucl_top_scorer') pts += 3;
  return pts;
}

function scoreLine(ovr, avgR, goals, assists, csn, pos, trophyPts, prestige) {
  const grp = posGroup(pos);
  // goalkeepers rarely win the Ballon d'Or
  const k = grp === 'GK' ? 0.8 : 1;
  return k * ((ovr - 70) * 1.4 + (avgR - 6.8) * 18 + goals * (grp === 'ATT' ? 0.45 : 0.7) + assists * 0.3 + csn * (grp === 'GK' || grp === 'DEF' ? 0.35 : 0) + trophyPts + prestige * 0.6);
}

function starLine(S, rng, st) {
  const lid = clubLeague(S, st.club);
  const lg = LEAGUE_BY_ID[lid];
  const pr = lg ? lg.prestige : 6;
  const avgR = 7.0 + (st.ovr - 84) * 0.08 + rng.normal(0, 0.2);
  const goals = Math.round(Math.max(0, rng.normal(st.ovr - 60, 6)) * (POS_GF[st.pos] || 0.2));
  const assists = Math.round(Math.max(0, rng.normal((st.ovr - 70) * 0.5, 3)) * (st.pos === 'GK' ? 0 : 1));
  let tp = 0;
  const ch = S.world.champs[S.season] || {};
  if (lid && ch[lid] === st.club) tp += 6 * pr / 10;
  if (ch.ucl === st.club) tp += 14;
  else if (ch.uel === st.club) tp += 5;
  const csn = (st.pos === 'GK' || posGroup(st.pos) === 'DEF') ? Math.round(rng.float(8, 18)) : 0;
  return { S: scoreLine(st.ovr, avgR, goals, assists, csn, st.pos, tp, pr), goals };
}

export function playerSeasonLine(S) {
  const p = S.player;
  const l = sumLines(p.s, ['lg', 'cup', 'eu', 'nt']);
  return l;
}

// End of week 52: Ballon d'Or and Golden Boy for season S.season
export function ballonDor(S, rng) {
  const p = S.player;
  const l = playerSeasonLine(S);
  const ovr = ovrOf(p);
  const lid = p.club ? clubLeague(S, p.club) : (S.comp && S.comp.end && S.comp.end.lg);
  const pr = lid && LEAGUE_BY_ID[lid] ? LEAGUE_BY_ID[lid].prestige : 4;
  const tp = trophyPtsFor(S, S.season);
  const avgR = l.apps ? l.rs / l.apps : 6.0;
  const eligible = l.apps >= 15 && p.stage !== 'retired';
  const nominees = [];
  for (const st of S.stars) {
    const sl = starLine(S, rng, st);
    st.g = sl.goals;
    nominees.push({ n: st.first + ' ' + st.last, club: st.club, nation: st.nation, S: sl.S, star: st });
  }
  if (eligible) nominees.push({ n: p.first + ' ' + p.last, club: p.club, nation: p.nation, S: scoreLine(ovr, avgR, l.g, l.a, l.cs, p.pos, tp, pr), me: true });
  nominees.sort((a, b) => (b.S - a.S) || (a.n < b.n ? -1 : 1));
  const top30 = nominees.slice(0, 30);
  const myIdx = top30.findIndex((x) => x.me);
  const rank = myIdx >= 0 ? myIdx + 1 : 0;
  if (top30[0] && top30[0].star) top30[0].star.bdo++;
  // Golden Boy
  let gb = 0;
  const age = ageOf(S);
  if (age <= 21 && l.apps >= 10) {
    const cands = [{ S: scoreLine(ovr, avgR, l.g, l.a, l.cs, p.pos, tp, pr), me: true }];
    for (let i = 0; i < 10; i++) {
      const ro = rng.float(74, 84);
      const pos = rng.pick(STAR_POS);
      const ar = 6.9 + (ro - 84) * 0.06 + rng.normal(0, 0.25);
      const g = Math.round(Math.max(0, rng.normal(ro - 62, 6)) * (POS_GF[pos] || 0.2));
      cands.push({ S: scoreLine(ro, ar, g, Math.round(g * 0.5), 0, pos, rng.float(0, 6), rng.float(5, 10)) });
    }
    cands.sort((a, b) => b.S - a.S);
    gb = cands.findIndex((x) => x.me) + 1;
  }
  S.hist.bdo.push({ s: S.season, rank, top: top30.slice(0, 3).map((x) => ({ n: x.n, club: x.club || null, nation: x.nation })), gb });
  raise(S, 'ballon_dor_night');
  if (rank === 1) { giveAward(S, 'ballon_dor', null, null); p.rep.w = Math.min(100, p.rep.w + 8); }
  else if (rank >= 1 && rank <= 3) { giveAward(S, 'bdo_top3', null, rank); p.rep.w = Math.min(100, p.rep.w + 8); }
  else if (rank >= 1 && rank <= 10) giveAward(S, 'bdo_top10', null, rank);
  if (rank > 0) sysMsg(S, 'system', 'טקס ' + awardHe('ballon_dor') + ': סיימת במקום ' + rank + '!');
  if (gb === 1) giveAward(S, 'golden_boy', null, null);
  return { rank, gb };
}

export function awardsVM(S, benchmarksFn) {
  const mine = S.hist.awards.slice().reverse().map((a) => ({
    seasonHe: fmtSeason(a.s), key: a.k, he: awardHe(a.k),
    detailHe: a.k === 'top_scorer' || a.k === 'ucl_top_scorer' || a.k === 'golden_boot_tour' ? (a.v + ' שערים') : (a.k.indexOf('bdo') === 0 && a.v ? 'מקום ' + a.v : (a.c && LEAGUE_BY_ID[a.c] ? lgNameHe(a.c) : '')),
  }));
  const ballonDor = S.hist.bdo.slice().reverse().map((b) => ({
    seasonHe: fmtSeason(b.s), rank: b.rank, rankHe: b.rank ? 'מקום ' + b.rank : 'לא {{היית מועמד|היית מועמדת}}',
    top3: b.top.map((t) => ({ name: t.n, nation: t.nation || null, clubHe: t.club ? clubName(t.club) : '', flag: (country(t.nation) && country(t.nation).flag) || '' })),
  }));
  return { mine, ballonDor, seasonBenchmarks: benchmarksFn() };
}
export { leagueFormat };

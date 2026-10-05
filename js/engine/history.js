// History: match records, spells, season archive, timeline, trophies/awards, legacy, HoF entry, career VM.
import { TROPHIES, AWARDS, LEGACY_TIERS, POSITIONS } from '../data/strings.js';
import { LEAGUE_BY_ID } from '../data/leagues.js';
import { nextId, curAw, emptyStats, emptyLine } from './state.js';
import { clubData, clubLeague, teamVM, clubName, country, leagueRankOf, clubPrestige, lgNameHe } from './world.js';
import { fmtSeason, round1, gtext, curGender } from './util.js';
import { ageOf, ovrOf } from './player.js';

export const CLUB_LINES = ['lg', 'cup', 'eu', 'yth'];
export const ALL_LINES = ['lg', 'cup', 'eu', 'nt', 'yth', 'ynt'];

export function addTimeline(S, icon, text) {
  S.hist.timeline.push({ id: nextId(S, 'timeline'), aw: curAw(S), icon: icon || 'info', t: gtext(text) });
}

// ---------- trophy / award labels (women's football names when gender 'f', C3) ----------
const W_AWARDS = {
  top_scorer: 'מלכת השערים', pots: 'שחקנית העונה', tots: 'נבחרת העונה', young_pots: 'השחקנית הצעירה של העונה',
  ucl_top_scorer: 'מלכת שערי ליגת האלופות לנשים', golden_boy: 'פרס הכישרון הצעיר', ballon_dor: 'כדור הזהב לנשים',
  bdo_top3: 'פודיום כדור הזהב לנשים', bdo_top10: 'טופ 10 בכדור הזהב לנשים', golden_boot_tour: 'מלכת שערי הטורניר', motm_final: 'שחקנית הגמר',
  coach_season: 'מאמנת העונה', coach_year: 'מאמנת השנה',
};
const W_TROPHIES = {
  league: 'אליפות', league2: 'עלייה ליגה', cup: 'גביע', ucl: 'ליגת האלופות לנשים', uel: 'הליגה האירופית לנשים', uecl: 'הקונפרנס ליג לנשים',
  wc: 'גביע העולם לנשים', euro: 'אליפות אירופה לנשים', copa: 'קופה אמריקה לנשים', afcon: 'אליפות אפריקה לנשים', asian: 'גביע אסיה לנשים',
  gold: 'גביע הזהב לנשים', u17: 'אליפות עד 17 לנערות', u19: 'אליפות עד 19 לנערות', u21: 'אליפות עד 21', youth_league: 'אליפות נערות',
};
export function awardLabel(k) { if (curGender() === 'f' && W_AWARDS[k]) return W_AWARDS[k]; return gtext((AWARDS && AWARDS[k]) || k); }
export function trophyLabel(k) { if (curGender() === 'f' && W_TROPHIES[k]) return W_TROPHIES[k]; return gtext((TROPHIES && TROPHIES[k]) || k); }

export function openSpell(S, club, loan, fee, from) {
  S.hist.clubs.push({ club, from: from !== undefined ? from : S.season, to: null, loan: !!loan, fee: fee || 0, apps: 0, g: 0, a: 0 });
}
export function closeSpell(S, to) {
  const sp = S.hist.clubs[S.hist.clubs.length - 1];
  if (sp && sp.to === null) sp.to = to !== undefined ? to : S.season;
}
export function openSpellOf(S) {
  const sp = S.hist.clubs[S.hist.clubs.length - 1];
  return sp && sp.to === null ? sp : null;
}
export function creditSpell(S, club, g, a) {
  const sp = openSpellOf(S);
  if (sp && sp.club === club) { sp.apps++; sp.g += g; sp.a += a; return true; }
  // a match for a club other than the open spell (should not happen); open one so totals stay exact
  if (sp) sp.to = S.season;
  openSpell(S, club, false, 0);
  const n = openSpellOf(S);
  n.apps++; n.g += g; n.a += a;
  return false;
}

export function recordMatch(S, m) { S.hist.matches.push(m); }
export function pruneMatches(S, keepFromSeason) {
  const min = keepFromSeason * 52 + 1;
  S.hist.matches = S.hist.matches.filter((m) => m.aw >= min);
}

export function addTrophy(S, k, c, club) {
  if (S.hist.trophies.some((t) => t.s === S.season && t.k === k && t.c === c)) return false;
  S.hist.trophies.push({ s: S.season, k, c, club });
  return true;
}
export function addAward(S, k, c, v) {
  if (S.hist.awards.some((t) => t.s === S.season && t.k === k && t.c === (c || null))) return false;
  S.hist.awards.push({ s: S.season, k, c: c || null, v: v === undefined ? null : v });
  return true;
}

export function lineAvg(l) { return l.apps ? round1(l.rs / l.apps) : 0; }
export function sumLines(st, keys) {
  const o = emptyLine();
  for (const k of keys) { const l = st[k]; if (!l) continue; for (const f of Object.keys(o)) o[f] += l[f] || 0; }
  o.rs = round1(o.rs);
  return o;
}

export function archiveSeason(S, endInfo) {
  const p = S.player;
  const e = endInfo || (S.comp && S.comp.end) || {};
  S.hist.seasons.push({
    s: S.season, age: ageOf(S), club: e.club !== undefined ? e.club : p.club, lg: e.lg !== undefined ? e.lg : (p.club ? clubLeague(S, p.club) : null),
    rank: e.rank !== undefined ? e.rank : null, ovr: ovrOf(p), stats: JSON.parse(JSON.stringify(p.s)), loan: !!(e.loan !== undefined ? e.loan : (p.contract && p.contract.loan)),
    moved: !!(S.comp && S.comp.moved),
  });
}

// ----- totals -----
export function careerTotals(S) {
  const t = { apps: 0, goals: 0, assists: 0, rs: 0, motm: 0, caps: 0, intlGoals: 0, clubApps: 0 };
  const add = (st) => {
    for (const k of ALL_LINES) { const l = st[k]; t.apps += l.apps; t.goals += l.g; t.assists += l.a; t.rs += l.rs; t.motm += l.motm; }
    for (const k of CLUB_LINES) t.clubApps += st[k].apps;
  };
  const archived = new Set(S.hist.seasons.map((x) => x.s));
  for (const s of S.hist.seasons) add(s.stats);
  if (!archived.has(S.season)) add(S.player.s);
  t.caps = S.player.caps.senior;
  t.intlGoals = S.player.ig.senior;
  return { apps: t.apps, goals: t.goals, assists: t.assists, avgRating: t.apps ? round1(t.rs / t.apps) : 0, motm: t.motm, caps: t.caps, intlGoals: t.intlGoals, clubApps: t.clubApps };
}

const TROPHY_PTS = { league: 12, league2: 4, cup: 5, ucl: 30, uel: 14, uecl: 7, wc: 45, euro: 30, copa: 30, afcon: 18, asian: 18, gold: 18, u17: 4, u19: 4, u21: 4, youth_league: 2 };
const AWARD_PTS = { ballon_dor: 60, bdo_top3: 18, bdo_top10: 6, golden_boy: 12, top_scorer: 6, pots: 8, tots: 3, young_pots: 3, ucl_top_scorer: 8, golden_boot_tour: 6, motm_final: 4 };
export function legacyScore(S) {
  const t = careerTotals(S);
  const p = S.player;
  let L = t.apps * 0.05 + t.goals * 0.15 + t.assists * 0.08 + p.caps.senior * 0.35 + p.ig.senior * 0.5 + Math.max(0, p.peak - 70) * 2.5 + p.rep.w * 0.4;
  for (const tr of S.hist.trophies) {
    let v = TROPHY_PTS[tr.k] || 0;
    if (tr.k === 'league') { const l = LEAGUE_BY_ID[tr.c]; if (l && l.prestige >= 8) v = 18; }
    L += v;
  }
  for (const a of S.hist.awards) L += AWARD_PTS[a.k] || 0;
  return round1(L);
}
export function legacyTierHe(legacy) {
  const r = Math.round(legacy);
  let he = '';
  for (const t of (LEGACY_TIERS || [])) if (t.min <= r) he = t.he;
  return gtext(he || '{{שחקן ליגה|שחקנית ליגה}}');
}

function groupCount(list, labelFn) {
  const m = {};
  const order = [];
  for (const x of list) {
    if (!m[x.k]) { m[x.k] = { key: x.k, he: labelFn(x.k), count: 0, seasons: [] }; order.push(x.k); }
    m[x.k].count++;
    m[x.k].seasons.push(fmtSeason(x.s));
  }
  return order.map((k) => ({ key: k, he: m[k].he, count: m[k].count, seasonsHe: m[k].seasons.join(', ') }));
}
export function trophiesVM(S) { return groupCount(S.hist.trophies, trophyLabel); }
export function awardsListVM(S) { return groupCount(S.hist.awards, awardLabel); }

export function careerVM(S, awLabel) {
  const seasons = S.hist.seasons.map((x) => {
    const tot = sumLines(x.stats, ALL_LINES);
    return {
      season: x.s, seasonHe: fmtSeason(x.s), age: x.age, clubHe: x.club ? clubName(x.club) : 'ללא קבוצה',
      leagueHe: x.lg && LEAGUE_BY_ID[x.lg] ? lgNameHe(x.lg) : '', rank: x.rank, apps: tot.apps, goals: tot.g, assists: tot.a,
      avgRating: tot.apps ? round1(tot.rs / tot.apps) : 0, ovr: x.ovr, loan: !!x.loan,
    };
  });
  const t = careerTotals(S);
  const clubs = S.hist.clubs.map((c) => ({
    club: teamVM(c.club), fromHe: fmtSeason(c.from), toHe: c.to === null ? 'היום' : fmtSeason(c.to), apps: c.apps, goals: c.g, loan: !!c.loan,
  }));
  const tl = S.hist.timeline.slice().reverse().map((e) => ({ id: e.id, dateHe: awLabel(e.aw), icon: e.icon, textHe: gtext(e.t) }));
  return {
    timeline: tl, seasons,
    totals: { apps: t.apps, goals: t.goals, assists: t.assists, avgRating: t.avgRating, motm: t.motm, caps: t.caps, intlGoals: t.intlGoals,
      // v2.3 review: youth national teams (U17 / U19 / U21) counted on their own row
      youthCaps: S.player.caps.u17 + S.player.caps.u19 + S.player.caps.u21, youthGoals: S.player.ig.u17 + S.player.ig.u19 + S.player.ig.u21 },
    trophies: trophiesVM(S), awards: awardsListVM(S), clubs,
  };
}

export function hofEntry(S, now) {
  if (!S.retired) return null;
  const p = S.player;
  const t = careerTotals(S);
  const trophies = {}, awards = {};
  for (const x of S.hist.trophies) trophies[x.k] = (trophies[x.k] || 0) + 1;
  for (const x of S.hist.awards) awards[x.k] = (awards[x.k] || 0) + 1;
  const seen = new Set();
  const clubs = [];
  for (const c of S.hist.clubs) { if (seen.has(c.club)) continue; seen.add(c.club); clubs.push({ id: c.club, he: clubName(c.club) }); }
  const nat = country(p.nation);
  const legacy = Number.isFinite(S.retired.legacy) ? S.retired.legacy : legacyScore(S);
  return {
    v: 1, careerId: S.id, name: p.first + ' ' + p.last, nick: p.nick || '', nation: p.nation, flag: nat ? nat.flag : '',
    pos: p.pos, posHe: gtext((POSITIONS && POSITIONS[p.pos] && ((p.gender === 'f' && POSITIONS[p.pos].heF) || POSITIONS[p.pos].he)) || p.pos), born: p.born, gender: p.gender === 'f' ? 'f' : 'm', num: typeof p.num === 'number' ? p.num : null, look: p.look || null,
    startSeason: S.startSeason, endSeason: S.retired.season, seasons: S.retired.season - S.startSeason + 1, age: S.retired.age,
    clubs, apps: t.apps, goals: t.goals, assists: t.assists, caps: t.caps, intlGoals: t.intlGoals, peakOvr: p.peak,
    trophies, awards, legacy, tierHe: legacyTierHe(legacy), reason: S.retired.reason, createdAt: now,
  };
}
export { emptyStats };

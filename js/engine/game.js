// Facade (SPEC §6). The UI talks to the engine only through this module.
import { createRng, rngFor, randomSeed, hash32 } from '../core/rng.js';
import { COUNTRIES, COUNTRY_BY_ID } from '../data/countries.js';
import { LEAGUES, LEAGUE_BY_ID, CLUB_INDEX } from '../data/leagues.js';
import { NICKNAMES, FRIEND_NAMES, AGENT_NAMES, JOURNALIST_NAMES, NICKNAMES_F, FRIEND_NAMES_F } from '../data/names.js';
import { POSITIONS, ATTRS, TRAINING, ROLES, STAGES, SELECTION, EURO_COMPS, ROUND_NAMES, TOURNAMENTS, ALERTS, FORMAT_LABELS, RESULT_LABELS } from '../data/strings.js';
import { clamp, round1, avg, fmtMoney as _fmtMoney, fmtSeason as _fmtSeason, sortIds, deepClone, hePrefix, gtext, gdeep, femLabel, econOf, curGender, isF } from './util.js';
import { C, SCHEMA_VERSION as SV, emit, curAw, createEmptyState, migrateState as _migrate, emptyStats, STATE_KEYS, WOMEN_ECON, defaultShirt } from './state.js';
import { EUR_ILS as _EUR_ILS, fmtShekels as _fmtShekels, sgnHe } from './util.js';
import { weekLabelHe, isWindowOpen, isIntlWeek, intlSlotIndex, leagueRoundSlots, cupRoundSlots, tournamentSlots, EURO_WEEKS, summerTournaments, INTL_WEEKS } from './calendar.js';
import { simScore, simKnockout, koWinner } from './sim.js';
import {
  initWorld, teamVM, cs, clubData, clubLeague, clubCountry, clubName, country, league, leagueIds, leagueFormat, leagueRanking, leagueRankOf,
  buildLeagues, leagueRoundFixtures, leagueFixturesInSlot, finishLeagueRound, tableApply, rankRows, buildYouthLeague, youthFixturesInSlot,
  youthRoundFixtures, promoteRelegate, evolveClubs, genName, poolOfCountry, nameFor, clubPrestige, leagueMembers, isFiller, lgNameHe,
} from './world.js';
import { buildCups, cupFixturesInSlot, cupApply, cupsAfterSlot, cupIds, cupDef, roundKey as cupRoundKey, cupTieWinner } from './cups.js';
import { EC, buildEurope, firstSeasonEntrants, computeNextEntrants, euroFixturesInSlot, euroApply, euroAfterSlot, lpRanking, twoLegWinner } from './europe.js';
import {
  initNational, buildNationalSeason, buildSummerTournament, buildYouthTournament, natFixturesInSlot, natApply, natAfterSlot, yntFixture,
  nstr, youthNStr, nationInTour, nationAlive, driftNational, qualifierQualified, tourStr, intlSlotOf,
} from './national.js';
import { createPlayer, ovrOf, ageOf, formAvg, formAvgOr, potStars, updatePotSeen, developWeek, potentialDrift, valueOf, fairWage, injuryChanceMatch, rollInjury, injuryHe, clampStatus, POS_W, OUT_ATTRS, GK_ATTRS, posGroup } from './player.js';
import { clubSelection, youthSelection, nationalSelection, seniorScore, youthThreshold } from './selection.js';
import { createLive, startLive, chooseLive, autoPlayLive, endLive, matchVM, computeRating, momentStats, resOf, compHe, roundHe, fxKey, teamVariant, lineOf, extraHe, sideStrength, cleanSheetEligible, tourHe, tourKindHe, euroHe, logVM, compNameHe as _compNameHe } from './match.js';
import { generateOffers, renewalCheck, makeProOffer, proEligible, respond, expireOffers, requestTransfer as reqT, cancelTransferRequest as cancelT, offerVM, contractVM, endLoan, contractExpiry, releaseYouth, applyPrecontract, effSeason, teamStrOf, setAbroadFlag } from './transfers.js';
import { createStars, evolveStars, buildBenchmarks, seasonEndAwards, ballonDor, giveTrophy, giveAward, awardsVM, awardHe, trophyHe } from './awards.js';
import { raise, sysMsg, runWeekEvents, autoAnswerExpired, answerItem, inboxRows, threadVM, awLabel, coachName } from './narrative.js';
import { addTimeline, openSpell, closeSpell, creditSpell, recordMatch, pruneMatches, archiveSeason, careerTotals, legacyScore, legacyTierHe, careerVM, hofEntry, trophiesVM, awardsListVM, sumLines, ALL_LINES, CLUB_LINES, lineAvg } from './history.js';
import { buy, sell, shopVM, moraleBonus, weeklyUpkeep } from './shop.js';
import * as MG from './manager.js';

export const SCHEMA_VERSION = SV;
/** R3: engine money is in euros; every label is in shekels (fixed rate EUR_ILS). */
export function fmtMoney(n) { return _fmtMoney(n); }
export const EUR_ILS = _EUR_ILS;
export function fmtShekels(ils) { return _fmtShekels(ils); }
export function fmtSeason(s) { return _fmtSeason(s); }
// Every Hebrew string the facade returns has its {{male|female}} markers resolved (C2).
function G(v, g) { return gdeep(v, g); }
/** Gender of the loaded career ('m' if none). */
export function getGender() { return curGender(); }
/** C3: display name of a competition id for the loaded career (women's names when gender 'f'). */
export function compNameHe(id) { return C.S ? _compNameHe(id, C.S) : _compNameHe(id, null); }
export function gtextHe(str) { return gtext(str); }

const subs = [];
function need() { if (!C.S) throw new Error('no_career'); return C.S; }
function notify() { for (const f of subs.slice()) { try { f(); } catch (e) { /* subscriber errors never break the engine */ } } }
function R() { return C.rng; }

export function subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
export function getAndClearSignals() { const s = C.sig; C.sig = []; return s; }
export function hasCareer() { return !!C.S; }
export function closeCareer() { C.S = null; C.rng = null; }
export function migrateState(data, fromVersion) { return _migrate(data, fromVersion); }

// ---------------------------------------------------------------- create
const POS_ORDER = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
export function getCreateOptions(opts = {}) {
  const seed = (opts && typeof opts.seed === 'number') ? (opts.seed >>> 0) : 0;
  const gnd = opts && opts.gender === 'f' ? 'f' : 'm';
  const pick = COUNTRIES.filter((c) => c.pickable);
  const isr = pick.filter((c) => c.id === 'isr');
  const rest = pick.filter((c) => c.id !== 'isr').sort((a, b) => String(a.nameHe).localeCompare(String(b.nameHe), 'he'));
  const nations = isr.concat(rest).map((c) => ({ id: c.id, nameHe: c.nameHe, flag: c.flag, confed: c.confed, hasLeague: !!(c.leagues && c.leagues.length) }));
  const positions = POS_ORDER.map((id) => { const p = (POSITIONS && POSITIONS[id]) || {}; return { id, he: femLabel(p.he || id, gnd), short: femLabel(p.short || id, gnd), group: p.group || posGroup(id), desc: gtext(p.desc || '', gnd) }; });
  const nk = rngFor(seed, 'nicks').shuffle(((gnd === 'f' ? NICKNAMES_F : NICKNAMES) || []).slice()).slice(0, 6);
  return G({ nations, positions, feet: [{ id: 'R', he: 'ימין' }, { id: 'L', he: 'שמאל' }], nicknames: nk,
    genders: [{ id: 'm', he: 'בן', heLong: 'שחקן' }, { id: 'f', he: 'בת', heLong: 'שחקנית' }], gender: gnd }, gnd);
}

function academyStars(s) { return clamp(Math.round((s - 40) / 11), 1, 5); }
export function getAcademyOptions(nationId, opts = {}) {
  const gnd = opts && (opts.gender === 'f' || opts.gender === 'm') ? opts.gender : curGender();
  const own = LEAGUES.filter((l) => l.countryId === nationId);
  const hasLeague = own.length > 0;
  const lgs = hasLeague ? own : LEAGUES;
  return {
    nationHasLeague: hasLeague,
    groups: lgs.map((l) => {
      const cc = COUNTRY_BY_ID[l.countryId];
      return {
        leagueId: l.id, leagueHe: gnd === 'f' ? (l.nameHeW || l.nameHe + ' לנשים') : l.nameHe, countryHe: cc ? cc.nameHe : '', flag: cc ? cc.flag : '', tier: l.tier,
        clubs: l.clubs.map((cl) => ({ id: cl.id, nameHe: cl.nameHe, shortHe: cl.shortHe, city: cl.city, colors: cl.colors.slice(0, 2), strength: cl.strength, academyStars: academyStars(cl.strength) })),
      };
    }),
  };
}

function b36(n) { return (Math.abs(Math.floor(n)) >>> 0).toString(36); }

export function newCareer(opts = {}) {
  const first = String(opts.first || '').trim(), last = String(opts.last || '').trim(), nick = String(opts.nick || '').trim();
  if (first.length < 1 || first.length > 20 || last.length < 1 || last.length > 20) return { ok: false, error: 'invalid_name', messageHe: 'השם חייב להכיל בין 1 ל-20 תווים' };
  if (nick.length > 16) return { ok: false, error: 'invalid_nick', messageHe: 'הכינוי ארוך מדי (עד 16 תווים)' };
  if (!COUNTRY_BY_ID[opts.nation]) return { ok: false, error: 'invalid_nation', messageHe: 'בחר מדינה' };
  if (POS_ORDER.indexOf(opts.pos) < 0) return { ok: false, error: 'invalid_pos', messageHe: 'בחר עמדה' };
  const ac = getAcademyOptions(opts.nation, { gender: opts.gender === 'f' ? 'f' : 'm' });
  const okClub = ac.groups.some((g) => g.clubs.some((c) => c.id === opts.club));
  if (!okClub) return { ok: false, error: 'invalid_club', messageHe: 'בחר אקדמיה' };
  const seed = typeof opts.seed === 'number' ? (opts.seed >>> 0) : randomSeed();
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const startSeason = typeof opts.startSeason === 'number' ? opts.startSeason : 2026;
  const gender = opts.gender === 'f' ? 'f' : 'm';
  const look = sanitizeLook(opts.look);
  const num = Number.isInteger(opts.num) && opts.num >= 1 && opts.num <= 99 ? opts.num : defaultShirt(opts.pos);
  const S = createEmptyState();
  S.econ = gender === 'f' ? WOMEN_ECON : 1;
  S.id = 'c_' + b36(now) + '_' + b36(seed);
  S.createdAt = now; S.seed = seed; S.startSeason = startSeason; S.season = startSeason; S.week = 1;
  C.S = S; C.rng = createRng(seed); C.sig = [];
  const rng = C.rng;
  initWorld(S);
  initNational(S, gender);
  S.player = createPlayer(rng, { first, last, nick, nation: opts.nation, pos: opts.pos, foot: opts.foot, club: opts.club, gender, look, num }, startSeason, S.econ);
  const p = S.player;
  p.contract = { club: opts.club, wage: Math.round((150 + 5 * cs(S, opts.club)) * S.econ), until: p.born + 18, role: 'prospect', rc: 0, since: startSeason, loan: false };
  const nr = rngFor(seed, 'names');
  S.names.agent = nr.pick(AGENT_NAMES || []) || 'שוקי לוי';
  S.names.journalist = nr.pick(JOURNALIST_NAMES || []) || 'רפי';
  const fr = nr.shuffle(((gender === 'f' ? FRIEND_NAMES_F : FRIEND_NAMES) || ['שמוליק', 'מוטי', 'דודו']).slice());
  S.names.friends = [fr[0] || 'שמוליק', fr[1] || 'מוטי', fr[2] || 'דודו'];
  createStars(S, rng);
  buildSeason(S, true);
  openSpell(S, opts.club, false, 0, startSeason);
  updatePotSeen(S);
  setAbroadFlag(S);
  addTimeline(S, 'start', 'הצטרפת לאקדמיה של ' + clubName(opts.club) + '. הכול מתחיל כאן.');
  sysMsg(S, 'system', '{{ברוך הבא|ברוכה הבאה}} ל"הילד מהשכונה"! ' + first + ', הקריירה שלך מתחילה באקדמיה של ' + clubName(opts.club) + '.');
  sysMsg(S, 'mom', 'אמא כאן. הכנתי לך שניצלים לאימון הראשון. אל {{תשכח|תשכחי}} לשתות מים! ❤️');
  emit('career_started', { nation: p.nation, position: p.pos, club: opts.club, league: clubLeague(S, opts.club), gender });
  notify();
  return G({ ok: true, report: scoutReport(S) });
}

// C7: optional look chosen in the wizard ({ skin, hair }: small integers or short id strings)
function sanitizeLook(l) {
  if (!l || typeof l !== 'object') return null;
  const ok = (v) => (Number.isInteger(v) && v >= 0 && v <= 99) || (typeof v === 'string' && /^[a-zA-Z0-9_#-]{1,16}$/.test(v));
  const out = {};
  for (const k of ['skin', 'hair', 'hairColor', 'style']) if (ok(l[k])) out[k] = l[k];
  return Object.keys(out).length ? out : null;
}
function posHeOf(p) { return femLabel((POSITIONS && POSITIONS[p.pos] && POSITIONS[p.pos].he) || p.pos); }

function scoutReport(S) {
  const p = S.player;
  const nat = country(p.nation);
  const ovr = ovrOf(p);
  const st = potStars(p.potSeen);
  const best = attrsVM(S).slice(0, 2).map((a) => a.he).join(' ו');
  const txt = [
    'גיל ' + ageOf(S) + ', ' + posHeOf(p) + ' עם רגל ' + (p.foot === 'L' ? 'שמאל' : 'ימין') + ' טובה.',
    'הנקודות החזקות: ' + best + '.',
    st >= 4 ? 'הסקאוטים מדברים על כישרון נדיר. אם {{יעבוד|תעבוד}} קשה, השמיים הם הגבול.' : st >= 3 ? 'יש פה פוטנציאל אמיתי {{לשחקן מקצוען טוב|לשחקנית מקצוענית טובה}}.' : 'צריך לעבוד קשה, אבל הלב במקום. {{אף אחד לא נולד כוכב|אף אחת לא נולדה כוכבת}}.',
  ].join(' ');
  return {
    name: p.first + ' ' + p.last, nick: p.nick, age: ageOf(S), nationHe: nat ? nat.nameHe : '', flag: nat ? nat.flag : '',
    posHe: posHeOf(p), footHe: p.foot === 'L' ? 'שמאל' : 'ימין', clubHe: p.club ? clubName(p.club) : '',
    ovr, potStars: st, potRange: p.potSeen.slice(), attrs: attrsVM(S), textHe: txt, gender: p.gender === 'f' ? 'f' : 'm', look: p.look ? Object.assign({}, p.look) : null, num: p.num,
  };
}

function attrsVM(S) {
  const p = S.player;
  const w = POS_W[p.pos];
  const keys = (p.pos === 'GK' ? GK_ATTRS.concat(OUT_ATTRS) : OUT_ATTRS.slice()).slice();
  keys.sort((a, b) => ((w[b] || 0) - (w[a] || 0)) || (keys.indexOf(a) - keys.indexOf(b)));
  const start = (S.comp && S.comp.a0) || null;
  return keys.map((k) => ({ key: k, he: (ATTRS && ATTRS[k] && ATTRS[k].he) || k, short: (ATTRS && ATTRS[k] && ATTRS[k].short) || k, value: Math.round(p.a[k]),
    delta: start && typeof start[k] === 'number' ? Math.round(p.a[k]) - Math.round(start[k]) : 0 }));
}

// ---------------------------------------------------------------- season build
function youthLvlFor(age) { return age <= 16 ? 'u17' : 'u19'; }

function buildSeason(S, first) {
  const p = S.player;
  const prevNext = !first && S.comp ? S.comp.next : null;
  S.comp = { lg: buildLeagues(S), yl: null, cups: null, eu: null, next: null, sc: {}, pa: {}, moved: false, end: null, res: [], a0: Object.assign({}, p.a), o0: ovrOf(p), v0: 0 };
  S.comp.cups = buildCups(S);
  S.comp.eu = buildEurope(S, first || !prevNext ? firstSeasonEntrants(S) : prevNext);
  const age = ageOf(S);
  if (p.club && (p.stage === 'youth' || (p.stage === 'pro' && age <= 18))) {
    const lvl = youthLvlFor(age);
    S.comp.yl = buildYouthLeague(S, p.club, lvl);
    if (p.stage === 'youth') p.youth = lvl;
  }
  S.comp.sc = buildBenchmarks(S, R());
  buildNationalSeason(S);
  S.comp.v0 = valueOf(S);
}

// ---------------------------------------------------------------- fixtures of a slot
function collectFixtures(S, week, slot) {
  const out = [];
  for (const f of leagueFixturesInSlot(S, week, slot)) out.push(Object.assign(f, { slot, ko: false, neutral: false }));
  for (const f of youthFixturesInSlot(S, week, slot)) out.push(Object.assign(f, { slot, ko: false, neutral: false }));
  for (const f of cupFixturesInSlot(S, week, slot)) out.push(Object.assign(f, { slot }));
  for (const f of euroFixturesInSlot(S, week, slot)) out.push(Object.assign(f, { slot }));
  for (const f of natFixturesInSlot(S, week, slot)) out.push(Object.assign(f, { slot }));
  return out;
}

function applyResult(S, fx, hg, ag, extra) {
  if (fx.kind === 'league') tableApply(S.comp.lg[fx.comp].t, fx.h, fx.a, hg, ag);
  else if (fx.kind === 'youth') tableApply(S.comp.yl.t, fx.h, fx.a, hg, ag);
  else if (fx.kind === 'cup') cupApply(S, fx, hg, ag, extra);
  else if (fx.kind === 'europe') euroApply(S, fx, hg, ag, extra);
  else natApply(S, fx, hg, ag, extra);
}

function simFixture(S, rng, fx) {
  const sh = sideStrength(S, fx, fx.h), sa = sideStrength(S, fx, fx.a);
  if (fx.ko) return simKnockout(rng, sh, sa, { neutral: fx.neutral, agg: fx.tie && fx.tie.agg ? fx.tie.agg : null });
  const [h, a] = simScore(rng, sh, sa, { neutral: fx.neutral });
  return [h, a, null];
}

function isPlayerNatFx(S, fx) {
  const n = S.player.nation;
  if (fx.h !== n && fx.a !== n) return false;
  const c = S.nt.called || {};
  if (fx.kind === 'national' || fx.kind === 'friendly') return !!c.senior;
  if (fx.kind === 'ynt') return !!(fx.lvl && c[fx.lvl]);
  return false;
}
function inYouthSetup(S) {
  const p = S.player;
  return !!S.comp.yl && !!p.club && S.comp.yl.clubs.indexOf(p.club) >= 0 && (p.stage === 'youth' || (p.stage === 'pro' && ageOf(S) <= 18));
}
function isPlayerTeamFx(S, fx, key) {
  const p = S.player;
  if (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe') {
    if (!p.club || (fx.h !== p.club && fx.a !== p.club)) return false;
    if (p.stage === 'youth') return !!(S.wsum && key && S.wsum.sel[key]);
    return true;
  }
  if (fx.kind === 'youth') return inYouthSetup(S) && (fx.h === p.club || fx.a === p.club);
  return isPlayerNatFx(S, fx);
}

const NOTE = { bench: 'ישבת על הספסל', out: 'לא נכללת בסגל', injured: '{{פצוע|פצועה}}', suspended: '{{מורחק|מורחקת}}', unknown: '' };

function resultRow(S, fx, hg, ag, extra, mine, rating, note) {
  const v = teamVariant(fx);
  return { compHe: compHe(S, fx.comp), home: teamVM(fx.h, v), away: teamVM(fx.a, v), score: [hg, ag], extraHe: extraHe(null, extra), mine: !!mine, rating: rating === undefined ? null : rating, noteHe: note || '' };
}

function recordRes(S, fx, hg, ag, extra, sel, rating) {
  S.comp.res.push({ w: S.week, s: fx.slot, c: fx.comp, k: fx.kind, h: fx.h, a: fx.a, hg, ag, x: extra || null, sel: sel || 'unknown', rt: rating === undefined ? null : rating, rd: roundHe(fx), big: !!fx.big, lvl: fx.lvl || null });
}

// Decide the player's participation in a slot. Returns true if a live match was created.
function decidePlayer(S, slot) {
  const p = S.player;
  const rng = R();
  if (p.stage === 'retired') return false;
  const week = S.week;
  const all = collectFixtures(S, week, slot);
  const W = S.wsum;
  const called = S.nt.called || {};
  // 1. national
  const natLvl = called.senior ? 'senior' : (called.u17 ? 'u17' : called.u19 ? 'u19' : called.u21 ? 'u21' : null);
  if (natLvl) {
    let fx = null;
    if (natLvl === 'senior') fx = all.find((f) => (f.kind === 'national' || f.kind === 'friendly') && (f.h === p.nation || f.a === p.nation));
    else {
      fx = all.find((f) => f.kind === 'ynt' && f.lvl === natLvl && (f.h === p.nation || f.a === p.nation));
      if (!fx && isIntlWeek(week)) { fx = yntFixture(S, natLvl, week, slot); if (fx) fx.slot = slot; }
    }
    if (fx) {
      const str = natLvl === 'senior' ? nstr(S, p.nation) : nstr(S, p.nation);
      const sel = nationalSelection(S, rng, natLvl, str);
      W.sel[fxKey(fx)] = sel.sel;
      fx.lvl = natLvl === 'senior' ? (fx.lvl || null) : natLvl;
      if (sel.plays) {
        S.live = createLive(S, rng, fx, fx.h === p.nation ? 'h' : 'a', sel);
        return true;
      }
      if (fx.ref && fx.ref.t === 'gen') {
        const [hg, ag] = simFixture(S, rng, fx);
        W.results.push(resultRow(S, fx, hg, ag, null, false, null, NOTE[sel.sel] || ''));
        recordRes(S, fx, hg, ag, null, sel.sel, null);
      }
      return false;
    }
  }
  if (!p.club || p.stage === 'free') return false;
  // 2. club first team
  const cfx = all.find((f) => (f.kind === 'league' || f.kind === 'cup' || f.kind === 'europe') && (f.h === p.club || f.a === p.club));
  let youthOk = p.stage === 'youth';
  if (cfx) {
    if (p.stage !== 'youth') W.clubFx = true;
    const s = cs(S, p.club);
    const preQF = cfx.kind === 'cup' && ['qf', 'sf', 'f'].indexOf(cfx.rk) < 0;
    let sel;
    if (p.stage === 'youth') {
      const age = ageOf(S), ovr = ovrOf(p);
      let inSquad = false;
      if (!p.injury && age >= 16 && ovr >= s - 12) inSquad = rng.chance(clamp(0.15 + (ovr - (s - 12)) * 0.06, 0, 0.9));
      if (inSquad) {
        sel = clubSelection(S, rng, { kind: cfx.kind, preQF }, s);
        if (sel.sel === 'out') {
          sel.sel = 'bench';
          if (rng.chance(clamp(0.55 + 0.05 * sel.score, 0.25, 0.9))) { sel.on = rng.int(55, 80); sel.off = 90; sel.plays = true; }
          else sel.plays = false;
        }
        youthOk = false;
        W.clubFx = true;
      } else sel = { sel: p.injury ? 'injured' : 'out', plays: false, youthTeam: true };
    } else {
      sel = clubSelection(S, rng, { kind: cfx.kind, preQF }, s);
      youthOk = sel.sel === 'out' && ageOf(S) <= 18;
    }
    if (!sel.youthTeam) W.sel[fxKey(cfx)] = sel.sel;
    if (sel.sel === 'starter') W.started = true;
    if (sel.plays) {
      S.live = createLive(S, rng, cfx, cfx.h === p.club ? 'h' : 'a', sel);
      return true;
    }
    if (!sel.youthTeam && p.stage === 'pro') p.trust = clamp(p.trust - 1, 0, 100);
  }
  // 3. youth side
  if (youthOk && inYouthSetup(S) && !p.injury) {
    const yfx = all.find((f) => f.kind === 'youth' && (f.h === p.club || f.a === p.club));
    if (yfx) {
      const sel = youthSelection(S, rng, S.comp.yl.str[p.club]);
      W.sel[fxKey(yfx)] = sel.sel;
      if (sel.plays) {
        S.live = createLive(S, rng, yfx, yfx.h === p.club ? 'h' : 'a', sel);
        return true;
      }
    }
  } else if (inYouthSetup(S)) {
    const yfx = all.find((f) => f.kind === 'youth' && (f.h === p.club || f.a === p.club));
    if (yfx && p.injury) W.sel[fxKey(yfx)] = 'injured';
  }
  return false;
}

function updateStreak(S, res) {
  const f = S.ev.flags;
  if (res === 'W') { f._ws = (f._ws || 0) + 1; f._ls = 0; if (f._ws === 5) raise(S, 'win_streak'); }
  else if (res === 'L') { f._ls = (f._ls || 0) + 1; f._ws = 0; if (f._ls === 3) raise(S, 'loss_streak'); }
  else { f._ws = 0; f._ls = 0; }
}

function simulateSlot(S, slot) {
  const rng = R();
  const p = S.player;
  const week = S.week;
  const W = S.wsum;
  const fixtures = collectFixtures(S, week, slot);
  const lgRes = {};
  let ylPlayed = false;
  for (const fx of fixtures) {
    const key = fxKey(fx);
    const fixed = W.fixed[key];
    const [hg, ag, extra] = fixed ? fixed : simFixture(S, rng, fx);
    applyResult(S, fx, hg, ag, extra);
    if (fx.kind === 'league') (lgRes[fx.comp] = lgRes[fx.comp] || []).push([fx.h, fx.a, hg, ag]);
    if (fx.kind === 'youth') ylPlayed = true;
    if (fixed || isPlayerTeamFx(S, fx, key)) {
      if (!fixed) {
        const sel = W.sel[key] || 'out';
        const showRow = fx.kind !== 'youth' || p.stage === 'youth' || W.sel[key];
        if (showRow) W.results.push(resultRow(S, fx, hg, ag, extra, false, null, NOTE[sel] || ''));
        recordRes(S, fx, hg, ag, extra, sel, null);
      } else {
        const pr = W.pr && W.pr.key === key ? W.pr : null;
        recordRes(S, fx, hg, ag, extra, pr ? pr.sel : (W.sel[key] || 'starter'), pr ? pr.rt : null);
      }
      if ((fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe')) {
        const mine = fx.h === p.club ? [hg, ag] : [ag, hg];
        let res = mine[0] > mine[1] ? 'W' : mine[0] < mine[1] ? 'L' : 'D';
        updateStreak(S, res);
      }
    }
  }
  for (const lid of leagueIds()) if (lgRes[lid]) finishLeagueRound(S, lid, lgRes[lid]);
  if (ylPlayed && S.comp.yl) S.comp.yl.r++;
  // cup finals
  for (const d of cupsAfterSlot(S)) {
    S.world.champs[S.season] = S.world.champs[S.season] || {};
    S.world.champs[S.season][d.cup] = d.winner;
    const pa = S.comp.pa[d.cup];
    if (p.club === d.winner && pa && pa[0] >= 1) giveTrophy(S, 'cup', d.cup, d.winner);
  }
  for (const d of euroAfterSlot(S, week, slot)) {
    S.world.champs[S.season] = S.world.champs[S.season] || {};
    S.world.champs[S.season][d.comp] = d.winner;
    const pa = S.comp.pa[d.comp];
    if (p.club === d.winner && pa && pa[0] >= 1) giveTrophy(S, d.comp, d.comp, d.winner);
  }
  for (const e of natAfterSlot(S, week, slot)) {
    if (e.type === 'tour_done') tournamentDone(S, e.T);
  }
  // national tournament elimination of the player's nation while called
  for (const tk of ['tour', 'ytour']) {
    const T = S.nt[tk];
    if (!T) continue;
    const lvl = tk === 'tour' ? 'senior' : T.lvl;
    if (S.nt.called && S.nt.called[lvl] && T.stage[p.nation] && T.stage[p.nation] !== 'w' && !T.outNoted) {
      T.outNoted = true;
      raise(S, 'tournament_out');
    }
  }
}

function tournamentDone(S, T) {
  const p = S.player;
  const senior = !T.lvl || T.lvl === 'senior';
  const pa = S.comp.pa[T.key];
  if (senior) {
    const inT = nationInTour(T, p.nation);
    S.nt.hist.push({ season: S.season, key: T.key, nation: p.nation, stage: inT ? (T.stage[p.nation] || 'group') : 'dnq', winner: T.w });
  }
  if (T.w === p.nation && pa && pa[0] >= 1) {
    giveTrophy(S, T.kind, T.key, p.nation);
    raise(S, 'tournament_won');
  }
  const b = S.comp.sc[T.key];
  if (pa && b && pa[1] >= b.g) giveAward(S, 'golden_boot_tour', T.key, pa[1]);
}

// ---------------------------------------------------------------- week start
const TRAIN_IDS = ['balanced', 'shooting', 'technique', 'defense', 'physical', 'goalkeeping', 'rest'];
function validTraining(S, id) {
  if (TRAIN_IDS.indexOf(id) < 0) return 'balanced';
  if (id === 'goalkeeping' && S.player.pos !== 'GK') return 'balanced';
  return id;
}

function youthLevelByAge(age) { return age <= 16 ? 'u17' : age <= 18 ? 'u19' : age <= 21 ? 'u21' : null; }

function callups(S) {
  const p = S.player;
  const week = S.week;
  const W = S.wsum;
  if (week >= 46 && week <= 48) return; // tournament continuation keeps the squad
  S.nt.called = {};
  if (!(isIntlWeek(week) || week === 45)) return;
  if (p.stage === 'retired' || p.injury) return;
  const age = ageOf(S);
  const str = nstr(S, p.nation);
  let lvl = null;
  const seniorOk = age >= 17 && seniorScore(S) >= str - 3;
  if (week === 45) {
    const T = S.nt.tour;
    if (seniorOk && T && nationInTour(T, p.nation)) lvl = 'senior';
    else if (p.caps.senior < 3) {
      const yl = youthLevelByAge(age);
      const year = S.season + 1;
      if (yl && !(yl === 'u21' && year % 2 === 0) && ovrOf(p) >= youthThreshold(yl, str)) {
        buildYouthTournament(S, yl);
        S.comp.sc[S.nt.ytour.key] = { n: '', club: null, g: 3 + R().int(0, 3) };
        lvl = yl;
      }
    }
  } else {
    if (seniorOk) lvl = 'senior';
    else if (p.caps.senior < 3) {
      const yl = youthLevelByAge(age);
      if (yl && ovrOf(p) >= youthThreshold(yl, str)) lvl = yl;
    }
  }
  if (!lvl) return;
  S.nt.called[lvl] = true;
  const firstAtLevel = !S.ev.flags['_call_' + lvl];
  S.ev.flags['_call_' + lvl] = true;
  if (p.natLvl !== 'senior') p.natLvl = lvl;
  const nat = country(p.nation);
  const lvlHe = natLevelHe(lvl);
  W.callupHe = lvl === 'senior' && isF(S) ? 'זומנת ל' + natTeamHe(S) : hePrefix('זומנת ל', lvlHe) + ' של ' + (nat ? nat.nameHe : '');
  if (firstAtLevel) {
    W.firstCall = true;
    raise(S, lvl === 'senior' ? 'national_callup' : 'youth_callup');
    emit('national_callup', { level: lvl });
    sysMsg(S, 'national_coach', 'שלום ' + p.first + ', אני שמח לבשר לך ש' + (lvl === 'senior' && isF(S) ? 'זומנת ל' + natTeamHe(S) : hePrefix('זומנת ל', lvlHe)) + '. כל המדינה מאחוריך!');
    addTimeline(S, 'callup', hePrefix('זימון ראשון ל', lvlHe));
  }
  if (week === 45 && (lvl === 'senior' ? S.nt.tour : S.nt.ytour)) raise(S, 'tournament_start');
}

function weekFixturesOfClub(S, week) {
  const p = S.player;
  const out = [];
  if (!p.club || !S.comp) return out;
  for (const slot of ['mw', 'wk']) {
    for (const f of collectFixtures(S, week, slot)) {
      if ((f.kind === 'league' || f.kind === 'cup' || f.kind === 'europe') && (f.h === p.club || f.a === p.club)) out.push(f);
    }
  }
  return out;
}

function weekStart(S, training) {
  const p = S.player;
  const rng = R();
  S.inWeek = true; S.wstep = 0;
  if (training !== undefined && training !== null) S.training = validTraining(S, training);
  else S.training = validTraining(S, S.training);
  S.ev.trig = (S.ev.carry || []).slice();
  S.ev.carry = [];
  S.wsum = { ovrBefore: ovrOf(p), results: [], lines: [], injuryHe: null, callupHe: null, msgs: 0, offers: 0, hadMatchday: false,
    dec: [0, 0], fixed: {}, sel: {}, min: 0, started: false, clubFx: false, derby: false, firstCall: false, newInj: 0, m0: S.ctr.m, trainHe: '', seasonEnded: false, retiredNow: false };
  p.energy = clamp(p.energy + 20 + (S.training === 'rest' ? 15 : 0), 0, 100);
  if (p.injury) {
    p.injury.weeks--;
    if (p.injury.weeks <= 0) { p.injury = null; raise(S, 'injury_return'); sysMsg(S, 'doctor', 'חזרת לכשירות מלאה. בהצלחה על הדשא!'); }
  }
  const age = ageOf(S);
  if (S.week === 1) { raise(S, 'season_start'); if (age >= 33) raise(S, 'retire_soon'); if (age === 30) raise(S, 'age_30'); }
  if (S.week === 45) raise(S, 'summer_start');
  if (S.week === 45 || S.week === 22) raise(S, 'window_open');
  if (S.week === 30) raise(S, 'birthday');
  if (S.week === 22 && p.stage === 'pro' && p.contract && !p.contract.loan && p.contract.until === S.season && !p.next) raise(S, 'contract_expiring');
  const cd = p.club ? clubData(p.club) : null;
  const wf = weekFixturesOfClub(S, S.week);
  if (cd && cd.rival && wf.some((f) => f.h === cd.rival || f.a === cd.rival)) { S.wsum.derby = true; raise(S, 'derby_week'); }
  if (p.stage === 'pro' && wf.some((f) => (f.kind === 'cup' && (f.rk === 'sf' || f.rk === 'f')) || (f.kind === 'europe' && f.rk !== 'lp' && f.rk !== 'q'))) raise(S, 'big_match');
  if (S.week === 45) {
    applyPrecontract(S);
    const T = buildSummerTournament(S);
    if (T) S.comp.sc[T.key] = { n: '', club: null, g: 3 + rng.int(0, 3) };
  }
  callups(S);
  generateOffers(S, rng);
  renewalCheck(S, rng);
}

// ---------------------------------------------------------------- week run
function processSlot(S, si) {
  const slot = si === 0 ? 'mw' : 'wk';
  if (!S.wsum.dec[si]) {
    S.wsum.dec[si] = 1;
    if (decidePlayer(S, slot)) return true;
  }
  simulateSlot(S, slot);
  return false;
}

function runWeek(S) {
  while (S.wstep < 2) {
    if (S.live) return { ok: true, status: 'match', match: matchVM(S, S.live) };
    if (processSlot(S, S.wstep)) return { ok: true, status: 'match', match: matchVM(S, S.live) };
    S.wstep++;
  }
  const ff = {};
  const summary = weekEnd(S, ff);
  return { ok: true, status: 'done', summary, ff };
}

function opponentHint(S) {
  const p = S.player;
  if (!p.club) return null;
  const f = weekFixturesOfClub(S, S.week)[0];
  if (f) return clubName(f.h === p.club ? f.a : f.h);
  const last = S.comp.res.filter((r) => r.k === 'league' || r.k === 'cup' || r.k === 'europe').slice(-1)[0];
  if (last) return clubName(last.h === p.club ? last.a : last.h);
  return null;
}

function weekEnd(S, ff) {
  const p = S.player;
  const rng = R();
  const W = S.wsum;
  const tr = S.training;
  // development
  const dev = developWeek(S, rng, tr);
  const ch = Object.keys(dev.attrs).sort((a, b) => (Math.abs(dev.attrs[b]) - Math.abs(dev.attrs[a])) || (a < b ? -1 : 1));
  const trainName = (TRAINING && TRAINING[tr] && TRAINING[tr].he) || tr;
  if (ch.length) {
    const k = ch[0];
    const d = dev.attrs[k];
    W.trainHe = trainName + ': ' + sgnHe(d) + ' ' + ((ATTRS && ATTRS[k] && ATTRS[k].he) || k);
  } else W.trainHe = trainName;
  p.energy = clamp(p.energy - (tr === 'rest' ? 0 : tr === 'balanced' ? 5 : 7), 0, 100);
  if (!p.injury && tr !== 'rest' && S.week <= 44 && p.stage !== 'free' && p.stage !== 'retired' && rng.chance(0.002)) {
    p.injury = rollInjury(S, rng);
    if (p.injury.sev === 'major') p.injury.weeks = Math.min(p.injury.weeks, 12);
    onInjury(S);
  }
  // morale / trust / mates drift
  const firstAbroad = !!S.ev.flags.abroad && p.contract && p.contract.since === S.season;
  const T = 55 + moraleBonus(S) - (p.bench >= 3 ? 10 : 0) - (firstAbroad ? 5 : 0);
  p.morale = p.morale + (T - p.morale) * 0.15;
  if (p.injury) p.morale -= 1;
  p.trust = p.trust + (50 - p.trust) * 0.02;
  p.mates = p.mates + (55 - p.mates) * 0.05;
  // money
  if (p.contract) p.money += p.contract.wage;
  const up = weeklyUpkeep(S);
  if (up > 0) {
    if (p.money >= up) p.money -= up;
    else { p.money = 0; p.morale -= 2; raise(S, 'money_low'); }
  } else if (up < 0) p.money -= up;     // investments return more than the upkeep of everything else
  // minutes / bench / free
  if (S.week <= 44) { p.mins.push(Math.min(180, W.min)); while (p.mins.length > 8) p.mins.shift(); }
  if (W.clubFx) {
    if (W.started) p.bench = 0;
    else { p.bench++; if (p.bench === 3) raise(S, 'benched'); }
  }
  if (p.stage === 'free') p.freeWeeks++; else p.freeWeeks = 0;
  if (p.agentPush > 0) p.agentPush--;
  // offers expiry
  const expired = expireOffers(S);
  if (p.stage === 'youth' && expired.some((o) => o.type === 'pro') && S.ev.flags._relpend) {
    delete S.ev.flags._relpend;
    releaseYouth(S);
  }
  autoAnswerExpired(S, rng, false);
  if (S.ev.flags.abroad && p.contract && p.contract.since === S.season && rng.chance(0.08)) raise(S, 'homesick');
  clampStatus(p);
  p.peak = Math.max(p.peak, ovrOf(p));
  const dateHe = weekLabelHe(S.season, S.week);
  if (p.club && S.week <= 44 && S.comp.res.some((r) => r.w === S.week && r.k === 'league')) {
    const lid = clubLeague(S, p.club);
    const rk = lid ? leagueRankOf(S, lid, p.club) : null;
    if (rk) W.lines.push(clubName(p.club) + ' במקום ' + rk + ' ' + hePrefix('ב', lgNameHe(lid)));
  }
  if (S.week === 44) seasonEnd(S);
  if (!S.retired) runWeekEvents(S, rng, { opp: opponentHint(S), derby: W.derby });
  let retiredNow = false;
  if (S.week === 52) retiredNow = rollover(S);
  else S.week++;
  clampStatus(p);
  const summary = {
    dateHe, results: W.results, trainingHe: W.trainHe, ovrBefore: W.ovrBefore, ovrAfter: ovrOf(p), energy: p.energy, morale: p.morale,
    newMessages: Math.max(0, S.ctr.m - W.m0), newOffers: W.offers, injuryHe: W.injuryHe, callupHe: W.callupHe, linesHe: W.lines.slice(),
    hadMatchday: W.hadMatchday, seasonEnded: !!W.seasonEnded, retiredNow,
  };
  if (ff) { ff.newInj = W.newInj; ff.firstCall = W.firstCall; }
  S.inWeek = false; S.wstep = 0; S.wsum = null;
  return summary;
}

function onInjury(S) {
  const p = S.player;
  const W = S.wsum;
  p.morale -= 8;
  raise(S, 'injury');
  if (p.injury.weeks >= 6) raise(S, 'long_injury');
  const he = injuryHe(p.injury);
  if (W) { W.injuryHe = he + ' · ' + p.injury.weeks + ' שבועות'; W.newInj = Math.max(W.newInj, p.injury.weeks); }
  sysMsg(S, 'doctor', 'אבחון: ' + he + '. צפי חזרה: ' + p.injury.weeks + ' שבועות. {{תנוח ותקשיב|תנוחי ותקשיבי}} לפיזיותרפיסט.');
  addTimeline(S, 'injury', 'פציעה: ' + he + ' (' + p.injury.weeks + ' שבועות)');
}

// ---------------------------------------------------------------- season end / rollover
function firstTeamAppsCareer(S) {
  let n = 0;
  for (const s of S.hist.seasons) n += s.stats.lg.apps + s.stats.cup.apps + s.stats.eu.apps;
  const p = S.player;
  if (!S.hist.seasons.some((x) => x.s === S.season)) n += p.s.lg.apps + p.s.cup.apps + p.s.eu.apps;
  return n;
}

function seasonEnd(S) {
  const p = S.player;
  const rng = R();
  const W = S.wsum;
  seasonEndAwards(S, rng);
  S.world.champs[S.season] = S.world.champs[S.season] || {};
  for (const lid of leagueIds()) S.world.champs[S.season][lid] = leagueRanking(S, lid)[0];
  const lid = p.club ? clubLeague(S, p.club) : null;
  S.comp.end = { club: p.club || null, lg: lid, rank: lid ? leagueRankOf(S, lid, p.club) : null, loan: !!(p.contract && p.contract.loan) };
  S.comp.next = computeNextEntrants(S);
  endLoan(S);
  if (p.stage === 'youth') {
    const age = ageOf(S);
    let offered = false;
    if (age >= 17 && (proEligible(S) || firstTeamAppsCareer(S) >= 3)) {
      makeProOffer(S, rng, 6);
      offered = S.offers.some((o) => o.status === 'open' && o.type === 'pro');
    }
    if (age >= 18) {
      if (offered) S.ev.flags._relpend = true;
      else releaseYouth(S);
    }
  }
  contractExpiry(S);
  p.treq = false;
  S.pending.review = S.season;
  if (ageOf(S) >= 33 && p.stage !== 'retired') S.pending.retire = 'offer';
  const tot = sumLines(p.s, ALL_LINES);
  emit('season_completed', { season: S.season, n: S.season - S.startSeason + 1, league: S.comp.end.lg, rank: S.comp.end.rank, apps: tot.apps, goals: tot.g, ovr: ovrOf(p) });
  if (W) {
    W.seasonEnded = true;
    if (S.comp.end.rank) W.lines.push('סיום העונה: מקום ' + S.comp.end.rank + ' ' + hePrefix('ב', LEAGUE_BY_ID[lid] ? lgNameHe(lid) : 'ליגה'));
  }
}

// returns true if the player was retired by the engine
function rollover(S) {
  const p = S.player;
  const rng = R();
  ballonDor(S, rng);
  S.ev.carry = (S.ev.trig || []).filter((t) => t === 'ballon_dor_night' || t === 'golden_boy');
  archiveSeason(S, S.comp.end);
  evolveStars(S, rng);
  const moved = promoteRelegate(S);
  const uclLp = S.comp.eu ? S.comp.eu.ucl.lp.teams : [];
  evolveClubs(S, rng, moved, uclLp);
  driftNational(S, rng);
  p.rep.l = round1(p.rep.l * 0.85); p.rep.c = round1(p.rep.c * 0.85); p.rep.w = round1(p.rep.w * 0.9);
  potentialDrift(S);
  const age = ageOf(S);
  const ovr = ovrOf(p);
  let forced = null;
  if (age >= 40) forced = 'age';
  else if (age >= 35 && ovr < 60) forced = 'decline';
  else if (age >= 30 && p.freeWeeks >= 30) forced = 'no_club';
  if (forced) {
    retireNow(S, forced, true);
    return true;
  }
  S.season++;
  S.week = 1;
  pruneMatches(S, S.season - 1);
  for (const k of Object.keys(S.ev.cd)) if (S.ev.cd[k] < curAw(S) - 156) delete S.ev.cd[k];
  S.nt.tour = null; S.nt.ytour = null;
  p.s = emptyStats(); p.yc = 0; p.susp = 0;
  if (p.stage === 'youth') p.youth = youthLvlFor(ageOf(S));
  buildSeason(S, false);
  updatePotSeen(S);
  return false;
}

function retireNow(S, reason, forced) {
  const p = S.player;
  const rng = R();
  if (!S.hist.seasons.some((x) => x.s === S.season)) archiveSeason(S, S.comp && S.comp.end ? S.comp.end : { club: p.club, lg: p.club ? clubLeague(S, p.club) : null, rank: null, loan: !!(p.contract && p.contract.loan) });
  const lastSp = S.hist.clubs[S.hist.clubs.length - 1];
  const lastClub = p.club || (lastSp ? lastSp.club : null);
  const lastLg = lastClub ? clubLeague(S, lastClub) : null;
  closeSpell(S, S.season);
  for (const o of S.offers) if (o.status === 'open') { o.status = 'withdrawn'; o.cl = curAw(S); }
  autoAnswerExpired(S, rng, true);
  p.stage = 'retired';
  p.club = null; p.contract = null; p.parent = null; p.next = null; p.treq = false;
  S.nt.called = {};
  S.pending.review = null;
  S.pending.retire = forced ? 'forced' : (S.pending.retire === 'offer' ? null : S.pending.retire);
  const legacy = legacyScore(S);
  S.retired = { season: S.season, week: S.week, age: ageOf(S), reason, legacy };
  addTimeline(S, 'retired', 'פרישה מכדורגל בגיל ' + ageOf(S) + '. תודה על הכול!');
  S.ev.trig = ['retired'];
  runWeekEvents(S, rng, { opp: null, derby: false }, true);
  // R6 telemetry: final league / tier and whether the player ever reached a European top-5 league
  const lgSeen = new Set(S.hist.seasons.map((x) => x.lg).filter(Boolean));
  const top5 = Array.from(lgSeen).some((l) => MG.isTop5(l));
  const llg = lastLg ? LEAGUE_BY_ID[lastLg] : null;
  const tier = !llg ? 'none' : MG.isTop5(lastLg) ? 'top5' : llg.tier === 1 && llg.euro ? 'europe' : llg.tier === 1 ? 'tier1' : 'tier2';
  emit('retired', { age: ageOf(S), seasons: S.season - S.startSeason + 1, legacy, reason, league: lastLg || null, tier, top5, gender: p.gender === 'f' ? 'f' : 'm', club: lastClub || null });
  S.retired.club = lastClub || null;
  // R2: coaching offers (the world keeps running in manager mode)
  MG.initRetirementOffers(S, !!(forced && S.week === 52));
}

// ---------------------------------------------------------------- facade: hub and time
function busyErr(S) {
  if (S.retired) return { ok: false, error: 'retired', messageHe: 'הקריירה הסתיימה' };
  if (S.live || S.inWeek) return { ok: false, error: 'busy', messageHe: 'יש שבוע או משחק בתהליך' };
  if (S.pending.review !== null) return { ok: false, error: 'review_pending', messageHe: 'סיכום העונה מחכה לך' };
  return null;
}

function advanceInternal(S, training) {
  const e = busyErr(S);
  if (e) return e;
  weekStart(S, training);
  return runWeek(S);
}
function resumeInternal(S) {
  if (S.live) return { ok: false, error: 'busy', messageHe: 'יש משחק בתהליך' };
  if (!S.inWeek) return { ok: false, error: 'no_week', messageHe: 'אין שבוע פתוח' };
  return runWeek(S);
}

export function setTraining(id) {
  const S = need();
  if (TRAIN_IDS.indexOf(id) < 0 || (id === 'goalkeeping' && S.player.pos !== 'GK')) return { ok: false };
  S.training = id;
  notify();
  return { ok: true };
}

export function advanceWeek(training) {
  const S = need();
  const r = advanceInternal(S, training);
  delete r.ff;
  if (r.ok) notify();
  return G(r);
}
export function resumeWeek() {
  const S = need();
  const r = resumeInternal(S);
  delete r.ff;
  if (r.ok) notify();
  return G(r);
}

// ---------------------------------------------------------------- match facade
export function getMatch() {
  const S = need();
  return S.live ? G(matchVM(S, S.live)) : null;
}
export function startMatch() {
  const S = need();
  if (!S.live) throw new Error('no_match');
  if (S.live.phase === 'pre') startLive(S, R(), S.live);
  notify();
  return G(matchVM(S, S.live));
}
export function chooseMoment(optionIndex) {
  const S = need();
  const L = S.live;
  if (!L) throw new Error('no_match');
  if (L.phase === 'pre') startLive(S, R(), L);
  if (L.phase !== 'live') throw new Error('match_not_live');
  const outcome = chooseLive(S, R(), L, optionIndex);
  notify();
  return G({ outcome, match: matchVM(S, L) });
}
export function autoPlayMatch() {
  const S = need();
  const L = S.live;
  if (!L) throw new Error('no_match');
  autoPlayLive(S, R(), L);
  notify();
  return G(matchVM(S, L));
}

function natLevelOfFx(fx) {
  if (fx.kind === 'national' || fx.kind === 'friendly') return 'senior';
  if (fx.kind === 'ynt') return fx.lvl || (fx.comp.indexOf('ynt_') === 0 ? fx.comp.slice(4) : 'u19');
  return null;
}

function finishInternal(S) {
  const L = S.live;
  if (!L || L.phase !== 'ended') throw new Error('match_not_ended');
  const rng = R();
  const p = S.player;
  const fx = L.fx;
  const W = S.wsum;
  const res = resOf(L);
  const rating = computeRating(S, rng, L);
  const ms = momentStats(L);
  const minutes = Math.max(1, L.off - L.on);
  const my = L.side === 'h' ? L.sc[0] : L.sc[1];
  const th = L.side === 'h' ? L.sc[1] : L.sc[0];
  const starter = L.role === 'starter';
  const motm = rating >= 8.0;
  const csOk = cleanSheetEligible(S) && minutes >= 60 && th === 0;
  const extra = L.et ? (L.et.pens ? 'p:' + L.et.pens[0] + '-' + L.et.pens[1] : 'et') : null;
  const line = p.s[lineOf(fx.kind)];
  line.apps++; if (starter) line.st++; line.min += minutes; line.g += ms.g; line.a += ms.a; line.rs = round1(line.rs + rating);
  if (motm) line.motm++;
  if (csOk) line.cs++;
  const pa = S.comp.pa[fx.comp] || [0, 0, 0, 0];
  pa[0]++; pa[1] += ms.g; pa[2] += ms.a; pa[3] = round1(pa[3] + rating);
  S.comp.pa[fx.comp] = pa;
  recordMatch(S, { aw: curAw(S), c: fx.comp, k: fx.kind, o: L.opp, h: L.side === 'h' ? 1 : 0, gf: my, ga: th, r: rating, g: ms.g, a: ms.a, m: minutes, st: starter ? 1 : 0, sl: fx.slot });
  const clubKind = fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe' || fx.kind === 'youth';
  if (clubKind) creditSpell(S, L.own, ms.g, ms.a);
  const eff = [];
  const nl = natLevelOfFx(fx);
  if (nl) { p.caps[nl]++; p.ig[nl] += ms.g; }
  const F = S.hist.firsts;
  const aw = curAw(S);
  if (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe') {
    if (F.debut === null) { F.debut = aw; raise(S, 'debut'); emit('debut', { kind: 'senior' }); addTimeline(S, 'debut', 'הופעת בכורה בקבוצה הבוגרת של ' + clubName(L.own) + '!'); }
    if (ms.g > 0 && F.goal === null) { F.goal = aw; raise(S, 'first_goal'); addTimeline(S, 'goal', 'השער הראשון בקריירה הבוגרת, נגד ' + clubName(L.opp) + '!'); }
    if (fx.kind === 'europe' && F.euDebut === null) { F.euDebut = aw; addTimeline(S, 'europe', 'הופעת בכורה באירופה: ' + compHe(S, fx.comp)); }
  }
  if (nl === 'senior') {
    if (F.ntDebut === null) { F.ntDebut = aw; raise(S, 'national_debut'); emit('debut', { kind: 'national' }); addTimeline(S, 'national', 'הופעת בכורה ב' + natTeamHe(S) + '!'); }
    if (ms.g > 0 && F.ntGoal === null) { F.ntGoal = aw; addTimeline(S, 'goal', 'שער ראשון ב' + natTeamHe(S) + '!'); }
  }
  p.form.push(rating); while (p.form.length > 5) p.form.shift();
  let dm = res === 'W' ? 3 : res === 'L' ? -3 : 0;
  if (rating >= 8) dm += 4; else if (rating <= 5.5) dm -= 4;
  p.morale = clamp(p.morale + dm, 0, 100);
  if (dm) eff.push(sgnHe(dm) + ' מורל');
  if (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe') {
    const dt = (rating - 6.6) * 4;
    p.trust = clamp(p.trust + dt, 0, 100);
    if (dt >= 2) eff.push('אמון המאמן עלה'); else if (dt <= -2) eff.push('אמון המאמן ירד');
  } else if (fx.kind === 'youth') p.trust = clamp(p.trust + (rating - 6.6) * 1.5, 0, 100);
  let df = 0;
  if (rating >= 7.5) df += 1.5;
  df += ms.g;
  if (fx.big && (fx.kind === 'league' || fx.kind === 'cup') && clubData(L.own) && clubData(L.own).rival === L.opp) df += 3 * ms.g;
  if (res === 'L') df -= 0.5;
  df += ms.fans;
  p.fans = clamp(p.fans + df, 0, 100);
  if (df >= 2) eff.push('הקהל אוהב אותך');
  // reputation
  if (fx.kind === 'league' || fx.kind === 'cup') {
    const pr = clubPrestige(S, L.own);
    const dl = (rating - 6.3) * 0.25 * pr / 6 + ms.g * 0.15;
    p.rep.l += dl; p.rep.w += dl * 0.1 * pr / 10;
  } else if (fx.kind === 'europe' || nl === 'senior') {
    const pr = fx.kind === 'europe' ? clubPrestige(S, L.own) : (fx.rk ? 9 : 6);
    const dc = (rating - 6.3) * 0.4 + ms.g * 0.2;
    p.rep.c += dc; p.rep.w += dc * 0.4 * pr / 10;
  } else {
    p.rep.l += (rating - 6.3) * 0.08 + ms.g * 0.05;
  }
  p.energy = clamp(p.energy - 18 * minutes / 90, 0, 100);
  if (ms.cards > 0) {
    if (fx.kind === 'league') {
      for (let i = 0; i < ms.cards; i++) { p.yc++; if (p.yc % 5 === 0) { p.susp = 1; eff.push('צהוב חמישי: הרחקה למשחק'); } }
    }
  }
  let injuryHeTxt = null;
  if (!p.injury && rng.chance(injuryChanceMatch(S, minutes))) {
    p.injury = rollInjury(S, rng);
    onInjury(S);
    injuryHeTxt = injuryHe(p.injury) + ' · ' + p.injury.weeks + ' שבועות';
  }
  if (ms.g >= 3) raise(S, 'hat_trick');
  if (rating >= 8.5) raise(S, 'great_match');
  if (rating <= 5.5) raise(S, 'bad_match');
  if (motm) raise(S, 'motm');
  if (fx.big && (fx.final || fx.rk === 'sf' || fx.rk === 'qf' || fx.rk === 'r16' || fx.rk === 'kpo')) raise(S, 'big_match');
  if (fx.final && rating >= 8.0) giveAward(S, 'motm_final', fx.comp, null);
  clampStatus(p);
  emit('match_played', { kind: fx.kind, result: res, rating, role: L.role, auto: !!L.auto });
  // tie text
  let tieHe = null;
  if (fx.ko) {
    const agg = fx.tie && fx.tie.agg ? fx.tie.agg : null;
    const ws = koWinner(L.sc[0], L.sc[1], extra, agg);
    const won = ws === L.side;
    if (agg) tieHe = 'סיכום ' + (L.sc[0] + agg[0]) + '-' + (L.sc[1] + agg[1]) + '. ';
    else tieHe = '';
    if (fx.final) tieHe += won ? 'זכיתם בגמר!' : 'הפסד בגמר. כואב.';
    else tieHe += won ? 'עליתם לשלב הבא!' : 'הודחתם.';
  } else if (fx.tie && fx.tie.leg === 1) tieHe = 'משחק ראשון. הכול פתוח לגומלין.';
  const v = teamVariant(fx);
  const summary = {
    key: S.season + '-' + S.week + '-' + fx.slot, compHe: compHe(S, fx.comp), roundHe: roundHe(fx), kind: fx.kind,
    home: teamVM(fx.h, v), away: teamVM(fx.a, v), isHome: L.side === 'h', score: L.sc.slice(), extraHe: extraHe(L.et), res,
    rating, goals: ms.g, assists: ms.a, motm, minutes, cleanSheet: csOk,
    momentsHe: L.mo.filter((m) => m.res).map((m) => ({ minute: m.m, textHe: m.res.t, ok: m.res.ok })),
    log: logVM(L),
    myShortHe: (L.side === 'h' ? teamVM(fx.h, v) : teamVM(fx.a, v)).shortHe, oppShortHe: (L.side === 'h' ? teamVM(fx.a, v) : teamVM(fx.h, v)).shortHe,
    playerHe: L.pn || p.nick || p.last, num: p.num, gender: p.gender === 'f' ? 'f' : 'm', final: !!fx.final, big: !!fx.big,
    effectsHe: eff, tieHe, injuryHe: injuryHeTxt,
  };
  if (W) {
    W.fixed[fxKey(fx)] = [L.sc[0], L.sc[1], extra];
    W.hadMatchday = true;
    W.min += minutes;
    if (starter && (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe')) W.started = true;
    W.results.push(resultRow(S, fx, L.sc[0], L.sc[1], extra, true, rating, L.role === 'bench' ? 'נכנסת מהספסל' : ''));
    W.sel[fxKey(fx)] = L.role;
  }
  // R6 telemetry: one signal per goal of the player ({ mega } = the goal got the mega celebration)
  for (const e of summary.log) if (e.ev === 'goal' && e.who === 'me') emit('goal', { mega: !!e.mega });
  if (fx.ref && fx.ref.t === 'gen') recordRes(S, Object.assign({}, fx), L.sc[0], L.sc[1], extra, L.role, rating);
  else if (W) W.pr = { key: fxKey(fx), sel: L.role, rt: rating };
  // youth: pro offer after the 3rd first-team appearance
  if (p.stage === 'youth' && (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe') && ageOf(S) >= 16 && firstTeamAppsCareer(S) === 3) makeProOffer(S, rng, 4);
  const stored = Object.assign({}, summary);
  delete stored.log;
  S.lastMatch = stored;
  S.live = null;
  return summary;
}
export function finishMatch() {
  const S = need();
  const r = finishInternal(S);
  notify();
  return G(r);
}
export function getLastMatch() {
  const S = need();
  return S.lastMatch ? G(deepClone(S.lastMatch)) : null;
}

// ---------------------------------------------------------------- fast forward
export function fastForward(opts = {}) {
  const S = need();
  const until = opts.until || 'next_match';
  const maxW = typeof opts.maxWeeks === 'number' && opts.maxWeeks > 0 ? opts.maxWeeks : Infinity;
  const nWeeks = typeof opts.weeks === 'number' ? opts.weeks : 1;
  const summaries = [];
  let weeks = 0;
  let stopped = null;
  const startSeason = S.season;
  const done = (st) => { notify(); return G({ ok: true, weeks, summaries: summaries.slice(-10), stopped: st, hub: hubVM(S) }); };
  if (S.retired) return done('retired');
  const evalStop = (sum, m0, ff) => {
    if (S.retired) return 'retired';
    if (sum.seasonEnded || S.pending.review !== null) return 'review';
    if (sum.newOffers > 0) return 'offer';
    if (S.inbox.some((it) => it.imp && Number(it.id.slice(1)) > m0 && it.ans === null)) return 'event';
    if (ff && ff.newInj >= 3) return 'injury';
    if (ff && ff.firstCall) return 'callup';
    return null;
  };
  const playOut = (r, m0) => {
    while (r && r.ok && r.status === 'match') {
      autoPlayLive(S, R(), S.live);
      finishInternal(S);
      r = resumeInternal(S);
    }
    if (r && r.ok && r.status === 'done') {
      summaries.push(r.summary); weeks++;
      return evalStop(r.summary, m0, r.ff);
    }
    return null;
  };
  if (S.live) {
    if (until === 'next_match') return done('until');
    const m0 = S.wsum ? S.wsum.m0 : S.ctr.m;
    if (S.live.phase === 'pre') startLive(S, R(), S.live);
    autoPlayLive(S, R(), S.live);
    finishInternal(S);
    stopped = playOut(resumeInternal(S), m0);
    if (stopped) return done(stopped);
  } else if (S.inWeek) {
    const m0 = S.wsum ? S.wsum.m0 : S.ctr.m;
    const r = resumeInternal(S);
    if (r.ok && r.status === 'match' && until === 'next_match') return done('until');
    stopped = playOut(r, m0);
    if (stopped) return done(stopped);
  }
  if (S.pending.review !== null) return done('review');
  for (;;) {
    if (S.retired) return done('retired');
    if (S.pending.review !== null) return done('review');
    if (until === 'season_start' && S.week === 1 && (S.season > startSeason || weeks > 0)) return done('until');
    if (until === 'weeks' && weeks >= nWeeks) return done('until');
    if (weeks >= maxW) return done('chunk');
    const m0 = S.ctr.m;
    const r = advanceInternal(S, opts.training);
    if (!r.ok) return done(r.error === 'retired' ? 'retired' : r.error === 'review_pending' ? 'review' : 'until');
    if (r.status === 'match' && until === 'next_match') return done('until');
    stopped = playOut(r, m0);
    if (stopped) return done(stopped);
  }
}

// ---------------------------------------------------------------- season review
function seasonStatsFrom(st) {
  const t = sumLines(st, ALL_LINES);
  return { apps: t.apps, goals: t.g, assists: t.a, avgRating: t.apps ? round1(t.rs / t.apps) : 0, motm: t.motm, cleanSheets: t.cs };
}
const LINE_HE = { lg: 'ליגה', cup: 'גביע', eu: 'אירופה', nt: 'נבחרת', yth: '{{נוער|נערות}}', ynt: '{{נבחרת נוער|נבחרת נערות}}' };

export function getSeasonReview(season) {
  const S = need();
  const p = S.player;
  let s = typeof season === 'number' ? season : (S.pending.review !== null ? S.pending.review : null);
  if (s === null) {
    if (S.hist.seasons.length === 0 && !(S.week > 44)) return null;
    s = S.week > 44 ? S.season : S.hist.seasons[S.hist.seasons.length - 1].s;
  }
  // manager mode: the player's last season is the latest player review
  if (S.retired && s > S.retired.season) s = S.retired.season;
  const live = s === S.season && !S.hist.seasons.some((x) => x.s === s);
  const arch = S.hist.seasons.find((x) => x.s === s) || null;
  if (!live && !arch) return null;
  const st = live ? p.s : arch.stats;
  const end = live ? (S.comp.end || {}) : { club: arch.club, lg: arch.lg, rank: arch.rank };
  const lg = end.lg ? LEAGUE_BY_ID[end.lg] : null;
  const byComp = [];
  for (const k of ALL_LINES) {
    const l = st[k];
    if (l.apps > 0) byComp.push({ compHe: k === 'lg' && lg ? lgNameHe(lg.id) : femLabel(LINE_HE[k]), apps: l.apps, goals: l.g, assists: l.a, avgRating: lineAvg(l) });
  }
  const trophies = S.hist.trophies.filter((t) => t.s === s).map((t) => ({ key: t.k, he: trophyHe(t.k) }));
  const awards = S.hist.awards.filter((t) => t.s === s).map((t) => ({ key: t.k, he: awardHe(t.k) }));
  const prevOvr = (() => { const i = S.hist.seasons.findIndex((x) => x.s === s); if (i > 0) return S.hist.seasons[i - 1].ovr; return null; })();
  const ovrStart = live ? (S.comp.o0 || ovrOf(p)) : (prevOvr !== null ? prevOvr : arch.ovr);
  const ovrEnd = live ? ovrOf(p) : arch.ovr;
  const stats = seasonStatsFrom(st);
  const hl = [];
  if (end.rank) hl.push('סיימתם במקום ' + end.rank + (lg ? ' ' + hePrefix('ב', lgNameHe(lg.id)) : ''));
  if (stats.goals > 0) hl.push(stats.goals + ' שערים ו-' + stats.assists + ' בישולים');
  if (ovrEnd > ovrStart) hl.push('היכולת עלתה מ-' + ovrStart + ' ל-' + ovrEnd);
  for (const t of trophies) hl.push('🏆 ' + t.he);
  for (const a of awards) hl.push('🏅 ' + a.he);
  if (stats.apps === 0) hl.push('עונה בלי הופעות. העונה הבאה תהיה שלך.');
  const nextHe = [];
  if (live) {
    if (p.stage === 'free') nextHe.push('{{אתה שחקן חופשי. בדוק|את שחקנית חופשית. בדקי}} הצעות בחלון ההעברות.');
    if (p.next) nextHe.push('בקיץ {{אתה עובר|את עוברת}} ל' + clubName(p.next.club));
    if (p.stage === 'youth' && S.offers.some((o) => o.status === 'open' && o.type === 'pro')) nextHe.push('מחכה לך הצעה לחוזה מקצועני!');
    const ts = summerTournaments(S.season + 1);
    if (ts.length) nextHe.push('בקיץ: ' + ts.map((k) => tourKindHe(k)).join(', '));
    if (p.contract && p.contract.until === S.season + 1 && !p.contract.loan) nextHe.push('נכנס לשנה האחרונה בחוזה');
  }
  const club = end.club || null;
  return G({
    season: s, seasonHe: fmtSeason(s), clubHe: club ? clubName(club) : 'ללא קבוצה', leagueHe: lg ? lgNameHe(lg.id) : '', rank: end.rank || null,
    rankHe: end.rank ? 'מקום ' + end.rank : '-', stats, byComp, trophies, awards, ovrStart, ovrEnd, valueEnd: valueOf(S), highlightsHe: hl, nextHe,
    canRetire: !S.retired && ageOf(S) >= 32 && !S.live && !S.inWeek, isFirstSeason: s === S.startSeason,
  });
}
export function ackSeasonReview() {
  const S = need();
  if (S.pending.review === null) return { ok: false };
  S.pending.review = null;
  if (S.pending.retire === 'offer') S.pending.retire = null;
  notify();
  return { ok: true };
}
export function grantReward(kind) {
  const S = need();
  const p = S.player;
  const aw = curAw(S);
  if (kind !== 'energy15' || S.retired || p.energy >= 100 || S.ev.flags.rw === aw) return { ok: false, energy: p.energy };
  S.ev.flags.rw = aw;
  p.energy = Math.min(100, p.energy + 15);
  notify();
  return { ok: true, energy: p.energy };
}

// ---------------------------------------------------------------- retirement
const REASON_HE = { voluntary: 'פרישה מרצון', age: 'הגוף אמר די', decline: 'היכולת ירדה', no_club: 'בלי קבוצה יותר מדי זמן' };
export function retire() {
  const S = need();
  if (S.retired) return getRetirement();
  if (ageOf(S) < 32) return { ok: false, error: 'too_young', messageHe: 'אפשר לפרוש רק מגיל 32' };
  if (S.live || S.inWeek) return { ok: false, error: 'in_match', messageHe: gtext('{{סיים|סיימי}} קודם את השבוע') };
  retireNow(S, 'voluntary', false);
  notify();
  return getRetirement();
}
export function getRetirement() {
  const S = need();
  if (!S.retired) return null;
  const p = S.player;
  const cv = careerVM(S, awLabel);
  const seen = new Set(); const clubsHe = [];
  for (const c of S.hist.clubs) if (!seen.has(c.club)) { seen.add(c.club); clubsHe.push(clubName(c.club)); }
  const t = cv.totals;
  const f = S.names.friends;
  const farewell = [
    'אמא: "אני כל כך גאה בך. מהמגרש בשכונה ועד לכאן. {{בוא|בואי}} הביתה, הכנתי שניצלים."',
    f[0] + ' מהחבר׳ה: "' + t.goals + ' שערים, {{אחי|אחותי}}. אנחנו עדיין זוכרים את הבעיטה ההיא במגרש של בית הספר."',
    'אבא: "ישבתי ביציע בכל משחק שיכולתי. לא הייתי מוותר על אף דקה."',
  ];
  if (S.hist.trophies.length) farewell.push('האוהדים: "תודה על ' + S.hist.trophies.length + ' תארים. השם שלך יישאר על הקיר."');
  else farewell.push('האוהדים: "נתת את הלב על הדשא. זה מה שזוכרים."');
  return G({
    ok: true, name: p.first + ' ' + p.last, gender: p.gender === 'f' ? 'f' : 'm', age: S.retired.age, seasons: S.retired.season - S.startSeason + 1, reason: S.retired.reason,
    reasonHe: REASON_HE[S.retired.reason] || '', legacy: S.retired.legacy, tierHe: legacyTierHe(S.retired.legacy),
    totals: cv.totals, trophies: cv.trophies, awards: cv.awards, peakOvr: p.peak, clubsHe, farewellHe: farewell,
    // R8: the farewell avatar wears the last club's kit
    lastClub: S.retired.club ? teamVM(S.retired.club) : (S.hist.clubs.length ? teamVM(S.hist.clubs[S.hist.clubs.length - 1].club) : null),
    // R2: coaching career
    coaching: S.mgr ? { st: S.mgr.st, band: S.mgr.band || null, offers: MG.offersVM(S), record: MG.coachRecord(S) } : null,
  });
}
export function buildHallOfFameEntry() {
  const S = need();
  const e = hofEntry(S, Date.now());
  if (!e) return null;
  // R2: player + coach. legacy = player legacy + coaching legacy; the player-only score stays in legacyPlayer.
  const ch = S.mgr ? MG.coachHof(S) : null;
  if (ch && ch.games > 0) {   // a coaching career with no managed match does not change the entry
    const f = S.player.gender === 'f';
    e.v = 2;
    e.coach = ch;
    e.roleHe = f ? 'שחקנית + מאמנת' : 'שחקן + מאמן';
    e.legacyPlayer = e.legacy;
    e.legacy = round1(e.legacy + ch.legacy);
    e.tierHe = e.tierHe + ' · ' + e.roleHe;
    e.coachActive = S.mgr.st !== 'done';
    if (S.mgr.ended) e.coachEndSeason = S.mgr.ended.season;
  }
  return G(e);
}

// ---------------------------------------------------------------- fixtures VMs (pure)
function fxVMFromRes(S, r) {
  const fx = { comp: r.c, kind: r.k, h: r.h, a: r.a, lvl: r.lvl };
  const v = teamVariant(fx);
  const p = S.player;
  const mineSide = (r.h === p.nation || r.a === p.nation) && (r.k === 'national' || r.k === 'friendly' || r.k === 'ynt') ? (r.h === p.nation ? 'h' : 'a') : null;
  const isHome = mineSide ? mineSide === 'h' : (S.comp.res.indexOf(r) >= 0 ? isHomeForRes(S, r) : true);
  const my = isHome ? r.hg : r.ag, th = isHome ? r.ag : r.hg;
  const res = my > th ? 'W' : my < th ? 'L' : 'D';
  return {
    key: S.season + '-' + r.w + '-' + r.s, week: r.w, slot: r.s, dateHe: weekLabelHe(S.season, r.w), comp: r.c, compHe: compHe(S, r.c), kind: r.k, roundHe: r.rd,
    home: teamVM(r.h, v), away: teamVM(r.a, v), isHome, big: !!r.big,
    selection: ['starter', 'bench', 'out', 'injured', 'suspended'].indexOf(r.sel) >= 0 ? r.sel : 'unknown',
    result: { score: [r.hg, r.ag], extraHe: extraHe(null, r.x), rating: r.rt, res },
  };
}
function isHomeForRes(S, r) {
  // which side was the player's team: national -> nation; else the club that appears in other res rows most (club at that time)
  const p = S.player;
  if (r.h === p.club || r.a === p.club) return r.h === p.club;
  // historical club: find the spell club covering this fixture
  for (let i = S.hist.clubs.length - 1; i >= 0; i--) { const c = S.hist.clubs[i].club; if (r.h === c || r.a === c) return r.h === c; }
  return true;
}

function fxVM(S, f, week, slot, selection, isHome) {
  const v = teamVariant(f);
  const own = isHome ? f.h : f.a, opp = isHome ? f.a : f.h;
  const W = S.wsum;
  let sel = selection;
  if (!sel && W && week === S.week && S.inWeek) sel = W.sel[fxKey(f)];
  return {
    key: S.season + '-' + week + '-' + slot, week, slot, dateHe: weekLabelHe(S.season, week), comp: f.comp, compHe: compHe(S, f.comp), kind: f.kind,
    roundHe: roundHe(f), home: teamVM(f.h, v), away: teamVM(f.a, v), isHome: !!isHome,
    big: (() => { try { return isBigPure(S, f, own, opp); } catch (e) { return false; } })(),
    selection: sel || 'unknown', result: null,
  };
}
function isBigPure(S, f, own, opp) {
  const cd = clubData(own);
  if ((f.kind === 'league' || f.kind === 'cup') && cd && cd.rival === opp) return true;
  if (f.kind === 'cup' && (f.rk === 'sf' || f.rk === 'f')) return true;
  if (f.kind === 'europe' && f.rk !== 'lp' && f.rk !== 'q') return true;
  if (f.kind === 'europe' && f.comp === 'ucl' && cs(S, opp) >= 85) return true;
  if ((f.kind === 'national' || f.kind === 'ynt') && f.rk) return true;
  return false;
}

// Upcoming (unplayed) fixtures of the player's current teams this season: [{ f, week, slot, isHome, pri }]
// ov (manager mode): { club, stage, nation, called, youth } replaces the player's club / stage / nation / call-ups.
function upcomingFixtures(S, ov) {
  const p0 = S.player;
  const p = ov ? { club: ov.club, stage: ov.stage, nation: ov.nation } : p0;
  const out = [];
  if (!S.comp || (S.retired && !ov)) return out;
  const cur = S.week;
  const doneSlot = (w, s) => w < cur || (w === cur && S.inWeek && ((s === 'mw' && S.wstep >= 1) || (s === 'wk' && S.wstep >= 2)));
  const club = p.club;
  if (club && p.stage !== 'free') {
    const lid = clubLeague(S, club);
    const L = lid && S.comp.lg[lid];
    if (L && p.stage !== 'youth') {
      const sl = leagueRoundSlots(L.R);
      for (let r = L.r; r < L.R; r++) {
        const fxs = leagueRoundFixtures(S, lid, r);
        const m = fxs.find((x) => x[0] === club || x[1] === club);
        if (!m || !sl[r]) continue;
        if (doneSlot(sl[r].w, sl[r].s)) continue;
        out.push({ f: { comp: lid, kind: 'league', h: m[0], a: m[1], r }, week: sl[r].w, slot: sl[r].s, isHome: m[0] === club, pri: 2 });
      }
    }
    if (p.stage !== 'youth') {
      for (const id of cupIds()) {
        const Cp = S.comp.cups[id];
        if (!Cp || Cp.w) continue;
        const ties = Cp.rounds[Cp.rd] || [];
        const sl = cupRoundSlots(Cp.nr)[Cp.rd];
        ties.forEach((t) => {
          if (t[2] !== null || (t[0] !== club && t[1] !== club) || !sl || doneSlot(sl.w, sl.s)) return;
          out.push({ f: { comp: id, kind: 'cup', h: t[0], a: t[1], rk: cupRoundKey(Cp, Cp.rd), final: Cp.rd === Cp.nr - 1 }, week: sl.w, slot: sl.s, isHome: t[0] === club, pri: 2 });
        });
      }
      for (const c of EC) {
        const E = S.comp.eu[c];
        const add = (t, st, w, s, leg, md) => {
          if (t[2] !== null || (t[0] !== club && t[1] !== club) || doneSlot(w, s)) return;
          out.push({ f: { comp: c, kind: 'europe', h: t[0], a: t[1], rk: st, md, tie: leg ? { leg } : null }, week: w, slot: s, isHome: t[0] === club, pri: 2 });
        };
        E.q.forEach((t, i) => add(t, 'q', EURO_WEEKS.q[i % 2], 'mw', (i % 2) + 1));
        E.lp.fx.forEach((f) => { if (f[3] === null && (f[1] === club || f[2] === club) && !doneSlot(EURO_WEEKS.lp[f[0] - 1], 'mw')) out.push({ f: { comp: c, kind: 'europe', h: f[1], a: f[2], rk: 'lp', md: f[0] }, week: EURO_WEEKS.lp[f[0] - 1], slot: 'mw', isHome: f[1] === club, pri: 2 }); });
        for (const st of ['kpo', 'r16', 'qf', 'sf']) E.ko[st].forEach((t, i) => add(t, st, EURO_WEEKS[st][i % 2], 'mw', (i % 2) + 1));
        E.ko.f.forEach((t) => add(t, 'f', EURO_WEEKS.f, c === 'ucl' ? 'wk' : 'mw', 0));
      }
    }
    if (ov ? !!ov.youth : inYouthSetup(S)) {
      const Y = S.comp.yl;
      const sl = leagueRoundSlots(Y.R);
      for (let r = Y.r; r < Y.R; r++) {
        const m = youthRoundFixtures(S, r).find((x) => x[0] === club || x[1] === club);
        if (!m || !sl[r] || doneSlot(sl[r].w, sl[r].s)) continue;
        out.push({ f: { comp: Y.id, kind: 'youth', h: m[0], a: m[1], r }, week: sl[r].w, slot: sl[r].s, isHome: m[0] === club, pri: p.stage === 'youth' ? 3 : 1 });
      }
    }
  }
  const called = ov ? (ov.called || {}) : (S.nt.called || {});
  const n = p.nation;
  if (called.senior) {
    for (const slot of ['mw', 'wk']) {
      if (doneSlot(cur, slot)) continue;
      for (const f of natFixturesInSlot(S, cur, slot)) if ((f.kind === 'national' || f.kind === 'friendly') && (f.h === n || f.a === n)) out.push({ f, week: cur, slot, isHome: f.h === n, pri: 4 });
    }
    const T = S.nt.tour;
    if (T && nationAlive(T, n)) {
      for (const sl of tournamentSlots(T.fmt)) {
        if (sl.w === cur || doneSlot(sl.w, sl.s)) continue;
        if (sl.key.indexOf('md') === 0) { const md = Number(sl.key.slice(2)); for (const f of T.gfx) if (f[0] === md && f[3] === null && (f[1] === n || f[2] === n)) out.push({ f: { comp: T.key, kind: 'national', h: f[1], a: f[2], rk: 'grp' }, week: sl.w, slot: sl.s, isHome: f[1] === n, pri: 4 }); }
        else if (T.ko[sl.key]) for (const t of T.ko[sl.key]) if (t[2] === null && (t[0] === n || t[1] === n)) out.push({ f: { comp: T.key, kind: 'national', h: t[0], a: t[1], rk: sl.key, final: sl.key === 'f' }, week: sl.w, slot: sl.s, isHome: t[0] === n, pri: 4 });
      }
    }
    if (ov && ov.nationAll) {
      // national-team manager: every remaining qualifier / friendly of the season, not only this week's
      const q = S.nt.q;
      if (q) q.fx.forEach((f) => { const sl = intlSlotOf(f[0]); if (f[3] === null && (f[1] === n || f[2] === n) && sl.w !== cur && !doneSlot(sl.w, sl.s)) out.push({ f: { comp: 'q_' + q.tour, kind: 'national', h: f[1], a: f[2] }, week: sl.w, slot: sl.s, isHome: f[1] === n, pri: 4 }); });
      S.nt.fr.forEach((f) => { const sl = intlSlotOf(f[0]); if (f[3] === null && (f[1] === n || f[2] === n) && sl.w !== cur && !doneSlot(sl.w, sl.s)) out.push({ f: { comp: 'fr', kind: 'friendly', h: f[1], a: f[2] }, week: sl.w, slot: sl.s, isHome: f[1] === n, pri: 4 }); });
    }
  } else {
    const lvl = called.u17 ? 'u17' : called.u19 ? 'u19' : called.u21 ? 'u21' : null;
    if (lvl) {
      for (const slot of ['mw', 'wk']) {
        if (doneSlot(cur, slot)) continue;
        const T = S.nt.ytour;
        if (T) { for (const f of natFixturesInSlot(S, cur, slot)) if (f.kind === 'ynt' && (f.h === n || f.a === n)) out.push({ f, week: cur, slot, isHome: f.h === n, pri: 4 }); }
        else if (isIntlWeek(cur)) { const f = yntFixture(S, lvl, cur, slot); if (f) out.push({ f, week: cur, slot, isHome: f.h === n, pri: 4 }); }
      }
    }
  }
  return out;
}

function scheduleList(S) {
  const map = new Map();
  for (const r of (S.comp ? S.comp.res : [])) {
    const k = r.w + '-' + r.s;
    const prev = map.get(k);
    const pri = r.sel === 'starter' || r.sel === 'bench' ? 5 : (r.k === 'national' || r.k === 'friendly' || r.k === 'ynt') ? 4 : r.k === 'youth' ? 1 : 2;
    if (!prev || pri > prev.pri) map.set(k, { vm: fxVMFromRes(S, r), pri, w: r.w, s: r.s });
  }
  for (const u of upcomingFixtures(S)) {
    const k = u.week + '-' + u.slot;
    const prev = map.get(k);
    if (prev && prev.vm.result) continue;
    if (!prev || u.pri > prev.pri) map.set(k, { vm: fxVM(S, u.f, u.week, u.slot, null, u.isHome), pri: u.pri, w: u.week, s: u.slot });
  }
  return Array.from(map.values()).sort((a, b) => (a.w - b.w) || ((a.s === 'mw' ? 0 : 1) - (b.s === 'mw' ? 0 : 1))).map((x) => x.vm);
}

export function getSchedule() {
  const S = need();
  return G({ seasonHe: fmtSeason(S.season), fixtures: mgrActive(S) ? mgrScheduleList(S) : scheduleList(S) });
}

// ---------------------------------------------------------------- hub
function alertsVM(S) {
  const p = S.player;
  const A = ALERTS || {};
  const out = [];
  const add = (type, route) => out.push({ type, textHe: femLabel(A[type] || ''), route });
  if (S.pending.review !== null) add('season_review', '#/season');
  if (p.injury) add('injured', '#/profile');
  if (p.susp > 0) add('suspended', null);
  if (p.stage === 'free') add('free_agent', '#/offers');
  if (S.offers.some((o) => o.status === 'open')) add('offer', '#/offers');
  if (S.nt.called && Object.keys(S.nt.called).some((k) => S.nt.called[k])) add('callup', '#/national');
  if (isWindowOpen(S.week) && p.stage === 'pro') add('window_open', '#/offers');
  if (p.stage === 'pro' && p.contract && !p.contract.loan && p.contract.until === S.season && S.week <= 44 && !p.next) add('contract_expiring', '#/profile');
  if (p.energy < 35 && !S.retired) add('energy_low', null);
  return out.filter((a) => a.textHe !== '' || a.type === 'info');
}

function hubVM(S) {
  const p = S.player;
  const status = S.retired ? 'retired' : S.live ? 'match' : S.inWeek ? 'in_week' : S.pending.review !== null ? 'review' : 'idle';
  const ovr = ovrOf(p);
  let club = null;
  if (p.club) {
    const lid = clubLeague(S, p.club);
    const lg = LEAGUE_BY_ID[lid];
    club = Object.assign(teamVM(p.club), {
      leagueHe: lg ? lgNameHe(lid) : '', rank: lid ? leagueRankOf(S, lid, p.club) : null,
      roleHe: p.contract ? femLabel((ROLES && ROLES[p.contract.role]) || p.contract.role) : '', wage: p.contract ? p.contract.wage : 0,
      untilHe: p.contract ? 'עד סוף ' + fmtSeason(p.contract.until) : '', loan: !!(p.contract && p.contract.loan),
    });
  }
  const sched = S.retired ? [] : scheduleList(S);
  const thisWeek = sched.filter((f) => f.week === S.week);
  const next = thisWeek.length ? null : (sched.find((f) => f.week > S.week && !f.result) || null);
  const lm = S.lastMatch;
  const fa = formAvg(p);
  const trOpts = TRAIN_IDS.map((id) => ({ id, he: (TRAINING && TRAINING[id] && TRAINING[id].he) || id, desc: (TRAINING && TRAINING[id] && TRAINING[id].desc) || '', disabled: id === 'goalkeeping' && p.pos !== 'GK' }));
  const ann = [];
  const ts = summerTournaments(S.season + 1);
  if (ts.length && !S.retired) {
    const T = S.nt.tour;
    if (T) ann.push(tourHe(T.key) + (nationInTour(T, p.nation) ? ' - הנבחרת שלך משתתפת!' : ''));
    else ann.push('בקיץ ' + (S.season + 1) + ': ' + ts.map((k) => tourKindHe(k)).join(', '));
  }
  const aw = curAw(S);
  return {
    status, dateHe: weekLabelHe(S.season, S.week), season: S.season, week: S.week, phase: S.week >= 45 ? 'summer' : 'season',
    player: {
      name: p.first + ' ' + p.last, nick: p.nick, age: ageOf(S), pos: p.pos, posHe: posHeOf(p), gender: p.gender === 'f' ? 'f' : 'm', look: p.look ? Object.assign({}, p.look) : null, num: p.num,
      ovr, potStars: potStars(p.potSeen), potRange: p.potSeen.slice(), energy: p.energy, morale: p.morale, formAvg: fa === null ? null : round1(fa), form: p.form.slice(),
      injury: p.injury ? { weeks: p.injury.weeks, he: injuryHe(p.injury) } : null, susp: p.susp, trust: p.trust, fans: p.fans, mates: p.mates,
      rep: { l: p.rep.l, c: p.rep.c, w: p.rep.w }, money: p.money, value: valueOf(S), stage: p.stage, stageHe: femLabel((STAGES && STAGES[p.stage]) || p.stage), natLvl: p.natLvl,
    },
    club, thisWeek, next,
    training: { current: S.training, options: trOpts },
    alerts: alertsVM(S),
    unread: S.inbox.filter((i) => !i.read).length, needsAnswer: S.inbox.filter((i) => i.choices && i.ans === null).length,
    openOffers: S.offers.filter((o) => o.status === 'open').length,
    windowOpen: isWindowOpen(S.week),
    canRetire: !S.retired && ageOf(S) >= 32 && !S.inWeek && !S.live,
    canRequestTransfer: !S.retired && p.stage === 'pro' && !!p.club && !p.treq && !(p.contract && p.contract.loan),
    canReward: !S.retired && p.energy < 100 && S.ev.flags.rw !== aw,
    lastResult: lm ? { textHe: (RESULT_LABELS && RESULT_LABELS[lm.res] || lm.res) + ' ' + lm.score[0] + '-' + lm.score[1] + ' · ' + lm.home.shortHe + ' נגד ' + lm.away.shortHe, rating: lm.rating } : null,
    pending: { match: !!S.live, review: S.pending.review !== null, retire: S.retired !== null },
    // R2: coaching career after retirement (status stays 'retired'; the UI routes to #/manager while manager.active)
    manager: S.mgr ? { active: S.mgr.st !== 'done', st: S.mgr.st, openOffers: S.mgr.offers.filter((o) => o.status === 'open').length, route: S.mgr.st !== 'done' ? '#/manager' : '#/retire' } : null,
    announcementsHe: ann,
  };
}
export function getHub() { return G(hubVM(need())); }

// ---------------------------------------------------------------- competitions, tables, brackets
function compRow(S, id, kind, hasTable, hasBracket, statusHe) { return { id, he: compHe(S, id), kind, hasTable, hasBracket, statusHe }; }
function leagueStatus(S, lid) { const L = S.comp.lg[lid]; return L.r >= L.R ? 'הסתיימה' : 'מחזור ' + L.r + ' מתוך ' + L.R; }

export function getCompetitions() {
  const S = need();
  const p = focusP(S);
  const mine = [];
  if (p.club) {
    const lid = clubLeague(S, p.club);
    if (lid) mine.push(compRow(S, lid, 'league', true, false, leagueStatus(S, lid)));
    if (S.comp.yl && S.comp.yl.clubs.indexOf(p.club) >= 0) mine.push(compRow(S, S.comp.yl.id, 'youth', true, false, 'מחזור ' + S.comp.yl.r + ' מתוך ' + S.comp.yl.R));
    for (const id of cupIds()) { const Cp = S.comp.cups[id]; if (Cp && Cp.rounds.some((r) => r.some((t) => t[0] === p.club || t[1] === p.club)) || (Cp && Cp.byes.indexOf(p.club) >= 0)) mine.push(compRow(S, id, 'cup', false, true, Cp.w ? 'הסתיים' : 'בעיצומו')); }
    for (const c of EC) {
      const E = S.comp.eu[c];
      const inIt = E.lp.teams.indexOf(p.club) >= 0 || E.q.some((t) => t[0] === p.club || t[1] === p.club) || E.pend.indexOf(p.club) >= 0;
      if (inIt) mine.push(compRow(S, c, 'europe', E.lp.teams.length > 0, true, E.w ? 'הסתיים' : E.md ? 'מחזור ' + E.md + ' מתוך 8' : 'מוקדמות'));
    }
  }
  const mf = mgrFocus(S);
  const natOn = !mf || !!mf.nation;   // a club / youth manager does not follow the national team
  if (S.nt.q && natOn) mine.push(compRow(S, 'q_' + S.nt.q.tour, 'national', true, false, S.nt.q.done ? 'הסתיימו' : 'בעיצומן'));
  if (S.nt.tour && natOn) mine.push(compRow(S, S.nt.tour.key, 'national', true, true, S.nt.tour.w ? 'הסתיים' : 'בעיצומו'));
  if (S.nt.ytour && !mf) mine.push(compRow(S, S.nt.ytour.key, 'ynt', true, true, S.nt.ytour.w ? 'הסתיים' : 'בעיצומו'));
  const byC = new Map();
  for (const lg of LEAGUES) {
    if (!byC.has(lg.countryId)) byC.set(lg.countryId, []);
    byC.get(lg.countryId).push(compRow(S, lg.id, 'league', true, false, leagueStatus(S, lg.id)));
    if (lg.cup && S.comp.cups[lg.cup.id]) byC.get(lg.countryId).push(compRow(S, lg.cup.id, 'cup', false, true, S.comp.cups[lg.cup.id].w ? 'הסתיים' : 'בעיצומו'));
  }
  const leagues = Array.from(byC.keys()).map((cid) => ({ countryHe: country(cid) ? country(cid).nameHe : cid, flag: country(cid) ? country(cid).flag : '', items: byC.get(cid) }));
  const europe = EC.map((c) => { const E = S.comp.eu[c]; return compRow(S, c, 'europe', E.lp.teams.length > 0, true, E.w ? 'הסתיים' : E.md ? 'מחזור ' + E.md + ' מתוך 8' : 'מוקדמות'); });
  return G({ mine, leagues, europe });
}

const ZONE_HE = { champ: '{{אלוף|אלופה}}', ucl: 'ליגת האלופות', uel: 'הליגה האירופית', uecl: 'הקונפרנס ליג', promo: 'עלייה', releg: 'ירידה', ko: 'עלייה ישירה לשמינית', kpo: 'פלייאוף', out: 'הדחה', q: 'העפלה' };
function zoneHe(z) { return (z === 'ucl' || z === 'uel' || z === 'uecl') ? euroHe(z) : gtext(ZONE_HE[z] || z); }

function leagueZones(S, lid) {
  const lg = LEAGUE_BY_ID[lid];
  const N = S.comp.lg[lid].t.length;
  const z = new Array(N).fill(null);
  if (lg.tier === 1) z[0] = 'champ';
  if (lg.euro) {
    let i = 0;
    for (const c of EC) { const n = (lg.euro[c].lp || 0) + (lg.euro[c].q || 0); for (let k = 0; k < n && i < N; k++, i++) if (!z[i]) z[i] = c; else if (i === 0 && c === 'ucl') z[i] = 'champ'; }
  }
  if (lg.promotion) for (let i = 0; i < lg.promotion.count; i++) z[i] = 'promo';
  if (lg.relegation) for (let i = N - lg.relegation.count; i < N; i++) z[i] = 'releg';
  return z;
}

function rowsVM(S, rows, zones, mineId, variant, startRank) {
  return rows.map((r, i) => ({ rank: (startRank || 0) + i + 1, team: teamVM(r[0], variant), p: r[1], w: r[2], d: r[3], l: r[4], gf: r[5], ga: r[6], gd: r[5] - r[6], pts: r[7],
    zone: zones ? zones[(startRank || 0) + i] || null : null, mine: r[0] === mineId }));
}
function legendOf(groups) {
  const zs = new Set();
  for (const g of groups) for (const r of g.rows) if (r.zone) zs.add(r.zone);
  return Array.from(zs).map((z) => ({ zone: z, he: zoneHe(z) }));
}

export function getTable(compId, opts = {}) { return G(tableVM(compId, opts)); }
function tableVM(compId, opts = {}) {
  const S = need();
  const p = focusP(S);
  if (LEAGUE_BY_ID[compId]) {
    const L = S.comp.lg[compId];
    const f = leagueFormat(compId);
    const zones = leagueZones(S, compId);
    let groups;
    if (L.sp && f.groups) {
      let start = 0;
      groups = L.sp.map((ids, gi) => {
        const rows = rankRows(L.t.filter((r) => ids.indexOf(r[0]) >= 0));
        const g = { he: f.groups[gi].nameHe || ('בית ' + (gi + 1)), rows: rowsVM(S, rows, zones, p.club, null, start) };
        start += rows.length;
        return g;
      });
    } else groups = [{ he: 'טבלה', rows: rowsVM(S, rankRows(L.t), zones, p.club, null, 0) }];
    const lg = LEAGUE_BY_ID[compId];
    return { id: compId, he: lgNameHe(compId), groups, legend: legendOf(groups), noteHe: L.sp ? 'הליגה התפצלה לפלייאוף' : (f.groups ? 'אחרי ' + f.Rb + ' מחזורים הליגה מתפצלת' : null),
      formatHe: (FORMAT_LABELS && FORMAT_LABELS[(lg.format && lg.format.type) || 'double_rr']) || '' };
  }
  if (S.comp.yl && compId === S.comp.yl.id) {
    const rows = rankRows(S.comp.yl.t);
    const z = rows.map((_, i) => (i === 0 ? 'champ' : null));
    const groups = [{ he: 'טבלה', rows: rowsVM(S, rows, z, p.club, 'youth', 0) }];
    return { id: compId, he: compHe(S, compId), groups, legend: legendOf(groups), noteHe: null, formatHe: (FORMAT_LABELS && FORMAT_LABELS.double_rr) || '' };
  }
  if (EC.indexOf(compId) >= 0) {
    const E = S.comp.eu[compId];
    const rows = E.lp.teams.length ? rankRows(E.lp.t, (id) => cs(S, id)) : [];
    const z = rows.map((_, i) => (i < 8 ? 'ko' : i < 24 ? 'kpo' : 'out'));
    const groups = [{ he: (ROUND_NAMES && ROUND_NAMES.lp) || 'שלב הליגה', rows: rowsVM(S, rows, z, p.club, null, 0) }];
    return { id: compId, he: compHe(S, compId), groups, legend: legendOf(groups), noteHe: rows.length ? null : 'שלב הליגה טרם התחיל', formatHe: 'שלב ליגה של 36 קבוצות' };
  }
  if (S.nt.q && compId === 'q_' + S.nt.q.tour) {
    const rows = rankRows(S.nt.q.t, (id) => nstr(S, id));
    const z = rows.map((_, i) => (i < 2 ? 'q' : null));
    const groups = [{ he: 'הבית', rows: rowsVM(S, rows, z, p.nation, null, 0) }];
    return { id: compId, he: compHe(S, compId), groups, legend: legendOf(groups), noteHe: 'שתי הראשונות מעפילות', formatHe: 'בית מוקדמות' };
  }
  for (const tk of ['tour', 'ytour']) {
    const T = S.nt[tk];
    if (T && compId === T.key) {
      const v = tk === 'ytour' ? T.lvl : null;
      let gs = T.gt.map((rows, gi) => ({ he: 'בית ' + String.fromCharCode(1488 + gi), rows: rowsVM(S, rankRows(rows, (id) => tourStr(S, T, id)), rankRows(rows).map((_, i) => (i < 2 ? 'q' : null)), p.nation, v, 0) }));
      if (typeof opts.group === 'number' && gs[opts.group]) gs = [gs[opts.group]];
      return { id: compId, he: tourHe(T.key), groups: gs, legend: legendOf(gs), noteHe: null, formatHe: 'שלב הבתים' };
    }
  }
  return { id: compId, he: compHe(S, compId), groups: [], legend: [], noteHe: 'אין טבלה', formatHe: '' };
}

function tieVM(S, legs, variant, mineIds) {
  const h = legs[0][0], a = legs[0][1];
  const L = legs.map((t) => ({ score: t[2] === null ? null : [t[2], t[3]] }));
  let winner = null, aggHe = null;
  const last = legs[legs.length - 1];
  if (last[2] !== null) {
    let w;
    if (legs.length === 2) {
      w = twoLegWinner(legs[0], legs[1]);
      aggHe = 'סיכום ' + (legs[0][2] + legs[1][3]) + '-' + (legs[0][3] + legs[1][2]);
    } else w = cupTieWinner(last);
    winner = w === h ? 'home' : 'away';
    const ex = extraHe(null, last[4]);
    if (ex) aggHe = (aggHe ? aggHe + ' · ' : '') + ex;
  }
  return { home: teamVM(h, variant), away: teamVM(a, variant), legs: L, aggHe, winner, mine: mineIds.indexOf(h) >= 0 || mineIds.indexOf(a) >= 0 };
}

export function getBracket(compId) { return G(bracketVM(compId)); }
function bracketVM(compId) {
  const S = need();
  const p = focusP(S);
  const mine = [p.club, p.nation].filter(Boolean);
  const Cp = S.comp.cups[compId];
  if (Cp) {
    const rounds = [];
    for (let rd = 0; rd < Cp.rounds.length; rd++) {
      const k = cupRoundKey(Cp, rd);
      rounds.push({ key: k, he: (ROUND_NAMES && ROUND_NAMES[k]) || k, ties: (Cp.rounds[rd] || []).map((t) => tieVM(S, [t], null, mine)) });
    }
    return { id: compId, he: compHe(S, compId), rounds, winner: Cp.w ? teamVM(Cp.w) : null };
  }
  if (EC.indexOf(compId) >= 0) {
    const E = S.comp.eu[compId];
    const rounds = [];
    const two = (arr) => { const out = []; for (let i = 0; i + 1 < arr.length; i += 2) out.push(tieVM(S, [arr[i], arr[i + 1]], null, mine)); return out; };
    if (E.q.length) rounds.push({ key: 'q', he: (ROUND_NAMES && ROUND_NAMES.q) || 'מוקדמות', ties: two(E.q) });
    for (const st of ['kpo', 'r16', 'qf', 'sf']) if (E.ko[st].length) rounds.push({ key: st, he: (ROUND_NAMES && ROUND_NAMES[st]) || st, ties: two(E.ko[st]) });
    if (E.ko.f.length) rounds.push({ key: 'f', he: (ROUND_NAMES && ROUND_NAMES.f) || 'הגמר', ties: E.ko.f.map((t) => tieVM(S, [t], null, mine)) });
    return { id: compId, he: compHe(S, compId), rounds, winner: E.w ? teamVM(E.w) : null };
  }
  for (const tk of ['tour', 'ytour']) {
    const T = S.nt[tk];
    if (T && compId === T.key) {
      const v = tk === 'ytour' ? T.lvl : null;
      const rounds = [];
      for (const k of ['r32', 'r16', 'qf', 'sf', 'f']) if (T.ko[k]) rounds.push({ key: k, he: (ROUND_NAMES && ROUND_NAMES[k]) || k, ties: T.ko[k].map((t) => tieVM(S, [t], v, mine)) });
      return { id: compId, he: tourHe(T.key), rounds, winner: T.w ? teamVM(T.w, v) : null };
    }
  }
  return { id: compId, he: compHe(S, compId), rounds: [], winner: null };
}

export function getResults(compId) {
  const S = need();
  const L = S.comp.lg[compId];
  if (!L || !L.last || L.last.length === 0) return null;
  return G({ roundHe: 'מחזור ' + L.r, results: L.last.map((x) => ({ home: teamVM(x[0]), away: teamVM(x[1]), score: [x[2], x[3]] })) });
}

// ---------------------------------------------------------------- inbox
export function getInbox() { return G(inboxRows(need())); }
function findItem(S, id) { const it = S.inbox.find((x) => x.id === id); if (!it) throw new Error('unknown_inbox_id'); return it; }
export function getThread(id) { const S = need(); return G(threadVM(S, findItem(S, id))); }
export function answerEvent(id, choiceIndex) {
  const S = need();
  const it = findItem(S, id);
  const r = answerItem(S, R(), it, choiceIndex, false);
  clampStatus(S.player);
  if (r.ok) notify();
  return G({ ok: r.ok, thread: threadVM(S, it), effectsHe: r.effectsHe });
}
export function markRead(id) { const S = need(); const it = findItem(S, id); if (!it.read) { it.read = true; notify(); } }
export function markAllRead() { const S = need(); let ch = false; for (const it of S.inbox) if (!it.read) { it.read = true; ch = true; } if (ch) notify(); }

// ---------------------------------------------------------------- offers / contract
export function getOffers() {
  const S = need();
  const open = S.offers.filter((o) => o.status === 'open').slice().reverse();
  const closed = S.offers.filter((o) => o.status !== 'open').slice().reverse();
  return G(open.concat(closed).map((o) => offerVM(S, o, awLabel)));
}
export function respondOffer(id, action, counter) {
  const S = need();
  const o = S.offers.find((x) => x.id === id);
  if (!o) throw new Error('unknown_offer');
  if (['accept', 'reject', 'negotiate'].indexOf(action) < 0) throw new Error('bad_action');
  const p = S.player;
  const r = respond(S, R(), o, action, counter);
  if (action === 'reject' && o.type === 'pro' && p.stage === 'youth' && S.ev.flags._relpend) { delete S.ev.flags._relpend; releaseYouth(S); }
  clampStatus(p);
  if (r.ok) notify();
  return G({ ok: r.ok, error: r.error, status: r.status, offer: offerVM(S, o, awLabel), messageHe: r.messageHe });
}
export function requestTransfer() { const S = need(); const r = reqT(S); if (r.ok) notify(); return G(r); }
export function cancelTransferRequest() { const S = need(); const r = cancelT(S); if (r.ok) notify(); return G(r); }
export function getContract() { const S = need(); return G(contractVM(S, S.player.contract)); }

// ---------------------------------------------------------------- profile / career / national / awards / shop
const TRAIT_FLAGS = { captain: '{{קפטן|קפטנית}}', fan_favourite: '{{אהוב הקהל|אהובת הקהל}}', bad_boy: '{{ילד רע|ילדה רעה}}', charity: '{{פעיל חברתי|פעילה חברתית}}', married: '{{נשוי|נשואה}}', kids: '{{אבא|אמא}}', has_partner: 'בזוגיות', abroad: '{{משחק|משחקת}} בחו״ל' };
export function getProfile() {
  const S = need();
  const p = S.player;
  const nat = country(p.nation);
  const t = careerTotals(S);
  const st = sumLines(p.s, ALL_LINES);
  const traits = [];
  for (const k of Object.keys(TRAIT_FLAGS)) if (S.ev.flags[k]) traits.push(TRAIT_FLAGS[k]);
  if (p.treq) traits.push('{{ביקש|ביקשה}} העברה');
  return G({
    name: p.first + ' ' + p.last, nick: p.nick, age: ageOf(S), nationHe: nat ? nat.nameHe : '', flag: nat ? nat.flag : '',
    gender: p.gender === 'f' ? 'f' : 'm', look: p.look ? Object.assign({}, p.look) : null, num: p.num, pos: p.pos,
    posHe: posHeOf(p), footHe: p.foot === 'L' ? 'שמאל' : 'ימין', ovr: ovrOf(p),
    potStars: potStars(p.potSeen), potRange: p.potSeen.slice(), attrs: attrsVM(S), gk: p.pos === 'GK', value: valueOf(S), money: p.money,
    wage: p.contract ? p.contract.wage : 0, stageHe: femLabel((STAGES && STAGES[p.stage]) || p.stage), clubHe: p.club ? clubName(p.club) : 'ללא קבוצה',
    contract: contractVM(S, p.contract),
    status: { energy: p.energy, morale: p.morale, trust: p.trust, fans: p.fans, mates: p.mates, rep: { l: p.rep.l, c: p.rep.c, w: p.rep.w } },
    season: { apps: st.apps, goals: st.g, assists: st.a, avgRating: st.apps ? round1(st.rs / st.apps) : 0, motm: st.motm },
    career: { apps: t.apps, goals: t.goals, assists: t.assists, caps: t.caps, intlGoals: t.intlGoals, trophies: S.hist.trophies.length },
    owned: p.owned.map((id) => { const it = shopVM(S).cats.flatMap((c) => c.items).find((x) => x.id === id); return { id, he: it ? it.he : id }; }),
    traitsHe: traits,
  });
}
export function getCareer() {
  const S = need();
  const cv = careerVM(S, awLabel);
  cv.coach = S.mgr ? MG.coachRecord(S) : null;   // R2: coaching record (null when there is none)
  return G(cv);
}

const LVL_HE = { none: 'טרם זומנת', u17: 'נבחרת עד גיל 17', u19: 'נבחרת עד גיל 19', u21: 'נבחרת עד גיל 21', senior: 'הנבחרת הבוגרת' };
const LVL_HE_W = { none: 'טרם זומנת', u17: 'נבחרת הנערות עד גיל 17', u19: 'נבחרת הנערות עד גיל 19', u21: 'נבחרת הצעירות עד גיל 21', senior: 'נבחרת הנשים הבוגרת' };
function natLevelHe(lvl) { return (curGender() === 'f' ? LVL_HE_W : LVL_HE)[lvl] || ''; }
/** 'נבחרת ישראל' / 'נבחרת ישראל לנשים' */
function natTeamHe(S) { const n = country(S.player.nation); const nm = n ? n.nameHe : ''; return 'נבחרת ' + nm + (isF(S) ? ' לנשים' : ''); }
const STAGE_HE = { group: 'שלב הבתים', r32: 'סיבוב 32', r16: 'שמינית הגמר', qf: 'רבע הגמר', sf: 'חצי הגמר', f: 'הגמר', w: 'זכייה!', dnq: 'לא העפילה' };
export function getNational() {
  const S = need();
  const p = S.player;
  const nat = teamVM(p.nation);
  const called = S.nt.called || {};
  const isCalled = Object.keys(called).some((k) => called[k]);
  const upcoming = scheduleList(S).filter((f) => !f.result && (f.kind === 'national' || f.kind === 'friendly' || f.kind === 'ynt'));
  let tournament = null;
  const T = S.nt.tour;
  if (T) {
    const st = T.stage[p.nation];
    tournament = { key: T.key, he: tourHe(T.key), table: getTable(T.key), bracket: Object.keys(T.ko).length ? getBracket(T.key) : null,
      stageHe: !nationInTour(T, p.nation) ? STAGE_HE.dnq : st ? (st === 'w' ? STAGE_HE.w : hePrefix('הודחה ב', STAGE_HE[st] || st)) : 'בטורניר' };
  }
  const statusHe = S.retired ? 'פרשת' : isCalled ? 'זומנת לנבחרת!' : p.natLvl === 'none' ? 'עוד לא זומנת. {{תמשיך|תמשיכי}} להתקדם.' : 'לא זומנת לפגרה הנוכחית';
  return G({
    nation: nat, teamHe: natTeamHe(S), level: p.natLvl, levelHe: natLevelHe(p.natLvl), statusHe, caps: p.caps.senior, goals: p.ig.senior,
    youth: { u17: [p.caps.u17, p.ig.u17], u19: [p.caps.u19, p.ig.u19], u21: [p.caps.u21, p.ig.u21] },
    upcoming, qualifier: S.nt.q ? getTable('q_' + S.nt.q.tour) : null, tournament,
    history: S.nt.hist.slice().reverse().map((h) => ({ seasonHe: fmtSeason(h.season), he: tourHe(h.key), stageHe: STAGE_HE[h.stage] || h.stage, winnerHe: country(h.winner) ? country(h.winner).nameHe : '' })),
  });
}
export function getAwards() {
  const S = need();
  return G(awardsVM(S, () => {
    const out = [];
    const p = S.player;
    const lid = p.club ? clubLeague(S, p.club) : null;
    const ids = lid ? [lid, 'ucl'] : ['ucl'];
    for (const id of ids) {
      const b = S.comp.sc[id];
      if (b) out.push({ compHe: id === 'ucl' ? compHe(S, 'ucl') : compHe(S, id), scorerHe: b.n + ' (' + (b.club ? clubName(b.club) : '') + ') ' + b.g });
    }
    return out;
  }));
}
export function getShop() { return G(shopVM(need())); }
export function buyItem(id) { const S = need(); const r = buy(S, id); if (r.ok) notify(); return G(r); }
export function sellItem(id) { const S = need(); const r = sell(S, id); if (r.ok) notify(); return G(r); }

// ---------------------------------------------------------------- manager / coach career (R2)
// After retirement the world keeps running: every manager week simulates the whole calendar (both slots), the managed
// team's fixtures through the manager model (tactic, reputation, squad mood), then board / fans / mood, offers, season end
// and the world rollover. The player's own systems (training, events, transfers) are frozen.
function mgrOf(S) { return S.mgr || null; }
function mgrActive(S) { const M = S.mgr; return !!(M && M.st === 'active' && M.job); }
/** Team / stage override used by the schedule, tables and competitions in manager mode. */
function mgrFocus(S) {
  if (!mgrActive(S)) return null;
  const J = S.mgr.job;
  if (J.kind === 'nation') return { club: null, stage: 'pro', nation: J.team, called: { senior: true }, youth: false, nationAll: true };
  if (J.role === 'youth') return { club: J.team, stage: 'youth', nation: null, called: {}, youth: !!(S.comp && S.comp.yl && S.comp.yl.clubs.indexOf(J.team) >= 0) };
  return { club: J.team, stage: 'pro', nation: null, called: {}, youth: false };
}
/** Club / nation highlighted as "mine" in tables, brackets and competitions (the managed team in manager mode). */
function focusP(S) { const f = mgrFocus(S); return f ? { club: f.club, nation: f.nation || S.player.nation } : S.player; }
function focusClub(S) { const f = mgrFocus(S); return f ? f.club : S.player.club; }
function focusNation(S) { const f = mgrFocus(S); return f ? (f.nation || null) : S.player.nation; }

// youth coach: the club's U19 league replaces the (retired) player's youth league; a mid-season start catches up the rounds already due
function mgrYouthLeague(S) {
  const M = S.mgr;
  if (!M || !M.job || M.st !== 'active' || M.job.role !== 'youth' || !S.comp) return;
  const J = M.job;
  if (S.comp.yl && S.comp.yl.clubs.indexOf(J.team) >= 0) return;
  const Y = buildYouthLeague(S, J.team, 'u19');
  if (!Y) return;
  S.comp.yl = Y;
  const rng = R();
  const sl = leagueRoundSlots(Y.R);
  while (Y.r < Y.R && sl[Y.r] && (sl[Y.r].w < S.week)) {
    for (const [h, a] of youthRoundFixtures(S, Y.r)) { const [hg, ag] = simScore(rng, Y.str[h] || 45, Y.str[a] || 45, { neutral: false }); tableApply(Y.t, h, a, hg, ag); }
    Y.r++;
  }
}

function mgrSlotRun(S, slot, wk) {
  const rng = R();
  const week = S.week;
  const fixtures = collectFixtures(S, week, slot);
  const lgRes = {};
  let ylPlayed = false;
  for (const fx of fixtures) {
    const side = MG.mgrSide(S, fx);
    let hg, ag, extra;
    if (side) {
      const sh = sideStrength(S, fx, fx.h), sa = sideStrength(S, fx, fx.a);
      const rates = MG.mgrRates(S, fx, side, sh, sa);
      const r = MG.mgrSimFixture(S, rng, fx, side, sh, sa);
      hg = r[0]; ag = r[1]; extra = r[2];
      applyResult(S, fx, hg, ag, extra);
      const own = side === 'h' ? fx.h : fx.a, opp = side === 'h' ? fx.a : fx.h;
      const fxr = Object.assign({}, fx, { rk: roundHe(fx) || null });
      const eff = MG.onManagedResult(S, fxr, side, hg, ag, extra, rates, r[3]);
      const rec = S.mgr.res[S.mgr.res.length - 1];
      rec.big = (() => { try { return isBigPure(S, fx, own, opp); } catch (e) { return false; } })();
      wk.mine.push({ rec, eff });
    } else {
      [hg, ag, extra] = simFixture(S, rng, fx);
      applyResult(S, fx, hg, ag, extra);
    }
    if (fx.kind === 'league') (lgRes[fx.comp] = lgRes[fx.comp] || []).push([fx.h, fx.a, hg, ag]);
    if (fx.kind === 'youth') ylPlayed = true;
  }
  for (const lid of leagueIds()) if (lgRes[lid]) finishLeagueRound(S, lid, lgRes[lid]);
  if (ylPlayed && S.comp.yl) S.comp.yl.r++;
  for (const d of cupsAfterSlot(S)) {
    S.world.champs[S.season] = S.world.champs[S.season] || {};
    S.world.champs[S.season][d.cup] = d.winner;
    if (MG.onFinal(S, d.cup, 'cup', d.winner)) wk.trophies.push('cup');
  }
  for (const d of euroAfterSlot(S, week, slot)) {
    S.world.champs[S.season] = S.world.champs[S.season] || {};
    S.world.champs[S.season][d.comp] = d.winner;
    if (MG.onFinal(S, d.comp, d.comp, d.winner)) wk.trophies.push(d.comp);
  }
  for (const e of natAfterSlot(S, week, slot)) {
    if (e.type !== 'tour_done') continue;
    const T = e.T;
    if (!T.lvl || T.lvl === 'senior') {
      const n = S.player.nation;
      S.nt.hist.push({ season: S.season, key: T.key, nation: n, stage: nationInTour(T, n) ? (T.stage[n] || 'group') : 'dnq', winner: T.w });
    }
    const before = S.mgr.trophies.length;
    MG.onTournamentDone(S, T);
    if (S.mgr.trophies.length > before) wk.trophies.push(T.kind);
  }
}

function mgrWorldSeasonEnd(S) {
  S.world.champs[S.season] = S.world.champs[S.season] || {};
  for (const lid of leagueIds()) S.world.champs[S.season][lid] = leagueRanking(S, lid)[0];
  S.comp.end = { club: null, lg: null, rank: null, loan: false };
  S.comp.next = computeNextEntrants(S);
}
function mgrFinishRollover(S) {
  S.season++;
  S.week = 1;
  S.nt.tour = null; S.nt.ytour = null;
  S.player.s = emptyStats();
  S.lastMatch = null;
  buildSeason(S, false);
  if (S.mgr) { S.mgr.roll = false; mgrYouthLeague(S); MG.mgrNewSeason(S); }
}
function mgrRollover(S) {
  const rng = R();
  evolveStars(S, rng);
  const moved = promoteRelegate(S);
  const uclLp = S.comp.eu ? S.comp.eu.ucl.lp.teams : [];
  evolveClubs(S, rng, moved, uclLp);
  driftNational(S, rng);
  mgrFinishRollover(S);
}

function mgrWeek(S) {
  const M = S.mgr;
  const rng = R();
  if (M.roll) mgrFinishRollover(S);
  const wk = { season: S.season, week: S.week, dateHe: weekLabelHe(S.season, S.week), mine: [], trophies: [], lines: [], seasonEnded: false, sacked: false, offers: 0, review: null, o0: M.offers.length };
  const J0 = M.st === 'active' ? M.job : null;
  const c0 = J0 ? { conf: J0.conf, fans: J0.fans, mood: J0.mood } : null;
  if (S.week === 45) buildSummerTournament(S);
  if (J0 && J0.role === 'youth') mgrYouthLeague(S);
  if (J0 && S.week <= 40 && (!J0.obj || J0.objS !== S.season)) MG.setObjective(S, J0);
  mgrSlotRun(S, 'mw', wk);
  mgrSlotRun(S, 'wk', wk);
  const wl = MG.mgrWeekEnd(S, rng, wk.mine.length > 0);
  // the coach's lifestyle items keep costing (and investments keep paying) while coaching
  const up = weeklyUpkeep(S);
  if (up > 0) S.player.money = Math.max(0, Math.round(S.player.money - up));
  else if (up < 0) S.player.money = Math.round(S.player.money - up);
  if (wl.indexOf('sacked') >= 0) wk.sacked = true;
  if (S.week === 44) {
    mgrWorldSeasonEnd(S);
    const se = MG.mgrSeasonEnd(S, rng);
    wk.seasonEnded = true;
    if (se.sacked) wk.sacked = true;
    wk.review = se.row ? Object.assign({}, se.row) : null;
    wk.renewed = se.renewed; wk.left = se.left;
  }
  wk.offers = Math.max(0, S.mgr.offers.filter((o) => o.status === 'open' && o.aw === curAw(S)).length);
  if (J0 && c0) {
    const J = J0;
    wk.delta = { conf: round1(J.conf - c0.conf), fans: round1(J.fans - c0.fans), mood: round1(J.mood - c0.mood) };
  }
  if (S.week === 52) mgrRollover(S);
  else S.week++;
  MG.freezeTargets(S);
  return wk;
}

function weekHasManaged(S) {
  if (!mgrActive(S)) return false;
  for (const slot of ['mw', 'wk']) for (const f of collectFixtures(S, S.week, slot)) if (MG.mgrSide(S, f)) return true;
  return false;
}

function mgrResultVM(S, rec) {
  const vm = MG.resultVM(S, rec);
  const fx = { comp: rec.c, kind: rec.k, h: rec.h, a: rec.a, lvl: rec.lvl };
  vm.compHe = compHe(S, rec.c);
  vm.roundHe = rec.rd || '';
  vm.extraHe = extraHe(null, rec.x);
  vm.big = !!rec.big;
  if (rec.k === 'youth') { vm.home = teamVM(rec.h, 'youth'); vm.away = teamVM(rec.a, 'youth'); }
  else if (teamVariant(fx)) { vm.home = teamVM(rec.h, teamVariant(fx)); vm.away = teamVM(rec.a, teamVariant(fx)); }
  return vm;
}
const DELTA_HE = { conf: 'אמון', fans: 'אוהדים', mood: 'מורל' };
function mgrSummaryVM(S, wk) {
  const results = wk.mine.map((m) => {
    const vm = mgrResultVM(S, m.rec);
    vm.reel = MG.matchReel(S, m.rec);
    vm.effectsHe = [];
    const rc = Math.round(m.eff.conf), rf = Math.round(m.eff.fans);
    if (rc) vm.effectsHe.push(sgnHe(rc) + (m.rec.k === 'national' || m.rec.k === 'friendly' ? ' אמון ההתאחדות' : ' אמון ההנהלה'));
    if (rf) vm.effectsHe.push(sgnHe(rf) + ' אוהדים');
    if (m.eff.derby) vm.effectsHe.push('דרבי!');
    return vm;
  });
  const lines = [];
  if (wk.sacked) lines.push(gtext('פוטרת מהתפקיד. הדרכים נפרדות.'));
  if (wk.offers) lines.push(wk.offers === 1 ? 'הגיעה הצעת עבודה חדשה' : 'הגיעו ' + wk.offers + ' הצעות עבודה חדשות');
  for (const k of wk.trophies) lines.push('🏆 ' + trophyHe(k) + '!');
  if (wk.renewed) lines.push('החוזה הוארך בשנתיים');
  if (wk.left) lines.push('החוזה לא חודש');
  if (wk.delta) for (const k of ['conf', 'fans', 'mood']) if (Math.abs(wk.delta[k]) >= 1) lines.push(DELTA_HE[k] + ' ' + sgnHe(Math.round(wk.delta[k])));
  const rv = wk.review;
  return {
    dateHe: wk.dateHe, season: wk.season, week: wk.week, results, linesHe: lines, seasonEnded: wk.seasonEnded, sacked: wk.sacked, newOffers: wk.offers,
    review: rv ? { seasonHe: fmtSeason(rv.s), rank: rv.rank, met: rv.met, games: rv.g, w: rv.w, d: rv.d, l: rv.l, gf: rv.gf, ga: rv.ga, trophies: (rv.tr || []).map((k) => trophyHe(k)) } : null,
    status: S.mgr.st,
  };
}

function mgrScheduleList(S) {
  const ov = mgrFocus(S);
  if (!ov) return [];
  const map = new Map();
  for (const r of S.mgr.res) {
    const vm = mgrResultVM(S, r);
    map.set(r.w + '-' + r.s, { vm: { key: vm.key, week: r.w, slot: r.s, dateHe: vm.dateHe, comp: r.c, compHe: vm.compHe, kind: r.k, roundHe: vm.roundHe, home: vm.home, away: vm.away, isHome: vm.isHome, big: !!r.big, selection: 'unknown',
      result: { score: [r.hg, r.ag], extraHe: vm.extraHe, rating: null, res: r.res } }, w: r.w, s: r.s });
  }
  for (const u of upcomingFixtures(S, ov)) {
    const k = u.week + '-' + u.slot;
    if (map.has(k)) continue;
    const vm = fxVM(S, u.f, u.week, u.slot, null, u.isHome);
    if (u.f.kind === 'youth') { vm.home = teamVM(u.f.h, 'youth'); vm.away = teamVM(u.f.a, 'youth'); }
    map.set(k, { vm, w: u.week, s: u.slot });
  }
  return Array.from(map.values()).sort((a, b) => (a.w - b.w) || ((a.s === 'mw' ? 0 : 1) - (b.s === 'mw' ? 0 : 1))).map((x) => x.vm);
}
function mgrTableSnippet(S) {
  if (!mgrActive(S)) return null;
  const J = S.mgr.job;
  let id = null;
  if (J.kind === 'nation') id = S.nt.q && S.nt.q.grp.indexOf(J.team) >= 0 ? 'q_' + S.nt.q.tour : null;
  else if (J.role === 'youth') id = S.comp.yl ? S.comp.yl.id : null;
  else id = clubLeague(S, J.team);
  if (!id) return null;
  const t = tableVM(id, {});
  const rows = [];
  for (const g of t.groups) for (const r of g.rows) rows.push(r);
  const i = rows.findIndex((r) => r.mine);
  const from = Math.max(0, Math.min(rows.length - 5, i - 2));
  return { id, he: t.he, rows: i >= 0 ? rows.slice(from, from + 5) : rows.slice(0, 5), size: rows.length };
}

function mgrBusy(S) {
  const M = mgrOf(S);
  if (!S.retired || !M) return { ok: false, error: 'no_manager', messageHe: gtext('קריירת האימון מתחילה אחרי הפרישה') };
  if (M.st === 'offers') return { ok: false, error: 'offers_pending', messageHe: gtext('{{בחר|בחרי}} קודם תפקיד מתוך ההצעות') };
  if (M.st === 'done') return { ok: false, error: 'done', messageHe: 'קריירת האימון הסתיימה' };
  return null;
}

/** Manager mode is on (coaching offers pending, active job or between jobs). */
export function isManager() { const S = C.S; return !!(S && S.retired && S.mgr && S.mgr.st !== 'done'); }
/** ManagerVM or null (no coaching career). Pure. */
export function getManager() {
  const S = need();
  if (!S.mgr) return null;
  const sched = mgrActive(S) ? mgrScheduleList(S) : [];
  const thisWeek = sched.filter((f) => f.week === S.week && !f.result);
  const next = thisWeek.length ? thisWeek[0] : (sched.find((f) => f.week > S.week && !f.result) || null);
  let oppStrength = null;
  if (next && mgrActive(S)) {
    const J = S.mgr.job;
    const opp = next.home.id === J.team ? next.away.id : next.home.id;
    const fx = { kind: next.kind, comp: next.comp, lvl: null };
    try { oppStrength = next.kind === 'youth' ? ((S.comp.yl && S.comp.yl.str[opp]) || 45) : sideStrength(S, fx, opp); } catch (e) { oppStrength = null; }
  }
  return G(MG.managerVM(S, { thisWeek, next, table: mgrTableSnippet(S), oppStrength }));
}
/** Coaching offers a career with this legacy would get (pure preview; used by tests and the retirement screen). */
export function previewCoachingOffers(legacy) {
  const S = need();
  const r = MG.retirementOfferSpecs(S, Number(legacy) || 0);
  return G({ band: r.band, offers: r.specs.map((o) => ({ team: o.kind === 'nation' ? teamVM(o.team) : teamVM(o.team), kind: o.kind, role: o.role, strength: Math.round(o.kind === 'nation' ? nstr(S, o.team) : cs(S, o.team)), tier: MG.jobTier(S, o), wage: o.wage })) });
}
/** Retired v2 careers (or any retired career without a coaching state) get their offers now. */
export function ensureCoachingOffers() {
  const S = need();
  if (!S.retired) return { ok: false, error: 'not_retired' };
  if (S.mgr) return { ok: true, created: false };
  // a forced retirement happens inside the week-52 rollover: the world already rolled, only the season switch is pending
  MG.initRetirementOffers(S, S.week === 52 && !!S.retired && S.retired.week === 52 && S.retired.reason !== 'voluntary');
  notify();
  return { ok: true, created: true };
}
export function mgrRespondOffer(id, action) {
  const S = need();
  const M = mgrOf(S);
  if (!S.retired || !M) return { ok: false, error: 'no_manager' };
  const o = M.offers.find((x) => x.id === id);
  if (!o) throw new Error('unknown_offer');
  if (o.status !== 'open') return G({ ok: false, error: 'closed', messageHe: 'ההצעה כבר לא בתוקף' });
  if (action === 'reject') { o.status = 'rejected'; notify(); return G({ ok: true, status: 'rejected' }); }
  if (action !== 'accept') throw new Error('bad_action');
  if (M.st === 'done') return G({ ok: false, error: 'done', messageHe: 'קריירת האימון הסתיימה' });
  if (M.roll) mgrFinishRollover(S);
  if (M.job) { MG.endJob(S, 'moved'); }
  const J = MG.startJob(S, o);
  mgrYouthLeague(S);
  if (J.role === 'youth' && S.week <= 40) MG.setObjective(S, J);
  notify();
  return G({ ok: true, status: 'accepted' });
}
/** Turn down every coaching offer at retirement: the career ends as a player only. */
export function declineCoaching() {
  const S = need();
  const M = mgrOf(S);
  if (!S.retired || !M || M.st !== 'offers') return { ok: false };
  for (const o of M.offers) if (o.status === 'open') o.status = 'rejected';
  M.st = 'done';
  M.ended = { season: S.season, week: S.week, age: ageOf(S), reason: 'declined' };
  notify();
  return { ok: true };
}
export function mgrSetTactic(id) {
  const S = need();
  const M = mgrOf(S);
  if (!M || MG.TACTIC_IDS.indexOf(id) < 0) return { ok: false };
  M.tactic = id;
  notify();
  return { ok: true };
}
/** Play one manager week. Returns { ok, summary } (summary.results[i].reel = the watch-mode reel). */
export function mgrAdvance(tactic) {
  const S = need();
  const e = mgrBusy(S);
  if (e) return G(e);
  if (tactic && MG.TACTIC_IDS.indexOf(tactic) >= 0) S.mgr.tactic = tactic;
  const wk = mgrWeek(S);
  const summary = mgrSummaryVM(S, wk);
  notify();
  return G({ ok: true, summary });
}
/** until: 'next_match' (stops before a week with a managed match) | 'season_end' | 'season_start' | 'weeks' */
export function mgrFastForward(opts = {}) {
  const S = need();
  const e = mgrBusy(S);
  if (e) return G(e);
  const until = opts.until || 'next_match';
  const maxW = typeof opts.maxWeeks === 'number' && opts.maxWeeks > 0 ? opts.maxWeeks : 60;
  const nW = typeof opts.weeks === 'number' ? opts.weeks : 1;
  const summaries = [];
  let weeks = 0, stopped = null;
  const s0 = S.season;
  for (;;) {
    if (S.mgr.st === 'done') { stopped = 'done'; break; }
    if (until === 'next_match' && weeks > 0 && weekHasManaged(S)) { stopped = 'until'; break; }
    if (until === 'season_start' && S.week === 1 && (S.season > s0 || weeks > 0)) { stopped = 'until'; break; }
    if (until === 'weeks' && weeks >= nW) { stopped = 'until'; break; }
    if (weeks >= maxW) { stopped = 'chunk'; break; }
    const wk = mgrWeek(S);
    weeks++;
    const sm = mgrSummaryVM(S, wk);
    summaries.push(sm);
    if (wk.sacked) { stopped = 'sacked'; break; }
    if (wk.seasonEnded && until !== 'season_start') { stopped = 'review'; break; }
    if (wk.offers > 0) { stopped = 'offer'; break; }
    if (until === 'next_match' && wk.mine.length > 0) { stopped = 'until'; break; }
  }
  notify();
  return G({ ok: true, weeks, stopped, summaries: summaries.slice(-10) });
}
export function mgrRequestBudget() {
  const S = need();
  const e = mgrBusy(S);
  if (e) return G(e);
  const r = MG.requestBudget(S, R());
  if (r.ok) notify();
  return G(r);
}
export function mgrSign(targetId) {
  const S = need();
  const e = mgrBusy(S);
  if (e) return G(e);
  const r = MG.signTarget(S, targetId);
  if (r.ok) notify();
  return G(r);
}
export function mgrAckReview() {
  const S = need();
  const M = mgrOf(S);
  if (!M || M.rv === null) return { ok: false };
  M.rv = null;
  notify();
  return { ok: true };
}
/** Retire from coaching (the Hall of Fame entry then shows player + coach). */
export function mgrRetire() {
  const S = need();
  const M = mgrOf(S);
  if (!S.retired || !M || M.st === 'done') return { ok: false, error: 'no_manager' };
  if (M.st === 'offers') return declineCoaching();
  MG.retireCoach(S, 'voluntary');
  notify();
  return { ok: true };
}
/** Watch-mode reel of a managed result (key from ManagerVM.recent / schedule). Pure. */
export function getMatchReel(key) {
  const S = need();
  const M = mgrOf(S);
  if (!M) return null;
  const r = M.res.find((x) => S.season + '-' + x.w + '-' + x.s + '-' + x.c === key) || M.res.find((x) => S.season + '-' + x.w + '-' + x.s === key);
  if (!r) return null;
  const vm = mgrResultVM(S, r);
  vm.reel = MG.matchReel(S, r);
  return G(vm);
}

// ---------------------------------------------------------------- persistence
export function serialize() {
  const S = need();
  S.rng = C.rng.getState();
  return S;
}
export function getSaveMeta() {
  const S = need();
  const p = S.player;
  const nat = country(p.nation);
  return G({
    careerId: S.id, name: p.first + ' ' + p.last, nick: p.nick || '', nation: p.nation, flag: nat ? nat.flag : '', pos: p.pos,
    posHe: posHeOf(p), age: ageOf(S), ovr: ovrOf(p), clubId: p.club || (mgrActive(S) && S.mgr.job.kind === 'club' ? S.mgr.job.team : null),
    clubHe: p.club ? clubName(p.club) : mgrActive(S) ? MG.roleHe(S, S.mgr.job) + ' · ' + MG.teamNameHe(S, S.mgr.job.team) : (S.mgr && S.mgr.st === 'unemployed' ? '{{מאמן|מאמנת}} ללא קבוצה' : (S.retired ? '{{פרש|פרשה}}' : 'ללא קבוצה')),
    manager: S.mgr ? { st: S.mgr.st, active: S.mgr.st !== 'done', team: mgrActive(S) ? S.mgr.job.team : null, kind: mgrActive(S) ? S.mgr.job.kind : null } : null, season: S.season, week: S.week, dateHe: weekLabelHe(S.season, S.week),
    stage: p.stage, retired: !!S.retired, seasons: S.season - S.startSeason + 1,
    gender: p.gender === 'f' ? 'f' : 'm', look: p.look ? Object.assign({}, p.look) : null, num: p.num,
  });
}
export function loadState(data) {
  try {
    if (!data || typeof data !== 'object' || data.v !== SCHEMA_VERSION) return { ok: false, error: 'bad_state', messageHe: 'השמירה לא תקינה' };
    if (typeof data.econ !== 'number' || !(data.econ > 0)) data.econ = 1;
    if (data.player && typeof data.player === 'object') {
      if (data.player.gender !== 'f') data.player.gender = 'm';
      if (!('look' in data.player)) data.player.look = null;
      if (typeof data.player.num !== 'number') data.player.num = defaultShirt(data.player.pos);
    }
    if (!('mgr' in data)) data.mgr = null;
    for (const k of STATE_KEYS) if (!(k in data)) return { ok: false, error: 'bad_state', messageHe: 'השמירה לא תקינה' };
    if (!data.player || !data.world || !data.comp) return { ok: false, error: 'bad_state', messageHe: 'השמירה לא תקינה' };
    if (!data.ev.carry) data.ev.carry = [];
    C.S = data;
    C.rng = createRng(data.rng >>> 0);
    C.sig = [];
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'bad_state', messageHe: 'השמירה לא תקינה' };
  }
}
export function compactState(level) {
  const S = need();
  const lv = Math.max(1, Math.min(3, Number(level) || 1));
  // always rules
  pruneMatches(S, S.season - 1);
  if (S.inbox.length > 80) S.inbox = S.inbox.slice(-80);
  const aw = curAw(S);
  S.offers = S.offers.filter((o) => o.status === 'open' || aw - (o.cl || o.aw) <= 4);
  if (S.lastMatch && S.lastMatch.log) delete S.lastMatch.log;
  const myL = S.player.club ? clubLeague(S, S.player.club) : null;
  if (lv >= 1) {
    pruneMatches(S, S.season);
    if (S.comp && S.comp.lg) for (const lid of Object.keys(S.comp.lg)) if (lid !== myL) S.comp.lg[lid].last = [];
  }
  if (lv >= 2) {
    if (S.inbox.length > 25) S.inbox = S.inbox.slice(-25);
    S.hist.timeline = S.hist.timeline.filter((e) => e.icon !== 'info');
  }
  if (lv >= 3) {
    S.hist.matches = [];
    for (const k of Object.keys(S.ev.cd)) if (S.ev.cd[k] < aw - 104) delete S.ev.cd[k];
  }
  return serialize();
}

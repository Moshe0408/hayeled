// Coaching career after retirement (v2.1, R2). Pure and deterministic: all randomness comes from the main rng passed in
// by the facade or from rngFor(...) streams; no DOM, no clock. The weekly world loop itself lives in game.js; this module
// owns S.mgr: offers, jobs, objectives, tactics, the managed-match model, board / fans / squad mood, transfers,
// season evaluation, sackings, trophies and awards as a manager, and the view models.
import { rngFor } from '../core/rng.js';
import { LEAGUES, LEAGUE_BY_ID } from '../data/leagues.js';
import { COUNTRY_BY_ID } from '../data/countries.js';
import { clamp, round1, sortIds, gtext, fmtMoney, fmtSeason, econOf, sigRound, hePrefix } from './util.js';
import { curAw, emit } from './state.js';
import { cs, clubData, clubLeague, clubName, clubCountry, teamVM, leagueMembers, leagueRanking, leagueRankOf, lgNameHe, lgYouthHe, genName, poolOfCountry, nameForG, rankRows, leagueIds } from './world.js';
import { nstr, qualifierQualified } from './national.js';
import { lambdas, simPenalties } from './sim.js';
import { isWindowOpen, weekLabelHe } from './calendar.js';
import { ageOf } from './player.js';
import { addTimeline, trophyLabel, awardLabel } from './history.js';
import { sysMsg } from './narrative.js';

// ---------------------------------------------------------------- constants
export const TACTIC_IDS = ['attack', 'balanced', 'defend', 'press', 'counter'];
export const TACTICS = {
  attack: { he: 'התקפי', desc: 'הרבה שחקנים בהתקפה ולחץ על השער. יותר שערים לשני הצדדים, מצוין נגד קבוצות חלשות.', ico: 'attack' },
  balanced: { he: 'מאוזן', desc: 'שיטה בטוחה בלי הפתעות. מתאימה לכל יריבה.', ico: 'balanced' },
  defend: { he: 'הגנתי', desc: 'קו הגנה נמוך וסגור. מעט שערים, טוב כשהיריבה חזקה יותר.', ico: 'defend' },
  press: { he: 'לחץ גבוה', desc: 'לוחצים מהדקה הראשונה וחוטפים כדורים גבוה. מתיש: אחרי כמה שבועות הגוף מרגיש את זה.', ico: 'press' },
  counter: { he: 'התקפות מתפרצות', desc: 'מחכים לטעות ויוצאים מהר קדימה. נשק מסוכן נגד קבוצות חזקות.', ico: 'counter' },
};
const ROLE_HE = {
  head: '{{מאמן ראשי|מאמנת ראשית}}', assistant: '{{עוזר מאמן|עוזרת מאמן}}', youth: '{{מאמן הנוער|מאמנת הנערות}}', nation: '{{מאמן הנבחרת|מאמנת הנבחרת}}',
};
const OBJ_HE = {
  title: 'לזכות באליפות', europe: 'לסיים במקום שמוביל לאירופה', top_half: 'לסיים בחצי העליון של הטבלה', survive: 'להישאר בליגה',
  promotion: 'לעלות ליגה', support: 'לעזור לקבוצה לעמוד ביעד העונה', youth_top: 'לפתח את הכישרונות ולסיים גבוה {{בליגת הנוער|בליגת הנערות}}',
  qualify: 'להעפיל לטורניר הגדול', friendlies: 'לבנות את הנבחרת במשחקי הידידות', none: 'להכיר את הקבוצה',
};
const END_HE = { sacked: 'פוטר', resigned: 'עזב', moved: 'עבר לתפקיד חדש', contract: 'החוזה הסתיים', retired: 'פרש מאימון' };
const END_HE_F = { sacked: 'פוטרה', resigned: 'עזבה', moved: 'עברה לתפקיד חדש', contract: 'החוזה הסתיים', retired: 'פרשה מאימון' };
const MGR_TROPHY_PTS = { league: 10, league2: 4, cup: 4, ucl: 26, uel: 12, uecl: 6, wc: 40, euro: 28, copa: 28, afcon: 16, asian: 16, gold: 16, youth_league: 2 };
export const MAX_SIGN_PER_WINDOW = 2;
const SACK_CONF = 15;

// ---------------------------------------------------------------- small helpers
const isFem = (S) => !!(S && S.player && S.player.gender === 'f');
function gt(S, s) { return gtext(s, isFem(S) ? 'f' : 'm'); }
function nextMid(S) { const M = S.mgr; M.ctr = (M.ctr || 0) + 1; return 'mo' + M.ctr; }
export function isNationTeam(id) { return !!COUNTRY_BY_ID[id] && !clubData(id); }
/** Display name of a managed team (national teams: "נבחרת ישראל" / "נבחרת ישראל לנשים"). */
export function teamNameHe(S, id) {
  if (isNationTeam(id)) { const c = COUNTRY_BY_ID[id]; return 'נבחרת ' + (c ? c.nameHe : id) + (isFem(S) ? ' לנשים' : ''); }
  return clubName(id);
}
function teamStr(S, id) { return isNationTeam(id) ? nstr(S, id) : cs(S, id); }
function leagueOfTeam(S, id) { return isNationTeam(id) ? null : clubLeague(S, id); }
function roleKey(J) { return J.kind === 'nation' ? 'nation' : J.role; }
export function roleHe(S, J) { return gt(S, ROLE_HE[roleKey(J)] || ROLE_HE.head); }
function wageFor(S, s, role, kind) {
  const mul = kind === 'nation' ? 0.8 : role === 'assistant' ? 0.35 : role === 'youth' ? 0.2 : 1;
  return Math.max(Math.round(300 * econOf(S)), sigRound(900 * Math.pow(1.11, s - 45) * mul * econOf(S), 2));
}
const TOP5 = ['eng1', 'esp1', 'ita1', 'ger1', 'fra1'];
export function isTop5(lid) { return TOP5.indexOf(lid) >= 0; }

/** Tier label of a job for telemetry / UI: national | elite | top | lower | assistant | youth */
export function jobTier(S, J) {
  if (J.kind === 'nation') return 'national';
  if (J.role === 'assistant') return 'assistant';
  if (J.role === 'youth') return 'youth';
  const lg = LEAGUE_BY_ID[leagueOfTeam(S, J.team)];
  const s = cs(S, J.team);
  if (lg && lg.tier === 1 && s >= 78) return 'elite';
  if (lg && lg.tier === 1 && s >= 64) return 'top';
  return 'lower';
}

export function createMgr(S) {
  return {
    v: 1, st: 'offers', rep: 30, offers: [], job: null, tactic: 'balanced', seasons: [], trophies: [], awards: [], jobs: [],
    res: [], tot: { g: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }, ctr: 0, rv: null, ended: null, roll: false, press: 0, legacy0: 0, wk: null,
  };
}

// ---------------------------------------------------------------- offers
function clubPool(S, pred) {
  const out = [];
  for (const lid of leagueIds()) for (const id of leagueMembers(S, lid)) if (pred(id, LEAGUE_BY_ID[lid])) out.push(id);
  return out;
}
function formerClubs(S) {
  const seen = new Set(); const out = [];
  for (let i = S.hist.clubs.length - 1; i >= 0; i--) { const c = S.hist.clubs[i].club; if (!seen.has(c) && clubData(c) && clubLeague(S, c)) { seen.add(c); out.push(c); } }
  return out;   // most recent first
}
function offerSpec(S, team, kind, role, src, why) {
  const s = teamStr(S, team);
  return { team, kind, role: kind === 'nation' ? 'head' : role, wage: wageFor(S, s, role, kind), years: kind === 'nation' ? 2 : role === 'head' ? 2 + (s >= 75 ? 1 : 0) : 2, src, why: why || '' };
}
function pickFrom(rng, list, used) {
  const c = list.filter((x) => !used.has(x));
  if (!c.length) return null;
  const x = rng.pick(sortIds(c));
  used.add(x);
  return x;
}
function sortByNear(S, ids, target) { return ids.slice().sort((a, b) => (Math.abs(cs(S, a) - target) - Math.abs(cs(S, b) - target)) || (a < b ? -1 : 1)); }

/** Legacy band of a retiring player: 'legend' | 'good' | 'average'. */
export function legacyBand(L) { return L >= 320 ? 'legend' : L >= 110 ? 'good' : 'average'; }

/**
 * Coaching offers when the player retires. Deterministic in (career id, legacy). Pure (no state change).
 * legend -> head coach of a big club + the national team; good -> assistant at a big club / head coach lower down;
 * average -> youth coach / lower-league head coach.
 */
export function retirementOfferSpecs(S, legacyOverride) {
  const p = S.player;
  const L = typeof legacyOverride === 'number' ? legacyOverride : (S.retired && Number.isFinite(S.retired.legacy) ? S.retired.legacy : 0);
  const fame = (p.rep && p.rep.w) || 0;
  // a preview with an explicit legacy (tests, UI hints) ignores fame / trophies so the band depends on the legacy only
  const band = legacyBand(typeof legacyOverride === 'number' ? L : L + fame * 0.6 + S.hist.trophies.length * 3);
  const rng = rngFor(S.id, 'mgr-retire', Math.round(L));
  const used = new Set();
  const out = [];
  const former = formerClubs(S);
  const homeLeagues = (COUNTRY_BY_ID[p.nation] && COUNTRY_BY_ID[p.nation].leagues) || [];
  const big = clubPool(S, (id, lg) => lg.tier === 1 && cs(S, id) >= 80);
  const top = clubPool(S, (id, lg) => lg.tier === 1 && cs(S, id) >= 70 && cs(S, id) < 82);
  const mid = clubPool(S, (id, lg) => lg.tier === 1 && cs(S, id) >= 60 && cs(S, id) < 72);
  const lower = clubPool(S, (id, lg) => lg.tier === 2 || cs(S, id) < 60);
  const homeLower = lower.filter((id) => homeLeagues.indexOf(clubLeague(S, id)) >= 0);
  const homeAny = clubPool(S, (id, lg) => homeLeagues.indexOf(lg.id) >= 0);
  const formerIn = (pool) => former.filter((c) => pool.indexOf(c) >= 0 && !used.has(c));
  const add = (team, kind, role, why) => { if (team && out.length < 4) { used.add(team); out.push(offerSpec(S, team, kind, role, 'retire', why)); } };
  const natOk = !!COUNTRY_BY_ID[p.nation];
  if (band === 'legend') {
    const fb = formerIn(big.concat(top));
    add(fb.length ? fb[0] : pickFrom(rng, big, used), 'club', 'head', fb.length ? 'home' : 'big');
    if (natOk) add(p.nation, 'nation', 'head', 'nation');
    add(pickFrom(rng, big.length > 2 ? big : top, used), 'club', 'head', 'big');
    if (out.length < 3) add(pickFrom(rng, top, used), 'club', 'head', 'top');
  } else if (band === 'good') {
    const fb = formerIn(big.concat(top));
    add(fb.length ? fb[0] : pickFrom(rng, top.length ? top : big, used), 'club', 'assistant', fb.length ? 'home' : 'top');
    const hl = homeLower.length ? homeLower : lower;
    add(pickFrom(rng, sortByNear(S, hl, 58).slice(0, 6), used), 'club', 'head', 'lower');
    if (L >= 200) add(pickFrom(rng, mid, used), 'club', 'head', 'mid');
    if (natOk && L >= 230 && nstr(S, p.nation) < 66) add(p.nation, 'nation', 'head', 'nation');
    if (out.length < 3) add(pickFrom(rng, mid.length ? mid : lower, used), 'club', 'head', 'mid');
  } else {
    const fy = former.filter((c) => !used.has(c));
    add(fy.length ? fy[0] : pickFrom(rng, homeAny.length ? homeAny : mid, used), 'club', 'youth', fy.length ? 'home' : 'youth');
    const hl = homeLower.length ? homeLower : lower;
    add(pickFrom(rng, sortByNear(S, hl, 48).slice(0, 6), used), 'club', 'head', 'lower');
    add(pickFrom(rng, sortByNear(S, hl.length > 3 ? hl : lower, 55).slice(0, 8), used), 'club', 'assistant', 'lower');
  }
  return { band, specs: out };
}

/** Offers while coaching / unemployed. target: club strength that fits the manager's reputation. */
function careerOfferSpecs(S, rng, src, n, shift) {
  const M = S.mgr;
  const J = M.job;
  const target = 46 + M.rep * 0.44 + (shift || 0);
  const used = new Set(J ? [J.team] : []);
  for (const o of M.offers) if (o.status === 'open') used.add(o.team);
  const pool = clubPool(S, (id) => !used.has(id) && Math.abs(cs(S, id) - target) <= 4.5);
  const out = [];
  const near = sortIds(pool);
  for (let i = 0; i < n && near.length; i++) {
    const id = pickFrom(rng, near, used);
    if (!id) break;
    out.push(offerSpec(S, id, 'club', 'head', src, cs(S, id) > (J ? teamStr(S, J.team) : 0) + 2 ? 'step_up' : 'fit'));
  }
  const nat = S.player.nation;
  if (src === 'season' && COUNTRY_BY_ID[nat] && !used.has(nat) && M.rep >= 58 && !(J && J.kind === 'nation') && rng.chance(0.35)) out.push(offerSpec(S, nat, 'nation', 'head', src, 'nation'));
  return out;
}

function pushOffer(S, spec, exp) {
  const M = S.mgr;
  const o = Object.assign({ id: nextMid(S), aw: curAw(S), status: 'open', exp: exp === undefined ? curAw(S) + 3 : exp }, spec);
  M.offers.push(o);
  if (M.offers.length > 30) M.offers = M.offers.filter((x) => x.status === 'open').concat(M.offers.filter((x) => x.status !== 'open').slice(-12));
  const who = o.kind === 'nation' ? 'federation' : 'board';
  const msg = (o.kind === 'nation' ? 'ההתאחדות' : 'הנהלת ' + clubName(o.team)) + ' רוצה אותך כ' + roleHe(S, o) + (o.kind === 'nation' ? (isFem(S) ? ' לנשים' : '') : '') + '. ההצעה מחכה לך בתיבת ההצעות.';
  if (o.src !== 'retire') sysMsg(S, who, gt(S, msg), true);
  return o;
}

/** Called once when the player retires (or for a retired v2 career). */
export function initRetirementOffers(S, roll) {
  if (S.mgr) return S.mgr;
  S.mgr = createMgr(S);
  const M = S.mgr;
  const L = S.retired && Number.isFinite(S.retired.legacy) ? S.retired.legacy : 0;
  M.legacy0 = L;
  M.roll = !!roll;
  const p = S.player;
  M.rep = round1(clamp(16 + L / 9 + (p.rep ? p.rep.w : 0) * 0.15, 12, 72));
  const r = retirementOfferSpecs(S);   // no override: the band combines legacy, fame and trophies (R2)
  M.band = r.band;
  for (const sp of r.specs) pushOffer(S, sp, null);
  return M;
}

export function expireOffers(S) {
  const M = S.mgr;
  const aw = curAw(S);
  for (const o of M.offers) if (o.status === 'open' && o.exp !== null && aw > o.exp) o.status = 'expired';
}

// ---------------------------------------------------------------- objectives
function euroSpots(lg) {
  if (!lg.euro) return 0;
  let n = 0;
  for (const c of ['ucl', 'uel', 'uecl']) if (lg.euro[c]) n += (lg.euro[c].lp || 0) + (lg.euro[c].q || 0);
  return n;
}
/** Expected league rank of a club by current strength (1 = favourite). */
export function expectedRank(S, team) {
  const lid = clubLeague(S, team);
  if (!lid) return null;
  const ids = leagueMembers(S, lid).slice().sort((a, b) => (cs(S, b) - cs(S, a)) || (a < b ? -1 : 1));
  return ids.indexOf(team) + 1;
}
export function objectiveFor(S, J) {
  if (J.kind === 'nation') {
    const q = S.nt.q;
    if (q && q.grp.indexOf(J.team) >= 0) return { key: 'qualify', target: 2 };
    return { key: 'friendlies', target: null };
  }
  if (J.role === 'youth') {
    const Y = S.comp && S.comp.yl && S.comp.yl.clubs.indexOf(J.team) >= 0 ? S.comp.yl : null;
    if (!Y) return { key: 'youth_top', target: null };
    const ids = Y.clubs.slice().sort((a, b) => ((Y.str[b] || 0) - (Y.str[a] || 0)) || (a < b ? -1 : 1));
    return { key: 'youth_top', target: Math.min(Y.clubs.length, Math.max(3, ids.indexOf(J.team) + 1 + 1)) };
  }
  const lid = clubLeague(S, J.team);
  const lg = LEAGUE_BY_ID[lid];
  if (!lg) return { key: 'none', target: null };
  const N = leagueMembers(S, lid).length;
  const exp = expectedRank(S, J.team);
  let o;
  if (lg.tier === 2) {
    const pc = lg.promotion ? lg.promotion.count : 2;
    if (exp <= pc + 1) o = { key: 'promotion', target: pc };
    else if (exp <= Math.ceil(N / 2)) o = { key: 'top_half', target: Math.ceil(N / 2) };
    else o = { key: 'survive', target: N - 3 };
  } else {
    const spots = Math.max(2, euroSpots(lg));
    const rel = lg.relegation ? lg.relegation.count : 2;
    if (exp === 1) o = { key: 'title', target: 1 };
    else if (exp <= spots) o = { key: 'europe', target: spots };
    else if (exp <= Math.ceil(N / 2)) o = { key: 'top_half', target: Math.ceil(N / 2) };
    else o = { key: 'survive', target: N - rel };
  }
  if (J.role === 'assistant') o = { key: 'support', target: o.target, base: o.key };
  return o;
}
export function setObjective(S, J) {
  const o = objectiveFor(S, J);
  J.obj = o.key; J.objT = o.target; J.objB = o.base || null; J.objS = S.season;
  J.exp = J.kind === 'club' ? expectedRank(S, J.team) : null;
}
export function objHe(S, J) {
  if (!J || !J.obj) return '';
  let t = OBJ_HE[J.obj] || '';
  if ((J.obj === 'europe' || J.obj === 'top_half' || J.obj === 'survive' || J.obj === 'support' || J.obj === 'youth_top') && J.objT) t += ' (עד מקום ' + J.objT + ')';
  if (J.obj === 'promotion' && J.objT) t += ' (מקומות 1-' + J.objT + ')';
  if (J.obj === 'qualify') t += ' (2 הראשונות בבית)';
  return gt(S, t);
}
/** Current rank of the managed team in its main table, or null. */
export function currentRank(S, J) {
  if (!J || !S.comp) return null;
  if (J.kind === 'nation') { const qq = S.nt.q && S.nt.q.grp.indexOf(J.team) >= 0 ? qualifierQualified(S) : null; return qq ? qq.rank : null; }
  if (J.role === 'youth') {
    const Y = S.comp.yl;
    if (!Y || Y.clubs.indexOf(J.team) < 0) return null;
    return rankRows(Y.t).map((r) => r[0]).indexOf(J.team) + 1 || null;
  }
  const lid = clubLeague(S, J.team);
  return lid ? leagueRankOf(S, lid, J.team) : null;
}
function objMet(S, J, rank) {
  if (!J.obj || J.obj === 'none') return true;
  if (J.obj === 'friendlies') { const s = J.ss; const n = s.w + s.d + s.l; return n === 0 || (s.w * 3 + s.d) >= n * 1.2; }
  if (rank === null) return true;
  return rank <= (J.objT || 99);
}
export function objStatus(S, J) {
  if (!J || !J.obj || J.obj === 'none' || J.obj === 'friendlies') return 'on';
  const rank = currentRank(S, J);
  if (rank === null) return 'on';
  const t = J.objT || 99;
  return rank <= t ? 'on' : rank <= t + 2 ? 'risk' : 'off';
}

// ---------------------------------------------------------------- jobs
function freshSS() { return { g: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, tr: [] }; }
function clubBudget(S, team) { const c = S.world.clubs[team]; return c ? sigRound(c.b * 1e6 * 0.22 * econOf(S), 2) : 0; }

/** Start a job from an accepted offer (objectives start right away while the season is still running). */
export function startJob(S, o) {
  const M = S.mgr;
  const p = S.player;
  const former = formerClubs(S).indexOf(o.team) >= 0;
  const legend = M.legacy0 >= 320;
  const J = {
    team: o.team, kind: o.kind, role: o.kind === 'nation' ? 'head' : o.role, since: S.season, sinceW: S.week,
    until: (S.week >= 45 ? S.season + 1 : S.season) + Math.max(1, o.years) - 1, wage: o.wage,
    conf: round1(clamp(58 + (legend ? 6 : 0) + (former ? 4 : 0), 0, 100)), fans: round1(clamp(52 + (former ? 16 : 0) + Math.min(14, M.legacy0 / 40), 0, 100)), mood: 62,
    budget: o.kind === 'club' && o.role === 'head' ? clubBudget(S, o.team) : 0, obj: null, objT: null, objB: null, objS: null, exp: null,
    ss: freshSS(), signed: [], win: null, winN: 0, breq: null,
  };
  for (const x of M.offers) if (x.status === 'open' && x.src === 'retire' && x !== o) x.status = 'rejected';
  o.status = 'accepted';
  M.job = J;
  M.st = 'active';
  if (S.week <= 40) setObjective(S, J);
  freezeTargets(S);
  M.jobs.push({ team: J.team, kind: J.kind, role: J.role, from: S.week >= 45 ? S.season + 1 : S.season, to: null, end: null, g: 0, w: 0, d: 0, l: 0 });
  const tier = jobTier(S, J);
  const lid = leagueOfTeam(S, J.team);
  emit('manager_started', { tier, role: J.role, kind: J.kind, team: J.team, league: lid || null, gender: p.gender === 'f' ? 'f' : 'm', first: M.jobs.length === 1 });
  addTimeline(S, 'contract', gt(S, (M.jobs.length === 1 ? 'התחלת קריירת אימון: ' : 'תפקיד חדש: ') + roleHe(S, J) + ' ב' + teamNameHe(S, J.team)));
  // the player-era threads (agent, old coaches...) are archived as read: in coach mode the bell counts coaching news only
  if (M.jobs.length === 1) for (const it of S.inbox) it.read = true;
  const who = J.kind === 'nation' ? 'federation' : 'board';
  let welcome;
  if (J.kind === 'nation') welcome = '{{ברוך הבא|ברוכה הבאה}} לנבחרת! כל המדינה מאחוריך. היעד: ' + (objHe(S, J) || 'נקבע אותו בתחילת העונה') + '.';
  else if (J.role === 'head') welcome = '{{ברוך הבא|ברוכה הבאה}} ל' + clubName(J.team) + '. ' + (J.obj ? 'היעד של ההנהלה לעונה: ' + objHe(S, J) + '.' : 'את היעד לעונה נקבע בפגישה בתחילת העונה.') + ' תקציב ההעברות: ' + fmtMoney(J.budget) + '.';
  else if (J.role === 'assistant') welcome = '{{ברוך הבא|ברוכה הבאה}} לצוות המקצועי של ' + clubName(J.team) + '. {{המאמן הראשי|המאמנת הראשית}} {{סומך|סומכת}} על ההמלצות הטקטיות שלך: בכל שבוע {{תמליץ|תמליצי}} על הטקטיקה למשחק.';
  else welcome = '{{ברוך הבא|ברוכה הבאה}} למחלקת {{הנוער|הנערות}} של ' + clubName(J.team) + '. הכישרונות של מחר בידיים שלך.';
  sysMsg(S, who, gt(S, welcome), true);
  return J;
}

/** Close the current job. reason: sacked | moved | contract | retired | resigned */
export function endJob(S, reason) {
  const M = S.mgr;
  const J = M.job;
  if (!J) return;
  pushSeasonRow(S, J, false);
  closeJobRecord(S, reason);
  M.job = null;
  M.st = reason === 'retired' ? 'done' : 'unemployed';
  const f = isFem(S);
  addTimeline(S, reason === 'sacked' ? 'info' : 'contract', teamNameHe(S, J.team) + ': ' + ((f ? END_HE_F : END_HE)[reason] || reason));
  if (reason === 'sacked') {
    emit('manager_sacked', { team: J.team, season: S.season, week: S.week, gender: f ? 'f' : 'm' });
    sysMsg(S, J.kind === 'nation' ? 'federation' : 'board', gt(S, 'החלטנו להיפרד ממך. התוצאות לא עמדו בציפיות. תודה על העבודה, ובהצלחה בהמשך.'), true);
    M.rep = round1(clamp(M.rep - 4, 0, 100));
  }
}
function closeJobRecord(S, reason) {
  const M = S.mgr;
  const jr = M.jobs[M.jobs.length - 1];
  if (jr && jr.to === null) { jr.to = Math.max(jr.from, S.season); jr.end = reason; }
}

// season row for (season, job): pushed at season end (final=true) or when a job ends mid-season
function pushSeasonRow(S, J, final, noVerdict) {
  const M = S.mgr;
  const s = J.ss;
  if (!final && s.g === 0) return;
  const rank = currentRank(S, J);
  const lid = J.kind === 'nation' ? null : (J.role === 'youth' ? (S.comp && S.comp.yl ? S.comp.yl.id : null) : clubLeague(S, J.team));
  M.seasons.push({ s: S.season, team: J.team, kind: J.kind, role: J.role, lg: lid, rank, obj: J.obj || null, objT: J.objT || null, met: final && !noVerdict ? objMet(S, J, rank) : null,
    g: s.g, w: s.w, d: s.d, l: s.l, gf: s.gf, ga: s.ga, tr: s.tr.slice(), part: !final });
  if (M.seasons.length > 80) M.seasons.shift();
  J.ss = freshSS();
}

// ---------------------------------------------------------------- managed match model
/** Which side the manager's team is in a fixture ('h' | 'a'), or null. */
export function mgrSide(S, fx) {
  const M = S.mgr;
  const J = M && M.st === 'active' ? M.job : null;
  if (!J) return null;
  if (fx.h !== J.team && fx.a !== J.team) return null;
  if (J.kind === 'nation') { if (fx.kind !== 'national' && fx.kind !== 'friendly') return null; }
  else if (J.role === 'youth') { if (fx.kind !== 'youth') return null; }
  else if (fx.kind !== 'league' && fx.kind !== 'cup' && fx.kind !== 'europe') return null;
  return fx.h === J.team ? 'h' : 'a';
}
/** Tactic goal multipliers [own scoring, own conceding] for strength gap d = own - opp. */
export function tacticMul(id, d, pressRun) {
  switch (id) {
    case 'attack': return d > 4 ? [1.24, 1.10] : [1.16, 1.15];
    case 'defend': return d < -4 ? [0.84, 0.72] : [0.80, 0.80];
    case 'press': return (pressRun || 0) >= 4 ? [1.02, 1.06] : [1.12, 0.92];
    case 'counter': return d < -2 ? [1 + Math.min(0.22, -d * 0.025), 0.9] : [0.9, 0.97];
    default: return [1, 1];
  }
}
export function mgrBonus(M, J) {
  const b = (M.rep - 50) * 0.05 + (J.mood - 55) * 0.04;
  return clamp(J.role === 'head' || J.kind === 'nation' ? b : b * 0.5, -3.5, 3.5);
}
function poisP(l, k) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
/** Win/draw probabilities for goal rates (own, opp). */
export function wdl(lo, la) {
  let w = 0, d = 0;
  const po = [], pa = [];
  for (let k = 0; k <= 10; k++) { po.push(poisP(lo, k)); pa.push(poisP(la, k)); }
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const p = po[i] * pa[j]; if (i > j) w += p; else if (i === j) d += p; }
  return { w, d, l: Math.max(0, 1 - w - d) };
}
/** Goal rates [home, away] of a managed fixture. */
export function mgrRates(S, fx, side, sh, sa) {
  const M = S.mgr; const J = M.job;
  const own = side === 'h' ? sh : sa, opp = side === 'h' ? sa : sh;
  const b = mgrBonus(M, J);
  const [lh, la] = lambdas(side === 'h' ? own + b : sh, side === 'a' ? own + b : sa, !!fx.neutral);
  let [mf, ma] = tacticMul(M.tactic, own - opp, M.press);
  if (J.role !== 'head' && J.kind !== 'nation') { mf = 1 + (mf - 1) * 0.5; ma = 1 + (ma - 1) * 0.5; }
  return side === 'h' ? [clamp(lh * mf, 0.12, 4.8), clamp(la * ma, 0.12, 4.8)] : [clamp(lh * ma, 0.12, 4.8), clamp(la * mf, 0.12, 4.8)];
}
/** Simulate a managed fixture with the main rng. Returns [hg, ag, extra, etGoals|null]. */
export function mgrSimFixture(S, rng, fx, side, sh, sa) {
  const [lh, la] = mgrRates(S, fx, side, sh, sa);
  let hg = rng.poisson(lh), ag = rng.poisson(la);
  if (!fx.ko) return [hg, ag, null, null];
  const agg = fx.tie && fx.tie.agg ? fx.tie.agg : null;
  const th = (agg ? agg[0] : 0) + hg, ta = (agg ? agg[1] : 0) + ag;
  if (th !== ta) return [hg, ag, null, null];
  const eh = rng.poisson(lh * 30 / 90), ea = rng.poisson(la * 30 / 90);
  hg += eh; ag += ea;
  if (eh !== ea) return [hg, ag, 'et', [eh, ea]];
  const [ph, pa] = simPenalties(rng);
  return [hg, ag, 'p:' + ph + '-' + pa, [eh, ea]];
}

/** Apply a managed result: records, board / fans / mood. Returns a short effects line. */
export function onManagedResult(S, fx, side, hg, ag, extra, rates, et) {
  const M = S.mgr; const J = M.job;
  const my = side === 'h' ? hg : ag, th = side === 'h' ? ag : hg;
  let res = my > th ? 'W' : my < th ? 'L' : 'D';
  if (fx.ko && extra && extra.indexOf('p:') === 0) { const [a, b] = extra.slice(2).split('-').map(Number); res = (side === 'h' ? a > b : b > a) ? 'W' : 'L'; }
  const lo = side === 'h' ? rates[0] : rates[1], la = side === 'h' ? rates[1] : rates[0];
  const pr = wdl(lo, la);
  const ePts = pr.w * 3 + pr.d;
  const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
  const diff = pts - ePts;
  const k = fx.kind === 'friendly' ? 0.5 : fx.ko ? 1.6 : (fx.kind === 'europe' ? 1.3 : 1);
  const head = J.role === 'head' || J.kind === 'nation';
  const cdi = round1(diff * 2.6 * k * (head ? 1 : 0.5));
  J.conf = round1(clamp(J.conf + cdi, 0, 100));
  const derby = !!(clubData(J.team) && clubData(J.team).rival && (fx.h === clubData(J.team).rival || fx.a === clubData(J.team).rival));
  let fdi = diff * 2.4 * k * (derby ? 1.8 : 1) + (M.tactic === 'attack' && res === 'W' ? 0.8 : 0) + (M.tactic === 'defend' && res === 'D' ? -0.6 : 0);
  J.fans = round1(clamp(J.fans + fdi, 0, 100));
  J.mood = round1(clamp(J.mood + (res === 'W' ? 3 : res === 'L' ? -3.5 : 0.3) + (M.tactic === 'press' ? -0.8 : 0), 0, 100));
  const s = J.ss;
  s.g++; s.gf += my; s.ga += th; if (res === 'W') s.w++; else if (res === 'D') s.d++; else s.l++;
  const T = M.tot; T.g++; T.gf += my; T.ga += th; if (res === 'W') T.w++; else if (res === 'D') T.d++; else T.l++;
  const jr = M.jobs[M.jobs.length - 1];
  if (jr) { jr.g++; if (res === 'W') jr.w++; else if (res === 'D') jr.d++; else jr.l++; }
  M.res.push({ w: S.week, s: fx.slot, c: fx.comp, k: fx.kind, h: fx.h, a: fx.a, hg, ag, x: extra || null, et: et || null, rd: fx.rk || null, lvl: fx.lvl || null, side, res, cd: cdi, fd: round1(fdi), tac: M.tactic });
  if (M.res.length > 80) M.res.shift();
  return { res, conf: cdi, fans: round1(fdi), derby };
}

// ---------------------------------------------------------------- trophies / awards as a manager
export function mgrTrophy(S, k, c, team) {
  const M = S.mgr; const J = M.job;
  if (M.trophies.some((t) => t.s === S.season && t.k === k && t.c === c)) return false;
  M.trophies.push({ s: S.season, k, c, team });
  if (J) J.ss.tr.push(k);
  const pts = MGR_TROPHY_PTS[k] || 3;
  M.rep = round1(clamp(M.rep + pts * 0.35, 0, 100));
  if (J) { J.conf = round1(clamp(J.conf + 12, 0, 100)); J.fans = round1(clamp(J.fans + 14, 0, 100)); J.mood = round1(clamp(J.mood + 8, 0, 100)); }
  emit('manager_trophy', { key: k, comp: c });
  addTimeline(S, k, gt(S, 'תואר כ{{מאמן|מאמנת}}: ' + trophyLabel(k) + ' עם ' + teamNameHe(S, team) + ' (' + fmtSeason(S.season) + ')'));
  sysMsg(S, 'system', gt(S, '🏆 ' + trophyLabel(k) + '! ' + teamNameHe(S, team) + ' {{והמאמן|והמאמנת}} עשו היסטוריה.'), false);
  return true;
}
export function mgrAward(S, k, c) {
  const M = S.mgr;
  if (M.awards.some((a) => a.s === S.season && a.k === k)) return false;
  M.awards.push({ s: S.season, k, c: c || null });
  M.rep = round1(clamp(M.rep + (k === 'coach_year' ? 6 : 3), 0, 100));
  emit('manager_award', { key: k });
  addTimeline(S, 'award', gt(S, awardLabel(k) + (c && LEAGUE_BY_ID[c] ? ' ב' + hePrefix('', lgNameHe(c)) : '')));
  sysMsg(S, 'system', gt(S, '🏅 ' + awardLabel(k) + '!'), false);
  return true;
}
/** Cup / European final won by a managed team (head coach only). */
export function onFinal(S, comp, kind, winner) {
  const M = S.mgr; const J = M && M.st === 'active' ? M.job : null;
  if (!J || J.team !== winner || J.kind !== 'club' || J.role !== 'head') return false;
  const ok = mgrTrophy(S, kind, comp, winner);
  if (ok && comp === 'ucl') mgrAward(S, 'coach_year', comp);
  return ok;
}
/** A national tournament finished (T = tournament). */
export function onTournamentDone(S, T) {
  const M = S.mgr; const J = M && M.st === 'active' ? M.job : null;
  if (!J || J.kind !== 'nation' || (T.lvl && T.lvl !== 'senior')) return;
  const inT = T.groups.some((g) => g.indexOf(J.team) >= 0);
  if (!inT) return;
  const st = T.stage[J.team];
  if (T.w === J.team) { mgrTrophy(S, T.kind, T.key, J.team); mgrAward(S, 'coach_year', T.key); return; }
  const delta = st === 'f' ? 10 : st === 'sf' ? 6 : st === 'qf' ? 1 : st === 'r16' || st === 'r32' ? -6 : -16;
  J.conf = round1(clamp(J.conf + delta, 0, 100));
  J.fans = round1(clamp(J.fans + delta, 0, 100));
  M.rep = round1(clamp(M.rep + delta * 0.25, 0, 100));
}

// ---------------------------------------------------------------- weekly
/** End of a manager week (after both slots). rng = main rng. Returns lines for the summary. */
export function mgrWeekEnd(S, rng, playedPress) {
  const M = S.mgr;
  const lines = [];
  const J = M.st === 'active' ? M.job : null;
  M.press = M.tactic === 'press' && playedPress ? (M.press || 0) + 1 : Math.max(0, (M.press || 0) - 1);
  if (J) {
    S.player.money = Math.round(S.player.money + J.wage);
    J.mood = round1(clamp(J.mood + (58 - J.mood) * 0.05 - (M.press >= 4 ? 1.2 : 0), 0, 100));
    J.fans = round1(clamp(J.fans + (55 - J.fans) * 0.03, 0, 100));
    J.conf = round1(clamp(J.conf + (52 - J.conf) * 0.01, 0, 100));
    if (M.press === 4) sysMsg(S, 'staff', gt(S, 'הלחץ הגבוה מתיש את השחקנים. כדאי לשקול שבוע מאוזן כדי להחזיר כוחות.'), false);
    const head = J.role === 'head' || J.kind === 'nation';
    if (head && J.conf < SACK_CONF && S.week >= 6 && S.week <= 44 && J.ss.g >= 4) { endJob(S, 'sacked'); lines.push('sacked'); }
    else if (head && J.conf < 30 && !J.warned && S.week <= 44) { J.warned = true; sysMsg(S, J.kind === 'nation' ? 'federation' : 'board', gt(S, 'האמון בך בירידה. אנחנו צריכים לראות שיפור מהיר בתוצאות.'), true); }
    else if (J.conf >= 40) J.warned = false;
  }
  // offers
  if (M.st === 'unemployed' && S.week % 3 === 0 && rng.chance(0.55)) {
    for (const sp of careerOfferSpecs(S, rng, 'mid', 1, -5)) { pushOffer(S, sp, curAw(S) + 4); lines.push('offer'); }
  } else if (M.st === 'active' && J && M.rep >= 52 && S.week >= 10 && S.week <= 40 && rng.chance(0.03)) {
    for (const sp of careerOfferSpecs(S, rng, 'mid', 1, 4)) { pushOffer(S, sp, curAw(S) + 3); lines.push('offer'); }
  }
  expireOffers(S);
  return lines;
}

// ---------------------------------------------------------------- season end (week 44)
export function mgrSeasonEnd(S, rng) {
  const M = S.mgr;
  const out = { row: null, sacked: false, renewed: false, left: false, offers: 0 };
  const J = M.st === 'active' ? M.job : null;
  if (J) {
    // a job taken after week 40 had no objective this season: no verdict, no board / reputation swing, no sacking
    const late = (!J.obj || J.objS !== S.season) && J.since === S.season && J.sinceW > 40;
    if (!late && (!J.obj || J.objS !== S.season)) setObjective(S, J);
    const rank = currentRank(S, J);
    const met = late ? true : objMet(S, J, rank);
    const head = J.role === 'head' || J.kind === 'nation';
    // league titles / promotion
    if (J.kind === 'club' && J.role === 'head') {
      const lid = clubLeague(S, J.team); const lg = LEAGUE_BY_ID[lid];
      if (lg && rank === 1) mgrTrophy(S, lg.tier === 1 ? 'league' : 'league2', lid, J.team);
      else if (lg && lg.tier === 2 && lg.promotion && rank <= lg.promotion.count) mgrTrophy(S, 'league2', lid, J.team);
      const over = (J.exp || rank) - rank;
      if (lg && !late && (rank === 1 || (rank <= 3 && over >= 4) || (lg.tier === 2 && rank <= (lg.promotion ? lg.promotion.count : 2) && over >= 3))) mgrAward(S, 'coach_season', lid);
    }
    if (J.role === 'youth' && rank === 1 && S.comp.yl) mgrTrophy(S, 'youth_league', S.comp.yl.id, J.team);
    if (!late) {
      const cd = head ? (met ? 16 : -24) : (met ? 6 : -6);
      J.conf = round1(clamp(J.conf + cd, 0, 100));
      J.fans = round1(clamp(J.fans + (met ? 8 : -10), 0, 100));
      M.rep = round1(clamp(M.rep + (met ? (head ? 4 : 2.5) : (head ? -3 : -1)) + (J.role === 'assistant' || J.role === 'youth' ? 1.5 : 0), 0, 100));
    }
    pushSeasonRow(S, J, true, late);
    out.row = M.seasons[M.seasons.length - 1];
    if (J.kind === 'nation' && J.obj === 'qualify' && !late) sysMsg(S, 'federation', gt(S, met ? 'העפלנו! כל הכבוד. עכשיו מתכוננים לטורניר.' : 'לא העפלנו. זו אכזבה גדולה לכל המדינה.'), true);
    // sacking at the end of a failed season
    const firstSeason = J.since === S.season || (J.since === S.season - 1 && J.sinceW >= 45);
    if (head && !late && !met && J.conf < (firstSeason ? 26 : 42)) { endJob(S, 'sacked'); out.sacked = true; }
    else if (J.until <= S.season) {
      if (J.conf >= 48 || !head) { J.until = S.season + 2; out.renewed = true; sysMsg(S, J.kind === 'nation' ? 'federation' : 'board', gt(S, 'אנחנו מרוצים מהעבודה שלך ומאריכים את החוזה בשנתיים.'), true); }
      else { endJob(S, 'contract'); out.left = true; sysMsg(S, 'board', gt(S, 'החלטנו לא להאריך את החוזה. תודה על הכול.'), true); }
    } else if (late) {
      sysMsg(S, J.kind === 'nation' ? 'federation' : 'board', gt(S, 'הגעת אלינו בסוף העונה, אז השנה אין שיפוט. את היעד לעונה הבאה נקבע בפגישת הפתיחה.'), false);
    } else {
      const msg = met ? 'עמדת ביעד העונה. ההנהלה מרוצה ומחכה לעונה הבאה.' : 'לא עמדנו ביעד העונה. בעונה הבאה אנחנו מצפים ליותר.';
      sysMsg(S, J.kind === 'nation' ? 'federation' : 'board', gt(S, msg), false);
    }
  }
  // season-end offers
  if (M.st === 'active' || M.st === 'unemployed') {
    const J2 = M.job;
    let n = M.st === 'unemployed' ? 2 : (M.rep >= 45 ? 1 : 0) + (out.row && out.row.met === true ? 1 : 0);
    if (J2 && J2.role !== 'head' && J2.kind !== 'nation') n = Math.max(n, 1);
    const specs = n > 0 ? careerOfferSpecs(S, rng, 'season', n, M.st === 'unemployed' ? -4 : (J2 && J2.role !== 'head' ? -6 : 2)) : [];
    if (J2 && J2.kind === 'club' && J2.role !== 'head' && J2.conf >= 66 && M.rep >= 30 && rng.chance(0.6)) specs.unshift(offerSpec(S, J2.team, 'club', 'head', 'season', 'promote'));
    for (const sp of specs.slice(0, 3)) { pushOffer(S, sp, curAw(S) + 6); out.offers++; }
  }
  if (M.st !== 'done') M.rv = S.season;
  if (S.season - S.player.born >= 70 && M.st !== 'done') retireCoach(S, 'age');
  return out;
}

/** New season (after the world rollover). */
export function mgrNewSeason(S) {
  const M = S.mgr;
  M.res = [];
  const J = M.st === 'active' ? M.job : null;
  if (!J) return;
  setObjective(S, J);
  J.warned = false;
  if (J.kind === 'club' && J.role === 'head') {
    J.budget = sigRound(J.budget * 0.4 + clubBudget(S, J.team), 2);
    sysMsg(S, 'board', gt(S, 'פגישת פתיחת עונה: היעד שלנו הוא ' + objHe(S, J) + '. תקציב ההעברות: ' + fmtMoney(J.budget) + '.'), true);
  } else if (J.kind === 'nation') sysMsg(S, 'federation', gt(S, 'עונה חדשה לנבחרת. היעד: ' + objHe(S, J) + '.'), false);
  else sysMsg(S, 'staff', gt(S, 'עונה חדשה מתחילה. היעד: ' + objHe(S, J) + '.'), false);
}

/** Retire from coaching. reason: voluntary | age */
export function retireCoach(S, reason) {
  const M = S.mgr;
  if (!M || M.st === 'done') return false;
  if (M.job) endJob(S, 'retired');
  for (const o of M.offers) if (o.status === 'open') o.status = 'expired';
  M.st = 'done';
  const hadJobs = M.jobs.length > 0;
  M.ended = { season: S.season, week: S.week, age: ageOf(S), reason: reason || 'voluntary' };
  if (hadJobs) {
    const r = coachRecord(S);
    emit('manager_retired', { seasons: r.seasons, games: r.games, trophies: r.trophyCount, legacy: r.legacy, gender: isFem(S) ? 'f' : 'm', reason: reason || 'voluntary' });
    addTimeline(S, 'retired', gt(S, 'סוף קריירת האימון אחרי ' + r.seasons + ' עונות על הקווים. תודה, {{המאמן|המאמנת}}!'));
  }
  return true;
}

// ---------------------------------------------------------------- transfers (abstract signings)
/** Id of the open transfer window ('s2027' summer / 'w2026' winter) or null. */
export function windowId(S) {
  if (!isWindowOpen(S.week)) return null;
  if (S.week >= 45) return 's' + (S.season + 1);
  if (S.week <= 4) return 's' + S.season;
  return 'w' + S.season;
}
const T_POS = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'ST'];
const POS_HE = { GK: '{{שוער|שוערת}}', CB: '{{בלם|בלמית}}', LB: '{{מגן שמאלי|מגנה שמאלית}}', RB: '{{מגן ימני|מגנה ימנית}}', CDM: '{{קשר אחורי|קשרית אחורית}}', CM: '{{קשר מרכזי|קשרית מרכזית}}', CAM: '{{קשר התקפי|קשרית התקפית}}', LW: 'כנף שמאל', RW: 'כנף ימין', ST: '{{חלוץ|חלוצה}}' };
/** Transfer targets of the open window (pure, deterministic). */
export function transferTargets(S, J) {
  const win = windowId(S);
  if (!J || !win || J.kind !== 'club' || J.role !== 'head') return [];
  const r = rngFor(S.id, J.team, win, 'targets');
  // the list is frozen for the window: OVR / fee come from the strength when the window opened, so a signing does not re-roll it
  const base = J.tb && J.tb.w === win ? J.tb.s : cs(S, J.team);
  const g = isFem(S) ? 'f' : 'm';
  const own = clubCountry(J.team);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const pos = r.pick(T_POS);
    const ovr = Math.round(clamp(base + r.int(1, 9), 45, 93));
    const age = r.int(20, 31);
    const foreign = r.chance(0.55);
    const natPool = foreign ? r.pick(['eng', 'esp', 'bra', 'arg', 'fra', 'por', 'ned', 'ger', 'ita', 'cro', 'bel', 'tur']) : own;
    const nm = genName(r, poolOfCountry(natPool), g);
    const am = age <= 23 ? 1.3 : age >= 29 ? 0.7 : 1;
    const fee = sigRound(40000 * Math.pow(10, (ovr - 45) / 14) * am * econOf(S), 2);
    const gain = round1(clamp(0.3 + (ovr - base) * 0.13 + (age <= 23 ? 0.1 : 0), 0.3, 1.6));
    out.push({ id: win + ':' + i, name: nm.full, pos, posHe: gt(S, POS_HE[pos] || pos), age, ovr, fee, gain, nation: COUNTRY_BY_ID[natPool] ? natPool : own,
      signed: J.signed.some((x) => x.id === win + ':' + i) });
  }
  return out;
}
/** Freeze the transfer list of the open window (called when a window opens / a job starts / before a signing). */
export function freezeTargets(S) {
  const M = S.mgr; const J = M && M.st === 'active' ? M.job : null;
  if (!J || J.kind !== 'club' || J.role !== 'head') return;
  const win = windowId(S);
  if (win && !(J.tb && J.tb.w === win)) J.tb = { w: win, s: round1(cs(S, J.team)) };
}
export function signTarget(S, id) {
  const M = S.mgr; const J = M && M.st === 'active' ? M.job : null;
  if (!J || J.kind !== 'club' || J.role !== 'head') return { ok: false, error: 'not_head', messageHe: gt(S, 'רק {{מאמן ראשי|מאמנת ראשית}} של מועדון {{יכול|יכולה}} להחתים {{שחקנים|שחקניות}}') };
  const win = windowId(S);
  if (!win) return { ok: false, error: 'window_closed', messageHe: 'חלון ההעברות סגור' };
  if (J.win !== win) { J.win = win; J.winN = 0; }
  freezeTargets(S);
  if (J.winN >= MAX_SIGN_PER_WINDOW) return { ok: false, error: 'limit', messageHe: gt(S, 'אפשר להחתים עד ' + MAX_SIGN_PER_WINDOW + ' {{שחקנים|שחקניות}} בכל חלון') };
  const t = transferTargets(S, J).find((x) => x.id === id);
  if (!t) return { ok: false, error: 'unknown_target', messageHe: gt(S, '{{השחקן|השחקנית}} כבר לא {{זמין|זמינה}}') };
  if (t.signed) return { ok: false, error: 'signed', messageHe: gt(S, 'כבר החתמת את {{השחקן הזה|השחקנית הזאת}}') };
  if (t.fee > J.budget) return { ok: false, error: 'budget', messageHe: 'חסר תקציב: ' + fmtMoney(t.fee - J.budget) };
  J.budget = Math.max(0, Math.round(J.budget - t.fee));
  J.winN++;
  const c = S.world.clubs[J.team];
  const before = c.s;
  c.s = round1(clamp(c.s + t.gain, 35, 92));
  J.mood = round1(clamp(J.mood + 4, 0, 100));
  J.fans = round1(clamp(J.fans + 3, 0, 100));
  J.signed.push({ id: t.id, n: t.name, pos: t.pos, ovr: t.ovr, fee: t.fee, s: S.season });
  if (J.signed.length > 30) J.signed.shift();
  addTimeline(S, 'transfer', gt(S, 'החתמה: ' + t.name + ' (' + t.posHe + ', ' + t.ovr + ') {{הצטרף|הצטרפה}} ל' + clubName(J.team) + ' תמורת ' + fmtMoney(t.fee)));
  return { ok: true, messageHe: gt(S, t.name + ' {{חתם|חתמה}}! חוזק הקבוצה עלה מ-' + Math.round(before) + ' ל-' + Math.round(c.s) + '.'), strength: c.s };
}
export function requestBudget(S, rng) {
  const M = S.mgr; const J = M && M.st === 'active' ? M.job : null;
  if (!J || J.kind !== 'club' || J.role !== 'head') return { ok: false, error: 'not_head', messageHe: gt(S, 'רק {{מאמן ראשי|מאמנת ראשית}} {{יכול|יכולה}} לבקש תקציב') };
  const win = windowId(S);
  if (!win) return { ok: false, error: 'window_closed', messageHe: 'אפשר לבקש תקציב רק כשחלון ההעברות פתוח' };
  if (J.breq === win) return { ok: false, error: 'asked', messageHe: 'כבר ביקשת תקציב בחלון הזה' };
  J.breq = win;
  const pApprove = clamp((J.conf - 30) / 50, 0.05, 0.95);
  const c = S.world.clubs[J.team];
  const amount = sigRound(c.b * 1e6 * 0.08 * econOf(S) * (0.6 + J.conf / 100), 2);
  if (rng.chance(pApprove)) {
    J.budget = Math.round(J.budget + amount);
    sysMsg(S, 'board', gt(S, 'אישרנו תוספת של ' + fmtMoney(amount) + ' לתקציב ההעברות. {{תשתמש|תשתמשי}} בה בחוכמה.'), false);
    return { ok: true, approved: true, amount, budget: J.budget, messageHe: 'ההנהלה אישרה תוספת של ' + fmtMoney(amount) };
  }
  J.conf = round1(clamp(J.conf - 2, 0, 100));
  sysMsg(S, 'board', gt(S, 'כרגע אין תוספת תקציב. תוכיח{{|י}} את עצמך על הדשא ונדבר שוב.'), false);
  return { ok: true, approved: false, amount: 0, budget: J.budget, messageHe: 'ההנהלה דחתה את הבקשה' };
}

// ---------------------------------------------------------------- view models
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function teamVMx(S, id) {
  const v = teamVM(id);
  if (isNationTeam(id)) { v.nameHe = teamNameHe(S, id); v.nation = id; }
  return v;
}
function offerVM(S, o) {
  const s = teamStr(S, o.team);
  const lid = leagueOfTeam(S, o.team);
  const J = { team: o.team, kind: o.kind, role: o.role };
  const ob = o.kind === 'club' && o.role !== 'youth' ? objectiveFor(S, J) : o.kind === 'nation' ? objectiveFor(S, J) : { key: 'youth_top' };
  const WHY = { home: 'המועדון שלך קורא לך הביתה', big: 'מועדון ענק', top: 'מועדון צמרת', mid: 'אתגר מעניין', lower: 'מקום טוב להתחיל בו', youth: 'לפתח את הדור הבא', nation: 'לאמן את הנבחרת של המדינה', step_up: 'צעד גדול קדימה', fit: 'מתאים לרמה שלך', promote: 'קידום לתפקיד המאמן הראשי' };
  return {
    id: o.id, team: teamVMx(S, o.team), kind: o.kind, role: o.role, roleHe: roleHe(S, o), strength: Math.round(s),
    leagueHe: lid ? lgNameHe(lid) : (o.kind === 'nation' ? 'נבחרת לאומית' : ''), tier: jobTier(S, Object.assign({}, J)),
    wage: o.wage, wageHe: fmtMoney(o.wage) + ' לשבוע', years: o.years, objHe: gt(S, OBJ_HE[ob.key] || ''), whyHe: gt(S, WHY[o.why] || ''),
    status: o.status, src: o.src, expHe: o.exp !== null && o.status === 'open' ? 'בתוקף עד ' + weekLabelHe(Math.floor((o.exp - 1) / 52), o.exp - Math.floor((o.exp - 1) / 52) * 52) : '',
  };
}
export function offersVM(S) {
  const M = S.mgr;
  if (!M) return [];
  const open = M.offers.filter((o) => o.status === 'open').slice().reverse();
  return open.map((o) => offerVM(S, o));
}
const BAR_HE = { conf: 'אמון ההנהלה', confN: 'אמון ההתאחדות', fans: 'מצב רוח האוהדים', mood: 'מורל בחדר ההלבשה' };
export function repHe(rep) { return rep >= 85 ? 'אגדת אימון' : rep >= 70 ? 'שם עולמי' : rep >= 55 ? 'מוערך מאוד' : rep >= 40 ? 'מוכר בליגה' : rep >= 25 ? 'מתחיל להתבלט' : 'בתחילת הדרך'; }
const REP_HE_F = { 'מוערך מאוד': 'מוערכת מאוד', 'מוכר בליגה': 'מוכרת בליגה', 'מתחיל להתבלט': 'מתחילה להתבלט' };
function repHeG(S, rep) { const t = repHe(rep); return isFem(S) ? (REP_HE_F[t] || t) : t; }
function seasonRowVM(S, r) {
  const lg = r.lg && LEAGUE_BY_ID[r.lg] ? lgNameHe(r.lg) : (r.lg && S.comp && S.comp.yl && r.lg === S.comp.yl.id ? lgYouthHe(clubLeague(S, r.team)) : (r.lg ? lgYouthHe(String(r.lg).split('_')[0]) : (r.kind === 'nation' ? 'נבחרת' : '')));
  return { season: r.s, seasonHe: fmtSeason(r.s), team: teamVMx(S, r.team), roleHe: roleHe(S, r), leagueHe: lg, rank: r.rank, objHe: r.obj ? gt(S, OBJ_HE[r.obj] || '') : '',
    met: r.met, games: r.g, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, trophies: (r.tr || []).map((k) => trophyLabel(k)), partial: !!r.part };
}
function groupKeys(list, label) {
  const m = {}; const order = [];
  for (const x of list) { if (!m[x.k]) { m[x.k] = { key: x.k, he: label(x.k), count: 0, seasons: [] }; order.push(x.k); } m[x.k].count++; m[x.k].seasons.push(fmtSeason(x.s)); }
  return order.map((k) => ({ key: k, he: m[k].he, count: m[k].count, seasonsHe: m[k].seasons.join(', ') }));
}
/** Recent managed results (newest first) as plain rows. */
export function recentResults(S, n) {
  const M = S.mgr;
  return M.res.slice(-n).reverse().map((r) => resultVM(S, r));
}
export function resultVM(S, r) {
  const v = r.k === 'youth' ? 'youth' : null;
  const home = r.k === 'youth' ? teamVM(r.h, 'youth') : teamVMx(S, r.h), away = r.k === 'youth' ? teamVM(r.a, 'youth') : teamVMx(S, r.a);
  return { key: S.season + '-' + r.w + '-' + r.s + '-' + r.c, week: r.w, slot: r.s, dateHe: weekLabelHe(S.season, r.w), comp: r.c, kind: r.k, home, away, isHome: r.side === 'h',
    score: [r.hg, r.ag], extra: r.x, res: r.res, confDelta: r.cd, fansDelta: r.fd, tacticHe: (TACTICS[r.tac] || TACTICS.balanced).he, variant: v };
}

/**
 * Cosmetic match reel of a managed result (deterministic; never touches the main rng).
 * events: [{ minute, ev: 'kickoff'|'goal'|'chance'|'card'|'ht'|'ft'|'et'|'pens', side: 'h'|'a'|null, nameHe, score:[h,a], textHe }]
 */
export function matchReel(S, r) {
  const g = isFem(S) ? 'f' : 'm';
  const rr = rngFor('reel', S.id, S.season, r.w, r.s, r.c, r.hg, r.ag);
  const et = r.et || null;
  const base = [r.hg - (et ? et[0] : 0), r.ag - (et ? et[1] : 0)];
  const goals = [];
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < base[s]; i++) goals.push({ m: rr.int(2, 90), side: s === 0 ? 'h' : 'a' });
    if (et) for (let i = 0; i < et[s]; i++) goals.push({ m: rr.int(92, 120), side: s === 0 ? 'h' : 'a' });
  }
  const extras = [];
  const nEx = rr.int(2, 4);
  for (let i = 0; i < nEx; i++) extras.push({ m: rr.int(5, 88), side: rr.chance(0.5) ? 'h' : 'a', ev: rr.chance(0.6) ? 'chance' : 'card' });
  const all = goals.map((x) => Object.assign({ ev: 'goal' }, x)).concat(extras).sort((a, b) => (a.m - b.m) || (a.ev === 'goal' ? 1 : -1));
  const nm = (team, k) => {
    const id = team;
    try { return nameForG(g, id, S.season, 'mate', k); } catch (e) { return ''; }
  };
  const sc = [0, 0];
  const out = [{ minute: 0, ev: 'kickoff', side: null, nameHe: '', score: [0, 0], textHe: 'שריקת פתיחה' }];
  let htDone = false, ftDone = false;
  const CH = ['בעיטה מסוכנת של {n} עוברת סנטימטרים מהקורה', 'הצלה גדולה! {n} כמעט כבש', 'מצב ענק ל{n}, השוער עוצר'];
  const CH_F = ['בעיטה מסוכנת של {n} עוברת סנטימטרים מהקורה', 'הצלה גדולה! {n} כמעט כבשה', 'מצב ענק ל{n}, השוערת עוצרת'];
  for (const e of all) {
    if (!htDone && e.m > 45) { out.push({ minute: 45, ev: 'ht', side: null, nameHe: '', score: sc.slice(), textHe: 'מחצית' }); htDone = true; }
    if (!ftDone && e.m > 90) { out.push({ minute: 90, ev: 'et', side: null, nameHe: '', score: sc.slice(), textHe: 'הארכה!' }); ftDone = true; }
    const team = e.side === 'h' ? r.h : r.a;
    const n = nm(team, rr.int(1, 10));
    const tHe = r.k === 'youth' ? teamVM(team, 'youth').shortHe : teamVM(team).shortHe;
    const own = e.side === r.side;
    if (e.ev === 'goal') {
      if (e.side === 'h') sc[0]++; else sc[1]++;
      out.push({ minute: e.m, ev: 'goal', side: e.side, own, nameHe: n, teamHe: tHe, score: sc.slice(), textHe: 'גול! ' + n + ' (' + tHe + ')' });
    } else if (e.ev === 'chance') out.push({ minute: e.m, ev: 'chance', side: e.side, own, nameHe: n, teamHe: tHe, score: sc.slice(), textHe: rr.pick(g === 'f' ? CH_F : CH).replace('{n}', n + ' (' + tHe + ')') });
    else out.push({ minute: e.m, ev: 'card', side: e.side, own, nameHe: n, teamHe: tHe, score: sc.slice(), textHe: 'כרטיס צהוב ל' + n + ' (' + tHe + ')' });
  }
  if (!htDone) out.push({ minute: 45, ev: 'ht', side: null, nameHe: '', score: sc.slice(), textHe: 'מחצית' });
  if (r.x && r.x.indexOf('p:') === 0) out.push({ minute: 120, ev: 'pens', side: null, nameHe: '', score: sc.slice(), textHe: 'פנדלים: ' + r.x.slice(2) });
  out.push({ minute: et ? 120 : 90, ev: 'ft', side: null, nameHe: '', score: sc.slice(), textHe: 'שריקת סיום' });
  return out;
}

export function coachRecord(S) {
  const M = S.mgr;
  if (!M || !M.jobs.length) return null;
  const T = M.tot;
  // seasons on the touchline = seasons with at least one managed match
  const seasons = new Set();
  for (const r of M.seasons) if (r.g > 0) seasons.add(r.s);
  if (M.job && M.job.ss && M.job.ss.g > 0) seasons.add(S.season);
  const trophies = {}; for (const t of M.trophies) trophies[t.k] = (trophies[t.k] || 0) + 1;
  const awards = {}; for (const a of M.awards) awards[a.k] = (awards[a.k] || 0) + 1;
  let L = T.g * 0.03 + T.w * 0.06 + M.rep * 0.5;
  for (const t of M.trophies) L += (MGR_TROPHY_PTS[t.k] || 3) * 0.9;
  for (const a of M.awards) L += a.k === 'coach_year' ? 25 : 10;
  const jobs = M.jobs.map((j) => ({ team: teamVMx(S, j.team), he: teamNameHe(S, j.team), roleHe: roleHe(S, j), fromHe: fmtSeason(j.from), toHe: j.to === null ? 'היום' : fmtSeason(j.to), games: j.g, w: j.w, d: j.d, l: j.l,
    endHe: j.end ? ((isFem(S) ? END_HE_F : END_HE)[j.end] || '') : '' }));
  const best = M.jobs.slice().sort((a, b) => (teamStr(S, b.team) - teamStr(S, a.team)) || (a.team < b.team ? -1 : 1))[0];
  return { seasons: seasons.size, games: T.g, w: T.w, d: T.d, l: T.l, gf: T.gf, ga: T.ga, winPct: pct(T.w, T.g), trophies, awards, trophyCount: M.trophies.length,
    jobs, bestHe: best ? teamNameHe(S, best.team) : '', rep: Math.round(M.rep), legacy: round1(L) };
}

/** Full manager view model (pure). extra: { thisWeek, next, table } computed by the facade. */
export function managerVM(S, extra) {
  const M = S.mgr;
  if (!M) return null;
  const J = M.st === 'active' ? M.job : null;
  const f = isFem(S);
  const p = S.player;
  let job = null;
  if (J) {
    const lid = J.kind === 'nation' ? null : J.role === 'youth' ? (S.comp && S.comp.yl ? S.comp.yl.id : null) : clubLeague(S, J.team);
    const played = J.kind === 'nation' ? !!(S.nt.q && S.nt.q.t.some((x) => x[1] > 0)) : J.role === 'youth' ? !!(S.comp.yl && S.comp.yl.r > 0) : !!(lid && S.comp.lg[lid] && S.comp.lg[lid].r > 0);
    const rank = played ? currentRank(S, J) : null;
    const head = J.role === 'head' || J.kind === 'nation';
    const win = windowId(S);
    job = {
      team: J.role === 'youth' ? teamVM(J.team, 'youth') : teamVMx(S, J.team), kind: J.kind, role: J.role, roleHe: roleHe(S, J), tier: jobTier(S, J),
      leagueId: lid, leagueHe: J.kind === 'nation' ? '' : J.role === 'youth' ? lgYouthHe(clubLeague(S, J.team)) : (lid ? lgNameHe(lid) : ''),
      strength: Math.round(teamStr(S, J.team)), rank, expRank: J.exp,
      bars: [
        { key: 'conf', he: J.kind === 'nation' ? BAR_HE.confN : BAR_HE.conf, value: Math.round(J.conf) },
        { key: 'fans', he: BAR_HE.fans, value: Math.round(J.fans) },
        { key: 'mood', he: BAR_HE.mood, value: Math.round(J.mood) },
      ],
      objective: J.obj ? { key: J.obj, he: objHe(S, J), status: objStatus(S, J), statusHe: { on: 'בדרך הנכונה', risk: 'על הקצה', off: 'בסכנה' }[objStatus(S, J)], rankHe: rank ? 'מקום ' + rank : '' } : null,
      untilHe: 'חוזה עד סוף ' + fmtSeason(J.until), wage: J.wage, wageHe: fmtMoney(J.wage) + ' לשבוע', sinceHe: fmtSeason(J.since),
      season: { games: J.ss.g, w: J.ss.w, d: J.ss.d, l: J.ss.l, gf: J.ss.gf, ga: J.ss.ga },
      canTactic: true, tacticNoteHe: head ? '' : gt(S, J.role === 'assistant' ? 'זו המלצה {{למאמן הראשי|למאמנת הראשית}}: כ{{עוזר מאמן|עוזרת מאמן}} ההשפעה שלך על המשחק היא בחצי כוח.' : ''),
      transfers: J.kind === 'club' && J.role === 'head' ? {
        open: !!win, budget: J.budget, budgetHe: fmtMoney(J.budget), max: MAX_SIGN_PER_WINDOW, used: J.win === win ? J.winN : 0,
        canRequest: !!win && J.breq !== win, targets: transferTargets(S, J).map((t) => Object.assign({}, t, { feeHe: fmtMoney(t.fee), affordable: t.fee <= J.budget })),
        signed: J.signed.slice().reverse().slice(0, 8).map((x) => ({ name: x.n, pos: x.pos, ovr: x.ovr, feeHe: fmtMoney(x.fee), seasonHe: fmtSeason(x.s) })),
      } : null,
    };
  }
  const prev = M.tactic || 'balanced';
  let rec = null;
  if (J && extra && extra.oppStrength !== undefined && extra.oppStrength !== null) {
    const d = teamStr(S, J.team) - extra.oppStrength;
    rec = d > 4 ? 'attack' : d < -6 ? 'counter' : d < -3 ? 'defend' : 'balanced';
  }
  const rv = M.rv !== null ? M.seasons.filter((r) => r.s === M.rv).map((r) => seasonRowVM(S, r)) : [];
  const cr = coachRecord(S);
  return {
    st: M.st, titleHe: J && J.role === 'assistant' ? (f ? 'עוזרת המאמן' : 'עוזר המאמן') : (f ? 'המאמנת' : 'המאמן'), name: p.first + ' ' + p.last, age: ageOf(S), gender: f ? 'f' : 'm', look: p.look ? Object.assign({}, p.look) : null, nation: p.nation,
    rep: Math.round(M.rep), repHe: repHeG(S, M.rep), dateHe: weekLabelHe(S.season, S.week), season: S.season, week: S.week, phase: S.week >= 45 ? 'summer' : 'season', money: p.money, moneyHe: fmtMoney(p.money),
    job,
    tactic: { current: prev, recommended: rec, options: TACTIC_IDS.map((id) => ({ id, he: TACTICS[id].he, desc: TACTICS[id].desc, ico: TACTICS[id].ico, rec: rec === id })), pressWarn: (M.press || 0) >= 4 },
    thisWeek: (extra && extra.thisWeek) || [], next: (extra && extra.next) || null, table: (extra && extra.table) || null,
    recent: recentResults(S, 8),
    offers: offersVM(S), openOffers: M.offers.filter((o) => o.status === 'open').length,
    record: { games: M.tot.g, w: M.tot.w, d: M.tot.d, l: M.tot.l, gf: M.tot.gf, ga: M.tot.ga, winPct: pct(M.tot.w, M.tot.g) },
    trophies: groupKeys(M.trophies, trophyLabel), awards: groupKeys(M.awards, awardLabel),
    seasons: M.seasons.slice().reverse().map((r) => seasonRowVM(S, r)),
    jobs: cr ? cr.jobs.slice().reverse() : [],
    review: rv.length ? { season: M.rv, seasonHe: fmtSeason(M.rv), rows: rv } : null,
    canRetire: M.st === 'active' || M.st === 'unemployed', coach: cr,
    statusHe: M.st === 'unemployed' ? gt(S, '{{אתה|את}} בלי קבוצה כרגע. הצעות יגיעו לתיבה.') : M.st === 'done' ? gt(S, 'קריירת האימון הסתיימה') : M.st === 'offers' ? gt(S, 'הצעות אימון מחכות לך') : '',
  };
}

/** Coaching section of the Hall of Fame entry / retirement screen. */
export function coachHof(S) {
  const r = coachRecord(S);
  if (!r) return null;
  return { seasons: r.seasons, games: r.games, w: r.w, d: r.d, l: r.l, winPct: r.winPct, trophies: r.trophies, awards: r.awards, legacy: r.legacy, rep: r.rep, bestHe: r.bestHe,
    jobs: r.jobs.map((j) => ({ he: j.he, roleHe: j.roleHe, fromHe: j.fromHe, toHe: j.toHe })) };
}

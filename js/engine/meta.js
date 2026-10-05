// v2.3 progression layer ("אין רגע דל, כל משחק משחק"): stars ledger, achievements, weekly / season objectives,
// cosmetics + boosts, the career path, match stakes + consequences, the quiet-week training challenge, the debut
// tutorial card, daily rewards, the leaderboard / challenge summary and the v5 migration (one-time OVR 60 lift).
// Pure + deterministic: every random choice comes from rngFor(S.id, ...) (never the main career stream); dates
// (daily rewards) are passed in by the UI.
// Data: the content tables of js/data/strings.js (OBJECTIVES, ACHIEVEMENTS, STAKES, QUIET_WEEK, PATH, TUTORIAL,
// DAILY, COSMETICS, MIGRATION_TEXT) drive ids, targets, stars and texts; every table / row / string has a built-in
// fallback below with the same row shape, so the engine runs (and the tests pass) without them.
import * as STRX from '../data/strings.js';
import * as EVX from '../data/events.js';
import * as COMX from '../data/commentary.js';
import { LEAGUE_BY_ID } from '../data/leagues.js';
import { rngFor } from '../core/rng.js';
import { C, emit, curAw, nextId } from './state.js';
import { clamp, fill, gtext, econMoney, fmtMoney, round1, EUR_ILS } from './util.js';
import { ovrOf, ageOf, valueOf, posGroup, formAvgOr, setOvrTo, START23 } from './player.js';
import { legacyScore, sumLines, ALL_LINES } from './history.js';
import { clubData, clubCountry, clubLeague, cs, clubName, clubPrestige, leagueMembers, country, nameFor } from './world.js';
import { nstr } from './national.js';
import { youthThreshold, seniorScore } from './selection.js';
import { sysMsg, coachName, raise } from './narrative.js';
// v2.3 inbox triggers (js/data/events.js V23_EVENTS): raised here, fired by the week-end narrative step
function trig(S, t, front) {
  try {
    if (!S || !S.ev) return;
    raise(S, t);
    // the debut reactions beat the routine week triggers (only 2 trigger events fire per week)
    const L = S.inWeek ? S.ev.trig : S.ev.carry;
    if (front && Array.isArray(L)) { const i = L.indexOf(t); if (i > 0) { L.splice(i, 1); L.unshift(t); } }
  } catch (e) { /* never break a hook */ }
}

// ------------------------------------------------------------------ content lookup
function table(name) {
  const v = STRX[name] || EVX[name] || COMX[name];
  return v && typeof v === 'object' ? v : null;
}
function rowsOf(name, key) {
  const T = table(name);
  if (!T) return null;
  const v = key ? T[key] : T;
  return Array.isArray(v) && v.length ? v : null;
}
const PH = /\{[a-zA-Z0-9_]+\}/;
const BAD = /undefined|NaN|\[object |\{\{|\}\}/;
/** Variant list of a content value (string | string[]). */
function vlist(v) {
  if (typeof v === 'string') return v ? [v] : [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x);
  return [];
}
/** Fill a content template (a deterministic variant); the built-in default when it leaves a placeholder or is missing. */
function tx(v, def, vars, r, g) {
  const vs = vlist(v);
  const o = vars || {};
  if (vs.length) {
    const t = vs.length > 1 && r ? vs[r.int(0, vs.length - 1)] : vs[0];
    const out = fill(t, o, g);
    if (!PH.test(out) && !BAD.test(out)) return out;
  }
  const ds = vlist(def);
  const d = ds.length > 1 && r ? ds[r.int(0, ds.length - 1)] : (ds[0] || '');
  return fill(d, o, g);
}
function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// ------------------------------------------------------------------ state
export const SLOTS = ['boots', 'celebration', 'frame', 'accessory'];
export function freshMeta(tutorial) {
  return {
    v: 2,
    st: { bal: 0, earn: 0, spent: 0, log: [] },
    ach: {}, cnt: {},
    obj: { list: [], seas: null, n: 0 },
    cos: { own: [], eq: { boots: null, celebration: null, frame: null, accessory: null } },
    bst: { en: -99, mo: -99, scout: false, sc: -1 },
    tut: { st: tutorial ? 'pending' : 'skip', aw: null, card: null },
    ms: {}, dly: { last: '', n: 0, day: 0, best: 0 }, wk: 0, wr: [], tq: [],
    sc: null, fs: null, yb: -99, m5: false, injLong: false, burnSeen: 0,
  };
}
/** Fill missing fields (idempotent). A career without meta (old / foreign save) never replays the tutorial. */
export function ensureMeta(S) {
  if (!S) return null;
  if (!S.meta || typeof S.meta !== 'object') S.meta = freshMeta(false);
  const M = S.meta, d = freshMeta(false);
  for (const k of Object.keys(d)) if (!(k in M) || M[k] === undefined) M[k] = d[k];
  if (!M.st || typeof M.st !== 'object') M.st = d.st;
  for (const k of ['bal', 'earn', 'spent']) if (typeof M.st[k] !== 'number' || !(M.st[k] >= 0)) M.st[k] = 0;
  if (!Array.isArray(M.st.log)) M.st.log = [];
  if (!M.cos || typeof M.cos !== 'object') M.cos = d.cos;
  if (!Array.isArray(M.cos.own)) M.cos.own = [];
  if (!M.cos.eq || typeof M.cos.eq !== 'object') M.cos.eq = d.cos.eq;
  for (const s of SLOTS) if (!(s in M.cos.eq)) M.cos.eq[s] = null;
  if (!M.obj || typeof M.obj !== 'object' || !Array.isArray(M.obj.list)) M.obj = d.obj;
  if (!M.tut || typeof M.tut !== 'object') M.tut = d.tut;
  if (!M.bst || typeof M.bst !== 'object') M.bst = d.bst;
  if (!M.dly || typeof M.dly !== 'object') M.dly = d.dly;
  if (!Array.isArray(M.tq)) M.tq = [];
  if (!Array.isArray(M.wr)) M.wr = [];
  if (!M.cnt || typeof M.cnt !== 'object') M.cnt = {};
  if (!M.ach || typeof M.ach !== 'object') M.ach = {};
  if (!M.ms || typeof M.ms !== 'object') M.ms = {};
  if (!M.cosInit) initCosmetics(S);
  return M;
}
function MM(S) { return ensureMeta(S); }
function playing(S) { const p = S.player; return !!(p && !S.retired && p.stage !== 'retired'); }
function inc(S, k, n) { const c = MM(S).cnt; c[k] = (c[k] || 0) + (n === undefined ? 1 : n); }
function cnt(S, k) { return MM(S).cnt[k] || 0; }
function gOf(S) { return S && S.player && S.player.gender === 'f' ? 'f' : 'm'; }
function G(S, s) { return gtext(s, gOf(S)); }

// ------------------------------------------------------------------ stars ledger (never negative)
const SRC_HE = { objective: 'משימה', season: 'משימת עונה', achievement: 'הישג', daily: 'פרס יומי', goal: 'מטרה אישית', quiet: 'אתגר אימון', tutorial: 'הופעת בכורה', migration: 'קפיצת מדרגה', shop: 'פרסים' };
export function addStars(S, n, src) {
  const M = MM(S);
  const v = Math.round(Number(n) || 0);
  if (!(v > 0)) return 0;
  M.st.bal += v; M.st.earn += v;
  M.st.log.push({ aw: curAw(S), d: v, s: src || '' });
  while (M.st.log.length > 30) M.st.log.shift();
  return v;
}
function takeStars(S, n, src) {
  const M = MM(S);
  const v = Math.round(Number(n) || 0);
  if (v < 0 || M.st.bal < v) return false;
  if (v === 0) return true;
  M.st.bal -= v; M.st.spent += v;
  M.st.log.push({ aw: curAw(S), d: -v, s: src || 'shop' });
  while (M.st.log.length > 30) M.st.log.shift();
  return true;
}
function toast(S, t) { const M = MM(S); M.tq.push(t); while (M.tq.length > 12) M.tq.shift(); }
/** Pending toasts for the UI (achievement / objective / milestone / stars), cleared on read. */
export function popToasts(S) { const M = MM(S); const out = M.tq.slice(); M.tq = []; return out; }
// The "interesting" marker is engine context (C.int), not career state: chunked and unchunked fast-forwards stay identical.
function markInt(S, kind, he) { if (!C.int) C.int = { kind, he: he || '' }; }
/** The first interesting thing since the last call ({ kind, he } | null) - "המשך עד האירוע הבא" stops on it. */
export function takeInteresting(S) { const k = C.int || null; C.int = null; return k; }

// ------------------------------------------------------------------ effects (STAKES fx / OBJECTIVES reward / QUIET_WEEK fx)
const EFF_HE = { morale: 'מורל', energy: 'אנרגיה', trust: 'אמון המאמן', fans: 'אהדת הקהל', mates: 'יחסים בקבוצה' };
/** Money in content tables is the men's-scale ₪ amount; the engine keeps euros scaled by the career economy. */
function moneyOf(S, ils) { return econMoney(S, Math.round(num(ils, 0) / EUR_ILS)); }
function rewardHe(S, stars, fx) {
  const parts = [];
  if (stars) parts.push('+' + stars + '⭐');
  if (fx) {
    for (const k of ['morale', 'energy', 'trust', 'fans', 'mates']) if (num(fx[k], 0) > 0) parts.push('+' + fx[k] + ' ' + EFF_HE[k]);
    if (num(fx.money, 0) > 0) parts.push('+' + fmtMoney(moneyOf(S, fx.money)));
  }
  return parts.join(' · ');
}
/** Apply an Effects-like object. Extra keys: agentPush, attr {k: d}, promise 'next1', natBoost n (weeks), interest 'abroad'|'local'. */
function applyFx(S, fx, ctx) {
  const p = S.player, M = MM(S);
  if (!fx || typeof fx !== 'object' || !p) return;
  const act = playing(S);
  if (act) {
    for (const k of ['morale', 'energy', 'trust', 'fans', 'mates']) { const v = num(fx[k], 0); if (v) p[k] = Math.round(clamp(p[k] + v, 0, 100)); }
    const rk = { repL: 'l', repC: 'c', repW: 'w' };
    for (const k of Object.keys(rk)) { const v = num(fx[k], 0); if (v) p.rep[rk[k]] = round1(clamp(p.rep[rk[k]] + v, 0, 100)); }
    if (num(fx.agentPush, 0) > 0) p.agentPush = Math.max(p.agentPush || 0, Math.round(fx.agentPush));
    if (fx.attr && typeof fx.attr === 'object') for (const k of Object.keys(fx.attr)) if (typeof p.a[k] === 'number') p.a[k] = round1(clamp(p.a[k] + num(fx.attr[k], 0), 1, 99));
    const aw = curAw(S);
    if (fx.promise === 'next1' && p.club) M.fs = { club: p.club, aw };
    if (num(fx.natBoost, 0) > 0) M.yb = Math.max(M.yb || -99, aw + Math.round(fx.natBoost));
    if ((fx.interest === 'abroad' || fx.interest === 'local') && ctx && ctx.club) M.sc = { club: ctx.club, until: aw + 12, kind: fx.interest };
  }
  if (num(fx.money, 0) > 0) p.money = Math.max(0, Math.round(p.money + moneyOf(S, fx.money)));
}

// ------------------------------------------------------------------ achievements (F5)
const TIERS = ['bronze', 'silver', 'gold'];
const TIER_STARS = { bronze: 10, silver: 40, gold: 100 };
// built-in fallback rows (content shape: ACHIEVEMENTS in js/data/strings.js): [id, tier, metric, target, stars, he, descHe, cat]
const ACH_FALLBACK = [
  ['debut', 'bronze', 'debut', 1, 10, 'בכורה', 'משחק ראשון בקבוצה הבוגרת', 'start'],
  ['first_goal', 'bronze', 'goals', 1, 15, 'השער הראשון', 'שער ראשון בבוגרים', 'start'],
  ['first_assist', 'bronze', 'assists', 1, 10, 'הבישול הראשון', 'מסירת שער ראשונה בבוגרים', 'start'],
  ['first_start', 'bronze', 'starts', 1, 10, 'מהדקה הראשונה', 'פתיחה ראשונה בהרכב', 'start'],
  ['pro_contract', 'silver', 'pro_contract', 1, 30, 'חוזה מקצועני', 'חתימה על החוזה המקצועני הראשון', 'start'],
  ['first_motm', 'bronze', 'motm', 1, 15, 'כוכב הערב', 'פעם ראשונה {{שחקן המשחק|שחקנית המשחק}}', 'start'],
  ['season_one', 'bronze', 'seasons', 1, 20, 'עונה ראשונה', 'עונה שלמה מאחוריך', 'start'],
  ['goals_10', 'bronze', 'goals', 10, 20, '10 שערים', '10 שערים בקריירה', 'goals'],
  ['goals_50', 'silver', 'goals', 50, 50, '50 שערים', '50 שערים בקריירה', 'goals'],
  ['goals_100', 'gold', 'goals', 100, 100, 'מועדון ה-100', '100 שערים בקריירה', 'goals'],
  ['goals_300', 'gold', 'goals', 300, 250, '300 שערים', '300 שערים בקריירה', 'goals'],
  ['hat_trick', 'bronze', 'hat_tricks', 1, 30, 'שלושער', '3 שערים במשחק אחד', 'goals'],
  ['hat_tricks_5', 'gold', 'hat_tricks', 5, 100, 'אוסף כדורים', '5 שלושערים בקריירה', 'goals'],
  ['season_20', 'silver', 'season_goals_best', 20, 60, 'עונה של 20', '20 שערים בעונה אחת', 'goals'],
  ['season_40', 'gold', 'season_goals_best', 40, 150, 'עונה של 40', '40 שערים בעונה אחת', 'goals'],
  ['top_scorer', 'silver', 'top_scorer', 1, 60, '{{מלך השערים|מלכת השערים}}', 'סיום עונה בראש טבלת המבקיעים', 'goals'],
  ['super_sub', 'bronze', 'bench_goals', 5, 25, 'ג׳וקר מהספסל', '5 שערים אחרי כניסה מהספסל', 'goals'],
  ['late_winner', 'silver', 'late_winners', 1, 40, 'ברגע האחרון', 'שער ניצחון מהדקה 85 ואילך', 'goals'],
  ['teen_goals_10', 'silver', 'teen_goals', 10, 50, 'הכישרון שהתפוצץ', '10 שערים בבוגרים לפני גיל 19', 'goals'],
  ['assists_10', 'bronze', 'assists', 10, 20, '10 בישולים', '10 מסירות שער', 'play'],
  ['assists_50', 'silver', 'assists', 50, 60, 'הקוסם', '50 מסירות שער', 'play'],
  ['assists_100', 'gold', 'assists', 100, 120, 'מנצח התזמורת', '100 מסירות שער', 'play'],
  ['motm_10', 'silver', 'motm', 10, 50, '10 פעמים {{שחקן המשחק|שחקנית המשחק}}', '10 תארי {{שחקן המשחק|שחקנית המשחק}}', 'play'],
  ['motm_50', 'gold', 'motm', 50, 150, '50 פעמים {{שחקן המשחק|שחקנית המשחק}}', '50 תארי {{שחקן המשחק|שחקנית המשחק}}', 'play'],
  ['rating_9', 'silver', 'rating_max', 9, 40, 'ערב מושלם', 'ציון 9 ומעלה במשחק', 'play'],
  ['apps_100', 'silver', 'apps', 100, 50, '100 הופעות', '100 משחקים בבוגרים', 'play'],
  ['apps_300', 'gold', 'apps', 300, 120, '300 הופעות', '300 משחקים בבוגרים', 'play'],
  ['apps_500', 'gold', 'apps', 500, 200, '500 הופעות', '500 משחקים בבוגרים', 'play'],
  ['cs_1', 'bronze', 'clean_sheets', 1, 15, 'רשת נקייה', 'משחק ראשון בלי לספוג', 'gk'],
  ['cs_25', 'silver', 'clean_sheets', 25, 60, 'הקיר', '25 רשתות נקיות', 'gk'],
  ['cs_100', 'gold', 'clean_sheets', 100, 150, 'המנעול', '100 רשתות נקיות', 'gk'],
  ['derby_win', 'bronze', 'derby_wins', 1, 25, '{{מלך העיר|מלכת העיר}}', 'ניצחון בדרבי', 'club'],
  ['derby_wins_5', 'silver', 'derby_wins', 5, 60, 'העיר שלך', '5 ניצחונות בדרבי', 'club'],
  ['cup_win', 'silver', 'cup_wins', 1, 50, 'גביע ראשון', 'זכייה בגביע', 'club'],
  ['league_title', 'silver', 'league_titles', 1, 70, '{{אלופים|אלופות}}!', 'זכייה באליפות', 'club'],
  ['league_titles_3', 'gold', 'league_titles', 3, 120, 'שושלת', '3 אליפויות', 'club'],
  ['trophies_10', 'gold', 'trophies', 10, 150, 'ארון מלא', '10 תארים בקריירה', 'club'],
  ['promoted', 'bronze', 'promoted', 1, 30, 'עולים ליגה', 'עלייה ליגה עם הקבוצה', 'club'],
  ['captain', 'silver', 'captain', 1, 50, 'הסרט על הזרוע', '{{קפטן|קפטנית}} הקבוצה', 'club'],
  ['one_club', 'gold', 'one_club', 8, 100, 'מועדון אחד', '8 עונות באותו מועדון', 'club'],
  ['clubs_3', 'bronze', 'clubs', 3, 20, 'תרמיל על הגב', '3 מועדונים', 'journey'],
  ['moved_abroad', 'silver', 'abroad', 1, 50, 'טסים לאירופה', 'מעבר לקבוצה בחו"ל', 'journey'],
  ['top5', 'silver', 'top5', 1, 70, 'ליגות הטופ', 'משחק בליגה מחמש הגדולות', 'journey'],
  ['comeback', 'bronze', 'injury_comeback', 1, 25, 'חזרה מפציעה', 'חזרה אחרי פציעה ארוכה', 'journey'],
  ['veteran_35', 'gold', 'age_app', 35, 100, 'יין משובח', 'משחק בבוגרים בגיל 35', 'journey'],
  ['legend', 'gold', 'legacy', 320, 200, 'אגדה', '320 נקודות מורשת', 'journey'],
  ['europe_debut', 'bronze', 'europe_apps', 1, 25, 'לילות אירופה', 'משחק ראשון במפעל אירופי', 'europe'],
  ['ucl_debut', 'silver', 'ucl_apps', 1, 60, 'ההמנון', 'בכורה בליגת האלופות', 'europe'],
  ['ucl_goal', 'silver', 'ucl_goals', 1, 70, 'שער בליגת האלופות', 'שער ראשון בליגת האלופות', 'europe'],
  ['ucl_win', 'gold', 'ucl_wins', 1, 200, 'האוזניים הגדולות', 'זכייה בליגת האלופות', 'europe'],
  ['ynt_debut', 'bronze', 'ynt_apps', 1, 25, '{{נבחרת הנוער|נבחרת הנערות}}', 'משחק ראשון בנבחרת צעירה', 'national'],
  ['nt_debut', 'silver', 'nt_apps', 1, 60, 'הנבחרת הבוגרת', 'בכורה בנבחרת הבוגרת', 'national'],
  ['nt_goal', 'silver', 'nt_goals', 1, 70, 'שער בשביל המדינה', 'שער ראשון בנבחרת הבוגרת', 'national'],
  ['nt_caps_50', 'gold', 'nt_apps', 50, 120, '50 הופעות בנבחרת', '50 משחקים בנבחרת', 'national'],
  ['wc_play', 'silver', 'wc_apps', 1, 80, 'מונדיאל!', 'משחק בגביע העולם', 'national'],
  ['cont_win', 'gold', 'cont_wins', 1, 150, '{{אלופי היבשת|אלופות היבשת}}', 'זכייה באליפות היבשת', 'national'],
  ['wc_win', 'gold', 'wc_wins', 1, 300, '{{אלוף העולם|אלופת העולם}}', 'זכייה בגביע העולם', 'national'],
  ['tots', 'silver', 'tots', 1, 50, 'נבחרת העונה', 'מקום בנבחרת העונה', 'awards'],
  ['pots', 'gold', 'pots', 1, 100, '{{שחקן העונה|שחקנית העונה}}', 'פרס {{שחקן העונה|שחקנית העונה}}', 'awards'],
  ['golden_boy', 'gold', 'golden_boy', 1, 120, '{{הגולדן בוי|פרס הכישרון הצעיר}}', 'הכישרון הצעיר הטוב בעולם', 'awards'],
  ['ballon_top10', 'silver', 'ballon_top10', 1, 100, 'טופ 10 בעולם', 'עשירייה ראשונה בכדור הזהב', 'awards'],
  ['ballon_podium', 'gold', 'ballon_podium', 1, 150, 'על הפודיום', 'שלישייה ראשונה בכדור הזהב', 'awards'],
  ['ballon_win', 'gold', 'ballon_wins', 1, 300, 'כדור הזהב', 'זכייה בכדור הזהב', 'awards'],
  ['mgr_job', 'bronze', 'mgr_jobs', 1, 25, 'על הקווים', 'תפקיד אימון ראשון', 'manager'],
  ['mgr_wins_25', 'silver', 'mgr_wins', 25, 60, '25 ניצחונות על הקווים', '25 ניצחונות בתור {{מאמן|מאמנת}}', 'manager'],
  ['mgr_trophy', 'silver', 'mgr_trophies', 1, 80, 'תואר ראשון על הקווים', 'זכייה בתואר בתור {{מאמן|מאמנת}}', 'manager'],
  ['mgr_title', 'gold', 'mgr_titles', 1, 150, 'אליפות מהספסל', 'אליפות בתור {{מאמן|מאמנת}}', 'manager'],
  ['talk_ok', 'bronze', 'talk_ok', 1, 15, 'בגובה העיניים', 'שיחה מוצלחת עם המאמן', 'character'],
  ['talk_ok_3', 'silver', 'talk_ok', 3, 40, '{{יודע לדבר|יודעת לדבר}}', '3 שיחות מוצלחות עם המאמן', 'character'],
  ['burnout_survived', 'silver', 'burnout_survived', 1, 40, 'קמים מהקרשים', 'יציאה משחיקה', 'character'],
  ['streak_3', 'bronze', 'streak_best', 3, 15, '3 ימים ברצף', 'חזרת 3 ימים ברצף', 'meta'],
  ['streak_7', 'silver', 'streak_best', 7, 40, 'שבוע מושלם', '7 ימים ברצף', 'meta'],
  ['objectives_10', 'bronze', 'objectives', 10, 25, 'מכונת משימות', '10 משימות הושלמו', 'meta'],
  ['objectives_50', 'silver', 'objectives', 50, 80, 'אין משימה שלא נגמרת', '50 משימות הושלמו', 'meta'],
  ['stars_500', 'silver', 'stars_earned', 500, 50, 'אספן כוכבים', '500 ⭐ נאספו', 'meta'],
  ['style_first', 'bronze', 'cosmetics', 1, 10, 'סטייל', 'פריט ראשון מהפרסים', 'meta'],
  ['shared_card', 'bronze', 'shared', 1, 15, 'שגריר השכונה', 'שיתפת כרטיס', 'meta'],
  ['challenge_sent', 'bronze', 'challenges', 1, 15, 'אתגר נשלח', 'אתגרת חבר', 'meta'],
];
const GKDEF = ['clean_sheets'];
let _ach = null;
function achDefs() {
  if (_ach) return _ach;
  const rows = rowsOf('ACHIEVEMENTS');
  const out = [];
  const seen = new Set();
  if (rows) {
    for (const r of rows) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || seen.has(r.id) || typeof r.metric !== 'string' || !METRIC[r.metric]) continue;
      const tier = TIERS.indexOf(r.tier) >= 0 ? r.tier : 'bronze';
      seen.add(r.id);
      out.push({ id: r.id, tier, metric: r.metric, target: Math.max(1, num(r.target, 1)), stars: Math.max(0, Math.round(num(r.stars, TIER_STARS[tier]))),
        he: r.he, descHe: r.descHe || r.desc, cat: r.cat || '', icon: r.icon || '', hidden: !!r.hidden });
    }
  }
  if (out.length < 50) {
    for (const f of ACH_FALLBACK) {
      if (seen.has(f[0])) continue;
      seen.add(f[0]);
      out.push({ id: f[0], tier: f[1], metric: f[2], target: f[3], stars: f[4], he: f[5], descHe: f[6], cat: f[7], icon: '', hidden: false, fb: true });
    }
  }
  _ach = out;
  return out;
}
const FB_HE = {};
for (const f of ACH_FALLBACK) FB_HE[f[0]] = [f[5], f[6]];

// career snapshot for the achievement metrics (senior = league / cup / europe / national team)
const SENIOR = ['lg', 'cup', 'eu', 'nt'];
function seasonsStats(S) {
  const out = S.hist.seasons.map((x) => x.stats);
  if (!S.hist.seasons.some((x) => x.s === S.season)) out.push(S.player.s);
  return out;
}
function snap(S) {
  const p = S.player, M = MM(S);
  const st = seasonsStats(S);
  const sen = { apps: 0, st: 0, g: 0, a: 0, motm: 0, cs: 0, eu: 0 };
  let best = 0;
  for (const s of st) {
    const l = sumLines(s, SENIOR);
    sen.apps += l.apps; sen.st += l.st; sen.g += l.g; sen.a += l.a; sen.motm += l.motm;
    sen.cs += sumLines(s, ALL_LINES).cs;
    sen.eu += s.eu.apps;
    best = Math.max(best, sumLines(s, ALL_LINES).g);
  }
  const tro = S.hist.trophies, aws = S.hist.awards;
  const tk = (...ks) => tro.filter((x) => ks.indexOf(x.k) >= 0).length;
  const ak = (...ks) => aws.filter((x) => ks.indexOf(x.k) >= 0).length;
  const byClub = {};
  for (const x of S.hist.seasons) if (x.club) byClub[x.club] = (byClub[x.club] || 0) + 1;
  if (!S.hist.seasons.some((x) => x.s === S.season) && p.club) byClub[p.club] = (byClub[p.club] || 0) + 1;
  const clubs = new Set(S.hist.clubs.map((c) => c.club).filter(Boolean));
  const Mg = S.mgr;
  return { S, p, M, c: M.cnt, sen, best, tk, ak, byClub, clubs, Mg, fl: S.ev.flags || {} };
}
const METRIC = {
  debut: (D) => (D.S.hist.firsts.debut !== null ? 1 : 0),
  starts: (D) => D.sen.st, apps: (D) => D.sen.apps, goals: (D) => D.sen.g, assists: (D) => D.sen.a, motm: (D) => D.sen.motm,
  hat_tricks: (D) => D.c.hat || 0, bench_goals: (D) => D.c.benchG || 0, late_winners: (D) => D.c.lateW || 0, rating_max: (D) => D.c.rmax || 0,
  clean_sheets: (D) => D.sen.cs, pro_contract: (D) => (D.M.ms.pro || D.p.stage === 'pro' ? 1 : 0), derby_wins: (D) => D.c.derbyW || 0,
  league_titles: (D) => D.tk('league'), cup_wins: (D) => D.tk('cup'), trophies: (D) => D.S.hist.trophies.length, promoted: (D) => D.tk('league2'),
  captain: (D) => (D.fl.captain ? 1 : 0), one_club: (D) => Math.max(0, ...Object.values(D.byClub)), clubs: (D) => D.clubs.size,
  abroad: (D) => (D.M.ms.abroad ? 1 : 0), top5: (D) => (D.M.ms.top5 ? 1 : 0), europe_apps: (D) => D.sen.eu,
  ucl_apps: (D) => D.c.uclApps || 0, ucl_goals: (D) => D.c.uclG || 0, ucl_wins: (D) => D.tk('ucl'),
  ynt_apps: (D) => D.p.caps.u17 + D.p.caps.u19 + D.p.caps.u21, nt_apps: (D) => D.p.caps.senior, nt_goals: (D) => D.p.ig.senior,
  wc_apps: (D) => D.c.wcApps || 0, wc_wins: (D) => D.tk('wc'), cont_wins: (D) => D.tk('euro', 'copa', 'afcon', 'asian', 'gold'),
  golden_boy: (D) => D.ak('golden_boy'), top_scorer: (D) => D.ak('top_scorer'), pots: (D) => D.ak('pots'), tots: (D) => D.ak('tots'),
  ballon_top10: (D) => D.ak('bdo_top10', 'bdo_top3', 'ballon_dor'), ballon_podium: (D) => D.ak('bdo_top3', 'ballon_dor'), ballon_wins: (D) => D.ak('ballon_dor'),
  season_goals_best: (D) => D.best, teen_goals: (D) => D.c.teenG || 0, age_app: (D) => D.c.ageApp || 0, legacy: (D) => legacyScore(D.S),
  seasons: (D) => D.S.hist.seasons.length, injury_comeback: (D) => D.c.longInjRet || 0, burnout_survived: (D) => D.c.burnSurv || 0, talk_ok: (D) => D.c.talkOk || 0,
  mgr_jobs: (D) => (D.Mg && Array.isArray(D.Mg.jobs) ? D.Mg.jobs.length : 0), mgr_wins: (D) => (D.Mg && D.Mg.tot ? D.Mg.tot.w || 0 : 0),
  mgr_trophies: (D) => (D.Mg && Array.isArray(D.Mg.trophies) ? D.Mg.trophies.length : 0),
  mgr_titles: (D) => (D.Mg && Array.isArray(D.Mg.trophies) ? D.Mg.trophies.filter((t) => t.k === 'league').length : 0),
  mgr_awards: (D) => (D.Mg && Array.isArray(D.Mg.awards) ? D.Mg.awards.length : 0),
  streak_best: (D) => D.M.dly.best || 0, shared: (D) => D.c.share || 0, challenges: (D) => D.c.challenge || 0, objectives: (D) => D.c.objDone || 0,
  stars_earned: (D) => D.M.st.earn, cosmetics: (D) => D.M.cos.own.filter((id) => !isDefaultCos(id)).length,
};
function achVisible(S, d) {
  if (GKDEF.indexOf(d.metric) < 0) return true;
  const g = posGroup(S.player.pos);
  return g === 'GK' || g === 'DEF';
}
function achText(S, d) {
  const fb = FB_HE[d.id] || [d.id, ''];
  const v = { n: d.target, target: d.target };
  return { he: G(S, tx(d.he, fb[0], v)), descHe: G(S, tx(d.descHe, fb[1], v)) };
}
function achValue(D, d) { try { return Number(METRIC[d.metric](D)) || 0; } catch (e) { return 0; } }
/** Check every achievement against the current state; newly unlocked ones pay stars + toast + signal. */
export function checkAchievements(S) {
  const M = MM(S);
  if (!S.player) return [];
  let D = null;
  const out = [];
  for (const d of achDefs()) {
    if (M.ach[d.id] !== undefined || !achVisible(S, d)) continue;
    if (!D) D = snap(S);
    if (achValue(D, d) < d.target) continue;
    M.ach[d.id] = curAw(S);
    addStars(S, d.stars, 'achievement');
    const t = achText(S, d);
    const o = { k: 'achievement', id: d.id, tier: d.tier, he: t.he, descHe: t.descHe, stars: d.stars, icon: d.icon };
    toast(S, o);
    out.push(o);
    emit('achievement', { id: d.id, tier: d.tier });
    markInt(S, 'achievement', t.he);
    if (d.tier === 'gold') trig(S, 'achievement_gold');
  }
  return out;
}
export function achievementsVM(S) {
  const M = MM(S);
  const D = snap(S);
  const out = [];
  for (const d of achDefs()) {
    if (!achVisible(S, d)) continue;
    const un = M.ach[d.id] !== undefined;
    const v = achValue(D, d);
    const t = achText(S, d);
    out.push({ id: d.id, tier: d.tier, cat: d.cat, icon: d.icon, hidden: d.hidden, he: t.he, descHe: t.descHe, unlocked: un,
      progress: un ? d.target : Math.max(0, Math.min(d.target, Math.floor(v * 10) / 10)), target: d.target, unlockedAbs: un ? M.ach[d.id] : null, stars: d.stars });
  }
  return out;
}
export function achievementCount() { return achDefs().length; }

// ------------------------------------------------------------------ objectives (F4)
// Weekly: 3 active objectives from OBJECTIVES.weekly (row: { id, metric, target, val?, weeks, he, stars, reward, cond?, weight? });
// an objective lives `weeks` game weeks (counted from the week it appears) or until done; finished / expired ones are
// replaced at the next week start. Progress is accumulated by events (o.p). Season: one OBJECTIVES.season row per season.
const OBJ_FALLBACK = [
  { id: 'w_goal_1', metric: 'goals', target: 1, weeks: 2, he: '{{הבקע|הבקיעי}} שער', stars: 10, reward: { morale: 3 }, cond: { notGroups: ['GK'] }, weight: 3 },
  { id: 'w_assist_1', metric: 'assists', target: 1, weeks: 2, he: '{{בשל|בשלי}} שער', stars: 10, reward: { mates: 2 }, cond: { notGroups: ['GK'] }, weight: 2 },
  { id: 'w_rating_7', metric: 'rating_n', target: 1, val: 7.0, weeks: 2, he: 'ציון 7 ומעלה במשחק', stars: 10, reward: { trust: 2 }, weight: 3 },
  { id: 'w_rating_75', metric: 'rating_n', target: 1, val: 7.5, weeks: 2, he: 'ציון 7.5 ומעלה במשחק', stars: 15, reward: { trust: 2 }, weight: 2 },
  { id: 'w_starts_2', metric: 'starts', target: 2, weeks: 3, he: '{{פתח|פתחי}} בהרכב ב-2 משחקים', stars: 15, reward: { trust: 3 }, cond: { stage: ['pro'] } },
  { id: 'w_apps_2', metric: 'apps', target: 2, weeks: 2, he: '{{שחק|שחקי}} ב-2 משחקים', stars: 8, reward: { morale: 2 }, weight: 2 },
  { id: 'w_wins_2', metric: 'wins', target: 2, weeks: 3, he: '2 ניצחונות', stars: 12, reward: { morale: 3 } },
  { id: 'w_cs_1', metric: 'clean_sheets', target: 1, weeks: 2, he: '{{שמור|שמרי}} על רשת נקייה', stars: 15, reward: { trust: 2 }, cond: { groups: ['GK', 'DEF'] }, weight: 3 },
  { id: 'w_load_50', metric: 'load_end_below', target: 1, val: 50, weeks: 1, he: '{{סיים|סיימי}} שבוע עם עומס מתחת ל-50', stars: 8, reward: { energy: 10 } },
  { id: 'w_train_hard', metric: 'train_hard', target: 1, weeks: 2, he: 'שבוע של אימון קשה', stars: 8, reward: { trust: 2 }, cond: { minAge: 16 } },
];
const SEASON_FALLBACK = [
  { id: 's_goals_12', metric: 's_goals', target: 12, he: '12 שערים העונה', stars: 100, reward: { money: 25000 }, cond: { groups: ['ATT'] }, weight: 3 },
  { id: 's_goals_6', metric: 's_goals', target: 6, he: '6 שערים העונה', stars: 80, reward: { money: 15000 }, cond: { groups: ['MID'] }, weight: 2 },
  { id: 's_cs_8', metric: 's_clean_sheets', target: 8, he: '8 רשתות נקיות העונה', stars: 100, reward: { money: 20000 }, cond: { groups: ['GK', 'DEF'] }, weight: 3 },
  { id: 's_apps_25', metric: 's_apps', target: 25, he: '25 הופעות העונה', stars: 70, reward: { trust: 4 } },
];
const OBJ_MATCH = ['goals', 'assists', 'ga', 'starts', 'apps', 'minutes', 'wins', 'unbeaten', 'motm', 'rating_n', 'clean_sheets', 'brace', 'bench_goal', 'away_win', 'derby_win', 'europe_goals', 'nt_apps', 'cup_win'];
const OBJ_WEEK = ['load_end_below', 'energy_end_above', 'sharp_end_above', 'train_weeks', 'train_hard'];
const OBJ_EVENT = ['reply_msgs', 'talk_ok', 'shop_buy'];
const SEAS_METRICS = ['s_goals', 's_assists', 's_apps', 's_starts', 's_avg_rating', 's_clean_sheets', 's_motm', 'league_pos', 's_trophy', 's_callup', 'ovr_gain', 's_survive'];
function objRows(season) {
  const rows = rowsOf('OBJECTIVES', season ? 'season' : 'weekly');
  const ok = (r) => r && typeof r === 'object' && typeof r.id === 'string' && (season ? SEAS_METRICS : OBJ_MATCH.concat(OBJ_WEEK, OBJ_EVENT)).indexOf(r.metric) >= 0;
  const l = rows ? rows.filter(ok) : [];
  return l.length >= (season ? 2 : 6) ? l : (season ? SEASON_FALLBACK : OBJ_FALLBACK);
}
function inEurope(S) {
  const p = S.player;
  if (!p.club || !S.comp || !S.comp.eu) return false;
  for (const c of Object.keys(S.comp.eu)) {
    const E = S.comp.eu[c];
    if (!E) continue;
    if ((E.lp && E.lp.teams && E.lp.teams.indexOf(p.club) >= 0) || (E.q && E.q.some((t) => t[0] === p.club || t[1] === p.club)) || (E.pend && E.pend.indexOf(p.club) >= 0)) return true;
  }
  return false;
}
function benchRole(S) { const p = S.player; return p.stage === 'youth' || !!(p.contract && ['prospect', 'rotation', 'squad'].indexOf(p.contract.role) >= 0); }
function condOk(S, c, ctx) {
  if (!c || typeof c !== 'object') return true;
  const p = S.player;
  const g = posGroup(p.pos);
  const ovr = ovrOf(p);
  if (Array.isArray(c.groups) && c.groups.indexOf(g) < 0) return false;
  if (Array.isArray(c.notGroups) && c.notGroups.indexOf(g) >= 0) return false;
  if (Array.isArray(c.stage) && c.stage.indexOf(p.stage) < 0) return false;
  if (typeof c.minOvr === 'number' && ovr < c.minOvr) return false;
  if (typeof c.maxOvr === 'number' && ovr > c.maxOvr) return false;
  if (typeof c.minAge === 'number' && ageOf(S) < c.minAge) return false;
  if (c.derbyWeek && !(ctx && ctx.derbyWeek)) return false;
  if (c.europe && !inEurope(S)) return false;
  if (c.national && !(S.nt.called && Object.keys(S.nt.called).some((k) => S.nt.called[k]))) return false;
  if (c.bench && !benchRole(S)) return false;
  if (c.league && !(p.club && clubLeague(S, p.club))) return false;
  return true;
}
function objTarget(r) { return Math.max(1, Math.round(num(r.target, 1))); }
function objHe(S, o, r) {
  const v = { n: o.tgt, target: o.tgt, val: o.val || '' };
  return G(S, tx(r && r.he, o.id, v));
}
function rowById(season, id) { return objRows(season).find((r) => r.id === id) || null; }
function derbyThisWeek(S) {
  const p = S.player;
  const cd = p.club ? clubData(p.club) : null;
  if (!cd || !cd.rival || !S.comp) return false;
  return !!(S.wsum && S.wsum.derby);
}
function newObjective(S) {
  const M = MM(S);
  const r = rngFor(S.id, 'obj', M.obj.n);
  const active = M.obj.list.filter((o) => !o.done);
  const ctx = { derbyWeek: derbyThisWeek(S) };
  const cands = objRows(false).filter((row) => condOk(S, row.cond, ctx) && !active.some((o) => o.id === row.id || o.m === row.metric)
    && !(S.player.injury && S.player.injury.weeks >= 2 && OBJ_MATCH.indexOf(row.metric) >= 0)
    && !(M.obj.recent || []).includes(row.id));
  if (!cands.length) return null;
  const row = r.weighted(cands, (x) => num(x.weight, 1));
  M.obj.n++;
  const aw = curAw(S);
  const weeks = Math.max(1, Math.round(num(row.weeks, 2)));
  return { id: row.id, m: row.metric, val: typeof row.val === 'number' ? row.val : null, tgt: objTarget(row), p: 0, stars: Math.max(0, Math.round(num(row.stars, 10))),
    rw: row.reward && typeof row.reward === 'object' ? Object.assign({}, row.reward) : {}, done: false, aw, exp: aw + weeks - 1 };
}
/** Week start (and career start): drop finished / expired objectives, refill to 3, open the season objective. */
export function refreshObjectives(S) {
  const M = MM(S);
  if (!playing(S)) { M.obj.list = []; return; }
  const aw = curAw(S);
  const gone = M.obj.list.filter((o) => o.done || o.exp < aw).map((o) => o.id);
  M.obj.recent = gone.slice(-3);
  M.obj.list = M.obj.list.filter((o) => !o.done && o.exp >= aw);
  let guard = 0;
  while (M.obj.list.length < 3 && guard++ < 8) {
    const o = newObjective(S);
    if (!o) break;
    M.obj.list.push(o);
  }
  if (!M.obj.seas || M.obj.seas.season !== S.season) openSeasonObjective(S);
  if (S.nt.called && Object.keys(S.nt.called).some((k) => S.nt.called[k]) && M.obj.seas && M.obj.seas.season === S.season) M.obj.seas.called = true;
}
function openSeasonObjective(S) {
  const M = MM(S);
  if (S.week > 36) { M.obj.seas = null; return; }
  const r = rngFor(S.id, S.season, 'sobj');
  const cands = objRows(true).filter((row) => condOk(S, row.cond, {}));
  if (!cands.length) { M.obj.seas = null; return; }
  const row = r.weighted(cands, (x) => num(x.weight, 1));
  let tgt = objTarget(row);
  const left = clamp((44 - S.week + 1) / 44, 0.25, 1);
  if (['s_goals', 's_assists', 's_apps', 's_starts', 's_clean_sheets', 's_motm', 'ovr_gain'].indexOf(row.metric) >= 0) tgt = Math.max(1, Math.round(tgt * left));
  // the objective counts from the week it opens: a baseline of the season so far (a mid-season open or a migrated save
  // never pays at once), and the OVR gain is measured from the OVR of that week (after the v5 lift)
  const o = { id: row.id, m: row.metric, val: typeof row.val === 'number' ? row.val : null, tgt, season: S.season, done: false, failed: false, called: false,
    o0: ovrOf(S.player), base: 0, stars: Math.max(0, Math.round(num(row.stars, 80))), rw: row.reward && typeof row.reward === 'object' ? Object.assign({}, row.reward) : {} };
  o.base = seasonRaw(S, o);
  M.obj.seas = o;
}
const SEAS_COUNT = ['s_goals', 's_assists', 's_apps', 's_starts', 's_clean_sheets', 's_motm', 's_trophy'];
function seasonRaw(S, o) {
  const l = sumLines(S.player.s, ALL_LINES);
  switch (o.m) {
    case 's_goals': return l.g;
    case 's_assists': return l.a;
    case 's_apps': return l.apps;
    case 's_starts': return l.st;
    case 's_clean_sheets': return l.cs;
    case 's_motm': return l.motm;
    case 's_trophy': return S.hist.trophies.filter((t) => t.s === S.season).length;
    default: return 0;
  }
}
function seasonProgress(S, o) {
  const p = S.player;
  const l = sumLines(p.s, ALL_LINES);
  if (SEAS_COUNT.indexOf(o.m) >= 0) return Math.max(0, seasonRaw(S, o) - (typeof o.base === 'number' ? o.base : 0));
  switch (o.m) {
    case 's_avg_rating': return l.apps >= 10 && l.rs / l.apps >= (o.val || 7) ? 1 : 0;
    case 's_callup': return o.called ? 1 : 0;
    case 'ovr_gain': return Math.max(0, ovrOf(p) - (o.o0 || ovrOf(p)));
    case 'league_pos': return o.res === true ? 1 : 0;
    case 's_survive': return o.res === true ? 1 : 0;
    default: return 0;
  }
}
function objVM(S, o, season) {
  const row = rowById(season, o.id);
  const prog = season ? seasonProgress(S, o) : o.p;
  const aw = curAw(S);
  return { id: o.id, metric: o.m, he: objHe(S, o, row), progress: o.done ? o.tgt : clamp(Math.floor(prog), 0, o.tgt), target: o.tgt, rewardHe: rewardHe(S, o.stars, o.rw), rewardStars: o.stars,
    done: !!o.done, failed: !!o.failed, weeksLeft: season ? Math.max(0, 44 - S.week + 1) : Math.max(0, o.exp - aw + 1) };
}
export function objectivesVM(S) {
  const M = MM(S);
  if (!playing(S)) return { weekly: [], season: null };
  return { weekly: M.obj.list.map((o) => objVM(S, o, false)), season: M.obj.seas && M.obj.seas.season === S.season ? objVM(S, M.obj.seas, true) : null };
}
function payObjective(S, o, season) {
  o.done = true;
  addStars(S, o.stars, season ? 'season' : 'objective');
  applyFx(S, o.rw);
  inc(S, 'objDone');
  const vm = objVM(S, o, season);
  const t = { k: 'objective', id: o.id, he: vm.he, rewardHe: vm.rewardHe, stars: o.stars, season };
  toast(S, t);
  emit('objective_done', { id: o.id, kind: season ? 'season' : 'weekly', season: !!season });
  markInt(S, 'objective', vm.he);
  if (season) trig(S, 'objective_season');
  return t;
}
/** Pay finished objectives (after a match / an event / at week end). */
export function checkObjectives(S) {
  const M = MM(S);
  const out = [];
  if (!playing(S)) return out;
  for (const o of M.obj.list) if (!o.done && o.p >= o.tgt) out.push(payObjective(S, o, false));
  const so = M.obj.seas;
  if (so && so.season === S.season && !so.done && !so.failed && so.m !== 'league_pos' && so.m !== 's_survive' && seasonProgress(S, so) >= so.tgt) out.push(payObjective(S, so, true));
  return out;
}
function bump(S, metric, n, pred) {
  const M = MM(S);
  for (const o of M.obj.list) {
    if (o.done || o.m !== metric) continue;
    if (pred && !pred(o)) continue;
    o.p += n;
  }
}
function resetObj(S, metric) { for (const o of MM(S).obj.list) if (!o.done && o.m === metric) o.p = 0; }
function objOnMatch(S, info) {
  const fx = info.fx;
  const W = info.res === 'W';
  bump(S, 'goals', info.g); bump(S, 'assists', info.a); bump(S, 'ga', info.g + info.a);
  if (info.starter) bump(S, 'starts', 1);
  bump(S, 'apps', 1); bump(S, 'minutes', info.minutes);
  if (W) bump(S, 'wins', 1);
  if (info.res !== 'L') bump(S, 'unbeaten', 1); else resetObj(S, 'unbeaten');
  if (info.rating >= 8.0) bump(S, 'motm', 1);
  bump(S, 'rating_n', 1, (o) => info.rating >= (o.val || 7));
  if (info.cs) bump(S, 'clean_sheets', 1);
  if (info.g >= 2) bump(S, 'brace', 1);
  if (info.role === 'bench' && info.g > 0) bump(S, 'bench_goal', 1);
  if (W && !info.home) bump(S, 'away_win', 1);
  if (W && info.derby) bump(S, 'derby_win', 1);
  if (fx.kind === 'europe') bump(S, 'europe_goals', info.g);
  if (fx.kind === 'national' || fx.kind === 'friendly' || fx.kind === 'ynt') bump(S, 'nt_apps', 1);
  if (fx.kind === 'cup' && (info.tieWon === true || (info.tieWon === null && W))) bump(S, 'cup_win', 1);
}
function objOnWeek(S, ctx) {
  const p = S.player;
  bump(S, 'load_end_below', 1, (o) => p.load < (o.val || 50));
  bump(S, 'energy_end_above', 1, (o) => p.energy > (o.val || 70));
  bump(S, 'sharp_end_above', 1, (o) => p.sharp > (o.val || 70));
  if (ctx.focus !== 'rest' && !ctx.injured) bump(S, 'train_weeks', 1); else resetObj(S, 'train_weeks');
  if (!ctx.injured && (ctx.intensity === 'hard' || ctx.intensity === 'extreme')) bump(S, 'train_hard', 1);
}
/** Week 44: league_pos / s_survive resolve; an unfinished season objective fails. */
export function seasonObjectiveEnd(S) {
  const M = MM(S);
  const o = M.obj.seas;
  if (!o || o.season !== S.season || o.done) return;
  const end = S.comp && S.comp.end;
  if (o.m === 'league_pos' && end && end.rank) o.res = end.rank <= (o.val || 4);
  if (o.m === 's_survive' && end && end.lg && end.rank) {
    const lg = LEAGUE_BY_ID[end.lg];
    const N = S.comp.lg[end.lg] ? S.comp.lg[end.lg].t.length : 99;
    o.res = !(lg && lg.relegation && end.rank > N - lg.relegation.count);
  }
  if (seasonProgress(S, o) >= o.tgt) payObjective(S, o, true);
  else o.failed = true;
}

// ------------------------------------------------------------------ cosmetics + boosts (F6)
// COSMETICS.items: { id, slot, he, descHe, price (⭐, 0 = owned from the start), default?, rarity, colors?, style?, frame?, acc?, boost?, limit?, gender? }
const COS_FALLBACK = [
  { id: 'boots_classic', slot: 'boots', he: 'שחורות קלאסיות', price: 0, default: true, rarity: 'common', colors: ['#1B1F27', '#FFFFFF'] },
  { id: 'boots_white', slot: 'boots', he: 'לבנות', price: 40, rarity: 'common', colors: ['#F4F6FA', '#C9A227'] },
  { id: 'boots_neon', slot: 'boots', he: 'ירוק ניאון', price: 80, rarity: 'rare', colors: ['#7CFF3B', '#14202B'] },
  { id: 'boots_pink', slot: 'boots', he: 'ורודות', price: 100, rarity: 'rare', colors: ['#FF5FA2', '#FFFFFF'] },
  { id: 'boots_gold', slot: 'boots', he: 'זהב טהור', price: 250, rarity: 'epic', colors: ['#E8B931', '#6B4A00'] },
  { id: 'cel_classic', slot: 'celebration', he: 'ריצה לקהל', price: 0, default: true, rarity: 'common', style: 'classic' },
  { id: 'cel_knee_slide', slot: 'celebration', he: 'החלקת ברכיים', price: 60, rarity: 'common', style: 'knee_slide' },
  { id: 'cel_heart', slot: 'celebration', he: 'לב לקהל', price: 60, rarity: 'common', style: 'heart_hands' },
  { id: 'cel_spin_jump', slot: 'celebration', he: 'קפיצת הסיבוב', price: 200, rarity: 'epic', style: 'spin_jump' },
  { id: 'cel_backflip', slot: 'celebration', he: 'סלטה אחורית', price: 300, rarity: 'legendary', style: 'backflip' },
  { id: 'frame_basic', slot: 'frame', he: 'מסגרת רגילה', price: 0, default: true, rarity: 'common', frame: 'basic' },
  { id: 'frame_silver', slot: 'frame', he: 'כסף', price: 50, rarity: 'common', frame: 'silver' },
  { id: 'frame_gold', slot: 'frame', he: 'זהב', price: 200, rarity: 'epic', frame: 'gold' },
  { id: 'frame_holo', slot: 'frame', he: 'הולוגרמה', price: 350, rarity: 'legendary', frame: 'holo' },
  { id: 'acc_none', slot: 'accessory', he: 'בלי אביזר', price: 0, default: true, rarity: 'common', acc: 'none' },
  { id: 'acc_headband', slot: 'accessory', he: 'סרט ראש', price: 40, rarity: 'common', acc: 'headband' },
  { id: 'acc_armband', slot: 'accessory', he: 'סרט קפטן', price: 150, rarity: 'epic', acc: 'armband' },
  { id: 'boost_energy', slot: 'boost', he: 'מילוי אנרגיה', descHe: 'אנרגיה מלאה, פעם בשבוע', price: 30, rarity: 'common', boost: 'energy_refill', limit: { perWeeks: 1 } },
  { id: 'boost_scout', slot: 'boost', he: 'הסקאוט הראשי', descHe: 'הפוטנציאל המדויק שלך', price: 120, rarity: 'epic', boost: 'scout_report', limit: { perSeason: 1 } },
];
const SLOT_HE = { boots: 'נעליים', celebration: 'חגיגת שער', frame: 'מסגרת לכרטיס', accessory: 'אביזר', boost: 'חיזוקים' };
let _cos = null;
function cosItems() {
  if (_cos) return _cos;
  const rows = rowsOf('COSMETICS', 'items');
  const ok = (r) => r && typeof r === 'object' && typeof r.id === 'string' && (SLOTS.indexOf(r.slot) >= 0 || r.slot === 'boost');
  const l = rows ? rows.filter(ok) : [];
  _cos = l.length >= 8 ? l : COS_FALLBACK;
  return _cos;
}
function cosById(id) { return cosItems().find((c) => c.id === id) || null; }
export function isDefaultCos(id) { const c = cosById(id); return !!(c && (c.default || num(c.price, 1) === 0)); }
function cosForCareer(S, c) { return !c.gender || c.gender === gOf(S); }
/** Default items (price 0) are owned and equipped from the start. */
function initCosmetics(S) {
  const M = S.meta;
  M.cosInit = true;
  for (const c of cosItems()) {
    if (c.slot === 'boost' || !(c.default || num(c.price, 1) === 0)) continue;
    if (M.cos.own.indexOf(c.id) < 0) M.cos.own.push(c.id);
    if (!M.cos.eq[c.slot]) M.cos.eq[c.slot] = c.id;
  }
}
function cosPrice(c) { return Math.max(0, Math.round(num(c.price, 50))); }
function boostReason(S, c) {
  const M = MM(S), p = S.player;
  if (!playing(S)) return 'הקריירה הסתיימה';
  const aw = curAw(S);
  const k = c.boost || c.id;
  if (k === 'energy_refill' || c.id === 'boost_energy') {
    const per = Math.max(1, num(c.limit && c.limit.perWeeks, 1));
    if (aw - (M.bst.en || -99) < per) return per > 1 ? 'אפשר שוב בעוד ' + (per - (aw - M.bst.en)) + ' שבועות' : 'כבר השתמשת השבוע';
    if (p.energy >= 100) return 'האנרגיה כבר מלאה';
  } else if (k === 'scout_report' || c.id === 'boost_scout') {
    if (M.bst.scout) return 'הפוטנציאל המדויק כבר ידוע: ' + p.pot;
  } else if (k === 'morale_boost') {
    const per = Math.max(1, num(c.limit && c.limit.perWeeks, 2));
    if (aw - (M.bst.mo || -99) < per) return 'אפשר שוב בעוד ' + (per - (aw - M.bst.mo)) + ' שבועות';
    if (p.morale >= 100) return 'המורל כבר בשמיים';
  } else return 'לא זמין';
  return null;
}
function cosVM(S, c) {
  const M = MM(S);
  const price = cosPrice(c);
  const boost = c.slot === 'boost';
  const owned = boost ? ((c.boost === 'scout_report' || c.id === 'boost_scout') && !!M.bst.scout) : M.cos.own.indexOf(c.id) >= 0;
  let reason = boost ? boostReason(S, c) : (owned ? '' : null);
  if (!boost && owned) reason = null;
  if (reason === null && !owned && M.st.bal < price) reason = 'חסרים עוד ' + (price - M.st.bal) + ' ⭐';
  return { id: c.id, slot: c.slot, slotHe: SLOT_HE[c.slot] || '', he: G(S, tx(c.he, c.id)), descHe: G(S, tx(c.descHe, '')), price, rarity: c.rarity || 'common',
    colors: Array.isArray(c.colors) ? c.colors.slice(0, 2) : null, style: c.style || null, frame: c.frame || null, acc: c.acc || null, boost: c.boost || null,
    owned, equipped: !boost && M.cos.eq[c.slot] === c.id, canBuy: !owned && !reason, canEquip: !boost && owned && M.cos.eq[c.slot] !== c.id, reasonHe: reason || '', isDefault: !!(c.default || price === 0) };
}
/** The equipped items with their drawing keys (boots colours, celebration style, card frame, accessory). */
export function equippedOf(S) {
  const M = MM(S);
  const eq = Object.assign({ boots: null, celebration: null, frame: null, accessory: null }, M.cos.eq);
  const b = eq.boots && cosById(eq.boots), ce = eq.celebration && cosById(eq.celebration), fr = eq.frame && cosById(eq.frame), ac = eq.accessory && cosById(eq.accessory);
  return Object.assign(eq, {
    bootsColors: b && Array.isArray(b.colors) ? b.colors.slice(0, 2) : null, celebrationStyle: (ce && ce.style) || 'classic',
    frameKey: (fr && fr.frame) || 'basic', accKey: (ac && ac.acc) || 'none', accColors: ac && Array.isArray(ac.colors) ? ac.colors.slice(0, 2) : null,
  });
}
export function cosmeticsVM(S) {
  const M = MM(S);
  const items = cosItems().filter((c) => cosForCareer(S, c)).map((c) => cosVM(S, c));
  const slots = SLOTS.concat(['boost']).map((s) => {
    const T = table('COSMETICS');
    const sl = T && T.slots && T.slots[s];
    return { id: s, he: G(S, tx(sl && sl.he, SLOT_HE[s])), icon: (sl && sl.icon) || '' };
  });
  return { owned: M.cos.own.slice(), equipped: equippedOf(S), balance: M.st.bal, items, slots };
}
export function spendStars(S, id) {
  const M = MM(S), p = S.player;
  const c = cosById(id);
  if (!c || !cosForCareer(S, c)) return { ok: false, error: 'unknown_item', messageHe: 'פריט לא קיים' };
  const price = cosPrice(c);
  const he = G(S, tx(c.he, c.id));
  const T = table('COSMETICS');
  const ui = (T && T.ui) || {};
  if (c.slot === 'boost') {
    const r = boostReason(S, c);
    if (r) return { ok: false, error: 'not_now', messageHe: r };
    if (M.st.bal < price) return { ok: false, error: 'no_stars', messageHe: 'חסרים עוד ' + (price - M.st.bal) + ' ⭐' };
    takeStars(S, price, c.id);
    inc(S, 'starBuy');
    bump(S, 'shop_buy', 1);
    const aw = curAw(S);
    const k = c.boost || c.id;
    if (k === 'energy_refill' || c.id === 'boost_energy') { M.bst.en = aw; p.energy = 100; return { ok: true, messageHe: G(S, tx(ui.energyDone, 'האנרגיה מלאה! 100')), balance: M.st.bal, extra: checkAll(S) }; }
    if (k === 'morale_boost') { M.bst.mo = aw; p.morale = Math.min(100, p.morale + 15); return { ok: true, messageHe: G(S, tx(ui.moraleDone, 'המורל עלה!')), balance: M.st.bal, extra: checkAll(S) }; }
    M.bst.scout = true; M.bst.sc = S.season;
    p.potSeen = [p.pot, p.pot];
    return { ok: true, messageHe: G(S, tx(ui.scoutDone, 'הסקאוט הראשי: הפוטנציאל שלך הוא {pot}', { pot: p.pot })), balance: M.st.bal, pot: p.pot, extra: checkAll(S) };
  }
  if (M.cos.own.indexOf(id) >= 0) return { ok: false, error: 'owned', messageHe: 'כבר שלך' };
  if (M.st.bal < price) return { ok: false, error: 'no_stars', messageHe: G(S, tx(ui.notEnough, 'חסרים עוד {n} ⭐', { n: price - M.st.bal })) };
  takeStars(S, price, c.id);
  M.cos.own.push(id);
  M.cos.eq[c.slot] = id;
  bump(S, 'shop_buy', 1);
  const extra = checkAll(S);
  return { ok: true, messageHe: G(S, tx(ui.bought, '{he}: שלך!', { he })), balance: M.st.bal, equipped: equippedOf(S), extra };
}
export function equipCosmetic(S, slot, id) {
  const M = MM(S);
  if (SLOTS.indexOf(slot) < 0) return { ok: false, error: 'bad_slot' };
  if (id === null || id === undefined || id === '') {
    const def = cosItems().find((c) => c.slot === slot && (c.default || num(c.price, 1) === 0));
    M.cos.eq[slot] = def ? def.id : null;
    return { ok: true, equipped: equippedOf(S) };
  }
  const c = cosById(id);
  if (!c || c.slot !== slot) return { ok: false, error: 'bad_item' };
  if (M.cos.own.indexOf(id) < 0) return { ok: false, error: 'not_owned', messageHe: 'הפריט לא שלך' };
  M.cos.eq[slot] = id;
  return { ok: true, equipped: equippedOf(S) };
}
export function starsVM(S) {
  const M = MM(S);
  return { balance: M.st.bal, earnedTotal: M.st.earn, spent: M.st.spent,
    recent: M.st.log.slice(-8).reverse().map((x) => ({ delta: x.d, srcHe: SRC_HE[x.s] || (cosById(x.s) ? G(S, tx(cosById(x.s).he, x.s)) : 'פרסים') })) };
}

// ------------------------------------------------------------------ career path (F7)
// PATH.steps: { id, he, doneHe, teaserHe, reachHe, missing: { default, n?, n1?, ovr?, ovr1?, age? } }
const PATH_IDS = ['debut', 'first_goal', 'starter', 'pro_contract', 'youth_nt', 'abroad_offer', 'top5', 'ucl', 'senior_nt', 'ballon_top10', 'legend'];
const PATH_FB = {
  debut: ['בכורה', 'לבכורה בבוגרים'], first_goal: ['שער ראשון', 'לשער ראשון בבוגרים'], starter: ['מקום בהרכב', 'למקום קבוע בהרכב'],
  pro_contract: ['חוזה מקצועני', 'לחוזה מקצועני'], youth_nt: ['{{נבחרת הנוער|נבחרת הנערות}}', 'ל{{נבחרת הנוער|נבחרת הנערות}}'], abroad_offer: ['הצעה מחו"ל', 'להצעה מחו"ל'],
  top5: ['ליגת טופ 5', 'לליגת טופ 5'], ucl: ['ליגת האלופות', 'לליגת האלופות'], senior_nt: ['הנבחרת הבוגרת', 'לנבחרת הבוגרת'],
  ballon_top10: ['טופ 10 בכדור הזהב', 'לטופ 10 בכדור הזהב'], legend: ['אגדה', 'למעמד של אגדה'],
};
const MISS_FB = {
  debut: { default: 'משחק הבכורה מחכה לך' }, first_goal: { default: 'שער אחד, והשם שלך על לוח המבקיעים' },
  starter: { default: '{{תפתח|תפתחי}} בהרכב', n: 'עוד {n} משחקים בהרכב, {{ואתה|ואת}} חלק מההרכב הקבוע', n1: 'עוד משחק אחד בהרכב, {{ואתה|ואת}} חלק מההרכב הקבוע' },
  pro_contract: { default: 'עוד כמה משחקים טובים, והמועדון יגיש חוזה', n: 'עוד {n} משחקים טובים, והמועדון יגיש חוזה', n1: 'עוד משחק טוב אחד, והמועדון יגיש חוזה', age: 'חוזה מקצועני נפתח בגיל {age}',
    offer: 'הצעת חוזה מחכה לך! {{לחץ|לחצי}} כאן {{ותחתום|ותחתמי}}', later: 'ההצעה הבאה תגיע בסוף העונה. כל משחק טוב מקרב אותה' },
  youth_nt: { default: 'עוד כמה משחקים טובים, והנבחרת הצעירה תתקשר', ovr: 'עוד {n} נקודות יכולת, והנבחרת הצעירה תתקשר', ovr1: 'עוד נקודת יכולת אחת, והנבחרת הצעירה תתקשר' },
  abroad_offer: { default: 'משחקים גדולים מביאים סקאוטים מאירופה', ovr: 'עוד {n} נקודות יכולת, והסקאוטים מאירופה יגיעו', ovr1: 'עוד נקודת יכולת אחת, והסקאוטים מאירופה יגיעו' },
  top5: { default: 'הצעה מאנגליה, ספרד, איטליה, גרמניה או צרפת', ovr: 'עוד {n} נקודות יכולת, והליגות הגדולות יתעניינו', ovr1: 'עוד נקודת יכולת אחת, והליגות הגדולות יתעניינו' },
  ucl: { default: 'קבוצה שמשחקת בליגת האלופות, או עונה בצמרת הליגה', ovr: 'עוד {n} נקודות יכולת, והגדולות של אירופה יבואו', ovr1: 'עוד נקודת יכולת אחת, והגדולות של אירופה יבואו' },
  senior_nt: { default: 'עונה חזקה בהרכב, ומאמן הנבחרת יתקשר', ovr: 'עוד {n} נקודות יכולת {{ותזומן|ותזומני}} לנבחרת {nation}', ovr1: 'עוד נקודת יכולת אחת {{ותזומן|ותזומני}} לנבחרת {nation}' },
  ballon_top10: { default: 'עונה ענקית: שערים, תארים וממוצע 7.5 ומעלה', ovr: 'עוד {n} נקודות יכולת, ו{{אתה|את}} ברשימה של הטובים בעולם', ovr1: 'עוד נקודת יכולת אחת, ו{{אתה|את}} ברשימה של הטובים בעולם' },
  legend: { default: 'תארים, פרסים ושנים בצמרת', n: 'עוד {n} נקודות מורשת, ו{{אתה|את}} אגדה', n1: 'עוד נקודת מורשת אחת, ו{{אתה|את}} אגדה' },
};
function pathRow(id) { const rows = rowsOf('PATH', 'steps'); return (rows && rows.find((r) => r && r.id === id)) || null; }
function ftApps(S) {
  let n = 0;
  for (const s of seasonsStats(S)) n += s.lg.apps + s.cup.apps + s.eu.apps;
  return n;
}
function ftStarts(S) {
  let n = 0;
  for (const s of seasonsStats(S)) n += s.lg.st + s.cup.st + s.eu.st;
  return n;
}
function yntLevel(S) { const a = ageOf(S); return a <= 16 ? 'u17' : a <= 18 ? 'u19' : a <= 21 ? 'u21' : null; }
function stepDone(S, id) {
  const p = S.player, F = S.hist.firsts, M = MM(S), fl = S.ev.flags || {};
  switch (id) {
    case 'debut': return F.debut !== null;
    case 'first_goal': return F.goal !== null;
    case 'starter': return ftStarts(S) >= 3;
    case 'pro_contract': return !!M.ms.pro || p.stage === 'pro';
    case 'youth_nt': return !!(fl._call_u17 || fl._call_u19 || fl._call_u21 || fl._call_senior) || p.caps.senior > 0 || !yntLevel(S);
    case 'abroad_offer': return !!M.ms.abroadOffer || !!M.ms.abroad;
    case 'top5': return !!M.ms.top5;
    case 'ucl': return cnt(S, 'uclApps') >= 1;
    case 'senior_nt': return F.ntDebut !== null;
    case 'ballon_top10': return S.hist.awards.some((a) => a.k === 'bdo_top10' || a.k === 'bdo_top3' || a.k === 'ballon_dor');
    case 'legend': return legacyScore(S) >= 320;
    default: return false;
  }
}
function stepHe(S, id) { const r = pathRow(id); return G(S, tx(r && r.he, (PATH_FB[id] || [id])[0])); }
function stepReach(S, id) { const r = pathRow(id); return G(S, tx(r && r.reachHe, (PATH_FB[id] || [id, id])[1])); }
function stepMissing(S, id) {
  const p = S.player;
  const ovr = ovrOf(p);
  const nat = country(p.nation);
  let key = 'default', n = 0, prog = 0, route = null;
  switch (id) {
    case 'starter': n = Math.max(1, 3 - ftStarts(S)); key = n === 1 ? 'n1' : 'n'; prog = ftStarts(S) / 3; break;
    case 'pro_contract':
      // an open offer: sign it (the path links to the offers screen); a declined / missed one: the next comes at season end
      if (S.offers.some((o) => o.status === 'open' && o.type === 'pro')) { key = 'offer'; prog = 0.95; route = '#/offers'; break; }
      if (ageOf(S) < 16) { key = 'age'; n = 16; break; }
      if (ftApps(S) >= 3) { key = 'later'; prog = 0.8; break; }
      n = Math.max(1, 3 - ftApps(S)); key = n === 1 ? 'n1' : 'n'; prog = Math.min(1, ftApps(S) / 3); break;
    case 'youth_nt': {
      const thr = youthThreshold(yntLevel(S) || 'u21', nstr(S, p.nation));
      n = Math.ceil(thr - ovr - yntBoost(S));
      if (n > 0) key = n === 1 ? 'ovr1' : 'ovr';
      prog = clamp(ovr / Math.max(1, thr), 0, 1); break;
    }
    case 'abroad_offer': { const t = 64; n = t - ovr; if (n > 0) key = n === 1 ? 'ovr1' : 'ovr'; prog = clamp(ovr / t, 0, 1); break; }
    case 'top5': { const t = 72; n = t - ovr; if (n > 0) key = n === 1 ? 'ovr1' : 'ovr'; prog = clamp(ovr / t, 0, 1); break; }
    case 'ucl': { const t = 76; n = t - ovr; if (n > 0) key = n === 1 ? 'ovr1' : 'ovr'; prog = clamp(ovr / t, 0, 1); break; }
    case 'senior_nt': { const t = nstr(S, p.nation) - 3; n = Math.ceil(t - seniorScore(S)); if (n > 0) key = n === 1 ? 'ovr1' : 'ovr'; prog = clamp(seniorScore(S) / Math.max(1, t), 0, 1); break; }
    case 'ballon_top10': { const t = 86; n = t - ovr; if (n > 0) key = n === 1 ? 'ovr1' : 'ovr'; prog = clamp(ovr / t, 0, 1); break; }
    case 'legend': { const L = legacyScore(S); n = Math.max(1, Math.ceil(320 - L)); key = n === 1 ? 'n1' : 'n'; prog = clamp(L / 320, 0, 1); break; }
    default: break;
  }
  const r = pathRow(id);
  const ms = (r && r.missing && typeof r.missing === 'object') ? r.missing : {};
  const fb = MISS_FB[id] || { default: '' };
  const vars = { n, age: n, nation: nat ? nat.nameHe : '' };
  const he = tx(ms[key], fb[key] || ms.default || fb.default, vars);
  return { missingHe: G(S, PH.test(he) ? tx(ms.default, fb.default, vars) : he), progress: round1(clamp(prog, 0, 1)), route };
}
export function pathVM(S) {
  const steps = PATH_IDS.map((id) => ({ id, he: stepHe(S, id), done: stepDone(S, id), reachedAge: MM(S).ms['p_' + id] ? MM(S).ms['p_' + id].age : null }));
  const nx = steps.find((s) => !s.done);
  let next = null;
  if (nx && !S.retired) {
    const m = stepMissing(S, nx.id);
    const r = pathRow(nx.id);
    next = { id: nx.id, he: nx.he, missingHe: m.missingHe, progress: m.progress, route: m.route || null, teaserHe: G(S, tx(r && r.teaserHe, 'הבא: ' + nx.he)) };
  }
  return { steps, next, doneCount: steps.filter((s) => s.done).length, total: steps.length };
}
/** Record milestones the first time they are reached ({ aw, age }) - the challenge link and the share card use them. */
export function checkPath(S) {
  const M = MM(S);
  const out = [];
  if (!S.player || S.retired) return out;
  for (const id of PATH_IDS) {
    if (M.ms['p_' + id]) continue;
    if (!stepDone(S, id)) continue;
    M.ms['p_' + id] = { aw: curAw(S), age: ageOf(S) };
    const t = { k: 'milestone', id, he: stepHe(S, id) };
    if (id !== 'debut' && id !== 'first_goal' && !(id === 'youth_nt' && !yntLevel(S))) { toast(S, t); markInt(S, 'path', t.he); }
    out.push(t);
  }
  return out;
}
/** Milestone flags derived from the state (after a match / an answer / at week end). */
export function noteFlags(S) {
  const M = MM(S), p = S.player;
  if (!p || S.retired) return;
  if (p.stage === 'pro') M.ms.pro = true;
  if (S.ev.flags && S.ev.flags.abroad) M.ms.abroad = true;
  if (p.club && TOP5.indexOf(clubLeague(S, p.club)) >= 0) M.ms.top5 = true;
  if (S.offers.some((o) => o.status === 'open' && o.club && (o.type === 'transfer' || o.type === 'loan' || o.type === 'free' || o.type === 'precontract') && clubCountry(o.club) !== p.nation)) M.ms.abroadOffer = true;
  if (p.ld && typeof p.ld.burns === 'number' && p.ld.burns > (M.burnSeen || 0) && p.load < 40) { M.burnSeen = p.ld.burns; inc(S, 'burnSurv'); }
}
const TOP5 = ['eng1', 'esp1', 'ita1', 'ger1', 'fra1'];
export function checkAll(S) {
  noteFlags(S);
  const a = checkAchievements(S);
  const o = checkObjectives(S);
  const m = checkPath(S);
  if (o.length || a.length) a.push(...checkAchievements(S));   // objectives / stars counters may unlock more
  return { achievements: a, objectives: o, milestones: m };
}

// ------------------------------------------------------------------ match stakes (F9)
// STAKES.kinds[kind] = { prio, need: win|not_lose|score|ga|rating|clean|play, val?, he[], hit[], miss[], fx: { hit?, miss? } }
const NEED_FB = {
  derby: ['win', 95], table_up: ['win', 60], table_top: ['win', 80], title: ['win', 90], relegation: ['not_lose', 85], europe_race: ['win', 70],
  scout_abroad: ['rating', 75, 7.0], scout_local: ['rating', 65, 7.0], coach_promise: ['score', 80], coach_test: ['rating', 70, 7.0], ynt_watch: ['rating', 75, 7.0],
  nt_watch: ['rating', 80, 7.0], cup_ko: ['win', 70], cup_final: ['win', 100], europe: ['win', 75], europe_ko: ['win', 90], national: ['win', 85],
  tournament: ['win', 95], first_start: ['play', 90], contract: ['rating', 70, 7.0], return: ['play', 75], revenge: ['win', 55], win_streak: ['win', 50],
  loss_streak: ['not_lose', 60], big_opponent: ['not_lose', 60], must_win: ['win', 40], family: ['rating', 45, 7.0], milestone: ['score', 70], birthday: ['win', 50],
  fans: ['rating', 45, 7.0], tv: ['rating', 40, 7.0], season_opener: ['win', 50], last_match: ['win', 55], youth: ['rating', 60, 7.0], debut: ['play', 200],
};
const STK_FB = {
  derby: ['דרבי. כל העיר מסתכלת', 'ניצחתם בדרבי! העיר שלכם', 'הדרבי הלך. יש עוד דרבי'],
  table_up: ['ניצחון מעלה אתכם למקום {pos}', 'עליתם למקום {pos}!', 'הטבלה לא זזה הפעם'],
  table_top: ['ניצחון, ואתם במקום הראשון', '{club} בראש הטבלה!', 'הפסגה ברחה הפעם'],
  title: ['מרוץ האליפות בשיאו', 'האליפות קרובה מתמיד', 'מעידה במרוץ האליפות'],
  relegation: ['קרב הישרדות', 'נקודות של זהב בקרב ההישרדות', 'הלחץ בתחתית עולה'],
  europe_race: ['ניצחון, ואתם בתוך מקומות אירופה', 'אירופה מתקרבת!', 'אירופה התרחקה צעד'],
  scout_abroad: ['סקאוט של {scoutClub} ביציע', 'הסקאוט של {scoutClub} רשם את השם שלך', 'הסקאוט של {scoutClub} יצא באמצע'],
  scout_local: ['סקאוט של {scoutClub} ביציע', '{scoutClub} שמו {{עליך|עלייך}} עין', 'הסקאוט של {scoutClub} לא נשאר עד הסוף'],
  coach_promise: ['המאמן: "אם {{תבקיע|תבקיעי}}, {{תפתח|תפתחי}} גם בשבוע הבא"', 'המאמן עומד במילה: {{אתה פותח|את פותחת}} במשחק הבא', 'לא הבקעת. ההבטחה נשארה על הנייר'],
  coach_test: ['המאמן בוחן אותך: ציון 7 ומעלה, והמקום נשאר שלך', 'עברת את המבחן', 'המבחן לא הלך טוב'],
  ynt_watch: ['מאמן {{נבחרת הנוער|נבחרת הנערות}} צופה', 'מאמן הנבחרת הצעירה רשם אותך', 'מאמן הנבחרת הצעירה יחזור לראות'],
  nt_watch: ['מאמן הנבחרת ביציע', 'הנבחרת הבוגרת מתקרבת', 'לא היום. הנבחרת תחכה'],
  cup_ko: ['{round} של {comp}. מפסידים והולכים הביתה', 'עליתם שלב בגביע!', 'הגביע נגמר בשבילכם'],
  cup_final: ['גמר {comp}', 'הגביע שלכם!!!', 'הגביע עבר לצד השני'],
  europe: ['לילה אירופי. כל היבשת צופה', 'ניצחון אירופי!', 'אירופה לימדה שיעור'],
  europe_ko: ['{round} של {comp}', 'עוד צעד באירופה!', 'הדרך באירופה נגמרה כאן'],
  national: ['כל {nation} מאחוריכם', 'ניצחון לנבחרת!', 'ערב קשה לנבחרת'],
  tournament: ['טורניר גדול. העולם צופה', 'הטורניר ממשיך!', 'הלילה הזה כואב לכל המדינה'],
  first_start: ['פתיחה ראשונה בהרכב', 'פתיחה ראשונה מאחוריך', 'יהיו עוד'],
  contract: ['ההנהלה ביציע. הופעה טובה, והחוזה בדרך', 'ההנהלה התרשמה', 'ההנהלה עוד מתלבטת'],
  return: ['חזרה מפציעה', 'חזרת! והגוף החזיק', 'החזרה לוקחת זמן'],
  revenge: ['בפעם הקודמת {opp} ניצחו. היום מחזירים', 'החשבון עם {opp} נסגר', '{opp} שוב לקחו את זה'],
  win_streak: ['{n} ניצחונות ברצף', 'הרצף ממשיך!', 'הרצף נשבר'],
  loss_streak: ['{n} הפסדים ברצף. חייבים לעצור', 'הנפילה נעצרה', 'עוד הפסד'],
  big_opponent: ['{opp} הפייבוריטים', 'הפתעה! {opp} לא האמינו', '{opp} היו גדולים מדי הפעם'],
  must_win: ['כולם מצפים לניצחון', 'עשיתם את העבודה', 'מעידה מביכה'],
  family: ['כל המשפחה ביציע', 'המשפחה יצאה גאה', 'אמא אומרת שהיית {{הכי טוב|הכי טובה}} במגרש'],
  milestone: ['עוד שער אחד, ו{{אתה מגיע|את מגיעה}} ל-{n} בקריירה', 'שער ה-{n}!', 'שער ה-{n} יחכה'],
  birthday: ['משחק ביום ההולדת', 'ניצחון ביום ההולדת', 'יום הולדת בלי ניצחון'],
  fans: ['היציע הכין כרזה עם השם שלך', 'הקהל לא הפסיק לשיר', 'הקהל עדיין איתך'],
  tv: ['שידור חי בפריים טיים', 'האולפן לא הפסיק לדבר {{עליך|עלייך}}', 'האולפן היה קשוח הערב'],
  season_opener: ['משחק פתיחת העונה', 'פתיחת עונה מושלמת', 'פתיחה עקומה'],
  last_match: ['המשחק האחרון של העונה', 'סיום עונה עם ניצחון', 'סיום עונה מאכזב'],
  youth: ['מאמן הבוגרים צופה', 'מאמן הבוגרים ראה', 'מאמן הבוגרים יחזור לראות'],
  debut: ['משחק הבכורה! כל המשפחה ביציע', 'הבכורה שלך בספרים', 'הבכורה שלך בספרים'],
  none: ['כל משחק הוא הזדמנות להיכנס להיסטוריה', '', ''],
};
const PERSONAL_FB = {
  score: { he: '{{הבקע|הבקיעי}} שער', need: 'score', stars: 10, doneHe: 'המטרה הושגה: הבקעת!', missHe: 'השער יחכה למשחק הבא' },
  ga: { he: 'שער או בישול', need: 'ga', stars: 8, doneHe: 'המטרה הושגה', missHe: 'בלי מעורבות בשערים הפעם' },
  rating7: { he: 'ציון 7 ומעלה', need: 'rating', val: 7.0, stars: 8, doneHe: 'ציון 7+. המטרה הושגה', missHe: 'הציון לא הגיע ל-7 הפעם' },
  clean: { he: 'רשת נקייה', need: 'clean', stars: 12, doneHe: 'רשת נקייה. המטרה הושגה', missHe: 'ספגתם הפעם' },
  impact: { he: '{{היכנס|היכנסי}} {{ותשפיע|ותשפיעי}}: ציון 6.5 ומעלה', need: 'rating', val: 6.5, stars: 8, doneHe: 'נכנסת והשפעת', missHe: 'הדקות היו קצרות מדי' },
};
function kindDef(kind) {
  const T = table('STAKES');
  const k = T && T.kinds && T.kinds[kind];
  const fb = NEED_FB[kind] || ['win', 10];
  return { need: (k && typeof k.need === 'string') ? k.need : fb[0], prio: num(k && k.prio, fb[1]), val: num(k && k.val, fb[2] || 7.0), k: k || null };
}
function stkText(S, kind, idx, vars, r) {
  const d = kindDef(kind);
  const field = idx === 0 ? 'he' : idx === 1 ? 'hit' : 'miss';
  let v = d.k ? d.k[field] : null;
  if (kind === 'none') { const T = table('STAKES'); v = idx === 0 && T && T.ui ? T.ui.none : null; }
  return G(S, tx(v, (STK_FB[kind] || STK_FB.none)[idx], vars, r));
}
function scoutClub(S, r, abroad) {
  const p = S.player;
  const ovr = ovrOf(p);
  const ownPr = p.club ? clubPrestige(S, p.club) : 3;
  const ownS = p.club ? cs(S, p.club) : 0;
  const out = [];
  for (const lid of Object.keys(LEAGUE_BY_ID)) {
    const lg = LEAGUE_BY_ID[lid];
    if (!lg) continue;
    const foreign = lg.countryId !== p.nation;
    if (abroad ? (!foreign || lg.prestige < ownPr) : (foreign || lg.tier !== 1)) continue;
    for (const id of leagueMembers(S, lid)) {
      const s = cs(S, id);
      if (id !== p.club && s >= ovr - 8 && s <= ovr + 6 && (abroad || s > ownS)) out.push(id);
    }
  }
  if (!out.length) return null;
  out.sort();
  return r.pick(out);
}
function leagueInfo(S, fx, own) {
  const L = S.comp && S.comp.lg && S.comp.lg[fx.comp];
  if (!L || !Array.isArray(L.t)) return null;
  const my = L.t.find((x) => x[0] === own);
  if (!my) return null;
  const pool = L.sp ? L.t.filter((x) => L.sp.some((g) => g.indexOf(own) >= 0 && g.indexOf(x[0]) >= 0)) : L.t;
  const gd = (x) => x[5] - x[6];
  const better = (x, pts, g) => x[7] > pts || (x[7] === pts && gd(x) > g);
  let cur = 1, after = 1;
  for (const x of pool) if (x[0] !== own) { if (better(x, my[7], gd(my))) cur++; if (better(x, my[7] + 3, gd(my) + 1)) after++; }
  const sorted = pool.slice().sort((a, b) => b[7] - a[7]);
  const lg = LEAGUE_BY_ID[fx.comp];
  const N = L.t.length;
  let E = 0;
  if (lg && lg.euro) for (const c of ['ucl', 'uel', 'uecl']) if (lg.euro[c]) E += (lg.euro[c].lp || 0) + (lg.euro[c].q || 0);
  const relN = lg && lg.relegation ? lg.relegation.count : 0;
  const ptsAt = (rank) => { const all = L.t.slice().sort((a, b) => b[7] - a[7]); return all[Math.max(0, Math.min(all.length - 1, rank - 1))][7]; };
  return { cur, after, pts: my[7], top: sorted[0][7], played: my[1], r: L.r, R: L.R, N, E, relN, ptsAt, split: !!L.sp };
}
function stakeCands(S, fx, side, role, tut) {
  const p = S.player, M = MM(S);
  const own = side === 'h' ? fx.h : fx.a, opp = side === 'h' ? fx.a : fx.h;
  const r = rngFor(S.id, S.season, fx.week || S.week, fx.slot || '', fx.comp || '', 'stk');
  const club = fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe';
  const nat = fx.kind === 'national' || fx.kind === 'friendly' || fx.kind === 'ynt';
  const age = ageOf(S), ovr = ovrOf(p);
  const fl = S.ev.flags || {};
  const out = [];
  const add = (kind, x) => out.push(Object.assign({ kind }, x || {}));
  if (tut) { add('debut'); return { out, r }; }
  const cd = club ? clubData(own) : null;
  if ((fx.kind === 'league' || fx.kind === 'cup') && cd && cd.rival === opp) add('derby');
  if (fx.kind === 'cup') { if (fx.final) add('cup_final'); else add('cup_ko'); }
  if (fx.kind === 'europe') { if (fx.rk && fx.rk !== 'lp' && fx.rk !== 'q') add('europe_ko'); else add('europe'); }
  if (fx.kind === 'national' && typeof fx.comp === 'string' && fx.comp.indexOf('q_') !== 0 && fx.comp !== 'fr') add('tournament');
  else if (nat) add('national');
  if (fx.kind === 'youth') add('youth');
  if (fx.kind === 'league') {
    const li = leagueInfo(S, fx, own);
    if (li && li.r >= 1) {
      if (li.after === 1) add('table_top');
      else if (li.after < li.cur) add('table_up', { pos: li.after });
      if ((fx.week || S.week) >= 30 && li.cur > 1 && li.top - li.pts <= 3) add('title');
      if (li.relN && !li.split && li.cur > li.N - li.relN - 2 && li.pts - li.ptsAt(li.N - li.relN) <= 3) add('relegation');
      if (li.E && !li.split && li.cur > li.E && li.ptsAt(li.E) - li.pts <= 3) add('europe_race');
      if (typeof fx.r === 'number' && li.R && fx.r === li.R - 1) add('last_match');
    }
    if ((fx.week || S.week) === 1) add('season_opener');
  }
  if (club && role === 'starter' && ftStarts(S) === 0) add('first_start');
  if (club && role === 'bench' && p.stage === 'pro' && posGroup(p.pos) !== 'GK') add('coach_promise');
  if (club && role === 'starter' && p.stage === 'pro' && p.trust < 45) add('coach_test');
  if (club && ((p.stage === 'youth' && age >= 16 && ftApps(S) < 3) || (p.stage === 'pro' && p.contract && !p.contract.loan && p.contract.until === S.season && S.week >= 18 && !p.next))) add('contract');
  if (M.ret && curAw(S) - M.ret <= 4) add('return');
  if (club && Array.isArray(S.comp.res)) {
    const last = S.comp.res.slice().reverse().find((x) => (x.k === 'league' || x.k === 'cup') && ((x.h === own && x.a === opp) || (x.h === opp && x.a === own)));
    if (last) { const mine = last.h === own ? [last.hg, last.ag] : [last.ag, last.hg]; if (mine[0] < mine[1]) add('revenge'); }
  }
  if (club && (fl._ws || 0) >= 3) add('win_streak', { n: fl._ws });
  if (club && (fl._ls || 0) >= 2) add('loss_streak', { n: fl._ls });
  if (club) {
    const d = cs(S, opp) - cs(S, own);
    if (d >= 8) add('big_opponent'); else if (d <= -10) add('must_win');
  }
  const goals = (() => { let n = 0; for (const s of seasonsStats(S)) n += sumLines(s, SENIOR).g; return n; })();
  const MIL = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
  if (club && MIL.indexOf(goals + 1) >= 0 && posGroup(p.pos) !== 'GK') add('milestone', { n: goals + 1 });
  if ((fx.week || S.week) === 30) add('birthday');
  if (p.fans >= 70) add('fans');
  // random stakes (derived stream; the order of the draws is fixed)
  const rs = r.next(), ry = r.next(), rn = r.next(), rf = r.next(), rt = r.next();
  if ((club || fx.kind === 'youth') && age <= 27 && rs < 0.28) {
    const abroad = ovr >= 62 || p.rep.c >= 20;
    const sc = scoutClub(S, r, abroad);
    if (sc) add(abroad ? 'scout_abroad' : 'scout_local', { scoutClub: sc });
  }
  const yl = yntLevel(S);
  if (!nat && yl && age <= 19 && p.caps.senior === 0 && !fl['_call_' + yl] && ry < 0.35) add('ynt_watch');
  if (!nat && age >= 17 && S.hist.firsts.ntDebut === null && seniorScore(S) >= nstr(S, p.nation) - 8 && rn < 0.35) add('nt_watch');
  if (side === 'h' && !nat && rf < 0.2) add('family');
  if (club && fx.big && rt < 0.4) add('tv');
  return { out, r };
}
function personalPick(S, role, tut, r) {
  if (tut) return { id: 'debut', he: G(S, tx(null, '{{הבקע|הבקיעי}} בהופעת הבכורה')), need: 'score', stars: 10, doneHe: G(S, 'הבקעת בבכורה!'), missHe: '' };
  const T = table('STAKES');
  const P = (T && T.personal && typeof T.personal === 'object') ? T.personal : PERSONAL_FB;
  const g = posGroup(S.player.pos);
  const ok = (id) => { const row = P[id]; if (!row) return false; const c = Object.assign({}, row.cond || {}); const bench = c.bench; delete c.bench; if (bench && role !== 'bench') return false; return condOk(S, c, {}); };
  // v2.3 review: the goal rotates by role (weighted, a derived stream) so matches do not all read "score a goal"; the harder
  // goals pay more stars. A drought (form governor) switches to an achievable goal and the coach keeps believing.
  const bench = role !== 'starter';
  const W = {
    ATT: bench ? [['impact', 4], ['score', 3], ['ga', 2]] : [['score', 5], ['assist', 2], ['rating7', 2], ['brace', 1.5], ['motm', 1], ['rating8', 1]],
    MID: bench ? [['impact', 4], ['ga', 3], ['assist', 1.5]] : [['ga', 4], ['assist', 3], ['rating7', 3], ['score', 1.5], ['motm', 1], ['rating8', 1]],
    DEF: bench ? [['impact', 4], ['rating7', 2]] : [['clean', 4], ['rating7', 4], ['rating8', 1]],
    GK: bench ? [['rating7', 1]] : [['clean', 5], ['rating7', 3], ['rating8', 1]],
  }[g] || [['rating7', 1]];
  const dry = (MM(S).cnt.dry || 0) >= 2 && g !== 'GK';
  let pool = W.filter(([id]) => ok(id) && !(dry && (id === 'score' || id === 'brace' || id === 'rating8' || id === 'motm')));
  if (dry) pool = pool.filter(([id]) => id === 'ga' || id === 'impact' || id === 'assist' || id === 'rating7');
  const id = pool.length ? r.weighted(pool, (x) => x[1])[0] : (ok('rating7') ? 'rating7' : 'rating7');
  const row = P[id] || PERSONAL_FB.rating7;
  return { id, he: G(S, tx(row.he, (PERSONAL_FB[id] || PERSONAL_FB.rating7).he)), need: row.need || 'rating', val: num(row.val, 7.0), stars: Math.max(1, Math.round(num(row.stars, 8))),
    doneHe: G(S, tx(row.doneHe, 'המטרה הושגה')), missHe: G(S, tx(row.missHe, 'לא הפעם')) };
}
/** Stakes of a match: { key, list: [{ kind, he, need, val, ... }], goal: { id, he, need, val, stars, doneHe, missHe } }. Pure (derived rng). */
export function stakesFor(S, fx, side, role, tut) {
  const p = S.player;
  const { out, r } = stakeCands(S, fx, side, role, tut);
  const own = side === 'h' ? fx.h : fx.a, opp = side === 'h' ? fx.a : fx.h;
  out.sort((a, b) => (kindDef(b.kind).prio - kindDef(a.kind).prio) || (a.kind < b.kind ? -1 : 1));
  const list = out.slice(0, 2);
  if (!list.length) list.push({ kind: 'none' });
  const nat = country(p.nation);
  const cd = clubData(own);
  const vars0 = { opp: clubName(opp), club: clubName(own), rival: cd && cd.rival ? clubName(cd.rival) : clubName(opp), comp: fx.compHe || '', round: fx.roundHe || '',
    coach: (p.club && coachName(S, p.club, false)) || 'המאמן', teammate: p.club ? nameFor(p.club, S.season, 'mate', 1) : '', nation: nat ? nat.nameHe : '' };
  for (const s of list) {
    const d = kindDef(s.kind);
    s.need = d.need; s.val = d.val;
    s.vars = Object.assign({}, vars0, { pos: s.pos || '', n: s.n || '', scoutClub: s.scoutClub ? clubName(s.scoutClub) : '' });
    s.he = stkText(S, s.kind, 0, s.vars, r);
  }
  const goal = personalPick(S, role, tut, r);
  return { key: S.season + '-' + (fx.week || S.week) + '-' + (fx.slot || '') + '-' + (fx.comp || ''), list, goal };
}
export function stakesVM(stk) {
  if (!stk) return { stakes: [], goal: null };
  return { stakes: stk.list.filter((s) => s.he).map((s) => ({ kind: s.kind, he: s.he, need: s.need })),
    goal: stk.goal ? { id: stk.goal.id, he: stk.goal.he, rewardStars: stk.goal.stars, need: stk.goal.need } : null };
}
/** STAKES_COMMENTARY line for the live feed (first stake that has one): template string or null. */
export function stakeLine(S, stk) {
  const T = table('STAKES_COMMENTARY');
  if (!T || !stk) return null;
  for (const s of stk.list) {
    const l = vlist(T[s.kind]);
    if (l.length) return l[rngFor(S.id, stk.key, 'stkl').int(0, l.length - 1)];
  }
  return null;
}
function needOk(need, val, info) {
  switch (need) {
    case 'win': return info.tieWon === true || (info.tieWon !== false && info.res === 'W');
    case 'not_lose': return info.tieWon === true || (info.tieWon !== false && info.res !== 'L');
    case 'score': return info.g > 0;
    case 'goals': return info.g >= (val || 2);
    case 'assist': return info.a > 0;
    case 'ga': return info.g + info.a > 0;
    case 'rating': return info.rating >= (val || 7);
    case 'clean': return !!info.cs;
    case 'motm': return info.rating >= 8.0;
    case 'play': return true;
    default: return info.rating >= 7;
  }
}
function resolveStakes(S, stk, info) {
  const T = table('STAKES');
  const items = [];
  const aw = curAw(S);
  for (const s of stk.list) {
    if (s.kind === 'none') continue;
    const ok = needOk(s.need, s.val, info);
    const d = kindDef(s.kind);
    const fx = d.k && d.k.fx ? (ok ? d.k.fx.hit : d.k.fx.miss) : null;
    const fb = !d.k ? FX_FB[s.kind] : null;
    applyFx(S, fx || (fb ? (ok ? fb[0] : fb[1]) : null), { club: s.scoutClub || null });
    if (ok && (s.kind === 'scout_abroad' || s.kind === 'scout_local') && s.scoutClub) {
      MM(S).sc = { club: s.scoutClub, until: aw + 12, kind: s.kind === 'scout_abroad' ? 'abroad' : 'local' };
      sysMsg(S, 'agent', G(S, fill('הסקאוט של {c} התקשר אליי. הם אהבו את מה שראו, ויעקבו אחריך בחלון ההעברות הקרוב', { c: clubName(s.scoutClub) })));
    }
    if (s.kind === 'scout_abroad' || s.kind === 'scout_local') trig(S, ok ? 'stakes_scout_hit' : 'stakes_scout_miss');
    else if (ok && s.kind === 'coach_promise') trig(S, 'stakes_promise_hit');
    else if (ok && (s.kind === 'ynt_watch' || s.kind === 'nt_watch')) trig(S, 'stakes_watch_hit');
    items.push({ kind: s.kind, he: s.he, ok, resultHe: stkText(S, s.kind, ok ? 1 : 2, s.vars || {}, rngFor(S.id, aw, s.kind, 'stkr')) });
  }
  let goal = null;
  if (stk.goal) {
    const ok = needOk(stk.goal.need, stk.goal.val, info);
    if (ok) { addStars(S, stk.goal.stars, 'goal'); inc(S, 'pgoal'); }
    goal = { id: stk.goal.id, he: stk.goal.he, ok, rewardStars: stk.goal.stars, stars: ok ? stk.goal.stars : 0, resultHe: ok ? stk.goal.doneHe : stk.goal.missHe };
  }
  return { items, goal, titleHe: G(S, tx(T && T.ui && T.ui.resultTitle, 'מה קרה עם מה שהיה על הכף')) };
}
const FX_FB = {
  derby: [{ fans: 4, morale: 4 }, { fans: -2, morale: -3 }], scout_abroad: [{ agentPush: 3, repC: 1, interest: 'abroad' }, null], scout_local: [{ agentPush: 2, repL: 1, interest: 'local' }, null],
  coach_promise: [{ promise: 'next1', trust: 3 }, { trust: -1 }], coach_test: [{ trust: 4 }, { trust: -3 }], ynt_watch: [{ natBoost: 4, morale: 2 }, null], nt_watch: [{ natBoost: 6, repL: 1 }, null],
  cup_final: [{ morale: 6, fans: 5 }, { morale: -4 }], contract: [{ agentPush: 2, trust: 2 }, null],
};
// the scout interest feeds the transfer engine (transfers.js reads S.meta.sc); the coach's word forces a start;
// the youth / senior national coach lowers the call-up bar for a few weeks
export function yntBoost(S) { const M = S.meta; return M && typeof M.yb === 'number' && M.yb >= curAw(S) ? 4 : 0; }
export function takeForcedStart(S) {
  const M = S.meta, p = S.player;
  if (!M || !M.fs) return false;
  const aw = curAw(S);
  if (M.fs.club !== p.club || aw > M.fs.aw + 6) { M.fs = null; return false; }
  if (aw <= M.fs.aw) return false;
  M.fs = null;
  return true;
}

// ------------------------------------------------------------------ quiet week: no match -> a training challenge (F9)
const DRILL_FB = [
  { id: 'd_shoot', notGroups: ['GK'], he: 'אתגר בעיטות: 50 בעיטות לחיבורים', okHe: '38 מתוך 50 בחיבורים', stars: 5, fx: { attr: { sho: 0.2 } } },
  { id: 'd_sprint', he: 'ספרינטים בחול', okHe: 'השעון לא משקר: מהר יותר', stars: 5, fx: { attr: { pac: 0.2 } } },
  { id: 'd_video', he: 'ניתוח וידאו עם {coach}', okHe: '{coach} הראה לך שלוש טעויות. הן לא יחזרו', stars: 5, fx: { trust: 3 } },
  { id: 'd_gk', groups: ['GK'], he: 'מכונת כדורים: 100 כדורים, רפלקסים בלבד', okHe: '84 הצלות מתוך 100', stars: 5, fx: { attr: { ref: 0.2 } } },
];
function quietWeek(S) {
  const p = S.player;
  const rows = rowsOf('QUIET_WEEK', 'drills') || DRILL_FB;
  const g = posGroup(p.pos);
  const ok = rows.filter((d) => d && typeof d === 'object' && (!Array.isArray(d.groups) || d.groups.indexOf(g) >= 0) && (!Array.isArray(d.notGroups) || d.notGroups.indexOf(g) < 0));
  if (!ok.length) return null;
  const r = rngFor(S.id, curAw(S), 'quiet');
  const d = ok[r.int(0, ok.length - 1)];
  const vars = { first: p.first, coach: (p.club && coachName(S, p.club, false)) || 'המאמן', teammate: p.club ? nameFor(p.club, S.season, 'mate', 2) : 'חבר לקבוצה' };
  const T = table('QUIET_WEEK');
  const he = G(S, tx(d.he, 'אתגר אימון', vars)), okHe = G(S, tx(d.okHe, 'האתגר הושלם', vars));
  const stars = Math.max(0, Math.round(num(d.stars, 5)));
  addStars(S, stars, 'quiet');
  applyFx(S, d.fx);
  inc(S, 'quiet');
  return { id: d.id || '', titleHe: G(S, tx(T && T.title, 'אין משחק השבוע? יש אתגר באימון')), he, okHe, stars };
}

// ------------------------------------------------------------------ tutorial (F3)
const TIP_FB = [
  ['pitch', 'המגרש החי', 'כל מהלך במשחק קורה פה מול העיניים'],
  ['score', 'התוצאה והשעון', 'הדקה והתוצאה של המשחק'],
  ['speed', 'מהירות הצפייה', 'x1 כדי לא לפספס אף רגע, x4 כדי להגיע מהר לרגעים הגדולים'],
];
export function tutorialVM(S) {
  const M = MM(S);
  const T = table('TUTORIAL');
  const marks = T && Array.isArray(T.coachMarks) ? T.coachMarks : null;
  const tips = TIP_FB.map(([id, title, he]) => {
    const m = marks && marks.find((x) => x && x.id === id);
    return { id, target: (m && m.target) || (id === 'score' ? 'scorebug' : id), titleHe: G(S, tx(m && m.title, title)), he: G(S, tx(m && m.he, he)) };
  });
  return { st: M.tut.st, active: M.tut.st === 'pending' || M.tut.st === 'live', card: M.tut.card ? JSON.parse(JSON.stringify(M.tut.card)) : null, tips };
}
export function tutorialPending(S) { const M = S.meta; return !!(M && M.tut && M.tut.st === 'pending'); }
export function tutorialStart(S) { const M = MM(S); M.tut.st = 'live'; M.tut.aw = curAw(S); }
export function tutorialSkip(S) { const M = MM(S); if (M.tut.st === 'pending') M.tut.st = 'skip'; }
function tutorialCard(S, ach, stars, minute) {
  const T = table('TUTORIAL');
  const pm = (T && T.postMatch) || {};
  const pv = pathVM(S);
  const r = rngFor(S.id, 'tutcard');
  const best = ach.find((a) => a.id === 'first_goal') || ach.find((a) => a.id === 'debut') || ach[0] || null;
  const nx = pv.next;
  return {
    titleHe: G(S, tx(pm.title, 'ככה מתחילים אגדה')), subHe: G(S, tx(pm.sub, 'בכורה עם שער', {}, r)),
    goalLineHe: G(S, tx(pm.goalLine, 'שער בבכורה, דקה {minute}', { minute: minute || '' })), minute: minute || null,
    achievementLabelHe: G(S, tx(pm.achievementLabel, 'הישג ראשון נפתח')),
    achievement: best ? { id: best.id, he: best.he, tier: best.tier, stars: best.stars } : null,
    achievements: ach.map((a) => ({ id: a.id, he: a.he, tier: a.tier, stars: a.stars })),
    starsLabelHe: G(S, tx(pm.starsLabel, 'הכוכבים הראשונים שלך')), stars, starsLineHe: G(S, tx(pm.starsLine, '+{n} ⭐', { n: stars })),
    teaserLabelHe: G(S, tx(pm.teaserLabel, 'הבא בשביל הקריירה')), teaserHe: G(S, tx(pm.teaser, nx ? nx.teaserHe : 'הבא: {{נבחרת הנוער|נבחרת הנערות}}')),
    teaserHintHe: G(S, tx(pm.teaserHint, '')), nextHe: nx ? nx.teaserHe : '', nextMissingHe: nx ? nx.missingHe : '',
  };
}

// ------------------------------------------------------------------ hooks called by game.js
const SEN_KINDS = ['league', 'cup', 'europe', 'national', 'friendly'];
/** After every player match (finishInternal). info: { fx, L, res, rating, g, a, minutes, starter, role, cs, home, debutNow, derby, tieWon, lateWinner, myGoalMinute } */
export function onMatchDone(S, info) {
  const M = MM(S);
  const st0 = M.st.earn;
  const fx = info.fx;
  const club = fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe';
  const senior = SEN_KINDS.indexOf(fx.kind) >= 0;
  const age = ageOf(S);
  inc(S, 'm');
  if (info.g >= 3) inc(S, 'hat');
  if (senior && info.role === 'bench' && info.g > 0) inc(S, 'benchG', info.g);
  if (info.lateWinner) inc(S, 'lateW');
  M.cnt.rmax = Math.max(M.cnt.rmax || 0, info.rating);
  if (senior && age < 19) inc(S, 'teenG', info.g);
  if (senior) M.cnt.ageApp = Math.max(M.cnt.ageApp || 0, age);
  if (info.derby && info.res === 'W') inc(S, 'derbyW');
  if (fx.comp === 'ucl') { inc(S, 'uclApps'); inc(S, 'uclG', info.g); }
  if (typeof fx.comp === 'string' && /^wc_?\d{4}$/.test(fx.comp)) inc(S, 'wcApps');
  if (club && info.debutNow && info.g > 0) inc(S, 'debutGoal');
  // the form governor's counters (match.js formOf): senior games with 20+ minutes, outfield players
  if (senior && posGroup(S.player.pos) !== 'GK' && info.minutes >= 20) {
    M.cnt.dry = info.g + info.a > 0 ? 0 : (M.cnt.dry || 0) + 1;
    M.cnt.hot = info.g > 0 ? (M.cnt.hot || 0) + 1 : 0;
  }
  if (M.ret) M.ret = null;
  objOnMatch(S, info);
  let stakes = null;
  const stk = info.L && info.L.stk;
  if (stk) stakes = resolveStakes(S, stk, info);
  if (!M.cnt._fm) { M.cnt._fm = 1; trig(S, 'first_match_done', true); emit('first_match_done', { kind: fx.kind, tutorial: !!(info.L && info.L.tut), scored: info.g > 0, goals: info.g, rating: info.rating }); }
  const chk = checkAll(S);
  let tutorial = null;
  if (info.L && info.L.tut) {
    M.tut.st = 'done';
    tutorial = tutorialCard(S, chk.achievements, M.st.earn - st0, info.myGoalMinute);
    M.tut.card = tutorial;
  }
  if (stakes && stakes.items.some((x) => x.ok && /^(scout_|coach_promise|ynt_watch|nt_watch)/.test(x.kind))) markInt(S, 'stakes', stakes.items.find((x) => x.ok).resultHe);
  return { stakes, achievements: chk.achievements, objectives: chk.objectives, milestones: chk.milestones, starsEarned: M.st.earn - st0, tutorial };
}
const WEEKS_SIG = [1, 3, 5, 10, 20, 40];
/** Week end (player weeks). ctx: { hadMatch, focus, intensity, injured } -> { lines, quiet, objectives, achievements, milestones, starsEarned } */
export function onWeekEnd(S, ctx) {
  const M = MM(S), p = S.player;
  const st0 = M.st.earn;
  const lines = [];
  let quiet = null;
  if (playing(S)) {
    objOnWeek(S, ctx);
    // no empty weeks: a week without a match has a training challenge
    if (!ctx.hadMatch && !p.injury && ctx.focus !== 'rest') {
      quiet = quietWeek(S);
      if (quiet) trig(S, 'quiet_week');
      if (quiet) lines.push('🎯 ' + quiet.he + ': ' + quiet.okHe + (quiet.stars ? ' (+' + quiet.stars + '⭐)' : ''));
    }
  }
  M.wk = (M.wk || 0) + 1;
  if (WEEKS_SIG.indexOf(M.wk) >= 0 && M.wr.indexOf(M.wk) < 0) { M.wr.push(M.wk); emit('week_reached', { n: M.wk }); }
  const chk = checkAll(S);
  return { lines, quiet, objectives: chk.objectives, achievements: chk.achievements, milestones: chk.milestones, starsEarned: M.st.earn - st0 };
}
export function onInjuryStart(S) { const p = S.player; const M = MM(S); if (p.injury && p.injury.weeks >= 6) M.injLong = true; M.injW = p.injury ? p.injury.weeks : 0; }
export function onInjuryEnd(S) {
  const M = MM(S);
  if (M.injLong) { M.injLong = false; inc(S, 'longInjRet'); }
  if ((M.injW || 0) >= 3) M.ret = curAw(S);
  M.injW = 0;
}
export function noteTalk(S, success) { if (success) { inc(S, 'talkOk'); bump(S, 'talk_ok', 1); } return checkAll(S); }
export function noteShare(S, kind) { inc(S, kind === 'challenge' ? 'challenge' : 'share'); const a = checkAchievements(S); return { ok: true, achievements: a, kind: kind || null }; }
export function noteBuy(S) { inc(S, 'buy'); bump(S, 'shop_buy', 1); return checkAll(S); }
export function noteReply(S) { bump(S, 'reply_msgs', 1); return checkAll(S); }

// ------------------------------------------------------------------ daily reward (F8, engine side)
// v2.3 review: exclusive daily rewards (the same for a boy and a girl): stars, a mystery item, a celebration, the head scout,
// and a chest with a rare item on day 7. { type: 'item', slot } grants an unowned cosmetic (equipped at once); 'scout' the exact potential.
const DAILY_FB = [
  [{ type: 'stars', n: 10 }], [{ type: 'stars', n: 5 }, { type: 'energy', n: 20 }], [{ type: 'item', slot: 'boots' }], [{ type: 'stars', n: 20 }],
  [{ type: 'item', slot: 'celebration' }], [{ type: 'scout' }, { type: 'energy', n: 15 }], [{ type: 'item', slot: 'frame' }, { type: 'stars', n: 50 }, { type: 'energy', n: 30 }],
];
const DAILY_TYPES = ['stars', 'energy', 'money', 'morale', 'item', 'scout'];
function dailyOk(x) { return x && DAILY_TYPES.indexOf(x.type) >= 0 && (x.type === 'scout' || (x.type === 'item' ? SLOTS.indexOf(x.slot) >= 0 : num(x.n, 0) > 0)); }
/** The mystery item of a daily reward: the cheapest unowned rare-or-better item of the slot (deterministic). */
function dailyItem(S, slot) {
  const M = MM(S);
  const l = cosItems().filter((c) => c.slot === slot && cosForCareer(S, c) && !isDefaultCos(c.id) && M.cos.own.indexOf(c.id) < 0)
    .sort((a, b) => (cosPrice(a) - cosPrice(b)) || (a.id < b.id ? -1 : 1));
  return l.find((c) => cosPrice(c) >= 60) || l[0] || null;
}
const DITEM_HE = { boots: 'נעליים מסתוריות', celebration: 'חגיגת שער חדשה', frame: 'מסגרת נדירה לכרטיס', accessory: 'אביזר מסתורי' };
function dailyDay(i) {
  const rows = rowsOf('DAILY', 'days');
  const row = rows && rows.find((d) => d && num(d.day, 0) === i);
  const rw = row && Array.isArray(row.rewards) ? row.rewards.filter(dailyOk) : null;
  return { rewards: rw && rw.length ? rw : DAILY_FB[i - 1], big: row ? !!row.big : i === 7, he: row && typeof row.he === 'string' ? row.he : 'יום ' + i };
}
const DAILY_HE = { energy: 'אנרגיה', morale: 'מורל' };
/** claimDaily(dayIndex 1..7, dateKey 'YYYY-MM-DD', streak?): once per dateKey; the day's rewards from DAILY.days. */
export function claimDaily(S, dayIndex, dateKey, streak) {
  const M = MM(S), p = S.player;
  const key = String(dateKey || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return { ok: false, error: 'bad_date', rewards: [] };
  // once per date, and never an earlier date (a clock moved back cannot pay the day-7 chest again)
  if (M.dly.last && key <= M.dly.last) return { ok: false, error: 'claimed', messageHe: 'כבר אספת את הפרס של היום', rewards: [] };
  const day = clamp(Math.round(num(dayIndex, 1)), 1, 7);
  const d = dailyDay(day);
  const rewards = [];
  for (const x of d.rewards) {
    const n = Math.round(num(x.n, 0));
    if (x.type === 'stars') { addStars(S, n, 'daily'); rewards.push({ kind: 'stars', amount: n, he: '+' + n + ' ⭐' }); }
    else if (x.type === 'money') { const m = moneyOf(S, n); p.money = Math.max(0, Math.round(p.money + m)); rewards.push({ kind: 'money', amount: m, he: '+' + fmtMoney(m) }); }
    else if (x.type === 'item') {
      const it = dailyItem(S, x.slot);
      if (it) {
        M.cos.own.push(it.id);
        M.cos.eq[it.slot] = it.id;
        rewards.push({ kind: 'item', id: it.id, slot: it.slot, amount: 1, he: G(S, (SLOT_HE[it.slot] || 'פריט') + ' חדש: ' + tx(it.he, it.id)) });
      } else { addStars(S, 40, 'daily'); rewards.push({ kind: 'stars', amount: 40, he: '+40 ⭐' }); }
    } else if (x.type === 'scout') {
      if (!M.bst.scout && playing(S)) {
        M.bst.scout = true; M.bst.sc = S.season; p.potSeen = [p.pot, p.pot];
        rewards.push({ kind: 'scout', amount: p.pot, he: 'הסקאוט הראשי: הפוטנציאל שלך ' + p.pot });
      } else { addStars(S, 30, 'daily'); rewards.push({ kind: 'stars', amount: 30, he: '+30 ⭐' }); }
    }
    else if (playing(S)) { p[x.type] = Math.round(clamp(p[x.type] + n, 0, 100)); rewards.push({ kind: x.type, amount: n, he: '+' + n + ' ' + DAILY_HE[x.type] }); }
  }
  M.dly.last = key; M.dly.n = (M.dly.n || 0) + 1; M.dly.day = day;
  const sk = Math.max(day, Math.round(num(streak, day)));
  M.dly.best = Math.max(M.dly.best || 0, sk);
  if (sk >= 7 && sk % 7 === 0 && playing(S)) trig(S, 'streak_7');
  const ach = checkAchievements(S);
  return { ok: true, day, chest: d.big, rewards, balance: M.st.bal, achievements: ach };
}
/** The 7-day calendar: [{ day, he, chest, stars, energy, morale, money (engine euros, econ-scaled), rewards: [{ kind, amount }] }] */
export function dailyPreview(S) {
  const out = [];
  for (let i = 1; i <= 7; i++) {
    const d = dailyDay(i);
    const o = { day: i, he: d.he, chest: d.big, stars: 0, energy: 0, morale: 0, money: 0, rewards: [] };
    for (const x of d.rewards) {
      if (x.type === 'item') { o.item = x.slot; o.itemHe = DITEM_HE[x.slot] || 'פריט מסתורי'; o.rewards.push({ kind: 'item', slot: x.slot, amount: 1, he: o.itemHe }); continue; }
      if (x.type === 'scout') { o.scout = true; o.scoutHe = 'הסקאוט הראשי'; o.rewards.push({ kind: 'scout', amount: 1, he: o.scoutHe }); continue; }
      const a = x.type === 'money' ? moneyOf(S, x.n) : Math.round(num(x.n, 0)); o[x.type] += a; o.rewards.push({ kind: x.type, amount: a });
    }
    out.push(o);
  }
  return out;
}

// ------------------------------------------------------------------ leaderboard / challenge summary (F11)
const HL_ORDER = ['legend', 'ballon_top10', 'senior_nt', 'ucl', 'top5', 'abroad_offer', 'youth_nt', 'pro_contract', 'starter', 'first_goal', 'debut'];
export function boardSummary(S, extra) {
  const M = MM(S), p = S.player;
  let g = 0, a = 0, apps = 0;
  for (const s of seasonsStats(S)) { const l = sumLines(s, ALL_LINES); g += l.g; a += l.a; apps += l.apps; }
  const nat = country(p.nation);
  const lastClub = p.club || (S.retired && S.retired.club) || (S.hist.clubs.length ? S.hist.clubs[S.hist.clubs.length - 1].club : null);
  let hl = null;
  for (const id of HL_ORDER) { const m = M.ms['p_' + id]; if (m) { hl = { id, age: m.age, he: stepHe(S, id), reachHe: stepReach(S, id) }; break; } }
  const legacy = extra && typeof extra.legacy === 'number' ? extra.legacy : legacyScore(S);
  return {
    careerId: S.id, name: (p.first + ' ' + p.last).slice(0, 30), first: p.first, gender: gOf(S), nation: p.nation, nationHe: nat ? nat.nameHe : '', flag: nat ? nat.flag : '',
    clubHe: lastClub ? clubName(lastClub) : '', club: lastClub || null, ovr: Math.max(p.peak || 0, ovrOf(p)), ovrNow: ovrOf(p), goals: g, assists: a, apps,
    trophies: S.hist.trophies.length, ballon: S.hist.awards.filter((x) => x.k === 'ballon_dor').length,
    ballonBest: S.hist.bdo.reduce((b, x) => (x.rank > 0 && (b === 0 || x.rank < b) ? x.rank : b), 0), legacy: round1(legacy),
    age: ageOf(S), season: S.season, seasons: S.season - S.startSeason + 1, retired: !!S.retired, highlight: hl, pos: p.pos,
  };
}

// ------------------------------------------------------------------ v5 migration (one-time OVR 60 lift)
const MIG_FB = { title: 'קפיצת מדרגה! המאמן מעלה אותך {{לבוגרים|לבוגרות}}', lines: ['{first}, מהיום {{אתה|את}} בסגל הבוגר של {club}. יכולת {ovr}, ואני מצפה ליותר.'],
  titlePro: 'קפיצת מדרגה! העבודה הקשה משתלמת', linesPro: ['{first}, יכולת {ovr}. מהיום {{אתה|את}} חלק מהתוכניות שלי ב{club}.'], gift: 'מתנת קפיצת המדרגה: +{n} ⭐', toast: 'קפיצת מדרגה! יכולת {ovr}' };
/** v5 migration of a career that already played: funnel signals off, past achievements marked without signals / toasts. */
function veteranMeta(S) {
  const M = S.meta, p = S.player;
  if (!p || !S.hist || !Array.isArray(S.hist.seasons)) return null;
  let apps = 0;
  for (const s of seasonsStats(S)) if (s) apps += sumLines(s, ALL_LINES).apps;
  if (!(apps > 0 || S.lastMatch || S.hist.seasons.length || S.retired)) return null;
  M.cnt._fm = 1;
  M.wk = Math.max(M.wk || 0, 999);
  M.wr = WEEKS_SIG.slice();
  const aw = curAw(S);
  const D = snap(S);
  let n = 0, stars = 0;
  for (const d of achDefs()) {
    if (M.ach[d.id] !== undefined || !achVisible(S, d)) continue;
    if (achValue(D, d) < d.target) continue;
    M.ach[d.id] = aw; n++; stars += d.stars;
  }
  if (stars > 0) { M.st.bal += stars; M.st.earn += stars; M.st.log.push({ aw, d: stars, s: 'achievement' }); }
  return { n, stars };
}
export function migrateV5(data) {
  if (!data || typeof data !== 'object') return data;
  if (!data.meta || typeof data.meta !== 'object') data.meta = freshMeta(false);
  ensureMeta(data);
  const M = data.meta;
  if (M.m5) return data;
  M.m5 = true;
  const p = data.player;
  // a career that already played is not a new funnel visitor: first_match_done / week_reached never fire for it, and the
  // achievements it earned before 2.3 are marked silently (their stars are paid as one gift, no burst of signals)
  let past = null;
  try { past = veteranMeta(data); } catch (e) { past = null; }
  const active = p && typeof p === 'object' && p.a && p.pos && !data.retired && p.stage !== 'retired' && !data.mgr;
  if (!active) return data;
  const before = ovrOf(p);
  if (before >= START23.ovr) return data;
  setOvrTo(p, START23.ovr);
  p.pot = Math.max(Number(p.pot) || 0, START23.potMin);
  p.peak = Math.max(Number(p.peak) || 0, ovrOf(p));
  p.potSeen = [clamp(p.pot - 4, 30, 99), clamp(p.pot + 4, 30, 99)];
  if (p.stage === 'youth') p.fts = true;
  M.mig = { from: before };
  const g = p.gender === 'f' ? 'f' : 'm';
  const T = table('MIGRATION_TEXT');
  const V = (T && T.v5) || MIG_FB;
  const pro = p.stage === 'pro';
  const cd = p.club ? clubData(p.club) : null;
  const coach = (data.names && data.names.coach && p.club && data.names.coach[p.club]) || 'המאמן';
  const vars = { first: p.first, club: cd ? cd.nameHe : 'הקבוצה', coach, ovr: START23.ovr, n: 20 };
  const title = tx(pro ? V.titlePro : V.title, pro ? MIG_FB.titlePro : MIG_FB.title, vars, null, g);
  const body = vlist(pro ? V.linesPro : V.lines);
  // the coach's words come last: the inbox list previews the last line
  const pastLine = past && past.n ? fill('ועוד בונוס: {n} הישגים מהקריירה שלך כבר נפתחו (+{s} ⭐)', { n: past.n, s: past.stars }) : '';
  const lines = [title, tx(V.gift, MIG_FB.gift, vars, null, g), pastLine].concat((body.length ? body : (pro ? MIG_FB.linesPro : MIG_FB.lines)).map((l) => tx(l, '', vars, null, g)))
    .filter((x) => x && !PH.test(x));
  const aw = (data.season || 0) * 52 + (data.week || 0);
  if (Array.isArray(data.inbox) && data.ctr) {
    data.inbox.push({ id: nextId(data, 'inbox'), aw, from: 'coach', ev: null, lines: lines.map((t) => ({ who: 'coach', t })), choices: null, ans: null, exp: null, imp: false, read: false });
  }
  M.st.bal += 20; M.st.earn += 20; M.st.log.push({ aw, d: 20, s: 'migration' });
  if (data.ev && typeof data.ev === 'object') { if (!Array.isArray(data.ev.carry)) data.ev.carry = []; if (data.ev.carry.indexOf('promoted_v5') < 0) data.ev.carry.push('promoted_v5'); }
  M.tq.push({ k: 'migration', id: 'v5', he: tx(V.toast, MIG_FB.toast, vars, null, g), stars: 20, from: before, ovr: START23.ovr });
  return data;
}

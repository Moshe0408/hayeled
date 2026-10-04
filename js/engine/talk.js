// v2.2 coach talk when benched (docs/SPEC-2.2-training-bench.md §4). Pure over the state + the game rng.
import * as STR from '../data/strings.js';
import { rngFor } from '../core/rng.js';
import { clamp, fill, gtext, sgnHe } from './util.js';
import { curAw, nextId } from './state.js';
import { ageOf, formAvgOr } from './player.js';
import { cs, clubName } from './world.js';
import { isWindowOpen } from './calendar.js';
import { coachName, youthCoachName, sysMsg, pushInbox, awLabel } from './narrative.js';
import { effOvr, loadBand, ensureLoad } from './load.js';

export const APPROACHES = ['ask', 'demand', 'threat'];
export const TALK_TUNE = {
  base: { ask: 0.55, demand: 0.40, threat: 0.30 },
  gap: 0.03, gapDemand: 0.05, trust: 0.006, form: 0.08, role: 0.15, broken: 0.15, tired: 0.10, young: 0.05, third: 0.10,
  min: 0.08, max: 0.90,
  benchMin: 3, benchMinYouth: 4, lowMin: 4, cooldown: 4, cooldownBroken: 2, perSeason: 3,
  promiseBonus: 8, penalty: -4, penaltyChance: 0.3, poorRating: 6.0, lastWeek: 42,
  // a failed threat (pro, first team) = the transfer request of the profile screen: same total price
  threatFailTrust: -15, threatFailFans: -10, threatFailTrustListed: -10, threatFailFansListed: -3,
};
// promise windows: n = club matches covered, need = starts promised, ev = starts judged for "you got your chance"
const PROMISE = { ask: { n: 2, need: 1, ev: 2 }, demand: { n: 1, need: 1, ev: 1 }, threat: { n: 3, need: 3, ev: 2 } };

// ---------- built-in Hebrew (used when strings.js has no COACH_TALK or a key is missing) ----------
const DEF = {
  open: {
    bench: ['{n} משחקים על הספסל, אני יודע. מה יש לך להגיד לי?', 'נכנס{{|ת}} למשרד? שב{{|י}}. על מה רצית לדבר?'],
    tired: ['אני רואה את המספרים מהפיזיותרפיסט. מה רצית?'],
    loan: ['באת אלינו בהשאלה כדי לשחק, אני יודע. מה רצית?'],
    youth: ['{n} משחקים בלי לפתוח בנוער. דבר{{|י}}, אני מקשיב.'],
    broken: ['אני יודע, הבטחתי ולא קיימתי. דבר{{|י}}.'],
  },
  approach: {
    ask: 'אפשר לדבר? אני {{רוצה|רוצה}} הזדמנות',
    demand: 'מגיע לי לפתוח. אני {{דורש|דורשת}} דקות',
    threat: 'אם לא אשחק, אבקש לעזוב',
    threatLoan: 'אם לא אשחק, אבקש לחזור לקבוצה שלי',
  },
  reply: {
    ask: { ok: ['בסדר. {{תפתח|תפתחי}} באחד משני המשחקים הבאים. אל {{תאכזב|תאכזבי}} אותי.'], fail: ['{{תמשיך|תמשיכי}} לעבוד באימונים. ההזדמנות תגיע.'] },
    demand: { ok: ['אני לא אוהב שלוחצים עליי. אבל {{תפתח|תפתחי}} במשחק הבא.'], fail: ['אצלי לא דורשים. ככה זה לא עובד.'] },
    threat: { ok: ['אני לא רוצה לאבד אותך. {{תפתח|תפתחי}} בשלושת המשחקים הבאים.'], fail: ['הדלת פתוחה. אם {{אתה רוצה|את רוצה}} ללכת, אף אחד לא יעצור אותך.'],
      loanFail: ['אם ככה, {{תחזור|תחזרי}} ל{club}. בהצלחה.'],
      loanOk: ['לא שלחו אותך אלינו כדי לשבת. שלושה משחקים בהרכב, ואחר כך רוטציה.'],
      youthFail: ['איומים לא יכניסו אותך להרכב. עבודה כן. {{תחשוב|תחשבי}} על זה.'] },
  },
  tired: ['{{אתה גמור|את גמורה}} פיזית. {{תנוח|תנוחי}} שבוע {{ותחזור|ותחזרי}}.'],
  punish: ['ועל זה {{תשב|תשבי}} גם במשחק הבא.'],
  promiseKept: ['{coach} עמד במילה: {{אתה פותח|את פותחת}} בהרכב. עכשיו {{תראה|תראי}} לו שהוא צדק.'],
  promiseBroken: ['{coach} הבטיח ולא קיים. עוד פעם על הספסל.'],
  poorChance: ['קיבלת הזדמנות ולא ניצלת אותה. עכשיו {{תצטרך|תצטרכי}} לעבוד קשה כדי לקבל עוד אחת.'],
  national: ['{{אתה|את}} בתוכניות שלי. {{תמשיך|תמשיכי}} לעבוד, הדקות יגיעו.'],
};
function ltext(k, def) { const t = STR.LOAD_TEXT; return gtext(t && typeof t[k] === 'string' && t[k] ? t[k] : def); }
function CT() { const t = STR.COACH_TALK; return t && typeof t === 'object' ? t : {}; }
function arr(v) { return Array.isArray(v) && v.length ? v.filter((x) => typeof x === 'string' && x) : null; }
function lines(path) {
  // path: ['reply', 'ask', 'ok'] -> content array or the built-in one
  let c = CT(), d = DEF;
  for (const k of path) { c = c && typeof c === 'object' ? c[k] : undefined; d = d && typeof d === 'object' ? d[k] : undefined; }
  return arr(c) || (typeof c === 'string' && c ? [c] : null) || arr(d) || (typeof d === 'string' ? [d] : ['']);
}
function pickLine(rng, list) { return list.length === 1 ? list[0] : list[rng.int(0, list.length - 1)]; }

// ---------- context ----------
function teamStrOfTalk(S) {
  const p = S.player;
  if (p.stage === 'youth') return S.comp && S.comp.yl && S.comp.yl.str[p.club] ? S.comp.yl.str[p.club] : cs(S, p.club) - 12;
  return cs(S, p.club);
}
function talkVars(S, n) {
  const p = S.player;
  return { coach: (p.club && (p.stage === 'youth' ? youthCoachName(S, p.club) : coachName(S, p.club, false))) || 'המאמן', club: p.club ? clubName(p.club) : 'הקבוצה', n: (n || p.benchRun || 0) > 10 ? 'יותר מ-10' : String(n || p.benchRun || 0), first: p.first, nick: p.nick || p.first };
}
function seasonTalks(S) { const t = S.player.talk; return t.ns === S.season ? (t.n || 0) : 0; }
function promiseActive(S) { const pr = S.player.talk && S.player.talk.promise; return !!(pr && pr.ok === null); }

function oddsCtx(S) {
  const p = S.player;
  const gap = effOvr(p) - teamStrOfTalk(S);
  const role = (p.contract && p.contract.role) || 'squad';
  const band = loadBand(p.load);
  return { gap, trust: p.trust, form: formAvgOr(p), keyRole: role === 'key' || role === 'star', broken: !!p.talk.broken, tired: p.load >= 60, burnt: band === 'burnt', young: ageOf(S) <= 20, third: seasonTalks(S) >= 2 };
}
/** Success chance of an approach (spec §4.2 formula). Pure. */
export function talkOdds(S, approach) {
  const T = TALK_TUNE;
  const c = oddsCtx(S);
  let pr = T.base[approach] !== undefined ? T.base[approach] : T.base.ask;
  // demand: being clearly better than the squad (or clearly not) counts more - "demand when you deserve it"
  pr += c.gap * (approach === 'demand' ? T.gapDemand : T.gap) + (c.trust - 50) * T.trust + (c.form - 6.6) * T.form;
  if (c.keyRole) pr += T.role;
  if (c.broken) pr += T.broken;
  if (c.tired) pr -= T.tired;              // load >= 60; burnt (§4.4) is the same single malus, not a second one
  if (c.young && approach === 'ask') pr += T.young;
  if (c.third && approach !== 'demand') pr -= T.third;   // the third talk of a season is hard (a demand ignores patience)
  return clamp(pr, T.min, T.max);
}
function bandOfP(x) { return x < 0.35 ? 'low' : x < 0.60 ? 'mid' : 'high'; }

/** Can the player ask for a talk right now? Pure (used by getHub). */
export function canTalk(S) {
  const p = S.player;
  ensureLoad(S);
  const t = p.talk;
  const aw = curAw(S);
  const youth = p.stage === 'youth';
  const thr = youth ? TALK_TUNE.benchMinYouth : TALK_TUNE.benchMin;
  const cd = t.broken ? TALK_TUNE.cooldownBroken : TALK_TUNE.cooldown;
  // after a broken promise the 2 weeks count from the week it broke
  const nextAbs = t.broken && typeof t.brokenAt === 'number' ? Math.max(t.brokenAt + cd, (typeof t.lastWeekAbs === 'number' ? t.lastWeekAbs : -99) + 1) : (typeof t.lastWeekAbs === 'number' ? t.lastWeekAbs : -99) + cd;
  const out = { ok: false, reasonHe: '', benchRun: p.benchRun, lowMin: p.lowMin, nextAbs, threshold: thr, youth, loan: !!(p.contract && p.contract.loan),
    tired: p.load >= 60, burnt: loadBand(p.load) === 'burnt', talksLeft: Math.max(0, TALK_TUNE.perSeason - seasonTalks(S)), promise: promiseVM(S), approaches: null, openHe: '', coachHe: '', clubHe: '' };
  const R = (k, def, n) => { const t2 = CT().reasons; const s = t2 && typeof t2[k] === 'string' && t2[k] ? t2[k] : def; return fill(s, { n: String(n === undefined ? '' : n) }); };
  const reason = (() => {
    if (S.mgr) return R('manager', '{{אתה|את}} המאמן עכשיו. ההרכב אצלך');
    if (S.retired) return R('noClub', 'אין לך קבוצה כרגע');
    if (!p.club || (p.stage !== 'pro' && p.stage !== 'youth')) return R('noClub', 'אין לך קבוצה כרגע');
    if (S.live || S.inWeek) return 'יש שבוע או משחק בתהליך';
    if (p.injury) return R('injured', '{{אתה פצוע|את פצועה}}. קודם {{תחזור|תחזרי}} לכשירות');
    if (p.susp > 0) return R('suspended', '{{אתה מורחק|את מורחקת}}. אחרי ההרחקה נדבר');
    if (S.week > TALK_TUNE.lastWeek) return 'העונה כמעט נגמרה. אין על מה לדבר עכשיו';
    if (promiseActive(S)) return R('promiseActive', 'יש לך הבטחה מהמאמן. {{תן|תני}} לה זמן');
    if (seasonTalks(S) >= TALK_TUNE.perSeason) return R('seasonLimit', 'כבר דיברת עם המאמן ' + TALK_TUNE.perSeason + ' פעמים העונה');
    if (!(p.benchRun >= thr || p.lowMin >= TALK_TUNE.lowMin)) {
      if (p.benchRun === 0 && p.lowMin === 0) return R('starter', '{{אתה|את}} בהרכב. אין סיבה לדפוק על הדלת');
      return youth ? R('notYetYouth', '{{בנוער|בנערות}} השיחה נפתחת אחרי 4 משחקים רצופים בלי לפתוח בהרכב') : R('notYet', 'השיחה נפתחת אחרי 3 משחקים רצופים בלי לפתוח בהרכב, או 4 משחקים עם פחות מ-30 דקות');
    }
    if (aw < nextAbs) return nextAbs - aw === 1 ? R('cooldown1', 'דיברת עם המאמן לא מזמן. אפשר שוב בשבוע הבא') : R('cooldown', 'דיברת עם המאמן לא מזמן. אפשר שוב ב' + awLabel(nextAbs), nextAbs - aw);
    return '';
  })();
  out.reasonHe = gtext(reason);
  if (p.club) { const v = talkVars(S); out.coachHe = v.coach; out.clubHe = v.club; out.clubId = p.club; }
  if (reason) return out;
  out.ok = true;
  const lowMinCtx = !(p.benchRun >= thr) && p.lowMin >= TALK_TUNE.lowMin;
  const v = talkVars(S, lowMinCtx ? p.lowMin : p.benchRun);
  const r = rngFor(S.id, aw, 'talk_open');
  const key = out.burnt ? 'tired' : t.broken ? 'broken' : seasonTalks(S) >= 2 ? 'third' : out.loan ? 'loan' : youth ? 'youth' : lowMinCtx ? 'lowMin' : 'bench';
  const op = arr(CT().open && CT().open[key]) || arr(CT().open && CT().open.default) || lines(['open', DEF.open[key] ? key : 'bench']);
  out.context = key;
  out.openHe = fill(pickLine(r, op), v);
  out.approaches = APPROACHES.map((id) => {
    const pr = talkOdds(S, id);
    const he = id === 'threat' && out.loan ? lines(['approach', 'threatLoan'])[0] : lines(['approach', id])[0];
    const info = CT().approachInfo && CT().approachInfo[id];
    return { id, he: fill(he, v), chance: Math.round(pr * 100) / 100, band: bandOfP(pr), titleHe: info && info.he ? gtext(info.he) : '', hintHe: info && info.hint ? gtext(info.hint) : '' };
  });
  return out;
}

function promiseText(type) {
  const P = CT().promiseHe || {};
  const k = type === 'ask' ? 'next2' : type === 'demand' ? 'next1' : 'run3';
  const def = type === 'ask' ? '{{תפתח|תפתחי}} באחד משני המשחקים הבאים' : type === 'demand' ? '{{תפתח|תפתחי}} במשחק הבא' : '{{תפתח|תפתחי}} בשלושת המשחקים הבאים, {{ותהיה|ותהיי}} ברוטציה עד סוף העונה';
  return gtext(typeof P[k] === 'string' && P[k] ? P[k] : def);
}
export function promiseVM(S) {
  const pr = S.player.talk && S.player.talk.promise;
  if (!pr || pr.ok !== null) return null;
  return { type: pr.type, he: promiseText(pr.type), left: pr.n - pr.used, need: pr.need, got: pr.got, untilAbs: pr.until };
}

// ---------- the talk ----------
const DEF_EFF = { trust: 'אמון המאמן', morale: 'מורל', fans: 'אהדת הקהל', selection: 'סיכוי לפתוח במשחק הבא', role: 'תפקיד: רוטציה עד סוף העונה', treq: 'בקשת העברה הוגשה', loanEnd: 'ההשאלה מסתיימת', interested: 'קבוצות מעוניינות בך', benchNext: 'גם במשחק הבא על הספסל', youthDoor: 'מאמן הנוער זוכר את האיום' };
function effHe(k) { const t = CT().effectsHe || {}; const s = typeof t[k] === 'string' && t[k] ? t[k] : (k === 'benchNext' && CT().promiseHe && CT().promiseHe.benchNext) || DEF_EFF[k] || k; return gtext(s); }
function eff(out, key, delta) { if (delta) { const labelHe = effHe(key); out.push({ key, labelHe, delta, he: sgnHe(delta) + ' ' + labelHe }); } }
const NOTE_TONE = { role: 'good', interested: 'good', treq: 'warn', loanEnd: 'warn', benchNext: 'bad', youthDoor: 'bad' };
function note(out, key, delta) { const labelHe = effHe(key); out.push({ key, labelHe, delta: delta || 0, he: labelHe, tone: NOTE_TONE[key] || '' }); }

/** Run the talk (validated by the caller with canTalk). Uses the main game rng (deterministic, persisted). */
export function doTalk(S, rng, approach, hooks) {
  const p = S.player;
  const t = p.talk;
  const aw = curAw(S);
  const ctx = canTalk(S);
  const chance = talkOdds(S, approach);
  const success = rng.next() < chance;
  const v = talkVars(S);
  const effects = [];
  let promise = null;
  let replyKey = success ? ['reply', approach, 'ok'] : ['reply', approach, 'fail'];
  if (!success && ctx.burnt) replyKey = ['tired'];
  else if (!success && approach === 'threat' && ctx.loan) replyKey = ['reply', 'threat', 'loanFail'];
  else if (!success && approach === 'threat' && ctx.youth) replyKey = ['reply', 'threat', 'youthFail'];   // no transfer list in the academy
  else if (success && approach === 'threat' && ctx.loan) replyKey = ['reply', 'threat', 'loanOk'];
  let reply = pickLine(rng, lines(replyKey));
  const mod = (k, d) => { if (!d) return; p[k] = clamp(p[k] + d, 0, 100); eff(effects, k, d); };
  if (success) {
    const P = PROMISE[approach];
    t.promise = { type: approach, n: P.n, need: P.need, got: 0, used: 0, ok: null, at: aw, until: aw + 8, club: p.club };
    t.ev = { k: P.ev, rts: [], until: aw + 10, club: p.club };
    if (approach === 'ask') { mod('trust', 2); mod('morale', 4); }
    else if (approach === 'demand') { mod('morale', 6); mod('trust', -1); }
    else { mod('morale', 5); mod('trust', -3); t.rot = S.season; t.rotClub = p.club; }   // the promise card already says "rotation"
    promise = promiseVM(S);
  } else if (approach === 'ask') {
    mod('morale', -2);
  } else if (approach === 'demand') {
    mod('trust', -6); mod('morale', -4);
    if (rng.chance(TALK_TUNE.penaltyChance)) { t.pen = 1; reply += ' ' + pickLine(rng, lines(['punish'])); note(effects, 'benchNext', TALK_TUNE.penalty); }
  } else {
    const listNow = !ctx.youth && !ctx.loan && !p.treq && p.stage === 'pro';
    mod('trust', listNow ? TALK_TUNE.threatFailTrust : TALK_TUNE.threatFailTrustListed);
    if (ctx.youth && !ctx.loan) {
      mod('morale', -3);   // youth: the academy coach is not impressed; no transfer request below the pro stage
      note(effects, 'youthDoor');
    } else if (ctx.loan) {
      mod('fans', -3);
      if (hooks && hooks.recall && isWindowOpen(S.week)) hooks.recall(S);
      else t.recall = true;   // back to the parent club when the next window opens
      note(effects, 'loanEnd');
    } else {
      mod('fans', listNow ? TALK_TUNE.threatFailFans : TALK_TUNE.threatFailFansListed);
      if (listNow) p.treq = true;   // = requestTransfer(): trust -15, fans -10 in total
      note(effects, 'treq');
      let keen = 0;
      for (const o of S.offers) if (o.status === 'open') { o.keen = true; keen++; }
      if (keen) note(effects, 'interested');
    }
  }
  t.lastWeekAbs = aw;
  if (t.ns !== S.season) { t.ns = S.season; t.n = 0; }
  t.n = (t.n || 0) + 1;
  t.broken = false;
  t.last = { aw, approach, success };
  const replyHe = fill(reply, v);
  // the player's bubble: the button text, or one of the longer content lines (COACH_TALK.say)
  const btn = ctx.approaches ? ((ctx.approaches.find((a) => a.id === approach) || {}).he || '') : '';
  const sayKey = approach === 'threat' && ctx.youth ? 'threatYouth' : approach;   // no agent / transfer talk in the academy
  const say = !(approach === 'threat' && ctx.loan) && arr(CT().say && CT().say[sayKey]);
  const sayHe = say ? fill(pickLine(rng, say), v) : btn;
  // the conversation stays in the inbox
  const item = { id: nextId(S, 'inbox'), aw, from: 'coach', ev: null, lines: [{ who: 'coach', t: ctx.openHe || '' }, { who: 'me', t: sayHe }, { who: 'coach', t: replyHe }].filter((l) => l.t),
    choices: null, ans: null, exp: null, imp: false, read: true };
  pushInbox(S, item);
  return { ok: true, success, approach, chance: Math.round(chance * 100) / 100, openHe: ctx.openHe, sayHe, replyHe, effects, promise, threadId: item.id };
}

// ---------- match hooks ----------
/** Club selection made (pro first team, or the youth side for a youth-stage player). sel: { sel, plays } */
// per-week scratch (kept in the week summary so a mid-week save keeps it)
function lowMinNudge(S, K) { const p = S.player; if (p.lowMin === TALK_TUNE.lowMin && p.benchRun < (p.stage === 'youth' ? TALK_TUNE.benchMinYouth : TALK_TUNE.benchMin) && p.stage === 'pro') K.mnudge = p.lowMin; }
function scratch(S) { const W = S.wsum; if (!W) return {}; if (!W.tk) W.tk = { promise: null, poor: false, nudge: 0 }; return W.tk; }
export function onTeamSelection(S, sel) {
  const p = S.player;
  ensureLoad(S);
  const K = scratch(S);
  const t = p.talk;
  const s = sel.sel;
  if (s === 'injured' || s === 'suspended') return;
  const started = s === 'starter';
  if (started) p.benchRun = 0; else {
    p.benchRun++;
    if (p.benchRun === (p.stage === 'youth' ? TALK_TUNE.benchMinYouth : TALK_TUNE.benchMin)) K.nudge = p.benchRun;
  }
  if (!sel.plays) { p.lowMin++; lowMinNudge(S, K); }
  if (t.pen) t.pen = 0;   // the punishment covered this club match
  const pr = t.promise;
  if (pr && pr.ok === null && pr.club === p.club) {
    pr.used++;
    if (started) pr.got++;
    if (pr.got >= pr.need) { pr.ok = true; K.promise = 'kept'; }
    else if (pr.n - pr.used < pr.need - pr.got) { pr.ok = false; K.promise = 'broken'; }
  }
}
/** A club match was played (minutes, starter, rating) */
export function onTeamMatch(S, minutes, starter, rating) {
  const p = S.player;
  ensureLoad(S);
  const K = scratch(S);
  if (minutes < 30) { p.lowMin++; lowMinNudge(S, K); } else p.lowMin = 0;
  const ev = p.talk.ev;
  if (ev && starter && ev.club === p.club && ev.rts.length < ev.k) {
    ev.rts.push(rating);
    if (ev.rts.length >= ev.k) {
      if (ev.rts.every((r) => r < TALK_TUNE.poorRating)) K.poor = true;
      p.talk.ev = null;
    }
  }
}

/** Week end: messages for kept / broken promises, wasted chances, expiry, the bench nudge. Returns a summary line or null. */
export function talkWeekEnd(S, rng, hooks) {
  const p = S.player;
  ensureLoad(S);
  const K = scratch(S);
  const t = p.talk;
  const aw = curAw(S);
  const v = talkVars(S);
  let line = null;
  const pr = t.promise;
  if (pr && pr.ok === null && (aw >= pr.until || pr.club !== p.club || S.week > 44)) { t.promise = null; t.res = 'lapsed'; }   // lapsed (injury, transfer, summer): no penalty
  if (K.promise) t.res = K.promise;
  if (K.promise === 'kept') {
    sysMsg(S, 'agent', fill(pickLine(rng, lines(['promiseKept'])), v));
    line = ltext('promiseKeptLine', 'המאמן עמד במילה: פתחת בהרכב');
  } else if (K.promise === 'broken') {
    p.morale = clamp(p.morale - 6, 0, 100);
    t.broken = true; t.brokenAt = aw;
    sysMsg(S, 'agent', fill(pickLine(rng, lines(['promiseBroken'])), v));
    line = ltext('promiseBrokenLine', 'המאמן לא עמד בהבטחה') + ' (' + sgnHe(-6) + ' מורל)';
  }
  if (pr && pr.ok !== null) t.promise = null;
  if (K.poor) {
    p.trust = clamp(p.trust - 3, 0, 100);
    sysMsg(S, 'coach', fill(pickLine(rng, lines(['poorChance'])), v));
    if (!line) line = ltext('poorChanceLine', 'קיבלת הזדמנות ולא ניצלת אותה') + ' (' + sgnHe(-3) + ' אמון)';
  }
  if (t.ev && (aw >= t.ev.until || t.ev.club !== p.club)) t.ev = null;
  if (t.recall && !(p.contract && p.contract.loan)) t.recall = false;   // the loan ended anyway
  if (K.nudge && hooks && hooks.nudge && !S.retired) hooks.nudge(S, K.nudge, 'bench_nudge');
  else if (K.mnudge && hooks && hooks.nudge && !S.retired) hooks.nudge(S, K.mnudge, 'minutes_nudge');
  if (S.wsum) S.wsum.pk = K.promise === 'kept' ? true : (K.promise === 'broken' || K.poor) ? false : null;   // week summary promiseKept
  K.promise = null; K.poor = false; K.nudge = 0; K.mnudge = 0;
  return line;
}

/** National team: three call-ups in a row without minutes -> a reassuring text from the national coach. */
export function nationalNote(S, called, played) {
  const p = S.player;
  ensureLoad(S);
  if (!called) return;
  if (played) { p.ld.ntNo = 0; return; }
  p.ld.ntNo = (p.ld.ntNo || 0) + 1;
  if (p.ld.ntNo === 3) sysMsg(S, 'national_coach', fill(lines(['national'])[0], talkVars(S)));
}

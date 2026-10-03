// Live player match: creation, moments, auto play, end, finish (SPEC §2.3, §5.5, §5.6, §6.3).
import { rngFor } from '../core/rng.js';
import { MATCH_TEXT } from '../data/commentary.js';
import { EURO_COMPS, TOURNAMENTS, ROUND_NAMES, ODDS, SELECTION } from '../data/strings.js';
import { LEAGUE_BY_ID } from '../data/leagues.js';
import { clamp, fill, round1 } from './util.js';
import { lambdas, simExtraTime, simPenalties } from './sim.js';
import { cs, clubData, clubLeague, teamVM, nameFor, country, clubPrestige } from './world.js';
import { cupDef } from './cups.js';
import { ovrOf, posGroup } from './player.js';
import { weekLabelHe } from './calendar.js';
import { MOMENTS, TUNE, generateMoments, optionChance, oddsBand, resolveOption, expectedValue, setupText, optionLabel, resultText, momentCtx } from './moments.js';

// ---------- labels ----------
export function tourHe(key) {
  const m = /^([a-z0-9]+?)_?(\d{4})$/.exec(key || '');
  if (!m) return key || '';
  const kind = m[1];
  return ((TOURNAMENTS && TOURNAMENTS[kind]) || kind) + ' ' + m[2];
}
export function compHe(S, comp) {
  if (!comp) return '';
  if (LEAGUE_BY_ID[comp]) return LEAGUE_BY_ID[comp].nameHe;
  const ym = /^([a-z0-9]+)_(u17|u19)$/.exec(comp);
  if (ym && LEAGUE_BY_ID[ym[1]]) return (LEAGUE_BY_ID[ym[1]].youthNameHe || 'ליגת הנוער') + (ym[2] === 'u17' ? ' עד גיל 17' : ' עד גיל 19');
  const cd = cupDef(comp);
  if (cd) return cd.nameHe;
  if (EURO_COMPS && EURO_COMPS[comp]) return EURO_COMPS[comp].he;
  if (comp === 'fr') return (TOURNAMENTS && TOURNAMENTS.friendly) || 'משחק ידידות';
  if (comp.indexOf('q_') === 0) return ((TOURNAMENTS && TOURNAMENTS.qual) || 'מוקדמות') + ' ' + tourHe(comp.slice(2));
  if (comp.indexOf('ynt_') === 0) {
    const l = comp.slice(4);
    return 'נבחרת ' + (l === 'u17' ? 'עד גיל 17' : l === 'u19' ? 'עד גיל 19' : 'עד גיל 21');
  }
  return tourHe(comp);
}
export function roundHe(fx) {
  const RN = ROUND_NAMES || {};
  if (fx.kind === 'league' || fx.kind === 'youth') return (RN.md || 'מחזור') + ' ' + ((fx.r || 0) + 1);
  if (fx.kind === 'cup') return RN[fx.rk] || '';
  if (fx.kind === 'europe') {
    if (fx.rk === 'lp') return (RN.lp || 'שלב הליגה') + ' · ' + (RN.md || 'מחזור') + ' ' + (fx.md || '');
    const base = RN[fx.rk] || '';
    if (fx.tie && fx.tie.leg === 1) return base + ' · משחק ראשון';
    if (fx.tie && fx.tie.leg === 2) return base + ' · גומלין';
    return base;
  }
  if (fx.kind === 'national' || fx.kind === 'ynt' || fx.kind === 'friendly') {
    if (fx.comp === 'fr') return RN.fr || 'ידידות';
    if (fx.comp.indexOf('q_') === 0) return RN.q_md || 'מוקדמות';
    if (fx.comp.indexOf('ynt_') === 0) return RN.fr || 'ידידות';
    if (fx.rk === 'grp') return RN.grp || 'שלב הבתים';
    return RN[fx.rk] || '';
  }
  return '';
}
export function fxKey(fx) { return fx.comp + '|' + fx.h + '|' + fx.a; }
export function teamVariant(fx) {
  if (fx.kind === 'youth') return 'youth';
  if (fx.kind === 'ynt') return fx.lvl || (fx.comp.indexOf('ynt_') === 0 ? fx.comp.slice(4) : null);
  return null;
}
export function lineOf(kind) {
  return kind === 'league' ? 'lg' : kind === 'cup' ? 'cup' : kind === 'europe' ? 'eu' : (kind === 'national' || kind === 'friendly') ? 'nt' : kind === 'youth' ? 'yth' : 'ynt';
}
export function extraHe(et, extra) {
  const e = extra || (et ? (et.pens ? 'p:' + et.pens[0] + '-' + et.pens[1] : 'et') : null);
  if (!e) return null;
  if (e === 'et') return 'אחרי הארכה';
  const m = /^p:(\d+)-(\d+)$/.exec(e);
  return m ? 'פנדלים ' + m[1] + '-' + m[2] : null;
}

function teamName(S, id, variant) { return teamVM(id, variant).shortHe; }
function playerCall(S) { const p = S.player; return p.nick || p.last; }

function vars(S, L) {
  const sc = L.sc;
  return {
    player: playerCall(S), first: S.player.first, last: S.player.last,
    team: teamName(S, L.own, teamVariant(L.fx)), opp: teamName(S, L.opp, teamVariant(L.fx)),
    teammate: L.nm.tm[0], gk: L.nm.gk, minute: String(L.cl), score: sc[0] + '-' + sc[1], comp: compHe(S, L.fx.comp),
  };
}
function pickLine(rng, arr, v) { const s = rng.pick(arr || []); return s ? fill(s, v) : ''; }

// Strength of a side for this fixture
export function sideStrength(S, fx, id) {
  if (fx.kind === 'youth') { const y = S.comp.yl; return (y && y.str[id]) || 45; }
  if (fx.kind === 'national' || fx.kind === 'friendly' || fx.kind === 'ynt') {
    const base = typeof S.nt.str[id] === 'number' ? S.nt.str[id] : 50;
    const lvl = fx.lvl && fx.lvl !== 'senior' ? fx.lvl : (fx.kind === 'ynt' ? (fx.comp.slice(4) || 'u19') : null);
    return lvl ? base - ({ u17: 22, u19: 16, u21: 10 }[lvl] || 0) : base;
  }
  return cs(S, id);
}

export function isBig(S, fx, own, opp) {
  if (fx.kind === 'league' || fx.kind === 'cup') {
    const d = clubData(own);
    if (d && d.rival === opp) return true;
  }
  if (fx.kind === 'cup' && (fx.rk === 'sf' || fx.rk === 'f')) return true;
  if (fx.kind === 'europe' && fx.rk !== 'lp' && fx.rk !== 'q') return true;
  if (fx.kind === 'europe' && fx.comp === 'ucl' && fx.rk === 'lp' && cs(S, opp) >= 85) return true;
  if ((fx.kind === 'national' || fx.kind === 'ynt') && fx.rk) return true;
  if (fx.kind === 'national' && fx.comp.indexOf('q_') === 0 && sideStrength(S, fx, opp) > sideStrength(S, fx, own)) return true;
  return false;
}

// Create the live match. fxd: fixture descriptor, side 'h'|'a', sel: selection result
export function createLive(S, rng, fxd, side, sel) {
  const own = side === 'h' ? fxd.h : fxd.a;
  const opp = side === 'h' ? fxd.a : fxd.h;
  const p = S.player;
  const ovr = ovrOf(p);
  const sOwnBase = sideStrength(S, fxd, own);
  const sOpp = sideStrength(S, fxd, opp);
  const role = sel.sel === 'starter' ? 'starter' : 'bench';
  const on = role === 'starter' ? 0 : sel.on;
  const off = role === 'starter' ? sel.off : 90;
  const minutes = off - on;
  const sOwn = sOwnBase + (ovr - sOwnBase) * 0.10 * (minutes / 90);
  const big = isBig(S, fxd, own, opp);
  const ms = generateMoments(rng, { pos: p.pos, starter: role === 'starter', on, off, big, ovr, teamStr: sOwnBase });
  const att = ms.filter((m) => MOMENTS[m.type].side === 'att').length;
  const def = ms.filter((m) => MOMENTS[m.type].side === 'def').length;
  const gkm = ms.filter((m) => MOMENTS[m.type].side === 'gk' && m.type !== 'gk_distribution').length;
  const [lh, la] = lambdas(side === 'h' ? sOwn : sOpp, side === 'h' ? sOpp : sOwn, !!fxd.neutral);
  const lf = side === 'h' ? lh : la, lag = side === 'h' ? la : lh;
  const nf = rng.poisson(Math.max(0.05, lf * (1 - TUNE.attBg * att)));
  const na = rng.poisson(Math.max(0.1, lag * (1 - TUNE.defBg * def - TUNE.gkBg * gkm)));
  const bg = [];
  for (let i = 0; i < nf; i++) bg.push({ m: rng.int(1, 90), side });
  for (let i = 0; i < na; i++) bg.push({ m: rng.int(1, 90), side: side === 'h' ? 'a' : 'h' });
  bg.sort((x, y) => (x.m - y.m) || (x.side < y.side ? -1 : x.side > y.side ? 1 : 0));
  const tm = [0, 1, 2, 3, 4].map((k) => nameFor(own, S.season, 'mate', k));
  const gk = nameFor(opp, S.season, 'gk', 0);
  const fx = {
    comp: fxd.comp, week: S.week, slot: fxd.slot, h: fxd.h, a: fxd.a, kind: fxd.kind, tie: fxd.tie || null, ko: !!fxd.ko, big,
    neutral: !!fxd.neutral, ref: fxd.ref || null, rk: fxd.rk || null, r: fxd.r === undefined ? null : fxd.r, md: fxd.md || null,
    lvl: fxd.lvl || null, final: !!fxd.final,
  };
  const L = {
    fx, role, phase: 'pre', on, off, sc: [0, 0], bg, mo: [], i: 0, log: [], rd: 0, et: null,
    side, own, opp, so: Math.round(sOwn * 10) / 10, sa: sOpp, cl: on, bi: 0, auto: false, nm: { tm, gk }, ht: false, subOn: false, subOff: false, intro: '',
  };
  const v0 = vars(S, L);
  L.mo = ms.map((m, k) => {
    const vv = Object.assign({}, v0, { teammate: tm[(k + 1) % tm.length], minute: String(m.m) });
    delete vv.score;
    return { m: m.m, type: m.type, opts: Object.keys(MOMENTS[m.type].opts), setup: setupText(rng, m.type, vv), res: null };
  });
  // intro
  const MT = MATCH_TEXT || {};
  const intro = MT.intro || {};
  let key = 'default';
  if (p.s && S.hist.firsts.debut === null && (fx.kind === 'league' || fx.kind === 'cup' || fx.kind === 'europe')) key = 'debut';
  else if (fx.final) key = 'final';
  else if (big && (fx.kind === 'league' || fx.kind === 'cup')) key = 'derby';
  else if (fx.kind === 'europe') key = 'europe';
  else if (fx.kind === 'national' || fx.kind === 'friendly' || fx.kind === 'ynt') key = 'national';
  else if (fx.kind === 'youth') key = 'youth';
  const list = (intro[key] && intro[key].length) ? intro[key] : (intro.default || []);
  L.intro = pickLine(rng, list, v0) || ('יוצאים לדרך: ' + v0.team + ' נגד ' + v0.opp);
  return L;
}

function logPush(L, m, t, k) { if (t) L.log.push({ m, t, k }); }

// Advance the clock to minute `to`, processing background goals with minute < to (or <= to if inclusive)
function advanceTo(S, rng, L, to, inclusive) {
  const MT = MATCH_TEXT || {};
  while (L.bi < L.bg.length && (inclusive ? L.bg[L.bi].m <= to : L.bg[L.bi].m < to)) {
    const g = L.bg[L.bi++];
    if (!L.ht && g.m > 45) { L.ht = true; L.cl = 45; logPush(L, 45, pickLine(rng, MT.half_time, vars(S, L)), 'info'); }
    if (L.role === 'bench' && !L.subOn && g.m >= L.on) { L.subOn = true; L.cl = L.on; logPush(L, L.on, pickLine(rng, MT.sub_on, vars(S, L)), 'info'); }
    if (g.side === 'h') L.sc[0]++; else L.sc[1]++;
    L.cl = g.m;
    const mine = g.side === L.side;
    logPush(L, g.m, pickLine(rng, mine ? MT.goal_for : MT.goal_against, vars(S, L)) || (mine ? 'גול!' : 'ספגנו.'), mine ? 'goal_for' : 'goal_against');
  }
  if (!L.ht && to > 45) { L.ht = true; L.cl = 45; logPush(L, 45, pickLine(rng, MT.half_time, vars(S, L)), 'info'); }
  if (L.role === 'bench' && !L.subOn && to >= L.on) { L.subOn = true; L.cl = L.on; logPush(L, L.on, pickLine(rng, MT.sub_on, vars(S, L)), 'info'); }
  if (!L.subOff && L.off < 90 && to >= L.off) { L.subOff = true; logPush(L, L.off, pickLine(rng, MT.sub_off, vars(S, L)), 'info'); }
  L.cl = Math.max(L.cl, Math.min(to, 90));
}

export function startLive(S, rng, L) {
  if (L.phase !== 'pre') return;
  L.phase = 'live';
  logPush(L, 0, L.intro, 'info');   // minute 0: the intro is the first line of the feed even for a bench player
  if (L.mo.length === 0) { endLive(S, rng, L); return; }
  advanceTo(S, rng, L, L.mo[0].m, false);
  L.cl = L.mo[0].m;
}

function aggLevel(L) {
  if (!L.fx.ko) return false;
  const agg = L.fx.tie && L.fx.tie.agg ? L.fx.tie.agg : [0, 0];
  return L.sc[0] + agg[0] === L.sc[1] + agg[1];
}

export function endLive(S, rng, L) {
  const MT = MATCH_TEXT || {};
  advanceTo(S, rng, L, 90, true);
  L.cl = 90;
  if (aggLevel(L)) {
    const sh = L.side === 'h' ? L.so : L.sa, sa = L.side === 'h' ? L.sa : L.so;
    const [eh, ea] = simExtraTime(rng, sh, sa);
    L.sc[0] += eh; L.sc[1] += ea;
    let pens = null;
    logPush(L, 105, pickLine(rng, MT.extra_time, vars(S, L)) || 'הארכה!', 'info');
    if (aggLevel(L)) {
      pens = simPenalties(rng);
      const won = (L.side === 'h' ? pens[0] > pens[1] : pens[1] > pens[0]);
      logPush(L, 120, pickLine(rng, won ? MT.pens_win : MT.pens_loss, vars(S, L)) || ('פנדלים ' + pens[0] + '-' + pens[1]), 'info');
    }
    L.et = { sc: [eh, ea], pens };
    L.cl = 120;
  }
  const r = resOf(L);
  const ft = MT.full_time || {};
  logPush(L, L.cl, pickLine(rng, ft[r], vars(S, L)) || 'שריקת הסיום.', 'info');
  L.phase = 'ended';
}

export function resOf(L) {
  const my = L.side === 'h' ? L.sc[0] : L.sc[1];
  const th = L.side === 'h' ? L.sc[1] : L.sc[0];
  return my > th ? 'W' : my < th ? 'L' : 'D';
}

export function chooseLive(S, rng, L, idx) {
  const mo = L.mo[L.i];
  if (!mo || mo.res) throw new Error('no_moment');
  const key = mo.opts[idx];
  if (key === undefined) throw new Error('bad_option');
  const ctx = momentCtx(S, L.sa, L.side === 'h' && !L.fx.neutral, L.fx.big);
  const p = optionChance(mo.type, key, ctx);
  const r = resolveOption(rng, mo.type, key, p);
  const mine = L.side === 'h' ? 0 : 1;
  let goalFor = false, goalAgainst = false;
  if (r.code === 'GOAL' || r.code === 'ASSIST') { L.sc[mine]++; goalFor = true; }
  if (r.code === 'CONCEDED' || r.code === 'GK_CONCEDED') { L.sc[1 - mine]++; goalAgainst = true; }
  L.cl = mo.m;
  const v = vars(S, L);
  v.teammate = L.nm.tm[(L.i + 1) % L.nm.tm.length];
  const t = resultText(rng, mo.type, r.code, v);
  mo.res = { opt: idx, code: r.code, ok: r.ok, t, d: r.d };
  if (r.fans) mo.res.f = r.fans;
  L.rd = Math.round((L.rd + r.d) * 100) / 100;
  logPush(L, mo.m, t, goalFor ? 'goal_for' : goalAgainst ? 'goal_against' : 'moment');
  L.i++;
  if (L.i < L.mo.length) {
    advanceTo(S, rng, L, L.mo[L.i].m, false);
    L.cl = L.mo[L.i].m;
  } else endLive(S, rng, L);
  return { code: r.code, ok: r.ok, textHe: t, ratingDelta: r.d, score: L.sc.slice(), goalFor, goalAgainst };
}

export function autoPlayLive(S, rng, L) {
  if (L.phase === 'pre') startLive(S, rng, L);
  L.auto = true;
  while (L.phase === 'live' && L.i < L.mo.length) {
    const mo = L.mo[L.i];
    const ctx = momentCtx(S, L.sa, L.side === 'h' && !L.fx.neutral, L.fx.big);
    // Soft choice: options are picked with a probability that falls off with their expected-rating gap to the best one,
    // like a real player who mostly takes the best option but sometimes passes (a strict argmax almost never assists).
    const vals = mo.opts.map((k) => expectedValue(mo.type, k, optionChance(mo.type, k, ctx)));
    const bv = Math.max(...vals);
    const ws = vals.map((v) => Math.exp((v - bv) / 0.12));
    let r = rng.float(0, ws.reduce((a, b) => a + b, 0));
    let best = ws.length - 1;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) { best = i; break; } }
    chooseLive(S, rng, L, best);
  }
  if (L.phase === 'live') endLive(S, rng, L);
}

// ---------- VMs ----------
export function matchVM(S, L) {
  const fx = L.fx;
  const v = teamVariant(fx);
  const home = teamVM(fx.h, v), away = teamVM(fx.a, v);
  let moment = null;
  if (L.phase === 'live' && L.i < L.mo.length) {
    const mo = L.mo[L.i];
    const ctx = momentCtx(S, L.sa, L.side === 'h' && !fx.neutral, fx.big);
    moment = {
      minute: mo.m, type: mo.type, side: MOMENTS[mo.type].side, textHe: fill(mo.setup, { score: L.sc[0] + '-' + L.sc[1] }),
      options: mo.opts.map((k, i) => { const p = optionChance(mo.type, k, ctx); const b = oddsBand(p); return { index: i, key: k, he: optionLabel(mo.type, k), odds: b, oddsHe: (ODDS && ODDS[b]) || b }; }),
    };
  }
  const roleHe = L.role === 'starter' ? ((SELECTION && SELECTION.starter) || 'בהרכב') : ('נכנס מהספסל בדקה ' + L.on);
  return {
    phase: L.phase, compHe: compHe(S, fx.comp), roundHe: roundHe(fx), kind: fx.kind, big: !!fx.big, dateHe: weekLabelHe(S.season, fx.week),
    home, away, isHome: L.side === 'h', role: L.role, roleHe, onMinute: L.on,
    introHe: fill(L.intro, { score: L.sc[0] + '-' + L.sc[1] }), score: L.sc.slice(), minute: L.cl,
    momentIndex: L.i, momentsTotal: L.mo.length, moment,
    log: L.log.map((e) => ({ minute: e.m, textHe: fill(e.t, { score: L.sc[0] + '-' + L.sc[1] }), kind: e.k })),
    ratingSoFar: round1(TUNE.ratingBase + L.rd), extraHe: L.phase === 'ended' ? extraHe(L.et) : null,
  };
}

// Final rating per §5.6
export function computeRating(S, rng, L) {
  const p = S.player;
  const r = resOf(L);
  const minutes = L.off - L.on;
  const opp = L.side === 'h' ? L.sc[1] : L.sc[0];
  let rating = TUNE.ratingBase + L.rd + (r === 'W' ? 0.3 : r === 'L' ? -0.3 : 0);
  if (minutes >= 60 && opp === 0) {
    if (p.pos === 'GK') rating += 0.5;
    else if (p.pos === 'CB' || p.pos === 'LB' || p.pos === 'RB') rating += 0.3;
    else if (p.pos === 'CDM') rating += 0.15;
  }
  if (p.pos === 'GK') rating += TUNE.gkRatingAdj;
  if (p.pos === 'GK' && opp > 1) rating -= 0.2 * (opp - 1);
  rating += rng.normal(0, 0.2);
  return round1(clamp(rating, 3.0, 10.0));
}

export function momentStats(L) {
  let g = 0, a = 0, cards = 0, fans = 0;
  for (const mo of L.mo) {
    if (!mo.res) continue;
    if (mo.res.code === 'GOAL') g++;
    if (mo.res.code === 'ASSIST') a++;
    if (mo.res.code === 'CARD') cards++;
    if (mo.res.f) fans += mo.res.f;
  }
  return { g, a, cards, fans };
}

export function cleanSheetEligible(S) { const g = posGroup(S.player.pos); return g === 'GK' || g === 'DEF'; }
export { clubLeague, clubPrestige, country };

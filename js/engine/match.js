// Live player match: creation, moments, auto play, end, finish (SPEC §2.3, §5.5, §5.6, §6.3).
// v2: structured match log (C4) with cosmetic substitutions/cards, scorers, big/mega goal flags and
// women's competition names (C3).
import { rngFor } from '../core/rng.js';
import { MATCH_TEXT } from '../data/commentary.js';
import * as COMX from '../data/commentary.js';
import { equippedOf } from './meta.js';
import { EURO_COMPS, TOURNAMENTS, ROUND_NAMES, ODDS, SELECTION } from '../data/strings.js';
import { LEAGUE_BY_ID } from '../data/leagues.js';
import { clamp, fill, round1, curGender, gtext } from './util.js';
import { lambdas, simExtraTime, simPenalties } from './sim.js';
import { cs, clubData, clubLeague, teamVM, nameFor, country, clubPrestige, lgNameHe, lgYouthHe } from './world.js';
import { cupDef } from './cups.js';
import { ovrOf, posGroup } from './player.js';
import { effAdj, bandOf } from './load.js';
import { weekLabelHe } from './calendar.js';
import { MOMENTS, TUNE, generateMoments, optionChance, oddsBand, resolveOption, expectedValue, setupText, optionLabel, resultText, momentCtx } from './moments.js';

// ---------- labels (women's football names when the career gender is 'f') ----------
const W_TOUR = {
  wc: 'גביע העולם לנשים', euro: 'יורו הנשים', copa: 'קופה אמריקה לנשים', afcon: 'אליפות אפריקה לנשים', asian: 'גביע אסיה לנשים',
  gold: 'גביע הזהב לנשים', u17: 'אליפות עד גיל 17 לנערות', u19: 'אליפות עד גיל 19 לנערות', u21: 'אליפות עד גיל 21 לנשים',
  qual: 'מוקדמות', friendly: 'משחק ידידות',
};
const W_EURO = { ucl: 'ליגת האלופות לנשים', uel: 'הליגה האירופית לנשים', uecl: 'הקונפרנס ליג לנשים' };
const W_EURO_SHORT = { ucl: 'האלופות', uel: 'האירופית', uecl: 'הקונפרנס' };
function fem() { return curGender() === 'f'; }
export function tourKindHe(kind) {
  if (fem() && W_TOUR[kind]) return W_TOUR[kind];
  return gtext((TOURNAMENTS && TOURNAMENTS[kind]) || kind);
}
export function euroHe(c) { return fem() ? (W_EURO[c] || c) : gtext((EURO_COMPS && EURO_COMPS[c] && EURO_COMPS[c].he) || c); }
export function euroShortHe(c) { return fem() ? (W_EURO_SHORT[c] || c) : gtext((EURO_COMPS && EURO_COMPS[c] && EURO_COMPS[c].short) || c); }
export function tourHe(key) {
  const m = /^([a-z0-9]+?)_?(\d{4})$/.exec(key || '');
  if (!m) return key || '';
  return tourKindHe(m[1]) + ' ' + m[2];
}
const YLVL = { u17: 'עד גיל 17', u19: 'עד גיל 19', u21: 'עד גיל 21' };
export function compHe(S, comp) {
  if (!comp) return '';
  if (LEAGUE_BY_ID[comp]) return lgNameHe(comp);
  const ym = /^([a-z0-9]+)_(u17|u19)$/.exec(comp);
  if (ym && LEAGUE_BY_ID[ym[1]]) return lgYouthHe(ym[1]) + ' ' + YLVL[ym[2]];
  const cd = cupDef(comp);
  if (cd) return fem() ? (cd.nameHeW || cd.nameHe + ' לנשים') : cd.nameHe;
  if (EURO_COMPS && EURO_COMPS[comp] || W_EURO[comp]) return euroHe(comp);
  if (comp === 'fr') return tourKindHe('friendly') || 'משחק ידידות';
  if (comp.indexOf('q_') === 0) return (tourKindHe('qual') || 'מוקדמות') + ' ' + tourHe(comp.slice(2));
  if (comp.indexOf('ynt_') === 0) {
    const l = comp.slice(4);
    return (fem() ? (l === 'u21' ? 'נבחרת הצעירות ' : 'נבחרת הנערות ') : 'נבחרת ') + (YLVL[l] || YLVL.u21);
  }
  return tourHe(comp);
}
/** C3 helper: display name of any competition id for this career (women's names when gender 'f'). */
export function compNameHe(id, S) { return compHe(S, id); }

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

// v2.3 (F3): the scripted debut's lines (commentary.js DEBUT_SCRIPT); null = use the normal commentary
function tutLine(L, key, v, sub, salt) {
  const DS = COMX.DEBUT_SCRIPT;
  if (!L.tut || !DS) return null;
  const arr = sub ? (DS[key] && DS[key][sub]) : DS[key];
  if (!Array.isArray(arr) || !arr.length) return null;
  const t = arr[rngFor('tut', L.ck || 'x', key, sub || '', salt || '').int(0, arr.length - 1)];
  const out = fill(t, v);
  return /{[a-zA-Z0-9_]+}/.test(out) ? null : out;
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

// ---------- cosmetic randomness (never touches the main RNG) ----------
function crng(L) { L.cc = (L.cc || 0) + 1; return rngFor('cos', L.ck || 'x', L.cc); }
function pickW(r, items, wf) { return items.length ? r.weighted(items, wf) : null; }

const DEF_TXT = {
  sub_mate: ['דקה {minute}: חילוף אצל {team}. {in} {{נכנס|נכנסת}} במקום {out}', 'דקה {minute}: {team} {{מרעננים|מרעננות}} את ההרכב: {in} על הדשא, {out} {{יוצא|יוצאת}}'],
  sub_opp: ['דקה {minute}: חילוף אצל {opp}. {in} {{נכנס|נכנסת}} במקום {out}', 'דקה {minute}: {opp} {{מחליפים|מחליפות}}: {out} {{יוצא|יוצאת}}, {in} {{נכנס|נכנסת}}'],
  card_mate: ['דקה {minute}: כרטיס צהוב ל{name} ({team})', 'דקה {minute}: השופט שולף צהוב. {name} מ{team} {{מוזהר|מוזהרת}}'],
  card_opp: ['דקה {minute}: כרטיס צהוב ל{name} ({opp})', 'דקה {minute}: עבירה קשוחה של {name}, צהוב ל{opp}'],
};
function txtList(key) { const MT = MATCH_TEXT || {}; return (Array.isArray(MT[key]) && MT[key].length) ? MT[key] : DEF_TXT[key]; }

// Create the live match. fxd: fixture descriptor, side 'h'|'a', sel: selection result
export function createLive(S, rng, fxd, side, sel) {
  const own = side === 'h' ? fxd.h : fxd.a;
  const opp = side === 'h' ? fxd.a : fxd.h;
  const p = S.player;
  const ovr = ovrOf(p) + effAdj(p);   // v2.2: effective OVR (load band + sharpness); the shown OVR does not change
  const sOwnBase = sideStrength(S, fxd, own);
  const sOpp = sideStrength(S, fxd, opp);
  const role = sel.sel === 'starter' ? 'starter' : 'bench';
  const on = role === 'starter' ? 0 : sel.on;
  const off = role === 'starter' ? sel.off : 90;
  const minutes = off - on;
  const sOwn = sOwnBase + (ovr - sOwnBase) * 0.10 * (minutes / 90);
  const big = isBig(S, fxd, own, opp);
  let ms = generateMoments(rng, { pos: p.pos, starter: role === 'starter', on, off, big, ovr, teamStr: sOwnBase });
  // v2.3 (F3): the scripted debut. The player comes on, gets one build-up moment and one golden chance late on; every option
  // of a tutorial moment succeeds (chooseLive), so the debut always ends with the player's goal (a mega celebration).
  const tut = !!sel.tut;
  if (tut) {
    const gkP = p.pos === 'GK';
    const firstType = gkP ? 'gk_penalty' : (p.pos === 'LW' || p.pos === 'RW' || p.pos === 'LB' || p.pos === 'RB') ? 'dribble' : 'through_ball';
    ms = [{ m: Math.min(80, on + 7), type: firstType }, { m: 86, type: gkP ? 'penalty' : 'one_on_one' }];
  }
  // v2.3 review: the form governor. A drought (3+ senior games with 20+ minutes and no goal / assist) gets one golden
  // chance (a one-on-one); after 4 blank games that chance cannot fail. A hot streak makes the chances a bit harder,
  // so goals stay special. Deterministic: no draw from the match stream.
  const fm = formOf(S);
  const seniorK = fxd.kind === 'league' || fxd.kind === 'cup' || fxd.kind === 'europe' || fxd.kind === 'national' || fxd.kind === 'friendly';
  const pg = posGroup(p.pos);
  let govM = null;
  if (!tut && seniorK && (pg === 'ATT' || p.pos === 'CAM') && fm.dry >= 3 && minutes >= 12) {
    const ex = ms.find((x) => x.type === 'one_on_one' || x.type === 'penalty');
    if (ex) govM = ex.m;
    else {
      let mm = clamp(Math.round(on + (off - on) * 0.62), on + 3, off - 2);
      while (ms.some((x) => x.m === mm)) mm++;
      govM = mm;
      ms.push({ m: mm, type: 'one_on_one' });
      ms.sort((a, b) => a.m - b.m);
    }
  }
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
  if (tut) { bg.length = 0; bg.push({ m: 31, side: side === 'h' ? 'a' : 'h' }, { m: 57, side }); }
  bg.sort((x, y) => (x.m - y.m) || (x.side < y.side ? -1 : x.side > y.side ? 1 : 0));
  const tm = [0, 1, 2, 3, 4].map((k) => nameFor(own, S.season, 'mate', k));
  const gk = nameFor(opp, S.season, 'gk', 0);
  // names for the watch-mode feed (derived streams: stable, never touch the main RNG)
  const takenOwn = tm.slice(), takenOpp = [gk];
  const x = uniqNames(own, S.season, 'xi', 5, takenOwn);
  const b = uniqNames(own, S.season, 'bench', 5, takenOwn);
  const ox = uniqNames(opp, S.season, 'xi', 8, takenOpp);
  const ob = uniqNames(opp, S.season, 'bench', 4, takenOpp);
  const fx = {
    comp: fxd.comp, week: S.week, slot: fxd.slot, h: fxd.h, a: fxd.a, kind: fxd.kind, tie: fxd.tie || null, ko: !!fxd.ko, big,
    neutral: !!fxd.neutral, ref: fxd.ref || null, rk: fxd.rk || null, r: fxd.r === undefined ? null : fxd.r, md: fxd.md || null,
    lvl: fxd.lvl || null, final: !!fxd.final,
  };
  const L = {
    fx, role, phase: 'pre', on, off, sc: [0, 0], bg, mo: [], i: 0, log: [], rd: 0, et: null,
    side, own, opp, so: Math.round(sOwn * 10) / 10, sa: sOpp, cl: on, bi: 0, auto: false,
    nm: { tm, gk, x, b, ox, ob, po: x[4], pi: b[4] }, ht: false, subOn: false, subOff: false, intro: '',
    ck: S.id + '|' + S.season + '|' + S.week + '|' + fxd.slot + '|' + fxd.comp, cc: 0, cx: [], ci: 0, out: [], mg: 0, pn: playerCall(S),
  };
  if (tut) L.tut = 1;
  L.cx = genCosmetic(L);
  const v0 = vars(S, L);
  L.mo = ms.map((m, k) => {
    const vv = Object.assign({}, v0, { teammate: tm[(k + 1) % tm.length], minute: String(m.m) });
    delete vv.score;
    const setup = setupText(rng, m.type, vv);
    const ts = tut ? tutLine(L, k === ms.length - 1 ? (p.pos === 'GK' ? '_none' : 'chance') : (p.pos === 'GK' ? 'gkSaveChance' : 'firstTouch'), Object.assign({}, vv, { gk: gk, score: '{score}' })) : null;
    const mo = { m: m.m, type: m.type, opts: Object.keys(MOMENTS[m.type].opts), setup: ts || setup, res: null };
    if (govM !== null && m.m === govM && (m.type === 'one_on_one' || m.type === 'penalty') && !L.mo.some((x) => x && x.gov)) { mo.gov = 1; if (fm.dry >= 4) mo.sure = 1; }
    return mo;
  });
  L.fm = !tut && seniorK && pg !== 'GK' ? (fm.hot >= 4 ? 0.75 : fm.hot >= 2 ? 0.85 : 1) : 1;
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
  if (tut) L.intro = tutLine(L, 'intro', v0) || L.intro;
  return L;
}

/** v2.3 review: consecutive senior games with a goal (hot) / without a goal or an assist (dry), from the meta counters. */
export function formOf(S) {
  const c = S && S.meta && S.meta.cnt ? S.meta.cnt : {};
  return { hot: Number(c.hot) || 0, dry: Number(c.dry) || 0 };
}
// n distinct generated names (not in `taken`; appended to it)
function uniqNames(team, season, tag, n, taken) {
  const out = [];
  for (let k = 0; out.length < n && k < n + 40; k++) {
    const nm = nameFor(team, season, tag, k);
    if (taken.indexOf(nm) >= 0) continue;
    taken.push(nm); out.push(nm);
  }
  while (out.length < n) out.push(nameFor(team, season, tag, 100 + out.length));
  return out;
}

// 2-3 cosmetic substitutions per team and 0-3 yellow cards: [{ m, t:'sub'|'card', s:'own'|'opp', i, o, n }]
function genCosmetic(L) {
  const r = crng(L);
  const ev = [];
  for (const s of ['own', 'opp']) {
    const n = 2 + (r.chance(0.55) ? 1 : 0);
    const mins = [];
    let guard = 0;
    while (mins.length < n && guard++ < 60) {
      const m = r.chance(0.18) ? 46 : r.int(55, 87);
      if (mins.indexOf(m) < 0 || m === 46) mins.push(m);
    }
    mins.sort((a, c) => a - c);
    const outPool = [];
    for (const nm of (s === 'own' ? L.nm.x.slice(0, 4).concat(L.nm.tm.slice(1)) : L.nm.ox)) if (outPool.indexOf(nm) < 0 && nm !== L.nm.po) outPool.push(nm);
    const inPool = s === 'own' ? L.nm.b.slice(0, 4) : L.nm.ob.slice();
    mins.forEach((m, k) => {
      const out = outPool.splice(r.int(0, outPool.length - 1), 1)[0];
      ev.push({ m, t: 'sub', s, i: inPool[k % inPool.length], o: out });
    });
  }
  const nc = r.int(0, 3);
  for (let k = 0; k < nc; k++) {
    const s = r.chance(0.5) ? 'own' : 'opp';
    ev.push({ m: r.int(8, 89), t: 'card', s, n: s === 'own' ? r.pick(L.nm.x.slice(0, 4).concat(L.nm.tm.slice(1))) : r.pick(L.nm.ox) });
  }
  ev.sort((a, c) => (a.m - c.m) || (a.t < c.t ? -1 : a.t > c.t ? 1 : 0) || (a.s < c.s ? -1 : a.s > c.s ? 1 : 0));
  return ev;
}

function logPush(L, m, t, k, x) {
  if (!t) return null;
  const e = { m, t, k, sc: L.sc.slice() };
  if (x) for (const key of Object.keys(x)) if (x[key] !== undefined && x[key] !== null && x[key] !== false) e[key] = x[key];
  L.log.push(e);
  return e;
}

function offList(L) { if (!Array.isArray(L.out)) L.out = []; return L.out; }
// On-pitch name lists at the current point of the feed
function ownScorers(L) {
  const off = offList(L);
  const items = [];
  for (const n of L.nm.tm) if (off.indexOf(n) < 0) items.push([n, 3]);
  for (const n of (L.nm.x || [])) if (off.indexOf(n) < 0) items.push([n, 1]);
  for (const e of L.log) if (e.ev === 'sub' && e.side === 'own' && e.who !== 'me' && e.i && off.indexOf(e.i) < 0) items.push([e.i, 2]);
  return items;
}
function oppScorers(L) {
  const off = offList(L);
  const items = [];
  (L.nm.ox || []).forEach((n, k) => { if (off.indexOf('o:' + n) < 0) items.push([n, k < 3 ? 3 : 1]); });
  for (const e of L.log) if (e.ev === 'sub' && e.side === 'opp' && e.i && off.indexOf('o:' + e.i) < 0) items.push([e.i, 2]);
  return items;
}
function pickScorer(L, sideTeam) {
  const r = crng(L);
  const items = sideTeam === 'own' ? ownScorers(L) : oppScorers(L);
  const it = pickW(r, items, (x) => x[1]);
  return it ? it[0] : (sideTeam === 'own' ? L.nm.tm[0] : (L.nm.ox ? L.nm.ox[0] : ''));
}

function isClubKind(k) { return k === 'league' || k === 'cup' || k === 'europe'; }
// big / mega flags of a goal just scored (score already updated). sideTeam: 'own'|'opp', who: 'me'|'mate'|'opp'
function goalFlags(S, L, m, who, sideTeam) {
  const mine = L.side === 'h' ? 0 : 1;
  const my = L.sc[mine], th = L.sc[1 - mine];
  const lead = sideTeam === 'own' ? my - th : th - my;
  const bigMatch = !!(L.fx.big || L.fx.final);
  const late = m >= 80 && (lead === 0 || lead === 1);
  const big = bigMatch || late || who === 'me';
  let mega = false;
  if (who === 'me') {
    L.mg = (L.mg || 0) + 1;
    const firstEver = S.hist.firsts.goal === null && L.mg === 1 && isClubKind(L.fx.kind);
    mega = bigMatch || (late && lead === 1) || L.mg === 3 || firstEver;
  }
  return { big, mega };
}

function goalEntry(S, rng, L, m, sideHA, opts) {
  // sideHA: 'h'|'a' scoring side; opts: { text, who, scorer, assist, code, k }
  if (sideHA === 'h') L.sc[0]++; else L.sc[1]++;
  const sideTeam = sideHA === L.side ? 'own' : 'opp';
  const who = opts.who || (sideTeam === 'own' ? 'mate' : 'opp');
  const fl = goalFlags(S, L, m, who, sideTeam);
  return logPush(L, m, opts.text, opts.k || (sideTeam === 'own' ? 'goal_for' : 'goal_against'),
    { ev: 'goal', who, side: sideTeam, big: fl.big, mega: fl.mega, sh: opts.scorer || null, as: !!opts.assist, code: opts.code || null });
}

function playerSubOn(S, rng, L) {
  L.subOn = true; L.cl = L.on;
  const po = L.nm.po || '';
  if (po) offList(L).push(po);
  logPush(L, L.on, tutLine(L, 'subOn', vars(S, L)) || pickLine(rng, (MATCH_TEXT || {}).sub_on, vars(S, L)) || ('דקה ' + L.on + ': ' + (L.pn || playerCall(S)) + ' על הדשא!'), 'info', { ev: 'sub', who: 'me', side: 'own', i: L.pn || playerCall(S), o: po || null });
}
function playerSubOff(S, rng, L) {
  L.subOff = true;
  logPush(L, L.off, pickLine(rng, (MATCH_TEXT || {}).sub_off, vars(S, L)) || gtext('דקה ' + L.off + ': ' + (L.pn || playerCall(S)) + ' {{יוצא|יוצאת}} מהמגרש'), 'info', { ev: 'sub', who: 'me', side: 'own', i: L.nm.pi || null, o: L.pn || playerCall(S) });
}
function halfTime(S, rng, L) {
  L.ht = true; L.cl = 45;
  logPush(L, 45, pickLine(rng, (MATCH_TEXT || {}).half_time, vars(S, L)) || ('מחצית. ' + L.sc[0] + '-' + L.sc[1]), 'info', { ev: 'ht' });
}

/** v2.3: one STAKES_COMMENTARY line in the feed (a cosmetic 'info' event at a minute after the player is on). */
export function addStakeEvent(L, text) {
  if (!text || L.phase !== 'pre' || !Array.isArray(L.cx)) return;
  const r = crng(L);
  const lo = Math.max(10, (L.on || 0) + 3), hi = Math.max(lo, Math.min(85, L.off || 90));
  const m = r.int(lo, hi);
  const ev = { m, t: 'stk', s: 'own', x: text };
  let i = L.cx.length;
  while (i > 0 && L.cx[i - 1].m > m) i--;
  L.cx.splice(i, 0, ev);
}

function cosmeticEvent(S, L, c) {
  const v = vars(S, L);
  v.minute = String(c.m);
  const r = crng(L);
  const off = offList(L);
  if (c.t === 'stk') { logPush(L, c.m, fill(c.x, v), 'info', { ev: 'info' }); return; }
  if (c.t === 'sub') {
    if (c.s === 'own') { if (off.indexOf(c.o) >= 0) return; off.push(c.o); } else off.push('o:' + c.o);
    v.in = c.i; v.out = c.o;
    logPush(L, c.m, pickLine(r, txtList(c.s === 'own' ? 'sub_mate' : 'sub_opp'), v), 'info', { ev: 'sub', who: c.s === 'own' ? 'mate' : 'opp', side: c.s, i: c.i, o: c.o });
  } else if (c.t === 'card') {
    if (off.indexOf(c.s === 'own' ? c.n : 'o:' + c.n) >= 0) return;
    v.name = c.n;
    logPush(L, c.m, pickLine(r, txtList(c.s === 'own' ? 'card_mate' : 'card_opp'), v), 'info', { ev: 'card', who: c.s === 'own' ? 'mate' : 'opp', side: c.s, sh: c.n });
  }
}

function bgGoal(S, rng, L, g) {
  const MT = MATCH_TEXT || {};
  L.cl = g.m;
  const mine = g.side === L.side;
  const scorer = pickScorer(L, mine ? 'own' : 'opp');
  // the score in the line is the score after the goal
  const v = vars(S, L);
  if (g.side === 'h') v.score = (L.sc[0] + 1) + '-' + L.sc[1]; else v.score = L.sc[0] + '-' + (L.sc[1] + 1);
  if (mine) v.teammate = scorer;
  v.scorer = scorer;
  const text = pickLine(rng, mine ? MT.goal_for : MT.goal_against, v) || (mine ? 'גול!' : 'ספגנו.');
  goalEntry(S, rng, L, g.m, g.side, { text, scorer });
}

// Before handling anything at minute m: half time, the player's own sub on/off.
function preMinute(S, rng, L, m) {
  if (!L.ht && m > 45) halfTime(S, rng, L);
  if (L.role === 'bench' && !L.subOn && m >= L.on) playerSubOn(S, rng, L);
  if (!L.subOff && L.off < 90 && m > L.off) playerSubOff(S, rng, L);
}

// Advance the clock to minute `to`, processing background goals / cosmetic events with minute < to (or <= to if inclusive)
function advanceTo(S, rng, L, to, inclusive) {
  if (!Array.isArray(L.cx)) L.cx = [];
  if (typeof L.ci !== 'number') L.ci = 0;
  const ok = (m) => (inclusive ? m <= to : m < to);
  for (let guard = 0; guard < 400; guard++) {
    const g = L.bi < L.bg.length ? L.bg[L.bi] : null;
    const c = L.ci < L.cx.length ? L.cx[L.ci] : null;
    const gm = g && ok(g.m) ? g.m : Infinity;
    const cm = c && ok(c.m) ? c.m : Infinity;
    if (gm === Infinity && cm === Infinity) break;
    const m = Math.min(gm, cm);
    preMinute(S, rng, L, m);
    if (gm <= cm) { L.bi++; bgGoal(S, rng, L, g); } else { L.ci++; cosmeticEvent(S, L, c); }
    L.cl = Math.max(L.cl, m);
  }
  if (!L.ht && to > 45) halfTime(S, rng, L);
  if (L.role === 'bench' && !L.subOn && to >= L.on) playerSubOn(S, rng, L);
  if (!L.subOff && L.off < 90 && (inclusive ? to >= L.off : to > L.off)) playerSubOff(S, rng, L);
  L.cl = Math.max(L.cl, Math.min(to, 90));
}

export function startLive(S, rng, L) {
  if (L.phase !== 'pre') return;
  L.phase = 'live';
  logPush(L, 0, L.intro, 'info', { ev: 'kickoff' });   // minute 0: the intro is the first line of the feed even for a bench player
  if (L.mo.length === 0) { endLive(S, rng, L); return; }
  advanceTo(S, rng, L, L.mo[0].m, false);
  L.cl = L.mo[0].m;
}

function aggLevel(L) {
  if (!L.fx.ko) return false;
  const agg = L.fx.tie && L.fx.tie.agg ? L.fx.tie.agg : [0, 0];
  return L.sc[0] + agg[0] === L.sc[1] + agg[1];
}

// After the final whistle: mark the winning goal (late winner => big; by the player => mega).
function finalizeFlags(L) {
  const mine = L.side === 'h' ? 0 : 1;
  const my = L.sc[mine], th = L.sc[1 - mine];
  if (my === th) return;
  const win = my > th ? 'own' : 'opp';
  const need = Math.min(my, th) + 1;
  let c = 0;
  for (const e of L.log) {
    if (e.ev !== 'goal' || e.side !== win) continue;
    c++;
    if (c === need) {
      e.win = true;
      if (e.m >= 80) { e.big = true; if (e.who === 'me') e.mega = true; }
      break;
    }
  }
}

export function endLive(S, rng, L) {
  const MT = MATCH_TEXT || {};
  advanceTo(S, rng, L, 90, true);
  L.cl = 90;
  if (aggLevel(L)) {
    const sh = L.side === 'h' ? L.so : L.sa, sa = L.side === 'h' ? L.sa : L.so;
    const [eh, ea] = simExtraTime(rng, sh, sa);
    let pens = null;
    logPush(L, 90, pickLine(rng, MT.extra_time, vars(S, L)) || 'הארכה!', 'info', { ev: 'et' });
    // extra-time goals in the feed (minutes from a cosmetic stream)
    const r = crng(L);
    const eg = [];
    for (let i = 0; i < eh; i++) eg.push({ m: r.int(91, 120), side: 'h' });
    for (let i = 0; i < ea; i++) eg.push({ m: r.int(91, 120), side: 'a' });
    eg.sort((x, y) => (x.m - y.m) || (x.side < y.side ? -1 : 1));
    for (const g of eg) {
      L.cl = g.m;
      const mineG = g.side === L.side;
      const scorer = pickScorer(L, mineG ? 'own' : 'opp');
      const v = vars(S, L);
      v.minute = String(g.m);
      v.score = g.side === 'h' ? (L.sc[0] + 1) + '-' + L.sc[1] : L.sc[0] + '-' + (L.sc[1] + 1);
      if (mineG) v.teammate = scorer;
      v.scorer = scorer;
      const text = pickLine(crng(L), mineG ? MT.goal_for : MT.goal_against, v) || (mineG ? 'גול בהארכה!' : 'ספגנו בהארכה.');
      goalEntry(S, rng, L, g.m, g.side, { text, scorer });
    }
    L.cl = 120;
    if (aggLevel(L)) {
      pens = simPenalties(rng);
      const won = (L.side === 'h' ? pens[0] > pens[1] : pens[1] > pens[0]);
      logPush(L, 120, pickLine(rng, won ? MT.pens_win : MT.pens_loss, vars(S, L)) || ('פנדלים ' + pens[0] + '-' + pens[1]), 'info', { ev: 'pens', pside: won ? 'own' : 'opp', pw: pens.slice() });
    }
    L.et = { sc: [eh, ea], pens };
    L.cl = 120;
  }
  const res = resOf(L);
  const ft = MT.full_time || {};
  const ftText = tutLine(L, 'fullTime', vars(S, L), res) || pickLine(rng, ft[res], vars(S, L)) || 'שריקת הסיום.';
  const pensTxt = L.et && L.et.pens ? 'שריקת הסיום. הפנדלים הכריעו: ' + L.et.pens[0] + '-' + L.et.pens[1] : null;
  logPush(L, L.cl, pensTxt || ftText, 'info', { ev: 'ft' });
  finalizeFlags(L);
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
  // v2.3: tutorial moments (and the form governor's sure chance) always succeed; the governor scales attacking chances
  const p0 = L.tut || mo.sure ? 1 : optionChance(mo.type, key, ctx);
  const p = L.tut || mo.sure || MOMENTS[mo.type].side !== 'att' || !(L.fm && L.fm !== 1) ? p0 : clamp(p0 * L.fm, 0.03, 0.97);
  const r = resolveOption(rng, mo.type, key, p);
  const mine = L.side === 'h' ? 0 : 1;
  const ownHA = L.side, oppHA = L.side === 'h' ? 'a' : 'h';
  let goalFor = false, goalAgainst = false;
  if (r.code === 'GOAL' || r.code === 'ASSIST') goalFor = true;
  if (r.code === 'CONCEDED' || r.code === 'GK_CONCEDED') goalAgainst = true;
  L.cl = mo.m;
  const v = vars(S, L);
  v.teammate = L.nm.tm[(L.i + 1) % L.nm.tm.length];
  if (goalFor) v.score = mine === 0 ? (L.sc[0] + 1) + '-' + L.sc[1] : L.sc[0] + '-' + (L.sc[1] + 1);
  if (goalAgainst) v.score = mine === 0 ? L.sc[0] + '-' + (L.sc[1] + 1) : (L.sc[0] + 1) + '-' + L.sc[1];
  const oppScorer = goalAgainst ? pickScorer(L, 'opp') : null;
  if (r.code === 'GOAL') v.scorer = L.pn || playerCall(S); else if (r.code === 'ASSIST') v.scorer = v.teammate; else if (oppScorer) v.scorer = oppScorer;
  const t0 = resultText(rng, mo.type, r.code, v);
  const t = (L.tut && r.code === 'GOAL' ? tutLine(L, 'goal', Object.assign({}, v, { gk: L.nm.gk }), null, L.i) : L.tut && r.code === 'SAVE' ? tutLine(L, 'gkSave', v) : null) || t0;
  mo.res = { opt: idx, code: r.code, ok: r.ok, t, d: r.d };
  if (r.fans) mo.res.f = r.fans;
  L.rd = Math.round((L.rd + r.d) * 100) / 100;
  let entry;
  if (r.code === 'GOAL') entry = goalEntry(S, rng, L, mo.m, ownHA, { text: t, who: 'me', scorer: L.pn || playerCall(S), code: r.code, k: 'goal_for' });
  else if (r.code === 'ASSIST') entry = goalEntry(S, rng, L, mo.m, ownHA, { text: t, who: 'mate', scorer: v.teammate, assist: true, code: r.code, k: 'goal_for' });
  else if (goalAgainst) entry = goalEntry(S, rng, L, mo.m, oppHA, { text: t, who: 'opp', scorer: oppScorer, code: r.code, k: 'goal_against' });
  else if (r.code === 'CARD') entry = logPush(L, mo.m, t, 'moment', { ev: 'card', who: 'me', side: 'own', sh: L.pn || playerCall(S), code: r.code });
  else entry = logPush(L, mo.m, t, 'moment', { ev: 'moment', who: 'me', side: 'own', code: r.code, ok: !!r.ok, mt: mo.type });
  L.i++;
  if (L.i < L.mo.length) {
    advanceTo(S, rng, L, L.mo[L.i].m, false);
    L.cl = L.mo[L.i].m;
  } else endLive(S, rng, L);
  return { code: r.code, ok: r.ok, textHe: t, ratingDelta: r.d, score: L.sc.slice(), goalFor, goalAgainst,
    big: !!(entry && entry.big), mega: !!(entry && entry.mega) };
}

/** v2.3 review (key moments in watch mode): the soft auto choice for the current moment only. Returns the outcome. */
export function autoOneLive(S, rng, L) {
  if (L.phase === 'pre') startLive(S, rng, L);
  if (L.phase !== 'live' || L.i >= L.mo.length) { if (L.phase === 'live') endLive(S, rng, L); return null; }
  return chooseLive(S, rng, L, softPick(S, rng, L));
}
function softPick(S, rng, L) {
  const mo = L.mo[L.i];
  const ctx = momentCtx(S, L.sa, L.side === 'h' && !L.fx.neutral, L.fx.big);
  const vals = mo.opts.map((k) => expectedValue(mo.type, k, optionChance(mo.type, k, ctx)));
  const bv = Math.max(...vals);
  const ws = vals.map((v) => Math.exp((v - bv) / 0.12));
  let r = rng.float(0, ws.reduce((a, b) => a + b, 0));
  let best = ws.length - 1;
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) { best = i; break; } }
  return best;
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
function evOf(e) {
  if (e.ev) return e.ev;
  if (e.k === 'goal_for' || e.k === 'goal_against') return 'goal';
  if (e.k === 'moment') return 'moment';
  return 'info';
}
/** Structured log (C4): { minute, textHe, kind, ev, who, side, big, mega, inHe, outHe, score, scorerHe, assist, code, ok, winner, pens } */
export function logVM(L) {
  return L.log.map((e) => {
    const ev = evOf(e);
    const sc = e.sc ? e.sc.slice() : L.sc.slice();
    let who = e.who || null;
    let side = e.side || null;
    if (ev === 'goal') {
      if (!who) who = e.k === 'goal_for' ? 'mate' : 'opp';
      if (!side) side = e.k === 'goal_for' ? 'own' : 'opp';
    }
    if (ev === 'pens') side = e.pside || null;
    return {
      minute: e.m, textHe: fill(e.t, { score: sc[0] + '-' + sc[1] }), kind: e.k, ev, who, side,
      big: !!e.big, mega: !!e.mega && who === 'me', inHe: e.i || null, outHe: e.o || null, score: sc,
      scorerHe: e.sh || null, assist: !!e.as, code: e.code || null, ok: ev === 'moment' ? !!e.ok : null, winner: !!e.win, pens: e.pw ? e.pw.slice() : null,
    };
  });
}

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
      options: mo.opts.map((k, i) => {
        const p0 = optionChance(mo.type, k, ctx);
        // the chance the player sees is the real one (tutorial / governor's sure chance = 100%, hot / dry streak scaling)
        const p = L.tut || mo.sure ? 1 : MOMENTS[mo.type].side === 'att' && L.fm && L.fm !== 1 ? clamp(p0 * L.fm, 0.03, 0.97) : p0;
        const b = oddsBand(p);
        return { index: i, key: k, he: optionLabel(mo.type, k), odds: b, oddsHe: (ODDS && ODDS[b]) || b, pct: Math.round(p * 100) };
      }),
      key: !!(L.tut || mo.gov || mo.type === 'one_on_one' || mo.type === 'penalty'), sure: !!(L.tut || mo.sure),
    };
  }
  const roleHe = L.role === 'starter' ? ((SELECTION && SELECTION.starter) || 'בהרכב') : ('{{נכנס|נכנסת}} מהספסל בדקה ' + L.on);
  const p = S.player;
  const isHome = L.side === 'h';
  const myTeam = isHome ? home : away, oppTeam = isHome ? away : home;
  return {
    phase: L.phase, compHe: compHe(S, fx.comp), roundHe: roundHe(fx), kind: fx.kind, big: !!fx.big, final: !!fx.final, ko: !!fx.ko, dateHe: weekLabelHe(S.season, fx.week),
    home, away, isHome, role: L.role, roleHe: gtext(roleHe), onMinute: L.on, offMinute: L.off,
    introHe: fill(L.intro, { score: L.sc[0] + '-' + L.sc[1] }), score: L.sc.slice(), minute: L.cl,
    momentIndex: L.i, momentsTotal: L.mo.length, moment,
    log: logVM(L),
    ratingSoFar: round1(TUNE.ratingBase + L.rd), extraHe: L.phase === 'ended' ? extraHe(L.et) : null,
    pens: L.et && L.et.pens ? L.et.pens.slice() : null,
    myTeam, oppTeam, myShortHe: myTeam.shortHe, oppShortHe: oppTeam.shortHe,
    playerHe: L.pn || playerCall(S), playerNameHe: p.first + ' ' + p.last, num: typeof p.num === 'number' ? p.num : 10, pos: p.pos,
    gender: p.gender === 'f' ? 'f' : 'm', myGoals: L.mo.filter((m) => m.res && m.res.code === 'GOAL').length,
    // v2.3: the debut tutorial, the match stakes card and the equipped cosmetics (boots / celebration style / frame / accessory)
    tutorial: !!L.tut, stakes: L.stk ? { stakes: L.stk.list.filter((x) => x.he).map((x) => ({ kind: x.kind, he: x.he, need: x.need })), goal: L.stk.goal ? { id: L.stk.goal.id, he: L.stk.goal.he, rewardStars: L.stk.goal.stars, need: L.stk.goal.need } : null } : null,
    cosmetics: S.meta ? equippedOf(S) : { boots: null, celebration: null, frame: null, accessory: null, celebrationStyle: 'classic', frameKey: 'basic', accKey: 'none', bootsColors: null, accColors: null },
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
  rating += bandOf(p).rt;   // v2.2: heavy -0.2, burnt -0.4
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

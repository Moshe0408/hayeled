// v2.2 training load (docs/SPEC-2.2-training-bench.md §3): intensity, load, match sharpness, burnout.
// Pure helpers over the state; the week flow in game.js calls them. No Math.random / Date.now.
import * as STR from '../data/strings.js';
import { clamp, round1, gtext, sgnHe, fill } from './util.js';
import { ageOf, ovrOf, rollInjury } from './player.js';
import { INJURIES } from '../data/strings.js';
import { curAw, emit } from './state.js';
import { queueEvent, sysMsg } from './narrative.js';

export const INT_IDS = ['light', 'normal', 'hard', 'extreme'];
/** Weekly effects per intensity (spec §3.3, calibrated with tests/sim.mjs). e energy, l load, f growth, s sharpness, inj injury / week. */
export const INT_TABLE = {
  rest:    { e: 0,   l: -12, f: 0,    s: -6, inj: 0 },
  light:   { e: -3,  l: -4,  f: 0.75, s: 1,  inj: 0.002 },
  normal:  { e: -7,  l: 3,   f: 1.00, s: 3,  inj: 0.006 },
  hard:    { e: -9,  l: 9,   f: 1.25, s: 4,  inj: 0.010 },
  extreme: { e: -22, l: 18,  f: 1.45, s: 5,  inj: 0.035 },
};
export const INT_F = { light: 0.75, normal: 1.0, hard: 1.25, extreme: 1.45 };
/**
 * Calibration (tests/sim.mjs policies, spec §9). Changes from the spec's first numbers:
 *  - natural decay 3 + decayK * load (the flat -3 has no equilibrium: every normal-training starter would burn out).
 *    Equilibria: normal + one match a week ~36 (fresh), normal + a midweek match every other week ~68 (heavy),
 *    hard without matches ~86 (burnt after ~30 weeks), extreme burnt within weeks, light / rest ~0.
 *  - a match adds 2.5 load per 90 min (6 made a normal-training starter equal to a hard-training bench player).
 *  - hard costs 9 energy / 1.0% injury, recovery 20 * (1 - load/300): at 14 / 1.5% / load/200 the energy drain
 *    cost a hard-training starter his place and the policy that alternates hard and light was never the best.
 *  - extreme adds 18 load (16 never reached the burnt band without matches, so always-extreme paid off).
 * Sharpness: sharp += table.s + matchSharp * min/90 - sharpK * (sharp - sharpBase).
 */
export const TUNE22 = {
  decay: 3, decayK: 0.07,                         // load -= decay + decayK * load (every season week, before the week's effects)
  matchLoad: 2.5, midweekLoad: 2,                 // load += matchLoad * min/90 per match, + midweekLoad for the 2nd match of a week
  sharpK: 0.10, sharpBase: 40, matchSharp: 1.5,   // sharp += table.s + matchSharp * min/90 - sharpK * (sharp - sharpBase)
  summerLoad: -10, summerSharp: -2,  // weeks 45-52
  rec: 20, recDiv: 300, restRec: 15,              // energy recovery: rec * (1 - load/recDiv) * ageRec (+ restRec on a rest week)
  burnWeeks: 4,                      // weeks in a row at load >= 80 -> burnout (-1 pac / phy / GK ref)
  burnFull: 2, burnLate: 0.5,        // the first 2 burnouts of a season cost -1 each, every later one in the same season -0.5
  minExtremeAge: 16,
};
export const BANDS = {
  fresh: { ovr: 0, sel: 0, rt: 0, inj: 1 },
  tired: { ovr: -1, sel: -1, rt: 0, inj: 1.3 },
  heavy: { ovr: -3, sel: -3, rt: -0.2, inj: 1.8 },
  burnt: { ovr: -5, sel: -5, rt: -0.4, inj: 2.6 },
};
export const BURNT_REST = 0.3;   // "the coach rests you" in 30% of the matches while burnt

export function loadBand(load) { const v = Number(load) || 0; return v >= 80 ? 'burnt' : v >= 60 ? 'heavy' : v >= 40 ? 'tired' : 'fresh'; }
export function sharpBand(sharp) { const v = Number(sharp) || 0; return v >= 70 ? 'sharp' : v >= 35 ? 'normal' : 'rusty'; }

// ---------- labels (content may override in strings.js; every key is optional) ----------
const DEF_INT_HE = { light: 'קל', normal: 'רגיל', hard: 'קשה', extreme: 'קיצוני', rest: 'מנוחה' };
const DEF_BAND_HE = { fresh: '{{רענן|רעננה}}', tired: '{{עייף|עייפה}}', heavy: '{{עמוס|עמוסה}}', burnt: '{{שחוק|שחוקה}}' };
const DEF_SHARP_HE = { sharp: 'גבוהה', normal: 'רגילה', rusty: 'נמוכה' };   // "חדות: גבוהה"
function tableOf(...names) { for (const n of names) { const t = STR[n]; if (t && typeof t === 'object') return t; } return null; }
function lbl(t, k, def) {
  const v = t ? t[k] : undefined;
  if (typeof v === 'string' && v) return v;
  if (v && typeof v === 'object' && typeof v.he === 'string' && v.he) return v.he;
  return def[k] || k;
}
export function intHe(id) { return gtext(lbl(tableOf('TRAIN_INTENSITY', 'INTENSITIES', 'TRAIN_INT', 'INTENSITY'), id, DEF_INT_HE)); }
export function bandHe(band) { return gtext(lbl(tableOf('LOAD_BANDS', 'LOAD_LABELS', 'LOAD_BAND'), band, DEF_BAND_HE)); }
export function sharpHe(band) { return gtext(lbl(tableOf('SHARP_BANDS', 'SHARPNESS', 'SHARP_LABELS', 'SHARP'), band, DEF_SHARP_HE)); }

// ---------- state ----------
/** Make sure the v4 fields exist (new careers, migrated saves, saves loaded mid-match). */
export function ensureLoad(S) {
  const p = S.player;
  if (!p) return;
  if (typeof p.load !== 'number' || !Number.isFinite(p.load)) p.load = 20;
  if (typeof p.sharp !== 'number' || !Number.isFinite(p.sharp)) p.sharp = 60;
  if (typeof p.benchRun !== 'number') p.benchRun = 0;
  if (typeof p.lowMin !== 'number') p.lowMin = 0;
  if (!p.talk || typeof p.talk !== 'object') p.talk = { lastWeekAbs: -99, promise: null, mood: 0 };
  if (typeof p.talk.lastWeekAbs !== 'number') p.talk.lastWeekAbs = -99;
  if (!('promise' in p.talk)) p.talk.promise = null;
  if (!Array.isArray(p.lh)) p.lh = [];
  if (!p.ld || typeof p.ld !== 'object') p.ld = { burn: 0, lastBurn: -99, burns: 0, hard: 0, ntNo: 0 };
  if (INT_IDS.indexOf(S.trainInt) < 0) S.trainInt = 'normal';
}

export function ageLoadF(age) { return age > 30 ? 1 + (age - 30) * 0.06 : 1; }
export function ageRecF(age) { return age > 30 ? Math.max(0.5, 1 - (age - 30) * 0.03) : 1; }

/** Intensity actually used this week ('rest' for the rest focus; extreme falls back to hard under 16). */
export function effIntensity(S, focus, intensity) {
  if (focus === 'rest') return 'rest';
  let it = INT_IDS.indexOf(intensity) >= 0 ? intensity : (INT_IDS.indexOf(S.trainInt) >= 0 ? S.trainInt : 'normal');
  if (it === 'extreme' && ageOf(S) < TUNE22.minExtremeAge) it = 'hard';
  return it;
}

/** In-match OVR adjustment of load + sharpness (the shown OVR never changes). */
export function effAdj(p) {
  const b = BANDS[loadBand(p.load)] || BANDS.fresh;
  const sh = typeof p.sharp === 'number' ? p.sharp : 60;
  return b.ovr + (sh - 60) / 20;
}
export function effOvr(p) { return ovrOf(p) + effAdj(p); }
export function bandOf(p) { return BANDS[loadBand(p.load)] || BANDS.fresh; }

// ---------- week flow ----------
/** Week start: natural decay, then the energy recovery scaled by the load (spec §3.3). */
export function weekStartLoad(S, focus) {
  const p = S.player;
  ensureLoad(S);
  const W = S.wsum;
  if (W) { W.e0 = p.energy; W.l0 = Math.round(p.load); W.nm = 0; }
  const summer = S.week > 44;
  if (summer) p.load = p.load + TUNE22.summerLoad;
  else p.load = p.load - (TUNE22.decay + TUNE22.decayK * p.load);
  p.load = clamp(p.load, 0, 100);
  const rec = TUNE22.rec * (1 - p.load / TUNE22.recDiv) * ageRecF(ageOf(S));
  p.energy = clamp(p.energy + rec + (focus === 'rest' ? TUNE22.restRec : 0), 0, 100);
}

/** Load / sharpness of a played match (called from finishMatch). */
export function matchLoad(S, minutes) {
  const p = S.player;
  ensureLoad(S);
  const W = S.wsum;
  let add = TUNE22.matchLoad * minutes / 90;
  if (W) { W.nm = (W.nm || 0) + 1; if (W.nm === 2) add += TUNE22.midweekLoad; }
  p.load = clamp(p.load + add, 0, 100);
  p.sharp = clamp(p.sharp + TUNE22.matchSharp * minutes / 90, 0, 100);
}

function trainingInjury(S, rng) {
  if (rng.chance(0.8)) {
    const list = (INJURIES && INJURIES.minor) || [];
    const it = rng.pick(list) || { id: 'knock' };
    return { weeks: rng.int(1, 2), kind: it.id, sev: 'minor' };
  }
  const inj = rollInjury(S, rng);
  if (inj.sev === 'major') inj.weeks = Math.min(inj.weeks, 12);
  return inj;
}

/**
 * Week end training effects: energy cost, load, sharpness and the training injury roll.
 * Returns { injured } (the caller runs the shared injury flow).
 */
export function trainingWeekEnd(S, rng, focus, intensity) {
  const p = S.player;
  ensureLoad(S);
  const age = ageOf(S);
  const busy = !!p.injury || p.stage === 'retired';
  const key = busy ? 'rest' : effIntensity(S, focus, intensity);
  const T = INT_TABLE[key] || INT_TABLE.normal;
  if (!busy) p.energy = clamp(p.energy + T.e, 0, 100);
  if (S.week > 44) {
    p.sharp = clamp(p.sharp + TUNE22.summerSharp, 0, 100);
  } else {
    const dl = T.l > 0 ? T.l * ageLoadF(age) : T.l;
    p.load = clamp(p.load + dl, 0, 100);
    const ds = T.s > 0 && S.week <= 2 ? T.s * 2 : T.s;    // pre-season: sharpness builds twice as fast
    p.sharp = clamp(p.sharp + ds - TUNE22.sharpK * (p.sharp - TUNE22.sharpBase), 0, 100);
  }
  let injured = false;
  if (!p.injury && key !== 'rest' && S.week <= 44 && p.stage !== 'free' && p.stage !== 'retired') {
    const risk = T.inj * (1 + p.load / 100);
    if (rng.chance(risk)) { p.injury = trainingInjury(S, rng); injured = true; }
  }
  return { injured, key };
}

/** Round the stored values (keeps saves small and the UI numbers stable). */
export function tidyLoad(p) {
  p.load = Math.round(clamp(p.load, 0, 100) * 10) / 10;
  p.sharp = Math.round(clamp(p.sharp, 0, 100) * 10) / 10;
}

/**
 * Week end, after the training effects: burnout (4 weeks in a row at load >= 80 -> -1 pac / phy, GK also ref),
 * the physio warning (load >= 70), rust (sharp < 35), praise for hard work, the 8-week load history and the
 * training signal. info: { focus, intensity (effective, 'rest' for rest), injured }. Returns { burnout }.
 */
export function loadWeekEnd(S, rng, info) {
  const p = S.player;
  ensureLoad(S);
  const ld = p.ld;
  const aw = curAw(S);
  const W = S.wsum;
  const active = p.stage !== 'retired' && !S.retired;
  const season = S.week <= 44;
  const out = { burnout: false };
  if (!active) return out;
  // burnout
  if (info) ld.restRun = info.intensity === 'rest' ? (ld.restRun || 0) + 1 : 0;
  if (p.load >= 80) ld.burn = (ld.burn || 0) + 1; else ld.burn = 0;
  if (ld.burn >= TUNE22.burnWeeks && aw - (ld.lastBurn || -99) >= TUNE22.burnWeeks) {
    const keys = p.pos === 'GK' ? ['pac', 'phy', 'ref'] : ['pac', 'phy'];
    if (ld.bs !== S.season) { ld.bs = S.season; ld.bn = 0; }
    ld.bn = (ld.bn || 0) + 1;
    const hit = ld.bn > TUNE22.burnFull ? TUNE22.burnLate : 1;   // the body still pays, but a season cannot erase a career
    for (const k of keys) p.a[k] = round1(clamp(p.a[k] - hit, 1, 99));
    ld.lastBurn = aw; ld.burn = 0; ld.burns = (ld.burns || 0) + 1;
    out.burnout = true;
    emit('burnout', {});
    if (ld.burns === 1) queueEvent(S, 'burnout', null, rng);
    else sysMsg(S, 'physio', 'עוד חודש של עומס שחוק. הגוף משלם: המהירות והפיזיות ירדו שוב. {{תוריד|תורידי}} עומס.');
    const LT = STR.LOAD_TEXT || {};
    const bl = p.pos === 'GK' ? LT.burnoutLineGk : LT.burnoutLine;
    if (W) W.lines.push(gtext(typeof bl === 'string' && bl ? bl : 'שחיקה: ' + sgnHe(-1) + ' מהירות, ' + sgnHe(-1) + ' פיזיות' + (p.pos === 'GK' ? ', ' + sgnHe(-1) + ' רפלקסים' : '')));
  }
  const withClub = !!p.club && (p.stage === 'pro' || p.stage === 'youth');
  // physio warning
  if (season && !p.injury && p.load >= 70 && aw - (typeof ld.physio === 'number' ? ld.physio : -99) >= 6) { ld.physio = aw; queueEvent(S, 'physio_warn', null, rng); }
  // rust (right after an injury layoff the coach talks about getting back up to speed, not about resting too much)
  if (p.injury) ld.injAt = aw;
  if (season && !p.injury && withClub && p.sharp < 35 && aw - (typeof ld.rusty === 'number' ? ld.rusty : -99) >= 8) {
    ld.rusty = aw;
    queueEvent(S, aw - (typeof ld.injAt === 'number' ? ld.injAt : -99) <= 6 ? 'rusty_return' : 'rusty', null, rng);
  }
  // hard work noticed: 4 hard weeks in a row, no injury, load under 70 -> trust +3
  if (season && info && info.intensity === 'hard' && !p.injury && !info.injured && p.load < 70) ld.hard = (ld.hard || 0) + 1;
  else if (season) ld.hard = 0;
  if (ld.hard >= 4 && withClub && aw - (typeof ld.praise === 'number' ? ld.praise : -99) >= 8) {
    ld.hard = 0; ld.praise = aw;
    p.trust = clamp(p.trust + 3, 0, 100);
    queueEvent(S, 'coach_praise_work', null, rng);
    if (W) W.lines.push(gtext('המאמן שם לב לעבודה באימונים (' + sgnHe(3) + ' אמון)'));
  }
  p.lh.push(Math.round(p.load));
  while (p.lh.length > 8) p.lh.shift();
  if (info && season) emit('training', { focus: info.focus, intensity: info.intensity === 'rest' ? (S.trainInt || 'normal') : info.intensity });
  return out;
}

// ---------- preview ----------
const DEF_RISK = { none: 'אין', low: 'נמוך', mid: 'בינוני', high: 'גבוה', very_high: 'גבוה מאוד' };
function riskHe(r) { const b = riskBand(r); const t = STR.INJURY_RISK || {}; const v = b === 'very_high' ? (t.very_high || t.veryHigh) : t[b]; return typeof v === 'string' && v ? v : DEF_RISK[b]; }
function riskBand(r) { return r <= 0 ? 'none' : r < 0.010 ? 'low' : r < 0.030 ? 'mid' : r < 0.060 ? 'high' : 'very_high'; }

/** What one week of focus x intensity does (shown before "play the week"). Pure. */
export function trainingPreview(S, focus, intensity) {
  const p = S.player;
  const age = ageOf(S);
  const want = focus === 'rest' ? 'rest' : (INT_IDS.indexOf(intensity) >= 0 ? intensity : (S.trainInt || 'normal'));
  const locked = want === 'extreme' && age < TUNE22.minExtremeAge;
  const key = effIntensity(S, focus, want);
  const T = INT_TABLE[key] || INT_TABLE.normal;
  const load = typeof p.load === 'number' ? p.load : 20;
  const summer = S.week > 44;
  const loadDelta = summer ? 0 : Math.round(T.l > 0 ? T.l * ageLoadF(age) : T.l);
  const sharpDelta = summer ? TUNE22.summerSharp : (T.s > 0 && S.week <= 2 ? T.s * 2 : T.s);
  const fatigueF = load >= 80 ? 0.7 : load >= 60 ? 0.9 : 1.0;
  const growthMult = key === 'rest' ? 0 : INT_F[key];
  const risk = key === 'rest' || summer ? 0 : T.inj * (1 + load / 100);
  const energyDelta = key === 'rest' ? TUNE22.restRec : T.e;
  const TW = STR.TRAINING_WARN || {};
  const w = (k, def) => (typeof TW[k] === 'string' && TW[k] ? TW[k] : def);
  const sharp = typeof p.sharp === 'number' ? p.sharp : 60;
  const restRun = !!(p.ld && p.ld.restRun >= 3);
  const loadAfter = Math.round(clamp(load - (summer ? 10 : TUNE22.decay + TUNE22.decayK * load) + loadDelta, 0, 100));
  // expected energy at the end of the training week, before any match (recovery after the decay + the training cost)
  const loadMid = clamp(load - (summer ? 10 : TUNE22.decay + TUNE22.decayK * load), 0, 100);
  const rec = TUNE22.rec * (1 - loadMid / TUNE22.recDiv) * ageRecF(age);
  const energyAfter = Math.round(clamp(clamp((Number(p.energy) || 0) + rec + (key === 'rest' ? TUNE22.restRec : 0), 0, 100) + (key === 'rest' ? 0 : T.e), 0, 100));
  const heavy = key === 'hard' || key === 'extreme';
  // warnings depend on the intensity: hard work is warned against, light work / rest is the cure (spec §3.6)
  let warnHe = '', warnLevel = '';
  if (locked) { warnHe = w('locked', 'אימון קיצוני נפתח מגיל ' + TUNE22.minExtremeAge); warnLevel = 'info'; }
  else if (key === 'rest') {
    if (load >= 60 && !summer) { warnHe = w('restLoad', 'מנוחה תוריד את העומס ל-{n}'); warnLevel = 'good'; }
    else if (sharp < 45) { warnHe = w('rusty', 'החדות יורדת. עוד מנוחה, {{ותחליד|ותחלידי}}'); warnLevel = 'warn'; }
    else if (restRun) { warnHe = w('restLong', 'כבר כמה שבועות של מנוחה. החדות מתחילה לרדת'); warnLevel = 'warn'; }
  } else if (load >= 80 && !heavy) {
    warnHe = key === 'light' ? w('burntLight', '{{אתה שחוק|את שחוקה}}. שבוע קל יוריד את העומס ל-{n}') : w('burntNormal', '{{אתה שחוק|את שחוקה}}. אימון קל או מנוחה יורידו את העומס מהר יותר');
    warnLevel = key === 'light' ? 'good' : 'warn';
  } else if (load >= 80) { warnHe = w('burnt', '{{אתה שחוק|את שחוקה}}. עוד שבועות כאלה יורידו את המהירות והכוח'); warnLevel = 'bad'; }
  else if (heavy && loadAfter >= 80 && !summer) { warnHe = w('intoBurnt', 'האימון הזה ייקח את העומס ל-{n}. מ-80 {{אתה נשחק|את נשחקת}}, והמהירות והכוח מתחילים לרדת'); warnLevel = 'bad'; }
  else if (heavy && load >= 60) { warnHe = w('highLoad', 'העומס כבר גבוה. אימון קשה עכשיו מגדיל מאוד את הסיכון לפציעה'); warnLevel = 'warn'; }
  else if (heavy && p.energy < 20) { warnHe = w('lowEnergy', 'האנרגיה נמוכה. אימון קשה יכניס אותך למשחק {{עייף|עייפה}}'); warnLevel = 'bad'; }
  else if (key === 'extreme') { warnHe = w('extreme', 'סיכון לפציעה'); warnLevel = 'warn'; }
  else if (heavy && p.energy < 40) { warnHe = w('lowEnergy', 'האנרגיה נמוכה. אימון קשה יכניס אותך למשחק {{עייף|עייפה}}'); warnLevel = 'warn'; }
  else if (heavy && focus === 'physical' && age > 31) { warnHe = w('veteranPhysical', 'בגיל שלך אימון כושר קשה מאט את הירידה, אבל העומס גבוה'); warnLevel = 'info'; }
  const g = (n) => sgnHe(n);
  const parts = ['אנרגיה ' + g(energyDelta), 'עומס ' + g(loadDelta), 'התקדמות ⁦×' + (Math.round(growthMult * 100) / 100) + '⁩', 'סיכון פציעה: ' + riskHe(risk)];
  return {
    focus, intensity: key === 'rest' ? 'light' : key, requested: want === 'rest' ? 'light' : want, locked,
    energyDelta, loadDelta, growthMult, fatigueMult: key === 'rest' ? 0 : fatigueF, sharpDelta,
    injuryRisk: Math.round(risk * 10000) / 10000, injuryRiskHe: riskHe(risk), riskBand: riskBand(risk), warnHe: fill(warnHe, { n: String(loadAfter) }), warnLevel,
    textHe: parts.join(' · '),
    loadAfter, energyAfter,
  };
}

// ---------- VM bits ----------
export function loadVM(S) {
  const p = S.player;
  const lb = loadBand(p.load), sb = sharpBand(p.sharp);
  return {
    load: Math.round(p.load), loadBand: lb, loadHe: bandHe(lb), sharp: Math.round(p.sharp), sharpBand: sb, sharpHe: sharpHe(sb),
    loadHist: (p.lh || []).slice(-8), effAdj: round1(effAdj(p)),
  };
}

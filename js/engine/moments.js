// Key moments: catalog, generation, odds, resolution (SPEC §5.5, §5.6).
import { MOMENT_TEXT, RESULT_TEXT, RESULT_TEXT_BY_TYPE } from '../data/commentary.js';
import { clamp, fill } from './util.js';
import { formAvgOr } from './player.js';

// Calibration knobs (SPEC allows tuning starting values). Scales the base chance of options whose ok code is GOAL/ASSIST.
export const TUNE = { goalBase: 0.52, assistBase: 1.1, penBase: 1.0, gkSave: 0.2, attBg: 0.09, defBg: 0.10, gkBg: 0.2, ratingBase: 6.3, gkRatingAdj: -0.55, skillMin: -0.2, skillMax: 0.12 };

const O = (w, base, ok, fail, bonus = 0, ex = {}) => Object.assign({ w, base, ok, fail, bonus }, ex);
export const MOMENTS = {
  one_on_one: { side: 'att', opts: {
    placed: O({ sho: 0.6, dri: 0.2, pas: 0.2 }, 0.38, 'GOAL', { MISS: 1 }),
    power: O({ sho: 0.7, phy: 0.3 }, 0.34, 'GOAL', { MISS: 1 }, 0.1),
    round_gk: O({ dri: 0.7, pac: 0.3 }, 0.30, 'GOAL', { MISS: 0.6, LOST: 0.4 }, 0.2) } },
  header: { side: 'att', opts: {
    power_header: O({ phy: 0.6, sho: 0.4 }, 0.26, 'GOAL', { MISS: 1 }),
    placed_header: O({ sho: 0.7, phy: 0.3 }, 0.24, 'GOAL', { MISS: 1 }, 0.1),
    knock_down: O({ pas: 0.5, phy: 0.5 }, 0.62, 'CHANCE', { LOST: 1 }) } },
  long_shot: { side: 'att', opts: {
    curl: O({ sho: 0.7, dri: 0.3 }, 0.12, 'GOAL', { MISS: 1 }, 0.3),
    drive: O({ sho: 0.6, phy: 0.4 }, 0.11, 'GOAL', { MISS: 1 }, 0.3),
    keep_ball: O({ pas: 0.7, dri: 0.3 }, 0.72, 'CHANCE', { LOST: 1 }) } },
  through_ball: { side: 'att', opts: {
    killer_pass: O({ pas: 0.8, dri: 0.2 }, 0.30, 'ASSIST', { LOST: 1 }),
    one_two: O({ pas: 0.5, dri: 0.5 }, 0.20, 'GOAL', { LOST: 1 }, 0.1),
    safe_pass: O({ pas: 1 }, 0.80, 'CHANCE', { LOST: 1 }) } },
  dribble: { side: 'att', opts: {
    take_on_shoot: O({ dri: 0.5, sho: 0.5 }, 0.18, 'GOAL', { LOST: 1 }, 0.2),
    take_on_cross: O({ dri: 0.5, pas: 0.5 }, 0.26, 'ASSIST', { LOST: 1 }),
    recycle: O({ pas: 1 }, 0.80, 'CHANCE', { LOST: 1 }) } },
  cross: { side: 'att', opts: {
    whipped_cross: O({ pas: 0.8, pac: 0.2 }, 0.24, 'ASSIST', { LOST: 1 }),
    cutback: O({ pas: 0.6, dri: 0.4 }, 0.26, 'ASSIST', { LOST: 1 }),
    shoot_near: O({ sho: 0.8, dri: 0.2 }, 0.12, 'GOAL', { MISS: 1 }, 0.2) } },
  free_kick: { side: 'att', opts: {
    over_wall: O({ sho: 0.8, dri: 0.2 }, 0.10, 'GOAL', { MISS: 1 }, 0.3),
    power_fk: O({ sho: 0.6, phy: 0.4 }, 0.09, 'GOAL', { MISS: 1 }, 0.3),
    to_box: O({ pas: 1 }, 0.20, 'ASSIST', { MISS: 1 }) } },
  penalty: { side: 'att', opts: {
    low_corner: O({ sho: 1 }, 0.76, 'GOAL', { MISS: 1 }, 0, { pen: true }),
    top_corner: O({ sho: 0.8, phy: 0.2 }, 0.72, 'GOAL', { MISS: 1 }, 0.1, { pen: true }),
    panenka: O({ dri: 0.5, sho: 0.5 }, 0.66, 'GOAL', { MISS: 1 }, 0.3, { pen: true, fansOk: 2, fansFail: -3 }) } },
  counter: { side: 'att', opts: {
    sprint_shoot: O({ pac: 0.5, sho: 0.5 }, 0.20, 'GOAL', { MISS: 1 }, 0.1),
    pass_wide: O({ pas: 0.7, pac: 0.3 }, 0.26, 'ASSIST', { LOST: 1 }),
    slow_down: O({ pas: 0.6, dri: 0.4 }, 0.80, 'CHANCE', { LOST: 1 }) } },
  late_run: { side: 'att', opts: {
    arrive_shot: O({ sho: 0.6, pac: 0.2, phy: 0.2 }, 0.18, 'GOAL', { MISS: 1 }, 0.1),
    hold_position: O({ def: 0.5, pas: 0.5 }, 0.85, 'CHANCE', { LOST: 0.8, CONCEDED: 0.2 }) } },
  build_up: { side: 'att', opts: {
    line_break: O({ pas: 0.9, dri: 0.1 }, 0.55, 'CHANCE', { LOST: 0.8, CONCEDED: 0.2 }, 0.1),
    long_ball: O({ pas: 0.7, phy: 0.3 }, 0.14, 'ASSIST', { LOST: 1 }, 0.1),
    safe_side: O({ pas: 1 }, 0.88, 'CHANCE', { LOST: 0.7, CONCEDED: 0.3 }, -0.05) } },
  tackle: { side: 'def', opts: {
    slide: O({ def: 0.7, phy: 0.3 }, 0.58, 'WON', { CARD: 0.4, BEATEN: 0.35, CONCEDED: 0.25 }, 0.1),
    stand: O({ def: 0.8, pac: 0.2 }, 0.62, 'WON', { BEATEN: 0.7, CONCEDED: 0.3 }),
    jockey: O({ def: 0.5, pac: 0.5 }, 0.70, 'WON', { BEATEN: 0.75, CONCEDED: 0.25 }, -0.1) } },
  aerial: { side: 'def', opts: {
    attack_ball: O({ phy: 0.6, def: 0.4 }, 0.60, 'WON', { BEATEN: 0.6, CONCEDED: 0.4 }, 0.1),
    body_position: O({ def: 0.7, phy: 0.3 }, 0.66, 'WON', { BEATEN: 0.7, CONCEDED: 0.3 }) } },
  interception: { side: 'def', opts: {
    step_in: O({ def: 0.6, pac: 0.4 }, 0.52, 'WON', { BEATEN: 0.6, CONCEDED: 0.4 }, 0.2),
    hold_line: O({ def: 0.8, pas: 0.2 }, 0.68, 'WON', { BEATEN: 0.75, CONCEDED: 0.25 }) } },
  last_man: { side: 'def', opts: {
    slide_last: O({ def: 0.7, pac: 0.3 }, 0.50, 'WON', { CONCEDED: 0.6, CARD: 0.4 }, 0.3),
    track_back: O({ pac: 0.6, def: 0.4 }, 0.55, 'WON', { CONCEDED: 0.7, BEATEN: 0.3 }, 0.1),
    foul_tactical: O({ def: 0.5, phy: 0.5 }, 0.90, 'CARD', { CONCEDED: 1 }) } },
  press: { side: 'def', opts: {
    press_high: O({ pac: 0.5, phy: 0.3, def: 0.2 }, 0.40, 'WON', { BEATEN: 0.85, CONCEDED: 0.15 }, 0.25),
    hold_shape: O({ def: 0.7, pas: 0.3 }, 0.75, 'WON', { BEATEN: 0.85, CONCEDED: 0.15 }, -0.15) } },
  gk_one_on_one: { side: 'gk', opts: {
    stay_big: O({ ref: 0.5, gkp: 0.5 }, 0.42, 'SAVE', { GK_CONCEDED: 1 }),
    rush_out: O({ gkp: 0.5, div: 0.3, han: 0.2 }, 0.38, 'SAVE', { GK_CONCEDED: 1 }, 0.1),
    spread: O({ div: 0.6, ref: 0.4 }, 0.40, 'SAVE', { GK_CONCEDED: 1 }) } },
  gk_shot: { side: 'gk', opts: {
    dive_catch: O({ div: 0.5, han: 0.5 }, 0.60, 'SAVE', { GK_CONCEDED: 1 }, 0.1),
    parry: O({ div: 0.5, ref: 0.5 }, 0.66, 'SAVE', { GK_CONCEDED: 0.7, BEATEN: 0.3 }) } },
  gk_cross: { side: 'gk', opts: {
    claim: O({ han: 0.6, gkp: 0.4 }, 0.66, 'SAVE', { BEATEN: 0.6, GK_CONCEDED: 0.4 }, 0.1),
    punch: O({ gkp: 0.5, phy: 0.5 }, 0.72, 'WON', { BEATEN: 0.7, GK_CONCEDED: 0.3 }),
    stay_line: O({ ref: 0.6, gkp: 0.4 }, 0.60, 'SAVE', { GK_CONCEDED: 1 }) } },
  gk_penalty: { side: 'gk', opts: {
    dive_left: O({ div: 0.6, ref: 0.4 }, 0.24, 'SAVE', { GK_CONCEDED: 1 }, 0.5, { pen: true }),
    dive_right: O({ div: 0.6, ref: 0.4 }, 0.24, 'SAVE', { GK_CONCEDED: 1 }, 0.5, { pen: true }),
    stay_center: O({ ref: 0.6, gkp: 0.4 }, 0.14, 'SAVE', { GK_CONCEDED: 1 }, 0.8, { pen: true }) } },
  gk_distribution: { side: 'gk', opts: {
    short_build: O({ kic: 0.7, gkp: 0.3 }, 0.80, 'CHANCE', { LOST: 0.7, GK_CONCEDED: 0.3 }),
    long_kick: O({ kic: 1 }, 0.55, 'CHANCE', { LOST: 1 }) } },
};

export const VALUE = { GOAL: 1.0, ASSIST: 0.7, CHANCE: 0.25, MISS: -0.2, LOST: -0.25, WON: 0.35, BEATEN: -0.3, CONCEDED: -0.6, SAVE: 0.5, GK_CONCEDED: -0.5, CARD: -0.3 };

export const POSITION_MOMENTS = {
  ST: { one_on_one: 3, header: 2, counter: 2, dribble: 1, long_shot: 1, press: 1.5, free_kick: 0.3 },
  LW: { dribble: 3, cross: 2, counter: 2, one_on_one: 1.5, long_shot: 1, free_kick: 0.5, tackle: 0.6, press: 0.6 },
  RW: { dribble: 3, cross: 2, counter: 2, one_on_one: 1.5, long_shot: 1, free_kick: 0.5, tackle: 0.6, press: 0.6 },
  CAM: { through_ball: 3, long_shot: 2, dribble: 1.5, one_on_one: 1, free_kick: 1, press: 0.6 },
  CM: { through_ball: 2, long_shot: 1.5, late_run: 1.5, tackle: 1.5, interception: 1, press: 1, build_up: 1 },
  CDM: { interception: 2.5, tackle: 2.5, build_up: 2, aerial: 1, press: 1, long_shot: 0.7 },
  CB: { aerial: 2.5, tackle: 2, interception: 1.5, last_man: 1.5, build_up: 1, header: 1 },
  LB: { tackle: 2, cross: 2, interception: 1, late_run: 1, counter: 1, last_man: 0.7, aerial: 0.5 },
  RB: { tackle: 2, cross: 2, interception: 1, late_run: 1, counter: 1, last_man: 0.7, aerial: 0.5 },
  GK: { gk_shot: 3, gk_one_on_one: 2, gk_cross: 1.5, gk_distribution: 1 },
};

export function optionKeys(type) { return Object.keys(MOMENTS[type].opts); }
export function momentSide(type) { return MOMENTS[type].side; }

function pickType(rng, pos, side) {
  const w = POSITION_MOMENTS[pos];
  const types = Object.keys(w).filter((t) => !side || MOMENTS[t].side === side);
  if (types.length === 0) return null;
  return rng.weighted(types, (t) => w[t]);
}

// Returns [{ m, type }]
export function generateMoments(rng, ctx) {
  const { pos, starter, on, off, big, ovr, teamStr } = ctx;
  let n;
  if (starter) n = clamp(3 + rng.int(0, 2) + (big ? 1 : 0) + (ovr >= teamStr + 8 ? 1 : 0), 3, 7);
  else n = (on <= 65 ? 2 : 1) + (rng.chance(0.4) ? 1 : 0);
  const lo = Math.max(on, 1) + 2, hi = Math.max(lo, off);
  n = Math.min(n, hi - lo + 1);
  const mins = new Set();
  let guard = 0;
  while (mins.size < n && guard++ < 500) mins.add(rng.int(lo, hi));
  const ml = Array.from(mins).sort((a, b) => a - b);
  const types = ml.map(() => pickType(rng, pos));
  // penalties
  for (let i = 0; i < types.length; i++) {
    const s = MOMENTS[types[i]].side;
    if (pos === 'GK') { if (rng.chance(0.06)) types[i] = 'gk_penalty'; }
    else if (s === 'att' && rng.chance(0.06)) types[i] = 'penalty';
  }
  if (pos !== 'GK' && types.length) {
    if (!types.some((t) => MOMENTS[t].side === 'att')) types[types.length - 1] = pickType(rng, pos, 'att');
    if (['CB', 'LB', 'RB', 'CDM'].indexOf(pos) >= 0 && !types.some((t) => MOMENTS[t].side === 'def') && types.length > 1) {
      const attIdx = types.map((t, i) => (MOMENTS[t].side === 'att' && t !== 'penalty' ? i : -1)).filter((i) => i >= 0);
      const idx = attIdx.length > 1 ? attIdx[0] : types.findIndex((t, i) => i !== attIdx[0]);
      if (idx >= 0) types[idx] = pickType(rng, pos, 'def');
    }
  }
  return ml.map((m, i) => ({ m, type: types[i] }));
}

function effBase(o, type) {
  if (o.pen) return o.base * TUNE.penBase;
  if (type && type.indexOf('gk_') === 0 && type !== 'gk_distribution' && (o.ok === 'SAVE' || o.ok === 'WON')) return o.base + TUNE.gkSave;
  if (o.ok === 'GOAL') return o.base * TUNE.goalBase;
  if (o.ok === 'ASSIST') return o.base * TUNE.assistBase;
  return o.base;
}

// ctx: { a (attrs), oppQ, form, morale, energy, home, big }
export function optionChance(type, key, ctx) {
  const o = MOMENTS[type].opts[key];
  let skill = 0;
  for (const k in o.w) skill += o.w[k] * (ctx.a[k] || 0);
  const base = effBase(o, type);
  // the skill edge scales with how realistic the option is: a 12% long shot must not become a 24% one
  // just because the opponent is weak (that made always-shoot an exploit, e.g. vs minnow national teams)
  const edge = clamp((skill - ctx.oppQ) * 0.011, TUNE.skillMin, TUNE.skillMax) * Math.min(1, 0.45 + base * 1.6);
  const p = base + edge + (ctx.form - 6.6) * 0.03 + (ctx.morale - 50) * 0.0012
    + (ctx.energy < 40 ? -0.05 : 0) + (ctx.home ? 0.02 : 0) + (ctx.big ? -0.02 : 0);
  return clamp(p, 0.05, 0.95);
}
export function oddsBand(p) { return p < 0.35 ? 'low' : p < 0.60 ? 'mid' : 'high'; }

export function expectedValue(type, key, p) {
  const o = MOMENTS[type].opts[key];
  let ef = 0, tw = 0;
  for (const c in o.fail) { ef += o.fail[c] * VALUE[c]; tw += o.fail[c]; }
  ef = tw > 0 ? ef / tw : 0;
  return p * (VALUE[o.ok] + o.bonus) + (1 - p) * ef;
}

export function resolveOption(rng, type, key, p) {
  const o = MOMENTS[type].opts[key];
  const ok = rng.next() < p;
  let code = o.ok;
  if (!ok) {
    const codes = Object.keys(o.fail);
    code = rng.weighted(codes, (c) => o.fail[c]);
  }
  const d = (VALUE[code] || 0) + (ok ? o.bonus : 0);
  let fans = 0;
  if (o.fansOk) fans = ok ? o.fansOk : o.fansFail;
  return { ok, code, d: Math.round(d * 100) / 100, fans };
}

export function setupText(rng, type, vars) {
  const mt = MOMENT_TEXT && MOMENT_TEXT[type];
  const line = (mt && mt.setup && rng.pick(mt.setup)) || 'רגע חשוב במשחק!';
  return fill(line, vars);
}
export function optionLabel(type, key) {
  const mt = MOMENT_TEXT && MOMENT_TEXT[type];
  return (mt && mt.options && mt.options[key]) || key;
}
export function resultText(rng, type, code, vars) {
  const bt = RESULT_TEXT_BY_TYPE && RESULT_TEXT_BY_TYPE[type] && RESULT_TEXT_BY_TYPE[type][code];
  const list = (bt && bt.length) ? bt : (RESULT_TEXT && RESULT_TEXT[code]) || [];
  const line = rng.pick(list) || code;
  return fill(line, vars);
}
export function momentCtx(S, oppQ, home, big) {
  const p = S.player;
  return { a: p.a, oppQ, form: formAvgOr(p), morale: p.morale, energy: p.energy, home, big };
}

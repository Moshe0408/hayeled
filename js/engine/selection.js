// Matchday selection (SPEC §5.7, §5.10, §5.14).
import { clamp } from './util.js';
import { ovrOf, formAvgOr } from './player.js';

// Tuned: an average-level squad player (ovr == club strength) should usually start.
export const SEL_BIAS = 3;
const ROLE_BONUS = { star: 5, key: 3, rotation: 0, squad: -2, prospect: -3 };

function benchOrStarter(rng, p, sel, score, onChance) {
  if (sel === 'starter') {
    const off = p.energy < 45 ? rng.int(60, 85) : 90;
    return { sel, on: 0, off, score };
  }
  if (sel === 'bench') {
    const pr = onChance !== undefined ? onChance : clamp(0.55 + 0.05 * score, 0.25, 0.9);
    if (rng.chance(pr)) return { sel, on: rng.int(55, 80), off: 90, score, plays: true };
    return { sel, on: null, off: null, score, plays: false };
  }
  return { sel, on: null, off: null, score };
}

// fx: { kind, comp, preQF }  teamStr: club strength
export function clubSelection(S, rng, fx, teamStr) {
  const p = S.player;
  if (p.injury) return { sel: 'injured' };
  if (p.susp > 0 && fx.kind === 'league') { p.susp--; return { sel: 'suspended' }; }
  const ovr = ovrOf(p);
  const role = (p.contract && p.contract.role) || 'squad';
  const score = SEL_BIAS + (ovr - teamStr) + (p.trust - 50) / 8 + (formAvgOr(p) - 6.6) * 2.5 + (ROLE_BONUS[role] || 0)
    + (p.energy < 35 ? -6 : 0) + (fx.kind === 'cup' && fx.preQF && ovr < teamStr ? 3 : 0) + rng.normal(0, 1.5);
  const sel = score >= 0 ? 'starter' : score >= -7 ? 'bench' : 'out';
  const r = benchOrStarter(rng, p, sel, score);
  r.plays = sel === 'starter' || r.plays === true;
  return r;
}

export function youthSelection(S, rng, ys) {
  const p = S.player;
  if (p.injury) return { sel: 'injured' };
  const ovr = ovrOf(p);
  const score = ovr - ys + (formAvgOr(p) - 6.6) * 2 + rng.normal(0, 1.5);
  const sel = score >= -3 ? 'starter' : score >= -9 ? 'bench' : 'out';
  const r = benchOrStarter(rng, p, sel, score, 0.55);
  r.plays = sel === 'starter' || r.plays === true;
  return r;
}

// National: lvl 'senior' or youth; str = nation strength
export function nationalSelection(S, rng, lvl, str) {
  const p = S.player;
  if (p.injury) return { sel: 'injured' };
  const ovr = ovrOf(p);
  let sel;
  if (lvl === 'senior') {
    const csc = seniorScore(S);
    sel = csc >= str + 2 ? 'starter' : 'bench';
    const r = benchOrStarter(rng, p, sel, csc - str, 0.55);
    r.plays = sel === 'starter' || r.plays === true;
    return r;
  }
  const thr = youthThreshold(lvl, str);
  sel = ovr >= thr + 4 ? 'starter' : 'bench';
  const r = benchOrStarter(rng, p, sel, ovr - thr, 0.6);
  r.plays = sel === 'starter' || r.plays === true;
  return r;
}

export function seniorScore(S) {
  const p = S.player;
  return ovrOf(p) + (formAvgOr(p) - 6.6) * 2 + p.rep.c / 20 + (p.caps.senior > 0 || p.natLvl === 'senior' ? 1.5 : 0);
}
export function youthThreshold(lvl, nationStr) {
  return nationStr - (lvl === 'u17' ? 22 : lvl === 'u19' ? 16 : 10);
}

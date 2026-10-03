// Team match model (SPEC §5.4).
import { clamp } from './util.js';

export const HFA = 0.12;
export const BASE_LAMBDA = 1.30;
export const STR_K = 0.035;

export function lambdas(sH, sA, neutral) {
  const hfa = neutral ? 0 : HFA;
  const lh = clamp(BASE_LAMBDA * Math.exp(STR_K * (sH - sA) + hfa), 0.15, 4.5);
  const la = clamp(BASE_LAMBDA * Math.exp(STR_K * (sA - sH) - hfa), 0.15, 4.5);
  return [lh, la];
}

export function simScore(rng, sH, sA, opts = {}) {
  const [lh, la] = lambdas(sH, sA, !!opts.neutral);
  return [rng.poisson(lh), rng.poisson(la)];
}

export function simExtraTime(rng, sH, sA) {
  const [lh, la] = lambdas(sH, sA, true);
  return [rng.poisson(lh * 30 / 90), rng.poisson(la * 30 / 90)];
}

export function simPenalties(rng) {
  let h = 0, a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(0.76)) h++;
    if (rng.chance(0.76)) a++;
  }
  let guard = 0;
  while (h === a && guard++ < 50) {
    const x = rng.chance(0.76) ? 1 : 0;
    const y = rng.chance(0.76) ? 1 : 0;
    h += x; a += y;
  }
  if (h === a) h++;
  return [h, a];
}

// Single knockout match: returns [hg, ag, extra] with extra null | 'et' | 'p:x-y'.
// agg: [aggH, aggA] goals of the earlier leg from the perspective of THIS match's home/away (for second legs).
export function simKnockout(rng, sH, sA, opts = {}) {
  let [hg, ag] = simScore(rng, sH, sA, opts);
  const aggH = (opts.agg ? opts.agg[0] : 0) + hg;
  const aggA = (opts.agg ? opts.agg[1] : 0) + ag;
  if (aggH !== aggA) return [hg, ag, null];
  const [eh, ea] = simExtraTime(rng, sH, sA);
  hg += eh; ag += ea;
  if (eh !== ea) return [hg, ag, 'et'];
  const [ph, pa] = simPenalties(rng);
  return [hg, ag, 'p:' + ph + '-' + pa];
}

// Winner side of a decided match/tie: 'h' | 'a'
export function koWinner(hg, ag, extra, agg) {
  if (extra && extra.indexOf('p:') === 0) {
    const [ph, pa] = extra.slice(2).split('-').map(Number);
    return ph > pa ? 'h' : 'a';
  }
  const th = hg + (agg ? agg[0] : 0), ta = ag + (agg ? agg[1] : 0);
  return th >= ta ? 'h' : 'a';
}

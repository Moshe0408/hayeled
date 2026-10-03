// adslots.js: glue between screens and js/core/ads.js. With ads disabled (default) nothing renders and no space is used.
import * as game from '../engine/game.js';
import { svc, call, toast, hubSafe } from './app.js';
import { currentRoute } from './router.js';
import { ico } from './icons.js';

/** Mount an ad slot element (re-rendered on every ads config change). Returns an unmount function. */
export function mountAdSlot(el, placement = 'hub_banner') {
  if (!el) return () => {};
  const draw = () => {
    try { svc.ads.renderSlot(el, placement); } catch (e) { console.warn('[hayeled] ad slot', e); el.hidden = true; el.textContent = ''; }
  };
  draw();
  let off = () => {};
  try {
    off = svc.ads.onAdsChange(() => {
      if (!el.isConnected) { off(); return; }
      draw();
    }) || (() => {});
  } catch { off = () => {}; }
  return () => { try { off(); } catch { /* ignore */ } };
}

/** After the week summary modal closes on the hub: count the matchday and maybe show an interstitial. */
export async function afterWeekAds(summary) {
  try {
    if (summary && summary.hadMatchday) svc.ads.noteMatchday();
    const r = currentRoute();
    if (r.path === '/match') return false; // never mid-match
    const hub = hubSafe();
    return await svc.ads.maybeInterstitial({ type: 'matchday', week: hub ? hub.week : 0 });
  } catch (e) {
    console.warn('[hayeled] interstitial', e);
    return false;
  }
}

/** Should the rewarded button be visible for this hub? */
export function canShowRewardedFor(hub) {
  try {
    return !!(hub && svc.ads.canShowRewarded() && hub.canReward && hub.player && hub.player.energy < 70);
  } catch { return false; }
}

/**
 * Render the rewarded button into el (or hide el). onDone() runs after a reward was granted.
 */
export function rewardedButton(el, onDone) {
  if (!el) return;
  const hub = hubSafe();
  if (!canShowRewardedFor(hub)) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.innerHTML = '<button type="button" class="btn btn-reward" data-testid="btn-rewarded">' + ico('play') + 'צפה בפרסומת וקבל \u2066+15\u2069 אנרגיה</button>';
  const btn = el.querySelector('button');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let granted = false;
    try {
      const earned = await svc.ads.showRewarded(() => {
        const r = call(() => game.grantReward('energy15'));
        granted = !!(r && r.ok);
        if (granted) toast('\u2066+15\u2069 אנרגיה (' + r.energy + ')');
      });
      if (earned && !granted) {
        const r = call(() => game.grantReward('energy15'));
        granted = !!(r && r.ok);
        if (granted) toast('\u2066+15\u2069 אנרגיה (' + r.energy + ')');
      }
    } catch (e) { console.warn(e); }
    if (onDone) onDone(granted);
    else rewardedButton(el, onDone);
  });
}

// nudges.js (v2.3 review): one interrupting card after a week summary, at most one at a time, each only once.
//   1. the first pro contract ("חתום!" / "אחשוב על זה") - the biggest early milestone never slips by unseen
//   2. the daily reward sheet (the first hub visit of the day may have been a match screen)
//   3. "you can afford a reward now" - the first time the stars cover an item: buy + equip in one tap
// "Later" buttons carry data-nudge-later (the e2e helpers dismiss them like a busy player would).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, openModal, buzz, reducedMotion, refreshChrome } from './app.js';
import { navigate } from './router.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import { badge } from './components.js';
import { money } from './format.js';
import { celebrate } from './scene/celebration.js';
import { maybeShowDaily } from './progress.js';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
function careerId() { try { return String(game.getSaveMeta().careerId || ''); } catch { return ''; } }
let open = false;

/** After a week summary closed (no season review / retirement pending). Returns true if a card was shown. */
export function afterWeekNudges() {
  if (open) return true;
  try { if (!game.hasCareer()) return false; } catch { return false; }
  if (document.querySelector('.modal-wrap:not(.closing)')) return false;
  // automated runs (intro skipped) get no surprise cards unless they ask for them (like the daily sheet)
  try { if (localStorage.getItem('hy.intro.skip') === '1' && localStorage.getItem('hy.nudge.auto') !== '1') return false; } catch { /* ignore */ }
  if (proOffer()) return true;
  try { if (maybeShowDaily()) return true; } catch { /* ignore */ }
  if (affordable()) return true;
  return false;
}

/* ------------------------------------------------------------------ 1. the first pro contract */
function proOffer() {
  let offers = [];
  try { offers = game.getOffers() || []; } catch { offers = []; }
  const o = offers.find((x) => x && x.type === 'pro' && x.status === 'open');
  if (!o) return false;
  const key = 'hy.nudge.pro.' + careerId() + '.' + o.id;
  if (lsGet(key)) return false;
  lsSet(key, '1');
  open = true;
  const c = o.club || {};
  const close = openModal(`<div class="nudge nudge-pro" data-testid="nudge-pro">
      <span class="nudge-tag">${ico('pen', 'gold')}${esc(gtext('רגע גדול בקריירה'))}</span>
      <div class="nudge-crest">${badge(c, 'l')}</div>
      <h2 class="modal-title">${esc(gtext('חוזה מקצועני ראשון!'))}</h2>
      <p class="muted">${esc(gtext((c.nameHe || 'המועדון') + ' רוצה להחתים אותך בקבוצה הבוגרת'))}</p>
      <div class="nudge-terms"><span><small>שכר</small><b class="num">${esc(money(o.wage))}</b><small>לשבוע</small></span><span><small>שנים</small><b class="num">${esc(o.years)}</b></span><span><small>תפקיד</small><b>${esc(gtext(o.roleHe || ''))}</b></span></div>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-xl" data-a="sign" data-testid="btn-nudge-sign">${ico('pen')}${esc(gtext('{{חתום|חתמי}}!'))}</button>
        <button type="button" class="btn btn-ghost" data-a="later" data-nudge-later data-testid="btn-nudge-later">${esc('אחשוב על זה')}</button>
      </div>
      <p class="muted small center">${esc(gtext('ההצעה מחכה גם במסך ההצעות'))}</p></div>`,
  { sheet: true, testid: 'nudge', guardMs: 400, onClose: () => { open = false; } });
  close.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'later') { close(); return; }
    const r = call(() => game.respondOffer(o.id, 'accept'));
    close();
    if (r && r.ok && r.status === 'signed') {
      buzz([40, 40, 120]);
      if (!reducedMotion()) { try { celebrate({ kind: 'trophy', small: true, textHe: gtext('{{חתמת|חתמת}}!'), subHe: gtext('חוזה מקצועני ראשון ב' + (c.nameHe || '')) }); } catch { /* ignore */ } }
      toast(r.messageHe || 'חתמת!', { tone: 'good' });
    } else if (r && r.messageHe) { toast(r.messageHe); navigate('#/offers'); }
    refreshChrome();
  });
  return true;
}

/* ------------------------------------------------------------------ 3. a reward the stars can buy now */
function affordable() {
  let cos = null;
  try { cos = game.getCosmetics(); } catch { cos = null; }
  if (!cos || !Array.isArray(cos.items)) return false;
  const bal = Number(cos.balance) || 0;
  const cands = cos.items.filter((x) => x && x.slot !== 'boost' && !x.owned && x.canBuy && x.price > 0 && x.price <= bal).sort((a, b) => a.price - b.price);
  const id = careerId();
  const it = cands.find((x) => !lsGet('hy.nudge.cos.' + id + '.' + x.id));
  if (!it) return false;
  // once per career per item, and never two reward cards in a row in one session
  lsSet('hy.nudge.cos.' + id + '.' + it.id, '1');
  open = true;
  const sw = it.colors && it.colors.length ? `<span class="nudge-sw">${it.colors.map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</span>` : `<span class="nudge-sw ico">${ico(it.slot === 'celebration' ? 'sparkle' : it.slot === 'frame' ? 'star' : 'user', 'gold')}</span>`;
  const close = openModal(`<div class="nudge nudge-cos" data-testid="nudge-cos">
      <span class="nudge-tag">${ico('star', 'gold')}${esc('יש לך מספיק כוכבים!')}</span>
      ${sw}
      <h2 class="modal-title">${esc(gtext(it.slotHe ? it.slotHe + ': ' + it.he : it.he))}</h2>
      <p class="muted">${esc(gtext('{{לקנות|לקנות}} ו{{לנעול|לנעול}} עכשיו? רואים את זה על הכרטיס ובחגיגות'))}</p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-xl" data-a="buy" data-testid="btn-nudge-buy">${esc('כן! ' + it.price + '⭐')}</button>
        <button type="button" class="btn btn-ghost" data-a="shop" data-testid="btn-nudge-shop">${esc('לכל הפרסים')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-a="later" data-nudge-later data-testid="btn-nudge-later">${esc('אחר כך')}</button>
      </div></div>`,
  { sheet: true, testid: 'nudge', guardMs: 400, onClose: () => { open = false; } });
  close.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'later') { close(); return; }
    if (b.dataset.a === 'shop') { close(); navigate('#/shop?cat=rewards'); return; }
    const r = call(() => game.spendStars(it.id));
    close();
    if (r && r.ok) { buzz([20, 30, 60]); toast(r.messageHe || 'שלך!', { tone: 'good' }); } else if (r && r.messageHe) toast(r.messageHe);
    refreshChrome();
  });
  return true;
}

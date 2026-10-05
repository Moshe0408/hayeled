// rewards.js (v2.3, F6): the "פרסים" section of the shop: spend ⭐ on boots colours, celebration moves, card frames,
// avatar accessories and small boosts (energy refill once a week, the head scout's exact potential).
// Engine: game.spendStars(itemId) -> {ok, messageHe}; game.equipCosmetic(slot, id); game.getCosmetics(); game.getStars().
import * as game from '../engine/game.js';
import * as STR from '../data/strings.js';
import { esc } from './dom.js';
import { ctx, call, toast, buzz, openModal, reducedMotion } from './app.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import { avatarFor } from './components.js';
import { catalog, cosmeticsState, starsState, SLOTS, slotHe, cosUi, bootSVG, celebSVG, frameSVG } from './cosmetics.js';
import { celebrate } from './scene/celebration.js';

const RARITY_FB = { common: 'רגיל', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' };
const fillV = (s, v = {}) => gtext(String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m)));
const ST = STR.STARS_TEXT || {};

function gender() { try { return game.getSaveMeta().gender === 'f' ? 'f' : 'm'; } catch { return 'm'; } }
function kit() { try { const h = game.getHub(); return (h && h.club && h.club.colors) || ['#1D4ED8', '#FFFFFF']; } catch { return ['#1D4ED8', '#FFFFFF']; } }

function art(it, meta) {
  const v = it.vis || {};
  if (it.slot === 'boots') return bootSVG(v.boots || '#1B1F27', 86);
  if (it.slot === 'celebration') return celebSVG(v.style || 'classic', 70);
  if (it.slot === 'frame') return frameSVG(v.frame || 'basic', 46);
  if (it.slot === 'accessory') {
    const a = avatarFor({ ...meta, careerId: '__preview' }, { plain: true, kitColors: kit(), size: 74, pose: ['wristband', 'gloves', 'tape', 'sleeve'].includes(v.acc) ? 'full' : 'portrait', bg: false, acc: v.acc || null, accColors: v.accColors });
    return `<span class="rw-av">${a}</span>`;
  }
  const b = String(it.id || '');
  return `<span class="rw-boost">${ico(/scout/.test(b) ? 'target' : /moral/.test(b) ? 'heart' : 'battery', 'gold')}</span>`;
}

/** Rewards body for the shop. state: { slot }. Returns HTML. */
export function rewardsHTML(state) {
  const gd = gender();
  const items = catalog(gd);
  const cs = cosmeticsState();
  const stars = starsState();
  let meta = {};
  try { meta = game.getSaveMeta() || {}; } catch { meta = {}; }
  const slots = SLOTS.filter((s) => items.some((x) => x.slot === s.id));
  if (!state.slot || !slots.some((s) => s.id === state.slot)) state.slot = slots.length ? slots[0].id : 'boots';
  const owned = new Set(cs.owned);
  // the engine VM (getCosmetics().items) knows ownership, equipped, limits and why an item cannot be bought now
  const eng = cs.raw && Array.isArray(cs.raw.items) ? new Map(cs.raw.items.map((x) => [x.id, x])) : null;
  const isOwned = (it) => { const e = eng && eng.get(it.id); if (e) return !!(e.owned || (e.isDefault && it.slot !== 'boost')); return it.isDefault || it.price === 0 || owned.has(it.id); };
  const equippedId = (slot) => cs.equipped[slot] || (items.find((x) => x.slot === slot && x.isDefault) || {}).id || null;
  const whyNot = (it) => { const e = eng && eng.get(it.id); return e && !e.canBuy && e.reasonHe ? gtext(e.reasonHe) : ''; };
  const list = items.filter((x) => x.slot === state.slot).sort((a, b) => a.price - b.price);
  const rar = { ...RARITY_FB, ...(cosUi('rarity', null) || {}) };
  const card = (it) => {
    const own = isOwned(it);
    const eq = it.slot !== 'boost' && equippedId(it.slot) === it.id;
    const short = Math.max(0, it.price - stars.balance);
    const why = whyNot(it);
    let btn;
    if (it.slot === 'boost') btn = `<button type="button" class="btn btn-sm ${short || why ? 'btn-ghost' : 'btn-gold'}" data-act="rw-buy" data-id="${esc(it.id)}" data-testid="rw-buy-${esc(it.id)}" ${short || why ? 'disabled' : ''}>${why ? esc(why) : short ? esc(fillV(cosUi('notEnough', 'חסרים עוד {n} ⭐'), { n: short })) : esc(cosUi('use', 'להשתמש'))}</button>`;
    else if (eq) btn = `<button type="button" class="btn btn-sm btn-ghost rw-on" disabled>${ico('check')}${esc(cosUi('equipped', 'בשימוש'))}</button>`;
    else if (own) btn = `<button type="button" class="btn btn-sm btn-primary" data-act="rw-equip" data-id="${esc(it.id)}" data-testid="rw-equip-${esc(it.id)}">${esc(cosUi('equip', 'לבחור'))}</button>`;
    else btn = `<button type="button" class="btn btn-sm ${short ? 'btn-ghost' : 'btn-gold'}" data-act="rw-buy" data-id="${esc(it.id)}" data-testid="rw-buy-${esc(it.id)}" ${short ? 'disabled' : ''}>${short ? esc(fillV(cosUi('notEnough', 'חסרים עוד {n} ⭐'), { n: short })) : esc(cosUi('buy', 'לקנות'))}</button>`;
    return `<article class="rw-item r-${esc(it.rarity)}${own ? ' own' : ''}${eq ? ' eq' : ''}" data-testid="rw-${esc(it.id)}">
      <div class="rw-art" ${it.slot === 'celebration' && it.vis.style ? `data-act="rw-preview" data-id="${esc(it.id)}" role="button" aria-label="${esc(cosUi('preview', 'תצוגה מקדימה'))}"` : ''}>
        <span class="rw-rar">${esc(rar[it.rarity] || '')}</span>${art(it, meta)}${it.slot === 'celebration' && it.vis.style ? `<span class="rw-play">${ico('play')}</span>` : ''}</div>
      <div class="rw-body"><b>${esc(gtext(it.he))}</b>${it.descHe ? `<small>${esc(gtext(it.descHe))}</small>` : ''}
        <span class="rw-price num">${own && it.slot !== 'boost' ? esc(cosUi('owned', 'שלך')) : it.price ? esc(it.price) + ' ⭐' : 'חינם'}</span>${btn}</div></article>`;
  };
  return `<div class="rewards" data-testid="rewards">
    <section class="rw-wallet"><span class="rw-star" aria-hidden="true">⭐</span><div><small>${esc(cosUi('section', 'פרסים'))}</small><b class="num" data-testid="rw-balance">${esc(stars.balance)} ⭐</b>
      <span class="muted small">${esc(gtext(ST.howTo || 'כוכבים מקבלים על משימות, הישגים, מטרות אישיות במשחק והפרס היומי'))}</span></div></section>
    <div class="rw-slots">${slots.map((s) => `<button type="button" class="chip chip-btn${s.id === state.slot ? ' on' : ''}" data-act="rw-slot" data-v="${s.id}" data-testid="rw-slot-${s.id}">${ico(s.ico)}${esc(gtext(slotHe(s.id)))}</button>`).join('')}</div>
    <div class="rw-grid">${list.map(card).join('') || `<p class="muted">${esc(cosUi('empty', 'אין פריטים בקטגוריה הזאת'))}</p>`}</div>
  </div>`;
}

/** Click handling for the rewards section. Returns true if handled; redraw() is called after a change. */
export function rewardsClick(b, state, redraw) {
  const act = b.dataset.act;
  if (!act || !act.startsWith('rw-')) return false;
  const items = catalog(gender());
  const it = items.find((x) => x.id === b.dataset.id);
  if (act === 'rw-slot') { state.slot = b.dataset.v; redraw(); return true; }
  if (act === 'rw-preview' && it) { previewCelebration(it); return true; }
  if (act === 'rw-equip' && it) {
    if (typeof game.equipCosmetic !== 'function') { toast('בקרוב'); return true; }
    const r = call(() => game.equipCosmetic(it.slot, it.id));
    if (r && r.ok === false) toast(gtext(r.messageHe || 'לא הצלחנו'));
    else { toast(fillV(cosUi('equippedToast', '{he} בשימוש'), { he: gtext(it.he) }), { tone: 'good' }); buzz(20); }
    redraw();
    return true;
  }
  if (act === 'rw-buy' && it) { buy(it, redraw); return true; }
  return false;
}

function buy(it, redraw) {
  if (typeof game.spendStars !== 'function') { toast('בקרוב'); return; }
  const stars = starsState();
  const close = openModal(`<div class="buy-sheet rw-sheet r-${esc(it.rarity)}">
      <div class="buy-art">${art(it, (() => { try { return game.getSaveMeta(); } catch { return {}; } })())}</div>
      <h2 class="modal-title">${esc(gtext(it.he))}</h2>${it.descHe ? `<p class="muted small">${esc(gtext(it.descHe))}</p>` : ''}
      <div class="buy-price num">${esc(it.price)} ⭐</div>
      <div class="buy-rows"><div class="kv"><span>יתרה אחרי</span><b class="num">${esc(stars.balance - it.price)} ⭐</b></div></div>
      <div class="btn-row"><button type="button" class="btn btn-gold" data-a="yes" data-testid="btn-confirm-yes">${esc(it.slot === 'boost' ? cosUi('use', 'להשתמש') : cosUi('buy', 'לקנות'))}</button>
        <button type="button" class="btn btn-ghost" data-a="no" data-testid="btn-confirm-no">ביטול</button></div></div>`, { sheet: true, testid: 'rw-sheet' });
  close.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    close();
    if (b.dataset.a !== 'yes') return;
    const r = call(() => game.spendStars(it.id));
    if (!r || r.ok === false) { toast(gtext((r && r.messageHe) || 'לא הצלחנו')); redraw(); return; }
    buzz([20, 40, 20]);
    if (it.slot !== 'boost' && typeof game.equipCosmetic === 'function') call(() => game.equipCosmetic(it.slot, it.id), { quiet: true });
    toast(gtext(r.messageHe || fillV(cosUi('bought', '{he}: שלך!'), { he: gtext(it.he) })), { tone: 'good', ms: 3200 });
    redraw();
    if (it.slot === 'celebration') { ctx.holdBadges = true; setTimeout(() => previewCelebration(it), 350); }
  });
}

function previewCelebration(it) {
  if (reducedMotion()) { ctx.holdBadges = false; toast(gtext(it.he)); return; }
  let name = '';
  try { name = game.getSaveMeta().name || ''; } catch { name = ''; }
  const v = (() => { try { return cosmeticsState(); } catch { return null; } })();
  let boots = null;
  try { const eq = v && v.equipped && v.equipped.boots; if (eq) boots = (catalog(gender()).find((x) => x.id === eq) || {}).vis?.boots || null; } catch { boots = null; }
  ctx.holdBadges = true;
  let p = null;
  try { p = celebrate({ kind: 'goal', textHe: 'גוללללל!', subHe: name || gtext(it.he), colors: kit(), style: it.vis.style, boots }); } catch { p = null; }
  Promise.resolve(p).finally(() => { ctx.holdBadges = false; });
}

// shop.js: #/shop (bottom tab "חנות"). Premium store: wallet, categories (רכבים, נדל"ן, שעונים ותכשיטים, ציוד ונעליים,
// השקעות + family gifts), illustrated item cards with ₪ price and morale / fame effects, owned badges, "האוסף שלי".
// Data: game.getShop() (engine categories are mapped to display categories by shop-art.storeCat).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, openModal, buzz } from './app.js';
import { empty } from './components.js';
import { money, sgn, ltr } from './format.js';
import { gtext } from './gender.js';
import { STORE_CATS, storeCat, catIcon, catGlow, itemArt } from './shop-art.js';
import { SHOP_ITEMS } from '../data/strings.js';
import { ico } from './icons.js';
import { rewardsHTML, rewardsClick } from './rewards.js';
import { starsState } from './cosmetics.js';

const SELL_RATE = 0.6;
const DATA = (() => { const m = {}; try { for (const it of SHOP_ITEMS || []) m[it.id] = it; } catch { /* ignore */ } return m; })();
const SVG_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>';
const SVG_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>';
const SVG_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
const TIER_HE = ['', '', '', 'פרימיום', 'יוקרה', 'אגדי'];

/** Flatten the engine VM into display items with category, art key, description, effects and tier. */
export function storeModel(vm) {
  const items = [];
  for (const c of (vm && vm.cats) || []) {
    for (const it of c.items || []) {
      const d = DATA[it.id] || {};
      const key = storeCat(it, c.id);
      items.push({
        ...it, engineCat: c.id, cat: key,
        desc: gtext(it.descHe || it.desc || d.desc || ''),
        fame: Number(it.fame ?? it.fans ?? d.fans ?? 0) || 0,
        sellable: it.sellable !== undefined ? !!it.sellable : c.id !== 'family',
      });
    }
  }
  // tier = price rank inside the display category (1..5)
  for (const cat of STORE_CATS) {
    const list = items.filter((x) => x.cat === cat.key).sort((a, b) => a.price - b.price);
    list.forEach((x, i) => { x.tier = list.length <= 1 ? 3 : 1 + Math.round((i / (list.length - 1)) * 4); });
  }
  return items;
}

/** "האוסף שלי" grid (shared with the profile). items: storeModel items (owned ones are shown). */
export function collectionHTML(items, { limit = 0, emptyText = '' } = {}) {
  const owned = items.filter((x) => x.owned);
  if (!owned.length) {
    return `<div class="coll-empty"><span class="big-ico" aria-hidden="true">${ico('bag', 'gold')}</span><p class="muted small">${esc(emptyText || gtext('עוד לא קנית כלום. החנות מחכה.'))}</p></div>`;
  }
  const shown = limit ? owned.slice(0, limit) : owned;
  return `<div class="coll" data-testid="collection">${shown.map((x) => `<div class="coll-item" style="--glow:${catGlow(x.cat)}" data-testid="coll-${esc(x.id)}">${itemArt(x.id, x.cat)}<b>${esc(gtext(x.he))}</b></div>`).join('')}</div>`;
}

/** v2.3 review: the stars buy something right now -> say so at the top of the shop (one tap to the rewards). */
function starsHint() {
  let c = null;
  try { c = game.getCosmetics(); } catch { c = null; }
  if (!c || !Array.isArray(c.items)) return '';
  const it = c.items.filter((x) => x && x.slot !== 'boost' && !x.owned && x.canBuy && x.price > 0).sort((a, b) => b.price - a.price)[0];
  if (!it) return '';
  return `<button type="button" class="stars-hint" data-act="cat" data-cat="rewards" data-testid="shop-stars-hint">${ico('star', 'gold')}<span class="grow"><b>${esc('יש לך ' + c.balance + '⭐')}</b><small>${esc(gtext('מספיק ל' + it.he + ' ועוד. לפרסים'))}</small></span><span class="chev" aria-hidden="true">‹</span></button>`;
}
export function render(root, params = {}) {
  let cat = STORE_CATS.some((c) => c.key === params.cat) || params.cat === 'mine' || params.cat === 'rewards' ? params.cat : null;
  const rw = { slot: params.slot || null };

  function draw() {
    const vm = call(() => game.getShop(), { quiet: true });
    if (!vm) { root.innerHTML = empty('החנות סגורה כרגע', '🛍️'); return; }
    const items = storeModel(vm);
    const cats = STORE_CATS.filter((c) => items.some((x) => x.cat === c.key));
    if (!cat || (cat !== 'mine' && cat !== 'rewards' && !cats.some((c) => c.key === cat))) cat = cats.length ? cats[0].key : 'mine';
    const owned = items.filter((x) => x.owned);
    const list = cat === 'mine' ? owned : items.filter((x) => x.cat === cat).sort((a, b) => a.price - b.price);
    const curCat = STORE_CATS.find((c) => c.key === cat);
    const ownedValue = owned.reduce((s, x) => s + (x.price || 0), 0);

    root.innerHTML = `<div class="store${cat === 'rewards' ? ' is-rw' : ''}">
      <section class="store-wallet" data-testid="shop-wallet">
        <div class="sw-top"><div><span class="sw-label">היתרה שלך</span><b class="sw-bal num" data-testid="shop-balance">${esc(money(vm.money))}</b></div><i class="sw-chip" aria-hidden="true"></i></div>
        <div class="sw-stats">
          ${(vm.weeklyUpkeep || 0) < 0
    ? `<div class="sw-stat"><small>תשואה לשבוע</small><b class="num up">${esc(ltr('+' + money(-vm.weeklyUpkeep)))}</b></div>`
    : `<div class="sw-stat"><small>הוצאות לשבוע</small><b class="num">${esc(money(vm.weeklyUpkeep || 0))}</b></div>`}
          <div class="sw-stat"><small>בונוס מורל</small><b class="num${vm.moraleBonus ? ' up' : ''}">${esc(sgn(vm.moraleBonus || 0))}</b></div>
          <div class="sw-stat"><small>באוסף</small><b class="num">${owned.length}/${items.length}</b></div>
        </div>
      </section>

      <nav class="store-cats" aria-label="קטגוריות">
        <button type="button" class="scat scat-rw${cat === 'rewards' ? ' on' : ''}" data-act="cat" data-cat="rewards" data-testid="shop-cat-rewards" aria-pressed="${cat === 'rewards'}">${ico('star')}<span>פרסים</span><b class="scat-n num">${esc(starsState().balance)}⭐</b></button>
        ${cats.map((c) => `<button type="button" class="scat${cat === c.key ? ' on' : ''}" data-act="cat" data-cat="${c.key}" data-testid="shop-cat-${c.key}" aria-pressed="${cat === c.key}">${catIcon(c.key)}<span>${esc(c.he)}</span></button>`).join('')}
        <button type="button" class="scat${cat === 'mine' ? ' on' : ''}" data-act="cat" data-cat="mine" data-testid="shop-cat-mine" aria-pressed="${cat === 'mine'}">${catIcon('owned')}<span>האוסף שלי</span><b class="scat-n num">${owned.length}</b></button>
      </nav>

      ${cat !== 'rewards' ? starsHint() : ''}
      ${cat === 'rewards' ? rewardsHTML(rw) : `<div class="store-head"><h2>${esc(cat === 'mine' ? 'האוסף שלי' : curCat ? curCat.he : '')}</h2>
        <small>${cat === 'mine' ? (owned.length ? 'שווי ' + esc(money(ownedValue)) : '') : list.length + ' פריטים'}</small></div>

      ${cat === 'mine' && !owned.length ? `<section class="card">${collectionHTML(items)}</section>` : `<div class="store-grid">${list.map((it) => itemCard(it, vm)).join('')}</div>`}`}

      <p class="store-note">${esc(gtext('המחירים בשקלים. פריטים נמכרים ב-60% מהמחיר, ומתנות למשפחה לא נמכרות.'))}</p>
    </div>`;
  }

  function itemCard(it, vm) {
    const locked = !it.owned && !it.canBuy;
    // the disabled button says why (missing money / minimum age) instead of a vague "unavailable"
    const why = it.owned ? '' : (it.price > vm.money ? 'חסרים ' + money(it.price - vm.money) : (it.reasonHe ? gtext(it.reasonHe) : 'לא זמין'));
    const tier = TIER_HE[it.tier] ? `<span class="sitem-tier t-${it.tier}">${TIER_HE[it.tier]}</span>` : '';
    let action;
    if (it.owned) action = it.sellable ? `<button type="button" class="btn btn-sm btn-ghost" data-act="sell" data-id="${esc(it.id)}" data-testid="btn-sell-${esc(it.id)}">מכירה · ${esc(money(Math.round(it.price * SELL_RATE)))}</button>` : '<button type="button" class="btn btn-sm btn-ghost" disabled>מתנה מכל הלב</button>';
    else action = `<button type="button" class="btn btn-sm ${locked ? 'btn-ghost' : 'btn-gold'}" data-act="buy" data-id="${esc(it.id)}" data-testid="btn-buy-${esc(it.id)}" ${locked ? 'disabled' : ''}>${locked ? esc(why) : 'לקנייה'}</button>`;
    return `<article class="sitem${it.owned ? ' is-owned' : ''}${locked ? ' is-locked' : ''}" data-testid="shop-${esc(it.id)}" style="--glow:${catGlow(it.cat)}">
      <div class="sitem-art" data-act="info" data-id="${esc(it.id)}">${tier}${it.owned ? `<span class="sitem-owned">${SVG_CHECK}שלך</span>` : ''}${itemArt(it.id, it.cat)}</div>
      <div class="sitem-body">
        <b class="sitem-name">${esc(gtext(it.he))}</b>
        ${it.desc ? `<span class="sitem-desc">${esc(it.desc)}</span>` : ''}
        <div class="sitem-fx">${fx(it)}</div>
        <b class="sitem-price num">${esc(money(it.price))}</b>
        ${action}
      </div></article>`;
  }

  function fx(it) {
    return `${it.morale ? `<span class="sfx sfx-morale">${SVG_HEART}${esc(sgn(it.morale))} מורל</span>` : ''}${it.fame ? `<span class="sfx sfx-fame">${SVG_STAR}${esc(sgn(it.fame))} תהילה</span>` : ''}${it.upkeep > 0 ? `<span class="sfx sfx-upkeep">${esc(money(it.upkeep))} לשבוע</span>` : ''}${it.upkeep < 0 ? `<span class="sfx sfx-return">${esc(ltr('+' + money(-it.upkeep)))} לשבוע</span>` : ''}`;
  }

  function sheet(it, vm, mode) {
    return new Promise((resolve) => {
      let ok = false;
      const sellPrice = Math.round(it.price * SELL_RATE);
      const after = mode === 'buy' ? vm.money - it.price : vm.money + sellPrice;
      const close = openModal(`<div class="buy-sheet" style="--glow:${catGlow(it.cat)}">
          <div class="buy-art">${itemArt(it.id, it.cat)}</div>
          <h2 class="modal-title">${esc(gtext(it.he))}</h2>
          ${it.desc ? `<p class="muted small">${esc(it.desc)}</p>` : ''}
          <div class="buy-price num">${esc(money(mode === 'buy' ? it.price : sellPrice))}</div>
          <div class="buy-rows">
            ${mode === 'buy' ? `${it.morale ? `<div class="kv"><span>מורל</span><b class="num" style="color:#7DF0E2">${esc(sgn(it.morale))}</b></div>` : ''}
            ${it.fame ? `<div class="kv"><span>תהילה ואהבת הקהל</span><b class="num" style="color:var(--gold-hi)">${esc(sgn(it.fame))}</b></div>` : ''}
            ${it.upkeep > 0 ? `<div class="kv"><span>הוצאה קבועה</span><b class="num">${esc(money(it.upkeep))} לשבוע</b></div>` : ''}
            ${it.upkeep < 0 ? `<div class="kv"><span>תשואה שבועית</span><b class="num" style="color:#2BD07A">${esc(ltr('+' + money(-it.upkeep)))} לשבוע</b></div>` : ''}` : `<div class="kv"><span>מחיר קנייה</span><b class="num">${esc(money(it.price))}</b></div>`}
            <div class="kv"><span>יתרה אחרי</span><b class="num">${esc(money(after))}</b></div>
          </div>
          <div class="btn-row">
            <button type="button" class="btn ${mode === 'buy' ? 'btn-gold' : 'btn-danger'}" data-a="yes" data-testid="btn-confirm-yes">${mode === 'buy' ? 'קונים!' : 'מכירה'}</button>
            <button type="button" class="btn btn-ghost" data-a="no" data-testid="btn-confirm-no">ביטול</button>
          </div></div>`, { sheet: true, testid: 'shop-sheet', onClose: () => resolve(ok) });
      close.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        ok = b.dataset.a === 'yes';
        close();
      });
    });
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !root.contains(b)) return;
    const act = b.dataset.act;
    if (rewardsClick(b, rw, draw)) return;
    if (act === 'cat') {
      cat = b.dataset.cat;
      draw();
      const on = root.querySelector('.scat.on');
      if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch { /* ignore */ } }
      return;
    }
    const vm = call(() => game.getShop(), { quiet: true });
    if (!vm) return;
    const it = storeModel(vm).find((x) => x.id === b.dataset.id);
    if (!it) return;
    if (act === 'info') {
      if (it.owned) { if (it.sellable) act2('sell'); return; }
      if (it.canBuy) act2('buy');
      return;
    }
    act2(act);

    async function act2(mode) {
      if (mode === 'buy') {
        if (!(await sheet(it, vm, 'buy'))) return;
        const r = call(() => game.buyItem(it.id));
        if (r) { toast(r.ok ? gtext('{{תתחדש|תתחדשי}}! ') + gtext(it.he) + ' באוסף שלך' : gtext(r.messageHe || 'אין מספיק כסף')); if (r.ok) buzz([20, 40, 20]); }
      } else if (mode === 'sell') {
        if (!(await sheet(it, vm, 'sell'))) return;
        const r = call(() => game.sellItem(it.id));
        if (r) toast(r.ok ? 'נמכר ב-' + money(Math.round(it.price * SELL_RATE)) : gtext(r.messageHe || 'אי אפשר למכור'));
      }
      draw();
    }
  });
  draw();
}

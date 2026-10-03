// shop.js: #/shop. Lifestyle items (cars, homes, family, style) for morale.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, confirmDialog } from './app.js';
import { card, empty } from './components.js';
import { money } from './format.js';

const CAT_ICO = { car: '🚗', home: '🏠', family: '👨‍👩‍👦', style: '👔' };

export function render(root) {
  function draw() {
    const s = call(() => game.getShop(), { quiet: true });
    if (!s) { root.innerHTML = empty('החנות סגורה כרגע', '🛍️'); return; }
    root.innerHTML = `<div class="shop">
      <section class="card shop-head"><div class="kv"><span>💰 בבנק</span><b class="num">${esc(money(s.money))}</b></div>
        <div class="kv"><span>הוצאות קבועות</span><b class="num">${esc(money(s.weeklyUpkeep))} לשבוע</b></div>
        <div class="kv"><span>בונוס מורל</span><b class="num">+${esc(s.moraleBonus)}</b></div></section>
      ${(s.cats || []).map((c) => card(`<div class="shop-items">${(c.items || []).map((it) => `<div class="shop-item${it.owned ? ' owned' : ''}" data-testid="shop-${esc(it.id)}">
          <div class="grow"><b>${esc(it.he)}</b><small class="muted">${esc(money(it.price))}${it.upkeep ? ' · ' + esc(money(it.upkeep)) + ' לשבוע' : ''} · +${esc(it.morale)} מורל</small>
          ${it.reasonHe && !it.owned ? `<small class="warn-text">${esc(it.reasonHe)}</small>` : ''}</div>
          ${it.owned ? (c.id === 'family' ? '<span class="chip good">✓ שלך</span>' : `<button type="button" class="btn btn-sm btn-ghost" data-act="sell" data-id="${esc(it.id)}" data-name="${esc(it.he)}" data-price="${esc(it.price)}">מכור</button>`)
            : `<button type="button" class="btn btn-sm btn-primary" data-act="buy" data-id="${esc(it.id)}" data-name="${esc(it.he)}" data-price="${esc(it.price)}" ${it.canBuy ? '' : 'disabled'}>קנה</button>`}
        </div>`).join('')}</div>`, { title: (CAT_ICO[c.id] || '') + ' ' + c.he })).join('')}
      <p class="muted small center">פריטים נמכרים ב-60% מהמחיר. מתנות למשפחה לא נמכרות.</p>
    </div>`;
  }
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const id = b.dataset.id, name = b.dataset.name, price = Number(b.dataset.price) || 0;
    if (b.dataset.act === 'buy') {
      const ok = await confirmDialog({ title: 'לקנות?', text: `${name} ב-${money(price)}`, yes: 'קונים!' });
      if (!ok) return;
      const r = call(() => game.buyItem(id));
      if (r) toast(r.messageHe || (r.ok ? 'תתחדש!' : 'אין מספיק כסף'));
    } else if (b.dataset.act === 'sell') {
      const ok = await confirmDialog({ title: 'למכור?', text: `${name} ב-${money(Math.round(price * 0.6))}`, yes: 'מוכרים' });
      if (!ok) return;
      const r = call(() => game.sellItem(id));
      if (r) toast(r.messageHe || (r.ok ? 'נמכר' : 'אי אפשר למכור'));
    }
    draw();
  });
  draw();
}

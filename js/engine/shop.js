// Lifestyle shop (SPEC §5.15).
import { SHOP_ITEMS } from '../data/strings.js';
import { fmtMoney, econMoney } from './util.js';
import { ageOf } from './player.js';
import { raise } from './narrative.js';

const NUM = {
  car_old: [3000, 20, 1, 18], car_city: [15000, 60, 2, 18], car_family: [35000, 120, 3, 18], car_lux: [120000, 450, 5, 18], car_super: [450000, 1800, 8, 18],
  home_room: [8000, 0, 2, 0], home_apt: [250000, 400, 4, 18], home_pent: [1800000, 2500, 7, 18], home_villa: [6000000, 6000, 10, 18],
  fam_trip: [12000, 0, 2, 0], fam_parents: [90000, 0, 5, 0], fam_field: [400000, 0, 6, 0], style_wardrobe: [20000, 0, 1, 0], style_watch: [40000, 0, 2, 0],
};
const CAT_HE = { car: 'רכבים', home: 'בית', family: 'משפחה', style: 'סטייל' };
const CATS = ['car', 'home', 'family', 'style'];

export function shopItems() {
  const list = (SHOP_ITEMS && SHOP_ITEMS.length) ? SHOP_ITEMS : [];
  const out = list.map((it) => {
    const n = NUM[it.id];
    return { id: it.id, cat: it.cat, he: it.he, price: n ? n[0] : it.price, upkeep: n ? n[1] : (it.upkeep || 0), morale: n ? n[2] : (it.morale || 0), minAge: n ? n[3] : (it.minAge || 0) };
  });
  for (const id of Object.keys(NUM)) {
    if (!out.some((x) => x.id === id)) {
      const n = NUM[id];
      out.push({ id, cat: id.indexOf('car_') === 0 ? 'car' : id.indexOf('home_') === 0 ? 'home' : id.indexOf('fam_') === 0 ? 'family' : 'style', he: id, price: n[0], upkeep: n[1], morale: n[2], minAge: n[3] });
    }
  }
  return out;
}
// Prices and upkeep scale with the career economy (C3); S optional (unscaled without it).
function scaled(S, it) { if (!S || !it) return it; return Object.assign({}, it, { price: econMoney(S, it.price), upkeep: econMoney(S, it.upkeep) }); }
export function itemById(id, S) { return scaled(S, shopItems().find((x) => x.id === id) || null); }
export function weeklyUpkeep(S) { let u = 0; for (const id of S.player.owned) { const it = itemById(id, S); if (it) u += it.upkeep; } return u; }
export function moraleBonus(S) { let m = 0; for (const id of S.player.owned) { const it = itemById(id, S); if (it) m += it.morale; } return Math.min(25, m); }

function reason(S, it) {
  const p = S.player;
  if (p.owned.indexOf(it.id) >= 0) return 'כבר שלך';
  if (p.stage === 'retired') return 'הקריירה הסתיימה';
  if (it.minAge && ageOf(S) < it.minAge) return 'מגיל ' + it.minAge;
  if (p.money < it.price) return 'חסר לך ' + fmtMoney(it.price - p.money);
  return null;
}

export function buy(S, id) {
  const it = itemById(id, S);
  if (!it) return { ok: false, messageHe: 'פריט לא קיים' };
  const r = reason(S, it);
  if (r) return { ok: false, messageHe: r };
  const p = S.player;
  p.money -= it.price;
  p.owned.push(it.id);
  p.morale = Math.min(100, p.morale + it.morale);
  if (it.id === 'fam_field') p.fans = Math.min(100, p.fans + 5);
  if (it.price >= econMoney(S, 100000)) raise(S, 'big_purchase');
  return { ok: true, messageHe: 'קנית: ' + it.he + '!' };
}
export function sell(S, id) {
  const it = itemById(id, S);
  const p = S.player;
  if (!it || p.owned.indexOf(id) < 0) return { ok: false, messageHe: 'הפריט לא שלך' };
  if (it.cat === 'family') return { ok: false, messageHe: 'את זה לא מוכרים' };
  if (p.stage === 'retired') return { ok: false, messageHe: 'הקריירה הסתיימה' };
  p.owned = p.owned.filter((x) => x !== id);
  p.money += Math.round(it.price * 0.6);
  return { ok: true, messageHe: 'מכרת את ' + it.he + ' ב-' + fmtMoney(Math.round(it.price * 0.6)) };
}

export function shopVM(S) {
  const items = shopItems().map((x) => scaled(S, x));
  return {
    money: S.player.money, weeklyUpkeep: weeklyUpkeep(S), moraleBonus: moraleBonus(S),
    cats: CATS.map((c) => ({ id: c, he: CAT_HE[c], items: items.filter((x) => x.cat === c).map((x) => {
      const owned = S.player.owned.indexOf(x.id) >= 0;
      const r = reason(S, x);
      return { id: x.id, he: x.he, price: x.price, upkeep: x.upkeep, morale: x.morale, owned, canBuy: !r, reasonHe: r };
    }) })),
  };
}

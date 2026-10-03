// format.js: display formatting. Wraps fmtSeason from the facade; money is shown in Israeli shekels (R3).
import { fmtSeason } from '../engine/game.js';
import * as engineUtil from '../engine/util.js';

const isNum = (n) => typeof n === 'number' && isFinite(n);

/** Engine amounts are stored in euros; every amount on screen is shown in shekels at one fixed rate.
 *  If the engine exports its own rate (EUR_ILS / EUR_TO_ILS) the UI uses that same number. */
export const EUR_ILS = (() => {
  const r = Number(engineUtil.EUR_ILS || engineUtil.EUR_TO_ILS || engineUtil.ILS_RATE);
  return r > 0 ? r : 3.9;
})();

function thousands(n) { return Math.round(n).toLocaleString('en-US'); }
function oneDec(x) { const s = (Math.round(x * 10) / 10).toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; }

/** Shekel amount (already converted) -> '₪850', '₪25,000', '₪850 אלף', '₪4.2 מיליון', '₪1.3 מיליארד'. */
export function shekels(ils) {
  if (!isNum(ils)) return '-';
  const neg = ils < 0;
  // converted amounts are display-rounded so 6,410 euro reads ₪25,000 and not ₪24,999
  const raw = Math.abs(ils);
  const a = raw < 1000 ? Math.round(raw) : raw < 10000 ? Math.round(raw / 10) * 10 : Math.round(raw / 100) * 100;
  let s;
  if (a < 100000) s = '₪' + thousands(a);
  else if (a < 999500) s = '₪' + Math.round(a / 1000) + ' אלף';
  else if (a < 1e9) { const m = a / 1e6; s = '₪' + (m < 100 ? oneDec(m) : String(Math.round(m))) + ' מיליון'; }
  else s = '₪' + oneDec(a / 1e9) + ' מיליארד';
  return neg ? '-' + s : s;
}

/** Engine money (euros) -> shekel label, e.g. 6410 -> '₪25,000', 1.08M -> '₪4.2 מיליון'. */
export function money(n) {
  if (!isNum(n)) return '-';
  return shekels(n * EUR_ILS);
}

/** Weekly amount: '₪25,000 לשבוע'. */
export function moneyWeek(n) {
  return isNum(n) ? money(n) + ' לשבוע' : '-';
}

/** '2026/27' */
export function season(s) {
  if (!isNum(s)) return '';
  try { return fmtSeason(s); } catch { return s + '/' + String((s + 1) % 100).padStart(2, '0'); }
}

/** 0.42 -> '42%'; 42 (already percent, when asPercent=false) -> '42%' */
export function pct(n, digits = 0, isFraction = true) {
  if (!isNum(n)) return '-';
  const v = isFraction ? n * 100 : n;
  return v.toFixed(digits) + '%';
}

/** Match rating with one decimal, '-' when missing. */
export function rating(r) {
  if (!isNum(r) || r <= 0) return '-';
  return r.toFixed(1);
}

/** Integer with thousands separator. */
export function num(n) {
  if (!isNum(n)) return '-';
  return Math.round(n).toLocaleString('en-US');
}

/** '+3' / '-2' / '0' (LTR-isolated so the sign stays in front of the digits in RTL text) */
export function signed(n, digits = 0) {
  if (!isNum(n)) return '';
  const v = digits ? n.toFixed(digits) : String(Math.round(n));
  return ltr(n > 0 ? '+' + v : v);
}

/** LTR-isolated text (U+2066 LRI ... U+2069 PDI): keeps '+3' / '-₪1,200' reading left-to-right inside Hebrew text,
 *  so the sign stays in front of the digits ('+1 מורל', not '1+ מורל'). Safe inside esc(). */
export function ltr(s) { return '\u2066' + String(s) + '\u2069'; }
/** Signed number isolated for RTL text: '+3', '-2', '+1.6'. zero -> '0' (or '+0' with plusZero). */
export function sgn(n, digits = 0, plusZero = false) {
  if (!isNum(n)) return '';
  const v = digits ? (Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits)).toString() : String(Math.round(n));
  return ltr((n > 0 || (plusZero && n === 0) ? '+' : '') + v);
}

/** Date from ms epoch, e.g. '3.10.2026 14:05' */
export function dateLabel(ms, withTime = true) {
  if (!isNum(ms)) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  const s = d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
  return withTime ? s + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : s;
}

/** Relative time in Hebrew: 'עכשיו', 'לפני 5 דקות', 'אתמול'... */
export function ago(ms) {
  if (!isNum(ms)) return '';
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'עכשיו';
  if (min === 1) return 'לפני דקה';
  if (min < 60) return 'לפני ' + min + ' דקות';
  const hr = Math.floor(min / 60);
  if (hr === 1) return 'לפני שעה';
  if (hr === 2) return 'לפני שעתיים';
  if (hr < 24) return 'לפני ' + hr + ' שעות';
  const day = Math.floor(hr / 24);
  if (day === 1) return 'אתמול';
  if (day === 2) return 'לפני יומיים';
  if (day < 30) return 'לפני ' + day + ' ימים';
  return dateLabel(ms, false);
}

/** Bytes -> '1.2MB' */
export function bytes(n) {
  if (!isNum(n)) return '-';
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + 'KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB';
  return (n / 1024 / 1024 / 1024).toFixed(1) + 'GB';
}

/** mm:ss */
export function mmss(sec) {
  if (!isNum(sec)) return '-';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

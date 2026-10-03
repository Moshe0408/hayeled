// format.js: display formatting. Wraps fmtMoney / fmtSeason from the facade.
import { fmtMoney, fmtSeason } from '../engine/game.js';

const isNum = (n) => typeof n === 'number' && isFinite(n);

/** '€1.2M' etc. */
export function money(n) {
  if (!isNum(n)) return '-';
  try { return fmtMoney(Math.round(n)); } catch { return '€' + Math.round(n).toLocaleString('en-US'); }
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

/** '+3' / '-2' / '0' */
export function signed(n, digits = 0) {
  if (!isNum(n)) return '';
  const v = digits ? n.toFixed(digits) : String(Math.round(n));
  return n > 0 ? '+' + v : v;
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

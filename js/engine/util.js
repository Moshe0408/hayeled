// Small pure helpers shared by the engine.
import { C } from './state.js';

// ---------- gender (C1/C2) ----------
/** Gender of the current career ('m' when there is none). */
export function curGender() { const S = C.S; return S && S.player && S.player.gender === 'f' ? 'f' : 'm'; }
export function isF(S) { return !!(S && S.player && S.player.gender === 'f'); }
const GMARK = /\{\{([^{}|]*)\|([^{}]*)\}\}/g;
/** Resolve gender markers {{male|female}}. gender defaults to the current career's gender. */
export function gtext(str, gender) {
  if (typeof str !== 'string' || str.indexOf('{{') < 0) return str;
  const f = (gender === undefined || gender === null ? curGender() : gender) === 'f';
  return str.replace(GMARK, (m, a, b) => (f ? b : a));
}
/** Pick by gender: g(male, female). */
export function gpick(male, female, gender) { return ((gender === undefined || gender === null ? curGender() : gender) === 'f') ? female : male; }
/** Deep-resolve gender markers in a fresh VM (in place). Never call on live state objects other than strings. */
export function gdeep(v, gender) {
  if (typeof v === 'string') return v.indexOf('{{') >= 0 ? gtext(v, gender) : v;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const x = v[i]; if (x !== null && typeof x !== 'number' && typeof x !== 'boolean') v[i] = gdeep(x, gender); } return v; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) { const x = v[k]; if (x !== null && typeof x !== 'number' && typeof x !== 'boolean') v[k] = gdeep(x, gender); } return v; }
  return v;
}
// Female forms of shared labels from strings.js, used only when the label carries no {{m|f}} marker.
const FEM = {
  'שחקן ליגה': 'שחקנית ליגה', 'שחקן מוערך': 'שחקנית מוערכת', 'כוכב': 'כוכבת',
  'כוכב הקבוצה': 'כוכבת הקבוצה', 'שחקן מפתח': 'שחקנית מפתח', 'שחקן סגל': 'שחקנית סגל',
  'מקצוען': 'מקצוענית', 'שחקן חופשי': 'שחקנית חופשית', 'פרש': 'פרשה', 'נוער': 'נערות',
  'פצוע': 'פצועה', 'מורחק': 'מורחקת', 'קבוצת הנוער': 'קבוצת הנערות',
  'שוער': 'שוערת', 'בלם': 'בלמית', 'מגן שמאלי': 'מגנה שמאלית', 'מגן ימני': 'מגנה ימנית', 'מגן': 'מגנה', 'קשר אחורי': 'קשרית אחורית',
  'קשר מרכזי': 'קשרית מרכזית', 'קשר התקפי': 'קשרית התקפית', 'קשר': 'קשרית', 'חלוץ': 'חלוצה',
  'אתה פצוע': 'את פצועה', 'אתה מורחק למשחק הבא': 'את מורחקת למשחק הבא', 'אתה שחקן חופשי. בדוק הצעות': 'את שחקנית חופשית. בדקי הצעות',
  'בת הזוג': 'בן הזוג',
};
/** Label from strings.js for the current career: markers resolved; female fallback forms when the label has no marker. */
export function femLabel(s, gender) {
  if (typeof s !== 'string') return s;
  if (s.indexOf('{{') >= 0) return gtext(s, gender);
  const f = (gender === undefined || gender === null ? curGender() : gender) === 'f';
  return f && Object.prototype.hasOwnProperty.call(FEM, s) ? FEM[s] : s;
}
/** Economy scale of a career (C3): 1 for men, ~0.12 for women. */
export function econOf(S) { return S && typeof S.econ === 'number' && S.econ > 0 ? S.econ : 1; }
/** Scale a money amount by the career economy and round to 2 significant digits (keeps prices tidy). */
export function econMoney(S, n) {
  const e = econOf(S);
  if (e === 1 || !n) return n || 0;
  const v = Math.max(1, sigRound(Math.abs(n) * e, 2));
  return n < 0 ? -v : v;
}

export function clamp(x, lo, hi) {
  if (!Number.isFinite(x)) x = lo;
  return x < lo ? lo : x > hi ? hi : x;
}
export function round1(x) { return Math.round((Number(x) || 0) * 10) / 10; }
export function round2(x) { return Math.round((Number(x) || 0) * 100) / 100; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function sum(arr, fn) {
  let s = 0;
  if (!arr) return 0;
  for (let i = 0; i < arr.length; i++) s += fn ? fn(arr[i], i) : arr[i];
  return s;
}
export function avg(arr, fn) {
  if (!arr || arr.length === 0) return 0;
  return sum(arr, fn) / arr.length;
}
/** Hebrew: after the prefixes ב/ל/כ the definite article ה is absorbed ("ב" + "הליגה" = "בליגה"). */
export function hePrefix(prefix, name) {
  const s = String(name || '');
  return prefix + (s.length > 1 && s[0] === 'ה' ? s.slice(1) : s);
}
export function fill(template, vars, gender) {
  if (typeof template !== 'string') return '';
  return gtext(fillRaw(template, vars), gender);
}
function fillRaw(template, vars) {
  // "ב{comp}" -> "בליגה האירופית", not "בהליגה האירופית". Only competition names: club names such as
  // "הפועל באר שבע" keep their ה ("להפועל").
  return template.replace(/(^|[\s"'(״׳-])([בלכ])\{(comp|league|cup|tournament|tour)\}/g, (m, pre, letter, k) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] !== null && vars[k] !== undefined && vars[k] !== '') {
      return pre + hePrefix(letter, vars[k]);
    }
    return m;
  }).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] !== null && vars[k] !== undefined && vars[k] !== '') {
      return String(vars[k]);
    }
    return m;
  });
}
export function deepClone(o) {
  return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

function thousands(n) {
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}
function trimDec(x, d) {
  const s = x.toFixed(d);
  return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
}
export function fmtMoney(n) {
  n = Number(n) || 0;
  const neg = n < 0;
  const a = Math.abs(n);
  let s;
  if (a < 10000) s = '€' + thousands(a);
  else if (a < 1e6) {
    const k = a / 1000;
    s = '€' + (k < 100 ? trimDec(Math.round(k * 10) / 10, 1) : String(Math.round(k))) + 'K';
    if (Math.round(k) >= 1000) s = '€1M';
  } else {
    const m = a / 1e6;
    s = '€' + (m < 10 ? trimDec(Math.round(m * 10) / 10, 1) : String(Math.round(m))) + 'M';
  }
  return neg ? '-' + s : s;
}
export function fmtSeason(season) {
  const y = Number(season) || 0;
  return y + '/' + String((y + 1) % 100).padStart(2, '0');
}
export function sortIds(arr) {
  return arr.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
export function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
// Stochastic rounding to 1 decimal (keeps the expectation of tiny weekly deltas).
export function sround1(x, rng) {
  const v = x * 10;
  const f = Math.floor(v);
  return (f + (rng.next() < (v - f) ? 1 : 0)) / 10;
}
export function sigRound(n, digits = 2) {
  if (!n) return 0;
  return Number(Number(n).toPrecision(digits));
}

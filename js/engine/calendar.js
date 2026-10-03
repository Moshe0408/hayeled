// Calendar tables (SPEC §5.1). Pure.
import { MONTHS } from '../data/strings.js';

export const SEASON_WEEKS = 44;
export const SUMMER_START = 45;
export const WEEKS = 52;
export const INTL_WEEKS = [6, 11, 16, 33];
export const LEAGUE_WK_WEEKS = (() => {
  const a = [];
  for (let w = 1; w <= 42; w++) if (INTL_WEEKS.indexOf(w) < 0) a.push(w);
  return a;
})();
export const LEAGUE_MW_WEEKS = [2, 8, 12, 17, 19, 22, 24, 26];
export const EURO_WEEKS = { q: [3, 4], lp: [7, 9, 13, 15, 18, 20, 23, 25], kpo: [28, 29], r16: [31, 34], qf: [36, 37], sf: [39, 40], f: 44 };
export const CUP_WEEKS = [5, 10, 14, 21, 27, 35, 41];
export const CUP_FINAL_WEEK = 43;
export const WINTER_WINDOW = [22, 26];

const MONTH_RANGES = [[1, 4, 7], [5, 8, 8], [9, 13, 9], [14, 17, 10], [18, 21, 11], [22, 26, 0], [27, 30, 1], [31, 34, 2], [35, 38, 3], [39, 43, 4], [44, 47, 5], [48, 52, 6]];

export function monthOfWeek(week) {
  for (const [a, b, m] of MONTH_RANGES) if (week >= a && week <= b) return m;
  return 6;
}

const slotOrd = (s) => (s === 'mw' ? 0 : 1);

const _lrsCache = new Map();
// Round i (0-based) -> { w, s }
export function leagueRoundSlots(R) {
  if (_lrsCache.has(R)) return _lrsCache.get(R);
  let out = [];
  if (R <= 38) {
    for (let i = 0; i < R; i++) out.push({ w: LEAGUE_WK_WEEKS[Math.floor(i * 38 / R)], s: 'wk' });
  } else {
    const E = Math.min(8, R - 38);
    const list = LEAGUE_WK_WEEKS.map((w) => ({ w, s: 'wk' }));
    const used = new Set();
    for (let j = 0; j < E; j++) {
      let idx = Math.floor((j + 0.5) * 8 / E);
      while (used.has(idx) && idx < 7) idx++;
      used.add(idx);
      list.push({ w: LEAGUE_MW_WEEKS[idx], s: 'mw' });
    }
    list.sort((a, b) => (a.w - b.w) || (slotOrd(a.s) - slotOrd(b.s)));
    out = list.slice(0, R);
  }
  _lrsCache.set(R, out);
  return out;
}

// Rounds 0..n-1 of a domestic cup; the last one is the final (week 43 wk).
export function cupRoundSlots(n) {
  const out = [];
  const early = CUP_WEEKS.slice(Math.max(0, CUP_WEEKS.length - (n - 1)));
  for (const w of early) out.push({ w, s: 'mw' });
  out.push({ w: CUP_FINAL_WEEK, s: 'wk' });
  return out;
}

const TOUR_SLOTS = {
  g48: [['md1', 45, 'mw'], ['md2', 45, 'wk'], ['md3', 46, 'mw'], ['r32', 46, 'wk'], ['r16', 47, 'mw'], ['qf', 47, 'wk'], ['sf', 48, 'mw'], ['f', 48, 'wk']],
  g24: [['md1', 45, 'mw'], ['md2', 45, 'wk'], ['md3', 46, 'mw'], ['r16', 46, 'wk'], ['qf', 47, 'mw'], ['sf', 47, 'wk'], ['f', 48, 'wk']],
  g16: [['md1', 45, 'mw'], ['md2', 45, 'wk'], ['md3', 46, 'mw'], ['qf', 46, 'wk'], ['sf', 47, 'mw'], ['f', 47, 'wk']],
  g8: [['md1', 45, 'mw'], ['md2', 45, 'wk'], ['md3', 46, 'mw'], ['sf', 46, 'wk'], ['f', 47, 'wk']],
};
export function tournamentSlots(fmt) {
  return (TOUR_SLOTS[fmt] || TOUR_SLOTS.g16).map(([key, w, s]) => ({ key, w, s }));
}

export function isWindowOpen(week) {
  return week >= 45 || week <= 4 || (week >= WINTER_WINDOW[0] && week <= WINTER_WINDOW[1]);
}
export function isIntlWeek(week) { return INTL_WEEKS.indexOf(week) >= 0; }
// INTL slot index 1..8 for (week, slot), or 0.
export function intlSlotIndex(week, slot) {
  const i = INTL_WEEKS.indexOf(week);
  if (i < 0) return 0;
  return i * 2 + (slot === 'mw' ? 1 : 2);
}
export function intlSlotOf(k) {
  const i = Math.floor((k - 1) / 2);
  return { w: INTL_WEEKS[i], s: (k % 2 === 1) ? 'mw' : 'wk' };
}

export function weekLabelHe(season, week) {
  if (week >= SUMMER_START) return 'קיץ ' + (season + 1) + ' · שבוע ' + (week - SUMMER_START + 1);
  const m = (MONTHS && MONTHS[monthOfWeek(week)]) || '';
  return 'שבוע ' + week + ' · ' + m + ' · ' + season + '/' + String((season + 1) % 100).padStart(2, '0');
}

export function summerTournaments(year) {
  if (year % 4 === 2) return ['wc'];
  if (year % 4 === 0) return ['euro', 'copa', 'afcon', 'asian', 'gold'];
  return [];
}

export const CONFED_TOUR = { UEFA: 'euro', CONMEBOL: 'copa', CAF: 'afcon', AFC: 'asian', CONCACAF: 'gold' };

// daily.js (v2.3, F8): daily reward calendar + streak. Lives OUTSIDE the career save (it survives slots, new careers
// and deletions) and is dual-stored like the Hall of Fame: localStorage 'hy.daily' (sync, the source of truth while
// the page runs) mirrored to IndexedDB key 'hy.daily' (survives a cleared localStorage). Dates come from the local
// clock here (the engine never reads the clock): the UI passes { dayIndex, dateKey } to game.claimDaily().
//
// Rules: one claim per local day (all slots share it). Claiming on the next day continues the streak; one missed day
// is forgiven by the weekly "streak freeze" (one per Monday-based week); a longer gap resets the streak to day 1.
// dayIndex = 1..7 cycles (day 7 = the big chest).
import { idbGet, idbSet } from './idb.js';

const KEY = 'hy.daily';
const DEF = { v: 1, streak: 0, best: 0, last: '', freezeWeek: '', total: 0, updatedAt: 0 };
let cache = null;

const pad = (n) => String(n).padStart(2, '0');

/** Local date key 'YYYY-MM-DD'. */
export function dateKey(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Whole days between two date keys (b - a); NaN on bad input. Uses UTC noon so DST never shifts a day. */
export function daysBetween(a, b) {
  const p = (k) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 12) : NaN; };
  return Math.round((p(b) - p(a)) / 86400000);
}

/** Monday-based week key of a date key ('YYYY-MM-DD' of that Monday). */
export function weekKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function norm(o) {
  const s = { ...DEF, ...(o && typeof o === 'object' ? o : {}) };
  s.streak = Math.max(0, Math.floor(Number(s.streak) || 0));
  s.best = Math.max(s.streak, Math.floor(Number(s.best) || 0));
  s.total = Math.max(0, Math.floor(Number(s.total) || 0));
  s.updatedAt = Number(s.updatedAt) || 0;
  s.last = /^\d{4}-\d{2}-\d{2}$/.test(String(s.last)) ? s.last : '';
  s.freezeWeek = typeof s.freezeWeek === 'string' ? s.freezeWeek : '';
  return s;
}

function readLS() {
  try { const raw = localStorage.getItem(KEY); return raw ? norm(JSON.parse(raw)) : null; } catch { return null; }
}

function write(s) {
  cache = norm(s);
  const raw = JSON.stringify(cache);
  try { localStorage.setItem(KEY, raw); } catch { /* storage full / disabled */ }
  try { const p = idbSet(KEY, raw); if (p && p.catch) p.catch(() => {}); } catch { /* no idb */ }
  return cache;
}

/** Current record (sync). */
export function load() {
  if (!cache) cache = readLS() || norm(null);
  return cache;
}

/** Reconcile with the IndexedDB copy (the newer record wins). Call once at boot. Never throws. */
export async function sync() {
  try {
    const raw = await idbGet(KEY);
    const other = raw ? norm(JSON.parse(raw)) : null;
    const mine = readLS();
    if (!other && !mine) return load();
    const pick = !mine ? other : !other ? mine : (other.updatedAt > mine.updatedAt ? other : mine);
    return write(pick);
  } catch { return load(); }
}

/**
 * Status for a moment. Returns {
 *   today, claimedToday, streak (shown now), nextStreak (after claiming today), dayIndex (1..7 the claim today pays),
 *   reset (the streak breaks if claimed today), freezeUsed (claiming today spends the weekly freeze),
 *   freezeLeft (a freeze is available this week), best, total }
 */
export function status(now = new Date()) {
  const s = load();
  const today = dateKey(now);
  const gap = s.last ? daysBetween(s.last, today) : NaN;
  const freezeLeft = s.freezeWeek !== weekKey(today);
  let claimedToday = false, nextStreak = 1, reset = false, freezeUsed = false;
  if (s.last && gap <= 0) { claimedToday = true; nextStreak = s.streak; }
  else if (gap === 1) nextStreak = s.streak + 1;
  else if (gap === 2 && freezeLeft && s.streak > 0) { nextStreak = s.streak + 1; freezeUsed = true; }
  else { nextStreak = 1; reset = s.streak > 0; }
  // the streak as it stands today (0 if it is already broken)
  const alive = claimedToday || gap === 1 || freezeUsed;
  const streak = alive ? s.streak : 0;
  const dayIndex = ((Math.max(1, nextStreak) - 1) % 7) + 1;
  return { today, claimedToday, streak, nextStreak, dayIndex, reset, freezeUsed, freezeLeft, best: s.best, total: s.total, last: s.last };
}

/** Is a reward waiting today? */
export function available(now = new Date()) { return !status(now).claimedToday; }

/** Record today's claim. Returns { ok, dayIndex, streak, freezeUsed } (ok false if already claimed today). */
export function claim(now = new Date()) {
  const st = status(now);
  if (st.claimedToday) return { ok: false, dayIndex: st.dayIndex, streak: st.streak, freezeUsed: false };
  const s = load();
  const next = {
    ...s, streak: st.nextStreak, best: Math.max(s.best, st.nextStreak), last: st.today, total: s.total + 1,
    freezeWeek: st.freezeUsed ? weekKey(st.today) : s.freezeWeek, updatedAt: now.getTime(),
  };
  write(next);
  return { ok: true, dayIndex: st.dayIndex, streak: next.streak, freezeUsed: st.freezeUsed };
}

/** Test / dev helper: overwrite the record. */
export function _set(o) { return write(o); }

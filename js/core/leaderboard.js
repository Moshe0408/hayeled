// js/core/leaderboard.js - the public leaderboard (supabase/update-2.3.sql) + "אתגר חבר" challenge links.
// - Offline-safe: never throws, never blocks gameplay. Without a backend every call answers {ok:false, offline:true}.
// - Submissions that fail (offline, server down, update-2.3.sql not installed yet) wait in localStorage
//   'hy.lb.pending' (latest summary per career) and are retried by flushPending() / the next call.
// - The same summary is never sent twice ('hy.lb.sent' remembers a hash per career).
// - Challenge links need no backend: ?c=<code> where code = base64url(JSON array) + '.' + checksum.
// No DOM access at import time; safe to import in Node (tests/mock-supabase.mjs uses isBadName()).
import { BACKEND_ENABLED } from '../config.js';
import { rpc, SupaError } from './supa.js';
import { getDeviceId, cutText } from './telemetry.js';

export const PUBLIC_URL = 'https://moshe0408.github.io/hayeled/';
export const SHORT_LINK = 'tinyurl.com/hayeled';
export const KINDS = ['legacy', 'goals', 'ballon'];
export const PERIODS = ['all', 'week'];
export const NAME_MAX = 30;

const K_PENDING = 'hy.lb.pending';
const K_SENT = 'hy.lb.sent';
const K_CACHE = 'hy.lb.cache';
const K_PART = 'hy.lb.part';
const CACHE_MS = 60 * 1000;
const PENDING_MAX = 5;
const SENT_MAX = 20;
const CAREER_RE = /^[A-Za-z0-9_-]{4,64}$/;

// ---------- storage ----------
function ls() { try { return globalThis.localStorage || null; } catch { return null; } }
function lsGet(k) { try { const s = ls(); return s ? s.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { const s = ls(); if (s) s.setItem(k, v); } catch { /* full / private mode */ } }
function lsDel(k) { try { const s = ls(); if (s) s.removeItem(k); } catch { /* ignore */ } }
function readJson(k, d) { try { const v = JSON.parse(lsGet(k) || 'null'); return v && typeof v === 'object' ? v : d; } catch { return d; } }
function writeJson(k, v) { try { lsSet(k, JSON.stringify(v)); } catch { /* ignore */ } }
function trimMap(m, max) {
  const keys = Object.keys(m).sort((a, b) => (Number(m[a] && m[a].at) || 0) - (Number(m[b] && m[b].at) || 0));
  while (keys.length > max) delete m[keys.shift()];
  return m;
}

// ---------- text helpers (shared with the SQL rules) ----------
// control, soft hyphen, zero-width, line/paragraph separators, bidi embeddings / overrides / isolates, BOM
const STRIP_RE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g;
/** Same as public.hy_clean_text(): strip invisible / bidi characters, collapse spaces, trim, cut. '' when empty. */
export function cleanText(v, max = NAME_MAX) {
  const s = String(v == null ? '' : v).replace(STRIP_RE, '').replace(/\s+/g, ' ').trim();
  return cutText(s, Math.max(1, max)).trim();
}

const BAD_SUB_EN = /(fuck|fuk|phuck|shit|cunt|nigg|whore|slut|porn|bitch|pussy|penis|vagina|hitler|nazi|wank|bastard|asshole|dildo)/;
const BAD_SUB_HE = /(כוסאמ|כוסעמ|כוסאוחת|כוסאחת|כוסית|בנזונ|בןזונ|שרמוט|מזדיינ|מזדיין|לזיינ|לזיין|זיונים|מניאק|היטלר|נאצי|פורנו|קוקסינל|לאנוס|תמצוץ)/;
const BAD_WORDS = new Set(['זין', 'זיין', 'כוס', 'חרא', 'סקס', 'זונה', 'זונות', 'זיון', 'אנס', 'ass', 'sex', 'dick', 'cock', 'fag', 'tits', 'xxx', 'kkk', 'rape']);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', '@': 'a', $: 's', 5: 's', '!': 'i', '|': 'i' };
/** Light profanity filter, the exact rules of public.hy_bad_name() (Hebrew + English, a few leetspeak swaps). */
export function isBadName(v) {
  const low = String(v == null ? '' : v).toLowerCase().replace(/[0134@$5!|]/g, (c) => LEET[c] || c);
  const compact = low.replace(/[^a-zא-ת]/g, '');
  if (BAD_SUB_EN.test(compact) || BAD_SUB_HE.test(compact)) return true;
  return low.replace(/[^a-zא-ת]+/g, ' ').trim().split(' ').some((t) => BAD_WORDS.has(t));
}
const n0 = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };

// ---------- participation (who appears on the public board) ----------
/** True when this device's careers are submitted. Explicit opt-in: the typed name is public on the board, so nothing is
 *  sent before the player said yes (participationAsked() = the one-time question was answered). */
export function getParticipation() {
  return lsGet(K_PART) === '1';
}
export function participationAsked() {
  const v = lsGet(K_PART);
  return v === '1' || v === '0';
}
export function setParticipation(on) {
  lsSet(K_PART, on ? '1' : '0');
  if (!on) lsDel(K_PENDING);
}
/** Is the online leaderboard possible at all on this build (backend configured)? */
export function isAvailable() {
  return !!BACKEND_ENABLED;
}

// ---------- submit ----------
/** engine getCareerSummaryForBoard() -> the submit_career RPC arguments (or null when unusable). */
export function toArgs(summary, device) {
  const s = summary && typeof summary === 'object' ? summary : null;
  if (!s) return null;
  const career = String(s.careerId == null ? '' : s.careerId).slice(0, 64);
  const name = cleanText(s.name, NAME_MAX);
  if (!CAREER_RE.test(career) || !name) return null;
  const nation = String(s.nation == null ? '' : s.nation).toLowerCase();
  return {
    p_device: device,
    p_career: career,
    p_name: name,
    p_gender: s.gender === 'f' ? 'f' : 'm',
    p_nation: /^[a-z0-9_]{2,8}$/.test(nation) ? nation : null,
    p_club: cleanText(s.clubHe != null ? s.clubHe : s.club, 60) || null,
    p_ovr: n0(s.ovr, 0, 99),
    p_goals: n0(s.goals, 0, 5000),
    p_trophies: n0(s.trophies, 0, 500),
    p_ballon: n0(s.ballon, 0, 50),
    p_legacy: n0(s.legacy, 0, 1000000),
  };
}
function hashArgs(a) {
  const s = [a.p_name, a.p_gender, a.p_nation, a.p_club, a.p_ovr, a.p_goals, a.p_trophies, a.p_ballon, a.p_legacy].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function isMissingFn(e) { return e instanceof SupaError && (e.status === 404 || e.code === 'PGRST202'); }
function isTransient(e) { return !(e instanceof SupaError) || e.status === 0 || e.status === 429 || e.status >= 500 || isMissingFn(e); }

function queue(args) {
  const p = readJson(K_PENDING, {});
  p[args.p_career] = { args: { ...args, p_device: undefined }, at: Date.now() };
  writeJson(K_PENDING, trimMap(p, PENDING_MAX));
}
function unqueue(career) {
  const p = readJson(K_PENDING, {});
  if (p[career]) { delete p[career]; writeJson(K_PENDING, p); }
}
function markSent(args) {
  const m = readJson(K_SENT, {});
  m[args.p_career] = { h: hashArgs(args), at: Date.now() };
  writeJson(K_SENT, trimMap(m, SENT_MAX));
}

async function send(args) {
  try {
    const r = await rpc('submit_career', args, { timeoutMs: 8000 });
    if (r && r.ok === true) {
      markSent(args);
      unqueue(args.p_career);
      memCache.clear();
      return { ok: true, rank: r.rank == null ? null : Number(r.rank), masked: !!r.masked, name: r.name || args.p_name };
    }
    const error = (r && r.error) || 'server';
    if (error === 'rate_limited' || error === 'busy') { queue(args); return { ok: false, error, queued: true }; }
    unqueue(args.p_career);   // bad_* / too_many: retrying the same payload can never succeed
    return { ok: false, error };
  } catch (e) {
    if (isTransient(e)) { queue(args); return { ok: false, error: isMissingFn(e) ? 'not_installed' : 'offline', queued: true, offline: true }; }
    unqueue(args.p_career);
    return { ok: false, error: 'server' };
  }
}

/**
 * Send the career summary (engine getCareerSummaryForBoard()) to the public board - at season end / retirement.
 * -> { ok:true, rank, masked, name } | { ok:false, error, queued?, offline? } | { ok:true, skipped:'same'|'off' }
 *    rank = all-time legacy rank (null while hidden by the admin); masked = the name was replaced by the filter.
 */
export async function submitCareer(summary, { force = false } = {}) {
  try {
    if (!BACKEND_ENABLED) return { ok: false, error: 'offline', offline: true };
    if (!getParticipation()) return { ok: true, skipped: 'off' };
    const args = toArgs(summary, getDeviceId());
    if (!args) return { ok: false, error: 'bad_summary' };
    const prev = readJson(K_SENT, {})[args.p_career];
    if (!force && prev && prev.h === hashArgs(args)) { unqueue(args.p_career); return { ok: true, skipped: 'same' }; }
    const r = await send(args);
    if (r.ok) flushPending().catch(() => {});
    return r;
  } catch {
    return { ok: false, error: 'offline', offline: true };
  }
}

let flushing = null;
/** Retry queued submissions (call on boot / when back online). -> how many were sent. Never throws. */
export function flushPending() {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      if (!BACKEND_ENABLED || !getParticipation()) return 0;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
      const p = readJson(K_PENDING, {});
      const dev = getDeviceId();
      for (const k of Object.keys(p)) {
        const it = p[k];
        if (!it || !it.args) { unqueue(k); continue; }
        const r = await send({ ...it.args, p_device: dev });
        if (r.ok) sent++;
        else if (r.offline) break;   // still offline / not installed: keep the rest for later
      }
    } catch { /* keep the queue */ }
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}
/** How many submissions wait for the network (for a small "יישלח כשיהיה חיבור" note). */
export function pendingCount() {
  return Object.keys(readJson(K_PENDING, {})).length;
}

// ---------- read ----------
const memCache = new Map();   // 'kind|period|limit|career' -> { at, data }
function cacheKey(kind, period, limit, career) { return kind + '|' + period + '|' + limit + '|' + (career || ''); }
function saveStale(key, data) {
  const m = readJson(K_CACHE, {});
  m[key] = { at: Date.now(), data };
  writeJson(K_CACHE, trimMap(m, 4));
}
function readStale(key) {
  const it = readJson(K_CACHE, {})[key];
  return it && it.data && typeof it.data === 'object' ? it : null;
}
function normRow(r) {
  const x = r && typeof r === 'object' ? r : {};
  return {
    rank: n0(x.rank, 1, 1e9),
    name: cleanText(String(x.name == null ? '' : x.name).replace(/[{}]/g, ''), NAME_MAX) || (x.gender === 'f' ? 'שחקנית מהשכונה' : 'שחקן מהשכונה'),
    gender: x.gender === 'f' ? 'f' : 'm',
    nation: typeof x.nation === 'string' ? x.nation.slice(0, 8) : null,
    club: x.club ? cleanText(String(x.club).replace(/[{}]/g, ''), 60) : '',
    ovr: n0(x.ovr, 0, 99), goals: n0(x.goals, 0, 5000), trophies: n0(x.trophies, 0, 500),
    ballon: n0(x.ballon, 0, 50), legacy: n0(x.legacy, 0, 1000000),
    updatedAt: typeof x.updated_at === 'string' ? x.updated_at : null,
    mine: x.mine === true,
  };
}

/**
 * The public board. kind 'legacy' | 'goals' | 'ballon', period 'all' | 'week', limit 1..50.
 * careerId (optional) = the loaded career: its row gets mine:true and `me` holds its rank even outside the top.
 * -> { ok:true, kind, period, total, rows:[{rank, name, gender, nation, club, ovr, goals, trophies, ballon, legacy,
 *      updatedAt, mine}], me: {...row, inTop} | null, at, stale? }
 *  | { ok:false, error:'offline'|'not_installed'|'server', kind, period, total:0, rows:[], me:null, offline? }
 *    (when a cached copy exists it is returned instead, with ok:true + stale:true + error)
 */
export async function getLeaderboard({ kind = 'legacy', period = 'all', limit = 50, careerId = '', fresh = false } = {}) {
  const k = KINDS.includes(kind) ? kind : 'legacy';
  const p = PERIODS.includes(period) ? period : 'all';
  const lim = n0(limit, 1, 50);
  const car = CAREER_RE.test(String(careerId || '')) ? String(careerId) : '';
  const key = cacheKey(k, p, lim, car);
  const empty = (error, extra = {}) => {
    const st = readStale(key);
    if (st) return { ...st.data, ok: true, stale: true, at: st.at, error };
    return { ok: false, error, kind: k, period: p, total: 0, rows: [], me: null, ...extra };
  };
  try {
    if (!BACKEND_ENABLED) return { ok: false, error: 'offline', offline: true, kind: k, period: p, total: 0, rows: [], me: null };
    const c = memCache.get(key);
    if (!fresh && c && Date.now() - c.at < CACHE_MS) return c.data;
    flushPending().catch(() => {});
    const args = { p_kind: k, p_period: p, p_limit: lim };
    // "my rank" needs the device + career ids: only for a player who chose to be on the board
    if (car && getParticipation()) { args.p_device = getDeviceId(); args.p_career = car; }
    const r = await rpc('get_leaderboard', args, { timeoutMs: 8000 });
    if (!r || r.ok !== true || !Array.isArray(r.rows)) return empty('server');
    const me = r.me && typeof r.me === 'object' ? { ...normRow(r.me), mine: true, inTop: r.me.in_top === true } : null;
    const data = { ok: true, kind: k, period: p, total: n0(r.total, 0, 1e9), rows: r.rows.map(normRow), me, at: Date.now() };
    memCache.set(key, { at: Date.now(), data });
    saveStale(key, data);
    return data;
  } catch (e) {
    if (isMissingFn(e)) return empty('not_installed');
    if (e instanceof SupaError && e.status > 0 && e.status < 500 && e.status !== 429) return empty('server');
    return empty('offline', { offline: true });
  }
}

// ---------- challenge links (no backend) ----------
// code = base64url(UTF-8 JSON array) + '.' + 4-char checksum. Array (v1):
//   [1, name, gender, nation, clubHe, ovr, goals, trophies, ballon, legacy, age, milestone, milestoneHe, seasons]
const CH_V = 1;
const MS_RE = /^[a-z0-9_]{1,24}$/;
function chk(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 1679616).toString(36).padStart(4, '0');
}
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function normChallenge(a) {
  // braces removed: the UI resolves {{m|f}} gender markers, a name must never carry one
  const name = cleanText(String(a.name == null ? '' : a.name).replace(/[{}]/g, ''), NAME_MAX);
  if (!name) return null;
  const gender = a.gender === 'f' ? 'f' : 'm';
  const nation = String(a.nation == null ? '' : a.nation).toLowerCase();
  const ms = String(a.milestone == null ? '' : a.milestone).toLowerCase();
  const age = Math.round(Number(a.age));
  return {
    v: CH_V,
    name: isBadName(name) ? (gender === 'f' ? 'שחקנית מהשכונה' : 'שחקן מהשכונה') : name,
    gender,
    nation: /^[a-z0-9_]{2,8}$/.test(nation) ? nation : null,
    clubHe: cleanText(String(a.clubHe == null ? '' : a.clubHe).replace(/[{}]/g, ''), 30),
    ovr: n0(a.ovr, 0, 99), goals: n0(a.goals, 0, 5000), trophies: n0(a.trophies, 0, 500),
    ballon: n0(a.ballon, 0, 50), legacy: n0(a.legacy, 0, 1000000),
    age: Number.isFinite(age) && age >= 10 && age <= 60 ? age : null,
    milestone: MS_RE.test(ms) ? ms : null,
    milestoneHe: cleanText(String(a.milestoneHe == null ? '' : a.milestoneHe).replace(/[{}]/g, ''), 48),
    seasons: n0(a.seasons, 0, 60),
  };
}

/**
 * summary: getCareerSummaryForBoard() + optional { age, milestone (path step id, e.g. 'cl'), milestoneHe
 * (a noun phrase WITHOUT the preposition ל, e.g. 'ליגת האלופות' / 'הנבחרת הבוגרת'), seasons }. -> the code ('' when the summary has no name).
 */
export function encodeChallenge(summary) {
  try {
    const c = normChallenge(summary && typeof summary === 'object' ? summary : {});
    if (!c) return '';
    const arr = [CH_V, c.name, c.gender, c.nation, c.clubHe, c.ovr, c.goals, c.trophies, c.ballon, c.legacy, c.age, c.milestone, c.milestoneHe, c.seasons];
    const body = b64urlEncode(JSON.stringify(arr));
    return body + '.' + chk(body);
  } catch {
    return '';
  }
}

/** code -> challenge {v, name, gender, nation, clubHe, ovr, goals, trophies, ballon, legacy, age, milestone,
 *  milestoneHe, seasons} | null (bad / truncated / tampered code). All strings are cleaned; render with textContent. */
export function decodeChallenge(code) {
  try {
    const s = String(code == null ? '' : code).trim();
    const m = /^([A-Za-z0-9_-]{8,1200})\.([0-9a-z]{4})$/.exec(s);
    if (!m || chk(m[1]) !== m[2]) return null;
    const arr = JSON.parse(b64urlDecode(m[1]));
    if (!Array.isArray(arr) || arr[0] !== CH_V) return null;
    const [, name, gender, nation, clubHe, ovr, goals, trophies, ballon, legacy, age, milestone, milestoneHe, seasons] = arr;
    return normChallenge({ name, gender, nation, clubHe, ovr, goals, trophies, ballon, legacy, age, milestone, milestoneHe, seasons });
  } catch {
    return null;
  }
}

/** The link to share: https://moshe0408.github.io/hayeled/?c=<code> ('' when the summary is unusable). */
export function challengeUrl(summary, base = PUBLIC_URL) {
  const code = encodeChallenge(summary);
  if (!code) return '';
  const b = String(base || PUBLIC_URL).split('#')[0].split('?')[0];
  return b + '?c=' + code;
}

/** Read a challenge from a URL (default: the current page). -> { code, challenge|null } | null when there is no ?c= */
export function readChallengeFromUrl(href) {
  try {
    const h = href != null ? String(href) : (typeof location !== 'undefined' ? location.href : '');
    if (!h) return null;
    const u = new URL(h, PUBLIC_URL);
    const code = u.searchParams.get('c');
    if (!code) return null;
    return { code: code.slice(0, 1300), challenge: decodeChallenge(code) };
  } catch {
    return null;
  }
}

/** Remove ?c= from the address bar (after the challenge card was shown), keeping the hash route. */
export function stripChallengeFromUrl() {
  try {
    if (typeof location === 'undefined' || typeof history === 'undefined' || !history.replaceState) return;
    const u = new URL(location.href);
    if (!u.searchParams.has('c')) return;
    u.searchParams.delete('c');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* ignore */ }
}

/**
 * Built-in Hebrew fallback for the challenge card (the content table CHALLENGE_TEXT wins when present):
 * 'נועה הגיעה לליגת האלופות בגיל 19 - תנסה לנצח?'  /  'איתי צבר 812 נקודות מורשת - תנסה לנצח?'
 */
export function challengeLineHe(ch) {
  if (!ch || !ch.name) return '';
  const f = ch.gender === 'f';
  const tail = ' - תנסה לנצח?';
  if (ch.milestoneHe) {
    // milestoneHe is a noun phrase without the preposition ('ליגת האלופות', 'הנבחרת הבוגרת'): ל + noun, ה drops
    const target = 'ל' + (/^ה/.test(ch.milestoneHe) ? ch.milestoneHe.slice(1) : ch.milestoneHe);
    return ch.name + ' ' + (f ? 'הגיעה' : 'הגיע') + ' ' + target + (ch.age ? ' בגיל ' + ch.age : '') + tail;
  }
  if (ch.ballon > 0) return ch.name + ' ' + (f ? 'זכתה' : 'זכה') + ' ב' + (ch.ballon === 1 ? 'כדור הזהב' : ch.ballon + ' כדורי זהב') + tail;
  if (ch.goals > 0) return ch.name + ' ' + (f ? 'הבקיעה' : 'הבקיע') + ' ' + ch.goals + ' שערים' + (ch.age ? ' עד גיל ' + ch.age : '') + tail;
  return ch.name + ' ' + (f ? 'צברה' : 'צבר') + ' ' + ch.legacy + ' נקודות מורשת' + tail;
}

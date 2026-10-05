// js/core/friends.js - "ליגת חברים" (friends leagues) client: supabase/update-2.3-friends.sql (fl_* RPCs).
// - Offline-safe: never throws into gameplay. Every call answers {ok:false, error, messageHe} when it cannot work
//   (no backend, offline, server error, update-2.3-friends.sql not installed yet).
// - The list of my leagues lives in localStorage 'hy.friends' (device-wide: survives slot switches / deletions)
//   and is mirrored on the server (fl_mine restores it on a new install of the same device id).
// - A league table is cached locally (offline view + the hub notices "X עקפה אותך").
// - syncMyCareer() pushes the summary of the career in memory to every league of this device + career,
//   at most once per 10 minutes (force:true for season end / retirement).
// No DOM access at import time; safe to import in Node (tests use _setTransport()).
import { BACKEND_ENABLED } from '../config.js';
import { rpc, SupaError } from './supa.js';
import * as tm from './telemetry.js';
import * as game from '../engine/game.js';

export const PUBLIC_URL = 'https://moshe0408.github.io/hayeled/';
export const MAX_MEMBERS = 50;
export const MAX_OWNED = 10;
export const NAME_MIN = 2;
export const NAME_MAX = 24;
export const SYNC_EVERY_MS = 10 * 60 * 1000;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const K = 'hy.friends';
const CACHE_MAX = 12;
const PENDING_TTL = 14 * 24 * 3600 * 1000;
const MINE_EVERY_MS = 6 * 3600 * 1000;
const CODE_RE = /^[A-HJ-NP-Z2-9]{6,8}$/;
const CAREER_RE = /^[A-Za-z0-9_-]{4,64}$/;

// ---------- transport (tests / harness can replace it; the real one is supa.rpc) ----------
let transport = null;
/** Test hook: fn(name, args) -> Promise<data> (throw a SupaError-like {status} to simulate failures). null = real backend. */
export function _setTransport(fn) { transport = typeof fn === 'function' ? fn : null; }
/** Is the friends league possible on this build (backend configured)? */
export function isAvailable() { return !!transport || !!BACKEND_ENABLED; }
function online() { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch { return true; } }
function device() { try { return tm.getDeviceId(); } catch { return ''; } }

// ---------- storage ----------
function ls() { try { return globalThis.localStorage || null; } catch { return null; } }
function blank() { return { v: 1, leagues: [], pending: null, seen: {}, cache: {}, sync: {}, mineAt: 0 }; }
function load() {
  try {
    const s = ls();
    const raw = s ? s.getItem(K) : null;
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return blank();
    const o = { ...blank(), ...v };
    if (!Array.isArray(o.leagues)) o.leagues = [];
    o.leagues = o.leagues.filter((l) => l && CODE_RE.test(String(l.code || '')));
    for (const k of ['seen', 'cache', 'sync']) if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
    return o;
  } catch { return blank(); }
}
function save(st) {
  try {
    const s = ls();
    if (!s) return;
    const keys = Object.keys(st.cache).sort((a, b) => (st.cache[b].at || 0) - (st.cache[a].at || 0));
    for (const k of keys.slice(CACHE_MAX)) delete st.cache[k];
    try { s.setItem(K, JSON.stringify(st)); } catch {
      st.cache = {};   // storage full: the cache goes first (game saves have priority)
      try { s.setItem(K, JSON.stringify(st)); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
function mutate(fn) { const st = load(); const r = fn(st); save(st); return r; }

// ---------- text helpers ----------
const STRIP_RE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g;
/** Same as public.hy_fl_clean(): strip invisible / bidi characters, collapse spaces, trim, cut. */
export function cleanText(v, max = 30) {
  const s = String(v == null ? '' : v).replace(STRIP_RE, '').replace(/\s+/g, ' ').trim();
  const cut = typeof tm.cutText === 'function' ? tm.cutText(s, Math.max(1, max)) : s.slice(0, Math.max(1, max));
  return cut.trim();
}
const BAD_SUB_EN = /(fuck|fuk|phuck|shit|cunt|nigg|whore|slut|porn|bitch|pussy|penis|vagina|hitler|nazi|wank|bastard|asshole|dildo)/;
const BAD_SUB_HE = /(כוסאמ|כוסעמ|כוסאוחת|כוסאחת|כוסית|בנזונ|בןזונ|שרמוט|מזדיינ|מזדיין|לזיינ|לזיין|זיונים|מניאק|היטלר|נאצי|פורנו|קוקסינל|לאנוס|תמצוץ)/;
const BAD_WORDS = new Set(['זין', 'זיין', 'כוס', 'חרא', 'סקס', 'זונה', 'זונות', 'זיון', 'אנס', 'ass', 'sex', 'dick', 'cock', 'fag', 'tits', 'xxx', 'kkk', 'rape']);
const BAD_PREFIXED = new Set(['זונה', 'זונות', 'זיון', 'זיונים', 'חרא', 'סקס']);
const HE_PREFIX = 'הובלמשכ';
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', '@': 'a', $: 's', 5: 's', '!': 'i', '|': 'i' };
/** The exact rules of public.hy_fl_bad() (leaderboard list + Hebrew prefix letters). */
export function isBadName(v) {
  const low = String(v == null ? '' : v).toLowerCase().replace(/[0134@$5!|]/g, (c) => LEET[c] || c);
  const compact = low.replace(/[^a-zא-ת]/g, '');
  if (BAD_SUB_EN.test(compact) || BAD_SUB_HE.test(compact)) return true;
  return low.replace(/[^a-zא-ת]+/g, ' ').trim().split(' ').some((t) => BAD_WORDS.has(t)
    || (t.length >= 4 && HE_PREFIX.includes(t[0]) && BAD_PREFIXED.has(t.slice(1))));
}
/** 'abc-def ' -> 'ABCDEF' ('' when it cannot be a league code). */
export function normCode(v) {
  const c = String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(c) ? c : '';
}
/** League name check before calling the server -> '' (fine) | error code. */
export function checkLeagueName(v) {
  const n = cleanText(v, NAME_MAX);
  if (n.length < NAME_MIN) return 'short';
  if (isBadName(n)) return 'bad_name';
  return '';
}
const he = (s) => {
  try { if (typeof game.gtextHe === 'function') return game.gtextHe(s); } catch { /* engine without career */ }
  return String(s).replace(/\{\{([^{}|]*)\|([^{}]*)\}\}/g, '$1');
};

const MSG = {
  offline: 'אין חיבור לאינטרנט כרגע. נס{{ה|י}} שוב בעוד רגע',
  unavailable: 'ליגת חברים צריכה חיבור לשרת המשחק, והוא לא זמין בגרסה הזאת',
  not_installed: 'ליגת חברים עוד לא פתוחה בשרת. נס{{ה|י}} שוב מאוחר יותר',
  server: 'משהו השתבש בשרת. נס{{ה|י}} שוב בעוד רגע',
  bad_code: 'הקוד לא תקין. קוד ליגה הוא 6 אותיות ומספרים',
  not_found: 'לא מצאנו ליגה עם הקוד הזה. אולי היא נסגרה?',
  full: 'הליגה מלאה (50 משתתפים)',
  too_many: 'הגעת למספר הליגות המקסימלי',
  too_many_owned: 'אפשר לפתוח עד 10 ליגות. צא{{|י}} מאחת הליגות שפתחת כדי לפתוח חדשה',
  bad_name: 'השם לא מתאים. נס{{ה|י}} שם אחר',
  short: 'שם הליגה קצר מדי (לפחות 2 תווים)',
  rate_limited: 'רגע, יותר מדי פעולות ברצף. נס{{ה|י}} שוב בעוד דקה',
  busy: 'השרת עמוס כרגע. נס{{ה|י}} שוב בעוד דקה',
  not_owner: 'רק מי שמנהל את הליגה יכול לעשות את זה',
  no_career: 'כדי להצטרף צריך קריירה. פותחים קריירה, ואנחנו נחזיר אותך להזמנה',
  bad_summary: 'לא הצלחנו לקרוא את הקריירה. נס{{ה|י}} שוב',
  self: 'אי אפשר להסיר את עצמך. אפשר לצאת מהליגה',
  not_member: 'המשתתף כבר לא בליגה',
  bad_device: 'משהו השתבש במכשיר. נס{{ה|י}} לרענן את המשחק',
  bad_career: 'לא הצלחנו לקרוא את הקריירה. נס{{ה|י}} שוב',
};
/** error code -> friendly Hebrew text (gender of the career in memory). */
export function messageFor(error) { return he(MSG[error] || MSG.server); }
const fail = (error, extra = {}) => ({ ok: false, error, messageHe: messageFor(error), ...extra });

function isMissingFn(e) { return !!e && (e.status === 404 || e.code === 'PGRST202'); }
async function call(name, args) {
  if (!isAvailable()) return fail('unavailable', { offline: true });
  if (!transport && !online()) return fail('offline', { offline: true });
  try {
    const r = transport ? await transport(name, args) : await rpc(name, args, { timeoutMs: 8000 });
    if (r && typeof r === 'object' && r.ok === false) {
      return fail(String(r.error || 'server'));
    }
    if (!r || typeof r !== 'object') return fail('server');
    return r;
  } catch (e) {
    if (isMissingFn(e)) return fail('not_installed', { offline: true });
    const st = e && typeof e.status === 'number' ? e.status : 0;
    if (!(e instanceof SupaError) && !st) return fail('offline', { offline: true });
    if (st === 0 || st === 429 || st >= 500) return fail(st === 429 ? 'rate_limited' : 'offline', { offline: st !== 429 });
    return fail('server');
  }
}

// ---------- career summary ----------
const int = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };
const resolveMarks = (s, gender) => String(s == null ? '' : s).replace(/\{\{([^{}|]*)\|([^{}]*)\}\}/g, (_, m, f) => (gender === 'f' ? f : m));
/** Any summary-like object -> the fl_* summary json {careerId, name, gender, nation, clubId, clubHe, ovr, goals, ...}. */
export function normSummary(s) {
  if (!s || typeof s !== 'object') return null;
  const careerId = String(s.careerId == null ? '' : s.careerId).slice(0, 64);
  const gender = s.gender === 'f' ? 'f' : 'm';
  const name = cleanText(s.name, 30);
  if (!CAREER_RE.test(careerId) || !name) return null;
  const nation = String(s.nation == null ? '' : s.nation).toLowerCase();
  const clubId = String(s.clubId != null ? s.clubId : s.club != null ? s.club : '').toLowerCase();
  return {
    careerId, name, gender,
    nation: /^[a-z0-9_]{2,8}$/.test(nation) ? nation : null,
    clubId: /^[a-z0-9_]{1,24}$/.test(clubId) ? clubId : null,
    clubHe: cleanText(resolveMarks(s.clubHe, gender), 60) || null,
    ovr: int(s.ovr, 0, 99), goals: int(s.goals, 0, 5000), trophies: int(s.trophies, 0, 500),
    ballon: int(s.ballon, 0, 50), legacy: int(s.legacy, 0, 1000000),
  };
}
/** A save-slot header meta (save.listSlots()[i].meta = game.getSaveMeta()) -> summary (no goals / legacy: the next sync fills them). */
export function summaryFromMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return normSummary({
    careerId: meta.careerId, name: meta.name, gender: meta.gender, nation: meta.nation,
    clubId: meta.clubId || meta.lastClub || null, clubHe: meta.lastClubHe || (meta.clubId ? meta.clubHe : '') || '',
    ovr: meta.ovr, goals: 0, trophies: 0, ballon: 0, legacy: 0,
  });
}
/** Summary of the career in memory: game.getCareerSummaryForBoard() when it exists, else getSaveMeta() + getProfile(). */
export function currentSummary() {
  try {
    if (typeof game.hasCareer === 'function' && !game.hasCareer()) return null;
  } catch { return null; }
  let s = null;
  try { if (typeof game.getCareerSummaryForBoard === 'function') s = game.getCareerSummaryForBoard(); } catch { s = null; }
  let meta = null;
  try { meta = game.getSaveMeta(); } catch { meta = null; }
  if (s && meta) {
    if (!s.clubId && !s.club) s = { ...s, clubId: meta.clubId || meta.lastClub || null };
    return normSummary(s);
  }
  if (!meta) return normSummary(s);
  let prof = null;
  try { prof = game.getProfile(); } catch { prof = null; }
  const c = (prof && prof.career) || {};
  return normSummary({
    careerId: meta.careerId, name: meta.name, gender: meta.gender, nation: meta.nation,
    clubId: meta.clubId || meta.lastClub || null, clubHe: meta.lastClubHe || meta.clubHe || '',
    ovr: meta.ovr, goals: c.goals, trophies: c.trophies, ballon: 0, legacy: 0,
  });
}
const wire = (s) => ({ name: s.name, gender: s.gender, nation: s.nation, clubId: s.clubId, clubHe: s.clubHe,
  ovr: s.ovr, goals: s.goals, trophies: s.trophies, ballon: s.ballon, legacy: s.legacy });

// ---------- links ----------
/** Base URL for invitations: this app's own address on http(s), else the public site. */
export function appBaseUrl() {
  try {
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      return location.origin + location.pathname.replace(/index\.html$/i, '');
    }
  } catch { /* ignore */ }
  return PUBLIC_URL;
}
export function inviteUrl(code) { return appBaseUrl() + '?league=' + encodeURIComponent(normCode(code) || String(code || '')); }

/**
 * Boot: read ?league=CODE (search or hash query), remember it as a pending join, drop it from the address bar.
 * -> the code or null. The UI shows the join card (#/friends/join?code=CODE).
 */
export function handleLeagueParam() {
  try {
    if (typeof location === 'undefined') return null;
    let raw = '';
    let fromSearch = false;
    try { raw = new URLSearchParams(location.search || '').get('league') || ''; fromSearch = !!raw; } catch { raw = ''; }
    if (!raw) {
      const h = String(location.hash || '');
      const qi = h.indexOf('?');
      if (qi >= 0 && !/^#\/friends\/join/.test(h)) { try { raw = new URLSearchParams(h.slice(qi + 1)).get('league') || ''; } catch { raw = ''; } }
    }
    const code = normCode(raw);
    if (fromSearch) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete('league');
        history.replaceState(history.state, '', u.pathname + (u.search || '') + (u.hash || ''));
      } catch { /* keep the url */ }
    }
    if (!code) return null;
    mutate((st) => { st.pending = { code, at: Date.now() }; });
    return code;
  } catch { return null; }
}
/** The invitation waiting to be answered (code) or null. */
export function getPendingJoin() {
  const p = load().pending;
  if (!p || !CODE_RE.test(String(p.code || ''))) return null;
  if (Date.now() - (Number(p.at) || 0) > PENDING_TTL) { clearPendingJoin(); return null; }
  return p.code;
}
export function clearPendingJoin() { mutate((st) => { st.pending = null; }); }

// ---------- my leagues ----------
/** [{code, nameHe, role:'owner'|'member', careers:[careerId], members?}] from localStorage (sync, never throws). */
export function myLeagues() {
  try {
    const st = load();
    return st.leagues.map((l) => ({
      code: l.code, nameHe: String(l.nameHe || l.code), role: l.role === 'owner' ? 'owner' : 'member',
      careers: Array.isArray(l.careers) ? l.careers.slice() : [], members: st.cache[l.code] ? st.cache[l.code].data.count : (l.members || null),
      joinedAt: l.joinedAt || 0,
    }));
  } catch { return []; }
}
function upsertLocal(st, code, patch) {
  let l = st.leagues.find((x) => x.code === code);
  if (!l) { l = { code, nameHe: code, role: 'member', careers: [], joinedAt: Date.now() }; st.leagues.push(l); }
  if (patch.nameHe) l.nameHe = patch.nameHe;
  if (patch.role) l.role = patch.role;
  if (patch.members != null) l.members = patch.members;
  if (patch.career && !l.careers.includes(patch.career)) l.careers.push(patch.career);
  return l;
}
function dropLocal(st, code) {
  st.leagues = st.leagues.filter((x) => x.code !== code);
  delete st.cache[code];
  delete st.seen[code];
}

/** Merge the server's list (fl_mine) into the local one. -> myLeagues(). Throttled (6 h) unless force. */
export async function refreshMyLeagues({ force = false } = {}) {
  try {
    const st0 = load();
    if (!force && Date.now() - (Number(st0.mineAt) || 0) < MINE_EVERY_MS) return myLeagues();
    const r = await call('fl_mine', { p_device: device() });
    if (!r.ok) return myLeagues();
    mutate((st) => {
      st.mineAt = Date.now();
      const seenCodes = new Set();
      for (const x of Array.isArray(r.leagues) ? r.leagues : []) {
        const code = normCode(x.code);
        if (!code) continue;
        seenCodes.add(code);
        upsertLocal(st, code, { nameHe: cleanText(x.name, NAME_MAX), role: x.role === 'owner' ? 'owner' : 'member', members: Number(x.members) || 0, career: CAREER_RE.test(String(x.career_id || '')) ? x.career_id : null });
      }
      // the server is the truth for leagues it does not know any more (deleted / removed by the owner)
      for (const l of st.leagues.slice()) if (!seenCodes.has(l.code)) dropLocal(st, l.code);
    });
  } catch { /* keep the local list */ }
  return myLeagues();
}

/** -> {ok, code, url, nameHe, joined} | {ok:false, error, messageHe}. Joins with the career in memory when there is one. */
export async function createLeague(nameHe) {
  try {
    const bad = checkLeagueName(nameHe);
    if (bad) return fail(bad);
    const name = cleanText(nameHe, NAME_MAX);
    const s = currentSummary();
    const args = { p_device: device(), p_name: name, p_career: s ? s.careerId : null, p_summary: s ? wire(s) : null };
    const r = await call('fl_create', args);
    if (!r.ok) return r.error === 'too_many' ? fail('too_many_owned') : r;
    const code = normCode(r.code);
    if (!code) return fail('server');
    const joined = r.joined === true;
    mutate((st) => {
      upsertLocal(st, code, { nameHe: cleanText(r.name, NAME_MAX) || name, role: 'owner', members: joined ? 1 : 0, career: joined && s ? s.careerId : null });
      if (joined && s) st.sync[s.careerId] = { at: Date.now() };
    });
    return { ok: true, code, url: inviteUrl(code), nameHe: cleanText(r.name, NAME_MAX) || name, joined };
  } catch { return fail('server'); }
}

/**
 * Join (or refresh) a league. opts.summary: a summary for a career that is not in memory (summaryFromMeta(slot meta)).
 * -> {ok, league:{code, nameHe, members, already}} | {ok:false, error, messageHe}
 */
export async function joinLeague(code, { summary } = {}) {
  try {
    const c = normCode(code);
    if (!c) return fail('bad_code');
    const s = summary ? normSummary(summary) : currentSummary();
    if (!s) return fail('no_career');
    const r = await call('fl_join', { p_code: c, p_device: device(), p_career: s.careerId, p_summary: wire(s) });
    if (!r.ok) return r;
    const nameHe = cleanText(r.name, NAME_MAX) || c;
    mutate((st) => {
      upsertLocal(st, c, { nameHe, role: r.owner ? 'owner' : undefined, members: Number(r.members) || null, career: s.careerId });
      if (st.pending && st.pending.code === c) st.pending = null;
      if (st.cache[c]) st.cache[c].at = 0;   // refetch soon (the notices baseline stays)
    });
    return { ok: true, league: { code: c, nameHe, members: Number(r.members) || 0, already: r.already === true } };
  } catch { return fail('server'); }
}

function mapMember(m) {
  return {
    rank: Number(m.rank) || 0, hash: String(m.hash || ''), name: cleanText(m.name, 30) || '?', gender: m.gender === 'f' ? 'f' : 'm',
    nation: m.nation || null, clubHe: m.club_he || '', clubId: m.club_id || null,
    ovr: int(m.ovr, 0, 99), goals: int(m.goals, 0, 1e6), trophies: int(m.trophies, 0, 1e6), ballon: int(m.ballon, 0, 1e6),
    legacy: int(m.legacy, 0, 1e9), weekGoals: int(m.week_goals, 0, 1e6), isMe: m.me === true, owner: m.owner === true,
  };
}
function mapLeague(r, code) {
  const members = (Array.isArray(r.members) ? r.members : []).map(mapMember);
  const k = r.week_king;
  return {
    ok: true, code: normCode(r.code) || code, nameHe: cleanText(r.name, NAME_MAX) || code, count: Number(r.count) || members.length,
    max: Number(r.max) || MAX_MEMBERS, isOwner: r.is_owner === true, isMember: r.is_member === true, weekKey: r.week_key || '',
    members,
    weekKing: k && typeof k === 'object' ? { name: cleanText(k.name, 30), gender: k.gender === 'f' ? 'f' : 'm', weekGoals: int(k.week_goals, 0, 1e6), isMe: k.me === true, hash: String(k.hash || '') } : null,
    at: Date.now(),
  };
}

/**
 * The league table -> {ok, code, nameHe, count, max, isOwner, isMember, members:[{rank, hash, name, gender, nation,
 * clubHe, clubId, ovr, goals, trophies, ballon, legacy, weekGoals, isMe, owner}], weekKing, stale?}
 * Offline: the cached copy with stale:true (when there is one).
 */
export async function getLeague(code) {
  try {
    const c = normCode(code);
    if (!c) return fail('bad_code');
    const r = await call('fl_get', { p_code: c, p_device: device() });
    if (!r.ok) {
      if (r.error === 'not_found') { mutate((st) => dropLocal(st, c)); return r; }
      const cached = cachedLeague(c);
      return cached ? { ...cached, stale: true, error: r.error, messageHe: r.messageHe } : r;
    }
    const L = mapLeague(r, c);
    mutate((st) => {
      const mine = st.leagues.find((x) => x.code === c);
      if (mine) {
        if (!L.isMember && !L.isOwner) dropLocal(st, c);   // removed by the owner / left on another install
        else { mine.nameHe = L.nameHe; mine.role = L.isOwner ? 'owner' : 'member'; mine.members = L.count; }
      }
      if (st.leagues.some((x) => x.code === c)) {
        st.cache[c] = { at: L.at, data: { ...L, ok: undefined } };
        if (!st.seen[c]) st.seen[c] = seenOf(L);   // first look: the baseline for the notices
      }
    });
    return L;
  } catch { return fail('server'); }
}
/** The last fetched table of a league of mine (sync) or null. */
export function cachedLeague(code) {
  try {
    const c = normCode(code);
    const e = c ? load().cache[c] : null;
    return e && e.data ? { ok: true, ...e.data, cachedAt: e.at } : null;
  } catch { return null; }
}

/** Refresh the cached tables of my leagues that are older than maxAgeMs (for the notices). -> how many were fetched. */
export async function refreshLeagues({ maxAgeMs = 15 * 60 * 1000, max = 5 } = {}) {
  let n = 0;
  try {
    if (!isAvailable() || !online()) return 0;
    const st = load();
    const due = st.leagues.filter((l) => !st.cache[l.code] || Date.now() - (st.cache[l.code].at || 0) >= maxAgeMs).slice(0, max);
    for (const l of due) {
      const r = await getLeague(l.code);
      if (r && r.ok && !r.stale) n++;
      else if (r && r.offline) break;
    }
  } catch { /* ignore */ }
  return n;
}

let syncing = null;
/**
 * Push the summary of the career in memory to every league this device + career is in.
 * Throttled to once per 10 minutes per career (force:true skips the throttle). Never throws.
 * -> {ok:true, updated} | {ok:true, skipped:'no_leagues'|'no_career'|'throttled'} | {ok:false, error, messageHe}
 */
export function syncMyCareer({ force = false } = {}) {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      if (!isAvailable()) return { ok: true, skipped: 'unavailable' };
      const st = load();
      if (!st.leagues.length) return { ok: true, skipped: 'no_leagues' };
      const s = currentSummary();
      if (!s) return { ok: true, skipped: 'no_career' };
      const last = st.sync[s.careerId];
      if (!force && last && Date.now() - (Number(last.at) || 0) < SYNC_EVERY_MS) return { ok: true, skipped: 'throttled' };
      const r = await call('fl_sync', { p_device: device(), p_career: s.careerId, p_summary: wire(s) });
      if (!r.ok) {
        if (r.error === 'rate_limited') { mutate((x) => { x.sync[s.careerId] = { at: Date.now() }; }); return { ok: true, skipped: 'throttled' }; }
        return r;
      }
      mutate((x) => {
        x.sync[s.careerId] = { at: Date.now() };
        const ids = Object.keys(x.sync).sort((a, b) => (x.sync[b].at || 0) - (x.sync[a].at || 0));
        for (const k of ids.slice(20)) delete x.sync[k];
        for (const code of Object.keys(x.cache)) x.cache[code].at = 0;   // tables are out of date now
      });
      return { ok: true, updated: Number(r.updated) || 0 };
    } catch { return fail('server'); }
  })().finally(() => { syncing = null; });
  return syncing;
}

/** Leave a league (every career of this device in it). The local entry goes away even when offline-safe calls fail with not_found. */
export async function leaveLeague(code) {
  try {
    const c = normCode(code);
    if (!c) return fail('bad_code');
    const r = await call('fl_leave', { p_code: c, p_device: device(), p_career: null });
    if (!r.ok && r.error !== 'not_found') return r;
    mutate((st) => dropLocal(st, c));
    return { ok: true, deleted: r.deleted === true, ownerMoved: r.owner_moved === true };
  } catch { return fail('server'); }
}
export async function ownerRename(code, name) {
  try {
    const c = normCode(code);
    if (!c) return fail('bad_code');
    const bad = checkLeagueName(name);
    if (bad) return fail(bad);
    const r = await call('fl_rename', { p_code: c, p_device: device(), p_name: cleanText(name, NAME_MAX) });
    if (!r.ok) return r;
    const nameHe = cleanText(r.name, NAME_MAX);
    mutate((st) => {
      const l = st.leagues.find((x) => x.code === c);
      if (l) l.nameHe = nameHe;
      if (st.cache[c]) st.cache[c].data.nameHe = nameHe;
    });
    return { ok: true, nameHe };
  } catch { return fail('server'); }
}
export async function ownerRemove(code, memberHash) {
  try {
    const c = normCode(code);
    if (!c) return fail('bad_code');
    if (!/^[0-9a-f]{10}$/.test(String(memberHash || ''))) return fail('not_member');
    const r = await call('fl_remove', { p_code: c, p_device: device(), p_member: memberHash });
    if (!r.ok) return r;
    mutate((st) => {
      const e = st.cache[c];
      if (e && e.data && Array.isArray(e.data.members)) {
        e.data.members = e.data.members.filter((m) => m.hash !== memberHash).map((m, i) => ({ ...m, rank: i + 1 }));
        e.data.count = e.data.members.length;
      }
    });
    return { ok: true, removed: Number(r.removed) || 1 };
  } catch { return fail('server'); }
}

// ---------- notices (hub): compare the last seen table with the latest fetched one ----------
function seenOf(L) {
  const ranks = {};
  const names = {};
  for (const m of L.members || []) { ranks[m.hash] = m.rank; names[m.hash] = m.name; }
  const me = (L.members || []).filter((m) => m.isMe).map((m) => m.hash);
  return { at: Date.now(), ranks, names, me, count: L.count || (L.members || []).length };
}
/** The user looked at the table: the latest table becomes the notices baseline. */
export function markSeen(code, league) {
  try {
    const c = normCode(code);
    if (!c) return;
    mutate((st) => {
      const L = league && league.members ? league : (st.cache[c] && st.cache[c].data);
      if (L && st.leagues.some((x) => x.code === c)) st.seen[c] = seenOf(L);
    });
  } catch { /* ignore */ }
}
/** Mark every league's latest table as seen (the user dismissed the notices). */
export function markAllSeen() {
  try { mutate((st) => { for (const c of Object.keys(st.cache)) if (st.cache[c].data) st.seen[c] = seenOf(st.cache[c].data); }); } catch { /* ignore */ }
}
/**
 * Pure: what changed between a seen baseline and a newer table.
 * -> [{kind:'overtaken', name, gender, rank}, {kind:'top'}, {kind:'up', rank}, {kind:'joined', name, gender}, {kind:'king', name, gender, weekGoals}]
 */
export function diffLeague(seen, L) {
  const out = [];
  if (!seen || !L || !Array.isArray(L.members)) return out;
  const mine = L.members.filter((m) => m.isMe);
  if (!mine.length) return out;
  const best = mine.reduce((a, b) => (b.rank < a.rank ? b : a));
  const prevRanks = mine.map((m) => seen.ranks && seen.ranks[m.hash]).filter((x) => Number.isFinite(x));
  const prevBest = prevRanks.length ? Math.min(...prevRanks) : null;
  if (prevBest != null) {
    for (const m of L.members) {
      if (m.isMe) continue;
      const was = seen.ranks ? seen.ranks[m.hash] : undefined;
      if (Number.isFinite(was) && was > prevBest && m.rank < best.rank) out.push({ kind: 'overtaken', name: m.name, gender: m.gender, rank: m.rank });
    }
    if (best.rank === 1 && prevBest > 1) out.push({ kind: 'top' });
    else if (best.rank < prevBest) out.push({ kind: 'up', rank: best.rank });
  }
  for (const m of L.members) {
    if (m.isMe || !seen.ranks || m.hash in seen.ranks) continue;
    out.push({ kind: 'joined', name: m.name, gender: m.gender });
  }
  return out;
}
/** [{code, nameHe, changes: diffLeague(...)}] for every cached league of mine (sync, never throws). */
export function leagueChanges() {
  try {
    const st = load();
    const out = [];
    for (const l of st.leagues) {
      const e = st.cache[l.code];
      if (!e || !e.data) continue;
      const changes = diffLeague(st.seen[l.code], e.data);
      if (changes.length) out.push({ code: l.code, nameHe: e.data.nameHe || l.nameHe, changes });
    }
    return out;
  } catch { return []; }
}

/** Test helper: forget everything stored by this module. */
export function _resetLocal() { try { const s = ls(); if (s) s.removeItem(K); } catch { /* ignore */ } }

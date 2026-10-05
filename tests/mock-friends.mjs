// tests/mock-friends.mjs - in-memory mirror of supabase/update-2.3-friends.sql (ליגת חברים), zero dependencies.
// Works in Node AND in the browser (no node: imports), so a test page can also use it directly as a transport:
//   import { createFriendsMock } from '../tests/mock-friends.mjs';
//   const fm = createFriendsMock();  friends._setTransport((name, args) => fm.call(name, args));
// Plug-in for tests/mock-supabase.mjs (same handler style: rpcs[name](args, user) -> json):
//   import { addFriendsRoutes, FRIENDS_ADMIN_RPCS } from './mock-friends.mjs';
//   const friends = addFriendsRoutes(rpcs);           // after `const rpcs = {...}` in createMockSupabase()
//   FRIENDS_ADMIN_RPCS.forEach((n) => ADMIN_RPCS.add(n));
//   reset(): friends.reset();   /__mock/state: { ...db, friends: friends.db }   schema '2.3' hides FRIENDS_RPCS below it
// Mirrors: limits (10 owned leagues per device, 5 new per hour, 50 members, 3 careers per device per league,
// 30 memberships per device), the 10 s fl_sync limit, counters that never go down, week goals from the goals delta
// (Israeli week), owner hand-over on leave, owner-only rename / remove, no device ids in fl_get.
// Test helpers on the returned object: reset(), age(sec) (makes rows older: skips the rate limits), db.

export const FRIENDS_RPCS = new Set(['fl_create', 'fl_join', 'fl_sync', 'fl_get', 'fl_mine', 'fl_leave', 'fl_rename', 'fl_remove', 'admin_fl_overview']);
export const FRIENDS_ADMIN_RPCS = new Set(['admin_fl_overview']);

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const CAREER_RE = /^[A-Za-z0-9_-]{4,64}$/;
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STRIP_RE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g;

// ---- the SQL helpers ----
export function flClean(v, max = 30) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(STRIP_RE, '').replace(/\s+/g, ' ').trim();
  const cut = Array.from(s).slice(0, Math.max(1, max)).join('').trim();
  return cut || null;
}
const BAD_SUB_EN = /(fuck|fuk|phuck|shit|cunt|nigg|whore|slut|porn|bitch|pussy|penis|vagina|hitler|nazi|wank|bastard|asshole|dildo)/;
const BAD_SUB_HE = /(כוסאמ|כוסעמ|כוסאוחת|כוסאחת|כוסית|בנזונ|בןזונ|שרמוט|מזדיינ|מזדיין|לזיינ|לזיין|זיונים|מניאק|היטלר|נאצי|פורנו|קוקסינל|לאנוס|תמצוץ)/;
const BAD_WORDS = new Set(['זין', 'זיין', 'כוס', 'חרא', 'סקס', 'זונה', 'זונות', 'זיון', 'אנס', 'ass', 'sex', 'dick', 'cock', 'fag', 'tits', 'xxx', 'kkk', 'rape']);
const BAD_PREFIXED = new Set(['זונה', 'זונות', 'זיון', 'זיונים', 'חרא', 'סקס']);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', '@': 'a', $: 's', 5: 's', '!': 'i', '|': 'i' };
export function flBad(v) {
  const low = String(v == null ? '' : v).toLowerCase().replace(/[0134@$5!|]/g, (c) => LEET[c] || c);
  const compact = low.replace(/[^a-zא-ת]/g, '');
  if (BAD_SUB_EN.test(compact) || BAD_SUB_HE.test(compact)) return true;
  return low.replace(/[^a-zא-ת]+/g, ' ').trim().split(' ').some((t) => BAD_WORDS.has(t)
    || (t.length >= 4 && 'הובלמשכ'.includes(t[0]) && BAD_PREFIXED.has(t.slice(1))));
}
function flInt(v, lo, hi) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;
}
export function flNormCode(v) {
  const c = String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z2-9]{6,8}$/.test(c) ? c : null;
}
function randomBytes(n) {
  const b = new Uint8Array(n);
  try { globalThis.crypto.getRandomValues(b); } catch { for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256); }
  return b;
}
function newCode(len) {
  return Array.from(randomBytes(len), (x) => ABC[x & 31]).join('');
}
function fnvHex(s) {
  // two FNV-1a passes -> 10 hex chars (the SQL uses md5; only the shape matters to the client)
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0; }
  return (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).slice(0, 10);
}
const flHash = (code, dev, car) => fnvHex(code + '|' + dev + '|' + car);
/** public.hy_fl_week(): Israeli week (Sunday..Saturday): ISO week of (Jerusalem date + 1 day). */
export function flWeek(ms = Date.now()) {
  let ymd;
  try { ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch { ymd = new Date(ms).toISOString().slice(0, 10); }
  const d = new Date(Date.parse(ymd + 'T12:00:00Z') + 86400000);
  const day = (d.getUTCDay() + 6) % 7;            // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3);          // the Thursday of this ISO week
  const isoYear = d.getUTCFullYear();
  const week = 1 + Math.floor((d - Date.UTC(isoYear, 0, 1)) / (7 * 86400000));
  return isoYear + '-W' + String(week).padStart(2, '0');
}
function flSummary(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  let size = 0;
  try { size = JSON.stringify(s).length; } catch { return null; }
  if (size > 4096) return null;
  const raw = flClean(s.name, 30);
  if (!raw) return null;
  const gender = ['f', 'female', 'girl', 'w'].includes(String(s.gender || '').toLowerCase()) ? 'f' : 'm';
  const bad = flBad(raw);
  let club = flClean(s.clubHe != null ? s.clubHe : s.club_he, 60);
  const badc = !!club && flBad(club);
  if (badc) club = null;
  const nation = String(s.nation == null ? '' : s.nation).toLowerCase();
  const clubId = String(s.clubId != null ? s.clubId : s.club_id != null ? s.club_id : s.club != null ? s.club : '').toLowerCase();
  return {
    name: bad ? (gender === 'f' ? 'שחקנית מהשכונה' : 'שחקן מהשכונה') : raw, flagged: bad || badc, gender,
    nation: /^[a-z0-9_]{2,8}$/.test(nation) ? nation : null, club_id: /^[a-z0-9_]{1,24}$/.test(clubId) ? clubId : null, club_he: club,
    ovr: flInt(s.ovr, 0, 99), goals: flInt(s.goals, 0, 5000), trophies: flInt(s.trophies, 0, 500), ballon: flInt(s.ballon, 0, 50), legacy: flInt(s.legacy, 0, 1000000),
  };
}
const err = (error) => ({ ok: false, error });
const iso = (ms) => new Date(ms).toISOString();

/**
 * createFriendsMock({ now }) -> { rpcs, call(name, args, user), db, reset(), age(sec) }
 * rpcs: { fl_create, fl_join, fl_sync, fl_get, fl_mine, fl_leave, fl_rename, fl_remove, admin_fl_overview }
 * call() answers like PostgREST: unknown RPC -> throws {status:404, code:'PGRST202'}; admin without isAdmin -> {status:403}.
 */
export function createFriendsMock({ now = () => Date.now() } = {}) {
  let db;
  function reset() { db = { leagues: [], members: [] }; }
  reset();
  const t = () => now();
  const membersOf = (code) => db.members.filter((m) => m.code === code);
  const leagueOf = (code) => db.leagues.find((l) => l.code === code) || null;

  function applySummary(m, s, wk) {
    m.week_goals = (m.week_key === wk ? m.week_goals : 0) + Math.min(Math.max(s.goals - m.goals, 0), 200);
    m.week_key = wk;
    Object.assign(m, {
      name: s.name, flagged: s.flagged, gender: s.gender, nation: s.nation || m.nation, club_id: s.club_id, club_he: s.club_he, ovr: s.ovr,
      goals: Math.max(m.goals, s.goals), trophies: Math.max(m.trophies, s.trophies), ballon: Math.max(m.ballon, s.ballon), legacy: Math.max(m.legacy, s.legacy),
      updated_at: iso(t()),
    });
  }

  const rpcs = {
    fl_create(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      if (!ID_RE.test(dev)) return err('bad_device');
      const name = flClean(a.p_name, 24);
      if (!name || Array.from(name).length < 2 || flBad(name)) return err('bad_name');
      if (db.leagues.filter((l) => l.owner_device === dev).length >= 10) return err('too_many');
      if (db.leagues.filter((l) => l.owner_device === dev && Date.parse(l.created_at) > t() - 3600000).length >= 5) return err('rate_limited');
      if (db.leagues.filter((l) => Date.parse(l.created_at) > t() - 60000).length >= 120) return err('busy');
      let code = null;
      for (let i = 1; i <= 12 && !code; i++) { const c = newCode(i <= 4 ? 6 : i <= 8 ? 7 : 8); if (!leagueOf(c)) code = c; }
      if (!code) return err('busy');
      db.leagues.push({ code, name, owner_device: dev, created_at: iso(t()), renamed_at: null });
      let join = null;
      if (a.p_career != null && a.p_summary != null) join = rpcs.fl_join({ p_code: code, p_device: dev, p_career: a.p_career, p_summary: a.p_summary });
      return { ok: true, code, name, joined: !!(join && join.ok), join_error: join && !join.ok ? join.error : null };
    },

    fl_join(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      const car = String(a.p_career == null ? '' : a.p_career);
      if (!ID_RE.test(dev)) return err('bad_device');
      if (!CAREER_RE.test(car)) return err('bad_career');
      const code = flNormCode(a.p_code);
      if (!code) return err('bad_code');
      const s = flSummary(a.p_summary);
      if (!s) return err('bad_summary');
      const lg = leagueOf(code);
      if (!lg) return err('not_found');
      const wk = flWeek(t());
      const cur = db.members.find((m) => m.code === code && m.device_id === dev && m.career_id === car);
      if (cur) {
        applySummary(cur, s, wk);
        return { ok: true, code, name: lg.name, members: membersOf(code).length, already: true, owner: lg.owner_device === dev };
      }
      if (membersOf(code).length >= 50) return err('full');
      if (membersOf(code).filter((m) => m.device_id === dev).length >= 3) return err('too_many');
      if (db.members.filter((m) => m.device_id === dev).length >= 30) return err('too_many');
      db.members.push({ code, device_id: dev, career_id: car, ...s, week_goals: 0, week_key: wk, joined_at: iso(t()), updated_at: iso(t()) });
      return { ok: true, code, name: lg.name, members: membersOf(code).length, already: false, owner: lg.owner_device === dev };
    },

    fl_sync(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      const car = String(a.p_career == null ? '' : a.p_career);
      if (!ID_RE.test(dev)) return err('bad_device');
      if (!CAREER_RE.test(car)) return err('bad_career');
      const s = flSummary(a.p_summary);
      if (!s) return err('bad_summary');
      const rows = db.members.filter((m) => m.device_id === dev && m.career_id === car);
      if (rows.some((m) => Date.parse(m.updated_at) > t() - 10000)) return err('rate_limited');
      const wk = flWeek(t());
      for (const m of rows) applySummary(m, s, wk);
      return { ok: true, updated: rows.length };
    },

    fl_get(a) {
      const code = flNormCode(a.p_code);
      if (!code) return err('bad_code');
      const dev = ID_RE.test(String(a.p_device || '')) ? String(a.p_device) : null;
      const lg = leagueOf(code);
      if (!lg) return err('not_found');
      const wk = flWeek(t());
      const rows = membersOf(code)
        .map((m) => ({ m, wg: m.week_key === wk ? m.week_goals : 0 }))
        .sort((x, y) => (y.m.legacy - x.m.legacy) || (y.m.trophies - x.m.trophies) || (y.m.goals - x.m.goals) || (y.m.ovr - x.m.ovr)
          || (Date.parse(x.m.joined_at) - Date.parse(y.m.joined_at)) || (x.m.career_id < y.m.career_id ? -1 : x.m.career_id > y.m.career_id ? 1 : 0));
      const members = rows.map(({ m, wg }, i) => ({
        rank: i + 1, hash: flHash(code, m.device_id, m.career_id), name: m.name, gender: m.gender, nation: m.nation, club_id: m.club_id, club_he: m.club_he,
        ovr: m.ovr, goals: m.goals, trophies: m.trophies, ballon: m.ballon, legacy: m.legacy, week_goals: wg,
        me: !!dev && m.device_id === dev, owner: m.device_id === lg.owner_device, updated_at: m.updated_at,
      }));
      const kingRow = members.filter((x) => x.week_goals > 0).sort((x, y) => (y.week_goals - x.week_goals) || (x.rank - y.rank))[0] || null;
      return {
        ok: true, code, name: lg.name, created_at: lg.created_at, count: members.length, max: 50, week_key: wk,
        is_owner: !!dev && lg.owner_device === dev, is_member: members.some((x) => x.me), generated_at: iso(t()), members,
        week_king: kingRow ? { hash: kingRow.hash, name: kingRow.name, gender: kingRow.gender, week_goals: kingRow.week_goals, me: kingRow.me } : null,
      };
    },

    fl_mine(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      if (!ID_RE.test(dev)) return err('bad_device');
      const leagues = db.leagues
        .filter((l) => l.owner_device === dev || db.members.some((m) => m.code === l.code && m.device_id === dev))
        .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at))
        .map((l) => {
          const mine = db.members.filter((m) => m.code === l.code && m.device_id === dev).sort((x, y) => Date.parse(y.updated_at) - Date.parse(x.updated_at));
          return { code: l.code, name: l.name, role: l.owner_device === dev ? 'owner' : 'member', career_id: mine.length ? mine[0].career_id : null, members: membersOf(l.code).length };
        });
      return { ok: true, leagues };
    },

    fl_leave(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      if (!ID_RE.test(dev)) return err('bad_device');
      const code = flNormCode(a.p_code);
      if (!code) return err('bad_code');
      const lg = leagueOf(code);
      if (!lg) return { ok: true, removed: 0, deleted: false, owner_moved: false };
      const car = a.p_career == null ? null : String(a.p_career);
      const before = db.members.length;
      db.members = db.members.filter((m) => !(m.code === code && m.device_id === dev && (car === null || m.career_id === car)));
      const removed = before - db.members.length;
      const del = () => { db.leagues = db.leagues.filter((l) => l.code !== code); db.members = db.members.filter((m) => m.code !== code); };
      if (lg.owner_device === dev && (car === null || !db.members.some((m) => m.code === code && m.device_id === dev))) {
        const next = membersOf(code).filter((m) => m.device_id !== dev)
          .sort((x, y) => (Date.parse(x.joined_at) - Date.parse(y.joined_at)) || (x.career_id < y.career_id ? -1 : 1))[0];
        if (!next) { del(); return { ok: true, removed, deleted: true, owner_moved: false }; }
        lg.owner_device = next.device_id;
        return { ok: true, removed, deleted: false, owner_moved: true };
      }
      if (!membersOf(code).length) { del(); return { ok: true, removed, deleted: true, owner_moved: false }; }
      return { ok: true, removed, deleted: false, owner_moved: false };
    },

    fl_rename(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      if (!ID_RE.test(dev)) return err('bad_device');
      const code = flNormCode(a.p_code);
      if (!code) return err('bad_code');
      const lg = leagueOf(code);
      if (!lg) return err('not_found');
      if (lg.owner_device !== dev) return err('not_owner');
      const name = flClean(a.p_name, 24);
      if (!name || Array.from(name).length < 2 || flBad(name)) return err('bad_name');
      lg.name = name;
      lg.renamed_at = iso(t());
      return { ok: true, code, name };
    },

    fl_remove(a) {
      const dev = String(a.p_device == null ? '' : a.p_device);
      if (!ID_RE.test(dev)) return err('bad_device');
      const code = flNormCode(a.p_code);
      if (!code) return err('bad_code');
      const hash = String(a.p_member == null ? '' : a.p_member);
      if (!/^[0-9a-f]{10}$/.test(hash)) return err('bad_member');
      const lg = leagueOf(code);
      if (!lg) return err('not_found');
      if (lg.owner_device !== dev) return err('not_owner');
      if (db.members.some((m) => m.code === code && m.device_id === dev && flHash(code, m.device_id, m.career_id) === hash)) return err('self');
      const before = db.members.length;
      db.members = db.members.filter((m) => !(m.code === code && m.device_id !== dev && flHash(code, m.device_id, m.career_id) === hash));
      const removed = before - db.members.length;
      return removed ? { ok: true, removed } : err('not_member');
    },

    // the admin check itself happens in the server wrapper (mock-supabase ADMIN_RPCS / call(..., {isAdmin}))
    admin_fl_overview() {
      const week = t() - 7 * 86400000;
      const sizes = db.leagues.map((l) => {
        const ms = membersOf(l.code);
        const last = ms.reduce((x, m) => Math.max(x, Date.parse(m.updated_at)), 0);
        return { code: l.code, name: l.name, members: ms.length, created_at: l.created_at, last_active: last ? iso(last) : null };
      });
      const nonEmpty = sizes.filter((x) => x.members > 0);
      return {
        generated_at: iso(t()), leagues: db.leagues.length, members: db.members.length,
        devices: new Set(db.members.map((m) => m.device_id)).size, owners: new Set(db.leagues.map((l) => l.owner_device)).size,
        created_7d: db.leagues.filter((l) => Date.parse(l.created_at) > week).length,
        joins_7d: db.members.filter((m) => Date.parse(m.joined_at) > week).length,
        active_7d: sizes.filter((x) => x.last_active && Date.parse(x.last_active) > week).length,
        empty: sizes.filter((x) => x.members === 0).length, full: sizes.filter((x) => x.members >= 50).length,
        avg_members: nonEmpty.length ? Math.round((nonEmpty.reduce((x, y) => x + y.members, 0) / nonEmpty.length) * 10) / 10 : 0,
        flagged: db.members.filter((m) => m.flagged).length,
        top: sizes.slice().sort((x, y) => (y.members - x.members) || (Date.parse(y.last_active || 0) - Date.parse(x.last_active || 0))).slice(0, 10),
      };
    },
  };

  /** PostgREST-like call: JSON round trip (like the wire), 404 for unknown RPCs, 403 for admin RPCs without isAdmin. */
  async function call(name, args = {}, { isAdmin = false } = {}) {
    const fn = rpcs[name];
    if (!fn) { const e = new Error('Could not find the function public.' + name); e.status = 404; e.code = 'PGRST202'; throw e; }
    if (FRIENDS_ADMIN_RPCS.has(name) && !isAdmin) { const e = new Error('forbidden'); e.status = 403; e.code = '42501'; throw e; }
    const a = JSON.parse(JSON.stringify(args && typeof args === 'object' ? args : {}));
    return JSON.parse(JSON.stringify(fn(a)));
  }

  /** Make every row older by sec seconds (skips the 10 s sync / 1 h create limits in tests). */
  function age(sec = 60) {
    const d = sec * 1000;
    for (const l of db.leagues) l.created_at = iso(Date.parse(l.created_at) - d);
    for (const m of db.members) { m.updated_at = iso(Date.parse(m.updated_at) - d); m.joined_at = iso(Date.parse(m.joined_at) - d); }
  }

  return { rpcs, call, reset, age, get db() { return db; } };
}

/**
 * Plug the fl_* handlers into an existing mock-supabase `rpcs` map (same signature: fn(args, user) -> json).
 * -> the friends mock ({ reset, age, db, ... }) so the server can reset it and expose it in /__mock/state.
 */
export function addFriendsRoutes(rpcs, opts = {}) {
  const fm = createFriendsMock(opts);
  for (const [name, fn] of Object.entries(fm.rpcs)) rpcs[name] = (args) => fn(args && typeof args === 'object' ? args : {});
  return fm;
}

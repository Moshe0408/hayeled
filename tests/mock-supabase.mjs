// tests/mock-supabase.mjs - zero-dependency in-memory Supabase mock (SPEC §8.8).
// Usage: node tests/mock-supabase.mjs [port=54321] [--admin admin@test.local:test1234]
// Implements the exact endpoints used by js/core/*.js and js/admin/*.js:
//   OPTIONS *                                   -> 204 + CORS
//   POST /auth/v1/token?grant_type=password|refresh_token
//   POST /auth/v1/logout,  GET /auth/v1/user
//   GET  /rest/v1/app_config?select=...
//   POST /rest/v1/rpc/{heartbeat|track_events|submit_feedback|admin_whoami|admin_stats|
//                      admin_feedback|admin_mark_read|admin_get_config|admin_set_config}
// Test helpers:
//   GET  /__mock/state   -> { devices, sessions, events, feedback, app_config }
//   POST /__mock/reset   -> clears everything, re-seeds app_config (ads disabled)
//   POST /__mock/fail    -> body {"on":true|false}: make every /rest and /auth call answer 503 (simulate outage)
// Users: the admin (default admin@test.local / test1234) and a non-admin player@test.local / test1234.
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve as pathResolve } from 'node:path';

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const NAME_RE = /^[a-z_]{2,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONFIG_KEYS = ['ads', 'announcement', 'version', 'feedback'];

function defaultConfigRows() {
  const now = new Date().toISOString();
  return [
    { key: 'ads', value: {
      enabled: false, provider: 'none',
      placements: {
        hub_banner: { enabled: true },
        interstitial: { enabled: true, everyMatchdays: 4, minMinutesBetween: 3, skipFirstMinutes: 10 },
        rewarded: { enabled: false, maxPerDay: 3, energy: 15 },
      },
      house: [],
      adsense: { client: '', slots: { hub_banner: '', interstitial: '' } },
    }, updated_at: now, updated_by: null },
    { key: 'announcement', value: { enabled: false, id: '', textHe: '', link: '', level: 'info' }, updated_at: now, updated_by: null },
    { key: 'version', value: { min: '0.0.0', latest: '0.0.0', messageHe: 'יש גרסה חדשה. רענן כדי לעדכן' }, updated_at: now, updated_by: null },
    { key: 'feedback', value: { enabled: true, prompt: true }, updated_at: now, updated_by: null },
  ];
}

function dayIn(tz, d) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
}

function topBy(list, keyFn, limit = 10) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (k === null || k === undefined || k === '') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function createMockSupabase({ admin = 'admin@test.local:test1234' } = {}) {
  const [adminEmail, adminPass] = String(admin).split(':');
  const users = new Map([
    [adminEmail.toLowerCase(), { id: randomUUID(), email: adminEmail, password: adminPass || 'test1234' }],
    ['player@test.local', { id: randomUUID(), email: 'player@test.local', password: 'test1234' }],
  ]);
  const admins = new Set([adminEmail.toLowerCase()]);
  const tokens = new Map();     // access_token -> { email, exp }
  const refreshes = new Map();  // refresh_token -> email
  let failMode = false;

  let db;
  let eventSeq;
  let feedbackSeq;
  function reset() {
    db = { devices: [], sessions: [], events: [], feedback: [], app_config: defaultConfigRows() };
    eventSeq = 0;
    feedbackSeq = 0;
  }
  reset();

  const findDevice = (id) => db.devices.find((d) => d.id === id);
  function upsertDevice(id, meta) {
    const now = new Date();
    let d = findDevice(id);
    if (!d) {
      d = { id, first_seen: now.toISOString(), last_seen: now.toISOString(), platform: null, standalone: false, app_version: null,
        installed_at: null, rate_window: now.toISOString(), rate_count: 0, feedback_day: null, feedback_count: 0 };
      db.devices.push(d);
    } else d.last_seen = now.toISOString();
    if (meta) {
      if (meta.platform != null) d.platform = meta.platform;
      if (meta.standalone != null) d.standalone = meta.standalone;
      if (meta.app_version != null) d.app_version = meta.app_version;
    }
    return d;
  }

  function issueSession(user) {
    const access_token = 'mock-at-' + randomBytes(16).toString('hex');
    const refresh_token = 'mock-rt-' + randomBytes(16).toString('hex');
    const expires_in = 3600;
    const expires_at = Math.floor(Date.now() / 1000) + expires_in;
    tokens.set(access_token, { email: user.email, exp: expires_at });
    refreshes.set(refresh_token, user.email);
    return { access_token, token_type: 'bearer', expires_in, expires_at, refresh_token, user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated' } };
  }

  function bearerUser(req) {
    const h = String(req.headers.authorization || '');
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return null;
    const t = tokens.get(m[1]);
    if (!t) return null;
    if (t.exp < Math.floor(Date.now() / 1000)) return null;
    return users.get(t.email.toLowerCase()) || null;
  }

  // ---------- RPC implementations (mirror supabase/schema.sql) ----------
  const rpcs = {
    heartbeat(args) {
      const { p_device, p_session } = args;
      let meta = args.p_meta && typeof args.p_meta === 'object' && !Array.isArray(args.p_meta) ? args.p_meta : {};
      if (!ID_RE.test(String(p_device || '')) || !ID_RE.test(String(p_session || ''))) return { ok: false };
      if (JSON.stringify(meta).length > 1024) meta = {};
      const platform = meta.platform != null ? String(meta.platform).slice(0, 16) : null;
      const app_version = meta.v != null ? String(meta.v).slice(0, 20) : null;
      const standalone = typeof meta.standalone === 'boolean' ? meta.standalone : false;
      upsertDevice(p_device, { platform, standalone, app_version });
      const now = new Date();
      let s = db.sessions.find((x) => x.id === p_session);
      if (!s) {
        db.sessions.push({ id: p_session, device_id: p_device, started_at: now.toISOString(), last_seen: now.toISOString(), heartbeats: 1, app_version, standalone });
      } else if (s.device_id === p_device && Date.parse(s.last_seen) < now.getTime() - 20000) {
        s.last_seen = now.toISOString();
        s.heartbeats += 1;
      }
      return { ok: true, server_time: now.toISOString() };
    },

    track_events(args) {
      const { p_device, p_session, p_events } = args;
      if (!ID_RE.test(String(p_device || '')) || !ID_RE.test(String(p_session || '')) || !Array.isArray(p_events)) {
        return { accepted: 0, dropped: Array.isArray(p_events) ? p_events.length : 0 };
      }
      const d = upsertDevice(p_device);
      const now = Date.now();
      if (Date.parse(d.rate_window) < now - 3600000) { d.rate_window = new Date(now).toISOString(); d.rate_count = 0; }
      const allowed = Math.max(0, Math.min(50, 600 - d.rate_count));
      let accepted = 0;
      let dropped = 0;
      p_events.forEach((e, i) => {
        if (i >= allowed) { dropped++; return; }
        if (!e || typeof e !== 'object' || Array.isArray(e)) { dropped++; return; }
        const name = e.n;
        if (typeof name !== 'string' || !NAME_RE.test(name)) { dropped++; return; }
        let props = e.p && typeof e.p === 'object' && !Array.isArray(e.p) ? e.p : {};
        if (Buffer.byteLength(JSON.stringify(props)) > 2048) { dropped++; return; }
        let ts = Date.parse(e.t);
        if (!Number.isFinite(ts)) ts = now;
        ts = Math.min(Math.max(ts, now - 7 * 86400000), now + 3600000);
        const sid = typeof e.s === 'string' && ID_RE.test(e.s) ? e.s : p_session;
        db.events.push({ id: ++eventSeq, device_id: p_device, session_id: sid, name, props, client_ts: new Date(ts).toISOString(), created_at: new Date().toISOString() });
        accepted++;
        if (name === 'install' && !d.installed_at) d.installed_at = new Date().toISOString();
      });
      d.rate_count += Math.min(p_events.length, allowed);
      return { accepted, dropped };
    },

    submit_feedback(args) {
      const rating = Number(args.p_rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'bad_rating' };
      const dev = String(args.p_device || '');
      if (!ID_RE.test(dev)) return { ok: false, error: 'bad_device' };
      const msg = String(args.p_message == null ? '' : args.p_message).trim().slice(0, 2000);
      let email = String(args.p_email == null ? '' : args.p_email).trim() || null;
      if (email && (email.length > 200 || !EMAIL_RE.test(email))) email = null;
      let ctx = args.p_context && typeof args.p_context === 'object' && !Array.isArray(args.p_context) ? args.p_context : {};
      if (Buffer.byteLength(JSON.stringify(ctx)) > 2048) ctx = {};
      const d = upsertDevice(dev);
      const today = dayIn('Asia/Jerusalem', new Date());
      if (d.feedback_day !== today) { d.feedback_day = today; d.feedback_count = 0; }
      if (d.feedback_count >= 5) return { ok: false, error: 'rate_limited' };
      d.feedback_count += 1;
      const row = { id: ++feedbackSeq, device_id: dev, rating, message: msg || null, email, context: ctx,
        app_version: ctx.v != null ? String(ctx.v).slice(0, 20) : null, is_read: false, created_at: new Date().toISOString() };
      db.feedback.push(row);
      return { ok: true, id: row.id };
    },

    admin_whoami(args, user) {
      return { is_admin: !!user && admins.has(user.email.toLowerCase()), email: user ? user.email : null };
    },

    admin_stats(args) {
      const days = Math.min(Math.max(Number.isFinite(Number(args.p_days)) ? Math.trunc(Number(args.p_days)) : 30, 1), 365);
      const tz = typeof args.p_tz === 'string' && args.p_tz ? args.p_tz : 'Asia/Jerusalem';
      const now = Date.now();
      const today = dayIn(tz, new Date(now));
      const within = (iso, ms) => Date.parse(iso) > now - ms;
      const DAY = 86400000;
      const distinct = (arr) => new Set(arr).size;

      const dayList = [];
      for (let i = days - 1; i >= 0; i--) {
        // walk back by calendar days in tz: use noon-anchored dates to avoid DST edges
        const base = new Date(today + 'T12:00:00Z').getTime() - i * DAY;
        dayList.push(new Date(base).toISOString().slice(0, 10));
      }
      const newCounts = new Map();
      for (const d of db.devices) {
        const k = dayIn(tz, new Date(d.first_seen));
        newCounts.set(k, (newCounts.get(k) || 0) + 1);
      }
      const active = new Map();
      for (const s of db.sessions) {
        for (const k of new Set([dayIn(tz, new Date(s.started_at)), dayIn(tz, new Date(s.last_seen))])) {
          if (!active.has(k)) active.set(k, new Set());
          active.get(k).add(s.device_id);
        }
      }
      const todaySessions = db.sessions.filter((s) => dayIn(tz, new Date(s.started_at)) === today);
      const dur = (s) => (Date.parse(s.last_seen) - Date.parse(s.started_at)) / 1000;
      const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
      const ev = (name) => db.events.filter((e) => e.name === name);
      const ev7 = (name) => ev(name).filter((e) => within(e.created_at, 7 * DAY)).length;
      const careers = ev('career_started');
      const ratings = db.feedback.map((f) => f.rating);
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of ratings) dist[r] = (dist[r] || 0) + 1;
      const adEvents = db.events.filter((e) => e.name === 'ad_impression' || e.name === 'ad_click');
      const byPl = new Map();
      for (const e of adEvents) {
        const p = (e.props && e.props.placement) || '?';
        if (!byPl.has(p)) byPl.set(p, { placement: p, impressions: 0, clicks: 0 });
        if (e.name === 'ad_impression') byPl.get(p).impressions++; else byPl.get(p).clicks++;
      }

      return {
        generated_at: new Date(now).toISOString(),
        days,
        online_now: db.sessions.filter((s) => within(s.last_seen, 2 * 60000)).length,
        total_devices: db.devices.length,
        dau: distinct(db.sessions.filter((s) => within(s.last_seen, DAY)).map((s) => s.device_id)),
        wau: distinct(db.sessions.filter((s) => within(s.last_seen, 7 * DAY)).map((s) => s.device_id)),
        mau: distinct(db.sessions.filter((s) => within(s.last_seen, 30 * DAY)).map((s) => s.device_id)),
        new_per_day: dayList.map((day) => ({ day, count: newCounts.get(day) || 0 })),
        active_per_day: dayList.map((day) => ({ day, count: active.has(day) ? active.get(day).size : 0 })),
        sessions_today: todaySessions.length,
        avg_session_sec_today: avg(todaySessions.map(dur)),
        avg_session_sec_7d: avg(db.sessions.filter((s) => within(s.started_at, 7 * DAY)).map(dur)),
        installs_total: db.devices.filter((d) => d.installed_at).length,
        installs_7d: db.devices.filter((d) => d.installed_at && within(d.installed_at, 7 * DAY)).length,
        careers_started: careers.length,
        matches_played: ev('match_played').length,
        seasons_completed: ev('season_completed').length,
        retirements: ev('retired').length,
        transfers: ev('transfer').length,
        careers_7d: ev7('career_started'),
        matches_7d: ev7('match_played'),
        top_nations: topBy(careers, (e) => e.props && e.props.nation),
        top_positions: topBy(careers, (e) => e.props && e.props.position),
        top_clubs: topBy(careers, (e) => e.props && e.props.club),
        rating_avg: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0,
        rating_count: ratings.length,
        rating_dist: { '1': dist[1], '2': dist[2], '3': dist[3], '4': dist[4], '5': dist[5] },
        feedback_total: db.feedback.length,
        feedback_unread: db.feedback.filter((f) => !f.is_read).length,
        ads: {
          impressions_total: ev('ad_impression').length,
          clicks_total: ev('ad_click').length,
          impressions_7d: ev7('ad_impression'),
          clicks_7d: ev7('ad_click'),
          rewarded_7d: ev7('ad_rewarded'),
          by_placement: [...byPl.values()].sort((a, b) => b.impressions - a.impressions),
        },
        platforms: topBy(db.devices, (d) => d.platform || 'other'),
        versions: topBy(db.devices, (d) => d.app_version || '?'),
      };
    },

    admin_feedback(args) {
      const limit = Math.min(Math.max(Number.isFinite(Number(args.p_limit)) ? Math.trunc(Number(args.p_limit)) : 50, 1), 200);
      const offset = Math.max(Number.isFinite(Number(args.p_offset)) ? Math.trunc(Number(args.p_offset)) : 0, 0);
      const unreadOnly = args.p_unread_only === true;
      const list = db.feedback
        .filter((f) => !unreadOnly || !f.is_read)
        .sort((a, b) => (Date.parse(b.created_at) - Date.parse(a.created_at)) || (b.id - a.id));
      return {
        total: list.length,
        unread: db.feedback.filter((f) => !f.is_read).length,
        rows: list.slice(offset, offset + limit).map((f) => ({
          id: f.id, created_at: f.created_at, rating: f.rating, message: f.message, email: f.email,
          context: f.context, app_version: f.app_version, is_read: f.is_read, device_id: f.device_id,
        })),
      };
    },

    admin_mark_read(args) {
      const f = db.feedback.find((x) => x.id === Number(args.p_id));
      if (f) f.is_read = args.p_read === undefined || args.p_read === null ? true : !!args.p_read;
      return { ok: true };
    },

    admin_get_config() {
      const out = {};
      for (const r of db.app_config) out[r.key] = r.value;
      return out;
    },

    admin_set_config(args, user) {
      const { p_key, p_value } = args;
      if (!CONFIG_KEYS.includes(p_key) || !p_value || typeof p_value !== 'object' || Array.isArray(p_value)
          || Buffer.byteLength(JSON.stringify(p_value)) > 32768) {
        return { ok: false, error: 'bad_value' };
      }
      const at = new Date().toISOString();
      const row = db.app_config.find((r) => r.key === p_key);
      if (row) { row.value = p_value; row.updated_at = at; row.updated_by = user.email; }
      else db.app_config.push({ key: p_key, value: p_value, updated_at: at, updated_by: user.email });
      return { ok: true, key: p_key, updated_at: at };
    },
  };
  const ADMIN_RPCS = new Set(['admin_stats', 'admin_feedback', 'admin_mark_read', 'admin_get_config', 'admin_set_config']);
  const AUTH_RPCS = new Set(['admin_whoami']);

  // ---------- HTTP ----------
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, x-client-info',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '600',
  };
  function send(res, status, body) {
    const headers = { ...CORS, 'Cache-Control': 'no-store' };
    if (body === undefined || status === 204) { res.writeHead(status, headers); res.end(); return; }
    headers['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 512 * 1024) { reject(new Error('too_large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) return resolve({});
        try { resolve(JSON.parse(text)); } catch { reject(new Error('bad_json')); }
      });
      req.on('error', reject);
    });
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (req.method === 'OPTIONS') return send(res, 204);

    // test helpers (no apikey needed)
    if (path === '/__mock/state' && req.method === 'GET') return send(res, 200, db);
    if (path === '/__mock/reset' && req.method === 'POST') { reset(); failMode = false; return send(res, 200, { ok: true }); }
    if (path === '/__mock/fail' && req.method === 'POST') {
      const b = await readBody(req).catch(() => ({}));
      failMode = b.on !== false;
      return send(res, 200, { ok: true, fail: failMode });
    }
    if (path === '/' || path === '/__mock') return send(res, 200, { ok: true, name: 'mock-supabase' });

    if (!(path.startsWith('/rest/v1/') || path.startsWith('/auth/v1/'))) return send(res, 404, { code: 'PGRST000', message: 'not found' });
    if (!req.headers.apikey) return send(res, 401, { message: 'No API key found in request', hint: 'No `apikey` request header or url param was found.' });
    if (failMode) return send(res, 503, { code: 'http_503', message: 'mock outage' });

    // ---- auth ----
    if (path === '/auth/v1/token' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { code: 400, error_code: 'bad_json', msg: 'Could not parse request body as JSON' }); }
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = users.get(String(body.email || '').trim().toLowerCase());
        if (!u || u.password !== String(body.password || '')) {
          return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        }
        return send(res, 200, issueSession(u));
      }
      if (grant === 'refresh_token') {
        const email = refreshes.get(String(body.refresh_token || ''));
        if (!email) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        refreshes.delete(String(body.refresh_token));
        return send(res, 200, issueSession(users.get(email.toLowerCase())));
      }
      return send(res, 400, { code: 400, error_code: 'unsupported_grant_type', msg: 'unsupported grant_type' });
    }
    if (path === '/auth/v1/logout' && req.method === 'POST') {
      const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
      if (m) tokens.delete(m[1]);
      return send(res, 204);
    }
    if (path === '/auth/v1/user' && req.method === 'GET') {
      const u = bearerUser(req);
      if (!u) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      return send(res, 200, { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: new Date(0).toISOString() });
    }

    // ---- PostgREST: app_config select ----
    if (path === '/rest/v1/app_config' && req.method === 'GET') {
      const sel = (url.searchParams.get('select') || '*').split(',').map((s) => s.trim()).filter(Boolean);
      const rows = db.app_config.map((r) => {
        if (sel.includes('*')) return { ...r };
        const o = {};
        for (const k of sel) if (k in r) o[k] = r[k];
        return o;
      });
      return send(res, 200, rows);
    }
    if (path.startsWith('/rest/v1/') && !path.startsWith('/rest/v1/rpc/')) {
      // every other table is RLS-denied for anon/authenticated
      return send(res, 401, { code: '42501', message: 'permission denied for table ' + path.slice(9) });
    }

    // ---- PostgREST: RPC ----
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (m && req.method === 'POST') {
      const name = m[1];
      const fn = rpcs[name];
      if (!fn) return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.' + name + ' in the schema cache' });
      let args;
      try { args = await readBody(req); } catch { return send(res, 400, { code: 'PGRST102', message: 'Empty or invalid json' }); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) args = {};
      const user = bearerUser(req);
      if (ADMIN_RPCS.has(name) || AUTH_RPCS.has(name)) {
        if (!user) return send(res, 401, { code: '42501', message: 'permission denied for function ' + name });
        if (ADMIN_RPCS.has(name) && !admins.has(user.email.toLowerCase())) return send(res, 403, { code: '42501', message: 'forbidden' });
      }
      try {
        return send(res, 200, fn(args, user));
      } catch (e) {
        return send(res, 500, { code: 'XX000', message: String((e && e.message) || e) });
      }
    }
    return send(res, 404, { code: 'PGRST000', message: 'not found' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => { try { send(res, 500, { code: 'XX000', message: String((e && e.message) || e) }); } catch { /* ignore */ } });
  });
  return { server, reset, get db() { return db; } };
}

export function startMockSupabase({ port = 54321, admin } = {}) {
  const mock = createMockSupabase({ admin });
  return new Promise((resolve, reject) => {
    mock.server.once('error', reject);
    mock.server.listen(port, () => {
      console.log('mock-supabase listening on http://localhost:' + port);
      resolve(mock);
    });
  });
}

// CLI
const isMain = (() => {
  try { return !!process.argv[1] && pathResolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase(); } catch { return false; }
})();
if (isMain) {
  const argv = process.argv.slice(2);
  let port = 54321;
  let admin = 'admin@test.local:test1234';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--admin' && argv[i + 1]) { admin = argv[++i]; continue; }
    if (/^\d+$/.test(argv[i])) port = Number(argv[i]);
  }
  startMockSupabase({ port, admin }).catch((e) => { console.error('mock-supabase failed to start:', e.message); process.exit(1); });
}

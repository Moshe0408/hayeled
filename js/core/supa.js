// js/core/supa.js - minimal Supabase REST client over fetch() (SPEC §8.1). No supabase-js.
// Never touches the DOM. Safe to import in Node (no side effects at import time).
import { SUPABASE_URL, SUPABASE_ANON_KEY, BACKEND_ENABLED } from '../config.js';

const SESSION_KEY = 'hy.admin.session';

export function isEnabled() {
  return BACKEND_ENABLED;
}

export class SupaError extends Error {
  constructor(status, code, message) {
    super(message || code || ('http_' + status));
    this.name = 'SupaError';
    this.status = status;
    this.code = code || ('http_' + status);
  }
}

function headers(token) {
  const h = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  else if (typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SUPABASE_ANON_KEY;
  return h;
}

async function request(method, path, { body, token, keepalive = false, timeoutMs = 8000 } = {}) {
  if (!BACKEND_ENABLED) throw new SupaError(0, 'disabled', 'backend disabled');
  if (typeof fetch !== 'function') throw new SupaError(0, 'no_fetch', 'fetch unavailable');
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* ignore */ } }, timeoutMs) : null;
  let res;
  try {
    const init = { method, headers: headers(token), mode: 'cors', credentials: 'omit', cache: 'no-store' };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (keepalive) init.keepalive = true;
    if (ctrl) init.signal = ctrl.signal;
    res = await fetch(SUPABASE_URL + path, init);
  } catch (e) {
    const aborted = e && (e.name === 'AbortError');
    throw new SupaError(0, aborted ? 'timeout' : 'network', aborted ? 'timeout' : String((e && e.message) || 'network error'));
  } finally {
    if (timer) clearTimeout(timer);
  }
  let text = '';
  try { text = await res.text(); } catch { text = ''; }
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    let code = 'http_' + res.status;
    let msg = '';
    if (data && typeof data === 'object') {
      code = (typeof data.code === 'string' && data.code) || data.error_code || data.error || code;
      msg = data.message || data.msg || data.error_description || data.hint || '';
    } else if (typeof data === 'string') {
      msg = data.slice(0, 200);
    }
    throw new SupaError(res.status, String(code), String(msg || code));
  }
  return data;
}

export async function rpc(name, args = {}, { token, keepalive = false, timeoutMs = 8000 } = {}) {
  return request('POST', '/rest/v1/rpc/' + encodeURIComponent(name), { body: args || {}, token, keepalive, timeoutMs });
}

export async function select(table, query, { token, timeoutMs = 8000 } = {}) {
  const q = query ? ('?' + String(query).replace(/^\?/, '')) : '';
  const rows = await request('GET', '/rest/v1/' + encodeURIComponent(table) + q, { token, timeoutMs });
  return Array.isArray(rows) ? rows : [];
}

// ---- auth (admin.html only) ----

function lsGet(k) {
  try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { if (globalThis.localStorage) globalThis.localStorage.setItem(k, v); } catch { /* ignore */ }
}
function lsDel(k) {
  try { if (globalThis.localStorage) globalThis.localStorage.removeItem(k); } catch { /* ignore */ }
}

function toSession(data) {
  if (!data || typeof data !== 'object' || !data.access_token) throw new SupaError(0, 'bad_session', 'invalid auth response');
  const now = Math.floor(Date.now() / 1000);
  const expires_at = Number(data.expires_at) || (now + (Number(data.expires_in) || 3600));
  const user = data.user && typeof data.user === 'object' ? { id: String(data.user.id || ''), email: String(data.user.email || '') } : { id: '', email: '' };
  return { access_token: data.access_token, refresh_token: data.refresh_token || '', expires_at, user };
}

function storeSession(s) {
  if (s) lsSet(SESSION_KEY, JSON.stringify(s));
  else lsDel(SESSION_KEY);
}

let refreshing = null;

export const auth = {
  async signIn(email, password) {
    const data = await request('POST', '/auth/v1/token?grant_type=password', { body: { email: String(email || '').trim(), password: String(password || '') } });
    const s = toSession(data);
    storeSession(s);
    return s;
  },

  async refresh(refreshToken) {
    const data = await request('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } });
    const s = toSession(data);
    if (!s.user.email) {
      const old = auth.getSession();
      if (old && old.user) s.user = old.user;
    }
    storeSession(s);
    return s;
  },

  async signOut() {
    const s = auth.getSession();
    storeSession(null);
    if (s && s.access_token && BACKEND_ENABLED) {
      try { await request('POST', '/auth/v1/logout', { token: s.access_token, timeoutMs: 4000 }); } catch { /* best-effort */ }
    }
  },

  getSession() {
    const raw = lsGet(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object' && s.access_token) return s;
    } catch { /* ignore */ }
    return null;
  },

  async getValidToken() {
    const s = auth.getSession();
    if (!s) return null;
    const now = Math.floor(Date.now() / 1000);
    if (Number(s.expires_at) - now >= 60) return s.access_token;
    if (!s.refresh_token) { storeSession(null); return null; }
    if (!refreshing) {
      refreshing = auth.refresh(s.refresh_token)
        .then((ns) => ns.access_token)
        .catch((e) => {
          // a network failure keeps the session (retry later); an auth rejection drops it
          if (e && e.status >= 400 && e.status < 500) storeSession(null);
          return null;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  },
};

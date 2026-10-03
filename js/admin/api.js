// js/admin/api.js - admin RPC wrappers over supa.js (SPEC §8.7).
// 401 -> sign out; 403 -> refresh the token once and retry; still 403 -> sign out.
import { rpc, auth, SupaError } from '../core/supa.js';

export class AuthLostError extends Error {
  constructor(reason) {
    super(reason || 'auth_lost');
    this.name = 'AuthLostError';
    this.reason = reason || 'auth_lost';
  }
}

let onAuthLost = null;
/** Register the handler called after a forced sign-out (the router sends the user to #/login). */
export function setAuthLostHandler(fn) {
  onAuthLost = typeof fn === 'function' ? fn : null;
}

async function lose(reason) {
  try { await auth.signOut(); } catch { /* ignore */ }
  try { if (onAuthLost) onAuthLost(reason); } catch { /* ignore */ }
  return new AuthLostError(reason);
}

async function call(name, args = {}) {
  const token = await auth.getValidToken();
  if (!token) throw await lose('no_session');
  try {
    return await rpc(name, args, { token, timeoutMs: 15000 });
  } catch (e) {
    if (!(e instanceof SupaError)) throw e;
    if (e.status === 401) throw await lose('unauthorized');
    if (e.status === 403) {
      const s = auth.getSession();
      if (s && s.refresh_token) {
        let fresh = null;
        try { fresh = await auth.refresh(s.refresh_token); } catch (e2) {
          if (e2 instanceof SupaError && e2.status === 0) throw e2; // network: keep the session
          throw await lose('forbidden');
        }
        try {
          return await rpc(name, args, { token: fresh.access_token, timeoutMs: 15000 });
        } catch (e3) {
          if (e3 instanceof SupaError && (e3.status === 401 || e3.status === 403)) throw await lose('forbidden');
          throw e3;
        }
      }
      throw await lose('forbidden');
    }
    throw e;
  }
}

/** -> { ok:true, email } | { ok:false, error:'bad_credentials'|'not_admin'|'network'|'server', message } */
export async function login(email, password) {
  try {
    await auth.signIn(email, password);
  } catch (e) {
    if (e instanceof SupaError && e.status === 0) return { ok: false, error: 'network', message: e.message };
    if (e instanceof SupaError && (e.status === 400 || e.status === 401 || e.status === 422)) return { ok: false, error: 'bad_credentials', message: e.message };
    return { ok: false, error: 'server', message: (e && e.message) || String(e) };
  }
  try {
    const me = await whoami();
    if (!me || me.is_admin !== true) {
      await auth.signOut();
      return { ok: false, error: 'not_admin' };
    }
    return { ok: true, email: me.email || '' };
  } catch (e) {
    if (e instanceof AuthLostError) return { ok: false, error: 'not_admin' };
    if (e instanceof SupaError && e.status === 0) { await auth.signOut(); return { ok: false, error: 'network', message: e.message }; }
    await auth.signOut();
    return { ok: false, error: 'server', message: (e && e.message) || String(e) };
  }
}

export async function logout() {
  await auth.signOut();
}

export function currentEmail() {
  const s = auth.getSession();
  return (s && s.user && s.user.email) || '';
}

export function hasSession() {
  return !!auth.getSession();
}

export async function whoami() {
  // whoami must not trigger the 403-refresh loop: a non-admin legitimately gets is_admin:false
  const token = await auth.getValidToken();
  if (!token) throw new AuthLostError('no_session');
  try {
    return await rpc('admin_whoami', {}, { token, timeoutMs: 15000 });
  } catch (e) {
    if (e instanceof SupaError && (e.status === 401 || e.status === 403)) throw await lose('unauthorized');
    throw e;
  }
}

export function getStats(days = 30) {
  return call('admin_stats', { p_days: days, p_tz: 'Asia/Jerusalem' });
}

export function getFeedback({ limit = 50, offset = 0, unreadOnly = false } = {}) {
  return call('admin_feedback', { p_limit: limit, p_offset: offset, p_unread_only: !!unreadOnly });
}

export function markRead(id, read = true) {
  return call('admin_mark_read', { p_id: Number(id), p_read: !!read });
}

export function getConfig() {
  return call('admin_get_config', {});
}

export function setConfig(key, value) {
  return call('admin_set_config', { p_key: key, p_value: value });
}

// ---------- v2.1 (supabase/update-2.1.sql) ----------
// Every v2.1 call reports whether the update is installed: a missing function answers 404 / PGRST202.
let v21 = null;   // null = unknown, true = update-2.1.sql installed, false = not yet

/** True when the error means "this RPC does not exist on the server" (update-2.1.sql not run yet). */
export function isMissingFunction(e) {
  return e instanceof SupaError && (e.status === 404 || e.code === 'PGRST202');
}

/** Last known state of the 2.1 server update: null (unknown) | true | false. */
export function v21Status() {
  return v21;
}

async function callV21(name, args) {
  try {
    const r = await call(name, args);
    v21 = true;
    return r;
  } catch (e) {
    if (isMissingFunction(e)) v21 = false;
    throw e;
  }
}

/** -> stats object, or null when update-2.1.sql is not installed (other errors are thrown). */
export async function getStatsV2(days = 30) {
  try {
    return await callV21('admin_stats_v2', { p_days: days, p_tz: 'Asia/Jerusalem' });
  } catch (e) {
    if (isMissingFunction(e)) return null;
    throw e;
  }
}

/** Ask the server whether the 2.1 functions exist (re-checked on every call: the owner may run the SQL any time). */
export async function probeV21() {
  try { await getStatsV2(1); } catch { /* unknown stays null on network errors */ }
  return v21;
}

/** Feedback page. rating 1..5 filters exactly (v2.1 only; falls back to the 2.0 RPC when missing). */
export async function getFeedbackV2({ limit = 50, offset = 0, unreadOnly = false, rating = null } = {}) {
  try {
    return await callV21('admin_feedback_v2', { p_limit: limit, p_offset: offset, p_unread_only: !!unreadOnly, p_rating: rating || null });
  } catch (e) {
    if (!isMissingFunction(e)) throw e;
  }
  return getFeedback({ limit, offset, unreadOnly });
}

export function deleteFeedback(id) {
  return callV21('admin_delete_feedback', { p_id: Number(id) });
}

/** Wipes devices / sessions / events / feedback on the server. confirm must be exactly 'RESET'. */
export function resetStats(confirm) {
  return callV21('admin_reset_stats', { p_confirm: String(confirm || '') });
}

/** All feedback rows for the CSV export (pages of 200, capped at 10,000 rows). */
export async function fetchAllFeedback({ unreadOnly = false, rating = null } = {}) {
  const out = [];
  for (let offset = 0; offset < 10000; offset += 200) {
    const res = await getFeedbackV2({ limit: 200, offset, unreadOnly, rating });
    const rows = res && Array.isArray(res.rows) ? res.rows : [];
    out.push(...rows);
    if (rows.length < 200) break;
  }
  return out;
}

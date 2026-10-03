// js/core/feedback.js - player feedback (SPEC §8.3). Never throws; offline -> queued in 'hy.fb.q'.
import { BACKEND_ENABLED, FEEDBACK_ENABLED } from '../config.js';
import { rpc } from './supa.js';
import { getRemoteConfig } from './remote.js';
import { getDeviceId, track } from './telemetry.js';

const K_QUEUE = 'hy.fb.q';
const K_LAST = 'hy.fb.last';
const K_SENT = 'hy.fb.sent';
const K_DONE = 'hy.fb.done';
const QUEUE_CAP = 10;
const DAYS30 = 30 * 24 * 60 * 60 * 1000;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function lsGet(k) {
  try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { if (globalThis.localStorage) globalThis.localStorage.setItem(k, v); return true; } catch { return false; }
}
function lsDel(k) {
  try { if (globalThis.localStorage) globalThis.localStorage.removeItem(k); } catch { /* ignore */ }
}
function readJSON(k, d) {
  try { const v = JSON.parse(lsGet(k) || 'null'); return v == null ? d : v; } catch { return d; }
}

function readQueue() {
  const q = readJSON(K_QUEUE, []);
  return Array.isArray(q) ? q : [];
}
function writeQueue(q) {
  if (q.length > QUEUE_CAP) q = q.slice(q.length - QUEUE_CAP);
  if (!q.length) lsDel(K_QUEUE);
  else lsSet(K_QUEUE, JSON.stringify(q));
}

function cleanContext(ctx) {
  const out = {};
  if (!ctx || typeof ctx !== 'object') return out;
  for (const k of Object.keys(ctx).slice(0, 20)) {
    const v = ctx[k];
    if (typeof v === 'string') out[k] = v.slice(0, 80);
    else if (typeof v === 'number') out[k] = Number.isFinite(v) ? v : null;
    else if (typeof v === 'boolean' || v === null) out[k] = v;
  }
  return out;
}

export function isFeedbackAvailable() {
  try {
    return !!(BACKEND_ENABLED && FEEDBACK_ENABLED && getRemoteConfig().feedback.enabled);
  } catch {
    return false;
  }
}

async function send(item) {
  const res = await rpc('submit_feedback', {
    p_device: getDeviceId(),
    p_rating: item.rating,
    p_message: item.text,
    p_email: item.email || null,
    p_context: item.context || {},
  }, { timeoutMs: 8000 });
  return res && typeof res === 'object' ? res : { ok: false };
}

export async function submitFeedback({ rating, text, email, context } = {}) {
  try {
    if (!isFeedbackAvailable()) return { ok: false, queued: false, error: 'unavailable' };
    const r = Math.round(Number(rating));
    if (!(r >= 1 && r <= 5)) return { ok: false, queued: false, error: 'bad_rating' };
    const msg = String(text == null ? '' : text).trim().slice(0, 2000);
    let em = String(email == null ? '' : email).trim();
    if (em) {
      if (em.length > 200 || !EMAIL_RE.test(em)) return { ok: false, queued: false, error: 'bad_email' };
    } else em = '';
    const item = { rating: r, text: msg, email: em, context: cleanContext(context), at: Date.now() };

    const online = (() => { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch { return true; } })();
    if (online) {
      try {
        const res = await send(item);
        if (res.ok) {
          lsSet(K_SENT, String(Date.now()));
          track('feedback_sent', { rating: r });
          return { ok: true, queued: false };
        }
        // server-side refusal (e.g. daily limit) is not retried
        return { ok: false, queued: false, error: String(res.error || 'rejected') };
      } catch { /* network / server error -> queue */ }
    }
    const q = readQueue();
    q.push(item);
    writeQueue(q);
    lsSet(K_SENT, String(Date.now()));
    ensureOnlineListener();
    return { ok: true, queued: true };
  } catch (e) {
    return { ok: false, queued: false, error: 'internal' };
  }
}

let flushing = null;
export async function flushFeedbackQueue() {
  ensureOnlineListener();
  try {
    if (!isFeedbackAvailable()) return 0;
    if (flushing) return flushing;
    flushing = (async () => {
      let sent = 0;
      let q = readQueue();
      while (q.length) {
        const item = q[0];
        try {
          const res = await send(item);
          if (res.ok) {
            sent++;
            track('feedback_sent', { rating: item.rating, queued: true });
          }
          // ok or refused: either way the item is done
          q = readQueue().slice(1);
          writeQueue(q);
        } catch {
          break; // still offline / server down: keep the rest for later
        }
      }
      return sent;
    })().catch(() => 0).finally(() => { flushing = null; });
    return await flushing;
  } catch {
    return 0;
  }
}

export function shouldPrompt(trigger) {
  try {
    if (!isFeedbackAvailable()) return false;
    if (!getRemoteConfig().feedback.prompt) return false;
    const now = Date.now();
    const last = Number(lsGet(K_LAST)) || 0;
    const sent = Number(lsGet(K_SENT)) || 0;
    if (last && now - last < DAYS30) return false;
    if (sent && now - sent < DAYS30) return false;
    if (trigger === 'season1') {
      const done = readJSON(K_DONE, []);
      if (Array.isArray(done) && done.includes('season1')) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markPrompted(trigger) {
  try {
    lsSet(K_LAST, String(Date.now()));
    const done = readJSON(K_DONE, []);
    const list = Array.isArray(done) ? done : [];
    if (trigger && !list.includes(trigger)) list.push(String(trigger));
    lsSet(K_DONE, JSON.stringify(list.slice(-10)));
  } catch { /* ignore */ }
}

let listening = false;
function ensureOnlineListener() {
  try {
    if (listening || typeof window === 'undefined' || !window.addEventListener) return;
    listening = true;
    window.addEventListener('online', () => { flushFeedbackQueue().catch(() => {}); });
  } catch { /* ignore */ }
}

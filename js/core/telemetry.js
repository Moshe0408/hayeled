// js/core/telemetry.js - anonymous usage telemetry (SPEC §8.2).
// - No-op when the backend is not configured (nothing is even queued).
// - Never throws into gameplay; never blocks; all network calls are fire-and-forget.
// - Queue persisted in localStorage 'hy.tm.q' (cap 500), flushed in batches of <= 50.
import { APP_VERSION, BACKEND_ENABLED, TELEMETRY_DEFAULT_ON, HEARTBEAT_MS } from '../config.js';
import { rpc } from './supa.js';

const K_DEVICE = 'hy.device';
const K_CONSENT = 'hy.tm.consent';
const K_SESS = 'hy.tm.sess';
const K_QUEUE = 'hy.tm.q';
const K_INSTALLED = 'hy.tm.installed';

const QUEUE_CAP = 500;
const BATCH_MAX = 50;
const FLUSH_EVERY_MS = 30000;
const FLUSH_AT = 20;
const SESSION_GAP_MS = 30 * 60 * 1000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;
const KEEPALIVE_LIMIT = 60000;
const NAME_RE = /^[a-z_]{2,32}$/;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_ERRORS = 5;

let inited = false;
let appVersion = APP_VERSION;
let memDevice = null;
let session = null;          // { id, lastActive }
let hbTimer = null;
let flushTimer = null;
let flushing = null;
let backoffMs = 0;
let nextFlushAt = 0;
let errorsThisSession = 0;
let hiddenAt = 0;

// ---------- small safe helpers ----------
function ls() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
function lsGet(k) {
  try { const s = ls(); return s ? s.getItem(k) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { const s = ls(); if (s) s.setItem(k, v); return true; } catch { return false; }
}
function lsDel(k) {
  try { const s = ls(); if (s) s.removeItem(k); } catch { /* ignore */ }
}
function hasDoc() {
  return typeof document !== 'undefined' && !!document;
}
function isVisible() {
  return !hasDoc() || document.visibilityState !== 'hidden';
}
function isOnline() {
  try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch { return true; }
}

function randomId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch { /* ignore */ }
  let hex = '';
  try {
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      const b = new Uint8Array(16);
      globalThis.crypto.getRandomValues(b);
      for (const x of b) hex += x.toString(16).padStart(2, '0');
      return hex;
    }
  } catch { /* ignore */ }
  for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
}

export function isStandalone() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch { /* ignore */ }
  return false;
}

export function getPlatform() {
  try {
    if (typeof navigator === 'undefined') return 'other';
    const ua = String(navigator.userAgent || '');
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios'; // iPadOS desktop UA
    if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop';
  } catch { /* ignore */ }
  return 'other';
}

// ---------- identity / consent ----------
export function getDeviceId() {
  let id = lsGet(K_DEVICE);
  if (id && ID_RE.test(id)) return id;
  if (memDevice) return memDevice;
  id = randomId();
  memDevice = id;
  if (BACKEND_ENABLED) lsSet(K_DEVICE, id);
  return id;
}

export function getConsent() {
  const v = lsGet(K_CONSENT);
  if (v === '1') return true;
  if (v === '0') return false;
  return !!TELEMETRY_DEFAULT_ON;
}

export function setConsent(on) {
  try {
    lsSet(K_CONSENT, on ? '1' : '0');
    if (!on) {
      lsDel(K_QUEUE);
      stopHeartbeat();
    } else if (inited && BACKEND_ENABLED) {
      startHeartbeat();
    }
  } catch { /* never throw */ }
}

function newSession() {
  session = { id: randomId(), lastActive: Date.now() };
  errorsThisSession = 0;
  saveSession();
  return session;
}
function saveSession() {
  if (session && BACKEND_ENABLED) lsSet(K_SESS, JSON.stringify(session));
}
function touchSession() {
  if (!session) return;
  session.lastActive = Date.now();
  saveSession();
}

export function getSessionId() {
  if (!session) {
    // not initialised yet: reuse a stored one if recent, else create (in memory)
    try {
      const s = JSON.parse(lsGet(K_SESS) || 'null');
      if (s && ID_RE.test(String(s.id)) && Date.now() - Number(s.lastActive || 0) < SESSION_GAP_MS) session = s;
    } catch { /* ignore */ }
    if (!session) session = { id: randomId(), lastActive: Date.now() };
  }
  return session.id;
}

// ---------- queue ----------
function readQueue() {
  try {
    const q = JSON.parse(lsGet(K_QUEUE) || '[]');
    if (!Array.isArray(q)) return [];
    for (const e of q) if (e && !e.i) e.i = eid();
    return q.filter((e) => e && typeof e === 'object');
  } catch { return []; }
}
function writeQueue(q) {
  if (q.length > QUEUE_CAP) q = q.slice(q.length - QUEUE_CAP);
  if (!q.length) { lsDel(K_QUEUE); return; }
  if (!lsSet(K_QUEUE, JSON.stringify(q))) {
    // storage full: keep only the newest 50 (game saves have priority)
    lsSet(K_QUEUE, JSON.stringify(q.slice(-50)));
  }
}

function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  let n = 0;
  for (const k of Object.keys(props)) {
    if (n >= 24) break;
    const v = props[k];
    if (v === undefined || typeof v === 'function') continue;
    const key = String(k).slice(0, 32);
    if (typeof v === 'string') out[key] = v.slice(0, 120);
    else if (typeof v === 'number') out[key] = Number.isFinite(v) ? v : null;
    else if (typeof v === 'boolean' || v === null) out[key] = v;
    else {
      let s = '';
      try { s = JSON.stringify(v); } catch { s = ''; }
      out[key] = String(s || '').slice(0, 120);
    }
    n++;
  }
  return out;
}

function active() {
  return BACKEND_ENABLED && getConsent();
}

export function track(name, props = {}) {
  try {
    if (!active()) return;
    if (typeof name !== 'string' || !NAME_RE.test(name)) return;
    const q = readQueue();
    q.push({ i: eid(), n: name, p: cleanProps(props), t: new Date().toISOString(), s: getSessionId() });
    writeQueue(q);
    touchSession();
    if (q.length >= FLUSH_AT && inited) flush().catch(() => {});
  } catch { /* never throw */ }
}

export function trackSignals(signals) {
  try {
    if (!active() || !Array.isArray(signals)) return;
    for (const s of signals) {
      if (s && typeof s.name === 'string') track(s.name, s.props || {});
    }
  } catch { /* never throw */ }
}

const inflight = new Set();   // queue ids currently being sent (never sent twice concurrently)
let eidSeq = 0;
function eid() {
  eidSeq = (eidSeq + 1) % 1679616;
  return Date.now().toString(36).slice(-5) + eidSeq.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function buildBatch(q, keepalive) {
  let batch = q.filter((e) => !inflight.has(e.i)).slice(0, BATCH_MAX);
  const strip = (arr) => arr.map((e) => ({ n: e.n, p: e.p, t: e.t, s: e.s }));
  if (keepalive) {
    const dev = getDeviceId();
    const sid = getSessionId();
    while (batch.length > 1 && JSON.stringify({ p_device: dev, p_session: sid, p_events: strip(batch) }).length >= KEEPALIVE_LIMIT) {
      batch = batch.slice(0, Math.max(1, Math.floor(batch.length / 2)));
    }
  }
  return { ids: batch.map((e) => e.i), events: strip(batch) };
}

export async function flush({ keepalive = false } = {}) {
  try {
    if (!active()) return false;
    if (!isOnline()) return false;
    if (flushing && !keepalive) return flushing;
    if (!keepalive && backoffMs && Date.now() < nextFlushAt) return false;
    const q = readQueue();
    if (!q.length) return true;
    const { ids, events } = buildBatch(q, keepalive);
    if (!events.length) return true;   // everything is already in flight
    ids.forEach((id) => inflight.add(id));
    const p = (async () => {
      try {
        await rpc('track_events', { p_device: getDeviceId(), p_session: getSessionId(), p_events: events }, { keepalive, timeoutMs: keepalive ? 5000 : 8000 });
        const sent = new Set(ids);
        writeQueue(readQueue().filter((e) => !sent.has(e.i)));
        backoffMs = 0;
        nextFlushAt = 0;
        return true;
      } catch {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, BACKOFF_MAX_MS) : 30000;
        nextFlushAt = Date.now() + backoffMs;
        return false;
      } finally {
        ids.forEach((id) => inflight.delete(id));
      }
    })();
    if (!keepalive) {
      flushing = p;
      p.finally(() => { flushing = null; });
    }
    return await p;
  } catch {
    return false;
  }
}

// ---------- heartbeat ----------
function heartbeatMeta() {
  let lang = '';
  try { lang = String((typeof navigator !== 'undefined' && navigator.language) || '').slice(0, 16); } catch { /* ignore */ }
  return { v: appVersion, standalone: isStandalone(), platform: getPlatform(), lang };
}

async function heartbeat() {
  try {
    if (!active() || !isVisible() || !isOnline()) return;
    touchSession();
    await rpc('heartbeat', { p_device: getDeviceId(), p_session: getSessionId(), p_meta: heartbeatMeta() }, { timeoutMs: 6000 });
  } catch { /* skip; next tick retries */ }
}

function startHeartbeat() {
  stopHeartbeat();
  if (!active() || !isVisible()) return;
  heartbeat();
  hbTimer = setInterval(heartbeat, HEARTBEAT_MS);
}
function stopHeartbeat() {
  if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
}

// ---------- lifecycle ----------
function onHidden() {
  hiddenAt = Date.now();
  touchSession();
  stopHeartbeat();
  flush({ keepalive: true }).catch(() => {});
}
function onVisible() {
  if (hiddenAt && Date.now() - hiddenAt > SESSION_GAP_MS) newSession();
  hiddenAt = 0;
  startHeartbeat();
}

function checkInstall() {
  try {
    if (lsGet(K_INSTALLED) === '1') return;
    if (isStandalone()) {
      lsSet(K_INSTALLED, '1');
      track('install', {});
    }
  } catch { /* ignore */ }
}

function trackError(msg, src) {
  try {
    if (errorsThisSession >= MAX_ERRORS) return;
    errorsThisSession++;
    track('error', { msg: String(msg || '').slice(0, 200), src: String(src || '').slice(0, 120) });
  } catch { /* ignore */ }
}

export function initTelemetry({ appVersion: v } = {}) {
  try {
    if (inited) return;
    inited = true;
    if (v) appVersion = String(v);
    if (!BACKEND_ENABLED) return;
    newSession();
    if (!getConsent()) { lsDel(K_QUEUE); }
    getDeviceId();
    track('app_open', { standalone: isStandalone(), v: appVersion, ref: isStandalone() ? 'pwa' : 'browser' });
    checkInstall();

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('appinstalled', () => {
        if (lsGet(K_INSTALLED) !== '1') { lsSet(K_INSTALLED, '1'); track('install', {}); }
      });
      window.addEventListener('online', () => { backoffMs = 0; nextFlushAt = 0; flush().catch(() => {}); heartbeat(); });
      window.addEventListener('pagehide', onHidden);
      window.addEventListener('error', (e) => {
        try { trackError(e && (e.message || (e.error && e.error.message)), e && e.filename ? (String(e.filename).split('/').pop() + ':' + (e.lineno || 0)) : 'onerror'); } catch { /* ignore */ }
      });
      window.addEventListener('unhandledrejection', (e) => {
        try { const r = e && e.reason; trackError((r && (r.message || String(r))) || 'rejection', 'promise'); } catch { /* ignore */ }
      });
    }
    if (hasDoc() && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') onHidden(); else onVisible();
      });
      document.addEventListener('freeze', onHidden);
    }
    startHeartbeat();
    flushTimer = setInterval(() => { if (isVisible()) flush().catch(() => {}); }, FLUSH_EVERY_MS);
    // first flush soon after boot (app_open), without blocking the boot path
    setTimeout(() => { flush().catch(() => {}); }, 1500);
  } catch { /* never throw */ }
}

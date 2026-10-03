// js/core/remote.js - remote config from Supabase table app_config (SPEC §8.4).
// Cached in localStorage 'hy.rc' = { fetchedAt, config }. Never throws.
import { BACKEND_ENABLED } from '../config.js';
import { select } from './supa.js';

const K_RC = 'hy.rc';
const KEYS = ['ads', 'announcement', 'version', 'feedback'];
const PLACEMENTS = ['hub_banner', 'interstitial', 'rewarded'];
const PROVIDERS = ['none', 'house', 'adsense'];

export const REMOTE_DEFAULTS = Object.freeze(deepFreeze({
  ads: {
    enabled: false, provider: 'none',
    placements: {
      hub_banner: { enabled: true },
      interstitial: { enabled: true, everyMatchdays: 4, minMinutesBetween: 3, skipFirstMinutes: 10 },
      rewarded: { enabled: false, maxPerDay: 3, energy: 15 },
    },
    house: [],
    adsense: { client: '', slots: { hub_banner: '', interstitial: '' } },
  },
  announcement: { enabled: false, id: '', textHe: '', link: '', level: 'info' },
  version: { min: '0.0.0', latest: '0.0.0', messageHe: 'יש גרסה חדשה. רענן כדי לעדכן' },
  feedback: { enabled: true, prompt: true },
}));

function deepFreeze(o) {
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) deepFreeze(o[k]);
    Object.freeze(o);
  }
  return o;
}

function isPlain(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** Recursive deep merge: plain objects merge; arrays and scalars from `src` replace. Returns a new object. */
export function deepMerge(base, src) {
  const out = clone(base);
  if (!isPlain(src)) return out;
  for (const k of Object.keys(src)) {
    const sv = src[k];
    if (isPlain(sv) && isPlain(out[k])) out[k] = deepMerge(out[k], sv);
    else if (sv !== undefined) out[k] = clone(sv);
  }
  return out;
}

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
function num(v, d, min, max) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function str(v, d, max) {
  return typeof v === 'string' ? v.slice(0, max) : d;
}

/** https: URL or a relative './' path; anything else (javascript:, data:, http:) is rejected. */
export function safeUrl(u) {
  if (typeof u !== 'string') return '';
  const s = u.trim();
  if (!s || s.length > 500) return '';
  if (s.startsWith('./') && !/^\.\/+\//.test(s) && !s.includes('\\')) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) {
    try { const p = new URL(s); return p.protocol === 'https:' ? s : ''; } catch { return ''; }
  }
  return '';
}

function sanitizeVersion(v, d) {
  return typeof v === 'string' && /^\d+(\.\d+){0,2}$/.test(v.trim()) ? v.trim() : d;
}

/** Sanitise a merged config. Wrong types fall back to defaults. Returns a new object. */
export function sanitizeConfig(cfg) {
  const D = REMOTE_DEFAULTS;
  const c = isPlain(cfg) ? cfg : {};
  const a = isPlain(c.ads) ? c.ads : {};
  const pl = isPlain(a.placements) ? a.placements : {};
  const hb = isPlain(pl.hub_banner) ? pl.hub_banner : {};
  const it = isPlain(pl.interstitial) ? pl.interstitial : {};
  const rw = isPlain(pl.rewarded) ? pl.rewarded : {};
  const as = isPlain(a.adsense) ? a.adsense : {};
  const slots = isPlain(as.slots) ? as.slots : {};

  const house = [];
  if (Array.isArray(a.house)) {
    a.house.forEach((h, i) => {
      if (!isPlain(h)) return;
      const link = safeUrl(h.link);
      const imageUrl = safeUrl(h.imageUrl);
      const textHe = str(h.textHe, '', 200);
      if (!link) return;
      if (!imageUrl && (typeof h.imageUrl === 'string' && h.imageUrl.trim())) return; // invalid image URL -> drop
      if (!imageUrl && !textHe) return;
      const placements = Array.isArray(h.placements) ? h.placements.filter((p) => PLACEMENTS.includes(p)) : PLACEMENTS.slice();
      house.push({
        id: (typeof h.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(h.id)) ? h.id : ('h' + (i + 1)),
        imageUrl, link, textHe,
        weight: num(h.weight, 1, 0, 100),
        placements: placements.length ? placements : PLACEMENTS.slice(),
      });
    });
  }

  const ann = isPlain(c.announcement) ? c.announcement : {};
  const ver = isPlain(c.version) ? c.version : {};
  const fb = isPlain(c.feedback) ? c.feedback : {};
  const cleanId = (v, d, re) => (typeof v === 'string' && re.test(v.trim()) ? v.trim() : d);

  return {
    ads: {
      enabled: bool(a.enabled, D.ads.enabled),
      provider: PROVIDERS.includes(a.provider) ? a.provider : D.ads.provider,
      placements: {
        hub_banner: { enabled: bool(hb.enabled, D.ads.placements.hub_banner.enabled) },
        interstitial: {
          enabled: bool(it.enabled, D.ads.placements.interstitial.enabled),
          everyMatchdays: num(it.everyMatchdays, D.ads.placements.interstitial.everyMatchdays, 1, 50),
          minMinutesBetween: num(it.minMinutesBetween, D.ads.placements.interstitial.minMinutesBetween, 0, 120),
          skipFirstMinutes: num(it.skipFirstMinutes, D.ads.placements.interstitial.skipFirstMinutes, 0, 120),
        },
        rewarded: {
          enabled: bool(rw.enabled, D.ads.placements.rewarded.enabled),
          maxPerDay: num(rw.maxPerDay, D.ads.placements.rewarded.maxPerDay, 0, 10),
          energy: num(rw.energy, D.ads.placements.rewarded.energy, 1, 50),
        },
      },
      house,
      adsense: {
        client: cleanId(as.client, '', /^[A-Za-z0-9-]{1,64}$/),
        slots: {
          hub_banner: cleanId(slots.hub_banner, '', /^[0-9]{1,20}$/),
          interstitial: cleanId(slots.interstitial, '', /^[0-9]{1,20}$/),
        },
      },
    },
    announcement: {
      enabled: bool(ann.enabled, D.announcement.enabled),
      id: typeof ann.id === 'string' ? ann.id.slice(0, 64) : D.announcement.id,
      textHe: str(ann.textHe, D.announcement.textHe, 200),
      link: safeUrl(ann.link),
      level: ann.level === 'warn' ? 'warn' : 'info',
    },
    version: {
      min: sanitizeVersion(ver.min, D.version.min),
      latest: sanitizeVersion(ver.latest, D.version.latest),
      messageHe: str(ver.messageHe, D.version.messageHe, 200) || D.version.messageHe,
    },
    feedback: {
      enabled: bool(fb.enabled, D.feedback.enabled),
      prompt: bool(fb.prompt, D.feedback.prompt),
    },
  };
}

/** Build a sanitised config from app_config rows ([{key, value}]). */
export function configFromRows(rows) {
  const src = {};
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (r && KEYS.includes(r.key) && isPlain(r.value)) src[r.key] = r.value;
    }
  }
  return sanitizeConfig(deepMerge(REMOTE_DEFAULTS, src));
}

let current = null;
const subs = new Set();
let loading = null;

function readCache() {
  try {
    const raw = globalThis.localStorage ? globalThis.localStorage.getItem(K_RC) : null;
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && isPlain(c.config)) return sanitizeConfig(deepMerge(REMOTE_DEFAULTS, c.config));
  } catch { /* ignore */ }
  return null;
}

export function getRemoteConfig() {
  if (current) return current;
  current = (BACKEND_ENABLED && readCache()) || sanitizeConfig(clone(REMOTE_DEFAULTS));
  return current;
}

export function onRemoteConfig(cb) {
  if (typeof cb !== 'function') return () => {};
  subs.add(cb);
  return () => subs.delete(cb);
}

export async function loadRemoteConfig({ timeoutMs = 4000 } = {}) {
  try {
    if (!BACKEND_ENABLED) return getRemoteConfig();
    if (loading) return loading;
    loading = (async () => {
      try {
        const rows = await select('app_config', 'select=key,value', { timeoutMs });
        const cfg = configFromRows(rows);
        current = cfg;
        try {
          if (globalThis.localStorage) globalThis.localStorage.setItem(K_RC, JSON.stringify({ fetchedAt: Date.now(), config: cfg }));
        } catch { /* quota: keep in memory only */ }
        for (const cb of Array.from(subs)) {
          try { cb(cfg); } catch (e) { try { console.warn('remote config subscriber failed', e); } catch { /* ignore */ } }
        }
        return cfg;
      } catch {
        return getRemoteConfig();
      } finally {
        loading = null;
      }
    })();
    return await loading;
  } catch {
    return getRemoteConfig();
  }
}

/** Compare 'x.y.z' versions numerically -> -1 | 0 | 1. Missing parts count as 0. */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

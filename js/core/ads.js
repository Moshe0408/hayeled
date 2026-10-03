// js/core/ads.js - ads infrastructure (SPEC §8.5). DISABLED by default.
// Providers: 'none' (default) | 'house' (own sponsor banners from remote config) | 'adsense'.
// With ads disabled: slots are hidden and empty, nothing is requested, nothing is tracked.
// Never throws into the UI. Safe to import in Node (no DOM access at import time).

const K_ADS = 'hy.ads';
const PLACEMENTS = ['hub_banner', 'interstitial', 'rewarded'];
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=';
const INTERSTITIAL_CLOSE_S = 3;
const REWARDED_S = 5;

let cfg = null;              // sanitised RemoteConfig.ads (or null = off)
let trackFn = null;
let consent = false;
let adsenseState = 'idle';   // 'idle' | 'loading' | 'ready' | 'failed'
let overlayOpen = false;
const subs = new Set();

// ---------- helpers ----------
function hasDom() {
  return typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';
}
function lsGet(k) {
  try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { if (globalThis.localStorage) globalThis.localStorage.setItem(k, v); } catch { /* ignore */ }
}
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function readState() {
  let s = null;
  try { s = JSON.parse(lsGet(K_ADS) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  return {
    lastAt: Number(s.lastAt) || 0,
    sinceMatchdays: Number(s.sinceMatchdays) || 0,
    firstSeenAt: Number(s.firstSeenAt) || 0,
    rewarded: s.rewarded && typeof s.rewarded === 'object'
      ? { day: String(s.rewarded.day || ''), n: Number(s.rewarded.n) || 0 }
      : { day: '', n: 0 },
  };
}
function writeState(s) {
  lsSet(K_ADS, JSON.stringify(s));
}
function emit(name, props) {
  try { if (typeof trackFn === 'function') trackFn(name, props); } catch { /* ignore */ }
}
function notify() {
  for (const cb of Array.from(subs)) {
    try { cb(); } catch (e) { try { console.warn('ads subscriber failed', e); } catch { /* ignore */ } }
  }
}
function inMatch() {
  try { return typeof location !== 'undefined' && String(location.hash || '').startsWith('#/match'); } catch { return false; }
}

function creatives(placement) {
  if (!cfg || !Array.isArray(cfg.house)) return [];
  return cfg.house.filter((h) => h && h.link && (h.imageUrl || h.textHe) && (Number(h.weight) > 0)
    && (!Array.isArray(h.placements) || h.placements.includes(placement)));
}
function pickCreative(placement) {
  const list = creatives(placement);
  if (!list.length) return null;
  const total = list.reduce((a, h) => a + Number(h.weight || 0), 0);
  let r = Math.random() * total;
  for (const h of list) {
    r -= Number(h.weight || 0);
    if (r < 0) return h;
  }
  return list[list.length - 1];
}

/** The provider that will actually be used right now (after fallbacks). */
function effectiveProvider() {
  if (!cfg || cfg.enabled !== true) return 'none';
  const p = cfg.provider;
  if (p === 'house') return 'house';
  if (p === 'adsense') {
    const client = cfg.adsense && cfg.adsense.client;
    if (client && consent && adsenseState !== 'failed') return 'adsense';
    return (Array.isArray(cfg.house) && cfg.house.length) ? 'house' : 'none';
  }
  return 'none';
}

function placementCfg(placement) {
  return (cfg && cfg.placements && cfg.placements[placement]) || null;
}

// ---------- public API ----------
export function initAds(adsConfig, { track, adsConsent = false } = {}) {
  try {
    cfg = adsConfig && typeof adsConfig === 'object' ? adsConfig : null;
    if (typeof track === 'function') trackFn = track;
    consent = adsConsent === true;
    if (effectiveProvider() !== 'none') {
      const s = readState();
      if (!s.firstSeenAt) { s.firstSeenAt = Date.now(); writeState(s); }
    }
    if (effectiveProvider() === 'adsense') loadAdsense();
  } catch { /* never throw */ }
  notify();
}

export function onAdsChange(cb) {
  if (typeof cb !== 'function') return () => {};
  subs.add(cb);
  return () => subs.delete(cb);
}

export function isEnabled(placement) {
  try {
    const prov = effectiveProvider();
    if (prov === 'none') return false;
    if (!placement) return true;
    if (!PLACEMENTS.includes(placement)) return false;
    const pc = placementCfg(placement);
    if (!pc || pc.enabled !== true) return false;
    if (placement === 'rewarded') return creatives('rewarded').length > 0;
    if (prov === 'house') return creatives(placement).length > 0;
    if (prov === 'adsense') {
      const slot = cfg.adsense && cfg.adsense.slots && cfg.adsense.slots[placement];
      return !!slot || creatives(placement).length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

function hideSlot(el) {
  try {
    if (!el) return;
    el.hidden = true;
    while (el.firstChild) el.removeChild(el.firstChild);
  } catch { /* ignore */ }
}

function observeImpression(el, props) {
  let done = false;
  const fire = () => { if (!done) { done = true; emit('ad_impression', props); } };
  try {
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) { fire(); io.disconnect(); break; }
        }
      }, { threshold: [0.5] });
      io.observe(el);
      return () => io.disconnect();
    }
  } catch { /* fall through */ }
  fire();
  return () => {};
}

function houseNode(h, placement, { big = false } = {}) {
  const a = document.createElement('a');
  a.className = 'ad-house' + (big ? ' ad-house-big' : '');
  a.setAttribute('data-testid', 'ad-house-link');
  a.href = h.link;
  a.target = '_blank';
  a.rel = 'noopener sponsored';
  a.style.cssText = 'display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;position:relative;min-height:44px;'
    + (big ? 'flex-direction:column;text-align:center;' : '');
  if (h.imageUrl) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = h.imageUrl;
    img.style.cssText = big
      ? 'max-width:100%;max-height:55vh;border-radius:12px;object-fit:contain;'
      : 'max-height:64px;max-width:40%;border-radius:8px;object-fit:contain;flex:0 0 auto;';
    a.appendChild(img);
  }
  if (h.textHe) {
    const t = document.createElement('span');
    t.className = 'ad-house-text';
    t.textContent = h.textHe;
    t.style.cssText = 'flex:1 1 auto;font-weight:700;';
    a.appendChild(t);
  }
  const lbl = document.createElement('span');
  lbl.className = 'ad-label';
  lbl.textContent = 'פרסומת';
  lbl.style.cssText = 'position:absolute;inset-inline-end:4px;top:2px;font-size:10px;opacity:.65;';
  a.appendChild(lbl);
  a.addEventListener('click', () => emit('ad_click', { placement, provider: 'house', ad: h.id }));
  return a;
}

export function renderSlot(el, placement) {
  try {
    if (!el) return false;
    if (!hasDom() || placement === 'rewarded' || !isEnabled(placement)) { hideSlot(el); return false; }
    if (typeof el.__hyAdCleanup === 'function') { try { el.__hyAdCleanup(); } catch { /* ignore */ } }
    el.__hyAdCleanup = null;
    while (el.firstChild) el.removeChild(el.firstChild);
    const prov = effectiveProvider();
    const slotId = cfg.adsense && cfg.adsense.slots && cfg.adsense.slots[placement];

    if (prov === 'adsense' && slotId) {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', cfg.adsense.client);
      ins.setAttribute('data-ad-slot', slotId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      el.appendChild(ins);
      el.hidden = false;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
      el.__hyAdCleanup = observeImpression(el, { placement, provider: 'adsense', ad: slotId });
      ins.addEventListener('click', () => emit('ad_click', { placement, provider: 'adsense', ad: slotId }));
      return true;
    }

    const h = pickCreative(placement);
    if (!h) { hideSlot(el); return false; }
    const node = houseNode(h, placement);
    const img = node.querySelector('img');
    if (img) img.onerror = () => { el.hidden = true; };
    el.appendChild(node);
    el.hidden = false;
    el.__hyAdCleanup = observeImpression(el, { placement, provider: 'house', ad: h.id });
    return true;
  } catch {
    hideSlot(el);
    return false;
  }
}

export function noteMatchday() {
  try {
    if (effectiveProvider() === 'none') return;
    const s = readState();
    s.sinceMatchdays += 1;
    writeState(s);
  } catch { /* ignore */ }
}

function interstitialDue() {
  if (!isEnabled('interstitial') || overlayOpen || inMatch() || !hasDom()) return false;
  const pc = placementCfg('interstitial');
  const s = readState();
  const now = Date.now();
  if (s.sinceMatchdays < pc.everyMatchdays) return false;
  if (s.lastAt && now - s.lastAt < pc.minMinutesBetween * 60000) return false;
  if (!s.firstSeenAt) { s.firstSeenAt = now; writeState(s); }
  if (now - s.firstSeenAt < pc.skipFirstMinutes * 60000) return false;
  return true;
}

function buildOverlay(testid) {
  const ov = document.createElement('div');
  ov.className = 'ad-overlay';
  ov.setAttribute('data-testid', testid);
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'פרסומת');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,9,18,.92);display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;gap:16px;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));'
    + 'color:#eef3ff;font-family:Heebo,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;';
  const box = document.createElement('div');
  box.className = 'ad-overlay-box';
  box.style.cssText = 'width:100%;max-width:480px;background:#16213a;border:1px solid #24304d;border-radius:16px;padding:14px;';
  ov.appendChild(box);
  return { ov, box };
}

function makeButton(text, testid, primary) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (testid) b.setAttribute('data-testid', testid);
  b.style.cssText = 'min-height:44px;min-width:120px;padding:10px 20px;border-radius:12px;border:0;font:inherit;font-weight:700;'
    + (primary ? 'background:#1fbf5a;color:#06210f;' : 'background:#24304d;color:#eef3ff;');
  return b;
}

function fillCreative(box, placement) {
  const prov = effectiveProvider();
  const slotId = cfg.adsense && cfg.adsense.slots && cfg.adsense.slots[placement];
  if (prov === 'adsense' && slotId && placement !== 'rewarded') {
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;min-height:250px;';
    ins.setAttribute('data-ad-client', cfg.adsense.client);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    box.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
    return { provider: 'adsense', ad: slotId };
  }
  const h = pickCreative(placement);
  if (!h) return null;
  const node = houseNode(h, placement, { big: true });
  const img = node.querySelector('img');
  if (img) img.onerror = () => { img.remove(); };
  box.appendChild(node);
  return { provider: 'house', ad: h.id };
}

export async function maybeInterstitial(context = {}) {
  try {
    if (!interstitialDue()) return false;
    const { ov, box } = buildOverlay('ad-interstitial');
    const info = fillCreative(box, 'interstitial');
    if (!info) return false;
    overlayOpen = true;
    const s = readState();
    s.lastAt = Date.now();
    s.sinceMatchdays = 0;
    writeState(s);
    const btn = makeButton('סגור (' + INTERSTITIAL_CLOSE_S + ')', 'btn-ad-close', false);
    btn.disabled = true;
    ov.appendChild(btn);
    document.body.appendChild(ov);
    emit('ad_impression', { placement: 'interstitial', provider: info.provider, ad: info.ad, week: Number(context.week) || 0 });
    return await new Promise((resolve) => {
      let left = INTERSTITIAL_CLOSE_S;
      const t = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(t);
          btn.disabled = false;
          btn.textContent = 'סגור';
          try { btn.focus(); } catch { /* ignore */ }
        } else btn.textContent = 'סגור (' + left + ')';
      }, 1000);
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        clearInterval(t);
        try { ov.remove(); } catch { /* ignore */ }
        overlayOpen = false;
        resolve(true);
      });
    });
  } catch {
    overlayOpen = false;
    return false;
  }
}

export function canShowRewarded() {
  try {
    if (overlayOpen || !hasDom()) return false;
    if (!isEnabled('rewarded')) return false;
    const pc = placementCfg('rewarded');
    const s = readState();
    const n = s.rewarded.day === today() ? s.rewarded.n : 0;
    return n < pc.maxPerDay;
  } catch {
    return false;
  }
}

export async function showRewarded(onReward) {
  try {
    if (!canShowRewarded()) return false;
    const { ov, box } = buildOverlay('ad-rewarded');
    const h = pickCreative('rewarded');
    if (!h) return false;
    box.appendChild(houseNode(h, 'rewarded', { big: true }));
    const img = box.querySelector('img');
    if (img) img.onerror = () => { img.remove(); };
    const energy = (placementCfg('rewarded') && placementCfg('rewarded').energy) || 15;
    const status = document.createElement('div');
    status.style.cssText = 'font-weight:700;text-align:center;';
    status.textContent = 'עוד ' + REWARDED_S + ' שניות ותקבל +' + energy + ' אנרגיה';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
    const cancel = makeButton('ביטול', 'btn-ad-cancel', false);
    const close = makeButton('המתן...', 'btn-ad-close', true);
    close.disabled = true;
    row.appendChild(close);
    row.appendChild(cancel);
    ov.appendChild(status);
    ov.appendChild(row);
    overlayOpen = true;
    document.body.appendChild(ov);
    emit('ad_impression', { placement: 'rewarded', provider: 'house', ad: h.id });

    return await new Promise((resolve) => {
      let left = REWARDED_S;
      let earned = false;
      const finish = (result) => {
        clearInterval(t);
        try { ov.remove(); } catch { /* ignore */ }
        overlayOpen = false;
        resolve(result);
      };
      const t = setInterval(() => {
        left -= 1;
        if (left > 0) { status.textContent = 'עוד ' + left + ' שניות ותקבל +' + energy + ' אנרגיה'; return; }
        clearInterval(t);
        earned = true;
        const s = readState();
        const d = today();
        s.rewarded = { day: d, n: (s.rewarded.day === d ? s.rewarded.n : 0) + 1 };
        writeState(s);
        emit('ad_rewarded', { placement: 'rewarded', provider: 'house', ad: h.id });
        try { if (typeof onReward === 'function') onReward(); } catch (e) { try { console.warn('reward callback failed', e); } catch { /* ignore */ } }
        status.textContent = 'קיבלת +' + energy + ' אנרגיה ✓';
        close.disabled = false;
        close.textContent = 'סגור';
        cancel.remove();
        try { close.focus(); } catch { /* ignore */ }
      }, 1000);
      close.addEventListener('click', () => { if (!close.disabled) finish(earned); });
      cancel.addEventListener('click', () => { if (!earned) finish(false); });
    });
  } catch {
    overlayOpen = false;
    return false;
  }
}

// ---------- AdSense loader ----------
function loadAdsense() {
  try {
    if (!hasDom() || adsenseState === 'loading' || adsenseState === 'ready' || adsenseState === 'failed') return;
    const client = cfg && cfg.adsense && cfg.adsense.client;
    if (!client) return;
    adsenseState = 'loading';
    const sc = document.createElement('script');
    sc.async = true;
    sc.crossOrigin = 'anonymous';
    sc.src = ADSENSE_SRC + encodeURIComponent(client);
    sc.onload = () => { adsenseState = 'ready'; };
    sc.onerror = () => { adsenseState = 'failed'; notify(); };   // behave as 'none'/'house' for this page load
    (document.head || document.documentElement).appendChild(sc);
  } catch {
    adsenseState = 'failed';
  }
}

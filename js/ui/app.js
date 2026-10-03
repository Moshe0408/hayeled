// app.js: app shell (header, bottom tab bar, banners, toast, modals), shared context, facade call wrapper.
import * as game from '../engine/game.js';
import { esc, $, fromHTML } from './dom.js';
import { gtext } from './gender.js';

/* ------------------------------------------------------------------ */
/* Shared context (filled by main.js)                                  */
/* ------------------------------------------------------------------ */

export const ctx = {
  activeSlot: null,          // 1|2|3|null: slot of the career in memory
  settings: null,            // hy.settings object
  storage: { ls: false, idb: false },
  pendingSummary: null,      // WeekSummaryVM to show when the hub renders (after a match)
  pendingFF: null,           // extra info for the week summary after fast-forward
  blocked: false,            // another tab owns the slot
  hooks: {},                 // { saveNow, scheduleSave, cancelAutosave, flush, startNewCareer, openSlot, routeForState,
                             //   slotOp, applyUpdate, checkUpdates, requestPersist, exportActive }
};

/* Online-service handles. main.js replaces these with the real modules (loaded defensively). The stubs keep every
   screen working even if a backend module failed to load. */
const REMOTE_STUB_CFG = {
  ads: { enabled: false, provider: 'none', placements: { hub_banner: { enabled: true }, interstitial: { enabled: true, everyMatchdays: 4, minMinutesBetween: 3, skipFirstMinutes: 10 }, rewarded: { enabled: false, maxPerDay: 3, energy: 15 } }, house: [], adsense: { client: '', slots: { hub_banner: '', interstitial: '' } } },
  announcement: { enabled: false, id: '', textHe: '', link: '', level: 'info' },
  version: { min: '0.0.0', latest: '0.0.0', messageHe: 'יש גרסה חדשה. רענן כדי לעדכן' },
  feedback: { enabled: false, prompt: false },
};
const noop = () => {};
export const svc = {
  telemetry: { initTelemetry: noop, track: noop, flush: async () => false, trackSignals: noop, setConsent: noop, getConsent: () => false, getDeviceId: () => '', getSessionId: () => '' },
  remote: { REMOTE_DEFAULTS: REMOTE_STUB_CFG, loadRemoteConfig: async () => REMOTE_STUB_CFG, getRemoteConfig: () => REMOTE_STUB_CFG, onRemoteConfig: () => noop, compareVersions: () => 0 },
  feedback: { isFeedbackAvailable: () => false, submitFeedback: async () => ({ ok: false, queued: false, error: 'unavailable' }), shouldPrompt: () => false, markPrompted: noop, flushFeedbackQueue: async () => 0 },
  ads: { initAds: noop, onAdsChange: () => noop, isEnabled: () => false, renderSlot: (el) => { if (el) { el.hidden = true; el.textContent = ''; } return false; }, noteMatchday: noop, maybeInterstitial: async () => false, canShowRewarded: () => false, showRewarded: async () => false },
};

/* ------------------------------------------------------------------ */
/* Settings (hy.settings)                                              */
/* ------------------------------------------------------------------ */

const SETTINGS_KEY = 'hy.settings';
const SETTINGS_DEFAULTS = { lastSlot: null, reduceMotion: false, haptics: true, adsConsent: false, dismissed: [], installDismissedAt: null, decisions: false };

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch { s = {}; }
  const out = { ...SETTINGS_DEFAULTS, ...(typeof s === 'object' ? s : {}) };
  if (![1, 2, 3].includes(out.lastSlot)) out.lastSlot = null;
  if (!Array.isArray(out.dismissed)) out.dismissed = [];
  out.decisions = out.decisions === true;
  ctx.settings = out;
  applyDisplaySettings();
  return out;
}

export function saveSettings(patch = {}) {
  if (!ctx.settings) loadSettings();
  Object.assign(ctx.settings, patch);
  if (ctx.settings.dismissed.length > 30) ctx.settings.dismissed = ctx.settings.dismissed.slice(-30);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(ctx.settings)); } catch { /* storage full or disabled */ }
  applyDisplaySettings();
  return ctx.settings;
}

function applyDisplaySettings() {
  try { document.documentElement.classList.toggle('rm', !!(ctx.settings && ctx.settings.reduceMotion)); } catch { /* no DOM */ }
}

export function reducedMotion() {
  try { return !!(ctx.settings && ctx.settings.reduceMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function buzz(pattern = 30) {
  try {
    if (!ctx.settings || !ctx.settings.haptics || !navigator.vibrate) return;
    // Browsers log an intervention error when vibrate() runs without a real user gesture: skip in that case.
    const ua = navigator.userActivation;
    if (!ua || !ua.hasBeenActive) return;
    navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Facade call wrapper                                                 */
/* ------------------------------------------------------------------ */

/** Forward pending engine signals to telemetry. Never throws. */
export function forwardSignals() {
  try {
    const sig = game.getAndClearSignals();
    if (sig && sig.length) svc.telemetry.trackSignals(sig);
  } catch { /* no career / telemetry missing */ }
}

/**
 * Run a facade call. Always forwards signals afterwards; an exception becomes a toast (returns null).
 */
export function call(fn, { quiet = false } = {}) {
  try {
    return fn();
  } catch (e) {
    console.warn('[hayeled] action failed', e);
    if (!quiet) toast('משהו השתבש בפעולה הזו. ההתקדמות שלך שמורה.');
    return null;
  } finally {
    forwardSignals();
    queueChromeRefresh();
  }
}

/** Request an autosave (the game.subscribe hook does this too; harmless to call twice). */
export function commit() {
  try { ctx.hooks.scheduleSave && ctx.hooks.scheduleSave(); } catch { /* ignore */ }
}

/** Safe getHub (null without career or on error). */
export function hubSafe() {
  try { return game.hasCareer() ? game.getHub() : null; } catch (e) { console.warn('[hayeled] getHub', e); return null; }
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  hub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  schedule: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5zM8 13h3v3H8z"/></svg>',
  tables: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h16M4 20h16M9 3v19"/></svg>',
  career: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6v4H9z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/></svg>',
};
const TABS = [
  { id: 'hub', he: 'בית', hash: '#/hub' },
  { id: 'schedule', he: 'לוח', hash: '#/schedule' },
  { id: 'tables', he: 'טבלאות', hash: '#/tables' },
  { id: 'career', he: 'קריירה', hash: '#/career' },
  { id: 'inbox', he: 'הודעות', hash: '#/inbox' },
];

const SVG_BACK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const SVG_GEAR = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.4 7.4 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.4 7.4 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.4 7.4 0 0 0 2.6-1.5l2.4.9 2-3.4z"/></svg>';

let els = {};
let headerState = { title: '', back: null, gear: false };

export function initShell(appEl) {
  appEl.innerHTML = `
    <div class="shell">
      <header id="topbar" class="topbar" hidden></header>
      <div id="banners" class="banners"></div>
      <main id="view" class="view" tabindex="-1"></main>
    </div>
    <nav id="tabbar" class="tabbar" hidden aria-label="ניווט ראשי">
      ${TABS.map((t) => `<a href="${t.hash}" class="tab" data-tab="${t.id}" data-testid="tab-${t.id}">${ICONS[t.id]}<span>${t.he}</span>${t.id === 'inbox' ? '<b class="tab-badge num" data-testid="inbox-badge" hidden>0</b>' : ''}</a>`).join('')}
    </nav>
    <div id="toast" class="toast" data-testid="toast" role="status" aria-live="polite" hidden></div>
    <div id="modals"></div>`;
  els = { app: appEl, banners: $('#banners', appEl), topbar: $('#topbar', appEl), view: $('#view', appEl), tabbar: $('#tabbar', appEl), toast: $('#toast', appEl), modals: $('#modals', appEl) };
  els.topbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'back') goBack();
    else if (b.dataset.act === 'gear') location.hash = '#/settings';
  });
  document.body.classList.add('booted');
  return els;
}

export function viewRoot() { return els.view; }

function goBack() {
  let target = headerState.back;
  if (target === 'home') target = game.hasCareer() ? '#/hub' : '#/title';
  if (typeof target === 'function') target = target();
  if (!target) target = game.hasCareer() ? '#/hub' : '#/title';
  location.hash = target;
}

/** Header: { title, back: hash|'home'|null, gear: boolean, show: boolean } */
export function setHeader(opts = {}) {
  headerState = { ...headerState, ...opts };
  const { title, back, gear, show } = headerState;
  if (!els.topbar) return;
  els.topbar.hidden = show === false;
  els.topbar.innerHTML = `<i class="tb-lights" aria-hidden="true"></i>
    ${back ? `<button type="button" class="icon-btn" data-act="back" aria-label="חזרה">${SVG_BACK}</button>` : '<span class="icon-sp"></span>'}
    <h1 class="topbar-title">${esc(gtext(title || ''))}</h1>
    ${gear ? `<button type="button" class="icon-btn" data-act="gear" aria-label="הגדרות" data-testid="btn-gear">${SVG_GEAR}</button>` : '<span class="icon-sp"></span>'}`;
}

export function resetHeader(meta = {}) {
  headerState = { title: meta.title || '', back: meta.back || null, gear: !!meta.gear, show: meta.header !== false };
  setHeader({});
}

export function setTabs(visible, activeId) {
  if (!els.tabbar) return;
  let hasCareer = false;
  try { hasCareer = game.hasCareer(); } catch { hasCareer = false; }
  visible = !!visible && hasCareer;
  els.tabbar.hidden = !visible;
  document.body.classList.toggle('has-tabs', !!visible);
  for (const a of els.tabbar.querySelectorAll('.tab')) a.classList.toggle('on', a.dataset.tab === activeId);
  if (visible) refreshChrome();
}

let chromeQueued = false;
function queueChromeRefresh() {
  if (chromeQueued) return;
  chromeQueued = true;
  Promise.resolve().then(() => { chromeQueued = false; refreshChrome(); });
}

/** Update the unread badge. */
export function refreshChrome() {
  if (!els.tabbar || els.tabbar.hidden) return;
  const badgeEl = els.tabbar.querySelector('[data-testid="inbox-badge"]');
  if (!badgeEl) return;
  let n = 0;
  try { if (game.hasCareer()) n = game.getHub().unread || 0; } catch { n = 0; }
  badgeEl.hidden = !n;
  badgeEl.textContent = n > 99 ? '99+' : String(n);
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

let toastTimer = null;
export function toast(textHe, { ms = 3400, tone = '' } = {}) {
  if (!textHe) return;
  const t = els.toast || document.getElementById('toast');
  if (!t) return;
  t.textContent = gtext(String(textHe));
  t.className = 'toast show' + (tone ? ' toast-' + tone : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { if (!t.classList.contains('show')) t.hidden = true; }, 260);
  }, ms);
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

const openModals = [];

/**
 * openModal(content, opts) -> close()
 * content: HTML string (trusted / pre-escaped) or Element.
 * opts: { sheet, testid, dismissible=true, onClose, cls, label }
 * close.el = the panel element.
 */
export function openModal(content, opts = {}) {
  const { sheet = false, testid = '', dismissible = true, onClose, cls = '', label = '' } = opts;
  const root = els.modals || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap' + (sheet ? ' is-sheet' : '');
  wrap.setAttribute('data-testid', 'modal');
  const panel = document.createElement('div');
  panel.className = 'modal' + (sheet ? ' sheet' : '') + (cls ? ' ' + cls : '');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (label) panel.setAttribute('aria-label', label);
  if (testid) panel.setAttribute('data-testid', testid);
  if (typeof content === 'string') panel.innerHTML = content;
  else if (content) panel.appendChild(content);
  wrap.appendChild(panel);
  root.appendChild(wrap);
  document.documentElement.classList.add('modal-open');
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    const i = openModals.indexOf(close);
    if (i >= 0) openModals.splice(i, 1);
    wrap.classList.add('closing');
    const done = () => { wrap.remove(); if (!openModals.length) document.documentElement.classList.remove('modal-open'); };
    if (reducedMotion()) done(); else setTimeout(done, 160);
    if (onClose) { try { onClose(result); } catch (e) { console.warn(e); } }
  };
  close.el = panel;
  close.dismissible = dismissible;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap && dismissible) close();
    const c = e.target.closest('[data-close]');
    if (c && panel.contains(c)) close();
  });
  openModals.push(close);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const focusable = panel.querySelector('[autofocus]');
  if (focusable) setTimeout(() => focusable.focus(), 50);
  return close;
}

export function closeAllModals() {
  for (const c of openModals.slice()) c('nav');
}

export function hasOpenModal() { return openModals.length > 0; }

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openModals.length) {
    const top = openModals[openModals.length - 1];
    if (top.dismissible) top();
  }
});

/** confirmDialog({ title, text, yes, no, danger }) -> Promise<boolean> */
export function confirmDialog({ title = 'בטוח{{|ה}}?', text = '', yes = 'אישור', no = 'ביטול', danger = false } = {}) {
  title = gtext(title); text = gtext(text); yes = gtext(yes); no = gtext(no);
  return new Promise((resolve) => {
    let answered = false;
    const close = openModal(`
      <h2 class="modal-title">${esc(title)}</h2>
      ${text ? `<p class="modal-text">${esc(text)}</p>` : ''}
      <div class="btn-row">
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-testid="btn-confirm-yes" data-a="yes">${esc(yes)}</button>
        <button type="button" class="btn btn-ghost" data-testid="btn-confirm-no" data-a="no">${esc(no)}</button>
      </div>`, { cls: 'confirm', onClose: () => { if (!answered) resolve(false); } });
    close.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      answered = true;
      resolve(b.dataset.a === 'yes');
      close();
    });
  });
}

/** Simple info dialog with one OK button. */
export function infoDialog({ title = '', html = '', ok = 'הבנתי', testid = '' } = {}) {
  return new Promise((resolve) => {
    const close = openModal(`${title ? `<h2 class="modal-title">${esc(title)}</h2>` : ''}<div class="modal-text">${html}</div>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-close>${esc(ok)}</button></div>`, { testid, onClose: () => resolve() });
    return close;
  });
}

/** Full-screen blocking overlay (fast-forward progress, other tab). Returns { el, close }. */
export function overlay(html, { testid = '', cls = '' } = {}) {
  const el = fromHTML(`<div class="overlay ${esc(cls)}"${testid ? ` data-testid="${esc(testid)}"` : ''}><div class="overlay-box">${html}</div></div>`);
  (els.modals || document.body).appendChild(el);
  return { el, close: () => el.remove() };
}

/* ------------------------------------------------------------------ */
/* Banners (update / announcement)                                     */
/* ------------------------------------------------------------------ */

/** Update banner: { text, button, persistent, onClick } */
export function showUpdateBanner({ text = 'גרסה חדשה זמינה', button = 'עדכן עכשיו', persistent = false, onClick } = {}) {
  if (!els.banners) return;
  let b = els.banners.querySelector('[data-testid="update-banner"]');
  if (!b) {
    b = document.createElement('div');
    b.className = 'banner banner-update';
    b.setAttribute('data-testid', 'update-banner');
    els.banners.prepend(b);
  }
  b.innerHTML = `<span class="banner-ico">🔄</span><span class="banner-text"></span>
    <button type="button" class="btn btn-sm btn-primary" data-a="go"></button>
    ${persistent ? '' : '<button type="button" class="icon-btn sm" data-a="x" aria-label="סגור">✕</button>'}`;
  b.querySelector('.banner-text').textContent = text;
  b.querySelector('[data-a="go"]').textContent = button;
  b.onclick = (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'x') b.remove();
    else if (onClick) onClick();
  };
}

export function hideUpdateBanner() {
  const b = els.banners && els.banners.querySelector('[data-testid="update-banner"]');
  if (b) b.remove();
}

/** Announcement banner from remote config. Text always rendered with textContent. */
export function showAnnouncement(ann) {
  if (!els.banners) return;
  let b = els.banners.querySelector('[data-testid="announcement"]');
  const dismissed = (ctx.settings && ctx.settings.dismissed) || [];
  if (!ann || !ann.enabled || !ann.textHe || (ann.id && dismissed.includes(ann.id))) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div');
    b.setAttribute('data-testid', 'announcement');
    els.banners.appendChild(b);
  }
  b.className = 'banner banner-ann' + (ann.level === 'warn' ? ' warn' : '');
  b.innerHTML = '<span class="banner-ico">📣</span><span class="banner-text"></span><button type="button" class="icon-btn sm" data-a="x" aria-label="סגור">✕</button>';
  const textEl = b.querySelector('.banner-text');
  const link = typeof ann.link === 'string' && (/^https:\/\//i.test(ann.link) || ann.link.startsWith('./') || ann.link.startsWith('#/')) ? ann.link : '';
  if (link) {
    const a = document.createElement('a');
    a.href = link;
    if (/^https:/i.test(link)) { a.target = '_blank'; a.rel = 'noopener'; }
    a.textContent = String(ann.textHe);
    textEl.appendChild(a);
  } else textEl.textContent = String(ann.textHe);
  b.onclick = (e) => {
    const x = e.target.closest('[data-a="x"]');
    if (!x) return;
    if (ann.id) saveSettings({ dismissed: [...dismissed.filter((d) => d !== ann.id), ann.id] });
    b.remove();
  };
}

/** Hide banners on the match screen (focus), show elsewhere. */
export function setBannersVisible(v) { if (els.banners) els.banners.hidden = !v; }

/* ------------------------------------------------------------------ */
/* Friendly error screen                                               */
/* ------------------------------------------------------------------ */

export function showErrorScreen(err, target) {
  console.warn('[hayeled] screen error', err);
  const root = target || els.view || document.getElementById('app');
  if (!root) return;
  setTabs(false);
  try { resetHeader({ title: 'אופס', header: false }); } catch { /* ignore */ }
  const hasCareer = (() => { try { return game.hasCareer(); } catch { return false; } })();
  root.innerHTML = `
    <div class="err-screen">
      <div class="err-ico">🤕</div>
      <h1>אופס! משהו השתבש</h1>
      <p>נתקלנו בתקלה בהצגת המסך. ${hasCareer ? 'הקריירה שלך שמורה במכשיר.' : ''}</p>
      <p class="muted small">אם זה חוזר, כדאי לייצא גיבוי של השמירה לפני שממשיכים.</p>
      <div class="btn-col">
        <button type="button" class="btn btn-primary btn-lg" data-a="reload">נסה שוב</button>
        ${hasCareer ? '<button type="button" class="btn" data-a="export">ייצוא שמירה (קובץ)</button>' : ''}
        <button type="button" class="btn btn-ghost" data-a="title">למסך הפתיחה</button>
      </div>
      <details class="err-details"><summary>פרטים טכניים</summary><pre></pre></details>
    </div>`;
  const pre = root.querySelector('pre');
  if (pre) pre.textContent = String((err && (err.stack || err.message)) || err || '').slice(0, 1500);
  root.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'reload') location.reload();
    else if (b.dataset.a === 'title') { location.hash = '#/title'; }
    else if (b.dataset.a === 'export') {
      try { if (ctx.hooks.exportActive) await ctx.hooks.exportActive(); else throw new Error('no export'); }
      catch (e2) {
        try {
          const data = game.serialize();
          const dataJSON = JSON.stringify(data);
          let hsh = 0x811c9dc5;
          for (let i = 0; i < dataJSON.length; i++) { hsh ^= dataJSON.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
          const sum = (hsh >>> 0).toString(16).padStart(8, '0');
          let meta = null;
          try { meta = game.getSaveMeta(); } catch { meta = null; }
          const obj = { format: 'hy-save', v: game.SCHEMA_VERSION, app: '', exportedAt: Date.now(), meta, sum, data };
          const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'hayeled-emergency-save.json';
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e3) { toast('הייצוא נכשל'); }
      }
    }
  };
}

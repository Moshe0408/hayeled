// main.js: boot sequence, autosave, lifecycle hooks, service worker update flow, remote config wiring (SPEC §9.2).
import * as game from './engine/game.js';
import * as save from './core/save.js';
import { APP_VERSION } from './config.js';
import {
  ctx, svc, initShell, loadSettings, saveSettings, toast, overlay, showUpdateBanner, showAnnouncement,
  call, showErrorScreen, viewRoot, hubSafe, snapshotOnOpen,
} from './ui/app.js';
import { startRouter, setGuard, onRoute, isKnownHash, currentRoute } from './ui/router.js';
import { initInstall } from './ui/install.js';
import { refreshGender, careerGender } from './ui/gender.js';
import { playIntro } from './ui/scene/intro.js';
import * as daily from './core/daily.js';

const PUBLIC_ROUTES = new Set(['/title', '/new', '/hof', '/settings', '/feedback', '/install', '/leaderboard', '/friends', '/friends/join']);
const AUTOSAVE_MS = 400;

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

let saveTimer = null;

function scheduleSave() {
  if (!ctx.activeSlot || ctx.blocked) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, AUTOSAVE_MS);
}

function cancelAutosave() {
  clearTimeout(saveTimer);
  saveTimer = null;
}

/** Synchronous save of the career in memory to the active slot (LS now, IDB queued). */
function saveNow() {
  cancelAutosave();
  if (!ctx.activeSlot || ctx.blocked) return null;
  let has = false;
  try { has = game.hasCareer(); } catch { has = false; }
  if (!has) return null;
  try {
    const res = save.saveSlot(ctx.activeSlot, game.serialize(), game.getSaveMeta(), { onQuota: (lvl) => game.compactState(lvl) });
    if (res && res.warn === 'blocked_other_tab') showOtherTab();
    else if (res && res.warn === 'too_new') offerUpdate({ text: 'השמירה נוצרה בגרסה חדשה יותר של המשחק. כדאי לרענן כדי לעדכן.', persistent: true });
    return res;
  } catch (e) {
    console.warn('[hayeled] save failed', e);
    return null;
  }
}

async function flushAll() {
  try { await save.flushPending(); } catch (e) { console.warn('[hayeled] flushPending', e); }
}

/* ------------------------------------------------------------------ */
/* Hall of Fame safety net                                             */
/* ------------------------------------------------------------------ */

const hofRecorded = new Set();

async function recordHof() {
  try {
    const entry = game.buildHallOfFameEntry();
    if (entry) await save.addHallOfFame(entry);
    return true;
  } catch (e) {
    console.warn('[hayeled] HoF', e);
    return false;
  }
}

function onGameChange() {
  scheduleSave();
  try {
    const meta = game.getSaveMeta();
    if (meta && meta.retired && meta.careerId && !hofRecorded.has(meta.careerId)) {
      hofRecorded.add(meta.careerId);
      recordHof();
    }
  } catch { /* no career */ }
}

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

/** R2: a retired career that is coaching (or between coaching jobs) lives on #/manager; while the coaching offers
 *  are still open (st 'offers') the retirement screen shows them. */
function managerActive(hub) {
  const m = hub && hub.manager;
  return !!(m && (m.st === 'active' || m.st === 'unemployed'));
}

function routeForState() {
  const hub = hubSafe();
  if (!hub) return '#/title';
  switch (hub.status) {
    case 'match': return '#/match';
    case 'review': return '#/season';
    case 'retired': return managerActive(hub) ? '#/manager' : '#/retire';
    default: return '#/hub';
  }
}

/** Load a slot into the engine. Returns { ok, error?, messageHe? }. */
async function openSlot(slot, { quiet = false } = {}) {
  let has = false;
  try { has = game.hasCareer(); } catch { has = false; }
  if (has && ctx.activeSlot && ctx.activeSlot !== slot) { saveNow(); await flushAll(); }
  cancelAutosave();
  let r;
  try { r = await save.loadSlot(slot); } catch (e) { console.warn(e); r = { ok: false, error: 'corrupt', messageHe: 'לא הצלחנו לקרוא את השמירה.' }; }
  if (!r || !r.ok) {
    if (r && r.error === 'too_new') offerUpdate({ text: r.messageHe || 'השמירה נוצרה בגרסה חדשה יותר של המשחק. כדאי לרענן כדי לעדכן.', persistent: true });
    else if (r && r.error === 'corrupt') toast(r.messageHe || 'השמירה נפגמה. אפשר לנסות "שמירה קודמת" או ייבוא גיבוי מההגדרות.');
    else if (!quiet && r && r.messageHe) toast(r.messageHe);
    return r || { ok: false, error: 'empty' };
  }
  const lr = call(() => game.loadState(r.state), { quiet: true });
  if (!lr || !lr.ok) {
    toast((lr && lr.messageHe) || 'לא הצלחנו לטעון את הקריירה.');
    return { ok: false, error: 'bad_state', messageHe: lr && lr.messageHe };
  }
  ctx.activeSlot = slot;
  ctx.blocked = false;
  refreshGender();
  saveSettings({ lastSlot: slot });
  // only a real rescue deserves a message: the main copy (localStorage) was missing or stale and IndexedDB saved the day.
  // A lagging IndexedDB mirror is healed silently.
  if (r.repaired && r.source === 'idb') toast('שחזרנו את השמירה שלך מהגיבוי במכשיר ✓', { ms: 4500 });
  if (r.migratedFrom !== null && r.migratedFrom !== undefined) saveNow();
  import('./core/friends.js').then((m) => m.syncMyCareer({})).catch(() => {});
  onGameChange(); // HoF safety net for retired careers
  snapshotOnOpen(); // v2.2: one career_snapshot per telemetry session (consent + backend checked inside)
  cancelAutosave();
  return { ok: true };
}

/** v2.3 fast start: game.quickCareer (engine defaults: Israel, ST, top-6 club, youth star). Older engines: newCareer. */
function createCareer(opts, quick) {
  if (quick && typeof game.quickCareer === 'function') return game.quickCareer(opts);
  if (quick) {
    const o = { nation: 'isr', pos: 'ST', foot: 'R', ...opts };
    if (!o.club) {
      try { const g = game.getAcademyOptions('isr', { gender: o.gender }).groups[0]; o.club = g && g.clubs[0] && g.clubs[0].id; } catch { /* engine decides */ }
    }
    return game.newCareer(o);
  }
  return game.newCareer(opts);
}

/** New career flow (SPEC §9.2 step 9). opts3.quick: the v2.3 two-step fast start. */
async function startNewCareer(opts, slot, opts3 = {}) {
  let has = false;
  try { has = game.hasCareer(); } catch { has = false; }
  if (has && ctx.activeSlot) { saveNow(); await flushAll(); }
  cancelAutosave();
  const prevSlot = ctx.activeSlot;
  // Check the target slot before creating, so the old career is soft-deleted (recoverable) before any write.
  let occupied = false;
  try {
    const slots = await save.listSlots();
    const s = slots.find((x) => x.slot === slot);
    occupied = !!(s && (!s.empty || s.corrupt || s.tooNew));
  } catch (e) { console.warn(e); }
  ctx.activeSlot = null;
  const res = call(() => createCareer(opts, !!(opts3 && opts3.quick)));
  if (!res || !res.ok) {
    try { if (game.hasCareer() && prevSlot) ctx.activeSlot = prevSlot; } catch { /* ignore */ }
    return res || { ok: false, messageHe: 'לא הצלחנו ליצור את הקריירה. אפשר לנסות שוב.' };
  }
  cancelAutosave();
  refreshGender();
  if (occupied) {
    try { await save.deleteSlot(slot); } catch (e) { console.warn('[hayeled] deleteSlot', e); }
  }
  ctx.activeSlot = slot;
  ctx.blocked = false;
  saveSettings({ lastSlot: slot });
  saveNow();
  flushAll();
  maybePersist(true);
  return res;
}

/**
 * Run a storage operation on a slot, following the active-slot rule (SPEC §7.3).
 * kind: 'restore' | 'delete' | 'import' (fn returns a LoadResult) | 'other'
 */
async function slotOp(slot, fn, kind = 'restore') {
  let active = false;
  try { active = slot === ctx.activeSlot && game.hasCareer(); } catch { active = false; }
  if (active) cancelAutosave();
  else { saveNow(); }
  let res;
  try { res = await fn(); } catch (e) { console.warn(e); res = { ok: false, messageHe: 'הפעולה נכשלה' }; }
  if (active) {
    if (kind === 'delete') {
      cancelAutosave();
      try { game.closeCareer(); } catch { /* ignore */ }
      ctx.activeSlot = null;
      saveSettings({ lastSlot: null });
    } else if (res && res.ok && res.state) {
      const lr = call(() => game.loadState(res.state), { quiet: true });
      cancelAutosave();
      if (!lr || !lr.ok) toast((lr && lr.messageHe) || 'לא הצלחנו לטעון את השמירה ששוחזרה');
    }
  }
  refreshGender();
  return res;
}

/** After importBackup: reload the active slot from storage if it was overwritten. */
async function reloadActive() {
  if (!ctx.activeSlot) return;
  const slot = ctx.activeSlot;
  cancelAutosave();
  const r = await save.loadSlot(slot);
  if (r && r.ok) call(() => game.loadState(r.state), { quiet: true });
  cancelAutosave();
  refreshGender();
}

async function exportActive() {
  if (!ctx.activeSlot) throw new Error('no active slot');
  saveNow();
  await flushAll();
  const { filename, json } = await save.exportSlotJSON(ctx.activeSlot);
  save.downloadFile(filename, json);
}

/* ------------------------------------------------------------------ */
/* Storage persistence                                                 */
/* ------------------------------------------------------------------ */

let persistAsked = false;
async function maybePersist(force = false) {
  if (persistAsked && !force) return null;
  persistAsked = true;
  try {
    if (navigator.storage && navigator.storage.persisted && (await navigator.storage.persisted())) return 'granted';
  } catch { /* ignore */ }
  try { return await save.requestPersist(); } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Other tab                                                           */
/* ------------------------------------------------------------------ */

function showOtherTab() {
  if (ctx.blocked) return;
  ctx.blocked = true;
  cancelAutosave();
  const o = overlay(`
    <div class="big-ico">🗂️</div>
    <h2>המשחק פתוח בלשונית אחרת</h2>
    <p>המשחק פתוח בלשונית אחרת. המשך שם, או טען מחדש כאן.</p>
    <button type="button" class="btn btn-primary btn-lg" data-testid="btn-other-tab-reload">טען מחדש</button>`, { testid: 'other-tab', cls: 'blocking' });
  o.el.addEventListener('click', (e) => { if (e.target.closest('[data-testid="btn-other-tab-reload"]')) location.reload(); });
}

/* ------------------------------------------------------------------ */
/* Service worker + update flow (SPEC §7.8)                            */
/* ------------------------------------------------------------------ */

let reg = null;
let userRequestedUpdate = false;
let reloading = false;

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userRequestedUpdate || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((r) => {
    reg = r;
    ctx.reg = r;
    if (r.waiting && navigator.serviceWorker.controller) offerUpdate();
    r.addEventListener('updatefound', () => {
      const nw = r.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
      });
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') r.update().catch(() => {});
    }, 30 * 60 * 1000);
  }).catch((e) => console.warn('[hayeled] SW registration failed', e));
}

function offerUpdate({ text = 'גרסה חדשה זמינה', persistent = false } = {}) {
  showUpdateBanner({ text, button: 'עדכן עכשיו', persistent, onClick: applyUpdate });
}

async function applyUpdate() {
  saveNow();
  await flushAll();
  const w = reg && reg.waiting;
  if (w) {
    userRequestedUpdate = true;
    try { svc.telemetry.track('update_applied', { from: APP_VERSION, to: '' }); } catch { /* ignore */ }
    try { await svc.telemetry.flush({ keepalive: true }); } catch { /* ignore */ }
    w.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => { if (!reloading) { reloading = true; location.reload(); } }, 4000);
    return;
  }
  try { if (reg) await reg.update(); } catch { /* ignore */ }
  if (reg && reg.waiting) {
    userRequestedUpdate = true;
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => { if (!reloading) { reloading = true; location.reload(); } }, 4000);
    return;
  }
  reloading = true;
  location.reload();
}

/** Settings 'בדוק עדכונים'. */
async function checkUpdates() {
  if (!reg) { toast('בדיקת עדכונים לא זמינה בדפדפן הזה'); return; }
  try { await reg.update(); } catch { toast('אין חיבור לרשת כרגע'); return; }
  if (reg.waiting) { offerUpdate(); toast('יש גרסה חדשה! הכפתור "עדכן עכשיו" למעלה'); }
  else if (reg.installing) toast('מוריד גרסה חדשה...');
  else toast('יש לך את הגרסה האחרונה ✓');
}

/* ------------------------------------------------------------------ */
/* Remote config, ads, announcement, version check                     */
/* ------------------------------------------------------------------ */

function applyRemote(cfg) {
  if (!cfg) return;
  try { svc.ads.initAds(cfg.ads, { track: svc.telemetry.track, adsConsent: !!(ctx.settings && ctx.settings.adsConsent) }); } catch (e) { console.warn('[hayeled] ads', e); }
  try { showAnnouncement(cfg.announcement); } catch (e) { console.warn(e); }
  try {
    const v = cfg.version;
    const cmp = svc.remote.compareVersions;
    if (v && cmp) {
      if (cmp(APP_VERSION, v.min || '0.0.0') < 0) {
        offerUpdate({ text: v.messageHe || 'יש גרסה חדשה. מרעננים כדי לעדכן', persistent: true });
        if (reg) reg.update().catch(() => {});
      } else if (cmp(APP_VERSION, v.latest || '0.0.0') < 0) {
        offerUpdate({ text: v.messageHe || 'יש גרסה חדשה. מרעננים כדי לעדכן' });
        if (reg) reg.update().catch(() => {});
      }
    }
  } catch (e) { console.warn(e); }
}

function reinitAds() {
  try { applyRemote(svc.remote.getRemoteConfig()); } catch (e) { console.warn(e); }
}

/* ------------------------------------------------------------------ */
/* Optional online modules (loaded defensively: a broken backend file must never break the game)  */
/* ------------------------------------------------------------------ */

async function loadServices() {
  const list = [
    ['telemetry', () => import('./core/telemetry.js')],
    ['remote', () => import('./core/remote.js')],
    ['feedback', () => import('./core/feedback.js')],
    ['ads', () => import('./core/ads.js')],
  ];
  await Promise.all(list.map(async ([k, load]) => {
    try {
      const m = await load();
      svc[k] = { ...svc[k], ...m };
    } catch (e) {
      console.warn('[hayeled] optional module failed to load:', k, e);
    }
  }));
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function onHide() {
  saveNow();
  flushAll();
  try {
    const p = svc.telemetry.flush({ keepalive: true });
    if (p && p.catch) p.catch(() => {});
  } catch { /* ignore */ }
}

function wireLifecycle() {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); });
  window.addEventListener('pagehide', onHide);
  document.addEventListener('freeze', onHide);
  window.addEventListener('online', () => {
    try { const p = svc.feedback.flushFeedbackQueue(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  });
  window.addEventListener('error', (e) => { console.warn('[hayeled] error', e && (e.error || e.message)); });
  window.addEventListener('unhandledrejection', (e) => { console.warn('[hayeled] unhandled rejection', e && e.reason); });
}

/* ------------------------------------------------------------------ */
/* Router guard                                                        */
/* ------------------------------------------------------------------ */

function guard(info) {
  let has = false;
  try { has = game.hasCareer(); } catch { has = false; }
  if (info.path === '*') return has ? '#/hub' : '#/title';
  if (!PUBLIC_ROUTES.has(info.path) && !info.path.startsWith('/friends/') && !has) return '#/title';
  if (has) {
    const hub = hubSafe();
    if (hub && hub.status === 'retired' && ['/hub', '/match', '/season', '/offers'].includes(info.path)) return managerActive(hub) ? '#/manager' : '#/retire';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/** Play the intro on every app open (R1) unless tests skip it ('hy.intro.skip' = '1').
 *  Never blocks boot for more than 14 s, never throws. Resolves { played, done }. */
async function startIntro(gender) {
  let skip = false;
  try { skip = localStorage.getItem('hy.intro.skip') === '1'; } catch { skip = false; }
  if (skip || typeof playIntro !== 'function') return { played: false, done: false };
  let p;
  // v2.3 review: the full 8 s on the first visit; afterwards the last 3 s (the logo), and only 2 s for a challenge link
  let seen = false, ch = false;
  try { seen = !!localStorage.getItem('hy.intro.seen'); } catch { seen = false; }
  try { ch = /[?&]c=/.test(location.search); } catch { ch = false; }
  const startAt = ch ? 6 : seen ? 5 : 0;
  try { p = Promise.resolve(playIntro(Object.assign(gender ? { gender } : {}, startAt ? { startAt } : {}))); } catch (e) { console.warn('[hayeled] intro', e); return { played: false, done: false }; }
  const r = await Promise.race([p.catch((e) => { console.warn('[hayeled] intro', e); return null; }), new Promise((res) => setTimeout(() => res(null), 14000))]);
  // a run that failed to render (or timed out) is neither "watched" nor "skipped": not tracked
  const res = { played: !!r && !r.off && !r.failed, done: !!(r && r.done) };
  if (res.played) { try { svc.telemetry.track('intro', { done: res.done }); } catch { /* ignore */ } }
  return res;
}

async function boot() {
  const appEl = document.getElementById('app');
  initShell(appEl);
  loadSettings();
  wireLifecycle();

  ctx.hooks = {
    saveNow, scheduleSave, cancelAutosave, flush: flushAll, startNewCareer, openSlot, routeForState, slotOp,
    applyUpdate, checkUpdates, requestPersist: maybePersist, exportActive, recordHof, reinitAds, reloadActive,
  };

  // 1. Storage
  save.configure({ schemaVersion: game.SCHEMA_VERSION, appVersion: APP_VERSION, migrate: game.migrateState });
  try { ctx.storage = await save.initStorage(); } catch (e) { console.warn('[hayeled] initStorage', e); ctx.storage = { ls: false, idb: false }; }

  // v2.3: the daily-reward streak lives outside the slots (localStorage + IndexedDB mirror)
  try { await daily.sync(); } catch (e) { console.warn('[hayeled] daily', e); }

  // 2. Service worker
  registerSW();

  // 3. Online services (all silent no-ops without a backend)
  await loadServices();
  try { svc.telemetry.initTelemetry({ appVersion: APP_VERSION }); } catch (e) { console.warn(e); }
  try { applyRemote(svc.remote.getRemoteConfig()); } catch (e) { console.warn(e); }
  try { svc.remote.onRemoteConfig((cfg) => applyRemote(cfg)); } catch (e) { console.warn(e); }
  try { const p = svc.remote.loadRemoteConfig(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  try { const p = svc.feedback.flushFeedbackQueue(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  // v2.3: leaderboard submissions that waited for the network (no-op without a backend)
  import('./core/leaderboard.js').then((m) => m.flushPending && m.flushPending()).catch(() => {});

  // 4. Install prompt capture
  try { initInstall(); } catch (e) { console.warn(e); }

  // 6/8. Autosave + storage warnings + other tab
  game.subscribe(onGameChange);
  try { save.onWarning((w) => { if (w && w.messageHe) toast(w.messageHe, { ms: 6000, tone: 'warn' }); }); } catch (e) { console.warn(e); }
  try { save.onExternalWrite((w) => { if (w && ctx.activeSlot && w.slot === ctx.activeSlot) showOtherTab(); }); } catch (e) { console.warn(e); }

  // 10. Debug handle
  window.__hy = { game, save, telemetry: svc.telemetry, remote: svc.remote, ads: svc.ads, feedback: svc.feedback, version: APP_VERSION, saveNow, ctx };

  // 5. Load the last slot and pick the first route
  const startHash = location.hash;
  const startInfo = (() => { try { return currentRoute(); } catch { return { path: '' }; } })();
  let initial = '#/title';
  const last = ctx.settings.lastSlot;
  let loaded = false;
  if (last) {
    const r = await openSlot(last, { quiet: true });
    loaded = !!(r && r.ok);
  }
  if (loaded) {
    const forced = routeForState();
    if (forced !== '#/hub') initial = forced;
    else if (startHash && isKnownHash(startHash) && !['/title', '/new', '/match', '/retire', '/season'].includes(startInfo.path)) initial = startHash;
    else initial = '#/hub';
  } else if (startHash && isKnownHash(startHash) && PUBLIC_ROUTES.has(startInfo.path) && startInfo.path !== '/new') {
    initial = startHash;
  }

  // Opening cinematic (contract C8): the first screen is shown when it ends (or is skipped).
  refreshGender();
  const intro = await startIntro(careerGender());
  // R1: every real app open goes intro -> title screen (gold "המשך קריירה" first). Deep links to the public
  // screens (settings, Hall of Fame, feedback, install) are kept. With the test flag 'hy.intro.skip' the
  // v2 resume behaviour stays (straight back to the career), which the e2e persistence scenarios rely on.
  if (intro.played && !(PUBLIC_ROUTES.has(startInfo.path) && !['/title', '/new'].includes(startInfo.path) && isKnownHash(startHash))) initial = '#/title';
  // v2.3 (F11): a challenge link (?c=<code>) always opens on the title screen, where the challenge card waits
  try { if (/[?&]c=/.test(location.search)) initial = '#/title'; } catch { /* ignore */ }
  // friends league invite (?league=CODE): open the join card; also push this career to my leagues
  try {
    const fr = await import('./core/friends.js');
    const leagueCode = fr.handleLeagueParam();
    if (leagueCode) initial = '#/friends/join?code=' + leagueCode;
    fr.syncMyCareer().then(() => fr.refreshLeagues()).catch(() => {});
  } catch { /* optional module */ }
  setGuard(guard);
  onRoute((info) => {
    if (info.path === '/hub') {
      let has = false;
      try { has = game.hasCareer(); } catch { has = false; }
      if (has) maybePersist(false);
    }
  });
  startRouter(viewRoot(), { initial });
  window.__hyBooted = true;
}

boot().catch((e) => {
  window.__hyBooted = true;
  console.warn('[hayeled] boot failed', e);
  try { showErrorScreen(e); } catch {
    const app = document.getElementById('app');
    if (app) app.textContent = 'המשחק לא נטען. כדאי לרענן את הדף.';
  }
});

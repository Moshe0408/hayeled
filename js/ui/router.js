// router.js: hash router with lazy screen modules.
// Dynamic import specifiers below resolve relative to this file (js/ui/).
import { resetHeader, setTabs, setBannersVisible, showErrorScreen, closeAllModals } from './app.js';
import { refreshGender, careerGender } from './gender.js';

const routes = [];
let rootEl = null;
let guard = null;
let cleanup = null;
let token = 0;
const listeners = [];
let currentMeta = {};

/**
 * route(pattern, loader, meta)
 * pattern: '/tables/:compId'; loader: () => import('./x.js'); meta: { tabs, tab, title, back, gear, header, banners }
 */
export function route(pattern, loader, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, keys, loader, meta });
}

/** Parse the current hash into { path, params, query }. */
export function currentRoute() {
  return parseHash(location.hash);
}

function parseHash(hash) {
  let h = String(hash || '').replace(/^#/, '');
  if (!h.startsWith('/')) h = '/' + h;
  const qi = h.indexOf('?');
  const pathPart = qi >= 0 ? h.slice(0, qi) : h;
  const query = {};
  if (qi >= 0) {
    for (const [k, v] of new URLSearchParams(h.slice(qi + 1))) query[k] = v;
  }
  for (const r of routes) {
    const m = r.re.exec(pathPart);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
      return { path: r.pattern, raw: pathPart, params, query, route: r };
    }
  }
  return { path: pathPart, raw: pathPart, params: {}, query, route: null };
}

/** Is this hash a known route? */
export function isKnownHash(hash) {
  return !!parseHash(hash).route;
}

/** Navigate to a hash. Re-renders if it is already the current hash. */
export function navigate(hash, { replace = false } = {}) {
  if (!hash) return;
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (location.hash === hash) { renderCurrent(); return; }
  if (replace) {
    try { history.replaceState(history.state, '', hash); } catch { location.replace(hash); return; }
    renderCurrent();
  } else {
    location.hash = hash;
  }
}

/** Re-render the current screen. */
export function rerender() { renderCurrent(); }

/** guard(routeInfo) -> redirect hash | null */
export function setGuard(fn) { guard = fn; }

/** onRoute(cb) -> unsubscribe; cb(routeInfo) after each render. */
export function onRoute(cb) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}

export function currentMetaInfo() { return currentMeta; }

export function startRouter(root, { initial } = {}) {
  rootEl = root;
  window.addEventListener('hashchange', renderCurrent);
  if (initial) navigate(initial, { replace: true });
  else renderCurrent();
}

async function renderCurrent() {
  if (!rootEl) return;
  const my = ++token;
  const info = currentRoute();
  if (!info.route) { navigate(guard ? (guard({ path: '*' }) || '#/title') : '#/title', { replace: true }); return; }
  if (guard) {
    let redirect = null;
    try { redirect = guard(info); } catch (e) { console.warn('[hayeled] guard', e); }
    if (redirect && redirect !== location.hash) { navigate(redirect, { replace: true }); return; }
  }
  let mod;
  try {
    mod = await info.route.loader();
  } catch (e) {
    if (my !== token) return;
    runCleanup();
    showErrorScreen(e, rootEl);
    return;
  }
  if (my !== token) return;
  runCleanup();
  closeAllModalsSafe(info);
  refreshGender();
  try { document.documentElement.dataset.g = careerGender() || ''; } catch { /* ignore */ }
  const meta = info.route.meta || {};
  currentMeta = meta;
  resetHeader(meta);
  setTabs(meta.tabs !== false, meta.tab || null);
  setBannersVisible(meta.banners !== false);
  const view = document.createElement('div');
  view.className = 'screen screen-' + (info.path.split('/')[1] || 'x');
  rootEl.replaceChildren(view);
  try { window.scrollTo(0, 0); } catch { /* ignore */ }
  try {
    const r = mod.render(view, { ...info.params, ...info.query });
    if (r && typeof r.then === 'function') {
      r.then((c) => { if (typeof c === 'function') { if (my === token) cleanup = c; else c(); } })
        .catch((e) => { if (my === token) showErrorScreen(e, view); });
    } else if (typeof r === 'function') cleanup = r;
  } catch (e) {
    showErrorScreen(e, view);
  }
  for (const cb of listeners.slice()) { try { cb(info); } catch (e) { console.warn(e); } }
}

function runCleanup() {
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } }
  cleanup = null;
}

function closeAllModalsSafe(info) {
  // Modals belong to the previous screen, except ones marked as persistent (week summary opened after navigation).
  if (info && info.query && info.query.keepModal) return;
  try { closeAllModals(); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Route table                                                         */
/* ------------------------------------------------------------------ */

route('/title', () => import('./title.js'), { tabs: false, header: false });
route('/new', () => import('./create.js'), { tabs: false, title: 'קריירה חדשה', back: '#/title' });
route('/hub', () => import('./hub.js'), { tab: 'hub', title: '{{הילד|הילדה}} מהשכונה', gear: true });
route('/match', () => import('./match.js'), { tabs: false, header: false, banners: false });
route('/season', () => import('./week.js'), { tab: 'hub', title: 'סיכום העונה' });
route('/inbox', () => import('./inbox.js'), { tab: 'inbox', title: 'הודעות', back: '#/hub' });
route('/chat/:id', () => import('./inbox.js'), { tab: 'inbox', title: 'צ׳אט', back: '#/inbox' });
route('/schedule', () => import('./schedule.js'), { tab: 'schedule', title: 'לוח המשחקים', back: '#/hub' });
route('/tables', () => import('./tables.js'), { tab: 'tables', title: 'טבלאות', back: '#/hub' });
route('/tables/:compId', () => import('./tables.js'), { tab: 'tables', title: 'טבלה', back: '#/tables' });
route('/career', () => import('./career.js'), { tab: 'career', title: 'הקריירה שלי', back: '#/hub' });
route('/profile', () => import('./profile.js'), { tab: 'hub', title: 'הפרופיל שלי', back: '#/hub' });
route('/national', () => import('./national.js'), { tab: 'hub', title: 'הנבחרת', back: '#/hub' });
route('/offers', () => import('./offers.js'), { tab: 'hub', title: 'הצעות וחוזה', back: '#/hub' });
route('/awards', () => import('./awards.js'), { tab: 'career', title: 'פרסים', back: '#/career' });
route('/shop', () => import('./shop.js'), { tab: 'hub', title: 'החנות', back: '#/hub' });
route('/hof', () => import('./hof.js'), { title: 'היכל התהילה', back: 'home' });
route('/settings', () => import('./settings.js'), { title: 'הגדרות', back: 'home' });
route('/feedback', () => import('./feedback.js'), { title: 'משוב', back: 'home' });
route('/install', () => import('./install.js'), { tabs: false, title: 'התקנה למסך הבית', back: 'home' });
route('/retire', () => import('./retire.js'), { tabs: false, header: false });

// sw.js: service worker of "הילד מהשכונה" (SPEC §7.8).
// Works under a sub-path (https://moshe0408.github.io/hayeled/) and at the root: every path is
// relative to self.registration.scope. CacheStorage is shared by the whole *.github.io origin,
// so every cache name starts with 'hayeled-' and caches of other apps are never touched.

const VERSION = '1.0.0';                 // MUST equal APP_VERSION in js/config.js (publish.ps1 bumps both)
const CACHE = 'hayeled-' + VERSION;
const FONT_CACHE = 'hayeled-fonts-v1';
const PRECACHE = [ './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './js/main.js', './js/config.js',
  './js/core/rng.js', './js/core/save.js', './js/core/idb.js', './js/core/supa.js', './js/core/telemetry.js', './js/core/remote.js', './js/core/feedback.js', './js/core/ads.js',
  './js/data/countries.js', './js/data/leagues.js', './js/data/names.js', './js/data/events.js', './js/data/commentary.js', './js/data/strings.js',
  './js/engine/game.js', './js/engine/state.js', './js/engine/util.js', './js/engine/calendar.js', './js/engine/schedule.js', './js/engine/sim.js',
  './js/engine/world.js', './js/engine/player.js', './js/engine/selection.js', './js/engine/moments.js', './js/engine/match.js', './js/engine/transfers.js',
  './js/engine/europe.js', './js/engine/cups.js', './js/engine/national.js', './js/engine/awards.js', './js/engine/narrative.js', './js/engine/history.js', './js/engine/shop.js',
  './js/ui/dom.js', './js/ui/router.js', './js/ui/app.js', './js/ui/components.js', './js/ui/format.js', './js/ui/title.js', './js/ui/create.js', './js/ui/hub.js',
  './js/ui/week.js', './js/ui/match.js', './js/ui/inbox.js', './js/ui/schedule.js', './js/ui/tables.js', './js/ui/career.js', './js/ui/profile.js', './js/ui/national.js',
  './js/ui/offers.js', './js/ui/awards.js', './js/ui/shop.js', './js/ui/hof.js', './js/ui/settings.js', './js/ui/feedback.js', './js/ui/install.js', './js/ui/adslots.js', './js/ui/retire.js' ];

// Files without which the offline game cannot start: install fails (and is retried by the browser) if these fail.
const CRITICAL = ['./', './index.html', './js/main.js', './js/engine/game.js', './css/app.css'];

// Same-origin paths that are never intercepted (network only).
const BYPASS_PREFIXES = ['js/admin/', 'css/admin.css', 'tests/', 'docs/', 'supabase/', 'tools/'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NAV_TIMEOUT_MS = 3000;

function scopeURL() {
  return new URL(self.registration.scope);
}

// Path of `url` relative to the scope, or null if it is outside the scope.
function relPath(url) {
  const base = scopeURL().pathname;          // '/hayeled/' or '/'
  if (!url.pathname.startsWith(base)) return null;
  let rel = url.pathname.slice(base.length);
  try { rel = decodeURIComponent(rel); } catch { /* keep raw */ }
  return rel;
}

function isBypassed(rel) {
  return rel === 'admin.html' || BYPASS_PREFIXES.some((p) => rel.startsWith(p));
}

const reloadRequest = (u) => new Request(new URL(u, self.registration.scope).href, { cache: 'reload' });

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(PRECACHE.map(reloadRequest));
    } catch (e) {
      // One missing file must not break offline play: add one by one, require only the critical ones.
      const results = await Promise.all(PRECACHE.map(async (u) => {
        try {
          const res = await fetch(reloadRequest(u));
          if (!res.ok) throw new Error(res.status + ' ' + u);
          await cache.put(new URL(u, self.registration.scope).href, res);
          return { u, ok: true };
        } catch {
          return { u, ok: false };
        }
      }));
      const missingCritical = results.filter((r) => !r.ok && CRITICAL.includes(r.u));
      if (missingCritical.length) throw e;
    }
    // No automatic skipWaiting: the page asks the player first ('גרסה חדשה זמינה').
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('hayeled-') && n !== CACHE && n !== FONT_CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) {
      try { c.postMessage({ type: 'SW_ACTIVATED', version: VERSION }); } catch { /* ignore */ }
    }
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    try { event.source && event.source.postMessage({ type: 'SW_VERSION', version: VERSION }); } catch { /* ignore */ }
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // Cross-origin: only Google Fonts are handled. Supabase, AdSense and house-ad images are never intercepted.
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(req, event));
    return;
  }

  const rel = relPath(url);
  if (rel === null) return;                 // another app on the same origin
  if (isBypassed(rel)) return;              // admin, tests, docs, supabase: network only (before the nav fallback)
  if (req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function networkFirstNavigation(req) {
  const fallback = async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(new URL('./index.html', self.registration.scope).href, { ignoreSearch: true }))
      || (await cache.match(new URL('./', self.registration.scope).href, { ignoreSearch: true }));
  };
  try {
    const net = fetch(req);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
    const res = await Promise.race([net.catch(() => null), timeout]);
    // Fresh page when the network answers in time (404 / 5xx fall back to the cached shell).
    if (res && res.status !== 404 && res.status < 500) return res;
    const cached = await fallback();
    if (cached) return cached;
    return res || await net;
  } catch {
    const cached = await fallback();
    if (cached) return cached;
    return new Response('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>הילד מהשכונה</title>' +
      '<body style="background:#0b1220;color:#fff;font-family:sans-serif;text-align:center;padding:40px">' +
      '<h1>אין חיבור לרשת</h1><p>פתח את המשחק פעם אחת עם חיבור לאינטרנט כדי שיעבוד גם בלי רשת.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      // Runtime fill: protects against a file accidentally missing from PRECACHE.
      const u = new URL(req.url);
      u.search = '';
      cache.put(u.href, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  const res = await update;
  return res || new Response('', { status: 504, statusText: 'offline' });
}

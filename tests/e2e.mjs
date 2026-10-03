// tests/e2e.mjs: end-to-end browser test (SPEC §10.2). Integrate agent.
// Usage: node tests/e2e.mjs [--only a|b|c|d] [--headful]
// Env:   PUPPETEER_CORE_PATH  absolute path of a puppeteer-core package dir (default: tests/node_modules/puppeteer-core)
//        CHROME_PATH          browser executable (default: installed Chrome, then Edge)
//        SHOTS_DIR            screenshot directory (default: tests/out)
// Spawns tests/serve.mjs 8123 --base /hayeled/ and tests/mock-supabase.mjs 54329, kills them at the end.
// Scenario group A runs with the shipped (empty) backend config; group B injects the mock backend through the
// SPEC §1.2 dev override (localStorage 'hy.dev.backend', set with evaluateOnNewDocument in that context only).
// Group C covers v2: the opening cinematic, a girl career (feminine Hebrew, women's football) and goal celebrations.
// Group D covers v2.1: the coaching career after retirement (boy and girl), manager screens, HoF "שחקן + מאמן".
// Every page skips the 8 s intro ('hy.intro.skip'='1') except scenario C1.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const PORT = 8123;
const MOCK_PORT = 54329;
const BASE = `http://localhost:${PORT}/hayeled/`;
const MOCK = `http://localhost:${MOCK_PORT}`;
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'tests', 'out');
const ARGS = process.argv.slice(2);
const ONLY = (() => { const i = ARGS.indexOf('--only'); return i >= 0 ? ARGS[i + 1] : null; })();
const HEADFUL = ARGS.includes('--headful');

/* ------------------------------------------------------------------ */
/* puppeteer-core + browser                                            */
/* ------------------------------------------------------------------ */

const require = createRequire(import.meta.url);
function loadPuppeteer() {
  const cands = [process.env.PUPPETEER_CORE_PATH, path.join(ROOT, 'tests', 'node_modules', 'puppeteer-core'), 'puppeteer-core'].filter(Boolean);
  for (const c of cands) {
    try { const m = require(c); return m.default || m; } catch { /* next */ }
  }
  console.error('puppeteer-core not found. Run "npm i" in tests/ or set PUPPETEER_CORE_PATH.');
  process.exit(2);
}
const puppeteer = loadPuppeteer();

function chromePath() {
  const la = process.env.LOCALAPPDATA || '';
  const c = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', la && path.join(la, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  console.error('No Chrome/Edge found. Set CHROME_PATH.');
  process.exit(2);
}

/* ------------------------------------------------------------------ */
/* Servers                                                             */
/* ------------------------------------------------------------------ */

const children = [];
function startChild(args, readyRe, name) {
  return new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(ch);
    let out = '';
    const t = setTimeout(() => resolve(ch), 4000); // some servers print nothing; the port probe below confirms
    ch.stdout.on('data', (d) => { out += d; if (readyRe.test(out)) { clearTimeout(t); resolve(ch); } });
    ch.stderr.on('data', (d) => { out += d; });
    ch.on('exit', (code) => { if (code) { clearTimeout(t); reject(new Error(name + ' exited ' + code + ': ' + out)); } });
  });
}
async function waitHttp(url, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('server not reachable: ' + url);
}
let serveChild = null;
async function startServe() {
  serveChild = await startChild(['tests/serve.mjs', String(PORT), '--base', '/hayeled/'], /listen|http:\/\//i, 'serve');
  await waitHttp(BASE);
}
function stopServe() { if (serveChild) { try { serveChild.kill(); } catch { /* ignore */ } serveChild = null; } }
async function startMock() {
  await startChild(['tests/mock-supabase.mjs', String(MOCK_PORT)], /listen|http:\/\//i, 'mock');
  await waitHttp(MOCK + '/__mock');
}
async function mockState() { return (await fetch(MOCK + '/__mock/state')).json(); }
async function mockReset() { await fetch(MOCK + '/__mock/reset', { method: 'POST' }); }

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (id) => `[data-testid="${id}"]`;
const results = [];
const problems = [];      // console errors, page errors, failed requests, 404s
const allRequests = [];
const shots = [];
const net = { offline: false, allowMock4xx: false };

const T0 = Date.now();
function step(m) { if (process.env.E2E_DEBUG) console.log('   .. ' + ((Date.now() - T0) / 1000).toFixed(1) + 's ' + m); }
function assert(c, msg) { if (!c) throw new Error(msg); }

async function scenario(name, fn) {
  const before = problems.length;
  const t0 = Date.now();
  try {
    await fn();
    const newProblems = problems.slice(before);
    if (newProblems.length) throw new Error('browser problems:\n    ' + newProblems.join('\n    '));
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false, err: String(e && e.message || e) });
    console.log(`FAIL ${name}: ${e && e.message || e}`);
  }
}

const isFont = (u) => /fonts\.(googleapis|gstatic)\.com/.test(u) || /\/favicon\.ico$/.test(u);
const isMock = (u) => u.startsWith(MOCK);
const isOurs = (u) => u.startsWith(BASE);
const isAd = (u) => /^https:\/\/example\.com/.test(u) || /googlesyndication|doubleclick/.test(u);

function watch(page, label) {
  page.on('console', (m) => {
    // render errors of the v2 canvas scenes are logged as warnings and swallowed by the app: surface them here
    if (m.type() === 'warn' && /\[intro\]|\[celebrate\]|celebrate|match replay|render error/i.test(m.text())) { problems.push(`[${label}] console.warn: ${m.text()}`); return; }
    if (m.type() !== 'error') return;
    const text = m.text();
    const loc = (m.location() && m.location().url) || '';
    if (/Failed to load resource/.test(text) || /ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED/.test(text)) {
      if (isFont(loc)) return;
      if (net.offline && (isMock(loc) || isOurs(loc) || !loc)) return;
      if (net.allowMock4xx && isMock(loc)) return;
    }
    problems.push(`[${label}] console.error: ${text}${loc ? ' @ ' + loc : ''}`);
  });
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e && e.message || e}`));
  page.on('request', (r) => {
    allRequests.push(r.url());
    // js/config.js ships the real project: a test must never reach it
    if (/.supabase.co/.test(r.url())) problems.push(`[${label}] request to the REAL Supabase: ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    const why = (r.failure() && r.failure().errorText) || '';
    if (isFont(u)) return;
    if (why === 'net::ERR_ABORTED') return;               // cancelled by a navigation/reload (not an app failure)
    if (net.offline && (isMock(u) || isOurs(u))) return;
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    problems.push(`[${label}] request failed: ${u} ${why}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (isOurs(u) && r.status() === 404) problems.push(`[${label}] 404: ${u}`);
    if (isMock(u) && r.status() >= 400 && !net.allowMock4xx) problems.push(`[${label}] mock ${r.status()}: ${u}`);
  });
}

async function newPage(ctx, label, { intro = false, reduced = false } = {}) {
  const page = await ctx.newPage();
  // pin the motion preference: the host OS setting must not decide between the full and the quiet intro / celebrations
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });
  page.setDefaultTimeout(15000);
  // no backend unless a scenario points the override at the mock (registered later, so it wins)
  await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('hy.dev.backend')) localStorage.setItem('hy.dev.backend', JSON.stringify({ off: true })); } catch { /* opaque origin */ } });
  // the 8 s opening cinematic (C8) is skipped everywhere except the intro scenario
  await page.evaluateOnNewDocument((skip) => { try { if (skip) localStorage.setItem('hy.intro.skip', '1'); else localStorage.removeItem('hy.intro.skip'); } catch { /* opaque origin */ } }, !intro);
  watch(page, label);
  return page;
}

async function waitBoot(page) {
  await page.waitForFunction(() => window.__hyBooted === true, { timeout: 20000 });
  await sleep(250);
}
async function goto(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await sleep(350);
}
async function click(page, sel, timeout = 10000) {
  // The match screen re-renders cards on its own timer (outcome card -> next moment), so an element can
  // be replaced between "found" and "clicked". Re-query and retry instead of failing the scenario.
  for (let attempt = 0; ; attempt++) {
    const el = await page.waitForSelector(sel, { visible: true, timeout });
    // a full-screen celebration (C9) swallows the first tap like on a phone: tap it away first
    await page.evaluate(() => { for (const c of document.querySelectorAll('[data-testid="celebration"]')) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    // the fixed bottom tab bar covers the last line of a screen: centre the target first (a player scrolls too)
    await el.evaluate((e) => { if (!e.closest('.tabbar, nav.tabs, [data-testid="tabbar"]')) e.scrollIntoView({ block: 'center', inline: 'nearest' }); }).catch(() => {});
    try { await el.click(); return; } catch (e) {
      if (attempt >= 3 || !/detached|not clickable|Node is either not visible/i.test(String(e && e.message))) throw e;
      await sleep(150);
    }
  }
}
async function present(page, sel) {
  return page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e || e.closest('.modal-wrap.closing')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
}
async function noOverflow(page, where) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth }));
  assert(o.sw <= o.iw && o.bw <= o.iw, `horizontal overflow on ${where}: scrollWidth ${Math.max(o.sw, o.bw)} > ${o.iw}`);
}
async function shot(page, name, { full = true } = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, name + '.png');
  await sleep(120);
  await page.screenshot({ path: file, fullPage: full });
  shots.push(file);
  return file;
}
async function setWidth(page, w) {
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(200);
}
async function closeTopModals(page) {
  for (let i = 0; i < 5; i++) {
    const has = await page.evaluate(() => !!document.querySelector('.modal-wrap:not(.closing)'));
    if (!has) return;
    if (await present(page, T('btn-week-ok'))) { await click(page, T('btn-week-ok')); await sleep(300); continue; }
    if (await present(page, T('btn-fb-later'))) { await click(page, T('btn-fb-later')); await sleep(300); continue; }
    if (await present(page, T('btn-ad-close'))) { await click(page, T('btn-ad-close')); await sleep(300); continue; }
    await page.keyboard.press('Escape');
    await sleep(300);
  }
}
const hubVM = (page) => page.evaluate(() => (window.__hy.game.hasCareer() ? window.__hy.game.getHub() : null));
const meta = (page) => page.evaluate(() => { const m = window.__hy.game.getSaveMeta(); return { careerId: m.careerId, season: m.season, week: m.week, ovr: m.ovr, name: m.name }; });

/** Current UI state. */
async function uiState(page, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => {
      const q = (id) => {
        const e = document.querySelector(`[data-testid="${id}"]`);
        if (!e || e.closest('.modal-wrap.closing')) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const h = location.hash;
      if (document.querySelector('[data-testid="ff-overlay"]')) return 'busy';
      if (q('ad-interstitial')) return 'interstitial';
      if (q('week-summary')) return 'week';
      if (q('fb-prompt')) return 'fbprompt';
      if (q('scout-report')) return 'scout';
      if (h.startsWith('#/match') && (q('match') || q('match-summary'))) return 'match';
      if (h.startsWith('#/season') && q('season-review')) return 'season';
      if (h.startsWith('#/retire') && q('retire-screen')) return 'retire';
      if (q('hub') && !document.querySelector('.modal-wrap:not(.closing)')) return 'hub';
      return 'busy';
    });
    if (s !== 'busy') return s;
    if (Date.now() - t0 > timeout) return 'timeout';
    await sleep(120);
  }
}

/** Records every celebration overlay (C9) that is mounted on the page: window.__hyCelebs = [{ kind, text }]. */
async function recordCelebrations(page) {
  await page.evaluateOnNewDocument(() => {
    window.__hyCelebs = [];
    const start = () => {
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.dataset && n.dataset.testid === 'celebration') window.__hyCelebs.push({ kind: n.dataset.kind, text: n.textContent || '' });
        }
      }).observe(document.body, { childList: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  });
}

/**
 * Play the match on #/match. Returns matches finished.
 * mode: 'watch'  (default v2 flow: kick-off -> replay at x4 -> full time -> summary; skips to the end after `watchMs`)
 *       'auto'   (straight to the result with btn-autoplay)
 *       'manual' (decisions mode: tap the key-moment options; needs settings.decisions on)
 */
let shotMatch = 0;
let momentsClicked = 0;
async function playMatch(page, mode, tag = '', { watchMs = 25000 } = {}) {
  let finished = 0;
  let k = 0;
  let replayT0 = 0;
  let replayShot = false;
  for (let guard = 0; guard < 1200; guard++) {
    const st = await page.evaluate(() => {
      const q = (id) => document.querySelector(`[data-testid="${id}"]`);
      const ab = q('btn-autoplay');
      const sp4 = q('speed-4');
      return {
        h: location.hash, pre: !!q('btn-start-match'), outcome: !!q('moment-outcome'),
        opts: document.querySelectorAll('[data-testid^="moment-opt-"]').length,
        finish: !!q('btn-finish-match'), cont: !!q('btn-match-continue'), auto: !!ab && !ab.disabled,
        replay: !!q('btn-skip-end'), x4: !!sp4 && sp4.getAttribute('aria-pressed') === 'true',
        celeb: !!document.querySelector('[data-testid="celebration"]'),
      };
    });
    if (!st.h.startsWith('#/match')) return finished;
    if (st.cont) {
      if (shotMatch < 2) { await shot(page, `match-summary${tag}`); }
      await click(page, T('btn-match-continue'));
      finished++;
      replayT0 = 0;
      await sleep(400);
      continue;
    }
    if (st.finish) {
      if (shotMatch < 2) { await shot(page, `match-ended${tag}`); }
      await click(page, T('btn-finish-match'));
      await sleep(250);
      continue;
    }
    if (st.pre) {
      if (shotMatch === 0) { await shot(page, 'match-pre' + tag); }
      if (mode === 'auto') await click(page, T('btn-autoplay'));
      else await click(page, T('btn-start-match'));
      await sleep(250);
      continue;
    }
    if (st.replay) {
      // watch mode replay: x4, then let it run (celebrations included) or skip to full time after watchMs
      if (!replayT0) replayT0 = Date.now();
      if (st.celeb) { await sleep(150); continue; }
      if (!replayShot && shotMatch === 0 && Date.now() - replayT0 > 1500) { replayShot = true; await shot(page, 'match-live' + tag, { full: false }); }
      if (mode !== 'watch' || Date.now() - replayT0 > watchMs) {
        await page.evaluate(() => { const b = document.querySelector('[data-testid="btn-skip-end"]'); if (b) b.click(); });
        await sleep(250);
        continue;
      }
      if (!st.x4) { await page.evaluate(() => { const b = document.querySelector('[data-testid="speed-4"]'); if (b) b.click(); }); }
      await sleep(250);
      continue;
    }
    if (st.outcome) {
      if (shotMatch === 0 && k === 1) { await shot(page, 'match-outcome', { full: false }); }
      await click(page, T('moment-outcome'));
      await sleep(120);
      continue;
    }
    if (st.opts) {
      if (mode === 'manual') {
        if (k === 0 && momentsClicked === 0) { await shot(page, 'match-decision', { full: false }); await setWidth(page, 360); await shot(page, 'match-live-360'); await noOverflow(page, 'match 360'); await setWidth(page, 390); }
        await click(page, T('moment-opt-' + (k % st.opts)));
        k++;
        momentsClicked++;
        await sleep(200);
      } else await click(page, T('btn-autoplay'));
      continue;
    }
    if (st.auto) { await click(page, T('btn-autoplay')); await sleep(200); continue; }
    await sleep(150);
  }
  throw new Error('match did not finish');
}

/** Click the hub main button once and drive the UI back to the hub (or season/retire). Returns { matches, state }. */
async function advanceUI(page, mode = 'auto') {
  if (!(await present(page, T('btn-advance')))) { await goto(page, '#/hub'); }
  await closeTopModals(page);
  await click(page, T('btn-advance'));
  await sleep(300);
  let matches = 0;
  for (let i = 0; i < 20; i++) {
    const s = await uiState(page);
    if (s === 'match') { const n = await playMatch(page, mode); matches += n; if (n) shotMatch++; continue; }
    if (s === 'week') { await click(page, T('btn-week-ok')); await sleep(350); return { matches, state: await uiState(page) }; }
    if (s === 'interstitial') { await click(page, T('btn-ad-close')); continue; }
    return { matches, state: s };
  }
  throw new Error('advanceUI stuck');
}

/** Fast-forward through the UI sheet. until: 'next-match' | 'season-end' | 'skip-summer'. */
async function ffUI(page, until) {
  await closeTopModals(page);
  await click(page, T('btn-ff'));
  await click(page, T('ff-' + until));
  await sleep(300);
  await page.waitForFunction(() => !document.querySelector('[data-testid="ff-overlay"]'), { timeout: 180000 });
  return uiState(page);
}

/** Fast-forward until the season review is on screen. */
async function ffToSeasonReview(page) {
  for (let i = 0; i < 60; i++) {
    const s = await uiState(page);
    if (s === 'season') return;
    if (s === 'week') { await click(page, T('btn-week-ok')); await sleep(400); continue; }
    if (s === 'match') { await playMatch(page, 'auto'); continue; }
    if (s === 'fbprompt') { await click(page, T('btn-fb-later')); continue; }
    if (s === 'interstitial') { await click(page, T('btn-ad-close')); continue; }
    if (s === 'hub') {
      const h = await hubVM(page);
      if (h.status === 'review') { await click(page, T('btn-advance')); await sleep(400); continue; }
      if (h.status === 'match') { await goto(page, '#/match'); continue; }
      await ffUI(page, 'season-end');
      continue;
    }
    throw new Error('unexpected state during fast-forward: ' + s);
  }
  throw new Error('season review not reached');
}

async function createCareerUI(page, { first = 'יוסי', last = 'אזולאי', shotsOn = true, gender = 'm', tag = '' } = {}) {
  await goto(page, '#/title');
  await click(page, T('btn-new-career'));
  // step 1: boy / girl (C1)
  await click(page, T('gender-' + gender));
  if (shotsOn) await shot(page, 'new-0-gender' + tag);
  await click(page, T('btn-next'));
  // step 2: name
  await page.waitForSelector(T('inp-first'), { visible: true });
  await page.type(T('inp-first'), first);
  await page.type(T('inp-last'), last);
  if (shotsOn) await shot(page, 'new-1-name' + tag);
  await click(page, T('btn-next'));
  // step 3: look (skin / hair colour / hairstyle)
  await click(page, T('skin-3'));
  await click(page, T('hair-2'));
  if (shotsOn) { await shot(page, 'new-1b-look' + tag); await noOverflow(page, 'wizard look'); }
  await click(page, T('btn-next'));
  await click(page, T('nation-isr'));
  if (shotsOn) { await shot(page, 'new-2-nation' + tag); await noOverflow(page, 'wizard nation'); }
  await click(page, T('btn-next'));
  await click(page, T('pos-ST'));
  await click(page, T('foot-R'));
  if (shotsOn) await shot(page, 'new-3-position' + tag);
  await click(page, T('btn-next'));
  await page.waitForSelector('[data-testid^="club-isr"]', { visible: true });
  const clubId = await page.$eval('[data-testid^="club-isr"]', (e) => e.dataset.testid);
  await click(page, T(clubId));
  if (shotsOn) await shot(page, 'new-4-academy' + tag);
  await click(page, T('btn-next'));
  await page.waitForSelector(T('btn-start') + ':not([disabled])', { visible: true });
  if (shotsOn) await shot(page, 'new-5-summary' + tag);
  await click(page, T('btn-start'));
  await page.waitForSelector(T('scout-report'), { visible: true });
  if (shotsOn) await shot(page, 'scout-report' + tag, { full: false });
  await click(page, T('btn-scout-ok'));
  await page.waitForSelector(T('hub-ovr'), { visible: true });
  await sleep(300);
  return clubId.replace('club-', '');
}

async function answerOneInbox(page) {
  const id = await page.evaluate(() => { const r = window.__hy.game.getInbox().find((x) => x.needsAnswer); return r ? r.id : null; });
  if (!id) return false;
  await goto(page, '#/inbox');
  await page.waitForSelector(T('inbox-item-' + id), { visible: true });
  await shot(page, 'inbox');
  await click(page, T('inbox-item-' + id));
  await page.waitForSelector('[data-testid^="chat-choice-"]', { visible: true });
  await shot(page, 'chat');
  const choice = await page.$$eval('[data-testid^="chat-choice-"]', (els) => { const e = els.find((x) => !x.disabled); return e ? e.dataset.testid : null; });
  assert(choice, 'no enabled chat choice');
  await click(page, T(choice));
  await page.waitForFunction((i) => { const t = window.__hy.game.getThread(i); return t.answered !== null && t.answered !== undefined; }, {}, id);
  await sleep(900);
  await shot(page, 'chat-answered');
  return true;
}

async function flushSave(page) {
  await page.evaluate(async () => { window.__hy.saveNow(); await window.__hy.save.flushPending(); });
}

/** Navigate to a same-origin document that does not run the game (to edit storage without the app saving over it). */
async function bareOrigin(page) {
  await page.goto(BASE + 'manifest.webmanifest', { waitUntil: 'load' });
}

/* ------------------------------------------------------------------ */
/* Group A: no backend                                                 */
/* ------------------------------------------------------------------ */

async function groupA(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, 'A');
  const startReq = allRequests.length;

  await scenario('A1 boot: title, RTL, no overflow 390/320, manifest + icons', async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('btn-new-career'), { visible: true });
    const dir = await page.evaluate(() => document.dir || document.documentElement.dir);
    assert(dir === 'rtl', 'document.dir = ' + dir);
    await noOverflow(page, 'title 390');
    await shot(page, 'title');
    await setWidth(page, 320);
    await noOverflow(page, 'title 320');
    await shot(page, 'title-320');
    await setWidth(page, 390);
    const man = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      const m = await (await fetch(href)).json();
      const icons = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, href))).status));
      return { href, icons, start: m.start_url, scope: m.scope };
    });
    assert(man.icons.length >= 3 && man.icons.every((s) => s === 200), 'manifest icons ' + JSON.stringify(man));
  });

  await scenario('A2 create career (Israel, ST, first Israeli club) -> scout report -> hub', async () => {
    await createCareerUI(page);
    const h = await hubVM(page);
    assert(h && h.player.ovr > 0 && h.club, 'hub without player/club');
    // C7 avatar on the hub player card, C6 crests on the hub
    const art = await page.evaluate(() => ({ av: [...document.querySelectorAll('#view svg.avatar')].filter((e) => e.getBoundingClientRect().width > 20).length, cr: document.querySelectorAll('#view svg.crest').length }));
    assert(art.av >= 1, 'no avatar SVG on the hub');
    assert(art.cr >= 1, 'no crest SVG on the hub');
    await shot(page, 'hub');
    await setWidth(page, 360); await noOverflow(page, 'hub 360'); await shot(page, 'hub-360'); await setWidth(page, 390);
    await setWidth(page, 320); await noOverflow(page, 'hub 320'); await setWidth(page, 390);
  });

  await scenario('A3 play weeks (watch mode): 2 watched matches at x4 + 1 straight-to-result, week summary', async () => {
    let manual = 0, auto = 0, weeks = 0, weekShot = false;
    for (let i = 0; i < 40 && (manual < 2 || auto < 1); i++) {
      const mode = manual < 2 ? 'watch' : 'auto';
      if (!weekShot) {
        // first week: capture the summary modal before closing it
        await closeTopModals(page);
        await click(page, T('btn-advance'));
        await sleep(300);
        let s = await uiState(page);
        if (s === 'match') { const n = await playMatch(page, mode); if (mode === 'watch') manual += n; else auto += n; shotMatch++; s = await uiState(page); }
        if (s === 'week') { await shot(page, 'week-summary', { full: false }); weekShot = true; await click(page, T('btn-week-ok')); await sleep(300); }
        weeks++;
        continue;
      }
      const r = await advanceUI(page, mode);
      weeks++;
      if (mode === 'watch') manual += r.matches; else auto += r.matches;
      if (r.state === 'season') break;
    }
    assert(manual >= 2 && auto >= 1, `matches watched=${manual} auto=${auto} after ${weeks} weeks`);
    const h = await hubVM(page);
    assert(h.player.form.length >= 1, 'no form after matches');
  });

  await scenario('A3b decisions setting on: key moments are asked, then back to watch mode', async () => {
    await goto(page, '#/settings');
    await page.waitForSelector(T('toggle-decisions'), { visible: true });
    const was = await page.$eval(T('toggle-decisions'), (e) => e.checked);
    assert(was === false, 'decisions must be off by default');
    await click(page, T('toggle-decisions'));
    await sleep(300);
    assert(await page.evaluate(() => window.__hy.ctx.settings.decisions === true), 'decisions setting not saved');
    await goto(page, '#/hub');
    let moments = 0;
    for (let i = 0; i < 12 && !moments; i++) {
      await closeTopModals(page);
      if (!(await present(page, T('btn-advance')))) await goto(page, '#/hub');
      await click(page, T('btn-advance'));
      await sleep(300);
      for (let j = 0; j < 10; j++) {
        const s = await uiState(page);
        if (s === 'match') {
          // decisions mode: the key moments are asked again (the player may be an unused sub, so try a few)
          const m0 = momentsClicked;
          await playMatch(page, 'manual');
          moments += momentsClicked - m0;
          continue;
        }
        if (s === 'week') { await click(page, T('btn-week-ok')); await sleep(300); break; }
        if (s === 'interstitial') { await click(page, T('btn-ad-close')); continue; }
        break;
      }
    }
    assert(moments >= 1, 'no key moment offered with decisions on');
    await goto(page, '#/settings');
    await click(page, T('toggle-decisions'));
    await sleep(300);
    assert(await page.evaluate(() => window.__hy.ctx.settings.decisions === false), 'decisions not switched off');
    await goto(page, '#/hub');
  });

  await scenario('A4 answer an inbox event', async () => {
    let ok = await answerOneInbox(page);
    for (let i = 0; i < 15 && !ok; i++) { await advanceUI(page, 'auto'); ok = await answerOneInbox(page); }
    assert(ok, 'no inbox event needing an answer appeared');
  });

  await scenario('A5 open every tab and screen (390 + some 360), no overflow, no NaN/undefined', async () => {
    const screens = [
      ['#/hub', 'hub-2'], ['#/schedule', 'schedule'], ['#/tables', 'tables'], ['#/career', 'career'], ['#/inbox', 'inbox-list'],
      ['#/profile', 'profile'], ['#/national', 'national'], ['#/offers', 'offers'], ['#/awards', 'awards'], ['#/shop', 'shop'],
      ['#/hof', 'hof-empty'], ['#/settings', 'settings'], ['#/feedback', 'feedback-nobackend'], ['#/install', 'install'], ['#/season', 'season-none'],
    ];
    for (const [h, name] of screens) {
      await goto(page, h);
      await sleep(250);
      await closeTopModals(page);
      await noOverflow(page, h);
      const bad = await page.evaluate(() => { const t = document.getElementById('view').innerText; const m = t.match(/NaN|undefined|\[object Object\]|\{[a-z0-9]+\}/); return m ? m[0] + ' in: ' + t.slice(Math.max(0, m.index - 40), m.index + 40) : null; });
      assert(!bad, `${h}: ${bad}`);
      await noEuro(page, h);
      if (h === '#/shop') assert(/₪/.test(await docText(page)), 'shop without ₪ prices');
      await shot(page, name);
    }
    // tab bar navigation by clicking
    // v2.1 tab bar: בית, לוח, טבלאות, חנות, קריירה; messages moved to the header bell (btn-inbox)
    for (const t of ['schedule', 'tables', 'shop', 'career', 'hub']) { await click(page, T('tab-' + t)); await sleep(250); }
    await click(page, T('btn-inbox')); await sleep(250);
    assert((await page.evaluate(() => location.hash)).startsWith('#/inbox'), 'bell did not open the inbox');
    await click(page, T('tab-hub')); await sleep(250);
    // a competition table and a career sub-tab
    await goto(page, '#/tables');
    const comp = await page.$('[data-testid^="comp-"]');
    assert(comp, 'no competition link on #/tables');
    await comp.click();
    await sleep(400);
    await noOverflow(page, 'table');
    const crests = await page.evaluate(() => document.querySelectorAll('#view svg.crest').length);
    assert(crests >= 8, 'league table without crest SVGs: ' + crests);
    await shot(page, 'table-league');
    await setWidth(page, 360); await noOverflow(page, 'table 360'); await shot(page, 'table-league-360'); await setWidth(page, 390);
    await goto(page, '#/settings'); await setWidth(page, 360); await noOverflow(page, 'settings 360'); await shot(page, 'settings-360'); await setWidth(page, 390);
    await goto(page, '#/profile'); await setWidth(page, 360); await shot(page, 'profile-360'); await setWidth(page, 390);
    await goto(page, '#/hub');
  });

  await scenario('A5b v2.1 settings: grouped icon list, "איך זה עובד?" sheets, red danger zone last; tab bar + bell', async () => {
    await goto(page, '#/settings');
    await closeTopModals(page);
    const L = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('#view .set-group')];
      const last = groups[groups.length - 1];
      const del = document.querySelector('[data-testid^="btn-delete-slot-"]');
      return { n: groups.length, lastDanger: !!(last && last.classList.contains('set-danger')), delInDanger: !!(del && del.closest('.set-danger')), text: document.getElementById('view').innerText };
    });
    assert(L.n >= 3 && L.lastDanger && L.delInDanger, 'settings layout ' + JSON.stringify({ n: L.n, lastDanger: L.lastDanger, delInDanger: L.delInDanger }));
    for (const w of ['צליל', 'פתיחה', 'החלטות', 'גיבוי', 'התקנה', 'דרג', 'פרטיות']) assert(L.text.includes(w), 'settings without "' + w + '"');
    await click(page, T('btn-help-save'));
    await page.waitForSelector('.modal-wrap:not(.closing) .howto', { visible: true, timeout: 5000 });
    await noMarkers(page, 'settings help');
    await shot(page, 'settings-help-save', { full: false });
    await closeTopModals(page);
    const tabs = await page.$$eval('[data-testid^="tab-"]', (e) => e.filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.testid));
    for (const t of ['tab-hub', 'tab-schedule', 'tab-tables', 'tab-shop', 'tab-career']) assert(tabs.includes(t), 'tab bar without ' + t + ': ' + tabs);
    assert(await present(page, T('btn-inbox')), 'header bell (btn-inbox) missing');
    await goto(page, '#/shop');
    const cats = await page.$$eval('[data-testid^="shop-cat-"]', (e) => e.map((x) => x.dataset.testid.replace('shop-cat-', '')));
    for (const c of ['cars', 'estate', 'watch', 'gear', 'invest', 'mine']) assert(cats.includes(c), 'store category missing: ' + c + ' (' + cats + ')');
    await click(page, T('shop-cat-invest'));
    await sleep(300);
    assert(await page.evaluate(() => document.querySelectorAll('#view .sitem svg').length >= 3), 'investment cards without illustrations');
    await noEuro(page, 'shop invest');
    await shot(page, 'shop-invest');
    await goto(page, '#/hub');
  });

  let before = null;
  await scenario('A6 persistence: reload -> same season/week/OVR (autosave)', async () => {
    await goto(page, '#/hub');
    await sleep(700); // autosave debounce
    before = await meta(page);
    await page.evaluate(() => window.__hy.save.flushPending());
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('hub-ovr'), { visible: true });
    const after = await meta(page);
    assert(after.careerId === before.careerId && after.season === before.season && after.week === before.week && after.ovr === before.ovr, `meta ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  });

  await scenario('A7 IndexedDB recovery: localStorage copies wiped -> restored, toast, LS rewritten', async () => {
    await flushSave(page);
    const m0 = await meta(page);
    await bareOrigin(page);
    await page.evaluate(() => { localStorage.removeItem('hy.slot.1'); localStorage.removeItem('hy.slot.1.prev'); });
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('hub-ovr'), { visible: true });
    const toast = await page.$eval(T('toast'), (e) => e.textContent);
    assert(/שחזרנו/.test(toast), 'no restore toast: ' + toast);
    await shot(page, 'restored-toast', { full: false });
    const m1 = await meta(page);
    assert(m1.careerId === m0.careerId && m1.week === m0.week, 'restored a different save');
    await sleep(300);
    const ls = await page.evaluate(() => !!localStorage.getItem('hy.slot.1'));
    assert(ls, 'LS not rewritten');
  });

  await scenario('A8 corruption recovery: truncated localStorage copy -> restored', async () => {
    await flushSave(page);
    const m0 = await meta(page);
    await bareOrigin(page);
    await page.evaluate(() => { const v = localStorage.getItem('hy.slot.1'); localStorage.setItem('hy.slot.1', v.slice(0, Math.floor(v.length / 2))); });
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('hub-ovr'), { visible: true });
    const m1 = await meta(page);
    assert(m1.careerId === m0.careerId && m1.week === m0.week, `after corruption ${JSON.stringify(m0)} -> ${JSON.stringify(m1)}`);
    const ok = await page.evaluate(() => {
      try {
        const v = localStorage.getItem('hy.slot.1');
        const NL = String.fromCharCode(10);
        const a = v.indexOf(NL);
        const b = v.indexOf(NL, a + 1);
        const h = JSON.parse(v.slice(a + 1, b));
        return v.startsWith('HYS1') && v.length - b - 1 === h.len;
      } catch { return false; }
    });
    assert(ok, 'LS copy still corrupt after load');
  });

  await scenario('A9 rollback: restore previous save from settings', async () => {
    await advanceUI(page, 'auto');
    await flushSave(page);
    const w0 = await meta(page);
    await goto(page, '#/settings?sec=backup');
    await click(page, T('btn-restore-prev-1'));
    await click(page, T('btn-confirm-yes'));
    await sleep(800);
    const w1 = await meta(page);
    const abs = (m) => m.season * 52 + m.week;
    assert(abs(w1) <= abs(w0), 'rollback moved forward');
    await goto(page, '#/hub');
    await advanceUI(page, 'auto');
  });

  await scenario('A10 export code -> import into slot 2 -> slot 2 meta equals slot 1', async () => {
    await goto(page, '#/hub');
    await flushSave(page);
    await goto(page, '#/settings?sec=backup');
    await click(page, T('btn-export-code-1'));
    await page.waitForFunction(() => { const t = document.querySelector('[data-testid="export-code-text"]'); return t && t.value.length > 10; });
    const code = await page.$eval(T('export-code-text'), (e) => e.value);
    assert(/^HY[01]:/.test(code), 'code prefix ' + code.slice(0, 8));
    await shot(page, 'export-code', { full: false });
    await page.keyboard.press('Escape');
    await sleep(300);
    await page.$eval(T('inp-import-code'), (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, code);
    await click(page, T('btn-import-code'));
    await click(page, T('import-slot-2'));
    await sleep(400);
    if (await present(page, T('btn-confirm-yes'))) await click(page, T('btn-confirm-yes'));
    await page.waitForFunction(async () => { const s = await window.__hy.save.listSlots(); return s[1] && !s[1].empty; }, { timeout: 10000 });
    const slots = await page.evaluate(async () => (await window.__hy.save.listSlots()).map((s) => s.meta && { careerId: s.meta.careerId, season: s.meta.season, week: s.meta.week, ovr: s.meta.ovr }));
    assert(JSON.stringify(slots[0]) === JSON.stringify(slots[1]), 'slot metas differ ' + JSON.stringify(slots));
    await shot(page, 'settings-after-import');
  });

  await scenario('A11 fast-forward a full season -> season review -> awards -> season 2', async () => {
    await goto(page, '#/hub');
    const s0 = (await hubVM(page)).season;
    await ffToSeasonReview(page);
    await noOverflow(page, 'season review');
    await shot(page, 'season-review');
    await click(page, T('btn-season-ok'));
    await sleep(600);
    await closeTopModals(page);
    await goto(page, '#/awards');
    await shot(page, 'awards-after-season');
    await goto(page, '#/career');
    await shot(page, 'career-after-season');
    await goto(page, '#/hub');
    await page.waitForSelector(T('btn-ff'), { visible: true });
    await shot(page, 'hub-summer');
    // into season 2
    for (let i = 0; i < 30; i++) {
      const h = await hubVM(page);
      if (h.season > s0 && h.phase === 'season') break;
      const s = await uiState(page);
      if (s === 'week') { await click(page, T('btn-week-ok')); await sleep(300); continue; }
      if (s === 'match') { await playMatch(page, 'auto'); continue; }
      if (s !== 'hub') { await closeTopModals(page); await goto(page, '#/hub'); continue; }
      if (h.phase === 'summer' && await present(page, T('btn-ff'))) {
        await click(page, T('btn-ff'));
        if (await page.waitForSelector(T('ff-skip-summer'), { visible: true, timeout: 3000 }).catch(() => null)) { await click(page, T('ff-skip-summer')); await page.waitForFunction(() => !document.querySelector('[data-testid="ff-overlay"]'), { timeout: 120000 }); await sleep(300); }
        else { await page.keyboard.press('Escape'); await advanceUI(page, 'auto'); }
      } else await advanceUI(page, 'auto');
    }
    const h2 = await hubVM(page);
    assert(h2.season > s0, 'did not reach season 2');
    await closeTopModals(page);
    await shot(page, 'hub-season2');
  });

  await scenario('A12 manifest + service worker registered; offline reload works after first visit', async () => {
    await goto(page, '#/hub');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: 'load' }); await waitBoot(page);
    }
    const ctl = await page.evaluate(() => !!navigator.serviceWorker.controller);
    assert(ctl, 'no SW controller after reload');
    await flushSave(page);
    const m0 = await meta(page);
    // real offline: stop the web server and cut the page network
    stopServe();
    net.offline = true;
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('hub-ovr'), { visible: true });
    const m1 = await meta(page);
    assert(m1.careerId === m0.careerId, 'offline boot lost the career');
    const r = await advanceUI(page, 'auto');
    assert(['hub', 'season', 'retire'].includes(r.state), 'offline advance ended in ' + r.state);
    await shot(page, 'hub-offline');
    await page.setOfflineMode(false);
    await startServe();
    await sleep(300);
    net.offline = false;
  });

  await scenario('A13 two tabs: second tab advances, first shows "other tab" and does not overwrite', async () => {
    await goto(page, '#/hub');
    await flushSave(page);
    const p2 = await newPage(ctx, 'A-tab2');
    await p2.goto(BASE, { waitUntil: 'load' });
    await waitBoot(p2);
    await p2.waitForSelector(T('hub-ovr'), { visible: true });
    step('tab2 booted');
    await advanceUI(p2, 'auto');
    await flushSave(p2);
    const m2 = await meta(p2);
    step('tab2 advanced');
    await page.bringToFront();
    await page.waitForSelector(T('other-tab'), { visible: true, timeout: 8000 });
    await shot(page, 'other-tab', { full: false });
    const res = await page.evaluate(() => { const r = window.__hy.saveNow(); return r && r.warn ? r.warn : (r ? 'saved' : 'null'); });
    const stored = await page.evaluate(() => { const m = window.__hy.save; return m.listSlots().then((s) => s[0].meta); });
    assert(stored.week === m2.week && stored.season === m2.season, `first tab overwrote: stored ${stored.season}/${stored.week} tab2 ${m2.season}/${m2.week} (saveNow -> ${res})`);
    step('checked overwrite');
    await p2.close();
    await page.bringToFront();
    await click(page, T('btn-other-tab-reload'));
    await sleep(500);
    await waitBoot(page);
    await page.waitForSelector(T('hub-ovr'), { visible: true });
    const m1 = await meta(page);
    assert(m1.week === m2.week, 'reload did not pick up the newer save');
  });

  await scenario('A14 retire: simulate to 32 via facade, reload, btn-retire -> retire screen -> HoF; delete slot keeps HoF', async () => {
    await goto(page, '#/hub');
    await closeTopModals(page);
    const t0 = Date.now();
    let res = 'go';
    while (res === 'go' && Date.now() - t0 < 170000) {
      res = await page.evaluate(() => {
        const g = window.__hy.game;
        const t = Date.now();
        while (Date.now() - t < 8000) {
          const h = g.getHub();
          if (h.status === 'retired') return 'retired';
          if (h.player.age >= 32 && h.canRetire) return 'can';
          for (const r of g.getInbox()) if (r.needsAnswer) { const th = g.getThread(r.id); const c = (th.choices || []).find((x) => !x.disabled); if (c) g.answerEvent(r.id, c.index); }
          for (const o of g.getOffers()) {
            if (o.status !== 'open') continue;
            const want = o.canAccept && (!h.club || o.type === 'renewal' || o.type === 'pro' || o.type === 'free');
            g.respondOffer(o.id, want ? 'accept' : 'reject');
          }
          if (h.status === 'review') { g.ackSeasonReview(); continue; }
          if (h.status === 'in_week' || h.status === 'match') { g.fastForward({ until: 'weeks', weeks: 1 }); continue; }
          g.fastForward({ until: 'season_end', maxWeeks: 6 });
        }
        return 'go';
      });
    }
    assert(res === 'can' || res === 'retired', 'did not reach age 32: ' + res);
    step('retire sim: ' + res + ' age ' + (await hubVM(page)).player.age);
    const careerId = (await meta(page)).careerId;
    await flushSave(page);
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    if (res === 'can') {
      await goto(page, '#/profile');
      await shot(page, 'profile-age32');
      await click(page, T('btn-retire'));
      await click(page, T('btn-confirm-yes'));
    }
    await page.waitForSelector(T('retire-screen'), { visible: true, timeout: 15000 });
    await sleep(1800);
    await closeTopModals(page);
    await noOverflow(page, 'retire');
    await shot(page, 'retire');
    await click(page, T('btn-retire-hof'));
    await page.waitForSelector(T('hof-item-' + careerId), { visible: true, timeout: 10000 });
    await shot(page, 'hof');
    await click(page, T('hof-item-' + careerId));
    await sleep(400);
    await shot(page, 'hof-detail', { full: false });
    await closeTopModals(page);
    // delete the slot: the HoF entry survives
    await goto(page, '#/settings');
    await click(page, T('btn-delete-slot-1'));
    await click(page, T('btn-confirm-yes'));
    await sleep(300);
    await click(page, T('btn-confirm-yes'));
    await sleep(800);
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await goto(page, '#/hof');
    await page.waitForSelector(T('hof-item-' + careerId), { visible: true, timeout: 10000 });
    await goto(page, '#/title');
    await shot(page, 'title-after-delete');
  });

  await scenario('A15 no backend: zero requests outside /hayeled/ (fonts excepted)', async () => {
    const outside = allRequests.slice(startReq).filter((u) => !isOurs(u) && !isFont(u) && !u.startsWith('data:') && !u.startsWith('blob:'));
    assert(!outside.length, 'unexpected requests: ' + [...new Set(outside)].slice(0, 10).join(', '));
  });

  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* Group C: v2 - opening cinematic, girl career, goal celebrations     */
/* ------------------------------------------------------------------ */

/** Text of the whole document (view, modals, header, overlays) for marker / wording checks. */
const docText = (page) => page.evaluate(() => document.body.innerText || '');
async function noMarkers(page, where) {
  const bad = await page.evaluate(() => {
    const t = document.body.innerText || '';
    const m = t.match(/\{\{|\}\}|NaN|undefined|\[object Object\]|\{[a-z0-9_]+\}/);
    return m ? m[0] + ' in: ' + t.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' ') : null;
  });
  assert(!bad, `${where}: ${bad}`);
}

async function groupC(browser) {
  const ctx = await browser.createBrowserContext();

  await scenario('C1 opening cinematic: plays on every app open, skip button works, title screen after', async () => {
    const page = await newPage(ctx, 'C-intro', { intro: true });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForSelector(T('intro'), { visible: true, timeout: 10000 });
    await sleep(1600);
    await shot(page, 'intro-1.6s', { full: false });
    const canvasOk = await page.evaluate(() => { const c = document.querySelector('[data-testid="intro"] canvas'); return !!c && c.width > 0 && c.height > 0; });
    assert(canvasOk, 'intro canvas missing');
    await page.waitForSelector(T('btn-intro-skip'), { visible: true });
    await click(page, T('btn-intro-skip'));
    await page.waitForFunction(() => !document.querySelector('[data-testid="intro"]'), { timeout: 3000 });
    await waitBoot(page);
    await page.waitForSelector(T('btn-new-career'), { visible: true });
    const flags = await page.evaluate(() => ({ seen: localStorage.getItem('hy.intro.seen'), sess: sessionStorage.getItem('hy.intro.session') }));
    assert(flags.seen && flags.sess, 'intro flags not stored ' + JSON.stringify(flags));
    // v2.1 (R1): the intro plays again on every app open (page load / PWA launch)
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(T('intro'), { visible: true, timeout: 10000 });
    await page.waitForSelector(T('btn-intro-skip'), { visible: true });
    await click(page, T('btn-intro-skip'));
    await page.waitForFunction(() => !document.querySelector('[data-testid="intro"]'), { timeout: 3000 });
    await waitBoot(page);
    await page.waitForSelector(T('btn-new-career'), { visible: true });
    // replay from settings, closed with Esc
    await goto(page, '#/settings');
    await click(page, T('btn-replay-intro'));
    await page.waitForSelector(T('intro'), { visible: true, timeout: 5000 });
    await sleep(700);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-testid="intro"]'), { timeout: 3000 });
    await page.close();
  });

  await scenario('C1b reduced motion: intro is a short logo reveal (no canvas) and the title follows', async () => {
    const rctx = await browser.createBrowserContext();
    const page = await newPage(rctx, 'C-intro-rm', { intro: true, reduced: true });
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForSelector(T('intro'), { visible: true, timeout: 10000 });
    const hasCanvas = await page.evaluate(() => !!document.querySelector('[data-testid="intro"] canvas'));
    assert(!hasCanvas, 'reduced-motion intro must not run the canvas cinematic');
    await shot(page, 'intro-reduced-motion', { full: false });
    await page.waitForFunction(() => !document.querySelector('[data-testid="intro"]'), { timeout: 5000 });
    await page.waitForSelector(T('btn-new-career'), { visible: true });
    const ms = Date.now() - t0;
    assert(ms < 6000, 'reduced-motion intro took ' + ms + ' ms');
    await rctx.close();
  });

  const page = await newPage(ctx, 'C');
  await recordCelebrations(page);

  await scenario('C2 girl career: gender-f wizard -> hub in feminine Hebrew, avatar + crests, no {{ markers', async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await createCareerUI(page, { first: 'נועה', last: 'כהן', gender: 'f', tag: '-f' });
    const h = await hubVM(page);
    assert(h.player.gender === 'f', 'engine gender ' + h.player.gender);
    const meta2 = await page.evaluate(() => window.__hy.game.getSaveMeta());
    assert(meta2.look && meta2.look.skin === 3, 'look not stored: ' + JSON.stringify(meta2.look));
    await closeTopModals(page);
    await noMarkers(page, 'hub (f)');
    const t = await docText(page);
    assert(/הילדה מהשכונה|ברוכה|שחקנית|לנשים/.test(t), 'no feminine wording on the hub');
    const art = await page.evaluate(() => ({ av: document.querySelectorAll('#view svg.avatar').length, cr: document.querySelectorAll('#view svg.crest').length }));
    assert(art.av >= 1 && art.cr >= 1, 'hub art ' + JSON.stringify(art));
    await shot(page, 'hub-f');
  });

  await scenario('C2b app open with a career: intro -> title, gold "המשך קריירה" first', async () => {
    // own browser context: a second tab on the same slot would trip the other-tab guard of page C
    const octx = await browser.createBrowserContext();
    const pa = await newPage(octx, 'C-open-a');
    await pa.goto(BASE, { waitUntil: 'load' });
    await waitBoot(pa);
    await pa.evaluate(async () => {
      const g = window.__hy.game;
      const club = g.getAcademyOptions('isr', { gender: 'f' }).groups[0].clubs[0].id;
      await window.__hy.ctx.hooks.startNewCareer({ first: 'מאיה', last: 'לוי', nick: '', nation: 'isr', pos: 'CM', foot: 'R', club, gender: 'f', look: { skin: 2, hair: 'bun', hairColor: 1 } }, 1);
    });
    await flushSave(pa);
    await pa.close();
    const p2 = await newPage(octx, 'C-open', { intro: true });
    await p2.goto(BASE, { waitUntil: 'load' });
    await p2.waitForSelector(T('intro'), { visible: true, timeout: 10000 });
    await p2.waitForSelector(T('btn-intro-skip'), { visible: true });
    await click(p2, T('btn-intro-skip'));
    await waitBoot(p2);
    await p2.waitForSelector(T('btn-continue'), { visible: true });
    const order = await p2.evaluate(() => {
      const c = document.querySelector('[data-testid="btn-continue"]'), n = document.querySelector('[data-testid="btn-new-career"]');
      return { first: !!(c && n && (c.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)), gold: c.classList.contains('btn-gold'), hash: location.hash };
    });
    assert(order.hash === '#/title', 'app open did not land on the title screen: ' + order.hash);
    assert(order.first && order.gold, 'continue is not the first gold button');
    await noMarkers(p2, 'title (f)');
    await shot(p2, 'title-continue-f', { full: false });
    await click(p2, T('btn-continue'));
    await p2.waitForSelector(T('hub'), { visible: true, timeout: 10000 });
    await octx.close();
  });

  await scenario('C3 girl career: watch matches until she scores -> "גוללללל!" celebration overlay', async () => {
    let meGoal = false;
    for (let i = 0; i < 40 && !meGoal; i++) {
      await closeTopModals(page);
      if (!(await present(page, T('btn-advance')))) await goto(page, '#/hub');
      const h = await hubVM(page);
      if (h.status === 'review') break;
      await click(page, T('btn-advance'));
      await sleep(300);
      for (let j = 0; j < 10; j++) {
        const s = await uiState(page);
        if (s === 'week') { await click(page, T('btn-week-ok')); await sleep(300); break; }
        if (s === 'interstitial') { await click(page, T('btn-ad-close')); continue; }
        if (s !== 'match') break;
        // kick off, read the resolved log; watch at x4 only when she scores, else skip to full time
        await click(page, T('btn-start-match'));
        await page.waitForSelector(T('btn-skip-end'), { visible: true });
        const evs = await page.evaluate(() => window.__hyMatchDebug.events());
        const mine = evs.filter((e) => e.ev === 'goal' && e.who === 'me');
        if (mine.length) {
          meGoal = true;
          await page.evaluate(() => window.__hyMatchDebug.speed(4));
          await page.waitForSelector(T('celebration'), { timeout: 60000 });
          await sleep(500);
          await shot(page, 'celebration-me-goal', { full: false });
        }
        await playMatch(page, 'auto', '-f');
      }
    }
    assert(meGoal, 'she did not score in 40 weeks');
    const celebs = await page.evaluate(() => window.__hyCelebs);
    assert(celebs.some((c) => /גול/.test(c.text)), 'no goal celebration recorded ' + JSON.stringify(celebs));
    // the C9 overlay is removed afterwards
    await page.waitForFunction(() => !document.querySelector('[data-testid="celebration"]'), { timeout: 8000 });
  });

  await scenario('C4 girl career: full season -> review, every screen feminine and marker-free, crests in tables', async () => {
    await goto(page, '#/hub');
    await ffToSeasonReview(page);
    await noMarkers(page, 'season review (f)');
    await shot(page, 'season-review-f');
    await click(page, T('btn-season-ok'));
    await sleep(600);
    await closeTopModals(page);
    const screens = ['#/hub', '#/schedule', '#/tables', '#/career', '#/inbox', '#/profile', '#/national', '#/offers', '#/awards', '#/shop', '#/settings'];
    let all = '';
    for (const hsh of screens) {
      await goto(page, hsh);
      await sleep(250);
      await closeTopModals(page);
      await noOverflow(page, hsh + ' (f)');
      await noMarkers(page, hsh + ' (f)');
      all += await docText(page);
    }
    assert(/לנשים/.test(all), 'no women\'s competition names (…לנשים) on any screen');
    assert(/ברוכה|הילדה מהשכונה|שחקנית|מבקיעה|את /.test(all), 'no feminine forms found');
    await goto(page, '#/tables');
    const comp = await page.$('[data-testid^="comp-"]');
    assert(comp, 'no competition link');
    await comp.click();
    await sleep(400);
    const crests = await page.evaluate(() => document.querySelectorAll('#view svg.crest').length);
    assert(crests >= 8, 'table without crests: ' + crests);
    await shot(page, 'table-league-f');
  });

  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* Group B: mock backend                                               */
/* ------------------------------------------------------------------ */

async function groupB(browser) {
  await mockReset();
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, 'B');
  await page.evaluateOnNewDocument((url) => {
    try { localStorage.setItem('hy.dev.backend', JSON.stringify({ url, anonKey: 'mock-anon' })); } catch { /* opaque origin */ }
  }, MOCK);
  const startReq = allRequests.length;

  await scenario('B1 boot with mock backend, create career, play a matchday', async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await createCareerUI(page, { first: 'דני', last: 'לוי', shotsOn: false });
    let played = 0;
    for (let i = 0; i < 12 && !played; i++) played += (await advanceUI(page, 'auto')).matches;
    assert(played >= 1, 'no match played');
  });

  await scenario('B2 ads disabled by default: hub ad slot hidden, zero height, no ad requests', async () => {
    await goto(page, '#/hub');
    await closeTopModals(page);
    const s = await page.$eval('.ad-slot[data-placement="hub_banner"]', (e) => ({ hidden: e.hidden, h: e.getBoundingClientRect().height }));
    assert(s.hidden && s.h === 0, 'ad slot visible: ' + JSON.stringify(s));
    assert(!(await page.$(T('btn-rewarded'))) || !(await present(page, T('btn-rewarded'))), 'rewarded button visible');
  });

  await scenario('B3 season fast-forward -> review -> feedback prompt -> "not now"', async () => {
    await ffToSeasonReview(page);
    await click(page, T('btn-season-ok'));
    await page.waitForSelector(T('fb-prompt'), { visible: true, timeout: 8000 });
    await shot(page, 'feedback-prompt', { full: false });
    await click(page, T('btn-fb-later'));
    await sleep(300);
  });

  await scenario('B4 telemetry: app_open, career_started, match_played events + session reach the mock', async () => {
    await page.evaluate(() => window.__hy.telemetry.flush());
    await sleep(500);
    const st = await mockState();
    const names = new Set(st.events.map((e) => e.name));
    for (const n of ['app_open', 'career_started', 'match_played']) assert(names.has(n), 'missing event ' + n + ' (have ' + [...names].join(',') + ')');
    assert(st.sessions.length >= 1, 'no session rows');
    assert(st.devices.length >= 1, 'no device rows');
  });

  await scenario('B5 feedback: 5 stars + text + email -> mock row', async () => {
    await goto(page, '#/feedback');
    await click(page, T('fb-star-5'));
    await page.type(T('fb-text'), 'משחק מעולה! בדיקה אוטומטית');
    await page.type(T('fb-email'), 'tester@example.com');
    await shot(page, 'feedback-form');
    await click(page, T('btn-fb-send'));
    await page.waitForSelector(T('fb-done'), { visible: true });
    await shot(page, 'feedback-done');
    const st = await mockState();
    assert(st.feedback.length === 1 && st.feedback[0].rating === 5, 'feedback rows ' + JSON.stringify(st.feedback.map((f) => f.rating)));
  });

  await scenario('B6 feedback offline -> queued -> flushed when back online', async () => {
    net.offline = true;
    await page.setOfflineMode(true);
    await goto(page, '#/hub');
    await goto(page, '#/feedback?rating=4');
    await page.type(T('fb-text'), 'נשלח בלי רשת');
    await click(page, T('btn-fb-send'));
    await page.waitForSelector(T('fb-done'), { visible: true });
    const txt = await page.$eval(T('fb-done'), (e) => e.textContent);
    assert(/כשתחזור לרשת/.test(txt), 'not queued: ' + txt);
    await shot(page, 'feedback-queued');
    await page.setOfflineMode(false);
    await sleep(300);
    net.offline = false;
    await page.evaluate(() => window.__hy.feedback.flushFeedbackQueue());
    await sleep(500);
    const st = await mockState();
    assert(st.feedback.length === 2 && st.feedback.some((f) => f.rating === 4), 'queued feedback not flushed: ' + st.feedback.length);
  });

  const admin = await newPage(ctx, 'admin');
  await scenario('B7 admin: non-admin rejected; admin login -> KPIs + feedback, mark read', async () => {
    await admin.goto(BASE + 'admin.html', { waitUntil: 'load' });
    await admin.waitForSelector(T('adm-email'), { visible: true });
    await shot(admin, 'admin-login');
    net.allowMock4xx = true;
    await admin.type(T('adm-email'), 'player@test.local');
    await admin.type(T('adm-password'), 'test1234');
    await click(admin, T('adm-login'));
    await admin.waitForFunction(() => { const e = document.querySelector('[data-testid="adm-error"]'); return e && e.textContent.trim().length > 0; }, { timeout: 10000 });
    const err = await admin.$eval(T('adm-error'), (e) => e.textContent);
    assert(err.trim().length > 0, 'empty admin error');
    await shot(admin, 'admin-nonadmin');
    await sleep(500);
    net.allowMock4xx = false;
    await admin.$eval(T('adm-email'), (e) => { e.value = ''; });
    await admin.$eval(T('adm-password'), (e) => { e.value = ''; });
    await admin.type(T('adm-email'), 'admin@test.local');
    await admin.type(T('adm-password'), 'test1234');
    await click(admin, T('adm-login'));
    await admin.waitForSelector(T('kpi-devices'), { visible: true });
    await admin.waitForFunction(() => Number(document.querySelector('[data-testid="kpi-devices"]').textContent.replace(/\D/g, '')) >= 1, { timeout: 8000 });
    const kpis = await admin.evaluate(() => Object.fromEntries(['kpi-online', 'kpi-devices', 'kpi-dau', 'kpi-careers', 'kpi-matches', 'kpi-rating'].map((k) => [k, (document.querySelector(`[data-testid="${k}"]`) || {}).textContent])));
    assert(Number(kpis['kpi-careers']) >= 1 && Number(kpis['kpi-matches']) >= 1, 'KPIs ' + JSON.stringify(kpis));
    await admin.waitForSelector(T('chart-new'));
    await noOverflow(admin, 'admin dashboard');
    await shot(admin, 'admin-dashboard');
    await click(admin, T('nav-feedback'));
    await admin.waitForSelector('[data-testid^="fb-row-"]', { visible: true });
    await shot(admin, 'admin-feedback');
    const fid = await admin.$eval('[data-testid^="btn-mark-read-"]', (e) => e.dataset.testid);
    await click(admin, T(fid));
    await sleep(600);
    const st = await mockState();
    assert(st.feedback.some((f) => f.read || f.is_read || f.read_at), 'mark read not stored');
  });

  await scenario('B8 admin config: announcement + house ads -> game shows announcement and hub banner', async () => {
    await click(admin, T('nav-config'));
    await admin.waitForSelector(T('cfg-ann-text'), { visible: true });
    await admin.$eval(T('cfg-ann-enabled'), (e) => { if (!e.checked) e.click(); });
    await admin.type(T('cfg-ann-text'), 'עדכון חדש: ליגות נוספות בקרוב!');
    await click(admin, T('btn-save-announcement'));
    await sleep(600);
    await admin.$eval(T('cfg-ads-enabled'), (e) => { if (!e.checked) e.click(); });
    await admin.select(T('cfg-ads-provider'), 'house');
    await click(admin, T('cfg-house-add'));
    await admin.waitForSelector(T('cfg-house-0-imageUrl'), { visible: true });
    const fill = async (id, v) => { await admin.$eval(T(id), (e) => { e.value = ''; }); await admin.type(T(id), v); };
    await fill('cfg-house-0-imageUrl', './icons/icon-192.png');
    await fill('cfg-house-0-link', 'https://example.com');
    if (await admin.$(T('cfg-house-0-textHe'))) await fill('cfg-house-0-textHe', 'ספונסר לדוגמה');
    await shot(admin, 'admin-config');
    await click(admin, T('btn-save-ads'));
    await sleep(800);
    const st = await mockState();
    const ads = (st.app_config.find((r) => r.key === 'ads') || {}).value;
    const ann = (st.app_config.find((r) => r.key === 'announcement') || {}).value;
    assert(ads && ads.enabled && ads.provider === 'house' && ads.house.length === 1, 'ads config not saved ' + JSON.stringify(ads));
    assert(ann && ann.enabled && /ליגות/.test(ann.textHe), 'announcement not saved');
    // game picks it up
    step('admin saved');
    await page.bringToFront();
    await page.reload({ waitUntil: 'load' });
    step('game reloaded');
    await waitBoot(page);
    await goto(page, '#/hub');
    await closeTopModals(page);
    await page.waitForSelector(T('announcement'), { visible: true, timeout: 10000 });
    await page.waitForSelector('.ad-slot[data-placement="hub_banner"]:not([hidden]) ' + T('ad-house-link'), { visible: true, timeout: 10000 });
    await noOverflow(page, 'hub with ads');
    await shot(page, 'hub-with-announcement-and-ad');
    await page.$eval('.ad-slot[data-placement="hub_banner"]', (e) => e.scrollIntoView({ block: 'center' }));
    await shot(page, 'hub-ad-banner-viewport', { full: false });
    await page.evaluate(() => window.scrollTo(0, 0));
    await setWidth(page, 360); await shot(page, 'hub-with-ad-360'); await setWidth(page, 390);
  });

  await scenario('B9 ads disabled again (mock reset) -> slot hidden, zero height', async () => {
    await mockReset();
    await page.bringToFront();
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await goto(page, '#/hub');
    await closeTopModals(page);
    await page.waitForFunction(() => { const e = document.querySelector('.ad-slot[data-placement="hub_banner"]'); return e && e.hidden && e.getBoundingClientRect().height === 0; }, { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="announcement"]'), { timeout: 10000 });
  });

await scenario('B11 admin v2.1 tools: rating filter, delete feedback (2 taps), CSV export, reset stats (types "איפוס", 2 clicks)', async () => {
    await fetch(MOCK + '/__mock/seed', { method: 'POST', body: JSON.stringify({ devices: 24 }) });
    const DL = path.join(SHOTS, 'dl');
    fs.mkdirSync(DL, { recursive: true });
    for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
    const cdp = await admin.browser().target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, browserContextId: ctx.id });
    await admin.bringToFront();
    await admin.setViewport({ width: 1280, height: 900 });
    await admin.reload({ waitUntil: 'load' });
    await admin.waitForSelector(`${T('nav-dash')}, ${T('adm-email')}`, { visible: true, timeout: 10000 });
    if (await present(admin, T('adm-email'))) {
      await admin.type(T('adm-email'), 'admin@test.local');
      await admin.type(T('adm-password'), 'test1234');
      await click(admin, T('adm-login'));
    }
    await click(admin, T('nav-dash'));   // the reload keeps the last admin tab (B8 left it on the config screen)
    await admin.waitForSelector(T('kpi-careers-f'), { visible: true, timeout: 10000 });
    const kp = await admin.evaluate(() => Object.fromEntries(['kpi-devices', 'kpi-careers-m', 'kpi-careers-f', 'kpi-manager', 'kpi-intro', 'kpi-goals', 'kpi-top5'].map((k) => [k, ((document.querySelector(`[data-testid="${k}"]`) || {}).textContent || '').trim()])));
    assert(Number(kp['kpi-careers-m']) + Number(kp['kpi-careers-f']) >= 1 && /%$/.test(kp['kpi-intro']), 'v2.1 KPIs ' + JSON.stringify(kp));
    assert(!(await admin.$(T('adm-schema-banner'))), 'schema banner shown on a 2.1 backend');
    await noOverflow(admin, 'admin dashboard 1280');
    await shot(admin, 'admin-v21-dashboard');
    await click(admin, T('nav-feedback'));
    await admin.waitForSelector(T('fb-rating-5'), { visible: true });
    await click(admin, T('fb-rating-5'));
    await admin.waitForFunction(() => document.querySelector('[data-testid="fb-rating-5"]').classList.contains('on'));
    await sleep(300);
    const stars = await admin.$$eval('[data-testid^="fb-row-"] .stars', (e) => e.map((x) => x.textContent.trim()));
    assert(stars.length > 0 && stars.every((s) => s === '★★★★★'), 'rating filter 5: ' + JSON.stringify(stars));
    await shot(admin, 'admin-v21-feedback-5');
    const delTid = await admin.$eval('[data-testid^="btn-delete-"]', (e) => e.dataset.testid);
    const fbId = Number(delTid.replace('btn-delete-', ''));
    await click(admin, T(delTid));
    await sleep(200);
    assert((await mockState()).feedback.some((f) => f.id === fbId), 'feedback deleted after one tap');
    await click(admin, T(delTid));
    await admin.waitForFunction((id) => !document.querySelector(`[data-testid="fb-row-${id}"]`), { timeout: 8000 }, fbId);
    const st1 = await mockState();
    assert(!st1.feedback.some((f) => f.id === fbId), 'deleted feedback still in the mock');
    await click(admin, T('fb-rating-all'));
    await sleep(300);
    await click(admin, T('btn-export-csv'));
    let csv = '';
    for (let i = 0; i < 50 && !csv; i++) { await sleep(150); const f = fs.readdirSync(DL).find((x) => x.endsWith('.csv')); if (f) csv = fs.readFileSync(path.join(DL, f), 'utf8'); }
    assert(csv.startsWith('﻿"מזהה"'), 'CSV not downloaded / bad header: ' + JSON.stringify(csv.slice(0, 40)));
    assert(csv.trim().split('\r\n').length === st1.feedback.length + 1, 'CSV lines ' + (csv.trim().split('\r\n').length - 1) + ' vs ' + st1.feedback.length);
    await click(admin, T('nav-tools'));
    await admin.waitForSelector(T('btn-reset-open'), { visible: true });
    await click(admin, T('btn-reset-open'));
    assert(await admin.$eval(T('btn-reset-confirm'), (e) => e.disabled), 'reset enabled before typing');
    await admin.type(T('reset-confirm-input'), 'אפס');
    assert(await admin.$eval(T('btn-reset-confirm'), (e) => e.disabled), 'reset enabled by a wrong word');
    await admin.$eval(T('reset-confirm-input'), (e) => { e.value = ''; });
    await admin.type(T('reset-confirm-input'), 'איפוס');
    assert(!(await admin.$eval(T('btn-reset-confirm'), (e) => e.disabled)), 'typing איפוס did not enable reset');
    await click(admin, T('btn-reset-confirm'));
    await sleep(300);
    assert((await mockState()).events.length > 0, 'reset ran after the first click');
    await shot(admin, 'admin-v21-reset-armed', { full: false });
    const oldEv = new Set((await mockState()).events.map((e) => e.id + '|' + e.created_at));
    await click(admin, T('btn-reset-confirm'));
    await admin.waitForSelector(T('reset-result'), { visible: true, timeout: 8000 });
    const st2 = await mockState();
    // the game tab may send a heartbeat right after the reset: only rows from before the reset must be gone
    assert(!st2.events.some((e) => oldEv.has(e.id + '|' + e.created_at)) && !st2.feedback.length && st2.app_config.length >= 1, 'reset result ' + JSON.stringify({ e: st2.events.length, d: st2.devices.length, f: st2.feedback.length, s: st2.sessions.length, c: st2.app_config.length }));
    await shot(admin, 'admin-v21-reset-done', { full: false });
    await setWidth(admin, 390);
    await click(admin, T('nav-dash'));
    await admin.waitForSelector(T('kpi-devices'), { visible: true });
    await noOverflow(admin, 'admin dashboard 390');
  });

  await scenario('B12 telemetry v2.1: career_started{gender}, retired{league,tier,legacy,gender}, manager_started{tier} reach the mock', async () => {
    await page.bringToFront();
    await goto(page, '#/settings');
    const r = await page.evaluate(() => {
      const g = window.__hy.game;
      const t = Date.now();
      while (Date.now() - t < 60000) {
        const h = g.getHub();
        if (h.status === 'retired') break;
        if (h.player.age >= 32 && h.canRetire) { g.retire(); break; }
        for (const x of g.getInbox()) if (x.needsAnswer) { const th = g.getThread(x.id); const c = (th.choices || []).find((y) => !y.disabled); if (c) g.answerEvent(x.id, c.index); }
        for (const o of g.getOffers()) if (o.status === 'open') g.respondOffer(o.id, o.canAccept && (!h.club || o.type === 'renewal' || o.type === 'pro' || o.type === 'free') ? 'accept' : 'reject');
        if (h.status === 'review') { g.ackSeasonReview(); continue; }
        if (h.status === 'in_week' || h.status === 'match') { g.fastForward({ until: 'weeks', weeks: 1 }); continue; }
        g.fastForward({ until: 'season_end', maxWeeks: 6 });
      }
      const R = g.getRetirement();
      const o = R && R.coaching && R.coaching.offers && R.coaching.offers[0];
      if (!o) return { ok: false, why: 'no offers' };
      return g.mgrRespondOffer(o.id, 'accept');
    });
    assert(r && r.ok, 'could not start coaching: ' + JSON.stringify(r));
    // engine signals are forwarded to telemetry by the UI's facade wrapper (call()): open a screen that uses it
    await goto(page, '#/manager');
    await page.waitForSelector(T('manager'), { visible: true, timeout: 10000 });
    await sleep(600);
    // keepalive flushes ignore the client's retry backoff (a batch may have failed while the admin reset the tables)
    let st = null;
    // a whole simulated career is queued (match_played per match): drain it batch by batch (queue cap 500 < 600/h server limit)
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.__hy.telemetry.flush({ keepalive: true }));
      await sleep(250);
      st = await mockState();
      if (st.events.some((e) => e.name === 'manager_started')) break;
    }
    const by = (n) => st.events.filter((e) => e.name === n);
    const cs = by('career_started'); const rt = by('retired'); const ms = by('manager_started');
    assert(rt.length >= 1 && ms.length >= 1, 'events ' + [...new Set(st.events.map((e) => e.name))].join(','));
    const rp = rt[rt.length - 1].props || {};
    assert(['league', 'tier', 'legacy', 'gender'].every((k) => k in rp), 'retired props ' + JSON.stringify(rp));
    assert(typeof (ms[ms.length - 1].props || {}).tier === 'string', 'manager_started props ' + JSON.stringify(ms[ms.length - 1].props));
    if (cs.length) assert('gender' in (cs[cs.length - 1].props || {}), 'career_started without gender');
  });

  await scenario('B10 sub-path safety: every request is under /hayeled/, a font, the mock or an ad URL', async () => {
    const bad = allRequests.slice(startReq).filter((u) => !isOurs(u) && !isFont(u) && !isMock(u) && !isAd(u) && !u.startsWith('data:') && !u.startsWith('blob:'));
    assert(!bad.length, 'requests outside the allowed set: ' + [...new Set(bad)].slice(0, 10).join(', '));
  });

  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* Group D: v2.1 coaching career (R2) for a boy and a girl            */
/* ------------------------------------------------------------------ */

/** Simulate the career through the facade until age 33, then retire (game.retire()). Returns 'retired' or 'go'. */
async function simToRetire(page, age = 33, budgetMs = 200000) {
  await goto(page, '#/settings');   // a light screen: every notify() re-renders the current view
  const t0 = Date.now();
  let res = 'go';
  while (res === 'go' && Date.now() - t0 < budgetMs) {
    res = await page.evaluate((AGE) => {
      const g = window.__hy.game;
      const t = Date.now();
      while (Date.now() - t < 8000) {
        const h = g.getHub();
        if (h.status === 'retired') return 'retired';
        if (h.player.age >= AGE && h.canRetire) { const r = g.retire(); if (r && r.ok !== false) return 'retired'; }
        for (const r of g.getInbox()) if (r.needsAnswer) { const th = g.getThread(r.id); const c = (th.choices || []).find((x) => !x.disabled); if (c) g.answerEvent(r.id, c.index); }
        for (const o of g.getOffers()) {
          if (o.status !== 'open') continue;
          const want = o.canAccept && (!h.club || o.type === 'renewal' || o.type === 'pro' || o.type === 'free' || (o.club && o.club.strength > 72));
          g.respondOffer(o.id, want ? 'accept' : 'reject');
        }
        if (h.status === 'review') { g.ackSeasonReview(); continue; }
        if (h.status === 'in_week' || h.status === 'match') { g.fastForward({ until: 'weeks', weeks: 1 }); continue; }
        g.fastForward({ until: 'season_end', maxWeeks: 6 });
      }
      return 'go';
    }, age);
  }
  step('simToRetire ' + res + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  return res;
}

/** No euro sign anywhere in the document (R3: every amount is in shekels). */
async function noEuro(page, where) {
  const bad = await page.evaluate(() => { const t = document.body.innerText || ''; const i = t.indexOf('€'); return i >= 0 ? t.slice(Math.max(0, i - 40), i + 20).replace(/\s+/g, ' ') : null; });
  assert(!bad, `${where}: € on screen: ${bad}`);
}

/** Play manager weeks (UI) until a match reel shows; skip it, page through the results, close the summary. */
async function playManagerMatchday(page, tag) {
  let reel = false;
  for (let i = 0; i < 14 && !reel; i++) {
    await click(page, T('mgr-advance'));
    await sleep(700);
    reel = await present(page, T('mgr-reel'));
    if (!reel && await present(page, T('mgr-summary-close'))) { await click(page, T('mgr-summary-close')); await sleep(300); }
    if (!reel && await present(page, T('mgr-review-ack'))) { await click(page, T('mgr-review-ack')); await sleep(300); }
  }
  assert(reel, 'no managed match reel within 14 weeks');
  await sleep(1800);
  await noOverflow(page, 'manager reel');
  await shot(page, 'mgr-reel' + tag, { full: false });
  await click(page, T('mgr-reel-skip'));
  await sleep(300);
  await page.waitForSelector(T('mgr-reel-score'), { visible: true });
  await shot(page, 'mgr-reel-end' + tag, { full: false });
  for (let i = 0; i < 8 && await present(page, T('mgr-reel-next')); i++) {
    await click(page, T('mgr-reel-next')); await sleep(400);
    if (await present(page, T('mgr-reel-skip'))) await click(page, T('mgr-reel-skip'));
  }
  await sleep(400);
  if (await present(page, T('mgr-summary'))) { await noMarkers(page, 'manager summary' + tag); await noEuro(page, 'manager summary' + tag); await shot(page, 'mgr-summary' + tag, { full: false }); }
  if (await present(page, T('mgr-summary-close'))) await click(page, T('mgr-summary-close'));
  await sleep(300);
}

async function groupD(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, 'D');
  let careerId = null;

  await scenario('D1 coaching offers: boy career to 33 via facade -> retire -> reload -> offers on the retirement screen', async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await waitBoot(page);
    await createCareerUI(page, { first: 'אבי', last: 'מאמן', shotsOn: false, tag: '-d' });
    const res = await simToRetire(page);
    assert(res === 'retired', 'did not retire: ' + res);
    careerId = (await meta(page)).careerId;
    await flushSave(page);
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await goto(page, '#/hub');            // the guard sends a retired career with open offers to #/retire
    await page.waitForSelector(T('retire-screen'), { visible: true, timeout: 15000 });
    await sleep(1800);
    await closeTopModals(page);
    await page.waitForSelector(T('coach-offer'), { visible: true });
    const n = await page.$$eval('[data-testid^="coach-accept-"]', (e) => e.length);
    assert(n >= 2, 'expected at least 2 coaching offers, got ' + n);
    await noMarkers(page, 'retire offers'); await noEuro(page, 'retire offers'); await noOverflow(page, 'retire offers');
    await shot(page, 'retire-coach-offers');
  });

  await scenario('D2 accept a coaching job -> office (objective, bars, 5 tactics) -> tactic -> play a managed matchday', async () => {
    const id = await page.$eval('[data-testid^="coach-accept-"]', (e) => e.dataset.testid);
    await click(page, T(id));
    if (await present(page, T('btn-confirm-yes'))) await click(page, T('btn-confirm-yes'));
    await page.waitForSelector(T('manager'), { visible: true, timeout: 10000 });
    assert((await page.evaluate(() => location.hash)).startsWith('#/manager'), 'accepting did not open #/manager');
    for (const tid of ['mgr-hero', 'mgr-objective', 'mgr-bars']) assert(await present(page, T(tid)), tid + ' missing');
    const tac = await page.$$eval('[data-testid^="mgr-tactic-"]', (e) => e.map((x) => x.dataset.testid.replace('mgr-tactic-', '')));
    assert(['attack', 'balanced', 'defend', 'press', 'counter'].every((t) => tac.includes(t)), 'tactics ' + tac);
    const txt = await docText(page);
    assert(/מאמן/.test(txt), 'no "מאמן" wording in the office');
    await noMarkers(page, 'office'); await noEuro(page, 'office'); await noOverflow(page, 'office');
    await shot(page, 'mgr-office');
    await click(page, T('mgr-tactic-press'));
    await sleep(300);
    const cur = await page.evaluate(() => window.__hy.game.getManager().tactic.current);
    assert(cur === 'press', 'tactic not stored: ' + cur);
    const g0 = await page.evaluate(() => (window.__hy.game.getCareer().coach || {}).games || 0);
    await playManagerMatchday(page, '');
    const g1 = await page.evaluate(() => (window.__hy.game.getCareer().coach || {}).games || 0);
    assert(g1 > g0, 'coach record did not count the match: ' + g0 + ' -> ' + g1);
    await shot(page, 'mgr-office-after');
  });

  await scenario('D3 manager screens: transfers / offers / history, schedule + tables follow the team, reload stays on #/manager', async () => {
    for (const s of ['squad', 'offers', 'history']) {
      if (!(await present(page, T('mgr-tab-' + s)))) continue;
      await click(page, T('mgr-tab-' + s));
      await sleep(350);
      await noMarkers(page, 'manager ' + s); await noEuro(page, 'manager ' + s); await noOverflow(page, 'manager ' + s);
      if (s === 'squad' && await present(page, T('mgr-budget-req'))) {
        const dis = await page.$eval(T('mgr-budget-req'), (e) => e.disabled);
        if (!dis) { await click(page, T('mgr-budget-req')); await sleep(500); await closeTopModals(page); }
      }
      await shot(page, 'mgr-' + s);
    }
    await click(page, T('mgr-tab-office'));
    for (const [h, name] of [['#/schedule', 'mgr-schedule'], ['#/tables', 'mgr-tables'], ['#/career', 'mgr-career']]) {
      await goto(page, h); await sleep(300); await closeTopModals(page);
      await noMarkers(page, h); await noEuro(page, h); await noOverflow(page, h);
      await shot(page, name);
    }
    assert(await present(page, T('career-coach')), 'career screen without the coaching record');
    await goto(page, '#/hub'); await sleep(500);
    assert((await page.evaluate(() => location.hash)).startsWith('#/manager'), '#/hub of a coach did not route to #/manager');
    await flushSave(page);
    await page.reload({ waitUntil: 'load' });
    await waitBoot(page);
    await page.waitForSelector(T('manager'), { visible: true, timeout: 10000 });
    await setWidth(page, 360); await noOverflow(page, 'office 360'); await shot(page, 'mgr-office-360'); await setWidth(page, 390);
  });

  await scenario('D4 fast-forward to season end -> season review -> retire from coaching -> HoF "שחקן + מאמן" with both records', async () => {
    await click(page, T('mgr-ff'));
    await click(page, T('mgr-ff-season'));
    await page.waitForFunction(() => !document.querySelector('[data-testid="mgr-ff-overlay"]'), { timeout: 90000 });
    await sleep(800);
    if (await present(page, T('mgr-summary-close'))) await click(page, T('mgr-summary-close'));
    await sleep(500);
    if (await present(page, T('mgr-review-open'))) { await click(page, T('mgr-review-open')); await sleep(500); }
    if (await present(page, T('mgr-review'))) { await noMarkers(page, 'manager review'); await noEuro(page, 'manager review'); await shot(page, 'mgr-review', { full: false }); await click(page, T('mgr-review-ack')); await sleep(400); }
    await page.waitForSelector(T('manager'), { visible: true });
    await click(page, T('mgr-tab-history'));
    await click(page, T('mgr-retire'));
    await click(page, T('btn-confirm-yes'));
    await page.waitForSelector(T('mgr-done'), { visible: true, timeout: 10000 });
    await shot(page, 'mgr-done');
    await click(page, T('mgr-hof'));
    await page.waitForSelector(T('hof-item-' + careerId), { visible: true, timeout: 10000 });
    const row = await page.$eval(T('hof-item-' + careerId), (e) => e.innerText);
    assert(/שחקן \+ מאמן/.test(row), 'HoF row without "שחקן + מאמן": ' + row.replace(/\s+/g, ' '));
    await click(page, T('hof-item-' + careerId));
    await page.waitForSelector(T('hof-coach'), { visible: true, timeout: 5000 });
    await noMarkers(page, 'hof detail');
    await shot(page, 'hof-detail-coach', { full: false });
    await closeTopModals(page);
  });

  await ctx.close();

  await scenario('D5 girl career: coaching in women\'s football with feminine forms ("מאמנת")', async () => {
    const fctx = await browser.createBrowserContext();
    const p = await newPage(fctx, 'D-f');
    await p.goto(BASE, { waitUntil: 'load' });
    await waitBoot(p);
    await p.evaluate(async () => {
      const g = window.__hy.game;
      const club = g.getAcademyOptions('isr', { gender: 'f' }).groups[0].clubs[0].id;
      await window.__hy.ctx.hooks.startNewCareer({ first: 'שירה', last: 'בן דוד', nick: '', nation: 'isr', pos: 'CM', foot: 'R', club, gender: 'f', look: { skin: 1, hair: 'bun', hairColor: 0 } }, 1);
    });
    await sleep(500);
    await closeTopModals(p);
    const res = await simToRetire(p);
    assert(res === 'retired', 'girl did not retire: ' + res);
    await goto(p, '#/retire');
    await p.waitForSelector(T('retire-screen'), { visible: true, timeout: 15000 });
    await sleep(1800);
    await closeTopModals(p);
    await p.waitForSelector(T('coach-offer'), { visible: true });
    let t = await docText(p);
    assert(/מאמנת/.test(t), 'girl coaching offers without "מאמנת"');
    await noMarkers(p, 'retire offers (f)'); await noEuro(p, 'retire offers (f)');
    await shot(p, 'retire-coach-offers-f');
    const id = await p.$eval('[data-testid^="coach-accept-"]', (e) => e.dataset.testid);
    await click(p, T(id));
    if (await present(p, T('btn-confirm-yes'))) await click(p, T('btn-confirm-yes'));
    await p.waitForSelector(T('manager'), { visible: true, timeout: 10000 });
    t = await docText(p);
    assert(/מאמנת/.test(t), 'girl office without "מאמנת"');
    await noMarkers(p, 'office (f)'); await noEuro(p, 'office (f)'); await noOverflow(p, 'office (f)');
    await shot(p, 'mgr-office-f');
    await playManagerMatchday(p, '-f');
    await noMarkers(p, 'office after match (f)');
    await shot(p, 'mgr-office-after-f');
    await fctx.close();
  });
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await startServe();
  await startMock();
  const userDataDir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'hy-e2e-'));
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: !HEADFUL, userDataDir,
    args: ['--lang=he-IL', '--no-first-run', '--no-default-browser-check', '--disable-features=Translate'],
  });
  const t0 = Date.now();
  try {
    if (!ONLY || ONLY === 'a') await groupA(browser);
    if (!ONLY || ONLY === 'c') await groupC(browser);
    if (!ONLY || ONLY === 'b') await groupB(browser);
    if (!ONLY || ONLY === 'd') await groupD(browser);
  } finally {
    await browser.close().catch(() => {});
    for (const c of children) { try { c.kill(); } catch { /* ignore */ } }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed in ${((Date.now() - t0) / 1000).toFixed(0)}s; ${shots.length} screenshots in ${SHOTS}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  for (const c of children) { try { c.kill(); } catch { /* ignore */ } }
  process.exit(1);
});

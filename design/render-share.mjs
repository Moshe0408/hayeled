// design/render-share.mjs: renders design/share.html -> share.jpg (1200x630 JPEG, < 300 KB) with headless Chrome.
// Usage: PUPPETEER_CORE_PATH=<path to puppeteer-core> node design/render-share.mjs [--chrome <chrome.exe>] [--port 8799]
// Starts tests/serve.mjs itself (the page uses ES modules, so it must be served over http).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8799));
const CHROME = arg('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_CORE_PATH || 'puppeteer-core');

const srv = spawn(process.execPath, [path.join(ROOT, 'tests/serve.mjs'), String(PORT), '--base', '/hayeled/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/hayeled/design/share.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__shareReady === true, { timeout: 20000 });
  if (process.env.DEBUG) console.log(await page.evaluate(() => [location.href, document.querySelectorAll('.pcard').length, getComputedStyle(document.querySelector('.sh-sc')).display]));
  const out = path.join(ROOT, 'share.jpg');
  let q = 88;
  for (;;) {
    await page.screenshot({ path: out, type: 'jpeg', quality: q });
    const kb = fs.statSync(out).size / 1024;
    if (kb < 290 || q <= 60) { console.log(`share.jpg ${kb.toFixed(0)} KB (quality ${q})`); break; }
    q -= 6;
  }
} finally {
  await browser.close();
  srv.kill();
}

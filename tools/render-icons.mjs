// tools/render-icons.mjs: rasterise icons/icon.svg into the PWA PNG icons with headless Chrome.
// Usage: PUPPETEER_CORE_PATH=<dir containing node_modules/puppeteer-core> node tools/render-icons.mjs
// (dev-only tool; the game itself has no dependencies)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const base = process.env.PUPPETEER_CORE_PATH || path.join(ROOT, 'tests');
const puppeteer = createRequire(path.join(base, 'x.js'))('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const svg = readFileSync(path.join(ROOT, 'icons/icon.svg'), 'utf8');

// [file, size, corner radius as a fraction of the size]; maskable icons stay full-bleed
const OUT = [
  ['icon-192.png', 192, 0.2], ['icon-512.png', 512, 0.2],
  ['maskable-512.png', 512, 0], ['apple-touch-icon.png', 180, 0],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
for (const [file, size, radius] of OUT) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden">
    ${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</div></body></html>`);
  await page.screenshot({ path: path.join(ROOT, 'icons', file), omitBackground: true });
  console.log('icons/' + file);
}
await browser.close();

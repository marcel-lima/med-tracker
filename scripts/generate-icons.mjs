// Renders scripts/icon.svg to public/icons/*.png with headless Chromium.
// Run: node scripts/generate-icons.mjs   (needs `playwright` installed, e.g. `npm i --no-save playwright`)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(here, 'icon.svg'), 'utf8');
const outDir = path.join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// maskable: the OS may crop to a circle/squircle inside the central 80%, so the
// artwork is scaled down to sit inside that safe zone on a white bleed.
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable.png', size: 512, scale: 0.78 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = Math.round(t.size * t.scale);
  const offset = Math.round((t.size - inner) / 2);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff;width:${t.size}px;height:${t.size}px;overflow:hidden">
    <div style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
  </body></html>`);
  await page.screenshot({ path: path.join(outDir, t.file), clip: { x: 0, y: 0, width: t.size, height: t.size }, omitBackground: false });
  console.log('wrote', t.file);
}
await browser.close();

/**
 * Generates maskable PWA icons and screenshots from the Nido brand colours.
 * Run: node scripts/gen-pwa-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..', 'public');

/** Warm amber on dark — matches --primary / --background in dark theme. */
const BG = { r: 28, g: 26, b: 24 };
const ACCENT = { r: 230, g: 168, b: 72 };

async function icon(size) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="rgb(${BG.r},${BG.g},${BG.b})"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${inner / 2}" fill="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      font-family="Georgia,serif" font-size="${Math.round(size * 0.38)}" fill="rgb(${BG.r},${BG.g},${BG.b})">N</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function screenshot(w, h) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="rgb(${BG.r},${BG.g},${BG.b})"/>
    <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.08)}" fill="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" opacity="0.9"/>
    <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.06)}" font-family="system-ui,sans-serif"
      font-size="${Math.round(h * 0.035)}" fill="rgb(${BG.r},${BG.g},${BG.b})">Nido</text>
    <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.14)}" width="${Math.round(w * 0.88)}" height="${Math.round(h * 0.12)}"
      rx="12" fill="rgb(45,42,38)"/>
    <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.3)}" width="${Math.round(w * 0.88)}" height="${Math.round(h * 0.55)}"
      rx="12" fill="rgb(45,42,38)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const iconsDir = join(ROOT, 'icons');
const shotsDir = join(ROOT, 'screenshots');
await mkdir(iconsDir, { recursive: true });
await mkdir(shotsDir, { recursive: true });

for (const size of [192, 512, 1024]) {
  const buf = await icon(size);
  await writeFile(join(iconsDir, `icon-${size}.png`), buf);
}
await writeFile(join(iconsDir, 'apple-touch-icon.png'), await icon(180));
await writeFile(join(shotsDir, 'wide.png'), await screenshot(1280, 720));
await writeFile(join(shotsDir, 'narrow.png'), await screenshot(750, 1334));

console.log('PWA icons and screenshots written to public/icons and public/screenshots');

/**
 * Generates maskable PWA icons, favicon, and store screenshots from the Nido nest mark.
 * Run: node scripts/gen-pwa-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..', 'public');
const APP = join(import.meta.dirname, '..', 'src', 'app');

/** Warm amber on dark — matches --primary / --background in dark theme. */
const BG = '#1c1a18';
const ACCENT = '#e6a848';

/** Nest mark path from `NidoLogo` (viewBox 0 0 32 32). */
const MARK =
  'M16 4c-4.5 0-8 3.2-8 7.2 0 2.2.9 4.2 2.4 5.6C8.9 17.2 8 19.2 8 21.4 8 25.4 11.5 28.5 16 28.5s8-3.1 8-7.1c0-2.2-.9-4.2-2.4-5.7 1.5-1.4 2.4-3.4 2.4-5.6C24 7.2 20.5 4 16 4Zm0 4c2.2 0 4 1.6 4 3.6S18.2 15.2 16 15.2 12 13.6 12 11.6 13.8 8 16 8Zm0 14.5c-2.8 0-5-1.9-5-4.3 0-1.5.8-2.8 2.1-3.5 1 .6 2.2.9 3.5.9s2.5-.3 3.5-.9c1.3.7 2.1 2 2.1 3.5 0 2.4-2.2 4.3-5 4.3Z';

function iconSvg(size, { maskable = false } = {}) {
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.14);
  const inner = size - pad * 2;
  const radius = Math.round(size * (maskable ? 0.22 : 0.2));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 32})">
    <path d="${MARK}" fill="${ACCENT}"/>
  </g>
</svg>`;
}

async function iconPng(size, opts) {
  return sharp(Buffer.from(iconSvg(size, opts)))
    .png()
    .toBuffer();
}

async function screenshot(w, h) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${BG}"/>
    <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.08)}" fill="${ACCENT}" opacity="0.9"/>
    <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.055)}" font-family="Georgia,serif"
      font-size="${Math.round(h * 0.04)}" fill="${BG}">nido</text>
    <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.14)}" width="${Math.round(w * 0.88)}" height="${Math.round(h * 0.12)}"
      rx="12" fill="#2d2a26"/>
    <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.3)}" width="${Math.round(w * 0.88)}" height="${Math.round(h * 0.55)}"
      rx="12" fill="#2d2a26"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const iconsDir = join(ROOT, 'icons');
const shotsDir = join(ROOT, 'screenshots');
await mkdir(iconsDir, { recursive: true });
await mkdir(shotsDir, { recursive: true });
await mkdir(APP, { recursive: true });

for (const size of [192, 512, 1024]) {
  await writeFile(join(iconsDir, `icon-${size}.png`), await iconPng(size, { maskable: true }));
}
await writeFile(join(iconsDir, 'apple-touch-icon.png'), await iconPng(180, { maskable: true }));
await writeFile(join(iconsDir, 'icon-32.png'), await iconPng(32));
await writeFile(join(iconsDir, 'icon-16.png'), await iconPng(16));

/** App-router favicon + static PNG icon (picked up by Next metadata). */
const favicon32 = await iconPng(32);
const favicon16 = await iconPng(16);
await writeFile(join(APP, 'icon.png'), await iconPng(512));
await writeFile(
  join(APP, 'favicon.ico'),
  await sharp(favicon32)
    .resize(32, 32)
    .toFormat('png')
    .toBuffer()
    .then(async (png32) => {
      // ICO with 16 + 32 PNG payloads (modern browsers).
      const png16 = await sharp(favicon16).resize(16, 16).png().toBuffer();
      return buildIco([
        { size: 16, png: png16 },
        { size: 32, png: png32 },
      ]);
    }),
);

await writeFile(join(shotsDir, 'wide.png'), await screenshot(1280, 720));
await writeFile(join(shotsDir, 'narrow.png'), await screenshot(750, 1334));

console.log('PWA icons, favicon, and screenshots written');

/** Minimal multi-image ICO writer (PNG-compressed entries). */
function buildIco(entries) {
  const headerSize = 6 + 16 * entries.length;
  const buffers = [];
  let offset = headerSize;
  const dir = Buffer.alloc(headerSize);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(entries.length, 4);
  for (let i = 0; i < entries.length; i++) {
    const { size, png } = entries[i];
    const o = 6 + i * 16;
    dir.writeUInt8(size === 256 ? 0 : size, o);
    dir.writeUInt8(size === 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    buffers.push(png);
    offset += png.length;
  }
  return Buffer.concat([dir, ...buffers]);
}

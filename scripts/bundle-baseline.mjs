#!/usr/bin/env node
/**
 * Gzipped size of `.next/static` JS after `pnpm build`.
 * Used as the Turbopack-friendly baseline; `pnpm analyze` opens the webpack treemap
 * when ANALYZE=true (webpack build).
 */
import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), '.next', 'static');
const HEAVY = ['recharts', 'xlsx', '@react-pdf', 'AssistantPanel'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

try {
  await stat(ROOT);
} catch {
  console.error('No .next/static — run `pnpm build` first.');
  process.exit(1);
}

const files = await walk(ROOT);
const rows = [];
for (const file of files) {
  const buf = await readFile(file);
  const gzip = gzipSync(buf).length;
  const text = buf.toString('utf8');
  rows.push({
    file: path.relative(ROOT, file).replaceAll('\\', '/'),
    raw: buf.length,
    gzip,
    libs: HEAVY.filter((token) => text.toLowerCase().includes(token)),
  });
}
rows.sort((a, b) => b.gzip - a.gzip);

const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
console.log(`JS chunks: ${String(rows.length)} files, ${String(kb(totalGzip))} KB gzipped total\n`);
console.log('Largest 20:');
for (const row of rows.slice(0, 20)) {
  console.log(`  ${String(kb(row.gzip)).padStart(7)} KB  ${row.file}`);
}

const heavyHits = rows.filter((row) => row.libs.length > 0);
if (heavyHits.length > 0) {
  console.log('\nChunks whose source mentions a heavy lib (should be async, not first paint):');
  for (const row of heavyHits) {
    console.log(`  ${String(kb(row.gzip)).padStart(7)} KB  ${row.libs.join(', ')}  ${row.file}`);
  }
} else {
  console.log('\nNo JS chunk contains recharts / xlsx / react-pdf / assistant as text.');
}

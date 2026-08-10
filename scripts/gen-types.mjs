#!/usr/bin/env node
/**
 * Regenerates `src/lib/supabase/database.types.ts` from the local Supabase database.
 * Run after every migration (`pnpm db:types`) and commit the result — see
 * docs/06-CONVENTIONS.md §4. Requires the local stack to be running (`pnpm db:start`).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(rootDir, 'src/lib/supabase/database.types.ts');

// `shell: true` is required so Windows can resolve the `supabase` CLI's `.cmd` shim; the
// arguments are fixed literals with no external input, so there is no injection surface.
const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'nido'],
  { cwd: rootDir, encoding: 'utf8', shell: true },
);

if (result.error) {
  process.stderr.write(`Failed to spawn supabase CLI: ${result.error.message}\n`);
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(result.stderr || 'supabase gen types failed with no output\n');
  process.exit(result.status ?? 1);
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm db:types\` after every migration. Source of truth: the local
 * Supabase database's \`nido\` schema. See docs/06-CONVENTIONS.md §4.
 */

`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, header + result.stdout, 'utf8');

process.stdout.write(`Wrote ${outputPath}\n`);

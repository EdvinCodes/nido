#!/usr/bin/env node
/**
 * Runs the pgTAP suite in `supabase/tests/` against the local Supabase stack.
 * Requires the stack to already be running (`pnpm db:start`) with migrations applied.
 * See docs/06-CONVENTIONS.md §5.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// `shell: true` is required so Windows can resolve the `supabase` CLI's `.cmd` shim; the
// arguments are fixed literals with no external input, so there is no injection surface.
const result = spawnSync('npx', ['supabase', 'test', 'db'], {
  cwd: rootDir,
  encoding: 'utf8',
  shell: true,
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`Failed to spawn supabase CLI: ${result.error.message}\n`);
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(
    '\npgTAP failed. Is the local stack running? Try `pnpm db:start` then `pnpm db:reset` first.\n',
  );
  process.exit(result.status ?? 1);
}

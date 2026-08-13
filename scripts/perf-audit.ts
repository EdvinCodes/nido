/**
 * Lighthouse against a production `pnpm start` server (not `pnpm dev`).
 * Does not change Docker / WSL memory.
 *
 * Usage:
 *   pnpm build && pnpm start     # terminal 1
 *   pnpm perf:audit              # terminal 2
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { DEMO_ALEX } from '../e2e/helpers/auth';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT_DIR = path.join(process.cwd(), 'lighthouse-reports');
const SPACE_URL = /\/s\/[0-9a-f-]{36}/i;

type LighthouseRow = {
  name: string;
  url: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
};

async function assertProdServer(): Promise<void> {
  try {
    const res = await fetch(`${BASE}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    throw new Error(`Cannot reach ${BASE}. In another terminal run:\n  pnpm build && pnpm start`);
  }
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true, windowsHide: true });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${String(code ?? 'null')}`));
    });
  });
}

async function lighthouse(
  url: string,
  name: string,
  headers?: Record<string, string>,
): Promise<LighthouseRow> {
  const outFile = path.join(OUT_DIR, `${name}.json`);
  const profileDir = path.join(OUT_DIR, 'chrome-profile');
  const args = [
    'dlx',
    'lighthouse',
    url,
    '--output=json',
    `--output-path=${outFile}`,
    `--chrome-flags=--headless --no-sandbox --disable-gpu --user-data-dir=${profileDir}`,
    '--form-factor=mobile',
    '--screenEmulation.mobile=true',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet',
  ];
  if (headers) {
    args.push(`--extra-headers=${JSON.stringify(headers)}`);
  }
  try {
    await run('pnpm', args);
  } catch (error) {
    // chrome-launcher on Windows often EPERM-deletes its temp dir after a successful run.
    try {
      await readFile(outFile, 'utf8');
    } catch {
      throw error;
    }
  }
  const raw = JSON.parse(await readFile(outFile, 'utf8')) as {
    categories: Record<string, { score?: number } | undefined>;
    audits: Record<string, { numericValue?: number } | undefined>;
  };
  const cats = raw.categories;
  const audits = raw.audits;
  return {
    name,
    url,
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    inpMs: audits['interaction-to-next-paint']?.numericValue ?? null,
  };
}

function score(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(Math.round(value));
}

async function signInCookies(): Promise<{ spaceId: string; cookieHeader: string }> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${BASE}/sign-in`);
  const devButton = page.getByRole('button', {
    name: /entrar como alex|sign in as alex/i,
  });
  const hasDevLogin = await devButton
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (hasDevLogin) {
    await devButton.click();
  } else {
    await page.getByLabel(/correo|email/i).fill(DEMO_ALEX.email);
    await page.getByLabel(/contraseña|password/i).fill(DEMO_ALEX.password);
    await page
      .locator('form')
      .getByRole('button', { name: /^(entrar|sign in)$/i })
      .click();
  }
  await page.waitForURL((url) => SPACE_URL.test(url.pathname) || url.pathname === '/', {
    timeout: 30_000,
    waitUntil: 'commit',
  });
  if (!SPACE_URL.test(new URL(page.url()).pathname)) {
    await page.goto(`${BASE}/`);
    await page.waitForURL(SPACE_URL, { timeout: 30_000, waitUntil: 'commit' });
  }
  const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!spaceId) {
    await browser.close();
    throw new Error(`Could not parse space id from ${page.url()}`);
  }
  const cookies = await page.context().cookies();
  await browser.close();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return { spaceId, cookieHeader };
}

async function main(): Promise<void> {
  await assertProdServer();
  await mkdir(OUT_DIR, { recursive: true });

  const landing = await lighthouse(`${BASE}/`, 'landing');
  let rows: LighthouseRow[] = [landing];
  try {
    const { spaceId, cookieHeader } = await signInCookies();
    const headers = { Cookie: cookieHeader };
    const dashboard = await lighthouse(`${BASE}/s/${spaceId}`, 'dashboard', headers);
    const ledger = await lighthouse(`${BASE}/s/${spaceId}/ledger`, 'ledger', headers);
    rows = [landing, dashboard, ledger];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skipping dashboard/ledger (need a running local Supabase + seed):\n  ${message}`);
  }
  console.log('\nLighthouse (mobile, simulated 4G)\n');
  console.log(['route', 'perf', 'a11y', 'bp', 'seo', 'LCP ms', 'CLS', 'INP ms'].join('\t'));
  for (const row of rows) {
    console.log(
      [
        row.name,
        score(row.performance),
        score(row.accessibility),
        score(row.bestPractices),
        score(row.seo),
        row.lcpMs == null ? '—' : score(row.lcpMs),
        row.cls == null ? '—' : String(Math.round(row.cls * 1000) / 1000),
        row.inpMs == null ? '—' : score(row.inpMs),
      ].join('\t'),
    );
  }

  const md = [
    '# Performance baseline',
    '',
    `Recorded ${new Date().toISOString().slice(0, 10)} against \`pnpm start\` at \`${BASE}\`.`,
    'Mobile emulation, Lighthouse simulated throttling. Docker RAM was **not** raised.',
    '',
    '| Route | Perf | A11y | Best practices | SEO | LCP (ms) | CLS | INP (ms) |',
    '| ----- | ---: | ---: | -------------: | --: | -------: | --: | -------: |',
    ...rows.map(
      (row) =>
        `| ${row.name} | ${score(row.performance)} | ${score(row.accessibility)} | ${score(row.bestPractices)} | ${score(row.seo)} | ${row.lcpMs == null ? '—' : score(row.lcpMs)} | ${row.cls == null ? '—' : String(Math.round(row.cls * 1000) / 1000)} | ${row.inpMs == null ? '—' : score(row.inpMs)} |`,
    ),
    '',
    'Targets ([docs/01-ARCHITECTURE.md](../01-ARCHITECTURE.md) § 8): landing LCP < 1200 ms,',
    'dashboard LCP < 1500 ms, INP < 200 ms, CLS < 0.05, dashboard initial JS < 180 KB gzipped.',
    'Phase 11 also asked for Lighthouse perf ≥ 95 and a11y 100 on landing and dashboard.',
    '',
    'Raw JSON: `lighthouse-reports/` (gitignored). Re-run with `pnpm build && pnpm start` then `pnpm perf:audit`.',
    rows.length < 3
      ? 'Dashboard and ledger were skipped because sign-in against local Supabase failed (stack stopped). Re-run with `pnpm db:start` when Docker has headroom — do not raise the WSL memory cap on a work machine.'
      : '',
    '',
  ].join('\n');

  await writeFile(path.join(OUT_DIR, 'summary.md'), md);
  console.log(
    '\nWrote lighthouse-reports/summary.md — copy scores into docs/phases/PERF-BASELINE.md',
  );
}

void main();

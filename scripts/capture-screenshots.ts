/**
 * Captures marketing screenshots from the seeded demo space.
 * Requires local Supabase with seed data and a running dev server on port 3000.
 *
 * Usage: pnpm dev   (terminal 1)
 *        pnpm screenshots
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { DEMO_ALEX } from '../e2e/helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT_DIR = path.join(process.cwd(), 'public/screenshots/marketing');
const SPACE_URL = /\/s\/[0-9a-f-]{36}/i;

type Shot = {
  name: string;
  path: string;
  waitFor?: string;
};

async function assertDevServerReachable(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    throw new Error(
      `Cannot reach ${BASE_URL}. Start the app first:\n  pnpm db:start && pnpm db:reset && pnpm dev`,
    );
  }
}

async function signInDemoPage(page: Page): Promise<string> {
  await page.goto('/sign-in');

  const devButton = page.getByRole('button', {
    name: /entrar como alex|sign in as alex/i,
  });
  const hasDevLogin = await devButton
    .waitFor({ state: 'visible', timeout: 15_000 })
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

  try {
    await page.waitForURL((url) => SPACE_URL.test(url.pathname) || url.pathname === '/', {
      timeout: 60_000,
      waitUntil: 'commit',
    });
  } catch {
    throw new Error(
      `Sign-in failed (still at ${page.url()}). ` +
        `Check .env.local Supabase keys (npx supabase status -o env) and run pnpm db:reset.`,
    );
  }

  if (!SPACE_URL.test(new URL(page.url()).pathname)) {
    await page.goto('/');
    await page.waitForURL(SPACE_URL, { timeout: 60_000, waitUntil: 'commit' });
  }

  const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!spaceId) throw new Error(`Could not parse space id from ${page.url()}`);
  return spaceId;
}

async function main(): Promise<void> {
  await assertDevServerReachable();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  const spaceId = await signInDemoPage(page);

  const shots: Shot[] = [
    { name: 'hero', path: `/s/${spaceId}/ledger`, waitFor: 'main' },
    { name: 'dashboard', path: `/s/${spaceId}`, waitFor: 'main' },
    { name: 'splits', path: `/s/${spaceId}/ledger`, waitFor: 'main' },
    { name: 'budgets', path: `/s/${spaceId}/budgets`, waitFor: 'main' },
    { name: 'balances', path: `/s/${spaceId}/balances`, waitFor: 'main' },
  ];

  for (const shot of shots) {
    await page.goto(shot.path);
    await page
      .locator(shot.waitFor ?? 'main')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(500);
    const pngPath = path.join(OUT_DIR, `${shot.name}.png`);
    await page.locator('main').first().screenshot({ path: pngPath });
    console.log(`Wrote ${pngPath}`);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

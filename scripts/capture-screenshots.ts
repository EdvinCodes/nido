/**
 * Captures marketing screenshots from the seeded demo space.
 * Requires local Supabase with seed data and a running dev server on port 3000.
 *
 * Usage: pnpm screenshots
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { signInDemo } from '../e2e/helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT_DIR = path.join(process.cwd(), 'public/screenshots/marketing');

type Shot = {
  name: string;
  path: string;
  waitFor?: string;
};

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  const spaceId = await signInDemo(page);

  const shots: Shot[] = [
    { name: 'hero', path: `/s/${spaceId}/ledger`, waitFor: 'main' },
    { name: 'dashboard', path: `/s/${spaceId}`, waitFor: 'main' },
    { name: 'splits', path: `/s/${spaceId}/ledger`, waitFor: 'main' },
    { name: 'budgets', path: `/s/${spaceId}/budgets`, waitFor: 'main' },
    { name: 'balances', path: `/s/${spaceId}/balances`, waitFor: 'main' },
  ];

  for (const shot of shots) {
    await page.goto(`${BASE_URL}${shot.path}`);
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
  console.log('Done. Convert PNGs to WebP for the landing page if needed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

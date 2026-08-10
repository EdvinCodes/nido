import type { Page } from '@playwright/test';

/** Demo seed user — see supabase/seed.sql */
export const DEMO_ALEX = {
  email: 'alex@demo.nido.local',
  password: 'password123',
} as const;

export async function signInDemo(
  page: Page,
  email = DEMO_ALEX.email,
  password = DEMO_ALEX.password,
) {
  await page.goto('/sign-in');

  const devAlex = page.getByRole('button', { name: /entrar como alex|sign in as alex/i });
  if (await devAlex.isVisible()) {
    await devAlex.click();
    await page.waitForURL(/\/s\/[0-9a-f-]{36}/i, { timeout: 30_000 });
    const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
    if (!spaceId) throw new Error(`Could not parse space id from ${page.url()}`);
    return spaceId;
  }

  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contraseña|password/i).fill(password);
  await page
    .locator('form')
    .getByRole('button', { name: /^(entrar|sign in)$/i })
    .click();
  await page.waitForURL(/\/s\/[0-9a-f-]{36}/i, { timeout: 30_000 });
  const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!spaceId) throw new Error(`Could not parse space id from ${page.url()}`);
  return spaceId;
}

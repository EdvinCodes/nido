import type { Page } from '@playwright/test';

/** Demo seed user — see supabase/seed.sql */
export const DEMO_ALEX = {
  email: 'alex@demo.nido.local',
  password: 'password123',
} as const;

const SPACE_URL = /\/s\/[0-9a-f-]{36}/i;

function parseSpaceId(url: string): string {
  const spaceId = url.match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!spaceId) throw new Error(`Could not parse space id from ${url}`);
  return spaceId;
}

/** Lands on a space dashboard after sign-in (seed users must exist — `pnpm db:reset`). */
export async function signInDemo(
  page: Page,
  email: string = DEMO_ALEX.email,
  password: string = DEMO_ALEX.password,
) {
  await page.goto('/sign-in');

  const isSam = email.toLowerCase().includes('sam@');
  const devButton = page.getByRole('button', {
    name: isSam ? /entrar como sam|sign in as sam/i : /entrar como alex|sign in as alex/i,
  });
  // Wait for the client panel (or fall back to the password form).
  const hasDevLogin = await devButton
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (hasDevLogin) {
    await devButton.click();
  } else {
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page
      .locator('form')
      .getByRole('button', { name: /^(entrar|sign in)$/i })
      .click();
  }

  // Soft navigations (App Router) do not always fire a full "load"; commit is enough.
  // Accept `/` briefly — marketing then server-redirects to `/s/:id`.
  try {
    await page.waitForURL((url) => SPACE_URL.test(url.pathname) || url.pathname === '/', {
      timeout: 30_000,
      waitUntil: 'commit',
    });
  } catch (error) {
    throw new Error(
      `Demo sign-in did not leave /sign-in (still at ${page.url()}). ` +
        `Ensure seed users can log in (auth.identities + empty token columns). ` +
        `Original: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!SPACE_URL.test(new URL(page.url()).pathname)) {
    await page.goto('/');
    await page.waitForURL(SPACE_URL, { timeout: 30_000, waitUntil: 'commit' });
  }

  return parseSpaceId(page.url());
}

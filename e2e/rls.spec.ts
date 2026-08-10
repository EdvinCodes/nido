import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.nido.local`;
}

async function signUpSolo(page: Page, email: string, spaceName: string): Promise<string> {
  await page.goto('/sign-up');
  await page.getByLabel(/nombre visible|display name/i).fill(spaceName);
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contraseña|password/i).fill('Password123!');
  await page.getByRole('button', { name: /registrarse|sign up/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 });
  await page.getByRole('button', { name: /solo/i }).first().click();
  await page.waitForURL(/step=2/);
  await page.getByLabel(/nombre del espacio|space name/i).fill(spaceName);
  await page.getByRole('button', { name: /continuar|continue/i }).click();
  await page.waitForURL(/step=3/);
  await page.getByRole('button', { name: /crear espacio|create space/i }).click();
  await page.waitForURL(/\/s\/[0-9a-f-]{36}/i, { timeout: 20_000 });
  const id = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!id) throw new Error(`Could not parse space id from ${page.url()}`);
  return id;
}

test.describe('space RLS in the UI', () => {
  test('visiting another space URL returns 404', async ({ browser }) => {
    test.setTimeout(120_000);
    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alice = await aliceCtx.newPage();
    const bob = await bobCtx.newPage();

    const aliceSpace = await signUpSolo(alice, uniqueEmail('alice'), 'Alice Space');
    const bobSpace = await signUpSolo(bob, uniqueEmail('bob'), 'Bob Space');
    expect(aliceSpace).not.toEqual(bobSpace);

    await bob.goto(`/s/${aliceSpace}`);
    await expect(bob.getByRole('heading', { name: /no encontrada|not found/i })).toBeVisible({
      timeout: 10_000,
    });

    await aliceCtx.close();
    await bobCtx.close();
  });
});

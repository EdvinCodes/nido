import { expect, test, type Page } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.nido.local`;
}

async function signUpAndCreateSpace(page: Page, email: string, spaceName: string) {
  const password = 'Password123!';
  await page.goto('/sign-up');
  await page.getByLabel(/nombre visible|display name/i).fill('Host');
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contraseña|password/i).fill(password);
  await page.getByRole('button', { name: /registrarse|sign up/i }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await page.getByRole('button', { name: /pareja|couple/i }).click();
  await page.waitForURL(/step=2/);
  await page.getByLabel(/nombre del espacio|space name/i).fill(spaceName);
  await page.getByRole('button', { name: /continuar|continue/i }).click();
  await page.waitForURL(/step=3/);
  await page.getByRole('button', { name: /crear espacio|create space/i }).click();
  await page.waitForURL(/\/s\/[0-9a-f-]{36}/i, { timeout: 30_000 });
  const id = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
  if (!id) throw new Error(`Could not parse space id from ${page.url()}`);
  return id;
}

test.describe('invite flow', () => {
  test('host creates invite link; guest accepts and sees the space', async ({ browser }) => {
    test.setTimeout(180_000);
    const host = await browser.newContext();
    const guest = await browser.newContext();
    const hostPage = await host.newPage();
    const guestPage = await guest.newPage();

    const hostEmail = uniqueEmail('host');
    const guestEmail = uniqueEmail('guest');
    const spaceId = await signUpAndCreateSpace(hostPage, hostEmail, 'Shared Nest');

    await hostPage.goto(`/s/${spaceId}/settings/members`);
    await expect(hostPage.getByRole('heading', { name: /members|miembros/i })).toBeVisible({
      timeout: 15_000,
    });
    await hostPage
      .getByRole('button', { name: /copy invite link|copiar enlace de invitación/i })
      .click();
    const linkText = hostPage.locator('.font-mono').first();
    await expect(linkText).toBeVisible({ timeout: 15_000 });
    const inviteUrl = (await linkText.textContent())?.trim() ?? '';
    expect(inviteUrl).toMatch(/\/invite\/[a-f0-9]{32,}/i);
    const invitePath = new URL(inviteUrl).pathname;

    await guestPage.goto('/sign-up');
    await guestPage.getByLabel(/nombre visible|display name/i).fill('Guest');
    await guestPage.getByLabel(/correo|email/i).fill(guestEmail);
    await guestPage.getByLabel(/contraseña|password/i).fill('Password123!');
    await guestPage.getByRole('button', { name: /registrarse|sign up/i }).click();
    await guestPage.waitForURL(/\/onboarding|\/s\//, { timeout: 30_000 });

    await guestPage.goto(invitePath);
    await guestPage.waitForURL(new RegExp(`/s/${spaceId}`), { timeout: 30_000 });
    await expect(guestPage.getByRole('heading', { name: /panel|dashboard/i })).toBeVisible();

    await host.close();
    await guest.close();
  });
});

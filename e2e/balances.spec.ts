import { expect, test, type Page } from '@playwright/test';
import { DEMO_ALEX, signInDemo } from './helpers/auth';

const DEMO_SAM = {
  email: 'sam@demo.nido.local',
  password: 'password123',
} as const;

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.nido.local`;
}

async function signUpCouple(page: Page, email: string, spaceName: string): Promise<string> {
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

test.describe('balances and settlements', () => {
  test('seeded couple space shows balances page and rail', async ({ page }) => {
    test.setTimeout(120_000);
    const spaceId = await signInDemo(page, DEMO_ALEX.email, DEMO_ALEX.password);
    await page.goto(`/s/${spaceId}/balances`);
    await expect(page.getByRole('main').getByTestId('balances-headline')).toBeVisible({
      timeout: 30_000,
    });
    await page.goto(`/s/${spaceId}`);
    await expect(page.getByTestId('rail-balances')).toBeVisible({ timeout: 30_000 });
  });

  test('solo space hides balances rail and page', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/sign-up');
    const email = uniqueEmail('solo-bal');
    await page.getByLabel(/nombre visible|display name/i).fill('Solo');
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill('Password123!');
    await page.getByRole('button', { name: /registrarse|sign up/i }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    await page.getByRole('button', { name: /solo|individual/i }).click();
    await page.waitForURL(/step=2/);
    await page.getByLabel(/nombre del espacio|space name/i).fill(`Solo ${Date.now()}`);
    await page.getByRole('button', { name: /continuar|continue/i }).click();
    await page.waitForURL(/step=3/);
    await page.getByRole('button', { name: /crear espacio|create space/i }).click();
    await page.waitForURL(/\/s\/[0-9a-f-]{36}/i, { timeout: 30_000 });
    const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
    if (!spaceId) throw new Error('missing space id');

    await expect(page.getByTestId('rail-balances')).toHaveCount(0);
    const desktopNav = page.getByRole('navigation', { name: 'Primary' });
    if (await desktopNav.isVisible()) {
      await expect(desktopNav.getByText(/balances|saldos/i)).toHaveCount(0);
    }
    await page.goto(`/s/${spaceId}/balances`);
    await expect(page.getByTestId('balances-headline')).toHaveCount(0);
  });

  test('host proposes and guest confirms without refresh', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const hostEmail = uniqueEmail('bal-host');
    const guestEmail = uniqueEmail('bal-guest');
    const spaceId = await signUpCouple(host, hostEmail, `Balances ${Date.now()}`);

    await host.goto(`/s/${spaceId}/settings/members`);
    await expect(host.getByRole('heading', { level: 1, name: /members|miembros/i })).toBeVisible({
      timeout: 30_000,
    });
    await host
      .getByRole('button', { name: /copy invite link|copiar enlace de invitación/i })
      .click();
    const linkText = host.locator('.font-mono').first();
    await expect(linkText).toBeVisible({ timeout: 15_000 });
    const inviteUrl = (await linkText.textContent())?.trim() ?? '';
    const invitePath = new URL(inviteUrl).pathname;

    await guest.goto('/sign-up');
    await guest.getByLabel(/nombre visible|display name/i).fill('Guest');
    await guest.getByLabel(/correo|email/i).fill(guestEmail);
    await guest.getByLabel(/contraseña|password/i).fill('Password123!');
    await guest.getByRole('button', { name: /registrarse|sign up/i }).click();
    await guest.waitForURL(/\/onboarding|\/s\//, { timeout: 30_000 });
    await guest.goto(invitePath);
    await guest.waitForURL(new RegExp(`/s/${spaceId}`), { timeout: 30_000 });

    // Create an expense paid by host, split equally so a balance exists.
    await host.goto(`/s/${spaceId}/ledger`);
    await host.getByRole('button', { name: /añadir|add/i }).click();
    const composer = host.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.getByLabel(/importe|amount/i).fill('40,25');
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await host.getByRole('option').first().click();
    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });
    await expect(host.getByRole('button', { name: /40[,.]25/ }).first()).toBeVisible({
      timeout: 20_000,
    });

    await host.goto(`/s/${spaceId}/balances`);
    await expect(host.getByRole('main').getByTestId('balances-headline')).toBeVisible({
      timeout: 30_000,
    });
    await expect(host.getByTestId('simplified-transfer').first()).toBeVisible({ timeout: 20_000 });
    await host
      .getByTestId('simplified-transfer')
      .first()
      .getByRole('button', { name: /mark as paid|marcar como pagado/i })
      .click();
    await host.getByTestId('submit-settlement').click();
    await expect(host.getByTestId('settlement-row').first()).toBeVisible({ timeout: 20_000 });

    await guest.goto(`/s/${spaceId}/balances`);
    await expect(guest.getByTestId('settlement-pending')).toBeVisible({ timeout: 30_000 });
    await guest.getByTestId('confirm-settlement').click();
    await expect(guest.getByTestId('settlement-pending')).toHaveCount(0, { timeout: 30_000 });

    await expect(
      host
        .getByRole('main')
        .locator('[data-testid="settlement-row"][data-status="confirmed"]')
        .first(),
    ).toBeVisible({ timeout: 45_000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  // Keep a lightweight seeded smoke that Sam can open balances too.
  test('sam can open seeded balances', async ({ page }) => {
    test.setTimeout(90_000);
    const spaceId = await signInDemo(page, DEMO_SAM.email, DEMO_SAM.password);
    await page.goto(`/s/${spaceId}/balances`);
    await expect(page.getByRole('main').getByTestId('balances-headline')).toBeVisible({
      timeout: 30_000,
    });
  });
});

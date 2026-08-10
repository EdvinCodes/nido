import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.nido.local`;
}

test.describe('auth → onboarding → space', () => {
  test('signs up, completes onboarding, lands in space dashboard', async ({ page }) => {
    const email = uniqueEmail('owner');
    const password = 'Password123!';

    await page.goto('/sign-up');
    // Auth layout must expose a main landmark for axe.
    await expect(page.getByRole('main')).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByLabel(/nombre visible|display name/i).fill('Owner One');
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /registrarse|sign up/i }).click();

    await page.waitForURL(/\/onboarding/);
    await expectNoA11yViolations(page);

    await page.getByRole('button', { name: /solo/i }).first().click();
    await page.waitForURL(/step=2/);

    await page.getByLabel(/nombre del espacio|space name/i).fill('E2E Nest');
    await page.getByRole('button', { name: /continuar|continue/i }).click();
    await page.waitForURL(/step=3/);

    await page.getByRole('button', { name: /crear espacio|create space/i }).click();
    await page.waitForURL(/\/s\/[0-9a-f-]{36}/i);

    await expect(page.getByRole('heading', { name: /panel|dashboard/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /tu nido está listo|your nest is ready/i }),
    ).toBeVisible();
  });
});

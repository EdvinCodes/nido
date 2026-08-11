import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('offline capture', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let simulatedOffline = false;
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => !simulatedOffline,
      });
      window.__nidoSetOffline = (offline: boolean) => {
        simulatedOffline = offline;
        window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
      };
    });
  });

  test('queues an expense offline and syncs once on reconnect', async ({ page }) => {
    test.setTimeout(120_000);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page
      .getByRole('button', { name: /añadir|add/i })
      .first()
      .click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 10_000 });

    const cents = String(Math.floor(Math.random() * 90) + 10);
    const amount = `88,${cents}`;
    const amountRe = new RegExp(`88[,.]${cents}`);

    await composer.getByLabel(/importe|amount/i).fill(amount);
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await page.getByRole('option').first().click();

    await page.evaluate(() => {
      window.__nidoSetOffline(true);
    });

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    await expect(page.getByText(/saved offline|guardado sin conexión/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('pending-sync-banner')).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => {
      window.__nidoSetOffline(false);
    });

    await expect(page.getByTestId('pending-sync-banner')).toHaveCount(0, { timeout: 30_000 });

    await page.reload();
    await expect(page.getByRole('main')).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    await expect(
      page.getByRole('main').getByRole('button', { name: amountRe }).first(),
    ).toBeVisible({
      timeout: 30_000,
    });
  });
});

declare global {
  interface Window {
    __nidoSetOffline: (offline: boolean) => void;
  }
}

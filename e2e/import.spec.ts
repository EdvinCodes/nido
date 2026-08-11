import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('import', () => {
  // Shared demo space — avoid duplicate detection across runs and workers.
  test.describe.configure({ mode: 'serial' });

  test('imports a CSV through the wizard', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const token = `e2e${testInfo.parallelIndex}${Math.random().toString(36).slice(2, 8)}`;
    const cents = String(Math.floor(Math.random() * 90) + 10);
    const merchant = `E2E IMPORT ${token}`;
    const csv = `Fecha;Concepto;Importe\n15/08/2026;${merchant};-${cents},50\n`;

    const spaceId = await signInDemo(page);

    await page.goto(`/s/${spaceId}/import`);
    await expect(page.getByRole('heading', { name: /import|importar/i })).toBeVisible();

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'demo.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv),
      });

    await expect(
      page.getByRole('button', { name: /continue to preview|continuar a vista previa/i }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('button', { name: /continue to preview|continuar a vista previa/i })
      .click();

    await expect(page.getByText(token, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /commit import|confirmar import/i })).toBeEnabled(
      {
        timeout: 15_000,
      },
    );
    await page.getByRole('button', { name: /commit import|confirmar import/i }).click();

    await expect(
      page.getByRole('heading', { name: /import complete|importación completa/i }),
    ).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/s/${spaceId}/ledger`);
    await expect(
      page.getByRole('main').getByRole('button', { name: new RegExp(token, 'i') }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

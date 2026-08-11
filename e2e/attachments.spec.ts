import { expect, test } from '@playwright/test';
import path from 'node:path';
import { signInDemo } from './helpers/auth';

test.describe('attachments', () => {
  test.describe.configure({ mode: 'serial' });

  test('uploads a receipt and filters ledger by attachment', async ({ page }) => {
    test.setTimeout(120_000);
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 10_000 });

    const fixture = path.join(__dirname, 'fixtures', 'receipts', 'tiny-receipt.webp');
    await composer.locator('input[type=file]').setInputFiles(fixture);

    await expect(composer.getByTestId('attachment-picker')).toContainText(/KB/i, {
      timeout: 30_000,
    });

    await composer.getByLabel(/importe|amount/i).fill('12,34');
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await page.getByRole('option').first().click();
    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 20_000 });

    await page.getByTestId('filter-has-attachment').click();
    await expect(page.getByRole('button', { name: /12[,.]34/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

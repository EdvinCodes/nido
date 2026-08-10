import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('ledger', () => {
  test('creates a three-way expense, shows splits, deletes with undo', async ({ page }) => {
    test.setTimeout(120_000);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 10_000 });

    await composer.getByLabel(/importe|amount/i).fill('30,00');
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await page.getByRole('option').first().click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    await expect(page.getByText(/30,00|30\.00/)).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('button', { name: /30,00|30\.00/ })
      .first()
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Alex')).toBeVisible();
    await expect(detail.getByText('Sam')).toBeVisible();
    await expect(detail.getByText(/Invitado|Guest/i)).toBeVisible();

    await detail.getByRole('button', { name: /eliminar|delete/i }).click();
    await expect(page.getByRole('button', { name: /deshacer|undo/i })).toBeVisible();

    await page.getByRole('button', { name: /deshacer|undo/i }).click();
    await expect(page.getByText(/30,00|30\.00/)).toBeVisible({ timeout: 10_000 });
  });

  test('transfer is recorded in the ledger', async ({ page }) => {
    test.setTimeout(120_000);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('button', { name: /transferencia|transfer/i }).click();
    await composer.getByLabel(/importe|amount/i).fill('10,00');

    await composer.getByRole('combobox', { name: /desde|from/i }).click();
    await page.getByRole('option').first().click();
    await composer.getByRole('combobox', { name: /hacia|to/i }).click();
    await page.getByRole('option').nth(1).click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    await expect(page.getByText(/10,00|10\.00/)).toBeVisible({ timeout: 15_000 });
  });
});

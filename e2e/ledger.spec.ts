import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

/** Amounts unlikely to collide with seeded ledger rows. */
const EXPENSE_AMOUNT = '77,77';
const EXPENSE_AMOUNT_RE = /77,77|77\.77/;
const TRANSFER_AMOUNT = '66,66';
const TRANSFER_AMOUNT_RE = /66,66|66\.66/;

test.describe('ledger', () => {
  test('creates a three-way expense, shows splits, deletes with undo', async ({ page }) => {
    test.setTimeout(120_000);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 10_000 });

    await composer.getByLabel(/importe|amount/i).fill(EXPENSE_AMOUNT);
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await page.getByRole('option').first().click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    const expenseRow = page.getByRole('button', { name: EXPENSE_AMOUNT_RE }).first();
    await expect(expenseRow).toBeVisible({ timeout: 15_000 });

    await expenseRow.click();
    const detail = page.getByRole('dialog');
    // Names appear as payer and again in the split list — assert the split list.
    const splitList = detail.locator('ul');
    await expect(splitList.getByText('Alex', { exact: true })).toBeVisible();
    await expect(splitList.getByText('Sam', { exact: true })).toBeVisible();
    await expect(splitList.getByText(/Invitado|Guest/i)).toBeVisible();

    await detail.getByRole('button', { name: /eliminar|delete/i }).click();
    await expect(page.getByRole('button', { name: /deshacer|undo/i })).toBeVisible();

    await page.getByRole('button', { name: /deshacer|undo/i }).click();
    await expect(page.getByRole('button', { name: EXPENSE_AMOUNT_RE }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('transfer is recorded in the ledger', async ({ page }) => {
    test.setTimeout(120_000);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('button', { name: /transferencia|transfer/i }).click();
    await composer.getByLabel(/importe|amount/i).fill(TRANSFER_AMOUNT);

    await composer.getByRole('combobox', { name: /desde|from/i }).click();
    await page.getByRole('option').first().click();
    await composer.getByRole('combobox', { name: /hacia|to/i }).click();
    await page.getByRole('option').nth(1).click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: TRANSFER_AMOUNT_RE }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

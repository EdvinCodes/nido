import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

/** Unique amounts so parallel workers sharing the demo space do not collide. */
function uniqueAmount(prefix: number): { fill: string; re: RegExp } {
  const cents = String(Math.floor(Math.random() * 90) + 10);
  const major = `${prefix},${cents}`;
  return {
    fill: major,
    re: new RegExp(`${prefix}[,.]${cents}`),
  };
}

test.describe('ledger', () => {
  // Shared demo space — keep ledger mutations from racing across workers.
  test.describe.configure({ mode: 'serial' });

  test('creates a three-way expense, shows splits, deletes with undo', async ({ page }) => {
    test.setTimeout(120_000);
    const expense = uniqueAmount(77);

    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await expect(composer).toBeVisible({ timeout: 10_000 });

    await composer.getByLabel(/importe|amount/i).fill(expense.fill);
    await composer.getByRole('combobox', { name: /categoría|category/i }).click();
    await page.getByRole('option').first().click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    const expenseRow = page.getByRole('button', { name: expense.re }).first();
    await expect(expenseRow).toBeVisible({ timeout: 15_000 });

    await expenseRow.click();
    const detail = page.getByRole('dialog');
    // Names appear as payer and again in the split list — assert the split list.
    const splitList = detail.locator('ul');
    await expect(splitList.getByText('Alex', { exact: true })).toBeVisible();
    await expect(splitList.getByText('Sam', { exact: true })).toBeVisible();
    await expect(splitList.getByText(/Invitado|Guest/i)).toBeVisible();

    await detail.getByRole('button', { name: /eliminar|delete/i }).click();
    const undo = page.getByRole('button', { name: /deshacer|undo/i });
    await expect(undo).toBeVisible({ timeout: 15_000 });

    await undo.click();
    await expect(page.getByRole('button', { name: expense.re }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('transfer is recorded in the ledger', async ({ page }) => {
    const transfer = uniqueAmount(66);
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/ledger`);
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: /añadir|add/i }).click();
    const composer = page.getByRole('dialog');
    await composer.getByRole('button', { name: /transferencia|transfer/i }).click();
    await composer.getByLabel(/importe|amount/i).fill(transfer.fill);

    await composer.getByRole('combobox', { name: /desde|from/i }).click();
    await page.getByRole('option').first().click();
    await composer.getByRole('combobox', { name: /hacia|to/i }).click();
    await page.getByRole('option').nth(1).click();

    await composer.getByRole('button', { name: /guardar|save/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: transfer.re }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

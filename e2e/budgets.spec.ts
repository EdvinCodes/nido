import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';
import { expectNoA11yViolations } from './helpers/a11y';

test.describe('budgets', () => {
  test('lists seeded budgets and opens detail', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/budgets`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /presupuestos|budgets/i }),
    ).toBeVisible();
    await expect(page.getByText(/compra semanal|salir a comer/i).first()).toBeVisible();

    await page
      .getByRole('link', { name: /salir a comer/i })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/s/${spaceId}/budgets/[0-9a-f-]{36}$`), {
      timeout: 15_000,
    });
    await expect(
      page.getByRole('main').getByRole('heading', { name: /salir a comer/i }),
    ).toBeVisible();
  });

  test('has no serious axe violations on budgets', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/budgets`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /presupuestos|budgets/i }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

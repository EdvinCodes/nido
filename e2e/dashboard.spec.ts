import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';
import { expectNoA11yViolations } from './helpers/a11y';

test.describe('dashboard', () => {
  test('renders summary cards and deep-links into the ledger', async ({ page }) => {
    const spaceId = await signInDemo(page);

    await page.goto(`/s/${spaceId}?period=last_3_months`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /panel|dashboard/i }),
    ).toBeVisible();
    await expect(page.getByText(/ingresos|income/i).first()).toBeVisible();
    await expect(page.getByText(/gastos|expenses/i).first()).toBeVisible();

    await page
      .getByRole('link', { name: /gastos|expenses/i })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/s/${spaceId}/ledger`));
    await expect(page).toHaveURL(/kind=expense/);
  });

  test('has no serious axe violations on the seeded dashboard', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}?period=last_3_months`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /panel|dashboard/i }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

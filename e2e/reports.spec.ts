import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('reports', () => {
  test('lists reports page and compare link', async ({ page }) => {
    const spaceId = await signInDemo(page);

    await page.goto(`/s/${spaceId}/reports`);
    await expect(page.getByRole('heading', { name: /informes|reports/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /comparar|compare/i })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';

test.describe('landing smoke', () => {
  test('renders the marketing placeholder at /', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /GitHub|github/i })).toBeVisible();

    await expectNoA11yViolations(page);
  });
});

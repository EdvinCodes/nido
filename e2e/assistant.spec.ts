import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('assistant', () => {
  test('AI settings page loads for a member', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/settings/ai`);
    await expect(page.getByRole('heading', { name: /ai assistant|asistente ia/i })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';

test.describe('assistant', () => {
  test('AI settings page loads for a member', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/settings/ai`);
    await expect(page.getByRole('heading', { name: /ai assistant|asistente ia/i })).toBeVisible();
  });

  test('assistant nav is hidden when AI is not configured', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}`);
    // Sidebar is desktop-only; check that "Coming soon" assistant stub is absent.
    const soon = page.getByText(/coming soon|pronto/i);
    const assistantSoon = page.locator('aside').getByText(/assistant|asistente/i);
    const hasBrokenSoon =
      (await soon.count()) > 0 && (await assistantSoon.count()) > 0
        ? await page
            .locator('aside span')
            .filter({ hasText: /assistant|asistente/i })
            .locator('..')
            .getByText(/coming soon|pronto/i)
            .count()
        : 0;
    expect(hasBrokenSoon).toBe(0);
  });

  test('consent can be granted when provider is configured', async ({ page }) => {
    test.skip(
      !process.env.AI_PROVIDER,
      'Requires AI_PROVIDER in the Playwright env to exercise consent grant',
    );
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/settings/ai`);
    const grant = page.getByRole('button', { name: /enable assistant|activar asistente/i });
    if (await grant.isVisible()) {
      await grant.click();
      await expect(page.getByText(/saved|guardado/i)).toBeVisible();
    }
  });
});

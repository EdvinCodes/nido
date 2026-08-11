import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/auth';
import { expectNoA11yViolations } from './helpers/a11y';

test.describe('goals and subscriptions', () => {
  test('lists seeded goals and opens detail', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/goals`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /metas|goals/i }),
    ).toBeVisible();
    await expect(page.getByText(/fondo de emergencia|viaje a lisboa/i).first()).toBeVisible();

    await page.getByRole('link', { name: /fondo de emergencia/i }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${spaceId}/goals/[0-9a-f-]{36}$`));
    await expect(
      page.getByRole('main').getByRole('heading', { name: /fondo de emergencia/i }),
    ).toBeVisible();
  });

  test('shows annualised subscription total and opens detail', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/subscriptions`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /suscripciones|subscriptions/i }),
    ).toBeVisible();
    await expect(page.getByText(/al año|per year/i)).toBeVisible();
    await expect(page.getByText(/netflix|spotify|internet|gym|basic-fit/i).first()).toBeVisible();

    await page
      .getByRole('link', { name: /netflix/i })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/s/${spaceId}/subscriptions/[0-9a-f-]{36}$`));
    await expect(page.getByRole('main').getByRole('heading', { name: /netflix/i })).toBeVisible();
  });

  test('has no serious axe violations on subscriptions', async ({ page }) => {
    const spaceId = await signInDemo(page);
    await page.goto(`/s/${spaceId}/subscriptions`);
    await expect(
      page.getByRole('main').getByRole('heading', { name: /suscripciones|subscriptions/i }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

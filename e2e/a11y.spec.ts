import { test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { signInDemo } from './helpers/auth';

const PUBLIC_ROUTES = ['/', '/privacy', '/changelog', '/brand', '/docs', '/sign-in', '/sign-up'];

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((value) => {
    document.documentElement.classList.toggle('dark', value === 'dark');
    document.documentElement.style.colorScheme = value;
  }, theme);
}

test.describe('accessibility matrix', () => {
  for (const route of PUBLIC_ROUTES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${route} · ${theme}`, async ({ page }) => {
        await page.goto(route);
        await setTheme(page, theme);
        await expectNoA11yViolations(page);
      });
    }
  }

  test.describe('authenticated routes', () => {
    test.beforeEach(async ({ page }) => {
      await signInDemo(page);
    });

    const appRoutes = (spaceId: string) => [
      `/s/${spaceId}`,
      `/s/${spaceId}/ledger`,
      `/s/${spaceId}/budgets`,
      `/s/${spaceId}/goals`,
      `/s/${spaceId}/balances`,
      `/s/${spaceId}/reports`,
    ];

    for (const theme of ['light', 'dark'] as const) {
      test(`app routes · ${theme}`, async ({ page }) => {
        const spaceId = page.url().match(/\/s\/([0-9a-f-]{36})/i)?.[1];
        if (!spaceId) throw new Error('Missing space id after sign-in');

        for (const path of appRoutes(spaceId)) {
          await page.goto(path, { waitUntil: 'commit' });
          await page.locator('main').first().waitFor({ state: 'visible', timeout: 30_000 });
          await setTheme(page, theme);
          await expectNoA11yViolations(page);
        }
      });
    }
  });
});

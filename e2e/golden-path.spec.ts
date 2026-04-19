/**
 * FM Beta Golden-Path E2E
 *
 * One spec exercising the core flow a beta user will take:
 *   1. Sign up (with invite code if gate is on)
 *   2. Land on the post-signup page
 *   3. Open the existing seeded modeling project (Surfside 3 Marina)
 *   4. Visit pro-forma, DCF, exit-strategy, LP reporting, returns tabs
 *   5. Confirm each tab renders without white-screening or 500s
 *
 * This is the pre-invite safety gate. Run manually before each beta batch.
 *
 * Setup:
 *   - `npm run dev` in another shell
 *   - `node scripts/seed-beta-demo.mjs` (so LP reporting has data)
 *   - Optional: set REQUIRE_BETA_INVITE=true + issue an invite code
 *
 * Run:
 *   npm run test:e2e
 *   E2E_INVITE_CODE=FMBETA-ABC123 npm run test:e2e  # if gate is on
 */

import { test, expect } from '@playwright/test';

const TIMESTAMP = Date.now();
const TEST_EMAIL = `beta-e2e+${TIMESTAMP}@marinalytics.dev`;
const TEST_PASSWORD = 'TestPassword1234';
const TEST_ORG = `Beta E2E ${TIMESTAMP}`;
const INVITE_CODE = process.env.E2E_INVITE_CODE || '';

test.describe('FM Beta Golden Path', () => {
  test('signup → project workspace → pro-forma → DCF → exit → LP → returns', async ({ page }) => {
    // 1. Sign up
    await page.goto('/signup');
    await page.getByTestId('input-email').fill(TEST_EMAIL);
    await page.getByTestId('input-org-name').fill(TEST_ORG);
    if (INVITE_CODE) {
      await page.getByTestId('input-invite-code').fill(INVITE_CODE);
    }
    await page.getByTestId('input-password').fill(TEST_PASSWORD);

    // Confirm password + any downstream steps — try/catch each since the
    // wizard layout evolves. We only fail if the final "create account" step
    // never resolves.
    const confirmField = page.locator('[data-testid="input-confirm-password"]');
    if (await confirmField.count()) await confirmField.fill(TEST_PASSWORD);

    // The signup flow is multi-step; click through any Continue / Next buttons
    // until we land somewhere authenticated.
    for (let step = 0; step < 6; step++) {
      const cta = page.getByRole('button', { name: /continue|next|create account|get started|finish/i }).first();
      if (await cta.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cta.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    // 2. Confirm landed on an authenticated page (any non-/signup URL is fine)
    await expect(page).not.toHaveURL(/\/signup/, { timeout: 15_000 });
    console.log(`  After signup: ${page.url()}`);

    // 3. Open the test project via direct URL. We use the known test project
    // ID rather than relying on the dashboard UI.
    const TEST_PROJECT_ID = '0d079513-69cd-4114-9f6c-566ffc38803d'; // Surfside 3 Marina
    await page.goto(`/modeling/projects/${TEST_PROJECT_ID}/workspace/pro-forma`);
    // Give the route handlers time to resolve.
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // 4. Verify no generic error surfaces.
    const hardError = page.locator('text=/Something went wrong|Unexpected error|500|Internal Server Error/i').first();
    expect(await hardError.isVisible().catch(() => false)).toBe(false);

    // 5. Walk the tabs. The workspace layout uses a tab strip; we navigate by
    //    URL to avoid coupling to tab-click UI internals.
    const tabs = [
      { name: 'pro-forma',      url: `/modeling/projects/${TEST_PROJECT_ID}/workspace/pro-forma` },
      { name: 'dcf',            url: `/modeling/projects/${TEST_PROJECT_ID}/workspace/dcf-calculator` },
      { name: 'exit-strategy',  url: `/modeling/projects/${TEST_PROJECT_ID}/workspace/exit-strategy` },
      { name: 'lp-reporting',   url: `/modeling/projects/${TEST_PROJECT_ID}/workspace/lp-reporting` },
    ];

    for (const tab of tabs) {
      await page.goto(tab.url);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      const visibleError = page.locator('text=/Something went wrong|Unexpected error|Internal Server Error/i').first();
      const hasError = await visibleError.isVisible().catch(() => false);
      expect(hasError, `Error surface visible on ${tab.name}`).toBe(false);
      console.log(`  OK  ${tab.name} loaded without error`);
    }

    // 6. Pipeline returns dashboard
    await page.goto('/modeling/returns-valuation');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    const returnsError = page.locator('text=/Something went wrong|Unexpected error|Internal Server Error/i').first();
    expect(await returnsError.isVisible().catch(() => false)).toBe(false);
    console.log(`  OK  pipeline returns loaded`);
  });
});

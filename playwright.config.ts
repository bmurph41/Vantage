import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the FM beta golden-path E2E.
 *
 * One spec, run against the local dev server. Not part of CI — this is the
 * manual gate that runs before each invite batch so Brett can confirm the
 * happy-path user flow still works. Add to CI later.
 *
 * Prereq: `npm run dev` in another shell, OR set the webServer block to
 * auto-start (commented below — slow startup makes on-demand preferable).
 */

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5000/health',
  //   reuseExistingServer: true,
  //   timeout: 180_000,
  // },
});

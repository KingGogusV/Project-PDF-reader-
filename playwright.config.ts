import { defineConfig } from '@playwright/test';

const channel = process.env.E2E_BROWSER_CHANNEL || 'msedge';
const browserName = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName,
    channel: browserName === 'webkit' || channel === 'chromium' ? undefined : channel,
    baseURL,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    acceptDownloads: true,
    // Production offline behavior has its own verification. Do not reuse stale shell caches.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.CI || process.env.E2E_START_SERVER === '1' ? {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  } : undefined,
});

import { defineConfig } from '@playwright/test';

const channel = process.env.E2E_BROWSER_CHANNEL || 'msedge';
export default defineConfig({
  testDir: '.',
  testMatch: 'checkpoints.spec.ts',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  outputDir: '../../test-results/core',
  use: {
    browserName: 'chromium',
    channel: channel === 'chromium' ? undefined : channel,
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1100, height: 850 },
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175/tests/core/fixture.html',
    cwd: '../..',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

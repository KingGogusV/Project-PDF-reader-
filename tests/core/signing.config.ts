import { defineConfig } from '@playwright/test';
const channel = process.env.E2E_BROWSER_CHANNEL || 'msedge';
export default defineConfig({
  testDir: '.', testMatch: 'signing.spec.ts', workers: 1, timeout: 60_000,
  reporter: 'list', outputDir: '../../test-results/signing',
  use: { browserName: 'chromium', channel: channel === 'chromium' ? undefined : channel,
    baseURL: 'http://127.0.0.1:5176', headless: true, serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --config tests/core/signing.vite.config.ts --host 127.0.0.1 --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176/tests/core/signing.html', cwd: '../..', reuseExistingServer: false, timeout: 30_000 },
});

import { test, expect } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'generated');

test.use({ serviceWorkers: 'allow' });

test('installed application reloads and reads local PDFs offline without caching document bytes', async ({ page, context, baseURL }, testInfo) => {
  const externalRequests: string[] = [];
  const errors: string[] = [];
  const origin = new URL(baseURL!).origin;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) externalRequests.push(url.href);
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#choose')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Regression: module and style requests may carry Origin while precaching does not.
  // Their server Vary: Origin header must not make the static allowlist miss offline.
  await expect(page.locator('#choose')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#choose').click();
  await (await chooser).setFiles(join(fixtures, 'text-outline.pdf'));
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  const document = page.locator('.document-host:not([hidden])');
  await expect(document.locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true');
  await expect(document.locator('.textLayer').first()).toContainText('Chapter 1');
  await page.locator('#page-next').click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(document.locator('.page[data-page-number="2"]')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#toggle-search').click();
  await page.getByRole('searchbox', { name: 'Search document' }).fill('amber heron');
  await expect(page.locator('#search-status')).toHaveText(/of 3$/);

  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith('folio-app-')) continue;
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.filter(url => /\.pdf(?:$|[?#])/i.test(url))).toEqual([]);
  expect(cachedUrls.filter(url => url.startsWith('blob:'))).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
  await testInfo.attach('offline-cache-urls', { body: JSON.stringify(cachedUrls, null, 2), contentType: 'application/json' });
});

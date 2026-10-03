import { expect, type Page, type Route } from '@playwright/test';
import { test } from './support/offline-fixture';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'generated');

async function openOcr(page: Page, name = 'scanned.pdf', destination = '/') {
  await page.goto(destination);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await chooser).setFiles(join(fixtures, name));
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('.document-host:not([hidden]) .page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#document-tools').click();
  await page.getByRole('button', { name: 'Recognize text', exact: true }).click();
  await expect(page.locator('#ocr-pages')).toBeVisible();
}

test('OCR recognizes an image-only page locally and downloads editable text', async ({ page, context, baseURL }, testInfo) => {
  const external: string[] = [];
  const exceptions: string[] = [];
  const assets: string[] = [];
  const origin = new URL(baseURL!).origin;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) external.push(request.url());
    if (url.pathname.includes('/vendor/ocr/')) assets.push(url.pathname);
  });
  page.on('pageerror', error => exceptions.push(error.message));
  await openOcr(page);
  await expect(page.locator('.document-host:not([hidden]) .textLayer span')).toHaveCount(0);
  const started = Date.now();
  await page.locator('#ocr-start').click();
  await expect(page.locator('#ocr-output')).toHaveValue(/A SYNTHETIC SCANNED PAGE/, { timeout: 30_000 });
  await expect(page.locator('#ocr-output')).toHaveValue(/There is no PDF text layer/);
  await expect(page.locator('#ocr-progress')).toHaveAttribute('value', '1');
  await expect(page.locator('#ocr-download')).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await page.locator('#ocr-download').click();
  const download = await downloaded;
  const path = testInfo.outputPath('recognized-text.txt');
  await download.saveAs(path);
  const text = await readFile(path, 'utf8');
  expect(text).toContain('A SYNTHETIC SCANNED PAGE');
  expect(text).toContain('No photographed or personal content is used.');
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  await testInfo.attach('ocr-runtime', {
    body: JSON.stringify({ elapsedMs: Date.now() - started, assets, external, exceptions }, null, 2),
    contentType: 'application/json',
  });
  expect(assets.some(path => path.endsWith('/eng.traineddata.gz'))).toBeTruthy();
  expect(assets.some(path => path.endsWith('.wasm.js'))).toBeTruthy();
  expect(external).toEqual([]);
  expect(exceptions).toEqual([]);
});

test('OCR cancellation terminates a worker still loading its model and permits retry', async ({ page }) => {
  const held: Route[] = [];
  let workersCreated = 0;
  let workersClosed = 0;
  page.on('worker', worker => {
    if (!worker.url().includes('/vendor/ocr/')) return;
    workersCreated++;
    worker.on('close', () => workersClosed++);
  });
  await page.route('**/vendor/ocr/lang/eng.traineddata.gz', route => { held.push(route); });
  await openOcr(page);
  await page.locator('#ocr-start').click();
  await expect.poll(() => held.length, { timeout: 15_000 }).toBe(1);
  await page.locator('#ocr-cancel').click();
  await expect(page.locator('#ocr-start')).toBeEnabled();
  await expect(page.locator('#ocr-output')).toHaveValue('');
  await expect.poll(() => workersClosed).toBe(workersCreated);
  expect(workersCreated).toBe(1);
  for (const route of held) await route.abort().catch(() => undefined);
  await page.unroute('**/vendor/ocr/lang/eng.traineddata.gz');
  await page.locator('#ocr-start').click();
  await expect(page.locator('#ocr-output')).toHaveValue(/A SYNTHETIC SCANNED PAGE/, { timeout: 30_000 });
});

test('OCR cannot bypass a document copy restriction', async ({ page }) => {
  const ocrRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/vendor/ocr/')) ocrRequests.push(request.url());
  });
  await openOcr(page, 'restricted.pdf');
  await expect(page.locator('#ocr-start')).toBeDisabled();
  await expect(page.locator('#ocr-status')).toContainText(/copy|permission|restrict/i);
  expect(ocrRequests).toEqual([]);
});

test.describe('optional offline OCR assets', () => {
  test.use({ serviceWorkers: 'allow' });

  test('OCR runs after reload during network or origin loss once its assets were used online', async ({ page, networkOutage }, testInfo) => {
    test.setTimeout(60_000);
    const exceptions: string[] = [];
    const offlineAssetResponses: string[] = [];
    let offline = false;
    page.on('pageerror', error => exceptions.push(error.message));
    page.on('response', response => {
      if (offline && response.url().includes('/vendor/ocr/') && response.fromServiceWorker()) offlineAssetResponses.push(response.url());
    });
    const cacheUrls = () => page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith('folio-app-')) continue;
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      }
      return urls;
    });

    await page.goto(networkOutage.baseURL);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect((await cacheUrls()).filter(url => url.includes('/vendor/ocr/'))).toEqual([]);

    await openOcr(page, 'scanned.pdf', networkOutage.baseURL);
    await page.locator('#ocr-start').click();
    await expect(page.locator('#ocr-output')).toHaveValue(/A SYNTHETIC SCANNED PAGE/, { timeout: 30_000 });
    const firstText = await page.locator('#ocr-output').inputValue();
    const prepared = await cacheUrls();
    expect(prepared.some(url => url.endsWith('/vendor/ocr/worker.min.js'))).toBeTruthy();
    expect(prepared.filter(url => /\/vendor\/ocr\/core\/.*\.wasm\.js$/.test(url))).toHaveLength(1);
    expect(prepared.some(url => url.endsWith('/vendor/ocr/lang/eng.traineddata.gz'))).toBeTruthy();
    expect(prepared.filter(url => /\.pdf(?:$|[?#])/i.test(url) || url.startsWith('blob:'))).toEqual([]);

    await networkOutage.begin(page);
    offline = true;
    // A fresh navigation discards the old document, OCR worker, and result memory.
    // Re-select the local PDF; it is deliberately absent from the service-worker cache.
    await openOcr(page, 'scanned.pdf', networkOutage.baseURL);
    await page.locator('#ocr-start').click();
    await expect(page.locator('#ocr-output')).toHaveValue(firstText, { timeout: 30_000 });
    expect(offlineAssetResponses.some(url => url.endsWith('/worker.min.js'))).toBeTruthy();
    expect(exceptions).toEqual([]);
    await testInfo.attach('offline-ocr-evidence', {
      body: JSON.stringify({ prepared, offlineAssetResponses, exceptions }, null, 2), contentType: 'application/json',
    });
  });
});

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('../fixtures/generated/', import.meta.url));
const evidence = new WeakMap<Page, { requests: string[]; exceptions: string[] }>();

async function simplePdf(name = 'organizer-source.pdf', count = 3) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < count; index++) {
    const page = pdf.addPage([400 + 10 * index, 500 + 20 * index]);
    page.drawText(`${name} PageToken${index + 1}`, { x: 30, y: 300, size: 16, font });
    page.setRotation(degrees(index * 90));
  }
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) };
}

async function open(page: Page, source: Awaited<ReturnType<typeof simplePdf>> | string) {
  const selecting = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await selecting).setFiles(source);
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('.document-host:not([hidden]) .page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true');
}

async function organizer(page: Page) {
  await page.locator('#document-tools').click();
  await page.getByRole('button', { name: 'Organize pages', exact: true }).click();
  await expect(page.locator('#organize-operation')).toBeVisible();
}

async function output(page: Page, testInfo: TestInfo) {
  await page.locator('#organize-start').click();
  await expect(page.locator('#organize-status')).toContainText('Verified copy ready', { timeout: 30_000 });
  await expect(page.locator('#organize-download')).toBeEnabled();
  const pending = page.waitForEvent('download');
  await page.locator('#organize-download').click();
  const download = await pending;
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  return { document: await PDFDocument.load(await readFile(path)), path, name: download.suggestedFilename() };
}

test.beforeEach(async ({ page, context, baseURL }) => {
  const record = { requests: [] as string[], exceptions: [] as string[] }; evidence.set(page, record);
  const origin = new URL(baseURL!).origin;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) record.requests.push(request.url());
  });
  page.on('pageerror', error => record.exceptions.push(error.message));
  await page.goto('/');
  await expect(page.locator('#open')).toBeVisible();
});
test.afterEach(async ({ page }, testInfo) => {
  const record = evidence.get(page)!;
  await testInfo.attach('organization-runtime', { body: JSON.stringify(record), contentType: 'application/json' });
  expect(record.requests, 'organization must remain local').toEqual([]);
  expect(record.exceptions, 'no uncaught page errors').toEqual([]);
});

test('organization extracts ordered pages, downloads a valid copy, and opens it without replacing the original', async ({ page }, testInfo) => {
  const source = await simplePdf(); await open(page, source); await organizer(page);
  await page.locator('#organize-pages').fill('3,1');
  const result = await output(page, testInfo);
  expect(result.name).toBe('organizer-source-extract-folio.pdf');
  expect(result.document.getPageCount()).toBe(2);
  expect(result.document.getPages().map(item => item.getRotation().angle)).toEqual([180, 0]);
  expect(result.document.getPages().map(item => item.getWidth())).toEqual([420, 400]);
  await expect(page.locator('#organize-notes')).toContainText('metadata are not copied');
  await page.locator('#organize-open').click();
  await expect(page.locator('#page-total')).toHaveText('of 2');
  await expect(page.locator('.document-host:not([hidden]) .textLayer').first()).toContainText('PageToken3');
  await expect(page.getByRole('tab', { name: source.name, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: source.name, exact: true }).click();
  await expect(page.locator('#page-total')).toHaveText('of 3');
});

test('organization reorders every page through the actual dialog and export', async ({ page }, testInfo) => {
  await open(page, await simplePdf()); await organizer(page);
  await page.locator('#organize-operation').selectOption('reorder');
  await page.locator('#organize-pages').fill('2,3,1');
  const result = await output(page, testInfo);
  expect(result.document.getPages().map(item => item.getWidth())).toEqual([410, 420, 400]);
  expect(result.document.getPageCount()).toBe(3);
});

test('organization deletes selected pages and permanently rotates selected retained pages', async ({ page }, testInfo) => {
  await open(page, await simplePdf()); await organizer(page);
  await page.locator('#organize-operation').selectOption('delete'); await page.locator('#organize-pages').fill('2');
  const deleted = await output(page, testInfo);
  expect(deleted.document.getPages().map(item => item.getWidth())).toEqual([400, 420]);
  await page.locator('#organize-operation').selectOption('rotate');
  await page.locator('#organize-pages').fill('1,3'); await page.locator('#organize-rotation').selectOption('270');
  const rotated = await output(page, testInfo);
  expect(rotated.document.getPages().map(item => item.getRotation().angle)).toEqual([270, 90, 90]);
  expect(rotated.document.getPages().map(item => item.getWidth())).toEqual([400, 410, 420]);
});

test('organization merges local files selected directly into the file input', async ({ page }, testInfo) => {
  await open(page, await simplePdf()); await organizer(page);
  await page.locator('#organize-operation').selectOption('merge');
  await expect(page.locator('#organize-files')).toBeVisible();
  await page.locator('#organize-files').setInputFiles(await simplePdf('second.pdf', 1));
  const merged = await output(page, testInfo);
  expect(merged.document.getPageCount()).toBe(4);
  expect(merged.document.getPages().map(item => item.getWidth())).toEqual([400, 410, 420, 400]);
});

test('organization rejects duplicate page ranges and deleting every page without creating output', async ({ page }) => {
  await open(page, await simplePdf()); await organizer(page);
  await page.locator('#organize-pages').fill('1-3,2'); await page.locator('#organize-start').click();
  await expect(page.locator('#organize-status')).toContainText('each page only once');
  await expect(page.locator('#organize-download')).toBeDisabled();
  await page.locator('#organize-operation').selectOption('delete'); await page.locator('#organize-pages').fill('1-3');
  await page.locator('#organize-start').click();
  await expect(page.locator('#organize-status')).toContainText('Keep at least one page');
  await expect(page.locator('#organize-download')).toBeDisabled();
});

test('organization safely refuses form input and leaves unsaved values available', async ({ page }) => {
  await open(page, `${fixtures}form.pdf`);
  const field = page.locator('.document-host:not([hidden]) input[name="reader_name"]');
  await field.fill('Preserve this unsaved form');
  await organizer(page); await page.locator('#organize-start').click();
  await expect(page.locator('#organize-status')).toContainText(/Forms|forms|annotations/);
  await expect(page.locator('#organize-download')).toBeDisabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(field).toHaveValue('Preserve this unsaved form');
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
});

test('organization cancellation during preparation produces no download and permits retry', async ({ page }) => {
  await open(page, await simplePdf('cancel.pdf', 30)); await organizer(page);
  await page.locator('#organize-operation').selectOption('reorder');
  await page.locator('#organize-start').click(); await page.locator('#organize-cancel').click();
  await expect(page.locator('#organize-status')).toContainText('cancelled');
  await expect(page.locator('#organize-download')).toBeDisabled();
  await expect(page.locator('#organize-start')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#document-tools')).toBeFocused();
});

test.describe('phone document tools', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('organization remains reachable on touch and fits the phone dialog', async ({ page }, testInfo) => {
    await open(page, await simplePdf());
    await page.locator('#document-tools').tap();
    await page.getByRole('button', { name: 'Organize pages', exact: true }).tap();
    await page.locator('#organize-pages').fill('1');
    await page.locator('#organize-start').tap();
    await expect(page.locator('#organize-status')).toContainText('Verified copy ready');
    await expect(page.locator('#organize-download')).toBeEnabled();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const screenshot = testInfo.outputPath('phone-organization.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('phone-organization', { path: screenshot, contentType: 'image/png' });
  });
});

import { test, expect, type Page, type TestInfo, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'generated');
const fixture = (name: string) => join(fixtures, name);
const visibleDocument = (page: Page) => page.locator('.document-host:not([hidden])');
const runtimeEvidence = new WeakMap<Page, { external: string[]; exceptions: string[] }>();

test.beforeEach(async ({ page, context, baseURL }) => {
  const evidence = { external: [] as string[], exceptions: [] as string[] };
  runtimeEvidence.set(page, evidence);
  const origin = new URL(baseURL!).origin;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) evidence.external.push(request.url());
  });
  page.on('pageerror', error => evidence.exceptions.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A clear space/ })).toBeVisible();
});

test.afterEach(async ({ page }, testInfo) => {
  const evidence = runtimeEvidence.get(page)!;
  await testInfo.attach('runtime-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.external, 'PDF workflows must not send any external requests').toEqual([]);
  expect(evidence.exceptions, 'No uncaught browser exceptions').toEqual([]);
});

async function chooseFile(page: Page, path: string, touch = false) {
  const chooser = page.waitForEvent('filechooser');
  if (touch) await page.locator('#open').tap();
  else await page.locator('#open').click();
  await (await chooser).setFiles(path);
}

async function ready(page: Page, pageNumber = 1) {
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  const sheet = visibleDocument(page).locator(`.page[data-page-number="${pageNumber}"]`);
  await expect(sheet).toHaveAttribute('data-loaded', 'true');
  await expect(sheet.locator('canvas').first()).toBeVisible();
  return sheet;
}

async function openFile(page: Page, name: string, touch = false) {
  await chooseFile(page, fixture(name), touch);
  return await ready(page);
}

async function exportCopy(page: Page, testInfo: TestInfo, originalName: string, prefix = '') {
  const downloadEvent = page.waitForEvent('download').catch(() => null);
  await page.locator('#export').click();
  let exportError = '';
  await expect.poll(async () => {
    const error = page.locator('#toast.error:not([hidden])');
    if (await error.count()) exportError = (await error.textContent()) || 'Export failed';
    if (exportError) return exportError;
    if (!(await page.locator('#dialog').isVisible())) return 'Waiting for export confirmation';
    return await page.locator('#dialog-title').textContent();
  }, { message: 'Export must reach its confirmation dialog without a save error' }).toBe('Your PDF copy is ready');
  const download = await downloadEvent;
  expect(download).not.toBeNull();
  if (!download) throw new Error('The browser did not emit a PDF download.');
  expect(download.suggestedFilename()).toBe(originalName.replace(/\.pdf$/i, '') + '-folio.pdf');
  const path = testInfo.outputPath(prefix + download.suggestedFilename());
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  await expect(page.getByRole('dialog')).toContainText('Your PDF copy is ready');
  const original = await readFile(fixture(originalName));
  const bytes = await readFile(path);
  // Incremental output must contain the exact original bytes; source files never change.
  expect(bytes.subarray(0, original.length).equals(original)).toBe(true);
  await page.getByRole('button', { name: 'I saved the copy', exact: true }).click();
  return { path, bytes, original };
}

async function annotations(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().flatMap(page => (page.node.Annots()?.asArray() || []).map(reference => {
    const dictionary = pdf.context.lookup(reference, PDFDict);
    const contents = dictionary.get(PDFName.of('Contents'));
    return {
      subtype: dictionary.get(PDFName.of('Subtype'))?.toString(),
      contents: contents instanceof PDFString || contents instanceof PDFHexString ? contents.decodeText() : '',
    };
  }));
}

test('opens a real local PDF, renders selectable text, navigates pages and outline, and closes', async ({ page }) => {
  await openFile(page, 'text-outline.pdf');
  await expect(page.locator('#page-total')).toHaveText('of 3');
  await expect(visibleDocument(page).locator('.textLayer').first()).toContainText('Chapter 1');
  await page.locator('#page-next').click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await ready(page, 2);
  await page.locator('#page-number').fill('3');
  await page.locator('#page-number').press('Enter');
  await expect(page.locator('#page-number')).toHaveValue('3');
  await ready(page, 3);
  await page.locator('#nav-outline').click();
  await page.getByRole('button', { name: 'Chapter 1', exact: true }).click();
  await expect(page.locator('#page-number')).toHaveValue('1');
  await page.getByRole('button', { name: 'Close text-outline.pdf', exact: true }).click();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#recents')).toContainText('text-outline.pdf');
});

test('searches all pages, moves between results, and clears search highlights', async ({ page }) => {
  await openFile(page, 'text-outline.pdf');
  await page.keyboard.press('Control+f');
  await page.getByRole('searchbox', { name: 'Search document' }).fill('amber heron');
  await expect(page.locator('#search-status')).toHaveText('1 of 3');
  await page.locator('#search-next').click();
  await expect(page.locator('#search-status')).toHaveText('2 of 3');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#search-prev').click();
  await expect(page.locator('#search-status')).toHaveText('1 of 3');
  await page.locator('#search-close').click();
  await expect(page.locator('#searchbar')).toBeHidden();
  await expect(visibleDocument(page).locator('.textLayer .highlight')).toHaveCount(0);
});

test('form values export, reopen visibly, and preserve exact original document bytes', async ({ page }, testInfo) => {
  const originalHash = createHash('sha256').update(await readFile(fixture('form.pdf'))).digest('hex');
  await openFile(page, 'form.pdf');
  const doc = visibleDocument(page);
  await doc.locator('input[name="reader_name"]').fill('Folio test reader');
  await doc.locator('select[name="review_status"]').selectOption({ label: 'Ready to share' });
  await doc.locator('input[name="approved"]').check();
  await doc.locator('textarea[name="notes"]').fill('Verified locally. No document upload.');
  await page.locator('#page-total').click();
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  const output = await exportCopy(page, testInfo, 'form.pdf');
  const reopened = await PDFDocument.load(output.bytes);
  expect(reopened.getPageCount()).toBe(1);
  expect(reopened.getForm().getTextField('reader_name').getText()).toBe('Folio test reader');
  expect(reopened.getForm().getDropdown('review_status').getSelected()).toEqual(['Ready to share']);
  expect(reopened.getForm().getCheckBox('approved').isChecked()).toBe(true);
  expect(reopened.getForm().getTextField('notes').getText()).toBe('Verified locally. No document upload.');
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  await chooseFile(page, output.path);
  await ready(page);
  const copy = visibleDocument(page);
  await expect(copy.locator('input[name="reader_name"]')).toHaveValue('Folio test reader');
  await expect(copy.locator('input[name="approved"]')).toBeChecked();
  await expect(copy.locator('select[name="review_status"]')).toHaveValue('Ready to share');
  await expect(copy.locator('textarea[name="notes"]')).toHaveValue('Verified locally. No document upload.');
  await expect(copy.locator('.textLayer')).toContainText('FormBaselineToken');
  expect(createHash('sha256').update(await readFile(fixture('form.pdf'))).digest('hex')).toBe(originalHash);
});

test('free text is saved as a real PDF annotation and the exported copy reopens', async ({ page }, testInfo) => {
  await openFile(page, 'text-outline.pdf');
  await page.locator('#scale').selectOption('page-fit');
  await page.locator('#tool-text').click();
  const layer = visibleDocument(page).locator('.page[data-page-number="1"] .annotationEditorLayer');
  await layer.click({ position: { x: 120, y: 260 } });
  const editor = layer.locator('.freeTextEditor [contenteditable="true"]').last();
  await expect(editor).toBeVisible();
  await editor.fill('Folio persistent annotation');
  await page.locator('#tool-select').click();
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  const output = await exportCopy(page, testInfo, 'text-outline.pdf');
  expect(await annotations(output.bytes)).toContainEqual({ subtype: '/FreeText', contents: 'Folio persistent annotation' });
  await chooseFile(page, output.path);
  await ready(page);
  await expect(visibleDocument(page).locator('.textLayer').first()).toContainText('UniqueToken1');
});

test('highlight supports undo/redo, survives export, and the exported copy reopens', async ({ page }, testInfo) => {
  await openFile(page, 'text-outline.pdf');
  await page.locator('#scale').selectOption('page-fit');
  await page.locator('#tool-highlight').click();
  const text = visibleDocument(page).locator('.page[data-page-number="1"] .textLayer span').filter({ hasText: 'Select this ordinary sentence' });
  const box = await text.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 1, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 1, box!.y + box!.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(visibleDocument(page).locator('.highlightEditor')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(visibleDocument(page).locator('.highlightEditor')).toHaveCount(0);
  await page.locator('#redo').click();
  await expect(visibleDocument(page).locator('.highlightEditor')).toHaveCount(1);
  await page.locator('#tool-select').click();
  const output = await exportCopy(page, testInfo, 'text-outline.pdf');
  expect((await annotations(output.bytes)).some(item => item.subtype === '/Highlight')).toBe(true);
  await chooseFile(page, output.path);
  await ready(page);
});

test('pointer ink exports as a real Ink annotation and reopens', async ({ page }, testInfo) => {
  await openFile(page, 'text-outline.pdf');
  await page.locator('#scale').selectOption('page-fit');
  await page.locator('#tool-draw').click();
  const layer = visibleDocument(page).locator('.page[data-page-number="1"] .annotationEditorLayer');
  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.25;
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 25, y - 20, { steps: 5 });
  await page.mouse.move(x + 60, y + 15, { steps: 5 });
  await page.mouse.move(x + 95, y - 25, { steps: 5 });
  await page.mouse.up();
  await page.locator('#tool-select').click();
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  const output = await exportCopy(page, testInfo, 'text-outline.pdf');
  expect((await annotations(output.bytes)).some(item => item.subtype === '/Ink')).toBe(true);
  await chooseFile(page, output.path);
  await ready(page);
});

test('freehand highlighter on blank page space exports as PDF ink and reopens', async ({ page }, testInfo) => {
  await openFile(page, 'text-outline.pdf');
  await page.locator('#scale').selectOption('page-fit');
  await page.locator('#tool-highlight').click();
  const layer = visibleDocument(page).locator('.page[data-page-number="1"] .annotationEditorLayer');
  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.25;
  const y = box!.y + box!.height * 0.65;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y - 10, { steps: 8 });
  await page.mouse.move(x + 100, y + 12, { steps: 8 });
  await page.mouse.up();
  await page.locator('#tool-select').click();
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  const output = await exportCopy(page, testInfo, 'text-outline.pdf');
  expect((await annotations(output.bytes)).some(item => item.subtype === '/Ink')).toBe(true);
  await chooseFile(page, output.path);
  await ready(page);
});

test('dirty close requires an explicit choice and cancellation preserves the open edits', async ({ page }) => {
  await openFile(page, 'form.pdf');
  await visibleDocument(page).locator('input[name="reader_name"]').fill('Keep this change');
  await page.locator('#page-total').click();
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close form.pdf', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Keep your changes?');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  await expect(visibleDocument(page).locator('input[name="reader_name"]')).toHaveValue('Keep this change');
  await page.getByRole('button', { name: 'Close form.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.locator('#welcome')).toBeVisible();
});

test('print hands a real local PDF to the browser viewer or download without claiming printing completed', async ({ page, context }, testInfo) => {
  await openFile(page, 'text-outline.pdf');
  const downloads: Download[] = [];
  const blobRequests: string[] = [];
  const captureDownload = (download: Download) => downloads.push(download);
  page.on('download', captureDownload);
  context.on('page', popup => popup.on('download', captureDownload));
  context.on('request', request => { if (request.url().startsWith('blob:')) blobRequests.push(request.url()); });
  const popupEvent = page.waitForEvent('popup');
  await page.locator('#print').click();
  const popup = await popupEvent;
  await expect.poll(() => popup.url().startsWith('blob:') || downloads.length > 0).toBe(true);
  if (downloads.length) {
    const destination = testInfo.outputPath('browser-print-copy.pdf');
    await downloads[0].saveAs(destination);
    expect(await downloads[0].failure()).toBeNull();
    const bytes = await readFile(destination);
    const original = await readFile(fixture('text-outline.pdf'));
    expect(bytes.equals(original)).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
    if (!popup.isClosed() && popup.url() === 'about:blank') {
      await expect(popup.locator('body')).toContainText('may have downloaded the print copy');
    }
  } else {
    await expect.poll(() => blobRequests.length).toBeGreaterThan(0);
    expect(popup.url()).toMatch(/^blob:/);
  }
  await expect(page.locator('#toast')).toContainText('Print copy sent to your browser');
  await expect(page.locator('#toast')).toContainText('may open or download the PDF');
  if (!popup.isClosed()) await popup.close();
  await expect(page.locator('#reader')).toBeVisible();
});

test('damaged and unsupported inputs fail safely and a valid document still opens afterward', async ({ page }) => {
  await chooseFile(page, fixture('malformed.pdf'));
  await expect(page.locator('#toast')).toContainText(/damaged|unsupported|Invalid|invalid/i);
  await expect(page.locator('#welcome')).toBeVisible();
  await chooseFile(page, fixture('unsupported.txt'));
  await expect(page.locator('#toast')).toContainText('Choose a PDF file');
  await openFile(page, 'text-outline.pdf');
  await expect(page.locator('#page-total')).toHaveText('of 3');
});

test('password rejection retries locally; valid password opens an encrypted read-only document', async ({ page }) => {
  await chooseFile(page, fixture('encrypted.pdf'));
  await expect(page.getByRole('dialog')).toContainText('Unlock your PDF');
  await page.getByLabel('Document password').fill('incorrect');
  await page.getByRole('button', { name: 'Open document', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('That password was not accepted');
  await page.getByLabel('Document password').fill('folio-test');
  await page.getByRole('button', { name: 'Open document', exact: true }).click();
  await ready(page);
  await expect(page.locator('#notice')).toContainText('Encrypted document: reading only');
  await expect(page.locator('#tool-text')).toBeDisabled();
  await expect(page.locator('#tool-highlight')).toBeDisabled();
});

test('canceling password entry does not strand the application', async ({ page }) => {
  await chooseFile(page, fixture('encrypted.pdf'));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#welcome')).toBeVisible();
  await openFile(page, 'text-outline.pdf');
});

test('restricted PDFs remain read-only and hostile actions execute no script or unsafe navigation', async ({ page }) => {
  await openFile(page, 'restricted.pdf');
  await expect(page.locator('#tool-text')).toBeDisabled();
  await expect(page.locator('#notice')).toContainText(/reading only|restricts changes/);
  const scriptDialogs: string[] = [];
  page.on('dialog', dialog => { scriptDialogs.push(dialog.message()); void dialog.dismiss(); });
  await openFile(page, 'hostile-actions.pdf');
  expect(scriptDialogs).toEqual([]);
  const unsafeHrefs = await visibleDocument(page).locator('a[href]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href).filter(href => /^(javascript|file|data):/i.test(href)));
  expect(unsafeHrefs).toEqual([]);
  await expect(visibleDocument(page).locator('.textLayer')).toContainText('Hostile action fixture');
});

test('multiple documents retain their own page position and a fourth document is safely refused', async ({ page }) => {
  await openFile(page, 'text-outline.pdf');
  await page.locator('#page-next').click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await openFile(page, 'form.pdf');
  await openFile(page, 'images.pdf');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab', { name: 'text-outline.pdf', exact: true }).click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await chooseFile(page, fixture('mixed-pages.pdf'));
  await expect(page.locator('#toast')).toContainText('Up to three documents');
  await expect(page.getByRole('tab')).toHaveCount(3);
});

test('identical widget IDs and radio names in two PDF tabs cannot change each other', async ({ page }, testInfo) => {
  await openFile(page, 'multi-widget.pdf');
  await page.locator('#scale').selectOption('page-fit');
  const fields = () => visibleDocument(page).locator('input[name="shared_name"]');
  const radios = () => visibleDocument(page).locator('input[type="radio"][name="shared_choice"]');
  await expect(fields()).toHaveCount(2);
  await fields().first().fill('First document');
  await radios().nth(0).check();
  await expect(fields().nth(1)).toHaveValue('First document');
  await openFile(page, 'multi-widget.pdf');
  await page.locator('#scale').selectOption('page-fit');
  await expect(fields().first()).toHaveValue('');
  await expect(fields().nth(1)).toHaveValue('');
  await expect(radios().nth(0)).toBeChecked();
  await expect(radios().nth(1)).not.toBeChecked();
  await fields().first().fill('Second document');
  await radios().nth(1).check();
  await expect(fields().nth(1)).toHaveValue('Second document');
  const tabs = page.getByRole('tab', { name: 'multi-widget.pdf', exact: true });
  await tabs.nth(0).click();
  await expect(fields().first()).toHaveValue('First document');
  await expect(fields().nth(1)).toHaveValue('First document');
  await expect(radios().nth(0)).toBeChecked();
  await expect(radios().nth(1)).not.toBeChecked();
  const first = await exportCopy(page, testInfo, 'multi-widget.pdf', 'first-');
  const firstPdf = await PDFDocument.load(first.bytes);
  expect(firstPdf.getForm().getTextField('shared_name').getText()).toBe('First document');
  expect(firstPdf.getForm().getRadioGroup('shared_choice').getSelected()).toBe('Alpha');
  await tabs.nth(1).click();
  await expect(fields().first()).toHaveValue('Second document');
  await expect(fields().nth(1)).toHaveValue('Second document');
  await expect(radios().nth(0)).not.toBeChecked();
  await expect(radios().nth(1)).toBeChecked();
  const second = await exportCopy(page, testInfo, 'multi-widget.pdf', 'second-');
  const secondPdf = await PDFDocument.load(second.bytes);
  expect(secondPdf.getForm().getTextField('shared_name').getText()).toBe('Second document');
  expect(secondPdf.getForm().getRadioGroup('shared_choice').getSelected()).toBe('Beta');
});

test('scanned pages render without fabricated searchable text; mixed sizes and rotation navigate', async ({ page }) => {
  await openFile(page, 'scanned.pdf');
  await page.locator('#toggle-search').click();
  await page.getByRole('searchbox', { name: 'Search document' }).fill('SYNTHETIC SCANNED');
  await expect(page.locator('#search-status')).toHaveText('No results');
  await page.locator('#search-close').click();
  await openFile(page, 'mixed-pages.pdf');
  await expect(page.locator('#page-total')).toHaveText('of 4');
  for (let number = 2; number <= 4; number++) {
    await page.locator('#page-next').click();
    await expect(page.locator('#page-number')).toHaveValue(String(number));
    await ready(page, number);
  }
});

test('blocked browser storage does not prevent PDF reading', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }));
  await page.reload();
  await expect(page.locator('#recents')).toContainText('Recent history is unavailable');
  await openFile(page, 'text-outline.pdf');
  await expect(page.locator('#toast')).toContainText('storage is unavailable');
});

const viewports = [
  { name: 'large desktop', width: 1600, height: 1000, touch: false },
  { name: 'laptop', width: 1280, height: 800, touch: false },
  { name: 'tablet landscape', width: 1024, height: 768, touch: true },
  { name: 'tablet portrait', width: 768, height: 1024, touch: true },
  { name: 'phone portrait', width: 390, height: 844, touch: true },
  { name: 'phone landscape', width: 844, height: 390, touch: true },
];

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch });
    test('reader controls stay reachable without hover or horizontal body overflow', async ({ page }) => {
      const checkOverflow = async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      };
      await checkOverflow();
      await openFile(page, 'text-outline.pdf', viewport.touch);
      await checkOverflow();
      for (const selector of ['#open', '#toggle-search', '#page-next', '#export', '#tool-highlight']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds, `${selector} is visible`).not.toBeNull();
        expect(bounds!.x, `${selector} left edge`).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width, `${selector} right edge`).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds!.y + bounds!.height, `${selector} bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
      }
      if (viewport.touch) await page.locator('#page-next').tap(); else await page.locator('#page-next').click();
      await expect(page.locator('#page-number')).toHaveValue('2');
      await ready(page, 2);
      if (viewport.touch) await page.locator('#toggle-search').tap(); else await page.locator('#toggle-search').click();
      await page.getByRole('searchbox', { name: 'Search document' }).fill('amber heron');
      await expect(page.locator('#search-status')).toHaveText(/of 3$/);
      await checkOverflow();
    });
  });
}

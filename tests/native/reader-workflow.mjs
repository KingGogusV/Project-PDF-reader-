// Real installed-WebView assertions shared by native test launchers. No mocked assets.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function localAsset(url) {
  // Tauri serves these origins from the installed executable, not an HTTP server.
  return ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'tauri.localhost' && !url.port)
    || (url.protocol === 'tauri:' && url.hostname === 'localhost');
}
function safeUrl(value) {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return value.slice(0,200); }
}

export async function verifyNativeReader({ browser, output, fixtures, report, checked }) {
let page;
const originalInput = await readFile(join(fixtures,'form.pdf'));
const searchInput = await readFile(join(fixtures,'text-outline.pdf'));
async function readLibrary(includeBytes = false) {
  return page.evaluate(async bytesWanted => {
    const db = await new Promise((resolvePromise, reject) => {
      const request = indexedDB.open('folio-local-library');
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains('documents')) return { records: [] };
      const get = (store, key) => new Promise((resolvePromise, reject) => {
        const request = key === undefined ? db.transaction(store).objectStore(store).getAll()
          : db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await get('documents');
      const records = rows.map(row => ({ owner: row.owner, id: row.id, name: row.name,
        revision: row.revision, needsRecovery: row.needsRecovery,
        latestIsOriginal: row.latestIsOriginal, originalSha256: row.originalSha256, latestSha256: row.latestSha256 }));
      if (!bytesWanted || !rows.length) return { records };
      const record = rows[0];
      const original = await get('originals', [record.owner, record.id]);
      const latest = record.latestIsOriginal ? original : await get('latest', [record.owner, record.id]);
      const array = async entry => Array.from(new Uint8Array(entry.bytes instanceof ArrayBuffer ? entry.bytes : await entry.bytes.arrayBuffer()));
      return { records, original: await array(original), latest: await array(latest) };
    } finally { db.close(); }
  }, includeBytes);
}
const active = () => page.locator('.document-host:not([hidden])');
async function ready() {
  await expect(page.locator('#reader')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#loading')).toBeHidden();
  await expect(active().locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true', { timeout: 20_000 });
}
async function openPdf(name) {
  const selection = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await selection).setFiles(resolve(fixtures, name));
  await ready();
}

  const context = browser.contexts()[0];
  assert.ok(context, 'WebView2 must expose its existing browser context.');
  context.setDefaultTimeout(15_000); context.setDefaultNavigationTimeout(20_000);
  const deadline = Date.now() + 15_000;
  while (!page && Date.now() < deadline) {
    page = context.pages().find(candidate => { try { return localAsset(new URL(candidate.url())); } catch { return false; } });
    if (!page) await delay(100);
  }
  assert.ok(page, 'The connected WebView must display the packaged Tauri origin.');
  report.packagedUrl = page.url();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0,1000)); });
  page.on('dialog', dialog => { void dialog.accept().catch(() => {}); });
  context.on('request', request => {
    const url = new URL(request.url());
    const item = { method: request.method(), url: safeUrl(request.url()), type: request.resourceType() };
    if (report.requests.length < 1000) report.requests.push(item);
    if (url.protocol === 'ipc:' || url.hostname === 'ipc.localhost') report.nativeIpcRequests.push(item);
    else if (!['GET','HEAD'].includes(request.method())) report.unexpectedWriteRequests.push(item);
  });
  // Packaged assets keep their real handler; there are no fulfilled/mocked responses.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:','https:','ws:','wss:'].includes(url.protocol) && !localAsset(url) && url.hostname !== 'ipc.localhost') {
      report.blockedExternalRequests.push({ method: route.request().method(), url: safeUrl(route.request().url()) });
      await route.abort('internetdisconnected');
    } else await route.continue();
  });
  await context.routeWebSocket('**/*', socket => {
    report.blockedExternalRequests.push({ method: 'WEBSOCKET', url: safeUrl(socket.url()) });
    socket.close();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#welcome')).toBeVisible();
  checked('packaged application opens without a development server');
  await page.screenshot({ path: join(output, 'welcome.png') });

  await openPdf('form.pdf');
  await expect(active().locator('input[name="reader_name"]')).toBeVisible();
  const pixels = await active().locator('.page[data-page-number="1"] canvas').first().evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let nonWhite = 0;
    for (let i=0;i<data.length;i+=64) if (data[i+3] && (data[i]<240 || data[i+1]<240 || data[i+2]<240)) nonWhite++;
    return { width:canvas.width, height:canvas.height, sampledNonWhitePixels:nonWhite };
  });
  assert.ok(pixels.width > 0 && pixels.height > 0 && pixels.sampledNonWhitePixels > 50);
  checked('real local form PDF renders nonblank pixels and native form widgets', pixels);
  assert.equal((await readLibrary()).records.length, 0);
  await page.locator('#store-local').click();
  await page.getByRole('button', { name:'Not now', exact:true }).click();
  assert.equal((await readLibrary()).records.length, 0);
  checked('declining storage leaves the document library empty');

  const value = 'Folio Windows native recovery verified';
  await active().locator('input[name="reader_name"]').fill(value);
  await page.locator('#page-total').click();
  await page.locator('#store-local').click();
  await page.getByRole('button', { name:'Enable local recovery', exact:true }).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device', { timeout:20_000 });
  await expect.poll(async () => (await readLibrary()).records.length).toBe(1);
  const stored = await readLibrary(true);
  assert.equal(stored.records[0].owner, 'guest');
  assert.equal(stored.records[0].needsRecovery, true);
  assert.deepEqual(Buffer.from(stored.original), originalInput);
  const latest = Buffer.from(stored.latest);
  const savedPdf = await PDFDocument.load(latest);
  const sourcePdf = await PDFDocument.load(originalInput);
  assert.equal(savedPdf.getForm().getTextField('reader_name').getText(), value);
  assert.equal(savedPdf.getPageCount(), sourcePdf.getPageCount());
  assert.deepEqual(savedPdf.getPages().map(p => p.getSize()), sourcePdf.getPages().map(p => p.getSize()));
  assert.deepEqual(savedPdf.getForm().getFields().map(f=>f.getName()).sort(), sourcePdf.getForm().getFields().map(f=>f.getName()).sort());
  assert.equal(savedPdf.getForm().getCheckBox('approved').isChecked(), sourcePdf.getForm().getCheckBox('approved').isChecked());
  assert.deepEqual(savedPdf.getForm().getDropdown('review_status').getSelected(), sourcePdf.getForm().getDropdown('review_status').getSelected());
  assert.equal(savedPdf.getForm().getTextField('notes').getText(), sourcePdf.getForm().getTextField('notes').getText());
  await writeFile(join(output, 'validated-recovery.pdf'), latest);
  checked('consented guest checkpoint reopens in an independent parser and preserves original bytes/unrelated fields', {
    originalSha256:sha256(originalInput), latestSha256:sha256(latest), pageCount:savedPdf.getPageCount(),
  });

  await page.reload({ waitUntil:'domcontentloaded' });
  await page.locator('#library').click();
  await expect(page.locator('.recovery-badge')).toHaveText('Recovery copy available');
  await page.locator('[data-library-action="open"]').click();
  await ready();
  await expect(active().locator('input[name="reader_name"]')).toHaveValue(value);
  await expect.poll(async () => (await readLibrary()).records[0].needsRecovery).toBe(false);
  checked('reloading the actual native WebView restores the edited form from the device library');
  await page.screenshot({ path:join(output,'recovered-form.png') });

  await openPdf('text-outline.pdf');
  await page.locator('#toggle-search').click();
  await page.getByRole('searchbox', { name:'Search document' }).fill('amber heron');
  await expect(page.locator('#search-status')).toHaveText('1 of 3');
  await page.locator('#search-next').click();
  await expect(page.locator('#search-status')).toHaveText('2 of 3');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#search-close').click();
  await expect(page.locator('#searchbar')).toBeHidden();
  checked('a second real PDF searches all three pages and navigates results');
  await page.screenshot({ path:join(output,'search-document.png') });
  assert.deepEqual(await readFile(join(fixtures,'form.pdf')), originalInput);
  assert.deepEqual(await readFile(join(fixtures,'text-outline.pdf')), searchInput);
  assert.deepEqual(report.pageErrors, [], 'No uncaught page exceptions are allowed.');
  assert.deepEqual(report.unexpectedWriteRequests, [], 'No PDF/document upload request is allowed.');
  assert.deepEqual(report.blockedExternalRequests, [], 'Core workflows must not attempt external network requests.');
  checked('fixtures stay unchanged; observed document workflows make no upload or external requests', {
    observation:'Controlled reload through form recovery and search; app network requests only.',
  });
return { page, active, ready, openPdf, readLibrary, originalInput };
}

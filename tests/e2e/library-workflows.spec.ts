import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'generated');
const doc = (page: Page) => page.locator('.document-host:not([hidden])');
type StoredRecord = { owner: string; id: string; revision: number; needsRecovery: boolean; latestIsOriginal: boolean; latestSha256: string; originalSha256: string };

async function accountRoute(context: BrowserContext, owner: () => string | null = () => null) {
  // Only hosted identity is substituted. All UI, PDF parsing, checkpoints and
  // IndexedDB storage below use the production implementation and real browser APIs.
  await context.route('**/api/account', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    identity: owner() ? { displayName: owner() } : null,
    account: owner() ? { accountId: owner(), createdAt: 1 } : null,
    registered: 2, limit: 200,
  }) }));
}

async function records(page: Page): Promise<StoredRecord[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('folio-local-library'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('documents')) return [];
      return await new Promise<StoredRecord[]>((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    } finally { db.close(); }
  });
}

async function latestBytes(page: Page): Promise<Uint8Array> {
  return new Uint8Array(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('folio-local-library'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const metadata = await new Promise<StoredRecord[]>((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const record = metadata[0];
      const store = record.latestIsOriginal ? 'originals' : 'latest';
      const blob = await new Promise<Blob>((resolve, reject) => { const request = db.transaction(store).objectStore(store).get([record.owner, record.id]); request.onsuccess = () => resolve(request.result.bytes); request.onerror = () => reject(request.error); });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    } finally { db.close(); }
  }));
}

async function open(page: Page, name = 'form.pdf') {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await chooser).setFiles(join(fixtures, name));
  await ready(page);
}

async function ready(page: Page) {
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(doc(page).locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true');
}

async function consent(page: Page) {
  await page.locator('#store-local').click();
  await expect(page.locator('#dialog-title')).toHaveText('Store this PDF on this device?');
  await page.getByRole('button', { name: 'Enable local recovery', exact: true }).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  await expect.poll(async () => (await records(page)).length).toBe(1);
}

async function editName(page: Page, value: string) {
  await doc(page).locator('input[name="reader_name"]').fill(value);
  await page.locator('#page-total').click();
}

async function savedAfter(page: Page, revision: number) {
  await expect.poll(async () => (await records(page))[0]?.revision || 0).toBeGreaterThan(revision);
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
}

async function openLatest(page: Page) {
  await page.locator('#library').click();
  await page.locator('[data-library-action="open"]').click();
  await ready(page);
}

async function closeStored(page: Page, answer: 'Keep in library' | 'Discard changes') {
  await page.getByRole('button', { name: 'Close form.pdf', exact: true }).click();
  await page.getByRole('button', { name: answer, exact: true }).click();
  await expect(page.locator('#welcome')).toBeVisible();
}

test('storage requires consent, survives a reload, restores form edits and preserves the exact original', async ({ page, context }, testInfo) => {
  await accountRoute(context);
  const uploads: string[] = [];
  context.on('request', request => { if (request.method() !== 'GET' && request.method() !== 'HEAD') uploads.push(request.url()); });
  await page.goto('/');
  await open(page);
  expect(await records(page)).toEqual([]);
  await page.locator('#store-local').click();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  expect(await records(page)).toEqual([]);
  await consent(page);
  const initial = (await records(page))[0];
  await editName(page, 'Recovered after an unexpected reload');
  await savedAfter(page, initial.revision);
  expect((await records(page))[0].needsRecovery).toBe(true);
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page.locator('#library').click();
  await expect(page.locator('.recovery-badge')).toHaveText('Recovery copy available');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-library-action="original"]').click();
  const download = await downloadEvent;
  const output = testInfo.outputPath('unchanged-original.pdf');
  await download.saveAs(output);
  expect((await readFile(output)).equals(await readFile(join(fixtures, 'form.pdf')))).toBe(true);
  await page.locator('[data-library-action="open"]').click();
  await ready(page);
  await expect(doc(page).locator('input[name="reader_name"]')).toHaveValue('Recovered after an unexpected reload');
  await expect.poll(async () => (await records(page))[0].needsRecovery).toBe(false);
  expect(uploads).toEqual([]);
});

test('keep in library commits edits and discard restores the reopened baseline, not the first original', async ({ page, context }) => {
  await accountRoute(context);
  await page.goto('/'); await open(page); await consent(page);
  await editName(page, 'Previously kept baseline');
  await closeStored(page, 'Keep in library');
  expect((await records(page))[0].needsRecovery).toBe(false);
  await openLatest(page);
  await expect(doc(page).locator('input[name="reader_name"]')).toHaveValue('Previously kept baseline');
  const before = (await records(page))[0].revision;
  await editName(page, 'Discard this new edit');
  await savedAfter(page, before);
  await closeStored(page, 'Discard changes');
  await openLatest(page);
  await expect(doc(page).locator('input[name="reader_name"]')).toHaveValue('Previously kept baseline');
  const pdf = await PDFDocument.load(await latestBytes(page));
  expect(pdf.getForm().getTextField('reader_name').getText()).toBe('Previously kept baseline');
});

test('account changes select separate local libraries and never transfer guest consent', async ({ page, context }) => {
  let owner: string | null = 'account-a';
  await accountRoute(context, () => owner);
  await page.goto('/'); await open(page); await consent(page);
  expect((await records(page))[0].owner).toBe('account:account-a');
  owner = 'account-b'; await page.reload();
  await page.locator('#library').click();
  await expect(page.locator('.library-row')).toHaveCount(0);
  await expect(page.locator('#dialog-body')).toContainText('No PDFs stored here yet');
  owner = null; await page.reload();
  await page.locator('#library').click();
  await expect(page.locator('.library-row')).toHaveCount(0);
  await expect(page.locator('#dialog-body')).toContainText('Guest library');
  owner = 'account-a'; await page.reload();
  await page.locator('#library').click();
  await expect(page.locator('.library-row')).toHaveCount(1);
});

test('a stale browser tab cannot overwrite a newer recovery checkpoint', async ({ page, context }) => {
  await accountRoute(context, () => 'shared-account');
  await page.goto('/'); await open(page); await consent(page);
  const second = await context.newPage();
  await second.goto('/'); await openLatest(second);
  const before = (await records(page))[0].revision;
  await editName(page, 'First tab durable winner');
  await savedAfter(page, before);
  const winner = (await records(page))[0];
  await editName(second, 'Stale tab work stays open');
  await expect(second.locator('#recovery-status')).toHaveText('Newer stored copy exists - export these edits');
  expect((await records(second))[0].revision).toBe(winner.revision);
  expect((await records(second))[0].latestSha256).toBe(winner.latestSha256);
  await second.getByRole('button', { name: 'Close form.pdf', exact: true }).click();
  await second.getByRole('button', { name: 'Keep in library', exact: true }).click();
  await expect(second.locator('#reader')).toBeVisible();
  await expect(doc(second).locator('input[name="reader_name"]')).toHaveValue('Stale tab work stays open');
  const pdf = await PDFDocument.load(await latestBytes(page));
  expect(pdf.getForm().getTextField('reader_name').getText()).toBe('First tab durable winner');
});

test('storage failure retains the previous copy and prevents closing unsaved local work', async ({ page, context }) => {
  await accountRoute(context);
  await page.goto('/'); await open(page); await consent(page);
  const baseline = (await records(page))[0];
  await page.evaluate(() => {
    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof nativePut>) {
      if (this.name === 'documents') throw new DOMException('Device full', 'QuotaExceededError');
      return nativePut.apply(this, args);
    };
  });
  await editName(page, 'Keep this open after storage failure');
  await expect(page.locator('#recovery-status')).toHaveText('Local save failed - keep open and export a copy');
  expect((await records(page))[0].revision).toBe(baseline.revision);
  expect((await records(page))[0].latestSha256).toBe(baseline.latestSha256);
  await page.getByRole('button', { name: 'Close form.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Keep in library', exact: true }).click();
  await expect(doc(page).locator('input[name="reader_name"]')).toHaveValue('Keep this open after storage failure');
  await expect(page.locator('#toast')).toContainText(/storage|space|quota/i);
});

test('undo returning a document to clean also replaces the prior modified recovery copy', async ({ page, context }) => {
  await accountRoute(context);
  await page.goto('/'); await open(page, 'text-outline.pdf'); await consent(page);
  await page.locator('#scale').selectOption('page-fit');
  await page.locator('#tool-highlight').click();
  const text = doc(page).locator('.page[data-page-number="1"] .textLayer span').filter({ hasText: 'Select this ordinary sentence' });
  const box = (await text.boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 15 }); await page.mouse.up();
  await page.locator('#tool-select').click();
  await expect.poll(async () => (await records(page))[0].needsRecovery).toBe(true);
  const changed = (await records(page))[0];
  await page.locator('#undo').click();
  await expect(doc(page).locator('.highlightEditor')).toHaveCount(0);
  await savedAfter(page, changed.revision);
  expect((await records(page))[0].needsRecovery).toBe(false);
  expect((await records(page))[0].latestIsOriginal).toBe(true);
  expect(Buffer.from(await latestBytes(page)).equals(await readFile(join(fixtures, 'text-outline.pdf')))).toBe(true);
});

test('ongoing reader view updates do not postpone a pending content checkpoint', async ({ page, context }) => {
  await accountRoute(context); await page.goto('/'); await open(page); await consent(page);
  const before = (await records(page))[0].revision;
  await editName(page, 'Saved while the reader remains active');
  const timer = await page.evaluate(() => setInterval(() => {
    const scale = document.querySelector<HTMLSelectElement>('#scale')!;
    scale.value = scale.value === 'page-fit' ? 'page-width' : 'page-fit';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
  }, 100));
  try {
    await expect.poll(async () => (await records(page))[0].revision, { timeout: 5000 }).toBeGreaterThan(before);
  } finally { await page.evaluate(id => clearInterval(id), timer); }
  const pdf = await PDFDocument.load(await latestBytes(page));
  expect(pdf.getForm().getTextField('reader_name').getText()).toBe('Saved while the reader remains active');
});

test('local development without the hosted account API remains an honest guest reader', async ({ page, context }) => {
  await context.route('**/api/account', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local development</title>' }));
  await page.goto('/');
  await page.locator('#account').click();
  await expect(page.locator('#dialog-body')).toContainText('Use the hosted website for account access');
  await expect(page.getByRole('button', { name: 'Sign in with ChatGPT', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await open(page); await consent(page);
  expect((await records(page))[0].owner).toBe('guest');
});

for (const failure of ['network', 'HTTP 503']) test(`a ${failure} account outage exposes a clearly labeled cached local library`, async ({ page, context }) => {
  await accountRoute(context, () => 'offline-account');
  await page.goto('/'); await open(page); await consent(page);
  await context.route('**/api/account', route => failure === 'network' ? route.abort('internetdisconnected') : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Account service temporarily unavailable' }) }));
  await page.reload();
  await page.locator('#library').click();
  await expect(page.locator('#dialog-body')).toContainText('Offline library for offline-account');
  await expect(page.locator('#dialog-body')).toContainText('not a verified sign-in');
  await expect(page.locator('.library-row')).toHaveCount(1);
  await page.locator('[data-library-action="open"]').click(); await ready(page);
  await expect(doc(page).locator('input[name="reader_name"]')).toHaveValue('');
});

test('canceled sign-out retains live recovery; successful sign-out commits edits and clears the owner hint', async ({ page, context }) => {
  await accountRoute(context, () => 'signout-account');
  await context.route('**/signout-with-chatgpt?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Managed sign-out destination</title>' }));
  await page.goto('/'); await open(page); await consent(page);
  await doc(page).locator('input[name="reader_name"]').fill('Checkpoint before signing out');
  let navigationAttempts = 0;
  page.on('dialog', dialog => { navigationAttempts++; void (navigationAttempts === 1 ? dialog.dismiss() : dialog.accept()); });
  await page.locator('#account').click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.poll(() => navigationAttempts).toBe(1);
  await expect(page.locator('#reader')).toBeVisible();
  const before = (await records(page))[0].revision;
  await editName(page, 'Recovery still works after canceled sign-out');
  await savedAfter(page, before);
  await page.locator('#account').click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveTitle('Managed sign-out destination');
  expect(await page.evaluate(() => localStorage.getItem('folio.local-account-hint.v1'))).toBeNull();
  const pdf = await PDFDocument.load(await latestBytes(page));
  expect(pdf.getForm().getTextField('reader_name').getText()).toBe('Recovery still works after canceled sign-out');
});

test('blocked optional localStorage does not prevent managed account sign-out', async ({ page, context }) => {
  await accountRoute(context, () => 'blocked-preference');
  await context.route('**/signout-with-chatgpt?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Managed sign-out destination</title>' }));
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked preference storage', 'SecurityError'); } }));
  await page.goto('/'); await page.locator('#account').click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveTitle('Managed sign-out destination');
});

test('encrypted PDFs keep their original encryption and require the password again after library reload', async ({ page, context }) => {
  await accountRoute(context); await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await page.locator('#open').click();
  await (await chooser).setFiles(join(fixtures, 'encrypted.pdf'));
  await page.getByLabel('Document password').fill('folio-test');
  await page.getByRole('button', { name: 'Open document', exact: true }).click(); await ready(page);
  await consent(page);
  expect(Buffer.from(await latestBytes(page)).equals(await readFile(join(fixtures, 'encrypted.pdf')))).toBe(true);
  expect(JSON.stringify(await records(page))).not.toContain('folio-test');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('folio-test');
  await page.reload(); await page.locator('#library').click();
  await page.locator('[data-library-action="open"]').click();
  await expect(page.getByLabel('Document password')).toHaveValue('');
  await page.getByLabel('Document password').fill('folio-test');
  await page.getByRole('button', { name: 'Open document', exact: true }).click(); await ready(page);
  await expect(page.locator('#notice')).toContainText('Encrypted document: reading only');
});

test.describe('phone library controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('consent and library actions fit the viewport and work with touch', async ({ page, context }) => {
    await accountRoute(context); await page.goto('/'); await open(page);
    await page.locator('#store-local').tap();
    await page.getByRole('button', { name: 'Enable local recovery', exact: true }).tap();
    await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
    await page.locator('#library').tap();
    await expect(page.locator('.library-row')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    for (const action of ['open', 'original', 'delete']) {
      const box = (await page.locator(`[data-library-action="${action}"]`).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
    }
    await page.locator('[data-library-action="open"]').tap(); await ready(page);
  });
});

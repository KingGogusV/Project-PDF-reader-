// Browser-only verification of shared UI using explicit simulated native IPC.
// This does not verify real dialogs, OS close, permissions, disk writes or binaries.
import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

type NativeOptions = { cancel?: boolean; failure?: 'begin' | 'append' | 'finish'; holdFinish?: boolean; filename?: string };
type NativeState = {
  options: NativeOptions; calls: string[]; token: string; filename: string;
  expected?: { byteLength: number; sha256: string }; chunks: number[]; saved: number[];
  pendingFinish: boolean; releaseFinish?: () => void;
};
type NativeWindow = Window & typeof globalThis & {
  isTauri: boolean; nativeTest: NativeState;
  __TAURI_INTERNALS__: { invoke: (command: string, args?: Record<string, unknown> | Uint8Array, options?: { headers?: Record<string, string> }) => Promise<unknown> };
};
const fixture = (name: string) => resolve('tests/fixtures/generated', name);
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

async function nativePage(page: Page, options: NativeOptions = {}) {
  await page.addInitScript(options => {
    const target = window as NativeWindow;
    const state = target.nativeTest = {
      options, calls: [], token: '942647f7-f040-4f79-807d-1070591640f7', filename: '',
      chunks: [], saved: [], pendingFinish: false,
    } as NativeState;
    target.isTauri = true;
    target.__TAURI_INTERNALS__ = { async invoke(command, args = {}, options) {
      state.calls.push(command);
      if (command === 'finish_close') return;
      if (command === 'begin_pdf_save') {
        if (state.options.cancel) return null;
        if (state.options.failure === 'begin') throw new Error('Simulated Save As permission denied.');
        const request = args as { filename: string; byteLength: number; sha256: string };
        if (!request.filename.endsWith('.pdf') || !Number.isSafeInteger(request.byteLength) || request.byteLength <= 0 || !/^[a-f0-9]{64}$/.test(request.sha256)) throw new Error('Invalid simulated save request.');
        state.expected = request; state.chunks = []; state.filename = state.options.filename || request.filename;
        return { token: state.token, filename: state.filename };
      }
      if (command === 'append_pdf_save') {
        if (!(args instanceof Uint8Array) || !args.byteLength || options?.headers?.['x-folio-save-token'] !== state.token || options?.headers?.['x-folio-save-offset'] !== String(state.chunks.length)) throw new Error('Invalid simulated raw save chunk.');
        if (state.options.failure === 'append') throw new Error('Simulated disk is full.');
        for (const byte of args) state.chunks.push(byte);
        return state.chunks.length;
      }
      if (command === 'finish_pdf_save') {
        if ((args as { token: string }).token !== state.token || !state.expected) throw new Error('Invalid simulated finish token.');
        state.pendingFinish = true;
        if (state.options.holdFinish) await new Promise<void>(resolve => { state.releaseFinish = resolve; });
        state.pendingFinish = false;
        if (state.options.failure === 'finish') throw new Error('Simulated final write permission denied.');
        const bytes = new Uint8Array(state.chunks);
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== state.expected.byteLength || sha256 !== state.expected.sha256) throw new Error('Simulated copy differs from its requested byte receipt.');
        state.saved = Array.from(bytes);
        return { filename: state.filename, byteLength: bytes.byteLength, sha256 };
      }
      if (command === 'cancel_pdf_save') {
        if ((args as { token: string }).token !== state.token) throw new Error('Invalid simulated cancel token.');
        state.chunks = []; return;
      }
      throw new Error(`Unexpected simulated native command: ${command}`);
    } };
  }, options);
  await page.goto('/');
}
async function choosePdf(page: Page, name: string) {
  const chooser = page.waitForEvent('filechooser'); await page.locator('#open').click();
  await (await chooser).setFiles(fixture(name));
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#loading')).toBeHidden();
  if (name === 'form.pdf') await expect(page.locator('input[name="reader_name"]')).toBeVisible();
}
async function openForm(page: Page, options: NativeOptions = {}) {
  await nativePage(page, options); await choosePdf(page, 'form.pdf');
}
const requestClose = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('folio-native-close-request')));
const calls = (page: Page, command = 'finish_close') => page.evaluate(command => (window as NativeWindow).nativeTest.calls.filter(call => call === command).length, command);
const releaseSave = (page: Page) => page.evaluate(() => (window as NativeWindow).nativeTest.releaseFinish?.());
const completedPdf = async (page: Page) => PDFDocument.load(new Uint8Array(await page.evaluate(() => (window as NativeWindow).nativeTest.saved)));
async function duplicateActions(page: Page, ids: string[], closeRequests = 0) {
  await page.evaluate(async ({ ids, closeRequests }) => {
    for (const id of ids) document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < closeRequests; i++) window.dispatchEvent(new Event('folio-native-close-request'));
    // Let click microtasks and UI updates settle while the mocked task stays pending.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { ids, closeRequests });
}

test('simulated native close preserves edits on cancel and waits for the native copy receipt', async ({ page }) => {
  const originalHash = createHash('sha256').update(await readFile(fixture('form.pdf'))).digest('hex');
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await openForm(page, { filename: '履歴-é-folio.pdf' });
  await page.locator('input[name="reader_name"]').fill('Keep my native edits');
  await requestClose(page); await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  expect(await calls(page)).toBe(0);
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Keep my native edits');
  await requestClose(page); await page.getByRole('button', { name: 'Export copy', exact: true }).last().click();
  await expect(page.locator('#toast')).toHaveText('Saved new PDF copy: 履歴-é-folio.pdf. Your original is unchanged.');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect((await completedPdf(page)).getForm().getTextField('reader_name').getText()).toBe('Keep my native edits');
  expect(createHash('sha256').update(await readFile(fixture('form.pdf'))).digest('hex')).toBe(originalHash);
  expect(await calls(page)).toBe(0); // Saving returns to the open document.
  await requestClose(page); await expect.poll(() => calls(page)).toBe(1);
  await expect(page.locator('#welcome')).toBeVisible();
});

test('simulated native close persists opted-in edits and does not replace an active dialog', async ({ page }) => {
  await openForm(page);
  await page.locator('#store-local').click(); await page.getByRole('button', { name: 'Enable local recovery', exact: true }).click();
  await page.locator('input[name="reader_name"]').fill('Keep in local library on exit');
  await page.locator('#properties').click(); await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Document properties'); expect(await calls(page)).toBe(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await requestClose(page);
  await page.getByRole('button', { name: 'Keep in library', exact: true }).click();
  await expect.poll(() => calls(page)).toBe(1);
  // The mock retains its browser window so persisted bytes can be reopened.
  await page.reload(); await page.locator('#library').click(); await page.locator('[data-library-action="open"]').click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Keep in local library on exit');
});

test('simulated native close shows the background document before asking about its edits', async ({ page }) => {
  await openForm(page);
  await page.locator('input[name="reader_name"]').fill('Unsaved background form');
  await choosePdf(page, 'text-outline.pdf');
  await expect(page.locator('#page-total')).toHaveText('of 3');
  await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await expect(page.getByRole('tab', { name: 'form.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  expect(await calls(page)).toBe(0);
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Unsaved background form');
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('simulated native Save As cancellation leaves edits dirty and the next close still asks', async ({ page }) => {
  await openForm(page, { cancel: true });
  await page.locator('input[name="reader_name"]').fill('Cancelled copy stays open');
  await requestClose(page); await page.getByRole('button', { name: 'Export copy', exact: true }).last().click();
  await expect(page.locator('#toast')).toHaveText('Save As cancelled. Your changes remain open.');
  expect(await calls(page, 'append_pdf_save')).toBe(0); expect(await calls(page, 'finish_pdf_save')).toBe(0);
  await expect(page.locator('.dirty-dot')).toHaveCount(1); expect(await calls(page)).toBe(0);
  await requestClose(page); await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Cancelled copy stays open');
  expect(await calls(page)).toBe(0);
});

for (const failure of ['begin', 'append', 'finish'] as const) {
  test(`simulated native ${failure} failure keeps edits open and cleans up a started save`, async ({ page }) => {
    await openForm(page, { failure });
    await page.locator('input[name="reader_name"]').fill('Failed write stays open');
    await requestClose(page); await page.getByRole('button', { name: 'Export copy', exact: true }).last().click();
    await expect(page.locator('#toast')).toContainText('Export failed. Your changes remain open.');
    await expect(page.locator('#export')).toBeEnabled();
    await expect(page.locator('.dirty-dot')).toHaveCount(1);
    expect(await calls(page, 'cancel_pdf_save')).toBe(failure === 'begin' ? 0 : 1);
    expect(await calls(page)).toBe(0);
    await requestClose(page); await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
    await page.getByRole('button', { name: 'Keep open', exact: true }).click();
    await expect(page.locator('input[name="reader_name"]')).toHaveValue('Failed write stays open');
    // A failed task must also release its guard so a later successful copy works.
    await page.evaluate(() => { (window as NativeWindow).nativeTest.options.failure = undefined; });
    await page.locator('#export').click();
    await expect(page.locator('#toast')).toContainText('Saved new PDF copy:');
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
  });
}

test('simulated pending native receipt blocks duplicate save, opening and close requests', async ({ page }) => {
  await openForm(page, { holdFinish: true });
  await page.locator('input[name="reader_name"]').fill('Waiting for durable copy');
  await page.locator('#export').click();
  await expect.poll(() => page.evaluate(() => (window as NativeWindow).nativeTest.pendingFinish)).toBe(true);
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await expect(page.locator('#close-active-document')).toBeDisabled();
  let pickers = 0; page.on('filechooser', () => pickers++);
  await duplicateActions(page, ['export', 'open', 'choose', 'close-active-document'], 3);
  expect(await calls(page, 'begin_pdf_save')).toBe(1); expect(await calls(page, 'finish_pdf_save')).toBe(1);
  expect(pickers).toBe(0); expect(await calls(page)).toBe(0);
  await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('tab')).toHaveCount(1);
  await releaseSave(page);
  await expect(page.locator('#toast')).toContainText('Saved new PDF copy:');
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  await requestClose(page); await expect.poll(() => calls(page)).toBe(1);
});

test('simulated native receipt only clears the exported snapshot and later edits still need saving', async ({ page }) => {
  await openForm(page, { holdFinish: true });
  const field = page.locator('input[name="reader_name"]');
  await field.fill('Value in exported snapshot'); await page.locator('#export').click();
  await expect.poll(() => page.evaluate(() => (window as NativeWindow).nativeTest.pendingFinish)).toBe(true);
  await field.fill('Newer unsaved value'); await page.locator('#page-total').click();
  await releaseSave(page);
  await expect(page.locator('#toast')).toContainText('Saved new PDF copy:');
  expect((await completedPdf(page)).getForm().getTextField('reader_name').getText()).toBe('Value in exported snapshot');
  await expect(field).toHaveValue('Newer unsaved value'); await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await requestClose(page); await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click(); expect(await calls(page)).toBe(0);
});

test('simulated native pending file picker coalesces duplicate opens and rejects OS close until selection finishes', async ({ page }) => {
  await openForm(page); await page.locator('input[name="reader_name"]').fill('Keep while choosing another PDF');
  let pickers = 0; page.on('filechooser', () => pickers++);
  const chooser = page.waitForEvent('filechooser'); await page.locator('#open').click();
  const pending = await chooser;
  await duplicateActions(page, ['open', 'choose', 'close-active-document'], 3);
  expect(pickers).toBe(1); expect(await calls(page)).toBe(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('tab')).toHaveCount(1);
  await pending.setFiles(fixture('text-outline.pdf'));
  await expect(page.getByRole('tab')).toHaveCount(2); await expect(page.locator('#loading')).toBeHidden();
  await requestClose(page); await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await expect(page.getByRole('tab', { name: 'form.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Keep while choosing another PDF');
  expect(await calls(page)).toBe(0);
});

test('simulated native file picker cancellation releases the lifecycle guard', async ({ page }) => {
  await nativePage(page);
  const chooser = page.waitForEvent('filechooser'); await page.locator('#open').click(); await chooser;
  await duplicateActions(page, ['open', 'choose'], 2);
  expect(await calls(page)).toBe(0);
  await page.locator('input[type="file"]').evaluate(input => input.dispatchEvent(new Event('cancel')));
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await choosePdf(page, 'text-outline.pdf');
  await requestClose(page); await expect.poll(() => calls(page)).toBe(1);
});

test('simulated native duplicate tab and OS close requests keep one unsaved prompt', async ({ page }) => {
  await openForm(page); await page.locator('input[name="reader_name"]').fill('Do not replace this close choice');
  await page.locator('#close-active-document').click();
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  const keepOpen = await page.getByRole('button', { name: 'Keep open', exact: true }).elementHandle();
  await duplicateActions(page, ['close-active-document', 'close-active-document'], 2);
  expect(await keepOpen!.evaluate(button => button.isConnected)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Do not replace this close choice');
  await expect(page.getByRole('tab')).toHaveCount(1); expect(await calls(page)).toBe(0);
});

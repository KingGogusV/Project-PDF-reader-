import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import type { ReaderController, ReaderState } from '../../src/core/document-controller';

declare global {
  interface Window {
    readerController: ReaderController;
    readerStates: ReaderState[];
    harnessReady: boolean;
    releaseSave: () => void;
  }
}

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/generated/${name}`, import.meta.url));
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(browserErrors.get(page), 'No uncaught browser errors').toEqual([]);
});

async function open(page: Page, filename = 'form.pdf', password: string | null = null) {
  const bytes = await readFile(fixture(filename));
  await page.goto('/tests/core/fixture.html');
  await page.waitForFunction(() => window.harnessReady);
  await page.evaluate(async ({ bytes, filename, password }) => {
    await window.readerController.open(new File([new Uint8Array(bytes)], filename, { lastModified: 1_700_000_000_000 }), async () => password);
  }, { bytes: [...bytes], filename, password });
  return bytes;
}

async function savedField(bytes: number[]) {
  const document = await PDFDocument.load(new Uint8Array(bytes));
  return document.getForm().getTextField('reader_name').getText();
}

test('form fields without PDF tooltips receive accessible names from their field names', async ({ page }) => {
  await open(page);
  for (const name of ['reader_name', 'notes', 'approved', 'review_status']) {
    await expect(page.locator(`[name="${name}"]`)).toHaveAccessibleName(name);
  }
});

test('successive edits publish revisions and a focused form checkpoints without save acknowledgment', async ({ page }) => {
  const source = await open(page);
  const field = page.locator('input[name="reader_name"]');
  await field.fill('First revision');
  await expect.poll(() => page.evaluate(() => window.readerController.state.dirty)).toBe(true);
  const firstRevision = await page.evaluate(() => window.readerController.state.revision);
  await field.fill('Second revision');
  await expect.poll(() => page.evaluate(() => window.readerController.state.revision)).toBeGreaterThan(firstRevision);
  const result = await page.evaluate(async () => {
    const controller = window.readerController;
    const copy = await controller.createCheckpoint();
    controller.markExported(); // A checkpoint must never install a download acknowledgment.
    const original = controller.getOriginalFile();
    return {
      checkpoint: { ...copy, bytes: [...copy.bytes] }, dirty: controller.dirty,
      focusedName: (document.activeElement as HTMLInputElement).name,
      original: { name: original.name, lastModified: original.lastModified, bytes: [...new Uint8Array(await original.arrayBuffer())] },
    };
  });
  expect(await savedField(result.checkpoint.bytes)).toBe('Second revision');
  expect(result.checkpoint.modified).toBe(true);
  expect(result.checkpoint.revision).toBeGreaterThan(firstRevision);
  expect(result.dirty).toBe(true);
  expect(result.focusedName).toBe('reader_name');
  expect(Buffer.from(result.original.bytes).equals(source)).toBe(true);
  expect(Buffer.from(result.checkpoint.bytes).subarray(0, source.length).equals(source)).toBe(true);
  expect(result.original).toMatchObject({ name: 'form.pdf', lastModified: 1_700_000_000_000 });
});

test('checkpoint and export serialize separately while later recovery cannot acknowledge newer edits', async ({ page }) => {
  await open(page);
  await page.locator('input[name="reader_name"]').fill('Checkpoint snapshot');
  const result = await page.evaluate(async () => {
    const controller = window.readerController;
    const doc = controller.pdfDocument!;
    const originalSave = doc.saveDocument.bind(doc);
    let release!: () => void;
    let began!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { began = resolve; });
    let calls = 0, active = 0, peak = 0;
    doc.saveDocument = async () => {
      const first = ++calls === 1;
      peak = Math.max(peak, ++active);
      try {
        const result = await originalSave();
        if (first) { began(); await blocked; }
        return result;
      } finally { active--; }
    };
    const checkpointPromise = controller.createCheckpoint();
    await started;
    const field = document.querySelector<HTMLInputElement>('input[name="reader_name"]')!;
    field.value = 'Export snapshot';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const exportPromise = controller.exportBytes();
    release();
    const checkpoint = await checkpointPromise;
    const exported = await exportPromise;
    field.value = 'Later recovery snapshot';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const laterCheckpoint = await controller.createCheckpoint();
    controller.markExported();
    return { checkpoint: [...checkpoint.bytes], exported: [...exported], later: [...laterCheckpoint.bytes], firstRevision: checkpoint.revision, laterRevision: laterCheckpoint.revision, dirty: controller.dirty, peak };
  });
  expect(result.peak).toBe(1);
  expect(await savedField(result.checkpoint)).toBe('Checkpoint snapshot');
  expect(await savedField(result.exported)).toBe('Export snapshot');
  expect(await savedField(result.later)).toBe('Later recovery snapshot');
  expect(result.laterRevision).toBeGreaterThan(result.firstRevision);
  expect(result.dirty).toBe(true);
});

test('a failed checkpoint preserves unsaved state and the next checkpoint can succeed', async ({ page }) => {
  await open(page);
  await page.locator('input[name="reader_name"]').fill('Retain this edit');
  const result = await page.evaluate(async () => {
    const controller = window.readerController;
    const doc = controller.pdfDocument!;
    const originalSave = doc.saveDocument.bind(doc);
    let first = true;
    doc.saveDocument = () => {
      if (first) { first = false; return Promise.reject(new Error('Synthetic serialization failure')); }
      return originalSave();
    };
    const failed = await controller.createCheckpoint().then(() => '', error => error.message);
    const checkpoint = await controller.createCheckpoint();
    controller.markExported();
    return { failed, bytes: [...checkpoint.bytes], dirty: controller.dirty };
  });
  expect(result.failed).toBe('Synthetic serialization failure');
  expect(await savedField(result.bytes)).toBe('Retain this edit');
  expect(result.dirty).toBe(true);
});

test('unfinished native text reports pending recovery without stealing focus, then checkpoints on commit', async ({ page }) => {
  await open(page, 'text-outline.pdf');
  await page.locator('.textLayer span').first().waitFor();
  await page.evaluate(() => window.readerController.setTool('text'));
  await page.locator('.annotationEditorLayer').first().click({ position: { x: 150, y: 300 } });
  const editor = page.locator('.freeTextEditor .internal');
  await editor.fill('Unfinished annotation draft');
  await expect.poll(() => page.evaluate(() => window.readerController.state.checkpointPending)).toBe(true);
  const pending = await page.evaluate(async () => {
    const focused = document.activeElement;
    const errorName = await window.readerController.createCheckpoint().then(() => '', error => error.name);
    return { errorName, keptFocus: document.activeElement === focused, dirty: window.readerController.dirty };
  });
  expect(pending).toEqual({ errorName: 'CheckpointDeferredError', keptFocus: true, dirty: true });
  await editor.blur();
  await expect.poll(() => page.evaluate(() => window.readerController.state.checkpointPending)).toBe(false);
  const bytes = await page.evaluate(async () => [...(await window.readerController.createCheckpoint()).bytes]);
  const document = await PDFDocument.load(new Uint8Array(bytes));
  const annotations = document.getPage(0).node.Annots()!.asArray().map(ref => document.context.lookup(ref, PDFDict));
  const text = annotations.map(annotation => annotation.get(PDFName.of('Contents'))).filter(value => value instanceof PDFString || value instanceof PDFHexString).map(value => (value as PDFString | PDFHexString).decodeText());
  expect(text).toContain('Unfinished annotation draft');
});

test('encrypted recovery retains the exact encrypted source and does not include a password', async ({ page }) => {
  const source = await open(page, 'encrypted.pdf', 'folio-test');
  const result = await page.evaluate(async () => {
    const checkpoint = await window.readerController.createCheckpoint();
    return { ...checkpoint, bytes: [...checkpoint.bytes], keys: Object.keys(checkpoint) };
  });
  expect(Buffer.from(result.bytes).equals(source)).toBe(true);
  expect(result.modified).toBe(false);
  expect(result.keys.sort()).toEqual(['bytes', 'fingerprint', 'modified', 'revision']);
});

test('closing a document cancels an in-flight snapshot and rejects queued snapshots safely', async ({ page }) => {
  await open(page);
  await page.locator('input[name="reader_name"]').fill('Do not persist after closing');
  const outcomes = await page.evaluate(async () => {
    const controller = window.readerController;
    const doc = controller.pdfDocument!;
    const originalSave = doc.saveDocument.bind(doc);
    let release!: () => void;
    let began!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { began = resolve; });
    doc.saveDocument = async () => {
      const result = await originalSave();
      began();
      await gate;
      return result;
    };
    const first = controller.createCheckpoint().then(() => 'unexpected success', error => error.message);
    await started;
    const second = controller.createCheckpoint().then(() => 'unexpected success', error => error.message);
    await controller.destroy();
    release();
    return Promise.all([first, second]);
  });
  expect(outcomes).toEqual(['The document was closed before its copy finished.', 'No document is open.']);
});

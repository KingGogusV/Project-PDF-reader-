import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { getDocument, AnnotationType, PermissionFlag, PasswordResponses } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtures = join(root, 'tests', 'fixtures', 'generated');
const hash = data => createHash('sha256').update(data).digest('hex');
const standardFontDataUrl = join(root, 'node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/';
async function bytes(name) { return new Uint8Array(await readFile(join(fixtures, name))); }
async function open(name, options = {}) {
  return getDocument({ data: await bytes(name), standardFontDataUrl, ...options }).promise;
}
async function pageText(doc, number) {
  const content = await (await doc.getPage(number)).getTextContent();
  return content.items.map(item => 'str' in item ? item.str : '').join(' ');
}
async function present(name) { try { await access(join(fixtures, name)); return true; } catch { return false; } }
function widget(fields, name) {
  const result = fields.get(name)?.find(field => field.page >= 0);
  assert.ok(result, `Expected a page widget for ${name}`);
  return result;
}

test('synthetic text, navigation and outlines are parsed by the real PDF engine', async () => {
  const doc = await open('text-outline.pdf');
  try {
    assert.equal(doc.numPages, 3);
    const outline = await doc.getOutline();
    assert.equal(outline.length, 3);
    for (let page = 1; page <= 3; page++) {
      const text = await pageText(doc, page);
      assert.equal(text.match(/amber heron/g)?.length, 1);
      assert.ok(text.includes(`UniqueToken${page}`));
      assert.equal(await doc.getPageIndex(outline[page - 1].dest[0]), page - 1);
    }
  } finally { await doc.loadingTask.destroy(); }
});

test('demo has four pages, distinct outline targets and actual interactive widgets', async () => {
  const doc = await open('demo.pdf');
  try {
    assert.equal(doc.numPages, 4);
    assert.equal((await doc.getOutline()).length, 4);
    let hits = 0;
    for (let n = 1; n <= 4; n++) hits += (await pageText(doc, n)).match(/amber heron/g)?.length ?? 0;
    assert.equal(hits, 3);
    const fields = await doc.getFieldObjects();
    assert.deepEqual([...fields.keys()].sort(), ['approved', 'notes', 'reader_name', 'review_status']);
    const page3 = await doc.getPage(3);
    assert.equal((await page3.getAnnotations()).filter(item => item.annotationType === AnnotationType.WIDGET).length, 4);
    assert.equal(hash(await readFile(join(root, 'public/demo.pdf'))), hash(await bytes('demo.pdf')));
  } finally { await doc.loadingTask.destroy(); }
});

test('form export round-trip retains field values and unrelated content', async () => {
  const input = await bytes('form.pdf');
  const originalHash = hash(input);
  const doc = await getDocument({ data: input.slice(), standardFontDataUrl }).promise;
  try {
    const fields = await doc.getFieldObjects();
    assert.deepEqual([...fields.keys()].sort(), ['approved', 'notes', 'reader_name', 'review_status']);
    doc.annotationStorage.setValue(widget(fields, 'reader_name').id, { value: 'Synthetic Reviewer' });
    doc.annotationStorage.setValue(widget(fields, 'notes').id, { value: 'First line\nSecond line' });
    doc.annotationStorage.setValue(widget(fields, 'approved').id, { value: true });
    doc.annotationStorage.setValue(widget(fields, 'review_status').id, { value: 'Ready to share' });
    const output = await doc.saveDocument();
    const reopened = await getDocument({ data: output.slice(), standardFontDataUrl }).promise;
    try {
      const savedFields = await reopened.getFieldObjects();
      assert.equal(widget(savedFields, 'reader_name').value, 'Synthetic Reviewer');
      assert.equal(widget(savedFields, 'notes').value, 'First line\nSecond line');
      assert.notEqual(widget(savedFields, 'approved').value, 'Off');
      assert.deepEqual(widget(savedFields, 'review_status').value, 'Ready to share');
      assert.ok((await pageText(reopened, 1)).includes('FormBaselineToken'));
      assert.equal(reopened.numPages, 1);
      const independent = await PDFDocument.load(output);
      assert.equal(independent.getForm().getTextField('reader_name').getText(), 'Synthetic Reviewer');
      assert.equal(independent.getForm().getCheckBox('approved').isChecked(), true);
      assert.deepEqual(independent.getForm().getDropdown('review_status').getSelected(), ['Ready to share']);
    } finally { await reopened.loadingTask.destroy(); }
    assert.equal(hash(await bytes('form.pdf')), originalHash, 'input fixture was not overwritten');
  } finally { await doc.loadingTask.destroy(); }
});

test('existing markup types are present for preservation tests', async () => {
  const doc = await open('annotations.pdf');
  try {
    const annotations = await (await doc.getPage(1)).getAnnotations();
    const types = new Set(annotations.map(item => item.annotationType));
    for (const type of [AnnotationType.HIGHLIGHT, AnnotationType.UNDERLINE, AnnotationType.STRIKEOUT, AnnotationType.TEXT, AnnotationType.INK, AnnotationType.FREETEXT]) assert.ok(types.has(type));
  } finally { await doc.loadingTask.destroy(); }
});

test('shared-field fixture exposes two text widgets and one exclusive radio group', async () => {
  const doc = await open('multi-widget.pdf');
  try {
    assert.equal(doc.numPages, 1);
    const fields = await doc.getFieldObjects();
    assert.deepEqual([...fields.keys()].sort(), ['shared_choice', 'shared_name']);
    const names = fields.get('shared_name').filter(field => field.page >= 0);
    assert.equal(names.length, 2);
    assert.equal(new Set(names.map(field => field.id)).size, 2);
    assert.ok(names.every(field => field.type === 'text'));
    const choices = fields.get('shared_choice').filter(field => field.page >= 0);
    assert.equal(choices.length, 2);
    assert.ok(choices.every(field => field.type === 'radiobutton'));
    assert.ok((await pageText(doc, 1)).includes('WidgetBaselineToken'));
    const independent = await PDFDocument.load(await bytes('multi-widget.pdf'));
    assert.deepEqual(independent.getForm().getRadioGroup('shared_choice').getOptions(), ['Alpha', 'Beta']);
    assert.equal(independent.getForm().getRadioGroup('shared_choice').getSelected(), 'Alpha');
  } finally { await doc.loadingTask.destroy(); }
});

test('mixed page sizes and rotations preserve their intrinsic dimensions', async () => {
  const doc = await open('mixed-pages.pdf');
  try {
    const expected = [[612, 792, 0], [792, 612, 90], [300, 500, 180], [420, 420, 270]];
    for (let i = 0; i < expected.length; i++) {
      const page = await doc.getPage(i + 1);
      assert.deepEqual([page.view[2], page.view[3], page.rotate], expected[i]);
      const viewport = page.getViewport({ scale: 1 });
      assert.ok(viewport.width > 0 && viewport.height > 0);
    }
  } finally { await doc.loadingTask.destroy(); }
});

test('scanned fixture has image operators and no invented text layer', async () => {
  const doc = await open('scanned.pdf');
  try {
    const page = await doc.getPage(1);
    assert.equal((await page.getTextContent()).items.length, 0);
    assert.ok((await page.getOperatorList()).fnArray.length > 0);
  } finally { await doc.loadingTask.destroy(); }
});

test('large fixture supports first/last-page access and final-page search', async () => {
  const doc = await open('large.pdf');
  try {
    assert.equal(doc.numPages, 200);
    assert.ok((await pageText(doc, 1)).includes('page 1 of 200'));
    assert.ok((await pageText(doc, 200)).includes('LastPageNeedle'));
  } finally { await doc.loadingTask.destroy(); }
});

test('malformed and non-PDF input reject with parser errors', async () => {
  for (const name of ['malformed.pdf', 'unsupported.txt']) {
    await assert.rejects(() => open(name), error => error.name === 'InvalidPDFException');
  }
});

test('signature fixture is an unsigned signature field, never a claimed valid signature', async () => {
  const doc = await open('unsigned-signature.pdf');
  try {
    const fields = await doc.getFieldObjects();
    assert.equal(fields.get('signature_placeholder')[0].type, 'signature');
    const annotations = await (await doc.getPage(1)).getAnnotations();
    assert.ok(annotations.some(item => item.fieldType === 'Sig'));
  } finally { await doc.loadingTask.destroy(); }
});

test('hostile-action fixture is parsed without executing scripts or launch actions', async () => {
  const doc = await open('hostile-actions.pdf');
  try {
    assert.ok((await pageText(doc, 1)).includes('must never execute'));
    const actions = await doc.getJSActions();
    assert.ok(JSON.stringify([...actions.values()]).includes('PDF_SCRIPT_MUST_NOT_EXECUTE'));
    const annotations = await (await doc.getPage(1)).getAnnotations();
    assert.ok(annotations.every(item => !item.url || !item.url.startsWith('javascript:')));
  } finally { await doc.loadingTask.destroy(); }
});

test('encrypted fixture requires the correct password and remains searchable', async t => {
  if (!await present('encrypted.pdf')) return t.skip('optional Python pypdf encryption fixture unavailable');
  await assert.rejects(() => open('encrypted.pdf'), error => error.name === 'PasswordException' && error.code === PasswordResponses.NEED_PASSWORD);
  await assert.rejects(() => open('encrypted.pdf', { password: 'incorrect' }), error => error.name === 'PasswordException' && error.code === PasswordResponses.INCORRECT_PASSWORD);
  const doc = await open('encrypted.pdf', { password: 'folio-test' });
  try { assert.ok((await pageText(doc, 1)).includes('amber heron')); } finally { await doc.loadingTask.destroy(); }
});

test('restricted fixture advertises print-only usage permissions', async t => {
  if (!await present('restricted.pdf')) return t.skip('optional Python pypdf encryption fixture unavailable');
  const doc = await open('restricted.pdf');
  try {
    const permissions = await doc.getPermissions();
    assert.ok(permissions.has(PermissionFlag.PRINT));
    assert.ok(!permissions.has(PermissionFlag.COPY));
    assert.ok(!permissions.has(PermissionFlag.MODIFY_ANNOTATIONS));
    assert.ok(!permissions.has(PermissionFlag.FILL_INTERACTIVE_FORMS));
  } finally { await doc.loadingTask.destroy(); }
});

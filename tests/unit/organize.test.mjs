import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { organizePdf, OrganizationError } from '../../src/core/organize.ts';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/');
const options = { standardFontDataUrl: `${root}node_modules/pdfjs-dist/standard_fonts/` };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = async name => ({ name, bytes: new Uint8Array(await readFile(new URL(`../fixtures/generated/${name}`, import.meta.url))) });

async function synthetic(name = 'source.pdf', pageCount = 3, modify) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = document.addPage([300 + i * 10, 400 + i * 20]);
    page.drawText(`${name} retained text page ${i + 1}`, { x: 18, y: 180, size: 13, font });
    page.drawRectangle({ x: 21 + i, y: 28, width: 45, height: 61, color: rgb(i % 2, 0.3, 0.8) });
    page.setRotation(degrees(i % 4 * 90));
  }
  await modify?.(document);
  return { name, bytes: await document.save() };
}

async function inspect(bytes) {
  const doc = await getDocument({ data: bytes.slice(), ...options }).promise;
  try {
    const pages = [];
    for (let index = 1; index <= doc.numPages; index++) {
      const page = await doc.getPage(index);
      pages.push({ text: (await page.getTextContent()).items.map(item => item.str || '').join(''), view: page.view, rotation: page.rotate });
    }
    return pages;
  } finally { await doc.loadingTask.destroy(); }
}

test('extract creates selected pages in requested order and leaves input bytes intact', async () => {
  const source = await synthetic();
  const original = hash(source.bytes);
  const before = await inspect(source.bytes);
  const output = await organizePdf([source], { kind: 'extract', pages: [3, 1] }, options);
  assert.equal(output.name, 'source-extract.pdf');
  assert.equal(output.pageCount, 2);
  assert.deepEqual(await inspect(output.bytes), [before[2], before[0]]);
  assert.equal(hash(source.bytes), original);
  assert.deepEqual(output.verification, { engine: 'PDF.js', pages: 2, text: true, geometry: true, rotation: true, renderedPixels: true, renderMaxDimension: 512 });
});

test('reorder requires every page and verifies all retained content independently', async () => {
  const source = await synthetic();
  const before = await inspect(source.bytes);
  const output = await organizePdf([source], { kind: 'reorder', pages: [2, 3, 1] }, options);
  assert.deepEqual(await inspect(output.bytes), [before[1], before[2], before[0]]);
  const independentWriterParse = await PDFDocument.load(output.bytes);
  assert.equal(independentWriterParse.getPageCount(), 3);
});

test('delete removes only selected pages and rejects deleting every page', async () => {
  const source = await synthetic();
  const before = await inspect(source.bytes);
  const output = await organizePdf([source], { kind: 'delete', pages: [2] }, options);
  assert.deepEqual(await inspect(output.bytes), [before[0], before[2]]);
  await assert.rejects(organizePdf([source], { kind: 'delete', pages: [1, 2, 3] }, options), /Keep at least one page/);
});

test('permanent rotation composes existing rotation without changing page boxes or content', async () => {
  const source = await synthetic();
  const before = await inspect(source.bytes);
  const output = await organizePdf([source], { kind: 'rotate', pages: [1, 3], degrees: 270 }, options);
  const expected = before.map((page, index) => ({ ...page, rotation: index === 1 ? page.rotation : (page.rotation + 270) % 360 }));
  assert.deepEqual(await inspect(output.bytes), expected);
  assert.equal(output.verification.renderedPixels, true);
});

test('merge preserves ordered text, vectors, page sizes and rotations from both inputs', async () => {
  const first = await synthetic('first.pdf', 2);
  const second = await synthetic('second.pdf', 1);
  const originals = [hash(first.bytes), hash(second.bytes)];
  const output = await organizePdf([first, second], { kind: 'merge' }, options);
  assert.deepEqual(await inspect(output.bytes), [...await inspect(first.bytes), ...await inspect(second.bytes)]);
  assert.deepEqual([hash(first.bytes), hash(second.bytes)], originals);
  assert.equal(output.name, 'merged-merge.pdf');
});

test('image-only scanned pages retain rendered pixels through extraction and merge', async () => {
  const scan = await fixture('scanned.pdf');
  const text = await synthetic('plain.pdf', 1);
  const out = await organizePdf([scan, text], { kind: 'merge' }, options);
  const pages = await inspect(out.bytes);
  assert.equal(pages[0].text, '');
  assert.match(pages[1].text, /plain.pdf retained text/);
  assert.equal(out.verification.renderedPixels, true);
});

test('crop, bleed, trim, art and media boxes survive copying and permanent rotation', async () => {
  const source = await synthetic('boxes.pdf', 1, doc => {
    const page = doc.getPage(0);
    page.setCropBox(10, 20, 270, 350);
    page.setBleedBox(5, 10, 280, 370);
    page.setTrimBox(15, 25, 260, 340);
    page.setArtBox(20, 30, 250, 330);
    page.node.set(PDFName.of('UserUnit'), doc.context.obj(2));
  });
  const output = await organizePdf([source], { kind: 'rotate', pages: [1], degrees: 90 }, options);
  const [before] = await inspect(source.bytes);
  const [after] = await inspect(output.bytes);
  assert.deepEqual(after.view, before.view);
  assert.equal(after.rotation, 90);
  const saved = (await PDFDocument.load(output.bytes)).getPage(0);
  assert.deepEqual(saved.getCropBox(), { x: 10, y: 20, width: 270, height: 350 });
  assert.deepEqual(saved.getBleedBox(), { x: 5, y: 10, width: 280, height: 370 });
  assert.deepEqual(saved.getTrimBox(), { x: 15, y: 25, width: 260, height: 340 });
  assert.deepEqual(saved.getArtBox(), { x: 20, y: 30, width: 250, height: 330 });
});

test('bounded operation input validation refuses ambiguous or out-of-range page selections', async () => {
  const source = await synthetic();
  for (const pages of [[], [0], [-1], [4], [1.5], [NaN], [1, 1]]) {
    await assert.rejects(organizePdf([source], { kind: 'extract', pages }, options), OrganizationError);
  }
  await assert.rejects(organizePdf([source], { kind: 'reorder', pages: [1, 2] }, options), /every page exactly once/);
  await assert.rejects(organizePdf([source], { kind: 'rotate', pages: [1], degrees: 45 }, options), /90, 180 or 270/);
  await assert.rejects(organizePdf([source], { kind: 'merge' }, options), /at least two/);
  await assert.rejects(organizePdf([source, source], { kind: 'extract', pages: [1] }, options), /exactly one/);
  await assert.rejects(organizePdf([source], { kind: 'replace', pages: [1] }, options), /supported page operation/);
});

test('size, document-count and source-page bounds reject before an unsafe result', async () => {
  const source = await synthetic('one.pdf', 1);
  await assert.rejects(organizePdf([], { kind: 'merge' }, options), /between 1 and 10/);
  await assert.rejects(organizePdf(Array(11).fill(source), { kind: 'merge' }, options), /between 1 and 10/);
  await assert.rejects(organizePdf([{ name: 'too-large.pdf', bytes: new Uint8Array(50 * 1024 * 1024 + 1) }], { kind: 'extract', pages: [1] }, options), /50 MiB/);
  const many = await synthetic('many.pdf', 501);
  await assert.rejects(organizePdf([many], { kind: 'extract', pages: [1] }, options), /between 1 and 500/);
});

for (const name of ['encrypted.pdf', 'restricted.pdf', 'form.pdf', 'annotations.pdf', 'unsigned-signature.pdf', 'multi-widget.pdf', 'text-outline.pdf', 'hostile-actions.pdf']) {
  test(`preflight refuses ${name} without changing its bytes`, async () => {
    const source = await fixture(name);
    const original = hash(source.bytes);
    await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, options), error => error instanceof OrganizationError && error.code === 'unsupported');
    assert.equal(hash(source.bytes), original);
  });
}

test('preflight refuses annotations on an omitted page and does not silently flatten them', async () => {
  const source = await synthetic('annotation-later.pdf', 2, doc => {
    doc.getPage(1).node.set(PDFName.of('Annots'), doc.context.obj([doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [0, 0, 20, 20] })]));
  });
  await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, options), /annotations|Annotations/);
});

test('preflight catches orphan signature dictionaries, tagged structure, XFA and layers', async () => {
  for (const modify of [
    doc => doc.context.register(doc.context.obj({ Type: 'Sig', ByteRange: [0, 1, 2, 3] })),
    doc => doc.catalog.set(PDFName.of('StructTreeRoot'), doc.context.obj({ Type: 'StructTreeRoot' })),
    doc => doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ XFA: doc.context.stream('<xdp/>') })),
    doc => doc.catalog.set(PDFName.of('OCProperties'), doc.context.obj({ OCGs: [] })),
    doc => doc.catalog.set(PDFName.of('Threads'), doc.context.obj([])),
  ]) {
    const source = await synthetic('unsafe-structure.pdf', 1, modify);
    await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, options), error => error instanceof OrganizationError && error.code === 'unsupported');
  }
});

test('corrupt or non-PDF input fails closed with an original-preservation message', async () => {
  for (const name of ['malformed.pdf', 'unsupported.txt']) {
    const source = await fixture(name);
    await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, options), /could not be safely organized.*original files have not changed/);
  }
});

test('asynchronous processing uses an immutable input and operation snapshot', async () => {
  const source = await synthetic();
  const before = await inspect(source.bytes);
  const operation = { kind: 'extract', pages: [3, 1] };
  const promise = organizePdf([source], operation, options);
  source.bytes.fill(0);
  operation.pages.splice(0, 2, 2);
  assert.deepEqual(await inspect((await promise).bytes), [before[2], before[0]]);
});

test('cancellation rejects without returning partially verified bytes', async () => {
  const source = await synthetic();
  const controller = new AbortController();
  const pending = organizePdf([source], { kind: 'reorder', pages: [3, 2, 1] }, { ...options, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, { ...options, signal: controller.signal }), error => error.name === 'AbortError');
});

test('independent text and pixel verification refuses a writer that drops or changes content', async () => {
  const source = await synthetic();
  const originalCopy = PDFDocument.prototype.copyPages;
  try {
    PDFDocument.prototype.copyPages = async function (...args) {
      const copied = await originalCopy.apply(this, args);
      copied[0].drawRectangle({ x: 0, y: 0, width: 300, height: 400, color: rgb(0, 0, 0) });
      return copied;
    };
    await assert.rejects(organizePdf([source], { kind: 'extract', pages: [1] }, options), /did not preserve.*rendered appearance/);
  } finally { PDFDocument.prototype.copyPages = originalCopy; }
});

test('metadata omission is explicit and unsafe output filename characters are removed', async () => {
  const source = await synthetic('../private:report.pdf', 1, doc => doc.setAuthor('Synthetic author'));
  const output = await organizePdf([source], { kind: 'extract', pages: [1] }, options);
  assert.ok(output.notes.some(note => note.includes('metadata are not copied')));
  assert.doesNotMatch(output.name, /[/\\:]/);
  assert.equal((await PDFDocument.load(output.bytes)).getAuthor(), undefined);
});

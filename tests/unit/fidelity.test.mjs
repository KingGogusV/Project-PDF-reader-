import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, writeFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash, createVerify } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const folder = join(root, 'tests/fixtures/generated');
const require = createRequire(import.meta.resolve('pdfjs-dist/package.json'));
const { createCanvas } = require('@napi-rs/canvas');
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = async name => new Uint8Array(await readFile(join(folder, name)));
const options = { standardFontDataUrl: join(root, 'node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/' };
const open = async data => getDocument({ data: data.slice(), ...options }).promise;
async function render(doc, pageNo) {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

test('embedded multilingual text uses actual embedded fonts and extracts meaningful Unicode', async () => {
  const input = await bytes('embedded-multilingual.pdf');
  const structural = await PDFDocument.load(input);
  const resources = structural.getPage(0).node.Resources();
  const fontDict = resources.lookup(PDFName.of('Font'));
  assert.equal(new Set(fontDict.keys().map(key => fontDict.get(key).toString())).size, 3);
  for (const key of fontDict.keys()) {
    const font = fontDict.lookup(key);
    assert.equal(font.get(PDFName.of('Subtype')).toString(), '/Type0');
    const descendant = font.lookup(PDFName.of('DescendantFonts')).lookup(0);
    const descriptor = descendant.lookup(PDFName.of('FontDescriptor'));
    assert.ok(descriptor.has(PDFName.of('FontFile2')) || descriptor.has(PDFName.of('FontFile3')));
    assert.ok(font.has(PDFName.of('ToUnicode')));
  }
  const doc = await open(input);
  try {
    const textContent = await (await doc.getPage(1)).getTextContent();
    const text = textContent.items.map(item => item.str ?? '').join(' ');
    for (const phrase of ['café', 'Καλημέρα', 'Привет', '日本語', '中文文件', 'FidelityBaselineToken']) assert.ok(text.includes(phrase), `Missing text: ${phrase}`);
    assert.ok(textContent.items.some(item => item.dir === 'rtl' && /[\u0600-\u06ff]/.test(item.str)));
    const pixels = await render(doc, 1);
    let nonwhite = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 220 || pixels[i + 1] < 220 || pixels[i + 2] < 220) nonwhite++;
    assert.ok(nonwhite > 9000, 'embedded glyph rendering must produce a meaningful nonblank page');
  } finally { await doc.loadingTask.destroy(); }
});

test('unrelated image/transparency pages remain pixel-identical after form export', async () => {
  const input = await bytes('transparency-form.pdf');
  const inputHash = hash(input);
  const doc = await open(input);
  try {
    assert.equal(doc.numPages, 4);
    const before = [];
    for (let page = 1; page <= 3; page++) before.push(hash(await render(doc, page)));
    const fields = await doc.getFieldObjects();
    const widget = fields.get('fidelity_note').find(field => field.page === 3);
    assert.ok(widget);
    doc.annotationStorage.setValue(widget.id, { value: 'Verified synthetic update' });
    const output = await doc.saveDocument();
    const reopened = await open(output);
    try {
      const savedFields = await reopened.getFieldObjects();
      assert.equal(savedFields.get('fidelity_note').find(field => field.page === 3).value, 'Verified synthetic update');
      for (let page = 1; page <= 3; page++) assert.equal(hash(await render(reopened, page)), before[page - 1], `Unrelated page ${page} changed pixels`);
      const independent = await PDFDocument.load(output);
      assert.equal(independent.getForm().getTextField('fidelity_note').getText(), 'Verified synthetic update');
      assert.equal(independent.getPageCount(), 4);
    } finally { await reopened.loadingTask.destroy(); }
    assert.equal(hash(await bytes('transparency-form.pdf')), inputHash);
  } finally { await doc.loadingTask.destroy(); }
});

test('synthetic signed fixture has a cryptographically valid detached signature but no trust claim', async t => {
  try { await access(join(folder, 'signed-synthetic.pdf')); } catch { return t.skip('optional Python signature fixture unavailable'); }
  const input = await bytes('signed-synthetic.pdf');
  const proof = JSON.parse(await readFile(join(folder, 'signed-synthetic-proof.json'), 'utf8'));
  assert.equal(hash(input), proof.fileSha256);
  assert.equal(proof.selfSigned, true); assert.equal(proof.trusted, false);
  const [start, firstLength, secondStart, secondLength] = proof.byteRange;
  assert.equal(start, 0); assert.equal(secondStart + secondLength, input.length);
  const text = new TextDecoder('latin1').decode(input);
  const actual = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text).slice(1).map(Number);
  assert.deepEqual(actual, proof.byteRange);
  const contents = text.slice(firstLength + 1, secondStart - 1);
  assert.ok(contents.startsWith(proof.cmsHex));
  assert.ok(proof.cmsHex.includes(proof.signatureHex));
  const signedBytes = Buffer.concat([input.slice(0, firstLength), input.slice(secondStart)]);
  const verifier = createVerify('RSA-SHA256').update(signedBytes);
  assert.equal(verifier.verify(proof.certificatePem, Buffer.from(proof.signatureHex, 'hex')), true);
  const tampered = Buffer.from(signedBytes); tampered[20] ^= 1;
  assert.equal(createVerify('RSA-SHA256').update(tampered).verify(proof.certificatePem, Buffer.from(proof.signatureHex, 'hex')), false);
  const doc = await open(input);
  try { assert.ok((await doc.getSignatures()).length > 0); assert.equal(doc.numPages, 3); }
  finally { await doc.loadingTask.destroy(); }
});

test('independent Poppler renderer preserves all unrelated transparency pages after form save', async t => {
  const bundled = resolve(dirname(process.execPath), '../../native/poppler/Library/bin/pdftoppm.exe');
  const candidates = [process.env.FOLIO_PDFTOPPM, bundled, 'pdftoppm'].filter(Boolean);
  const executable = candidates.find(candidate => spawnSync(candidate, ['-v'], { encoding:'utf8', timeout:10000, windowsHide:true }).status === 0);
  if (!executable) return t.skip('independent Poppler renderer unavailable; set FOLIO_PDFTOPPM');
  const temporary = await mkdtemp(join(tmpdir(), 'folio-fidelity-'));
  const input = await bytes('transparency-form.pdf');
  const doc = await open(input);
  try {
    const fields = await doc.getFieldObjects();
    const id = fields.get('fidelity_note').find(field => field.page === 3).id;
    doc.annotationStorage.setValue(id, {value:'Independent renderer comparison'});
    const changed = await doc.saveDocument();
    await writeFile(join(temporary, 'before.pdf'), input);
    await writeFile(join(temporary, 'after.pdf'), changed);
    for (const state of ['before','after']) {
      const result = spawnSync(executable, ['-f','1','-l','3','-r','72','-png',join(temporary,`${state}.pdf`),join(temporary,state)], {encoding:'utf8',timeout:30000,windowsHide:true});
      assert.equal(result.status, 0, result.stderr);
    }
    for (let page=1;page<=3;page++) assert.equal(hash(await readFile(join(temporary,`before-${page}.png`))),hash(await readFile(join(temporary,`after-${page}.png`))),`Poppler rendering changed on page ${page}`);
  } finally {
    await doc.loadingTask.destroy();
    // Only this freshly-created temporary directory's immediate files are removed.
    for (const name of await readdir(temporary)) await unlink(join(temporary,name));
    await rmdir(temporary);
  }
});

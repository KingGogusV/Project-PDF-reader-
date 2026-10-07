import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { saveNativePdfCopy } from '../../src/platform/native-save.ts';

const token = 'd3b1a271-11c5-4102-a8e1-112244668899';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pdf = size => { const bytes = new Uint8Array(size); bytes.set(new TextEncoder().encode('%PDF-1.7\n')); return bytes; };
function transport(overrides = {}) {
  const calls = [], chunks = [];
  let selection;
  const invoke = async (command, args, options) => {
    calls.push(command);
    if (overrides[command]) return overrides[command](args, options, selection);
    if (command === 'begin_pdf_save') { selection = args; return { token, filename: args.filename }; }
    if (command === 'append_pdf_save') {
      assert.ok(args instanceof Uint8Array);
      assert.ok(args.byteLength <= 1024 * 1024);
      assert.equal(options.headers['x-folio-save-token'], token);
      assert.equal(options.headers['x-folio-save-offset'], String(chunks.reduce((size, chunk) => size + chunk.length, 0)));
      chunks.push(Buffer.from(args));
      return chunks.reduce((size, chunk) => size + chunk.length, 0);
    }
    if (command === 'finish_pdf_save') {
      assert.deepEqual(args, { token });
      assert.equal(hash(Buffer.concat(chunks)), selection.sha256);
      return { filename: selection.filename, byteLength: selection.byteLength, sha256: selection.sha256 };
    }
    if (command === 'cancel_pdf_save') { assert.deepEqual(args, { token }); return; }
    throw new Error('Unexpected native command');
  };
  return { invoke, calls, chunks };
}

test('native Save As transfers bounded exact binary chunks and requires a matching disk receipt', async () => {
  const source = pdf(2 * 1024 * 1024 + 123), native = transport();
  const receipt = await saveNativePdfCopy(source, 'résumé-東京-folio.pdf', native.invoke);
  assert.equal(receipt.sha256, hash(source));
  assert.equal(receipt.byteLength, source.byteLength);
  assert.deepEqual(Buffer.concat(native.chunks), Buffer.from(source));
  assert.equal(native.chunks.length, 3);
  assert.deepEqual(native.calls, ['begin_pdf_save', 'append_pdf_save', 'append_pdf_save', 'append_pdf_save', 'finish_pdf_save']);
});

test('native picker cancellation returns no receipt and does not write any bytes', async () => {
  const native = transport({ begin_pdf_save: () => null });
  assert.equal(await saveNativePdfCopy(pdf(25), 'copy.pdf', native.invoke), null);
  assert.deepEqual(native.calls, ['begin_pdf_save']);
});

test('native export protects the serialized snapshot while an OS dialog is pending', async () => {
  const source = pdf(30), original = source.slice();
  const native = transport({ begin_pdf_save: args => { source.fill(0); return { token, filename: args.filename }; } });
  // Override begin must keep matching receipt metadata for this test.
  let selected;
  const invoke = async (command, args, options) => {
    if (command === 'begin_pdf_save') { selected = args; source.fill(0); return { token, filename: args.filename }; }
    if (command === 'finish_pdf_save') return { filename: selected.filename, byteLength: selected.byteLength, sha256: hash(Buffer.concat(native.chunks)) };
    return native.invoke(command, args, options);
  };
  await saveNativePdfCopy(source, 'copy.pdf', invoke);
  assert.deepEqual(Buffer.concat(native.chunks), Buffer.from(original));
});

test('invalid PDF bytes and unsafe suggestions reject before a native dialog', async () => {
  const native = transport();
  await assert.rejects(saveNativePdfCopy(new Uint8Array(7), 'copy.pdf', native.invoke), /between/);
  await assert.rejects(saveNativePdfCopy(new Uint8Array(9), 'copy.pdf', native.invoke), /header/);
  for (const name of ['../copy.pdf', 'C:\\copy.pdf', 'copy.txt', 'bad\u0000.pdf']) {
    await assert.rejects(saveNativePdfCopy(pdf(12), name, native.invoke), /filename/);
  }
  assert.deepEqual(native.calls, []);
});

test('long Unicode suggestions are shortened without splitting characters or passing paths', async () => {
  const native = transport();
  const receipt = await saveNativePdfCopy(pdf(12), `${'📄'.repeat(100)}.pdf`, native.invoke);
  assert.ok(new TextEncoder().encode(receipt.filename).byteLength <= 204);
  assert.ok(!receipt.filename.includes('\ufffd'));
});

test('a reader-supported header prefix remains byte-identical in the native copy', async () => {
  const source = new TextEncoder().encode('\n%PDF-1.7\nsynthetic prefix test');
  const native = transport();
  const receipt = await saveNativePdfCopy(source, 'copy.pdf', native.invoke);
  assert.equal(receipt.sha256, hash(source));
  assert.deepEqual(Buffer.concat(native.chunks), Buffer.from(source));
});

test('short writes, write errors and invalid receipts fail and cancel the native transaction', async () => {
  for (const overrides of [
    { append_pdf_save: () => 0 },
    { append_pdf_save: () => { throw 'Not enough free space. Choose another drive.'; } },
    { finish_pdf_save: () => ({ filename: 'copy.pdf', byteLength: 12, sha256: '0'.repeat(64) }) },
    { finish_pdf_save: () => null },
  ]) {
    const native = transport(overrides);
    await assert.rejects(saveNativePdfCopy(pdf(12), 'copy.pdf', native.invoke));
    assert.equal(native.calls.at(-1), 'cancel_pdf_save');
  }
});

test('invalid native filenames cancel their valid token while malformed tokens cannot reach a writer', async () => {
  const invalidName = transport({ begin_pdf_save: () => ({ token, filename: '../copy.pdf' }) });
  await assert.rejects(saveNativePdfCopy(pdf(12), 'copy.pdf', invalidName.invoke), /filename/);
  assert.deepEqual(invalidName.calls, ['begin_pdf_save', 'cancel_pdf_save']);
  const invalidToken = transport({ begin_pdf_save: () => ({ token: 'bad-token', filename: 'copy.pdf' }) });
  await assert.rejects(saveNativePdfCopy(pdf(12), 'copy.pdf', invalidToken.invoke), /transaction/);
  assert.deepEqual(invalidToken.calls, ['begin_pdf_save']);
});

test('cleanup errors remain explicit and never return a successful save receipt', async () => {
  const native = transport({ append_pdf_save: () => { throw new Error('Permission denied'); }, cancel_pdf_save: () => { throw new Error('Cleanup denied'); } });
  await assert.rejects(saveNativePdfCopy(pdf(12), 'copy.pdf', native.invoke), /cleanup failed/);
});

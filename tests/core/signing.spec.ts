import { test, expect, type Page } from '@playwright/test';
import { createHash, verify, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber } from 'pdf-lib';
import { fromBER, OctetString } from 'asn1js';
import { ContentInfo, SignedData } from 'pkijs';
import { createCertificateBundle } from './signing-fixtures';
import type * as Signing from '../../src/core/signing';

declare global { interface Window { signing: typeof Signing; signingReady: boolean } }
let identity: Awaited<ReturnType<typeof createCertificateBundle>>;
let source: Uint8Array;

test.beforeAll(async () => {
  identity = await createCertificateBundle();
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText('Certificate preservation test', { x: 35, y: 480 });
  source = await pdf.save({ useObjectStreams: false });
});

async function openHarness(page: Page) {
  await page.goto('/tests/core/signing.html');
  await page.waitForFunction(() => window.signingReady);
}

async function sign(page: Page, bytes: Uint8Array = source) {
  return page.evaluate(async input => {
    const result = await window.signing.signPdfCopy({ pdfBytes: new Uint8Array(input.pdf), p12Bytes: new Uint8Array(input.p12), password: input.password });
    return { ...result, bytes: [...result.bytes] };
  }, { pdf: [...bytes], p12: [...identity.bytes], password: identity.password });
}

async function parseSignature(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const dict = pdf.context.enumerateIndirectObjects().map(([, obj]) => obj)
    .find(object => object instanceof PDFDict && object.has(PDFName.of('ByteRange'))) as PDFDict;
  const range = dict.lookup(PDFName.of('ByteRange'), PDFArray).asArray().map(value => (value as PDFNumber).asNumber());
  const contents = dict.lookup(PDFName.of('Contents'), PDFHexString).asBytes();
  const cms = new SignedData({ schema: new ContentInfo({ schema: fromBER(contents).result }).content });
  return { cms, range, pdf };
}

test('local RSA P12 produces a byte-preserving copy independently verified by Node crypto', async ({ page }) => {
  await openHarness(page);
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5176/')) external.push(request.url()); });
  const result = await sign(page);
  expect(result.verification).toEqual({ integrity: 'verified', trust: 'not-verified', revocation: 'not-checked', timestamp: 'not-requested' });
  expect(result.certificate).toMatchObject({ subject: 'CN=Folio Synthetic Test Only', keyAlgorithm: 'RSA', keyBits: 2048 });
  expect(result.certificate.fingerprintSha256).toBe(createHash('sha256').update(identity.certificate).digest('hex').toUpperCase());
  const bytes = new Uint8Array(result.bytes);
  expect(Buffer.from(bytes.subarray(0, source.length)).equals(Buffer.from(source))).toBe(true);
  const { cms, range, pdf } = await parseSignature(bytes);
  const info = cms.signerInfos[0];
  const actualData = Buffer.concat([bytes.subarray(0, range[1]), bytes.subarray(range[2], range[2] + range[3])]);
  const digest = info.signedAttrs!.attributes.find(attr => attr.type === '1.2.840.113549.1.9.4')!.values[0] as OctetString;
  expect(Buffer.from(digest.valueBlock.valueHexView).equals(createHash('sha256').update(actualData).digest())).toBe(true);
  const attributes = new Uint8Array(info.signedAttrs!.encodedValue);
  attributes[0] = 0x31; // CMS signs the DER SET OF encoding, not its context-specific wrapper.
  expect(verify('sha256', attributes, new X509Certificate(identity.certificate).publicKey, info.signature.valueBlock.valueHexView)).toBe(true);
  expect(pdf.getPageCount()).toBe(1);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('inspection returns public metadata only and preserves caller-owned certificate bytes', async ({ page }) => {
  await openHarness(page);
  const result = await page.evaluate(async input => {
    const bytes = new Uint8Array(input.bytes);
    const summary = await window.signing.inspectSigningCertificate(bytes, input.password);
    return { summary, unmodified: bytes.every((value, index) => value === input.bytes[index]) };
  }, { bytes: [...identity.bytes], password: identity.password });
  expect(result.unmodified).toBe(true);
  expect(Object.keys(result.summary).sort()).toEqual(['subject', 'issuer', 'serialNumber', 'validFrom', 'validUntil', 'fingerprintSha256', 'keyAlgorithm', 'keyBits'].sort());
});

test('content tampering, signature tampering and trailing unsigned bytes are rejected', async ({ page }) => {
  await openHarness(page);
  const signed = new Uint8Array((await sign(page)).bytes);
  const { cms, range } = await parseSignature(signed);
  const changedHeader = signed.slice();
  changedHeader[7] = changedHeader[7] === 55 ? 54 : 55; // Valid PDF version edit, but no longer signed bytes.
  const changedSignature = signed.slice();
  const signatureHex = Buffer.from(cms.signerInfos[0].signature.valueBlock.valueHexView).toString('hex').toUpperCase();
  const gap = Buffer.from(signed.subarray(range[1], range[2])).toString('ascii').toUpperCase();
  const signaturePosition = gap.indexOf(signatureHex);
  expect(signaturePosition).toBeGreaterThan(0);
  changedSignature[range[1] + signaturePosition] = changedSignature[range[1] + signaturePosition] === 48 ? 49 : 48;
  const appended = new Uint8Array([...signed, 10, 37, 37, 69, 79, 70, 10]);
  for (const bytes of [changedHeader, changedSignature, appended]) {
    const code = await page.evaluate(async input => {
      try { await window.signing.verifySignedPdfCopy(new Uint8Array(input)); return 'accepted'; }
      catch (error) { return (error as Signing.SigningError).code; }
    }, [...bytes]);
    expect(code).toBe('verification');
  }
});

test('wrong passwords and malformed bundles expose safe errors without leaking credentials', async ({ page }) => {
  await openHarness(page);
  for (const data of [identity.bytes, new Uint8Array([1, 2, 3, 4])]) {
    const result = await page.evaluate(async input => {
      try { await window.signing.inspectSigningCertificate(new Uint8Array(input), 'never-echo-this-password'); return { code: 'accepted', message: '' }; }
      catch (error) { const failure = error as Signing.SigningError; return { code: failure.code, message: failure.message }; }
    }, [...data]);
    expect(result.code).toBe('certificate');
    expect(result.message).not.toContain('never-echo-this-password');
  }
});

test('expired, future, mismatched, non-signing and EC certificates fail closed', async ({ page }) => {
  await openHarness(page);
  for (const options of [{ expired: true }, { future: true }, { mismatch: true }, { usage: 0x20 }, { ec: true }]) {
    const bundle = await createCertificateBundle(options);
    const code = await page.evaluate(async input => {
      try { await window.signing.inspectSigningCertificate(new Uint8Array(input.bytes), input.password); return 'accepted'; }
      catch (error) { return (error as Signing.SigningError).code; }
    }, { bytes: [...bundle.bytes], password: bundle.password });
    expect(code).toBe(options.ec ? 'unsupported' : 'certificate');
  }
});

test('encrypted, restricted, signed and empty signature-field PDFs are refused', async ({ page }) => {
  await openHarness(page);
  for (const filename of ['encrypted.pdf', 'restricted.pdf', 'signed-synthetic.pdf', 'unsigned-signature.pdf']) {
    const bytes = await readFile(new URL(`../fixtures/generated/${filename}`, import.meta.url));
    const code = await page.evaluate(async input => {
      try { await window.signing.signPdfCopy({ pdfBytes: new Uint8Array(input.pdf), p12Bytes: new Uint8Array(input.p12), password: input.password }); return 'accepted'; }
      catch (error) { return (error as Signing.SigningError).code; }
    }, { pdf: [...bytes], p12: [...identity.bytes], password: identity.password });
    expect(code, filename).toBe('unsupported');
  }
});

test('signing preserves filled AcroForm values and widget appearances', async ({ page }) => {
  await openHarness(page);
  const original = await PDFDocument.load(await readFile(new URL('../fixtures/generated/form.pdf', import.meta.url)));
  original.getForm().getTextField('reader_name').setText('Signed form value');
  const form = await original.save();
  const result = await sign(page, form);
  const signed = await PDFDocument.load(new Uint8Array(result.bytes));
  expect(signed.getForm().getTextField('reader_name').getText()).toBe('Signed form value');
  expect(signed.getForm().getFields().length).toBe(original.getForm().getFields().length + 1);
});

test('linearized input, duplicate field names and resource caps are rejected before returning a copy', async ({ page }) => {
  await openHarness(page);
  const linearized = await PDFDocument.load(source);
  const firstDict = linearized.context.enumerateIndirectObjects().find(([, value]) => value instanceof PDFDict)![1] as PDFDict;
  firstDict.set(PDFName.of('Linearized'), PDFNumber.of(1));
  const form = await PDFDocument.load(source);
  form.getForm().createTextField('FolioCertificateSignature').addToPage(form.getPage(0));
  const candidates = [{ bytes: await linearized.save({ useObjectStreams: false }), code: 'unsupported' },
    { bytes: await form.save(), code: 'input' }, { bytes: new Uint8Array(20 * 1024 * 1024 + 1), code: 'input' }];
  for (const candidate of candidates) {
    const code = await page.evaluate(async input => {
      try { await window.signing.signPdfCopy({ pdfBytes: input.oversized ? new Uint8Array(20 * 1024 * 1024 + 1) : new Uint8Array(input.pdf), p12Bytes: new Uint8Array(input.p12), password: input.password }); return 'accepted'; }
      catch (error) { return (error as Signing.SigningError).code; }
    }, { pdf: candidate.bytes.length > 20 * 1024 * 1024 ? [] : [...candidate.bytes], oversized: candidate.bytes.length > 20 * 1024 * 1024,
      p12: [...identity.bytes], password: identity.password });
    expect(code).toBe(candidate.code);
  }
});

test('cancelling an inspection terminates the worker without clearing caller input', async ({ page }) => {
  await openHarness(page);
  const result = await page.evaluate(async input => {
    const controller = new AbortController(), bytes = new Uint8Array(input.bytes);
    const pending = window.signing.inspectSigningCertificate(bytes, input.password, controller.signal);
    controller.abort();
    const code = await pending.then(() => 'accepted', (error: Signing.SigningError) => error.code);
    return { code, unchanged: bytes.every((value, index) => value === input.bytes[index]) };
  }, { bytes: [...identity.bytes], password: identity.password });
  expect(result).toEqual({ code: 'cancelled', unchanged: true });
});

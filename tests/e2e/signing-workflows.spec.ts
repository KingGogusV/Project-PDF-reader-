import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash, verify, X509Certificate } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber } from 'pdf-lib';
import { fromBER, OctetString } from 'asn1js';
import { ContentInfo, SignedData } from 'pkijs';
import { createCertificateBundle } from '../core/signing-fixtures';

let identity: Awaited<ReturnType<typeof createCertificateBundle>>;
const fixture = fileURLToPath(new URL('../fixtures/generated/form.pdf', import.meta.url));
const runtime = new WeakMap<Page, { exceptions: string[]; external: string[] }>();

test.beforeAll(async () => { identity = await createCertificateBundle(); });

test.beforeEach(async ({ page, context, baseURL }) => {
  const evidence = { exceptions: [] as string[], external: [] as string[] };
  runtime.set(page, evidence);
  page.on('pageerror', error => evidence.exceptions.push(error.message));
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseURL!).origin) evidence.external.push(request.url());
  });
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await chooser).setFiles(fixture);
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('.document-host:not([hidden]) .page').first()).toHaveAttribute('data-loaded', 'true');
});

test.afterEach(async ({ page }, testInfo) => {
  const evidence = runtime.get(page)!;
  await testInfo.attach('signing-runtime-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.exceptions, 'No uncaught browser errors').toEqual([]);
  expect(evidence.external, 'No document/certificate requests leave this origin').toEqual([]);
});

async function certificateDialog(page: Page, password = identity.password) {
  await page.locator('#document-tools').click();
  await page.locator('#document-tool-sign').click();
  await expect(page.locator('#dialog-title')).toHaveText('Sign with certificate');
  await page.locator('#sign-certificate').setInputFiles({ name: 'synthetic-test-identity.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from(identity.bytes) });
  await page.locator('#sign-password').fill(password);
}

async function verifyDownloadedPdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);
  const signatures = document.context.enumerateIndirectObjects().map(([, object]) => object)
    .filter(object => object instanceof PDFDict && object.has(PDFName.of('ByteRange'))) as PDFDict[];
  expect(signatures).toHaveLength(1);
  const dictionary = signatures[0];
  const range = dictionary.lookup(PDFName.of('ByteRange'), PDFArray).asArray().map(value => (value as PDFNumber).asNumber());
  expect(range[0]).toBe(0);
  expect(range[2] + range[3]).toBe(bytes.length);
  const cmsBytes = dictionary.lookup(PDFName.of('Contents'), PDFHexString).asBytes();
  const cms = new SignedData({ schema: new ContentInfo({ schema: fromBER(cmsBytes).result }).content });
  expect(cms.signerInfos).toHaveLength(1);
  const signer = cms.signerInfos[0];
  const covered = Buffer.concat([bytes.subarray(0, range[1]), bytes.subarray(range[2])]);
  const digest = signer.signedAttrs!.attributes.find(attribute => attribute.type === '1.2.840.113549.1.9.4')!.values[0] as OctetString;
  expect(Buffer.from(digest.valueBlock.valueHexView).equals(createHash('sha256').update(covered).digest())).toBe(true);
  const attributes = new Uint8Array(signer.signedAttrs!.encodedValue);
  attributes[0] = 0x31;
  expect(verify('sha256', attributes, new X509Certificate(identity.certificate).publicKey, signer.signature.valueBlock.valueHexView)).toBe(true);
  return document;
}

test('reviews a certificate, signs edited form data, downloads and reopens a verified protected copy', async ({ page }, testInfo) => {
  await page.locator('input[name="reader_name"]').fill('Signed through the Folio interface');
  await page.locator('input[name="approved"]').check();
  await certificateDialog(page);
  await expect(page.locator('#sign-start')).toBeDisabled();
  await page.locator('#sign-inspect').click();
  await expect(page.locator('#sign-summary')).toContainText('Folio Synthetic Test Only');
  await expect(page.locator('#sign-status')).toContainText('Trust and revocation remain unverified');
  await expect(page.locator('#sign-start')).toBeEnabled();
  await page.locator('#sign-start').click();
  await expect(page.locator('#sign-status')).toContainText('Signed copy ready', { timeout: 30_000 });
  await expect(page.locator('#sign-status')).toContainText('no trusted timestamp');
  await expect(page.locator('#sign-password')).toHaveValue('');
  await expect(page.locator('#sign-certificate')).toHaveValue('');
  const event = page.waitForEvent('download');
  await page.locator('#sign-download').click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('form-signed-folio.pdf');
  const savedPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(savedPath);
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(savedPath), original = await readFile(fixture);
  expect(bytes.subarray(0, original.length).equals(original)).toBe(true);
  const signed = await verifyDownloadedPdf(bytes);
  expect(signed.getForm().getTextField('reader_name').getText()).toBe('Signed through the Folio interface');
  expect(signed.getForm().getCheckBox('approved').isChecked()).toBe(true);
  await page.locator('#dialog-close').click();
  // A derived signed copy must not acknowledge changes to the original open tab.
  await expect(page.locator('#tabs .dirty-dot')).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await chooser).setFiles(savedPath);
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#notice')).toContainText('Signed document: reading only');
  await expect(page.locator('#tool-text')).toBeDisabled();
  await expect(page.locator('.document-host:not([hidden]) .page').first()).toHaveAttribute('data-loaded', 'true');
  await expect(page.getByRole('tab', { name: 'form-signed-folio.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'form.pdf', exact: true }).click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Signed through the Folio interface');
  await expect(page.locator('#tabs .dirty-dot')).toHaveCount(1);
});

test('a wrong certificate password keeps the PDF open and clears credential controls', async ({ page }) => {
  await certificateDialog(page, 'synthetic-wrong-password');
  await page.locator('#sign-inspect').click();
  await expect(page.locator('#sign-status')).toContainText('certificate file or password could not be read');
  await expect(page.locator('#sign-status')).not.toContainText('synthetic-wrong-password');
  await expect(page.locator('#sign-password')).toHaveValue('');
  await expect(page.locator('#sign-certificate')).toHaveValue('');
  await expect(page.locator('#sign-start')).toBeDisabled();
  await expect(page.locator('#sign-download')).toBeDisabled();
  await page.locator('#dialog-close').click();
  await expect(page.getByRole('tab', { name: 'form.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('cancelling certificate review releases the pending worker and clears credentials', async ({ page }) => {
  let release!: () => void;
  let began!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { began = resolve; });
  await page.route('**/signing-worker-*.js', async route => {
    began(); await gate;
    await route.continue().catch(() => undefined); // Cancellation may already have closed this worker request.
  });
  try {
    await certificateDialog(page);
    await page.locator('#sign-inspect').click();
    await requested;
    await expect(page.locator('#sign-cancel')).toBeEnabled();
    await page.locator('#sign-cancel').click();
    release();
    await expect(page.locator('#sign-status')).toContainText(/cancelled/i);
    await expect(page.locator('#sign-password')).toHaveValue('');
    await expect(page.locator('#sign-certificate')).toHaveValue('');
    await expect(page.locator('#sign-start')).toBeDisabled();
    await expect(page.locator('#sign-download')).toBeDisabled();
    await expect(page.locator('#sign-inspect')).toBeEnabled();
  } finally { release(); }
});

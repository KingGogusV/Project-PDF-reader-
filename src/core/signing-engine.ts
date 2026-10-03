import { PDF, P12Signer } from '@libpdf/core';
import { PDFDocument, PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRawStream, type PDFObject } from 'pdf-lib';
import { BitString, fromBER } from 'asn1js';
import { Certificate, ContentInfo, SignedData, type RelativeDistinguishedNames } from 'pkijs';
import type { SignedPdfCopy, SigningCertificateSummary, SigningErrorCode, SigningInput, SigningTask, SigningTaskResult, SigningVerification } from './signing';

class OperationError extends Error {
  constructor(readonly code: SigningErrorCode, message: string) { super(message); }
}
const fail = (code: SigningErrorCode, message: string): never => { throw new OperationError(code, message); };
const verificationFailure = (): never => fail('verification', 'The signed copy failed its integrity check. Your original PDF has not changed.');
const verification = (): SigningVerification => ({ integrity: 'verified', trust: 'not-verified', revocation: 'not-checked', timestamp: 'not-requested' });
const equal = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((value, index) => value === right[index]);
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
const buffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;
const name = (key: string) => PDFName.of(key);
const RSA_OID = '1.2.840.113549.1.1.1';
const SHA256_OID = '2.16.840.1.101.3.4.2.1';

function parseCertificate(bytes: Uint8Array): Certificate {
  const parsed = fromBER(buffer(bytes));
  if (parsed.offset !== bytes.length) return fail('certificate', 'The signing certificate could not be read.');
  return new Certificate({ schema: parsed.result });
}

function distinguishedName(value: RelativeDistinguishedNames): string {
  const labels: Record<string, string> = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C', '1.2.840.113549.1.9.1': 'email' };
  return value.typesAndValues.map(item => {
    const text: unknown = item.value.valueBlock.value;
    return `${labels[item.type] ?? item.type}=${String(text ?? '').replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, 256)}`;
  }).join(', ').slice(0, 2048);
}

async function summarizeCertificate(certificate: Certificate, der: Uint8Array): Promise<SigningCertificateSummary> {
  if (certificate.subjectPublicKeyInfo.algorithm.algorithmId !== RSA_OID) {
    return fail('unsupported', 'Use an RSA certificate. Other certificate key algorithms are not yet supported.');
  }
  const publicKey = await crypto.subtle.importKey('spki', certificate.subjectPublicKeyInfo.toSchema().toBER(false),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const keyBits = (publicKey.algorithm as RsaHashedKeyAlgorithm).modulusLength;
  if (keyBits < 2048 || keyBits > 8192) return fail('unsupported', 'Use an RSA signing certificate with a key between 2,048 and 8,192 bits.');
  const now = Date.now();
  const from = certificate.notBefore.value.getTime(), until = certificate.notAfter.value.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > now || until < now) {
    return fail('certificate', "This certificate is expired or not yet valid according to this device's clock.");
  }
  const keyUsage = certificate.extensions?.find(extension => extension.extnID === '2.5.29.15');
  if (keyUsage) {
    const parsed = fromBER(keyUsage.extnValue.valueBlock.valueHexView);
    if (!(parsed.result instanceof BitString) || !(parsed.result.valueBlock.valueHexView[0] & 0xc0)) {
      return fail('certificate', 'This certificate does not permit document signing.');
    }
  }
  return {
    subject: distinguishedName(certificate.subject), issuer: distinguishedName(certificate.issuer),
    serialNumber: hex(certificate.serialNumber.valueBlock.valueHexView),
    validFrom: certificate.notBefore.value.toISOString(), validUntil: certificate.notAfter.value.toISOString(),
    fingerprintSha256: hex(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(der)))),
    keyAlgorithm: 'RSA', keyBits,
  };
}

async function openSigner(p12Bytes: Uint8Array, password: string) {
  let signer: P12Signer;
  try {
    // No AIA fetching, certificate authorities, timestamp authorities or revocation services.
    signer = await P12Signer.create(p12Bytes, password, { buildChain: false });
  } catch {
    return fail('certificate', 'The certificate file or password could not be read. Check the password and choose a supported .p12 or .pfx file.');
  }
  if (signer.keyType !== 'RSA' || signer.signatureAlgorithm !== 'RSASSA-PKCS1-v1_5') {
    return fail('unsupported', 'Use an RSA certificate. Other certificate key algorithms are not yet supported.');
  }
  const certificate = parseCertificate(signer.certificate);
  const summary = await summarizeCertificate(certificate, signer.certificate);
  // LibPDF selects a certificate by bag order. Prove it corresponds to the actual private key.
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const signedChallenge = await signer.sign(challenge, 'SHA-256');
  const publicKey = await crypto.subtle.importKey('spki', certificate.subjectPublicKeyInfo.toSchema().toBER(false),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, buffer(signedChallenge), buffer(challenge))) {
    return fail('certificate', 'The certificate does not match the private key. Choose a bundle containing the intended signing identity.');
  }
  return { signer, summary };
}

/** Traverse decoded objects (including object streams), never raw string markers. */
function inspectDictionaries(document: PDFDocument, visit: (dictionary: PDFDict) => void) {
  const seen = new Set<PDFObject>();
  const pending: PDFObject[] = document.context.enumerateIndirectObjects().map(([, object]) => object);
  pending.push(document.catalog);
  while (pending.length) {
    const object = pending.pop()!;
    if (seen.has(object)) continue;
    seen.add(object);
    if (seen.size > 100_000) fail('unsupported', 'This PDF is too complex for local certificate signing.');
    if (object instanceof PDFDict) {
      visit(object);
      pending.push(...object.values());
    } else if (object instanceof PDFRawStream) pending.push(object.dict);
    else if (object instanceof PDFArray) pending.push(...object.asArray());
  }
}

async function preparePdf(bytes: Uint8Array) {
  let independent: PDFDocument;
  try { independent = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true }); }
  catch { return fail('unsupported', 'Encrypted, damaged or unsupported PDFs cannot be signed here.'); }
  if (independent.isEncrypted || independent.context.trailerInfo.Encrypt || independent.catalog.has(name('Perms'))) {
    return fail('unsupported', 'Encrypted, restricted or certified PDFs cannot be signed here.');
  }
  const pages = independent.getPageCount();
  if (pages < 1 || pages > 200) return fail('unsupported', 'Certificate signing supports PDFs with 1 to 200 pages.');
  inspectDictionaries(independent, dictionary => {
    // The writer's first-object heuristic can miss linearization dictionaries in real xref layouts.
    if (dictionary.has(name('Linearized'))) fail('unsupported', 'Linearized PDFs cannot be signed while preserving their original structure here.');
    if (dictionary.get(name('Type'))?.toString() === '/Sig' || dictionary.get(name('Type'))?.toString() === '/DocTimeStamp' ||
      dictionary.get(name('FT'))?.toString() === '/Sig' || dictionary.has(name('ByteRange')) || dictionary.has(name('DocMDP')) || dictionary.has(name('FieldMDP'))) {
      fail('unsupported', 'PDFs containing signatures or signature fields cannot be signed again here.');
    }
    if (dictionary.has(name('XFA'))) fail('unsupported', 'XFA forms cannot be signed here.');
  });
  const pdf = await PDF.load(bytes.slice());
  if (pdf.isEncrypted || pdf.getPageCount() !== pages || pdf.canSaveIncrementally() !== null) {
    return fail('unsupported', 'This PDF cannot be signed while preserving its original bytes. Linearized and repaired PDFs are not supported.');
  }
  if (pdf.getCatalog().has('Perms') || (pdf.getForm()?.getSignatureFields().length ?? 0) > 0) {
    return fail('unsupported', 'PDFs containing signatures or signature fields cannot be signed again here.');
  }
  return { pdf, independent };
}

/** An invisible signature must preserve visible page content, annotations and form data. */
async function verifyPagePreservation(before: PDFDocument, bytes: Uint8Array) {
  const after = await PDFDocument.load(bytes.slice(), { updateMetadata: false, throwOnInvalidObject: true });
  if (before.getPageCount() !== after.getPageCount()) return verificationFailure();
  const compared = new Map<PDFObject, Set<PDFObject>>();
  const compareObjects = (left: PDFObject | undefined, right: PDFObject | undefined) => {
    const pending: Array<[PDFObject | undefined, PDFObject | undefined]> = [[left, right]];
    let count = 0;
    while (pending.length) {
      if (++count > 100_000) return verificationFailure();
      const pair = pending.pop()!;
      const a = before.context.lookup(pair[0]), b = after.context.lookup(pair[1]);
      if (!a || !b) { if (a !== b) return verificationFailure(); else continue; }
      if (compared.get(a)?.has(b)) continue;
      if (!compared.has(a)) compared.set(a, new Set());
      compared.get(a)!.add(b);
      if (a instanceof PDFRawStream && b instanceof PDFRawStream) {
        if (!equal(a.getContents(), b.getContents())) return verificationFailure();
        pending.push([a.dict, b.dict]);
      } else if (a instanceof PDFDict && b instanceof PDFDict) {
        if (a.keys().length !== b.keys().length) return verificationFailure();
        for (const key of a.keys()) {
          if (!b.has(key)) return verificationFailure();
          // Annotation /P points back to a page checked separately below. Keep
          // that reference identical while traversing all appearance/value data.
          if (key.toString() === '/P' && a.has(name('Rect'))) {
            if (a.get(key)?.toString() !== b.get(key)?.toString()) return verificationFailure();
            continue;
          }
          pending.push([a.get(key), b.get(key)]);
        }
      } else if (a instanceof PDFArray && b instanceof PDFArray) {
        if (a.size() !== b.size()) return verificationFailure();
        for (let i = 0; i < a.size(); i++) pending.push([a.get(i), b.get(i)]);
      } else if (a.constructor !== b.constructor || a.toString() !== b.toString()) return verificationFailure();
    }
  };
  for (let i = 0; i < before.getPageCount(); i++) {
    const a = before.getPage(i), b = after.getPage(i);
    for (const box of ['getMediaBox', 'getCropBox', 'getBleedBox', 'getTrimBox', 'getArtBox'] as const) {
      if (JSON.stringify(a[box]()) !== JSON.stringify(b[box]())) return verificationFailure();
    }
    if (a.getRotation().angle !== b.getRotation().angle) return verificationFailure();
    compareObjects(a.node.get(name('UserUnit')), b.node.get(name('UserUnit')));
    compareObjects(a.node.Contents(), b.node.Contents());
    compareObjects(a.node.Resources(), b.node.Resources());
    const sourceAnnotations = a.node.Annots(), outputAnnotations = b.node.Annots();
    const sourceCount = sourceAnnotations?.size() ?? 0;
    // The pinned writer's invisible signature field is in AcroForm, not page Annots.
    if ((outputAnnotations?.size() ?? 0) !== sourceCount) return verificationFailure();
    for (let j = 0; j < sourceCount; j++) compareObjects(sourceAnnotations!.get(j), outputAnnotations!.get(j));
  }
  const originalFields = before.getForm().getFields(), resultFields = after.getForm().getFields();
  if (resultFields.length !== originalFields.length + 1) return verificationFailure();
  for (const original of originalFields) {
    const result = resultFields.find(field => field.getName() === original.getName());
    if (!result || result.constructor !== original.constructor) return verificationFailure();
    compareObjects(original.acroField.dict, result.acroField.dict);
  }
}

async function verifyCopy(bytes: Uint8Array, expectedCertificate?: Uint8Array): Promise<SigningVerification> {
  try {
    // The output is parsed independently of the writer and cryptographically checked by PKIjs.
    const pdf = await PDFDocument.load(bytes.slice(), { updateMetadata: false, throwOnInvalidObject: true });
    const dictionaries: PDFDict[] = [];
    inspectDictionaries(pdf, dictionary => {
      if (dictionary.get(name('Type'))?.toString() === '/Sig' || dictionary.has(name('ByteRange'))) dictionaries.push(dictionary);
    });
    if (dictionaries.length !== 1) return verificationFailure();
    const dictionary = dictionaries[0];
    if (dictionary.get(name('SubFilter'))?.toString() !== '/ETSI.CAdES.detached') return verificationFailure();
    const range = dictionary.lookup(name('ByteRange'));
    const contents = dictionary.lookup(name('Contents'));
    if (!(range instanceof PDFArray) || range.size() !== 4 || !(contents instanceof PDFHexString)) return verificationFailure();
    const parts = range.asArray().map(part => part instanceof PDFNumber ? part.asNumber() : NaN);
    const [start, firstLength, secondStart, secondLength] = parts;
    if (!parts.every(value => Number.isSafeInteger(value) && value >= 0) || start !== 0 || firstLength === 0 ||
      secondStart <= firstLength || secondStart > bytes.length || secondLength < 1 || secondStart + secondLength !== bytes.length) return verificationFailure();
    // Exclude only the exact hex Contents token. Appended unsigned bytes or a wider gap fail closed.
    const gap = bytes.subarray(firstLength, secondStart);
    if (gap[0] !== 60 || gap[gap.length - 1] !== 62) return verificationFailure();
    const encoded = new TextDecoder('ascii', { fatal: true }).decode(gap.subarray(1, -1));
    if (!/^[0-9a-f]+$/iu.test(encoded) || encoded.length % 2) return verificationFailure();
    const gapBytes = Uint8Array.from(encoded.match(/../gu)!, pair => Number.parseInt(pair, 16));
    const cmsBytes = contents.asBytes();
    if (!equal(gapBytes, cmsBytes)) return verificationFailure();
    const parsed = fromBER(buffer(cmsBytes));
    if (parsed.offset < 1 || cmsBytes.subarray(parsed.offset).some(value => value !== 0)) return verificationFailure();
    const contentInfo = new ContentInfo({ schema: parsed.result });
    if (contentInfo.contentType !== '1.2.840.113549.1.7.2') return verificationFailure();
    const signedData = new SignedData({ schema: contentInfo.content });
    if (signedData.signerInfos.length !== 1 || signedData.encapContentInfo.eContent ||
      signedData.encapContentInfo.eContentType !== '1.2.840.113549.1.7.1') return verificationFailure();
    const signerInfo = signedData.signerInfos[0];
    if (signerInfo.digestAlgorithm.algorithmId !== SHA256_OID || !signerInfo.signedAttrs ||
      ![RSA_OID, '1.2.840.113549.1.1.11'].includes(signerInfo.signatureAlgorithm.algorithmId)) return verificationFailure();
    const signedBytes = new Uint8Array(firstLength + secondLength);
    signedBytes.set(bytes.subarray(0, firstLength));
    signedBytes.set(bytes.subarray(secondStart), firstLength);
    const result = await signedData.verify({ signer: 0, data: signedBytes.buffer, checkChain: false, extendedMode: true });
    if (result.signatureVerified !== true || !(result.signerCertificate instanceof Certificate)) return verificationFailure();
    const actualCertificate = new Uint8Array(result.signerCertificate.toSchema().toBER(false));
    if (expectedCertificate && !equal(actualCertificate, expectedCertificate)) return verificationFailure();
    if (result.signerCertificate.subjectPublicKeyInfo.algorithm.algorithmId !== RSA_OID) return verificationFailure();
    return verification();
  } catch (error) {
    if (error instanceof OperationError) throw error;
    return verificationFailure();
  }
}

async function signCopy(input: Omit<SigningInput, 'signal'>): Promise<SignedPdfCopy> {
  const { pdf, independent } = await preparePdf(input.pdfBytes);
  const fieldName = input.fieldName?.trim() || 'FolioCertificateSignature';
  if (independent.getForm().getFields().some(field => field.getName() === fieldName)) {
    return fail('input', 'That signature field name is already used by a form field. Choose a different name.');
  }
  const { signer, summary } = await openSigner(input.p12Bytes, input.password);
  const signed = await pdf.sign({ signer, level: 'B-B', digestAlgorithm: 'SHA-256', reason: input.reason,
    fieldName, longTermValidation: false, archivalTimestamp: false });
  if (signed.warnings.length || signed.bytes.length <= input.pdfBytes.length ||
    !equal(signed.bytes.subarray(0, input.pdfBytes.length), input.pdfBytes)) return verificationFailure();
  await verifyPagePreservation(independent, signed.bytes);
  const verified = await verifyCopy(signed.bytes, signer.certificate);
  return { bytes: signed.bytes, certificate: summary, verification: verified };
}

/** Worker-only entry; never returns a signer, private key, password or P12 bytes. */
export async function executeSigningTask(task: SigningTask): Promise<SigningTaskResult> {
  try {
    if (task.kind === 'inspect') return (await openSigner(task.p12Bytes, task.password)).summary;
    if (task.kind === 'verify') return await verifyCopy(task.bytes);
    return await signCopy(task.input);
  } finally {
    // Best-effort release of buffers under our control; JavaScript cannot guarantee secure erasure.
    if (task.kind === 'inspect') { task.p12Bytes.fill(0); task.password = ''; }
    if (task.kind === 'sign') { task.input.p12Bytes.fill(0); task.input.password = ''; }
  }
}

export function safeSigningFailure(error: unknown): { code: SigningErrorCode; message: string } {
  if (error instanceof OperationError) return { code: error.code, message: error.message };
  return { code: 'unsupported', message: 'This PDF or certificate could not be processed safely. Your original PDF has not changed.' };
}

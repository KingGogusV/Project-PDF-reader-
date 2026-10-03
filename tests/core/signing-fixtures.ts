import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

/** Synthetic, short-lived test identities. No private fixture key is written to disk. */
export async function createCertificateBundle(options: { expired?: boolean; future?: boolean; mismatch?: boolean; ec?: boolean; usage?: number } = {}) {
  const algorithm = options.ec ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const keys = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']) as CryptoKeyPair;
  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({ value: 101 });
  for (const property of [certificate.subject, certificate.issuer]) property.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: 'Folio Synthetic Test Only' }) }));
  const now = Date.now();
  certificate.notBefore.value = new Date(now + (options.future ? 86_400_000 : -86_400_000));
  certificate.notAfter.value = new Date(now + (options.expired ? -3600_000 : 7 * 86_400_000));
  certificate.extensions = [new pkijs.Extension({ extnID: '2.5.29.15', critical: true,
    extnValue: new asn1js.BitString({ unusedBits: 0, valueHex: new Uint8Array([options.usage ?? 0x80]).buffer }).toBER(false) })];
  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey);
  await certificate.sign(keys.privateKey, 'SHA-256');
  const privateKey = options.mismatch
    ? (await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']) as CryptoKeyPair).privateKey : keys.privateKey;
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  const keyBag = new pkijs.PKCS8ShroudedKeyBag({ parsedValue: new pkijs.PrivateKeyInfo({ schema: asn1js.fromBER(pkcs8).result }) });
  const password = 'synthetic-test-password';
  const passwordBytes = new TextEncoder().encode(password).buffer;
  await keyBag.makeInternalValues({ password: passwordBytes, contentEncryptionAlgorithm: { name: 'AES-CBC', length: 256 },
    hmacHashAlgorithm: 'SHA-256', iterationCount: 2048 });
  const safe = new pkijs.AuthenticatedSafe({ parsedValue: { safeContents: [{ privacyMode: 0, value: new pkijs.SafeContents({ safeBags: [
    new pkijs.SafeBag({ bagId: '1.2.840.113549.1.12.10.1.2', bagValue: keyBag }),
    new pkijs.SafeBag({ bagId: '1.2.840.113549.1.12.10.1.3', bagValue: new pkijs.CertBag({ parsedValue: certificate }) }),
  ] }) }] } });
  await safe.makeInternalValues({ safeContents: [{}] });
  const pfx = new pkijs.PFX({ parsedValue: { integrityMode: 0, authenticatedSafe: safe } });
  await pfx.makeInternalValues({ password: passwordBytes, iterations: 2048, pbkdf2HashAlgorithm: { name: 'SHA-256' }, hmacHashAlgorithm: 'SHA-256' });
  new Uint8Array(pkcs8).fill(0);
  return { bytes: new Uint8Array(pfx.toSchema().toBER(false)), password,
    certificate: new Uint8Array(certificate.toSchema().toBER(false)) };
}

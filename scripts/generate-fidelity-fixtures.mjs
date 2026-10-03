/** Additional synthetic fidelity corpus. Never reads a user's PDF or private key. */
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { PDFDocument, PDFName, StandardFonts, rgb, BlendMode } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'tests/fixtures/generated');
const fontsDir = join(output, 'fidelity-fonts');
await mkdir(fontsDir, { recursive: true });
const notoSource = 'https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac';
const cjkSource = 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const fontSpecs = [
  { name: 'NotoSans-Regular.ttf', url: `${notoSource}/hinted/ttf/NotoSans/NotoSans-Regular.ttf`, license: `${notoSource}/LICENSE`, sha256: 'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5' },
  { name: 'NotoSansCJKjp-Regular.otf', url: `${cjkSource}/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf`, license: `${cjkSource}/Sans/LICENSE`, sha256: '68a3fc98800b2a27b371f2fb79991daf3633bd89309d4ffaa6946fd587f375b5' },
  { name: 'NotoSansArabic-Regular.ttf', url: `${notoSource}/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf`, license: `${notoSource}/LICENSE`, sha256: 'ceea25b464a656dc3b26849bab9356740401af62aedf1bfa8b7f0d9b75925b1b' },
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fetchFile(url, filename) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Fixture source ${url} returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(filename, bytes);
  return bytes;
}
async function fontBytes(spec) {
  const path = join(fontsDir, spec.name);
  let bytes;
  try { bytes = await readFile(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    bytes = await fetchFile(spec.url, path);
  }
  if (hash(bytes) !== spec.sha256) throw new Error(`Fixture font integrity mismatch: ${spec.name}`);
  const licensePath = path + '.OFL.txt';
  let license;
  try { license = await readFile(licensePath, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    license = new TextDecoder().decode(await fetchFile(spec.license, licensePath));
  }
  if (!license.includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error(`Expected OFL license: ${spec.name}`);
  return bytes;
}
async function newDocument(title) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setAuthor('Folio synthetic fixture generator');
  doc.setSubject('Original test material; no personal document or production signing identity.');
  doc.setCreationDate(new Date('2026-10-03T00:00:00Z'));
  doc.setModificationDate(new Date('2026-10-03T00:00:00Z'));
  return doc;
}
const fontData = await Promise.all(fontSpecs.map(fontBytes));
{
  const doc = await newDocument('Embedded multilingual text fidelity');
  const latin = await doc.embedFont(fontData[0], { subset: true });
  // fontkit 1.1.1 cannot reliably subset this CID-keyed CFF font. Embed the
  // unmodified font fully; independent Poppler rendering catches this distinction.
  const cjk = await doc.embedFont(fontData[1], { subset: false });
  const arabic = await doc.embedFont(fontData[2], { subset: true });
  const page = doc.addPage([612, 792]);
  page.drawText('Embedded type / multilingual reading', { x: 38, y: 734, font: latin, size: 23, color: rgb(.09, .24, .22) });
  const rows = [
    [latin, 'Latin: café naïve coöperate résumé Straße', 657, 17],
    [latin, 'Greek: Καλημέρα κόσμε', 597, 19],
    [latin, 'Cyrillic: Привет мир', 537, 19],
    [cjk, '日本語の文書を読む。東京と京都。', 462, 22],
    [cjk, '中文文件：本地保存。', 395, 22],
    [arabic, 'مرحبا بالعالم', 318, 27],
    [latin, 'FidelityBaselineToken / 0123456789', 227, 17],
    [latin, 'These fonts are embedded; no system fonts are required.', 163, 11],
    [latin, 'This is a rendering corpus, not a screen-reader reading-order claim.', 143, 11],
  ];
  for (const [font, value, y, size] of rows) {
    for (const character of value) {
      if (!font.getCharacterSet().includes(character.codePointAt(0))) throw new Error(`Missing glyph ${character} in embedded fixture font`);
    }
    page.drawText(value, { x: 38, y, size, font });
  }
  // pdf-lib's generic custom-font embedder labels full OpenType-CFF as TrueType.
  // Set the actual PDF font program type before accepting it as a valid fixture.
  const finalized = await PDFDocument.load(await doc.save({ useObjectStreams: false }));
  const fontResources = finalized.getPage(0).node.Resources().lookup(PDFName.of('Font'));
  for (const key of fontResources.keys()) {
    const resource = fontResources.lookup(key);
    if (!resource.get(PDFName.of('BaseFont')).toString().includes('NotoSansCJKjp')) continue;
    const descendant = resource.lookup(PDFName.of('DescendantFonts')).lookup(0);
    descendant.set(PDFName.of('Subtype'), PDFName.of('CIDFontType0'));
    descendant.delete(PDFName.of('CIDToGIDMap'));
    const descriptor = descendant.lookup(PDFName.of('FontDescriptor'));
    const program = descriptor.get(PDFName.of('FontFile2')) ?? descriptor.get(PDFName.of('FontFile3'));
    descriptor.set(PDFName.of('FontFile3'), program); descriptor.delete(PDFName.of('FontFile2'));
    finalized.context.lookup(program).dict.set(PDFName.of('Subtype'), PDFName.of('OpenType'));
  }
  await writeFile(join(output, 'embedded-multilingual.pdf'), await finalized.save({ useObjectStreams: false }));
}
{
  const doc = await newDocument('Transparency and raster fidelity');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const require = createRequire(import.meta.resolve('pdfjs-dist/package.json'));
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(1200, 1000);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 1000);
  gradient.addColorStop(0, '#164f56'); gradient.addColorStop(.5, '#92bd91'); gradient.addColorStop(1, '#dc8564');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 1000);
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${.15 + i % 4 / 10})`;
    ctx.lineWidth = i % 3 + 1;
    ctx.beginPath(); ctx.arc(100 + (i * 37) % 1000, 100 + (i * 73) % 800, 40 + i * 2, 0, 2 * Math.PI); ctx.stroke();
  }
  const image = await doc.embedPng(canvas.toBuffer('image/png'));
  for (let n = 1; n <= 3; n++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`TransparencyBaselineToken / page ${n}`, { x: 40, y: 739, size: 20, font });
    p.drawImage(image, { x: 40, y: 238, width: 532, height: 443 });
    p.drawCircle({ x: 243, y: 392, size: 105, color: rgb(1, .1, .1), opacity: .35, blendMode: BlendMode.Multiply });
    p.drawCircle({ x: 349, y: 392, size: 105, color: rgb(.1, .1, 1), opacity: .4, blendMode: BlendMode.Screen });
    p.drawRectangle({ x: 80, y: 293, width: 425, height: 28, color: rgb(1, 1, 1), opacity: .64 });
    p.drawText('Raster + alpha + Multiply + Screen', { x: 91, y: 301, size: 13, font });
    p.drawText('This synthetic page must retain the same pixels after unrelated form edits.', { x: 40, y: 167, size: 10, font });
  }
  const formPage = doc.addPage([612, 792]);
  formPage.drawText('Fidelity round-trip worksheet', { x: 40, y: 731, size: 22, font });
  formPage.drawText('Edit only this field. Pages 1-3 must remain pixel-identical.', { x: 40, y: 689, size: 12, font });
  const field = doc.getForm().createTextField('fidelity_note');
  field.addToPage(formPage, { x: 40, y: 602, width: 500, height: 38, font, borderWidth: 1 }); field.setFontSize(13);
  doc.getForm().updateFieldAppearances(font);
  await writeFile(join(output, 'transparency-form.pdf'), await doc.save({ useObjectStreams: false }));
}

// Self-signed CMS fixture: an ephemeral test-only key is generated in Python memory,
// never written. It is NOT a trusted identity or evidence of signature validation by Folio.
const signedCode = String.raw`
import sys, re, json, datetime, hashlib
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs7
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject, NumberObject, ArrayObject, ByteStringObject
source, folder = sys.argv[1], Path(sys.argv[2])
w = PdfWriter(clone_from=PdfReader(source))
sig = DictionaryObject({NameObject('/Type'):NameObject('/Sig'),NameObject('/Filter'):NameObject('/Adobe.PPKLite'),NameObject('/SubFilter'):NameObject('/adbe.pkcs7.detached'),NameObject('/ByteRange'):ArrayObject([NumberObject(0),NumberObject(9999999999),NumberObject(9999999999),NumberObject(9999999999)]),NameObject('/Contents'):ByteStringObject(bytes(8192)),NameObject('/Reason'):TextStringObject('Synthetic self-signed fixture, not trusted production identity'),NameObject('/M'):TextStringObject('D:20261003000000Z')})
sigref = w._add_object(sig)
field = DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Widget'),NameObject('/FT'):NameObject('/Sig'),NameObject('/T'):TextStringObject('synthetic_signature'),NameObject('/Rect'):ArrayObject([NumberObject(0)]*4),NameObject('/V'):sigref,NameObject('/F'):NumberObject(4)})
fieldref = w._add_object(field)
w._root_object[NameObject('/AcroForm')] = DictionaryObject({NameObject('/Fields'):ArrayObject([fieldref]),NameObject('/SigFlags'):NumberObject(3)})
w.pages[0][NameObject('/Annots')] = ArrayObject([fieldref])
import io
stream=io.BytesIO();w.write(stream);raw=bytearray(stream.getvalue())
content=re.search(rb'/Contents\s*(<0{16384}>)',raw)
if not content: raise RuntimeError('Signature placeholder not found')
a,b=content.span(1);br=[0,a,b,len(raw)-b]
match=re.search(rb'/ByteRange\s*\[\s*0\s+9999999999\s+9999999999\s+9999999999\s*\]',raw)
replacement=('/ByteRange [ 0 '+str(a).rjust(10)+' '+str(b).rjust(10)+' '+str(len(raw)-b).rjust(10)+' ]').encode()
if len(replacement)!=match.end()-match.start():raise RuntimeError('ByteRange length mismatch')
raw[match.start():match.end()]=replacement
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Folio Synthetic Test Signer')])
cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1001).not_valid_before(datetime.datetime(2026,1,1,tzinfo=datetime.timezone.utc)).not_valid_after(datetime.datetime(2030,1,1,tzinfo=datetime.timezone.utc)).sign(key,hashes.SHA256())
signed=bytes(raw[:a]+raw[b:])
cms=pkcs7.PKCS7SignatureBuilder().set_data(signed).add_signer(cert,key,hashes.SHA256()).sign(serialization.Encoding.DER,[pkcs7.PKCS7Options.DetachedSignature,pkcs7.PKCS7Options.Binary,pkcs7.PKCS7Options.NoAttributes])
if len(cms)>8192:raise RuntimeError('Signature exceeds reserved space')
raw[a+1:b-1]=cms.hex().encode().ljust(16384,b'0')
(folder/'signed-synthetic.pdf').write_bytes(raw)
# A direct signature made by the same PKCS7 signer permits Node's independent
# public-key verification of the signed byte ranges without a third ASN.1 package.
from cryptography.hazmat.primitives.asymmetric import padding
signature=key.sign(signed,padding.PKCS1v15(),hashes.SHA256())
if signature not in cms:raise RuntimeError('CMS signature and direct signature differ')
(folder/'signed-synthetic-proof.json').write_text(json.dumps({'byteRange':br,'cmsHex':cms.hex(),'signatureHex':signature.hex(),'certificatePem':cert.public_bytes(serialization.Encoding.PEM).decode(),'fileSha256':hashlib.sha256(raw).hexdigest(),'selfSigned':True,'trusted':False},indent=2))
`;
for (const name of ['signed-synthetic.pdf', 'signed-synthetic-proof.json']) await unlink(join(output, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
let signature = 'unavailable: Python pypdf + cryptography required';
const pythonCandidates = [process.env.FOLIO_PYTHON, process.env.CODEX_PRIMARY_RUNTIME_PYTHON, resolve(dirname(process.execPath), '..', '..', 'python', 'python.exe'), 'python3', 'python'];
for (const executable of [...new Set(pythonCandidates.filter(Boolean))]) {
  const result = spawnSync(executable, ['-c', signedCode, join(output, 'text-outline.pdf'), output], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (result.status === 0) { signature = 'generated; self-signed synthetic certificate, no trust or app-validation claim'; break; }
  if (result.status !== null && !result.stderr?.includes('No module named')) console.warn(`Optional signed fixture: ${result.stderr?.trim()}`);
}
await writeFile(join(output, 'fidelity-manifest.json'), JSON.stringify({
  fonts: fontSpecs, fontLicense: 'SIL Open Font License 1.1; copies alongside source font files',
  files: ['embedded-multilingual.pdf', 'transparency-form.pdf'], signature,
  caveats: ['Arabic/CJK samples are not comprehensive shaping or reading-order coverage.', 'Raster and transparency are synthetic rather than a real-world compatibility corpus.', 'No private key is saved.'],
}, null, 2) + '\n');
console.log('Generated fidelity fixtures:', join(output, 'fidelity-manifest.json'));
console.log('Signature:', signature);

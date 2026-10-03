import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(root, 'public', 'vendor', 'pdfjs');
const { version } = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
await mkdir(target, { recursive: true });

// Include bundled third-party notices beside each font/codec. No CDNs or runtime downloads.
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs', 'image_decoders']) {
  await cp(join(packageRoot, directory), join(target, directory), {
    recursive: true,
    filter: path => !path.endsWith('.map') && !path.includes('quickjs-eval')
      && !path.endsWith('pdf.image_decoders.mjs'),
  });
}
await cp(join(packageRoot, 'LICENSE'), join(target, 'LICENSE'));
await writeFile(join(target, 'NOTICE.txt'), `PDF.js ${version}\nhttps://github.com/mozilla/pdf.js\nApache License 2.0; see LICENSE.\n\nThe cmaps, standard_fonts, wasm, and iccs directories include component-specific license notices. Preserve them when redistributing. QuickJS evaluation files are intentionally not shipped; document scripting is disabled.\n`, 'utf8');

let count = 0;
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs', 'image_decoders']) count += (await readdir(join(target, directory))).length;
console.log(`Copied ${count} local PDF.js ${version} assets and component license notices.`);

// OCR is loaded only when requested. Its package assets remain on the same origin.
const ocrRoot = dirname(require.resolve('tesseract.js/package.json'));
const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
const languageRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
const ocrTarget = join(root, 'public', 'vendor', 'ocr');
await mkdir(join(ocrTarget, 'core'), { recursive: true });
await mkdir(join(ocrTarget, 'lang'), { recursive: true });
await cp(join(ocrRoot, 'dist', 'worker.min.js'), join(ocrTarget, 'worker.min.js'));
for (const file of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) await cp(join(coreRoot, file), join(ocrTarget, 'core', file));
await cp(join(ocrRoot, 'LICENSE.md'), join(ocrTarget, 'TESSERACT-JS-LICENSE.txt'));
await cp(join(root, 'third_party', 'ocr'), join(ocrTarget, 'notices'), { recursive: true });
await cp(join(coreRoot, 'LICENSE'), join(ocrTarget, 'core', 'LICENSE'));
await cp(join(languageRoot, '4.0.0_best_int', 'eng.traineddata.gz'), join(ocrTarget, 'lang', 'eng.traineddata.gz'));
await cp(join(coreRoot, 'LICENSE'), join(ocrTarget, 'lang', 'APACHE-2.0.txt'));
await writeFile(join(ocrTarget, 'lang', 'NOTICE.txt'), 'English LSTM model from @tesseract.js-data/eng 1.0.0 (4.0.0_best_int). Upstream Tesseract traineddata: Apache-2.0, https://github.com/tesseract-ocr/tessdata_best. The npm packaging is MIT; model license remains Apache-2.0.\n');
const notices = join(root, 'public', 'vendor', 'licenses');
await mkdir(notices, { recursive: true });
await cp(join(root, 'third_party', 'signing'), join(notices, 'signing'), { recursive: true });
for (const name of ['pdf-lib', '@libpdf/core', 'pkijs', 'asn1js']) {
  const directory = dirname(require.resolve(`${name}/package.json`));
  for (const file of await readdir(directory)) if (/^(LICENSE|NOTICE)/i.test(file)) await cp(join(directory,file),join(notices,`${name.replaceAll('/','-')}-${file}`));
}
console.log('Copied local OCR LSTM assets, English model and major mutation/signing notices.');

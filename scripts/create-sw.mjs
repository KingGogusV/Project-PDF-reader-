import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist', 'client');
const files = ['index.html', 'icon.svg', 'manifest.webmanifest'];
const optionalFiles = [];

async function collect(relativeDirectory, destination = files) {
  for (const entry of await readdir(join(dist, relativeDirectory), { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) await collect(relativePath, destination);
    // Only immutable app/engine asset trees enter this list; never fixtures or PDF files.
    else if (!/\.(?:pdf|map)$/i.test(entry.name)) destination.push(relativePath);
  }
}
await collect('assets');
await collect('vendor/pdfjs');
await collect('vendor/licenses');
await collect('vendor/ocr', optionalFiles);
files.sort();
const hash = createHash('sha256');
let totalBytes = 0;
for (const file of [...files, ...optionalFiles]) {
  const bytes = await readFile(join(dist, file));
  if (files.includes(file)) totalBytes += bytes.byteLength;
  hash.update(file).update(bytes);
}
const version = hash.digest('hex').slice(0, 16);
const template = await readFile(join(root, 'public', 'sw.js'), 'utf8');
if (!template.includes('__FOLIO_SW_VERSION__') || !template.includes('/*__FOLIO_ASSET_MANIFEST__*/ []')) {
  throw new Error('The service-worker template markers are missing.');
}
await writeFile(join(dist, 'sw.js'), template
  .replace('__FOLIO_SW_VERSION__', version)
  .replace('/*__FOLIO_ASSET_MANIFEST__*/ []', JSON.stringify(files))
  .replace('/*__FOLIO_OPTIONAL_MANIFEST__*/ []', JSON.stringify(optionalFiles)), 'utf8');
console.log(`Offline manifest ${version}: ${files.length} application assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB. No PDFs cached.`);
console.log(`${optionalFiles.length} OCR assets are cached only when requested; OCR needs initial network setup.`);

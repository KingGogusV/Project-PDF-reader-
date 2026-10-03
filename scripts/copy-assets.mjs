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

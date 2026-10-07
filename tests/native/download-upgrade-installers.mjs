// Anonymous, hash-pinned release downloads; never rebuild or overwrite a release.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const releases = JSON.parse(await readFile(new URL('./windows-upgrade-releases.json',import.meta.url),'utf8'));
for (const release of releases) {
  const directory = new URL(`../../.cache/public-windows-preview-${release.version}/`,import.meta.url);
  const name = `Folio-${release.version}-Windows-x64-Setup.exe`;
  const target = new URL(name,directory);
  let bytes;
  try { bytes = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(`https://github.com/KingGogusV/Project-PDF-reader-/releases/download/${release.tag}/${name}`,{signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,200);
    bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length < 32 * 1024 * 1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),release.installerSha256);
    await mkdir(directory,{recursive:true}); await writeFile(target,bytes,{flag:'wx'});
  }
  assert.equal(createHash('sha256').update(bytes).digest('hex'),release.installerSha256);
  console.log(JSON.stringify({version:release.version,sha256:release.installerSha256,path:fileURLToPath(target)}));
}

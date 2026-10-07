// Source-bound candidate planning. No installers, profiles or Windows APIs run here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyNsisBinaryIdentity } from '../../scripts/native-binary-identity.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function candidateUpgradeIdentity({ sourceCommit, checkoutCommit, packageJson, cargoManifest, tauriConfig, installers, builtBytes, installerBytes }) {
  assert.match(sourceCommit || '', /^[a-f0-9]{40}$/, 'Candidate requires an exact CI source revision.');
  assert.equal(checkoutCommit, sourceCommit, 'Candidate build source must match the checked-out CI revision.');
  assert.equal(packageJson.version, '0.1.3');
  const cargoPackage = cargoManifest.split(/\r?\n\[/)[0];
  assert.match(cargoPackage, /^name\s*=\s*"folio-desktop"\s*$/m);
  assert.match(cargoPackage, /^version\s*=\s*"0\.1\.3"\s*$/m);
  assert.equal(tauriConfig.version, '0.1.3');
  assert.equal(tauriConfig.productName, 'Folio');
  assert.equal(tauriConfig.identifier, 'app.folio.localreader');
  assert.equal(tauriConfig.mainBinaryName || 'folio-desktop', 'folio-desktop');
  assert.equal(tauriConfig.app?.windows?.find(window => window.label === 'main')?.url, 'index.html?folio-native=1',
    'The candidate first navigation must bypass the older native application-shell cache.');
  assert.equal(packageJson.devDependencies['@tauri-apps/cli'], '2.12.1');
  assert.equal(installers.length, 1, 'Exactly one candidate NSIS installer is required in the fixed build output directory.');
  assert.ok(Buffer.isBuffer(installerBytes) && installerBytes.length >= 64 && installerBytes.length < 200 * 1024 * 1024,
    'Candidate installer must be a bounded Windows executable.');
  assert.equal(installerBytes.toString('ascii', 0, 2), 'MZ');
  assert.ok(Buffer.isBuffer(builtBytes) && builtBytes.length >= 64);
  assert.equal(builtBytes.toString('ascii', 0, 2), 'MZ');
  const pe = builtBytes.readUInt32LE(0x3c);
  assert.ok(pe + 6 <= builtBytes.length);
  assert.equal(builtBytes.toString('ascii', pe, pe + 4), 'PE\0\0');
  assert.equal(builtBytes.readUInt16LE(pe + 4), 0x8664, 'Candidate must be Windows x64.');
  // Derive the installed expectation in memory using the same pinned comparator
  // that will independently compare every byte of the actual installed image.
  const expected = Buffer.from(builtBytes);
  const offset = expected.indexOf(Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK'));
  assert.ok(offset >= 0, 'Built candidate has no unpatched Tauri bundle marker.');
  Buffer.from('__TAURI_BUNDLE_TYPE_VAR_NSS').copy(expected, offset);
  const binaryIdentity = verifyNsisBinaryIdentity(builtBytes, expected, '2.12.1');
  return { version:'0.1.3', source:sourceCommit, sourceCommit, installer:installers[0],
    installerSha256:sha256(installerBytes), builtExecutableSha256:sha256(builtBytes),
    executableSha256:binaryIdentity.installedSha256, binaryIdentity };
}

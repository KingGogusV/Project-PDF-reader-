import { createHash } from 'node:crypto';

const unknown = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK');
const nsis = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_NSS');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Compare every byte, accounting only for the pinned unsigned NSIS marker patch.
 * Upstream: tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs.
 * This never modifies either executable and is not a signed-binary comparator.
 */
export function verifyNsisBinaryIdentity(built, installed, cliVersion) {
  if (cliVersion !== '2.12.1') throw new Error('Review bundle identity rules before changing Tauri CLI.');
  if (!Buffer.isBuffer(built) || !Buffer.isBuffer(installed) || built.length !== installed.length)
    throw new Error('Built and installed executable lengths or types differ.');
  const offset = built.indexOf(unknown);
  if (offset < 0 || built.indexOf(unknown, offset + 1) !== -1 || built.includes(nsis))
    throw new Error('Expected exactly one unpatched Tauri bundle marker.');
  const expected = Buffer.from(built);
  nsis.copy(expected, offset);
  if (!expected.equals(installed)) throw new Error('Installed executable differs beyond the reviewed NSIS bundle marker.');
  return { builtSha256: sha256(built), installedSha256: sha256(installed),
    expectedInstalledSha256: sha256(expected), bundleMarkerOffset: offset,
    transformation: 'Tauri CLI 2.12.1 unsigned NSIS: UNK to NSS; all other bytes identical' };
}

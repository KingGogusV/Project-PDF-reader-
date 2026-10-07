import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { candidateUpgradeIdentity } from '../native/windows-upgrade-candidate.mjs';

const source = 'a'.repeat(40);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function inputs() {
  const builtBytes = Buffer.alloc(512);
  builtBytes.write('MZ'); builtBytes.writeUInt32LE(64,0x3c);
  builtBytes.write('PE\0\0',64); builtBytes.writeUInt16LE(0x8664,68);
  builtBytes.write('__TAURI_BUNDLE_TYPE_VAR_UNK',128);
  const installerBytes = Buffer.alloc(128); installerBytes.write('MZ');
  return {sourceCommit:source,checkoutCommit:source,
    packageJson:{version:'0.1.3',devDependencies:{'@tauri-apps/cli':'2.12.1'}},
    cargoManifest:'[package]\nname = "folio-desktop"\nversion = "0.1.3"\n[lib]\n',
    tauriConfig:{version:'0.1.3',productName:'Folio',identifier:'app.folio.localreader',app:{windows:[{label:'main',url:'index.html?folio-native=1'}]}},
    installers:['candidate.exe'],builtBytes,installerBytes};
}
test('candidate identity binds source, installer and every executable byte with the pinned NSIS marker rule', () => {
  const value = inputs(); const builtBefore = Buffer.from(value.builtBytes);
  const result = candidateUpgradeIdentity(value);
  const expected = Buffer.from(value.builtBytes); expected.write('__TAURI_BUNDLE_TYPE_VAR_NSS',128);
  assert.equal(result.sourceCommit,source); assert.equal(result.version,'0.1.3');
  assert.equal(result.installerSha256,sha256(value.installerBytes));
  assert.equal(result.builtExecutableSha256,sha256(value.builtBytes));
  assert.equal(result.executableSha256,sha256(expected));
  assert.notEqual(result.executableSha256,result.builtExecutableSha256);
  assert.deepEqual(value.builtBytes,builtBefore,'Planning must not patch the actual build input.');
});
test('candidate rejects ambient or mismatched source revisions and ambiguous installer output', () => {
  for (const sourceCommit of [undefined,'main','a'.repeat(39)]) assert.throws(() => candidateUpgradeIdentity({...inputs(),sourceCommit}));
  assert.throws(() => candidateUpgradeIdentity({...inputs(),checkoutCommit:'b'.repeat(40)}));
  for (const installers of [[],['one.exe','two.exe']]) assert.throws(() => candidateUpgradeIdentity({...inputs(),installers}));
});
test('candidate refuses identity, version or CLI drift across the upgrade boundary', () => {
  const mutations = [value => {value.packageJson.version='0.1.1';},value => {value.cargoManifest=value.cargoManifest.replace('0.1.3','0.1.1');},
    value => {value.tauriConfig.version='0.1.1';},value => {value.tauriConfig.identifier='other.reader';},
    value => {value.tauriConfig.productName='Other';},value => {value.tauriConfig.mainBinaryName='other';},
    value => {value.packageJson.devDependencies['@tauri-apps/cli']='2.13.0';},
    value => {value.tauriConfig.app.windows[0].url='index.html';},
    value => {delete value.tauriConfig.app;}];
  for (const mutate of mutations) { const value=inputs(); mutate(value); assert.throws(() => candidateUpgradeIdentity(value)); }
});
test('candidate rejects wrong architecture, already patched or ambiguous bundle markers and non-executable installers', () => {
  const mutations = [value => {value.builtBytes.writeUInt16LE(0xaa64,68);},value => {value.builtBytes.write('__TAURI_BUNDLE_TYPE_VAR_NSS',128);},
    value => {value.builtBytes.write('__TAURI_BUNDLE_TYPE_VAR_UNK',256);},value => {value.builtBytes.write('XX',0);},
    value => {value.installerBytes=Buffer.from('not a Windows installer');},value => {value.installerBytes.write('XX');}];
  for (const mutate of mutations) { const value=inputs(); mutate(value); assert.throws(() => candidateUpgradeIdentity(value)); }
});

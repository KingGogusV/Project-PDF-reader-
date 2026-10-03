import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyNsisBinaryIdentity } from '../../scripts/native-binary-identity.mjs';
const built=Buffer.from('MZ synthetic executable prefix __TAURI_BUNDLE_TYPE_VAR_UNK unchanged payload');
const installed=Buffer.from('MZ synthetic executable prefix __TAURI_BUNDLE_TYPE_VAR_NSS unchanged payload');

test('unsigned NSIS identity permits exactly the documented marker and keeps input immutable',()=>{
  const before=Buffer.from(built), after=Buffer.from(installed);
  const result=verifyNsisBinaryIdentity(built,installed,'2.12.1');
  assert.notEqual(result.builtSha256,result.installedSha256);
  assert.equal(result.expectedInstalledSha256,result.installedSha256);
  assert.equal(result.bundleMarkerOffset,31);
  assert.deepEqual(built,before);assert.deepEqual(installed,after);
});
test('NSIS identity rejects tampering before or after the marker and a different bundle type',()=>{
  for(const offset of [0,12,55,installed.length-1]){
    const changed=Buffer.from(installed);changed[offset]^=1;
    assert.throws(()=>verifyNsisBinaryIdentity(built,changed,'2.12.1'),/differs beyond/);
  }
  assert.throws(()=>verifyNsisBinaryIdentity(built,built,'2.12.1'),/differs beyond/);
});
test('NSIS identity rejects missing, duplicate or already-patched source markers',()=>{
  assert.throws(()=>verifyNsisBinaryIdentity(Buffer.alloc(installed.length),installed,'2.12.1'),/exactly one/);
  assert.throws(()=>verifyNsisBinaryIdentity(installed,installed,'2.12.1'),/exactly one/);
  assert.throws(()=>verifyNsisBinaryIdentity(Buffer.concat([built,built]),Buffer.concat([installed,installed]),'2.12.1'),/exactly one/);
});
test('NSIS identity rejects changed executable size and unreviewed bundler versions',()=>{
  assert.throws(()=>verifyNsisBinaryIdentity(built,Buffer.concat([installed,Buffer.from([0])]),'2.12.1'),/lengths/);
  assert.throws(()=>verifyNsisBinaryIdentity(built,installed,'2.13.0'),/Review/);
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform,'win32','This owned PowerShell runner guard test requires Windows.');
test('default-profile and shortcut modes reject local use before reading any profile or installation', () => {
  const base = ['-NoProfile','-NonInteractive','-File'];
  const cases = [
    ['windows-owned-launch.ps1',['-Mode','local','-ProfileMode','default','-Executable','nonexistent.exe','-ExpectedSha256','a'.repeat(64),'-Port','12345','-ReportPath','nonexistent.json','-StopFile','nonexistent.stop'],'Default-profile verification is restricted'],
    ['windows-upgrade-install.ps1',['-Mode','local','-Action','install','-Target','nonexistent','-ExecutableSha256','a'.repeat(64),'-Version','0.1.2','-CheckShortcuts','-ShortcutState','nonexistent.json'],'Shortcut verification is restricted'],
  ];
  for (const [file,args,message] of cases) {
    const result = spawnSync('pwsh.exe',[...base,fileURLToPath(new URL(file,import.meta.url)),...args],
      {windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:64000});
    assert.ifError(result.error); assert.notEqual(result.status,0); assert.ok((result.stdout + result.stderr).includes(message));
  }
});
test('native ancestor metadata guards read hidden directories while preserving reparse refusal', async () => {
  const root=await mkdtemp(join(tmpdir(),'FolioPathGuard-'));
  await mkdir(join(root,'HiddenParent','VisibleChild'),{recursive:true});
  await mkdir(join(root,'OwnedJunctionTarget'));
  const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',
    fileURLToPath(new URL('windows-path-guards-fixture.ps1',import.meta.url)),'-TestRoot',root],
    {windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:64000});
  assert.ifError(result.error); assert.equal(result.status,0,result.stderr || result.stdout);
  const evidence=JSON.parse(result.stdout);
  assert.equal(evidence.hiddenSystemAncestor,true); assert.equal(evidence.unforcedReadRejected,true);
  assert.equal(evidence.forcedReadAccepted,true); assert.equal(evidence.productionHiddenWalkAccepted,true);
  assert.equal(evidence.productionReparseWalkRejected,true); assert.equal(evidence.literalReadsAllForced,true);
  assert.ok(evidence.literalReadCount >= 19);
  // Retain only newly created synthetic metadata fixtures. No directory cleanup
  // or actual profile/installer/app operation belongs to this regression.
});

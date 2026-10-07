import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
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
  // Node and .NET can select different Windows temporary paths. Ask the exact
  // PowerShell runtime used by the checker before creating our single fixture.
  const query=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',
    '[Console]::Out.WriteLine([IO.Path]::GetFullPath([IO.Path]::GetTempPath()))'],
    {windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:16000});
  assert.ifError(query.error); assert.equal(query.status,0,query.stderr);
  const paths=query.stdout.trim().split(/\r?\n/);
  assert.equal(paths.length,1); const temporary=paths[0]; assert.ok(temporary && isAbsolute(temporary));
  const item=await lstat(temporary); assert.equal(item.isDirectory(),true); assert.equal(item.isSymbolicLink(),false);
  const root=await mkdtemp(join(temporary,'FolioPathGuard-'));
  await mkdir(join(root,'HiddenParent','VisibleChild'),{recursive:true});
  await mkdir(join(root,'OwnedJunctionTarget'));
  const wrongPrefix=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',
    fileURLToPath(new URL('windows-path-guards-fixture.ps1',import.meta.url)),'-TestRoot',join(root,'HiddenParent')],
    {windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:64000});
  assert.ifError(wrongPrefix.error); assert.notEqual(wrongPrefix.status,0);
  assert.ok(wrongPrefix.stderr.includes('Only the freshly owned temporary metadata fixture is allowed.'));
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

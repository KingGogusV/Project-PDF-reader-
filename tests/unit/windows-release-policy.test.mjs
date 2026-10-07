import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertPublicationRequest, assertNativeReleaseReport, assertCandidateUpgradeReport } from '../../scripts/windows-release-policy.mjs';

const sha = 'a'.repeat(40);
const env = { GITHUB_ACTIONS: 'true', CI: 'true', GITHUB_REPOSITORY: 'KingGogusV/Project-PDF-reader-',
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: sha };
const event = { inputs: { publish: 'true', expected_source_sha: sha } };

function nativeReport() {
  const names = [
    'same-account installed app starts with isolated loopback debugging',
    'packaged application opens without a development server',
    'real local form PDF renders nonblank pixels and native form widgets',
    'declining storage leaves the document library empty',
    'consented guest checkpoint reopens in an independent parser and preserves original bytes/unrelated fields',
    'reloading the actual native WebView restores the edited form from the device library',
    'a second real PDF searches all three pages and navigates results',
    'fixtures stay unchanged; observed document workflows make no upload or external requests',
    'OS window close asks about unsaved changes and cancellation keeps edits open',
    'real Save As cancellation and duplicate save/open/OS-close requests preserve pending edits and create no files',
    'choosing an existing synthetic PDF refuses replacement after OS confirmation and keeps edits open',
    'real Unicode Save As retry confirms disk bytes, clears dirty state, preserves originals and reopens edited forms',
    'native text annotation exports as a PDF annotation and the saved copy reopens',
    'real multi-chunk native binary IPC preserves an 8 MiB PDF byte-for-byte, independently parses and visibly reopens',
    'same-account installed app starts with isolated loopback debugging',
    'full native process termination and relaunch recover the last completed form checkpoint',
    'explicit native discard confirmation closes the real application cleanly',
  ];
  const report = {
    status: 'passed', mode: 'hosted-ci', sourceCommit: sha,
    executable: { machine: 'x64', sha256: 'b'.repeat(64) }, nativeCloseConfirmed: true,
    checks: names.map(name => ({ name, status: 'passed' })),
    nativeDialogs: ['inspect', 'inspect', 'cancel', 'save', 'confirm-existing', 'save', 'save', 'save']
      .map((action, index) => ({ action, status: 0, evidence: `D:\\task-owned\\save-dialog-${index}.json` })),
    pageErrors: [], consoleErrors: [], blockedExternalRequests: [], unexpectedWriteRequests: [],
    launches: ['stopped', 'closed'].map(status => ({ status, mode: 'ci',
      cleanup: { ownedJobEmpty: true, policyRemoved: true }, webview: { profileVerified: true, portVerified: true } })),
  };
  Object.assign(report.checks[4], { originalSha256: 'c'.repeat(64), latestSha256: 'd'.repeat(64), pageCount: 1 });
  Object.assign(report.checks[11], { filename: 'form-export-日本語-é.pdf', sha256: 'd'.repeat(64), byteLength: 9641 });
  Object.assign(report.checks[13], { byteLength: 8 * 1024 * 1024 + 1426, sha256: 'e'.repeat(64), minimumChunkCount: 9, pageCount: 1 });
  return report;
}
const nativeContext = { revision: sha, installedSha256: 'b'.repeat(64) };
const rejectNativeChanges = changes => {
  for (const change of changes) {
    const report = nativeReport();
    change(report);
    assert.throws(() => assertNativeReleaseReport(report, nativeContext), /Installed native verification/);
  }
};

const candidateContext = { revision: sha, installerSha256: 'a'.repeat(64), binaryIdentity: {
  builtSha256: 'f'.repeat(64), installedSha256: nativeContext.installedSha256,
  expectedInstalledSha256: nativeContext.installedSha256, bundleMarkerOffset: 4096,
  transformation: 'Tauri CLI 2.12.1 unsigned NSIS: UNK to NSS; all other bytes identical',
} };
function candidateReport() {
  const baseline = { version: '0.1.1', tag: 'v0.1.1-preview.1', source: '8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f',
    installerSha256: '32e7484d4ec716a513ff09ff86c85f3a4ac4f690be9c6d7e5b56c5b70d5a6be2',
    executableSha256: '63c3a9d7db7059eda88350ffec3b221e0bcb821e085fd504c558b684304a3d8c' };
  const candidate = { version: '0.1.2', source: sha, sourceCommit: sha, installerSha256: candidateContext.installerSha256,
    builtExecutableSha256: candidateContext.binaryIdentity.builtSha256, executableSha256: candidateContext.binaryIdentity.installedSha256,
    binaryIdentity: { ...candidateContext.binaryIdentity } };
  const target = 'D:\\task-owned\\FolioUpgrade-fixture';
  const links = [{ path: 'C:\\Users\\CI\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Folio.lnk',
    target: `${target}\\folio-desktop.exe`, sha256: 'c'.repeat(64) }];
  const names = [
    'published 0.1.1 installer installs to an empty temporary directory and creates owned Start-menu shortcuts',
    'published 0.1.1 starts in the same genuine default profile',
    ...nativeReport().checks.slice(1, 8).map(check => check.name),
    'three 0.1.1 library documents include two independently verified unsaved recovery PDFs and one unchanged PDF',
    'published 0.1.1 starts in the same genuine default profile',
    'completed 0.1.1 checkpoints survive an actual process restart before the installer upgrade',
    'candidate 0.1.2 installer upgrade replaces the exact source-bound executable and preserves owned Start-menu shortcut target',
    'candidate 0.1.2 starts in the same genuine default profile',
    'upgrade preserves every stored byte, record, revision, usage counter, schema version and preference',
    ...['mixed-pages.pdf', 'form.pdf', 'text-outline.pdf'].map(name => `upgraded ${name} visibly reopens and saves its exact preserved PDF bytes through native Save As`),
    'candidate 0.1.2 starts in the same genuine default profile',
    'second full 0.1.2 process restart retains originals and latest PDF bytes',
  ];
  const report = {
    schemaVersion: 1, status: 'passed', mode: 'disposable-hosted-ci-candidate', profileMode: 'default', sourceCommit: sha,
    baseline, candidate, versions: [structuredClone(baseline), structuredClone(candidate)], target,
    installerCleanupVerified: true, shortcutsCleanupVerified: true, preUpgradeCrash: { documentStoresPreserved: true },
    checks: names.map(name => ({ name, status: 'passed' })),
    pageErrors: [], consoleErrors: [], blockedExternalRequests: [], unexpectedWriteRequests: [],
    library: ['mixed-pages.pdf', 'form.pdf', 'text-outline.pdf'].map((name, index) => ({ name,
      originalSha256: 'f'.repeat(64), latestSha256: ['c', 'd', 'e'][index].repeat(64) })),
    nativeDialogs: [0, 1, 2].map(index => ({ action: 'save', status: 0, evidence: `D:\\task-owned\\save-dialog-${index}.json`,
      observed: { status: 'passed', action: 'save', ownedPid: 1003 } })),
    launches: [0, 1, 2, 3].map(index => ({ status: 'stopped', mode: 'ci', profileMode: 'default', childPid: 1001 + index,
      userDataFolderOverride: false, inheritedOverridesCleared: true, defaultProfileFresh: index === 0,
      cleanup: { ownedJobEmpty: true, policyRemoved: true }, webview: { profileMode: 'default', profileVerified: true, portVerified: true,
        actualProfile: 'C:\\Users\\CI\\AppData\\Local\\app.folio.localreader\\EBWebView' } })),
    installations: ['install', 'upgrade', 'uninstall'].map((action, index) => ({ action, version: index ? '0.1.2' : '0.1.1',
      mode: 'ci', exitCode: 0, target, shortcuts: { verified: true, startMenuVerified: true, capturedCount: 1,
        ...(index < 2 ? { links: structuredClone(links) } : { unchangedBeforeRemoval: true, removedCount: 1 }) } })),
  };
  for (const index of [1, 10]) report.checks[index].sha256 = baseline.executableSha256;
  for (const index of [13, 18]) report.checks[index].sha256 = candidate.executableSha256;
  Object.assign(report.checks[12], candidateContext.binaryIdentity);
  for (const [index, row] of report.library.entries()) Object.assign(report.checks[15 + index], {
    nativeSaveAs: true, receiptConfirmed: true, dirtyCleared: true, sha256: row.latestSha256, byteLength: 8722,
    filename: `upgraded-${row.name}`,
  });
  return report;
}
const rejectCandidateChanges = changes => {
  for (const change of changes) {
    const report = candidateReport();
    change(report);
    assert.throws(() => assertCandidateUpgradeReport(report, candidateContext), /Source-matched candidate upgrade/);
  }
};

test('candidate upgrade must bind pinned 0.1.1 and exact-source 0.1.2 installer/binary proof', () => {
  assert.doesNotThrow(() => assertCandidateUpgradeReport(candidateReport(), candidateContext));
  assert.throws(() => assertCandidateUpgradeReport(nativeReport(), candidateContext), /Source-matched candidate upgrade/);
  rejectCandidateChanges([
    report => { report.schemaVersion = 0; }, report => { report.mode = 'disposable-hosted-ci'; },
    report => { report.sourceCommit = 'b'.repeat(40); }, report => { report.baseline.source = sha; },
    report => { report.baseline.installerSha256 = 'f'.repeat(64); }, report => { report.baseline.executableSha256 = 'f'.repeat(64); },
    report => { report.versions[0].tag = 'v0.1.0-preview.1'; }, report => { report.candidate.version = '0.1.1'; },
    report => { report.candidate.installerSha256 = 'f'.repeat(64); }, report => { report.candidate.source = 'b'.repeat(40); },
    report => { report.candidate.builtExecutableSha256 = 'b'.repeat(64); }, report => { report.versions[1].executableSha256 = 'f'.repeat(64); },
    report => { report.candidate.binaryIdentity.bundleMarkerOffset++; }, report => { report.checks[12].builtSha256 = 'a'.repeat(64); },
    report => { report.checks[1].sha256 = candidateContext.binaryIdentity.installedSha256; },
    report => { report.checks[13].sha256 = report.baseline.executableSha256; },
  ]);
});

test('candidate upgrade requires all 20 ordered actual checks and three successful native Save As receipts', () => {
  rejectCandidateChanges([
    report => { report.checks.pop(); }, report => { report.checks[16] = { ...report.checks[15] }; },
    report => { report.checks[0].status = 'skipped'; }, report => { delete report.checks[0]; },
    report => { report.nativeDialogs.pop(); }, report => { report.nativeDialogs[0].action = 'cancel'; },
    report => { report.nativeDialogs[0].status = '0'; }, report => { report.nativeDialogs[0].observed.ownedPid = 1001; },
    report => { report.nativeDialogs[0].observed.status = 'failed'; }, report => { report.nativeDialogs[0].evidence = 'save-dialog-1.json'; },
    report => { report.checks[15].nativeSaveAs = 'true'; }, report => { report.checks[15].receiptConfirmed = false; },
    report => { report.checks[16].dirtyCleared = 'true'; }, report => { report.checks[16].sha256 = 'f'.repeat(64); },
    report => { report.checks[17].byteLength = 0; }, report => { report.checks[17].filename = 'form-folio.pdf'; },
    report => { report.library.pop(); }, report => { report.library[1].name = report.library[0].name; },
    report => { report.preUpgradeCrash.documentStoresPreserved = false; },
  ]);
});

test('candidate upgrade cannot use an overridden/preoccupied profile or incomplete owned launch cleanup', () => {
  rejectCandidateChanges([
    report => { report.profileMode = 'isolated'; }, report => { report.launches.pop(); },
    report => { report.launches[0].defaultProfileFresh = false; }, report => { report.launches[1].defaultProfileFresh = true; },
    report => { report.launches[0].userDataFolderOverride = true; }, report => { report.launches[0].inheritedOverridesCleared = 'true'; },
    report => { report.launches[1].webview.actualProfile = 'D:\\temporary-override\\EBWebView'; },
    report => { report.launches[2].webview.profileMode = 'isolated'; }, report => { report.launches[3].status = 'running'; },
    report => { report.launches[1].cleanup.ownedJobEmpty = false; }, report => { report.launches[1].cleanup.policyRemoved = 'true'; },
    report => { report.launches[2].webview.profileVerified = false; }, report => { report.launches[2].webview.portVerified = 'true'; },
    report => { report.installerCleanupVerified = 'true'; }, report => { report.shortcutsCleanupVerified = false; },
  ]);
});

test('candidate Start-menu verification requires exact owned links and guarded shortcut removal', () => {
  rejectCandidateChanges([
    report => { report.installations[0].exitCode = '0'; }, report => { report.installations[1].version = '0.1.1'; },
    report => { report.installations[1].target = 'D:\\unrelated'; }, report => { report.installations[1].shortcuts.verified = 'true'; },
    report => { report.installations[1].shortcuts.startMenuVerified = false; }, report => { report.installations[1].shortcuts.capturedCount = 2; },
    report => { report.installations[0].shortcuts.links[0].target = 'D:\\unrelated\\folio-desktop.exe'; },
    report => { report.installations[0].shortcuts.links[0].path = 'C:\\Users\\CI\\Desktop\\Folio.lnk'; },
    report => { report.installations[1].shortcuts.links[0].sha256 = 'invalid'; },
    report => { report.installations[2].shortcuts.unchangedBeforeRemoval = false; },
    report => { report.installations[2].shortcuts.removedCount = 0; },
  ]);
});

test('candidate page/console/privacy failures cannot become a release payload', () => {
  rejectCandidateChanges([
    ...['pageErrors', 'consoleErrors', 'blockedExternalRequests', 'unexpectedWriteRequests']
      .flatMap(field => [report => { report[field].push('synthetic observed failure'); }, report => { delete report[field]; }]),
    report => { report.status = 'failed'; }, report => { report.cleanupError = 'synthetic cleanup failure'; },
  ]);
});

test('new preview requires all 17 installed checks and eight successful owned dialog actions', () => {
  assert.doesNotThrow(() => assertNativeReleaseReport(nativeReport(), nativeContext));
});

test('historical, duplicate, reordered, skipped and failed installed checks cannot release', () => {
  rejectNativeChanges([
    report => { report.checks = report.checks.slice(0, 14); },
    report => { report.checks.push({ ...report.checks[0] }); },
    report => { report.checks[10] = { ...report.checks[9] }; },
    report => { [report.checks[9], report.checks[10]] = [report.checks[10], report.checks[9]]; },
    report => { report.checks[11].status = 'skipped'; },
    report => { report.checks[13].status = 'failed'; },
    report => { delete report.checks[0]; },
    report => { delete report.checks; },
  ]);
});

test('installed evidence must match the exact CI source and executable', () => {
  rejectNativeChanges([
    report => { report.status = 'running'; },
    report => { report.mode = 'normal-user-local'; },
    report => { report.sourceCommit = 'f'.repeat(40); },
    report => { report.executable.sha256 = 'f'.repeat(64); },
    report => { report.executable.machine = 'arm64'; },
    report => { delete report.executable; },
  ]);
  for (const context of [{ ...nativeContext, revision: sha.slice(0, 7) },
    { ...nativeContext, installedSha256: undefined }, { ...nativeContext, installedSha256: 'invalid' }]) {
    assert.throws(() => assertNativeReleaseReport(nativeReport(), context), /Installed native verification/);
  }
});

test('Save As evidence requires the selected Unicode copy and the independently parsed multi-chunk size/hash', () => {
  rejectNativeChanges([
    report => { delete report.checks[4].originalSha256; },
    report => { report.checks[4].latestSha256 = 'f'.repeat(64); },
    report => { report.checks[11].filename = 'form-folio.pdf'; },
    report => { report.checks[11].byteLength = 0; },
    report => { report.checks[11].sha256 = 'invalid'; },
    report => { report.checks[13].byteLength = 8 * 1024 * 1024; },
    report => { report.checks[13].byteLength = 150 * 1024 * 1024; },
    report => { report.checks[13].minimumChunkCount = 8; },
    report => { report.checks[13].minimumChunkCount = 10; },
    report => { report.checks[13].sha256 = 'invalid'; },
    report => { report.checks[13].pageCount = 0; },
  ]);
});

test('cancel, existing-file confirmation and retry must all have ordered successful dialog evidence', () => {
  rejectNativeChanges([
    report => { report.nativeDialogs.pop(); },
    report => { report.nativeDialogs.push({ ...report.nativeDialogs[0] }); },
    report => { report.nativeDialogs[4].action = 'cancel'; },
    report => { report.nativeDialogs[3].status = 1; },
    report => { report.nativeDialogs[3].status = '0'; },
    report => { report.nativeDialogs[3].error = 'synthetic helper error'; },
    report => { report.nativeDialogs[3].evidence = 'save-dialog-2.json'; },
    report => { delete report.nativeDialogs[3].evidence; },
    report => { delete report.nativeDialogs[0]; },
  ]);
});

test('page/console/privacy errors and missing cleanup/confirmed-close evidence cannot release', () => {
  rejectNativeChanges([
    ...['pageErrors', 'consoleErrors', 'blockedExternalRequests', 'unexpectedWriteRequests']
      .flatMap(field => [report => { report[field].push('synthetic observed failure'); }, report => { delete report[field]; }]),
    report => { report.nativeCloseConfirmed = false; },
    report => { report.launches.pop(); },
    report => { delete report.launches[0]; },
    report => { report.launches[1].status = 'stopped'; },
    report => { report.launches[0].mode = 'local'; },
    ...['ownedJobEmpty', 'policyRemoved'].flatMap(field => [
      report => { report.launches[0].cleanup[field] = false; }, report => { report.launches[1].cleanup[field] = 'true'; }]),
    ...['profileVerified', 'portVerified'].flatMap(field => [
      report => { report.launches[0].webview[field] = false; }, report => { delete report.launches[1].webview[field]; }]),
  ]);
});

test('publication accepts only an explicit source-matched main dispatch', () => {
  for (const publish of [true, 'true']) {
    assert.doesNotThrow(() => assertPublicationRequest(env, { inputs: { publish, expected_source_sha: sha } }));
  }
});

test('pushes and pull requests cannot publish even with publication inputs', () => {
  for (const GITHUB_EVENT_NAME of ['push', 'pull_request', 'pull_request_target', 'workflow_run', 'schedule']) {
    assert.throws(() => assertPublicationRequest({ ...env, GITHUB_EVENT_NAME }, event), /explicit workflow_dispatch/);
  }
});

test('verification-only dispatches and malformed opt-in values cannot publish', () => {
  for (const publish of [undefined, false, 'false', '', 'TRUE', 1, '1', {}, []]) {
    assert.throws(() => assertPublicationRequest(env, { inputs: { publish, expected_source_sha: sha } }), /not explicitly selected/);
  }
  for (const value of [undefined, null, {}, { inputs: null }]) {
    assert.throws(() => assertPublicationRequest(env, value), /not explicitly selected/);
  }
});

test('publication rejects wrong branches, repositories and non-CI contexts', () => {
  for (const patch of [{ GITHUB_REF: 'refs/heads/test/windows-upgrade-preservation' }, { GITHUB_REF: 'refs/tags/v0.1.2-preview.1' },
    { GITHUB_REPOSITORY: 'another/repository' }, { GITHUB_ACTIONS: 'false' }, { CI: '' }]) {
    assert.throws(() => assertPublicationRequest({ ...env, ...patch }, event), /explicit workflow_dispatch/);
  }
});

test('publication rejects missing, shortened, malformed or stale source confirmation', () => {
  for (const expected_source_sha of [undefined, '', sha.slice(0, 7), 'b'.repeat(40), sha + '\n']) {
    assert.throws(() => assertPublicationRequest(env, { inputs: { publish: true, expected_source_sha } }), /expected source SHA/);
  }
  for (const GITHUB_SHA of ['', 'a'.repeat(39), 'g'.repeat(40)]) {
    assert.throws(() => assertPublicationRequest({ ...env, GITHUB_SHA }, { inputs: { publish: true, expected_source_sha: GITHUB_SHA } }), /expected source SHA/);
  }
});

test('publisher CLI refuses automatic/default/stale requests before any network access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'folio-publication-policy-'));
  try {
    const payload = join(directory, 'event.json');
    const networkTrap = join(directory, 'network-trap.mjs');
    await writeFile(networkTrap, "globalThis.fetch = () => { throw new Error('UNEXPECTED_NETWORK_ACCESS'); };\n");
    for (const request of [
      { name: 'push', inputs: event.inputs, error: /explicit workflow_dispatch/ },
      { name: 'pull_request', inputs: event.inputs, error: /explicit workflow_dispatch/ },
      { name: 'workflow_dispatch', inputs: {}, error: /not explicitly selected/ },
      { name: 'workflow_dispatch', inputs: { publish: true, expected_source_sha: 'b'.repeat(40) }, error: /expected source SHA/ },
    ]) {
      await writeFile(payload, JSON.stringify({ inputs: request.inputs }));
      const result = spawnSync(process.execPath, ['--import', pathToFileURL(networkTrap).href, 'scripts/windows-release.mjs', 'publish'], {
        cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, ...env, GITHUB_EVENT_NAME: request.name, GITHUB_EVENT_PATH: payload, GITHUB_TOKEN: 'synthetic-unused-token' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.match(result.stderr, request.error);
      assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_ACCESS/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('explicit publication refuses a conflicting immutable tag before other API calls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'folio-publication-tag-'));
  try {
    const payload = join(directory, 'event.json');
    const mock = join(directory, 'tag-conflict.mjs');
    await writeFile(payload, JSON.stringify(event));
    await writeFile(mock, `globalThis.fetch = async (url, options) => {
      if (url !== 'https://api.github.com/repos/KingGogusV/Project-PDF-reader-/git/ref/tags/v0.1.2-preview.1' ||
          (options.method && options.method !== 'GET')) throw new Error('UNEXPECTED_API_CALL');
      return new Response(JSON.stringify({ object: { type: 'commit', sha: '${'b'.repeat(40)}' } }));
    };\n`);
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(mock).href, 'scripts/windows-release.mjs', 'publish'], {
      cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, ...env, GITHUB_EVENT_PATH: payload, GITHUB_TOKEN: 'synthetic-unused-token' },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Release tag does not identify the verified source commit/);
    assert.doesNotMatch(result.stderr, /UNEXPECTED_API_CALL/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

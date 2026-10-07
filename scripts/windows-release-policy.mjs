const repository = 'KingGogusV/Project-PDF-reader-';

const requiredNativeChecks = [
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
const requiredDialogActions = ['inspect', 'inspect', 'cancel', 'save', 'confirm-existing', 'save', 'save', 'save'];
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isOutputLength = value => Number.isSafeInteger(value) && value > 0 && value <= 256 * 1024 * 1024;
const previousPreview = {
  version: '0.1.1', tag: 'v0.1.1-preview.1', source: '8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f',
  installerSha256: '32e7484d4ec716a513ff09ff86c85f3a4ac4f690be9c6d7e5b56c5b70d5a6be2',
  executableSha256: '63c3a9d7db7059eda88350ffec3b221e0bcb821e085fd504c558b684304a3d8c',
};
const candidateUpgradeChecks = [
  'published 0.1.1 installer installs to an empty temporary directory and creates owned Start-menu shortcuts',
  'published 0.1.1 starts in the same genuine default profile',
  ...requiredNativeChecks.slice(1, 8),
  'three 0.1.1 library documents include two independently verified unsaved recovery PDFs and one unchanged PDF',
  'published 0.1.1 starts in the same genuine default profile',
  'completed 0.1.1 checkpoints survive an actual process restart before the installer upgrade',
  'candidate 0.1.3 installer upgrade replaces the exact source-bound executable and preserves owned Start-menu shortcut target',
  'candidate 0.1.3 starts in the same genuine default profile',
  'upgrade preserves every stored byte, record, revision, usage counter, schema version and preference',
  ...['mixed-pages.pdf', 'form.pdf', 'text-outline.pdf'].map(name => `upgraded ${name} visibly reopens and saves its exact preserved PDF bytes through native Save As`),
  'candidate 0.1.3 starts in the same genuine default profile',
  'second full 0.1.3 process restart retains originals and latest PDF bytes',
];
const binaryIdentityFields = ['builtSha256', 'installedSha256', 'expectedInstalledSha256', 'bundleMarkerOffset', 'transformation'];

export function assertCandidateUpgradeReport(report, { revision, installerSha256, binaryIdentity }) {
  const fail = () => { throw new Error('Source-matched candidate upgrade, default-profile preservation, Start-menu verification, or owned cleanup did not pass.'); };
  if (!/^[a-f0-9]{40}$/.test(revision || '') || !isDigest(installerSha256) ||
      !isDigest(binaryIdentity?.builtSha256) || !isDigest(binaryIdentity.installedSha256) ||
      binaryIdentity.expectedInstalledSha256 !== binaryIdentity.installedSha256 ||
      !Number.isSafeInteger(binaryIdentity.bundleMarkerOffset) || binaryIdentity.bundleMarkerOffset < 0 ||
      binaryIdentity.transformation !== 'Tauri CLI 2.12.1 unsigned NSIS: UNK to NSS; all other bytes identical' ||
      report?.schemaVersion !== 1 || report.mode !== 'disposable-hosted-ci-candidate' || report.profileMode !== 'default' ||
      report.status !== 'passed' || report.sourceCommit !== revision ||
      report.installerCleanupVerified !== true || report.shortcutsCleanupVerified !== true) fail();
  if (!Object.entries(previousPreview).every(([key, value]) => report.baseline?.[key] === value) ||
      !Array.isArray(report.versions) || report.versions.length !== 2 ||
      !Object.entries(previousPreview).every(([key, value]) => report.versions[0]?.[key] === value)) fail();
  const candidate = report.candidate;
  const candidateFields = { version: '0.1.3', source: revision, sourceCommit: revision, installerSha256,
    builtExecutableSha256: binaryIdentity.builtSha256, executableSha256: binaryIdentity.installedSha256 };
  if (!Object.entries(candidateFields).every(([key, value]) => candidate?.[key] === value && report.versions[1]?.[key] === value) ||
      !binaryIdentityFields.every(key => candidate.binaryIdentity?.[key] === binaryIdentity[key])) fail();
  if (!Array.isArray(report.checks) || report.checks.length !== candidateUpgradeChecks.length ||
      !candidateUpgradeChecks.every((name, index) => report.checks[index]?.name === name && report.checks[index].status === 'passed')) fail();
  if (![1, 10].every(index => report.checks[index].sha256 === previousPreview.executableSha256) ||
      ![13, 18].every(index => report.checks[index].sha256 === binaryIdentity.installedSha256) ||
      !binaryIdentityFields.every(key => report.checks[12][key] === binaryIdentity[key])) fail();
  for (const field of ['pageErrors', 'consoleErrors', 'blockedExternalRequests', 'unexpectedWriteRequests']) {
    if (!Array.isArray(report[field]) || report[field].length !== 0) fail();
  }
  for (const field of ['error', 'cleanupError', 'installerCleanupError']) if (report[field] !== undefined) fail();
  if (!Array.isArray(report.launches) || report.launches.length !== 4 ||
      ![0, 1, 2, 3].every(index => { const launch = report.launches[index]; return launch?.status === 'stopped' && launch.mode === 'ci' &&
        launch.profileMode === 'default' && launch.userDataFolderOverride === false && launch.inheritedOverridesCleared === true &&
        launch.defaultProfileFresh === (index === 0) &&
        Number.isSafeInteger(launch.childPid) && launch.childPid > 0 &&
        launch.cleanup?.ownedJobEmpty === true && launch.cleanup?.policyRemoved === true &&
        launch.webview?.profileVerified === true && launch.webview?.portVerified === true && launch.webview?.profileMode === 'default' &&
        typeof launch.webview.actualProfile === 'string' && /[\\/]app\.folio\.localreader[\\/]EBWebView$/.test(launch.webview.actualProfile) &&
        launch.webview.actualProfile === report.launches[0]?.webview?.actualProfile; })) fail();
  if (!Array.isArray(report.frontendDelivery) || report.frontendDelivery.length !== 2 ||
      ![2, 3].every((launchIndex, index) => { const delivered = report.frontendDelivery[index];
        return delivered?.launchIndex === launchIndex && delivered.firstNavigation === true &&
          delivered.origin === 'http://tauri.localhost' && delivered.pathname === '/index.html' && delivered.nativeQuery === '1' &&
          delivered.saveAsLabel === 'Save As' && delivered.registeredFolioWorkers === 0 && delivered.remainingFolioAppCaches === 0; })) fail();
  if (!Array.isArray(report.nativeDialogs) || report.nativeDialogs.length !== 3 ||
      ![0, 1, 2].every(index => { const dialog = report.nativeDialogs[index]; return dialog?.action === 'save' && dialog.status === 0 &&
        dialog.error === undefined && typeof dialog.evidence === 'string' &&
        new RegExp(`(?:^|[\\\\/])save-dialog-${index}\\.json$`).test(dialog.evidence) &&
        dialog.observed?.status === 'passed' && dialog.observed.action === 'save' && dialog.observed.ownedPid === report.launches[2].childPid; })) fail();
  const documentNames = ['mixed-pages.pdf', 'form.pdf', 'text-outline.pdf'];
  if (!Array.isArray(report.library) || report.library.length !== documentNames.length ||
      !documentNames.every(name => report.library.filter(row => row?.name === name).length === 1) ||
      !report.library.every(row => isDigest(row.originalSha256) && isDigest(row.latestSha256)) ||
      report.preUpgradeCrash?.documentStoresPreserved !== true) fail();
  if (!['upgraded-mixed-pages.pdf', 'upgraded-form.pdf', 'upgraded-text-outline.pdf'].every((filename, index) => {
    const check = report.checks[15 + index];
    return check.filename === filename && check.nativeSaveAs === true && check.receiptConfirmed === true && check.dirtyCleared === true &&
      isDigest(check.sha256) && isOutputLength(check.byteLength) &&
      check.sha256 === report.library.find(row => row.name === documentNames[index]).latestSha256;
  })) fail();
  if (typeof report.target !== 'string' || !report.target || !Array.isArray(report.installations) || report.installations.length !== 3 ||
      !['install', 'upgrade', 'uninstall'].every((action, index) => { const item = report.installations[index]; return item?.action === action &&
        item.version === (index === 0 ? '0.1.1' : '0.1.3') && item.mode === 'ci' && item.exitCode === 0 && item.target === report.target &&
        item.shortcuts?.verified === true && item.shortcuts.startMenuVerified === true &&
        Number.isSafeInteger(item.shortcuts.capturedCount) && item.shortcuts.capturedCount > 0 &&
        item.shortcuts.capturedCount === report.installations[0]?.shortcuts?.capturedCount; })) fail();
  for (const item of report.installations.slice(0, 2)) {
    const links = item.shortcuts.links;
    if (!Array.isArray(links) || links.length !== item.shortcuts.capturedCount ||
        !links.every(link => typeof link?.path === 'string' && link.target === `${report.target}\\folio-desktop.exe` && isDigest(link.sha256)) ||
        new Set(links.map(link => link.path.toLowerCase())).size !== links.length ||
        !links.some(link => /[\\/]Start Menu[\\/]Programs[\\/](?:Folio[\\/])?Folio\.lnk$/.test(link.path))) fail();
  }
  const installedPaths = report.installations[0].shortcuts.links.map(link => link.path);
  if (!report.installations[1].shortcuts.links.every(link => installedPaths.includes(link.path)) ||
      report.installations[2].shortcuts.unchangedBeforeRemoval !== true ||
      report.installations[2].shortcuts.removedCount !== report.installations[2].shortcuts.capturedCount) fail();
}

// Keep the complete installed-runtime contract explicit. Historical reports
// with fewer checks or helper failures cannot become a new release payload.
export function assertNativeReleaseReport(report, { revision, installedSha256 }) {
  const fail = () => { throw new Error('Installed native verification, source/binary identity, Save As evidence, or process/policy cleanup did not pass.'); };
  if (!/^[a-f0-9]{40}$/.test(revision || '') || !isDigest(installedSha256) ||
      report?.status !== 'passed' || report.mode !== 'hosted-ci' || report.sourceCommit !== revision ||
      report.executable?.machine !== 'x64' || report.executable.sha256 !== installedSha256 ||
      report.nativeCloseConfirmed !== true) fail();
  if (report.accountWebsite?.url !== 'https://folio-local-pdf.gogoi-ronnie.chatgpt.site' ||
      report.accountWebsite.readOnly !== true || report.accountWebsite.selectionVerified !== true ||
      report.accountWebsite.nativeCopyOnly !== true) fail();
  if (!Array.isArray(report.checks) || report.checks.length !== requiredNativeChecks.length ||
      !requiredNativeChecks.every((name, index) => report.checks[index]?.name === name && report.checks[index].status === 'passed')) fail();
  if (!Array.isArray(report.nativeDialogs) || report.nativeDialogs.length !== requiredDialogActions.length ||
      !requiredDialogActions.every((action, index) => { const dialog = report.nativeDialogs[index]; return dialog?.action === action && dialog.status === 0 &&
        dialog.error === undefined && typeof dialog.evidence === 'string' &&
        new RegExp(`(?:^|[\\\\/])save-dialog-${index}\\.json$`).test(dialog.evidence); })) fail();
  for (const field of ['pageErrors', 'consoleErrors', 'blockedExternalRequests', 'unexpectedWriteRequests']) {
    if (!Array.isArray(report[field]) || report[field].length !== 0) fail();
  }
  if (!Array.isArray(report.launches) || report.launches.length !== 2 ||
      !['stopped', 'closed'].every((status, index) => { const launch = report.launches[index]; return launch?.status === status && launch.mode === 'ci' &&
        launch.cleanup?.ownedJobEmpty === true && launch.cleanup?.policyRemoved === true &&
        launch.webview?.profileVerified === true && launch.webview?.portVerified === true; })) fail();
  const checkpoint = report.checks[4];
  const form = report.checks[11];
  const large = report.checks[13];
  if (!isDigest(checkpoint.originalSha256) || !isDigest(checkpoint.latestSha256) || checkpoint.pageCount !== 1 ||
      form.filename !== 'form-export-日本語-é.pdf' || !isDigest(form.sha256) || !isOutputLength(form.byteLength) ||
      checkpoint.latestSha256 !== form.sha256 || !isDigest(large.sha256) || !isOutputLength(large.byteLength) ||
      large.byteLength <= 8 * 1024 * 1024 || large.byteLength >= 150 * 1024 * 1024 || large.pageCount !== 1 ||
      large.minimumChunkCount !== Math.ceil(large.byteLength / (1024 * 1024)) || large.minimumChunkCount < 9) fail();
}

// Check the event payload, not an ambient publication flag. Calling the CLI
// directly must obey the same opt-in/source rules as the workflow job.
export function assertPublicationRequest(env, event) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true' ||
      env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('Publication requires an explicit workflow_dispatch on this repository\'s main branch.');
  }
  const inputs = event?.inputs;
  // GitHub's event context represents boolean inputs as strings; the typed
  // inputs context also supports actual booleans. Accept only explicit true.
  if (inputs?.publish !== true && inputs?.publish !== 'true') {
    throw new Error('Publication was not explicitly selected. Verification runs cannot publish.');
  }
  if (!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || '') ||
      inputs.expected_source_sha !== env.GITHUB_SHA) {
    throw new Error('Publication requires the full expected source SHA to match the workflow revision.');
  }
}

// Actual installer upgrades with synthetic data; default-profile mode is CI-only.
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium, expect } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { verifyNativeReader } from './reader-workflow.mjs';
import { candidateUpgradeIdentity } from './windows-upgrade-candidate.mjs';
import { verifyNsisBinaryIdentity } from '../../scripts/native-binary-identity.mjs';

assert.equal(process.platform, 'win32');
const candidateMode = process.argv[2] === '--ci-candidate';
const ci = candidateMode || process.argv[2] === '--ci';
assert.equal(process.argv.length, candidateMode ? 4 : ci ? 5 : 4,
  'Usage: node tests/native/windows-upgrade.mjs [--ci] <0.1.0 installer> <0.1.1 installer>, or --ci-candidate <pinned 0.1.1 installer>');
if (ci) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.CI, 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY, 'KingGogusV/Project-PDF-reader-');
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const published = JSON.parse(await readFile(new URL('./windows-upgrade-releases.json',import.meta.url),'utf8'));
let versions, builtCandidate;
if (candidateMode) {
  const baseline = { ...published.find(version => version.version === '0.1.1'), installer:await realpath(process.argv[3]) };
  assert.equal(sha256(await readFile(baseline.installer)), baseline.installerSha256);
  const buildRoot = join(repo,'src-tauri/target/release');
  const nsisRoot = join(buildRoot,'bundle/nsis');
  const installers = (await readdir(nsisRoot)).filter(name => name.toLowerCase().endsWith('.exe')).sort().map(name => join(nsisRoot,name));
  assert.equal(installers.length,1,'Exactly one candidate NSIS installer is required.');
  const candidateInstaller = await realpath(installers[0]);
  assert.equal(dirname(candidateInstaller),await realpath(nsisRoot),'Candidate installer must stay in the fixed build output.');
  builtCandidate = await readFile(join(buildRoot,'folio-desktop.exe'));
  const checkout = spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.ifError(checkout.error); assert.equal(checkout.status,0);
  const candidate = candidateUpgradeIdentity({ sourceCommit:process.env.GITHUB_SHA, checkoutCommit:checkout.stdout.trim(),
    packageJson:JSON.parse(await readFile(join(repo,'package.json'),'utf8')),
    cargoManifest:await readFile(join(repo,'src-tauri/Cargo.toml'),'utf8'),
    tauriConfig:JSON.parse(await readFile(join(repo,'src-tauri/tauri.conf.json'),'utf8')),
    installers:[candidateInstaller],builtBytes:builtCandidate,installerBytes:await readFile(candidateInstaller) });
  versions = [baseline,candidate];
} else {
  versions = published;
  for (const [index, version] of versions.entries()) {
    version.installer = await realpath(process.argv[index + (ci ? 3 : 2)]);
    assert.equal(sha256(await readFile(version.installer)), version.installerSha256);
  }
}
await mkdir(join(repo, 'test-results'), { recursive:true });
const output = candidateMode ? join(repo,'test-results/native-windows-candidate-upgrade') : await mkdtemp(join(repo, 'test-results/native-windows-upgrade-'));
if (candidateMode) await mkdir(output); // Never accept or overwrite stale candidate proof.
const temp = await realpath(ci ? process.env.RUNNER_TEMP : tmpdir());
const target = await mkdtemp(join(temp, 'FolioUpgrade-'));
let profile = candidateMode ? null : await mkdtemp(join(temp, 'FolioNativeProfile-'));
const copies = candidateMode ? await mkdtemp(join(temp,'FolioUpgradeCopies-')) : null;
const profileState = join(output,'default-profile-ownership.json');
const shortcutState = join(output,'shortcut-ownership.json');
const executable = join(target, 'folio-desktop.exe');
const fixtures = join(repo, 'tests/fixtures/generated');
const report = { schemaVersion:1, startedAt:new Date().toISOString(), status:'running', mode:candidateMode ? 'disposable-hosted-ci-candidate' : ci ? 'disposable-hosted-ci' : 'local-normal-user', sourceCommit:ci ? process.env.GITHUB_SHA : null,
  ...(candidateMode ? { candidate:versions[1], baseline:versions[0], profileMode:'default', nativeDialogs:[], frontendDelivery:[], retainedCopies:copies,
    installerCleanupVerified:false, shortcutsCleanupVerified:false } : {}),
  versions, target, retainedProfile:profile, checks:[], launches:[], installations:[], pageErrors:[],
  consoleErrors:[], requests:[], blockedExternalRequests:[], unexpectedWriteRequests:[], nativeIpcRequests:[],
  boundary:candidateMode
    ? 'Published x64 0.1.1 -> source-bound built 0.1.2 candidate installer; synthetic guest library in the genuine default app.folio.localreader profile of an elevated disposable CI account. No real user library is inspected; synthetic profile retained. This is not normal-user production data or every Windows version.'
    : 'Published x64 0.1.0 -> 0.1.1 installer, synthetic guest library, completed checkpoints, isolated overridden WebView2 profile; not an end-user default profile or every Windows version.' };
const checked = (name, evidence = {}) => { report.checks.push({ name, status:'passed', ...evidence }); console.log(`PASS ${name}`); };
let helper, browser, page, stopFile, launchReport, installedVersion, ownedPid, helperOutput = '';
const execFileAsync = promisify(execFile);
function installer(action, version) {
  const expected = action === 'upgrade' ? versions[0] : version;
  const args = ['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-upgrade-install.ps1'),'-Mode',ci ? 'ci' : 'local',
    '-Action',action,'-Target',target,'-Version',version.version,'-ExecutableSha256',expected.executableSha256];
  if (action !== 'uninstall') args.push('-Installer',version.installer,'-InstallerSha256',version.installerSha256);
  if (candidateMode) args.push('-CheckShortcuts','-ShortcutState',shortcutState,'-DefaultProfile');
  const result = spawnSync('pwsh.exe', args, { cwd:repo, windowsHide:true, encoding:'utf8', timeout:130000 });
  if (result.status !== 0) {
    report.installations.push({ action, version:version.version, status:'failed', stdout:result.stdout, stderr:result.stderr, error:result.error?.message });
    throw new Error(result.stderr || result.error?.message || result.stdout);
  }
  const installation = JSON.parse(result.stdout.trim());
  report.installations.push(installation);
  if (candidateMode) {
    assert.equal(installation.shortcuts.verified,true); assert.equal(installation.shortcuts.startMenuVerified,true);
    assert.ok(installation.shortcuts.capturedCount > 0);
    if (action === 'uninstall') {
      assert.equal(installation.shortcuts.unchangedBeforeRemoval,true);
      assert.equal(installation.shortcuts.removedCount,installation.shortcuts.capturedCount);
      report.installerCleanupVerified = true; report.shortcutsCleanupVerified = true;
    }
  }
  installedVersion = action === 'uninstall' ? undefined : version;
}
async function stopOwned() {
  if (!helper) return;
  if (helper.exitCode === null && helper.signalCode === null) {
    await writeFile(stopFile, 'stop');
    const deadline = Date.now() + 15000;
    while (helper.exitCode === null && helper.signalCode === null && Date.now() < deadline) await delay(100);
  }
  assert.notEqual(helper.exitCode, null, 'Owned launcher did not stop within cleanup bound.');
  const ended = JSON.parse(await readFile(launchReport, 'utf8'));
  report.launches.push(ended);
  assert.equal(ended.cleanup.ownedJobEmpty, true); assert.equal(ended.cleanup.policyRemoved, true);
  const helperExitCode = helper.exitCode;
  if (browser) { try { await browser.close(); } finally { browser = undefined; } }
  helper = undefined;
  assert.equal(helperExitCode, 0, ended.error || helperOutput);
  assert.equal(ended.status, 'stopped');
}
async function startOwned(version) {
  assert.equal(sha256(await readFile(executable)), version.executableSha256);
  const server = createServer();
  await new Promise((r,j) => { server.once('error',j); server.listen(0,'127.0.0.1',r); });
  const port = server.address().port; await new Promise(r => server.close(r));
  const iteration = report.launches.length;
  launchReport = join(output, `launch-${iteration}.json`); stopFile = join(output, `stop-${iteration}`);
  helper = spawn('pwsh.exe', ['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-owned-launch.ps1'),
    '-Mode',ci ? 'ci' : 'local','-Executable',executable,'-ExpectedSha256',version.executableSha256,
    ...(candidateMode ? ['-ProfileMode','default','-ProfileState',profileState] : ['-Profile',profile]),
    '-Port',String(port),'-ReportPath',launchReport,'-StopFile',stopFile],
    { cwd:repo, windowsHide:true, stdio:['ignore','pipe','pipe'] });
  let failure; helper.on('error',error => { failure = error; });
  const capture = bytes => { helperOutput = (helperOutput + bytes).slice(-64000); };
  helper.stdout.on('data',capture); helper.stderr.on('data',capture);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (failure) throw failure;
    if (helper.exitCode !== null) throw new Error(`Launcher stopped (${helper.exitCode}): ${helperOutput}`);
    let launch;
    try { launch = JSON.parse(await readFile(launchReport,'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (launch?.status === 'failed') throw new Error(launch.error);
    if (launch?.webview?.profileVerified && launch.webview.portVerified) {
      let connected;
      try { connected = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout:1500 }); }
      catch { await delay(200); continue; }
      browser = connected;
      assert.equal(launch.parentPid, helper.pid); if (!ci) assert.equal(launch.elevated, false);
      ownedPid = launch.childPid;
      if (candidateMode) {
        assert.equal(launch.profileMode,'default'); assert.equal(launch.webview.profileMode,'default');
        assert.equal(launch.userDataFolderOverride,false); assert.equal(launch.inheritedOverridesCleared,true);
        const actualProfile = dirname(launch.webview.actualProfile);
        if (profile) assert.equal(actualProfile,profile); else profile = actualProfile;
        report.retainedProfile = profile;
      }
      report.webviewVersion = browser.version();
      checked(`${candidateMode && version === versions[1] ? 'candidate' : 'published'} ${version.version} starts in the same ${candidateMode ? 'genuine default' : 'isolated'} profile`, { sha256:version.executableSha256, elevated:launch.elevated });
      return;
    }
    await delay(200);
  }
  throw new Error('Owned app did not expose its requested connection within 45 seconds.');
}
async function snapshot() {
  return page.evaluate(async () => {
    const db = await new Promise((r,j) => { const request = indexedDB.open('folio-local-library'); request.onsuccess = () => r(request.result); request.onerror = () => j(request.error); });
    try {
      const stores = ['documents','originals','latest','usage'];
      const values = await Promise.all(stores.map(store => new Promise((r,j) => {
        const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => r(request.result); request.onerror = () => j(request.error);
      })));
      for (const rows of values) for (const row of rows) if (row.bytes) row.bytes = Array.from(new Uint8Array(row.bytes instanceof ArrayBuffer ? row.bytes : await row.bytes.arrayBuffer()));
      return { version:db.version, stores:Object.fromEntries(stores.map((store,i) => [store,values[i]])),
        preferences:Object.fromEntries(Object.keys(localStorage).sort().map(key => [key,localStorage.getItem(key)])) };
    } finally { db.close(); }
  });
}
async function verifySnapshot(state) {
  assert.equal(state.stores.documents.length, 3);
  assert.equal(state.stores.documents.filter(row => row.needsRecovery).length, 2);
  assert.equal(state.stores.usage[0].documentCount, 3);
  let used = 0;
  for (const row of state.stores.documents) {
    const original = state.stores.originals.find(entry => entry.id === row.id && entry.owner === row.owner);
    const latest = row.latestIsOriginal ? original : state.stores.latest.find(entry => entry.id === row.id && entry.owner === row.owner);
    assert.ok(original && latest);
    const source = await readFile(join(fixtures,row.name));
    const bytes = Buffer.from(latest.bytes);
    assert.deepEqual(Buffer.from(original.bytes), source);
    assert.equal(sha256(source), row.originalSha256); assert.equal(sha256(bytes), row.latestSha256);
    assert.equal(source.length, row.originalSize); assert.equal(bytes.length, row.latestSize);
    used += source.length + (row.latestIsOriginal ? 0 : bytes.length);
    const pdf = await PDFDocument.load(bytes); const originalPdf = await PDFDocument.load(source);
    assert.equal(pdf.getPageCount(), originalPdf.getPageCount());
    assert.deepEqual(pdf.getPages().map(p => p.getSize()), originalPdf.getPages().map(p => p.getSize()));
    if (row.name === 'form.pdf') {
      assert.equal(pdf.getForm().getTextField('reader_name').getText(), 'Unexported form survives installer upgrade');
      assert.equal(pdf.getForm().getTextField('notes').getText(), originalPdf.getForm().getTextField('notes').getText());
      assert.deepEqual(bytes.subarray(0,source.length), source);
    } else if (row.name === 'text-outline.pdf') {
      const annotations = pdf.getPage(0).node.Annots().asArray().map(ref => pdf.context.lookup(ref));
      assert.ok(annotations.some(entry => entry.get(PDFName.of('Subtype'))?.toString() === '/FreeText'
        && entry.get(PDFName.of('Contents'))?.decodeText() === 'Unexported annotation survives upgrade'));
      assert.deepEqual(bytes.subarray(0,source.length), source);
    } else assert.deepEqual(bytes, source);
  }
  assert.equal(state.stores.usage[0].storedBytes, used);
}
async function upgradedPage() {
  const context = browser.contexts()[0]; context.setDefaultTimeout(15000);
  await expect.poll(() => context.pages().filter(p => p.url().startsWith('http://tauri.localhost')).length).toBe(1);
  page = context.pages().find(p => p.url().startsWith('http://tauri.localhost'));
  page.on('pageerror',error => report.pageErrors.push(error.message));
  page.on('console',message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0,1000)); });
  page.on('dialog',dialog => { void dialog.accept(); });
  context.on('request',request => {
    const url = new URL(request.url());
    const item = { method:request.method(),url:url.origin + url.pathname,type:request.resourceType() };
    if (report.requests.length < 1000) report.requests.push(item);
    if (url.protocol === 'ipc:' || url.hostname === 'ipc.localhost') report.nativeIpcRequests.push(item);
  });
  await context.route('**/*',route => {
    const url = new URL(route.request().url());
    if (['http:','https:','ws:','wss:'].includes(url.protocol) && !['tauri.localhost','ipc.localhost'].includes(url.hostname)) {
      report.blockedExternalRequests.push(url.origin + url.pathname); return route.abort('internetdisconnected');
    }
    if (!['GET','HEAD'].includes(route.request().method()) && !['ipc:'].includes(url.protocol) && url.hostname !== 'ipc.localhost') report.unexpectedWriteRequests.push(url.origin + url.pathname);
    return route.continue();
  });
  await context.routeWebSocket('**/*',socket => { report.blockedExternalRequests.push(socket.url()); socket.close(); });
  if (candidateMode && installedVersion === versions[1]) {
    // Prove the first user-visible navigation is current before the harness's
    // controlled reload; an extra test reload must not conceal a stale shell.
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#export .save-label')).toHaveText('Save As');
    const frontend = await page.evaluate(async () => {
      const url = new URL(location.href);
      const rootScope = new URL('/', url).href;
      const script = new URL('/sw.js', url).href;
      const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      const workers = registrations.filter(registration => registration.scope === rootScope &&
        [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === script));
      return { origin:url.origin, pathname:url.pathname, nativeQuery:url.searchParams.get('folio-native'),
        saveAsLabel:document.querySelector('#export .save-label')?.textContent,
        registeredFolioWorkers:workers.length,
        remainingFolioAppCaches:'caches' in window ? (await caches.keys()).filter(key => key.startsWith('folio-app-')).length : 0 };
    });
    assert.deepEqual(frontend, {origin:'http://tauri.localhost',pathname:'/index.html',nativeQuery:'1',saveAsLabel:'Save As',
      registeredFolioWorkers:0,remainingFolioAppCaches:0});
    report.frontendDelivery.push({launchIndex:report.launches.length,firstNavigation:true,...frontend});
  }
  await page.reload({ waitUntil:'domcontentloaded' }); await expect(page.locator('#welcome')).toBeVisible();
}
async function saveCandidateCopy(path) {
  const evidence = join(output,`save-dialog-${report.nativeDialogs.length}.json`);
  await page.locator('#export').click();
  let result;
  try {
    const completed = await execFileAsync('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-save-dialog.ps1'),
      '-Mode','ci','-OwnedPid',String(ownedPid),'-ExpectedExecutable',executable,'-ExpectedSha256',versions[1].executableSha256,
      '-TestRoot',copies,'-ReportPath',evidence,'-Action','save','-Destination',path],
      {cwd:repo,windowsHide:true,encoding:'utf8',timeout:25000,maxBuffer:256000});
    result = {...completed,status:0};
  } catch (error) {
    result = {stdout:error.stdout || '',stderr:error.stderr || '',status:Number.isInteger(error.code) ? error.code : null,
      error:Number.isInteger(error.code) ? undefined : error};
  }
  const record = {action:'save',evidence,status:result.status,error:result.error?.message};
  report.nativeDialogs.push(record);
  assert.ifError(result.error); assert.equal(result.status,0,result.stderr || 'Owned candidate Save As failed.');
  const observed = JSON.parse(result.stdout);
  record.observed = observed;
  assert.equal(observed.status,'passed'); assert.equal(observed.action,'save'); assert.equal(observed.ownedPid,ownedPid);
  await expect(page.locator('#export')).toBeEnabled({timeout:30000});
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(0);
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(page.locator('#toast')).toHaveText(`Saved new PDF copy: ${basename(path)}. Your original is unchanged.`);
  return await readFile(path);
}
async function workflow() {
  installer('install', versions[0]); checked(`published ${versions[0].version} installer installs to an empty temporary directory${candidateMode ? ' and creates owned Start-menu shortcuts' : ''}`);
  await startOwned(versions[0]);
  const flow = await verifyNativeReader({ browser, output, fixtures, report, checked }); page = flow.page;
  await page.locator('#store-local').click(); await page.getByRole('button',{name:'Enable local recovery',exact:true}).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  await page.locator('#page-number').fill('1'); await page.locator('#page-number').press('Enter');
  await page.locator('#scale').selectOption('page-fit'); await page.locator('#tool-text').click();
  const layer = flow.active().locator('.page[data-page-number="1"] .annotationEditorLayer');
  await layer.click({ position:{x:120,y:260} });
  await layer.locator('.freeTextEditor [contenteditable="true"]').last().fill('Unexported annotation survives upgrade');
  await page.locator('#tool-select').click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  await page.getByRole('tab',{name:/form.pdf/}).click();
  await flow.active().locator('input[name="reader_name"]').fill('Unexported form survives installer upgrade');
  await page.locator('#page-total').click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  await flow.openPdf('mixed-pages.pdf');
  // A previous tab can satisfy generic "reader is ready" checks while the new
  // file chooser event is still opening its document. Wait for this exact tab.
  await expect(page.getByRole('tab',{name:'mixed-pages.pdf',exact:true})).toHaveAttribute('aria-selected','true');
  await flow.ready();
  await page.locator('#store-local').click(); await page.getByRole('button',{name:'Enable local recovery',exact:true}).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  // Wait for independently parsed bytes, rather than a possibly stale status label.
  await expect.poll(async () => { try { await verifySnapshot(await snapshot()); return true; } catch { return false; } },{timeout:20000}).toBe(true);
  const initial = await snapshot(); await verifySnapshot(initial);
  await writeFile(join(output,'pre-crash.json'),JSON.stringify(initial));
  checked(`three ${versions[0].version} library documents include two independently verified unsaved recovery PDFs and one unchanged PDF`);
  await stopOwned();
  // Read the durable baseline from a fresh old-version process. localStorage
  // recent-file writes can lag their synchronous API when a job is terminated;
  // record that separately rather than attributing it to the installer upgrade.
  await startOwned(versions[0]); await upgradedPage();
  const before = await snapshot(); await verifySnapshot(before);
  assert.deepEqual(before.stores,initial.stores);
  report.preUpgradeCrash = { documentStoresPreserved:true,
    preferencesPreserved:JSON.stringify(before.preferences) === JSON.stringify(initial.preferences),
    initialPreferences:initial.preferences, durablePreferences:before.preferences };
  await writeFile(join(output,'before.json'),JSON.stringify(before));
  checked(`completed ${versions[0].version} checkpoints survive an actual process restart before the installer upgrade`);
  await stopOwned();
  installer('upgrade', versions[1]);
  assert.equal(sha256(await readFile(executable)), versions[1].executableSha256);
  if (candidateMode) {
    const identity = verifyNsisBinaryIdentity(builtCandidate,await readFile(executable),'2.12.1');
    assert.deepEqual(identity,versions[1].binaryIdentity);
    checked('candidate 0.1.2 installer upgrade replaces the exact source-bound executable and preserves owned Start-menu shortcut target',identity);
  } else checked('normal 0.1.1 installer upgrade replaces the exact owned published executable');
  await startOwned(versions[1]); await upgradedPage();
  const after = await snapshot(); await writeFile(join(output,'after.json'),JSON.stringify(after));
  assert.deepEqual(after, before); await verifySnapshot(after);
  report.library = before.stores.documents.map(row => ({ name:row.name, id:row.id, owner:row.owner, revision:row.revision,
    needsRecovery:row.needsRecovery, originalSha256:row.originalSha256, latestSha256:row.latestSha256 }));
  checked('upgrade preserves every stored byte, record, revision, usage counter, schema version and preference');
  const active = () => page.locator('.document-host:not([hidden])');
  for (const name of ['mixed-pages.pdf','form.pdf','text-outline.pdf']) {
    await page.locator('#library').click();
    const row = page.locator('.library-row').filter({has:page.getByRole('heading',{name,exact:true})});
    if (name !== 'mixed-pages.pdf') await expect(row.locator('.recovery-badge')).toHaveText('Recovery copy available');
    await row.locator('[data-library-action="open"]').click();
    await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
    await expect(active().locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded','true');
    if (name === 'form.pdf') await expect(active().locator('input[name="reader_name"]')).toHaveValue('Unexported form survives installer upgrade');
    if (name === 'text-outline.pdf') {
      const annotation = active().locator('.freeTextAnnotation');
      await expect(annotation).toContainText('Unexported annotation survives upgrade');
      await annotation.scrollIntoViewIfNeeded(); await expect(annotation).toBeVisible();
    }
    await page.screenshot({path:join(output,`upgraded-${name}.png`)});
    const original = before.stores.documents.find(doc => doc.name === name);
    if (candidateMode) {
      const path = join(copies,`upgraded-${name}`);
      const bytes = await saveCandidateCopy(path);
      assert.equal(sha256(bytes),original.latestSha256);
      assert.deepEqual(bytes,Buffer.from((original.latestIsOriginal ? before.stores.originals : before.stores.latest)
        .find(entry => entry.id === original.id && entry.owner === original.owner).bytes));
      checked(`upgraded ${name} visibly reopens and saves its exact preserved PDF bytes through native Save As`,
        {nativeSaveAs:true,sha256:sha256(bytes),byteLength:bytes.length,filename:basename(path),receiptConfirmed:true,dirtyCleared:true});
    } else {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        (async () => {
          await page.locator('#export').click();
          await expect(page.locator('#dialog-title')).toHaveText('Your PDF copy is ready');
          await expect(page.getByRole('button',{name:'I saved the copy',exact:true})).toBeVisible();
        })(),
      ]);
      const path = join(output,`upgraded-${name}`); await download.saveAs(path); assert.equal(await download.failure(),null);
      assert.equal(sha256(await readFile(path)), original.latestSha256);
      await page.getByRole('button',{name:'I saved the copy',exact:true}).click();
      await expect(page.locator('#dialog')).toBeHidden();
      await expect(page.locator('#export')).toBeEnabled();
      checked(`upgraded ${name} visibly reopens and exports its exact preserved PDF bytes`);
    }
  }
  await stopOwned(); await startOwned(versions[1]); await upgradedPage();
  const restarted = await snapshot();
  assert.deepEqual(restarted.stores.originals, before.stores.originals); assert.deepEqual(restarted.stores.latest, before.stores.latest);
  assert.equal(restarted.stores.documents.length, 3);
  checked(`second full ${versions[1].version} process restart retains originals and latest PDF bytes`);
  assert.deepEqual(report.pageErrors,[]); assert.deepEqual(report.blockedExternalRequests,[]); assert.deepEqual(report.unexpectedWriteRequests,[]);
  if (candidateMode) assert.deepEqual(report.consoleErrors,[]);
}
try {
  await workflow(); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error.stack);
  if (page && !page.isClosed()) try { await page.screenshot({path:join(output,'failure.png'),timeout:3000}); report.failureUi = await page.locator('body').innerText({timeout:2000}); } catch {}
} finally {
  try { await stopOwned(); } catch (error) { report.status='failed'; report.cleanupError=error.stack; process.exitCode=1; }
  // Detect a partial install/upgrade only by exact published bytes in our fresh
  // target. Cleanup rechecks the path, registry ownership and executable hash.
  if (!helper) {
    try {
      const digest = sha256(await readFile(executable));
      installedVersion = versions.find(version => version.executableSha256 === digest);
      if (!installedVersion) throw new Error('Unknown owned executable bytes; refusing automated uninstall.');
    } catch (error) {
      if (error.code !== 'ENOENT') { report.status='failed'; report.installerCleanupError=error.stack; process.exitCode=1; }
    }
  }
  if (installedVersion && !helper) {
    try { installer('uninstall',installedVersion); report.installerCleanup = 'owned registration and executable removed; synthetic profile retained'; }
    catch (error) { report.status='failed'; report.installerCleanupError=error.stack; process.exitCode=1; }
  }
  if (candidateMode && report.status === 'passed' && (!report.installerCleanupVerified || !report.shortcutsCleanupVerified)) {
    report.status='failed'; report.installerCleanupError='Candidate installation or captured shortcut cleanup was not verified.'; process.exitCode=1;
  }
  report.completedAt = new Date().toISOString();
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(output,'launcher.log'),helperOutput);
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,output}));
}

// Actual published installer upgrade, with a synthetic, isolated WebView profile.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { verifyNativeReader } from './reader-workflow.mjs';

assert.equal(process.platform, 'win32');
const ci = process.argv[2] === '--ci';
assert.equal(process.argv.length, ci ? 5 : 4, 'Usage: node tests/native/windows-upgrade.mjs [--ci] <0.1.0 installer> <0.1.1 installer>');
if (ci) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.CI, 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY, 'KingGogusV/Project-PDF-reader-');
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const versions = JSON.parse(await readFile(new URL('./windows-upgrade-releases.json',import.meta.url),'utf8'));
for (const [index, version] of versions.entries()) {
  version.installer = await realpath(process.argv[index + (ci ? 3 : 2)]);
  assert.equal(sha256(await readFile(version.installer)), version.installerSha256);
}
await mkdir(join(repo, 'test-results'), { recursive:true });
const output = await mkdtemp(join(repo, 'test-results/native-windows-upgrade-'));
const temp = await realpath(ci ? process.env.RUNNER_TEMP : tmpdir());
const target = await mkdtemp(join(temp, 'FolioUpgrade-'));
const profile = await mkdtemp(join(temp, 'FolioNativeProfile-'));
const executable = join(target, 'folio-desktop.exe');
const fixtures = join(repo, 'tests/fixtures/generated');
const report = { startedAt:new Date().toISOString(), status:'running', mode:ci ? 'disposable-hosted-ci' : 'local-normal-user', sourceCommit:ci ? process.env.GITHUB_SHA : null,
  versions, target, retainedProfile:profile, checks:[], launches:[], installations:[], pageErrors:[],
  consoleErrors:[], requests:[], blockedExternalRequests:[], unexpectedWriteRequests:[], nativeIpcRequests:[],
  boundary:'Published x64 0.1.0 -> 0.1.1 installer, synthetic guest library, completed checkpoints, isolated overridden WebView2 profile; not an end-user default profile or every Windows version.' };
const checked = (name, evidence = {}) => { report.checks.push({ name, status:'passed', ...evidence }); console.log(`PASS ${name}`); };
let helper, browser, page, stopFile, launchReport, installedVersion, helperOutput = '';
function installer(action, version) {
  const expected = action === 'upgrade' ? versions[0] : version;
  const args = ['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-upgrade-install.ps1'),'-Mode',ci ? 'ci' : 'local',
    '-Action',action,'-Target',target,'-Version',version.version,'-ExecutableSha256',expected.executableSha256];
  if (action !== 'uninstall') args.push('-Installer',version.installer,'-InstallerSha256',version.installerSha256);
  const result = spawnSync('pwsh.exe', args, { cwd:repo, windowsHide:true, encoding:'utf8', timeout:130000 });
  if (result.status !== 0) {
    report.installations.push({ action, version:version.version, status:'failed', stdout:result.stdout, stderr:result.stderr, error:result.error?.message });
    throw new Error(result.stderr || result.error?.message || result.stdout);
  }
  report.installations.push(JSON.parse(result.stdout.trim()));
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
    '-Profile',profile,'-Port',String(port),'-ReportPath',launchReport,'-StopFile',stopFile],
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
      report.webviewVersion = browser.version();
      checked(`published ${version.version} starts in the same isolated profile`, { sha256:version.executableSha256, elevated:launch.elevated });
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
  page.on('dialog',dialog => { void dialog.accept(); });
  await context.route('**/*',route => {
    const url = new URL(route.request().url());
    if (['http:','https:','ws:','wss:'].includes(url.protocol) && !['tauri.localhost','ipc.localhost'].includes(url.hostname)) {
      report.blockedExternalRequests.push(url.origin + url.pathname); return route.abort('internetdisconnected');
    }
    if (!['GET','HEAD'].includes(route.request().method()) && !['ipc:'].includes(url.protocol) && url.hostname !== 'ipc.localhost') report.unexpectedWriteRequests.push(url.origin + url.pathname);
    return route.continue();
  });
  await context.routeWebSocket('**/*',socket => { report.blockedExternalRequests.push(socket.url()); socket.close(); });
  await page.reload({ waitUntil:'domcontentloaded' }); await expect(page.locator('#welcome')).toBeVisible();
}
async function workflow() {
  installer('install', versions[0]); checked('published 0.1.0 installer installs to an empty temporary directory');
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
  await page.locator('#store-local').click(); await page.getByRole('button',{name:'Enable local recovery',exact:true}).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  // Wait for independently parsed bytes, rather than a possibly stale status label.
  await expect.poll(async () => { try { await verifySnapshot(await snapshot()); return true; } catch { return false; } },{timeout:20000}).toBe(true);
  const before = await snapshot(); await verifySnapshot(before);
  await writeFile(join(output,'before.json'),JSON.stringify(before));
  checked('three 0.1.0 library documents include two independently verified unsaved recovery PDFs and one unchanged PDF');
  await stopOwned();
  installer('upgrade', versions[1]);
  assert.equal(sha256(await readFile(executable)), versions[1].executableSha256);
  checked('normal 0.1.1 installer upgrade replaces the exact owned published executable');
  await startOwned(versions[1]); await upgradedPage();
  const after = await snapshot(); await writeFile(join(output,'after.json'),JSON.stringify(after));
  assert.deepEqual(after, before); await verifySnapshot(after);
  report.library = before.stores.documents.map(row => ({ name:row.name, id:row.id, owner:row.owner, revision:row.revision,
    needsRecovery:row.needsRecovery, originalSha256:row.originalSha256, latestSha256:row.latestSha256 }));
  checked('upgrade preserves every stored byte, record, revision, usage counter, schema version and preference');
  const active = () => page.locator('.document-host:not([hidden])');
  for (const name of ['form.pdf','text-outline.pdf','mixed-pages.pdf']) {
    await page.locator('#library').click();
    const row = page.locator('.library-row').filter({has:page.getByRole('heading',{name,exact:true})});
    if (name !== 'mixed-pages.pdf') await expect(row.locator('.recovery-badge')).toHaveText('Recovery copy available');
    await row.locator('[data-library-action="open"]').click();
    await expect(active().locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded','true');
    if (name === 'form.pdf') await expect(active().locator('input[name="reader_name"]')).toHaveValue('Unexported form survives installer upgrade');
    if (name === 'text-outline.pdf') await expect(active().locator('.freeTextAnnotation')).toContainText('Unexported annotation survives upgrade');
    await page.screenshot({path:join(output,`upgraded-${name}.png`)});
    const downloadEvent = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await downloadEvent; const path = join(output,`upgraded-${name}`); await download.saveAs(path); assert.equal(await download.failure(),null);
    const original = before.stores.documents.find(doc => doc.name === name);
    assert.equal(sha256(await readFile(path)), original.latestSha256);
    if (await page.getByRole('button',{name:'I saved the copy',exact:true}).count()) await page.getByRole('button',{name:'I saved the copy',exact:true}).click();
    checked(`upgraded ${name} visibly reopens and exports its exact preserved PDF bytes`);
  }
  await stopOwned(); await startOwned(versions[1]); await upgradedPage();
  const restarted = await snapshot();
  assert.deepEqual(restarted.stores.originals, before.stores.originals); assert.deepEqual(restarted.stores.latest, before.stores.latest);
  assert.equal(restarted.stores.documents.length, 3);
  checked('second full 0.1.1 process restart retains originals and latest PDF bytes');
  assert.deepEqual(report.pageErrors,[]); assert.deepEqual(report.blockedExternalRequests,[]); assert.deepEqual(report.unexpectedWriteRequests,[]);
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
  report.completedAt = new Date().toISOString();
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(output,'launcher.log'),helperOutput);
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,output}));
}

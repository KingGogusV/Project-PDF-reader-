import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// This launches an installed package only on a disposable Windows GitHub runner.
// It never installs software, changes registry/policy, or changes app permissions.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(repo, 'test-results/native-windows');
const fixtures = join(repo, 'tests/fixtures/generated');
const launcherScript = join(repo, 'tests/native/windows-token-launch.ps1');
const tokenReportPath = join(output, 'token-launch.json');
const STARTUP_TIMEOUT = 45_000;
const OVERALL_TIMEOUT = 180_000;
const report = {
  startedAt: new Date().toISOString(), platform: process.platform,
  status: 'running', checks: [], requests: [], blockedExternalRequests: [],
  unexpectedWriteRequests: [], nativeIpcRequests: [], pageErrors: [], consoleErrors: [],
  networkScope: 'App requests observed from controlled reload onward; external HTTP(S) and WebSockets blocked. OS/runtime update traffic is outside this observation.',
};
let ownedProcess;
let browser;
let page;
let overallTimer;
let processOutput = '';
let browserLogPath;
let stopFilePath;

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function inside(root, target) {
  const part = relative(root, target);
  return part !== '' && part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}
function checked(name, evidence = {}) {
  report.checks.push({ name, status: 'passed', ...evidence });
  console.log(`PASS ${name}`);
}
function localAsset(url) {
  // Tauri serves these origins from the installed executable, not an HTTP server.
  return ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'tauri.localhost' && !url.port)
    || (url.protocol === 'tauri:' && url.hostname === 'localhost');
}
function safeUrl(value) {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return value.slice(0,200); }
}
function describeError(error, depth = 0) {
  if (!error || depth > 5) return undefined;
  return { name:error.name, message:String(error.message ?? error), code:error.code,
    stack:error.stack, cause:describeError(error.cause,depth + 1) };
}
async function readLaunchReport() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (report.launchError) throw new Error(report.launchError);
    try {
      const token = JSON.parse(await readFile(tokenReportPath,'utf8'));
      report.tokenLaunch = token;
      if (token.status === 'failed') throw new Error(`Standard-user native launch failed: ${token.error}`);
      if (token.status === 'launched') {
        assert.equal(token.parentPid,ownedProcess.pid,'Token report must describe this owned launcher.');
        assert.ok(Number.isInteger(token.childPid) && token.childPid > 0);
        assert.equal(token.childToken.Elevated,false);
        assert.equal(token.childToken.IntegrityRid,8192);
        assert.equal(token.childToken.AdministratorsEnabled,false);
        assert.equal(token.childToken.AdministratorsPresent,false);
        assert.equal(token.childToken.MatchesExpectedUser,true);
        assert.equal(token.childToken.UsersEnabled,true);
        assert.equal(token.childToken.HasRestrictions,false);
        assert.equal(token.childToken.RestrictingSidCount,0);
        assert.equal(token.account.createdByHelper,true);
        report.pid = token.childPid;
        return;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (ownedProcess.exitCode !== null) throw new Error(`Standard-user launcher exited (${ownedProcess.exitCode}). ${processOutput.slice(-6000)}`);
    await delay(100);
  }
  throw new Error('Standard-user launcher did not report a verified child within 45 seconds.');
}
function runtimeDiagnostics() {
  if (!ownedProcess?.pid) return;
  const result = spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',
    join(repo,'tests/native/windows-runtime-diagnostics.ps1'),'-OwnedPid',String(report.pid ?? ownedProcess.pid)],
  { windowsHide:true, timeout:10_000, encoding:'utf8', maxBuffer:256_000 });
  if (result.status !== 0 || result.error) {
    report.runtimeDiagnosticError = { status:result.status, error:describeError(result.error), output:result.stderr?.slice(-4000) };
    return;
  }
  try { report.nativeProcesses = JSON.parse(result.stdout); }
  catch (error) { report.runtimeDiagnosticError = describeError(error); }
}
async function retainLog(source, name, limit) {
  let handle;
  try {
    const path = await realpath(source);
    assert.ok(inside(report.retainedProfile,path),'Diagnostic log must remain inside the owned profile.');
    handle = await open(path,'r');
    const size = (await handle.stat()).size;
    const buffer = Buffer.alloc(Math.min(size,limit));
    const { bytesRead } = await handle.read(buffer,0,buffer.length,Math.max(0,size-buffer.length));
    await writeFile(join(output,name),buffer.subarray(0,bytesRead));
    return { bytes:size, retainedBytes:bytesRead, truncated:size>bytesRead };
  } catch (error) { return { error:describeError(error) }; }
  finally { await handle?.close(); }
}
async function crashMetadata() {
  const entries = [];
  for (const part of ['reports','pending']) {
    const directory = join(report.retainedProfile,'EBWebView','Crashpad',part);
    try {
      const actual = await realpath(directory);
      assert.ok(inside(report.retainedProfile,actual));
      for (const entry of (await readdir(actual,{ withFileTypes:true })).slice(0,32)) {
        if (!entry.isFile()) continue;
        const path = await realpath(join(actual,entry.name));
        assert.ok(inside(report.retainedProfile,path));
        const file = await stat(path);
        entries.push({ relativePath:relative(report.retainedProfile,path),bytes:file.size,modifiedAt:file.mtime.toISOString() });
      }
    } catch (error) { if (error.code !== 'ENOENT') entries.push({ directory:part,error:describeError(error) }); }
  }
  return entries;
}
async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolvePromise); });
  const port = server.address().port;
  await new Promise((resolvePromise, reject) => server.close(error => error ? reject(error) : resolvePromise()));
  return port;
}
async function connect(port) {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  let lastError;
  report.cdpDiagnostic = { attempts:0 };
  while (Date.now() < deadline) {
    if (report.launchError) throw new Error(report.launchError);
    if (ownedProcess.exitCode !== null) throw new Error(`Native app exited during startup (${ownedProcess.exitCode}).`);
    try {
      report.cdpDiagnostic.attempts++;
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) });
      report.cdpDiagnostic.httpStatus = response.status;
      assert.equal(response.ok, true);
      const metadata = await response.json();
      report.cdpDiagnostic.metadata = { browser:metadata.Browser, protocolVersion:metadata['Protocol-Version'],
        userAgent:metadata['User-Agent'], webSocketOrigin:metadata.webSocketDebuggerUrl ? new URL(metadata.webSocketDebuggerUrl).origin : null };
      assert.equal(typeof metadata.webSocketDebuggerUrl, 'string');
      const endpoint = new URL(metadata.webSocketDebuggerUrl);
      assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'CDP must remain on loopback');
      assert.equal(endpoint.port, String(port));
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 5_000 });
    } catch (error) { lastError = error; report.cdpDiagnostic.lastError = describeError(error); await delay(250); }
  }
  throw new Error(`WebView2 CDP did not start within ${STARTUP_TIMEOUT}ms.`, { cause: lastError });
}

async function readLibrary(includeBytes = false) {
  return page.evaluate(async bytesWanted => {
    const db = await new Promise((resolvePromise, reject) => {
      const request = indexedDB.open('folio-local-library');
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains('documents')) return { records: [] };
      const get = (store, key) => new Promise((resolvePromise, reject) => {
        const request = key === undefined ? db.transaction(store).objectStore(store).getAll()
          : db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await get('documents');
      const records = rows.map(row => ({ owner: row.owner, id: row.id, name: row.name,
        revision: row.revision, needsRecovery: row.needsRecovery,
        latestIsOriginal: row.latestIsOriginal, originalSha256: row.originalSha256, latestSha256: row.latestSha256 }));
      if (!bytesWanted || !rows.length) return { records };
      const record = rows[0];
      const original = await get('originals', [record.owner, record.id]);
      const latest = record.latestIsOriginal ? original : await get('latest', [record.owner, record.id]);
      const array = async entry => Array.from(new Uint8Array(entry.bytes instanceof ArrayBuffer ? entry.bytes : await entry.bytes.arrayBuffer()));
      return { records, original: await array(original), latest: await array(latest) };
    } finally { db.close(); }
  }, includeBytes);
}
const active = () => page.locator('.document-host:not([hidden])');
async function ready() {
  await expect(page.locator('#reader')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#loading')).toBeHidden();
  await expect(active().locator('.page[data-page-number="1"]')).toHaveAttribute('data-loaded', 'true', { timeout: 20_000 });
}
async function openPdf(name) {
  const selection = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await selection).setFiles(join(fixtures, name));
  await ready();
}
async function workflow() {
  assert.equal(process.platform, 'win32', 'This smoke test requires Windows.');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Native launch is restricted to disposable GitHub Actions runners.');
  assert.equal(process.env.CI, 'true', 'CI=true is required.');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Disposable GitHub-hosted runner required.');
  assert.ok(process.env.RUNNER_TEMP && process.env.FOLIO_NATIVE_EXE, 'Set RUNNER_TEMP and FOLIO_NATIVE_EXE.');
  const runnerTemp = await realpath(process.env.RUNNER_TEMP);
  const executable = await realpath(process.env.FOLIO_NATIVE_EXE);
  assert.ok(inside(runnerTemp, executable), 'Executable must resolve beneath RUNNER_TEMP.');
  assert.equal(basename(executable).toLowerCase(), 'folio-desktop.exe', 'Expected the installed Folio application, not an installer.');
  assert.ok((await stat(executable)).isFile());
  const exeBytes = await readFile(executable);
  assert.equal(exeBytes.toString('ascii',0,2), 'MZ');
  const pe = exeBytes.readUInt32LE(0x3c);
  assert.equal(exeBytes.toString('ascii',pe,pe + 4), 'PE\0\0');
  assert.equal(exeBytes.readUInt16LE(pe + 4), 0x8664, 'Expected Windows x64 application payload.');
  report.executable = { path: executable, sha256: sha256(exeBytes), machine: 'x64' };
  const originalInput = await readFile(join(fixtures, 'form.pdf'));
  const searchInput = await readFile(join(fixtures, 'text-outline.pdf'));
  const profile = await mkdtemp(join(runnerTemp, 'folio-native-profile-'));
  assert.ok(inside(runnerTemp, await realpath(profile)));
  report.retainedProfile = profile;
  report.nativeOutput = { available:false, reason:'Plain CreateProcessWithLogonW startup uses no inherited standard handles; browser file logging remains enabled.' };
  browserLogPath = join(profile,'webview-debug.log');
  stopFilePath = join(output,`${basename(profile)}.stop`);
  const port = await freePort();
  report.debugging = { host: '127.0.0.1', port, scope: 'Only the owned standard-user process environment' };
  await writeFile(tokenReportPath,JSON.stringify({ status:'starting' }));
  ownedProcess = spawn('pwsh.exe', ['-NoProfile','-NonInteractive','-File',launcherScript,'-Mode','Launch'], {
    cwd: dirname(executable), shell: false, windowsHide: true, stdio: ['ignore','pipe','pipe'],
    env: { ...process.env,
      FOLIO_TOKEN_REPORT: tokenReportPath,
      FOLIO_NATIVE_PROFILE: profile,
      FOLIO_NATIVE_STOP_FILE: stopFilePath,
      RUST_BACKTRACE: '1',
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --enable-logging --v=1 --log-file="${browserLogPath}"`,
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
  });
  report.launcherPid = ownedProcess.pid;
  ownedProcess.on('error', error => { report.launchError = error.message; });
  const capture = data => { processOutput = (processOutput + data.toString()).slice(-256_000); };
  ownedProcess.stdout.on('data', capture); ownedProcess.stderr.on('data', capture);
  await readLaunchReport();
  checked('installed application runs as the created standard user with a verified unrestricted non-elevated Medium token', { pid:report.pid });
  browser = await connect(port);
  report.webviewVersion = browser.version();
  runtimeDiagnostics();
  assert.ok(Array.isArray(report.nativeProcesses),'Runtime process diagnostics must be available.');
  const runtime = report.nativeProcesses.find(item => item.name === 'msedgewebview2.exe'
    && item['remote-debugging-port'] === String(port) && item['user-data-dir']);
  assert.ok(runtime,'Owned WebView2 must expose the requested process-scoped debugging port.');
  const actualProfile = await realpath(runtime['user-data-dir']);
  assert.ok(inside(profile,actualProfile),'Actual WebView2 profile must remain beneath the fresh owned directory.');
  assert.equal(actualProfile.toLowerCase(),(await realpath(join(profile,'EBWebView'))).toLowerCase(),
    'WebView2 must use its EBWebView subdirectory in the requested user data folder.');
  report.actualWebViewProfile = actualProfile;
  checked('owned WebView2 uses the requested isolated profile and debugging port', { version:runtime.version });
  const context = browser.contexts()[0];
  assert.ok(context, 'WebView2 must expose its existing browser context.');
  context.setDefaultTimeout(15_000); context.setDefaultNavigationTimeout(20_000);
  const deadline = Date.now() + 15_000;
  while (!page && Date.now() < deadline) {
    page = context.pages().find(candidate => { try { return localAsset(new URL(candidate.url())); } catch { return false; } });
    if (!page) await delay(100);
  }
  assert.ok(page, 'The connected WebView must display the packaged Tauri origin.');
  report.packagedUrl = page.url();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0,1000)); });
  page.on('dialog', dialog => { void dialog.accept().catch(() => {}); });
  context.on('request', request => {
    const url = new URL(request.url());
    const item = { method: request.method(), url: safeUrl(request.url()), type: request.resourceType() };
    if (report.requests.length < 1000) report.requests.push(item);
    if (url.protocol === 'ipc:' || url.hostname === 'ipc.localhost') report.nativeIpcRequests.push(item);
    else if (!['GET','HEAD'].includes(request.method())) report.unexpectedWriteRequests.push(item);
  });
  // Packaged assets keep their real handler; there are no fulfilled/mocked responses.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:','https:','ws:','wss:'].includes(url.protocol) && !localAsset(url) && url.hostname !== 'ipc.localhost') {
      report.blockedExternalRequests.push({ method: route.request().method(), url: safeUrl(route.request().url()) });
      await route.abort('internetdisconnected');
    } else await route.continue();
  });
  await context.routeWebSocket('**/*', socket => {
    report.blockedExternalRequests.push({ method: 'WEBSOCKET', url: safeUrl(socket.url()) });
    socket.close();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#welcome')).toBeVisible();
  checked('packaged application opens without a development server');
  await page.screenshot({ path: join(output, 'welcome.png') });

  await openPdf('form.pdf');
  await expect(active().locator('input[name="reader_name"]')).toBeVisible();
  const pixels = await active().locator('.page[data-page-number="1"] canvas').first().evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let nonWhite = 0;
    for (let i=0;i<data.length;i+=64) if (data[i+3] && (data[i]<240 || data[i+1]<240 || data[i+2]<240)) nonWhite++;
    return { width:canvas.width, height:canvas.height, sampledNonWhitePixels:nonWhite };
  });
  assert.ok(pixels.width > 0 && pixels.height > 0 && pixels.sampledNonWhitePixels > 50);
  checked('real local form PDF renders nonblank pixels and native form widgets', pixels);
  assert.equal((await readLibrary()).records.length, 0);
  await page.locator('#store-local').click();
  await page.getByRole('button', { name:'Not now', exact:true }).click();
  assert.equal((await readLibrary()).records.length, 0);
  checked('declining storage leaves the document library empty');

  const value = 'Folio Windows native recovery verified';
  await active().locator('input[name="reader_name"]').fill(value);
  await page.locator('#page-total').click();
  await page.locator('#store-local').click();
  await page.getByRole('button', { name:'Enable local recovery', exact:true }).click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device', { timeout:20_000 });
  await expect.poll(async () => (await readLibrary()).records.length).toBe(1);
  const stored = await readLibrary(true);
  assert.equal(stored.records[0].owner, 'guest');
  assert.equal(stored.records[0].needsRecovery, true);
  assert.deepEqual(Buffer.from(stored.original), originalInput);
  const latest = Buffer.from(stored.latest);
  const savedPdf = await PDFDocument.load(latest);
  const sourcePdf = await PDFDocument.load(originalInput);
  assert.equal(savedPdf.getForm().getTextField('reader_name').getText(), value);
  assert.equal(savedPdf.getPageCount(), sourcePdf.getPageCount());
  assert.deepEqual(savedPdf.getPages().map(p => p.getSize()), sourcePdf.getPages().map(p => p.getSize()));
  assert.deepEqual(savedPdf.getForm().getFields().map(f=>f.getName()).sort(), sourcePdf.getForm().getFields().map(f=>f.getName()).sort());
  assert.equal(savedPdf.getForm().getCheckBox('approved').isChecked(), sourcePdf.getForm().getCheckBox('approved').isChecked());
  assert.deepEqual(savedPdf.getForm().getDropdown('review_status').getSelected(), sourcePdf.getForm().getDropdown('review_status').getSelected());
  assert.equal(savedPdf.getForm().getTextField('notes').getText(), sourcePdf.getForm().getTextField('notes').getText());
  await writeFile(join(output, 'validated-recovery.pdf'), latest);
  checked('consented guest checkpoint reopens in an independent parser and preserves original bytes/unrelated fields', {
    originalSha256:sha256(originalInput), latestSha256:sha256(latest), pageCount:savedPdf.getPageCount(),
  });

  await page.reload({ waitUntil:'domcontentloaded' });
  await page.locator('#library').click();
  await expect(page.locator('.recovery-badge')).toHaveText('Recovery copy available');
  await page.locator('[data-library-action="open"]').click();
  await ready();
  await expect(active().locator('input[name="reader_name"]')).toHaveValue(value);
  await expect.poll(async () => (await readLibrary()).records[0].needsRecovery).toBe(false);
  checked('reloading the actual native WebView restores the edited form from the device library');
  await page.screenshot({ path:join(output,'recovered-form.png') });

  await openPdf('text-outline.pdf');
  await page.locator('#toggle-search').click();
  await page.getByRole('searchbox', { name:'Search document' }).fill('amber heron');
  await expect(page.locator('#search-status')).toHaveText('1 of 3');
  await page.locator('#search-next').click();
  await expect(page.locator('#search-status')).toHaveText('2 of 3');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#search-close').click();
  await expect(page.locator('#searchbar')).toBeHidden();
  checked('a second real PDF searches all three pages and navigates results');
  await page.screenshot({ path:join(output,'search-document.png') });
  assert.deepEqual(await readFile(join(fixtures,'form.pdf')), originalInput);
  assert.deepEqual(await readFile(join(fixtures,'text-outline.pdf')), searchInput);
  assert.deepEqual(report.pageErrors, [], 'No uncaught page exceptions are allowed.');
  assert.deepEqual(report.unexpectedWriteRequests, [], 'No PDF/document upload request is allowed.');
  assert.deepEqual(report.blockedExternalRequests, [], 'Core workflows must not attempt external network requests.');
  checked('fixtures stay unchanged; observed document workflows make no upload or external requests', {
    observation:'Controlled reload through form recovery and search; app network requests only.',
  });
}

try {
  // Reject a local invocation before creating a profile, report directory or process.
  assert.equal(process.platform, 'win32', 'Windows is required.');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Refusing to launch outside GitHub Actions.');
  assert.equal(process.env.CI, 'true', 'CI=true is required.');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Disposable GitHub-hosted runner required.');
  await mkdir(output, { recursive:true });
  await Promise.race([workflow(), new Promise((_, reject) => {
    overallTimer = setTimeout(() => reject(new Error(`Native smoke exceeded ${OVERALL_TIMEOUT}ms.`)), OVERALL_TIMEOUT);
  })]);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack || String(error);
  report.errorDetails = describeError(error);
  console.error(report.error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    try { await page.screenshot({ path:join(output,'failure.png'), timeout:5_000 }); } catch {}
    try { report.failureUi = await page.locator('body').innerText({ timeout:2_000 }); } catch {}
  }
} finally {
  clearTimeout(overallTimer);
  if (ownedProcess?.pid && ownedProcess.exitCode === null) runtimeDiagnostics();
  // Ask the helper to empty its owned job and remove its exact temporary account.
  if (ownedProcess?.pid && ownedProcess.exitCode === null && ownedProcess.signalCode === null) {
    await writeFile(stopFilePath,'stop');
    const deadline = Date.now()+30_000;
    while (ownedProcess.exitCode === null && ownedProcess.signalCode === null && Date.now()<deadline) await delay(100);
    report.cleanup = { launcherPid:ownedProcess.pid, graceful:ownedProcess.exitCode !== null, exitCode:ownedProcess.exitCode };
    if (ownedProcess.exitCode === null && ownedProcess.signalCode === null) {
      const stopped=spawnSync('taskkill.exe',['/PID',String(ownedProcess.pid),'/T','/F'],{ windowsHide:true,timeout:10_000,encoding:'utf8' });
      report.cleanup.forcedStop = { status:stopped.status,output:`${stopped.stdout || ''}${stopped.stderr || ''}`.slice(0,4000) };
      report.status='failed'; process.exitCode=1;
    }
  }
  if (browser) { try { await browser.close({ reason:'Native CI smoke completed; owned app process stopped.' }); } catch {} }
  if (ownedProcess?.pid) {
    try {
      const token = JSON.parse(await readFile(tokenReportPath,'utf8'));
      if (token.parentPid === ownedProcess.pid) report.tokenLaunch = token;
    } catch (error) { report.finalTokenReportError = describeError(error); }
  }
  if (report.tokenLaunch?.account?.createdByHelper) {
    const cleanup = report.tokenLaunch.cleanup;
    if (ownedProcess.exitCode !== 0 || report.tokenLaunch.status === 'failed') { report.status='failed'; process.exitCode=1; }
    if (!cleanup?.AccountRemoved || !cleanup?.ProfileUnloaded || !cleanup?.ProfileDeleted || !cleanup?.OwnedJobEmpty ||
        !cleanup?.PrivateDesktopClosed || cleanup?.Errors?.length) {
      report.status='failed'; process.exitCode=1;
      // Last-resort exact-account removal after a forced helper stop; never claims profile cleanup succeeded.
      const account=report.tokenLaunch.account;
      const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',launcherScript,'-Mode','Cleanup',
        '-AccountName',account.name,'-AccountSid',account.sid],{ windowsHide:true,timeout:15_000,encoding:'utf8' });
      report.fallbackAccountCleanup={ status:result.status,output:`${result.stdout || ''}${result.stderr || ''}`.slice(0,4000) };
    }
  }
  if (browserLogPath) {
    report.browserOutput = await retainLog(browserLogPath,'webview-debug.log',1_000_000);
    // Only metadata is retained for crash dumps; their binary contents are not uploaded.
    report.crashFiles = await crashMetadata();
  }
  report.completedAt = new Date().toISOString();
  if (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.CI === 'true') {
    await writeFile(join(output,'report.json'), JSON.stringify(report,null,2));
    await writeFile(join(output,'process.log'), processOutput);
    console.log(`Native smoke ${report.status}; report: ${join(output,'report.json')}`);
  }
}

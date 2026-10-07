import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium, expect } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { verifyNativeReader } from './reader-workflow.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const local = process.argv[2] === '--local';
assert.equal(process.platform, 'win32');
if (!local) {
  assert.equal(process.argv.length, 2, 'Use no arguments for CI, or --local <installed exe> <sha256>.');
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.CI, 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY, 'KingGogusV/Project-PDF-reader-');
} else assert.equal(process.argv.length, 5, 'Local mode needs an installed executable and its expected SHA-256.');
const temp = await realpath(local ? tmpdir() : process.env.RUNNER_TEMP);
const executable = await realpath(local ? process.argv[3] : process.env.FOLIO_NATIVE_EXE);
const inside = (root,path) => { const part=relative(root,path); return part && part!=='..' && !part.startsWith(`..${sep}`) && !isAbsolute(part); };
assert.ok(inside(temp, executable), 'Only an isolated temporary test installation may be launched.');
assert.equal(basename(executable), 'folio-desktop.exe');
const exeBytes = await readFile(executable);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const executableSha256 = sha256(exeBytes);
if (local) assert.equal(executableSha256, process.argv[4], 'Unexpected installed executable bytes.');
assert.equal(exeBytes.toString('ascii',0,2), 'MZ');
const pe = exeBytes.readUInt32LE(0x3c);
assert.equal(exeBytes.toString('ascii',pe,pe+4), 'PE\0\0'); assert.equal(exeBytes.readUInt16LE(pe+4), 0x8664);
await mkdir(join(repo,'test-results'),{recursive:true});
const output = local ? await mkdtemp(join(repo,'test-results/native-windows-local-')) : join(repo,'test-results/native-windows');
if (!local) await mkdir(output); // A stale report is an error, never passing evidence.
const profile = await mkdtemp(join(temp,'FolioNativeProfile-'));
const copies = await mkdtemp(join(temp,'FolioNativeCopies-'));
const fixtures = join(repo,'tests/fixtures/generated');
const report = { startedAt:new Date().toISOString(), platform:process.platform, mode:local?'local-normal-user':'hosted-ci', sourceCommit:local?null:process.env.GITHUB_SHA,
  status:'running', executable:{path:executable,sha256:executableSha256,machine:'x64'}, retainedProfile:profile, retainedCopies:copies, nativeDialogs:[],
  checks:[], launches:[], requests:[], blockedExternalRequests:[], unexpectedWriteRequests:[], nativeIpcRequests:[], pageErrors:[], consoleErrors:[],
  networkScope:'Actual installed-app requests from controlled reload onward; external HTTP(S)/WebSockets blocked. OS/runtime update traffic is outside this observation.' };
const checked=(name,evidence={})=>{report.checks.push({name,status:'passed',...evidence});console.log(`PASS ${name}`)};
const execFileAsync=promisify(execFile);
let helper, browser, page, stopFile, launchReport, timer, helperOutput='', ending=false, ownedPid, mainWindowHandle;
function requestWindowClose(captureOnly=false) {
  const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-close-request.ps1'),
    '-OwnedPid',String(ownedPid),'-ExpectedExecutable',executable,...(captureOnly?['-CaptureOnly']:['-MainWindowHandle',String(mainWindowHandle)])],{windowsHide:true,encoding:'utf8',timeout:10000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr || 'OS close request failed');
  if(captureOnly)mainWindowHandle=JSON.parse(result.stdout).mainWindowHandle;
}
async function nativeDialog(action,destination,expectedSaveDialogHandle) {
  if(action==='confirm-existing')assert.ok(Number.isSafeInteger(expectedSaveDialogHandle)&&expectedSaveDialogHandle>0,'Confirmation must follow a known owned Save dialog.');
  else assert.equal(expectedSaveDialogHandle,undefined);
  const evidence=join(output,`save-dialog-${report.nativeDialogs.length}.json`);
  // Windows PowerShell supplies the desktop UIAutomation assemblies. No global
  // keyboard/mouse input, production mocks, or command-selected paths are used.
  const shell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  // Keep Node free to continue Playwright's intercepted local IPC while the OS
  // dialog helper waits. A synchronous child can prevent that dialog opening.
  let result;
  try {
    const completed=await execFileAsync(shell,['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-save-dialog.ps1'),
    '-Mode',local?'local':'ci','-OwnedPid',String(ownedPid),'-ExpectedExecutable',executable,'-ExpectedSha256',executableSha256,
    '-TestRoot',copies,'-ReportPath',evidence,'-Action',action,...(destination?['-Destination',destination]:[]),
    ...(expectedSaveDialogHandle?['-ExpectedSaveDialogHandle',String(expectedSaveDialogHandle)]:[])],
    {windowsHide:true,encoding:'utf8',timeout:25000,maxBuffer:256000});
    result={...completed,status:0};
  } catch(error) {
    result={stdout:error.stdout||'',stderr:error.stderr||'',status:Number.isInteger(error.code)?error.code:null,
      error:Number.isInteger(error.code)?undefined:error};
  }
  report.nativeDialogs.push({action,evidence,status:result.status,error:result.error?.message});
  assert.ok(!report.consoleErrors.some(message=>/\b(?:https?:\/\/ipc\.localhost|ipc:\/\/localhost)\//i.test(message)
    && /Content Security Policy/i.test(message)), 'Packaged application CSP blocked local Tauri IPC; see retained console diagnostics.');
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr || 'Owned Save As dialog interaction failed');
  const observed=JSON.parse(result.stdout);
  assert.equal(observed.ownedPid,ownedPid);
  assert.equal(observed.status,'passed');
  return observed;
}
async function nativeSave(path,timeout=30000) {
  await page.locator('#export').click();
  await nativeDialog('save',path);
  await expect(page.locator('#export')).toBeEnabled({timeout});
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(0,{timeout});
  await expect(page.locator('#dialog')).toBeHidden();
  return await readFile(path);
}
async function stopOwned() {
  if (!helper) return;
  if (helper.exitCode===null && helper.signalCode===null) {
    await writeFile(stopFile,'stop');
    const until=Date.now()+15000;
    while(helper.exitCode===null && helper.signalCode===null && Date.now()<until)await delay(100);
  }
  assert.notEqual(helper.exitCode,null,'Owned launcher failed to stop within its cleanup bound.');
  const ended=JSON.parse(await readFile(launchReport,'utf8'));
  report.launches.push(ended);
  assert.equal(helper.exitCode,0,ended.error || 'Native launcher failed');
  assert.ok(ended.status==='stopped'||(report.nativeCloseConfirmed&&ended.status==='closed'),'Unexpected native close state');
  assert.equal(ended.cleanup.ownedJobEmpty,true); assert.equal(ended.cleanup.policyRemoved,true);
  if(browser) { await browser.close().catch(()=>{}); browser=undefined; }
  helper=undefined;
}
async function startOwned() {
  assert.equal(ending,false,'Do not start another process after verification has ended.');
  const server=createServer(); await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
  const port=server.address().port; await new Promise(r=>server.close(r));
  const iteration=report.launches.length;
  launchReport=join(output,`launch-${iteration}.json`); stopFile=join(output,`stop-${iteration}`);
  helper=spawn('pwsh.exe',['-NoProfile','-NonInteractive','-File',join(repo,'tests/native/windows-owned-launch.ps1'),
    '-Mode',local?'local':'ci','-Executable',executable,'-ExpectedSha256',executableSha256,'-Profile',profile,
    '-Port',String(port),'-ReportPath',launchReport,'-StopFile',stopFile],{cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error;helper.on('error',e=>{error=e});
  const capture=d=>{helperOutput=(helperOutput+d).slice(-64000)};
  helper.stdout.on('data',capture);helper.stderr.on('data',capture);
  const until=Date.now()+45000; let launch;
  while(Date.now()<until) {
    if(error)throw error;
    if(helper.exitCode!==null)throw new Error(`Native launcher stopped (${helper.exitCode}): ${helperOutput}`);
    try { launch=JSON.parse(await readFile(launchReport,'utf8')); } catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
    if(launch?.status==='failed')throw new Error(launch.error);
    if(launch?.status==='launched' && launch.webview?.profileVerified && launch.webview?.portVerified) {
      try {
        const response=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(750)});
        if(response.ok) {
          const metadata=await response.json();const endpoint=new URL(metadata.webSocketDebuggerUrl);
          assert.ok(['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)); assert.equal(endpoint.port,String(port));
          browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:5000});
          report.webviewVersion=browser.version();
          assert.equal(launch.parentPid,helper.pid);
          ownedPid=launch.childPid;
          if(local)assert.equal(launch.elevated,false);
          checked('same-account installed app starts with isolated loopback debugging', { mode:report.mode,elevated:launch.elevated,version:browser.version() });
          return;
        }
      } catch(e) { report.lastConnectError=e.message; }
    }
    await delay(200);
  }
  throw new Error('Installed app did not expose its requested debugging connection within 45 seconds.');
}
async function workflow() {
  await startOwned();
  const flow=await verifyNativeReader({browser,output,fixtures,report,checked}); page=flow.page;
  requestWindowClose(true); // Pin the Folio HWND before any modal Save As dialog.
  await page.getByRole('tab',{name:/form.pdf/}).click();
  await flow.active().locator('input[name="reader_name"]').fill('Pending native close check');
  await page.locator('#page-total').click();
  // A real OS close request must enter the shared save/discard workflow.
  requestWindowClose();
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button',{name:'Keep open',exact:true}).click();
  await expect(flow.active().locator('input[name="reader_name"]')).toHaveValue('Pending native close check');
  assert.equal(helper.exitCode,null);
  checked('OS window close asks about unsaved changes and cancellation keeps edits open');
  await flow.active().locator('input[name="reader_name"]').fill('Folio Windows native recovery verified');
  await page.locator('#page-total').click();
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(1);
  await page.locator('#export').click();
  const chooser=await nativeDialog('inspect');
  assert.equal(chooser.dialogs.filter(dialog=>dialog.Enabled).length,1);
  await expect(page.locator('#export')).toBeDisabled();
  await expect(page.locator('#close-active-document')).toBeDisabled();
  // Dispatch duplicate user actions through the real frontend handlers while the
  // OS dialog is pending; no native IPC result or document controller is mocked.
  await page.evaluate(()=>{
    document.querySelector('#export').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    document.querySelector('#open').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });
  requestWindowClose();requestWindowClose();
  const stillPending=await nativeDialog('inspect');
  assert.equal(stillPending.dialogs.length,1);
  assert.equal(stillPending.dialogs[0].Handle,chooser.dialogs[0].Handle);
  assert.equal(helper.exitCode,null);
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(1);
  await nativeDialog('cancel');
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(1);
  assert.deepEqual(await readdir(copies),[]);
  checked('real Save As cancellation and duplicate save/open/OS-close requests preserve pending edits and create no files');

  const existing=join(copies,'existing.pdf');await writeFile(existing,flow.originalInput);
  await page.locator('#export').click();const existingChooser=await nativeDialog('save',existing);
  assert.equal(existingChooser.dialogs.length,1);
  await nativeDialog('confirm-existing',undefined,existingChooser.dialogs[0].Handle);
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('#toast')).toHaveText('Export failed. Your changes remain open. A file or folder already has that name. Choose a new name; Folio never overwrites an existing file.');
  await expect(page.locator('.tab.active .dirty-dot')).toHaveCount(1);
  assert.deepEqual(await readFile(existing),flow.originalInput);
  assert.deepEqual(await readdir(copies),['existing.pdf']);
  await expect(page.locator('#dialog')).toBeHidden();
  checked('choosing an existing synthetic PDF refuses replacement after OS confirmation and keeps edits open');

  const saved=join(copies,'form-export-\u65e5\u672c\u8a9e-\u00e9.pdf');
  const bytes=await nativeSave(saved); const pdf=await PDFDocument.load(bytes);
  await writeFile(join(output,'form-export.pdf'),bytes);
  assert.deepEqual(bytes.subarray(0,flow.originalInput.length),flow.originalInput);
  assert.equal(pdf.getForm().getTextField('reader_name').getText(),'Folio Windows native recovery verified');
  assert.deepEqual(await readFile(join(fixtures,'form.pdf')),flow.originalInput);
  assert.ok((await readdir(copies)).every(name=>name.endsWith('.pdf')),'Completed native writes must remove temporary files.');
  await flow.openPdf(saved);
  await expect(flow.active().locator('input[name="reader_name"]')).toHaveValue('Folio Windows native recovery verified');
  checked('real Unicode Save As retry confirms disk bytes, clears dirty state, preserves originals and reopens edited forms', { filename:basename(saved),sha256:sha256(bytes),byteLength:bytes.length });
  await page.getByRole('button',{name:`Close ${basename(saved)}`,exact:true}).click();
  await page.getByRole('tab',{name:/text-outline.pdf/}).click();
  await page.locator('#page-number').fill('1');await page.locator('#page-number').press('Enter');
  await page.locator('#scale').selectOption('page-fit');await page.locator('#tool-text').click();
  const layer=flow.active().locator('.page[data-page-number="1"] .annotationEditorLayer');
  await layer.click({position:{x:120,y:260}});
  await layer.locator('.freeTextEditor [contenteditable="true"]').last().fill('Native annotation preserved');
  await page.locator('#tool-select').click();
  const annotatedPath=join(copies,'annotated.pdf');
  const annotationBytes=await nativeSave(annotatedPath);const annotationPdf=await PDFDocument.load(annotationBytes);
  await writeFile(join(output,'annotated.pdf'),annotationBytes);
  const entries=annotationPdf.getPage(0).node.Annots().asArray().map(ref=>annotationPdf.context.lookup(ref));
  assert.ok(entries.some(entry=>entry.get(PDFName.of('Subtype'))?.toString()==='/FreeText' && entry.get(PDFName.of('Contents'))?.decodeText()==='Native annotation preserved'));
  assert.deepEqual(annotationBytes.subarray(0,(await readFile(join(fixtures,'text-outline.pdf'))).length),await readFile(join(fixtures,'text-outline.pdf')));
  await flow.openPdf(annotatedPath);
  await expect(flow.active().locator('.textLayer').first()).toContainText('UniqueToken1');
  checked('native text annotation exports as a PDF annotation and the saved copy reopens');
  await page.getByRole('button',{name:'Close annotated.pdf',exact:true}).click();

  // A valid PDF with a deliberately unused, uncompressed catalog stream crosses
  // eight real IPC chunk boundaries without adding a huge rendered page/fixture.
  const largeDocument=await PDFDocument.create();
  largeDocument.addPage([612,792]).drawText('Folio synthetic multi-chunk save verification',{x:48,y:720,size:12});
  const padding=largeDocument.context.register(largeDocument.context.stream(new Uint8Array(8*1024*1024).fill(65)));
  largeDocument.catalog.set(PDFName.of('FolioSyntheticPadding'),padding);
  const largeInput=Buffer.from(await largeDocument.save({useObjectStreams:false}));
  assert.ok(largeInput.length>8*1024*1024&&largeInput.length<150*1024*1024);
  const largeSource=join(copies,'multichunk-source.pdf');const largeCopy=join(copies,'multichunk-copy.pdf');
  await writeFile(largeSource,largeInput);
  await flow.openPdf(largeSource);
  const largeSaved=await nativeSave(largeCopy);
  assert.deepEqual(largeSaved,largeInput,'Multi-chunk native output must preserve every original byte.');
  assert.equal(sha256(largeSaved),sha256(largeInput));
  assert.deepEqual(await readFile(largeSource),largeInput,'Native Save As must not modify its input.');
  const largeParsed=await PDFDocument.load(largeSaved);
  assert.equal(largeParsed.getPageCount(),1);assert.deepEqual(largeParsed.getPage(0).getSize(),{width:612,height:792});
  assert.ok((await readdir(copies)).every(name=>name.endsWith('.pdf')),'Multi-chunk save must remove temporary files.');
  await page.getByRole('button',{name:'Close multichunk-source.pdf',exact:true}).click();
  await flow.openPdf(largeCopy);
  await expect(flow.active().locator('.textLayer').first()).toContainText('Folio synthetic multi-chunk save verification',{timeout:30000});
  await page.getByRole('button',{name:'Close multichunk-copy.pdf',exact:true}).click();
  checked('real multi-chunk native binary IPC preserves an 8 MiB PDF byte-for-byte, independently parses and visibly reopens',{
    byteLength:largeSaved.length,sha256:sha256(largeSaved),minimumChunkCount:Math.ceil(largeSaved.length/(1024*1024)),pageCount:largeParsed.getPageCount(),
  });
  await page.getByRole('tab',{name:/form.pdf/}).click();
  const recoveredValue='Recovered after actual native process termination';
  await flow.active().locator('input[name="reader_name"]').fill(recoveredValue);await page.locator('#page-total').click();
  await expect(page.locator('#recovery-status')).toHaveText('Recovery up to date on this device');
  await expect.poll(async()=>{const state=await flow.readLibrary(true);return (await PDFDocument.load(Uint8Array.from(state.latest))).getForm().getTextField('reader_name').getText()}).toBe(recoveredValue);
  await stopOwned(); // Abruptly stop the entire owned app/WebView job after a verified checkpoint.
  await startOwned();
  const context=browser.contexts()[0];context.setDefaultTimeout(15000);
  for(let attempt=0;attempt<100;attempt++) {
    page=context.pages().find(p=>p.url().startsWith('http://tauri.localhost'));
    if(page)break;
    await delay(100);
  }
  assert.ok(page);page.on('pageerror',e=>report.pageErrors.push(e.message));
  requestWindowClose(true);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(['http:','https:'].includes(url.protocol)&&!['tauri.localhost','ipc.localhost'].includes(url.hostname)){report.blockedExternalRequests.push({url:url.origin+url.pathname});return route.abort('internetdisconnected')}
    return route.continue();
  });
  await page.locator('#library').click();await page.locator('[data-library-action="open"]').click();
  await expect(page.locator('.document-host:not([hidden]) input[name="reader_name"]')).toHaveValue(recoveredValue);
  await page.screenshot({path:join(output,'process-recovery.png')});
  checked('full native process termination and relaunch recover the last completed form checkpoint');
  await page.locator('.document-host:not([hidden]) input[name="reader_name"]').fill('Explicitly discarded native close test');
  await page.locator('#page-total').click();requestWindowClose();
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await writeFile(stopFile+'.expected-close','expect a clean exit after explicit confirmation');
  const closed=page.waitForEvent('close');
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();await closed;
  const until=Date.now()+10000;
  while(helper.exitCode===null&&Date.now()<until)await delay(100);
  assert.equal(helper.exitCode,0,'Confirmed native close must exit cleanly');
  const exit=JSON.parse(await readFile(launchReport,'utf8'));assert.equal(exit.status,'closed');
  report.nativeCloseConfirmed=true;
  checked('explicit native discard confirmation closes the real application cleanly');
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.blockedExternalRequests,[]);assert.deepEqual(report.unexpectedWriteRequests,[]);
}
try {
  await Promise.race([workflow(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Native verification exceeded 180 seconds.')),180000)})]);
  report.status='passed';
} catch(e) {
  ending=true;
  report.status='failed';report.error=e.stack;process.exitCode=1;console.error(e.stack);
  if(page&&!page.isClosed()) {try{await page.screenshot({path:join(output,'failure.png'),timeout:3000});report.failureUi=await page.locator('body').innerText({timeout:2000})}catch{}}
} finally {
  ending=true;
  clearTimeout(timer);
  try{await stopOwned()}catch(e){report.status='failed';report.cleanupError=e.stack;process.exitCode=1;console.error(e.stack)}
  report.completedAt=new Date().toISOString();
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(output,'launcher.log'),helperOutput);
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,output,version:report.webviewVersion}));
}

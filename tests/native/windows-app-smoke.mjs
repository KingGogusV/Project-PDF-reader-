import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
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
const fixtures = join(repo,'tests/fixtures/generated');
const report = { startedAt:new Date().toISOString(), platform:process.platform, mode:local?'local-normal-user':'hosted-ci', sourceCommit:local?null:process.env.GITHUB_SHA,
  status:'running', executable:{path:executable,sha256:executableSha256,machine:'x64'}, retainedProfile:profile,
  checks:[], launches:[], requests:[], blockedExternalRequests:[], unexpectedWriteRequests:[], nativeIpcRequests:[], pageErrors:[], consoleErrors:[],
  networkScope:'Actual installed-app requests from controlled reload onward; external HTTP(S)/WebSockets blocked. OS/runtime update traffic is outside this observation.' };
const checked=(name,evidence={})=>{report.checks.push({name,status:'passed',...evidence});console.log(`PASS ${name}`)};
let helper, browser, page, stopFile, launchReport, timer, helperOutput='', ending=false;
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
  assert.equal(ended.status,'stopped');
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
  await page.getByRole('tab',{name:/form.pdf/}).click();
  const event=page.waitForEvent('download');
  await page.locator('#export').click(); const download=await event;
  const saved=join(output,'form-export.pdf');await download.saveAs(saved);assert.equal(await download.failure(),null);
  const bytes=await readFile(saved); const pdf=await PDFDocument.load(bytes);
  assert.deepEqual(bytes.subarray(0,flow.originalInput.length),flow.originalInput);
  assert.equal(pdf.getForm().getTextField('reader_name').getText(),'Folio Windows native recovery verified');
  await page.getByRole('button',{name:'I saved the copy',exact:true}).click(); await flow.openPdf(saved);
  await expect(flow.active().locator('input[name="reader_name"]')).toHaveValue('Folio Windows native recovery verified');
  checked('native PDF download preserves original bytes and reopens with edited form values');
  await page.getByRole('button',{name:'Close form-export.pdf',exact:true}).click();
  await page.getByRole('tab',{name:/text-outline.pdf/}).click();
  await page.locator('#page-number').fill('1');await page.locator('#page-number').press('Enter');
  await page.locator('#scale').selectOption('page-fit');await page.locator('#tool-text').click();
  const layer=flow.active().locator('.page[data-page-number="1"] .annotationEditorLayer');
  await layer.click({position:{x:120,y:260}});
  await layer.locator('.freeTextEditor [contenteditable="true"]').last().fill('Native annotation preserved');
  await page.locator('#tool-select').click();
  const annotatedEvent=page.waitForEvent('download');await page.locator('#export').click();
  const annotated=await annotatedEvent;const annotatedPath=join(output,'annotated.pdf');await annotated.saveAs(annotatedPath);
  assert.equal(await annotated.failure(),null);
  const annotationBytes=await readFile(annotatedPath);const annotationPdf=await PDFDocument.load(annotationBytes);
  const entries=annotationPdf.getPage(0).node.Annots().asArray().map(ref=>annotationPdf.context.lookup(ref));
  assert.ok(entries.some(entry=>entry.get(PDFName.of('Subtype'))?.toString()==='/FreeText' && entry.get(PDFName.of('Contents'))?.decodeText()==='Native annotation preserved'));
  assert.deepEqual(annotationBytes.subarray(0,(await readFile(join(fixtures,'text-outline.pdf'))).length),await readFile(join(fixtures,'text-outline.pdf')));
  await page.getByRole('button',{name:'I saved the copy',exact:true}).click();await flow.openPdf(annotatedPath);
  await expect(flow.active().locator('.textLayer').first()).toContainText('UniqueToken1');
  checked('native text annotation exports as a PDF annotation and the saved copy reopens');
  await page.getByRole('button',{name:'Close annotated.pdf',exact:true}).click();
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
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(['http:','https:'].includes(url.protocol)&&!['tauri.localhost','ipc.localhost'].includes(url.hostname)){report.blockedExternalRequests.push({url:url.origin+url.pathname});return route.abort('internetdisconnected')}
    return route.continue();
  });
  await page.locator('#library').click();await page.locator('[data-library-action="open"]').click();
  await expect(page.locator('.document-host:not([hidden]) input[name="reader_name"]')).toHaveValue(recoveredValue);
  await page.screenshot({path:join(output,'process-recovery.png')});
  checked('full native process termination and relaunch recover the last completed form checkpoint');
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

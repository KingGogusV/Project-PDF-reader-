import { chromium } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL=process.env.E2E_BASE_URL||'http://127.0.0.1:4173';
const channel=process.env.E2E_BROWSER_CHANNEL||'chrome';
const browser=await chromium.launch({channel:channel==='chromium'?undefined:channel,headless:true});
const report={checkedAt:new Date().toISOString(),platform:process.platform,browser:await browser.version(),runs:[],offline:{}};
async function open(page,name){const choice=page.waitForEvent('filechooser');await page.locator('#open').click();await(await choice).setFiles(resolve('tests/fixtures/generated',name));await page.locator('.page[data-page-number="1"] .textLayer span').first().waitFor();await page.waitForFunction(()=>document.querySelector('#status-detail').textContent.includes('first page'));}
for(const device of [{name:'desktop',width:1440,height:1000,cpu:1},{name:'phone-emulation',width:390,height:844,cpu:4}]){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},serviceWorkers:'block'});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:device.cpu});
 const start=performance.now();await page.goto(baseURL);await page.locator('#choose').waitFor();const startupMs=Math.round(performance.now()-start);
 const openStart=performance.now();await open(page,'large.pdf');const openWorkflowMs=Math.round(performance.now()-openStart);const firstPageStatus=await page.locator('#status-detail').innerText();
 await page.locator('#toggle-search').click();const searchStart=performance.now();await page.locator('#search-input').fill('LastPageNeedle');await page.waitForFunction(()=>/\d+ of \d+/.test(document.querySelector('#search-status').textContent),undefined,{timeout:20000});
 const searchMs=Math.round(performance.now()-searchStart);const search=await page.locator('#search-status').innerText();
 await page.locator('#page-number').fill('200');await page.locator('#page-number').press('Enter');await page.locator('#page-number').blur();await page.locator('.page[data-page-number="200"] canvas').first().waitFor();
 const memory=await page.evaluate(()=>({canvasCount:document.querySelectorAll('.pdfViewer canvas').length,canvasPixels:[...document.querySelectorAll('.pdfViewer canvas')].reduce((sum,c)=>sum+c.width*c.height,0),jsHeapUsedBytes:performance.memory?.usedJSHeapSize??null}));
 report.runs.push({...device,startupMs,openWorkflowMs,firstPageStatus,searchMs,search,fixtureBytes:(await stat(resolve('tests/fixtures/generated/large.pdf'))).size,pages:200,...memory});await context.close();
}
const context=await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:'allow'});const page=await context.newPage();await page.goto(baseURL);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
await context.setOffline(true);await page.reload();await page.locator('#choose').waitFor();await open(page,'text-outline.pdf');
report.offline={shellReload:true,localPdfRead:true,cachedPdfUrls:await page.evaluate(async()=>{const found=[];for(const name of await caches.keys()){const cache=await caches.open(name);for(const r of await cache.keys())if(/\.pdf(?:$|\?)/i.test(r.url))found.push(r.url);}return found;})};
await context.close();await browser.close();await mkdir('.cache',{recursive:true});await writeFile('.cache/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

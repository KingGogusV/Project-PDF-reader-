import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const channel = process.env.E2E_BROWSER_CHANNEL || 'msedge';
const browser = await chromium.launch({ channel: channel === 'chromium' ? undefined : channel, headless: true });
const results = { checkedAt: new Date().toISOString(), browser: browser.version(), platform: process.platform, scans: [], keyboard: [] };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
async function scan(name) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  const summarize = item => ({ id:item.id, impact:item.impact, description:item.description, help:item.helpUrl, nodes:item.nodes.map(n=>({ target:n.target, failure:n.failureSummary })) });
  results.scans.push({ name, violations:report.violations.map(summarize), incomplete:report.incomplete.map(summarize), passed:report.passes.length });
  console.log(name, JSON.stringify(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
}
await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:4173');
await page.locator('#demo').waitFor();
await scan('welcome-desktop');
await page.locator('#help').focus(); await page.keyboard.press('Enter');
await page.locator('#dialog[open]').waitFor();
const dialogStart = await page.evaluate(()=>document.activeElement?.id);
const focusSequence = [];
for(let i=0;i<8;i++) {
  await page.keyboard.press('Tab');
  focusSequence.push(await page.evaluate(()=>({ id:document.activeElement?.id, tag:document.activeElement?.tagName, inDialog:!!document.activeElement?.closest('dialog[open]') })));
}
await page.keyboard.press('Escape');
results.keyboard.push({ check:'help dialog sequential focus and return on escape (BODY can mean browser chrome)', dialogStart, focusSequence, returnedTo: await page.evaluate(()=>document.activeElement?.id) });
for (const [id, name] of [['library','device-library-dialog'],['account','account-dialog']]) {
  if (await page.locator(`#${id}`).count()) {
    await page.locator(`#${id}`).click();
    await page.locator('#dialog[open]').waitFor();
    await scan(name);
    await page.keyboard.press('Escape');
  }
}
await page.locator('#demo').click();
await page.locator('.page[data-page-number="1"] canvas').waitFor();
await scan('reader-desktop');
if (await page.locator('#document-tools').count()) {
  await page.locator('#document-tools').click();
  await page.locator('#dialog[open]').waitFor();
  await scan('document-tools-dialog');
  await page.keyboard.press('Escape');
}
await page.locator('#toggle-search').click();
await page.locator('#search-input').fill('amber heron');
await page.locator('#search-status').filter({hasText:/of 3/}).waitFor();
await scan('search-desktop');
await page.locator('#search-close').click();
results.keyboard.push({check:'closing search focus target', focused:await page.evaluate(()=>document.activeElement?.id)});
await page.locator('#page-number').fill('3'); await page.locator('#page-number').press('Enter');
await page.locator('input[name="reader_name"]').waitFor();
await scan('demo-form-desktop');
const formNames = await page.locator('.annotationLayer input,.annotationLayer select,.annotationLayer textarea').evaluateAll(nodes=>nodes.map(n=>({name:n.name,title:n.title,aria:n.getAttribute('aria-label')})));
results.keyboard.push({check:'demo form accessible labels',fields:formNames});
await page.setViewportSize({width:390,height:844});
await page.locator('#scale').selectOption('page-fit');
await scan('reader-phone-390');
await page.locator('#mobile-more').click();
await page.locator('#dialog[open]').waitFor();
await scan('actions-dialog-phone');
await page.keyboard.press('Escape');
const overflow = await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,toolbar:document.querySelector('.toolbar')?.scrollWidth}));
results.keyboard.push({check:'phone shell width',...overflow});
await mkdir(resolve('.cache'),{recursive:true});
await writeFile(resolve('.cache/accessibility-results.json'),JSON.stringify(results,null,2));
await browser.close();

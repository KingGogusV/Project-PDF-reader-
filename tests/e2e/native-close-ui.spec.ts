// Browser-only verification of shared close UI with a simulated native command.
// Real OS close, permissions and binary behavior are separate native release gates.
import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

async function openForm(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { isTauri: boolean; closeCalls: string[]; __TAURI_INTERNALS__: { invoke: (command: string) => Promise<void> } };
    state.isTauri = true; state.closeCalls = [];
    state.__TAURI_INTERNALS__ = { async invoke(command) {
      if (command !== 'finish_close') throw new Error('Unexpected simulated native command');
      state.closeCalls.push(command);
    } };
  });
  await page.goto('/');
  const chooser=page.waitForEvent('filechooser');await page.locator('#open').click();
  await (await chooser).setFiles(resolve('tests/fixtures/generated/form.pdf'));
  await expect(page.locator('input[name="reader_name"]')).toBeVisible();
}
const requestClose=(page:Page)=>page.evaluate(()=>window.dispatchEvent(new Event('folio-native-close-request')));
const calls=(page:Page)=>page.evaluate(()=>(window as unknown as {closeCalls:string[]}).closeCalls.length);

test('simulated native close preserves edits on cancel and waits for an acknowledged export', async ({page},testInfo) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await openForm(page);
  await page.locator('input[name="reader_name"]').fill('Keep my native edits');
  await requestClose(page);await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button',{name:'Keep open',exact:true}).click();
  expect(await calls(page)).toBe(0);await expect(page.locator('input[name="reader_name"]')).toHaveValue('Keep my native edits');
  await requestClose(page);const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export copy',exact:true}).last().click();
  await (await downloaded).saveAs(testInfo.outputPath('close-export.pdf'));
  await expect(page.locator('#dialog-title')).toHaveText('Your PDF copy is ready');
  expect(await calls(page)).toBe(0);
  await page.getByRole('button',{name:'I saved the copy',exact:true}).click();
  expect(await calls(page)).toBe(0); // Export returns to the open document.
  await requestClose(page);await expect.poll(()=>calls(page)).toBe(1);
  await expect(page.locator('#welcome')).toBeVisible();expect(errors).toEqual([]);
});

test('simulated native close persists opted-in edits and does not replace an active dialog', async ({page}) => {
  await openForm(page);
  await page.locator('#store-local').click();await page.getByRole('button',{name:'Enable local recovery',exact:true}).click();
  await page.locator('input[name="reader_name"]').fill('Keep in local library on exit');
  await page.locator('#properties').click();await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Document properties');expect(await calls(page)).toBe(0);
  await page.getByRole('button',{name:'Done',exact:true}).click();await requestClose(page);
  await page.getByRole('button',{name:'Keep in library',exact:true}).click();
  await expect.poll(()=>calls(page)).toBe(1);
  // The mock retains its browser window so persisted bytes can be reopened.
  await page.reload();await page.locator('#library').click();await page.locator('[data-library-action="open"]').click();
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Keep in local library on exit');
});

test('simulated native close shows the background document before asking about its edits', async ({page}) => {
  await openForm(page);
  await page.locator('input[name="reader_name"]').fill('Unsaved background form');
  const chooser=page.waitForEvent('filechooser');await page.locator('#open').click();
  await (await chooser).setFiles(resolve('tests/fixtures/generated/text-outline.pdf'));
  await expect(page.getByRole('tab',{name:/text-outline.pdf/})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#page-total')).toHaveText('of 3');
  await requestClose(page);
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await expect(page.getByRole('tab',{name:/form.pdf/})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Keep open',exact:true}).click();
  expect(await calls(page)).toBe(0);
  await expect(page.locator('input[name="reader_name"]')).toHaveValue('Unsaved background form');
  await expect(page.getByRole('tab')).toHaveCount(2);
});

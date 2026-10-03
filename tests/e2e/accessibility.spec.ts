import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

async function openPdf(page: Page, name = 'text-outline.pdf') {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').focus();
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(resolve('tests/fixtures/generated', name));
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('.document-host .page[data-loaded="true"] canvas').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('document tabs keep focus during reader updates and isolate Home/End from page navigation', async ({ page }) => {
  await openPdf(page);
  await page.locator('#page-number').fill('2');
  await page.locator('#page-number').press('Enter');
  await openPdf(page);
  await page.getByRole('tab').last().focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab').first()).toBeFocused();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab').last()).toBeFocused();
  await expect(page.locator('#page-number')).toHaveValue('1');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.getByRole('tab').last()).toBeFocused();
});

test('every document tab controls an existing named panel while inactive PDF widgets stay detached', async ({ page }) => {
  await openPdf(page, 'form.pdf');
  await openPdf(page, 'form.pdf');
  const relationships = await page.getByRole('tab').evaluateAll(tabs => tabs.map(tab => {
    const panel = document.getElementById(tab.getAttribute('aria-controls')!);
    return { exists: !!panel, role: panel?.getAttribute('role'), label: panel?.getAttribute('aria-labelledby'), tab: tab.id };
  }));
  for (const relation of relationships) {
    expect(relation.exists).toBe(true);
    expect(relation.role).toBe('tabpanel');
    expect(relation.label).toBe(relation.tab);
  }
  await expect(page.locator('.document-host')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
});

test('opening and closing a PDF leaves keyboard focus on a visible useful control', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('.document-host')).toBeFocused();
  await page.locator('#close-active-document').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#choose')).toBeFocused();
});

test('navigation panel exposes its state and returns focus when dismissed', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#sidebar-close').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('#toggle-sidebar')).toBeFocused();
  await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(page.locator('#nav-pages')).toBeFocused();
  await expect(page.locator('.thumb-button[aria-current="page"]')).toHaveAttribute('data-page', '1');
});

test('phone thumbnail selection and responsive panel dismissal restore visible focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPdf(page);
  await page.locator('#toggle-sidebar').click();
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('.document-host')).toBeFocused();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#toggle-sidebar').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#toggle-sidebar')).toBeFocused();
  await expect(page.locator('#sidebar')).toBeHidden();
  await page.locator('#toggle-sidebar').click();
  await page.locator('.document-host').focus();
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('.document-host')).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#toggle-sidebar').click();
  await page.locator('#nav-pages').focus();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('#toggle-sidebar')).toBeFocused();
});

test('dialog keyboard traversal stays modal and Escape restores its trigger', async ({ page }) => {
  await page.locator('#help').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let step = 0; step < 10; step++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog[open]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#help')).toBeFocused();
  await openPdf(page);
  await page.keyboard.press('Control+f');
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#toggle-search')).toBeFocused();
});

test('phone actions expose help and nested dialogs return focus to the action trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPdf(page);
  await page.locator('#mobile-more').click();
  expect((await page.getByRole('button', { name: 'Keyboard shortcuts and help', exact: true }).boundingBox())!.width,
    'Phone action labels need readable rows, not narrow columns of broken words').toBeGreaterThanOrEqual(200);
  await page.getByRole('button', { name: 'Keyboard shortcuts and help', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('A few useful shortcuts');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-more')).toBeFocused();
});

test('skip link, keyboard form entry, save and reopen preserve edits and accessible status', async ({ page, browserName }, testInfo) => {
  // Safari's default macOS convention includes links with Option+Tab.
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#welcome')).toBeFocused();
  await openPdf(page, 'form.pdf');
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#stage')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.document-host')).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'reader_name', exact: true })).toBeVisible();
  // PDF.js may expose a page focus stop before its first form widget.
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('Tab');
    if (await page.getByRole('textbox', { name: 'reader_name', exact: true }).evaluate(el => el === document.activeElement)) break;
    expect(await page.evaluate(() => !!document.activeElement?.closest('.document-host')), 'Tab remains in the PDF on the way to its first field').toBe(true);
  }
  await expect(page.getByRole('textbox', { name: 'reader_name', exact: true })).toBeFocused();
  await page.keyboard.type('Keyboard access check');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab')).toHaveAccessibleDescription('Changes not confirmed saved');
  await expect(page.locator('#reader-status')).toContainText('Changes not confirmed saved');
  const downloadEvent = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadEvent;
  const path = testInfo.outputPath('keyboard-form.pdf');
  await download.saveAs(path);
  const original = await readFile(resolve('tests/fixtures/generated/form.pdf'));
  expect((await readFile(path)).subarray(0, original.length).equals(original)).toBe(true);
  await page.getByRole('button', { name: 'I saved the copy', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab')).not.toHaveAccessibleDescription('Changes not confirmed saved');
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (await chooser).setFiles(path);
  await expect(page.getByRole('textbox', { name: 'reader_name', exact: true })).toHaveValue('Keyboard access check');
});

for (const viewport of [
  { name: '320 CSS pixel reflow', width: 320, height: 256, fontScale: 1 },
  { name: 'phone 200 percent text', width: 390, height: 844, fontScale: 2 },
  { name: 'laptop 200 percent text', width: 1280, height: 800, fontScale: 2 },
]) {
  test(`${viewport.name}: shell controls and dialogs remain reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    if (viewport.fontScale === 2) await page.addStyleTag({ content: ':root { font-size: 200% }' });
    await expect(page.locator('#choose')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await openPdf(page);
    const zoomTextFits = await page.locator('#scale').evaluate((el: HTMLSelectElement) => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = getComputedStyle(el).font;
      return el.clientWidth >= context.measureText(el.selectedOptions[0].text).width + 24;
    });
    expect(zoomTextFits, 'The selected zoom label must remain readable with enlarged text').toBe(true);
    for (const selector of ['#toggle-search', '#tool-draw', '#store-local', '#document-tools', '#scale', '#export', '#page-next', '#mobile-more']) {
      const control = page.locator(selector);
      await control.focus();
      await control.scrollIntoViewIfNeeded();
      const bounds = (await control.boundingBox())!;
      expect(bounds.x, selector).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, selector).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds.y, selector).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height, selector).toBeLessThanOrEqual(viewport.height + 1);
      expect(bounds.width, selector).toBeGreaterThanOrEqual(24);
      expect(bounds.height, selector).toBeGreaterThanOrEqual(24);
    }
    expect(await page.locator('#stage').evaluate(el => el.clientHeight)).toBeGreaterThanOrEqual(160);
    await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
    await page.locator('#mobile-more').click();
    await page.getByRole('button', { name: 'Properties', exact: true }).click();
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Done', exact: true }).focus();
    await page.screenshot({ path: testInfo.outputPath('dialog.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-more')).toBeFocused();
  });
}

test('forced colors and reduced motion keep selected controls and keyboard focus distinguishable', async ({ page }, testInfo) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openPdf(page);
  await page.locator('#tool-highlight').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tool-highlight')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#tool-highlight').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.screenshot({ path: testInfo.outputPath('forced-colors.png'), fullPage: true });
});

test('axe checks all shell content in representative document and dialog states', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const scans: unknown[] = [];
  async function scan(name: string) {
    await page.screenshot({ path: testInfo.outputPath(`audit-${name.replaceAll(' ', '-')}.png`) });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    scans.push({ name, violations: result.violations, incomplete: result.incomplete });
    expect.soft(result.violations, name).toEqual([]);
  }
  await scan('welcome');
  for (const id of ['help', 'library', 'account']) {
    await page.locator(`#${id}`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(`${id} dialog`);
    await page.keyboard.press('Escape');
    await expect(page.locator(`#${id}`)).toBeFocused();
  }
  await openPdf(page);
  await openPdf(page);
  await scan('multiple documents');
  await page.locator('#document-tools').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan('document tools');
  await page.keyboard.press('Escape');
  for (const [id, name] of [['ocr', 'OCR'], ['organize', 'page organization'], ['sign', 'certificate signing']]) {
    await page.locator('#document-tools').click();
    await page.locator(`#document-tool-${id}`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(`${name} dialog`);
    await page.keyboard.press('Escape');
    await expect(page.locator('#document-tools')).toBeFocused();
  }
  await page.locator('#properties').click();
  await scan('document properties');
  await page.keyboard.press('Escape');
  await page.locator('#toggle-search').click();
  await page.locator('#search-input').fill('amber heron');
  await expect(page.locator('#search-status')).toContainText('of 3');
  await scan('search');
  await page.locator('#search-close').click();
  await openPdf(page, 'form.pdf');
  await scan('interactive form');
  await page.locator('#store-local').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan('local storage consent');
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.locator('#store-local')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await scan('phone reader');
  await page.locator('#mobile-more').click();
  await scan('phone actions');
  await testInfo.attach('axe-results', { body: JSON.stringify(scans, null, 2), contentType: 'application/json' });
});

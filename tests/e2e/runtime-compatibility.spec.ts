import { test, expect } from '@playwright/test';

for (const native of [false, true]) {
  test(`unsupported ${native ? 'native WebView' : 'browser'} gets accessible help before reader or storage initialization`, async ({ page }) => {
    const errors: string[] = [];
    const readerModules: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/(?:main|document-controller|pdf(?:\.worker|_viewer)?)[^/]*\.(?:m?js|ts)(?:\?|$)/.test(request.url())) readerModules.push(request.url());
    });
    await page.addInitScript(native => {
      const scope = window as Window & { isTauri?: boolean; folioStartupStorageReads?: number;
        folioStartupCloseCalls?: string[]; __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
      if (native) {
        scope.isTauri = true;
        scope.folioStartupCloseCalls = [];
        scope.__TAURI_INTERNALS__ = { async invoke(command) {
          scope.folioStartupCloseCalls!.push(command);
          if (scope.folioStartupCloseCalls!.length === 1) throw new Error('synthetic close refusal');
        } };
      }
      Object.defineProperty(Promise, 'withResolvers', { configurable: true, value: undefined });
      scope.folioStartupStorageReads = 0;
      for (const name of ['indexedDB', 'localStorage']) Object.defineProperty(scope, name, {
        configurable: true, get() { scope.folioStartupStorageReads!++; throw new Error('startup must not access storage'); },
      });
    }, native);
    await page.goto('/');
    const main = page.getByRole('main', { name: 'Folio needs an update' });
    await expect(main).toBeVisible();
    await expect(main).toBeFocused();
    await expect(page.getByRole('alert')).toContainText(native ? 'WebView2 Evergreen Runtime' : 'HTTPS website');
    await expect(page.locator('#open')).toHaveCount(0);
    await expect(page.locator('#reader')).toHaveCount(0);
    if (native) {
      const url = page.getByRole('textbox', { name: 'Copy this Microsoft download page into your browser:' });
      await expect(url).toHaveValue('https://developer.microsoft.com/microsoft-edge/webview2/consumer/');
      await expect(url).toHaveAttribute('readonly', '');
      await page.keyboard.press('Tab');
      await expect(url).toBeFocused();
      const requestClose = () => page.evaluate(() => {
        window.dispatchEvent(new Event('folio-native-close-request'));
        window.dispatchEvent(new Event('folio-native-close-request'));
      });
      await requestClose();
      await expect(page.getByRole('alert')).toHaveText('Folio remains open because it could not finish closing. Try the window close button again.');
      expect(await page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls)).toEqual(['finish_close']);
      await requestClose();
      await expect.poll(() => page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls))
        .toEqual(['finish_close', 'finish_close']);
    } else {
      await expect(page.getByRole('link', { name: 'Open Folio website' })).toHaveAttribute('href', 'https://folio-local-pdf.gogoi-ronnie.chatgpt.site');
    }
    expect(await page.evaluate(() => (window as Window & { folioStartupStorageReads?: number }).folioStartupStorageReads)).toBe(0);
    expect(readerModules).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('a compatible runtime starts the normal PDF reader', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Folio needs an update' })).toHaveCount(0);
});

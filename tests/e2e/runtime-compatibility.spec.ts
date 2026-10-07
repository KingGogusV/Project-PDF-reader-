import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

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

for (const failure of ['registration', 'cache', 'timeout']) {
  test(`native shell cleanup ${failure} failure stays before reader/storage initialization and permits a guarded close retry`, async ({ page }) => {
    const errors: string[] = [];
    const readerModules: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/(?:main|document-controller|pdf(?:\.worker|_viewer)?)[^/]*\.(?:m?js|ts)(?:\?|$)/.test(request.url())) readerModules.push(request.url());
    });
    await page.addInitScript(failure => {
      const scope = window as Window & { isTauri?: boolean; folioStartupStorageReads?: number;
        folioStartupCloseCalls?: string[]; __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
      scope.isTauri = true;
      scope.folioStartupCloseCalls = [];
      scope.__TAURI_INTERNALS__ = { async invoke(command) {
        scope.folioStartupCloseCalls!.push(command);
        if (scope.folioStartupCloseCalls!.length === 1) throw new Error('synthetic close refusal');
      } };
      navigator.serviceWorker.getRegistrations = failure === 'registration'
        ? async () => { throw new Error('synthetic private diagnostic must not be rendered'); }
        : failure === 'timeout' ? () => new Promise(() => {}) : async () => [];
      if (failure === 'cache') {
        caches.keys = async () => ['folio-app-synthetic-old'];
        caches.delete = async () => false;
      }
      scope.folioStartupStorageReads = 0;
      for (const name of ['indexedDB', 'localStorage']) Object.defineProperty(scope, name, {
        configurable: true, get() { scope.folioStartupStorageReads!++; throw new Error('startup must not access storage'); },
      });
    }, failure);
    await page.goto('/index.html?folio-native=1');
    await expect(page.getByRole('main', { name: 'Folio could not start' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Folio could not start' })).toBeFocused();
    await expect(page.getByRole('alert')).toHaveText('Close and reopen Folio. If it still cannot start, use the current installer or a current browser.');
    await expect(page.locator('#reader')).toHaveCount(0);
    const closeTwice = () => page.evaluate(() => {
      window.dispatchEvent(new Event('folio-native-close-request'));
      window.dispatchEvent(new Event('folio-native-close-request'));
    });
    await closeTwice();
    await expect(page.getByRole('alert')).toHaveText('Folio remains open because it could not finish closing. Try the window close button again.');
    expect(await page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls)).toEqual(['finish_close']);
    await closeTwice();
    await expect.poll(() => page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls)).toEqual(['finish_close', 'finish_close']);
    expect(await page.evaluate(() => (window as Window & { folioStartupStorageReads?: number }).folioStartupStorageReads)).toBe(0);
    expect(readerModules).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('a partially evaluated reader import failure preserves its close guard instead of authorizing an empty-state close', async ({ page, context }) => {
  await page.addInitScript(() => {
    const scope = window as Window & { isTauri?: boolean; partialReaderCloseRequests?: number; emptyStateCloseCalls?: number;
      __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
    scope.isTauri = true;
    scope.partialReaderCloseRequests = 0;
    scope.emptyStateCloseCalls = 0;
    scope.__TAURI_INTERNALS__ = { async invoke() { scope.emptyStateCloseCalls!++; } };
  });
  // This faulting module represents evaluation that has already installed an
  // application close guard before a later initialization error occurs.
  await context.route(/\/main-[^/]+\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body:
    "window.addEventListener('folio-native-close-request', () => window.partialReaderCloseRequests++); window.dispatchEvent(new Event('folio-native-close-guard-ready')); throw new Error('synthetic partial reader failure');" }));
  await page.goto('/index.html?folio-native=1');
  await expect(page.getByRole('region', { name: 'Folio could not start' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('folio-native-close-request')));
  expect(await page.evaluate(() => (window as Window & { partialReaderCloseRequests?: number }).partialReaderCloseRequests)).toBe(1);
  expect(await page.evaluate(() => (window as Window & { emptyStateCloseCalls?: number }).emptyStateCloseCalls)).toBe(0);
});

for (const failure of ['missing-asset', 'early-evaluation']) {
  test(`native reader ${failure} failure remains empty and permits a coalesced close retry`, async ({ page, context }) => {
    await page.addInitScript(() => {
      const scope = window as Window & { isTauri?: boolean; folioStartupStorageReads?: number;
        folioStartupCloseCalls?: string[]; __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
      scope.isTauri = true;
      scope.folioStartupCloseCalls = [];
      scope.__TAURI_INTERNALS__ = { async invoke(command) {
        scope.folioStartupCloseCalls!.push(command);
        if (scope.folioStartupCloseCalls!.length === 1) throw new Error('synthetic close refusal');
      } };
      scope.folioStartupStorageReads = 0;
      for (const name of ['indexedDB', 'localStorage']) Object.defineProperty(scope, name, {
        configurable: true, get() { scope.folioStartupStorageReads!++; throw new Error('early startup must not access storage'); },
      });
    });
    await context.route(/\/main-[^/]+\.js(?:\?.*)?$/, route => failure === 'missing-asset' ? route.abort('failed')
      : route.fulfill({ contentType: 'text/javascript', body: "throw new Error('synthetic early reader failure');" }));
    await page.goto('/index.html?folio-native=1');
    await expect(page.getByRole('main', { name: 'Folio could not start' })).toBeVisible();
    const closeTwice = () => page.evaluate(() => {
      window.dispatchEvent(new Event('folio-native-close-request'));
      window.dispatchEvent(new Event('folio-native-close-request'));
    });
    await closeTwice();
    await expect(page.getByRole('alert')).toHaveText('Folio remains open because it could not finish closing. Try the window close button again.');
    expect(await page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls)).toEqual(['finish_close']);
    await closeTwice();
    await expect.poll(() => page.evaluate(() => (window as Window & { folioStartupCloseCalls?: string[] }).folioStartupCloseCalls)).toEqual(['finish_close', 'finish_close']);
    expect(await page.evaluate(() => (window as Window & { folioStartupStorageReads?: number }).folioStartupStorageReads)).toBe(0);
  });
}

test('the real native reader claims close ownership before installing document interaction handlers', async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as Window & { isTauri?: boolean; closeHandoffObserved?: boolean; unownedDocumentHandlers?: string[];
      __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
    scope.isTauri = true;
    scope.__TAURI_INTERNALS__ = { async invoke() {} };
    scope.closeHandoffObserved = false;
    scope.unownedDocumentHandlers = [];
    window.addEventListener('folio-native-close-guard-ready', () => { scope.closeHandoffObserved = true; });
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (...args: Parameters<typeof add>) {
      const documentInteraction = (this === document && ['keydown', 'drop'].includes(args[0]))
        || (this instanceof HTMLElement && ['open', 'choose', 'demo'].includes(this.id) && args[0] === 'click');
      if (documentInteraction && !scope.closeHandoffObserved) scope.unownedDocumentHandlers!.push(args[0]);
      return add.apply(this, args);
    };
  });
  await page.goto('/index.html?folio-native=1');
  await expect(page.locator('#export .save-label')).toHaveText('Save As');
  expect(await page.evaluate(() => (window as Window & { closeHandoffObserved?: boolean }).closeHandoffObserved)).toBe(true);
  expect(await page.evaluate(() => (window as Window & { unownedDocumentHandlers?: string[] }).unownedDocumentHandlers)).toEqual([]);
});

test('a late failure in the actual native reader preserves its dirty document and usable unsaved-close workflow', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const scope = window as Window & { isTauri?: boolean; nativeCloseRegistrations?: number; nativeFinishCalls?: number;
      releaseLateReaderFault?: () => void; __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
    scope.isTauri = true;
    scope.nativeCloseRegistrations = 0;
    scope.nativeFinishCalls = 0;
    scope.__TAURI_INTERNALS__ = { async invoke(command) {
      if (command !== 'finish_close') throw new Error('Unexpected synthetic native command');
      scope.nativeFinishCalls!++;
    } };
    const add = window.addEventListener;
    window.addEventListener = function (...args: Parameters<typeof add>) {
      if (args[0] === 'folio-native-close-request') scope.nativeCloseRegistrations!++;
      return add.apply(this, args);
    };
  });
  await context.route(/\/main-[^/]+\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    // Preserve the exact built reader and dependencies. Hold only completion
    // of this test's module evaluation, then fault after real document edits.
    await route.fulfill({ response, body: `${await response.text()}\nawait new Promise(resolve => { window.releaseLateReaderFault = resolve; });\nthrow new Error('synthetic late reader fault');\n` });
  });
  await page.goto('/index.html?folio-native=1');
  await expect(page.locator('#export .save-label')).toHaveText('Save As');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open').click();
  await (await chooser).setFiles(fileURLToPath(new URL('../fixtures/generated/form.pdf', import.meta.url)));
  const field = page.locator('input[name="reader_name"]');
  await expect(field).toBeVisible();
  await field.fill('Synthetic edits survive a late startup fault');
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await page.evaluate(() => (window as Window & { releaseLateReaderFault?: () => void }).releaseLateReaderFault!());
  const guidance = page.getByRole('region', { name: 'Folio could not start' });
  await expect(guidance).toBeVisible();
  await expect(guidance).toBeFocused();
  await expect(field).toHaveValue('Synthetic edits survive a late startup fault');
  await expect(page.locator('#dialog')).toHaveCount(1);
  await expect(page.locator('#tabs')).toHaveCount(1);
  await expect(page.locator('#toast')).toHaveCount(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('folio-native-close-request'));
    window.dispatchEvent(new Event('folio-native-close-request'));
  });
  await expect(page.locator('#dialog-title')).toHaveText('Keep your changes?');
  await page.getByRole('button', { name: 'Keep open', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(field).toHaveValue('Synthetic edits survive a late startup fault');
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  expect(await page.evaluate(() => (window as Window & { nativeCloseRegistrations?: number }).nativeCloseRegistrations)).toBe(1);
  expect(await page.evaluate(() => (window as Window & { nativeFinishCalls?: number }).nativeFinishCalls)).toBe(0);
  expect(errors).toEqual([]);
});

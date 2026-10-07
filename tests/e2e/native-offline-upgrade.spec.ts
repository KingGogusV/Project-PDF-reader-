import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { nativeUpgradeOrigin } from './support/native-offline-fixture';
import type * as LibraryModule from '../../src/platform/local-library';

const original = Array.from(await readFile(new URL('../fixtures/generated/text-outline.pdf', import.meta.url)));
const latest = [...original, ...new TextEncoder().encode('\n% synthetic recovery checkpoint\n')];
test.use({ serviceWorkers: 'allow' });

async function snapshotUserStorage(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('folio-local-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const stores = Array.from(db.objectStoreNames);
      const records = await Promise.all(stores.map(async name => {
        const values = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
          const request = db.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return [name, await Promise.all(values.map(async record => ({ ...record,
          ...(record.bytes instanceof ArrayBuffer ? { bytes: Array.from(new Uint8Array(record.bytes)) }
            : record.bytes instanceof Blob ? { bytes: Array.from(new Uint8Array(await record.bytes.arrayBuffer())) } : {}),
        })))];
      }));
      const settings = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
      const preservedCache = await caches.open('synthetic-user-cache');
      const cacheContents = await Promise.all((await preservedCache.keys()).map(async request => [request.url, await (await preservedCache.match(request))!.text()]));
      return { version: db.version, stores, records, settings, cacheContents };
    } finally { db.close(); }
  });
}

for (const delayedInstallation of [false, true]) {
  test(`native upgrade bypasses a persisted old shell and preserves document stores${delayedInstallation ? ' while an old worker update is installing' : ''}`, async ({ page, context, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('The production preview URL is required.');
    const fixture = await nativeUpgradeOrigin(baseURL);
    const errors: string[] = [];
    const nativeRequests: string[] = [];
    try {
      await page.goto(fixture.origin);
      await expect(page.locator('#legacy-shell')).toBeVisible();
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        await navigator.serviceWorker.register('/foreign/sw.js', { scope: '/foreign/' });
      });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).filter(registration => registration.active).length)).toBe(2);
      await page.evaluate(async ({ original, latest }) => {
        const module: typeof LibraryModule = await import('/__vault-module.mjs');
        const library = module.createLocalLibrary(null);
        const record = await library.add({ name: 'synthetic-preservation.pdf', bytes: new Uint8Array(original) });
        await library.saveRevision(record.id, { bytes: new Uint8Array(latest), expectedRevision: record.revision, needsRecovery: true });
        library.close();
        localStorage.setItem('folio.setting.v1.theme', JSON.stringify('dark'));
        localStorage.setItem('synthetic-user-preference', 'retained');
        const cache = await caches.open('synthetic-user-cache');
        await cache.put('/synthetic-user-record', new Response('synthetic record retained'));
      }, { original, latest });
      const before = await snapshotUserStorage(page);
      expect(before.records.find(([name]) => name === 'documents')?.[1]).toHaveLength(1);
      expect(before.records.find(([name]) => name === 'originals')?.[1]).toHaveLength(1);
      expect(before.records.find(([name]) => name === 'latest')?.[1]).toHaveLength(1);
      fixture.upgrade();
      // A fresh page in the same persisted context still gets the old shell,
      // proving that changing server assets alone does not repair this upgrade.
      await page.close();
      const stale = await context.newPage();
      await stale.goto(fixture.origin);
      await expect(stale.locator('#legacy-shell')).toBeVisible();
      expect(await stale.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      if (delayedInstallation) {
        fixture.delayNextInstallation();
        await stale.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
        await expect.poll(() => fixture.installationGateRequests).toBe(1);
        expect(await stale.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.installing?.state)).toBe('installing');
      }
      await stale.close();
      const native = await context.newPage();
      native.on('pageerror', error => errors.push(error.message));
      native.on('request', request => nativeRequests.push(new URL(request.url()).pathname));
      await native.addInitScript(() => {
        const scope = window as Window & { isTauri?: boolean; nativeWorkerRegistrations?: number; nativeRetirementInspections?: number;
          __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
        scope.isTauri = true;
        scope.__TAURI_INTERNALS__ = { async invoke(command) { if (command !== 'finish_close') throw new Error('Unexpected synthetic native command'); } };
        scope.nativeWorkerRegistrations = 0;
        scope.nativeRetirementInspections = 0;
        const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
        navigator.serviceWorker.register = (...args) => { scope.nativeWorkerRegistrations!++; return register(...args); };
        const getRegistrations = navigator.serviceWorker.getRegistrations.bind(navigator.serviceWorker);
        navigator.serviceWorker.getRegistrations = () => { scope.nativeRetirementInspections!++; return getRegistrations(); };
      });
      await native.goto(`${fixture.origin}/index.html?folio-native=1`);
      if (delayedInstallation) {
        await native.waitForFunction(() => (window as Window & { nativeRetirementInspections?: number }).nativeRetirementInspections! > 0);
        expect(fixture.installationHeld).toBe(true);
        expect(nativeRequests.filter(path => /\/main-[^/]+\.js$/.test(path))).toEqual([]);
        await expect(native.locator('#export')).toHaveCount(0);
      }
      // Let the genuine installation job settle; its cache must be retired too.
      fixture.releaseInstallation();
      await expect(native.locator('#export .save-label')).toHaveText('Save As');
      await expect(native.locator('#choose')).toBeVisible();
      await expect(native.locator('#legacy-shell')).toHaveCount(0);
      expect(native.url()).toBe(`${fixture.origin}/index.html?folio-native=1`);
      expect(await native.evaluate(() => (window as Window & { nativeWorkerRegistrations?: number }).nativeWorkerRegistrations)).toBe(0);
      expect(await native.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, script: registration.active?.scriptURL })))).toEqual([
        { scope: `${fixture.origin}/foreign/`, script: `${fixture.origin}/foreign/sw.js` },
      ]);
      expect(await native.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('folio-app-')))).toEqual([]);
      expect(await snapshotUserStorage(native)).toEqual(before);
      expect(nativeRequests.some(path => /\/main-[^/]+\.js$/.test(path))).toBe(true);
      expect(nativeRequests.filter(path => path === '/index.html')).toHaveLength(1);
      expect(errors).toEqual([]);
      await testInfo.attach('native-upgrade-preservation', { body: JSON.stringify({
        realPersistedWorker: true, staleShellReproduced: true, delayedInstallation,
        currentNativeInterface: true, noNativeWorkerRegistration: true, exactUserStoragePreserved: true,
        foreignWorkerPreserved: true, staticShellCachesRetired: true, noReload: true,
      }), contentType: 'application/json' });
      await native.close();
    } finally { await fixture.stop(); }
  });
}

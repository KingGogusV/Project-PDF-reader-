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
      const stale = await context.newPage();
      await stale.goto(fixture.origin);
      // Incognito WebKit can drop CacheStorage response backing and alter
      // unregister/install settlement when its last same-origin client closes. Keep a live
      // client across fresh-page replacements so this test isolates retirement,
      // rather than changing the stored baseline before startup even runs.
      // Real persistent-profile process restarts have a separate Windows gate.
      await page.close();
      await expect(stale.locator('#legacy-shell')).toBeVisible();
      expect(await stale.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      expect(await snapshotUserStorage(stale)).toEqual(before);
      if (delayedInstallation) {
        fixture.delayNextInstallation();
        await stale.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
        await expect.poll(() => fixture.installationGateRequests).toBe(1);
        expect(await stale.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.installing?.state)).toBe('installing');
      }
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
      await stale.close();
      await native.close();
    } finally { await fixture.stop(); }
  });
}

test('a detached owned installation settles before retirement or reaches the safe startup deadline', async ({ page, context, baseURL, browserName }, testInfo) => {
  if (!baseURL) throw new Error('The production preview URL is required.');
  const fixture = await nativeUpgradeOrigin(baseURL);
  const nativeRequests: string[] = [];
  const errors: string[] = [];
  try {
    await page.goto(fixture.origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const foreign = await caches.open('synthetic-user-cache');
      await foreign.put('/synthetic-user-record', new Response('synthetic record retained'));
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect(await page.evaluate(async () => (await (await caches.open('synthetic-user-cache')).keys()).length)).toBe(1);
    fixture.upgrade();
    // This separate control deliberately reproduces the zero-client interval.
    // Some ephemeral WebKit contexts lose the foreign response BEFORE native
    // cleanup. Measure the actual native-page baseline below; do not invent a
    // preserved response or assume every platform has the same cache lifetime.
    await page.close();
    const stale = await context.newPage();
    await stale.goto(fixture.origin);
    await expect(stale.locator('#legacy-shell')).toBeVisible();
    fixture.delayNextInstallation();
    await stale.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
    await expect.poll(() => fixture.installationGateRequests).toBe(1);
    expect(await stale.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.installing?.state)).toBe('installing');
    await stale.close();
    const native = await context.newPage();
    native.on('request', request => nativeRequests.push(new URL(request.url()).pathname));
    native.on('pageerror', error => errors.push(error.message));
    await native.addInitScript(() => {
      const scope = window as Window & { isTauri?: boolean;
        nativeDetachedForeignBaseline?: () => Promise<{ url: string; body: string }[]>;
        nativeDetachedObservation?: () => { states: string[]; unregisterStarted: number; unregisterFinished: number;
          listenerCount: number; deletedCaches: string[]; closeCalls: string[] };
        __TAURI_INTERNALS__?: { invoke(command: string): Promise<void> } };
      scope.isTauri = true;
      const foreignBaseline = (async () => {
        const cache = await caches.open('synthetic-user-cache');
        return Promise.all((await cache.keys()).map(async request => ({
          url: request.url, body: await (await cache.match(request))!.text(),
        })));
      })();
      scope.nativeDetachedForeignBaseline = () => foreignBaseline;
      const workers = new Set<ServiceWorker>();
      const tracked = new WeakSet<EventTarget>();
      const listeners = new Map<EventTarget, Set<EventListenerOrEventListenerObject | null>>();
      const deletedCaches: string[] = [];
      const closeCalls: string[] = [];
      let unregisterStarted = 0;
      let unregisterFinished = 0;
      scope.__TAURI_INTERNALS__ = { async invoke(command) {
        if (command !== 'finish_close') throw new Error('Unexpected synthetic native command');
        closeCalls.push(command);
        if (closeCalls.length === 1) throw new Error('Synthetic close refusal');
      } };
      const observeListeners = (target: EventTarget, observedType: string) => {
        if (tracked.has(target)) return;
        tracked.add(target);
        const present = new Set<EventListenerOrEventListenerObject | null>();
        listeners.set(target, present);
        const add = target.addEventListener;
        const remove = target.removeEventListener;
        target.addEventListener = function (...args: Parameters<typeof add>) {
          if (args[0] === observedType) present.add(args[1]);
          add.apply(this, args);
        };
        target.removeEventListener = function (...args: Parameters<typeof remove>) {
          if (args[0] === observedType) present.delete(args[1]);
          remove.apply(this, args);
        };
      };
      const getRegistrations = navigator.serviceWorker.getRegistrations.bind(navigator.serviceWorker);
      navigator.serviceWorker.getRegistrations = async () => {
        // Snapshot before the helper's first real registration/cleanup call.
        await foreignBaseline;
        const registrations = await getRegistrations();
        for (const registration of registrations) {
          if (registration.scope !== new URL('/', location.href).href || registration.installing?.scriptURL !== new URL('/sw.js', location.href).href) continue;
          workers.add(registration.installing);
          observeListeners(registration.installing, 'statechange');
          observeListeners(registration, 'updatefound');
          const unregister = registration.unregister.bind(registration);
          registration.unregister = async () => {
            unregisterStarted++;
            const result = await unregister();
            unregisterFinished++;
            return result;
          };
        }
        return registrations;
      };
      const removeCache = caches.delete.bind(caches);
      caches.delete = name => { deletedCaches.push(name); return removeCache(name); };
      scope.nativeDetachedObservation = () => ({
        states: [...workers].map(worker => worker.state), unregisterStarted, unregisterFinished,
        listenerCount: [...listeners.values()].reduce((count, current) => count + current.size, 0),
        deletedCaches: [...deletedCaches], closeCalls: [...closeCalls],
      });
    });
    const started = Date.now();
    await native.goto(`${fixture.origin}/index.html?folio-native=1`);
    const beforeNativeForeign = await native.evaluate(() => (window as Window & {
      nativeDetachedForeignBaseline: () => Promise<{ url: string; body: string }[]>;
    }).nativeDetachedForeignBaseline());
    expect([0, 1]).toContain(beforeNativeForeign.length);
    if (beforeNativeForeign.length) expect(beforeNativeForeign).toEqual([{
      url: `${fixture.origin}/synthetic-user-record`, body: 'synthetic record retained',
    }]);
    const observation = () => native.evaluate(() => (window as Window & {
      nativeDetachedObservation: () => { states: string[]; unregisterStarted: number; unregisterFinished: number;
        listenerCount: number; deletedCaches: string[]; closeCalls: string[] };
    }).nativeDetachedObservation());
    await expect.poll(async () => (await observation()).unregisterStarted).toBe(1);
    expect(fixture.installationHeld).toBe(true);
    expect((await observation()).states).toEqual(['installing']);
    const heldObservation = await observation();
    expect([0, 1]).toContain(heldObservation.unregisterFinished);
    expect((await observation()).deletedCaches).toEqual([]);
    expect(nativeRequests.filter(path => /\/main-[^/]+\.js$/.test(path))).toEqual([]);
    await expect(native.locator('#export')).toHaveCount(0);
    await testInfo.attach('detached-install-held-state', { body: JSON.stringify({
      browserName, foreignBaselineCount: beforeNativeForeign.length, held: heldObservation,
    }), contentType: 'application/json' });
    fixture.releaseInstallation();
    await expect.poll(() => fixture.installationCompletionRequests).toBe(1);
    const outcome = () => native.evaluate(() => {
      if (document.querySelector('#export .save-label')?.textContent === 'Save As') return 'reader';
      if (document.querySelector('main[aria-labelledby="runtime-update-title"] #runtime-update-title')?.textContent === 'Folio could not start') return 'help';
      return 'pending';
    });
    // Cache-write completion precedes delivery of the worker statechange.
    // Wait for the actual reader/deadline outcome before classifying its state.
    await expect.poll(outcome).not.toBe('pending');
    const stateAtOutcome = (await observation()).states;
    expect(stateAtOutcome).toHaveLength(1);
    const settled = ['installed', 'activating', 'activated', 'redundant'].includes(stateAtOutcome[0]);
    if (!settled) {
      // A detached job can finish its writes without ever advancing its worker.
      // Only a still-pending captured worker at the original deadline permits
      // help; arbitrary startup failures cannot substitute for safe settlement.
      expect(['parsed', 'installing']).toContain(stateAtOutcome[0]);
      expect(await outcome()).toBe('help');
      await expect(native.getByRole('main', { name: 'Folio could not start' })).toBeVisible();
      expect(Date.now() - started).toBeGreaterThanOrEqual(9_500);
      expect(await native.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('folio-app-')).sort())).toEqual([
        'folio-app-legacy', 'folio-app-legacy-pending',
      ]);
      const closeTwice = () => native.evaluate(() => {
        window.dispatchEvent(new Event('folio-native-close-request'));
        window.dispatchEvent(new Event('folio-native-close-request'));
      });
      await closeTwice();
      await expect(native.getByRole('alert')).toHaveText('Folio remains open because it could not finish closing. Try the window close button again.');
      expect((await observation()).closeCalls).toEqual(['finish_close']);
      await closeTwice();
      await expect.poll(async () => (await observation()).closeCalls).toEqual(['finish_close', 'finish_close']);
      expect((await observation()).deletedCaches).toEqual([]);
      expect(nativeRequests.filter(path => /\/main-[^/]+\.js$/.test(path))).toEqual([]);
      await expect(native.locator('#export')).toHaveCount(0);
    } else {
      expect(await outcome()).toBe('reader');
      await expect(native.locator('#export .save-label')).toHaveText('Save As');
      expect((await observation()).states.every(state => state !== 'installing')).toBe(true);
      expect((await observation()).deletedCaches.sort()).toEqual(['folio-app-legacy', 'folio-app-legacy-pending']);
      expect(await native.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('folio-app-')))).toEqual([]);
      // The fixture's complete request follows its actual final cache write.
      // A second inspection after completion/reader initialization must still
      // find no recreation by the previously captured installation.
      expect(fixture.installationCompletionRequests).toBe(1);
      expect(await native.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('folio-app-')))).toEqual([]);
    }
    expect((await observation()).listenerCount).toBe(0);
    expect(await native.evaluate(async () => {
      const cache = await caches.open('synthetic-user-cache');
      return Promise.all((await cache.keys()).map(async request => ({
        url: request.url, body: await (await cache.match(request))!.text(),
      })));
    })).toEqual(beforeNativeForeign);
    expect(native.url()).toBe(`${fixture.origin}/index.html?folio-native=1`);
    expect(nativeRequests.filter(path => path === '/index.html')).toHaveLength(1);
    expect(errors).toEqual([]);
    await testInfo.attach('detached-install-retirement', { body: JSON.stringify({
      browserName, realOwnedWorkerCaptured: true, gateHeldBeforeRetirement: true,
      outcome: settled ? 'settled-before-retirement' : 'deadline-before-reader-and-deletion', stateAtOutcome,
      beforeNativeForeignCount: beforeNativeForeign.length, exactMeasuredForeignBaselinePreserved: true,
      final: await observation(), installationCompletionRequests: fixture.installationCompletionRequests,
      elapsedMs: Date.now() - started, noReload: true,
    }), contentType: 'application/json' });
    await native.close();
  } finally { await fixture.stop(); }
});

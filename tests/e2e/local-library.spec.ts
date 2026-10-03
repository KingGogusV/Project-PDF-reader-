import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as VaultModule from '../../src/platform/local-library';

declare global { interface Window { vaultModule: typeof VaultModule } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixturePath = join(root, 'tests', 'fixtures', 'generated', 'text-outline.pdf');
const moduleSource = stripTypeScriptTypes(await readFile(join(root, 'src', 'platform', 'local-library.ts'), 'utf8'));
const original = new Uint8Array(await readFile(fixturePath));
const updated = new Uint8Array([...original, ...new TextEncoder().encode('\n% local recovery revision two\n')]);
const alternate = new Uint8Array([...original, ...new TextEncoder().encode('\n% independent recovery revision\n')]);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test.use({ serviceWorkers: 'block' });

async function loadModule(page: Page) {
  await page.goto('/__vault-test.html');
  await page.evaluate(async () => { const url = '/__vault-test.mjs'; window.vaultModule = await import(url); });
}

test.beforeEach(async ({ page, context }) => {
  // Serve the exact TypeScript module with only types removed. Real browser IndexedDB,
  // Blob, crypto, transactions, reloads and storage capabilities execute below.
  await context.route('**/__vault-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local library browser test</title><body>Local library test</body>' }));
  await context.route('**/__vault-test.mjs', route => route.fulfill({ contentType: 'text/javascript', body: moduleSource }));
  await loadModule(page);
});

test('original and recovery checkpoint survive reload with independent verified bytes', async ({ page }) => {
  const result = await page.evaluate(async ({ initial, next }) => {
    const library = window.vaultModule.createLocalLibrary('account-a');
    const added = await library.add({ name: 'private.pdf', bytes: new Uint8Array(initial) });
    const saved = await library.saveRevision(added.id, { bytes: new Uint8Array(next), expectedRevision: added.revision, needsRecovery: true });
    library.close();
    return saved;
  }, { initial: Array.from(original), next: Array.from(updated) });
  expect(result.revision).toBe(2);
  expect(result.needsRecovery).toBe(true);
  await loadModule(page);
  const recovered = await page.evaluate(async id => {
    const library = window.vaultModule.createLocalLibrary('account-a');
    const document = await library.read(id);
    const list = await library.list({ recoveryOnly: true });
    const estimate = await library.estimateStorage();
    document.originalBytes[0] = 0;
    const pristine = await library.readOriginal(id);
    return { originalHash: pristine.originalSha256, originalFirstByte: pristine.bytes[0], latestHash: document.latestSha256,
      latest: Array.from(document.latestBytes), list, estimate };
  }, result.id);
  expect(recovered.originalHash).toBe(digest(original));
  expect(recovered.originalFirstByte).toBe(original[0]);
  expect(recovered.latestHash).toBe(digest(updated));
  expect(recovered.latest).toEqual(Array.from(updated));
  expect(recovered.list).toHaveLength(1);
  expect(recovered.list[0]).not.toHaveProperty('originalBytes');
  expect(recovered.estimate.storedBytes).toBe(original.length + updated.length);
});

test('account namespaces and guest storage cannot read or delete each other through the API', async ({ page }) => {
  const result = await page.evaluate(async bytes => {
    const { createLocalLibrary } = window.vaultModule;
    const alice = createLocalLibrary('alice');
    const bob = createLocalLibrary('bob');
    const guest = createLocalLibrary(null);
    const namedGuest = createLocalLibrary('guest');
    const a = await alice.add({ name: 'same.pdf', bytes: new Uint8Array(bytes) });
    const g = await guest.add({ name: 'same.pdf', bytes: new Uint8Array(bytes) });
    const denied: string[] = [];
    for (const action of [() => bob.read(a.id), () => bob.remove(a.id, 1), () => namedGuest.read(g.id)]) {
      try { await action(); } catch (error) { denied.push((error as VaultModule.LocalLibraryError).code); }
    }
    return { denied, alice: await alice.list(), bob: await bob.list(), guest: await guest.list(), namedGuest: await namedGuest.list() };
  }, Array.from(original));
  expect(result.denied).toEqual(['NOT_FOUND', 'NOT_FOUND', 'NOT_FOUND']);
  expect(result.alice).toHaveLength(1);
  expect(result.guest).toHaveLength(1);
  expect(result.bob).toEqual([]);
  expect(result.namedGuest).toEqual([]);
});

test('concurrent browser tabs reject stale revisions and retain exactly one complete winner', async ({ page, context }) => {
  const added = await page.evaluate(async bytes => window.vaultModule.createLocalLibrary('shared').add({ name: 'shared.pdf', bytes: new Uint8Array(bytes) }), Array.from(original));
  const second = await context.newPage();
  await loadModule(second);
  const save = (target: Page, bytes: Uint8Array) => target.evaluate(async ({ id, bytes }) => {
    try {
      const saved = await window.vaultModule.createLocalLibrary('shared').saveRevision(id, { bytes: new Uint8Array(bytes), expectedRevision: 1, needsRecovery: true });
      return { code: 'OK', hash: saved.latestSha256 };
    } catch (error) { return { code: (error as VaultModule.LocalLibraryError).code, hash: '' }; }
  }, { id: added.id, bytes: Array.from(bytes) });
  const attempts = await Promise.all([save(page, updated), save(second, alternate)]);
  expect(attempts.map(result => result.code).sort()).toEqual(['CONFLICT', 'OK']);
  const winner = attempts.find(result => result.code === 'OK')!;
  const stored = await page.evaluate(async id => {
    const library = window.vaultModule.createLocalLibrary('shared');
    const record = await library.read(id);
    return { revision: record.revision, originalSha256: record.originalSha256, latestSha256: record.latestSha256, usage: await library.estimateStorage() };
  }, added.id);
  expect(stored.revision).toBe(2);
  expect(stored.originalSha256).toBe(digest(original));
  expect(stored.latestSha256).toBe(winner.hash);
  expect(stored.usage.documentCount).toBe(1);
});

test('transaction completion precedes success and quota failure rolls the full checkpoint back', async ({ page }) => {
  const result = await page.evaluate(async ({ initial, next, third }) => {
    const library = window.vaultModule.createLocalLibrary('quota');
    const added = await library.add({ name: 'quota.pdf', bytes: new Uint8Array(initial) });
    const events: string[] = [];
    const nativeTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof nativeTransaction>) {
      const tx = nativeTransaction.apply(this, args);
      if (args[1] === 'readwrite') tx.addEventListener('complete', () => events.push('complete'));
      return tx;
    };
    let revision: VaultModule.LocalDocumentMetadata;
    try {
      revision = await library.saveRevision(added.id, { bytes: new Uint8Array(next), expectedRevision: 1, needsRecovery: true });
      events.push('resolved');
    } finally { IDBDatabase.prototype.transaction = nativeTransaction; }
    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof nativePut>) {
      // The latest-Blob put succeeds first; failure at metadata must roll that put back too.
      if (this.name === 'documents') throw new DOMException('Injected full device', 'QuotaExceededError');
      return nativePut.apply(this, args);
    };
    let failureCode = '';
    try { await library.saveRevision(added.id, { bytes: new Uint8Array(third), expectedRevision: revision.revision, needsRecovery: true }); }
    catch (error) { failureCode = (error as VaultModule.LocalLibraryError).code; }
    finally { IDBObjectStore.prototype.put = nativePut; }
    const after = await library.read(added.id);
    return { events, failureCode, revision: after.revision, latest: Array.from(after.latestBytes), originalHash: after.originalSha256, usage: await library.estimateStorage() };
  }, { initial: Array.from(original), next: Array.from(updated), third: Array.from(alternate) });
  expect(result.events).toEqual(['complete', 'resolved']);
  expect(result.failureCode).toBe('QUOTA_EXCEEDED');
  expect(result.revision).toBe(2);
  expect(result.latest).toEqual(Array.from(updated));
  expect(result.originalHash).toBe(digest(original));
  expect(result.usage.storedBytes).toBe(original.length + updated.length);
});

test('bounded storage rejects excess writes and stale deletion without losing originals', async ({ page }) => {
  const result = await page.evaluate(async bytes => {
    const library = window.vaultModule.createLocalLibrary('bounded', { limits: { maxDocuments: 1, maxStoredBytes: bytes.length + 1 } });
    const document = await library.add({ name: 'one.pdf', bytes: new Uint8Array(bytes) });
    const errors: string[] = [];
    for (const action of [
      () => library.add({ name: 'two.pdf', bytes: new Uint8Array(bytes) }),
      () => library.saveRevision(document.id, { bytes: new Uint8Array([...bytes, 10]), expectedRevision: 1, needsRecovery: true }),
      () => library.remove(document.id, 2),
    ]) { try { await action(); } catch (error) { errors.push((error as VaultModule.LocalLibraryError).code); } }
    const beforeDelete = await library.read(document.id);
    await library.remove(document.id, 1);
    return { errors, originalHash: beforeDelete.originalSha256, revision: beforeDelete.revision, list: await library.list(), usage: await library.estimateStorage() };
  }, Array.from(original));
  expect(result.errors).toEqual(['LIMIT_EXCEEDED', 'LIMIT_EXCEEDED', 'CONFLICT']);
  expect(result.originalHash).toBe(digest(original));
  expect(result.revision).toBe(1);
  expect(result.list).toEqual([]);
  expect(result.usage.storedBytes).toBe(0);
});

test('damaged latest bytes are detected while the separately stored original remains recoverable', async ({ page }) => {
  const result = await page.evaluate(async ({ initial, next }) => {
    const { createLocalLibrary, LOCAL_LIBRARY_DATABASE_NAME } = window.vaultModule;
    const library = createLocalLibrary('integrity');
    const added = await library.add({ name: 'integrity.pdf', bytes: new Uint8Array(initial) });
    await library.saveRevision(added.id, { bytes: new Uint8Array(next), expectedRevision: 1, needsRecovery: true });
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(LOCAL_LIBRARY_DATABASE_NAME); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('latest', 'readwrite');
      const corrupted = new Uint8Array(next); corrupted[corrupted.length - 4] ^= 0xff;
      tx.objectStore('latest').put({ schemaVersion: 1, owner: 'account:integrity', id: added.id, bytes: new Blob([corrupted], { type: 'application/pdf' }) });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    db.close();
    let code = '';
    try { await library.read(added.id); } catch (error) { code = (error as VaultModule.LocalLibraryError).code; }
    const source = await library.readOriginal(added.id);
    await library.saveRevision(added.id, { bytes: new Uint8Array(next), expectedRevision: 2, needsRecovery: true });
    const repaired = await library.read(added.id);
    return { code, original: Array.from(source.bytes), stillListed: (await library.list()).length, repairedHash: repaired.latestSha256 };
  }, { initial: Array.from(original), next: Array.from(updated) });
  expect(result.code).toBe('CORRUPT');
  expect(result.original).toEqual(Array.from(original));
  expect(result.stillListed).toBe(1);
  expect(result.repairedHash).toBe(digest(updated));
});

test('recovery acknowledgment uses revision checks and never discards the stored checkpoint', async ({ page }) => {
  const result = await page.evaluate(async ({ initial, next }) => {
    const library = window.vaultModule.createLocalLibrary(null);
    const added = await library.add({ name: 'guest.pdf', bytes: new Uint8Array(initial) });
    const checkpoint = await library.saveRevision(added.id, { bytes: new Uint8Array(next), expectedRevision: 1, needsRecovery: true });
    let stale = '';
    try { await library.markRecovered(added.id, 1); } catch (error) { stale = (error as VaultModule.LocalLibraryError).code; }
    const acknowledged = await library.markRecovered(added.id, checkpoint.revision);
    const recovered = await library.read(added.id);
    return { stale, acknowledged, count: (await library.list({ recoveryOnly: true })).length, latest: Array.from(recovered.latestBytes) };
  }, { initial: Array.from(original), next: Array.from(updated) });
  expect(result.stale).toBe('CONFLICT');
  expect(result.acknowledged.revision).toBe(3);
  expect(result.acknowledged.needsRecovery).toBe(false);
  expect(result.count).toBe(0);
  expect(result.latest).toEqual(Array.from(updated));
});

test('unavailable IndexedDB and closed sessions fail explicitly', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createLocalLibrary } = window.vaultModule;
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
    const errors: string[] = [];
    Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('Unavailable storage', 'SecurityError'); } });
    try { await createLocalLibrary('blocked').list(); } catch (error) { errors.push((error as VaultModule.LocalLibraryError).code); }
    finally { if (originalDescriptor) Object.defineProperty(window, 'indexedDB', originalDescriptor); else delete (window as unknown as Record<string, unknown>).indexedDB; }
    const library = createLocalLibrary('closed'); library.close();
    try { await library.list(); } catch (error) { errors.push((error as VaultModule.LocalLibraryError).code); }
    return errors;
  });
  expect(result).toEqual(['UNAVAILABLE', 'CLOSED']);
});

test('persistence capability is browser-controlled and local operations send no network requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const result = await page.evaluate(async bytes => {
    const library = window.vaultModule.createLocalLibrary('private');
    const added = await library.add({ name: 'private.pdf', bytes: new Uint8Array(bytes) });
    await library.read(added.id);
    const persistence = await library.requestPersistence();
    return { persistence, estimate: await library.estimateStorage() };
  }, Array.from(original));
  expect(['granted', 'denied', 'unsupported']).toContain(result.persistence);
  expect(result.estimate.documentCount).toBe(1);
  expect(result.estimate.storedBytes).toBe(original.length);
  expect(requests).toEqual([]);
});

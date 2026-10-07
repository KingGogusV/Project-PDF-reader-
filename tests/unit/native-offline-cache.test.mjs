import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { retireNativeOfflineAssets } from '../../src/platform/native-offline-cache.ts';

const origin = 'http://tauri.localhost';
const scriptURL = `${origin}/sw.js`;
function fixture(specifications, names = []) {
  const events = [];
  const registrations = specifications.map(specification => ({
    scope: `${origin}/`, ...specification,
    async unregister() {
      events.push(['unregister', this.scope]);
      registrations.splice(registrations.indexOf(this), 1);
      return true;
    },
  }));
  const cacheNames = new Set(names);
  return { events, registrations, cacheNames, services: {
    serviceWorker: { async getRegistrations() { return [...registrations]; } },
    caches: { async keys() { return [...cacheNames]; }, async delete(name) { events.push(['delete', name]); return cacheNames.delete(name); } },
  } };
}

test('retirement owns only the exact root worker, including active/waiting/installing versions', async () => {
  for (const state of ['active', 'waiting', 'installing']) {
    const owned = fixture([{ [state]: { scriptURL } }], ['folio-app-old', 'folio-app-new', 'pdf-user-copies', 'foreign-app-cache']);
    await retireNativeOfflineAssets(`${origin}/index.html?folio-native=1`, owned.services);
    assert.deepEqual(owned.registrations, []);
    assert.deepEqual([...owned.cacheNames], ['pdf-user-copies', 'foreign-app-cache']);
    assert.deepEqual(owned.events, [['unregister', `${origin}/`], ['delete', 'folio-app-old'], ['delete', 'folio-app-new']]);
  }
  const allStates = fixture([{ active: { scriptURL }, waiting: { scriptURL }, installing: { scriptURL } }]);
  await retireNativeOfflineAssets(`${origin}/`, allStates.services);
  assert.equal(allStates.registrations.length, 0);
});

test('foreign scopes, scripts, origins, query variants and mixed worker identities remain registered', async () => {
  const foreign = fixture([
    { scope: `${origin}/foreign/`, active: { scriptURL } },
    { scope: 'https://another.example/', active: { scriptURL: 'https://another.example/sw.js' } },
    { active: { scriptURL: `${origin}/other-worker.js` } },
    { active: { scriptURL: `${scriptURL}?version=foreign` } },
    { active: { scriptURL }, installing: { scriptURL: `${origin}/other-worker.js` } },
    {},
  ], ['folio-app-old', 'folio-app', 'folio-app_backup', 'user-store']);
  await retireNativeOfflineAssets(`${origin}/index.html?folio-native=1`, foreign.services);
  assert.equal(foreign.registrations.length, 6);
  assert.deepEqual(foreign.events, [['delete', 'folio-app-old']]);
  assert.deepEqual([...foreign.cacheNames], ['folio-app', 'folio-app_backup', 'user-store']);
});

test('static cache deletion waits for unregister completion', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const owned = fixture([{ active: { scriptURL } }], ['folio-app-old']);
  const unregister = owned.registrations[0].unregister;
  owned.registrations[0].unregister = async function () { await pending; return unregister.call(this); };
  const retirement = retireNativeOfflineAssets(`${origin}/`, owned.services);
  await setImmediate();
  assert.deepEqual(owned.events, []);
  assert.equal(owned.cacheNames.has('folio-app-old'), true);
  finish();
  await retirement;
  assert.deepEqual(owned.events.map(([operation]) => operation), ['unregister', 'delete']);
});

test('registration errors prevent cache deletion and incomplete retirement fails closed', async () => {
  const failure = fixture([{ active: { scriptURL } }], ['folio-app-old']);
  failure.registrations[0].unregister = async () => { throw new Error('synthetic unregister failure'); };
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, failure.services), /synthetic unregister failure/);
  assert.deepEqual(failure.events, []);
  failure.registrations[0].unregister = async () => false;
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, failure.services), /still registered/);
  assert.deepEqual(failure.events, []);
  const cacheFailure = fixture([], ['folio-app-old']);
  cacheFailure.services.caches.delete = async () => false;
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, cacheFailure.services), /cache is still present/);
  cacheFailure.services.caches.delete = async () => { throw new Error('synthetic cache failure'); };
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, cacheFailure.services), /synthetic cache failure/);
});

test('already-removed entries and absent APIs are safe; custom native origins never read browser services', async () => {
  const disappeared = fixture([{ active: { scriptURL } }], ['folio-app-old']);
  disappeared.registrations[0].unregister = async () => { disappeared.registrations.length = 0; return false; };
  disappeared.services.caches.delete = async name => { disappeared.cacheNames.delete(name); return false; };
  await retireNativeOfflineAssets(`${origin}/`, disappeared.services);
  await retireNativeOfflineAssets(`${origin}/`, {});
  const unreadable = new Proxy({}, { get() { throw new Error('unsupported origin must not read services'); } });
  await retireNativeOfflineAssets('tauri://localhost/index.html?folio-native=1', unreadable);
});

test('a timed-out unregister cannot proceed to cache deletion when it eventually settles', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const owned = fixture([{ active: { scriptURL } }], ['folio-app-old']);
  const unregister = owned.registrations[0].unregister;
  owned.registrations[0].unregister = async function () { await pending; return unregister.call(this); };
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, owned.services, 15), /took too long/);
  finish();
  await setImmediate();
  assert.deepEqual(owned.events, [['unregister', `${origin}/`]]);
  assert.deepEqual([...owned.cacheNames], ['folio-app-old']);
});

test('a timed-out cache call cannot delete additional caches after a late completion', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const owned = fixture([], ['folio-app-old', 'folio-app-next']);
  const remove = owned.services.caches.delete;
  owned.services.caches.delete = async name => { await pending; return remove(name); };
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, owned.services, 15), /took too long/);
  finish();
  await setImmediate();
  assert.deepEqual(owned.events, [['delete', 'folio-app-old']]);
  assert.deepEqual([...owned.cacheNames], ['folio-app-next']);
});

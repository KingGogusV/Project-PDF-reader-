import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { retireNativeOfflineAssets } from '../../src/platform/native-offline-cache.ts';

const origin = 'http://tauri.localhost';
const scriptURL = `${origin}/sw.js`;
function observable(properties) {
  const target = new EventTarget();
  const listeners = new Map();
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  return Object.assign(target, properties, {
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      add(type, listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
      remove(type, listener);
    },
  });
}
const worker = (state = 'installing', url = scriptURL) => observable({ scriptURL: url, state });
function settle(target, state = 'installed') { target.state = state; target.dispatchEvent(new Event('statechange')); }
function assertNoListeners(...targets) {
  for (const target of targets) for (const listeners of target.listeners.values()) assert.equal(listeners.size, 0);
}
function fixture(specifications, names = []) {
  const events = [];
  const registrations = specifications.map(specification => observable({
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
    const owned = fixture([{ [state]: state === 'installing' ? worker('installed') : { scriptURL } }], ['folio-app-old', 'folio-app-new', 'pdf-user-copies', 'foreign-app-cache']);
    await retireNativeOfflineAssets(`${origin}/index.html?folio-native=1`, owned.services);
    assert.deepEqual(owned.registrations, []);
    assert.deepEqual([...owned.cacheNames], ['pdf-user-copies', 'foreign-app-cache']);
    assert.deepEqual(owned.events, [['unregister', `${origin}/`], ['delete', 'folio-app-old'], ['delete', 'folio-app-new']]);
  }
  const allStates = fixture([{ active: { scriptURL }, waiting: { scriptURL }, installing: worker('installed') }]);
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

test('captured installing workers settle before cache deletion in every completed state', async () => {
  for (const state of ['installed', 'activating', 'activated', 'redundant']) {
    const installing = worker();
    const owned = fixture([{ active: { scriptURL }, installing }], ['folio-app-old']);
    const registration = owned.registrations[0];
    const retirement = retireNativeOfflineAssets(`${origin}/`, owned.services);
    await setImmediate();
    assert.deepEqual(owned.events, [['unregister', `${origin}/`]]);
    assert.equal(owned.cacheNames.has('folio-app-old'), true);
    assert.equal(installing.listeners.get('statechange').size, 1);
    settle(installing, state);
    await retirement;
    assert.deepEqual(owned.events.map(([operation]) => operation), ['unregister', 'delete']);
    assertNoListeners(registration, installing);
  }
});

test('a newly captured parsed worker must install and settle before cache deletion', async () => {
  const installing = worker('parsed');
  const owned = fixture([{ installing }], ['folio-app-old']);
  const registration = owned.registrations[0];
  const retirement = retireNativeOfflineAssets(`${origin}/`, owned.services);
  await setImmediate();
  assert.equal(owned.cacheNames.has('folio-app-old'), true);
  settle(installing, 'installing');
  await setImmediate();
  assert.equal(owned.cacheNames.has('folio-app-old'), true);
  assert.equal(installing.listeners.get('statechange').size, 1);
  settle(installing, 'installed');
  await retirement;
  assert.deepEqual(owned.events.map(([operation]) => operation), ['unregister', 'delete']);
  assertNoListeners(registration, installing);
});

test('updatefound captures exact-script workers only during the unregister acknowledgement', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const owned = fixture([{ active: { scriptURL } }], ['folio-app-old']);
  const registration = owned.registrations[0];
  const unregister = registration.unregister;
  registration.unregister = async function () { await pending; return unregister.call(this); };
  const retirement = retireNativeOfflineAssets(`${origin}/`, owned.services);
  await setImmediate();
  const installing = worker();
  registration.installing = installing;
  registration.dispatchEvent(new Event('updatefound'));
  registration.dispatchEvent(new Event('updatefound'));
  const foreign = worker('installing', `${origin}/foreign-worker.js`);
  registration.installing = foreign;
  registration.dispatchEvent(new Event('updatefound'));
  finish();
  await setImmediate();
  assert.equal(installing.listeners.get('statechange').size, 1);
  assert.equal(foreign.listeners.size, 0);
  assert.equal(owned.cacheNames.has('folio-app-old'), true);
  const tooLate = worker();
  registration.installing = tooLate;
  registration.dispatchEvent(new Event('updatefound'));
  settle(installing);
  await retirement;
  assert.equal(tooLate.listeners.size, 0);
  assertNoListeners(registration, installing, foreign);
});

test('state changes before and during subscription cannot leave a completed install waiting', async () => {
  for (const settleDuringSubscription of [false, true]) {
    const installing = worker();
    const owned = fixture([{ installing }], ['folio-app-old']);
    const registration = owned.registrations[0];
    if (settleDuringSubscription) {
      const add = installing.addEventListener;
      installing.addEventListener = function (...args) {
        this.state = 'installed';
        add.apply(this, args);
      };
    } else {
      const unregister = registration.unregister;
      registration.unregister = async function () { settle(installing); return unregister.call(this); };
    }
    await retireNativeOfflineAssets(`${origin}/`, owned.services, 100);
    assert.deepEqual([...owned.cacheNames], []);
    assertNoListeners(registration, installing);
  }
});

test('unregister failures and timeouts remove update listeners and cannot capture later work', async () => {
  for (const failure of ['reject', 'timeout']) {
    let finish;
    const owned = fixture([{ active: { scriptURL } }], ['folio-app-old']);
    const registration = owned.registrations[0];
    registration.unregister = failure === 'reject'
      ? async () => { throw new Error('synthetic unregister failure'); }
      : () => new Promise(resolve => { finish = resolve; });
    await assert.rejects(retireNativeOfflineAssets(`${origin}/`, owned.services, 15),
      failure === 'reject' ? /synthetic unregister failure/ : /took too long/);
    assertNoListeners(registration);
    const tooLate = worker();
    registration.installing = tooLate;
    registration.dispatchEvent(new Event('updatefound'));
    finish?.(true);
    await setImmediate();
    assert.equal(tooLate.listeners.size, 0);
    assert.deepEqual(owned.events, []);
    assert.deepEqual([...owned.cacheNames], ['folio-app-old']);
  }
});

test('a detached install deadline removes all listeners and fences late writes and settlement', async () => {
  const installing = worker();
  const owned = fixture([{ installing }], ['folio-app-old']);
  const registration = owned.registrations[0];
  await assert.rejects(retireNativeOfflineAssets(`${origin}/`, owned.services, 15), /took too long/);
  assertNoListeners(registration, installing);
  owned.cacheNames.add('folio-app-late');
  settle(installing);
  await setImmediate();
  assert.deepEqual(owned.events, [['unregister', `${origin}/`]]);
  assert.deepEqual([...owned.cacheNames], ['folio-app-old', 'folio-app-late']);
});

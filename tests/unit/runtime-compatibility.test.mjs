import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingRuntimeCapabilities } from '../../src/platform/runtime-compatibility.ts';

const present = () => undefined;
const supported = () => ({
  Promise: { withResolvers: present }, AbortSignal: { any: present, timeout: present },
  structuredClone: present, crypto: { subtle: { digest: present }, randomUUID: present },
  Array: { prototype: { at: present } }, TextEncoder: present, TextDecoder: present,
  Worker: present, DOMMatrix: present, ResizeObserver: present, IntersectionObserver: present,
});

test('the required reader APIs do not require optional storage, service workers or decoder accelerators', () => {
  assert.deepEqual(missingRuntimeCapabilities(supported()), []);
});

test('each required missing or non-callable API is reported before reader initialization', () => {
  for (const path of ['Promise.withResolvers', 'AbortSignal.any', 'AbortSignal.timeout', 'structuredClone',
    'crypto.subtle.digest', 'crypto.randomUUID', 'Array.prototype.at', 'TextEncoder', 'TextDecoder',
    'Worker', 'DOMMatrix', 'ResizeObserver', 'IntersectionObserver']) {
    for (const value of [undefined, null, true, 'function']) {
      const runtime = supported();
      const segments = path.split('.');
      let owner = runtime;
      for (const key of segments.slice(0, -1)) owner = owner[key];
      owner[segments.at(-1)] = value;
      assert.deepEqual(missingRuntimeCapabilities(runtime), [path]);
    }
  }
});

test('absent namespaces and blocked capability getters fail safely without probing storage', () => {
  const runtime = supported();
  delete runtime.Promise;
  delete runtime.crypto;
  Object.defineProperty(runtime, 'structuredClone', { get() { throw new Error('synthetic access refusal'); } });
  Object.defineProperty(runtime, 'indexedDB', { get() { throw new Error('must not access storage'); } });
  assert.deepEqual(missingRuntimeCapabilities(runtime), ['Promise.withResolvers', 'structuredClone', 'crypto.subtle.digest', 'crypto.randomUUID']);
});

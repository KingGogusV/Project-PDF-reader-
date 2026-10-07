import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { BROWSER_CSP, frontendCsp, nativeIndexHtml } from '../../scripts/native-csp.mjs';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const policy = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
const nativePolicy = BROWSER_CSP.replace("connect-src 'self';", "connect-src 'self' ipc: http://ipc.localhost;");

test('browser HTML and policy remain unchanged without a recognized Tauri platform', () => {
  assert.equal(policy(source), BROWSER_CSP);
  for (const platform of [undefined, '', 'browser', 'unknown', 'Windows']) {
    assert.equal(nativeIndexHtml(source, platform), source);
    assert.equal(frontendCsp(platform), BROWSER_CSP);
  }
});

test('native metadata adds only the two exact local IPC sources and matches Tauri policy', async () => {
  const tauri = JSON.parse(await readFile(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(nativePolicy, tauri.app.security.csp);
  for (const platform of ['windows', 'darwin', 'linux', 'android', 'ios']) {
    assert.equal(policy(nativeIndexHtml(source, platform)), nativePolicy);
    assert.equal(frontendCsp(platform), nativePolicy);
    assert.equal(nativeIndexHtml(source, platform).replace(nativePolicy, BROWSER_CSP), source);
  }
});

test('native transformation fails closed when metadata is missing, duplicated or changed', () => {
  const metadata = source.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0];
  assert.throws(() => nativeIndexHtml(source.replace(metadata, ''), 'windows'), /exactly one/);
  assert.throws(() => nativeIndexHtml(source.replace(metadata, metadata + metadata), 'windows'), /exactly one/);
  assert.throws(() => nativeIndexHtml(source.replace("connect-src 'self';", "connect-src *;"), 'windows'), /policy changes/);
});

test('the existing signing harness can still merge the application configuration', async () => {
  const { default: config } = await import('../core/signing.vite.config.ts');
  assert.equal(typeof config, 'object');
  assert.equal(config.server.headers['X-Content-Type-Options'], 'nosniff');
  assert.ok(config.plugins.some(plugin => plugin.name === 'folio-native-csp'));
});

test('actual Vite development responses apply matching metadata and headers only for native hooks', async () => {
  const originalPlatform = process.env.TAURI_ENV_PLATFORM;
  try {
    for (const platform of [undefined, 'windows']) {
      if (platform === undefined) delete process.env.TAURI_ENV_PLATFORM;
      else process.env.TAURI_ENV_PLATFORM = platform;
      const server = await createServer({ configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)), server: { port: 0, strictPort: true, watch: null, hmr: false } });
      try {
        await server.listen();
        const address = server.httpServer.address();
        const response = await fetch(`http://127.0.0.1:${address.port}/`, { signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200);
        const expected = platform === undefined ? BROWSER_CSP : nativePolicy;
        assert.equal(response.headers.get('Content-Security-Policy'), expected);
        assert.equal(policy(await response.text()), expected);
        assert.equal(server.config.preview.headers['Content-Security-Policy'], expected);
      } finally {
        await server.close();
      }
    }
  } finally {
    if (originalPlatform === undefined) delete process.env.TAURI_ENV_PLATFORM;
    else process.env.TAURI_ENV_PLATFORM = originalPlatform;
  }
});

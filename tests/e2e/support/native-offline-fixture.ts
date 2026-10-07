import { createServer, request as httpRequest, type ClientRequest, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const workerTemplate = await readFile(new URL('../../../public/sw.js', import.meta.url), 'utf8');
const libraryModule = stripTypeScriptTypes(await readFile(new URL('../../../src/platform/local-library.ts', import.meta.url), 'utf8'));
const legacyShell = '<!doctype html><html><head><title>Previous Folio shell</title></head><body><div id="legacy-shell">Export copy — previous installed shell</div><script src="/legacy-shell.js"></script></body></html>';

/** A fresh real origin persists the shipped worker across a change in installed assets. */
export async function nativeUpgradeOrigin(upstreamURL: string) {
  const upstream = new URL(upstreamURL);
  let upgraded = false;
  let delayedUpdate = false;
  let gateOpen = false;
  let installationGateRequests = 0;
  const gates = new Set<ServerResponse>();
  const pending = new Set<ClientRequest>();
  const server = createServer((incoming, outgoing) => {
    const requested = new URL(incoming.url || '/', upstream);
    const respond = (contentType: string, body: string) => {
      outgoing.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
      outgoing.end(body);
    };
    if (requested.pathname === '/sw.js') {
      let worker = workerTemplate.replace('__FOLIO_SW_VERSION__', delayedUpdate ? 'legacy-pending' : 'legacy')
        .replace('/*__FOLIO_ASSET_MANIFEST__*/ []', JSON.stringify(['/index.html', '/legacy-shell.js']))
        .replace('/*__FOLIO_OPTIONAL_MANIFEST__*/ []', '[]');
      if (delayedUpdate) worker = worker.replace('const cache = await caches.open(CACHE_NAME);',
        "await fetch('/__installation-gate__');\n    const cache = await caches.open(CACHE_NAME);");
      respond('text/javascript', worker);
      return;
    }
    if (requested.pathname === '/__installation-gate__') {
      installationGateRequests++;
      if (gateOpen) respond('text/plain', 'ready');
      else {
        gates.add(outgoing);
        outgoing.on('close', () => gates.delete(outgoing));
      }
      return;
    }
    if (requested.pathname === '/foreign/sw.js') {
      respond('text/javascript', "self.addEventListener('install', () => self.skipWaiting());");
      return;
    }
    if (requested.pathname === '/__vault-module.mjs') {
      respond('text/javascript', libraryModule);
      return;
    }
    if (requested.pathname === '/legacy-shell.js') {
      respond('text/javascript', 'window.legacyShellLoaded = true;');
      return;
    }
    if (!upgraded && (requested.pathname === '/' || requested.pathname === '/index.html')) {
      respond('text/html', legacyShell);
      return;
    }
    if (requested.pathname === '/api/account') {
      respond('application/json', JSON.stringify({ identity: null, account: null, registered: 0, limit: 200 }));
      return;
    }
    const target = new URL(upstream);
    target.pathname = requested.pathname;
    target.search = requested.search;
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: incoming.method,
      headers: { ...incoming.headers, host: target.host, connection: 'close' },
    }, response => {
      outgoing.writeHead(response.statusCode || 502, response.headers);
      response.pipe(outgoing);
    });
    pending.add(request);
    request.on('close', () => pending.delete(request));
    request.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(request);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The isolated upgrade origin did not start.');
  const releaseInstallation = () => {
    gateOpen = true;
    for (const response of gates) { response.writeHead(200, { 'content-type': 'text/plain' }); response.end('ready'); }
    gates.clear();
  };
  return {
    origin: `http://127.0.0.1:${address.port}`,
    upgrade() { upgraded = true; },
    delayNextInstallation() { delayedUpdate = true; },
    get installationGateRequests() { return installationGateRequests; },
    get installationHeld() { return !gateOpen && gates.size > 0; },
    releaseInstallation,
    async stop() {
      releaseInstallation();
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
      for (const request of pending) request.destroy();
      await closed;
    },
  };
}

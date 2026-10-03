import { test as base, expect, type Page } from '@playwright/test';
import { createServer, request as httpRequest, type ClientRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

interface NetworkOutage {
  baseURL: string;
  mode: 'browser-offline' | 'origin-unavailable';
  shellRedirects: number;
  begin(page: Page): Promise<void>;
}

/** A dedicated origin lets WebKit test real server loss without touching the shared preview. */
async function outageOrigin(upstreamURL: string, canonicalShellRedirect = false) {
  const upstream = new URL(upstreamURL);
  const shell = new URL('index.html', new URL('./', upstream));
  let shellRedirects = 0;
  const pending = new Set<ClientRequest>();
  const server = createServer((incoming, outgoing) => {
    const requested = new URL(incoming.url || '/', upstream);
    // Hosted static sites commonly canonicalize /index.html to /. Use a real
    // HTTP redirect, including for SW precaching, rather than mocking a Response.
    if (canonicalShellRedirect && requested.pathname === shell.pathname) {
      shellRedirects++;
      outgoing.writeHead(308, { location: new URL('./', shell).pathname, 'cache-control': 'no-store' });
      outgoing.end();
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
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The isolated outage origin did not start.');
  return {
    baseURL: `http://127.0.0.1:${address.port}${upstream.pathname}`,
    get shellRedirects() { return shellRedirects; },
    async stop() {
      if (!server.listening) return;
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
      for (const request of pending) request.destroy();
      await closed;
      expect(server.listening).toBe(false);
    },
  };
}

export const test = base.extend<{ networkOutage: NetworkOutage; canonicalShellRedirect: boolean }>({
  canonicalShellRedirect: [false, { option: true }],
  networkOutage: async ({ browserName, baseURL, context, canonicalShellRedirect }, use, testInfo) => {
    if (!baseURL) throw new Error('Offline tests require the production preview baseURL.');
    // Playwright 1.63 WebKit's offline flag fails before service-worker fulfillment:
    // https://github.com/microsoft/playwright/issues/42775
    // Retain Chromium's disconnected-network test. WebKit tests server unavailability;
    // this does not claim to simulate an actual disconnected Safari device.
    const isolated = browserName === 'webkit' || canonicalShellRedirect ? await outageOrigin(baseURL, canonicalShellRedirect) : null;
    const mode = browserName === 'webkit' ? 'origin-unavailable' : 'browser-offline';
    testInfo.annotations.push({ type: 'outage-mode', description: mode });
    try {
      await use({
        baseURL: isolated?.baseURL || baseURL,
        mode,
        get shellRedirects() { return isolated?.shellRedirects || 0; },
        async begin(page) {
          if (mode === 'origin-unavailable') await isolated!.stop();
          else await context.setOffline(true);
          // A unique non-allowlisted request cannot come from the app's SW or HTTP cache.
          // Its failure proves the test did not simply keep using a live origin.
          const networkAvailable = await page.evaluate(async () => {
            try {
              await fetch(`/__folio_outage_probe__?nonce=${crypto.randomUUID()}`, { cache: 'no-store' });
              return true;
            } catch { return false; }
          });
          expect(networkAvailable, `uncached request must fail during ${mode}`).toBe(false);
          await testInfo.attach('outage-mode', {
            body: JSON.stringify({ mode, uncachedRequestFailed: !networkAvailable }), contentType: 'application/json',
          });
        },
      });
    } finally { await isolated?.stop(); }
  },
});

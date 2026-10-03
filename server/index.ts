import { countAccounts, findAccount, getIdentity, MAX_ACCOUNTS, registerAccount, type AccountDatabase } from './accounts.ts';

export interface Env { DB: AccountDatabase; ASSETS: { fetch(request: Request): Promise<Response> } }
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'self' blob:; base-uri 'self'; form-action 'none'";
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname !== '/api/account') return json({ error: 'Not found.' }, 404);
      if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
      try {
        if (!env.DB) throw new Error('Account database unavailable');
        const identity = getIdentity(request);
        if (request.method === 'GET') {
          const account = identity ? await findAccount(env.DB, identity.userId) : null;
          return json({ identity: identity ? { displayName: identity.displayName } : null, account, registered: await countAccounts(env.DB), limit: MAX_ACCOUNTS });
        }
        if (!identity) return json({ error: 'Sign in with ChatGPT before creating an account.' }, 401);
        if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'This request must originate from Folio.' }, 403);
        if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
        const length = Number(request.headers.get('content-length') || '0');
        if (!Number.isFinite(length) || length > 1024) return json({ error: 'Request too large.' }, 413);
        // A bounded reader prevents chunked payloads from uploading documents through this endpoint.
        const reader = request.body?.getReader(); let total = 0;
        if (reader) { while (true) { const item = await reader.read(); if (item.done) break; total += item.value.byteLength; if (total > 1024) { await reader.cancel(); return json({ error: 'Request too large.' }, 413); } } }
        const account = await registerAccount(env.DB, identity.userId);
        if (!account) return json({ error: 'Folio has reached its limit of 200 accounts. Existing accounts can still sign in.', code: 'ACCOUNT_LIMIT' }, 409);
        return json({ identity: { displayName: identity.displayName }, account, registered: await countAccounts(env.DB), limit: MAX_ACCOUNTS });
      } catch {
        // No identity, document content or credentials are logged.
        return json({ error: 'Accounts are temporarily unavailable. Your local PDFs remain on this device.' }, 503);
      }
    }
    if (['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].includes(url.pathname)) return new Response('Sign-in is provided by the hosted platform.', { status: 404 });
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname === '/sw.js') headers.set('Cache-Control', 'no-cache');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

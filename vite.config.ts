import { defineConfig } from 'vite';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'self' blob:; base-uri 'self'; form-action 'none'",
};

export default defineConfig({
  server: { host: '127.0.0.1', headers: securityHeaders },
  preview: { host: '127.0.0.1', headers: securityHeaders },
  build: { target: 'es2022', sourcemap: true },
});

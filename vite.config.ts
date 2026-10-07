import { defineConfig } from 'vite';
import process from 'node:process';
import { frontendCsp, nativeIndexHtml } from './scripts/native-csp.mjs';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const nativePlatform = process.env.TAURI_ENV_PLATFORM;
const headers = { ...securityHeaders, 'Content-Security-Policy': frontendCsp(nativePlatform) };

export default defineConfig({
  plugins: [{ name: 'folio-native-csp', transformIndexHtml: { order: 'pre', handler: html => nativeIndexHtml(html, nativePlatform) } }],
  server: { host: '127.0.0.1', headers, watch: { ignored: ['**/.tmp/**', '**/playwright-report/**', '**/test-results/**'] } },
  preview: { host: '127.0.0.1', headers },
  build: { outDir: 'dist/client', target: 'es2022', sourcemap: true },
});

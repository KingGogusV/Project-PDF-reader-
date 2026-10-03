import { defineConfig, mergeConfig } from 'vite';
import applicationConfig from '../../vite.config.ts';

// The first signing operation loads a worker whose dependencies are absent from
// the HTML entry's initial crawl. Discovering them during page.evaluate caused
// an optimizer full-page reload on a cold CI cache, cancelling the operation.
export default mergeConfig(applicationConfig, defineConfig({
  cacheDir: '.cache/vite-signing-harness',
  optimizeDeps: {
    include: ['@libpdf/core', 'pdf-lib', 'pkijs', 'asn1js'],
    noDiscovery: true,
    // Every harness launch exercises initial prebundling instead of depending
    // on dependency metadata left behind by another development/test server.
    force: true,
  },
  server: {
    hmr: false,
    watch: null,
  },
}));

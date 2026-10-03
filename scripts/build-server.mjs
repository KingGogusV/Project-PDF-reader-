import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
await build({ configFile: false, publicDir: false, build: {
  ssr: 'server/index.ts', outDir: 'dist/server', target: 'es2022', sourcemap: false,
  rollupOptions: { output: { entryFileNames: 'index.js', format: 'es' } },
} });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
const worker = await import('../dist/server/index.js');
if (typeof worker.default?.fetch !== 'function') throw new Error('The hosted Worker must export fetch.');
console.log('Account Worker, hosting manifest and generated migrations prepared.');

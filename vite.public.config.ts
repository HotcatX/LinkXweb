import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// An independent public build. Never include the Tencent site or admin bundle.
export default defineConfig({
  root: resolve(import.meta.dirname, 'public-site'),
  plugins: [react()],
  publicDir: 'public',
  server: { host: '127.0.0.1', port: 5176, open: false },
  build: {
    outDir: resolve(import.meta.dirname, 'dist-public'),
    emptyOutDir: true,
    sourcemap: false,
  },
});

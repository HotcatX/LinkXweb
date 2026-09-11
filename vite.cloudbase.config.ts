import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  publicDir:'public',
  server:{host:'127.0.0.1',port:5174,open:false},
  build:{outDir:'dist-cloudbase',rollupOptions:{input:resolve(import.meta.dirname,'index.html')}}
});

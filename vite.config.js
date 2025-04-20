import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';

export default defineConfig({
  plugins: [
    react(),
    NodeGlobalsPolyfillPlugin({
      process: true,
    }),
  ],
  optimizeDeps: {},
  esbuildOptions: {},
  define: {
    'global': 'globalThis',
  },
  server: {
    env: true, // Forces Vite to load environment variables
  },
});
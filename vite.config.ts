import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    manifest: 'manifest.json',
    rollupOptions: {
      input: {
        app: '/client/app.tsx',
        appInit: '/client/app-init.ts',
        home: '/client/home.ts',
      },
      external: ['@cloudflare/ai'],
    },
  },
  server: {
    allowedHosts: true,
    port: 5988,
  },
});

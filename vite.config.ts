import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@features': path.resolve(__dirname, 'src/features'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@/types': path.resolve(__dirname, 'src/shared/types'),
      '@/schemas': path.resolve(__dirname, 'src/shared/schemas'),
    },
  },
  build: {
    manifest: 'manifest.json',
    rollupOptions: {
      input: {
        app: '/client/app.tsx',
        appInit: '/client/app-init.ts',
        home: '/client/home.ts',
        auth: '/client/auth.tsx',
      },
      external: ['@cloudflare/ai'],
    },
  },
  server: {
    allowedHosts: true,
    port: 5988,
    hmr: {
      port: 5988,
      host: 'localhost',
      protocol: 'ws',
    },
  },
});

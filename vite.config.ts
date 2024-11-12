import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import loadVersion from 'vite-plugin-package-version';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), loadVersion()],
  base: '/wri/',
  build: {
    assetsDir: 'wri/js/ugrc',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'map.html'),
        dev: resolve(__dirname, 'index.html'),
      },
    },
  },
});

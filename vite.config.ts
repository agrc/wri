import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import loadVersion from 'vite-plugin-package-version';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), loadVersion()],
    base: mode === 'production' ? '/wri/' : '',
    resolve: {
      dedupe: ['@arcgis/core'],
    },
    build: {
      assetsDir: mode === 'production' ? 'wri/js/ugrc' : 'js/ugrc',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'map.html'),
          dev: resolve(__dirname, 'index.html'),
          search: resolve(__dirname, 'search.html'),
        },
      },
    },
  };
});

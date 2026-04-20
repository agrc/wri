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
      alias: {
        'firebase-functions/logger': resolve(__dirname, 'src/utils/browser-logger.ts'),
      },
    },
    build: {
      assetsDir: 'js/ugrc',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'map.html'),
          dev: resolve(__dirname, 'index.html'),
          search: resolve(__dirname, 'search.html'),
        },
      },
    },
    test: {
      // Resolve shared package imports to source during tests so Vitest doesn't depend on stale dist output.
      alias: {
        '@ugrc/wri-shared/feature-rules': resolve(__dirname, 'functions/shared/src/featureRules.ts'),
        '@ugrc/wri-shared/types': resolve(__dirname, 'functions/shared/src/types.ts'),
      },
      include: ['**/*.{test,spec}.{ts,tsx}'],
    },
  };
});

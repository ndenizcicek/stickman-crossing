import { defineConfig } from 'vite';

// Relative base so the build works when uploaded as a zip to game portals
// or wrapped in Capacitor for iOS / Android.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2020',
  },
});

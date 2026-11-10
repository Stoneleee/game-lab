import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '../../switchmail',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
});

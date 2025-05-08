import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      fileName: 'worker',
    },
    rollupOptions: {
      external: [],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
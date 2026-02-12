import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'index.ts',
    'server-http': 'src/server-http.ts',
  },
  outDir: 'dist',
  format: 'esm',
  fixedExtension: false,
  clean: true,
});

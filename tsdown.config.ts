import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'index.ts',
    'server-sse': 'src/server-sse.ts',
    'server-shttpt': 'src/server-shttpt.ts',
  },
  outDir: 'dist',
  format: 'esm',
  clean: true,
});

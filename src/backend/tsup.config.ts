import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'server.ts',
    'lib/**/*.ts'
  ],
  outDir: 'dist',
  format: ['esm'],
  target: 'es2020',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: false
}); 
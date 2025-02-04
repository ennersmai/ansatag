import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['scripts/ingest-knowledge.ts'],
  outDir: 'dist/scripts',
  format: ['esm'],
  target: 'node18',
  clean: true,
  sourcemap: true,
  dts: true
}); 
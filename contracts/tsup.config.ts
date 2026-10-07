import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', 'domain/index': 'src/domain/index.ts', 'config/index': 'src/config/index.ts', 'events/index': 'src/events/index.ts', 'notifications/index': 'src/notifications/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

// Library build: keep vue/konva and the konvex core external — the core must be
// a single shared instance (EditableLine relies on `instanceof` against it).
// Component CSS is injected into the JS entry so consumers need no style import.
export default defineConfig({
  plugins: [
    vue(),
    libInjectCss(),
    dts({ tsconfigPath: './tsconfig.json', insertTypesEntry: true }),
  ],
  build: {
    target: 'esnext',
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue', 'konva', /^konva\//, '@balage1551/konvex'],
    },
  },
})

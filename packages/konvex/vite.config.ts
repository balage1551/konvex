import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

// Library build: emit ESM + bundled .d.ts, keeping vue/konva external so the
// consuming app provides a single shared copy of each. Component CSS is injected
// into the JS entry (libInjectCss) so consumers need no separate style import.
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
      external: ['vue', 'konva', /^konva\//],
    },
  },
})

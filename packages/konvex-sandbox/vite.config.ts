import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Resolve the konvex packages straight to their source so edits hot-reload here
// without a rebuild — this sandbox is the dev loop for the libraries.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@balage1551/konvex-editable-line': fileURLToPath(
        new URL('../konvex-editable-line/src/index.ts', import.meta.url),
      ),
      '@balage1551/konvex': fileURLToPath(new URL('../konvex/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5180 },
})

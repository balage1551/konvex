# @balage1551/konvex-sandbox

A standalone Vite playground for developing and exercising the konvex packages.
**Private — not published.**

It hosts the interactive tester (every shape wrapper, the stage component, and
the editable line + toolbar) and resolves `@balage1551/konvex` /
`@balage1551/konvex-editable-line` straight to their **source** (via Vite
aliases), so edits to the libraries hot-reload here with no rebuild.

```bash
npm install            # from the monorepo root
npm run dev -w @balage1551/konvex-sandbox     # http://localhost:5180
npm run build -w @balage1551/konvex-sandbox   # or just: npm run dev (from this dir)
```

Vuetify + MDI provide the control-panel UI; the naboo-specific chrome
(`ComponentHeader`, split panes) is replaced by minimal local stubs in
`src/components/`.

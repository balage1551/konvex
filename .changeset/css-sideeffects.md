---
"@balage1551/konvex": patch
"@balage1551/konvex-editable-line": patch
---

Fix component styles being tree-shaken away in consuming apps. Both packages declared `"sideEffects": false`, which let bundlers drop the injected `import './index.css'` — so the editable-line toolbar (and the core stage-container styles) mounted unstyled. Mark CSS as side-effectful (`"sideEffects": ["**/*.css"]`) and expose the stylesheet via a `./style.css` export.

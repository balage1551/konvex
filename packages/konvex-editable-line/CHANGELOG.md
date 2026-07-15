# @balage1551/konvex-editable-line

## 1.2.0

### Minor Changes

- fd6b117: Add a `persistentSelection` option to `EditableLine` (also a live reactive ref). When `true`, the point selection is kept while the line is deactivated; when `false` (default), deselecting the line clears its point selection.

### Patch Changes

- 5b90248: Fix component styles being tree-shaken away in consuming apps. Both packages declared `"sideEffects": false`, which let bundlers drop the injected `import './index.css'` — so the editable-line toolbar (and the core stage-container styles) mounted unstyled. Mark CSS as side-effectful (`"sideEffects": ["**/*.css"]`) and expose the stylesheet via a `./style.css` export.
- b5a7329: Default `assist.snapThreshold` to `10` world units (previously effectively `Infinity`, which always snapped). Insertion now snaps to the line only when the cursor is within 10 units; beyond that it extends at the cursor. Pass `assist.snapThreshold` to override.

## 1.1.0

### Minor Changes

- c8c35df: Draw the editable line with a plain double-click (no Alt required), and expose the gesture options as live reactive refs on `EditableLine` — `addOnDblClick`, `breakOnDblClick`, and `addOnAltClick`, seeded from config and tweakable at runtime, matching the existing `assistShow` / `handlesShow` pattern.

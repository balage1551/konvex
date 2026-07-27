---
"@balage1551/konvex-editable-line": patch
---

Fix non-left mouse buttons performing edits. Konva fires `click` and `dblclick` for every button, but the stage click (`addOnAltClick`), stage double-click (`addOnDblClick`) and line double-click (`breakOnDblClick`) handlers never checked which one — so a right- or middle-click inserted points. Worst of it was Alt+right-click: `contextmenu` fires independently of `click`, so it inserted a point *and* opened the toolbar.

All three now require the primary button, using the same predicate as the handle-selection guard that already had this check (previously an inline test, now shared). Right-click continues to do only what it should: emit `toolbar-request`.

Touch is unaffected — Konva delivers it as `tap` / `dbltap`, which these handlers do not listen to.

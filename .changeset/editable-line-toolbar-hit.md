---
"@balage1551/konvex-editable-line": minor
---

`toolbar-request` and `EditableLineToolbarContext` carry `hit`: `{ kind: 'point', index }` for a right-clicked handle, even one that is not selectable, or `{ kind: 'line', segment, proportion }` for the line or an arrowhead, from the body projection. Toolbar items' `state()` and `run()` can now depend on what was clicked.

The builtin point items — the six aligns, `straighten` and `delete` — are now hidden when the toolbar is opened from the line body rather than a point, and the toolbar drops a divider left with no item on one side.

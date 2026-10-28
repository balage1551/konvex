---
"@balage1551/konvex-editable-line": minor
---

`toolbar-request` and `EditableLineToolbarContext` carry `hit`: `{ kind: 'point', index }` for a right-clicked handle, even one that is not selectable, or `{ kind: 'line', segment, proportion }` for the line or an arrowhead, from the body projection. Toolbar items' `state()` and `run()` can now depend on what was clicked.

The builtin point items — the six aligns, `straighten` and `delete` — are now hidden when the toolbar is opened from the line body rather than a point, and the toolbar drops a divider left with no item on one side.

**Behaviour change.** Right-clicking the line body no longer offers the point items: the six aligns, `straighten` and `delete` now appear only when a point was right-clicked. They acted on the selection, which a line-body click does not change. A host that wants them there anyway can pass its own items with a `state()` that ignores `hit`. `hit` is a required field on `EditableLineToolbarRequest` and `EditableLineToolbarContext`, so code that *builds* one of these (a test mock, a manual `open(request)`) must now supply it; listeners are unaffected.

---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

Add keyboard support. `KonvexStageContainer` gains `keyboard`, `keyboardScope`, `keyScheme`, `keyBindings`, `selection` and `movementUnit` props and an exposed `moveNodes()`. Shortcuts are hierarchical keys registered statically per module (`registerKeyModule`) with default bindings, overridable per key or by a complete scheme; an empty binding turns a key (or a whole group) off. Bindings may be key sequences (`'Ctrl+K, T'`, with a `chordTimeout` prop). Core keys: `core.stage.zoom.in/out`, `core.selection.move.*`, `core.selection.fineMove.*`. Key modules may set a `priority`; the stage also exposes `contentChanged()`. EditableLine keys: `editableLine.node.move.*` / `.fineMove.*` (move the selected points; with none selected the core keys move the whole line), `editableLine.node.select.all/none` and `editableLine.node.align.vertical.*` / `.horizontal.*`, plus new `selectAll()`, `moveSelection()` and `alignSelection()` methods.

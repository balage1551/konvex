---
"@balage1551/konvex-editable-line": patch
---

Fix an `EditableLine`'s drag state surviving a structural edit made mid-drag.

Editing the points while a handle drag is live — a host calling `removePoint`, a delete shortcut — rebuilds the handles, which destroys the one being dragged. konvex stops a node's scope before Konva's `destroy()` reaches the `stopDrag()` that fires `dragend`, so the handle's own handler was swallowed exactly when it was needed: the drag's bookkeeping never ran. `_dragOrigins` and `_dragAnchorIndex` kept pointing at a finished drag, the axis guide stayed on screen for good, and the `point-moved` for the move that had just happened was never emitted.

The cleanup moved to the group-level `dragend` handler, which survives — Konva fires the event with bubbling, and it still bubbles from a node that is on its way out, since konvex leaves the Konva parent link alone until Konva's own `remove()`. Normal drags behave exactly as before; the difference is only that the last one now finishes properly. Indices are re-checked against the current point count while emitting, since the structural edit may have moved them, rather than reading a `NaN` back out of the geometry.

`_dragging` itself was never the wedge, despite appearances: the same group-level handler already cleared it, so the assist recovered on its own.

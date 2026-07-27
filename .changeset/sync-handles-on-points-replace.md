---
"@balage1551/konvex-editable-line": patch
---

Fix drag handles going stale when `line.points` is replaced with the same number of points. The sync watch observed only the point *count*, so a same-count replacement moved the line while every handle stayed at its old coordinate. Because a handle drag derives its delta from the handle's own position, the next drag then jumped the line by however far the handle was stale. The watch now observes the points themselves and repositions the handles.

Two related index bugs go with it: per-point overrides (`setPointOptions`) were never resized when a replacement changed the point count, and selection indices past the new end survived — a dangling index reached `straightenSelection()` as `undefined` coordinates and wrote `NaN` into the geometry. Overrides are now truncated/padded to the point count and out-of-range selection indices are dropped.

Handle drags are unaffected: they already reposition the handles they move, and the new watch stands down for the duration of a drag.

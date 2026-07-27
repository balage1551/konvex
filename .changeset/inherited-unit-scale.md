---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

`unitScale` is now an inherited node property instead of a value pushed down at add-time.

It moves from `KonvexShape` to `KonvexNode` (so groups and layers have one too) and becomes a computed that reads the nearest ancestor's, mirroring how `effectiveScaleX/Y` already worked. The stage's `scale` prop originates it on the world; nothing propagates.

This fixes shapes added to a nested group keeping `unitScale = 1` — making `scaledLength` / `scaledArea` / `scaledDiameter` return raw pixel values — because the stage's propagation only ever visited the tree at the moment it was notified. A shape now reads the correct scale the instant it is attached, at any depth, in any order, and re-reads it on reparent.

New: writing `node.unitScale.value = 2` pins that node, overriding what it would inherit, and its descendants inherit the pinned value — a subtree in its own units. Assign `undefined` to unpin.

Note for TypeScript consumers: `shape.unitScale` is now `WritableComputedRef<number, number | undefined>` rather than `Ref<number>`. Reads and writes are unchanged; only an explicit `Ref<number>` annotation would need updating.

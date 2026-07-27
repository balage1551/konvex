---
"@balage1551/konvex": patch
---

Fix `destroy()` leaving the destroyed node in its parent's `children`. It stopped the effect scope and destroyed the Konva node, but never told the parent — so the wrapper stayed pinned in `_children` (a leak), `children` went on reporting destroyed nodes as if they were live, and, since nothing bumped `childrenVersion`, subtree watchers never saw the removal: the stage's auto-sized world rect and the measurement-scale propagation both ignored destroyed content.

`KonvexBase.destroy()` now releases itself from its parent first. That applies to containers too, so destroying a layer or group also unregisters it from whatever held it, after its own children have been torn down.

A container teardown still reports as a single change rather than one per child: `KonvexContainer.destroy()` empties its list before cascading, so the children's self-unregistration finds nothing to do — which also keeps the teardown linear instead of splicing the same array once per child.

Internally this arrives as a `_releaseChild` hook on `KonvexBase` (a no-op for leaves, overridden by `KonvexContainer`) rather than an `instanceof` test, because importing the container into `KonvexBase` would close the cycle `KonvexBase → KonvexContainer → KonvexNode → KonvexBase`. `add()` and `remove()` now route through the same hook.

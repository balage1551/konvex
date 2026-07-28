---
"@balage1551/konvex": patch
---

Fix `add(child, index)` leaving `children` out of step with Konva's z-order.

The child was pushed onto the end of konvex's array and *then* moved to `index` in Konva's, so the two disagreed from that point on: `children[i]` was no longer the i-th node on screen, and anything indexing one against the other — a z-order control, a hit test that walks `children`, a host mapping its own list onto the canvas — silently addressed the wrong object. The child is now spliced in at the index Konva ended up using, read back from `zIndex()` rather than taken from the argument, because Konva clamps an out-of-range value. The `child-added` signal already reported the real index, so it now agrees with the array too.

Note that a z-order change made directly on the Konva node (`node.detach().zIndex(2)`, `moveToTop()`) still bypasses konvex's list, as there is no konvex-side z-order API yet to route it through.

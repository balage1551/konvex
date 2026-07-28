---
"@balage1551/konvex": minor
---

Add a z-order API, so reordering no longer has to go behind konvex's back.

`children` is in z-order and `add(child, index)` respects it, but there was no way to *change* the order afterwards except on the Konva node — `node.detach().moveToTop()` — which reorders Konva's children while konvex's list keeps the old order, exactly the desync `add(child, index)` used to have. Every node now has:

- `zIndex` — a reactive `ComputedRef<number>`, 0 at the back. It depends on the *parent's* `childrenVersion`, so it re-reads when a sibling moves too, not only when this node does.
- `setZIndex(i)` — clamps quietly to the valid range (Konva warns on the console and clamps anyway) and returns the index it landed at.
- `moveToTop()`, `moveToBottom()`, `moveUp()`, `moveDown()` — each returns whether anything actually moved, as Konva's do, and a parentless node is a quiet `false` rather than a console warning.

Each mover applies Konva's move and then has the parent re-sort its list *from Konva's order*, rather than replaying the move on both sides — so the two cannot drift apart, and a list already knocked out of step by a raw Konva call is repaired by the next konvex reorder. `childrenVersion` now changes on a reorder as well as on add/remove, which is what makes `zIndex` and anything else watching the subtree follow.

The sandbox grows a z-order row (`⤓ back ↓ ↑ ⤒ front`) with the live index next to it.

---
"@balage1551/konvex": patch
---

Fix `KonvexContainer.add()` corrupting the previous parent's bookkeeping when re-parenting a child.

Konva's own `add()` moves an already-parented node correctly, but konvex never took the child off the old container's `children` array — so after `layerB.add(shape)` the shape was listed by both layers, and each went on acting as its owner:

- `layerA.destroy()` destroyed the moved shape, even though it now belonged to `layerB`;
- `layerA.remove(shape)` detached the Konva node out of `layerB` and cleared the shape's parent, while `layerB` still listed it.

`add()` now releases the child from its previous konvex parent first, so a child is only ever in one container. Both the losing and the gaining container bump their `childrenVersion` (and their ancestors'), so watchers on either subtree see the move.

Two related cases fixed by the same change: re-adding a child to the container it is already in no longer duplicates its `children` entry (it moves to the end, matching Konva), and `remove()` is now genuinely inert for a child the container doesn't hold.

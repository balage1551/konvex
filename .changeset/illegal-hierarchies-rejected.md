---
"@balage1551/konvex": patch
---

Reject illegal hierarchies at compile time: `group.add(layer)` and `layer.add(otherLayer)` no longer type-check.

Both a layer's and a group's child type were bound to `KonvexNode<Konva.Node>` — and since every container *is* a node, that admitted layers into layers and layers into groups. Konva refuses both at runtime (`Layer._validateAdd` and `Group._validateAdd` throw "You may only add groups and shapes"), so the types promised something the library then threw on.

The bound is now `KonvexContent` (`AnyShape | KonvexGroup`), Konva's rule stated in the type system; the stage was already correctly limited to layers. The `as any` on the inner `add` stays — it bridges the generic `T extends Konva.Container`, whose own child type TypeScript cannot narrow from inside the class — but the comment claiming the subclasses make it safe is now true rather than aspirational.

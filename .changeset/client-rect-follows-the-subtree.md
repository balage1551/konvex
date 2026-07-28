---
"@balage1551/konvex": patch
---

Fix `clientRect` on a container not following its children — a group's box kept whatever value it had when the child was added.

`clientRect` invalidated from a hand-written list of *this* node's Konva change events (`xChange`, `scaleXChange`, …). Moving a child changes no attribute on the parent, so a container's box never re-read: a selection outline drawn from `group.clientRect` sat where the group's contents used to be, and only appeared to work because unrelated things (a reselect, a zoom, the group's own drag) happened to invalidate it. Dragging an `EditableLine`'s point handle is the case that shows it: the group's own attributes never change, only its children's.

The list is gone. `clientRect` is now a computed that *reads the node's own attribute refs*, which already invalidate from `<attr>Change` whoever wrote them — so it still follows a drag, a `Konva.Transformer` and a direct Konva write, and it can no longer drift out of step with the attribute list the way a literal list of event names does. On top of that it calls a new `protected trackGeometry()`, where a subclass reads whatever else moves its box:

- `KonvexContainer` reads `childrenVersion` and each child's `clientRect`, which recurses — so a group follows its whole subtree, at any depth.
- `KonvexLine` reads `points`/`tension`/`closed`/`bezier`, since a line's box comes from its geometry rather than `width`/`height`. Editing a polyline in place — exactly what `EditableLine` does — used to leave the box behind even with no children involved.

`visible` is in the dependency set for the *parent's* sake: Konva skips an invisible child when it unions a container's box (`Container.getClientRect`), while a shape's own box ignores its visibility — so hiding a child changes nothing about the child and shrinks the box above it. Without that dependency a transient adornment inflated its ancestor's box permanently: showing `EditableLine`'s assist marker (Alt + move) extended the box, and dismissing it without adding a point never restored it.

Still outstanding, and pre-existing: the other shapes' geometry attributes (`radius`, `radiusX/Y`, `inner/outerRadius`, `sides`, `data`, `text` and the font cluster, `image`, `frameIndex`, the `Tag` pointer, `Arrow`'s heads) do not invalidate `clientRect` either, and a stale child box propagates to its container. Each is a three-line `trackGeometry()` override now that the hook exists; `strokeWidth` belongs in the same sweep, since `getClientRect` includes the stroke.

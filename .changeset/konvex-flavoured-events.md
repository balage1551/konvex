---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": patch
---

Resolve event targets and the pointer without leaving konvex.

Konva events carry Konva nodes, so a handler that wanted the konvex object had to bridge by hand — comparing against `detach()`, or searching its own child array for the node. `event.konvexTarget` and `event.konvexCurrentTarget` now sit beside Konva's `target`/`currentTarget`, which are left exactly as Konva set them. They are getters that resolve through the wrapper registry on access, so they follow `target` as an event bubbles and cost nothing when unread, and they are `undefined` for a node konvex never wrapped or one whose wrapper is destroyed. `KonvexEventObject<E>` is the resulting handler type.

They are also deliberately **non-enumerable**: Konva clones event objects with `{ ...event }` on the enter/leave/over/out paths, and an enumerable getter is *invoked* by the spread — the clone would then carry a value frozen against the wrong target, and `JSON.stringify` on an event would drag a whole reactive wrapper in (it throws on the cycle). Non-enumerable, a clone simply arrives without the fields and gets its own pair. Both failure modes are covered by tests.

Pointer position joins the API for the same reason: `getPointerPosition()` and `getRelativePointerPosition()` were only reachable through `detach()`, and the world-space conversion lived in the stage component where a node handler cannot see it. Every node now has `pointerPosition()` (stage/canvas pixels, returned as a copy so it can't corrupt Konva's live pointer) and `relativePointerPosition()` (the node's own space — zoom, scroll, group transforms and the world origin already applied). Read the relative one on the node whose geometry you are comparing against and there is no transform maths left to do; on the stage container's world layer it is the world coordinate.

`EditableLine` drops its two reach-throughs: `localPointer()` is now `relativePointerPosition()`, and the contextmenu handler matches a handle by wrapper identity instead of comparing `konvaRoot()` against `e.target`. The sandbox's empty-canvas checks read `e.konvexTarget === stage`.

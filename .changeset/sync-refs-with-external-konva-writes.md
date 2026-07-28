---
"@balage1551/konvex": minor
---

Fix attribute refs going stale when the Konva node is written from outside konvex.

The Konva node is konvex's single source of truth, but only `x`/`y` were told when Konva changed on its own (`syncOn: ['dragmove', 'dragend']`). Every other attribute invalidated solely from our own setter, so anything that wrote the node directly — a `Konva.Transformer`, a `Konva.Tween`, `node.konvaRoot().rotation(45)` — left Vue's cached view behind. A plain `.value` read still returned the fresh value (it reads the node), which is what made this easy to miss: what broke was everything *memoised*. A Transformer scaling a group left the group's `scaleX` ref, its descendants' `effectiveScaleX/Y` and their `clientRect` on pre-transform numbers, and left constant-size (`scalable: false`) descendants compensating for a scale that no longer existed — visibly the wrong on-screen size, until some unrelated change happened to invalidate the chain.

Every `nodeAttr`/`numberAttr` now invalidates from Konva's own `<attr>Change` event, which `_setAttr` fires for any write, whoever made it. That subsumes the drag-event sync (a drag sets `x`/`y` through the setters) and the one other place that had asked for it by hand, `KonvexSprite.frameIndex` during playback. `syncOn` remains, now for attributes whose value spans *more* than their own Konva key: the `fill` facet reads a whole cluster, so it names the gradient and pattern attributes too.

The listeners are attached on a ref's first **read** rather than at construction. Only a ref that has been read can have Vue dependents to invalidate, and a node carries a few dozen refs — so an attribute you only ever write (the common case for a bound config value) costs nothing, and `fill`'s 23-event cluster is paid for only by shapes whose fill is actually read.

`clientRect` gains the transform attributes it was missing (`offsetX/Y`, `skewX/Y`) and drops its drag entries, now redundant.

Constant-size nodes defend their own scale: the compensation watch reads `scaleX`/`scaleY` while `scalable` is `false`, so a scale written from outside is re-asserted on the next flush instead of holding until the next ancestor-scale change. It settles in one extra pass, since the corrective write equals the live value and `numberAttr` drops those. A `scalable: true` node doesn't subscribe to its own scale, so this costs it nothing.

Finally, `transformstart` / `transform` / `transformend` join `KonvexEventMap`, with `onTransformStart` / `onTransform` / `onTransformEnd` handlers — previously a `Konva.Transformer`'s events were the one Konva interaction konvex couldn't type. Note they do not bubble (Konva fires them on the node, not up the tree), so they must be bound on the transformed node itself; a container cannot catch them the way `<KonvexStageContainer>` catches drags.

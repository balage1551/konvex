# @balage1551/konvex

## 1.4.0

### Minor Changes

- 87e425a: Add a `'nowhere'` projection scope, and stop an empty scope from being bypassed.

  **The bug.** `KonvexLine.project` returns `undefined` for two unrelated reasons — a line with fewer than two points (nothing to project onto _yet_) and an empty scope (nothing is allowed, ever) — and `EditableLine`'s stage `click` / `dblclick` handlers treated them alike, falling through to `addPoint(p)`. So the one scope that forbids adding was the one scope that appended unconditionally, at the raw cursor, ignoring every part rule. The assist had already got this right and previewed nothing, which made it worse: the point arrived with no indication it could.

  Both handlers now go through one private `addAtProjection`, which checks the scope _before_ the projection. The short-line append survives, because it is the only way a line can be seeded by clicking — it just no longer doubles as an escape hatch from the scope. That also means a line configured `'nowhere'` from the start never gets a first point from a gesture.

  **`'nowhere'`.** A new `LINE_PROJECTION_SCOPES` entry, `[]`, for a line that stays editable — points drag, select, align, straighten, simplify, delete — but takes no _new_ ones. No subset of the parts could express that, and switching `addOnDblClick`/`addOnAltClick` off is not the same thing: those close the two gestures you name, while this works one level below, on `project` itself, so the assist previews nothing and `breakOnDblClick` goes inert on its own. The imperative API (`addPoint`, `insertPoint`, …) is deliberately not gated — the scope governs gestures and projection, not what a host asks for outright.

  **`lineProjectionParts` never returns an accidentally-empty set.** It previously handed back whatever it was given: an unknown name became `undefined` (and `EditableLine` then stored `undefined` in `projectionScope`, so a double-click on the line threw `Cannot read properties of undefined (reading 'includes')`), and `['typo']` became a scope allowing nothing. An empty scope is the _most_ restrictive answer there is, so it now has to be asked for rather than arrived at: only an explicit `[]` or `'nowhere'` resolves to empty, while `undefined`, `null`, a non-array, an unknown name, and an array naming no real part all resolve to `'anywhere'`. Recognised parts are de-duplicated and returned in `start`, `internal`, `end` order, so two spellings of one set now compare equal.

  `EditableLine.projectionScope` became a `customRef` that normalises on write, so the invariant holds for every read instead of being re-checked at each of them, and a re-assignment that changes nothing no longer wakes the assist and handle watchers.

  `'nowhere'` is **not** in the toolbar's scope cycle: it is an authoring choice, and landing on it by one stray click would leave a line whose add gestures silently do nothing. It does get a face of its own (a cancel glyph, "Add points: nowhere") for when a host sets it — the generic fallback was the _permissive_ ray glyph, which would have read as "anywhere" on the one scope that adds nothing — and cycling from it restarts at `anywhere`, so the toolbar can always get back out.

### Patch Changes

- ead8472: Fix `bindTo`/`on`/`bindDom` attaching a permanent listener when called after `destroy()`.

  All three route their cleanup through `scope.run(() => onScopeDispose(off))`, and `EffectScope.run` _silently skips its callback_ once the scope is stopped — it does not throw, and its "cannot run an inactive effect scope" warning is dev-only and never says what leaked. So the listener went on and the removal did not: `bindTo`/`on` left a handler on a node that outlives the wrapper, and nothing short of the caller having kept the returned `off` could take it off again. A second `destroy()` does not help, because `scope.stop()` is a no-op the second time.

  `bindDom` made it worse rather than adding a new hole. A leaked Konva listener at least dies when its target's subtree is destroyed; `window` never goes away, so a post-destroy `bindDom` pinned the handler — and through its closure the whole wrapper, its Konva node and everything it references — for the lifetime of the page.

  Both now **fail closed**: on a stopped scope they bind nothing, warn with the event name that was refused, and return a no-op `off`. Refusing is the honest reading of the contract, which is not "add a listener" but "add a listener that goes away with this object" — if the second half cannot be delivered, the first half is a leak, not a favour. The `off` is still a function so existing call sites need no null check, and the warning is unconditional (not dev-gated) because a production build is exactly where the Vue warning was missing.

  Only the post-destroy path changes. Binding on a live object, `once`, multi-name binds, the returned `off`, and removal on `destroy()` all behave exactly as before.

  Not changed, deliberately: **`destroy()` still does not guard the rest of the API.** Making every method throw on a destroyed object is invasive and hostile to hosts that tear down in an arbitrary order; the listener binders are the narrow case where the silent no-op left something _behind_ instead of merely doing nothing.

## 1.3.0

### Minor Changes

- fa24073: Fix dragging content out of the world, and the handle/value desync it caused.

  `clipped` now keeps dragged objects inside the world, like `bounded` does. Previously only `bounded` constrained drags, so in `clipped` a node's coordinates went wherever the cursor did and the part outside was simply hidden by the clip — leaving the stored position outside the scene with nothing on screen to say so.

  More importantly, the constraint now runs as a `dragBoundFunc` rather than as a correction on `dragmove`. Correcting afterwards cannot work: Konva derives each frame's drag position from the pointer rather than from where the node currently sits, so it re-places the node at the cursor every frame, and any `dragmove` handler on the node itself has already read the unconstrained value. For composite objects that was visible corruption — dragging an `EditableLine` handle past the edge let the line write its point at the cursor and the clamp then pulled only the handle back, so the handle sat on the edge while the stored point was outside the world. Constraining before the position lands fixes the mode and the desync together.

  A node's own `dragBoundFunc` (an axis lock, say) is composed with rather than replaced, and is restored when the drag ends.

  Because the constraint is installed when the stage sees `dragstart`, a child that swallows that event escapes it entirely — which `EditableLine`'s point handles did (`cancelBubble = true`), leaving handle drags unconstrained in both modes. They no longer cancel it. The group-level `dragstart` handler they were shielding sets the same two fields the handle handler already sets, so nothing else changes. `dragmove` and `dragend` were never cancelled, which is why the old post-hoc clamp appeared to work while corrupting the point.

  As a safety net the constraint is also installed on the first `dragmove` if `dragstart` never arrived, so a child cancelling that event costs one frame of accuracy rather than the constraint altogether.

  The clamp rule itself moved into pure `clampRectDelta(rect, bounds)` and `clampDragAbsolute(...)` helpers — the latter carrying the absolute↔world conversion — so both are covered by tests instead of being buried in the component.

- 391ab2f: Complete the Konva event surface, and give handlers a way back to konvex.

  `KonvexEventMap` covered 25 of the 37 events Konva 10 dispatches on a node. Since `on()` is typed by the map, the missing 12 were not merely undocumented — they were a compile error, and the only way to reach them was `detach().on(…)`, which also drops konvex's automatic teardown. Added: the pointer family's `pointerenter`/`pointerleave`/`pointerover`/`pointerout`, its `pointerclick`/`pointerdblclick` (the same gesture `click`/`tap` name in the mouse/touch families), `gotpointercapture`/`lostpointercapture`, and the touch family's `touchenter`/`touchleave`/`touchover`/`touchout`. Every entry still has a matching `onXxx` handler, so the map and the sugar stay 1:1 at 37.

  Three names are deliberately absent, and the map says why in place: `mousecancel`, `touchcancel` and `pointercancel` exist in Konva's own `EVENTS_MAP` but nothing dispatches them — `Stage._pointercancel` re-dispatches a cancelled pointer as a plain `pointerup`, so listening for a cancel name would silently never fire. Konva's `add` is also out: it carries `{ child }` rather than a DOM event, and konvex models the tree through `childrenVersion`.

  `on()` now takes an array of names, so the mouse/touch pairs that mean one gesture bind as a unit — one namespace, one `off`. `once()` joins it (Konva has no equivalent), removing the listener before the handler body runs, and removing _all_ the names on the first delivery of any.

  `bindTo(target, events, handler)` on `KonvexBase` listens on **another** node with _this_ object's lifetime. That gap is what made `EditableLine` hand-roll a `.editablelineN` namespace to watch the stage, keep a `_attachedStage` field to know where to detach from, and leak every listener when `remove()` and `destroy()` happened in one tick — the bug fixed in `425b091`, whose cause was the missing API rather than the mistake. `EditableLine` now uses `bindTo` and keeps a list of `off`s: the stage field is gone, konvex drops the listeners on destroy whatever the order, each listener has its own namespace instead of seven sharing one, and four `e.evt as MouseEvent` casts disappear because the typed path already knows.

  Finally `konvexOf(node)` — a `WeakMap` from Konva node to konvex wrapper, populated in `KonvexNode`'s constructor and dropped on `destroy()`. Konva events carry Konva nodes, so `event.target` was previously bridged by hand (`e.target !== stage.detach()`, or searching one's own child array); now `konvexOf(e.target)` returns the wrapper, or `undefined` for a node konvex never wrapped and for a destroyed one. The sandbox uses it for its empty-canvas checks.

- 528e068: `unitScale` is now an inherited node property instead of a value pushed down at add-time.

  It moves from `KonvexShape` to `KonvexNode` (so groups and layers have one too) and becomes a computed that reads the nearest ancestor's, mirroring how `effectiveScaleX/Y` already worked. The stage's `scale` prop originates it on the world; nothing propagates.

  This fixes shapes added to a nested group keeping `unitScale = 1` — making `scaledLength` / `scaledArea` / `scaledDiameter` return raw pixel values — because the stage's propagation only ever visited the tree at the moment it was notified. A shape now reads the correct scale the instant it is attached, at any depth, in any order, and re-reads it on reparent.

  New: writing `node.unitScale.value = 2` pins that node, overriding what it would inherit, and its descendants inherit the pinned value — a subtree in its own units. Assign `undefined` to unpin.

  Note for TypeScript consumers: `shape.unitScale` is now `WritableComputedRef<number, number | undefined>` rather than `Ref<number>`. Reads and writes are unchanged; only an explicit `Ref<number>` annotation would need updating.

- 784a5d9: Resolve event targets and the pointer without leaving konvex.

  Konva events carry Konva nodes, so a handler that wanted the konvex object had to bridge by hand — comparing against `detach()`, or searching its own child array for the node. `event.konvexTarget` and `event.konvexCurrentTarget` now sit beside Konva's `target`/`currentTarget`, which are left exactly as Konva set them. They are getters that resolve through the wrapper registry on access, so they follow `target` as an event bubbles and cost nothing when unread, and they are `undefined` for a node konvex never wrapped or one whose wrapper is destroyed. `KonvexEventObject<E>` is the resulting handler type.

  They are also deliberately **non-enumerable**: Konva clones event objects with `{ ...event }` on the enter/leave/over/out paths, and an enumerable getter is _invoked_ by the spread — the clone would then carry a value frozen against the wrong target, and `JSON.stringify` on an event would drag a whole reactive wrapper in (it throws on the cycle). Non-enumerable, a clone simply arrives without the fields and gets its own pair. Both failure modes are covered by tests.

  Pointer position joins the API for the same reason: `getPointerPosition()` and `getRelativePointerPosition()` were only reachable through `detach()`, and the world-space conversion lived in the stage component where a node handler cannot see it. Every node now has `pointerPosition()` (stage/canvas pixels, returned as a copy so it can't corrupt Konva's live pointer) and `relativePointerPosition()` (the node's own space — zoom, scroll, group transforms and the world origin already applied). Read the relative one on the node whose geometry you are comparing against and there is no transform maths left to do; on the stage container's world layer it is the world coordinate.

  `EditableLine` drops its two reach-throughs: `localPointer()` is now `relativePointerPosition()`, and the contextmenu handler matches a handle by wrapper identity instead of comparing `konvaRoot()` against `e.target`. The sandbox's empty-canvas checks read `e.konvexTarget === stage`.

- 6d83fea: Add konvex's own signals, DOM binding, and the two stage-container events that were missing.

  konvex had no way to say anything Konva has no event for. Lifecycle was the obvious hole: a host tracking objects could not learn that one had been destroyed, and a container's child list was observable only as `childrenVersion` — a counter that says _something_ changed, not what. `EditableLine` had already grown a private emitter for exactly this kind of signal, so that pattern is now core.

  **`signals`** — a typed `KonvexEmitter` on every konvex object, carrying `destroy` (from `destroy()`, _before_ the scope stops and the Konva node goes, so the object is still readable), and on containers `child-added` / `child-removed`. A subtree teardown emits one `destroy` per node, deepest first, and no `child-removed` for the container's own children: the whole subtree is going away rather than being detached, and the container empties its list before cascading. `child-removed` covers all three ways out — `remove()`, a re-parent into another container, and a child destroying itself — because each of them passes through `_releaseChild`.

  Signals stay separate from `on(...)` rather than being folded into `KonvexEventMap`: the payloads are konvex objects, not DOM events, and there is no node to dispatch on for a fact a wrapper decides by itself. `KonvexEmitter` is exported, so `EditableLine.events` is now that class instead of a second copy of it (and gains `once` for free); `EditableLineEmitter` remains as a deprecated alias.

  **`bindDom(target, type, handler, options?)`** — `bindTo` for a DOM target. Konva delivers no key events and the stage container takes no focus, so anything wanting modifier state has to reach `window`; doing that by hand means pairing every `addEventListener` with a removal in `destroy()`, the same bookkeeping that leaked stage listeners before `bindTo`. `EditableLine`'s Alt-tracking keydown/keyup pair uses it, which retires its `_onKey` field and two of the three manual removals in `destroy()` (the rubber-band mouseup is added per drag, so it stays explicit).

  **`<KonvexStageContainer>`** gains `world-resize` and `pointer`. `world-resize` fires when the world rect actually changes, which only `free`/`elastic` can do — until now the component resized the world in response to content the host had added and never mentioned it. It stays silent until after `ready`, since the first pass is the initial layout rather than a change. `pointer` reports the pointer in **world** units on every move and `null` when it leaves; it is read off the world layer, so zoom, scroll and the world origin are already applied, and it fires over empty canvas too. The sandbox now takes its cursor readout straight from it instead of converting in its own stage handler.

  One cost, stated rather than hidden: the `pointer` listener computes the world position on every pointer move whether or not the host listens, because there is no supported way to ask whether a Vue emit has a subscriber. It is one matrix inversion next to Konva's own per-move hit test.

  Not done, deliberately: **focus-scoped keyboard**. Routing key events through the stage would mean making the container focusable (`tabindex`), which changes tab order and focus rings in every host app — a behaviour change to decide on, not to slip into a patch. `bindDom` is the plumbing that makes it a small change when we do.

- bcc02f7: Projection scope becomes a **set** of parts instead of a fixed enum, so points can be added anywhere.

  `'internal'` correctly refuses to extend either end, which left no way to say "body _or_ ends". A scope is now any subset of `LineProjectionPart` — `'start'`, `'internal'`, `'end'` — and `KonvexLine.project()` evaluates every allowed part and returns the nearest. All seven non-empty subsets are meaningful; the empty set allows nothing and returns `undefined`.

  The old enum values survive as named sets in `LINE_PROJECTION_SCOPES`, and every place that takes a scope still accepts those names, so `'internal'` / `'terminal'` / `'start'` / `'end'` keep working and keep their meaning. `lineProjectionParts(scope)` resolves a name or set to its parts.

  - new `'anywhere'` = `['start','internal','end']`, and it is now the **default** — for `project()` and for `EditableLine`, which previously defaulted to `'internal'`.
  - `LineProjectionScope` changes from a string union to `readonly LineProjectionPart[]`. Code that passes the names is unaffected; only an explicit `const s: LineProjectionScope = 'internal'` annotation needs updating (to `LINE_PROJECTION_SCOPES.internal`).
  - `EditableLine.projectionScope` holds the resolved set. `breakOnDblClick` now requires `'internal'` to be _in_ the set rather than to be the whole scope.
  - the `projection-scope` toolbar item cycles the five named sets, with `mdi-ray-start-vertex-end` for `anywhere`.

  This also lets `EditableLine.resolveInsertion()` go back to reading `proj.segment` directly. It briefly had to switch on the scope instead, because `project()` used to promote body projections to extensions regardless of what was asked for; now that a scope bounds what may come back, the projection can be trusted again.

- 937e848: **Behaviour change:** `KonvexLine.project()` no longer promotes an `'internal'` projection to a terminal extension.

  Previously, if the closest point on the body happened to land exactly on the first or last vertex, the result was rewritten to the out-of-range `segment: -1` / `segment: n` that mean "extend the line". Because each segment projection is clamped, that is true of _any_ query beyond either end — so `'internal'` silently reported an extension for most of the canvas, and callers who asked for a body insert got an append.

  The rewrite was only ever reachable under `'internal'` (the other scopes return before it), so it was wrong every time it ran. The scope alone now fixes which `segment` values can come back: `'internal'` reports `0 … n-1` and nothing else; `-1` / `n` come only from `'start'` / `'end'` / `'terminal'`.

  If you relied on the old behaviour to detect "beyond the end", ask for it explicitly with `'terminal'`.

- 53da946: Fix attribute refs going stale when the Konva node is written from outside konvex.

  The Konva node is konvex's single source of truth, but only `x`/`y` were told when Konva changed on its own (`syncOn: ['dragmove', 'dragend']`). Every other attribute invalidated solely from our own setter, so anything that wrote the node directly — a `Konva.Transformer`, a `Konva.Tween`, `node.konvaRoot().rotation(45)` — left Vue's cached view behind. A plain `.value` read still returned the fresh value (it reads the node), which is what made this easy to miss: what broke was everything _memoised_. A Transformer scaling a group left the group's `scaleX` ref, its descendants' `effectiveScaleX/Y` and their `clientRect` on pre-transform numbers, and left constant-size (`scalable: false`) descendants compensating for a scale that no longer existed — visibly the wrong on-screen size, until some unrelated change happened to invalidate the chain.

  Every `nodeAttr`/`numberAttr` now invalidates from Konva's own `<attr>Change` event, which `_setAttr` fires for any write, whoever made it. That subsumes the drag-event sync (a drag sets `x`/`y` through the setters) and the one other place that had asked for it by hand, `KonvexSprite.frameIndex` during playback. `syncOn` remains, now for attributes whose value spans _more_ than their own Konva key: the `fill` facet reads a whole cluster, so it names the gradient and pattern attributes too.

  The listeners are attached on a ref's first **read** rather than at construction. Only a ref that has been read can have Vue dependents to invalidate, and a node carries a few dozen refs — so an attribute you only ever write (the common case for a bound config value) costs nothing, and `fill`'s 23-event cluster is paid for only by shapes whose fill is actually read.

  `clientRect` gains the transform attributes it was missing (`offsetX/Y`, `skewX/Y`) and drops its drag entries, now redundant.

  Constant-size nodes defend their own scale: the compensation watch reads `scaleX`/`scaleY` while `scalable` is `false`, so a scale written from outside is re-asserted on the next flush instead of holding until the next ancestor-scale change. It settles in one extra pass, since the corrective write equals the live value and `numberAttr` drops those. A `scalable: true` node doesn't subscribe to its own scale, so this costs it nothing.

  Finally, `transformstart` / `transform` / `transformend` join `KonvexEventMap`, with `onTransformStart` / `onTransform` / `onTransformEnd` handlers — previously a `Konva.Transformer`'s events were the one Konva interaction konvex couldn't type. Note they do not bubble (Konva fires them on the node, not up the tree), so they must be bound on the transformed node itself; a container cannot catch them the way `<KonvexStageContainer>` catches drags.

- e9e5495: Add a z-order API, so reordering no longer has to go behind konvex's back.

  `children` is in z-order and `add(child, index)` respects it, but there was no way to _change_ the order afterwards except on the Konva node — `node.detach().moveToTop()` — which reorders Konva's children while konvex's list keeps the old order, exactly the desync `add(child, index)` used to have. Every node now has:

  - `zIndex` — a reactive `ComputedRef<number>`, 0 at the back. It depends on the _parent's_ `childrenVersion`, so it re-reads when a sibling moves too, not only when this node does.
  - `setZIndex(i)` — clamps quietly to the valid range (Konva warns on the console and clamps anyway) and returns the index it landed at.
  - `moveToTop()`, `moveToBottom()`, `moveUp()`, `moveDown()` — each returns whether anything actually moved, as Konva's do, and a parentless node is a quiet `false` rather than a console warning.

  Each mover applies Konva's move and then has the parent re-sort its list _from Konva's order_, rather than replaying the move on both sides — so the two cannot drift apart, and a list already knocked out of step by a raw Konva call is repaired by the next konvex reorder. `childrenVersion` now changes on a reorder as well as on add/remove, which is what makes `zIndex` and anything else watching the subtree follow.

  The sandbox grows a z-order row (`⤓ back ↓ ↑ ⤒ front`) with the live index next to it.

### Patch Changes

- cec8165: Fix `add(child, index)` leaving `children` out of step with Konva's z-order.

  The child was pushed onto the end of konvex's array and _then_ moved to `index` in Konva's, so the two disagreed from that point on: `children[i]` was no longer the i-th node on screen, and anything indexing one against the other — a z-order control, a hit test that walks `children`, a host mapping its own list onto the canvas — silently addressed the wrong object. The child is now spliced in at the index Konva ended up using, read back from `zIndex()` rather than taken from the argument, because Konva clamps an out-of-range value. The `child-added` signal already reported the real index, so it now agrees with the array too.

  Note that a z-order change made directly on the Konva node (`node.detach().zIndex(2)`, `moveToTop()`) still bypasses konvex's list, as there is no konvex-side z-order API yet to route it through.

- 2333bcc: Fix `clientRect` on a container not following its children — a group's box kept whatever value it had when the child was added.

  `clientRect` invalidated from a hand-written list of _this_ node's Konva change events (`xChange`, `scaleXChange`, …). Moving a child changes no attribute on the parent, so a container's box never re-read: a selection outline drawn from `group.clientRect` sat where the group's contents used to be, and only appeared to work because unrelated things (a reselect, a zoom, the group's own drag) happened to invalidate it. Dragging an `EditableLine`'s point handle is the case that shows it: the group's own attributes never change, only its children's.

  The list is gone. `clientRect` is now a computed that _reads the node's own attribute refs_, which already invalidate from `<attr>Change` whoever wrote them — so it still follows a drag, a `Konva.Transformer` and a direct Konva write, and it can no longer drift out of step with the attribute list the way a literal list of event names does. On top of that it calls a new `protected trackGeometry()`, where a subclass reads whatever else moves its box:

  - `KonvexContainer` reads `childrenVersion` and each child's `clientRect`, which recurses — so a group follows its whole subtree, at any depth.
  - `KonvexLine` reads `points`/`tension`/`closed`/`bezier`, since a line's box comes from its geometry rather than `width`/`height`. Editing a polyline in place — exactly what `EditableLine` does — used to leave the box behind even with no children involved.

  `visible` is in the dependency set for the _parent's_ sake: Konva skips an invisible child when it unions a container's box (`Container.getClientRect`), while a shape's own box ignores its visibility — so hiding a child changes nothing about the child and shrinks the box above it. Without that dependency a transient adornment inflated its ancestor's box permanently: showing `EditableLine`'s assist marker (Alt + move) extended the box, and dismissing it without adding a point never restored it.

  Still outstanding, and pre-existing: the other shapes' geometry attributes (`radius`, `radiusX/Y`, `inner/outerRadius`, `sides`, `data`, `text` and the font cluster, `image`, `frameIndex`, the `Tag` pointer, `Arrow`'s heads) do not invalidate `clientRect` either, and a stale child box propagates to its container. Each is a three-line `trackGeometry()` override now that the hook exists; `strokeWidth` belongs in the same sweep, since `getClientRect` includes the stroke.

- f8a253b: Fix `destroy()` leaving the destroyed node in its parent's `children`. It stopped the effect scope and destroyed the Konva node, but never told the parent — so the wrapper stayed pinned in `_children` (a leak), `children` went on reporting destroyed nodes as if they were live, and, since nothing bumped `childrenVersion`, subtree watchers never saw the removal: the stage's auto-sized world rect and the measurement-scale propagation both ignored destroyed content.

  `KonvexBase.destroy()` now releases itself from its parent first. That applies to containers too, so destroying a layer or group also unregisters it from whatever held it, after its own children have been torn down.

  A container teardown still reports as a single change rather than one per child: `KonvexContainer.destroy()` empties its list before cascading, so the children's self-unregistration finds nothing to do — which also keeps the teardown linear instead of splicing the same array once per child.

  Internally this arrives as a `_releaseChild` hook on `KonvexBase` (a no-op for leaves, overridden by `KonvexContainer`) rather than an `instanceof` test, because importing the container into `KonvexBase` would close the cycle `KonvexBase → KonvexContainer → KonvexNode → KonvexBase`. `add()` and `remove()` now route through the same hook.

- 6948edd: Reject illegal hierarchies at compile time: `group.add(layer)` and `layer.add(otherLayer)` no longer type-check.

  Both a layer's and a group's child type were bound to `KonvexNode<Konva.Node>` — and since every container _is_ a node, that admitted layers into layers and layers into groups. Konva refuses both at runtime (`Layer._validateAdd` and `Group._validateAdd` throw "You may only add groups and shapes"), so the types promised something the library then threw on.

  The bound is now `KonvexContent` (`AnyShape | KonvexGroup`), Konva's rule stated in the type system; the stage was already correctly limited to layers. The `as any` on the inner `add` stays — it bridges the generic `T extends Konva.Container`, whose own child type TypeScript cannot narrow from inside the class — but the comment claiming the subclasses make it safe is now true rather than aspirational.

- 6f49bad: Fix `childrenVersion` not reflecting changes in nested containers. It bumped only on the container that was mutated, so a watcher on an ancestor (e.g. the stage watching its world) never fired for a shape added to or removed from a group further down. The stage's world auto-sizing was consequently blind to nested content. Version bumps now bubble up the ancestor chain, so a nested add/remove is visible to watchers on any ancestor. Detached subtrees stay silent until attached.
- d5339d7: Fix `{ mode: 'by' }` writing `NaN`, and make `scalable` a two-way switch.

  **Relative writes needed something to be relative to.** `numberAttr` read the live Konva value as the base, and not every attribute has a default to read: a group's `clipX`/`clipY`/`clipWidth`/`clipHeight` answer `undefined` until first set, so `{ mode: 'by', value: 5 }` computed `undefined + 5` and poisoned the attribute with `NaN`. The base now falls back to the attribute's own default — which also cleans up after a `NaN` that got in some other way. Every attribute with a Konva default behaves exactly as before, including the multiplying ones, which fall back to `1` rather than `0`.

  **`scalable: false → true` left the compensated scale behind.** Turning it off drives the node's scale to the reciprocal of its ancestors'; turning it back on simply stopped doing that, so the node kept wearing whatever reciprocal it happened to be wearing — a one-way door dressed as a toggle. The scale from before compensation started is remembered and restored on the way back, and re-entering compensation later picks up whatever the scale is at _that_ moment. A node that never compensated is untouched.

  Also documented: `detach()` is an alias of `konvaRoot()` that hands back the raw Konva node and does **not** remove it from its parent, despite the name — `parent.remove(node)` does that.

- f191080: Fix `KonvexContainer.add()` corrupting the previous parent's bookkeeping when re-parenting a child.

  Konva's own `add()` moves an already-parented node correctly, but konvex never took the child off the old container's `children` array — so after `layerB.add(shape)` the shape was listed by both layers, and each went on acting as its owner:

  - `layerA.destroy()` destroyed the moved shape, even though it now belonged to `layerB`;
  - `layerA.remove(shape)` detached the Konva node out of `layerB` and cleared the shape's parent, while `layerB` still listed it.

  `add()` now releases the child from its previous konvex parent first, so a child is only ever in one container. Both the losing and the gaining container bump their `childrenVersion` (and their ancestors'), so watchers on either subtree see the move.

  Two related cases fixed by the same change: re-adding a child to the container it is already in no longer duplicates its `children` entry (it moves to the end, matching Konva), and `remove()` is now genuinely inert for a child the container doesn't hold.

- 613fd7f: Fix `simplifyPoints` moving a polyline's endpoints and swallowing out-and-back spikes.

  **Endpoints moved.** The near-collinear pass preserves the first and last point, but the cluster-merge pass that runs after it did not: a cluster reaching either end collapsed to its centroid, so a dense start crept inwards, and a polyline small enough to be a single cluster collapsed to one point in its middle. A cluster that reaches an end now collapses _onto_ that endpoint, and a polyline that is one whole cluster keeps both of them.

  **Spikes vanished.** `angleAtDeg` returned `0` — "flat, drop it" — whenever any two of the three points coincided, and that conflates two opposite cases. If the _middle_ point sits on the vertex it is a duplicate and dropping it is right; if the _far_ point does, the vertex is an out-and-back spike — a degenerate triangle, not a flat one — and dropping it deleted a corner the caller drew on purpose. The two cases are now answered separately, so duplicates still go and spikes stay.

- f9810d9: Three fixes to `<KonvexStageContainer>`'s zoom plumbing.

  **The exposed `zoomLevel` was not reactive.** It read a plain `let`, so a template or computed reading `kx.zoomLevel` never re-evaluated — a host had to listen for the `zoom` event and mirror it into its own state. It is backed by a ref now, which is how every other value konvex exposes works, so reading it is enough.

  **The zoom bounds were not watched.** `minZoom`/`maxZoom` are props, but nothing reacted to them: lowering `maxZoom` below the current level left the view zoomed past its own limit until the next zoom action. Changing either now re-clamps. (`zoomLevels` deliberately gets no watch — it only feeds stepping and snapping, which read it when they run.)

  **A resize emitted zoom events that hadn't happened.** Every `ResizeObserver` tick re-clamps the level, since a bigger viewport lowers the `'fit'` floor, and the commit path emitted `zoom` and `update:zoomLevel` unconditionally — so a plain window resize reported a zoom change at the same value: noise for a host to filter and a `v-model` echo for nothing. Both now fire only when the level actually moves, on the fit path as well as the commit path.

  `v-model` still reconciles, which is a separate question from whether the level moved: a bound value that clamps or snaps to the level already in force is echoed back, because the model would otherwise sit on a number the canvas never adopted — a host setting `100` with `maxZoom: 8` ends up holding `8`. The `zoom` event stays quiet there, since nothing zoomed.

- cb5a45a: Finish `clientRect`: every shape's box now follows the attributes that actually move it.

  `trackGeometry()` arrived with containers and lines; the rest of the shapes still reported a stale box when their geometry changed, because Konva derives their size from attributes the node's transform never sees — a circle's `width` _is_ `radius * 2`, but growing the radius fires `radiusChange`, not `widthChange`. A stale child box propagated into its container, so this also limited the container fix.

  Each shape now reads what Konva's own `getSelfRect` reads, which is where the per-shape choices come from rather than guesswork:

  - **`KonvexShape`** — `strokeColor`, `strokeWidth`, `strokeEnabled`: `getClientRect` grows the box by the stroke when `hasStroke()` is true, so the paint that decides _whether_ there is a stroke is geometry here. Every shape inherits this.
  - **radius families** — `KonvexCircle` (`radius`), `KonvexEllipse` (`radiusX/Y`), `KonvexRing` (`outerRadius` — the hole moves nothing), `KonvexWedge` (`radius`; Konva boxes a wedge by its whole circle, so the angle does not count), `KonvexStar` (`outerRadius`), `KonvexArc` (`inner/outerRadius`, `angle`, `clockwise` — an arc has a real self-rect trimmed to the swept sector, so all four move an edge), `KonvexRegularPolygon` (`radius` _and_ `sides`, since the box is the hull of the generated vertices).
  - **geometry as data** — `KonvexPath` (`data`), `KonvexArrow` (`pointerWidth`, on top of the line's points).
  - **text** — `KonvexText` and `KonvexTextPath` read the text and font cluster directly rather than through `textWidth`/`textHeight`: those are convenient, but `textHeight` calls a Konva method that warns as deprecated, and this code runs on every box read.
  - **`KonvexImage`** — `image`, since with no explicit size Konva falls back to the image's natural dimensions.
  - **`KonvexTag`** — `pointerDirection`, `pointerWidth`, `pointerHeight`, which extend the self-rect on the side the pointer sticks out of.

  Deliberately _not_ dependencies, and asserted as such: `cornerRadius` (rounds corners inside the box) and a sprite's `frameIndex` (Konva boxes a sprite by its `width`/`height` attributes, not the frame). Adding them would invalidate the box for nothing.

- 430e8fa: Fix three things about `<KonvexStageContainer>`'s wheel handling.

  **A page could never scroll past the stage.** `preventDefault()` ran on every wheel event, including the ones the viewport had no room to act on — so once it was scrolled to the end, the wheel went nowhere instead of continuing the page scroll, and a stage in a long document became a dead zone. It is now called only when the scroll position actually moved.

  **`zoomOnWheel: false` swallowed ctrl+wheel.** The zoom branch tested `e.ctrlKey && props.zoomOnWheel`, so with zooming off a ctrl+wheel fell through and was consumed as a scroll — the browser's own zoom gesture did nothing at all. Ctrl+wheel is now left alone unless we take it to zoom.

  **`deltaMode` was never normalised.** Firefox reports wheel deltas in _lines_ (about 3 per notch) where Chrome reports pixels (about 100), so scrolling over the stage crawled at ~3px a notch there. Deltas are converted to pixels first: a line as 16px, a page as the viewport height. The zoom branch is unaffected, since it only reads the sign.

## 1.2.0

### Patch Changes

- 5b90248: Fix component styles being tree-shaken away in consuming apps. Both packages declared `"sideEffects": false`, which let bundlers drop the injected `import './index.css'` — so the editable-line toolbar (and the core stage-container styles) mounted unstyled. Mark CSS as side-effectful (`"sideEffects": ["**/*.css"]`) and expose the stylesheet via a `./style.css` export.

## 1.1.0

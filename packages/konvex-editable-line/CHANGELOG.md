# @balage1551/konvex-editable-line

## 1.4.0

### Patch Changes

- 3c3bf9b: Fix a host `points` write during a handle drag being dropped instead of deferred.

  The watch that answers a wholesale `line.points` replacement bailed out whenever a drag was in progress — right for the line's _own_ per-frame drag writes, since `applyDragDelta` has already moved the handles it touched and repositioning them mid-drag would fight Konva's drag positioning, but wrong for a write from outside. A host writing `line.points` mid-drag (an undo, a collaborative patch, a socket update) got no handle resync and no `points-replaced`, and `dragend` had no catch-up, so neither ever arrived.

  The write itself was never the casualty: it lands in the geometry immediately, and `applyDragDelta` copies the live array, so points the drag is not touching keep the new values. What went missing was the _reaction_ — and the interesting half of that is not the missing event.

  **Stale handles corrupt geometry on the next drag.** `onDragMove` takes its delta as `handle.position - point.origin`, so a handle left behind disagrees with its point before the pointer moves at all. Grabbing that handle snaps its point back to the stale coordinate: measured on the pre-fix code, a line written to `y=9` mid-drag went back to `y=0` on a drag with _zero_ pointer movement, silently undoing the host's write on the canvas while the persister — never told anything had changed — kept the value it never heard about.

  A foreign mid-drag write is now remembered and drained at `dragend`, after that drag's own `point-moved`, so the order a listener sees is the order things settled. A drag containing no foreign write stays silent, and a mid-drag write that changes the point _count_ rebuilds the handles rather than repositioning stale ones.

  Only the deferred path is new. A write outside a drag still syncs and emits immediately, a plain handle drag still reports `point-moved` and nothing else, and the line's own editing methods still emit their precise `point-*` events at the call site.

- 87e425a: Add a `'nowhere'` projection scope, and stop an empty scope from being bypassed.

  **The bug.** `KonvexLine.project` returns `undefined` for two unrelated reasons — a line with fewer than two points (nothing to project onto _yet_) and an empty scope (nothing is allowed, ever) — and `EditableLine`'s stage `click` / `dblclick` handlers treated them alike, falling through to `addPoint(p)`. So the one scope that forbids adding was the one scope that appended unconditionally, at the raw cursor, ignoring every part rule. The assist had already got this right and previewed nothing, which made it worse: the point arrived with no indication it could.

  Both handlers now go through one private `addAtProjection`, which checks the scope _before_ the projection. The short-line append survives, because it is the only way a line can be seeded by clicking — it just no longer doubles as an escape hatch from the scope. That also means a line configured `'nowhere'` from the start never gets a first point from a gesture.

  **`'nowhere'`.** A new `LINE_PROJECTION_SCOPES` entry, `[]`, for a line that stays editable — points drag, select, align, straighten, simplify, delete — but takes no _new_ ones. No subset of the parts could express that, and switching `addOnDblClick`/`addOnAltClick` off is not the same thing: those close the two gestures you name, while this works one level below, on `project` itself, so the assist previews nothing and `breakOnDblClick` goes inert on its own. The imperative API (`addPoint`, `insertPoint`, …) is deliberately not gated — the scope governs gestures and projection, not what a host asks for outright.

  **`lineProjectionParts` never returns an accidentally-empty set.** It previously handed back whatever it was given: an unknown name became `undefined` (and `EditableLine` then stored `undefined` in `projectionScope`, so a double-click on the line threw `Cannot read properties of undefined (reading 'includes')`), and `['typo']` became a scope allowing nothing. An empty scope is the _most_ restrictive answer there is, so it now has to be asked for rather than arrived at: only an explicit `[]` or `'nowhere'` resolves to empty, while `undefined`, `null`, a non-array, an unknown name, and an array naming no real part all resolve to `'anywhere'`. Recognised parts are de-duplicated and returned in `start`, `internal`, `end` order, so two spellings of one set now compare equal.

  `EditableLine.projectionScope` became a `customRef` that normalises on write, so the invariant holds for every read instead of being re-checked at each of them, and a re-assignment that changes nothing no longer wakes the assist and handle watchers.

  `'nowhere'` is **not** in the toolbar's scope cycle: it is an authoring choice, and landing on it by one stray click would leave a line whose add gestures silently do nothing. It does get a face of its own (a cancel glyph, "Add points: nowhere") for when a host sets it — the generic fallback was the _permissive_ ray glyph, which would have read as "anywhere" on the one scope that adds nothing — and cycling from it restarts at `anywhere`, so the toolbar can always get back out.

- 448c9af: Fix `points-replaced` being swallowed when a host write shares a flush with a library edit.

  The self-write marker was a single boolean, and Vue watchers flush once per tick — so the flag was consumed once no matter how many writes shared the flush, and a batch holding both a library edit and a host assignment to `line.points` read as purely self-written. The host's write went unannounced.

  That is not an exotic interleaving. The `point-*` events are emitted synchronously, so a host that normalises geometry from inside a `point-added` listener — snap to grid, clamp to bounds, validate — writes in the library's own flush _every time_. Such a host never received `points-replaced` at all.

  Three consequences, worst last:

  - The write is unreported, so anything rebuilding from events misses it.
  - When the host's write lands _after_ the library's, the per-point event describes a state that no longer exists: `addPoint` then a host write shrinking the array left `point-added` at index 3 on a two-point line, with nothing to correct it. A replaying persister ended up longer than the canvas.
  - It bypassed the mid-drag deferral fix. A host write sharing a flush with a `dragmove` read as own, so the deferral flag was never set, and the handles stayed stale past `dragend` — restoring the geometry corruption that fix had just closed (grabbing a stale handle snaps its point back).

  The marker is now a pair of array identities rather than a boolean: the array `writePoints` last wrote, and the last array the watch settled on. A write is foreign when the current value is neither — and `writePoints` also checks _before_ overwriting, since by the time the watch runs the array it would have compared against is gone. That is what makes a mixed flush report both events. The `points` ref hands back the very array it was given, so identity is a sound test.

  Two limits stated rather than hidden: a per-point event already emitted cannot be retracted if the host's write undoes it (the trailing `points-replaced` is the correction), and a mutation made _in place_ is reported by nothing, since it never triggers the ref — as was already the case.

  Lone writes of either kind, repeated library edits in one flush, multi-frame drags, and `simplify()` are all unchanged.

## 1.3.0

### Minor Changes

- 4a0954f: Emit point events from `EditableLine`: `point-added`, `point-removed`, `point-moved`, `points-replaced`.

  The line's points are what an `EditableLine` manages, and a host had no way to be told about them. It could `watch(el.line.points)` and diff arrays itself, or watch `el.pointInfos`, but the class knew exactly what had happened — which index, from where to where — and threw that away. Konva has no event for a shape's geometry, and the container signals an `EditableLine` inherits describe its internal structure (the line, the assist group, the handle group), not its points, so these are konvex-side events on the existing `el.events` emitter.

  | Event             | Payload                                    | Fired by                                                             |
  | ----------------- | ------------------------------------------ | -------------------------------------------------------------------- |
  | `point-added`     | `{ index, point, count }`                  | `addPoint`, `insertPoint`, the click/double-click add gestures       |
  | `point-removed`   | `{ index, point, count }` — where it _was_ | `removePoint`, `removeSelected` (one per point, highest index first) |
  | `point-moved`     | `{ index, point, from }`                   | a drag (on release), `movePoint`, `straightenSelection`              |
  | `points-replaced` | `{ count }`                                | a write to `line.points`, or `simplify()`                            |

  Each is emitted after the edit has settled, so a handler reading `pointCount`/`pointInfos` sees the result rather than a half-applied state. A move to a point's current position emits nothing.

  `point-moved` is a settled fact rather than a stream: a drag reports on release, once per point it moved, with `from` being where the drag started — so the payload can be persisted or pushed onto an undo stack as it stands, and a drag that ends where it began says nothing. Live geometry during a drag is still `line.points`/`pointInfos`; a streaming `point-moving` counterpart may follow.

  `points-replaced` is deliberately coarse. When the array is swapped wholesale the old and new points cannot be matched up without guessing, so no per-point events are invented for it — index-keyed state should be re-read. `simplify()` reports the same way: which points survive a reshape is not expressible as a sequence of removals.

  To make that distinction reliable rather than best-effort, every write to the geometry now goes through one private `writePoints()`, which marks the write as EL's own. The wholesale-replace watch consumes that marker, so an edit made through EL's API can never also surface as a replacement, and a write a host makes directly can never pass silently.

- 528e068: `unitScale` is now an inherited node property instead of a value pushed down at add-time.

  It moves from `KonvexShape` to `KonvexNode` (so groups and layers have one too) and becomes a computed that reads the nearest ancestor's, mirroring how `effectiveScaleX/Y` already worked. The stage's `scale` prop originates it on the world; nothing propagates.

  This fixes shapes added to a nested group keeping `unitScale = 1` — making `scaledLength` / `scaledArea` / `scaledDiameter` return raw pixel values — because the stage's propagation only ever visited the tree at the moment it was notified. A shape now reads the correct scale the instant it is attached, at any depth, in any order, and re-reads it on reparent.

  New: writing `node.unitScale.value = 2` pins that node, overriding what it would inherit, and its descendants inherit the pinned value — a subtree in its own units. Assign `undefined` to unpin.

  Note for TypeScript consumers: `shape.unitScale` is now `WritableComputedRef<number, number | undefined>` rather than `Ref<number>`. Reads and writes are unchanged; only an explicit `Ref<number>` annotation would need updating.

- bcc02f7: Projection scope becomes a **set** of parts instead of a fixed enum, so points can be added anywhere.

  `'internal'` correctly refuses to extend either end, which left no way to say "body _or_ ends". A scope is now any subset of `LineProjectionPart` — `'start'`, `'internal'`, `'end'` — and `KonvexLine.project()` evaluates every allowed part and returns the nearest. All seven non-empty subsets are meaningful; the empty set allows nothing and returns `undefined`.

  The old enum values survive as named sets in `LINE_PROJECTION_SCOPES`, and every place that takes a scope still accepts those names, so `'internal'` / `'terminal'` / `'start'` / `'end'` keep working and keep their meaning. `lineProjectionParts(scope)` resolves a name or set to its parts.

  - new `'anywhere'` = `['start','internal','end']`, and it is now the **default** — for `project()` and for `EditableLine`, which previously defaulted to `'internal'`.
  - `LineProjectionScope` changes from a string union to `readonly LineProjectionPart[]`. Code that passes the names is unaffected; only an explicit `const s: LineProjectionScope = 'internal'` annotation needs updating (to `LINE_PROJECTION_SCOPES.internal`).
  - `EditableLine.projectionScope` holds the resolved set. `breakOnDblClick` now requires `'internal'` to be _in_ the set rather than to be the whole scope.
  - the `projection-scope` toolbar item cycles the five named sets, with `mdi-ray-start-vertex-end` for `anywhere`.

  This also lets `EditableLine.resolveInsertion()` go back to reading `proj.segment` directly. It briefly had to switch on the scope instead, because `project()` used to promote body projections to extensions regardless of what was asked for; now that a scope bounds what may come back, the projection can be trusted again.

- 937e848: Fix added points ignoring the projection scope, and the assist previewing the wrong thing.

  `projectionScope` is now the single authority over where a point lands, and `resolveInsertion()` — the one decision behind every add gesture _and_ the assist preview — switches on it directly instead of inferring intent from the projection's segment index. `'internal'` always splits a body segment; `'start'`/`'end'`/`'terminal'` always extend. The assist guide is drawn from that same result, so the preview cannot depict something other than what committing will do.

  Three separate faults produced the reported behaviour, all of them "the scope was not actually consulted":

  - the `dblclick` handler reimplemented the insertion logic instead of calling `resolveInsertion()`, and its last branch fell through to a plain append whenever the cursor was beyond `snapThreshold`;
  - `resolveInsertion()` and the assist both re-derived "is this an extension?" from the segment index rather than from the scope;
  - underneath both, `KonvexLine.project()` was rewriting internal projections into terminal ones (fixed in `@balage1551/konvex`), which is what made an internal double-click append and the assist draw a terminal guide under any scope.

  The projection scope and snap threshold are now live refs — `projectionScope` and `snapThreshold` on the instance — alongside `assistShow` and the other runtime knobs. They were previously read straight from the static config object on every use, so there was no way to change them after construction. Both are still seeded from `assist.scope` / `assist.snapThreshold`; changing the scope now also re-renders the assist immediately rather than waiting for the next mouse move.

  Note the names deliberately drop the `assist` prefix: this is one setting that governs where a point actually lands, and the assist is the preview of that same decision — not a separate visual-only option.

  `breakOnDblClick` (double-click _on_ the line to split a segment) is now inert unless the scope is `'internal'`. Breaking is a body operation; under a terminal scope it used to project onto an endpoint and drop a duplicate point there, and a scope that says "ends only" should not permit a mid-line insert by another route.

  New builtin toolbar item `projection-scope` cycles the scope through `internal → terminal → start → end`. Its glyph shows the current scope, so it doubles as the indicator. It is registered in `BUILTIN_TOOLBAR_ITEMS` but deliberately not added to `DEFAULT_TOOLBAR_ITEMS`, so existing bars are unchanged — add `'projection-scope'` to your item list to show it.

  Toolbar items gain `keepOpen?: boolean` (default `false`). Items that set it leave the bar up after `run()` instead of dismissing it, which is what makes an in-place cycle usable.

### Patch Changes

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

- be7463d: Fix an `EditableLine`'s drag state surviving a structural edit made mid-drag.

  Editing the points while a handle drag is live — a host calling `removePoint`, a delete shortcut — rebuilds the handles, which destroys the one being dragged. konvex stops a node's scope before Konva's `destroy()` reaches the `stopDrag()` that fires `dragend`, so the handle's own handler was swallowed exactly when it was needed: the drag's bookkeeping never ran. `_dragOrigins` and `_dragAnchorIndex` kept pointing at a finished drag, the axis guide stayed on screen for good, and the `point-moved` for the move that had just happened was never emitted.

  The cleanup moved to the group-level `dragend` handler, which survives — Konva fires the event with bubbling, and it still bubbles from a node that is on its way out, since konvex leaves the Konva parent link alone until Konva's own `remove()`. Normal drags behave exactly as before; the difference is only that the last one now finishes properly. Indices are re-checked against the current point count while emitting, since the structural edit may have moved them, rather than reading a `NaN` back out of the geometry.

  `_dragging` itself was never the wedge, despite appearances: the same group-level handler already cleared it, so the assist recovered on its own.

- a1aedc0: Make `simplify`, `straighten` and the align tools honour per-point movement rules, and cancel a rubber band when the line goes inactive.

  **`simplify()` could delete a pinned point.** It handed the whole polyline to `simplifyPoints`, which knows nothing about `movable: false` — so a point the caller had declared immovable could be dropped or averaged away by a toolbar button. Each run _between_ pinned points is now simplified on its own, and since a run's endpoints are preserved every pin survives exactly where it was. Pinned points also keep their per-point overrides now; the rest are still cleared, as documented, because indices change.

  **`straightenSelection()` and the six align tools only respected `movable: false`.** A point locked to `'x'` or `'y'` may travel along that axis only — which a _drag_ has always honoured — but straighten projected it in both axes and an align rewrote whichever coordinate it pleased, sliding the point off its rail. Straighten now keeps the locked coordinate, and an align skips points locked to the _other_ axis (and its enabled/disabled state counts the same points, so the button no longer offers an action it will not perform).

  **A rubber band outlived its gesture.** Deactivating the line mid-band left the selection box on screen, the band state armed, and a `mouseup` listener on `window` that fired on the next click anywhere and rewrote the selection of a line the user had already left. Deactivation now cancels the band — dropping it without applying it, which is what an interrupted gesture means.

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

- 6f49bad: Fix `childrenVersion` not reflecting changes in nested containers. It bumped only on the container that was mutated, so a watcher on an ancestor (e.g. the stage watching its world) never fired for a shape added to or removed from a group further down. The stage's world auto-sizing was consequently blind to nested content. Version bumps now bubble up the ancestor chain, so a nested add/remove is visible to watchers on any ancestor. Detached subtrees stay silent until attached.
- 29f716a: Pin the `@balage1551/konvex` peer range to the version being released, and automate it.

  The range had sat at `^1.0.0` since the first release while this package went on using core APIs that 1.0.0 never had. `core@1.0.x` + `editable-line@1.2.x` therefore installed cleanly and failed at runtime on a missing export — npm had no way to know better, because the manifest said 1.0.0 was enough. Since the two packages are versioned in lockstep and only ever built and tested together, the honest minimum is the version being cut, and that is what ships from now on.

  `scripts/sync-workspace-peers.mjs` computes it: `npm run version-packages` runs it right after `changeset version`, so the Version PR carries the correct range, and `npm run release` re-checks it (`--check`) so a stale one fails the run rather than being published.

  It needs a script because neither obvious route works. changesets rewrites a peer range only when the new version _leaves_ it (`onlyUpdatePeerDependentsWhenOutOfRange: true`), and `1.3.0` never leaves `^1.0.0`; turning that flag off makes it treat every minor core bump as breaking for the dependent and force a **major**, which with the `fixed` group would take both packages to `2.0.0` on each core minor. And `workspace:^` — which npm substitutes at publish time for ordinary dependencies — is packed _literally_ inside `peerDependencies` by both npm 9 and npm 11, which would ship a broken manifest.

  Consequence worth stating: upgrading `konvex-editable-line` now requires upgrading `@balage1551/konvex` in the same step. Lockstep versioning already implied that; this makes npm aware of it.

- 3674d95: Fix non-left mouse buttons performing edits. Konva fires `click` and `dblclick` for every button, but the stage click (`addOnAltClick`), stage double-click (`addOnDblClick`) and line double-click (`breakOnDblClick`) handlers never checked which one — so a right- or middle-click inserted points. Worst of it was Alt+right-click: `contextmenu` fires independently of `click`, so it inserted a point _and_ opened the toolbar.

  All three now require the primary button, using the same predicate as the handle-selection guard that already had this check (previously an inline test, now shared). Right-click continues to do only what it should: emit `toolbar-request`.

  Touch is unaffected — Konva delivers it as `tap` / `dbltap`, which these handlers do not listen to.

- 425b091: Fix `EditableLine` leaking its stage listeners when removed and destroyed in the same tick.

  `destroy()` detached them via `this._stage.value?.off(this._ns)`, but `_stage` is a computed over `_parent` — so once the line had been removed from its parent it already evaluated to `null` and the `off()` never ran. The watch that would otherwise have detached them is async, and `destroy()` stops the effect scope before it can fire. So `parent.remove(el); el.destroy()` left all seven namespaced listeners on the stage permanently, and through their closures the whole `EditableLine` with them.

  The line now remembers the stage it actually attached to and detaches from that, rather than re-deriving it at teardown when it is no longer reachable. Detaching is idempotent, so a second `destroy()` is harmless, and re-parenting between stages still clears the old one.

- 7032bcb: Fix drag handles going stale when `line.points` is replaced with the same number of points. The sync watch observed only the point _count_, so a same-count replacement moved the line while every handle stayed at its old coordinate. Because a handle drag derives its delta from the handle's own position, the next drag then jumped the line by however far the handle was stale. The watch now observes the points themselves and repositions the handles.

  Two related index bugs go with it: per-point overrides (`setPointOptions`) were never resized when a replacement changed the point count, and selection indices past the new end survived — a dangling index reached `straightenSelection()` as `undefined` coordinates and wrote `NaN` into the geometry. Overrides are now truncated/padded to the point count and out-of-range selection indices are dropped.

  Handle drags are unaffected: they already reposition the handles they move, and the new watch stands down for the duration of a drag.

## 1.2.0

### Minor Changes

- fd6b117: Add a `persistentSelection` option to `EditableLine` (also a live reactive ref). When `true`, the point selection is kept while the line is deactivated; when `false` (default), deselecting the line clears its point selection.

### Patch Changes

- 5b90248: Fix component styles being tree-shaken away in consuming apps. Both packages declared `"sideEffects": false`, which let bundlers drop the injected `import './index.css'` — so the editable-line toolbar (and the core stage-container styles) mounted unstyled. Mark CSS as side-effectful (`"sideEffects": ["**/*.css"]`) and expose the stylesheet via a `./style.css` export.
- b5a7329: Default `assist.snapThreshold` to `10` world units (previously effectively `Infinity`, which always snapped). Insertion now snaps to the line only when the cursor is within 10 units; beyond that it extends at the cursor. Pass `assist.snapThreshold` to override.

## 1.1.0

### Minor Changes

- c8c35df: Draw the editable line with a plain double-click (no Alt required), and expose the gesture options as live reactive refs on `EditableLine` — `addOnDblClick`, `breakOnDblClick`, and `addOnAltClick`, seeded from config and tweakable at runtime, matching the existing `assistShow` / `handlesShow` pattern.

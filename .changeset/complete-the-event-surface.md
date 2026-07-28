---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": patch
---

Complete the Konva event surface, and give handlers a way back to konvex.

`KonvexEventMap` covered 25 of the 37 events Konva 10 dispatches on a node. Since `on()` is typed by the map, the missing 12 were not merely undocumented — they were a compile error, and the only way to reach them was `detach().on(…)`, which also drops konvex's automatic teardown. Added: the pointer family's `pointerenter`/`pointerleave`/`pointerover`/`pointerout`, its `pointerclick`/`pointerdblclick` (the same gesture `click`/`tap` name in the mouse/touch families), `gotpointercapture`/`lostpointercapture`, and the touch family's `touchenter`/`touchleave`/`touchover`/`touchout`. Every entry still has a matching `onXxx` handler, so the map and the sugar stay 1:1 at 37.

Three names are deliberately absent, and the map says why in place: `mousecancel`, `touchcancel` and `pointercancel` exist in Konva's own `EVENTS_MAP` but nothing dispatches them — `Stage._pointercancel` re-dispatches a cancelled pointer as a plain `pointerup`, so listening for a cancel name would silently never fire. Konva's `add` is also out: it carries `{ child }` rather than a DOM event, and konvex models the tree through `childrenVersion`.

`on()` now takes an array of names, so the mouse/touch pairs that mean one gesture bind as a unit — one namespace, one `off`. `once()` joins it (Konva has no equivalent), removing the listener before the handler body runs, and removing *all* the names on the first delivery of any.

`bindTo(target, events, handler)` on `KonvexBase` listens on **another** node with *this* object's lifetime. That gap is what made `EditableLine` hand-roll a `.editablelineN` namespace to watch the stage, keep a `_attachedStage` field to know where to detach from, and leak every listener when `remove()` and `destroy()` happened in one tick — the bug fixed in `425b091`, whose cause was the missing API rather than the mistake. `EditableLine` now uses `bindTo` and keeps a list of `off`s: the stage field is gone, konvex drops the listeners on destroy whatever the order, each listener has its own namespace instead of seven sharing one, and four `e.evt as MouseEvent` casts disappear because the typed path already knows.

Finally `konvexOf(node)` — a `WeakMap` from Konva node to konvex wrapper, populated in `KonvexNode`'s constructor and dropped on `destroy()`. Konva events carry Konva nodes, so `event.target` was previously bridged by hand (`e.target !== stage.detach()`, or searching one's own child array); now `konvexOf(e.target)` returns the wrapper, or `undefined` for a node konvex never wrapped and for a destroyed one. The sandbox uses it for its empty-canvas checks.

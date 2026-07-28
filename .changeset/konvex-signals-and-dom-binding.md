---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": patch
---

Add konvex's own signals, DOM binding, and the two stage-container events that were missing.

konvex had no way to say anything Konva has no event for. Lifecycle was the obvious hole: a host tracking objects could not learn that one had been destroyed, and a container's child list was observable only as `childrenVersion` — a counter that says *something* changed, not what. `EditableLine` had already grown a private emitter for exactly this kind of signal, so that pattern is now core.

**`signals`** — a typed `KonvexEmitter` on every konvex object, carrying `destroy` (from `destroy()`, *before* the scope stops and the Konva node goes, so the object is still readable), and on containers `child-added` / `child-removed`. A subtree teardown emits one `destroy` per node, deepest first, and no `child-removed` for the container's own children: the whole subtree is going away rather than being detached, and the container empties its list before cascading. `child-removed` covers all three ways out — `remove()`, a re-parent into another container, and a child destroying itself — because each of them passes through `_releaseChild`.

Signals stay separate from `on(...)` rather than being folded into `KonvexEventMap`: the payloads are konvex objects, not DOM events, and there is no node to dispatch on for a fact a wrapper decides by itself. `KonvexEmitter` is exported, so `EditableLine.events` is now that class instead of a second copy of it (and gains `once` for free); `EditableLineEmitter` remains as a deprecated alias.

**`bindDom(target, type, handler, options?)`** — `bindTo` for a DOM target. Konva delivers no key events and the stage container takes no focus, so anything wanting modifier state has to reach `window`; doing that by hand means pairing every `addEventListener` with a removal in `destroy()`, the same bookkeeping that leaked stage listeners before `bindTo`. `EditableLine`'s Alt-tracking keydown/keyup pair uses it, which retires its `_onKey` field and two of the three manual removals in `destroy()` (the rubber-band mouseup is added per drag, so it stays explicit).

**`<KonvexStageContainer>`** gains `world-resize` and `pointer`. `world-resize` fires when the world rect actually changes, which only `free`/`elastic` can do — until now the component resized the world in response to content the host had added and never mentioned it. It stays silent until after `ready`, since the first pass is the initial layout rather than a change. `pointer` reports the pointer in **world** units on every move and `null` when it leaves; it is read off the world layer, so zoom, scroll and the world origin are already applied, and it fires over empty canvas too. The sandbox now takes its cursor readout straight from it instead of converting in its own stage handler.

One cost, stated rather than hidden: the `pointer` listener computes the world position on every pointer move whether or not the host listens, because there is no supported way to ask whether a Vue emit has a subscriber. It is one matrix inversion next to Konva's own per-move hit test.

Not done, deliberately: **focus-scoped keyboard**. Routing key events through the stage would mean making the container focusable (`tabindex`), which changes tab order and focus rings in every host app — a behaviour change to decide on, not to slip into a patch. `bindDom` is the plumbing that makes it a small change when we do.

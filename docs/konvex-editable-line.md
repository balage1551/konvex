# `@balage1551/konvex-editable-line` — reference

An **interactively editable polyline** built on
[`@balage1551/konvex`](./konvex.md). It's a `KonvexGroup` that owns a
`KonvexLine` (the geometry) plus a layer of constant-size drag handles.
Selection and point coordinates are **reactive**, so a host can `watch` them.

- [Quick start](#quick-start)
- [Interactions](#interactions)
- [`EditableLine`](#editableline) — config, reactive state, methods
- [Toolbar framework](#toolbar-framework)
- [Point events](#point-events)
- [Types](#types)

---

## Quick start

```ts
import { EditableLine } from '@balage1551/konvex-editable-line'

const el = new EditableLine({
  x: 100, y: 100,
  points: [ { x: 0, y: 0 }, { x: 70, y: -45 }, { x: 150, y: 25 }, { x: 220, y: -20 } ],
  line: { stroke: { color: '#26c6da', width: 3 } },  // style the wrapped KonvexLine
  movable: 'free',
  selectable: true,
  handles: { show: 'whenSelected', size: 12 },
  assist: { show: 'onAlt', scope: 'internal', snapThreshold: 14 },
  addOnAltClick: true,
})
el.insertInto(world)              // world = KonvexStageContainer's world layer

// Handles show only while "active" (host-selected):
el.active.value = true

// React to edits:
watch(el.selection, sel => console.log('selected points', sel))
watch(el.pointInfos, rows => console.log('geometry changed', rows))
```

Style the line through `el.line` (a full [`KonvexLine`](./konvex.md#konvexlinet)):
`el.line.closed.value = true`, `el.line.tension.value = 0.2`, etc.

---

## Interactions

Built-in gestures (all configurable — see the config table):

| Gesture | Effect |
| --- | --- |
| Drag a handle | Move that point (and any other selected points together). |
| Ctrl + drag | Constrain the drag to one axis; a dashed guide is shown. |
| Per-point `movable: 'x'`/`'y'`/`false` | Axis-lock or pin a point. |
| Drag on empty canvas | **Rubber-band** box select; Ctrl on release extends the selection. |
| Alt-hover | **Assist** preview: where a new point would land, per `projectionScope` (snaps to the line within `snapThreshold`). |
| Alt + click (`addOnAltClick`) | Commit the assist — insert on the line or extend at the cursor. |
| Double-click line / stage (`breakOnDblClick` / `addOnDblClick`) | Insert / add a point. |
| Right-click | Emits a `toolbar-request` event (wire it to a popup toolbar). |

Every editing gesture above is **left-button only**. Konva fires `click` and
`dblclick` for any mouse button, so a right- or middle-click would otherwise edit
the line — and since `contextmenu` fires independently, an Alt+right-click would
both insert a point and open the toolbar. Touch is unaffected: Konva delivers it
as `tap` / `dbltap`.

Handles and assist helpers keep a **constant on-screen size** by default; use
`scalableComponents` to opt parts into zoom-scaling.

---

## `EditableLine`

Extends [`KonvexGroup`](./konvex.md#konvexgroup), so it also has the full
transform/visibility surface and `insertInto(parent)`.

### Config — `EditableLineConfig`

Extends `KonvexGroupConfig`. Fields:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `points` | `Vector2d[]` | `[]` | Initial vertices (local/world space). |
| `line` | `KonvexLineConfig` | — | Pass-through for the wrapped line (paint, `closed`, `tension`). |
| `movable` | `'free' \| 'x' \| 'y' \| false` | `'free'` | Line-wide default point movement. |
| `selectable` | `boolean` | `true` | Line-wide default selectability. |
| `pointOptions` | `(PointOptions \| undefined)[]` | — | Per-index overrides; `undefined` inherits. |
| `handles` | `HandleConfig` | — | `show` (`'always'\|'whenSelected'\|'never'`), `size`, `radius`, `style(state)`. |
| `assist` | `AssistConfig` | — | `show` (`'always'\|'onAlt'\|'never'`), `scope`, `snapThreshold`. `scope`/`snapThreshold` seed the live `projectionScope`/`snapThreshold` refs and govern insertion, not just the preview. `scope: 'nowhere'` makes the line **non-extendable but still editable** — see below. |
| `dragConstraintLine` | `DragConstraintLineConfig` | — | Axis guide styling (`show`, `color`, `width`, `radius`). |
| `rubberBand` | `RubberBandConfig` | — | `enabled` (default `true`), `fill`, `stroke`. |
| `simplification` | `SimplificationThreshold` | `{ angle:5, distance:10 }` | Thresholds for `simplify()`. |
| `startHead` / `endHead` | `ArrowHeadConfig` | — | Arrowhead before the first / after the last point. See [Arrowheads](#arrowheads). |
| `scalableComponents` | `'all' \| 'none' \| ('line'\|'marker'\|'helper'\|'decoration')[]` | `['line', 'decoration']` | Which parts scale with zoom. `'decoration'` is the arrowheads. |
| `breakOnDblClick` | `boolean` | — | Double-click the line inserts a point at the projection. Splitting a segment only makes sense on the body, so this is inert unless `projectionScope` contains `'internal'`. |
| `addOnDblClick` | `boolean` | — | Double-click the stage adds a point, where `projectionScope` says (snapped onto the line if within `snapThreshold`). |
| `addOnAltClick` | `boolean` | — | Alt+click commits the assist (insert / extend). |

### Reactive state

| Member | Type | Description |
| --- | --- | --- |
| `line` | `KonvexLine` | The wrapped geometry — style it directly. Replacing `line.points.value` wholesale is supported: handles, per-point overrides and the selection re-sync to the new points (overrides stay index-aligned; selection indices past the new end are dropped). |
| `selection` | `Ref<readonly number[]>` | Selected point indices. |
| `active` | `Ref<boolean>` | "Host-selected"; gates `handles.show: 'whenSelected'`. |
| `pointInfos` | `ComputedRef<PointInfo[]>` | One row per point (index, x, y, effective options, selected). |
| `handlesShow` | `Ref<HandleShow>` | Live handle visibility mode. |
| `assistShow` | `Ref<AssistShow>` | Live assist visibility mode. |
| `projectionScope` | `Ref<LineProjectionScope>` | Live **set** of the parts a new point may land on — any subset of `'start'` / `'internal'` / `'end'`, defaulting to all three. Holds the resolved set: seed it by name via `assist.scope`, assign a set (or a `LINE_PROJECTION_SCOPES` entry) at runtime. Every add gesture and the assist preview read this one value, so they cannot disagree. **Normalises on write** (see [`lineProjectionParts`](./konvex.md#konvexline)): parts de-duplicated and ordered, an unusable value read as `'anywhere'`, and only an explicit `[]` / `'nowhere'` left empty. |
| `snapThreshold` | `Ref<number>` | Live: distance within which an inserted point snaps onto the line. Seeded from `assist.snapThreshold`. |
| `startHead` / `endHead` | `Ref<ArrowHeadConfig>` | Live arrowhead config. Replace the object or set one field (`endHead.value.show = false`) — both apply. Unconfigured, it holds `{ show: false }`, so setting `show` alone gives the default triangle. |
| `scalableComponents` | `Ref<ScalableComponents>` | Live zoom-scaling set. |
| `defaultMovable` | `Ref<PointMovement>` | Live line-wide movement default. |
| `defaultSelectable` | `Ref<boolean>` | Live line-wide selectability default. |
| `events` | `KonvexEmitter<EditableLineEventMap>` | Discrete events — see [toolbar-request](#toolbar-request-event). (`EditableLineEmitter` is now an alias of the core emitter.) |
| `pointCount` | `number` (getter) | Number of points. |

### Methods

| Method | Description |
| --- | --- |
| `addPoint(p): number` | Append a point; returns its index. |
| `insertPoint(index, p, options?): number` | Insert at `index` with optional per-point options. |
| `removePoint(index)` | Remove one point. |
| `movePoint(index, p)` | Move a point to `p`. |
| `select(index, { extend? })` | Select a point (or toggle-extend with `extend: true`). |
| `clearSelection()` | Deselect all. |
| `removeSelected()` | Remove every selected point. |
| `straightenSelection()` | Project the intermediate **selected** points onto the line through the first/last selected. `movable: false` points stay; an `'x'`/`'y'` point moves only along its own axis. No-op for < 3 selected. |
| `simplify(threshold?)` | Simplify the whole polyline in place. Endpoints and `movable: false` points keep their exact positions (each run between pins is simplified on its own) and pinned points keep their overrides; the selection and every other override are cleared, since indices change. No-op for < 3 points. |
| `setPointOptions(index, options)` | Set/override per-point `movable`/`selectable`. |
| `destroy()` | Tear down (also removes window/key listeners). |

### Arrowheads

Either end can carry a head. It points out of the line, along its terminal
segment:

```ts
const el = new EditableLine({
  points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
  line: { stroke: { color: '#26c6da', width: 3 } },
  endHead: { shape: 'triangle', size: 14, ratio: 1.5, offset: 12 },
})
el.startHead.value = { shape: 'open' }  // add one at the start too
```

`ArrowHeadConfig`:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `show` | `boolean` | `true` | Drawn or not. The toolbar's arrow items flip only this, so the rest survives a hide. |
| `shape` | `'triangle' \| 'open' \| 'diamond' \| 'circle' \| ArrowHeadFactory` | `'triangle'` | `open` is two strokes meeting at the tip (`—>`): no base and no fill, so it is not an unfilled triangle. `circle` becomes an ellipse at a ratio other than 1. |
| `size` | `number` | `10` | Extent along the line. World units while `'decoration'` scales, screen pixels when it does not. |
| `ratio` | `number` | `1` | Length ÷ width. `2` makes a head twice as long as it is wide. Applies to every shape. |
| `offset` | `number` | `0` | Gap from the end point to the tip, along the line, in world units — the radius of a circular object sitting on the end point. |
| `atEveryPoint` | `boolean` | `false` | Repeat the head at every internal point too — see below. |
| `trim` | `'base' \| 'tip' \| 'none'` | `'base'` (`'tip'` for `open`) | Where the drawn line stops: at the back of the head, at its tip, or not at all. `offset` is always part of the cut except for `'none'`. |
| `fill` | `FillInput` | line's stroke colour | Filled shapes only by default; `open` has none. |
| `stroke` | `Stroke` | none / line's stroke | Merged field by field over the line's colour, width, cap and join, undashed. The filled shapes draw no stroke unless you give one, so a thick line does not fatten them. |

The paint follows the line: change `line.strokeColor` and a default-filled head
follows. Heads are part of the line for interaction — a right-click on one asks
for the toolbar and Alt+click commits as it would on the line, and a host's
click handler on the `EditableLine` sees clicks on them too.

**Offsets are measured along the line**, so one longer than the terminal segment
carries on around the corner. The shortening is **render-only**
([`KonvexLine.trimStart` / `trimEnd`](./konvex.md#konvexline)): `points`,
projection and the handles keep the real vertices.

**When heads are not drawn.** On a closed line (no ends) and on a curved one
(`tension` or `bezier` — the heads are placed on straight segments). And when the
two would not both fit — their cuts meet or cross — neither is drawn, while the
line still stops at the offsets, so it keeps meeting the objects on its ends.

**Heads at every point.** With `atEveryPoint`, each internal point repeats the
head on its own segment: an `endHead` on the segment *arriving* at the point,
pointing forward, and a `startHead` on the segment *leaving* it, pointing back —
set both for double-headed segments. Each is held `offset` clear of its point,
measured along that segment only, and one whose segment is shorter than `offset`
is skipped. The line runs through these heads: `trim` applies to the terminal head
only. The fit rule above concerns the terminal heads alone, so internal ones stay
when the end ones are dropped.

```ts
endHead: { shape: 'triangle', offset: 12, atEveryPoint: true }  // → → → along every segment
```

**Custom heads.** A factory returns any konvex shape or group, drawn in a frame
whose origin is the tip and whose +x axis points the way the head points, so the
head lies along −x from `0` to `−size`:

```ts
endHead: {
  size: 12, ratio: 2,
  shape: ({ size, width }) =>
    new KonvexRect({ x: -size, y: -width / 2, width: size, height: width, fill: 'orange' }),
}
```

EL places and rotates the frame; the factory's node is never restyled. It is called
once per head — the context's `index` names the point the head belongs to, as of
when it was built — and again only when `shape`, `size` or `ratio` change. Moving
points or changing `offset` reuses the node; a point added or removed builds or
drops just its own head.

---

## Toolbar framework

A data-driven toolbar. Provide a list of **item specs** — builtin ids, divider
tokens, or inline item objects — and render them with the `EditableLineToolbar`
component (or drive your own UI from the same registry).

It is konvex's generic [`<KonvexContextToolbar>`](konvex.md#konvexcontexttoolbar-component)
specialised to a line: `EditableLineToolbarItem` is
`KonvexContextToolbarItem<EditableLineToolbarContext>`, and the component opens
on the line's `toolbar-request`. The same item shape therefore works for the
right-click menus of other nodes.

### `<EditableLineToolbar>` component

| Prop | Type | Notes |
| --- | --- | --- |
| `line` | `EditableLine` | Required — the line the tools act on. |
| `items` | `ToolbarItemSpec[]` | Ordered items; defaults to `DEFAULT_TOOLBAR_ITEMS`. |
| `label` | `string` | Optional heading (e.g. a selection count). |

```vue
<script setup lang="ts">
import { EditableLineToolbar, type ToolbarItemSpec } from '@balage1551/konvex-editable-line'

const items: ToolbarItemSpec[] = [
  'align-h-start', 'align-h-center', 'align-h-end',
  'align-v-start', 'align-v-center', 'align-v-end',
  '|', 'straighten', 'simplify', 'toggle-closed',
  {
    id: 'log-coords',
    label: 'Log selected coords',
    render: { icon: 'mdi-map-marker' },
    state: ctx => (ctx.selection.length ? 'enabled' : 'disabled'),
    run: ctx => console.log(ctx.points),
  },
  '|', 'delete',
]
</script>

<template>
  <EditableLineToolbar :line="el" :items="items" :label="`Selected: ${el.selection.value.length}`" />
</template>
```

### Builtin item ids

`align-h-start`, `align-h-center`, `align-h-end`,
`align-v-start`, `align-v-center`, `align-v-end`,
`straighten`, `simplify`, `toggle-closed`, `projection-scope`, `arrow-start`,
`arrow-end`, `delete`.

The point items — the six aligns, `straighten` and `delete` — are hidden when the
bar is opened by right-clicking the line body (`hit.kind === 'line'`), so the bar
there offers only what acts on the line as a whole. Opened from a point, it offers
everything. A divider left with no item on one side is dropped as well. A custom
item does the same by checking `ctx.hit` in its `state()`.

`arrow-start` / `arrow-end` show or hide that end's [arrowhead](#arrowheads). Only
`show` flips, so a head comes back as it was; on a line with none configured they
add the default triangle. They are disabled on a closed or curved line, where heads
are never drawn.

`projection-scope` cycles `line.projectionScope` through the named sets —
`anywhere → internal → terminal → start → end` — i.e. where a newly added point
may land. Its glyph shows the current set, so it doubles as the indicator, and it
keeps the bar open so you can step round to the one you want. A hand-rolled subset
(`internal` + one end) has no glyph of its own: it shows the permissive one and
names the parts in the tooltip, and cycling from it restarts at `anywhere`.

`'nowhere'` is deliberately **not** a step in that cycle: it is an authoring choice,
and landing on it by one stray click would leave a line whose add gestures silently
do nothing. It still renders with a face of its own (a cancel glyph, "Add points:
nowhere") when a host sets it, and cycling from it restarts at `anywhere` — so the
toolbar can always get back out.

### Non-extendable but editable lines

`assist: { scope: 'nowhere' }` (or `line.projectionScope.value = []` at runtime)
fixes a line's point *count* while leaving everything else editable: points still
drag, select, align, straighten, simplify and delete. It works one level below the
gesture flags — `project` itself refuses — so the assist has nothing to preview,
`breakOnDblClick` is inert (splitting needs `'internal'`), and Alt+click and
stage-double-click add nothing. Switching `addOnDblClick`/`addOnAltClick` off
instead only closes the two gestures you named, and leaves the assist previewing
insertions that can no longer happen.

The imperative API is **not** gated by it: `addPoint`, `insertPoint`, `movePoint`
and friends do what they are told. The scope governs pointer gestures and
projection, not what the host asks for directly.

Divider tokens: `'|'` or `'separator'`. `DEFAULT_TOOLBAR_ITEMS` is the six
aligns + `straighten`/`simplify` + `delete`. `BUILTIN_TOOLBAR_ITEMS` is the
`id → item` registry; `resolveToolbarItems(specs)` turns a spec list into
concrete items/separators (unknown ids are warned and skipped).

### Custom items — `EditableLineToolbarItem`

```ts
interface EditableLineToolbarItem {
  id: string
  label?: string
  render: ToolbarItemRender       // 'mdi-…' | {icon,class?} | {component,props?} | (ctx)=>VNodeChild
  state?: (ctx) => 'hidden' | 'disabled' | 'enabled'   // default 'enabled'
  run?:   (ctx) => void                                // called only when 'enabled'
  keepOpen?: boolean              // default false — leave the bar up after run()
}
```

`keepOpen` suits mode toggles and cycles, where the point is to see the new state
and possibly click again; everything else dismisses the bar on activation.

`ctx` (`EditableLineToolbarContext`) gives `line`, `selection`, `points`
(resolved `PointInfo[]`), `pointerWorld`, `pointerScreen`, and `hit` — what was
right-clicked (see below), so an item's `state()` can depend on it:

```ts
const deletePoint: EditableLineToolbarItem = {
  id: 'delete-this-point',
  render: 'mdi-delete',
  state: ({ hit, line }) => (hit?.kind === 'point' && hit.index > 0 && hit.index < line.pointCount - 1 ? 'enabled' : 'hidden'),
  run: ({ hit, line }) => hit?.kind === 'point' && line.removePoint(hit.index),
}
```

### `toolbar-request` event

Right-clicking the line emits `toolbar-request` with where and what was clicked —
wire it to show a context toolbar at the pointer:

```ts
el.events.on('toolbar-request', ({ pointerScreen, pointerWorld, selection, hit }) => {
  // position and open your toolbar popup at pointerScreen
})
```

`hit` says what the click landed on:

- `{ kind: 'point', index }` — a point's handle. This names the point even when it
  is not selectable, and so not in `selection`.
- `{ kind: 'line', segment, proportion }` — the line or one of its arrowheads,
  placed by projecting the pointer onto the line's body: between points `segment`
  and `segment + 1`, `proportion` of the way along. This ignores
  `projectionScope`, which limits where points may be added, not what was clicked.
- `null` — a line hit whose pointer position could not be read.

---

## Point events

The line's points are what an `EditableLine` manages, so their comings and goings
are events on the same `el.events` emitter — a `KonvexEmitter`, so `on` returns an
`off` and `once` works too. Every payload is in the line's own coordinates, and
every one is emitted *after* the edit has settled: a handler can read
`pointCount` / `pointInfos` and see the result.

| Event | Payload | Fired by |
| --- | --- | --- |
| `point-added` | `{ index, point, count }` | `addPoint`, `insertPoint`, and the click/double-click add gestures |
| `point-removed` | `{ index, point, count }` — `point` is where it *was* | `removePoint`, `removeSelected` (one per point, highest index first) |
| `point-moved` | `{ index, point, from }` | a drag (**on release**), `movePoint`, `straightenSelection` |
| `point-drag-start` | `{ index, indices, from }` — `index` is the anchor, `indices` every point moving with it | a handle drag starting |
| `point-moving` | `{ index, point, from }` — the anchor, axis constraints applied | a handle drag, **every frame** |
| `point-drag-end` | `{ index, point, from, cancelled }` | a handle drag ending, **before** its `point-moved` |
| `points-replaced` | `{ count }` | a write to `line.points`, or `simplify()` — **deferred to the drag end** if it arrives mid-drag |

```ts
el.events.on('point-moved', ({ index, point }) => store.commit(index, point))
el.events.on('points-replaced', () => store.reload(el.pointInfos.value))
```

Three things worth knowing:

- **A drag reports once, when it lands.** `point-moved` is a settled fact, not a
  stream: no event per frame, and `from` is where the drag *started*, so the
  payload is safe to persist or push onto an undo stack as-is. A multi-point drag
  emits one event per point it moved, and a drag that ends where it began emits
  nothing.
- **The drag itself streams separately.** `point-drag-start`, then a
  `point-moving` per frame for the anchor (the point under the pointer), then
  `point-drag-end`, then the drag's `point-moved`s. They fire for handle drags
  only — not for `movePoint` or a drag of the whole line — so a host can tell a
  drag from other writes, e.g. to highlight a drop target under the anchor and
  decide on release. `cancelled` is `true` when the drag was cut short instead of
  released: a point added or removed mid-drag destroys the dragged handle. Its
  `index` is then the anchor's index at drag start, and `point` the last one
  `point-moving` reported.
- **`points-replaced` is deliberately coarse.** When the array is swapped
  wholesale, the old and new points cannot be matched up without guessing, so
  konvex does not invent per-point events for it: treat any index-keyed state you
  hold as invalid and re-read. `simplify()` reports this way too — which points
  survived a reshape is not a sequence of removals.
- **A host write is reported even when it shares a tick with a library edit.**
  Vue watchers flush once per tick, so a host assigning `line.points` from inside a
  `point-added` listener (snapping to a grid, clamping, validating) writes in the
  same flush as the edit that triggered it. Both are reported: the precise
  `point-*` event, then `points-replaced`. One caveat that cannot be fixed from
  here — if the host's write *undoes* the library's edit, the per-point event has
  already been emitted synchronously and cannot be retracted, so treat the trailing
  `points-replaced` as the correction and re-read. An in-place mutation of the
  array (`points.value.push(…)`) is reported by nothing at all, since it never
  triggers the ref.
- **A write that arrives mid-drag is deferred, not dropped.** A host writing
  `line.points` while a handle is being dragged (an undo, a collaborative patch)
  lands in the geometry immediately, but its handle resync and its
  `points-replaced` wait for the drag to end — repositioning handles mid-drag would
  fight Konva's own drag positioning. The event then arrives *after* that drag's
  `point-moved`, so the order a listener sees is the order things settled. Nothing
  is coalesced: the line's own per-frame drag writes never emit this event, so a
  drag with no foreign write in it stays silent.
- **These are not the container signals.** An `EditableLine` is a `KonvexGroup`,
  so it also has core `signals` with `child-added`/`child-removed` — those
  describe its *internal* structure (the line, the assist group, the handle
  group), not its points.

---

## Types

- `PointMovement` = `'free' | 'x' | 'y' | false`
- `PointOptions` = `{ movable?: PointMovement; selectable?: boolean }`
- `PointInfo` = `{ index, x, y, selectable, movable, selected }`
- `HandleState` / `HandleStyle` — passed to / returned from a custom `handles.style(state)`.
  `defaultHandleStyle(state)` is the default styler (exported).
- `HandleShow` = `'always' | 'whenSelected' | 'never'`; `AssistShow` = `'always' | 'onAlt' | 'never'`.
- `ScalableComponent` = `'line' | 'marker' | 'helper' | 'decoration'`; `ScalableComponents` = `'all' | 'none' | ScalableComponent[]`.
- `ArrowHeadConfig`, `ArrowHeadBuiltin` = `'triangle' | 'open' | 'diamond' | 'circle'`,
  `ArrowHeadTrim` = `'base' | 'tip' | 'none'`, `ArrowHeadFactory` =
  `(ctx: ArrowHeadContext) => KonvexContent`, `ArrowHeadContext` = `{ end, index, line, size, width }` —
  see [Arrowheads](#arrowheads).
- `EditableLinePointChange` = `{ index, point, count }`; `EditableLinePointMove` =
  `{ index, point, from }`; `EditableLinePointsReplaced` = `{ count }` —
  see [point events](#point-events).
- `ToolbarItemState` = `'hidden' | 'disabled' | 'enabled'`.
- `ToolbarItemSpec` = `EditableLineToolbarItem | string`.
- `SimplificationThreshold`, `Vector2d`, `LineProjectionPart` / `LineProjectionScope` /
  `LINE_PROJECTION_SCOPES` are re-exported from the core.

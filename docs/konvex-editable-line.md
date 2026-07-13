# `@balage1551/konvex-editable-line` — reference

An **interactively editable polyline** built on
[`@balage1551/konvex`](./konvex.md). It's a `KonvexGroup` that owns a
`KonvexLine` (the geometry) plus a layer of constant-size drag handles.
Selection and point coordinates are **reactive**, so a host can `watch` them.

- [Quick start](#quick-start)
- [Interactions](#interactions)
- [`EditableLine`](#editableline) — config, reactive state, methods
- [Toolbar framework](#toolbar-framework)
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
| Alt-hover | **Assist** preview: where a new point would land (snaps to the line within `snapThreshold`). |
| Alt + click (`addOnAltClick`) | Commit the assist — insert on the line or extend at the cursor. |
| Double-click line / stage (`breakOnDblClick` / `addOnDblClick`) | Insert / add a point. |
| Right-click | Emits a `toolbar-request` event (wire it to a popup toolbar). |

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
| `assist` | `AssistConfig` | — | `show` (`'always'\|'onAlt'\|'never'`), `scope`, `snapThreshold`. |
| `dragConstraintLine` | `DragConstraintLineConfig` | — | Axis guide styling (`show`, `color`, `width`, `radius`). |
| `rubberBand` | `RubberBandConfig` | — | `enabled` (default `true`), `fill`, `stroke`. |
| `simplification` | `SimplificationThreshold` | `{ angle:5, distance:10 }` | Thresholds for `simplify()`. |
| `scalableComponents` | `'all' \| 'none' \| ('line'\|'marker'\|'helper')[]` | `['line']` | Which parts scale with zoom. |
| `breakOnDblClick` | `boolean` | — | Double-click the line inserts a point at the projection. |
| `addOnDblClick` | `boolean` | — | Double-click the stage adds a point (snapped if close). |
| `addOnAltClick` | `boolean` | — | Alt+click commits the assist (insert / extend). |

### Reactive state

| Member | Type | Description |
| --- | --- | --- |
| `line` | `KonvexLine` | The wrapped geometry — style it directly. |
| `selection` | `Ref<readonly number[]>` | Selected point indices. |
| `active` | `Ref<boolean>` | "Host-selected"; gates `handles.show: 'whenSelected'`. |
| `pointInfos` | `ComputedRef<PointInfo[]>` | One row per point (index, x, y, effective options, selected). |
| `handlesShow` | `Ref<HandleShow>` | Live handle visibility mode. |
| `assistShow` | `Ref<AssistShow>` | Live assist visibility mode. |
| `scalableComponents` | `Ref<ScalableComponents>` | Live zoom-scaling set. |
| `defaultMovable` | `Ref<PointMovement>` | Live line-wide movement default. |
| `defaultSelectable` | `Ref<boolean>` | Live line-wide selectability default. |
| `events` | `EditableLineEmitter` | Discrete events — see [toolbar-request](#toolbar-request-event). |
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
| `straightenSelection()` | Project the intermediate **selected** points onto the line through the first/last selected; pinned points stay. No-op for < 3 selected. |
| `simplify(threshold?)` | Simplify the whole polyline in place (clears selection & overrides — indices change). No-op for < 3 points. |
| `setPointOptions(index, options)` | Set/override per-point `movable`/`selectable`. |
| `destroy()` | Tear down (also removes window/key listeners). |

---

## Toolbar framework

A data-driven toolbar. Provide a list of **item specs** — builtin ids, divider
tokens, or inline item objects — and render them with the `EditableLineToolbar`
component (or drive your own UI from the same registry).

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
`straighten`, `simplify`, `toggle-closed`, `delete`.

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
}
```

`ctx` (`EditableLineToolbarContext`) gives `line`, `selection`, `points`
(resolved `PointInfo[]`), `pointerWorld`, `pointerScreen`.

### `toolbar-request` event

Right-clicking the line emits `toolbar-request` with where and what was clicked —
wire it to show a context toolbar at the pointer:

```ts
el.events.on('toolbar-request', ({ pointerScreen, pointerWorld, selection }) => {
  // position and open your toolbar popup at pointerScreen
})
```

---

## Types

- `PointMovement` = `'free' | 'x' | 'y' | false`
- `PointOptions` = `{ movable?: PointMovement; selectable?: boolean }`
- `PointInfo` = `{ index, x, y, selectable, movable, selected }`
- `HandleState` / `HandleStyle` — passed to / returned from a custom `handles.style(state)`.
  `defaultHandleStyle(state)` is the default styler (exported).
- `HandleShow` = `'always' | 'whenSelected' | 'never'`; `AssistShow` = `'always' | 'onAlt' | 'never'`.
- `ScalableComponent` = `'line' | 'marker' | 'helper'`; `ScalableComponents` = `'all' | 'none' | ScalableComponent[]`.
- `ToolbarItemState` = `'hidden' | 'disabled' | 'enabled'`.
- `ToolbarItemSpec` = `EditableLineToolbarItem | string`.
- `SimplificationThreshold`, `Vector2d`, `LineProjectionScope` are re-exported from the core.

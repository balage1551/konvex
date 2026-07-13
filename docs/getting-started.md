# Getting started

Konvex is a **reactive [Vue 3](https://vuejs.org/) wrapper around [Konva](https://konvajs.org/)**.
Instead of imperatively calling `node.width(120)` and `layer.draw()`, you work
with wrapper objects whose attributes are **Vue refs**: assign them values, refs,
or getters and the canvas follows.

- **[`@balage1551/konvex`](./konvex.md)** — the core: shape wrappers, a
  `<KonvexStageContainer>` component, scaling/zoom/world-modes.
- **[`@balage1551/konvex-editable-line`](./konvex-editable-line.md)** — an
  interactively editable polyline built on the core.

## Install

```bash
npm install @balage1551/konvex vue konva
# and, if you want the editable polyline:
npm install @balage1551/konvex-editable-line
```

`vue` (^3.5) and `konva` (^10) are **peer dependencies** — you provide them.
`@balage1551/konvex-editable-line` additionally peer-depends on
`@balage1551/konvex`; install both so a single shared core instance is used
(the editor relies on `instanceof` against it).

Component CSS is injected automatically — there is **no** separate stylesheet to import.

## Your first stage (Vue component)

The easiest entry point is the `<KonvexStageContainer>` component. It owns a
Konva stage, a transformed **world** layer for your content, and an unscaled
**overlay** layer for adornments, and gives you zoom/scroll/world-mode for free.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { KonvexStageContainer, KonvexRect, KonvexCircle } from '@balage1551/konvex'
import type { KonvexStageExpose } from '@balage1551/konvex'

const kx = shallowRef<KonvexStageExpose>()

function onReady() {
  const world = kx.value!.world!          // a KonvexLayer — put your shapes here
  new KonvexRect({ x: 40, y: 40, width: 120, height: 80, fill: '#1e88e5' }).insertInto(world)
  new KonvexCircle({ x: 260, y: 90, radius: 45, fill: '#e53935' }).insertInto(world)
}
</script>

<template>
  <KonvexStageContainer
    ref="kx"
    :content-size="{ width: 800, height: 600 }"
    world-mode="elastic"
    background="#333"
    style="width: 100%; height: 500px"
    @ready="onReady"
  />
</template>
```

`insertInto(...)` is a fluent helper on every shape/layer/group that adds it and
returns it. You can also call `world.add(shape)`.

## Your first stage (programmatic, no component)

You don't need the component — build the tree by hand against any `<div>`:

```ts
import { KonvexStage, KonvexLayer, KonvexRect } from '@balage1551/konvex'

const stage = new KonvexStage(document.getElementById('canvas') as HTMLDivElement, {
  width: 800,
  height: 600,
})
const layer = new KonvexLayer().insertInto(stage)
const rect = new KonvexRect({ x: 40, y: 40, width: 120, height: 80, fill: '#1e88e5' })
layer.add(rect)
```

## Reactivity: the one idea to understand

Every attribute is a **ref**, and every config field / ref accepts an
**`AttrSource`** — a plain value, a `Ref`, or a getter `() => value`:

```ts
import { ref } from 'vue'

rect.width.value = 200                      // plain value → writes once
rect.width.value = someWidthRef             // Ref        → tracks it forever
rect.width.value = () => store.boxWidth      // getter     → tracks it forever
rect.fill.value = '#43a047'                  // color shorthand
rect.visible.value = false
```

Because the wrapper reads/writes the **live Konva node**, you can also mutate it
from anywhere and read the current value back through `.value`.

### Alteration rules (relative writes)

Numeric attributes accept a richer write form — set / add / multiply / reset —
without you reading the current value first:

```ts
rect.x.value = { mode: 'by', value: 10 }     // move right by 10
rect.rotation.value = { mode: 'by', value: 15 }
rect.scale.value = { mode: 'by', value: 1.1 }  // scale multiplies on 'by'
rect.scale.value = { mode: 'reset' }           // back to default
rect.position.value = { x: 100, y: 50 }        // vector set
```

See [NumberParameter / VectorParameter](./konvex.md#alteration-rules) for the full grammar.

### Structured facets: fill, stroke, shadow, font

Konva spreads related attributes across many flat keys. Konvex bundles them into
one object you can set wholesale *or* tweak field-by-field:

```ts
rect.stroke.value = { color: '#fff', width: 2, dash: [6, 4] }  // whole replace
rect.stroke.value.color = '#ff4081'                            // one field
rect.strokeWidth.value = ref(3)                                // bind ONE field to a ref

rect.fill.value = {                                            // gradients & patterns too
  type: 'linearGradient',
  start: { x: -50, y: -50 }, end: { x: 50, y: 50 },
  colorStops: [{ offset: 0, color: '#e53935' }, { offset: 1, color: '#fbc02d' }],
}
```

> To bind a **reference** to a single sub-attribute, use its flat ref
> (`rect.strokeWidth.value = ref(3)`), **not** `rect.stroke.value.width = ref(3)`.

## Events

Typed, auto-cleaned Konva event handlers live on every node:

```ts
rect.onClick(e => console.log('clicked', e.evt))   // e.evt is a MouseEvent
rect.onDragMove(() => console.log(rect.position.value))
const off = rect.on('mouseover', () => {})          // generic form; returns an off()
```

Handlers are removed automatically when the node is `destroy()`ed.

## Cleanup

Call `destroy()` on a node to stop all its watchers and destroy the underlying
Konva node (cascading to descendants). Containers destroy their children.

## Where next

- **[Core reference →](./konvex.md)** — every shape, the stage component, scaling & zoom.
- **[Editable line →](./konvex-editable-line.md)** — the interactive polyline editor.

# `@balage1551/konvex` — core reference

A reactive Vue 3 wrapper around Konva. New here? Read
**[Getting started](./getting-started.md)** first; this page is the reference.

- [Concepts](#concepts)
- [Class hierarchy](#class-hierarchy)
- [Common members](#common-members)
- [`<KonvexStageContainer>` component](#konvexstagecontainer-component)
- [Stage / Layer / Group](#stage--layer--group)
- [Shape catalog](#shape-catalog)
- [Polyline utilities](#polyline-utilities)
- [Value types](#value-types)

---

## Concepts

### `AttrSource<T>` — value, ref, or getter

The most important type. Every attribute ref and every config field accepts:

```ts
type AttrSource<T> = T | Ref<T> | (() => T)
```

A plain value writes once; a `Ref`/getter sets up a watch that pushes every
change into Konva. Re-assigning a different source tears down the previous
binding first (they don't stack).

### Alteration rules

Numeric attributes read a plain `number` but *write* a `NumberParameter`, so a
write can be absolute, relative, or a reset:

| Write | Effect |
| --- | --- |
| `5` or `{ value: 5 }` or `{ mode: 'to', value: 5 }` | set to 5 |
| `{ mode: 'by', value: 5 }` | change by 5 (added; **multiplied** for `scale`) |
| `{ mode: 'reset' }` or `undefined` | restore the attribute's default |

The vector views (`position`, `size`, `scale`, `skew`, `offset`) accept a
`VectorParameter`, which adds per-axis forms:

| Write | Effect |
| --- | --- |
| `10` | both axes to 10 (or ×10 for `scale` with `mode:'by'`) |
| `{ x: 10, y: 20 }` | set each axis |
| `{ mode: 'by', x: 1, y: -1 }` | change each axis independently |
| `{ mode: 'reset' }` | restore defaults |

`'by'` is evaluated against the **live** Konva value, so relative writes compose
naturally.

### Structured facets

`fill`, `stroke`, `shadow`, and (on text) `font`/`paragraph` are **facets** — one
logical object mapped onto Konva's flat attributes. Three ways to write:

```ts
shape.stroke.value = { color: 'red', width: 2 }  // whole-object REPLACE (missing keys reset)
shape.stroke.value.color = 'red'                 // per-field write
shape.strokeWidth.value = ref(2)                 // bind ONE field to a ref (use the flat ref)
```

Whole-object assignment is a *replace*, not a patch: omitted keys fall back to
their Konva default. Binding a ref to a single field must go through the **flat
ref** (`strokeWidth`, `shadowBlur`, `fontSize`, …), not through the facet proxy.

### Measurement scale (`unitScale`)

Every shape has `unitScale` (real-world units per world unit; default 1), set by
the stage's `scale` prop. Shapes expose derived read-only measurements that use
it — e.g. `KonvexCircle.scaledArea`, `KonvexLine.scaledLength`. These are
computed refs: read `.value`.

### Constant-size nodes (`scalable`)

Set `scalable: false` (config) or `node.scalable.value = false` to keep a node at
a **constant on-screen size** regardless of zoom — its scale is driven to the
reciprocal of the cumulative ancestor scale. `effectiveScaleX/Y` expose that
cumulative (absolute) scale as computed refs.

---

## Class hierarchy

```
KonvexBase                     (scope + destroy; node-agnostic)
└─ KonvexNode<T>               (transform/visibility refs, events)
   ├─ KonvexContainer<T,Ch>    (children: add/remove, childrenVersion)
   │  ├─ KonvexStage           (root; bound to a DOM div; holds Layers)
   │  ├─ KonvexLayer           (holds nodes)
   │  └─ KonvexGroup           (transformable child container; clip)
   └─ KonvexShape<T>           (fill / stroke / shadow; unitScale)
      ├─ KonvexRect, KonvexCircle, KonvexEllipse, KonvexRing,
      │  KonvexWedge, KonvexArc, KonvexPath, KonvexTag,
      │  KonvexRegularPolygon, KonvexStar, KonvexImage, KonvexSprite
      ├─ KonvexText, KonvexTextPath   (font / paragraph facets)
      └─ KonvexLine<T>                (points, tension, closed, bezier)
         └─ KonvexArrow               (+ arrowheads)
```

`AnyNode` = `KonvexNode<Konva.Node>`; `AnyShape` = `KonvexShape<Konva.Shape>`.

---

## Common members

### `KonvexNode<T>` — every node

**Scalar refs** (each a `Ref<number>` accepting `NumberParameter`, unless noted):
`x`, `y`, `width`, `height`, `offsetX`, `offsetY`, `rotation`, `scaleX`,
`scaleY`, `skewX`, `skewY`, `opacity`, `dragDistance`.

**Other refs:** `visible` `Ref<boolean>`, `draggable` `Ref<boolean>`,
`listening` `Ref<boolean>`, `dragBoundFunc` `Ref<DragBoundFunc | undefined>`,
`globalCompositeOperation`, `id`, `name`, `scalable` `Ref<boolean>`.

**Vector views** (`WritableComputedRef<Vector2d>` accepting `VectorParameter`):
`position`, `size`, `scale`, `skew`, `offset`.

**Read-only computed:** `effectiveScaleX`, `effectiveScaleY`, `clientRect`
(`{ x, y, width, height }` in parent space).

**Methods:**
- `konvaRoot(): T` / `detach(): T` — the underlying Konva node (escape hatch).
- `on(name, handler): () => void` — typed Konva event; returns an `off`.
- Convenience handlers: `onClick`, `onDblClick`, `onContextMenu`, `onMouseDown/Up/Move/Enter/Leave/Over/Out`, `onWheel`, `onTap`, `onDblTap`, `onTouchStart/Move/End`, `onPointerDown/Up/Move`, `onDragStart/Move/End`. Each `event.evt` is typed (see [`KonvexEventMap`](#value-types)).
- `destroy()` — stop watchers + destroy the Konva node.

Config: `KonvexNodeConfig` — all the scalar/boolean attributes above (each an
`AttrSource`) plus `scalable?: boolean`.

### `KonvexShape<T>` — leaf shapes (adds paint)

**Facets** (`WritableComputedRef`, see [facets](#structured-facets)): `fill`
(`Fill`), `stroke` (`Stroke`), `shadow` (`Shadow`).

**Flat fill/stroke refs:** `strokeColor`, `strokeWidth`, `strokeEnabled`, `dash`,
`dashOffset`, `dashEnabled`, `lineCap`, `lineJoin`, `miterLimit`, `fillRule`,
`fillAfterStrokeEnabled`, `hitStrokeWidth`, `strokeScaleEnabled`.

**Flat shadow refs:** `shadowColor`, `shadowBlur`, `shadowOffset`,
`shadowOpacity`, `shadowEnabled`, `shadowForStrokeEnabled`.

**Other:** `unitScale` `Ref<number>`; `allowMultipleFills` (plain boolean — when
`false`, the default, setting `fill` clears the other Konva fill clusters first).

Config: `KonvexShapeConfig extends KonvexNodeConfig` — `fill`, `stroke`,
`shadow`, `allowMultipleFills`, `fillRule`, `fillAfterStrokeEnabled`,
`hitStrokeWidth`, `strokeScaleEnabled`.

### `KonvexContainer<T, Ch>` — Stage / Layer / Group

- `children: readonly Ch[]`
- `childrenVersion: number` — reactive; bumps on any add/remove (Konva fires no child-add event).
- `add(child, index?): Ch` — add, optionally at a z-index.
- `remove(child)` — detach without destroying.
- `destroy()` — cascades to children.

---

## `<KonvexStageContainer>` component

The Vue entry point. Wraps a stage plus a transformed **world** layer and an
unscaled **overlay** layer, and provides zoom / scroll / world-mode.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `contentSize` | `{ width, height } \| 'auto'` | `'auto'` | Content extent in world units (used by all modes except `free`). |
| `worldMode` | `'free' \| 'elastic' \| 'clipped' \| 'bounded'` | `'elastic'`\* | See below. |
| `scale` | `number` | `1` | Measurement scale (real units per world unit) → each shape's `unitScale`. |
| `zoomLevel` | `number` | `1` | Use with `v-model:zoomLevel`. |
| `zoomMode` | `'steps' \| 'proportional'` | — | Snap to a list, or a generated grid. |
| `zoomLevels` | `number[]` | `[0.25,0.5,0.75,1,1.5,2,3,4]` | Grid for `'steps'`. |
| `zoomStep` / `zoomStepType` | `number` / `'additive' \| 'multiplicative'` | — | Grid increment for `'proportional'`. |
| `zoomBase` | `number` | `1` | Grid anchor (100%). |
| `minZoom` / `maxZoom` | `number \| 'fit'` / `number` | — | `'fit'` = can't zoom out past contain-fit. |
| `zoomOnWheel` | `boolean` | — | Enable ctrl+wheel / pinch zoom. |
| `background` | `string` | — | CSS background of the viewport. |
| `frame` | `string` | — | Draw a 1px boundary frame around the content extent, in this colour. |

\* Defaults reflect the component's own prop defaults where declared; unspecified
ones fall back to Konva/behavioural defaults.

**`worldMode`:** `free` = world is the content's bounding box; `elastic` = that
bbox but never smaller than `contentSize`; `clipped` = world is exactly
`contentSize` (outside is clipped); `bounded` = world is `contentSize` and drags
keep objects inside it.

### Events

| Event | Payload |
| --- | --- |
| `ready` | `KonvexStage` — fired once the stage is mounted. |
| `zoom` | `number` — new zoom level. |
| `scroll` | `Vector2d` — new scroll position. |
| `update:zoomLevel` | `number` — for `v-model:zoomLevel`. |

### Exposed via template ref (`KonvexStageExpose`)

```ts
const kx = shallowRef<KonvexStageExpose>()
// kx.value.world!.add(shape)
```

| Member | Description |
| --- | --- |
| `stage` | The owned `KonvexStage` (escape hatch). |
| `world` | `KonvexLayer` — **add your shapes/groups here** (transformed). |
| `overlay` | `KonvexLayer` — unscaled screen-space layer for adornments. |
| `zoomLevel`, `scale` | Live values. |
| `pointerWorld()` | World coordinate under the pointer, or `null`. |
| `scaledLength(n)` / `scaledArea(n)` | Convert a world length/area to real units. |
| `zoomTo(level, anchor?)` / `zoomBy(factor, anchor?)` / `zoomIn(anchor?)` / `zoomOut(anchor?)` | Zoom controls. |
| `zoomToFit()` / `zoomToFitX()` / `zoomToFitY()` / `resetZoom()` | Fit / reset. |
| `scrollTo(x, y)` / `scrollBy(dx, dy)` | Scroll. |
| `screenToWorld(p)` / `worldToScreen(p)` | Coordinate conversion. |

---

## Stage / Layer / Group

### `KonvexStage`
```ts
new KonvexStage(container: string | HTMLDivElement, config?: KonvexStageConfig)
```
`KonvexStageConfig`: `width?`, `height?` (plus container config). Children are
`KonvexLayer`s.

### `KonvexLayer`
```ts
new KonvexLayer(config?)
layer.insertInto(stage: KonvexStage, index?): this   // fluent add
```

### `KonvexGroup`
A transformable child container. Config `KonvexGroupConfig`: `clip?` (an `IRect`
`{x,y,width,height}`), `clipFunc?` (`(ctx) => void`). Extra refs: `clip`,
`clipX`, `clipY`, `clipWidth`, `clipHeight`, `clipFunc`.
```ts
group.insertInto(parent: KonvexLayer | KonvexGroup, index?): this
```

---

## Shape catalog

All shapes extend `KonvexShape` (so they have fill/stroke/shadow), take a
`config` in their constructor, and offer `insertInto(layer, index?)`. Only the
**shape-specific** config fields and extra members are listed. `Ref<number>`
fields accept `NumberParameter` on write.

### `KonvexRect`
Config: `cornerRadius?: number | number[]`.
Members: `cornerRadius`, `area` (computed), `scaledArea`.

### `KonvexCircle`
Config: `radius?`.
Members: `radius`, `diameter`, `area`, `scaledDiameter`, `scaledArea` (all but `radius` computed).

### `KonvexEllipse`
Config: `radiusX?`, `radiusY?`, `radius?` (VectorParameter — both at once).
Members: `radiusX`, `radiusY`, `radius` (vector view), `area`, `scaledArea`.

### `KonvexRing`
Config: `innerRadius?`, `outerRadius?`.
Members: `innerRadius`, `outerRadius`, `area`, `scaledArea`.

### `KonvexWedge`
Config: `radius?`, `angle?` (degrees), `clockwise?`.
Members: `radius`, `angle`, `clockwise`.

### `KonvexArc`
Config: `innerRadius?`, `outerRadius?`, `angle?` (degrees), `clockwise?`.
Members: `innerRadius`, `outerRadius`, `angle`, `clockwise`.

### `KonvexLine<T>`
Config: `points?: number[]` (`[x1,y1,x2,y2,…]`, relative to the node), `tension?`,
`closed?`, `bezier?`.
Members: `points`, `tension`, `closed`, `bezier`; computed `pixelLength`,
`scaledLength`, `pixelArea`, `scaledArea`.
Methods:
- `worldPoints(): Vector2d[]` — points in parent/world space.
- `project(point, scope?): LineProjection | undefined` — closest point on the
  flat line to `point` (parent/world coords). `scope`: `'internal'` (whole body,
  default) / `'terminal'` (endpoints only) / `'start'` / `'end'`. See
  [`LineProjection`](#value-types).

### `KonvexArrow` (extends `KonvexLine`)
Config adds: `pointerLength?`, `pointerWidth?`, `pointerAtBeginning?`, `pointerAtEnding?`.
Members: the same four.

### `KonvexPath`
Config: `data?: string` (SVG path `d`).
Members: `data`, `length` (read-only), `scaledLength`.

### `KonvexTag`
A speech-bubble background (for building a `Label` = Group of Tag + Text yourself).
Config: `pointerDirection?: 'none'|'up'|'down'|'left'|'right'`, `pointerWidth?`,
`pointerHeight?`, `cornerRadius?`.
Members: the same four.

### `KonvexText`
Config: `text?`, `font?: Font`, `paragraph?: TextParagraph`.
Facets: `font` (`fontFamily`, `fontSize`, `fontStyle`, `fontVariant`,
`textDecoration`), `paragraph` (`align`, `verticalAlign`, `padding`,
`lineHeight`, `letterSpacing`, `wrap`, `ellipsis`, `direction`) — plus a flat ref
per field. Read-only: `textWidth`, `textHeight`.

### `KonvexTextPath`
Text along an SVG path. Config: `text?`, `data?`, `font?: Font`,
`paragraph?: TextPathParagraph` (`align`, `letterSpacing`, `lineHeight`,
`textBaseline`). Flat refs per field; read-only `textWidth`, `textHeight`.

### `KonvexRegularPolygon`
Config: `sides?` (≥3), `radius?`, `cornerRadius?`.
Members: `sides`, `radius`, `cornerRadius`, `area`, `scaledArea`.

### `KonvexStar`
Config: `numPoints?` (≥3), `innerRadius?`, `outerRadius?`.
Members: `numPoints`, `innerRadius`, `outerRadius`.

### `KonvexImage`
Config: `image?: CanvasImageSource`, `crop?: IRect`, `cornerRadius?`.
Members: `image`, `crop`, `cropX/Y/Width/Height`, `cornerRadius`.
Static: `KonvexImage.fromURL(url, config?): Promise<KonvexImage>` — loads then resolves a ready shape.

### `KonvexSprite`
A frame-animated bitmap. **Required** config: `image`, `animation` (name),
`animations` (`Record<string, number[]>`, frames `[x,y,w,h,…]`). Optional:
`frameIndex?`, `frameRate?`, `frameOffsets?`.
Members: those refs. Methods: `start()`, `stop()`, `isRunning()`.

```ts
const sprite = new KonvexSprite({
  image: sheet, animation: 'idle',
  animations: { idle: [0,0,120,120, 120,0,120,120, 240,0,120,120] },
  frameRate: 3,
})
sprite.insertInto(world)
sprite.start()
```

---

## Polyline utilities

Standalone functions (pure; inputs not mutated) from `@balage1551/konvex`:

- `projectPointOntoLine(p, a, b): Vector2d` — foot of the perpendicular from `p`
  onto the infinite line through `a`,`b`.
- `straightenPoints(points): Vector2d[]` — keep first & last, project the rest
  onto the line through them.
- `simplifyPoints(points, threshold?): Vector2d[]` — drop near-collinear points,
  then merge dense clusters to their centroid.
- `SimplificationThreshold` `{ angle?: number (deg, default 5), distance?: number (default 10) }`;
  `DEFAULT_SIMPLIFICATION` holds the resolved defaults.

---

## Value types

| Type | Shape |
| --- | --- |
| `Vector2d` | `{ x: number; y: number }` |
| `Stroke` | `{ color?, width?, enabled?, dash?, dashOffset?, dashEnabled?, lineCap?, lineJoin?, miterLimit? }` |
| `Shadow` | `{ color?, blur?, offset?: Vector2d, opacity?, enabled?, forStrokeEnabled? }` |
| `Font` | `{ fontFamily?, fontSize?, fontStyle?, fontVariant?, textDecoration? }` |
| `Fill` | `SolidFill \| LinearGradientFill \| RadialGradientFill \| PatternFill \| undefined` |
| `FillInput` | `Fill \| string` (a bare colour string is a solid fill) |
| `LineProjection` | `{ point: Vector2d, segment: number, proportion: number, distance: number, angle: number }` |
| `NumberParameter` | see [alteration rules](#alteration-rules) |
| `VectorParameter` | see [alteration rules](#alteration-rules) |
| `DragBoundFunc` | `(pos: Vector2d) => Vector2d` |
| `KonvexEventMap` | maps each event name (`click`, `wheel`, `dragmove`, …) to its DOM event type |

### Fill variants

```ts
// solid (or just a colour string)
shape.fill.value = { type: 'solid', color: '#1e88e5' }
shape.fill.value = '#1e88e5'

// linear / radial gradient
shape.fill.value = { type: 'linearGradient', start: {x:-50,y:-50}, end: {x:50,y:50},
                     colorStops: [{offset:0,color:'#e53935'},{offset:1,color:'#fbc02d'}] }
shape.fill.value = { type: 'radialGradient', start: {x:0,y:0}, end: {x:0,y:0},
                     startRadius: 0, endRadius: 60,
                     colorStops: [{offset:0,color:'#fff'},{offset:1,color:'#1e88e5'}] }

// pattern
shape.fill.value = { type: 'pattern', image: img, repeat: 'repeat', scale: 0.1 }
```

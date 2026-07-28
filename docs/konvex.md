# `@balage1551/konvex` — core reference

A reactive Vue 3 wrapper around Konva. New here? Read
**[Getting started](./getting-started.md)** first; this page is the reference.

- [Concepts](#concepts) · [Events](#events)
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

### Two-way by default

The Konva node is the single source of truth: an attribute ref reads and writes
it directly, keeping no copy. Writes that **bypass** konvex therefore still show
up — a drag, a `Konva.Transformer`, a `Konva.Tween`, or a plain
`node.konvaRoot().rotation(45)` — because each ref invalidates itself from
Konva's own `<attr>Change` event. Computeds over `scaleX`, `effectiveScaleX/Y`,
`clientRect`, `scalable: false` compensation and `watch`ers all follow.

Two consequences worth knowing:

- The invalidation is wired on the ref's first **read**, so an attribute you only
  ever write costs no Konva listener.
- While `scalable` is `false`, `scaleX`/`scaleY` belong to konvex: a scale
  written from anywhere else is reverted on the next flush (see
  [Constant-size nodes](#constant-size-nodes-scalable)).

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

Every **node** has `unitScale` (real-world units per world unit; default 1).
Shapes expose derived read-only measurements that use it — e.g.
`KonvexCircle.scaledArea`, `KonvexLine.scaledLength`. These are computed refs:
read `.value`.

`unitScale` is **inherited**, like `effectiveScaleX`: a node with no scale of its
own reads its parent's, on up to whichever ancestor originates one. The stage's
`scale` prop originates it on the world, so every descendant — at any depth,
attached in any order — reads it without anything being propagated. A shape added
to a deeply nested group later is correct immediately, and so is one that gets
reparented.

Writing `node.unitScale.value = 2` **pins** that node, overriding what it would
inherit; its descendants then inherit the pinned value. Useful for a subtree in
its own units. Assign `undefined` to unpin and resume inheriting.

### Constant-size nodes (`scalable`)

Set `scalable: false` (config) or `node.scalable.value = false` to keep a node at
a **constant on-screen size** regardless of zoom — its scale is driven to the
reciprocal of the cumulative ancestor scale. `effectiveScaleX/Y` expose that
cumulative (absolute) scale as computed refs.

While this is `false`, the node's own `scaleX`/`scaleY` are konvex's to set: a
scale written from elsewhere — including by a `Konva.Transformer` — is reverted
on the next flush. Set `scalable` back to `true` to take the scale over.

### Events

Interaction events pass straight through from Konva, typed by
[`KonvexEventMap`](#value-types) so `event.evt` is the right DOM event:

```ts
const off = shape.on('click', e => console.log(e.evt.altKey))   // typed MouseEvent
shape.on(['click', 'tap'], e => select(e))                      // one unit, one off
shape.once('dragend', commit)                                   // self-removing
node.bindTo(stage, 'mousemove', track)                          // another node, our lifetime
```

- **Removal is automatic.** Every binding lives in the object's effect scope, so
  `destroy()` drops it; the returned `off` is for removing one early. Each
  registration gets its own Konva namespace, so binding the same event twice and
  removing one leaves the other alone.
- **Arrays bind as a unit.** One namespace, one `off`, and `once` removes all of
  them on the first delivery of any.
- **`bindTo(target, …)`** listens on *another* node — a stage, a sibling — with
  *this* object's lifetime. That's the one to reach for in a widget that must
  watch the stage: no need to remember which stage you attached to, and nothing
  survives your `destroy()`. `target` may be a konvex object or a raw Konva node.
- **Convenience handlers** mirror the map 1:1 (`onClick`, `onPointerClick`,
  `onTransformEnd`, …) for when you'd rather not spell the name as a string.

#### Getting back to konvex from an event

`event.target` / `event.currentTarget` stay **Konva** nodes, exactly as Konva set
them. Alongside them konvex adds `konvexTarget` / `konvexCurrentTarget`, which
resolve those nodes to their wrappers on access — `undefined` for a node konvex
never wrapped (a `Konva.Transformer`'s anchors, say) or one whose wrapper is
destroyed:

```ts
stage.onClick(e => {
  if (e.konvexTarget === stage) return   // the empty canvas
  select(e.konvexTarget)
})
```

`konvexOf(node)` does the same lookup for a node you have some other way. Both
read the same `WeakMap`, filled when a wrapper is constructed and emptied on its
`destroy()`.

#### The pointer

Two methods on every node, both `null` when the node is not on a stage or no
pointer has been seen:

| Method | Space |
| --- | --- |
| `pointerPosition()` | stage/canvas pixels, before any world transform (a copy, safe to mutate) |
| `relativePointerPosition()` | **this node's own** space — zoom, scroll, group transforms and the world origin already applied |

Read the relative one on the node whose geometry you are comparing against, and
there is no transform maths to do. On the stage container's world layer it is the
world coordinate — which is what `pointerWorld()` on the component returns.

#### DOM events (keyboard, and anything else Konva ignores)

`bindDom(target, type, handler, options?)` is `bindTo` for a DOM target, with the
same lifetime rule. Konva delivers no key events and the stage container takes no
focus, so modifier state and shortcuts have to come from `window`:

```ts
widget.bindDom(window, 'keydown', e => (alt.value = e.altKey))
```

#### konvex signals

Lifecycle facts have no DOM event behind them, so they live on a separate typed
emitter, `signals`, on every konvex object:

```ts
node.signals.on('destroy', ({ node }) => forget(node))
group.signals.on('child-added', ({ child, index }) => …)
group.signals.on('child-removed', ({ child }) => …)
```

| Signal | Fired |
| --- | --- |
| `destroy` | from `destroy()`, **before** the scope stops and the Konva node goes, so the object is still readable. A subtree teardown emits one per node, deepest first. |
| `child-added` | a child joined this container, including a re-parent |
| `child-removed` | a child left: `remove()`, a re-parent into another container, or the child destroying itself. A container's *own* teardown does **not** enumerate its children — the subtree reports itself through `destroy`. |

Signals don't bubble, and `on(...)`/`signals.on(...)` stay separate on purpose:
one carries Konva's DOM events up the tree, the other carries konvex's own facts
about one object. Both are dropped when the object is destroyed. `KonvexEmitter`
is exported if you want the same thing for your own signals.

Three things deliberately are *not* events at all:

| Instead of | konvex uses |
| --- | --- |
| `<attr>Change` | the attribute's ref — `watch(shape.x, …)`. The change event drives ref invalidation internally. |
| Konva's `add` | `childrenVersion` (reactive counter) for *state*, `child-added`/`child-removed` for *notification* |
| `mousecancel` / `touchcancel` / `pointercancel` | `pointerup`. Konva lists those names but never fires them: a cancelled pointer is re-dispatched as `pointerup`. A cancelled *drag* still ends with `dragend`. |

---

## Class hierarchy

```
KonvexBase                     (scope + destroy + bindTo; node-agnostic)
└─ KonvexNode<T>               (transform/visibility refs, events; unitScale)
   ├─ KonvexContainer<T,Ch>    (children: add/remove, childrenVersion)
   │  ├─ KonvexStage           (root; bound to a DOM div; holds Layers)
   │  ├─ KonvexLayer           (holds nodes)
   │  └─ KonvexGroup           (transformable child container; clip)
   └─ KonvexShape<T>           (fill / stroke / shadow)
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
(`{ x, y, width, height }` in parent space). `clientRect` re-reads whenever
anything that moves the box changes:

- every attribute of the node's own transform, and its `visible`;
- a container's whole subtree — children and their children, including one being
  hidden or shown, which Konva takes in or out of the union;
- the stroke, which `getClientRect` adds to the box;
- and each shape's own geometry: `radius`, the radii and angles, `sides`, `points`,
  `data`, the text and font cluster, an image's natural size, a tag's pointer, an
  arrow's head.

`cornerRadius` and a sprite's `frameIndex` are *not* dependencies, because Konva's
box does not depend on them. A custom shape adds its own by overriding the
protected `trackGeometry()` — read a ref there and the box follows it.

**Inherited:** `unitScale` `WritableComputedRef<number, number | undefined>` —
reads the nearest ancestor's unless pinned by writing to it; see
[Measurement scale](#measurement-scale-unitscale).

**Methods:**
- `konvaRoot(): T` / `detach(): T` — the underlying Konva node (escape hatch).
- `pointerPosition(): Vector2d | null` / `relativePointerPosition(): Vector2d | null` — the pointer in stage space / in this node's own space. See [Events](#events).
- `on(name | names, handler, { once? }): () => void` — typed Konva event(s); returns an `off`. See [Events](#events).
- `once(name | names, handler): () => void` — removed after the first delivery.
- `bindTo(target, name | names, handler, { once? }): () => void` — the same, on another node, with this object's lifetime (inherited from `KonvexBase`).
- `bindDom(target, type, handler, options?): () => void` — a DOM listener with this object's lifetime (`KonvexBase`).
- `signals` — konvex's own emitter: `destroy`, plus `child-added`/`child-removed` on a container. See [Events](#events).
- Convenience handlers: `onClick`, `onDblClick`, `onContextMenu`, `onMouseDown/Up/Move/Enter/Leave/Over/Out`, `onWheel`, `onTap`, `onDblTap`, `onTouchStart/Move/End/Enter/Leave/Over/Out`, `onPointerDown/Up/Move/Enter/Leave/Over/Out`, `onPointerClick`, `onPointerDblClick`, `onGotPointerCapture`, `onLostPointerCapture`, `onDragStart/Move/End`, `onTransformStart/Transform/TransformEnd` — one per entry in [`KonvexEventMap`](#value-types), each with `event.evt` typed.
  The `transform*` trio comes from a `Konva.Transformer` the node is attached to;
  unlike the drag events these do **not** bubble, so bind them on the transformed
  node itself.
- `destroy()` — unregister from the parent, stop watchers, destroy the Konva node.
  A destroyed node leaves its parent's `children` and bumps `childrenVersion`, so
  it is neither pinned in memory nor reported as live.

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

**Other:** `allowMultipleFills` (plain boolean — when
`false`, the default, setting `fill` clears the other Konva fill clusters first).

Config: `KonvexShapeConfig extends KonvexNodeConfig` — `fill`, `stroke`,
`shadow`, `allowMultipleFills`, `fillRule`, `fillAfterStrokeEnabled`,
`hitStrokeWidth`, `strokeScaleEnabled`.

### `KonvexContainer<T, Ch>` — Stage / Layer / Group

- `children: readonly Ch[]`
- `childrenVersion: number` — reactive; bumps on any add/remove here *or* in any
  descendant container, since the bump bubbles up the ancestor chain. (Konva's own
  `add` event fires only on the immediate parent, so this is what subtree-wide
  watchers use.)
- `add(child, index?): Ch` — add, optionally at a z-index. **Re-parents** a child
  that already has a parent: it is taken off the old container's `children` and
  moved in Konva, and both containers bump their `childrenVersion`. A child is
  therefore only ever in one container, so the old parent's `destroy()` won't
  destroy it and its `remove()` won't detach it.
- `remove(child)` — detach without destroying. A no-op for a child this container
  doesn't currently hold.
- `destroy()` — cascades to children, then unregisters itself from its own parent.
  The whole teardown counts as a single `childrenVersion` bump, not one per child.

---

## `<KonvexStageContainer>` component

The Vue entry point. Wraps a stage plus a transformed **world** layer and an
unscaled **overlay** layer, and provides zoom / scroll / world-mode.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `contentSize` | `{ width, height } \| 'auto'` | `'auto'` | Content extent in world units (used by all modes except `free`). |
| `worldMode` | `'free' \| 'elastic' \| 'clipped' \| 'bounded'` | `'elastic'`\* | See below. |
| `scale` | `number` | `1` | Measurement scale (real units per world unit) → the world's `unitScale`, inherited by every descendant. |
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
bbox but never smaller than `contentSize`; `bounded` = world is exactly
`contentSize` and drags keep each object inside it; `clipped` = the same drag
constraint, plus anything still outside (placed programmatically) is clipped away.

The drag constraint is applied as a `dragBoundFunc`, so the position is corrected
*before* it lands on the node — a node never briefly holds an out-of-world value,
and anything deriving state from the drag (an `EditableLine` handle writing its
point, say) sees the constrained position. A node's own `dragBoundFunc` still
applies; the world constraint composes with it rather than replacing it.

### Events

| Event | Payload |
| --- | --- |
| `ready` | `KonvexStage` — fired once the stage is mounted. |
| `zoom` | `number` — new zoom level. |
| `scroll` | `Vector2d` — new scroll position. |
| `update:zoomLevel` | `number` — for `v-model:zoomLevel`. |
| `world-resize` | `{ x, y, width, height }` — the world rect changed. Only `free`/`elastic` can fire it (their world follows the content); silent until after `ready`, since the first pass is the initial layout, not a change. |
| `pointer` | `Vector2d \| null` — the pointer in **world** units on every move, `null` when it leaves. Read off the world layer, so zoom, scroll and the origin are already applied; fires over empty canvas too. |

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
  flat line to `point` (parent/world coords), among the parts in `scope`. See
  [`LineProjection`](#value-types).

  A scope is a **set** of `LineProjectionPart` — `'start'`, `'internal'`, `'end'`
  — so any subset is valid. `project` evaluates every allowed part and returns the
  nearest. Pass a set, or the name of a predefined one:

  | name | set | meaning |
  | --- | --- | --- |
  | `'anywhere'` | `['start','internal','end']` | body or either end (**default**) |
  | `'internal'` | `['internal']` | body only |
  | `'terminal'` | `['start','end']` | either end, never the body |
  | `'start'` / `'end'` | `['start']` / `['end']` | that end only |

  `LINE_PROJECTION_SCOPES` holds them; `lineProjectionParts(scope)` resolves a
  name or set to its parts. The empty set allows nothing and returns `undefined`.

  The scope alone bounds which `segment` values can come back. Segment projections
  are clamped, so a query past an end lands on the terminal vertex: with that end
  in scope it reports the extension (`-1` / `n`), and without it stays a body
  insert into the terminal segment. That is why `'internal'` alone never extends.

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
| `KonvexEventMap` | every event Konva dispatches on a node (37: mouse, touch, pointer, wheel, drag, transform), mapped to its DOM event type — see [Events](#events) |
| `KonvaEventOptions` | `{ once?: boolean }` — the third argument of `on`/`bindTo` |
| `KonvexEventObject<E>` | Konva's event object plus `konvexTarget` / `konvexCurrentTarget` |
| `KonvexSignalMap` | `destroy`, `child-added`, `child-removed` — the payloads on `signals` |
| `KonvexEmitter<M>` / `KonvexListener<T>` | the typed emitter behind `signals`, reusable for your own signals |

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

import type { MaybeRefOrGetter } from 'vue'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { LineCap, LineJoin } from 'konva/lib/Shape'
import type { KonvexNode } from './KonvexNode'
import type { KonvexShape } from './KonvexShape'

/**
 * Shared value types for konvex.
 *
 * Only cross-cutting *value* types live here. Each wrapper's `*Config` type is
 * defined alongside the wrapper class itself (e.g. `KonvexRectConfig` lives in
 * `KonvexRect.ts`), so a feature stays self-contained.
 */

/**
 * A value that can be supplied either as a static value, or as a reactive
 * *reference* — a `Ref` or a getter function (`() => value`).
 *
 * This is the single most important type in konvex: every attribute and
 * every config field accepts an `AttrSource`, which is what lets a caller
 * write `width: 120` or `width: someRef` or `width: () => store.width`
 * interchangeably. Vue's `toValue()` resolves all three forms.
 */
export type AttrSource<T> = MaybeRefOrGetter<T>

/** A 2D point, mirroring Konva's `Vector2d`. */
export interface Vector2d {
  x: number
  y: number
}

/** How a relative (`by`) change combines with the current value. */
export type ChangeMode = 'add' | 'multiply'

/** Optional bounds applied after a number parameter is resolved. */
export interface NumberConstraint {
  /** Lower bound — a constant, or a getter for a bound that depends on other
   * live state (e.g. an inner radius clamped to the current outer radius). */
  min?: number | (() => number)
  /** Upper bound — a constant or a getter (see {@link min}). */
  max?: number | (() => number)
  /** Decimal places to round to (e.g. `2` → nearest 0.01). */
  round?: number
}

/**
 * An *alteration rule* for a numeric attribute — the richer write form a number
 * attribute accepts in addition to a plain value/ref/getter. It lets a write be
 * relative to the current value or restore the default:
 *
 *   - `5`                          — set to 5 (shorthand for `{ value: 5 }`)
 *   - `{ value: 5 }`               — set to 5
 *   - `{ mode: 'to', value: 5 }`   — set to 5
 *   - `{ mode: 'by', value: 5 }`   — change by 5 (added, or *multiplied* for `scale`)
 *   - `{ mode: 'reset' }` / `undefined` — restore the attribute's default
 *
 * `'by'` is interpreted against the live Konva value, so it composes naturally
 * with node-as-source-of-truth.
 */
export type NumberParameter =
  | number
  | { mode?: 'by' | 'to'; value: number }
  | { mode: 'reset' }
  | undefined

/**
 * The two-dimensional counterpart of {@link NumberParameter}, accepted by the
 * vector views (`position`, `size`, `scale`, `offset`). Beyond the scalar forms
 * (which affect both axes equally) it adds per-axis values:
 *
 *   - `{ x: 10, y: 20 }`             — set each axis (shorthand for mode `'to'`)
 *   - `{ mode: 'by', x: 1, y: -1 }`  — change each axis independently
 */
export type VectorParameter =
  | number
  | { mode?: 'by' | 'to'; value: number }
  | { mode?: 'by' | 'to'; x: number; y: number }
  | { mode: 'reset' }
  | undefined

/**
 * A structured stroke description.
 *
 * Konva exposes stroke as a handful of independent flat attributes
 * (`stroke`, `strokeWidth`, `dash`, ...). konvex bundles them into one
 * object so you can either set the whole stroke at once
 * (`shape.stroke = { color: 'red', width: 2 }`) or tweak a single facet
 * (`shape.stroke.color = 'red'`) — both write straight through to Konva.
 */
export interface Stroke {
  color?: string
  width?: number
  enabled?: boolean
  dash?: number[]
  dashOffset?: number
  dashEnabled?: boolean
  lineCap?: LineCap
  lineJoin?: LineJoin
  miterLimit?: number
}

/**
 * Canvas blend mode, mirroring Konva's (unexported) `globalCompositeOperation`
 * value type.
 */
export type GlobalCompositeOperation =
  | ''
  | 'source-over'
  | 'source-in'
  | 'source-out'
  | 'source-atop'
  | 'destination-over'
  | 'destination-in'
  | 'destination-out'
  | 'destination-atop'
  | 'lighter'
  | 'copy'
  | 'xor'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

/** A drag-bound constraint: maps an attempted position to an allowed one. */
export type DragBoundFunc = (pos: Vector2d) => Vector2d

/**
 * A structured shadow description.
 *
 * Konva exposes shadow as several flat attributes (`shadowColor`,
 * `shadowBlur`, `shadowOffset`, ...). Like {@link Stroke}, konvex bundles them
 * into one object so you can set the whole shadow at once
 * (`shape.shadow.value = { color: 'black', blur: 10 }`) or tweak a single facet
 * (`shape.shadow.value.blur = 10`) — both write straight through to Konva.
 */
export interface Shadow {
  color?: string
  blur?: number
  offset?: Vector2d
  opacity?: number
  enabled?: boolean
  forStrokeEnabled?: boolean
}

/**
 * A structured font description — the glyph-appearance cluster shared by
 * `KonvexText` and `KonvexTextPath`. `textDecoration` lives here (rather than
 * with the paragraph/layout attributes) because it styles the glyphs, not the
 * arrangement of text within its box.
 */
export interface Font {
  fontFamily?: string
  fontSize?: number
  /** e.g. `'normal'`, `'bold'`, `'italic'`, `'italic bold'`. */
  fontStyle?: string
  /** e.g. `'normal'`, `'small-caps'`. */
  fontVariant?: string
  /** e.g. `''`, `'underline'`, `'line-through'`. */
  textDecoration?: string
}

/** One stop in a gradient. */
export interface ColorStop {
  offset: number
  color: string
}

export type FillPatternRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'

/**
 * `fill` is a discriminated union — a single logical attribute that maps onto
 * one of Konva's four mutually-exclusive fill clusters. The `type` tag selects
 * the variant; the setter writes the matching cluster of flat Konva attributes
 * and flips Konva's `fillPriority` so that cluster is the one rendered.
 */
export interface SolidFill {
  type: 'solid'
  color: string
}

export interface LinearGradientFill {
  type: 'linearGradient'
  start: Vector2d
  end: Vector2d
  colorStops: ColorStop[]
}

export interface RadialGradientFill {
  type: 'radialGradient'
  start: Vector2d
  end: Vector2d
  startRadius: number
  endRadius: number
  colorStops: ColorStop[]
}

export interface PatternFill {
  type: 'pattern'
  image: HTMLImageElement | HTMLCanvasElement
  /** Pattern origin within the shape (Konva `fillPatternX`/`fillPatternY`). */
  x?: number
  y?: number
  offset?: Vector2d
  /** Uniform scale (number) or per-axis ({x,y}). */
  scale?: Vector2d | number
  rotation?: number
  repeat?: FillPatternRepeat
}

/** The normalised value `fill` reads back. */
export type Fill = SolidFill | LinearGradientFill | RadialGradientFill | PatternFill | undefined

/**
 * What `fill` accepts on write: any {@link Fill} variant, a bare colour string
 * (shorthand for a solid fill), or `undefined` to clear.
 */
export type FillInput = Fill | string

// ---------------------------------------------------------------------------
// Cross-cutting node/shape aliases + the strict event map.
// ---------------------------------------------------------------------------

/** Any konvex node — a leaf shape or a container/group. */
export type AnyNode = KonvexNode<Konva.Node>
/** Any konvex leaf shape (anything with paint). */
export type AnyShape = KonvexShape<Konva.Shape>

/**
 * Konva interaction events mapped to their native DOM event type. Drives the
 * strictly-typed {@link KonvexNode.on} and the per-event convenience handlers
 * (`onClick`, `onMouseMove`, …) — so the handler's `event.evt` is correctly
 * typed per event instead of `any`.
 */
export interface KonvexEventMap {
  click: MouseEvent
  dblclick: MouseEvent
  contextmenu: MouseEvent
  mousedown: MouseEvent
  mouseup: MouseEvent
  mousemove: MouseEvent
  mouseenter: MouseEvent
  mouseleave: MouseEvent
  mouseover: MouseEvent
  mouseout: MouseEvent
  wheel: WheelEvent
  tap: TouchEvent
  dbltap: TouchEvent
  touchstart: TouchEvent
  touchmove: TouchEvent
  touchend: TouchEvent
  pointerdown: PointerEvent
  pointerup: PointerEvent
  pointermove: PointerEvent
  // Konva drag events carry the originating mouse/touch event.
  dragstart: MouseEvent | TouchEvent
  dragmove: MouseEvent | TouchEvent
  dragend: MouseEvent | TouchEvent
}

/** A bindable konvex event name. */
export type KonvexEventName = keyof KonvexEventMap

/** A handler for event `K`, with a correctly-typed `event.evt`. */
export type KonvexEventHandler<K extends KonvexEventName> = (
  event: KonvaEventObject<KonvexEventMap[K]>,
) => void

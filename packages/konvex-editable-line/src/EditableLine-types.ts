import type { Vector2d } from '@balage1551/konvex'
import type { KonvexGroupConfig } from '@balage1551/konvex'
import type { KonvexLineConfig, LineProjectionScopeInput } from '@balage1551/konvex'
import type { SimplificationThreshold } from '@balage1551/konvex'
import type { FillInput, KonvexContent, PolylineEnd, Stroke } from '@balage1551/konvex'
import type { EditableLine } from './EditableLine'

// Re-export so a config author can name the type from the editableline package.
export type { SimplificationThreshold } from '@balage1551/konvex'

/** Per-point movement: free, axis-locked, or pinned. */
export type PointMovement = 'free' | 'x' | 'y' | false

/** Per-point overrides; `undefined` fields inherit the line-wide default. */
export interface PointOptions {
  movable?: PointMovement
  selectable?: boolean
}

/** Context handed to the handle styler. */
export interface HandleState {
  index: number
  selected: boolean
  selectable: boolean
  /** The point's *effective* movement. */
  movable: PointMovement
  /** The point is inside the active rubber-band box (a live "would-select" hint). */
  previewSelected: boolean
}

/** Visual style for a point handle (a solid-filled, stroked marker). */
export interface HandleStyle {
  fill: string
  stroke: string
  strokeWidth?: number
  opacity?: number
}

/** When the point markers are shown. `whenSelected` uses {@link EditableLine.active}. */
export type HandleShow = 'always' | 'whenSelected' | 'never'

export interface HandleConfig {
  /** When markers are shown. `whenSelected` uses {@link EditableLine.active}. */
  show?: HandleShow
  /** Marker side length in screen pixels (constant-size square, centred on the point). */
  size?: number
  /** Marker half-size; overrides `size`. The point sits at the marker centre. */
  radius?: number
  /** Per-state style; defaults to {@link defaultHandleStyle}. */
  style?: (state: HandleState) => HandleStyle
}

/** When the projection assist is shown. */
export type AssistShow = 'always' | 'onAlt' | 'never'

export interface AssistConfig {
  /** When the projection assist is shown. */
  show?: AssistShow
  /**
   * Where added points may land — any subset of `'start'` / `'internal'` / `'end'`,
   * or the name of a predefined set. Defaults to `'anywhere'` (all three); an
   * unrecognised value reads as `'anywhere'` too, never as "nowhere".
   *
   * `'nowhere'` (or `[]`) fixes the line's point *count* while leaving it fully
   * editable — points still drag, select and align. It works below the gesture
   * flags, on `project` itself, so the assist previews nothing either.
   */
  scope?: LineProjectionScopeInput
  /** Snap the insertion point to the line when within this distance (world units, default `10`). */
  snapThreshold?: number
}

/**
 * The dashed guide drawn through a point while its drag is constrained to a
 * single axis (Ctrl+drag, or a point whose {@link PointMovement} is `'x'`/`'y'`).
 * Rendered at a constant on-screen size regardless of zoom.
 */
export interface DragConstraintLineConfig {
  /** Whether to draw the guide during an axis-constrained drag (default `true`). */
  show?: boolean
  /** Stroke color (default `'#808080'`). */
  color?: string
  /** Stroke width in screen pixels; never scales with zoom (default `1`). */
  width?: number
  /** Half-length in screen pixels — how far the guide reaches each way (default `25`). */
  radius?: number
}

/**
 * The rubber-band box: drag on empty canvas (while the line is active) to select
 * the enclosed points. Ctrl at release extends the current selection; otherwise
 * it replaces it. Points inside the box are previewed live while dragging.
 */
export interface RubberBandConfig {
  /** Whether empty-canvas drag starts a rubber-band selection (default `true`). */
  enabled?: boolean
  /** Box fill (default a translucent blue). */
  fill?: string
  /** Box stroke color (default `'#4fc3f7'`). */
  stroke?: string
}

/** What a custom arrowhead factory is told about the head it should build. */
export interface ArrowHeadContext {
  /** Which end's config the head comes from. */
  end: PolylineEnd
  /** The point the head belongs to: `0` / last for the terminal heads, else an internal one. */
  index: number
  /** The line being decorated. */
  line: EditableLine
  /** Extent along the line (the resolved {@link ArrowHeadConfig.size}). */
  size: number
  /** Extent across the line: `size / ratio`. */
  width: number
}

/**
 * Builds a custom arrowhead. Draw it in a frame whose origin is the tip and whose
 * +x axis points the way the head points (out of the line), so the head itself
 * lies along −x, from `0` back to `−size`. EL positions and rotates the frame.
 */
export type ArrowHeadFactory = (ctx: ArrowHeadContext) => KonvexContent

/**
 * A built-in arrowhead shape:
 * - `triangle` — filled triangle, base `width` wide;
 * - `open` — two strokes meeting at the tip (`—>`); no base, no fill;
 * - `diamond` — filled rhombus, `size` long and `width` across;
 * - `circle` — filled ellipse, `size` along the line and `width` across.
 */
export type ArrowHeadBuiltin = 'triangle' | 'open' | 'diamond' | 'circle'

/** How far the line itself is shortened under a head. */
export type ArrowHeadTrim = 'base' | 'tip' | 'none'

/** One end's arrowhead. */
export interface ArrowHeadConfig {
  /** Whether the head is drawn (default `true` once configured). */
  show?: boolean
  /** Built-in shape or a factory (default `'triangle'`). */
  shape?: ArrowHeadBuiltin | ArrowHeadFactory
  /**
   * Extent along the line (default `10`). World units when the `'decoration'`
   * component scales, screen pixels when it does not.
   */
  size?: number
  /** Length ÷ width (default `1`): `2` makes the head twice as long as it is wide. */
  ratio?: number
  /**
   * Gap between the end point and the tip, measured along the line, in world
   * units (default `0`) — the radius of a circular object sitting on that point.
   */
  offset?: number
  /**
   * Where the drawn line stops: at the head's `'base'` (its back, `size` behind
   * the tip), at its `'tip'`, or `'none'` to draw it whole. Default `'base'`, and
   * `'tip'` for `open`, whose arms would otherwise stand clear of the line.
   */
  trim?: ArrowHeadTrim
  /**
   * Repeat the head at every internal point too (default `false`), on that
   * point's own segment: an end head on the segment arriving at the point,
   * pointing forward; a start head on the one leaving it, pointing back. Each is
   * held `offset` clear of its point. The line runs through them — `trim`
   * applies to the terminal head only — and one whose segment is shorter than
   * `offset` is skipped.
   */
  atEveryPoint?: boolean
  /** Fill; defaults to the line's stroke colour for the filled shapes, none for `open`. */
  fill?: FillInput
  /**
   * Stroke, merged field by field over a default of the line's colour and width,
   * undashed. The filled shapes draw no stroke unless one is given.
   */
  stroke?: Stroke
}

/**
 * EL sub-parts whose on-screen size can scale with zoom: the line's stroke, the
 * point markers, the assist helpers (preview marker + guide lines), and the end
 * decorations (arrowheads).
 */
export type ScalableComponent = 'line' | 'marker' | 'helper' | 'decoration'
/** `'all'`, `'none'`, or the explicit set of {@link ScalableComponent}s that scale. */
export type ScalableComponents = 'all' | 'none' | ScalableComponent[]

export interface EditableLineConfig extends KonvexGroupConfig {
  /** Initial vertices, in the line's local/world coordinate space. */
  points?: Vector2d[]
  /** Pass-through config for the wrapped `KonvexLine` (paint, closed, tension). */
  line?: KonvexLineConfig

  /** Line-wide default movement (default `'free'`). */
  movable?: PointMovement
  /** Line-wide default selectability (default `true`). */
  selectable?: boolean
  /** Per-point overrides (by index); `undefined` entries inherit the defaults. */
  pointOptions?: (PointOptions | undefined)[]

  handles?: HandleConfig
  assist?: AssistConfig
  /** Styling for the axis guide shown during a constrained drag. */
  dragConstraintLine?: DragConstraintLineConfig
  /** Rubber-band box selection (empty-canvas drag). */
  rubberBand?: RubberBandConfig
  /** Thresholds used by the `simplify` operation (angle/distance). */
  simplification?: SimplificationThreshold
  /** Arrowhead before the first point. Hidden on a closed or curved (`tension`) line. */
  startHead?: ArrowHeadConfig
  /** Arrowhead after the last point. Hidden on a closed or curved (`tension`) line. */
  endHead?: ArrowHeadConfig

  /**
   * Which parts scale with zoom; the rest keep a constant on-screen size.
   * `'line'` ties to the geometry's stroke width, `'marker'`/`'helper'`/
   * `'decoration'` to the node size. Default `['line', 'decoration']` — geometry
   * and its arrowheads scale, editing chrome stays constant.
   */
  scalableComponents?: ScalableComponents

  /** Double-clicking the line inserts a point at the projection. */
  breakOnDblClick?: boolean
  /** Double-clicking the stage adds a point (snapped to the line if close). */
  addOnDblClick?: boolean
  /**
   * Alt+click commits the assist: insert on the line (snapped within
   * `assist.snapThreshold`) or extend at the cursor. A single gesture that
   * unifies break + add and avoids the single-vs-double-click conflict.
   */
  addOnAltClick?: boolean
  /**
   * Keep the handle (point) selection when the line is deactivated. When `false`
   * (default), deselecting the line clears its point selection. Tweakable at
   * runtime via {@link EditableLine.persistentSelection}.
   */
  persistentSelection?: boolean
}

/** A row of {@link EditableLine.pointInfos}. */
export interface PointInfo {
  index: number
  x: number
  y: number
  selectable: boolean
  movable: PointMovement
  selected: boolean
}

/** Default handle styling: inert / selected / preview / unmovable / normal. */
export function defaultHandleStyle(state: HandleState): HandleStyle {
  if (!state.selectable && state.movable === false) {
    return { fill: '#9e9e9e22', stroke: '#666666', strokeWidth: 1, opacity: 1 }
  }
  if (state.selected) {
    return { fill: '#ffc917', stroke: '#71630b', strokeWidth: 1.5, opacity: 0.9 }
  }
  if (state.previewSelected) {
    return { fill: '#00e5ff88', stroke: '#00acc1', strokeWidth: 1.5, opacity: 0.95 }
  }
  if (state.movable === false) {
    return { fill: '#aa55552e', stroke: '#943c3c', strokeWidth: 1, opacity: 1 }
  }
  return { fill: '#4848bdcc', stroke: '#2a2a8d', strokeWidth: 1, opacity: 0.85 }
}

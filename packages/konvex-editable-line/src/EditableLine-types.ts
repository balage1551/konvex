import type { Vector2d } from '@balage1551/konvex'
import type { KonvexGroupConfig } from '@balage1551/konvex'
import type { KonvexLineConfig, LineProjectionScope } from '@balage1551/konvex'
import type { SimplificationThreshold } from '@balage1551/konvex'

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
  /** Which part of the line to project onto (default `'internal'`). */
  scope?: LineProjectionScope
  /** Snap the insertion point to the line when within this distance (world units). */
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

/**
 * EL sub-parts whose on-screen size can scale with zoom: the line's stroke, the
 * point markers, and the assist helpers (preview marker + guide lines).
 */
export type ScalableComponent = 'line' | 'marker' | 'helper'
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

  /**
   * Which parts scale with zoom; the rest keep a constant on-screen size.
   * `'line'` ties to the geometry's stroke width, `'marker'`/`'helper'` to the
   * node size. Default `['line']` — geometry stroke scales, editing chrome stays
   * constant.
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

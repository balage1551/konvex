import type { KonvexStage } from '../KonvexStage'
import type { KonvexLayer } from '../KonvexLayer'
import type { Vector2d } from '../KonvexTypes'
import type { KonvexBase } from '../KonvexBase'
import type { KeyScheme } from '../KonvexKeyboard'

/** World content extent in world units. */
export interface ContentSize {
  width: number
  height: number
}

/**
 * How the world rect (frame + scroll extent) relates to the content and the
 * specified `contentSize`:
 * - `free`    — world = the minimal bounding box of the contents.
 * - `elastic` — world = that bbox, but never smaller than `contentSize`.
 * - `clipped` — world = `contentSize`; content outside it is clipped away.
 * - `bounded` — world = `contentSize`; dragging keeps each object inside it.
 */
export type WorldMode = 'free' | 'elastic' | 'clipped' | 'bounded'

/** How `zoomIn`/`zoomOut` and snapping resolve the zoom grid. */
export type ZoomMode = 'steps' | 'proportional'
/** Whether the proportional grid is arithmetic (`+step`) or geometric (`×step`). */
export type ZoomStepType = 'additive' | 'multiplicative'

export interface KonvexStageProps {
  /** How the world rect relates to content + `contentSize`. */
  worldMode?: WorldMode
  /** The specified content extent in world units (used by all modes except free). */
  contentSize?: ContentSize | 'auto'
  /** Current zoom (use with `v-model:zoomLevel`). */
  zoomLevel?: number
  /** `'steps'` (explicit list) or `'proportional'` (generated grid). */
  zoomMode?: ZoomMode
  /** Explicit zoom grid for `'steps'` mode. */
  zoomLevels?: number[]
  /** Grid increment for `'proportional'` mode (`+step` or `×step`). */
  zoomStep?: number
  zoomStepType?: ZoomStepType
  /** Grid anchor for `'proportional'` mode (default 1 = 100%). */
  zoomBase?: number
  /** Lower bound: a number, or `'fit'` (can't zoom out past contain-fit). */
  minZoom?: number | 'fit'
  maxZoom?: number
  /** Enable ctrl+wheel / pinch zoom. */
  zoomOnWheel?: boolean
  /** CSS background of the viewport. */
  background?: string
  /** Turn keyboard support on/off as a whole (default on). */
  keyboard?: boolean
  /**
   * Where keystrokes are caught: `'focus'` (default) — only while the stage has
   * focus (it takes it on pointer-down); `'window'` — anywhere on the page
   * except editable fields.
   */
  keyboardScope?: KeyboardScope
  /**
   * A complete key scheme (full key name → binding). When set it replaces the
   * registered defaults: keys it doesn't mention are unbound. Spread
   * `defaultKeyScheme()` into it to start from the defaults.
   */
  keyScheme?: KeyScheme
  /** Per-key overrides on top of the scheme/defaults; an empty binding turns a key (or group) off. */
  keyBindings?: KeyScheme
  /** The host-owned selection that keyboard actions (e.g. `core.selection.move.*`) act on. */
  selection?: readonly KonvexBase[]
  /** Keyboard movement step in world units: fine moves step 1×, normal moves 20×. Default 1. */
  movementUnit?: number
  /**
   * How long (ms) a key sequence (`'Ctrl+K, T'`) waits for its next stroke.
   * When the prefix is also a binding on its own, that binding runs on timeout.
   * `0` = wait indefinitely. Default 1000.
   */
  chordTimeout?: number
}

/** Where a stage catches keystrokes. */
export type KeyboardScope = 'focus' | 'window'

/** The interface exposed via a template ref (`defineExpose`). */
export interface KonvexStageExpose {
  /** The owned stage (escape hatch). */
  readonly stage: KonvexStage | undefined
  /** Transformed content layer — add your shapes/groups here. */
  readonly world: KonvexLayer | undefined
  /** Unscaled screen-space layer for adornments (handles, rulers). */
  readonly overlay: KonvexLayer | undefined
  /** Live zoom level. */
  readonly zoomLevel: number
  /** Live measurement scale (real units per world unit). */
  readonly scale: number
  /** World coordinate under the current pointer (e.g. the cursor), or null. */
  pointerWorld(): Vector2d | null
  /** Convert a world length / area to real units via `scale`. */
  scaledLength(worldLength: number): number
  scaledArea(worldArea: number): number
  zoomTo(level: number, anchor?: Vector2d): void
  zoomBy(factor: number, anchor?: Vector2d): void
  zoomIn(anchor?: Vector2d): void
  zoomOut(anchor?: Vector2d): void
  zoomToFit(): void
  zoomToFitX(): void
  zoomToFitY(): void
  resetZoom(): void
  scrollTo(x: number, y: number): void
  scrollBy(dx: number, dy: number): void
  /**
   * Move nodes by `delta` world units as one user edit: respects `bounded` mode
   * (each node is clamped inside the world) and re-sizes a free/elastic world.
   */
  moveNodes(nodes: readonly KonvexBase[], delta: Vector2d): void
  /**
   * Tell the stage the content geometry changed outside a drag (e.g. points
   * moved programmatically) so a free/elastic world re-sizes to fit.
   */
  contentChanged(): void
  /** Convert a point in viewport (canvas) pixels to world units. */
  screenToWorld(p: Vector2d): Vector2d
  /** Convert a point in world units to viewport (canvas) pixels. */
  worldToScreen(p: Vector2d): Vector2d
}

export const DEFAULT_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]

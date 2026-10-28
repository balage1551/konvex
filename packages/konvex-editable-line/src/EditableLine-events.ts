// A tiny typed event emitter for EditableLine — decouples semantic signals
// (e.g. "the user asked for the toolbar") from raw Konva pointer events, so a
// Vue host can subscribe to `el.events.on('toolbar-request', …)` without
// reaching into the underlying stage. Deliberately minimal; no framework dep.
import type { KonvexListener, Vector2d } from '@balage1551/konvex'

/**
 * What a right-click landed on: a point's handle, or the line itself (an
 * arrowhead counts as the line). For the line, `segment` and `proportion` place
 * the click on it, from the line's body projection — `segment` is between
 * points `segment` and `segment + 1`, `proportion` the fraction along it.
 */
export type EditableLineHit = { kind: 'point'; index: number } | { kind: 'line'; segment: number; proportion: number }

/** Payload of a {@link EditableLineEventMap.toolbar-request}. */
export interface EditableLineToolbarRequest {
  /** Pointer position in client/viewport coordinates — for placing a popup. */
  pointerScreen: Vector2d
  /** Pointer position in the line's local/world space — for operations. */
  pointerWorld: Vector2d | null
  /** The selection at the moment the toolbar was requested. */
  selection: readonly number[]
  /**
   * What was right-clicked. Unlike `selection`, this names a point even when it
   * is not selectable. `null` only for a line hit whose pointer position could
   * not be read.
   */
  hit: EditableLineHit | null
}

/**
 * Who made an edit: `'user'` for a gesture on the line (a drag, a click or
 * double-click that adds a point, a toolbar item) or code run through
 * {@link EditableLine.asUser}; `'api'` for any other call into the editing
 * methods, and for every write to `line.points`.
 */
export type EditableLineEditSource = 'user' | 'api'

/**
 * A point joined or left the line.
 *
 * The line's points are what an `EditableLine` manages, so these are its
 * child-management events — Konva has none for a shape's geometry, and the
 * container signals an `EditableLine` inherits (`child-added` /
 * `child-removed`) describe its *internal* structure (the line, the assist
 * group, the handle group), not its points.
 */
export interface EditableLinePointChange {
  index: number
  /** Where the point is (added) or was (removed), in the line's coordinates. */
  point: Vector2d
  /** Point count *after* the change. */
  count: number
  source: EditableLineEditSource
}

/**
 * A point finished moving.
 *
 * One per moved point, once the move has landed — a drag reports on release, not
 * per frame, so this is safe to persist or push onto an undo stack. For the
 * drag as it happens, see {@link EditableLinePointDragStart} and its siblings.
 */
export interface EditableLinePointMove {
  index: number
  /** Where it is now. */
  point: Vector2d
  /** Where it was before the move — for a drag, where the drag started. */
  from: Vector2d
  source: EditableLineEditSource
}

/**
 * A handle drag began. `index` is the anchor — the point under the pointer —
 * and `indices` every point moving with it (the selection, or just the anchor).
 */
export interface EditableLinePointDragStart {
  index: number
  indices: readonly number[]
  /** The anchor's position when the drag started. */
  from: Vector2d
}

/** The anchor point moved during a drag. Once per frame, after the geometry is written. */
export interface EditableLinePointMoving {
  index: number
  /** The anchor's position now, axis constraints applied. */
  point: Vector2d
  /** The anchor's position when the drag started. */
  from: Vector2d
}

/**
 * A handle drag ended, emitted before that drag's `point-moved` events.
 *
 * `cancelled` is `true` when the drag was cut short rather than released: a
 * point was added or removed mid-drag, which destroys the dragged handle. `index`
 * is then the anchor's index at drag start and may no longer name that point;
 * `point` is where it was last reported.
 */
export interface EditableLinePointDragEnd {
  index: number
  point: Vector2d
  from: Vector2d
  cancelled: boolean
}

/**
 * Points were replaced wholesale rather than edited one at a time — a write to
 * `line.points`, or `simplify()`. Any index-keyed state a host holds is invalid;
 * re-read from `pointCount`/`pointInfos`. No per-point event accompanies this:
 * the old and new arrays cannot be told apart point-by-point without guessing.
 *
 * A write that arrives while a handle is being dragged is **deferred** to the drag
 * end (after that drag's `point-moved`), not dropped: the geometry takes it at
 * once, but the handles cannot move mid-drag without fighting Konva.
 */
export interface EditableLinePointsReplaced {
  count: number
  /**
   * `'user'` only for a `simplify()` the user asked for. A write to
   * `line.points` is always `'api'`: it is noticed after the fact, when the
   * code that made it is no longer running.
   */
  source: EditableLineEditSource
}

/** The discrete (non-Konva) events an {@link EditableLine} emits. */
export interface EditableLineEventMap {
  'toolbar-request': EditableLineToolbarRequest
  'point-added': EditableLinePointChange
  'point-removed': EditableLinePointChange
  'point-moved': EditableLinePointMove
  'point-drag-start': EditableLinePointDragStart
  'point-moving': EditableLinePointMoving
  'point-drag-end': EditableLinePointDragEnd
  'points-replaced': EditableLinePointsReplaced
}

/** @deprecated Alias of konvex's {@link KonvexListener}. */
export type EditableLineListener<T> = KonvexListener<T>

/**
 * The emitter behind {@link EditableLine.events}.
 *
 * konvex grew the same thing for its own signals (`destroy`, `child-added`, …),
 * so this is now that class rather than a second copy of it — and gains `once`
 * with the move.
 *
 * @deprecated Use {@link KonvexEmitter} directly; kept so existing annotations
 * keep compiling.
 */
export { KonvexEmitter as EditableLineEmitter } from '@balage1551/konvex'

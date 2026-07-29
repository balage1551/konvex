// A tiny typed event emitter for EditableLine — decouples semantic signals
// (e.g. "the user asked for the toolbar") from raw Konva pointer events, so a
// Vue host can subscribe to `el.events.on('toolbar-request', …)` without
// reaching into the underlying stage. Deliberately minimal; no framework dep.
import type { KonvexListener, Vector2d } from '@balage1551/konvex'

/** Payload of a {@link EditableLineEventMap.toolbar-request}. */
export interface EditableLineToolbarRequest {
  /** Pointer position in client/viewport coordinates — for placing a popup. */
  pointerScreen: Vector2d
  /** Pointer position in the line's local/world space — for operations. */
  pointerWorld: Vector2d | null
  /** The selection at the moment the toolbar was requested. */
  selection: readonly number[]
}

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
}

/**
 * A point finished moving.
 *
 * One per moved point, once the move has landed — a drag reports on release, not
 * per frame, so this is safe to persist or push onto an undo stack. (A streaming
 * `point-moving` counterpart may follow; it does not exist yet.)
 */
export interface EditableLinePointMove {
  index: number
  /** Where it is now. */
  point: Vector2d
  /** Where it was before the move — for a drag, where the drag started. */
  from: Vector2d
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
}

/** The discrete (non-Konva) events an {@link EditableLine} emits. */
export interface EditableLineEventMap {
  'toolbar-request': EditableLineToolbarRequest
  'point-added': EditableLinePointChange
  'point-removed': EditableLinePointChange
  'point-moved': EditableLinePointMove
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

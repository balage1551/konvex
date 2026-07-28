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

/** The discrete (non-Konva) events an {@link EditableLine} emits. */
export interface EditableLineEventMap {
  'toolbar-request': EditableLineToolbarRequest
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

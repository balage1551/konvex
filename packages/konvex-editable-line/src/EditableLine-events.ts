// A tiny typed event emitter for EditableLine — decouples semantic signals
// (e.g. "the user asked for the toolbar") from raw Konva pointer events, so a
// Vue host can subscribe to `el.events.on('toolbar-request', …)` without
// reaching into the underlying stage. Deliberately minimal; no framework dep.
import type { Vector2d } from '@balage1551/konvex'

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

export type EditableLineListener<T> = (payload: T) => void

/** Minimal typed multi-listener emitter. Returns an `off` fn from {@link on}. */
export class EditableLineEmitter<M> {
  private readonly _map = new Map<keyof M, Set<(p: unknown) => void>>()

  on<K extends keyof M>(name: K, listener: EditableLineListener<M[K]>): () => void {
    let set = this._map.get(name)
    if (!set) {
      set = new Set()
      this._map.set(name, set)
    }
    const fn = listener as (p: unknown) => void
    set.add(fn)
    return () => set!.delete(fn)
  }

  emit<K extends keyof M>(name: K, payload: M[K]): void {
    const set = this._map.get(name)
    if (!set) return
    // Snapshot so a listener that unsubscribes mid-dispatch is safe.
    for (const fn of [...set]) (fn as EditableLineListener<M[K]>)(payload)
  }

  clear(): void {
    this._map.clear()
  }
}

import { effectScope, shallowRef, type EffectScope, type ShallowRef } from 'vue'
import type Konva from 'konva'
import type { KonvexNode } from './KonvexNode'

export interface KonvexBaseConfig {
  /**
   * The logical owner of this object. For compound shapes (a future step) the
   * inner sub-shapes point their `owner` at the compound. Defaults to `this`.
   */
  owner?: KonvexBase
}

/**
 * The common ancestor of everything in konvex.
 *
 * It deliberately knows nothing about Konva nodes — that lives in
 * {@link KonvexNode}. Keeping `KonvexBase` node-agnostic is the seam that
 * will let *compound* shapes (built from several sub-shapes, a later step) sit
 * beside leaf shapes under one type.
 *
 * Its two real responsibilities are:
 *   - own an {@link EffectScope} that all of this object's watchers/effects run
 *     in, so they are torn down together on {@link destroy}; and
 *   - expose `konvaRoot()` — the single Konva node by which a parent attaches
 *     this object — uniformly for both leaves and (future) compounds.
 */
export abstract class KonvexBase {
  /**
   * Detached effect scope: konvex objects live outside any Vue component
   * `setup()`, so there is no `onUnmounted` to lean on — `scope.stop()` in
   * {@link destroy} is what cleans up every watcher created here.
   */
  readonly scope: EffectScope = effectScope(true)

  /** Logical owner; for a leaf shape this is itself. */
  readonly owner: KonvexBase

  /**
   * The container this object was added to (reactive; `undefined` when detached).
   * Set by {@link KonvexContainer.add}/cleared by `remove`. Lets a node walk its
   * ancestor chain — e.g. to read the cumulative scale for constant-size nodes.
   */
  readonly _parent: ShallowRef<KonvexNode<Konva.Node> | undefined> = shallowRef(undefined)

  /** The container this object is currently in, if any. */
  get parent(): KonvexNode<Konva.Node> | undefined {
    return this._parent.value
  }

  protected constructor(config: KonvexBaseConfig = {}) {
    this.owner = config.owner ?? this
  }

  /** The single Konva node a parent attaches — a leaf node or a Group. */
  abstract konvaRoot(): Konva.Node

  /**
   * Tear down: stop every effect in this object's scope, then destroy the
   * underlying Konva node (which recursively destroys descendants and removes
   * their event listeners).
   */
  destroy(): void {
    this.scope.stop()
    this.konvaRoot().destroy()
  }
}

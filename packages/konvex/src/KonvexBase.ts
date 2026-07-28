import { effectScope, onScopeDispose, shallowRef, type EffectScope, type ShallowRef } from 'vue'
import type Konva from 'konva'
import type { KonvexNode } from './KonvexNode'
import { bindKonvaEvent, type KonvaEventOptions } from './WrapperTools'
import { KonvexEmitter } from './KonvexEmitter'
import type { KonvexEventHandler, KonvexEventName, KonvexSignalMap } from './KonvexTypes'

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
   * konvex's own signals — `destroy`, and on a container `child-added` /
   * `child-removed`. Separate from `on(...)`, which is Konva's event system;
   * see {@link KonvexEmitter} for the split. Cleared on {@link destroy}.
   */
  readonly signals = new KonvexEmitter<KonvexSignalMap>()

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
   * Listen on **another** node, with this object's lifetime.
   *
   * The handler is removed when *this* object is destroyed, not when `target`
   * is — which is the whole point: a widget that must watch the stage (for a
   * pointer move outside itself, say) otherwise has to remember which stage it
   * attached to and detach by hand, and getting that wrong leaks a listener
   * onto a node that outlives the widget.
   *
   * `target` may be a konvex object or a raw Konva node, so this also covers
   * nodes konvex does not wrap. Several event names bind as one unit; the
   * returned `off` removes them all, as does `once` on first delivery.
   */
  bindTo<K extends KonvexEventName>(
    target: Konva.Node | KonvexBase,
    events: K | readonly K[],
    handler: KonvexEventHandler<K>,
    options?: KonvaEventOptions,
  ): () => void {
    const node = target instanceof KonvexBase ? target.konvaRoot() : target
    return bindKonvaEvent(node, this.scope, events, handler, options)
  }

  /**
   * Listen on a **DOM** target with this object's lifetime — the same deal as
   * {@link bindTo}, for the events Konva has no concept of.
   *
   * Keyboard is the usual reason: a canvas widget that needs modifier state or
   * shortcuts has to reach `window`, since Konva delivers no key events (and the
   * stage's container is not focusable). Doing that by hand means matching every
   * `addEventListener` with a `removeEventListener` in `destroy()`, which is the
   * same bookkeeping that leaked stage listeners before {@link bindTo} existed.
   *
   * Returns an `off`; the listener is also removed when this object is destroyed.
   */
  bindDom<K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    const listener = handler as EventListener
    target.addEventListener(type, listener, options)
    const off = () => target.removeEventListener(type, listener, options)
    this.scope.run(() => onScopeDispose(off))
    return off
  }

  /**
   * Drop `child` from this object's bookkeeping, touching nothing on the child
   * itself. A no-op for a leaf; {@link KonvexContainer} overrides it.
   *
   * Declared here rather than resolved with an `instanceof KonvexContainer` at
   * the call sites, because importing the container into this module would close
   * the cycle `KonvexBase → KonvexContainer → KonvexNode → KonvexBase` and leave
   * `class KonvexNode extends KonvexBase` reading an uninitialised binding.
   *
   * @internal
   */
  _releaseChild(_child: KonvexBase): void {}

  /**
   * Tear down: unregister from the parent, stop every effect in this object's
   * scope, then destroy the underlying Konva node (which recursively destroys
   * descendants and removes their event listeners).
   *
   * Unregistering matters as much as the teardown: a destroyed child left in its
   * parent's `children` is pinned in memory, reported as if it were live, and —
   * since nothing bumps `childrenVersion` — invisible to subtree watchers such as
   * the stage's auto-sizing and measurement-scale propagation.
   */
  destroy(): void {
    // Before anything is torn down, so a listener can still read this object.
    this.signals.emit('destroy', { node: this })
    const parent = this._parent.value
    if (parent) {
      parent._releaseChild(this)
      this._parent.value = undefined
    }
    this.scope.stop()
    this.konvaRoot().destroy()
    this.signals.clear()
  }
}

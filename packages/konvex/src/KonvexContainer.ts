import { ref } from 'vue'
import type Konva from 'konva'
import { KonvexNode, type KonvexNodeConfig } from './KonvexNode'
import type { KonvexBase } from './KonvexBase'

export type KonvexContainerConfig = KonvexNodeConfig

/**
 * A node that holds children (Stage, Layer, and — later — Group).
 *
 * Children are tracked in a plain array; ordering maps to Konva's z-index.
 * Destruction cascades: destroying a container destroys its children (whose
 * own scopes and nodes then tear down).
 */
export abstract class KonvexContainer<
  T extends Konva.Container,
  Ch extends KonvexBase,
> extends KonvexNode<T> {
  protected readonly _children: Ch[] = []

  /**
   * Reactive version counter, bumped on every add/remove — here *and* in any
   * descendant container, since the bump bubbles up the ancestor chain (see
   * {@link bumpVersion}). Konva's own `add` event fires only on the immediate
   * parent, so this is how reactive consumers (e.g. a stage that auto-sizes
   * its world to its contents, or pushes its measurement scale down to every
   * shape) learn that anything in the subtree changed.
   */
  private readonly _version = ref(0)

  protected constructor(node: T, config: KonvexContainerConfig = {}) {
    super(node, config)
  }

  get children(): readonly Ch[] {
    return this._children
  }

  /** Reactive value that changes whenever a child is added or removed. */
  get childrenVersion(): number {
    return this._version.value
  }

  /** Add a child, optionally at a specific z-index. Re-parents if it has a parent. */
  add(child: Ch, index?: number): Ch {
    // Konva's own add() moves an already-parented node for us, but the previous
    // konvex parent would go on listing it — and a child sitting in two
    // `_children` arrays corrupts both: the old parent's destroy() would destroy
    // a child it no longer owns, and its remove() would rip the node out of us.
    // Adopting means taking it off the old list first. This also covers a re-add
    // to the same container, which would otherwise duplicate the entry.
    child._parent.value?._releaseChild(child)

    this._children.push(child)
    // Konva's add() accepts Group | Shape (and Stage accepts Layer); the
    // concrete subclasses constrain `Ch`, so the cast is safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._node.add(child.konvaRoot() as any)
    if (index !== undefined) {
      child.konvaRoot().zIndex(index)
    }
    child._parent.value = this as unknown as KonvexNode<Konva.Node>
    this.bumpVersion()
    this.signals.emit('child-added', { child, index: child.konvaRoot().zIndex() })
    return child
  }

  /** Remove a child from this container (without destroying it). */
  remove(child: Ch): void {
    if (!this._children.includes(child)) return
    this._releaseChild(child)
    child.konvaRoot().remove()
    child._parent.value = undefined
  }

  /**
   * Drop `child` from this container's list and tell watchers, leaving the Konva
   * node and the child's `_parent` alone — whoever called this owns those. Used
   * when a child is re-parented ({@link add}), removed, or destroys itself.
   *
   * @internal
   */
  override _releaseChild(child: KonvexBase): void {
    const i = (this._children as readonly KonvexBase[]).indexOf(child)
    if (i < 0) return
    this._children.splice(i, 1)
    this.bumpVersion()
    // Covers all three ways out — remove(), a re-parent, and a child destroying
    // itself — because each of them comes through here. A container's *own*
    // teardown does not: it empties the list first, so this returns above and
    // the subtree reports itself through one `destroy` per node instead.
    this.signals.emit('child-removed', { child })
  }

  /**
   * Bump this container's version and every ancestor container's.
   *
   * Without the bubbling, a watcher on an outer container (typically the
   * stage's world) never fires for a shape added to a nested group, so such
   * shapes would silently miss subtree-wide updates — e.g. the measurement
   * scale the stage pushes into every shape's `unitScale`, leaving their
   * `scaled*` values in raw pixels.
   */
  private bumpVersion(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let n: KonvexBase | undefined = this
    while (n) {
      if (n instanceof KonvexContainer) n._version.value++
      n = n.parent
    }
  }

  override destroy(): void {
    // Take the list and empty it *before* the cascade: each child's destroy()
    // now unregisters itself, which would otherwise splice this same array (and
    // bump the whole ancestor chain) once per child while we walk it. Emptied
    // first, each of those calls finds nothing and returns — so a container
    // teardown stays linear and reports as the single change it is.
    const children = [...this._children]
    this._children.length = 0
    for (const child of children) {
      child.destroy()
    }
    super.destroy()
  }
}

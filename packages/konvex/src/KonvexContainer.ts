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
   * Reactive version counter, bumped on every add, remove and reorder — here
   * *and* in any
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

  /**
   * A container's box is the union of its children's, so `clientRect` has to
   * follow the whole subtree — which is what it could not do while it depended
   * on a list of *this* node's Konva events: moving a child changes no attribute
   * here, so a group's box silently kept the value it had when the child was
   * added. Reading each child's own `clientRect` recurses (a child container
   * tracks its children in turn) and `childrenVersion` covers the list itself.
   */
  protected override trackGeometry(): void {
    void this.childrenVersion
    for (const child of this._children) {
      if (child instanceof KonvexNode) void child.clientRect.value
    }
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

    // Konva's add() accepts Group | Shape (and Stage accepts Layer); `Ch` is
    // bound to exactly that per subclass, so the cast only bridges the generic.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._node.add(child.konvaRoot() as any)
    if (index !== undefined) {
      child.konvaRoot().zIndex(index)
    }
    // Insert where Konva actually put it, rather than appending: `children` maps
    // to z-order, and pushing while Konva spliced the node to `index` left the
    // two disagreeing — so `children[i]` was not the i-th node on screen, and
    // anything indexing one against the other (a z-order control, a hit test)
    // silently addressed the wrong object. Read back rather than trusting
    // `index`, because Konva clamps an out-of-range one.
    this._children.splice(child.konvaRoot().zIndex(), 0, child)
    child._parent.value = this as unknown as KonvexNode<Konva.Node>
    this.bumpVersion()
    this.signals.emit('child-added', { child, index: child.konvaRoot().zIndex() })
    return child
  }

  /**
   * Sort `_children` into Konva's order — the single definition of what
   * `children` means. Sorting by Konva's own index rather than replaying the
   * move also *repairs* a list that a raw `node.zIndex(…)` on the Konva node had
   * knocked out of step.
   *
   * @internal
   */
  override _resyncChildOrder(): void {
    this._children.sort((a, b) => a.konvaRoot().zIndex() - b.konvaRoot().zIndex())
    this.bumpVersion()
  }

  /** @internal — see {@link KonvexBase._childOrderVersion}. */
  override get _childOrderVersion(): number {
    return this._version.value
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

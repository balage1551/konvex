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
   * Reactive version counter, bumped on every add/remove. Konva fires no
   * child-add event, so this is how reactive consumers (e.g. a stage that
   * auto-sizes its world to its contents) learn the child set changed.
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

  /** Add a child, optionally at a specific z-index. */
  add(child: Ch, index?: number): Ch {
    this._children.push(child)
    // Konva's add() accepts Group | Shape (and Stage accepts Layer); the
    // concrete subclasses constrain `Ch`, so the cast is safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._node.add(child.konvaRoot() as any)
    if (index !== undefined) {
      child.konvaRoot().zIndex(index)
    }
    child._parent.value = this as unknown as KonvexNode<Konva.Node>
    this._version.value++
    return child
  }

  /** Remove a child from this container (without destroying it). */
  remove(child: Ch): void {
    const i = this._children.indexOf(child)
    if (i >= 0) {
      this._children.splice(i, 1)
      child.konvaRoot().remove()
      child._parent.value = undefined
      this._version.value++
    }
  }

  override destroy(): void {
    // Snapshot first: each child's destroy() removes its Konva node, and we
    // clear our own list rather than mutating it mid-iteration.
    for (const child of [...this._children]) {
      child.destroy()
    }
    this._children.length = 0
    super.destroy()
  }
}

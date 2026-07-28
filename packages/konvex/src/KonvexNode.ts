import {
  computed,
  markRaw,
  ref,
  watch,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from 'vue'
import type Konva from 'konva'
import { KonvexBase, type KonvexBaseConfig } from './KonvexBase'
import { nodeAttr, numberAttr, vectorParam, type KonvaEventOptions } from './WrapperTools'
import { registerKonvexNode, unregisterKonvexNode } from './KonvexRegistry'
import type {
  AttrSource,
  DragBoundFunc,
  GlobalCompositeOperation,
  KonvexEventHandler,
  KonvexEventName,
  NumberParameter,
  Vector2d,
  VectorParameter,
} from './KonvexTypes'

export interface KonvexNodeConfig extends KonvexBaseConfig {
  x?: AttrSource<NumberParameter>
  y?: AttrSource<NumberParameter>
  width?: AttrSource<NumberParameter>
  height?: AttrSource<NumberParameter>
  offsetX?: AttrSource<NumberParameter>
  offsetY?: AttrSource<NumberParameter>
  rotation?: AttrSource<NumberParameter>
  scaleX?: AttrSource<NumberParameter>
  scaleY?: AttrSource<NumberParameter>
  skewX?: AttrSource<NumberParameter>
  skewY?: AttrSource<NumberParameter>
  opacity?: AttrSource<NumberParameter>
  visible?: AttrSource<boolean>
  draggable?: AttrSource<boolean>
  dragDistance?: AttrSource<NumberParameter>
  dragBoundFunc?: AttrSource<DragBoundFunc | undefined>
  listening?: AttrSource<boolean>
  globalCompositeOperation?: AttrSource<GlobalCompositeOperation>
  id?: AttrSource<string>
  name?: AttrSource<string>
  /** When `false`, the node keeps a constant on-screen size at any zoom. */
  scalable?: boolean
}

/** Node attributes that {@link KonvexNode} binds generically from config. */
export const NODE_ATTR_KEYS = [
  'x',
  'y',
  'width',
  'height',
  'offsetX',
  'offsetY',
  'rotation',
  'scaleX',
  'scaleY',
  'skewX',
  'skewY',
  'opacity',
  'visible',
  'draggable',
  'dragDistance',
  'dragBoundFunc',
  'listening',
  'globalCompositeOperation',
  'id',
  'name',
] as const

/**
 * A konvex object that wraps exactly one Konva node and exposes its common
 * transform/visibility attributes as reactive refs.
 *
 * Every attribute is a {@link nodeAttr} ref backed by the live Konva value, so
 * each one can be assigned a static value *or* a reference. `x`/`y` are also
 * wired to drag events so the refs stay in sync while the user drags the node.
 */
export abstract class KonvexNode<T extends Konva.Node> extends KonvexBase {
  /** The wrapped Konva node. `markRaw` keeps Vue from ever proxying it. */
  protected readonly _node: T

  // --- transform / common attributes (writable, value-or-reference) ---
  // Numeric attributes also accept a NumberParameter alteration rule on write
  // (e.g. `{ mode: 'by', value: 5 }`, `{ mode: 'reset' }`).
  readonly x: Ref<number, AttrSource<NumberParameter>>
  readonly y: Ref<number, AttrSource<NumberParameter>>
  readonly width: Ref<number, AttrSource<NumberParameter>>
  readonly height: Ref<number, AttrSource<NumberParameter>>
  readonly offsetX: Ref<number, AttrSource<NumberParameter>>
  readonly offsetY: Ref<number, AttrSource<NumberParameter>>
  readonly rotation: Ref<number, AttrSource<NumberParameter>>
  readonly scaleX: Ref<number, AttrSource<NumberParameter>>
  readonly scaleY: Ref<number, AttrSource<NumberParameter>>
  readonly skewX: Ref<number, AttrSource<NumberParameter>>
  readonly skewY: Ref<number, AttrSource<NumberParameter>>
  readonly opacity: Ref<number, AttrSource<NumberParameter>>
  readonly visible: Ref<boolean, AttrSource<boolean>>
  readonly draggable: Ref<boolean, AttrSource<boolean>>
  readonly dragDistance: Ref<number, AttrSource<NumberParameter>>
  readonly dragBoundFunc: Ref<DragBoundFunc | undefined, AttrSource<DragBoundFunc | undefined>>
  readonly listening: Ref<boolean, AttrSource<boolean>>
  readonly globalCompositeOperation: Ref<
    GlobalCompositeOperation,
    AttrSource<GlobalCompositeOperation>
  >
  readonly id: Ref<string | undefined, AttrSource<string | undefined>>
  readonly name: Ref<string | undefined, AttrSource<string | undefined>>

  /**
   * When `false`, the node keeps a constant on-screen size regardless of zoom:
   * its own scale is driven to the reciprocal of the cumulative ancestor scale,
   * while its position (and hence its local origin) stays fixed in world space.
   *
   * While `false`, {@link scaleX}/{@link scaleY} are konvex's to set: a scale
   * written from anywhere else (a `Konva.Transformer`, say) is reverted on the
   * next flush. Set this back to `true` to take the scale over.
   */
  readonly scalable: Ref<boolean> = ref(true)

  // --- composite views over the scalars above (accept a VectorParameter) ---
  readonly position: WritableComputedRef<Vector2d, VectorParameter>
  readonly size: WritableComputedRef<Vector2d, VectorParameter>
  readonly scale: WritableComputedRef<Vector2d, VectorParameter>
  readonly skew: WritableComputedRef<Vector2d, VectorParameter>
  readonly offset: WritableComputedRef<Vector2d, VectorParameter>

  /**
   * Cumulative (absolute) scale: the parent's effective scale times this node's
   * own scale. Defined recursively, so Vue memoizes each ancestor's value and a
   * scale change only recomputes the affected sub-chain.
   */
  readonly effectiveScaleX: ComputedRef<number>
  readonly effectiveScaleY: ComputedRef<number>

  /**
   * Measurement scale: real-world units per world unit (default 1). Shapes'
   * `scaled*` fields (e.g. {@link KonvexShape}'s subclasses) derive from it.
   * Named `unitScale` to avoid colliding with the transform {@link scale}.
   *
   * *Inherited*, like {@link effectiveScaleX}: a node with no scale of its own
   * reads its parent's, up to whichever ancestor originates one (typically the
   * stage's world, from its `scale` prop). Because the lookup is a pull rather
   * than a value pushed down at add-time, a shape gets the right scale the
   * instant it is attached — at any depth, in any order, and again on reparent.
   *
   * Writing pins this node's own scale, overriding what it would inherit, and
   * that becomes the value its descendants inherit in turn. Pass `undefined` to
   * unpin and go back to inheriting.
   */
  readonly unitScale: WritableComputedRef<number, number | undefined>

  /**
   * This node's index among its parent's children — its **z-order**: 0 is drawn
   * first (at the back), the last index on top. `0` when it has no parent.
   *
   * Reactive: it follows the parent's `childrenVersion`, so it re-reads when a
   * sibling is added, removed or reordered, not just when this node moves.
   * Change it with {@link setZIndex} or the `move*` methods.
   */
  readonly zIndex: ComputedRef<number>

  /**
   * The node's bounding box in its parent's coordinate space — a value that
   * flows Konva → Vue but cannot be set.
   *
   * Re-read whenever anything that moves the box changes: every attribute of
   * this node's own transform, plus whatever {@link trackGeometry} adds for this
   * kind of node — a container's whole subtree, a line's points.
   */
  readonly clientRect: ComputedRef<{ x: number; y: number; width: number; height: number }>

  protected constructor(node: T, config: KonvexNodeConfig = {}) {
    super(config)
    this._node = markRaw(node)
    // Publish the reverse link before anything can dispatch an event, so a
    // handler can always resolve `event.target` back to its wrapper.
    registerKonvexNode(node, this as unknown as KonvexNode<Konva.Node>)

    // Every attribute below is two-way: `nodeAttr` re-triggers the ref from
    // Konva's `<attr>Change`, so a drag, a `Konva.Transformer`, a tween or a
    // direct `node.rotation(45)` all invalidate it — not just our own setter.
    // (Binding x/y to an *external* writable ref and pushing drag results back
    // into it is a later refinement; here drag keeps our own refs and any
    // read-only views live.)
    this.x = numberAttr(node, 'x', this.scope)
    this.y = numberAttr(node, 'y', this.scope)
    this.width = numberAttr(node, 'width', this.scope, { constraints: { min: 0 } })
    this.height = numberAttr(node, 'height', this.scope, { constraints: { min: 0 } })
    this.offsetX = numberAttr(node, 'offsetX', this.scope)
    this.offsetY = numberAttr(node, 'offsetY', this.scope)
    this.rotation = numberAttr(node, 'rotation', this.scope)
    // Scale composes multiplicatively: `{ mode: 'by', value: 1.1 }` scales up 10%.
    this.scaleX = numberAttr(node, 'scaleX', this.scope, {
      changeMode: 'multiply',
      constraints: { round: 5 },
    })
    this.scaleY = numberAttr(node, 'scaleY', this.scope, {
      changeMode: 'multiply',
      constraints: { round: 5 },
    })
    this.skewX = numberAttr(node, 'skewX', this.scope)
    this.skewY = numberAttr(node, 'skewY', this.scope)
    this.opacity = numberAttr(node, 'opacity', this.scope, {
      defaultValue: 1,
      constraints: { min: 0, max: 1, round: 3 },
    })
    this.visible = nodeAttr(node, 'visible', this.scope)
    this.draggable = nodeAttr(node, 'draggable', this.scope)
    this.dragDistance = numberAttr(node, 'dragDistance', this.scope)
    // dragBoundFunc's *value* is a function, so it must not be read as a getter.
    this.dragBoundFunc = nodeAttr(node, 'dragBoundFunc', this.scope, { valueIsFunction: true })
    this.listening = nodeAttr(node, 'listening', this.scope)
    this.globalCompositeOperation = nodeAttr(node, 'globalCompositeOperation', this.scope)
    this.id = nodeAttr(node, 'id', this.scope)
    this.name = nodeAttr(node, 'name', this.scope)

    this.position = vectorParam(this.x, this.y)
    this.size = vectorParam(this.width, this.height)
    this.scale = vectorParam(this.scaleX, this.scaleY)
    this.skew = vectorParam(this.skewX, this.skewY)
    this.offset = vectorParam(this.offsetX, this.offsetY)

    this.effectiveScaleX = computed(
      () => (this._parent.value?.effectiveScaleX.value ?? 1) * this.scaleX.value,
    )
    this.effectiveScaleY = computed(
      () => (this._parent.value?.effectiveScaleY.value ?? 1) * this.scaleY.value,
    )

    // Same recursive shape as effectiveScale above, minus the accumulation: a
    // measurement scale is inherited verbatim, not multiplied down the chain.
    const ownUnitScale = ref<number | undefined>(undefined)
    this.unitScale = computed({
      get: () => ownUnitScale.value ?? this._parent.value?.unitScale.value ?? 1,
      set: v => {
        ownUnitScale.value = v
      },
    })

    this.zIndex = computed(() => {
      // The parent owns the order, so its version is the dependency; without a
      // parent Konva reports 0 and there is nothing to track.
      void this._parent.value?._childOrderVersion
      return node.zIndex()
    })

    // Depends on the refs rather than a hand-kept list of Konva event names: the
    // refs already invalidate from `<attr>Change` (whoever wrote them), so this
    // follows a drag, a Transformer and a direct Konva write alike — and cannot
    // drift out of step with the attribute list the way a literal list does.
    // `trackGeometry` adds whatever else moves the box for this kind of node.
    this.clientRect = computed(() => {
      void this.x.value
      void this.y.value
      void this.width.value
      void this.height.value
      void this.offsetX.value
      void this.offsetY.value
      void this.scaleX.value
      void this.scaleY.value
      void this.skewX.value
      void this.skewY.value
      void this.rotation.value
      // Visibility, for the *parent's* sake: Konva skips an invisible child when
      // it unions a container's box (`Container.getClientRect`), while a shape's
      // own box ignores its visibility. So hiding a child changes nothing here
      // but shrinks the box above — and a container reaches that through this
      // ref, since it depends on its children's `clientRect`. Transient
      // adornments (an assist marker, a rubber band) inflate an ancestor's box
      // while shown and must restore it when hidden.
      void this.visible.value
      this.trackGeometry()
      return node.getClientRect({ skipShadow: true })
    })

    this.applyConfig(config, NODE_ATTR_KEYS)
    if (config.scalable !== undefined) this.scalable.value = config.scalable

    // Constant-size support. The ancestor (cumulative) scale is just the parent's
    // effective scale; when `scalable` is false we drive our own scale to its
    // reciprocal, so this node's absolute scale stays 1 (constant on screen).
    // Reads are memoized via the effectiveScale chain, so this re-runs only when
    // an actual ancestor scale changes, or when the node is (re)parented.
    //
    // Our own scale is a dependency too, so a write from outside (a
    // `Konva.Transformer` resizing us, say) is re-asserted instead of silently
    // holding until the next ancestor change. It settles in one extra pass: the
    // corrective write lands on the value the watch just computed, and writing a
    // number equal to the live one is dropped by `numberAttr`. Reading it only
    // while compensating keeps a normal (scalable) node from subscribing to its
    // own scale for nothing.
    const ancestorScaleX = computed(() => this._parent.value?.effectiveScaleX.value ?? 1)
    const ancestorScaleY = computed(() => this._parent.value?.effectiveScaleY.value ?? 1)
    // The scale from before compensation started, so `scalable` can be switched
    // back. Without it, turning it off and on again left the node wearing the
    // reciprocal of some past ancestor scale — a one-way door dressed as a toggle.
    let uncompensated: Vector2d | undefined
    this.scope.run(() =>
      watch(
        [
          this.scalable,
          ancestorScaleX,
          ancestorScaleY,
          () => (this.scalable.value ? 1 : this.scaleX.value),
          () => (this.scalable.value ? 1 : this.scaleY.value),
        ],
        ([scalable, sx, sy]) => {
          if (!scalable) {
            uncompensated ??= { x: this.scaleX.value, y: this.scaleY.value }
            this.scaleX.value = sx ? 1 / sx : 1
            this.scaleY.value = sy ? 1 / sy : 1
          } else if (uncompensated) {
            const restore = uncompensated
            uncompensated = undefined
            this.scaleX.value = restore.x
            this.scaleY.value = restore.y
          }
        },
        { immediate: true },
      ),
    )
  }

  /**
   * Push config values into the matching attribute refs. Because the refs
   * accept an {@link AttrSource}, a config value may itself be a ref/getter and
   * the binding is set up automatically.
   */
  protected applyConfig(config: KonvexNodeConfig, keys: readonly string[]): void {
    for (const key of keys) {
      const source = (config as Record<string, unknown>)[key]
      if (source !== undefined) {
        ;(this as unknown as Record<string, Ref<unknown>>)[key].value = source
      }
    }
  }

  /**
   * Read whatever *else* determines this node's bounding box, so {@link clientRect}
   * re-reads when it changes. Called from inside that computed, so reading a ref
   * here is all it takes to become a dependency.
   *
   * The base implementation is empty: {@link clientRect} already follows every
   * attribute of the node's own transform. Override it where the box depends on
   * more — a container's children ({@link KonvexContainer}), or a shape whose
   * geometry lives in its own attributes ({@link KonvexLine}'s `points`).
   */
  protected trackGeometry(): void {}

  /** The wrapped Konva node (escape hatch for direct Konva calls). */
  konvaRoot(): T {
    return this._node
  }

  /**
   * Also drops the node → wrapper link, so {@link konvexOf} never hands out a
   * destroyed wrapper (and a Konva node a host kept a reference to stops
   * retaining one).
   */
  override destroy(): void {
    unregisterKonvexNode(this._node)
    super.destroy()
  }

  /**
   * Alias of {@link konvaRoot} that reads better at call sites — "give me the raw
   * node".
   *
   * It does **not** detach anything: the node stays exactly where it is, in its
   * parent, and this hands you a reference to it. Use `parent.remove(node)` to
   * actually take it out of the tree.
   */
  detach(): T {
    return this._node
  }

  /**
   * The pointer (cursor / active touch) in **stage** coordinates — canvas
   * pixels, before any world transform — or `null` when the node is not on a
   * stage or no pointer has been seen yet.
   *
   * A copy, not Konva's live pointer object, so writing to it is harmless.
   */
  pointerPosition(): Vector2d | null {
    const p = this._node.getStage()?.getPointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }

  /**
   * The pointer in **this node's own** coordinate space, `null` under the same
   * conditions as {@link pointerPosition}.
   *
   * This is the one to use inside a handler: read it on the node whose geometry
   * you are about to compare against, and zoom, scroll, group transforms and
   * the world origin are all already accounted for. On the stage's world layer
   * it is the world coordinate.
   */
  relativePointerPosition(): Vector2d | null {
    return this._node.getRelativePointerPosition()
  }

  // --- z-order --------------------------------------------------------------
  // Konva's own z-order methods reorder the parent's Konva children, which would
  // leave konvex's `children` (and so `childrenVersion`) behind. These do the
  // move and then have the parent re-sort itself, so the two never disagree.
  // Each returns whether anything actually moved, as Konva's do.

  /**
   * Move to `index` among its siblings, clamped to the valid range — Konva warns
   * and clamps for an out-of-range value; this clamps quietly. Returns the index
   * it ended up at.
   */
  setZIndex(index: number): number {
    const parent = this._parent.value
    if (!parent) return this._node.zIndex()
    const last = this._node.getParent()!.getChildren().length - 1
    const target = Math.max(0, Math.min(Math.round(index), last))
    if (target !== this._node.zIndex()) {
      this._node.zIndex(target)
      parent._resyncChildOrder()
    }
    return this._node.zIndex()
  }

  /** Bring to the front of its siblings. `false` if it was already there. */
  moveToTop(): boolean {
    return this.reorder(() => this._node.moveToTop())
  }

  /** Send to the back of its siblings. `false` if it was already there. */
  moveToBottom(): boolean {
    return this.reorder(() => this._node.moveToBottom())
  }

  /** One step towards the front. `false` if it was already at the front. */
  moveUp(): boolean {
    return this.reorder(() => this._node.moveUp())
  }

  /** One step towards the back. `false` if it was already at the back. */
  moveDown(): boolean {
    return this.reorder(() => this._node.moveDown())
  }

  /**
   * Run a Konva z-order move and resync the parent if it changed anything. The
   * parent check is ours rather than Konva's, which warns on the console for a
   * parentless node — moving one is a no-op, not a mistake.
   */
  private reorder(move: () => boolean): boolean {
    const parent = this._parent.value
    if (!parent) return false
    const moved = move()
    if (moved) parent._resyncChildOrder()
    return moved
  }

  /**
   * Register a typed Konva event handler. Event names are restricted to the
   * known {@link KonvexEventName}s and the handler's `event.evt` is typed for
   * them. Returns an `off` function; the handler is also removed automatically
   * when this object is destroyed.
   *
   * Pass an array to bind one handler to several events as a unit — the pairs
   * that mean the same gesture on different devices, typically:
   *
   * ```ts
   * shape.on(['click', 'tap'], e => select(konvexOf(e.target)))
   * ```
   */
  on<K extends KonvexEventName>(
    events: K | readonly K[],
    handler: KonvexEventHandler<K>,
    options?: KonvaEventOptions,
  ): () => void {
    return this.bindTo(this._node, events, handler, options)
  }

  /** {@link on}, removed after the first delivery of any of `events`. */
  once<K extends KonvexEventName>(
    events: K | readonly K[],
    handler: KonvexEventHandler<K>,
  ): () => void {
    return this.on(events, handler, { once: true })
  }

  // --- typed per-event convenience handlers --------------------------------
  // Sugar over `on(...)`; the point of the redundancy is the strictly-typed
  // handler parameter (no need to spell the event name as a string literal).
  onClick(handler: KonvexEventHandler<'click'>): () => void {
    return this.on('click', handler)
  }
  onDblClick(handler: KonvexEventHandler<'dblclick'>): () => void {
    return this.on('dblclick', handler)
  }
  onContextMenu(handler: KonvexEventHandler<'contextmenu'>): () => void {
    return this.on('contextmenu', handler)
  }
  onMouseDown(handler: KonvexEventHandler<'mousedown'>): () => void {
    return this.on('mousedown', handler)
  }
  onMouseUp(handler: KonvexEventHandler<'mouseup'>): () => void {
    return this.on('mouseup', handler)
  }
  onMouseMove(handler: KonvexEventHandler<'mousemove'>): () => void {
    return this.on('mousemove', handler)
  }
  onMouseEnter(handler: KonvexEventHandler<'mouseenter'>): () => void {
    return this.on('mouseenter', handler)
  }
  onMouseLeave(handler: KonvexEventHandler<'mouseleave'>): () => void {
    return this.on('mouseleave', handler)
  }
  onMouseOver(handler: KonvexEventHandler<'mouseover'>): () => void {
    return this.on('mouseover', handler)
  }
  onMouseOut(handler: KonvexEventHandler<'mouseout'>): () => void {
    return this.on('mouseout', handler)
  }
  onWheel(handler: KonvexEventHandler<'wheel'>): () => void {
    return this.on('wheel', handler)
  }
  onGotPointerCapture(handler: KonvexEventHandler<'gotpointercapture'>): () => void {
    return this.on('gotpointercapture', handler)
  }
  onLostPointerCapture(handler: KonvexEventHandler<'lostpointercapture'>): () => void {
    return this.on('lostpointercapture', handler)
  }
  onTap(handler: KonvexEventHandler<'tap'>): () => void {
    return this.on('tap', handler)
  }
  onDblTap(handler: KonvexEventHandler<'dbltap'>): () => void {
    return this.on('dbltap', handler)
  }
  onTouchStart(handler: KonvexEventHandler<'touchstart'>): () => void {
    return this.on('touchstart', handler)
  }
  onTouchMove(handler: KonvexEventHandler<'touchmove'>): () => void {
    return this.on('touchmove', handler)
  }
  onTouchEnd(handler: KonvexEventHandler<'touchend'>): () => void {
    return this.on('touchend', handler)
  }
  onTouchEnter(handler: KonvexEventHandler<'touchenter'>): () => void {
    return this.on('touchenter', handler)
  }
  onTouchLeave(handler: KonvexEventHandler<'touchleave'>): () => void {
    return this.on('touchleave', handler)
  }
  onTouchOver(handler: KonvexEventHandler<'touchover'>): () => void {
    return this.on('touchover', handler)
  }
  onTouchOut(handler: KonvexEventHandler<'touchout'>): () => void {
    return this.on('touchout', handler)
  }
  onPointerDown(handler: KonvexEventHandler<'pointerdown'>): () => void {
    return this.on('pointerdown', handler)
  }
  onPointerUp(handler: KonvexEventHandler<'pointerup'>): () => void {
    return this.on('pointerup', handler)
  }
  onPointerMove(handler: KonvexEventHandler<'pointermove'>): () => void {
    return this.on('pointermove', handler)
  }
  onPointerEnter(handler: KonvexEventHandler<'pointerenter'>): () => void {
    return this.on('pointerenter', handler)
  }
  onPointerLeave(handler: KonvexEventHandler<'pointerleave'>): () => void {
    return this.on('pointerleave', handler)
  }
  onPointerOver(handler: KonvexEventHandler<'pointerover'>): () => void {
    return this.on('pointerover', handler)
  }
  onPointerOut(handler: KonvexEventHandler<'pointerout'>): () => void {
    return this.on('pointerout', handler)
  }
  onPointerClick(handler: KonvexEventHandler<'pointerclick'>): () => void {
    return this.on('pointerclick', handler)
  }
  onPointerDblClick(handler: KonvexEventHandler<'pointerdblclick'>): () => void {
    return this.on('pointerdblclick', handler)
  }
  onDragStart(handler: KonvexEventHandler<'dragstart'>): () => void {
    return this.on('dragstart', handler)
  }
  onDragMove(handler: KonvexEventHandler<'dragmove'>): () => void {
    return this.on('dragmove', handler)
  }
  onDragEnd(handler: KonvexEventHandler<'dragend'>): () => void {
    return this.on('dragend', handler)
  }
  onTransformStart(handler: KonvexEventHandler<'transformstart'>): () => void {
    return this.on('transformstart', handler)
  }
  onTransform(handler: KonvexEventHandler<'transform'>): () => void {
    return this.on('transform', handler)
  }
  onTransformEnd(handler: KonvexEventHandler<'transformend'>): () => void {
    return this.on('transformend', handler)
  }
}

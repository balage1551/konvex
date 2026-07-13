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
import {
  bindKonvaEvent,
  nodeAttr,
  numberAttr,
  readonlyNodeAttr,
  vectorParam,
} from './WrapperTools'
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
   * Read-only example: the node's bounding box in its parent's coordinate
   * space. Recomputed whenever the node moves, resizes, or transforms — a
   * demonstration of a value that flows Konva → Vue but can't be set.
   */
  readonly clientRect: Readonly<Ref<{ x: number; y: number; width: number; height: number }>>

  protected constructor(node: T, config: KonvexNodeConfig = {}) {
    super(config)
    this._node = markRaw(node)

    // Position is two-way: a drag mutates x/y inside Konva, so we re-read on
    // drag events. (Binding x/y to an *external* writable ref and pushing drag
    // results back into it is a later refinement; here drag keeps our own refs
    // and any read-only views live.)
    this.x = numberAttr(node, 'x', this.scope, { syncOn: ['dragmove', 'dragend'] })
    this.y = numberAttr(node, 'y', this.scope, { syncOn: ['dragmove', 'dragend'] })
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

    this.clientRect = readonlyNodeAttr(node, {
      read: n => n.getClientRect({ skipShadow: true }),
      syncOn: [
        'dragmove',
        'dragend',
        'xChange',
        'yChange',
        'widthChange',
        'heightChange',
        'scaleXChange',
        'scaleYChange',
        'rotationChange',
      ],
    })

    this.applyConfig(config, NODE_ATTR_KEYS)
    if (config.scalable !== undefined) this.scalable.value = config.scalable

    // Constant-size support. The ancestor (cumulative) scale is just the parent's
    // effective scale; when `scalable` is false we drive our own scale to its
    // reciprocal, so this node's absolute scale stays 1 (constant on screen).
    // Reads are memoized via the effectiveScale chain, so this re-runs only when
    // an actual ancestor scale changes, or when the node is (re)parented.
    const ancestorScaleX = computed(() => this._parent.value?.effectiveScaleX.value ?? 1)
    const ancestorScaleY = computed(() => this._parent.value?.effectiveScaleY.value ?? 1)
    this.scope.run(() =>
      watch(
        [this.scalable, ancestorScaleX, ancestorScaleY],
        ([scalable, sx, sy]) => {
          if (!scalable) {
            this.scaleX.value = sx ? 1 / sx : 1
            this.scaleY.value = sy ? 1 / sy : 1
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

  /** The wrapped Konva node (escape hatch for direct Konva calls). */
  konvaRoot(): T {
    return this._node
  }

  /** Alias of {@link konvaRoot} that reads better at call sites. */
  detach(): T {
    return this._node
  }

  /**
   * Register a typed Konva event handler. The event name is restricted to the
   * known {@link KonvexEventName}s and the handler's `event.evt` is typed for
   * that event. Returns an `off` function; the handler is also removed
   * automatically when this object is destroyed.
   */
  on<K extends KonvexEventName>(eventName: K, handler: KonvexEventHandler<K>): () => void {
    return bindKonvaEvent(this._node, this.scope, eventName, handler)
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
  onPointerDown(handler: KonvexEventHandler<'pointerdown'>): () => void {
    return this.on('pointerdown', handler)
  }
  onPointerUp(handler: KonvexEventHandler<'pointerup'>): () => void {
    return this.on('pointerup', handler)
  }
  onPointerMove(handler: KonvexEventHandler<'pointermove'>): () => void {
    return this.on('pointermove', handler)
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
}

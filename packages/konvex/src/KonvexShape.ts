import type { LineCap, LineJoin, Shape } from 'konva/lib/Shape'
import { computed, ref, type Ref, type WritableComputedRef } from 'vue'
import { KonvexNode, type KonvexNodeConfig } from './KonvexNode'
import { delegatableSetter, type Facet, nodeAttr, structuredFacet } from './WrapperTools'
import type { AttrSource, ColorStop, Fill, FillInput, FillPatternRepeat, Shadow, Stroke, Vector2d } from './KonvexTypes'

export interface KonvexShapeConfig extends KonvexNodeConfig {
  /** Fill: a colour string, a {@link Fill} union variant, or a reference to one. */
  fill?: AttrSource<FillInput | undefined>
  /** Whole-stroke object, or a reference to one. */
  stroke?: AttrSource<Stroke | undefined>
  /** Whole-shadow object, or a reference to one. */
  shadow?: AttrSource<Shadow | undefined>
  /**
   * When `false` (default), setting `fill` first clears every other Konva fill
   * cluster, so only the chosen variant remains. Set to `true` to keep Konva's
   * native behaviour, where all clusters coexist and `fillPriority` alone picks
   * what renders (e.g. a solid colour *and* a pattern).
   */
  allowMultipleFills?: boolean
  /** Canvas fill rule for self-intersecting paths. */
  fillRule?: AttrSource<CanvasFillRule | undefined>
  /** Paint the fill *after* the stroke (so fill sits on top). */
  fillAfterStrokeEnabled?: AttrSource<boolean>
  /** Stroke width used for hit detection (`'auto'` follows the visible width). */
  hitStrokeWidth?: AttrSource<number | 'auto'>
  /** Whether the stroke width scales with the shape. */
  strokeScaleEnabled?: AttrSource<boolean>
}

// ---------------------------------------------------------------------------
// Fill mapping: the discriminated `Fill` union <-> Konva's flat fill clusters.
// Konva keeps four independent fill clusters and renders the one named by
// `fillPriority`. We write the cluster that matches the variant and flip the
// priority; we read by inspecting the priority and rebuilding the variant.
// ---------------------------------------------------------------------------

function toKonvaStops(stops: ColorStop[]): (number | string)[] {
  const flat: (number | string)[] = []
  for (const stop of stops) flat.push(stop.offset, stop.color)
  return flat
}

function fromKonvaStops(flat: (number | string)[] | undefined): ColorStop[] {
  const stops: ColorStop[] = []
  if (flat) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      stops.push({ offset: flat[i] as number, color: flat[i + 1] as string })
    }
  }
  return stops
}

function readFill(node: Shape): Fill {
  switch (node.fillPriority()) {
    case 'linear-gradient':
      return {
        type: 'linearGradient',
        start: node.fillLinearGradientStartPoint(),
        end: node.fillLinearGradientEndPoint(),
        colorStops: fromKonvaStops(node.fillLinearGradientColorStops()),
      }
    case 'radial-gradient':
      return {
        type: 'radialGradient',
        start: node.fillRadialGradientStartPoint(),
        end: node.fillRadialGradientEndPoint(),
        startRadius: node.fillRadialGradientStartRadius(),
        endRadius: node.fillRadialGradientEndRadius(),
        colorStops: fromKonvaStops(node.fillRadialGradientColorStops()),
      }
    case 'pattern': {
      const image = node.fillPatternImage()
      return image
        ? {
            type: 'pattern',
            image,
            x: node.fillPatternX(),
            y: node.fillPatternY(),
            offset: node.fillPatternOffset(),
            scale: node.fillPatternScale(),
            rotation: node.fillPatternRotation(),
            repeat: node.fillPatternRepeat() as FillPatternRepeat,
          }
        : undefined
    }
    case 'color':
    default: {
      // Konva's fill() can also return a live CanvasGradient; we only model
      // plain colour strings as a solid fill.
      const color = node.fill()
      return typeof color === 'string' && color ? { type: 'solid', color } : undefined
    }
  }
}

/**
 * Reset every Konva fill cluster. Used when `replaceAllFills` is on so that
 * only the cluster we are about to write remains set.
 */
function clearFills(node: Shape): void {
  // Cast so we can call the setters with `undefined` (their typed signatures
  // only accept the value type; passing nothing would invoke the getter).
  const n = node as unknown as Record<string, (value: unknown) => void>
  n.fill(undefined)
  n.fillLinearGradientStartPoint(undefined)
  n.fillLinearGradientEndPoint(undefined)
  n.fillLinearGradientColorStops(undefined)
  n.fillRadialGradientStartPoint(undefined)
  n.fillRadialGradientEndPoint(undefined)
  n.fillRadialGradientStartRadius(undefined)
  n.fillRadialGradientEndRadius(undefined)
  n.fillRadialGradientColorStops(undefined)
  n.fillPatternImage(undefined)
}

function applyFill(node: Shape, value: FillInput | undefined, allowMultiple: boolean): void {
  if (!allowMultiple) clearFills(node)
  if (value == null) {
    if (allowMultiple) node.fill(undefined as unknown as string)
    node.fillPriority('color')
    return
  }
  if (typeof value === 'string') {
    node.fill(value)
    node.fillPriority('color')
    return
  }
  switch (value.type) {
    case 'solid':
      node.fill(value.color)
      node.fillPriority('color')
      break
    case 'linearGradient':
      node.fillLinearGradientStartPoint(value.start)
      node.fillLinearGradientEndPoint(value.end)
      node.fillLinearGradientColorStops(toKonvaStops(value.colorStops))
      node.fillPriority('linear-gradient')
      break
    case 'radialGradient':
      node.fillRadialGradientStartPoint(value.start)
      node.fillRadialGradientEndPoint(value.end)
      node.fillRadialGradientStartRadius(value.startRadius)
      node.fillRadialGradientEndRadius(value.endRadius)
      node.fillRadialGradientColorStops(toKonvaStops(value.colorStops))
      node.fillPriority('radial-gradient')
      break
    case 'pattern':
      node.fillPatternImage(value.image)
      if (value.x !== undefined) node.fillPatternX(value.x)
      if (value.y !== undefined) node.fillPatternY(value.y)
      if (value.offset) node.fillPatternOffset(value.offset)
      if (value.scale !== undefined) {
        node.fillPatternScale(typeof value.scale === 'number' ? { x: value.scale, y: value.scale } : value.scale)
      }
      if (value.rotation !== undefined) node.fillPatternRotation(value.rotation)
      if (value.repeat !== undefined) node.fillPatternRepeat(value.repeat)
      node.fillPriority('pattern')
      break
  }
}

/**
 * A shape (a leaf with paint) — adds fill and the structured `stroke` facet on
 * top of {@link KonvexNode}.
 *
 * `stroke` is exposed as a ref (like `fill` and the scalars), so it reads and
 * writes through `.value`:
 *   - `shape.stroke.value.color = 'red'` — per-field write (through the reactive proxy)
 *   - `shape.stroke.value = { color: 'red', width: 2 }` — whole-object replace
 *   - `shape.stroke.value = someStrokeRef` — bind the whole object to a reference
 * All of these land on Konva's flat `stroke`/`strokeWidth`/`dash`/... attributes.
 *
 * To bind a reference to a *single* sub-attribute, use its flat ref (see the
 * note on {@link stroke}); `shape.stroke.value.width = ref(5)` does NOT work.
 */
export abstract class KonvexShape<T extends Shape> extends KonvexNode<T> {
  /**
   * Measurement scale: real-world units per world unit (default 1). A stage sets
   * this from its `scale`; the concrete shapes' `scaled*` fields (e.g.
   * {@link KonvexCircle.scaledArea}) derive from it. Named `unitScale` to avoid
   * colliding with the transform `scale` on {@link KonvexNode}.
   */
  readonly unitScale: Ref<number> = ref(1)

  /**
   * Fill facet (discriminated union). Reads back a normalised {@link Fill};
   * accepts any variant, a colour-string shorthand, a reference, or `undefined`.
   */
  readonly fill: Ref<Fill, AttrSource<FillInput | undefined>>

  /**
   * When `false` (default), setting {@link fill} clears the other Konva fill
   * clusters first. Read at write-time, so toggling it affects later writes.
   */
  allowMultipleFills: boolean

  // Backing flat attributes for the stroke facet. Exposed individually too, so
  // callers may use whichever granularity suits them.
  readonly strokeColor: Ref<string | undefined, AttrSource<string | undefined>>
  readonly strokeWidth: Ref<number | undefined, AttrSource<number | undefined>>
  readonly strokeEnabled: Ref<boolean, AttrSource<boolean>>
  readonly dash: Ref<number[] | undefined, AttrSource<number[] | undefined>>
  readonly dashOffset: Ref<number | undefined, AttrSource<number | undefined>>
  readonly dashEnabled: Ref<boolean, AttrSource<boolean>>
  readonly lineCap: Ref<LineCap, AttrSource<LineCap>>
  readonly lineJoin: Ref<LineJoin, AttrSource<LineJoin>>
  readonly miterLimit: Ref<number | undefined, AttrSource<number | undefined>>

  // Standalone shape attributes (not part of a structured facet).
  readonly fillRule: Ref<CanvasFillRule | undefined, AttrSource<CanvasFillRule | undefined>>
  readonly fillAfterStrokeEnabled: Ref<boolean, AttrSource<boolean>>
  readonly hitStrokeWidth: Ref<number | 'auto', AttrSource<number | 'auto'>>
  readonly strokeScaleEnabled: Ref<boolean, AttrSource<boolean>>

  /**
   * The structured stroke facet, exposed as a ref for uniformity with `fill`
   * and the scalar attributes:
   *
   * - read:            `shape.stroke.value` → reactive `{ color, width, ... }`
   * - per-field write: `shape.stroke.value.color = 'red'`
   * - whole replace:   `shape.stroke.value = { color: 'red', width: 2 }`
   * - bind whole obj:  `shape.stroke.value = someStrokeRef`
   *
   * NOTE — binding a ref to a *single* sub-attribute through the proxy is NOT
   * supported: `shape.stroke.value.width = ref(5)` is a type error and would
   * not set up a binding (a facet field reads a plain value, so it cannot also
   * accept a ref; per-field asymmetric read/write types aren't expressible for
   * a generic facet). To bind one sub-attribute to a reactive source, use its
   * flat ref instead — these are the same backing refs the facet is built from,
   * so the two always stay in sync:
   *
   *   shape.strokeWidth.value = ref(5)   // ✅ binds just the width
   */
  readonly stroke: WritableComputedRef<Stroke, AttrSource<Stroke | undefined>>

  private readonly _stroke: Facet<Stroke>
  private readonly _bindStroke: (source: AttrSource<Stroke | undefined>) => void

  // Backing flat attributes for the shadow facet (also exposed individually).
  readonly shadowColor: Ref<string | undefined, AttrSource<string | undefined>>
  readonly shadowBlur: Ref<number | undefined, AttrSource<number | undefined>>
  readonly shadowOffset: Ref<Vector2d | undefined, AttrSource<Vector2d | undefined>>
  readonly shadowOpacity: Ref<number | undefined, AttrSource<number | undefined>>
  readonly shadowEnabled: Ref<boolean, AttrSource<boolean>>
  readonly shadowForStrokeEnabled: Ref<boolean, AttrSource<boolean>>

  /**
   * Structured shadow facet, exposed as a ref exactly like {@link stroke} and
   * `fill`. Same usage and the same single-sub-attribute caveat: to bind one
   * piece to a reactive source, use its flat ref (e.g.
   * `shape.shadowBlur.value = ref(10)`), not `shape.shadow.value.blur = ref(10)`.
   */
  readonly shadow: WritableComputedRef<Shadow, AttrSource<Shadow | undefined>>

  private readonly _shadow: Facet<Shadow>
  private readonly _bindShadow: (source: AttrSource<Shadow | undefined>) => void

  protected constructor(node: T, config: KonvexShapeConfig = {}) {
    super(node, config)

    // Read by the fill writer below; must be set before config.fill is applied.
    this.allowMultipleFills = config.allowMultipleFills ?? false

    this.fill = nodeAttr<T, Fill>(node, 'fill', this.scope, {
      read: readFill,
      write: (n, v) => applyFill(n, v, this.allowMultipleFills),
    }) as unknown as Ref<Fill, AttrSource<FillInput | undefined>>
    // Konva calls the stroke *colour* `stroke`; we expose it as `strokeColor`
    // and reserve the name `stroke` for the structured facet.
    this.strokeColor = nodeAttr(node, 'strokeColor', this.scope, { konvaKey: 'stroke' })
    this.strokeWidth = nodeAttr(node, 'strokeWidth', this.scope)
    this.strokeEnabled = nodeAttr(node, 'strokeEnabled', this.scope)
    this.dash = nodeAttr(node, 'dash', this.scope)
    this.dashOffset = nodeAttr(node, 'dashOffset', this.scope)
    this.dashEnabled = nodeAttr(node, 'dashEnabled', this.scope)
    this.lineCap = nodeAttr(node, 'lineCap', this.scope)
    this.lineJoin = nodeAttr(node, 'lineJoin', this.scope)
    this.miterLimit = nodeAttr(node, 'miterLimit', this.scope)

    this.fillRule = nodeAttr(node, 'fillRule', this.scope)
    this.fillAfterStrokeEnabled = nodeAttr(node, 'fillAfterStrokeEnabled', this.scope)
    this.hitStrokeWidth = nodeAttr(node, 'hitStrokeWidth', this.scope)
    this.strokeScaleEnabled = nodeAttr(node, 'strokeScaleEnabled', this.scope)

    this._stroke = structuredFacet<Stroke>({
      color: this.strokeColor,
      width: this.strokeWidth,
      enabled: this.strokeEnabled,
      dash: this.dash,
      dashOffset: this.dashOffset,
      dashEnabled: this.dashEnabled,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      miterLimit: this.miterLimit,
    })
    this._bindStroke = delegatableSetter(this.scope, value => this._stroke.assign(value))
    // A writable computed (read proxy / write source) mirrors the two-type ref
    // shape used by `fill` and the vector views. Its identity never changes, so
    // the computed stays cached and per-field reactivity flows via the inner refs.
    this.stroke = computed<Stroke, AttrSource<Stroke | undefined>>({
      get: () => this._stroke.proxy,
      set: source => this._bindStroke(source),
    })

    this.shadowColor = nodeAttr(node, 'shadowColor', this.scope)
    this.shadowBlur = nodeAttr(node, 'shadowBlur', this.scope)
    this.shadowOffset = nodeAttr(node, 'shadowOffset', this.scope)
    this.shadowOpacity = nodeAttr(node, 'shadowOpacity', this.scope)
    this.shadowEnabled = nodeAttr(node, 'shadowEnabled', this.scope)
    this.shadowForStrokeEnabled = nodeAttr(node, 'shadowForStrokeEnabled', this.scope)

    this._shadow = structuredFacet<Shadow>({
      color: this.shadowColor,
      blur: this.shadowBlur,
      offset: this.shadowOffset,
      opacity: this.shadowOpacity,
      enabled: this.shadowEnabled,
      forStrokeEnabled: this.shadowForStrokeEnabled,
    })
    this._bindShadow = delegatableSetter(this.scope, value => this._shadow.assign(value))
    this.shadow = computed<Shadow, AttrSource<Shadow | undefined>>({
      get: () => this._shadow.proxy,
      set: source => this._bindShadow(source),
    })

    if (config.fill !== undefined) this.fill.value = config.fill
    if (config.stroke !== undefined) this.stroke.value = config.stroke
    if (config.shadow !== undefined) this.shadow.value = config.shadow
    if (config.fillRule !== undefined) this.fillRule.value = config.fillRule
    if (config.fillAfterStrokeEnabled !== undefined) {
      this.fillAfterStrokeEnabled.value = config.fillAfterStrokeEnabled
    }
    if (config.hitStrokeWidth !== undefined) this.hitStrokeWidth.value = config.hitStrokeWidth
    if (config.strokeScaleEnabled !== undefined) {
      this.strokeScaleEnabled.value = config.strokeScaleEnabled
    }
  }
}

import Konva from 'konva'
import { computed, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { numberAttr, vectorParam } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type {
  AttrSource,
  NumberParameter,
  Vector2d,
  VectorParameter,
} from './KonvexTypes'

export interface KonvexEllipseConfig extends KonvexShapeConfig {
  radiusX?: AttrSource<NumberParameter>
  radiusY?: AttrSource<NumberParameter>
  /** Both radii at once (a {@link VectorParameter}, like `position`/`size`). */
  radius?: VectorParameter
}

/** Wraps a `Konva.Ellipse` — two independent radii. */
export class KonvexEllipse extends KonvexShape<Konva.Ellipse> {
  readonly radiusX: Ref<number, AttrSource<NumberParameter>>
  readonly radiusY: Ref<number, AttrSource<NumberParameter>>
  /** `{ x, y }` view over the two radii — accepts a {@link VectorParameter}. */
  readonly radius: WritableComputedRef<Vector2d, VectorParameter>

  readonly area: ComputedRef<number>
  /** {@link area} in real units (× `unitScale`²). */
  readonly scaledArea: ComputedRef<number>

  constructor(config: KonvexEllipseConfig = {}) {
    super(new Konva.Ellipse({ radiusX: 0, radiusY: 0 }), config)

    // Negative radii throw in Canvas; clamp at 0.
    this.radiusX = numberAttr(this._node, 'radiusX', this.scope, { constraints: { min: 0 } })
    this.radiusY = numberAttr(this._node, 'radiusY', this.scope, { constraints: { min: 0 } })
    this.radius = vectorParam(this.radiusX, this.radiusY)
    if (config.radiusX !== undefined) this.radiusX.value = config.radiusX
    if (config.radiusY !== undefined) this.radiusY.value = config.radiusY
    if (config.radius !== undefined) this.radius.value = config.radius

    this.area = computed(() => Math.PI * this.radiusX.value * this.radiusY.value)
    this.scaledArea = computed(() => this.area.value * this.unitScale.value ** 2)
  }

  /** Fluent helper: add this ellipse to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

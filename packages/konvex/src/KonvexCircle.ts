import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexCircleConfig extends KonvexShapeConfig {
  radius?: AttrSource<NumberParameter>
}

/** Wraps a `Konva.Circle` — a single-`radius` round shape. */
export class KonvexCircle extends KonvexShape<Konva.Circle> {
  readonly radius: Ref<number, AttrSource<NumberParameter>>

  /** Derived read-only values from the reactive radius. */
  readonly diameter: ComputedRef<number>
  readonly area: ComputedRef<number>
  /** {@link diameter} in real units (× `unitScale`). */
  readonly scaledDiameter: ComputedRef<number>
  /** {@link area} in real units (× `unitScale`²). */
  readonly scaledArea: ComputedRef<number>

  constructor(config: KonvexCircleConfig = {}) {
    super(new Konva.Circle(), config)

    // Negative radius throws in Canvas; clamp at 0.
    this.radius = numberAttr(this._node, 'radius', this.scope, { constraints: { min: 0 } })
    if (config.radius !== undefined) this.radius.value = config.radius

    this.diameter = computed(() => this.radius.value * 2)
    this.area = computed(() => Math.PI * this.radius.value ** 2)
    this.scaledDiameter = computed(() => this.diameter.value * this.unitScale.value)
    this.scaledArea = computed(() => this.area.value * this.unitScale.value ** 2)
  }

  /** Fluent helper: add this circle to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

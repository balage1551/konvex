import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexRingConfig extends KonvexShapeConfig {
  innerRadius?: AttrSource<NumberParameter>
  outerRadius?: AttrSource<NumberParameter>
}

/** Wraps a `Konva.Ring` — an annulus between an inner and outer radius. */
export class KonvexRing extends KonvexShape<Konva.Ring> {
  readonly innerRadius: Ref<number, AttrSource<NumberParameter>>
  readonly outerRadius: Ref<number, AttrSource<NumberParameter>>

  /** Area of the annulus, from the reactive radii. */
  readonly area: ComputedRef<number>
  /** {@link area} in real units (× `unitScale`²). */
  readonly scaledArea: ComputedRef<number>

  constructor(config: KonvexRingConfig = {}) {
    super(new Konva.Ring({ innerRadius: 0, outerRadius: 0 }), config)

    // Guards: both >= 0 and inner <= outer (each clamped against the live sibling).
    this.outerRadius = numberAttr(this._node, 'outerRadius', this.scope, {
      constraints: { min: () => this._node.innerRadius() },
    })
    this.innerRadius = numberAttr(this._node, 'innerRadius', this.scope, {
      constraints: { min: 0, max: () => this._node.outerRadius() },
    })
    // Apply outer first so inner clamps against the intended outer, not the default 0.
    if (config.outerRadius !== undefined) this.outerRadius.value = config.outerRadius
    if (config.innerRadius !== undefined) this.innerRadius.value = config.innerRadius

    this.area = computed(
      () => Math.PI * (this.outerRadius.value ** 2 - this.innerRadius.value ** 2),
    )
    this.scaledArea = computed(() => this.area.value * this.unitScale.value ** 2)
  }

  /** Fluent helper: add this ring to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

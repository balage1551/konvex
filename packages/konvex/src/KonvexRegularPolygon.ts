import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexRegularPolygonConfig extends KonvexShapeConfig {
  /** Number of sides (>= 3, integer). */
  sides?: AttrSource<NumberParameter>
  radius?: AttrSource<NumberParameter>
  cornerRadius?: AttrSource<number | number[] | undefined>
}

/** Wraps a `Konva.RegularPolygon` — an equilateral polygon (triangle, hexagon, …). */
export class KonvexRegularPolygon extends KonvexShape<Konva.RegularPolygon> {
  readonly sides: Ref<number, AttrSource<NumberParameter>>
  readonly radius: Ref<number, AttrSource<NumberParameter>>
  readonly cornerRadius: Ref<
    number | number[] | undefined,
    AttrSource<number | number[] | undefined>
  >

  readonly area: ComputedRef<number>
  /** {@link area} in real units (× `unitScale`²). */
  readonly scaledArea: ComputedRef<number>

  constructor(config: KonvexRegularPolygonConfig = {}) {
    super(new Konva.RegularPolygon({ sides: 3, radius: 0 }), config)

    // Guards: at least 3 (integer) sides, non-negative radius.
    this.sides = numberAttr(this._node, 'sides', this.scope, { constraints: { min: 3, round: 0 } })
    this.radius = numberAttr(this._node, 'radius', this.scope, { constraints: { min: 0 } })
    this.cornerRadius = nodeAttr(this._node, 'cornerRadius', this.scope)
    if (config.sides !== undefined) this.sides.value = config.sides
    if (config.radius !== undefined) this.radius.value = config.radius
    if (config.cornerRadius !== undefined) this.cornerRadius.value = config.cornerRadius

    // Area of a regular n-gon with circumradius r: ½·n·r²·sin(2π/n).
    this.area = computed(
      () => 0.5 * this.sides.value * this.radius.value ** 2 * Math.sin((2 * Math.PI) / this.sides.value),
    )
    this.scaledArea = computed(() => this.area.value * this.unitScale.value ** 2)
  }

  /** Fluent helper: add this polygon to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

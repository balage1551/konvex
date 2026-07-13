import Konva from 'konva'
import type { Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexStarConfig extends KonvexShapeConfig {
  /** Number of points (>= 3, integer). */
  numPoints?: AttrSource<NumberParameter>
  innerRadius?: AttrSource<NumberParameter>
  outerRadius?: AttrSource<NumberParameter>
}

/** Wraps a `Konva.Star` — a star with `numPoints` spikes between two radii. */
export class KonvexStar extends KonvexShape<Konva.Star> {
  readonly numPoints: Ref<number, AttrSource<NumberParameter>>
  readonly innerRadius: Ref<number, AttrSource<NumberParameter>>
  readonly outerRadius: Ref<number, AttrSource<NumberParameter>>

  constructor(config: KonvexStarConfig = {}) {
    super(new Konva.Star({ numPoints: 5, innerRadius: 0, outerRadius: 0 }), config)

    // Guards: at least 3 (integer) points, non-negative radii, inner <= outer.
    this.numPoints = numberAttr(this._node, 'numPoints', this.scope, {
      constraints: { min: 3, round: 0 },
    })
    this.outerRadius = numberAttr(this._node, 'outerRadius', this.scope, {
      constraints: { min: () => this._node.innerRadius() },
    })
    this.innerRadius = numberAttr(this._node, 'innerRadius', this.scope, {
      constraints: { min: 0, max: () => this._node.outerRadius() },
    })
    if (config.numPoints !== undefined) this.numPoints.value = config.numPoints
    // Apply outer first so inner clamps against the intended outer, not the default 0.
    if (config.outerRadius !== undefined) this.outerRadius.value = config.outerRadius
    if (config.innerRadius !== undefined) this.innerRadius.value = config.innerRadius
  }

  /** Fluent helper: add this star to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

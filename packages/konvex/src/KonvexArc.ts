import Konva from 'konva'
import type { Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexArcConfig extends KonvexShapeConfig {
  innerRadius?: AttrSource<NumberParameter>
  outerRadius?: AttrSource<NumberParameter>
  /** Sweep angle in degrees. */
  angle?: AttrSource<NumberParameter>
  clockwise?: AttrSource<boolean>
}

/** Wraps a `Konva.Arc` — a ring segment (inner/outer radius + sweep angle). */
export class KonvexArc extends KonvexShape<Konva.Arc> {
  readonly innerRadius: Ref<number, AttrSource<NumberParameter>>
  readonly outerRadius: Ref<number, AttrSource<NumberParameter>>
  readonly angle: Ref<number, AttrSource<NumberParameter>>
  readonly clockwise: Ref<boolean, AttrSource<boolean>>

  constructor(config: KonvexArcConfig = {}) {
    super(new Konva.Arc({ innerRadius: 0, outerRadius: 0, angle: 0 }), config)

    // Guards: both >= 0 and inner <= outer (each clamped against the live sibling).
    this.outerRadius = numberAttr(this._node, 'outerRadius', this.scope, {
      constraints: { min: () => this._node.innerRadius() },
    })
    this.innerRadius = numberAttr(this._node, 'innerRadius', this.scope, {
      constraints: { min: 0, max: () => this._node.outerRadius() },
    })
    this.angle = numberAttr(this._node, 'angle', this.scope)
    this.clockwise = nodeAttr(this._node, 'clockwise', this.scope)
    // Apply outer first so inner clamps against the intended outer, not the default 0.
    if (config.outerRadius !== undefined) this.outerRadius.value = config.outerRadius
    if (config.innerRadius !== undefined) this.innerRadius.value = config.innerRadius
    if (config.angle !== undefined) this.angle.value = config.angle
    if (config.clockwise !== undefined) this.clockwise.value = config.clockwise
  }

  /** Fluent helper: add this arc to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

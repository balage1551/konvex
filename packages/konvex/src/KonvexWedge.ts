import Konva from 'konva'
import type { Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexWedgeConfig extends KonvexShapeConfig {
  radius?: AttrSource<NumberParameter>
  /** Sweep angle in degrees. */
  angle?: AttrSource<NumberParameter>
  clockwise?: AttrSource<boolean>
}

/** Wraps a `Konva.Wedge` — a pie slice (radius + sweep angle). */
export class KonvexWedge extends KonvexShape<Konva.Wedge> {
  readonly radius: Ref<number, AttrSource<NumberParameter>>
  readonly angle: Ref<number, AttrSource<NumberParameter>>
  readonly clockwise: Ref<boolean, AttrSource<boolean>>

  constructor(config: KonvexWedgeConfig = {}) {
    super(new Konva.Wedge({ radius: 0, angle: 0 }), config)

    // Negative radius throws in Canvas; clamp at 0.
    this.radius = numberAttr(this._node, 'radius', this.scope, { constraints: { min: 0 } })
    this.angle = numberAttr(this._node, 'angle', this.scope)
    this.clockwise = nodeAttr(this._node, 'clockwise', this.scope)
    if (config.radius !== undefined) this.radius.value = config.radius
    if (config.angle !== undefined) this.angle.value = config.angle
    if (config.clockwise !== undefined) this.clockwise.value = config.clockwise
  }

  /** Fluent helper: add this wedge to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, readonlyNodeAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource } from './KonvexTypes'

export interface KonvexPathConfig extends KonvexShapeConfig {
  /** SVG path data string (the `d` attribute). */
  data?: AttrSource<string>
}

/** Wraps a `Konva.Path` — an SVG-path shape. */
export class KonvexPath extends KonvexShape<Konva.Path> {
  readonly data: Ref<string, AttrSource<string>>

  /** Read-only path length, recomputed by Konva whenever `data` changes. */
  readonly length: Readonly<Ref<number>>
  /** {@link length} in real units (× `unitScale`). */
  readonly scaledLength: ComputedRef<number>

  constructor(config: KonvexPathConfig = {}) {
    super(new Konva.Path(), config)

    this.data = nodeAttr(this._node, 'data', this.scope)
    if (config.data !== undefined) this.data.value = config.data

    this.length = readonlyNodeAttr(this._node, {
      read: n => n.getLength(),
      syncOn: ['dataChange'],
    })
    this.scaledLength = computed(() => this.length.value * this.unitScale.value)
  }

  /** Fluent helper: add this path to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

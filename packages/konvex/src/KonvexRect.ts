import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource } from './KonvexTypes'

export interface KonvexRectConfig extends KonvexShapeConfig {
  cornerRadius?: AttrSource<number | number[] | undefined>
}

/** Wraps a `Konva.Rect`. */
export class KonvexRect extends KonvexShape<Konva.Rect> {
  readonly cornerRadius: Ref<
    number | number[] | undefined,
    AttrSource<number | number[] | undefined>
  >

  /** Read-only derived value: area from the reactive width/height. */
  readonly area: ComputedRef<number>
  /** {@link area} in real units (area × `unitScale`²). */
  readonly scaledArea: ComputedRef<number>

  constructor(config: KonvexRectConfig = {}) {
    super(new Konva.Rect(), config)

    this.cornerRadius = nodeAttr(this._node, 'cornerRadius', this.scope)
    if (config.cornerRadius !== undefined) {
      this.cornerRadius.value = config.cornerRadius
    }

    this.area = computed(() => this.width.value * this.height.value)
    this.scaledArea = computed(() => this.area.value * this.unitScale.value ** 2)
  }

  /** Fluent helper: add this rect to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

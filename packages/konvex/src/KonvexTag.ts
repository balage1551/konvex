import Konva from 'konva'
import type { Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

/** Side from which a {@link KonvexTag}'s pointer protrudes (`'none'` = no pointer). */
export type PointerDirection = 'none' | 'up' | 'down' | 'left' | 'right'

export interface KonvexTagConfig extends KonvexShapeConfig {
  pointerDirection?: AttrSource<PointerDirection>
  pointerWidth?: AttrSource<NumberParameter>
  pointerHeight?: AttrSource<NumberParameter>
  cornerRadius?: AttrSource<number | number[] | undefined>
}

/**
 * Wraps a `Konva.Tag` — the speech-bubble background used inside a `Label`.
 * (`Label` itself is just a `Group` you assemble from a Tag + Text manually, so
 * konvex doesn't provide a dedicated wrapper for it.)
 *
 * A standalone Tag sizes to its own `width`/`height`; inside a Label it is
 * synced to the sibling Text instead.
 */
export class KonvexTag extends KonvexShape<Konva.Tag> {
  readonly pointerDirection: Ref<PointerDirection, AttrSource<PointerDirection>>
  readonly pointerWidth: Ref<number, AttrSource<NumberParameter>>
  readonly pointerHeight: Ref<number, AttrSource<NumberParameter>>
  readonly cornerRadius: Ref<
    number | number[] | undefined,
    AttrSource<number | number[] | undefined>
  >

  constructor(config: KonvexTagConfig = {}) {
    super(new Konva.Tag(), config)

    this.pointerDirection = nodeAttr(this._node, 'pointerDirection', this.scope)
    this.pointerWidth = numberAttr(this._node, 'pointerWidth', this.scope, {
      constraints: { min: 0 },
    })
    this.pointerHeight = numberAttr(this._node, 'pointerHeight', this.scope, {
      constraints: { min: 0 },
    })
    this.cornerRadius = nodeAttr(this._node, 'cornerRadius', this.scope)
    if (config.pointerDirection !== undefined) this.pointerDirection.value = config.pointerDirection
    if (config.pointerWidth !== undefined) this.pointerWidth.value = config.pointerWidth
    if (config.pointerHeight !== undefined) this.pointerHeight.value = config.pointerHeight
    if (config.cornerRadius !== undefined) this.cornerRadius.value = config.cornerRadius
  }

  /** Fluent helper: add this tag to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

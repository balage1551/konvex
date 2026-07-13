import Konva from 'konva'
import type { Ref } from 'vue'
import { KonvexLine, type KonvexLineConfig } from './KonvexLine'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexArrowConfig extends KonvexLineConfig {
  /** Arrowhead length along the line. */
  pointerLength?: AttrSource<NumberParameter>
  /** Arrowhead width across the line. */
  pointerWidth?: AttrSource<NumberParameter>
  pointerAtBeginning?: AttrSource<boolean>
  pointerAtEnding?: AttrSource<boolean>
}

/**
 * Wraps a `Konva.Arrow` — a {@link KonvexLine} with arrowhead(s). Kept as its
 * own class (rather than folded into `KonvexLine`) to mirror Konva's
 * `Arrow extends Line` and preserve the 1:1 wrapper ↔ Konva-node mapping.
 */
export class KonvexArrow extends KonvexLine<Konva.Arrow> {
  readonly pointerLength: Ref<number, AttrSource<NumberParameter>>
  readonly pointerWidth: Ref<number, AttrSource<NumberParameter>>
  readonly pointerAtBeginning: Ref<boolean, AttrSource<boolean>>
  readonly pointerAtEnding: Ref<boolean, AttrSource<boolean>>

  constructor(config: KonvexArrowConfig = {}) {
    super(config, new Konva.Arrow())

    // Negative pointer dimensions are meaningless; clamp at 0.
    this.pointerLength = numberAttr(this._node, 'pointerLength', this.scope, {
      constraints: { min: 0 },
    })
    this.pointerWidth = numberAttr(this._node, 'pointerWidth', this.scope, {
      constraints: { min: 0 },
    })
    this.pointerAtBeginning = nodeAttr(this._node, 'pointerAtBeginning', this.scope)
    this.pointerAtEnding = nodeAttr(this._node, 'pointerAtEnding', this.scope)
    if (config.pointerLength !== undefined) this.pointerLength.value = config.pointerLength
    if (config.pointerWidth !== undefined) this.pointerWidth.value = config.pointerWidth
    if (config.pointerAtBeginning !== undefined) {
      this.pointerAtBeginning.value = config.pointerAtBeginning
    }
    if (config.pointerAtEnding !== undefined) this.pointerAtEnding.value = config.pointerAtEnding
  }
}

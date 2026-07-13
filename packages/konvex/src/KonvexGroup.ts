import Konva from 'konva'
import type { Ref } from 'vue'
import type { IRect } from 'konva/lib/types'
import {
  KonvexContainer,
  type KonvexContainerConfig,
} from './KonvexContainer'
import type { KonvexNode } from './KonvexNode'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

/** Custom clip region drawn into the scene context. */
export type GroupClipFunc = (ctx: Konva.Context) => void

export interface KonvexGroupConfig extends KonvexContainerConfig {
  /** Rectangular clip region (the whole `{ x, y, width, height }`). */
  clip?: AttrSource<IRect | undefined>
  /** Arbitrary clip path drawn by a function (overrides the rect clip). */
  clipFunc?: AttrSource<GroupClipFunc | undefined>
}

/**
 * Wraps a `Konva.Group` — a transformable container of shapes and nested
 * groups. Being a {@link KonvexContainer}, it inherits the add/remove/children
 * machinery and cascading destroy; being a {@link KonvexNode}, it carries the
 * full transform/visibility attribute set, so a whole group moves, rotates and
 * fades as one.
 */
export class KonvexGroup extends KonvexContainer<Konva.Group, KonvexNode<Konva.Node>> {
  /** Whole clip rect; individual edges are also exposed below. */
  readonly clip: Ref<IRect | undefined, AttrSource<IRect | undefined>>
  readonly clipX: Ref<number, AttrSource<NumberParameter>>
  readonly clipY: Ref<number, AttrSource<NumberParameter>>
  readonly clipWidth: Ref<number, AttrSource<NumberParameter>>
  readonly clipHeight: Ref<number, AttrSource<NumberParameter>>
  readonly clipFunc: Ref<GroupClipFunc | undefined, AttrSource<GroupClipFunc | undefined>>

  constructor(config: KonvexGroupConfig = {}) {
    super(new Konva.Group(), config)

    this.clip = nodeAttr(this._node, 'clip', this.scope)
    // clipX/clipY are an offset (may be negative); width/height can't be.
    this.clipX = numberAttr(this._node, 'clipX', this.scope)
    this.clipY = numberAttr(this._node, 'clipY', this.scope)
    this.clipWidth = numberAttr(this._node, 'clipWidth', this.scope, { constraints: { min: 0 } })
    this.clipHeight = numberAttr(this._node, 'clipHeight', this.scope, { constraints: { min: 0 } })
    // clipFunc's value is a function, so it must not be read as a getter source.
    this.clipFunc = nodeAttr(this._node, 'clipFunc', this.scope, { valueIsFunction: true })
    if (config.clip !== undefined) this.clip.value = config.clip
    if (config.clipFunc !== undefined) this.clipFunc.value = config.clipFunc
  }

  /** Fluent helper: add this group to a layer (or another group) and return it. */
  insertInto(parent: KonvexLayer | KonvexGroup, index?: number): this {
    parent.add(this, index)
    return this
  }
}

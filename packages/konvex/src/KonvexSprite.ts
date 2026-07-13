import Konva from 'konva'
import { toValue, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

/** Map of animation name → flat frame rects `[x, y, w, h, x, y, w, h, ...]`. */
export type SpriteFrameMap = Record<string, number[]>

export interface KonvexSpriteConfig extends KonvexShapeConfig {
  /** Sprite-sheet bitmap (required). */
  image: AttrSource<CanvasImageSource>
  /** Name of the currently playing animation (required). */
  animation: AttrSource<string>
  /** All animations, keyed by name (required). */
  animations: AttrSource<SpriteFrameMap>
  frameIndex?: AttrSource<NumberParameter>
  /** Frames per second. */
  frameRate?: AttrSource<NumberParameter>
  /** Per-animation `{x, y}` offsets, keyed by name. */
  frameOffsets?: AttrSource<SpriteFrameMap | undefined>
}

/**
 * Wraps a `Konva.Sprite` — a frame-animated bitmap. Construction requires
 * `image`/`animation`/`animations` (as Konva does). Use {@link start}/{@link stop}
 * to control playback.
 */
export class KonvexSprite extends KonvexShape<Konva.Sprite> {
  readonly image: Ref<CanvasImageSource, AttrSource<CanvasImageSource>>
  readonly animation: Ref<string, AttrSource<string>>
  readonly animations: Ref<SpriteFrameMap, AttrSource<SpriteFrameMap>>
  readonly frameIndex: Ref<number, AttrSource<NumberParameter>>
  readonly frameRate: Ref<number, AttrSource<NumberParameter>>
  readonly frameOffsets: Ref<SpriteFrameMap | undefined, AttrSource<SpriteFrameMap | undefined>>

  constructor(config: KonvexSpriteConfig) {
    // Konva.Sprite needs concrete image/animation/animations up front.
    super(
      new Konva.Sprite({
        image: toValue(config.image) as HTMLImageElement,
        animation: toValue(config.animation),
        animations: toValue(config.animations),
      }),
      config,
    )

    this.image = nodeAttr(this._node, 'image', this.scope)
    this.animation = nodeAttr(this._node, 'animation', this.scope)
    this.animations = nodeAttr(this._node, 'animations', this.scope)
    this.frameIndex = numberAttr(this._node, 'frameIndex', this.scope, {
      constraints: { min: 0, round: 0 },
      // Konva advances frameIndex during playback — keep the ref in sync.
      syncOn: ['frameIndexChange'],
    })
    this.frameRate = numberAttr(this._node, 'frameRate', this.scope, { constraints: { min: 0 } })
    this.frameOffsets = nodeAttr(this._node, 'frameOffsets', this.scope)

    // Re-apply through the refs so any reactive sources are tracked.
    this.image.value = config.image
    this.animation.value = config.animation
    this.animations.value = config.animations
    if (config.frameIndex !== undefined) this.frameIndex.value = config.frameIndex
    if (config.frameRate !== undefined) this.frameRate.value = config.frameRate
    if (config.frameOffsets !== undefined) this.frameOffsets.value = config.frameOffsets
  }

  /** Start frame playback. */
  start(): void {
    this._node.start()
  }

  /** Stop frame playback. */
  stop(): void {
    this._node.stop()
  }

  /** Whether playback is currently running. */
  isRunning(): boolean {
    return this._node.isRunning()
  }

  /** Stop the animation before tearing down, so it can't redraw a dead node. */
  override destroy(): void {
    this._node.stop()
    super.destroy()
  }

  /** Fluent helper: add this sprite to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

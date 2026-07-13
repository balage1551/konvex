import Konva from 'konva'
import type { Ref } from 'vue'
import type { IRect } from 'konva/lib/types'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter } from './KonvexTypes'

export interface KonvexImageConfig extends KonvexShapeConfig {
  /** The source bitmap (an `HTMLImageElement`, `HTMLCanvasElement`, …). */
  image?: AttrSource<CanvasImageSource | undefined>
  /** Sub-rectangle of the source to draw (the whole `{ x, y, width, height }`). */
  crop?: AttrSource<IRect | undefined>
  cornerRadius?: AttrSource<number | number[] | undefined>
}

/** Wraps a `Konva.Image` — draws a bitmap, optionally cropped and rounded. */
export class KonvexImage extends KonvexShape<Konva.Image> {
  readonly image: Ref<CanvasImageSource | undefined, AttrSource<CanvasImageSource | undefined>>

  /** Whole crop rect; individual edges are also exposed below. */
  readonly crop: Ref<IRect | undefined, AttrSource<IRect | undefined>>
  readonly cropX: Ref<number, AttrSource<NumberParameter>>
  readonly cropY: Ref<number, AttrSource<NumberParameter>>
  readonly cropWidth: Ref<number, AttrSource<NumberParameter>>
  readonly cropHeight: Ref<number, AttrSource<NumberParameter>>

  readonly cornerRadius: Ref<
    number | number[] | undefined,
    AttrSource<number | number[] | undefined>
  >

  constructor(config: KonvexImageConfig = {}) {
    super(new Konva.Image({ image: undefined }), config)

    this.image = nodeAttr(this._node, 'image', this.scope)
    this.crop = nodeAttr(this._node, 'crop', this.scope)
    // Crop coordinates can't be negative.
    this.cropX = numberAttr(this._node, 'cropX', this.scope, { constraints: { min: 0 } })
    this.cropY = numberAttr(this._node, 'cropY', this.scope, { constraints: { min: 0 } })
    this.cropWidth = numberAttr(this._node, 'cropWidth', this.scope, { constraints: { min: 0 } })
    this.cropHeight = numberAttr(this._node, 'cropHeight', this.scope, { constraints: { min: 0 } })
    this.cornerRadius = nodeAttr(this._node, 'cornerRadius', this.scope)

    if (config.image !== undefined) this.image.value = config.image
    if (config.crop !== undefined) this.crop.value = config.crop
    if (config.cornerRadius !== undefined) this.cornerRadius.value = config.cornerRadius
  }

  /**
   * Convenience loader mirroring `Konva.Image.fromURL`, promisified: resolves a
   * ready-to-add `KonvexImage` once the bitmap has loaded.
   */
  static fromURL(
    url: string,
    config: Omit<KonvexImageConfig, 'image'> = {},
  ): Promise<KonvexImage> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(new KonvexImage({ ...config, image: img }))
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
      img.src = url
    })
  }

  /** Fluent helper: add this image to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

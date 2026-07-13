import Konva from 'konva'
import { computed, type Ref, type WritableComputedRef } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import {
  delegatableSetter,
  type Facet,
  nodeAttr,
  numberAttr,
  readonlyNodeAttr,
  structuredFacet,
} from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, Font, NumberParameter } from './KonvexTypes'

/**
 * The paragraph/layout cluster for {@link KonvexTextPath} — a subset of the
 * `KonvexText` one (a text-on-a-path has no box to wrap/pad within, but gains
 * `textBaseline` for placement relative to the path).
 */
export interface TextPathParagraph {
  /** `'left' | 'center' | 'right'`. */
  align?: string
  letterSpacing?: number
  /** Line-height multiplier. */
  lineHeight?: number
  /** Glyph baseline relative to the path, e.g. `'middle' | 'top' | 'bottom'`. */
  textBaseline?: string
}

export interface KonvexTextPathConfig extends KonvexShapeConfig {
  text?: AttrSource<string>
  /** SVG path data the text flows along. */
  data?: AttrSource<string>
  /** Whole {@link Font} object, or a reference to one. */
  font?: AttrSource<Font | undefined>
  /** Whole {@link TextPathParagraph} object, or a reference to one. */
  paragraph?: AttrSource<TextPathParagraph | undefined>
}

/**
 * Wraps a `Konva.TextPath` — text laid out along an SVG path. Kept as its own
 * class (not a subclass of {@link KonvexText}) because Konva's `TextPath`
 * extends `Shape`, not `Text`. Shares the {@link Font} facet shape, with a
 * path-specific {@link paragraph} facet.
 */
export class KonvexTextPath extends KonvexShape<Konva.TextPath> {
  readonly text: Ref<string, AttrSource<string>>
  readonly data: Ref<string, AttrSource<string>>

  // --- font facet ---
  readonly fontFamily: Ref<string | undefined, AttrSource<string | undefined>>
  readonly fontSize: Ref<number, AttrSource<NumberParameter>>
  readonly fontStyle: Ref<string | undefined, AttrSource<string | undefined>>
  readonly fontVariant: Ref<string | undefined, AttrSource<string | undefined>>
  readonly textDecoration: Ref<string | undefined, AttrSource<string | undefined>>
  readonly font: WritableComputedRef<Font, AttrSource<Font | undefined>>

  // --- paragraph facet ---
  readonly align: Ref<string | undefined, AttrSource<string | undefined>>
  readonly letterSpacing: Ref<number, AttrSource<NumberParameter>>
  readonly lineHeight: Ref<number, AttrSource<NumberParameter>>
  readonly textBaseline: Ref<string | undefined, AttrSource<string | undefined>>
  readonly paragraph: WritableComputedRef<TextPathParagraph, AttrSource<TextPathParagraph | undefined>>

  readonly textWidth: Readonly<Ref<number>>
  readonly textHeight: Readonly<Ref<number>>

  private readonly _font: Facet<Font>
  private readonly _bindFont: (source: AttrSource<Font | undefined>) => void
  private readonly _paragraph: Facet<TextPathParagraph>
  private readonly _bindParagraph: (source: AttrSource<TextPathParagraph | undefined>) => void

  constructor(config: KonvexTextPathConfig = {}) {
    super(new Konva.TextPath(), config)

    this.text = nodeAttr(this._node, 'text', this.scope)
    this.data = nodeAttr(this._node, 'data', this.scope)

    this.fontFamily = nodeAttr(this._node, 'fontFamily', this.scope)
    this.fontSize = numberAttr(this._node, 'fontSize', this.scope, {
      defaultValue: 12,
      constraints: { min: 0 },
    })
    this.fontStyle = nodeAttr(this._node, 'fontStyle', this.scope)
    this.fontVariant = nodeAttr(this._node, 'fontVariant', this.scope)
    this.textDecoration = nodeAttr(this._node, 'textDecoration', this.scope)
    this._font = structuredFacet<Font>({
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontStyle: this.fontStyle,
      fontVariant: this.fontVariant,
      textDecoration: this.textDecoration,
    })
    this._bindFont = delegatableSetter(this.scope, value => this._font.assign(value))
    this.font = computed<Font, AttrSource<Font | undefined>>({
      get: () => this._font.proxy,
      set: source => this._bindFont(source),
    })

    this.align = nodeAttr(this._node, 'align', this.scope)
    this.letterSpacing = numberAttr(this._node, 'letterSpacing', this.scope, { defaultValue: 0 })
    this.lineHeight = numberAttr(this._node, 'lineHeight', this.scope, {
      defaultValue: 1,
      constraints: { min: 0 },
    })
    this.textBaseline = nodeAttr(this._node, 'textBaseline', this.scope)
    this._paragraph = structuredFacet<TextPathParagraph>({
      align: this.align,
      letterSpacing: this.letterSpacing,
      lineHeight: this.lineHeight,
      textBaseline: this.textBaseline,
    })
    this._bindParagraph = delegatableSetter(this.scope, value => this._paragraph.assign(value))
    this.paragraph = computed<TextPathParagraph, AttrSource<TextPathParagraph | undefined>>({
      get: () => this._paragraph.proxy,
      set: source => this._bindParagraph(source),
    })

    this.textWidth = readonlyNodeAttr(this._node, {
      read: n => n.getTextWidth(),
      syncOn: ['textChange', 'fontSizeChange', 'fontFamilyChange', 'fontStyleChange', 'letterSpacingChange'],
    })
    this.textHeight = readonlyNodeAttr(this._node, {
      read: n => n.getTextHeight(),
      syncOn: ['textChange', 'fontSizeChange', 'fontFamilyChange', 'fontStyleChange'],
    })

    if (config.text !== undefined) this.text.value = config.text
    if (config.data !== undefined) this.data.value = config.data
    if (config.font !== undefined) this.font.value = config.font
    if (config.paragraph !== undefined) this.paragraph.value = config.paragraph
  }

  /** Fluent helper: add this text-path to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

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
 * The paragraph/layout cluster for {@link KonvexText} — how the text is
 * arranged within its box (alignment, spacing, wrapping), as opposed to the
 * glyph-appearance {@link Font} cluster.
 */
export interface TextParagraph {
  /** `'left' | 'center' | 'right' | 'justify'`. */
  align?: string
  /** `'top' | 'middle' | 'bottom'`. */
  verticalAlign?: string
  padding?: number
  /** Line-height multiplier. */
  lineHeight?: number
  letterSpacing?: number
  /** `'word' | 'char' | 'none'`. */
  wrap?: string
  ellipsis?: boolean
  /** `'inherit' | 'ltr' | 'rtl'`. */
  direction?: string
}

export interface KonvexTextConfig extends KonvexShapeConfig {
  text?: AttrSource<string>
  /** Whole {@link Font} object, or a reference to one. */
  font?: AttrSource<Font | undefined>
  /** Whole {@link TextParagraph} object, or a reference to one. */
  paragraph?: AttrSource<TextParagraph | undefined>
}

/**
 * Wraps a `Konva.Text`. The many flat font/paragraph attributes are bundled
 * into two facets — {@link font} and {@link paragraph} — exposed as refs like
 * `fill`/`stroke`/`shadow`. Each sub-attribute is also a flat ref (e.g.
 * {@link fontSize}), which is the way to bind a reference to a single field.
 */
export class KonvexText extends KonvexShape<Konva.Text> {
  readonly text: Ref<string, AttrSource<string>>

  // --- font facet (backing flat refs are public, like stroke's) ---
  readonly fontFamily: Ref<string | undefined, AttrSource<string | undefined>>
  readonly fontSize: Ref<number, AttrSource<NumberParameter>>
  readonly fontStyle: Ref<string | undefined, AttrSource<string | undefined>>
  readonly fontVariant: Ref<string | undefined, AttrSource<string | undefined>>
  readonly textDecoration: Ref<string | undefined, AttrSource<string | undefined>>
  readonly font: WritableComputedRef<Font, AttrSource<Font | undefined>>

  // --- paragraph facet ---
  readonly align: Ref<string | undefined, AttrSource<string | undefined>>
  readonly verticalAlign: Ref<string | undefined, AttrSource<string | undefined>>
  readonly padding: Ref<number, AttrSource<NumberParameter>>
  readonly lineHeight: Ref<number, AttrSource<NumberParameter>>
  readonly letterSpacing: Ref<number, AttrSource<NumberParameter>>
  readonly wrap: Ref<string | undefined, AttrSource<string | undefined>>
  readonly ellipsis: Ref<boolean, AttrSource<boolean>>
  readonly direction: Ref<string | undefined, AttrSource<string | undefined>>
  readonly paragraph: WritableComputedRef<TextParagraph, AttrSource<TextParagraph | undefined>>

  /** Read-only measured text size (recomputed when text/font/layout change). */
  readonly textWidth: Readonly<Ref<number>>
  readonly textHeight: Readonly<Ref<number>>

  private readonly _font: Facet<Font>
  private readonly _bindFont: (source: AttrSource<Font | undefined>) => void
  private readonly _paragraph: Facet<TextParagraph>
  private readonly _bindParagraph: (source: AttrSource<TextParagraph | undefined>) => void

  constructor(config: KonvexTextConfig = {}) {
    super(new Konva.Text(), config)

    this.text = nodeAttr(this._node, 'text', this.scope)

    // defaultValue mirrors the Konva default so a facet reset restores it.
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
    this.verticalAlign = nodeAttr(this._node, 'verticalAlign', this.scope)
    this.padding = numberAttr(this._node, 'padding', this.scope, {
      defaultValue: 0,
      constraints: { min: 0 },
    })
    this.lineHeight = numberAttr(this._node, 'lineHeight', this.scope, {
      defaultValue: 1,
      constraints: { min: 0 },
    })
    this.letterSpacing = numberAttr(this._node, 'letterSpacing', this.scope, { defaultValue: 0 })
    this.wrap = nodeAttr(this._node, 'wrap', this.scope)
    this.ellipsis = nodeAttr(this._node, 'ellipsis', this.scope)
    this.direction = nodeAttr(this._node, 'direction', this.scope)
    this._paragraph = structuredFacet<TextParagraph>({
      align: this.align,
      verticalAlign: this.verticalAlign,
      padding: this.padding,
      lineHeight: this.lineHeight,
      letterSpacing: this.letterSpacing,
      wrap: this.wrap,
      ellipsis: this.ellipsis,
      direction: this.direction,
    })
    this._bindParagraph = delegatableSetter(this.scope, value => this._paragraph.assign(value))
    this.paragraph = computed<TextParagraph, AttrSource<TextParagraph | undefined>>({
      get: () => this._paragraph.proxy,
      set: source => this._bindParagraph(source),
    })

    this.textWidth = readonlyNodeAttr(this._node, {
      read: n => n.getTextWidth(),
      syncOn: [
        'textChange', 'fontSizeChange', 'fontFamilyChange', 'fontStyleChange',
        'fontVariantChange', 'letterSpacingChange', 'widthChange', 'wrapChange', 'paddingChange',
      ],
    })
    this.textHeight = readonlyNodeAttr(this._node, {
      read: n => n.getTextHeight(),
      syncOn: [
        'textChange', 'fontSizeChange', 'fontFamilyChange', 'fontStyleChange',
        'lineHeightChange', 'widthChange', 'wrapChange', 'paddingChange',
      ],
    })

    if (config.text !== undefined) this.text.value = config.text
    if (config.font !== undefined) this.font.value = config.font
    if (config.paragraph !== undefined) this.paragraph.value = config.paragraph
  }

  /** Fluent helper: add this text to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

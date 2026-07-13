// The Toolbar Item framework for EditableLine. A toolbar item is a plain data
// object: it says how to render itself, whether it is hidden/disabled/enabled
// for the current selection, and what to do when activated. Builtins and custom
// tools use the exact same shape, so the bar is fully pick / hide / reorder /
// extend-able (see EditableLineToolbar-items.ts for the builtin registry).
import type { Component, VNodeChild } from 'vue'
import type { Vector2d } from '@balage1551/konvex'
import type { PointInfo } from '../EditableLine-types'
import type { EditableLine } from '../EditableLine'

/** Three-state result of {@link EditableLineToolbarItem.state}. */
export type ToolbarItemState = 'hidden' | 'disabled' | 'enabled'

/** What the item's callbacks see: the line plus the live selection context. */
export interface EditableLineToolbarContext {
  line: EditableLine
  /** Selected point indices (mirrors {@link EditableLine.selection}). */
  selection: readonly number[]
  /** The selected points, resolved to their {@link PointInfo} rows. */
  points: PointInfo[]
  /** Where the toolbar was invoked, in the line's local/world space. */
  pointerWorld: Vector2d | null
  /** Where the toolbar was invoked, in client/viewport coordinates. */
  pointerScreen: Vector2d
}

/**
 * How an item paints itself in the bar. From least to most flexible:
 * - `'mdi-…'` — shorthand for an mdi glyph;
 * - `{ icon, class? }` — an mdi glyph with extra classes;
 * - `{ component, props? }` — any Vue control;
 * - `(ctx) => VNodeChild` — a render function (may vary with the selection).
 */
export type ToolbarItemRender =
  | string
  | { icon: string; class?: string | string[] }
  | { component: Component; props?: Record<string, unknown> }
  | ((ctx: EditableLineToolbarContext) => VNodeChild)

/** A single toolbar tool. `state`/`run` receive the live selection context. */
export interface EditableLineToolbarItem {
  /** Stable id — used for registry lookup, ordering and de-duplication. */
  id: string
  /** Accessible label / tooltip. */
  label?: string
  /** How to draw the item in the bar. */
  render: ToolbarItemRender
  /**
   * Visibility + enablement for the current context. Return `'hidden'` to omit
   * the item entirely, `'disabled'` to grey it out, `'enabled'` to allow it.
   * Defaults to `'enabled'` when omitted.
   */
  state?: (ctx: EditableLineToolbarContext) => ToolbarItemState
  /** The operation. Invoked only when {@link state} resolves to `'enabled'`. */
  run?: (ctx: EditableLineToolbarContext) => void
}

/**
 * An entry in a toolbar's item list: a builtin item id, the divider tokens
 * `'|'` / `'separator'`, or an inline {@link EditableLineToolbarItem}.
 */
export type ToolbarItemSpec = EditableLineToolbarItem | string

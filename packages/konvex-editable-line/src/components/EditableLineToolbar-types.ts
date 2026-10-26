// The Toolbar Item framework for EditableLine: konvex's generic context toolbar,
// specialised to a line. A toolbar item is a plain data object: it says how to
// render itself, whether it is hidden/disabled/enabled for the current
// selection, and what to do when activated. Builtins and custom tools use the
// exact same shape, so the bar is fully pick / hide / reorder / extend-able (see
// EditableLineToolbar-items.ts for the builtin registry).
import type {
  ContextToolbarItemRender,
  ContextToolbarItemSpec,
  ContextToolbarItemState,
  KonvexContextToolbarItem,
  Vector2d,
} from '@balage1551/konvex'
import type { PointInfo } from '../EditableLine-types'
import type { EditableLineHit } from '../EditableLine-events'
import type { EditableLine } from '../EditableLine'

/** Three-state result of {@link EditableLineToolbarItem.state}. */
export type ToolbarItemState = ContextToolbarItemState

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
  /** What was right-clicked to invoke it; see {@link EditableLineHit}. */
  hit: EditableLineHit | null
}

/**
 * How an item paints itself in the bar. From least to most flexible:
 * - `'mdi-…'` — shorthand for an mdi glyph;
 * - `{ icon, class? }` — an mdi glyph with extra classes;
 * - `{ component, props? }` — any Vue control;
 * - `(ctx) => VNodeChild` — a render function (may vary with the selection).
 */
export type ToolbarItemRender = ContextToolbarItemRender<EditableLineToolbarContext>

/** A single toolbar tool. `state`/`run` receive the live selection context. */
export interface EditableLineToolbarItem extends KonvexContextToolbarItem<EditableLineToolbarContext> {}

/**
 * An entry in a toolbar's item list: a builtin item id, the divider tokens
 * `'|'` / `'separator'`, or an inline {@link EditableLineToolbarItem}.
 */
export type ToolbarItemSpec = ContextToolbarItemSpec<EditableLineToolbarContext>

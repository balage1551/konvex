// The context-toolbar item framework. A toolbar item is a plain data object: it
// says how to render itself, whether it is hidden/disabled/enabled for the
// current context, and what to do when activated. `Ctx` is whatever the host
// hands the items — a node, a selection, what was clicked — so the same
// framework serves any right-clickable thing (EditableLine specialises it).
import type { Component, VNodeChild } from 'vue'

/** Three-state result of {@link KonvexContextToolbarItem.state}. */
export type ContextToolbarItemState = 'hidden' | 'disabled' | 'enabled'

/**
 * How an item paints itself in the bar. From least to most flexible:
 * - `'mdi-…'` — shorthand for an mdi glyph;
 * - `{ icon, class? }` — an mdi glyph with extra classes;
 * - `{ component, props? }` — any Vue control;
 * - `(ctx) => VNodeChild` — a render function (may vary with the context).
 */
export type ContextToolbarItemRender<Ctx> =
  | string
  | { icon: string; class?: string | string[] }
  | { component: Component; props?: Record<string, unknown> }
  | ((ctx: Ctx) => VNodeChild)

/** A single toolbar tool. `state`/`run` receive the live context. */
export interface KonvexContextToolbarItem<Ctx> {
  /** Stable id — used for registry lookup, ordering and de-duplication. */
  id: string
  /** Accessible label / tooltip. */
  label?: string
  /** How to draw the item in the bar. */
  render: ContextToolbarItemRender<Ctx>
  /**
   * Visibility + enablement for the current context. Return `'hidden'` to omit
   * the item entirely, `'disabled'` to grey it out, `'enabled'` to allow it.
   * Defaults to `'enabled'` when omitted.
   */
  state?: (ctx: Ctx) => ContextToolbarItemState
  /** The operation. Invoked only when {@link state} resolves to `'enabled'`. */
  run?: (ctx: Ctx) => void
  /**
   * Keep the bar open after {@link run} instead of dismissing it (default
   * `false`). For mode toggles and cycles, where the point is to see the new
   * state and possibly click again.
   */
  keepOpen?: boolean
}

/**
 * An entry in a toolbar's item list: the divider tokens `'|'` / `'separator'`,
 * the id of an item in the toolbar's `builtins`, or an inline item.
 */
export type ContextToolbarItemSpec<Ctx> = KonvexContextToolbarItem<Ctx> | string

/** Marker returned by {@link resolveContextToolbarItems} for a divider. */
export const CONTEXT_TOOLBAR_SEPARATOR = 'separator' as const
export type ContextToolbarSeparator = typeof CONTEXT_TOOLBAR_SEPARATOR

/**
 * Turn a list of specs into concrete items and separators. Strings resolve as
 * divider tokens (`'|'` / `'separator'`) or ids in `builtins`; unknown ids are
 * warned about and skipped. Inline item objects pass through untouched.
 */
export function resolveContextToolbarItems<Ctx>(
  specs: readonly ContextToolbarItemSpec<Ctx>[],
  builtins: Readonly<Record<string, KonvexContextToolbarItem<Ctx>>> = {},
): (KonvexContextToolbarItem<Ctx> | ContextToolbarSeparator)[] {
  const out: (KonvexContextToolbarItem<Ctx> | ContextToolbarSeparator)[] = []
  for (const spec of specs) {
    if (typeof spec === 'string') {
      if (spec === '|' || spec === CONTEXT_TOOLBAR_SEPARATOR) {
        out.push(CONTEXT_TOOLBAR_SEPARATOR)
        continue
      }
      const item = builtins[spec]
      if (item) out.push(item)
      else console.warn(`[KonvexContextToolbar] unknown item '${spec}'`)
      continue
    }
    out.push(spec)
  }
  return out
}

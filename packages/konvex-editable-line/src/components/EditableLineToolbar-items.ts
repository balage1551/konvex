// Builtin toolbar items + the registry/resolver that turns a `ToolbarItemSpec[]`
// into concrete items. These are the tools migrated from the v1 toolbar
// (delete + the six align actions), re-expressed in the item framework so they
// sit alongside any custom tools a host adds.
import { h } from 'vue'
import type { EditableLine } from '../EditableLine'
import type {
  EditableLineToolbarContext,
  EditableLineToolbarItem,
  ToolbarItemSpec,
} from './EditableLineToolbar-types'

/** Marker returned by {@link resolveToolbarItems} for a divider. */
export const TOOLBAR_SEPARATOR = 'separator' as const
export type ToolbarSeparator = typeof TOOLBAR_SEPARATOR

/**
 * Align the selected (movable) points along one axis. `axis: 'x'` gives every
 * point the same x (a vertical arrangement); `edge` picks min / midpoint / max.
 */
function alignSelected(line: EditableLine, axis: 'x' | 'y', edge: 'start' | 'center' | 'end'): void {
  const pts = line.pointInfos.value.filter(p => p.selected && p.movable !== false)
  if (pts.length < 2) return
  const values = pts.map(p => p[axis])
  const target =
    edge === 'start'
      ? Math.min(...values)
      : edge === 'end'
        ? Math.max(...values)
        : (Math.min(...values) + Math.max(...values)) / 2
  for (const p of pts) {
    line.movePoint(p.index, axis === 'x' ? { x: target, y: p.y } : { x: p.x, y: target })
  }
}

/** At least two movable points selected — the precondition for an align. */
function canAlign(ctx: EditableLineToolbarContext): 'disabled' | 'enabled' {
  const movable = ctx.points.filter(p => p.movable !== false).length
  return movable >= 2 ? 'enabled' : 'disabled'
}

function alignItem(
  id: string,
  label: string,
  icon: string,
  axis: 'x' | 'y',
  edge: 'start' | 'center' | 'end',
): EditableLineToolbarItem {
  return {
    id,
    label,
    render: { icon },
    state: canAlign,
    run: ctx => alignSelected(ctx.line, axis, edge),
  }
}

/** The delete item: removes every selected point. */
const deleteItem: EditableLineToolbarItem = {
  id: 'delete',
  label: 'Delete points',
  render: { icon: 'mdi-trash-can', class: 'eltb-icon-danger' },
  state: ctx => (ctx.selection.length ? 'enabled' : 'disabled'),
  run: ctx => ctx.line.removeSelected(),
}

/** Straighten: project the intermediate selected points onto the end-to-end line. */
const straightenItem: EditableLineToolbarItem = {
  id: 'straighten',
  label: 'Straighten',
  render: { icon: 'mdi-vector-line' },
  state: ctx => (ctx.selection.length >= 3 ? 'enabled' : 'disabled'),
  run: ctx => ctx.line.straightenSelection(),
}

/** Simplify: drop near-collinear points and merge dense clusters on the whole line. */
const simplifyItem: EditableLineToolbarItem = {
  id: 'simplify',
  label: 'Simplify',
  render: { icon: 'mdi-broom' },
  state: ctx => (ctx.line.pointCount >= 3 ? 'enabled' : 'disabled'),
  run: ctx => ctx.line.simplify(),
}

/** Toggle the line's `closed` flag — a selection-independent example item. */
const toggleClosedItem: EditableLineToolbarItem = {
  id: 'toggle-closed',
  label: 'Toggle closed',
  // A render function → stateful glyph reflecting the current closed/open state.
  render: ctx =>
    h('i', {
      class: [
        'eltb-icon',
        'mdi',
        ctx.line.line.closed.value ? 'mdi-vector-polygon' : 'mdi-vector-polyline',
      ],
    }),
  run: ctx => {
    ctx.line.line.closed.value = !ctx.line.line.closed.value
  },
}

/** All builtin items, keyed by id. Look these up by id in a `ToolbarItemSpec[]`. */
export const BUILTIN_TOOLBAR_ITEMS: Readonly<Record<string, EditableLineToolbarItem>> = {
  'align-h-start': alignItem(
    'align-h-start',
    'Align left',
    'mdi-format-horizontal-align-left',
    'x',
    'start',
  ),
  'align-h-center': alignItem(
    'align-h-center',
    'Align center',
    'mdi-format-horizontal-align-center',
    'x',
    'center',
  ),
  'align-h-end': alignItem(
    'align-h-end',
    'Align right',
    'mdi-format-horizontal-align-right',
    'x',
    'end',
  ),
  'align-v-start': alignItem(
    'align-v-start',
    'Align top',
    'mdi-format-vertical-align-top',
    'y',
    'start',
  ),
  'align-v-center': alignItem(
    'align-v-center',
    'Align middle',
    'mdi-format-vertical-align-center',
    'y',
    'center',
  ),
  'align-v-end': alignItem(
    'align-v-end',
    'Align bottom',
    'mdi-format-vertical-align-bottom',
    'y',
    'end',
  ),
  straighten: straightenItem,
  simplify: simplifyItem,
  delete: deleteItem,
  'toggle-closed': toggleClosedItem,
}

/** The default bar — reproduces the v1 toolbar (six aligns, divider, delete). */
export const DEFAULT_TOOLBAR_ITEMS: ToolbarItemSpec[] = [
  'align-h-start',
  'align-h-center',
  'align-h-end',
  'align-v-start',
  'align-v-center',
  'align-v-end',
  '|',
  'straighten',
  'simplify',
  '|',
  'delete',
]

/**
 * Turn a list of specs into concrete items and separators. Strings resolve as
 * divider tokens (`'|'` / `'separator'`) or builtin ids; unknown ids are warned
 * about and skipped. Inline item objects pass through untouched.
 */
export function resolveToolbarItems(
  specs: ToolbarItemSpec[],
): (EditableLineToolbarItem | ToolbarSeparator)[] {
  const out: (EditableLineToolbarItem | ToolbarSeparator)[] = []
  for (const spec of specs) {
    if (typeof spec === 'string') {
      if (spec === '|' || spec === TOOLBAR_SEPARATOR) {
        out.push(TOOLBAR_SEPARATOR)
        continue
      }
      const item = BUILTIN_TOOLBAR_ITEMS[spec]
      if (item) out.push(item)
      else console.warn(`[EditableLineToolbar] unknown builtin item '${spec}'`)
      continue
    }
    out.push(spec)
  }
  return out
}

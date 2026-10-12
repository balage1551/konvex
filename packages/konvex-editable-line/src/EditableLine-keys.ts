// EditableLine's keyboard contribution: the `editableLine.*` keys and their
// dispatcher. Registered with konvex's static key registry on first use.
import {
  COARSE_MOVE_FACTOR,
  registerKeyModule,
  type KeyContext,
  type KeyModule,
} from '@balage1551/konvex'
import type { EditableLine } from './EditableLine'

/** Every live EditableLine; the dispatcher picks the ones in editing mode on the keyed stage. */
const liveLines = new Set<EditableLine>()

/** @internal Called by EditableLine's constructor / destroy. */
export function trackEditableLine(line: EditableLine, live: boolean): void {
  if (live) liveLines.add(line)
  else liveLines.delete(line)
}

/** Lines in editing mode (`active`) on the stage the key was pressed on. */
function editingLines(ctx: KeyContext): EditableLine[] {
  const stage = ctx.stage.detach()
  return [...liveLines].filter(l => l.active.value && l.konvaRoot().getStage() === stage)
}

const ALIGN = /^editableLine\.node\.align\.(vertical|horizontal)\.(top|bottom|left|right|center)$/
const EDGE = { top: 'start', left: 'start', center: 'center', bottom: 'end', right: 'end' } as const
const MOVE = /^editableLine\.node\.(move|fineMove)\.(up|down|left|right)$/
const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const

/**
 * The `editableLine` keys (all active only while a line is in editing mode).
 * Priority 10: the node moves share the arrow strokes with `core.selection.move.*`
 * and must be asked first — with no point selected they decline, and the core
 * key moves the whole line instead.
 */
export const editableLineKeyModule: KeyModule = {
  namespace: 'editableLine',
  priority: 10,
  keys: {
    'node.move.up': 'Up',
    'node.move.down': 'Down',
    'node.move.left': 'Left',
    'node.move.right': 'Right',
    'node.fineMove.up': 'Ctrl+Up',
    'node.fineMove.down': 'Ctrl+Down',
    'node.fineMove.left': 'Ctrl+Left',
    'node.fineMove.right': 'Ctrl+Right',
    'node.select.all': 'Ctrl+A',
    'node.select.none': ['Ctrl+U', 'Escape'],
    // Aligns are Ctrl+L sequences (Ctrl+L alone is unbound, so no fallback delay).
    'node.align.vertical.top': 'Ctrl+L, T',
    'node.align.vertical.bottom': 'Ctrl+L, B',
    'node.align.vertical.center': 'Ctrl+L, V',
    'node.align.horizontal.left': 'Ctrl+L, L',
    'node.align.horizontal.right': 'Ctrl+L, R',
    'node.align.horizontal.center': 'Ctrl+L, H',
  },
  dispatch(ctx) {
    const lines = editingLines(ctx)
    if (ctx.key === 'editableLine.node.select.all') {
      lines.forEach(l => l.selectAll())
      return lines.length > 0
    }
    if (ctx.key === 'editableLine.node.select.none') {
      lines.forEach(l => l.clearSelection())
      return lines.length > 0
    }
    const move = MOVE.exec(ctx.key)
    if (move) {
      const targets = lines.filter(l => l.selection.value.length > 0)
      const step = ctx.movementUnit * (move[1] === 'move' ? COARSE_MOVE_FACTOR : 1)
      const dir = DIRECTIONS[move[2] as keyof typeof DIRECTIONS]
      targets.forEach(l => l.moveSelection({ x: dir.x * step, y: dir.y * step }))
      if (targets.length) ctx.view.contentChanged()
      return targets.length > 0
    }
    const align = ALIGN.exec(ctx.key)
    if (align) {
      // vertical.* lines points up on one y; horizontal.* on one x.
      const targets = lines.filter(l => l.selection.value.length > 0)
      const axis = align[1] === 'vertical' ? 'y' : 'x'
      targets.forEach(l => l.alignSelection(axis, EDGE[align[2] as keyof typeof EDGE]))
      return targets.length > 0
    }
    return false
  },
}

/** Register the `editableLine.*` keys (idempotent; EditableLine's constructor calls it). */
export function registerEditableLineKeys(): void {
  registerKeyModule(editableLineKeyModule)
}

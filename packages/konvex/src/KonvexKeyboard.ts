// Keyboard support: hierarchical key names, their stroke bindings, and the
// static module registry that dispatches them.
//
// A *key* is a hierarchical action name (`core.stage.zoom.in`,
// `editableLine.node.align.vertical.top`). A *binding* maps a key to zero or
// more keystrokes (`'Ctrl+Num+'`). Each module — core included — statically
// registers its keys (with default bindings) and one dispatcher; a
// `KonvexStageContainer` resolves the effective bindings from those defaults,
// an optional scheme and per-key overrides, and calls the dispatchers on keydown.
import type { KonvexBase } from './KonvexBase'
import { KonvexNode } from './KonvexNode'
import type { KonvexStage } from './KonvexStage'
import type { Vector2d } from './KonvexTypes'
import type { KonvexStageExpose } from './components/KonvexStage-types'

/**
 * One or more keystrokes, e.g. `'Ctrl+A'`, `'Shift+Ctrl+T'`, `'Ctrl+Num+'`,
 * `['Ctrl+Num+', 'Ctrl+=']`. An empty string / empty array / `null` means
 * *unbound* — the shortcut is turned off.
 *
 * An entry may be a *sequence* (chord) of strokes separated by commas:
 * `'Ctrl+K, T'` fires on Ctrl+K followed by T. (A comma right after `+` is the
 * comma key itself: `'Ctrl+,'`; the alias `Comma` also works.)
 *
 * Stroke syntax: any of the modifiers `Ctrl`, `Shift`, `Alt`, `Meta` (`Cmd`) and
 * `Mod` (Meta on macOS, Ctrl elsewhere), joined by `+`, then the key. The key is
 * a `KeyboardEvent.key` value (case-insensitive: `A`, `F2`, `Enter`, `PageUp`)
 * or one of the aliases `Up`/`Down`/`Left`/`Right` (also `CursorUp`…),
 * `Space`, `Esc`, `Del`, `Plus`, `Minus`, or the numpad keys `Num0`–`Num9`,
 * `Num+`, `Num-`, `Num*`, `Num/`, `Num.`, `NumEnter` (matched by
 * `KeyboardEvent.code`, so they never collide with the main-row keys).
 */
export type KeyBinding = string | readonly string[] | null

/**
 * A set of bindings keyed by key name. A key may also name a *group* (a prefix
 * such as `editableLine` or `core.selection`): an empty binding on a group turns
 * off every key below it.
 */
export type KeyScheme = Readonly<Record<string, KeyBinding>>

/** What a dispatcher is given when one of its keys fires. */
export interface KeyContext {
  /** The full key name that matched (e.g. `core.selection.move.up`). */
  readonly key: string
  /** The originating keyboard event. */
  readonly event: KeyboardEvent
  /** The stage the key was pressed on. */
  readonly stage: KonvexStage
  /** The stage container's public API (zoom, scroll, `moveNodes`, …). */
  readonly view: KonvexStageExpose
  /** The host-owned selection passed to the stage container. */
  readonly selection: readonly KonvexBase[]
  /** The stage's `movementUnit` (world units). */
  readonly movementUnit: number
}

/**
 * A module's keyboard contribution: its key names (relative to `namespace`)
 * with default bindings, and a dispatcher called when one of them is pressed.
 */
export interface KeyModule {
  /** Root of this module's key names (`core`, `editableLine`). Must be unique. */
  readonly namespace: string
  /**
   * When several keys share a stroke, modules with a higher priority are asked
   * first (default 0; ties keep registration order). An extension that refines a
   * core action — e.g. moving selected line points instead of the whole line —
   * uses a positive priority so it can claim the stroke and decline otherwise.
   */
  readonly priority?: number
  /** Relative key name → default binding (`'stage.zoom.in': 'Ctrl+Num+'`). */
  readonly keys: KeyScheme
  /**
   * Perform `ctx.key` (a full key name). Return `true` if it applied — the event
   * is then consumed — or `false` if it isn't active in the current state (no
   * selection, nothing in editing mode…), letting another binding of the same
   * stroke, or the browser, have it.
   */
  dispatch(ctx: KeyContext): boolean
}

// --- strokes ---------------------------------------------------------------

/** A parsed keystroke. `key` is lowercase `KeyboardEvent.key`, or a `code` when `byCode`. */
export interface KeyStroke {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
  byCode: boolean
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const KEY_ALIASES: Readonly<Record<string, string>> = {
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  cursorup: 'arrowup',
  cursordown: 'arrowdown',
  cursorleft: 'arrowleft',
  cursorright: 'arrowright',
  space: ' ',
  esc: 'escape',
  del: 'delete',
  plus: '+',
  minus: '-',
  comma: ',',
}

const NUMPAD_CODES: Readonly<Record<string, string>> = {
  'num+': 'NumpadAdd',
  'num-': 'NumpadSubtract',
  'num*': 'NumpadMultiply',
  'num/': 'NumpadDivide',
  'num.': 'NumpadDecimal',
  numenter: 'NumpadEnter',
}

const MODIFIER_RE = /^\s*(ctrl|control|shift|alt|option|meta|cmd|command|mod)\s*\+/i

/** Parse a stroke string; returns `null` (with a warning) for an empty or malformed one. */
export function parseKeyStroke(text: string): KeyStroke | null {
  const s: KeyStroke = { ctrl: false, shift: false, alt: false, meta: false, key: '', byCode: false }
  let rest = text
  let m: RegExpExecArray | null
  while ((m = MODIFIER_RE.exec(rest))) {
    const mod = m[1].toLowerCase()
    if (mod === 'ctrl' || mod === 'control') s.ctrl = true
    else if (mod === 'shift') s.shift = true
    else if (mod === 'alt' || mod === 'option') s.alt = true
    else if (mod === 'mod') {
      if (IS_MAC) s.meta = true
      else s.ctrl = true
    } else s.meta = true
    rest = rest.slice(m[0].length)
  }
  // Whatever remains is the key itself — so `Ctrl+Num+` and `Ctrl++` work.
  const name = rest.trim().toLowerCase()
  if (!name) {
    if (text.trim()) console.warn(`[konvex] invalid keystroke '${text}'`)
    return null
  }
  const numDigit = /^num([0-9])$/.exec(name)
  if (numDigit) {
    s.key = `Numpad${numDigit[1]}`
    s.byCode = true
  } else if (NUMPAD_CODES[name]) {
    s.key = NUMPAD_CODES[name]
    s.byCode = true
  } else {
    s.key = KEY_ALIASES[name] ?? name
  }
  return s
}

/** Whether a (partial) stroke text already names its key, i.e. isn't just modifiers. */
function hasKey(part: string): boolean {
  let rest = part
  let m: RegExpExecArray | null
  while ((m = MODIFIER_RE.exec(rest))) rest = rest.slice(m[0].length)
  return rest.trim() !== ''
}

/**
 * Parse a stroke sequence (`'Ctrl+K, T'`); `null` if any stroke is invalid. A
 * comma separates strokes once the current stroke has its key; before that it
 * *is* the key (`'Ctrl+,'`).
 */
export function parseKeySequence(text: string): KeyStroke[] | null {
  const parts: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ch === ',' && hasKey(cur)) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  const strokes: KeyStroke[] = []
  for (const part of parts) {
    const s = parseKeyStroke(part)
    if (!s) return null
    strokes.push(s)
  }
  return strokes
}

/** Whether `e` is exactly the keystroke `s` (modifiers must match exactly). */
export function matchesKeyStroke(s: KeyStroke, e: KeyboardEvent): boolean {
  if (s.ctrl !== e.ctrlKey || s.shift !== e.shiftKey || s.alt !== e.altKey || s.meta !== e.metaKey) {
    return false
  }
  return s.byCode ? e.code === s.key : e.key.toLowerCase() === s.key
}

function strokesOf(binding: KeyBinding | undefined): string[] {
  if (binding == null) return []
  return (typeof binding === 'string' ? [binding] : [...binding]).filter(b => b.trim() !== '')
}

// --- registry ----------------------------------------------------------------

const modules = new Map<string, KeyModule>()
let registryVersion = 0

/**
 * Register a module's keys and dispatcher. Idempotent per namespace (a second
 * registration of the same namespace replaces the first), so a module may call
 * it from a constructor.
 */
export function registerKeyModule(module: KeyModule): void {
  if (modules.get(module.namespace) === module) return
  modules.set(module.namespace, module)
  registryVersion++
}

/** All registered modules in dispatch order: by descending priority, then registration order. */
export function keyModules(): readonly KeyModule[] {
  return [...modules.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

/** Bumped on every registration; lets resolved binding tables detect staleness. */
export function keyRegistryVersion(): number {
  return registryVersion
}

/**
 * The registered default bindings as one scheme with full key names — a base to
 * spread into a custom scheme (`{ ...defaultKeyScheme(), 'core.stage.zoom.in': 'Ctrl+=' }`).
 */
export function defaultKeyScheme(): Record<string, KeyBinding> {
  const out: Record<string, KeyBinding> = {}
  for (const m of modules.values()) {
    for (const [rel, binding] of Object.entries(m.keys)) out[`${m.namespace}.${rel}`] = binding
  }
  return out
}

/**
 * Look up `key` in `scheme`: an exact entry wins; otherwise an empty entry on
 * any ancestor group turns it off. Returns `undefined` when the scheme says
 * nothing about it.
 */
function lookup(scheme: KeyScheme | undefined, key: string): KeyBinding | undefined {
  if (!scheme) return undefined
  if (Object.prototype.hasOwnProperty.call(scheme, key)) return scheme[key]
  const parts = key.split('.')
  for (let n = parts.length - 1; n > 0; n--) {
    const group = parts.slice(0, n).join('.')
    if (Object.prototype.hasOwnProperty.call(scheme, group) && strokesOf(scheme[group]).length === 0) {
      return null
    }
  }
  return undefined
}

/** One resolved binding: a stroke sequence (usually of one), the key it triggers and the owning module. */
export interface ResolvedKeyBinding {
  readonly strokes: readonly KeyStroke[]
  readonly key: string
  readonly module: KeyModule
}

/**
 * Resolve the effective bindings of every registered key. `scheme`, when given,
 * replaces the registered defaults wholesale (keys it doesn't mention are
 * unbound); `bindings` then overrides individual keys (or turns off groups).
 */
export function resolveKeyBindings(scheme?: KeyScheme, bindings?: KeyScheme): ResolvedKeyBinding[] {
  const out: ResolvedKeyBinding[] = []
  for (const module of keyModules()) {
    for (const [rel, def] of Object.entries(module.keys)) {
      const key = `${module.namespace}.${rel}`
      const override = lookup(bindings, key)
      const binding = override !== undefined ? override : scheme ? lookup(scheme, key) : def
      for (const text of strokesOf(binding)) {
        const strokes = parseKeySequence(text)
        if (strokes) out.push({ strokes, key, module })
      }
    }
  }
  return out
}

// --- core keys -----------------------------------------------------------------

/** Coarse selection moves (`core.selection.move.*`) step this many `movementUnit`s. */
export const COARSE_MOVE_FACTOR = 20

const DIRECTIONS: Readonly<Record<string, Vector2d>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** The builtin `core` keys: stage zoom and moving the host selection. */
export const coreKeyModule: KeyModule = {
  namespace: 'core',
  keys: {
    'stage.zoom.in': 'Ctrl+Num+',
    'stage.zoom.out': 'Ctrl+Num-',
    'selection.move.up': 'Up',
    'selection.move.down': 'Down',
    'selection.move.left': 'Left',
    'selection.move.right': 'Right',
    'selection.fineMove.up': 'Ctrl+Up',
    'selection.fineMove.down': 'Ctrl+Down',
    'selection.fineMove.left': 'Ctrl+Left',
    'selection.fineMove.right': 'Ctrl+Right',
  },
  dispatch(ctx) {
    switch (ctx.key) {
      case 'core.stage.zoom.in':
        ctx.view.zoomIn()
        return true
      case 'core.stage.zoom.out':
        ctx.view.zoomOut()
        return true
    }
    const move = /^core\.selection\.(move|fineMove)\.(up|down|left|right)$/.exec(ctx.key)
    if (move) {
      const nodes = ctx.selection.filter(n => n instanceof KonvexNode)
      if (!nodes.length) return false
      const step = ctx.movementUnit * (move[1] === 'move' ? COARSE_MOVE_FACTOR : 1)
      const dir = DIRECTIONS[move[2]]
      ctx.view.moveNodes(nodes, { x: dir.x * step, y: dir.y * step })
      return true
    }
    return false
  },
}

registerKeyModule(coreKeyModule)

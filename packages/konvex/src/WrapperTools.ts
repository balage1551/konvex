import {
  computed,
  customRef,
  isRef,
  onScopeDispose,
  toValue,
  watch,
  type EffectScope,
  type Ref,
  type WatchStopHandle,
  type WritableComputedRef,
} from 'vue'
import type Konva from 'konva'
import type {
  AttrSource,
  ChangeMode,
  NumberConstraint,
  NumberParameter,
  Vector2d,
  VectorParameter,
} from './KonvexTypes'

/**
 * WrapperTools — the reusable reactive-bridge primitives.
 *
 * konvex bridges two reactivity systems:
 *   - Konva is imperative with accessor methods: `node.x()` reads, `node.x(5)` writes.
 *   - Vue is reactive: effects re-run when their dependencies change.
 *
 * The design choice that makes everything else simple: **the Konva node is the
 * single source of truth.** We never keep a shadow copy of an attribute. A
 * `customRef` reads straight from the node (`get`) and writes straight to it
 * (`set`), using Vue's `track`/`trigger` to participate in reactivity. When
 * Konva mutates a value on its own (e.g. while dragging), we re-`trigger` from
 * the relevant Konva event so Vue effects re-read the fresh value.
 *
 * Nothing here knows about our class hierarchy — these are plain functions over
 * a Konva node, an effect scope, and a value source.
 */

let eventSeq = 0

/** True if a value is a reactive source (a ref or a getter) rather than a plain value. */
function isReactiveSource(value: unknown): value is Ref<unknown> | (() => unknown) {
  // No Konva attribute value is itself a function, so treating a function as a
  // getter is unambiguous.
  return isRef(value) || typeof value === 'function'
}

export interface NodeAttrOptions<TNode, T, W = T> {
  /** Konva accessor name. Defaults to the logical attribute name. */
  konvaKey?: string
  /** Custom read. Defaults to `node[konvaKey]()`. */
  read?: (node: TNode) => T
  /**
   * Custom write. Defaults to `node[konvaKey](value)`. Receives the *resolved*
   * write value `W`, which may be wider than the read type `T` (e.g. an
   * alteration rule the writer interprets down to a `T`).
   */
  write?: (node: TNode, value: W) => void
  /**
   * Konva events after which the value may have changed *externally* (without
   * going through our setter) — e.g. `['dragmove', 'dragend']` for `x`/`y`.
   * We re-trigger the ref on these so Vue re-reads the node.
   */
  syncOn?: readonly string[]
  /**
   * Set when the attribute's *value* is itself a function (e.g. `dragBoundFunc`).
   * The default heuristic treats any function as a getter source; with this on,
   * a bare function is written as the literal value and only a `Ref` counts as a
   * reactive source (getter sources aren't distinguishable here, so unsupported).
   */
  valueIsFunction?: boolean
}

/**
 * Bind a single Konva attribute as a writable ref.
 *
 * The returned ref reads/writes the live Konva value. Assigning it accepts an
 * {@link AttrSource}: a plain value writes once; a ref/getter sets up a watch
 * (in `scope`) that follows the source and pushes every change into Konva —
 * this is the "static value *or* a reference" behaviour. Re-assigning a
 * different source first tears down the previous binding so they don't stack.
 *
 * The read and write types are intentionally asymmetric: you *read* a resolved
 * `T`, but you *write* an `AttrSource<W>` (where `W` defaults to `T`, but may be
 * wider — e.g. a {@link NumberParameter} alteration rule, see {@link numberAttr}).
 */
export function nodeAttr<TNode extends Konva.Node, T, W = T>(
  node: TNode,
  name: string,
  scope: EffectScope,
  options: NodeAttrOptions<TNode, T, W> = {},
): Ref<T, AttrSource<W>> {
  const key = options.konvaKey ?? name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const read = options.read ?? ((n: any) => n[key]() as T)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const write = options.write ?? ((n: any, v: W) => n[key](v))

  // The watch created when a reactive source is bound to this attribute. Kept
  // so re-binding a different source can stop the previous one first.
  let delegateStop: WatchStopHandle | undefined

  return customRef<T>((track, trigger) => {
    for (const evt of options.syncOn ?? []) {
      node.on(`${evt}.kx2attr`, () => trigger())
    }
    return {
      get() {
        track()
        return read(node)
      },
      set(value) {
        const source = value as AttrSource<W>
        delegateStop?.()
        delegateStop = undefined
        const isSource = options.valueIsFunction ? isRef(source) : isReactiveSource(source)
        if (isSource) {
          delegateStop = scope.run(() =>
            watch(
              () => toValue(source),
              v => {
                write(node, v as W)
                trigger()
              },
              { immediate: true },
            ),
          )
        } else {
          write(node, source as W)
          trigger()
        }
      },
    }
  }) as unknown as Ref<T, AttrSource<W>>
}

/**
 * A read-only attribute derived from the node (e.g. `getClientRect()`).
 * It re-reads whenever any of `syncOn` fires; assigning to it is ignored.
 */
export function readonlyNodeAttr<TNode extends Konva.Node, T>(
  node: TNode,
  options: { read: (node: TNode) => T; syncOn?: readonly string[] },
): Readonly<Ref<T>> {
  return customRef<T>((track, trigger) => {
    for (const evt of options.syncOn ?? []) {
      node.on(`${evt}.kx2ro`, () => trigger())
    }
    return {
      get() {
        track()
        return options.read(node)
      },
      set() {
        console.warn('[konvex] ignored an attempt to write a read-only attribute')
      },
    }
  }) as Readonly<Ref<T>>
}

export interface Facet<S extends object> {
  /**
   * A stable reactive proxy over the backing fields. Reading `proxy.color`
   * reads the backing ref (reactive); writing `proxy.color = x` writes it
   * (straight through to Konva). Use this for per-field access.
   */
  readonly proxy: S
  /**
   * Replace the whole facet from a plain object. Missing keys are reset
   * (written as `undefined`, which lets each backing attribute fall back to its
   * Konva default) — i.e. whole-object assignment is a *replace*, not a patch.
   */
  assign(value: Partial<S> | undefined): void
}

/**
 * Build a {@link Facet} from a set of backing refs — the mechanism behind
 * structured parameters like `stroke`. Each logical sub-field maps to one
 * (node-bound) ref, so the facet adds no state of its own; it is purely a view.
 */
export function structuredFacet<S extends object>(fields: {
  [K in keyof S]: Ref<S[K]>
}): Facet<S> {
  const keys = Object.keys(fields) as (keyof S)[]

  const proxy = {} as S
  for (const key of keys) {
    Object.defineProperty(proxy, key, {
      enumerable: true,
      get: () => fields[key].value,
      set: (v: S[typeof key]) => {
        fields[key].value = v
      },
    })
  }

  function assign(value: Partial<S> | undefined): void {
    for (const key of keys) {
      fields[key].value = value?.[key] as S[typeof key]
    }
  }

  return { proxy, assign }
}

// ---------------------------------------------------------------------------
// Alteration rules: numeric attributes accept a value/ref/getter *or* a
// {@link NumberParameter} / {@link VectorParameter} that the writer interprets
// against the live Konva value (e.g. `{ mode: 'by', value: 5 }` = current + 5).
// ---------------------------------------------------------------------------

/** Reduce a {@link NumberParameter} to a concrete `{ mode, value }`. */
function interpretNumber(
  value: NumberParameter,
  def: number,
): { mode: 'by' | 'to'; value: number } {
  if (typeof value === 'number') return { mode: 'to', value }
  if (value === undefined || value.mode === 'reset') return { mode: 'to', value: def }
  return { mode: value.mode ?? 'to', value: value.value }
}

/** Clamp/round per {@link NumberConstraint}. Bounds may be getters. */
function constrain(value: number, c?: NumberConstraint): number {
  let result = value
  if (c?.min !== undefined) result = Math.max(result, typeof c.min === 'function' ? c.min() : c.min)
  if (c?.max !== undefined) result = Math.min(result, typeof c.max === 'function' ? c.max() : c.max)
  if (c?.round !== undefined) {
    const factor = Math.pow(10, c.round)
    result = Math.round(result * factor) / factor
  }
  return result
}

/** Resolve a {@link NumberParameter} against the current value into a number. */
function resolveNumber(
  original: number,
  value: NumberParameter,
  changeMode: ChangeMode,
  def: number,
  constraints?: NumberConstraint,
): number {
  const interpreted = interpretNumber(value, def)
  let result = interpreted.value
  if (interpreted.mode === 'by') {
    result = changeMode === 'multiply' ? original * interpreted.value : original + interpreted.value
  }
  return constrain(result, constraints)
}

export interface NumberAttrOptions {
  /** Konva accessor name. Defaults to the logical attribute name. */
  konvaKey?: string
  /** How `{ mode: 'by' }` combines with the current value. Default `'add'`. */
  changeMode?: ChangeMode
  /** Value used by `reset`/`undefined`. Defaults to 0 (add) or 1 (multiply). */
  defaultValue?: number
  /** Clamp/round applied after every write. */
  constraints?: NumberConstraint
  syncOn?: readonly string[]
}

/**
 * Like {@link nodeAttr} but for a numeric attribute that accepts an
 * {@link NumberParameter} alteration rule on write. Reads a plain `number`;
 * writes a value/ref/getter *or* a `by`/`to`/`reset` rule, interpreted against
 * the live Konva value (so `by` is relative and respects `changeMode`).
 */
export function numberAttr<TNode extends Konva.Node>(
  node: TNode,
  name: string,
  scope: EffectScope,
  options: NumberAttrOptions = {},
): Ref<number, AttrSource<NumberParameter>> {
  const key = options.konvaKey ?? name
  const changeMode = options.changeMode ?? 'add'
  const def = options.defaultValue ?? (changeMode === 'multiply' ? 1 : 0)
  return nodeAttr<TNode, number, NumberParameter>(node, name, scope, {
    konvaKey: key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    read: (n: any) => n[key]() as number,
    write: (n, value) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (n as any)[key]() as number
      const resolved = resolveNumber(original, value, changeMode, def, options.constraints)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (resolved !== original) (n as any)[key](resolved)
    },
    syncOn: options.syncOn,
  })
}

/** Split a {@link VectorParameter} into a per-axis pair of {@link NumberParameter}s. */
function splitVector(value: VectorParameter): { x: NumberParameter; y: NumberParameter } {
  if (value === undefined) return { x: undefined, y: undefined }
  if (typeof value === 'number') return { x: value, y: value }
  if (value.mode === 'reset') return { x: { mode: 'reset' }, y: { mode: 'reset' } }
  const mode = value.mode ?? 'to'
  if ('x' in value) return { x: { mode, value: value.x }, y: { mode, value: value.y } }
  return { x: { mode, value: value.value }, y: { mode, value: value.value } }
}

/**
 * Bundle two {@link numberAttr} refs into an `{ x, y }` writable computed that
 * accepts a {@link VectorParameter}. Reading yields a fresh `{ x, y }`; writing
 * splits the rule per axis and delegates to each scalar ref — so each axis
 * applies its own `changeMode`/constraints (e.g. `scale` multiplies).
 */
export function vectorParam(
  x: Ref<number, AttrSource<NumberParameter>>,
  y: Ref<number, AttrSource<NumberParameter>>,
): WritableComputedRef<Vector2d, VectorParameter> {
  return computed<Vector2d, VectorParameter>({
    get: () => ({ x: x.value, y: y.value }),
    set: value => {
      const parts = splitVector(value)
      x.value = parts.x
      y.value = parts.y
    },
  })
}

/**
 * Returns a setter that accepts an {@link AttrSource} and applies it via
 * `apply`. A plain value applies once; a ref/getter is watched (in `scope`)
 * and re-applied on change. Re-invoking stops the previous watch first.
 *
 * This is the delegation logic for *composite* targets (e.g. binding a whole
 * `Stroke` object or a `Stroke` ref), the counterpart to what {@link nodeAttr}
 * does for a single attribute.
 */
export function delegatableSetter<T>(
  scope: EffectScope,
  apply: (value: T) => void,
): (source: AttrSource<T>) => void {
  let stop: WatchStopHandle | undefined
  return source => {
    stop?.()
    stop = undefined
    if (isReactiveSource(source)) {
      stop = scope.run(() => watch(() => toValue(source), apply, { immediate: true }))
    } else {
      apply(source as T)
    }
  }
}

/**
 * Register a Konva event listener that is automatically removed when `scope`
 * is disposed (i.e. when the wrapper is destroyed). Returns an `off` function
 * for manual removal. Each registration gets a unique namespace so removing
 * one never disturbs another.
 */
export function bindKonvaEvent(
  node: Konva.Node,
  scope: EffectScope,
  eventName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: Konva.KonvaEventObject<any>) => void,
): () => void {
  const namespaced = `${eventName}.kx2evt${++eventSeq}`
  node.on(namespaced, handler)
  const off = () => node.off(namespaced)
  scope.run(() => onScopeDispose(off))
  return off
}

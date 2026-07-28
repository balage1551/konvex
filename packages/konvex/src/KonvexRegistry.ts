import type Konva from 'konva'
import type { AnyNode } from './KonvexTypes'

/**
 * Konva node → konvex wrapper lookup.
 *
 * Konva events carry Konva nodes: `event.target` in any handler is the raw
 * `Konva.Node`, never the wrapper that owns it. Without a way back, callers
 * bridge by hand — comparing against `detach()`, or keeping their own array of
 * children to `indexOf` the target in. This registry is that way back.
 *
 * A `WeakMap` keyed by the Konva node, so an entry can never keep a node alive;
 * {@link KonvexNode} registers itself on construction and drops the entry on
 * `destroy()`, so a lookup only ever yields a live wrapper.
 */
const registry = new WeakMap<Konva.Node, AnyNode>()

/** @internal — called by {@link KonvexNode}'s constructor. */
export function registerKonvexNode(node: Konva.Node, wrapper: AnyNode): void {
  registry.set(node, wrapper)
}

/** @internal — called by {@link KonvexNode.destroy}. */
export function unregisterKonvexNode(node: Konva.Node): void {
  registry.delete(node)
}

/**
 * The konvex wrapper for a Konva node, or `undefined` if there is none — a node
 * konvex never wrapped (a `Konva.Transformer`'s anchors, anything a host built
 * directly), or one whose wrapper has been destroyed.
 *
 * The typical use is resolving an event back to the object you reason about:
 *
 * ```ts
 * stage.onClick(e => {
 *   const hit = konvexOf(e.target)
 *   if (hit === stage) return   // the empty canvas
 *   select(hit)
 * })
 * ```
 */
export function konvexOf(node: Konva.Node | null | undefined): AnyNode | undefined {
  return node ? registry.get(node) : undefined
}

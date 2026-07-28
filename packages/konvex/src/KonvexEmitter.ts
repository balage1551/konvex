/**
 * A minimal typed emitter for konvex's own **signals** — the things that are not
 * Konva events.
 *
 * Konva's event system carries DOM events on Konva nodes, which makes it the
 * wrong shape for "this object is being destroyed" or "a child was added": the
 * payloads are konvex objects, not `MouseEvent`s, and there is no node to
 * dispatch on for something a konvex wrapper decides on its own. Rather than
 * bend one system to cover both, konvex keeps them side by side:
 *
 * | | Konva events | konvex signals |
 * | --- | --- | --- |
 * | bound with | `node.on('click', …)` | `node.signals.on('destroy', …)` |
 * | payload | `KonvexEventObject<DOMEvent>` | a plain typed object |
 * | bubbles | yes (most) | no |
 * | removed on destroy | yes (effect scope) | yes (`clear()`) |
 *
 * No framework dependency and no reactivity: a signal is a notification, not
 * state. Where konvex has state to expose it uses a ref instead — which is why
 * the child *list* is `childrenVersion`/`children` and not a stream of events.
 */
export type KonvexListener<T> = (payload: T) => void

export class KonvexEmitter<M> {
  private readonly _map = new Map<keyof M, Set<(p: never) => void>>()

  /** Subscribe. Returns an `off` function; calling it twice is harmless. */
  on<K extends keyof M>(name: K, listener: KonvexListener<M[K]>): () => void {
    let set = this._map.get(name)
    if (!set) {
      set = new Set()
      this._map.set(name, set)
    }
    const fn = listener as (p: never) => void
    set.add(fn)
    return () => {
      set!.delete(fn)
    }
  }

  /** Subscribe until the first delivery. */
  once<K extends keyof M>(name: K, listener: KonvexListener<M[K]>): () => void {
    const off = this.on(name, payload => {
      off()
      listener(payload)
    })
    return off
  }

  emit<K extends keyof M>(name: K, payload: M[K]): void {
    const set = this._map.get(name)
    if (!set) return
    // Snapshot so a listener that subscribes or unsubscribes mid-dispatch is
    // safe — including `once`, which removes itself before its body runs.
    for (const fn of [...set]) (fn as KonvexListener<M[K]>)(payload)
  }

  /** Drop every listener. Called for you when the owning object is destroyed. */
  clear(): void {
    this._map.clear()
  }
}

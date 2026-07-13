import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter, Vector2d } from './KonvexTypes'

/**
 * Where on the line {@link KonvexLine.project} searches:
 * - `internal` — the whole polyline body (any segment / vertex);
 * - `terminal` — the start and end vertices only;
 * - `start` / `end` — that one terminal vertex.
 */
export type LineProjectionScope = 'internal' | 'terminal' | 'start' | 'end'

/** Result of {@link KonvexLine.project}. */
export interface LineProjection {
  /** Projection point, in the line's parent (world) coordinate space. */
  point: Vector2d
  /**
   * Where a point at this projection belongs:
   * - `0 … n-1` — a real segment, between `p[segment]` and `p[segment+1]` (a body insert);
   * - `-1` — before the first point (a new first point); the terminal projection at p0;
   * - `n` — after the last point (a new last point); the terminal projection at p[n].
   */
  segment: number
  /** Fraction along `segment`, `0 ≤ proportion ≤ 1` (a vertex is 0 on one segment, 1 on the other). */
  proportion: number
  /** Distance from the query point to the projection. */
  distance: number
  /** Signed angle (deg, `−180 < angle ≤ 180`) from the (adjacent) segment to the query→projection line. */
  angle: number
}

export interface KonvexLineConfig extends KonvexShapeConfig {
  /** Flat list of coordinates relative to the node: `[x1, y1, x2, y2, ...]`. */
  points?: AttrSource<number[]>
  /** Curve tension (0 = straight segments). */
  tension?: AttrSource<NumberParameter>
  /** Close the path back to the first point (and fill it). */
  closed?: AttrSource<boolean>
  /** Treat `points` as cubic-bezier control points. */
  bezier?: AttrSource<boolean>
}

/**
 * Wraps a `Konva.Line` — a polyline / spline through `points`.
 *
 * Generic over the concrete `Konva.Line` subclass so {@link KonvexArrow} can
 * extend it and reuse this wiring, mirroring Konva (`Arrow extends Line`).
 */
export class KonvexLine<T extends Konva.Line = Konva.Line> extends KonvexShape<T> {
  readonly points: Ref<number[], AttrSource<number[]>>
  readonly tension: Ref<number, AttrSource<NumberParameter>>
  readonly closed: Ref<boolean, AttrSource<boolean>>
  readonly bezier: Ref<boolean, AttrSource<boolean>>

  /**
   * Polyline length in local geometry units (straight segments; ignores
   * tension/bezier). Includes the closing edge when {@link closed}.
   */
  readonly pixelLength: ComputedRef<number>
  /** {@link pixelLength} × {@link KonvexShape.unitScale} (the stage's measurement scale). */
  readonly scaledLength: ComputedRef<number>
  /**
   * Polygon area in local geometry units² via the shoelace formula (points are
   * treated as a closed ring regardless of {@link closed}); `0` for < 3 points.
   */
  readonly pixelArea: ComputedRef<number>
  /** {@link pixelArea} × {@link KonvexShape.unitScale}² (the stage's measurement scale). */
  readonly scaledArea: ComputedRef<number>

  /**
   * @param node escape hatch for subclasses to supply a `Konva.Line` subclass
   *   (e.g. `Konva.Arrow`); defaults to a plain `Konva.Line`.
   */
  constructor(config: KonvexLineConfig = {}, node: T = new Konva.Line() as T) {
    super(node, config)

    this.points = nodeAttr(this._node, 'points', this.scope)
    this.tension = numberAttr(this._node, 'tension', this.scope)
    this.closed = nodeAttr(this._node, 'closed', this.scope)
    this.bezier = nodeAttr(this._node, 'bezier', this.scope)
    if (config.points !== undefined) this.points.value = config.points
    if (config.tension !== undefined) this.tension.value = config.tension
    if (config.closed !== undefined) this.closed.value = config.closed
    if (config.bezier !== undefined) this.bezier.value = config.bezier

    this.pixelLength = computed(() => {
      const f = this.points.value
      const n = Math.floor(f.length / 2)
      let sum = 0
      for (let i = 0; i + 1 < n; i++) {
        sum += Math.hypot(f[(i + 1) * 2] - f[i * 2], f[(i + 1) * 2 + 1] - f[i * 2 + 1])
      }
      if (this.closed.value && n > 2) {
        sum += Math.hypot(f[0] - f[(n - 1) * 2], f[1] - f[(n - 1) * 2 + 1])
      }
      return sum
    })
    this.scaledLength = computed(() => this.pixelLength.value * this.unitScale.value)
    this.pixelArea = computed(() => {
      const f = this.points.value
      const n = Math.floor(f.length / 2)
      if (n < 3) return 0
      let s = 0
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        s += f[i * 2] * f[j * 2 + 1] - f[j * 2] * f[i * 2 + 1]
      }
      return Math.abs(s) / 2
    })
    this.scaledArea = computed(() => this.pixelArea.value * this.unitScale.value ** 2)
  }

  /** The `points` transformed into the line's parent (world) coordinate space. */
  worldPoints(): Vector2d[] {
    const flat = this.points.value
    const t = this.konvaRoot().getTransform()
    const out: Vector2d[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) out.push(t.point({ x: flat[i], y: flat[i + 1] }))
    return out
  }

  /**
   * Closest point on the (flat) line to `point` (given in parent/world coords),
   * restricted to `scope`. Tension/bezier are ignored. Returns `undefined` for a
   * line with fewer than two points.
   */
  project(point: Vector2d, scope: LineProjectionScope = 'internal'): LineProjection | undefined {
    const pts = this.worldPoints()
    const n = pts.length - 1 // segment count
    if (n < 1) return undefined

    // Clamped projection onto segment k, with its signed angle to the query line.
    const onSegment = (k: number): LineProjection => {
      const a = pts[k]
      const b = pts[k + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      let t = len2 > 0 ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const px = a.x + t * dx
      const py = a.y + t * dy
      const vx = px - point.x
      const vy = py - point.y
      return {
        point: { x: px, y: py },
        segment: k,
        proportion: t,
        distance: Math.hypot(vx, vy),
        angle: (Math.atan2(dx * vy - dy * vx, dx * vx + dy * vy) * 180) / Math.PI,
      }
    }
    // A terminal node as an *extension*: the new point becomes a new first/last
    // point, so the segment is the out-of-range -1 (before p0) or n (after p[n]).
    // The angle is taken against the adjacent real segment.
    const terminalAt = (which: 'start' | 'end'): LineProjection => {
      const realSeg = which === 'start' ? 0 : n - 1
      const a = pts[realSeg]
      const b = pts[realSeg + 1]
      const node = which === 'start' ? pts[0] : pts[n]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const vx = node.x - point.x
      const vy = node.y - point.y
      return {
        point: { x: node.x, y: node.y },
        segment: which === 'start' ? -1 : n,
        proportion: which === 'start' ? 1 : 0,
        distance: Math.hypot(vx, vy),
        angle: (Math.atan2(dx * vy - dy * vx, dx * vx + dy * vy) * 180) / Math.PI,
      }
    }

    if (scope === 'start') return terminalAt('start')
    if (scope === 'end') return terminalAt('end')
    if (scope === 'terminal') {
      const s = terminalAt('start')
      const e = terminalAt('end')
      return e.distance < s.distance ? e : s
    }

    // internal: closest segment. At a shared vertex both adjacent segments tie on
    // distance, so the smaller |angle| decides which segment owns the point.
    const EPS = 1e-6
    let best: LineProjection | undefined
    for (let k = 0; k < n; k++) {
      const c = onSegment(k)
      if (
        !best ||
        c.distance < best.distance - EPS ||
        (c.distance <= best.distance + EPS && Math.abs(c.angle) < Math.abs(best.angle))
      ) {
        best = c
      }
    }
    if (!best) return undefined

    // Landing on an actual endpoint isn't a body insert — there's no segment to
    // split past it — so it reports as an extension (a new first / last point).
    if (best.segment === 0 && best.proportion === 0) return { ...best, segment: -1, proportion: 1 }
    if (best.segment === n - 1 && best.proportion === 1) return { ...best, segment: n, proportion: 0 }
    return best
  }

  /** Fluent helper: add this line to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

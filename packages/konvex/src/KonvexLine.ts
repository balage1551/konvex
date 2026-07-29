import Konva from 'konva'
import { computed, type ComputedRef, type Ref } from 'vue'
import { KonvexShape, type KonvexShapeConfig } from './KonvexShape'
import { nodeAttr, numberAttr } from './WrapperTools'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource, NumberParameter, Vector2d } from './KonvexTypes'

/**
 * One place a point may go:
 * - `start` — before the first point (extending the line backwards);
 * - `internal` — anywhere along the body, splitting a segment;
 * - `end` — after the last point (extending it forwards).
 */
export type LineProjectionPart = 'start' | 'internal' | 'end'

/**
 * Where {@link KonvexLine.project} may land: any subset of the three parts.
 * `['start', 'internal', 'end']` allows a point anywhere; `['internal']`
 * restricts to the body; `[]` — spelled `'nowhere'` — allows nothing and projects
 * to `undefined`.
 */
export type LineProjectionScope = readonly LineProjectionPart[]

/**
 * The subsets worth naming — including every value the old string enum had, so
 * `'internal'` / `'terminal'` / `'start'` / `'end'` still mean what they did.
 */
export const LINE_PROJECTION_SCOPES = {
  /** The whole set: body or either end. The default. */
  anywhere: ['start', 'internal', 'end'],
  /** The body only — a query beyond an end clamps onto the terminal segment. */
  internal: ['internal'],
  /** Either end, never the body. */
  terminal: ['start', 'end'],
  start: ['start'],
  end: ['end'],
  /**
   * Nothing: every projection is refused. For a line that stays editable — points
   * move, select, align and delete — but takes no *new* points, which no subset of
   * the parts could express. Distinct from switching the add gestures off, since it
   * governs `project` itself, so the assist has nothing to preview either.
   */
  nowhere: [],
} as const satisfies Record<string, LineProjectionScope>

/** Name of a {@link LINE_PROJECTION_SCOPES} entry. */
export type LineProjectionScopeName = keyof typeof LINE_PROJECTION_SCOPES

/** A scope, or the name of a predefined one — accepted wherever a scope is taken. */
export type LineProjectionScopeInput = LineProjectionScope | LineProjectionScopeName

/** Canonical part order, so a resolved scope is comparable by identity of content. */
const ALL_PARTS: readonly LineProjectionPart[] = ['start', 'internal', 'end']

/**
 * Resolve a scope input to its set of parts, and **never** answer with an
 * accidentally-empty one.
 *
 * Only an explicit `[]` / `'nowhere'` resolves to empty. Everything unusable —
 * `undefined`, `null`, a non-array, an unknown name, or an array naming no real
 * part — resolves to `'anywhere'`, because an empty scope silently disables every
 * add gesture and the assist with it: the *most* restrictive outcome, and a
 * terrible reading of "I could not understand this value". Recognised parts are
 * de-duplicated and returned in {@link ALL_PARTS} order.
 */
export function lineProjectionParts(scope?: LineProjectionScopeInput | null): LineProjectionScope {
  if (typeof scope === 'string') {
    // The type says this is a known name; a JS caller can still pass anything.
    return LINE_PROJECTION_SCOPES[scope] ?? LINE_PROJECTION_SCOPES.anywhere
  }
  if (!Array.isArray(scope)) return LINE_PROJECTION_SCOPES.anywhere
  // Empty on purpose is the one legal way to say "nothing", so it survives.
  if (scope.length === 0) return LINE_PROJECTION_SCOPES.nowhere
  const parts = ALL_PARTS.filter(part => scope.includes(part))
  // Non-empty but naming nothing real ( ['bogus'] ) is garbage, not `nowhere`.
  return parts.length > 0 ? parts : LINE_PROJECTION_SCOPES.anywhere
}

/** Result of {@link KonvexLine.project}. */
export interface LineProjection {
  /** Projection point, in the line's parent (world) coordinate space. */
  point: Vector2d
  /**
   * Where a point at this projection belongs. Which values can occur is bounded
   * by the parts in scope — never inferred from where the query happened to fall:
   * - `0 … n-1` — a real segment, between `p[segment]` and `p[segment+1]` (a body
   *   insert). Requires `internal`. Without `start`/`end` in scope, a query
   *   beyond either end reports this too, clamped onto the terminal vertex.
   * - `-1` — before the first point (a new first point). Requires `start`.
   * - `n` — after the last point (a new last point). Requires `end`.
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

  /**
   * A line's box comes from its geometry, not from `width`/`height`, so
   * `clientRect` has to follow the points — otherwise editing a polyline in place
   * (which is exactly what `EditableLine` does) leaves the box where the line
   * used to be. `tension`/`closed` reshape the curve through the same points.
   */
  protected override trackGeometry(): void {
    super.trackGeometry()
    void this.points.value
    void this.tension.value
    void this.closed.value
    void this.bezier.value
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
   * among the parts in `scope` — every part by default. Tension/bezier are
   * ignored. The scope goes through {@link lineProjectionParts}, so an
   * unrecognised value reads as `'anywhere'` rather than as "nothing".
   *
   * Returns `undefined` in two cases a caller usually has to tell apart: a line
   * with **fewer than two points** (nothing to project onto *yet*), and a scope of
   * `'nowhere'` (**nothing is allowed**, now or later). Falling back to "append the
   * point" is right for the first and wrong for the second — check
   * `lineProjectionParts(scope).length` to distinguish them.
   */
  project(
    point: Vector2d,
    scope: LineProjectionScopeInput = 'anywhere',
  ): LineProjection | undefined {
    const pts = this.worldPoints()
    const n = pts.length - 1 // segment count
    if (n < 1) return undefined
    const parts = lineProjectionParts(scope)
    const wantStart = parts.includes('start')
    const wantInternal = parts.includes('internal')
    const wantEnd = parts.includes('end')
    if (!wantStart && !wantInternal && !wantEnd) return undefined

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

    // Every allowed part is a candidate; the nearest one wins.
    let best: LineProjection | undefined
    const consider = (c: LineProjection): void => {
      if (!best || c.distance < best.distance) best = c
    }

    if (wantInternal) {
      // Closest segment. At a shared vertex both adjacent segments tie on
      // distance, so the smaller |angle| decides which segment owns the point.
      const EPS = 1e-6
      let body: LineProjection | undefined
      for (let k = 0; k < n; k++) {
        const c = onSegment(k)
        if (
          !body ||
          c.distance < body.distance - EPS ||
          (c.distance <= body.distance + EPS && Math.abs(c.angle) < Math.abs(body.angle))
        ) {
          body = c
        }
      }
      // Each segment projection is clamped, so any query past an end lands exactly
      // on that terminal vertex. There is no segment to split out there, so if the
      // end is in scope the honest answer is the extension. If it is *not* in
      // scope the caller has said "body only", and it stays a body insert into the
      // terminal segment — which is what made `internal` alone stop extending.
      if (body) {
        if (wantStart && body.segment === 0 && body.proportion === 0) body = terminalAt('start')
        else if (wantEnd && body.segment === n - 1 && body.proportion === 1) {
          body = terminalAt('end')
        }
        consider(body)
      }
    }
    // A terminal only wins on a strictly shorter distance, so a body insert keeps
    // ties — otherwise every query would snap to an end the moment it drew level.
    if (wantStart) consider(terminalAt('start'))
    if (wantEnd) consider(terminalAt('end'))
    return best
  }

  /** Fluent helper: add this line to a layer and return it. */
  insertInto(layer: KonvexLayer, index?: number): this {
    layer.add(this, index)
    return this
  }
}

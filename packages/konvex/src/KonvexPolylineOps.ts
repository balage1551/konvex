// Pure polyline geometry — operates on plain `Vector2d[]`, no konvex nodes or
// Vue reactivity involved, so these are trivially testable and reusable outside
// EditableLine. Kept in core konvex (never depends on the editableline package).
import type { Vector2d } from './KonvexTypes'

function dist(a: Vector2d, b: Vector2d): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function centroid(points: Vector2d[]): Vector2d {
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

/** Angle (degrees, 0–180) at `vertex` between the rays vertex→p1 and vertex→p2. */
function angleAtDeg(vertex: Vector2d, p1: Vector2d, p2: Vector2d): number {
  const v1x = p1.x - vertex.x
  const v1y = p1.y - vertex.y
  const v2x = p2.x - vertex.x
  const v2y = p2.y - vertex.y
  const m1 = Math.hypot(v1x, v1y)
  const m2 = Math.hypot(v2x, v2y)
  if (m1 === 0 || m2 === 0) return 0
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Foot of the perpendicular from `p` onto the infinite line through `a` and `b`. */
export function projectPointOntoLine(p: Vector2d, a: Vector2d, b: Vector2d): Vector2d {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return { x: a.x, y: a.y }
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  return { x: a.x + t * abx, y: a.y + t * aby }
}

/**
 * Straighten a polyline: keep the first and last point, and project every point
 * in between onto the (infinite) line through them. Returns a new array of the
 * same length; input is not mutated.
 */
export function straightenPoints(points: Vector2d[]): Vector2d[] {
  if (points.length < 3) return points.map(p => ({ x: p.x, y: p.y }))
  const a = points[0]
  const b = points[points.length - 1]
  return points.map((p, i) =>
    i === 0 || i === points.length - 1 ? { x: p.x, y: p.y } : projectPointOntoLine(p, a, b),
  )
}

/** Thresholds for {@link simplifyPoints}. */
export interface SimplificationThreshold {
  /**
   * Max base angle in degrees: a middle point `B` between `A` and `C` is dropped
   * as near-collinear when both ∠BAC and ∠BCA fall below this. Default `5`.
   */
  angle?: number
  /**
   * Cluster radius in the polyline's coordinate units (≈ pixels at zoom 1): a run
   * of consecutive points that are *all* pairwise within this distance collapses
   * to their centroid. Default `10`.
   */
  distance?: number
}

export const DEFAULT_SIMPLIFICATION: Required<SimplificationThreshold> = { angle: 5, distance: 10 }

/** Drop near-collinear middle points (both base angles below `maxAngle`). */
function removeNearCollinear(points: Vector2d[], maxAngle: number): Vector2d[] {
  if (points.length < 3) return points.map(p => ({ x: p.x, y: p.y }))
  const result: Vector2d[] = [{ x: points[0].x, y: points[0].y }]
  for (let i = 1; i < points.length - 1; i++) {
    const a = result[result.length - 1] // previous *kept* point
    const b = points[i]
    const c = points[i + 1]
    // B sits almost on line A–C ⇔ the triangle is flat ⇔ both base angles tiny.
    if (angleAtDeg(a, b, c) < maxAngle && angleAtDeg(c, b, a) < maxAngle) continue
    result.push({ x: b.x, y: b.y })
  }
  result.push({ x: points[points.length - 1].x, y: points[points.length - 1].y })
  return result
}

/**
 * Merge runs of consecutive points into their centroid. A point joins the
 * current run only when it is within `maxDist` of *every* member already in it,
 * so an entire run fits inside a `maxDist` diameter before it collapses.
 */
function mergeClusters(points: Vector2d[], maxDist: number): Vector2d[] {
  if (points.length === 0) return []
  const result: Vector2d[] = []
  let cluster: Vector2d[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (cluster.every(q => dist(p, q) < maxDist)) cluster.push(p)
    else {
      result.push(centroid(cluster))
      cluster = [p]
    }
  }
  result.push(centroid(cluster))
  return result
}

/**
 * Simplify a polyline: first drop near-collinear points (by {@link
 * SimplificationThreshold.angle}), then merge dense clusters to their centroid
 * (by {@link SimplificationThreshold.distance}). Returns a new array; input is
 * not mutated.
 */
export function simplifyPoints(
  points: Vector2d[],
  threshold?: SimplificationThreshold,
): Vector2d[] {
  const angle = threshold?.angle ?? DEFAULT_SIMPLIFICATION.angle
  const distance = threshold?.distance ?? DEFAULT_SIMPLIFICATION.distance
  return mergeClusters(removeNearCollinear(points, angle), distance)
}

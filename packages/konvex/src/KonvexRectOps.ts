// Pure rect geometry for the stage's drag clamp — no konvex nodes and no Vue
// reactivity, so it is directly testable. Internal: deliberately not re-exported
// from `index.ts`, since it exists to keep the clamp rule out of the component.
import type { Vector2d } from './KonvexTypes'

/** The `{ x, y, width, height }` shape shared with Konva's client rects. */
export interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The `(dx, dy)` that brings `r` fully inside `bounds` — `{ 0, 0 }` when it
 * already is.
 *
 * Each axis is pushed back from the far edge first and the near edge second, so
 * when `r` is *larger* than `bounds` the near (top/left) edge wins and the
 * overflow hangs off the far side. That keeps oversized content anchored at the
 * world origin instead of drifting to the opposite corner.
 */
export function clampRectDelta(r: RectLike, bounds: RectLike): Vector2d {
  let dx = 0
  let dy = 0
  if (r.x + r.width > bounds.x + bounds.width) dx = bounds.x + bounds.width - (r.x + r.width)
  if (r.y + r.height > bounds.y + bounds.height) dy = bounds.y + bounds.height - (r.y + r.height)
  if (r.x + dx < bounds.x) dx = bounds.x - r.x
  if (r.y + dy < bounds.y) dy = bounds.y - r.y
  return { x: dx, y: dy }
}

/**
 * A `dragBoundFunc` body, as pure arithmetic.
 *
 * Konva hands a `dragBoundFunc` absolute (stage) coordinates, while the world
 * rect is in world units — so the proposed move is converted through
 * `worldScale` (the world layer's absolute scale, i.e. the zoom), compared in
 * world units, and the correction converted back.
 *
 * @param bboxWorld  the node's current bounding box, in world units
 * @param currentAbs the node's current absolute position
 * @param proposedAbs the absolute position Konva wants to move it to
 * @param worldScale the world layer's absolute scale
 * @param bounds     the world rect, in world units
 */
export function clampDragAbsolute(
  bboxWorld: RectLike,
  currentAbs: Vector2d,
  proposedAbs: Vector2d,
  worldScale: number,
  bounds: RectLike,
): Vector2d {
  if (!worldScale) return proposedAbs
  const proposed = {
    x: bboxWorld.x + (proposedAbs.x - currentAbs.x) / worldScale,
    y: bboxWorld.y + (proposedAbs.y - currentAbs.y) / worldScale,
    width: bboxWorld.width,
    height: bboxWorld.height,
  }
  const d = clampRectDelta(proposed, bounds)
  if (!d.x && !d.y) return proposedAbs
  return { x: proposedAbs.x + d.x * worldScale, y: proposedAbs.y + d.y * worldScale }
}

---
"@balage1551/konvex-editable-line": minor
---

Emit point events from `EditableLine`: `point-added`, `point-removed`, `point-moved`, `points-replaced`.

The line's points are what an `EditableLine` manages, and a host had no way to be told about them. It could `watch(el.line.points)` and diff arrays itself, or watch `el.pointInfos`, but the class knew exactly what had happened — which index, from where to where — and threw that away. Konva has no event for a shape's geometry, and the container signals an `EditableLine` inherits describe its internal structure (the line, the assist group, the handle group), not its points, so these are konvex-side events on the existing `el.events` emitter.

| Event | Payload | Fired by |
| --- | --- | --- |
| `point-added` | `{ index, point, count }` | `addPoint`, `insertPoint`, the click/double-click add gestures |
| `point-removed` | `{ index, point, count }` — where it *was* | `removePoint`, `removeSelected` (one per point, highest index first) |
| `point-moved` | `{ index, point, from, dragging }` | a drag, `movePoint`, `straightenSelection` |
| `points-replaced` | `{ count }` | a write to `line.points`, or `simplify()` |

Each is emitted after the edit has settled, so a handler reading `pointCount`/`pointInfos` sees the result rather than a half-applied state. A move to a point's current position emits nothing.

`point-moved` during a drag is a **stream**: one event per moved point per frame, with `from` being the previous frame so deltas accumulate, and a multi-point drag moves the whole selection at once. `dragging` separates that from a settled one-shot move.

`points-replaced` is deliberately coarse. When the array is swapped wholesale the old and new points cannot be matched up without guessing, so no per-point events are invented for it — index-keyed state should be re-read. `simplify()` reports the same way: which points survive a reshape is not expressible as a sequence of removals.

To make that distinction reliable rather than best-effort, every write to the geometry now goes through one private `writePoints()`, which marks the write as EL's own. The wholesale-replace watch consumes that marker, so an edit made through EL's API can never also surface as a replacement, and a write a host makes directly can never pass silently.

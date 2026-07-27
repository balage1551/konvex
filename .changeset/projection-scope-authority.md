---
"@balage1551/konvex": minor
---

**Behaviour change:** `KonvexLine.project()` no longer promotes an `'internal'` projection to a terminal extension.

Previously, if the closest point on the body happened to land exactly on the first or last vertex, the result was rewritten to the out-of-range `segment: -1` / `segment: n` that mean "extend the line". Because each segment projection is clamped, that is true of *any* query beyond either end — so `'internal'` silently reported an extension for most of the canvas, and callers who asked for a body insert got an append.

The rewrite was only ever reachable under `'internal'` (the other scopes return before it), so it was wrong every time it ran. The scope alone now fixes which `segment` values can come back: `'internal'` reports `0 … n-1` and nothing else; `-1` / `n` come only from `'start'` / `'end'` / `'terminal'`.

If you relied on the old behaviour to detect "beyond the end", ask for it explicitly with `'terminal'`.

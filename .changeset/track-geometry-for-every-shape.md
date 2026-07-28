---
"@balage1551/konvex": patch
---

Finish `clientRect`: every shape's box now follows the attributes that actually move it.

`trackGeometry()` arrived with containers and lines; the rest of the shapes still reported a stale box when their geometry changed, because Konva derives their size from attributes the node's transform never sees — a circle's `width` *is* `radius * 2`, but growing the radius fires `radiusChange`, not `widthChange`. A stale child box propagated into its container, so this also limited the container fix.

Each shape now reads what Konva's own `getSelfRect` reads, which is where the per-shape choices come from rather than guesswork:

- **`KonvexShape`** — `strokeColor`, `strokeWidth`, `strokeEnabled`: `getClientRect` grows the box by the stroke when `hasStroke()` is true, so the paint that decides *whether* there is a stroke is geometry here. Every shape inherits this.
- **radius families** — `KonvexCircle` (`radius`), `KonvexEllipse` (`radiusX/Y`), `KonvexRing` (`outerRadius` — the hole moves nothing), `KonvexWedge` (`radius`; Konva boxes a wedge by its whole circle, so the angle does not count), `KonvexStar` (`outerRadius`), `KonvexArc` (`inner/outerRadius`, `angle`, `clockwise` — an arc has a real self-rect trimmed to the swept sector, so all four move an edge), `KonvexRegularPolygon` (`radius` *and* `sides`, since the box is the hull of the generated vertices).
- **geometry as data** — `KonvexPath` (`data`), `KonvexArrow` (`pointerWidth`, on top of the line's points).
- **text** — `KonvexText` and `KonvexTextPath` read the text and font cluster directly rather than through `textWidth`/`textHeight`: those are convenient, but `textHeight` calls a Konva method that warns as deprecated, and this code runs on every box read.
- **`KonvexImage`** — `image`, since with no explicit size Konva falls back to the image's natural dimensions.
- **`KonvexTag`** — `pointerDirection`, `pointerWidth`, `pointerHeight`, which extend the self-rect on the side the pointer sticks out of.

Deliberately *not* dependencies, and asserted as such: `cornerRadius` (rounds corners inside the box) and a sprite's `frameIndex` (Konva boxes a sprite by its `width`/`height` attributes, not the frame). Adding them would invalidate the box for nothing.

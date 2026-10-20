---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

Add arrowheads to `EditableLine`, and the render-only line trimming they rest on.

**Arrowheads.** `startHead` / `endHead` (config and live refs) put a head on either end. Built-in shapes are `triangle`, `open` (two strokes meeting at the tip — not an unfilled triangle), `diamond` and `circle`; a factory can return any konvex shape or group instead, drawn in a tip-at-origin frame that EL places and rotates. `size` is the extent along the line and `ratio` (length ÷ width) shapes every head alike. `offset` holds the tip clear of a circular object sitting on the end point, measured along the line, so it carries on round a corner. `atEveryPoint` repeats a head at every internal point as well, on that point's own segment — an end head on the segment arriving there, pointing forward; a start head on the one leaving, pointing back — with the line running through them. Paint is konvex's structured `fill` / `stroke`, defaulting to the line's stroke colour (filled shapes) or its stroke (`open`); a given `stroke` is merged field by field over the line's.

The line is shortened under a head — to its base by default, to its tip for `open` — so a thick stroke no longer shows past the tip, and the line stops at the object rather than running under it. Heads are part of the line for interaction: right-click asks for the toolbar and Alt+click commits, as on the line itself. They are not drawn on a closed or curved (`tension` / `bezier`) line, nor when the two would not both fit; in that case the line still stops at the offsets.

Heads scale with zoom through a new `'decoration'` scalable component. **The default `scalableComponents` is now `['line', 'decoration']`** (was `['line']`), which changes nothing for a line without heads. A host that passes its own list and wants heads to scale should add `'decoration'`; without it, `size` is in screen pixels.

New toolbar items `arrow-start` / `arrow-end` flip only a head's `show`, so it comes back as it was. They are disabled where heads are never drawn.

**Core.** `KonvexLine.trimStart` / `trimEnd` leave length undrawn at either end. Only the stroke and its hit region change — `points`, `project`, `pixelLength` and `clientRect` keep the real vertices — and an untrimmed line keeps Konva's own draw. It applies to open straight lines and is ignored by `KonvexArrow`. New pure helpers on flat point lists: `polylineAnchor(flat, end, distance)` (a point along the line from an end, facing out of it) and `trimPolyline(flat, start, end)`.

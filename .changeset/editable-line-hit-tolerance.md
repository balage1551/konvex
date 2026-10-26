---
"@balage1551/konvex-editable-line": minor
---

Add `hitTolerance` (config and live ref, default `2`): extra screen pixels on each side of the stroke that still count as a click on the line, at any zoom. It sets the line's `hitStrokeWidth`, and is ignored when `line` gives its own.

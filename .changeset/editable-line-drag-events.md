---
"@balage1551/konvex-editable-line": minor
---

Stream handle drags: `point-drag-start { index, indices, from }`, `point-moving { index, point, from }` every frame for the anchor point, and `point-drag-end { index, point, from, cancelled }` before the drag's `point-moved`. `cancelled` is `true` when a point added or removed mid-drag cut the drag short.

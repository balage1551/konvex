---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": patch
---

Fix dragging content out of the world, and the handle/value desync it caused.

`clipped` now keeps dragged objects inside the world, like `bounded` does. Previously only `bounded` constrained drags, so in `clipped` a node's coordinates went wherever the cursor did and the part outside was simply hidden by the clip — leaving the stored position outside the scene with nothing on screen to say so.

More importantly, the constraint now runs as a `dragBoundFunc` rather than as a correction on `dragmove`. Correcting afterwards cannot work: Konva derives each frame's drag position from the pointer rather than from where the node currently sits, so it re-places the node at the cursor every frame, and any `dragmove` handler on the node itself has already read the unconstrained value. For composite objects that was visible corruption — dragging an `EditableLine` handle past the edge let the line write its point at the cursor and the clamp then pulled only the handle back, so the handle sat on the edge while the stored point was outside the world. Constraining before the position lands fixes the mode and the desync together.

A node's own `dragBoundFunc` (an axis lock, say) is composed with rather than replaced, and is restored when the drag ends.

Because the constraint is installed when the stage sees `dragstart`, a child that swallows that event escapes it entirely — which `EditableLine`'s point handles did (`cancelBubble = true`), leaving handle drags unconstrained in both modes. They no longer cancel it. The group-level `dragstart` handler they were shielding sets the same two fields the handle handler already sets, so nothing else changes. `dragmove` and `dragend` were never cancelled, which is why the old post-hoc clamp appeared to work while corrupting the point.

As a safety net the constraint is also installed on the first `dragmove` if `dragstart` never arrived, so a child cancelling that event costs one frame of accuracy rather than the constraint altogether.

The clamp rule itself moved into pure `clampRectDelta(rect, bounds)` and `clampDragAbsolute(...)` helpers — the latter carrying the absolute↔world conversion — so both are covered by tests instead of being buried in the component.

---
"@balage1551/konvex-editable-line": patch
---

Make `simplify`, `straighten` and the align tools honour per-point movement rules, and cancel a rubber band when the line goes inactive.

**`simplify()` could delete a pinned point.** It handed the whole polyline to `simplifyPoints`, which knows nothing about `movable: false` — so a point the caller had declared immovable could be dropped or averaged away by a toolbar button. Each run *between* pinned points is now simplified on its own, and since a run's endpoints are preserved every pin survives exactly where it was. Pinned points also keep their per-point overrides now; the rest are still cleared, as documented, because indices change.

**`straightenSelection()` and the six align tools only respected `movable: false`.** A point locked to `'x'` or `'y'` may travel along that axis only — which a *drag* has always honoured — but straighten projected it in both axes and an align rewrote whichever coordinate it pleased, sliding the point off its rail. Straighten now keeps the locked coordinate, and an align skips points locked to the *other* axis (and its enabled/disabled state counts the same points, so the button no longer offers an action it will not perform).

**A rubber band outlived its gesture.** Deactivating the line mid-band left the selection box on screen, the band state armed, and a `mouseup` listener on `window` that fired on the next click anywhere and rewrote the selection of a line the user had already left. Deactivation now cancels the band — dropping it without applying it, which is what an interrupted gesture means.

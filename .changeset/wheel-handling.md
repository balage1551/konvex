---
"@balage1551/konvex": patch
---

Fix three things about `<KonvexStageContainer>`'s wheel handling.

**A page could never scroll past the stage.** `preventDefault()` ran on every wheel event, including the ones the viewport had no room to act on — so once it was scrolled to the end, the wheel went nowhere instead of continuing the page scroll, and a stage in a long document became a dead zone. It is now called only when the scroll position actually moved.

**`zoomOnWheel: false` swallowed ctrl+wheel.** The zoom branch tested `e.ctrlKey && props.zoomOnWheel`, so with zooming off a ctrl+wheel fell through and was consumed as a scroll — the browser's own zoom gesture did nothing at all. Ctrl+wheel is now left alone unless we take it to zoom.

**`deltaMode` was never normalised.** Firefox reports wheel deltas in *lines* (about 3 per notch) where Chrome reports pixels (about 100), so scrolling over the stage crawled at ~3px a notch there. Deltas are converted to pixels first: a line as 16px, a page as the viewport height. The zoom branch is unaffected, since it only reads the sign.

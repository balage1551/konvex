---
"@balage1551/konvex": patch
---

Three fixes to `<KonvexStageContainer>`'s zoom plumbing.

**The exposed `zoomLevel` was not reactive.** It read a plain `let`, so a template or computed reading `kx.zoomLevel` never re-evaluated — a host had to listen for the `zoom` event and mirror it into its own state. It is backed by a ref now, which is how every other value konvex exposes works, so reading it is enough.

**The zoom bounds were not watched.** `minZoom`/`maxZoom` are props, but nothing reacted to them: lowering `maxZoom` below the current level left the view zoomed past its own limit until the next zoom action. Changing either now re-clamps. (`zoomLevels` deliberately gets no watch — it only feeds stepping and snapping, which read it when they run.)

**A resize emitted zoom events that hadn't happened.** Every `ResizeObserver` tick re-clamps the level, since a bigger viewport lowers the `'fit'` floor, and the commit path emitted `zoom` and `update:zoomLevel` unconditionally — so a plain window resize reported a zoom change at the same value, noise for a host to filter and a `v-model` echo for nothing. Both are emitted only when the level actually moves.

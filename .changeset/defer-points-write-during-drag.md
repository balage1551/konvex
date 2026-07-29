---
"@balage1551/konvex-editable-line": patch
---

Fix a host `points` write during a handle drag being dropped instead of deferred.

The watch that answers a wholesale `line.points` replacement bailed out whenever a drag was in progress — right for the line's *own* per-frame drag writes, since `applyDragDelta` has already moved the handles it touched and repositioning them mid-drag would fight Konva's drag positioning, but wrong for a write from outside. A host writing `line.points` mid-drag (an undo, a collaborative patch, a socket update) got no handle resync and no `points-replaced`, and `dragend` had no catch-up, so neither ever arrived.

The write itself was never the casualty: it lands in the geometry immediately, and `applyDragDelta` copies the live array, so points the drag is not touching keep the new values. What went missing was the *reaction* — and the interesting half of that is not the missing event.

**Stale handles corrupt geometry on the next drag.** `onDragMove` takes its delta as `handle.position - point.origin`, so a handle left behind disagrees with its point before the pointer moves at all. Grabbing that handle snaps its point back to the stale coordinate: measured on the pre-fix code, a line written to `y=9` mid-drag went back to `y=0` on a drag with *zero* pointer movement, silently undoing the host's write on the canvas while the persister — never told anything had changed — kept the value it never heard about.

A foreign mid-drag write is now remembered and drained at `dragend`, after that drag's own `point-moved`, so the order a listener sees is the order things settled. A drag containing no foreign write stays silent, and a mid-drag write that changes the point *count* rebuilds the handles rather than repositioning stale ones.

Only the deferred path is new. A write outside a drag still syncs and emits immediately, a plain handle drag still reports `point-moved` and nothing else, and the line's own editing methods still emit their precise `point-*` events at the call site.

---
"@balage1551/konvex-editable-line": patch
---

Fix `points-replaced` being swallowed when a host write shares a flush with a library edit.

The self-write marker was a single boolean, and Vue watchers flush once per tick — so the flag was consumed once no matter how many writes shared the flush, and a batch holding both a library edit and a host assignment to `line.points` read as purely self-written. The host's write went unannounced.

That is not an exotic interleaving. The `point-*` events are emitted synchronously, so a host that normalises geometry from inside a `point-added` listener — snap to grid, clamp to bounds, validate — writes in the library's own flush *every time*. Such a host never received `points-replaced` at all.

Three consequences, worst last:

- The write is unreported, so anything rebuilding from events misses it.
- When the host's write lands *after* the library's, the per-point event describes a state that no longer exists: `addPoint` then a host write shrinking the array left `point-added` at index 3 on a two-point line, with nothing to correct it. A replaying persister ended up longer than the canvas.
- It bypassed the mid-drag deferral fix. A host write sharing a flush with a `dragmove` read as own, so the deferral flag was never set, and the handles stayed stale past `dragend` — restoring the geometry corruption that fix had just closed (grabbing a stale handle snaps its point back).

The marker is now a pair of array identities rather than a boolean: the array `writePoints` last wrote, and the last array the watch settled on. A write is foreign when the current value is neither — and `writePoints` also checks *before* overwriting, since by the time the watch runs the array it would have compared against is gone. That is what makes a mixed flush report both events. The `points` ref hands back the very array it was given, so identity is a sound test.

Two limits stated rather than hidden: a per-point event already emitted cannot be retracted if the host's write undoes it (the trailing `points-replaced` is the correction), and a mutation made *in place* is reported by nothing, since it never triggers the ref — as was already the case.

Lone writes of either kind, repeated library edits in one flush, multi-frame drags, and `simplify()` are all unchanged.

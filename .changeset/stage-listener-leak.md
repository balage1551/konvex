---
"@balage1551/konvex-editable-line": patch
---

Fix `EditableLine` leaking its stage listeners when removed and destroyed in the same tick.

`destroy()` detached them via `this._stage.value?.off(this._ns)`, but `_stage` is a computed over `_parent` — so once the line had been removed from its parent it already evaluated to `null` and the `off()` never ran. The watch that would otherwise have detached them is async, and `destroy()` stops the effect scope before it can fire. So `parent.remove(el); el.destroy()` left all seven namespaced listeners on the stage permanently, and through their closures the whole `EditableLine` with them.

The line now remembers the stage it actually attached to and detaches from that, rather than re-deriving it at teardown when it is no longer reachable. Detaching is idempotent, so a second `destroy()` is harmless, and re-parenting between stages still clears the old one.

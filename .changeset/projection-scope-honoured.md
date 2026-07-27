---
"@balage1551/konvex-editable-line": minor
---

Fix added points ignoring the projection scope, and the assist previewing the wrong thing.

`projectionScope` is now the single authority over where a point lands, and `resolveInsertion()` — the one decision behind every add gesture *and* the assist preview — switches on it directly instead of inferring intent from the projection's segment index. `'internal'` always splits a body segment; `'start'`/`'end'`/`'terminal'` always extend. The assist guide is drawn from that same result, so the preview cannot depict something other than what committing will do.

Three separate faults produced the reported behaviour, all of them "the scope was not actually consulted":

- the `dblclick` handler reimplemented the insertion logic instead of calling `resolveInsertion()`, and its last branch fell through to a plain append whenever the cursor was beyond `snapThreshold`;
- `resolveInsertion()` and the assist both re-derived "is this an extension?" from the segment index rather than from the scope;
- underneath both, `KonvexLine.project()` was rewriting internal projections into terminal ones (fixed in `@balage1551/konvex`), which is what made an internal double-click append and the assist draw a terminal guide under any scope.

The projection scope and snap threshold are now live refs — `projectionScope` and `snapThreshold` on the instance — alongside `assistShow` and the other runtime knobs. They were previously read straight from the static config object on every use, so there was no way to change them after construction. Both are still seeded from `assist.scope` / `assist.snapThreshold`; changing the scope now also re-renders the assist immediately rather than waiting for the next mouse move.

Note the names deliberately drop the `assist` prefix: this is one setting that governs where a point actually lands, and the assist is the preview of that same decision — not a separate visual-only option.

`breakOnDblClick` (double-click *on* the line to split a segment) is now inert unless the scope is `'internal'`. Breaking is a body operation; under a terminal scope it used to project onto an endpoint and drop a duplicate point there, and a scope that says "ends only" should not permit a mid-line insert by another route.

New builtin toolbar item `projection-scope` cycles the scope through `internal → terminal → start → end`. Its glyph shows the current scope, so it doubles as the indicator. It is registered in `BUILTIN_TOOLBAR_ITEMS` but deliberately not added to `DEFAULT_TOOLBAR_ITEMS`, so existing bars are unchanged — add `'projection-scope'` to your item list to show it.

Toolbar items gain `keepOpen?: boolean` (default `false`). Items that set it leave the bar up after `run()` instead of dismissing it, which is what makes an in-place cycle usable.

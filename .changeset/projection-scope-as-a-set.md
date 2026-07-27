---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

Projection scope becomes a **set** of parts instead of a fixed enum, so points can be added anywhere.

`'internal'` correctly refuses to extend either end, which left no way to say "body *or* ends". A scope is now any subset of `LineProjectionPart` — `'start'`, `'internal'`, `'end'` — and `KonvexLine.project()` evaluates every allowed part and returns the nearest. All seven non-empty subsets are meaningful; the empty set allows nothing and returns `undefined`.

The old enum values survive as named sets in `LINE_PROJECTION_SCOPES`, and every place that takes a scope still accepts those names, so `'internal'` / `'terminal'` / `'start'` / `'end'` keep working and keep their meaning. `lineProjectionParts(scope)` resolves a name or set to its parts.

- new `'anywhere'` = `['start','internal','end']`, and it is now the **default** — for `project()` and for `EditableLine`, which previously defaulted to `'internal'`.
- `LineProjectionScope` changes from a string union to `readonly LineProjectionPart[]`. Code that passes the names is unaffected; only an explicit `const s: LineProjectionScope = 'internal'` annotation needs updating (to `LINE_PROJECTION_SCOPES.internal`).
- `EditableLine.projectionScope` holds the resolved set. `breakOnDblClick` now requires `'internal'` to be *in* the set rather than to be the whole scope.
- the `projection-scope` toolbar item cycles the five named sets, with `mdi-ray-start-vertex-end` for `anywhere`.

This also lets `EditableLine.resolveInsertion()` go back to reading `proj.segment` directly. It briefly had to switch on the scope instead, because `project()` used to promote body projections to extensions regardless of what was asked for; now that a scope bounds what may come back, the projection can be trusted again.

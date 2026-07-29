---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": patch
---

Add a `'nowhere'` projection scope, and stop an empty scope from being bypassed.

**The bug.** `KonvexLine.project` returns `undefined` for two unrelated reasons — a line with fewer than two points (nothing to project onto *yet*) and an empty scope (nothing is allowed, ever) — and `EditableLine`'s stage `click` / `dblclick` handlers treated them alike, falling through to `addPoint(p)`. So the one scope that forbids adding was the one scope that appended unconditionally, at the raw cursor, ignoring every part rule. The assist had already got this right and previewed nothing, which made it worse: the point arrived with no indication it could.

Both handlers now go through one private `addAtProjection`, which checks the scope *before* the projection. The short-line append survives, because it is the only way a line can be seeded by clicking — it just no longer doubles as an escape hatch from the scope. That also means a line configured `'nowhere'` from the start never gets a first point from a gesture.

**`'nowhere'`.** A new `LINE_PROJECTION_SCOPES` entry, `[]`, for a line that stays editable — points drag, select, align, straighten, simplify, delete — but takes no *new* ones. No subset of the parts could express that, and switching `addOnDblClick`/`addOnAltClick` off is not the same thing: those close the two gestures you name, while this works one level below, on `project` itself, so the assist previews nothing and `breakOnDblClick` goes inert on its own. The imperative API (`addPoint`, `insertPoint`, …) is deliberately not gated — the scope governs gestures and projection, not what a host asks for outright.

**`lineProjectionParts` never returns an accidentally-empty set.** It previously handed back whatever it was given: an unknown name became `undefined` (and `EditableLine` then stored `undefined` in `projectionScope`, so a double-click on the line threw `Cannot read properties of undefined (reading 'includes')`), and `['typo']` became a scope allowing nothing. An empty scope is the *most* restrictive answer there is, so it now has to be asked for rather than arrived at: only an explicit `[]` or `'nowhere'` resolves to empty, while `undefined`, `null`, a non-array, an unknown name, and an array naming no real part all resolve to `'anywhere'`. Recognised parts are de-duplicated and returned in `start`, `internal`, `end` order, so two spellings of one set now compare equal.

`EditableLine.projectionScope` became a `customRef` that normalises on write, so the invariant holds for every read instead of being re-checked at each of them, and a re-assignment that changes nothing no longer wakes the assist and handle watchers.

`'nowhere'` is **not** in the toolbar's scope cycle: it is an authoring choice, and landing on it by one stray click would leave a line whose add gestures silently do nothing. It does get a face of its own (a cancel glyph, "Add points: nowhere") for when a host sets it — the generic fallback was the *permissive* ray glyph, which would have read as "anywhere" on the one scope that adds nothing — and cycling from it restarts at `anywhere`, so the toolbar can always get back out.

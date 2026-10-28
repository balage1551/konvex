---
"@balage1551/konvex-editable-line": minor
---

Tag point events with who made the edit. `point-added`, `point-removed`, `point-moved` and `points-replaced` carry `source: 'user' | 'api'`: `'user'` for a drag, a click or double-click that adds a point, a toolbar item, or anything run inside the new `asUser(fn)`; `'api'` for other calls into the editing methods and for every write to `line.points`. A host whose own UI edits the line wraps it in `asUser` to have those edits reported as the user's.

**Behaviour change.** `source` is a required field on `EditableLinePointChange`, `EditableLinePointMove` and `EditableLinePointsReplaced`, so code that *builds* these payloads (a test mock, a re-emitter) must now supply it; listeners are unaffected.

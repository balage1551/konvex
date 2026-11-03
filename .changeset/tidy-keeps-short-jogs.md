---
'@balage1551/konvex': patch
'@balage1551/konvex-editable-line': patch
---

`tidyPoints` / `EditableLine.tidy()` no longer flatten a short jog that follows a long leg. A point now joins a run only when the step from the previous point also runs along the run's axis, not just the chord from the run's first point (a 90 px jog after a 1080 px leg is under 5° and used to collapse the rest of the line onto the leg).

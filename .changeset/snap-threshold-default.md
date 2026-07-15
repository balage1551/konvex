---
"@balage1551/konvex-editable-line": patch
---

Default `assist.snapThreshold` to `10` world units (previously effectively `Infinity`, which always snapped). Insertion now snaps to the line only when the cursor is within 10 units; beyond that it extends at the cursor. Pass `assist.snapThreshold` to override.

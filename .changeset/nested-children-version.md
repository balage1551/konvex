---
"@balage1551/konvex": patch
"@balage1551/konvex-editable-line": patch
---

Fix `unitScale` never reaching shapes added to nested groups. `KonvexContainer.childrenVersion` only bumped on the container that was mutated, so the stage's watcher — the only writer of `unitScale` — never fired for a shape added to a group below the world. Those shapes kept `unitScale = 1`, making `scaledLength` / `scaledArea` / `scaledDiameter` return raw pixel values. Version bumps now bubble up the ancestor chain, so a nested add/remove is visible to watchers on any ancestor (this also fixes the stage's auto-sizing missing nested content).

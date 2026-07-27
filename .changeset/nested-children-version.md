---
"@balage1551/konvex": patch
"@balage1551/konvex-editable-line": patch
---

Fix `childrenVersion` not reflecting changes in nested containers. It bumped only on the container that was mutated, so a watcher on an ancestor (e.g. the stage watching its world) never fired for a shape added to or removed from a group further down. The stage's world auto-sizing was consequently blind to nested content. Version bumps now bubble up the ancestor chain, so a nested add/remove is visible to watchers on any ancestor. Detached subtrees stay silent until attached.

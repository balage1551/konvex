---
"@balage1551/konvex-editable-line": patch
---

Pin the `@balage1551/konvex` peer range to the version being released, and automate it.

The range had sat at `^1.0.0` since the first release while this package went on using core APIs that 1.0.0 never had. `core@1.0.x` + `editable-line@1.2.x` therefore installed cleanly and failed at runtime on a missing export — npm had no way to know better, because the manifest said 1.0.0 was enough. Since the two packages are versioned in lockstep and only ever built and tested together, the honest minimum is the version being cut, and that is what ships from now on.

`scripts/sync-workspace-peers.mjs` computes it: `npm run version-packages` runs it right after `changeset version`, so the Version PR carries the correct range, and `npm run release` re-checks it (`--check`) so a stale one fails the run rather than being published.

It needs a script because neither obvious route works. changesets rewrites a peer range only when the new version *leaves* it (`onlyUpdatePeerDependentsWhenOutOfRange: true`), and `1.3.0` never leaves `^1.0.0`; turning that flag off makes it treat every minor core bump as breaking for the dependent and force a **major**, which with the `fixed` group would take both packages to `2.0.0` on each core minor. And `workspace:^` — which npm substitutes at publish time for ordinary dependencies — is packed *literally* inside `peerDependencies` by both npm 9 and npm 11, which would ship a broken manifest.

Consequence worth stating: upgrading `konvex-editable-line` now requires upgrading `@balage1551/konvex` in the same step. Lockstep versioning already implied that; this makes npm aware of it.

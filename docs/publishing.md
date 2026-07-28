# Publishing

Versioning and publishing are automated with [Changesets](https://github.com/changesets/changesets).
Both packages are **always released together at the same version** (a `fixed`
group in [`.changeset/config.json`](../.changeset/config.json)) — `konvex` is the
wrapper, `konvex-editable-line` is a heavier extension riding the same release
train, and keeping their versions identical avoids confusion.

Publishing to npm uses **OIDC trusted publishing** — GitHub Actions authenticates
with a short-lived OIDC token instead of a stored `NPM_TOKEN`. The single workflow
is [`.github/workflows/release.yml`](../.github/workflows/release.yml).

Requirements (satisfied by the workflow): npm CLI **≥ 11.5.1** and Node **≥ 22**
(pinned via [`.nvmrc`](../.nvmrc)).

## Day-to-day: recording a change

In the same branch/PR as your change, record intent:

```bash
npx changeset          # or: npm run changeset
```

It asks which bump level this release should be — `patch` / `minor` / `major`.
Because the two packages are a `fixed` group you only pick **one** level and both
follow it, even the package you didn't touch. Type a one-line summary; it writes a
markdown file under `.changeset/`. Commit that file with your change.

> Local authoring needs Node ≥ 22. `nvm use` in the repo root picks it up from
> `.nvmrc`.

## Cutting a release

Fully automated — no hand-editing of versions, no manual `npm publish`:

1. Merge your PR (with its changeset) to `main`.
2. The **Release** workflow opens/updates a **"Version Packages"** PR that bumps
   **both** `package.json` versions in lockstep, pins the internal
   `@balage1551/konvex` peer range to the new version (see below), and writes the
   changelogs.
3. Merge the Version PR when you're ready to ship. That triggers the workflow to
   build and publish both packages with signed
   [provenance](https://docs.npmjs.com/generating-provenance-statements).
   Publishing is idempotent — a version already on the registry is skipped.

You can accumulate several feature PRs (each with its own changeset) and release
them all in one Version PR.

**Manual fallback:** run the **Release** workflow from the **Actions** tab
(`workflow_dispatch`). With no pending changesets it just re-runs publishing for
the versions currently on `main` — useful only if an automated publish
half-failed.

### The internal peer range is pinned, not left open

`konvex-editable-line` peer-depends on `@balage1551/konvex`, and that range is
rewritten to `^<the version being released>` by `scripts/sync-workspace-peers.mjs`,
which `npm run version-packages` runs straight after `changeset version`. The
`release` script re-checks it (`--check`) before publishing, so a stale range fails
the run instead of shipping.

It has to be done by hand because nothing else does it:

- **changesets won't.** `onlyUpdatePeerDependentsWhenOutOfRange: true` means a peer
  range is rewritten only when the new version *leaves* it, and `1.3.0` never
  leaves `^1.0.0`. Turning the flag off is worse: changesets then treats a minor
  bump of a peer dependency as breaking for the dependent and forces it to
  **major**, which with our `fixed` group would take the pair to `2.0.0` on every
  core minor.
- **`workspace:^` won't.** npm is supposed to substitute the real range at publish
  time, but it does not do so for `peerDependencies` — npm 9 and npm 11 both pack
  the literal string `workspace:^`, which would ship a broken manifest.

Why pin at all: editable-line is only ever built and tested against the core it
ships with, and it freely uses core APIs as they arrive. The range sat at `^1.0.0`
while editable-line moved on to APIs that 1.0.0 never had, so `core@1.0.x` +
`editable-line@1.2.x` installed happily and then failed at runtime on a missing
export. Since the two are versioned in lockstep, the honest minimum is simply the
version being cut.

The trade-off, chosen deliberately: upgrading editable-line now requires upgrading
core in the same step. That is what lockstep already implied — this only makes npm
aware of it.

## One-time setup: configure the trusted publisher (per package)

Do this **for both packages** on npmjs.com:

1. Go to the package page → **Settings** → **Trusted Publisher**.
2. Provider: **GitHub Actions**.
3. Fill in:
   - **Organization or user:** `balage1551`
   - **Repository:** `konvex`
   - **Workflow filename:** `release.yml` *(filename only, not the full path)*
   - **Allowed actions:** `npm publish`
4. Leave the environment blank (the workflow doesn't use a GitHub Environment).

Both packages point at the same repo and the same `release.yml`.

> ⚠️ If you previously configured the trusted publisher with `publish.yml`, you
> **must** change it to `release.yml` for both packages — otherwise the OIDC
> exchange fails with "package not found".

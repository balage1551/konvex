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
   **both** `package.json` versions in lockstep, updates the internal
   `@balage1551/konvex` peer range, and writes the changelogs.
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

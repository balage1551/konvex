# Publishing

Both packages are published to npm via **OIDC trusted publishing** — GitHub
Actions authenticates to npm with a short-lived OIDC token instead of a
long-lived `NPM_TOKEN` stored as a secret. The workflow lives at
[`.github/workflows/publish.yml`](../.github/workflows/publish.yml).

Requirements (already satisfied by the workflow): npm CLI **≥ 11.5.1** and Node
**≥ 22.14.0**.

## One-time setup: configure the trusted publisher (per package)

Both packages already exist on the registry, so the trusted publisher can be
configured directly. Do this **for both packages** on npmjs.com:

1. Go to the package page → **Settings** → **Trusted Publisher**.
2. Provider: **GitHub Actions**.
3. Fill in:
   - **Organization or user:** `balage1551`
   - **Repository:** `konvex`
   - **Workflow filename:** `publish.yml` *(filename only, not the full path)*
   - **Allowed actions:** `npm publish`
4. Leave the environment blank (the workflow doesn't use a GitHub Environment).

Both packages point at the same repo and the same `publish.yml`.

## Every release after that

No tokens, no manual `npm publish`:

1. Bump the version in **both** `packages/*/package.json` (keep them in lockstep;
   the editable-line's `@balage1551/konvex` peer range too if it moved), then run
   `npm install --package-lock-only` to sync `package-lock.json`. Commit.
2. Push a git tag and create a **GitHub Release** (e.g. `v1.1.0`).
3. Publishing the release triggers the workflow, which builds and publishes both
   packages with signed [provenance](https://docs.npmjs.com/generating-provenance-statements).

You can also run the workflow manually from the **Actions** tab
(`workflow_dispatch`) — but bump/commit the versions first, since it publishes
whatever versions are on the checked-out ref.

#!/usr/bin/env node
/**
 * Pin every workspace-internal `peerDependencies` range to the version that is
 * about to be published: `^<that package's current version>`.
 *
 * Why this exists
 * ---------------
 * `konvex-editable-line` peer-depends on `@balage1551/konvex`, and the range sat
 * at `^1.0.0` from the first release onwards while editable-line went on to use
 * core APIs that did not exist in 1.0.0. A consumer holding core at 1.0.x and
 * editable-line at 1.2.x installs cleanly and then fails at runtime on a missing
 * export — npm has no way to know, because the manifest said 1.0.0 was enough.
 *
 * Nothing in changesets fixes that for us. `.changeset/config.json` sets
 * `onlyUpdatePeerDependentsWhenOutOfRange: true`, so a range is rewritten only
 * when the new version *leaves* it — and 1.3.0 never leaves `^1.0.0`. Turning
 * that flag off is worse: changesets then treats any minor bump of a
 * peer-dependency as a breaking change for the dependent and forces it to major
 * (`assemble-release-plan`, `shouldBumpMajor`), which with our `fixed` group
 * would drag the whole pair to 2.0.0 on every core minor.
 *
 * The `workspace:^` protocol would be the tidy answer — npm is supposed to
 * substitute the real range at publish time — but it does not do so for
 * `peerDependencies`: both npm 9 and npm 11 pack the literal string
 * `workspace:^`, which would ship a broken manifest. Verified by `npm pack`.
 *
 * So the range is computed here instead. The pair is versioned in lockstep
 * (`fixed`), which makes the right minimum unambiguous: the version being cut.
 * We only ever build and test the two together, so that is also the only pairing
 * we can honestly claim to support.
 *
 * Usage
 * -----
 *   node scripts/sync-workspace-peers.mjs           # rewrite (runs after `changeset version`)
 *   node scripts/sync-workspace-peers.mjs --check   # report and exit 1 if stale
 *
 * The rewrite is idempotent, so running it on an up-to-date tree changes nothing.
 * Note it deliberately touches *only* `peerDependencies`: the `"*"` devDependency
 * that links the packages locally must stay loose.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const check = process.argv.includes('--check')
const root = new URL('..', import.meta.url).pathname
const packagesDir = join(root, 'packages')

/** Every workspace package: its directory, manifest and parsed name/version. */
const workspace = readdirSync(packagesDir)
  .map(name => join(packagesDir, name))
  .filter(dir => statSync(dir).isDirectory())
  .map(dir => {
    const file = join(dir, 'package.json')
    const json = JSON.parse(readFileSync(file, 'utf8'))
    return { file, json }
  })
  .filter(p => p.json.name)

const versions = new Map(workspace.map(p => [p.json.name, p.json.version]))

const stale = []
for (const pkg of workspace) {
  const peers = pkg.json.peerDependencies
  if (!peers) continue
  let touched = false
  for (const [name, range] of Object.entries(peers)) {
    const version = versions.get(name)
    if (!version) continue // an external peer (konva, vue) — not ours to pin
    const wanted = `^${version}`
    if (range === wanted) continue
    stale.push({ dependent: pkg.json.name, name, range, wanted })
    peers[name] = wanted
    touched = true
  }
  if (touched && !check) writeFileSync(pkg.file, `${JSON.stringify(pkg.json, null, 2)}\n`)
}

if (stale.length === 0) {
  console.log('workspace peer ranges are in step with the package versions')
  process.exit(0)
}

for (const s of stale) {
  console.log(`${s.dependent}: peer ${s.name} ${s.range} -> ${s.wanted}`)
}
if (check) {
  console.error(
    '\nStale workspace peer range(s). Run `node scripts/sync-workspace-peers.mjs`\n' +
      '(or `npm run version-packages`, which does it) and commit the result.',
  )
  process.exit(1)
}
console.log(`\nupdated ${stale.length} range(s)`)

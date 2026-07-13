# Konvex

A reactive [Vue 3](https://vuejs.org/) wrapper around [Konva](https://konvajs.org/),
split into two published packages:

| Package | Description |
| --- | --- |
| [`@balage1551/konvex`](packages/konvex) | Core: reactive shapes, stage/layer, scaling, world modes and zoom. |
| [`@balage1551/konvex-editable-line`](packages/konvex-editable-line) | An interactively editable polyline (handles, projection assist, rubber-band selection, straighten/simplify, toolbar). |

## Development

This is an npm-workspaces monorepo.

```bash
npm install          # install & link all workspaces
npm run build        # build core, then editable-line (order matters)
npm run typecheck    # vue-tsc across all packages
```

`@balage1551/konvex-editable-line` peer-depends on `@balage1551/konvex`; build
the core first (the top-level `build` script does this for you).

## Peer dependencies

Both packages declare `vue` (^3.5) and `konva` (^10) as peer dependencies.
Install them alongside in the consuming app.

## License

[MIT](LICENSE) © Balázs Vissy

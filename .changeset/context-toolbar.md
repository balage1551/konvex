---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

Move the toolbar item framework into core as `<KonvexContextToolbar>`, generic over the context its items see: `KonvexContextToolbarItem<Ctx>`, `ContextToolbarItemState`, `ContextToolbarItemRender<Ctx>`, `ContextToolbarItemSpec<Ctx>` and `resolveContextToolbarItems(specs, builtins)`. Any node can open it: set `contextRequest` (config or ref, default `false`) and a right-click suppresses the browser's menu and emits a `context-request` signal `{ node, pointerScreen, pointerWorld }`. The bar can also be opened from any other source through its exposed `open(request)`.

`EditableLineToolbar` is now this component specialised to a line, and the EL item types are aliases of the core ones, so existing code compiles unchanged. The toolbar's CSS classes are renamed from `eltb-*` to `kxtb-*`. The old names are still emitted beside the new ones and `eltb-icon-danger` still paints a glyph red, so host CSS and custom items keep working — but the `eltb-*` classes are **deprecated** and will be removed in 2.0; switch to `kxtb-*` (e.g. `kxtb-icon-danger`).

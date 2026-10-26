---
"@balage1551/konvex": minor
"@balage1551/konvex-editable-line": minor
---

Move the toolbar item framework into core as `<KonvexContextToolbar>`, generic over the context its items see: `KonvexContextToolbarItem<Ctx>`, `ContextToolbarItemState`, `ContextToolbarItemRender<Ctx>`, `ContextToolbarItemSpec<Ctx>` and `resolveContextToolbarItems(specs, builtins)`. Any node can open it: set `contextRequest` (config or ref, default `false`) and a right-click suppresses the browser's menu and emits a `context-request` signal `{ node, pointerScreen, pointerWorld }`. The bar can also be opened from any other source through its exposed `open(request)`.

`EditableLineToolbar` is now this component specialised to a line, and the EL item types are aliases of the core ones, so existing code compiles unchanged. The toolbar's CSS classes are renamed from `eltb-*` to `kxtb-*`; a custom item that used `eltb-icon-danger` for a red glyph should use `kxtb-icon-danger`.

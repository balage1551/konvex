---
"@balage1551/konvex": patch
---

Fix `bindTo`/`on`/`bindDom` attaching a permanent listener when called after `destroy()`.

All three route their cleanup through `scope.run(() => onScopeDispose(off))`, and `EffectScope.run` *silently skips its callback* once the scope is stopped — it does not throw, and its "cannot run an inactive effect scope" warning is dev-only and never says what leaked. So the listener went on and the removal did not: `bindTo`/`on` left a handler on a node that outlives the wrapper, and nothing short of the caller having kept the returned `off` could take it off again. A second `destroy()` does not help, because `scope.stop()` is a no-op the second time.

`bindDom` made it worse rather than adding a new hole. A leaked Konva listener at least dies when its target's subtree is destroyed; `window` never goes away, so a post-destroy `bindDom` pinned the handler — and through its closure the whole wrapper, its Konva node and everything it references — for the lifetime of the page.

Both now **fail closed**: on a stopped scope they bind nothing, warn with the event name that was refused, and return a no-op `off`. Refusing is the honest reading of the contract, which is not "add a listener" but "add a listener that goes away with this object" — if the second half cannot be delivered, the first half is a leak, not a favour. The `off` is still a function so existing call sites need no null check, and the warning is unconditional (not dev-gated) because a production build is exactly where the Vue warning was missing.

Only the post-destroy path changes. Binding on a live object, `once`, multi-name binds, the returned `off`, and removal on `destroy()` all behave exactly as before.

Not changed, deliberately: **`destroy()` still does not guard the rest of the API.** Making every method throw on a destroyed object is invasive and hostile to hosts that tear down in an arbitrary order; the listener binders are the narrow case where the silent no-op left something *behind* instead of merely doing nothing.

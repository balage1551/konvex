---
"@balage1551/konvex": patch
---

Fix `{ mode: 'by' }` writing `NaN`, and make `scalable` a two-way switch.

**Relative writes needed something to be relative to.** `numberAttr` read the live Konva value as the base, and not every attribute has a default to read: a group's `clipX`/`clipY`/`clipWidth`/`clipHeight` answer `undefined` until first set, so `{ mode: 'by', value: 5 }` computed `undefined + 5` and poisoned the attribute with `NaN`. The base now falls back to the attribute's own default — which also cleans up after a `NaN` that got in some other way. Every attribute with a Konva default behaves exactly as before, including the multiplying ones, which fall back to `1` rather than `0`.

**`scalable: false → true` left the compensated scale behind.** Turning it off drives the node's scale to the reciprocal of its ancestors'; turning it back on simply stopped doing that, so the node kept wearing whatever reciprocal it happened to be wearing — a one-way door dressed as a toggle. The scale from before compensation started is remembered and restored on the way back, and re-entering compensation later picks up whatever the scale is at *that* moment. A node that never compensated is untouched.

Also documented: `detach()` is an alias of `konvaRoot()` that hands back the raw Konva node and does **not** remove it from its parent, despite the name — `parent.remove(node)` does that.

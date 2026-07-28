---
"@balage1551/konvex": patch
---

Fix `simplifyPoints` moving a polyline's endpoints and swallowing out-and-back spikes.

**Endpoints moved.** The near-collinear pass preserves the first and last point, but the cluster-merge pass that runs after it did not: a cluster reaching either end collapsed to its centroid, so a dense start crept inwards, and a polyline small enough to be a single cluster collapsed to one point in its middle. A cluster that reaches an end now collapses *onto* that endpoint, and a polyline that is one whole cluster keeps both of them.

**Spikes vanished.** `angleAtDeg` returned `0` — "flat, drop it" — whenever any two of the three points coincided, and that conflates two opposite cases. If the *middle* point sits on the vertex it is a duplicate and dropping it is right; if the *far* point does, the vertex is an out-and-back spike — a degenerate triangle, not a flat one — and dropping it deleted a corner the caller drew on purpose. The two cases are now answered separately, so duplicates still go and spikes stay.

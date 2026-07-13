# @balage1551/konvex

A reactive [Vue 3](https://vuejs.org/) wrapper around [Konva](https://konvajs.org/).

Every Konva node type is exposed as a class whose attributes are Vue refs, so
shapes react to state the way the rest of your app does. Includes a `KonvexStage`
component with scaling, world modes (free / elastic / clipped / bounded) and zoom.

## Install

```bash
npm install @balage1551/konvex vue konva
```

`vue` (^3.5) and `konva` (^10) are peer dependencies.

## Usage

```ts
// KonvexStageContainer is the Vue component; KonvexStage is the imperative class.
import { KonvexRect, KonvexStageContainer } from '@balage1551/konvex'
```

See the source for the full set of shape wrappers (Rect, Circle, Ellipse, Ring,
Wedge, Arc, Line, Arrow, Path, Tag, Text, TextPath, RegularPolygon, Star, Image,
Sprite, Group) plus Stage/Layer and the polyline helpers.

## License

[MIT](../../LICENSE) © Balázs Vissy

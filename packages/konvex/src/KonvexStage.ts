import Konva from 'konva'
import { toValue } from 'vue'
import {
  KonvexContainer,
  type KonvexContainerConfig,
} from './KonvexContainer'
import type { KonvexLayer } from './KonvexLayer'
import type { AttrSource } from './KonvexTypes'

export interface KonvexStageConfig extends KonvexContainerConfig {
  width?: AttrSource<number>
  height?: AttrSource<number>
}

/**
 * Wraps a `Konva.Stage` — the root of the tree, bound to a DOM container.
 * Its children are {@link KonvexLayer}s.
 */
export class KonvexStage extends KonvexContainer<Konva.Stage, KonvexLayer> {
  constructor(container: string | HTMLDivElement, config: KonvexStageConfig = {}) {
    // Konva needs concrete initial dimensions to size the container; resolve
    // the (possibly reactive) sources once here. KonvexNode then binds
    // width/height as live attributes, so passing refs still tracks changes.
    super(
      new Konva.Stage({
        container,
        width: toValue(config.width) ?? 600,
        height: toValue(config.height) ?? 400,
      }),
      config,
    )
  }
}

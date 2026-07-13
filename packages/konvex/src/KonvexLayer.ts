import Konva from 'konva'
import {
  KonvexContainer,
  type KonvexContainerConfig,
} from './KonvexContainer'
import type { KonvexNode } from './KonvexNode'
import type { KonvexStage } from './KonvexStage'

export type KonvexLayerConfig = KonvexContainerConfig

/**
 * Wraps a `Konva.Layer`. Holds shapes (and, later, groups) — anything that is
 * a {@link KonvexNode}.
 */
export class KonvexLayer extends KonvexContainer<Konva.Layer, KonvexNode<Konva.Node>> {
  constructor(config: KonvexLayerConfig = {}) {
    super(new Konva.Layer(), config)
  }

  /** Fluent helper: add this layer to a stage and return it. */
  insertInto(stage: KonvexStage, index?: number): this {
    stage.add(this, index)
    return this
  }
}

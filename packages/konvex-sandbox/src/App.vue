<template>
  <div class="w-100" style="height: 100dvh; display: flex; flex-direction: column; overflow: hidden">
    <ComponentHeader title="Konvex tester" style="flex-shrink: 0" />
    <v-container fluid style="background: #2c3e50; flex: 1 1 auto; min-height: 0; overflow: hidden" class="text-white pa-0">
      <v-row no-gutters style="height: 100%">
        <!-- Canvas (top, fills) + live read-outs (bottom, ≥300px), split vertically -->
        <v-col cols="8" class="pa-0" style="height: 100%; min-height: 0">
          <PmiSplitPane orientation="vertical" initial-position="62%" persistence-key="konvex-tester">
            <template #first>
              <PmiSplitPaneContainer side="first">
                <KonvexStageContainer
                  ref="kx"
                  :world-mode="worldMode"
                  :zoom-mode="zoomMode"
                  :scale="unitScale"
                  :content-size="{ width: 1200, height: 800 }"
                  background="#333"
                  frame="yellow"
                  class="w-100 h-100"
                  @ready="onStageReady"
                  @zoom="onZoom"
                  @scroll="onViewChange"
                />
                <EditableLineToolbar
                  v-if="asEditableLine"
                  :line="asEditableLine"
                  :items="toolbarItems"
                  :label="`Selected points: ${asEditableLine.selection.value.length}`"
                />
              </PmiSplitPaneContainer>
            </template>
            <template #second>
              <PmiSplitPaneContainer side="second" min="300px">
                <div class="readout">
                  <div class="group-title">View</div>
                  <span class="info"><span class="label">zoom:</span> {{ round(zoomDisplay * 100) }}%</span>
                  <span class="info"><span class="label">zoomMode:</span> {{ zoomMode }}</span>
                  <span class="info"><span class="label">worldMode:</span> {{ worldMode }}</span>
                  <span class="info"><span class="label">unitScale:</span> {{ round(unitScale, 3) }}</span>
                  <span class="info"><span class="label">objects:</span> {{ count }}</span>
                  <span class="info"
                    ><span class="label">cursor:</span> ({{ cursor ? round(cursor.x) : '—' }},
                    {{ cursor ? round(cursor.y) : '—' }})</span
                  >
                  <br />
                  <div class="group-title">Selected: {{ kind }}</div>
                  <template v-if="selected">
                    <span class="info"><span class="label">x:</span> {{ round(selected.x.value) }}</span>
                    <span class="info"><span class="label">y:</span> {{ round(selected.y.value) }}</span>
                    <span class="info"><span class="label">rotation:</span> {{ round(selected.rotation.value) }}</span>
                    <span class="info"><span class="label">opacity:</span> {{ round(selected.opacity.value, 2) }}</span>
                    <span class="info"
                      ><span class="label">scale:</span> {{ round(selected.scaleX.value, 2) }}×{{ round(selected.scaleY.value, 2) }}</span
                    >
                    <span class="info"><span class="label">visible:</span> {{ selected.visible.value }}</span>
                    <span class="info"><span class="label">scalable:</span> {{ selected.scalable.value }}</span>
                    <br />
                    <span class="info"><span class="label">shape:</span> {{ specificText }}</span>
                    <br />
                    <span class="info"><span class="label">fill:</span> {{ fillText }}</span>
                    <span class="info"><span class="label">stroke:</span> {{ strokeText }}</span>
                    <span class="info"><span class="label">shadow:</span> {{ shadowText }}</span>
                    <template v-if="lineProjection">
                      <br />
                      <span class="info muted">Alt + move: closest point on the line</span>
                      <br />
                      <span class="info"
                        ><span class="label">projection:</span> ({{ round(lineProjection.point.x) }},
                        {{ round(lineProjection.point.y) }})</span
                      >
                      <span class="info"><span class="label">segment:</span> {{ lineProjection.segment }}</span>
                      <span class="info"><span class="label">proportion:</span> {{ round(lineProjection.proportion, 3) }}</span>
                      <span class="info"><span class="label">distance:</span> {{ round(lineProjection.distance, 2) }}</span>
                      <span class="info"><span class="label">angle:</span> {{ round(lineProjection.angle, 1) }}°</span>
                    </template>
                    <template v-if="measuredLine">
                      <br />
                      <span class="info"
                        ><span class="label">length:</span> {{ round(measuredLine.pixelLength.value) }} px /
                        {{ round(measuredLine.scaledLength.value, 2) }} scaled</span
                      >
                      <span class="info"
                        ><span class="label">area:</span> {{ round(measuredLine.pixelArea.value) }} px² /
                        {{ round(measuredLine.scaledArea.value, 2) }} scaled</span
                      >
                    </template>
                    <template v-if="asEditableLine">
                      <br />
                      <span class="info muted"
                        >Points ({{ asEditableLine.pointInfos.value.length }}) — drag handles to move;
                        double-click to add/insert, Alt-hover to preview the projection (gestures in the
                        EditableLine panel →)</span
                      >
                      <div class="pt-table-wrap">
                        <table class="pt-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>x</th>
                              <th>y</th>
                              <th>selectable</th>
                              <th>movable</th>
                              <th>selected</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="pi in asEditableLine.pointInfos.value"
                              :key="pi.index"
                              :class="{ selrow: pi.selected }"
                            >
                              <td>{{ pi.index }}</td>
                              <td>{{ round(pi.x) }}</td>
                              <td>{{ round(pi.y) }}</td>
                              <td
                                class="cell-btn"
                                title="toggle selectable"
                                @click="asEditableLine.setPointOptions(pi.index, { selectable: !pi.selectable })"
                              >
                                {{ pi.selectable ? 'yes' : 'no' }}
                              </td>
                              <td
                                class="cell-btn"
                                title="cycle free / x / y / locked"
                                @click="cyclePointMovable(asEditableLine, pi.index, pi.movable)"
                              >
                                {{ pi.movable === false ? 'locked' : pi.movable }}
                              </td>
                              <td
                                class="cell-btn"
                                title="toggle selection"
                                @click="asEditableLine.select(pi.index, { extend: true })"
                              >
                                {{ pi.selected ? '●' : '○' }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </template>
                  </template>
                  <span v-else class="info muted">Add a shape, then double-click it to select.</span>
                </div>
              </PmiSplitPaneContainer>
            </template>
          </PmiSplitPane>
        </v-col>

        <!-- Controls -->
        <v-col cols="4" class="pa-0 pl-2" style="height: 100%; min-height: 0">
          <div class="controls pt-2">
            <div class="panel panel-objects">
              <div class="group-title">Objects</div>
              <span class="muted">add a shape (double-click to select, drag to move):</span>
              <div>
                <v-btn size="small" class="m-btn" @click="addRect">+ Rect</v-btn>
                <v-btn size="small" class="m-btn" @click="addCircle">+ Circle</v-btn>
                <v-btn size="small" class="m-btn" @click="addEllipse">+ Ellipse</v-btn>
                <v-btn size="small" class="m-btn" @click="addRing">+ Ring</v-btn>
                <v-btn size="small" class="m-btn" @click="addWedge">+ Wedge</v-btn>
                <v-btn size="small" class="m-btn" @click="addArc">+ Arc</v-btn>
                <v-btn size="small" class="m-btn" @click="addLine">+ Line</v-btn>
                <v-btn size="small" class="m-btn" @click="addArrow">+ Arrow</v-btn>
                <v-btn size="small" class="m-btn" @click="addPath">+ Path</v-btn>
                <v-btn size="small" class="m-btn" @click="addTag">+ Tag</v-btn>
                <v-btn size="small" class="m-btn" @click="addText">+ Text</v-btn>
                <v-btn size="small" class="m-btn" @click="addTextPath">+ TextPath</v-btn>
                <v-btn size="small" class="m-btn" @click="addRegularPolygon">+ Polygon</v-btn>
                <v-btn size="small" class="m-btn" @click="addStar">+ Star</v-btn>
                <v-btn size="small" class="m-btn" @click="addImage">+ Image</v-btn>
                <v-btn size="small" class="m-btn" @click="addSprite">+ Sprite</v-btn>
                <v-btn size="small" class="m-btn" @click="addGroup">+ Group</v-btn>
                <v-btn size="small" class="m-btn" @click="addEditableLine">+ EditableLine</v-btn>
              </div>
              <div>
                <v-btn size="small" class="m-btn" color="error" :disabled="!selected" @click="deleteSelected"> Delete selected </v-btn>
                <v-btn size="small" class="m-btn" @click="select(undefined)">Deselect</v-btn>
              </div>
            </div>

            <div class="panel panel-view">
              <div class="group-title">View</div>
              <span class="muted">ctrl+wheel = zoom · wheel = scroll · shift+wheel = horizontal</span>
              <div>
                <v-btn size="small" class="m-btn" @click="kx?.zoomOut()">zoom −</v-btn>
                <v-btn size="small" class="m-btn" @click="kx?.zoomIn()">zoom +</v-btn>
                <v-btn size="small" class="m-btn" @click="kx?.resetZoom()">100%</v-btn>
                <v-btn size="small" class="m-btn" @click="kx?.zoomToFit()">fit</v-btn>
                <v-btn size="small" class="m-btn" @click="kx?.zoomToFitX()">fit W</v-btn>
                <v-btn size="small" class="m-btn" @click="kx?.zoomToFitY()">fit H</v-btn>
              </div>
              <span class="muted">zoom mode (steps = snap to a list · proportional = free):</span>
              <div>
                <v-btn
                  size="small"
                  class="m-btn"
                  color="amber"
                  @click="zoomMode = zoomMode === 'steps' ? 'proportional' : 'steps'"
                >
                  zoomMode: {{ zoomMode }}
                </v-btn>
              </div>
              <span class="muted">world mode (drag a shape past the frame to see the effect):</span>
              <div>
                <v-btn size="small" class="m-btn" color="amber" @click="worldMode = cycle(WORLD_MODES, worldMode)">
                  worldMode: {{ worldMode }}
                </v-btn>
              </div>
              <span class="muted">measurement scale (real units per world unit):</span>
              <div>
                <v-btn size="small" class="m-btn" @click="unitScale *= 2">scale ×2</v-btn>
                <v-btn size="small" class="m-btn" @click="unitScale /= 2">scale ÷2</v-btn>
                <v-btn size="small" class="m-btn" @click="unitScale = 1">scale 1</v-btn>
              </div>
              <span class="muted">line projection scope (Alt + move over a selected line):</span>
              <div>
                <v-btn size="small" class="m-btn" color="amber" @click="cycleProjectionScope">
                  scope: {{ projectionScope }}
                </v-btn>
              </div>
            </div>

            <!-- Host-owned selection behaviour (applies to every object). -->
            <div class="panel">
              <div class="group-title">Selection (host)</div>
              <span class="muted">defer the empty-canvas deselect so a double-click can add a point first:</span>
              <div>
                <v-btn
                  size="small"
                  class="m-btn"
                  :color="deferDeselect ? 'amber' : '#888888'"
                  @click="deferDeselect = !deferDeselect"
                >
                  defer deselect: {{ deferDeselect ? 'on' : 'off' }}
                </v-btn>
              </div>
              <span class="muted">deselect delay: {{ deselectDelayMs }} ms (0 = instant)</span>
              <v-slider
                v-model="deselectDelayMs"
                :min="0"
                :max="800"
                :step="50"
                :disabled="!deferDeselect"
                density="compact"
                hide-details
              />
            </div>

            <template v-if="selected">
              <!-- Shape-specific controls -->
              <div class="panel panel-shape">
                <div class="group-title">{{ kind }} attributes</div>
                <template v-if="asRect">
                  <v-btn size="small" class="m-btn" @click="asRect.width.value += 10">w +10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRect.width.value -= 10">w −10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRect.height.value += 10">h +10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRect.height.value -= 10">h −10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRect.cornerRadius.value = ((asRect.cornerRadius.value as number) ?? 0) + 4"
                    >corner +4</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="asRect.cornerRadius.value = 0">corner 0</v-btn>
                </template>
                <template v-else-if="asCircle">
                  <v-btn size="small" class="m-btn" @click="asCircle.radius.value += 5">radius +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asCircle.radius.value -= 5">radius −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asCircle.radius.value = { mode: 'by', value: 1.1 }">radius ×1.1</v-btn>
                </template>
                <template v-else-if="asEllipse">
                  <v-btn size="small" class="m-btn" @click="asEllipse.radiusX.value += 5">rX +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEllipse.radiusX.value -= 5">rX −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEllipse.radiusY.value += 5">rY +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEllipse.radiusY.value -= 5">rY −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEllipse.radius.value = { mode: 'by', value: 1.1 }">radius ×1.1</v-btn>
                </template>
                <template v-else-if="asRing">
                  <v-btn size="small" class="m-btn" @click="asRing.innerRadius.value += 5">inner +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRing.innerRadius.value -= 5">inner −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRing.outerRadius.value += 5">outer +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asRing.outerRadius.value -= 5">outer −5</v-btn>
                </template>
                <template v-else-if="asWedge">
                  <v-btn size="small" class="m-btn" @click="asWedge.radius.value += 5">radius +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asWedge.radius.value -= 5">radius −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asWedge.angle.value += 15">angle +15</v-btn>
                  <v-btn size="small" class="m-btn" @click="asWedge.angle.value -= 15">angle −15</v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asWedge.clockwise.value ? 'amber' : '#888888'"
                    @click="asWedge.clockwise.value = !asWedge.clockwise.value"
                  >
                    clockwise: {{ asWedge.clockwise.value }}
                  </v-btn>
                </template>
                <template v-else-if="asArc">
                  <v-btn size="small" class="m-btn" @click="asArc.innerRadius.value += 5">inner +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asArc.innerRadius.value -= 5">inner −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asArc.outerRadius.value += 5">outer +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asArc.outerRadius.value -= 5">outer −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asArc.angle.value += 15">angle +15</v-btn>
                  <v-btn size="small" class="m-btn" @click="asArc.angle.value -= 15">angle −15</v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asArc.clockwise.value ? 'amber' : '#888888'"
                    @click="asArc.clockwise.value = !asArc.clockwise.value"
                  >
                    clockwise: {{ asArc.clockwise.value }}
                  </v-btn>
                </template>
                <template v-else-if="asLine">
                  <v-btn size="small" class="m-btn" @click="asLine.tension.value = { mode: 'by', value: 0.2 }">tension +.2</v-btn>
                  <v-btn size="small" class="m-btn" @click="asLine.tension.value = { mode: 'reset' }">tension 0</v-btn>
                  <v-btn size="small" class="m-btn" @click="addPoint(asLine)">add point</v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asLine.closed.value ? 'amber' : '#888888'"
                    @click="asLine.closed.value = !asLine.closed.value"
                  >
                    closed: {{ asLine.closed.value }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asLine.bezier.value ? 'amber' : '#888888'"
                    @click="asLine.bezier.value = !asLine.bezier.value"
                  >
                    bezier: {{ asLine.bezier.value }}
                  </v-btn>
                  <template v-if="asArrow">
                    <br />
                    <span class="muted">arrowhead:</span>
                    <br />
                    <v-btn size="small" class="m-btn" @click="asArrow.pointerLength.value += 3">len +3</v-btn>
                    <v-btn size="small" class="m-btn" @click="asArrow.pointerLength.value -= 3">len −3</v-btn>
                    <v-btn size="small" class="m-btn" @click="asArrow.pointerWidth.value += 3">wid +3</v-btn>
                    <v-btn size="small" class="m-btn" @click="asArrow.pointerWidth.value -= 3">wid −3</v-btn>
                    <v-btn
                      size="small"
                      class="m-btn"
                      :color="asArrow.pointerAtBeginning.value ? 'amber' : '#888888'"
                      @click="asArrow.pointerAtBeginning.value = !asArrow.pointerAtBeginning.value"
                    >
                      at-begin: {{ asArrow.pointerAtBeginning.value }}
                    </v-btn>
                    <v-btn
                      size="small"
                      class="m-btn"
                      :color="asArrow.pointerAtEnding.value ? 'amber' : '#888888'"
                      @click="asArrow.pointerAtEnding.value = !asArrow.pointerAtEnding.value"
                    >
                      at-end: {{ asArrow.pointerAtEnding.value }}
                    </v-btn>
                  </template>
                </template>
                <template v-else-if="asPath">
                  <v-btn size="small" class="m-btn" @click="asPath.data.value = 'M0 0 C 40 -50 90 -50 130 0 S 220 50 260 0'">wave</v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    @click="asPath.data.value = 'M0 -40 L 12 -12 L 42 -12 L 18 6 L 28 36 L 0 18 L -28 36 L -18 6 L -42 -12 L -12 -12 Z'"
                    >star</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="asPath.data.value = 'M0 0 q 30 -50 60 0 t 60 0 t 60 0'">arcs</v-btn>
                </template>
                <template v-else-if="asTag">
                  <v-btn size="small" class="m-btn" @click="asTag.width.value += 10">w +10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.width.value -= 10">w −10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.height.value += 10">h +10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.height.value -= 10">h −10</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.pointerDirection.value = cycle(POINTER_DIRS, asTag.pointerDirection.value)"
                    >dir: {{ asTag.pointerDirection.value }}</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="asTag.pointerWidth.value += 4">ptrW +4</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.pointerHeight.value += 4">ptrH +4</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTag.cornerRadius.value = ((asTag.cornerRadius.value as number) ?? 0) + 2"
                    >corner +2</v-btn
                  >
                </template>
                <template v-else-if="asText">
                  <span class="muted">font facet:</span>
                  <div>
                    <v-btn size="small" class="m-btn" @click="asText.font.value = { fontFamily: 'Georgia', fontSize: 30, fontStyle: 'italic' }"
                      >serif/30/italic</v-btn
                    >
                    <v-btn size="small" class="m-btn" @click="asText.font.value = undefined">font reset</v-btn>
                    <v-btn size="small" class="m-btn" @click="asText.fontSize.value += 4">size +4</v-btn>
                    <v-btn size="small" class="m-btn" @click="asText.fontSize.value -= 4">size −4</v-btn>
                    <v-btn
                      size="small"
                      class="m-btn"
                      :color="asText.fontStyle.value === 'bold' ? 'amber' : '#888888'"
                      @click="asText.fontStyle.value = asText.fontStyle.value === 'bold' ? 'normal' : 'bold'"
                    >
                      bold
                    </v-btn>
                    <v-btn
                      size="small"
                      class="m-btn"
                      :color="asText.textDecoration.value === 'underline' ? 'amber' : '#888888'"
                      @click="asText.textDecoration.value = asText.textDecoration.value === 'underline' ? '' : 'underline'"
                    >
                      underline
                    </v-btn>
                  </div>
                  <span class="muted">paragraph facet:</span>
                  <div>
                    <v-btn size="small" class="m-btn" @click="asText.align.value = cycle(ALIGNS, asText.align.value)"
                      >align: {{ asText.align.value }}</v-btn
                    >
                    <v-btn size="small" class="m-btn" @click="asText.wrap.value = cycle(WRAPS, asText.wrap.value)"
                      >wrap: {{ asText.wrap.value }}</v-btn
                    >
                    <v-btn
                      size="small"
                      class="m-btn"
                      :color="asText.ellipsis.value ? 'amber' : '#888888'"
                      @click="asText.ellipsis.value = !asText.ellipsis.value"
                    >
                      ellipsis: {{ asText.ellipsis.value }}
                    </v-btn>
                    <v-btn size="small" class="m-btn" @click="asText.padding.value += 4">pad +4</v-btn>
                    <v-btn size="small" class="m-btn" @click="asText.width.value += 20">w +20</v-btn>
                    <v-btn size="small" class="m-btn" @click="asText.width.value -= 20">w −20</v-btn>
                  </div>
                </template>
                <template v-else-if="asTextPath">
                  <v-btn size="small" class="m-btn" @click="asTextPath.fontSize.value += 4">size +4</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTextPath.fontSize.value -= 4">size −4</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTextPath.align.value = cycle(ALIGNS, asTextPath.align.value)"
                    >align: {{ asTextPath.align.value }}</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="asTextPath.letterSpacing.value += 1">spacing +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTextPath.letterSpacing.value -= 1">spacing −1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asTextPath.textBaseline.value = cycle(BASELINES, asTextPath.textBaseline.value)"
                    >baseline: {{ asTextPath.textBaseline.value }}</v-btn
                  >
                </template>
                <template v-else-if="asPolygon">
                  <v-btn size="small" class="m-btn" @click="asPolygon.sides.value += 1">sides +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asPolygon.sides.value -= 1">sides −1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asPolygon.radius.value += 5">radius +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asPolygon.radius.value -= 5">radius −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asPolygon.cornerRadius.value = ((asPolygon.cornerRadius.value as number) ?? 0) + 4"
                    >corner +4</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="asPolygon.cornerRadius.value = 0">corner 0</v-btn>
                </template>
                <template v-else-if="asStar">
                  <v-btn size="small" class="m-btn" @click="asStar.numPoints.value += 1">points +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asStar.numPoints.value -= 1">points −1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asStar.innerRadius.value += 5">inner +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asStar.innerRadius.value -= 5">inner −5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asStar.outerRadius.value += 5">outer +5</v-btn>
                  <v-btn size="small" class="m-btn" @click="asStar.outerRadius.value -= 5">outer −5</v-btn>
                </template>
                <template v-else-if="asImage">
                  <v-btn size="small" class="m-btn" @click="asImage.width.value += 20">w +20</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.width.value -= 20">w −20</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.height.value += 20">h +20</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.height.value -= 20">h −20</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.crop.value = { x: 0, y: 0, width: 120, height: 120 }">crop 120²</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.crop.value = undefined">crop none</v-btn>
                  <v-btn size="small" class="m-btn" @click="asImage.cornerRadius.value = ((asImage.cornerRadius.value as number) ?? 0) + 8"
                    >corner +8</v-btn
                  >
                </template>
                <template v-else-if="asSprite">
                  <v-btn size="small" class="m-btn" @click="asSprite.start()">start</v-btn>
                  <v-btn size="small" class="m-btn" @click="asSprite.stop()">stop</v-btn>
                  <v-btn size="small" class="m-btn" @click="asSprite.frameRate.value += 1">rate +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asSprite.frameRate.value -= 1">rate −1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asSprite.frameIndex.value += 1">frame +1</v-btn>
                </template>
                <template v-else-if="asEditableLine">
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.line.closed.value ? 'amber' : '#888888'"
                    @click="asEditableLine.line.closed.value = !asEditableLine.line.closed.value"
                  >
                    closed: {{ asEditableLine.line.closed.value }}
                  </v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.line.tension.value = { mode: 'by', value: 0.2 }">tension +.2</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.line.tension.value = { mode: 'reset' }">tension 0</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.line.strokeWidth.value = (asEditableLine.line.strokeWidth.value ?? 1) + 1">stroke +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.line.strokeWidth.value = Math.max(1, (asEditableLine.line.strokeWidth.value ?? 1) - 1)">stroke −1</v-btn>
                  <br />
                  <span class="muted">handles / assist:</span>
                  <br />
                  <v-btn size="small" class="m-btn" @click="asEditableLine.handlesShow.value = cycle(HANDLE_SHOWS, asEditableLine.handlesShow.value)">
                    handles: {{ asEditableLine.handlesShow.value }}
                  </v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.assistShow.value = cycle(ASSIST_SHOWS, asEditableLine.assistShow.value)">
                    assist: {{ asEditableLine.assistShow.value }}
                  </v-btn>
                  <br />
                  <span class="muted">click gestures (add/break a point):</span>
                  <br />
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.addOnDblClick.value ? 'amber' : '#888888'"
                    @click="asEditableLine.addOnDblClick.value = !asEditableLine.addOnDblClick.value"
                  >
                    dbl add: {{ asEditableLine.addOnDblClick.value }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.breakOnDblClick.value ? 'amber' : '#888888'"
                    @click="asEditableLine.breakOnDblClick.value = !asEditableLine.breakOnDblClick.value"
                  >
                    dbl break: {{ asEditableLine.breakOnDblClick.value }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.addOnAltClick.value ? 'amber' : '#888888'"
                    @click="asEditableLine.addOnAltClick.value = !asEditableLine.addOnAltClick.value"
                  >
                    alt add: {{ asEditableLine.addOnAltClick.value }}
                  </v-btn>
                  <br />
                  <span class="muted">scalable parts:</span>
                  <br />
                  <v-btn
                    v-for="sp in SCALABLE_PRESETS"
                    :key="sp.label"
                    size="small"
                    class="m-btn"
                    :color="scalableLabel(asEditableLine.scalableComponents.value) === scalableLabel(sp.value) ? 'amber' : '#888888'"
                    @click="asEditableLine.scalableComponents.value = sp.value"
                  >
                    {{ sp.label }}
                  </v-btn>
                  <br />
                  <span class="muted">point defaults / selection:</span>
                  <br />
                  <v-btn size="small" class="m-btn" @click="cycleDefaultMovable(asEditableLine)">
                    def move: {{ moveLabel(asEditableLine.defaultMovable.value) }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.defaultSelectable.value ? 'amber' : '#888888'"
                    @click="asEditableLine.defaultSelectable.value = !asEditableLine.defaultSelectable.value"
                  >
                    def selectable: {{ asEditableLine.defaultSelectable.value }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asEditableLine.persistentSelection.value ? 'amber' : '#888888'"
                    @click="asEditableLine.persistentSelection.value = !asEditableLine.persistentSelection.value"
                  >
                    persist sel: {{ asEditableLine.persistentSelection.value }}
                  </v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.clearSelection()">clear sel</v-btn>
                  <v-btn size="small" class="m-btn" @click="asEditableLine.removeSelected()">del selected</v-btn>
                </template>
                <template v-else-if="asGroup">
                  <v-btn size="small" class="m-btn" @click="asGroup.clip.value = { x: 0, y: 0, width: 90, height: 70 }">clip 90×70</v-btn>
                  <v-btn size="small" class="m-btn" @click="asGroup.clip.value = undefined">clip none</v-btn>
                </template>
              </div>

              <!-- Common transform (alteration rules) -->
              <div class="panel panel-transform">
                <div class="group-title">Transform</div>
                <v-btn size="small" class="m-btn" @click="selected.x.value = { mode: 'by', value: -10 }">x −10</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.x.value = { mode: 'by', value: 10 }">x +10</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.y.value = { mode: 'by', value: -10 }">y −10</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.y.value = { mode: 'by', value: 10 }">y +10</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.rotation.value = { mode: 'by', value: 15 }">rotate</v-btn>
                <br />
                <v-btn size="small" class="m-btn" @click="selected.scale.value = { mode: 'by', value: 1.1 }">scale ×1.1</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.scale.value = { mode: 'reset' }">scale reset</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.skew.value = { x: 0.3, y: 0 }">skew</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.opacity.value = { mode: 'by', value: -0.1 }">op −</v-btn>
                <v-btn size="small" class="m-btn" @click="selected.opacity.value = { mode: 'by', value: 0.1 }">op +</v-btn>
                <v-btn
                  size="small"
                  class="m-btn"
                  :color="selected.visible.value ? 'green' : '#888888'"
                  @click="selected.visible.value = !selected.visible.value"
                >
                  visible: {{ selected.visible.value }}
                </v-btn>
                <v-btn
                  size="small"
                  class="m-btn"
                  :color="selected.draggable.value ? 'green' : '#888888'"
                  @click="selected.draggable.value = !selected.draggable.value"
                >
                  draggable: {{ selected.draggable.value }}
                </v-btn>
                <v-btn
                  size="small"
                  class="m-btn"
                  :color="selected.scalable.value ? 'green' : '#888888'"
                  @click="selected.scalable.value = !selected.scalable.value"
                >
                  scalable: {{ selected.scalable.value }}
                </v-btn>
              </div>

              <!-- Fill (shapes only) -->
              <div v-if="asShape" class="panel panel-fill">
                <div class="group-title">Fill (union facet)</div>
                <div>
                  <v-btn size="small" class="m-btn" color="red" @click="setFill('#e53935')">red</v-btn>
                  <v-btn size="small" class="m-btn" color="green" @click="setFill('#43a047')">green</v-btn>
                  <v-btn size="small" class="m-btn" color="blue" @click="setFill('#1e88e5')">blue</v-btn>
                  <v-btn size="small" class="m-btn" @click="setFill(undefined)">none</v-btn>
                </div>
                <div>
                  <v-btn size="small" class="m-btn" @click="linearFill">linear grad</v-btn>
                  <v-btn size="small" class="m-btn" @click="radialFill">radial grad</v-btn>
                  <v-btn size="small" class="m-btn" @click="patternFill">pattern</v-btn>
                </div>
                <v-btn
                  size="small"
                  class="m-btn"
                  :color="asShape.allowMultipleFills ? 'amber' : '#888888'"
                  @click="asShape.allowMultipleFills = !asShape.allowMultipleFills"
                >
                  allowMultipleFills: {{ asShape.allowMultipleFills }}
                </v-btn>
              </div>

              <!-- Stroke facet (shapes only) -->
              <div v-if="asShape" class="panel panel-stroke">
                <div class="group-title">Stroke facet</div>
                <div>
                  <v-btn size="small" class="m-btn" @click="asShape.stroke.value = { color: '#ffffff', width: 2 }">white/2</v-btn>
                  <v-btn size="small" class="m-btn" @click="randomStroke">random</v-btn>
                  <v-btn size="small" class="m-btn" @click="asShape.stroke.value = undefined">reset</v-btn>
                </div>
                <div>
                  <v-btn size="small" class="m-btn" @click="asShape.stroke.value.color = '#ff4081'">.color</v-btn>
                  <v-btn size="small" class="m-btn" @click="asShape.stroke.value.width = (asShape.stroke.value.width ?? 0) + 1">.width +1</v-btn>
                  <v-btn size="small" class="m-btn" @click="toggleDash">.dash</v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="(asShape.stroke.value.enabled ?? true) ? 'green' : '#888888'"
                    @click="asShape.stroke.value.enabled = !(asShape.stroke.value.enabled ?? true)"
                  >
                    .enabled: {{ asShape.stroke.value.enabled ?? true }}
                  </v-btn>
                </div>
              </div>

              <!-- Shadow facet (shapes only) -->
              <div v-if="asShape" class="panel panel-shadow">
                <div class="group-title">Shadow facet</div>
                <div>
                  <v-btn
                    size="small"
                    class="m-btn"
                    @click="asShape.shadow.value = { color: '#000000', blur: 10, offset: { x: 6, y: 6 }, opacity: 0.6 }"
                    >drop</v-btn
                  >
                  <v-btn size="small" class="m-btn" @click="randomShadow">random</v-btn>
                  <v-btn size="small" class="m-btn" @click="asShape.shadow.value = undefined">reset</v-btn>
                </div>
                <div>
                  <v-btn size="small" class="m-btn" @click="asShape.shadow.value.color = '#00e5ff'">.color</v-btn>
                  <v-btn size="small" class="m-btn" @click="asShape.shadow.value.blur = (asShape.shadow.value.blur ?? 0) + 2">.blur +2</v-btn>
                </div>
              </div>

              <!-- More attributes (gco/drag are node-level; fill/stroke toggles are shape-only) -->
              <div class="panel panel-more">
                <div class="group-title">More attributes</div>
                <div>
                  <v-btn size="small" class="m-btn" @click="cycleGco">gco: {{ gcoText }}</v-btn>
                  <v-btn size="small" class="m-btn" :color="selected.dragBoundFunc.value ? 'amber' : '#888888'" @click="toggleDragLock">
                    drag: {{ selected.dragBoundFunc.value ? 'lock-Y' : 'free' }}
                  </v-btn>
                </div>
                <div v-if="asShape">
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asShape.fillRule.value === 'evenodd' ? 'amber' : '#888888'"
                    @click="asShape.fillRule.value = asShape.fillRule.value === 'evenodd' ? 'nonzero' : 'evenodd'"
                  >
                    fillRule: {{ asShape.fillRule.value || 'nonzero' }}
                  </v-btn>
                  <v-btn
                    size="small"
                    class="m-btn"
                    :color="asShape.strokeScaleEnabled.value ? 'green' : '#888888'"
                    @click="asShape.strokeScaleEnabled.value = !asShape.strokeScaleEnabled.value"
                  >
                    strokeScale: {{ asShape.strokeScaleEnabled.value }}
                  </v-btn>
                </div>
              </div>

              <!-- Reference binding (opacity is node-level; stroke is shape-only) -->
              <div class="panel panel-ref">
                <div class="group-title">Reference binding</div>
                <span class="muted">opacity bound to this slider (a <code>ref</code>):</span>
                <v-slider v-model="opacityRef" :min="0" :max="1" :step="0.05" color="amber" hide-details density="compact" class="mt-1" />
                <div>
                  <v-btn size="small" class="m-btn" color="secondary" @click="selected.opacity.value = opacityRef">bind opacity → ref</v-btn>
                </div>
                <template v-if="asShape">
                  <span class="muted">whole stroke / single sub-attribute → ref:</span>
                  <div>
                    <v-btn size="small" class="m-btn" color="secondary" @click="asShape.stroke.value = strokeRef">bind stroke → ref</v-btn>
                    <v-btn size="small" class="m-btn" color="secondary" @click="mutateStrokeRef">randomise stroke ref</v-btn>
                  </div>
                  <div>
                    <v-btn size="small" class="m-btn" color="secondary" @click="asShape.strokeWidth.value = strokeWidthRef">bind .width → ref</v-btn>
                    <v-btn size="small" class="m-btn" color="secondary" @click="mutateStrokeWidthRef">randomise width ref</v-btn>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { VBtn, VCol, VContainer, VRow, VSlider } from 'vuetify/components'
import ComponentHeader from './components/ComponentHeader.vue'
import PmiSplitPane from './components/PmiSplitPane.vue'
import PmiSplitPaneContainer from './components/PmiSplitPaneContainer.vue'
import Konva from 'konva'
import { KonvexStageContainer } from '@balage1551/konvex'
import type { KonvexStageExpose, WorldMode, ZoomMode } from '@balage1551/konvex'
import type { KonvexStage } from '@balage1551/konvex'
import type { KonvexLayer } from '@balage1551/konvex'
import { KonvexRect } from '@balage1551/konvex'
import { KonvexCircle } from '@balage1551/konvex'
import { KonvexEllipse } from '@balage1551/konvex'
import { KonvexRing } from '@balage1551/konvex'
import { KonvexWedge } from '@balage1551/konvex'
import { KonvexArc } from '@balage1551/konvex'
import { KonvexLine, type LineProjection, type LineProjectionScope } from '@balage1551/konvex'
import { KonvexArrow } from '@balage1551/konvex'
import { KonvexPath } from '@balage1551/konvex'
import { KonvexTag } from '@balage1551/konvex'
import { KonvexText } from '@balage1551/konvex'
import { KonvexTextPath } from '@balage1551/konvex'
import { KonvexRegularPolygon } from '@balage1551/konvex'
import { KonvexStar } from '@balage1551/konvex'
import { KonvexImage } from '@balage1551/konvex'
import { KonvexSprite } from '@balage1551/konvex'
import { KonvexGroup } from '@balage1551/konvex'
import { KonvexShape } from '@balage1551/konvex'
import type { AnyNode, Fill, Stroke } from '@balage1551/konvex'
import {
  EditableLine,
  EditableLineToolbar,
  type PointMovement,
  type ScalableComponents,
  type ToolbarItemSpec,
} from '@balage1551/konvex-editable-line'

const kx = useTemplateRef<KonvexStageExpose>('kx')
const viewTick = ref(0) // bumped on zoom/scroll to refresh screen-space adornments
const zoomDisplay = ref(1)
const WORLD_MODES = ['free', 'elastic', 'clipped', 'bounded'] as const
const worldMode = ref<WorldMode>('elastic')
const zoomMode = ref<ZoomMode>('proportional')
const unitScale = ref(1) // measurement scale (real units per world unit)
const cursor = shallowRef<{ x: number; y: number } | null>(null)
const altDown = ref(false)
const lineProjection = shallowRef<LineProjection | null>(null)
const PROJECTION_SCOPES = ['internal', 'terminal', 'start', 'end'] as const
const projectionScope = ref<LineProjectionScope>('internal')

// Host-owned empty-canvas deselect timing (applied in onStageReady). Deferring
// lets a double-click add a point before the single-click deselect fires; toggle
// it off to feel the raw click-before-dblclick race.
const deferDeselect = ref(true)
const deselectDelayMs = ref(Konva.dblClickWindow)

/** Cycle to the next value in a literal list (wraps). */
function cycle<E extends string>(list: readonly E[], current: string | undefined): E {
  const i = current ? list.indexOf(current as E) : -1
  return list[(i + 1) % list.length]
}

let world: KonvexLayer | undefined // the stage's transformed content layer
let outline: KonvexRect | undefined

const selected = shallowRef<AnyNode>()
const count = ref(0)

// Editable lines show their handles only while host-selected (handles.show: whenSelected).
const editableLines: EditableLine[] = []
watch(selected, s => editableLines.forEach(el => (el.active.value = el === s)))

const MOVE_CYCLE: PointMovement[] = ['free', 'x', 'y', false]
function cyclePointMovable(el: EditableLine, index: number, current: PointMovement): void {
  const next = MOVE_CYCLE[(MOVE_CYCLE.indexOf(current) + 1) % MOVE_CYCLE.length]
  el.setPointOptions(index, { movable: next })
}
function moveLabel(m: PointMovement): string {
  return m === false ? 'locked' : m
}

// EditableLine settings-block enums.
const HANDLE_SHOWS = ['always', 'whenSelected', 'never'] as const
const ASSIST_SHOWS = ['always', 'onAlt', 'never'] as const
const SCALABLE_PRESETS: { label: string; value: ScalableComponents }[] = [
  { label: 'all', value: 'all' },
  { label: 'none', value: 'none' },
  { label: 'line', value: ['line'] },
  { label: 'line+marker', value: ['line', 'marker'] },
  { label: 'all parts', value: ['line', 'marker', 'helper'] },
]
function scalableLabel(v: ScalableComponents): string {
  return v === 'all' ? 'all' : v === 'none' ? 'none' : v.join('+')
}
function cycleDefaultMovable(el: EditableLine): void {
  el.defaultMovable.value = MOVE_CYCLE[(MOVE_CYCLE.indexOf(el.defaultMovable.value) + 1) % MOVE_CYCLE.length]
}

function updateProjection(): void {
  const s = selected.value
  const q = cursor.value
  lineProjection.value =
    altDown.value && q && s instanceof KonvexLine
      ? (s.project(q, projectionScope.value) ?? null)
      : null
}
function cycleProjectionScope(): void {
  projectionScope.value = cycle(PROJECTION_SCOPES, projectionScope.value)
  updateProjection()
}

// reference-binding demo refs
const opacityRef = ref(1)
const strokeRef = ref<Stroke>({ color: '#00e5ff', width: 3 })
const strokeWidthRef = ref(2)

const patternImage = new Image()
patternImage.src = '/puffins.jpg'

// --- selection -----------------------------------------------------------
function select(shape: AnyNode | undefined): void {
  selected.value = shape
  updateProjection()
}
// True (typed) when the selection is a leaf shape — gates the paint panels.
const asShape = computed(() => (selected.value instanceof KonvexShape ? selected.value : undefined))
const asGroup = computed(() =>
  selected.value instanceof KonvexGroup && !(selected.value instanceof EditableLine)
    ? selected.value
    : undefined,
)
const asEditableLine = computed(() =>
  selected.value instanceof EditableLine ? selected.value : undefined,
)

// Typed views used by the shape-specific panel (v-if + typed field access).
const asRect = computed(() => (selected.value instanceof KonvexRect ? selected.value : undefined))
const asCircle = computed(() => (selected.value instanceof KonvexCircle ? selected.value : undefined))
const asEllipse = computed(() => (selected.value instanceof KonvexEllipse ? selected.value : undefined))
const asRing = computed(() => (selected.value instanceof KonvexRing ? selected.value : undefined))
const asWedge = computed(() => (selected.value instanceof KonvexWedge ? selected.value : undefined))
const asArc = computed(() => (selected.value instanceof KonvexArc ? selected.value : undefined))
// Arrow is-a Line, so check Arrow first; `asLine` is true for both (it carries
// the shared line controls, with arrow extras nested under `asArrow`).
const asArrow = computed(() => (selected.value instanceof KonvexArrow ? selected.value : undefined))
const asLine = computed(() => (selected.value instanceof KonvexLine ? selected.value : undefined))
// The measurable polyline behind the selection: a normal line, or the EL's line.
const measuredLine = computed(() => asLine.value ?? asEditableLine.value?.line)
const asPath = computed(() => (selected.value instanceof KonvexPath ? selected.value : undefined))
const asTag = computed(() => (selected.value instanceof KonvexTag ? selected.value : undefined))
// TextPath is not a Text subclass, so these are independent.
const asText = computed(() => (selected.value instanceof KonvexText ? selected.value : undefined))
const asTextPath = computed(() => (selected.value instanceof KonvexTextPath ? selected.value : undefined))
const asPolygon = computed(() => (selected.value instanceof KonvexRegularPolygon ? selected.value : undefined))
const asStar = computed(() => (selected.value instanceof KonvexStar ? selected.value : undefined))
const asImage = computed(() => (selected.value instanceof KonvexImage ? selected.value : undefined))
const asSprite = computed(() => (selected.value instanceof KonvexSprite ? selected.value : undefined))

const kind = computed(() => {
  const s = selected.value
  if (!s) return '— (none)'
  if (s instanceof KonvexRect) return 'Rect'
  if (s instanceof KonvexCircle) return 'Circle'
  if (s instanceof KonvexEllipse) return 'Ellipse'
  if (s instanceof KonvexRing) return 'Ring'
  if (s instanceof KonvexWedge) return 'Wedge'
  if (s instanceof KonvexArc) return 'Arc'
  if (s instanceof KonvexArrow) return 'Arrow'
  if (s instanceof KonvexLine) return 'Line'
  if (s instanceof KonvexPath) return 'Path'
  if (s instanceof KonvexTag) return 'Tag'
  if (s instanceof KonvexText) return 'Text'
  if (s instanceof KonvexTextPath) return 'TextPath'
  if (s instanceof KonvexRegularPolygon) return 'Polygon'
  if (s instanceof KonvexStar) return 'Star'
  if (s instanceof KonvexImage) return 'Image'
  if (s instanceof KonvexSprite) return 'Sprite'
  if (s instanceof EditableLine) return 'EditableLine'
  if (s instanceof KonvexGroup) return 'Group'
  return 'Shape'
})

// Enum lists for the cycling buttons below.
const ALIGNS = ['left', 'center', 'right', 'justify'] as const
const WRAPS = ['word', 'char', 'none'] as const
const POINTER_DIRS = ['none', 'up', 'down', 'left', 'right'] as const
const BASELINES = ['alphabetic', 'top', 'middle', 'bottom'] as const

// --- adding shapes -------------------------------------------------------
function randPos(): { x: number; y: number } {
  return { x: 90 + Math.random() * 560, y: 90 + Math.random() * 260 }
}

function register(shape: AnyNode): void {
  shape.draggable.value = true
  shape.onClick(() => select(shape))
  shape.onDragStart(() => select(shape))
  world!.add(shape)
  count.value = world!.children.length
  select(shape)
}

function addRect(): void {
  const p = randPos()
  register(new KonvexRect({ ...p, width: 90, height: 60, fill: '#1e88e5', stroke: { color: '#fff', width: 2 } }))
}
function addCircle(): void {
  const p = randPos()
  register(new KonvexCircle({ ...p, radius: 45, fill: '#e53935', stroke: { color: '#fff', width: 2 } }))
}
function addEllipse(): void {
  const p = randPos()
  register(new KonvexEllipse({ ...p, radiusX: 60, radiusY: 35, fill: '#43a047', stroke: { color: '#fff', width: 2 } }))
}
function addRing(): void {
  const p = randPos()
  register(new KonvexRing({ ...p, innerRadius: 22, outerRadius: 48, fill: '#fb8c00', stroke: { color: '#fff', width: 2 } }))
}
function addWedge(): void {
  const p = randPos()
  register(new KonvexWedge({ ...p, radius: 55, angle: 120, fill: '#8e24aa', stroke: { color: '#fff', width: 2 } }))
}
function addArc(): void {
  const p = randPos()
  register(new KonvexArc({ ...p, innerRadius: 24, outerRadius: 55, angle: 200, fill: '#00897b', stroke: { color: '#fff', width: 2 } }))
}
function addLine(): void {
  const p = randPos()
  register(new KonvexLine({ ...p, points: [0, 0, 50, -40, 100, 10, 150, -30], stroke: { color: '#ffd54f', width: 3 } }))
}
function addArrow(): void {
  const p = randPos()
  register(
    new KonvexArrow({ ...p, points: [0, 0, 130, 0], stroke: { color: '#ff7043', width: 4 }, fill: '#ff7043', pointerLength: 14, pointerWidth: 14 })
  )
}
// Demonstrates the toolbar item framework: the migrated builtins, the
// selection-independent `toggle-closed`, plus one inline custom tool.
const toolbarItems: ToolbarItemSpec[] = [
  'align-h-start',
  'align-h-center',
  'align-h-end',
  'align-v-start',
  'align-v-center',
  'align-v-end',
  '|',
  'straighten',
  'simplify',
  'toggle-closed',
  {
    id: 'log-coords',
    label: 'Log selected coords',
    render: { icon: 'mdi-map-marker' },
    state: ctx => (ctx.selection.length ? 'enabled' : 'disabled'),
    run: ctx => console.log('selected points', ctx.points),
  },
  '|',
  'delete',
]

function addEditableLine(): void {
  const p = randPos()
  const el = new EditableLine({
    ...p,
    points: [
      { x: 0, y: 0 },
      { x: 70, y: -45 },
      { x: 150, y: 25 },
      { x: 220, y: -20 },
    ],
    line: { stroke: { color: '#26c6da', width: 3 } },
    movable: 'free',
    selectable: true,
    pointOptions: [{ movable: false }], // pin the first point, to show per-point overrides
    handles: { show: 'whenSelected', size: 12 },
    assist: { show: 'onAlt', scope: 'internal', snapThreshold: 14 },
    // Plain double-click adds/breaks — no Alt. The single-vs-double-click race
    // (the first `click` of a double fires before `dblclick`) is resolved at the
    // host by deferring the empty-canvas deselect; see onStageReady.
    addOnDblClick: true, // dblclick on empty canvas → add a point (snaps to the line if near)
    breakOnDblClick: true, // dblclick on the line → insert a point at the projection
  })
  editableLines.push(el)
  register(el)
}
function addPath(): void {
  const p = randPos()
  register(new KonvexPath({ ...p, data: 'M0 0 C 40 -50 90 -50 130 0 S 220 50 260 0', stroke: { color: '#ffd54f', width: 3 } }))
}
function addTag(): void {
  const p = randPos()
  register(
    new KonvexTag({
      ...p,
      width: 120,
      height: 50,
      fill: '#455a64',
      stroke: { color: '#fff', width: 2 },
      pointerDirection: 'down',
      pointerWidth: 20,
      pointerHeight: 16,
      cornerRadius: 6,
    })
  )
}
function addText(): void {
  const p = randPos()
  register(new KonvexText({ ...p, text: 'Konvex text demo', width: 220, fill: '#ffffff', font: { fontSize: 22 } }))
}
function addTextPath(): void {
  const p = randPos()
  register(
    new KonvexTextPath({
      ...p,
      text: 'text along a path',
      data: 'M0 0 C 40 -40 90 -40 130 0 S 220 40 260 0',
      fill: '#ffffff',
      font: { fontSize: 18 },
    })
  )
}
function addRegularPolygon(): void {
  const p = randPos()
  register(new KonvexRegularPolygon({ ...p, sides: 6, radius: 45, fill: '#5c6bc0', stroke: { color: '#fff', width: 2 } }))
}
function addStar(): void {
  const p = randPos()
  register(new KonvexStar({ ...p, numPoints: 5, innerRadius: 22, outerRadius: 50, fill: '#ffca28', stroke: { color: '#fff', width: 2 } }))
}
function addImage(): void {
  const p = randPos()
  register(new KonvexImage({ ...p, image: patternImage, width: 140, height: 100, stroke: { color: '#fff', width: 2 } }))
}
function addSprite(): void {
  const p = randPos()
  // puffins.jpg stands in for a sprite sheet: three 120px frames cycled.
  const sprite = new KonvexSprite({
    ...p,
    image: patternImage,
    animation: 'idle',
    animations: { idle: [0, 0, 120, 120, 120, 0, 120, 120, 240, 0, 120, 120] },
    frameRate: 3,
  })
  register(sprite)
  sprite.start()
}
function addGroup(): void {
  const p = randPos()
  // A group of two shapes; selecting/dragging acts on the whole group. The
  // children aren't individually draggable, so a click anywhere selects the group.
  const g = new KonvexGroup({ ...p })
  g.add(new KonvexRect({ x: 0, y: 0, width: 70, height: 50, fill: '#26a69a', stroke: { color: '#fff', width: 2 } }))
  g.add(new KonvexCircle({ x: 90, y: 25, radius: 28, fill: '#ef5350', stroke: { color: '#fff', width: 2 } }))
  register(g)
}

function addPoint(line: KonvexLine): void {
  const pts = [...line.points.value]
  const lastX = pts.length >= 2 ? pts[pts.length - 2] : 0
  const lastY = pts.length >= 1 ? pts[pts.length - 1] : 0
  pts.push(lastX + 30 + Math.random() * 30, lastY + (Math.random() * 60 - 30))
  line.points.value = pts
}

function deleteSelected(): void {
  const s = selected.value
  if (!s || !world) return
  select(undefined)
  world.remove(s)
  s.destroy()
  count.value = world.children.length
}

// --- fill helpers (operate on the selected *shape*) ----------------------
function setFill(color: string | undefined): void {
  if (asShape.value) asShape.value.fill.value = color
}
function linearFill(): void {
  if (!asShape.value) return
  asShape.value.fill.value = {
    type: 'linearGradient',
    start: { x: -50, y: -50 },
    end: { x: 50, y: 50 },
    colorStops: [
      { offset: 0, color: '#e53935' },
      { offset: 1, color: '#fbc02d' },
    ],
  }
}
function radialFill(): void {
  if (!asShape.value) return
  asShape.value.fill.value = {
    type: 'radialGradient',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
    startRadius: 0,
    endRadius: 60,
    colorStops: [
      { offset: 0, color: '#ffffff' },
      { offset: 1, color: '#1e88e5' },
    ],
  }
}
function patternFill(): void {
  if (!asShape.value) return
  asShape.value.fill.value = { type: 'pattern', image: patternImage, repeat: 'repeat', scale: 0.1 }
}

// --- stroke / shadow helpers ---------------------------------------------
function randomColor(): string {
  const c = ['#e53935', '#43a047', '#1e88e5', '#fbc02d', '#8e24aa', '#ffffff']
  return c[Math.floor(Math.random() * c.length)]
}
function randomStroke(): void {
  if (asShape.value) {
    asShape.value.stroke.value = { color: randomColor(), width: 1 + Math.floor(Math.random() * 8) }
  }
}
function toggleDash(): void {
  if (!asShape.value) return
  const current = asShape.value.stroke.value.dash
  asShape.value.stroke.value.dash = current && current.length ? undefined : [12, 6]
}
function randomShadow(): void {
  if (asShape.value) {
    asShape.value.shadow.value = {
      color: randomColor(),
      blur: 4 + Math.floor(Math.random() * 16),
      offset: { x: Math.floor(Math.random() * 12) - 6, y: Math.floor(Math.random() * 12) - 6 },
      opacity: 0.4 + Math.random() * 0.5,
    }
  }
}

// --- more attributes ------------------------------------------------------
const gcoCycle = ['source-over', 'multiply', 'screen', 'difference', 'xor'] as const
let gcoIndex = 0
function cycleGco(): void {
  if (!selected.value) return
  gcoIndex = (gcoIndex + 1) % gcoCycle.length
  selected.value.globalCompositeOperation.value = gcoCycle[gcoIndex]
}
const gcoText = computed(() => selected.value?.globalCompositeOperation.value || 'source-over')

function toggleDragLock(): void {
  if (!selected.value) return
  const s = selected.value
  s.dragBoundFunc.value = s.dragBoundFunc.value ? undefined : pos => ({ x: pos.x, y: s.y.value })
}

function mutateStrokeRef(): void {
  strokeRef.value = {
    color: randomColor(),
    width: 1 + Math.floor(Math.random() * 8),
    dash: Math.random() > 0.5 ? [10, 5] : undefined,
  }
}
function mutateStrokeWidthRef(): void {
  strokeWidthRef.value = 1 + Math.floor(Math.random() * 10)
}

// --- read-out formatting --------------------------------------------------
function round(v: number | undefined, digits = 0): string {
  if (v === undefined) return '—'
  const f = Math.pow(10, digits)
  return String(Math.round(v * f) / f)
}
function describeFill(fill: Fill): string {
  if (!fill) return '—'
  switch (fill.type) {
    case 'solid':
      return `solid ${fill.color}`
    case 'linearGradient':
      return `linear ${fill.colorStops.map(s => s.color).join('→')}`
    case 'radialGradient':
      return `radial ${fill.colorStops.map(s => s.color).join('→')}`
    case 'pattern':
      return 'pattern (image)'
  }
}
const fillText = computed(() => describeFill(asShape.value?.fill.value))
const strokeText = computed(() => {
  const s = asShape.value?.stroke.value
  if (!s) return '—'
  return `color=${s.color ?? '—'} width=${s.width ?? '—'} dash=[${s.dash?.join(',') ?? ''}]`
})
const shadowText = computed(() => {
  const s = asShape.value?.shadow.value
  if (!s) return '—'
  const o = s.offset
  const offset = o ? `(${round(o.x)},${round(o.y)})` : '—'
  return `color=${s.color ?? '—'} blur=${s.blur ?? '—'} offset=${offset} opacity=${round(s.opacity, 2)}`
})
const specificText = computed(() => {
  const s = selected.value
  if (s instanceof KonvexRect)
    return `w=${round(s.width.value)} h=${round(s.height.value)} area=${round(s.area.value)} scaledArea=${round(s.scaledArea.value)}`
  if (s instanceof KonvexCircle) return `radius=${round(s.radius.value)} area=${round(s.area.value)} scaledArea=${round(s.scaledArea.value)}`
  if (s instanceof KonvexEllipse)
    return `radiusX=${round(s.radiusX.value)} radiusY=${round(s.radiusY.value)} scaledArea=${round(s.scaledArea.value)}`
  if (s instanceof KonvexRing) return `inner=${round(s.innerRadius.value)} outer=${round(s.outerRadius.value)}`
  if (s instanceof KonvexWedge) return `radius=${round(s.radius.value)} angle=${round(s.angle.value)} cw=${s.clockwise.value}`
  if (s instanceof KonvexArc)
    return `inner=${round(s.innerRadius.value)} outer=${round(s.outerRadius.value)} angle=${round(s.angle.value)} cw=${s.clockwise.value}`
  if (s instanceof KonvexArrow)
    return `points=${s.points.value.length / 2} tension=${round(s.tension.value, 2)} ptr=${round(s.pointerLength.value)}/${round(s.pointerWidth.value)}`
  if (s instanceof KonvexLine) return `points=${s.points.value.length / 2} tension=${round(s.tension.value, 2)} closed=${s.closed.value}`
  if (s instanceof KonvexPath) return `length=${round(s.length.value)} scaledLength=${round(s.scaledLength.value)}`
  if (s instanceof KonvexTag)
    return `dir=${s.pointerDirection.value} ptr=${round(s.pointerWidth.value)}×${round(s.pointerHeight.value)} w=${round(s.width.value)} h=${round(s.height.value)}`
  if (s instanceof KonvexText)
    return `"${s.text.value}" font=${round(s.fontSize.value)} ${s.fontStyle.value ?? ''} align=${s.align.value} size=${round(s.textWidth.value)}×${round(s.textHeight.value)}`
  if (s instanceof KonvexTextPath) return `"${s.text.value}" font=${round(s.fontSize.value)} align=${s.align.value} baseline=${s.textBaseline.value}`
  if (s instanceof KonvexRegularPolygon)
    return `sides=${round(s.sides.value)} radius=${round(s.radius.value)} area=${round(s.area.value)} scaledArea=${round(s.scaledArea.value)}`
  if (s instanceof KonvexStar) return `points=${round(s.numPoints.value)} inner=${round(s.innerRadius.value)} outer=${round(s.outerRadius.value)}`
  if (s instanceof KonvexImage) {
    const c = s.crop.value
    const crop = c && c.width ? `(${round(c.x)},${round(c.y)},${round(c.width)},${round(c.height)})` : 'none'
    return `w=${round(s.width.value)} h=${round(s.height.value)} crop=${crop}`
  }
  if (s instanceof KonvexSprite) return `anim=${s.animation.value} frame=${round(s.frameIndex.value)} rate=${round(s.frameRate.value)}`
  if (s instanceof KonvexGroup) return `children=${s.children.length}`
  return '—'
})

// --- lifecycle ------------------------------------------------------------
// Selection's screen-space bbox. clientRect is in absolute (screen) coords, so it
// already accounts for the world layer's zoom/pan; viewTick forces a re-read on
// zoom/scroll (a layer-transform change fires no per-node event).
const selScreenRect = computed(() => {
  const tick = viewTick.value
  const r = selected.value?.clientRect.value
  return r ? { ...r, tick } : undefined
})

// Screen position of the selection's local origin (0,0) — accounts for the
// node's rotation/offset and the world layer's zoom/pan. tick + clientRect are
// dragged into the object so the marker re-reads on zoom/scroll and on move.
const originScreen = computed(() => {
  const tick = viewTick.value
  const s = selected.value
  if (!s) return undefined
  const cr = s.clientRect.value
  const p = s.konvaRoot().getAbsoluteTransform().point({ x: 0, y: 0 })
  return { x: p.x, y: p.y, tick, w: cr.width }
})

// --- line projection visualisation (state/updater defined near the top) ---
function onAltKey(e: KeyboardEvent): void {
  altDown.value = e.altKey
  updateProjection()
}

// Screen-space geometry for the projection overlay (dashed query→projection
// line + a guide through the enclosing segment, which collapses to one line at a
// vertex). viewTick keeps it in sync on zoom/scroll.
const projViz = computed(() => {
  const tick = viewTick.value
  const proj = lineProjection.value
  const q0 = cursor.value
  const s = selected.value
  const stage = kx.value
  if (!proj || !q0 || !stage || !(s instanceof KonvexLine)) return null
  const wp = s.worldPoints()
  const last = wp.length - 1
  const q = stage.worldToScreen(q0)
  const p = stage.worldToScreen(proj.point)
  const dash = [q.x, q.y, p.x, p.y] // cursor → projection
  let guide: number[]
  if (proj.segment < 0 || proj.segment >= last) {
    // terminal extension: no real segment to split — the single guideline is the
    // leg toward the endpoint itself (the would-be new segment), not the inner
    // neighbour.
    guide = [q.x, q.y, p.x, p.y]
  } else {
    // body insert → two legs A → cursor → B through the enclosing segment
    const a = stage.worldToScreen(wp[proj.segment])
    const b = stage.worldToScreen(wp[proj.segment + 1])
    guide = [a.x, a.y, q.x, q.y, b.x, b.y]
  }
  return { dash, guide, tick }
})

onMounted(() => {
  window.addEventListener('keydown', onAltKey)
  window.addEventListener('keyup', onAltKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onAltKey)
  window.removeEventListener('keyup', onAltKey)
})

function onZoom(z: number): void {
  zoomDisplay.value = z
  viewTick.value++
}
function onViewChange(): void {
  viewTick.value++
}

// The component owns the stage; we get its transformed content layer + overlay here.
function onStageReady(stage: KonvexStage): void {
  world = kx.value?.world
  const overlay = kx.value?.overlay
  if (!world || !overlay) return

  // Selection outline lives in the unscaled overlay → constant thickness, always on top.
  outline = new KonvexRect({ listening: false, stroke: { color: '#ffd54f', width: 1, dash: [6, 4] } })
  overlay.add(outline)
  outline.x.value = () => selScreenRect.value?.x ?? -10000
  outline.y.value = () => selScreenRect.value?.y ?? -10000
  outline.width.value = () => selScreenRect.value?.width ?? 0
  outline.height.value = () => selScreenRect.value?.height ?? 0
  outline.visible.value = () => !!selected.value

  // An X at the selection's local origin (0,0), constant on-screen size.
  const originMarker = new KonvexPath({
    listening: false,
    data: 'M -7 -7 L 7 7 M -7 7 L 7 -7',
    stroke: { color: '#ff5252', width: 1.5 },
  })
  overlay.add(originMarker)
  originMarker.x.value = () => originScreen.value?.x ?? -10000
  originMarker.y.value = () => originScreen.value?.y ?? -10000
  originMarker.visible.value = () => !!selected.value

  // Line-projection overlay: dashed cursor→projection line + a guide (two legs
  // A→cursor→B for a body insert; a single leg toward the neighbour for a
  // terminal extension, where there's no enclosing segment).
  const projLine = new KonvexLine({ listening: false, stroke: { color: '#00e5ff', width: 1, dash: [4, 4] } })
  const projGuide = new KonvexLine({ listening: false, stroke: { color: '#b0bec5', width: 1 } })
  overlay.add(projGuide)
  overlay.add(projLine)
  projLine.points.value = () => projViz.value?.dash ?? []
  projLine.visible.value = () => !!projViz.value
  projGuide.points.value = () => projViz.value?.guide ?? []
  projGuide.visible.value = () => !!projViz.value

  // Click empty canvas to deselect. But a *double*-click on empty canvas ADDS a
  // point (EditableLine.addOnDblClick), and the browser fires the first `click`
  // of a double before the `dblclick` — so an eager deselect would fire (and
  // clear `active`) before the add ever runs. Selection is a host concern, so
  // the host owns the fix: defer the deselect by Konva's own double-click window
  // and cancel it if a `dblclick` lands. The delay only affects deselect.
  let deselectTimer: ReturnType<typeof setTimeout> | undefined
  const cancelPendingDeselect = (): void => {
    if (deselectTimer !== undefined) {
      clearTimeout(deselectTimer)
      deselectTimer = undefined
    }
  }
  stage.onClick(e => {
    if (e.target !== stage.detach()) return // empty canvas only
    if (e.evt.altKey) return // Alt is the show-control-lines modifier — never deselects
    if (!deferDeselect.value) {
      select(undefined) // immediate — reproduces the raw click-before-dblclick race
      return
    }
    if (e.evt.detail >= 2) {
      // Second click of a double: the dblclick handler adds the point; don't deselect.
      cancelPendingDeselect()
      return
    }
    cancelPendingDeselect()
    deselectTimer = setTimeout(() => {
      deselectTimer = undefined
      select(undefined)
    }, deselectDelayMs.value)
  })
  stage.onDblClick(e => {
    if (e.target === stage.detach()) cancelPendingDeselect()
  })
  // Live world coordinate under the cursor (uses the stage's pointer utility).
  stage.onMouseMove(() => {
    cursor.value = kx.value?.pointerWorld() ?? null
    updateProjection()
  })
  stage.onMouseLeave(() => {
    cursor.value = null
    updateProjection()
  })

  addCircle()
}
</script>

<style scoped>
.controls {
  height: 100%;
  overflow-y: auto;
  padding-right: 6px;
}
.panel {
  background: #34495e;
  border: 1px solid #46637f;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
/* Distinct dark-pastel background per setter group. */
.panel-objects {
  background: #3b4664;
}
.panel-view {
  background: #3b5560;
}
.panel-shape {
  background: #4b3f5e;
}
.panel-transform {
  background: #3f5544;
}
.panel-fill {
  background: #5e4242;
}
.panel-stroke {
  background: #42505e;
}
.panel-shadow {
  background: #3a3a44;
}
.panel-more {
  background: #5a5142;
}
.panel-ref {
  background: #425a4f;
}
.group-title {
  color: #ffd54f;
  font-weight: bold;
  margin-bottom: 4px;
}
.m-btn {
  margin: 2px;
}
.info {
  display: inline-block;
  margin-right: 14px;
  white-space: nowrap;
}
.label {
  color: #90caf9;
  font-weight: bold;
}
.muted {
  color: #b0bec5;
  font-size: 0.85em;
}
.readout {
  font-family: monospace;
  font-size: 0.9em;
  padding: 8px;
}
.pt-table-wrap {
  max-height: 180px;
  overflow: auto;
  margin-top: 4px;
}
.pt-table {
  border-collapse: collapse;
  font-size: 0.85em;
}
.pt-table th,
.pt-table td {
  border: 1px solid #555;
  padding: 1px 8px;
  text-align: right;
}
.pt-table th {
  color: #90caf9;
  position: sticky;
  top: 0;
  background: #2c2c34;
}
.pt-table tr.selrow td {
  background: #4a4327;
  color: #ffd54f;
}
.pt-table td.cell-btn {
  cursor: pointer;
  user-select: none;
  text-align: center;
}
.pt-table td.cell-btn:hover {
  background: #3a4a5a;
  color: #fff;
}
</style>

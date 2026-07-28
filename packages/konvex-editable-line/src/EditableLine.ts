import { computed, type ComputedRef, ref, type Ref, watch } from 'vue'
import type Konva from 'konva'
import { KonvexGroup } from '@balage1551/konvex'
import { KonvexLine, type LineProjection } from '@balage1551/konvex'
import { type SimplificationThreshold, simplifyPoints, straightenPoints } from '@balage1551/konvex'
import { KonvexCircle } from '@balage1551/konvex'
import { KonvexRect } from '@balage1551/konvex'
import { LINE_PROJECTION_SCOPES, lineProjectionParts } from '@balage1551/konvex'
import type { LineProjectionScope, Vector2d } from '@balage1551/konvex'
import {
  type AssistShow,
  defaultHandleStyle,
  type EditableLineConfig,
  type HandleShow,
  type PointInfo,
  type PointMovement,
  type PointOptions,
  type ScalableComponent,
  type ScalableComponents,
} from './EditableLine-types'
import { EditableLineEmitter, type EditableLineEventMap } from './EditableLine-events'

/** Default assist snap distance (world units) when `assist.snapThreshold` is unset. */
const DEFAULT_SNAP_THRESHOLD = 10

/**
 * Whether a Konva click/dblclick came from the primary (left) mouse button.
 *
 * Konva fires `click` and `dblclick` for *every* button, so an editing gesture
 * that does not check this will also run on a right-click — and, since
 * `contextmenu` fires independently, an Alt+right-click would both insert a
 * point and open the toolbar. Touch never reaches these handlers: Konva maps it
 * to `tap` / `dbltap`, so the check costs nothing there.
 */
function isPrimaryButton(e: { evt: unknown }): boolean {
  return (e.evt as MouseEvent | undefined)?.button === 0
}

/**
 * An interactively editable polyline. A `KonvexGroup` owning a `KonvexLine`
 * (the geometry, exposed as {@link line} — style it directly) plus a layer of
 * constant-size drag handles. Selection and point coordinates are reactive so a
 * host can `watch` them. Built only on the public konvex surface.
 */
export class EditableLine extends KonvexGroup {
  /** The wrapped geometry — set paint / `closed` / `tension` on this directly. */
  readonly line: KonvexLine
  /** Indices of the currently selected points (reactive). */
  readonly selection: Ref<readonly number[]> = ref([])
  /** Whether the line is "active" (host-selected); gates `handles.show: whenSelected`. */
  readonly active: Ref<boolean> = ref(true)
  /** Discrete (non-Konva) events — e.g. a `toolbar-request` on right-click. */
  readonly events = new EditableLineEmitter<EditableLineEventMap>()

  // Live behavioural settings (seeded from config; tweakable at runtime).
  readonly handlesShow: Ref<HandleShow>
  readonly assistShow: Ref<AssistShow>
  /**
   * Where added points may land — any subset of `'start'` / `'internal'` / `'end'`
   * (see `LINE_PROJECTION_SCOPES` for the named ones). Defaults to all three, so
   * a point can go on the body or extend either end.
   *
   * Holds the resolved set: seed it from a name via `assist.scope`, and assign a
   * set (or a `LINE_PROJECTION_SCOPES` entry) to change it at runtime. Governs
   * where an added point actually lands; the assist previews the same decision.
   */
  readonly projectionScope: Ref<LineProjectionScope>
  /** Distance (world units) within which an inserted point snaps onto the line. */
  readonly snapThreshold: Ref<number>
  readonly scalableComponents: Ref<ScalableComponents>
  readonly defaultMovable: Ref<PointMovement>
  readonly defaultSelectable: Ref<boolean>
  /** Double-clicking the stage adds a point (snapped to the line if close). */
  readonly addOnDblClick: Ref<boolean>
  /** Double-clicking the line inserts a point at the projection. */
  readonly breakOnDblClick: Ref<boolean>
  /** Alt+click commits the assist (insert on the line, or extend at the cursor). */
  readonly addOnAltClick: Ref<boolean>
  /** Keep the point selection when the line is deactivated; otherwise it clears on deselect. */
  readonly persistentSelection: Ref<boolean>
  /** One row per point: index, coordinate, effective options and selection. */
  readonly pointInfos: ComputedRef<PointInfo[]>

  private readonly _cfg: EditableLineConfig
  private readonly _handleGroup: KonvexGroup
  private readonly _assistGroup: KonvexGroup
  private readonly _assistMarker: KonvexCircle
  private readonly _assistProjection: KonvexLine
  private readonly _assistGuide: KonvexLine
  private readonly _dragConstraint: KonvexLine
  private readonly _dcShow: boolean
  private readonly _dcRadius: number
  // Per-drag state for synchronised multi-point moves: the dragged (anchor)
  // point and the start coordinate of every point that moves with it.
  private _dragAnchorIndex = -1
  private _dragOrigins: { index: number; x: number; y: number }[] = []
  // Rubber-band box selection.
  private readonly _rubberBand: KonvexRect
  private readonly _rubberEnabled: boolean
  private readonly _rubberPreview: Ref<readonly number[]> = ref([])
  private _rubberStart: Vector2d | null = null
  private _rubberActive = false
  private readonly _onWindowUp: (e: MouseEvent) => void
  private readonly _stage: ComputedRef<Konva.Stage | null>
  /**
   * `off` for each listener {@link attachStage} put on the stage.
   *
   * Each closure holds the node it was bound to, so detaching needs no record of
   * *which* stage we attached to — which is what used to go wrong: `remove()`
   * then `destroy()` in one tick left every listener attached, because the only
   * handle on them was a namespace plus a stage looked up through `_parent`,
   * already `null` by then. These come from `bindTo`, so konvex also drops them
   * when this line is destroyed, whatever order that happens in.
   */
  private _stageOffs: (() => void)[] = []
  private readonly _altDown = ref(false)
  private readonly _optionsTick = ref(0)
  private _dragging = false
  /** Set by {@link writePoints}; consumed by the wholesale-replace watch. */
  private _selfWrite = false
  private _handles: KonvexRect[] = []
  private _options: (PointOptions | undefined)[]

  constructor(config: EditableLineConfig = {}) {
    super(config)
    this._cfg = config

    this.handlesShow = ref(config.handles?.show ?? 'whenSelected')
    this.assistShow = ref(config.assist?.show ?? 'never')
    this.projectionScope = ref(lineProjectionParts(config.assist?.scope ?? 'anywhere'))
    this.snapThreshold = ref(config.assist?.snapThreshold ?? DEFAULT_SNAP_THRESHOLD)
    this.scalableComponents = ref(config.scalableComponents ?? ['line'])
    this.defaultMovable = ref(config.movable ?? 'free')
    this.defaultSelectable = ref(config.selectable ?? true)
    this.addOnDblClick = ref(config.addOnDblClick ?? false)
    this.breakOnDblClick = ref(config.breakOnDblClick ?? false)
    this.addOnAltClick = ref(config.addOnAltClick ?? false)
    this.persistentSelection = ref(config.persistentSelection ?? false)

    const flat = (config.points ?? []).flatMap(p => [p.x, p.y])
    this.line = new KonvexLine({ ...config.line, points: flat })
    this.add(this.line)
    this._options = (config.points ?? []).map((_, i) => config.pointOptions?.[i])

    // Assist visuals live in their own non-interactive group, in line space.
    this._assistGroup = new KonvexGroup({ listening: false })
    this.add(this._assistGroup)
    this._assistProjection = new KonvexLine({
      listening: false,
      stroke: { color: '#00e5ff', width: 1, dash: [4, 4] },
    })
    this._assistGuide = new KonvexLine({ listening: false, stroke: { color: '#b0bec5', width: 1 } })
    this._assistMarker = new KonvexCircle({
      listening: false,
      radius: 5,
      fill: '#00e5ff',
      stroke: { color: '#ffffff', width: 1 },
    })
    this._assistGroup.add(this._assistProjection)
    this._assistGroup.add(this._assistGuide)
    this._assistGroup.add(this._assistMarker)

    // Axis guide for constrained drags: constant on-screen size (scalable:false
    // → geometry length; strokeScaleEnabled:false → stroke width), so `radius`
    // and `width` are read as screen pixels.
    const dc = config.dragConstraintLine
    this._dcShow = dc?.show ?? true
    this._dcRadius = dc?.radius ?? 50
    this._dragConstraint = new KonvexLine({
      listening: false,
      scalable: false,
      strokeScaleEnabled: false,
      stroke: { color: dc?.color ?? '#808080', width: dc?.width ?? 1, dash: [4, 4] },
    })
    this._assistGroup.add(this._dragConstraint)

    // Rubber-band box: lives in the (non-listening) assist group, below the
    // handles. Its geometry is in line space so the box tracks a world region;
    // only its stroke stays a constant width.
    const rb = config.rubberBand
    this._rubberEnabled = rb?.enabled ?? true
    this._rubberBand = new KonvexRect({
      listening: false,
      fill: rb?.fill ?? '#00000000',
      stroke: { color: rb?.stroke ?? '#4fc3f7', width: 1, dash: [2, 4] },
      strokeScaleEnabled: false,
    })
    this._assistGroup.add(this._rubberBand)
    this._rubberBand.visible.value = false
    this._onWindowUp = (e: MouseEvent) => {
      const wasDrag = this._rubberActive
      this.endRubberBand(e.ctrlKey)
      // Konva synthesises `click` from this mouseup on its container. A completed
      // drag-select must NOT also read as an empty-canvas click (which a host may
      // use to deselect). This listener is on `window` in the capture phase, so
      // stopping propagation here keeps the mouseup from ever reaching Konva.
      if (wasDrag) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    this.hideAssist()
    this.hideDragConstraint()
    this.applyScalable()

    // Handles sit on top so they take the pointer.
    this._handleGroup = new KonvexGroup()
    this.add(this._handleGroup)

    this.pointInfos = computed<PointInfo[]>(() => {
      void this._optionsTick.value // dependency: re-evaluate on option edits
      const f = this.line.points.value
      const sel = this.selection.value
      const rows: PointInfo[] = []
      for (let i = 0; i * 2 + 1 < f.length; i++) {
        rows.push({
          index: i,
          x: f[i * 2],
          y: f[i * 2 + 1],
          selectable: this.effectiveSelectable(i),
          movable: this.effectiveMovable(i),
          selected: sel.includes(i),
        })
      }
      return rows
    })

    this._stage = computed<Konva.Stage | null>(() => {
      void this._parent.value // dependency: re-evaluate when (re)parented
      return this.konvaRoot().getStage()
    })


    this.rebuildHandles()

    this.scope.run(() => {
      // Restyle / re-show handles whenever selection, options, activity or the
      // handle/movement settings change.
      watch(
        [this.selection, this._rubberPreview, this._optionsTick, this.active, this.handlesShow, this.defaultMovable, this.defaultSelectable],
        () => this.refreshHandles(),
        { immediate: true }
      )
      // Deselecting the line clears the assist (no mousemove fires to do it), and
      // — unless persistentSelection is set — clears the point selection too.
      watch(this.active, a => {
        if (!a) {
          this.hideAssist()
          // A band in progress belongs to the gesture that started it: leaving it
          // running kept the box on screen and let a later mouseup apply a
          // selection to a line that was no longer being edited.
          this.cancelRubberBand()
          if (!this.persistentSelection.value) this.clearSelection()
        }
      })
      // Re-apply scalable parts; markers take it at creation, so rebuild them.
      watch(this.scalableComponents, () => {
        this.applyScalable()
        this.rebuildHandles()
      })
      // Apply an assist-mode / projection change without waiting for a mouse move.
      watch([this.assistShow, this.projectionScope, this.snapThreshold], () => this.updateAssist())
      // Keep handles in sync when points are replaced wholesale (e.g. line.points
      // set). Watches the array itself, not its length: a same-count replacement
      // moves every point and so invalidates every handle just as badly.
      watch(
        () => this.line.points.value,
        () => {
          // Consume the marker first: whether or not the rest of this runs, the
          // next write starts unmarked.
          const own = this._selfWrite
          this._selfWrite = false
          // A handle drag writes points on every move; applyDragDelta has already
          // moved the handles it touched, and re-positioning mid-drag would fight
          // Konva's own drag positioning.
          if (this._dragging) return
          this.syncToPoints()
          // Only a write this class did not make gets here unreported: EL's own
          // editing methods emit their precise `point-*` event at the call site.
          if (!own) this.events.emit('points-replaced', { count: this.pointCount })
        }
      )
      // Attach/detach stage listeners as the line enters/leaves a stage.
      watch(
        this._stage,
        stage => {
          this.detachStage()
          if (stage) this.attachStage(stage)
        },
        { immediate: true }
      )
    })

    // Konva has no key events and the stage container takes no focus, so
    // modifier state comes from the window — through `bindDom`, which drops the
    // listener with this line rather than leaving it to `destroy()` to remember.
    const onKey = (e: KeyboardEvent): void => {
      this._altDown.value = e.altKey
      this.updateAssist()
    }
    this.bindDom(window, 'keydown', onKey)
    this.bindDom(window, 'keyup', onKey)

    // Dragging the whole line (the group body) also suppresses the assist. Handle
    // drags bubble up to here too and set the same two things again — harmless,
    // and the price of letting the stage see `dragstart` so it can constrain the
    // drag to the world.
    this.onDragStart(() => {
      this._dragging = true
      this.hideAssist()
    })
    // All of the drag's bookkeeping lands here rather than on the handle, even
    // though the handle is what gets dragged. Konva fires `dragend` with
    // bubbling, so this sees every handle drag — and it still sees the last one
    // when a structural edit destroys the dragged handle mid-drag: konvex stops
    // a node's scope before Konva's `destroy()` reaches the `stopDrag()` that
    // fires the event, so a handler on the handle itself is swallowed exactly
    // when it matters. That used to leave `_dragOrigins` and `_dragAnchorIndex`
    // pointing at a drag that was over, the axis guide on screen for good, and
    // no `point-moved` for the move that had just happened.
    this.onDragEnd(() => {
      this._dragging = false
      this._dragAnchorIndex = -1
      // One report per point the drag actually moved, measured from where the
      // drag started — a drag that ends where it began says nothing. Indices can
      // have shifted under us (that structural edit), so skip anything now past
      // the end rather than reading a NaN back out of the geometry.
      for (const o of this._dragOrigins) {
        if (o.index >= this.pointCount) continue
        const p = this.pointAt(o.index)
        if (p.x !== o.x || p.y !== o.y) {
          this.events.emit('point-moved', { index: o.index, point: p, from: { x: o.x, y: o.y } })
        }
      }
      this._dragOrigins = []
      this.hideDragConstraint()
    })

    this.line.onDblClick(e => {
      if (!this.breakOnDblClick.value) return
      if (!isPrimaryButton(e)) return
      // Breaking splits a body segment, so it needs `internal` in scope. Without
      // it the caller has said points go at the ends only, and projecting a
      // mid-line double-click would drop a duplicate on an endpoint — so do
      // nothing. The projection itself is always body-only: breaking at an end is
      // not a break.
      if (!this.projectionScope.value.includes('internal')) return
      e.cancelBubble = true
      const p = this.localPointer()
      if (!p) return
      const proj = this.line.project(p, LINE_PROJECTION_SCOPES.internal)
      if (proj && proj.segment >= 0) this.insertPoint(proj.segment + 1, proj.point)
    })
  }

  // --- public editing API ----------------------------------------------------

  addPoint(p: Vector2d): number {
    return this.insertPoint(this.pointCount, p)
  }

  insertPoint(index: number, p: Vector2d, options?: PointOptions): number {
    const i = Math.max(0, Math.min(index, this.pointCount))
    const f = [...this.line.points.value]
    f.splice(i * 2, 0, p.x, p.y)
    this.writePoints(f)
    this._options.splice(i, 0, options)
    this.selection.value = this.selection.value.map(s => (s >= i ? s + 1 : s))
    this.rebuildHandles()
    // Emitted last, so a handler reading the line back sees it settled.
    this.events.emit('point-added', { index: i, point: { x: p.x, y: p.y }, count: this.pointCount })
    return i
  }

  removePoint(index: number): void {
    if (index < 0 || index >= this.pointCount) return
    const gone = this.pointAt(index)
    const f = [...this.line.points.value]
    f.splice(index * 2, 2)
    this.writePoints(f)
    this._options.splice(index, 1)
    this.selection.value = this.selection.value.filter(s => s !== index).map(s => (s > index ? s - 1 : s))
    this.rebuildHandles()
    this.events.emit('point-removed', { index, point: gone, count: this.pointCount })
  }

  movePoint(index: number, p: Vector2d): void {
    if (index < 0 || index >= this.pointCount) return
    const from = this.pointAt(index)
    if (from.x === p.x && from.y === p.y) return // nothing moved, nothing to report
    this.setPointCoord(index, p.x, p.y)
    const h = this._handles[index]
    if (h) h.position.value = { x: p.x, y: p.y }
    this.events.emit('point-moved', { index, point: { x: p.x, y: p.y }, from })
  }

  select(index: number, opts: { extend?: boolean } = {}): void {
    if (index < 0 || index >= this.pointCount) return
    const cur = this.selection.value
    if (opts.extend) {
      this.selection.value = cur.includes(index) ? cur.filter(s => s !== index) : [...cur, index]
    } else {
      this.selection.value = [index]
    }
  }

  clearSelection(): void {
    if (this.selection.value.length) this.selection.value = []
  }

  /** Remove every currently selected point (high indices first). */
  removeSelected(): void {
    for (const i of [...this.selection.value].sort((a, b) => b - a)) this.removePoint(i)
  }

  /**
   * Straighten the selection: take the first and last selected points (by index)
   * as the endpoints of a line and project the intermediate selected points onto
   * it. Endpoints and pinned (`movable: false`) points stay put. No-op for < 3
   * selected.
   */
  straightenSelection(): void {
    const sel = [...this.selection.value].sort((a, b) => a - b)
    if (sel.length < 3) return
    const out = straightenPoints(sel.map(i => this.pointAt(i)))
    for (let k = 1; k < sel.length - 1; k++) {
      const idx = sel[k]
      const mv = this.effectiveMovable(idx)
      if (mv === false) continue
      // An axis lock applies here exactly as it does to a drag: a point that may
      // only travel along one axis keeps its other coordinate, rather than being
      // projected in both and sliding off its rail.
      const now = this.pointAt(idx)
      this.movePoint(idx, {
        x: mv === 'y' ? now.x : out[k].x,
        y: mv === 'x' ? now.y : out[k].y,
      })
    }
  }

  /**
   * Simplify the whole polyline in place: drop near-collinear points then merge
   * dense clusters to their centroid (see {@link simplifyPoints}). Clears the
   * selection and per-point overrides, since indices change. No-op for < 3 points.
   */
  simplify(threshold: SimplificationThreshold | undefined = this._cfg.simplification): void {
    if (this.pointCount < 3) return
    const f = this.line.points.value
    const pts: Vector2d[] = []
    for (let i = 0; i * 2 + 1 < f.length; i++) pts.push({ x: f[i * 2], y: f[i * 2 + 1] })

    // A pinned (`movable: false`) point is a boundary, not a candidate: the run
    // between two of them is simplified on its own, and since `simplifyPoints`
    // keeps a run's endpoints exactly, every pin survives where it is. Without
    // this, simplifying could delete or move the very points the caller had
    // declared immovable.
    const bounds = [0]
    for (let i = 1; i < pts.length - 1; i++) {
      if (this.effectiveMovable(i) === false) bounds.push(i)
    }
    bounds.push(pts.length - 1)

    const out: Vector2d[] = []
    // Where each pinned boundary ends up, so its overrides can follow it.
    const kept: { from: number; to: number }[] = []
    for (let b = 0; b + 1 < bounds.length; b++) {
      const run = simplifyPoints(pts.slice(bounds[b], bounds[b + 1] + 1), threshold)
      if (b === 0) {
        kept.push({ from: bounds[0], to: 0 })
        out.push(...run)
      } else {
        // This boundary is the previous run's last point, already in `out` — so
        // that is where it landed, and its repeat at the head of `run` is dropped.
        kept.push({ from: bounds[b], to: out.length - 1 })
        out.push(...run.slice(1))
      }
    }
    kept.push({ from: bounds[bounds.length - 1], to: out.length - 1 })
    if (out.length === pts.length) return // nothing collapsed

    const options = this._options
    this.writePoints(out.flatMap(p => [p.x, p.y]))
    // Indices moved, so per-point overrides cannot be carried across in general —
    // except on the boundaries, which are exactly the points that were pinned.
    this._options = out.map(() => undefined)
    for (const k of kept) this._options[k.to] = options[k.from]
    this.clearSelection()
    this.rebuildHandles()
    // A reshape of the whole polyline: which points survived is not expressible
    // as a sequence of removals, so report it as the replacement it is.
    this.events.emit('points-replaced', { count: this.pointCount })
  }

  setPointOptions(index: number, options: PointOptions | undefined): void {
    if (index < 0 || index >= this.pointCount) return
    // Merge so a caller can flip one field; pass `undefined` to clear all overrides.
    this._options[index] = options === undefined ? undefined : { ...this._options[index], ...options }
    this._optionsTick.value++
  }

  get pointCount(): number {
    return Math.floor(this.line.points.value.length / 2)
  }

  override destroy(): void {
    // The key listeners and the stage listeners go with the scope (bindDom /
    // bindTo). This one is added per rubber-band drag, so it can still be live.
    window.removeEventListener('mouseup', this._onWindowUp, true)
    this.detachStage()
    this.events.clear()
    super.destroy()
  }

  // --- internals -------------------------------------------------------------

  private isScalable(component: ScalableComponent): boolean {
    const sc = this.scalableComponents.value
    if (sc === 'all') return true
    if (sc === 'none') return false
    return sc.includes(component)
  }

  /** Push `scalableComponents` onto the parts: stroke scaling for lines, node size for markers. */
  private applyScalable(): void {
    this.line.strokeScaleEnabled.value = this.isScalable('line')
    const helper = this.isScalable('helper')
    this._assistMarker.scalable.value = helper
    this._assistProjection.strokeScaleEnabled.value = helper
    this._assistGuide.strokeScaleEnabled.value = helper
  }

  private effectiveMovable(i: number): PointMovement {
    return this._options[i]?.movable ?? this.defaultMovable.value
  }

  private effectiveSelectable(i: number): boolean {
    return this._options[i]?.selectable ?? this.defaultSelectable.value
  }

  private pointAt(i: number): Vector2d {
    const f = this.line.points.value
    return { x: f[i * 2], y: f[i * 2 + 1] }
  }

  /**
   * The one place EL writes geometry.
   *
   * Marks the write as its own so the wholesale-replace watch can tell an edit
   * that came through this class (which emits its own precise `point-*` event)
   * from one a host made by assigning `line.points` (which can only be reported
   * as `points-replaced`).
   */
  private writePoints(flat: number[]): void {
    this._selfWrite = true
    this.line.points.value = flat
  }

  private setPointCoord(i: number, x: number, y: number): void {
    const f = [...this.line.points.value]
    f[i * 2] = x
    f[i * 2 + 1] = y
    this.writePoints(f)
  }

  /**
   * Re-align everything indexed by point number after `points` was replaced
   * wholesale (`line.points.value = [...]`), which no other code path knows about.
   *
   * Handle positions are written at creation only — {@link refreshHandles} restyles
   * but never moves — so without this a same-count replacement leaves every handle
   * at its old coordinate. That is not merely cosmetic: a handle drag derives its
   * delta from the handle's own position, so the first drag afterwards jumps the
   * line by however far the handle was stale.
   */
  private syncToPoints(): void {
    const n = this.pointCount
    // Per-point overrides are index-based; drop rows past the end, pad new ones.
    while (this._options.length > n) this._options.pop()
    while (this._options.length < n) this._options.push(undefined)
    // Selection likewise: an out-of-range index survives into pointAt() as NaN.
    const sel = this.selection.value.filter(i => i < n)
    if (sel.length !== this.selection.value.length) this.selection.value = sel
    // A changed count needs new handles, which are created at the right spot.
    if (n !== this._handles.length) return this.rebuildHandles()
    for (let i = 0; i < n; i++) this._handles[i].position.value = this.pointAt(i)
  }

  private rebuildHandles(): void {
    for (const h of this._handles) h.destroy()
    this._handles = []
    for (let i = 0; i < this.pointCount; i++) this._handles.push(this.createHandle())
    this.refreshHandles()
  }

  private createHandle(): KonvexRect {
    // A square whose centre — via the half-size offset — sits on the point, so the
    // constant-size (scalable:false) scaling pivots about the point.
    const half = this._cfg.handles?.radius ?? (this._cfg.handles?.size ?? 10) / 2
    const h = new KonvexRect({
      scalable: this.isScalable('marker'),
      draggable: true,
      width: half * 2,
      height: half * 2,
      offsetX: half,
      offsetY: half,
    })
    this._handleGroup.add(h)
    const { x, y } = this.pointAt(this._handles.length)
    h.position.value = { x, y }

    h.onClick(e => {
      e.cancelBubble = true
      // Selection is a left-click gesture; right-click selection is handled by
      // the contextmenu/toolbar path.
      if (!isPrimaryButton(e)) return
      const idx = this._handles.indexOf(h)
      if (idx >= 0 && this.effectiveSelectable(idx)) {
        this.select(idx, { extend: (e.evt as MouseEvent).ctrlKey })
      }
    })
    h.onDragStart(e => {
      // Deliberately NOT cancelBubble: the stage constrains a drag by installing
      // a `dragBoundFunc` when it sees `dragstart`, and swallowing the event here
      // left handle drags unconstrained in `bounded` / `clipped` worlds. The
      // group-level dragstart below does the same two things this does, so
      // letting it through costs nothing.
      this._dragging = true
      this.hideAssist()
      const idx = this._handles.indexOf(h)
      if (idx < 0) return
      // Select before dragging: keep an existing (multi-)selection if this point is
      // part of it, otherwise select it — single, or Ctrl to add to the selection.
      if (this.effectiveSelectable(idx) && !this.selection.value.includes(idx)) {
        this.select(idx, { extend: (e.evt as MouseEvent).ctrlKey })
      }
      // The whole selection moves with the anchor; an unselected point moves alone.
      this._dragAnchorIndex = idx
      const moving = this.selection.value.includes(idx) ? this.selection.value : [idx]
      this._dragOrigins = moving.map(i => {
        const p = this.pointAt(i)
        return { index: i, x: p.x, y: p.y }
      })
    })
    h.onDragMove(e => {
      const idx = this._handles.indexOf(h)
      if (idx < 0 || idx !== this._dragAnchorIndex) return
      const anchor = this._dragOrigins.find(o => o.index === idx)
      if (!anchor) return
      // Raw delta the anchor was dragged by, then the axis constraint from the
      // anchor's movement mode (Ctrl locks a free point to its dominant axis).
      let dx = h.x.value - anchor.x
      let dy = h.y.value - anchor.y
      const mv = this.effectiveMovable(idx)
      const ctrl = (e.evt as MouseEvent).ctrlKey
      let axis: 'x' | 'y' | null = null
      if (mv === 'x') {
        dy = 0
        axis = 'x'
      } else if (mv === 'y') {
        dx = 0
        axis = 'y'
      } else if (ctrl) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0
          axis = 'x'
        } else {
          dx = 0
          axis = 'y'
        }
      }
      this.applyDragDelta(dx, dy)
      this.updateDragConstraint(axis, anchor.x + dx, anchor.y + dy)
    })
    return h
  }

  /**
   * Shift every point in {@link _dragOrigins} by (dx, dy) from its start, each
   * clamped to its own axis constraint (`false` points stay put), updating the
   * geometry once and the matching handle positions.
   */
  private applyDragDelta(dx: number, dy: number): void {
    const f = [...this.line.points.value]
    for (const o of this._dragOrigins) {
      const mv = this.effectiveMovable(o.index)
      if (mv === false) continue
      const nx = o.x + (mv === 'y' ? 0 : dx)
      const ny = o.y + (mv === 'x' ? 0 : dy)
      f[o.index * 2] = nx
      f[o.index * 2 + 1] = ny
      const hh = this._handles[o.index]
      if (hh) hh.position.value = { x: nx, y: ny }
    }
    this.writePoints(f)
    // No event per frame: `point-moved` reports the landed move, from dragEnd.
  }

  /** Draw (or hide) the axis guide through the dragged point at (x, y). */
  private updateDragConstraint(axis: 'x' | 'y' | null, x: number, y: number): void {
    if (!this._dcShow || !axis) return this.hideDragConstraint()
    const r = this._dcRadius
    this._dragConstraint.position.value = { x, y }
    this._dragConstraint.points.value = axis === 'x' ? [-r, 0, r, 0] : [0, -r, 0, r]
    this._dragConstraint.visible.value = true
  }

  private hideDragConstraint(): void {
    this._dragConstraint.visible.value = false
  }

  private refreshHandles(): void {
    const show = this.handlesShow.value
    const visible = show === 'always' || (show === 'whenSelected' && this.active.value)
    const styler = this._cfg.handles?.style ?? defaultHandleStyle
    this._handles.forEach((h, i) => {
      h.visible.value = visible
      const movable = this.effectiveMovable(i)
      h.draggable.value = movable !== false
      const s = styler({
        index: i,
        selected: this.selection.value.includes(i),
        selectable: this.effectiveSelectable(i),
        movable,
        previewSelected: this._rubberPreview.value.includes(i),
      })
      h.fill.value = s.fill
      h.strokeColor.value = s.stroke
      h.strokeWidth.value = s.strokeWidth ?? 1
      h.opacity.value = s.opacity ?? 1
    })
  }

  // --- assist ----------------------------------------------------------------

  private localPointer(): Vector2d | null {
    return this.relativePointerPosition()
  }

  /** Drop every listener this line put on the stage. Idempotent. */
  private detachStage(): void {
    for (const off of this._stageOffs) off()
    this._stageOffs = []
  }

  private attachStage(stage: Konva.Stage): void {
    this._stageOffs.push(this.bindTo(stage, 'mousemove', e => {
      // Resync from the live event: a key-up for Alt can be swallowed by the OS
      // (e.g. Alt focuses the menu bar), which would otherwise stick the assist on.
      this._altDown.value = e.evt.altKey
      this.updateAssist()
    }))
    this._stageOffs.push(this.bindTo(stage, 'mouseleave', () => this.hideAssist()))
    this._stageOffs.push(this.bindTo(stage, 'click', e => {
      if (!this.addOnAltClick.value || !this.active.value) return
      if (!isPrimaryButton(e)) return
      if (!e.evt.altKey) return
      // only on this line or empty canvas — never on a handle or another shape
      if (e.target !== stage && e.target !== this.line.konvaRoot()) return
      const p = this.localPointer()
      if (!p) return
      const proj = this.line.project(p, this.projectionScope.value)
      if (!proj) {
        this.addPoint(p)
        return
      }
      const { index, point } = this.resolveInsertion(p, proj)
      this.insertPoint(index, point)
    }))
    this._stageOffs.push(this.bindTo(stage, 'dblclick', e => {
      if (!this.addOnDblClick.value || !this.active.value) return
      if (!isPrimaryButton(e)) return
      if (e.target !== stage) return // only on empty canvas, not on a shape/handle
      const p = this.localPointer()
      if (!p) return
      // Same resolution as the Alt+click commit and the assist preview — this
      // path used to reimplement it and fell through to a blind append whenever
      // the cursor was beyond the snap threshold, ignoring the scope entirely.
      const proj = this.line.project(p, this.projectionScope.value)
      if (!proj) return void this.addPoint(p)
      const { index, point } = this.resolveInsertion(p, proj)
      this.insertPoint(index, point)
    }))
    // Right-click on a handle or on the line asks for the toolbar. An already-
    // selected handle keeps the current (multi-)selection so the toolbar acts on
    // all of it; an unselected, selectable handle is selected first — respecting
    // Ctrl, exactly like a left-click — for a quick right-click-to-act gesture.
    this._stageOffs.push(this.bindTo(stage, 'contextmenu', e => {
      if (!this.active.value) return
      const hit = e.konvexTarget
      const handleIdx = this._handles.findIndex(h => h === hit)
      const onLine = hit === this.line
      if (handleIdx < 0 && !onLine) return
      const me = e.evt
      me.preventDefault()
      e.cancelBubble = true
      if (handleIdx >= 0 && this.effectiveSelectable(handleIdx) && !this.selection.value.includes(handleIdx)) {
        this.select(handleIdx, { extend: me.ctrlKey })
      }
      this.events.emit('toolbar-request', {
        pointerScreen: { x: me.clientX, y: me.clientY },
        pointerWorld: this.localPointer(),
        selection: this.selection.value,
      })
    }))
    // Rubber-band: left-drag on empty canvas. Started here; grown on mousemove;
    // committed on a window mouseup (so a release outside the stage still lands).
    this._stageOffs.push(this.bindTo(stage, 'mousedown', e => {
      if (!this._rubberEnabled || !this.active.value) return
      const me = e.evt
      if (me.button !== 0 || me.altKey) return
      if (e.target !== stage) return // empty canvas only, never a shape/handle
      const p = this.localPointer()
      if (!p) return
      this._rubberStart = p
      this._rubberActive = false
      window.addEventListener('mouseup', this._onWindowUp, true)
    }))
    this._stageOffs.push(this.bindTo(stage, 'mousemove', () => {
      if (!this._rubberStart) return
      const p = this.localPointer()
      if (!p) return
      if (!this._rubberActive) {
        // Ignore sub-threshold jitter so a plain click never starts a band.
        if (Math.abs(p.x - this._rubberStart.x) <= 3 && Math.abs(p.y - this._rubberStart.y) <= 3) {
          return
        }
        this._rubberActive = true
        this.hideAssist()
      }
      this.updateRubberBand(this._rubberStart, p)
    }))
  }

  /** Grow the box to span (a, b) and preview the enclosed selectable points. */
  private updateRubberBand(a: Vector2d, b: Vector2d): void {
    const minX = Math.min(a.x, b.x)
    const minY = Math.min(a.y, b.y)
    const w = Math.abs(a.x - b.x)
    const h = Math.abs(a.y - b.y)
    this._rubberBand.position.value = { x: minX, y: minY }
    this._rubberBand.width.value = w
    this._rubberBand.height.value = h
    this._rubberBand.visible.value = true
    const inside: number[] = []
    for (let i = 0; i < this.pointCount; i++) {
      if (!this.effectiveSelectable(i)) continue
      const p = this.pointAt(i)
      if (p.x >= minX && p.x <= minX + w && p.y >= minY && p.y <= minY + h) inside.push(i)
    }
    this._rubberPreview.value = inside
  }

  /**
   * Finish a rubber-band gesture: hide the box and, if it was a real drag, apply
   * the enclosed set — Ctrl unions it with the current selection, otherwise it
   * replaces it. A sub-threshold click leaves the selection untouched.
   */
  /**
   * Drop the band without applying it — for when the gesture stops mattering
   * rather than finishing, e.g. the line being deactivated mid-drag. Also takes
   * the window listener back off: left attached, it fired on the next mouseup
   * anywhere and rewrote the selection of a line the user had already left.
   */
  private cancelRubberBand(): void {
    window.removeEventListener('mouseup', this._onWindowUp, true)
    this._rubberStart = null
    this._rubberActive = false
    this._rubberBand.visible.value = false
    this._rubberPreview.value = []
  }

  private endRubberBand(extend: boolean): void {
    const active = this._rubberActive
    const enclosed = this._rubberPreview.value
    this.cancelRubberBand()
    if (!active) return
    if (extend) {
      const set = new Set(this.selection.value)
      for (const i of enclosed) set.add(i)
      this.selection.value = [...set].sort((a, b) => a - b)
    } else {
      this.selection.value = [...enclosed]
    }
  }

  private updateAssist(): void {
    const mode = this.assistShow.value
    const want = this.active.value && !this._dragging && !this._rubberActive && (mode === 'always' || (mode === 'onAlt' && this._altDown.value))
    if (!want) return this.hideAssist()
    const cursor = this.localPointer()
    if (!cursor) return this.hideAssist()
    const proj = this.line.project(cursor, this.projectionScope.value)
    if (!proj) return this.hideAssist()
    this.showAssist(cursor, proj)
  }

  /**
   * Where a point committed at `cursor`/`proj` would land — the single decision
   * behind every add gesture *and* the assist preview, so the two cannot disagree.
   *
   * Read straight off `proj.segment`, which is safe now that the scope is a set
   * of allowed parts: `project` returns an out-of-range segment only when that
   * end is actually in scope. (It once promoted body projections to extensions
   * regardless, which is why this briefly had to switch on the scope instead —
   * a workaround for a projection that could not be trusted.)
   */
  private resolveInsertion(
    cursor: Vector2d,
    proj: LineProjection,
  ): { index: number; point: Vector2d; terminal: boolean } {
    if (proj.segment < 0) return { index: 0, point: cursor, terminal: true }
    if (proj.segment >= this.pointCount - 1) {
      return { index: this.pointCount, point: cursor, terminal: true }
    }
    // A body insert splits `proj.segment`, snapping onto the line when close.
    const snap = proj.distance <= this.snapThreshold.value
    return { index: proj.segment + 1, point: snap ? proj.point : cursor, terminal: false }
  }

  private showAssist(cursor: Vector2d, proj: LineProjection): void {
    const target = this.resolveInsertion(cursor, proj)
    this._assistMarker.position.value = { x: target.point.x, y: target.point.y }
    this._assistProjection.points.value = [cursor.x, cursor.y, proj.point.x, proj.point.y]

    // The guide previews the segment(s) the new point would create — read off the
    // same decision as the commit, so the preview always depicts what will happen.
    if (target.terminal) {
      // One new leg, from the endpoint being extended out to the cursor.
      this._assistGuide.points.value = [cursor.x, cursor.y, proj.point.x, proj.point.y]
    } else {
      const wp = this.line.worldPoints()
      const a = wp[proj.segment]
      const b = wp[proj.segment + 1]
      this._assistGuide.points.value = [a.x, a.y, target.point.x, target.point.y, b.x, b.y]
    }

    this._assistMarker.visible.value = true
    this._assistProjection.visible.value = true
    this._assistGuide.visible.value = true
  }

  private hideAssist(): void {
    this._assistMarker.visible.value = false
    this._assistProjection.visible.value = false
    this._assistGuide.visible.value = false
  }
}

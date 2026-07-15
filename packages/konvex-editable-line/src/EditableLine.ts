import { computed, type ComputedRef, ref, type Ref, watch } from 'vue'
import type Konva from 'konva'
import { KonvexGroup } from '@balage1551/konvex'
import { KonvexLine, type LineProjection } from '@balage1551/konvex'
import { type SimplificationThreshold, simplifyPoints, straightenPoints } from '@balage1551/konvex'
import { KonvexCircle } from '@balage1551/konvex'
import { KonvexRect } from '@balage1551/konvex'
import type { Vector2d } from '@balage1551/konvex'
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

let elSeq = 0

/** Default assist snap distance (world units) when `assist.snapThreshold` is unset. */
const DEFAULT_SNAP_THRESHOLD = 10

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
  readonly scalableComponents: Ref<ScalableComponents>
  readonly defaultMovable: Ref<PointMovement>
  readonly defaultSelectable: Ref<boolean>
  /** One row per point: index, coordinate, effective options and selection. */
  readonly pointInfos: ComputedRef<PointInfo[]>

  private readonly _cfg: EditableLineConfig
  private readonly _ns: string
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
  private readonly _altDown = ref(false)
  private readonly _optionsTick = ref(0)
  private _dragging = false
  private _handles: KonvexRect[] = []
  private _options: (PointOptions | undefined)[]
  private readonly _onKey: (e: KeyboardEvent) => void

  constructor(config: EditableLineConfig = {}) {
    super(config)
    this._cfg = config
    this._ns = `.editableline${++elSeq}`

    this.handlesShow = ref(config.handles?.show ?? 'whenSelected')
    this.assistShow = ref(config.assist?.show ?? 'never')
    this.scalableComponents = ref(config.scalableComponents ?? ['line'])
    this.defaultMovable = ref(config.movable ?? 'free')
    this.defaultSelectable = ref(config.selectable ?? true)

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

    this._onKey = (e: KeyboardEvent) => {
      this._altDown.value = e.altKey
      this.updateAssist()
    }

    this.rebuildHandles()

    this.scope.run(() => {
      // Restyle / re-show handles whenever selection, options, activity or the
      // handle/movement settings change.
      watch(
        [this.selection, this._rubberPreview, this._optionsTick, this.active, this.handlesShow, this.defaultMovable, this.defaultSelectable],
        () => this.refreshHandles(),
        { immediate: true }
      )
      // Deselecting the line clears the assist (no mousemove fires to do it).
      watch(this.active, a => {
        if (!a) this.hideAssist()
      })
      // Re-apply scalable parts; markers take it at creation, so rebuild them.
      watch(this.scalableComponents, () => {
        this.applyScalable()
        this.rebuildHandles()
      })
      // Apply an assist-mode change without waiting for the next mouse move.
      watch(this.assistShow, () => this.updateAssist())
      // Keep handles in sync when points are replaced wholesale (e.g. line.points set).
      watch(
        () => this.line.points.value.length,
        len => {
          if (len / 2 !== this._handles.length) this.rebuildHandles()
        }
      )
      // Attach/detach stage listeners as the line enters/leaves a stage.
      watch(
        this._stage,
        (stage, old) => {
          if (old) old.off(this._ns)
          if (stage) this.attachStage(stage)
        },
        { immediate: true }
      )
    })

    window.addEventListener('keydown', this._onKey)
    window.addEventListener('keyup', this._onKey)

    // Dragging the whole line (the group body) also suppresses the assist.
    // Handle drags cancel-bubble, so these fire only for body drags.
    this.onDragStart(() => {
      this._dragging = true
      this.hideAssist()
    })
    this.onDragEnd(() => {
      this._dragging = false
    })

    this.line.onDblClick(e => {
      if (!this._cfg.breakOnDblClick) return
      e.cancelBubble = true
      const p = this.localPointer()
      if (!p) return
      const proj = this.line.project(p, this._cfg.assist?.scope ?? 'internal')
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
    this.line.points.value = f
    this._options.splice(i, 0, options)
    this.selection.value = this.selection.value.map(s => (s >= i ? s + 1 : s))
    this.rebuildHandles()
    return i
  }

  removePoint(index: number): void {
    if (index < 0 || index >= this.pointCount) return
    const f = [...this.line.points.value]
    f.splice(index * 2, 2)
    this.line.points.value = f
    this._options.splice(index, 1)
    this.selection.value = this.selection.value.filter(s => s !== index).map(s => (s > index ? s - 1 : s))
    this.rebuildHandles()
  }

  movePoint(index: number, p: Vector2d): void {
    if (index < 0 || index >= this.pointCount) return
    this.setPointCoord(index, p.x, p.y)
    const h = this._handles[index]
    if (h) h.position.value = { x: p.x, y: p.y }
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
      if (this.effectiveMovable(idx) !== false) this.movePoint(idx, out[k])
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
    const out = simplifyPoints(pts, threshold)
    if (out.length === pts.length) return // nothing collapsed
    this.line.points.value = out.flatMap(p => [p.x, p.y])
    this._options = out.map(() => undefined)
    this.clearSelection()
    this.rebuildHandles()
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
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('keyup', this._onKey)
    window.removeEventListener('mouseup', this._onWindowUp, true)
    this._stage.value?.off(this._ns)
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

  private setPointCoord(i: number, x: number, y: number): void {
    const f = [...this.line.points.value]
    f[i * 2] = x
    f[i * 2 + 1] = y
    this.line.points.value = f
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
      // Konva fires `click` for any button; selection is a left-click gesture.
      // Right-click selection is handled by the contextmenu/toolbar path.
      if ((e.evt as MouseEvent).button !== 0) return
      const idx = this._handles.indexOf(h)
      if (idx >= 0 && this.effectiveSelectable(idx)) {
        this.select(idx, { extend: (e.evt as MouseEvent).ctrlKey })
      }
    })
    h.onDragStart(e => {
      e.cancelBubble = true
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
    h.onDragEnd(() => {
      this._dragging = false
      this._dragAnchorIndex = -1
      this._dragOrigins = []
      this.hideDragConstraint()
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
    this.line.points.value = f
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
    const p = this.konvaRoot().getRelativePointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }

  private attachStage(stage: Konva.Stage): void {
    stage.on('mousemove' + this._ns, e => {
      // Resync from the live event: a key-up for Alt can be swallowed by the OS
      // (e.g. Alt focuses the menu bar), which would otherwise stick the assist on.
      this._altDown.value = (e.evt as MouseEvent).altKey
      this.updateAssist()
    })
    stage.on('mouseleave' + this._ns, () => this.hideAssist())
    stage.on('click' + this._ns, e => {
      if (!this._cfg.addOnAltClick || !this.active.value) return
      if (!(e.evt as MouseEvent).altKey) return
      // only on this line or empty canvas — never on a handle or another shape
      if (e.target !== stage && e.target !== this.line.konvaRoot()) return
      const p = this.localPointer()
      if (!p) return
      const proj = this.line.project(p, this._cfg.assist?.scope ?? 'internal')
      if (!proj) {
        this.addPoint(p)
        return
      }
      const { index, point } = this.resolveInsertion(p, proj)
      this.insertPoint(index, point)
    })
    stage.on('dblclick' + this._ns, e => {
      if (!this._cfg.addOnDblClick || !this.active.value) return
      if (e.target !== stage) return // only on empty canvas, not on a shape/handle
      const p = this.localPointer()
      if (!p) return
      const scope = this._cfg.assist?.scope ?? 'internal'
      const proj = this.line.project(p, scope)
      const threshold = this._cfg.assist?.snapThreshold ?? DEFAULT_SNAP_THRESHOLD
      if (proj && proj.segment >= 0 && proj.distance <= threshold) {
        this.insertPoint(proj.segment + 1, proj.point)
      } else if (proj && proj.segment < 0) {
        this.insertPoint(0, p) // before the first point
      } else {
        this.addPoint(p) // append (extension or no projection)
      }
    })
    // Right-click on a handle or on the line asks for the toolbar. An already-
    // selected handle keeps the current (multi-)selection so the toolbar acts on
    // all of it; an unselected, selectable handle is selected first — respecting
    // Ctrl, exactly like a left-click — for a quick right-click-to-act gesture.
    stage.on('contextmenu' + this._ns, e => {
      if (!this.active.value) return
      const handleIdx = this._handles.findIndex(h => h.konvaRoot() === e.target)
      const onLine = e.target === this.line.konvaRoot()
      if (handleIdx < 0 && !onLine) return
      const me = e.evt as MouseEvent
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
    })
    // Rubber-band: left-drag on empty canvas. Started here; grown on mousemove;
    // committed on a window mouseup (so a release outside the stage still lands).
    stage.on('mousedown' + this._ns, e => {
      if (!this._rubberEnabled || !this.active.value) return
      const me = e.evt as MouseEvent
      if (me.button !== 0 || me.altKey) return
      if (e.target !== stage) return // empty canvas only, never a shape/handle
      const p = this.localPointer()
      if (!p) return
      this._rubberStart = p
      this._rubberActive = false
      window.addEventListener('mouseup', this._onWindowUp, true)
    })
    stage.on('mousemove' + this._ns, () => {
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
    })
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
  private endRubberBand(extend: boolean): void {
    window.removeEventListener('mouseup', this._onWindowUp, true)
    const active = this._rubberActive
    const enclosed = this._rubberPreview.value
    this._rubberStart = null
    this._rubberActive = false
    this._rubberBand.visible.value = false
    this._rubberPreview.value = []
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
    const proj = this.line.project(cursor, this._cfg.assist?.scope ?? 'internal')
    if (!proj) return this.hideAssist()
    this.showAssist(cursor, proj)
  }

  /**
   * Where a point committed at `cursor`/`proj` would land: prepend / append at
   * the cursor for a terminal extension, or split the body segment (snapping to
   * the projection within `snapThreshold`). Shared by the assist marker and the
   * Alt+click commit so the preview and the result always agree.
   */
  private resolveInsertion(cursor: Vector2d, proj: LineProjection): { index: number; point: Vector2d } {
    const segCount = this.pointCount - 1
    if (proj.segment < 0) return { index: 0, point: cursor } // prepend
    if (proj.segment >= segCount) return { index: this.pointCount, point: cursor } // append
    const snap = proj.distance <= (this._cfg.assist?.snapThreshold ?? DEFAULT_SNAP_THRESHOLD)
    return { index: proj.segment + 1, point: snap ? proj.point : cursor }
  }

  private showAssist(cursor: Vector2d, proj: LineProjection): void {
    const target = this.resolveInsertion(cursor, proj).point
    this._assistMarker.position.value = { x: target.x, y: target.y }
    this._assistProjection.points.value = [cursor.x, cursor.y, proj.point.x, proj.point.y]

    const wp = this.line.worldPoints()
    const last = wp.length - 1
    if (proj.segment < 0 || proj.segment >= last) {
      // terminal extension: a single leg toward the endpoint (the new segment)
      this._assistGuide.points.value = [cursor.x, cursor.y, proj.point.x, proj.point.y]
    } else {
      const a = wp[proj.segment]
      const b = wp[proj.segment + 1]
      this._assistGuide.points.value = [a.x, a.y, cursor.x, cursor.y, b.x, b.y]
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

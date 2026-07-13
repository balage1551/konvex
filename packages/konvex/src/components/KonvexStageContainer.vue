<template>
  <div ref="rootEl" class="kx-root">
    <div ref="scrollEl" class="kx-scroll" @scroll="onScroll">
      <div ref="spacerEl" class="kx-spacer" />
    </div>
    <div ref="viewportEl" class="kx-viewport" :style="{ background: props.background }" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type Konva from 'konva'
import { KonvexStage } from '../KonvexStage'
import { KonvexLayer } from '../KonvexLayer'
import { KonvexRect } from '../KonvexRect'
import { KonvexShape } from '../KonvexShape'
import { KonvexContainer } from '../KonvexContainer'
import type { KonvexBase } from '../KonvexBase'
import type { Vector2d } from '../KonvexTypes'
import {
  DEFAULT_ZOOM_LEVELS,
  type ContentSize,
  type WorldMode,
  type ZoomMode,
  type ZoomStepType,
} from '../components/KonvexStage-types'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    worldMode?: WorldMode
    contentSize?: ContentSize | 'auto'
    /** Measurement scale: real-world units per world unit. Sets each shape's `unitScale`. */
    scale?: number
    zoomLevel?: number
    zoomMode?: ZoomMode
    zoomLevels?: number[]
    zoomStep?: number
    zoomStepType?: ZoomStepType
    zoomBase?: number
    minZoom?: number | 'fit'
    maxZoom?: number
    zoomOnWheel?: boolean
    background?: string
    /** Draw a 1px boundary frame around the content extent, in this colour. */
    frame?: string
  }>(),
  {
    worldMode: 'elastic',
    contentSize: () => ({ width: 1000, height: 1000 }),
    scale: 1,
    zoomLevel: undefined,
    zoomMode: 'proportional',
    zoomLevels: () => DEFAULT_ZOOM_LEVELS,
    zoomStep: undefined,
    zoomStepType: 'multiplicative',
    zoomBase: 1,
    minZoom: 'fit',
    maxZoom: 8,
    zoomOnWheel: true,
    background: 'transparent',
    frame: undefined,
  },
)

const emit = defineEmits<{
  'update:zoomLevel': [number]
  ready: [KonvexStage]
  zoom: [number]
  scroll: [Vector2d]
}>()

const rootEl = shallowRef<HTMLDivElement>()
const scrollEl = shallowRef<HTMLDivElement>()
const spacerEl = shallowRef<HTMLDivElement>()
const viewportEl = shallowRef<HTMLDivElement>()

const stage = shallowRef<KonvexStage>()
const world = shallowRef<KonvexLayer>()
const overlay = shallowRef<KonvexLayer>()
const frameRect = shallowRef<KonvexRect>()

let zoom = props.zoomLevel ?? 1
// Cached world rect (origin + size, in world units). Recomputed only on content/
// mode/size changes — never on the scroll hot path.
let rect: Rect = { x: 0, y: 0, width: 1, height: 1 }

// --- world rect (origin + size) per worldMode -----------------------------
function viewport(): Vector2d {
  const el = scrollEl.value
  return { x: el?.clientWidth ?? 0, y: el?.clientHeight ?? 0 }
}
function specSize(): Vector2d {
  if (props.contentSize === 'auto') return { x: 0, y: 0 }
  return { x: props.contentSize.width, y: props.contentSize.height }
}
function contentBBox(): Rect {
  const n = world.value?.detach()
  if (!n || n.getChildren().length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  return n.getClientRect({ relativeTo: n, skipShadow: true })
}
function computeWorldRect(): Rect {
  const s = specSize()
  if (props.worldMode === 'free' || props.worldMode === 'elastic') {
    const b = contentBBox()
    if (!b.width || !b.height) {
      return { x: 0, y: 0, width: Math.max(1, s.x), height: Math.max(1, s.y) }
    }
    if (props.worldMode === 'free') return b
    // elastic: union of the bbox and (0,0,contentSize)
    const x = Math.min(0, b.x)
    const y = Math.min(0, b.y)
    return {
      x,
      y,
      width: Math.max(s.x, b.x + b.width) - x,
      height: Math.max(s.y, b.y + b.height) - y,
    }
  }
  // clipped / bounded → the fixed specified rect at the origin
  return { x: 0, y: 0, width: Math.max(1, s.x), height: Math.max(1, s.y) }
}
function recompute(): void {
  rect = computeWorldRect()
}
function fitZoom(): number {
  const vp = viewport()
  if (!rect.width || !rect.height || !vp.x || !vp.y) return 1
  return Math.min(vp.x / rect.width, vp.y / rect.height)
}
function effMin(): number {
  return props.minZoom === 'fit' ? fitZoom() : props.minZoom
}
function clampZoom(z: number): number {
  return Math.min(props.maxZoom, Math.max(effMin(), z))
}

// --- zoom grid / snapping -------------------------------------------------
function sortedLevels(): number[] {
  return [...props.zoomLevels].sort((a, b) => a - b)
}
function snapZoom(z: number): number {
  if (props.zoomMode === 'steps') {
    let best = z
    let bd = Infinity
    for (const l of sortedLevels()) {
      const d = Math.abs(l - z)
      if (d < bd) {
        bd = d
        best = l
      }
    }
    return clampZoom(best)
  }
  const base = props.zoomBase
  if (props.zoomStepType === 'additive') {
    const step = props.zoomStep ?? 0.25
    return clampZoom(base + Math.round((z - base) / step) * step)
  }
  const step = props.zoomStep ?? 1.25
  if (z <= 0) return clampZoom(base)
  const k = Math.round(Math.log(z / base) / Math.log(step))
  return clampZoom(base * Math.pow(step, k))
}
function steppedZoom(dir: 1 | -1): number {
  if (props.zoomMode === 'steps') {
    const levels = sortedLevels()
    if (dir > 0) return clampZoom(levels.find(l => l > zoom + 1e-6) ?? zoom)
    return clampZoom([...levels].reverse().find(l => l < zoom - 1e-6) ?? zoom)
  }
  const snapped = snapZoom(zoom)
  if (props.zoomStepType === 'additive') {
    const step = props.zoomStep ?? 0.25
    return clampZoom(snapped + dir * step)
  }
  const step = props.zoomStep ?? 1.25
  return clampZoom(dir > 0 ? snapped * step : snapped / step)
}

// --- applying the viewport transform --------------------------------------
/** Position the boundary frame over the world rect in screen space. */
function updateFrame(): void {
  const f = frameRect.value
  const el = scrollEl.value
  if (!f || !el) return
  if (!props.frame) {
    f.visible.value = false
    return
  }
  // Frame screen pos = worldToScreen(origin) = (-scroll); origin cancels.
  f.visible.value = true
  f.strokeColor.value = props.frame
  f.position.value = { x: -el.scrollLeft, y: -el.scrollTop }
  f.size.value = { x: rect.width * zoom, y: rect.height * zoom }
}
/** Clip the content layer to the specified rect in `clipped` mode (else off). */
function applyClip(): void {
  const n = world.value?.detach()
  if (!n) return
  if (props.worldMode === 'clipped') {
    const s = specSize()
    n.clipX(0)
    n.clipY(0)
    n.clipWidth(s.x)
    n.clipHeight(s.y)
  } else {
    // Konva treats ANY numeric clipWidth/Height as an active clip (even 0), so
    // to turn clipping off the dimensions must be reset to undefined.
    n.clipWidth(undefined as unknown as number)
    n.clipHeight(undefined as unknown as number)
  }
}
/**
 * Apply the full viewport transform from the cached `rect`, current `zoom` and
 * scroll: spacer (scroll extent), content scale, content position (origin folded
 * in), clip and frame. Cheap — no content measuring — so safe on the scroll path.
 */
function applyTransform(): void {
  const el = scrollEl.value
  const w = world.value
  if (!el || !w) return
  if (spacerEl.value) {
    spacerEl.value.style.width = `${rect.width * zoom}px`
    spacerEl.value.style.height = `${rect.height * zoom}px`
  }
  w.scale.value = { x: zoom, y: zoom }
  // origin lives entirely here — objects keep their real coordinates.
  w.position.value = { x: -(rect.x * zoom + el.scrollLeft), y: -(rect.y * zoom + el.scrollTop) }
  applyClip()
  updateFrame()
}
function onScroll(): void {
  const el = scrollEl.value
  if (!el) return
  applyTransform()
  emit('scroll', { x: el.scrollLeft, y: el.scrollTop })
}

// --- bounded-mode drag clamp + free/elastic auto-resize -------------------
/** Clamp a node's bbox fully inside `rect` (top-left wins if it's too big). */
function clampNode(node: Konva.Node): void {
  const wn = world.value?.detach()
  if (!wn) return
  const r = node.getClientRect({ relativeTo: wn, skipShadow: true })
  let dx = 0
  let dy = 0
  if (r.x + r.width > rect.x + rect.width) dx = rect.x + rect.width - (r.x + r.width)
  if (r.y + r.height > rect.y + rect.height) dy = rect.y + rect.height - (r.y + r.height)
  if (r.x + dx < rect.x) dx = rect.x - r.x
  if (r.y + dy < rect.y) dy = rect.y - r.y
  if (dx || dy) {
    node.x(node.x() + dx)
    node.y(node.y() + dy)
  }
}
function onContentDragMove(e: Konva.KonvaEventObject<DragEvent>): void {
  if (props.worldMode === 'bounded') {
    clampNode(e.target)
  } else if (props.worldMode === 'free' || props.worldMode === 'elastic') {
    // Content moved → the auto-sized world may have grown/shrunk.
    recompute()
    applyTransform()
  }
}

/**
 * Set zoom to `z`, keeping the world point under `anchor` (canvas-pixel coords;
 * default viewport centre) fixed. The browser clamps `scrollLeft/Top` to
 * `[0, contentVis − viewport]`, which enforces the no-top/left-void invariant.
 */
function commitZoom(z: number, anchor?: Vector2d): void {
  const el = scrollEl.value
  if (!el) return
  const vp = viewport()
  const ax = anchor?.x ?? vp.x / 2
  const ay = anchor?.y ?? vp.y / 2
  const worldX = (ax + el.scrollLeft) / zoom
  const worldY = (ay + el.scrollTop) / zoom

  zoom = z
  applyTransform()
  // Re-anchor (browser clamps to the valid range → no void on top/left). The
  // world origin cancels in this round-trip, so it isn't needed here.
  el.scrollLeft = worldX * z - ax
  el.scrollTop = worldY * z - ay
  applyTransform()

  emit('update:zoomLevel', z)
  emit('zoom', z)
}

// --- public API (exposed) -------------------------------------------------
function zoomTo(level: number, anchor?: Vector2d): void {
  commitZoom(snapZoom(level), anchor)
}
function zoomBy(factor: number, anchor?: Vector2d): void {
  commitZoom(snapZoom(zoom * factor), anchor)
}
function zoomIn(anchor?: Vector2d): void {
  commitZoom(steppedZoom(1), anchor)
}
function zoomOut(anchor?: Vector2d): void {
  commitZoom(steppedZoom(-1), anchor)
}
function scrollTo(x: number, y: number): void {
  const el = scrollEl.value
  if (!el) return
  el.scrollLeft = x
  el.scrollTop = y
  onScroll()
}
function scrollBy(dx: number, dy: number): void {
  const el = scrollEl.value
  if (el) scrollTo(el.scrollLeft + dx, el.scrollTop + dy)
}
type FitKind = 'contain' | 'width' | 'height'
function fitTargetZoom(kind: FitKind): number {
  const vp = viewport()
  if (kind === 'width') return vp.x / rect.width
  if (kind === 'height') return vp.y / rect.height
  return Math.min(vp.x / rect.width, vp.y / rect.height)
}
/**
 * Fit, converging on scrollbars: applying a fit can make a scrollbar appear,
 * which shrinks the viewport — so we re-measure (`viewport()` forces a reflow
 * reflecting the just-set spacer) and refit until the zoom settles. Without
 * this, "fit width" overshoots and shows *both* scrollbars.
 */
function doFit(kind: FitKind): void {
  const el = scrollEl.value
  if (!el) return
  let last = Number.NaN
  for (let i = 0; i < 4; i++) {
    const z = clampZoom(fitTargetZoom(kind))
    const converged = Math.abs(z - last) < 1e-4
    zoom = z
    el.scrollLeft = 0
    el.scrollTop = 0
    applyTransform()
    if (converged) break
    last = z
  }
  emit('update:zoomLevel', zoom)
  emit('zoom', zoom)
  emit('scroll', { x: 0, y: 0 })
}
function zoomToFit(): void {
  doFit('contain')
}
function zoomToFitX(): void {
  doFit('width')
}
function zoomToFitY(): void {
  doFit('height')
}
function resetZoom(): void {
  commitZoom(clampZoom(1))
}
function screenToWorld(p: Vector2d): Vector2d {
  const el = scrollEl.value
  const sx = el?.scrollLeft ?? 0
  const sy = el?.scrollTop ?? 0
  return { x: (p.x + sx) / zoom + rect.x, y: (p.y + sy) / zoom + rect.y }
}
function worldToScreen(p: Vector2d): Vector2d {
  const el = scrollEl.value
  const sx = el?.scrollLeft ?? 0
  const sy = el?.scrollTop ?? 0
  return { x: (p.x - rect.x) * zoom - sx, y: (p.y - rect.y) * zoom - sy }
}
/** World coordinate under the current Konva pointer (e.g. the cursor), or null. */
function pointerWorld(): Vector2d | null {
  const p = stage.value?.detach().getPointerPosition()
  return p ? screenToWorld(p) : null
}
/** Convert a world length / area to real units via the measurement `scale`. */
function scaledLength(worldLength: number): number {
  return worldLength * props.scale
}
function scaledArea(worldArea: number): number {
  return worldArea * props.scale ** 2
}

// Push the measurement scale down to every shape (recursing into groups).
function propagateScale(children: readonly KonvexBase[]): void {
  for (const c of children) {
    if (c instanceof KonvexShape) c.unitScale.value = props.scale
    else if (c instanceof KonvexContainer) propagateScale(c.children)
  }
}

// --- input handlers (wheel + pinch) ---------------------------------------
function anchorOf(e: { clientX: number; clientY: number }): Vector2d {
  const rect = viewportEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
function onWheel(e: WheelEvent): void {
  if (e.ctrlKey && props.zoomOnWheel) {
    e.preventDefault()
    if (e.deltaY < 0) zoomIn(anchorOf(e))
    else zoomOut(anchorOf(e))
    return
  }
  // Canvas overlays the scroll container, so forward wheel to it manually:
  // plain → vertical, shift → horizontal.
  e.preventDefault()
  if (e.shiftKey) scrollBy(e.deltaY || e.deltaX, 0)
  else scrollBy(e.deltaX, e.deltaY)
}

let pinch: { dist: number; anchor: Vector2d; zoom0: number } | null = null
function touchInfo(e: TouchEvent): { dist: number; anchor: Vector2d } {
  const [a, b] = [e.touches[0], e.touches[1]]
  const rect = viewportEl.value!.getBoundingClientRect()
  return {
    dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    anchor: {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top,
    },
  }
}
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 2 || !props.zoomOnWheel) return
  const t = touchInfo(e)
  pinch = { dist: t.dist, anchor: t.anchor, zoom0: zoom }
  e.preventDefault()
}
function onTouchMove(e: TouchEvent): void {
  if (!pinch || e.touches.length !== 2) return
  e.preventDefault()
  const t = touchInfo(e)
  // Free (unsnapped) zoom during the gesture.
  commitZoom(clampZoom((pinch.zoom0 * t.dist) / pinch.dist), t.anchor)
}
function onTouchEnd(e: TouchEvent): void {
  if (!pinch) return
  if (e.touches.length < 2) {
    commitZoom(snapZoom(zoom), pinch.anchor) // snap-on-commit
    pinch = null
  }
}

// --- sizing / lifecycle ---------------------------------------------------
function syncViewportSize(): void {
  const el = scrollEl.value
  const vEl = viewportEl.value
  if (!el || !vEl || !stage.value) return
  const w = el.clientWidth
  const h = el.clientHeight
  vEl.style.width = `${w}px`
  vEl.style.height = `${h}px`
  stage.value.size.value = { x: w, y: h }
  // A larger viewport can lower the 'fit' floor — re-clamp so we never sit below it.
  commitZoom(clampZoom(zoom))
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  const s = new KonvexStage(viewportEl.value!, { width: 1, height: 1 })
  const w = new KonvexLayer().insertInto(s)
  const o = new KonvexLayer().insertInto(s)
  stage.value = s
  world.value = w
  overlay.value = o

  // Boundary frame lives in the unscaled overlay → crisp 1px at any zoom.
  const f = new KonvexRect({ listening: false, stroke: { width: 1 } })
  o.add(f)
  frameRect.value = f

  // Drag events bubble to the layer, so one listener handles every child.
  w.detach().on('dragmove', onContentDragMove)

  recompute()
  syncViewportSize()
  if (props.zoomLevel !== undefined) commitZoom(clampZoom(props.zoomLevel))
  else zoomToFit()

  const vEl = viewportEl.value!
  vEl.addEventListener('wheel', onWheel, { passive: false })
  vEl.addEventListener('touchstart', onTouchStart, { passive: false })
  vEl.addEventListener('touchmove', onTouchMove, { passive: false })
  vEl.addEventListener('touchend', onTouchEnd)

  resizeObserver = new ResizeObserver(() => syncViewportSize())
  resizeObserver.observe(scrollEl.value!)

  emit('ready', s)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  const vEl = viewportEl.value
  if (vEl) {
    vEl.removeEventListener('wheel', onWheel)
    vEl.removeEventListener('touchstart', onTouchStart)
    vEl.removeEventListener('touchmove', onTouchMove)
    vEl.removeEventListener('touchend', onTouchEnd)
  }
  stage.value?.destroy()
})

// External v-model:zoomLevel changes.
watch(
  () => props.zoomLevel,
  v => {
    if (v !== undefined && v !== zoom) commitZoom(snapZoom(v))
  },
)
watch(
  () => props.contentSize,
  () => {
    recompute()
    commitZoom(clampZoom(zoom))
  },
  { deep: true },
)
watch(
  () => props.worldMode,
  () => {
    recompute()
    commitZoom(clampZoom(zoom))
  },
)
// Konva fires no child-add event; the container's reactive version does.
watch(
  () => world.value?.childrenVersion,
  () => {
    recompute()
    applyTransform()
    if (world.value) propagateScale(world.value.children)
  },
)
watch(
  () => props.scale,
  () => {
    if (world.value) propagateScale(world.value.children)
  },
)
watch(() => props.frame, updateFrame)

defineExpose({
  get stage() {
    return stage.value
  },
  get world() {
    return world.value
  },
  get overlay() {
    return overlay.value
  },
  get zoomLevel() {
    return zoom
  },
  get scale() {
    return props.scale
  },
  pointerWorld,
  scaledLength,
  scaledArea,
  zoomTo,
  zoomBy,
  zoomIn,
  zoomOut,
  zoomToFit,
  zoomToFitX,
  zoomToFitY,
  resetZoom,
  scrollTo,
  scrollBy,
  screenToWorld,
  worldToScreen,
})
</script>

<style scoped>
.kx-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.kx-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
}
.kx-spacer {
  width: 1px;
  height: 1px;
}
.kx-viewport {
  position: absolute;
  top: 0;
  left: 0;
  /* size set imperatively to the scroll client area; scrollbars stay uncovered */
}
</style>

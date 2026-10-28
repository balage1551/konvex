<template>
  <!--
    Every element also carries its `eltb-*` name from when this was the
    EditableLine toolbar, so host CSS written against those keeps applying.
    @deprecated The `eltb-*` classes; use `kxtb-*`. Removed in 2.0.
  -->
  <div
    v-if="visible && ctx"
    ref="root"
    class="kxtb eltb"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @contextmenu.prevent
  >
    <div v-if="label" class="kxtb-info eltb-info">{{ label }}</div>
    <div class="kxtb-row eltb-row">
      <template v-for="(entry, i) in entries" :key="i">
        <span v-if="entry.kind === 'separator'" class="kxtb-sep eltb-sep" />
        <button
          v-else
          class="kxtb-btn eltb-btn"
          :class="{ 'kxtb-btn-disabled eltb-btn-disabled': entry.state === 'disabled' }"
          :disabled="entry.state === 'disabled'"
          :title="entry.item.label"
          @click="activate(entry)"
        >
          <ItemContent :item="entry.item" :ctx="ctx" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts" generic="Ctx, Req extends { pointerScreen: Vector2d } = KonvexContextRequest">
// A popup toolbar of context items, shown at the pointer and dismissed on an
// outside click or Escape. It opens on a request: from `node`'s
// `context-request` signal, or from the host calling the exposed `open()` with
// a request of its own (EditableLine's `toolbar-request`, say). `context` turns
// the request into what the items see, and is re-read while the bar is open, so
// items track live state.
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type VNodeChild } from 'vue'
import type { KonvexBase } from '../KonvexBase'
import type { KonvexContextRequest, Vector2d } from '../KonvexTypes'
import {
  CONTEXT_TOOLBAR_SEPARATOR,
  resolveContextToolbarItems,
  type ContextToolbarItemSpec,
  type ContextToolbarItemState,
  type KonvexContextToolbarItem,
} from './KonvexContextToolbar-types'

const props = defineProps<{
  /** What the items see, built from the request that opened the bar. */
  context: (request: Req) => Ctx
  /** Ordered items: `'|'` dividers, ids from `builtins`, or inline item objects. */
  items: readonly ContextToolbarItemSpec<Ctx>[]
  /** Items that `items` may name by id. */
  builtins?: Readonly<Record<string, KonvexContextToolbarItem<Ctx>>>
  /** Optional heading shown above the bar. */
  label?: string
  /** A node whose `context-request` signal opens the bar; it needs `contextRequest` on. */
  node?: KonvexBase
}>()

const visible = ref(false)
const pos = ref({ x: 0, y: 0 })
const request = ref<Req | null>(null)
const root = ref<HTMLElement>()

const ctx = computed<Ctx | null>(() => (request.value ? props.context(request.value as Req) : null))

const resolved = computed(() => resolveContextToolbarItems(props.items, props.builtins))

/**
 * The visible items with their resolved three-state, plus separators. Hidden
 * items are dropped, and so is any separator left with nothing on one side, so
 * hiding a whole group leaves no stray or doubled divider.
 */
const entries = computed(() => {
  const c = ctx.value
  const all = resolved.value.map(entry => {
    if (entry === CONTEXT_TOOLBAR_SEPARATOR) return { kind: 'separator' as const }
    const state: ContextToolbarItemState = c ? (entry.state?.(c as Ctx) ?? 'enabled') : 'hidden'
    return { kind: 'item' as const, item: entry, state }
  })
  const shown = all.filter(e => e.kind === 'separator' || e.state !== 'hidden')
  return shown.filter(
    (e, i) =>
      e.kind === 'item' ||
      (i > 0 && shown[i - 1].kind === 'item' && shown.slice(i + 1).some(n => n.kind === 'item')),
  )
})

/** Renders an item's `render` union into VNodes (mdi glyph / component / fn). `eltb-icon` is the deprecated alias. */
const ItemContent = (p: { item: KonvexContextToolbarItem<Ctx>; ctx: Ctx }): VNodeChild => {
  const r = p.item.render
  if (typeof r === 'string') return h('i', { class: ['kxtb-icon', 'eltb-icon', 'mdi', r] })
  if (typeof r === 'function') return r(p.ctx)
  if ('icon' in r) return h('i', { class: ['kxtb-icon', 'eltb-icon', 'mdi', r.icon, r.class] })
  return h(r.component, r.props)
}

type Entry = (typeof entries)['value'][number]

function hide(): void {
  if (!visible.value) return
  visible.value = false
  request.value = null
}

function open(req: Req): void {
  request.value = req
  pos.value = req.pointerScreen
  visible.value = true
}

function activate(entry: Entry): void {
  if (entry.kind !== 'item' || entry.state !== 'enabled' || !ctx.value) return
  entry.item.run?.(ctx.value as Ctx)
  if (!entry.item.keepOpen) hide()
}

// Document listeners live for the component's lifetime and no-op while hidden,
// so dismiss-on-outside-click / Escape need no add/remove churn per open.
function onDocMouseDown(e: MouseEvent): void {
  if (visible.value && root.value && !root.value.contains(e.target as Node)) hide()
}

function onKeyDown(e: KeyboardEvent): void {
  if (visible.value && e.key === 'Escape') hide()
}

// (Re)subscribe to the bound node's context-request signal as it changes.
let off: (() => void) | undefined
function subscribe(node: KonvexBase | undefined): void {
  off?.()
  off = node?.signals.on('context-request', req => open(req as unknown as Req))
}

onMounted(() => {
  subscribe(props.node)
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('keydown', onKeyDown, true)
})
watch(
  () => props.node,
  node => {
    hide()
    subscribe(node)
  },
)
onBeforeUnmount(() => {
  off?.()
  hide()
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('keydown', onKeyDown, true)
})

defineExpose({ open, hide })
</script>

<style scoped>
.kxtb {
  position: fixed;
  z-index: 1000;
  /* Anchor the pointer at the bottom-centre so the bar floats above it. */
  transform: translate(-50%, calc(-100% - 8px));
  padding: 4px;
  border-radius: 4px;
  background: #37474f;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  user-select: none;
}

.kxtb-info {
  font-size: 80%;
  color: #f1e495;
  border-bottom: 1px solid #938a56;
  padding: 0 2px 2px;
  margin-bottom: 2px;
}

.kxtb-row {
  display: flex;
  align-items: center;
  gap: 1px;
}

.kxtb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: #b6a258;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.kxtb-btn:hover:not(.kxtb-btn-disabled) {
  color: #f5e184;
}

.kxtb-btn-disabled {
  color: #6f6f6f;
  cursor: default;
}

/* `eltb-icon-danger`: @deprecated alias of `kxtb-icon-danger`, for custom items
   written against the old EditableLine toolbar. Removed in 2.0. */
.kxtb-btn :deep(.kxtb-icon-danger),
.kxtb-btn :deep(.eltb-icon-danger) {
  color: #be3838;
}

.kxtb-btn:hover:not(.kxtb-btn-disabled) :deep(.kxtb-icon-danger),
.kxtb-btn:hover:not(.kxtb-btn-disabled) :deep(.eltb-icon-danger) {
  color: #ff5050;
}

.kxtb-sep {
  width: 2px;
  align-self: stretch;
  background-color: #938a56;
  margin: 2px 4px;
}
</style>

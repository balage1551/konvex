<template>
  <div
    v-if="visible && ctx"
    ref="root"
    class="eltb"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @contextmenu.prevent
  >
    <div v-if="label" class="eltb-info">{{ label }}</div>
    <div class="eltb-row">
      <template v-for="(entry, i) in entries" :key="i">
        <span v-if="entry.kind === 'separator'" class="eltb-sep" />
        <button
          v-else-if="entry.state !== 'hidden'"
          class="eltb-btn"
          :class="{ 'eltb-btn-disabled': entry.state === 'disabled' }"
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

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type VNodeChild } from 'vue'
import type { EditableLine } from '../EditableLine'
import type { EditableLineToolbarRequest } from '../EditableLine-events'
import {
  DEFAULT_TOOLBAR_ITEMS,
  resolveToolbarItems,
  TOOLBAR_SEPARATOR,
} from './EditableLineToolbar-items'
import type {
  EditableLineToolbarContext,
  EditableLineToolbarItem,
  ToolbarItemSpec,
  ToolbarItemState,
} from './EditableLineToolbar-types'

const props = withDefaults(
  defineProps<{
    line: EditableLine
    /** Ordered items: builtin ids, `'|'` dividers, or inline item objects. */
    items?: ToolbarItemSpec[]
    /** Optional heading shown above the bar (e.g. a selection count). */
    label?: string
  }>(),
  { items: () => DEFAULT_TOOLBAR_ITEMS, label: undefined },
)

const visible = ref(false)
const pos = ref({ x: 0, y: 0 })
const request = ref<EditableLineToolbarRequest | null>(null)
const root = ref<HTMLElement>()

// Live context: recomputed as the selection changes while the bar is open, so
// each item's state/label tracks the current points.
const ctx = computed<EditableLineToolbarContext | null>(() => {
  const req = request.value
  if (!req) return null
  return {
    line: props.line,
    selection: props.line.selection.value,
    points: props.line.pointInfos.value.filter(p => p.selected),
    pointerWorld: req.pointerWorld,
    pointerScreen: req.pointerScreen,
  }
})

const resolved = computed(() => resolveToolbarItems(props.items))

/** Items paired with their currently-resolved three-state, plus separators. */
const entries = computed(() => {
  const c = ctx.value
  return resolved.value.map(entry => {
    if (entry === TOOLBAR_SEPARATOR) return { kind: 'separator' as const }
    const state: ToolbarItemState = c ? (entry.state?.(c) ?? 'enabled') : 'hidden'
    return { kind: 'item' as const, item: entry, state }
  })
})

/** Renders an item's `render` union into VNodes (mdi glyph / component / fn). */
const ItemContent = (p: { item: EditableLineToolbarItem; ctx: EditableLineToolbarContext }): VNodeChild => {
  const r = p.item.render
  if (typeof r === 'string') return h('i', { class: ['eltb-icon', 'mdi', r] })
  if (typeof r === 'function') return r(p.ctx)
  if ('icon' in r) return h('i', { class: ['eltb-icon', 'mdi', r.icon, r.class] })
  return h(r.component, r.props)
}

type Entry = (typeof entries)['value'][number]

function hide(): void {
  if (!visible.value) return
  visible.value = false
  request.value = null
}

function activate(entry: Entry): void {
  if (entry.kind !== 'item' || entry.state !== 'enabled' || !ctx.value) return
  entry.item.run?.(ctx.value)
  hide()
}

// Document listeners live for the component's lifetime and no-op while hidden,
// so dismiss-on-outside-click / Escape need no add/remove churn per open.
function onDocMouseDown(e: MouseEvent): void {
  if (visible.value && root.value && !root.value.contains(e.target as Node)) hide()
}

function onKeyDown(e: KeyboardEvent): void {
  if (visible.value && e.key === 'Escape') hide()
}

function open(req: EditableLineToolbarRequest): void {
  request.value = req
  pos.value = req.pointerScreen
  visible.value = true
}

// (Re)subscribe to the line's toolbar-request signal as the bound line changes.
let off: (() => void) | undefined
function subscribe(line: EditableLine): void {
  off?.()
  off = line.events.on('toolbar-request', open)
}

onMounted(() => {
  subscribe(props.line)
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('keydown', onKeyDown, true)
})
watch(
  () => props.line,
  line => {
    hide()
    subscribe(line)
  },
)
onBeforeUnmount(() => {
  off?.()
  hide()
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('keydown', onKeyDown, true)
})
</script>

<style scoped>
.eltb {
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

.eltb-info {
  font-size: 80%;
  color: #f1e495;
  border-bottom: 1px solid #938a56;
  padding: 0 2px 2px;
  margin-bottom: 2px;
}

.eltb-row {
  display: flex;
  align-items: center;
  gap: 1px;
}

.eltb-btn {
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

.eltb-btn:hover:not(.eltb-btn-disabled) {
  color: #f5e184;
}

.eltb-btn-disabled {
  color: #6f6f6f;
  cursor: default;
}

.eltb-btn :deep(.eltb-icon-danger) {
  color: #be3838;
}

.eltb-btn:hover:not(.eltb-btn-disabled) :deep(.eltb-icon-danger) {
  color: #ff5050;
}

.eltb-sep {
  width: 2px;
  align-self: stretch;
  background-color: #938a56;
  margin: 2px 4px;
}
</style>

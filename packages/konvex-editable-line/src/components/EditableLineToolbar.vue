<template>
  <KonvexContextToolbar
    ref="bar"
    :context="context"
    :items="items"
    :builtins="BUILTIN_TOOLBAR_ITEMS"
    :label="label"
  />
</template>

<script setup lang="ts">
// konvex's context toolbar, specialised to an EditableLine: it opens on the
// line's `toolbar-request` and hands the items an EditableLineToolbarContext.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KonvexContextToolbar } from '@balage1551/konvex'
import type { EditableLine } from '../EditableLine'
import type { EditableLineToolbarRequest } from '../EditableLine-events'
import { BUILTIN_TOOLBAR_ITEMS, DEFAULT_TOOLBAR_ITEMS } from './EditableLineToolbar-items'
import type { EditableLineToolbarContext, ToolbarItemSpec } from './EditableLineToolbar-types'

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

const bar = ref<{ open: (req: EditableLineToolbarRequest) => void; hide: () => void } | null>(null)

// Re-read while the bar is open, so each item's state/label tracks the current
// selection.
function context(req: EditableLineToolbarRequest): EditableLineToolbarContext {
  return {
    line: props.line,
    selection: props.line.selection.value,
    points: props.line.pointInfos.value.filter(p => p.selected),
    pointerWorld: req.pointerWorld,
    pointerScreen: req.pointerScreen,
    hit: req.hit,
  }
}

// (Re)subscribe to the line's toolbar-request signal as the bound line changes.
let off: (() => void) | undefined
function subscribe(line: EditableLine): void {
  off?.()
  off = line.events.on('toolbar-request', req => bar.value?.open(req))
}

onMounted(() => subscribe(props.line))
watch(
  () => props.line,
  line => {
    bar.value?.hide()
    subscribe(line)
  },
)
onBeforeUnmount(() => off?.())
</script>

<!-- Minimal static split (sandbox stand-in for naboo's PmiSplitPane). No drag. -->
<template>
  <div class="split-pane" :class="orientation">
    <div class="pane first" :style="firstStyle"><slot name="first" /></div>
    <div class="pane second"><slot name="second" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical'
    initialPosition?: string
    persistenceKey?: string
  }>(),
  { orientation: 'vertical', initialPosition: '60%' },
)

const firstStyle = computed(() => ({ flex: `0 0 ${props.initialPosition}` }))
</script>

<style scoped>
.split-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  min-width: 0;
}
.split-pane.vertical {
  flex-direction: column;
}
.split-pane.horizontal {
  flex-direction: row;
}
.pane {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.pane.second {
  flex: 1 1 auto;
}
</style>

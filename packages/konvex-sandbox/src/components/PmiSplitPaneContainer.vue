<!-- Minimal stand-in for naboo's PmiSplitPaneContainer (sandbox only). -->
<template>
  <div class="split-pane-container" :style="style"><slot /></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ side?: 'first' | 'second'; min?: string }>()

const style = computed(() => ({
  height: '100%',
  minHeight: props.min ?? '0',
  overflow: 'auto',
}))
</script>

<style scoped>
.split-pane-container {
  display: flex;
  flex-direction: column;
}
</style>

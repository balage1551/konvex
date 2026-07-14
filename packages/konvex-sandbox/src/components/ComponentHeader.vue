<!-- Minimal stand-in for naboo's ComponentHeader (sandbox only). -->
<template>
  <header class="header" style="height: 65px">
    <span class="header-title">{{ title }}</span>
    <slot name="buttons" />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background-color: gray;
  color: white;
}
.header-title {
  font-size: 1.25rem;
  font-weight: 500;
}
</style>

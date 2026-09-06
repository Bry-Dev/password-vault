<script setup lang="ts">
defineProps<{
  kind?: 'error' | 'success' | 'info'
}>()
</script>

<template>
  <div
    class="rounded-2xl border px-4 py-3 text-sm"
    :class="{
      'border-red-200 bg-red-50 text-red-700': kind === 'error',
      'border-emerald-200 bg-emerald-50 text-emerald-700': kind === 'success',
      'border-slate-200 bg-slate-50 text-slate-700': !kind || kind === 'info',
    }"
  >
    <slot />
  </div>
</template>

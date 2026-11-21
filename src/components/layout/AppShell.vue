<script setup lang="ts">
import UpdateBanner from './UpdateBanner.vue'

const version = __APP_VERSION__
const builtAt = __APP_BUILT_AT__
const builtLabel = new Date(builtAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="safe-top safe-bottom min-h-dvh">
    <header class="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Offline-first</p>
        <h1 class="text-lg font-bold text-slate-950">Local Vault</h1>
      </div>
      <span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
        No cloud sync
      </span>
    </header>

    <UpdateBanner />

    <main class="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
      <slot />
    </main>

    <footer class="mx-auto w-full max-w-3xl px-4 pb-6 text-center text-xs text-slate-400 sm:px-6">
      <span :data-build="builtAt">Version {{ version }} · built {{ builtLabel }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

const route = useRoute()
const dismissed = ref(false)
let registration: ServiceWorkerRegistration | undefined
let lastCheck = 0
let timer: number | undefined

/** Asks the server for a newer version, at most hourly, only when online and visible. */
function checkForUpdate(): void {
  if (!registration || !navigator.onLine || document.visibilityState !== 'visible') return
  if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
  lastCheck = Date.now()
  registration.update().catch(() => undefined)
}

function onVisibilityChange(): void {
  // iOS pauses timers while an installed app is in the background; check when it comes back.
  if (document.visibilityState === 'visible') checkForUpdate()
}

const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    registration = reg
    lastCheck = Date.now()
    timer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
  },
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// Hidden during setup: reloading there would discard the recovery key being confirmed.
const visible = computed(() => needRefresh.value && !dismissed.value && route.path !== '/setup')

async function updateNow(): Promise<void> {
  // Activates the waiting service worker and reloads into the new version.
  await updateServiceWorker(true)
}
</script>

<template>
  <div
    v-if="visible"
    role="status"
    class="mx-auto mb-4 w-full max-w-3xl px-4 sm:px-6"
  >
    <div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
      <p class="font-semibold">A new version is ready</p>
      <p class="mt-1 leading-5">Updating reloads the app and locks the vault. Finish and save any edits first.</p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl border border-sky-300 bg-white px-4 py-2.5 font-semibold text-sky-900"
          @click="dismissed = true"
        >
          Later
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white"
          @click="updateNow"
        >
          Update now
        </button>
      </div>
    </div>
  </div>
</template>

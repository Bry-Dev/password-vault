<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import { useVaultStore } from '@/stores/vault'
import type { VaultBackupFile } from '@/types/vault'

const emit = defineEmits<{
  restored: []
}>()

const vault = useVaultStore()
const input = ref<HTMLInputElement | null>(null)
const error = ref('')

/** The parsed (still encrypted) backup waiting for its secret. */
const pending = ref<VaultBackupFile | null>(null)
const deviceEntryCount = ref(0)
const secret = ref('')
const exported = ref(false)

const backupDate = computed(() =>
  pending.value ? new Date(pending.value.exportedAt).toLocaleDateString() : '',
)
const plural = (count: number) => `${count} ${count === 1 ? 'entry' : 'entries'}`

function reset(): void {
  pending.value = null
  secret.value = ''
  exported.value = false
  error.value = ''
}

async function onFileChosen(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  reset()
  try {
    pending.value = await vault.readBackupFile(file)
    deviceEntryCount.value = vault.initialized ? await vault.storedEntryCount() : 0
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to read backup.'
  }
}

async function exportCurrentFirst(): Promise<void> {
  error.value = ''
  try {
    exported.value = (await vault.exportBackup()) !== 'cancelled'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to export backup.'
  }
}

async function restore(): Promise<void> {
  if (!pending.value || !secret.value) return
  error.value = ''
  try {
    await vault.restoreBackup(pending.value, secret.value)
    reset()
    emit('restored')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to restore backup.'
  } finally {
    secret.value = ''
  }
}
</script>

<template>
  <div>
    <StatusAlert v-if="error" kind="error" class="mb-3">{{ error }}</StatusAlert>
    <!-- No `accept` filter: iOS has no type for .pvault and may grey the file out. parseBackup rejects anything else. -->
    <input ref="input" type="file" class="hidden" @change="onFileChosen" />

    <button
      v-if="!pending"
      type="button"
      class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
      @click="input?.click()"
    >
      Import .pvault backup
    </button>

    <form v-else class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" @submit.prevent="restore">
      <p class="text-sm text-slate-700">
        Backup from <span class="font-semibold">{{ backupDate }}</span> with {{ plural(pending.entries.length) }}.
      </p>

      <div v-if="vault.initialized" class="space-y-2">
        <StatusAlert kind="error">
          Restoring replaces the vault on this device ({{ plural(deviceEntryCount) }}). Anything not in a backup will
          be lost.
        </StatusAlert>
        <button
          type="button"
          class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          @click="exportCurrentFirst"
        >
          {{ exported ? 'Current vault exported ✓' : 'Export the current vault first' }}
        </button>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-slate-700" for="restore-secret">
          Master password or recovery key for this backup
        </label>
        <input
          id="restore-secret"
          v-model="secret"
          type="password"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          required
          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-slate-500"
        />
        <p class="mt-1 text-xs leading-5 text-slate-500">
          Use the master password that was in use when the backup was made. Nothing changes unless it opens the backup.
        </p>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          :disabled="vault.busy"
          @click="reset"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="vault.busy || !secret"
        >
          {{ vault.busy ? 'Checking…' : vault.initialized ? 'Replace and restore' : 'Restore' }}
        </button>
      </div>
    </form>
  </div>
</template>

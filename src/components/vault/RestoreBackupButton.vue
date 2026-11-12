<script setup lang="ts">
import { ref } from 'vue'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import { useVaultStore } from '@/stores/vault'

const props = defineProps<{
  /** True when a vault already exists on this device and will be overwritten. */
  replacesExisting: boolean
}>()

const emit = defineEmits<{
  restored: []
}>()

const vault = useVaultStore()
const input = ref<HTMLInputElement | null>(null)
const error = ref('')

async function onFileChosen(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (
    props.replacesExisting &&
    !window.confirm('Importing will replace the local vault currently stored on this device. Continue?')
  ) {
    target.value = ''
    return
  }

  error.value = ''
  try {
    await vault.importBackup(file)
    emit('restored')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to import backup.'
  } finally {
    target.value = ''
  }
}
</script>

<template>
  <div>
    <StatusAlert v-if="error" kind="error" class="mb-3">{{ error }}</StatusAlert>
    <input ref="input" type="file" accept=".pvault,application/json" class="hidden" @change="onFileChosen" />
    <button
      type="button"
      class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
      @click="input?.click()"
    >
      Import .pvault backup
    </button>
  </div>
</template>

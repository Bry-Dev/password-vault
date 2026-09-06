<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import VaultEntryCard from '@/components/vault/VaultEntryCard.vue'
import VaultEntryForm from '@/components/vault/VaultEntryForm.vue'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import type { VaultEntry, VaultEntryInput } from '@/types/vault'
import { useVaultStore } from '@/stores/vault'

const vault = useVaultStore()
const router = useRouter()
const editorOpen = ref(false)
const editingEntry = ref<VaultEntry | null>(null)
const error = ref('')
const search = ref('')

const filteredEntries = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return vault.entries
  return vault.entries.filter((entry) =>
    [entry.title, entry.username, entry.url].some((value) => value.toLowerCase().includes(term)),
  )
})

onMounted(async () => {
  await vault.bootstrap()
  if (!vault.initialized) {
    await router.replace('/setup')
    return
  }
  if (!vault.unlocked) {
    await router.replace('/unlock')
  }
})

function openNew(): void {
  editingEntry.value = null
  editorOpen.value = true
}

function openEdit(entry: VaultEntry): void {
  editingEntry.value = entry
  editorOpen.value = true
}

async function save(input: VaultEntryInput, id?: string): Promise<void> {
  error.value = ''
  try {
    await vault.saveEntry(input, id)
    editorOpen.value = false
    editingEntry.value = null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to save password.'
  }
}

async function remove(id: string): Promise<void> {
  await vault.deleteEntry(id)
}

async function lock(): Promise<void> {
  vault.lock()
  await router.replace('/unlock')
}

async function exportBackup(): Promise<void> {
  error.value = ''
  try {
    await vault.exportBackup()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to export backup.'
  }
}
</script>

<template>
  <section>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-medium text-slate-500">{{ vault.entryCount }} saved</p>
        <h2 class="text-2xl font-bold tracking-tight text-slate-950">Passwords</h2>
      </div>
      <div class="flex gap-2">
        <button
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          @click="exportBackup"
        >
          Export backup
        </button>
        <button class="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white" @click="lock">
          Lock
        </button>
      </div>
    </div>

    <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

    <div class="mt-5 flex gap-2">
      <input
        v-model="search"
        type="search"
        autocomplete="off"
        class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
        placeholder="Search unlocked vault"
      />
      <button class="rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white" @click="openNew">+ Add</button>
    </div>

    <div v-if="editorOpen" class="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 class="mb-4 text-lg font-bold text-slate-950">{{ editingEntry ? 'Edit password' : 'Add password' }}</h3>
      <VaultEntryForm
        :entry="editingEntry"
        @save="save"
        @cancel="editorOpen = false; editingEntry = null"
      />
    </div>

    <div v-if="filteredEntries.length" class="mt-5 grid gap-3 sm:grid-cols-2">
      <VaultEntryCard
        v-for="entry in filteredEntries"
        :key="entry.id"
        :entry="entry"
        @edit="openEdit"
        @delete="remove"
      />
    </div>

    <div v-else class="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
      <p class="font-semibold text-slate-800">{{ search ? 'No matching entries' : 'Your vault is empty' }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ search ? 'Try another search.' : 'Add your first password. It will be encrypted before being stored in IndexedDB.' }}</p>
    </div>
  </section>
</template>

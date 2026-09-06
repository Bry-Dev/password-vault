<script setup lang="ts">
import { ref } from 'vue'
import type { VaultEntry } from '@/types/vault'

const props = defineProps<{
  entry: VaultEntry
}>()

const emit = defineEmits<{
  edit: [entry: VaultEntry]
  delete: [id: string]
}>()

const revealed = ref(false)
const copied = ref<string | null>(null)

async function copy(value: string, label: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  copied.value = label
  window.setTimeout(() => {
    copied.value = null
  }, 1200)
}

function remove(): void {
  if (window.confirm(`Delete ${props.entry.title}? This cannot be undone.`)) {
    emit('delete', props.entry.id)
  }
}
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate font-semibold text-slate-950">{{ entry.title }}</h3>
        <p v-if="entry.username" class="truncate text-sm text-slate-500">{{ entry.username }}</p>
      </div>
      <button class="text-sm font-medium text-slate-500" @click="emit('edit', entry)">Edit</button>
    </div>

    <div class="mt-4 rounded-xl bg-slate-50 p-3">
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate text-sm text-slate-700">
          {{ revealed ? entry.password : '••••••••••••' }}
        </code>
        <button class="text-xs font-semibold text-slate-600" @click="revealed = !revealed">
          {{ revealed ? 'Hide' : 'Show' }}
        </button>
        <button class="text-xs font-semibold text-slate-600" @click="copy(entry.password, 'password')">
          {{ copied === 'password' ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="entry.username"
        class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600"
        @click="copy(entry.username, 'username')"
      >
        {{ copied === 'username' ? 'Copied username' : 'Copy username' }}
      </button>
      <a
        v-if="entry.url"
        :href="entry.url"
        target="_blank"
        rel="noreferrer"
        class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600"
      >
        Open site
      </a>
      <button
        class="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600"
        @click="remove"
      >
        Delete
      </button>
    </div>
  </article>
</template>

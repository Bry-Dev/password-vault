<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { VaultEntry, VaultEntryInput } from '@/types/vault'

const props = defineProps<{
  entry?: VaultEntry | null
}>()

const emit = defineEmits<{
  save: [input: VaultEntryInput, id?: string]
  cancel: []
}>()

const form = reactive<VaultEntryInput>({
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
})

watch(
  () => props.entry,
  (entry) => {
    form.title = entry?.title ?? ''
    form.username = entry?.username ?? ''
    form.password = entry?.password ?? ''
    form.url = entry?.url ?? ''
    form.notes = entry?.notes ?? ''
  },
  { immediate: true },
)

function submit(): void {
  if (!form.title.trim() || !form.password) return
  emit(
    'save',
    {
      title: form.title.trim(),
      username: form.username.trim(),
      password: form.password,
      url: form.url.trim(),
      notes: form.notes.trim(),
    },
    props.entry?.id,
  )
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700">Name</label>
      <input
        v-model="form.title"
        required
        autocomplete="off"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
        placeholder="e.g. GitHub"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700">Username / email</label>
      <input
        v-model="form.username"
        autocomplete="off"
        autocapitalize="none"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700">Password</label>
      <input
        v-model="form.password"
        required
        type="password"
        autocomplete="new-password"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700">Website</label>
      <input
        v-model="form.url"
        type="url"
        inputmode="url"
        autocomplete="off"
        autocapitalize="none"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
        placeholder="https://"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700">Notes</label>
      <textarea
        v-model="form.notes"
        rows="3"
        class="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
      />
    </div>

    <div class="flex gap-2">
      <button
        type="submit"
        class="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white active:scale-[0.99]"
      >
        {{ entry ? 'Save changes' : 'Add password' }}
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

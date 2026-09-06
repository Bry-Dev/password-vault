<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import { useVaultStore } from '@/stores/vault'

const vault = useVaultStore()
const router = useRouter()
const mode = ref<'master' | 'recovery'>('master')
const secret = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const error = ref('')
const importInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await vault.bootstrap()
  if (!vault.initialized) await router.replace('/setup')
  if (vault.unlocked) await router.replace('/vault')
})

async function unlock(): Promise<void> {
  error.value = ''
  try {
    if (mode.value === 'master') {
      await vault.unlockWithMasterPassword(secret.value)
    } else {
      if (newPassword.value.length < 12) {
        throw new Error('Use a new master password of at least 12 characters.')
      }
      if (newPassword.value !== confirmNewPassword.value) {
        throw new Error('The new master passwords do not match.')
      }
      await vault.recoverAndResetMasterPassword(secret.value, newPassword.value)
    }
    secret.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    await router.replace('/vault')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to unlock vault.'
  }
}

async function importBackup(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!window.confirm('Importing will replace the local vault currently stored on this device. Continue?')) {
    target.value = ''
    return
  }

  error.value = ''
  try {
    await vault.importBackup(file)
    mode.value = 'master'
    secret.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to import backup.'
  } finally {
    target.value = ''
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <p class="text-sm font-medium text-slate-500">Local device</p>
    <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Unlock vault</h2>
    <p class="mt-2 text-sm leading-6 text-slate-600">
      No request is sent to a server. Unlocking happens in this browser on this device.
    </p>

    <div class="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
      <button
        class="rounded-lg px-3 py-2 text-sm font-semibold"
        :class="mode === 'master' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'"
        @click="mode = 'master'; secret = ''; newPassword = ''; confirmNewPassword = ''; error = ''"
      >
        Master password
      </button>
      <button
        class="rounded-lg px-3 py-2 text-sm font-semibold"
        :class="mode === 'recovery' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'"
        @click="mode = 'recovery'; secret = ''; newPassword = ''; confirmNewPassword = ''; error = ''"
      >
        Recovery key
      </button>
    </div>

    <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

    <form class="mt-5 space-y-4" @submit.prevent="unlock">
      <input
        v-model="secret"
        :type="mode === 'master' ? 'password' : 'text'"
        :autocomplete="mode === 'master' ? 'current-password' : 'off'"
        autocapitalize="none"
        spellcheck="false"
        required
        class="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
        :placeholder="mode === 'master' ? 'Master password' : 'Paste recovery key'"
      />
      <template v-if="mode === 'recovery'">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">New master password</label>
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
            class="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Confirm new master password</label>
          <input
            v-model="confirmNewPassword"
            type="password"
            autocomplete="new-password"
            required
            class="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
          />
        </div>
        <p class="text-xs leading-5 text-slate-500">
          A valid recovery key will re-wrap the existing vault key under this new master password. Your saved entries are not re-encrypted one by one.
        </p>
      </template>
      <button
        :disabled="vault.busy"
        class="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {{ vault.busy ? 'Unlocking…' : mode === 'recovery' ? 'Recover and reset password' : 'Unlock' }}
      </button>
    </form>

    <div class="mt-6 border-t border-slate-200 pt-5">
      <p class="text-sm font-semibold text-slate-800">Restore an encrypted backup</p>
      <p class="mt-1 text-xs leading-5 text-slate-500">Use this after reinstalling the PWA or moving an exported vault to another device.</p>
      <input ref="importInput" type="file" accept=".pvault,application/json" class="hidden" @change="importBackup" />
      <button
        class="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        @click="importInput?.click()"
      >
        Import .pvault backup
      </button>
    </div>
  </section>
</template>

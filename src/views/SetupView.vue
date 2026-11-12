<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import RestoreBackupButton from '@/components/vault/RestoreBackupButton.vue'
import { useVaultStore } from '@/stores/vault'

const vault = useVaultStore()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')
const recoveryKey = ref('')
const copied = ref(false)
const confirmedSaved = ref(false)

onMounted(async () => {
  await vault.bootstrap()
  if (vault.initialized) await router.replace('/unlock')
})

function passwordRuleError(value: string): string {
  if (value.length < 8) return 'Use a master password of at least 8 characters.'
  const missing: string[] = []
  if (!/[a-z]/.test(value)) missing.push('a lowercase letter')
  if (!/[A-Z]/.test(value)) missing.push('an uppercase letter')
  if (!/[0-9]/.test(value)) missing.push('a number')
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('a symbol')
  return missing.length ? `Add ${missing.join(', ')} to your master password.` : ''
}

function validatePassword(): boolean {
  passwordError.value = passwordRuleError(password.value)
  // Re-check the confirmation if the user already filled it in, so a stale mismatch message clears.
  if (confirmPassword.value) validateConfirmPassword()
  return !passwordError.value
}

function validateConfirmPassword(): boolean {
  confirmPasswordError.value = password.value !== confirmPassword.value ? 'The passwords do not match.' : ''
  return !confirmPasswordError.value
}

async function createVault(): Promise<void> {
  error.value = ''

  const passwordValid = validatePassword()
  const confirmValid = validateConfirmPassword()
  if (!passwordValid || !confirmValid) return

  try {
    recoveryKey.value = await vault.setup(password.value)
    password.value = ''
    confirmPassword.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to create vault.'
  }
}

async function copyRecoveryKey(): Promise<void> {
  await navigator.clipboard.writeText(recoveryKey.value)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1500)
}

async function onRestored(): Promise<void> {
  await router.replace({ path: '/unlock', query: { restored: '1' } })
}

async function continueToVault(): Promise<void> {
  if (!confirmedSaved.value) return
  await router.replace('/vault')
}
</script>

<template>
  <section class="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <template v-if="!recoveryKey">
      <p class="text-sm font-medium text-slate-500">First-time setup</p>
      <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Create your local vault</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Your master password is never saved. It is used only to derive a key that unlocks the vault encryption key.
      </p>

      <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

      <form class="mt-6 space-y-4" @submit.prevent="createVault">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Master password</label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="Boolean(passwordError)"
            class="w-full rounded-xl border px-3 py-3 outline-none"
            :class="passwordError ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-slate-500'"
            @blur="validatePassword"
          />
          <p v-if="passwordError" class="mt-1 text-sm text-red-600">{{ passwordError }}</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Confirm master password</label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="Boolean(confirmPasswordError)"
            class="w-full rounded-xl border px-3 py-3 outline-none"
            :class="confirmPasswordError ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-slate-500'"
            @blur="validateConfirmPassword"
          />
          <p v-if="confirmPasswordError" class="mt-1 text-sm text-red-600">{{ confirmPasswordError }}</p>
        </div>
        <button
          :disabled="vault.busy"
          class="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {{ vault.busy ? 'Creating encrypted vault…' : 'Create vault' }}
        </button>
      </form>

      <div class="mt-6 border-t border-slate-200 pt-5">
        <p class="text-sm font-semibold text-slate-800">Already have a backup?</p>
        <p class="mt-1 text-xs leading-5 text-slate-500">
          Restore an encrypted .pvault file on a new device, or after this browser's data was cleared.
        </p>
        <RestoreBackupButton class="mt-3" :replaces-existing="false" @restored="onRestored" />
      </div>
    </template>

    <template v-else>
      <p class="text-sm font-medium text-amber-700">Save this before continuing</p>
      <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Your recovery key</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        This key can unlock your vault if you forget your master password. The app does not upload or keep another copy for you.
      </p>

      <div class="mt-5 break-all rounded-2xl border border-amber-200 bg-amber-50 p-4 font-mono text-sm text-amber-950">
        {{ recoveryKey }}
      </div>

      <button
        class="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700"
        @click="copyRecoveryKey"
      >
        {{ copied ? 'Copied' : 'Copy recovery key' }}
      </button>

      <label class="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <input v-model="confirmedSaved" type="checkbox" class="mt-0.5 size-4" />
        <span>I saved the recovery key somewhere separate from this device.</span>
      </label>

      <button
        :disabled="!confirmedSaved"
        class="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        @click="continueToVault"
      >
        Continue to vault
      </button>
    </template>
  </section>
</template>

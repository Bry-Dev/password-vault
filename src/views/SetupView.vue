<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusAlert from '@/components/ui/StatusAlert.vue'
import RestoreBackupButton from '@/components/vault/RestoreBackupButton.vue'
import { useVaultStore } from '@/stores/vault'
import { masterPasswordProblem } from '@/utils/masterPassword'
import { recoveryKeysMatch } from '@/utils/recoveryKey'

const vault = useVaultStore()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')
/** 'password' → 'key' (shown) → 'confirm' (pasted back). Nothing is stored until 'confirm' succeeds. */
const step = ref<'password' | 'key' | 'confirm'>('password')
const recoveryKey = ref('')
const typedKey = ref('')
const copied = ref(false)
const copiedToClipboard = ref(false)

onMounted(async () => {
  await vault.bootstrap()
  if (vault.initialized) await router.replace('/unlock')
})

// Errors first appear on blur, then re-check on every keystroke while shown. Clearing a
// stale error only on blur shifts the button mid-tap on iPhone and swallows the tap.
function validatePassword(): boolean {
  passwordError.value = masterPasswordProblem(password.value)
  // Re-check the confirmation if the user already filled it in, so a stale mismatch message clears.
  if (confirmPassword.value) validateConfirmPassword()
  return !passwordError.value
}

function validateConfirmPassword(): boolean {
  confirmPasswordError.value = password.value !== confirmPassword.value ? 'The passwords do not match.' : ''
  return !confirmPasswordError.value
}

function choosePassword(): void {
  error.value = ''
  const passwordValid = validatePassword()
  const confirmValid = validateConfirmPassword()
  if (!passwordValid || !confirmValid) return

  recoveryKey.value = vault.newRecoveryKey()
  step.value = 'key'
}

async function copyRecoveryKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    copiedToClipboard.value = true
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = 'Copy failed. Select the key and copy it manually.'
  }
}

async function goToConfirm(): Promise<void> {
  error.value = ''
  typedKey.value = ''
  // Clear our copy from the clipboard so pasting back proves the key was saved elsewhere.
  // Best effort: iOS may refuse, which only weakens the check.
  if (copiedToClipboard.value) {
    await navigator.clipboard.writeText('').catch(() => undefined)
    copiedToClipboard.value = false
  }
  step.value = 'confirm'
}

function showKeyAgain(): void {
  error.value = ''
  step.value = 'key'
}

function startOver(): void {
  password.value = ''
  confirmPassword.value = ''
  recoveryKey.value = ''
  typedKey.value = ''
  error.value = ''
  step.value = 'password'
}

async function createVault(): Promise<void> {
  error.value = ''
  if (!recoveryKeysMatch(recoveryKey.value, typedKey.value)) {
    error.value =
      "That doesn't match your recovery key. Paste it from where you saved it, or tap \"Show the key again\"."
    return
  }

  try {
    await vault.setup(password.value, recoveryKey.value)
    password.value = ''
    confirmPassword.value = ''
    recoveryKey.value = ''
    typedKey.value = ''
    await router.replace('/vault')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to create vault.'
  }
}

async function onRestored(): Promise<void> {
  await router.replace('/vault')
}
</script>

<template>
  <section class="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <template v-if="step === 'password'">
      <p class="text-sm font-medium text-slate-500">Step 1 of 3 · First-time setup</p>
      <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Create your local vault</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Your master password is never saved. It is used only to derive a key that unlocks the vault encryption key.
      </p>

      <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

      <form class="mt-6 space-y-4" @submit.prevent="choosePassword">
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
            @input="passwordError && validatePassword()"
          />
          <p v-if="passwordError" class="mt-1 text-sm text-red-600">{{ passwordError }}</p>
          <p v-else class="mt-1 text-xs leading-5 text-slate-500">
            At least 12 characters. A few unrelated words is strong and easy to remember.
          </p>
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
            @input="confirmPasswordError && validateConfirmPassword()"
          />
          <p v-if="confirmPasswordError" class="mt-1 text-sm text-red-600">{{ confirmPasswordError }}</p>
        </div>
        <button class="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white">Next</button>
      </form>

      <div class="mt-6 border-t border-slate-200 pt-5">
        <p class="text-sm font-semibold text-slate-800">Already have a backup?</p>
        <p class="mt-1 text-xs leading-5 text-slate-500">
          Restore an encrypted .pvault file on a new device, or after this browser's data was cleared.
        </p>
        <RestoreBackupButton class="mt-3" @restored="onRestored" />
      </div>
    </template>

    <template v-else-if="step === 'key'">
      <p class="text-sm font-medium text-amber-700">Step 2 of 3 · Save this before continuing</p>
      <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Your recovery key</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        This key can unlock your vault if you forget your master password. The app does not upload or keep another copy
        for you. Save it somewhere separate from this device, such as a password manager or on paper.
      </p>

      <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

      <div class="mt-5 select-all break-all rounded-2xl border border-amber-200 bg-amber-50 p-4 font-mono text-sm text-amber-950">
        {{ recoveryKey }}
      </div>

      <button
        type="button"
        class="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700"
        @click="copyRecoveryKey"
      >
        {{ copied ? 'Copied' : 'Copy recovery key' }}
      </button>

      <button
        type="button"
        class="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
        @click="goToConfirm"
      >
        I've saved it, next
      </button>
      <p class="mt-3 text-xs leading-5 text-slate-500">
        Nothing is saved on this device until you confirm the key. If you leave now, this key is discarded and you start
        again with a new one.
      </p>
    </template>

    <template v-else>
      <p class="text-sm font-medium text-slate-500">Step 3 of 3</p>
      <h2 class="mt-1 text-2xl font-bold tracking-tight text-slate-950">Confirm your recovery key</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Paste or type the key from where you saved it. This makes sure you can find it if you ever need it.
      </p>

      <StatusAlert v-if="error" kind="error" class="mt-4">{{ error }}</StatusAlert>

      <form class="mt-5 space-y-4" @submit.prevent="createVault">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="confirm-recovery-key">Recovery key</label>
          <input
            id="confirm-recovery-key"
            v-model="typedKey"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            required
            class="w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm outline-none focus:border-slate-500"
          />
        </div>
        <button
          :disabled="vault.busy || !typedKey.trim()"
          class="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {{ vault.busy ? 'Creating encrypted vault…' : 'Create vault' }}
        </button>
      </form>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          :disabled="vault.busy"
          @click="showKeyAgain"
        >
          Show the key again
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          :disabled="vault.busy"
          @click="startOver"
        >
          Start over
        </button>
      </div>
    </template>
  </section>
</template>

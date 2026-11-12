import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { VaultEntry, VaultEntryInput } from '@/types/vault'
import { vaultService } from '@/services/vault/VaultService'
import { backupService } from '@/services/backup/BackupService'
import { requestPersistentStorage } from '@/services/storage/persistence'

export const useVaultStore = defineStore('vault', () => {
  const initialized = ref(false)
  const bootstrapped = ref(false)
  const unlocked = ref(false)
  const entries = ref<VaultEntry[]>([])
  const busy = ref(false)
  const lastBackupAt = ref<string | undefined>(undefined)

  const entryCount = computed(() => entries.value.length)

  async function bootstrap(): Promise<void> {
    if (bootstrapped.value) return
    initialized.value = await vaultService.isInitialized()
    lastBackupAt.value = await backupService.getLastBackupAt()
    bootstrapped.value = true
  }

  /** Best effort: ask the browser not to evict vault storage. Never blocks or throws. */
  function keepStorage(): void {
    void requestPersistentStorage()
  }

  async function setup(masterPassword: string): Promise<string> {
    busy.value = true
    try {
      const recoveryKey = await vaultService.setup(masterPassword)
      initialized.value = true
      unlocked.value = true
      entries.value = []
      keepStorage()
      return recoveryKey
    } finally {
      busy.value = false
    }
  }

  async function unlockWithMasterPassword(password: string): Promise<void> {
    busy.value = true
    try {
      await vaultService.unlockWithMasterPassword(password)
      unlocked.value = true
      keepStorage()
      await refreshEntries()
    } finally {
      busy.value = false
    }
  }

  async function unlockWithRecoveryKey(recoveryKey: string): Promise<void> {
    busy.value = true
    try {
      await vaultService.unlockWithRecoveryKey(recoveryKey)
      unlocked.value = true
      keepStorage()
      await refreshEntries()
    } finally {
      busy.value = false
    }
  }

  async function recoverAndResetMasterPassword(recoveryKey: string, newPassword: string): Promise<void> {
    busy.value = true
    try {
      await vaultService.recoverAndResetMasterPassword(recoveryKey, newPassword)
      unlocked.value = true
      keepStorage()
      await refreshEntries()
    } finally {
      busy.value = false
    }
  }

  function lock(): void {
    vaultService.lock()
    unlocked.value = false
    entries.value = []
  }

  async function refreshEntries(): Promise<void> {
    entries.value = await vaultService.listEntries()
  }

  async function saveEntry(input: VaultEntryInput, id?: string): Promise<void> {
    await vaultService.saveEntry(input, id)
    await refreshEntries()
  }

  async function deleteEntry(id: string): Promise<void> {
    await vaultService.deleteEntry(id)
    await refreshEntries()
  }

  async function exportBackup(): Promise<void> {
    await backupService.downloadBackup()
    lastBackupAt.value = await backupService.getLastBackupAt()
  }

  async function importBackup(file: File): Promise<void> {
    lock()
    await backupService.importBackup(file)
    initialized.value = true
    lastBackupAt.value = await backupService.getLastBackupAt()
    keepStorage()
  }

  return {
    initialized,
    bootstrapped,
    unlocked,
    entries,
    busy,
    lastBackupAt,
    entryCount,
    bootstrap,
    setup,
    unlockWithMasterPassword,
    unlockWithRecoveryKey,
    recoverAndResetMasterPassword,
    lock,
    refreshEntries,
    saveEntry,
    deleteEntry,
    exportBackup,
    importBackup,
  }
})

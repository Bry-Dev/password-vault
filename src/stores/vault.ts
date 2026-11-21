import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { VaultBackupFile, VaultEntry, VaultEntryInput } from '@/types/vault'
import { vaultService } from '@/services/vault/VaultService'
import { backupService, parseBackup } from '@/services/backup/BackupService'
import type { DeliveryResult } from '@/services/backup/deliverBackupFile'
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

  /** A fresh recovery key to show and confirm before anything is stored. */
  function newRecoveryKey(): string {
    return vaultService.newRecoveryKey()
  }

  /** Creates the vault with the master password and the recovery key the user confirmed. */
  async function setup(masterPassword: string, recoveryKey: string): Promise<void> {
    busy.value = true
    try {
      await vaultService.setup(masterPassword, recoveryKey)
      initialized.value = true
      unlocked.value = true
      entries.value = []
      keepStorage()
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

  /** Returns 'cancelled' when the user dismissed the share sheet; that is not an error. */
  async function exportBackup(): Promise<DeliveryResult> {
    const result = await backupService.exportBackup()
    lastBackupAt.value = await backupService.getLastBackupAt()
    return result
  }

  /** Parses and structure-checks a backup file. Nothing is decrypted or stored yet. */
  async function readBackupFile(file: File): Promise<VaultBackupFile> {
    return parseBackup(await file.text())
  }

  /** Number of encrypted entries on this device; readable while locked. */
  async function storedEntryCount(): Promise<number> {
    return vaultService.storedEntryCount()
  }

  /**
   * Replaces the device vault with `backup` once `secret` is proven to open it.
   * On failure nothing changes, including the current lock state.
   */
  async function restoreBackup(backup: VaultBackupFile, secret: string): Promise<void> {
    busy.value = true
    try {
      await vaultService.restoreBackup(backup, secret)
      initialized.value = true
      unlocked.value = true
      await refreshEntries()
      lastBackupAt.value = await backupService.getLastBackupAt()
      keepStorage()
    } finally {
      busy.value = false
    }
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
    newRecoveryKey,
    setup,
    unlockWithMasterPassword,
    unlockWithRecoveryKey,
    recoverAndResetMasterPassword,
    lock,
    refreshEntries,
    saveEntry,
    deleteEntry,
    exportBackup,
    readBackupFile,
    storedEntryCount,
    restoreBackup,
  }
})

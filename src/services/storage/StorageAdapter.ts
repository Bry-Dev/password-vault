import type { StoredVaultEntry, VaultBackupFile, VaultMetadata } from '@/types/vault'

export interface StorageAdapter {
  hasVault(): Promise<boolean>
  getMetadata(): Promise<VaultMetadata | undefined>
  setMetadata(metadata: VaultMetadata): Promise<void>
  listEntries(): Promise<StoredVaultEntry[]>
  putEntry(entry: StoredVaultEntry): Promise<void>
  deleteEntry(id: string): Promise<void>
  clearEntries(): Promise<void>
  replaceFromBackup(backup: VaultBackupFile): Promise<void>
  /** Non-secret: ISO timestamp of the last export or restored backup. */
  getLastBackupAt(): Promise<string | undefined>
  setLastBackupAt(isoTimestamp: string): Promise<void>
}

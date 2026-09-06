import type { StorageAdapter } from '@/services/storage/StorageAdapter'
import type { StoredVaultEntry, VaultBackupFile, VaultMetadata } from '@/types/vault'

/**
 * In-memory StorageAdapter for tests, so vault/crypto behavior can be verified
 * without a real IndexedDB implementation.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private metadata: VaultMetadata | undefined
  private entries = new Map<string, StoredVaultEntry>()

  async hasVault(): Promise<boolean> {
    return this.metadata !== undefined
  }

  async getMetadata(): Promise<VaultMetadata | undefined> {
    return this.metadata
  }

  async setMetadata(metadata: VaultMetadata): Promise<void> {
    this.metadata = metadata
  }

  async listEntries(): Promise<StoredVaultEntry[]> {
    return [...this.entries.values()]
  }

  async putEntry(entry: StoredVaultEntry): Promise<void> {
    this.entries.set(entry.id, entry)
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id)
  }

  async clearEntries(): Promise<void> {
    this.entries.clear()
  }

  async replaceFromBackup(backup: VaultBackupFile): Promise<void> {
    this.metadata = backup.metadata
    this.entries = new Map(backup.entries.map((entry) => [entry.id, entry]))
  }
}

import type { StorageAdapter } from '@/services/storage/StorageAdapter'
import type { StoredVaultEntry, VaultBackupFile, VaultMetadata } from '@/types/vault'

/**
 * In-memory StorageAdapter for tests, so vault/crypto behavior can be verified
 * without a real IndexedDB implementation. Writes are structured-cloned like
 * IndexedDB does, so data that IndexedDB cannot store (e.g. Vue proxies) fails here too.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private metadata: VaultMetadata | undefined
  private entries = new Map<string, StoredVaultEntry>()
  private lastBackupAt: string | undefined

  async hasVault(): Promise<boolean> {
    return this.metadata !== undefined
  }

  async getMetadata(): Promise<VaultMetadata | undefined> {
    return this.metadata
  }

  async setMetadata(metadata: VaultMetadata): Promise<void> {
    this.metadata = structuredClone(metadata)
  }

  async listEntries(): Promise<StoredVaultEntry[]> {
    return [...this.entries.values()]
  }

  async putEntry(entry: StoredVaultEntry): Promise<void> {
    this.entries.set(entry.id, structuredClone(entry))
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id)
  }

  async clearEntries(): Promise<void> {
    this.entries.clear()
  }

  async replaceFromBackup(backup: VaultBackupFile): Promise<void> {
    const copy = structuredClone(backup)
    this.metadata = copy.metadata
    this.entries = new Map(copy.entries.map((entry) => [entry.id, entry]))
  }

  async getLastBackupAt(): Promise<string | undefined> {
    return this.lastBackupAt
  }

  async setLastBackupAt(isoTimestamp: string): Promise<void> {
    this.lastBackupAt = isoTimestamp
  }
}

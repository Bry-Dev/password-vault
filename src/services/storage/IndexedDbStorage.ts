import Dexie, { type EntityTable } from 'dexie'
import type { StoredVaultEntry, VaultBackupFile, VaultMetadata } from '@/types/vault'
import type { StorageAdapter } from './StorageAdapter'

class VaultDatabase extends Dexie {
  metadata!: EntityTable<VaultMetadata, 'id'>
  entries!: EntityTable<StoredVaultEntry, 'id'>

  constructor() {
    super('local-password-vault')
    this.version(1).stores({
      metadata: 'id',
      entries: 'id, updatedAt',
    })
  }
}

const db = new VaultDatabase()

class IndexedDbStorage implements StorageAdapter {
  async hasVault(): Promise<boolean> {
    return Boolean(await db.metadata.get('primary'))
  }

  async getMetadata(): Promise<VaultMetadata | undefined> {
    return db.metadata.get('primary')
  }

  async setMetadata(metadata: VaultMetadata): Promise<void> {
    await db.metadata.put(metadata)
  }

  async listEntries(): Promise<StoredVaultEntry[]> {
    return db.entries.toArray()
  }

  async putEntry(entry: StoredVaultEntry): Promise<void> {
    await db.entries.put(entry)
  }

  async deleteEntry(id: string): Promise<void> {
    await db.entries.delete(id)
  }

  async clearEntries(): Promise<void> {
    await db.entries.clear()
  }

  async replaceFromBackup(backup: VaultBackupFile): Promise<void> {
    await db.transaction('rw', db.metadata, db.entries, async () => {
      await db.metadata.clear()
      await db.entries.clear()
      await db.metadata.put(backup.metadata)
      await db.entries.bulkPut(backup.entries)
    })
  }
}

export const indexedDbStorage = new IndexedDbStorage()

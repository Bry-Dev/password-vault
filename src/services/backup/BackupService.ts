import type { VaultBackupFile } from '@/types/vault'
import type { StorageAdapter } from '@/services/storage/StorageAdapter'
import { indexedDbStorage } from '@/services/storage/IndexedDbStorage'
import { localDateStamp } from '@/utils/dateStamp'

const UNSUPPORTED_FILE = 'This file is not a supported Local Vault backup.'

function parseBackup(text: string): VaultBackupFile {
  let parsed: Partial<VaultBackupFile>
  try {
    parsed = JSON.parse(text) as Partial<VaultBackupFile>
  } catch {
    throw new Error(UNSUPPORTED_FILE)
  }

  if (
    !parsed ||
    parsed.format !== 'local-password-vault' ||
    parsed.version !== 1 ||
    !parsed.metadata ||
    parsed.metadata.id !== 'primary' ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error(UNSUPPORTED_FILE)
  }

  return parsed as VaultBackupFile
}

export class BackupService {
  constructor(private readonly storage: StorageAdapter) {}

  async createBackup(): Promise<VaultBackupFile> {
    const metadata = await this.storage.getMetadata()
    if (!metadata) throw new Error('No vault exists on this device.')

    return {
      format: 'local-password-vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      metadata,
      entries: await this.storage.listEntries(),
    }
  }

  async downloadBackup(): Promise<void> {
    const backup = await this.createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `local-vault-${localDateStamp(new Date(backup.exportedAt))}.pvault`
    anchor.click()
    // Revoking synchronously can cancel the download in Safari; give it time to start.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    await this.storage.setLastBackupAt(backup.exportedAt)
  }

  /** Replaces the local vault with the backup. Works on an empty (new or wiped) device. */
  async restoreFromText(text: string): Promise<void> {
    const backup = parseBackup(text)
    await this.storage.replaceFromBackup(backup)
    await this.storage.setLastBackupAt(backup.exportedAt)
  }

  async importBackup(file: File): Promise<void> {
    await this.restoreFromText(await file.text())
  }

  async getLastBackupAt(): Promise<string | undefined> {
    return this.storage.getLastBackupAt()
  }
}

export const backupService = new BackupService(indexedDbStorage)

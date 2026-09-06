import type { VaultBackupFile } from '@/types/vault'
import { indexedDbStorage } from '@/services/storage/IndexedDbStorage'

class BackupService {
  async createBackup(): Promise<VaultBackupFile> {
    const metadata = await indexedDbStorage.getMetadata()
    if (!metadata) throw new Error('No vault exists on this device.')

    return {
      format: 'local-password-vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      metadata,
      entries: await indexedDbStorage.listEntries(),
    }
  }

  async downloadBackup(): Promise<void> {
    const backup = await this.createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `local-vault-${new Date().toISOString().slice(0, 10)}.pvault`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async importBackup(file: File): Promise<void> {
    const parsed = JSON.parse(await file.text()) as Partial<VaultBackupFile>

    if (
      parsed.format !== 'local-password-vault' ||
      parsed.version !== 1 ||
      !parsed.metadata ||
      !Array.isArray(parsed.entries)
    ) {
      throw new Error('This file is not a supported Local Vault backup.')
    }

    await indexedDbStorage.replaceFromBackup(parsed as VaultBackupFile)
  }
}

export const backupService = new BackupService()

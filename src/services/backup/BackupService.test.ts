import { beforeEach, describe, expect, it } from 'vitest'
import { BackupService } from './BackupService'
import { VaultService } from '@/services/vault/VaultService'
import { InMemoryStorageAdapter } from '@/test/fakeStorageAdapter'

const MASTER_PASSWORD = 'correct-horse-battery-staple-1'
const ENTRY = { title: 'Example', username: 'user', password: 's3cr3t-value', url: '', notes: '' }

describe('BackupService', () => {
  let sourceStorage: InMemoryStorageAdapter
  let recoveryKey: string

  beforeEach(async () => {
    sourceStorage = new InMemoryStorageAdapter()
    const sourceVault = new VaultService(sourceStorage)
    recoveryKey = await sourceVault.setup(MASTER_PASSWORD)
    await sourceVault.saveEntry(ENTRY)
  })

  async function exportedText(): Promise<string> {
    return JSON.stringify(await new BackupService(sourceStorage).createBackup())
  }

  it('does not include plaintext entry values in the backup', async () => {
    const text = await exportedText()
    expect(text).not.toContain(ENTRY.password)
    expect(text).not.toContain(MASTER_PASSWORD)
    expect(text).not.toContain(recoveryKey)
  })

  it('restores onto an empty device and unlocks with the master password', async () => {
    const freshStorage = new InMemoryStorageAdapter()
    await new BackupService(freshStorage).restoreFromText(await exportedText())

    const vault = new VaultService(freshStorage)
    expect(await vault.isInitialized()).toBe(true)
    await vault.unlockWithMasterPassword(MASTER_PASSWORD)
    const entries = await vault.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].password).toBe(ENTRY.password)
  })

  it('restores onto an empty device and unlocks with the recovery key', async () => {
    const freshStorage = new InMemoryStorageAdapter()
    await new BackupService(freshStorage).restoreFromText(await exportedText())

    const vault = new VaultService(freshStorage)
    await vault.unlockWithRecoveryKey(recoveryKey)
    expect((await vault.listEntries())[0].title).toBe(ENTRY.title)
  })

  it('records the restored backup date as the last backup', async () => {
    const text = await exportedText()
    const freshStorage = new InMemoryStorageAdapter()
    const backups = new BackupService(freshStorage)

    expect(await backups.getLastBackupAt()).toBeUndefined()
    await backups.restoreFromText(text)
    expect(await backups.getLastBackupAt()).toBe(JSON.parse(text).exportedAt)
  })

  it('rejects a file that is not JSON without touching storage', async () => {
    const freshStorage = new InMemoryStorageAdapter()
    await expect(new BackupService(freshStorage).restoreFromText('not json')).rejects.toThrow(
      'This file is not a supported Local Vault backup.',
    )
    expect(await freshStorage.hasVault()).toBe(false)
  })

  it('rejects JSON in the wrong format without touching storage', async () => {
    const freshStorage = new InMemoryStorageAdapter()
    const wrong = JSON.stringify({ format: 'something-else', version: 1, metadata: {}, entries: [] })
    await expect(new BackupService(freshStorage).restoreFromText(wrong)).rejects.toThrow(
      'This file is not a supported Local Vault backup.',
    )
    expect(await freshStorage.hasVault()).toBe(false)
  })

  it('refuses to create a backup when no vault exists', async () => {
    await expect(new BackupService(new InMemoryStorageAdapter()).createBackup()).rejects.toThrow(
      'No vault exists on this device.',
    )
  })
})

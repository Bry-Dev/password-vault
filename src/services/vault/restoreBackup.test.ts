import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { VaultService } from './VaultService'
import { BackupService } from '@/services/backup/BackupService'
import { InMemoryStorageAdapter } from '@/test/fakeStorageAdapter'
import type { VaultBackupFile } from '@/types/vault'

const BACKUP_PASSWORD = 'correct-horse-battery-staple-1'
const DEVICE_PASSWORD = 'device-vault-password-2'
const ENTRY = { title: 'Example', username: 'user', password: 's3cr3t-value', url: '', notes: '' }
const WRONG_SECRET = 'That master password or recovery key does not open this backup. Nothing was changed.'
const DAMAGED = 'This backup is damaged and cannot be restored. Nothing was changed.'

describe('VaultService.restoreBackup', () => {
  let backup: VaultBackupFile
  let recoveryKey: string

  beforeAll(async () => {
    const source = new InMemoryStorageAdapter()
    const sourceVault = new VaultService(source)
    recoveryKey = await sourceVault.setup(BACKUP_PASSWORD)
    await sourceVault.saveEntry(ENTRY)
    backup = await new BackupService(source).createBackup()
  })

  let storage: InMemoryStorageAdapter
  let vault: VaultService

  beforeEach(() => {
    storage = new InMemoryStorageAdapter()
    vault = new VaultService(storage)
  })

  /** Gives the device its own vault with one entry, then locks it. */
  async function existingDeviceVault(): Promise<void> {
    await vault.setup(DEVICE_PASSWORD)
    await vault.saveEntry({ ...ENTRY, title: 'On device' })
    vault.lock()
  }

  it('restores onto an empty device with the master password and leaves it unlocked', async () => {
    await vault.restoreBackup(backup, BACKUP_PASSWORD)

    expect(vault.isUnlocked()).toBe(true)
    const entries = await vault.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].password).toBe(ENTRY.password)
  })

  it('restores a backup held in Vue reactive state', async () => {
    await vault.restoreBackup(reactive(structuredClone(backup)), BACKUP_PASSWORD)
    expect((await vault.listEntries())[0].title).toBe(ENTRY.title)
  })

  it('restores with the recovery key', async () => {
    await vault.restoreBackup(backup, recoveryKey)
    expect((await vault.listEntries())[0].title).toBe(ENTRY.title)
  })

  it('accepts the recovery key with surrounding whitespace', async () => {
    await vault.restoreBackup(backup, `  ${recoveryKey}\n`)
    expect(vault.isUnlocked()).toBe(true)
  })

  it('the restored vault still opens with the backup master password later', async () => {
    await vault.restoreBackup(backup, recoveryKey)
    vault.lock()
    await vault.unlockWithMasterPassword(BACKUP_PASSWORD)
    expect(await vault.listEntries()).toHaveLength(1)
  })

  it('records the backup export date as the last backup', async () => {
    await vault.restoreBackup(backup, BACKUP_PASSWORD)
    expect(await storage.getLastBackupAt()).toBe(backup.exportedAt)
  })

  it('leaves the existing vault untouched when the secret is wrong', async () => {
    await existingDeviceVault()
    const metadataBefore = structuredClone(await storage.getMetadata())

    await expect(vault.restoreBackup(backup, 'not-the-right-password')).rejects.toThrow(WRONG_SECRET)

    expect(await storage.getMetadata()).toEqual(metadataBefore)
    expect(await storage.listEntries()).toHaveLength(1)
    expect(await storage.getLastBackupAt()).toBeUndefined()
    expect(vault.isUnlocked()).toBe(false)
    await vault.unlockWithMasterPassword(DEVICE_PASSWORD)
    expect((await vault.listEntries())[0].title).toBe('On device')
  })

  it('rejects the device vault password when it is not the backup password', async () => {
    await existingDeviceVault()
    await expect(vault.restoreBackup(backup, DEVICE_PASSWORD)).rejects.toThrow(WRONG_SECRET)
  })

  it('leaves the existing vault untouched when an entry is damaged', async () => {
    await existingDeviceVault()
    const damaged = structuredClone(backup)
    const ciphertext = damaged.entries[0].payload.ciphertext
    damaged.entries[0].payload.ciphertext = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)

    await expect(vault.restoreBackup(damaged, BACKUP_PASSWORD)).rejects.toThrow(DAMAGED)

    expect(await storage.listEntries()).toHaveLength(1)
    await vault.unlockWithMasterPassword(DEVICE_PASSWORD)
    expect((await vault.listEntries())[0].title).toBe('On device')
  })

  it('rejects an entry moved under a different id', async () => {
    const swapped = structuredClone(backup)
    swapped.entries[0].id = 'some-other-id'

    await expect(vault.restoreBackup(swapped, BACKUP_PASSWORD)).rejects.toThrow(DAMAGED)
    expect(await storage.hasVault()).toBe(false)
  })
})

describe('VaultService.storedEntryCount', () => {
  it('counts stored entries without unlocking', async () => {
    const storage = new InMemoryStorageAdapter()
    const vault = new VaultService(storage)
    await vault.setup(DEVICE_PASSWORD)
    await vault.saveEntry(ENTRY)
    await vault.saveEntry({ ...ENTRY, title: 'Second' })
    vault.lock()

    expect(await vault.storedEntryCount()).toBe(2)
  })

  it('is zero when there is no vault', async () => {
    expect(await new VaultService(new InMemoryStorageAdapter()).storedEntryCount()).toBe(0)
  })
})

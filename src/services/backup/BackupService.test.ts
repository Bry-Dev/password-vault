import { beforeAll, describe, expect, it } from 'vitest'
import { BackupService, parseBackup } from './BackupService'
import { VaultService } from '@/services/vault/VaultService'
import { InMemoryStorageAdapter } from '@/test/fakeStorageAdapter'
import type { VaultBackupFile } from '@/types/vault'
import type { DeliveryPlatform } from './deliverBackupFile'

const MASTER_PASSWORD = 'correct-horse-battery-staple-1'
const ENTRY = { title: 'Example', username: 'user', password: 's3cr3t-value', url: '', notes: '' }
const UNSUPPORTED = 'This file is not a supported Local Vault backup.'
const NEWER = 'This backup was created by a newer version of the app.'

describe('BackupService', () => {
  let sourceStorage: InMemoryStorageAdapter
  let recoveryKey: string
  let validText: string

  beforeAll(async () => {
    sourceStorage = new InMemoryStorageAdapter()
    const sourceVault = new VaultService(sourceStorage)
    recoveryKey = await sourceVault.setup(MASTER_PASSWORD)
    await sourceVault.saveEntry(ENTRY)
    validText = JSON.stringify(await new BackupService(sourceStorage).createBackup())
  })

  /** A deep copy of the valid backup, changed by `mutate`, as JSON text. */
  function variant(mutate: (backup: VaultBackupFile & Record<string, unknown>) => void): string {
    const backup = JSON.parse(validText)
    mutate(backup)
    return JSON.stringify(backup)
  }

  it('does not include plaintext entry values in the backup', () => {
    expect(validText).not.toContain(ENTRY.password)
    expect(validText).not.toContain(MASTER_PASSWORD)
    expect(validText).not.toContain(recoveryKey)
  })

  it('refuses to create a backup when no vault exists', async () => {
    await expect(new BackupService(new InMemoryStorageAdapter()).createBackup()).rejects.toThrow(
      'No vault exists on this device.',
    )
  })

  describe('exportBackup', () => {
    function platform(result: 'share' | 'cancel' | 'desktop') {
      const delivered: File[] = []
      const p: DeliveryPlatform = {
        prefersShare: () => result !== 'desktop',
        canShareFiles: () => true,
        share: async (data) => {
          if (result === 'cancel') throw new DOMException('dismissed', 'AbortError')
          delivered.push(...(data.files ?? []))
        },
        download: (file) => delivered.push(file),
      }
      return { p, delivered }
    }

    it('delivers a dated .pvault file containing the encrypted backup', async () => {
      const { p, delivered } = platform('share')
      expect(await new BackupService(sourceStorage).exportBackup(p)).toBe('shared')

      expect(delivered).toHaveLength(1)
      expect(delivered[0].name).toMatch(/^local-vault-\d{4}-\d{2}-\d{2}\.pvault$/)
      const restored = parseBackup(await delivered[0].text())
      expect(restored.entries).toHaveLength(1)
      expect(await delivered[0].text()).not.toContain(ENTRY.password)
    })

    it('records the export as the last backup when shared or downloaded', async () => {
      for (const mode of ['share', 'desktop'] as const) {
        const storage = new InMemoryStorageAdapter()
        await new VaultService(storage).setup(MASTER_PASSWORD)
        const backups = new BackupService(storage)

        await backups.exportBackup(platform(mode).p)
        expect(await backups.getLastBackupAt()).toBeDefined()
      }
    })

    it('does not record a backup when the share sheet is dismissed', async () => {
      const storage = new InMemoryStorageAdapter()
      await new VaultService(storage).setup(MASTER_PASSWORD)
      const backups = new BackupService(storage)

      expect(await backups.exportBackup(platform('cancel').p)).toBe('cancelled')
      expect(await backups.getLastBackupAt()).toBeUndefined()
    })
  })

  describe('parseBackup', () => {
    it('accepts a backup it created', () => {
      expect(parseBackup(validText)).toEqual(JSON.parse(validText))
    })

    it('rejects a file that is not JSON', () => {
      expect(() => parseBackup('not json')).toThrow(UNSUPPORTED)
    })

    it('rejects JSON in the wrong format', () => {
      expect(() => parseBackup(variant((b) => (b.format = 'something-else' as never)))).toThrow(UNSUPPORTED)
    })

    it('rejects a backup file version newer than this app', () => {
      expect(() => parseBackup(variant((b) => (b.version = 2 as never)))).toThrow(NEWER)
    })

    it('rejects vault metadata newer than this app', () => {
      expect(() => parseBackup(variant((b) => (b.metadata.version = 2 as never)))).toThrow(NEWER)
    })

    it('rejects an entry without an IV', () => {
      const text = variant((b) => delete (b.entries[0].payload as Partial<{ iv: string }>).iv)
      expect(() => parseBackup(text)).toThrow(UNSUPPORTED)
    })

    it('rejects an entry without timestamps', () => {
      const text = variant((b) => delete (b.entries[0] as Partial<{ updatedAt: string }>).updatedAt)
      expect(() => parseBackup(text)).toThrow(UNSUPPORTED)
    })

    it('rejects duplicate entry ids', () => {
      const text = variant((b) => b.entries.push({ ...b.entries[0] }))
      expect(() => parseBackup(text)).toThrow(UNSUPPORTED)
    })

    it('rejects metadata without a master-wrapped key', () => {
      const text = variant((b) => delete (b.metadata as Partial<VaultBackupFile['metadata']>).masterWrappedDek)
      expect(() => parseBackup(text)).toThrow(UNSUPPORTED)
    })

    it('rejects unusable KDF iterations', () => {
      expect(() => parseBackup(variant((b) => (b.metadata.kdf.iterations = 0)))).toThrow(UNSUPPORTED)
      expect(() => parseBackup(variant((b) => (b.metadata.kdf.iterations = 1.5)))).toThrow(UNSUPPORTED)
      // A crafted file must not be able to freeze the device during the password check.
      expect(() => parseBackup(variant((b) => (b.metadata.kdf.iterations = 1e12)))).toThrow(UNSUPPORTED)
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from './VaultService'
import { InMemoryStorageAdapter } from '@/test/fakeStorageAdapter'

const MASTER_PASSWORD = 'correct-horse-battery-staple-1'
const OTHER_PASSWORD = 'wrong-horse-battery-staple-2'
const ENTRY = { title: 'Example', username: 'user', password: 's3cr3t-value', url: '', notes: '' }

describe('VaultService', () => {
  let storage: InMemoryStorageAdapter
  let vault: VaultService

  beforeEach(() => {
    storage = new InMemoryStorageAdapter()
    vault = new VaultService(storage)
  })

  it('round-trips a saved entry through encrypt/decrypt', async () => {
    await vault.setup(MASTER_PASSWORD)
    await vault.saveEntry(ENTRY)

    const entries = await vault.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].password).toBe(ENTRY.password)
  })

  it('rejects an incorrect master password', async () => {
    await vault.setup(MASTER_PASSWORD)
    vault.lock()

    await expect(vault.unlockWithMasterPassword(OTHER_PASSWORD)).rejects.toThrow('Incorrect master password.')
  })

  it('unlocks with a valid recovery key', async () => {
    const recoveryKey = await vault.setup(MASTER_PASSWORD)
    vault.lock()

    await vault.unlockWithRecoveryKey(recoveryKey)
    expect(vault.isUnlocked()).toBe(true)
  })

  it('rejects an invalid recovery key', async () => {
    await vault.setup(MASTER_PASSWORD)
    vault.lock()

    await expect(vault.unlockWithRecoveryKey('not-a-real-recovery-key')).rejects.toThrow('Invalid recovery key.')
  })

  it('preserves vault data across a master password change', async () => {
    await vault.setup(MASTER_PASSWORD)
    await vault.saveEntry(ENTRY)
    await vault.changeMasterPassword(MASTER_PASSWORD, OTHER_PASSWORD)

    vault.lock()
    await vault.unlockWithMasterPassword(OTHER_PASSWORD)
    const entries = await vault.listEntries()
    expect(entries[0].password).toBe(ENTRY.password)

    await expect(vault.unlockWithMasterPassword(MASTER_PASSWORD)).rejects.toThrow('Incorrect master password.')
  })

  it('never persists the plaintext password in storage', async () => {
    await vault.setup(MASTER_PASSWORD)
    await vault.saveEntry(ENTRY)

    const [stored] = await storage.listEntries()
    expect(JSON.stringify(stored)).not.toContain(ENTRY.password)
  })

  it('clears decrypted state on lock', async () => {
    await vault.setup(MASTER_PASSWORD)
    await vault.saveEntry(ENTRY)

    vault.lock()

    expect(vault.isUnlocked()).toBe(false)
    await expect(vault.listEntries()).rejects.toThrow('Vault is locked.')
  })
})

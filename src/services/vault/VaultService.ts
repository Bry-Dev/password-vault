import type {
  StoredVaultEntry,
  VaultEntry,
  VaultEntryInput,
  VaultMetadata,
} from '@/types/vault'
import { bytesToBase64Url, base64UrlToBytes } from '@/utils/encoding'
import { cryptoService, MASTER_KDF_ITERATIONS } from '@/services/crypto/CryptoService'
import type { StorageAdapter } from '@/services/storage/StorageAdapter'
import { indexedDbStorage } from '@/services/storage/IndexedDbStorage'

const MASTER_WRAP_AAD = 'local-password-vault:master-wrap:v1'
const RECOVERY_WRAP_AAD = 'local-password-vault:recovery-wrap:v1'
const entryAad = (id: string) => `local-password-vault:entry:${id}:v1`

class VaultService {
  private dek: CryptoKey | null = null

  constructor(private readonly storage: StorageAdapter) {}

  async isInitialized(): Promise<boolean> {
    return this.storage.hasVault()
  }

  isUnlocked(): boolean {
    return this.dek !== null
  }

  async setup(masterPassword: string): Promise<string> {
    if (await this.storage.hasVault()) {
      throw new Error('A vault already exists on this device.')
    }

    const salt = cryptoService.randomSalt()
    const dekBytes = cryptoService.generateDekBytes()
    const recoveryKey = cryptoService.generateRecoveryKey()

    const masterKey = await cryptoService.deriveMasterKey(
      masterPassword,
      salt,
      MASTER_KDF_ITERATIONS,
    )
    const recoveryAesKey = await cryptoService.recoveryKeyToAesKey(recoveryKey)

    const masterWrappedDek = await cryptoService.encryptBytes(masterKey, dekBytes, MASTER_WRAP_AAD)
    const recoveryWrappedDek = await cryptoService.encryptBytes(
      recoveryAesKey,
      dekBytes,
      RECOVERY_WRAP_AAD,
    )

    const now = new Date().toISOString()
    const metadata: VaultMetadata = {
      id: 'primary',
      version: 1,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: MASTER_KDF_ITERATIONS,
        salt: bytesToBase64Url(salt),
      },
      masterWrappedDek,
      recoveryWrappedDek,
      createdAt: now,
      updatedAt: now,
    }

    await this.storage.setMetadata(metadata)
    this.dek = await cryptoService.importAesKey(dekBytes)
    dekBytes.fill(0)

    return recoveryKey
  }

  async unlockWithMasterPassword(masterPassword: string): Promise<void> {
    const metadata = await this.requireMetadata()
    try {
      const masterKey = await cryptoService.deriveMasterKey(
        masterPassword,
        base64UrlToBytes(metadata.kdf.salt),
        metadata.kdf.iterations,
      )
      const dekBytes = await cryptoService.decryptBytes(
        masterKey,
        metadata.masterWrappedDek,
        MASTER_WRAP_AAD,
      )
      this.dek = await cryptoService.importAesKey(dekBytes)
      dekBytes.fill(0)
    } catch {
      throw new Error('Incorrect master password.')
    }
  }

  async unlockWithRecoveryKey(recoveryKey: string): Promise<void> {
    const metadata = await this.requireMetadata()
    try {
      const key = await cryptoService.recoveryKeyToAesKey(recoveryKey)
      const dekBytes = await cryptoService.decryptBytes(
        key,
        metadata.recoveryWrappedDek,
        RECOVERY_WRAP_AAD,
      )
      this.dek = await cryptoService.importAesKey(dekBytes)
      dekBytes.fill(0)
    } catch {
      throw new Error('Invalid recovery key.')
    }
  }


  async recoverAndResetMasterPassword(recoveryKey: string, newPassword: string): Promise<void> {
    const metadata = await this.requireMetadata()

    try {
      const recoveryAesKey = await cryptoService.recoveryKeyToAesKey(recoveryKey)
      const dekBytes = await cryptoService.decryptBytes(
        recoveryAesKey,
        metadata.recoveryWrappedDek,
        RECOVERY_WRAP_AAD,
      )

      const newSalt = cryptoService.randomSalt()
      const newMasterKey = await cryptoService.deriveMasterKey(
        newPassword,
        newSalt,
        MASTER_KDF_ITERATIONS,
      )

      metadata.kdf = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: MASTER_KDF_ITERATIONS,
        salt: bytesToBase64Url(newSalt),
      }
      metadata.masterWrappedDek = await cryptoService.encryptBytes(
        newMasterKey,
        dekBytes,
        MASTER_WRAP_AAD,
      )
      metadata.updatedAt = new Date().toISOString()

      await this.storage.setMetadata(metadata)
      this.dek = await cryptoService.importAesKey(dekBytes)
      dekBytes.fill(0)
    } catch {
      throw new Error('Invalid recovery key.')
    }
  }

  lock(): void {
    this.dek = null
  }

  async listEntries(): Promise<VaultEntry[]> {
    const dek = this.requireDek()
    const storedEntries = await this.storage.listEntries()

    const entries = await Promise.all(
      storedEntries.map((entry) =>
        cryptoService.decryptJson<VaultEntry>(dek, entry.payload, entryAad(entry.id)),
      ),
    )

    return entries.sort((a, b) => a.title.localeCompare(b.title))
  }

  async saveEntry(input: VaultEntryInput, id?: string): Promise<VaultEntry> {
    const dek = this.requireDek()
    const now = new Date().toISOString()
    const entryId = id ?? crypto.randomUUID()

    let createdAt = now
    if (id) {
      const existing = (await this.listEntries()).find((entry) => entry.id === id)
      if (existing) createdAt = existing.createdAt
    }

    const entry: VaultEntry = {
      id: entryId,
      ...input,
      createdAt,
      updatedAt: now,
    }

    const stored: StoredVaultEntry = {
      id: entry.id,
      payload: await cryptoService.encryptJson(dek, entry, entryAad(entry.id)),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }

    await this.storage.putEntry(stored)
    return entry
  }

  async deleteEntry(id: string): Promise<void> {
    this.requireDek()
    await this.storage.deleteEntry(id)
  }

  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    const metadata = await this.requireMetadata()

    await this.unlockWithMasterPassword(currentPassword)
    const dek = this.requireDek()

    // Re-wrapping requires temporary access to the raw DEK, so unwrap from the existing master wrapper.
    const oldMasterKey = await cryptoService.deriveMasterKey(
      currentPassword,
      base64UrlToBytes(metadata.kdf.salt),
      metadata.kdf.iterations,
    )
    const dekBytes = await cryptoService.decryptBytes(
      oldMasterKey,
      metadata.masterWrappedDek,
      MASTER_WRAP_AAD,
    )

    const newSalt = cryptoService.randomSalt()
    const newMasterKey = await cryptoService.deriveMasterKey(
      newPassword,
      newSalt,
      MASTER_KDF_ITERATIONS,
    )

    metadata.kdf = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: MASTER_KDF_ITERATIONS,
      salt: bytesToBase64Url(newSalt),
    }
    metadata.masterWrappedDek = await cryptoService.encryptBytes(
      newMasterKey,
      dekBytes,
      MASTER_WRAP_AAD,
    )
    metadata.updatedAt = new Date().toISOString()

    await this.storage.setMetadata(metadata)
    dekBytes.fill(0)
    void dek
  }

  private async requireMetadata(): Promise<VaultMetadata> {
    const metadata = await this.storage.getMetadata()
    if (!metadata) throw new Error('No vault exists on this device.')
    return metadata
  }

  private requireDek(): CryptoKey {
    if (!this.dek) throw new Error('Vault is locked.')
    return this.dek
  }
}

export const vaultService = new VaultService(indexedDbStorage)

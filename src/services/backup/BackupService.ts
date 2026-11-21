import type { VaultBackupFile } from '@/types/vault'
import type { StorageAdapter } from '@/services/storage/StorageAdapter'
import { indexedDbStorage } from '@/services/storage/IndexedDbStorage'
import { localDateStamp } from '@/utils/dateStamp'
import {
  browserPlatform,
  deliverBackupFile,
  type DeliveryPlatform,
  type DeliveryResult,
} from './deliverBackupFile'

export const CURRENT_BACKUP_VERSION = 1
export const CURRENT_METADATA_VERSION = 1

const UNSUPPORTED_FILE = 'This file is not a supported Local Vault backup.'
const NEWER_VERSION =
  'This backup was created by a newer version of the app. Update the app, then try again.'

/** Upper bound so a crafted file cannot freeze the device during the password check. */
const MAX_KDF_ITERATIONS = 10_000_000

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isBlob = (value: unknown): boolean => isObject(value) && isText(value.iv) && isText(value.ciphertext)

function isMetadata(value: unknown): boolean {
  if (!isObject(value) || value.id !== 'primary' || value.version !== CURRENT_METADATA_VERSION) return false
  const kdf = value.kdf
  return (
    isObject(kdf) &&
    kdf.name === 'PBKDF2' &&
    kdf.hash === 'SHA-256' &&
    Number.isSafeInteger(kdf.iterations) &&
    (kdf.iterations as number) > 0 &&
    (kdf.iterations as number) <= MAX_KDF_ITERATIONS &&
    isText(kdf.salt) &&
    isBlob(value.masterWrappedDek) &&
    isBlob(value.recoveryWrappedDek) &&
    isText(value.createdAt) &&
    isText(value.updatedAt)
  )
}

const isEntry = (value: unknown): boolean =>
  isObject(value) && isText(value.id) && isBlob(value.payload) && isText(value.createdAt) && isText(value.updatedAt)

const isNewer = (version: unknown, current: number): boolean => typeof version === 'number' && version > current

/**
 * Parses and strictly checks a backup file's structure. It does not decrypt anything;
 * `VaultService.restoreBackup` proves the secret and ciphertext before storage is touched.
 */
export function parseBackup(text: string): VaultBackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(UNSUPPORTED_FILE)
  }

  if (!isObject(parsed) || parsed.format !== 'local-password-vault') throw new Error(UNSUPPORTED_FILE)
  if (
    isNewer(parsed.version, CURRENT_BACKUP_VERSION) ||
    (isObject(parsed.metadata) && isNewer(parsed.metadata.version, CURRENT_METADATA_VERSION))
  ) {
    throw new Error(NEWER_VERSION)
  }

  const entries = parsed.entries
  if (
    parsed.version !== CURRENT_BACKUP_VERSION ||
    !isText(parsed.exportedAt) ||
    !isMetadata(parsed.metadata) ||
    !Array.isArray(entries) ||
    !entries.every(isEntry) ||
    new Set(entries.map((entry: Json) => entry.id)).size !== entries.length
  ) {
    throw new Error(UNSUPPORTED_FILE)
  }

  return parsed as unknown as VaultBackupFile
}

export class BackupService {
  constructor(private readonly storage: StorageAdapter) {}

  async createBackup(): Promise<VaultBackupFile> {
    const metadata = await this.storage.getMetadata()
    if (!metadata) throw new Error('No vault exists on this device.')

    return {
      format: 'local-password-vault',
      version: CURRENT_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      metadata,
      entries: await this.storage.listEntries(),
    }
  }

  /**
   * Hands the encrypted backup to the user (share sheet on iPhone, download elsewhere).
   * The export only counts as the last backup when it was not cancelled.
   */
  async exportBackup(platform: DeliveryPlatform = browserPlatform): Promise<DeliveryResult> {
    const backup = await this.createBackup()
    const file = new File(
      [JSON.stringify(backup, null, 2)],
      `local-vault-${localDateStamp(new Date(backup.exportedAt))}.pvault`,
      { type: 'application/json' },
    )
    const result = await deliverBackupFile(file, platform)
    if (result !== 'cancelled') await this.storage.setLastBackupAt(backup.exportedAt)
    return result
  }

  async getLastBackupAt(): Promise<string | undefined> {
    return this.storage.getLastBackupAt()
  }
}

export const backupService = new BackupService(indexedDbStorage)

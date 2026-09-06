export interface EncryptedBlob {
  iv: string
  ciphertext: string
}

export interface KdfConfig {
  name: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
}

export interface VaultMetadata {
  id: 'primary'
  version: 1
  kdf: KdfConfig
  masterWrappedDek: EncryptedBlob
  recoveryWrappedDek: EncryptedBlob
  createdAt: string
  updatedAt: string
}

export interface VaultEntry {
  id: string
  title: string
  username: string
  password: string
  url: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface VaultEntryInput {
  title: string
  username: string
  password: string
  url: string
  notes: string
}

export interface StoredVaultEntry {
  id: string
  payload: EncryptedBlob
  createdAt: string
  updatedAt: string
}

export interface VaultBackupFile {
  format: 'local-password-vault'
  version: 1
  exportedAt: string
  metadata: VaultMetadata
  entries: StoredVaultEntry[]
}

import type { EncryptedBlob } from '@/types/vault'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  textDecoder,
  textEncoder,
  toArrayBuffer,
} from '@/utils/encoding'

const AES_LENGTH = 256
const IV_BYTES = 12
const SALT_BYTES = 16
const RECOVERY_KEY_BYTES = 32

export const MASTER_KDF_ITERATIONS = 600_000

class CryptoService {
  randomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length))
  }

  randomSalt(): Uint8Array {
    return this.randomBytes(SALT_BYTES)
  }

  generateRecoveryKey(): string {
    return bytesToBase64Url(this.randomBytes(RECOVERY_KEY_BYTES))
  }

  generateDekBytes(): Uint8Array {
    return this.randomBytes(32)
  }

  async deriveMasterKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        iterations,
      },
      baseKey,
      { name: 'AES-GCM', length: AES_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async recoveryKeyToAesKey(recoveryKey: string): Promise<CryptoKey> {
    const bytes = base64UrlToBytes(recoveryKey.trim())
    if (bytes.byteLength !== RECOVERY_KEY_BYTES) {
      throw new Error('Invalid recovery key.')
    }
    return this.importAesKey(bytes)
  }

  async importAesKey(bytes: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      toArrayBuffer(bytes),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async encryptBytes(key: CryptoKey, bytes: Uint8Array, additionalData: string): Promise<EncryptedBlob> {
    const iv = this.randomBytes(IV_BYTES)
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(textEncoder.encode(additionalData)),
      },
      key,
      toArrayBuffer(bytes),
    )

    return {
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    }
  }

  async decryptBytes(key: CryptoKey, blob: EncryptedBlob, additionalData: string): Promise<Uint8Array> {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(base64UrlToBytes(blob.iv)),
        additionalData: toArrayBuffer(textEncoder.encode(additionalData)),
      },
      key,
      toArrayBuffer(base64UrlToBytes(blob.ciphertext)),
    )

    return new Uint8Array(plaintext)
  }

  async encryptJson<T>(key: CryptoKey, value: T, additionalData: string): Promise<EncryptedBlob> {
    return this.encryptBytes(key, textEncoder.encode(JSON.stringify(value)), additionalData)
  }

  async decryptJson<T>(key: CryptoKey, blob: EncryptedBlob, additionalData: string): Promise<T> {
    const bytes = await this.decryptBytes(key, blob, additionalData)
    return JSON.parse(textDecoder.decode(bytes)) as T
  }
}

export const cryptoService = new CryptoService()

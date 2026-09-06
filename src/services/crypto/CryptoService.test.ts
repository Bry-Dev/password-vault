import { describe, expect, it } from 'vitest'
import { cryptoService } from './CryptoService'

describe('CryptoService', () => {
  it('never reuses an IV or produces identical ciphertext for repeated encryptions', async () => {
    const key = await cryptoService.importAesKey(cryptoService.randomBytes(32))
    const plaintext = new TextEncoder().encode('same-plaintext')

    const first = await cryptoService.encryptBytes(key, plaintext, 'aad')
    const second = await cryptoService.encryptBytes(key, plaintext, 'aad')

    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const key = await cryptoService.importAesKey(cryptoService.randomBytes(32))
    const blob = await cryptoService.encryptJson(key, { secret: 'value' }, 'aad')

    await expect(cryptoService.decryptJson(key, blob, 'aad')).resolves.toEqual({ secret: 'value' })
  })

  it('fails closed when ciphertext is corrupted', async () => {
    const key = await cryptoService.importAesKey(cryptoService.randomBytes(32))
    const blob = await cryptoService.encryptBytes(key, new TextEncoder().encode('payload'), 'aad')

    const tamperedChar = blob.ciphertext[0] === 'A' ? 'B' : 'A'
    const tampered = { ...blob, ciphertext: tamperedChar + blob.ciphertext.slice(1) }

    await expect(cryptoService.decryptBytes(key, tampered, 'aad')).rejects.toThrow()
  })

  it('fails closed when additional authenticated data does not match', async () => {
    const key = await cryptoService.importAesKey(cryptoService.randomBytes(32))
    const blob = await cryptoService.encryptBytes(key, new TextEncoder().encode('payload'), 'aad-one')

    await expect(cryptoService.decryptBytes(key, blob, 'aad-two')).rejects.toThrow()
  })

  it('rejects a recovery key of the wrong length', async () => {
    const wrongLengthKey = cryptoService.generateRecoveryKey().slice(0, 10)
    await expect(cryptoService.recoveryKeyToAesKey(wrongLengthKey)).rejects.toThrow('Invalid recovery key.')
  })
})

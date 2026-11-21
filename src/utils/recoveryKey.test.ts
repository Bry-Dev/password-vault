import { describe, expect, it } from 'vitest'
import { recoveryKeysMatch } from './recoveryKey'

const KEY = 'Y2_DKW1lPp3ShRO3QzO-hvRDVRe14tm5gD5rPxYzAbc'

describe('recoveryKeysMatch', () => {
  it('matches the exact key', () => {
    expect(recoveryKeysMatch(KEY, KEY)).toBe(true)
  })

  it('ignores spaces and line breaks picked up when copying from notes or email', () => {
    expect(recoveryKeysMatch(KEY, `  ${KEY.slice(0, 20)}\n${KEY.slice(20)} \t`)).toBe(true)
  })

  it('is case-sensitive, because the key is base64url', () => {
    expect(recoveryKeysMatch(KEY, KEY.toLowerCase())).toBe(false)
  })

  it('rejects a key with one character wrong or missing', () => {
    expect(recoveryKeysMatch(KEY, KEY.slice(0, -1) + 'x')).toBe(false)
    expect(recoveryKeysMatch(KEY, KEY.slice(0, -1))).toBe(false)
  })

  it('rejects an empty entry', () => {
    expect(recoveryKeysMatch(KEY, '   ')).toBe(false)
  })
})

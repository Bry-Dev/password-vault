import { describe, expect, it } from 'vitest'
import { MASTER_PASSWORD_MIN_LENGTH, masterPasswordProblem } from './masterPassword'

describe('masterPasswordProblem', () => {
  it('requires at least 12 characters', () => {
    expect(MASTER_PASSWORD_MIN_LENGTH).toBe(12)
    expect(masterPasswordProblem('a'.repeat(11))).toBe('Use a master password of at least 12 characters.')
    expect(masterPasswordProblem('a'.repeat(12))).toBe('')
  })

  it('has no character-type rules', () => {
    expect(masterPasswordProblem('correct horse battery')).toBe('')
  })

  it('counts emoji and accented letters as single characters', () => {
    // 11 emoji are 22 UTF-16 code units but only 11 characters.
    expect(masterPasswordProblem('🔒'.repeat(11))).not.toBe('')
    expect(masterPasswordProblem('é'.repeat(12))).toBe('')
  })

  it('rejects a password that is only spaces', () => {
    expect(masterPasswordProblem(' '.repeat(20))).not.toBe('')
  })
})

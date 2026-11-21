/** Length beats composition rules: a long passphrase is both stronger and easier to remember. */
export const MASTER_PASSWORD_MIN_LENGTH = 12

/** Returns a user-facing problem with a new master password, or '' when it is acceptable. */
export function masterPasswordProblem(value: string): string {
  // Count characters, not UTF-16 code units, so emoji are not double-counted.
  if ([...value].length < MASTER_PASSWORD_MIN_LENGTH || value.trim() === '') {
    return `Use a master password of at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`
  }
  return ''
}

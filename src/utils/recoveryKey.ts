/**
 * True when the key the user typed or pasted back is the key they were shown.
 * Whitespace is ignored (copying from notes or email can add spaces or line breaks);
 * case is not, because the key is base64url.
 */
export function recoveryKeysMatch(expected: string, typed: string): boolean {
  const cleaned = typed.replace(/\s+/g, '')
  return cleaned.length > 0 && cleaned === expected
}

<!--
Thanks for contributing to a local-only password vault. Because this is
security-sensitive software, please fill this out carefully. See
CONTRIBUTING.md and SECURITY.md for more detail.
-->

## What changed?

## Why?

## How was it tested?

<!-- e.g. `npm run typecheck`, `npm test`, manual testing in a browser/PWA, new/updated automated tests -->

## Security impact

Answer honestly — "yes" answers are fine, but need explanation.

- [ ] Touches cryptography (KDF, AES-GCM, key wrapping, IV/nonce generation)
- [ ] Touches vault storage (IndexedDB schema, `StorageAdapter`, `VaultService`)
- [ ] Changes recovery behavior (recovery key, master password reset)
- [ ] Changes the backup/import/export format
- [ ] Introduces new network communication (`fetch`, `XMLHttpRequest`, WebSocket, SDK, etc.)
- [ ] Adds analytics or telemetry
- [ ] Adds a new dependency
- [ ] Persists any new sensitive information
- [ ] Stores secrets/plaintext vault values in `localStorage`/`sessionStorage`
- [ ] Vault values are encrypted before persistent storage (should stay checked/true)

If any box above is checked (other than the last), explain the security implications here:

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No secrets, decrypted vault data, or master passwords are logged or committed

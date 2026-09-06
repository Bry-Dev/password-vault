# Agent instructions — Local Password Vault

## Product direction

- PWA-first for iPhone/iOS.
- Vue 3 + TypeScript + Tailwind.
- Offline-first.
- No backend and no automatic sync at this stage.
- Vault contents remain local to the device.
- Do not add Tauri, Android, iOS native, or server dependencies unless explicitly requested.

## Architecture rules

- Views/components never access IndexedDB directly.
- Vault behavior belongs behind `VaultService`.
- Persistence belongs behind `StorageAdapter`.
- Browser persistence uses `IndexedDbStorage`.
- Keep the storage boundary compatible with a future `TauriStorage` implementation.
- Cryptographic operations stay inside the crypto/vault service layers.
- Keep crypto formats versioned and migratable.

## Security rules

- Never persist master passwords.
- Never persist recovery keys in plaintext.
- Never log secrets, decrypted entries, master passwords, recovery keys, DEKs, KEKs, or encrypted backup contents.
- Never put secrets in `VITE_*` environment variables.
- Persist only authenticated ciphertext and required non-secret metadata.
- Do not invent a custom cipher or replace AES-GCM/KDF logic casually.
- Recovery must work by unlocking/re-wrapping the DEK; never implement a bypass/master backdoor.
- Export/import must remain encrypted.
- Treat browser storage loss as possible; preserve manual backup/restore functionality.
- Security-sensitive changes should include tests before production use.

## UI rules

- Mobile-first for iPhone installed-PWA usage.
- Keep layouts simple, touch-friendly, and usable offline.
- Do not expose passwords by default.

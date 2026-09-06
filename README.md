# Local Password Vault — PWA-first scaffold

A Vue 3 + TypeScript + Tailwind password-vault scaffold designed for **iOS PWA use first**, with no backend and no cloud sync.

> **Security status:** This project is under active development and has
> **not** undergone an independent security audit. Do not yet rely on it as
> the sole storage location for critical credentials. See
> [SECURITY.md](SECURITY.md) for the full threat model and how to report
> vulnerabilities.

## Why this architecture

The web app files can be hosted on Cloudflare Pages (or any HTTPS static host), while the vault stays on the device in IndexedDB. The app shell is cached by a service worker so the installed PWA can continue working offline.

```text
Cloudflare Pages / HTTPS host
  └── Vue + JS + CSS + icons + service worker

User device
  ├── Installed PWA
  ├── Web Crypto API
  └── IndexedDB
      ├── vault metadata
      └── AES-GCM encrypted vault entries
```

No password, vault key, or decrypted entry is intentionally sent to the host.

## Included

- Vue 3 + TypeScript
- Tailwind CSS via the Vite plugin
- Vue Router
- Pinia
- Dexie / IndexedDB
- PWA manifest + service worker via `vite-plugin-pwa`
- Master-password unlock
- Random 256-bit vault data-encryption key (DEK)
- PBKDF2-HMAC-SHA-256 master-key derivation
- AES-256-GCM authenticated encryption
- Recovery key that independently wraps the same DEK
- Forgotten-master-password recovery that re-wraps the DEK under a new master password
- Encrypted password CRUD
- Manual encrypted `.pvault` export/import
- Storage adapter boundary so native Tauri storage can be added later

## Requirements

- Node.js 20.19+ or 22.12+ (Vite 8 requirement)
- npm, pnpm, yarn, or bun

## Run it

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Validation (also run in CI, see `.github/workflows/ci.yml`):

```bash
npm run typecheck
npm test
npm run build
```

## iPhone/PWA deployment

Deploy `dist/` to an HTTPS host such as Cloudflare Pages. On iPhone, open the site in Safari and use **Share → Add to Home Screen**.

The app code comes from the host, while encrypted vault records remain in browser-managed IndexedDB on the device.

## Important storage warning

An iOS PWA does **not** get the same native app-data guarantees as a Tauri/native app. Safari/browser data can be cleared, so the app intentionally includes encrypted manual backups. Treat backup/export as a required product feature, not an optional convenience.

## Encryption model

```text
Master password
   │
   ├─ PBKDF2 + random salt ──> Master KEK
   │                             │
   │                             └── AES-GCM unwraps DEK
   │
Recovery key ───────────────> Recovery KEK
                                 │
                                 └── AES-GCM unwraps same DEK

Random DEK (256 bit)
   └── AES-GCM encrypts each vault entry
```

The master password itself is never persisted. The recovery key is generated once and is also not stored as plaintext by the app.

## Why PBKDF2 here

This scaffold uses browser-native Web Crypto so it has no WASM cryptography dependency. PBKDF2-HMAC-SHA-256 is configured at 600,000 iterations. For a production password manager, benchmark on your supported devices and strongly consider moving the KDF behind the existing crypto boundary to Argon2id (for example, a carefully audited WASM implementation) while preserving a migration/version strategy.

## Folder map

```text
src/
├── components/
│   ├── layout/
│   ├── ui/
│   └── vault/
├── router/
├── services/
│   ├── backup/
│   ├── crypto/
│   ├── storage/
│   └── vault/
├── stores/
├── types/
├── utils/
└── views/
```

### Storage adapter

`StorageAdapter.ts` is the key future-proofing boundary:

```text
VaultService
   │
   └── StorageAdapter
          ├── IndexedDbStorage     ← iOS PWA now
          └── TauriStorage         ← add later for Android/desktop
```

The UI should not need to know which storage implementation is active.

## Suggested next hardening steps

1. Replace/upgrade the KDF using a versioned crypto migration path (Argon2id is the preferred modern direction).
2. Add master-password change UI and recovery-key rotation.
3. Add inactivity auto-lock and lock-on-background settings.
4. Add CSP and security headers at the deployment layer.
5. Add import validation with stricter schema checking and backup-version migrations.
6. Add password generator and strength feedback.
7. Add tests for cryptographic round-trips, wrong-password failures, backup restore, and migration behavior.
8. Consider WebAuthn/passkey or device-bound convenience unlock only as an additional wrapper around the vault key, never as an insecure bypass.
9. Commission a security review before treating the project as a production-grade password manager.

## Security scope

This is a development scaffold with a sensible architecture, **not an audited password manager**. Do not market or rely on it as production security software until it has undergone threat modeling, testing, dependency review, platform-specific storage review, and independent security assessment.

See [SECURITY.md](SECURITY.md) for the threat model and how to report a vulnerability privately.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the branch/PR workflow, and coding expectations — including extra requirements for changes to cryptography, recovery, or storage.

If you maintain this repository on GitHub, see
[docs/GITHUB_SECURITY_SETUP.md](docs/GITHUB_SECURITY_SETUP.md) for repository
settings (branch protection, Dependabot, secret scanning, CodeQL, private
vulnerability reporting) that must be enabled outside of this repo's files.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

# Contributing

Thanks for your interest in contributing. This is local-only, security-sensitive
software (a password vault), so please read this alongside [SECURITY.md](SECURITY.md)
and [AGENTS.md](AGENTS.md) before making changes.

## Getting started

```bash
npm install
npm run dev
```

Before opening a PR, run the same checks CI runs:

```bash
npm run typecheck
npm test
npm run build
```

There is no lint script configured yet. Adding ESLint + `eslint-plugin-vue`
with a minimal flat config is a welcome contribution — please discuss the
rule set in an issue first so it doesn't turn into unrelated churn.

## Branch/PR workflow

- Fork or branch from `main`.
- Keep PRs focused — one change per PR is easier to review, especially for
  anything touching cryptography or storage.
- Fill out the PR template completely, including the security-impact section.
- CI (typecheck, test, build) must pass.

## Coding expectations

- TypeScript is preferred everywhere; avoid `any` unless you leave a comment
  explaining why it's necessary.
- Views/components must not access IndexedDB or `crypto.subtle` directly —
  go through `VaultService` / `StorageAdapter` / `CryptoService`. See
  [AGENTS.md](AGENTS.md) for the architecture rules.
- Do not introduce plaintext secret persistence (no master passwords,
  recovery keys, or decrypted vault entries in `localStorage`,
  `sessionStorage`, IndexedDB, or logs).
- Do not `console.log` (or otherwise log) secrets, decrypted vault data,
  master passwords, recovery keys, DEKs/KEKs, or raw backup contents.
- Do not add telemetry, analytics, or new network calls (`fetch`, `XHR`,
  WebSocket, third-party SDKs) without discussing it in an issue first —
  this app is offline-first and local-only by design.
- Do not add a dependency that performs its own network communication or
  implements custom cryptographic primitives; prefer the Web Crypto API.

## Security-sensitive changes

If your change touches any of the following, explain the security
implications directly in the PR description (the PR template has a section
for this):

- cryptography (KDF, AES-GCM usage, IV/nonce generation, key wrapping)
- recovery (recovery key handling, master-password reset)
- key derivation parameters (iteration counts, algorithm choice)
- vault storage (`StorageAdapter`, IndexedDB schema)
- backup/export/import format
- authentication/unlock flow

Changes to any of the above should include or update tests (see
`src/services/crypto/CryptoService.test.ts` and
`src/services/vault/VaultService.test.ts` for examples) before being
considered ready to merge.

## What not to do

- Don't invent a custom cipher or replace AES-GCM/PBKDF2 casually — this is
  called out in [AGENTS.md](AGENTS.md) too.
- Don't add a backdoor/bypass for recovery — recovery must go through
  unlocking and re-wrapping the DEK.
- Don't commit real credentials, `.env` files, or exported vault backups.

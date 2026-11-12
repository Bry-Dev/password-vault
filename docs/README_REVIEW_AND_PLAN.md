# README review and hardening plan

Written 2026-09-22 from a review of `README.md` against the actual source,
config, CI, and hosting files. Load this file at the start of a session to
resume the work. Nothing below has been implemented yet; the only pending
change in the working tree is an uncommitted edit to `src/views/SetupView.vue`
(see Phase 2, item 6).

Suggested order: Phase 1 first, then Phase 2 items 1, 2 and 5, then the
emergency kit and setup confirmation from Phase 3 / Part C, since those
directly attack data loss.

---

## Part A: Findings from the README review

### A1. Claims that are out of date

- **Tests already exist.** Hardening step 7 in the README asks to add tests for
  crypto round-trips, wrong-password failures and lock behaviour.
  `src/services/crypto/CryptoService.test.ts` and
  `src/services/vault/VaultService.test.ts` already cover those. Only backup
  restore and migration tests are missing. Narrow the item and add "Tests" to
  the Included list.
- **Security headers already exist.** Step 4 asks to add CSP and headers, but
  `public/_headers` already ships a full set (CSP, HSTS, COOP, CORP, nosniff,
  frame-ancestors none, no-cache on `sw.js`). Document it instead, and note the
  file is Cloudflare Pages / Netlify format only. Other hosts need equivalent
  config or ship with no headers at all. CSP uses `style-src 'unsafe-inline'`
  (needed by Tailwind/Vue runtime styles); worth a one-line note.
- **Master password change is half done.** Step 2 says to add it, but
  `VaultService.changeMasterPassword` exists and is tested. Only the UI is
  missing. Say that precisely.
- **Folder map is incomplete.** It omits the two test files, `src/test/`
  (fake storage adapter), `docs/`, and `public/` (headers, redirects, icons).
- **Backup bypasses the storage boundary.** `src/services/backup/BackupService.ts`
  imports `indexedDbStorage` directly rather than taking a `StorageAdapter`.
  That undercuts the "add Tauri later" claim, and the Storage adapter diagram
  in the README should show BackupService too.

### A2. Overlooked edge cases worth documenting

- **Safari and the installed PWA have separate storage on iOS.** A vault
  created in a Safari tab will not appear after Add to Home Screen, and
  deleting the Home Screen icon deletes the vault. Tell users to create the
  vault inside the installed app and export a backup first.
- **Export may not work inside the installed PWA on iOS.** Downloads from
  standalone mode via an anchor `download` attribute have been unreliable
  across iOS versions. README calls backup a required feature, so flag that
  this needs verifying on real devices; consider `navigator.share` with a
  File as the primary path.
- **Old backups need the old master password.** A backup carries the wrapped
  keys as they were at export time. After a password change or recovery reset,
  older `.pvault` files still open with the previous password. The recovery
  key keeps working (it is not rotated). Users will not expect this.
- **Import replaces the vault without checking it decrypts.** A well-formed
  backup with a different key wipes the current vault and locks the user out.
  The service also rejects newer format versions with a generic "not
  supported" message. Both deserve a README warning and a code fix.
- **Losing both secrets means permanent loss.** README never states there is
  no reset path without the master password or recovery key, that the
  recovery key is shown exactly once, and that it cannot yet be rotated or
  re-displayed. (Accepted as the current goal; see Part C for opt-in last
  resorts.)
- **Web Crypto needs a secure context.** Testing on a real iPhone via a LAN IP
  over plain HTTP fails: `crypto.subtle` and `crypto.randomUUID` are
  undefined. Document an HTTPS dev setup or a tunnel.
- **Must be served from the domain root.** Manifest `scope`, `start_url` and
  Workbox `navigateFallback` are hardcoded to `/`. Hosting under a subpath
  breaks the PWA. GitHub Pages ignores `_redirects`, so deep links to
  `/vault` 404.
- **Auto-update reloads the page.** `registerType: 'autoUpdate'` reloads open
  tabs when a new build deploys. An unlocked vault locks and any unsaved form
  input is lost.
- **Clipboard exposure.** Copying passwords and the recovery key puts them on
  the clipboard, which iOS Universal Clipboard can sync to other Apple
  devices. SECURITY.md mentions clipboard inspection; README does not.

### A3. Minor

- **Master password policy is undocumented and in flux.** The uncommitted
  change in `src/views/SetupView.vue` lowers the minimum from 12 to 8
  characters and adds composition rules (upper/lower/digit/symbol). Current
  NIST SP 800-63B guidance favours length over composition. Recommendation:
  keep 12, drop the character-class rules. Either way, document it.
- **Service worker only exists in a production build.** Offline behaviour can
  only be tested via `npm run build` + `npm run preview`.
- **`.env.example` is not mentioned** even though it carries the `VITE_*`
  secrets warning that AGENTS.md and SECURITY.md rely on.
- **No lock on background or inactivity.** The vault stays unlocked in memory
  until the user locks it or iOS discards the page. State this in Security
  scope until auto-lock ships.

---

## Part B: Fix plan

### Phase 1: README-only corrections (no code, one PR)

- [ ] Rewrite "Suggested next hardening steps": drop the CSP item and point at
      `public/_headers`; narrow the tests item to backup restore and
      migrations; reword the password-change item to "expose the existing
      service method in the UI".
- [ ] Add a **Backups** section: import replaces the whole vault; an old backup
      opens with the master password current at export time; the recovery key
      always works; backups from a newer app version are rejected.
- [ ] Add an **iOS storage** section: separate storage for Safari tab vs
      installed app; deleting the icon deletes the vault; create the vault in
      the installed app and export immediately.
- [ ] Add a **Recovery** section: no reset path without master password or
      recovery key; key shown once; no rotation yet. Placeholder for the
      last-resort options in Part C once built.
- [ ] Add **Local development on a device**: Web Crypto needs HTTPS or
      localhost; service worker only in production build.
- [ ] Add **hosting constraints**: root path only; headers file is
      Cloudflare/Netlify format; GitHub Pages 404s deep links.
- [ ] Fix the folder map; add BackupService to the storage-adapter diagram;
      mention `.env.example`; state the master password policy once Phase 2
      item 6 is decided.
- [ ] Add a clipboard note mirroring the SECURITY.md threat model entry.
- [ ] Add "Tests" to the Included list.

### Phase 2: Low-risk code fixes, each with tests

1. [ ] **Route BackupService through the adapter.**
       Give `BackupService` a constructor that takes a `StorageAdapter`,
       mirroring `VaultService`; export a singleton bound to `indexedDbStorage`.
       Lets backup tests use `src/test/fakeStorageAdapter.ts`.

2. [ ] **Pre-flight the import before replacing anything.**
       Move restore into `VaultService.restoreBackup(backup, secret)` where
       `secret` is either a master password or a recovery key. BackupService
       only parses/serialises. Steps:
       - strict schema check of `metadata` and every entry
         (`id`, `payload.iv`, `payload.ciphertext`, timestamps);
       - reject `version` above `CURRENT_BACKUP_VERSION` with "created by a
         newer version of the app";
       - attempt to unwrap the DEK from the backup's own `metadata` with the
         supplied secret; on failure, "wrong password/recovery key for this
         backup", storage untouched;
       - only then call `storage.replaceFromBackup`.
       UI: show current entry count, warn it will be replaced, offer to export
       first. Tests: wrong key leaves storage untouched; newer version
       rejected; valid backup round-trips; malformed entry rejected.

3. [ ] **Add a version migration hook.** A map from version number to a
       migrate function for both `VaultMetadata` and `VaultBackupFile`, run at
       bootstrap and on import. v1 is identity today; the structure exists for
       the KDF change later. Test: unknown/newer version rejected, v1 passes
       through.

4. [ ] **Fix export on iOS.** Try `navigator.canShare({ files })` and use
       `navigator.share({ files: [new File(...)] })`; fall back to the anchor
       download. Verify on a real device in standalone mode.

5. [ ] **Switch the service worker to prompt mode.** Set `registerType` to
       `'prompt'` in `vite.config.ts`; show an "Update available" banner via
       the `virtual:pwa-register/vue` helper (`useRegisterSW`). Never reload
       underneath the user.

6. [ ] **Settle the master password policy (needs a decision).**
       Recommendation: 12-char minimum, no composition rules. The uncommitted
       SetupView diff currently does 8 chars + composition. Decide, adjust
       the diff, commit, and document in README.

7. [ ] **HTTPS dev script.** Add `@vitejs/plugin-basic-ssl` as a devDependency
       behind a `dev:https` script (`vite --host` with the plugin gated by an
       env flag) so the app can be tested on a phone over LAN.

### Phase 3: Feature work

- [ ] **Change master password UI.** Settings sheet in `VaultView.vue` calling
      `vaultService.changeMasterPassword`. While there, remove the redundant
      second key derivation and the `void dek` in that method.
- [ ] **Recovery key confirmation at setup.** Require the user to paste the
      key back before continuing. Cheapest single change that reduces loss.
- [ ] **Periodic recovery key check.** Store non-secret
      `recoveryKeyVerifiedAt` in metadata (optional field, or bump metadata to
      v2 via the migration hook). Prompt every ~90 days to paste the key;
      verify by unwrapping `recoveryWrappedDek`.
- [ ] **Auto-lock.** Lock on `visibilitychange` to hidden after a short grace
      period, plus an inactivity timer. Both configurable as non-secret
      preferences.
- [ ] **Clipboard clear.** Attempt to overwrite the clipboard ~30 s after copy.
      iOS may block writes without a gesture; document as best effort.
- [ ] **Backup/restore and migration tests** (partly covered by Phase 2 items
      2 and 3).

---

## Part C: Last resort when both secrets are lost

Current goal: losing both the master password and the recovery key is
permanent loss. That stays true. Any last resort must be **set up before the
loss**; after the fact there is nothing to do without breaking the encryption
model, and AGENTS.md forbids a backdoor. All options below add another way to
reach the *same DEK*, so they stay inside the rules ("recovery must work by
unlocking/re-wrapping the DEK").

1. **Emergency kit at setup (do first).** Generate a printable page with the
   recovery key as text and as a QR code, the vault creation date, and
   instructions. Encourage printing or saving to Files. No crypto changes,
   low effort (1Password does this). Make it a setup step, not an
   afterthought. QR generation can be a small dependency-free encoder or a
   vetted tiny library; no network.

2. **Optional password hint.** User-written hint stored as plaintext
   metadata, shown on the unlock screen. Reject hints containing the password
   or long substrings of it. Cheap and common, but weak; optional and off by
   default.

3. **Split the recovery key across trusted people.** Shamir secret sharing
   over GF(256): split into e.g. 3 shares, any 2 rebuild the key. Shares are
   short strings / QR codes given to family or kept in different places. No
   single holder can open the vault. Roughly 150 lines, fully testable, but it
   is real cryptographic code: needs careful implementation, tests against
   known vectors, and review before shipping. Reconstruction feeds straight
   into `unlockWithRecoveryKey`, so nothing else changes.

4. **Passkey wrapper (later).** A third wrapper of the DEK under a key from
   the WebAuthn PRF extension, backed by an iCloud Keychain-synced passkey.
   Doubles as convenience unlock and as recovery on a replacement device.
   Safari support is recent and uneven; schedule after the KDF/Argon2id
   migration. Must remain an additional wrapper, never a bypass.

**Avoid:** server-side escrow of any key, security questions, a developer-held
master key. Each turns the vault into something an attacker can open without
the user.

---

## Quick reference: files touched per phase

| Phase | Files |
| --- | --- |
| 1 | `README.md` |
| 2.1 | `src/services/backup/BackupService.ts`, new `BackupService.test.ts` |
| 2.2 | `VaultService.ts`, `BackupService.ts`, `src/stores/vault.ts`, `UnlockView.vue`, tests |
| 2.3 | `src/types/vault.ts`, new `src/services/vault/migrations.ts`, tests |
| 2.4 | `BackupService.ts` |
| 2.5 | `vite.config.ts`, `App.vue` or `AppShell.vue` |
| 2.6 | `SetupView.vue` (uncommitted diff), `README.md` |
| 2.7 | `package.json`, `vite.config.ts`, `README.md` |
| 3 | `VaultView.vue`, `SetupView.vue`, `UnlockView.vue`, `VaultService.ts`, `types/vault.ts`, stores |

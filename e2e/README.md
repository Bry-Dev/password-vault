# Browser checks (Playwright, Python)

End-to-end checks that drive the real app in headless Chromium and WebKit at
iPhone screen size. They use **dummy data only**, each in a fresh browser
profile, so they never touch a real vault.

## Setup (once)

```sh
pip install playwright
python -m playwright install chromium webkit
```

## Run

```sh
npm run test:e2e            # both engines
python e2e/run_all.py webkit  # one engine
```

The runner starts a Vite dev server on port 5173 and stops it afterwards; the
update check builds `dist/` twice and serves it on port 4173 itself. Both
ports must be free. Screenshots and temporary backup files go to
`e2e/output/` (git-ignored).

## What each script checks

| Script | Covers |
| --- | --- |
| `setup_flow.py` | 3-step setup: nothing stored before the recovery key is pasted back; wrong key rejected; "Show the key again" / "Start over"; clipboard cleared (readable in Chromium only); confirmed key recovers the vault. |
| `restore_flow.py` | Restore on a new device and over an existing vault: non-backup file, wrong secret (nothing changes), replace warning with entry counts, "export current vault first", restore with master password or recovery key. |
| `share_flow.py` | iPhone-style export via a stand-in share sheet: shared `.pvault`, dismissing is not an error and not recorded; 12-character password rule on setup. Needs `restore_flow.py` to run first (reuses its backup file). |
| `update_flow.py` | Production build: a new deploy shows the update banner without reloading or locking; "Later" hides it; "Update now" loads the new build. |

## Not covered (check on the iPhone)

The real iOS share sheet and Files picker, clipboard clearing in Safari, and
update behaviour of the installed app. See the on-device checklist in
`docs/README_REVIEW_AND_PLAN.md`.

# Security policy

## Project status

**This project has not undergone an independent security audit.** It is under
active development. Do not rely on it as your sole storage location for
critical credentials yet, and do not treat it as production-ready,
audited, "unhackable", or formally verified — it is none of those things.

## Supported versions

There are no tagged releases yet; this project is pre-1.0. Security fixes
land on `main` only. Once tagged releases exist, this section will list
which versions receive fixes.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

The preferred way to report a vulnerability is
[GitHub Private Vulnerability Reporting](https://github.com/Bry-Dev/password-vault/security/advisories/new)
on this repository (Security tab → "Report a vulnerability"), if it is
enabled. This lets maintainers see and discuss the report privately before
any public disclosure.

If private reporting is unavailable, contact the maintainer directly rather
than filing a public issue or pull request that describes the exploit.

A useful report includes:

- a description of the vulnerability and its potential impact;
- steps to reproduce, using **fake/example data only**;
- affected file(s)/function(s) if known;
- any relevant browser/device/version information.

**Never include real vault credentials in a report** — no real master
passwords, recovery keys, exported `.pvault` backups, or decrypted vault
contents. Use synthetic example data when demonstrating an issue.

## Threat model assumptions

This scaffold aims to protect vault contents if the IndexedDB database or exported `.pvault` file is copied while the vault is locked.

It does not protect against:

- malware or a compromised browser/device while the vault is unlocked;
- malicious browser extensions with sufficient privileges;
- screen recording, clipboard inspection, or shoulder surfing;
- an attacker who learns the master password or recovery key;
- loss of all local browser data when no backup exists.

## Design rules

- Never persist the master password.
- Never persist the recovery key in plaintext.
- Never persist decrypted vault entries.
- Keep encryption versioned so algorithms and work factors can migrate.
- Do not put secrets in Vite environment variables; `VITE_*` values are public client bundle data.
- Keep decrypted vault data in memory only while unlocked.
- Export only encrypted records and wrapped key material.

## Before production use

Perform a dedicated threat model and independent security review. Password managers are high-value security software; a working demo is not the same as an audited implementation.

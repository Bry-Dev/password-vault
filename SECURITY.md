# Security notes

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

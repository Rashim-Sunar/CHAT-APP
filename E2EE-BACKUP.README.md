# E2EE Encrypted Key Backup

## 1. Overview

End-to-end encryption requires each device to hold the account private key locally.
Without backup, a newly logged-in device cannot decrypt existing messages unless an approved device relays keys.

This feature adds an optional one-time encrypted backup flow:
- User chooses a backup password on a trusted device
- Client encrypts private key locally
- Server stores only opaque encrypted data
- New device can recover key locally with that password

## 2. Flow

### Setup (one-time opt-in)

1. User selects Enable backup from the app prompt.
2. Client exports local private key JWK from IndexedDB.
3. Client derives an AES key from the backup password using PBKDF2.
4. Client encrypts private key with AES-GCM.
5. Client sends `{ cipher, salt, iv }` to `POST /api/backup/enable`.

### Recovery (new device)

1. User logs in on a device with no local private key.
2. App shows Restore with password and Use device linking.
3. Client fetches encrypted envelope via `GET /api/backup`.
4. User enters backup password.
5. Client derives key (PBKDF2), decrypts private key (AES-GCM), validates key, and stores it in IndexedDB.
6. App unlocks chat access.

## 3. Security Model

- Password-derived key:
  PBKDF2 with SHA-256 and high iteration count makes offline guessing harder than raw password hashing.
- Authenticated encryption:
  AES-GCM protects confidentiality and integrity, so tampering fails during decrypt.
- Zero-knowledge server:
  Server stores ciphertext, salt, and IV only. Password and plaintext private key never leave the browser.

## 4. Limitations

- Weak password risk:
  If user chooses a weak password, encrypted backup is more vulnerable to offline guessing.
- No recovery without password:
  If backup password is lost and no approved device exists, encrypted history cannot be recovered.
- Rate limiting scope:
  Restore fetch endpoint is rate-limited server-side, but decryption attempts are local once ciphertext is fetched.

## 5. Future Work

- Recovery codes as additional offline fallback.
- Key rotation UX with versioned encrypted backups.
- Optional hardware-backed key wrapping where platform support exists.

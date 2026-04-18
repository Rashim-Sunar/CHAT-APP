# E2EE Device Linking and Login Gating

## 1. Overview

Device linking allows a newly authenticated device to receive E2EE key material from an already approved device without exposing plaintext secrets to the server.

Why this is needed:
- Chat payloads are encrypted end-to-end.
- A device without the correct private key cannot decrypt historical or incoming encrypted messages.
- To preserve zero-knowledge behavior, the server can only relay encrypted transfer data.

## 2. Full Flow

### Device2 (new login)
1. User logs in successfully with account credentials.
2. Client checks IndexedDB for an existing private key.
3. If key is missing and server-side public key already exists, Device2 creates a temporary RSA key pair.
4. Device2 sends tempPublicKey to POST /api/link-session/create.
5. Device2 enters pending state and shows a waiting screen.

### Device1 (existing approved device)
1. Device1 receives socket event link_request with sessionId and device metadata.
2. User explicitly approves or rejects request.
3. On approve, Device1 fetches tempPublicKey from GET /api/link-session/:sessionId.
4. Device1 encrypts transfer secret using hybrid crypto:
   - AES-GCM encrypts secret payload (private/public key bundle).
   - RSA-OAEP wraps AES key with Device2 temp public key.
5. Device1 sends encryptedSecret to POST /api/link-session/complete.

### Server
- Stores only link session metadata and temporary public key.
- Relays notifications through sockets:
  - link_request
  - link_session_updated
  - link_secret_ready
- Never sees plaintext private keys or decrypted transfer secret.

### Device2 (unlock)
1. Receives link_secret_ready via socket.
2. Uses temporary private key to unwrap AES key.
3. Decrypts transfer secret locally.
4. Stores resulting private/public key material in IndexedDB.
5. Transitions from pending to ready and unlocks full chat UI.

## 3. Login Gating

The app now enforces a two-layer login state:
- Authenticated session (JWT cookie is valid).
- Encryption-ready session (device has local private key).

If no local private key exists:
- Chat UI is blocked.
- Message fetching/sending is effectively blocked because Home/chat modules are not mounted.
- User sees: Waiting for approval from another device.

Security implication:
- Authentication alone no longer grants data access.
- Decryption capability is required before chat access is granted.

## 4. Security Model

- Zero-knowledge server:
  - Server stores public keys and opaque encrypted payloads only.
  - Private keys remain device-local.
- RSA-based transfer envelope:
  - Device2 temporary RSA key pair is generated per link session.
  - Only Device2 temp private key can unwrap the transfer AES key.
- Hybrid encryption:
  - AES-GCM protects payload confidentiality and integrity.
  - RSA-OAEP protects transport of AES key.
- Session expiry:
  - Link session TTL is short (2 minutes).
  - Expired sessions are marked/cleaned and cannot be reused.
- One-time use:
  - Used sessions are rejected and deleted after successful completion.

## 5. Limitations

- Requires an already approved device that still has local key material.
- No backup recovery path is implemented in this flow.
- If all approved devices are lost, key recovery is not possible with current design.

## 6. Future Improvements

- Encrypted key backup with user-controlled passphrase.
- Better multi-device synchronization for session key material.
- Transfer per-conversation/session keys instead of full private key export.
- Add explicit device management UI (trusted devices, revoke, rename, last seen).
- Add signed approval attestations for stronger anti-spoof guarantees.

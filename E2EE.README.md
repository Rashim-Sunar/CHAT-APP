# End-to-End Encryption (E2EE) in Chat App

## 1. Introduction
End-to-End Encryption (E2EE) means message content is encrypted on sender devices and can only be decrypted on participant devices.

This implementation uses hybrid encryption:
- RSA-OAEP for secure key exchange
- AES-GCM for fast message content encryption

Why this is used:
- Server does not need plaintext access
- Message confidentiality is preserved in storage and transit
- AES provides performance for chat workloads while RSA handles key distribution

## 2. Architecture Overview
Client responsibilities:
- Generate RSA key pair on first trusted device session
- Store private key in IndexedDB only
- Upload public key to backend
- Encrypt text before send
- Decrypt encrypted text after receive/fetch
- Start device-linking flow when a newly authenticated device has no local private key

Server responsibilities:
- Store user public keys
- Persist encrypted message payload fields
- Relay encrypted payloads over sockets
- Coordinate short-lived device-link sessions
- Never decrypt ciphertext

## 3. Encryption Flow (Step-by-Step)
Sender:
1. Fetch receiver public key from API
2. Generate per-message AES key (AES-GCM) and random IV
3. Encrypt plaintext message with AES key + IV
4. Encrypt AES key using RSA public keys (receiver and sender copies)
5. Send encrypted payload to backend

Server:
- Stores and forwards encrypted payload only
- Treats encrypted fields as opaque strings

Receiver:
1. Load private key from IndexedDB
2. Decrypt AES key from encrypted payload
3. Decrypt ciphertext message using AES key + IV

## 4. Device Linking and Login Gating (Implemented)
Device linking now preserves E2EE continuity when users sign in on additional devices.

New device flow:
1. User authenticates with account credentials.
2. Client checks IndexedDB for local private key.
3. If missing and account already has server-side public key, client creates temporary RSA key pair.
4. Client creates a link session and moves to pending state.
5. Chat access remains gated until encrypted key transfer completes.

Trusted device flow:
1. Receives real-time link request.
2. User approves or rejects request.
3. On approval, trusted device fetches temporary public key for that session.
4. Trusted device encrypts transfer secret client-side.
5. Encrypted payload is sent for relay to requesting device.

Requesting device completion:
1. Receives encrypted transfer payload.
2. Decrypts payload with temporary private key locally.
3. Stores recovered key material in IndexedDB.
4. Moves from pending to ready and unlocks chat UI.

## 5. Data Flow Diagram (text-based)
User A -> Encrypt (AES + RSA wrap) -> Server stores/forwards ciphertext -> User B decrypts

Detailed path:
User A plaintext
-> AES encrypt text
-> RSA encrypt AES key
-> POST /api/messages/send/:id
-> MongoDB stores encryptedMessage/encryptedAESKey/iv
-> Socket emits newMessage
-> User B private key decrypts AES key
-> AES decrypts text

Device-link transfer path:
New device temp public key
-> POST /api/link-session/create
-> Trusted device approves
-> Trusted device encrypts transfer secret
-> POST /api/link-session/complete
-> Socket emits encrypted payload
-> New device decrypts locally

## 6. Security Concepts
AES (Advanced Encryption Standard):
- Symmetric encryption used for message body
- Fast and suitable for high-volume chat payloads

RSA (RSA-OAEP):
- Asymmetric encryption used to protect AES key exchange
- Public key encrypts, private key decrypts

IV (Initialization Vector):
- Random value required by AES-GCM
- Prevents repeated ciphertext for repeated plaintext

Hybrid encryption:
- RSA secures small key material
- AES secures message payload efficiently

Public vs private key:
- Public key can be shared and stored on server
- Private key is device-local only and never uploaded

Zero-knowledge constraint:
- Server handles opaque encrypted payloads only
- Private keys and decrypted transfer secrets remain client-side

## 7. Current Limitations
- No encrypted private-key backup/recovery mechanism yet
- Additional device approval requires an already trusted active device
- Existing legacy plaintext messages remain as-is unless migrated

## 8. Future Improvements
- Encrypted private-key backup with user passphrase
- Trusted-device management UI (list/revoke/rename)
- Transfer conversation/session keys instead of private key bundle
- Forward secrecy with ephemeral session keys and ratcheting
- Message key rotation and key versioning
- Optional signed message authenticity metadata

## Implementation Notes
Frontend utilities:
- frontend/src/Utils/crypto.ts
- frontend/src/Utils/secureStorage.ts

Frontend linking state and gating:
- frontend/src/context/DeviceLinkContext.tsx
- frontend/src/context/Auth-Context.tsx
- frontend/src/App.tsx

Backend public key endpoints:
- POST /api/users/public-key
- GET /api/users/:id/public-key

Backend link-session endpoints:
- POST /api/link-session/create
- POST /api/link-session/respond
- POST /api/link-session/complete
- GET /api/link-session/status/:sessionId
- GET /api/link-session/:sessionId

Encrypted message payload fields:
- encryptedMessage
- encryptedAESKey
- iv

Encrypted link-transfer payload fields:
- encryptedPayload
- encryptedAesKey
- iv

The backend remains zero-knowledge for encrypted message and key-transfer content.

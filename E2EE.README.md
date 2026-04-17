# End-to-End Encryption (E2EE) in Chat App

## 1. Introduction
End-to-End Encryption (E2EE) means message content is encrypted on the sender device and can only be decrypted on participant devices.

This implementation uses hybrid encryption:
- RSA-OAEP for secure key exchange
- AES-GCM for fast message content encryption

Why this is used:
- Server does not need plaintext access
- Message confidentiality is preserved in storage and transit
- AES provides performance for chat workloads while RSA handles key distribution

## 2. Architecture Overview
Client responsibilities:
- Generate RSA key pair on first authenticated session
- Store private key in IndexedDB only
- Upload public key to backend
- Encrypt text before send
- Decrypt encrypted text after receive/fetch

Server responsibilities:
- Store user public keys
- Persist encrypted message payload fields
- Relay encrypted payloads over sockets
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

## 4. Data Flow Diagram (text-based)
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

## 5. Security Concepts
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
- RSA secures the small key material
- AES secures the message payload efficiently

Public vs private key:
- Public key can be shared and stored on server
- Private key is device-local only and never uploaded

## 6. Limitations
- No multi-device key sync yet
- No encrypted key backup/recovery mechanism
- Existing legacy plaintext messages remain as-is unless migrated

## 7. Future Improvements
- Device-specific key identities and device management
- Encrypted private-key backup with user passphrase
- Forward secrecy with ephemeral session keys and ratcheting
- Message key rotation and key versioning
- Optional signed message authenticity metadata

## Implementation Notes
Frontend utilities:
- src/utils/crypto.ts
- src/utils/secureStorage.ts

Backend endpoints:
- POST /api/users/public-key
- GET /api/users/:id/public-key
- Alias path also works through /api/user/*

Encrypted message payload fields:
- encryptedMessage
- encryptedAESKey
- iv

The backend remains zero-knowledge for encrypted text content.

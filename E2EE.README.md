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

The same hybrid model covers direct chats, group chats (up to 250 members), and — via a different mechanism explained in Section 9 — audio/video calls.

## 2. Architecture Overview
Client responsibilities:
- Generate RSA key pair on first trusted device session
- Store private key in IndexedDB only
- Upload public key to backend
- Encrypt text once per message and wrap the AES key for every current recipient (2 for a direct chat, N for a group)
- Decrypt encrypted text after receive/fetch
- Optionally encrypt and upload private-key backup envelope (ciphertext only)
- Start device-linking flow when a newly authenticated device has no local private key
- Establish direct peer-to-peer WebRTC connections for calls (Section 9)

Server responsibilities:
- Store user public keys
- Persist encrypted message payload fields, including one wrapped-AES-key entry per current conversation participant
- Relay encrypted payloads over sockets
- Reject sends whose wrapped-key set doesn't cover every current participant (structural check only — the server never inspects ciphertext)
- Coordinate short-lived device-link sessions
- Relay WebRTC signaling (SDP/ICE) for calls, never media
- Never decrypt ciphertext

## 3. Encryption Flow (Step-by-Step)
Sender:
1. Fetch public keys for every current conversation participant (batched — see Section 4)
2. Generate one ephemeral AES key (AES-GCM) and random IV for this message
3. Encrypt plaintext once with that AES key + IV
4. Wrap the same AES key once per participant's RSA public key (including the sender's own, so they can re-read their own history)
5. Send `{encryptedMessage, encryptedAESKeys[], iv}` to the backend

Server:
- Verifies `encryptedAESKeys` includes an entry for every current participant (rejects the send otherwise) — a structural integrity check, not a content check
- Stores and forwards the encrypted payload only
- Treats encrypted fields as opaque strings

Receiver:
1. Load private key from IndexedDB
2. Find their own entry in `encryptedAESKeys` (by user id) and RSA-decrypt it to recover the AES key
3. AES-decrypt the (single, shared) ciphertext message using that key + IV

This flow is identical for direct and group conversations — a direct chat is simply the N=2 case. Section 4 walks through the group case in detail.

## 4. Group Chat Encryption
Group chat reuses the exact same send/receive code path as direct messaging (`encryptTextMessageForRecipients` / `decryptMessageIfNeeded` in `frontend/src/Utils/crypto.ts`) — there is no separate "group encryption mode." What changes is only the size of the recipient list.

**Sending a group message:**
1. Client reads the group conversation's current `participants` list (includes the sender).
2. `getRecipientPublicKeys(participantIds)` resolves every member's RSA public key in **one batched request** (`POST /api/users/public-keys`), not N sequential lookups — this is what keeps encryption latency flat as group size grows.
3. Members with no public key on file (E2EE never set up on any of their devices) are silently omitted from the result. The client compares the returned count against the participant count; if any member is missing a key, the send is aborted client-side with "One or more participants haven't set up encryption yet" rather than silently producing a message some member could never read.
4. The plaintext is encrypted **exactly once** with a fresh AES-256 key + random IV — this happens regardless of whether the group has 3 members or 250.
5. That same AES key is then RSA-wrapped **once per member**, in parallel (`Promise.all`), producing an `encryptedAESKeys` array of `{userId, wrappedKey}` entries — one entry per current member.
6. The payload sent to the backend is `{encryptedMessage, encryptedAESKeys: [...N entries], iv}`.

**Why this scales:** the expensive part (AES-encrypting the message body) happens once no matter the group size; only the cheap part (RSA-wrapping a 32-byte key, a few milliseconds each) repeats per member. A long message sent to a 250-member group is not encrypted 250 times — it's encrypted once and its key is wrapped 250 times.

**Server-side guard:** `sendConversationMessage` (`backend/controllers/conversationController.ts`) rejects the request with 400 if `encryptedAESKeys` doesn't include every current participant's user id. The server cannot verify the *content* is correctly encrypted (it never sees plaintext), but it can and does enforce that no current member would be silently locked out of a message a buggy or malicious client tried to send.

**Receiving a group message:** every member independently runs the same three receiver steps from Section 3 — each looks up their *own* `userId` in the shared `encryptedAESKeys` array (`resolveWrappedAesKeyForViewer`), decrypts that one entry with their private key, and uses the recovered AES key to decrypt the single shared ciphertext. No member ever sees another member's wrapped-key entry or needs to.

**Designed limitations (not bugs):**
- A member added to a group **cannot** decrypt messages sent before they joined — historical messages were never wrapped for them, since `encryptedAESKeys` is fixed at send time. The client detects this (`resolveWrappedAesKeyForViewer` returns nothing for that user) and renders it as an inaccessible/corrupted message rather than failing silently.
- A member removed from a group **retains** any messages/keys already present on their device — removal revokes their conversation *access* going forward (they stop receiving new messages and can no longer fetch history via the API), but there is no backward secrecy or forced re-keying of already-delivered content. This matches the trade-off most hybrid-encrypted group chat systems make without a full sender-key/ratchet scheme (see Section 10).

## 5. Device Linking and Login Gating (Implemented)
Device linking now preserves E2EE continuity when users sign in on additional devices.

If encrypted backup is enabled, users can restore without waiting for an approved device.

New device flow:
1. User authenticates with account credentials.
2. Client checks IndexedDB for local private key.
3. If missing and account already has server-side public key, client shows restore gate.
4. User can either restore with backup password or start device linking.
5. Chat access remains gated until local private key is restored.

Backup restore flow:
1. Client fetches encrypted backup envelope from GET /api/backup.
2. User enters backup password.
3. Client derives key with PBKDF2 and decrypts private key locally with AES-GCM.
4. Decrypted key is validated/imported and stored in IndexedDB.
5. App transitions to ready state and unlocks chat.

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

## 6. Data Flow Diagrams (text-based)

Direct message (N=2):
```
User A plaintext
-> AES encrypt text (one ciphertext)
-> RSA-wrap AES key for A and B (2 entries)
-> POST /api/conversations/:id/messages
-> MongoDB stores encryptedMessage/encryptedAESKeys[]/iv
-> Socket emits newMessage to every participant's devices
-> User B finds their entry in encryptedAESKeys, RSA-decrypts it
-> AES decrypts the shared ciphertext
```

Group message (N members):
```
User A plaintext
-> AES encrypt text once (one ciphertext, size-independent of group size)
-> Fetch all N members' public keys in one batched request
-> RSA-wrap the same AES key once per member (N entries, parallelized)
-> POST /api/conversations/:id/messages
-> Server verifies encryptedAESKeys covers every current member, else 400
-> MongoDB stores encryptedMessage/encryptedAESKeys[N]/iv
-> Socket emits newMessage to all N members' devices
-> Each member finds only their own entry, RSA-decrypts it locally
-> AES decrypts the shared ciphertext
```

Device-link transfer path:
```
New device temp public key
-> POST /api/link-session/create
-> Trusted device approves
-> Trusted device encrypts transfer secret
-> POST /api/link-session/complete
-> Socket emits encrypted payload
-> New device decrypts locally
```

Call signaling path (media never touches the server — see Section 9):
```
Caller: call:invite {conversationId, callType} over socket
-> Server rings the callee's devices (call:incoming), never sees media
-> Callee accepts: call:join
-> Peers exchange SDP offer/answer + ICE candidates via the server (relay only)
-> DTLS handshake establishes an encrypted channel directly between browsers
-> Audio/video flows peer-to-peer over SRTP, server never in the media path
```

## 7. Security Concepts
AES (Advanced Encryption Standard):
- Symmetric encryption used for message body
- Fast and suitable for high-volume chat payloads

RSA (RSA-OAEP):
- Asymmetric encryption used to protect AES key exchange
- Public key encrypts, private key decrypts
- In a group, the same AES key is wrapped once per member's public key — RSA never encrypts the message body itself, only the small key

IV (Initialization Vector):
- Random value required by AES-GCM
- Prevents repeated ciphertext for repeated plaintext

Hybrid encryption:
- RSA secures small key material
- AES secures message payload efficiently
- At group scale, this is what keeps a large message from being re-encrypted per member — only the cheap RSA wrap repeats

Public vs private key:
- Public key can be shared and stored on server
- Private key is device-local only and never uploaded

DTLS-SRTP (calls only, Section 9):
- Mandatory encryption built into the WebRTC standard, not implemented by this app
- DTLS negotiates a session key directly between the two browsers; SRTP encrypts the actual audio/video packets with it

Zero-knowledge constraint:
- Server handles opaque encrypted payloads only, for both messages and call signaling
- Private keys, decrypted transfer secrets, and call media all remain client-side/peer-to-peer

## 8. Current Limitations
- Backup is optional; accounts without backup still require trusted-device approval
- If backup password is lost and no approved device remains, recovery is not possible
- Existing legacy plaintext messages remain as-is unless migrated
- A group member who joins after a message was sent cannot decrypt that message (by design — see Section 4)
- Removing a group member does not re-key or revoke already-delivered message content on their device (no backward secrecy — see Section 4)
- Calls use public STUN only, no TURN server — calls between peers behind restrictive/symmetric NAT may fail to connect
- Mesh WebRTC group calls are capped at 6 simultaneous participants (bandwidth scales with participant count; this is a quality ceiling, not an artificial limit)
- `call_log` messages (missed/declined/ended call summaries shown in the chat) are plain server-generated metadata, not E2EE payloads — they carry no user-authored content, so there is nothing to encrypt

## 9. Audio/Video Call Security
Calling (implemented for both direct and group conversations) uses mesh WebRTC — every call participant opens a direct `RTCPeerConnection` to every other participant's browser. There is no media server (SFU) in this app; media never passes through the backend at all.

**Encryption is mandatory, not optional:** every `RTCPeerConnection`, by the WebRTC standard, negotiates DTLS to establish a session key and encrypts all audio/video with SRTP using that key. This isn't something this app adds — it's impossible to run WebRTC media unencrypted. The app's only job is signaling.

**What the server does and doesn't see:**
- Sees: SDP offers/answers and ICE candidates (connection metadata — codecs, network addresses, no media) relayed via Socket.io so the two browsers can find each other and complete the DTLS handshake
- Never sees: any audio or video frame, at any point, for any call

**Direct calls:** the caller emits `call:invite`; the callee's devices ring for up to 45 seconds (`call:incoming`); accepting joins the mesh (here, just the 2 peers) via `call:join`. Declining or timing out logs a `call_log` message (`missed`/`declined`).

**Group calls:** any member can start (`call:start`) or join (`call:join`) a live call; other members see a passive "ongoing call — tap to join" banner instead of a ring (ringing all 250 possible group members isn't usable). New joiners' peer connections are formed by a deterministic offerer/answerer rule — existing participants always offer to a newcomer — to avoid signaling glare. Capped at 6 simultaneous participants.

**Call history:** when a call ends, one `call_log` message (`messageType: 'call_log'`, with `callType`/`callStatus`/`callDurationSec`) is written directly to the conversation — this is server-generated system metadata, not user content, so it deliberately bypasses the E2EE send path entirely rather than being encrypted.

Relevant code: `backend/socket/callSignaling.ts` (signaling relay), `backend/Utils/callSession.ts` (in-memory session state), `backend/Utils/callLog.ts` (call_log message creation), `frontend/src/Utils/webrtcPeerManager.ts` (`CallPeerManager`, one `RTCPeerConnection` per remote peer), `frontend/src/context/CallContext.tsx` (call state machine), `frontend/src/config/iceServers.ts` (STUN configuration).

## 10. Future Improvements
- Trusted-device management UI (list/revoke/rename)
- Transfer conversation/session keys instead of private key bundle
- Forward secrecy with ephemeral session keys and ratcheting (messages and, separately, a sender-key scheme for groups to avoid the "no backward secrecy on removal" trade-off in Section 4)
- Message key rotation and key versioning
- Optional signed message authenticity metadata
- TURN server for reliable call connectivity behind restrictive NAT
- SFU-based group calls to scale past the current 6-participant mesh cap

## Implementation Notes
Frontend utilities:
- frontend/src/Utils/crypto.ts (`encryptTextMessageForRecipients`, `decryptMessageIfNeeded`, `getRecipientPublicKeys` — shared by direct and group)
- frontend/src/Utils/secureStorage.ts
- frontend/src/Utils/webrtcPeerManager.ts (call media, DTLS-SRTP via the browser's WebRTC stack)

Frontend linking state and gating:
- frontend/src/context/DeviceLinkContext.tsx
- frontend/src/context/Auth-Context.tsx
- frontend/src/context/CallContext.tsx
- frontend/src/App.tsx

Backend public key endpoints:
- POST /api/users/public-key
- GET /api/users/:id/public-key
- POST /api/users/public-keys (batch — used for group encryption)

Backend conversation endpoints (unified direct + group):
- POST /api/conversations (create group) / POST /api/conversations/direct
- POST /api/conversations/:id/messages (send — enforces `encryptedAESKeys` covers every current participant)
- GET /api/conversations/:id/messages

Backend link-session endpoints:
- POST /api/link-session/create
- POST /api/link-session/respond
- POST /api/link-session/complete
- GET /api/link-session/status/:sessionId
- GET /api/link-session/:sessionId

Backend backup endpoints:
- POST /api/backup/enable
- GET /api/backup

Call signaling (Socket.io events, `backend/socket/callSignaling.ts`):
- call:invite / call:start / call:join / call:decline / call:leave
- call:offer / call:answer / call:ice-candidate (relayed to the exact joined socket, never broadcast)
- call:media-state, call:participant-joined, call:participant-left

Encrypted message payload fields:
- encryptedMessage
- encryptedAESKeys (array of `{userId, wrappedKey}` — 2 entries direct, N entries group)
- iv
- encryptedAESKey (legacy single-string dual-wrap format, decrypt-side fallback only)

Encrypted link-transfer payload fields:
- encryptedPayload
- encryptedAesKey
- iv

The backend remains zero-knowledge for encrypted message and key-transfer content, and — for calls — for media content as well; it only ever handles ciphertext, wrapped keys, and call-signaling metadata.

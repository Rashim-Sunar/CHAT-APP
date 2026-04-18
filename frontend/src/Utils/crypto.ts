// ============================================================================
// E2EE Hybrid Encryption Module
// ============================================================================
// Implements end-to-end encrypted messaging using a hybrid encryption strategy:
//
// 1. RSA-2048-OAEP: Asymmetric cryptography for secure key exchange
//    - Each user has a public/private key pair (in IndexedDB)
//    - Private key never leaves the client device
//    - Public key uploaded to backend to enable peers to encrypt messages
//
// 2. AES-256-GCM: Symmetric cryptography for fast bulk message encryption
//    - A fresh AES key is generated for each message
//    - Provides authenticated encryption (prevents tampering)
//    - Much faster than RSA for encrypting large payloads
//
// Flow:
//   Sender:
//   1. Generate random AES key
//   2. Encrypt message plaintext with AES
//   3. Wrap AES key with receiver's public RSA key → for receiver to unwrap
//   4. Also wrap AES key with sender's public RSA key → for sender to access history
//   5. Send (iv, encryptedMessage, encryptedAESKey) to backend
//
//   Receiver:
//   1. Fetch encrypted message from backend
//   2. Use private RSA key to unwrap AES key (receiver's portion)
//   3. Use unwrapped AES key to decrypt message with iv
//   4. Display plaintext
//
// Why this design:
// - Server stays zero-knowledge (cannot decrypt; forwards ciphertext opaquely)
// - Sender can access sent message history (wrapped key with sender's RSA)
// - Symmetric keys are ephemeral (single-use per message, high forward secrecy)
// - Scales well (AES fast even for large messages or groups)

import { apiFetch } from "../Utils/apiFetch";
import type { EncryptedLinkedSecret, Message } from "../types";
import { getUserKeyMaterial, saveUserKeyMaterial } from "./secureStorage";

// ============================================================================
// Type Definitions
// ============================================================================

// EncryptedMessagePayload: Wire format for encrypted messages transmitted over HTTP/WebSocket.
// All values are base64-encoded strings for JSON serialization compatibility.
export interface EncryptedMessagePayload {
  encryptedMessage: string; // Base64-encoded AES-GCM ciphertext
  encryptedAESKey: string; // JSON string containing RSA-wrapped AES keys (receiver & sender)
  iv: string; // Base64-encoded initialization vector (12 bytes for AES-GCM)
}

// UserKeyJwkPair: In-memory representation of a user's asymmetric key pair.
// Both keys are in JSON Web Key (JWK) format for Web Crypto API compatibility.
export interface UserKeyJwkPair {
  publicKey: JsonWebKey; // Public key (shareable; used for encryption by peers)
  privateKey: JsonWebKey; // Private key (secret; stored locally in IndexedDB, never uploaded)
}

// PublicKeyResponse: Server response when fetching a user's public key.
// Allows for both success and error responses in a single interface.
interface PublicKeyResponse {
  status?: "success" | "fail";
  publicKey?: JsonWebKey; // Public key in JWK format
  error?: string; // Error reason if fetch failed
}

// ============================================================================
// Cryptographic Algorithm Configuration Constants
// ============================================================================

// RSA Key Generation Parameters
// - RSA-OAEP: Optimal Asymmetric Encryption Padding (prevents padding oracle attacks)
// - modulusLength 2048: Balances security (2048-bit ≈ 112-bit symmetric equivalent) with performance
// - SHA-256: Hash function for OAEP padding scheme
const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), // Standard: 65537 (0x010001)
  hash: "SHA-256",
};

// RSA Key Import Parameters
// Used when deserializing JWK keys from storage or API responses
const RSA_IMPORT_ALGORITHM: RsaHashedImportParams = {
  name: "RSA-OAEP",
  hash: "SHA-256",
};

// RSA Encryption Parameters (OAEP without hash override)
const RSA_ENCRYPTION_ALGORITHM: RsaOaepParams = {
  name: "RSA-OAEP",
};

// AES-GCM Configuration
// - AES-GCM: Galois/Counter Mode provides authenticated encryption (prevents tampering)
// - 256-bit key: 256-bit symmetric security (quantum-resistant to current standards)
// - 12-byte IV: Recommended for GCM mode (96 bits, 2^32 key/IV pairs before collision risk)
const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12; // 96 bits for GCM

// Text Encoding/Decoding Helpers
const TEXT_ENCODING = new TextEncoder(); // UTF-8 encoder for plaintext → bytes
const TEXT_DECODING = new TextDecoder(); // UTF-8 decoder for bytes → plaintext

// ============================================================================
// Encoding/Decoding Utilities - JSON Transport Layer
// ============================================================================
// Binary cryptographic outputs (ciphertexts, IVs, keys) must be base64-encoded
// for JSON serialization. These helpers bridge binary crypto and text protocols.

// toBase64: Converts raw bytes to base64 string for JSON transport.
// Why needed: Web Crypto API produces ArrayBuffer; JSON only handles strings.
const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const binary = Array.from(new Uint8Array(bytes))
    .map((byte) => String.fromCharCode(byte))
    .join("");

  return btoa(binary);
};

// fromBase64: Converts base64 string back to ArrayBuffer for crypto operations.
// Why needed: Incoming encrypted data is base64-encoded in JSON; must be decoded for decryption.
const fromBase64 = (encoded: string): ArrayBuffer => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

// ============================================================================
// Key Import Helpers - Web Crypto API Wrappers
// ============================================================================
// Convert JWK or raw key material into CryptoKey objects usable by Web Crypto API.

// importPublicKey: Deserializes a public RSA key from JWK format.
// Used for: Encrypting messages with recipient's public key.
const importPublicKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey("jwk", jwk, RSA_IMPORT_ALGORITHM, true, ["encrypt"]);

// importPrivateKey: Deserializes a private RSA key from JWK format.
// Used for: Decrypting the AES key wrapped by sender (accessing own sent messages).
const importPrivateKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey("jwk", jwk, RSA_IMPORT_ALGORITHM, true, ["decrypt"]);

// importAesKey: Deserializes an AES key from raw bytes.
// Used for: Decrypting the message ciphertext after unwrapping the AES key via RSA.
const importAesKey = (rawKey: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", rawKey, { name: AES_ALGORITHM }, true, ["decrypt"]);

const importAesDecryptKey = (rawKey: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", rawKey, { name: AES_ALGORITHM }, true, ["decrypt"]);

// ============================================================================
// Message Decryption Helpers
// ============================================================================

// resolveEncryptedAesKeyForViewer: Selects the correct RSA-wrapped AES key variant
// based on whether the viewer is the sender or receiver.
//
// Why this function exists:
// - encryptedAESKey is stored as a JSON string containing BOTH wrapped variants
// - Sender uses their own wrapped key to access sent message history
// - Receiver uses the receiver-wrapped key to decrypt incoming messages
// - Server can't distinguish who's viewing (stays blind)
//
// Format: {"receiver": "base64...", "sender": "base64..."}
// Each variant is RSA-wrapped with the corresponding user's public key.
const resolveEncryptedAesKeyForViewer = (
  encryptedAESKey: string,
  currentUserId: string,
  senderId: string
): string => {
  try {
    const parsed = JSON.parse(encryptedAESKey) as { receiver?: string; sender?: string };

    // Sender accessing their own message: use sender-wrapped AES key
    if (String(currentUserId) === String(senderId) && parsed.sender) {
      return parsed.sender;
    }

    // Receiver or other viewers: use receiver-wrapped AES key
    if (parsed.receiver) {
      return parsed.receiver;
    }
  } catch {
    // Fallback for legacy messages (single base64 key, not JSON envelope)
  }

  return encryptedAESKey;
};

// decryptTextPayload: Core decryption logic—unwraps AES key and decrypts message.
//
// High-level flow:
// 1. Import user's private RSA key from JWK
// 2. Resolve which AES key variant to use (sender vs. receiver wrapped)
// 3. Use private key to unwrap RSA-encrypted AES key
// 4. Use unwrapped AES key to decrypt message ciphertext with IV
// 5. Decode bytes to UTF-8 string
//
// Why this is separate:
// - Decryption can fail at multiple points; caller handles errors
// - Reused by both direct decryption and batch decryption flows
// - Allows injection of different key material for testing/recovery scenarios

const decryptTextPayload = async (
  payload: EncryptedMessagePayload,
  privateKeyJwk: JsonWebKey,
  currentUserId: string,
  senderId: string
): Promise<string> => {
  const privateKey = await importPrivateKey(privateKeyJwk);
  const encryptedAesKey = resolveEncryptedAesKeyForViewer(
    payload.encryptedAESKey,
    currentUserId,
    senderId
  );

  const aesRawKey = await crypto.subtle.decrypt(
    RSA_ENCRYPTION_ALGORITHM,
    privateKey,
    fromBase64(encryptedAesKey)
  );

  const aesKey = await importAesKey(aesRawKey);
  const decryptedBytes = await crypto.subtle.decrypt(
    {
      name: AES_ALGORITHM,
      iv: new Uint8Array(fromBase64(payload.iv)),
    },
    aesKey,
    fromBase64(payload.encryptedMessage)
  );

  return TEXT_DECODING.decode(decryptedBytes);
};

// buildCorruptedMessage: Creates a degraded message when decryption fails.
//
// Why needed:
// - Decryption can fail if: private key missing, corrupted ciphertext, tampering detected
// - Show user transparency instead of crashing or pretending nothing happened
// - Receiver might later recover the key and re-decrypt (manual refresh button in future UI)
//
// Note: Sets decryptionFailed flag for UI to render error state visually.
const buildCorruptedMessage = (message: Message): Message => ({
  ...message,
  text: "[Unable to decrypt message]",
  message: "[Unable to decrypt message]",
  decryptionFailed: true,
});

// ============================================================================
// Public API - Encryption and Decryption Functions
// ============================================================================

// encryptTextMessage: Hybrid encryption of a plaintext message using RSA+AES.
//
// High-level flow:
//   1. Generate a random AES-256 key (ephemeral, single-use)
//   2. Generate random 96-bit IV for GCM mode
//   3. Encrypt plaintext with AES-GCM using generated key and IV
//   4. Wrap the AES key twice with RSA-OAEP:
//      - Once with receiver's public key (receiver will unwrap with their private key)
//      - Once with sender's public key (sender will unwrap to access own sent messages)
//   5. Return {encryptedMessage, encryptedAESKey (JSON envelope), iv} for transport
//
// Why hybrid approach:
// - RSA alone would be slow and require breaks for large messages
// - AES alone has no key exchange mechanism between strangers
// - RSA provides authenticated asymmetric key exchange; AES provides fast content encryption
// - Ephemeral AES keys limit exposure window (no key reuse across messages)
//
// Security properties:
// - Receiver can decrypt: has private key to unwrap receiver-wrapped AES key
// - Sender can decrypt: has private key to unwrap sender-wrapped AES key
// - Server cannot decrypt: has no private keys
// - Tampering detected: AES-GCM provides authentication tag
//
// When called:
// - useSendMessage hook before sending to backend
// - useMessageActions (edit message) before sending edit payload
//
// Parameters:
//   plainText: Message content to encrypt
//   receiverPublicKeyJwk: Recipient's public key (fetched from backend via API)
//   senderPublicKeyJwk: Sender's public key (own key, from IndexedDB)
//
// Returns: Promise<EncryptedMessagePayload>
//   - All values are base64-encoded strings for JSON transport
//   - encryptedAESKey is a JSON string (not base64) containing {receiver, sender} variants
//
// Errors: Rejects if key generation or encryption fails (rare in production)
export const encryptTextMessage = async (
  plainText: string,
  receiverPublicKeyJwk: JsonWebKey,
  senderPublicKeyJwk: JsonWebKey
): Promise<EncryptedMessagePayload> => {
  // Step 1: Generate ephemeral AES key for this message only
  // Why per-message: Fresh key limits damage if any single key is compromised
  // Why extractable: Must export to raw bytes for RSA wrapping
  const aesKey = await crypto.subtle.generateKey(
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  // Step 2: Generate random IV (initialization vector) for GCM
  // Why random: Prevents identical plaintext from producing identical ciphertext
  // Why 12 bytes: GCM standard recommends 96 bits for performance + security
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  // Step 3: Encrypt plaintext with AES-GCM
  // AES-GCM includes authentication tag; tampering is detected on decrypt
  const encryptedMessage = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv,
    },
    aesKey,
    TEXT_ENCODING.encode(plainText)
  );

  // Step 4: Export AES key as raw bytes (needed for RSA wrapping)
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  
  // Step 5: Import both public keys from JWK format
  const receiverPublicKey = await importPublicKey(receiverPublicKeyJwk);
  const senderPublicKey = await importPublicKey(senderPublicKeyJwk);

  // Step 6: Wrap the AES key with receiver's public key
  // Receiver will use their private key to unwrap this
  const receiverWrappedKey = await crypto.subtle.encrypt(
    RSA_ENCRYPTION_ALGORITHM,
    receiverPublicKey,
    rawAesKey
  );

  // Step 7: Wrap the AES key with sender's public key
  // Sender will use their private key to unwrap this (access own sent messages)
  const senderWrappedKey = await crypto.subtle.encrypt(
    RSA_ENCRYPTION_ALGORITHM,
    senderPublicKey,
    rawAesKey
  );

  // Step 8: Return payload with both wrapped keys in JSON envelope
  // Format allows either participant to decrypt while server stays blind
  return {
    encryptedMessage: toBase64(encryptedMessage),
    encryptedAESKey: JSON.stringify({
      receiver: toBase64(receiverWrappedKey),
      sender: toBase64(senderWrappedKey),
    }),
    iv: toBase64(iv),
  };
};

// decryptMessageIfNeeded: Decrypts a single message if it contains encrypted payload.
//
// Smart decryption strategy:
// - Checks if message has encryption fields (encryptedMessage, encryptedAESKey, iv)
// - If not encrypted, returns message unchanged (non-text messages, legacy plaintext)
// - If encrypted but no private key available, returns degraded message (helpful error)
// - If decryption fails, returns corrupted-message state (transparency on failure)
//
// When called:
// - useListenMessages: decrypt socket messages before state reconciliation
// - getMessage hook: decrypt message history after fetch
// - useMessageActions: decrypt edited messages after receiving edit event
//
// Parameters:
//   message: Message object that may contain encrypted payload
//   currentUserId: ID of user accessing the message (determines which AES key variant to use)
//
// Returns: Promise<Message>
//   - Original message if not encrypted
//   - Decrypted message with plaintext in .text and .message fields
//   - Error message if private key missing or decryption fails
//
// Error handling:
// - Private key unavailable: returns clear error message to user
// - Decryption failure: buildCorruptedMessage shows user something went wrong
export const decryptMessageIfNeeded = async (
  message: Message,
  currentUserId: string
): Promise<Message> => {
  const payloadPresent = Boolean(
    message.encryptedMessage && message.encryptedAESKey && message.iv
  );

  if (message.messageType !== "text" || !payloadPresent) {
    return message;
  }

  const keyMaterial = await getUserKeyMaterial(currentUserId);
  if (!keyMaterial?.privateKeyJwk) {
    return {
      ...message,
      text: "[Encrypted message - private key unavailable]",
      message: "[Encrypted message - private key unavailable]",
      decryptionFailed: true,
    };
  }

  try {
    const decryptedText = await decryptTextPayload(
      {
        encryptedMessage: message.encryptedMessage as string,
        encryptedAESKey: message.encryptedAESKey as string,
        iv: message.iv as string,
      },
      keyMaterial.privateKeyJwk,
      currentUserId,
      message.senderId
    );

    return {
      ...message,
      text: decryptedText,
      message: decryptedText,
      decryptionFailed: false,
    };
  } catch {
    return buildCorruptedMessage(message);
  }
};

// decryptMessagesIfNeeded: Batch decryption helper for message arrays.
//
// Why a separate function:
// - Message history arrives as arrays (e.g., from getMessage hook)
// - Promise.all() parallelizes decryption, improving performance
// - Cleaner API for bulk operations vs. looping over decryptMessageIfNeeded
//
// When called:
// - useGetMessages hook: decrypt history batch before storing in state
// - Initial conversation load: decrypt entire history in parallel
//
// Parameters:
//   messages: Array of message objects to decrypt
//   currentUserId: User ID (passed to each decryptMessageIfNeeded call)
//
// Returns: Promise<Message[]>
//   - Array of messages (original or decrypted)
//   - Order preserved from input
//   - Failed decryptions replaced with error messages (not rejected)
export const decryptMessagesIfNeeded = async (
  messages: Message[],
  currentUserId: string
): Promise<Message[]> => {
  return Promise.all(messages.map((message) => decryptMessageIfNeeded(message, currentUserId)));
};

// ============================================================================
// Private Helpers - Key Generation and Backend Sync
// ============================================================================

// generateKeyPair: Creates a new RSA-2048 public/private key pair.
//
// Why this is private:
// - Only called by ensureUserKeyPair (main key pair orchestrator)
// - Prevents accidental key regeneration from other parts of the codebase
//
// Key properties:
// - RSA-2048-OAEP (same algorithm as imports/exports)
// - Extractable: true (allows export to JWK for IndexedDB storage)
// - Usable for: encryption (public key) and decryption (private key)
//
// Returns: Promise<UserKeyJwkPair>
//   - Both keys exported to JSON Web Key (JWK) format
//   - Ready for: storage in IndexedDB, upload to backend, or crypto operations
//
// Errors: Rejects if browser crypto API unavailable or quota exceeded (very rare)
const generateKeyPair = async (): Promise<UserKeyJwkPair> => {
  const keyPair = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ["encrypt", "decrypt"]);

  return {
    publicKey: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", keyPair.privateKey),
  };
};

export const requireUserKeyPair = async (userId: string): Promise<UserKeyJwkPair> => {
  const existing = await getUserKeyMaterial(userId);

  if (!existing?.privateKeyJwk || !existing?.publicKeyJwk) {
    throw new Error("This device has no local E2EE key. Complete device approval first.");
  }

  return {
    publicKey: existing.publicKeyJwk,
    privateKey: existing.privateKeyJwk,
  };
};

export const createTemporaryLinkKeyPair = async (): Promise<UserKeyJwkPair> => {
  return generateKeyPair();
};

export const encryptLinkedSecretForDevice = async (
  plaintextSecret: string,
  targetTempPublicKeyJwk: JsonWebKey
): Promise<EncryptedLinkedSecret> => {
  const tempPublicKey = await importPublicKey(targetTempPublicKeyJwk);
  const aesKey = await crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const encryptedPayload = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    aesKey,
    TEXT_ENCODING.encode(plaintextSecret)
  );

  const encryptedAesKey = await crypto.subtle.encrypt(
    RSA_ENCRYPTION_ALGORITHM,
    tempPublicKey,
    rawAesKey
  );

  return {
    encryptedPayload: toBase64(encryptedPayload),
    encryptedAesKey: toBase64(encryptedAesKey),
    iv: toBase64(iv),
  };
};

export const decryptLinkedSecretFromDevice = async (
  encryptedSecret: EncryptedLinkedSecret,
  tempPrivateKeyJwk: JsonWebKey
): Promise<string> => {
  const tempPrivateKey = await importPrivateKey(tempPrivateKeyJwk);

  const rawAesKey = await crypto.subtle.decrypt(
    RSA_ENCRYPTION_ALGORITHM,
    tempPrivateKey,
    fromBase64(encryptedSecret.encryptedAesKey)
  );

  const aesKey = await importAesDecryptKey(rawAesKey);
  const decryptedPayload = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: new Uint8Array(fromBase64(encryptedSecret.iv)) },
    aesKey,
    fromBase64(encryptedSecret.encryptedPayload)
  );

  return TEXT_DECODING.decode(decryptedPayload);
};

// savePublicKey: Uploads user's public key to the backend.
//
// Why only public key is sent:
// - Private key never leaves the browser (preserves E2EE)
// - Public key on backend enables peers to encrypt messages to this user
// - Server cannot decrypt messages without private key
// - Supports distributed decryption (recipient can decrypt via public key)
//
// When called:
// - ensureUserKeyPair: after generating new key pair or loading existing keys
// - Auth-Context login flow: bootstrap E2EE during session start
//
// Parameters:
//   publicKey: JsonWebKey (public key in JWK format)
//
// Returns: Promise<void> (resolves if upload succeeds)
//
// Errors:
// - Rejects if API returns status='fail' or response parsing fails
// - Network errors propagate to caller (will be caught in Auth-Context error handler)
// - 401 response (token expired) handled by apiFetch middleware
export const savePublicKey = async (publicKey: JsonWebKey): Promise<void> => {
  const response = await apiFetch<{ status?: "success" | "fail"; message?: string }>(
    "/users/public-key",
    {
      method: "POST",
      body: JSON.stringify({ publicKey }),
    }
  );

  if (response.status === "fail") {
    throw new Error(response.message || "Failed to save public key");
  }
};

// getPublicKeyByUserId: Fetches a user's public key from the backend for encryption.
//
// Cross-peer encryption flow:
// 1. Before sending a message, call this to fetch recipient's public key
// 2. Pass public key to encryptTextMessage() to wrap the AES key
// 3. Send encrypted payload to backend
// 4. Recipient fetches and decrypts (using their private key)
//
// When called:
// - useSendMessage hook: get recipient's public key before encryption
// - useMessageActions (edit): get recipient's public key before re-encrypting edit
//
// Parameters:
//   userId: ID of the user whose public key to fetch
//
// Returns: Promise<JsonWebKey>
//   - Public key in JWK format, ready for crypto.subtle.importKey()
//
// Errors:
// - Rejects if user has no public key on backend (E2EE not set up for them)
// - Rejects if API error or 404 (user not found)
// - Network errors propagate; 401 handled by apiFetch middleware
export const getPublicKeyByUserId = async (userId: string): Promise<JsonWebKey> => {
  const response = await apiFetch<PublicKeyResponse>(`/users/${userId}/public-key`, {
    method: "GET",
  });

  if (response.error || !response.publicKey) {
    throw new Error(response.error || "Recipient public key is not available");
  }

  return response.publicKey;
};

// ensureUserKeyPair: Orchestrates key pair initialization for the logged-in user.
//
// Three scenarios handled:
// 1. User has stored keys (device already initialized):
//    - Reuse keys and re-upload public key to backend (idempotent)
//    - Continue with existing identity
// 2. User has no keys (first device or new browser):
//    - Generate fresh RSA-2048 key pair
//    - Store private key in IndexedDB (device-local only)
//    - Upload public key to backend
// 3. Storage error or key mismatch:
//    - Throw error; caller decides recovery (re-login, key migration, etc.)
//
// Why this is centralized:
// - Called once per browser session (during Auth-Context login)
// - Guarantees keys exist before encryption ops attempted
// - Handles both fresh and returning users
// - Clear error messages for recovery flows
//
// When called:
// - Auth-Context on successful login
// - Fallback in other hooks if caller detects missing keys
//
// Parameters:
//   userId: Authenticated user's ID
//
// Returns: Promise<UserKeyJwkPair>
//   - Both public and private keys in JWK format
//   - Private key ready for IndexedDB, public key uploaded to backend
//   - Ready for encryption/decryption flows
//
// Errors:
// - Rejects if key generation fails (rare)
// - Rejects if public key upload fails (network, auth, quota)
// - Rejects if IndexedDB storage fails (full quota, permission denied)
export const ensureUserKeyPair = async (userId: string): Promise<UserKeyJwkPair> => {
  // Check if user already has stored keys (returning user or device)
  const existing = await getUserKeyMaterial(userId);

  if (existing?.privateKeyJwk && existing?.publicKeyJwk) {
    // Reuse existing keys: re-sync public key with backend (idempotent)
    await savePublicKey(existing.publicKeyJwk);
    return {
      publicKey: existing.publicKeyJwk,
      privateKey: existing.privateKeyJwk,
    };
  }

  // Fresh key pair needed: generate, store, and upload
  const nextPair = await generateKeyPair();

  // Store in IndexedDB (private key device-local, never leaves browser)
  await saveUserKeyMaterial({
    userId,
    publicKeyJwk: nextPair.publicKey,
    privateKeyJwk: nextPair.privateKey,
    updatedAt: Date.now(),
  });

  // Upload public key to backend (enables peers to encrypt to this user)
  await savePublicKey(nextPair.publicKey);
  
  return nextPair;
};

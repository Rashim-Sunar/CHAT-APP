// ----------------------------------------
// @file   backupCrypto.ts
// @desc   Client-side private key backup encryption/decryption helpers
// ----------------------------------------

const PBKDF2_ITERATIONS = 210_000;
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Normalizes a Uint8Array into a tightly scoped ArrayBuffer view.
// Used before Web Crypto calls because strict TS typings may reject
// Uint8Array buffers that are wider than the intended byte range.
const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

// Encodes binary crypto output into Base64 for safe JSON transport/storage.
// Backup payloads are persisted/transmitted as strings, so ciphertext,
// salts, and IVs must be converted from bytes without losing fidelity.
const toBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';

  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index]);
  }

  return btoa(binary);
};

// Decodes Base64 text back into raw bytes for Web Crypto operations.
// Used when reading stored ciphertext parameters so decrypt/derive calls
// receive binary inputs (ciphertext, salt, IV) instead of JSON strings.
const fromBase64 = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

/**
 * Derives a strong AES key from a user password using PBKDF2.
 * Used during backup setup and restore to slow brute-force attempts against
 * stolen ciphertext by forcing expensive key derivation work per guess.
 */
export const deriveKeyFromPassword = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  const passwordBytes = textEncoder.encode(password);

  try {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: asArrayBuffer(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: AES_KEY_LENGTH,
      },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    passwordBytes.fill(0);
  }
};

/**
 * Encrypts exported private-key JWK with a password-derived AES-GCM key.
 * Used only on trusted clients so plaintext private key and password never
 * leave the browser before sending opaque ciphertext to the server.
 */
export const encryptPrivateKey = async (
  privateKeyJwk: JsonWebKey,
  password: string
): Promise<{ cipher: string; salt: string; iv: string }> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKeyFromPassword(password, salt);
  const payloadBytes = textEncoder.encode(JSON.stringify(privateKeyJwk));

  try {
    // AES-GCM provides confidentiality and integrity checks for backup blobs.
    const cipherBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: asArrayBuffer(iv),
      },
      key,
      payloadBytes
    );

    return {
      cipher: toBase64(cipherBuffer),
      salt: toBase64(salt),
      iv: toBase64(iv),
    };
  } finally {
    payloadBytes.fill(0);
  }
};

/**
 * Decrypts encrypted private-key backup using the provided password.
 * Used on new devices during recovery; a wrong password or tampered ciphertext
 * fails closed because AES-GCM authentication throws during decrypt.
 */
export const decryptPrivateKey = async (
  cipher: string,
  password: string,
  saltBase64: string,
  ivBase64: string
): Promise<JsonWebKey> => {
  const salt = fromBase64(saltBase64);
  const iv = fromBase64(ivBase64);
  const cipherBytes = fromBase64(cipher);
  const key = await deriveKeyFromPassword(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asArrayBuffer(iv),
      },
      key,
      asArrayBuffer(cipherBytes)
    );

    return JSON.parse(textDecoder.decode(decryptedBuffer)) as JsonWebKey;
  } finally {
    salt.fill(0);
    iv.fill(0);
    cipherBytes.fill(0);
  }
};

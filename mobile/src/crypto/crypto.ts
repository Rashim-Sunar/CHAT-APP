// Ported from frontend/src/Utils/crypto.ts — phase-1 subset only (direct
// 1:1 messaging). Device-linking (createTemporaryLinkKeyPair,
// encrypt/decryptLinkedSecretForDevice) and backupCrypto.ts's password
// backup are NOT ported — confirmed cleanly separable, zero imports from
// this file on the web side.
//
// Relies on `crypto.subtle`/`crypto.getRandomValues` being patched onto the
// global scope by ../crypto/webcryptoPolyfill.ts (imported once, at the top
// of app/_layout.tsx, before this module is ever used) — same ambient-global
// pattern the web version relies on via the browser's native Web Crypto API.
import { apiFetch } from "../api/client";
import type { Message } from "../types";
import { getUserKeyMaterial, saveUserKeyMaterial } from "./secureStorage";

export interface EncryptedAesKeyEntry {
  userId: string;
  wrappedKey: string;
}

export interface EncryptedMessagePayload {
  encryptedMessage: string;
  encryptedAESKeys: EncryptedAesKeyEntry[];
  iv: string;
}

export interface RecipientPublicKey {
  userId: string;
  publicKeyJwk: JsonWebKey;
}

export interface UserKeyJwkPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

export interface EncryptedLinkedSecret {
  encryptedPayload: string;
  encryptedAesKey: string;
  iv: string;
}

const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};
const RSA_IMPORT_ALGORITHM: RsaHashedImportParams = { name: "RSA-OAEP", hash: "SHA-256" };
const RSA_ENCRYPTION_ALGORITHM: RsaOaepParams = { name: "RSA-OAEP" };
const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12;

const TEXT_ENCODING = new TextEncoder();
const TEXT_DECODING = new TextDecoder();

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const binary = Array.from(new Uint8Array(bytes))
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary);
};

const fromBase64 = (encoded: string): ArrayBuffer => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const importPublicKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey("jwk", jwk, RSA_IMPORT_ALGORITHM, true, ["encrypt"]);

const importPrivateKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey("jwk", jwk, RSA_IMPORT_ALGORITHM, true, ["decrypt"]);

const importAesKey = (rawKey: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", rawKey, { name: AES_ALGORITHM }, true, ["decrypt"]);

// Works identically for direct (2 entries) and group (N entries) messages —
// phase 1 only ever sends direct, but the receive path is left general so a
// later phase's group messages decrypt with zero changes here.
const resolveWrappedAesKeyForViewer = (message: Message, currentUserId: string): string | null => {
  if (Array.isArray(message.encryptedAESKeys) && message.encryptedAESKeys.length > 0) {
    const entry = message.encryptedAESKeys.find((candidate) => candidate.userId === currentUserId);
    return entry?.wrappedKey || null;
  }

  if (typeof message.encryptedAESKey === "string") {
    try {
      const parsed = JSON.parse(message.encryptedAESKey) as { receiver?: string; sender?: string };
      if (String(currentUserId) === String(message.senderId) && parsed.sender) return parsed.sender;
      if (parsed.receiver) return parsed.receiver;
    } catch {
      return message.encryptedAESKey;
    }
  }

  return null;
};

const decryptTextPayload = async (
  encryptedMessage: string,
  wrappedAesKeyBase64: string,
  iv: string,
  privateKeyJwk: JsonWebKey
): Promise<string> => {
  const privateKey = await importPrivateKey(privateKeyJwk);
  const aesRawKey = await crypto.subtle.decrypt(RSA_ENCRYPTION_ALGORITHM, privateKey, fromBase64(wrappedAesKeyBase64));
  const aesKey = await importAesKey(aesRawKey);
  const decryptedBytes = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: new Uint8Array(fromBase64(iv)) },
    aesKey,
    fromBase64(encryptedMessage)
  );
  return TEXT_DECODING.decode(decryptedBytes);
};

const buildCorruptedMessage = (message: Message): Message => ({
  ...message,
  text: "[Unable to decrypt message]",
  message: "[Unable to decrypt message]",
  decryptionFailed: true,
});

// Wraps the AES key once per recipient — 2 entries for phase-1 direct
// messages (receiver + sender's own copy). Callers must include the sender
// in `recipients` to be able to re-read their own sent history.
export const encryptTextMessageForRecipients = async (
  plainText: string,
  recipients: RecipientPublicKey[]
): Promise<EncryptedMessagePayload> => {
  if (recipients.length === 0) {
    throw new Error("At least one recipient is required to encrypt a message");
  }

  const aesKey = await crypto.subtle.generateKey({ name: AES_ALGORITHM, length: AES_KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const encryptedMessage = await crypto.subtle.encrypt({ name: AES_ALGORITHM, iv }, aesKey, TEXT_ENCODING.encode(plainText));
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const encryptedAESKeys = await Promise.all(
    recipients.map(async (recipient) => {
      const publicKey = await importPublicKey(recipient.publicKeyJwk);
      const wrapped = await crypto.subtle.encrypt(RSA_ENCRYPTION_ALGORITHM, publicKey, rawAesKey);
      return { userId: recipient.userId, wrappedKey: toBase64(wrapped) };
    })
  );

  return {
    encryptedMessage: toBase64(encryptedMessage),
    encryptedAESKeys,
    iv: toBase64(iv),
  };
};

export const decryptMessageIfNeeded = async (message: Message, currentUserId: string): Promise<Message> => {
  if (message.deletedForEveryone) {
    return message;
  }

  const hasKeyMaterial =
    (Array.isArray(message.encryptedAESKeys) && message.encryptedAESKeys.length > 0) ||
    typeof message.encryptedAESKey === "string";
  const payloadPresent = Boolean(message.encryptedMessage && message.iv && hasKeyMaterial);

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

  const wrappedAesKey = resolveWrappedAesKeyForViewer(message, currentUserId);
  if (!wrappedAesKey) {
    return buildCorruptedMessage(message);
  }

  try {
    const decryptedText = await decryptTextPayload(
      message.encryptedMessage as string,
      wrappedAesKey,
      message.iv as string,
      keyMaterial.privateKeyJwk
    );

    return { ...message, text: decryptedText, message: decryptedText, decryptionFailed: false };
  } catch {
    return buildCorruptedMessage(message);
  }
};

export const decryptMessagesIfNeeded = async (messages: Message[], currentUserId: string): Promise<Message[]> => {
  return Promise.all(messages.map((message) => decryptMessageIfNeeded(message, currentUserId)));
};

const generateKeyPair = async (): Promise<UserKeyJwkPair> => {
  const keyPair = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ["encrypt", "decrypt"]);
  return {
    publicKey: (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey,
    privateKey: (await crypto.subtle.exportKey("jwk", keyPair.privateKey)) as JsonWebKey,
  };
};

export const requireUserKeyPair = async (userId: string): Promise<UserKeyJwkPair> => {
  const existing = await getUserKeyMaterial(userId);
  if (!existing?.privateKeyJwk || !existing?.publicKeyJwk) {
    throw new Error("This device has no local E2EE key. Log in again to generate one.");
  }
  return { publicKey: existing.publicKeyJwk, privateKey: existing.privateKeyJwk };
};

export const savePublicKey = async (publicKey: JsonWebKey): Promise<void> => {
  const response = await apiFetch<{ status?: "success" | "fail"; message?: string }>("/users/public-key", {
    method: "POST",
    body: JSON.stringify({ publicKey }),
  });

  if (response.status === "fail") {
    throw new Error(response.message || "Failed to save public key");
  }
};

const recipientPublicKeyCache = new Map<string, JsonWebKey>();

interface PublicKeysBatchResponse {
  status?: "success" | "fail";
  publicKeys?: Record<string, JsonWebKey | null>;
  error?: string;
}

export const getRecipientPublicKeys = async (userIds: string[]): Promise<RecipientPublicKey[]> => {
  const uniqueUserIds = [...new Set(userIds)];
  const uncachedUserIds = uniqueUserIds.filter((userId) => !recipientPublicKeyCache.has(userId));

  if (uncachedUserIds.length > 0) {
    const response = await apiFetch<PublicKeysBatchResponse>("/users/public-keys", {
      method: "POST",
      body: JSON.stringify({ userIds: uncachedUserIds }),
    });

    Object.entries(response.publicKeys || {}).forEach(([userId, publicKey]) => {
      if (publicKey) recipientPublicKeyCache.set(userId, publicKey);
    });
  }

  return uniqueUserIds
    .filter((userId) => recipientPublicKeyCache.has(userId))
    .map((userId) => ({ userId, publicKeyJwk: recipientPublicKeyCache.get(userId) as JsonWebKey }));
};

// Generates a keypair only when this device has none. Callers must gate on
// whether the account already has a server-side public key — regenerating for
// an account that has one overwrites it and strands every existing message.
export const ensureUserKeyPair = async (userId: string): Promise<UserKeyJwkPair> => {
  const existing = await getUserKeyMaterial(userId);

  if (existing?.privateKeyJwk && existing?.publicKeyJwk) {
    await savePublicKey(existing.publicKeyJwk);
    return { publicKey: existing.publicKeyJwk, privateKey: existing.privateKeyJwk };
  }

  const nextPair = await generateKeyPair();

  await saveUserKeyMaterial({
    userId,
    publicKeyJwk: nextPair.publicKey,
    privateKeyJwk: nextPair.privateKey,
    updatedAt: Date.now(),
  });

  await savePublicKey(nextPair.publicKey);

  return nextPair;
};

export const createTemporaryLinkKeyPair = (): Promise<UserKeyJwkPair> => generateKeyPair();

export const encryptLinkedSecretForDevice = async (
  plaintextSecret: string,
  targetTempPublicKeyJwk: JsonWebKey
): Promise<EncryptedLinkedSecret> => {
  const tempPublicKey = await importPublicKey(targetTempPublicKeyJwk);
  const aesKey = await crypto.subtle.generateKey({ name: AES_ALGORITHM, length: AES_KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const encryptedPayload = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    aesKey,
    TEXT_ENCODING.encode(plaintextSecret)
  );
  const encryptedAesKey = await crypto.subtle.encrypt(RSA_ENCRYPTION_ALGORITHM, tempPublicKey, rawAesKey);

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

  const aesKey = await importAesKey(rawAesKey);
  const decryptedPayload = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: new Uint8Array(fromBase64(encryptedSecret.iv)) },
    aesKey,
    fromBase64(encryptedSecret.encryptedPayload)
  );

  return TEXT_DECODING.decode(decryptedPayload);
};

export const assertPrivateKeyJwk = async (privateKeyJwk: JsonWebKey): Promise<void> => {
  await crypto.subtle.importKey("jwk", privateKeyJwk, RSA_IMPORT_ALGORITHM, true, ["decrypt"]);
};

export const storeLinkedKeyMaterial = async (userId: string, pair: UserKeyJwkPair): Promise<void> => {
  await saveUserKeyMaterial({
    userId,
    publicKeyJwk: pair.publicKey,
    privateKeyJwk: pair.privateKey,
    updatedAt: Date.now(),
  });
  await savePublicKey(pair.publicKey);
};

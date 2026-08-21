// Password-derived encryption for private-key backup. Ported from the web
// client — the password and plaintext key never leave the device; the server
// only ever stores opaque ciphertext.
const PBKDF2_ITERATIONS = 210_000;
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const toBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index]);
  }
  return btoa(binary);
};

const fromBase64 = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const passwordKey = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptPrivateKey = async (
  privateKeyJwk: JsonWebKey,
  password: string
): Promise<{ cipher: string; salt: string; iv: string }> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKeyFromPassword(password, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    textEncoder.encode(JSON.stringify(privateKeyJwk))
  );

  return { cipher: toBase64(cipherBuffer), salt: toBase64(salt), iv: toBase64(iv) };
};

// A wrong password or tampered ciphertext fails closed — AES-GCM throws on
// authentication failure rather than returning garbage.
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

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(cipherBytes)
  );

  return JSON.parse(textDecoder.decode(decryptedBuffer)) as JsonWebKey;
};

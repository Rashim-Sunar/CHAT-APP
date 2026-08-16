// Ported from frontend/src/Utils/secureStorage.ts (IndexedDB) — same
// three-function boundary (saveUserKeyMaterial/getUserKeyMaterial/
// deleteUserKeyMaterial), backed by expo-secure-store instead.
//
// expo-secure-store has a hard ~2048-byte-per-value limit on Android
// (SharedPreferences-backed). An RSA-2048 private key JWK (n, d, p, q, dp,
// dq, qi + metadata) commonly serializes to ~1700-1900 bytes as JSON —
// close enough to the limit that it's not safe to assume it always fits.
// Rather than gamble on one key's exact size, every value is chunked into
// fixed-size pieces and reassembled on read — this is safe regardless of
// how large a given JWK turns out to be.
import * as SecureStore from "expo-secure-store";

export interface StoredUserKeyMaterial {
  userId: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  updatedAt: number;
}

const CHUNK_SIZE = 1800;

const chunkKey = (baseKey: string, index: number): string => `${baseKey}__${index}`;
const countKey = (baseKey: string): string => `${baseKey}__count`;

const setChunkedItem = async (baseKey: string, value: string): Promise<void> => {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  // A record with no content (shouldn't happen here, but keep it valid).
  if (chunks.length === 0) chunks.push("");

  await SecureStore.setItemAsync(countKey(baseKey), String(chunks.length));
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(baseKey, index), chunk)));
};

const getChunkedItem = async (baseKey: string): Promise<string | null> => {
  const countRaw = await SecureStore.getItemAsync(countKey(baseKey));
  if (!countRaw) return null;

  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) return null;

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(baseKey, index)))
  );

  if (chunks.some((chunk) => chunk === null)) return null;

  return chunks.join("");
};

const deleteChunkedItem = async (baseKey: string): Promise<void> => {
  const countRaw = await SecureStore.getItemAsync(countKey(baseKey));
  const count = countRaw ? Number(countRaw) : 0;

  const deletions = [SecureStore.deleteItemAsync(countKey(baseKey))];
  for (let index = 0; index < count; index += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(baseKey, index)));
  }
  await Promise.all(deletions);
};

const recordKeyFor = (userId: string): string => `e2ee-keymaterial-${userId}`;

export const saveUserKeyMaterial = async (record: StoredUserKeyMaterial): Promise<void> => {
  await setChunkedItem(recordKeyFor(record.userId), JSON.stringify(record));
};

export const getUserKeyMaterial = async (userId: string): Promise<StoredUserKeyMaterial | null> => {
  const raw = await getChunkedItem(recordKeyFor(userId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUserKeyMaterial;
  } catch {
    return null;
  }
};

export const deleteUserKeyMaterial = async (userId: string): Promise<void> => {
  await deleteChunkedItem(recordKeyFor(userId));
};

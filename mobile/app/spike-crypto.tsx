// Spike 2 (see plan): confirms react-native-quick-crypto's WebCrypto
// polyfill actually supports, at runtime, everything crypto.ts needs —
// RSA-OAEP-2048 keygen + JWK import/export + wrap/unwrap, and AES-256-GCM
// keygen + encrypt/decrypt — before the real crypto.ts port is written.
// This mirrors encryptTextMessageForRecipients/decryptMessageIfNeeded's
// exact operations, just inline and self-checking.
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

type LogEntry = { label: string; ok: boolean; detail?: string };

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
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

const runCryptoSpike = async (log: (entry: LogEntry) => void): Promise<void> => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const plainText = "spike-2 round-trip test message";

  // Step 1: RSA-OAEP-2048 keypair generation.
  const keyPair = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ["encrypt", "decrypt"]);
  log({ label: "1. Generate RSA-OAEP-2048 keypair", ok: true });

  // Step 2: export both keys to JWK (what secureStorage.ts persists).
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  log({ label: "2. Export public+private key to JWK", ok: true });

  // Step 3: re-import from JWK (what happens on every app load from SecureStore).
  const importedPublicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    RSA_IMPORT_ALGORITHM,
    true,
    ["encrypt"]
  );
  const importedPrivateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    RSA_IMPORT_ALGORITHM,
    true,
    ["decrypt"]
  );
  log({ label: "3. Re-import both keys from JWK", ok: true });

  // Step 4: fresh AES-256-GCM key + random IV (one per message).
  const aesKey = await crypto.subtle.generateKey({ name: AES_ALGORITHM, length: AES_KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  log({ label: "4. Generate AES-256-GCM key + IV", ok: true });

  // Step 5: AES-GCM encrypt the plaintext once.
  const encryptedMessage = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    aesKey,
    textEncoder.encode(plainText)
  );
  log({ label: "5. AES-GCM encrypt plaintext", ok: true });

  // Step 6: RSA-OAEP wrap the AES key with the (re-imported) public key.
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const wrappedAesKey = await crypto.subtle.encrypt(RSA_ENCRYPTION_ALGORITHM, importedPublicKey, rawAesKey);
  log({ label: "6. RSA-OAEP wrap AES key with public key", ok: true });

  // Step 7: RSA-OAEP unwrap with the (re-imported) private key — the receiver side.
  const unwrappedRawAesKey = await crypto.subtle.decrypt(
    RSA_ENCRYPTION_ALGORITHM,
    importedPrivateKey,
    wrappedAesKey
  );
  log({ label: "7. RSA-OAEP unwrap AES key with private key", ok: true });

  // Step 8: import the recovered raw bytes back as a usable AES CryptoKey.
  const recoveredAesKey = await crypto.subtle.importKey(
    "raw",
    unwrappedRawAesKey,
    { name: AES_ALGORITHM },
    true,
    ["decrypt"]
  );
  log({ label: "8. Import recovered AES key", ok: true });

  // Step 9: AES-GCM decrypt with the recovered key + original IV.
  const decryptedBytes = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv },
    recoveredAesKey,
    encryptedMessage
  );
  const decryptedText = textDecoder.decode(decryptedBytes);
  log({
    label: "9. AES-GCM decrypt ciphertext",
    ok: decryptedText === plainText,
    detail: decryptedText === plainText ? undefined : `Got "${decryptedText}", expected "${plainText}"`,
  });

  // Step 10: base64 round-trip (btoa/atob) — the wire-format encoding step.
  const encoded = toBase64(encryptedMessage);
  const decoded = new Uint8Array(fromBase64(encoded));
  const original = new Uint8Array(encryptedMessage);
  const base64Matches = decoded.length === original.length && decoded.every((byte, i) => byte === original[i]);
  log({
    label: "10. base64 encode/decode round-trip (btoa/atob)",
    ok: base64Matches,
    detail: base64Matches ? undefined : "Decoded bytes did not match original ciphertext",
  });
};

export default function SpikeCryptoScreen() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setEntries([]);
    setFatalError(null);

    const collected: LogEntry[] = [];
    const log = (entry: LogEntry) => {
      collected.push(entry);
      setEntries([...collected]);
    };

    try {
      await runCryptoSpike(log);
    } catch (error: unknown) {
      setFatalError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    } finally {
      setRunning(false);
    }
  };

  const allPassed = entries.length > 0 && entries.every((entry) => entry.ok) && !fatalError;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Spike 2 — WebCrypto polyfill</Text>
      <Text style={styles.subtitle}>
        RSA-OAEP-2048 + AES-256-GCM round trip via react-native-quick-crypto, matching crypto.ts exactly.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleRun} disabled={running}>
        <Text style={styles.buttonText}>{running ? "Running..." : "Run spike test"}</Text>
      </TouchableOpacity>

      {entries.map((entry, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.status, entry.ok ? styles.pass : styles.fail]}>{entry.ok ? "PASS" : "FAIL"}</Text>
          <View style={styles.rowText}>
            <Text style={styles.label}>{entry.label}</Text>
            {entry.detail && <Text style={styles.detail}>{entry.detail}</Text>}
          </View>
        </View>
      ))}

      {fatalError && (
        <View style={styles.row}>
          <Text style={[styles.status, styles.fail]}>FAIL</Text>
          <View style={styles.rowText}>
            <Text style={styles.label}>Threw before completing</Text>
            <Text style={styles.detail}>{fatalError}</Text>
          </View>
        </View>
      )}

      {entries.length > 0 && !running && (
        <Text style={[styles.summary, allPassed ? styles.pass : styles.fail]}>
          {allPassed ? "All checks passed — safe to build the real crypto.ts port." : "Some checks failed — see above."}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 8 },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rowText: { flex: 1 },
  status: { fontWeight: "700", width: 44 },
  pass: { color: "#059669" },
  fail: { color: "#dc2626" },
  label: { fontSize: 14 },
  detail: { fontSize: 12, color: "#dc2626", marginTop: 2 },
  summary: { fontSize: 14, fontWeight: "600", marginTop: 12 },
});

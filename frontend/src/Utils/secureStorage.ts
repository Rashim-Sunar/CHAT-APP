// ============================================================================
// IndexedDB Configuration - E2EE Private Key Storage
// ============================================================================
// IndexedDB is used (over localStorage) to store private key material because:
// 1. Supports arbitrarily large structured data (JSON keys can exceed localStorage limits)
// 2. Provides better encapsulation—key material is stored as binary/structured objects,
//    not as plain string values that might leak in debugging tools or memory dumps
// 3. Offers transactional semantics and better error handling than localStorage

const DB_NAME = "chat-app-e2ee";
const DB_VERSION = 1;
const KEY_STORE = "private-keys";

// StoredUserKeyMaterial: Opaque record serialized into IndexedDB.
// Contains both public and private keys in JWK format, plus timestamp for key rotation audits.
// IMPORTANT: Private key material in this record is NEVER sent to backend—device local only.
export interface StoredUserKeyMaterial {
  userId: string; // Primary key for indexing
  publicKeyJwk: JsonWebKey; // Public key (safe to share with peers for message encryption)
  privateKeyJwk: JsonWebKey; // Private key (NEVER leaves device; used for message decryption only)
  updatedAt: number; // Timestamp (ms since epoch) for audit trail and key rotation detection
}

// ============================================================================
// Database Initialization - IDBDatabase Lifecycle
// ============================================================================
// Opens or upgrades the E2EE IndexedDB database. Handles version migration
// and object store creation in the onupgradeneeded callback.
// Returns: Promise<IDBDatabase> — ready-to-use database connection
const openKeyDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    // Step 1: Request database open with version check
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Step 2: Handle initialization errors
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open key database"));
    };

    // Step 3: Schema setup on first open or version upgrade
    // Creates the object store if it doesn't exist (idempotent after first run)
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_STORE)) {
        // userId is the primary key, enabling fast lookups by user ID
        database.createObjectStore(KEY_STORE, { keyPath: "userId" });
      }
    };

    // Step 4: Resolve when database is open and ready
    request.onsuccess = () => {
      resolve(request.result);
    };
  });

// ============================================================================
// Transactional Store Handler - Generic IndexedDB Operation Wrapper
// ============================================================================
// Generic helper that abstracts the IDBTransaction lifecycle and error handling.
// Ensures database connections are properly closed after operations complete.
// 
// Type parameter T: Result type of the handler function (e.g., void for writes, 
//                   StoredUserKeyMaterial for reads)
// 
// Why this wrapper?
// - IDBRequest requires callback-based error/success handling (no async/await)
// - Wrapping in a Promise provides consistent error semantics across all operations
// - Ensures database close() is called to release connection resources
// - Catches synchronous errors (e.g., invalid transaction mode) in try/catch
const runStoreRequest = <T>(
  mode: IDBTransactionMode,
  // handler: callback that receives an IDBObjectStore and returns an IDBRequest
  // The handler is responsible for constructing the actual put/get/delete operation
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> =>
  new Promise(async (resolve, reject) => {
    try {
      // Step 1: Open database connection (creates if needed)
      const database = await openKeyDatabase();
      
      // Step 2: Begin transaction with specified mode (readonly or readwrite)
      const transaction = database.transaction(KEY_STORE, mode);
      const store = transaction.objectStore(KEY_STORE);
      
      // Step 3: Delegate to handler to construct the actual IDBRequest operation
      const request = handler(store);

      // Step 4: Handle request-level errors (e.g., constraint violations)
      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB request failed"));
      };

      // Step 5: Extract and resolve result on request success
      request.onsuccess = () => {
        resolve(request.result);
      };

      // Step 6: Clean up database connection when transaction completes
      transaction.oncomplete = () => {
        database.close();
      };

      // Step 7: Handle transaction-level errors (e.g., abort or constraint failure)
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      };
    } catch (error) {
      // Catch synchronous errors (e.g., quota exceeded, invalid parameters)
      reject(error);
    }
  });

// ============================================================================
// Public API - Key Pair Storage Operations
// ============================================================================

// saveUserKeyMaterial: Persists the user's public and private key pair to IndexedDB.
//
// Why IndexedDB and not localStorage?
// - Private keys are sensitive; IndexedDB avoids exposing them as plaintext strings
// - Provides transactional safety and quota management
// - Supports structured objects larger than localStorage limits
//
// When called:
// - During Auth-Context login after ensureUserKeyPair() generates or fetches keys
// - Enables offline decryption of cached/buffered messages
// - Record includes updatedAt timestamp for future key rotation audits
//
// Parameters:
//   record: StoredUserKeyMaterial containing userId, publicKeyJwk, privateKeyJwk,
//           and updatedAt timestamp
// Returns: Promise<void> (resolves after write completes)
// Errors: Rejects if IndexedDB quota exceeded or transaction fails
export const saveUserKeyMaterial = async (record: StoredUserKeyMaterial): Promise<void> => {
  await runStoreRequest<void>(
    "readwrite",
    (store) => store.put(record) as unknown as IDBRequest<void>
  );
};

// getUserKeyMaterial: Retrieves the user's stored key pair from IndexedDB by userId.
//
// Why this function exists:
// - Used by crypto.ts when decrypting incoming messages or edits
// - Avoids exposing private keys as localStorage strings
// - Enables offline decryption (e.g., if server is unreachable)
// - Returns null if user has no stored keys (should regenerate or restore)
//
// When called:
// - During message decryption (useListenMessages, getMessage hook)
// - User clicks "decrypt this message" (manual decryption UI)
// - Key rotation/recovery flows check for existing material
//
// Parameters:
//   userId: The ID of the user whose keys to retrieve
// Returns: Promise<StoredUserKeyMaterial | null>
//          - Returns stored record on success
//          - Returns null if no keys found for this userId
// Errors: Rejects if IndexedDB transaction fails or quota exceeded
export const getUserKeyMaterial = async (
  userId: string
): Promise<StoredUserKeyMaterial | null> => {
  const result = await runStoreRequest<StoredUserKeyMaterial | undefined>(
    "readonly",
    (store) => store.get(userId)
  );

  return result ?? null;
};

// deleteUserKeyMaterial: Removes the user's stored key pair from IndexedDB.
//
// Why use this:
// - Logout/account deletion: removes sensitive key material from device
// - Emergency security: device compromised or lost
// - Multi-account switching: clear keys before logging in as new user
// - Account recovery: wipe old keys and re-generate on next login
//
// When called:
// - Logout flow (LogoutButton → useLogout hook)
// - User initiates key reset from account settings
// - Fallback if crypto operations consistently fail (bad key state)
//
// Parameters:
//   userId: The ID of the user whose keys to delete
// Returns: Promise<void> (resolves after deletion completes)
// Errors: Rejects if IndexedDB transaction fails
// Note: Deletion is unrecoverable; decryption will fail for historical messages
//       after this operation. Consider export-before-delete in future UI.
export const deleteUserKeyMaterial = async (userId: string): Promise<void> => {
  await runStoreRequest<void>(
    "readwrite",
    (store) => store.delete(userId) as unknown as IDBRequest<void>
  );
};

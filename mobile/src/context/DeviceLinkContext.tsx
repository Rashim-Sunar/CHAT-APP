import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { useAuthContext } from "./AuthContext";
import { useSocketContext } from "./SocketContext";
import {
  createTemporaryLinkKeyPair,
  decryptLinkedSecretFromDevice,
  encryptLinkedSecretForDevice,
  ensureUserKeyPair,
  requireUserKeyPair,
  storeLinkedKeyMaterial,
  assertPrivateKeyJwk,
} from "../crypto/crypto";
import { getUserKeyMaterial } from "../crypto/secureStorage";
import {
  completeLinkSession,
  createLinkSession,
  getLinkSessionStatus,
  getLinkSessionTempPublicKey,
  respondToLinkSession,
} from "../api/linkSession";
import { enableEncryptedBackup, getEncryptedBackup } from "../api/backup";
import { decryptPrivateKey, encryptPrivateKey } from "../crypto/backupCrypto";
import { ApiFetchError } from "../api/client";
import type {
  DeviceLinkStatus,
  LinkRequestDeviceInfo,
  LinkRequestEventPayload,
  LinkSecretReadyEventPayload,
  LinkSessionUpdatedEventPayload,
} from "../types";

interface DeviceLinkContextValue {
  status: DeviceLinkStatus;
  error: string | null;
  incomingRequests: LinkRequestEventPayload[];
  isLinking: boolean;
  backupEnabled: boolean;
  startDeviceLinking: () => Promise<void>;
  restoreFromBackup: (password: string) => Promise<void>;
  enableBackup: (password: string) => Promise<void>;
  approveRequest: (sessionId: string) => Promise<void>;
  rejectRequest: (sessionId: string) => Promise<void>;
  dismissRequest: (sessionId: string) => void;
}

const DeviceLinkContext = createContext<DeviceLinkContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 4000;

export const useDeviceLinkContext = (): DeviceLinkContextValue => {
  const context = useContext(DeviceLinkContext);
  if (!context) {
    throw new Error("useDeviceLinkContext must be used within DeviceLinkProvider");
  }
  return context;
};

const getDeviceInfo = (): LinkRequestDeviceInfo => {
  const platform = Platform.OS === "ios" ? "iOS" : "Android";
  return { platform, browser: `${platform} app`, label: `ChatApp on ${platform}` };
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiFetchError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
};

export const DeviceLinkProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();

  const [status, setStatus] = useState<DeviceLinkStatus>("checking");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<LinkRequestEventPayload[]>([]);
  const [isLinking, setIsLinking] = useState(false);

  const tempPrivateKeyRef = useRef<JsonWebKey | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = authUser?.data?.user?._id || null;
  const userHasServerPublicKey = Boolean(authUser?.data?.user?.publicKey);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const dismissRequest = useCallback((targetSessionId: string) => {
    setIncomingRequests((prev) => prev.filter((request) => request.sessionId !== targetSessionId));
  }, []);

  const startDeviceLinking = useCallback(async () => {
    if (!userId) return;

    setError(null);
    setIsLinking(true);

    try {
      const tempPair = await createTemporaryLinkKeyPair();
      tempPrivateKeyRef.current = tempPair.privateKey;

      const nextSessionId = await createLinkSession(tempPair.publicKey, getDeviceInfo());
      setSessionId(nextSessionId);
      setStatus("pending");
    } catch (linkError: unknown) {
      setStatus("needs_restore");
      setError(errorMessage(linkError, "Failed to start device linking"));
      tempPrivateKeyRef.current = null;
    } finally {
      setIsLinking(false);
    }
  }, [userId]);

  const restoreFromBackup = useCallback(
    async (password: string) => {
      if (!userId) return;

      setError(null);

      const envelope = await getEncryptedBackup();
      if (!envelope.backupEnabled || !envelope.encryptedPrivateKey || !envelope.salt || !envelope.iv) {
        throw new Error("No encrypted backup found for this account. Use device linking instead.");
      }

      const publicKeyJwk = authUser?.data?.user?.publicKey;
      if (!publicKeyJwk) {
        throw new Error("This account has no public key on file. Use device linking instead.");
      }

      let privateKeyJwk: JsonWebKey;
      try {
        privateKeyJwk = await decryptPrivateKey(
          envelope.encryptedPrivateKey,
          password,
          envelope.salt,
          envelope.iv
        );
        await assertPrivateKeyJwk(privateKeyJwk);
      } catch {
        throw new Error("Incorrect password");
      }

      await storeLinkedKeyMaterial(userId, { publicKey: publicKeyJwk, privateKey: privateKeyJwk });

      tempPrivateKeyRef.current = null;
      setSessionId(null);
      setStatus("ready");
      clearPolling();
    },
    [userId, authUser, clearPolling]
  );

  const enableBackup = useCallback(
    async (password: string) => {
      if (!userId) throw new Error("You must be logged in to enable backup.");

      const keyPair = await requireUserKeyPair(userId);
      const encrypted = await encryptPrivateKey(keyPair.privateKey, password);
      await enableEncryptedBackup(encrypted);
    },
    [userId]
  );

  const rejectRequest = useCallback(
    async (targetSessionId: string) => {
      try {
        await respondToLinkSession(targetSessionId, "reject");
      } finally {
        dismissRequest(targetSessionId);
      }
    },
    [dismissRequest]
  );

  const approveRequest = useCallback(
    async (targetSessionId: string) => {
      if (!userId) return;

      try {
        const localKeyPair = await requireUserKeyPair(userId);
        await respondToLinkSession(targetSessionId, "approve");

        const tempPublicKey = await getLinkSessionTempPublicKey(targetSessionId);
        const transferSecret = JSON.stringify({
          publicKeyJwk: localKeyPair.publicKey,
          privateKeyJwk: localKeyPair.privateKey,
        });

        const encryptedSecret = await encryptLinkedSecretForDevice(transferSecret, tempPublicKey);
        await completeLinkSession(targetSessionId, encryptedSecret);
      } finally {
        dismissRequest(targetSessionId);
      }
    },
    [userId, dismissRequest]
  );

  useEffect(() => {
    let cancelled = false;

    const initializeDeviceAccess = async () => {
      clearPolling();
      setIncomingRequests([]);
      setError(null);
      setSessionId(null);
      tempPrivateKeyRef.current = null;

      if (!userId) {
        setStatus("ready");
        return;
      }

      setStatus("checking");

      try {
        const keyMaterial = await getUserKeyMaterial(userId);
        if (cancelled) return;

        if (keyMaterial?.privateKeyJwk && keyMaterial?.publicKeyJwk) {
          setStatus("ready");
          return;
        }

        // Generating a fresh keypair here would overwrite the account's
        // server-side public key and strand every message encrypted under the
        // old one, so an account that already has a key must link instead.
        if (!userHasServerPublicKey) {
          await ensureUserKeyPair(userId);
          if (cancelled) return;
          setStatus("ready");
          return;
        }

        setStatus("needs_restore");
      } catch (setupError: unknown) {
        if (cancelled) return;
        setError(errorMessage(setupError, "Failed to prepare secure messaging"));
        setStatus("error");
      }
    };

    void initializeDeviceAccess();

    return () => {
      cancelled = true;
      clearPolling();
    };
  }, [userId, userHasServerPublicKey, clearPolling]);

  useEffect(() => {
    if (status !== "pending" || !sessionId) {
      clearPolling();
      return;
    }

    clearPolling();
    pollingRef.current = setInterval(() => {
      void (async () => {
        try {
          const sessionStatus = await getLinkSessionStatus(sessionId);

          if (sessionStatus === "rejected") {
            setStatus("rejected");
            setError("This request was rejected by your other device.");
            tempPrivateKeyRef.current = null;
            clearPolling();
          }

          if (sessionStatus === "expired") {
            setStatus("expired");
            setError("This linking request expired. Try again.");
            tempPrivateKeyRef.current = null;
            clearPolling();
          }
        } catch {
          // Transient failures keep polling.
        }
      })();
    }, POLL_INTERVAL_MS);

    return clearPolling;
  }, [sessionId, status, clearPolling]);

  useEffect(() => {
    if (!socket || !userId) return;

    const onLinkRequest = (payload: LinkRequestEventPayload) => {
      if (status !== "ready") return;
      setIncomingRequests((prev) => {
        const map = new Map(prev.map((request) => [request.sessionId, request]));
        map.set(payload.sessionId, payload);
        return Array.from(map.values());
      });
    };

    const onLinkSessionUpdated = (payload: LinkSessionUpdatedEventPayload) => {
      if (payload.sessionId !== sessionId) return;

      if (payload.status === "rejected") {
        setStatus("rejected");
        setError("This request was rejected by your other device.");
        tempPrivateKeyRef.current = null;
      }

      if (payload.status === "expired") {
        setStatus("expired");
        setError("This linking request expired. Try again.");
        tempPrivateKeyRef.current = null;
      }
    };

    const onLinkSecretReady = (payload: LinkSecretReadyEventPayload) => {
      if (!sessionId || payload.sessionId !== sessionId || status !== "pending") return;

      const tempPrivateKey = tempPrivateKeyRef.current;
      if (!tempPrivateKey) {
        setStatus("error");
        setError("Unable to decrypt the transfer because this device's session key is missing.");
        return;
      }

      void (async () => {
        try {
          const decryptedSecret = await decryptLinkedSecretFromDevice(payload.encryptedSecret, tempPrivateKey);
          const parsed = JSON.parse(decryptedSecret) as {
            publicKeyJwk?: JsonWebKey;
            privateKeyJwk?: JsonWebKey;
          };

          if (!parsed.publicKeyJwk || !parsed.privateKeyJwk || !userId) {
            throw new Error("Transferred key material is incomplete");
          }

          await storeLinkedKeyMaterial(userId, {
            publicKey: parsed.publicKeyJwk,
            privateKey: parsed.privateKeyJwk,
          });

          tempPrivateKeyRef.current = null;
          setError(null);
          setSessionId(null);
          setStatus("ready");
          clearPolling();
        } catch (decryptError: unknown) {
          setStatus("error");
          setError(errorMessage(decryptError, "Failed to restore key material"));
          tempPrivateKeyRef.current = null;
          clearPolling();
        }
      })();
    };

    socket.on("link_request", onLinkRequest);
    socket.on("link_session_updated", onLinkSessionUpdated);
    socket.on("link_secret_ready", onLinkSecretReady);

    return () => {
      socket.off("link_request", onLinkRequest);
      socket.off("link_session_updated", onLinkSessionUpdated);
      socket.off("link_secret_ready", onLinkSecretReady);
    };
  }, [socket, status, sessionId, userId, clearPolling]);

  const value = useMemo<DeviceLinkContextValue>(
    () => ({
      status,
      error,
      incomingRequests,
      isLinking,
      backupEnabled: Boolean(authUser?.data?.user?.backupEnabled),
      startDeviceLinking,
      restoreFromBackup,
      enableBackup,
      approveRequest,
      rejectRequest,
      dismissRequest,
    }),
    [
      status,
      error,
      incomingRequests,
      isLinking,
      authUser,
      startDeviceLinking,
      restoreFromBackup,
      enableBackup,
      approveRequest,
      rejectRequest,
      dismissRequest,
    ]
  );

  return <DeviceLinkContext.Provider value={value}>{children}</DeviceLinkContext.Provider>;
};

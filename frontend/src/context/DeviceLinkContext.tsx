// ----------------------------------------
// @file   DeviceLinkContext.tsx
// @desc   Manages E2EE restore/device-linking gate and backup setup actions
// ----------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "./Auth-Context";
import { useSocketContext } from "./SocketContext";
import {
  createTemporaryLinkKeyPair,
  decryptLinkedSecretFromDevice,
  encryptLinkedSecretForDevice,
  ensureUserKeyPair,
  requireUserKeyPair,
  savePublicKey,
} from "../Utils/crypto";
import { decryptPrivateKey, encryptPrivateKey } from "../Utils/backupCrypto";
import { apiFetch } from "../Utils/apiFetch";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { getUserKeyMaterial, saveUserKeyMaterial } from "../Utils/secureStorage";
import type {
  DeviceLinkContextValue,
  LinkRequestEventPayload,
  LinkSecretReadyEventPayload,
  LinkSessionStatusResponse,
  LinkSessionUpdatedEventPayload,
} from "../types";

interface LinkSessionCreateResponse {
  status: "success" | "fail";
  message?: string;
  data?: {
    sessionId: string;
    status: "pending";
    expiresAt: string;
  };
}

interface LinkSessionPayloadResponse {
  status: "success" | "fail";
  message?: string;
  data?: {
    sessionId: string;
    tempPublicKey: JsonWebKey;
    status: "pending" | "approved" | "rejected" | "expired";
    expiresAt: string;
  };
}

interface BackupEnvelopeResponse {
  status: "success" | "fail";
  message?: string;
  backupEnabled?: boolean;
  encryptedPrivateKey?: string | null;
  salt?: string | null;
  iv?: string | null;
}

interface BackupEnableResponse {
  status: "success" | "fail";
  message?: string;
}

const DeviceLinkContext = createContext<DeviceLinkContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 4000;

/**
 * Deduplicates incoming link requests by session id.
 * Used when socket events replay or arrive out of order so approval prompts
 * remain stable and do not show duplicated entries.
 */
const uniqueRequests = (requests: LinkRequestEventPayload[]): LinkRequestEventPayload[] => {
  const map = new Map<string, LinkRequestEventPayload>();
  requests.forEach((request) => {
    map.set(request.sessionId, request);
  });
  return Array.from(map.values());
};

/**
 * Builds lightweight client device metadata for approval UI.
 * Used when creating link sessions so trusted devices can identify the
 * requester before approving encrypted key transfer.
 */
const getDeviceInfo = (): { platform?: string; browser?: string; label?: string } => {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || undefined;

  let browser = "Unknown";
  if (userAgent.includes("Firefox")) browser = "Firefox";
  if (userAgent.includes("Edg")) browser = "Edge";
  if (userAgent.includes("Chrome")) browser = "Chrome";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";

  return {
    platform,
    browser,
    label: `${browser}${platform ? ` on ${platform}` : ""}`,
  };
};

/**
 * Validates recovered private-key JWK before writing it to IndexedDB.
 * Used during password restore to fail fast on malformed or tampered backup
 * payloads before they are trusted by message decryption flows.
 */
const assertPrivateKeyJwk = async (privateKeyJwk: JsonWebKey): Promise<void> => {
  await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
};

export const useDeviceLinkContext = (): DeviceLinkContextValue => {
  const context = useContext(DeviceLinkContext);

  if (!context) {
    throw new Error("useDeviceLinkContext must be used within DeviceLinkProvider");
  }

  return context;
};

interface DeviceLinkProviderProps {
  children: ReactNode;
}

export const DeviceLinkProvider = ({ children }: DeviceLinkProviderProps) => {
  const { authUser, setAuthUser } = useAuthContext();
  const { socket } = useSocketContext();

  const [status, setStatus] = useState<DeviceLinkContextValue["status"]>("checking");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<LinkRequestEventPayload[]>([]);
  const [isEnablingBackup, setIsEnablingBackup] = useState(false);

  const tempPrivateKeyRef = useRef<JsonWebKey | null>(null);
  const pollingHandleRef = useRef<number | null>(null);

  const userId = authUser?.data?.user?._id || null;
  const backupEnabled = Boolean(authUser?.data?.user?.backupEnabled);
  const userHasServerPublicKey = Boolean(authUser?.data?.user?.publicKey);

  /**
   * Stops active link-session polling timer and resets handle reference.
   * Used before starting/restarting polls and during cleanup to avoid
   * duplicate polling loops and stale state updates.
   */
  const clearPolling = () => {
    if (pollingHandleRef.current) {
      window.clearInterval(pollingHandleRef.current);
      pollingHandleRef.current = null;
    }
  };

  /**
   * Removes one approval request from local pending-request state.
   * Used after approve/reject actions or manual dismissal to keep
   * trusted-device prompt list synchronized with user intent.
   */
  const clearRequest = (targetSessionId: string) => {
    setIncomingRequests((prev) => prev.filter((request) => request.sessionId !== targetSessionId));
  };

  /**
   * Starts a new device-link session for users restoring without backup password.
   * Used from the restore gate when local private key is missing and another
   * approved device must relay encrypted key material.
   */
  const startDeviceLinking = async (): Promise<void> => {
    if (!userId) return;

    setError(null);

    try {
      const tempPair = await createTemporaryLinkKeyPair();
      tempPrivateKeyRef.current = tempPair.privateKey;

      const createResponse = await apiFetch<LinkSessionCreateResponse>("/link-session/create", {
        method: "POST",
        body: JSON.stringify({
          tempPublicKey: tempPair.publicKey,
          deviceInfo: getDeviceInfo(),
        }),
      });

      const nextSessionId = createResponse.data?.sessionId;
      if (!nextSessionId) {
        throw new Error("Failed to create linking session");
      }

      setSessionId(nextSessionId);
      setStatus("pending");
    } catch (linkError: unknown) {
      setStatus("needs_restore");
      setError(getErrorMessage(linkError));
      tempPrivateKeyRef.current = null;
    }
  };

  /**
   * Restores private key from server-stored encrypted backup blob.
   * Used on new devices; all decryption stays local so password and plaintext
   * private key are never transmitted to backend endpoints.
   */
  const restoreFromBackup = async (password: string): Promise<void> => {
    if (!userId) return;

    setStatus("restoring");
    setError(null);

    try {
      const response = await apiFetch<BackupEnvelopeResponse>("/backup", {
        method: "GET",
      });

      if (!response.backupEnabled) {
        throw new Error("No encrypted backup found for this account. Use device linking.");
      }

      if (!response.encryptedPrivateKey || !response.salt || !response.iv) {
        throw new Error("Backup data is incomplete. Use device linking to recover access.");
      }

      const decryptedPrivateKey = await decryptPrivateKey(
        response.encryptedPrivateKey,
        password,
        response.salt,
        response.iv
      );

      await assertPrivateKeyJwk(decryptedPrivateKey);

      const publicKeyJwk = authUser?.data?.user?.publicKey;
      if (!publicKeyJwk) {
        throw new Error("Public key is unavailable for this account. Use device linking.");
      }

      await saveUserKeyMaterial({
        userId,
        publicKeyJwk,
        privateKeyJwk: decryptedPrivateKey,
        updatedAt: Date.now(),
      });

      await savePublicKey(publicKeyJwk);

      tempPrivateKeyRef.current = null;
      setSessionId(null);
      setStatus("ready");
      setError(null);
      clearPolling();
      toast.success("Private key restored. Secure chat access unlocked.");
    } catch (restoreError: unknown) {
      const restoreMessage = getErrorMessage(restoreError);
      const normalizedMessage =
        restoreMessage.toLowerCase().includes("operation-specific") ||
        restoreMessage.toLowerCase().includes("decrypt")
          ? "Invalid password"
          : restoreMessage;

      setStatus("needs_restore");
      setError(normalizedMessage);
      tempPrivateKeyRef.current = null;
      clearPolling();
      throw new Error(normalizedMessage);
    }
  };

  /**
   * Creates one-time encrypted private-key backup for future password restore.
   * Called only from explicit user action while unlocked so the password is
   * used locally for encryption and never sent to the backend.
   */
  const enableBackup = async (password: string): Promise<void> => {
    if (!userId) {
      throw new Error("You must be logged in to enable backup.");
    }

    if (backupEnabled) {
      throw new Error("Encrypted backup is already enabled.");
    }

    setIsEnablingBackup(true);

    try {
      const keyPair = await requireUserKeyPair(userId);
      const encrypted = await encryptPrivateKey(keyPair.privateKey, password);

      await apiFetch<BackupEnableResponse>("/backup/enable", {
        method: "POST",
        body: JSON.stringify(encrypted),
      });

      setAuthUser((previousState) => {
        if (!previousState?.data?.user) return previousState;

        return {
          ...previousState,
          data: {
            ...previousState.data,
            user: {
              ...previousState.data.user,
              backupEnabled: true,
            },
          },
        };
      });

      toast.success("Encrypted key backup enabled");
    } catch (backupError: unknown) {
      throw new Error(getErrorMessage(backupError));
    } finally {
      setIsEnablingBackup(false);
    }
  };

  /**
   * Rejects a pending link-session request from a trusted device.
   * Used when user denies access for a new device; this prevents any
   * encrypted key relay for that session and surfaces immediate UI feedback.
   */
  const rejectRequest = async (targetSessionId: string): Promise<void> => {
    try {
      await apiFetch<{ status: "success" | "fail"; message?: string }>("/link-session/respond", {
        method: "POST",
        body: JSON.stringify({ sessionId: targetSessionId, action: "reject" }),
      });

      clearRequest(targetSessionId);
      toast.success("Device link request rejected");
    } catch (requestError: unknown) {
      toast.error(getErrorMessage(requestError));
    }
  };

  /**
   * Approves a pending link session and relays encrypted key material.
   * Used on trusted devices; private key remains local and only encrypted
   * transfer payload is sent so server stays zero-knowledge.
   */
  const approveRequest = async (targetSessionId: string): Promise<void> => {
    if (!userId) return;

    try {
      const localKeyPair = await requireUserKeyPair(userId);

      await apiFetch<{ status: "success" | "fail"; message?: string }>("/link-session/respond", {
        method: "POST",
        body: JSON.stringify({ sessionId: targetSessionId, action: "approve" }),
      });

      const sessionPayload = await apiFetch<LinkSessionPayloadResponse>(
        `/link-session/${targetSessionId}`,
        {
          method: "GET",
        }
      );

      const tempPublicKey = sessionPayload.data?.tempPublicKey;
      if (!tempPublicKey) {
        throw new Error("Temporary public key was not found for the link session.");
      }

      const transferSecret = JSON.stringify({
        publicKeyJwk: localKeyPair.publicKey,
        privateKeyJwk: localKeyPair.privateKey,
      });

      const encryptedSecret = await encryptLinkedSecretForDevice(transferSecret, tempPublicKey);

      await apiFetch<{ status: "success" | "fail"; message?: string }>("/link-session/complete", {
        method: "POST",
        body: JSON.stringify({
          sessionId: targetSessionId,
          encryptedSecret,
        }),
      });

      clearRequest(targetSessionId);
      toast.success("Device approved and key transfer sent");
    } catch (requestError: unknown) {
      toast.error(getErrorMessage(requestError));
    }
  };

  useEffect(() => {
    let cancelled = false;

    /**
     * Evaluates whether the current device has local key material at login.
     * If key is missing and server key exists, user is gated into restore-or-link
     * flow before chat access is unlocked.
     */
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

        if (!userHasServerPublicKey) {
          await ensureUserKeyPair(userId);
          if (cancelled) return;
          setStatus("ready");
          return;
        }

        setStatus("needs_restore");
      } catch (setupError: unknown) {
        if (cancelled) return;

        setError(getErrorMessage(setupError));
        setStatus("error");
      }
    };

    void initializeDeviceAccess();

    return () => {
      cancelled = true;
      clearPolling();
    };
  }, [userId, userHasServerPublicKey]);

  useEffect(() => {
    // Polls link-session state while request is pending to recover from missed
    // socket events and keep requester UI synced with server truth.
    if (status !== "pending" || !sessionId) {
      clearPolling();
      return;
    }

    clearPolling();
    pollingHandleRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const response = await apiFetch<LinkSessionStatusResponse>(
            `/link-session/status/${sessionId}`,
            {
              method: "GET",
            }
          );

          const sessionStatus = response.data?.status;
          if (!sessionStatus) return;

          if (sessionStatus === "rejected") {
            setStatus("rejected");
            setError("This login request was rejected by one of your approved devices.");
            tempPrivateKeyRef.current = null;
            clearPolling();
          }

          if (sessionStatus === "expired") {
            setStatus("expired");
            setError("This linking session expired. Log in again to request approval.");
            tempPrivateKeyRef.current = null;
            clearPolling();
          }
        } catch {
          // Keep polling on transient failures.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      clearPolling();
    };
  }, [sessionId, status]);

  useEffect(() => {
    // Subscribes to link workflow socket events for real-time approve/reject
    // updates and encrypted secret delivery to the requesting device.
    if (!socket || !userId) return;

    // Shows approval prompt on already-trusted devices.
    const onLinkRequest = (payload: LinkRequestEventPayload) => {
      if (status !== "ready") return;

      setIncomingRequests((prev) => uniqueRequests([...prev, payload]));
      toast((payload.deviceInfo?.label || "A new device") + " is requesting access");
    };

    // Reflects terminal session status changes pushed by server.
    const onLinkSessionUpdated = (payload: LinkSessionUpdatedEventPayload) => {
      if (payload.sessionId !== sessionId) return;

      if (payload.status === "rejected") {
        setStatus("rejected");
        setError("This login request was rejected by one of your approved devices.");
        tempPrivateKeyRef.current = null;
      }

      if (payload.status === "expired") {
        setStatus("expired");
        setError("This linking session expired. Log in again to request approval.");
        tempPrivateKeyRef.current = null;
      }
    };

    // Handles encrypted transfer payload from approved device and restores
    // local key material without exposing plaintext keys to backend.
    const onLinkSecretReady = (payload: LinkSecretReadyEventPayload) => {
      if (!sessionId || payload.sessionId !== sessionId || status !== "pending") {
        return;
      }

      const tempPrivateKey = tempPrivateKeyRef.current;
      if (!tempPrivateKey) {
        setStatus("error");
        setError("Unable to decrypt transfer secret because session key is missing.");
        return;
      }

      void (async () => {
        try {
          const decryptedSecret = await decryptLinkedSecretFromDevice(
            payload.encryptedSecret,
            tempPrivateKey
          );

          const parsedSecret = JSON.parse(decryptedSecret) as {
            publicKeyJwk?: JsonWebKey;
            privateKeyJwk?: JsonWebKey;
          };

          if (!parsedSecret.publicKeyJwk || !parsedSecret.privateKeyJwk || !userId) {
            throw new Error("Transferred key material is incomplete");
          }

          await saveUserKeyMaterial({
            userId,
            publicKeyJwk: parsedSecret.publicKeyJwk,
            privateKeyJwk: parsedSecret.privateKeyJwk,
            updatedAt: Date.now(),
          });

          await savePublicKey(parsedSecret.publicKeyJwk);

          tempPrivateKeyRef.current = null;
          setError(null);
          setStatus("ready");
          setSessionId(null);
          clearPolling();
          toast.success("Device approved. Secure chat access unlocked.");
        } catch (decryptError: unknown) {
          setStatus("error");
          setError(getErrorMessage(decryptError));
          tempPrivateKeyRef.current = null;
          clearPolling();
        }
      })();
    };

    // Register and clean up all listeners together to avoid stale closures
    // and duplicate event processing after auth/session transitions.
    socket.on("link_request", onLinkRequest);
    socket.on("link_session_updated", onLinkSessionUpdated);
    socket.on("link_secret_ready", onLinkSecretReady);

    return () => {
      socket.off("link_request", onLinkRequest);
      socket.off("link_session_updated", onLinkSessionUpdated);
      socket.off("link_secret_ready", onLinkSecretReady);
    };
  }, [socket, status, sessionId, userId]);

  // Exposes a stable context value so consumers re-render only when relevant
  // workflow state/actions change.
  const contextValue = useMemo<DeviceLinkContextValue>(
    () => ({
      status,
      sessionId,
      error,
      backupEnabled,
      isEnablingBackup,
      incomingRequests,
      startDeviceLinking,
      restoreFromBackup,
      enableBackup,
      approveRequest,
      rejectRequest,
      clearRequest,
    }),
    [
      status,
      sessionId,
      error,
      backupEnabled,
      isEnablingBackup,
      incomingRequests,
      startDeviceLinking,
    ]
  );

  return <DeviceLinkContext.Provider value={contextValue}>{children}</DeviceLinkContext.Provider>;
};

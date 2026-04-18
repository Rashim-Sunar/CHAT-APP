// ----------------------------------------
// @file   DeviceLinkContext.tsx
// @desc   Manages E2EE device-linking state and login gating for new devices
// ----------------------------------------
// This context coordinates link-session creation, approval handling, encrypted
// key transfer reception, and unlock state transitions. It keeps key operations
// client-side so the server remains relay-only and zero-knowledge.

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
import { apiFetch } from "../Utils/apiFetch";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { getUserKeyMaterial, saveUserKeyMaterial } from "../Utils/secureStorage";
import type {
  DeviceLinkContextValue,
  DeviceLinkStatus,
  LinkRequestEventPayload,
  LinkSessionStatusResponse,
  LinkSecretReadyEventPayload,
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

// Response contract when trusted device fetches session metadata for approval flow.
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

// Central store for device-link workflow state shared across the app shell/UI.
const DeviceLinkContext = createContext<DeviceLinkContextValue | undefined>(undefined);

// Poll cadence for pending-link fallback state sync.
const POLL_INTERVAL_MS = 4000;

// Deduplicates repeated link_request socket events by stable session id.
const uniqueRequests = (requests: LinkRequestEventPayload[]): LinkRequestEventPayload[] => {
  const map = new Map<string, LinkRequestEventPayload>();
  requests.forEach((request) => {
    map.set(request.sessionId, request);
  });
  return Array.from(map.values());
};

// Captures lightweight device fingerprint shown during approval prompts.
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

// Provider encapsulates linking orchestration so route/UI layers stay declarative.
export const DeviceLinkProvider = ({ children }: DeviceLinkProviderProps) => {
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();

  // Gate state controlling whether chat access is blocked or unlocked.
  const [status, setStatus] = useState<DeviceLinkStatus>("checking");
  // Active linking session identifier for polling and socket correlation.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Approval prompts received on already-trusted devices.
  const [incomingRequests, setIncomingRequests] = useState<LinkRequestEventPayload[]>([]);

  // Ephemeral private key used only to decrypt the transferred secret on this device.
  const tempPrivateKeyRef = useRef<JsonWebKey | null>(null);
  const pollingHandleRef = useRef<number | null>(null);

  const userId = authUser?.data?.user?._id || null;
  // Indicates whether this account already has a trusted E2EE identity on server.
  const userHasServerPublicKey = Boolean(authUser?.data?.user?.publicKey);

  // Ensures only one status polling loop is active per pending session.
  const clearPolling = () => {
    if (pollingHandleRef.current) {
      window.clearInterval(pollingHandleRef.current);
      pollingHandleRef.current = null;
    }
  };

  const clearRequest = (targetSessionId: string) => {
    setIncomingRequests((prev) => prev.filter((request) => request.sessionId !== targetSessionId));
  };

  // Triggered when a trusted device denies a pending link request.
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

  // Triggered on trusted device approval path; encrypts and forwards key material.
  const approveRequest = async (targetSessionId: string): Promise<void> => {
    if (!userId) return;

    try {
      // Requires existing local keys; prevents approving from uninitialized devices.
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

      // Secret remains encrypted client-side; server only relays opaque payload.
      // This preserves zero-knowledge behavior during cross-device key transfer.
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

    // Initializes link state after auth hydration and enforces login gating.
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

        // First-device bootstrap path before any cross-device linking exists.
        // No approval needed because there is no pre-existing trusted device.
        if (!userHasServerPublicKey) {
          await ensureUserKeyPair(userId);
          if (cancelled) return;
          setStatus("ready");
          return;
        }

        // Generates requester temporary keypair for secure one-session transfer.
        // Private half stays local; only temporary public key is sent to backend.
        const tempPair = await createTemporaryLinkKeyPair();
        if (cancelled) return;

        tempPrivateKeyRef.current = tempPair.privateKey;

        // New device remains gated until approved device sends encrypted secret.
        // `pending` means authenticated but not yet able to decrypt chat data.
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
      } catch (setupError: unknown) {
        if (cancelled) return;

        const setupMessage = getErrorMessage(setupError);
        setError(setupMessage);
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
    if (status !== "pending" || !sessionId) {
      clearPolling();
      return;
    }

    // Poll fallback keeps pending flow resilient if socket events are missed.
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
          // Keep polling; temporary network failures should not drop pending state.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      clearPolling();
    };
  }, [sessionId, status]);

  useEffect(() => {
    if (!socket || !userId) return;

    // Received on trusted devices so users can explicitly approve new logins.
    const onLinkRequest = (payload: LinkRequestEventPayload) => {
      if (status !== "ready") return;

      setIncomingRequests((prev) => uniqueRequests([...prev, payload]));
      toast((payload.deviceInfo?.label || "A new device") + " is requesting access");
    };

    const onLinkSessionUpdated = (payload: LinkSessionUpdatedEventPayload) => {
      // Syncs requester UI when approval decision changes server-side state.
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

    // Received on requesting device with encrypted transfer payload.
    const onLinkSecretReady = (payload: LinkSecretReadyEventPayload) => {
      if (!sessionId || payload.sessionId !== sessionId || status !== "pending") {
        return;
      }

      const tempPrivateKey = tempPrivateKeyRef.current;
      if (!tempPrivateKey) {
        // Without ephemeral private key, encrypted transfer cannot be recovered.
        setStatus("error");
        setError("Unable to decrypt transfer secret because session key is missing.");
        return;
      }

      void (async () => {
        try {
          // Decryption is client-side only; server has no access to plaintext keys.
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

          // Re-publish public key to keep server-side encryption target in sync.
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

    socket.on("link_request", onLinkRequest);
    socket.on("link_session_updated", onLinkSessionUpdated);
    socket.on("link_secret_ready", onLinkSecretReady);

    return () => {
      socket.off("link_request", onLinkRequest);
      socket.off("link_session_updated", onLinkSessionUpdated);
      socket.off("link_secret_ready", onLinkSecretReady);
    };
  }, [socket, status, sessionId, userId]);

  const contextValue = useMemo<DeviceLinkContextValue>(
    () => ({
      status,
      sessionId,
      error,
      incomingRequests,
      approveRequest,
      rejectRequest,
      clearRequest,
    }),
    [status, sessionId, error, incomingRequests]
  );

  return <DeviceLinkContext.Provider value={contextValue}>{children}</DeviceLinkContext.Provider>;
};

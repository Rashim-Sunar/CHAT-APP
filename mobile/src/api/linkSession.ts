import { apiFetch } from "./client";
import type { EncryptedLinkedSecret, LinkRequestDeviceInfo } from "../types";

interface LinkSessionCreateResponse {
  status: "success" | "fail";
  message?: string;
  data?: { sessionId: string; status: "pending"; expiresAt: string };
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

interface LinkSessionStatusResponse {
  status: "success" | "fail";
  message?: string;
  data?: { sessionId: string; status: "pending" | "approved" | "rejected" | "expired"; expiresAt: string };
}

export const createLinkSession = async (
  tempPublicKey: JsonWebKey,
  deviceInfo: LinkRequestDeviceInfo
): Promise<string> => {
  const response = await apiFetch<LinkSessionCreateResponse>("/link-session/create", {
    method: "POST",
    body: JSON.stringify({ tempPublicKey, deviceInfo }),
  });

  if (!response.data?.sessionId) {
    throw new Error(response.message || "Failed to create linking session");
  }

  return response.data.sessionId;
};

export const respondToLinkSession = (sessionId: string, action: "approve" | "reject"): Promise<unknown> =>
  apiFetch("/link-session/respond", { method: "POST", body: JSON.stringify({ sessionId, action }) });

export const getLinkSessionTempPublicKey = async (sessionId: string): Promise<JsonWebKey> => {
  const response = await apiFetch<LinkSessionPayloadResponse>(`/link-session/${sessionId}`);

  if (!response.data?.tempPublicKey) {
    throw new Error("Temporary public key was not found for the link session");
  }

  return response.data.tempPublicKey;
};

export const completeLinkSession = (
  sessionId: string,
  encryptedSecret: EncryptedLinkedSecret
): Promise<unknown> =>
  apiFetch("/link-session/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId, encryptedSecret }),
  });

export const getLinkSessionStatus = async (
  sessionId: string
): Promise<"pending" | "approved" | "rejected" | "expired" | null> => {
  const response = await apiFetch<LinkSessionStatusResponse>(`/link-session/status/${sessionId}`);
  return response.data?.status || null;
};

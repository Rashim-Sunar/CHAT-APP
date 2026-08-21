import { apiFetch } from "./client";

export const createGroupConversation = async (
  groupName: string,
  participantIds: string[]
): Promise<string> => {
  const response = await apiFetch<{ status: string; error?: string; data?: { conversationId: string } }>(
    "/conversations",
    { method: "POST", body: JSON.stringify({ groupName, participantIds }) }
  );

  if (!response.data?.conversationId) {
    throw new Error(response.error || "Failed to create group");
  }

  return response.data.conversationId;
};

export const updateGroupConversation = (
  conversationId: string,
  updates: { groupName?: string }
): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}`, { method: "PATCH", body: JSON.stringify(updates) });

export const addGroupMembers = (conversationId: string, userIds: string[]): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}/members`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });

export const removeGroupMember = (conversationId: string, userId: string): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}/members/${userId}`, { method: "DELETE" });

export const leaveGroupConversation = (conversationId: string): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}/members/me`, { method: "DELETE" });

export const promoteGroupAdmin = (conversationId: string, userId: string): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}/admins/${userId}`, { method: "POST" });

export const createInviteLink = async (conversationId: string): Promise<string> => {
  const response = await apiFetch<{ status: string; data?: { inviteUrl: string } }>(
    `/conversations/${conversationId}/invite`,
    { method: "POST" }
  );

  if (!response.data?.inviteUrl) {
    throw new Error("Failed to create invite link");
  }

  return response.data.inviteUrl;
};

export const revokeInviteLink = (conversationId: string): Promise<unknown> =>
  apiFetch(`/conversations/${conversationId}/invite`, { method: "DELETE" });

export interface InvitePreview {
  groupName: string;
  groupAvatar?: string;
  memberCount: number;
}

// Accepts either a full invite URL or a bare token — links are generated
// against the web client's origin, so pasted URLs are the common case.
export const extractInviteToken = (input: string): string => {
  const trimmed = input.trim();
  const match = trimmed.match(/\/join\/([^/?#\s]+)/);
  return match ? match[1] : trimmed;
};

export const previewInviteLink = async (token: string): Promise<InvitePreview> => {
  const response = await apiFetch<{ status: string; error?: string; data?: InvitePreview }>(
    `/conversations/join/${token}/preview`
  );

  if (!response.data) {
    throw new Error(response.error || "This invite link is invalid or has expired");
  }

  return response.data;
};

export const joinByInviteLink = async (token: string): Promise<string> => {
  const response = await apiFetch<{ status: string; error?: string; data?: { conversationId: string } }>(
    `/conversations/join/${token}`,
    { method: "POST" }
  );

  if (!response.data?.conversationId) {
    throw new Error(response.error || "Couldn't join this group");
  }

  return response.data.conversationId;
};

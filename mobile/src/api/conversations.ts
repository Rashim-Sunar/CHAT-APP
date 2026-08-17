import { apiFetch } from "./client";
import type { Conversation, ConversationParticipant, ConversationType, Message, SharedContentResponse } from "../types";

export const listConversations = async (): Promise<Conversation[]> => {
  const response = await apiFetch<{ status: string; data?: { conversations: Conversation[] } }>("/conversations");
  return response.data?.conversations || [];
};

export interface ConversationDetail {
  _id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
}

// listConversations already returns participants for conversations the user
// has open, but a freshly-created direct conversation (see the People tab)
// isn't in that list yet — this covers that gap without a full re-fetch.
export const getConversationById = async (conversationId: string): Promise<ConversationDetail> => {
  const response = await apiFetch<{ status: string; data?: { conversation: ConversationDetail } }>(
    `/conversations/${conversationId}`
  );

  if (!response.data?.conversation) {
    throw new Error("Conversation not found");
  }

  return response.data.conversation;
};

export const findOrCreateDirectConversation = async (userId: string): Promise<string> => {
  const response = await apiFetch<{ status: string; data?: { conversationId: string } }>("/conversations/direct", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  if (!response.data?.conversationId) {
    throw new Error("Failed to start conversation");
  }

  return response.data.conversationId;
};

export const getConversationMessages = async (
  conversationId: string,
  before?: string
): Promise<{ messages: Message[]; hasMore: boolean }> => {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const response = await apiFetch<{ status: string; data?: { messages: Message[]; hasMore: boolean } }>(
    `/conversations/${conversationId}/messages${query}`
  );

  return { messages: response.data?.messages || [], hasMore: Boolean(response.data?.hasMore) };
};

export interface SendTextMessagePayload {
  encryptedMessage: string;
  encryptedAESKeys: { userId: string; wrappedKey: string }[];
  iv: string;
  replyTo?: string;
}

export const sendTextMessage = async (
  conversationId: string,
  payload: SendTextMessagePayload
): Promise<Message> => {
  const response = await apiFetch<{ newMessage: Message }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messageType: "text", ...payload }),
  });

  return response.newMessage;
};

export const getSharedContent = (conversationId: string): Promise<SharedContentResponse> =>
  apiFetch<SharedContentResponse>(`/conversations/${conversationId}/shared-content`);

export const getPinnedMessages = async (conversationId: string): Promise<Message[]> => {
  const response = await apiFetch<{ status: string; data?: { messages: Message[] } }>(
    `/conversations/${conversationId}/pinned-messages`
  );
  return response.data?.messages || [];
};

export const setConversationMuted = (conversationId: string, muted: boolean): Promise<void> =>
  apiFetch(`/conversations/${conversationId}/mute`, { method: muted ? "POST" : "DELETE" });

export const setUserBlocked = (conversationId: string, blocked: boolean): Promise<void> =>
  apiFetch(`/conversations/${conversationId}/block`, { method: blocked ? "POST" : "DELETE" });

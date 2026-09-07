import { apiFetch } from "./client";
import { mergeConversationPreviewsFromCache } from "../utils/conversationPreviewCache";
import { decryptMessagesIfNeeded } from "../crypto/crypto";
import { getMessagePreviewText } from "../utils/conversationPreviewCache";
import type { Conversation, ConversationParticipant, ConversationType, Message, SharedContentResponse } from "../types";

export const listConversations = async (currentUserId?: string, hydrateLatestMessages = false): Promise<Conversation[]> => {
  const response = await apiFetch<{ status: string; data?: { conversations: Conversation[] } }>("/conversations");
  const conversations = await mergeConversationPreviewsFromCache(response.data?.conversations || [], currentUserId);
  if (!currentUserId || !hydrateLatestMessages) return conversations;

  return Promise.all(
    conversations.map(async (conversation) => {
      try {
        const { messages } = await getConversationMessages(conversation._id);
        const decryptedMessages = await decryptMessagesIfNeeded(messages, currentUserId);
        const latestMessage = decryptedMessages.reduce<Message | undefined>((latest, message) => {
          if (!latest || new Date(message.createdAt).getTime() > new Date(latest.createdAt).getTime()) return message;
          return latest;
        }, undefined);

        if (!latestMessage || latestMessage.decryptionFailed) return conversation;

        return {
          ...conversation,
          lastMessage: getMessagePreviewText(latestMessage),
          lastMessageAt: latestMessage.createdAt,
          lastMessageSenderId: String(latestMessage.senderId),
        };
      } catch {
        return conversation;
      }
    })
  );
};

export interface ConversationDetail {
  _id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
  groupName?: string;
  groupAvatar?: string;
  createdBy?: string;
  admins?: string[];
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
  forwarded?: boolean;
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

export interface SendMediaMessagePayload {
  messageType: "image" | "video" | "file";
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
  replyTo?: string;
  forwarded?: boolean;
}

export const sendMediaMessage = async (
  conversationId: string,
  payload: SendMediaMessagePayload
): Promise<Message> => {
  const response = await apiFetch<{ newMessage: Message }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
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

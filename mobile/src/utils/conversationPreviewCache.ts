import * as SecureStore from "expo-secure-store";
import type { Conversation, Message } from "../types";

interface PreviewCacheEntry {
  lastMessage: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
}

const CACHE_PREFIX = "conversation-previews:v1:";

const getKey = (userId: string) => `${CACHE_PREFIX}${userId}`;

const readCache = async (userId: string): Promise<Record<string, PreviewCacheEntry>> => {
  try {
    const raw = await SecureStore.getItemAsync(getKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, PreviewCacheEntry>) : {};
  } catch {
    return {};
  }
};

const writeCache = async (userId: string, cache: Record<string, PreviewCacheEntry>) => {
  try {
    await SecureStore.setItemAsync(getKey(userId), JSON.stringify(cache));
  } catch {
    // Preview caching is best effort and must never block chat UI.
  }
};

export const getMessagePreviewText = (message: Message): string => {
  if (message.deletedForEveryone) return "This message was deleted";
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "video") return "Video";
  if (message.messageType === "file") return message.fileName || "File";
  if (message.messageType === "call_log") {
    if (message.callStatus === "missed") return "Missed call";
    if (message.callStatus === "declined") return "Call declined";
    return message.callType === "video" ? "Video call" : "Voice call";
  }
  return message.text || message.message || "";
};

export const saveConversationPreview = async (
  userId: string,
  conversationId: string,
  message: Message
): Promise<void> => {
  await saveConversationPreviewText(userId, conversationId, {
    lastMessage: getMessagePreviewText(message),
    lastMessageAt: message.createdAt,
    lastMessageSenderId: String(message.senderId),
  });
};

export const saveConversationPreviewText = async (
  userId: string,
  conversationId: string,
  preview: PreviewCacheEntry
): Promise<void> => {
  if (!userId || !conversationId) return;

  const cache = await readCache(userId);
  cache[conversationId] = preview;
  await writeCache(userId, cache);
};

export const mergeConversationPreviewsFromCache = async (
  conversations: Conversation[],
  userId?: string
): Promise<Conversation[]> => {
  if (!userId) return conversations;

  const cache = await readCache(userId);
  return conversations.map((conversation) => {
    const cached = cache[conversation._id];
    if (!cached?.lastMessage) return conversation;

    return {
      ...conversation,
      lastMessage: cached.lastMessage,
      lastMessageAt: cached.lastMessageAt || conversation.lastMessageAt,
      lastMessageSenderId: cached.lastMessageSenderId || conversation.lastMessageSenderId,
    };
  });
};

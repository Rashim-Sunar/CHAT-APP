import type { Conversation } from "../types";
import { getConversationKey } from "./conversationKey";

interface ConversationPreviewCacheEntry {
  lastMessage: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
}

const CACHE_VERSION = "v1";
const getCacheStorageKey = (userId: string): string => `chat-preview-cache:${CACHE_VERSION}:${userId}`;

// Read failures should never break chat UI. If cache parsing fails, we fall back
// to an empty map and let live message events repopulate previews.
const readCache = (userId: string): Record<string, ConversationPreviewCacheEntry> => {
  try {
    const rawValue = localStorage.getItem(getCacheStorageKey(userId));
    return rawValue ? (JSON.parse(rawValue) as Record<string, ConversationPreviewCacheEntry>) : {};
  } catch {
    return {};
  }
};

const writeCache = (userId: string, cache: Record<string, ConversationPreviewCacheEntry>): void => {
  try {
    localStorage.setItem(getCacheStorageKey(userId), JSON.stringify(cache));
  } catch {
    // Preview cache is a best-effort client-only optimization.
  }
};

// This cache only stores client-side conversation previews so the sender can
// keep seeing the original text after reloads without exposing plaintext to the server.
export const saveConversationPreview = (
  userId: string,
  partnerId: string,
  preview: Pick<ConversationPreviewCacheEntry, "lastMessage" | "lastMessageAt" | "lastMessageSenderId">
): void => {
  if (!userId || !partnerId) return;

  const conversationKey = getConversationKey(userId, partnerId);
  if (!conversationKey) return;

  const cache = readCache(userId);
  cache[conversationKey] = {
    lastMessage: preview.lastMessage,
    lastMessageAt: preview.lastMessageAt,
    lastMessageSenderId: preview.lastMessageSenderId,
  };
  writeCache(userId, cache);
};

// Lookup is scoped by current user + partner key to avoid cross-account leakage
// on shared browsers where multiple accounts log in on the same device.
export const getCachedConversationPreview = (
  userId: string,
  partnerId: string
): ConversationPreviewCacheEntry | null => {
  if (!userId || !partnerId) return null;

  const conversationKey = getConversationKey(userId, partnerId);
  if (!conversationKey) return null;

  const cache = readCache(userId);
  return cache[conversationKey] || null;
};

// Server summaries for encrypted text are intentionally generic. This merge step
// restores local plaintext previews for the current device without weakening E2EE.
export const mergeConversationPreviewsFromCache = (
  conversations: Conversation[],
  userId: string
): Conversation[] => {
  if (!userId) return conversations;

  return conversations.map((conversation) => {
    const cachedPreview = getCachedConversationPreview(userId, conversation._id);
    if (!cachedPreview?.lastMessage) return conversation;

    // A local cached preview is more accurate for the sender than the server's
    // encrypted placeholder, so prefer it whenever it exists.
    return {
      ...conversation,
      lastMessage: cachedPreview.lastMessage,
      lastMessageAt: cachedPreview.lastMessageAt ?? conversation.lastMessageAt,
      lastMessageSenderId:
        cachedPreview.lastMessageSenderId ?? conversation.lastMessageSenderId,
    };
  });
};

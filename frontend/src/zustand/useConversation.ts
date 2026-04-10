import { create } from "zustand";
import { getConversationKey } from "../Utils/conversationKey";
import { getMessagePreviewText, shouldHideMessageForUser } from "../Utils/messageDisplay";
import type { Conversation, ConversationState, Message } from "../types";

// Conversation state is split by conversation key so socket events and HTTP fetches
// can converge on the same record without duplicating message lists.
const dedupeMessages = (messages: Message[] = []): Message[] => {
  const seen = new Set<string>();

  return messages.filter((message) => {
    const messageId = message?._id;

    if (!messageId) return true;
    if (seen.has(messageId)) return false;

    seen.add(messageId);
    return true;
  });
};

// Derive the latest visible preview from the message list, skipping items hidden
// for the current user so the sidebar reflects what that user can actually see.
const getConversationPreviewFromMessages = (
  messages: Message[] = [],
  currentUserId?: string
): { lastMessage?: string; lastMessageAt?: string } => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (shouldHideMessageForUser(message, currentUserId)) {
      continue;
    }

    return {
      lastMessage: getMessagePreviewText(message),
      lastMessageAt: message.createdAt,
    };
  }

  return {
    lastMessage: "",
    lastMessageAt: undefined,
  };
};

// Keep the conversation list in sync when a new message arrives.
// Existing conversations are updated in place; missing ones are inserted as
// lightweight placeholders until the full profile data is loaded.
const upsertConversationWithMessage = (
  conversations: Conversation[],
  incomingMessage: Message,
  currentUserId: string
): Conversation[] => {
  const partnerId =
    String(incomingMessage.senderId) === String(currentUserId)
      ? String(incomingMessage.receiverId)
      : String(incomingMessage.senderId);

  const existingIndex = conversations.findIndex(
    (conversation) => String(conversation._id) === partnerId
  );

  const lastMessage = getMessagePreviewText(incomingMessage);
  const lastMessageAt = incomingMessage.createdAt;

  if (existingIndex >= 0) {
    const updatedConversation = {
      ...conversations[existingIndex],
      lastMessage,
      lastMessageAt,
      seenAt: conversations[existingIndex].seenAt,
    } satisfies Conversation;

    return [
      updatedConversation,
      ...conversations.filter((_, index) => index !== existingIndex),
    ];
  }

  return [
    {
      _id: partnerId,
      userName: "New message",
      gender: "male",
      lastMessage,
      lastMessageAt,
      seenAt: undefined,
      __isPlaceholder: true,
    },
    ...conversations,
  ];
};

const useConversation = create<ConversationState>()((set, get) => ({
  selectedConversation: null,
  activeChat: null,
  conversations: [],
  messagesByConversation: {},
  unreadByConversation: {},
  uploadQueue: [],
  detailsRefreshVersion: 0,

  // Opening a chat clears its unread badge and keeps both selected and active
  // conversation references aligned for downstream components.
  setSelectedConversation: (selectedConversation, currentUserId) =>
    set((state) => {
      const conversationKey = getConversationKey(
        selectedConversation?._id,
        currentUserId
      );

      if (!conversationKey) {
  // Merge fresh conversation payloads with cached preview metadata so socket
  // updates do not get overwritten by later list refreshes.
        return {
          selectedConversation,
          activeChat: selectedConversation,
        };
      }

      return {
        selectedConversation,
        activeChat: selectedConversation,
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationKey]: 0,
        },
      };
    }),

  setConversations: (conversations) =>
    set((state) => {
      const existingById = new Map(
        state.conversations.map((conversation) => [String(conversation._id), conversation])
      );

      const mergedConversations = conversations.map((conversation) => {
        const existing = existingById.get(String(conversation._id));

        if (!existing) return conversation;

        return {
          ...conversation,
          lastMessage: conversation.lastMessage ?? existing.lastMessage,
          lastMessageAt: conversation.lastMessageAt ?? existing.lastMessageAt,
          lastMessageSenderId:
            conversation.lastMessageSenderId ?? existing.lastMessageSenderId,
          unreadCount: conversation.unreadCount ?? existing.unreadCount,
          seenAt: conversation.seenAt ?? existing.seenAt,
          __isPlaceholder: false,
        };
      });

      return { conversations: mergedConversations };
    }),

  // Store messages under a stable key and remove duplicates caused by the
  // common socket-plus-HTTP race.
  setMessagesForConversation: (conversationKey, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationKey]: dedupeMessages(messages),
      },
    })),

  // Append only when the message is genuinely new; socket retries should not
  // create duplicate rows in the open conversation.
  appendMessageToConversation: (conversationKey, newMessage) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      const alreadyExists = currentMessages.some(
        (message) => message?._id && message._id === newMessage?._id
      );

      if (alreadyExists) return state;
  // Apply targeted message updates such as edit, delete, or delivery status changes.

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationKey]: [...currentMessages, newMessage],
        },
      };
    }),
    // Remove a message only when the target exists so the state update stays idempotent.

  updateMessageInConversation: (conversationKey, messageId, patch) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      let didUpdate = false;

      const nextMessages = currentMessages.map((message) => {
        if (!message?._id || message._id !== messageId) return message;
  // Recompute the sidebar preview from the current message list after local edits,
  // deletions, or sync events.

        didUpdate = true;
        return {
          ...message,
          ...patch,
        };
      });

      if (!didUpdate) return state;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationKey]: nextMessages,
        },
      };
    }),

  removeMessageFromConversation: (conversationKey, messageId) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      const nextMessages = currentMessages.filter((message) => message?._id !== messageId);

      if (nextMessages.length === currentMessages.length) return state;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationKey]: nextMessages,
        },
      };
    }),

  syncConversationPreview: (conversationKey, currentUserId) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      const preview = getConversationPreviewFromMessages(currentMessages, currentUserId);

      const [firstParticipantId, secondParticipantId] = conversationKey.split("_");
      const partnerId = firstParticipantId === currentUserId ? secondParticipantId : firstParticipantId;

      const updatedConversations = state.conversations.map((conversation) => {
        if (String(conversation._id) !== String(partnerId)) return conversation;

        return {
          ...conversation,
          lastMessage: preview.lastMessage,
          lastMessageAt: preview.lastMessageAt,
          seenAt: conversation.seenAt,
        };
      });

      return {
        conversations: updatedConversations,
      };
    }),

  // Force the details panel to re-fetch when profile-affecting actions happen.
  bumpDetailsRefreshVersion: () =>
    set((state) => ({
      detailsRefreshVersion: state.detailsRefreshVersion + 1,
    })),

  // Keep unread counts isolated per conversation so inactive chats can accumulate
  // badges without affecting the currently open thread.
  incrementUnread: (conversationKey) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationKey]: (state.unreadByConversation[conversationKey] || 0) + 1,
      },
    })),

  // Insert or refresh conversation metadata from a socket message, deriving the
  // partner ID from the participants so routing stays deterministic.
  upsertConversationFromMessage: (incomingMessage, currentUserId) =>
    set((state) => ({
      conversations: upsertConversationWithMessage(
        state.conversations,
        incomingMessage,
        currentUserId
      ),
    })),

  // Expose a read helper so callers do not need to know the internal map shape.
  getMessagesForConversation: (conversationKey) => get().messagesByConversation[conversationKey] || [],

  // Reset conversation-scoped state on auth user changes to avoid cross-session stale data.
  resetConversationState: () =>
    set({
      selectedConversation: null,
      activeChat: null,
      conversations: [],
      messagesByConversation: {},
      unreadByConversation: {},
      uploadQueue: [],
      detailsRefreshVersion: 0,
    }),

  // Seed unread badges from API-provided unread counts after login/reload.
  hydrateUnreadFromConversations: (conversations, currentUserId) =>
    set((state) => {
      if (!currentUserId) return state;

      const nextUnreadByConversation: Record<string, number> = {};
      const selectedId = state.selectedConversation?._id;

      conversations.forEach((conversation) => {
        const conversationKey = getConversationKey(conversation._id, currentUserId);
        if (!conversationKey) return;

        const serverUnread = Number(conversation.unreadCount || 0);
        const localUnread = state.unreadByConversation[conversationKey] || 0;
        const isSelected = selectedId ? String(selectedId) === String(conversation._id) : false;

        nextUnreadByConversation[conversationKey] = isSelected
          ? 0
          : Math.max(localUnread, serverUnread);
      });

      return {
        unreadByConversation: nextUnreadByConversation,
      };
    }),

  // Sync the seen timestamp after a read receipt so sender-side UI updates instantly.
  // Important: UI conversations are keyed by partner user id, while the socket payload
  // includes both backend conversationId and readerId. We map by readerId here.
  markConversationSeen: (conversationId, readerId, seenAt, currentUserId) =>
    set((state) => {
      if (!currentUserId) return state;
      if (!conversationId || !readerId || !seenAt) return state;

      const conversationKey = getConversationKey(readerId, currentUserId);
      if (!conversationKey) return state;

      const patchConversation = (conversation: Conversation | null): Conversation | null => {
        if (!conversation || String(conversation._id) !== String(readerId)) return conversation;

        return {
          ...conversation,
          seenAt,
          unreadCount: 0,
        };
      };

      return {
        conversations: state.conversations.map((conversation) =>
          String(conversation._id) === String(readerId)
            ? { ...conversation, seenAt, unreadCount: 0 }
            : conversation
        ),
        selectedConversation: patchConversation(state.selectedConversation),
        activeChat: patchConversation(state.activeChat),
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationKey]: 0,
        },
      };
    }),

  // Track pending uploads separately from messages so UI can show progress and
  // clean them up independently of chat history.
  addUploadJobs: (jobs) =>
    set((state) => ({
      uploadQueue: [...state.uploadQueue, ...jobs],
    })),

  // Keep upload updates narrow: only the targeted job gets patched.
  updateUploadJob: (jobId, patch) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((job) =>
        job.id === jobId ? { ...job, ...patch } : job
      ),
    })),

  // Remove completed or failed jobs once the UI no longer needs them.
  removeUploadJob: (jobId) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((job) => job.id !== jobId),
    })),

  // Keep only active uploads in the queue so old finished jobs do not linger.
  clearCompletedUploads: () =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((job) => job.status === "uploading"),
    })),
}));

export default useConversation;
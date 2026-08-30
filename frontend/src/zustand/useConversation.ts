import { create } from "zustand";
import { getMessagePreviewText, shouldHideMessageForUser } from "../Utils/messageDisplay";
import type { Conversation, ConversationState, Message } from "../types";

// Conversation state is keyed directly by the real conversation _id (which
// also equals message.conversationId on every message payload) — no derived
// key needed, unlike the old per-pair getConversationKey scheme this
// replaced, which couldn't represent groups anyway.
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
): { lastMessage?: string; lastMessageAt?: string; lastMessageSenderId?: string } => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (shouldHideMessageForUser(message, currentUserId)) {
      continue;
    }

    return {
      lastMessage: getMessagePreviewText(message),
      lastMessageAt: message.createdAt,
      lastMessageSenderId: String(message.senderId),
    };
  }

  return {
    lastMessage: "",
    lastMessageAt: undefined,
    lastMessageSenderId: undefined,
  };
};

// Keep the conversation list in sync when a new message arrives.
// Existing conversations are updated in place; a conversation the client
// hasn't seen yet (e.g. someone just started a new direct chat, or added
// this user to a group) is inserted as a lightweight placeholder until the
// next full conversation-list refresh fills in real display info.
const upsertConversationWithMessage = (
  conversations: Conversation[],
  incomingMessage: Message
): Conversation[] => {
  const conversationId = incomingMessage.conversationId;
  if (!conversationId) return conversations;

  const existingIndex = conversations.findIndex(
    (conversation) => String(conversation._id) === conversationId
  );

  const lastMessage = getMessagePreviewText(incomingMessage);
  const lastMessageAt = incomingMessage.createdAt;
  const lastMessageSenderId = String(incomingMessage.senderId);

  if (existingIndex >= 0) {
    const updatedConversation = {
      ...conversations[existingIndex],
      lastMessage,
      lastMessageAt,
      lastMessageSenderId,
      seenAt: conversations[existingIndex].seenAt,
    } satisfies Conversation;

    return [
      updatedConversation,
      ...conversations.filter((_, index) => index !== existingIndex),
    ];
  }

  return [
    {
      _id: conversationId,
      type: "direct",
      displayName: "New message",
      participants: [],
      lastMessage,
      lastMessageAt,
      lastMessageSenderId,
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
  hasMoreByConversation: {},
  uploadQueue: [],
  detailsRefreshVersion: 0,
  replyTarget: null,

  // Shared between Message.tsx (sets it via the action menu) and
  // MessageInput.tsx (reads/clears it) — both are siblings, so the store
  // avoids an awkward prop-drill through Messages.tsx.
  setReplyTarget: (message) => set({ replyTarget: message }),

  // Opening a chat clears its unread badge and keeps both selected and active
  // conversation references aligned for downstream components.
  setSelectedConversation: (selectedConversation) =>
    set((state) => {
      if (!selectedConversation?._id) {
        return {
          selectedConversation,
          activeChat: selectedConversation,
          replyTarget: null,
        };
      }

      return {
        selectedConversation,
        activeChat: selectedConversation,
        replyTarget: null,
        unreadByConversation: {
          ...state.unreadByConversation,
          [selectedConversation._id]: 0,
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

      // setConversations always carries the full authoritative list from
      // GET /conversations, so this also keeps the open conversation (e.g. a
      // group's member list/name shown in the details panel) in sync with
      // fresh server data, and clears it if this device is no longer a
      // participant (removed/left elsewhere).
      const mergedById = new Map(
        mergedConversations.map((conversation) => [String(conversation._id), conversation])
      );

      const nextSelectedConversation = state.selectedConversation
        ? mergedById.get(String(state.selectedConversation._id)) ?? null
        : state.selectedConversation;
      const nextActiveChat = state.activeChat
        ? mergedById.get(String(state.activeChat._id)) ?? null
        : state.activeChat;

      return {
        conversations: mergedConversations,
        selectedConversation: nextSelectedConversation,
        activeChat: nextActiveChat,
      };
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

  // Older pages land at the front of the list. Dedup keeps a socket-delivered
  // message that also appears in the fetched page from rendering twice.
  prependMessagesToConversation: (conversationKey, messages) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationKey]: dedupeMessages([...messages, ...currentMessages]),
        },
      };
    }),

  setHasMore: (conversationKey, hasMore) =>
    set((state) => ({
      hasMoreByConversation: {
        ...state.hasMoreByConversation,
        [conversationKey]: hasMore,
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

      const updatedConversations = state.conversations.map((conversation) => {
        if (String(conversation._id) !== conversationKey) return conversation;

        return {
          ...conversation,
          lastMessage: preview.lastMessage,
          lastMessageAt: preview.lastMessageAt,
          lastMessageSenderId: preview.lastMessageSenderId,
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

  // Insert or refresh conversation metadata from a socket message.
  upsertConversationFromMessage: (incomingMessage) =>
    set((state) => ({
      conversations: upsertConversationWithMessage(state.conversations, incomingMessage),
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
      hasMoreByConversation: {},
      uploadQueue: [],
      detailsRefreshVersion: 0,
      replyTarget: null,
    }),

  // Seed unread badges from API-provided unread counts after login/reload.
  hydrateUnreadFromConversations: (conversations, currentUserId) =>
    set((state) => {
      if (!currentUserId) return state;

      const nextUnreadByConversation: Record<string, number> = {};
      const selectedId = state.selectedConversation?._id;

      conversations.forEach((conversation) => {
        const conversationId = conversation._id;
        if (!conversationId) return;

        const serverUnread = Number(conversation.unreadCount || 0);
        const localUnread = state.unreadByConversation[conversationId] || 0;
        const isSelected = selectedId ? String(selectedId) === String(conversationId) : false;

        nextUnreadByConversation[conversationId] = isSelected
          ? 0
          : Math.max(localUnread, serverUnread);
      });

      return {
        unreadByConversation: nextUnreadByConversation,
      };
    }),

  // Sync the seen timestamp after a read receipt so sender-side UI updates
  // instantly. Matches directly on the conversationId the receipt already
  // carries — previously this derived a key from readerId instead, which
  // only ever worked by accident under the old model where a conversation's
  // _id happened to equal the other participant's user id.
  markConversationSeen: (conversationId, readerId, seenAt, currentUserId) =>
    set((state) => {
      if (!currentUserId) return state;
      if (!conversationId || !readerId || !seenAt) return state;

      const patchConversation = (conversation: Conversation | null): Conversation | null => {
        if (!conversation || String(conversation._id) !== String(conversationId)) return conversation;

        return {
          ...conversation,
          seenAt,
          unreadCount: 0,
        };
      };

      return {
        conversations: state.conversations.map((conversation) =>
          String(conversation._id) === String(conversationId)
            ? { ...conversation, seenAt, unreadCount: 0 }
            : conversation
        ),
        selectedConversation: patchConversation(state.selectedConversation),
        activeChat: patchConversation(state.activeChat),
        unreadByConversation: {
          ...state.unreadByConversation,
          [conversationId]: 0,
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

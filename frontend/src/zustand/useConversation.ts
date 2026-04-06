import { create } from "zustand";
import { getConversationKey } from "../Utils/conversationKey";
import { getMessagePreviewText, shouldHideMessageForUser } from "../Utils/messageDisplay";
import type { Conversation, ConversationState, Message } from "../types";

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

  setSelectedConversation: (selectedConversation, currentUserId) =>
    set((state) => {
      const conversationKey = getConversationKey(
        selectedConversation?._id,
        currentUserId
      );

      if (!conversationKey) {
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
          lastMessage: existing.lastMessage,
          lastMessageAt: existing.lastMessageAt,
          __isPlaceholder: false,
        };
      });

      return { conversations: mergedConversations };
    }),

  setMessagesForConversation: (conversationKey, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationKey]: dedupeMessages(messages),
      },
    })),

  appendMessageToConversation: (conversationKey, newMessage) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      const alreadyExists = currentMessages.some(
        (message) => message?._id && message._id === newMessage?._id
      );

      if (alreadyExists) return state;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationKey]: [...currentMessages, newMessage],
        },
      };
    }),

  updateMessageInConversation: (conversationKey, messageId, patch) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationKey] || [];
      let didUpdate = false;

      const nextMessages = currentMessages.map((message) => {
        if (!message?._id || message._id !== messageId) return message;

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
        };
      });

      return {
        conversations: updatedConversations,
      };
    }),

  bumpDetailsRefreshVersion: () =>
    set((state) => ({
      detailsRefreshVersion: state.detailsRefreshVersion + 1,
    })),

  incrementUnread: (conversationKey) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationKey]: (state.unreadByConversation[conversationKey] || 0) + 1,
      },
    })),

  upsertConversationFromMessage: (incomingMessage, currentUserId) =>
    set((state) => ({
      conversations: upsertConversationWithMessage(
        state.conversations,
        incomingMessage,
        currentUserId
      ),
    })),

  getMessagesForConversation: (conversationKey) => get().messagesByConversation[conversationKey] || [],

  addUploadJobs: (jobs) =>
    set((state) => ({
      uploadQueue: [...state.uploadQueue, ...jobs],
    })),

  updateUploadJob: (jobId, patch) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((job) =>
        job.id === jobId ? { ...job, ...patch } : job
      ),
    })),

  removeUploadJob: (jobId) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((job) => job.id !== jobId),
    })),

  clearCompletedUploads: () =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((job) => job.status === "uploading"),
    })),
}));

export default useConversation;
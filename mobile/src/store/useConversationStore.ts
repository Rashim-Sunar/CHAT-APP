// Trimmed phase-1 port of frontend/src/zustand/useConversation.ts — direct
// conversations + messages only, no upload queue/reply-target/unread
// bookkeeping yet.
import { create } from "zustand";
import type { Conversation, Message } from "../types";

interface ConversationStoreState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messagesByConversation: Record<string, Message[]>;
  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (conversationId: string | null) => void;
  setMessagesForConversation: (conversationId: string, messages: Message[]) => void;
  appendMessageToConversation: (conversationId: string, message: Message) => void;
  resetConversationState: () => void;
}

const dedupeMessages = (messages: Message[]): Message[] => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!message._id) return true;
    if (seen.has(message._id)) return false;
    seen.add(message._id);
    return true;
  });
};

const useConversationStore = create<ConversationStoreState>()((set) => ({
  conversations: [],
  selectedConversationId: null,
  messagesByConversation: {},

  setConversations: (conversations) => set({ conversations }),

  selectConversation: (conversationId) => set({ selectedConversationId: conversationId }),

  setMessagesForConversation: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: dedupeMessages(messages),
      },
    })),

  appendMessageToConversation: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      if (message._id && existing.some((candidate) => candidate._id === message._id)) {
        return state;
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, message],
        },
      };
    }),

  resetConversationState: () =>
    set({ conversations: [], selectedConversationId: null, messagesByConversation: {} }),
}));

export default useConversationStore;

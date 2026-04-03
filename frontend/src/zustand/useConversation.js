import { create } from "zustand";
import { getConversationKey } from "../Utils/conversationKey";

// Normalize arrays coming from mixed transport paths (REST + socket) by _id.
// Messages without _id are kept to avoid dropping optimistic/local-only entries.
const dedupeMessages = (messages = []) => {
    const seen = new Set();

    return messages.filter((message) => {
        const messageId = message?._id;

        if (!messageId) return true;
        if (seen.has(messageId)) return false;

        seen.add(messageId);
        return true;
    });
};

// Upsert and re-order sidebar conversations so the most recently active
// conversation is always at the top after a new incoming/outgoing message.
const upsertConversationWithMessage = (
    conversations,
    incomingMessage,
    currentUserId
) => {
    const partnerId =
        String(incomingMessage.senderId) === String(currentUserId)
            ? String(incomingMessage.receiverId)
            : String(incomingMessage.senderId);

    const existingIndex = conversations.findIndex(
        (conversation) => String(conversation._id) === partnerId
    );

    const lastMessage = incomingMessage.message;
    const lastMessageAt = incomingMessage.createdAt;

    if (existingIndex >= 0) {
        const updatedConversation = {
            ...conversations[existingIndex],
            lastMessage,
            lastMessageAt,
        };

        return [
            updatedConversation,
            ...conversations.filter((_, index) => index !== existingIndex),
        ];
    }

    // If sidebar data is not loaded yet, create a minimal placeholder so unread tracking remains stable.
    return [
        {
            _id: partnerId,
            // Placeholder fields are replaced when authoritative sidebar data is fetched.
            userName: "New message",
            gender: "male",
            lastMessage,
            lastMessageAt,
            __isPlaceholder: true,
        },
        ...conversations,
    ];
};

// Central chat store design:
// 1) Message state is conversation-scoped (messagesByConversation) instead of global.
// 2) Realtime events can update unread counters and previews without mutating
//    the currently open message list.
// This prevents the classic bug where incoming messages render in the wrong chat tab.
const useConversation = create((set, get) => ({
    selectedConversation: null,
    activeChat: null,
    conversations: [],
    // Conversation-scoped buckets prevent cross-chat leakage from realtime events.
    messagesByConversation: {},
    unreadByConversation: {},

    // Selecting a conversation marks it as active and clears unread for that key.
    // We key unread by deterministic conversation id to keep behavior stable
    // before/after server-side conversation documents are fully hydrated.
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

    // Merge freshly fetched conversations with local realtime metadata.
    // Server payload remains source-of-truth for profile fields, while
    // local lastMessage/lastMessageAt is preserved to avoid preview flicker.
    setConversations: (conversations) =>
        set((state) => {
            const existingById = new Map(
                state.conversations.map((conversation) => [
                    String(conversation._id),
                    conversation,
                ])
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
                // Full replacement path used by message history fetch.
                [conversationKey]: dedupeMessages(messages),
            },
        })),

    appendMessageToConversation: (conversationKey, newMessage) =>
        set((state) => {
            // Idempotent append avoids duplicates from race conditions (HTTP response + socket event).
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

    // Unread counters are incremented only when incoming message does not belong
    // to the active conversation (handled by socket listener).
    incrementUnread: (conversationKey) =>
        set((state) => ({
            unreadByConversation: {
                ...state.unreadByConversation,
                [conversationKey]: (state.unreadByConversation[conversationKey] || 0) + 1,
            },
        })),

    // Sidebar preview updater for realtime events. Keeps UX responsive without
    // requiring a full conversation list refetch on each message.
    upsertConversationFromMessage: (incomingMessage, currentUserId) =>
        set((state) => ({
            conversations: upsertConversationWithMessage(
                state.conversations,
                incomingMessage,
                currentUserId
            ),
        })),

    // Selector helper to keep components simple and avoid undefined checks.
    getMessagesForConversation: (conversationKey) =>
        get().messagesByConversation[conversationKey] || [],
}));

export default useConversation;

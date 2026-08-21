import { useCallback } from "react";
import {
  deleteMessage as deleteMessageRequest,
  editMessage as editMessageRequest,
  reactToMessage as reactToMessageRequest,
  setMessagePinned,
} from "../api/messages";
import {
  decryptMessageIfNeeded,
  encryptTextMessageForRecipients,
  getRecipientPublicKeys,
} from "../crypto/crypto";
import useConversationStore from "../store/useConversationStore";
import type { Message } from "../types";

interface UseMessageActionsOptions {
  conversationId: string;
  currentUserId: string;
  participantIds: string[];
}

export const DELETED_MESSAGE_TEXT = "This message was deleted";

const useMessageActions = ({ conversationId, currentUserId, participantIds }: UseMessageActionsOptions) => {
  const messagesByConversation = useConversationStore((state) => state.messagesByConversation);
  const setMessagesForConversation = useConversationStore((state) => state.setMessagesForConversation);
  const updateMessageInConversation = useConversationStore((state) => state.updateMessageInConversation);
  const removeMessageFromConversation = useConversationStore((state) => state.removeMessageFromConversation);

  const snapshot = useCallback(
    () => messagesByConversation[conversationId] || [],
    [messagesByConversation, conversationId]
  );

  const restore = useCallback(
    (previous: Message[]) => setMessagesForConversation(conversationId, previous),
    [conversationId, setMessagesForConversation]
  );

  // REST responses for E2EE text carry an empty `text` — the real content only
  // lives in the encrypted envelope — so server payloads must be decrypted
  // before they replace already-readable local state.
  const applyServerMessage = useCallback(
    async (messageId: string, serverMessage: Message) => {
      const hydrated = await decryptMessageIfNeeded(serverMessage, currentUserId);
      updateMessageInConversation(conversationId, messageId, hydrated);
    },
    [conversationId, currentUserId, updateMessageInConversation]
  );

  const editMessage = useCallback(
    async (message: Message, nextText: string): Promise<boolean> => {
      const messageId = message._id;
      const trimmed = nextText.trim();
      if (!messageId || !trimmed) return false;

      const previous = snapshot();
      updateMessageInConversation(conversationId, messageId, {
        text: trimmed,
        message: trimmed,
        edited: true,
        editedAt: new Date().toISOString(),
      });

      try {
        const recipients = await getRecipientPublicKeys(participantIds);
        if (recipients.length < participantIds.length) {
          throw new Error("One or more participants haven't set up encryption yet");
        }

        const encrypted = await encryptTextMessageForRecipients(trimmed, recipients);
        const updated = await editMessageRequest(messageId, encrypted);
        if (updated) await applyServerMessage(messageId, updated);
        return true;
      } catch {
        restore(previous);
        return false;
      }
    },
    [conversationId, participantIds, snapshot, restore, updateMessageInConversation, applyServerMessage]
  );

  const reactToMessage = useCallback(
    async (message: Message, emoji: string): Promise<boolean> => {
      const messageId = message._id;
      if (!messageId) return false;

      const previous = snapshot();
      const existing = message.reactions || [];
      const mine = existing.find((reaction) => reaction.userId === currentUserId);
      const optimistic =
        mine && mine.emoji === emoji
          ? existing.filter((reaction) => reaction.userId !== currentUserId)
          : [...existing.filter((reaction) => reaction.userId !== currentUserId), { userId: currentUserId, emoji }];

      updateMessageInConversation(conversationId, messageId, { reactions: optimistic });

      try {
        const updated = await reactToMessageRequest(messageId, emoji);
        if (updated) await applyServerMessage(messageId, updated);
        return true;
      } catch {
        restore(previous);
        return false;
      }
    },
    [conversationId, currentUserId, snapshot, restore, updateMessageInConversation, applyServerMessage]
  );

  const togglePin = useCallback(
    async (message: Message): Promise<boolean> => {
      const messageId = message._id;
      if (!messageId) return false;

      const nextPinned = !message.pinned;
      const previous = snapshot();
      updateMessageInConversation(conversationId, messageId, {
        pinned: nextPinned,
        pinnedAt: nextPinned ? new Date().toISOString() : null,
        pinnedBy: nextPinned ? currentUserId : null,
      });

      try {
        const updated = await setMessagePinned(messageId, nextPinned);
        if (updated) await applyServerMessage(messageId, updated);
        return true;
      } catch {
        restore(previous);
        return false;
      }
    },
    [conversationId, currentUserId, snapshot, restore, updateMessageInConversation, applyServerMessage]
  );

  const deleteMessage = useCallback(
    async (message: Message, type: "me" | "everyone"): Promise<boolean> => {
      const messageId = message._id;
      if (!messageId) return false;

      const previous = snapshot();

      if (type === "me") {
        removeMessageFromConversation(conversationId, messageId);
      } else {
        updateMessageInConversation(conversationId, messageId, {
          deletedForEveryone: true,
          text: DELETED_MESSAGE_TEXT,
          message: DELETED_MESSAGE_TEXT,
        });
      }

      try {
        const updated = await deleteMessageRequest(messageId, type);

        if (updated) {
          if (updated.deletedFor?.includes(currentUserId) && !updated.deletedForEveryone) {
            removeMessageFromConversation(conversationId, messageId);
          } else {
            await applyServerMessage(messageId, updated);
          }
        }

        return true;
      } catch {
        restore(previous);
        return false;
      }
    },
    [
      conversationId,
      currentUserId,
      snapshot,
      restore,
      updateMessageInConversation,
      removeMessageFromConversation,
      applyServerMessage,
    ]
  );

  return { editMessage, reactToMessage, togglePin, deleteMessage };
};

export default useMessageActions;

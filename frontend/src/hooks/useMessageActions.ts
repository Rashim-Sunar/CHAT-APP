// ----------------------------------------
// @file   useMessageActions.ts
// @desc   Message edit/delete mutations with optimistic UI and rollback safety
// ----------------------------------------
// This hook centralizes mutation behavior for a single message so components can
// remain presentational. It preserves UI responsiveness via optimistic updates
// while keeping cache state consistent with server authority.
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { DELETED_MESSAGE_TEXT } from "../Utils/messageDisplay";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import {
  decryptMessageIfNeeded,
  encryptTextMessageForRecipients,
  getRecipientPublicKeys,
  requireUserKeyPair,
} from "../Utils/crypto";

/**
 * Exposes guarded edit/delete actions for one message instance.
 *
 * Responsibilities:
 * - perform optimistic local mutations for immediate feedback
 * - persist changes via API
 * - reconcile cache with server response
 * - rollback snapshot on failure
 *
 * @param message Message targeted by mutation controls.
 * @returns Busy flags, permission guards, and mutation functions.
 */
const useMessageActions = (message: Message) => {
  const [busyAction, setBusyAction] = useState<"edit" | "delete" | null>(null);
  const { authUser } = useAuthContext();
  const {
    selectedConversation,
    setMessagesForConversation,
    updateMessageInConversation,
    removeMessageFromConversation,
    syncConversationPreview,
    bumpDetailsRefreshVersion,
  } = useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationKey = message.conversationId;
  const messageId = message._id;

  // Captures pre-mutation state for deterministic rollback on request failure.
  const snapshotMessages = (): Message[] => {
    if (!conversationKey) return [];
    return useConversation.getState().messagesByConversation[conversationKey] || [];
  };

  // Restores full conversation cache and derived preview after rollback.
  const restoreMessages = (previousMessages: Message[]): void => {
    if (!conversationKey || !currentUserId) return;
    setMessagesForConversation(conversationKey, previousMessages);
    syncConversationPreview(conversationKey, currentUserId);
  };

  // Applies canonical server payload — decrypts first, since the REST
  // response for an E2EE text message carries text: "" (real content is
  // only in encryptedMessage/encryptedAESKeys).
  const applyServerMessage = async (serverMessage: Message): Promise<void> => {
    if (!conversationKey || !messageId || !currentUserId) return;

    const hydratedMessage = await decryptMessageIfNeeded(serverMessage, currentUserId);
    updateMessageInConversation(conversationKey, messageId, hydratedMessage);
    syncConversationPreview(conversationKey, currentUserId);
  };

  /**
   * Edits message content with optimistic update and server reconciliation.
   * For text messages, payload is re-encrypted client-side to preserve E2EE.
   */
  const editMessage = async (content: string): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error("Message cannot be empty");
      return false;
    }

    const previousMessages = snapshotMessages();
    setBusyAction("edit");

    // Optimistic patch keeps perceived latency low while request is in flight.
    updateMessageInConversation(conversationKey, messageId, {
      text: trimmedContent,
      message: trimmedContent,
      edited: true,
      editedAt: new Date().toISOString(),
    });
    syncConversationPreview(conversationKey, currentUserId);
    bumpDetailsRefreshVersion();

    try {
      let updatePayload: {
        content?: string;
        encryptedMessage?: string;
        encryptedAESKeys?: { userId: string; wrappedKey: string }[];
        iv?: string;
      };

      if (message.messageType === "text") {
        // E2EE path: edits are re-encrypted on the client, wrapped for every
        // current conversation participant (same as a fresh send).
        await requireUserKeyPair(currentUserId);
        const participantIds =
          selectedConversation?.participants.map((participant) => participant._id) || [];
        const recipients = await getRecipientPublicKeys(participantIds);

        if (recipients.length < participantIds.length) {
          throw new Error("One or more participants haven't set up encryption yet");
        }

        const encryptedPayload = await encryptTextMessageForRecipients(trimmedContent, recipients);

        updatePayload = {
          encryptedMessage: encryptedPayload.encryptedMessage,
          encryptedAESKeys: encryptedPayload.encryptedAESKeys,
          iv: encryptedPayload.iv,
        };
      } else {
        // Non-text content uses plain metadata update flow.
        updatePayload = { content: trimmedContent };
      }

      const data = await apiFetch<ApiErrorResponse & { updatedMessage?: Message }>(
        `/messages/${messageId}`,
        {
        method: "PUT",
        body: JSON.stringify(updatePayload),
        }
      );

      if (data.error) {
        throw new Error(data.error || "Failed to edit message");
      }

      if (data.updatedMessage) {
        await applyServerMessage(data.updatedMessage);
        bumpDetailsRefreshVersion();
      }

      return true;
    } catch (error: unknown) {
      restoreMessages(previousMessages);
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  /**
   * Adds, replaces, or removes (toggle) the current user's reaction on this
   * message. Optimistic like edit/delete, but deliberately doesn't set
   * busyAction — reactions should feel instant, not gate the whole menu.
   */
  const reactToMessage = async (emoji: string): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const trimmedEmoji = emoji.trim();
    if (!trimmedEmoji) return false;

    const previousMessages = snapshotMessages();
    const existingReactions = message.reactions || [];
    const existingReaction = existingReactions.find((reaction) => reaction.userId === currentUserId);

    const optimisticReactions =
      existingReaction && existingReaction.emoji === trimmedEmoji
        ? existingReactions.filter((reaction) => reaction.userId !== currentUserId)
        : [
            ...existingReactions.filter((reaction) => reaction.userId !== currentUserId),
            { userId: currentUserId, emoji: trimmedEmoji },
          ];

    updateMessageInConversation(conversationKey, messageId, { reactions: optimisticReactions });

    try {
      const data = await apiFetch<ApiErrorResponse & { updatedMessage?: Message }>(
        `/messages/${messageId}/react`,
        {
          method: "POST",
          body: JSON.stringify({ emoji: trimmedEmoji }),
        }
      );

      if (data.error) {
        throw new Error(data.error || "Failed to react to message");
      }

      if (data.updatedMessage) {
        await applyServerMessage(data.updatedMessage);
      }

      return true;
    } catch (error: unknown) {
      restoreMessages(previousMessages);
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  /**
   * Pins or unpins this message. Optimistic like reactions — no busyAction,
   * should feel instant. Any current participant may pin/unpin.
   */
  const togglePin = async (nextPinned: boolean): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const previousMessages = snapshotMessages();
    updateMessageInConversation(conversationKey, messageId, {
      pinned: nextPinned,
      pinnedAt: nextPinned ? new Date().toISOString() : null,
      pinnedBy: nextPinned ? currentUserId : null,
    });

    try {
      const data = await apiFetch<ApiErrorResponse & { updatedMessage?: Message }>(
        `/messages/${messageId}/pin`,
        { method: nextPinned ? "POST" : "DELETE" }
      );

      if (data.error) {
        throw new Error(data.error || "Failed to update pin");
      }

      if (data.updatedMessage) {
        await applyServerMessage(data.updatedMessage);
      }

      return true;
    } catch (error: unknown) {
      restoreMessages(previousMessages);
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  /**
   * Deletes a message for current user or all participants, with optimistic UI.
   * Falls back to snapshot rollback if server mutation fails.
   */
  const deleteMessage = async (deleteType: "me" | "everyone"): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const previousMessages = snapshotMessages();
    setBusyAction("delete");

    // Optimistic behavior mirrors expected server outcome per deletion mode.
    if (deleteType === "me") {
      removeMessageFromConversation(conversationKey, messageId);
    } else {
      updateMessageInConversation(conversationKey, messageId, {
        deletedForEveryone: true,
        text: DELETED_MESSAGE_TEXT,
        message: DELETED_MESSAGE_TEXT,
      });
    }

    syncConversationPreview(conversationKey, currentUserId);
    bumpDetailsRefreshVersion();

    try {
      const data = await apiFetch<ApiErrorResponse & { updatedMessage?: Message }>(
        `/messages/${messageId}`,
        {
        method: "DELETE",
        body: JSON.stringify({ type: deleteType }),
        }
      );

      if (data.error) {
        throw new Error(data.error || "Failed to delete message");
      }

      if (data.updatedMessage) {
        if (data.updatedMessage.deletedFor?.includes(currentUserId) && !data.updatedMessage.deletedForEveryone) {
          removeMessageFromConversation(conversationKey, messageId);
          syncConversationPreview(conversationKey, currentUserId);
        } else {
          await applyServerMessage(data.updatedMessage);
        }
        bumpDetailsRefreshVersion();
      }

      return true;
    } catch (error: unknown) {
      restoreMessages(previousMessages);
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  return {
    isBusy: Boolean(busyAction),
    isEditing: busyAction === "edit",
    isDeleting: busyAction === "delete",
    canEdit: Boolean(messageId && currentUserId && String(message.senderId) === String(currentUserId)),
    // "Delete for me" hides a message from the requester's own view only, so
    // either participant may do it. "Delete for everyone" stays sender-only.
    canDelete: Boolean(messageId && currentUserId),
    canDeleteForEveryone: Boolean(messageId && currentUserId && String(message.senderId) === String(currentUserId)),
    editMessage,
    deleteMessage,
    reactToMessage,
    togglePin,
  };
};

export default useMessageActions;

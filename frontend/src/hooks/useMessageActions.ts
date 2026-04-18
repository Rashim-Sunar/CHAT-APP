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
import { getConversationKey } from "../Utils/conversationKey";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { DELETED_MESSAGE_TEXT } from "../Utils/messageDisplay";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import { encryptTextMessage, getPublicKeyByUserId, requireUserKeyPair } from "../Utils/crypto";

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
  const { setMessagesForConversation, updateMessageInConversation, removeMessageFromConversation, syncConversationPreview, bumpDetailsRefreshVersion } =
    useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationKey = getConversationKey(message.senderId, message.receiverId);
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

  // Applies canonical server payload to avoid local/server divergence.
  const applyServerMessage = (serverMessage: Message): void => {
    if (!conversationKey || !messageId || !currentUserId) return;

    updateMessageInConversation(conversationKey, messageId, serverMessage);
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
        encryptedAESKey?: string;
        iv?: string;
      };

      if (message.messageType === "text") {
        // E2EE path: edits are encrypted on the client before transport.
        const { publicKey: senderPublicKey } = await requireUserKeyPair(currentUserId);
        const receiverPublicKey = await getPublicKeyByUserId(String(message.receiverId));
        const encryptedPayload = await encryptTextMessage(
          trimmedContent,
          receiverPublicKey,
          senderPublicKey
        );

        updatePayload = {
          encryptedMessage: encryptedPayload.encryptedMessage,
          encryptedAESKey: encryptedPayload.encryptedAESKey,
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
        applyServerMessage(data.updatedMessage);
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
        // Reconcile with server truth to handle edge cases from backend policy.
        if (data.updatedMessage.deletedForEveryone) {
          updateMessageInConversation(conversationKey, messageId, data.updatedMessage);
        } else if (data.updatedMessage.deletedFor?.includes(currentUserId)) {
          removeMessageFromConversation(conversationKey, messageId);
        } else {
          updateMessageInConversation(conversationKey, messageId, data.updatedMessage);
        }
        syncConversationPreview(conversationKey, currentUserId);
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
    canDelete: Boolean(messageId && currentUserId && String(message.senderId) === String(currentUserId)),
    editMessage,
    deleteMessage,
  };
};

export default useMessageActions;

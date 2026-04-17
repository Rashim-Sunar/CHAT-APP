// Encapsulates edit and delete behavior for a single message, including optimistic
// updates, rollback on failure, and derived conversation preview refreshes.
// Depends on the authenticated user, message-specific conversation routing, the
// shared conversation store, and the message API endpoints.
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { DELETED_MESSAGE_TEXT } from "../Utils/messageDisplay";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import { encryptTextMessage, ensureUserKeyPair, getPublicKeyByUserId } from "../Utils/crypto";

/**
 * Provide edit/delete controls and guarded mutations for a single message.
 * Side effects: performs PUT/DELETE requests, mutates the per-conversation message
 * cache, refreshes preview state, and rolls back local changes on failure.
 *
 * @param {Message} message The message being controlled by the calling component.
 * @returns {{ isBusy: boolean; isEditing: boolean; isDeleting: boolean; canEdit: boolean; canDelete: boolean; editMessage: (content: string) => Promise<boolean>; deleteMessage: (deleteType: "me" | "everyone") => Promise<boolean> }} Action state and mutators for the message.
 */
const useMessageActions = (message: Message) => {
  const [busyAction, setBusyAction] = useState<"edit" | "delete" | null>(null);
  const { authUser } = useAuthContext();
  const { setMessagesForConversation, updateMessageInConversation, removeMessageFromConversation, syncConversationPreview, bumpDetailsRefreshVersion } =
    useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationKey = getConversationKey(message.senderId, message.receiverId);
  const messageId = message._id;

  // Snapshot the current thread so failed edits/deletes can be rolled back safely.
  const snapshotMessages = (): Message[] => {
    if (!conversationKey) return [];
    return useConversation.getState().messagesByConversation[conversationKey] || [];
  };

  // Restore the cached message list after a failed server mutation.
  const restoreMessages = (previousMessages: Message[]): void => {
    if (!conversationKey || !currentUserId) return;
    setMessagesForConversation(conversationKey, previousMessages);
    syncConversationPreview(conversationKey, currentUserId);
  };

  // Apply the server version of a message after a successful edit/delete response.
  const applyServerMessage = (serverMessage: Message): void => {
    if (!conversationKey || !messageId || !currentUserId) return;

    updateMessageInConversation(conversationKey, messageId, serverMessage);
    syncConversationPreview(conversationKey, currentUserId);
  };

  const editMessage = async (content: string): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error("Message cannot be empty");
      return false;
    }

    const previousMessages = snapshotMessages();
    setBusyAction("edit");

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
        const { publicKey: senderPublicKey } = await ensureUserKeyPair(currentUserId);
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
   * Delete the message either just for the current user or for everyone.
   * Side effects: applies an optimistic update, persists the change to the
   * backend, and restores the previous message snapshot if the request fails.
   *
   * @param {"me" | "everyone"} deleteType Scope of deletion requested by the user.
   * @returns {Promise<boolean>} True when the server mutation succeeds.
   */
  const deleteMessage = async (deleteType: "me" | "everyone"): Promise<boolean> => {
    if (!messageId || !conversationKey || !currentUserId) return false;

    const previousMessages = snapshotMessages();
    setBusyAction("delete");

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

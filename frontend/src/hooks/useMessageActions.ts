import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { DELETED_MESSAGE_TEXT } from "../Utils/messageDisplay";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";

const useMessageActions = (message: Message) => {
  const [busyAction, setBusyAction] = useState<"edit" | "delete" | null>(null);
  const { authUser } = useAuthContext();
  const { setMessagesForConversation, updateMessageInConversation, removeMessageFromConversation, syncConversationPreview, bumpDetailsRefreshVersion } =
    useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationKey = getConversationKey(message.senderId, message.receiverId);
  const messageId = message._id;

  const snapshotMessages = (): Message[] => {
    if (!conversationKey) return [];
    return useConversation.getState().messagesByConversation[conversationKey] || [];
  };

  const restoreMessages = (previousMessages: Message[]): void => {
    if (!conversationKey || !currentUserId) return;
    setMessagesForConversation(conversationKey, previousMessages);
    syncConversationPreview(conversationKey, currentUserId);
  };

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
      const data = await apiFetch<ApiErrorResponse & { updatedMessage?: Message }>(
        `/messages/${messageId}`,
        {
        method: "PUT",
        body: JSON.stringify({ content: trimmedContent }),
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

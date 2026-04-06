import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import notificationSound from "../assets/sound/notification.mp3";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import type { Message } from "../types";

const useListenMessages = () => {
  const { socket } = useSocketContext();
  const { authUser } = useAuthContext();
  const {
    appendMessageToConversation,
    incrementUnread,
    upsertConversationFromMessage,
    updateMessageInConversation,
    removeMessageFromConversation,
    syncConversationPreview,
  } = useConversation();

  useEffect(() => {
    if (!socket) return;

    const currentUserId = authUser?.data?.user?._id;

    const onNewMessage = (newMessage: Message) => {
      const incomingConversationKey = getConversationKey(
        newMessage?.senderId,
        newMessage?.receiverId
      );

      if (!incomingConversationKey || !currentUserId) return;

      appendMessageToConversation(incomingConversationKey, newMessage);
      upsertConversationFromMessage(newMessage, currentUserId);

      const activeConversation = useConversation.getState().selectedConversation;
      const activeConversationKey = getConversationKey(
        activeConversation?._id,
        currentUserId
      );

      if (activeConversationKey !== incomingConversationKey) {
        incrementUnread(incomingConversationKey);

        const sound = new Audio(notificationSound);
        sound.play().catch(() => {
          // Ignore autoplay blocks - message state is already updated.
        });
      }
    };

    const onMessageEdit = (updatedMessage: Message) => {
      if (!currentUserId) return;

      const conversationKey = getConversationKey(updatedMessage?.senderId, updatedMessage?.receiverId);
      if (!conversationKey || !updatedMessage?._id) return;

      updateMessageInConversation(conversationKey, updatedMessage._id, updatedMessage);
      syncConversationPreview(conversationKey, currentUserId);
    };

    const onMessageDelete = (updatedMessage: Message) => {
      if (!currentUserId) return;

      const conversationKey = getConversationKey(updatedMessage?.senderId, updatedMessage?.receiverId);
      if (!conversationKey || !updatedMessage?._id) return;

      if (updatedMessage.deletedForEveryone) {
        updateMessageInConversation(conversationKey, updatedMessage._id, updatedMessage);
        syncConversationPreview(conversationKey, currentUserId);
        return;
      }

      if (updatedMessage.deletedFor?.includes(currentUserId)) {
        removeMessageFromConversation(conversationKey, updatedMessage._id);
        syncConversationPreview(conversationKey, currentUserId);
      }
    };

    socket.on("newMessage", onNewMessage);
    socket.on("message:edit", onMessageEdit);
    socket.on("message:delete", onMessageDelete);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("message:edit", onMessageEdit);
      socket.off("message:delete", onMessageDelete);
    };
  }, [
    socket,
    authUser,
    appendMessageToConversation,
    incrementUnread,
    upsertConversationFromMessage,
    updateMessageInConversation,
    removeMessageFromConversation,
    syncConversationPreview,
  ]);
};

export default useListenMessages;
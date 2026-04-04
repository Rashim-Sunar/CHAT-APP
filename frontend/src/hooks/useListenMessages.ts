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
  const { appendMessageToConversation, incrementUnread, upsertConversationFromMessage } =
    useConversation();

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

    socket.on("newMessage", onNewMessage);

    return () => {
      socket.off("newMessage", onNewMessage);
    };
  }, [socket, authUser, appendMessageToConversation, incrementUnread, upsertConversationFromMessage]);
};

export default useListenMessages;
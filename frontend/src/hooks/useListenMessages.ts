// Subscribes to socket message events and reconciles them into local conversation state.
// Depends on the socket connection, authenticated user context, notification audio,
// and the shared conversation store for append/update/delete operations.
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import notificationSound from "../assets/sound/notification.mp3";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import type { Message } from "../types";

/**
 * Listen for real-time message events and keep local chat state synchronized.
 * Side effects: registers socket listeners, plays notification audio for background
 * messages, updates unread counts, and refreshes derived conversation details.
 *
 * @returns {void}
 */
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
    bumpDetailsRefreshVersion,
    markConversationSeen,
  } = useConversation();

  useEffect(() => {
    if (!socket) return;

    const currentUserId = authUser?.data?.user?._id;

    // Incoming messages are routed by conversation key so socket and HTTP state
    // converge on the same message list.
    const onNewMessage = (newMessage: Message) => {
      const incomingConversationKey = getConversationKey(
        newMessage?.senderId,
        newMessage?.receiverId
      );

      if (!incomingConversationKey || !currentUserId) return;

      appendMessageToConversation(incomingConversationKey, newMessage);
      upsertConversationFromMessage(newMessage, currentUserId);

      const selectedConversation = useConversation.getState().selectedConversation;
      const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
      if (selectedConversationKey === incomingConversationKey) {
        bumpDetailsRefreshVersion();
        if (currentUserId && newMessage.senderId !== currentUserId && socket.connected) {
          socket.emit("conversation:seen", {
            conversationId: String(newMessage.conversationId || incomingConversationKey),
            readerId: String(currentUserId),
          });
        }
      }

      const activeConversation = useConversation.getState().selectedConversation;
      const activeConversationKey = getConversationKey(
        activeConversation?._id,
        currentUserId
      );

      if (activeConversationKey !== incomingConversationKey) {
        incrementUnread(incomingConversationKey);

        const partnerId =
          String(newMessage?.senderId) === String(currentUserId)
            ? String(newMessage?.receiverId)
            : String(newMessage?.senderId);
        const partner = useConversation
          .getState()
          .conversations.find((conversation) => String(conversation._id) === partnerId);
        const preview =
          (newMessage.text || newMessage.message || "").trim() ||
          (newMessage.messageType === "image"
            ? "Sent an image"
            : newMessage.messageType === "video"
              ? "Sent a video"
              : newMessage.messageType === "file"
                ? "Sent a file"
                : "New message");

        toast(
          `${partner?.userName || "New message"}: ${preview}`,
          {
            id: `incoming-${newMessage._id || `${incomingConversationKey}-${newMessage.createdAt}`}`,
            icon: "MSG",
            duration: 2500,
          }
        );

        const sound = new Audio(notificationSound);
        sound.play().catch(() => {
          // Ignore autoplay blocks - message state is already updated.
        });
      }
    };

    // Edits update the in-memory message and refresh any derived preview/details state.
    const onMessageEdit = (updatedMessage: Message) => {
      if (!currentUserId) return;

      const conversationKey = getConversationKey(updatedMessage?.senderId, updatedMessage?.receiverId);
      if (!conversationKey || !updatedMessage?._id) return;

      updateMessageInConversation(conversationKey, updatedMessage._id, updatedMessage);
      syncConversationPreview(conversationKey, currentUserId);

      const selectedConversation = useConversation.getState().selectedConversation;
      const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
      if (selectedConversationKey === conversationKey) {
        bumpDetailsRefreshVersion();
      }
    };

    // Deletes are handled differently depending on whether the message was removed
    // for everyone or only for the current user.
    const onMessageDelete = (updatedMessage: Message) => {
      if (!currentUserId) return;

      const conversationKey = getConversationKey(updatedMessage?.senderId, updatedMessage?.receiverId);
      if (!conversationKey || !updatedMessage?._id) return;

      if (updatedMessage.deletedForEveryone) {
        updateMessageInConversation(conversationKey, updatedMessage._id, updatedMessage);
        syncConversationPreview(conversationKey, currentUserId);
        const selectedConversation = useConversation.getState().selectedConversation;
        const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
        if (selectedConversationKey === conversationKey) {
          bumpDetailsRefreshVersion();
        }
        return;
      }

      if (updatedMessage.deletedFor?.includes(currentUserId)) {
        removeMessageFromConversation(conversationKey, updatedMessage._id);
        syncConversationPreview(conversationKey, currentUserId);
        const selectedConversation = useConversation.getState().selectedConversation;
        const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
        if (selectedConversationKey === conversationKey) {
          bumpDetailsRefreshVersion();
        }
      }
    };

    const onConversationSeen = (payload: { conversationId: string; readerId: string; seenAt: string }) => {
      if (!currentUserId) return;
      markConversationSeen(payload.conversationId, payload.seenAt, currentUserId);
    };

    socket.on("newMessage", onNewMessage);
    socket.on("conversation:seen", onConversationSeen);
    socket.on("message:edit", onMessageEdit);
    socket.on("message:delete", onMessageDelete);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("conversation:seen", onConversationSeen);
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
    bumpDetailsRefreshVersion,
    markConversationSeen,
  ]);
};

export default useListenMessages;
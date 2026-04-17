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
import { decryptMessageIfNeeded } from "../Utils/crypto";
import { saveConversationPreview } from "../Utils/conversationPreviewCache";
import { getMessagePreviewText } from "../Utils/messageDisplay";

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
      void (async () => {
        const hydratedMessage = currentUserId
          ? await decryptMessageIfNeeded(newMessage, currentUserId)
          : newMessage;

      const incomingConversationKey = getConversationKey(
        hydratedMessage?.senderId,
        hydratedMessage?.receiverId
      );

      if (!incomingConversationKey || !currentUserId) return;

      appendMessageToConversation(incomingConversationKey, hydratedMessage);
      upsertConversationFromMessage(hydratedMessage, currentUserId);
      // Keep sidebar preview aligned with the decrypted message on this device.
      // This avoids reverting to encrypted placeholders after a later refresh.
      saveConversationPreview(currentUserId, String(
        String(hydratedMessage.senderId) === String(currentUserId)
          ? hydratedMessage.receiverId
          : hydratedMessage.senderId
      ), {
        lastMessage: getMessagePreviewText(hydratedMessage),
        lastMessageAt: hydratedMessage.createdAt,
        lastMessageSenderId: String(hydratedMessage.senderId),
      });

      const selectedConversation = useConversation.getState().selectedConversation;
      const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
      if (selectedConversationKey === incomingConversationKey) {
        bumpDetailsRefreshVersion();
        if (currentUserId && hydratedMessage.senderId !== currentUserId && socket.connected) {
          socket.emit("conversation:seen", {
            conversationId: String(hydratedMessage.conversationId || incomingConversationKey),
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
          String(hydratedMessage?.senderId) === String(currentUserId)
            ? String(hydratedMessage?.receiverId)
            : String(hydratedMessage?.senderId);
        const partner = useConversation
          .getState()
          .conversations.find((conversation) => String(conversation._id) === partnerId);
        const preview =
          (hydratedMessage.text || hydratedMessage.message || "").trim() ||
          (hydratedMessage.messageType === "image"
            ? "Sent an image"
            : hydratedMessage.messageType === "video"
              ? "Sent a video"
              : hydratedMessage.messageType === "file"
                ? "Sent a file"
                : "New message");

        toast(
          `${partner?.userName || "New message"}: ${preview}`,
          {
            id: `incoming-${hydratedMessage._id || `${incomingConversationKey}-${hydratedMessage.createdAt}`}`,
            icon: "MSG",
            duration: 2500,
          }
        );

        const sound = new Audio(notificationSound);
        sound.play().catch(() => {
          // Ignore autoplay blocks - message state is already updated.
        });
      }
      })();
    };

    // Edits update the in-memory message and refresh any derived preview/details state.
    const onMessageEdit = (updatedMessage: Message) => {
      if (!currentUserId) return;

      void (async () => {
        const hydratedMessage = await decryptMessageIfNeeded(updatedMessage, currentUserId);

        const conversationKey = getConversationKey(
          hydratedMessage?.senderId,
          hydratedMessage?.receiverId
        );
        if (!conversationKey || !hydratedMessage?._id) return;

        updateMessageInConversation(conversationKey, hydratedMessage._id, hydratedMessage);
        syncConversationPreview(conversationKey, currentUserId);
        // Edits must refresh local preview cache too, otherwise the sidebar can
        // show stale text from an older message version on reload.
        saveConversationPreview(currentUserId, String(
          String(hydratedMessage.senderId) === String(currentUserId)
            ? hydratedMessage.receiverId
            : hydratedMessage.senderId
        ), {
          lastMessage: getMessagePreviewText(hydratedMessage),
          lastMessageAt: hydratedMessage.createdAt,
          lastMessageSenderId: String(hydratedMessage.senderId),
        });

        const selectedConversation = useConversation.getState().selectedConversation;
        const selectedConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
        if (selectedConversationKey === conversationKey) {
          bumpDetailsRefreshVersion();
        }
      })();
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
      markConversationSeen(payload.conversationId, payload.readerId, payload.seenAt, currentUserId);
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
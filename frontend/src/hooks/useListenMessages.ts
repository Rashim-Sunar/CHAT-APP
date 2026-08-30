// Subscribes to socket message events and reconciles them into local conversation state.
// Depends on the socket connection, authenticated user context, notification audio,
// and the shared conversation store for append/update/delete operations.
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import useGetConversations from "./useGetConversations";
import notificationSound from "../assets/sound/notification.mp3";
import { useAuthContext } from "../context/Auth-Context";
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
  const { refetch: refetchConversations } = useGetConversations();
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

    // Incoming messages are routed by conversationId so socket and HTTP state
    // converge on the same message list — works identically for direct and
    // group conversations.
    const onNewMessage = (newMessage: Message) => {
      void (async () => {
        const hydratedMessage = currentUserId
          ? await decryptMessageIfNeeded(newMessage, currentUserId)
          : newMessage;

      const incomingConversationId = hydratedMessage?.conversationId;

      if (!incomingConversationId || !currentUserId) return;

      appendMessageToConversation(incomingConversationId, hydratedMessage);
      upsertConversationFromMessage(hydratedMessage, currentUserId);
      // Keep sidebar preview aligned with the decrypted message on this device.
      // This avoids reverting to encrypted placeholders after a later refresh.
      saveConversationPreview(currentUserId, incomingConversationId, {
        lastMessage: getMessagePreviewText(hydratedMessage),
        lastMessageAt: hydratedMessage.createdAt,
        lastMessageSenderId: String(hydratedMessage.senderId),
      });

      const selectedConversation = useConversation.getState().selectedConversation;
      const isActiveConversation = selectedConversation?._id === incomingConversationId;

      if (isActiveConversation) {
        bumpDetailsRefreshVersion();
        if (currentUserId && hydratedMessage.senderId !== currentUserId && socket.connected) {
          socket.emit("conversation:seen", {
            conversationId: incomingConversationId,
            readerId: String(currentUserId),
          });
        }
      } else {
        incrementUnread(incomingConversationId);

        const conversation = useConversation
          .getState()
          .conversations.find((candidate) => candidate._id === incomingConversationId);
        // For a group, attribute the toast to whoever actually sent it (not
        // the group name); for a direct chat, the conversation's own display
        // name already is the sender.
        const senderName =
          conversation?.type === "group"
            ? conversation.participants.find((participant) => participant._id === String(hydratedMessage.senderId))
                ?.userName || conversation.displayName
            : conversation?.displayName;
        const preview =
          (hydratedMessage.text || hydratedMessage.message || "").trim() ||
          (hydratedMessage.messageType === "image"
            ? "Sent an image"
            : hydratedMessage.messageType === "video"
              ? "Sent a video"
              : hydratedMessage.messageType === "audio"
                ? "Sent a voice message"
              : hydratedMessage.messageType === "file"
                ? "Sent a file"
                : hydratedMessage.messageType === "call_log"
                  ? getMessagePreviewText(hydratedMessage)
                  : "New message");

        toast(
          `${senderName || "New message"}: ${preview}`,
          {
            id: `incoming-${hydratedMessage._id || `${incomingConversationId}-${hydratedMessage.createdAt}`}`,
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

        const conversationId = hydratedMessage?.conversationId;
        if (!conversationId || !hydratedMessage?._id) return;

        updateMessageInConversation(conversationId, hydratedMessage._id, hydratedMessage);
        syncConversationPreview(conversationId, currentUserId);
        // Edits must refresh local preview cache too, otherwise the sidebar can
        // show stale text from an older message version on reload.
        saveConversationPreview(currentUserId, conversationId, {
          lastMessage: getMessagePreviewText(hydratedMessage),
          lastMessageAt: hydratedMessage.createdAt,
          lastMessageSenderId: String(hydratedMessage.senderId),
        });

        const selectedConversation = useConversation.getState().selectedConversation;
        if (selectedConversation?._id === conversationId) {
          bumpDetailsRefreshVersion();
        }
      })();
    };

    // Deletes are handled differently depending on whether the message was removed
    // for everyone or only for the current user.
    const onMessageDelete = (updatedMessage: Message) => {
      if (!currentUserId) return;

      const conversationId = updatedMessage?.conversationId;
      if (!conversationId || !updatedMessage?._id) return;

      if (updatedMessage.deletedForEveryone) {
        updateMessageInConversation(conversationId, updatedMessage._id, updatedMessage);
        syncConversationPreview(conversationId, currentUserId);
        const selectedConversation = useConversation.getState().selectedConversation;
        if (selectedConversation?._id === conversationId) {
          bumpDetailsRefreshVersion();
        }
        return;
      }

      if (updatedMessage.deletedFor?.includes(currentUserId)) {
        removeMessageFromConversation(conversationId, updatedMessage._id);
        syncConversationPreview(conversationId, currentUserId);
        const selectedConversation = useConversation.getState().selectedConversation;
        if (selectedConversation?._id === conversationId) {
          bumpDetailsRefreshVersion();
        }
      }
    };

    // Reaction payloads carry the full message shape (including blank `text`
    // for E2EE messages), so — like edits — this must decrypt-if-needed
    // before merging, otherwise it would blank out already-decrypted text.
    const onMessageReaction = (updatedMessage: Message) => {
      if (!currentUserId) return;

      void (async () => {
        const hydratedMessage = await decryptMessageIfNeeded(updatedMessage, currentUserId);

        const conversationId = hydratedMessage?.conversationId;
        if (!conversationId || !hydratedMessage?._id) return;

        updateMessageInConversation(conversationId, hydratedMessage._id, hydratedMessage);
      })();
    };

    // Pin/unpin carries the full message shape like reactions/edits, plus
    // bumps detailsRefreshVersion so usePinnedMessages (and the pinned
    // banner) refetch when it's the open conversation.
    const onMessagePin = (updatedMessage: Message) => {
      if (!currentUserId) return;

      void (async () => {
        const hydratedMessage = await decryptMessageIfNeeded(updatedMessage, currentUserId);

        const conversationId = hydratedMessage?.conversationId;
        if (!conversationId || !hydratedMessage?._id) return;

        updateMessageInConversation(conversationId, hydratedMessage._id, hydratedMessage);

        const selectedConversation = useConversation.getState().selectedConversation;
        if (selectedConversation?._id === conversationId) {
          bumpDetailsRefreshVersion();
        }
      })();
    };

    const onConversationSeen = (payload: { conversationId: string; readerId: string; seenAt: string }) => {
      if (!currentUserId) return;
      markConversationSeen(payload.conversationId, payload.readerId, payload.seenAt, currentUserId);
    };

    // Group membership/admin/settings changes all need fresh participant
    // objects (userName/gender/profilePic) that these lightweight socket
    // payloads don't carry, so just re-pull the authoritative list. This is
    // infrequent compared to messages, so a full refetch is cheap. It also
    // keeps the open group's details panel in sync via setConversations'
    // selectedConversation refresh, and clears the panel if this device was
    // the one removed/left.
    const onConversationRosterChanged = () => {
      void refetchConversations();
    };

    socket.on("newMessage", onNewMessage);
    socket.on("conversation:seen", onConversationSeen);
    socket.on("message:edit", onMessageEdit);
    socket.on("message:delete", onMessageDelete);
    socket.on("message:reaction", onMessageReaction);
    socket.on("message:pin", onMessagePin);
    socket.on("conversation:updated", onConversationRosterChanged);
    socket.on("conversation:membersAdded", onConversationRosterChanged);
    socket.on("conversation:memberRemoved", onConversationRosterChanged);
    socket.on("conversation:adminPromoted", onConversationRosterChanged);
    socket.on("conversation:muted", onConversationRosterChanged);
    socket.on("conversation:blocked", onConversationRosterChanged);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("conversation:seen", onConversationSeen);
      socket.off("message:edit", onMessageEdit);
      socket.off("message:delete", onMessageDelete);
      socket.off("message:reaction", onMessageReaction);
      socket.off("message:pin", onMessagePin);
      socket.off("conversation:updated", onConversationRosterChanged);
      socket.off("conversation:membersAdded", onConversationRosterChanged);
      socket.off("conversation:memberRemoved", onConversationRosterChanged);
      socket.off("conversation:adminPromoted", onConversationRosterChanged);
      socket.off("conversation:muted", onConversationRosterChanged);
      socket.off("conversation:blocked", onConversationRosterChanged);
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
    refetchConversations,
  ]);
};

export default useListenMessages;

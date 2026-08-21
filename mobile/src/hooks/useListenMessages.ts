import { useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";
import { decryptMessageIfNeeded } from "../crypto/crypto";
import useConversationStore from "../store/useConversationStore";
import type { Message } from "../types";

const useListenMessages = (onNewMessage?: () => void) => {
  const { socket } = useSocketContext();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const appendMessageToConversation = useConversationStore((state) => state.appendMessageToConversation);
  const updateMessageInConversation = useConversationStore((state) => state.updateMessageInConversation);
  const removeMessageFromConversation = useConversationStore((state) => state.removeMessageFromConversation);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleNewMessage = (incoming: Message) => {
      void (async () => {
        const hydrated = await decryptMessageIfNeeded(incoming, currentUserId);
        if (!hydrated.conversationId) return;

        appendMessageToConversation(hydrated.conversationId, hydrated);
        onNewMessage?.();
      })();
    };

    // Mutation payloads carry the full canonical message, and for text that
    // means the readable content only exists inside the encrypted envelope —
    // so it has to be decrypted before replacing local state.
    const handleMessageMutation = (incoming: Message) => {
      void (async () => {
        const conversationId = incoming.conversationId;
        const messageId = incoming._id;
        if (!conversationId || !messageId) return;

        if (incoming.deletedFor?.includes(currentUserId) && !incoming.deletedForEveryone) {
          removeMessageFromConversation(conversationId, messageId);
          onNewMessage?.();
          return;
        }

        const hydrated = await decryptMessageIfNeeded(incoming, currentUserId);
        updateMessageInConversation(conversationId, messageId, hydrated);
        onNewMessage?.();
      })();
    };

    // Membership and metadata changes only affect the conversation summary,
    // so they reuse the same refresh callback as new messages.
    const handleConversationChanged = () => {
      onNewMessage?.();
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("message:edit", handleMessageMutation);
    socket.on("message:delete", handleMessageMutation);
    socket.on("message:reaction", handleMessageMutation);
    socket.on("message:pin", handleMessageMutation);
    socket.on("conversation:membersAdded", handleConversationChanged);
    socket.on("conversation:memberRemoved", handleConversationChanged);
    socket.on("conversation:updated", handleConversationChanged);
    socket.on("conversation:muted", handleConversationChanged);
    socket.on("conversation:blocked", handleConversationChanged);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("message:edit", handleMessageMutation);
      socket.off("message:delete", handleMessageMutation);
      socket.off("message:reaction", handleMessageMutation);
      socket.off("message:pin", handleMessageMutation);
      socket.off("conversation:membersAdded", handleConversationChanged);
      socket.off("conversation:memberRemoved", handleConversationChanged);
      socket.off("conversation:updated", handleConversationChanged);
      socket.off("conversation:muted", handleConversationChanged);
      socket.off("conversation:blocked", handleConversationChanged);
    };
  }, [
    socket,
    currentUserId,
    appendMessageToConversation,
    updateMessageInConversation,
    removeMessageFromConversation,
    onNewMessage,
  ]);
};

export default useListenMessages;

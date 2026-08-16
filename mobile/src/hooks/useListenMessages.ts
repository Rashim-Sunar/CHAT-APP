// Trimmed port of frontend/src/hooks/useListenMessages.ts — phase 1 only
// needs newMessage (decrypt + append) and conversation:seen (ignored for
// now, no read-receipt UI yet). Group/call/pin/mute/block events don't
// exist in this phase's scope.
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
  const { appendMessageToConversation } = useConversationStore();

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

    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, currentUserId, appendMessageToConversation, onNewMessage]);
};

export default useListenMessages;

import { useEffect, useRef } from "react";
import Message from "./Message";
import useGetMessages from "../../hooks/useGetMessages";
import MessageSkeleton from "../skeleton/MessageSkeleton";
import useListenMessages from "../../hooks/useListenMessages";
import type { Message as ChatMessage } from "../../types";
import { useAuthContext } from "../../context/Auth-Context";
import { shouldHideMessageForUser } from "../../Utils/messageDisplay";

const Messages = () => {
  const { loading, messages } = useGetMessages();
  useListenMessages();
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const visibleMessages = messages.filter((message) => !shouldHideMessageForUser(message, currentUserId));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [messages]);

  return (
    <div className="px-4 flex-1 overflow-auto">
      {!loading &&
        visibleMessages.length > 0 &&
        visibleMessages.map((message: ChatMessage, index: number) => (
          <div key={message._id || `${message.createdAt}-${index}`} ref={lastMessageRef}>
            <Message message={message} />
          </div>
        ))}

      {loading && [...Array(3)].map((_, idx) => <MessageSkeleton key={idx} />)}
      {!loading && visibleMessages.length === 0 && (
        <p className="text-center">Send a message to start the conversation.</p>
      )}
    </div>
  );
};

export default Messages;
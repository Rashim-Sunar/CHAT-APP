import { useEffect, useRef } from "react";
import Message from "./Message";
import CallLogMessage from "./CallLogMessage";
import useGetMessages from "../../hooks/useGetMessages";
import useConversation from "../../zustand/useConversation";
import MessageSkeleton from "../skeleton/MessageSkeleton";
import type { Message as ChatMessage } from "../../types";
import { useAuthContext } from "../../context/Auth-Context";
import { shouldHideMessageForUser } from "../../Utils/messageDisplay";
import { formatDateDivider, isSameDay } from "../../Utils/formatDate";

// Consecutive same-sender messages within this window render as one cluster.
const GROUP_TIME_GAP_MS = 5 * 60 * 1000;

const isSameCluster = (a?: ChatMessage, b?: ChatMessage): boolean => {
  if (!a || !b) return false;
  if (String(a.senderId) !== String(b.senderId)) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <= GROUP_TIME_GAP_MS;
};

const DateDivider = ({ label }: { label: string }) => (
  <div className="my-4 flex items-center justify-center" aria-hidden="true">
    <span className="rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
      {label}
    </span>
  </div>
);

const Messages = () => {
  const { loading, messages } = useGetMessages();
  const { selectedConversation } = useConversation();
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const visibleMessages = messages.filter((message) => !shouldHideMessageForUser(message, currentUserId));

  const conversationId = selectedConversation?._id;
  const previousConversationIdRef = useRef<string | undefined>(undefined);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const conversationChanged = conversationId !== previousConversationIdRef.current;
    const messageCountIncreased = visibleMessages.length > previousMessageCountRef.current;
    previousConversationIdRef.current = conversationId;
    previousMessageCountRef.current = visibleMessages.length;

    // An in-place edit/react/pin on an existing message keeps the same
    // message count and shouldn't yank the viewport to the bottom.
    if (!conversationChanged && !messageCountIncreased) return;

    const timer = window.setTimeout(() => {
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [conversationId, visibleMessages.length]);

  return (
    <div>
      {!loading &&
        visibleMessages.length > 0 &&
        visibleMessages.map((message: ChatMessage, index: number) => {
          const previous = visibleMessages[index - 1];
          const showDateDivider = !isSameDay(previous?.createdAt, message.createdAt);
          const isGroupStart = showDateDivider || !isSameCluster(previous, message);
          const isGroupEnd = !isSameCluster(message, visibleMessages[index + 1]);

          return (
            <div key={message._id || `${message.createdAt}-${index}`} ref={lastMessageRef}>
              {showDateDivider && <DateDivider label={formatDateDivider(message.createdAt)} />}
              {message.messageType === "call_log" ? (
                <CallLogMessage message={message} />
              ) : (
                <Message message={message} isGroupStart={isGroupStart} isGroupEnd={isGroupEnd} />
              )}
            </div>
          );
        })}

      {loading && [...Array(8)].map((_, idx) => <MessageSkeleton key={idx} isFromMe={idx % 2 === 0} />)}
      {!loading && visibleMessages.length === 0 && (
        <p className="text-center">Send a message to start the conversation.</p>
      )}
    </div>
  );
};

export default Messages;
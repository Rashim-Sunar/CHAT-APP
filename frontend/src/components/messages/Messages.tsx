import { useEffect, useLayoutEffect, useRef } from "react";
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
    <span className="date-divider rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
      {label}
    </span>
  </div>
);

const getScrollContainer = (from: HTMLElement | null): HTMLElement | null =>
  from?.closest("[data-messages-scroll-container]") ?? null;

const Messages = () => {
  const { loading, loadingMore, messages, hasMore, loadMore } = useGetMessages();
  const { selectedConversation } = useConversation();
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const skipScrollToBottomRef = useRef(false);
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const visibleMessages = messages.filter((message) => !shouldHideMessageForUser(message, currentUserId));

  const conversationId = selectedConversation?._id;
  const previousConversationIdRef = useRef<string | undefined>(undefined);
  const previousMessageCountRef = useRef(0);
  const oldestMessageId = messages.find((message) => message._id)?._id;

  useLayoutEffect(() => {
    const previousScrollHeight = pendingScrollHeightRef.current;
    if (previousScrollHeight == null) return;

    pendingScrollHeightRef.current = null;
    const scrollContainer = getScrollContainer(listRef.current);
    if (!scrollContainer) return;

    scrollContainer.scrollTop += scrollContainer.scrollHeight - previousScrollHeight;
  }, [messages]);

  useEffect(() => {
    const conversationChanged = conversationId !== previousConversationIdRef.current;
    const messageCountIncreased = visibleMessages.length > previousMessageCountRef.current;
    previousConversationIdRef.current = conversationId;
    previousMessageCountRef.current = visibleMessages.length;

    if (skipScrollToBottomRef.current) {
      skipScrollToBottomRef.current = false;
      return;
    }

    // An in-place edit/react/pin on an existing message keeps the same
    // message count and shouldn't yank the viewport to the bottom.
    if (!conversationChanged && !messageCountIncreased) return;

    const timer = window.setTimeout(() => {
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [conversationId, visibleMessages.length]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore || !conversationId) return;

    const sentinel = sentinelRef.current;
    const scrollContainer = getScrollContainer(listRef.current);
    if (!sentinel || !scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;

        const oldestId = oldestMessageId;
        if (!oldestId) return;

        pendingScrollHeightRef.current = scrollContainer.scrollHeight;
        skipScrollToBottomRef.current = true;
        void loadMore(oldestId).then((applied) => {
          if (applied) return;
          pendingScrollHeightRef.current = null;
          skipScrollToBottomRef.current = false;
        });
      },
      { root: scrollContainer, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [conversationId, hasMore, loading, loadingMore, loadMore, oldestMessageId]);

  return (
    <div ref={listRef}>
      <div ref={sentinelRef} aria-hidden="true" />

      {loadingMore && (
        <div className="mb-3 flex items-center justify-center gap-2 py-1 text-xs text-slate-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          Loading older messages…
        </div>
      )}

      {!loading && !loadingMore && visibleMessages.length > 0 && !hasMore && (
        <div className="mb-3 flex items-center justify-center">
          <span className="text-xs font-medium text-slate-400">Beginning of conversation</span>
        </div>
      )}

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

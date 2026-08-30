// Fetches messages for the selected conversation and stores them by
// conversation id (which is also the store key — no derived key needed).
// Depends on the authenticated user, the active conversation, the shared
// message map, and the API for canonical message history.
import { useCallback, useEffect, useRef, useState } from "react";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import type { Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import { showFetchErrorToast } from "../Utils/apiErrorToast";
import { decryptMessagesIfNeeded } from "../Utils/crypto";

const MESSAGE_PAGE_SIZE = 30;

interface ConversationMessagesResponse {
  error?: string;
  status?: string;
  data?: {
    messages?: Message[];
    hasMore?: boolean;
  };
}

const isAbortError = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof Error && error.name === "AbortError");

/**
 * Load the selected conversation history into the per-conversation message store.
 * Side effects: performs a GET request, writes to Zustand, and shows toast errors.
 *
 * @returns {{ loading: boolean; loadingMore: boolean; messages: Message[]; loadMore: (beforeId: string) => Promise<void> }}
 */
const useGetMessages = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { authUser } = useAuthContext();
  const {
    selectedConversation,
    setMessagesForConversation,
    prependMessagesToConversation,
    setHasMore,
    messagesByConversation,
    hasMoreByConversation,
  } = useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationId = selectedConversation?._id;

  const messages = conversationId ? messagesByConversation[conversationId] || [] : [];
  const hasMore = conversationId ? Boolean(hasMoreByConversation[conversationId]) : false;

  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!conversationId) return;

    const abortController = new AbortController();
    abortRef.current = abortController;
    let ignore = false;

    // Guard against stale updates when the user switches chats before the request settles.
    const getMessages = async () => {
      setLoading(true);
      setLoadingMore(false);
      loadingMoreRef.current = false;
      // Until the first page returns, do not treat this thread as exhausted —
      // switching chats reloads only the latest page.
      setHasMore(conversationId, true);
      try {
        const response = await apiFetch<ConversationMessagesResponse>(
          `/conversations/${conversationId}/messages?limit=${MESSAGE_PAGE_SIZE}`,
          {
            method: "GET",
            signal: abortController.signal,
          }
        );
        if (response.error) throw new Error(response.error);

        const fetchedMessages = response?.data?.messages || [];
        if (ignore) return;

        const normalizedMessages = currentUserId
          ? await decryptMessagesIfNeeded(fetchedMessages, currentUserId)
          : fetchedMessages;
        if (ignore) return;

        setMessagesForConversation(conversationId, normalizedMessages);
        setHasMore(conversationId, Boolean(response.data?.hasMore));
      } catch (error: unknown) {
        if (isAbortError(error) || ignore) return;
        showFetchErrorToast(error, "get-messages-error");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    getMessages();

    return () => {
      ignore = true;
      abortController.abort();
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
    };
  }, [conversationId, setMessagesForConversation, setHasMore, currentUserId]);

  const loadMore = useCallback(
    async (beforeId: string): Promise<boolean> => {
      if (!conversationId || !beforeId) return false;
      if (loadingMoreRef.current) return false;
      if (useConversation.getState().hasMoreByConversation[conversationId] === false) return false;

      const requestedFor = conversationId;
      loadingMoreRef.current = true;
      setLoadingMore(true);

      try {
        const response = await apiFetch<ConversationMessagesResponse>(
          `/conversations/${requestedFor}/messages?before=${encodeURIComponent(beforeId)}&limit=${MESSAGE_PAGE_SIZE}`,
          {
            method: "GET",
            signal: abortRef.current?.signal,
          }
        );
        if (response.error) throw new Error(response.error);

        const stillSelected =
          useConversation.getState().selectedConversation?._id === requestedFor;
        if (!stillSelected) return false;

        const fetchedMessages = response?.data?.messages || [];
        const normalizedMessages = currentUserId
          ? await decryptMessagesIfNeeded(fetchedMessages, currentUserId)
          : fetchedMessages;

        if (useConversation.getState().selectedConversation?._id !== requestedFor) return false;

        prependMessagesToConversation(requestedFor, normalizedMessages);
        setHasMore(requestedFor, Boolean(response.data?.hasMore));
        return true;
      } catch (error: unknown) {
        if (isAbortError(error)) return false;
        if (useConversation.getState().selectedConversation?._id !== requestedFor) return false;
        showFetchErrorToast(error, "get-messages-error");
        return false;
      } finally {
        if (useConversation.getState().selectedConversation?._id === requestedFor) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          loadingMoreRef.current = false;
        }
      }
    },
    [conversationId, currentUserId, prependMessagesToConversation, setHasMore]
  );

  return { loading, loadingMore, messages, hasMore, loadMore };
};

export default useGetMessages;

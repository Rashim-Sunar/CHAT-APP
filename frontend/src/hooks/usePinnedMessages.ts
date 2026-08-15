// Fetches the currently-pinned messages for the active conversation — feeds
// the pinned banner and the details panel's Pinned Messages row. Refetches
// on conversation change and whenever useListenMessages reconciles a
// message:pin event for this conversation (via detailsRefreshVersion, the
// same low-frequency invalidation signal shared content/edits already use).
import { useCallback, useEffect, useState } from "react";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, Message } from "../types";
import { apiFetch } from "../Utils/apiFetch";

const usePinnedMessages = () => {
  const { selectedConversation, detailsRefreshVersion } = useConversation();
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const conversationId = selectedConversation?._id;

  const fetchPinned = useCallback(
    async (signal?: AbortSignal) => {
      if (!conversationId) {
        setPinnedMessages([]);
        return;
      }

      setLoading(true);

      try {
        const data = await apiFetch<ApiErrorResponse & { data?: { messages: Message[] } }>(
          `/conversations/${conversationId}/pinned-messages`,
          { method: "GET", signal }
        );

        setPinnedMessages(data.data?.messages || []);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        // Non-critical UI surface — fail quietly rather than blocking the thread.
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [conversationId]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchPinned(abortController.signal);
    return () => abortController.abort();
  }, [fetchPinned, detailsRefreshVersion]);

  const refetch = useCallback(() => {
    void fetchPinned();
  }, [fetchPinned]);

  return { pinnedMessages, loading, refetch };
};

export default usePinnedMessages;

// Fetches the selected conversation's shared media/links/documents and
// refreshes it whenever the details version changes. Conversation-scoped
// (works for direct and group alike) — replaces the old useUserDetails.ts,
// which only worked for direct conversations via a legacy user-pair query.
import { useCallback, useEffect, useState } from "react";
import useConversation from "../zustand/useConversation";
import type { ApiErrorResponse, SharedContentResponse } from "../types";
import { apiFetch } from "../Utils/apiFetch";

const useSharedContent = () => {
  const { selectedConversation, detailsRefreshVersion } = useConversation();
  const [details, setDetails] = useState<SharedContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationId = selectedConversation?._id;

  const fetchDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!conversationId) {
        // Reset derived state when the chat is closed so stale details do not linger.
        setDetails(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<SharedContentResponse | ApiErrorResponse>(
          `/conversations/${conversationId}/shared-content`,
          {
            method: "GET",
            signal,
          }
        );

        setDetails(data as SharedContentResponse);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch shared content";
        setError(message);
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

    fetchDetails(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchDetails, detailsRefreshVersion]);

  const refetch = useCallback(() => {
    void fetchDetails();
  }, [fetchDetails]);

  return {
    details,
    loading,
    error,
    refetch,
  };
};

export default useSharedContent;

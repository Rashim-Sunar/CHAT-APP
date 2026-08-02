// Fetches the selected conversation's profile/details panel data and refreshes it
// whenever the details version changes. Depends on the active conversation and
// the API endpoint that returns the user summary for that thread.
import { useCallback, useEffect, useState } from "react";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import { getOtherParticipant } from "../Utils/conversationDisplay";
import type { ApiErrorResponse, UserDetails } from "../types";
import { apiFetch } from "../Utils/apiFetch";

/**
 * Load the details payload for the active conversation partner.
 * Side effects: performs a GET request, aborts in-flight requests on unmount or
 * conversation change, and stores loading/error state for the UI.
 *
 * @returns {{ details: UserDetails | null; loading: boolean; error: string | null; refetch: () => void }} Details data and a manual refetch trigger.
 */
const useUserDetails = () => {
  const { selectedConversation, detailsRefreshVersion } = useConversation();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group details (media/links/documents scoped to a conversation rather than
  // a user pair) are not yet wired up — only direct conversations fetch here.
  const otherParticipantId =
    selectedConversation?.type === "direct"
      ? getOtherParticipant(selectedConversation, currentUserId)?._id
      : undefined;

  const fetchDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!otherParticipantId) {
        // Reset derived state when the chat is closed so stale details do not linger.
        setDetails(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<UserDetails | ApiErrorResponse>(
          `/users/${otherParticipantId}/details`,
          {
            method: "GET",
            signal,
          }
        );

        const parsed = data as UserDetails;
        setDetails(parsed);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch user details";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [otherParticipantId]
  );

  useEffect(() => {
    const abortController = new AbortController();

    // Refresh whenever the selected conversation or details version changes.
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

export default useUserDetails;

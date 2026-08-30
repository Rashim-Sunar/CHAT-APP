// Fetches the conversation list (direct + group) for the sidebar and caches
// it in Zustand. Depends on the authenticated API session, the shared
// conversation store, and toast notifications for request failures.
import { useCallback, useEffect, useState } from "react";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import type { Conversation } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import { showFetchErrorToast } from "../Utils/apiErrorToast";
import { mergeConversationPreviewsFromCache } from "../Utils/conversationPreviewCache";

interface ConversationsResponse {
  error?: string;
  status?: string;
  data?: {
    conversations?: Conversation[];
  };
}

interface UseGetConversationsOptions {
  // Only the sidebar list should load on mount. Other callers (message
  // input, details panel, socket listener) only need refetch — auto-fetching
  // in each of those remounts a GET /conversations storm when opening a chat.
  autoFetch?: boolean;
}

// Shared across every hook instance so two consumers in the same tick
// (desktop sidebar + hidden mobile list) don't fire duplicate requests.
let inFlightFetch: Promise<void> | null = null;

/**
 * Load the sidebar conversation list once and expose a local loading flag.
 * Side effects: performs a GET request, updates the shared conversation store,
 * and surfaces failures through toast notifications.
 *
 * @returns {{ loading: boolean; conversations: Conversation[]; refetch: () => Promise<void> }}
 */
const useGetConversations = ({ autoFetch = false }: UseGetConversationsOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const { authUser } = useAuthContext();
  const conversations = useConversation((state) => state.conversations);
  const currentUserId = authUser?.data?.user?._id;

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    if (inFlightFetch) return inFlightFetch;

    inFlightFetch = (async () => {
      setLoading(true);
      try {
        const response = await apiFetch<ConversationsResponse>("/conversations", {
          method: "GET",
        });
        if (response.error) {
          throw new Error(response.error);
        }

        const conversationsArray = response?.data?.conversations || [];
        // E2EE keeps the backend blind, so encrypted text often arrives as a
        // generic sidebar preview. Merge local cache to restore sender-side text.
        const hydratedConversations = mergeConversationPreviewsFromCache(
          conversationsArray,
          currentUserId
        );
        const { setConversations, hydrateUnreadFromConversations } = useConversation.getState();
        setConversations(hydratedConversations);
        hydrateUnreadFromConversations(hydratedConversations, currentUserId);
      } catch (error: unknown) {
        showFetchErrorToast(error, "get-conversations-error");
      } finally {
        setLoading(false);
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  }, [currentUserId]);

  useEffect(() => {
    if (!autoFetch) return;
    void fetchConversations();
  }, [autoFetch, fetchConversations]);

  return { loading, conversations, refetch: fetchConversations };
};

export default useGetConversations;

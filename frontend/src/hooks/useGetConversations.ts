// Fetches the conversation list (direct + group) for the sidebar and caches
// it in Zustand. Depends on the authenticated API session, the shared
// conversation store, and toast notifications for request failures.
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import type { Conversation } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";
import { mergeConversationPreviewsFromCache } from "../Utils/conversationPreviewCache";

interface ConversationsResponse {
  error?: string;
  status?: string;
  data?: {
    conversations?: Conversation[];
  };
}

/**
 * Load the sidebar conversation list once and expose a local loading flag.
 * Side effects: performs a GET request, updates the shared conversation store,
 * and surfaces failures through toast notifications.
 *
 * @returns {{ loading: boolean; conversations: Conversation[] }} Current fetch state and cached conversations.
 */
const useGetConversations = () => {
  const [loading, setLoading] = useState(false);
  const { authUser } = useAuthContext();
  const { conversations, setConversations, hydrateUnreadFromConversations } = useConversation();
  const currentUserId = authUser?.data?.user?._id;

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;

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
      setConversations(hydratedConversations);
      hydrateUnreadFromConversations(hydratedConversations, currentUserId);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (!message.includes("API Error: 401")) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId, setConversations, hydrateUnreadFromConversations]);

  useEffect(() => {
    // Re-fetch on authenticated user changes so offline messages appear after login.
    void fetchConversations();
  }, [fetchConversations]);

  return { loading, conversations, refetch: fetchConversations };
};

export default useGetConversations;

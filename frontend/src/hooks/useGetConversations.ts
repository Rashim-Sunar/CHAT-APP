// Fetches the conversation list for the sidebar and caches it in Zustand.
// Depends on the authenticated API session, the shared conversation store,
// and toast notifications for request failures.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import type { Conversation } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";
import { mergeConversationPreviewsFromCache } from "../Utils/conversationPreviewCache";

interface UsersResponse {
  error?: string;
  status?: string;
  users?: number;
  data?: {
    users?: Conversation[];
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

  useEffect(() => {
    if (!currentUserId) return;

    // Re-fetch on authenticated user changes so offline messages appear after login.
    const getConversations = async () => {
      setLoading(true);
      try {
        const usersData = await apiFetch<UsersResponse>("/users", {
          method: "GET",
        });
        if (usersData.error) {
          throw new Error(usersData.error);
        }

        const userDataArray = usersData?.data?.users || [];
        // E2EE keeps the backend blind, so encrypted text often arrives as a
        // generic sidebar preview. Merge local cache to restore sender-side text.
        const hydratedConversations = mergeConversationPreviewsFromCache(
          userDataArray,
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
    };

    getConversations();
  }, [currentUserId, setConversations, hydrateUnreadFromConversations]);

  return { loading, conversations };
};

export default useGetConversations;
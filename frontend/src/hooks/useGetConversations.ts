// Fetches the conversation list for the sidebar and caches it in Zustand.
// Depends on the authenticated API session, the shared conversation store,
// and toast notifications for request failures.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import type { Conversation } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";

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
  const { conversations, setConversations } = useConversation();

  useEffect(() => {
    if (conversations.length > 0) return;

    // Avoid re-fetching once the store already has conversation data.
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
        setConversations(userDataArray);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    getConversations();
  }, [conversations.length, setConversations]);

  return { loading, conversations };
};

export default useGetConversations;
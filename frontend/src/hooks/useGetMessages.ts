// Fetches messages for the selected conversation and stores them by
// conversation id (which is also the store key — no derived key needed).
// Depends on the authenticated user, the active conversation, the shared
// message map, and the API for canonical message history.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import type { Message } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";
import { decryptMessagesIfNeeded } from "../Utils/crypto";

interface ConversationMessagesResponse {
  error?: string;
  status?: string;
  data?: {
    messages?: Message[];
    hasMore?: boolean;
  };
}

/**
 * Load the selected conversation history into the per-conversation message store.
 * Side effects: performs a GET request, writes to Zustand, and shows toast errors.
 *
 * @returns {{ loading: boolean; messages: Message[] }} Current fetch state and cached messages.
 */
const useGetMessages = () => {
  const [loading, setLoading] = useState(false);
  const { authUser } = useAuthContext();
  const { selectedConversation, setMessagesForConversation, messagesByConversation } =
    useConversation();

  const currentUserId = authUser?.data?.user?._id;
  const conversationId = selectedConversation?._id;

  const messages = conversationId ? messagesByConversation[conversationId] || [] : [];

  useEffect(() => {
    if (!conversationId) return;

    let ignore = false;

    // Guard against stale updates when the user switches chats before the request settles.
    const getMessages = async () => {
      setLoading(true);
      try {
        const response = await apiFetch<ConversationMessagesResponse>(
          `/conversations/${conversationId}/messages`,
          {
            method: "GET",
          }
        );
        if (response.error) throw new Error(response.error);

        const fetchedMessages = response?.data?.messages || [];
        if (!ignore) {
          const normalizedMessages = currentUserId
            ? await decryptMessagesIfNeeded(fetchedMessages, currentUserId)
            : fetchedMessages;
          setMessagesForConversation(conversationId, normalizedMessages);
        }
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (!message.includes("API Error: 401")) {
          toast.error(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    getMessages();

    return () => {
      ignore = true;
    };
  }, [conversationId, setMessagesForConversation, currentUserId]);

  return { loading, messages };
};

export default useGetMessages;

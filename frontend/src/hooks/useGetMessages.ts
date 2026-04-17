// Fetches messages for the selected conversation and stores them by conversation key.
// Depends on the authenticated user, the active conversation, the shared message map,
// and the API for canonical message history.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import type { Message, ApiErrorResponse } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";
import { decryptMessagesIfNeeded } from "../Utils/crypto";

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
  const conversationKey = getConversationKey(selectedConversation?._id, currentUserId);

  const messages = conversationKey ? messagesByConversation[conversationKey] || [] : [];

  useEffect(() => {
    if (!selectedConversation?._id || !conversationKey) return;

    let ignore = false;

    // Guard against stale updates when the user switches chats before the request settles.
    const getMessages = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Message[] | (ApiErrorResponse & { error?: string })>(
          `/messages/${selectedConversation._id}`,
          {
            method: "GET",
          }
        );
        if (Array.isArray(data)) {
          if (!ignore) {
            const normalizedMessages = currentUserId
              ? await decryptMessagesIfNeeded(data, currentUserId)
              : data;
            setMessagesForConversation(conversationKey, normalizedMessages);
          }
          return;
        }

        if (data.error) throw new Error(data.error);
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
  }, [selectedConversation?._id, conversationKey, setMessagesForConversation, currentUserId]);

  return { loading, messages };
};

export default useGetMessages;
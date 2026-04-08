import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import type { Message, ApiErrorResponse } from "../types";
import { getErrorMessage } from "../Utils/getErrorMessage";
import { apiFetch } from "../Utils/apiFetch";

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
            setMessagesForConversation(conversationKey, data);
          }
          return;
        }

        if (data.error) throw new Error(data.error);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
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
  }, [selectedConversation?._id, conversationKey, setMessagesForConversation]);

  return { loading, messages };
};

export default useGetMessages;
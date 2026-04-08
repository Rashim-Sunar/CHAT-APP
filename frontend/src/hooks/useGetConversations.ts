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

const useGetConversations = () => {
  const [loading, setLoading] = useState(false);
  const { conversations, setConversations } = useConversation();

  useEffect(() => {
    if (conversations.length > 0) return;

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
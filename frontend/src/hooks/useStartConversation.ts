// Shared "open this conversation" flow for entry points that create a
// conversation (new direct chat, new group, joining via invite) and then
// need to select it once it exists in the synced conversation list.
import useConversation from "../zustand/useConversation";
import useGetConversations from "./useGetConversations";
import { useAuthContext } from "../context/Auth-Context";
import { apiFetch } from "../Utils/apiFetch";
import type { ApiErrorResponse } from "../types";

const useStartConversation = () => {
  const { setSelectedConversation } = useConversation();
  const { refetch } = useGetConversations();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const selectConversationById = async (conversationId: string): Promise<void> => {
    await refetch();
    const conversation = useConversation
      .getState()
      .conversations.find((candidate) => candidate._id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation, currentUserId);
    }
  };

  const startDirectChat = async (userId: string): Promise<void> => {
    const data = await apiFetch<ApiErrorResponse & { data?: { conversationId?: string } }>(
      "/conversations/direct",
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      }
    );
    if (data.error) throw new Error(data.error);

    const conversationId = data?.data?.conversationId;
    if (conversationId) {
      await selectConversationById(conversationId);
    }
  };

  return { startDirectChat, selectConversationById };
};

export default useStartConversation;

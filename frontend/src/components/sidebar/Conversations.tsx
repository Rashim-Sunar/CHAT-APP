import { useMemo } from "react";
import useGetConversations from "../../hooks/useGetConversations";
import useConversation from "../../zustand/useConversation";
import Conversation from "./Conversation";
import type { ConversationFilterKey } from "./ConversationFilterTabs";

interface ConversationsProps {
  filter: ConversationFilterKey;
}

const EMPTY_STATE_TEXT: Record<ConversationFilterKey, string> = {
  all: "No chats yet",
  people: "No people chats yet",
  unread: "No unread chats",
  groups: "No groups yet",
};

const Conversations = ({ filter }: ConversationsProps) => {
  const { loading, conversations } = useGetConversations();
  const unreadByConversation = useConversation((state) => state.unreadByConversation);

  const filteredConversations = useMemo(() => {
    switch (filter) {
      case "people":
        return conversations.filter((conversation) => conversation.type === "direct");
      case "groups":
        return conversations.filter((conversation) => conversation.type === "group");
      case "unread":
        return conversations.filter((conversation) => (unreadByConversation[conversation._id] || 0) > 0);
      default:
        return conversations;
    }
  }, [conversations, filter, unreadByConversation]);

  return (
    <div className="divide-y divide-slate-100">
      {filteredConversations.map((conversation) => (
        <Conversation key={conversation._id} conversation={conversation} />
      ))}

      {loading && (
        <div className="flex justify-center py-4 text-sm text-slate-400">Loading...</div>
      )}

      {!loading && filteredConversations.length === 0 && (
        <div className="flex justify-center py-8 text-sm text-slate-400">{EMPTY_STATE_TEXT[filter]}</div>
      )}
    </div>
  );
};

export default Conversations;

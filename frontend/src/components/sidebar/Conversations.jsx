import useGetConversations from "../../hooks/useGetConversations";
import Conversation from "./Conversation";

const Conversations = () => {
  const { loading, conversations } = useGetConversations();

  return (
    <div className="divide-y divide-slate-100">
      {conversations.map((conversation) => (
        <Conversation
          key={conversation._id}
          conversation={conversation}
        />
      ))}

      {loading && (
        <div className="flex justify-center py-4 text-sm text-slate-400">
          Loading...
        </div>
      )}
    </div>
  );
};

export default Conversations;

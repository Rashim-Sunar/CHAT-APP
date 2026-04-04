import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversation";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { useAuthContext } from "../../context/Auth-Context";
import { getConversationKey } from "../../Utils/conversationKey";
import type { Conversation } from "../../types";

interface ConversationProps {
  conversation: Conversation;
}

const ConversationItem = ({ conversation }: ConversationProps) => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const unreadByConversation = useConversation((state) => state.unreadByConversation);
  const { authUser } = useAuthContext();

  const { onlineUsers } = useSocketContext();
  const currentUserId = authUser?.data?.user?._id;

  const isSelected = selectedConversation?._id === conversation._id;
  const isOnline = onlineUsers.includes(conversation._id);
  const conversationKey = getConversationKey(conversation._id, currentUserId);
  const unreadCount = conversationKey ? unreadByConversation[conversationKey] || 0 : 0;

  return (
    <div
      onClick={() => setSelectedConversation(conversation, currentUserId)}
      className={`flex items-center gap-3 px-6 py-3 cursor-pointer
                  transition-all duration-200
                  ${isSelected ? "bg-indigo-50" : "hover:bg-slate-100"}`}
    >
      <div className="relative">
        <img
          src={getAvatarByGender(conversation.gender)}
          alt="avatar"
          className="w-11 h-11 rounded-full object-cover"
        />

        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 
                           bg-green-500 border-2 border-white 
                           rounded-full"></span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{conversation.userName}</p>
        <p className="text-xs text-slate-500 truncate">
          {conversation.lastMessage || "Start a conversation"}
        </p>
      </div>

      {unreadCount > 0 && !isSelected && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </div>
  );
};

export default ConversationItem;
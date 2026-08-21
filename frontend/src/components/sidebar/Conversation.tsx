import { BiBellOff } from "react-icons/bi";
import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversation";
import { useAuthContext } from "../../context/Auth-Context";
import { DELETED_MESSAGE_TEXT } from "../../Utils/messageDisplay";
import { getOtherParticipant } from "../../Utils/conversationDisplay";
import { formatConversationTimestamp } from "../../Utils/formatDate";
import Avatar from "../common/Avatar";
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
  const otherParticipant = getOtherParticipant(conversation, currentUserId);
  const isOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));
  const unreadCount = unreadByConversation[conversation._id] || 0;
  const isCurrentUserLastSender = Boolean(
    currentUserId &&
      conversation.lastMessageSenderId &&
      String(conversation.lastMessageSenderId) === String(currentUserId)
  );

  const sidebarPreviewText = (() => {
    const preview = (conversation.lastMessage || "").trim();

    if (!preview) return "Start a conversation";
    if (preview === DELETED_MESSAGE_TEXT) {
      return isCurrentUserLastSender
        ? "You deleted a message"
        : `${conversation.displayName} deleted a message`;
    }

    if (!isCurrentUserLastSender) return preview;
    if (preview.startsWith("You:")) return preview;

    return `You: ${preview}`;
  })();

  return (
    <div
      onClick={() => {
        if (isSelected) {
          setSelectedConversation(null, currentUserId);
          return;
        }

        setSelectedConversation(conversation, currentUserId);
      }}
      className={`flex items-center gap-3 px-6 py-3 cursor-pointer
                  transition-all duration-200
                  ${isSelected ? "bg-indigo-50" : "hover:bg-slate-100"}`}
    >
      <div className="relative">
        <Avatar
          src={conversation.displayAvatar}
          gender={otherParticipant?.gender}
          name={conversation.displayName}
          alt="avatar"
          className="w-11 h-11 rounded-full object-cover"
          kind={conversation.type === "group" ? "group" : "user"}
        />

        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3
                           bg-green-500 border-2 border-white
                           rounded-full"></span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`flex items-center gap-1.5 truncate ${unreadCount > 0 && !isSelected ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
          <span className="truncate">{conversation.displayName}</span>
          {conversation.isMuted && <BiBellOff size={13} className="shrink-0 text-slate-400" />}
        </p>
        <p className="text-xs text-slate-500 truncate">{sidebarPreviewText}</p>
      </div>

      <div className="flex flex-col items-end gap-1.5 self-start pt-0.5">
        {conversation.lastMessageAt && (
          <span className={`text-[11px] ${unreadCount > 0 && !isSelected ? "font-semibold text-indigo-600" : "text-slate-400"}`}>
            {formatConversationTimestamp(conversation.lastMessageAt)}
          </span>
        )}
        {unreadCount > 0 && !isSelected && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default ConversationItem;

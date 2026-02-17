import { useSocketContext } from "../../context/SocketContext";
import useGetConversation from "../../zustand/useConversation";

const Conversation = ({ conversation }) => {
  const { selectedConversation, setSelectedConversation } =
    useGetConversation();

  const { onlineUsers } = useSocketContext();

  const isSelected = selectedConversation?._id === conversation._id;
  const isOnline = onlineUsers.includes(conversation._id);

  return (
    <div
      onClick={() => setSelectedConversation(conversation)}
      className={`flex items-center gap-3 px-6 py-3 cursor-pointer
                  transition-all duration-200
                  ${
                    isSelected
                      ? "bg-indigo-50"
                      : "hover:bg-slate-100"
                  }`}
    >
      {/* Avatar */}
      <div className="relative">
        <img
          src={conversation.profilePic}
          alt="avatar"
          className="w-11 h-11 rounded-full object-cover"
        />

        {/* Online Dot */}
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 
                           bg-green-500 border-2 border-white 
                           rounded-full"></span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1">
        <p className="font-medium text-slate-800 truncate">
          {conversation.userName}
        </p>
      </div>
    </div>
  );
};

export default Conversation;

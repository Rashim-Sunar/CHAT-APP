import { useEffect, useState } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { IoArrowBack } from "react-icons/io5";
import Messages from "./Messages";
import MessageInput from "./MessageInput";
import useConversation from "../../zustand/useConversation";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { useAuthContext } from "../../context/Auth-Context";
import UserDetailsPanel from "../details/UserDetailsPanel";

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const [showDetails, setShowDetails] = useState(false);
  const avatarSrc = selectedConversation?.profilePic || getAvatarByGender(selectedConversation?.gender);

  useEffect(() => {
    return () => setSelectedConversation(null, currentUserId);
  }, [setSelectedConversation, currentUserId]);

  useEffect(() => {
    setShowDetails(false);
  }, [selectedConversation?._id]);

  if (!selectedConversation) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-lg">
        Select a conversation to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-4 md:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedConversation(null, currentUserId)}
            className="md:hidden text-slate-600"
          >
            <IoArrowBack size={22} />
          </button>

          <img
            src={avatarSrc}
            alt="avatar"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
          />

          <h3 className="font-semibold text-slate-800 text-sm md:text-base">
            {selectedConversation.userName}
          </h3>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="xl:hidden text-slate-600 h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
          aria-label="Open user details"
        >
          <HiOutlineDotsVertical size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 bg-slate-50 min-w-0">
        <Messages />
      </div>

      <div className="border-t border-slate-200 bg-white">
        <MessageInput />
      </div>

      <div className="xl:hidden">
        <UserDetailsPanel isOpen={showDetails} onClose={() => setShowDetails(false)} variant="drawer" />
      </div>
    </div>
  );
};

export default MessageContainer;
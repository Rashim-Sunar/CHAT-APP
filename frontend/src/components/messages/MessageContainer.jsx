import { useEffect, useState } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { IoArrowBack } from "react-icons/io5";
import Messages from "./Messages";
import MessageInput from "./MessageInput";
import useGetConversation from "../../zustand/useConversation";

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } =
    useGetConversation();

  const [showDetails, setShowDetails] = useState(false);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => setSelectedConversation(null);
  }, [setSelectedConversation]);

  // If no chat selected
  if (!selectedConversation) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-lg">
        Select a conversation to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* ================= HEADER ================= */}
      <div className="px-4 md:px-6 py-3 border-b border-slate-200 
                      flex items-center justify-between bg-white">

        {/* Left Section */}
        <div className="flex items-center gap-3">

          {/* Back Button (Mobile Only) */}
          <button
            onClick={() => setSelectedConversation(null)}
            className="md:hidden text-slate-600"
          >
            <IoArrowBack size={22} />
          </button>

          <img
            src={selectedConversation.profilePic}
            alt="avatar"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
          />

          <h3 className="font-semibold text-slate-800 text-sm md:text-base">
            {selectedConversation.userName}
          </h3>
        </div>

        {/* 3 Dot Menu (Mobile Only) */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="lg:hidden text-slate-600"
        >
          <HiOutlineDotsVertical size={20} />
        </button>
      </div>

      {/* ================= MOBILE DETAILS PANEL ================= */}
      {showDetails && (
        <div className="lg:hidden bg-slate-50 border-b border-slate-200 
                        p-4 animate-fadeIn text-sm text-slate-500 space-y-2">
          <p>Shared images will appear here.</p>
          <p>Shared links will appear here.</p>
          <p>Other user info will appear here.</p>
        </div>
      )}

      {/* ================= MESSAGES ================= */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-50">
        <Messages />
      </div>

      {/* ================= INPUT ================= */}
      <div className="border-t border-slate-200 bg-white">
        <MessageInput />
      </div>

    </div>
  );
};

export default MessageContainer;

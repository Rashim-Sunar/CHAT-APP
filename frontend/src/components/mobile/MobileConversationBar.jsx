import { useState } from "react";
import { IoSearchSharp } from "react-icons/io5";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";

const MobileConversationBar = () => {
  const { conversations } = useGetConversations();
  const { selectedConversation, setSelectedConversation } =
    useConversation();

  const [search, setSearch] = useState("");

  const filteredConversations = conversations.filter((c) =>
    c.userName.toLowerCase().includes(search.toLowerCase())
  );

  if(selectedConversation) return null;

  return (
    <div className="bg-white">

      {/*  Search Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-full
                       bg-slate-100 text-sm
                       focus:outline-none focus:ring-2
                       focus:ring-indigo-500 transition"
          />
          <IoSearchSharp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>
      </div>

      {/* Horizontal Scroll Users */}
      <div className="flex overflow-x-auto px-4 pb-4 gap-4 no-scrollbar">
        {filteredConversations.map((conversation) => {
          const isSelected =
            selectedConversation?._id === conversation._id;

          return (
            <div
              key={conversation._id}
              onClick={() => setSelectedConversation(conversation)}
              className="flex flex-col items-center cursor-pointer min-w-[65px]"
            >
              <div
                className={`w-14 h-14 rounded-full overflow-hidden border-2
                  ${
                    isSelected
                      ? "border-indigo-600"
                      : "border-transparent"
                  }`}
              >
                <img
                  src={conversation.profilePic}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              <span className="text-xs mt-1 truncate w-full text-center text-slate-600">
                {conversation.userName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MobileConversationBar;

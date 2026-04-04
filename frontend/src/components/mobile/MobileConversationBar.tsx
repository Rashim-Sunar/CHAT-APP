import { useState, type ChangeEvent } from "react";
import { IoSearchSharp } from "react-icons/io5";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { useAuthContext } from "../../context/Auth-Context";

const MobileConversationBar = () => {
  const { conversations } = useGetConversations();
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const [search, setSearch] = useState("");
  const activeConversationId = selectedConversation?._id;

  const filteredConversations = conversations.filter((conversation) =>
    conversation.userName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  if (selectedConversation) return null;

  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-4 rounded-full
                       bg-slate-100 text-sm
                       focus:outline-none focus:ring-2
                       focus:ring-indigo-500 transition"
          />
          <IoSearchSharp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>
      </div>

      <div className="flex overflow-x-auto px-4 pb-4 gap-4 no-scrollbar">
        {filteredConversations.map((conversation) => {
          const isSelected = activeConversationId === conversation._id;

          return (
            <div
              key={conversation._id}
              onClick={() => setSelectedConversation(conversation, currentUserId)}
              className="flex flex-col items-center cursor-pointer min-w-[65px]"
            >
              <div
                className={`w-14 h-14 rounded-full overflow-hidden border-2
                  ${isSelected ? "border-indigo-600" : "border-transparent"}`}
              >
                <img
                  src={getAvatarByGender(conversation.gender)}
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
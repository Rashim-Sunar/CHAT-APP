import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import { extractTime } from "../../Utils/extractTime";

const Message = ({ message }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();

  const sender = authUser?.data?.user;
  const fromMe = message.senderId === sender._id;

  const profilePic = fromMe
    ? sender.profilePic
    : selectedConversation?.profilePic;

  const formattedTime = extractTime(message.createdAt);

  return (
    <div className={`flex mb-4 ${fromMe ? "justify-end" : "justify-start"}`}>
      
      {!fromMe && (
        <img
          src={profilePic}
          className="w-8 h-8 rounded-full mr-2"
          alt="avatar"
        />
      )}

      <div className="max-w-xs md:max-w-md">
        <div
          className={`px-4 py-2 rounded-2xl shadow-sm
            ${fromMe
              ? "bg-indigo-600 text-white rounded-br-none"
              : "bg-white text-slate-800 rounded-bl-none"
            }`}
        >
          {message.message}
        </div>

        <div className="text-xs text-slate-400 mt-1 text-right">
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default Message;

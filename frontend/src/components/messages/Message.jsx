import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import { extractTime } from "../../Utils/extractTime";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";

const renderMessageBody = (message, fromMe) => {
  const bubbleClass = fromMe
    ? "bg-indigo-600 text-white rounded-br-none"
    : "bg-white text-slate-800 rounded-bl-none";

  if (message.messageType === "image" && message.fileUrl) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block">
        <img
          src={message.fileUrl}
          alt={message.fileName || "Shared image"}
          className="max-h-72 w-auto rounded-xl object-cover"
        />
      </a>
    );
  }

  if (message.messageType === "video" && message.fileUrl) {
    return (
      <video controls className="max-h-72 rounded-xl">
        <source src={message.fileUrl} type={message.mimeType || "video/mp4"} />
      </video>
    );
  }

  if (message.messageType === "file" && message.fileUrl) {
    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className={`px-4 py-3 rounded-2xl shadow-sm inline-flex flex-col gap-1 ${bubbleClass}`}
      >
        <span className="font-medium">{message.fileName || "Download file"}</span>
        <span className="text-xs opacity-80">Download</span>
      </a>
    );
  }

  return (
    <div className={`px-4 py-2 rounded-2xl shadow-sm ${bubbleClass}`}>
      {message.text || message.message}
    </div>
  );
};

const Message = ({ message }) => {
  const { authUser } = useAuthContext();
  const { selectedConversation } = useConversation();

  const sender = authUser?.data?.user;
  const fromMe = message.senderId === sender._id;

  const profilePic = fromMe
    ? getAvatarByGender(sender?.gender)
    : getAvatarByGender(selectedConversation?.gender);

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
        {renderMessageBody(message, fromMe)}

        <div className="text-xs text-slate-400 mt-1 text-right">
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default Message;

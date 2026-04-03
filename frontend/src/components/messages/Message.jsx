import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import { extractTime } from "../../Utils/extractTime";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { downloadFileWithFallback, getCloudinaryAttachmentUrl, openFileWithFallback } from "../../Utils/fileDownload";

// Render the message body according to its transport type.
//
// The component is intentionally split by type so each payload uses the right
// browser primitive:
// - text: simple bubble rendering
// - image: direct preview with click-to-open behavior
// - video: native player controls
// - file: explicit open/download actions with delivery fallbacks
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
    const attachmentUrl = getCloudinaryAttachmentUrl(message.fileUrl, message.fileName);

    return (
      <div className={`px-4 py-3 rounded-2xl shadow-sm inline-flex flex-col gap-2 min-w-[220px] ${bubbleClass}`}>
        {/* File messages are rendered as an action card rather than a plain
            text bubble so the user can immediately open or download the asset
            without guessing whether the file is safe to navigate to. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-medium block truncate">
              {message.fileName || "Shared file"}
            </span>
            <span className="text-xs opacity-80 block">
              {message.mimeType || "application/octet-stream"}
            </span>
          </div>
          <span className="text-xs opacity-80 whitespace-nowrap">File</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => openFileWithFallback(message.fileUrl, message.fileName, message.publicId, message.messageType)}
            className="text-xs font-medium underline underline-offset-2"
          >
            Open
          </button>

          <button
            type="button"
            onClick={() => downloadFileWithFallback(attachmentUrl || message.fileUrl, message.fileName, message.publicId, message.messageType)}
            className="text-xs font-medium underline underline-offset-2"
          >
            Download
          </button>

          <button
            type="button"
            onClick={() => downloadFileWithFallback(attachmentUrl || message.fileUrl, message.fileName, message.publicId, message.messageType)}
            className="text-xs font-medium underline underline-offset-2"
          >
            Save
          </button>
        </div>
      </div>
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

  // The timestamp is shown for every message regardless of transport type so
  // the chat timeline remains readable even when a message is rendered as a
  // media card instead of a text bubble.
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

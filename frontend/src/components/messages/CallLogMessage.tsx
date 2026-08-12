import { FiPhone, FiPhoneMissed, FiVideo } from "react-icons/fi";
import { extractTime } from "../../Utils/extractTime";
import { useAuthContext } from "../../context/Auth-Context";
import { useCallContext } from "../../context/CallContext";
import useConversation from "../../zustand/useConversation";
import type { Message as ChatMessage } from "../../types";

interface CallLogMessageProps {
  message: ChatMessage;
}

const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Centered system row (like Messages.tsx's DateDivider), not a left/right
// bubble — a call is a shared event, not authored content from one side.
const CallLogMessage = ({ message }: CallLogMessageProps) => {
  const { authUser } = useAuthContext();
  const { startCall } = useCallContext();
  const { selectedConversation } = useConversation();
  const currentUserId = authUser?.data?.user?._id;

  const isVideo = message.callType === "video";
  const isMissed = message.callStatus === "missed";
  const isDeclined = message.callStatus === "declined";
  // Call-log senderId is always the original caller, so "not me" means this
  // call rang on my device — that's the only side offering "Call back".
  const wasIncomingToMe = String(message.senderId) !== currentUserId;

  const label = isMissed
    ? "Missed call"
    : isDeclined
      ? "Call declined"
      : `${isVideo ? "Video" : "Voice"} call${
          message.callDurationSec ? ` · ${formatDuration(message.callDurationSec)}` : ""
        }`;

  const canCallBack = selectedConversation?.type === "direct" && isMissed && wasIncomingToMe;

  return (
    <div className="my-3 flex items-center justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur-sm">
        {isMissed ? (
          <FiPhoneMissed size={13} className="text-rose-500" />
        ) : isVideo ? (
          <FiVideo size={13} className="text-slate-400" />
        ) : (
          <FiPhone size={13} className="text-slate-400" />
        )}
        <span>{label}</span>
        <span className="text-slate-300">·</span>
        <span>{extractTime(message.createdAt)}</span>
        {canCallBack && selectedConversation && (
          <button
            type="button"
            onClick={() => void startCall(selectedConversation._id, message.callType || "audio")}
            className="ml-1 font-medium text-indigo-600 hover:text-indigo-700"
          >
            Call back
          </button>
        )}
      </span>
    </div>
  );
};

export default CallLogMessage;

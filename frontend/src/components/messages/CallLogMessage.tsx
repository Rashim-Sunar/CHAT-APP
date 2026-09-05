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
    <div className="call-log-row my-4 flex justify-center">
      <div className="call-log-card flex w-full max-w-[280px] items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-sm backdrop-blur-md">
        <span className={`call-log-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isMissed ? "call-log-icon--missed" : "call-log-icon--normal"}`}>
          {isMissed ? <FiPhoneMissed size={18} /> : isVideo ? <FiVideo size={18} /> : <FiPhone size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="mt-0.5 block text-xs opacity-60">{extractTime(message.createdAt)}</span>
        </span>
        {canCallBack && selectedConversation && (
          <button
            type="button"
            onClick={() => void startCall(selectedConversation._id, message.callType || "audio")}
            className="call-log-action rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors"
          >
            Call back
          </button>
        )}
      </div>
    </div>
  );
};

export default CallLogMessage;

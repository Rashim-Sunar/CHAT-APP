import { FiPhone, FiVideo } from "react-icons/fi";
import toast from "react-hot-toast";
import { useCallContext } from "../../context/CallContext";
import type { CallType, Conversation } from "../../types";

interface CallButtonsProps {
  conversation: Conversation;
}

// Lives in the conversation header. For a direct chat it always starts a
// fresh ring; for a group it starts a new call only while none is running —
// once a call banner is live, GroupCallBanner is the join affordance instead
// of these two icons doing double duty as "start" and "join".
const CallButtons = ({ conversation }: CallButtonsProps) => {
  const { callState, activeCall, callBanners, startCall, startGroupCall } = useCallContext();

  if (activeCall?.conversationId === conversation._id) return null;

  const isGroup = conversation.type === "group";
  if (isGroup && callBanners[conversation._id]) return null;

  const handleStart = (callType: CallType) => {
    if (callState !== "idle") {
      toast.error("You're already in a call");
      return;
    }

    if (isGroup) {
      void startGroupCall(conversation._id, callType);
    } else {
      void startCall(conversation._id, callType);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleStart("audio")}
        className="text-slate-600 h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
        aria-label="Start voice call"
        title="Voice call"
      >
        <FiPhone size={18} />
      </button>
      <button
        type="button"
        onClick={() => handleStart("video")}
        className="text-slate-600 h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
        aria-label="Start video call"
        title="Video call"
      >
        <FiVideo size={18} />
      </button>
    </>
  );
};

export default CallButtons;

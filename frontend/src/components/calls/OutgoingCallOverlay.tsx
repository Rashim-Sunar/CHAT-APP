import { FiPhoneOff } from "react-icons/fi";
import Avatar from "../common/Avatar";
import useConversation from "../../zustand/useConversation";
import { useCallContext } from "../../context/CallContext";

// Shown while callState === "ringing-outgoing" (1:1 calls only — group
// calls go straight to "connecting" since there's no one specific answerer).
const OutgoingCallOverlay = () => {
  const { activeCall, leaveCall } = useCallContext();
  const { conversations } = useConversation();

  if (!activeCall) return null;

  const conversation = conversations.find((entry) => entry._id === activeCall.conversationId);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/90 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Calling ${conversation?.displayName || ""}`}
    >
      <div className="flex flex-col items-center gap-4">
        <Avatar
          src={conversation?.displayAvatar}
          name={conversation?.displayName}
          alt={conversation?.displayName || "Calling"}
          className="h-24 w-24 rounded-full object-cover"
          textClassName="text-3xl"
        />
        <div className="text-center">
          <p className="text-xl font-semibold text-white">{conversation?.displayName || "Calling..."}</p>
          <p className="mt-1 text-sm text-white/70">
            Calling{activeCall.callType === "video" ? " (video)" : ""}...
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={leaveCall}
          aria-label="Cancel call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white transition-transform hover:scale-105"
        >
          <FiPhoneOff size={24} />
        </button>
        <span className="text-xs text-white/70">Cancel</span>
      </div>
    </div>
  );
};

export default OutgoingCallOverlay;

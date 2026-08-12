import { FiPhone, FiPhoneOff, FiVideo } from "react-icons/fi";
import Avatar from "../common/Avatar";
import { useCallContext } from "../../context/CallContext";

// Full-screen ring UI, reusing ProfileModal's fixed inset-0 z-50 bg-black/90
// overlay pattern. Only rendered while callState === "ringing-incoming".
const IncomingCallModal = () => {
  const { incomingCall, acceptIncoming, declineIncoming } = useCallContext();

  if (!incomingCall) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/90 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming call from ${incomingCall.fromUserName}`}
    >
      <div className="flex flex-col items-center gap-4">
        <Avatar
          src={incomingCall.fromUserAvatar}
          name={incomingCall.fromUserName}
          alt={incomingCall.fromUserName}
          className="h-24 w-24 rounded-full object-cover"
          textClassName="text-3xl"
        />
        <div className="text-center">
          <p className="text-xl font-semibold text-white">{incomingCall.fromUserName}</p>
          <p className="mt-1 text-sm text-white/70">
            Incoming {incomingCall.callType === "video" ? "video" : "voice"} call...
          </p>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={declineIncoming}
            aria-label="Decline call"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white transition-transform hover:scale-105"
          >
            <FiPhoneOff size={24} />
          </button>
          <span className="text-xs text-white/70">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void acceptIncoming()}
            aria-label="Accept call"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform hover:scale-105"
          >
            {incomingCall.callType === "video" ? <FiVideo size={24} /> : <FiPhone size={24} />}
          </button>
          <span className="text-xs text-white/70">Accept</span>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

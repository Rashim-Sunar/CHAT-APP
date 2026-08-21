import { FiLock, FiMic, FiMicOff, FiPhoneOff, FiVideo, FiVideoOff } from "react-icons/fi";
import { useCallContext } from "../../context/CallContext";
import { useAuthContext } from "../../context/Auth-Context";
import CallVideoGrid from "./CallVideoGrid";

// Full-screen surface shown once a call is connecting or connected — reused
// as-is for both direct and group calls (CallVideoGrid already handles 1..6
// tiles). The "DTLS-SRTP encrypted" badge reuses the exact pill styling
// already established for the E2EE badge in UserDetailsPanel/GroupInfoPanel;
// the claim is accurate for WebRTC media (mandatory, not something we built)
// and keeps one consistent visual language for "this is protected."
const ActiveCallScreen = () => {
  const {
    activeCall,
    callState,
    localStream,
    participants,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    leaveCall,
  } = useCallContext();
  const { authUser } = useAuthContext();

  if (!activeCall || (callState !== "connecting" && callState !== "in-call")) return null;

  const localUserName = authUser?.data?.user?.userName || "You";
  const localAvatar = authUser?.data?.user?.profilePic;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-900 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Active call"
    >
      <div className="flex w-full max-w-5xl items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300">
          <FiLock size={11} />
          DTLS-SRTP encrypted
        </span>
        {callState === "connecting" && <span className="text-xs text-white/60">Connecting...</span>}
      </div>

      <div className="flex w-full max-w-5xl flex-1 items-center justify-center py-6">
        <CallVideoGrid
          localStream={localStream}
          localUserName={localUserName}
          localAvatar={localAvatar}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          callType={activeCall.callType}
          participants={participants}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            isMuted ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>

        {activeCall.callType === "video" && (
          <button
            type="button"
            onClick={toggleCamera}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              isCameraOff ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isCameraOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
          </button>
        )}

        <button
          type="button"
          onClick={leaveCall}
          aria-label="Leave call"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white transition-transform hover:scale-105"
        >
          <FiPhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};

export default ActiveCallScreen;

import { useCallContext } from "../../context/CallContext";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallOverlay from "./OutgoingCallOverlay";
import ActiveCallScreen from "./ActiveCallScreen";

// Mounted once at the app root so ringing/active-call overlays render above
// whatever conversation happens to be open, not just when one is selected.
const CallOverlayHost = () => {
  const { callState } = useCallContext();

  if (callState === "ringing-incoming") return <IncomingCallModal />;
  if (callState === "ringing-outgoing") return <OutgoingCallOverlay />;
  if (callState === "connecting" || callState === "in-call") return <ActiveCallScreen />;
  return null;
};

export default CallOverlayHost;

import ActiveCallOverlay from "./ActiveCallOverlay";
import IncomingCallOverlay from "./IncomingCallOverlay";

export default function CallOverlayHost() {
  return (
    <>
      <IncomingCallOverlay />
      <ActiveCallOverlay />
    </>
  );
}

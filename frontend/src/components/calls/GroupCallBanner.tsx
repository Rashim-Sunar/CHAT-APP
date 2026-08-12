import { useEffect } from "react";
import { FiPhone, FiVideo } from "react-icons/fi";
import { apiFetch } from "../../Utils/apiFetch";
import { useCallContext } from "../../context/CallContext";
import type { CallType } from "../../types";

interface GroupCallBannerProps {
  conversationId: string;
}

interface ActiveCallResponse {
  status: "success" | "fail";
  data?: {
    active: boolean;
    call?: { callType: CallType; participantCount: number; participantUserIds: string[] };
  };
}

// Persistent bar above the message list: "Ongoing call · 3/6 — Join". Seeded
// from GET /:id/call on conversation open (covers a call that started before
// this client was connected/subscribed), then kept live purely through
// CallContext's existing call:started/participant-joined/left/ended
// listeners — no polling once seeded.
const GroupCallBanner = ({ conversationId }: GroupCallBannerProps) => {
  const { callBanners, activeCall, joinCall, seedCallBanner } = useCallContext();

  useEffect(() => {
    let cancelled = false;

    apiFetch<ActiveCallResponse>(`/conversations/${conversationId}/call`)
      .then((response) => {
        if (cancelled) return;
        const call = response.data?.call;
        seedCallBanner(
          conversationId,
          call ? { callType: call.callType, participantCount: call.participantCount } : null
        );
      })
      .catch(() => {
        // Silent — banner just won't show until a live event arrives.
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, seedCallBanner]);

  const banner = callBanners[conversationId];
  const isMyOwnActiveCall = activeCall?.conversationId === conversationId;

  if (!banner || isMyOwnActiveCall) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 px-4 md:px-6 py-2.5">
      <div className="flex items-center gap-2 text-sm text-indigo-700">
        {banner.callType === "video" ? <FiVideo size={16} /> : <FiPhone size={16} />}
        <span className="font-medium">
          Ongoing {banner.callType === "video" ? "video" : "voice"} call · {banner.participantCount}/6
        </span>
      </div>
      <button
        type="button"
        onClick={() => void joinCall(conversationId, banner.callType)}
        className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Join
      </button>
    </div>
  );
};

export default GroupCallBanner;

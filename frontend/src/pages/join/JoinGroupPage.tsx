import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import Avatar from "../../components/common/Avatar";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse } from "../../types";

interface InvitePreview {
  groupName?: string;
  groupAvatar?: string;
  memberCount?: number;
}

const JoinGroupPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const { setSelectedConversation } = useConversation();
  const { refetch } = useGetConversations();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);

    apiFetch<ApiErrorResponse & { data?: InvitePreview }>(`/conversations/join/${token}/preview`, {
      method: "GET",
    })
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setPreview(data.data || null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setPreviewError(getErrorMessage(error, "This invite link is invalid or has expired"));
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;

    setIsJoining(true);
    try {
      const data = await apiFetch<ApiErrorResponse & { data?: { conversationId?: string } }>(
        `/conversations/join/${token}`,
        { method: "POST" }
      );
      if (data.error) throw new Error(data.error);

      const conversationId = data?.data?.conversationId;
      await refetch();

      if (conversationId) {
        const joinedConversation = useConversation
          .getState()
          .conversations.find((conversation) => conversation._id === conversationId);
        if (joinedConversation) {
          setSelectedConversation(joinedConversation, currentUserId);
        }
      }

      navigate("/", { replace: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to join group"));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-8 sm:p-10 text-center">
        {loadingPreview ? (
          <p className="text-sm text-slate-500">Loading invite...</p>
        ) : previewError ? (
          <>
            <h1 className="text-xl font-semibold text-slate-800">Invite link unavailable</h1>
            <p className="mt-3 text-sm text-slate-500">{previewError}</p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full h-12 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              Go to chats
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Avatar
                src={preview?.groupAvatar}
                name={preview?.groupName}
                alt={`${preview?.groupName || "Group"} avatar`}
                className="h-20 w-20 rounded-full object-cover border border-slate-200 shadow-sm"
                textClassName="text-2xl"
                kind="group"
              />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-800">{preview?.groupName || "Group"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {preview?.memberCount ?? 0} {preview?.memberCount === 1 ? "member" : "members"}
            </p>

            <button
              onClick={() => void handleJoin()}
              disabled={isJoining}
              className="mt-6 w-full h-12 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-70"
            >
              {isJoining ? "Joining..." : "Join group"}
            </button>
            <button
              onClick={() => navigate("/")}
              disabled={isJoining}
              className="mt-3 w-full h-12 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-70"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinGroupPage;

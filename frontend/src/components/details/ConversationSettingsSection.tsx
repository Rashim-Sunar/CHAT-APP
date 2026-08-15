import { useState } from "react";
import { BiBellOff, BiBlock } from "react-icons/bi";
import toast from "react-hot-toast";
import Toggle from "../common/Toggle";
import useGetConversations from "../../hooks/useGetConversations";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse, Conversation } from "../../types";

interface ConversationSettingsSectionProps {
  conversation: Conversation;
}

// Second grouped card — Mute (any conversation) and Block/Unblock (direct
// only). Separate from SharedContentSection since these are settings/
// actions, not browsable content — mirrors how macOS System Settings groups
// toggles apart from content lists.
const ConversationSettingsSection = ({ conversation }: ConversationSettingsSectionProps) => {
  const { refetch } = useGetConversations();
  const [isMuting, setIsMuting] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);

  const isMuted = Boolean(conversation.isMuted);
  const isBlocked = Boolean(conversation.isBlocked);
  const blockedByMe = Boolean(conversation.blockedByMe);

  const handleToggleMute = async (nextMuted: boolean) => {
    setIsMuting(true);
    try {
      await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}/mute`, {
        method: nextMuted ? "POST" : "DELETE",
      });
      await refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsMuting(false);
    }
  };

  const handleToggleBlock = async () => {
    setConfirmingBlock(false);
    setIsBlocking(true);
    try {
      await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}/block`, {
        method: blockedByMe ? "DELETE" : "POST",
      });
      await refetch();
      toast.success(blockedByMe ? "Contact unblocked" : "Contact blocked");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <>
      <section className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <BiBellOff size={16} />
          </span>
          <span className="flex-1 text-sm font-medium text-slate-800">Mute notifications</span>
          <Toggle
            checked={isMuted}
            onChange={(next) => void handleToggleMute(next)}
            disabled={isMuting}
            label="Mute notifications"
          />
        </div>

        {conversation.type === "direct" && (
          <button
            type="button"
            onClick={() => (blockedByMe ? void handleToggleBlock() : setConfirmingBlock(true))}
            disabled={isBlocking || (isBlocked && !blockedByMe)}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                blockedByMe ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-500"
              }`}
            >
              <BiBlock size={16} />
            </span>
            <span className={`flex-1 text-sm font-medium ${blockedByMe ? "text-rose-600" : "text-slate-800"}`}>
              {blockedByMe ? "Unblock contact" : "Block contact"}
            </span>
          </button>
        )}
      </section>

      {confirmingBlock && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">Block this contact?</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              They won&apos;t be able to message or call you, and you won&apos;t be able to message or call them
              until you unblock.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingBlock(false)}
                className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleToggleBlock()}
                className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConversationSettingsSection;

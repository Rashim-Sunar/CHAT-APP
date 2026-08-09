import { useState } from "react";
import { BiCheck, BiCopy, BiEdit, BiLinkAlt, BiLogOut, BiUserPlus, BiX } from "react-icons/bi";
import { FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import Avatar from "../common/Avatar";
import UserPickerModal from "../common/UserPickerModal";
import useGetConversations from "../../hooks/useGetConversations";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse, Conversation } from "../../types";

interface GroupInfoPanelProps {
  conversation: Conversation;
  currentUserId?: string;
  variant: "desktop" | "drawer";
  onClose?: () => void;
}

/**
 * Group-specific right panel content: name/avatar, member list with admin
 * controls, invite link, and leave. Rendered inside UserDetailsPanel's shared
 * slide-in chrome — this component owns only the panel's inner content.
 */
const GroupInfoPanel = ({ conversation, currentUserId, variant, onClose }: GroupInfoPanelProps) => {
  const { refetch } = useGetConversations();
  const [isMutating, setIsMutating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.groupName || conversation.displayName);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const isAdmin = Boolean(currentUserId && conversation.admins?.includes(currentUserId));
  const memberCount = conversation.participants.length;

  const runMutation = async (action: () => Promise<void>) => {
    setIsMutating(true);
    try {
      await action();
      await refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === conversation.groupName) {
      setIsEditingName(false);
      return;
    }

    await runMutation(async () => {
      const data = await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}`, {
        method: "PATCH",
        body: JSON.stringify({ groupName: trimmed }),
      });
      if (data.error) throw new Error(data.error);
      setIsEditingName(false);
    });
  };

  const handleAddMembers = async (userIds: string[]) => {
    await runMutation(async () => {
      const data = await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds }),
      });
      if (data.error) throw new Error(data.error);
      toast.success(userIds.length === 1 ? "Member added" : `${userIds.length} members added`);
      setAddMembersOpen(false);
    });
  };

  const handleRemoveMember = async (userId: string) => {
    await runMutation(async () => {
      const data = await apiFetch<ApiErrorResponse>(
        `/conversations/${conversation._id}/members/${userId}`,
        { method: "DELETE" }
      );
      if (data.error) throw new Error(data.error);
      toast.success("Member removed");
    });
  };

  const handlePromote = async (userId: string) => {
    await runMutation(async () => {
      const data = await apiFetch<ApiErrorResponse>(
        `/conversations/${conversation._id}/admins/${userId}`,
        { method: "POST" }
      );
      if (data.error) throw new Error(data.error);
      toast.success("Promoted to admin");
    });
  };

  const handleLeave = async () => {
    await runMutation(async () => {
      const data = await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}/members/me`, {
        method: "DELETE",
      });
      if (data.error) throw new Error(data.error);
      toast.success("You left the group");
      onClose?.();
    });
  };

  const handleGenerateInvite = async () => {
    setIsMutating(true);
    try {
      const data = await apiFetch<ApiErrorResponse & { data?: { inviteUrl?: string } }>(
        `/conversations/${conversation._id}/invite`,
        { method: "POST" }
      );
      if (data.error) throw new Error(data.error);
      setInviteUrl(data?.data?.inviteUrl || null);
      setInviteCopied(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  };

  const handleRevokeInvite = async () => {
    setIsMutating(true);
    try {
      const data = await apiFetch<ApiErrorResponse>(`/conversations/${conversation._id}/invite`, {
        method: "DELETE",
      });
      if (data.error) throw new Error(data.error);
      setInviteUrl(null);
      toast.success("Invite link revoked");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <>
      <div className="relative px-5 pt-5 pb-6 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        {variant === "drawer" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
            aria-label="Close details panel"
          >
            <BiX size={17} />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <Avatar
            src={conversation.displayAvatar}
            name={conversation.displayName}
            alt={`${conversation.displayName} group avatar`}
            className="h-20 w-20 rounded-full object-cover border border-slate-200 shadow-sm"
            textClassName="text-2xl"
            kind="group"
          />

          <div className="mt-3 min-w-0 w-full">
            {isEditingName ? (
              <div className="flex items-center gap-2 justify-center">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSaveName();
                    if (event.key === "Escape") setIsEditingName(false);
                  }}
                  className="min-w-0 max-w-[200px] rounded-lg border border-slate-300 px-2 py-1 text-center text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  disabled={isMutating}
                  aria-label="Save group name"
                  className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50"
                >
                  <BiCheck size={16} />
                </button>
              </div>
            ) : (
              <p className="flex items-center justify-center gap-1.5 text-lg font-semibold text-slate-900 truncate">
                {conversation.displayName}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(conversation.groupName || conversation.displayName);
                      setIsEditingName(true);
                    }}
                    aria-label="Edit group name"
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <BiEdit size={15} />
                  </button>
                )}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-1">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
              <FiLock size={11} />
              End-to-end encrypted
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
        {isAdmin && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <BiLinkAlt size={16} className="text-slate-500" />
              <span className="text-sm font-semibold tracking-wide uppercase">Invite link</span>
            </div>

            {inviteUrl ? (
              <div className="space-y-2">
                <p className="break-all rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                  {inviteUrl}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <BiCopy size={14} />
                    {inviteCopied ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRevokeInvite()}
                    disabled={isMutating}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerateInvite()}
                disabled={isMutating}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Generate invite link
              </button>
            )}
            <p className="text-[11px] text-slate-400">
              Share this link in a chat — anyone with it can join. Generating a new one invalidates the old link.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="w-full px-4 py-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="text-sm font-semibold tracking-wide uppercase">Members</span>
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {memberCount}
              </span>
            </span>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setAddMembersOpen(true)}
                aria-label="Add members"
                className="h-7 w-7 rounded-md hover:bg-slate-100 text-indigo-600 flex items-center justify-center"
              >
                <BiUserPlus size={17} />
              </button>
            )}
          </div>

          <div className="px-2 pb-2 space-y-0.5">
            {conversation.participants.map((participant) => {
              const isSelf = participant._id === currentUserId;

              return (
                <div
                  key={participant._id}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50"
                >
                  <Avatar
                    src={participant.profilePic}
                    gender={participant.gender}
                    name={participant.userName}
                    alt="avatar"
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {isSelf ? "You" : participant.userName}
                    </p>
                    {participant.isAdmin && <p className="text-xs text-indigo-600">Admin</p>}
                  </div>

                  {isAdmin && !isSelf && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!participant.isAdmin && (
                        <button
                          type="button"
                          onClick={() => void handlePromote(participant._id)}
                          disabled={isMutating}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Make admin
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(participant._id)}
                        disabled={isMutating}
                        aria-label={`Remove ${participant.userName}`}
                        className="h-6 w-6 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center disabled:opacity-50"
                      >
                        <BiX size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={() => void handleLeave()}
          disabled={isMutating}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <BiLogOut size={16} />
          Leave group
        </button>
      </div>

      <UserPickerModal
        isOpen={addMembersOpen}
        title="Add members"
        multiSelect
        excludeUserIds={conversation.participants.map((participant) => participant._id)}
        confirmLabel="Add"
        onClose={() => setAddMembersOpen(false)}
        onConfirm={handleAddMembers}
      />
    </>
  );
};

export default GroupInfoPanel;

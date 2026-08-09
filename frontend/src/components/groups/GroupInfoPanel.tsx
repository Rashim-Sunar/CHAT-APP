import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BiCheck,
  BiCopy,
  BiCrown,
  BiDotsVerticalRounded,
  BiEdit,
  BiLinkAlt,
  BiLogOut,
  BiMessageSquareDetail,
  BiUserMinus,
  BiUserPlus,
  BiX,
} from "react-icons/bi";
import { FiChevronDown, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import Avatar from "../common/Avatar";
import UserPickerModal from "../common/UserPickerModal";
import useGetConversations from "../../hooks/useGetConversations";
import useStartConversation from "../../hooks/useStartConversation";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse, Conversation } from "../../types";

interface GroupInfoPanelProps {
  conversation: Conversation;
  currentUserId?: string;
  variant: "desktop" | "drawer";
  onClose?: () => void;
}

const MENU_WIDTH = 192; // w-48
const MENU_HEIGHT_ESTIMATE = 160; // enough for up to 3 rows + padding
const VIEWPORT_MARGIN = 8;

interface MemberActionMenuProps {
  anchorRect: DOMRect;
  onClose: () => void;
  children: ReactNode;
}

// Rendered into document.body via a portal and positioned from the trigger
// button's actual viewport coordinates, so it can never be clipped by the
// member list's own scroll container or the section's rounded-corner
// overflow — the two ancestors that clipped it when this was a plain
// absolutely-positioned child. Flips above the trigger when there isn't
// room below, and closes on scroll/resize since its position is captured
// once at open time rather than continuously tracked.
const MemberActionMenu = ({ anchorRect, onClose, children }: MemberActionMenuProps) => {
  useEffect(() => {
    const close = () => onClose();
    // capture: true so scrolling any nested scrollable ancestor (which
    // doesn't bubble a "scroll" event to window) still closes the menu.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE && anchorRect.top > MENU_HEIGHT_ESTIMATE;
  const left = Math.min(
    Math.max(anchorRect.right - MENU_WIDTH, VIEWPORT_MARGIN),
    window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN
  );

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        style={{
          left,
          ...(openUpward
            ? { bottom: window.innerHeight - anchorRect.top + 4 }
            : { top: anchorRect.bottom + 4 }),
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

/**
 * Group-specific right panel content: name/avatar, member list with admin
 * controls, invite link, and leave. Rendered inside UserDetailsPanel's shared
 * slide-in chrome — this component owns only the panel's inner content.
 */
const GroupInfoPanel = ({ conversation, currentUserId, variant, onClose }: GroupInfoPanelProps) => {
  const { refetch } = useGetConversations();
  const { startDirectChat } = useStartConversation();
  const [isMutating, setIsMutating] = useState(false);
  const [openMemberMenu, setOpenMemberMenu] = useState<{ participantId: string; anchorRect: DOMRect } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.groupName || conversation.displayName);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
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

  const handleMessageMember = async (userId: string) => {
    try {
      await startDirectChat(userId);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
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
          <button
            type="button"
            onClick={() => setIsMembersOpen((open) => !open)}
            aria-expanded={isMembersOpen}
            aria-controls="group-members-list"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-slate-700"
          >
            <span className="text-sm font-semibold tracking-wide uppercase">Members</span>
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {memberCount}
            </span>
            <FiChevronDown
              className={`ml-auto shrink-0 text-slate-400 transition-transform duration-200 ${isMembersOpen ? "rotate-180" : ""}`}
              size={16}
            />
          </button>

          {isMembersOpen && (
          <div id="group-members-list" className="px-2 pb-2 space-y-0.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setAddMembersOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-indigo-600 hover:bg-indigo-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <BiUserPlus size={18} />
                </span>
                <span className="text-sm font-medium">Add people</span>
              </button>
            )}
            {conversation.participants.map((participant) => {
              const isSelf = participant._id === currentUserId;
              const roleLabel = participant.isCreator
                ? "Group Creator"
                : participant.isAdmin
                  ? "Admin"
                  : participant.addedByUserName
                    ? `Added by ${participant.addedByUserName}`
                    : participant.joinedViaInvite
                      ? "Joined using invite link"
                      : null;
              const isMenuOpen = openMemberMenu?.participantId === participant._id;

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
                    {roleLabel && (
                      <p
                        className={`truncate text-xs ${
                          participant.isCreator || participant.isAdmin ? "text-indigo-600" : "text-slate-400"
                        }`}
                      >
                        {roleLabel}
                      </p>
                    )}
                  </div>

                  {isAdmin && !isSelf && (
                    <>
                      <button
                        type="button"
                        onClick={(event) =>
                          setOpenMemberMenu(
                            isMenuOpen
                              ? null
                              : { participantId: participant._id, anchorRect: event.currentTarget.getBoundingClientRect() }
                          )
                        }
                        aria-label={`Options for ${participant.userName}`}
                        aria-expanded={isMenuOpen}
                        className="h-7 w-7 shrink-0 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center"
                      >
                        <BiDotsVerticalRounded size={18} />
                      </button>

                      {isMenuOpen && openMemberMenu && (
                        <MemberActionMenu anchorRect={openMemberMenu.anchorRect} onClose={() => setOpenMemberMenu(null)}>
                          {!participant.isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMemberMenu(null);
                                void handlePromote(participant._id);
                              }}
                              disabled={isMutating}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <BiCrown size={15} />
                              Make admin
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMemberMenu(null);
                              void handleMessageMember(participant._id);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            <BiMessageSquareDetail size={15} />
                            Message
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMemberMenu(null);
                              void handleRemoveMember(participant._id);
                            }}
                            disabled={isMutating}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <BiUserMinus size={15} />
                            Remove from group
                          </button>
                        </MemberActionMenu>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          )}
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

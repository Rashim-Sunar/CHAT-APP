import { useEffect, useMemo, useState } from "react";
import { BiArrowBack, BiX } from "react-icons/bi";
import { IoSearchSharp } from "react-icons/io5";
import toast from "react-hot-toast";
import useGetAllUsers from "../../hooks/useGetAllUsers";
import { useAuthContext } from "../../context/Auth-Context";
import Avatar from "../common/Avatar";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse } from "../../types";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

/**
 * Two-step "new group" flow: pick members, then name the group and confirm.
 */
const CreateGroupModal = ({ isOpen, onClose, onCreated }: CreateGroupModalProps) => {
  const { users, loading } = useGetAllUsers();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const [step, setStep] = useState<"members" | "details">("members");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("members");
      setSearch("");
      setSelectedIds([]);
      setGroupName("");
    }
  }, [isOpen]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user._id !== currentUserId && user.userName.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [users, currentUserId, search]
  );

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user._id)),
    [users, selectedIds]
  );

  if (!isOpen) return null;

  const toggleSelection = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleCreate = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      toast.error("Give the group a name");
      return;
    }
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch<ApiErrorResponse & { data?: { conversationId?: string } }>(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({ groupName: trimmedName, participantIds: selectedIds }),
        }
      );
      if (data.error) throw new Error(data.error);

      const conversationId = data?.data?.conversationId;
      if (!conversationId) throw new Error("Group was created but could not be opened");

      onCreated(conversationId);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create group"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            {step === "details" && (
              <button
                type="button"
                onClick={() => setStep("members")}
                aria-label="Back to member selection"
                className="rounded-md p-1.5 hover:bg-slate-100"
              >
                <BiArrowBack className="h-5 w-5 text-slate-600" />
              </button>
            )}
            <h4 className="text-lg font-semibold text-slate-900">
              {step === "members" ? "Add group members" : "New group"}
            </h4>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 hover:bg-slate-100"
          >
            <BiX className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {step === "members" ? (
          <>
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="relative">
                <IoSearchSharp className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people"
                  className="h-10 w-full rounded-full bg-slate-100 pl-10 pr-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {loading ? (
                <p className="px-5 py-6 text-center text-sm text-slate-400">Loading...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-400">No people found</p>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedIds.includes(user._id);

                  return (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => toggleSelection(user._id)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 transition hover:bg-slate-50"
                    >
                      <Avatar
                        src={user.profilePic}
                        gender={user.gender}
                        name={user.userName}
                        alt="avatar"
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800">
                        {user.userName}
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                        }`}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setStep("details")}
                disabled={selectedIds.length === 0}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedIds.length > 0 ? `Next (${selectedIds.length})` : "Select members"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label htmlFor="groupName" className="mb-2 block text-sm font-medium text-slate-700">
                  Group name
                </label>
                <input
                  id="groupName"
                  type="text"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="e.g. Weekend Trip"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Members ({selectedUsers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user._id}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs font-medium text-slate-700"
                    >
                      <Avatar
                        src={user.profilePic}
                        gender={user.gender}
                        name={user.userName}
                        alt="avatar"
                        className="h-5 w-5 rounded-full object-cover"
                        textClassName="text-[10px]"
                      />
                      {user.userName}
                      <button
                        type="button"
                        onClick={() => toggleSelection(user._id)}
                        aria-label={`Remove ${user.userName}`}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <BiX className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!groupName.trim() || selectedIds.length === 0 || isSubmitting}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create group"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateGroupModal;

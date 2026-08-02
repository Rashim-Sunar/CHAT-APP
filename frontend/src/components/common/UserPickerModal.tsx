import { useEffect, useMemo, useState } from "react";
import { BiX } from "react-icons/bi";
import { IoSearchSharp } from "react-icons/io5";
import toast from "react-hot-toast";
import useGetAllUsers from "../../hooks/useGetAllUsers";
import { useAuthContext } from "../../context/Auth-Context";
import Avatar from "./Avatar";
import { getErrorMessage } from "../../Utils/getErrorMessage";

interface UserPickerModalProps {
  isOpen: boolean;
  title: string;
  multiSelect?: boolean;
  excludeUserIds?: string[];
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (selectedUserIds: string[]) => void | Promise<void>;
}

/**
 * Shared "pick user(s) from everyone" modal — backs new-chat (single-select),
 * create-group and add-members (multi-select).
 */
const UserPickerModal = ({
  isOpen,
  title,
  multiSelect = false,
  excludeUserIds = [],
  confirmLabel,
  onClose,
  onConfirm,
}: UserPickerModalProps) => {
  const { users, loading } = useGetAllUsers();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIds([]);
    }
  }, [isOpen]);

  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user._id !== currentUserId &&
          !excludeSet.has(user._id) &&
          user.userName.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [users, currentUserId, excludeSet, search]
  );

  if (!isOpen) return null;

  const toggleSelection = (userId: string) => {
    if (!multiSelect) {
      setSelectedIds([userId]);
      return;
    }

    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(selectedIds);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
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
          <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 hover:bg-slate-100"
          >
            <BiX className="h-5 w-5 text-slate-600" />
          </button>
        </div>

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
            onClick={() => void handleConfirm()}
            disabled={selectedIds.length === 0 || isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Please wait..."
              : confirmLabel ||
                (selectedIds.length > 0
                  ? `${multiSelect ? "Add" : "Start chat"}${multiSelect && selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}`
                  : "Select someone")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPickerModal;

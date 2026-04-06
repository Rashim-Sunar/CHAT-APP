interface MessageDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for message deletion.
 * Keeps the destructive choice explicit by separating local and global delete.
 */
const MessageDeleteModal = ({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  isDeleting,
}: MessageDeleteModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl transition duration-200 ease-out"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 className="text-lg font-semibold text-slate-900">Delete message</h4>
        <p className="mt-2 text-sm text-slate-600">
          Choose whether this message should disappear only for you or for everyone in the conversation.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onDeleteForMe}
            disabled={isDeleting}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete for me
          </button>

          <button
            type="button"
            onClick={onDeleteForEveryone}
            disabled={isDeleting}
            className="w-full rounded-xl bg-rose-600 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete for everyone
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default MessageDeleteModal;

import { useState } from "react";
import { BiGroup, BiMessageSquareAdd, BiPlus } from "react-icons/bi";
import toast from "react-hot-toast";
import UserPickerModal from "../common/UserPickerModal";
import CreateGroupModal from "../groups/CreateGroupModal";
import useStartConversation from "../../hooks/useStartConversation";
import { getErrorMessage } from "../../Utils/getErrorMessage";

/**
 * "+" entry point for starting a new direct chat or creating a new group —
 * shared between the desktop sidebar and the mobile conversation bar.
 */
const NewConversationMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const { startDirectChat, selectConversationById } = useStartConversation();

  const handlePickDirectUser = async (userIds: string[]) => {
    const [userId] = userIds;
    if (!userId) return;

    try {
      await startDirectChat(userId);
      setNewChatOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to start chat"));
    }
  };

  const handleGroupCreated = async (conversationId: string) => {
    await selectConversationById(conversationId);
    setNewGroupOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Start a new chat or group"
        className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-600 flex items-center justify-center"
      >
        <BiPlus size={20} />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setNewChatOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BiMessageSquareAdd size={16} />
              New chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setNewGroupOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BiGroup size={16} />
              New group
            </button>
          </div>
        </>
      )}

      <UserPickerModal
        isOpen={newChatOpen}
        title="New chat"
        confirmLabel="Start chat"
        onClose={() => setNewChatOpen(false)}
        onConfirm={handlePickDirectUser}
      />

      <CreateGroupModal isOpen={newGroupOpen} onClose={() => setNewGroupOpen(false)} onCreated={handleGroupCreated} />
    </div>
  );
};

export default NewConversationMenu;

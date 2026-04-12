/**
 * Sidebar Component
 * -----------------
 * Main left sidebar of the chat application, displaying conversations list
 * and user profile controls at the bottom.
 *
 * Features:
 * - Header with "Chats" title
 * - Search input for filtering conversations
 * - Scrollable conversations list
 * - User profile control with avatar and menu
 *
 * @component
 * @returns {JSX.Element} Sidebar navigation interface
 */

import { useAuthContext } from "../../context/Auth-Context";
import { useState } from "react";
import {
  BiLogOut,
  BiSolidEdit,
  BiSolidImageAdd,
  BiSolidTrash,
  BiSolidUserCircle,
  BiX,
} from "react-icons/bi";
import useLogout from "../../hooks/useLogout";
import useUserProfile from "../../hooks/useUserProfile";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import Conversations from "./Conversations";
import ProfileModal from "./ProfileModal";
import SearchInput from "./SearchInput";
import UserProfileControl from "./UserProfileControl";

const Sidebar = () => {
  const { authUser } = useAuthContext();
  const { logout } = useLogout();
  const { updateName, updateProfilePicture, deleteProfilePicture } = useUserProfile();
  const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit-name" | "upload">("view");

  const user = authUser?.data?.user;

  const openModal = (mode: "view" | "edit-name" | "upload") => {
    setDesktopProfileOpen(false);
    setModalMode(mode);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col w-full h-full bg-white">
      {!desktopProfileOpen ? (
        <>
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">Chats</h2>
          </div>

          <div className="px-6 py-4 border-b border-slate-100">
            <SearchInput />
          </div>

          <div className="flex-1 overflow-y-auto sidebar-scroll">
            <Conversations />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">Your Profile</h2>
            <button
              type="button"
              onClick={() => setDesktopProfileOpen(false)}
              aria-label="Close profile panel"
              className="p-1.5 rounded-md hover:bg-slate-100"
            >
              <BiX className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
              {user ? (
                <img
                  src={user.profilePic || getAvatarByGender(user.gender)}
                  alt="Your profile picture"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-800 truncate">{user?.userName}</p>
              <p className="text-sm text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => openModal("view")}
              className="w-full px-6 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
            >
              <BiSolidUserCircle className="w-4 h-4" />
              <span className="text-sm font-medium">View Profile Picture</span>
            </button>

            <button
              type="button"
              onClick={() => openModal("edit-name")}
              className="w-full px-6 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
            >
              <BiSolidEdit className="w-4 h-4" />
              <span className="text-sm font-medium">Edit Name</span>
            </button>

            <button
              type="button"
              onClick={() => openModal("upload")}
              className="w-full px-6 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
            >
              <BiSolidImageAdd className="w-4 h-4" />
              <span className="text-sm font-medium">Upload Profile Picture</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteProfilePicture();
                } catch {
                  // Error already handled by hook
                }
              }}
              className="w-full px-6 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50"
            >
              <BiSolidTrash className="w-4 h-4" />
              <span className="text-sm font-medium">Remove Profile Picture</span>
            </button>
          </div>

          <div className="border-t border-slate-200">
            <button
              type="button"
              onClick={async () => {
                await logout();
              }}
              className="w-full px-6 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50"
            >
              <BiLogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* User Profile Control - show only in chats mode */}
      {!desktopProfileOpen ? (
        <div className="px-6 py-3 border-t border-slate-200">
          <UserProfileControl
            user={user}
            onLogout={logout}
            onAvatarClick={() => setDesktopProfileOpen(true)}
          />
        </div>
      ) : null}

      <ProfileModal
        isOpen={modalOpen}
        user={user}
        mode={modalMode}
        onClose={() => {
          setModalOpen(false);
          setModalMode("view");
        }}
        onUpdateName={updateName}
        onUploadPicture={updateProfilePicture}
      />
    </div>
  );
};

export default Sidebar;
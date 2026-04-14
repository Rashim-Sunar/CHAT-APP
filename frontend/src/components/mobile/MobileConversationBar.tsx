import { useEffect, useState, type ChangeEvent } from "react";
import { IoSearchSharp } from "react-icons/io5";
import {
  BiLogOut,
  BiSolidEdit,
  BiSolidImageAdd,
  BiSolidTrash,
  BiSolidUserCircle,
  BiX,
} from "react-icons/bi";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { useAuthContext } from "../../context/Auth-Context";
import useLogout from "../../hooks/useLogout";
import useUserProfile from "../../hooks/useUserProfile";
import ProfileModal from "../sidebar/ProfileModal";

const MobileConversationBar = () => {
  const { conversations } = useGetConversations();
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const { logout } = useLogout();
  const currentUser = authUser?.data?.user;
  const currentUserId = authUser?.data?.user?._id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit-name" | "upload">("view");
  const { updateName, updateProfilePicture, deleteProfilePicture } = useUserProfile();

  const [search, setSearch] = useState("");
  const activeConversationId = selectedConversation?._id;

  const filteredConversations = conversations.filter((conversation) =>
    conversation.userName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  const openModal = (mode: "view" | "edit-name" | "upload") => {
    setMenuOpen(false);
    setModalMode(mode);
    setModalOpen(true);
  };

  if (selectedConversation) return null;

  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-bold tracking-[0.08em] text-slate-800 uppercase">
            Chat App
          </h1>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open user profile menu"
            className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200"
          >
            {currentUser ? (
              <img
                src={currentUser.profilePic || getAvatarByGender(currentUser.gender)}
                alt={`${currentUser.userName}'s profile picture`}
                className="w-full h-full object-cover"
              />
            ) : null}
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-4 rounded-full
                       bg-slate-100 text-sm
                       focus:outline-none focus:ring-2
                       focus:ring-indigo-500 transition"
          />
          <IoSearchSharp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>
      </div>

      <div className="flex overflow-x-auto px-4 pb-4 gap-4 no-scrollbar">
        {filteredConversations.map((conversation) => {
          const isSelected = activeConversationId === conversation._id;
          const avatarSrc = conversation.profilePic || getAvatarByGender(conversation.gender);

          return (
            <div
              key={conversation._id}
              onClick={() => setSelectedConversation(conversation, currentUserId)}
              className="flex flex-col items-center cursor-pointer min-w-[65px]"
            >
              <div
                className={`w-14 h-14 rounded-full overflow-hidden border-2
                  ${isSelected ? "border-indigo-600" : "border-transparent"}`}
              >
                <img
                  src={avatarSrc}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              <span className="text-xs mt-1 truncate w-full text-center text-slate-600">
                {conversation.userName}
              </span>
            </div>
          );
        })}
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close profile menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] bg-white border-r border-slate-200 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-800">Your Profile</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close profile menu"
                className="p-1.5 rounded-md hover:bg-slate-100"
              >
                <BiX className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="px-4 py-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
                {currentUser ? (
                  <img
                    src={currentUser.profilePic || getAvatarByGender(currentUser.gender)}
                    alt="Your profile picture"
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{currentUser?.userName}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
              </div>
            </div>

            <div className="py-2">
              <button
                type="button"
                onClick={() => openModal("view")}
                className="w-full px-4 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
              >
                <BiSolidUserCircle className="w-4 h-4" />
                <span className="text-sm font-medium">View Profile Picture</span>
              </button>

              <button
                type="button"
                onClick={() => openModal("edit-name")}
                className="w-full px-4 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
              >
                <BiSolidEdit className="w-4 h-4" />
                <span className="text-sm font-medium">Edit Name</span>
              </button>

              <button
                type="button"
                onClick={() => openModal("upload")}
                className="w-full px-4 py-3 flex items-center gap-3 text-slate-700 hover:bg-slate-100"
              >
                <BiSolidImageAdd className="w-4 h-4" />
                <span className="text-sm font-medium">Upload Profile Picture</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  try {
                    await deleteProfilePicture();
                  } catch {
                    // Error handled in hook
                  }
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50"
              >
                <BiSolidTrash className="w-4 h-4" />
                <span className="text-sm font-medium">Remove Profile Picture</span>
              </button>
            </div>

            <div className="mt-auto border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  await logout();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50"
              >
                <BiLogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <ProfileModal
        isOpen={modalOpen}
        user={currentUser}
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

export default MobileConversationBar;
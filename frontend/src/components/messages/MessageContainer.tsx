import { useEffect, useState, type CSSProperties } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { IoArrowBack, IoChatbubblesOutline, IoLockClosedOutline } from "react-icons/io5";
import { TbLayoutSidebarRightCollapse, TbLayoutSidebarRightExpand } from "react-icons/tb";
import Messages from "./Messages";
import MessageInput from "./MessageInput";
import useConversation from "../../zustand/useConversation";
import { useAuthContext } from "../../context/Auth-Context";
import { useSocketContext } from "../../context/SocketContext";
import UserDetailsPanel from "../details/UserDetailsPanel";
import Avatar from "../common/Avatar";
import CallButtons from "../calls/CallButtons";
import GroupCallBanner from "../calls/GroupCallBanner";
import PinnedMessageBanner from "./PinnedMessageBanner";
import { getOtherParticipant } from "../../Utils/conversationDisplay";
import { useTheme } from "../../context/useTheme";
// WebP re-encode of chatsphere-background.png (~1MB -> ~9KB, no visible loss).
import chatWallpaper from "../../assets/chatsphere-background.webp";
import darkChatWallpaper from "../../assets/darktheme-bg.webp";

const getChatWallpaperStyle = (isDark: boolean): CSSProperties => ({
  backgroundImage: isDark
    ? `linear-gradient(180deg, rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.42)), url(${darkChatWallpaper})`
    : `linear-gradient(180deg, rgba(241, 243, 248, 0.48), rgba(248, 249, 252, 0.36)), url(${chatWallpaper})`,
  backgroundRepeat: "no-repeat, repeat",
  backgroundSize: `cover, ${isDark ? "cover" : "560px"}`,
  backgroundPosition: "center, center",
});

interface MessageContainerProps {
  desktopDetailsOpen: boolean;
  onToggleDesktopDetails: () => void;
}

const MessageContainer = ({ desktopDetailsOpen, onToggleDesktopDetails }: MessageContainerProps) => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const { theme } = useTheme();
  const { onlineUsers } = useSocketContext();
  const currentUserId = authUser?.data?.user?._id;

  const [showDetails, setShowDetails] = useState(false);

  const otherParticipant = selectedConversation ? getOtherParticipant(selectedConversation, currentUserId) : undefined;
  const isOtherParticipantOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));
  const headerStatus = selectedConversation
    ? selectedConversation.type === "group"
      ? `${selectedConversation.participants.length} members`
      : isOtherParticipantOnline
        ? "Active now"
        : null
    : null;

  useEffect(() => {
    return () => setSelectedConversation(null, currentUserId);
  }, [setSelectedConversation, currentUserId]);

  useEffect(() => {
    setShowDetails(false);
  }, [selectedConversation?._id]);

  if (!selectedConversation) {
    return (
      <div className="chat-canvas flex h-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center" style={getChatWallpaperStyle(theme === "dark")}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-white text-indigo-500 shadow-sm">
          <IoChatbubblesOutline size={28} />
        </div>
        <p className="text-base font-medium text-slate-600">Select a conversation to start chatting</p>
        <p className="flex items-center gap-1.5 text-sm text-slate-400">
          <IoLockClosedOutline size={14} />
          Your messages are end-to-end encrypted
        </p>
      </div>
    );
  }

  return (
    <div className="chat-panel flex flex-col h-full relative overflow-hidden">
      <div className="chat-header px-4 md:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white/65 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedConversation(null, currentUserId)}
            className="md:hidden text-slate-600"
          >
            <IoArrowBack size={22} />
          </button>

          <div className="relative">
            <Avatar
              src={selectedConversation.displayAvatar}
              gender={otherParticipant?.gender}
              name={selectedConversation.displayName}
              alt="avatar"
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
              kind={selectedConversation.type === "group" ? "group" : "user"}
            />
            {isOtherParticipantOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-800 text-sm md:text-base">
              {selectedConversation.displayName}
            </h3>
            {headerStatus && <p className="text-xs text-slate-400">{headerStatus}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CallButtons conversation={selectedConversation} />

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="xl:hidden text-slate-600 h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            aria-label="Open user details"
          >
            <HiOutlineDotsVertical size={20} />
          </button>

          <button
            onClick={onToggleDesktopDetails}
            className="hidden xl:flex text-slate-600 h-8 w-8 rounded-lg hover:bg-slate-100 items-center justify-center"
            aria-label={desktopDetailsOpen ? "Hide user details panel" : "Show user details panel"}
            title={desktopDetailsOpen ? "Hide details panel" : "Show details panel"}
          >
            {desktopDetailsOpen ? (
              <TbLayoutSidebarRightCollapse size={20} />
            ) : (
              <TbLayoutSidebarRightExpand size={20} />
            )}
          </button>
        </div>
      </div>

      {selectedConversation.type === "group" && <GroupCallBanner conversationId={selectedConversation._id} />}
      <PinnedMessageBanner />

      <div
        data-messages-scroll-container
        className="chat-canvas flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-5 bg-slate-50 min-w-0"
        style={getChatWallpaperStyle(theme === "dark")}
      >
        <Messages />
      </div>

      <div className="chat-composer border-t border-slate-200 bg-white/65 backdrop-blur-xl">
        <MessageInput />
      </div>

      <div className="xl:hidden">
        <UserDetailsPanel isOpen={showDetails} onClose={() => setShowDetails(false)} variant="drawer" />
      </div>
    </div>
  );
};

export default MessageContainer;

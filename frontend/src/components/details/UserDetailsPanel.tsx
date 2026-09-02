import { useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiLock, FiX } from "react-icons/fi";
import useConversation from "../../zustand/useConversation";
import { useAuthContext } from "../../context/Auth-Context";
import { getOtherParticipant } from "../../Utils/conversationDisplay";
import Avatar from "../common/Avatar";
import GroupInfoPanel from "../groups/GroupInfoPanel";
import SharedContentSection from "./SharedContentSection";
import ConversationSettingsSection from "./ConversationSettingsSection";
import { useSocketContext } from "../../context/SocketContext";

interface UserDetailsPanelProps {
  isOpen: boolean;
  onClose?: () => void;
  variant?: "desktop" | "drawer";
}

const slidePanelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
} as const;

const UserDetailsPanel = ({ isOpen, onClose, variant = "desktop" }: UserDetailsPanelProps) => {
  const { selectedConversation } = useConversation();
  const { onlineUsers } = useSocketContext();
  const { authUser } = useAuthContext();
  const currentUserId = authUser?.data?.user?._id;

  const otherParticipant = getOtherParticipant(selectedConversation, currentUserId);
  const baseAvatar = selectedConversation?.displayAvatar || "";
  const userName = selectedConversation?.displayName || "User";
  const isOnline = Boolean(otherParticipant && onlineUsers.includes(otherParticipant._id));

  const showPanel = useMemo(() => {
    if (variant === "desktop") {
      return Boolean(selectedConversation);
    }

    return Boolean(selectedConversation) && isOpen;
  }, [isOpen, selectedConversation, variant]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const onContainerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose?.();
    }
  };

  if (!showPanel) return null;

  const panel = (
    <motion.aside
      variants={slidePanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`details-panel h-full flex flex-col bg-slate-50 border-l border-slate-200 ${variant === "desktop" ? "w-full" : "w-full md:w-[340px]"}`}
      aria-label="User details panel"
      onKeyDown={onContainerKeyDown}
    >
      {selectedConversation?.type === "group" ? (
        <GroupInfoPanel conversation={selectedConversation} currentUserId={currentUserId} variant={variant} onClose={onClose} />
      ) : (
        <>
          <div className="relative px-5 pt-5 pb-6 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
            {variant === "drawer" && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                aria-label="Close details panel"
              >
                <FiX size={17} />
              </button>
            )}

            <div className="flex flex-col items-center text-center">
              <div className="profile-avatar-halo">
                <Avatar
                  src={baseAvatar}
                  gender={otherParticipant?.gender}
                  name={userName}
                  alt={`${userName} profile`}
                  className="h-20 w-20 rounded-full object-cover border border-slate-200 shadow-sm"
                  textClassName="text-2xl"
                />
              </div>

              <div className="mt-3 min-w-0">
                <p className="text-lg font-semibold text-slate-900 truncate">{userName}</p>
                <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
                  {isOnline ? "Online" : "Offline"}
                </p>
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                  <FiLock size={11} />
                  End-to-end encrypted
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
            <SharedContentSection onNavigateToMessage={variant === "drawer" ? onClose : undefined} />
            {selectedConversation && <ConversationSettingsSection conversation={selectedConversation} />}
          </div>
        </>
      )}
    </motion.aside>
  );

  if (variant === "desktop") {
    // The parent (Home) owns mount/unmount and the collapse animation for the
    // desktop layout, so this only needs its own slide-in on first mount.
    return panel;
  }

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            onClick={onClose}
            aria-label="Close details drawer backdrop"
          />
          <div className="absolute inset-y-0 right-0 w-full md:w-[340px]">{panel}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserDetailsPanel;

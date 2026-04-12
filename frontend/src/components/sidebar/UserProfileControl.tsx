/**
 * UserProfileControl Component
 * ----------------------------
 * Master component that orchestrates the entire user profile interface including
 * the avatar, menu, and modal. Handles all user profile interactions.
 *
 * Features:
 * - Manages state for menu and modal visibility
 * - Prevents double-clicks and rapid operations
 * - Coordinates profile updates with context
 * - Provides a unified interface for all profile operations
 *
 * @component
 * @example
 * <UserProfileControl user={user} onLogout={handleLogout} />
 *
 * @param {Object} props - Component props
 * @param {User} props.user - The authenticated user object
 * @param {() => Promise<void>} props.onLogout - Logout callback
 *
 * @returns {JSX.Element | null} Renders profile control interface or null if no user
 */

import { useState, useCallback } from "react";
import UserAvatar from "./UserAvatar";
import UserMenu from "./UserMenu";
import ProfileModal from "./ProfileModal";
import useUserProfile from "../../hooks/useUserProfile";
import type { User } from "../../types";

interface UserProfileControlProps {
  user: User | null | undefined;
  onLogout: () => Promise<void>;
  onAvatarClick?: () => void;
}

type ModalMode = "view" | "edit-name" | "upload";

const UserProfileControl = ({ user, onLogout, onAvatarClick }: UserProfileControlProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("view");

  const { updateName, updateProfilePicture, deleteProfilePicture } = useUserProfile();

  // Prevent menu from staying open when modal opens
  const openModal = useCallback((mode: ModalMode = "view") => {
    setMenuOpen(false);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalMode("view");
  }, []);

  const handleAvatarClick = useCallback(() => {
    if (onAvatarClick) {
      setMenuOpen(false);
      onAvatarClick();
      return;
    }

    setMenuOpen((current) => !current);
  }, [onAvatarClick]);

  /**
   * Handle logout with loading state
   */
  const handleLogout = useCallback(async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Error is already handled by useLogout hook
    }
  }, [onLogout]);

  if (!user) return null;

  return (
    <>
      <div className="relative w-fit mx-auto">
        {/* Avatar - Opens Menu */}
        <UserAvatar user={user} onOpenMenu={handleAvatarClick} />

        {/* Dropdown Menu */}
        <UserMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onViewProfile={() => openModal("view")}
          onEditName={() => openModal("edit-name")}
          onUploadPicture={() => openModal("upload")}
          onDeletePicture={async () => {
            setMenuOpen(false);
            try {
              await deleteProfilePicture();
            } catch {
              // Error already handled by hook
            }
          }}
          onLogout={handleLogout}
        />
      </div>

      {/* Profile Modal - Showing profile info, editing name, or uploading picture */}
      <ProfileModal
        isOpen={modalOpen}
        user={user}
        mode={modalMode}
        onClose={closeModal}
        onUpdateName={updateName}
        onUploadPicture={updateProfilePicture}
      />
    </>
  );
};

export default UserProfileControl;

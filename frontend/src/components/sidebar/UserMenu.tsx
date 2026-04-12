/**
 * UserMenu Component
 * ------------------
 * Dropdown menu that appears when the user avatar is clicked.
 * Provides options to view profile, edit name, manage profile picture, and logout.
 *
 * Features:
 * - Renders as a dropdown menu below the avatar
 * - Click-outside detection to close menu
 * - Keyboard support (Escape to close)
 * - Accessibility labels and ARIA attributes
 * - Smooth animations and transitions
 *
 * @component
 * @example
 * <UserMenu
 *   isOpen={menuOpen}
 *   onClose={handleCloseMenu}
 *   onViewProfile={handleViewProfile}
 *   onEditName={handleEditName}
 *   onUploadPicture={handleUploadPicture}
 *   onDeletePicture={handleDeletePicture}
 *   onLogout={handleLogout}
 * />
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the menu is currently visible
 * @param {() => void} props.onClose - Callback to close the menu
 * @param {() => void} props.onViewProfile - Callback when "View Profile" is clicked
 * @param {() => void} props.onEditName - Callback when "Edit Name" is clicked
 * @param {() => void} props.onUploadPicture - Callback when "Upload Picture" is clicked
 * @param {() => void} props.onDeletePicture - Callback when "Delete Picture" is clicked
 * @param {() => void} props.onLogout - Callback when "Logout" is clicked
 *
 * @returns {JSX.Element | null} Renders menu dropdown or null if not open
 */

import { useEffect, useRef } from "react";
import { BiSolidUserCircle, BiSolidEdit, BiSolidImageAdd, BiSolidTrash, BiLogOut } from "react-icons/bi";

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile: () => void;
  onEditName: () => void;
  onUploadPicture: () => void;
  onDeletePicture: () => void;
  onLogout: () => void;
}

const UserMenu = ({
  isOpen,
  onClose,
  onViewProfile,
  onEditName,
  onUploadPicture,
  onDeletePicture,
  onLogout,
}: UserMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click-outside to close menu
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /**
   * MenuItem Component - Individual menu option
   */
  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    variant = "default",
    "aria-label": ariaLabel,
  }: {
    icon: React.ComponentType<{ className: string }>;
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
    "aria-label"?: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors duration-150
        ${
          variant === "danger"
            ? "text-red-500 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-100"
        }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="User profile menu"
      className="absolute bottom-16 left-1/2 -translate-x-1/2 w-56 bg-white rounded-lg shadow-lg 
                 border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in 
                 duration-150"
    >
      {/* View Profile Option */}
      <MenuItem
        icon={BiSolidUserCircle}
        label="View Profile Picture"
        onClick={() => {
          onViewProfile();
          onClose();
        }}
        aria-label="View your profile picture"
      />

      {/* Divider */}
      <div className="h-px bg-slate-200" />

      {/* Edit Name Option */}
      <MenuItem
        icon={BiSolidEdit}
        label="Edit Name"
        onClick={() => {
          onEditName();
          onClose();
        }}
        aria-label="Edit your display name"
      />

      {/* Divider */}
      <div className="h-px bg-slate-200" />

      {/* Upload Picture Option */}
      <MenuItem
        icon={BiSolidImageAdd}
        label="Upload Profile Picture"
        onClick={() => {
          onUploadPicture();
          onClose();
        }}
        aria-label="Upload or update your profile picture"
      />

      {/* Delete Picture Option */}
      <MenuItem
        icon={BiSolidTrash}
        label="Remove Profile Picture"
        onClick={() => {
          onDeletePicture();
          onClose();
        }}
        variant="danger"
        aria-label="Delete your profile picture"
      />

      {/* Divider */}
      <div className="h-px bg-slate-200" />

      {/* Logout Option */}
      <MenuItem
        icon={BiLogOut}
        label="Logout"
        onClick={() => {
          onLogout();
          onClose();
        }}
        variant="danger"
        aria-label="Logout from your account"
      />
    </div>
  );
};

export default UserMenu;

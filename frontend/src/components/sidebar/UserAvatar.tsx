/**
 * UserAvatar Component
 * --------------------
 * Displays the logged-in user's profile picture in a circular format within the sidebar.
 *
 * Features:
 * - Displays user's profile picture if available
 * - Falls back to gender-based default avatars when no profile picture exists
 * - Shows a tooltip ("You") on hover with smooth animation
 * - Triggers profile menu on click
 * - Includes loading state for image fallback
 *
 * @component
 * @example
 * <UserAvatar user={user} onOpenMenu={handleOpenMenu} />
 *
 * @param {Object} props - Component props
 * @param {User} props.user - The authenticated user object containing profile data
 * @param {() => void} props.onOpenMenu - Callback fired when avatar is clicked
 *
 * @returns {JSX.Element | null} Renders circular avatar or null if user is not available
 */

import { useState } from "react";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import type { User } from "../../types";

interface UserAvatarProps {
  user: User | null | undefined;
  onOpenMenu: () => void;
}

const UserAvatar = ({ user, onOpenMenu }: UserAvatarProps) => {
  const [imageError, setImageError] = useState(false);

  if (!user) return null;

  // Use profile picture if available and hasn't failed to load; otherwise use gender-based default
  const avatarSrc = !imageError && user.profilePic ? user.profilePic : getAvatarByGender(user.gender);

  return (
    <div className="relative group">
      {/* Avatar Button */}
      <button
        onClick={onOpenMenu}
        aria-label="Open user profile menu"
        className="relative w-10 h-10 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-400 
                   transition-all duration-200 hover:scale-105 cursor-pointer focus:outline-none 
                   focus:ring-2 focus:ring-blue-500"
      >
        <img
          src={avatarSrc}
          alt={`${user.userName}'s profile picture`}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </button>

      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 
                   bg-slate-800 text-white text-sm rounded-md whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                   pointer-events-none"
      >
        You
        {/* Tooltip Arrow */}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 
                     border-transparent border-t-slate-800"
        />
      </div>
    </div>
  );
};

export default UserAvatar;
